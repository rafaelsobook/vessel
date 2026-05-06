import { ArcRotateCamera, Vector3, Tools } from "@babylonjs/core";

let camera


export function createArcCam(scene, placeDetail, head){
    camera = new ArcRotateCamera(
        "camera",
        Tools.ToRadians(-90),
        Tools.ToRadians(15),
        10,
        new Vector3(
            placeDetail.spawn.x * placeDetail.layout.cellSize,
            1.6,
            placeDetail.spawn.z * placeDetail.layout.cellSize
        ),
        scene
    );
    camera.attachControl();
    camera.lowerRadiusLimit = 5;
    camera.upperRadiusLimit = 20;
    camera.lowerBetaLimit = Tools.ToRadians(20);
    camera.upperBetaLimit = Tools.ToRadians(85);
    camera.wheelPrecision = 50;
    camera.minZ = 0.01

    // scene.registerBeforeRender(() => {
    //     const origin = camera.target.position ?? camera.target;
    //     const direction = camera.position.subtract(origin).normalize();
    //     const distance = Vector3.Distance(origin, camera.position);

    //     const ray = scene.createPickingRay(
    //         scene.getEngine().getRenderWidth() / 2,
    //         scene.getEngine().getRenderHeight() / 2,
    //         null,
    //         camera
    //     );

    //     const hit = scene.pickWithRay(
    //         { origin, direction, length: distance },
    //         (mesh) => mesh.isPickable && mesh.isVisible
    //     );

    //     if (hit?.pickedMesh) {
    //         console.log("Camera blocked by:", hit.pickedMesh.name);
    //         hit.pickedMesh.isVisible = false;
    //     }
    // });

    if(head) attachCam(head);    
    return camera
}

export function attachCam(body){
    if(!camera) return console.warn("Camera not created yet to attach")
    camera.target = body;
}