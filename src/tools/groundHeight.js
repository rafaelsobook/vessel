import { Vector3 } from "@babylonjs/core"
import { sampleTerrainSurfaceHeight } from 'infterrain'
import { OPENWORLD_TERRAIN_VERTS } from "../constants/constants.js"

// sampleTerrainSurfaceHeight (infterrain) is a coarse, interpolated
// approximation of the terrain's real height - fine for enemy Y
// positioning (a couple units of slack is invisible on a walking monster),
// but visibly wrong for something sitting flush with the ground at an
// obvious, axis-aligned angle - confirmed in-game: the wagon's own box
// body kept sinking noticeably even though the sampled height "looked"
// close on paper.
//
// areascene.js's own openworld terrain chunks carry REAL Havok physics
// colliders (PhysicsShapeGroundMesh - see that file's own onChunkBuilt
// comment for the full setup, including its own self-test raycast that
// confirms this exact technique already works against them). Raycasting
// straight down onto that collider - the same physicsEngine.raycast()
// technique inputMovement.js's own isGrounded() already uses for the
// player - gives the EXACT rendered surface height instead of an
// approximation.
//
// sampleTerrainSurfaceHeight is still used as the raycast's own vertical
// anchor (cast from RAYCAST_MARGIN above it to RAYCAST_MARGIN below it) -
// cheap, and already known to be roughly close, so the margin only needs
// to cover its own approximation error, not the whole possible terrain
// range - and as the fallback value if the raycast finds nothing (this
// exact chunk not physics-ready yet at this (x,z), off the terrain
// entirely, or no physics engine at all - e.g. village/room places, which
// never call this in the first place today, but staying safe regardless).
const RAYCAST_MARGIN = 30

export function getRealGroundHeight(scene, x, z){
    const approxY = sampleTerrainSurfaceHeight(x, z, OPENWORLD_TERRAIN_VERTS)

    const physicsEngine = scene?.getPhysicsEngine?.()
    if(!physicsEngine) return approxY

    const from = new Vector3(x, approxY + RAYCAST_MARGIN, z)
    const to = new Vector3(x, approxY - RAYCAST_MARGIN, z)
    const result = physicsEngine.raycast(from, to)

    return result?.hasHit ? result.hitPointWorld.y : approxY
}
