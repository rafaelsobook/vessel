import { MeshBuilder, Vector3, Quaternion, Color4 } from "@babylonjs/core"
import * as GUI from "@babylonjs/gui"

// HITMARKS - a mark left on whoever an enemy's swing lands on: the standing
// werewolves rake claws across you on their attack2. Which enemy marks which
// swing is enemy data (tcp genenemy.ts, det.hitmarks: { attackType,
// animationName, hitmarkTexture }); worldsocket.js's "enemy-attacked" calls
// showHitmark when a matching swing lands. It's in the world, on the victim's
// chest, turned to the camera - not painted over the screen - so everyone
// watching sees it, same as the blood.
//
// Kept cheap:
// - per texture, ONE plane with a GUI made for it (AdvancedDynamicTexture.
//   CreateForMesh) that draws the picture once and never again - nothing on it
//   ever changes, so it never redraws;
// - every mark is an instance of that plane: one mesh, one material, one
//   texture, one draw call however many are showing. Instances are made as
//   needed up to POOL, then reused;
// - each fades on its own through a per-instance colour (registerInstancedBuffer
//   "color", its alpha multiplied into the material's) - a few floats a frame,
//   no texture work.

const HITMARK_DIR = "./images/textures/hitmarks/"
const TEX_SIZE = 512            // the GUI texture the picture is drawn into
const SIZE = 1.3                // world units across, before the random scale
const POOL = 6                  // per texture - past that, the oldest is reused
const HOLD_MS = 200             // full strength, then
const FADE_MS = 700             // fades out over this
const TILT = 0.7                // random turn about its face, radians either way
const CHEST = 0.25              // above the body's centre
const TOWARD_CAMERA = 0.45      // out of the body toward the camera, so it isn't buried in it

let state = null                // { scene, templates: Map(texture -> mesh), marks: [] }

function stateFor(scene){
    if(state?.scene === scene) return state
    const s = state = { scene, templates: new Map(), marks: [] }
    scene.onBeforeRenderObservable.add(() => update(s))
    scene.onDisposeObservable.addOnce(() => { if(state === s) state = null })
    return s
}

function templateFor(s, texture){
    let template = s.templates.get(texture)
    if(template) return template
    template = MeshBuilder.CreatePlane(`hitmark_${texture}`, { size: 1 }, s.scene)
    // the template itself never shows - only its instances do
    template.isVisible = false
    template.isPickable = false
    template.hasVertexAlpha = true
    template.registerInstancedBuffer("color", 4)
    template.instancedBuffers.color = new Color4(1, 1, 1, 1)
    // the GUI on the plane: the picture, drawn once
    const ui = GUI.AdvancedDynamicTexture.CreateForMesh(template, TEX_SIZE, TEX_SIZE, false)
    const picture = new GUI.Image(`hitmark_img_${texture}`, HITMARK_DIR + texture)
    picture.stretch = GUI.Image.STRETCH_UNIFORM
    ui.addControl(picture)
    s.templates.set(texture, template)
    return template
}

const _toCamera = new Vector3()
const _roll = new Quaternion()
// on the target's chest, a little out toward the camera, facing it
function place(mark, camera){
    const at = mark.target.position
    camera.position.subtractToRef(at, _toCamera)
    _toCamera.y = 0
    const flat = _toCamera.length()
    if(flat > 1e-4) _toCamera.scaleInPlace(1 / flat)
    mark.mesh.position.set(at.x + _toCamera.x * TOWARD_CAMERA, at.y + CHEST, at.z + _toCamera.z * TOWARD_CAMERA)
    camera.position.subtractToRef(mark.mesh.position, _toCamera)
    Quaternion.FromLookDirectionLHToRef(_toCamera.normalize(), Vector3.UpReadOnly, mark.mesh.rotationQuaternion)
    Quaternion.RotationAxisToRef(Vector3.Forward(), mark.tilt, _roll)
    mark.mesh.rotationQuaternion.multiplyInPlace(_roll)
}

function update(s){
    if(!s.marks.length) return
    const camera = s.scene.activeCamera
    const now = performance.now()
    s.marks.forEach(mark => {
        if(!mark.active) return
        const t = now - mark.shownAt - HOLD_MS
        if(t >= FADE_MS || !camera || mark.target.isDisposed()){
            mark.active = false
            mark.mesh.setEnabled(false)
            return
        }
        mark.mesh.instancedBuffers.color.a = t <= 0 ? 1 : 1 - t / FADE_MS
        place(mark, camera)
    })
}

// texture: a file in images/textures/hitmarks/, e.g. "claw.webp".
// target: the struck body - the mark sits on it and follows it.
export function showHitmark(scene, texture, target){
    if(!scene || !texture || !target) return
    const s = stateFor(scene)
    const template = templateFor(s, texture)
    const own = s.marks.filter(m => m.template === template)
    let mark = own.find(m => !m.active)
    if(!mark && own.length >= POOL) mark = own.reduce((oldest, m) => m.shownAt < oldest.shownAt ? m : oldest)
    if(!mark){
        const mesh = template.createInstance(`hitmark_${texture}_${own.length}`)
        mesh.isPickable = false
        mesh.rotationQuaternion = new Quaternion()
        mesh.instancedBuffers.color = new Color4(1, 1, 1, 1)
        mark = { template, mesh }
        s.marks.push(mark)
    }
    mark.target = target
    mark.tilt = (Math.random() * 2 - 1) * TILT
    mark.shownAt = performance.now()
    mark.active = true
    mark.mesh.scaling.setAll(SIZE * (0.85 + Math.random() * 0.35))
    mark.mesh.instancedBuffers.color.a = 1
    mark.mesh.setEnabled(true)
    if(scene.activeCamera) place(mark, scene.activeCamera)
}
