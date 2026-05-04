import { SpotLight, HemisphericLight, DirectionalLight,Color3, Vector3, Scene } from "@babylonjs/core";

export function setupLighting(scene, placeDetail) {
    console.log(placeDetail)

    // ── Environment texture ────────────────────────────────────────────────
    // PBRMaterial needs scene.environmentTexture to calculate reflections and
    // indirect lighting. Without it everything looks flat regardless of lights.
    scene.createDefaultEnvironment({
        createGround:       false,
        createSkybox:       false,
        // environmentTexture: "https://assets.babylonjs.com/environments/environmentSpecular.env",
    });
    // scene.environmentIntensity = 0.15; // low — dungeon is dark, just enough for surface detail

    // ── Hemispheric ambient fill ───────────────────────────────────────────
    // Prevents pitch-black shadows. Very dim — just lifts the floor off zero.
    const {fogColor, fogDensity} = placeDetail.sceneTemp
    placeDetail.sceneTemp?.lights?.forEach((light) => {
        

        if (light.name === "directional") {
            const dirLight = new DirectionalLight("dir_light", new Vector3(-1, -3, -1), scene);
            
            dirLight.intensity = light.intensity
            // dirLight.diffuse = new Color3(fogColor.r,fogColor.g,fogColor.b);
            
        }
        if(light.name === "hemispheric"){
            const hemi = new HemisphericLight("hemi_ambient", new Vector3(0, 1, 0), scene);
            hemi.position = new Vector3(-2, 4, 2);
            hemi.intensity = light.intensity
            hemi.diffuse = new Color3(fogColor.r,fogColor.g,fogColor.b);
        }
    })            // no specular from ambient fill

    scene.fogMode = Scene.FOGMODE_EXP;
    scene.fogColor = new Color3(fogColor.r,fogColor.g,fogColor.b);
    scene.fogDensity = fogDensity;
    // Ambient
    // scene.ambientColor = new Color3(0.1, 0.25, 0.15);

    // Fog
    scene.fogColor = new Color3(0.05, 0.15, 0.1);

    // Accent light

    // scene.activeLiglight.diffuse = new BABYLON.Color3(1.0, 0.6, 0.3);

    // const cs = placeDetail.layout.cellSize;

    // placeDetail.lighting.lights.forEach((light, i) => {
    //     // const wx = light.x * cs;
    //     // const wy = light.y ?? 8;        // world Y — already set by BSP as wallH*0.7
    //     // const wz = light.z * cs;

    //     // const spot = new SpotLight(
    //     //     `spot_${i}`,
    //     //     new Vector3(wx, wy, wz),    // position: near ceiling
    //     //     new Vector3(0, -1, 0),       // direction: straight down
    //     //     Math.PI / 2.5,               // angle: ~72° cone — wide enough to cover room floor
    //     //     2,                           // exponent: falloff sharpness (2=soft edge)
    //     //     scene
    //     // );
    //     // spot.diffuse   = Color3.FromHexString(light.color ?? "#ffaa55");
    //     // spot.specular  = Color3.FromHexString(light.color ?? "#ffaa55");
    //     // spot.intensity = light.intensity * 80;  // SpotLight needs higher intensity than PointLight
    //     // spot.range     = light.range * cs;       // convert grid units → world units
    // });
}