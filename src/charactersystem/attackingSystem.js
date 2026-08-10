import { getIsSocketOn, getPlayersOnScene } from "../sockets/worldsocket"
import { getAdditionalsFromAbilities, getCharState, getTotalAtkSpd } from "./characterstate"
import { getPlayerCoord } from "./createcharacter"
import { getSceneDet } from "../main/main"
import { castOffenseSkill, castMulticast, cancelPendingCast } from "../creations/skillEffects"
import { UPGRADE_TEMPLATES } from "../staticRecources/skillUpgrades"

export function attack(_attackInfo, attackAnimName){  
    const {
        owner,
        pos,
        dirTarg,
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
    if(hasWeapon) playerAttacked.equipSword(hasWeapon, true)
    const played = playerAttacked.characterAnimations.playAction(playerAttacked.anims, attackAnimName, 0.8 + atkSpd)

    if (played) {
        const actionAnim = playerAttacked.anims.find(a => a.name.toLowerCase() === attackAnimName.toLowerCase())
        actionAnim.onAnimationEndObservable.addOnce(() => {
            const plToanim = getPlayersOnScene().find(pl => pl.owner === playerAttacked.owner)
            if (!plToanim || plToanim.isDead) return
            playerAttacked._attacking = false
        })
    } else {
        playerAttacked._attacking = false
    }
}
export function activateSkill(ownerId, skillDetail, casterStats){
    const player = getPlayersOnScene().find(pl => pl.owner === ownerId)
    if(!player) return

    // this whole function runs identically on EVERY connected client
    // (skillsui.js relays "activate-skill" -> server -> "skillactivated" ->
    // every client, caster included, calls this) - getCharState() is always
    // MY OWN local state, which is only the actual caster's state when
    // ownerId happens to be me. For anyone just watching someone else cast,
    // substitute a lightweight caster descriptor built from what the relay
    // actually sent (ownerId + casterStats) instead - just enough for the
    // damage-calc/visual code in skillEffects.js to work off the REAL
    // caster's stats, not the local viewer's own. currentPlace is safe to
    // borrow from local charState regardless of who cast this - the
    // "skillactivated" handler above already bailed out unless we're in the
    // same place. skillEffects.js's own hit handlers gate any actual state
    // mutation (emitEnemyIsHit/bind/curse/absorb) to charState.owner ===
    // getCharState().owner, so a non-caster ever touching real state here
    // isn't a risk even though this descriptor is otherwise a stand-in, not
    // a real charState (no live hp/mp/inventory for a player who isn't me).
    const charState = getCharState()
    if(!charState) return
    const isMe = ownerId === charState.owner
    const casterState = isMe ? charState : {
        owner: ownerId,
        currentPlace: charState.currentPlace,
        stats: casterStats || {},
    }

    switch(skillDetail.name){
        case "flexaura":
            if(skillDetail.isActive){
                player.auraz.start()
            } else {
                player.auraz.stop()
            }
        break
        case "burstshots":
            // formerly named "multicast" - renamed to free that name up for
            // the new pure-trigger skill below, the actual multi-circle
            // mechanic (castMulticast) is unchanged
            if(skillDetail.isActive){
                castMulticast(getSceneDet().scene, player, skillDetail, casterState)
            } else {
                // toggled off mid-sequence - drop whichever circle/timeout
                // is still pending, don't queue up the rest
                cancelPendingCast(skillDetail.name)
            }
        break
        case "multicast":
            // a pure TRIGGER, not a caster - deals no damage and spawns no
            // projectile/circle of its own (effects.effectType is "trigger",
            // not "offense", so the default branch below wouldn't touch it
            // even without this explicit no-op case). Its entire real
            // behavior - programmatically clicking every OTHER assigned
            // skill-slot-button - lives in skillsui.js's slotbuttons click
            // handler, not here, since mana-charging for those other skills
            // only happens in that UI layer. Nothing to do on this end.
        break
        default:
            // any offense-type skill (singlecast + the 10 elemental skills,
            // see skillsData.js) rides the same generic cast engine - a new
            // skill needs a skillsData.js entry, not a new case here
            if(skillDetail.effects?.effectType === "offense"){
                if(skillDetail.isActive){
                    castOffenseSkill(getSceneDet().scene, player, skillDetail, casterState)
                } else {
                    // toggled off before the cast window elapsed - drop it,
                    // don't fire late
                    cancelPendingCast(skillDetail.name)
                }
            }
        break
    }
}
// Increases a skill's lvl and scales its power to match - same idea as
// abilitySystem.js's upgradeAbility (the equivalent for blessings), just
// for the skills array. Pure mutator - bound to the "h" key via
// skillsui.js's upgradeOwnedSkill (see that function's own comment on why
// it looks up the OWNED copy instead of calling this directly on a
// skillsData.js import). upgradePlus exists on skill data specifically for
// this (see singlecastSkill in skillsData.js), so it's the amount plusDmg/
// dmgPm bump per level. chance/bashPower are left alone - they read as
// 0-1/percent-capped values (chance:1 is already 100%), not open-ended
// magnitudes like plusDmg, so blindly adding to them risks pushing them
// past whatever their actual cap is meant to be.
//
// Three layers of "leveling up feels stronger", not just a damage number:
//   1. explosionScale - the impact burst/particle system scales up (generic,
//      every skill)
//   2. projectileScale - the flying projectile MESH itself scales up too,
//      not just its explosion (generic, every skill with a real mesh -
//      skillEffects.js's PROJECTILE_STYLES read this, "marker" ignores it
//      since it's invisible regardless)
//   3. onLevelUp - a per-skill/family "additional aura" flavor instead of
//      pure scaling (see staticRecources/skillUpgrades.js for the full set
//      of templates and which skill uses which) - optional, skills with none
//      (singlecastSkill) just get the two generic scales above
export function upgradeSkill(skillDetail){
    skillDetail.lvl += 1

    if(skillDetail.effects){
        const bump = skillDetail.upgradePlus || 0
        if(skillDetail.effects.plusDmg) skillDetail.effects.plusDmg += bump
        if(skillDetail.effects.dmgPm)   skillDetail.effects.dmgPm   += bump
    }

    // createExplosionBurst's powerScale/fireScale/smokeScale/emberEmitRate
    // (particlesystem.js) all get multiplied by this at cast time (see
    // skillEffects.js) - the whole particle system scales up 10% per level,
    // so a higher-level cast visibly looks stronger, not just hits harder
    skillDetail.explosionScale = 1 + (skillDetail.lvl - 1) * 0.1

    // the projectile mesh itself, not just what happens when it lands -
    // capped at lvl 10's worth of growth so it doesn't become a comically
    // oversized prop at very high levels
    const PROJECTILE_SCALE_STEP = 0.08
    const PROJECTILE_SCALE_CAP = 1 + PROJECTILE_SCALE_STEP * 9
    skillDetail.projectileScale = Math.min(PROJECTILE_SCALE_CAP, 1 + (skillDetail.lvl - 1) * PROJECTILE_SCALE_STEP)

    // onLevelUp is a STRING KEY (e.g. "growArcAura"), not a function
    // reference - see skillUpgrades.js's UPGRADE_TEMPLATES for why (skill
    // objects get JSON.stringify'd on save/socket relay, which would
    // silently drop an actual function property but not a string)
    if(skillDetail.onLevelUp) UPGRADE_TEMPLATES[skillDetail.onLevelUp]?.(skillDetail)

    return skillDetail
}
// tools

export function getAttackInfo(){
    const charState = getCharState()
    if(!charState) return
    const { pos, dirTarg, mode} = getPlayerCoord(charState.owner)
    if(!pos) return

    let hasWeapon = false
    let isMissed = false
    let weaponType = "fist"

    charState.items.forEach(itm => {
        if (itm.itemType === "weapon" && itm.equiped) {
            hasWeapon = itm.name
            weaponType = itm.weaponType
            console.log(itm.name)
        }
    })
    const dmgDetails = calcDmg(charState)
    console.log(hasWeapon)
    return {
        owner: charState.owner,
        pos,
        dirTarg,
        
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
    // additionalMagicDmg is {toAdd, percent}, not a plain number - same
    // shape/bug additionalMeeleeDmg has above, just never noticed here
    // since magicDmg was never actually consumed by anything (until
    // skillEffects.js's singlecast started reading it)
    let magicDmg = abilityAdditions.additionalMagicDmg.toAdd + charState.stats.magic*16
    if(abilityAdditions.additionalMagicDmg.percent){
        magicDmg += magicDmg*abilityAdditions.additionalMagicDmg.percent
    }
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