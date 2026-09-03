import { Vector3, Ray } from "@babylonjs/core"

// well above/below any plausible terrain height in this game, and far
// enough to still reach the ground through a tall hill on either side
const GROUND_RAY_ORIGIN_HEIGHT = 50
const GROUND_RAY_LENGTH = 200

function isGroundMesh(mesh){
    if(!mesh?.name) return false
    const name = mesh.name.toLowerCase()
    // village ground (createvillage.js's `${namePrefix}_ground`) and
    // openworld's streamed infterrain chunks (areascene.js's own
    // onChunkBuilt naming) both match - deliberately loose (substring, not
    // exact) so this doesn't need updating every time a new place's ground
    // mesh gets a slightly different prefix, but still never matches a
    // tree/rock/prop mesh by accident
    return name.includes("ground") || name.includes("chunk")
}

// Real ground height at (x, z) via scene-level ray PICKING (mesh
// intersection), not a physics-engine raycast - areascene.js's own terrain
// self-test uses scene.getPhysicsEngine().raycast() instead, but that
// needs a physics body under the point; this only needs the ground MESH to
// exist, which is true everywhere sooner (and doesn't require a physics
// plugin/aggregate to be present at all).
//
// Casts down first (the normal case: starting point is already at/near
// surface level, ground is below it) - falls back to casting up (in case
// the starting point ended up already under the surface, e.g. right at a
// sloped chunk edge) before giving up and returning fallbackY.
export function findGroundY(scene, x, z, fallbackY){
    const downRay = new Ray(new Vector3(x, GROUND_RAY_ORIGIN_HEIGHT, z), Vector3.Down(), GROUND_RAY_LENGTH)
    const downHit = scene.pickWithRay(downRay, isGroundMesh)
    // pickedPoint is typed Nullable even when hit is true (rare edge-case
    // geometry) - guarded rather than assumed
    if(downHit?.hit && downHit.pickedPoint) return downHit.pickedPoint.y

    const upRay = new Ray(new Vector3(x, -GROUND_RAY_ORIGIN_HEIGHT, z), Vector3.Up(), GROUND_RAY_LENGTH)
    const upHit = scene.pickWithRay(upRay, isGroundMesh)
    if(upHit?.hit && upHit.pickedPoint) return upHit.pickedPoint.y

    return fallbackY
}

export function getSpawnPos(placeDetail){
    // Village / area / forest spawns are already in world units.
    // Dungeon spawns (BSP) are in cell indices and need the cellSize scale.
    const isCellGrid = placeDetail.areaType === 'dungeon';
    const scale = isCellGrid ? placeDetail.layout.cellSize : 1;

    const pos = {
        x: placeDetail.spawn.x * scale,
        y: placeDetail.spawn.y + 1,
        z: placeDetail.spawn.z * scale,
    };

    // console.log('[getSpawnPos] areaType:', placeDetail.areaType,
    //             '| raw spawn:', placeDetail.spawn,
    //             '| scale:', scale,
    //             '| world pos:', pos,
    //             );

    return pos;
}