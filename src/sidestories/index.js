import { startQuestionare } from "../components/conversations.js"
import strong from "./strong.js"
import vordz from "./vordz.js"
import halden from "./halden.js"
import wren from "./wren.js"
import corin from "./corin.js"
import doran from "./doran.js"
import maela from "./maela.js"
import mushruu from "./mushruu.js"
import armin from "./armin.js"
import kraun from "./kraun.js"
import talin from "./talin.js"
import tobbin from "./tobbin.js"

// THE SIDE STORIES - one file per NPC in this folder, built on kit.js. Each is
// { npcId, option(), questions(), turnIns }:
//   option()    - the line its NPC's own menu offers right now ([text, question
//                 id]), or null when there's nothing to say - read through
//                 sideStoryOption from each NPC's constants/*data.js menu
//   questions() - its question nodes (ids 1000+, a block of 20 per NPC, 1300+
//                 for the tavern), served to conversations.js's startQuestionare
//   turnIns     - [npcId, forQuests entry] pairs, joined onto those NPCs'
//                 forQuests (npcDetails.js) by attachSideStoryTurnIns - not
//                 always the story's own NPC (Vordz's wood goes to Tobbin)
export const SIDE_STORIES = [strong, vordz, halden, wren, corin, doran, maela, mushruu, armin, kraun, talin, tobbin]

/** Every side story's question nodes, for conversations.js. */
export function sideStoriesData(){
    return SIDE_STORIES.flatMap(story => story.questions())
}

/** The answers an NPC's own menu should add for its side story: [] or [{ text, cb }]. */
export function sideStoryOption(npcId){
    return SIDE_STORIES
        .filter(story => story.npcId === npcId)
        .map(story => story.option?.())
        .filter(Boolean)
        .map(([text, questionId]) => ({ text, cb: () => startQuestionare(questionId) }))
}

let attached = false
/**
 * Joins every side story's turn-ins onto its NPC's forQuests - once, before the
 * NPCs are built (createAllNpcInArea.js). Not at import: npcDetails.js and this
 * folder import each other's neighbours, and nothing here may run before
 * npcDetails.js has finished loading.
 */
export function attachSideStoryTurnIns(npcDetails){
    if(attached) return
    attached = true
    SIDE_STORIES.forEach(story => story.turnIns.forEach(([npcId, entry]) => {
        const npc = npcDetails.find(n => n._id === npcId)
        if(!npc) return console.warn(`[sidestories] no NPC "${npcId}" for the turn-in of ${entry.qName}`)
        if(!npc.forQuests.some(q => q.qName === entry.qName)) npc.forQuests.push(entry)
    }))
}
