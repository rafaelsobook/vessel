import { MeshBuilder, TransformNode, Vector3 } from "@babylonjs/core"
import { getSocketContainers } from "../sockets/worldsocket"
import { createGlowingMat } from "../tools/materials"
import { createBladeMat, createGuardMat, createHandleMat, createPommelMat } from "../tools/weaponmat"
import { createMetalMat } from "../tools/metalmat"
import { addGlow } from "../tools/glow"
import { getSceneDet } from "../main/main"

const partMatFns = {
    blade: createBladeMat,
    guard: createGuardMat,
    handle: createHandleMat,
    pommel: createPommelMat,
}

let partMatCacheScene = null
const partMatCache = new Map()

function getPartMat(scene, part, rarity, materialName, instanceName) {
    if (partMatCacheScene !== scene) {
        partMatCache.clear()
        partMatCacheScene = scene
    }
    const key = `${part}_${rarity}_${materialName}`
    let baseMat = partMatCache.get(key)
    if (!baseMat) {
        baseMat = partMatFns[part](scene, rarity, materialName)
        partMatCache.set(key, baseMat)
    }
    return baseMat.clone(`${key}_${instanceName}`)
}

// which weaponTypes are built from separate part meshes (blade/guard/
// handle/pommel) isn't hardcoded to "sword" - it's whatever allweapons
// (allswords.glb, see loadMeshOnlyParts) actually has a "<weaponType>_..."
// entry for. Sword has 4 tiers per part; spear has just one (spear_blade_
// rare1 etc, see swordsdata.js's stormpiercer). Any weaponType with NO
// matching part meshes falls back to a single mesh instead - same pattern
// as createHelmet/createPauldron in createcharacter.js - looked up from
// containers.weapons by "<weaponType>.<itemName>".
function hasPartMeshes(weaponType){
    const { allweapons } = getSocketContainers()
    if(!allweapons) return false
    return Object.keys(allweapons).some(key => key.startsWith(`${weaponType}_`))
}

function createPartsWeapon(scene, weaponType, root, options, glowingColor) {
    const { allweapons } = getSocketContainers()
    if (!allweapons) return console.warn("allweapons not yet imported")

    const {
        bladeRarity = "rare2", guardRarity = "rare1", handleRarity = "common1", pommelRarity = "common1",
        // defaults match the old hardcoded per-part looks, so weapon data
        // that predates *Color (npcDetails.js, skills.js) renders unchanged
        bladeColor = "steel", guardColor = "bronze", handleColor = "leather", pommelColor = "gold",
    } = options

    const partDefs = [
        { part: "blade",  rarity: bladeRarity,  materialName: bladeColor  },
        { part: "guard",  rarity: guardRarity,  materialName: guardColor  },
        { part: "handle", rarity: handleRarity, materialName: handleColor },
        { part: "pommel", rarity: pommelRarity, materialName: pommelColor },
    ]

    let mat = null
    if(glowingColor){
        mat = createGlowingMat(scene, glowingColor)
    }

    for (const { part, rarity, materialName } of partDefs) {
        const key = `${weaponType}_${part}_${rarity}`
        const template = allweapons[key]
        if (!template) {
            console.warn(`createWeapon: missing part "${key}"`)
            continue
        }
        const inst = template.clone(`${key}_${root.name}`)
        inst.addRotation(Math.PI/2,0,0)
        inst.isVisible = true
        inst.parent = root
        inst.position = Vector3.Zero()
        if(glowingColor && mat !== null){
            inst.material = mat
            addGlow(scene, inst, 0.4)
        } else {
            inst.material = getPartMat(scene, part, rarity, materialName, inst.name)
        }
    }
}

function createSingleMeshWeapon(scene, weaponType, itemName, root, options, glowingColor) {
    const { weapons } = getSocketContainers()
    if (!weapons) return console.warn("weapons not yet imported")
    if (!itemName) return console.warn(`createWeapon: single-mesh weaponType "${weaponType}" needs an itemName to look up its mesh`)

    // same dot-naming/lookup convention as createHelmet/createPauldron in
    // createcharacter.js - "<weaponType>.<itemName>", e.g. "spear.stormpiercer"
    const template = weapons.find(msh => msh.name.split(".")[1] === itemName)
    if (!template) return console.warn(`createWeapon: missing single-mesh weapon "${weaponType}.${itemName}"`)

    const inst = template.clone(`${weaponType}.${itemName}_${root.name}`)
    // matches the per-part rotation fix below - unverified until an actual
    // single-mesh weapon glb exists to test against, may need adjusting
    inst.addRotation(Math.PI/2,0,0)
    inst.isVisible = true
    inst.parent = root
    inst.position = Vector3.Zero()

    if(glowingColor){
        inst.material = createGlowingMat(scene, glowingColor)
        addGlow(scene, inst, 0.4)
    } else {
        inst.material = createMetalMat(scene, options.metalColor)
    }
}

export function createWeapon(scene, weaponType = "sword", pos = {x:0,y:0,z:0}, parent, itemName, options = {
    bladeRarity: "rare2",
    guardRarity: "rare1",
    handleRarity: "common1",
    pommelRarity: "common1"
}, glowingColor) {
    const root = new TransformNode(`weapon_${weaponType}_${Date.now()}`,scene)
    if (parent) {
        root.parent = parent
    }
    root.position = new Vector3(pos.x, pos.y,pos.z)
    root.isVisible = true

    if (hasPartMeshes(weaponType)) {
        createPartsWeapon(scene, weaponType, root, options, glowingColor)
    } else {
        createSingleMeshWeapon(scene, weaponType, itemName, root, options, glowingColor)
    }

    return root
}
