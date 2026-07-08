/** 
 * @typedef {{
 *  placeId: string,
 *  name: string,
 *  areaType: string
 * }} CurrentPlaceShort
 */

/**
 * @typedef {{
 *  boots: string,
 *  cloth: string,
 *  currentPlace: CurrentPlaceShort,
 *  hair: string,
 *  lvl: number,
 *  name: string,
 *  owner: string,
 *  pants: string,
 *  socketId: string
 * }} TcpCharDet
 */

/**
 * @param {TcpCharDet} tcpCharDet
 */
import { sceneCleanupReady } from "../components/cleanup.js"
import { attachControllerToThisCharacter } from "../controllers/inputMovement.js"
import { getSceneDet } from "../main/main.js"
import { findPlaceMetaData } from "../states/placestates.js"
import { attachCam } from "../tools/camera.js"
import { getSpawnPos } from "../tools/position.js"
import { createCharacter } from "./createcharacter.js"
import { ActionManager, MeshBuilder, Vector3 } from "@babylonjs/core"
import { getCharState, setCharStateMode } from "./characterstate"
import { getPlayersOnScene } from "../sockets/worldsocket.js"


export function createMyCharacter(charState, scene, allsounds){

    // const tcpCharPlaceMD = findPlaceMetaData(tcpCharDet.currentPlace.placeId)

    // let spawnPos = getSpawnPos(tcpCharPlaceMD)
    let spawnPos = { x: charState.x, y: charState.y, z: charState.z}

    const player = createCharacter(scene, spawnPos, {...charState,
        // mode would be by default always Idle if newly joined
    // addiditonal infos because our tcpCharDet does not come from tcp(in tcp we put this additional info) 
    _moving: false,
    _minning: false, 
    }, true)
    if(!player) return
    attachCam(player.camParent)

    const controls = attachControllerToThisCharacter(player.aggregate, scene, allsounds)

    const atkCollider = createAttackColliderForEnemy(scene, player.body)

    sceneCleanupReady(scene, controls)

    setCharStateMode(charState.mode)

    return player
}

function createAttackColliderForEnemy(scene, body){
    const atkCollider = MeshBuilder.CreateBox("atkCollider", {width: 2, height: 0.25, depth: 1}, scene)
    atkCollider.isPickable = false
    // atkCollider.parent = body
    atkCollider.position = new Vector3(0, 0, 2.5)
    atkCollider.isVisible = false
    atkCollider.actionManager = new ActionManager(scene)
    scene.registerBeforeRender(() => {
        if(!body) return
        atkCollider.position.y += 10 * (scene.getEngine().getDeltaTime() / 1000)
    })
    return atkCollider
}
export function positionAtkCollider(pos, dirTarg){
    const charState = getCharState()
    if(!charState) return 
    const player = getPlayersOnScene().find(pl => pl.owner === charState.owner)
    if(!player) return
    const atkCollider = getSceneDet().scene.getMeshByName(`atkCollider`)
    if(!atkCollider) return

    // Get forward direction from player's world matrix
    const forward = new Vector3(0, 0, 1)
    const worldForward = Vector3.TransformNormal(
        forward,
        player.body.getWorldMatrix()
    )
    worldForward.normalize()

    // Offset multiplier — how far in front of the body
    const reach = pos?.reach ?? 1.0       // forward distance (punch ~0.8, kick ~1.0, weapon ~1.5)
    // const heightOffset = pos?.height ?? 0  // 0 = same level, negative = low kick, positive = high punch

    // Final position: player pos + forward * reach + Y offset
    const spawnPos = player.body.absolutePosition
        .add(worldForward.scale(reach))

    atkCollider.position.copyFrom(spawnPos)
    
    // Optionally match player's Y rotation so collider faces same way
    if(player.body.rotationQuaternion){
        atkCollider.rotationQuaternion = player.body.rotationQuaternion.clone()
    }
    atkCollider.position.y = -2
}