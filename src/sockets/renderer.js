import { getProjectilesOnScene, getPlayersOnScene, getIsSocketOn, getEnemiesOnScene, getNpcOnScene } from "./worldsocket";
import { getCharState } from "../charactersystem/characterState.js";
import { playAnim, ANIM_STATE } from "../tools/animation.js";
import { getGameStatus, getSceneDet } from "../main/main.js";
import { Vector3 } from "@babylonjs/core";
import { checkDistance } from "../creations/creationTools.js";

let scene;


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

        proj.body.locallyTranslate(new Vector3(0, 0, proj.spd * dt))
    })

    getPlayersOnScene().forEach(player => {

        if(charState.currentPlace.placeId !== player.currentPlaceId) return
        if(!player.body) return
        if(!player.characterAnimations) return

        player.characterAnimations.tickBlend()

        if(player._attacking || player.characterAnimations.isActionPlaying()) return

        if(player._moving){
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
        }
    })
    getEnemiesOnScene().forEach(en => {
        if (en._isMoving && en._targetId) {
            const targetPlayer = getSceneDet().scene.getMeshByName(`player.${en._targetId}`)
            if(targetPlayer){


                const enPos = en.body.position.clone()
                const targPos = targetPlayer.position

                const dist = checkDistance(new Vector3(enPos.x, targPos.y, enPos.z), targPos)
                if(dist <= 0.25) return console.log(dist)
                en.body.lookAt(new Vector3(targetPlayer.position.x, en.body.position.y, targetPlayer.position.z))
                en.body.locallyTranslate(new Vector3(0, 0, en.spd * dt))
                // console.log(dist)
            }
            
            // I asign the running animation here so if ever a multiplayer connected they wont see the character running while on idle 
            en.anims.forEach(anim => {
                if (anim.name === "running1" && !anim.isPlaying) {
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
            switch(player.mode){
                case "idle":
                    playAnim(player.anims, "idle")
                break
                case "fighting":
                    playAnim(player.anims, "combatIdle")
                break
            }
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