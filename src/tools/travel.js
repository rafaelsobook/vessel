import { getCharState, updateMyDetailsOL } from "../charactersystem/characterstate.js"
import { checkIfTokenSaved } from "./tools.js"
import { exitScene } from "../sockets/exitsocket.js"
import { changeScene } from "../main/main.js"
import { findPlaceMetaData } from "../states/placestates.js"
import { getSpawnPos } from "./position.js"

// Where you arrive when a door doesn't say: the destination's own spawn.
// A dungeon's spawn is in grid cells, so it goes through getSpawnPos.
function destinationSpawn(placeId){
    const meta = findPlaceMetaData(placeId)
    if(!meta?.spawn) return null
    return meta.areaType === "dungeon" ? getSpawnPos(meta) : meta.spawn
}

// Every "walk through a door / accept a duel / board the wagon / NPC sends
// you somewhere" scene transition in this codebase (areascene.js's
// roomPaths - every door, rooms' and duel arenas' included -
// duelSystem.js's acceptDuel/returnToExitPlace, wagondata.js, several
// npcDetails.js conversation callbacks) was hand-typing this exact same
// sequence: update charState's place + position, save it, exitScene,
// changeScene. One shared function instead of retyping it at every call
// site - update the sequence once here and every caller gets the fix.
// startingPos: where to stand in the new place - left out, the place's spawn.
export async function travelToPlace({ placeId, name, areaType, startingPos}){
    startingPos ??= destinationSpawn(placeId)
    // checked before charState is touched - a door with nowhere to put you
    // used to throw halfway through, leaving currentPlace already pointing at
    // the new place while the scene never changed
    if(!startingPos) return console.warn(`[travelToPlace] no startingPos for placeId ${placeId} (${name})`)

    const charState = getCharState()

    charState.currentPlace.placeId = placeId
    charState.currentPlace.name = name
    charState.currentPlace.areaType = areaType
    const {x,y,z} = startingPos
    console.log(`new place starting pos `, startingPos)
    charState.x = x
    charState.y = y
    charState.z = z

    charState.mode = "idle"

    const newCharData = await updateMyDetailsOL(charState, checkIfTokenSaved(), true, true)
    exitScene(charState.owner)
    await changeScene("whatever")
    return newCharData
}
