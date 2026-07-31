import { SpotLight, HemisphericLight, DirectionalLight,Color3, Color4, Vector3, Scene } from "@babylonjs/core";

export function setupLighting(scene, placeDetail) {
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

    const {fogColor, fogDensity, skyColor} = placeDetail.sceneTemp
    let lightsUsed = []
    placeDetail.sceneTemp?.lights?.forEach((light) => {
        const tint = light.color ?? fogColor
        if (light.name === "directional") {
            const dir = light.direction ?? {x: -1, y: -2, z: -1}
            const dirLight = new DirectionalLight("dir_light", new Vector3(dir.x, dir.y, dir.z), scene);
            dirLight.intensity = light.intensity
            dirLight.diffuse = new Color3(tint.r, tint.g, tint.b);
            lightsUsed.push(dirLight)
        }
        if(light.name === "hemispheric"){
            const hemi = new HemisphericLight("hemi_ambient", new Vector3(0, 1, 0), scene);
            hemi.position = new Vector3(0, 1, 0);
            hemi.intensity = light.intensity
            // hemi.diffuse = new Color3(tint.r, tint.g, tint.b);
            lightsUsed.push(hemi)
        }
    })            // no specular from ambient fill

    // scene.fogMode = Scene.FOGMODE_EXP;
    scene.fogMode = Scene.FOGMODE_EXP;
    scene.fogColor = new Color3(fogColor.r,fogColor.g,fogColor.b);
    scene.fogDensity = 0.003;

    // Sky — with no skybox mesh, scene.clearColor IS the sky. Lets sceneTemp
    // paint a dusk/sunset backdrop instead of Babylon's default dark grey-blue.
    if(skyColor) scene.clearColor = new Color4(skyColor.r, skyColor.g, skyColor.b, 1);

    return lightsUsed

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