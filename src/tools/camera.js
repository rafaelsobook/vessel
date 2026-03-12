import { ArcRotateCamera, Vector3, Tools } from "@babylonjs/core";

let camera
export function createArcCam(scene, placeDetail){
    camera = new ArcRotateCamera(
        "camera",
        Tools.ToRadians(-90),
        Tools.ToRadians(75),
        15,
        new Vector3(
            placeDetail.spawn.x * placeDetail.layout.cellSize,
            1.6,
            placeDetail.spawn.z * placeDetail.layout.cellSize
        ),
        scene
    );
    camera.attachControl();
    camera.lowerRadiusLimit = 5;
    camera.upperRadiusLimit = 40;
    camera.lowerBetaLimit = Tools.ToRadians(20);
    camera.upperBetaLimit = Tools.ToRadians(85);
    camera.wheelPrecision = 50;
    
    return camera
}

export function attachCam(body){
    if(!camera) return console.warn("Camera not created yet to attach")
    camera.target = body;
}