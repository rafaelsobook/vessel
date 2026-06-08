import { LoadAssetContainerAsync, SceneLoader, Mesh, Vector3 } from "@babylonjs/core";
import "@babylonjs/loaders";

// loadTemplate(path, scene)
// Loads a GLB, finds the real geometry mesh, scales/positions it,
// strips the Blender material and returns the mesh ready for createInstance().
//
// The returned mesh is:
//   - Detached from __root__ (world space, no parent transform)
//   - isVisible = false  (template only, instances render)
//   - material = null    (caller assigns material)
//   - position = (0,0,0)
//

export async function loadModel(path, scene) {
    const container = await SceneLoader.LoadAssetContainerAsync("", path, scene);
    container.addAllToScene();

    // Find the mesh that actually has geometry — skip __root__ and empty nodes
    const mesh = container.meshes.find(m => m.getTotalVertices() > 0);
    if (!mesh) throw new Error(`[loadTemplate] No geometry found in ${path}`);

    // Detach from __root__ so our scaling/position is in world space
    // and doesn't get double-transformed by the parent node
    mesh.setParent(null);
    // mesh.position.setAll(0);
    // GLB from Blender often arrives upside down in BabylonJS due to
    // the Z-up → Y-up axis conversion. Rotate 180° on X to flip it right-side up.
    // mesh.rotation.set(Math.PI/2, 0, 0);

    // Strip the imported Blender material completely
    // generateDungeon will assign the correct PBR material
    mesh.material = null;
    mesh.isVisible = false;

    // mesh.rotationQuaternion = null
    return mesh;
}

export async function loadModelByIndx(path, meshIndx, scene) {
    const container = await SceneLoader.ImportMeshAsync("", "", path, scene);
    container.meshes[meshIndx].parent = null
    container.meshes[0].dispose()
    return container.meshes[meshIndx];
}

export async function mergeAndLoadModel(path, scene, functionBeforeMerge){
    const container = await SceneLoader.LoadAssetContainerAsync("", path, scene);
    container.addAllToScene();
    if(functionBeforeMerge) return functionBeforeMerge(container)
    
    const mesh = Mesh.MergeMeshes(
        container.meshes[0].getChildMeshes(),
        true,
        true,
        undefined,
        false,
        true
    )

    // setInterval(() => {
    //     // mesh.position.x += Math.random()
    //     const insta = mesh.createInstance("ads")

    //     insta.position = new Vector3(Math.random() * 10, 0, Math.random() * 10)
    // }, 1000)
    return mesh
}
export async function loadAvatarContainer(path, scene){
    return await LoadAssetContainerAsync(path, scene);
}

export async function loadMeshOnlyParts(path, scene) {
    const container = await LoadAssetContainerAsync(path, scene)
    container.addAllToScene()

    const rootNode = container.meshes[0]
    const parts = container.meshes.slice(1)

    parts.forEach(m => {
        // Detach from __root__ while preserving world transform.
        // __root__ carries Blender's Z-up→Y-up axis fix — without this,
        // createInstance() would produce sideways/rotated parts since
        // instances don't inherit the parent chain.
        m.setParent(null)
        m.bakeCurrentTransformIntoVertices()
        m.isVisible = false
        m.material = null
    })

    rootNode.dispose()

    return Object.fromEntries(parts.map(m => [m.name, m]))
}