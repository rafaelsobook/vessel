import abilities from "../staticRecources/abilities.js";
import { setPointerClickable, checkIfTokenSaved } from "../tools/tools.js";
import { openClosePopup} from "../tools/popupUI.js";
import { getCharState, updateMyDetailsOL, activateLifeSystem, getAdditionalsFromAbilities } from "./characterstate.js";
import { createElement} from "../tools/GUITools.js"
const uniqueDescBx = document.querySelector('.uniques-desc-bx')
const abilityImg = document.querySelector('.ability-img')
const abilityName = document.querySelector('.ability-name')
const abilityDesc = document.querySelector('.ability-desc')
const descriptionLists = document.querySelector('.description-list')
// notif container
const notifCont = document.querySelector('.abilities-notif-container')
const notifLists = document.querySelector('.abilities-notif-list')
const notifAcceptBtn = document.querySelector('.ablty-notif-btn')

notifAcceptBtn.addEventListener('click', async () => {
    setPointerClickable(notifAcceptBtn, "none", 2000)
    if(!notifCont.className.includes("screenFadeOff")) notifCont.classList.add("screenFadeOff")
    setTimeout(()=>notifCont.style.display = "none",1000)
    const state = getCharState()
    // getAllSounds().notif2S.play()
    await updateMyDetailsOL(state, checkIfTokenSaved(), true)
    openClosePopup(`Abilities Obtained`, true, 2000)
    // getAllSounds().notif1S.play()
    activateLifeSystem()
    const updatedAbilites = getAdditionalsFromAbilities()
})


export function getAbilities(){
    return getCharState().blessings;
}
export async function receiveAbilities(_numberNotGreaterThanTen, limit, specificAbility = null){
    const state = getCharState()
    const abilitiesReceived = []

    // Build the list to iterate: specific ability first (if provided), then random ones
    const abilitiesToProcess = specificAbility
        ? [specificAbility, ...abilities.filter(a => a.name !== specificAbility.name)]
        : abilities

    abilitiesToProcess.forEach(ability => {
        const isSpecific = specificAbility && ability.name === specificAbility.name
        
        // Skip random check only for the specific ability
        if (!isSpecific && Math.random() * 10 > _numberNotGreaterThanTen) return

        if (limit && abilitiesReceived.length >= limit) return

        const alreadyHave = state.blessings.find(ablty => ablty.name === ability.name)

        if(alreadyHave) {
            state.blessings.forEach(ablty => {
                if(ablty.name === alreadyHave.name){
                    ablty.lvl += 1

                    ablty.percents.hp += ablty.percents.hp
                    ablty.percents.mp += ablty.percents.mp
                    ablty.percents.sp += ablty.percents.sp
                    ablty.percents.spd += ablty.percents.spd
                    ablty.percents.atkSpd += ablty.percents.atkSpd

                    ablty.percents.accuracy += ablty.percents.accuracy
                    ablty.percents.critical += ablty.percents.critical

                    ablty.percents.meeleeDmg.toAdd += ablty.percents.meeleeDmg.toAdd
                    ablty.percents.meeleeDmg.percent += ablty.percents.meeleeDmg.percent
                    ablty.percents.magicDmg.toAdd += ablty.percents.magicDmg.toAdd
                    ablty.percents.magicDmg.percent += ablty.percents.magicDmg.percent
                    ablty.percents.defense.toAdd += ablty.percents.defense.toAdd
                    ablty.percents.defense.percent += ablty.percents.defense.percent

                    ablty.regens.hp += 0.025
                    ablty.regens.mp += 0.025
                    ablty.regens.sp += 0.05
                    abilitiesReceived.push(ablty)
                }
            })
            return
        }

        state.blessings.push(ability)
        abilitiesReceived.push(ability)
    })

    if(abilitiesReceived.length){
        displayEarnedAbility(abilitiesReceived)
    } else if(limit && abilitiesReceived.length <= limit) {
        receiveAbilities(_numberNotGreaterThanTen, limit, specificAbility)
    }
}
export async function upgradeAbility(ablty){
    ablty.lvl+=1,

    ablty.percents.hp+=ablty.percents.hp,
    ablty.percents.mp+=ablty.percents.mp,
    ablty.percents.sp+=ablty.percents.sp,
    ablty.percents.spd+=ablty.percents.spd,
    ablty.percents.atkSpd+=ablty.percents.atkSpd,

    ablty.percents.accuracy+=ablty.percents.accuracy,
    ablty.percents.critical+=ablty.percents.critical,

    ablty.percents.meeleeDmg.toAdd +=ablty.percents.meeleeDmg.toAdd, 
    ablty.percents.meeleeDmg.percent+=ablty.percents.meeleeDmg.percent
    ablty.percents.magicDmg.toAdd+=ablty.percents.magicDmg.toAdd
    ablty.percents.magicDmg.percent+=ablty.percents.magicDmg.percent
    ablty.percents.defense.toAdd+=ablty.percents.defense.toAdd
    ablty.percents.defense.percent+=ablty.percents.defense.percent

    ablty.regens.hp += 0.025
    ablty.regens.mp += 0.025
    ablty.regens.sp += 0.05
}
export function getMyAbilitiesInfo(){                                         
    let totalHpPercent = 0
    let totalMpPercent = 0
    let totalSpPercent = 0
    let totalSpdPercent = 0
    let totalAtkSpdPercent = 0

    let totalMeeleeDmg = { toAdd: 0, percent: 0, }
    let totalMagicDmg = { toAdd: 0, percent: 0, }
    let totalDefense = { toAdd: 0, percent: 0, }

    let totalRegens = { hp: 0, mp: 0, sp: 0 }
    let resistance = []
    const characterState = getCharState()

  
    characterState.blessings.forEach(blessing=> {
        const {hp,mp,sp,spd,atkSpd,meeleeDmg,magicDmg,defense } = blessing.percents
        if(hp >=0) totalHpPercent+=hp
        if(mp >=0) totalMpPercent+=mp
        if(sp >=0) totalSpPercent+=sp
        if(spd >=0) totalSpdPercent+=spd
        if(atkSpd >=0) totalAtkSpdPercent+=atkSpd

        totalMeeleeDmg.toAdd+=meeleeDmg.toAdd
        totalMeeleeDmg.percent+=meeleeDmg.percent

        totalMagicDmg.toAdd+=magicDmg.toAdd
        totalMagicDmg.percent+=magicDmg.percent

        totalDefense.toAdd+=defense.toAdd
        totalDefense.percent+=defense.percent

        totalRegens.hp += blessing.regens.hp
        totalRegens.mp += blessing.regens.mp
        totalRegens.sp += blessing.regens.sp

        if(blessing.resistance.length){
            blessing.resistance.forEach(restnceName => {
                const alreadyHaveThis = resistance.find(res => res.name === restnceName)
                if(alreadyHaveThis){
                    resistance = resistance.map(res => res.name === restnceName ? {...res, lvl: res.lvl+=1 } : res)
                }else resistance.push({name: restnceName, lvl: 1})
            })                
        }

    })
    
    return { 
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
    }
}
// FOR UI
export function displayEarnedAbility(_arrayOfAbility){
    notifCont.style.display = "block"
    notifCont.classList.remove("screenFadeOff")
    // if(notifCont.className.includes("screenFadeOff")) {
    //     notifCont.classList.remove("screenFadeOff")
    //     log('has screen fade offf')
    // }
    notifLists.innerHTML = ''

    _arrayOfAbility.forEach(ablty => {
        const li = createElement('li', 'notif-bx')
        const brderImg = createElement('img', 'notif-borderimg')
        brderImg.src = './images/UI/border3.webp'
        const img = createElement('img', 'ablty-notif-img')
        const p = createElement('p', 'ablty-name', ablty.dn)
        img.src = `./images/uniques/${ablty.name}.jpeg`
        li.append(img)
        li.append(brderImg)
        li.append(p)
        notifLists.append(li)
    })

    
    // getAllSounds().notif2S.play()

}
export function showAbilityDesc(e){
    const element = e.target;
    const name = e.target.className.split(" ")[1]
    const abilityDetail = getCharState().blessings.find(ablty=> ablty.name === name)
    if(!abilityDetail) return

    const rect = element.getBoundingClientRect();
    uniqueDescBx.style.display = "block"
    uniqueDescBx.style.top = rect.top-rect.height
    uniqueDescBx.style.left = rect.left

    const bottomSize = (window.innerHeight - rect.top)
    const notifBxHeight = parseInt(uniqueDescBx.getBoundingClientRect().height)

    if(notifBxHeight > bottomSize){
        const toAdd = notifBxHeight - bottomSize
        uniqueDescBx.style.top = rect.top-uniqueDescBx.getBoundingClientRect().height
    }
    

    abilityImg.src = `./images/uniques/${abilityDetail.name}.jpeg`
    abilityName.innerHTML = abilityDetail.name
    abilityDesc.innerHTML = abilityDetail.desc

    const { hp,mp,sp,spd,atkSpd, meeleeDmg,magicDmg,defense} = abilityDetail.percents
    descriptionLists.innerHTML = ''

    function addToListOfInfo(caption){
        const li= createElement('li', 'ability-cap', caption)
        descriptionLists.append(li)
    }

    if(hp) addToListOfInfo(`additional hp ${hp*100}%`)
    if(mp) addToListOfInfo(`additional mp ${mp*100}%`)
    if(sp) addToListOfInfo(`additional stamina ${sp*100}%`)
    if(spd) addToListOfInfo(`speed +${spd*100}% `)
    if(atkSpd) addToListOfInfo(`attack speed +${atkSpd*100}%`)

    if(meeleeDmg.toAdd) addToListOfInfo(`meelee +${meeleeDmg.toAdd}`)
    if(meeleeDmg.percent) addToListOfInfo(`increased meelee: ${meeleeDmg.percent*100}%`)

    if(magicDmg.toAdd) addToListOfInfo(`magic damage +${magicDmg.toAdd}`)
    if(magicDmg.percent) addToListOfInfo(`increased magic ${magicDmg.percent*100}%`)

    if(defense.toAdd) addToListOfInfo(`defense +${defense.toAdd}`)
    if(defense.percent) addToListOfInfo(`defense increased:  ${defense.percent*100}%`)

    if(abilityDetail.resistance.length) {
 
        abilityDetail.resistance.forEach(res => {   
           if(res.name)addToListOfInfo(`${res?.name} ${res.percent*100}% ressistance`)
        })
        
    }
}
export function hideAbilityDesc(e){
    uniqueDescBx.style.display = "none"
}