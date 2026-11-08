import { getCharState } from "../charactersystem/characterstate.js"
import { findPlaceMetaData } from "../states/placestates.js"
import { travelToPlace } from "../tools/travel.js"

// "LET'S SPAR" - the two younger witches' fights (Ilvara, Sable). Beating
// Vesper (the "meet-vesper" story quest) and talking to her afterwards gets
// the warning that her sisters have taken an interest (npcDetails.js's Vesper
// forQuests speech) - and only from then on does each sister's menu
// (ilvaradata.js, sabledata.js) offer a spar. The quest is "cleared" (and not
// merely completed) at that talk: createAllNpcInArea.js records it once her
// speech has played, so nobody is offered a fight they weren't told about.
export const SPAR_UNLOCK_QUEST = "meet-vesper"

export function canSpar(){
    return !!getCharState()?.clearedQuests?.includes(SPAR_UNLOCK_QUEST)
}

/**
 * Into `arenaPlaceId` (duelingGrounds.js - the sister's own dueling grounds)
 * to fight her: the same travel Vesper's own challenge makes. The arena's
 * gate sends you back into her tower.
 */
export async function travelToSparArena(arenaPlaceId){
    const grounds = findPlaceMetaData(arenaPlaceId)
    if(!grounds) return console.warn(`travelToSparArena: dueling grounds (placeId ${arenaPlaceId}) not found`)

    await travelToPlace({
        placeId: grounds.placeId,
        name: grounds.name,
        areaType: grounds.areaType,
        x: grounds.spawn.x,
        y: grounds.spawn.y,
        z: grounds.spawn.z,
        startingPos: grounds.spawn
    })
}
