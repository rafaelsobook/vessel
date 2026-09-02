import { getCharState, updateMyDetailsOL } from "../charactersystem/characterstate.js"
import { updateStoryQuestUI, prepareGrantedQuest } from "../charactersystem/storyQuestSystem.js"
import { checkIfTokenSaved } from "../tools/tools.js"

// npcDetails.js's forQuests chains (see Strong/Vordz/Emry) drive the actual
// turn-in/reward/next-step dialogue entirely through createAllNpcInArea.js -
// that system activates the moment a matching qName shows up in
// charState.quests, but nothing seeds that first qName for an NPC whose
// chain doesn't start from the server's default new-character quest. This is
// the missing seed step: an ambient-dialogue answer button (see kraundata.js,
// wagondata.js, wrendata.js, corindata.js, talindata.js, arminData.js) calls
// this to push the first quest of the chain into charState.quests, and from
// then on the existing forQuests machinery takes over exactly like it does
// for Strong/Vordz.
//
// Returns "granted" | "already-active" | "cleared" so the calling dialogue
// tree can pick an appropriate response line instead of re-offering (or
// silently re-granting) a quest the player is already on or has finished.
export async function offerStarterQuest(starterQuest, finalQName){
    const charState = getCharState()

    if(charState.clearedQuests.includes(finalQName)) return "cleared"
    if(charState.quests.some(q => q.qName === starterQuest.qName || q.qName === finalQName)) return "already-active"

    charState.quests.push(prepareGrantedQuest(starterQuest))
    updateStoryQuestUI(starterQuest)
    await updateMyDetailsOL(charState, checkIfTokenSaved())
    return "granted"
}
