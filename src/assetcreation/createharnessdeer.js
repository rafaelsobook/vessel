import { Quaternion } from "@babylonjs/core"
import { getSocketContainers } from "../sockets/worldsocket.js"
import { sampleTerrainSurfaceHeight } from 'infterrain'
import { OPENWORLD_TERRAIN_VERTS } from "../constants/constants.js"
import { createMonsterMaterial } from "../creations/creationTools.js"
import { playRandomAnim } from "../tools/animation.js"

// Openworld harness deer (tcp/recources/wagons.ts's own Tharnessdeer) -
// THIS is the primary, driving entity of the wagon/deer pairing now (used
// to be the wagon). Position is a plain sampleTerrainSurfaceHeight lookup
// at its own (x,z) - the exact same thing every enemy/slime in this game
// already does for its own Y, nothing fancier. Orientation is yaw-only
// (faces its own direction of travel, same as every other moving entity) -
// NOT the slope-sampling pitch tilt this used to have
// (faceAlongGroundSlope, tools/groundOrientation.js): that's what tipped
// the deer over onto its side (confirmed in-game), same underlying mistake
// that sent the wagon flying - an extreme/wrong pitch angle from sampling
// the ground a short distance ahead. Simple beats clever here for both of
// them. A deer's live position is a pure function of
// real-world elapsed time since its own det.startTime, NOT a value the
// server ticks/broadcasts. See wagons.ts's own header comment for the full
// reasoning (long, perfectly regular legs make a waypoint-broadcast model -
// the one tcpEnemies' own wander uses - drift badly for anyone who joins
// mid-leg). Every client calls this exact same formula off the exact same
// shared det fields, so they all land on the identical position
// independently, with zero network traffic spent on movement at all.
//
// Ping-pongs between origin and origin + heading*EFFECTIVE_halfDistance and
// back, forever - a triangle wave in "distance traveled along heading"
// space. The turnaround itself is an instant direction reversal (a "V" in
// the distance-vs-time graph, not eased into a stop/reverse) - a deliberate
// simplification for a background/non-interactive prop, not an oversight.
//
// Also returns `dirX`/`dirZ` (a unit vector - the direction it's CURRENTLY
// driving) so callers can orient the mesh correctly without re-deriving it
// themselves, since heading itself never flips, only which way the deer is
// facing along it does.
export function computeHarnessDeerPosition(det){
    const { origin, heading, spd, startTime } = det
    // "if they hit a bigger wall or a mountain in front they will change
    // direction" (verbatim) - the EFFECTIVE half distance a deer actually
    // drives before turning around, clamped to wherever its own straight
    // road first becomes too steep (see getEffectiveHalfDistance below).
    // Computed once and cached directly on det (a plain object reference
    // shared between this call and every later per-frame call for the same
    // deer, see renderer.js's own deer.det) - the scan itself never needs
    // to happen twice for the same deer.
    if(det._effectiveHalfDistance === undefined){
        det._effectiveHalfDistance = getEffectiveHalfDistance(origin, heading, det.halfDistance)
    }
    const halfDistance = det._effectiveHalfDistance

    const elapsedSec = (Date.now() - startTime) / 1000
    const legLength = halfDistance * 2
    const traveled = (elapsedSec * spd) % legLength
    const forward = traveled <= halfDistance
    const t = forward ? traveled : legLength - traveled

    return {
        x: origin.x + heading.x * t,
        z: origin.z + heading.z * t,
        dirX: forward ? heading.x : -heading.x,
        dirZ: forward ? heading.z : -heading.z,
    }
}

// how far ahead (units) a deer looks for a tree before it's considered
// "in the way" - short on purpose, this is a last-moment dodge check, not
// long-range route planning
const DEER_LOOKAHEAD_DIST = 5
const DEER_LOOKAHEAD_DIST_SQ = DEER_LOOKAHEAD_DIST * DEER_LOOKAHEAD_DIST
// how often (ms) each deer re-checks for a tree ahead - a full scene.meshes
// scan every single frame for a background prop isn't worth it; this is a
// last-moment dodge, not something that needs sub-frame precision.
// Was 500 at the deer's old 5 units/sec pace (2.5 units traveled between
// checks, comfortably inside DEER_LOOKAHEAD_DIST's 5-unit margin). Scaled
// down the same 3x the deer's own spd was bumped (see
// createwagon.js/tcp/recources/wagons.ts's own WAGON_SPD/HARNESS_SPD) to
// hold that exact same 2.5-unit margin - left at 500 with a 3x faster deer,
// it would cover 7.5 units between checks, blowing straight past the
// 5-unit lookahead with zero chance of ever detecting a tree in the gap.
const DEER_OBSTACLE_CHECK_INTERVAL_MS = 167

// "tree" is the one obstacle category confirmed to exist as its own named
// scene meshes - same substring match attackingSystem.js's own
// registerToAtkCollider already uses for real tree-hit detection, across
// both a root Mesh and every InstancedMesh clone (every tree actually
// VISIBLE in the world is an instance, not the shared root - see that
// function's own comment on why both classes need checking). Not extended
// to rocks/other props - nothing confirms those follow the same naming
// convention, and guessing wrong risks either missing a real obstacle or
// blocking on something that was never solid. getAbsolutePosition (not
// .position) so this is correct regardless of whether a given tree
// instance happens to be parented to anything.
function findNearbyTree(scene, x, z){
    for(const mesh of scene.meshes){
        const cls = mesh.getClassName()
        if(cls !== "Mesh" && cls !== "InstancedMesh") continue
        if(!mesh.name?.toLowerCase().includes("tree")) continue
        const pos = mesh.getAbsolutePosition()
        const dx = pos.x - x
        const dz = pos.z - z
        if((dx * dx + dz * dz) <= DEER_LOOKAHEAD_DIST_SQ) return mesh
    }
    return null
}

// The server has NO idea trees exist at all - tcp/index.ts is a plain Node
// backend with no scene, no meshes, nothing to check against. Only a
// CLIENT, looking at whichever chunk of the world it currently has loaded,
// can ever know one is in the way (openworld streams tree chunks in by
// PLAYER proximity, not deer position - two different clients can easily
// have different trees loaded near the same deer at the same moment).
// That's why this can't live inside computeHarnessDeerPosition's own pure
// formula the way the terrain-slope clamp above does: "did we hit a tree"
// can only ever be answered locally, per client, per deer - and the moment
// it IS answered "yes" on some client, that deer's position on THAT client
// stops being the shared formula and becomes local dead-reckoning from
// then on (deer._local below, translated per-frame the same way every
// enemy already is). Every OTHER client still watching that same deer
// through the pure formula won't see the same detour - an unavoidable
// consequence of the server never knowing trees exist, not a bug to fix
// later. The wagon it's pulling (createwagon.js's own positionWagonBehindDeer)
// automatically follows through this too, since it only ever reads
// wherever this deer's OWN resolved position ends up each frame.
//
// "stops and recalculates" (verbatim) - the only "new direction" available
// without a real pathfinding/steering system (nothing in this codebase has
// one) is reversing: turn back the way it came. Both createHarnessDeer's
// own initial placement and renderer.js's per-frame loop call this instead
// of computeHarnessDeerPosition directly - dt is only used once actually in
// local mode (formula mode needs no delta, it's recomputed fresh from
// elapsed time every call).
export function resolveHarnessDeerPosition(scene, deer, dt){
    const { det, _local: local } = deer
    const now = Date.now()

    if(!local.overridden){
        const pos = computeHarnessDeerPosition(det)

        if(scene && now - local.lastCheck >= DEER_OBSTACLE_CHECK_INTERVAL_MS){
            local.lastCheck = now
            const aheadX = pos.x + pos.dirX * DEER_LOOKAHEAD_DIST
            const aheadZ = pos.z + pos.dirZ * DEER_LOOKAHEAD_DIST
            if(findNearbyTree(scene, aheadX, aheadZ)){
                // stop (don't advance any further along the formula this
                // tick) and turn around, right where it already was
                local.overridden = true
                local.x = pos.x
                local.z = pos.z
                local.dirX = -pos.dirX
                local.dirZ = -pos.dirZ
                return { x: local.x, z: local.z, dirX: local.dirX, dirZ: local.dirZ }
            }
        }

        return pos
    }

    // already locally overridden - keep walking its own current local
    // direction (plain per-frame translate, same as every enemy already
    // does), re-checking on the same throttle for the NEXT tree ahead
    if(scene && now - local.lastCheck >= DEER_OBSTACLE_CHECK_INTERVAL_MS){
        local.lastCheck = now
        const aheadX = local.x + local.dirX * DEER_LOOKAHEAD_DIST
        const aheadZ = local.z + local.dirZ * DEER_LOOKAHEAD_DIST
        if(findNearbyTree(scene, aheadX, aheadZ)){
            local.dirX = -local.dirX
            local.dirZ = -local.dirZ
        }
    }

    local.x += local.dirX * det.spd * dt
    local.z += local.dirZ * det.spd * dt
    return { x: local.x, z: local.z, dirX: local.dirX, dirZ: local.dirZ }
}

// how far apart (in units, along heading) each terrain sample is taken -
// smaller reads the road more precisely but costs more samples; this only
// ever runs ONCE per deer (cached above), so even a fairly fine step here
// is cheap in practice (halfDistance/step samples, a few hundred at most)
const DEER_OBSTACLE_SCAN_STEP = 5
// max height CHANGE allowed between two consecutive scan samples before
// treating it as an impassable wall/mountain rather than a normal rolling
// hill - a best-effort "too steep for a deer to climb" threshold, NOT
// calibrated against this terrain's own real noise amplitude/frequency
// (not something visually verifiable from here). If a deer turns around too
// early (a gentle slope reads as a wall) or too late/never (it visibly
// climbs something absurd) once you actually see this in-game, this is the
// one number to retune - everything else here is unaffected by it.
const DEER_MAX_SLOPE_RISE = 3

// Walks the deer's own intended straight road, from origin out toward
// origin + heading*halfDistance, sampling real terrain height every
// DEER_OBSTACLE_SCAN_STEP units (same sampleTerrainSurfaceHeight every
// enemy/deer Y-position already uses - a pure function of (x,z), identical
// on every client, so every client that ever runs this scan for the same
// deer lands on the exact same effective distance independently, with no
// need to agree over the network). Stops at the first step whose height
// differs from the previous one by more than DEER_MAX_SLOPE_RISE, and
// returns the LAST safe distance reached - the deer's real turnaround
// point for that road. Only ever checks terrain STEEPNESS, not placed
// props/trees/rocks - those aren't reliably present in the scene this far
// from wherever a player actually is (openworld streams chunks in by
// player proximity, not by deer position), so a mesh-collision scan here
// would be order-dependent and unreliable in a way a pure terrain-height
// sample never is.
function getEffectiveHalfDistance(origin, heading, halfDistance){
    let prevY = sampleTerrainSurfaceHeight(origin.x, origin.z, OPENWORLD_TERRAIN_VERTS)

    for(let dist = DEER_OBSTACLE_SCAN_STEP; dist <= halfDistance; dist += DEER_OBSTACLE_SCAN_STEP){
        const x = origin.x + heading.x * dist
        const z = origin.z + heading.z * dist
        const y = sampleTerrainSurfaceHeight(x, z, OPENWORLD_TERRAIN_VERTS)
        if(Math.abs(y - prevY) > DEER_MAX_SLOPE_RISE){
            // blocked on literally its very first step (spawned right at
            // the base of something steep) - clamp to a minimum stub leg
            // rather than 0, which would make legLength 0 above and turn
            // every position computation into NaN (elapsedSec % 0)
            const safeDist = dist - DEER_OBSTACLE_SCAN_STEP
            return safeDist > 0 ? safeDist : DEER_OBSTACLE_SCAN_STEP
        }
        prevY = y
    }

    return halfDistance
}

// det - one entry from tcp/recources/wagons.ts's own Tharnessdeer (relayed
// as-is through "userJoined"/tcpHarnessDeer, see worldsocket.js's own
// reCreateMeshesInScene). Returns { det, _id, body, _local } - renderer.js's
// own per-frame loop passes this whole object into resolveHarnessDeerPosition
// to keep recomputing/applying its live position every frame, then samples
// its own y and stores the full { x, y, z, dirX, dirZ } on _lastResolved so
// createwagon.js's own positionWagonBehindDeer (whichever wagon has this
// deer's _id as its own det.deerId) can read it without recomputing
// anything. _local is this deer's own tree-dodge state (see
// resolveHarnessDeerPosition's own header comment) - starts un-overridden,
// meaning it's still just riding the pure shared formula.
export default function createHarnessDeer(scene, det){
    const deerRoot = getSocketContainers()?.deerRoot
    if(!deerRoot) return null // deer.glb missing/failed to load - already warned once in containers.js

    const entries = deerRoot.instantiateModelsToScene()
    if(!entries) return null

    entries.animationGroups.forEach(ani => ani.name = ani.name.split(" ")[2])
    const mainBodyMeshes = entries.rootNodes[0]
    mainBodyMeshes.rotationQuaternion = Quaternion.Identity()
    mainBodyMeshes.name = `harnessdeer.${det._id}`

    mainBodyMeshes.getChildMeshes().forEach(mesh => {
        mesh.name = mesh.name.split(" ")[2]?.toLowerCase() ?? mesh.name
        mesh.isPickable = false
        // det.textureName (tcp/recources/wagons.ts's own createHarnessDeer -
        // "forestdeer" today) picks which of the real deer texture variants
        // this renders with (createMonsterMaterial's own ${modelStyle}/
        // ${textureName}.jpg convention, same as every other monster
        // texture) - a data field, not hardcoded here
        if(mesh.name === "body") mesh.material = createMonsterMaterial(scene, "deer", det.textureName)
    })

    // "walking" - deer.glb's own real clip (confirmed by grepping the glb's
    // text directly, same discipline this whole feature was built with) -
    // loops for as long as this exists, so it reads as actively walking/
    // pulling rather than standing frozen mid-stride
    playRandomAnim(entries.animationGroups, "walking", true)

    const skeleton = entries.skeletons?.[0]
    const hasPelvisBone = skeleton?.bones.some(bone => bone.name === "pelvis")
    if(!hasPelvisBone) console.warn(`[createharnessdeer] deer skeleton has no "pelvis" bone anymore - this rig no longer matches what this file was originally written against (see this file's own git history for the harness-attachment context that name mattered for)`)

    const deer = { det, _id: det._id, body: mainBodyMeshes, _local: { overridden: false, lastCheck: 0 } }

    // dt:0 - resolveHarnessDeerPosition only actually uses dt in
    // local-override mode, which a deer can never already be in on its
    // very first frame
    const { x, z, dirX, dirZ } = resolveHarnessDeerPosition(scene, deer, 0)
    const y = sampleTerrainSurfaceHeight(x, z, OPENWORLD_TERRAIN_VERTS)
    deer.body.position.set(x, y, z)
    // rotationQuaternion forced back to null so plain Euler .rotation.y
    // actually takes effect (same reasoning containers.js's own wagonRoot
    // rotation-bake comment already explains - Babylon ignores .rotation
    // entirely whenever rotationQuaternion is non-null, and this mesh
    // already had one set to Identity() a few lines up)
    deer.body.rotationQuaternion = null
    deer.body.rotation.y = Math.atan2(dirX, dirZ)
    deer._lastResolved = { x, y, z, dirX, dirZ }

    return deer
}
