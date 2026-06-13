import { Texture,PhysicsMotionType, Vector3, Color3, StandardMaterial, ActionManager, Mesh, Quaternion } from "@babylonjs/core"
import { createMesh, createMonsterMaterial } from "../creations/creationTools.js"
import { randomNumMinMax } from "../tools/tools"
import { getEnemiesOnScene, getPlayersOnScene, getSocketContainers, removeEnemyOnScene } from "../sockets/worldsocket.js"
import { createTextMesh } from "../gui/textmesh.js"
import { createHpBar, poppingTextMesh } from "../tools/GUITools.js"
import { onIntersecEnterTrig, onIntersecExitTrig } from "../components/actionManager.js"
import { getCharState } from "../charactersystem/characterstate.js"
import { getGameStatus, getSceneDet } from "../main/main.js"
import { playAnim } from "../tools/animation.js"
import { getSocket } from "../sockets/joinsocket.js"
import { createAggregate } from "../tools/physics.js"
import { calcDmg } from "../charactersystem/attackingSystem.js"
import { emitEnemyIsHit } from "../sockets/emits.js"
import { randBetween } from "../tools/random.js"
import { obtain } from "../charactersystem/inventory.js"
import { openClosePopup } from "../tools/popupUI.js"
import { checkStoryQuestIfCompleted } from "../charactersystem/storyQuestSystem.js"




export default function createEnemy(scene, det) {

    const {goblinRoot, monolithRoot} = getSocketContainers()
    let yPos = det.y+(det.bodyHeight/2) + 0.05
    const body = createMesh(scene, `enemy.${det._id}`, { size: det.bodyWidenes, height: det.bodyHeight }, //height 1.7 // size: .5
        { x: det.x, y:yPos , z: det.z }, 1, false, true)

    // const agg = createAggregate(body, { mass: 0.1}, "box", scene)
    // // Make it kinematic
    // agg.body.setMotionType(PhysicsMotionType.STATIC);
    // agg.disablePreStep = false; // must be false for ANIMATED to work
    const atkDetection = createMesh(scene, `atkDetection.${det._id}`, { size: det.bodyWidenes*2, height: 0.5 },
        { x: 0, y: 0, z: 0 }, 1, false, true)  
    atkDetection.parent = body
    atkDetection.isPickable = false
    
    let mainChaseDetector = scene.getMeshByName("chasedetector")
    let chaseDetector 
    if(mainChaseDetector){
        chaseDetector = mainChaseDetector.createInstance(`chasedetector.${det._id}`)
        chaseDetector.parent = body
        chaseDetector.isPickable = false
    }else{
        mainChaseDetector = createChaseDetector(scene)
        chaseDetector = mainChaseDetector.createInstance(`chasedetector.${det._id}`)
        chaseDetector.parent = body
        chaseDetector.isPickable = false
    }
    chaseDetector.isVisible = false

    let entries
    switch(det.modelStyle){
        case "goblin":
            entries = goblinRoot.instantiateModelsToScene()
        break
        case "monolith":
            entries = monolithRoot.instantiateModelsToScene()
        break
    }
    entries.animationGroups.map(ani => ani.name = ani.name.split(" ")[2])
    const mainBodyMeshes = entries.rootNodes[0]
    mainBodyMeshes.parent = body
    mainBodyMeshes.position.y -= det.bodyHeight/2
    mainBodyMeshes.rotationQuaternion = Quaternion.Identity()

    if (det._dirTarg) body.lookAt(new Vector3(det._dirTarg.x, yPos, det._dirTarg.z))

        
    // const fshadow = putFakeShadow(body, fakeShadowRoot, det.bodyHeight * .7, -yPos + .01)
    const nameMesh = createTextMesh(scene, body, det.dn, "white", { x: 0, y: yPos + 0.5, z: 0 }, 35)
    
    const { hpbar, hpmesh } = createHpBar(yPos + .1, det._id, body, det.hp, det.maxHp)
    // const theCharacterRoot = monsRoots.find(rootInfo => rootInfo.name === det.modelStyle)
    // if (!theCharacterRoot) return

    mainBodyMeshes.getChildren().forEach(enemyasset => {
        enemyasset.name = enemyasset.name.split(" ")[2].toLowerCase()
        enemyasset.isPickable = false
        if (enemyasset.name === 'body') {
            // console.warn("set material for body")
            const mat = createMonsterMaterial(scene, det.modelStyle, det.name)
            enemyasset.material = mat

        }
        if (enemyasset.name === 'armature' && det.modelStyle === "dummy") {
            enemyasset.getChildren().forEach(chldm => {
                chldm.name = chldm.name.split(" ")[2].toLowerCase()
                if (chldm.name === 'body') {
                    const mat = createMonsterMaterial(scene, det.modelStyle, det.name)
                    chldm.material = mat
                }
            })

        }
    })

    let intervalWillAttack
    function initAttack() {
        let attackSpdInterval = Math.floor(det.stats.atkSpd * 900)
        if (attackSpdInterval >= 3900) attackSpdInterval = 3950

        clearInterval(intervalWillAttack)
        intervalWillAttack = setInterval(() => {
            // console.log(det.stats.atkSpd)
            const thisEnemy = getEnemiesOnScene().find(ene => ene._id === det._id)
            if (getGameStatus() === "loading") return
            if (!thisEnemy) return clearInterval(intervalWillAttack)
            if (thisEnemy._targetId) {
                const targetHero = getPlayersOnScene().find(pl => pl.owner === thisEnemy._targetId)
                if (!targetHero) return
                if (targetHero.isDead) return
                const targBody = scene.getMeshByName(`player.${thisEnemy._targetId}`)
                if (!targBody) return console.warn("targbody cannot found")
                const { x, z } = targBody.position
                const targPos = new Vector3(x, thisEnemy.body.position.y, z)
                const targDist = Vector3.Distance(targPos, thisEnemy.body.position)
                // console.log("targDistance  " + targDist)
                // console.log("maxDistance  " + thisEnemy.det.maxDistance)
                if (targDist <= thisEnemy.det.maxDistance) emitAttack(det, thisEnemy._id, thisEnemy._targetId, det.currentPlaceId, { x: thisEnemy.body.position.x, z: thisEnemy.body.position.z })
            }
        }, 4400 - attackSpdInterval)
    }

    const charState = getCharState()
    if(!charState) return
    const myChar = getPlayersOnScene().find(pl => pl.owner === charState.owner)
    if(!myChar) return
    onIntersecEnterTrig(body, myChar.body, getSceneDet().scene, () => {
        const thisEnemy = getEnemiesOnScene().find(ene => ene._id === det._id)
        if (!thisEnemy) return
        thisEnemy._isMoving = false
        const myCharId = myChar.body.name.split(".")[1]
        const enemyTargetBody = getSceneDet().scene.getMeshByName(`player.${myCharId}`)

        const plPos = enemyTargetBody.position
        emitRegisterAsEnemy(thisEnemy._id, myCharId, {x: plPos.x, y: yPos, z: plPos.z})

        thisEnemy._isMoving = false
    })
    onIntersecEnterTrig(atkDetection, myChar.body, getSceneDet().scene, () => {
        const thisEnemy = getEnemiesOnScene().find(ene => ene._id === det._id)
        const myCharId = myChar.body.name.split(".")[1]

        if (!thisEnemy) return
        thisEnemy._isMoving = false
        const enemyTargetBody = getSceneDet().scene.getMeshByName(`player.${myCharId}`)

        const plPos = enemyTargetBody.position
        emitRegisterAsEnemy(thisEnemy._id, myCharId, {x: plPos.x, y: yPos, z: plPos.z})
        // emitChase(thisEnemy._id, myCharId, det.currentPlace, det.actionType)
        initAttack()       
    })
    onIntersecExitTrig(atkDetection, myChar.body, getSceneDet().scene, () => {
        const thisEnemy = getEnemiesOnScene().find(ene => ene._id === det._id)
        if (!thisEnemy) return

        const myCharId = myChar.body.name.split(".")[1]
        if (thisEnemy._targetId !== myCharId) return 
        clearInterval(intervalWillAttack)
        emitChase(thisEnemy._id, myCharId, det.currentPlaceId, det.actionType)
    })

    // onIntersecEnterTrig(chaseDetector, myChar.body, getSceneDet().scene, () => {
    //     const thisEnemy = getEnemiesOnScene().find(ene => ene._id === det._id)
    //     const myCharId = myChar.body.name.split(".")[1]

    //     if (!thisEnemy) return

    //     const enemyTargetBody = getSceneDet().scene.getMeshByName(`player.${myCharId}`)


    //     const plPos = enemyTargetBody.position
    //     emitRegisterAsEnemy(thisEnemy._id, myCharId, {x: plPos.x, y: yPos, z: plPos.z})
    //     // emitChase(thisEnemy._id, myCharId, det.currentPlace, det.actionType)
    //     initAttack(det)
        
    // })
    onIntersecExitTrig(chaseDetector, myChar.body, getSceneDet().scene, () => {
        // const thisEnemy = getEnemiesOnScene().find(ene => ene._id === det._id)
        // const myCharId = myChar.body.name.split(".")[1]

        // if (!thisEnemy) return

        // const enemyTargetBody = getSceneDet().scene.getMeshByName(`player.${thisEnemy._targetId}`)
        // const plPos = enemyTargetBody.position
        // if (!enemyTargetBody) {
        //     emitRegisterAsEnemy(thisEnemy._id, myCharId, {x: plPos.x, y: yPos, z: plPos.z})
        //     // emitChase(thisEnemy._id, myCharId, det.currentPlace, det.actionType)
        //     initAttack(det)
        // }
    })
    // let intervalAtk
    // let intervalDistanceChecker

    // if(det.actionType === "dynamic" || det.actionType === "throwing"){
    //     const rangeAtkDetection = createMesh(scene, `rangeAtkDetection${det._id}`,
    //     { size: det.rangeAtkDetails.range , height: det.bodyHeight}, { x: 0, y: 0, z: 0 }, .5, false, true)
        
    //     rangeAtkDetection.parent = body
    //     rangeAtkDetection.isPickable = false

    //     regActionEnter(rangeAtkDetection, heroBody, () => {
    //         const thisEnemy = getEnemiesOnScene().find(ene => ene._id === det._id)
    //         const myCharId = heroBody.name.split(".")[1]
    //         const heroPos = heroBody.position
    //         if (!thisEnemy) return
    //         if(thisEnemy.isDead) return 
    //         console.warn(det.name, " emit range attack")
    //         emitRangeAttack(det, thisEnemy._id, false, det.cPlace, getMeshPos(thisEnemy.body), getMeshPos(heroBody), det.rangeAtkDetails)
    //     })
    //     regActionExit(rangeAtkDetection, heroBody, () =>{
    //         const thisEnemy = getEnemiesOnScene().find(ene => ene._id === det._id)
    //         const myCharId = heroBody.name.split(".")[1]
    //         const heroPos = heroBody.position
    //         if (!thisEnemy) return
    //         if(thisEnemy.isDead) return 
    //         emitRangeAttack(det, thisEnemy._id, false, det.cPlace, getMeshPos(thisEnemy.body), getMeshPos(heroBody), det.rangeAtkDetails)
    //     })
    // }

    // for my attack
    const atkCollider = scene.getMeshByName(`atkCollider`)
    if(atkCollider){
        onIntersecExitTrig(atkCollider, body, scene, () => {
            const enemy = getEnemiesOnScene().find(ene => ene._id === det._id)
            if (!enemy) return
            // Handle attack collision logic
            const charState = getCharState()
            // playAnim(entries.animationGroups, `hit1`)
            emitEnemyIsHit({
                playerId: charState.owner,
                dmgDetails: calcDmg(charState),
                targetId: det._id,
                currentPlaceId: det.currentPlaceId,
            })
        })
    }
    playAnim(entries.animationGroups, "0Idle", true)
    return {
        det,
        _id: det._id,
        name: det.name,
        spd: det.stats.spd,
        currentPlace: det.currentPlace,
        chaseDetector,
        body,
        // fshadow,
        nameMesh,
        hpbar,
        hpmesh,
        anims: entries.animationGroups,
        meshes: mainBodyMeshes.getChildMeshes(),
        isDead: false,
        actionType: det.actionType,
        // deathSound,

        _isMoving: det._isMoving ? det._isMoving : false,
        _dirTarg: det._dirTarg ? det._dirTarg : { x: 0, y: yPos, z: 0 },
        _targetId: det._targetId,


        intervalWillAttack
    }
}

function createChaseDetector(scene){
    const detector = createMesh(scene, "chasedetector", { size: 19, height: 0.1 }, { x: 0, y: 0, z: 0 }, 1, false, false)
    detector.isPickable = false
    return detector
}
// tools
function emitAttack(detail, enemId, targetId, placeId, pos) {
    // log(`enemy will attack ${detail.name}`)
    getSocket().emit("enemyWillAttack", {
        currentPlaceId: placeId,
        _id: enemId,
        pos,
        targetId: targetId,
        dmg: detail.stats.dmg,
        atkSpd: detail.stats.atkSpd,
        attackAnimName: `attack${randomNumMinMax(0, 1.5)}`,
        effects: detail.effects
    })
}
function emitRangeAttack(detail, enemId, targetId, cPlace, pos, targetPos, rangeAtkDetails){
    getSocket().emit("enemyAttackedRange", {
        currentPlace: cPlace,
        _id: enemId,
        pos,
        targetPos,
        targetId: false,
        dmg: detail.stats.dmg,
        atkSpd: detail.stats.atkSpd,
        attackAnimName: `attack${randomNumMinMax(0, 1.5)}`,
        effects: detail.effects,
        rangeAtkDetails
    })
}
function emitChase(enemId, heroId, cPlaceId, actionType) {
    // if(thisEnemy.actionType === "idle" ) return
    getSocket().emit("enemyWillChase", {
        currentPlaceId: cPlaceId,
        _id: enemId,
        targetId: heroId,
        actionType
    })
}
function emitRegisterAsEnemy(enemId, heroId, dirTarg) {
    getSocket().emit("registerPlayerAsEnemy", {
        _id: enemId,
        targetId: heroId,
        dirTarg
    })
}

export function enemyIsHit(data){
    const { playerId, targetId, dmgToApply, currentPlaceId, hp, maxHp } = data
    const enemy = getEnemiesOnScene().find(ene => ene._id === targetId)
    if (!enemy) return
    // for weapon when hit something sound
    // playSound(soundToPlay, .9, .3)
    const enemPos = enemy.body.position

 
    poppingTextMesh(`-${data.dmgToApply}`, "red", 40 + Math.random() * 25, Math.random() * 1, { x: -1 + Math.random() * 2, y: enemy.det.bodyHeight/2+.5, z: -1 + Math.random() * 2 }, enemy.body, true)

    enemy.hpbar.width = `${data.hp / data.maxHp * 100 * 3}px`
    playAnim(enemy.anims, `hit${randBetween(0,1)}`)
    if (data.hp <= 0) {
        removeEnemyOnScene(targetId)
        clearInterval(enemy.intervalWillAttack)
        playAnim(enemy.anims, "death")
        enemyDispose(enemy)
        // if (enemy.deathSound) {
        //     enemy.deathSound.attachToMesh(enemy.body)
        //     enemy.deathSound.play()
        // }
        if (playerId === getCharState().owner) {
            defeatedAmonster(enemy.det)
            // getSocket().emit('enemyChangeTarget', { _id: targetId, newTargetId: null })
        }
        return getSocket().emit("removeEnemy", {enemyId: targetId})
        
    }
}
export function defeatedAmonster(data){
    const {name,dn, monsSoul,skills,effects,effectsWhenHit, loots} = data

    const characterState = getCharState()
    characterState.monsSoul += monsSoul
    const defeatedMonster = characterState.defeatedMonsters.find(monsName => monsName === name)

    checkStoryQuestIfCompleted('enemy', name)

    if(loots.length){
        let obtainTimeOutCount=0
        loots.forEach(loot=>{
            setTimeout(()=>{
                obtain(loot)
            }, obtainTimeOutCount)
            obtainTimeOutCount+=500
        })
    }
    if(!defeatedMonster){
        characterState.defeatedMonsters.push(name)
        setTimeout(() => {
            openClosePopup(`slain a ${dn} `, true, 2000)
            // getAllSounds().notif1S.play()
        }, 1000)
    }
    // log("killed a monster ", data)
    
    getSocket().emit('respawnEnemy', data)
}
// ENEMY WHEN HIT RELATED
export function enemyDispose(enemy) {
    enemy.hpbar.width = `0px`
    enemy.hpmesh.dispose()
    enemy.anims.forEach(anim => anim.name === "death" ? anim.play() : anim.stop())
    // enemy.fshadow.dispose()

    setTimeout(() => {
        enemy.anims.forEach(anim => anim?.dispose())
        enemy.meshes.forEach(chld => chld.dispose()),
        enemy.body.dispose()
        enemy.chaseDetector.dispose()
        enemy.nameMesh.dispose()
        enemy.hpmesh.dispose()
        enemy.hpbar.dispose()
    }, 2000)
}