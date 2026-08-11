import { getProjectilesOnScene, getPlayersOnScene, getIsSocketOn, getEnemiesOnScene, getNpcOnScene } from "./worldsocket";
import { getCharState } from "../charactersystem/characterstate.js";
import { playAnim, ANIM_STATE, findAnimVariants } from "../tools/animation.js";
import { getGameStatus } from "../main/main.js";
import { Vector3 } from "@babylonjs/core";
import { updateNpcPatrol } from "../npc/npcPatrol.js";
import { sampleTerrainSurfaceHeight } from 'infterrain'
import { OPENWORLD_PLACE_ID, OPENWORLD_TERRAIN_VERTS } from "../constants/constants.js";

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
const PROJECTILE_GROUND_LOW = 0.4
const PROJECTILE_GROUND_HIGH = 0.95
const PROJECTILE_GROUND_FAR = 3
const PROJECTILE_GROUND_ADJUST_SPEED = 8 // units/sec of vertical nudge


export function removeRenderObservable(_scene){
    if(_scene) _scene.onBeforeRenderObservable.remove(renderCallback)
}
export function addRenderObservable(_scene){
    scene = _scene;
    scene.onBeforeRenderObservable.add(renderCallback)
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
                // dodging moves at 3x normal speed for its short burst -
                // see createEnemy.js's own dodge-detection interval
                const speedMult = en._isDodging ? 3 : 1
                _moveVec.set(0, 0, en.spd * speedMult * dt)
                en.body.locallyTranslate(_moveVec)

                findAnimVariants(en.anims, "running").forEach(anim => {
                    if (!anim.isPlaying) {
                        anim.speedRatio = .9 + en.spd * speedMult * .05
                        anim.play()
                    }
                })
                if(en.runSound && !en.runSound.isPlaying) en.runSound.play()
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