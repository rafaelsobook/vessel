
import { getSpawnPos } from "../tools/position.js";
import { useFetch, checkIfTokenSaved } from "../tools/tools.js";
import { APIURL } from "../constants/constants.js";
import { createElement, setLoadingInAList} from "../tools/GUITools.js"
import { openClosePopup, popStatusEffect } from "../tools/popupUI.js";
import { checkStoryQuestIfCompleted, updateStoryQuestUI } from "./storyQuestSystem.js";
import { getHeroDetail } from "../serverApiFun/getHeroDetail.js";
import { updateStatUI } from "./statsSystem.js";
import { closeInventory, obtain } from "./inventory.js";
import { getMyAbilitiesInfo, receiveAbilities } from "./abilitySystem.js";
import { getPlayersOnScene, setPlayerMode, getIsSocketOn } from "../sockets/worldsocket.js";
import { emitMode, emitWeaponBlock, emitEnemyIsHit } from "../sockets/emits.js";
import { closeAllPopupAndUI, disableEnableAttackButtonsContainer, hideShowAllScreenUI, openCloseLifeDisplay } from "./uimanagement.js";
import { getPlayerCoord, capsuleHeight } from "./createcharacter.js";
import { getAllSounds } from "../components/soundSystem.js";
import { getGameStatus, setGameStatus, getSceneDet } from "../main/main.js";
import { createBodyFireParticles } from "../tools/particlesystem.js";
import { updateSkillListUI } from "../components/skillsui.js";
import { showLoadingScreen } from "../htmlcomp/loadingscreen.js";
import { triggerSkillWheel } from "./skillWheel.js";

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

let hpRegenInterval
let mpRegenInterval
let spRegenInterval
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
    openClosePopup(`Level Up! You are now Lvl ${characterState.lvl}`, true, 2000)
    getAllSounds().notif2S?.play()
    updateStatUI()
    updateMyDetailsOL(characterState, checkIfTokenSaved())
    setTimeout(() => {
        triggerSkillWheel()
    }, 1200)
}
// DEBUG CHEAT - bound to the "x" key in controllers/inputMovement.js.
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

    const hp = characterState.hp + addStats.additionalHp
    const mp = characterState.mp + addStats.additionalMp
    const sp = characterState.sp + addStats.additionalSp

    const maxHp = characterState.maxHp + addStats.additionalHp
    const maxMp = characterState.maxMp + addStats.additionalMp
    const maxSp = characterState.maxSp + addStats.additionalSp

    const hpRegen = addStats.totalHpRegen
    const mpRegen = addStats.totalMpRegen
    const spRegen = addStats.totalSpRegen

    return { hp,maxHp, mp,maxMp, sp,maxSp, hpRegen, mpRegen, spRegen, }
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
    // receiveAbilities(10)
    summarizeStats()
    openCloseLifeDisplay(true)
    // HP
    hpRegenInterval = setInterval( () => {
        // if(getGameStatus() === "gameover") return
        const totalCLife = characterState.hp+addStats.additionalHp
        const totalMaxLife = characterState.maxHp+addStats.additionalHp
        if(totalCLife <= 0) return clearIntervals()
        if(totalCLife <= totalMaxLife) characterState.hp += getTotal().hpRegen
        if(totalCLife > totalMaxLife) characterState.hp = characterState.maxHp
        updateHP_UI()
        
    }, 700)
    // MANA
    mpRegenInterval = setInterval( () => {
        // if(getGameStatus() === "gameover") return
        // regen and the casting drain below would otherwise just fight each
        // other every tick instead of actually draining anything
        if(characterState.mode === "casting") return
        const totalCurrMp = getTotal().mp
        const totalMaxMp = getTotal().maxMp
        if(totalCurrMp < characterState.maxMp) characterState.mp += getTotal().mpRegen
        if(characterState.mp > characterState.maxMp) characterState.mp = characterState.maxMp
        updateMP_UI()
    }, 700)
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
        // regen and the blocking drain below would otherwise just fight
        // each other every tick instead of actually draining anything -
        // same "skip regen entirely while the drain is active" rule
        // mpRegenInterval above already applies for mana/casting.
        // weaponBlocking lives on the createCharacter() rig object
        // (playersOnScene), not on characterState itself - see
        // createcharacter.js's own comment on why - so this has to look
        // the local player up rather than just reading a characterState field
        const myPlayer = getPlayersOnScene().find(pl => pl.owner === characterState.owner)
        if(myPlayer?.weaponBlocking) return
        if(characterState.sp < characterState.maxSp) {
            characterState.sp += getTotal().spRegen
        }
        if(characterState.sp > characterState.maxSp) characterState.sp = characterState.maxSp
        updateSP_UI()
    }, 100)
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
    }, 40.5 * 1000)
    // I PUT THE STATS DEDCUTION HERE
    restInterval = setInterval(() => {
        // if(getGameStatus() === "gameover") return
        // uimanagement.js's startResting/stopResting - REST_SLEEP_REGEN_PER_TICK
        // is 10x the normal depletion step, so resting from empty to full
        // takes roughly 5 minutes at this same 6.2s cadence instead of the
        // ~50 minutes a straight reversal of the depletion rate would take
        if(characterState.mode === "resting"){
            if(characterState.survival.sleep < 100) characterState.survival.sleep += REST_SLEEP_REGEN_PER_TICK
            if(characterState.survival.sleep > 100) characterState.survival.sleep = 100
        } else {
            if(characterState.survival.sleep > 0) characterState.survival.sleep-=.2
            if(characterState.survival.sleep < 0.2) characterState.survival.sleep = 0
        }
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
            characterState.hp -= effect.hpcost
            characterState.mp -= effect.mpcost
            characterState.sp -= effect.spcost
        
            characterState.survival.hunger -= effect.hungercost
            characterState.survival.sleep -= effect.energycost
        })
        if(characterState.hp+addStats.additionalHp <= 0){
            clearIntervals()
            // emitDied() uncomment if everything is ready
            // gameOver() uncomment if everything is ready
        }
        if(characterState.survival.sleep <=0)characterState.survival.sleep = 0
        if(characterState.survival.hunger <=0)characterState.survival.hunger = 0
    }, 6.2 * 1000)
}
export function summarizeStats(){
    // if(getGameStatus() === "gameover") return
    try {
        summarizeStatsUnsafe()
    } catch (err) {
        console.warn("[summarizeStats] failed to apply ability stat totals", err)
    }
}
function summarizeStatsUnsafe(){
    const {hp,maxHp,mp, maxMp,sp,maxSp,stats} = characterState

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

    if(totalHpPercent){
        addStats.additionalHp = maxHp*totalHpPercent   
    }
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
    console.log(characterState)
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
    clearInterval(castingDrainInterval)
    clearInterval(blockingDrainInterval)
    clearInterval(hungerInterval)
    clearInterval(restInterval)
}
// DEBUG CHEAT - bound to the "f" key in controllers/inputMovement.js. Tops
// off hp/mp/sp and both survival stats (hunger, sleep - the "moral"/rest
// meter shown as restStat in the UI - see updateSurvival_UI). hp/mp/sp cap
// at characterState.max*, not getTotal()'s ability-boosted total, matching
// exactly how hpRegenInterval/mpRegenInterval/spRegenInterval above already
// clamp overflow (ability bonuses are added back in at read-time via
// getTotal(), not something that needs "filling" here).
export function restoreAll(){
    if(!characterState) return
    characterState.hp = characterState.maxHp
    characterState.mp = characterState.maxMp
    characterState.sp = characterState.maxSp
    characterState.survival.hunger = 100
    characterState.survival.sleep = 100

    updateHpMpSp_UI()
    updateSurvival_UI()
    updateMyDetailsOL(characterState, checkIfTokenSaved())
}
export function updateHunger(){
    if(characterState.survival.hunger > 0) characterState.survival.hunger-=1
    updateSurvival_UI();
    const toDeduct = characterState.maxHp*.05 // 5% of life

    if(characterState.hp > toDeduct && characterState.survival.hunger < 5){
        characterState.hp -= toDeduct
        // _statPopUp(`- ${toDeduct}hp hunger`, 500, 'crimson');
        // if(characterState.hp <= 0) return playerDeath(myChar)
    }
    if(characterState.survival.hunger <=0)characterState.survival.hunger = 0

    if(characterState.survival.hunger < 13){
        hungStat.parentElement.children[0].style.animation = "blinkingRed .5s infinite"
    }else{
        hungStat.parentElement.children[0].style.animation = "none"
    }
}
// only for checking if dmg has effect
// then will add to your sickness status
// reads the module-level allowDeath flag above (not a parameter) - see its
// own comment for why. false (duelSystem.js's soft-loss duels) clamps hp at
// 1 instead of running the normal gameOver() flow.
export async function deductHp(dmg, effects, enemyStats){

    let totalDmg = dmg
    totalDmg -= getTotalDefense()
    if(totalDmg <= 0) totalDmg = Math.floor(Math.random()*5)
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

            // characterState.hp -= // wag muna to sa dulo na to
            characterState.hp -= effect.hpcost
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
    characterState.hp -= totalDmg
    characterState.hp = Math.floor(characterState.hp)

    if(characterState.mp <= 0) characterState.mp = 0
    if(characterState.sp+addStats.additionalSp <=0) characterState.sp = 0
    if(characterState.hp+addStats.additionalHp <= 0) {
        if(!allowDeath){
            characterState.hp = Math.max(1, characterState.hp)
            updateHpMpSp_UI()
            updateSurvival_UI()
            return false
        }
        await gameOver()
        return true;
    }
    updateHpMpSp_UI()
    updateSurvival_UI()
    return false
}

// FIRE'S BURN (skillsData.js's own "burn" effect entries, e.g.
// { effectType: "burn", dmgPm: 50, duration: 5000 }) - ticks dmgPm off hp
// every BURN_TICK_MS, for effect.duration ms total (duration/BURN_TICK_MS
// ticks, rounded), then stops on its own. Deliberately NOT routed back
// through deductHp/getTotalDefense - same flat, undefended-by-armor
// treatment poisoned/spdrain's own hpcost already gets above, just spread
// out over time instead of applied in one lump. Respects the same soft-loss
// allowDeath clamp deductHp itself does (a duel/whatever else sets
// allowDeath:false shouldn't let a burn tick kill outright either) - see
// setAllowDeath's own comment for the full reasoning on that flag.
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
        ticksDone++
        characterState.hp -= effect.dmgPm
        characterState.hp = Math.floor(characterState.hp)

        popStatusEffect(`${effect.dn ?? "Burn"} -${effect.dmgPm}`, '#ff6a00')
        // effect.soundPlayPerDmg (skillsData.js's fire family) - a plain
        // key name ("dmgpm"), not the "S"-suffixed key soundSystem.js's own
        // allSounds object actually stores it under (dmgpmS) - same
        // convention every other *S-suffixed sound already follows
        if(effect.soundPlayPerDmg) getAllSounds()[`${effect.soundPlayPerDmg}S`]?.play()
        updateHpMpSp_UI()

        if(characterState.hp+addStats.additionalHp <= 0){
            clearInterval(burnInterval)
            if(!allowDeath){
                characterState.hp = Math.max(1, characterState.hp)
                updateHpMpSp_UI()
                return
            }
            gameOver()
            return
        }

        if(ticksDone >= totalTicks) clearInterval(burnInterval)
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
export async function dealDamageToEnemy({ playerId, dmgDetails, targetId, currentPlaceId, isPhysical = false }){
    if(isPlayerCursed()){
        const selfDmg = dmgDetails.weaponDmg || dmgDetails.physicalDmg || 0
        await deductHp(selfDmg, [])
        return
    }
    emitEnemyIsHit({ playerId, dmgDetails, targetId, currentPlaceId, isPhysical })
}
export async function gameOver(){
    hideShowAllScreenUI(false)
    setCanPress(false)
    disableEnableAttackButtonsContainer(false, true)
    closeInventory()
    closeAllPopupAndUI()

    clearIntervals()
    
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
    const lifeCHp = characterState.hp + addStats.additionalHp
    const lifeFullHp = characterState.maxHp + addStats.additionalHp
    lifeBar.style.width = `${(lifeCHp/lifeFullHp) * 100}%`
    lifeCap.innerHTML = `${Math.floor(lifeCHp)}/${Math.floor(lifeFullHp)}`
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
}

export function updateSurvival_UI(){
    const {sleep, hunger} = characterState.survival
    hungStat.innerHTML = Math.floor(hunger)
    restStat.innerHTML = Math.floor(sleep)
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
        return data
    } catch (error) {
        return error.message
    }
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