import { Color3, Mesh, MeshBuilder, StandardMaterial, Texture } from "@babylonjs/core"
import { obtain } from "../charactersystem/inventory.js"
import { createLootItem } from "../staticRecources/resourceLoot.js"
import { emitPickupGrain } from "../sockets/emits.js"
import { definePickupKind } from "../components/groundPickups.js"

// World grain patches (tcp/recources/grains.ts). Built like the village
// grass (createGrasses.js): an unlit plane whose black background is cut out
// by brightness - except here the two crossed planes are merged into ONE
// template, so each grain is a single instance that can be disposed on its
// own when picked up. The walk-up + click-to-pick-up flow is
// components/groundPickups.js's, shared with the dungeon's mushrooms.

const GRAIN_SIZE = 1.4
const PICKUP_RADIUS = 2.5

function buildTemplate(scene){
    const planeA = MeshBuilder.CreatePlane("grainPlaneA", { size: 1 }, scene)
    const planeB = MeshBuilder.CreatePlane("grainPlaneB", { size: 1 }, scene)
    planeB.rotation.y = Math.PI / 2
    const template = Mesh.MergeMeshes([planeA, planeB], true)
    template.name = "grainTemplate"

    const tex = new Texture("./images/textures/grass/grain.webp", scene)
    tex.getAlphaFromRGB = true

    const mat = new StandardMaterial("grainMat", scene)
    mat.emissiveTexture = tex
    mat.opacityTexture = tex
    mat.backFaceCulling = false
    // StandardMaterial's default white diffuse gets lit ON TOP of the emissive
    // texture, washing the gold wheat out to pale cream - black keeps it
    // actually unlit, showing only the texture's own color
    mat.diffuseColor = Color3.Black()
    mat.specularColor = Color3.Black()
    template.material = mat
    mat.freeze()

    template.isVisible = false
    template.isPickable = false
    return template
}

const grains = definePickupKind({
    name: "grain",
    buildTemplate,
    // groundPos.y is the ground height - the plane is centered on its own
    // origin, so it's raised by half its height to stand on that ground
    place: (grain, groundPos) => {
        const size = GRAIN_SIZE * (0.85 + Math.random() * 0.3)
        grain.scaling.setAll(size)
        grain.position.set(groundPos.x, groundPos.y + size / 2, groundPos.z)
        grain.rotation.y = Math.random() * Math.PI
    },
    iconImage: "./images/items/crafting/grain.webp",
    pickupRadius: PICKUP_RADIUS,
    onPickedUp: grainId => {
        const item = createLootItem("grain")
        if(item) obtain(item)
        emitPickupGrain(grainId)
    },
})

export const createGrainMesh = grains.create
export const removeGrainMesh = grains.remove
