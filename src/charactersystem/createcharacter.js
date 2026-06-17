import { 
    Vector3, 
    Quaternion, 
    MeshBuilder,
    PhysicsAggregate,
    PhysicsShapeType,
    PBRMaterial,
    Texture,
    Color3
} from '@babylonjs/core';

import { getGameStatus, getSceneDet } from '../main/main';
import { createTextMesh } from '../gui/textmesh';
import { createAggregate } from '../tools/physics';
import { createColorMat, createMatV2 } from '../tools/materials';
import { getPlayersOnScene, getSocketContainers } from '../sockets/worldsocket';
import { createWeapon } from '../assetcreation/createweapon';
import { pFloat } from '../tools/tools';

let capsuleHeight = 1.5;
let capsuleRadius = 0.25;

export function showHideSword(swordTNode, isVisible){
    swordTNode.getChildMeshes().forEach(mesh => mesh.isVisible = isVisible)
}
export function getPlayerCoord(ownerId){
    const player = getPlayersOnScene().find(pl => pl.owner === ownerId)
    if(!player) return;
    const pos = player.body.position;
    const forward = player.body.getDirection(Vector3.Forward())
    const dirTarg = player.body.position.add(forward)
    return {
        pos:     { x: pFloat(pos.x),     y: pFloat(pos.y),     z: pFloat(pos.z)     },
        dirTarg: { x: pFloat(dirTarg.x), y: pFloat(dirTarg.y), z: pFloat(dirTarg.z) },
        mode: player.mode
    }
}

function createAnimeBodyMaterials(scene, det){
    const { hairColor, clothColor, pantsColor, skinColor } = det
    
    const hairMat = createColorMat("hair_mat", hairColor , scene)
    const clothMat = createMatV2(scene, false, "./images/fabrics/fabric4normal.jpg")
    const pantsMat = createMatV2(scene, false, "./images/fabrics/fabric4normal.jpg")
    const bootsMat = createMatV2(scene, "./images/fabrics/leather1.jpg", "./images/fabrics/leather1.jpg")
    
    clothMat.diffuseColor = new Color3(clothColor.r, clothColor.g, clothColor.b)
    pantsMat.diffuseColor = new Color3(pantsColor.r, pantsColor.g, pantsColor.b)
    const skinMat = createColorMat("skin_mat", skinColor, scene)

    return {
        hairMat,
        clothMat,
        pantsMat,
        skinMat,
        bootsMat
    }
}

export function createSword(scene, swordName, parts, rHand, swordMeshes) {
    const sword = createWeapon(scene, "sword", {x: 0.2, y: 0.2, z: 0}, rHand, parts)
    const toPush = {name: swordName, mesh: sword}
    swordMeshes.push(toPush)
    showHideSword(sword, true)
    return toPush
}

export function equipBoots(itemName, boots) {
    if(!itemName) return
    boots.forEach(boot => {
        if(boot.name === itemName){
            boot.mesh.isVisible = true
        } else boot.mesh.isVisible = false
    })
}

export function equipSword(swordToEquipName, onHand, parts, rHand, scene, swordMeshes) {
    let toEquip = false
    if(!swordMeshes.length) {
        toEquip = createSword(scene, swordToEquipName, parts, rHand, swordMeshes)
    }
    swordMeshes.forEach(swrd => {
        showHideSword(swrd.mesh, false)
        if(swrd.name === swordToEquipName) toEquip = swrd
    })
    if(!toEquip) {
        toEquip = createSword(scene, swordToEquipName, parts, rHand, swordMeshes)
    }
    if(!toEquip) return
    showHideSword(toEquip.mesh, true)
    if(onHand) toEquip.mesh.parent = rHand
}

export function createCharacter(scene, spawnPos, det, usePhysics, isNpc = false){
    const isMeshCreated = scene.getMeshByName(`player.${det.ownerId}`)
    if(isMeshCreated){
        return false
    }
    let swordMeshes = []

    const { mode, _moving, _minning } = det

    const {body, bodytarget, camParent, aggregate} = createCapsuleBody(scene, det, spawnPos, det.owner, usePhysics)

    const containers = getSocketContainers()
    const {root, animationGroups, rHand, belts, cloaks, boots} = createAnimeBody(containers, body, bodytarget, det, scene)

    const nameMesh = createTextMesh(scene, body, det.name, "white", {x:0,y: capsuleHeight,z:0}, 30);

    if(det.items.length){
        det.items.forEach(itm => {
            if(itm.itemCateg === "equipable"){
                if(itm.itemType === "boots" && itm.equiped) equipBoots(itm.name, boots)
                if(itm.itemType === "weapon" && itm.equiped) {
                    const toEquip = createSword(scene, itm.name, itm.parts, rHand, swordMeshes)
                    showHideSword(toEquip.mesh, true)
                }
            }
        })
    }
    if(isNpc) return { det, body, currentPlaceId: det.currentPlaceId, mode, anims: animationGroups}
    return {
        det,
        owner: det.owner,
        name: det.name,
        currentPlaceId: det.currentPlace.placeId,
        body,
        bodytarget,
        camParent,
        aggregate,
        nameMesh,
        anims: animationGroups,
        rHand,
        root,
        mode,
        _moving,
        _minning,
        equipSword: (name, onHand, parts, _rHand) => equipSword(name, onHand, parts, _rHand ?? rHand, scene, swordMeshes),
        equipBoots: (name) => equipBoots(name, boots),

        swordMeshes
    }
}


function createMainCapsuleToClone(scene){
    const mainCapsule = MeshBuilder.CreateCapsule("capsule", 
        { 
            radius: capsuleRadius, 
            height: capsuleHeight 
        }, 
        scene
    );
    mainCapsule.isVisible=false
    mainCapsule.isPickable=false
}
function createMainBodyTargetToClone(scene){
    const bodytarget = MeshBuilder.CreateBox("bodytarget", 
        { 
            height: 4,
            size: 2
        }, 
        scene
    );
    bodytarget.isVisible = false
    bodytarget.isPickable  =false
}
function createAnimeBody(containers, body, bodytarget, det, scene){
    const { animeBody, hairs } = containers
    let headBone, spineBone, rHand

    let belts = []
    let cloaks = []
    let boots = []
    const {hairMat,clothMat,pantsMat,skinMat, bootsMat} = createAnimeBodyMaterials(scene, det)

    const entries = animeBody.instantiateModelsToScene()
    entries.animationGroups.map(ani => ani.name = ani.name.split(" ")[2])
    const mainBodyMeshes = entries.rootNodes[0]
    mainBodyMeshes.parent = body
    mainBodyMeshes.position.y -= .74
    mainBodyMeshes.rotationQuaternion = Quaternion.Identity()

    mainBodyMeshes.getChildren()[0].getChildren().forEach(bne => {
        if(bne.name.includes("pelvis")){            
            spineBone = bne.getChildren()[0].getChildren()[0]
            rHand = bne.getChildren()[0].getChildren()[0].getChildren()[2].getChildren()[0].getChildren()[0].getChildren()[1]
            headBone = bne.getChildren()[0].getChildren()[0].getChildren()[0].getChildren()[0]
        }
    })
    bodytarget.parent = spineBone

    mainBodyMeshes.getChildren().forEach(mes => {
        mes.isPickable = false
        mes.name = mes.name.split(" ")[2].toLowerCase()
        if(mes.name.includes("ref")) return mes.dispose()
        if(mes.name==="hiddenbody") return mes.dispose()
        // log(mes.name)
        
        if(mes.name.includes("mainbody")){
            mes.material = skinMat
        }
        if(mes.name.includes("cloth")){
            mes.name.split(".")[1] !== det.cloth && mes.dispose()
            mes.material = clothMat
        }
        if(mes.name.includes("pants")){
            mes.name.split(".")[1] !== det.pants && mes.dispose()
            mes.material = pantsMat
        }
        if(mes.name.includes("boots")){
            // mes.name.split(".")[1] !== det.boots && mes.dispose()
            mes.isVisible =false
            mes.material = bootsMat
            boots.push({name: mes.name.split(".")[1], mesh:mes, isUsed: false})
        }
        if(mes.name.includes("scalp")){
            mes.material = hairMat
        }
        if(mes.name.includes("belt.")){
            const beltName = mes.name.split(".")[1]
            if(!beltName) return
            
            // const designatedMat = createEquipMat()
            // mes.material = beltMat
            mes.isVisible = false
            belts.push({name: beltName, mesh:mes, isUsed: false})
        }
        if(mes.name.includes("cloak.")){
            const cloakName = mes.name.split(".")[1]
            if(!cloakName) return
            
            // const designatedMat = createEquipMat()
            // mes.material = cloakMat
            mes.isVisible = false
            cloaks.push({name: cloakName, mesh:mes, isUsed: false})
        }
    })
    hairs.forEach(hairMsh => {
        if(hairMsh.name.includes("root")) return hairMsh.parent = headBone
        const hairStyleName = hairMsh.name.split(".")[1]
        if(hairMsh.name.includes("root") || !hairStyleName) return
        if(hairStyleName === det.hair){
            const characterHair = hairMsh.clone(det._id)
            characterHair.material = hairMat
            characterHair.parent = headBone
            characterHair.rotationQuaternion = null
            characterHair.position = new Vector3(0,.45,-.1)
            characterHair.scaling = new Vector3(8,8,8)
            characterHair.isVisible=true
            hairs.push(characterHair)
        }
    })
    return {
        root: mainBodyMeshes,
        animationGroups: entries.animationGroups,
        rHand,
        belts,
        cloaks,
        boots,
    }
}
function createCapsuleBody(scene, det, spawnPos, ownerId, usePhysics) {
    let mainCapsule = scene.getMeshByName("capsule")
    let mainBodyTarget = scene.getMeshByName("bodytarget")
    if(mainCapsule === null){
        createMainCapsuleToClone(scene)
        mainCapsule = scene.getMeshByName("capsule")
    }
    if(mainBodyTarget === null){
        createMainBodyTargetToClone(scene)
        mainBodyTarget = scene.getMeshByName("bodytarget")
    }

    const body = mainCapsule.clone(`player.${ownerId}`, scene)
    const bodytarget = mainBodyTarget.clone(`bodytarget.${ownerId}`, scene)

    body.isVisible = false; // hide the capsule mesh, we only use it for physics
    body.isPickable = false; // hide the capsule mesh, we only use it for physics

    bodytarget.isVisible = false; // hide the capsule mesh, we only use it for physics
    bodytarget.isPickable = false; // hide the capsule mesh, we only use it for physics
    
    let camParent = MeshBuilder.CreateBox("", {depth: .5, width: .25, height: .25}, scene)
    camParent.isVisible = false
    camParent.isPickable = false
    camParent.parent = body
    camParent.position = new Vector3(0, 0.25, 0.1)
    
    body.position = new Vector3(
        spawnPos.x, 
        spawnPos.y + capsuleHeight / 2, 
        spawnPos.z
    );
    body.rotationQuaternion = Quaternion.FromEulerVector(body.rotation)

    if (det._dirTarg) {
        const dx = det._dirTarg.x - spawnPos.x
        const dz = det._dirTarg.z - spawnPos.z
        if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
            body.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), Math.atan2(dx, dz))
        }
    }
    // Only create physics if enabled
    let aggregate
    if (usePhysics) {
        aggregate = createAggregate(body, {mass: 10}, "capsule", scene)
        
        // Lock rotation so capsule doesn't tip over
        aggregate.body.setMassProperties({
            inertia: Vector3.ZeroReadOnly,  // the exact constant the BJS team uses internally
            inertiaOrientation: Quaternion.Identity(),  // required alongside inertia in Havok
        });
        
        aggregate.body.disablePreStep = false;
        
        // Setup ground check
        // setupGroundCheck();
    }
    return {
        body,
        bodytarget,
        camParent, 
        aggregate
    }
}


