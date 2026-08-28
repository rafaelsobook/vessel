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
// createEnemy.js's atkCollider hit handler - faceForward(inputMovement.js)
// only turns the LOCAL player's own body (a smooth multi-frame slerp, see
// its own comment), nothing else in this game ever tells the server about
// it, so every OTHER client just kept rendering whatever facing this player
// had BEFORE the swing turned them - multiplayer sync now, matching the
// "same" info every other move/mode change already broadcasts.
//
// Deliberately does NOT read dirTarg back from getPlayerCoord (like
// emitMove/emitStop/emitMyLoc all do) - that recomputes dirTarg from the
// body's CURRENT facing, which at the instant faceForward is called hasn't
// actually turned yet (the slerp plays out over the next several frames).
// targetPos is passed in directly instead - the exact point being faced,
// known immediately, no need to wait for the animation to catch up.
// Reuses "emitLoc" (same event emitMyLoc already sends) - tcp/index.ts's
// handler for it just stores pos/dirTarg/mode verbatim and rebroadcasts,
// no assumption about movement state, unlike emitmove/emitStop which also
// flip player._moving.
export function emitFaceTarget(targetPos){
    const charState = getCharState()
    if(!charState) return
    const socket = getSocket()
    if(!socket) return
    const { pos, mode } = getPlayerCoord(charState.owner)
    if(!pos) return

    // dirTarg.y forced to the CASTER's own y, not targetPos.y - faceForward
    // itself only ever rotates around the Up axis (Math.atan2 on x/z,
    // vertical difference never enters the angle at all), so an enemy
    // standing well above/below the player shouldn't pitch anyone's body up
    // or down to "face" them. worldsocket.js's "emitLoc" receive handler
    // uses dirTarg.y as-is with no flattening of its own (unlike its
    // "emitStop" handler, which flattens to the RECEIVING player's own y) -
    // has to be done here instead, or a tall/short enemy would visibly tilt
    // every other client's view of this player.
    socket.emit("emitLoc", {
        ownerId: charState.owner,
        pos,
        dirTarg: { x: targetPos.x, y: pos.y, z: targetPos.z },
        mode,
        placeId: charState.currentPlace.placeId,
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
// r-click hold-to-block (inputMovement.js's activateMouseControls) - relayed
// through tcp/index.ts the same way emitMode is (store on the Tplayers
// entry, rebroadcast to everyone) so every other client's own worldsocket.js
// "emitted-weaponblock" handler can mirror this player's stance, both for
// its own createcharacter.js-rig weaponBlocking flag (duelSystem.js-style
// damage gating, once the real-enemy/other-player damage paths check it)
// and to play the same "weaponblock" pose loop (animation.js's
// playBlockingLoop) everyone else sees.
export function emitWeaponBlock(isBlocking) {
    const charState = getCharState()
    if (!charState) return
    if (!getIsSocketOn()) return
    const socket = getSocket()
    if(!socket) return
    socket.emit("emitWeaponBlock", {
        ownerId: charState.owner,
        isBlocking,
        currentPlaceId: charState.currentPlace.placeId,
    })
}

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
        weaponType: itemDet.weaponType,
        hairVisible: itemDet.hairVisible
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
// tcp/index.ts's registerPlayerAsEnemy handler - sets enem._targetId/
// _dirTarg so the enemy actually turns to fight back. createEnemy.js's own
// atkDetection trigger already emits this same "registerPlayerAsEnemy"
// event directly (melee proximity - a player's body physically entering
// the enemy's trigger zone), this is the shared/exported twin of that for
// skillEffects.js's ranged/AOE skill hits, which land with no proximity
// trigger involved at all. Server-side _targetId is sticky (only ever set
// once, see that handler's own early-return), so calling this again for an
// enemy that's already aggroed on someone else is a harmless no-op.
export function emitRegisterPlayerAsEnemy(data){
    if(!getIsSocketOn()) return
    const socket = getSocket()
    if(!socket) return
    socket.emit("registerPlayerAsEnemy", data)
}
export function emitEnemyYCorrection(enemyId, y, x, z){
    if (!getIsSocketOn()) return
    const socket = getSocket()
    if(!socket) return
    // x/z included so receivers can tell if this correction is stale by the time
    // it arrives (the enemy may have kept moving) instead of blindly applying it
    socket.emit("correctEnemyY", { _id: enemyId, y, x, z })
}