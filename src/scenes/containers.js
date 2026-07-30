import {SceneLoader} from "@babylonjs/core"
import { loadAvatarContainer, loadMeshOnlyParts } from "../tools/loadmodel"
import { setSocketContainers } from "../sockets/worldsocket"

export async function setStartingContainers(scene){
    try {
        const animeBodyContainer = await loadAvatarContainer("./models/avatar/avatar.glb", scene)
        let goblinRoot = await loadAvatarContainer("./models/monsters/goblin.glb", scene)
        let monolithRoot = await loadAvatarContainer("./models/monsters/monolith.glb", scene)
        let slimeRoot = await loadAvatarContainer("./models/monsters/slime.glb", scene)

        const HairModel = await SceneLoader.ImportMeshAsync("", "./models/avatar/", "hairModels.glb", scene)
        const helmets = await SceneLoader.ImportMeshAsync("", "./models/helmets/", "helmets.glb", scene)
        helmets.meshes.forEach(m => m.isVisible = false)
        const gauntlets = await SceneLoader.ImportMeshAsync("", "./models/gauntlets/", "gauntlets.glb", scene)
        gauntlets.meshes.forEach(m => m.isVisible = false)
        const pauldrons = await SceneLoader.ImportMeshAsync("", "./models/pauldrons/", "pauldrons.glb", scene)
        pauldrons.meshes.forEach(m => m.isVisible = false)
        // const helmets = await loadModel("./models/helmets/helmets.glb", scene, true)

        const allweaponParts = await loadMeshOnlyParts("./models/swords/allswords.glb", scene)

        const containers = setSocketContainers({
            hairs: HairModel.meshes,
            animeBody: animeBodyContainer,
            allweapons: allweaponParts,
            helmets: helmets.meshes,
            gauntlets: gauntlets.meshes,
            pauldrons: pauldrons.meshes,
            armors: null,
            belts: null,
            cloaks: null,

            goblinRoot,
            monolithRoot,
            slimeRoot
        })
        return { animeBodyContainer }
    } catch (error) {
        console.log(error)
        return false
    }    
}
