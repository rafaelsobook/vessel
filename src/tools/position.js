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