import { Color3, Vector3, PhysicsMotionType } from "@babylonjs/core"
import { capsuleHeight } from "./createcharacter.js"
import { playRemoteLunge } from "./meleeCombat.js"
import { faceAttackTarget, markDashActive } from "../controllers/inputMovement.js"
import { emitFaceTarget, emitWeaponBlock } from "../sockets/emits.js"
import { popShockRing } from "../effects/shockRing.js"
import { sparkBurst } from "../effects/blessingFx.js"
import { addCameraTrauma } from "../tools/cameraShake.js"
import { getAllSounds } from "../components/soundSystem.js"
import { playBlockingLoop } from "../tools/animation.js"
import { stunPlayer } from "./stun.js"
import { openworldGroundY } from "../tools/groundHeight.js"
import { OPENWORLD_PLACE_ID } from "../constants/constants.js"
import { emitEnemyChasePosition } from "../sockets/emits.js"

// KNOCKBACK - a slam (one of an enemy's det.additionalAttacks, e.g. the
// slimes' body slam - tcp/recources/enemyAttacks.ts) throwing a player away
// from whoever hit them: they play its hit clip and slide back until they're
// its `knockback` from the attacker, with a shock ring and sparks bursting
// at their feet - then stay dazed for its stunDuration (./stun.js).
//
// Everyone sees it (sockets/worldsocket.js's "enemy-attacked" handler calls
// bashLanded on every client at the slam's impact frame), but only the
// victim's own client moves their real body - by velocity, like a melee lunge
// (meleeCombat.js's runLunge) - and then reports where they ended up. Every
// other client slides its copy of them there over the same time, the way it
// shows someone else's lunge.

const KNOCKBACK_MS = 280
const MAX_SPEED = 14        // m/s
const HOP = 2.2             // upward m/s - knocked off their feet a little
const MIN_PUSH = 0.8        // already that far away or further: still thrown this much
const RING = { size: 3, seconds: 0.5, color: new Color3(1, 0.45, 0.1) }
const SPARK_COLOR = new Color3(1, 0.5, 0.15)

// where a knockback from `from` lands someone standing at `at`: straight away
// from it, `distance` from it - or MIN_PUSH further than they already are
function landingSpot(at, from, distance){
    let dx = at.x - from.x
    let dz = at.z - from.z
    let len = Math.hypot(dx, dz)
    // right on top of it - any way out will do
    if(len < 0.01){
        dx = 1; dz = 0; len = 0
    } else {
        dx /= len; dz /= len
    }
    const push = Math.max(distance, len + MIN_PUSH)
    return new Vector3(from.x + dx * push, at.y, from.z + dz * push)
}

// victim: the player rig hit (playersOnScene's). from: where the slam came
// from (the attacker's position). attack: the enemy's additionalAttacks entry
// that landed. isMine: the victim is me. blocked: they had their guard up -
// no hp lost (worldsocket.js), and the attack's whenBlocked takes over from
// its own settings: a stun breaks the guard, none leaves them back in the
// block pose if they're still holding it. Bots (owner "bot_...") stagger but
// aren't moved or stunned: each client steps a bot on its own, so a slide
// here would just get walked back, and the server never stops it.
export function bashLanded({ victim, from, attack, isMine = false, blocked = false }){
    const body = victim?.body
    if(!body || body.isDisposed() || victim.isDead) return
    const scene = body.getScene()
    const feet = body.position.clone()
    feet.y -= capsuleHeight / 2
    popShockRing(scene, feet, RING)
    sparkBurst(scene, feet.add(new Vector3(0, 0.2, 0)), SPARK_COLOR, { count: 40, power: 4 })
    if(isMine){
        addCameraTrauma(scene, blocked ? 0.25 : 0.45)
        getAllSounds()?.landedOnGroundS?.play()
    }
    const outcome = blocked ? { ...attack, ...attack.whenBlocked } : attack
    const isBot = victim.owner?.startsWith("bot_")
    const stunFor = isBot ? 0 : outcome.stunDuration ?? 0
    const anims = victim.characterAnimations
    const stunPose = stunFor > 0
        ? anims?.stateForClip(victim.anims, outcome.playerAnimationWhenStunned ?? "structed") ?? null
        : null
    // the guard breaks - every client drops it on its own copy at once; mine
    // tells the server too, which echoes it to the others as a no-op
    if(blocked && stunFor > 0){
        victim.weaponBlocking = false
        if(isMine) emitWeaponBlock(false)
    }
    const hitClip = outcome.playerAnimationWhenHit ?? (blocked ? "blockbreak" : "hit1")
    // straight into the stunned pose after, or back into the block (playBlockingLoop
    // does nothing once the guard's down)
    anims?.playAction(victim.anims, hitClip, 1, blocked ? () => playBlockingLoop(victim) : null, false, stunPose)
    if(isBot) return
    if(stunFor > 0) stunPlayer(victim, stunFor, stunPose, isMine)
    if(outcome.knockback > 0) knockAway(victim, from, outcome.knockback, isMine)
}

/**
 * The throw on its own: `victim` sent straight away from `from` until they're
 * `distance` from it (or MIN_PUSH further than they already are) - a slam's,
 * or a blast's (effects/scorch.js's fireball). hop: how hard up off their
 * feet. Only the victim's own client moves their real body; every other
 * client slides its copy of them there. Not bots (see bashLanded).
 */
export function knockAway(victim, from, distance, isMine, { hop = HOP } = {}){
    const body = victim?.body
    if(!body || body.isDisposed() || victim.isDead || victim.owner?.startsWith("bot_")) return
    const to = landingSpot(body.position, from, distance)
    if(isMine) knockMeBack(victim, from, to, hop)
    else playRemoteLunge(body, { to, ms: KNOCKBACK_MS })
}

// my own body, thrown to `to` - velocity every physics tick, re-aimed at the
// spot, so it lands about the same distance whatever the ground's friction.
// A wall stops it where it is.
function knockMeBack(player, from, to, hop = HOP){
    const scene = player.body.getScene()
    const body = player.aggregate?.body
    if(!body) return
    // the movement loop leaves my velocity alone meanwhile (a held key would
    // otherwise walk me straight back out of it), and I end up facing what hit me
    markDashActive(KNOCKBACK_MS + 40)
    faceAttackTarget(from, KNOCKBACK_MS + 200)
    const start = performance.now()
    let first = true
    const observer = scene.onBeforePhysicsObservable.add(() => {
        const elapsed = performance.now() - start
        const me = player.body.position
        const vel = body.getLinearVelocity()
        const toX = to.x - me.x, toZ = to.z - me.z
        const remaining = Math.hypot(toX, toZ)
        if(elapsed >= KNOCKBACK_MS || remaining <= 0.05 || player.isDead || player.body.isDisposed()){
            body.setLinearVelocity(new Vector3(0, Math.min(vel.y, 0.5), 0))
            scene.onBeforePhysicsObservable.remove(observer)
            // where I ended up, for everyone else (they slid me toward `to`)
            emitFaceTarget(from)
            return
        }
        const timeLeft = Math.max(0.03, (KNOCKBACK_MS - elapsed) / 1000)
        const speed = Math.min(MAX_SPEED, remaining / timeLeft)
        const vy = first ? hop : vel.y
        first = false
        body.setLinearVelocity(new Vector3(toX / remaining * speed, vy, toZ / remaining * speed))
    })
    scene.onDisposeObservable.addOnce(() => scene.onBeforePhysicsObservable.remove(observer))
}

// ── an enemy thrown back ─────────────────────────────────────────────────────
// A weapon's "bash" (staticRecources/weaponEffects.js - item.effectsWhenHit,
// on a critical by default): the enemy it lands on is thrown straight back
// from whoever swung, distanceKnockback metres - a little off its feet, a ring
// and a burst at them - and stops short of a wall. Every client throws its own
// copy at once (createEnemy.js's enemyIsHit runs on all of them off tcp's
// "enemy-is-hit"), each moving it the same way; the swinger's client then tells
// tcp where it landed, so its record - what a wander or a late joiner starts
// from - doesn't pull it back. renderer.js leaves it be meanwhile (_knockedUntil).

const ENEMY_KNOCK_MS = 320
const ENEMY_HOP = 0.35              // metres up at the top of the arc
const WALL_MARGIN = 0.5             // stops this far short of a wall in the way
const ENEMY_RING = { size: 2.4, seconds: 0.45, color: new Color3(1, 0.7, 0.3) }
const ENEMY_SPARK_COLOR = new Color3(1, 0.75, 0.35)

// how far it can go along (dx, dz) before something solid - from its centre,
// knee-high off its feet so a low rock counts. Static bodies only: another
// enemy or a player in the way is pushed past, not a wall
function clearRun(enemy, dx, dz, distance){
    const body = enemy.body
    const physics = body.getScene()?.getPhysicsEngine?.()
    if(!physics) return distance
    const halfHeight = (enemy.det?.bodyHeight ?? 1) / 2
    const radius = (enemy.det?.bodyWidenes ?? 1) / 2
    const from = new Vector3(body.position.x, body.position.y - halfHeight + 0.4, body.position.z)
    const to = new Vector3(from.x + dx * (distance + radius), from.y, from.z + dz * (distance + radius))
    const hit = physics.raycast(from, to, body.physicsBody ? { ignoreBody: body.physicsBody } : undefined)
    if(!hit?.hasHit || hit.body?.getMotionType?.() !== PhysicsMotionType.STATIC) return distance
    return Math.max(0, Math.min(distance, hit.hitDistance - radius - WALL_MARGIN))
}

/**
 * enemy: a createEnemy() enemy. from: where the blow came from (the swinger's
 * position). bash: the weapon's bash entry ({ distanceKnockback, texture }).
 * isMine: my swing - I report where it landed.
 */
export function knockEnemyAway(enemy, from, bash, isMine = false){
    const body = enemy?.body
    const distance = bash?.distanceKnockback ?? 0
    if(!body || body.isDisposed() || !from || !(distance > 0)) return
    const scene = body.getScene()
    let dx = body.position.x - from.x
    let dz = body.position.z - from.z
    const len = Math.hypot(dx, dz)
    if(len < 0.01){ dx = 0; dz = 1 } else { dx /= len; dz /= len }
    const push = clearRun(enemy, dx, dz, distance)

    const halfHeight = (enemy.det?.bodyHeight ?? 1) / 2
    const feet = new Vector3(body.position.x, body.position.y - halfHeight + 0.05, body.position.z)
    const k = Math.max(0.7, enemy.det?.bodyWidenes ?? 1)
    popShockRing(scene, feet, { ...ENEMY_RING, size: ENEMY_RING.size * k })
    sparkBurst(scene, feet.add(new Vector3(0, 0.2, 0)), ENEMY_SPARK_COLOR, { count: 36, power: 4, texture: bash.texture ?? "thin1" })
    if(push < 0.05) return

    const start = performance.now()
    const sx = body.position.x, sz = body.position.z, sy = body.position.y
    const tx = sx + dx * push, tz = sz + dz * push
    const onGround = enemy.det?.currentPlaceId === OPENWORLD_PLACE_ID
    enemy._knockedUntil = start + ENEMY_KNOCK_MS
    const observer = scene.onBeforeRenderObservable.add(() => {
        if(body.isDisposed()) return scene.onBeforeRenderObservable.remove(observer)
        const t = Math.min(1, (performance.now() - start) / ENEMY_KNOCK_MS)
        // fast off the blow, slowing as it lands
        const e = 1 - Math.pow(1 - t, 3)
        body.position.x = sx + (tx - sx) * e
        body.position.z = sz + (tz - sz) * e
        const ground = onGround ? openworldGroundY(body.position.x, body.position.z) + halfHeight + 0.05 : sy
        body.position.y = ground + ENEMY_HOP * 4 * t * (1 - t)
        if(t < 1) return
        scene.onBeforeRenderObservable.remove(observer)
        enemy._knockedUntil = 0
        if(isMine && enemy._id) emitEnemyChasePosition(enemy._id, body.position.x, body.position.z)
    })
}
