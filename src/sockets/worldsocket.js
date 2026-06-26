import { deductHp, getCharState } from "../charactersystem/characterstate"
import { createCharacter } from "../charactersystem/createcharacter"
import { getGameStatus, getSceneDet } from "../main/main"
import { findPlaceMetaData } from "../states/placestates"
import { attachCam } from "../tools/camera"
import { getSpawnPos } from "../tools/position"
import { Vector3 } from "@babylonjs/core"
import { playAnim} from "../tools/animation"
import { removeRenderObservable, addRenderObservable } from "./renderer"
import { stopAnim } from "../tools/tools"
import { poppingTextMesh } from "../tools/GUITools"
import { attack } from "../charactersystem/attackingSystem"
import createEnemy, { enemyIsHit } from "../enemies/createEnemy"
import { randBetween } from "../tools/random"
import { emitDied } from "./emits"
// From TCPs
let allPlayersFromTCP = []
let allEnemiez = []

// In Client
let playersOnScene = []
let enemiez = []
let npcz = []
let projectilesOnScene = []


let scene;
let containers = {
    hairs: null,
    animeBody: null,
    allweapons: null,
    helmets: null,
    armors: null,
    belts: null,
    cloaks: null,

    goblinRoot: null,
    monolithRoot: null,
    slimeRoot: null
}



let isSocketOn = false
let sceneRendererObserver = null
// should only run once per scene
export function playSocketScene(_scene) {
    if (scene) removeRenderObservable(scene)
    scene = _scene

    addRenderObservable(scene)
}
export function resetArray(){
    playersOnScene = []
    enemiez = []
    npcz = []
    projectilesOnScene = []
    containers = {
        hairs: null,
        animeBody: null,
        allweapons: null,
        helmets: null,
        armors: null,
        belts: null,
        cloaks: null,

        goblinRoot: null,
        monolithRoot: null,
        slimeRoot: null
    }
}
export function setSocketContainers(newContainers){
    containers = newContainers
}
export function getSocketContainers(){ 
    return containers
}
export function getPlayersOnScene(){
    return playersOnScene
}
export function getEnemiesOnScene(){
    return enemiez
}
export function removeEnemyOnScene(enemyId){
    enemiez = enemiez.filter(enmy => enmy._id !== enemyId)
}
export function setSocketOn(_isOn){
    isSocketOn = _isOn
}
export function getIsSocketOn(){
    return isSocketOn
}

export function pushProjectile(newProjectile){
    const { body, itemId, targetDirection, spd, placeId } = newProjectile
    projectilesOnScene.push(newProjectile)
}
export function removeProjectile(itemId){
    const theProjectile = projectilesOnScene.find(proj => proj.itemId === itemId)
    if(!theProjectile) return
    theProjectile.body.dispose()
    projectilesOnScene = projectilesOnScene.filter(proj => proj.itemId !== itemId)
}
export function getProjectilesOnScene(){
    return projectilesOnScene
}
export function activateOnSocketListeners(socket){

    socket.on("userJoined", allDataFromServer => {
        if (!isSocketOn) return
        const { newPlayerName, players, placesMD, tcpEnemies } = allDataFromServer
        const characterState = getCharState()
        const gameStat = getGameStatus()
        if (gameStat === "loading") return

        if (socket === undefined) return console.warn("socket UNDEFINED !")

        allPlayersFromTCP = players
        allEnemiez = tcpEnemies

        if (!characterState) return

        if (gameStat === "running") {
            reCreateMeshesInScene()
        }
    })
    // equiping
    socket.on("equiped-item", data => {
        if (!isSocketOn) return
        const charState = getCharState()
        const {ownerId, itemName, itemModelStyle,  itemType, currentPlaceId} = data
        if (!charState) return
        if (charState.currentPlace.placeId !== currentPlaceId) return
        // if(ownerId === charState.owner) return console.log("this is me return")
        const theEquipingPlayer = playersOnScene.find(pl => pl.owner === ownerId)
        if (!theEquipingPlayer) return

        if (itemType === "boots") theEquipingPlayer.equipBoots(itemName)
        if(itemType === "weapon") theEquipingPlayer.equipSword(itemName, true, data.parts)

        // if (itemType === "weapon") theEquipingPlayer.equipSword(swordRoot, itemName, theEquipingPlayer._attacking, data.isHide)
        // if (itemType === "helmet") theEquipingPlayer.equipHelmet(helmRoot, itemName)
            
        
        // if (itemType === "armor") theEquipingPlayer.equipArmor(armorRoot, itemName)
        // if (itemType === "belt") theEquipingPlayer.equipBelt(itemModelStyle, itemName)
        // if (itemType === "cloak") theEquipingPlayer.equipCloak(itemModelStyle, itemName)
    })
    socket.on("unequiped-item", data => {
        if (!isSocketOn) return
        const charState = getCharState()
        const {ownerId, itemType, currentPlaceId} = data
        if (!charState) return
        if (charState.currentPlace.placeId !== currentPlaceId) return
        // if(ownerId === charState.owner) return console.log("this is me return")
        const theEquipingPlayer = playersOnScene.find(pl => pl.owner === ownerId)
        if (!theEquipingPlayer) return

        theEquipingPlayer.unEquip(itemType)
    })
    // ACTIONS
    // PLAYER ATTACK RELATED
    socket.on("player-attacked", data => {
        if (!isSocketOn) return
        // const {
        //     owner,
        //     pos,
        //     dirTarg,
        //     animName,
        //     dmgDetails,
        //     hasWeapon,
        //     isMissed,
        //     weaponType,
        //     currentPlaceId,
        //     atkSpd
        // } = data
        attack(data)
        // let soundToPlay
        // switch (data.weaponType) {
        //     case "fist":
        //         // playSound(playerAttacked.whooshS, .9,.3)
        //         soundToPlay = playerAttacked.punchedS
        //         break
        //     case "staff":
        //         playSound(playerAttacked.whooshS, .9, .3)
        //         soundToPlay = playerAttacked.staffWhenHitS
        //         break
        //     case "sword":
        //         playSound(playerAttacked.whooshS, .9, .3)
        //         soundToPlay = playerAttacked.swordWhenHitS
        //         break
        //     case "axe":
        //         playSound(playerAttacked.whooshS, .9, .3)
        //         soundToPlay = playerAttacked.swordWhenHitS
        //         break
        // }

        // const enemPos = enemy.body.position
        // playerAttacked.body.lookAt(enemy.body.position, 0,0,0)

    })


    // ENEMY RELATED
    socket.on("enemy-attacked", data => {
        const { currentPlaceId, _id, pos, targetId, dmg, attackAnimName, effects, atkSpd } = data
        if (!isSocketOn) return
        const charState = getCharState()
        if (getGameStatus() === "loading") return
        if (currentPlaceId !== charState.currentPlace.placeId) return
        let theEnemyToAttack = enemiez.find(enem => enem._id === data._id)
        if (!theEnemyToAttack) return
        const victimPlayer = playersOnScene.find(victim => victim.owner === targetId)
        if (!victimPlayer) return

        theEnemyToAttack._isMoving = false
        theEnemyToAttack._attacking = true
        theEnemyToAttack._targetId = data.targetId
        theEnemyToAttack.body.position.x = data.pos.x
        theEnemyToAttack.body.position.z = data.pos.z
        const victimPos = victimPlayer.body.position
        theEnemyToAttack.body.lookAt(new Vector3(victimPos.x, theEnemyToAttack.body.position.y, victimPos.z), 0,0,0)
        
        // stopAnim(theEnemyToAttack.anims, data.attackAnimName, true)
        // enemy animation
        playAnim(theEnemyToAttack.anims, data.attackAnimName)
        // player hit animation
        playAnim(victimPlayer.anims, "hit1")
        theEnemyToAttack.attackSound.play()
        // playAnim(theEnemyToAttack.anims, data.attackAnimName, false, ()=>{
        //     theEnemyToAttack = enemiez.find(enem => enem._id === data._id)
        //     if(!theEnemyToAttack) return
        //     if(theEnemyToAttack._isMoving) return
        //     playAnim(theEnemyToAttack.anims, "0Idle", true)
        // })
        if (victimPlayer.owner === charState.owner) {
            setTimeout( async () => {
                // const vPos = victimPlayer.body.position;
                // const enemPos = theEnemyToAttack.body.position;

                const heroDistance = Vector3.Distance(victimPlayer.body.position, theEnemyToAttack.body.position)
                if (heroDistance <= theEnemyToAttack.det.maxDistance) {
                    const enemyAccuracy = theEnemyToAttack.det.stats.accuracy
                    // if (charState.stats.accuracy >= Math.random() * enemyAccuracy * 15) return popStatusEffect('missed', "#f5f5f5")
                    // camShake(getSceneDet().scene, getSceneDet().scene.activeCamera, .01, true)
                    // victimPlayer.punchedS.play()
                    const isDead = await deductHp(data.dmg, data.effects)
                    if (isDead) emitDied()
                }
            }, data.atkSpd / 5)
        }
    })
    socket.on("enemy-attacked-range", data => {
        const {pos, _id, targetPos, dmg, attackAnimName, effects, rangeAtkDetails} = data
        const meshModelName = rangeAtkDetails.modelName
        const mesh = scene.getMeshByName(meshModelName)

        const dt = scene.getEngine().getDeltaTime() / 1000
        const spd = 20
        const forwardV = new Vector3(0,0,spd*dt)

        const caster = enemiez.find(enem => enem._id === _id)

        if(mesh && caster){
            lookAt(caster.body, Vector3, targetPos)
            playAnim(caster.anims, attackAnimName)
            const rangeMeshClone = mesh.clone("")
            rangeMeshClone.position = new Vector3(pos.x, pos.y,pos.z)
            rangeMeshClone.lookAt(new Vector3(targetPos.x, targetPos.y, targetPos.z),0,0,0)
            const myCharacter = playersOnScene.find(pl => pl.owner === getCharState().owner)
            rangeMeshClone.actionManager = new ActionManager(scene)
            if(myCharacter){
                regActionEnter(rangeMeshClone, myCharacter.body, () => {
                    // getAllSounds().struckS.play()
                    scene.getSoundByName(rangeAtkDetails.soundWhenHit).play()
                    camShake(getSceneDet().scene, getSceneDet().scene.activeCamera, .01, true)
                    const isDead = deductHp(dmg, effects)
                    if (isDead) emitDied()
                })
            }
            
            let renderForRangeAtk = scene.onBeforeRenderObservable.add(() => {
                rangeMeshClone.locallyTranslate(forwardV)
            })
            setTimeout(() => {
                scene.onBeforeRenderObservable.remove(renderForRangeAtk)
                disposeMesh(rangeMeshClone)
            }, 3000)
        }
    })
    socket.on('enemy-changedtarget', data => {
        if (!isSocketOn) return
        const enemy = enemiez.find(enem => enem._id === data._id)
        if (!enemy) return

        enemy._targetId = data.newTargetId
    })
    socket.on('registered-playerAsEnemy', allEnemyDetails => {
        allEnemiez = allEnemyDetails
        enemiez.forEach(enem => {
            allEnemiez.forEach(enemDetail => {
                if (enemDetail._id === enem._id) {
                    enem._targetId = enemDetail._targetId
                    enem._dirTarg = enemDetail._dirTarg
                    // enem._isMoving = enemDetail._isMoving
                    enem._attacking = enemDetail._attacking
                }
            })
        })
    })
    socket.on("enemy-is-hit", data => {
        const { targetId, dmg, currentPlaceId, hp, maxHp } = data
        if (!isSocketOn) return
        const charState = getCharState()
        if (getGameStatus() === "loading") return
        if (currentPlaceId !== charState.currentPlace.placeId) return
        let theEnemyToHit = enemiez.find(enem => enem._id === targetId)
        if (!theEnemyToHit) return

        enemyIsHit(data)
    })
    socket.on("enemy-chasing", data => {
        const { currentPlaceId, _id, targetId, actionType } = data
        if (!isSocketOn) return
        const charState = getCharState()
        if (getGameStatus() === "loading") return
        if (currentPlaceId !== charState.currentPlace.placeId) return
        let enemyToChase = enemiez.find(enem => enem._id === data._id)
        if (!enemyToChase) return
        enemyToChase._targetId = data.targetId
        if (data.actionType === "idle") {
            enemyToChase._isMoving = false
            enemyToChase._attacking = true
        } else {
            enemyToChase._isMoving = true
            enemyToChase._attacking = false
        }
    })
    socket.on("enemy-removed", enemyId => {
        if (!isSocketOn) return
        const enemyDiedHere = enemiez.find(enmy => enmy._id === enemyId)
        if (enemyDiedHere) {
            enemyDiedHere.targetId = false
            enemiez = enemiez.filter(enmy => enmy._id !== enemyId)
            enemyRemove(enemyDiedHere)
        }
    })
    socket.on('enemy-respawned', tcpEnemies => {
        allEnemiez = tcpEnemies

        reCreateMeshesInScene()
    })
    // Movement
    socket.on("emitted-moving", data => {
        const { ownerId, pos, dirTarg, mode} = data
        const charState = getCharState()
        if(!charState) return
        if(ownerId === charState.owner) return
        const player = playersOnScene.find(pl => pl.owner === ownerId)
        if(!player) return
        
        player._moving = true
        player.mode = mode
        player.body.position.x = pos.x
        player.body.position.y = pos.y
        player.body.position.z = pos.z

        player.body.lookAt(new Vector3(dirTarg.x, dirTarg.y, dirTarg.z),0,0,0)
        // player.body.rotation.y = Math.atan2(dx, dz)
        // player.body.rotation.x = -Math.atan2(dy, Math.sqrt(dx * dx + dz * dz))

    })
    socket.on("stopped", data => {
        const { ownerId, pos, dirTarg, mode} = data
        const charState = getCharState()
        if(!charState) return
        if(ownerId === charState.owner) return
        const player = playersOnScene.find(pl => pl.owner === ownerId)
        if(!player) return
        
        player._moving = false
        player.mode = mode
        player.body.position.x = pos.x
        player.body.position.y = pos.y
        player.body.position.z = pos.z

        player.body.lookAt(new Vector3(dirTarg.x, dirTarg.y, dirTarg.z),0,0,0)
        stopAnim(player.anims, "running")
        stopAnim(player.anims, "walk")
        // player.body.rotation.y = Math.atan2(dx, dz)
        // player.body.rotation.x = -Math.atan2(dy, Math.sqrt(dx * dx + dz * dz))

    })
    socket.on("emitted-loc", data => {
        const { ownerId, pos, dirTarg, mode} = data
        const charState = getCharState()
        if(!charState) return
        const player = playersOnScene.find(pl => pl.owner === ownerId)
        if(!player) return
        const prevMode = player.mode
        console.log("prev mode: ", prevMode)
        console.log("nexr mode: ", mode)

        if(ownerId === charState.owner) return
        
        setPlayerMode(mode, player.owner)
        
        player.body.position.x = pos.x
        player.body.position.y = pos.y
        player.body.position.z = pos.z

        const dx = dirTarg.x - pos.x
        const dy = dirTarg.y - pos.y
        const dz = dirTarg.z - pos.z

        player.body.lookAt(new Vector3(dirTarg.x, dirTarg.y, dirTarg.z),0,0,0)
        // player.body.rotation.y = Math.atan2(dx, dz)
        // player.body.rotation.x = -Math.atan2(dy, Math.sqrt(dx * dx + dz * dz))

    })
    // DISCONNECT
    socket.on("player-death", data => {
        const {ownerId, currentPlaceId} = data
        if (!isSocketOn) return
      

        playerDied(ownerId, currentPlaceId)
    })
    socket.on('removeChar', ({ ownerId, playerName, placeId }) => {
        if(ownerId === getCharState().owner) return
        removePlayer({ ownerId, playerName, placeId })
    })
}



export function reCreateMeshesInScene() {
    const gameStat = getGameStatus()
    if (gameStat === "loading") return

    const characterState = getCharState()
    const sceneDet = getSceneDet()


    allPlayersFromTCP.length && allPlayersFromTCP.forEach(tcpCharDet => {
        if (tcpCharDet.owner === characterState.owner) return

        if (characterState.currentPlace.placeId !== tcpCharDet.currentPlace.placeId) return

        const isAlreadyHere = playersOnScene.find(plyer => plyer.owner === tcpCharDet.owner)
        
        if(tcpCharDet.owner === characterState.owner) return console.log("my character return ", tcpCharDet.owner);
        

        const tcpCharPlaceMD = findPlaceMetaData(tcpCharDet.currentPlace.placeId)
        const spawnPos = {x: tcpCharDet.x, y: tcpCharDet.y, z: tcpCharDet.z }

        let player = createCharacter(sceneDet.scene, spawnPos, tcpCharDet, false)
        if(!player) return
        pushPlayer(player, tcpCharDet.owner)
    })
    allEnemiez.length && allEnemiez.forEach(enemTcpInfo => {
        if (characterState.currentPlace.placeId !== enemTcpInfo.currentPlaceId) return
        const isAlreadyHere = enemiez.find(enem => enem._id === enemTcpInfo._id)
        if (isAlreadyHere) return 
        const enemy = createEnemy(scene, enemTcpInfo)
        // enemy._targetId = characterState._id
        // enemy._isMoving = true
        enemiez.push(enemy)
    })
}


//  PLAYER related
export function playerDied(ownerId, currentPlaceId) {
    const player = playersOnScene.find(pl => pl.owner === ownerId)
    if (!player) return
    const charState = getCharState()
    if (!charState) return
    if (charState.currentPlace.placeId !== currentPlaceId) return
    player._moving = false
    player._attacking = false
    player._minning = false
    player.mode = "death"
    playAnim(player.anims, "death", false)
    enemiez.forEach(enem => {
        if (enem._targetId === ownerId) {
            enem._targetId = false
        }
    })
    setTimeout(() => removePlayer({ ownerId, name: player.name, placeId: currentPlaceId }), 5000)
}
export function pushPlayer(newPlayer) {
    const isAlreadyHere = playersOnScene.find(plyer => plyer.owner === newPlayer.owner)
    if (isAlreadyHere) return
    playersOnScene.push(newPlayer)
}
export function removePlayer({ ownerId, playerName, placeId }){
    const characterState = getCharState()
    const gameStat = getGameStatus()
    const playerToRemove = playersOnScene.find(plyr => plyr.owner === ownerId)

    if(!playerToRemove) return

    if (!characterState) return

    if(gameStat === "loading") return

    if (characterState.currentPlace.placeId !== placeId) return
    playerToRemove.anims.forEach(anim => anim.dispose())
    playersOnScene = playersOnScene.filter(playr => playr.owner !== ownerId)

    const { scene } = getSceneDet()
    const bodyOfPlayer = scene.getMeshByName(`player.${ownerId}`)
    if (bodyOfPlayer) bodyOfPlayer.dispose()
}
export function setPlayerMode(ownerId, _newMode){
    const player = playersOnScene.find(pl => pl.owner === ownerId)
    if(!player) return;
    const prevMode = player.mode
    if(prevMode === "idle" && _newMode === "fighting"){
        // first also think how you can get the character if equiping a weapon
        // the animation of idle to fight will depend if it is wearing weapon
        playAnim(player.anims, "act_idletoready1")
    }
    if(prevMode === "fighting" && _newMode === "idle"){
        playAnim(player.anims, "act_idletoready1", false, true)
           
    }
    player.mode = _newMode
}


// npc
export function pushNpc(npcMeshDetail) {
    const theNpc = npcz.find(npc => npc._id === npcMeshDetail._id)
    if (theNpc) return
    npcz.push(npcMeshDetail)
}
export function resetNpcArray() {
    npcz = []
}
export function getNpcOnScene() {
    return npcz;
}