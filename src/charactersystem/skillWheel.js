// Level-up reward wheel - triggered by characterstate.js's gainExp once a
// level-up actually happens. 8 icons, each a randomly-picked skill from
// skillsData.js (preferring skills the player doesn't already know, so
// every possible outcome is a genuine reward instead of a "you already
// know this" dud), fixed in place around the wheel (icon i sits at
// i*45deg, clockwise from straight up). The wheel itself never moves -
// GO spins a clock-hand style arrow from the center instead, which lands
// pointing at the result. Reward is granted via skillsui.js's own
// giveSkill (already handles the dedup/slot-assignment/save/popup for us).
import { getCharState } from "./characterstate.js"
import { giveSkill } from "../components/skillsui.js"
import { skillsData } from "../staticRecources/skillsData.js"
import { getAllSounds } from "../components/soundSystem.js"
import { openClosePopup } from "../tools/popupUI.js"

const wheelContainer = document.querySelector(".skill-wheel-container")
const wheelEl = document.querySelector(".skill-wheel")
const arrowEl = document.querySelector(".skill-wheel-arrow")
const goBtn = document.querySelector(".skill-wheel-go-btn")

const SLICE_COUNT = 8
const SLICE_DEGREES = 360 / SLICE_COUNT
const SPIN_ROTATIONS = 6 // full spins before landing, just for visual flourish
const SPIN_DURATION_MS = 4200

let currentReward = null // the 8 skills currently shown, index-aligned to their fixed wheel positions
let spinning = false

// prefers skills the player doesn't already know - if they've somehow
// already learned everything in skillsData, falls back to the full list
// rather than showing an empty wheel (giveSkill already no-ops gracefully
// with an "Already know X" popup in that edge case)
function pickWheelSkills(){
    const charState = getCharState()
    const owned = new Set((charState?.skills || []).map(sk => sk.name))
    const unowned = skillsData.filter(sk => !owned.has(sk.name))
    const pool = unowned.length ? unowned : skillsData

    const picks = []
    for(let i = 0; i < SLICE_COUNT; i++){
        picks.push(pool[Math.floor(Math.random() * pool.length)])
    }
    return picks
}

function renderWheelIcons(skills){
    wheelEl.innerHTML = ""
    skills.forEach((skill, i) => {
        // "clock hand" placement: a zero-size anchor at the wheel's own
        // center, rotated to this icon's angle - its child (the icon,
        // offset upward from that anchor) sweeps around to the right
        // spot. Icon i sits at i*SLICE_DEGREES (0, 45, 90...), matching
        // exactly where the arrow's own resting angle points for i=0 and
        // every SLICE_DEGREES step after - see spinWheel's own comment.
        const angle = i * SLICE_DEGREES
        const slice = document.createElement("div")
        slice.className = "skill-wheel-slice"
        slice.style.transform = `rotate(${angle}deg)`

        const img = document.createElement("img")
        img.src = `./images/skills/${skill.name}.webp`
        img.className = "skill-wheel-slice-img"
        // counter-rotated so the icon itself stays upright instead of
        // tilting with its own placement angle
        img.style.transform = `rotate(${-angle}deg)`

        slice.append(img)
        wheelEl.append(slice)
    })
}

export function triggerSkillWheel(){
    if(!wheelContainer || !wheelEl || !arrowEl || !goBtn) return
    if(spinning) return

    currentReward = pickWheelSkills()
    renderWheelIcons(currentReward)

    // reset the ARROW back to its resting (straight up) position every
    // time this is shown - the wheel itself never moves, only the arrow
    // spins, so this is the only rotation state that needs resetting
    arrowEl.style.transition = "none"
    arrowEl.style.transform = "rotate(0deg)"
    void arrowEl.offsetWidth // force a reflow so transition:none actually applies before anything else touches transform

    goBtn.disabled = false
    wheelContainer.style.display = "block"
    wheelContainer.classList.remove("screenFadeOff")
}

function spinWheel(){
    if(spinning || !currentReward) return
    spinning = true
    goBtn.disabled = true

    const resultIndex = Math.floor(Math.random() * currentReward.length)
    // the arrow's own resting angle (0deg) points straight up, exactly
    // where icon index 0 sits (renderWheelIcons places icon i at
    // i*SLICE_DEGREES) - so spinning the arrow TO that same angle points
    // it directly at the result. No inversion needed here, unlike the
    // earlier "spin the wheel under a fixed pointer" version did.
    const targetAngle = SPIN_ROTATIONS * 360 + resultIndex * SLICE_DEGREES

    arrowEl.style.transition = `transform ${SPIN_DURATION_MS / 1000}s cubic-bezier(0.12, 0.72, 0.15, 1)`
    arrowEl.style.transform = `rotate(${targetAngle}deg)`
    getAllSounds().notif1S?.play()

    setTimeout(() => {
        grantReward(currentReward[resultIndex])
        spinning = false
        setTimeout(closeWheel, 1800)
    }, SPIN_DURATION_MS + 100)
}

// grants whatever landed and makes sure the player is TOLD what they got,
// no matter the reward's own shape. pickWheelSkills only ever draws from
// skillsData.js today, so only the skill branch can actually fire right
// now - the fallback exists so a future non-skill reward (a blessing, an
// item, currency...) landing in this same pool still gets a clear "you
// received X" popup instead of silently granting nothing/showing nothing.
function grantReward(reward){
    if(!reward) return
    if(isSkillReward(reward)){
        giveSkill(reward) // already shows its own "Learned {displayName}" popup - see skillsui.js
        return
    }
    openClosePopup(`You received: ${reward.dn || reward.displayName || reward.name || "a reward"}!`, true, 2000)
}

// a skill object always has BOTH a name and an effects bag (every entry in
// skillsData.js does) - good enough of a shape check to tell a real skill
// reward apart from some other reward type without needing an explicit
// "type" tag on every wheel entry
function isSkillReward(reward){
    return !!(reward && reward.name && reward.effects)
}

function closeWheel(){
    if(!wheelContainer.className.includes("screenFadeOff")) wheelContainer.classList.add("screenFadeOff")
    setTimeout(() => { wheelContainer.style.display = "none" }, 1000)
    currentReward = null
}

goBtn?.addEventListener("click", spinWheel)
