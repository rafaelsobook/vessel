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
    playerAttacked.anims.forEach(anim => {
        if (anim.name === animName) {
            anim.stop()
            anim.speedRatio = .8 + atkSpd
            anim.play()
            anim.onAnimationEndObservable.addOnce((evntData, evntState) => {
                const plToanim =  getPlayersOnScene().find(pl => pl.owner === playerAttacked.owner)
                if (!plToanim) return
                if (!plToanim._attacking) return
                if (plToanim.isDead) return
                // stopAnim(plToanim.anims, "Idle", true)
                // playAnim(plToanim.anims, 'combatIdle', true, false, true)
                playerAttacked._attacking = false
            })
            const duraInFrames = anim.to / 60 // anim.to is 49 || 60 if its a second
            const wholeDura = duraInFrames / anim.speedRatio
            // setTimeout(() => {
            //     // log(data.atkSpd)
            //     if (data.isMissed) {
            //         poppingTextMesh(`missed`, "white", 40 + Math.random() * 25, Math.random() * 1, { x: -1 + Math.random() * 2, y: enemy.det.bodyHeight, z: -1 + Math.random() * 2 }, enemy.body, true)
            //     } 
            //     // else 
            //     //     enemyIsHit(data.targetId, data, soundToPlay)
            // }, wholeDura * 1000 / 3)
            // anim.onAnimationEndObservable.clear()
        }
    })
}

// tools
export function getAttackInfo(){
    const charState = getCharState()
    if(!charState) return
    const { pos, dirTarg, mode} = getPlayerCoord(charState.owner)

    let hasWeapon = false
    let isMissed = false
    let weaponType = "fist"
    let animName = 'kick1'
    charState.items.forEach(itm => {
        if (itm.itemType === "weapon" && itm.equiped) {
            hasWeapon = true
            weaponType = itm.weaponType
            animName = `${weaponType}attack1`
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