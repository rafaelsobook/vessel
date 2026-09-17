import { getCharState, updateMyDetailsOL } from "../charactersystem/characterstate.js"
import { checkIfTokenSaved } from "./tools.js"
import { exitScene } from "../sockets/exitsocket.js"
import { changeScene } from "../main/main.js"

// Every "walk through a door / accept a duel / board the wagon / NPC sends
// you somewhere" scene transition in this codebase (areascene.js's
// roomPaths, createroom.js's exitTrigger, createduelarena.js's exitTrigger,
// duelSystem.js's acceptDuel/returnToExitPlace, wagondata.js, several
// npcDetails.js conversation callbacks) was hand-typing this exact same
// sequence: update charState's place + position, save it, exitScene,
// changeScene. One shared function instead of retyping it at every call
// site - update the sequence once here and every caller gets the fix.
export async function travelToPlace({ placeId, name, areaType, startingPos}){
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
