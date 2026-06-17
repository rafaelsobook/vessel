
import { MeshBuilder } from "@babylonjs/core";
import { loadModel, mergeAndLoadModel } from "../tools/loadmodel";
import { getSceneDet } from "../main/main";
import { createMatV2 } from "../tools/materials";
import { createSinglePlane } from "../assetcreation/createGrasses";


export async function getVillageAssetRegistry() {
    const bigHouse = await mergeAndLoadModel("./models/houses/hut2.glb");
    const mediumHouse = await mergeAndLoadModel("./models/houses/hut2.glb");
    const smallHouse = await mergeAndLoadModel("./models/houses/house1.glb");

    const bigTree = await mergeAndLoadModel("./models/trees/deadtree1.glb");
    const mediumTree = await mergeAndLoadModel("./models/trees/dead_tree_1.glb");
    const smallTree = await mergeAndLoadModel("./models/trees/tree_1.glb");

    const pole = await mergeAndLoadModel("./models/poleslamp/polelamp.glb");

    const woodenstake = await mergeAndLoadModel("./models/poleslamp/stake1.glb");
    const gate = await mergeAndLoadModel("./models/houses/gate1.glb");

    const rocks = await mergeAndLoadModel("./models/rocks/rocks_1.glb");

    
    const grass = createSinglePlane("grass_black")
    const grass2 = createSinglePlane("grass2_black")

    const bush = createSinglePlane("bush1")

    const flower = createSinglePlane("flower1", 0.4, 1)

    mediumHouse.isVisible = false
    bigHouse.isVisible = false
    smallHouse.isVisible = false

    smallTree.isVisible = false
    bigTree.isVisible = false
    mediumTree.isVisible = false

    pole.isVisible = false
    gate.isVisible = false

    return {

        bigHouse: bigHouse,
        mediumHouse: mediumHouse,
        smallHouse: smallHouse,
        // pole
        bigTree,
        mediumTree,
        smallTree,

        lightPole: pole,
        woodenstake,
        gate,

        rocks,
        grass,
        grass2,
        bush,
        flower,
        // herb,
        // mushroom
    }
}