// skillAcquiredUI.js
//
// "Skill Learned" celebration popup - skillsui.js's giveSkill() calls this
// instead of the old plain openClosePopup text toast, same upgrade
// titleUI.js's popupReceiveTitleUI already got over ITS old plain popup.
// Framed per skill.skillrank using the frames/*.webp border art
// (basicclass/eliteclass/highclass/godtierclass, images/UI/frames) - the
// magic circle's glow color also shifts per rank, reusing the EXACT same
// palette skillsui.js's own .skill-info[data-rank] theming already
// established (emerald/violet/gold/shimmering gold), so a skill's rank
// reads consistently everywhere it shows up, not just in the info panel.
import { getAllSounds } from "./soundSystem.js"
import { ELEMENT_CIRCLES } from "../creations/skillEffects.js"

const popupEl   = document.querySelector(".skill-acquired-popup")
const frameEl   = popupEl?.querySelector(".sap-frame")
const iconEl    = popupEl?.querySelector(".sap-skill-icon")
const nameEl    = popupEl?.querySelector(".sap-name")
const circleEl  = popupEl?.querySelector(".sap-magic-circle")
let hideTimeout

// how long the popup stays up before auto-hiding - same register
// titleUI.js's own POPUP_VISIBLE_MS uses (a bigger moment than a routine
// item pickup, shorter than a title claim)
const POPUP_VISIBLE_MS = 3500

// skill.skillrank -> frame image (skillsui.js's own SKILL_RANK_LABELS: 0
// Basic Class, 1 Elite Skill, 2 High Skill, 3 Legendary Class, 4 God Tier).
// NO dedicated "legendaryclass.webp" exists yet in images/UI/frames (only
// basic/elite/high/godtier were added) - rank 3 borrows the god-tier frame
// as the closest available "this is special" art for now. Swap this entry
// the moment a real legendaryclass.webp gets added.
const RANK_FRAMES = {
    0: "./images/UI/frames/basicclass.webp",
    1: "./images/UI/frames/eliteclass.webp",
    2: "./images/UI/frames/highclass.webp",
    3: "./images/UI/frames/godtierclass.webp", // TODO: swap for a real legendaryclass.webp once it exists
    4: "./images/UI/frames/godtierclass.webp",
}

// Applies `url` to a div as BOTH its background-image (real color content)
// AND its mask-image (alpha shape, luminance mode by default - bright
// pixels become opaque, dark/black pixels become transparent). All three
// popup layers (circle/frame/icon) share this: their source .webp files
// are all "glowing linework on a solid black square canvas" assets with no
// real alpha channel, so a plain <img src> (or even mix-blend-mode, tried
// first - see this file's own git history/prior comments) leaves that
// black canvas fully opaque. Masking sidesteps that entirely: the mask
// reads the SAME picture's own brightness as its cutout shape, so the
// black canvas just isn't part of the shape at all, while the full-color
// artwork still shows everywhere it actually IS bright - no blend-mode/
// stacking-context ambiguity, no washed-out colors.
function setMaskedImage(el, url){
    el.style.backgroundImage = `url("${url}")`
    el.style.webkitMaskImage = `url("${url}")`
    el.style.maskImage = `url("${url}")`
}

export function popupReceiveSkillUI(skillDetail){
    if(!popupEl || !nameEl) return console.warn("skillAcquiredUI: .skill-acquired-popup not found in the DOM")

    getAllSounds().notif1S?.play()
    clearTimeout(hideTimeout)

    nameEl.textContent = skillDetail.displayName
    setMaskedImage(iconEl, `./images/skills/${skillDetail.name}.webp`)
    setMaskedImage(frameEl, RANK_FRAMES[skillDetail.skillrank] ?? RANK_FRAMES[0])
    // same ELEMENT_CIRCLES table skillEffects.js's own cast-time magic
    // circles read (skill.magicCircleImg override first, then element,
    // then a plain water fallback) - so e.g. a fire skill's "Learned"
    // popup spins the exact same fire circle its actual cast uses, not a
    // generic unthemed ring. Rank still drives the GLOW color around it
    // (below) - the two layer together, not one replacing the other.
    const circleImg = skillDetail.magicCircleImg || ELEMENT_CIRCLES[skillDetail.element] || ELEMENT_CIRCLES.normal
    setMaskedImage(circleEl, `./images/circles/${circleImg}.webp`)
    // drives style.scss's .skill-acquired-popup[data-rank="N"] theming
    // (magic circle glow color + name color/shimmer)
    popupEl.dataset.rank = skillDetail.skillrank ?? 0

    // two classes, not one - same reasoning titleUI.js's popupReceiveTitleUI
    // already documents: skill-popup-hidden controls display:none (fully
    // absent between skills, not just invisible-but-still-occupying-layout),
    // skill-popup-show drives the fade/scale-in transition once it's
    // actually in the layout to animate from
    popupEl.classList.remove("skill-popup-hidden")
    // next frame - toggling both classes in the same tick would skip the
    // CSS transition entirely (the browser coalesces it into one paint)
    requestAnimationFrame(() => popupEl.classList.add("skill-popup-show"))

    hideTimeout = setTimeout(() => {
        popupEl.classList.remove("skill-popup-show")
        // matches the CSS transition duration - let the fade-out actually
        // finish playing before removing it from layout entirely
        setTimeout(() => popupEl.classList.add("skill-popup-hidden"), 600)
    }, POPUP_VISIBLE_MS)
}
