// components/controls.js
import { Vector3, Quaternion, MeshBuilder } from '@babylonjs/core';

export function createCharacterControls(character, camera, scene) {
    let walkSpeed = 10;
    let sprintSpeed = 25;
    let currentSpeed = walkSpeed;

    let isMoving = false;
    let isSprinting = false;

    const input = { forward: 0, right: 0 };

    // Invisible helper for smooth rotation calculations
    const rotationHelper = MeshBuilder.CreateBox("rotHelper", { size: 0.1 }, scene);
    rotationHelper.rotationQuaternion = Quaternion.Identity();
    rotationHelper.isVisible = false;
    rotationHelper.isPickable = false;

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

    function getCamDir() {
        const dir = camera.getForwardRay().direction.clone();
        dir.y = 0;
        return dir.normalize();
    }

    function handleJump() {
        if (!character.getIsGrounded() || character.getIsJumped()) return;
        const forward = character.getCapsuleBody().getDirection(Vector3.Forward());
        character.jump(forward.scale(currentSpeed));
    }

    function handleKeyDown(e) {
        const key = e.key.toLowerCase();
        const camDir = getCamDir();

        switch (key) {
            case "w": input.forward =  1; isMoving = true; break;
            case "s": input.forward = -1; isMoving = true; break;
            case "a": input.right   = -1; isMoving = true; break;
            case "d": input.right   =  1; isMoving = true; break;
            case "shift":
                isSprinting = true;
                currentSpeed = sprintSpeed;
                break;
        }

        updateRotation(camDir);
    }

    function handleKeyUp(e) {
        const key = e.key.toLowerCase();

        switch (key) {
            case "w": input.forward = 0; break;
            case "s": input.forward = 0; break;
            case "a": input.right   = 0; break;
            case "d": input.right   = 0; break;
            case "shift":
                isSprinting = false;
                currentSpeed = walkSpeed;
                break;
            case " ":
                e.preventDefault();
                handleJump();
                break;
        }

        if (input.forward === 0 && input.right === 0) {
            isMoving = false;
            character.stopMovement();
        }
    }

    function updateMovement() {
        if (!character.getCapsuleBody()) return;

        character.applyRotation(rotationHelper.rotationQuaternion);

        character.applyMovement(isMoving);
        // if (isMoving) {
            
        // } else if (character.getIsGrounded()) {
        //     // character.stopMovement();
        // }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    scene.registerBeforeRender(updateMovement);

    // Return a small public API (optional, drop anything you don't use)
    return {
        setInput(forward, right) {
            input.forward = forward;
            input.right = right;
            isMoving = forward !== 0 || right !== 0;
        },
        setSprinting(sprinting) {
            isSprinting = sprinting;
            currentSpeed = sprinting ? sprintSpeed : walkSpeed;
        },
        dispose() {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
            rotationHelper.dispose();
        }
    };
}