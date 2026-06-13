import {  MeshBuilder, Quaternion, DirectionalLight,HemisphericLight, PointLight, Scene, Scalar, Matrix,ArcRotateCamera, FreeCamera, ParticleSystem, ActionManager, ExecuteCodeAction, SceneLoader, Color3, Vector3, PBRMaterial, StandardMaterial, Texture} from "@babylonjs/core"
import {SkyMaterial} from "@babylonjs/materials"
// import "babylonjs-materials"

import { openCloseInteractBtn, openClosePopup } from "../tools/popupUI";
// import { emitOpenTreasure, emptyAllArrays, getAllTreasuresOnScene } from "../characterSystem/websocket.js"


// const {BABYLON} = Bmodules

export function freeze(mesh){
    mesh.material?.freeze()
    mesh.freezeWorldMatrix()
}

export function createSky(light, scene, isNight){
   
    // light.groundColor = new Color3(1, 1, 1);
 
    // const box = MeshBuilder.CreateSphere("plane",{diameter:1000}, scene);
    // box.position.y = 0;

	// const gradientMaterial = new GradientMaterial("grad", scene)
    // gradientMaterial.topColor = new Color3(0.69, 1, 0.65, 0.47);
    // gradientMaterial.bottomColor = new Color3(0.58, 0.81, 0.81);
    // gradientMaterial.offset = 0.5;
    // gradientMaterial.smoothness = 1;
    // gradientMaterial.scale = 0.007
    // gradientMaterial.backFaceCulling=false
    // box.material = gradientMaterial;
    // light.specular = new Color3(0.69, 1, 0.65, 0.47);

     // Create a skybox
     const skybox = MeshBuilder.CreateBox("skyBox", {size: 1000}, scene);
     skybox.infiniteDistance = true;
 
     // Create SkyMaterial and apply it to the skybox
     const skyMaterial = new SkyMaterial("skyMaterial", scene);
     skyMaterial.backFaceCulling = false;
 
     // Adjust sky material properties

    if(isNight){
        skyMaterial.inclination = 0.5; // Adjust the sky inclination (0-1)
        skyMaterial.turbidity = 15; // Adjust the sky turbidity
        skyMaterial.luminance = 0.1; // Adjust the sky luminance
        skyMaterial.rayleigh = 2; // Adjust the sky rayleigh
        light.intensity = .3
        // skyMaterial.useSunPosition = true;
        // light.position = skyMaterial.sunPosition
        // skyMaterial.sunPosition = light.position; // Sync with directional light
    }else{
        light.intensity = .9
        skyMaterial.inclination = 0.2; // Sun position (0 is sunrise, 0.5 is noon, 1 is sunset)
        skyMaterial.turbidity = 2; // Lower turbidity for a clearer sky
        skyMaterial.luminance = 1; // Higher luminance for a brighter sky
        skyMaterial.rayleigh = 2; // Adjust the scattering of light
    }
    skybox.material = skyMaterial;
}
export function createMaterial(scene, textureFileName, colorTexture, uVscaleTex, completeTexDet){
    
    const material = new StandardMaterial(textureFileName, scene)
    
    if(completeTexDet){
        let texArray = []
        const normalTex = new Texture(`./images/modeltex/${completeTexDet.name}normal.jpg`,scene)
        const roughTex = new Texture(`./images/modeltex/${completeTexDet.name}rough.jpg`,scene)
        if(completeTexDet.diffuse){
            const diffTex = new Texture(`./images/modeltex/${completeTexDet.name}.jpg`,scene)
            texArray.push(diffTex)
        }
        if(normalTex) {
            material.bumpTexture = normalTex
            texArray.push(normalTex)
            material.bumpScale = 1
        }else console.warn("no normal texture ", completeTexDet.name)

        if(roughTex) {
            material.specularTexture = roughTex
            texArray.push(roughTex)
        }else material.specularColor = new Color3(.2,.2,.2)
        // if(disTex) {
        //     material.displacementTexture = disTex
        //     texArray.push(disTex)
        // }
        texArray.forEach(tex => {
            tex.uScale = uVscaleTex
            tex.vScale = uVscaleTex
        })
    } 
    if(!colorTexture || colorTexture === undefined){
        const matTex = new Texture(`./images/modeltex/${textureFileName}.jpg`, scene, false, false)
        material.diffuseTexture = matTex   
        if(uVscaleTex){
            matTex.uScale = uVscaleTex
            matTex.vScale = uVscaleTex
        }        
        return material
    }
    if(textureFileName.includes("hair") || textureFileName.includes("skin")){
        material.emissiveColor = new Color3(colorTexture.r,colorTexture.g,colorTexture.b)
        if(textureFileName.includes("hair")) material.specularColor = new Color3(0,0,0)
        material.roughness = 1  
    }else{
        material.diffuseColor = new Color3(colorTexture.r,colorTexture.g,colorTexture.b)
        // material.specularColor = new Color3(.6,.6,.6)
        material.roughness = .5
    }  
    material.backFaceCulling = false
    // material.roughness = 1
    return material
}
export function createCompleteMat(scene, textureName, uvScale){
    const mat = new StandardMaterial("containerMat")
    
    const normalTex = new Texture(`./images/modeltex/${textureName}normal.jpg`,scene)
    const roughTex = new Texture(`./images/modeltex/${textureName}rough.jpg`,scene)
    const diffTex = new Texture(`./images/modeltex/${textureName}.jpg`,scene)
    const texArray = [normalTex, roughTex, diffTex]

    mat.diffuseTexture = diffTex
    mat.bumpTexture = normalTex
    mat.specularTexture = roughTex
    mat.bumpScale = 1

    texArray.forEach(tex => {
        tex.uScale = uvScale
        tex.vScale = uvScale
    })
    return mat
}
export function createMaterialFromDir(scene, _directory,textureDetail){
    const {diff,normal} = textureDetail
    const tex1 = new Texture(`${_directory}/${diff}.jpg`, scene, false, false)
    const tex1normal = new Texture(`${_directory}/${normal}.jpg`, scene, false, false)
   
    const mat = new StandardMaterial(`${diff}Mat`, scene)
    mat.diffuseTexture = tex1
    mat.bumpTexture = tex1normal
    mat.backFaceCulling = false
    mat.specularColor = new Color3(1,1,1)
    return mat
}
export function createItemMaterial(scene, itemType,textureName){
    
    const tex1 = new Texture(`./images/textures/${itemType}/${textureName}.jpg`, scene, false, false)
    const tex1normal = new Texture(`./images/textures/${itemType}/${textureName}normal.jpg`, scene, false, false)
    const tex1rough = new Texture(`./images/textures/${itemType}/${textureName}rough.jpg`, scene, false, false)

    const mat = new StandardMaterial(`${textureName}Mat`, scene)
    mat.diffuseTexture = tex1
    mat.bumpTexture = tex1normal
    mat.specularTexture = tex1rough
    // mat.bumpScale = 1
    // mat.metallic = itemType === "weapon" ? 1 : .2
    mat.backFaceCulling = false
    // mat.specularColor = new Color3(1,1,1)
    return mat
}
export function createMonsterMaterial(scene, mosterModelStyle,textureName){

    const tex1 = new Texture(`./images/textures/enemy/${mosterModelStyle}/${textureName}.jpg`, scene, false, false)
    // const tex1normal = new Texture(`./images/textures/enemy/${mosterModelStyle}/${textureName}normal.jpg`, scene, false, false)
    // const tex1rough = new Texture(`./images/textures/enemy/${mosterModelStyle}/${textureName}rough.jpg`, scene, false, false)
    if(!tex1){
        alert("no texture 1")
        console.warn(mosterModelStyle)
        console.warn(textureName)
    }
    let mat = scene.getMaterialByName(`${textureName}Mat`)
    if(!mat){
        mat = new StandardMaterial(`${textureName}Mat`, scene)
    }
    mat.diffuseTexture = tex1
    // if(tex1normal) mat.bumpTexture = tex1normal
    // if(tex1rough) mat.specularTexture = tex1rough
    // mat.bumpScale = 1
    mat.backFaceCulling = false
    // mat.specularColor = new Color3(.2,.2,.2)
    return mat
}
export function createMesh(scene, meshName, size, pos, visibility, isVisible, hasActionManager, rotations){
    const mesh = MeshBuilder.CreateBox(meshName, size, scene)
    mesh.position = new Vector3(pos.x,pos.y,pos.z);
    mesh.isVisible = isVisible
    mesh.isPickable = false
    if(isVisible) mesh.visibility = visibility
    if(rotations)mesh.addRotation(rotations.x,rotations.y,rotations.z)
    if(hasActionManager) mesh.actionManager = new ActionManager()
    return mesh
}
export function createClone(toClone, pos, rotatY, cloneName, willNofFreeze, scaleFloat){
    if(!toClone) return    
    const cloned = toClone.clone(cloneName ? cloneName : toClone.name)
    cloned.parent = null
    cloned.position = new Vector3(pos.x,pos.y ? pos.y : 0, pos.z)
    if(rotatY) cloned.addRotation(0,rotatY,0)
    cloned.checkCollisions = true;    
    if(scaleFloat) cloned.scaling.scaleInPlace(scaleFloat)
    if(willNofFreeze) return cloned
    freeze(cloned)    
    return cloned
}
// when using createIns take caution that the position you set will be depending on the original mesh position
export function createIns(toClone, pos, rotatY, cloneName, willNofFreeze, scaleFloat){
    if(!toClone) return
    const cloned = toClone.createInstance(cloneName ? cloneName : toClone.name)
    cloned.position = new Vector3(pos.x,pos.y ? pos.y : cloned.position.y, pos.z)
    // using rotateY will rotate it from somewhere in origin
    if(rotatY) cloned.addRotation(0,rotatY,0)
    cloned.checkCollisions = true;    
    if(scaleFloat) cloned.scaling.scaleInPlace(scaleFloat)
    if(willNofFreeze) return cloned
    freeze(cloned)    
    return cloned
}
export function createTreasure(scene,heroMidDetection, treasureName, treasureDet, treasureType, treasureRootDetail, pos, rotateY){
    
    const treasure = createClone(treasureRootDetail.treasureMesh, pos, rotateY, treasureName, true)
    treasure.position.y = pos.y
    // kaya ko nilagay to para madali lang idispose yung actionmanager after
    treasure.actionManager = new ActionManager(scene)
    switch(treasureType){
        case "normal":
            treasure.material = treasureRootDetail.treasure1Mat
        break
    }
    
    // regActionEnter(treasure, heroMidDetection, () => {

    //     const existingTreasure = getAllTreasuresOnScene().find(tres => tres.itemId === treasureDet.itemId)
    //     if(!existingTreasure) return openClosePopup('Treasure Empty')
    //     // if(getPointerTargetName()){
    //     //     if(getPointerTargetName().includes('treasure')) emitOpenTreasure(existingTreasure.itemId)
    //     // }
        
    //     // setCallBackForInteractBtn( () => {
    //     //     // first will send it to the socket io
    //     //     // when socket IO receives the request the treasure will be none claimable to others
    //     //     // also when socket IO receives when it will return to the clients it will dispose the and remove action manager of the treasure so 
    //     //     // do not use your hero body action manager because it will be hard to dispose the action manager
    //     //     // from the socket io to the client will then process
    //     //     console.log("receiving ", treasureDet)
    //     //     emitOpenTreasure(treasureDet.itemId)
    //     //     openCloseInteractBtn("normal", false)
    //     // })
    //     // openCloseInteractBtn("normal", true)
    // })
    // regActionExit(treasure, heroMidDetection, () => {
    //     setCallBackForInteractBtn(false)
    //     openCloseInteractBtn("normal", false)
    // })
    return treasure
}
export function putFakeShadow(parentOrPos, fakeShadowRoot, sizeShadow, posY, visibility, localRotateX){
    const newFakeShadow = fakeShadowRoot.createInstance('shadow')
    newFakeShadow.parent = null
    newFakeShadow.rotationQuaternion = null;
    newFakeShadow.visibility = visibility ? visibility : 1
    if(!parentOrPos.x) newFakeShadow.parent = parentOrPos
  
    if(posY) newFakeShadow.position = new Vector3(0,posY,0)
    if(sizeShadow) {
        newFakeShadow.scaling = new Vector3(sizeShadow,.1,sizeShadow)
    }
    if(parentOrPos.x){
        newFakeShadow.position.x = parentOrPos.x
        newFakeShadow.position.z = parentOrPos.z
    }
    if(localRotateX) newFakeShadow.addRotation(localRotateX,0,0)
    newFakeShadow.isPickable = false
    return newFakeShadow
}
export function createMainShadow(scene){
    const fakeShadow = MeshBuilder.CreateGround("fakeShadow", {width: .9, height: .9}, scene)
    const fakeShadowMat = new StandardMaterial("fakeShadowMat", scene);
    fakeShadowMat.diffuseTexture = new Texture("./images/modeltex/fakeShadow.png", scene)
    
    fakeShadow.material = fakeShadowMat
    fakeShadowMat.specularColor = new Color3(0,0,0)
    fakeShadowMat.diffuseTexture.hasAlpha = true;
    fakeShadowMat.useAlphaFromDiffuseTexture = true;
    fakeShadow.position.y = 100
    fakeShadowMat.backFaceCulling = false
    freeze(fakeShadow)
    return fakeShadow
}


export function createOriginalMarking(scene, pos, widthHeight, rots, textureName, markName, visibility){
    const markingMesh = MeshBuilder.CreateGround(markName ? markName : "markMesh", widthHeight, scene)
    const mat = new StandardMaterial("markingmat", scene);
    mat.diffuseTexture = new Texture(`./images/markings/${textureName}.png`, scene)
    
    markingMesh.material = mat
    mat.specularColor = new Color3(0,0,0)
    mat.diffuseTexture.hasAlpha = true;
    mat.useAlphaFromDiffuseTexture = true;
    mat.backFaceCulling = false
    markingMesh.position = new Vector3(pos.x,pos.y,pos.z)
    markingMesh.addRotation(rots.x,rots.y,rots.z)
    if(visibility) markingMesh.visibility = visibility
    freeze(markingMesh)
    return markingMesh
}
// export function regActionEnter(mesh, toCollideMesh, callback){
//     mesh.actionManager.registerAction(new ExecuteCodeAction(
//         {
//             trigger: ActionManager.OnIntersectionEnterTrigger,
//             parameter: toCollideMesh
//         }, e => {
//             callback(toCollideMesh)
//         }
//     ))
// }
// export function regActionExit(mesh, toCollideMesh, callback){
//     mesh.actionManager.registerAction(new ExecuteCodeAction(
//         {
//             trigger: ActionManager.OnIntersectionExitTrigger,
//             parameter: toCollideMesh
//         }, e => {
//             callback(toCollideMesh)
//         }
//     ))
// }


export function createPath(scene, widthHeight, pos, heroBody, callback){
    const block = MeshBuilder.CreateBox("portal", widthHeight, scene)
    block.position = new Vector3(pos.x,pos.y,pos.z)
    // regActionEnter(heroBody,block, (collidedMesh) => {
    //    callback()
    // })
    // regActionExit(heroBody, block, () => openCloseInteractBtn("none", false))
    // const particleSystem = createCustomizedSmoke(scene, block, "thin1", {min: 1,max:3}, {min:.4,max:5.8}, false, 40, new Vector3(0,.5,0), {r: 1,g: 0.94, b:.13}, {r: 1,g: 1, b:.33}, false, "mesh", false, false)
    // particleSystem.start()
    block.isVisible =false
    block.isPickable = false
    freeze(block)
}
export function createGround(scene, widthHeight, textureFileName, groundMeshes){
    const texturingType = typeof textureFileName
    if(texturingType === "object") {
        groundMeshes.forEach(grnd => {
            const groundPart = textureFileName.find(det => det.name === grnd.name)
            if(groundPart){
                const gMat = createMaterial(scene, groundPart.tex, false, groundPart.uScale)
                grnd.material = gMat
                grnd.position.y = groundPart.posY ? groundPart.posY : 0
                if(groundPart.hasNormal){                    
                    const normalTex = new Texture(`./images/modeltex/${groundPart.tex}normal.jpg`)
                    normalTex.uScale = groundPart.uScale
                    normalTex.vScale = groundPart.uScale
                    if(normalTex) console.warn(groundPart.tex, " has normal tex")
                    
                }
                freeze(grnd)
            }
        })
    }

    // const ground = new MeshBuilder.CreateGround("ground", widthHeight, scene)
    // const groundMat = new StandardMaterial("groundMat", scene)
    // const groundTex = new Texture(`./images/modeltex/${textureFileName}.jpg`, scene)
    // groundMat.diffuseTexture = groundTex
    // groundMat.specularColor = new Color3(0,0,0)

    // groundTex.uScale = Math.floor(widthHeight.height * .3)
    // groundTex.vScale = Math.floor(widthHeight.height * .3)
    // ground.material = groundMat
    // return ground
}
export function createPlainGround(scene, widthHeight, textureName, uAndVscale, pos, otherRoughOrNormal){
    const g = MeshBuilder.CreateGround('ground', widthHeight, scene)
    g.position = new Vector3(pos.x,pos.y,pos.z)

    const gMat = new StandardMaterial("gMat", scene)

    const diffTex = new Texture(`./images/modeltex/${textureName}.jpg`, scene, false, false)
    let roughTex
    let normalTex
    if(otherRoughOrNormal){
        console.warn(otherRoughOrNormal)
        roughTex = new Texture(`./images/modeltex/${otherRoughOrNormal.texName}rough.jpg`, scene, false, false)
        normalTex = new Texture(`./images/modeltex/${otherRoughOrNormal.texName}normal.jpg`, scene, false, false)
        const texArr = [roughTex,normalTex]
        texArr.forEach(tex => {
            if(!tex) return
            tex.uScale = otherRoughOrNormal.uAndVscale
            tex.vScale = otherRoughOrNormal.uAndVscale
        })
    }else{
        roughTex = new Texture(`./images/modeltex/${textureName}rough.jpg`, scene, false, false)
        normalTex = new Texture(`./images/modeltex/${textureName}normal.jpg`, scene, false, false)
        const texArr = [diffTex,roughTex,normalTex]
  
        texArr.forEach(tex => {
            if(!tex) return
            tex.uScale = uAndVscale
            tex.vScale = uAndVscale
        })
    }
    diffTex.uScale = uAndVscale
    diffTex.vScale = uAndVscale

    if(diffTex) gMat.diffuseTexture = diffTex
    if(roughTex) gMat.roughnessTexture = roughTex
    if(normalTex) gMat.normalTexture = normalTex
    gMat.specularColor = new Color3(1,1,1)
    g.material = gMat
    freeze(g)
    return g
}
export function mergeMesh(_ArrayOfmeshes, willHide, isQuaternionNull){
    const mesh = Mesh.MergeMeshes(_ArrayOfmeshes, true, false, undefined, false, true)
    mesh.isVisible = !willHide
    if(isQuaternionNull) mesh.rotationQuaternion = null
    return mesh
}
export function createContainer(scene, toClone, pos, rotatY, scale, houseRoot){
    const houseContainer = toClone.clone("groundContainer")
    houseContainer.position = new Vector3(pos.x, houseContainer.position.y,pos.z)
    if(rotatY) houseContainer.addRotation(0,rotatY,0)
    if(scale) houseContainer.scaling = new Vector3(scale,houseContainer.scaling.y,scale)

    if(houseRoot){
        const houseClone = houseRoot.clone("wall")
        houseClone.position = new Vector3(pos.x, houseContainer.position.y,pos.z)
        if(rotatY) houseClone.addRotation(0,rotatY,0)
    }
    freeze(houseContainer)
}

//  ANIMATIONS
export function createAnimationFloat(scene, mesh, animName, toAnimatePosOrRot, keys, willLoop, cbAfterAnimationEnd){
    const fps = 30
    const animation = new Animation(animName, toAnimatePosOrRot, fps, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);

    animation.setKeys(keys)
    mesh.animations = [animation]
    scene.beginAnimation(mesh, 0, fps*keys.length, willLoop, 1, ()=> cbAfterAnimationEnd &&cbAfterAnimationEnd())
}
// particle system
// let magicParticles;
// export function createMagicParticles(scene){
//     const fireExp1 = createParticle("explodeTex", 10, {x:0,y:.3,z:0}, .05, { min: .3,max: .8 }, 8,8.5, 0, "sphere", true, false, {r:0.86, g:0, b:0}, false)

//     fireExp1.addSizeGradient(0, .8, 0.9);
//     fireExp1.addSizeGradient(0.3, 1, 11);
//     fireExp1.targetStopDuration = 1
//     fireExp1.createPointEmitter(new Vector3(0,0,0), new Vector3(0,0,0))
//     fireExp1.isLocal = true
//     fireExp1.direction1 = new Vector3(0,0,0)
//     fireExp1.direction2 = new Vector3(0,0,0)
//     fireExp1.stop()

//     const fColor = {r: 1, g:0.93, b:0}
//     const {r,g,b} = fColor
//     const rgb2 = {r:1, g:0, b:0}
//     const Col4 = Color4
//     fireExp1.addColorGradient(0, new Col4(r,g,b, .01), new Col4(rgb2.r,rgb2.g,rgb2.b, .07))
//     fireExp1.addColorGradient(.4, new Col4(r,g,b, .8), new Col4(rgb2.r,rgb2.g,rgb2.b, 1))
//     fireExp1.addColorGradient(.7, new Col4(r,g,b, 1), new Col4(rgb2.r,rgb2.g,rgb2.b,.9))
//     fireExp1.addColorGradient(1, new Col4(r,g,b, .1), new Col4(rgb2.r,rgb2.g,rgb2.b,  .1))

//     // const emberFire = this.createParticle("flare", 40, {x:0,y:0,z:0}, .09, {min: 2, max:3}, .1,.3, false, false, false, false, false,false)
//     // emberFire.createPointEmitter(new Vector3(-2,2,-2), new Vector3(2,-2,2))
//     const emberJson = {"name":"Explode Particle","id":"default system","capacity":10000,"disposeOnStop":false,"manualEmitCount":-1,"emitter":[0,0,0],"particleEmitterType":{"type":"SphereParticleEmitter","radius":1,"radiusRange":1,"directionRandomizer":0},"texture":{"tags":null,"url":"https://www.babylonjs.com/assets/Flare.png","uOffset":0,"vOffset":0,"uScale":1,"vScale":1,"uAng":0,"vAng":0,"wAng":0,"uRotationCenter":0.5,"vRotationCenter":0.5,"wRotationCenter":0.5,"homogeneousRotationInUVTransform":false,"isBlocking":true,"name":"https://www.babylonjs.com/assets/Flare.png","hasAlpha":false,"getAlphaFromRGB":false,"level":1,"coordinatesIndex":0,"coordinatesMode":0,"wrapU":1,"wrapV":1,"wrapR":1,"anisotropicFilteringLevel":4,"isCube":false,"is3D":false,"is2DArray":false,"gammaSpace":true,"invertZ":false,"lodLevelInAlpha":false,"lodGenerationOffset":0,"lodGenerationScale":0,"linearSpecularLOD":false,"isRenderTarget":false,"animations":[],"invertY":true,"samplingMode":3,"_useSRGBBuffer":false},"isLocal":false,"animations":[],"beginAnimationOnStart":false,"beginAnimationFrom":0,"beginAnimationTo":60,"beginAnimationLoop":false,"startDelay":0,"renderingGroupId":0,"isBillboardBased":true,"billboardMode":7,"minAngularSpeed":0,"maxAngularSpeed":0,"minSize":0.1,"maxSize":0.1,"minScaleX":1,"maxScaleX":1,"minScaleY":1,"maxScaleY":1,"minEmitPower":3,"maxEmitPower":3,"minLifeTime":2.9,"maxLifeTime":3,"emitRate":800,"gravity":[0,0,0],"noiseStrength":[10,10,10],"color1":[0.10588235294117647,0,0,1],"color2":[0.1803921568627451,0.01568627450980392,0,1],"colorDead":[0.1568627450980392,0,0,1],"updateSpeed":0.083,"targetStopDuration":0,"blendMode":0,"preWarmCycles":0,"preWarmStepOffset":1,"minInitialRotation":0,"maxInitialRotation":0,"startSpriteCellID":0,"spriteCellLoop":true,"endSpriteCellID":0,"spriteCellChangeSpeed":1,"spriteCellWidth":0,"spriteCellHeight":0,"spriteRandomStartCell":false,"isAnimationSheetEnabled":false,"sizeGradients":[{"gradient":0,"factor1":1.4,"factor2":2},{"gradient":1,"factor1":0.01,"factor2":0.25}],"textureMask":[1,1,1,1],"customShader":null,"preventAutoStart":false}
//     const emberFire = ParticleSystem.Parse(emberJson, scene, "")
//     emberFire.emitRate = 30
//     emberFire.gravity = new Vector3(0,2,0)
//     emberFire.updateSpeed = 0.03
//     // emberFire.createSphereEmitter(5,.01)
//     emberFire.targetStopDuration = 2
//     const emb1 = {r: 1,g:0,b:0}
//     const emb2 = {r: .812,g:.2,b:0}
//     emberFire.addColorGradient(0, new Col4(emb1.r,emb1.g,emb1.b,.01), new Col4(emb2.r,emb2.g,emb2.b, .07))
//     emberFire.addColorGradient(.2, new Col4(emb1.r,emb1.g,emb1.b,1), new Col4(emb2.r,emb2.g,emb2.b, 1))
//     emberFire.addColorGradient(.95, new Col4(emb1.r,emb1.g,emb1.b,.01), new Col4(emb2.r,emb2.g,emb2.b, .07))

//     emberFire.removeSizeGradient(0)
//     emberFire.removeSizeGradient(1)
//     emberFire.removeSizeGradient(2)
//     emberFire.addSizeGradient(0, 0.05, .1);
//     emberFire.addSizeGradient(0.2, .1, .2);
//     emberFire.addSizeGradient(0.95, .01, .02);

//     const spherSmoke = createCustomizedSmoke(scene, new Vector3(0,0,0), "smoke", false, {min: 2,max:3}, {min:1.5,max:2}, 5, false, {r:0,g:0,b:0}, {r:0.37, g:0.2, b:0.2}, false, false, 1, true)
//     spherSmoke.targetStopDuration = 1
//     spherSmoke.updateSpeed = 0.04
//     spherSmoke.createPointEmitter(new Vector3(.5,.2,.5), new Vector3(-.5,-.2,.5))
//     spherSmoke.addSizeGradient(0, 8, 10);
//     spherSmoke.addSizeGradient(0.2, 10, 14);
//     spherSmoke.addSizeGradient(0.95, 11, 12);

//     const transparentEmber = ParticleSystem.Parse(emberJson, scene, "")
//     transparentEmber.emitRate = 30
//     transparentEmber.gravity = new Vector3(0,2,0)
//     transparentEmber.updateSpeed = 0.03
//     transparentEmber.addSizeGradient(0, 0.05, .1);
//     transparentEmber.addSizeGradient(0.2, .1,.2);
//     transparentEmber.addSizeGradient(0.95, .01, .02);

//     const portalPS = this.createPSystem({"name":"CPU particle system","id":"default system","capacity":10000,"disposeOnStop":false,"manualEmitCount":-1,"emitter":[0,0,0],"particleEmitterType":{"type":"CylinderParticleEmitter","radius":0.2,"height":0,"radiusRange":0,"directionRandomizer":0},"texture":{"tags":null,"url":"https://assets.babylonjs.com/textures/flare.png","uOffset":0,"vOffset":0,"uScale":1,"vScale":1,"uAng":0,"vAng":0,"wAng":0,"uRotationCenter":0.5,"vRotationCenter":0.5,"wRotationCenter":0.5,"homogeneousRotationInUVTransform":false,"isBlocking":true,"name":"https://assets.babylonjs.com/textures/flare.png","hasAlpha":false,"getAlphaFromRGB":false,"level":1,"coordinatesIndex":0,"optimizeUVAllocation":true,"coordinatesMode":0,"wrapU":1,"wrapV":1,"wrapR":1,"anisotropicFilteringLevel":4,"isCube":false,"is3D":false,"is2DArray":false,"gammaSpace":true,"invertZ":false,"lodLevelInAlpha":false,"lodGenerationOffset":0,"lodGenerationScale":0,"linearSpecularLOD":false,"isRenderTarget":false,"animations":[],"invertY":true,"samplingMode":3,"_useSRGBBuffer":false},"isLocal":false,"animations":[],"beginAnimationOnStart":false,"beginAnimationFrom":0,"beginAnimationTo":60,"beginAnimationLoop":false,"startDelay":0,"renderingGroupId":0,"isBillboardBased":true,"billboardMode":7,"minAngularSpeed":0,"maxAngularSpeed":0,"minSize":0.1,"maxSize":0.1,"minScaleX":1,"maxScaleX":1,"minScaleY":1,"maxScaleY":1,"minEmitPower":2,"maxEmitPower":2,"minLifeTime":1,"maxLifeTime":2,"emitRate":499.99,"gravity":[0,0,0],"noiseStrength":[10,10,10],"color1":[1,1,1,1],"color2":[1,1,1,1],"colorDead":[1,1,1,0],"updateSpeed":0.016666666666666666,"targetStopDuration":0,"blendMode":0,"preWarmCycles":0,"preWarmStepOffset":1,"minInitialRotation":0,"maxInitialRotation":0,"startSpriteCellID":0,"spriteCellLoop":true,"endSpriteCellID":0,"spriteCellChangeSpeed":1,"spriteCellWidth":0,"spriteCellHeight":0,"spriteRandomStartCell":false,"isAnimationSheetEnabled":false,"useLogarithmicDepth":false,"sizeGradients":[{"gradient":0,"factor1":0.03,"factor2":0.08},{"gradient":0.74,"factor1":0.5,"factor2":0.4},{"gradient":1,"factor1":0.01,"factor2":0.02}],"textureMask":[1,1,1,1],"customShader":null,"preventAutoStart":false}, scene)
//     portalPS.pSystem.color1 = new Color3(0.286,0.004,0.251)
//     portalPS.pSystem.color2 = new Color3(0.408,0.082,0.427)
//     portalPS.pSystem.colorDead = new Color3(0.306,0,0)

//     magicParticles = [fireExp1, emberFire, spherSmoke, transparentEmber,portalPS.pSystem]
//     magicParticles.forEach(mps => mps.stop())
// }
// export function createSmoke(scene, otherInfo){
//     const particleSystem = new ParticleSystem("particles", 8000, scene);

//     //Texture of each particle
//     particleSystem.particleTexture = new Texture("./images/particles/smoke.png", scene);
//     // lifetime
//     particleSystem.minLifeTime = .8;
//     particleSystem.maxLifeTime = 1;

//     // emit rate
//     particleSystem.emitRate = 5;

//     // gravity
//     particleSystem.gravity = new Vector3(0.25, 1.5, 0);

//     // size gradient
//     particleSystem.addSizeGradient(0, 0.6, .7);
//     particleSystem.addSizeGradient(0.3, 1, .9);
//     particleSystem.addSizeGradient(0.5, 1, 1);
//     particleSystem.addSizeGradient(.9, .8, 2);

//     // color gradient
//     particleSystem.addColorGradient(0, new Color4(0.5, 0.5, 0.5, 0),  new Color4(0.8, 0.8, 0.8, 0));
//     particleSystem.addColorGradient(0.4, new Color4(0.1, 0.1, 0.1, 0.1), new Color4(0.4, 0.4, 0.4, 0.4));
//     particleSystem.addColorGradient(0.7, new Color4(0.03, 0.03, 0.03, 0.2), new Color4(0.3, 0.3, 0.3, 0.4));
//     particleSystem.addColorGradient(1.0, new Color4(0.0, 0.0, 0.0, 0), new Color4(0.03, 0.03, 0.03, 0));

//     // speed gradient
//     particleSystem.addVelocityGradient(0, 1, 1.5);
//     particleSystem.addVelocityGradient(0.1, 0.8, 0.9);
//     particleSystem.addVelocityGradient(0.7, 0.4, 0.5);
//     particleSystem.addVelocityGradient(1, 0.1, 0.2);

//     // particleSystem.addVelocityGradient(0, 0, 1.5);
  
//     // rotation
//     // particleSystem.minInitialRotation = 0;
//     // particleSystem.maxInitialRotation = Math.PI;
//     // particleSystem.minAngularSpeed = -1;
//     // particleSystem.maxAngularSpeed = 1;

//     // blendmode
//     particleSystem.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    
//     // emitter shape
//     const sphereEmitter = particleSystem.createSphereEmitter(0.1)

//     // particleSystem.createCylinderEmitter(.1,.1,2)

//     particleSystem.stop()

//     if(otherInfo) otherInfo(particleSystem)

//     return particleSystem
// }
// export function createBloodParticle(imgTex,capac, monsFos, particleType, willStart, targStop, willDisposeOnStop, emitterMesh){
//     const myParticleSystem = new ParticleSystem(`bloodParticle.${makeRandNum()}`, capac)
    
//     if(particleType === "sphere") myParticleSystem.createSphereEmitter(1);
//     myParticleSystem.particleTexture = new Texture(`./images/particles/${imgTex}.png`, scene);
//     if(monsFos) myParticleSystem.emitter = new Vector3(monsFos.x,monsFos.y+Math.random()*.4,monsFos.z)
//     if(emitterMesh) myParticleSystem.emitter = emitterMesh
//     if(willStart) myParticleSystem.start()
//     if(willDisposeOnStop) myParticleSystem.disposeOnStop = true;
//     myParticleSystem.targetStopDuration = targStop
//     myParticleSystem.updateSpeed = 0.05;
//     myParticleSystem.minSize = 0.2;
//     myParticleSystem.maxSize = 0.9;
//     myParticleSystem.gravity = new Vector3(0, -.5, 0);
//     return myParticleSystem
// }
// export function createParticle(imgTex, capac, pos, spd, lifetime, minSize, maxSize, gravityY, particleType, willStart, emitterMesh, haveColor, haveScale){
//     const myParticleSystem = new ParticleSystem(`particle.${makeRandNum()}`, capac)

//     myParticleSystem.minEmitPower = 1
//     myParticleSystem.maxEmitPower = 1
//     switch(particleType){
//         case "sphere":
//             myParticleSystem.createSphereEmitter(1);
//         break;
//         case "cone":
//             const radius = 2;
//             const angle = Math.PI / 4;
//             myParticleSystem.createConeEmitter(radius, angle);
//         break
//     }
//     myParticleSystem.particleTexture = new Texture(`./images/particles/${imgTex}.png`, scene);
//     if(pos) myParticleSystem.emitter = new Vector3(pos.x,pos.y,pos.z)
//     if(emitterMesh) myParticleSystem.emitter = emitterMesh
//     willStart ? myParticleSystem.start() : myParticleSystem.stop()

//     myParticleSystem.updateSpeed = spd //0.05;
//     myParticleSystem.minSize = minSize//0.2;
//     myParticleSystem.maxSize = maxSize//0.9;
//     myParticleSystem.gravity = new Vector3(0, gravityY, 0);
    
//     myParticleSystem.minLifeTime = lifetime.min//0.3;
//     myParticleSystem.maxLifeTime = lifetime.max//1.5;

//     if(haveColor){
//         switch(haveColor){
//             case "red":
//                 myParticleSystem.color1 = new Color4(0.95, 0, 0);
//                 myParticleSystem.color2 = new Color4(0.72, 0.42, 0.09);
//                 myParticleSystem.colorDead = new Color4(0.29, 0.01, 0, 0);
//             break;
//         }
//         if(haveColor.r || haveColor.r === 0){
//             const {r,g,b} = haveColor
//             myParticleSystem.color1 = new Color4(r,g,b);
//             myParticleSystem.color2 = new Color4(r+.2,g+.2,b+.2);
//             myParticleSystem.colorDead = new Color4(r-.6,g-.6,b-.6);
//         }
//     }
//     if(haveScale){
//         myParticleSystem.minScaleX = haveScale.x
//         myParticleSystem.maxScaleX = haveScale.x+.5

//         myParticleSystem.minScaleY = haveScale.y
//         myParticleSystem.minScaleY = haveScale.y+.5
//     }
//     return myParticleSystem
// }
// export function createCustomizedSmoke(scene, emitter, particleImgName, minMaxSize, minMaxLifeTime, minMaxEmitPower, qnty, gravityVector3, rgb1, rgb2, isDefaultSizeGrad, particleType, particleTypeRadius, activateRotations){
//     const particleSystem = new ParticleSystem("particles", 8000, scene);
//     //Texture of each particle
//     particleSystem.particleTexture = new Texture(`./images/particles/${particleImgName}.png`, scene);
//     // lifetime
//     if(minMaxLifeTime){
//         const {min,max} = minMaxLifeTime
//         particleSystem.minLifeTime = min
//         particleSystem.maxLifeTime = max
//     }
//     if(minMaxEmitPower){
//         const {min,max} = minMaxEmitPower
//         particleSystem.minEmitPower = min
//         particleSystem.maxEmitPower = max
//     }
//     if(minMaxSize){
//         const {min,max} = minMaxSize
//         particleSystem.minSize = min
//         particleSystem.maxSize = max
//     }
//     // emit rate
//     particleSystem.emitRate = qnty;

//     // gravity
//     if(gravityVector3) particleSystem.gravity = gravityVector3;    

//     if(isDefaultSizeGrad){
//         // size gradient
//         particleSystem.addSizeGradient(0, 0.6, .7);
//         particleSystem.addSizeGradient(0.3, 1, .9);
//         particleSystem.addSizeGradient(0.5, 1, 1);
//         particleSystem.addSizeGradient(.9, .8, 2);
//     }
//     // color gradient
//     // yung unang param yan yung 0-1 kung meron kang apat na colorGrad hatiin mo sa apat yung 1 parang add size gradient lang yan sa babylon js playground
//     const Col4 = Color4;
//     const {r,g,b} = rgb1        
//     particleSystem.addColorGradient(0, new Col4(r,g,b, .01), new Col4(rgb2.r,rgb2.g,rgb2.b, .07))
//     particleSystem.addColorGradient(.4, new Col4(r,g,b, .1), new Col4(rgb2.r,rgb2.g,rgb2.b, .2))
//     particleSystem.addColorGradient(.7, new Col4(r,g,b, 1), new Col4(rgb2.r,rgb2.g,rgb2.b,.9))
//     particleSystem.addColorGradient(1, new Col4(r,g,b, .1), new Col4(rgb2.r,rgb2.g,rgb2.b,  .1))

//     // particleSystem.addColorGradient(0, new Col4(r,g,b, .6), new Col4(rgb2.r,rgb2.g,rgb2.b, .9))
//     // particleSystem.addColorGradient(.4, new Col4(r,g,b, .9), new Col4(rgb2.r,rgb2.g,rgb2.b, 1))
//     // particleSystem.addColorGradient(.7, new Col4(r,g,b, 1), new Col4(rgb2.r,rgb2.g,rgb2.b,.5))
//     // particleSystem.addColorGradient(1, new Col4(r,g,b, .5), new Col4(rgb2.r,rgb2.g,rgb2.b, 1))

//     // speed gradient
//     particleSystem.addVelocityGradient(0, 1, 1.5);
//     particleSystem.addVelocityGradient(0.1, 0.8, 0.9);
//     particleSystem.addVelocityGradient(0.7, 0.4, 0.5);
//     particleSystem.addVelocityGradient(1, 0.1, 0.2);

//     // rotation
//     if(activateRotations){
//         particleSystem.minInitialRotation = 0;
//         particleSystem.maxInitialRotation = Math.PI;
//         particleSystem.minAngularSpeed = -1;
//         particleSystem.maxAngularSpeed = 1;
//     }

//     // blendmode
//     particleSystem.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    
//     // emitter shape
//     let psRadius = 0.1
//     psRadius = particleTypeRadius && particleTypeRadius
//     switch(particleType){
//         case "cylinder":                
//             particleSystem.createCylinderEmitter(psRadius)
//         break;
//         case "mesh":
//             const {x,y,z} = emitter.position
//             particleSystem.createBoxEmitter(new Vector3(0,0,0), new Vector3(0,0,0), new Vector3(-1,0,-1), new Vector3(1,0,1))
//         break;
//         default:
//             // sphere
//             particleSystem.createSphereEmitter(psRadius)
//         break
//     }       
//     // particleSystem.createCylinderEmitter(.1,.1,2)
//     if(emitter) particleSystem.emitter = emitter
//     particleSystem.stop()
//     return particleSystem
// }

export function createTransparentMat(scene,  texName, isNotAlpha){
    const mat = new StandardMaterial("asd", scene)
    const diffTex = new Texture(`./images/modeltex/${texName}.png`, false, false)
    mat.diffuseTexture = diffTex

    if(!isNotAlpha){
        mat.diffuseTexture.hasAlpha = true
        mat.useAlphaFromDiffuseTexture = true
    }
    mat.specularColor = new Color3(0,0,0)
    mat.opacityTexture = null
    mat.backFaceCulling = false
    return mat
}
export function createManyThinInstace(origMesh, fromPos, toPos, total){
    for (let index = 0; index <=total; index++) {
        //using thin Instances
        const matrix = Matrix.Translation(Scalar.RandomRange(fromPos.x, toPos.x), Scalar.RandomRange(fromPos.y, toPos.y),Scalar.RandomRange(fromPos.z, toPos.z));
        origMesh.thinInstanceAdd(matrix)
        origMesh.thinInstanceSetMatrixAt(origMesh, matrix)
    }
}
export function createThinIns(origMesh, pos, rotY){
    const matrix = Matrix.Translation(pos.x, pos.y, pos.z);
    if(rotY){
        
        // // Define your translation vector
        // let translation = new Vector3(pos.x, pos.y, pos.z);

        // // Generate the rotation matrix
        // let rotationMatrix = Matrix.RotationYawPitchRoll(rotY, 0, 0);

        // // Generate the translation matrix
        // let translationMatrix = Matrix.Translation(translation.x, translation.y, translation.z);

        // // Combine the translation and rotation matrices
        // let transformationMatrix = rotationMatrix.multiply(translationMatrix);

        // let matrixValues = transformationMatrix.m;

        // let instanceCount = 10

        // let matricesData = new Float32Array(instanceCount *16);
        // for (let i = 0; i < instanceCount; i++) {
        //     // Copy the transformation matrix values into the buffer
        //     for (let j = 0; j < 16; j++) {
        //         matricesData[i * 16 + j] = matrixValues[j];
        //     }
        // }
        // origMesh.thinInstanceSetBuffer("matrix", matricesData, 16);
    }
    origMesh.thinInstanceAdd(matrix)
    origMesh.thinInstanceSetMatrixAt(origMesh, matrix)
}
export function checkDistance(startingPos, destinationPos){
    const sPos = startingPos.clone()
    const dPos = destinationPos.clone()
    sPos.y = 10
    dPos.y = 10
    return Vector3.Distance(sPos,dPos)
}

export function createRefbx(scene){
    const refbx = MeshBuilder.CreateBox("refbx", {height: 2, size: .5}, scene)
    const head = MeshBuilder.CreateBox("refbx", {size: .66}, scene)
    head.parent = refbx
    head.position = new Vector3(0,.9,.3)
    refbx.isVisible = false
    head.isVisible = false
    refbx.rotationQuaternion = Quaternion.FromEulerVector(refbx.rotation)
    refbx.position.y-=5
    return refbx
}