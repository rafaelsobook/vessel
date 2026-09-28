// levelUpUI.js
//
// "Level Up" celebration banner - characterstate.js's gainExp() calls this
// instead of the old plain openClosePopup text toast, same upgrade
// titleUI.js's popupReceiveTitleUI/skillAcquiredUI.js's popupReceiveSkillUI
// already got over THEIR old plain popups. Same hidden/show two-class
// pattern, own dedicated classes (not shared with those) for the same
// "two same-specificity rules tie, source order decides" reason
// titleUI.js's own CSS comment documents.
import { getAllSounds } from "./soundSystem.js"

const popupEl = document.querySelector(".levelup-popup")
const lvlEl   = popupEl?.querySelector(".lup-lvl")
let hideTimeout

// same register titleUI.js's own POPUP_VISIBLE_MS uses - a level-up is a
// bigger moment than a routine item pickup, shorter than a title claim
const POPUP_VISIBLE_MS = 3200

export function popupReceiveLevelUpUI(lvl){
    if(!popupEl || !lvlEl) return console.warn("levelUpUI: .levelup-popup not found in the DOM")

    getAllSounds().notif2S?.play()
    clearTimeout(hideTimeout)
    lvlEl.textContent = `Lv ${lvl}`

    // two classes, not one - levelup-popup-hidden controls display:none (so
    // it's fully absent between level-ups, not just invisible-but-still-
    // occupying-layout), levelup-popup-show drives the fade/scale-in
    // transition once it's actually in the layout to animate from
    popupEl.classList.remove("levelup-popup-hidden")
    // next frame - toggling both classes in the same tick would skip the
    // CSS transition entirely (the browser coalesces it into one paint)
    requestAnimationFrame(() => popupEl.classList.add("levelup-popup-show"))

    hideTimeout = setTimeout(() => {
        popupEl.classList.remove("levelup-popup-show")
        // matches the CSS transition duration - let the fade-out actually
        // finish playing before removing it from layout entirely
        setTimeout(() => popupEl.classList.add("levelup-popup-hidden"), 600)
    }, POPUP_VISIBLE_MS)
}
