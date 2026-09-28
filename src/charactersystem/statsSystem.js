import { getSceneDet } from "../main/main.js"
import { checkIfTokenSaved, createElement, setBtnsPointerAndVisibility, setDisplayElem } from "../tools/tools.js"
import { hideAbilityDesc, receiveAbilities, showAbilityDesc } from "./abilitySystem.js"
// import { beginOrRestartAttack } from "./attackingSystem.js"
import { getAdditionalsFromAbilities, getCharState, updateMyDetailsOL } from "./characterstate.js"
import { getPlayersOnScene } from "../sockets/worldsocket.js"
import { getSocket } from "../sockets/joinsocket.js"
import { openClosePopup } from "../tools/popupUI.js"

// STATS
const statsContainer = document.querySelector(".stats-container")
const statName = document.querySelector(".stat-name")
const heartBeatImg = document.querySelector(".heart-beat-img")
const heartStatus = document.querySelector(".heart-status")
const heartStatusDef = document.querySelector(".heart-status-def")
const upgradeDivs = document.querySelectorAll(".upgrade-bx")
const upgradeBtns = document.querySelectorAll(".upgrade-btn")
const uniquesList = document.querySelector('.uniques-list')
const classesList = document.querySelector('.classes-list')
const statPointsAvailable = document.querySelector(".stat-points-available")

// characterclass keys -> their icon in public/images/stats/ (server/models/
// charDetM.js's characterclass schema). duskrunner has no icon art yet and
// no weapon case in characterclass.js's triggerClassLeveling either, so it's
// left out here rather than showing a broken image for a class nothing
// actually levels up yet.
const classIcons = [
    { key: "warbringer", label: "Warbringer", icon: "sword" },
    { key: "viking", label: "Viking", icon: "axe" },
    { key: "warhammer", label: "Warhammer", icon: "hammer" },
    { key: "berserker", label: "Berserker", icon: "fist" },
    { key: "runecaller", label: "Runecaller", icon: "staff" },
    { key: "necromancer", label: "Necromancer", icon: "necromancy" },
]

let statUpgradeBtnInitiated = false

let timeOutForsaving
export function initOnceStatsSystem(){
    if(statUpgradeBtnInitiated) return
    upgradeBtns.forEach(elem => {
        elem.addEventListener("click", async e =>{
            const statName = e.target.className.split(" ")[1]
            const state = getCharState()
            // statPoints (characterstate.js's gainExp, +1 per level) -
            // upgrading used to be unlimited/free on every click, no pool
            // to draw from at all. Gated here instead of hiding/disabling
            // the buttons outright when empty, so the existing UI stays
            // exactly as it looks today for a character with points to
            // spend - it just now actually costs one.
            if(!state.statPoints){
                return openClosePopup("No stat points available", true, 1500)
            }
            const additionalAbility = getAdditionalsFromAbilities()
            switch(statName){
                case "strength":
                    state.stats.strength++       

                    state.stats.weapon+=10

                    state.hp+=50
                    state.maxHp+=50
                    state.mp+=5
                    state.maxMp+=5
                    state.sp+=30
                    state.maxSp+=30
                break
                case "dex":
                    state.stats.dex++                    
                    state.stats.spd+=.125 // 5%
                    state.stats.atkSpd+=.1

                    state.stats.accuracy+=.25 // the higher change of effective strike
                    state.stats.critical+=.25
                break
                case "magic":
                    state.stats.magic++
                    state.mp+=90;
                    state.maxMp+=90;
                break
            }
            state.statPoints -= 1
            setBtnsPointerAndVisibility(upgradeBtns, false)

            await updateMyDetailsOL(state, checkIfTokenSaved())
            setBtnsPointerAndVisibility(upgradeBtns, true)

            updateStatUI()

            const hero = getPlayersOnScene().find(pl=>pl._id === state._id)
            if(!hero) return
            // hero.spd = state.stats.spd
            // beginOrRestartAttack(BABYLON, hero, getSceneDet().scene)
            const realSpd = {...state.stats, spd: state.stats.spd+additionalAbility.additionalSpd }
            getSocket().emit("update-stat", {_id: state._id, 
                stats: {...state.stats, spd: state.stats.spd+additionalAbility.additionalSpd }
            })
        })     
    })
    statUpgradeBtnInitiated = true
    // document.addEventListener("keyup", e => {
    //     if(e.key==='s') receiveAbilities(10)
    // })
}

export function openOrCloseStats(){
    if(!statsContainer.style.display||statsContainer.style.display==="none"){
        statsContainer.style.display = "flex"
        updateStatUI()
    }else statsContainer.style.display = "none"
    // let sickness = [
    //     {effectType:'poisoned', dmgPm: 10}, 
    //     {effectType:'cursed', dmgPm: 20 }, 
    //     {effectType:'burned', dmgPm: 30}, 
    // ]
    // let cur = 0
    // setInterval(()=> {
    //     if(cur >= sickness.length) return
    //     const state = getCharState()

    //     state.status.push(sickness[cur])
    //     cur++
    //     updateStatUI()
    // }, 5000)
}

export function updateStatUI(){
    const state = getCharState()

    statName.innerHTML = state.name
    if(statPointsAvailable){
        const points = state.statPoints || 0
        statPointsAvailable.innerHTML = `${points} point${points === 1 ? "" : "s"} available`
    }
    upgradeDivs.forEach(elem => {
        const statName = elem.className.split(" ")[1]
        elem.childNodes.forEach(chldelem=>{
            if(chldelem.className === "stat-upgrade-name"){
                let statDisplay
                switch(statName){
                    case "strength":
                        statDisplay = state.stats.strength
                    break
                    case "dex":
                        statDisplay = state.stats.dex
                    break
                    case "magic":
                        statDisplay = state.stats.magic
                    break
                }
                if(statDisplay)chldelem.innerHTML = `${statDisplay} ${statName}`
            }
        })       
    })
    // Unique Abilities display
    uniquesList.innerHTML = ''
    if(state.blessings.length){        
        state.blessings.forEach(ability => {
            const div = createElement('div', 'uniques-bx')
            const img = createElement('img', `uniques-img ${ability.name}`)
            const pName = createElement('p', 'uniques-name', ability.dn)
            const pLvl = createElement('p', 'uniques-lvl', ability.lvl)
    
            img.src = `./images/uniques/${ability.name}.jpeg`
            div.append(img)
            div.append(pName)
            div.append(pLvl)
            uniquesList.append(div)
            img.addEventListener('mouseover', showAbilityDesc);
            img.addEventListener('mouseleave', hideAbilityDesc);
        })
    }
    // COMBAT CLASSES display - read-only, no upgrade button (levels come
    // from actually swinging the matching weapon, see characterclass.js's
    // triggerClassLeveling, not a spendable point like strength/dex/magic)
    classesList.innerHTML = ''
    classIcons.forEach(({key, label, icon}) => {
        const classDet = state.characterclass?.[key]
        if(!classDet) return

        const div = createElement('div', 'classes-bx')
        const img = createElement('img', 'classes-img')
        const pName = createElement('p', 'classes-name', label)
        const pLvl = createElement('p', 'classes-lvl', `Lv. ${classDet.lvl}`)

        img.src = `./images/stats/${icon}.webp`
        div.append(img, pName, pLvl)
        classesList.append(div)
    })
    // HEART STATUS
    let statusLength = state.status.length
    heartStatus.style.color = "limegreen"
    // heartStatusDef.innerHTML only ever gets WRITTEN inside the
    // statusLength>=1 branch below, never reset back once status clears -
    // this early return used to skip right past it, leaving the stale
    // "Heart Core is cursed"/etc text on screen forever even after a real
    // cure (Purification skill/Vesper's own service both clear
    // charState.status fine - this was purely a UI-refresh gap, not a sign
    // the cure itself didn't work)
    if(!statusLength){
        heartStatusDef.innerHTML = ""
        return heartStatus.innerHTML = "STABLE"
    }
    if(statusLength >= 1){
        let statusNames = []
        state.status.forEach(effect =>{
            statusNames.push(effect.effectType)
        })
        heartStatus.innerHTML = `UNSTABLE`
        heartStatus.style.color = "crimson"
        heartStatusDef.innerHTML = `Heart Core is ${statusNames.join(", ")}`
    }
}
export function updateHeartStatus(stats){

}