import { Quaternion, MeshBuilder, Vector3 } from '@babylonjs/core';
import * as GUI from "@babylonjs/gui";
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

    // atan2(right, forward) reproduces the same 8 snapped angles the old
    // if-table used for keyboard's -1/0/1 inputs, but also works continuously
    // for the joystick's fractional input - one formula drives both.
    function updateRotation(camDir) {
        const { forward, right } = input;
        if (forward === 0 && right === 0) return;
        rotationHelper.lookAt(camDir, Math.atan2(right, forward), 0, 0);
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

    function stopMovementAndSave() {
        isMoving = false;
        setPlayerMoving(false)
        const vel = aggregate.body.getLinearVelocity();
        aggregate.body.setLinearVelocity(new Vector3(0, vel.y, 0));
        emitStop()
        clearTimeout(saveLocTimeout)
        saveLocTimeout = setTimeout( async () => {
            const state = getCharState()
            const pl = getPlayersOnScene().find(pl => pl.owner === state.owner)
            if(!pl) return
            const pos = pl.body.getAbsolutePosition()
            console.log(`saving ...`, pos)
            await updateMyDetailsOL({...state, x: pos.x, y: pos.y, z: pos.z}, checkIfTokenSaved(), false, true)
        }, 5000)
    }

    // ── Mobile joystick ──────────────────────────────────────────────
    // Puck drag rotates rotationHelper continuously (via updateRotation's
    // atan2), same as keyboard's discrete taps but unsnapped. Camera is
    // detached for the duration of the drag - simplest way to stop
    // ArcRotateCamera's own touch handling from fighting the joystick
    // finger, since both listen on the same canvas.
    const JOYSTICK_RING_SIZE = 120;
    const JOYSTICK_PUCK_SIZE = 50;
    const JOYSTICK_MAX_RADIUS = JOYSTICK_RING_SIZE * 0.45;
    const JOYSTICK_DEADZONE = 4;

    const canvasEl = scene.getEngine().getRenderingCanvas();

    const joystickTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("joystickUI", true, scene);

    const joystickRing = new GUI.Image("joystickRing", "./images/UI/goldenring.webp");
    joystickRing.width = `${JOYSTICK_RING_SIZE}px`;
    joystickRing.height = `${JOYSTICK_RING_SIZE}px`;
    joystickRing.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    joystickRing.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    joystickRing.isVisible = false;
    joystickRing.isHitTestVisible = false;
    joystickTexture.addControl(joystickRing);

    const joystickPuck = new GUI.Ellipse("joystickPuck");
    joystickPuck.width = `${JOYSTICK_PUCK_SIZE}px`;
    joystickPuck.height = `${JOYSTICK_PUCK_SIZE}px`;
    joystickPuck.thickness = 0;
    joystickPuck.background = "rgba(255, 221, 130, 0.65)";
    joystickPuck.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    joystickPuck.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    joystickPuck.isVisible = false;
    joystickPuck.isHitTestVisible = false;
    joystickTexture.addControl(joystickPuck);

    let joystickPointerId = null;
    let joystickAnchor = { x: 0, y: 0 };

    function showJoystick(x, y) {
        joystickAnchor = { x, y };
        joystickRing.left = `${x - JOYSTICK_RING_SIZE / 2}px`;
        joystickRing.top = `${y - JOYSTICK_RING_SIZE / 2}px`;
        joystickRing.isVisible = true;
        joystickPuck.left = `${x - JOYSTICK_PUCK_SIZE / 2}px`;
        joystickPuck.top = `${y - JOYSTICK_PUCK_SIZE / 2}px`;
        joystickPuck.isVisible = true;
    }

    function moveJoystick(x, y) {
        const dx = x - joystickAnchor.x;
        const dy = y - joystickAnchor.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const clampedDistance = Math.min(distance, JOYSTICK_MAX_RADIUS);
        const puckScale = distance > 0 ? clampedDistance / distance : 0;

        joystickPuck.left = `${joystickAnchor.x + dx * puckScale - JOYSTICK_PUCK_SIZE / 2}px`;
        joystickPuck.top = `${joystickAnchor.y + dy * puckScale - JOYSTICK_PUCK_SIZE / 2}px`;

        if (distance < JOYSTICK_DEADZONE) {
            input.forward = 0;
            input.right = 0;
            if (isMoving) stopMovementAndSave();
            return;
        }

        const normalizedDistance = clampedDistance / JOYSTICK_MAX_RADIUS;
        input.right = Math.max(-1, Math.min(1, (dx / JOYSTICK_MAX_RADIUS) * normalizedDistance));
        input.forward = Math.max(-1, Math.min(1, -(dy / JOYSTICK_MAX_RADIUS) * normalizedDistance));

        if (!isMoving) {
            isMoving = true;
            clearTimeout(saveLocTimeout)
            setPlayerMoving(true);
        }
        updateRotation(getCamDir());
    }

    function hideJoystick() {
        joystickRing.isVisible = false;
        joystickPuck.isVisible = false;
        joystickPointerId = null;

        input.forward = 0;
        input.right = 0;
        if (isMoving) stopMovementAndSave();

        camera.attachControl();
    }

    function isInJoystickZone(x, y) {
        return x < window.innerWidth * 0.5 && y > window.innerHeight * 0.35;
    }

    function handleJoystickPointerDown(e) {
        if (e.pointerType !== "touch") return;
        if (e.target !== canvasEl) return; // let taps on HTML UI (chat, buttons...) through untouched
        if (joystickPointerId !== null) return;
        if (!getCanPress()) return;
        if (!isInJoystickZone(e.clientX, e.clientY)) return;

        joystickPointerId = e.pointerId;
        camera.detachControl();
        showJoystick(e.clientX, e.clientY);
    }

    function handleJoystickPointerMove(e) {
        if (e.pointerId !== joystickPointerId) return;
        if (!getCanPress()) return;
        moveJoystick(e.clientX, e.clientY);
    }

    function handleJoystickPointerUp(e) {
        if (e.pointerId !== joystickPointerId) return;
        hideJoystick();
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
            stopMovementAndSave();
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
    window.addEventListener("pointerdown", handleJoystickPointerDown);
    window.addEventListener("pointermove", handleJoystickPointerMove);
    window.addEventListener("pointerup", handleJoystickPointerUp);
    window.addEventListener("pointercancel", handleJoystickPointerUp);
    const physicsObserver = scene.onBeforePhysicsObservable.add(updateMovement);
    return {
        dispose: () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
            window.removeEventListener("pointerdown", handleJoystickPointerDown);
            window.removeEventListener("pointermove", handleJoystickPointerMove);
            window.removeEventListener("pointerup", handleJoystickPointerUp);
            window.removeEventListener("pointercancel", handleJoystickPointerUp);
            joystickTexture.dispose();
            scene.onBeforePhysicsObservable.remove(physicsObserver);
        }
    }
}
