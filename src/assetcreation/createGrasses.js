import { MeshBuilder, StandardMaterial, Texture } from "@babylonjs/core"
import { getSceneDet } from "../main/main"

export function createSinglePlane(textureName, width = 1, yPos= 0) {
    const scene = getSceneDet().scene
    const grass = MeshBuilder.CreatePlane("grass", { width }, scene)
    grass.position.y = yPos
    const tex = new Texture(`./images/textures/grass/${textureName}.jpg`, scene)
    tex.getAlphaFromRGB = true

    const grassMat = new StandardMaterial("grassMat", scene)
    grassMat.emissiveTexture = tex   // unlit — grass stays visible in dark scenes
    grassMat.opacityTexture  = tex   // black pixels become transparent
    grassMat.backFaceCulling = false
    grass.material = grassMat
    grassMat.freeze()
    grass.isVisible = false
    return grass
}