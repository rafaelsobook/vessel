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

export function createMyCharacter(tcpCharDet){
    const sceneDet = getSceneDet()

    const tcpCharPlaceMD = findPlaceMetaData(tcpCharDet.currentPlace.placeId)
    console.log(`character is in place: ${tcpCharPlaceMD.placeId}`)

    const spawnPos = getSpawnPos(tcpCharPlaceMD)

    const player = createCharacter(sceneDet.scene, spawnPos, null, tcpCharDet, true)
    attachCam(player.camParent)
    const controls = attachControllerToThisCharacter(player.aggregate)

    sceneCleanupReady(sceneDet.scene, controls)
    return player
}