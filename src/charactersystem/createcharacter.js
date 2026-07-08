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
import { createBloodParticle, createBloodSplatter, createCustomizedSmoke } from '../tools/particlesystem';
import { CharacterAnimations } from '../tools/animation';
import { createMesh } from '../creations/creationTools';
import { createHelmetMat } from '../tools/helmetmat';

let capsuleHeight = 1.5;
let capsuleRadius = 0.25;

export function showHideSword(swordTNode, isVisible){
    swordTNode.getChildMeshes().forEach(mesh => mesh.isVisible = isVisible)
}
export function showHideHelmet(helmetMesh, isVisible){
    helmetMesh.isVisible = isVisible
    helmetMesh.getChildMeshes().forEach(mesh => mesh.isVisible = isVisible)
}
export function getPlayerCoord(ownerId){
    const player = getPlayersOnScene().find(pl => pl.owner === ownerId)
    if(!player) return false;
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

export function createCharacter(scene, spawnPos, det, usePhysics, isNpc = false){
    const isMeshCreated = scene.getMeshByName(`player.${det.ownerId}`)
    if(isMeshCreated){
        return false
    }
    let swordMeshes = []
    let helmetMeshes = []
    let hasWeapon = false

    const { mode, _moving, _minning } = det

    const {body, bodytarget, camParent, aggregate} = createCapsuleBody(scene, det, spawnPos, det.owner, usePhysics)
    const auraz = createBodyAura(det, scene, body)
    console.log(det)
    const auraSkill = det.skills.find(skl => skl.name === "flexaura")
    if(auraSkill && auraSkill.isActive) auraz.start()

    const containers = getSocketContainers()
    
    const {root, animationGroups, rHand, belts, cloaks, boots, spineBone, headBone, characterHair} = createAnimeBody(containers, body, bodytarget, det, scene)

    const nameMesh = createTextMesh(scene, body, det.name, "white", {x:0,y: capsuleHeight,z:0}, 30);
    const weaponSocket = createMesh(scene, `weaponsocket.${det.owner}`, {size: 0.5},
    {x:0.8, y:2, z: 1}, 1, false, true, {x: -Math.PI/2 + (Math.PI/10), y:Math.PI/2, z:0.2 })

    weaponSocket.isPickable = false
    weaponSocket.parent = spineBone;
    weaponSocket.addRotation(0,Math.PI/17,0)

    function createSword(swordName, parts, parentMesh) {
        const sword = createWeapon(scene, "sword", {x: 0.2, y: 0.2, z: 0}, parentMesh, parts)
        const toPush = {name: swordName, mesh: sword}
        swordMeshes.push(toPush)
        showHideSword(sword, true)
        hasWeapon = true
        console.log("created sword")
        return toPush
    }

    function equipBoots(itemName) {
        if(!itemName) return
        boots.forEach(boot => {
            if(boot.name === itemName){
                boot.mesh.isVisible = true
            } else boot.mesh.isVisible = false
        })
    }

    function createHelmet(helmetName, metalColor) {
        const template = containers.helmets.find(msh => msh.name.split(".")[1] === helmetName)
        if(!template) return console.warn(`createHelmet: missing helmet "${helmetName}"`)
        const helmet = template.clone(`helmet.${helmetName}.${det._id}`)
        helmet.parent = headBone
        helmet.rotationQuaternion = Quaternion.Identity()
        helmet.position = Vector3.Zero()
        const helmetMat = createHelmetMat(scene, metalColor)
        helmet.material = helmetMat
        helmet.getChildMeshes().forEach(mesh => mesh.material = helmetMat)
        showHideHelmet(helmet, true)
        const toPush = {name: helmetName, mesh: helmet}
        helmetMeshes.push(toPush)
        return toPush
    }

    function equipHelmet(helmetToEquipName, metalColor) {
        if(!helmetToEquipName) return
        let toEquip = false
        if(!helmetMeshes.length) {
            toEquip = createHelmet(helmetToEquipName, metalColor)
        }
        helmetMeshes.forEach(hlm => {
            showHideHelmet(hlm.mesh, false)
            if(hlm.name === helmetToEquipName) toEquip = hlm
        })
        if(!toEquip) {
            toEquip = createHelmet(helmetToEquipName, metalColor)
        }
        if(!toEquip) return
        showHideHelmet(toEquip.mesh, true)
        if(characterHair) characterHair.isVisible = false
    }

    function equipSword(swordToEquipName, onHand, parts) {

        let toEquip = false
        if(!swordMeshes.length) {
            toEquip = createSword(swordToEquipName, parts, rHand)
        }
        swordMeshes.forEach(swrd => {
            showHideSword(swrd.mesh, false)
            if(swrd.name === swordToEquipName) {
                toEquip = swrd
                console.log("no need to create a new sword")
            }

        })

        if(!toEquip) {
            toEquip = createSword(swordToEquipName, parts, rHand)
        }
        if(!toEquip) return
        showHideSword(toEquip.mesh, true)
        if(onHand) toEquip.mesh.parent = rHand
        if(!onHand) toEquip.mesh.parent = weaponSocket
        hasWeapon = true
    }
    function unEquip(itemType){
        switch(itemType){
            case "weapon":
                swordMeshes.forEach(swrd => showHideSword(swrd.mesh, false))
                hasWeapon = false
            break
            case "boots":
                boots.forEach(boot => boot.mesh.isVisible = false)
            break
            case "helmet":
                helmetMeshes.forEach(hlm => showHideHelmet(hlm.mesh, false))
                if(characterHair) characterHair.isVisible = true
            break
        }
    }
    if(det.items.length){
        det.items.forEach(itm => {
            if(itm.itemCateg === "equipable"){
                if(itm.itemType === "boots" && itm.equiped) equipBoots(itm.name)
                if(itm.itemType === "helmet" && itm.equiped) equipHelmet(itm.name, itm.metalColor)
                if(itm.itemType === "weapon" && itm.equiped) {
                    console.log(mode)
                    let swordParent = rHand
                    if(mode === "idle") swordParent = weaponSocket;
                    console.log(swordParent)
                    // createSword(itm.name, itm.parts, rHand)
                    equipSword(itm.name, mode === "fighting", itm.parts)
                }
            }
        })
    }
    if(isNpc) return { det, body, currentPlaceId: det.currentPlaceId, mode, anims: animationGroups, nameMesh, get hasWeapon() { return hasWeapon } }

    const characterAnimations = new CharacterAnimations(animationGroups)
    characterAnimations.playAll()


    const bloodps = createBloodSplatter(scene)
    bloodps.ps.emitter = spineBone

    // const sec = createBloodParticle(scene)
    // sec.emitter =spineBone
    // bloodps.position.y += 1
    
    
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
        characterAnimations,
        rHand,
        root,
        mode,
        _moving,
        _minning,
        equipSword,
        equipBoots,
        equipHelmet,
        unEquip,
        swordMeshes,
        helmetMeshes,
        weaponSocket,
        get hasWeapon() { return hasWeapon },

        bloodps,

        auraz
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
    let characterHair = undefined
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
            characterHair = hairMsh.clone(det._id)
            characterHair.material = hairMat
            characterHair.parent = headBone
            characterHair.rotationQuaternion = null
            characterHair.position = new Vector3(0,.45,-.1)
            characterHair.scaling = new Vector3(8,8,8)
            characterHair.isVisible=true
        }
    })
    return {
        root: mainBodyMeshes,
        animationGroups: entries.animationGroups,
        rHand,
        belts,
        cloaks,
        boots,
        spineBone,
        headBone,
        characterHair
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
    console.log(spawnPos)
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
function getAuraTemplates(scene, aurabox){
    if(scene._auraTemplates) return scene._auraTemplates
    scene._auraTemplates = {
        human: {
            main: createCustomizedSmoke(scene, aurabox, "smoke2", false, {min:1,max:1.1}, {min:1,max:1}, 1, new Vector3(0,1.2,0), {r:0,g:0.22,b:0.55}, {r:0.32,g:0.55,b:0.89}, false, "sphere", 0.6),
            sec:  createCustomizedSmoke(scene, aurabox, "thin1", {min:1,max:1.5}, {min:1,max:5}, false, 1, new Vector3(0,1.2,0), {r:0.09,g:0.49,b:0.81}, {r:0,g:0.76,b:1}, false, "mesh", .4)
        },
        demon: {
            main: createCustomizedSmoke(scene, aurabox, "blood", false, {min:1,max:1.1}, {min:1,max:1}, 1, new Vector3(0,0.2,0), {r:0.8,g:0.11,b:0.11}, {r:0.14,g:0.04,b:0.04}, false, "cone", 0.03),
            sec:  createCustomizedSmoke(scene, aurabox, "thin1", {min:1,max:1.5}, {min:1,max:5}, false, 1, false, {r:0.09,g:0.49,b:0.81}, {r:0.59,g:0,b:0.51}, false, "mesh", .4)
        }
    }
    return scene._auraTemplates
}

function createBodyAura(det, scene, body, auraType = "human"){
    let auras = []
    let aurabox = scene.getMeshByName("aurabox")
    if(!aurabox){
        aurabox = MeshBuilder.CreatePlane("aurabox", { }, scene);
        aurabox.isVisible=false
        aurabox.isPickable=false
    }

    const auramesh = aurabox.createInstance()
 
    auramesh.isVisible = false
    auramesh.parent = body
    auramesh.position.y -= 0.5

    // const templates = getAuraTemplates(scene, aurabox)

    console.log(`${det.name} maxMp: ${det.maxMp}`)
    switch(auraType){
        case "human":
            const auraPS = createCustomizedSmoke(scene, auramesh, "smoke2", false, {min:1,max:1.1}, {min:1,max:1}, 1, new Vector3(0,1.2,0), {r:0,g:0.22,b:0.55}, {r:0.32,g:0.55,b:0.89}, false, "sphere", 0.2)
            auraPS.stop()
            auraPS.emitRate = det.maxMp/12
            auraPS.minScaleY = parseFloat(det.lvl/10)
            auraPS.maxScaleY = parseFloat(det.lvl/4)
            auraPS.updateSpeed = 0.01
            auraPS.isLocal = true
            // setTimeout(() => { auraPS.emitRate = 4000 }, 10000)
            auras.push(auraPS)

            const secAura = createCustomizedSmoke(scene, auramesh, "thin1", {min:1,max:1.5}, {min:1,max:5}, false, 1, new Vector3(0,1.2,0), {r:0.09,g:0.49,b:0.81}, {r:0,g:0.76,b:1}, false, "mesh", .4)
            secAura.stop()
            secAura.emitRate =det.maxMp/15
            secAura.minScaleY = parseFloat(det.lvl/10)
            secAura.maxScaleY = parseFloat(det.lvl/4)
            secAura.isLocal = false
            // setTimeout(() => { secAura.emitRate = 4000 }, 10000)
            auras.push(secAura)
        break;
        case "demon":
            const demonaura1 = templates.demon.main.clone("demonaura1", auramesh)
            demonaura1.stop()
            demonaura1.emitRate = det.lvl * 2
            demonaura1.minScaleY = parseFloat(det.lvl/2)
            demonaura1.maxScaleY = parseFloat(det.lvl/2+2)
            demonaura1.updateSpeed = 0.01
            demonaura1.isLocal = true
            auras.push(demonaura1)

            const demonSecAura = templates.demon.sec.clone("demonSecAura", auramesh)
            demonSecAura.stop()
            demonSecAura.emitRate = Math.floor(det.lvl/2)
            demonSecAura.minScaleY = 2
            demonSecAura.maxScaleY = 4
            demonSecAura.isLocal = false
            auras.push(demonSecAura)
        break;
    }
    auras.start = function(){
        console.log("starting auras")
        console.log(auras)
        auras.forEach(ps => ps.start())
    }
    auras.stop = function(){
        console.log("stoping auras")
        console.log(auras)
        auras.forEach(ps => ps.stop())
    }
    // auras.forEach(ps => ps.start())
    return auras
}


