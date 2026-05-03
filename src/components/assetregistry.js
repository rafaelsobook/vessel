
import { loadModel, mergeAndLoadModel } from "../tools/loadmodel";


export async function getVillageAssetRegistry() {
    const bigHouse = await mergeAndLoadModel("./models/houses/bighouse.glb");
    const mediumHouse = await mergeAndLoadModel("./models/houses/house2.glb");
    const smallHouse = await mergeAndLoadModel("./models/houses/house1.glb");

    const smallTree = await mergeAndLoadModel("./models/trees/deadtree1.glb");

    const pole = await mergeAndLoadModel("./models/poleslamp/polelamp.glb");

    mediumHouse.isVisible = false
    bigHouse.isVisible = false
    smallHouse.isVisible = false
    
    smallTree.isVisible = false
    pole.isVisible = false

    return {
        
        bigHouse: bigHouse,
        mediumHouse: mediumHouse,
        smallHouse: smallHouse,
        // pole
        bigTree: smallTree,
        mediumTree: smallTree,
        smallTree,

        lightPole: pole,

        // grass,
        // herb,
        // mushroom
    }
}