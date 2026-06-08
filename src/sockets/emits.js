import { Vector3 } from "@babylonjs/core";
import { getSocket } from "./joinsocket";
import { getIsSocketOn, getPlayersOnScene } from "./worldsocket";
import { getCharState, getTotalAtkSpd } from "../charactersystem/characterstate";
import { getPlayerCoord } from "../charactersystem/createcharacter";
import { getAttackInfo } from "../charactersystem/attackingSystem";


let emitMyLocInterval = null
const log = console.log
export function emitMove(){
    const charState = getCharState()
    if(!charState) return console.log("charstate fail")
    const socket = getSocket()
    if(!socket) return console.log("socket fail")
    const { pos, dirTarg, mode} = getPlayerCoord(charState.owner)

    socket.emit("emitmove", {
        ownerId: charState.owner,
        pos,
        dirTarg,
        mode
    })
}

export function emitStop(){
    const charState = getCharState()
    if(!charState) return
    const socket = getSocket()
    if(!socket) return
    const { pos, dirTarg, mode} = getPlayerCoord(charState.owner)

    socket.emit("emitStop", {
        ownerId: charState.owner,
        pos,
        dirTarg,
        mode
    })
}
export function emitMyLoc(newMode){
    const charState = getCharState()
     if(!charState) return
    const socket = getSocket()
    if(!socket) return
    const { pos, dirTarg, mode} = getPlayerCoord(charState.owner)

    socket.emit("emitLoc", {
        ownerId: charState.owner,
        pos,
        dirTarg,
        mode: newMode ? newMode : mode
    })
}
export function emitDied() {
    if (!getIsSocketOn()) return log("socket not available")
    const socket = getSocket()
    if(!socket) return console.log("no socket")
    const characterState = getCharState()
    socket.emit("will-die", { ownerId: characterState.owner, currentPlaceId: characterState.currentPlace.placeId })
    // playerz = []// restart ka ulet kase pag bumalik ka sa pinangalingan mo di na gagawin yung character kase makikita ulet sa playerz array
    // npcz = []
    // enemiez = []
}
// Attack Actions
export function emitAttack() {
    if (!getIsSocketOn()) return log("socket not available")
    const socket = getSocket()
    if(!socket) return console.log("no socket")
    // const enemyAccuracy = enemy.det.stats.accuracy
    // if (dmgDetails.accuracy < Math.random() * enemyAccuracy * 10) isMissed = true

    socket.emit("emitPlayerAttack", getAttackInfo())
}

// ITEM EQUIP
export function emitEquipItem(itemDet, isHiding) {
    log("emit equip")
    const charState = getCharState()
    console.log(charState)
    const socket = getSocket()
    socket.emit("emitEquipItem", {
        ownerId: charState.owner,
        itemName: itemDet.name,
        itemType: itemDet.itemType,
        itemModelStyle: itemDet.itemModelStyle ? itemDet.itemModelStyle : false,
        currentPlaceId: charState.currentPlace.placeId,
        isHide: isHiding,
        parts: itemDet.parts ? itemDet.parts : null
    })
}

export function runEmitMyLocInterval(){
    clearInterval(emitMyLocInterval)
    emitMyLocInterval = setInterval(() => {
        const player = getPlayersOnScene().find(pl => pl.owner === getCharState().owner)
        if(!player) return clearInterval(emitMyLocInterval)
        // emitMyLoc()
    }, 10000)
}

// MONSTERS
export function emitEnemyIsHit(data){
    const charState = getCharState()
    if(!charState) return
    const socket = getSocket()
    if(!socket) return
    socket.emit("enemyIsHit", data)
}