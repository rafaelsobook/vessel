// Level-up reward wheel - triggered by characterstate.js's gainExp once a
// level-up actually happens. 8 FIXED reward slots (see WHEEL_COMPOSITION -
// 5 HP/MP/SP top-ups, 1 blessing, 2 skills), reshuffled into a random order
// every time the wheel is shown so the layout isn't predictable run to run.
// The blessing/skill icons are deliberately generic (blessingplus.webp/
// skillplus.webp, ./images/rewards/) rather than showing which specific
// blessing/skill is on offer - that's only decided (and revealed its own way)
// once the hand actually lands, same "surprise" a real prize wheel has.
// The wheel is laid on the ground round the player, face up, them standing
// in its hub like the middle of a clock (effects/fortuneWheel.js); a tap on it
// (or on SPIN over their head, or Enter) lets its hand go, and the winner
// flies into them. This file decides what's on it and what's won.
import { getCharState, updateHpMpSp_UI, updateMyDetailsOL, raiseBaseMaxHp } from "./characterstate.js"
import { giveSkill, upgradeOwnedSkill } from "../components/skillsui.js"
import { receiveAbilities } from "./abilitySystem.js"
import { skillsData } from "../staticRecources/skillsData.js"
import abilitiesData from "../staticRecources/abilities.js"
import { checkIfTokenSaved } from "../tools/tools.js"
import { APTITUDE_ELEMENT_ALIASES, LIGHTNING_UNLOCK_FIRE_LEVEL } from "./aptitudeSystem.js"
import { canOpenFortuneWheel, openFortuneWheel } from "../effects/fortuneWheel.js"
import { isRevealingBlessings } from "../effects/blessingReveal.js"

// fixed composition (5 heart / 1 blessing / 2 skill = the wheel's 8 slots) -
// shuffled into a random order each time the wheel opens, see
// shuffledComposition/showNextSpin. WHEEL_COMPOSITION itself is never
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
// the slot the hand was sent to - set the moment it's let go
let resultIndex = null
// the wheel on the ground now (effects/fortuneWheel.js), or null
let wheel = null
// spins earned but not shown yet - gainExp can cross several levels at once
// and each one earns a spin, shown one after another
let pendingSpins = 0
// from the wheel opening until its reward is granted - a spin earned meanwhile
// waits its turn instead of resetting the one on screen
let wheelBusy = false
// after a reward lands, before the next queued spin opens - its own words and
// popups get this long first
const NEXT_SPIN_DELAY_MS = 2500
// no body in the world to open it round yet (still loading), or a blessing's
// ceremony still playing: it looks again this often
const RETRY_MS = 1000
let retryTimer = null

// Fisher-Yates on a copy - WHEEL_COMPOSITION's own array/order never changes
function shuffledComposition(){
    const arr = [...WHEEL_COMPOSITION]
    for(let i = arr.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
}

export function triggerSkillWheel(){
    pendingSpins++
    showNextSpin()
}

function showNextSpin(){
    if(wheelBusy || pendingSpins <= 0) return
    // the wheel needs them standing in the world - and a blessing's ceremony
    // (a wheel's own blessing, or a quest's) gets to finish first
    if(!canOpenFortuneWheel() || isRevealingBlessings()) return retryLater()
    const rewards = shuffledComposition()
    const opened = openFortuneWheel({
        rewards: rewards.map(reward => ({ type: reward.type, icon: REWARD_ICONS[reward.type] })),
        level: getCharState()?.lvl,
        onSpinRequest: spinWheel,
        onGone: wheelGone,
    })
    if(!opened) return retryLater()
    pendingSpins--
    wheelBusy = true
    currentReward = rewards
    resultIndex = null
    wheel = opened
}
function retryLater(){
    clearTimeout(retryTimer)
    retryTimer = setTimeout(showNextSpin, RETRY_MS)
}

// they've asked to spin: the result is picked here, the hand sent to it, and
// the reward taken the moment the winner goes into them
function spinWheel(){
    if(spinning || !currentReward || !wheel) return
    const index = Math.floor(Math.random() * currentReward.length)
    const reward = currentReward[index]
    const sent = wheel.spin(index, {
        onImpact: () => grantReward(reward),
        onClosed: wheelDone,
    })
    if(!sent) return
    spinning = true
    resultIndex = index
}
function wheelDone(){
    reset()
    if(pendingSpins > 0) setTimeout(showNextSpin, NEXT_SPIN_DELAY_MS)
}
// the wheel went before it could finish (the place changed under it, or they
// died): once the hand was let go the reward's settled, so it's theirs now;
// before that, the spin waits for the next time they're standing somewhere
function wheelGone(decided){
    const reward = decided && resultIndex !== null ? currentReward?.[resultIndex] : null
    reset()
    if(reward){
        try { grantReward(reward) } catch(error){ console.error("[skillWheel] reward", error) }
    } else pendingSpins++
    if(pendingSpins > 0) retryLater()
}
function reset(){
    spinning = false
    wheelBusy = false
    wheel = null
    currentReward = null
    resultIndex = null
}

// what it was, for the wheel's words: { amount } / { ability } / { skill, upgraded }
function grantReward(reward){
    if(!reward) return null
    switch(reward.type){
        case "heart": return grantHeartReward()
        case "blessing": return grantBlessingReward()
        case "skill": return grantSkillReward()
    }
    return null
}

// a permanent stat boost, not a one-off top-up - +50 to hp/mp/sp AND their
// max counterparts together, same "current and max both move by the same
// amount" pattern statsSystem.js's own strength upgrade button already
// uses. Current isn't capped against the OLD max here since max is rising
// right alongside it.
function grantHeartReward(){
    const charState = getCharState()
    if(!charState) return null
    // max hp through the life system - the new capacity comes filled
    raiseBaseMaxHp(HEART_BONUS)
    charState.mp += HEART_BONUS
    charState.maxMp += HEART_BONUS
    charState.sp += HEART_BONUS
    charState.maxSp += HEART_BONUS
    updateHpMpSp_UI()
    updateMyDetailsOL(charState, checkIfTokenSaved())
    // (the wheel says "+50 HP +50 MP +50 SP" over their head)
    return { amount: HEART_BONUS }
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
    if(!randomAbility) return null
    receiveAbilities(false, false, randomAbility)
    return { ability: randomAbility }
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
export function eligibleSkillsFor(charState){
    const aptitudes = charState.aptitude || []
    const myElements = new Set(
        aptitudes.map(apt => APTITUDE_ELEMENT_ALIASES[apt.element] ?? apt.element)
    )
    const fireApt = aptitudes.find(apt => (APTITUDE_ELEMENT_ALIASES[apt.element] ?? apt.element) === "fire")
    const lightningUnlocked = (fireApt?.level ?? 0) > LIGHTNING_UNLOCK_FIRE_LEVEL

    return skillsData.filter(sk => {
        // everyone starts with these (flexaura) - never an offer
        if(sk.starter) return false
        // taught by a book alone (a witch's tome), not handed out by a wheel
        if(sk.bookOnly) return false
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
    if(!charState) return null
    const eligible = eligibleSkillsFor(charState)

    const owned = new Set((charState.skills || []).map(sk => sk.name))
    const unowned = eligible.filter(sk => !owned.has(sk.name))

    if(unowned.length){
        const skill = unowned[Math.floor(Math.random() * unowned.length)]
        giveSkill(skill)
        return { skill, upgraded: false }
    }

    const eligibleNames = new Set(eligible.map(sk => sk.name))
    const ownedEligible = charState.skills.filter(sk => eligibleNames.has(sk.name))
    const pool = ownedEligible.length ? ownedEligible : charState.skills
    if(!pool.length) return null
    const ownedSkill = pool[Math.floor(Math.random() * pool.length)]
    upgradeOwnedSkill(ownedSkill)
    return { skill: ownedSkill, upgraded: true }
}
