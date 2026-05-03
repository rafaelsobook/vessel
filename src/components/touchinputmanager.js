const DRAG_THRESHOLD = 15;
const TAP_THRESHOLD = 20;

export function createTouchInputManager() {
    const fingers = new Map();
    let joystickFingerId = null;
    let overlay = null;

    let onJoystickStart = null;
    let onJoystickMove = null;
    let onJoystickEnd = null;
    let onTap = null;
    let onCameraMove = null;

    function handlePointerDown(e) {
        if (e.pointerType !== 'touch') return;
        e.preventDefault();

        fingers.set(e.pointerId, {
            id: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            currentX: e.clientX,
            currentY: e.clientY,
            prevX: e.clientX,
            prevY: e.clientY,
            role: 'undecided',
        });
    }

    function handlePointerMove(e) {
        const finger = fingers.get(e.pointerId);
        if (!finger) return;

        finger.prevX = finger.currentX;
        finger.prevY = finger.currentY;
        finger.currentX = e.clientX;
        finger.currentY = e.clientY;

        if (finger.role === 'undecided') {
            const dx = finger.currentX - finger.startX;
            const dy = finger.currentY - finger.startY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > DRAG_THRESHOLD) {
                if (joystickFingerId === null) {
                    finger.role = 'joystick';
                    joystickFingerId = finger.id;
                    onJoystickStart?.(finger.startX, finger.startY);
                } else {
                    finger.role = 'camera';
                }
            }
        }

        if (finger.role === 'joystick') {
            onJoystickMove?.(finger.startX, finger.startY, finger.currentX, finger.currentY);
        }

        if (finger.role === 'camera') {
            onCameraMove?.(finger.currentX - finger.prevX, finger.currentY - finger.prevY);
        }
    }

    function handlePointerUp(e) {
        const finger = fingers.get(e.pointerId);
        if (!finger) return;

        if (finger.role === 'undecided') {
            const dx = finger.currentX - finger.startX;
            const dy = finger.currentY - finger.startY;
            if (Math.sqrt(dx * dx + dy * dy) < TAP_THRESHOLD) {
                onTap?.(finger.currentX, finger.currentY);
            }
        }

        if (finger.id === joystickFingerId) {
            joystickFingerId = null;
            onJoystickEnd?.();
        }

        fingers.delete(e.pointerId);
    }

    function attach(targetOverlay) {
        overlay = targetOverlay;
        overlay.addEventListener('pointerdown', handlePointerDown);
        overlay.addEventListener('pointermove', handlePointerMove);
        overlay.addEventListener('pointerup', handlePointerUp);
        overlay.addEventListener('pointercancel', handlePointerUp);
    }

    function detach() {
        if (!overlay) return;
        overlay.removeEventListener('pointerdown', handlePointerDown);
        overlay.removeEventListener('pointermove', handlePointerMove);
        overlay.removeEventListener('pointerup', handlePointerUp);
        overlay.removeEventListener('pointercancel', handlePointerUp);
        overlay = null;
        fingers.clear();
        joystickFingerId = null;
    }

    return {
        attach,
        detach,
        set onJoystickStart(fn) { onJoystickStart = fn; },
        set onJoystickMove(fn) { onJoystickMove = fn; },
        set onJoystickEnd(fn) { onJoystickEnd = fn; },
        set onTap(fn) { onTap = fn; },
        set onCameraMove(fn) { onCameraMove = fn; },
        destroy() {
            detach();
            onJoystickStart = null;
            onJoystickMove = null;
            onJoystickEnd = null;
            onTap = null;
            onCameraMove = null;
        }
    };
}