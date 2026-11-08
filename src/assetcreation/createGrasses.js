import { MeshBuilder, StandardMaterial, Texture } from "@babylonjs/core"
import { getSceneDet } from "../main/main"
import { swayInWind } from "../tools/windSway.js"

// sway: how far the card's top leans in the village's breeze (tools/windSway.js
// - the instance's origin counts as the ground, so only the half above it
// moves; at 0 the card stands still)
export function createSinglePlane(textureName, width = 1, yPos= 0, sway = 0, scene = getSceneDet().scene) {
    const grass = MeshBuilder.CreatePlane("grass", { width }, scene)
    grass.position.y = yPos
    const tex = new Texture(`./images/textures/grass/${textureName}.jpg`, scene)
    tex.getAlphaFromRGB = true

    const grassMat = new StandardMaterial("grassMat", scene)
    grassMat.emissiveTexture = tex   // unlit — grass stays visible in dark scenes
    grassMat.opacityTexture  = tex   // black pixels become transparent
    grassMat.backFaceCulling = false
    grass.material = grassMat
    // a frozen material never rebinds, so the wind's clock would stop
    if(sway) swayInWind(grassMat, sway)
    else grassMat.freeze()
    grass.isVisible = false
    return grass
}