import { getAllSounds } from "./soundSystem.js"

// Same pattern as titleUI.js's popupReceiveTitleUI - DOM queried once at
// module load. Own dedicated achievement-popup-hidden/-show classes (NOT
// title-acquired-popup's title-popup-hidden/-show, despite being visually
// identical rules) - same reasoning skillAcquiredUI.js's own skill-popup-
// hidden/-show already settled on: a class shared across two different
// popups ties on specificity, and the cascade then resolves purely by
// SOURCE ORDER, not which class was added last. That silently broke this
// exact popup - .achievement-acquired-popup's own base `opacity: 0` rule
// sits AFTER .title-popup-show in style.css, so it kept winning the tie and
// pinned this popup invisible even though the classList toggle (and the
// sound) both fired correctly every time.
const popupEl = document.querySelector(".achievement-acquired-popup")
const nameEl = popupEl?.querySelector(".aap-name")
let hideTimeout
const POPUP_VISIBLE_MS = 4000

export function popupReceiveAchievementUI(achievement){
    if(!popupEl || !nameEl) return console.warn("achievementAcquiredUI: .achievement-acquired-popup not found in the DOM")
    getAllSounds().achievementUnlockS?.play()
    clearTimeout(hideTimeout)
    nameEl.textContent = achievement.dn
    popupEl.classList.remove("achievement-popup-hidden")
    requestAnimationFrame(() => popupEl.classList.add("achievement-popup-show"))
    hideTimeout = setTimeout(() => {
        popupEl.classList.remove("achievement-popup-show")
        setTimeout(() => popupEl.classList.add("achievement-popup-hidden"), 600)
    }, POPUP_VISIBLE_MS)
}
