import { PointLight, HemisphericLight, Color3, Vector3, CubeTexture } from "@babylonjs/core";

export function setupLighting(scene, placeDetail) {

    // ── Environment texture ───────────────────────────────────────────────
    // PBRMaterial REQUIRES scene.environmentTexture to render correctly.
    // Without it, environmentIntensity has nothing to sample and everything
    // looks pitch black or flat regardless of lights.
    //
    // Option A — use a real .env file (best quality):
    //   const envTex = CubeTexture.CreateFromPrefilteredData("./images/dungeon.env", scene);
    //   scene.environmentTexture = envTex;
    //
    // Option B — generate a neutral environment on the fly (no asset needed):
    scene.createDefaultEnvironment({
        createGround:    false,   // we have our own ground
        createSkybox:    false,   // dungeon has no sky
        environmentTexture: "https://assets.babylonjs.com/environments/environmentSpecular.env",
    });
    // Lower intensity so the dungeon stays dark but surfaces are readable
    scene.environmentIntensity = 1; // 0.3

    // ── Hemispheric fill light ─────────────────────────────────────────────
    // Works fine with PBR — provides diffuse fill so no surface is completely black
    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    hemi.intensity   = 0.4;
    hemi.diffuse     = new Color3(0.5, 0.5, 0.6);
    hemi.groundColor = new Color3(0.2, 0.2, 0.3);
    hemi.specular    = new Color3(0, 0, 0);  // kill specular from hemi — looks weird on PBR

    // ── Point lights (from dungeon data) ──────────────────────────────────
    // NOTE: light.x / light.z from BSP are already GRID coordinates.
    // Multiply by cellSize to get world space.
    placeDetail.lighting.lights.forEach((light, i) => {
        // avoid duplicate with the lights generateDungeon already spawns
        // only create room-centre lights here, not gate/stair lights
        const pl = new PointLight(   // or use imported PointLight
            `room_light_${i}`,
            new Vector3(
                light.x * placeDetail.layout.cellSize,
                light.y ?? 5,
                light.z * placeDetail.layout.cellSize
            ),
            scene
        );
        pl.intensity = light.intensity;
        pl.diffuse   = Color3.FromHexString(light.color);
        pl.range     = light.range;
    });
}