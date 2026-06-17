import { Vector3, Quaternion } from '@babylonjs/core'
import { createMesh } from '../creations/creationTools.js'
import { loadAvatarContainer } from '../tools/loadmodel.js'
import { createTextMesh } from '../gui/textmesh.js'
import { playAnim } from '../tools/animation.js'

const NPC_HEIGHT  = 1.5
const NPC_WIDTH   = 0.5

let npcBodyContainer = null

async function getNpcContainer(scene, glbPath) {
    if (!npcBodyContainer || npcBodyContainer.scene !== scene) {
        npcBodyContainer = await loadAvatarContainer(glbPath, scene)
    }
    return npcBodyContainer
}

export async function createNpc(scene, det) {
    const x = det.x ?? 0
    const y = det.y ?? 0
    const z = det.z ?? 0
    const yPos = y + NPC_HEIGHT / 2 + 0.05

    const body = createMesh(
        scene,
        `npc.${det._id}`,
        { size: NPC_WIDTH, height: NPC_HEIGHT },
        { x, y: yPos, z },
        1, false, false
    )
    body.isPickable = false

    const nameMesh = createTextMesh(scene, body, det.name, "white", {x:0,y: NPC_HEIGHT,z:0}, 30);
    

    if (det._dirTarg) {
        const dx = det._dirTarg.x - x
        const dz = det._dirTarg.z - z
        if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
            body.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), Math.atan2(dx, dz))
        }
    }
    if(!det.glbPath) return null
    const container = await getNpcContainer(scene, det.glbPath)
    const entries = container.instantiateModelsToScene()
    entries.animationGroups.map(ani => ani.name = ani.name.split(' ')[2])

    const root = entries.rootNodes[0]
    root.parent = body
    root.position.y -= NPC_HEIGHT / 2
    root.position.y -= 0.04
    root.rotationQuaternion = Quaternion.Identity()

    root.getChildMeshes().forEach(mesh => {
        if (!mesh.material) return
        const mat = mesh.material
        if (mat.getClassName() === 'PBRMaterial') {
            mat.environmentIntensity = 0.3
            mat.directIntensity     = 1
            mat.emissiveIntensity   = 0
        }
    })

    playAnim(entries.animationGroups, "idle", true)
    return {
        det,
        body,
        currentPlaceId: det.currentPlaceId,
        mode: det.mode ?? 'idle',
        anims: entries.animationGroups,
        nameMesh
    }
}
