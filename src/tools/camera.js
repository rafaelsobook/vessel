import { ArcRotateCamera, Ray, Vector3, Tools } from "@babylonjs/core";

let camera


export function createArcCam(scene, placeDetail, head){
    camera = new ArcRotateCamera(
        "camera",
        Tools.ToRadians(-90),
        Tools.ToRadians(15),
        10,
        new Vector3(
            placeDetail.spawn.x * placeDetail.layout.cellSize,
            1.6,
            placeDetail.spawn.z * placeDetail.layout.cellSize
        ),
        scene
    );
    camera.attachControl();
    camera.lowerRadiusLimit = 1.7;
    camera.upperRadiusLimit = 20//10;
    camera.lowerBetaLimit = Tools.ToRadians(20);
    camera.upperBetaLimit = Tools.ToRadians(85);
    camera.wheelPrecision = 50;
    // was 0.01 - with maxZ left at Babylon's own default (10000, never set
    // anywhere in this codebase - confirmed by grep), that's a 1,000,000:1
    // far/near ratio for a STANDARD (non-logarithmic) depth buffer, which
    // concentrates almost all of its precision within the first ~1 unit
    // from the camera and leaves very little left over by the time you
    // reach the 2-10 unit range this camera actually operates in
    // (lowerRadiusLimit/upperRadiusLimit above) - exactly the kind of setup
    // that causes z-fighting/flickering between near-coincident surfaces
    // (an equipped armor/clothing mesh sitting a couple mm off the skin
    // mesh underneath it). 0.5 keeps a comfortable margin under
    // lowerRadiusLimit (1.7, so the camera can never actually zoom past
    // this near plane) while cutting the ratio to 20,000:1 - a ~50x
    // precision improvement across the whole visible range. Was
    // apparently thin enough everywhere to go unnoticed in the village
    // (small, near-origin coordinates - see enemyDetails.ts's own village
    // entries, all under ~150 units from world origin) but visibly flicker
    // in openworld, where the character's own world-position magnitude can
    // reach into the hundreds/low-thousands (SPAWN_Z 500, slimes now out to
    // 1000 - see enemyDetails.ts) - larger world coordinates compound
    // floating-point rounding error through the same already-thin depth
    // precision budget, on top of whatever the ratio alone already cost.
    // 0.5, not 0.01 - the whole comment block above describes this fix, but
    // the value underneath it was still the broken one it says it "was", so
    // the analysis landed and the one-line change never did. Symptom is
    // exactly what that block predicts: mottled patches where a cloth mesh
    // sits a millimetre off the skin mesh beneath it, worse the further the
    // character is from world origin.
    camera.minZ = 0.5
    // camera.checkCollisions = true;
    // camera.collisionRadius = new Vector3(0.3, 0.3, 0.3);

    if(head) attachCam(head);
    return camera
}

export function attachCam(body){
    if(!camera) return console.warn("Camera not created yet to attach")
    const scene = camera.getScene()
    const smoothTarget = body.getAbsolutePosition().clone()
    camera.target.copyFrom(smoothTarget)

    if(camera._smoothFollowObserver){
        scene.onBeforeRenderObservable.remove(camera._smoothFollowObserver)
    }
    camera._smoothFollowObserver = scene.onBeforeRenderObservable.add(() => {
        const lerpSpeed = 8
        const bodyPos = body.getAbsolutePosition()
        smoothTarget.x += (bodyPos.x - smoothTarget.x) * lerpSpeed * (scene.getEngine().getDeltaTime() / 1000)
        smoothTarget.y += (bodyPos.y - smoothTarget.y) * lerpSpeed * (scene.getEngine().getDeltaTime() / 1000)
        smoothTarget.z += (bodyPos.z - smoothTarget.z) * lerpSpeed * (scene.getEngine().getDeltaTime() / 1000)
        camera.target.copyFrom(smoothTarget)
    })
}
// ROOM CAMERA OCCLUSION - areascene.js's "room" case (createroom.js's boxed
// walls) is the one place this camera can end up INSIDE geometry: the
// ArcRotateCamera orbits at a fixed radius from its target (attachCam's own
// lerped follow point, roughly head height), and a small room's own walls
// sit well within that radius the moment the player backs up against one -
// see this feature's own reference screenshot, a wall filling the whole view
// with the character rendered small in the distance beyond it. The BSP
// dungeons (createdungeon.js) have it worse - 3-cell corridors walled by
// 15-high stone - so they get it too, in their own mode (OCCLUSION_MODES
// below). Villages/openworld have nothing solid in the way at the radii they
// use, so it isn't wired in globally.
//
// Approach: every frame, raycast from the camera's real position toward the
// target and fade (not hide - still reads as "a wall is there", just not
// blocking the view) whatever it hits. Ray LENGTH stops OCCLUSION_TARGET_MARGIN
// short of the target itself, not AT it - without that margin the character's
// own body/hair meshes sit right at the ray's far end and would fade
// themselves out too.
const ROOM_OCCLUSION_ALPHA  = 0.3
const OCCLUSION_TARGET_MARGIN = 0.6 // roughly a capsule radius

let occlusionObserver = null
let occlusionScene    = null
// meshes currently faded - diffed every frame against the new hit set so a
// wall that stops blocking (camera orbited away from it) gets its visibility
// restored, not left faded forever
const currentlyFaded = new Set()
// InstancedMesh -> a translucent stand-in clone, reused across frames/hits
// rather than rebuilt each time - see setMeshFaded's own comment for why a
// clone is needed here at all instead of just setting .visibility
const ghostCache = new Map()
const _occlusionDir = new Vector3()

// createroom.js's walls/tables/chairs are all InstancedMesh (buildWall/
// placeInstancedProps both use createInstance(), one shared master per wall
// side or furniture type - see those functions' own comments on why:
// geometry/material cost stays flat no matter how many segments a room has).
// InstancedMesh.visibility turns out to be a NO-OP - confirmed directly
// (assigned 0.3, read back 1 immediately after, no error either way): it's a
// getter/setter pair that proxies to sourceMesh.visibility, so "fading" an
// instance this way would silently fade EVERY instance sharing that same
// master (the whole wall, every table) or, as actually happened here, fade
// nothing at all since the setter has no effect on what gets rendered.
// isVisible (the BOOLEAN, a completely different property) IS genuinely
// per-instance - confirmed the same way. So: hide the real (fully solid)
// instance via isVisible, and show a translucent CLONE of its source mesh in
// its exact place instead. A plain (non-instanced) Mesh - e.g. the door glb,
// loaded once via mergeAndLoadModel with no instancing at all - has no such
// problem and just gets its own .visibility set directly, no ghost needed.
function setMeshFaded(mesh, faded){
    if(!mesh.sourceMesh){
        mesh.visibility = faded ? ROOM_OCCLUSION_ALPHA : 1
        return
    }

    let ghost = ghostCache.get(mesh)
    if(faded){
        if(!ghost){
            // doNotCloneChildren:true - these are single merged meshes with
            // no child hierarchy worth carrying over (and if they ever did,
            // the clone's children would need their own visibility handling
            // too, which isn't needed for any current wall/table/chair)
            ghost = mesh.sourceMesh.clone(`${mesh.name}_occlusionGhost`, null, true)
            ghost.isPickable = false
            ghost.visibility = ROOM_OCCLUSION_ALPHA
            ghostCache.set(mesh, ghost)
        }
        ghost.position.copyFrom(mesh.position)
        // rotationQuaternion, when set, silently wins over .rotation - reset
        // it so the Euler copy right after actually takes effect (same fix
        // createwagon.js's own header comment documents for the same class
        // of bug on a freshly-cloned mesh)
        ghost.rotationQuaternion = null
        ghost.rotation.copyFrom(mesh.rotation)
        ghost.scaling.copyFrom(mesh.scaling)
        ghost.isVisible = true
        mesh.isVisible = false
    } else {
        mesh.isVisible = true
        if(ghost) ghost.isVisible = false
    }
}

// The dungeon's walls are 4x4 cubes stacked floor to ceiling - a faded one is
// still a big translucent block in the way, so they're HIDDEN outright
// (isVisible is per-instance, see setMeshFaded above). Physics is untouched:
// each wall cell collides through its own invisible collider, not its cubes.
function setMeshHidden(mesh, hidden){
    mesh.isVisible = !hidden
}

// how far either side of the centre ray the dungeon's two extra rays run -
// one ray only clears a sliver exactly on the line to the player, leaving the
// columns either side of it still filling most of the view
const DUNGEON_RAY_SPREAD = 0.8

// what each kind of place hides, and how
//  - rays: sideways offsets (world units) of the parallel rays cast, camera to player
//  - occluder: which meshes may be hidden at all
//  - conceal(mesh, on): hides/fades one mesh, or brings it back
// A mesh's _occlusionGroup (an array of meshes), when it has one, goes as a
// whole - createdungeon.js gives each wall cell's stack of cubes one, so a
// ray clipping a single cube takes the full column with it.
const OCCLUSION_MODES = {
    // createroom.js - walls, tables, chairs: anything pickable, faded
    room: {
        rays: [0],
        occluder: mesh => mesh.isPickable,
        conceal: setMeshFaded,
    },
    // createdungeon.js - only what it tagged _cameraOccluder (wall cubes and
    // ceiling tiles), never the floor, props or other players
    dungeon: {
        rays: [-DUNGEON_RAY_SPREAD, 0, DUNGEON_RAY_SPREAD],
        occluder: mesh => mesh._cameraOccluder === true,
        conceal: setMeshHidden,
    },
}
let occlusionMode = null
const _occlusionSide = new Vector3()

// targetBody - whatever the camera is actually following (createMyCharacter.js's
// own player.body/camParent), read fresh each frame since it moves. areaType
// is checked here (not left to the caller) per this feature's own ask - safe
// to call unconditionally from areascene.js's switch, a no-op everywhere
// except the places OCCLUSION_MODES has a mode for ("room", "dungeon").
export function enableRoomCameraOcclusion(scene, camera, targetBody, areaType){
    // always clear whatever the PREVIOUS room (or lack of one) left wired up
    // first - covers both "just left a room" and "re-entering the same one
    // with a freshly rebuilt scene", so stale hits from an already-disposed
    // scene are never carried forward
    disableRoomCameraOcclusion()

    const mode = OCCLUSION_MODES[areaType]
    if(!mode) return
    if(!scene || !camera || !targetBody) return

    const ray = new Ray(Vector3.Zero(), Vector3.Up(), 1)
    occlusionScene = scene
    occlusionMode = mode

    // mesh.isVisible is required here (not just the mode's occluder test) to
    // skip hidden master/template meshes that instances are made from - BUT a
    // mesh THIS SAME loop already concealed last frame also sits at
    // isVisible:false now (setMeshFaded/setMeshHidden's own doing), and
    // without the currentlyFaded fallback it would silently drop out of every
    // hit-test the moment it's hidden - reading as "stopped blocking",
    // un-hiding it, which makes it visible again and get concealed again next
    // frame: a permanent one-frame flicker, not a one-time fade.
    const isOccluder = mesh => mode.occluder(mesh) && (mesh.isVisible || currentlyFaded.has(mesh))

    occlusionObserver = scene.onBeforeRenderObservable.add(() => {
        const camPos = camera.globalPosition
        const targetPos = targetBody.getAbsolutePosition()

        targetPos.subtractToRef(camPos, _occlusionDir)
        const dist = _occlusionDir.length()
        // camera already basically AT the target (radius near its lower
        // limit) - nothing meaningful to raycast
        if(dist <= OCCLUSION_TARGET_MARGIN) return
        _occlusionDir.scaleInPlace(1 / dist)

        // sideways, level with the floor - the extra rays run parallel to
        // the centre one, this far to either side of it
        Vector3.CrossToRef(_occlusionDir, Vector3.UpReadOnly, _occlusionSide)
        if(_occlusionSide.lengthSquared() > 1e-6) _occlusionSide.normalize()

        const stillBlocking = new Set()
        mode.rays.forEach(offset => {
            ray.origin.copyFrom(camPos).addInPlace(_occlusionSide.scale(offset))
            ray.direction.copyFrom(_occlusionDir)
            ray.length = dist - OCCLUSION_TARGET_MARGIN
            scene.multiPickWithRay(ray, isOccluder)?.forEach(hit => {
                const mesh = hit.pickedMesh
                if(!mesh) return
                ;(mesh._occlusionGroup ?? [mesh]).forEach(m => stillBlocking.add(m))
            })
        })

        stillBlocking.forEach(mesh => {
            if(currentlyFaded.has(mesh)) return
            currentlyFaded.add(mesh)
            mode.conceal(mesh, true)
        })
        currentlyFaded.forEach(mesh => {
            if(stillBlocking.has(mesh)) return
            if(!mesh.isDisposed()) mode.conceal(mesh, false)
            currentlyFaded.delete(mesh)
        })
    })
}

export function disableRoomCameraOcclusion(){
    if(occlusionObserver && occlusionScene){
        // the room's WHOLE scene is disposed on every place transition
        // (areascene.js's own changeScene) before this ever runs again for a
        // NEW room - by then this observable is already torn down along with
        // it, and re-removing from a disposed Scene isn't guaranteed safe.
        // Harmless to skip: a disposed scene never fires onBeforeRender again
        // regardless of whether this cleanup ran.
        try {
            occlusionScene.onBeforeRenderObservable.remove(occlusionObserver)
        } catch (error) {
            // already-disposed scene - nothing left to remove from
        }
    }
    occlusionObserver = null
    occlusionScene = null

    const conceal = occlusionMode?.conceal ?? setMeshFaded
    currentlyFaded.forEach(mesh => {
        if(!mesh.isDisposed()) conceal(mesh, false)
    })
    currentlyFaded.clear()
    occlusionMode = null
    // NOT disposed here - every ghost belongs to the scene that's either
    // still alive (nothing to clean up yet) or already disposed along with
    // it (nothing left TO dispose). Just drop the stale references either way.
    ghostCache.clear()
}

export function camShake(scene, cam, intensity, isSlight){
    const shakeDuration = 0.1
    const shakeIntensity = intensity
    // cam.setTarget(null)
    let origAlpha = cam.alpha
    let origBeta = cam.beta

    let elapsed = 0;

    let shakeAnim = scene.onBeforeRenderObservable.add(() => {
        elapsed += scene.getEngine().getDeltaTime()/1000;

        if(elapsed < shakeDuration){
            let alphaOffset = Math.sin(elapsed * 50) * shakeIntensity;
            let betaOffset = Math.sin(elapsed * 50) * shakeIntensity;
            cam.alpha = origAlpha + alphaOffset
            if(!isSlight) cam.beta = origBeta + betaOffset
        }else{
            cam.alpha = origAlpha
            if(!isSlight) cam.beta = origBeta
            scene.onBeforeRenderObservable.remove(shakeAnim)
        }
    })
}