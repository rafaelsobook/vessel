

export function sceneCleanupReady(scene, controls){
    console.log(controls)
    scene.onDisposeObservable.addOnce(() => controls.dispose())
}