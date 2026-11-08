import { Color3, LoadAssetContainerAsync, Mesh, StandardMaterial, Vector3 } from "@babylonjs/core"
import { getEnemiesOnScene, getIsSocketOn, getPlayersOnScene } from "../sockets/worldsocket.js"
import { getSocket } from "../sockets/joinsocket.js"
import { deductHp, getCharState, isDead } from "../charactersystem/characterstate.js"
import { getGameStatus } from "../main/main.js"
import { hasDungeonLineOfSight } from "../tools/dungeonSight.js"
import { findAnimVariants, pickAnimVariant } from "../tools/animation.js"
import { getAllSounds, playSoundNear } from "../components/soundSystem.js"
import { addCameraTrauma } from "../tools/cameraShake.js"
import { sparkBurst } from "../effects/blessingFx.js"
import { popShockRing } from "../effects/shockRing.js"
import { chargeOrb, crackle, pointOnSphere, prewarmZap, steppedLeader, strikeBolt, zapImpact, zapPalette } from "../effects/zap.js"
import { electrocutePlayer, prewarmElectrocution } from "../effects/electrocute.js"
import { chargeFireball, fireExplosion, firePalette, fireRing, flyFireball, landingMarker, prewarmFireball } from "../effects/fireball.js"
import { prewarmScorch, scorchPlayer } from "../effects/scorch.js"
import { chargeSonic, flySonicWave, prewarmSonic, sonicLane, sonicPalette, sonicRelease } from "../effects/sonicBoom.js"
import { concussPlayer, prewarmConcussion } from "../effects/concussed.js"
import { chargeDarkSlash, darkSlashPalette, flyDarkSlash, prewarmDarkSlash, slashRelease } from "../effects/darkSlash.js"
import { prewarmSlashed, slashPlayer } from "../effects/slashed.js"
import { DODGED_COLOR, chestOf, comicText, feetOf, soundFor } from "../effects/comicHit.js"
import { punchCameraFov } from "../tools/cameraShake.js"
import { openworldSurfaceY } from "../tools/groundHeight.js"
import { OPENWORLD_PLACE_ID } from "../constants/constants.js"
import { isEnemyRoaring } from "./createEnemy.js"

// AN ENEMY'S RANGED ATTACK - its det.rangeAtkDetails (tcp's genenemy.ts):
//   { range, modelName, projectileDet?, soundWhenHit, victimAnimation?, cooldown? }
// projectileDet.pType "lightning" (the electric slimes): it stops, charges,
// and a bolt strikes its target - dodgeable, see its timeline below.
// "fireball" (the fire slimes): it puffs up and lobs a fireball at where its
// target is headed, a ring on the ground marking the spot - see its timeline.
// "sonic" (the orangelith): it hums itself up, lights the lane on the ground,
// and a sonic boom tears down it - see its timeline.
// "darkslash" (the dark slimes): it draws itself in, a glint flashes off it,
// lanes light up fanned out at its target, and it throws two or three
// crescents of its own dark liquid down them, one after another - the fury
// cutters, see their timeline. projectileDet.slashes: [fewest, most].
// rangeAtkDetails.effects: what a cutter that lands does on top of the hit
// (the dark slimes' bleed) - every one that lands.
// projectileDet.color: the bolt's, the fire's, the boom's or the cutters'
// (effects/zap.js's palettes, effects/fireball.js's, effects/sonicBoom.js's,
// effects/darkSlash.js's). A modelName
// (models/rangemodels/<name>.glb, e.g. "sting"): the model flies at them.
//
// Who decides: the target's own client - when the enemy is after me, I'm out
// of its melee reach but inside `range` and in sight, and it's had its
// cooldown (watchRangeAttack). tcp relays it to everyone in the place
// ("enemy-attacked-range", checked against the enemy's own data), everyone
// plays it (handleRangeAttack), and only the target's own client decides if
// it landed and takes the damage. Lightning or a fireball that lands is
// relayed again ("range-attack-landed") so everyone sees what it did to them.

const CHECK_MS = 400
const DEFAULT_COOLDOWN_MS = 5200
const COOLDOWN_JITTER_MS = 1800
// after it first comes for me, before its first shot
const FIRST_SHOT_DELAY_MS = [900, 2200]
// further than this past its own melee reach before it bothers shooting
const MELEE_SLACK = 1.5
// out past range × this when it lets go, it falls short
const REACH_SLACK = 1.25

// LIGHTNING'S TIMELINE, ms after the charge starts:
//   0                         the charge: an orb swells over it, sparks pour in
//   CHARGE_MS - LOCK_BEFORE   it locks on to where its target is - the orb
//                             flashes, and the leader gropes out to that spot
//   CHARGE_MS                 the bolt strikes the locked spot
// Still within HIT_RADIUS of the spot when it strikes (planar), and still
// within reach: it lands. Sprinting when it locks gets you clear (3.7/s ×
// 0.28 s > 0.85); standing, swinging, casting - fried.
const CHARGE_MS = 720
const LOCK_BEFORE_MS = 280
const HIT_RADIUS = 0.85

// THE FIREBALL'S TIMELINE, ms after the wind-up starts:
//   0                   it plants itself and puffs up: a ball of fire swells
//                       over it, flames drawn in, fire catching round it
//   FIRE_CHARGE_MS      it squashes down (the last FIRE_SQUASH_MS) and spits
//                       it: the ball arcs off at where its target is headed -
//                       where they are plus LEAD of the way they're going -
//                       and a ring on the ground marks the spot, filling in
//   + the flight        it comes down: the blast. Within BLAST_RADIUS of it
//                       (planar, and not high above it), it lands.
// The flight takes FLIGHT_MS_BASE plus FLIGHT_MS_PER_UNIT a unit (within
// FLIGHT_MS) - time enough to see the ring and get out of it: sprinting
// clears it (3.7/s), walking (1/s) doesn't, and running straight on runs
// into it.
const FIRE_CHARGE_MS = 780
const FIRE_SQUASH_MS = 150
const BLAST_RADIUS = 1.6
const BLAST_HEIGHT = 1.8
const LEAD = 0.55
const MAX_LEAD = 3.5
const FLIGHT_MS_BASE = 520
const FLIGHT_MS_PER_UNIT = 45
const FLIGHT_MS = [650, 1250]
// how high it arcs over the way it goes: this, plus this share of how far
const APEX = [1.1, 0.22]
// everyone this near a blast feels it
const SHAKE_REACH = 12

// THE SONIC BOOM'S TIMELINE, ms after the charge starts:
//   0                        it plants itself and hums: rings of sound collapse
//                            into a point before it, stones lift off the
//                            ground round it, the ground throbs
//   SONIC_CHARGE_MS
//     - SONIC_LOCK_MS        it picks its line - at its target as they are
//                            now - and the lane lights up along the ground
//   SONIC_CHARGE_MS          the boom: the wave tears down the lane at
//                            SONIC_SPEED, widening as it goes
// The front passing you while you're still in the lane (planar, within its
// half-width there plus SONIC_BODY, and not high over it): it lands. From
// 10 units off you've ~0.75 s from the lane lighting up: sprinting clears it
// (3.7/s), walking (1/s) doesn't.
const SONIC_CHARGE_MS = 950
const SONIC_LOCK_MS = 380
const SONIC_SPEED = 24
const SONIC_HALF_WIDTH = [0.7, 1.5]    // at its mouth, and out at full reach
const SONIC_BODY = 0.3
const SONIC_HIT_HEIGHT = 2.2
// the lane runs this far past where they stood when it locked
const SONIC_LANE_PAST = 3

// THE FURY CUTTERS' TIMELINE, ms after the charge starts:
//   0                           it draws itself in: black flames pour up off
//                               it, a pool of its dark spreads under it,
//                               light is sucked into it; it coils down
//   CUTTER_CHARGE_MS
//     - CUTTER_LOCK_MS          the glint - it picks its lines: at its target
//                               as they are now, fanned out round that
//                               (CUTTER_FANS), and the lanes light up
//   CUTTER_CHARGE_MS
//     + i × CUTTER_GAP_MS       cutter i leaves it down lane i at CUTTER_SPEED,
//                               leaning its own way - the first two crossing
// A cutter's middle passing you while you're still in its lane (planar,
// within its half-width there plus CUTTER_BODY, and not high over it): it
// cuts you - every one that does. From 10 units off you've ~0.85 s from the
// lanes lighting up before the first one's on you, a beat more for each
// after it: sprinting out of the fan clears them all (3.7/s), walking (1/s)
// doesn't, and standing there eats the lot.
const CUTTER_CHARGE_MS = 1000
const CUTTER_LOCK_MS = 400
const CUTTER_GAP_MS = 150
const CUTTER_SPEED = 22
const CUTTER_HALF_WIDTH = [0.75, 1.2]   // at its mouth, and out at full reach
const CUTTER_BODY = 0.3
const CUTTER_HIT_HEIGHT = 2
const CUTTER_LANE_PAST = 3
// by how many it throws: each cutter's turn off the line and its lean, in
// degrees - leaning one way then the other (an X as they cross), and a third
// rolled right over into an arch, cutting flat
const CUTTER_FANS = {
    2: [{ yaw: -4, roll: 38 }, { yaw: 4, roll: -38 }],
    3: [{ yaw: 0, roll: 38 }, { yaw: -7, roll: -38 }, { yaw: 7, roll: 180 }],
}

// ── deciding (the target's own client) ───────────────────────────────────────

/**
 * Starts this enemy's ranged attacks, from createEnemy (det has
 * rangeAtkDetails). Stops with its body.
 */
export function watchRangeAttack(det, body){
    const details = det.rangeAtkDetails
    if(!details || !body) return
    // 0 - it isn't after me (yet): the first shot waits a beat once it is
    let readyAt = 0
    const check = () => {
        const enemy = getEnemiesOnScene().find(ene => ene._id === det._id)
        if(!enemy || enemy.body !== body || body.isDisposed()) return
        const charState = getCharState()
        if(!charState) return
        if(enemy._targetId !== charState.owner){
            readyAt = 0
            return
        }
        const now = performance.now()
        if(!readyAt){
            readyAt = now + FIRST_SHOT_DELAY_MS[0] + Math.random() * (FIRST_SHOT_DELAY_MS[1] - FIRST_SHOT_DELAY_MS[0])
            return
        }
        if(now < readyAt) return
        if(enemy.isDead || enemy._disabled || isEnemyRoaring(enemy) || enemy._channelingUntil > now) return
        if(getGameStatus() === "loading" || isDead()) return
        const me = getPlayersOnScene().find(pl => pl.owner === charState.owner)
        if(!me?.body) return
        const dist = planarDistance(body.position, me.body.position)
        if(dist <= det.maxDistance + MELEE_SLACK || dist > (details.range ?? 15)) return
        // in a dungeon, never through a wall (tools/dungeonSight.js)
        if(!hasDungeonLineOfSight(det.currentPlaceId, body.position, me.body.position)) return

        readyAt = now + (details.cooldown ?? DEFAULT_COOLDOWN_MS) + Math.random() * COOLDOWN_JITTER_MS
        const data = {
            _id: det._id,
            currentPlaceId: det.currentPlaceId,
            targetId: charState.owner,
            rangeAtkDetails: details,
            dmg: det.stats?.dmg ?? 1,
            effects: det.effects ?? [],
        }
        // how many cutters - picked here, once, so every client throws the same
        if(details.projectileDet?.pType === "darkslash"){
            const [fewest, most] = cutterRange(details)
            data.slashes = fewest + Math.floor(Math.random() * (most - fewest + 1))
        }
        if(getIsSocketOn()) getSocket().emit("enemyAttackedRange", data)
        else handleRangeAttack(enemy, data)
    }
    // a random phase - enemies made together don't all check on one tick
    let timer = null
    const startTimer = setTimeout(() => { timer = setInterval(check, CHECK_MS) }, Math.random() * CHECK_MS)
    body.onDisposeObservable.addOnce(() => {
        clearTimeout(startTimer)
        clearInterval(timer)
    })
    prewarm(body.getScene(), details.projectileDet)
}

// what it throws, and what that does to me - shaders compiled, textures
// loaded - before its first shot rather than on it
const prewarmedOnMe = new WeakMap()   // scene -> Set(pType|color)
function prewarm(scene, projectile){
    const pType = projectile?.pType
    if(pType === "lightning") prewarmZap(scene, projectile.color)
    else if(pType === "fireball") prewarmFireball(scene, projectile.color)
    else if(pType === "sonic") prewarmSonic(scene, projectile.color)
    else if(pType === "darkslash") prewarmDarkSlash(scene, projectile.color)
    else return
    let done = prewarmedOnMe.get(scene)
    if(!done) prewarmedOnMe.set(scene, done = new Set())
    const key = `${pType}|${projectile.color}`
    if(done.has(key)) return
    // my rig not made yet - the next one of them to show up tries again
    const me = getPlayersOnScene().find(pl => pl.owner === getCharState()?.owner)
    if(!me?.body) return
    done.add(key)
    if(pType === "lightning") prewarmElectrocution(me, projectile.color)
    else if(pType === "sonic") prewarmConcussion(me, projectile.color)
    else if(pType === "darkslash") prewarmSlashed(me, projectile.color)
    else prewarmScorch(me, projectile.color)
}

// ── playing it (every client) ────────────────────────────────────────────────

/**
 * tcp's "enemy-attacked-range" (worldsocket.js), or straight from
 * watchRangeAttack offline - data: { _id, targetId, rangeAtkDetails, dmg, effects }.
 */
export function handleRangeAttack(enemy, data){
    const details = data.rangeAtkDetails ?? enemy?.det?.rangeAtkDetails
    if(!details || !enemy?.body || enemy.body.isDisposed() || enemy.isDead) return
    const pType = details.projectileDet?.pType
    if(pType === "lightning") return lightningStrike(enemy, data, details)
    if(pType === "fireball") return fireballLob(enemy, data, details)
    if(pType === "sonic") return sonicBlast(enemy, data, details)
    if(pType === "darkslash") return furyCutters(enemy, data, details)
    if(details.modelName) return shootModel(enemy, data, details)
}

/**
 * tcp's "range-attack-landed" - a ranged attack landed on someone else
 * (data: { pType, color, victimAnimation, from }). Their own client already
 * took the damage; here it shows on them. Silent: the strike's or the
 * blast's own sound already played here.
 */
export function showRangeLanded(player, data){
    if(!player?.body || player.body.isDisposed()) return
    showLanded(player, { ...data, soundWhenHit: null }, false)
}

// what a ranged attack landing does to its victim, by what it was
function showLanded(player, hit, isMine){
    const options = { isMine, color: hit.color, soundWhenHit: hit.soundWhenHit, animation: hit.victimAnimation }
    if(hit.pType === "fireball") scorchPlayer(player, { ...options, from: toVector(hit.from) })
    else if(hit.pType === "lightning") electrocutePlayer(player, options)
    else if(hit.pType === "sonic") concussPlayer(player, { ...options, from: toVector(hit.from) })
    // roll: which way the cutter leaned - only known here, on the victim's own
    // screen; everyone else's copy of the cut leans its own way
    else if(hit.pType === "darkslash") slashPlayer(player, { ...options, from: toVector(hit.from), roll: hit.roll ?? null })
}

// a ranged attack landed on me: the damage (only here - mine), what it does
// to me, and everyone else told. from: where it came from (a blast's middle).
// local: more about it for my own screen only (a cutter's roll). The attack's
// own effects (details.effects - a cutter's bleed) on top of the enemy's.
function landOnMe(me, data, details, from = null, local = {}){
    const charState = getCharState()
    const hpBefore = charState.hp
    deductHp(data.dmg ?? 1, [...(data.effects ?? []), ...(details.effects ?? [])])
    // the Four Heavens' Ward took the whole blow (blessingEffects.js) - it
    // shows its own breaking; nothing got through
    if(charState.hp >= hpBefore && !isDead()) return
    const hit = {
        pType: details.projectileDet.pType,
        color: details.projectileDet.color,
        soundWhenHit: details.soundWhenHit,
        victimAnimation: details.victimAnimation,
        from: from ? { x: from.x, y: from.y, z: from.z } : null,
    }
    showLanded(me, { ...hit, ...local }, true)
    if(getIsSocketOn()){
        getSocket().emit("rangeAttackLanded", { owner: me.owner, currentPlaceId: charState.currentPlace.placeId, ...hit })
    }
}

// ── lightning ────────────────────────────────────────────────────────────────

function lightningStrike(enemy, data, details){
    const scene = enemy.body.getScene()
    const palette = zapPalette(details.projectileDet.color)
    const range = details.range ?? 15
    const start = performance.now()
    const victim = () => getPlayersOnScene().find(pl => pl.owner === data.targetId)

    // it plants itself to charge (renderer.js's chase skips it meanwhile, and
    // createEnemy's melee waits)
    enemy._channelingUntil = start + CHARGE_MS
    findAnimVariants(enemy.anims, "running").forEach(anim => anim.stop())
    enemy.runSound?.stop?.()

    const height = enemy.det.bodyHeight ?? 1
    const anchor = () => enemy.body.position.add(new Vector3(0, height * 0.5 + 0.38, 0))
    const orb = chargeOrb(scene, anchor, palette, CHARGE_MS)
    const bodyRadius = (enemy.det.bodyWidenes ?? 1) * 0.55
    const bodyArcs = crackle(scene, () => {
        const center = enemy.body.position
        return [pointOnSphere(center, bodyRadius), pointOnSphere(center, bodyRadius)]
    }, palette, { count: 2, interval: 50, width: 0.012 })

    let locked = null
    const observer = scene.onBeforeRenderObservable.add(() => {
        // killed, bound, gone - the charge fizzles out
        if(enemy.isDead || enemy._disabled || enemy.body.isDisposed()) return stop()
        const t = performance.now() - start
        const target = victim()
        if(!locked && target?.body) face(enemy, target.body.position)
        if(!locked && t >= CHARGE_MS - LOCK_BEFORE_MS){
            locked = target?.body && !target.body.isDisposed() ? chestOf(target) : ahead(enemy, range * 0.6)
            orb.flash()
            steppedLeader(scene, orb.position(), locked, palette, LOCK_BEFORE_MS)
        }
        if(t >= CHARGE_MS){
            const from = orb.position()
            stop()
            safely("the strike", () => strike(from))
        }
    })
    // its crackle - once the strike's on its way, so nothing in a sound can stop it
    playSoundNear(getAllSounds()?.electricChargeS, enemy.body.position)
    function stop(){
        scene.onBeforeRenderObservable.remove(observer)
        orb.dispose()
        bodyArcs.dispose()
        enemy._channelingUntil = 0
    }

    function strike(from){
        const reach = range * REACH_SLACK
        let to = locked
        // they'd got out of its reach - it falls short
        const flat = planarDistance(from, to)
        if(flat > reach) to = Vector3.Lerp(from, to, reach / flat)

        const charState = getCharState()
        const me = charState && data.targetId === charState.owner ? victim() : null
        let landed = false
        if(me?.body && !isDead()){
            landed = planarDistance(me.body.position, locked) <= HIT_RADIUS && planarDistance(from, me.body.position) <= reach
            // on my own screen it goes right into me
            if(landed) to = chestOf(me)
        }

        strikeBolt(scene, from, to, palette)
        zapImpact(scene, from, palette, { big: false })
        pickAnimVariant(enemy.anims, "attack")?.play(false)

        if(landed) return landOnMe(me, data, details)
        // where it struck - for me, missed; for anyone else, where it went
        // (lit up to the bones on top, if their target's client says it landed)
        zapImpact(scene, to, palette, { big: false })
        popShockRing(scene, new Vector3(to.x, to.y - 1.02, to.z), { size: 1.8, seconds: 0.35, color: palette.glow })
        playSoundNear(soundFor(details.soundWhenHit), to)
        if(me) comicText(scene, "DODGED!", chestOf(me).add(new Vector3(0, 1.05, 0)), DODGED_COLOR)
    }
}

// ── the fireball ─────────────────────────────────────────────────────────────

function fireballLob(enemy, data, details){
    const scene = enemy.body.getScene()
    const palette = firePalette(details.projectileDet.color)
    const range = details.range ?? 15
    const start = performance.now()
    const victim = () => getPlayersOnScene().find(pl => pl.owner === data.targetId)

    // it plants itself to wind up (renderer.js's chase skips it meanwhile,
    // and createEnemy's melee waits)
    enemy._channelingUntil = start + FIRE_CHARGE_MS
    findAnimVariants(enemy.anims, "running").forEach(anim => anim.stop())
    enemy.runSound?.stop?.()

    const height = enemy.det.bodyHeight ?? 1
    const feet = enemy.body.position.add(new Vector3(0, -height / 2, 0))
    const anchor = () => enemy.body.position.add(new Vector3(0, height * 0.5 + 0.42, 0))
    const ball = chargeFireball(scene, anchor, palette, FIRE_CHARGE_MS)
    fireRing(scene, feet, palette, { radius: (enemy.det.bodyWidenes ?? 1) * 0.75, ms: 450 })
    popShockRing(scene, feet, { size: 2.4, seconds: 0.4, color: palette.mid })
    const puff = puffUp(enemy, palette)
    const heading = trackHeading(victim)

    const observer = scene.onBeforeRenderObservable.add(() => {
        // killed, bound, gone - snuffed out
        if(enemy.isDead || enemy._disabled || enemy.body.isDisposed()) return stop(true)
        const t = performance.now() - start
        const target = victim()
        heading.step()
        if(target?.body) face(enemy, target.body.position)
        puff.windUp(t / FIRE_CHARGE_MS)
        if(t >= FIRE_CHARGE_MS){
            const from = ball.position()
            stop(false)
            safely("the throw", () => launch(from, target))
        }
    })
    // the fire catching - once the throw's on its way, so nothing in a sound can stop it
    playSoundNear(getAllSounds()?.igniteFireS, enemy.body.position)
    function stop(fizzled){
        scene.onBeforeRenderObservable.remove(observer)
        ball.dispose({ fizzled })
        enemy._channelingUntil = 0
        if(fizzled) puff.restore()
    }

    function launch(from, target){
        const at = landingSpot(enemy, target, heading, range)
        const distance = planarDistance(from, at)
        const ms = Math.min(FLIGHT_MS[1], Math.max(FLIGHT_MS[0], FLIGHT_MS_BASE + FLIGHT_MS_PER_UNIT * distance))
        puff.spit()
        pickAnimVariant(enemy.anims, "attack")?.play(false)
        playSoundNear(getAllSounds()?.fireBallS, from)
        sparkBurst(scene, from, palette.hot, { count: 26, power: 4, size: [0.08, 0.18], life: [0.2, 0.45] })
        const marker = landingMarker(scene, at, BLAST_RADIUS, palette, ms)
        flyFireball(scene, from, at, palette, ms, {
            apex: APEX[0] + APEX[1] * distance,
            onLand: spot => {
                marker.dispose()
                safely("the blast", () => blast(spot))
            },
        })
    }

    function blast(at){
        fireExplosion(scene, at, palette, { radius: BLAST_RADIUS })
        shakeNear(scene, at)
        const charState = getCharState()
        const me = charState && data.targetId === charState.owner ? victim() : null
        let landed = false
        if(me?.body && !me.body.isDisposed() && !isDead()){
            const myFeet = feetOf(me)
            landed = planarDistance(myFeet, at) <= BLAST_RADIUS && Math.abs(myFeet.y - at.y) <= BLAST_HEIGHT
        }
        if(landed) return landOnMe(me, data, details, blastOrigin(at, enemy))
        // where it came down - for me, missed; for anyone else, where it went
        // (burnt on top, if their target's client says it landed)
        playSoundNear(soundFor(details.soundWhenHit), at)
        if(me) comicText(scene, "DODGED!", chestOf(me).add(new Vector3(0, 1.05, 0)), DODGED_COLOR)
    }
}

// where the fireball comes down: where they'll be - their feet now, plus
// LEAD of the way they're going over the flight (capped) - and no further
// than it can throw. Nobody to throw at: a way off ahead of it.
function landingSpot(enemy, target, heading, range){
    const origin = enemy.body.position
    if(!target?.body || target.body.isDisposed()){
        const spot = ahead(enemy, range * 0.6)
        spot.y = origin.y - (enemy.det.bodyHeight ?? 1) / 2
        return spot
    }
    const feet = feetOf(target)
    const flight = Math.min(FLIGHT_MS[1], FLIGHT_MS_BASE + FLIGHT_MS_PER_UNIT * planarDistance(origin, feet)) / 1000
    const lead = heading.velocity().scale(flight * LEAD)
    if(lead.length() > MAX_LEAD) lead.normalize().scaleInPlace(MAX_LEAD)
    const spot = feet.add(lead)
    const reach = range * REACH_SLACK
    const far = planarDistance(origin, spot)
    if(far > reach){
        spot.x = origin.x + (spot.x - origin.x) * reach / far
        spot.z = origin.z + (spot.z - origin.z) * reach / far
    }
    return spot
}

// what a blast throws its victim away from: its middle - nudged toward
// whoever threw it, so someone caught dead in the middle is thrown back
// away from them
function blastOrigin(at, enemy){
    const toward = enemy.body.isDisposed() ? Vector3.Zero() : enemy.body.position.subtract(at)
    toward.y = 0
    if(toward.lengthSquared() > 0.0001) toward.normalize().scaleInPlace(0.35)
    return at.add(toward)
}

// which way `who()` is going on the ground, units/s - eased over the last
// few frames (someone else's body moves in network steps)
function trackHeading(who){
    const velocity = Vector3.Zero()
    let last = null
    let lastAt = 0
    return {
        step(){
            const body = who()?.body
            if(!body || body.isDisposed()) return
            const now = performance.now()
            if(last){
                const dt = (now - lastAt) / 1000
                if(dt > 0.001){
                    velocity.x += ((body.position.x - last.x) / dt - velocity.x) * 0.25
                    velocity.z += ((body.position.z - last.z) / dt - velocity.z) * 0.25
                }
            }
            last = body.position.clone()
            lastAt = now
        },
        velocity: () => velocity.clone(),
    }
}

// a blast felt by everyone near it - harder the nearer (camera trauma shows
// squared, so out at the edge it barely stirs)
function shakeNear(scene, at, amount = 0.45){
    const me = getPlayersOnScene().find(pl => pl.owner === getCharState()?.owner)
    if(!me?.body || me.body.isDisposed()) return
    const near = 1 - planarDistance(me.body.position, at) / SHAKE_REACH
    if(near > 0) addCameraTrauma(scene, amount * near)
}

// the wind-up on its body: it swells as it breathes the fire in, squashes
// down, and springs up tall and thin as it spits - its model scaled round its
// feet (createEnemy.js's model root, under the body) - glowing hotter all the
// while (an overlay of the fire's colour on its own meshes)
function puffUp(enemy, palette){
    const scene = enemy.body.getScene()
    const root = modelRootOf(enemy)
    const base = root?.scaling.clone()
    const skins = (enemy.meshes ?? []).filter(mesh => !mesh.isDisposed() && mesh.isVisible)
    const shape = (wide, tall) => {
        if(root && !root.isDisposed()) root.scaling.set(base.x * wide, base.y * tall, base.z * wide)
    }
    const heat = k => skins.forEach(mesh => {
        // a blow's own white flash (meleeCombat.js) wins while it lasts
        if(mesh.isDisposed() || mesh._hitFlashUntil > performance.now()) return
        mesh.renderOverlay = k > 0.01
        mesh.overlayColor = palette.hot
        mesh.overlayAlpha = 0.45 * k
    })
    let spring = null
    function restore(){
        if(spring) scene.onBeforeRenderObservable.remove(spring)
        spring = null
        shape(1, 1)
        heat(0)
    }
    return {
        // t: 0..1 through the wind-up - swelling, then the squash
        windUp(t){
            const squashFrom = 1 - FIRE_SQUASH_MS / FIRE_CHARGE_MS
            if(t < squashFrom){
                const k = t / squashFrom
                const wobble = Math.sin(performance.now() / 32) * 0.035 * k
                shape(1 + 0.16 * k + wobble, 1 + 0.12 * k - wobble)
            } else {
                const k = Math.min(1, (t - squashFrom) / (1 - squashFrom))
                const e = 1 - (1 - k) * (1 - k)
                shape(1.16 + 0.16 * e, 1.12 - 0.44 * e)
            }
            heat(Math.min(1, t))
        },
        // the spit: up tall and thin, a jelly wobble, settled
        spit(){
            const at = performance.now()
            spring = scene.onBeforeRenderObservable.add(() => {
                const e = performance.now() - at
                if(e >= 520 || enemy.body.isDisposed()) return restore()
                const wobble = Math.exp(-e / 120) * Math.cos(e / 40)
                shape(1 - 0.18 * wobble, 1 + 0.42 * wobble)
                heat(Math.max(0, 1 - e / 300))
            })
        },
        restore,
    }
}
// the node under its body the glb hangs from
function modelRootOf(enemy){
    let node = enemy.meshes?.[0]
    while(node?.parent && node.parent !== enemy.body) node = node.parent
    return node?.parent === enemy.body ? node : null
}

// ── the sonic boom ───────────────────────────────────────────────────────────

function sonicBlast(enemy, data, details){
    const scene = enemy.body.getScene()
    const palette = sonicPalette(details.projectileDet.color)
    const reach = (details.range ?? 15) * REACH_SLACK
    const halfWidth = along => SONIC_HALF_WIDTH[0] + (SONIC_HALF_WIDTH[1] - SONIC_HALF_WIDTH[0]) * Math.min(1, Math.max(0, along) / reach)
    const start = performance.now()
    const victim = () => getPlayersOnScene().find(pl => pl.owner === data.targetId)

    // it plants itself to charge (renderer.js's chase skips it meanwhile, and
    // createEnemy's melee waits)
    enemy._channelingUntil = start + SONIC_CHARGE_MS
    findAnimVariants(enemy.anims, "running").forEach(anim => anim.stop())
    enemy.runSound?.stop?.()

    const height = enemy.det.bodyHeight ?? 1
    const width = enemy.det.bodyWidenes ?? 1
    const feetNow = () => enemy.body.position.add(new Vector3(0, -height / 2, 0))
    // the point it gathers the sound into: up its front
    const focusNow = () => enemy.body.position.add(new Vector3(0, height * 0.22, 0)).addInPlace(flatForward(enemy).scale(width * 0.75))
    const charge = chargeSonic(scene, { getFocus: focusNow, getFeet: feetNow, palette, ms: SONIC_CHARGE_MS, radius: width * 1.2 })
    const hum = humUp(enemy, palette)
    let locked = null

    const observer = scene.onBeforeRenderObservable.add(() => {
        // killed, bound, gone - the hum dies out
        if(enemy.isDead || enemy._disabled || enemy.body.isDisposed()) return stop(true)
        const t = performance.now() - start
        const target = victim()
        if(!locked && target?.body) face(enemy, target.body.position)
        hum.step(Math.min(1, t / SONIC_CHARGE_MS))
        if(!locked && t >= SONIC_CHARGE_MS - SONIC_LOCK_MS) safely("the lock", () => lock(target))
        if(t >= SONIC_CHARGE_MS){
            const from = charge.position()
            stop(false)
            safely("the boom", () => boom(from))
        }
    })
    playSoundNear(getAllSounds()?.sonicChargeS, enemy.body.position)
    function stop(fizzled){
        scene.onBeforeRenderObservable.remove(observer)
        enemy._channelingUntil = 0
        locked?.lane.dispose()
        if(fizzled){
            charge.dispose({ fizzled: true })
            hum.restore()
        }
    }

    // its line: at them as they are now - the lane lights up along the ground
    function lock(target){
        const focus = focusNow()
        const aim = target?.body && !target.body.isDisposed() ? feetOf(target) : ahead(enemy, reach * 0.6).addInPlace(new Vector3(0, -height / 2, 0))
        const flat = new Vector3(aim.x - focus.x, 0, aim.z - focus.z)
        const distance = flat.length()
        if(distance < 0.01) flat.copyFrom(flatForward(enemy))
        else flat.scaleInPlace(1 / distance)
        face(enemy, enemy.body.position.add(flat))
        const groundAt = groundFor(enemy, feetNow(), aim)
        const chest = target?.body && !target.body.isDisposed() ? chestOf(target) : focus.add(flat.scale(reach))
        const laneFrom = new Vector3(focus.x, 0, focus.z)
        locked = {
            flat,
            chest,
            groundAt,
            lane: sonicLane(scene, { from: laneFrom, dir: flat, length: Math.min(reach, distance + SONIC_LANE_PAST), halfWidth, groundAt, palette }),
        }
        charge.lock()
    }

    function boom(from){
        // its lock never took - nothing to fire down
        if(!locked){
            charge.dispose({ fizzled: true })
            hum.restore()
            return
        }
        // the way it goes: down its line, dipping (or rising) toward their
        // chest - never steeper than a gentle slope
        const flat = locked.flat
        const toChest = locked.chest.subtract(from)
        const planar = Math.max(0.5, Math.hypot(toChest.x, toChest.z))
        const slope = Math.max(-0.25, Math.min(0.25, toChest.y / planar))
        const dir = new Vector3(flat.x, slope, flat.z).normalize()
        charge.release(dir)
        hum.boom()
        sonicRelease(scene, from, dir, palette, { feet: feetNow() })
        pickAnimVariant(enemy.anims, "attack")?.play(false)
        playSoundNear(getAllSounds()?.sonicBoomS, from)
        shakeNear(scene, from)
        punchNear(scene, from)

        const charState = getCharState()
        const me = charState && data.targetId === charState.owner ? victim() : null
        let passed = false
        const flatPerUnit = Math.hypot(dir.x, dir.z) || 1
        const wave = flySonicWave(scene, {
            from, dir, speed: SONIC_SPEED, length: reach, halfWidth, groundAt: locked.groundAt, palette,
            onStep(before, along){
                // only the target's own client decides, once - as the front passes them
                if(!me?.body || passed || me.body.isDisposed() || isDead()) return
                const rel = me.body.position.subtract(from)
                const mine = rel.x * flat.x + rel.z * flat.z
                if(mine <= before || mine > along) return
                passed = true
                const lateral = Math.abs(rel.x * flat.z - rel.z * flat.x)
                const waveY = from.y + dir.y * (mine / flatPerUnit)
                const myFeet = feetOf(me)
                const landed = lateral <= halfWidth(mine) + SONIC_BODY && myFeet.y <= waveY + 0.6 && myFeet.y >= waveY - SONIC_HIT_HEIGHT
                // thrown on down the way it was going - from a point just
                // behind them - and the wave breaks up on them
                if(landed){
                    wave.breakUp()
                    return safely("the hit", () => landOnMe(me, data, details, myFeet.subtract(flat.scale(0.4))))
                }
                comicText(scene, "DODGED!", chestOf(me).add(new Vector3(0, 1.05, 0)), DODGED_COLOR)
            },
        })
    }
}

// the stone humming on its body: shuddering harder and harder, its colour
// throbbing through it faster and faster (an overlay on its own meshes); the
// boom kicks it back on its heels, white-hot for an instant. Its model is
// moved round its own place under the body (createEnemy.js's model root).
function humUp(enemy, palette){
    const scene = enemy.body.getScene()
    const root = modelRootOf(enemy)
    const base = root?.position.clone()
    const skins = (enemy.meshes ?? []).filter(mesh => !mesh.isDisposed() && mesh.isVisible)
    const place = (x, y, z) => {
        if(root && !root.isDisposed()) root.position.set(base.x + x, base.y + y, base.z + z)
    }
    const glow = (k, color) => skins.forEach(mesh => {
        // a blow's own white flash (meleeCombat.js) wins while it lasts
        if(mesh.isDisposed() || mesh._hitFlashUntil > performance.now()) return
        mesh.renderOverlay = k > 0.01
        mesh.overlayColor = color
        mesh.overlayAlpha = k
    })
    let kick = null
    function restore(){
        if(kick) scene.onBeforeRenderObservable.remove(kick)
        kick = null
        place(0, 0, 0)
        glow(0, palette.hot)
    }
    return {
        // t: 0..1 through the charge
        step(t){
            const shudder = 0.012 + 0.05 * t * t
            place((Math.random() - 0.5) * shudder * 2, (Math.random() - 0.5) * shudder, (Math.random() - 0.5) * shudder * 2)
            const throb = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * (8 + 42 * t))
            glow(0.12 + 0.42 * t * throb, palette.hot)
        },
        boom(){
            const at = performance.now()
            kick = scene.onBeforeRenderObservable.add(() => {
                const e = performance.now() - at
                if(e >= 480 || enemy.body.isDisposed()) return restore()
                // back on its heels, rocking forward again
                place(0, 0, -0.3 * Math.exp(-e / 110) * Math.cos(e / 55))
                glow(0.9 * Math.max(0, 1 - e / 280), e < 70 ? Color3.White() : palette.hot)
            })
        },
        restore,
    }
}

// the ground under the lane at (x, z): the openworld's own surface - or,
// anywhere else, a straight run from its feet to theirs
function groundFor(enemy, from, to){
    if(enemy.det.currentPlaceId === OPENWORLD_PLACE_ID) return (x, z) => openworldSurfaceY(x, z)
    const dx = to.x - from.x
    const dz = to.z - from.z
    const length2 = dx * dx + dz * dz
    return (x, z) => {
        const k = length2 > 0.0001 ? Math.max(0, Math.min(1, ((x - from.x) * dx + (z - from.z) * dz) / length2)) : 0
        return from.y + (to.y - from.y) * k
    }
}

// the boom's punch, felt by whoever's close - a quick zoom on top of the shake
function punchNear(scene, at, amount = 0.05){
    const me = getPlayersOnScene().find(pl => pl.owner === getCharState()?.owner)
    if(!me?.body || me.body.isDisposed()) return
    const near = 1 - planarDistance(me.body.position, at) / SHAKE_REACH
    if(near > 0) punchCameraFov(scene, amount * near)
}

// ── the fury cutters ─────────────────────────────────────────────────────────

// how many cutters it may throw - [fewest, most], within what CUTTER_FANS has
function cutterRange(details){
    const [fewest = 2, most = 3] = details.projectileDet?.slashes ?? []
    const clamp = n => Math.min(3, Math.max(2, Math.round(n) || 2))
    return [clamp(fewest), Math.max(clamp(fewest), clamp(most))]
}
// how many this throw has: what its target's client picked (watchRangeAttack),
// held to that range - anything else, the fewest
function cutterCount(data, details){
    const [fewest, most] = cutterRange(details)
    const n = Math.round(Number(data.slashes))
    return Number.isFinite(n) ? Math.min(most, Math.max(fewest, n)) : fewest
}

function furyCutters(enemy, data, details){
    const scene = enemy.body.getScene()
    const palette = darkSlashPalette(details.projectileDet.color)
    // the lanes are the boom's (effects/sonicBoom.js's sonicLane), in its light
    const lanePalette = { name: `darkslash.${palette.name}`, mid: palette.vein }
    const reach = (details.range ?? 15) * REACH_SLACK
    const halfWidth = along => CUTTER_HALF_WIDTH[0] + (CUTTER_HALF_WIDTH[1] - CUTTER_HALF_WIDTH[0]) * Math.min(1, Math.max(0, along) / reach)
    const count = cutterCount(data, details)
    const fan = CUTTER_FANS[count]
    const start = performance.now()
    const throwMs = CUTTER_CHARGE_MS + CUTTER_GAP_MS * (count - 1)
    const victim = () => getPlayersOnScene().find(pl => pl.owner === data.targetId)

    // it plants itself till its last cutter's away (renderer.js's chase skips
    // it meanwhile, and createEnemy's melee waits)
    enemy._channelingUntil = start + throwMs + 150
    findAnimVariants(enemy.anims, "running").forEach(anim => anim.stop())
    enemy.runSound?.stop?.()

    const height = enemy.det.bodyHeight ?? 1
    const width = enemy.det.bodyWidenes ?? 1
    const feetNow = () => enemy.body.position.add(new Vector3(0, -height / 2, 0))
    const centerNow = () => enemy.body.position.add(new Vector3(0, height * 0.15, 0))
    const charge = chargeDarkSlash(scene, { getCenter: centerNow, getFeet: feetNow, palette, ms: CUTTER_CHARGE_MS, radius: width * 0.8 })
    const coil = coilUp(enemy, palette)
    let locked = null
    let thrown = 0

    // only the target's own client decides, as each cutter passes them - and
    // once they've all gone by and none of them landed, they dodged it
    const charState = getCharState()
    const me = charState && data.targetId === charState.owner ? victim() : null
    let settled = 0
    let landed = 0
    // (a throw that fizzled out is marked settled past count - nothing to dodge)
    const settle = () => {
        if(++settled !== count || landed || !me?.body || me.body.isDisposed() || isDead()) return
        comicText(scene, "DODGED!", chestOf(me).add(new Vector3(0, 1.05, 0)), DODGED_COLOR)
    }

    const observer = scene.onBeforeRenderObservable.add(() => {
        // killed, bound, gone - whatever's still in it fizzles out (any
        // cutters already away fly on)
        if(enemy.isDead || enemy._disabled || enemy.body.isDisposed()) return stop(true)
        const t = performance.now() - start
        const target = victim()
        if(!locked && target?.body) face(enemy, target.body.position)
        if(!thrown) coil.step(Math.min(1, t / CUTTER_CHARGE_MS))
        if(!locked && t >= CUTTER_CHARGE_MS - CUTTER_LOCK_MS) safely("the lock", () => lock(target))
        // its lock never took - nothing to throw down
        if(!locked && t >= CUTTER_CHARGE_MS) return stop(true)
        while(locked && thrown < count && t >= CUTTER_CHARGE_MS + CUTTER_GAP_MS * thrown){
            const i = thrown++
            safely("a cutter", () => throwCutter(i))
        }
        if(thrown >= count) stop(false)
    })
    playSoundNear(getAllSounds()?.darkChargeS, enemy.body.position)
    let stopped = false
    function stop(fizzled){
        if(stopped) return
        stopped = true
        scene.onBeforeRenderObservable.remove(observer)
        enemy._channelingUntil = 0
        locked?.cutters.forEach(cutter => cutter.lane?.dispose())
        if(fizzled){
            charge.dispose({ fizzled: true })
            coil.restore()
            // never all thrown: never all there to dodge
            settled = count + 1
        } else charge.release()
    }

    // its lines: at them as they are now, fanned out round that - the lanes
    // light up along the ground
    function lock(target){
        const center = centerNow()
        const aim = target?.body && !target.body.isDisposed() ? feetOf(target) : ahead(enemy, reach * 0.6).addInPlace(new Vector3(0, -height / 2, 0))
        const line = new Vector3(aim.x - center.x, 0, aim.z - center.z)
        const distance = line.length()
        if(distance < 0.01) line.copyFrom(flatForward(enemy))
        else line.scaleInPlace(1 / distance)
        face(enemy, enemy.body.position.add(line))
        const mouth = new Vector3(center.x, 0, center.z).addInPlace(line.scale(width * 0.55))
        const groundAt = groundFor(enemy, feetNow(), aim)
        const laneLength = Math.min(reach, distance + CUTTER_LANE_PAST)
        locked = {
            mouth,
            groundAt,
            cutters: fan.map(({ yaw, roll }) => {
                const flat = turnFlat(line, (yaw * Math.PI) / 180)
                return { flat, roll: (roll * Math.PI) / 180, lane: sonicLane(scene, { from: mouth, dir: flat, length: laneLength, halfWidth, groundAt, palette: lanePalette }) }
            }),
        }
        charge.lock()
        playSoundNear(getAllSounds()?.darkGlintS, center)
    }

    function throwCutter(i){
        const cutter = locked.cutters[i]
        cutter.lane.dispose()
        cutter.lane = null
        const from = locked.mouth
        const front = centerNow().addInPlace(cutter.flat.scale(width * 0.5))
        coil.whip()
        slashRelease(scene, front, cutter.flat, palette, { feet: feetNow() })
        pickAnimVariant(enemy.anims, "attack")?.play(false)
        playSoundNear(getAllSounds()?.darkSlashS, front)
        shakeNear(scene, front, 0.28)
        punchNear(scene, front, 0.025)

        let passed = false
        let flight = null
        flight = flyDarkSlash(scene, {
            from, dir: cutter.flat, roll: cutter.roll, speed: CUTTER_SPEED, length: reach, groundAt: locked.groundAt, palette,
            onStep(before, along, middle){
                if(!me?.body || passed || me.body.isDisposed() || isDead()) return
                const rel = me.body.position.subtract(from)
                const mine = rel.x * cutter.flat.x + rel.z * cutter.flat.z
                if(mine <= before || mine > along) return
                passed = true
                const lateral = Math.abs(rel.x * cutter.flat.z - rel.z * cutter.flat.x)
                const myFeet = feetOf(me)
                const cut = lateral <= halfWidth(mine) + CUTTER_BODY && myFeet.y <= middle.y + 0.5 && myFeet.y >= middle.y - CUTTER_HIT_HEIGHT
                // it goes through them and flies on, flashing - and shoves
                // them on down the way it was going, from just behind them
                if(cut){
                    landed++
                    flight?.cut()
                    safely("the cut", () => landOnMe(me, data, details, myFeet.subtract(cutter.flat.scale(0.4)), { roll: cutter.roll }))
                }
                settle()
            },
            onEnd(){
                // it fell short of them, or nobody here was its target
                if(passed) return
                passed = true
                settle()
            },
        })
    }
}

// `flat` turned round the vertical by `angle`
function turnFlat(flat, angle){
    const c = Math.cos(angle), s = Math.sin(angle)
    return new Vector3(flat.x * c + flat.z * s, 0, flat.z * c - flat.x * s)
}

// the dark slime on its own body: coiling down and back as it draws itself
// in, its colour throbbing through it faster and faster (an overlay on its
// own meshes); each cutter it throws, it whips up tall and lunges after it,
// flashing white-hot. Its model is shaped round its own place under the body
// (createEnemy.js's model root).
function coilUp(enemy, palette){
    const scene = enemy.body.getScene()
    const root = modelRootOf(enemy)
    const baseScale = root?.scaling.clone()
    const basePosition = root?.position.clone()
    const skins = (enemy.meshes ?? []).filter(mesh => !mesh.isDisposed() && mesh.isVisible)
    const shape = (wide, tall, lunge = 0) => {
        if(!root || root.isDisposed()) return
        root.scaling.set(baseScale.x * wide, baseScale.y * tall, baseScale.z * wide)
        root.position.set(basePosition.x, basePosition.y, basePosition.z + lunge)
    }
    const glow = (k, color) => skins.forEach(mesh => {
        // a blow's own white flash (meleeCombat.js) wins while it lasts
        if(mesh.isDisposed() || mesh._hitFlashUntil > performance.now()) return
        mesh.renderOverlay = k > 0.01
        mesh.overlayColor = color
        mesh.overlayAlpha = k
    })
    let spring = null
    function restore(){
        if(spring) scene.onBeforeRenderObservable.remove(spring)
        spring = null
        shape(1, 1, 0)
        glow(0, palette.vein)
    }
    return {
        // t: 0..1 through the charge
        step(t){
            const wobble = Math.sin(performance.now() / 40) * 0.03 * t
            shape(1 + 0.16 * t + wobble, 1 - 0.2 * t - wobble, -0.12 * t)
            const throb = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * (6 + 30 * t))
            glow(0.1 + 0.4 * t * throb, palette.vein)
        },
        // a cutter away: up tall and thin, lunging after it, a jelly wobble
        whip(){
            if(spring) scene.onBeforeRenderObservable.remove(spring)
            const at = performance.now()
            spring = scene.onBeforeRenderObservable.add(() => {
                const e = performance.now() - at
                if(e >= 420 || enemy.body.isDisposed()) return restore()
                const k = Math.exp(-e / 90) * Math.cos(e / 38)
                shape(1 - 0.16 * k, 1 + 0.38 * k, 0.3 * Math.exp(-e / 110))
                glow(0.85 * Math.max(0, 1 - e / 220), e < 60 ? palette.core : palette.edge)
            })
        },
        restore,
    }
}

// ── a model flying at them (models/rangemodels/<name>.glb) ───────────────────

const SHOT_SPEED = 22            // units/s
const SHOT_HIT_RADIUS = 0.75
const STING_COLOR = new Color3(0.95, 0.55, 0.15)

// one hidden template per model and scene - each shot is an instance of it
const shotTemplates = new WeakMap()   // scene -> Map(modelName -> Promise<Mesh|null>)
function shotTemplate(scene, modelName){
    let byName = shotTemplates.get(scene)
    if(!byName) shotTemplates.set(scene, byName = new Map())
    if(byName.has(modelName)) return byName.get(modelName)
    const loading = LoadAssetContainerAsync(`./models/rangemodels/${modelName}.glb`, scene).then(container => {
        container.addAllToScene()
        const parts = container.meshes.filter(mesh => mesh.getTotalVertices() > 0)
        parts.forEach(mesh => {
            mesh.setParent(null)
            mesh.bakeCurrentTransformIntoVertices()
            // or its bounds stay where the bake moved it from
            mesh.refreshBoundingInfo()
        })
        const template = parts.length > 1 ? Mesh.MergeMeshes(parts, true, true, undefined, false, true) : parts[0]
        container.meshes.filter(mesh => mesh !== template && !mesh.isDisposed()).forEach(mesh => mesh.dispose())
        if(!template) return null
        template.name = `rangeshot.${modelName}`
        template.isVisible = false
        template.isPickable = false
        // the glb carries no colour of its own - a dark, glossy stinger
        if(!template.material?.diffuseTexture){
            const mat = new StandardMaterial(`rangeshot.${modelName}.mat`, scene)
            mat.diffuseColor = new Color3(0.13, 0.09, 0.05)
            mat.specularColor = new Color3(0.45, 0.38, 0.22)
            mat.specularPower = 48
            template.material = mat
        }
        return template
    }).catch(error => {
        console.warn(`[rangeAttack] ./models/rangemodels/${modelName}.glb didn't load`, error?.message ?? error)
        return null
    })
    byName.set(modelName, loading)
    return loading
}

async function shootModel(enemy, data, details){
    const scene = enemy.body.getScene()
    const template = await shotTemplate(scene, details.modelName)
    if(!template || enemy.isDead || enemy.body.isDisposed()) return
    const range = details.range ?? 15
    const victim = getPlayersOnScene().find(pl => pl.owner === data.targetId)
    const from = enemy.body.position.add(new Vector3(0, (enemy.det.bodyHeight ?? 1) * 0.25, 0))
    const aim = victim?.body ? chestOf(victim) : ahead(enemy, range)
    face(enemy, aim)
    pickAnimVariant(enemy.anims, "attack")?.play(false)

    const dir = aim.subtract(from).normalize()
    const shot = template.createInstance(`rangeshot.${details.modelName}`)
    shot.isPickable = false
    shot.position.copyFrom(from)
    shot.lookAt(from.add(dir))
    const isMine = !!victim && victim.owner === getCharState()?.owner
    const maxTravel = range * 1.3
    let travelled = 0
    const observer = scene.onBeforeRenderObservable.add(() => {
        const step = SHOT_SPEED * Math.min(scene.getEngine().getDeltaTime(), 50) / 1000
        shot.position.addInPlace(dir.scale(step))
        travelled += step
        const target = victim?.body && !victim.body.isDisposed() ? chestOf(victim) : null
        const struck = !!target && Vector3.Distance(shot.position, target) <= SHOT_HIT_RADIUS
        if(!struck && travelled < maxTravel) return
        scene.onBeforeRenderObservable.remove(observer)
        const at = shot.position.clone()
        shot.dispose()
        if(!struck) return
        playSoundNear(soundFor(details.soundWhenHit), at)
        sparkBurst(scene, at, STING_COLOR, { count: 18, power: 3, size: [0.08, 0.18], life: [0.2, 0.45] })
        // the damage only on the victim's own client
        if(isMine && !isDead()){
            deductHp(data.dmg ?? 1, data.effects ?? [])
            addCameraTrauma(scene, 0.3)
        }
    })
}

// ── small helpers ────────────────────────────────────────────────────────────

// runs one step of an attack, from inside a frame's observer: an exception
// there stops the engine queueing frames - the whole game would freeze on
// that frame. Logged instead, and the attack just ends there.
function safely(what, step){
    try {
        step()
    } catch(error){
        console.error(`[rangeAttack] ${what} failed`, error)
    }
}
function planarDistance(a, b){
    return Math.hypot(a.x - b.x, a.z - b.z)
}
function face(enemy, at){
    enemy.body.lookAt(new Vector3(at.x, enemy.body.position.y, at.z))
}
// which way it's facing, flat on the ground
function flatForward(enemy){
    const forward = enemy.body.getDirection(Vector3.Forward())
    forward.y = 0
    return forward.lengthSquared() > 0.0001 ? forward.normalize() : new Vector3(0, 0, 1)
}
// a point `distance` straight ahead of it, at its chest - nobody to aim at
function ahead(enemy, distance){
    const forward = enemy.body.getDirection(Vector3.Forward())
    forward.y = 0
    forward.normalize()
    return enemy.body.position.add(forward.scale(distance))
}
// a point off the network, if it is one
function toVector(point){
    return [point?.x, point?.y, point?.z].every(Number.isFinite) ? new Vector3(point.x, point.y, point.z) : null
}
