import { MeshBuilder, Scene, Vector3 } from "@babylonjs/core"
import { dungeonMaterial } from "../tools/materials.js";
import { createDungeon } from "../creations/createdungeon.js";
import { createArcCam, attachCam } from "../tools/camera.js";
import { setupLighting } from "../tools/lighting.js";
// import { Character } from "../charactersystem/createcharacter.js";
import { initializePhysics } from "../tools/physics.js";
import { createRock } from "../assetcreation/createRock.js";
import { loadAvatarContainer, loadModel } from "../tools/loadmodel.js";
import { createSunRay } from "../tools/sunrays.js";
import { sceneCleanupReady } from "../components/cleanup.js";
import { getEngine, setGameStatus } from "../main/main.js";
import { showHideIcons } from "../charactersystem/uimanagement.js";
import { setWorldChatAvailable } from "../components/worldChatSystem.js";
// import { createMobileControls } from "../components/mobilecontrols.js";

export async function dungeonScene(placeDetail){
    const { placeId, sceneTemp, isMultiplayer } = placeDetail
    showHideIcons()
    const engine = getEngine()
    const spawnPos = {
        x: placeDetail.spawn.x * placeDetail.layout.cellSize,
        y: placeDetail.spawn.y + 1,
        z: placeDetail.spawn.z * placeDetail.layout.cellSize
    };
    const scene = new Scene(engine)
    setupLighting(scene, placeDetail)
    
    const container = await loadAvatarContainer("./models/avatar/avatar.glb", scene)

    createSunRay(spawnPos, false, scene)
    // IMPORTANT: Initialize physics FIRST before creating any physics objects
    await initializePhysics(scene);

    const materials = dungeonMaterial(scene);
    const rock = createRock(scene)
    const tile = await loadModel("./models/tiles/tile1.glb", scene)
    // Setup lighting

    createDungeon(scene, placeDetail, materials,rock,tile);

    // const camera = createArcCam(scene, placeDetail, player.head);
    
    await scene.whenReadyAsync()

    const isTouchDevice = navigator.maxTouchPoints > 0;

    setGameStatus("running")

    setWorldChatAvailable(isMultiplayer)

    return {scene, isSocketOn: isMultiplayer }
}