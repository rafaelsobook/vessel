import { Quaternion, Sound, Vector3, Color3 } from "@babylonjs/core"
import { capsuleHeight } from "../charactersystem/createcharacter.js"
import { attack } from "../charactersystem/attackingSystem.js"
import { getCharState } from "../charactersystem/characterstate.js"
import { wasCastLocallyRecently } from "../charactersystem/localCasts.js"
import { createHpBar, poppingTextMesh } from "../tools/GUITools.js"
import { openworldGroundY } from "../tools/groundHeight.js"
import { playBlockingLoop, ANIM_STATE } from "../tools/animation.js"
import { smokePuff } from "../effects/comicHit.js"
import { createMagicCircle } from "../creations/magiccircles.js"
import { getAllSounds, playSoundNear } from "../components/soundSystem.js"
import { emitUndeadIsHit } from "../sockets/emits.js"
import { stunPlayer } from "../charactersystem/stun.js"
import { popShockRing } from "../effects/shockRing.js"
import { sparkBurst } from "../effects/blessingFx.js"

// THE UNDEAD, on screen - skeletons that rise in the fog (tcp's
// recources/undead.ts has the whole story and decides everything they do).
//
// Each one is a createCharacter() body with det.race "undead" (avatar.glb's
// skeleton, wearing what it rose in), kept in playersOnScene like any player
// so the attack/animation/hit code that already knows players works on it
// unchanged. What this file adds:
//
//   - movement: tcp reports where each one is ten times a second
//     ("undead-moves"); here it walks there smoothly at its own speed
//     (tickUndead, from renderer.js's per-frame player loop), on the ground
//   - its moves: a swing, a roll out of a swing, a raised guard, a leap, a
//     dashstrike, a blinkstrike, a heal, a laugh over a body
//     ("undead-action" - playUndeadAction)
//   - an hp bar, and bone dust where blood would be (createcharacter.js)
//   - its eyes are not made here: createcharacter.js leaves the avatar's own
//     eyes mesh burning in the skull's sockets, textured like a demon's
//   - its voice and its death (sounds/monsters/undead): a groan as it rises
//     and every so often while it hunts, a scream as it leaps or comes out
//     of a blink behind you - but only twice in all (VOICE_PLAYS) - and the
//     sound of it falling apart when it dies
//   - spells: it rides the duel-opponent registry skillEffects.js's spells
//     and meleeCombat.js's aim already search (worldsocket.js puts it
//     there), and turns a spell landing on it into server damage - but only
//     for MY OWN cast (applyDamage's guard)
//
// tcp is the authority for where it is, its hp and every blow it lands; this
// file never decides anything, it only shows what tcp said.

// MUST match tcp/recources/undead.ts's UNDEAD_SPEED - the pace it walks
// toward each reported position at
const UNDEAD_SPEED = 4.5
// controllers/inputMovement.js's sprintSpeed outside dev mode - what the run
// clip's own pace matches
const PLAYER_SPRINT_SPEED = 3.7
// further than this from where tcp says it is (a late join, a stall), it is
// simply put there
const SNAP_DIST = 6
// how fast it closes on the reported spot, as a share of the gap per second,
// whenever that beats its own walking speed - keeps it from trailing behind
const CATCH_UP = 6
// how fast it swings round to face a new heading, per second
const TURN_RATE = 12
// Its jump attack is avatar.glb's weaponjumpattack, 0.33 s long. The clip
// starts in the air, blade overhead - its pelvis already ~0.35 m above a
// running one's - strikes at about 42% of the way through, and has touched
// down by about 65%. So a leap is two parts: the body rises on its own, in a
// running pose, to where the clip starts, then the clip takes over with its
// own lift, started early enough that the strike meets tcp's blow (it lands
// when the leap ends). Both numbers measured off the clip's own frames: its
// first frame against the running clip's pelvis, averaged over its stride.
const JUMP_ATTACK = { clip: "weaponjumpattack", strikeAt: 0.42, rise: 0.29 }
// Coming up out of the ground, once, the moment it's spawned: avatar.glb's
// rosefromground (1.5 s) - its pelvis starts ~1.6 m underground and the clip
// climbs it out on its own, so the body just stands where it rose. tcp keeps
// it still and unhittable meanwhile (undead.ts's RISE_MS). A body built later
// than lateMs after the spawn reached me (I walked in on them) skips it -
// they're already up. Its hp bar shows once it's out.
const RISE = { clip: "rosefromground", lateMs: 600, dust: { count: 22, size: 1.5 } }
// y: over its head - off the body's centre, which is half a capsule up
const HP_BAR = { y: 0.45, width: 300 }
// Each one's own sounds, spatial and riding on its body like a monster's
// (createEnemy.js's createMonsterSounds): faint far off, silent out of range.
// tcp says nothing about sound - every client plays these off what it is
// already showing. The voice carries far enough to hear one rise at the edge
// of the fog (they rise 50 out).
const SOUNDS = { dir: "./sounds/monsters/undead", voice: "undeadsound", death: "undeaddied" }
const VOICE_RANGE = 60
const DEATH_RANGE = 40
// it groans every so often while it hunts - this long apart, give or take
const GROAN_MS = [6000, 12000]
// across all of them, no two groans start closer together than this - ten
// on one player would otherwise be one long moan. A leap or a blink does not
// wait its turn
const GROAN_GAP_MS = 1200
let lastGroanAt = 0
// and each one only finds its voice this many times in its whole life (the
// rise, then whatever comes next - a groan, a leap, a blink, a laugh) - a pack
// of them hunting was too noisy. Its death sound is not counted.
const VOICE_PLAYS = 2

const _faceQ = new Quaternion()

function setBarWidth(hpbar, hp, maxHp){
    hpbar.width = `${Math.max(0, Math.min(1, hp / Math.max(1, maxHp))) * HP_BAR.width}px`
}

function yawToQuat(yaw, ref){
    return Quaternion.RotationAxisToRef(Vector3.Up(), yaw, ref)
}

// one of its sounds, made from the file - never Sound.clone(), which is broken
// in this Babylon - and riding on its body
function undeadSound(scene, file, maxDistance, body){
    try {
        const sound = new Sound(`undead_${file}`, `${SOUNDS.dir}/${file}.mp3`, scene, null, { spatialSound: true, maxDistance, loop: false, autoplay: false })
        sound.attachToMesh(body)
        return sound
    } catch(err){
        console.warn(`[undead] failed to load "${file}"`, err)
        return null
    }
}

// its voice, a touch higher or lower each time so a crowd of them don't sound
// like one
function groan(u, urgent = false){
    const now = performance.now()
    if(!u.voice || u.voice.isPlaying || u.voicePlays >= VOICE_PLAYS) return
    if(!urgent && now - lastGroanAt < GROAN_GAP_MS) return
    u.voice.setPlaybackRate(0.88 + Math.random() * 0.24)
    u.voice.play()
    u.voicePlays++
    lastGroanAt = now
}

/**
 * Called once a fresh undead body is on screen (worldsocket.js). Returns the
 * entry for the duel-opponent registry - what spells and melee aim search.
 */
export function setupUndead(player, scene){
    if(!player?.body || player._undead) return null
    const det = player.det
    // a graveyard's giant (det.scale 3) - the whole body, so its model, hp
    // bar, shadow and the capsule its blows are aimed at all grow with it;
    // the model hangs off the body with its feet at the bottom, and
    // tickUndead stands the bigger capsule on the ground
    const scale = det.scale > 0 ? det.scale : 1
    if(scale !== 1) player.body.scaling.setAll(scale)
    const { hpbar, hpmesh } = createHpBar(capsuleHeight / 2 + HP_BAR.y, `undead_${player.owner}`, player.body, det.hp ?? 1, det.maxHp ?? 1)
    hpbar.background = det.night ? "#7d1fa5" : "red"
    setBarWidth(hpbar, det.hp ?? 1, det.maxHp ?? 1)

    const yaw = Math.atan2((det._dirTarg?.x ?? det.pos.x) - det.pos.x, (det._dirTarg?.z ?? det.pos.z + 1) - det.pos.z)
    player._undead = {
        tx: player.body.position.x,
        tz: player.body.position.z,
        q: yawToQuat(yaw, new Quaternion()),
        speed: UNDEAD_SPEED,
        scale,
        hp: det.hp ?? 1,
        maxHp: det.maxHp ?? 1,
        hpbar,
        hpmesh,
        // a leap/dash/roll in progress: { from, to, start, dur, arc, ease }
        motion: null,
        // bumped when a blow knocks it back or stuns it ("knocked"/"stunned") -
        // a leap's clip or a blink's coming back, still waiting, is dropped
        gen: 0,
        // its eyes' own material (createcharacter.js's giveRaceEyes made it
        // for this body alone) - the body's dispose leaves it behind
        eyeMat: player.root?.getChildMeshes().find(m => m.name === "eyes")?.material ?? null,
        voice: undeadSound(scene, SOUNDS.voice, VOICE_RANGE, player.body),
        death: undeadSound(scene, SOUNDS.death, DEATH_RANGE, player.body),
        // how many times its voice has played (VOICE_PLAYS)
        voicePlays: 0,
        // the first groan as it rises, once its sound has had a moment to load
        nextGroanAt: performance.now() + 800 + Math.random() * 1200,
    }
    player._moving = false
    riseFromGround(player, scene)

    // A spell of mine landing on it. skillEffects.js calls this for every
    // spell anyone casts that hits it on MY screen - including other players'
    // spells, which every client replays - so only my own cast is reported.
    // A burn tick (no skill handed in) is left alone for the same reason.
    player.applyDamage = (dmg, hitDetails = {}) => {
        if(!(dmg > 0) || !hitDetails.skill) return
        if(!wasCastLocallyRecently(hitDetails.skill.name)) return
        emitUndeadIsHit({ targetId: player.owner, dmg: Math.round(dmg) })
    }
    return { body: player.body, applyDamage: player.applyDamage, owner: player.owner, isUndead: true }
}

// it claws its way up out of the ground - only for one freshly spawned
// (worldsocket.js stamps det._risingAt), and only ever once
function riseFromGround(player, scene){
    const det = player.det
    const u = player._undead
    const risingAt = det._risingAt
    det._risingAt = 0
    if(!risingAt || performance.now() - risingAt > RISE.lateMs) return
    if(!player.characterAnimations?.playAction(player.anims, RISE.clip, 1, null, false, ANIM_STATE.COMBAT_IDLE)) return
    u.hpmesh?.setEnabled(false)
    // the ground breaking where it comes up
    const feet = player.body.position.clone()
    feet.y = openworldGroundY(feet.x, feet.z) + 0.1
    smokePuff(scene, feet, { count: RISE.dust.count, size: RISE.dust.size * u.scale })
    setTimeout(() => {
        if(player._undead === u && player.mode !== "death") u.hpmesh?.setEnabled(true)
    }, clipMs(player, RISE.clip))
}

/** Where tcp says each one is now ("undead-moves"). */
export function applyUndeadMove(player, move){
    const u = player?._undead
    if(!u) return
    u.tx = move.x
    u.tz = move.z
    u.speed = move.s ?? UNDEAD_SPEED
    yawToQuat(move.y, u.q)
    player._moving = !!move.m
    player.mode = "fighting"
    // the run clip is paced for a player's sprint - quicker legs for quicker
    // dead, so they don't skate; a giant's strides are its size longer, so
    // its legs go that much slower
    player.characterAnimations?.setMoveSpeedRatio(Math.min(1.8, Math.max(1 / u.scale, u.speed / (PLAYER_SPRINT_SPEED * u.scale))))
}

/** Its hp after a blow or a heal ("undead-hp") - a heal shows itself in green. */
export function setUndeadHp(player, hp, maxHp){
    const u = player?._undead
    if(!u) return
    if(hp > u.hp) poppingTextMesh(`+${Math.round(hp - u.hp)}`, "#2ecc71", 40, 1, { x: 0, y: capsuleHeight + 0.5, z: 0 }, player.body, true)
    u.hp = hp
    u.maxHp = maxHp
    setBarWidth(u.hpbar, hp, maxHp)
}

/** It is dying or crumbling - stop it in place, out of every move it was in. */
export function haltUndead(player){
    const u = player?._undead
    if(!u) return
    u.motion = null
    u.tx = player.body.position.x
    u.tz = player.body.position.z
    player.weaponBlocking = false
    player.root?.setEnabled(true)
    u.hpmesh?.setEnabled(false)
    if(player.body) smokePuff(player.body.getScene(), player.body.position, { count: 18, size: 1.4 })
    u.voice?.stop()
    // a beat apart when the fog lifts on a crowd of them at once
    const death = u.death
    if(death) setTimeout(() => { if(player._undead) death.play() }, Math.random() * 250)
}

// Every frame (renderer.js): toward where tcp says it is, or through the leap
// or roll it is in the middle of - on the open world's ground, facing its way.
export function tickUndead(player, dt){
    const u = player._undead
    const body = player.body
    if(!u || !body) return
    const p = body.position
    let lift = 0
    if(player.mode !== "death"){
        if(u.motion){
            const m = u.motion
            const t = Math.min(1, (performance.now() - m.start) / m.dur)
            const k = m.ease ? 1 - (1 - t) * (1 - t) : t
            p.x = m.from.x + (m.to.x - m.from.x) * k
            p.z = m.from.z + (m.to.z - m.from.z) * k
            if(m.arc) lift = Math.sin(Math.PI * t) * m.arc
            // eased up to the height a clip starts at, then none: from there the
            // clip carries the lift itself
            else if(m.rise) lift = t < m.rise.until ? m.rise.h * Math.sin(Math.PI / 2 * t / m.rise.until) : 0
            if(t >= 1){
                u.motion = null
                u.tx = m.to.x
                u.tz = m.to.z
            }
        } else {
            const dx = u.tx - p.x
            const dz = u.tz - p.z
            const d = Math.hypot(dx, dz)
            if(d > SNAP_DIST){
                p.x = u.tx
                p.z = u.tz
            } else if(d > 0.001){
                const step = Math.min(d, Math.max(u.speed, d * CATCH_UP) * dt)
                p.x += dx / d * step
                p.z += dz / d * step
            }
        }
        if(!body.rotationQuaternion) body.rotationQuaternion = Quaternion.Identity()
        Quaternion.SlerpToRef(body.rotationQuaternion, u.q, Math.min(1, dt * TURN_RATE), body.rotationQuaternion)

        const now = performance.now()
        if(now >= u.nextGroanAt){
            // still loading - try again shortly rather than skip a whole turn
            if(u.voice && !u.voice.isReady()) u.nextGroanAt = now + 500
            else {
                groan(u)
                u.nextGroanAt = now + GROAN_MS[0] + Math.random() * (GROAN_MS[1] - GROAN_MS[0])
            }
        }
    }
    p.y = openworldGroundY(p.x, p.z) + (capsuleHeight / 2 + 0.05) * u.scale + lift
}

// a clip's length on this rig, in ms (a missing one reads as the jump attack's
// own)
function clipMs(player, name){
    const group = player.anims?.find(a => a.name.toLowerCase() === name.toLowerCase())
    if(!group) return 333
    const fps = group.targetedAnimations?.[0]?.animation?.framePerSecond ?? 60
    return (group.to - group.from) / fps * 1000
}

function faceNow(player, yaw){
    const u = player._undead
    yawToQuat(yaw, u.q)
    player.body.rotationQuaternion = yawToQuat(yaw, _faceQ).clone()
}

function startMotion(u, from, to, durationMs, arc = 0, ease = false, rise = null){
    u.motion = { from: { x: from.x, z: from.z }, to: { x: to.x, z: to.z }, start: performance.now(), dur: Math.max(1, durationMs), arc, ease, rise }
    u.tx = to.x
    u.tz = to.z
}

function swingAt(player, data, animName){
    const yaw = data.toYaw ?? data.yaw
    attack({
        owner: player.owner,
        pos: { x: player.body.position.x, z: player.body.position.z },
        dirTarg: { x: player.body.position.x + Math.sin(yaw), y: 0, z: player.body.position.z + Math.cos(yaw) },
        dmgDetails: { physicalDmg: 0, weaponDmg: 0, magicDmg: 0, accuracy: 1 },
        hasWeapon: data.weaponName ?? false,
        weaponType: data.weaponType ?? "sword",
        atkSpd: 0.2,
    }, animName)
    swingWhoosh(player)
}

// What its blows sound like - the way a player's own do (charactersystem/
// meleeCombat.js's startMeleeSwing and playHitSound): an armed swing whooshes
// as it comes round, and a blow that lands rings with its weapon - a sword's
// clash, a spear's thrust, a staff's crack, a fist's thud.
// thrown back by a critical ("knocked"): its little hop, and the ring at its feet
const KNOCK_HOP = 0.3
const KNOCK_RING = { size: 2.4, seconds: 0.45, color: new Color3(1, 0.7, 0.3) }

const HIT_SOUND = { sword: "swordS1", spear: "spearS1", staff: "staffS1", fist: "punchedS" }

function weaponTypeOf(player){
    const weapon = player.det?.items?.find(itm => itm.itemType === "weapon" && itm.equiped)
    return weapon?.weaponType ?? "fist"
}

function swingWhoosh(player){
    if(weaponTypeOf(player) === "fist") return
    playSoundNear(getAllSounds().swordWhooshS, player.body.position)
}

/** One of its blows landing on someone (worldsocket.js's "player-is-hit"), heard where it lands. */
export function undeadBlowSound(attacker, at){
    const sounds = getAllSounds()
    if(!sounds || !at) return
    playSoundNear(sounds[HIT_SOUND[weaponTypeOf(attacker)] ?? "swordS1"], at)
}

/** One of its moves, exactly as tcp decided it ("undead-action"). */
export function playUndeadAction(player, data){
    const u = player?._undead
    if(!u || !player.body || player.mode === "death") return
    const scene = player.body.getScene()
    const anims = player.characterAnimations
    player._moving = false
    switch(data.kind){
        case "swing": {
            u.motion = null
            u.tx = data.x
            u.tz = data.z
            faceNow(player, data.yaw)
            swingAt(player, data, data.animName)
            break
        }
        // a roll out from under a swing, back and to one side
        case "dodge": {
            faceNow(player, data.yaw)
            startMotion(u, data.from, data.to, data.durationMs, 0, true)
            anims?.playAction(player.anims, "roll", 1.6)
            break
        }
        // guard up - player-is-hit hears the clang off weaponBlocking
        case "block": {
            u.motion = null
            faceNow(player, data.yaw)
            player.weaponBlocking = true
            playBlockingLoop(player)
            setTimeout(() => { player.weaponBlocking = false }, data.durationMs)
            break
        }
        // leaping onto them, blade coming down as it lands
        case "jump": {
            faceNow(player, data.yaw)
            if(data.weaponName) player.equipSword(data.weaponName, true)
            // the clip's strike lands as the leap ends
            const startMs = Math.max(0, data.durationMs - JUMP_ATTACK.strikeAt * clipMs(player, JUMP_ATTACK.clip))
            startMotion(u, data.from, data.to, data.durationMs, 0, false, { h: JUMP_ATTACK.rise, until: startMs / data.durationMs })
            // running through the air until the clip takes over
            player._moving = true
            groan(u, true)
            const jumpGen = u.gen
            setTimeout(() => {
                if(!player._undead || player.mode === "death" || player.body.isDisposed() || u.gen !== jumpGen) return
                player._moving = false
                // settling into combat idle when it ends, not the running
                // pose the leap was in
                anims?.playAction(player.anims, JUMP_ATTACK.clip, 1, null, false, ANIM_STATE.COMBAT_IDLE)
                swingWhoosh(player)
            }, startMs)
            break
        }
        case "dash": {
            faceNow(player, data.yaw)
            startMotion(u, data.from, data.to, data.durationMs, 0, true)
            if(data.weaponName) player.equipSword(data.weaponName, true)
            anims?.playAction(player.anims, "dashstrike", 1.2)
            swingWhoosh(player)
            break
        }
        // gone in a puff of smoke, out of another behind them, swinging
        case "blink": {
            u.motion = null
            smokePuff(scene, player.body.position, { count: 16, size: 1.2 })
            player.root?.setEnabled(false)
            u.hpmesh?.setEnabled(false)
            const blinkGen = u.gen
            setTimeout(() => {
                if(!player._undead || player.mode === "death" || player.body.isDisposed() || u.gen !== blinkGen) return
                player.body.position.x = data.to.x
                player.body.position.z = data.to.z
                u.tx = data.to.x
                u.tz = data.to.z
                faceNow(player, data.toYaw)
                player.root?.setEnabled(true)
                u.hpmesh?.setEnabled(true)
                smokePuff(scene, player.body.position, { count: 16, size: 1.2 })
                swingAt(player, data, data.animName)
                groan(u, true)
            }, data.vanishMs)
            break
        }
        // a dark circle under it, its wounds closing
        case "heal": {
            u.motion = null
            const feet = player.body.position.clone()
            feet.y = openworldGroundY(feet.x, feet.z) + 0.05
            createMagicCircle(feet, scene, "apt_darkness", 0.8, data.durationMs + 400, null, 0.6)
            anims?.playAction(player.anims, "cast", 1.2)
            break
        }
        // stood over the player it just killed
        case "triumph": {
            u.motion = null
            anims?.playAction(player.anims, "laugh", 1)
            groan(u, true)
            break
        }
        // a player's critical threw it back (their weapon's bash - the client's
        // staticRecources/weaponEffects.js, tcp's knockBack): off whatever it
        // was doing, back into sight if it was mid-blink, staggering away
        case "knocked": {
            u.gen++
            player._moving = false
            player.root?.setEnabled(true)
            u.hpmesh?.setEnabled(true)
            faceNow(player, data.yaw)
            startMotion(u, data.from, data.to, data.durationMs, KNOCK_HOP, true)
            const feet = new Vector3(data.from.x, openworldGroundY(data.from.x, data.from.z) + 0.05, data.from.z)
            popShockRing(scene, feet, KNOCK_RING)
            sparkBurst(scene, feet.add(new Vector3(0, 0.2, 0)), KNOCK_RING.color, { count: 36, power: 4 })
            anims?.playAction(player.anims, "hit1", 1.2, null, false, player.stunnedUntil > performance.now() ? player.stunPose : ANIM_STATE.COMBAT_IDLE)
            break
        }
        // a hammer's critical dazed it: stars round its skull, swaying on the
        // spot, until tcp lets it go
        case "stunned": {
            u.gen++
            player._moving = false
            const pose = anims?.stateForClip(player.anims, "structed") ?? null
            stunPlayer(player, data.durationMs / 1000, pose, false)
            break
        }
        // rolled out of a blow that would have landed
        case "evade": {
            poppingTextMesh("Miss", "white", 36, 1, { x: 0, y: capsuleHeight + 0.4, z: 0 }, player.body, true)
            break
        }
    }
}

/** Its body is being disposed (worldsocket.js's removePlayer) - what the body's own dispose leaves behind. */
export function teardownUndead(player){
    const u = player?._undead
    if(!u) return
    // with its texture - the eyes' own, a copy made for this body
    u.eyeMat?.dispose(false, true)
    u.voice?.dispose()
    u.death?.dispose()
    player._undead = null
}

/** Whether a body is one of the fog's undead - their owners are "undead_<id>". */
export function isUndeadOwner(owner){
    return typeof owner === "string" && owner.startsWith("undead_")
}

/** A warning for the one they rise for (worldsocket.js, on "undead-spawned"). */
export function undeadRiseNotice(undeads){
    const me = getCharState()?.owner
    const mine = undeads.filter(u => u.targetId === me)
    if(!mine.length) return null
    // a graveyard waking - count everyone it sent, giant included
    if(undeads.some(u => u.graveyard)){
        const giant = undeads.some(u => u.giant)
        return `The graves split open - ${undeads.length} dead claw their way out${giant ? ", and something huge rises in the middle" : ""}...`
    }
    const night = mine.some(u => u.night)
    return `${mine.length === 1 ? "Something rises" : `${mine.length} dead rise`} in the fog${night ? " - and the night makes them stronger" : ""}...`
}
