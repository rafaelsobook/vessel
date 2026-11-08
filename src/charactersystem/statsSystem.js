import { getSceneDet } from "../main/main.js"
import { checkIfTokenSaved, createElement, setBtnsPointerAndVisibility, setDisplayElem } from "../tools/tools.js"
import { hideAbilityDesc, receiveAbilities, showAbilityDesc } from "./abilitySystem.js"
// import { beginOrRestartAttack } from "./attackingSystem.js"
import { getAdditionalsFromAbilities, getCharState, updateMyDetailsOL, raiseBaseMaxHp } from "./characterstate.js"
import { getPlayersOnScene } from "../sockets/worldsocket.js"
import { getSocket } from "../sockets/joinsocket.js"
import { openClosePopup } from "../tools/popupUI.js"

// STATS
const statsContainer = document.querySelector(".stats-container")
const statName = document.querySelector(".stat-name")
const heartBeatImg = document.querySelector(".heart-beat-img")
const heartStatus = document.querySelector(".heart-status")
const heartStatusDef = document.querySelector(".heart-status-def")
const heartBox = document.querySelector(".heart-bx")
const heartAfflictions = document.querySelector(".heart-afflictions")
const upgradeDivs = document.querySelectorAll(".upgrade-bx")
const upgradeBtns = document.querySelectorAll(".upgrade-btn")
const uniquesList = document.querySelector('.uniques-list')
const classesList = document.querySelector('.classes-list')
const statPointsAvailable = document.querySelector(".stat-points-available")

// characterclass keys -> their icon in public/images/stats/ (server/models/
// charDetM.js's characterclass schema), or `src` where the art lives
// elsewhere (the paladin's is the spear item's). duskrunner has no icon art,
// and nothing trains it (characterclass.js - the pickaxe is Viking's), so it's
// left out here rather than showing a broken image for a class nothing
// actually levels up.
const classIcons = [
    { key: "warbringer", label: "Warbringer", icon: "sword" },
    { key: "paladin", label: "Paladin", src: "./images/items/equipable/spear.webp" },
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

                    // max hp through the life system (characterstate.js's
                    // LIFE) - the new capacity comes filled
                    raiseBaseMaxHp(50)
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
    classIcons.forEach(({key, label, icon, src}) => {
        const classDet = state.characterclass?.[key]
        if(!classDet) return

        const div = createElement('div', 'classes-bx')
        const img = createElement('img', 'classes-img')
        const pName = createElement('p', 'classes-name', label)
        const pLvl = createElement('p', 'classes-lvl', `Lv. ${classDet.lvl}`)

        img.src = src ?? `./images/stats/${icon}.webp`
        div.append(img, pName, pLvl)
        classesList.append(div)
    })
    renderHeartStatus(state.status ?? [])
}

// HEART STATUS - what's afflicting the heart core, one card each: its own
// colour and icon, what it costs you, and what lifts it. The heart itself
// glows in the worst one's colour and its beat stumbles (style.scss's
// .heart-bx.afflicted). Colour is never the only cue - every card has its
// icon and name too.
// rank: which one's colour the heart takes when there's more than one
const AFFLICTION_LOOK = {
    cursed:   { label: "Curse",    color: "#b46cff", icon: "./images/skills/voidcurse.webp", rank: 0,
                does: "Your own blows backfire on you", cure: "Antidote, Purification or Vesper" },
    poisoned: { label: "Poison",   color: "#7ed957", icon: "./images/UI/poisoned.png", rank: 1,
                cure: "Lunaraqum, Purification or Vesper" },
    bleed:    { label: "Bleeding", color: "#ff4d4d", rank: 2,
                does: "Loses 2% of max HP every second", cure: "Duskveil or a healing circle" },
}
const OTHER_LOOK = { color: "#e2b04a", rank: 3, cure: "Purification or Vesper" }
// characterstate.js's restInterval - every permanent effect's costs land on it
const STATUS_TICK_S = 2.2
const COSTS = [["hpcost", "HP"], ["mpcost", "MP"], ["spcost", "SP"], ["hungercost", "hunger"], ["energycost", "rest"]]

function afflictionDoes(effect, look){
    if(look.does) return look.does
    const costs = COSTS.filter(([key]) => effect[key] > 0).map(([key, name]) => `-${effect[key]} ${name}`)
    return costs.length ? `${costs.join(" · ")} every ${STATUS_TICK_S}s` : "Weighs on your heart"
}

function renderHeartStatus(status){
    heartAfflictions.innerHTML = ""
    if(!status.length){
        heartBox.classList.remove("afflicted")
        heartStatus.className = "heart-status"
        heartStatus.innerHTML = "STABLE"
        heartStatusDef.innerHTML = "Heart Core is steady"
        return
    }
    const looks = status.map(effect => ({ effect, look: AFFLICTION_LOOK[effect.effectType] ?? OTHER_LOOK }))
        .sort((a, b) => a.look.rank - b.look.rank)
    // the heart: the worst one's glow, the next one's under it
    heartBox.classList.add("afflicted")
    heartBox.style.setProperty("--aff-color", looks[0].look.color)
    heartBox.style.setProperty("--aff-color2", (looks[1] ?? looks[0]).look.color)
    heartStatus.className = "heart-status unstable"
    heartStatus.innerHTML = "UNSTABLE"
    heartStatusDef.innerHTML = `${looks.length} affliction${looks.length === 1 ? "" : "s"} on your Heart Core`

    looks.forEach(({ effect, look }, i) => {
        const card = createElement("li", `affliction ${effect.effectType}`)
        card.style.setProperty("--aff-color", look.color)
        // they come in one after another, not all at once
        card.style.animationDelay = `${i * 90}ms`
        const iconRing = createElement("div", "affliction-icon")
        if(look.icon){
            const img = createElement("img", "")
            img.src = look.icon
            iconRing.append(img)
        } else iconRing.append(createElement("span", "affliction-glyph", (look.label ?? effect.effectType)[0].toUpperCase()))
        const text = createElement("div", "affliction-text")
        const head = createElement("div", "affliction-head")
        head.append(
            createElement("p", "affliction-name", effect.dn ?? look.label ?? effect.effectType),
            createElement("span", "affliction-tag", look.label ?? effect.effectType),
        )
        text.append(
            head,
            createElement("p", "affliction-does", afflictionDoes(effect, look)),
            createElement("p", "affliction-cure", `Cure: ${look.cure}`),
        )
        card.append(iconRing, text)
        heartAfflictions.append(card)
    })
}
export function updateHeartStatus(stats){

}