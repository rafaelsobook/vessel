import { Quaternion, MeshBuilder, Vector3 } from '@babylonjs/core';
import { getSceneDet } from "../main/main";
import { setCanPress, getCanPress, getCharState, updateMyDetailsOL } from '../charactersystem/characterstate';
import { getPlayersOnScene } from '../sockets/worldsocket';
import { checkIfTokenSaved, stopAnim } from '../tools/tools';
import { playAnim } from '../tools/animation';
import { emitMove, emitStop } from '../sockets/emits';
import { findMyCurrentPlace } from '../states/placestates';
import { runSound } from '../components/soundSystem';

let aggregate = null
let rotationHelper = null;

export function getControllerObjects(){
    return { aggregate, rotationHelper }
}

export function faceForward(targP){
    const scene = getSceneDet().scene
    if(!scene) return
    const charState = getCharState()
    if(!charState) return
    const player = getPlayersOnScene().find(pl => pl.owner === charState.owner)
    if(!player) return
    const myPos = player.body.position.clone()

    const toFacePos = {x: targP.x-myPos.x, z: targP.z-myPos.z}
    rotationHelper.lookAt(new Vector3(toFacePos.x, rotationHelper.position.y, toFacePos.z),0,0,0);
    let faceTargetQuat = rotationHelper.rotationQuaternion.clone();

    let observable = scene.onAfterRenderObservable.add(() => {
        const cur = aggregate.transformNode.rotationQuaternion;
        if (faceTargetQuat) {
            Quaternion.SlerpToRef(cur, faceTargetQuat, 0.15, cur);
            if (Math.abs(Quaternion.Dot(cur, faceTargetQuat)) > 0.9998) {
                cur.copyFrom(faceTargetQuat);
                faceTargetQuat = null;
                scene.onAfterRenderObservable.remove(observable);
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
    let sprintSpeed = 2;
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
    let saveLocTimeout
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
                console.log(charState)
            break;
        }

        if (input.forward === 0 && input.right === 0) {
            isMoving = false;
            setPlayerMoving(false)
            const vel = aggregate.body.getLinearVelocity();
            aggregate.body.setLinearVelocity(new Vector3(0, vel.y, 0));
            emitStop()

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
