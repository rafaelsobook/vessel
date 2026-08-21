// Real GLB projectile assets (models/projectiles/*.glb), same load-once/
// clone-many pattern createweapon.js already established for allswords.glb:
// every model this file knows about gets loaded ONCE, at scene startup (see
// loadProjectileModels, called from containers.js's setStartingContainers),
// into a template stored on getSocketContainers().projectileModels - never
// loaded again after that. createProjectileModelInstance then just clones
// the already-loaded template synchronously, at whatever moment a skill
// actually casts - no await needed at cast time, same as createWeapon's own
// clone-from-container calls.
import { Vector3 } from "@babylonjs/core"
import { loadModel } from "../tools/loadmodel.js"
import { getSocketContainers } from "../sockets/worldsocket.js"

// name -> glb path. Add an entry here (and give the matching skill
// projectileVisual: { shape: "glbModel", model: { name: "..." } }) any time
// a new skill wants a real modeled projectile instead of a primitive shape/
// weapon-part assembly. "stoneshard" is the first - stoneshardSkill
// (skillsData.js) is what actually requests it.
const PROJECTILE_MODEL_PATHS = {
    stoneshard: "./models/projectiles/stoneshard.glb",
}

// loads every registered path in parallel - one failed/missing glb (a typo'd
// path, an asset not added yet) shouldn't take the rest down with it, same
// "warn and fall back to nothing" reasoning containers.js's own
// importMeshSafe/loadMonsterRoot already use for every other optional asset.
// Returns { name: templateMesh } - a name with no successfully-loaded
// template just won't be in the returned object, which
// createProjectileModelInstance below already treats as "nothing to clone,
// warn and no-op" rather than throwing.
export async function loadProjectileModels(scene){
    const entries = await Promise.all(
        Object.entries(PROJECTILE_MODEL_PATHS).map(async ([name, path]) => {
            try {
                const template = await loadModel(path, scene)
                return [name, template]
            } catch (error) {
                console.warn(`[createProjectileModel] failed to load "${name}" (${path})`, error)
                return null
            }
        })
    )
    return Object.fromEntries(entries.filter(Boolean))
}

// clones the named template (already loaded by loadProjectileModels above)
// and parents it under the given projectile box - mirrors createWeapon's own
// clone/parent/position-zero pattern in createweapon.js. Returns null (not a
// mesh) if the name has no loaded template, same "missing part -> warn,
// don't crash" convention createWeapon's own createPartsWeapon already
// follows for a missing weapon part.
export function createProjectileModelInstance(scene, name, parent){
    const { projectileModels } = getSocketContainers()
    const template = projectileModels?.[name]
    if(!template){
        console.warn(`[createProjectileModel] no loaded template for "${name}" - was it registered in PROJECTILE_MODEL_PATHS and awaited by setStartingContainers?`)
        return null
    }
    const inst = template.clone(`${name}_projectile_${Date.now()}`)
    inst.isVisible = true
    inst.parent = parent
    inst.position = Vector3.Zero()
    return inst
}
