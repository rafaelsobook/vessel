import { ArcRotateCamera, SceneLoader, HemisphericLight, MeshBuilder, Scene, Vector3 } from "@babylonjs/core"
import { dungeonMaterial } from "../tools/materials.js";
import { createDungeon } from "../creations/createdungeon.js";
import { createArcCam, attachCam } from "../tools/camera.js";
import { setupLighting } from "../tools/lighting.js";
import { initializePhysics } from "../tools/physics.js";
import { createRock } from "../assetcreation/createRock.js";
import { loadAvatarContainer, loadModel } from "../tools/loadmodel.js";
import { createSunRay } from "../tools/sunrays.js";
import { sceneCleanupReady } from "../components/cleanup.js";
import { getSpawnPos } from "../tools/position.js";
import { createArea } from "../creations/createArea.js";
import { createVillage } from "../creations/createvillage.js";
import { createRoom } from "../creations/createroom.js";
import { getVillageAssetRegistry } from "../components/assetregistry.js";
import { getSocket, joinWorld } from "../sockets/joinsocket.js";
import { getEngine, setGameStatus } from "../main/main.js";
import { getCharState, initiateCharacter, setCanPress } from "../charactersystem/characterstate.js";
import { createMyCharacter } from "../charactersystem/createMyCharacter.js";
import { pushPlayer, setSocketContainers, playSocketScene } from "../sockets/worldsocket.js";
import { openCloseLScreen } from "../tools/popupUI.js";
import { checkIfTokenSaved, randomNum } from "../tools/tools.js";
import { startMyOwnSpeech } from "../components/conversations.js";
import { loadMeshOnlyParts } from "../tools/loadmodel.js";
import { spawnProjectile } from "../creations/skills.js";
import {runEmitMyLocInterval } from "../sockets/emits.js";
import { hideShowAllScreenUI, openCloseLifeDisplay, showHideIcons } from "../charactersystem/uimanagement.js";
import { obtain } from "../charactersystem/inventory.js";
import createAllNpcInArea from "../npc/createAllNpcInArea.js";

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
        monolithRoot
    })
    const charState = getCharState()
    await initiateCharacter(checkIfTokenSaved())
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