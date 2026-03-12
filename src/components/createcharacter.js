import { 
    Vector3, 
    Quaternion, 
    MeshBuilder,
    PhysicsAggregate,
    PhysicsShapeType
} from '@babylonjs/core';

export class Character {
    scene = null;
    capsuleHeight = 2;
    capsuleRadius = 0.1;
    characterCapsuleBody = null;
    characterAggregate = null;
    
    jumpHeight = 5;
    fallVelocitySpeed = 0.5;
    isGrounded = false;
    isJumped = false;
    
    constructor(scene, spawnPosition = { x: 10, y: 2, z: 10 }, usePhysics = true) {
        this.scene = scene;
        this.usePhysics = usePhysics;
        this.spawnCharacter(spawnPosition);
    }
    
    spawnCharacter(spawnPos) {
        this.createCapsuleBody(spawnPos);
    }
    
    createCapsuleBody(spawnPos) {
        // Create visible capsule
        this.characterCapsuleBody = MeshBuilder.CreateCapsule(
            "playerCapsule", 
            { 
                radius: this.capsuleRadius, 
                height: this.capsuleHeight 
            }, 
            this.scene
        );
        const head = MeshBuilder.CreateBox("", {depth: .5, width: .25, height: .25}, this.scene)
        head.parent = this.characterCapsuleBody
        head.position.z += 1
        
        this.characterCapsuleBody.position = new Vector3(
            spawnPos.x, 
            spawnPos.y + this.capsuleHeight / 2, 
            spawnPos.z
        );
        this.characterCapsuleBody.rotationQuaternion = Quaternion.Identity();
        
        // Only create physics if enabled
        if (this.usePhysics) {
            this.characterAggregate = new PhysicsAggregate(
                this.characterCapsuleBody,
                PhysicsShapeType.CAPSULE,
                { mass: 1 },
                this.scene
            );
            
            // Lock rotation so capsule doesn't tip over
            this.characterAggregate.body.setMassProperties({
                inertia: new Vector3(0, 0, 0)
            });
            
            this.characterAggregate.body.disablePreStep = false;
            
            // Setup ground check
            this.setupGroundCheck();
        }
    }
    
    setupGroundCheck() {
        if (!this.usePhysics) return;
        
        this.scene.registerBeforeRender(() => {
            if (!this.characterCapsuleBody || !this.characterAggregate) return;
            
            // Ground check via raycast
            const rayOrigin = this.characterAggregate.body.getObjectCenterWorld();
            const rayDirection = new Vector3(0, -1, 0);
            const rayLength = (this.capsuleHeight / 2) + 0.2;
            
            const groundCast = this.scene.getPhysicsEngine()?.raycast(
                rayOrigin,
                rayOrigin.add(rayDirection.scale(rayLength))
            );
            
            if (groundCast) {
                this.isGrounded = groundCast.hasHit && 
                    groundCast.body !== this.characterAggregate.body;
                    
                if (this.isGrounded && this.isJumped) {
                    this.isJumped = false;
                }
            }
        });
    }
    
    // Called by controller to apply movement
    applyMovement(moveDirection, speed) {
        if (!this.usePhysics || !this.characterAggregate) return;
        
        const currentVel = this.characterAggregate.body.getLinearVelocity();
        const forward = this.characterCapsuleBody.getDirection(Vector3.Forward());
        const moveDir = forward.scale(speed);
        
        const velY = this.isGrounded ? currentVel.y : currentVel.y - this.fallVelocitySpeed;
        this.characterAggregate.body.setLinearVelocity(
            new Vector3(moveDir.x, velY, moveDir.z)
        );
    }
    
    // Called by controller to stop movement
    stopMovement() {
        if (!this.usePhysics || !this.characterAggregate) return;
        
        const currentVel = this.characterAggregate.body.getLinearVelocity();
        this.characterAggregate.body.setLinearVelocity(
            new Vector3(0, currentVel.y - this.fallVelocitySpeed, 0)
        );
    }
    
    // Called by controller to apply rotation
    applyRotation(targetQuaternion) {
        if (!this.characterCapsuleBody) return;
        
        const currentQuat = this.characterCapsuleBody.rotationQuaternion;
        const smoothQuat = Quaternion.Slerp(currentQuat, targetQuaternion, 0.15);
        this.characterCapsuleBody.rotationQuaternion = smoothQuat;
        
        // Prevent rotation from physics
        if (this.usePhysics && this.characterAggregate) {
            this.characterAggregate.body.setAngularVelocity(new Vector3(0, 0, 0));
        }
    }
    
    // Called by controller to jump
    jump(moveDir = new Vector3(0, 0, 0)) {
        if (!this.usePhysics || !this.characterAggregate) return;
        if (!this.isGrounded || this.isJumped) return;
        
        this.isJumped = true;
        this.isGrounded = false;
        
        this.characterAggregate.body.applyImpulse(
            new Vector3(moveDir.x, this.jumpHeight, moveDir.z),
            this.characterAggregate.body.getObjectCenterWorld()
        );
    }
    
    // Getters
    getCapsuleBody() {
        return this.characterCapsuleBody;
    }
    
    getPosition() {
        return this.characterCapsuleBody?.position || new Vector3(0, 0, 0);
    }
    
    getIsGrounded() {
        return this.isGrounded;
    }
    
    getIsJumped() {
        return this.isJumped;
    }
}