import {SceneLoader} from "@babylonjs/core"
import { loadAvatarContainer, loadMeshOnlyParts } from "../tools/loadmodel"
import { setSocketContainers } from "../sockets/worldsocket"

// monster model containers are added incrementally as new enemy types get
// modeled - a not-yet-added glb (404) shouldn't take the whole scene down
// with it, since setStartingContainers loads everything (avatar body,
// weapons, helmets...) in one sequence
async function loadMonsterRoot(path, scene){
    try {
        return await loadAvatarContainer(path, scene)
    } catch (error) {
        console.warn(`[containers] monster model missing/failed to load: "${path}"`, error)
        return null
    }
}

// equipment/accessory containers (hair, helmets, gauntlets, pauldrons,
// weapons) - none of these should be able to take the whole game down if
// one asset is missing/corrupt. Falls back to an empty mesh list instead of
// throwing, so containers.helmets.find(...) etc. downstream just never
// matches anything rather than crashing on a null/undefined container.
async function importMeshSafe(rootUrl, filename, scene){
    try {
        return await SceneLoader.ImportMeshAsync("", rootUrl, filename, scene)
    } catch (error) {
        console.warn(`[containers] failed to load "${rootUrl}${filename}"`, error)
        return { meshes: [] }
    }
}

export async function setStartingContainers(scene){
    try {
        const animeBodyContainer = await loadAvatarContainer("./models/avatar/avatar.glb", scene)
        let goblinRoot = await loadMonsterRoot("./models/monsters/goblin.glb", scene)
        let monolithRoot = await loadMonsterRoot("./models/monsters/monolith.glb", scene)
        let slimeRoot = await loadMonsterRoot("./models/monsters/slime.glb", scene)
        let lesserDemonRoot = await loadMonsterRoot("./models/monsters/lesserdemon.glb", scene)

        const HairModel = await importMeshSafe("./models/avatar/", "hairModels.glb", scene)
        const helmets = await importMeshSafe("./models/helmets/", "helmets.glb", scene)
        helmets.meshes.forEach(m => m.isVisible = false)
        const gauntlets = await importMeshSafe("./models/gauntlets/", "gauntlets.glb", scene)
        gauntlets.meshes.forEach(m => m.isVisible = false)
        const pauldrons = await importMeshSafe("./models/pauldrons/", "pauldrons.glb", scene)
        pauldrons.meshes.forEach(m => m.isVisible = false)
        // single-mesh, non-sword weapons (spear etc) - see createweapon.js's
        // createSingleMeshWeapon. Doesn't exist yet; importMeshSafe just
        // falls back to an empty list until this glb is actually added
        // const weapons = await importMeshSafe("./models/weapons/", "weapons.glb", scene)
        // weapons.meshes.forEach(m => m.isVisible = false)
        // const helmets = await loadModel("./models/helmets/helmets.glb", scene, true)

        let allweaponParts
        try {
            allweaponParts = await loadMeshOnlyParts("./models/swords/allswords.glb", scene)
        } catch (error) {
            console.warn(`[containers] failed to load weapon parts`, error)
            allweaponParts = []
        }

        const containers = setSocketContainers({
            hairs: HairModel.meshes,
            animeBody: animeBodyContainer,
            allweapons: allweaponParts,
            weapons:null,
            helmets: helmets.meshes,
            gauntlets: gauntlets.meshes,
            pauldrons: pauldrons.meshes,
            armors: null,
            belts: null,
            cloaks: null,

            goblinRoot,
            monolithRoot,
            slimeRoot,
            lesserDemonRoot
        })
        return { animeBodyContainer }
    } catch (error) {
        console.log(error)
        return false
    }
}
