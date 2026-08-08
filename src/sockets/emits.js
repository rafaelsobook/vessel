import { Vector3 } from "@babylonjs/core";
import { getSocket } from "./joinsocket";
import { getIsSocketOn, getPlayersOnScene } from "./worldsocket";
import { getCharState, getTotalAtkSpd } from "../charactersystem/characterstate";
import { getPlayerCoord } from "../charactersystem/createcharacter";
import { getAttackInfo } from "../charactersystem/attackingSystem";


let emitMyLocInterval = null
export function emitMove(){
    const charState = getCharState()
    if(!charState) return
    const socket = getSocket()
    if(!socket) return
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
export function emitMode(newMode, weaponName){
    const charState = getCharState()
     if(!charState) return
    const socket = getSocket()
    if(!socket) return
    const { pos, dirTarg, mode} = getPlayerCoord(charState.owner)
    
    socket.emit("emitMode", {
        ownerId: charState.owner,
        mode: newMode ? newMode : mode,
        placeId: charState.currentPlace.placeId, 
        weaponName: weaponName ? weaponName : undefined
    })
}
export function emitMyLoc(newMode, weaponName){
    const charState = getCharState()
     if(!charState) return
    const socket = getSocket()
    if(!socket) return
    const { pos, dirTarg, mode} = getPlayerCoord(charState.owner)
    
    socket.emit("emitLoc", {
        ownerId: charState.owner,
        pos,
        dirTarg,
        mode: newMode ? newMode : mode,
        placeId: charState.currentPlace.placeId, 
        weaponName: weaponName ? weaponName : undefined
    })
}
export function emitDied() {
    if (!getIsSocketOn()) return
    const socket = getSocket()
    if(!socket) return
    const characterState = getCharState()
    socket.emit("will-die", { ownerId: characterState.owner, currentPlaceId: characterState.currentPlace.placeId })
    // playerz = []// restart ka ulet kase pag bumalik ka sa pinangalingan mo di na gagawin yung character kase makikita ulet sa playerz array
    // npcz = []
    // enemiez = []
}
// Attack Actions
export function emitSpawnCircle(pos, element){
    const socket = getSocket()
    const placeId = getCharState().currentPlace.placeId
    if(getIsSocketOn()){
        socket.emit("spawncirc", {pos, placeId, element})
    }
}
export function emitAttack(attackInfo,attackAnimName) {
    if (!getIsSocketOn()) return
    const socket = getSocket()
    if(!socket) return
    // const enemyAccuracy = enemy.det.stats.accuracy
    // if (dmgDetails.accuracy < Math.random() * enemyAccuracy * 10) isMissed = true

    socket.emit("emitPlayerAttack", { ...attackInfo, animName: attackAnimName })
}

// ITEM EQUIP
export function emitEquipItem(itemDet, isHiding) {

    const charState = getCharState()
    const socket = getSocket()
    socket.emit("emitEquipItem", {
        ownerId: charState.owner,
        itemName: itemDet.name,
        itemModelName: itemDet.modelName,
        itemType: itemDet.itemType,
        itemModelStyle: itemDet.itemModelStyle ? itemDet.itemModelStyle : false,
        currentPlaceId: charState.currentPlace.placeId,
        isHide: isHiding,
        parts: itemDet.parts ? itemDet.parts : null,
        metalColor: itemDet.metalColor,
        weaponType: itemDet.weaponType
    })
}

// GUILD BOARD QUESTS
export function emitClaimQuest(questId) {
    if (!getIsSocketOn()) return false
    const socket = getSocket()
    if(!socket) return false
    const charState = getCharState()
    if(!charState) return false
    socket.emit("emitClaimQuest", {
        ownerId: charState.owner,
        questId,
        currentPlaceId: charState.currentPlace.placeId
    })
    return true
}
export function emitCancelQuest(questId) {
    if (!getIsSocketOn()) return false
    const socket = getSocket()
    if(!socket) return false
    const charState = getCharState()
    if(!charState) return false
    socket.emit("emitCancelQuest", {
        ownerId: charState.owner,
        questId,
        currentPlaceId: charState.currentPlace.placeId
    })
    return true
}
export function emitCompleteQuest(questId) {
    if (!getIsSocketOn()) return false
    const socket = getSocket()
    if(!socket) return false
    const charState = getCharState()
    if(!charState) return false
    socket.emit("emitCompleteQuest", {
        ownerId: charState.owner,
        questId,
        currentPlaceId: charState.currentPlace.placeId
    })
    return true
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
// skill.enemyBind (see skillsData.js's radiantjudgmentSkill, skillEffects.js's
// hit handler) - bindChance is rolled client-side before this is ever called,
// same as every other hit-resolution decision in this game (server is only
// authoritative for hp/removal, never for "did this even land"). tcp's
// enemyBind handler is the actual _disabled timer authority; see its comment.
export function emitEnemyBind(data){
    if(!getIsSocketOn()) return
    const socket = getSocket()
    if(!socket) return
    socket.emit("enemyBind", data)
}
// any dark-element skill's hit (see skillsData.js's header comment on this,
// skillEffects.js's hit handler) - unconditional, no chance roll (dark magic
// always curses on a landed hit, unlike enemyBind's bindChance). tcp's
// enemyCurse handler is what actually flips the enemy's persistent _cursed
// flag; see worldsocket.js's "enemy-attacked" handler for where a cursed
// enemy's own attack damage gets redirected back onto itself.
export function emitEnemyCurse(data){
    if(!getIsSocketOn()) return
    const socket = getSocket()
    if(!socket) return
    socket.emit("enemyCurse", data)
}
export function emitEnemyYCorrection(enemyId, y, x, z){
    if (!getIsSocketOn()) return
    const socket = getSocket()
    if(!socket) return
    // x/z included so receivers can tell if this correction is stale by the time
    // it arrives (the enemy may have kept moving) instead of blindly applying it
    socket.emit("correctEnemyY", { _id: enemyId, y, x, z })
}