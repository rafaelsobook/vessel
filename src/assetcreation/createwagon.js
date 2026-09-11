import { Quaternion, Vector3, PhysicsShapeConvexHull, PhysicsAggregate } from "@babylonjs/core"
import { getSocketContainers } from "../sockets/worldsocket.js"
import { getRealGroundHeight } from "../tools/groundHeight.js"

// Openworld ambient wagon traffic (tcp/recources/wagons.ts's own Twagon) -
// the wagon has NO movement law of its own anymore (used to - origin/
// heading/spd/halfDistance/startTime, the full deterministic formula plus
// tree-dodge, see this file's own git history). It's purely a follower now:
// det.deerId says which harness deer is pulling it, and every frame it just
// asks "where is that deer RIGHT NOW" (createharnessdeer.js's own
// resolveHarnessDeerPosition, already computed once per frame by
// renderer.js's own deer loop - never recomputed here, see
// positionWagonBehindDeer's own comment on why) and trails det.offsetZ
// behind it. The deer is the one with a real movement law (and the one
// that reacts to a tree in its path) because that's the entity that
// actually makes physical sense driving this pairing - a deer, not the
// cart it drags - see wagons.ts's own header comment for the fuller reasoning.

// Position: derived from wherever the deer actually is (det.offsetZ behind
// it, along ITS direction of travel - the wagon has no direction of its
// own, it's just trailing along the identical line the deer is walking).
// y used to be the same plain sampleTerrainSurfaceHeight lookup every
// enemy/slime uses for its own Y - that's a coarse, interpolated
// approximation of the terrain, close enough for a walking monster but
// visibly wrong for a flat-bottomed box sitting flush on the ground: the
// wagon kept sinking noticeably even though the sampled height "looked"
// close on paper. Now uses getRealGroundHeight (tools/groundHeight.js),
// which raycasts straight down onto the terrain's own real Havok physics
// collider for the exact rendered surface height, with
// sampleTerrainSurfaceHeight only as its fallback if the raycast misses
// (chunk not physics-ready yet, off the terrain, no physics engine).
// Still no slope/pitch math at all - that WAS tried (faceAlongGroundSlope,
// tools/groundOrientation.js - sampling ground a bit ahead and tilting to
// match) and it's what sent the wagon rocketing into the sky: the shaft
// poles extend ~5 units out from the wagon's own pivot (confirmed against
// wagon.glb's own geometry bounds), so even a moderately wrong pitch angle
// swings that whole far end dramatically into the air around a pivot
// that's still near the ground. A real Havok PhysicsAggregate
// (setLinearVelocity + letting gravity/contact derive the pitch for real)
// was also tried - it hit an explosion-on-spawn bug (fixed), then a
// flying-on-refresh bug (fixed), then came back invisible, then came back
// visible but no longer positioned behind the deer, all without ever
// reaching a confirmed-working state - reverted back to this version,
// the last one actually confirmed working, at the user's request. See
// this file's own git history if picking the physics approach back up.
// Simple beats clever here - just yaw (facing its own direction of
// travel, same as every other moving entity in this game already does),
// never pitch.
//
// UPDATE: physics is back, deliberately narrower this time - body (see
// createWagonBody) now carries a real PhysicsAggregate and the per-tick
// path (applyWagonPhysics, below) drives it via setLinearVelocity instead
// of a direct position.set. No pitch/tilt logic at all this round - yaw is
// still just force-set every tick the same proven way positionWagonBehindDeer
// already did (and the same way inputMovement.js's own rotationHelper-copy
// steers the player's own dynamic capsule), so a dynamic body doesn't
// conflict with directly-authored rotation. positionWagonBehindDeer itself
// is now ONLY the one-time spawn teleport (worldsocket.js's own initial
// placement) - it zeroes velocity right after, same reasoning
// inputMovement.js's own relocatePos already follows, and its Y now
// accounts for the box's own center pivot (see its own comment) after the
// earlier physics attempt's explosion-on-spawn bug (a center-pivoted box
// teleported straight onto the ground surface buries its bottom half in
// the terrain collider - Havok resolves that overlap with a hard
// separating impulse on the very next step).
// fallback for a stale server process still serving an older Twagon shape
// (this field has changed more than once this session) - offsetZ:undefined
// would otherwise cascade into x/z being NaN below, silently vanishing the
// wagon (or worse) with nothing in the console to explain why
const DEFAULT_WAGON_TRAIL_OFFSET_Z = 6

// Collider is now a real, purpose-modeled mesh (wagonbodycollider.glb, see
// containers.js's own wagonBodyColliderRoot) instead of a primitive built
// here - no more WAGON_BODY_HEIGHT/DEPTH size constants to keep in sync,
// the shape comes straight from the asset.
const WAGON_MASS = 1300
const WAGON_LINEAR_DAMPING = 2.9
const WAGON_ANGULAR_DAMPING = 2

// One-time teleport - ONLY called at spawn (worldsocket.js's own
// reCreateMeshesInScene, for initial placement) now that body is a real
// physics aggregate. NOT the per-tick path anymore - see applyWagonPhysics
// below for that.
//
// wagon._placedOnce ENFORCES that "one-time" - worldsocket.js's own
// "wagons-spawned" AND "harness-deer-spawned" listeners each independently
// call reCreateMeshesInScene() on receipt, and index.ts's own staggered
// startup sequence emits BOTH events on every single stagger tick - the
// existing isAlreadyHere/getMeshByName dedup in reCreateMeshesInScene
// should already stop a second CREATION for the same wagon, but this is a
// second, structural line of defense directly on the one thing that
// actually breaks if it ever fires twice: a stray repeat call here would
// silently teleport (direct position.set, not velocity) an ALREADY-MOVING
// wagon back to a NEW target computed from the deer's position at THIS
// later moment - which, after the wagon's been driving for a while, can be
// wildly different from wherever the wagon's own physics body actually is
// by now. That's a hard teleport discontinuity, not a smooth correction -
// confirmed against real logged data (a wagon's own position jumping +37
// units in ONE direction while its own commanded velocity was negative the
// entire time, the signature of a direct position write, not physics
// integration).
export function positionWagonBehindDeer(scene, wagon, deerResolved){
    if(wagon._placedOnce){
        console.warn(`[wagon debug] positionWagonBehindDeer called AGAIN for wagon.${wagon._id} - blocked (would have teleported an already-moving wagon)`)
        return
    }
    wagon._placedOnce = true

    const { x: dx, z: dz, dirX, dirZ } = deerResolved
    const offsetZ = wagon.det.offsetZ ?? DEFAULT_WAGON_TRAIL_OFFSET_Z
    const x = dx - dirX * offsetZ
    const z = dz - dirZ * offsetZ
    // wagonbodycollider.glb's own pivot already sits at its bottom (raw
    // POSITION bounds y:[0,2], confirmed straight off the glb's own JSON -
    // see containers.js's own wagonBodyColliderRoot comment), unlike the
    // old MeshBuilder box/capsule primitives (always CENTER-pivoted) that
    // needed a +height/2 offset here to keep from burying their bottom
    // half in the terrain (the "explosion on spawn" bug that caused).
    // Placing this mesh's own position.y directly at the ground surface
    // already lands its bottom flush - no offset needed anymore.
    const y = getRealGroundHeight(scene, x, z)

    wagon.body.position.set(x, y, z)
    // rotationQuaternion forced back to null so plain Euler .rotation.y
    // actually takes effect (same reasoning containers.js's own wagonRoot
    // rotation-bake comment already explains - Babylon ignores .rotation
    // entirely whenever rotationQuaternion is non-null)
    wagon.body.rotationQuaternion = null
    wagon.body.rotation.y = Math.atan2(dirX, dirZ)

    // without zeroing these out, whatever velocity/spin the physics body
    // already had (even just spawn/settling jitter) would carry straight
    // into the new spot the instant physics next ticks - same reasoning
    // inputMovement.js's own relocatePos already follows for the player
    wagon.body.aggregate.body.setLinearVelocity(Vector3.Zero())
    wagon.body.aggregate.body.setAngularVelocity(Vector3.Zero())
}

// Matches HARNESS_SPD in tcp/recources/wagons.ts - the wagon drives at the
// same speed the deer's own movement law already uses, so under normal
// conditions it holds a constant offsetZ behind the deer without the
// correction term below needing to do much work. 3x the original value
// (was 5) - HARNESS_SPD (tcp/recources/wagons.ts) was bumped the same way,
// same 3x, at the same time.
const WAGON_SPD = 15
// Proportional pull back toward the exact trailing point - velocity-
// matching alone would hold formation perfectly IF nothing ever nudged the
// wagon off pace, but real contact with the terrain's own triangulated
// surface will always introduce some drift with nothing else to correct
// it back.
const WAGON_CORRECTION_GAIN = 2
// Hard ceiling on how much EXTRA speed the correction term can ever add on
// top of WAGON_SPD - without this, a large one-off position error (a
// wagon that hasn't caught up to its deer yet for any reason) would
// multiply straight through the gain into an absurd velocity. This is the
// exact bug ("wagons flying at high speed on refresh") the earlier physics
// attempt hit - guarding against it from the start this time instead of
// bolting it on after the fact. Scaled the same 3x as WAGON_SPD (was 15) -
// left at its old absolute value, it would've stayed EQUAL to the new
// WAGON_SPD instead of generously exceeding it (3x), leaving much less
// relative headroom to actually catch up on drift at the new pace.
const WAGON_MAX_CORRECTION_SPD = 45

// reused scratch, not allocated per wagon per frame
const _wagonVelocity = new Vector3()

// The real per-tick driver - called every frame renderer.js has a fresh
// deerResolved for this wagon's paired deer. Drives the physics body via
// setLinearVelocity (only X/Z - Y is left alone, whatever gravity/contact
// with the terrain already gave it) and force-sets yaw directly every
// tick, the same proven-safe way the ONE-TIME teleport above already does
// and the same way inputMovement.js's own rotationHelper-copy steers the
// player's own dynamic capsule - a dynamic physics body directly having
// its rotation authored every tick like this is an established, working
// pattern in this codebase already, not something new being risked here.
export function applyWagonPhysics(wagon, deerResolved){
    const { x: dx, z: dz, dirX, dirZ } = deerResolved
    const offsetZ = wagon.det.offsetZ ?? DEFAULT_WAGON_TRAIL_OFFSET_Z
    const targetX = dx - dirX * offsetZ
    const targetZ = dz - dirZ * offsetZ

    const physicsBody = wagon.body.aggregate.body
    const pos = wagon.body.position

    let correctionX = (targetX - pos.x) * WAGON_CORRECTION_GAIN
    let correctionZ = (targetZ - pos.z) * WAGON_CORRECTION_GAIN
    const correctionMag = Math.sqrt(correctionX * correctionX + correctionZ * correctionZ)
    if(correctionMag > WAGON_MAX_CORRECTION_SPD){
        const scale = WAGON_MAX_CORRECTION_SPD / correctionMag
        correctionX *= scale
        correctionZ *= scale
    }

    const vel = physicsBody.getLinearVelocity()
    _wagonVelocity.set(dirX * WAGON_SPD + correctionX, vel.y, dirZ * WAGON_SPD + correctionZ)
    physicsBody.setLinearVelocity(_wagonVelocity)

    // TEMP DEBUG - initial placement is confirmed exact, so if the wagon
    // still isn't behind the deer, the drift has to be happening here,
    // ongoing. Throttled to once every 2s per wagon so it's readable
    // instead of spamming every frame. Safe to delete this whole block
    // (and _lastDebugLog) once the drift's actually found.
    const now = Date.now()
    if(!wagon._lastDebugLog || now - wagon._lastDebugLog >= 2000){
        wagon._lastDebugLog = now
        const errX = targetX - pos.x
        const errZ = targetZ - pos.z
    }

    wagon.body.rotationQuaternion = null
    wagon.body.rotation.y = Math.atan2(dirX, dirZ)
}

// det - one entry from tcp/recources/wagons.ts's own Twagon (relayed as-is
// through "userJoined"/tcpWagons, see worldsocket.js's own
// reCreateMeshesInScene). Returns { det, _id, body } - no _local/movement
// state of its own at all anymore; renderer.js's own wagon loop calls
// positionWagonBehindDeer every frame instead of anything in this file.
// worldsocket.js's own reCreateMeshesInScene calls positionWagonBehindDeer
// once right after this too, for correct initial placement (this function
// alone leaves the clone wherever wagonRoot's own template sits, since it
// has no deer position to reference without being handed one).
export default function createWagon(scene, det){
    const wagonRoot = getSocketContainers()?.wagonRoot
    if(!wagonRoot){
        // TEMP DEBUG - wagons reported invisible twice now; this branch is
        // normally silent (missing/failed-to-load wagon.glb already warned
        // about once in containers.js) but flip it loud while tracking
        // this down. Safe to revert to a plain `return null` once confirmed
        // this isn't the cause.
        console.warn(`[wagon debug] wagonRoot missing for wagon.${det._id} - createWagon bailing out, nothing will render`)
        return null
    }

    const wagonMesh = wagonRoot.clone(`wagon.${det._id}`)

    let body
    try {
        body = createWagonBody(scene, det._id)
    } catch (err) {
        // TEMP DEBUG - if PhysicsAggregate construction throws, this would
        // otherwise propagate out of createWagon uncaught - worldsocket.js's
        // own tcpWagons.forEach has no try/catch around this call, so an
        // exception here silently aborts that whole forEach iteration,
        // skipping every wagon after the one that failed too. Safe to
        // remove this whole try/catch once confirmed this isn't the cause.
        console.error(`[wagon debug] createWagonBody threw for wagon.${det._id}:`, err)
        return null
    }
    if(!body){
        // wagonBodyColliderRoot missing/failed-to-load - createWagonBody's
        // own quiet-bail (same convention as wagonRoot's own missing-check
        // above), loud here too while debug logging is still in place
        console.warn(`[wagon debug] wagonBodyColliderRoot missing for wagon.${det._id} - createWagon bailing out, nothing will render`)
        return null
    }

    body.visibility = 0.4
    wagonMesh.parent = body
    // wagonMesh's own local transform needs to be zeroed relative to its
    // new parent - left alone (just parenting, no position set), whatever
    // local position the clone carried over from wagonRoot (a standalone
    // template, never previously parented to anything) would offset the
    // visible model away from the collider it's now riding on. Both
    // wagonRoot AND wagonBodyColliderRoot now share the SAME ground-level
    // pivot convention (each baked that way in containers.js), so unlike
    // the old center-pivoted box/capsule primitives, a plain (0,0,0) local
    // offset is the correct starting point here - no vertical compensation
    // needed. Z/X may still need a small manual nudge once tested in-game
    // if the two models' own footprints don't line up exactly (the
    // collider's own bounds are asymmetric in Z, per its own comment in
    // containers.js), but that's a visual tuning constant, not a structural
    // fix like the old height offset was.
    wagonMesh.position.set(0, 0, 0)
    if(wagonMesh.rotationQuaternion) wagonMesh.rotationQuaternion = null
    wagonMesh.rotation.set(0, 0, 0)
    wagonMesh.isVisible = true
    wagonMesh.setEnabled(true)
    wagonMesh.isPickable = false

    // TEMP DEBUG - confirms creation actually reached this point and
    // reports exactly where things ended up. Safe to delete once wagons
    // are confirmed visible again.
    wagonMesh.computeWorldMatrix(true)

    return { det, _id: det._id, body }
}
// Collider mesh - a purpose-modeled glb (wagonbodycollider.glb, see
// containers.js's own wagonBodyColliderRoot) instead of a MeshBuilder
// primitive, cloned fresh per wagon straight off that persistent template
// (same simple pattern createWagon's own wagonMesh = wagonRoot.clone(...)
// already uses - no scene.getMeshByName cache/reuse dance needed here
// anymore, since the template itself already only ever loads once, up
// front, in containers.js).
//
// Shape: PhysicsShapeConvexHull, NOT "mesh" (PhysicsShapeType.MESH, a
// CONCAVE triangle-mesh shape) - "mesh" WAS tried here at the user's own
// request, then reverted after it produced exactly the predicted failure:
// the wagon stopped moving in a straight line (verified the yaw/velocity
// MATH itself is correct - matches createharnessdeer.js's own proven-
// working Math.atan2(dirX,dirZ) convention exactly, so this wasn't a
// direction-formula bug). Concave mesh shapes are a well-established
// static/kinematic-only restriction across physics engines generally
// (collision resolution against a concave shape isn't well-defined for two
// moving/dynamic bodies) - every OTHER "mesh" shapeType usage in this
// codebase (createvillage.js's own tree colliders, tools/physics.js's own
// createAggregate switch) is exclusively static/mass:0, consistent with
// that being a real constraint. This wagon is DYNAMIC (mass,
// setLinearVelocity), so PhysicsShapeConvexHull - wrapping the collider
// mesh's own real geometry in its convex hull - is the correct shape here.
function createWagonBody(scene, wagonId){
    const wagonBodyColliderRoot = getSocketContainers()?.wagonBodyColliderRoot
    if(!wagonBodyColliderRoot) return null

    const body = wagonBodyColliderRoot.clone(`wagonbody.${wagonId}`)
    // debug transparency (createWagon's own body.visibility=0.4) needs
    // isVisible=true to render at all - the TEMPLATE stays isVisible=false
    // (containers.js), so every clone needs this reset explicitly
    body.isVisible = true
    body.setEnabled(true)
    body.isPickable = false
    body.rotationQuaternion = Quaternion.Identity()

    // physics stashed directly on the returned mesh - createWagon/
    // applyWagonPhysics/positionWagonBehindDeer all reach it via
    // wagon.body.aggregate, no extra plumbing needed through createWagon's
    // own existing { det, _id, body } shape
    //
    // createAggregate (tools/physics.js) only ever auto-fits a shape from
    // the mesh's own bounding box for its "capsule"/"mesh"/"box" options -
    // no way to hand it an already-built PhysicsShape - so this constructs
    // the PhysicsAggregate directly instead (same technique areascene.js's
    // own terrain collider already uses - passing a constructed
    // PhysicsShape straight in as the second argument), manually mirroring
    // createAggregate's own post-construction setup (material + damping)
    // so this doesn't silently diverge from every other physics body in
    // this codebase's own conventions.
    const hullShape = new PhysicsShapeConvexHull(body, scene)
    const aggregate = new PhysicsAggregate(body, hullShape, { mass: WAGON_MASS }, scene)
    aggregate.shape.material = { restitution: 0, friction: 1 }
    aggregate.body.setLinearDamping(WAGON_LINEAR_DAMPING)
    aggregate.body.setAngularDamping(WAGON_ANGULAR_DAMPING)
    body.aggregate = aggregate

    // CONFIRMED root cause of "wagon not actually where it's placed" -
    // PhysicsBody.disablePreStep defaults to TRUE (see @babylonjs/core's
    // own physicsBody.js: "Disable pre-step that consists in updating
    // Physics Body from Transform Node Translation/Orientation. True by
    // default for maximum performance.") - meaning a DYNAMIC body, by
    // default, completely IGNORES any direct change to its mesh's
    // position/rotationQuaternion (positionWagonBehindDeer's teleport,
    // applyWagonPhysics's yaw write): Havok just overwrites them straight
    // back from its own internal state on the very next physics step.
    // createcharacter.js's own player aggregate hits this exact same issue
    // and fixes it the exact same way (aggregate.body.disablePreStep =
    // false right after creation) - that's the one line that actually lets
    // inputMovement.js's own rotationHelper-copy steer the player's
    // capsule; without it, that copy would be just as silently discarded
    // as this wagon's own teleport/rotation writes were.
    body.aggregate.body.disablePreStep = false

    return body
}
