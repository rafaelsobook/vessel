import { MeshBuilder, Mesh, Vector3, StandardMaterial, Color3 } from "@babylonjs/core"
import * as GUI from "@babylonjs/gui"
import { createMat } from "../tools/materials.js"
import { createAggregate } from "../tools/physics.js"
import { onIntersecEnterTrig, onIntersecExitTrig } from "../components/actionManager.js"
import { openCloseInteractBtn } from "../tools/popupUI.js"
import { sampleTerrainSurfaceHeight } from "infterrain"
import { OPENWORLD_TERRAIN_VERTS } from "../constants/constants.js"

// Four standing stone scriptures/waymarkers, one per cardinal direction,
// ringed around a center point - built the exact same way createcastle.js's
// own castle is: MeshBuilder primitives only, merged into one mesh per
// stone (multiMultiMaterials:true keeps the dark rock body and the pale
// (non-glowing) rune panel as two real materials through the merge, same
// technique/reasoning as that file's own stone/roof split), physics kept
// separate from the merged visual mesh. Ties directly into Vesper's own
// post-duel warning (npcDetails.js's "meet-vesper" win speech): "four dark
// beasts stand over it, one to each direction - north, south, east, west" -
// these are that same warning made physical, planted where a player
// standing at the openworld's own spawn point can't miss them.
//
// +z is north, -z is south, +x east, -x west - this project's own
// established convention (tcp/recources/wagons.ts's own WAGON_HEADINGS
// comment: "south wall now at z:-8... so +z is north, -z is south, and
// east/west follow the standard right-handed pairing (+x east, -x west)").

const BASE_WIDTH = 2
const BASE_HEIGHT = 0.5
const BASE_DEPTH = 1.2
const SLAB_WIDTH = 1.4
const SLAB_HEIGHT = 3.2
const SLAB_DEPTH = 0.6
const CAP_WIDTH = 0.9
const CAP_HEIGHT = 0.6
const CAP_DEPTH = 0.4
const PANEL_WIDTH = 0.8
const PANEL_HEIGHT = 1.6
// how far the inscription panel sits proud of the slab's own front face -
// a z-fighting margin, same idea createcastle.js's own FLOOR_LIFT already
// needed for the same reason
const PANEL_OFFSET = 0.03
const TOTAL_HEIGHT = BASE_HEIGHT + SLAB_HEIGHT + CAP_HEIGHT

// one line per direction - the stones' own inscriptions, standing on their
// own as in-world lore rather than quoting any one person's warning
const DANGER_MESSAGES = {
    north: "The northern reach answers to something dark. None who marched on it long ago returned to say what.",
    south: "A beast older than these stones still holds the southern approach. Its territory does not forgive trespassers.",
    east: "The eastern road is watched. What follows travelers there is patient, and rarely seen twice.",
    west: "West of here, a guardian keeps its post in the dark, waiting for a reason to wake.",
}

let stoneMat = null
let runeMat = null
let matScene = null
function getMaterials(scene){
    // compared BEFORE overwriting matScene, same order createcastle.js's
    // own getMaterials (and createweapon.js's partMatCacheScene before
    // that) already established this pattern for
    if(matScene !== scene){
        stoneMat = null
        runeMat = null
    }
    matScene = scene
    if(!stoneMat){
        // same rockTex.jpg createcastle.js's own walls use - both are
        // "worked stone" structures, no reason for them to look like two
        // different kinds of rock
        stoneMat = createMat("scriptureStoneMat", false, "./images/modeltex/rockTex.jpg", scene, { uScale: 1, vScale: 2 })
    }
    if(!runeMat){
        runeMat = new StandardMaterial("scriptureRuneMat", scene)
        runeMat.diffuseColor = new Color3(0.55, 0.72, 0.9) // pale engraved blue-white
        runeMat.specularColor = new Color3(0, 0, 0)
    }
    return { stoneMat, runeMat }
}

// one standing stone - base pedestal, tall slab, tapered cap, and a
// recessed-reading inscription panel on the OUTWARD face (local +z, the
// direction the whole stone gets rotated to actually face - see
// createStoneScripture's own rotation.y assignment). Everything built at
// local origin and merged before any position/rotation is applied, same
// "build flat, place once" approach createcastle.js's own pieces already use.
function buildStoneMeshes(stoneMat, runeMat){
    const meshes = []

    const base = MeshBuilder.CreateBox("scripture_base", { width: BASE_WIDTH, height: BASE_HEIGHT, depth: BASE_DEPTH }, matScene)
    base.position.set(0, BASE_HEIGHT / 2, 0)
    base.material = stoneMat
    meshes.push(base)

    const slab = MeshBuilder.CreateBox("scripture_slab", { width: SLAB_WIDTH, height: SLAB_HEIGHT, depth: SLAB_DEPTH }, matScene)
    slab.position.set(0, BASE_HEIGHT + SLAB_HEIGHT / 2, 0)
    slab.material = stoneMat
    meshes.push(slab)

    const cap = MeshBuilder.CreateBox("scripture_cap", { width: CAP_WIDTH, height: CAP_HEIGHT, depth: CAP_DEPTH }, matScene)
    cap.position.set(0, BASE_HEIGHT + SLAB_HEIGHT + CAP_HEIGHT / 2, 0)
    cap.material = stoneMat
    meshes.push(cap)

    const panel = MeshBuilder.CreateBox("scripture_panel", { width: PANEL_WIDTH, height: PANEL_HEIGHT, depth: 0.05 }, matScene)
    panel.position.set(0, BASE_HEIGHT + SLAB_HEIGHT / 2 + 0.2, SLAB_DEPTH / 2 + PANEL_OFFSET)
    panel.material = runeMat
    meshes.push(panel)

    return meshes
}

// how long a shown danger message stays up before auto-dismissing on its own
const WARNING_DURATION_MS = 6000
// how far in front of the stone's own inscription panel the interact
// trigger sits, and how big it is - same "small invisible box parented to
// the thing you're interacting with" shape every other proximity trigger in
// this game already uses (createroom.js's own exit door trigger, etc)
const TRIGGER_DEPTH = 3
const TRIGGER_SIZE = 3

// a real babylon.js GUI panel (@babylonjs/gui, mesh-attached
// AdvancedDynamicTexture) - same technique tools/GUITools.js's own
// createHpBar already uses (Mesh.CreatePlane + billboardMode:ALL +
// GUI.AdvancedDynamicTexture.CreateForMesh), just a bigger warning panel
// instead of a thin hp bar. Parented to the stone itself so it floats right
// above it and inherits the stone's own position/rotation for free -
// billboardMode:ALL then keeps the PANEL ITSELF always facing the camera
// regardless of which way the stone is rotated.
function showDangerMessage(scene, scripture, message){
    const plane = Mesh.CreatePlane("scripture_warning", 5, scene)
    plane.isPickable = false
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL
    plane.parent = scripture
    plane.position = new Vector3(0, TOTAL_HEIGHT + 1.2, 0)

    const texture = GUI.AdvancedDynamicTexture.CreateForMesh(plane, 1024, 512)

    const panel = new GUI.Rectangle("scripture_warning_bg")
    panel.width = "900px"
    panel.height = "300px"
    panel.cornerRadius = 16
    panel.color = "#c0392b"
    panel.thickness = 5
    panel.background = "rgba(15,0,0,0.85)"
    texture.addControl(panel)

    const title = new GUI.TextBlock("scripture_warning_title")
    title.text = "⚠ DANGER"
    title.color = "#ff5c4d"
    title.fontSize = 72
    title.fontWeight = "bold"
    title.top = "-90px"
    panel.addControl(title)

    const body = new GUI.TextBlock("scripture_warning_body")
    body.text = message
    body.color = "white"
    body.fontSize = 38
    body.textWrapping = true
    body.top = "40px"
    body.paddingLeft = "40px"
    body.paddingRight = "40px"
    panel.addControl(body)

    setTimeout(() => {
        texture.dispose()
        plane.dispose()
    }, WARNING_DURATION_MS)
}

// proximity trigger (same onIntersecEnterTrig/onIntersecExitTrig +
// openCloseInteractBtn shape createroom.js's own exit door already uses) -
// walking up to a stone shows the interact prompt, pressing it shows that
// stone's own DANGER_MESSAGES entry. Re-interacting just restarts the
// message's own timer (a fresh showDangerMessage call disposes cleanly on
// its own after WARNING_DURATION_MS regardless of how many times it's
// triggered) rather than trying to track/cancel a previous still-showing one.
function registerScriptureInteraction(scene, scripture, characterBody, dirName){
    if(!characterBody) return
    const trigger = MeshBuilder.CreateBox(`scripture_${dirName}_trigger`, { width: TRIGGER_SIZE, height: TRIGGER_SIZE, depth: TRIGGER_DEPTH }, scene)
    trigger.parent = scripture
    trigger.position = new Vector3(0, TOTAL_HEIGHT / 2, SLAB_DEPTH / 2 + TRIGGER_DEPTH / 2)
    trigger.isVisible = false
    trigger.isPickable = false

    onIntersecEnterTrig(trigger, characterBody, scene, () => {
        openCloseInteractBtn("normal", "none", () => {
            openCloseInteractBtn(false)
            showDangerMessage(scene, scripture, DANGER_MESSAGES[dirName])
        })
    })
    onIntersecExitTrig(trigger, characterBody, scene, () => {
        openCloseInteractBtn(false, false)
    })
}

// one direction's full stone - the merged visual mesh, positioned and
// rotated to face its own cardinal direction.
function createStoneScripture(scene, position, dir, characterBody, hasPhysics){
    const { stoneMat, runeMat } = getMaterials(scene)
    const meshes = buildStoneMeshes(stoneMat, runeMat)

    // multiMultiMaterials:true - same stone/rune material split preserved
    // through the merge that createcastle.js's own stone/roof split already
    // relies on
    const scripture = Mesh.MergeMeshes(meshes, true, true, undefined, false, true)
    scripture.name = `scripture_${dir.name}`

    const groundY = sampleTerrainSurfaceHeight(position.x, position.z, OPENWORLD_TERRAIN_VERTS)
    scripture.position = new Vector3(position.x, groundY, position.z)
    // faces OUTWARD, away from center - atan2(dx,dz) is this project's own
    // established yaw convention everywhere else (duelSystem.js's own
    // facing math, the wagon, every skill projectile)
    scripture.rotation.y = Math.atan2(dir.dx, dir.dz)
    scripture.isPickable = false
    scripture.receiveShadows = true

    if(hasPhysics){
        // single box aggregate on the merged stone's own full bounding box -
        // a slightly generous fit around the tapered cap/narrower panel,
        // same acceptable approximation createcastle.js's own wall colliders
        // already use rather than chasing exact per-piece collision on a
        // small monument object nobody needs pixel-precise collision against
        createAggregate(scripture, { mass: 0 }, "box", scene)
    }

    registerScriptureInteraction(scene, scripture, characterBody, dir.name)

    return scripture
}

// createStoneScriptures(scene, characterBody, centerX=0, centerZ=500, radius=15) -
// four stones ringed around (centerX, centerZ) at `radius` units out, one
// per cardinal direction. y is resampled live per-stone against the real
// openworld terrain (sampleTerrainSurfaceHeight), same reasoning
// createcastle.js's own createCastle already needed this for - this
// function has to run at real scene-setup time (scene already in hand) for
// that to work, not from a data-only localroomdb.js entry. characterBody
// (same param createRoom's own exit-door trigger already takes) is who the
// proximity/interact trigger actually watches for - omit it (or pass a
// falsy value) to skip wiring up interaction entirely and just place the
// four stones as plain scenery.
export function createStoneScriptures(scene, characterBody, centerX = 0, centerZ = 500, radius = 15, hasPhysics = true){
    const directions = [
        { name: "north", dx: 0, dz: 1 },
        { name: "south", dx: 0, dz: -1 },
        { name: "east", dx: 1, dz: 0 },
        { name: "west", dx: -1, dz: 0 },
    ]
    return directions.map(dir => createStoneScripture(scene, {
        x: centerX + dir.dx * radius,
        z: centerZ + dir.dz * radius,
    }, dir, characterBody, hasPhysics))
}
