import { getProjectilesOnScene, getPlayersOnScene, getIsSocketOn, getEnemiesOnScene, getNpcOnScene, getWagonsOnScene, getHarnessDeerOnScene } from "./worldsocket";
import { applyWagonPhysics } from "../assetcreation/createwagon.js";
import { resolveHarnessDeerPosition } from "../assetcreation/createharnessdeer.js";
import { getCharState } from "../charactersystem/characterstate.js";
import { playAnim, ANIM_STATE, findAnimVariants } from "../tools/animation.js";
import { getGameStatus } from "../main/main.js";
import { Vector3 } from "@babylonjs/core";
import { updateNpcPatrol } from "../npc/npcPatrol.js";
import { sampleTerrainSurfaceHeight } from 'infterrain'
import { OPENWORLD_PLACE_ID, OPENWORLD_TERRAIN_VERTS } from "../constants/constants.js";
import { emitEnemyChasePosition } from "./emits.js";

let scene;

// reused every frame instead of `new Vector3(...)` inline below - this loop
// runs for every projectile/enemy/npc every single frame, so allocating a
// fresh Vector3 per call adds up to real GC pressure under load
const _moveVec = new Vector3()
const _lookTarget = new Vector3()

// openworld enemy distance-hiding thresholds (see the getEnemiesOnScene
// loop below) - squared since planar distance is compared as dx*dx+dz*dz,
// never actually sqrt'd. SHOW < HIDE on purpose (hysteresis), not the same
// value - see that loop's own comment.
const OPENWORLD_ENEMY_HIDE_DIST = 200
const OPENWORLD_ENEMY_SHOW_DIST = 180
const OPENWORLD_ENEMY_HIDE_DIST_SQ = OPENWORLD_ENEMY_HIDE_DIST * OPENWORLD_ENEMY_HIDE_DIST
const OPENWORLD_ENEMY_SHOW_DIST_SQ = OPENWORLD_ENEMY_SHOW_DIST * OPENWORLD_ENEMY_SHOW_DIST

// openworld projectile ground-following (see the getProjectilesOnScene loop
// below) - a straight-line projectile fired across sloping terrain will
// either plow into a rising hill or sail way up over a dip, since it has no
// idea the ground even exists. clearance is purely vertical (projectile's
// own y minus the terrain surface directly below it), not a true distance
// to the nearest surface point - cheap, and matches what "how high above
// the ground am I" actually means here.
//   clearance < LOW  (too close / about to clip into rising ground) -> nudge UP
//   clearance > HIGH (drifting too far above a dip, but still under FAR) -> nudge DOWN
//   LOW..HIGH -> dead zone, left alone (stops it from jittering constantly
//   trying to hold an exact height)
//   > FAR -> leave it alone entirely - e.g. cast mid-jump/from a ledge, way
//   above the ground on purpose, not something to fight back down to earth
//
// proj.willDetectSurface === false opts a projectile OUT of this entirely -
// creations/skills.js's own spawnProjectile (astralrainSkill's falling
// swords, spawnFallingSword) sets this because it already does its own real
// ground/wall/tree hit detection via physicsEngine.raycast() every frame;
// without the opt-out, this nudge was fighting that projectile's own
// intentional fall path - pushing a sword back up out of PROJECTILE_GROUND_LOW
// right as it was trying to embed into the ground kept it from ever actually
// reaching it, so it never registered a hit at all.
// BOT MOVEMENT (see the getPlayersOnScene loop below) - BOT_WALK_SPEED
// matches real players' own controllers/inputMovement.js walkSpeed:1.
// BOT_SPRINT_SPEED is real sprintSpeed:20 cut 80% (20*0.2 = 4) on request -
// full speed read as too fast/frantic. MUST match tcp/recources/npcBrain.ts's
// own SPRINT_SPEED exactly, that file's the one actually deciding
// arrival/combat timing based on this same number, this is only what steps
// a bot's position each frame client-side.
const BOT_WALK_SPEED = 1
const BOT_SPRINT_SPEED = 4

// how often a chasing enemy pings its own live x/z back to tcp (see
// emitEnemyChasePosition's own header comment, sockets/emits.js) - close to
// npcBrain.ts's own COMBAT_CHECK_MS (1000ms), so a bot's next combat
// re-check is never working off more than about one report-cycle of
// staleness, without reporting anywhere near every frame
const CHASE_POS_REPORT_INTERVAL_MS = 1200

const PROJECTILE_GROUND_LOW = 0.4
const PROJECTILE_GROUND_HIGH = 0.95
const PROJECTILE_GROUND_FAR = 3
const PROJECTILE_GROUND_ADJUST_SPEED = 8 // units/sec of vertical nudge

// ENEMY SEPARATION - same problem, same fix duelSystem.js's own
// separationInterval already solved for npcFighter gauntlets: every enemy
// chasing the SAME player beelines straight for that player's exact
// position, so with 2+ enemies on one target they visually converge into
// one merged mesh (reported from an actual in-game screenshot - a Lucifer
// Deer standing on top of the player). This is the openworld-enemy
// equivalent - a periodic reactive nudge, not a targeting/pathing change,
// so it costs nothing when nobody's ganging up on anyone.
//
// Multiplayer note (this is NOT server-synced, and that's deliberate, not
// an oversight): enemy chase movement is already purely LOCAL per client -
// the chase loop below moves en.body via locallyTranslate() on THIS
// client's own frame, only ever snapped back in sync at key moments
// (worldsocket.js's "enemy-attacked"/"enemy-teleported" handlers), same as
// every other enemy in this file. What IS server-authoritative and synced
// to everyone is _targetId itself (set from socket data - see
// worldsocket.js's "enemy-attacked"/"newTargetId"/"enemy-attacking-me"
// handlers), so every client groups enemies by shared target identically
// even though the exact per-frame nudge amounts can drift slightly client
// to client - the visible result (enemies spread out instead of stacking)
// stays consistent on every screen without a new network message, the same
// tradeoff this file's own local chase movement already makes.
const ENEMY_SEPARATION_CHECK_MS = 200
// extra clearance on top of each pair's own combined bodyWidenes (their
// real box "size" - see createEnemy.js's own body creation) - a fixed
// distance would be too tight for a big monolith and too loose for a small
// slime, so this scales per-pair instead of duelSystem's single constant
// (every player-shaped fighter there is roughly the same size, enemies
// aren't).
const ENEMY_SEPARATION_MARGIN = 0.6
let enemySeparationInterval = null

function runEnemySeparationPass(){
    const chasers = getEnemiesOnScene().filter(en => en._isMoving && en._targetId && en.body && !en._disabled)
    if(chasers.length < 2) return

    // grouped by target FIRST - the pairwise check below only ever runs
    // WITHIN one group, so this stays bounded by however many enemies are
    // actually piled onto any one player, never the whole scene's enemy
    // count squared
    const groups = new Map()
    chasers.forEach(en => {
        const group = groups.get(en._targetId)
        if(group) group.push(en)
        else groups.set(en._targetId, [en])
    })

    groups.forEach(group => {
        if(group.length < 2) return
        for(let i = 0; i < group.length; i++){
            const a = group[i]
            for(let j = i + 1; j < group.length; j++){
                const b = group[j]
                const dx = b.body.position.x - a.body.position.x
                const dz = b.body.position.z - a.body.position.z
                const dist = Math.hypot(dx, dz)
                const minSeparation = (a.det.bodyWidenes + b.det.bodyWidenes) / 2 + ENEMY_SEPARATION_MARGIN
                if(dist >= minSeparation || dist < 0.001) continue

                // split the correction evenly, same as duelSystem.js's own
                const overlap = (minSeparation - dist) / 2
                const nx = dx / dist
                const nz = dz / dist
                a.body.position.x -= nx * overlap
                a.body.position.z -= nz * overlap
                b.body.position.x += nx * overlap
                b.body.position.z += nz * overlap
            }
        }
    })
}

export function removeRenderObservable(_scene){
    if(_scene) _scene.onBeforeRenderObservable.remove(renderCallback)
    if(enemySeparationInterval){
        clearInterval(enemySeparationInterval)
        enemySeparationInterval = null
    }
}
export function addRenderObservable(_scene){
    scene = _scene;
    scene.onBeforeRenderObservable.add(renderCallback)
    if(enemySeparationInterval) clearInterval(enemySeparationInterval)
    enemySeparationInterval = setInterval(runEnemySeparationPass, ENEMY_SEPARATION_CHECK_MS)
}


let renderCallback = function () {
    if(getGameStatus() === "loading") return;
    const charState = getCharState()
    if(!charState) return

    const dt = scene.getEngine().getDeltaTime()/1000
    
    getProjectilesOnScene().forEach(proj => {
        if(charState.currentPlace.placeId !== proj.placeId) return
        if(!proj.body) return
        if(proj.stuck) return

        _moveVec.set(0, 0, proj.spd * dt)
        proj.body.locallyTranslate(_moveVec)

        // ground-following (openworld only - see the PROJECTILE_GROUND_*
        // constants' own comment above) - a straight shot fired across
        // sloping terrain has no idea the ground exists otherwise, so it'll
        // either plow straight into a rising hill or sail way up over a dip.
        // willDetectSurface === false opts out entirely (see that constant
        // block's own comment) - default (unset/true) still gets this.
        if(proj.placeId === OPENWORLD_PLACE_ID && proj.willDetectSurface !== false){
            const groundY = sampleTerrainSurfaceHeight(proj.body.position.x, proj.body.position.z, OPENWORLD_TERRAIN_VERTS)
            const clearance = proj.body.position.y - groundY
            if(clearance <= PROJECTILE_GROUND_FAR){
                if(clearance < PROJECTILE_GROUND_LOW){
                    proj.body.position.y += PROJECTILE_GROUND_ADJUST_SPEED * dt
                } else if(clearance > PROJECTILE_GROUND_HIGH){
                    proj.body.position.y -= PROJECTILE_GROUND_ADJUST_SPEED * dt
                }
            }
        }
    })

    getPlayersOnScene().forEach(player => {

        if(charState.currentPlace.placeId !== player.currentPlaceId) return
        if(!player.body) return

        // BOT MOVEMENT (tcp/recources/npcBrain.ts) - moved like npc/enemy
        // movement, not the real-player snap-to-exact-position model every
        // other playersOnScene entry uses. worldsocket.js's own
        // "bot-moving"/"bot-stopped" handlers only ever set facing
        // (body.lookAt) + _moving/mode - no x/z ever rides over the wire
        // for a bot, so actually covering ground is this client's own job,
        // every frame, independently - same "the server just says which
        // way, my own client does the stepping" trust level a real
        // enemy's own wander/chase already runs on. Bot-detection is a
        // plain owner-prefix check (bot_<id>, spawnBot's own id scheme) -
        // no dedicated isBot flag exists on the synced player data, this
        // is the cheapest way to tell without adding one.
        if(player.owner?.startsWith("bot_")){
            // "bot-dashing" (worldsocket.js, dashstrikeSkill's own melee
            // bots) - takes priority over the plain _moving check below and
            // runs regardless of it, since a dash fires from the "holding
            // still in attack range" state (_moving already false there) -
            // same locallyTranslate-ramp idea client/src/npc/duelSystem.js's
            // own performOpponentDashStrike uses for its dashstrike-using
            // npcFighters, just driven by a broadcast speed/duration instead
            // of a local scene.onBeforeRenderObservable
            if(player._dashUntil && performance.now() < player._dashUntil){
                _moveVec.set(0, 0, player._dashSpeedPerSec * dt)
                player.body.locallyTranslate(_moveVec)
            } else if(player._moving){
                const spd = player.mode === "fighting" ? BOT_SPRINT_SPEED : BOT_WALK_SPEED
                _moveVec.set(0, 0, spd * dt)
                player.body.locallyTranslate(_moveVec)
            }
        }

        if(!player.characterAnimations) return

        if(player.mode === "death") return
        if(player._attacking || player.characterAnimations.isActionPlaying()) return
        player.characterAnimations.tickBlend()

        if(player._moving && player.mode !== "inAir"){
            switch(player.mode){
                case "idle":
                    player.characterAnimations.setState(ANIM_STATE.WALK, 8)
                break
                case "fighting":
                    player.characterAnimations.setState(ANIM_STATE.RUNNING, 8)
                break
            }
            return
        }

        switch(player.mode){
            case "idle":
                player.characterAnimations.setState(ANIM_STATE.IDLE, 8)
            break
            case "fighting":
                player.characterAnimations.setState(ANIM_STATE.COMBAT_IDLE, 8)
            break
            case "structed":
                player.characterAnimations.setState(ANIM_STATE.STRUCTED, 8)
            break
            // uimanagement.js's startResting/stopResting - reuses the same
            // STRUCTED clip "structed" mode already plays (a kneeling/
            // seated-looking pose), just under its own distinct mode name
            // rather than overloading "structed" itself, which questions.js
            // already uses for an unrelated one-off post-hit stagger state
            case "resting":
                player.characterAnimations.setState(ANIM_STATE.STRUCTED, 8)
            break
            case "casting":
                player.characterAnimations.setState(ANIM_STATE.CASTING, 8)
            break
            case "minning":
                player.characterAnimations.setState(ANIM_STATE.MINNING, 8)
            break
            case "inAir":
                player.characterAnimations.setState(ANIM_STATE.FALLING, 4)
            break
        }
        // player.anims.forEach(anim => {
        //     if(anim.isPlaying) console.log(anim.name)
        // })
    })
    // openworld (see OPENWORLD_PLACE_ID) can have hundreds of enemies alive
    // at once (tcp/recources/enemyDetails.ts spawns ~500 fireslime/
    // electricslime in banded rings 300-1000 units out from spawn), all
    // synced to every client currently in that place regardless of their own
    // character actually is - rendering (skinning + draw calls) for
    // hundreds of them when the camera could only ever see a handful
    // nearby would be wasted work. myOwnBody is only looked up once here
    // (not per-enemy) and only when it's actually needed.
    const myOwnBody = charState.currentPlace.placeId === OPENWORLD_PLACE_ID
        ? getPlayersOnScene().find(pl => pl.owner === charState.owner)?.body
        : null

    getEnemiesOnScene().forEach(en => {
        if(!en) return

        // distance-based hide/show, openworld only - purely a per-client
        // rendering decision, never touches the enemy's actual simulated
        // state (position/AI intervals/hp all keep running in
        // createEnemy.js regardless of enabled state, unaffected by this).
        // Each client decides this off its OWN character's position only,
        // completely independent of every other client - an enemy clashing
        // with a DIFFERENT player elsewhere in the same open world still
        // renders fully on THEIR screen; hiding it here only ever affects
        // this one client's own draw list. setEnabled (not isVisible) so
        // the whole hierarchy - nameMesh/hpbar/hpmesh/mainBodyMeshes are
        // all parented under en.body (see createEnemy.js) - hides/skips
        // skinning together in one call, and so atkDetection/chaseDetector
        // (also children of en.body) stop bothering to evaluate
        // intersections against a target this far away anyway.
        // OPENWORLD_ENEMY_SHOW_DIST < HIDE_DIST is deliberate hysteresis -
        // without a gap, hovering exactly at the boundary would toggle
        // setEnabled (and its internal dirty/recompute bookkeeping) every
        // single frame.
        if(myOwnBody && en.det?.currentPlaceId === OPENWORLD_PLACE_ID && en.body){
            const dx = en.body.position.x - myOwnBody.position.x
            const dz = en.body.position.z - myOwnBody.position.z
            const distSq = dx * dx + dz * dz
            const thresholdSq = en._farHidden ? OPENWORLD_ENEMY_SHOW_DIST_SQ : OPENWORLD_ENEMY_HIDE_DIST_SQ
            const shouldHide = distSq > thresholdSq
            if(shouldHide !== !!en._farHidden){
                en._farHidden = shouldHide
                en.body.setEnabled(!shouldHide)
            }
        }

        // bound (see createEnemy.js's applyEnemyBind/skillEffects.js's
        // enemyBind) - "cannot move" while true, regardless of
        // _isMoving/_targetId state
        if(en._disabled) return

        // wander/dodge - moving toward a plain waypoint (tcp/index.ts's
        // own wander interval, or a locally-detected projectile dodge -
        // see worldsocket.js's "enemy-wander"/"enemy-dodge" handlers),
        // not a player. Takes priority over chasing below: a dodge
        // mid-fight should interrupt the chase for its short burst rather
        // than get silently skipped because _targetId is also still set -
        // _wanderTarget never touches _targetId itself, so the chase
        // simply resumes on its own once the waypoint is reached and this
        // branch stops claiming the frame.
        if(en._isMoving && en._wanderTarget){
            if(en.det.currentPlaceId === OPENWORLD_PLACE_ID){
                en.body.position.y = sampleTerrainSurfaceHeight(en.body.position.x, en.body.position.z, OPENWORLD_TERRAIN_VERTS) + en.det.bodyHeight / 2 + 0.05
            }

            const dx = en.body.position.x - en._wanderTarget.x
            const dz = en.body.position.z - en._wanderTarget.z
            const dist = Math.sqrt(dx * dx + dz * dz)

            const WANDER_ARRIVAL_THRESHOLD = 0.6
            if(dist < WANDER_ARRIVAL_THRESHOLD){
                en._wanderTarget = null
                en._isDodging = false
                // _isMoving is shared with the chase branch below - only
                // clear it for a pure wander (no _targetId). If this was a
                // dodge mid-fight, _targetId is still set and _isMoving
                // must stay true so the chase branch picks back up next
                // frame instead of the enemy freezing in place post-dodge.
                if(!en._targetId) en._isMoving = false
            } else {
                _lookTarget.set(en._wanderTarget.x, en.body.position.y, en._wanderTarget.z)
                en.body.lookAt(_lookTarget)

                // a plain wander (not a dodge burst) strolls at its own pace
                // instead of sprinting everywhere it idly roams - opt-in via
                // det.stats.walkSpd (genenemy.ts's own forestDeer/deerBase is
                // the first enemy to set one). Any enemy without it
                // (slime/monolith/lesserdemon etc) falls straight through to
                // the exact same en.spd/speedMult behavior this always had.
                const walkSpd = en.det.stats?.walkSpd
                const isWalking = !en._isDodging && !!walkSpd
                // dodging moves at 3x normal speed for its short burst -
                // see createEnemy.js's own dodge-detection interval
                const speedMult = en._isDodging ? 3 : 1
                const moveSpd = isWalking ? walkSpd : en.spd * speedMult
                _moveVec.set(0, 0, moveSpd * dt)
                en.body.locallyTranslate(_moveVec)

                // findAnimVariants returns [] for a rig with no "walking"
                // clip at all (slime/monolith/lesserdemon's own glbs never
                // modeled one) - falls back to "running" for those instead
                // of silently playing nothing
                const animBase = isWalking && findAnimVariants(en.anims, "walking").length ? "walking" : "running"
                findAnimVariants(en.anims, animBase).forEach(anim => {
                    if (!anim.isPlaying) {
                        anim.speedRatio = .9 + moveSpd * .05
                        anim.play()
                    }
                })
                // no dedicated walk sound asset exists yet (monsterSounds
                // only ever loads a run clip, ${modelStyle}run.mp3) - skip it
                // entirely while walking rather than playing running audio
                // under a walking animation
                if(!isWalking && en.runSound && !en.runSound.isPlaying) en.runSound.play()
            }
            return
        }

        // actionType === "chasing" gate is new - lesserdemon's own
        // actionType is "teleporting" (genenemy.ts's lesserDemonBase): it
        // can still end up with _isMoving/_targetId set true via the exact
        // same generic atkDetection-exit-trigger/emitChase path every other
        // enemy uses (left untouched - harmless, just inert for it now),
        // but should never actually WALK toward its target - it teleports
        // in near the player instead (createEnemy.js's own teleport
        // interval) rather than covering the distance on foot. Every
        // existing enemy's own actionType is already "chasing", so this is
        // a no-op change for all of them.
        if (en._isMoving && en._targetId && en.det.actionType === "chasing") {
            // was scene.getMeshByName() - an O(n) linear scan over every mesh in
            // the scene (thousands, counting village foliage instances), done
            // every frame per chasing enemy. getPlayersOnScene() is a tiny array.
            const targetPlayer = getPlayersOnScene().find(pl => pl.owner === en._targetId)?.body
            if(targetPlayer){
                // planar (Y-ignoring) distance, computed inline instead of via
                // checkDistance() - that helper clones both of its arguments
                // internally, so combined with the Vector3s built just to call
                // it, this avoided ~4 short-lived Vector3 allocations/frame/enemy
                const dx = en.body.position.x - targetPlayer.position.x
                const dz = en.body.position.z - targetPlayer.position.z
                const dist = Math.sqrt(dx * dx + dz * dz)

                // enemies only ever translate horizontally (no physics/gravity) - on
                // openworld's uneven terrain this needs to run regardless of attack
                // range, since nothing else corrects height once the enemy stops
                // advancing. Placing this AFTER the maxDistance return below meant
                // it never ran once close enough to attack - the enemy would freeze
                // at its last pre-attack height and visibly float/sink while attacking.
                if(en.det.currentPlaceId === OPENWORLD_PLACE_ID){
                    en.body.position.y = sampleTerrainSurfaceHeight(en.body.position.x, en.body.position.z, OPENWORLD_TERRAIN_VERTS) + en.det.bodyHeight / 2 + 0.05
                }

                // see emitEnemyChasePosition's own header comment
                // (sockets/emits.js) - keeps tcpEnemies' x/z reasonably
                // fresh while this enemy is actively chasing anyone (a
                // real player or a bot), not just at the next attack/
                // wander report. Throttled per-enemy, not every frame.
                const now = performance.now()
                if(!en._lastChasePosReportAt || now - en._lastChasePosReportAt > CHASE_POS_REPORT_INTERVAL_MS){
                    en._lastChasePosReportAt = now
                    // emitEnemyChasePosition(en._id, en.body.position.x, en.body.position.z)
                }

                if(dist < en.det.maxDistance) return

                _lookTarget.set(targetPlayer.position.x, en.body.position.y, targetPlayer.position.z)
                en.body.lookAt(_lookTarget)
                _moveVec.set(0, 0, en.spd * dt)
                en.body.locallyTranslate(_moveVec)
            }
            
            // I asign the running animation here so if ever a multiplayer connected they wont see the character running while on idle
            findAnimVariants(en.anims, "running").forEach(anim => {
                if (!anim.isPlaying) {
                    anim.speedRatio = .9 + en.spd * .05
                    anim.play()
                }
            })
            if(en.runSound){
                if(!en.runSound.isPlaying) en.runSound.play()
            }
        } else {
            // en.anims.forEach(anim => {
            //     if(anim.name.includes('hit') && anim.isPlaying) return
            // })
        }
    })
    // harness deer (tcp/recources/wagons.ts's own Tharnessdeer) - the
    // primary/driving entity of the wagon/deer pairing now (see wagons.ts's
    // own header comment on the flip). Normally never locally translated/
    // dead-reckoned frame-to-frame off a velocity, just recomputed FRESH
    // every frame from the pure elapsed-time formula (driftless, zero
    // network traffic to stay in sync) UNLESS this specific client has
    // detected a tree in its path, in which case it switches to local
    // per-frame translation instead (see createharnessdeer.js's own
    // resolveHarnessDeerPosition for the full reasoning on why that can
    // only ever be a per-client decision). Run BEFORE the wagon loop below
    // so a wagon can read this exact frame's already-resolved deer position.
    getHarnessDeerOnScene().forEach(deer => {
        if(!deer?.body || !deer.det) return
        if(charState.currentPlace.placeId !== deer.det.currentPlaceId) return

        const resolved = resolveHarnessDeerPosition(scene, deer, dt)
        const { x, z, dirX, dirZ } = resolved
        const y = sampleTerrainSurfaceHeight(x, z, OPENWORLD_TERRAIN_VERTS)
        deer.body.position.set(x, y, z)
        // yaw-only facing, same as every other moving entity in this game -
        // NOT the slope-sampling pitch tilt this used to have
        // (faceAlongGroundSlope, tools/groundOrientation.js), which tipped
        // the deer over onto its side (confirmed in-game)
        if(deer.body.rotationQuaternion) deer.body.rotationQuaternion = null
        deer.body.rotation.y = Math.atan2(dirX, dirZ)

        // stashed (WITH y, unlike a plain resolved{x,z,dirX,dirZ}) so the
        // wagon loop right below can read THIS frame's already-resolved
        // deer position without calling resolveHarnessDeerPosition a
        // second time - that call mutates local tree-dodge state
        // (createharnessdeer.js's own deer._local), so invoking it twice in
        // the same frame for the same deer would double-advance that state
        // instead of just reading it. The wagon loop below only actually
        // uses x/z/dirX/dirZ from this (its own y comes from its own
        // independent ground sample, not the deer's).
        deer._lastResolved = { x, y, z, dirX, dirZ }
    })
    // wagon (tcp/recources/wagons.ts's own Twagon) - no movement law of its
    // own at all anymore, purely a follower: find its paired deer by
    // deerId, read whatever position the deer loop above JUST resolved
    // this exact frame, and trail det.offsetZ behind it. Real Havok
    // physics (createwagon.js's own applyWagonPhysics) - drives the box
    // collider via setLinearVelocity every tick rather than a direct
    // position.set; Y is left to gravity/contact with the terrain, only
    // X/Z and yaw are ever commanded. A wagon whose deer isn't on THIS
    // client's scene right now (not yet in range, or briefly between
    // reCreateMeshesInScene passes) is simply skipped for this frame - its
    // physics body just keeps drifting under gravity/whatever velocity it
    // last had rather than getting a fresh command.
    getWagonsOnScene().forEach(wgn => {
        if(!wgn?.body || !wgn.det) return
        if(charState.currentPlace.placeId !== wgn.det.currentPlaceId) return

        const deer = getHarnessDeerOnScene().find(dr => dr._id === wgn.det.deerId)
        if(!deer?._lastResolved) return

        applyWagonPhysics(wgn, deer._lastResolved)
    })
    getNpcOnScene().forEach(player => {
        if(charState.currentPlace.placeId !== player.currentPlaceId) return
        if(!player.body) return

        updateNpcPatrol(player, dt)

        const isActionPlaying = player.anims.some(anim =>
            (anim.name.includes("act_") || anim.name.includes("hit") || anim.name.includes("walk") || anim.name.includes("running")) && anim.isPlaying
        )
        if (!isActionPlaying) {
            if(player._attacking) return
            
            if(player._moving){
                // return
                switch(player.mode){
                    case "idle":
                        playAnim(player.anims, "walk")
                    break
                    case "fighting":
                        playAnim(player.anims, "running")
                    break
                }
                return
            }
            // switch(player.mode){
            //     case "idle":
            //         playAnim(player.anims, "idle")
            //     break
            //     case "fighting":
            //         playAnim(player.anims, "combatIdle")
            //     break
            // }
            // const loopAnim = player.anims.find(anim => anim.name.toLowerCase() === player.mode.toLowerCase())
            // if (loopAnim && !loopAnim.isPlaying) {
            //     console.log(player.mode)
            //     playAnim(player.anims, player.mode)
            //     switch(player.mode){
            //         case "idle":
            //             playAnim(player.anims, "idle")
            //         break
            //         case "fighting":
            //             playAnim(player.anims, "combatIdle")
            //         break
            //     }
            // }
        }
    })
    if(!getIsSocketOn()) return;
    // enemiez.forEach(en => {
    //     if (en._isMoving && en._targetId) {
    //         en.body.locallyTranslate(new Vector3(0, 0, en.spd * dt))
    //         // I asign the running animation here so if ever a multiplayer connected they wont see the character running while on idle 
    //         en.anims.forEach(anim => {
    //             if (anim.name === "running" && !anim.isPlaying) {
    //                 anim.speedRatio = .9 + en.spd * .05
    //                 anim.play()
    //             }
    //         })
    //     } else {
    //         // en.anims.forEach(anim => {
    //         //     if(anim.name.includes('hit') && anim.isPlaying) return
    //         // })
    //     }
    // })
    // if (npcz.length) {
    //     npcz.forEach(pl => {
    //         if (pl._isMoving) {
    //             pl.body.locallyTranslate(new Vector3(0, 0, pl.spd * dt))
    //             playAnim(pl.anims, "running")
    //         }
    //     })
    // }
}