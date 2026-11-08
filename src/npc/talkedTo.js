import { getCharState, updateMyDetailsOL } from "../charactersystem/characterstate.js"
import { checkIfTokenSaved } from "../tools/tools.js"

// WHO I'VE TALKED TO - charState.talkedTo, the _ids (npcDetails.js) of every NPC
// whose talk has been opened at least once, saved with the character
// (server/models/charDetM.js, routes/characterR.js's updateall adds them with
// $addToSet, so a stale tab can't write a shorter list back over it).
//
// Recorded the moment the talk opens (createAllNpcInArea.js), whatever the NPC
// then says - a quest NPC, a shop, a plain "ask away" guard alike. Read it with
// hasTalkedTo to gate something on having met someone: a line that only a player
// who has heard Halden's warning gets, a spar that opens after Vesper...

/** Whether I've talked to this NPC (npcDetails.js's _id) before. */
export function hasTalkedTo(npcId){
    return !!getCharState()?.talkedTo?.includes(npcId)
}

/**
 * I've opened a talk with this NPC. Saved only the first time - every later talk
 * with the same NPC changes nothing, so it costs nothing. Returns whether it was
 * new.
 */
export function recordTalkedTo(npcId){
    const charState = getCharState()
    if(!charState || !npcId) return false
    // a character saved before this existed has no list yet
    charState.talkedTo ??= []
    if(charState.talkedTo.includes(npcId)) return false
    charState.talkedTo.push(npcId)
    // not awaited: the conversation shouldn't wait on the network (a failed save
    // is already reported inside, and the id goes out again with the next save)
    updateMyDetailsOL(charState, checkIfTokenSaved())
    return true
}
