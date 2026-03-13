import { Scene, Vector3 } from "@babylonjs/core"
import { dungeonMaterial } from "../tools/materials.js";
import { generateDungeon } from "../components/createdungeon.js";
import { createArcCam, attachCam } from "../tools/camera.js";
import { setupLighting } from "../tools/lighting.js";
import { Character } from "../components/createcharacter.js";
import { CharacterControls } from "../components/controls.js";
import { initializePhysics, setGravity } from "../tools/physics.js";

export async function dungeonScene(engine, placeDetail){
    const scene = new Scene(engine)

    // IMPORTANT: Initialize physics FIRST before creating any physics objects
    await initializePhysics(scene);
    
    // Set gravity (optional - defaults to no gravity if not called)
    setGravity(scene, new Vector3(0, -9.81, 0));

    const materials = dungeonMaterial(scene);

    // Setup lighting
    setupLighting(scene, placeDetail)
    generateDungeon(scene, placeDetail, materials);

    // Create player character with physics enabled
    const spawnPos = {
        x: placeDetail.spawn.x * placeDetail.layout.cellSize,
        y: placeDetail.spawn.y + 1,
        z: placeDetail.spawn.z * placeDetail.layout.cellSize
    };
    
    const player = new Character(scene, spawnPos, true); // true = physics enabled

    // Create camera and attach to player
    const camera = createArcCam(scene, placeDetail);
    attachCam(player.characterCapsuleBody);
    // Setup player controls (only for local player, not for multiplayer entities)
    const controls = new CharacterControls(player, camera, scene);
    
    await scene.whenReadyAsync()

    return scene
}

// For multiplayer, you can create characters without controls:
// const otherPlayer = new Character(scene, spawnPos, true);
// Then update their position from network data without controls