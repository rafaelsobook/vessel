import {SceneLoader} from "@babylonjs/core"
import { loadAvatarContainer, loadMeshOnlyParts, mergeAndLoadModel } from "../tools/loadmodel"
import { loadProjectileModels } from "../assetcreation/createProjectileModel"
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

// non-animated cloneable prop roots (treasure chest etc, same idea as
// assetregistry.js's village props) - mergeAndLoadModel flattens a
// multi-part glb into one mesh so callers can just .clone() it wherever a
// prop needs to spawn later, instead of loadMonsterRoot's rigged/animated
// loadAvatarContainer path above (wrong tool for a static prop). Same
// "warn and fall back to null" resilience as every other optional asset
// here - a missing/corrupt treasure.glb shouldn't take the whole scene down.
async function loadPropRootSafe(path, scene){
    try {
        const mesh = await mergeAndLoadModel(path, scene)
        if(mesh) mesh.isVisible = false
        return mesh
    } catch (error) {
        console.warn(`[containers] prop model missing/failed to load: "${path}"`, error)
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
        let treasureRoot = await loadPropRootSafe("./models/indors/treasure.glb", scene)
        let bonfireRoot = await loadPropRootSafe("./models/outdors/bonfire.glb", scene)

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
        // axe/pickaxe parts (models/axe/axes.glb - axe_blade/axe_guard/
        // axe_handle, pickaxe_blade/pickaxe_guard, no pickaxe_handle at all,
        // see createweapon.js's own SHARED_PART_SOURCE for why) - merged
        // into the SAME flat allweapons object allswords.glb's own parts
        // already live in, since createweapon.js's createPartsWeapon looks
        // everything up from that one object regardless of weaponType.
        // Same "warn and fall back to nothing" resilience as every other
        // optional asset here - a missing/corrupt axes.glb shouldn't take
        // sword loading (or the rest of the scene) down with it.
        try {
            const axeParts = await loadMeshOnlyParts("./models/axe/axes.glb", scene)
            allweaponParts = { ...allweaponParts, ...axeParts }
        } catch (error) {
            console.warn(`[containers] failed to load axe/pickaxe weapon parts`, error)
        }

        // real GLB projectile models (models/projectiles/*.glb) -
        // createProjectileModel.js's own PROJECTILE_MODEL_PATHS registry;
        // loadProjectileModels already warns-and-skips per missing/failed
        // model rather than throwing, so no try/catch needed here
        const projectileModels = await loadProjectileModels(scene)

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
            projectileModels,

            goblinRoot,
            monolithRoot,
            slimeRoot,
            lesserDemonRoot,
            treasureRoot,
            bonfireRoot
        })
        return { animeBodyContainer }
    } catch (error) {
        console.log(error)
        return false
    }
}
