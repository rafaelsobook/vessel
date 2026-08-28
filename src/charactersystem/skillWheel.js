// Level-up reward wheel - triggered by characterstate.js's gainExp once a
// level-up actually happens. 8 FIXED reward slots (see WHEEL_COMPOSITION -
// 5 HP/MP/SP top-ups, 1 blessing, 2 skills), reshuffled into a random order
// every time the wheel is shown so the layout isn't predictable run to run.
// The blessing/skill icons are deliberately generic (blessingplus.webp/
// skillplus.webp, ./images/rewards/) rather than showing which specific
// blessing/skill is on offer - that's only decided (and revealed via its
// own popup) once the arrow actually lands, same "surprise" a real prize
// wheel has. The wheel itself never moves - GO spins a clock-hand style
// arrow from the center instead, which lands pointing at the result.
import { getCharState, updateHpMpSp_UI, updateMyDetailsOL } from "./characterstate.js"
import { giveSkill, upgradeOwnedSkill } from "../components/skillsui.js"
import { receiveAbilities } from "./abilitySystem.js"
import { skillsData } from "../staticRecources/skillsData.js"
import abilitiesData from "../staticRecources/abilities.js"
import { getAllSounds } from "../components/soundSystem.js"
import { openClosePopup } from "../tools/popupUI.js"
import { checkIfTokenSaved } from "../tools/tools.js"
import { APTITUDE_ELEMENT_ALIASES, LIGHTNING_UNLOCK_FIRE_LEVEL } from "./aptitudeSystem.js"

const wheelContainer = document.querySelector(".skill-wheel-container")
const wheelEl = document.querySelector(".skill-wheel")
const arrowEl = document.querySelector(".skill-wheel-arrow")
const goBtn = document.querySelector(".skill-wheel-go-btn")

const SLICE_COUNT = 8
const SLICE_DEGREES = 360 / SLICE_COUNT
const SPIN_ROTATIONS = 6 // full spins before landing, just for visual flourish
const SPIN_DURATION_MS = 4200

// fixed composition (5 heart / 1 blessing / 2 skill = SLICE_COUNT) -
// shuffled into a random order each time the wheel opens, see
// shuffledComposition/triggerSkillWheel. WHEEL_COMPOSITION itself is never
// mutated - each spin gets its own shuffled copy.
const WHEEL_COMPOSITION = [
    { type: "heart" }, { type: "heart" }, { type: "heart" }, { type: "heart" }, { type: "heart" },
    { type: "blessing" },
    { type: "skill" }, { type: "skill" },
]

const REWARD_ICONS = {
    heart: "./images/rewards/heartplus.webp",
    blessing: "./images/rewards/blessingplus.webp",
    skill: "./images/rewards/skillplus.webp",
}

const HEART_BONUS = 50 // flat +hp/+mp/+sp

let currentReward = null // this spin's own shuffled WHEEL_COMPOSITION, index-aligned to the fixed wheel positions
let spinning = false

// Fisher-Yates on a copy - WHEEL_COMPOSITION's own array/order never changes
function shuffledComposition(){
    const arr = [...WHEEL_COMPOSITION]
    for(let i = arr.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
}

function renderWheelIcons(rewards){
    wheelEl.innerHTML = ""
    rewards.forEach((reward, i) => {
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
        img.src = REWARD_ICONS[reward.type]
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

    currentReward = shuffledComposition()
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
    // where slot index 0 sits (renderWheelIcons places slot i at
    // i*SLICE_DEGREES) - so spinning the arrow TO that same angle points
    // it directly at the result. No inversion needed here, unlike the
    // earlier "spin the wheel under a fixed pointer" version did.
    const targetAngle = SPIN_ROTATIONS * 360 + resultIndex * SLICE_DEGREES

    arrowEl.style.transition = `transform ${SPIN_DURATION_MS / 1000}s cubic-bezier(0.12, 0.72, 0.15, 1)`
    arrowEl.style.transform = `rotate(${targetAngle}deg)`
    getAllSounds().notif1S?.play()

    setTimeout(() => {
        spinning = false
        // captured before closeWheel() runs - it nulls currentReward out
        const reward = currentReward[resultIndex]
        closeWheel()
        // wait for the wheel to actually finish closing (closeWheel's own
        // setTimeout hides it 1000ms after this) before granting/revealing
        // the reward. .skill-wheel-container sits at a HIGHER z-index
        // ($uiz+3) than every reward popup (openClosePopup's own toast is
        // $popupz+1, .abilities-notif-container is $uiz+2 - both land
        // BELOW the wheel) - granting immediately here rendered the
        // confirmation completely hidden behind the still-open wheel for
        // its whole visible lifetime.
        setTimeout(() => {
            grantReward(reward)
        }, 1100)
    }, SPIN_DURATION_MS + 100)
}

function grantReward(reward){
    if(!reward) return
    switch(reward.type){
        case "heart": return grantHeartReward()
        case "blessing": return grantBlessingReward()
        case "skill": return grantSkillReward()
    }
}

// a permanent stat boost, not a one-off top-up - +50 to hp/mp/sp AND their
// max counterparts together, same "current and max both move by the same
// amount" pattern statsSystem.js's own strength upgrade button already
// uses. Current isn't capped against the OLD max here since max is rising
// right alongside it.
function grantHeartReward(){
    const charState = getCharState()
    if(!charState) return
    charState.hp += HEART_BONUS
    charState.maxHp += HEART_BONUS
    charState.mp += HEART_BONUS
    charState.maxMp += HEART_BONUS
    charState.sp += HEART_BONUS
    charState.maxSp += HEART_BONUS
    updateHpMpSp_UI()
    updateMyDetailsOL(charState, checkIfTokenSaved())
    openClosePopup("Status Up!", true, 2000)
}

// a random blessing, guaranteed granted - receiveAbilities' own
// specificAbility argument bypasses its normal random-roll gate entirely
// (see abilitySystem.js), the same pattern questions.js's own quest-reward
// abilities already use (receiveAbilities(false, false, abilities[N])).
// Passing false/false means only THIS ability is even considered - nothing
// else in the full abilities list gets an incidental chance to roll in
// alongside it. receiveAbilities already shows its own "Abilities Obtained"
// card (displayEarnedAbility) and handles "already own it -> upgrade
// instead", so nothing else needs to happen here.
function grantBlessingReward(){
    const randomAbility = abilitiesData[Math.floor(Math.random() * abilitiesData.length)]
    if(!randomAbility) return
    receiveAbilities(false, false, randomAbility)
}

// charState.aptitude entries are { element, level } (server/routes/
// characterR.js's generateAptitudes) - "darkness" there, but "dark" in
// skillsData.js's own element field, a real pre-existing naming mismatch
// between the two data sources. Normalized here (same alias
// aptitudeSystem.js's own trackAptitudeUsage uses, imported not duplicated)
// so a dark-aptitude character isn't silently locked out of every
// dark-element skill.
//
// skillsData.js's element:"normal" skills (singlecastSkill, dashstrikeSkill,
// multicastSkill, etc) aren't tied to any one elemental aptitude at all -
// stay offerable to everyone regardless of which aptitudes were rolled,
// same as every other skill of theirs already works today.
//
// element:"lightning" skills are a special case: there's no "lightning"
// aptitude slot at all (generateAptitudes never rolls one) - by design,
// lightning is meant to read as an offshoot of a character's own FIRE
// mastery rather than its own separate roll. Only unlocked once the fire
// aptitude climbs past LIGHTNING_UNLOCK_FIRE_LEVEL - aptitudeSystem.js's
// own trackAptitudeUsage already feeds lightning-skill casts into that same
// fire usage count, so casting lightning skills (once unlocked) keeps
// pushing fire's own level further, not a separate lightning count.
function eligibleSkillsFor(charState){
    const aptitudes = charState.aptitude || []
    const myElements = new Set(
        aptitudes.map(apt => APTITUDE_ELEMENT_ALIASES[apt.element] ?? apt.element)
    )
    const fireApt = aptitudes.find(apt => (APTITUDE_ELEMENT_ALIASES[apt.element] ?? apt.element) === "fire")
    const lightningUnlocked = (fireApt?.level ?? 0) > LIGHTNING_UNLOCK_FIRE_LEVEL

    return skillsData.filter(sk => {
        if(sk.element === "normal") return true
        if(sk.element === "lightning") return lightningUnlocked
        return myElements.has(sk.element)
    })
}

// a random skill the player doesn't already know, restricted to their own
// aptitudes (eligibleSkillsFor above) - no more handing out a fire skill to
// someone with zero fire aptitude. giveSkill already shows its own "Learned
// {displayName}" popup and handles slot-assignment/saving. Same "already
// have it -> level it up instead" fallback grantBlessingReward gets for
// free from receiveAbilities, just done explicitly here since giveSkill's
// own version of that (skillsui.js) is a no-op "Already know X" message,
// not an upgrade - once every ELIGIBLE skill is already learned,
// upgradeOwnedSkill (also skillsui.js, same function the "h" debug key and
// the manual upgrade-in-info-panel button already use) picks a random
// OWNED skill within that same aptitude-matched pool to level up instead,
// so landing on "skill" always does SOMETHING once you own everything you
// can, the same way blessing/heart never dead-end either. Falls back to
// upgrading ANY owned skill only in the edge case where the player owns
// skills entirely outside their current aptitude pool (e.g. granted before
// this restriction existed, or via the "n"/"l" debug cheats) but nothing
// inside it - so a spin still never comes up completely empty-handed.
function grantSkillReward(){
    const charState = getCharState()
    if(!charState) return
    const eligible = eligibleSkillsFor(charState)

    const owned = new Set((charState.skills || []).map(sk => sk.name))
    const unowned = eligible.filter(sk => !owned.has(sk.name))

    if(unowned.length){
        const skill = unowned[Math.floor(Math.random() * unowned.length)]
        giveSkill(skill)
        return
    }

    const eligibleNames = new Set(eligible.map(sk => sk.name))
    const ownedEligible = charState.skills.filter(sk => eligibleNames.has(sk.name))
    if(ownedEligible.length){
        const ownedSkill = ownedEligible[Math.floor(Math.random() * ownedEligible.length)]
        upgradeOwnedSkill(ownedSkill)
    } else if(charState.skills.length){
        const ownedSkill = charState.skills[Math.floor(Math.random() * charState.skills.length)]
        upgradeOwnedSkill(ownedSkill)
    }
}

function closeWheel(){
    if(!wheelContainer.className.includes("screenFadeOff")) wheelContainer.classList.add("screenFadeOff")
    setTimeout(() => { wheelContainer.style.display = "none" }, 1000)
    currentReward = null
}

goBtn?.addEventListener("click", spinWheel)
