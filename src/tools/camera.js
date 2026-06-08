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
    const scene = camera.getScene()
    const smoothTarget = body.getAbsolutePosition().clone()
    camera.target.copyFrom(smoothTarget)

    if(camera._smoothFollowObserver){
        scene.onBeforeRenderObservable.remove(camera._smoothFollowObserver)
    }
    camera._smoothFollowObserver = scene.onBeforeRenderObservable.add(() => {
        const lerpSpeed = 8
        const bodyPos = body.getAbsolutePosition()
        smoothTarget.x += (bodyPos.x - smoothTarget.x) * lerpSpeed * (scene.getEngine().getDeltaTime() / 1000)
        smoothTarget.y += (bodyPos.y - smoothTarget.y) * lerpSpeed * (scene.getEngine().getDeltaTime() / 1000)
        smoothTarget.z += (bodyPos.z - smoothTarget.z) * lerpSpeed * (scene.getEngine().getDeltaTime() / 1000)
        camera.target.copyFrom(smoothTarget)
    })
}
export function camShake(scene, cam, intensity, isSlight){
    console.log("will shake")
    const shakeDuration = 0.1
    const shakeIntensity = intensity
    // cam.setTarget(null)
    let origAlpha = cam.alpha
    let origBeta = cam.beta

    let elapsed = 0;

    let shakeAnim = scene.onBeforeRenderObservable.add(() => {
        elapsed += scene.getEngine().getDeltaTime()/1000;

        if(elapsed < shakeDuration){
            let alphaOffset = Math.sin(elapsed * 50) * shakeIntensity;
            let betaOffset = Math.sin(elapsed * 50) * shakeIntensity;
            cam.alpha = origAlpha + alphaOffset
            if(!isSlight) cam.beta = origBeta + betaOffset
        }else{
            cam.alpha = origAlpha
            if(!isSlight) cam.beta = origBeta
            scene.onBeforeRenderObservable.remove(shakeAnim)
        }
    })
}