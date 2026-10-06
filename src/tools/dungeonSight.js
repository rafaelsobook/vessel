import { findPlaceMetaData } from "../states/placestates.js"

// Walls in a BSP dungeon (generatebsp.js), asked of its grid - exact, and far
// cheaper than a physics ray, since the whole layout is known up front.
//
// Enemies decide when to act by distance alone (createEnemy.js's skill and
// teleport checks: "a player within 20"), which in the open world is fine -
// but a dungeon packs rooms right up against each other, so a ghost in the
// next room would cast at you, and its orb fly, straight through the rock in
// between. Anywhere that isn't a dungeon these answer "nothing in the way",
// so every other place behaves exactly as before.

function dungeonLayout(placeId){
    const place = findPlaceMetaData(placeId)
    return place?.areaType === "dungeon" && place.layout?.grid ? place.layout : null
}

function isWallCell(layout, x, z){
    const { grid, cellSize } = layout
    return (grid[Math.floor(z / cellSize)]?.[Math.floor(x / cellSize)] ?? 0) === 0
}

// is this place a dungeon at all (so worth asking the two below about)?
export function isDungeon(placeId){
    return !!dungeonLayout(placeId)
}

// is the world point (x, z) inside one of the dungeon's walls?
export function isDungeonWallAt(placeId, pos){
    const layout = dungeonLayout(placeId)
    return !!layout && isWallCell(layout, pos.x, pos.z)
}

// does a straight line between the two world points stay on floor the whole way?
// Walks every grid cell the line actually passes through, in order (a DDA grid
// traversal) - exact, so it can't step over the corner of a wall the way
// sampling points along the line can.
export function hasDungeonLineOfSight(placeId, from, to){
    const layout = dungeonLayout(placeId)
    if(!layout || !from || !to) return true
    const { grid, cellSize: cs } = layout
    const isWall = (cx, cz) => (grid[cz]?.[cx] ?? 0) === 0

    let cx = Math.floor(from.x / cs), cz = Math.floor(from.z / cs)
    const endX = Math.floor(to.x / cs), endZ = Math.floor(to.z / cs)
    const dx = to.x - from.x, dz = to.z - from.z
    const stepX = Math.sign(dx), stepZ = Math.sign(dz)
    // how far along the line (0-1) the next x / z cell boundary is, and how
    // much further each one after it
    let tMaxX = stepX > 0 ? ((cx + 1) * cs - from.x) / dx : stepX < 0 ? (cx * cs - from.x) / dx : Infinity
    let tMaxZ = stepZ > 0 ? ((cz + 1) * cs - from.z) / dz : stepZ < 0 ? (cz * cs - from.z) / dz : Infinity
    const tDeltaX = stepX ? cs / Math.abs(dx) : Infinity
    const tDeltaZ = stepZ ? cs / Math.abs(dz) : Infinity

    // can't take more steps than cells between the two ends
    const maxSteps = Math.abs(endX - cx) + Math.abs(endZ - cz) + 1
    for(let i = 0; i <= maxSteps; i++){
        if(isWall(cx, cz)) return false
        if(cx === endX && cz === endZ) return true
        if(tMaxX < tMaxZ){ cx += stepX; tMaxX += tDeltaX }
        else { cz += stepZ; tMaxZ += tDeltaZ }
    }
    return true
}
