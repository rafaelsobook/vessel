import { Quaternion, MeshBuilder, Vector3 } from '@babylonjs/core';
import { getSceneDet } from "../main/main";

let aggregate = null;

export function attachControllerToThisCharacter(_aggregate) {
    const { scene } = getSceneDet();
    aggregate = _aggregate;
    return setupControls(scene);
}

function setupControls(scene) {
    const camera = scene.activeCamera;

    let walkSpeed = 10;
    let sprintSpeed = 25;
    let currentSpeed = walkSpeed;
    let isMoving = false;

    const input = { forward: 0, right: 0 };

    const rotationHelper = MeshBuilder.CreateBox("rotHelper", { size: 0.1 }, scene);
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

    function handleKeyDown(e) {
        const key = e.key.toLowerCase();

        switch (key) {
            case "w": input.forward =  1; isMoving = true; break;
            case "s": input.forward = -1; isMoving = true; break;
            case "a": input.right   = -1; isMoving = true; break;
            case "d": input.right   =  1; isMoving = true; break;
            case "shift": currentSpeed = sprintSpeed; break;
        }

        updateRotation(getCamDir());
    }

    function handleKeyUp(e) {
        const key = e.key.toLowerCase();

        switch (key) {
            case "w": input.forward = 0; break;
            case "s": input.forward = 0; break;
            case "a": input.right   = 0; break;
            case "d": input.right   = 0; break;
            case "shift": currentSpeed = walkSpeed; break;
        }

        if (input.forward === 0 && input.right === 0) {
            isMoving = false;
            const vel = aggregate.body.getLinearVelocity();
            aggregate.body.setLinearVelocity(new Vector3(0, vel.y, 0));
        }
        console.log("keyup")
    }

    function updateMovement() {
        if (!aggregate) return;

        aggregate.transformNode.rotationQuaternion.copyFrom(rotationHelper.rotationQuaternion);

        if (isMoving) {
            const fwd = rotationHelper.getDirection(Vector3.Forward());
            fwd.y = 0;
            fwd.normalize();
            const vel = aggregate.body.getLinearVelocity();
            aggregate.body.setLinearVelocity(new Vector3(
                fwd.x * currentSpeed,
                vel.y,
                fwd.z * currentSpeed
            ));
        }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    scene.registerBeforeRender(updateMovement);
    return {
        dispose: () => {
            console.log("disposing event listeners")
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        }
    }
}
