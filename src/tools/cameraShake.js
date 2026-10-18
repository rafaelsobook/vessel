import { ArcRotateCamera } from "@babylonjs/core"

// Impact camera shake for the gameplay ArcRotateCamera, trauma-style (Squirrel
// Eiserloh's "Juicing Your Cameras With Math", GDC 2016): a hit ADDS trauma
// (0..1), trauma drains away on its own, and what's shown is trauma squared -
// so small hits barely register, a crit stacked on a combo really rocks the
// view, and every shake fades out smoothly instead of stopping dead.
//
// The motion is smooth noise, not random jumps, and it never touches the
// camera's own alpha/beta/target - the player's own orbit, zoom and the follow
// lerp (camera.js) carry on underneath untouched. It moves the view through
// targetScreenOffset (a pure view-space slide) and a little roll-free yaw
// wobble applied as an offset that is taken back off every frame, plus a
// separate FOV "punch" - a quick zoom-in on the moment of impact that springs
// back.

const TRAUMA_DECAY = 1.9          // trauma lost per second
// slide at full trauma, as a share of the screen's height - measured at the
// camera's target, so it reads the same size however far it's zoomed out. A
// sword hit (trauma ~0.4) comes to well under 1%, a crit nearer 2%.
const MAX_SCREEN_SHARE = 0.035
const MAX_YAW = 0.03              // radians of extra orbit wobble at full trauma
const NOISE_HZ = 28               // how fast it wobbles
const FOV_RETURN = 14             // per second - how quickly a punch springs back
const MAX_FOV_PUNCH = 0.09

let state = null

function noiseLattice(){
    const values = Array.from({ length: 64 }, () => Math.random() * 2 - 1)
    return t => {
        const i = Math.floor(t), f = t - i
        const a = values[i & 63], b = values[(i + 1) & 63]
        const s = f * f * (3 - 2 * f)
        return a + (b - a) * s
    }
}

function stateFor(scene){
    const camera = scene?.activeCamera
    if(!camera || !(camera instanceof ArcRotateCamera)) return null
    if(state?.scene === scene && state.camera === camera) return state
    if(state) stop()

    const s = state = {
        scene, camera,
        trauma: 0, time: 0,
        kickX: 0, kickY: 0,
        fovPunch: 0, baseFov: camera.fov,
        appliedYaw: 0,
        nx: noiseLattice(), ny: noiseLattice(), nr: noiseLattice(),
        observer: null,
    }
    s.observer = scene.onBeforeRenderObservable.add(() => {
        const dt = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05)
        s.time += dt
        // take last frame's wobble back off before anything else reads alpha
        camera.alpha -= s.appliedYaw
        s.appliedYaw = 0

        if(s.trauma > 0){
            s.trauma = Math.max(0, s.trauma - TRAUMA_DECAY * dt)
            const shake = s.trauma * s.trauma
            // how tall the view is at the camera's target, in world units
            const viewHeight = 2 * camera.radius * Math.tan(camera.fov / 2)
            const t = s.time * NOISE_HZ
            const amp = MAX_SCREEN_SHARE * shake * viewHeight
            camera.targetScreenOffset.x = (s.nx(t) + s.kickX * shake) * amp
            camera.targetScreenOffset.y = (s.ny(t + 17) + s.kickY * shake) * amp
            s.appliedYaw = s.nr(t + 41) * MAX_YAW * shake
            camera.alpha += s.appliedYaw
        } else if(camera.targetScreenOffset.x || camera.targetScreenOffset.y){
            camera.targetScreenOffset.x = 0
            camera.targetScreenOffset.y = 0
        }

        if(s.fovPunch > 0.0001){
            s.fovPunch *= Math.exp(-FOV_RETURN * dt)
            camera.fov = s.baseFov - s.fovPunch
        } else if(s.fovPunch !== 0){
            s.fovPunch = 0
            camera.fov = s.baseFov
        }
    })
    scene.onDisposeObservable.addOnce(() => { if(state === s) state = null })
    return s
}

function stop(){
    const s = state
    state = null
    if(!s || s.scene.isDisposed) return
    s.scene.onBeforeRenderObservable.remove(s.observer)
    s.camera.alpha -= s.appliedYaw
    s.camera.targetScreenOffset.x = 0
    s.camera.targetScreenOffset.y = 0
    s.camera.fov = s.baseFov
}

/**
 * Adds shake. amount 0..1 (0.3 a light tap, 0.5 a solid hit, 0.8 a crit or a
 * kill). kick: an optional push in screen space ({x, y}, about -1..1) layered on
 * the noise, so a sideways slash throws the view sideways.
 */
export function addCameraTrauma(scene, amount, kick = null){
    const s = stateFor(scene)
    if(!s) return
    s.trauma = Math.min(1, s.trauma + amount)
    if(kick){
        s.kickX = kick.x ?? 0
        s.kickY = kick.y ?? 0
    } else {
        s.kickX = s.kickY = 0
    }
}

/** A quick zoom-in on impact that springs back (radians of FOV, ~0.02-0.06). */
export function punchCameraFov(scene, amount){
    const s = stateFor(scene)
    if(!s) return
    s.fovPunch = Math.min(MAX_FOV_PUNCH, s.fovPunch + amount)
}
