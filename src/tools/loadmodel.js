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
    console.log(mesh)
    if (!mesh) throw new Error(`[loadTemplate] No geometry found in ${path}`);

    console.log(`[loadTemplate] found mesh: "${mesh.name}" verts=${mesh.getTotalVertices()}`);
    console.log(`[loadTemplate] mesh parent: ${mesh.parent?.name ?? "none"}`);

    // Detach from __root__ so our scaling/position is in world space
    // and doesn't get double-transformed by the parent node
    mesh.setParent(null);
    mesh.position.setAll(0);
    // GLB from Blender often arrives upside down in BabylonJS due to
    // the Z-up → Y-up axis conversion. Rotate 180° on X to flip it right-side up.
    // mesh.rotation.set(Math.PI/2, 0, 0);

    // Strip the imported Blender material completely
    // generateDungeon will assign the correct PBR material
    mesh.material = null;
    mesh.isVisible = false;

    // Log the local bounding box so we can verify size
    const bbox = mesh.getBoundingInfo().boundingBox;
    const w = bbox.maximum.x - bbox.minimum.x;
    const h = bbox.maximum.y - bbox.minimum.y;
    const d = bbox.maximum.z - bbox.minimum.z;
    console.log(`[loadTemplate] local bbox: ${w.toFixed(3)} × ${h.toFixed(3)} × ${d.toFixed(3)}`);

    // mesh.rotationQuaternion = null
    return mesh;
}

export async function mergeAndLoadModel(path, scene){
    const container = await SceneLoader.LoadAssetContainerAsync("", path, scene);
    container.addAllToScene();
    
    const mesh = Mesh.MergeMeshes(
        container.meshes[0].getChildren(),
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
    const container = await LoadAssetContainerAsync(path, scene);
    return container
}