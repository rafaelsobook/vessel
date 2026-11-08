import { Mesh, MeshBuilder } from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock } from "@babylonjs/gui"

/**
 * A plane with a GUI texture drawn on it (AdvancedDynamicTexture.CreateForMesh)
 * for a single line of world-space text or a bar: name tags, hp bars, the
 * numbers that pop off a hit.
 *
 * - Only the band the content sits in. CreateForMesh's default is a 1024x1024
 *   texture (mipmapped) and a 1024x1024 canvas behind it - ~9.5 MB for one
 *   line of text, two per enemy, one per damage number. The texture here is
 *   texWidth px across planeWidth (the density those 1024-square planes always
 *   had, so text and bars come out exactly as before) and only texHeight px
 *   tall, the plane cut to match: the empty top and bottom of the old square
 *   are gone, nothing that showed.
 * - Freed with its mesh. Babylon disposes neither the texture nor the material
 *   CreateForMesh made when the mesh goes, so every name tag, hp bar and damage
 *   number ever shown stayed in memory - canvas and GPU texture - until the
 *   place was left, still checked every frame.
 * - No pointer-move support - none of these is ever picked.
 */
export function createMeshGui(name, planeWidth, texWidth, texHeight, scene){
    const mesh = MeshBuilder.CreatePlane(name, { width: planeWidth, height: planeWidth * texHeight / texWidth }, scene)
    const ui = AdvancedDynamicTexture.CreateForMesh(mesh, texWidth, texHeight, false)
    mesh.onDisposeObservable.addOnce(() => {
        const mat = mesh.material
        ui.dispose()
        // the material CreateForMesh made for it - unless the mesh's own
        // dispose already took it (dispose(_, disposeMaterialAndTextures))
        if(mat && mat.getScene()?.materials.includes(mat)) mat.dispose()
    })
    return { mesh, ui }
}

// a 5-unit-wide name tag (was a 5x5 plane on a 1024 square: the same 1024 px
// across, 256 tall - room for any font size up to the 90 default)
export function createTextMesh(scene, theParent,textToDisplay, color, pos, fontSize){
    const { mesh: nameMesh, ui: textureForName } = createMeshGui("nameTag", 5, 1024, 256, scene)
    nameMesh.isPickable = false

    nameMesh.billboardMode = Mesh.BILLBOARDMODE_ALL;

    var text1 = new TextBlock();
    text1.text = textToDisplay
    text1.color = color
    text1.fontSize = fontSize ? fontSize : 90;

    textureForName.addControl(text1);
    if(theParent) nameMesh.parent = theParent
    nameMesh.position.x =pos.x
    nameMesh.position.y =pos.y
    nameMesh.position.z =pos.z

    // isFloating && addToFloatingUp({capId: capId, mesh: nameMesh})

    return nameMesh
}
