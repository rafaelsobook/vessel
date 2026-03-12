import { HemisphericLight, PointLight, Color3, Vector3 } from "@babylonjs/core";

export function setupLighting(scene, placeDetail) {
    // Stronger ambient light so dungeon isn't pitch black
    const ambientColor = Color3.FromHexString(placeDetail.lighting.ambient.color);
    scene.ambientColor = ambientColor.scale(0.5);
    
    // Add a subtle hemispheric light for better visibility
    const hemiLight = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    hemiLight.intensity = 0.4;
    hemiLight.diffuse = new Color3(0.6, 0.6, 0.7);
    hemiLight.groundColor = new Color3(0.2, 0.2, 0.3);
    
    placeDetail.lighting.lights.forEach((light, i) => {
        const pointLight = new PointLight(
            `light_${i}`,
            new Vector3(
                light.x * placeDetail.layout.cellSize,
                1.5,
                light.z * placeDetail.layout.cellSize
            ),
            scene
        );
        pointLight.intensity = light.intensity * 2;
        pointLight.diffuse = Color3.FromHexString(light.color);
        pointLight.range = light.range * 1.5;
    }); 
}