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
import { getGameStatus } from '../main/main';
import { createTextMesh } from '../gui/textmesh';
import { createAggregate } from '../tools/physics';
const log = console.log

let capsuleHeight = 1.8;
let capsuleRadius = 0.25;

let mainCapsule;

function createMainCapsuleToClone(scene){
    mainCapsule = MeshBuilder.CreateCapsule(
        "capsule-to-clone", 
        { 
            radius: capsuleRadius, 
            height: capsuleHeight 
        }, 
        scene
    );
}

export function createCharacter(scene, spawnPos, container, det, usePhysics){
    const body = createCapsuleBody(scene, spawnPos, det.owner)


    const nameMesh = createTextMesh(scene, body, det.name, "white", {x:0,y: capsuleHeight+1,z:0}, 35);


    return {
        det,
        _id: det.owner,
        name: det.name,
        // spd: det.stats.spd,
        currentPlace: det.currentPlace.placeId,
        body,
        nameMesh,
        // midDetection,
        // headBone,
        // hairs,
        // anims: entries.animationGroups,
        // equipSword,
        // equipHelmet,
        // equipArmor,
        // equipBelt,
        // equipCloak,
        // rotationAnimation,

        // swordWhenHitS,
        // staffWhenHitS,
        // whooshS,
        // punchedS,
        // _attacking: det._attacking ? det._attacking : false,
        // _isMoving: det._isMoving ? det._isMoving : false,
        // _dirTarg: det._dirTarg ? det._dirTarg : {x:0,y:yPos,z:0}
    }
}

function createCapsuleBody(scene, spawnPos, ownerId, usePhysics) {
    if(!mainCapsule){
        createMainCapsuleToClone(scene)
    }
    const body = mainCapsule.clone(`player.${ownerId}`, scene)
    // MeshBuilder.CreateCapsule(
    //     `player.${ownerId}`, 
    //     { 
    //         radius: capsuleRadius, 
    //         height: capsuleHeight 
    //     }, 
    //     scene
    // );

    // createMeshBody(container)

    body.isVisible = true; // hide the capsule mesh, we only use it for physics
    body.isPickable = false; // hide the capsule mesh, we only use it for physics
    
    let head = MeshBuilder.CreateBox("", {depth: .5, width: .25, height: .25}, scene)
    head.isVisible = true
    head.isPickable = false
    head.parent = body
    head.position = new Vector3(0, 0.25, 0.1)
    
    body.position = new Vector3(
        spawnPos.x, 
        spawnPos.y + capsuleHeight / 2, 
        spawnPos.z
    );
    body.rotationQuaternion = Quaternion.FromEulerVector(body.rotation)
    // Only create physics if enabled
    if (usePhysics) {
        characterAggregate = createAggregate(body, {mass: 10}, "capsule", scene)
        
        // Lock rotation so capsule doesn't tip over
        characterAggregate.body.setMassProperties({
            inertia: Vector3.ZeroReadOnly,  // the exact constant the BJS team uses internally
            inertiaOrientation: Quaternion.Identity(),  // required alongside inertia in Havok
        });

        characterAggregate.shape.material = {
            restitution: 0,    // no bounciness
            friction: 1,     // moderate friction for better ground control
        }
        
        characterAggregate.body.disablePreStep = false;
        
        // Setup ground check
        setupGroundCheck();
    }
    return body
}
