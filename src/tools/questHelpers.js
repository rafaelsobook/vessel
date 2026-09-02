import { getCharState, updateMyDetailsOL } from "../charactersystem/characterstate.js"
import { updateStoryQuestUI, prepareGrantedQuest } from "../charactersystem/storyQuestSystem.js"
import { checkIfTokenSaved } from "./tools.js"

// Bootstraps a brand-new story quest chain from inside a dialogue answer's
// cb(), instead of the usual entry point (createAllNpcInArea.js granting the
// *next* stage once an already-seeded charState.quests entry gets marked
// completed). Some chains - like the guards' - aren't part of the game's
// starting seed and only start once a branching conversation (see
// strongdata.js/vordzdata.js) talks the player into it.
export async function grantStoryQuest(questShortDetail){
    const charState = getCharState()
    if(!charState) return
    const alreadyHasIt = charState.quests.some(q => q.qName === questShortDetail.qName)
    if(alreadyHasIt) return

    charState.quests.push(prepareGrantedQuest(questShortDetail))
    updateStoryQuestUI(questShortDetail)
    await updateMyDetailsOL(charState, checkIfTokenSaved(), true)
}
