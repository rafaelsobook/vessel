import { Engine, Vector3, MeshBuilder, Texture, Color3, StandardMaterial } from "@babylonjs/core";
import { randNum } from "./random";

let godrays = [];
const createOneSunRay = (position, scale, scene) => {

    const sunrayRoot = MeshBuilder.CreatePlane("sunray", { size: 1 }, scene);

   
    sunrayRoot.position = new Vector3(position.x, position.y, position.z);
    // plane.rotation = rotation;
    sunrayRoot.scaling = scale ? new Vector3(scale.x, scale.y, scale.z) : new Vector3(1, 1, 1);

    // Create a translucent material with additive blending
    const material = new StandardMaterial("godrayMaterial", scene);

    // Load the flare texture
    const flareTexture = new Texture("https://www.babylonjs-playground.com/textures/flare.png", scene);
    flareTexture.hasAlpha = true;
    // Configure material for proper transparency
    material.diffuseTexture = flareTexture;
    material.diffuseTexture.hasAlpha = true;
    material.useAlphaFromDiffuseTexture = true;

    material.alphaMode = Engine.ALPHA_ADD;

    // Make material unlit and emissive for a glowing effect
    material.emissiveColor = new Color3(1, 1, 1);
    material.disableLighting = true;
    material.backFaceCulling = false;

    // Make sure billboarding is enabled if you want the plane to face the camera
    // plane.billboardMode = AbstractMesh.BILLBOARDMODE_ALL;

    sunrayRoot.material = material;

    sunrayRoot.isPickable = false

    return sunrayRoot;
};

export function createSunRay(position, scale, scene){
    let sunray = scene.getMeshByName("sunray");
    if(!sunray){
        sunray = createOneSunRay(position, scale, scene);
    }
    // Create multiple planes to represent the godrays

    const numRays = 100;
    const raySpacing = 1.5;
    for (let i = 0; i < numRays; i++) {
        const rayScale = new Vector3(randNum(.4,.7), randNum(8,10), randNum(.2,.7)); // Stretch the planes in the Y-axis

        // Create and store each godray plane
        const plane = createOneSunRay(new Vector3(randNum(-.2,.3), randNum(-1,0), randNum(-1,1.2)), rayScale, scene)
        plane.parent = sunray;
        plane.rotation.y = randNum(0, Math.PI)
        // plane
        godrays.push(plane);
    }
    scene.registerBeforeRender(() => {
        godrays.forEach((ray, index) => {
            // Update the planes' position or alpha to simulate flickering
            ray.material.alpha = 0.01 + Math.sin(Date.now() * 0.0009 + index) * 0.04; // Flickering effect
            
            // Keep the plane's rotation aligned with the emitter
            // ray.rotation.x = emitter.rotation.x;
        });
    });

    return sunray;
}
