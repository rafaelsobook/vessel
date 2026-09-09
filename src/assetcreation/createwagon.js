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
// that's still near the ground. Simple beats clever here - just yaw
// (facing its own direction of travel, same as every other moving entity
// in this game already does), never pitch.
// fallback for a stale server process still serving an older Twagon shape
// (this field has changed more than once this session) - offsetZ:undefined
// would otherwise cascade into x/z being NaN below, silently vanishing the
// wagon (or worse) with nothing in the console to explain why
const DEFAULT_WAGON_TRAIL_OFFSET_Z = 6
export function positionWagonBehindDeer(scene, wagon, deerResolved){
    const { x: dx, z: dz, dirX, dirZ } = deerResolved
    const offsetZ = wagon.det.offsetZ ?? DEFAULT_WAGON_TRAIL_OFFSET_Z
    const x = dx - dirX * offsetZ
    const z = dz - dirZ * offsetZ
    const y = getRealGroundHeight(scene, x, z)

    wagon.body.position.set(x, y, z)
    // rotationQuaternion forced back to null so plain Euler .rotation.y
    // actually takes effect (same reasoning containers.js's own wagonRoot
    // rotation-bake comment already explains - Babylon ignores .rotation
    // entirely whenever rotationQuaternion is non-null)
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
        // missing/failed-to-load wagon.glb already warned about once in
        // containers.js - no need to spam the console again per spawn, same
        // quiet-bail convention createBonfireMesh/createTreasureMesh follow
        return null
    }

    const body = wagonRoot.clone(`wagon.${det._id}`)
    body.isVisible = true
    body.setEnabled(true)
    body.isPickable = false

    return { det, _id: det._id, body }
}
