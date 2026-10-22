import { Color3, Vector3 } from "@babylonjs/core"
import { capsuleHeight } from "./createcharacter.js"
import { playRemoteLunge } from "./meleeCombat.js"
import { faceAttackTarget, markDashActive } from "../controllers/inputMovement.js"
import { emitFaceTarget } from "../sockets/emits.js"
import { popShockRing } from "../effects/shockRing.js"
import { sparkBurst } from "../effects/blessingFx.js"
import { addCameraTrauma } from "../tools/cameraShake.js"
import { getAllSounds } from "../components/soundSystem.js"

// KNOCKBACK - a slam (an enemy's det.bashAttack, e.g. the fire slimes' body
// slam) throwing a player away from whoever hit them: they play hit1 and
// slide back until they're `distance` from the attacker, with a shock ring
// and sparks bursting at their feet.
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
// from (the attacker's position). isMine: the victim is me. blocked: they
// had their guard up - the slam still lands (the ring), but they hold their
// ground. Bots (owner "bot_...") stagger but aren't moved: each client
// steps a bot on its own, so a slide here would just get walked back.
export function bashLanded({ victim, from, distance = 2, isMine = false, blocked = false }){
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
    if(blocked) return

    victim.characterAnimations?.playAction(victim.anims, "hit1", 1)
    if(victim.owner?.startsWith("bot_")) return
    const to = landingSpot(body.position, from, distance)
    if(isMine) knockMeBack(victim, from, to)
    else playRemoteLunge(body, { to, ms: KNOCKBACK_MS })
}

// my own body, thrown to `to` - velocity every physics tick, re-aimed at the
// spot, so it lands about the same distance whatever the ground's friction.
// A wall stops it where it is.
function knockMeBack(player, from, to){
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
        const vy = first ? HOP : vel.y
        first = false
        body.setLinearVelocity(new Vector3(toX / remaining * speed, vy, toZ / remaining * speed))
    })
    scene.onDisposeObservable.addOnce(() => scene.onBeforePhysicsObservable.remove(observer))
}
