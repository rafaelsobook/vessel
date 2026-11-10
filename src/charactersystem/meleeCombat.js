import { Vector3, ParticleSystem, DynamicTexture, Color4, Color3, MeshBuilder, StandardMaterial, PhysicsMotionType } from "@babylonjs/core"
import { getCharState } from "./characterstate.js"
import { getPlayersOnScene, getEnemiesOnScene, getDuelOpponentsOnScene, getIsSocketOn } from "../sockets/worldsocket.js"
import { faceAttackTarget, markDashActive, lastHitEnemy } from "../controllers/inputMovement.js"
import { positionAtkCollider } from "./createMyCharacter.js"
import { capsuleHeight } from "./createcharacter.js"
import { emitFaceTarget } from "../sockets/emits.js"
import { getAllSounds, playSound } from "../components/soundSystem.js"
import { addCameraTrauma, punchCameraFov } from "../tools/cameraShake.js"
import { getFirstPersonView } from "../tools/camera.js"
import { swingFirstPersonWeapon } from "../effects/fpWeapon.js"
import { getParticleTexture, particleTexturePath } from "../tools/particlesystem.js"

// MELEE FEEL - what happens between pressing attack and the blow landing.
//
//  1. TARGET: the enemy the swing is meant for - in front of the avatar (a
//     cone, wider when they're right next to you), never behind. The enemy you
//     last hit keeps the lock while it's still in front of you, so a combo
//     stays on one enemy instead of hopping to whichever is nearest.
//  2. TURN + LUNGE: the avatar snaps round to face it, and if it's a step or
//     two away it lunges in - a quick hop forward that ends just in reach,
//     timed to arrive as the blade comes down. With a weapon in hand the
//     lunge is the jump attack (LUNGE_ANIM) rather than the combo's own
//     swing, and it reaches 10 m: it is the FIRST swing at an enemy that is
//     off that dashes in, and the swings after it, already in reach, are the
//     combo. A long dash runs in first and leaps at the end - the clip is
//     started late enough that its strike lands as the dash does. Already in
//     reach: no lunge. No target: no movement at all, the swing just plays
//     where you face.
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
    // measured the same way (hand.R's fastest frame, less the ~0.03 this
    // method reads high on the clips above): it starts in the air, blade
    // overhead, strikes early and has touched down by about 65%
    weaponjumpattack: 0.42,
}
const DEFAULT_IMPACT_AT = 0.3
// the clip a weapon swing plays when it lunges (avatar.glb)
const LUNGE_ANIM = "weaponjumpattack"
const HIT_WINDOW_BEFORE_MS = 40    // the box goes live this long before the impact frame...
const HIT_WINDOW_AFTER_MS = 110    // ...and stays live this long after it

// targeting - distances from my centre to the target's near side
const ACQUIRE_RANGE = 6            // further than this, nothing gets the lock (a weapon's lunge reaches further, and its lock with it)
const IN_REACH = 1.15              // the attack box covers ~0.5-1.5 in front - no lunge needed
const STANDOFF = 0.85              // where a lunge stops: their near side this far in front
const LUNGE_MAX = { weapon: 10, fist: 3 }  // beyond this they're faced but not leapt at
// what a weapon's lunge used to reach. Past it the lunge is a long run in a
// straight line: the cone narrows (coneCosFor) and the way has to be clear
// (pathIsClear)
const LONG_LUNGE_FROM = 4
const CONE_COS_NEAR = Math.cos(80 * Math.PI / 180)   // right next to me: almost beside me still counts
const CONE_COS_FAR = Math.cos(55 * Math.PI / 180)
const CONE_COS_LONG = Math.cos(35 * Math.PI / 180)   // at the far end of a weapon's lunge
const MAX_HEIGHT_DIFF = 2.5
const STICKY_MS = 5000             // how long the last enemy I hit keeps priority
const STICKY_BONUS = 1.2
// pathIsClear: the ray's height off my centre (my centre is about 0.75 up, so
// this is about knee height - low rocks and rises count), and how far short of
// the target a hit still counts as in the way
const PATH_RAY_LIFT = -0.3
const PATH_CLEAR_MARGIN = 0.4

// the lunge
const LUNGE_MIN_MS = 110
const LUNGE_MAX_MS = 480
const LUNGE_PACE = 15              // m/s - what a lunge is timed at, as every short one always was
const LUNGE_GRACE_MS = 150        // a hitching frame mid-dash leaves a long one short of its target - it runs this much past its time, flat out, to make it up
const LUNGE_MAX_SPEED = 22         // m/s - the most it will run at, which only a dash over ~7 m needs: at the pace it would take longer than LUNGE_MAX_MS
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
    // the heaviest swing there is - it lands with a thud
    hammer:  { trauma: 0.68, hitstopMs: 135, fov: 0.04 },
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

// how wide the cone in front of me is at this gap, as the cosine of its half
// angle: wide right next to me, narrower further out - and for a weapon's long
// lunge narrower still, or a swing would turn me round and send me across the
// field after something well off to the side
function coneCosFor(gap, hasWeapon){
    if(gap < IN_REACH + 0.3) return CONE_COS_NEAR
    if(!hasWeapon || gap <= LONG_LUNGE_FROM) return CONE_COS_FAR
    const t = Math.min(1, (gap - LONG_LUNGE_FROM) / (LUNGE_MAX.weapon - LONG_LUNGE_FROM))
    return CONE_COS_FAR + (CONE_COS_LONG - CONE_COS_FAR) * t
}

// Whether nothing solid stands between me and the target. A long lunge runs
// in a straight line, and would stop dead against a tree, a wall, or a rise in
// the ground. Level at about knee height, centre to centre; only static bodies
// count - another player in the way is something to push past, not a wall.
function pathIsClear(player, target){
    const physics = player.body.getScene()?.getPhysicsEngine?.()
    if(!physics) return true
    const from = player.body.position.clone()
    const to = target.body.position.clone()
    from.y += PATH_RAY_LIFT
    to.y += PATH_RAY_LIFT
    const length = Vector3.Distance(from, to)
    const query = player.aggregate?.body ? { ignoreBody: player.aggregate.body } : undefined
    const hit = physics.raycast(from, to, query)
    if(!hit?.hasHit || hit.body?.getMotionType?.() !== PhysicsMotionType.STATIC) return true
    // the target's own side doesn't count - it may stand against something
    return hit.hitDistance >= length - target.radius - PATH_CLEAR_MARGIN
}

// the enemy this swing should go for, or null - see this file's header
// aimForward: the way to look instead of the body's own facing (first person:
// the view's - see prepareMeleeSwing)
export function findMeleeTarget(player, hasWeapon, aimForward = null){
    if(!player?.body) return null
    const from = player.body.position
    const forward = aimForward ? aimForward.clone() : player.body.getDirection(Vector3.Forward())
    forward.y = 0
    if(forward.lengthSquared() < 1e-6) return null
    forward.normalize()

    const stickyBody = lastHitEnemy?.body ?? (performance.now() - lastStruck.at < STICKY_MS ? lastStruck.body : null)
    const lungeMax = hasWeapon ? LUNGE_MAX.weapon : LUNGE_MAX.fist
    // a weapon's lunge reaches further than the lock used to, and takes it along
    const acquire = hasWeapon ? Math.max(ACQUIRE_RANGE, lungeMax) : ACQUIRE_RANGE
    let best = null
    candidates().forEach(c => {
        const dx = c.body.position.x - from.x, dz = c.body.position.z - from.z
        if(Math.abs(c.body.position.y - from.y) > MAX_HEIGHT_DIFF + c.height / 2) return
        const dist = Math.hypot(dx, dz)
        const gap = Math.max(0, dist - c.radius)
        if(gap > acquire) return
        const cos = dist < 1e-3 ? 1 : (dx * forward.x + dz * forward.z) / dist
        if(cos < coneCosFor(gap, hasWeapon)) return
        let score = gap + (1 - cos) * 3
        if(c.body === stickyBody) score -= STICKY_BONUS
        if(!best || score < best.score) best = { ...c, gap, dist, score }
    })
    if(best){
        best.canLunge = best.gap > IN_REACH && best.gap <= lungeMax
        if(best.canLunge && best.gap > LONG_LUNGE_FROM && !pathIsClear(player, best)){
            best.canLunge = false
            // past the old lock range there is nothing worth turning for
            if(best.gap > ACQUIRE_RANGE) return null
        }
    }
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
 * { target, dirTarg, lunge: { to: {x, z}, ms } | null, impactMs, animName,
 * clipDelayMs } - animName being the clip to play, which is not the one asked
 * for when the swing lunges (a weapon's jump attack, LUNGE_ANIM), and
 * clipDelayMs how long into the lunge that clip starts (0 for a short one).
 * impactMs is from the press to the blow landing, the delay included.
 */
export function prepareMeleeSwing({ animName, speedRatio = 1, hasWeapon, airborne }){
    const player = myPlayer()
    if(!player) return { target: null, dirTarg: null, lunge: null, impactMs: 0, animName, clipDelayMs: 0 }

    // first person (tools/camera.js - the grotto mazes): the swing goes for
    // what I'm looking at, and with nothing there it still turns me that way -
    // the body may face wherever I last walked, and the blade swung out of view
    const view = getFirstPersonView()
    const target = findMeleeTarget(player, hasWeapon, view?.flat)
    const swingInView = ms => { if(view && hasWeapon) swingFirstPersonWeapon(ms) }
    const lunges = !!target?.canLunge && !airborne
    // the jump attack, but only where the rig has it - and not bare-handed, a
    // punch has no blade to bring down
    if(lunges && hasWeapon && clipSeconds(player, LUNGE_ANIM)) animName = LUNGE_ANIM

    const clip = clipSeconds(player, animName) ?? 0.8
    let impactMs = (IMPACT_AT[animName] ?? DEFAULT_IMPACT_AT) * clip / Math.max(0.2, speedRatio) * 1000

    if(!target){
        if(!view) return { target: null, dirTarg: null, lunge: null, impactMs, animName, clipDelayMs: 0 }
        const from = player.body.position
        const ahead = { x: from.x + view.flat.x * 2, y: from.y, z: from.z + view.flat.z * 2 }
        faceAttackTarget(ahead, impactMs + HIT_WINDOW_AFTER_MS + 40)
        swingInView(impactMs)
        // everyone else sees me turn that way too (attackingSystem.js's attack)
        return { target: null, dirTarg: ahead, lunge: null, impactMs, animName, clipDelayMs: 0 }
    }

    const tp = target.body.position
    const dirTarg = { x: tp.x, y: player.body.position.y, z: tp.z }

    let lunge = null
    let clipDelayMs = 0
    if(lunges){
        const travel = target.gap - STANDOFF
        const ms = Math.min(LUNGE_MAX_MS, Math.max(LUNGE_MIN_MS, impactMs - 30, travel / LUNGE_PACE * 1000))
        const from = player.body.position
        const k = travel / Math.max(1e-3, target.dist)
        lunge = { to: { x: from.x + (tp.x - from.x) * k, z: from.z + (tp.z - from.z) * k }, ms, hop: target.gap > 2 ? LUNGE_HOP.far : LUNGE_HOP.near }
        // the jump attack is a leap onto them, so its blow comes as the lunge
        // ends: a long dash runs in first and the clip starts late enough to
        // land with it (attackingSystem.js's attack() holds it back; the
        // run-up is renderer.js's). A short one is over before the clip's own
        // blow comes, and starts it at once
        if(animName === LUNGE_ANIM){
            clipDelayMs = Math.max(0, Math.round(ms - impactMs))
            impactMs += clipDelayMs
        }
    }
    faceAttackTarget(tp, impactMs + HIT_WINDOW_AFTER_MS + 40)
    swingInView(impactMs)
    showTargetRing(target)
    lockOn(target)
    return { target, dirTarg, lunge, impactMs, animName, clipDelayMs }
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
        if(elapsed >= lunge.ms + LUNGE_GRACE_MS || remaining <= 0.05 || player.isDead){
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
    // easing out is right for a hop of a step or two, but over a long dash it
    // would cover most of the way in the first frames and then crawl - those run
    // at an even pace, as the lunge itself does on the screen it began on
    const long = Math.min(1, Math.max(0, (Math.hypot(lunge.to.x - from.x, lunge.to.z - from.z) - LONG_LUNGE_FROM + 1) / 3))
    const observer = scene.onBeforeRenderObservable.add(() => {
        if(body.isDisposed()) return scene.onBeforeRenderObservable.remove(observer)
        const t = Math.min(1, (performance.now() - start) / lunge.ms)
        const e = (1 - Math.pow(1 - t, 3)) * (1 - long) + t * long
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
        hitEffect(scene, contact, player.body.position, { weaponType, dull: true })
        if(firstOfSwing) addCameraTrauma(scene, 0.15)
        if(outcome === "immune" && !silent) playSound(getAllSounds()?.weaponblockS)
        return
    }

    const feel = FEEL[weaponType] ?? FEEL.sword
    const crit = isCritical ? CRIT_EXTRA : { trauma: 0, hitstopMs: 0, fov: 0 }
    const scale = isSkill ? 0.75 : 1

    flash(targetMeshes, isCritical)
    hitEffect(scene, contact, player.body.position, { weaponType, isCritical, isSkill })
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

/** My blow killed it (createEnemy.js's enemyIsHit, hp <= 0). `at`: where it stood. */
export function onMeleeKill(at){
    const scene = myPlayer()?.body?.getScene()
    if(!scene) return
    if(at) killEffect(scene, at)
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
    const byWeapon = { staff: sounds.staffS1, spear: sounds.spearS1, hammer: sounds.hammerS1, fist: sounds.punchedS }
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

// everything animated slowed to timeScale for `ms` - a heavy hit's hitstop
// (here, and effects/scorch.js's fireball blast)
let slowMoUntil = 0
export function slowMotion(scene, timeScale, ms){
    const until = performance.now() + ms
    if(until <= slowMoUntil) return
    slowMoUntil = until
    scene.animationTimeScale = timeScale
    setTimeout(() => {
        if(scene.isDisposed || performance.now() < slowMoUntil - 5) return
        scene.animationTimeScale = 1
    }, ms)
}

// ── impact effect ────────────────────────────────────────────────────────────
// A hit is four small layers, each with one job, all over within ~0.3 s - the
// usual recipe for a hit that reads clearly without turning into fireworks (a
// few simple layers beat one big effect; the loudest layers are kept for crits
// and kills):
//   1. STAR   - a bright four-point hit-spark at the contact point: the "it
//               landed" flash. Peaks in the first ~0.05 s.
//   2. SPARKS - a fan of short streaks thrown off the way the blow travelled,
//               spread across the screen so they read from behind the avatar.
//   3. SLASH  - a thin curved flash through the contact point, tilted one way
//               then the other swing by swing (weapons only, not fists).
//   4. RING   - a thin ring that opens out and fades (crits and kills only).
// The systems and their textures are made once per scene and reused. Every size
// is scaled by how far the camera is zoomed out, so a hit is the same size on
// screen at any zoom, and the star is nudged towards the camera so the enemy's
// own body doesn't cut half of it off.
const WARM = { bright: [1, 0.95, 0.75], hot: [1, 0.68, 0.28], dead: [1, 0.35, 0.08], star: [1, 0.92, 0.66] }
const GOLD = { bright: [1, 0.92, 0.5], hot: [1, 0.62, 0.15], dead: [1, 0.3, 0.05], star: [1, 0.85, 0.4] }
const COOL = { bright: [0.88, 0.95, 1], hot: [0.55, 0.75, 1], dead: [0.3, 0.5, 1], star: [0.8, 0.9, 1] }
// per weapon: how big the star is, how many sparks, how long the slash is (0 =
// none), and its colours. Sizes are in "camera-scaled units" (see hitEffect):
// one is about a sixth of the screen's height, so a sword's star comes out near
// a tenth of the screen and its slash a sixth - a hit you notice, not a blast.
const WEAPON_FX = {
    fist:    { star: 0.45, sparks: 6,  slash: 0,    colors: WARM },
    sword:   { star: 0.6,  sparks: 10, slash: 1.0,  colors: WARM },
    staff:   { star: 0.55, sparks: 8,  slash: 0.85, colors: COOL },
    spear:   { star: 0.55, sparks: 9,  slash: 1.2,  colors: WARM },
    axe:     { star: 0.7,  sparks: 12, slash: 1.2,  colors: WARM },
    pickaxe: { star: 0.7,  sparks: 12, slash: 1.2,  colors: WARM },
    hammer:  { star: 0.85, sparks: 14, slash: 0.9,  colors: WARM },
}
const rgba = (c, a = 1) => new Color4(c[0], c[1], c[2], a)

function drawTexture(scene, name, size, draw){
    const texture = new DynamicTexture(name, size, scene, true)
    const ctx = texture.getContext()
    ctx.clearRect(0, 0, size, size)
    draw(ctx, size)
    texture.hasAlpha = true
    texture.update()
    return texture
}

// a soft glow with four thin rays - long up/down/left/right, short on the diagonals
function starTexture(scene){
    return drawTexture(scene, "meleeStar", 128, (ctx, s) => {
        const c = s / 2
        const glow = ctx.createRadialGradient(c, c, 0, c, c, c * 0.55)
        glow.addColorStop(0, "rgba(255,255,255,1)")
        glow.addColorStop(0.35, "rgba(255,240,200,0.55)")
        glow.addColorStop(1, "rgba(255,220,150,0)")
        ctx.fillStyle = glow
        ctx.fillRect(0, 0, s, s)
        ctx.fillStyle = "rgba(255,255,255,1)"
        const ray = (angle, length, width) => {
            ctx.save()
            ctx.translate(c, c)
            ctx.rotate(angle)
            ctx.beginPath()
            ctx.moveTo(-length, 0); ctx.lineTo(0, -width); ctx.lineTo(length, 0); ctx.lineTo(0, width)
            ctx.closePath()
            ctx.fill()
            ctx.restore()
        }
        ray(0, c * 0.98, 3.2)
        ray(Math.PI / 2, c * 0.98, 3.2)
        ray(Math.PI / 4, c * 0.55, 2.2)
        ray(-Math.PI / 4, c * 0.55, 2.2)
    })
}

// a curved blade of light: points at both ends, thickest in the middle
function slashTexture(scene){
    return drawTexture(scene, "meleeSlash", 256, (ctx, s) => {
        const c = s / 2
        ctx.beginPath()
        ctx.moveTo(8, c + 22)
        ctx.quadraticCurveTo(c, c - 46, s - 8, c + 22)
        ctx.quadraticCurveTo(c, c - 14, 8, c + 22)
        ctx.closePath()
        const along = ctx.createLinearGradient(0, 0, s, 0)
        along.addColorStop(0, "rgba(255,255,255,0)")
        along.addColorStop(0.3, "rgba(255,255,255,1)")
        along.addColorStop(0.7, "rgba(255,255,255,1)")
        along.addColorStop(1, "rgba(255,255,255,0)")
        ctx.fillStyle = along
        ctx.shadowColor = "rgba(255,240,200,0.9)"
        ctx.shadowBlur = 10
        ctx.fill()
    })
}

function ringTexture(scene){
    return drawTexture(scene, "meleeRing", 128, (ctx, s) => {
        ctx.strokeStyle = "rgba(255,255,255,1)"
        ctx.lineWidth = 5
        ctx.shadowColor = "rgba(255,255,255,0.8)"
        ctx.shadowBlur = 6
        ctx.beginPath()
        ctx.arc(s / 2, s / 2, s / 2 - 12, 0, Math.PI * 2)
        ctx.stroke()
    })
}

// a particle system that only ever fires on request: starts exactly at its
// emitter, lifetimes in real seconds (updateSpeed 1/60 - Babylon's default
// 0.01 runs a lifetime of 1 at about 1.7 s)
function oneShot(scene, name, capacity, texture){
    const system = new ParticleSystem(name, capacity, scene)
    system.particleTexture = texture
    system.emitter = new Vector3()
    system.createPointEmitter(Vector3.Zero(), Vector3.Zero())
    system.emitRate = 0
    system.minEmitPower = system.maxEmitPower = 0
    system.updateSpeed = 1 / 60
    system.blendMode = ParticleSystem.BLENDMODE_ADD
    return system
}

const _toCam = new Vector3()

// Two of each layer, so a swing that catches two enemies in the same frame
// doesn't have the second hit take over the first one's emission (a system
// only fires on its next update, with whatever it was last set to).
const pair = make => [make(), make()]
const take = systems => systems.find(system => system.manualEmitCount <= 0) ?? systems[1]

let fx = null
function impactFx(scene){
    if(fx?.scene === scene) return fx
    const sparkTexture = getParticleTexture(scene, particleTexturePath("flare2"))
    const textures = { star: starTexture(scene), slash: slashTexture(scene), ring: ringTexture(scene) }

    const sparks = pair(() => {
        const system = oneShot(scene, "meleeSparks", 160, sparkTexture)
        system.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED
        system.gravity = new Vector3(0, -9, 0)
        system.minLifeTime = 0.12; system.maxLifeTime = 0.26
        // where this hit's sparks are headed: mostly the way the blow
        // travelled, fanned out across the screen and a little upward - or,
        // for a kill, in every direction
        const fan = system.fan = { blow: new Vector3(0, 0, 1), right: new Vector3(1, 0, 0), radial: false }
        system.startDirectionFunction = (_matrix, direction) => {
            if(fan.radial){
                direction.set(Math.random() * 2 - 1, Math.random() * 0.9 + 0.1, Math.random() * 2 - 1)
            } else {
                const along = 0.55 + Math.random() * 0.45
                const across = (Math.random() * 2 - 1) * 0.95
                const lift = Math.random() * 0.9 - 0.15
                direction.set(
                    fan.blow.x * along + fan.right.x * across,
                    lift,
                    fan.blow.z * along + fan.right.z * across)
            }
            direction.normalize()
        }
        return system
    })

    const stars = pair(() => {
        const system = oneShot(scene, "meleeStar", 4, textures.star)
        system.minLifeTime = 0.1; system.maxLifeTime = 0.12
        system.minInitialRotation = 0; system.maxInitialRotation = Math.PI / 2
        // pops in fast, then thins out
        system.addSizeGradient(0, 0.5).addSizeGradient(0.2, 1).addSizeGradient(1, 0.4)
        return system
    })

    const slashes = pair(() => {
        const system = oneShot(scene, "meleeSlash", 4, textures.slash)
        system.minLifeTime = 0.11; system.maxLifeTime = 0.13
        system.addSizeGradient(0, 0.6).addSizeGradient(0.25, 1).addSizeGradient(1, 0.9)
        return system
    })

    const rings = pair(() => {
        const system = oneShot(scene, "meleeRing", 4, textures.ring)
        system.minLifeTime = 0.17; system.maxLifeTime = 0.2
        system.addSizeGradient(0, 0.25).addSizeGradient(1, 1)
        return system
    })

    fx = { scene, sparks, stars, slashes, rings, slashFlip: 1 }
    scene.onDisposeObservable.addOnce(() => {
        if(fx?.scene === scene) fx = null
        // the sparks' texture is the shared cached one; the others are ours
        ;[...sparks, ...stars, ...slashes, ...rings].forEach(system => system.dispose(!sparks.includes(system)))
    })
    return fx
}

function setScale(system, scale){
    system.minScaleX = system.maxScaleX = system.minScaleY = system.maxScaleY = scale
}

// One hit's effect at `at` (the contact point). from: where I stand, for which
// way the blow went. opts: weaponType, isCritical, isSkill, dull (a block or a
// ghost shrugging it off - just a few cool sparks).
function hitEffect(scene, at, from, { weaponType = "fist", isCritical = false, isSkill = false, dull = false } = {}){
    const layers = impactFx(scene)
    const spark = take(layers.sparks)
    const camera = scene.activeCamera
    const k = camera?.radius ? Math.min(2.4, Math.max(0.8, camera.radius / 7)) : 1
    const look = WEAPON_FX[weaponType] ?? WEAPON_FX.sword
    const colors = dull ? COOL : isCritical ? GOLD : look.colors
    const power = isSkill ? 0.8 : 1

    // the way the blow travelled, flat; the camera's right for fanning across the screen
    let bx = at.x - from.x, bz = at.z - from.z
    const blen = Math.hypot(bx, bz) || 1
    spark.fan.blow.set(bx / blen, 0, bz / blen)
    if(camera) camera.getDirection(Vector3.Right()).normalizeToRef(spark.fan.right)
    spark.fan.radial = false

    // the sparks
    spark.emitter.copyFrom(at)
    spark.color1 = rgba(colors.bright)
    spark.color2 = rgba(colors.hot)
    spark.colorDead = rgba(colors.dead, 0)
    spark.minEmitPower = 3 * k; spark.maxEmitPower = 6.5 * k
    // BILLBOARDMODE_STRETCHED: scale X is the streak's width, scale Y its length
    spark.minScaleX = 0.06 * k; spark.maxScaleX = 0.11 * k
    spark.minScaleY = 0.35 * k; spark.maxScaleY = 0.8 * k
    spark.minSize = spark.maxSize = 1
    const count = dull ? 6 : Math.round(look.sparks * (isCritical ? 1.8 : 1) * power)
    spark.manualEmitCount = count
    spark.start()
    if(dull) return

    // the rest sit a little towards the camera
    if(camera) camera.globalPosition.subtractToRef(at, _toCam).normalize()
    const front = at.add(_toCam.scale(0.3 * k))

    const star = take(layers.stars)
    star.emitter.copyFrom(front)
    star.color1 = rgba([1, 1, 1]); star.color2 = rgba(colors.star)
    star.colorDead = rgba(colors.star, 0)
    setScale(star, look.star * (isCritical ? 1.4 : 1) * power * k)
    star.manualEmitCount = 1
    star.start()

    if(look.slash){
        const slash = take(layers.slashes)
        const s = layers.slashFlip = -layers.slashFlip
        slash.emitter.copyFrom(front)
        slash.color1 = rgba([1, 1, 1], 0.95); slash.color2 = rgba(colors.star, 0.9)
        slash.colorDead = rgba(colors.star, 0)
        slash.minInitialRotation = slash.maxInitialRotation = s * (0.5 + Math.random() * 0.3)
        setScale(slash, look.slash * (isCritical ? 1.2 : 1) * power * k)
        slash.manualEmitCount = 1
        slash.start()
    }

    if(isCritical) ringAt(scene, front, k, 1.1, colors)
}

function ringAt(scene, at, k, size, colors){
    const ring = take(impactFx(scene).rings)
    ring.emitter.copyFrom(at)
    ring.color1 = rgba([1, 1, 1], 0.85); ring.color2 = rgba(colors.star, 0.8)
    ring.colorDead = rgba(colors.star, 0)
    setScale(ring, size * k)
    ring.manualEmitCount = 1
    ring.start()
}

// A kill: a ring and a small burst in every direction from where it stood.
function killEffect(scene, at){
    const spark = take(impactFx(scene).sparks)
    const camera = scene.activeCamera
    const k = camera?.radius ? Math.min(2.4, Math.max(0.8, camera.radius / 7)) : 1
    spark.fan.radial = true
    spark.emitter.copyFrom(at)
    spark.color1 = rgba(GOLD.bright); spark.color2 = rgba(GOLD.hot); spark.colorDead = rgba(GOLD.dead, 0)
    spark.minEmitPower = 2.5 * k; spark.maxEmitPower = 5.5 * k
    spark.minScaleX = 0.06 * k; spark.maxScaleX = 0.1 * k
    spark.minScaleY = 0.35 * k; spark.maxScaleY = 0.7 * k
    spark.minSize = spark.maxSize = 1
    spark.manualEmitCount = 12
    spark.start()
    ringAt(scene, at, k, 1.5, GOLD)
}

// ── the lock-on ──────────────────────────────────────────────────────────────
// A swing at an enemy locks onto it (the ring under it), and while the lock
// holds I fight it face to face: controllers/inputMovement.js keeps me turned
// toward it and the keys move me round it instead of turning me away - a/d
// circle it, s backs off, w closes in. It lets go when the enemy is dead or
// gone, when I'm too far off, out of the fight (walking, sitting...), or
// haven't swung at it for a while.
const LOCK_IDLE_MS = 8000          // since the last swing at it
const LOCK_BREAK_RANGE = 14        // m from its near side
const LOCK_MODES = ["fighting", "inAir", "casting"]
let lock = null                    // { target (a candidate), at }

function lockOn(target){
    lock = { target, at: performance.now() }
}

function lockAlive(target){
    if(target.body.isDisposed()) return false
    if(target.enemy) return !target.enemy.isDead && (target.enemy.det?.hp ?? 1) > 0 && getEnemiesOnScene().includes(target.enemy)
    // a duel opponent or an undead is taken off the list the moment it falls
    return getDuelOpponentsOnScene().some(o => o.body === target.body)
}

/** How wide the body I'm locked onto is, from its centre to its edge (0 with no lock). */
export function getCombatLockRadius(){
    return lock?.target.radius ?? 0
}

/** The body I'm locked onto, or null - and the lock let go, if it no longer holds. */
export function getCombatLock(){
    if(!lock) return null
    const player = myPlayer()
    const t = lock.target
    const holds = !!player?.body && LOCK_MODES.includes(player.mode)
        && performance.now() - lock.at < LOCK_IDLE_MS
        && lockAlive(t)
        && Math.hypot(t.body.position.x - player.body.position.x, t.body.position.z - player.body.position.z) - t.radius <= LOCK_BREAK_RANGE
    if(!holds){
        lock = null
        return null
    }
    return t.body
}

// A thin ring on the ground under whatever the swing just locked onto - so
// it's clear which enemy the attack is going for. It stays while the lock
// holds, and fades out over a moment once it lets go.
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
            if(lock?.target.body === r.target.body && getCombatLock()) r.until = Math.max(r.until, performance.now() + 300)
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
