import { Vector3, Quaternion, MeshBuilder } from '@babylonjs/core';

export class CharacterControls {
    character = null;
    camera = null;
    scene = null;
    
    walkSpeed = 10;
    sprintSpeed = 25;
    currentSpeed = 10;
    
    isMoving = false;
    isSprinting = false;
    
    input = { forward: 0, right: 0 };
    rotationHelper = null;
    
    constructor(character, camera, scene) {
        this.character = character;
        this.camera = camera;
        this.scene = scene;
        
        this.setupRotationHelper();
        this.setupKeyboardInput();
        this.setupMovementLoop();
    }
    
    setupRotationHelper() {
        // Invisible helper for smooth rotation calculations
        this.rotationHelper = MeshBuilder.CreateBox("rotHelper", { size: 0.1 }, this.scene);
        this.rotationHelper.rotationQuaternion = Quaternion.Identity();
        this.rotationHelper.isVisible = false;
    }
    
    setupKeyboardInput() {
        window.addEventListener("keydown", (e) => this.handleKeyDown(e));
        window.addEventListener("keyup", (e) => this.handleKeyUp(e));
    }
    
    handleKeyDown(e) {
        const key = e.key.toLowerCase();
        const camDir = this.camera.getForwardRay().direction.clone();
        camDir.y = 0;
        camDir.normalize();
        
        switch(key) {
            case "w":
                this.input.forward = 1;
                this.isMoving = true;
                break;
            case "s":
                this.input.forward = -1;
                this.isMoving = true;
                break;
            case "a":
                this.input.right = -1;
                this.isMoving = true;
                break;
            case "d":
                this.input.right = 1;
                this.isMoving = true;
                break;
            case "shift":
                this.isSprinting = true;
                this.currentSpeed = this.sprintSpeed;
                break;

        }
        
        // Calculate rotation based on input direction
        this.updateRotation(camDir);
    }
    
    handleKeyUp(e) {
        const key = e.key.toLowerCase();
        
        switch(key) {
            case "w":
                this.input.forward = 0;
                break;
            case "s":
                this.input.forward = 0;
                break;
            case "a":
                this.input.right = 0;
                break;
            case "d":
                this.input.right = 0;
                break;
            case "shift":
                this.isSprinting = false;
                this.currentSpeed = this.walkSpeed;
                break;
            case " ":
                e.preventDefault();
                this.handleJump();
            break;
        }
        
        if (this.input.forward === 0 && this.input.right === 0) {
            this.isMoving = false;
        }
    }
    
    updateRotation(camDir) {
        const { forward, right } = this.input;
        
        if (right === 1) this.rotationHelper.lookAt(camDir, Math.PI/2, 0, 0);
        if (right === -1) this.rotationHelper.lookAt(camDir, -Math.PI/2, 0, 0);
        if (forward === 1) this.rotationHelper.lookAt(camDir, 0, 0, 0);
        if (forward === 1 && right === 1) this.rotationHelper.lookAt(camDir, Math.PI/4, 0, 0);
        if (forward === 1 && right === -1) this.rotationHelper.lookAt(camDir, -Math.PI/4, 0, 0);
        if (forward === -1) this.rotationHelper.lookAt(camDir, Math.PI, 0, 0);
        if (forward === -1 && right === 1) this.rotationHelper.lookAt(camDir, Math.PI - Math.PI/4, 0, 0);
        if (forward === -1 && right === -1) this.rotationHelper.lookAt(camDir, -Math.PI + Math.PI/4, 0, 0);
    }
    
    handleJump() {
        if (!this.character.getIsGrounded() || this.character.getIsJumped()) return;
        
        const forward = this.character.getCapsuleBody().getDirection(Vector3.Forward());
        const moveDir = forward.scale(this.currentSpeed);
        
        this.character.jump(moveDir);
    }
    
    setupMovementLoop() {
        this.scene.registerBeforeRender(() => {
            this.updateMovement();
        });
    }
    
    updateMovement() {
        if (!this.character.getCapsuleBody()) return;
        
        // Apply rotation
        this.character.applyRotation(this.rotationHelper.rotationQuaternion);
        
        // Apply movement
        if (this.isMoving) {
            this.character.applyMovement(Vector3.Forward(), this.currentSpeed);
        } else if (this.character.getIsGrounded()) {
            this.character.stopMovement();
        }
    }
    
    // Public methods for multiplayer or AI control
    setInput(forward, right) {
        this.input.forward = forward;
        this.input.right = right;
        this.isMoving = forward !== 0 || right !== 0;
    }
    
    setSprinting(sprinting) {
        this.isSprinting = sprinting;
        this.currentSpeed = sprinting ? this.sprintSpeed : this.walkSpeed;
    }
    
    dispose() {
        if (this.rotationHelper) {
            this.rotationHelper.dispose();
        }
    }
}