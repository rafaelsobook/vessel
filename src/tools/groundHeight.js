import { Vector3 } from "@babylonjs/core"
import { sampleTerrainSurfaceHeight, terrainHeight } from 'infterrain'
import { OPENWORLD_TERRAIN_VERTS, TERRAIN_CHUNK_SIZE } from "../constants/constants.js"
import { castleSurfaceY } from "../creations/createcastle.js"

// The openworld's ground at (x, z) for anything placed by height rather than
// by physics - enemies, bots, projectiles, skill effects. The terrain, unless
// a castle (creations/createcastle.js) stands there: its courtyard sits on a
// terrace above the terrain, and its wall walks, stairs and gate ramp above
// that, so the terrain alone left everything there buried under the castle.
export function openworldGroundY(x, z){
    return Math.max(sampleTerrainSurfaceHeight(x, z, OPENWORLD_TERRAIN_VERTS), castleSurfaceY(x, z))
}

// The openworld terrain's EXACT rendered height at (x, z) - the surface you
// see and stand on. infterrain builds every chunk off its terrainHeight grid
// (a vertex each TERRAIN_CELL units) and cuts each cell into two triangles
// along the (x+1, z)-(x, z+1) diagonal; this interpolates over those same two
// triangles. sampleTerrainSurfaceHeight blends the cell's four corners
// instead, which on a hillside lands up to ~1.7 off the drawn surface
// (measured against the chunk meshes) - fine for a walking monster, not for
// a building's foundation or a door. Matches the mesh to float precision.
// Like any infterrain height, only right once the openworld has been created
// (createOpenWorld sets the river's minimum width the heights depend on).
const TERRAIN_CELL = TERRAIN_CHUNK_SIZE / (OPENWORLD_TERRAIN_VERTS - 1)
export function exactTerrainY(x, z){
    const gx = Math.floor(x / TERRAIN_CELL) * TERRAIN_CELL
    const gz = Math.floor(z / TERRAIN_CELL) * TERRAIN_CELL
    const fx = (x - gx) / TERRAIN_CELL
    const fz = (z - gz) / TERRAIN_CELL
    const h10 = terrainHeight(gx + TERRAIN_CELL, gz)
    const h01 = terrainHeight(gx, gz + TERRAIN_CELL)
    if(fx + fz <= 1){
        const h00 = terrainHeight(gx, gz)
        return h00 + (h10 - h00) * fx + (h01 - h00) * fz
    }
    const h11 = terrainHeight(gx + TERRAIN_CELL, gz + TERRAIN_CELL)
    return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz)
}

// openworldGroundY's exact twin - the drawn terrain, or a castle's surface
// where one stands
export function openworldSurfaceY(x, z){
    return Math.max(exactTerrainY(x, z), castleSurfaceY(x, z))
}

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
