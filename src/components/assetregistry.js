
import { MeshBuilder } from "@babylonjs/core";
import { loadModel, mergeAndLoadModel } from "../tools/loadmodel";
import { getSceneDet } from "../main/main";
import { createMatV2 } from "../tools/materials";
import { createSinglePlane } from "../assetcreation/createGrasses";


// one missing/corrupt village prop shouldn't fail the whole registry (and
// with it, every village scene load) - createvillage.js's spawnProps/
// spawnNonPhysics already guard against a null template (`if (!mainMesh)
// return`), so returning null here is safe for every consumer downstream
async function loadVillagePropSafe(path){
    try {
        return await mergeAndLoadModel(path)
    } catch (error) {
        console.warn(`[assetregistry] failed to load village prop "${path}"`, error)
        return null
    }
}

export async function getVillageAssetRegistry() {
    const bigHouse = await loadVillagePropSafe("./models/houses/hut2.glb");
    const mediumHouse = await loadVillagePropSafe("./models/houses/hut2.glb");
    const smallHouse = await loadVillagePropSafe("./models/houses/house1.glb");

    const bigTree = await loadVillagePropSafe("./models/trees/deadtree1.glb");
    const mediumTree = await loadVillagePropSafe("./models/trees/dead_tree_1.glb");
    const smallTree = await loadVillagePropSafe("./models/trees/tree_1.glb");

    const pole = await loadVillagePropSafe("./models/poleslamp/polelamp.glb");

    const woodenstake = await loadVillagePropSafe("./models/poleslamp/stake1.glb");
    const gate = await loadVillagePropSafe("./models/houses/gate1.glb");

    const rocks = await loadVillagePropSafe("./models/rocks/rocks_1.glb");


    const grass = createSinglePlane("grass_black")
    const grass2 = createSinglePlane("grass2_black")

    const bush = createSinglePlane("bush1")

    const flower = createSinglePlane("flower1", 0.4, 1)

    if(mediumHouse) mediumHouse.isVisible = false
    if(bigHouse) bigHouse.isVisible = false
    if(smallHouse) smallHouse.isVisible = false

    if(smallTree) smallTree.isVisible = false
    if(bigTree) bigTree.isVisible = false
    if(mediumTree) mediumTree.isVisible = false

    if(pole) pole.isVisible = false
    if(gate) gate.isVisible = false

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