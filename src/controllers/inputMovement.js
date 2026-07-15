import { Quaternion, MeshBuilder, Vector3 } from '@babylonjs/core';
import { getSceneDet } from "../main/main";
import { setCanPress, getCanPress, getCharState, setCharStateMode, updateMyDetailsOL, evaluateRank } from '../charactersystem/characterstate';
import { getPlayersOnScene, reCreateMeshesInScene } from '../sockets/worldsocket';
import { checkIfTokenSaved, stopAnim } from '../tools/tools';
import { playAnim } from '../tools/animation';
import { emitMove, emitStop } from '../sockets/emits';
import { findMyCurrentPlace } from '../states/placestates';
import { runSound } from '../components/soundSystem';

let aggregate = null
let rotationHelper = null;
let saveLocTimeout

export function clearLocTimeOut(){
    clearTimeout(saveLocTimeout)
}

export function getControllerObjects(){
    return { aggregate, rotationHelper }
}

export function faceForward(targP, notPlayerBody){
    const scene = getSceneDet().scene
    if(!scene) return

    let fromPos, getCurrentQuat
    if(notPlayerBody){
        // a plain mesh, not physics-driven - rotate its own rotationQuaternion directly
        if(!notPlayerBody.rotationQuaternion) notPlayerBody.rotationQuaternion = Quaternion.Identity()
        fromPos = notPlayerBody.position
        getCurrentQuat = () => notPlayerBody.rotationQuaternion
    }else{
        const charState = getCharState()
        if(!charState) return
        const player = getPlayersOnScene().find(pl => pl.owner === charState.owner)
        if(!player) return
        fromPos = player.body.position
        getCurrentQuat = () => aggregate.transformNode.rotationQuaternion
    }

    const toFacePos = {x: targP.x-fromPos.x, z: targP.z-fromPos.z}
    // computed directly instead of via the shared rotationHelper mesh - updateMovement()
    // copies rotationHelper.rotationQuaternion onto the player's body every single frame,
    // so calling rotationHelper.lookAt() here (e.g. to face an NPC) clobbers that shared
    // state and the player's body snaps to match it the instant canPress comes back on
    const faceAngle = Math.atan2(toFacePos.x, toFacePos.z)
    let faceTargetQuat = Quaternion.RotationAxis(Vector3.Up(), faceAngle)

    let observable = scene.onAfterRenderObservable.add(() => {
        const cur = getCurrentQuat();
        if (faceTargetQuat) {
            Quaternion.SlerpToRef(cur, faceTargetQuat, 0.15, cur);
            if (Math.abs(Quaternion.Dot(cur, faceTargetQuat)) > 0.9998) {
                cur.copyFrom(faceTargetQuat);
                faceTargetQuat = null;
                scene.onAfterRenderObservable.remove(observable);
                // we're turning an NPC to face the player, not the player itself -
                // the caller only froze canPress to stop movement input from
                // fighting this turn, so hand control back the moment it's done
                // instead of waiting on a proximity-exit trigger that can never
                // fire while the player is frozen in place
                if(notPlayerBody) setCanPress(true)
            }
        }
    })
}
export function attachControllerToThisCharacter(_aggregate, scene, allsounds) {
    // const { scene } = getSceneDet();
    aggregate = _aggregate;
    return setupControls(scene, allsounds);
}

function setupControls(scene, allsounds) {
    const camera = scene.activeCamera;
    const charState = getCharState()
    const placeDetail = findMyCurrentPlace()
    const areaType = placeDetail.areaType;
    
    let runsound
    if(areaType === "room"){
        runsound = allsounds.woodrunS
    }else runsound = allsounds.runningS
    

    let walkSpeed = 0.8;
    let sprintSpeed = 5;
    let currentSpeed = walkSpeed;
    let isMoving = false;

    const input = { forward: 0, right: 0 };

    rotationHelper = MeshBuilder.CreateBox("rotHelper", { size: 0.1 }, scene);
    rotationHelper.rotationQuaternion = Quaternion.Identity();
    rotationHelper.isVisible = false;
    rotationHelper.isPickable = false;

    function getCamDir() {
        const dir = camera.getForwardRay().direction.clone();
        dir.y = 0;
        return dir.normalize();
    }

    function updateRotation(camDir) {
        const { forward, right } = input;
        if (right === 1)  rotationHelper.lookAt(camDir, Math.PI / 2, 0, 0);
        if (right === -1) rotationHelper.lookAt(camDir, -Math.PI / 2, 0, 0);
        if (forward === 1)  rotationHelper.lookAt(camDir, 0, 0, 0);
        if (forward === 1  && right === 1)  rotationHelper.lookAt(camDir, Math.PI / 4, 0, 0);
        if (forward === 1  && right === -1) rotationHelper.lookAt(camDir, -Math.PI / 4, 0, 0);
        if (forward === -1) rotationHelper.lookAt(camDir, Math.PI, 0, 0);
        if (forward === -1 && right === 1)  rotationHelper.lookAt(camDir, Math.PI - Math.PI / 4, 0, 0);
        if (forward === -1 && right === -1) rotationHelper.lookAt(camDir, -Math.PI + Math.PI / 4, 0, 0);
    }

    function setPlayerMoving(value) {
        const charState = getCharState()
        if (!charState) return
        const player = getPlayersOnScene().find(pl => pl.owner === charState.owner)
        if(!player) return

        // walking away mid-swing should drop mining same as leaving the ore's
        // trigger zone or unequipping the weapon
        if(value && charState.mode === "minning") setCharStateMode("idle")

        player._moving = value
        if (player) {
            switch(player.mode){
                case "idle":
                    currentSpeed = walkSpeed
                break
                case "fighting":
                    currentSpeed = sprintSpeed
                break
            }
            if(!runsound.isPlaying) runsound.play()
            if(!value) {
                if(runsound.isPlaying) runsound.stop()
            }
        }
    }

    function handleKeyDown(e) {
        if(!getCanPress()) return
        clearTimeout(saveLocTimeout)
        const key = e.key.toLowerCase();

        switch (key) {
            case "w": input.forward =  1; isMoving = true; break;
            case "s": input.forward = -1; isMoving = true; break;
            case "a": input.right   = -1; isMoving = true; break;
            case "d": input.right   =  1; isMoving = true; break;
            case "shift": currentSpeed = sprintSpeed; break;
        }

        if (isMoving) {
            setPlayerMoving(true)
        }
        updateRotation(getCamDir());
    }

    function handleKeyUp(e) {
        if(!getCanPress()) return
        const key = e.key.toLowerCase();
        let state = getCharState()
        let pos
        switch (key) {
            case "w": input.forward = 0; break;
            case "s": input.forward = 0; break;
            case "a": input.right   = 0; break;
            case "d": input.right   = 0; break;
            case "shift": currentSpeed = walkSpeed; break;
            case " ":
                
                const pl = getPlayersOnScene().find(pl => pl.owner === state.owner)
                pos = pl.body.getAbsolutePosition()
                console.log(`x: ${pos.x}, z: ${pos.z}`)
                // evaluateRank(13)
                // evaluateRank(0, { rankNumber: 0, rankLabel: "f"})
                // console.log(state)

                reCreateMeshesInScene()
            break;
            case "c":
                console.log("players ", getPlayersOnScene())
                clearLocTimeOut()
            break
        }

        if (input.forward === 0 && input.right === 0) {
            isMoving = false;
            setPlayerMoving(false)
            const vel = aggregate.body.getLinearVelocity();
            aggregate.body.setLinearVelocity(new Vector3(0, vel.y, 0));
            emitStop()
            clearTimeout(saveLocTimeout)
            saveLocTimeout = setTimeout( async () => {
                const pl = getPlayersOnScene().find(pl => pl.owner === state.owner)
                if(!pl) return
                pos = pl.body.getAbsolutePosition()
                console.log(`saving ...`, pos)
                await updateMyDetailsOL({...state, x: pos.x, y: pos.y, z: pos.z}, checkIfTokenSaved(), false, true)
            }, 5000)
        }
    }

    let lastEmit = 0;
    function updateMovement() {
        if (!aggregate) return;
        if(!getCanPress()) return
 
        aggregate.transformNode.rotationQuaternion.copyFrom(rotationHelper.rotationQuaternion);

        if (isMoving) {
            const fwd = rotationHelper.getDirection(Vector3.Forward());
            fwd.y = 0;
            fwd.normalize();
            const vel = aggregate.body.getLinearVelocity();
            aggregate.body.setLinearVelocity(new Vector3(
                (fwd.x * currentSpeed),
                vel.y,
                (fwd.z * currentSpeed)
            ));
            const now = performance.now();
            if (now - lastEmit > 50) {
                emitMove();
                lastEmit = now;
            }
        }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    const physicsObserver = scene.onBeforePhysicsObservable.add(updateMovement);
    return {
        dispose: () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
            scene.onBeforePhysicsObservable.remove(physicsObserver);
        }
    }
}
