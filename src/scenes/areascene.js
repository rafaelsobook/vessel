import { HemisphericLight, MeshBuilder, Scene, Vector3 } from "@babylonjs/core"
import { dungeonMaterial } from "../tools/materials.js";
import { createDungeon } from "../creations/createdungeon.js";
import { createArcCam, attachCam } from "../tools/camera.js";
import { setupLighting } from "../tools/lighting.js";
import { Character } from "../character/createcharacter.js";
import {  createCharacterControls } from "../components/controls.js";
import { initializePhysics, setGravity } from "../tools/physics.js";
import { createRock } from "../assetcreation/createRock.js";
import { loadAvatarContainer, loadModel } from "../tools/loadmodel.js";
import { createSunRay } from "../tools/sunrays.js";
import { sceneCleanupReady } from "../components/cleanup.js";
import { getSpawnPos } from "../tools/position.js";
import { createArea } from "../creations/createArea.js";
import { createVillage } from "../creations/createvillage.js";
import { getVillageAssetRegistry } from "../components/assetregistry.js";
// import { createMobileControls } from "../components/mobilecontrols.js";

export async function areaScene(engine, placeDetail){
    console.log(placeDetail)
    const spawnPos = getSpawnPos(placeDetail);
    const scene = new Scene(engine)
    const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
    setupLighting(scene, placeDetail)
    
    const container = await loadAvatarContainer("./models/avatar/avatar.glb", scene)

    await initializePhysics(scene);
    
    const player = new Character(scene, spawnPos, true, container); // true = physics enabled

    const camera = createArcCam(scene, placeDetail, player.head);
    let reg
    if(placeDetail.areaType === "village"){
        reg = await getVillageAssetRegistry()
    }

    switch(placeDetail.areaType){
        case "village":
            createVillage(scene, placeDetail, reg)
        break;
        default:
            createArea(scene, placeDetail);
        break
    }
    
    await scene.whenReadyAsync()

    // const isTouchDevice = navigator.maxTouchPoints > 0;

    scene.meshes.forEach(mesh => mesh.isPickable = false)
    sceneCleanupReady(scene, createCharacterControls(player, camera, scene));
    return scene
}