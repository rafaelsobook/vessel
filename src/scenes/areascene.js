import { ArcRotateCamera, SceneLoader, HemisphericLight, MeshBuilder, Scene, Vector3, Color3, Texture, PBRMaterial, StandardMaterial, MultiMaterial } from "@babylonjs/core"
import { createMatV2, dungeonMaterial } from "../tools/materials.js";
import { createDungeon } from "../creations/createdungeon.js";
import { createArcCam, attachCam } from "../tools/camera.js";
import { setupLighting } from "../tools/lighting.js";
import { createAggregate, initializePhysics } from "../tools/physics.js";
import { createRock } from "../assetcreation/createRock.js";
import { loadAvatarContainer, loadModel, mergeAndLoadModel } from "../tools/loadmodel.js";
import { createSunRay } from "../tools/sunrays.js";
import { sceneCleanupReady } from "../components/cleanup.js";
import { getSpawnPos } from "../tools/position.js";
import { createArea } from "../creations/createArea.js";
import { createVillage } from "../creations/createvillage.js";
import { createRoom } from "../creations/createroom.js";
import { getVillageAssetRegistry } from "../components/assetregistry.js";
import { getSocket, joinWorld } from "../sockets/joinsocket.js";
import { changeScene, getEngine, setGameStatus } from "../main/main.js";
import { getCharState, initiateCharacter, setCanPress, updateMyDetailsOL } from "../charactersystem/characterstate.js";
import { createMyCharacter } from "../charactersystem/createMyCharacter.js";
import { pushPlayer, setSocketContainers, playSocketScene } from "../sockets/worldsocket.js";
import { openCloseInteractBtn, openCloseLScreen } from "../tools/popupUI.js";
import { checkIfTokenSaved, randomNum } from "../tools/tools.js";
import { startMyOwnSpeech } from "../components/conversations.js";
import { loadMeshOnlyParts } from "../tools/loadmodel.js";
import { spawnProjectile } from "../creations/skills.js";
import {runEmitMyLocInterval } from "../sockets/emits.js";
import { hideShowAllScreenUI, openCloseLifeDisplay, showHideIcons } from "../charactersystem/uimanagement.js";
import { obtain } from "../charactersystem/inventory.js";
import createAllNpcInArea from "../npc/createAllNpcInArea.js";
import { exitScene } from "../sockets/exitsocket.js";
import { onIntersecEnterTrig, onIntersecExitTrig } from "../components/actionManager.js";
import { createFireParticles } from "../tools/particlesystem.js";

export async function areaScene(placeDetail){
    // showHideIcons()
    const { placeId, sceneTemp, isMultiplayer } = placeDetail
    const spawnPos = getSpawnPos(placeDetail);
    const scene = new Scene(getEngine())
    const cam = createArcCam(scene, placeDetail)
    setupLighting(scene, placeDetail)

    await initializePhysics(scene);

    let reg
    if(placeDetail.areaType === "village"){
        reg = await getVillageAssetRegistry()
    }
    const animeBodyContainer = await loadAvatarContainer("./models/avatar/avatar.glb", scene)
    let goblinRoot = await loadAvatarContainer("./models/monsters/goblin.glb", scene)
    let monolithRoot = await loadAvatarContainer("./models/monsters/monolith.glb", scene)
    let slimeRoot = await loadAvatarContainer("./models/monsters/slime.glb", scene)

    const HairModel = await SceneLoader.ImportMeshAsync("", "./models/avatar/", "hairModels.glb", scene)
    const allweaponParts = await loadMeshOnlyParts("./models/swords/allswords.glb", scene)

    const containers = setSocketContainers({
        hairs: HairModel.meshes,
        animeBody: animeBodyContainer,
        allweapons: allweaponParts,
        helmets: null,
        armors: null,
        belts: null,
        cloaks: null,

        goblinRoot,
        monolithRoot,
        slimeRoot
    })
    
    const charState = await initiateCharacter(checkIfTokenSaved())
    const myCharacter = createMyCharacter(charState, scene)
    pushPlayer(myCharacter)

    switch(placeDetail.areaType){
        case "village":
            createVillage(scene, placeDetail, reg, myCharacter.body)
        break;
        case "room":
            createRoom(scene, placeDetail, myCharacter.body);
        break;
    }
    if(placeDetail.optionalObjects && placeDetail.optionalObjects.length > 0){
        placeDetail.optionalObjects.forEach(async item => {
            if (item.name.includes("particle_fire")) {
                createFireParticles(item.position, scene)
                return
            }

            // const model = await loadModelByIndx(item.glbPath, 1, scene);
            const model = await mergeAndLoadModel(item.glbPath, scene, item.functionBeforeMerge);
            model.position = new Vector3(item.position.x, item.position.y, item.position.z);
            model.addRotation(0, item.rotation, 0);
            model.name = item.name

            if(item.diffuseTexPath){
                const mat = createMatV2(scene, item.diffuseTexPath)
                model.material = mat
                model.material.backFaceCulling  = false
            }
            if(item.bumpTexPath){
                // if model.material.unlit = true bumpTexture has no effect because there's nothing reflecting the light
                // const bumpTex = new Texture(item.bumpTexPath, scene)
                // if(!model.material) return console.log("no material")
                // model.material.bumpTexture = bumpTex
                // model.material.specularTexture = bumpTex
            }

            // if (model.material instanceof MultiMaterial) {
            //     console.log(`[${item.name}] MultiMaterial with ${model.material.subMaterials.length} sub-materials — setting each unlit`)
            //     model.material.subMaterials.forEach(sub => {
            //         if (sub instanceof PBRMaterial) sub.unlit = true
            //         else if (sub instanceof StandardMaterial) sub.disableLighting = true
            //     })
            // } else if (model.material instanceof PBRMaterial) {
            //     console.log(`[${item.name}] material is PBRMaterial — setting unlit`)
            //     // model.material.unlit = true
            // } else if (model.material instanceof StandardMaterial) {
            //     console.log(`[${item.name}] material is StandardMaterial — disabling lighting`)
            //     model.material.disableLighting = true
            // } else {
            //     console.log(`[${item.name}] material type:`, model.material?.getClassName())
            // }

            // shadowGenerator.addShadowCaster(model)
            // model.receiveShadows = true
            if(item.cbAfterMade) item.cbAfterMade(scene)
            // console.log(model.getClassName())
            if(model.getClassName() === "Mesh") createAggregate(model, item.physics.opt, item.physics.type, scene);
        })
    }
    placeDetail.roomPaths?.forEach(path => {
        console.log(path)
        const { name, pos,startingPos, placeId ,areaType } = path
        const pathTrigger = MeshBuilder.CreateBox(`trig_${placeId}`, { }, scene)
        pathTrigger.position = new Vector3(pos.x, pos.y, pos.z)
        pathTrigger.isVisible = true
        pathTrigger.isPickable = false

        onIntersecEnterTrig(pathTrigger, myCharacter.body, scene, () => {
            openCloseInteractBtn(true, "none", async () => {
                openCloseInteractBtn(false)

                const charState = getCharState()

                charState.currentPlace.placeId = placeId
                charState.currentPlace.name = name
                charState.currentPlace.areaType = areaType

                charState.x = startingPos.x
                charState.y = startingPos.y
                charState.z = startingPos.z

                const newCharData = await updateMyDetailsOL(charState, checkIfTokenSaved(), true, true)
                exitScene(false)
                await changeScene("whatever")
            })
        })
        onIntersecExitTrig(pathTrigger, myCharacter.body, scene, () => {
            openCloseInteractBtn(false, false)
        })
    })
    // createAllNpcInArea(BABYLON, myHeroDatabase, hero, scene, freeCam, wearableTex, characterRoot, swords, helmets, armors, HairModel.meshes, mainShadow)

    await scene.whenReadyAsync()

    createAllNpcInArea(myCharacter, scene)
    // const isTouchDevice = navigator.maxTouchPoints > 0;

    // scene.meshes.forEach(mesh => mesh.isPickable = false)
    // sceneCleanupReady(scene, createCharacterControls(player, camera, scene));


    // make your architecture to everytime you recreateMeshes from the scene
    // that has interaction with character best practise to spawn your character first
    // before thoses meshes so those meshes will just find your character and apply interaction

    if(isMultiplayer) {
        joinWorld(getCharState().currentPlace.placeId)
        // openCloseChatContainer() // coming soon
        runEmitMyLocInterval()
        // emitMyLoc()
    }

    openCloseLScreen("normal", false)
    playSocketScene(scene)
    setCanPress(true)



    showHideIcons("block")
    if(charState.currentspeechId){
        startMyOwnSpeech()
        hideShowAllScreenUI(false)
    }
    return {scene, isSocketOn: isMultiplayer }
}