import { Vector3, Quaternion, MeshBuilder } from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { createTouchInputManager } from './touchinputmanager.js';

export function createMobileControls(character, camera, scene) {
    // ── State ──
    let isMoving = false;
    let inputVector = { forward: 0, right: 0 };
    let lastNonZeroInput = { forward: 0, right: 0 };
    let lastInputTimestamp = 0;
    let preserveMomentumUntil = 0;
    let isPuckDown = false;
    let joystickAnchor = { x: 0, y: 0 };

    // ── Sizes ──
    const RING_SIZE = 120;
    const PUCK_SIZE = 50;
    const MAX_RADIUS = RING_SIZE * 0.45;

    // ── Rotation helper (same as desktop controls) ──
    const rotationHelper = MeshBuilder.CreateBox("rotHelperMobile", { size: 0.1 }, scene);
    rotationHelper.rotationQuaternion = Quaternion.Identity();
    rotationHelper.isVisible = false;

    // ── GUI ──
    const advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("MobileUI", true, scene);

    const ringCircle = new GUI.Ellipse("ringCircle");
    ringCircle.width = `${RING_SIZE}px`;
    ringCircle.height = `${RING_SIZE}px`;
    ringCircle.thickness = 0;
    ringCircle.background = "rgba(13, 242, 242, 0.15)";
    ringCircle.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    ringCircle.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    ringCircle.alpha = 0;
    ringCircle.isVisible = false;
    ringCircle.isHitTestVisible = false;
    advancedTexture.addControl(ringCircle);

    const leftPuck = new GUI.Ellipse("leftPuck");
    leftPuck.width = `${PUCK_SIZE}px`;
    leftPuck.height = `${PUCK_SIZE}px`;
    leftPuck.thickness = 0;
    leftPuck.background = "rgba(13, 242, 242, 0.5)";
    leftPuck.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    leftPuck.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    leftPuck.alpha = 0;
    leftPuck.isVisible = false;
    leftPuck.isHitTestVisible = false;
    advancedTexture.addControl(leftPuck);

    // ── Alpha animation ──
    function animateAlpha(control, fromAlpha, toAlpha, duration, onComplete) {
        const startTime = Date.now();
        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            control.alpha = fromAlpha + (toAlpha - fromAlpha) * eased;
            if (progress < 1) {
                if (!isPuckDown) {
                    requestAnimationFrame(animate);
                } else {
                    ringCircle.alpha = 1;
                    leftPuck.alpha = 1;
                }
            } else if (onComplete) {
                onComplete();
            }
        }
        requestAnimationFrame(animate);
    }

    // ── Joystick show/update/hide ──
    function showJoystickAt(x, y) {
        joystickAnchor = { x, y };

        ringCircle.left = x - (RING_SIZE / 2);
        ringCircle.top = y - (RING_SIZE / 2);
        ringCircle.isVisible = true;
        animateAlpha(ringCircle, 0, 1, 150);

        leftPuck.left = x - (PUCK_SIZE / 2);
        leftPuck.top = y - (PUCK_SIZE / 2);
        leftPuck.isVisible = true;
        animateAlpha(leftPuck, 0, 1, 150);

        isPuckDown = true;
        inputVector = { forward: 0, right: 0 };
    }

    function updateJoystickPosition(anchorX, anchorY, currentX, currentY) {
        if (!isPuckDown) return;

        ringCircle.alpha = 1;
        leftPuck.alpha = 1;

        const deltaX = currentX - anchorX;
        const deltaY = currentY - anchorY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const clampedDistance = Math.min(distance, MAX_RADIUS);

        let puckX = deltaX;
        let puckY = deltaY;

        if (distance > MAX_RADIUS) {
            const scale = MAX_RADIUS / distance;
            puckX = deltaX * scale;
            puckY = deltaY * scale;
        }

        leftPuck.left = anchorX + puckX - (PUCK_SIZE / 2);
        leftPuck.top = anchorY + puckY - (PUCK_SIZE / 2);

        if (distance > 0) {
            const normalizedDistance = clampedDistance / MAX_RADIUS;
            inputVector = {
                right:   Math.max(-1, Math.min(1, (deltaX / MAX_RADIUS) * normalizedDistance)),
                forward: Math.max(-1, Math.min(1, -(deltaY / MAX_RADIUS) * normalizedDistance))
            };
        } else {
            inputVector = { forward: 0, right: 0 };
        }
    }

    function hideJoystick() {
        animateAlpha(ringCircle, 1, 0, 300, () => {
            if (!isPuckDown) ringCircle.isVisible = false;
        });
        animateAlpha(leftPuck, 1, 0, 300, () => {
            if (!isPuckDown) leftPuck.isVisible = false;
        });

        if (inputVector.forward !== 0 || inputVector.right !== 0) {
            lastNonZeroInput = { ...inputVector };
        }
        lastInputTimestamp = Date.now();

        inputVector = { forward: 0, right: 0 };
        isPuckDown = false;
    }

    // ── Camera rotation ──
    function rotateCameraByTouch(pixelDeltaX, pixelDeltaY) {
        const cam = camera;
        if (!cam || cam.alpha === undefined) return;
        cam.detachControl();
        cam.alpha -= (pixelDeltaX / window.innerWidth) * Math.PI * 2;
        const upper = cam.upperBetaLimit ?? Math.PI;
        const lower = cam.lowerBetaLimit ?? 0;
        cam.beta += (pixelDeltaY / window.innerHeight) * (upper - lower) * 2;
    }

    // ── Jump ──
    function performJump() {
        const GRACE_MS = 800;
        const joystickInactive = inputVector.forward === 0 && inputVector.right === 0;
        const recentlyMoved = (Date.now() - lastInputTimestamp) < GRACE_MS
            && (lastNonZeroInput.forward !== 0 || lastNonZeroInput.right !== 0);

        if (joystickInactive && recentlyMoved) {
            preserveMomentumUntil = Date.now() + 600;
        }

        if (!character.getIsGrounded() || character.getIsJumped()) return;
        const forward = character.getCapsuleBody().getDirection(Vector3.Forward());
        character.jump(forward.scale(character.currentSpeed ?? 10));
    }

    // ── Rotation update (mirrors desktop controls) ──
    function updateRotation(camDir, forward, right) {
        if (forward === 1  && right === 0)  rotationHelper.lookAt(camDir, 0, 0, 0);
        if (forward === -1 && right === 0)  rotationHelper.lookAt(camDir, Math.PI, 0, 0);
        if (right === 1   && forward === 0) rotationHelper.lookAt(camDir, Math.PI / 2, 0, 0);
        if (right === -1  && forward === 0) rotationHelper.lookAt(camDir, -Math.PI / 2, 0, 0);
        if (forward === 1  && right === 1)  rotationHelper.lookAt(camDir, Math.PI / 4, 0, 0);
        if (forward === 1  && right === -1) rotationHelper.lookAt(camDir, -Math.PI / 4, 0, 0);
        if (forward === -1 && right === 1)  rotationHelper.lookAt(camDir, Math.PI * 0.75, 0, 0);
        if (forward === -1 && right === -1) rotationHelper.lookAt(camDir, -Math.PI * 0.75, 0, 0);
    }

    // ── Per-frame movement (registered in render loop) ──
    function updateMovement() {
        if (!character.getCapsuleBody()) return;

        const joystickActive = inputVector.forward !== 0 || inputVector.right !== 0;
        if (joystickActive) {
            lastNonZeroInput = { ...inputVector };
            lastInputTimestamp = Date.now();
        }

        const inMomentumGrace = !joystickActive && Date.now() < preserveMomentumUntil;
        const effectiveInput = inMomentumGrace ? lastNonZeroInput : inputVector;
        isMoving = effectiveInput.forward !== 0 || effectiveInput.right !== 0;

        // Camera-relative direction
        const camDir = camera.getForwardRay().direction.clone();
        camDir.y = 0;
        camDir.normalize();

        if (isMoving) {
            updateRotation(camDir, effectiveInput.forward, effectiveInput.right);
        }

        character.applyRotation(rotationHelper.rotationQuaternion);
        character.applyMovement(isMoving);
    }

    // ── TouchInputManager wiring ──
    function wireUpTouchInputManager(overlay) {
        overlay.style.pointerEvents = 'auto';

        const touchManager = createTouchInputManager();
        touchManager.onJoystickStart = (x, y) => showJoystickAt(x, y);
        touchManager.onJoystickMove = (ax, ay, cx, cy) => updateJoystickPosition(ax, ay, cx, cy);
        touchManager.onJoystickEnd = () => hideJoystick();
        touchManager.onTap = (x, y) => performJump();
        touchManager.onCameraMove = (dx, dy) => rotateCameraByTouch(dx, dy);
        touchManager.attach(overlay);

        return touchManager;
    }

    // ── Find or wait for the touch overlay ──
    let touchManager = null;

    function attachToOverlay() {
        const overlay = document.getElementById('touch-overlay');
        if (overlay) {
            touchManager = wireUpTouchInputManager(overlay);
        } else {
            const handler = (e) => {
                if (e.detail?.overlay) {
                    touchManager = wireUpTouchInputManager(e.detail.overlay);
                }
                window.removeEventListener('touchOverlayReady', handler);
            };
            window.addEventListener('touchOverlayReady', handler);
        }
    }

    attachToOverlay();
    scene.registerBeforeRender(updateMovement);

    // ── Cleanup ──
    scene.onDisposeObservable.addOnce(() => {
        dispose();
    });

    function dispose() {
        touchManager?.detach();
        scene.unregisterBeforeRender(updateMovement);
        rotationHelper.dispose();
        advancedTexture.dispose();
    }

    return { dispose };
}