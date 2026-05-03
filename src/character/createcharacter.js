import { 
    Vector3, 
    Quaternion, 
    MeshBuilder,
    PhysicsAggregate,
    PhysicsShapeType,
    PBRMaterial,
    Texture
} from '@babylonjs/core';
import { playAnim, stopAnim } from '../components/characteranim';
const log = console.log

export class Character {
    scene = null;
    capsuleHeight = 1.8;
    capsuleRadius = 0.25;

    head = null
    characterCapsuleBody = null;
    characterAggregate = null;
    anims = null
    
    currentSpd = 500
    jumpHeight = 10;
    // fallVelocitySpeed = 0.5;
    isGrounded = false;
    isJumped = false;
    fallVelocitySpeed = 0.1
    
    constructor(scene, spawnPosition = { x: 10, y: 2, z: 10 }, usePhysics = true, container) {
        this.scene = scene;
        this.usePhysics = usePhysics;
        this.spawnCharacter(spawnPosition, container);
    }
    
    spawnCharacter(spawnPos, container) {
        this.createCapsuleBody(spawnPos, container);
    }
    
    createCapsuleBody(spawnPos, container) {
        this.characterCapsuleBody = MeshBuilder.CreateCapsule(
            "playerCapsule", 
            { 
                radius: this.capsuleRadius, 
                height: this.capsuleHeight 
            }, 
            this.scene
        );

        this.createMeshBody(container)

        this.characterCapsuleBody.isVisible = false; // hide the capsule mesh, we only use it for physics
        this.characterCapsuleBody.isPickable = false; // hide the capsule mesh, we only use it for physics
        this.head = MeshBuilder.CreateBox("", {depth: .5, width: .25, height: .25}, this.scene)
        this.head.isVisible = false
        this.head.isPickable = false
        this.head.parent = this.characterCapsuleBody
        this.head.position = new Vector3(0, 0.25, 0.1)
        
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
                inertia: Vector3.ZeroReadOnly,  // the exact constant the BJS team uses internally
                inertiaOrientation: Quaternion.Identity(),  // required alongside inertia in Havok
            });

            this.characterAggregate.shape.material = {
                restitution: 0,    // no bounciness
                friction: 1,     // moderate friction for better ground control
            }
            
            this.characterAggregate.body.disablePreStep = false;
            
            // Setup ground check
            this.setupGroundCheck();
        }
    }
    createMeshBody(container){
        const player = container.instantiateModelsToScene();
        player.rootNodes[0].parent = this.characterCapsuleBody
        player.rootNodes[0].position.y = (-this.capsuleHeight/2)+0.1
        player.rootNodes[0].rotationQuaternion = null

        player.animationGroups.forEach(anim => anim.name = anim.name.split(" ")[2].toLowerCase())
        // player.animationGroups.forEach(anim => log(anim.name))
        this.anims = player.animationGroups

        player.rootNodes[0].getChildMeshes().forEach(m => {
            // log(m.name)
            // m.isVisible = false
        })

        playAnim(this.anims, "idle", true)
    }
    setupGroundCheck() {
        if (!this.usePhysics) return;
        
        this.scene.registerBeforeRender(() => {
            if (!this.characterCapsuleBody || !this.characterAggregate) return;
            
            const rayOrigin = this.characterAggregate.body.getObjectCenterWorld();
            const rayDirection = new Vector3(0, -1, 0);

            // Increase length slightly and cast 3 rays: centre + two offset to match capsule radius
            const rayLength = (this.capsuleHeight / 2) + 0.35;  // a bit more generous
            
            const offsets = [
                new Vector3(0, 0, 0),                              // centre
                new Vector3( this.capsuleRadius, 0, 0),            // right edge
                new Vector3(-this.capsuleRadius, 0, 0),            // left edge
            ];

            let hit = false;
            for (const offset of offsets) {
                const origin = rayOrigin.add(offset);
                const groundCast = this.scene.getPhysicsEngine()?.raycast(
                    origin,
                    origin.add(rayDirection.scale(rayLength))
                );
                if (groundCast?.hasHit && groundCast.body !== this.characterAggregate.body) {
                    hit = true;
                    break;
                }
            }

            this.isGrounded = hit;
            if (this.isGrounded && this.isJumped) {
                this.isJumped = false;
            }
        });
    }

    // Called by controller to apply movement
    applyMovement(isMoving) {
        if (!this.usePhysics || !this.characterAggregate) return;

        const dtScale = this.scene.getEngine().getDeltaTime() / 1000;
        const currentVel = this.characterAggregate.body.getLinearVelocity();
        const forward = this.characterCapsuleBody.getDirection(Vector3.Forward());

        // Running jump gets a speed boost so the arc is visible

        // console.log(this.currentSpd)
        const rampedDir = forward.scale(this.currentSpd * dtScale);
        // console.log(rampedDir.x)
        // ── Y ──
        let velY = currentVel.y;
        if (this.isJumped) {
            velY = currentVel.y + (1000 * dtScale);
        } else if (!this.isGrounded) {
            velY = currentVel.y - (this.fallVelocitySpeed * 100 * dtScale);
        }

        // ── XZ ──
        let velX
        let velZ
        if (isMoving) {
            velX = rampedDir.x;
            velZ = rampedDir.z;
        } else if (this.isGrounded) {
            velX = 0;
            velZ = 0;
        } else {
            // Airborne with no input — preserve momentum, no air control
            velX = currentVel.x;
            velZ = currentVel.z;
        }
        if(isMoving) playAnim(this.anims, "running", true)
        this.characterAggregate.body.setLinearVelocity(new Vector3(velX, velY, velZ));
    }

    // In Character.js — stopMovement()
    stopMovement() {
        if (!this.usePhysics || !this.characterAggregate) return;
        
        const currentVel = this.characterAggregate.body.getLinearVelocity();

        const velY = currentVel.y  

        stopAnim(this.anims, "running")
        this.characterAggregate.body.setLinearVelocity(
            new Vector3(0, velY, 0)
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
        
        // DON'T use applyImpulse with zero-inertia bodies in Havok
        // SET the velocity directly instead
        const currentVel = this.characterAggregate.body.getLinearVelocity();
        this.characterAggregate.body.setLinearVelocity(
            new Vector3(moveDir.x, this.jumpHeight, moveDir.z)
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