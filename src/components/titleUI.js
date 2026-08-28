// titleUI.js
//
// Exclusive npc-defeat titles (Renarden's own `titles` array, npcDetails.js) -
// only one LIVING character may hold a given titleId at once, server-enforced
// via PATCH /characters/claim-title/:id (server/routes/characterR.js). See
// that route's own header comment for the full "why no separate holder
// table" reasoning - this file is just the client half: ask the server to
// claim it, and only show the celebration popup if that actually succeeded.
import { getCharState } from "../charactersystem/characterstate.js"
import { checkIfTokenSaved, useFetch } from "../tools/tools.js"
import { APIURL } from "../constants/constants.js"
import { titlesData } from "../staticRecources/titlesData.js"
import { getAllSounds } from "./soundSystem.js"

const popupEl = document.querySelector(".title-acquired-popup")
const nameEl = popupEl?.querySelector(".tap-name")
let hideTimeout

// how long the popup stays up before auto-hiding - showItemAcquiredPopUp's
// own routine "acquired an item" popup (inventory.js) uses 5000ms; a title
// is a bigger, rarer moment, so it lingers a little longer
const POPUP_VISIBLE_MS = 4000

export function popupReceiveTitleUI(title){
    if(!popupEl || !nameEl) return console.warn("titleUI: .title-acquired-popup not found in the DOM")

    getAllSounds().titleAcquiredS?.play()
    clearTimeout(hideTimeout)
    nameEl.textContent = title.dn
    // two classes, not one - title-popup-hidden controls display:none (so
    // it's fully absent between titles, not just invisible-but-still-
    // occupying-layout), title-popup-show drives the fade/scale-in
    // transition once it's actually in the layout to animate from
    popupEl.classList.remove("title-popup-hidden")
    // next frame - toggling both classes in the same tick would skip the
    // CSS transition entirely (the browser coalesces it into one paint)
    requestAnimationFrame(() => popupEl.classList.add("title-popup-show"))

    hideTimeout = setTimeout(() => {
        popupEl.classList.remove("title-popup-show")
        // matches the CSS transition duration below - let the fade-out
        // actually finish playing before removing it from layout entirely
        setTimeout(() => popupEl.classList.add("title-popup-hidden"), 600)
    }, POPUP_VISIBLE_MS)
}

// the real entry point npc-defeat code calls (duelSystem.js's
// grantDuelWinRewards, one call per npcDet.titles entry). title:
// { titleId, dn } - same shape npcDetails.js's own titles arrays already use.
export async function receiveTitle(title){
    const charState = getCharState()
    const accountDet = checkIfTokenSaved()
    if(!charState || !accountDet) return

    const result = await useFetch(
        `${APIURL}/characters/claim-title/${charState._id}`,
        "PATCH",
        accountDet.token,
        { titleId: title.titleId, dn: title.dn }
    )

    if(!result?.claimed){
        // someone else already holds this exact title (or a transient
        // request failure) - no popup, no local state change. The
        // "already taken" case specifically isn't a bug to surface to the
        // player with its own message - they just don't get this one
        console.log(`[titleUI] did not claim "${title.titleId}":`, result?.reason ?? result)
        return
    }

    // mirrors what the server just persisted - no second save needed here,
    // the claim route already wrote it
    charState.titles = result.titles
    popupReceiveTitleUI(title)
}

// DEBUG CHEAT - bound to the "t" key in controllers/inputMovement.js, same
// spirit as skillsui.js's giveSkill/giveAllSkills cheats. Picks one at
// random from titlesData.js's own full pool and runs it through the exact
// same receiveTitle path a real npc-defeat reward uses - still a real
// server-enforced exclusivity claim, not a local-only shortcut, so this
// doubles as a way to test the "someone else already holds it" path too
// (if the roll lands on one you or someone else already has).
export function giveRandomTitle(){
    const title = titlesData[Math.floor(Math.random() * titlesData.length)]
    receiveTitle(title)
}
