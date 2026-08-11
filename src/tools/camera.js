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
    camera.lowerRadiusLimit = 1.7;
    camera.upperRadiusLimit = 20//10;
    camera.lowerBetaLimit = Tools.ToRadians(20);
    camera.upperBetaLimit = Tools.ToRadians(85);
    camera.wheelPrecision = 50;
    // was 0.01 - with maxZ left at Babylon's own default (10000, never set
    // anywhere in this codebase - confirmed by grep), that's a 1,000,000:1
    // far/near ratio for a STANDARD (non-logarithmic) depth buffer, which
    // concentrates almost all of its precision within the first ~1 unit
    // from the camera and leaves very little left over by the time you
    // reach the 2-10 unit range this camera actually operates in
    // (lowerRadiusLimit/upperRadiusLimit above) - exactly the kind of setup
    // that causes z-fighting/flickering between near-coincident surfaces
    // (an equipped armor/clothing mesh sitting a couple mm off the skin
    // mesh underneath it). 0.5 keeps a comfortable margin under
    // lowerRadiusLimit (1.7, so the camera can never actually zoom past
    // this near plane) while cutting the ratio to 20,000:1 - a ~50x
    // precision improvement across the whole visible range. Was
    // apparently thin enough everywhere to go unnoticed in the village
    // (small, near-origin coordinates - see enemyDetails.ts's own village
    // entries, all under ~150 units from world origin) but visibly flicker
    // in openworld, where the character's own world-position magnitude can
    // reach into the hundreds/low-thousands (SPAWN_Z 500, slimes now out to
    // 1000 - see enemyDetails.ts) - larger world coordinates compound
    // floating-point rounding error through the same already-thin depth
    // precision budget, on top of whatever the ratio alone already cost.
    camera.minZ = 0.5
    camera.checkCollisions = true;
    camera.collisionRadius = new Vector3(0.3, 0.3, 0.3);

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