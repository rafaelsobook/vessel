import { getCharState, healHp, getHpRatio } from "./characterstate.js"
import { getPlayersOnScene } from "../sockets/worldsocket.js"
import { DAYNIGHT_AREA_TYPES, isNightNow } from "../components/dayNightSystem.js"
import { getAllSounds } from "../components/soundSystem.js"
import { popStatusEffect } from "../tools/popupUI.js"
import { addCameraTrauma, punchCameraFov } from "../tools/cameraShake.js"
import { showWard, hideWard, wardBreak, redemptionBurst, radiantBurst } from "../effects/blessingFx.js"

// WHAT A BLESSING'S SIGNATURE DOES. staticRecources/abilities.js holds the stat
// perks of every blessing (hp/mp %, damage, regen...) and characterstate.js
// totals them; the six that do more than that are made here, by name:
//
//   blueflame   Azure Pyre         melee hits ignite enemies with blue fire
//   divineblade Divine Edge        every 4th sword/spear hit is a radiant slash
//   divinefour  Four Heavens' Ward a golden ward absorbs one hit, then recharges
//   fistdomain  Domain of the Fist barehanded: more damage, faster, stacking hits
//   moonpiece   Shard of the Moon  at night, outdoors: magic, mana regen, speed
//   redemption  Blood Redemption   one refused death every 5 minutes, heals on hit
//
// Three ways in:
//   getLiveBlessingBonuses - what depends on the state of things right now
//     (barehanded, night). summarizeStats folds it into the totals every second.
//   applyBlessingsToMeleeHit - at every melee hit I land, on the damage
//   tryWard / tryRedemption / isInvulnerable - when I'm hit (characterstate.js)
// A blessing's level (it levels when rolled again) scales each effect by
// blessingPower.

export function blessingOf(name, state = getCharState()){
    return state?.blessings?.find(blessing => blessing?.name === name) ?? null
}

// 1 at level 1, +20% for each level after, never more than 3
function blessingPower(blessing){
    return Math.min(3, 1 + 0.2 * ((blessing?.lvl ?? 1) - 1))
}
// a cooldown that shortens with level, by up to half
function cooldownScale(blessing){
    return 1 / Math.min(2, 1 + 0.15 * ((blessing?.lvl ?? 1) - 1))
}

const hasWeapon = state => state.items.some(item => item.itemType === "weapon" && item.equiped)
function myPlayer(){
    const owner = getCharState()?.owner
    return getPlayersOnScene().find(player => player.owner === owner)
}
function say(text, color){
    popStatusEffect(text, color)
}
function play(soundName){
    getAllSounds()?.[soundName]?.play()
}

// ── live bonuses ─────────────────────────────────────────────────────────────

// Night, and somewhere with a sky to see it by (not a room or a dungeon)
function isMoonlit(state){
    return DAYNIGHT_AREA_TYPES.includes(state.currentPlace?.areaType) && isNightNow()
}

// What the blessings give right now, on top of their fixed perks:
//   meleeToAdd     flat melee damage         atkSpdPercent  share of base attack speed
//   magicPercent   magic damage, as a share  mpRegen        mana regen per tick
//   moveSpeed      walking and running speed, as a share
export function getLiveBlessingBonuses(state){
    const live = { meleeToAdd: 0, atkSpdPercent: 0, magicPercent: 0, mpRegen: 0, moveSpeed: 0 }
    if(!state?.blessings?.length) return live

    const fist = blessingOf("fistdomain", state)
    if(fist && !hasWeapon(state)){
        live.meleeToAdd += 40 * blessingPower(fist)
        live.atkSpdPercent += 0.2
    }
    const moon = blessingOf("moonpiece", state)
    if(moon && isMoonlit(state)){
        const power = blessingPower(moon)
        live.magicPercent += 0.25 * power
        live.mpRegen += 0.03 * power
        live.moveSpeed += 0.1
    }
    return live
}

// ── the hit I land ───────────────────────────────────────────────────────────

const FIST_CHAIN_MS = 1500
const FIST_STACK_EACH = 0.05
const EDGE_EVERY = 4
const EDGE_FORGET_MS = 5000
const PYRE_BURN_MS = 3000
const REDEMPTION_HEAL_BELOW = 0.25
const REDEMPTION_HEAL_SHARE = 0.1

let fistStacks = 0
let lastFistHit = 0
let edgeHits = 0
let lastEdgeHit = 0
// target id -> until when my blue fire is still on it (so a flurry doesn't stack burns)
const burningUntil = new Map()

// Every melee hit I land (createEnemy.js, createcharacter.js's PvP, duelSystem.js's
// duel): returns the damage and on-hit effects with my blessings applied.
//   dmgDetails      calcDmg's result
//   effectsWhenHit  the weapon's own on-hit effects, or undefined
//   isSkill         a skill's swing (dashstrike), not a plain one
//   targetId, targetBody   what it hit
export function applyBlessingsToMeleeHit({ dmgDetails, charState, effectsWhenHit, isSkill = false, targetId, targetBody }){
    const blessings = charState?.blessings
    if(!blessings?.length) return { dmgDetails, effectsWhenHit }

    const now = performance.now()
    const weapon = charState.items.find(item => item.itemType === "weapon" && item.equiped)
    const out = { ...dmgDetails }
    let multiplier = 1
    let radiant = false
    let effects = effectsWhenHit

    // DOMAIN OF THE FIST - barehanded hits chain: each one within 1.5 s of the
    // last adds 5% to the next, five deep
    const fist = blessingOf("fistdomain", charState)
    if(fist && !weapon){
        const cap = 5 + Math.round(blessingPower(fist)) - 1
        fistStacks = now - lastFistHit <= FIST_CHAIN_MS ? Math.min(cap, fistStacks + 1) : 0
        lastFistHit = now
        multiplier += FIST_STACK_EACH * fistStacks
        if(fistStacks === cap) say(`Domain x${cap}`, "#ffb347")
    }

    // DIVINE EDGE - sword or spear: every 4th hit, in a streak (5 s without one
    // starts it over), is a radiant slash for double damage
    const edge = blessingOf("divineblade", charState)
    if(edge && !isSkill && (weapon?.weaponType === "sword" || weapon?.weaponType === "spear")){
        edgeHits = now - lastEdgeHit > EDGE_FORGET_MS ? 1 : edgeHits + 1
        lastEdgeHit = now
        if(edgeHits >= EDGE_EVERY){
            edgeHits = 0
            radiant = true
            multiplier *= 2 * (1 + 0.1 * (blessingPower(edge) - 1))
        }
    }

    // AZURE PYRE - blue fire on what I hit, once per target until it's burnt out.
    // A weapon that burns already (the Majestic Sword) keeps its own.
    const pyre = blessingOf("blueflame", charState)
    if(pyre && targetId && !isSkill && !effects?.some(effect => effect.effectType === "burn") && (burningUntil.get(targetId) ?? 0) < now){
        burningUntil.set(targetId, now + PYRE_BURN_MS)
        effects = [...(effects ?? []), {
            effectType: "burn",
            dmgPm: Math.round(25 * blessingPower(pyre)),
            duration: PYRE_BURN_MS,
            soundPlayPerDmg: "dmgpm",
            fireColor: "blue",
        }]
    }

    if(multiplier !== 1){
        out.physicalDmg = Math.round((out.physicalDmg || 0) * multiplier)
        out.weaponDmg = Math.round((out.weaponDmg || 0) * multiplier)
    }
    if(radiant){
        // lands like a critical - gold flash, the heavier shake - and then some
        out.isCritical = true
        say("Radiant Slash!", "#ffd24a")
        play("swordWhooshS")
        const scene = myPlayer()?.body?.getScene()
        if(scene && targetBody) radiantBurst(scene, targetBody.getAbsolutePosition().clone().addInPlaceFromFloats(0, 0.6, 0))
    }

    // BLOOD REDEMPTION - near death, my blows give life back
    const redemption = blessingOf("redemption", charState)
    if(redemption && getHpRatio() < REDEMPTION_HEAL_BELOW){
        const dealt = out.weaponDmg || out.physicalDmg || 0
        const healed = healHp(Math.round(dealt * REDEMPTION_HEAL_SHARE * blessingPower(redemption)))
        if(healed > 0) say(`+${healed} hp`, "#ff5a5a")
    }

    return { dmgDetails: out, effectsWhenHit: effects }
}

// ── the hit I take ───────────────────────────────────────────────────────────

const WARD_RECHARGE_MS = 20000
let wardReadyAt = 0

// FOUR HEAVENS' WARD: true if the ward took this hit (characterstate.js's
// deductHp then takes nothing). It breaks, and comes back after 20 s.
export function tryWard(){
    const ward = blessingOf("divinefour")
    if(!ward) return false
    const now = Date.now()
    if(now < wardReadyAt) return false
    const wait = WARD_RECHARGE_MS * cooldownScale(ward)
    wardReadyAt = now + wait

    const player = myPlayer()
    if(player?.body) wardBreak(player.body)
    say("The ward takes the blow", "#ffd24a")
    play("weaponblockS")
    setTimeout(() => {
        // it's back - if I still hold it, and the world I'm in still has me
        if(!blessingOf("divinefour")) return
        refreshBlessingVisuals()
        play("notif1S")
    }, wait)
    return true
}

const REDEMPTION_COOLDOWN_MS = 5 * 60 * 1000
const REDEMPTION_SAFE_MS = 2000
let invulnerableUntil = 0

// untouchable for a moment after a refused death (characterstate.js's damageHp)
export function isInvulnerable(){
    return Date.now() < invulnerableUntil
}

// BLOOD REDEMPTION: true if it refuses this killing blow (the caller leaves me at
// 1 hp). Once every 5 minutes - the time it's ready again is kept ON the blessing,
// which is saved with the character, so logging out doesn't reset it.
export function tryRedemption(){
    const redemption = blessingOf("redemption")
    if(!redemption) return false
    const now = Date.now()
    if(now < (redemption.readyAt ?? 0)) return false
    redemption.readyAt = now + REDEMPTION_COOLDOWN_MS * cooldownScale(redemption)
    invulnerableUntil = now + REDEMPTION_SAFE_MS

    const player = myPlayer()
    if(player?.body){
        redemptionBurst(player.body)
        const scene = player.body.getScene()
        addCameraTrauma(scene, 0.6)
        punchCameraFov(scene, 0.05)
    }
    say("Redemption!", "#ff3030")
    play("horrorExplosionS")
    return true
}

// ── what's on my screen ──────────────────────────────────────────────────────

// The ward's golden orbs, up whenever I hold the blessing and it's ready. Called
// when a scene loads (areascene.js), when a blessing is gained, and when the ward
// breaks or comes back.
export function refreshBlessingVisuals(){
    const player = myPlayer()
    if(!player?.body || player.body.isDisposed()) return
    if(blessingOf("divinefour") && Date.now() >= wardReadyAt) showWard(player.body)
    else hideWard()
}
