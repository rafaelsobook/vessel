import { Quaternion, MeshBuilder, Vector3, FreeCamera } from '@babylonjs/core';
import { createCamTricks } from 'babyloncamtricks';
import * as GUI from "@babylonjs/gui";
import { getSceneDet } from "../main/main";
import { setCanPress, getCanPress, getCharState, setCharStateMode, updateMyDetailsOL, evaluateRank, restoreAll, debugLevelUp } from '../charactersystem/characterstate';
import { getPlayersOnScene, reCreateMeshesInScene } from '../sockets/worldsocket';
import { checkIfTokenSaved, stopAnim } from '../tools/tools';
import { ANIM_STATE, playAnim } from '../tools/animation';
import { emitMove, emitStop } from '../sockets/emits';
import { findMyCurrentPlace } from '../states/placestates';
import { runSound, playHalfSound } from '../components/soundSystem';
import { capsuleHeight } from '../charactersystem/createcharacter';
import { openClosePopup } from '../tools/popupUI';
import { getSpawnPos } from '../tools/position';
import { giveAllItems, wipeAllItems } from '../charactersystem/inventory';
import { giveSkill, giveAllSkills, upgradeAllOwnedSkills } from '../components/skillsui';
import { singlecastSkill } from '../staticRecources/skillsData';
import { hideShowAllScreenUI } from '../charactersystem/uimanagement';
import { attachLightning } from '../effects/lightning';
import { checkDistance } from '../creations/creationTools';

let aggregate = null
let myPlayer = null
let rotationHelper = null;
let saveLocTimeout
let checkFallInVoidTimeout = undefined
let isGroundedFlag = true
let modeBeforeAir = null
// highest Y reached during the current airborne stretch - a jump climbs
// before it falls, so "distance fallen" has to be measured from this peak,
// not from wherever they left the ground
let fallPeakY = null
// handle returned by attachLightning() - toggled on/off by repeated "e" presses
let weaponLightning = null

// mirrors renderer.js's player.mode switch - used to tell the fallimpact
// one-shot (see the landing branch in updateMovement()) which loop state to
// settle back into once it finishes, instead of the state it interrupted
const MODE_TO_ANIM_STATE = {
    idle: ANIM_STATE.IDLE,
    fighting: ANIM_STATE.COMBAT_IDLE,
    structed: ANIM_STATE.STRUCTED,
    casting: ANIM_STATE.CASTING,
    minning: ANIM_STATE.MINNING,
}

// reused every physics tick instead of `new Vector3(...)` inline in
// isGrounded()/updateMovement() below - both run unconditionally every tick
const _groundCheckOffset = new Vector3()
const _groundCheckEnd = new Vector3()
const _velocityVec = new Vector3()

// kept for anything still polling ground state directly - the animation
// switch itself now reads player.mode ("inAir" or not) instead
export function getIsGrounded(){
    return isGroundedFlag
}

// same myPlayer reference updateMovement() itself flips to "inAir" on
// takeoff/landing (see attachControllerToThisCharacter()) - lets UI code
// (e.g. uimanagement.js's walk/run/attack buttons) check that without
// reaching into getPlayersOnScene() and re-doing the owner lookup itself
export function getPlayerMode(){
    return myPlayer?.mode
}

export function clearLocTimeOut(){
    clearTimeout(saveLocTimeout)
}

export function getControllerObjects(){
    return { aggregate, rotationHelper }
}
export function relocatePos(body, newPos){
    body.position.copyFrom(newPos)
    // only the local player has a physics aggregate reachable from here - a
    // teleport without zeroing velocity would carry residual fall speed
    // (or whatever momentum it had) straight into the new spot
    if(aggregate?.transformNode === body){
        aggregate.body.setLinearVelocity(Vector3.Zero())
        aggregate.body.setAngularVelocity(Vector3.Zero())
    }
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
export function attachControllerToThisCharacter(_player, scene, allsounds) {
    // const { scene } = getSceneDet();
    aggregate = _player.aggregate;
    myPlayer = _player;
    return setupControls(scene, allsounds);
}

function setupControls(scene, allsounds) {
    const camera = scene.activeCamera;
    const charState = getCharState()
    const placeDetail = findMyCurrentPlace()
    const areaType = placeDetail.areaType;

    // dedicated camera for cinematic camera-tricks (e.g. "1" below) - kept
    // separate from the gameplay ArcRotateCamera so a trick can freely take
    // over scene.activeCamera and hand it back to `camera` when it's done
    const trickCamera = new FreeCamera("camTrickCam", camera.position.clone(), scene)
    const camTrick = createCamTricks(trickCamera, camera)
    
    let runsound
    if(areaType === "room"){
        runsound = allsounds.woodrunS
    }else runsound = allsounds.runningS
    

    let walkSpeed = 1;
    let sprintSpeed = 50;
    let currentSpeed = walkSpeed;
    let isMoving = false;
    let jumpSpeed = 15;
    // both tunable to taste - raise either if small bounces/jitter still flip to "inAir" too easily
    const GROUND_CHECK_MARGIN = 0.4; // extra ray length below the capsule's own bottom, so the check still lands on flat ground even mid-stride or after a small bounce
    const GROUNDED_VELOCITY_TOLERANCE = 5.5; // upward speed still treated as "grounded" (bounce/jitter, not an actual jump - jumpSpeed is 5)

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
            // no footstep/run sound while airborne - moving your input stick mid-jump
            // shouldn't start the sound up; landing/mode-change handles resuming it
            if(value && player.mode !== "inAir"){
                if(!runsound.isPlaying) playHalfSound(runsound)
            }
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
    clearInterval(checkFallInVoidTimeout)
    checkFallInVoidTimeout = setInterval(() => {
        checkVoidFall()
    }, 5000)

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
            case " ": if (!e.repeat) performJump(); break;
        }

        if (isMoving) {
            setPlayerMoving(true)
        }
        updateRotation(getCamDir());
    }
    let hideUIToggle = true
    function handleKeyUp(e) {
        if(!getCanPress()) return
        const key = e.key.toLowerCase();
        
        switch (key) {
            case "w": input.forward = 0; break;
            case "s": input.forward = 0; break;
            case "a": input.right   = 0; break;
            case "d": input.right   = 0; break;
            case "shift": currentSpeed = walkSpeed; break;
            case "c":
                console.log("players ", getPlayersOnScene())
                clearLocTimeOut()
                // myPlayer.body.position.x = 0
                // myPlayer.body.position.z = 200
                // myPlayer.body.position.y = 20
                hideShowAllScreenUI(hideUIToggle)
                hideUIToggle = !hideUIToggle
            break
            case "e":
                if(weaponLightning){
                    weaponLightning.dispose()
                    weaponLightning = null
                } else {
                    // swordMeshes can hold more than one cached weapon (equipSword's
                    // per-name mesh cache, same pattern as helmet/gauntlet/pauldron) -
                    // showHideSword only toggles isVisible on the currently-equipped
                    // one's child meshes, so that's the reliable way to pick it out
                    const equippedSword = myPlayer?.swordMeshes?.find(swrd => swrd.mesh.getChildMeshes().some(m => m.isVisible))
                    if(equippedSword) weaponLightning = attachLightning(scene, equippedSword.mesh, "blue", true)
                }
            break
            case " ":
                console.log(getCharState())
                console.log(checkDistance( {x: 0, y: 0, z: 500}, myPlayer?.body.position))
                
                    
            break
            case "i":
                giveAllItems()
            break
            case "p":
                wipeAllItems()
            break
            case "n":
                giveSkill(singlecastSkill)                
            break
            case "l":
                giveAllSkills()
            break
            case "h":
                upgradeAllOwnedSkills()
            break
            case "f":
                restoreAll()
            break
            case "x":
                debugLevelUp()
            break
            case "1":
                hideShowAllScreenUI(false)
                myPlayer?.characterAnimations?.setMoveSpeedRatio(0.65)
                if(myPlayer?.body) camTrick.playTrickOne(scene, myPlayer.body, {
                    duration: 4,
                    behindHeight: 0,
                    frontHeight: 0,
                    behindDistance: 8,
                    lookHeight: 2,
                    onComplete: () => {
                        console.log("trick 1 complete")
                        hideShowAllScreenUI(true)
                        // myPlayer?.characterAnimations?.setMoveSpeedRatio(1)
                    }
                })
            break
            case "2":
                hideShowAllScreenUI(false)
                if(myPlayer?.body) camTrick.playTrickTwo(scene, myPlayer.body, {
                    startRadius: 10,
                    endRadius: 10,
                    duration: 8,
                    direction: -1,
                    onComplete: () => {
                        hideShowAllScreenUI(true)
                    }
                })
            break
            case "3":
                hideShowAllScreenUI(false)
                if(myPlayer?.body) camTrick.playTrickThree(scene, myPlayer.body, {
                    startHeight: (-capsuleHeight / 2) + 1,
                    endHeight: capsuleHeight / 2 + 0.1,
                    duration: 8,
                    onComplete: () => {
                        hideShowAllScreenUI(true)
                    }
                })
            break
            case "4":
                hideShowAllScreenUI(false)
                if(myPlayer?.body) camTrick.playTrickFour(scene, myPlayer.body, {
                    height: (-capsuleHeight / 2) + 1,
                    lookHeight: (-capsuleHeight / 2) + 0.4,
                    duration: 6,
                    behindDistance: 2,
                    onComplete: () => {
                        hideShowAllScreenUI(true)
                    }
                })
            break
            case "5":
                hideShowAllScreenUI(false)
                if(myPlayer?.body) camTrick.playTrickFive(scene, myPlayer.body, {
                    lookHeight: capsuleHeight / 2,
                    onComplete: () => {
                        hideShowAllScreenUI(true)
                    }
                })
            break
        }

        if (input.forward === 0 && input.right === 0) {
            stopMovementAndSave();
        }
    }

    function isGrounded() {
        const physicsEngine = scene.getPhysicsEngine();
        if (!physicsEngine || !aggregate) return false;

        // Rising out of a jump, the capsule is still within GROUND_CHECK_MARGIN
        // of the floor for the first several ticks (jumpSpeed is only 10 m/s,
        // margin reaches 0.95m below center) - the raycast genuinely still
        // hits the ground during that window, which isn't stale data, it's
        // just too close to tell apart from standing. A real jump (jumpSpeed=5)
        // still clears GROUNDED_VELOCITY_TOLERANCE easily; only small bounce/
        // jitter velocities get tolerated here instead of flipping to "inAir".
        const vel = aggregate.body.getLinearVelocity();
        if (vel.y > GROUNDED_VELOCITY_TOLERANCE) return false;

        const origin = aggregate.body.getObjectCenterWorld();
        _groundCheckOffset.set(0, -(capsuleHeight / 2 + GROUND_CHECK_MARGIN), 0)
        origin.addToRef(_groundCheckOffset, _groundCheckEnd)
        const result = physicsEngine.raycast(origin, _groundCheckEnd);
        return result?.hasHit && result.body !== aggregate.body;
    }

    function performJump() {
        if (!aggregate || !isGrounded()) return;
        if(myPlayer.body) console.log(myPlayer.body.position)

        const charState = getCharState()
        if(charState.currentPlace.placeId === 9 || charState.currentPlace.placeId === 10) return openClosePopup("cannot jump here", true, 1000)
        const vel = aggregate.body.getLinearVelocity();
        aggregate.body.setLinearVelocity(new Vector3(vel.x, jumpSpeed, vel.z));
        // no animation call here - updateMovement()'s next tick sees vel.y > 0.1,
        // isGrounded() flips false immediately, and the mode sync below drives
        // player.mode to "inAir" (renderer.js's per-frame switch takes it from
        // there). A one-shot playAction("falling") used to fire here too, but
        // its own completion callback reset the state back to whatever mode
        // was active before the jump regardless of still being airborne -
        // fighting the per-frame switch every tick and causing the
        // falling/idle flicker.
    }

    const VOID_Y_THRESHOLD = -50; // fell through the level's geometry into empty space - gravity is (0, -9.81, 0), so a void fall drops Y, not Z

    function checkVoidFall() {
        if (!aggregate) return
        if (aggregate.transformNode.getAbsolutePosition().y >= VOID_Y_THRESHOLD) return

        const spawn = getSpawnPos(findMyCurrentPlace())
        relocatePos(aggregate.transformNode, new Vector3(spawn.x, spawn.y, spawn.z))
        openClosePopup("You fell into the void...", true, 1500)

        const state = getCharState()
        if (state) updateMyDetailsOL({...state, x: spawn.x, y: spawn.y, z: spawn.z}, checkIfTokenSaved(), false, true)
    }

    let lastEmit = 0;
    function updateMovement() {

        if (!aggregate) return;
        isGroundedFlag = isGrounded()

        // player.mode drives renderer.js's animation switch directly now -
        // flip it to "inAir" the moment we leave the ground, and restore
        // whatever it was before (idle/fighting/etc) the moment we land.
        if (myPlayer) {
            if (!isGroundedFlag && myPlayer.mode !== "inAir") {
                modeBeforeAir = myPlayer.mode
                myPlayer.mode = "inAir"
                fallPeakY = aggregate.transformNode.position.y
                if(myPlayer.fshadow) myPlayer.fshadow.isVisible = false
                // going airborne mid-stride - setPlayerMoving() already started this and
                // won't be called again until the next press/release, so cut it here
                if(runsound.isPlaying) runsound.stop()
                // same idea for a still-mid-playthrough "fallimpact" - jumping again
                // right after landing leaves it playing at weight 1 with nothing to
                // stop it (performJump() intentionally doesn't call playAction, see
                // its comment), so it visually persists into the new jump/fall
                stopAnim(myPlayer.anims, "fallimpact")
            } else if (!isGroundedFlag && myPlayer.mode === "inAir") {
                // still airborne - keep tracking the highest point reached this
                // stretch, since a jump climbs before it falls back down
                const currentY = aggregate.transformNode.position.y
                if (fallPeakY === null || currentY > fallPeakY) fallPeakY = currentY
            } else if (isGroundedFlag && myPlayer.mode === "inAir") {
                myPlayer.mode = modeBeforeAir ?? "idle"
                modeBeforeAir = null
                if(myPlayer.fshadow) myPlayer.fshadow.isVisible = true
                // landing while still holding a movement key - resume the sound setPlayerMoving()
                // was blocked from starting (or was stopped from) while inAir
                if(isMoving && !runsound.isPlaying) playHalfSound(runsound)

                // hard landing - only react to an actual fall, not every small
                // hop/step off a curb
                const FALL_IMPACT_THRESHOLD = 3
                const fallDistance = fallPeakY !== null ? fallPeakY - aggregate.transformNode.position.y : 0
                if (fallDistance >= FALL_IMPACT_THRESHOLD && !isMoving) {
                    // without an explicit nextState, playAction() falls back to
                    // whatever state was active *before* fallimpact started - which
                    // is still ANIM_STATE.FALLING (renderer.js was setting that every
                    // frame right up to this one), not the mode we just landed into.
                    // That produced a one-frame flash back to the falling pose the
                    // instant fallimpact finished, right before renderer.js's next
                    // tick corrected it to idle/combatIdle - two blends fighting each
                    // other. Telling it up front where to land skips that detour.
                    myPlayer.characterAnimations?.playAction(myPlayer.anims, "fallimpact", 1, null, false, MODE_TO_ANIM_STATE[myPlayer.mode] ?? ANIM_STATE.IDLE)
                }
                fallPeakY = null
            }
        }

        if(!getCanPress()) return
        aggregate.transformNode.rotationQuaternion.copyFrom(rotationHelper.rotationQuaternion);

        if (isMoving && myPlayer?.mode === "casting") {
            // rooted while casting - a movement key held down (or a
            // still-active joystick drag) shouldn't slide the character
            // around mid-cast. Only zeroes horizontal velocity, not vertical -
            // still falls normally if airborne when a cast starts.
            const vel = aggregate.body.getLinearVelocity();
            if (vel.x !== 0 || vel.z !== 0) {
                aggregate.body.setLinearVelocity(new Vector3(0, vel.y, 0));
            }
        } else if (isMoving) {
            const fwd = rotationHelper.getDirection(Vector3.Forward());
            fwd.y = 0;
            fwd.normalize();
            const vel = aggregate.body.getLinearVelocity();

            // setLinearVelocity takes a rate (units/second), not a per-frame
            // delta - Havok's own integrator already multiplies this by real
            // elapsed time each physics substep, which is what makes this
            // framerate-independent already. Scaling it by deltaTime here
            // would double-apply time scaling (and onBeforePhysicsObservable,
            // which this runs on, fires once per fixed-size physics substep,
            // not once per render frame - not a 1:1 deltaTime to begin with).
            _velocityVec.set(fwd.x * currentSpeed, vel.y, fwd.z * currentSpeed)
            aggregate.body.setLinearVelocity(_velocityVec);
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
            clearInterval(checkFallInVoidTimeout);
            camTrick.stop();
            trickCamera.dispose();
        }
    }
}
