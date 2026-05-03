import {PBRMaterial, Texture, Color3} from "@babylonjs/core";

export function createPBRMat(pathName, texName, scene, {
    uScale = 2, vScale = 2
} = {}, albedoColor3) {
    const mat = new PBRMaterial(texName, scene);

    const albTex = new Texture(`./images/textures/${pathName}/${texName}_diff.jpg`, scene);
    albTex.uScale   = uScale;
    albTex.vScale   = vScale;
    // albTex.uOffset  = uOffset;
    // albTex.vOffset  = vOffset;

    const bumpTex =  new Texture(`./images/textures/${pathName}/${texName}_normal.jpg`, scene);
    bumpTex.uScale  = uScale;
    bumpTex.vScale  = vScale;
    mat.bumpTexture = bumpTex;

    mat.albedoColor          = Color3.White();
    mat.roughness            = 1;
    mat.metallic             = 0;
    mat.environmentIntensity = 0.3;
    // mat.emissiveColor = new Color3(0.02, 0.1, 0.05);

    // mat.albedoTexture = albTex
    if(albedoColor3){
        mat.albedoColor = albedoColor3
        // if(albTex) mat.albedoTexture = albTex
    }else{
        mat.albedoTexture = albTex
    }
    mat.bumpTexture = bumpTex
    return mat;
}