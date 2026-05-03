

export function sceneCleanupReady(scene, controls){
    scene.onDisposeObservable.addOnce(() => controls.dispose())
}