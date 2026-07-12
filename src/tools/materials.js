import { PBRMaterial, StandardMaterial, Color3, Texture, Engine } from "@babylonjs/core";

let MatUsed = StandardMaterial

export function createGlowingMat(scene, colorType = "yellow"){
    const colors = {
        yellow: { diffuse: new Color3(0.8, 0.7, 0.0), emissive: new Color3(1.0, 0.9, 0.0) },
        green:  { diffuse: new Color3(0.0, 0.6, 0.0), emissive: new Color3(0.0, 1.0, 0.2) },
        white:  { diffuse: new Color3(0.8, 0.8, 0.8), emissive: new Color3(1.0, 1.0, 1.0) },
        blue:   { diffuse: new Color3(0.0, 0.2, 0.8), emissive: new Color3(0.0, 0.4, 1.0) },
        red:    { diffuse: new Color3(0.8, 0.0, 0.0), emissive: new Color3(1.0, 0.1, 0.1) },
        violet: { diffuse: new Color3(0.5, 0.0, 0.8), emissive: new Color3(0.7, 0.0, 1.0) },
    };
    const palette = colors[colorType] ?? colors.yellow;
    const mat = new StandardMaterial("glowingMat_" + colorType, scene);
    mat.diffuseColor = palette.diffuse;
    mat.emissiveColor = palette.emissive;
    mat.specularColor = new Color3(0, 0, 0);
    return mat;
}

export function createMat(name, color, diffuseTexPath, scene, scale = { uScale: 1, vScale: 1 }) {
    const mat = new StandardMaterial(name, scene);
    if(diffuseTexPath){
        const diffTex = new Texture(diffuseTexPath, scene);
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
export function createMatV2(scene, diffuseTexPath, normalTexPath, uVscaleTex = 1){
    const mat = new MatUsed("mat", scene)
    mat.specularColor = new Color3(0, 0, 0)
    if(normalTexPath){
        const normalTex = new Texture(normalTexPath, scene)
        normalTex.uScale = uVscaleTex
        normalTex.vScale = uVscaleTex
        mat.bumpTexture = normalTex
    }
    if(diffuseTexPath){
        const diffuseTex = new Texture(diffuseTexPath, scene)
        diffuseTex.uScale = uVscaleTex
        diffuseTex.vScale = uVscaleTex
        mat.diffuseTexture = diffuseTex
    }
    return mat
}
export function createColorMat(name, color, scene, normalTexPath){
    const mat = new StandardMaterial(name, scene)

    mat.diffuseColor = new Color3(color.r,color.g,color.b)
    mat.specularColor = new Color3(0, 0, 0)

    if(normalTexPath){
        const bumpTex = new Texture(normalTexPath, scene)
        mat.bumpTexture = bumpTex
    }

    return mat
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
    // additive blending: black pixels contribute nothing to the framebuffer,
    // so a texture with a black background reads as transparent without
    // needing an actual alpha channel (same technique as tools/sunrays.js)
    mat.alphaMode = Engine.ALPHA_ADD;
    mat.backFaceCulling = false
    return mat;
}