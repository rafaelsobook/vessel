import { Vector3, Color3, PointerEventTypes } from "@babylonjs/core"
import { isGroundMesh } from "../tools/position.js"
import { getPlayersOnScene, getEnemiesOnScene, getNpcOnScene } from "../sockets/worldsocket.js"
import { getCharState } from "../charactersystem/characterstate.js"
import { openClosePopup } from "../tools/popupUI.js"

// "Click where you want it" placement mode - a ghost copy of whatever is being
// built follows the cursor, green where the spot is legal and red where it
// isn't, and a tap commits. Built generic (caller supplies the mesh to ghost
// and what to do with the chosen point) rather than bonfire-specific, because
// campcraft.js's own campcrafts array is explicitly designed to grow and every
// future Structure wants this exact interaction.
//
// Why a mesh scan and not just a ray pick: picking alone CANNOT see the
// openworld's trees. infterrain builds them as instances with isPickable =
// false (six of them in its dist bundle, the billboard/rotated forest
// scatter), and gives them no physics body either - so a camera ray fired at a
// tree passes straight through it and reports the ground behind it as a
// perfectly open spot. The pick answers "where on the ground is the cursor",
// the footprint scan below answers "is anything standing there", and both are
// needed.

const MAX_PLACE_DISTANCE = 8
// how much open ground a structure needs around the chosen point. Compared
// against each nearby mesh's own footprint radius too, so this is clearance
// BETWEEN the two, not a flat "nothing within 1.2 units of center"
const PLACEMENT_CLEARANCE = 1.2
// obstacle candidates are gathered once when placement starts, limited to this
// far around the player - everything placeable is within MAX_PLACE_DISTANCE,
// and a few seconds of placement can't meaningfully change what's standing
// inside that circle, so rescanning scene.meshes on every mouse move would be
// pure waste (openworld can hold 1500+ meshes; see renderer.js's own enemy
// count comment)
const OBSTACLE_SCAN_RADIUS = MAX_PLACE_DISTANCE + 6
// anything whose own footprint is bigger than this is scenery, not an
// obstacle: the skyBox (creationTools.js, size 1000), infterrain's water
// plane, and any village ground that slipped past isGroundMesh would each
// otherwise register as one enormous thing standing on every candidate point
const MAX_OBSTACLE_FOOTPRINT = 40

// blob shadows (creationTools.js's fakeShadow + its per-character copies) sit
// exactly under every character's feet and are named for it - they're decals,
// not things you can bump into
const IGNORED_MESH_NAMES = ["fakeshadow", "skybox", "water"]

const GHOST_VALID_TINT   = new Color3(0.15, 0.85, 0.25)
const GHOST_BLOCKED_TINT = new Color3(0.9, 0.12, 0.12)
const GHOST_ALPHA = 0.55

let active = null

// Other input gates on this - see inputMovement.js's activateMouseControls,
// which owns right-click for weapon blocking and has to stand down while
// right-click means "cancel placement" instead
export function isPlacing(){
    return active !== null
}

// mesh is part of a living character (my own player, another player/bot, an
// enemy, an npc) rather than world geometry. Checked by walking the real
// parent chain from the known body roots instead of by name, because a
// character is a whole hierarchy - createcharacter.js parents armor, weapon,
// hp bar, name plate and the skinned body itself under one capsule - and none
// of those children share a naming convention worth matching on.
// Without this my OWN avatar counts as an obstacle standing at my own feet,
// which would block every spot near the player - i.e. all of them.
function buildCharacterRootSet(){
    const roots = new Set()
    const add = (body) => { if(body) roots.add(body) }
    getPlayersOnScene()?.forEach(pl => add(pl?.body))
    getEnemiesOnScene()?.forEach(en => add(en?.body))
    getNpcOnScene()?.forEach(npc => add(npc?.body))
    return roots
}

function isCharacterMesh(mesh, characterRoots){
    let node = mesh
    while(node){
        if(characterRoots.has(node)) return true
        node = node.parent
    }
    return false
}

// One pass over scene.meshes at placement start, reduced to flat XZ discs
// {x, z, r}. Everything after this is arithmetic - no bounding-info or matrix
// work happens again per mouse move.
function collectObstacles(scene, heroPos){
    const characterRoots = buildCharacterRootSet()
    const limitSq = OBSTACLE_SCAN_RADIUS * OBSTACLE_SCAN_RADIUS
    const obstacles = []

    scene.meshes.forEach(mesh => {
        if(!mesh || mesh._isPlacementGhost) return
        // isVisible false covers the physics-only capsules createcharacter.js
        // hides (body/bodytarget), and disabled covers the hidden prop roots
        // containers.js keeps around as clone templates - neither is something
        // standing in the world
        if(!mesh.isVisible || !mesh.isEnabled()) return
        if(isGroundMesh(mesh)) return
        if(IGNORED_MESH_NAMES.some(n => mesh.name?.toLowerCase().includes(n))) return
        if(isCharacterMesh(mesh, characterRoots)) return

        const boundingBox = mesh.getBoundingInfo?.()?.boundingBox
        if(!boundingBox) return

        const centre = boundingBox.centerWorld
        const dx = centre.x - heroPos.x
        const dz = centre.z - heroPos.z
        if(dx * dx + dz * dz > limitSq) return

        const extend = boundingBox.extendSizeWorld
        const footprint = Math.max(extend.x, extend.z)
        if(footprint > MAX_OBSTACLE_FOOTPRINT) return

        obstacles.push({ x: centre.x, z: centre.z, r: footprint })
    })

    return obstacles
}

function firstBlockingObstacle(obstacles, point){
    for(const ob of obstacles){
        const dx = ob.x - point.x
        const dz = ob.z - point.z
        const minGap = ob.r + PLACEMENT_CLEARANCE
        if(dx * dx + dz * dz < minGap * minGap) return ob
    }
    return null
}

// {ok, reason, point} for the spot currently under the cursor. reason is
// player-facing copy, shown as-is when they tap an illegal spot.
function evaluateSpot(state, pointerX, pointerY){
    const { scene, heroBody, obstacles } = state
    console.log("evaluate")
    // Babylon's own pick already skips isPickable:false meshes, which is why
    // this reports the ground UNDER a tree rather than the tree - handled by
    // the obstacle pass below, not here
    const hit = scene.pick(pointerX, pointerY, mesh => !mesh._isPlacementGhost)
    if(!hit?.hit || !hit.pickedPoint) return { ok: false, reason: "Aim at the ground", point: null }
    if(!isGroundMesh(hit.pickedMesh)) return { ok: false, reason: "You can only build on open ground", point: null }

    const point = hit.pickedPoint
    // planar distance, ignoring height - standing on a ledge shouldn't make
    // the flat ground in front of you read as out of range
    const dx = point.x - heroBody.position.x
    const dz = point.z - heroBody.position.z
    if(dx * dx + dz * dz > MAX_PLACE_DISTANCE * MAX_PLACE_DISTANCE){
        return { ok: false, reason: "Too far away - move closer", point }
    }

    if(firstBlockingObstacle(obstacles, point)){
        return { ok: false, reason: "Something is already there", point }
    }

    return { ok: true, reason: null, point }
}

function buildGhost(ghostSource){
    const ghost = ghostSource.clone("placement_ghost")
    if(!ghost) return null

    // the source is one of containers.js's hidden prop templates, so the clone
    // arrives hidden/disabled exactly like createBonfireMesh's own clone does
    ghost.isVisible = true
    ghost.setEnabled(true)

    // its own material copy, never the shared template's - tinting the
    // original would recolor every already-placed bonfire in the scene
    const ghostMeshes = [ghost, ...ghost.getChildMeshes()]
    ghostMeshes.forEach(mesh => {
        mesh.isPickable = false
        mesh._isPlacementGhost = true
        mesh.isVisible = true
        mesh.visibility = GHOST_ALPHA
        if(mesh.material){
            const mat = mesh.material.clone(`${mesh.name}_ghostmat`)
            if(mat){
                mat.backFaceCulling = false
                mesh.material = mat
                mesh._ghostOwnMaterial = mat
            }
        }
    })

    return { root: ghost, meshes: ghostMeshes }
}

function tintGhost(ghost, isValid){
    const tint = isValid ? GHOST_VALID_TINT : GHOST_BLOCKED_TINT
    ghost.meshes.forEach(mesh => {
        const mat = mesh._ghostOwnMaterial
        if(!mat) return
        // emissive, not diffuse - the ghost has to read as valid/blocked in a
        // dark forest at night too, where a diffuse tint is barely lit at all
        if(mat.emissiveColor !== undefined) mat.emissiveColor = tint
    })
}

function disposeGhost(ghost){
    if(!ghost) return
    ghost.meshes.forEach(mesh => mesh._ghostOwnMaterial?.dispose())
    ghost.root.dispose()
}

// Leaves placement mode and undoes everything startPlacementMode set up.
// Safe to call twice (the active guard) - both cancel paths and the commit
// path funnel through here.
function stopPlacement(){
    if(!active) return
    const state = active
    active = null

    window.removeEventListener("keydown", state.keyHandler)

    // the scene-disposed path gets here too (see the onDisposeObservable hook
    // in startPlacementMode), and by then its observables and every mesh on it
    // are already gone - touching them would throw and strand `active`
    if(!state.scene.isDisposed){
        state.scene.onPointerObservable.remove(state.pointerObserver)
        state.scene.onDisposeObservable.remove(state.disposeObserver)
        disposeGhost(state.ghost)
    }
}

export function cancelPlacement(){
    if(!active) return
    const onCancel = active.onCancel
    stopPlacement()
    onCancel?.()
}

/**
 * Enter placement mode.
 *
 * @param {Scene}   scene
 * @param {object}  options
 * @param {Mesh}    options.ghostSource  mesh to clone as the preview (a hidden
 *                                       containers.js prop root)
 * @param {(point: Vector3) => void} options.onConfirm  chosen world point
 * @param {() => void} [options.onCancel]
 * @returns {boolean} false if placement couldn't start at all
 */
export function startPlacementMode(scene, { ghostSource, onConfirm, onCancel } = {}){
    if(active) cancelPlacement()
    if(!scene || !ghostSource || !onConfirm) return false

    const charState = getCharState()
    const heroBody = getPlayersOnScene()?.find(pl => pl.owner === charState?.owner)?.body
    if(!heroBody) return false

    const ghost = buildGhost(ghostSource)
    if(!ghost) return false

    const state = {
        scene,
        heroBody,
        ghost,
        onCancel,
        obstacles: collectObstacles(scene, heroBody.position),
        pointerObserver: null,
        keyHandler: null,
        disposeObserver: null,
    }

    // Walking through an exit trigger mid-placement tears the whole scene down
    // (main.js's changeScene disposes it), taking the ghost and both
    // observables with it. Without this, `active` would stay set against that
    // dead scene forever - isPlacing() would report true for the rest of the
    // session, which permanently suppresses right-click weapon blocking
    // (inputMovement.js gates on it) and blocks any later placement from
    // starting. Self-contained here rather than an obligation on changeScene
    // to remember.
    state.disposeObserver = scene.onDisposeObservable.add(() => {
        if(active !== state) return
        const onCancel = state.onCancel
        stopPlacement()
        onCancel?.()
    })

    const refreshPreview = (pointerX, pointerY) => {
        const verdict = evaluateSpot(state, pointerX, pointerY)
        if(verdict.point){
            ghost.root.position.copyFrom(verdict.point)
            ghost.root.setEnabled(true)
        }else{
            // cursor is off the world entirely (sky, past the terrain edge) -
            // hide rather than leaving the ghost stranded at its last spot,
            // which reads as if that stale spot were still the live choice
            ghost.root.setEnabled(false)
        }
        tintGhost(ghost, verdict.ok)
        return verdict
    }

    state.pointerObserver = scene.onPointerObservable.add(info => {
        if(info.type === PointerEventTypes.POINTERMOVE){
            refreshPreview(scene.pointerX, scene.pointerY)
            return
        }

        if(info.type === PointerEventTypes.POINTERDOWN && info.event.button === 2){
            // right-click cancels. preventDefault stops the browser's own
            // context menu, same reason inputMovement.js's own right-click
            // handler does it
            info.event.preventDefault()
            cancelPlacement()
            return
        }

        // POINTERTAP, not POINTERDOWN - the ArcRotateCamera orbits on left
        // drag, so committing on button-down would place the structure the
        // instant the player started rotating the camera to look around for a
        // spot. A tap is Babylon's own "pressed and released without
        // dragging", which is exactly the distinction needed here.
        if(info.type === PointerEventTypes.POINTERTAP && info.event.button === 0){
            const verdict = refreshPreview(scene.pointerX, scene.pointerY)
            if(!verdict.ok){
                // stays in placement mode - an illegal tap is the player
                // probing for a spot, not changing their mind
                openClosePopup(verdict.reason, true, 1400)
                return
            }
            const chosen = verdict.point.clone()
            stopPlacement()
            onConfirm(chosen)
        }
    })

    state.keyHandler = (e) => {
        if(e.key === "Escape") cancelPlacement()
    }
    window.addEventListener("keydown", state.keyHandler)

    active = state
    refreshPreview(scene.pointerX, scene.pointerY)
    return true
}
