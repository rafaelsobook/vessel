import { Vector3, ParticleSystem, Color4, Color3, MeshBuilder, StandardMaterial } from "@babylonjs/core"
import { getCharState } from "./characterstate.js"
import { getPlayersOnScene, getEnemiesOnScene, getDuelOpponentsOnScene, getIsSocketOn } from "../sockets/worldsocket.js"
import { faceAttackTarget, markDashActive, lastHitEnemy } from "../controllers/inputMovement.js"
import { positionAtkCollider } from "./createMyCharacter.js"
import { capsuleHeight } from "./createcharacter.js"
import { emitFaceTarget } from "../sockets/emits.js"
import { getAllSounds, playSound } from "../components/soundSystem.js"
import { addCameraTrauma, punchCameraFov } from "../tools/cameraShake.js"
import { getParticleTexture, particleTexturePath } from "../tools/particlesystem.js"

// MELEE FEEL - what happens between pressing attack and the blow landing.
//
//  1. TARGET: the enemy the swing is meant for - in front of the avatar (a
//     cone, wider when they're right next to you), never behind. The enemy you
//     last hit keeps the lock while it's still in front of you, so a combo
//     stays on one enemy instead of hopping to whichever is nearest.
//  2. TURN + LUNGE: the avatar snaps round to face it, and if it's a step or
//     two away it lunges in - a quick hop forward that ends just in reach,
//     timed to arrive as the blade comes down. Already in reach: no lunge. No
//     target: no movement at all, the swing just plays where you face.
//  3. THE BLOW LANDS ON THE IMPACT FRAME, not the moment you press: the attack
//     box goes live when the striking hand/foot is moving fastest in that
//     clip (IMPACT_AT, measured off avatar.glb's own animation data), and only
//     for a short window. It used to be live from the first frame, so the hit
//     registered before the swing was even visible.
//  4. IMPACT (onMeleeConnect): hit-stop (attacker and victim freeze for a few
//     frames - Sakurai's hitlag, longer for heavier blows and crits), camera
//     shake + a small zoom punch (tools/cameraShake.js), the victim flashes
//     white, sparks fly from the point of contact, and the hit sound plays
//     right then instead of after the server's answer comes back.
//  5. A KILL (onMeleeKill) gets a heavier shake and a split second of slow
//     motion.

// how far into each clip the striking limb moves fastest - avatar.glb, hand.R
// for weapons and punches, foot.R for the kick
const IMPACT_AT = {
    punch1: 0.20, kick1: 0.28,
    swordattack1: 0.26, swordattack2: 0.31, swordattack_1_air: 0.68,
    axeattack1: 0.33, axeattack2: 0.34,
    spearattack1: 0.26, spearattack2: 0.29,
    staffattack1: 0.29, staffattack2: 0.23,
    running_sword1: 0.70, running_spear1: 0.25,
}
const DEFAULT_IMPACT_AT = 0.3
const HIT_WINDOW_BEFORE_MS = 40    // the box goes live this long before the impact frame...
const HIT_WINDOW_AFTER_MS = 110    // ...and stays live this long after it

// targeting - distances from my centre to the target's near side
const ACQUIRE_RANGE = 6            // further than this, nothing gets the lock
const IN_REACH = 1.15              // the attack box covers ~0.5-1.5 in front - no lunge needed
const STANDOFF = 0.85              // where a lunge stops: their near side this far in front
const LUNGE_MAX = { weapon: 4, fist: 3 }   // beyond this they're faced but not leapt at
const CONE_COS_NEAR = Math.cos(80 * Math.PI / 180)   // right next to me: almost beside me still counts
const CONE_COS_FAR = Math.cos(55 * Math.PI / 180)
const MAX_HEIGHT_DIFF = 2.5
const STICKY_MS = 5000             // how long the last enemy I hit keeps priority
const STICKY_BONUS = 1.2

// the lunge
const LUNGE_MIN_MS = 110
const LUNGE_MAX_MS = 280
const LUNGE_MAX_SPEED = 15         // m/s
const LUNGE_HOP = { far: 2.4, near: 1.3 }   // upward m/s - the little jump into the blow

// impact feel per weapon - trauma (0..1 shake), hitstop (ms frozen), fov (zoom punch, radians)
// (hit-stop around a tenth of a second - studies of 3D action games put the
// sweet spot at 0.1-0.2 s - heavier weapons longer, crits longer still)
const FEEL = {
    fist:    { trauma: 0.30, hitstopMs: 60, fov: 0.016 },
    sword:   { trauma: 0.42, hitstopMs: 85, fov: 0.024 },
    staff:   { trauma: 0.38, hitstopMs: 80, fov: 0.02 },
    spear:   { trauma: 0.44, hitstopMs: 88, fov: 0.024 },
    axe:     { trauma: 0.55, hitstopMs: 110, fov: 0.032 },
    pickaxe: { trauma: 0.55, hitstopMs: 110, fov: 0.032 },
}
const CRIT_EXTRA = { trauma: 0.3, hitstopMs: 55, fov: 0.02 }
const HITSTOP_SPEED = 0.03         // animation speed while frozen (0 would stop the clip's own clock)
const FLASH_MS = 75

const SKILL_FEEDBACK_GAP_MS = 140

let lastStruck = { body: null, at: 0 }
let lastFeedbackAt = 0
// the swing whose hit window is open right now - so a blow that catches three
// enemies at once shakes and freezes once, not three times over
let openSwing = null
let swingCounter = 0

// ── targeting ────────────────────────────────────────────────────────────────

function myPlayer(){
    const owner = getCharState()?.owner
    return owner ? getPlayersOnScene().find(pl => pl.owner === owner) : null
}

function candidates(){
    const list = []
    getEnemiesOnScene().forEach(enemy => {
        const body = enemy?.body
        if(!body || body.isDisposed() || enemy.isDead || (enemy.det?.hp ?? 1) <= 0) return
        list.push({ body, radius: (enemy.det?.bodyWidenes ?? 1) / 2, height: enemy.det?.bodyHeight ?? 1.6, enemy })
    })
    getDuelOpponentsOnScene().forEach(opponent => {
        const body = opponent?.body
        if(!body || body.isDisposed()) return
        list.push({ body, radius: 0.4, height: capsuleHeight })
    })
    return list
}

// the enemy this swing should go for, or null - see this file's header
export function findMeleeTarget(player, hasWeapon){
    if(!player?.body) return null
    const from = player.body.position
    const forward = player.body.getDirection(Vector3.Forward())
    forward.y = 0
    if(forward.lengthSquared() < 1e-6) return null
    forward.normalize()

    const stickyBody = lastHitEnemy?.body ?? (performance.now() - lastStruck.at < STICKY_MS ? lastStruck.body : null)
    const lungeMax = hasWeapon ? LUNGE_MAX.weapon : LUNGE_MAX.fist
    let best = null
    candidates().forEach(c => {
        const dx = c.body.position.x - from.x, dz = c.body.position.z - from.z
        if(Math.abs(c.body.position.y - from.y) > MAX_HEIGHT_DIFF + c.height / 2) return
        const dist = Math.hypot(dx, dz)
        const gap = Math.max(0, dist - c.radius)
        if(gap > ACQUIRE_RANGE) return
        const cos = dist < 1e-3 ? 1 : (dx * forward.x + dz * forward.z) / dist
        if(cos < (gap < IN_REACH + 0.3 ? CONE_COS_NEAR : CONE_COS_FAR)) return
        let score = gap + (1 - cos) * 3
        if(c.body === stickyBody) score -= STICKY_BONUS
        if(!best || score < best.score) best = { ...c, gap, dist, score }
    })
    if(best) best.canLunge = best.gap > IN_REACH && best.gap <= lungeMax
    return best
}

// ── the swing ────────────────────────────────────────────────────────────────

function clipSeconds(player, animName){
    const group = player.anims?.find(a => a.name.toLowerCase() === animName.toLowerCase())
    if(!group) return null
    const fps = group.targetedAnimations?.[0]?.animation?.framePerSecond ?? 60
    return (group.to - group.from) / fps
}

/**
 * Before the swing is sent: picks the target and turns toward it. Returns what
 * the attack relay should carry so everyone else sees the same turn and lunge:
 * { target, dirTarg, lunge: { to: {x, z}, ms } | null }.
 */
export function prepareMeleeSwing({ animName, speedRatio = 1, hasWeapon, airborne }){
    const player = myPlayer()
    if(!player) return { target: null, dirTarg: null, lunge: null, impactMs: 0 }

    const clip = clipSeconds(player, animName) ?? 0.8
    const impactMs = (IMPACT_AT[animName] ?? DEFAULT_IMPACT_AT) * clip / Math.max(0.2, speedRatio) * 1000

    const target = findMeleeTarget(player, hasWeapon)
    if(!target) return { target: null, dirTarg: null, lunge: null, impactMs }

    const tp = target.body.position
    faceAttackTarget(tp, impactMs + HIT_WINDOW_AFTER_MS + 40)
    showTargetRing(target)
    const dirTarg = { x: tp.x, y: player.body.position.y, z: tp.z }

    let lunge = null
    if(target.canLunge && !airborne){
        const travel = target.gap - STANDOFF
        const ms = Math.min(LUNGE_MAX_MS, Math.max(LUNGE_MIN_MS, impactMs - 30, travel / LUNGE_MAX_SPEED * 1000))
        const from = player.body.position
        const k = travel / Math.max(1e-3, target.dist)
        lunge = { to: { x: from.x + (tp.x - from.x) * k, z: from.z + (tp.z - from.z) * k }, ms, hop: target.gap > 2 ? LUNGE_HOP.far : LUNGE_HOP.near }
    }
    return { target, dirTarg, lunge, impactMs }
}

/**
 * After the swing's animation has started: runs the lunge and opens the hit
 * window on the impact frame. weaponType "fist" for a bare hand.
 */
export function startMeleeSwing(swing, { isRunningAttack = false, weaponType = "fist" } = {}){
    const player = myPlayer()
    if(!player) return
    const id = ++swingCounter
    const impactMs = swing.impactMs ?? 300

    if(swing.lunge && swing.target) runLunge(player, swing.target, swing.lunge)

    // the whoosh as the weapon actually starts moving, not on the button press
    if(weaponType !== "fist") setTimeout(() => playSound(getAllSounds()?.swordWhooshS), Math.max(0, impactMs - 120))

    const reach = weaponType === "spear" ? 1.25 : 1
    const lungeEnd = swing.lunge ? swing.lunge.ms + 60 : 0
    const openAt = Math.max(0, impactMs - HIT_WINDOW_BEFORE_MS)
    const closeAt = Math.max(impactMs + HIT_WINDOW_AFTER_MS, lungeEnd)
    setTimeout(() => {
        openSwing = { id, weaponType, landed: false }
        positionAtkCollider({ reach, isRunningAttack, activeMs: closeAt - openAt })
    }, openAt)
    setTimeout(() => { if(openSwing?.id === id) openSwing = null }, closeAt)
}

// Drives my body over the lunge: straight at the target (re-aimed every tick,
// it may be moving), a small hop up at the start, stopping the moment their
// near side is STANDOFF away or the time is up. Velocity, not one big
// impulse, so the distance comes out the same whatever the ground's friction.
function runLunge(player, target, lunge){
    const scene = player.body?.getScene()
    const body = player.aggregate?.body
    if(!scene || !body) return
    markDashActive(lunge.ms + 40)
    const start = performance.now()
    let first = true
    const observer = scene.onBeforePhysicsObservable.add(() => {
        const elapsed = performance.now() - start
        const me = player.body.position
        const tp = target.body.isDisposed() ? null : target.body.position
        const vel = body.getLinearVelocity()
        const toX = (tp?.x ?? lunge.to.x) - me.x, toZ = (tp?.z ?? lunge.to.z) - me.z
        const dist = Math.hypot(toX, toZ)
        const remaining = (tp ? dist - target.radius : dist) - (tp ? STANDOFF : 0)
        if(elapsed >= lunge.ms || remaining <= 0.05 || player.isDead){
            body.setLinearVelocity(new Vector3(0, Math.min(vel.y, 0.5), 0))
            scene.onBeforePhysicsObservable.remove(observer)
            // where I ended up, for everyone else (they tweened toward lunge.to)
            if(getIsSocketOn() && tp) emitFaceTarget(tp)
            return
        }
        const timeLeft = Math.max(0.03, (lunge.ms - elapsed) / 1000)
        const speed = Math.min(LUNGE_MAX_SPEED, remaining / timeLeft)
        const vy = first ? lunge.hop : vel.y
        first = false
        body.setLinearVelocity(new Vector3(toX / dist * speed, vy, toZ / dist * speed))
    })
    scene.onDisposeObservable.addOnce(() => scene.onBeforePhysicsObservable.remove(observer))
}

// Another player's lunge, on my screen: their body slides to where the lunge
// ends over the same time, easing out (attackingSystem.js's attack(), off the
// "player-attacked" relay).
export function playRemoteLunge(body, lunge){
    const scene = body?.getScene()
    if(!scene || !body || !lunge?.to) return
    const from = { x: body.position.x, z: body.position.z }
    const start = performance.now()
    const observer = scene.onBeforeRenderObservable.add(() => {
        if(body.isDisposed()) return scene.onBeforeRenderObservable.remove(observer)
        const t = Math.min(1, (performance.now() - start) / lunge.ms)
        const e = 1 - Math.pow(1 - t, 3)
        body.position.x = from.x + (lunge.to.x - from.x) * e
        body.position.z = from.z + (lunge.to.z - from.z) * e
        if(t >= 1) scene.onBeforeRenderObservable.remove(observer)
    })
}

// ── the blow lands ───────────────────────────────────────────────────────────

/**
 * Called the moment my swing's box touches something it hurts (createEnemy.js's
 * and duelSystem.js's atkCollider handlers).
 *  targetBody, targetMeshes (to flash), targetAnims (to freeze)
 *  isCritical, weaponType ("fist" bare-handed)
 *  outcome: "hit" | "immune" (a ghost shrugging off steel) | "blocked"
 *  isSkill: the box was a skill's (dashstrike) rather than a plain swing
 *  silent: the caller plays its own hit sound (duelSystem.js)
 */
export function onMeleeConnect({ targetBody, targetMeshes = [], targetAnims = [], isCritical = false, weaponType = "fist", outcome = "hit", isSkill = false, silent = false }){
    const scene = targetBody?.getScene()
    const player = myPlayer()
    if(!scene || !player || !targetBody || targetBody.isDisposed()) return

    const now = performance.now()
    lastStruck = { body: targetBody, at: now }
    const contact = contactPoint(player.body, targetBody)
    // one shake/freeze per blow: the first thing a swing hits gets it, anything
    // else the same swing catches only flashes and sparks. A skill's sweep
    // (dashstrike) has no swing of its own - spaced out by time instead, or a
    // dash through a pack would stutter through a freeze per enemy.
    const swing = openSwing
    const firstOfSwing = swing ? !swing.landed : now - lastFeedbackAt > SKILL_FEEDBACK_GAP_MS
    if(swing) swing.landed = true
    if(firstOfSwing) lastFeedbackAt = now

    if(outcome !== "hit"){
        // steel glancing off: a dull spark, a little jolt, no freeze, no flash
        sparks(scene, contact, false, true)
        if(firstOfSwing) addCameraTrauma(scene, 0.15)
        if(outcome === "immune" && !silent) playSound(getAllSounds()?.weaponblockS)
        return
    }

    const feel = FEEL[weaponType] ?? FEEL.sword
    const crit = isCritical ? CRIT_EXTRA : { trauma: 0, hitstopMs: 0, fov: 0 }
    const scale = isSkill ? 0.75 : 1

    flash(targetMeshes, isCritical)
    sparks(scene, contact, isCritical, false)
    if(firstOfSwing){
        // the view is thrown the way the blow travels: across the screen, a touch down
        const side = Math.random() < 0.5 ? -1 : 1
        addCameraTrauma(scene, (feel.trauma + crit.trauma) * scale, { x: side * 0.8, y: -0.35 })
        punchCameraFov(scene, (feel.fov + crit.fov) * scale)
        const attackAnim = player.characterAnimations?._activeAction
        hitstop([attackAnim, ...targetAnims].filter(Boolean), (feel.hitstopMs + crit.hitstopMs) * scale)
        if(!silent) playHitSound(weaponType, isCritical)
    }
}

/** My blow killed it (createEnemy.js's enemyIsHit, hp <= 0). */
export function onMeleeKill(){
    const scene = myPlayer()?.body?.getScene()
    if(!scene) return
    addCameraTrauma(scene, 0.35, { x: 0, y: -0.6 })
    punchCameraFov(scene, 0.03)
    slowMotion(scene, 0.35, 170)
}

function contactPoint(myBody, targetBody){
    const a = myBody.position, b = targetBody.position
    const dx = a.x - b.x, dz = a.z - b.z
    const len = Math.hypot(dx, dz) || 1
    // on the target's surface facing me, at my chest height
    const r = Math.min(0.6, len * 0.5)
    return new Vector3(b.x + dx / len * r, Math.max(a.y, b.y) + 0.15, b.z + dz / len * r)
}

function playHitSound(weaponType, isCritical){
    const sounds = getAllSounds()
    if(!sounds) return
    const byWeapon = { staff: sounds.staffS1, spear: sounds.spearS1, fist: sounds.punchedS }
    playSound(byWeapon[weaponType] ?? sounds.swordS1)
    // a crit lands with a second, meatier layer under it
    if(isCritical && weaponType !== "fist") playSound(sounds.punchedS)
}

// Attacker and victim hold still for a moment on contact. Only the clips that
// were frozen get their speed back, and only if nothing changed it meanwhile.
function hitstop(groups, ms){
    const frozen = []
    groups.forEach(group => {
        if(!group?.isPlaying) return
        const before = group.speedRatio
        group.speedRatio = before * HITSTOP_SPEED
        frozen.push([group, before, group.speedRatio])
    })
    if(!frozen.length) return
    setTimeout(() => frozen.forEach(([group, before, during]) => {
        if(group.speedRatio === during) group.speedRatio = before
    }), ms)
}

function flash(meshes, isCritical){
    const color = isCritical ? new Color3(1, 0.85, 0.4) : new Color3(1, 1, 1)
    const live = meshes.filter(mesh => mesh && !mesh.isDisposed() && mesh.isVisible)
    live.forEach(mesh => {
        mesh.overlayColor = color
        mesh.overlayAlpha = isCritical ? 0.75 : 0.55
        mesh.renderOverlay = true
        mesh._hitFlashUntil = performance.now() + FLASH_MS
    })
    setTimeout(() => live.forEach(mesh => {
        if(mesh.isDisposed() || performance.now() < mesh._hitFlashUntil - 5) return
        mesh.renderOverlay = false
    }), FLASH_MS)
}

let slowMoUntil = 0
function slowMotion(scene, timeScale, ms){
    const until = performance.now() + ms
    if(until <= slowMoUntil) return
    slowMoUntil = until
    scene.animationTimeScale = timeScale
    setTimeout(() => {
        if(scene.isDisposed || performance.now() < slowMoUntil - 5) return
        scene.animationTimeScale = 1
    }, ms)
}

// ── impact particles ─────────────────────────────────────────────────────────
// Two small systems per scene, reused for every hit: streaky sparks, and one
// big quick flare at the point of contact. Emitters are plain Vector3s (never a
// mesh) and the texture is the shared cached one, so nothing here ever
// disposes a texture other effects use.
let fx = null
function impactFx(scene){
    if(fx?.scene === scene) return fx
    const texture = getParticleTexture(scene, particleTexturePath("flare2"))

    const spark = new ParticleSystem("meleeSparks", 160, scene)
    spark.particleTexture = texture
    spark.emitter = new Vector3()
    spark.createSphereEmitter(0.08)
    spark.minSize = 0.03; spark.maxSize = 0.11
    spark.minLifeTime = 0.08; spark.maxLifeTime = 0.24
    spark.minEmitPower = 3; spark.maxEmitPower = 8
    spark.emitRate = 0
    spark.gravity = new Vector3(0, -12, 0)
    spark.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED
    spark.blendMode = ParticleSystem.BLENDMODE_ADD
    spark.color1 = new Color4(1, 0.92, 0.65, 1)
    spark.color2 = new Color4(1, 0.62, 0.25, 1)
    spark.colorDead = new Color4(1, 0.3, 0.05, 0)

    const burst = new ParticleSystem("meleeFlare", 8, scene)
    burst.particleTexture = texture
    burst.emitter = new Vector3()
    burst.minSize = 0.7; burst.maxSize = 1.0
    burst.minLifeTime = 0.06; burst.maxLifeTime = 0.09
    burst.minEmitPower = 0; burst.maxEmitPower = 0
    burst.emitRate = 0
    burst.blendMode = ParticleSystem.BLENDMODE_ADD
    burst.color1 = new Color4(1, 1, 1, 0.9)
    burst.color2 = new Color4(1, 0.95, 0.8, 0.8)
    burst.colorDead = new Color4(1, 0.9, 0.7, 0)

    fx = { scene, spark, burst }
    scene.onDisposeObservable.addOnce(() => {
        if(fx?.scene === scene) fx = null
        spark.dispose(false)
        burst.dispose(false)
    })
    return fx
}

function sparks(scene, at, big, dull){
    const { spark, burst } = impactFx(scene)
    spark.emitter.copyFrom(at)
    spark.color1 = dull ? new Color4(0.85, 0.9, 1, 1) : new Color4(1, 0.92, 0.65, 1)
    spark.manualEmitCount = dull ? 8 : big ? 30 : 16
    spark.start()
    if(dull) return
    burst.emitter.copyFrom(at)
    burst.minSize = big ? 1.1 : 0.7
    burst.maxSize = big ? 1.5 : 1.0
    burst.manualEmitCount = 1
    burst.start()
}

// ── the lock-on ring ─────────────────────────────────────────────────────────
// A thin ring on the ground under whatever the swing just locked onto, fading
// out over a moment - so it's clear which enemy the attack is going for.
const RING_MS = 900
let ring = null
function showTargetRing(target){
    const scene = target.body.getScene()
    if(!scene) return
    if(ring?.scene !== scene){
        const mesh = MeshBuilder.CreateTorus("meleeTargetRing", { diameter: 1, thickness: 0.05, tessellation: 40 }, scene)
        const mat = new StandardMaterial("meleeTargetRingMat", scene)
        mat.emissiveColor = new Color3(1, 0.35, 0.2)
        mat.disableLighting = true
        mat.alpha = 0.85
        mesh.material = mat
        mesh.isPickable = false
        mesh.isVisible = false
        ring = { scene, mesh, mat, target: null, until: 0, observer: null }
        ring.observer = scene.onBeforeRenderObservable.add(() => {
            const r = ring
            if(!r?.target || r.mesh.isDisposed()) return
            const left = r.until - performance.now()
            if(left <= 0 || r.target.body.isDisposed()){
                r.mesh.isVisible = false
                r.target = null
                return
            }
            const p = r.target.body.position
            r.mesh.position.set(p.x, p.y - r.target.height / 2 + 0.04, p.z)
            r.mat.alpha = 0.85 * Math.min(1, left / 300)
        })
        scene.onDisposeObservable.addOnce(() => { if(ring?.scene === scene) ring = null })
    }
    const size = Math.max(0.9, target.radius * 2 + 0.5)
    ring.mesh.scaling.set(size, 1, size)
    ring.target = target
    ring.until = performance.now() + RING_MS
    ring.mesh.isVisible = true
}
