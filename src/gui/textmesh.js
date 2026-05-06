import { Mesh } from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock } from "@babylonjs/gui"

export function createTextMesh(scene, theParent,textToDisplay, color, pos, fontSize){
    const nameMesh = Mesh.CreatePlane("nameTag", 5, scene);
    nameMesh.isPickable = false

    nameMesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    const textureForName = AdvancedDynamicTexture.CreateForMesh(nameMesh);

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