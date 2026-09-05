import { getIsSocketOn, getPlayersOnScene } from "../sockets/worldsocket"
import { getAdditionalsFromAbilities, getActiveBuffAdditions, getCharState, getTotalAtkSpd } from "./characterstate"
import { getPlayerCoord } from "./createcharacter"
import { getSceneDet } from "../main/main"
import { castOffenseSkill, castMulticast, castBuffSkill, castDashSkill, cancelPendingCast } from "../creations/skillEffects"
import { UPGRADE_TEMPLATES } from "../staticRecources/skillUpgrades"
import { onIntersecEnterTrig } from "../components/actionManager"
import { trackAptitudeUsage } from "./aptitudeSystem"
import { getSkillEffect } from "../staticRecources/skillsData"

// CRITICAL HITS - stats.accuracy drives the CHANCE of a crit landing,
// stats.critical drives the MULTIPLIER once it does. Both start at 1 (see
// server/routes/characterR.js's own new-character stats) and grow together
// (statsSystem.js's own dex upgrade bumps accuracy+=.25 alongside
// critical+=.25 in the same click, with accuracy's own inline comment
// already calling it "the higher chance of effective strike") - this is
// just the first place that comment's promise actually gets paid off in a
// real damage roll. Kept as tunable constants rather than baked into the
// formula below so the curve can be adjusted without hunting through the
// math.
//
// chancePercent = accuracy * CRIT_CHANCE_PER_ACCURACY, capped at
// CRIT_CHANCE_CAP - a fresh lvl1 character (accuracy 1) starts at 5%,
// capped at 75% so a crit never becomes a guaranteed every-hit at high
// accuracy.
const CRIT_CHANCE_PER_ACCURACY = 5
const CRIT_CHANCE_CAP = 75
// multiplier = 1 + (critical * CRIT_DMG_PER_CRITICAL) - a fresh lvl1
// character (critical 1) crits for 1.5x, growing +0.125x per dex point
// spent (critical+=.25 per point, same rate accuracy grows at)
const CRIT_DMG_PER_CRITICAL = 0.5

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

    // aptitudeSystem.js - only counts a real activation (not the
    // isActive:false toggle-off) of an elemental skill (element:"normal"
    // utility skills like singlecast/dashstrike/multicast aren't tied to
    // any aptitude, trackAptitudeUsage no-ops on a falsy/"normal" element
    // anyway but the isActive/isMe gate here is the one that actually
    // matters - this whole function also runs for every OTHER player's
    // cast via the same socket relay, see this function's own header
    // comment on isMe)
    if(isMe && skillDetail.isActive) trackAptitudeUsage(skillDetail.element)

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
            // projectile/circle of its own (its effects entry's effectType
            // is "trigger", not "offense", so the default branch below
            // wouldn't touch it even without this explicit no-op case). Its entire real
            // behavior - programmatically clicking every OTHER assigned
            // skill-slot-button - lives in skillsui.js's slotbuttons click
            // handler, not here, since mana-charging for those other skills
            // only happens in that UI layer. Nothing to do on this end.
        break
        default:
            // any offense-type skill (singlecast + the 10 elemental skills,
            // see skillsData.js) rides the same generic cast engine - a new
            // skill needs a skillsData.js entry, not a new case here.
            // effects is an array now (getSkillEffect, skillsData.js), but
            // every skill still only carries exactly one entry today, so
            // this stays an else-if chain (first matching effectType wins)
            // same as before - revisit if a skill ever actually ships with
            // BOTH an offense and a buff entry at once
            if(getSkillEffect(skillDetail, "offense")){
                if(skillDetail.isActive){
                    castOffenseSkill(getSceneDet().scene, player, skillDetail, casterState)
                } else {
                    // toggled off before the cast window elapsed - drop it,
                    // don't fire late
                    cancelPendingCast(skillDetail.name)
                }
            } else if(getSkillEffect(skillDetail, "buff")){
                // any self-buff skill (mjolnirSkill and any future one,
                // see skillsData.js) rides the same generic buff-cast
                // engine, same "one skillsData.js entry, not a new case
                // here" reasoning as offense skills above
                if(skillDetail.isActive){
                    castBuffSkill(getSceneDet().scene, player, skillDetail, casterState)
                } else {
                    cancelPendingCast(skillDetail.name)
                }
            } else if(getSkillEffect(skillDetail, "dash")){
                // dashstrikeSkill and any future weapon skill like it - no
                // cast window to cancel (castDuration is 0, see skillsData.js's
                // own comment), so there's nothing to do on the isActive:false
                // toggle-off, unlike offense/buff above
                if(skillDetail.isActive){
                    castDashSkill(getSceneDet().scene, player, skillDetail, casterState)
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

    // effects is an array now - bump plusDmg/dmgPm on every entry that has
    // one instead of assuming a single object, so a future skill carrying
    // more than one damage-bearing entry (offense + dash, say) still gets
    // both scaled on level-up, not just whichever used to be there
    if(skillDetail.effects?.length){
        const bump = skillDetail.upgradePlus || 0
        skillDetail.effects.forEach(effect => {
            if(effect.plusDmg) effect.plusDmg += bump
            if(effect.dmgPm)   effect.dmgPm   += bump
        })
    }

    // createExplosionBurst's powerScale/fireScale/smokeScale/emberEmitRate
    // (particlesystem.js) all get multiplied by this at cast time (see
    // skillEffects.js) - the whole particle system scales up 10% per level
    // by default, so a higher-level cast visibly looks stronger, not just
    // hits harder. skillDetail.explosionScaleGrowth (optional, defaults to
    // 1 = unchanged) lets one skill's own growth RATE be tuned down without
    // touching this generic formula for every other skill -
    // massivedisintegrationSkill's own 0.3 is the first user: its base AOE
    // circle (groundTrap.radius: 10) is already huge, so the same 10%/level
    // everyone else gets compounded into a comically wide burst at higher
    // levels; 0.3 cuts that growth rate to 30% of normal (a 70% reduction)
    const explosionGrowthRate = 0.1 * (skillDetail.explosionScaleGrowth ?? 1)
    skillDetail.explosionScale = 1 + (skillDetail.lvl - 1) * explosionGrowthRate

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
    // mjolnirSkill and any future skillEffects.js buff - summed in
    // ADDITIVELY alongside whatever the ability system already grants,
    // completely independent of it (see getActiveBuffAdditions' own
    // comment on why this can't just live inside abilityAdditions itself).
    // meeleeDmg only for now - {toAdd:0, percent:0} fallback so a charState
    // with no active buff at all doesn't need its own separate branch below.
    const buffAdditions = getActiveBuffAdditions().meeleeDmg || { toAdd: 0, percent: 0 }
    let weaponDet = undefined
    charState.items.forEach(itm => {
        if(itm.itemType === "weapon" && itm.equiped) {
            weaponDet = itm
        }
    })

    let physicalDmg = abilityAdditions.additionalMeeleeDmg.toAdd + buffAdditions.toAdd + charState.stats.strength*4

    // log(abilityAdditions.additionalMeeleeDmg.toAdd)
    // log(abilityAdditions.additionalMeeleeDmg.percent)
    if(abilityAdditions.additionalMeeleeDmg.percent || buffAdditions.percent){
        const addedDmgByPercent = physicalDmg*(abilityAdditions.additionalMeeleeDmg.percent + buffAdditions.percent)
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

    // resolved HERE, client-side, before dmgDetails ever leaves this
    // function - same "server only authoritative for hp/removal, never for
    // whether a hit even landed/how hard" convention every other hit-
    // resolution decision in this game already follows (see
    // emitEnemyIsHit's own comment, tcp/index.ts's "enemyIsHit" handler
    // just does enemyTarg.hp -= dmgToApply on whatever physicalDmg/
    // weaponDmg arrives, no crit logic of its own to keep in sync). Player-
    // only, deliberately: enemies keep their own stats.critical/accuracy
    // (genenemy.ts) as pure flavor data for now - "enemy-attacked"'s own
    // damage-to-player path never calls calcDmg at all, so this can't
    // reach it by accident.
    // critChance temp buff (skillEffects.js's castDashSkill, dashstrikeSkill's
    // own "critical" effect entry, e.g. criticalPercent: 0.4) - added AFTER
    // the accuracy-based chance is already capped at CRIT_CHANCE_CAP, not
    // folded into the min() above, so a skill's own crit bonus can genuinely
    // push an already-high-accuracy character toward a near-guaranteed crit
    // on that one empowered strike instead of being swallowed by the cap.
    const critChanceBuff = getActiveBuffAdditions().critChance || { toAdd: 0 }
    const critChancePercent = Math.min(CRIT_CHANCE_CAP, accuracy * CRIT_CHANCE_PER_ACCURACY) + critChanceBuff.toAdd
    const isCritical = Math.random() * 100 < critChancePercent
    if(isCritical){
        const critMultiplier = 1 + charState.stats.critical * CRIT_DMG_PER_CRITICAL
        physicalDmg = Math.round(physicalDmg * critMultiplier)
        weaponDmg = Math.round(weaponDmg * critMultiplier)
        magicDmg = Math.round(magicDmg * critMultiplier)
    }

    return { physicalDmg, weaponDmg, magicDmg, accuracy, isCritical }
}
export function calcPercent(currentNum, totalNum){
    return currentNum/totalNum * 100
}

export function clearAttackingIntervals(){
    // clearInterval(attackingInterval)
    // clearInterval(detectingInterval)
}

export function registerToAtkCollider(scene, meshName, cb){
    const atkCollider = scene.getMeshByName(`atkCollider`)
    scene.meshes.forEach(mesh => {

        if(mesh.getClassName() === "GroundMesh" && mesh.name === "water"){

        }
        // "Mesh" alone only matches the original/root mesh - every tree you
        // actually see is placed via .createInstance() (createvillage.js's
        // spawnProps/spawnNonPhysics, and infterrain's own foliage placement),
        // which returns an "InstancedMesh", not a "Mesh". Both need to be checked.
        if(mesh.getClassName() === "Mesh" || mesh.getClassName() === "InstancedMesh"){
            
            if(mesh.name && mesh.name.toLocaleLowerCase().includes(meshName)){
                console.log("hello tree")
                // precise:true - this is a swing landing damage/loot, not a
                // walk-up proximity check, so it needs real mesh-level
                // contact. Without it, Babylon's default bounding-box-only
                // intersection check let atkCollider's swing hitbox trigger
                // this against any tree just standing nearby (a big leafy
                // tree's bounding box reaches well past its visible trunk),
                // which is exactly how attacking a slime standing near a
                // tree could also grant wood - the tree was never actually
                // hit, only "bounding-box adjacent" to the swing.
                onIntersecEnterTrig(atkCollider, mesh, scene, cb, true)
            }
        }
        // if(mesh.name.includes("tree")) console.log(mesh.name)
    })
}