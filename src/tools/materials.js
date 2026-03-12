import { StandardMaterial, Color3 } from "@babylonjs/core";
export function dungeonMaterial(scene) {
    const mats = {};

    // Floor material
    mats.floor = new StandardMaterial("floorMat", scene);
    mats.floor.diffuseColor = new Color3(0.4, 0.4, 0.45);
    mats.floor.specularColor = new Color3(0.1, 0.1, 0.1);

    // Wall material
    mats.wall = new StandardMaterial("wallMat", scene);
    mats.wall.diffuseColor = new Color3(0.5, 0.5, 0.55);
    mats.wall.specularColor = new Color3(0.2, 0.2, 0.2);

    // Ceiling material
    mats.ceiling = new StandardMaterial("ceilingMat", scene);
    mats.ceiling.diffuseColor = new Color3(0.3, 0.3, 0.35);

    // Door materials
    mats.door = new StandardMaterial("doorMat", scene);
    mats.door.diffuseColor = new Color3(0.4, 0.25, 0.1);

    mats.ironDoor = new StandardMaterial("ironDoorMat", scene);
    mats.ironDoor.diffuseColor = new Color3(0.3, 0.3, 0.35);
    mats.ironDoor.specularColor = new Color3(0.5, 0.5, 0.5);

    // Prop materials
    mats.barrel = new StandardMaterial("barrelMat", scene);
    mats.barrel.diffuseColor = new Color3(0.3, 0.2, 0.1);

    mats.chest = new StandardMaterial("chestMat", scene);
    mats.chest.diffuseColor = new Color3(0.4, 0.3, 0.1);

    mats.torch = new StandardMaterial("torchMat", scene);
    mats.torch.diffuseColor = new Color3(0.2, 0.15, 0.1);
    mats.torch.emissiveColor = new Color3(0.8, 0.4, 0.1);

    return mats;
}