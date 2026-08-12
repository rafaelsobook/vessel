import { StandardMaterial, Color3, FresnelParameters, HighlightLayer } from "@babylonjs/core";

// diffuse/emissive pair per elementType - the material's actual hue. Every
// OTHER part of the "translucent gel" look (alpha, Fresnel rim/opacity
// shaping, backFaceCulling) is identical across elements - see
// createSlimeMat below, which only reads color from here. "water" is the
// original green this material always rendered before elementType was
// actually wired up (createEnemy.js used to call this with no elementType
// arg at all, so it silently always fell back to the "water" default here).
const SLIME_ELEMENT_COLORS = {
    water:    { diffuse: new Color3(0.1, 0.8, 0.3),  emissive: new Color3(0.0, 1.0, 0.3) },
    fire:     { diffuse: new Color3(0.9, 0.22, 0.05), emissive: new Color3(1.0, 0.35, 0.05) },
    // "lightning" not "electric" - matches the game's own established
    // element vocabulary (see npcDetails.js's crystal NPC dialogue and
    // enemyDetails.ts's electricslime entry)
    lightning: { diffuse: new Color3(0.85, 0.8, 0.1),  emissive: new Color3(1.0, 0.95, 0.25) },
    // darkslime - purple diffuse kept fairly dim (not the bright saturation
    // the other three use) so it reads as "purple with a twist of black"
    // rather than a plain bright purple slime; emissive nudged even darker
    // than diffuse for the same reason, still enough to catch the Fresnel
    // rim glow every slime gets from the shared material below
    dark: { diffuse: new Color3(0.28, 0.05, 0.4), emissive: new Color3(0.35, 0.05, 0.5) },
}

export function createSlimeMat(scene, body, elementType = "water"){
    const mat = new StandardMaterial("slimeMat", scene);
    const palette = SLIME_ELEMENT_COLORS[elementType] ?? SLIME_ELEMENT_COLORS.water;

    mat.diffuseColor = palette.diffuse;
    // mat.specularColor = new Color3(0.4, 1.0, 0.5);
    // mat.specularPower = 64;
    mat.alpha = 0.5;

    mat.emissiveColor = palette.emissive;
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