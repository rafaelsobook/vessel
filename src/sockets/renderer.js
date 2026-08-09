import { getProjectilesOnScene, getPlayersOnScene, getIsSocketOn, getEnemiesOnScene, getNpcOnScene } from "./worldsocket";
import { getCharState } from "../charactersystem/characterstate.js";
import { playAnim, ANIM_STATE, findAnimVariants } from "../tools/animation.js";
import { getGameStatus } from "../main/main.js";
import { Vector3 } from "@babylonjs/core";
import { updateNpcPatrol } from "../npc/npcPatrol.js";
import { terrainHeight } from 'infterrain'
import { OPENWORLD_PLACE_ID } from "../constants/constants.js";

let scene;

// reused every frame instead of `new Vector3(...)` inline below - this loop
// runs for every projectile/enemy/npc every single frame, so allocating a
// fresh Vector3 per call adds up to real GC pressure under load
const _moveVec = new Vector3()
const _lookTarget = new Vector3()


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
    getEnemiesOnScene().forEach(en => {
        if(!en) return
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
                en.body.position.y = terrainHeight(en.body.position.x, en.body.position.z) + en.det.bodyHeight / 2 + 0.05
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

        if (en._isMoving && en._targetId) {
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
                    en.body.position.y = terrainHeight(en.body.position.x, en.body.position.z) + en.det.bodyHeight / 2 + 0.05
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