import { ArcRotateCamera, HemisphericLight, MeshBuilder, Scene, Vector3 } from "@babylonjs/core"
import { dungeonMaterial } from "../tools/materials.js";
import { createDungeon } from "../creations/createdungeon.js";
import { createArcCam, attachCam } from "../tools/camera.js";
import { setupLighting } from "../tools/lighting.js";
// import { Character } from "../charactersystem/createcharacter.js";
import {  createCharacterControls } from "../components/controls.js";
import { initializePhysics, setGravity } from "../tools/physics.js";
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
import { getCharState } from "../charactersystem/characterstate.js";
// import { createMobileControls } from "../components/mobilecontrols.js";

export async function areaScene(placeDetail){
    const engine = getEngine()
    const spawnPos = getSpawnPos(placeDetail);
    const scene = new Scene(engine)
    const cam = new ArcRotateCamera("ads", 0,0,50, Vector3.Zero(), scene)

    cam.attachControl()
    setupLighting(scene, placeDetail)

    await initializePhysics(scene);

    // const camera = createArcCam(scene, placeDetail, player.head);
    let reg
    if(placeDetail.areaType === "village"){
        reg = await getVillageAssetRegistry()
    }

    switch(placeDetail.areaType){
        case "village":
            createVillage(scene, placeDetail, reg)
        break;
        case "room":
            createRoom(scene, placeDetail);
        break;
        default:
            createArea(scene, placeDetail);
        break
    }
    
    await scene.whenReadyAsync()
    console.log("area scene made")
    // const isTouchDevice = navigator.maxTouchPoints > 0;

    // scene.meshes.forEach(mesh => mesh.isPickable = false)
    // sceneCleanupReady(scene, createCharacterControls(player, camera, scene));

    cam.position = new Vector3(0,1,0)
    joinWorld(getCharState().currentPlace.placeId)

    return scene
}