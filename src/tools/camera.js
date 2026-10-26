import { ArcRotateCamera, PhysicsMotionType, PhysicsRaycastResult, Ray, Vector3, Tools } from "@babylonjs/core";
import { addCameraTrauma } from "./cameraShake.js";

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
    camera.lowerRadiusLimit = 4.7;
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
    // 0.2, between the two values this has flipped between:
    //  - 0.01 made the shirt fight through armour far from the origin.
    //    Measured (armour over a red shirt, camera at radius 16, 1500 units
    //    out): 78% of the chest showed shirt at 0.01, ~20% at 0.2 - the same
    //    as at the origin, i.e. only the shirt that really is uncovered.
    //  - 0.5 is too deep for CAMERA COLLISION below, which parks the camera
    //    CAM_COLLISION_MARGIN (0.3) short of a wall - a 0.5 near plane would
    //    cut into that wall. 0.2 stays inside the margin.
    camera.minZ = 0.5
    // camera.checkCollisions = true;
    // camera.collisionRadius = new Vector3(0.3, 0.3, 0.3);

    // a new scene - start from this camera's own radius, not the last place's
    desiredRadius = null

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
    // the physics body of whatever's followed (body is usually a child of it
    // - createcharacter.js's camParent) - the collision ray starts inside it
    let owner = body
    while(owner && !owner.physicsBody) owner = owner.parent
    followedBody = owner?.physicsBody ?? null
    camera._smoothFollowObserver = scene.onBeforeRenderObservable.add(() => {
        const lerpSpeed = 8
        const bodyPos = body.getAbsolutePosition()
        smoothTarget.x += (bodyPos.x - smoothTarget.x) * lerpSpeed * (scene.getEngine().getDeltaTime() / 1000)
        smoothTarget.y += (bodyPos.y - smoothTarget.y) * lerpSpeed * (scene.getEngine().getDeltaTime() / 1000)
        smoothTarget.z += (bodyPos.z - smoothTarget.z) * lerpSpeed * (scene.getEngine().getDeltaTime() / 1000)
        camera.target.copyFrom(smoothTarget)
        // after the target moves, so the ray starts where the camera orbits this frame
        applyCameraCollision(scene, scene.getEngine().getDeltaTime() / 1000)
        // after the collision, so it tests the radius actually rendered
        hideAvatarsBlockingCamera()
    })
    followedNode = body
}

// CAMERA COLLISION - a third-person camera's "spring arm": whenever something
// solid sits between the player and where the camera wants to be (a house,
// the castle, a hill, the dungeon cave, a room's wall), the camera is pulled
// in to just in front of it instead of ending up inside or behind it.
//
// "Solid" is the PHYSICS world, not the meshes: one ray through Havok
// (cheap however many meshes a place has) against STATIC bodies only. Every
// wall, house, rock, fence, tree and the terrain is a mass:0 static body, and
// that body is what the player actually bumps into - including for merged
// structures whose visible mesh has no body of its own (createcastle.js,
// createCaveEntrance.js). The player, other players, bots, enemies and a
// travelling wagon are dynamic, so they never shove the camera about.
//
// The radius the player zoomed to (wheel/pinch) is kept separately in
// desiredRadius. The camera snaps IN at once - a wall must never show from
// the inside, even for a frame - and eases back OUT once the way is clear.
//
// Runs from attachCam's follow observer: onBeforeRender comes after
// camera.update() (the zoom input) and before the view matrix is built, so
// the radius set here is the one rendered this frame.
const CAM_COLLISION_MARGIN     = 0.3   // stops this far short of whatever it hit
const CAM_COLLISION_MIN_RADIUS = 0.75  // never closer than this - minZ is 0.2
const CAM_RETURN_SPEED         = 5     // easing back out, per second
// Havok hands back only the NEAREST hit (the plugin's multi-hit collector is
// never enabled), so a moving body in the way (an enemy, another player) is
// stepped past and the ray cast again from just beyond it, up to this often
const CAM_RAY_MAX_STEPS        = 4
const CAM_RAY_STEP_PAST        = 0.05

// A collision-filter membership bit for static shapes the camera should look
// through rather than be pushed in by - a hall's gallery floor, its posts and
// railings, stairs (creations/roomHall.js): things you walk UNDER or past,
// where pulling the camera to your head each time would be worse than seeing
// them faded (the room occlusion below fades their mesh instead). The
// player and everything else still collide with them as normal - only the
// camera's ray skips this bit.
const CAMERA_PASS_THROUGH = 1 << 30
export function letCameraPassThrough(physicsShape){
    physicsShape.filterMembershipMask = CAMERA_PASS_THROUGH
}

let desiredRadius = null   // where the player zoomed to
let appliedRadius = null   // what this set last frame
let followedBody  = null   // attachCam's target's own body - never a blocker
const _camRayEnd   = new Vector3()
const _camRayFrom  = new Vector3()
const _camRayDir   = new Vector3()
const _camRayHit   = new PhysicsRaycastResult()

// distance from the camera's target to the first static body on the way to
// `to`, or null if the way is clear
function distanceToCameraBlocker(physics, from, to){
    to.subtractToRef(from, _camRayDir)
    const length = _camRayDir.length()
    if(length < 1e-4) return null
    _camRayDir.scaleInPlace(1 / length)

    _camRayFrom.copyFrom(from)
    const query = { collideWith: ~CAMERA_PASS_THROUGH }
    if(followedBody) query.ignoreBody = followedBody
    let travelled = 0
    for(let step = 0; step < CAM_RAY_MAX_STEPS; step++){
        physics.raycastToRef(_camRayFrom, to, _camRayHit, query)
        if(!_camRayHit.hasHit) return null
        const at = travelled + _camRayHit.hitDistance
        if(_camRayHit.body?.getMotionType() === PhysicsMotionType.STATIC) return at
        travelled = at + CAM_RAY_STEP_PAST
        if(travelled >= length) return null
        _camRayFrom.copyFrom(from).addInPlace(_camRayDir.scale(travelled))
    }
    return null
}

function applyCameraCollision(scene, dt){
    const physics = scene.getPhysicsEngine()
    if(!physics || !camera) return

    const lower = camera.lowerRadiusLimit ?? 0
    const upper = camera.upperRadiusLimit ?? Infinity
    if(desiredRadius === null){
        desiredRadius = camera.radius
        appliedRadius = camera.radius
    } else {
        // whatever camera.update() changed since last frame is the player's
        // own zoom. It also clamps the radius into its limits, so a pulled-in
        // radius below lowerRadiusLimit comes back as the limit - compare
        // against that, or the clamp itself would read as zooming out
        const expected = Math.min(Math.max(appliedRadius, lower), upper)
        desiredRadius = Math.min(Math.max(desiredRadius + camera.radius - expected, lower), upper)
    }

    // where the camera would be at the radius the player wants
    const sinBeta = Math.sin(camera.beta)
    _camRayEnd.set(
        Math.cos(camera.alpha) * sinBeta,
        Math.cos(camera.beta),
        Math.sin(camera.alpha) * sinBeta,
    ).scaleInPlace(desiredRadius).addInPlace(camera.target)

    const blockedAt = distanceToCameraBlocker(physics, camera.target, _camRayEnd)
    const radius = blockedAt === null
        ? desiredRadius
        : Math.max(CAM_COLLISION_MIN_RADIUS, blockedAt - CAM_COLLISION_MARGIN)

    const current = appliedRadius
    if(radius < current){
        appliedRadius = radius
    } else {
        appliedRadius = current + (radius - current) * Math.min(1, CAM_RETURN_SPEED * dt)
    }
    camera.radius = appliedRadius
}
// AVATARS IN THE WAY - another player, bot or npc the camera ends up inside
// (or that stands between the camera and the player) is hidden outright
// rather than showing the inside of its body, clothes and hair. They're
// dynamic bodies, so CAMERA COLLISION above deliberately ignores them.
//
// Every avatar createcharacter.js builds registers its capsule body here;
// everything it wears hangs under that body. Hidden by layerMask, not
// isVisible: the equip code toggles isVisible on its own meshes (a sheathed
// weapon, a helmet hiding hair...) and putting that back afterwards would
// undo it. A mesh whose mask shares no bit with the camera's isn't drawn.
const AVATAR_HIDDEN_MASK   = 0x10000000  // outside the camera's 0x0FFFFFFF
const AVATAR_AXIS_BELOW    = 0.7         // the avatar's axis, from its body centre
const AVATAR_AXIS_ABOVE    = 0.95        //  (feet to the top of the head)
const AVATAR_RADIUS        = 0.45        // shoulders, skirts, hair
const AVATAR_CAM_CLEARANCE = 0.65        // minZ (0.5) plus a little - closer than this shows insides
const AVATAR_TARGET_MARGIN = 0.4         // the end of the sight line near the player isn't tested
const AVATAR_HYSTERESIS    = 0.15        // a hidden avatar comes back only once this much clearer

const avatarBodies   = new Set()
const hiddenAvatars  = new Map()  // body -> Map(mesh -> its own layerMask)
let followedNode     = null       // what attachCam follows - its avatar is never hidden
const _avatarCamPos  = new Vector3()
const _avatarSight   = new Vector3()

export function registerCameraAvatar(body){
    avatarBodies.add(body)
    body.onDisposeObservable.addOnce(() => {
        avatarBodies.delete(body)
        hiddenAvatars.delete(body)
    })
}

function findAvatarOf(node){
    for(let n = node; n; n = n.parent) if(avatarBodies.has(n)) return n
    return null
}

// closest distance between segments p1-q1 and p2-q2 (Ericson, Real-Time
// Collision Detection 5.1.9), on plain numbers - this runs per avatar per frame
function segmentDistance(p1x, p1y, p1z, q1x, q1y, q1z, p2x, p2y, p2z, q2x, q2y, q2z){
    const d1x = q1x - p1x, d1y = q1y - p1y, d1z = q1z - p1z
    const d2x = q2x - p2x, d2y = q2y - p2y, d2z = q2z - p2z
    const rx = p1x - p2x, ry = p1y - p2y, rz = p1z - p2z
    const a = d1x * d1x + d1y * d1y + d1z * d1z
    const e = d2x * d2x + d2y * d2y + d2z * d2z
    const f = d2x * rx + d2y * ry + d2z * rz
    const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v
    let s = 0, t = 0
    if(a <= 1e-8 && e <= 1e-8){
        s = t = 0
    } else if(a <= 1e-8){
        t = clamp01(f / e)
    } else {
        const c = d1x * rx + d1y * ry + d1z * rz
        if(e <= 1e-8){
            s = clamp01(-c / a)
        } else {
            const b = d1x * d2x + d1y * d2y + d1z * d2z
            const denom = a * e - b * b
            s = denom > 1e-8 ? clamp01((b * f - c * e) / denom) : 0
            t = (b * s + f) / e
            if(t < 0){ t = 0; s = clamp01(-c / a) }
            else if(t > 1){ t = 1; s = clamp01((b - c) / a) }
        }
    }
    const dx = (p1x + d1x * s) - (p2x + d2x * t)
    const dy = (p1y + d1y * s) - (p2y + d2y * t)
    const dz = (p1z + d1z * s) - (p2z + d2z * t)
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function setAvatarHidden(body, hidden){
    let masks = hiddenAvatars.get(body)
    if(hidden){
        if(!masks) hiddenAvatars.set(body, masks = new Map())
        // every frame while hidden - picks up anything equipped meanwhile
        body.getChildMeshes(false).forEach(mesh => {
            if(masks.has(mesh)) return
            masks.set(mesh, mesh.layerMask)
            mesh.layerMask = AVATAR_HIDDEN_MASK
        })
    } else if(masks){
        masks.forEach((mask, mesh) => { if(!mesh.isDisposed()) mesh.layerMask = mask })
        hiddenAvatars.delete(body)
    }
}

function hideAvatarsBlockingCamera(){
    if(!camera || !avatarBodies.size) return
    // looked up each frame - the player's own avatar may register after attachCam ran
    const followedAvatar = findAvatarOf(followedNode)

    // where the camera renders from this frame - globalPosition isn't rebuilt
    // until the view matrix is, after this observer
    const sinBeta = Math.sin(camera.beta)
    _avatarCamPos.set(
        Math.cos(camera.alpha) * sinBeta,
        Math.cos(camera.beta),
        Math.sin(camera.alpha) * sinBeta,
    ).scaleInPlace(camera.radius).addInPlace(camera.target)
    // the sight line to the player, stopping short of the player itself
    camera.target.subtractToRef(_avatarCamPos, _avatarSight)
    const sightLength = _avatarSight.length()
    const sightScale = sightLength > AVATAR_TARGET_MARGIN ? (sightLength - AVATAR_TARGET_MARGIN) / sightLength : 0
    const cx = _avatarCamPos.x, cy = _avatarCamPos.y, cz = _avatarCamPos.z
    const sx = cx + _avatarSight.x * sightScale
    const sy = cy + _avatarSight.y * sightScale
    const sz = cz + _avatarSight.z * sightScale

    avatarBodies.forEach(body => {
        if(body === followedAvatar || body.isDisposed()) return
        const hidden = hiddenAvatars.has(body)
        const pos = body.getAbsolutePosition()
        const grow = hidden ? AVATAR_HYSTERESIS : 0
        const bottom = pos.y - AVATAR_AXIS_BELOW, top = pos.y + AVATAR_AXIS_ABOVE

        // quick reject: nowhere near the camera or the sight line
        const reach = AVATAR_RADIUS + AVATAR_CAM_CLEARANCE + grow + 1
        if(pos.x < Math.min(cx, sx) - reach || pos.x > Math.max(cx, sx) + reach ||
           pos.z < Math.min(cz, sz) - reach || pos.z > Math.max(cz, sz) + reach){
            if(hidden) setAvatarHidden(body, false)
            return
        }

        const camDistance = segmentDistance(cx, cy, cz, cx, cy, cz, pos.x, bottom, pos.z, pos.x, top, pos.z)
        const sightDistance = segmentDistance(cx, cy, cz, sx, sy, sz, pos.x, bottom, pos.z, pos.x, top, pos.z)
        const blocking = camDistance < AVATAR_RADIUS + AVATAR_CAM_CLEARANCE + grow ||
                         sightDistance < AVATAR_RADIUS + grow
        if(blocking || hidden) setAvatarHidden(body, blocking)
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
// below). Since CAMERA COLLISION (above) keeps the camera in front of every
// static physics body in every place, this now mostly catches meshes with
// no collider of their own and anything the camera is pressed against at
// its minimum radius.
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

// Getting hit (and the skills that call this) - now the same trauma shake a
// landed melee blow uses (tools/cameraShake.js). The old version wrote alpha/
// beta outright and put them back afterwards, which undid any camera turning
// the player did mid-shake and fought the impact shake when both ran at once.
// Every caller passes intensity .01, which comes out as a solid jolt.
export function camShake(scene, cam, intensity, isSlight){
    addCameraTrauma(scene, Math.min(1, intensity * (isSlight ? 32 : 45)), { x: 0, y: isSlight ? 0 : -0.5 })
}