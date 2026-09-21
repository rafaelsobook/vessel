import { getPlayersOnScene } from "../sockets/worldsocket.js"
import { getCharState } from "../charactersystem/characterstate.js"
import { onIntersecEnterTrig, onIntersecExitTrig } from "../components/actionManager.js"
import { openCloseInteractBtn, showAnswerButtons } from "../tools/popupUI.js"
import { emitRecruitBot, emitDismissBot } from "../sockets/emits.js"

// bot-only "walk up and interact" prompt, offering to recruit it as a
// following servant/companion (or dismiss one you already have) - reuses
// the exact same onIntersecEnterTrig/openCloseInteractBtn/showAnswerButtons
// primitives npc/createAllNpcInArea.js already wires up for a real NPC's
// own talk range + choice list, just pointed at a bot's body/owner id
// instead of a static npcDetails.js entry. A bot has no randomSpeech/
// forQuests dialogue tree of its own (that's npcDetails.js data these
// don't have) - this skips straight to the choice list instead of a
// Conversation typing out an intro line first.
//
// Called once per bot mesh, right where createcharacter.js builds it (same
// place/same det.socketId-gated spot that file's own PvP atkCollider
// trigger is registered) - not from createAllNpcInArea.js, since that file
// only ever runs once per static AREA load, while bots spawn/despawn
// dynamically at runtime over the socket.
export function registerBotInteraction(scene, botBody, det){
    const heroBody = getPlayersOnScene().find(pl => pl.owner === getCharState()?.owner)?.body
    // defensive, not expected in practice - my own character's mesh is
    // built through an entirely different path (createMyCharacter.js) well
    // before any OTHER player/bot ever gets created via
    // reCreateMeshesInScene, so this should always resolve. If it somehow
    // doesn't on this one pass, this bot just isn't interactable until the
    // next resync recreates it - not worth crashing over.
    if(!heroBody) return

    onIntersecEnterTrig(botBody, heroBody, scene, () => {
        openCloseInteractBtn("normal", true, () => showBotChoices(det))
    })
    onIntersecExitTrig(botBody, heroBody, scene, () => {
        openCloseInteractBtn("normal", false)
    })
}

function showBotChoices(det){
    const charState = getCharState()
    if(!charState) return
    openCloseInteractBtn("normal", false)

    // det.servantOfOwnerId (worldsocket.js's own "bot-servant-updated"
    // handler keeps this current, mutated in place on this same det object)
    // read fresh here on every click, not cached - a bot already serving
    // someone ELSE offers neither choice, just the polite way out, so it
    // can't be poached out from under its actual owner by walking up to it
    const choices = []
    if(det.servantOfOwnerId === charState.owner){
        choices.push({ text: "Dismiss", cb: () => emitDismissBot(det.owner) })
    } else if(!det.servantOfOwnerId){
        choices.push({ text: "Invite to follow you", cb: () => emitRecruitBot(det.owner) })
    }
    choices.push({ text: "Never mind", cb: () => {} })

    showAnswerButtons(choices, indx => choices[indx].cb())
}
