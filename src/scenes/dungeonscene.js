import { MeshBuilder, Scene, Vector3 } from "@babylonjs/core"
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
// import { createMobileControls } from "../components/mobilecontrols.js";

export async function dungeonScene(engine, placeDetail){
    
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
    
    // Set gravity (optional - defaults to no gravity if not called)
    setGravity(scene, new Vector3(0, -9.81, 0));

    const materials = dungeonMaterial(scene);
    const rock = createRock(scene)
    const tile = await loadModel("./models/tiles/tile1.glb", scene)
    // Setup lighting

    createDungeon(scene, placeDetail, materials,rock,tile);
    // const ground = MeshBuilder.CreateGround("ground", { width: 100, height: 100 }, scene);
    // ground.position = new Vector3(spawnPos.x, spawnPos.y, spawnPos.z)
    const player = new Character(scene, spawnPos, true, container); // true = physics enabled

    const camera = createArcCam(scene, placeDetail, player.head);
    
    await scene.whenReadyAsync()

    const isTouchDevice = navigator.maxTouchPoints > 0;

    const controls = createCharacterControls(player, camera, scene);

    scene.meshes.forEach(mesh => mesh.isPickable = false)
    scene.onDisposeObservable.addOnce(() => controls.dispose());
    sceneCleanupReady(scene, createCharacterControls(player, camera, scene));
    return scene
}