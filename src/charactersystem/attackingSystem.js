import { emitAttack } from "../sockets/emits"
import { getIsSocketOn, getPlayersOnScene } from "../sockets/worldsocket"
import { getAdditionalsFromAbilities, getCharState, getTotalAtkSpd } from "./characterstate"
import { getPlayerCoord } from "./createcharacter"

export function attack(_attackInfo){  
    const {
        owner,
        pos,
        dirTarg,
        animName,
        dmgDetails,
        hasWeapon,
        isMissed,
        weaponType,
        currentPlaceId,
        atkSpd
    } = _attackInfo
    
    const { physicalDmg, weaponDmg, magicDmg, accuracy } = dmgDetails
    const playerAttacked = getPlayersOnScene().find(pl => pl.owner === owner)
    if (!playerAttacked) return
    playerAttacked._attacking = true

    const played = playerAttacked.characterAnimations.playAction(playerAttacked.anims, animName, 0.8 + atkSpd)

    if (played) {
        const actionAnim = playerAttacked.anims.find(a => a.name.toLowerCase() === animName.toLowerCase())
        actionAnim.onAnimationEndObservable.addOnce(() => {
            const plToanim = getPlayersOnScene().find(pl => pl.owner === playerAttacked.owner)
            if (!plToanim || plToanim.isDead) return
            playerAttacked._attacking = false
        })
    } else {
        playerAttacked._attacking = false
    }
}

// tools
export function getAttackInfo(attackAnimName){
    const charState = getCharState()
    if(!charState) return
    const { pos, dirTarg, mode} = getPlayerCoord(charState.owner)
    if(!pos) return

    let hasWeapon = false
    let isMissed = false
    let weaponType = "fist"
    let animName = 'kick1'
    charState.items.forEach(itm => {
        if (itm.itemType === "weapon" && itm.equiped) {
            hasWeapon = true
            weaponType = itm.weaponType
            animName = attackAnimName ? attackAnimName : `${weaponType}attack1`
        }
    })
    const dmgDetails = calcDmg(charState)

    return {
        owner: charState.owner,
        pos,
        dirTarg,
        animName,
        dmgDetails,
        hasWeapon,
        isMissed,
        weaponType,
        currentPlaceId: charState.currentPlace.placeId,
        atkSpd: getTotalAtkSpd()/6 
    }
}
export function calcDmg(charState){
    
    const abilityAdditions = getAdditionalsFromAbilities()
    let weaponDet = undefined
    charState.items.forEach(itm => {
        if(itm.itemType === "weapon" && itm.equiped) {
            weaponDet = itm
        }
    })

    let physicalDmg = abilityAdditions.additionalMeeleeDmg.toAdd + charState.stats.strength*4
    
    // log(abilityAdditions.additionalMeeleeDmg.toAdd)
    // log(abilityAdditions.additionalMeeleeDmg.percent)
    if(abilityAdditions.additionalMeeleeDmg.percent){
        const addedDmgByPercent = physicalDmg*abilityAdditions.additionalMeeleeDmg.percent
        physicalDmg = physicalDmg+addedDmgByPercent
        // console.log(addedDmgByPercent)
    }
    
    let accuracy = abilityAdditions.additionalAccuracy + charState.stats.accuracy

    let weaponDmg = 0
    let magicDmg = abilityAdditions.additionalMagicDmg + charState.stats.magic*16
    if(weaponDet){
        weaponDmg = physicalDmg + weaponDet.equipAbilities.dmg + (charState.stats.weapon*10)
    }
    return { physicalDmg, weaponDmg, magicDmg, accuracy}
}
export function calcPercent(currentNum, totalNum){
    return currentNum/totalNum * 100
}

export function clearAttackingIntervals(){
    // clearInterval(attackingInterval)
    // clearInterval(detectingInterval)
}