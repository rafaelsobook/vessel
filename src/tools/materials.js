import { PBRMaterial, Color3 } from "@babylonjs/core";

export function dungeonMaterial(scene) {
    const mats = {};

    function createMat(name, color) {
        const mat = new PBRMaterial(name, scene);

        // Base color (like diffuseColor but PBR)
        mat.albedoColor = color;

        // === TOONY SETTINGS ===
        mat.roughness = 1.0;   // flat look
        mat.metallic = 0.0;    // no realism

        return mat;
    }

    // Floor
    mats.floor = createMat("floorMat", new Color3(0.4, 0.4, 0.45));

    // Wall
    mats.wall = createMat("wallMat", new Color3(0.5, 0.5, 0.55));

    // Ceiling
    mats.ceiling = createMat("ceilingMat", new Color3(0.3, 0.3, 0.35));

    // Doors
    mats.door = createMat("doorMat", new Color3(0.4, 0.25, 0.1));
    mats.ironDoor = createMat("ironDoorMat", new Color3(0.3, 0.3, 0.35));

    // Props
    mats.barrel = createMat("barrelMat", new Color3(0.3, 0.2, 0.1));
    mats.chest = createMat("chestMat", new Color3(0.4, 0.3, 0.1));

    mats.torch = createMat("torchMat", new Color3(0.2, 0.15, 0.1));
    mats.torch.emissiveColor = new Color3(0.8, 0.4, 0.1); // glow

    return mats;
}