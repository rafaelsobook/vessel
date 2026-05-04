import { PBRMaterial, StandardMaterial, Color3, Texture } from "@babylonjs/core";


export function createMat(name, color, texturePath, scene, scale = { uScale: 1, vScale: 1 }) {
    const mat = new StandardMaterial(name, scene);
    if(texturePath){
        const diffTex = new Texture(texturePath, scene);
        diffTex.uScale = scale.uScale;
        diffTex.vScale = scale.vScale;
        
        mat.diffuseTexture = diffTex;
        mat.specularColor = new Color3(0,0,0);

    }
   
    // Base color (like diffuseColor but PBR)
    if(color){
        mat.diffuseColor = color;
    }

    return mat;
}

export function dungeonMaterial(scene) {
    const mats = {};

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

export function createTransparentMat(scene, texturePath, uScale = 1, vScale = 1){
    const mat = new StandardMaterial("transparentMat", scene);
    const tex = new Texture(texturePath, scene);
    tex.uScale = uScale;
    tex.vScale = vScale;
    mat.diffuseTexture = tex;
    mat.diffuseTexture.hasAlpha = true;
    mat.specularColor = new Color3(0,0,0);
    return mat;
}