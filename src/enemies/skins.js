import { StandardMaterial, Color3, FresnelParameters, HighlightLayer } from "@babylonjs/core";

const slimeColors = [
    {
        elementType: "poison",
        emissiveColor: {r: 0.0, g: 1.0, b:0.3}
    }
]
export function createSlimeMat(scene, body, elementType = "water"){
    const mat = new StandardMaterial("slimeMat", scene);

    mat.diffuseColor = new Color3(0.1, 0.8, 0.3);
    // mat.specularColor = new Color3(0.4, 1.0, 0.5);
    // mat.specularPower = 64;
    mat.alpha = 0.5;

    mat.emissiveColor = new Color3(0.0, 1.0, 0.3);
    mat.emissiveFresnelParameters = new FresnelParameters();
    // mat.emissiveFresnelParameters.leftColor = new Color3(0.0, 1.0, 0.3);
    // mat.emissiveFresnelParameters.rightColor = new Color3(0.0, 0.05, 0.0);
    mat.emissiveFresnelParameters.power = 3;
    mat.emissiveFresnelParameters.bias = 0.1;

    mat.opacityFresnelParameters = new FresnelParameters();
    mat.opacityFresnelParameters.leftColor = Color3.White();
    mat.opacityFresnelParameters.rightColor = Color3.Black();
    mat.opacityFresnelParameters.power = 2;
    mat.opacityFresnelParameters.bias = 0.1;

    mat.backFaceCulling = false;
    // setTimeout(() => {
    //     createBodyGlow(scene, body)
    // }, 3000)
    return mat
}


function getEffectLayer(scene, name) {
  return scene.effectLayers ? scene.effectLayers.find(l => l.name === name) : null;
}
function createBodyGlow(scene, mesh) {
  let hl = getEffectLayer(scene, "hl");

  if (hl) {
    // Layer exists — just add the mesh, everything else already set up
    hl.addMesh(mesh, new Color3(0.0, 1.0, 0.4));
    return hl;  // ← early return, don't re-register the observer
  }

  // First time — create the layer
    hl = new HighlightLayer("hl", scene, {
        mainTextureRatio: 0.25,
        blurHorizontalSize: 0.8,
        blurVerticalSize: 0.8,
        // removed alphaBlendingMode — not valid in BabylonJS 9.x
    });

  hl.innerGlow = true;
  hl.outerGlow = true;
  hl.addMesh(mesh, new Color3(0.0, 1.0, 0.4)); // ← now called after layer exists

//   let t = 0;
//   scene.onBeforeRenderObservable.add(() => {
//     t += 0.025;
//     hl.intensity = 0.4 + Math.sin(t) * 0.4;
//   });


}