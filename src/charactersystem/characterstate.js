
import { getSpawnPos } from "../tools/position.js";
import { useFetch, checkIfTokenSaved, apiOpt } from "../tools/tools.js";
import { APIURL } from "../constants/constants.js";
import { createElement, setLoadingInAList, poppingTextMesh } from "../tools/GUITools.js"
import { openClosePopup, popStatusEffect } from "../tools/popupUI.js";
import { checkStoryQuestIfCompleted, updateStoryQuestUI } from "./storyQuestSystem.js";
import { getHeroDetail } from "../serverApiFun/getHeroDetail.js";
import { updateStatUI } from "./statsSystem.js";
import { closeInventory, obtain } from "./inventory.js";
import { getMyAbilitiesInfo, receiveAbilities } from "./abilitySystem.js";
import { getPlayersOnScene, setPlayerMode, getIsSocketOn } from "../sockets/worldsocket.js";
import { emitMode, emitWeaponBlock, emitEnemyIsHit, emitTired, emitDied } from "../sockets/emits.js";
import { closeAllPopupAndUI, disableEnableAttackButtonsContainer, hideShowAllScreenUI, openCloseLifeDisplay } from "./uimanagement.js";
import { getPlayerCoord, capsuleHeight } from "./createcharacter.js";
import { getAllSounds, playSound } from "../components/soundSystem.js";
import { getGameStatus, setGameStatus, getSceneDet } from "../main/main.js";
import { createBodyFireParticles } from "../tools/particlesystem.js";
import { updateSkillListUI } from "../components/skillsui.js";
import { showLoadingScreen } from "../htmlcomp/loadingscreen.js";
import { getAmbientTemperature } from "../components/weatherSystem.js";
import {
    temperatureStrain, BODY_TEMP_NORMAL, BODY_TEMP_MIN_SAFE, BODY_TEMP_MAX_SAFE,
    BODY_TEMP_DRIFT_PER_TICK, BODY_TEMP_RECOVER_PER_TICK, TEMP_DAMAGE_FRACTION_PER_TICK,
    STRAIN_FOR_FULL_DRIFT, BODY_TEMP_FLOOR, BODY_TEMP_CEILING
} from "../constants/weather.js";
import { triggerSkillWheel } from "./skillWheel.js";
import { isSittingOnLog, isSleepingInBed } from "./seating.js";
import { popupReceiveLevelUpUI } from "../components/levelUpUI.js";
import { showWarning } from "../components/warningUI.js";

// LIFE MANA STAMINA
const lvlAndName = document.querySelector(".lvl-name")
const lifeBar = document.querySelector(".life-ui")
const manaBar = document.querySelector(".mana-ui")
const lifeCap = document.querySelector(".lifeCap")
const manaCap = document.querySelector(".manaCap")
const stamBar = document.querySelector(".stamina-bar")
const stamCap = document.querySelector(".stamCap")
const allUiContainer = document.querySelectorAll(".cont")

const hungStat = document.querySelector(".hungStat")
const restStat = document.querySelector(".restStat")
const tempStat = document.querySelector(".tempStat")
// negative stats
const negativeStatCont = document.querySelector(".negative-stats")


let characterState = null;
let canPress = false
let outsideRoomPosition = null
// soft-loss switch for non-multiplayer duels (npc/duelSystem.js) - default
// true (normal death) everywhere. areascene.js flips this false only while
// actually inside the "duel" areaType scene, and back to true at the top of
// every other scene load, so it self-corrects on any transition out rather
// than duelSystem.js needing to remember to reset it on every win/lose/exit
// path. A single flag deductHp itself checks, instead of threading an
// allowDeath param through every call site that can deal damage (this file's
// own callers, skillEffects.js's fireEnemySkillProjectile, etc.) - so skill
// damage automatically respects a duel too, with no changes needed there.
let allowDeath = true
export function setAllowDeath(value){
    allowDeath = value
}
// uimanagement.js's startResting/stopResting - see restInterval's own
// comment below for the resulting recovery time
const REST_SLEEP_REGEN_PER_TICK = 2
// seating.js's isSittingOnLog - how often (ms) the extra hp/mp/sp regen from
// sitting on a tree log is applied, on top of the normal regen intervals
const LOG_SIT_REGEN_EVERY_MS = 1000
// seating.js's isSleepingInBed (a leaf bed tent, createstructure.js) - the
// same bonus as sitting on a log, this many times over each tick
const BED_REGEN_MULTIPLIER = 3
// and the sleep meter refills this much per restInterval tick while in one -
// twice what the rest button (REST_SLEEP_REGEN_PER_TICK) gives
const BED_SLEEP_REGEN_PER_TICK = 4

let hpRegenInterval
let mpRegenInterval
let spRegenInterval
let logSitRegenInterval
let castingDrainInterval
let blockingDrainInterval

let hungerInterval
let restInterval

// shared by the initial declaration below AND gameOver()'s reset - both need
// the FULL shape (additionalMeeleeDmg/additionalMagicDmg/additionalDefense
// are objects, not numbers). gameOver() used to reset addStats to a
// hand-picked subset of fields, which left those three undefined and crashed
// summarizeStats() the next time getTotal() ran (updateMP_UI's regen tick,
// or updateHpMpSp_UI() called from within gameOver() itself) - the crash
// happening synchronously mid-gameOver() meant everything after it (server
// delete, deadCount++, the death screen, persisting the revive state) never ran.
function getDefaultAddStats(){
    return {
        totalHpRegen: 0,
        totalMpRegen: 0,
        totalSpRegen: 0,

        additionalHp:0, // worked
        additionalMp:0,
        additionalSp:0, // worked
        additionalSpd:0,
        additionalAtkSpd:0,

        additionalMeeleeDmg:{ toAdd: 0, percent: 0, },
        additionalMagicDmg:{ toAdd: 0, percent: 0, },
        additionalDefense:{ toAdd: 0, percent: 0, },

        additionalAccuracy:0,
        additionalCrit: 0,
        resistances: []
    }
}
let addStats = getDefaultAddStats()
export function getCharState(_characterDetail){
    return characterState
}
// RANK
export const rankOrder = ["f", "e", "d", "c", "b", "a", "s"]
// only these 6 can be handed out directly by story/quest NPCs, "none" is the unranked start and "s" can only be earned through points
const grantableRanks = rankOrder.slice(1, 6)

export function evaluateRank(addedPoints, assignedRank){
    // assignedRank = {rankNumber, rankLabel} eg. {rankNumber: 1, rankLabel: "f"}
    const rank = characterState.rank
    if(rank.rankNumber === undefined) rank.rankNumber = 0
    if(rank.curr === undefined) rank.curr = 0
    if(!rank.pointsToRank) rank.pointsToRank = 12
    if(!rank.rankLabel) rank.rankLabel = rankOrder[rank.rankNumber]

    const isMaxRank = () => rank.rankNumber >= rankOrder.length - 1

    if(assignedRank){

        rank.rankNumber = assignedRank.rankNumber
        rank.rankLabel = assignedRank.rankLabel
        rank.curr = 0
        rank.pointsToRank =assignedRank.rankNumber === 0 ? 12 : Math.floor(12 * Math.pow(1.5, rank.rankNumber))
        openClosePopup(`You are now Rank ${rank.rankLabel.toUpperCase()}`, true, 2000)
        
    }

    if(addedPoints){
        rank.curr += addedPoints
        while(!isMaxRank() && rank.curr >= rank.pointsToRank){
            rank.curr -= rank.pointsToRank
            rank.rankNumber += 1
            rank.rankLabel = rankOrder[rank.rankNumber]
            rank.pointsToRank = Math.floor(rank.pointsToRank * 1.5)
            openClosePopup(`Ranked Up! You are now Rank ${rank.rankLabel.toUpperCase()}`, true, 2000)
        }
    }

    if(isMaxRank()) rank.curr = 0
}

// EXP -> LEVEL - a separate track from Rank above (that system is
// untouched by any of this). Geometric growth, same curve SHAPE
// evaluateRank's own pointsToRank already uses for Rank, just its own
// independent base/growth numbers. Not stored anywhere - computed fresh
// from the current lvl every time, so it can never drift out of sync with
// whatever lvl actually is.
const LEVEL_BASE_EXP = 100
const LEVEL_EXP_GROWTH = 1.25
function expToNextLevel(lvl){
    return Math.floor(LEVEL_BASE_EXP * Math.pow(LEVEL_EXP_GROWTH, lvl - 1))
}

// grants EXP - called from createEnemy.js's defeatedAmonster, right
// alongside the existing monsSoul grant. Rolls over into as many level-ups
// as the amount earned covers in one pass (a big single kill or a future
// EXP-boosting effect shouldn't need to be re-triggered separately per
// level). Each level-up: +1 statPoints (the pool statsSystem.js's
// upgrade-btn UI now spends from), a "Level Up!" popup, then the skill
// wheel reveal (skillWheel.js - kept in its own file rather than bloating
// this one with wheel DOM/animation code).
export function gainExp(amount){
    if(!characterState || !amount) return
    characterState.exp = (characterState.exp || 0) + amount

    let leveledUp = false
    while(characterState.exp >= expToNextLevel(characterState.lvl)){
        characterState.exp -= expToNextLevel(characterState.lvl)
        characterState.lvl += 1
        characterState.statPoints = (characterState.statPoints || 0) + 1
        leveledUp = true
    }

    if(!leveledUp) return
    lvlAndName.innerHTML = `Lvl ${characterState.lvl} ${characterState.name}`
    popupReceiveLevelUpUI(characterState.lvl)
    updateStatUI()
    updateMyDetailsOL(characterState, checkIfTokenSaved())
    setTimeout(() => {
        triggerSkillWheel()
    }, 1200)
}
// DEBUG CHEAT - bound to the "t" key in controllers/inputMovement.js (was
// "x", but that key already had its own unrelated case earlier in the same
// switch - a duplicate case label, which JS resolves by always matching the
// FIRST one, so this was permanently dead/unreachable code until moved).
// Grants exactly enough EXP to cross the next threshold, reusing gainExp's
// own real level-up path (popup/sound/statPoints/skill wheel) rather than
// bumping characterState.lvl directly - so this exercises the same code a
// real level-up would, just triggered on demand instead of by a kill.
export function debugLevelUp(){
    if(!characterState) return
    gainExp(expToNextLevel(characterState.lvl))
}
export function getTotal(){
    summarizeStats()

    const hp = getHp()
    const mp = characterState.mp + addStats.additionalMp
    const sp = characterState.sp + addStats.additionalSp

    const maxHp = getMaxHp()
    const maxMp = characterState.maxMp + addStats.additionalMp
    const maxSp = characterState.maxSp + addStats.additionalSp

    const hpRegen = addStats.totalHpRegen
    const mpRegen = addStats.totalMpRegen
    const spRegen = addStats.totalSpRegen

    return { hp,maxHp, mp,maxMp, sp,maxSp, hpRegen, mpRegen, spRegen, }
}
// ── LIFE ──────────────────────────────────────────────────────────────────────
// characterState.hp is the hp the character has RIGHT NOW, everything
// included - one number, and the one that's saved. What it can have at most is
// derived, never stored: getMaxHp() = the character's own maxHp (grown by
// strength points, heart rewards, life drain - all through raiseBaseMaxHp)
// plus the bonus from abilities (addStats.additionalHp, from summarizeStats).
//
// (It used to be the other way round: hp held only the "base" part and the
// bonus was added on top wherever hp was shown, so every bit of damage came
// off the base alone, each place clamped against a different max, and the
// saved hp meant something different from the hp on screen.)
//
// Nothing outside this section writes characterState.hp - damage, healing,
// regen and max-hp grants all go through the functions below, which clamp,
// refresh the hp bar, decide death in ONE place, and mark the vitals for the
// next save (SAVING VITALS below).

// Whether running out of hp to each kind of damage kills (gameOver - which
// deletes the character) or stops at 1 hp. Only real fights kill, as before:
// nothing environmental ever called gameOver.
const LETHAL_DAMAGE = {
    combat: true,   // enemies, other players, skills, the curse backfire
    burn: true,     // fire's burn ticks (deductHp's "burn" effects)
    hunger: false,  // starving (updateHunger)
    cold: false,    // body temperature too low / too high (tickBodyTemperature)
    heat: false,
    poison: false,  // a permanent status effect's hpcost (restInterval)
    food: false,    // eating something with a negative plusHp
}
// a non-lethal source never takes hp below this
const NON_LETHAL_FLOOR = 1

// the max hp the current hp was last measured against (syncMaxHp) - null
// until a character's life system starts - and whose (character _id)
let trackedMaxHp = null
let trackedHpFor = null
// set the moment a lethal hit lands (die()) - nothing changes hp after that
let isLifeOver = false
// die()'s promise while the death sequence runs - deductHp waits on it, so
// its callers still get back "dead" only once gameOver has finished
let dying = null

export function getMaxHp(){
    if(!characterState) return 0
    return characterState.maxHp + addStats.additionalHp
}
export function getHp(){
    if(!characterState) return 0
    return characterState.hp
}
// 0..1 - how full the hp bar is
export function getHpRatio(){
    const max = getMaxHp()
    return max > 0 ? getHp() / max : 0
}
// kept for the callers written against it - the same as getHp() now that hp
// IS the total
export function getTotalHp(){
    return getHp()
}

// Takes `amount` hp. source - a LETHAL_DAMAGE key ("combat" if unknown).
// Returns true if this killed the character. A lethal source can only kill
// where death is allowed (setAllowDeath - a duel stops you at 1 hp instead).
export function damageHp(amount, source = "combat"){
    if(!characterState || isLifeOver || !(amount > 0)) return false
    const lethal = (LETHAL_DAMAGE[source] ?? true) && allowDeath
    const floor = lethal ? 0 : NON_LETHAL_FLOOR
    // already at (or under) its floor - a non-lethal source has nothing to take
    if(characterState.hp <= floor) return false
    characterState.hp = Math.max(floor, characterState.hp - amount)
    hpChanged()
    if(characterState.hp > 0) return false
    dying = die()
    return true
}
// Gives back up to `amount` hp, never past getMaxHp(). Returns how much it
// actually healed.
export function healHp(amount){
    if(!characterState || isLifeOver || !(amount > 0)) return 0
    const before = characterState.hp
    characterState.hp = Math.min(getMaxHp(), characterState.hp + amount)
    if(characterState.hp !== before) hpChanged()
    return characterState.hp - before
}
export function healToFull(){
    return healHp(getMaxHp())
}
// A permanent raise of the character's own max hp (a strength point, a heart
// reward, life drain). The new capacity comes filled - current hp rises by
// exactly as much as max hp does, ability bonus included.
export function raiseBaseMaxHp(amount){
    if(!characterState || isLifeOver || !(amount > 0)) return
    syncMaxHp()                      // settle any earlier max change first
    const maxBefore = getMaxHp()
    characterState.maxHp += amount
    recomputeAddStats()              // the ability bonus scales with maxHp
    const maxAfter = getMaxHp()
    characterState.hp = Math.min(maxAfter, characterState.hp + (maxAfter - maxBefore))
    trackedMaxHp = maxAfter
    hpChanged()
}

// Max hp moved (an ability gained or lost, gear that grants hp) - current hp
// keeps its SHARE of the bar rather than its number: half full stays half
// full. So swapping gear back and forth can neither heal nor hurt, and a
// moment where the bonus isn't known yet can't permanently cost hp - it comes
// back with the bonus. Runs from summarizeStats, so on every change.
function syncMaxHp(){
    if(!characterState) return
    const max = getMaxHp()
    if(trackedMaxHp > 0 && max > 0 && max !== trackedMaxHp && !isLifeOver){
        characterState.hp *= max / trackedMaxHp
    }
    trackedMaxHp = max
    if(characterState.hp > max) characterState.hp = max
    if(characterState.hp < 0) characterState.hp = 0
}

// hp regen - `ticks` ticks of the ability regen rate (addStats.totalHpRegen)
function regenHp(ticks = 1){
    if(!characterState || isLifeOver) return
    const perTick = getTotal().hpRegen
    if(perTick > 0) healHp(perTick * ticks)
}

// after every change to hp: the bar (which also re-checks tiredness), and the
// next vitals save picks it up
function hpChanged(){
    updateHP_UI()
}

// The one death path. Tells everyone else first (tcp's "will-die" - frees the
// enemies chasing me, shows my death), then gameOver (which deletes the
// character). Runs once.
async function die(){
    if(isLifeOver) return
    isLifeOver = true
    characterState.hp = 0
    if(getIsSocketOn()) emitDied()
    await gameOver()
}
export function isDead(){
    return isLifeOver
}
// Summed `tempResistance: { cold, heat }` across everything equipped - armors,
// pauldrons, helmets, gauntlets, boots. Same iteration shape getTotalDefense
// below already uses for equipAbilities.def, and the same tolerance for items
// that simply don't carry the field: most gear has no tempResistance at all
// and contributes 0 rather than needing the property added everywhere.
//
// Meaning of the numbers is in constants/weather.js's temperatureStrain -
// cold:40 means "safe down to -40", heat:N means "safe up to 35 + N".
export function getTotalTempResistance(){
    const total = { cold: 0, heat: 0 }
    characterState.items.forEach(itm => {
        if(itm.itemCateg !== 'equipable' || !itm.equiped) return
        const res = itm.tempResistance
        if(!res) return
        total.cold += res.cold ?? 0
        total.heat += res.heat ?? 0
    })
    return total
}

export function getTotalDefense(){
    let totalD = characterState.stats.dex*2
    // log(`normal def ${totalD}`)
    characterState.items.forEach(itm => {
        if(itm.itemCateg === 'equipable' && itm.equiped){
            if(itm.equipAbilities.def){
                totalD+=itm.equipAbilities.def
            }
        }
    })

    const abilityDef = addStats.additionalDefense

    if(abilityDef && abilityDef.toAdd){
        totalD += abilityDef.toAdd
    }
    if(abilityDef && abilityDef.percent){
        const additionalDefByPercent = totalD*abilityDef.percent
        totalD += additionalDefByPercent 
    }
    totalD+=characterState.stats.dex;
    // log(`total def ${totalD}`)
    return totalD
}

export function getTotalAtkSpd(){
    let totalAtkSpd = characterState.stats.atkSpd
    if(addStats.additionalAtkSpd) totalAtkSpd += addStats.additionalAtkSpd
    return totalAtkSpd
}
export function setCharState(_characterDetail){
    characterState = _characterDetail;
    // possibly someone else - their hp gets measured against their own max afresh
    trackedMaxHp = null
    trackedHpFor = null
}

export function getCharSocket(){
    const {pos, dirTarg} = getPlayerCoord(characterState.owner)
    return {
        owner: characterState.owner,
        name: characterState.name,
        lvl: characterState.lvl,
        // createcharacter.js's createAnimeBody branches its entire body/hair/
        // outfit mesh selection on this - without it here, every OTHER
        // client would render me on the default (male) body regardless of
        // what I actually picked, since worldsocket.js builds their view of
        // me from exactly this payload
        gender: characterState.gender,
        cloth: characterState.cloth,
        pants: characterState.pants,
        hair: characterState.hair,
        boots: characterState.boots,
        clothColor: characterState.clothColor,
        pantsColor: characterState.pantsColor,
        hairColor: characterState.hairColor,
        skinColor: characterState.skinColor,
        race: characterState.race,
        currentPlace: characterState.currentPlace,
        pos,
        dirTarg,

        items: characterState.items,
        skills: characterState.skills,
        mode: characterState.mode,
        maxMp: characterState.maxMp,
        maxHp: characterState.maxHp,
        maxSp: characterState.maxSp,
        // worn out right now (isCharacterTired) - so everyone already in the
        // place I'm joining sees me tired from the start
        isTired: isCharacterTired(),
    }
}

// grimwraith codes
export function getAdditionalsFromAbilities(){
    return addStats
}

// active timed buffs (skillEffects.js's castBuffSkill/applyWeaponBuff -
// mjolnirSkill and any future buff skill) - deliberately a SEPARATE store
// from addStats above, not just more fields folded into it. addStats is
// wholly owned/overwritten by summarizeStats() every time it runs (from
// equipment/blessing totals - see that function's own header comment on
// why even a truthy check there only ever REPLACES a field, never adds to
// it) - a temporary skill buff living in that same object would either get
// silently overwritten the next time an ability/equip change triggers
// summarizeStats(), or fight it in the other direction. Keeping buffs in
// their own list that expires on its own wall-clock timer, summed in
// separately wherever it's actually consumed (see attackingSystem.js's
// calcDmg), avoids both.
let activeBuffs = []
// buff: {id, stat, toAdd, percent, expiresAt} - id re-adds replace any
// existing buff with the same id (e.g. recasting mjolnir before the first
// one expires refreshes it instead of stacking a second one)
export function addTempBuff(buff){
    activeBuffs = activeBuffs.filter(b => b.id !== buff.id)
    activeBuffs.push(buff)
}
export function removeTempBuff(id){
    activeBuffs = activeBuffs.filter(b => b.id !== id)
}
// sums every currently-active buff (stale/expired ones swept out here too,
// not just wherever their own setTimeout fires - a stat read between the
// wall-clock expiry and that timeout callback actually running would
// otherwise still count it) into a {toAdd, percent} pair per stat, same
// shape addStats.additionalMeeleeDmg/additionalMagicDmg already use so
// callers can add the two together with identical math
export function getActiveBuffAdditions(){
    const now = Date.now()
    activeBuffs = activeBuffs.filter(b => b.expiresAt > now)
    const totals = {}
    activeBuffs.forEach(b => {
        if(!totals[b.stat]) totals[b.stat] = { toAdd: 0, percent: 0 }
        totals[b.stat].toAdd += b.toAdd || 0
        totals[b.stat].percent += b.percent || 0
    })
    return totals
}

// ACTIVATIONS
export function activateLifeSystem(){
    const {name, lvl} = characterState
    lvlAndName.innerHTML = `Lvl ${lvl} ${name}`

    clearIntervals()
    // what the server has right now (this runs on every load - each place
    // change loads the character again - and after new abilities are saved)
    const loadedVitals = JSON.stringify(vitalsOf(characterState))
    isLifeOver = false
    dying = null
    // the same character keeps its max-hp reference, so a newly accepted
    // ability that grants hp still goes through syncMaxHp's share-of-the-bar
    // rule; anyone else starts fresh
    if(trackedHpFor !== characterState._id) trackedMaxHp = null
    trackedHpFor = characterState._id
    // receiveAbilities(10)
    summarizeStats()    // the ability bonus, then hp kept in 0..max
    // a character that loads is alive - dying deletes it - so an old save left
    // at 0 hp (starving used to stop there) comes back on its feet
    if(characterState.hp < NON_LETHAL_FLOOR) characterState.hp = NON_LETHAL_FLOOR
    startVitalsAutosave(loadedVitals)
    openCloseLifeDisplay(true)
    // HP
    hpRegenInterval = setInterval( () => {
        // if(getGameStatus() === "gameover") return
        regenHp()
        updateHP_UI()
    }, 1000)
    // MANA
    mpRegenInterval = setInterval( () => {
        // if(getGameStatus() === "gameover") return
        incrementMp()
        updateMP_UI()
    }, 1000)
    // CASTING - mana drains continuously while mode is "casting" (see the
    // cast button in uimanagement.js's walkRunBtns handler). Separate
    // interval/cadence from mpRegenInterval above by design (-1 flat per
    // 500ms, not scaled by regen rate).
    castingDrainInterval = setInterval( () => {
        if(characterState.mode !== "casting") return
        characterState.mp -= 1
        if(characterState.mp <= 0){
            characterState.mp = 0
            setCharStateMode("idle")
            if(getIsSocketOn()) emitMode("idle")
            popStatusEffect("out of mana", "yellow")
        }
        updateMP_UI()
    }, 500)
    // STAMINA
    spRegenInterval = setInterval( () => {
        // if(getGameStatus() === "gameover") return
        incrementSp()
        updateSP_UI()
    }, 1000)
    // SITTING ON A TREE LOG - bonus hp/mp/sp regen while seated on one
    // (seating.js). Same incrementX helpers the normal regen intervals above
    // use, so their own casting/blocking skips and max clamps still apply.
    // SLEEPING IN A TENT (seating.js's isSleepingInBed) - the same bonus,
    // BED_REGEN_MULTIPLIER times over: the fastest recovery there is
    logSitRegenInterval = setInterval( () => {
        const ticks = isSleepingInBed() ? BED_REGEN_MULTIPLIER : isSittingOnLog() ? 1 : 0
        if(!ticks) return
        regenHp(ticks)
        for(let i = 0; i < ticks; i++){
            incrementMp()
            incrementSp()
        }
        updateHpMpSp_UI()
    }, LOG_SIT_REGEN_EVERY_MS)
    // BLOCKING - stamina drains continuously while the LOCAL player's own
    // weaponBlocking flag is true (inputMovement.js's activateMouseControls,
    // r-click hold-to-block). Same "-1 flat per 500ms, own interval separate
    // from regen" shape castingDrainInterval above already uses for mana
    // while casting - draining to 0 auto-releases the block the same way
    // running out of mana auto-exits casting mode.
    blockingDrainInterval = setInterval( () => {
        const myPlayer = getPlayersOnScene().find(pl => pl.owner === characterState.owner)
        if(!myPlayer?.weaponBlocking) return
        characterState.sp -= 1
        if(characterState.sp <= 0){
            characterState.sp = 0
            myPlayer.weaponBlocking = false
            // multiplayer sync - flipping the flag above only updates this
            // client's own local rig, same as inputMovement.js's own
            // POINTERUP handler, so everyone else watching needs the same
            // "ran out of stamina, stopped blocking" broadcast
            if(getIsSocketOn()) emitWeaponBlock(false)
            popStatusEffect("out of stamina", "yellow")
        }
        updateSP_UI()
    }, 500)
    updateHunger()
    
    hungerInterval = setInterval(() => {
        // if(getGameStatus() === "gameover") return
        updateHunger()
    }, 2500)
    // I PUT THE STATS DEDCUTION HERE
    restInterval = setInterval(() => {
        // if(getGameStatus() === "gameover") return
        // uimanagement.js's startResting/stopResting - REST_SLEEP_REGEN_PER_TICK
        // is 10x the normal depletion step, so resting from empty to full
        // takes roughly 5 minutes at this same 6.2s cadence instead of the
        // ~50 minutes a straight reversal of the depletion rate would take
        if(characterState.mode === "sleeping"){
            // in a tent's bed - the sleep meter refills faster than resting
            // does; hp/mp/sp get their own (bigger) bonus from
            // logSitRegenInterval above, not from here
            characterState.survival.sleep = Math.min(100, characterState.survival.sleep + BED_SLEEP_REGEN_PER_TICK)
        } else if(characterState.mode === "resting"){
            if(characterState.survival.sleep < 100) characterState.survival.sleep += REST_SLEEP_REGEN_PER_TICK
            if(characterState.survival.sleep > 100) characterState.survival.sleep = 100

            regenHp()
            incrementMp()
            incrementSp()
        } else {
            if(characterState.survival.sleep > 0) characterState.survival.sleep-=.2
            if(characterState.survival.sleep < 0.2) characterState.survival.sleep = 0
        }
        tickBodyTemperature()
        updateSurvival_UI();
        if(characterState.survival.sleep < 10){
            restStat.parentElement.children[0].style.animation = "blinkingRed .5s infinite"
        }else{
            restStat.parentElement.children[0].style.animation = "none"
        }

        // FOR STATUS EFFECTS
        characterState.status.forEach(effect => {
            if(!effect.permanent) return 
            switch(effect.effectType){
                case "poisoned":
                    // characterState.hp -= effect.dmgPm
                    // createBloodParticle("poisonTex",300, myChar.bx.position, "sphere", true, 1, true, undefined)
                    // createTextMesh(makeRandNum(), `poisoned ${effect.dmgPm}`, "green", myChar.bx.position, 90, _scene, true, false)
                break
            }
            damageHp(effect.hpcost, "poison")
            characterState.mp -= effect.mpcost
            characterState.sp -= effect.spcost

            characterState.survival.hunger -= effect.hungercost
            characterState.survival.sleep -= effect.energycost
        })
        // mp/sp had no floor at all in this tick, unlike every other
        // interval in this file that touches them (castingDrainInterval/
        // spRegenInterval/blockingDrainInterval above all clamp to 0
        // immediately) - a permanent status effect with a nonzero
        // mpcost/spcost (poisoned/spdrain, tcp's own enemyData.ts) just kept
        // draining past zero forever on this 6.2s cadence, exactly what let
        // sp show as a negative number in the UI. (hp's hpcost goes through
        // damageHp above - "poison" is non-lethal, so it stops at 1 hp.)
        if(characterState.mp <= 0) characterState.mp = 0
        if(characterState.sp <= 0) characterState.sp = 0
        if(characterState.survival.sleep <=0)characterState.survival.sleep = 0
        if(characterState.survival.hunger <=0)characterState.survival.hunger = 0
        // none of hp/mp/sp had their own UI refresh call in this tick
        // either - updateSurvival_UI() above only covers hunger/sleep, so a
        // status-effect drain here could change the underlying numbers
        // without the hp/mp/sp bars ever visibly updating until something
        // else incidentally refreshed them
        updateHpMpSp_UI()
    }, 6.2 * 1000)
}
// recomputes the ability bonuses (addStats), then lets current hp follow any
// change in max hp (syncMaxHp)
export function summarizeStats(){
    // if(getGameStatus() === "gameover") return
    recomputeAddStats()
    syncMaxHp()
}
function recomputeAddStats(){
    try {
        summarizeStatsUnsafe()
    } catch (err) {
        console.warn("[summarizeStats] failed to apply ability stat totals", err)
    }
}
function summarizeStatsUnsafe(){
    const {maxHp,mp, maxMp,sp,maxSp,stats} = characterState

    const {
        totalHpPercent,
        totalMpPercent,
        totalSpPercent,
        totalSpdPercent,
        totalAtkSpdPercent,
        totalMeeleeDmg,
        totalMagicDmg,
        totalDefense,
        totalRegens,
        resistance
    } = getMyAbilitiesInfo()

    // always assigned, 0 included - an `if(totalHpPercent)` here left the old
    // bonus in place forever once the ability granting it was gone
    addStats.additionalHp = maxHp * (totalHpPercent || 0)
    if(totalMpPercent){
        addStats.additionalMp = maxMp*totalMpPercent
        
    }
    if(totalSpPercent){
        addStats.additionalSp = maxSp*totalSpPercent
      
    }
    if(totalSpdPercent){
        addStats.additionalSpd = stats.spd*totalSpdPercent
    }
    if(totalAtkSpdPercent){
        addStats.additionalAtkSpd = stats.atkSpd*totalAtkSpdPercent
    }

    if(totalMeeleeDmg.toAdd){
        addStats.additionalMeeleeDmg.toAdd = totalMeeleeDmg.toAdd
    }
    if(totalMeeleeDmg.percent){
        addStats.additionalMeeleeDmg.percent = totalMeeleeDmg.percent
    }

    if(totalMagicDmg.toAdd){
        addStats.additionalMagicDmg.toAdd = totalMagicDmg.toAdd
    }
    if(totalMagicDmg.percent){
        addStats.additionalMagicDmg.percent = totalMagicDmg.percent
    }

    if(totalDefense.toAdd){
        addStats.additionalDefense.toAdd = totalDefense.toAdd
    }
    if(totalDefense.percent){
        addStats.additionalDefense.percent = totalDefense.percent
    }

    addStats.totalHpRegen = totalRegens.hp
    addStats.totalMpRegen = totalRegens.mp
    addStats.totalSpRegen = totalRegens.sp
}
export async function initiateCharacter(_accountDet){
    characterState = await getHeroDetail(_accountDet)
    if(!characterState){
        return null
    }

    activateLifeSystem()
    updateSkillListUI(characterState.skills)
    // restore the story-quest tracker (top-left) after a fresh load/reload -
    // this call used to be commented out entirely (and pointed at the wrong
    // field, characterState.stories, which nothing in this game actually
    // populates - the real data lives in characterState.quests, see
    // storyQuestSystem.js) so the tracker only ever reappeared once some
    // OTHER event happened to call updateStoryQuestUI again (accepting a
    // new quest, completing one, etc) - never just from loading the game
    // with one already active. updateStoryQuestUI now does a full rebuild
    // straight from characterState.quests itself (renderStoryQuests, see
    // its own header comment) and already filters out completed quests on
    // its own, so no argument/pre-filtering is needed here anymore - it
    // correctly shows nothing for a fresh character whose only quest is the
    // server's own pre-completed backstory placeholder.
    updateStoryQuestUI()
    return characterState
}
export function clearIntervals(){
    clearInterval(hpRegenInterval)
    clearInterval(mpRegenInterval)
    clearInterval(spRegenInterval)
    clearInterval(logSitRegenInterval)
    clearInterval(castingDrainInterval)
    clearInterval(blockingDrainInterval)
    clearInterval(hungerInterval)
    clearInterval(restInterval)
    clearInterval(vitalsSaveInterval)
}
// DEBUG CHEAT - bound to the "f" key in controllers/inputMovement.js. Tops
// off hp/mp/sp and both survival stats (hunger, sleep - the "moral"/rest
// meter shown as restStat in the UI - see updateSurvival_UI). hp fills to
// getMaxHp() (ability bonus included - hp is the whole total, see LIFE);
// mp/sp cap at characterState.max*, matching how mpRegenInterval/
// spRegenInterval above clamp them.
export function restoreAll(){
    if(!characterState) return
    healToFull()
    characterState.mp = characterState.maxMp
    characterState.sp = characterState.maxSp
    characterState.survival.hunger = 100
    characterState.survival.sleep = 100

    updateHpMpSp_UI()
    updateSurvival_UI()
    updateMyDetailsOL(characterState, checkIfTokenSaved())
}
export function updateHunger(){
    const hungerBefore = characterState.survival.hunger
    if(characterState.survival.hunger > 0) characterState.survival.hunger-=1
    updateSurvival_UI();
    // the moment it runs out, not every tick after
    
    if(characterState.survival.hunger <=0)characterState.survival.hunger = 0

    if(characterState.survival.hunger < 13){
        hungStat.parentElement.children[0].style.animation = "blinkingRed .5s infinite"
        
        showWarning("Find Food")
        let toDeduct = getMaxHp()*.10 // 10% of life
        toDeduct += 100
        // if(characterState.hp > toDeduct && characterState.survival.hunger < 5){
        //     characterState.hp -= toDeduct
        //     // _statPopUp(`- ${toDeduct}hp hunger`, 500, 'crimson');
        //     // if(characterState.hp <= 0) return playerDeath(myChar)
        //     showWarning("STARVED")
        // }

        // _statPopUp(`- ${toDeduct}hp hunger`, 500, 'crimson');
        showWarning("STARVED")
        // starving stops at 1 hp - LETHAL_DAMAGE.hunger (set it true to let
        // starvation kill; death deletes the character)
        damageHp(toDeduct, "hunger")
    }else{
        hungStat.parentElement.children[0].style.animation = "none"
    }
}
// A hit taken in a fight (enemies, other players, skills, a duel opponent,
// the curse backfire): defense comes off, then the hit's effects apply, then
// the hp loss goes through damageHp as "combat" - the one place that decides
// death (and, in a duel - allowDeath false - stops it at 1 hp instead).
// Resolves to true if this hit killed the character, once the death sequence
// (telling tcp, gameOver) has finished - callers don't report the death
// themselves anymore, damageHp's die() already did.
export async function deductHp(dmg, effects = [], enemyStats){

    let totalDmg = dmg
    totalDmg -= getTotalDefense()
    if(totalDmg <= 0) totalDmg = 1
    let timeOutCount = 0
    if(effects.length){
        effects.forEach(effect=>{
            // effect.chance (0-100, e.g. spdrain/poisoned's own 10 = 10%) was
            // defined on every effect entry but never actually rolled here -
            // this whole block ran unconditionally, so every hit carrying an
            // effect applied it 100% of the time instead of at its intended
            // chance. Rolled once per effect (not once for the whole hit),
            // matching effects being a per-effect array in the first place.
            if(Math.random() * 100 > (effect.chance ?? 100)) return

            // FIRE'S BURN - a genuine damage-OVER-TIME, unlike poisoned/
            // cursed above (both apply their cost ONCE right here in this
            // same tick, then just sit as a persistent characterState.status
            // flag until cured - see addEffectsOnStat's own comment). Burn
            // has no hpcost/mpcost/spcost/hungercost/energycost of its own
            // at all (would NaN straight into characterState.hp/mp/sp below
            // if it fell through to those lines) - it's its own dedicated
            // repeating tick instead (startBurnDamage below), self-expiring
            // after effect.duration ms with no status entry/cure needed,
            // since it clears itself.
            if(effect.effectType === "burn"){
                startBurnDamage(effect)
                return
            }

            // the effect's hp cost lands with the hit itself (below) - one
            // damageHp call, one death check
            totalDmg += effect.hpcost || 0
            characterState.mp -= effect.mpcost
            characterState.sp -= effect.spcost
        
            characterState.survival.hunger -= effect.hungercost
            characterState.survival.sleep -= effect.energycost

            if(characterState.sp+addStats.additionalSp <=0) characterState.sp = 0
            if(characterState.survival.hunger <=0)characterState.survival.hunger = 0
            if(characterState.survival.sleep <=0)characterState.survival.sleep = 0

            addEffectsOnStat(effect)
            let labelColors = [
                {name: "spdrain", color:'#bdc000'},
                {name: "poisoned", color:'green'},
            ]
            setTimeout(()=>{
                let labelToDisplay = ''
                
                switch(effect.effectType){
                    case "spdrain":
                        labelToDisplay = ` -${effect.spcost}`
                    break
                    case "poisoned":
                        labelToDisplay = ` -${effect.hpcost}`
                    break;
                }
                const labelColor = labelColors.find(clr=>clr.name===effect.effectType)
                popStatusEffect(`${effect.dn} ${labelToDisplay}`, labelColor ? labelColor:'#f5f5f5')
                // effect.soundPlayPerDmg - same property/lookup convention
                // startBurnDamage's own burn tick uses. Nothing sets this on
                // poisoned/spdrain's own data yet (tcp's enemyData.ts/
                // genenemy.ts, where those effects are actually defined) -
                // wired here so it does something the moment either one
                // gets the property added, same as burn already has
                if(effect.soundPlayPerDmg) getAllSounds()[`${effect.soundPlayPerDmg}S`]?.play()
            }, timeOutCount)
            timeOutCount+=600
        })
    }
    if(characterState.mp <= 0) characterState.mp = 0
    if(characterState.sp+addStats.additionalSp <=0) characterState.sp = 0

    const killed = damageHp(totalDmg, "combat")
    if(killed){
        await dying
        return true
    }
    updateHpMpSp_UI()
    updateSurvival_UI()
    return false
}

// deductHp's own positive mirror - a flat, undefended, one-shot hp gain
// (defense only ever reduces incoming HARM, not healing). The name the heal
// skills (skillEffects.js's castHealSkill) and Vesper's heal call - it's
// healHp (LIFE above), capped at getMaxHp(). Saved with the next vitals save.
export function healPlayer(amount){
    healHp(amount)
}

// FIRE'S BURN (skillsData.js's own "burn" effect entries, e.g.
// { effectType: "burn", dmgPm: 50, duration: 5000 }) - ticks dmgPm off hp
// every BURN_TICK_MS, for effect.duration ms total (duration/BURN_TICK_MS
// ticks, rounded), then stops on its own. Deliberately NOT routed back
// through deductHp/getTotalDefense - same flat, undefended-by-armor
// treatment poisoned/spdrain's own hpcost already gets above, just spread
// out over time instead of applied in one lump. Each tick is damageHp's
// "burn" - lethal like any fight, so the same death path (and the same duel
// soft-loss stop at 1 hp) as every other hit.
const BURN_TICK_MS = 1000
function startBurnDamage(effect){
    const totalTicks = Math.max(1, Math.round(effect.duration / BURN_TICK_MS))
    let ticksDone = 0

    // "wreathed in flame" visual, parented to my OWN body - the exact same
    // createBodyFireParticles skillEffects.js's startTargetBurn already
    // spawns for a burning enemy/duel opponent (see that function's own
    // comment), just for the local player instead. Gracefully skipped (no
    // crash, no visual) if the player's own mesh/scene aren't resolvable
    // right this instant - a burn tick landing mid scene-transition
    // shouldn't be able to break the damage half over a missing mesh.
    const myOwnPlayer = getPlayersOnScene().find(pl => pl.owner === characterState.owner)
    const sceneDet = getSceneDet()
    const burnParticles = (myOwnPlayer?.body && sceneDet?.scene)
        ? createBodyFireParticles(myOwnPlayer.body, sceneDet.scene, capsuleHeight, 0.6)
        : null

    const burnInterval = setInterval(() => {
        // the character died meanwhile (this burn or anything else) - stop
        if(isLifeOver){
            clearInterval(burnInterval)
            return
        }
        ticksDone++

        popStatusEffect(`${effect.dn ?? "Burn"} -${effect.dmgPm}`, '#ff6a00')
        // effect.soundPlayPerDmg (skillsData.js's fire family) - a plain
        // key name ("dmgpm"), not the "S"-suffixed key soundSystem.js's own
        // allSounds object actually stores it under (dmgpmS) - same
        // convention every other *S-suffixed sound already follows
        if(effect.soundPlayPerDmg) getAllSounds()[`${effect.soundPlayPerDmg}S`]?.play()

        const killed = damageHp(effect.dmgPm, "burn")
        if(killed || ticksDone >= totalTicks) clearInterval(burnInterval)
    }, BURN_TICK_MS)

    setTimeout(() => {
        if(!burnParticles) return
        burnParticles.stop()
        // (false) - particleTexture is particlesystem.js's own
        // shared/persistent texture cache, not owned by this one system
        burnParticles.dispose(false)
    }, effect.duration)
}
export function addEffectsOnStat(effect){
    if(!effect.permanent) return //log(`${effect.effectType} is not permanent will not add on my sickness status`)
    const effectAlreadyInMyStatus = characterState.status.some(status => status.effectType === effect.effectType)
    if(effectAlreadyInMyStatus) return
    
    switch(effect.effectType){
        case "poisoned":
            // getAllSounds().poisonS.play()
        break
    }
    characterState.status.push(effect)
    updateStatUI()
}

// PLAYER-SIDE CURSE - the mirror of createEnemy.js's own enemy._cursed
// (skillsData.js's header comment: "when you attack, your own damage
// backfires on you" - enemy, player, or npcFighter, whichever got cursed).
// Modeled as a plain permanent status effect (same characterState.status
// array poisoned/spdrain already live in), NOT a bespoke flag, specifically
// so it rides the EXISTING cure infrastructure for free: itemInfoSystem.js's
// consumeItemFunc already removes any status entry named in a consumable's
// own consumeAbilities.cure list - an "antidote" item with cure: ["cursed"]
// is all a new item needs to lift this, no new cure-handling code required.
// Unlike a wild enemy's curse (permanent until it dies/respawns, no un-curse
// exists), the player's own curse only ever clears by drinking that antidote.
//
// chance here is the SKILL's own 0-1 fraction (skillsData.js's effects[].chance
// convention, e.g. voidrendSkill's 0.2) - converted to deductHp's own 0-100
// percent scale, since this object is meant to be handed straight into
// deductHp's `effects` array param and let its EXISTING per-effect chance
// roll (+ addEffectsOnStat call) do the rest, rather than rolling twice.
// hpcost/mpcost/spcost/hungercost/energycost all 0 - curse is a pure status
// flag, no direct drain of its own the way poison/spdrain have.
export function curseStatusEffect(chance){
    return { effectType: "cursed", dn: "Cursed", chance: (chance ?? 1) * 100, permanent: true, hpcost: 0, mpcost: 0, spcost: 0, hungercost: 0, energycost: 0 }
}
export function isPlayerCursed(){
    return characterState.status.some(status => status.effectType === "cursed")
}

// Single choke point for "the player just landed a hit on a REAL (server-
// tracked) enemy" - every call site that used to call emitEnemyIsHit
// directly for a PLAYER-initiated hit (createEnemy.js's melee handler,
// skillEffects.js's several skill-hit handlers) goes through this instead,
// so a cursed player's damage backfires onto themselves everywhere at once
// instead of needing the same isPlayerCursed() check copy-pasted at every
// one of those sites. NOT used for worldsocket.js's own existing "redirect a
// CURSED ENEMY's own attack back onto itself" call (that's the enemy's
// damage, not the player's - stays a direct emitEnemyIsHit call there).
// isPhysical (default false) - true ONLY for a real melee weapon/fist swing
// (createEnemy.js's own atkCollider hit handler is the one caller that sets
// it). tcp/index.ts's own "enemyIsHit" handler spreads the WHOLE incoming
// data object straight into its "enemy-is-hit" broadcast
// (io.emit("enemy-is-hit", {...data, ...})), so this rides all the way back
// to createEnemy.js's own enemyIsHit() on every client for free - that's
// what it reads to decide whether to play the swordS1/punchedS "you swung a
// weapon" sound. Every OTHER caller (every skill hit in skillEffects.js,
// fire's own burn tick in startTargetBurn) never set this at all, so it
// silently defaulted to playing that same melee sound on every skill cast
// and every single burn tick too - "why do I hear my slash sound when
// they're just burning" was that exact bug.
// effectsWhenHit (optional) - the ATTACKING weapon item's own on-hit
// effects array (npcDetails.js item data, e.g. the Majestic Sword's
// `effectsWhenHit: [{effectType:"burn", ...}]`). Only the real melee
// atkCollider hit handler (createEnemy.js) ever passes this - every other
// caller (skillEffects.js's own hit handlers, that same burn's own repeat
// tick) omits it, which is deliberate: undefined here just means "nothing
// extra rides along with this hit," and specifically the burn tick's OWN
// dealDamageToEnemy call must never pass this back through (see
// enemyIsHit's own comment on why re-passing it would restart the burn
// every single tick). Just forwarded on to emitEnemyIsHit - the server's
// enemyIsHit handler (tcp/index.ts) already spreads the whole incoming
// data object into its "enemy-is-hit" broadcast, so this rides all the way
// back to every connected client for free, same free ride isPhysical
// already gets (see this function's other comments).
export async function dealDamageToEnemy({ playerId, dmgDetails, targetId, currentPlaceId, isPhysical = false, effectsWhenHit }){
    if(isPlayerCursed()){

        const selfDmg = dmgDetails.weaponDmg || dmgDetails.physicalDmg || 0
        await deductHp(selfDmg, [])

        // curse backfire feedback - a dark-purple "-dmg" number popping above
        // the player's own head, mirroring enemyIsHit's red -dmg number over a
        // hit enemy (createEnemy.js). Same poppingTextMesh call/params, just
        // parented to the local player's body and coloured for the curse.
        const me = getPlayersOnScene().find(pl => pl.owner === characterState?.owner)
        if(me && selfDmg > 0){
            playSound(getAllSounds().struckS)
            me.bloodps?.play()
            
            poppingTextMesh(`-${Math.floor(selfDmg)} cursed`, "#4B0082", 40 + Math.random() * 25, Math.random() * 1, { x: -1 + Math.random() * 2, y: capsuleHeight + 0.5, z: -1 + Math.random() * 2 }, me.body, true)
        }
        return
    }
    emitEnemyIsHit({ playerId, dmgDetails, targetId, currentPlaceId, isPhysical, effectsWhenHit })
}
export async function gameOver(){
    hideShowAllScreenUI(false)
    setCanPress(false)
    disableEnableAttackButtonsContainer(false, true)
    closeInventory()
    closeAllPopupAndUI()

    clearIntervals()

    // die() normally set this already; set here too so nothing - a burn
    // tick, a late hit, a vitals save - touches this character's hp again
    isLifeOver = true
    characterState.hp = 0
    characterState.mp = 0
    characterState.sp = 0

    addStats = getDefaultAddStats()

    characterState.survival.hunger = 0
    characterState.survival.sleep = 0

    // UI refresh is best-effort here - a failure in it must not skip the
    // server-side cleanup below (character delete, revive-state persist),
    // which is what actually matters for game state
    try {
        updateHpMpSp_UI()
        updateSurvival_UI()
        updateHPMPSP_UI_ALLZERO()
    } catch (err) {
        console.warn("[gameOver] UI update failed, continuing with cleanup", err)
    }

    const res = await useFetch(`${APIURL}/characters/delete/${characterState._id}`, "DELETE", checkIfTokenSaved().token)
    // characterState.deadCount++
    // characterState.isDead=true;
    setTimeout(() => showLoadingScreen(["I expected more from you", "You Died"]), 5000)
    // await updateMyDetailsOL({...characterState,
    //     hp: Math.floor(characterState.maxHp*.3),
    //     mp: Math.floor(characterState.maxMp*.3),
    //     sp: Math.floor(characterState.maxSp*.3),
    //     status: []
    // }, checkIfTokenSaved())
}
// Enables disables
export function setCanPress(_canPress){
    canPress = _canPress
}
export function getCanPress(){
    return canPress
}
// UPDATING UI

export function updateHP_UI(){
    lifeBar.style.width = `${getHpRatio() * 100}%`
    lifeCap.innerHTML = `${Math.floor(getHp())}/${Math.floor(getMaxHp())}`
    refreshTiredness()
}
export function updateMP_UI(){
    let manaCurrent = getTotal().mp
    const manaTotal = getTotal().maxMp
    if(manaCurrent < manaTotal) characterState.mp += getTotal().mpRegen
    if(manaCurrent <= 0) manaCurrent = 0
    manaBar.style.width = `${(manaCurrent/manaTotal) * 100}%`
    manaCap.innerHTML = `${Math.floor(manaCurrent)}/${Math.floor(manaTotal)}`
}
export function updateSP_UI(){
    const lifeCSp = characterState.sp+addStats.additionalSp
    const lifeFullSp = characterState.maxSp+addStats.additionalSp
    stamBar.style.width = `${(lifeCSp/lifeFullSp) * 100}%`
    stamCap.innerHTML = `${Math.floor(lifeCSp)}/${Math.floor(lifeFullSp)}`
    refreshTiredness()
}

// TIRED - worn out: under TIRED_HP_FRACTION of max hp, or under TIRED_SP
// stamina. A tired character can only walk, even in fighting mode
// (inputMovement.js), and moves with the "walk_tired" clip and stands in the
// "structed" one instead of walk/running/idle/combatIdle (sockets/renderer.js).
// Lives on the player object (player.isTired), not in characterState, so it's
// never saved - it's worked out fresh from hp/sp. Synced: everyone else sees
// it too (emitTired, and getCharSocket's isTired for anyone joining later).
const TIRED_HP_FRACTION = 0.18
const TIRED_SP = 50
export function isCharacterTired(){
    if(!characterState) return false
    const sp = characterState.sp + addStats.additionalSp
    return getHpRatio() < TIRED_HP_FRACTION || sp < TIRED_SP
}
// re-checked on every hp/sp display update (updateHP_UI/updateSP_UI), so it
// switches the moment either crosses the line. Compared against the player
// object itself, which is rebuilt on every place change - so arriving
// somewhere new while tired sets it again on the new scene's player.
function refreshTiredness(){
    const me = getPlayersOnScene().find(pl => pl.owner === characterState.owner)
    if(!me) return
    const tired = isCharacterTired()
    if(!!me.isTired === tired) return
    me.isTired = tired
    // worn out mid-stride - cut the run sound now; inputMovement.js won't
    // start it again until the character has recovered
    if(tired){
        const sounds = getAllSounds()
        if(sounds?.runningS?.isPlaying) sounds.runningS.stop()
        if(sounds?.woodrunS?.isPlaying) sounds.woodrunS.stop()
    }
    if(getIsSocketOn()) emitTired(tired)
}

export function updateSurvival_UI(){
    const {sleep, hunger, bodytemp} = characterState.survival
    hungStat.innerHTML = Math.floor(hunger)
    restStat.innerHTML = Math.floor(sleep)
    if(tempStat){
        const temp = bodytemp ?? BODY_TEMP_NORMAL
        tempStat.innerHTML = `${Math.round(temp)}°`
        // red when it's actually costing hp, amber while drifting but still
        // inside the band - the warning arrives before the damage does, which
        // is the whole point of showing a drifting number rather than a flag
        const unsafe = temp < BODY_TEMP_MIN_SAFE || temp > BODY_TEMP_MAX_SAFE
        const drifting = !unsafe && temp < BODY_TEMP_NORMAL - 5
        // blinks the thermometer icon, matching exactly how the sleep row
        // above signals its own low state (restStat.parentElement.children[0])
        tempStat.parentElement.children[0].style.animation = unsafe ? "blinkingRed .5s infinite" : "none"
        tempStat.style.color = unsafe ? "#e05555" : drifting ? "#e0b055" : ""
    }
}

// Third survival stat, alongside hunger (needs to eat) and sleep (needs to
// rest). Runs on the same restInterval tick those already use rather than a
// timer of its own - one survival cadence, one place to reason about it.
//
// Body temp DRIFTS toward danger rather than snapping: a player can sprint
// across a snowfield and be fine, but stopping to fight in one will kill them,
// and stepping indoors visibly recovers. That's what makes gear meaningful
// instead of binary - see constants/weather.js for the resistance rules.
function tickBodyTemperature(){
    if(!characterState?.survival) return
    if(characterState.survival.bodytemp === undefined){
        // characters created before this stat existed have no value stored -
        // start them comfortable rather than at 0, which would read as lethal
        // hypothermia the instant they log in
        characterState.survival.bodytemp = BODY_TEMP_NORMAL
    }

    const tempBefore = characterState.survival.bodytemp
    const strain = temperatureStrain(getAmbientTemperature(), getTotalTempResistance())

    if(strain !== 0){
        // scaled by how far past your limit you are, not a flat step - see
        // STRAIN_FOR_FULL_DRIFT's own comment for why (flat drift made every
        // partial resistance value worthless, and made a 5-degree sandstorm
        // overshoot hurt as fast as a 30-degree blizzard)
        const severity = Math.min(1, Math.abs(strain) / STRAIN_FOR_FULL_DRIFT)
        const step = BODY_TEMP_DRIFT_PER_TICK * severity * Math.sign(strain)
        characterState.survival.bodytemp = Math.max(
            BODY_TEMP_FLOOR,
            Math.min(BODY_TEMP_CEILING, characterState.survival.bodytemp + step)
        )
    }else if(characterState.survival.bodytemp !== BODY_TEMP_NORMAL){
        // comfortable - climb (or fall) back toward normal from either side
        const gap = BODY_TEMP_NORMAL - characterState.survival.bodytemp
        const step = Math.sign(gap) * Math.min(Math.abs(gap), BODY_TEMP_RECOVER_PER_TICK)
        characterState.survival.bodytemp += step
    }

    const temp = characterState.survival.bodytemp
    // the moment it drops into the cold that hurts, not every tick after
    if(tempBefore >= BODY_TEMP_MIN_SAFE && temp < BODY_TEMP_MIN_SAFE) showWarning("Find Warmth")
    if(temp >= BODY_TEMP_MIN_SAFE && temp <= BODY_TEMP_MAX_SAFE) return

    // outside the band (BODY_TEMP_MIN_SAFE..MAX_SAFE) costs 6% of max hp
    // every tick until it's back in - non-lethal (LETHAL_DAMAGE.cold/heat),
    // so it stops at 1 hp
    damageHp(getMaxHp() * TEMP_DAMAGE_FRACTION_PER_TICK, temp < BODY_TEMP_MIN_SAFE ? "cold" : "heat")
}
export function updateHpMpSp_UI(){
    updateHP_UI()
    updateMP_UI()
    updateSP_UI()
}export function updateHPMPSP_UI_ALLZERO(){
    lifeBar.style.width = `0%`
    lifeCap.innerHTML = `0`
    manaBar.style.width = `0%`
    manaCap.innerHTML = `0`
    stamBar.style.width = `0%`
    stamCap.innerHTML = `0`
}

// QUEST CLEARING
export function setQuestCompleted(questName){
    let isQuestExist = false
     characterState.quests.forEach(qst => {
        if(qst.qName === questName){
            isQuestExist = true
            qst.questRequirements.completed = true
        }
    })
    return isQuestExist;
}
// SAVING
export async function updateMyDetailsOL(toSave, accountDet, willUpdateCharState, doNotSavePlace){
    // some tips in using this function if you are already changing your state
    // for example you change your hp deducted or addhp, then use this function it is okay not to
    // willUpdateCharState true, because if it is save in the database if you reload it will automatically update the ui
    // this is only used if you want to save it in the database but what is happening in real time
    // some ui on the scene is updating per second so be careful in updating the state using this function
    const hasBeenHere = toSave.places.some(placeId=>placeId === toSave.currentPlace.placeId)
    if(!hasBeenHere && !doNotSavePlace) toSave.places.push(toSave.currentPlace)
    try {
        const data = await useFetch(`${APIURL}/characters/updateall/${toSave._id}`, "PATCH", accountDet.token, toSave)
        // TEMP DIAGNOSTIC - remove once the "other player gets exp too,
        // eventually" report is confirmed/resolved. This is the ONLY place
        // characterState can be wholesale REPLACED (not just mutated) -
        // with the server's own PATCH response, whatever it returns. If
        // the server ever hands back a document belonging to a DIFFERENT
        // owner than what was actually saved (a real server-side bug,
        // e.g. under concurrent load from multiple players saving around
        // the same time), this is where it would first show up - and
        // characterState would silently become someone else's data from
        // this point on for the rest of the session, explaining why it's
        // fine for the first few kills and then "eventually" breaks.
        if(willUpdateCharState && data?.owner !== toSave.owner){
            console.warn(`[charstate-swap] SAVED as owner=${toSave.owner} (_id=${toSave._id}) but server returned owner=${data?.owner} (_id=${data?._id}) - about to replace my own characterState with this`)
        }
        if(willUpdateCharState) characterState = data
        // these vitals are on the server now - the vitals autosave needn't
        // send them again
        if(characterState && toSave._id === characterState._id) lastSavedVitals = JSON.stringify(vitalsOf(toSave))
        return data
    } catch (error) {
        return error.message
    }
}

// ── SAVING VITALS ─────────────────────────────────────────────────────────────
// hp/mp/sp and the survival meters change all the time - every hit, every
// regen tick - but nothing saved the character after a fight: only some
// unrelated event (an item picked up, a door) did, so reloading brought back
// whatever hp that last save happened to hold. This saves just the vitals,
// small: every VITALS_SAVE_EVERY_MS while they've changed, and the moment the
// page is hidden or closed. The server's updateall is a partial update
// (findByIdAndUpdate sets only the fields it's sent), so the rest of the
// character is untouched.
const VITALS_SAVE_EVERY_MS = 10 * 1000
let vitalsSaveInterval = null
// JSON of the vitals the server last confirmed - nothing's sent while they match
let lastSavedVitals = null
let vitalsPageHooked = false

function vitalsOf(state){
    return {
        hp: state.hp,
        mp: state.mp,
        sp: state.sp,
        survival: state.survival,
        status: state.status,
    }
}

// keepalive - for a page that's going away: the request still completes after
// the page is gone (the body is tiny, far under keepalive's 64KB limit)
async function saveVitals(keepalive = false){
    if(!characterState?._id || isLifeOver) return
    const vitals = vitalsOf(characterState)
    const json = JSON.stringify(vitals)
    if(json === lastSavedVitals) return
    const accountDet = checkIfTokenSaved()
    if(!accountDet?.token) return
    try {
        const res = await fetch(`${APIURL}/characters/updateall/${characterState._id}`, { ...apiOpt("PATCH", vitals, accountDet.token), keepalive })
        if(res.ok) lastSavedVitals = json
    } catch (err) {
        // offline, or the server asleep - the next tick tries again
    }
}

// loadedVitals - JSON of the vitals as they came from the server
function startVitalsAutosave(loadedVitals){
    lastSavedVitals = loadedVitals
    clearInterval(vitalsSaveInterval)
    vitalsSaveInterval = setInterval(() => saveVitals(), VITALS_SAVE_EVERY_MS)

    if(vitalsPageHooked) return
    vitalsPageHooked = true
    // hidden - switched to another tab, minimised, or (browsers fire it before
    // unloading) a reload/close on its way; pagehide - the page itself going
    document.addEventListener("visibilitychange", () => {
        if(document.visibilityState === "hidden") saveVitals(true)
    })
    window.addEventListener("pagehide", () => saveVitals(true))
}


//  Mode status changes 
export function setCharStateMode(_newMode){
    const prevMode = characterState.mode
    characterState.mode = _newMode; // idle // structed // paralized 
    // setPlayerMode(_newMode, characterState.owner)

    const weapon = characterState.items.find(itm => itm.itemType === "weapon" && itm.equiped)
    switch(_newMode){
        case "idle":
            getAllSounds().runningS?.setPlaybackRate(0.91)
            getAllSounds().woodrunS?.setPlaybackRate(0.7)
        break
        case "fighting":

            getAllSounds().runningS?.setPlaybackRate(1.15)
            getAllSounds().woodrunS?.setPlaybackRate(1)
            if(weapon && prevMode !== "fighting") getAllSounds().drawSword?.play()
        break
    }

    setPlayerMode(characterState.owner, _newMode, weapon ? weapon.name : undefined)
}

function incrementMp(){
    // regen and the casting drain (castingDrainInterval) would otherwise just
    // fight each other every tick instead of actually draining anything
    if(characterState.mode === "casting") return
    const totalMpRegen = 0.5 + getTotal().mpRegen
    if(getTotal().mp < characterState.maxMp) characterState.mp += totalMpRegen
    if(characterState.mp > characterState.maxMp) characterState.mp = characterState.maxMp
}

function incrementSp(){
    // regen and the blocking drain (blockingDrainInterval) would otherwise
    // fight each other - same "skip regen entirely while the drain is active"
    // rule incrementMp applies for mana/casting. weaponBlocking lives on the
    // createCharacter() rig object (playersOnScene), not on characterState
    // itself - see createcharacter.js's own comment on why - so this has to
    // look the local player up rather than just reading a characterState field
    const myPlayer = getPlayersOnScene().find(pl => pl.owner === characterState.owner)
    if(myPlayer?.weaponBlocking) return
    characterState.sp += (1+getTotal().spRegen)
    if(characterState.sp > characterState.maxSp) characterState.sp = characterState.maxSp
}