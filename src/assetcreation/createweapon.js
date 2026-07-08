import { MeshBuilder, TransformNode, Vector3 } from "@babylonjs/core"
import { getSocketContainers } from "../sockets/worldsocket"
import { createGlowingMat } from "../tools/materials"
import { createBladeMat, createGuardMat, createHandleMat, createPommelMat } from "../tools/weaponmat"
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

function getPartMat(scene, part, rarity, instanceName) {
    if (partMatCacheScene !== scene) {
        partMatCache.clear()
        partMatCacheScene = scene
    }
    const key = `${part}_${rarity}`
    let baseMat = partMatCache.get(key)
    if (!baseMat) {
        baseMat = partMatFns[part](scene, rarity)
        partMatCache.set(key, baseMat)
    }
    return baseMat.clone(`${key}_${instanceName}`)
}

export function createWeapon(scene, weaponType = "sword", pos = {x:0,y:0,z:0}, parent, options = {
    bladeRarity: "rare2",
    guardRarity: "rare1",
    handleRarity: "common1",
    pommelRarity: "common1"
}, glowingColor) {
    // const scene = getSceneDet().scene
    
    const { allweapons } = getSocketContainers()
    if (!allweapons) return console.warn("allweapons not yet imported")

    const { bladeRarity, guardRarity, handleRarity, pommelRarity } = options

    const partDefs = [
        { part: "blade",  rarity: bladeRarity  },
        { part: "guard",  rarity: guardRarity  },
        { part: "handle", rarity: handleRarity },
        { part: "pommel", rarity: pommelRarity },
    ]

    const root = new TransformNode(`weapon_${weaponType}_${Date.now()}`,scene)
    if (parent) {
        root.parent = parent
    } 
    root.position = new Vector3(pos.x, pos.y,pos.z)
    root.isVisible = true
    let mat = null
    if(glowingColor){
        mat = createGlowingMat(scene, glowingColor)
    }

    for (const { part, rarity } of partDefs) {
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
            inst.material = getPartMat(scene, part, rarity, inst.name)
        }
    }

    return root
}
