import { SSAO2RenderingPipeline } from "@babylonjs/core"

// AMBIENT OCCLUSION INDOORS - the guild hall, the tavern, the towers and
// every other "room" place (areascene.js's areaType "room"): corners, the
// foot of each wall, under tables and benches, where furniture meets the
// floor, all darken the way light can't reach them, so a room reads as a
// solid space instead of flat-lit boxes.
//
// Screen-space (Babylon's SSAO2), so it costs the scene's depth and normals
// plus the AO and its blur every frame - which is why it's only ever on in
// rooms: small, closed, few meshes, where it pays off most. Outdoors the
// open world never runs it. See SETTINGS for how it's kept cheap.
//
// Off on phones and tablets - their GPUs are the tightest budget the game
// has (and a phone screen hides most of the effect anyway).

const SKIP_ON_TOUCH = true
// Tuned for speed (measured in the guild hall and the tavern, through the
// game's own scene switch, on a GPU where the first version ran at 27 fps and
// the room with no AO at 60):
//  - usePrepass: depth and normals come out of the main draw. The default
//    (a geometry buffer) draws EVERY mesh a second time for them, and that
//    alone cost more than half the frame rate (27 fps -> ~45 with this).
//  - the AO pass and the blur at about a third of the screen's size, 10
//    samples: ~45 -> 50-57 fps. Babylon's SSAO2 runs its AO pass at FULL
//    resolution whatever ratio it's given (the ratio only sizes the blur), so
//    ssaoScale shrinks that pass itself. What's left is soft shadow, which a
//    blur hides the low resolution of anyway.
// Exported so a test can try other values (nothing in the game changes them).
export const SETTINGS = {
    ratio: { ssaoRatio: 0.35, blurRatio: 0.35 },
    ssaoScale: 0.35,     // the AO pass's resolution, of the screen's
    usePrepass: true,
    samples: 10,
    radius: 1.3,         // world units it looks for occluders within
    totalStrength: 1.8,
    base: 0.06,          // how light the most open surfaces stay darkened
    maxZ: 60,            // beyond this (a long hall's far end) it fades out
    minZAspect: 0.4,
}

let current = null    // { scene, pipeline }

function isTouchDevice(){
    return typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches
}

/** Turns room AO on for `camera` in this scene; it goes with the scene. Returns the pipeline, or null where it's skipped. */
export function enableRoomAO(scene, camera){
    disableRoomAO()
    if(!scene || !camera) return null
    if(SKIP_ON_TOUCH && isTouchDevice()) return null
    if(!SSAO2RenderingPipeline.IsSupported) return null
    let pipeline
    try {
        pipeline = new SSAO2RenderingPipeline("roomAO", scene, SETTINGS.ratio, [camera], !SETTINGS.usePrepass)
    } catch(error){
        console.warn("[roomAO] SSAO unavailable", error?.message ?? error)
        return null
    }
    pipeline.samples = SETTINGS.samples
    pipeline.radius = SETTINGS.radius
    pipeline.totalStrength = SETTINGS.totalStrength
    pipeline.base = SETTINGS.base
    pipeline.maxZ = SETTINGS.maxZ
    pipeline.minZAspect = SETTINGS.minZAspect
    pipeline.expensiveBlur = false
    if(SETTINGS.ssaoScale !== 1 && pipeline._ssaoPostProcess) pipeline._ssaoPostProcess._options = SETTINGS.ssaoScale
    // (a geometry buffer, if the prepass isn't in use, skips transparent meshes)
    const gbuffer = scene.geometryBufferRenderer
    if(gbuffer) gbuffer.renderTransparentMeshes = false
    current = { scene, pipeline, camera }
    scene.onDisposeObservable.addOnce(() => { if(current?.scene === scene) disableRoomAO() })
    // on and off show in the console, so it can be seen going with its room
    console.info("[roomAO] on")
    return pipeline
}

/** Turns it off (leaving the room some other way than its scene going). */
export function disableRoomAO(){
    if(!current) return
    const { scene, pipeline, camera } = current
    current = null
    try {
        scene.postProcessRenderPipelineManager?.detachCamerasFromRenderPipeline("roomAO", camera)
        pipeline.dispose(false)
        if(!scene.isDisposed){
            // whichever of the two the pipeline turned on (and the scene is
            // drawn the plain way again, not through the prepass's targets)
            scene.disableGeometryBufferRenderer()
            if(scene.prePassRenderer) scene.disablePrePassRenderer()
        }
    } catch(error){}
    console.info("[roomAO] off")
}
