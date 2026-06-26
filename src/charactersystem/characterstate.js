
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
import { getPlayersOnScene, setPlayerMode } from "../sockets/worldsocket.js";
import { closeAllPopupAndUI, disableEnableAttackButtonsContainer, openCloseLifeDisplay } from "./uimanagement.js";
import { getPlayerCoord } from "./createcharacter.js";
import { getAllSounds } from "../components/soundSystem.js";

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

let GAMEOVER = false
let characterState = null;
let canPress = false
let outsideRoomPosition = null

let hpRegenInterval
let mpRegenInterval
let spRegenInterval

let hungerInterval
let restInterval

let addStats = {
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
export function getCharState(_characterDetail){
    return characterState
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
        cloth: characterState.cloth,
        pants: characterState.pants,
        hair: characterState.hair,
        boots: characterState.boots,
        clothColor: characterState.clothColor,
        pantsColor: characterState.pantsColor,
        hairColor: characterState.hairColor,
        skinColor: characterState.skinColor,
        currentPlace: characterState.currentPlace,
        pos,
        dirTarg,

        items: characterState.items
    }
}

// grimwraith codes
export function getAdditionalsFromAbilities(){
    return addStats
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
        if(GAMEOVER) return
        const totalCLife = characterState.hp+addStats.additionalHp
        const totalMaxLife = characterState.maxHp+addStats.additionalHp
        if(totalCLife <= 0) return clearIntervals()
        if(totalCLife <= totalMaxLife) characterState.hp += getTotal().hpRegen
        if(totalCLife > totalMaxLife) characterState.hp = characterState.maxHp
        updateHP_UI()
        
    }, 700)
    // MANA
    mpRegenInterval = setInterval( () => {
        if(GAMEOVER) return
        const totalCurrMp = getTotal().mp
        const totalMaxMp = getTotal().maxMp
        if(totalCurrMp < characterState.maxMp) characterState.mp += getTotal().mpRegen
        if(characterState.mp > characterState.maxMp) characterState.mp = characterState.maxMp
        updateMP_UI()
    }, 700)
    // STAMINA
    spRegenInterval = setInterval( () => {
        if(GAMEOVER) return
        if(characterState.sp < characterState.maxSp) {
            characterState.sp += getTotal().spRegen
        }
        if(characterState.sp > characterState.maxSp) characterState.sp = characterState.maxSp
        updateSP_UI()
    }, 500)
    updateHunger()
    
    hungerInterval = setInterval(() => {
        if(GAMEOVER) return
        updateHunger()
    }, 40.5 * 1000)
    // I PUT THE STATS DEDCUTION HERE
    restInterval = setInterval(() => {
        if(GAMEOVER) return
        if(characterState.survival.sleep > 0) characterState.survival.sleep-=.2
        if(characterState.survival.sleep < 0.2) characterState.survival.sleep = 0
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
            // emitDied()
            // gameOver()
        }
        if(characterState.survival.sleep <=0)characterState.survival.sleep = 0
        if(characterState.survival.hunger <=0)characterState.survival.hunger = 0
    }, 6.2 * 1000)
}
export function summarizeStats(){
    if(GAMEOVER) return
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
 
    activateLifeSystem()
    // updateStoryQuestUI(characterState.stories[0])
    return characterState
}
export function clearIntervals(){
    clearInterval(hpRegenInterval)
    clearInterval(mpRegenInterval)
    clearInterval(spRegenInterval)
    clearInterval(hungerInterval)
    clearInterval(restInterval)
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
export async function deductHp(dmg, effects, enemyStats){
    console.warn(dmg)
    console.warn(effects)
    let totalDmg = dmg
    totalDmg -= getTotalDefense()
    if(totalDmg <= 0) totalDmg = Math.floor(Math.random()*5)
    let timeOutCount = 0
    if(effects.length){
        effects.forEach(effect=>{
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
            }, timeOutCount)
            timeOutCount+=600
        })
    }
    characterState.hp -= totalDmg
    characterState.hp = Math.floor(characterState.hp)

    if(characterState.mp <= 0) characterState.mp = 0
    if(characterState.sp+addStats.additionalSp <=0) characterState.sp = 0
    if(characterState.hp+addStats.additionalHp <= 0) {
        clearIntervals()
        await gameOver()
        return true;
    }
    updateHpMpSp_UI()
    updateSurvival_UI()
    return false
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
export async function gameOver(){
    GAMEOVER = true
    setCanPress(false)
    disableEnableAttackButtonsContainer(false)
    closeInventory()
    closeAllPopupAndUI()

    clearIntervals()
    
    characterState.hp = 0
    characterState.mp = 0
    characterState.sp = 0

    addStats = {
        additionalHp:0,
        additionalMp:0,
        additionalSp:0,
    } 

    characterState.survival.hunger = 0
    characterState.survival.sleep = 0
    updateHpMpSp_UI()
    updateSurvival_UI()
    setCanPress(false)
    updateHPMPSP_UI_ALLZERO()

    const res = await useFetch(`${APIURL}/characters/delete/${characterState._id}`, "DELETE", checkIfTokenSaved().token)
    // characterState.deadCount++
    // characterState.isDead=true;
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

export function defeatedAmonster(data){
    const {name,dn, monsSoul,skills,effects,effectsWhenHit, loots} = data

    characterState.monsSoul += monsSoul
    const defeatedMonster = characterState.defeatedMonsters.find(monsName => monsName === name)

    checkStoryQuestIfCompleted('enemy', name)

    if(loots.length){
        let obtainTimeOutCount=0
        loots.forEach(loot=>{
            setTimeout(()=>{
                obtain(loot)
            }, obtainTimeOutCount)
            obtainTimeOutCount+=500
        })
    }
    if(!defeatedMonster){
        characterState.defeatedMonsters.push(name)
        setTimeout(() => {
            openClosePopup(`slain a ${dn} `, true, 2000)
            // getAllSounds().notif1S.play()
        }, 1000)
    }
    // log("killed a monster ", data)
    
    
    
    // if(characterState.currentPlace.includes("gateplace")){
    //     const randomPlaceInfo = getRandomPlaceInfo()
    //     const placeId = randomPlaceInfo.placeId
    //     if(randomPlaceInfo.placeName === characterState.currentPlace){
            
    //         if(data.name===getRandomPlaceInfo().bossInfo.name){
    //             deleteGate(placeId)
    //             getSocket().emit('put-gate-status-completed', placeId)
    //         }else getSocket().emit('respawnEnemy', data)
    //     }
    //     return 
    // }
    // getSocket().emit('respawnEnemy', data)
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
        if(willUpdateCharState) characterState = data
        return data
    } catch (error) {
        return error.message
    }    
}


//  Mode status changes 
export function setCharStateMode(_newMode){
    characterState.mode = _newMode; // idle // structed // paralized 
    // setPlayerMode(_newMode, characterState.owner)

    switch(_newMode){
        case "idle":
            getAllSounds().runningS.setPlaybackRate(0.91)
            getAllSounds().woodrunS.setPlaybackRate(0.7)
        break
        case "fighting":
            
            getAllSounds().runningS.setPlaybackRate(1.15)
            getAllSounds().woodrunS.setPlaybackRate(1)
        break
    }

    console.log(getAllSounds().woodrunS)
    setPlayerMode(characterState.owner, _newMode)
}