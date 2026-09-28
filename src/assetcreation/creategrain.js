import { Color3, Mesh, MeshBuilder, StandardMaterial, Texture } from "@babylonjs/core"
import * as GUI from "@babylonjs/gui"
import { getPlayersOnScene } from "../sockets/worldsocket.js"
import { getCharState } from "../charactersystem/characterstate.js"
import { obtain } from "../charactersystem/inventory.js"
import { createLootItem } from "../staticRecources/resourceLoot.js"
import { emitPickupGrain } from "../sockets/emits.js"

// World grain patches (tcp/recources/grains.ts). Built like the village
// grass (createGrasses.js): an unlit plane whose black background is cut out
// by brightness - except here the two crossed planes are merged into ONE
// template, so each grain is a single instance that can be disposed on its
// own when picked up.

const GRAIN_SIZE = 1.4
const PICKUP_RADIUS = 2.5
const PROXIMITY_CHECK_EVERY_N_FRAMES = 10

const ICON_BORDER = "#caa501"
const ICON_BORDER_HOVER = "#edd59f"
const ICON_BG = "rgba(20, 15, 8, 0.75)"
const ICON_BG_HOVER = "rgba(60, 45, 15, 0.85)"

// changeScene() disposes the whole old scene (template, instances, GUI,
// render observer), so state only ever belongs to one scene - a different
// scene just means start fresh.
let state = null
// picked locally before the server's "grain-removed" echo arrives - without
// this, a reCreateMeshesInScene() in that window would respawn it
const pickedGrainIds = new Set()

function getState(scene){
    if(state?.scene === scene) return state
    state = { scene, template: buildTemplate(scene), instances: new Map(), ui: null, icon: null, linkedId: null }
    watchProximity(state)
    return state
}

function buildTemplate(scene){
    const planeA = MeshBuilder.CreatePlane("grainPlaneA", { size: 1 }, scene)
    const planeB = MeshBuilder.CreatePlane("grainPlaneB", { size: 1 }, scene)
    planeB.rotation.y = Math.PI / 2
    const template = Mesh.MergeMeshes([planeA, planeB], true)
    template.name = "grainTemplate"

    const tex = new Texture("./images/textures/grass/grain.webp", scene)
    tex.getAlphaFromRGB = true

    const mat = new StandardMaterial("grainMat", scene)
    mat.emissiveTexture = tex
    mat.opacityTexture = tex
    mat.backFaceCulling = false
    // StandardMaterial's default white diffuse gets lit ON TOP of the emissive
    // texture, washing the gold wheat out to pale cream - black keeps it
    // actually unlit, showing only the texture's own color
    mat.diffuseColor = Color3.Black()
    mat.specularColor = Color3.Black()
    template.material = mat
    mat.freeze()

    template.isVisible = false
    template.isPickable = false
    return template
}

// groundPos.y is the ground height - the plane is centered on its own
// origin, so it's raised by half its height to stand on that ground
export function createGrainMesh(scene, groundPos, grainId){
    if(pickedGrainIds.has(grainId)) return null
    const s = getState(scene)
    const existing = s.instances.get(grainId)
    if(existing) return existing

    const size = GRAIN_SIZE * (0.85 + Math.random() * 0.3)
    const grain = s.template.createInstance(`grain_${grainId}`)
    grain.scaling.setAll(size)
    grain.position.set(groundPos.x, groundPos.y + size / 2, groundPos.z)
    grain.rotation.y = Math.random() * Math.PI
    grain.isPickable = false
    grain.freezeWorldMatrix()

    s.instances.set(grainId, grain)
    return grain
}

export function removeGrainMesh(grainId){
    const grain = state?.instances.get(grainId)
    if(!grain) return
    if(state.linkedId === grainId) hideIcon(state)
    state.instances.delete(grainId)
    grain.dispose()
}

function pickUpGrain(grainId){
    if(!state?.instances.has(grainId)) return
    pickedGrainIds.add(grainId)
    removeGrainMesh(grainId)

    const item = createLootItem("grain")
    if(item) obtain(item)
    emitPickupGrain(grainId)
}

// One shared icon, re-linked to whichever grain is nearest - not one GUI
// control per grain
function getIcon(s){
    if(s.icon) return s.icon

    s.ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("grainPickupUI", true, s.scene)
    // same reason as campcraft.js's panel: a fullscreen ADT keeps compositing
    // its layer every frame even with nothing visible, unless the layer is off
    s.ui.layer.isEnabled = false

    const icon = new GUI.Ellipse("grainPickupIcon")
    icon.width = "54px"
    icon.height = "54px"
    icon.thickness = 2
    icon.color = ICON_BORDER
    icon.background = ICON_BG
    icon.hoverCursor = "pointer"
    // stops the click from also reaching inputMovement.js's
    // scene.onPointerObservable (which would swing/attack)
    icon.isPointerBlocker = true
    icon.linkOffsetY = -70
    icon.isVisible = false

    const img = new GUI.Image("grainPickupImg", "./images/items/crafting/grain.webp")
    img.width = "70%"
    img.height = "70%"
    img.isHitTestVisible = false
    icon.addControl(img)

    icon.onPointerEnterObservable.add(() => {
        icon.color = ICON_BORDER_HOVER
        icon.background = ICON_BG_HOVER
    })
    icon.onPointerOutObservable.add(() => {
        icon.color = ICON_BORDER
        icon.background = ICON_BG
    })
    icon.onPointerClickObservable.add(() => {
        if(s.linkedId) pickUpGrain(s.linkedId)
    })

    s.ui.addControl(icon)
    s.icon = icon
    return icon
}

function showIcon(s, grainId){
    const icon = getIcon(s)
    icon.linkWithMesh(s.instances.get(grainId))
    icon.isVisible = true
    s.ui.layer.isEnabled = true
    s.linkedId = grainId
}

function hideIcon(s){
    s.linkedId = null
    if(!s.icon) return
    s.icon.isVisible = false
    s.icon.linkWithMesh(null)
    s.ui.layer.isEnabled = false
}

// XZ distance only, same as creationTools.js's checkDistance - on sloped
// openworld terrain the body's Y and the grain's Y never quite agree
function watchProximity(s){
    let frame = 0
    s.scene.onBeforeRenderObservable.add(() => {
        if(++frame % PROXIMITY_CHECK_EVERY_N_FRAMES) return
        if(!s.instances.size){
            if(s.linkedId) hideIcon(s)
            return
        }

        const me = getPlayersOnScene().find(pl => pl.owner === getCharState()?.owner)
        const bodyPos = me?.body?.position
        if(!bodyPos) return

        let nearestId = null
        let nearestDistSq = PICKUP_RADIUS * PICKUP_RADIUS
        s.instances.forEach((grain, grainId) => {
            const dx = grain.position.x - bodyPos.x
            const dz = grain.position.z - bodyPos.z
            const distSq = dx * dx + dz * dz
            if(distSq < nearestDistSq){
                nearestDistSq = distSq
                nearestId = grainId
            }
        })

        if(nearestId === s.linkedId) return
        if(nearestId) showIcon(s, nearestId)
        else hideIcon(s)
    })
}
