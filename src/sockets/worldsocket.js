import { deductHp, getCharState } from "../charactersystem/characterstate"
import { createCharacter } from "../charactersystem/createcharacter"
import { getGameStatus, getSceneDet } from "../main/main"
import { findPlaceMetaData } from "../states/placestates"
import { attachCam, camShake } from "../tools/camera"
import { getSpawnPos } from "../tools/position"
import { Vector3, Mesh, MeshBuilder, ActionManager, ExecuteCodeAction } from "@babylonjs/core"
import { createTransparentMat } from "../tools/materials"
import { createTextMesh } from "../gui/textmesh"
import { showGuildQuest, questToItem } from "../charactersystem/guildQuest"
import { playAnim, ANIM_STATE } from "../tools/animation"
import { removeRenderObservable, addRenderObservable } from "./renderer"
import { stopAnim } from "../tools/tools"
import { poppingTextMesh } from "../tools/GUITools"
import { attack, activateSkill } from "../charactersystem/attackingSystem"
import createEnemy, { enemyIsHit, applyEnemyBind, removeEnemyBind, applyEnemyCurse } from "../enemies/createEnemy"
import { randBetween } from "../tools/random"
import { emitDied, emitEnemyIsHit } from "./emits"
import { castEnemySkill } from "../creations/skillEffects.js"
import { SKILLS_BY_NAME } from "../staticRecources/skillsData.js"
import { obtain } from "../charactersystem/inventory"
import { popStatusEffect } from "../tools/popupUI"
import { receiveWorldChatMessage } from "../components/worldChatSystem"
import { OPENWORLD_PLACE_ID } from "../constants/constants.js"
// From TCPs
let allPlayersFromTCP = []
let allEnemiez = []
let allQuests = []

// In Client
let playersOnScene = []
let enemiez = []
let npcz = []
let projectilesOnScene = []
let questsOnScene = []

// how close (planar, x/z only) the LOCAL player needs to be before an
// openworld enemy's mesh actually gets created - openworld can have ~500
// enemies alive at once (tcp/recources/enemyDetails.ts) spread across a
// 300-1000 unit radius; creating every single one of them (model
// instantiation, hp bar/name tag GUI textures, atkDetection/chaseDetector
// colliders, plus its own Y-correction/dodge/skill-cast intervals - see
// createEnemy.js) the instant you join, most of which you may never get
// near, is a huge unnecessary hit. A bit larger than renderer.js's own
// OPENWORLD_ENEMY_HIDE_DIST (200) on purpose - by the time you're actually
// close enough to need to SEE an enemy, its mesh has already finished
// building instead of both costs (create + reveal) landing on the same
// frame. Not scoped to any other place - village/dungeon enemy counts were
// never a problem, and gating them too just adds risk for no benefit.
const OPENWORLD_ENEMY_CREATE_DIST = 300
const OPENWORLD_ENEMY_CREATE_DIST_SQ = OPENWORLD_ENEMY_CREATE_DIST * OPENWORLD_ENEMY_CREATE_DIST
// reCreateMeshesInScene only ever runs off "userJoined"/"enemy-respawned"
// broadcasts (see this file's own socket.on calls) - neither fires just
// because YOUR OWN character walked closer to a not-yet-created enemy, so
// without something re-checking on a timer, most of the openworld would
// stay permanently empty for you (only ever picking up newly-in-range
// enemies as an incidental side effect of someone else joining or some
// unrelated enemy elsewhere on the map happening to respawn). This interval
// is what actually makes approaching an enemy work - reCreateMeshesInScene
// itself is already safe to call repeatedly (isAlreadyHere/getMeshByName
// skip everything already tracked), so this just re-runs it on a timer.
const OPENWORLD_ENEMY_RECHECK_INTERVAL_MS = 3000
setInterval(() => {
    const charState = getCharState()
    if(!charState || charState.currentPlace.placeId !== OPENWORLD_PLACE_ID) return
    if(getGameStatus() !== "running") return
    reCreateMeshesInScene()
}, OPENWORLD_ENEMY_RECHECK_INTERVAL_MS)


let scene;
let containers = {
    hairs: null,
    animeBody: null,
    allweapons: null,
    // single-mesh, non-sword weapons (spear, etc) - see createweapon.js's
    // createSingleMeshWeapon, same "<weaponType>.<name>" lookup as helmets
    weapons: null,
    helmets: null,
    gauntlets: null,
    pauldrons: null,
    armors: null,
    belts: null,
    cloaks: null,

    goblinRoot: null,
    monolithRoot: null,
    slimeRoot: null,
    lesserDemonRoot: null
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
    // createQuestPlaneMesh dedupes against this by questId - the meshes it
    // tracks get destroyed along with the rest of the old scene on every
    // transition (changeScene() disposes the whole scene), but without
    // clearing this too the stale questId entries survive and make
    // createQuestPlaneMesh silently skip re-creating them next time you're
    // back in a quest-board place
    questsOnScene = []
    containers = {
        hairs: null,
        animeBody: null,
        allweapons: null,
        weapons: null,
        helmets: null,
        gauntlets: null,
        pauldrons: null,
        armors: null,
        belts: null,
        cloaks: null,

        goblinRoot: null,
        monolithRoot: null,
        slimeRoot: null,
        lesserDemonRoot: null
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
    // (false, true) - also disposes any material/texture still attached
    // recursively through this body's own children (Mesh/Node.dispose()'s
    // disposeMaterialAndTextures param defaults to false otherwise). This
    // is THE shared cleanup point for every projectile in the game -
    // skillEffects.js's fireElementalProjectile/fireEnemySkillProjectile
    // AND creations/skills.js's own spawnProjectile (astralrainSkill's
    // falling swords, the "throw weapon" mechanic) all funnel through here -
    // so this one flag change is what actually makes each style's own
    // per-cast material (createGlowingMat, never shared/cached across
    // instances - see tools/materials.js) get freed instead of leaking
    // every single cast.
    theProjectile.body.dispose(false, true)
    projectilesOnScene = projectilesOnScene.filter(proj => proj.itemId !== itemId)
}
export function getProjectilesOnScene(){
    return projectilesOnScene
}
export function activateOnSocketListeners(socket){

    // WORLD CHAT - no rooms/parties, this is just a global relay
    socket.on("worldChatMessage", data => {
        if (!isSocketOn) return
        receiveWorldChatMessage(data)
    })

    socket.on("userJoined", allDataFromServer => {
        if (!isSocketOn) return
        const { currentPlaceId, newPlayerName, players, placesMD, tcpEnemies, quests } = allDataFromServer
        allPlayersFromTCP = players
        allEnemiez = tcpEnemies
        allQuests = quests
        
        const characterState = getCharState()
        const gameStat = getGameStatus()
        if (gameStat === "loading") return
        console.log(`${newPlayerName} joined in ${currentPlaceId}`)
        if(currentPlaceId !== characterState.currentPlace.placeId) return
        if (socket === undefined) return console.warn("socket UNDEFINED !")

        if (!characterState) return console.log("no charState")

        if (gameStat === "running") {
            reCreateMeshesInScene()
        }else console.log("gameStat is not running, skipping reCreateMeshesInScene()")
    })
    // equiping
    socket.on("equiped-item", data => {
        if (!isSocketOn) return
        const charState = getCharState()
        const {ownerId, itemName, itemModelStyle, itemModelName, itemType, currentPlaceId, metalColor, weaponType} = data
        if (!charState) return
        if (charState.currentPlace.placeId !== currentPlaceId) return
        // if(ownerId === charState.owner) return console.log("this is me return")
        const theEquipingPlayer = playersOnScene.find(pl => pl.owner === ownerId)
        if (!theEquipingPlayer) return

        if (itemType === "boots") theEquipingPlayer.equipBoots(itemName)
        if(itemType === "armor") theEquipingPlayer.equipArmor(itemName, metalColor)
        if(itemType === "weapon") {

            theEquipingPlayer.equipSword(itemName, theEquipingPlayer.mode === "fighting", data.parts, weaponType, metalColor)
        }
        if(itemType === "helmet") theEquipingPlayer.equipHelmet(itemModelName, metalColor, itemName)
        if(itemType === "gauntlet") theEquipingPlayer.equipGauntlet(itemName, metalColor)
        if(itemType === "pauldron") theEquipingPlayer.equipPauldron(itemName, metalColor)

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
    // QUESTS (guild board)
    socket.on("quest-claim-result", data => {
        if (!isSocketOn) return
        const { ownerId, questId, success, quest, currentPlaceId } = data
        const charState = getCharState()
        if (!charState) return
        if (charState.currentPlace.placeId !== currentPlaceId) return

        if (success) {
            // no longer available to anyone — pull its marker off the board
            const entry = questsOnScene.find(q => q.questId === questId)
            if (entry) entry.mesh.dispose()
            questsOnScene = questsOnScene.filter(q => q.questId !== questId)
            allQuests = allQuests.filter(q => q.questId !== questId)
        }

        if (ownerId !== charState.owner) return
        if (success) {
            obtain(questToItem(quest))
        } else {
            popStatusEffect("Quest already taken", "red")
        }
    })
    socket.on("quest-cancelled", data => {
        if (!isSocketOn) return
        const { quest, currentPlaceId } = data
        const charState = getCharState()
        if (!charState) return
        if (charState.currentPlace.placeId !== currentPlaceId) return

        const alreadyTracked = allQuests.find(q => q.questId === quest.questId)
        if (!alreadyTracked) allQuests.push(quest)
        createQuestPlaneMesh(quest)
    })
    // a completed quest got retired and the server topped the board back up
    // with a fresh one to replace it
    socket.on("quest-spawned", data => {
        if (!isSocketOn) return
        const { quest, currentPlaceId } = data
        const charState = getCharState()
        if (!charState) return
        if (charState.currentPlace.placeId !== currentPlaceId) return

        const alreadyTracked = allQuests.find(q => q.questId === quest.questId)
        if (!alreadyTracked) allQuests.push(quest)
        createQuestPlaneMesh(quest)
    })
    // ACTIONS
    // PLAYER ATTACK RELATED
    socket.on("skillactivated", data => {
        if (!isSocketOn) return
        const { ownerId, skill, currentPlaceId } = data
        const charState = getCharState()
        if (!charState) return
        if (charState.currentPlace.placeId !== currentPlaceId) return
        activateSkill(ownerId, skill)
    
    })
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
        attack(data, data.animName)
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
        // playAnim(victimPlayer.anims, "hit1")
        // victimPlayer.characterAnimations.playAction(victimPlayer.anims, "hit1", 1)
        theEnemyToAttack.attackSound?.play()
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
                // const enemyAccuracy = theEnemyToAttack.det.stats.accuracy
                // if (charState.stats.accuracy >= Math.random() * enemyAccuracy * 15) return popStatusEffect('missed', "#f5f5f5")
                camShake(getSceneDet().scene, getSceneDet().scene.activeCamera, .01, true)
                // victimPlayer.punchedS.play()

                // dark magic's curse (see skillsData.js's header comment,
                // skillEffects.js's hit handler) - a cursed enemy's own
                // attack damage returns to its own hp instead of hurting
                // the victim, every single time it attacks, for the rest of
                // its life. Gated the same way deductHp below already is
                // (only the victim's own client acts on it) so this doesn't
                // fire once per client watching the fight and multi-apply
                // the self-damage.
                if(theEnemyToAttack._cursed){
                    emitEnemyIsHit({
                        playerId: charState.owner,
                        dmgDetails: { physicalDmg: data.dmg, weaponDmg: 0 },
                        targetId: theEnemyToAttack._id,
                        currentPlaceId: charState.currentPlace.placeId,
                    })
                    return
                }

                const isDead = await deductHp(data.dmg, data.effects)
                if (isDead) emitDied()

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
    // enemy skill-casting (det.skills, see createEnemy.js's own comment on
    // the decision side, skillEffects.js's castEnemySkill/
    // fireEnemySkillProjectile on the execution side) - mirrors
    // "enemy-attacked"'s plain relay pattern: the server does no
    // validation of its own, it just broadcasts to everyone including the
    // sender, and every client (this handler) reacts identically -
    // castEnemySkill's own safety comes from only the intended victim's
    // client ever applying damage, not from anything gated here.
    socket.on("enemy-cast-skill", data => {
        if (!isSocketOn) return
        const charState = getCharState()
        if (getGameStatus() === "loading") return
        if (!charState || data.currentPlaceId !== charState.currentPlace.placeId) return
        const enemy = enemiez.find(enem => enem._id === data._id)
        if (!enemy) return
        const targetPlayer = playersOnScene.find(pl => pl.owner === data.targetId)
        if (!targetPlayer) return
        const skill = SKILLS_BY_NAME[data.skillName]
        if (!skill) return

        castEnemySkill(scene, enemy, skill, targetPlayer)
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
    socket.on("enemy-y-corrected", data => {
        const { _id, y, x, z } = data
        const enem = enemiez.find(enem => enem._id === _id)
        if (!enem?.body) return
        // this correction was computed for wherever the enemy WAS at emit time -
        // if it's since moved (still chasing, or another client moved it further),
        // this y no longer applies to its current x/z, so skip it rather than
        // snapping the enemy to a height that belongs to a position it left behind
        const dx = enem.body.position.x - x
        const dz = enem.body.position.z - z
        if((dx * dx + dz * dz) > 4) return // > 2 units drifted since this was computed
        enem.body.position.y = y
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
            const targetPlayer = playersOnScene.find(pl => pl.owner === data.targetId)
            const isFar = targetPlayer && Vector3.Distance(enemyToChase.body.position, targetPlayer.body.position) > 1
            enemyToChase._isMoving = isFar
            enemyToChase._attacking = false
        }
    })
    // enemy wander (tcp/index.ts's own module-level interval - "scouting",
    // idle enemies walking to a nearby open spot on their own) and enemy
    // dodge (createEnemy.js's projectile-threat check, det.canDodge -
    // fireslime/electricslime/orangelith for now) both just set the same
    // renderer.js-read fields - the only difference is dodge also sets
    // _isDodging (renderer.js's own movement loop reads that for the 3x
    // speed burst) and doesn't touch _targetId, so it can interrupt a
    // chase mid-fight without losing track of who the enemy was fighting.
    socket.on("enemy-wander", data => {
        if (!isSocketOn) return
        const charState = getCharState()
        if (getGameStatus() === "loading") return
        if (!charState || data.currentPlaceId !== charState.currentPlace.placeId) return
        const enemy = enemiez.find(enem => enem._id === data._id)
        if (!enemy) return
        enemy._wanderTarget = { x: data.x, z: data.z }
        enemy._isMoving = true
    })
    socket.on("enemy-dodge", data => {
        if (!isSocketOn) return
        const charState = getCharState()
        if (getGameStatus() === "loading") return
        if (!charState || data.currentPlaceId !== charState.currentPlace.placeId) return
        const enemy = enemiez.find(enem => enem._id === data._id)
        if (!enemy) return
        enemy._wanderTarget = { x: data.x, z: data.z }
        enemy._isMoving = true
        enemy._isDodging = true
    })
    // skill.enemyBind (see skillsData.js's radiantjudgmentSkill, skillEffects.js's
    // hit handler, tcp/index.ts's enemyBind handler) - server is the actual
    // _disabled timer authority, this just reacts to its two broadcasts
    socket.on("enemy-bound", data => {
        if (!isSocketOn) return
        const charState = getCharState()
        if (getGameStatus() === "loading") return
        if (!charState || data.currentPlaceId !== charState.currentPlace.placeId) return
        applyEnemyBind(scene, data.targetId, data.shape, data.bindDuration)
    })
    socket.on("enemy-unbound", data => {
        if (!isSocketOn) return
        removeEnemyBind(data.targetId)
    })
    // dark magic's curse (see skillsData.js's header comment, skillEffects.js's
    // hit handler, tcp/index.ts's enemyCurse handler) - permanent, no
    // matching "enemy-uncursed" broadcast. The actual damage-reflection
    // this causes is in the "enemy-attacked" handler further below, not here.
    socket.on("enemy-cursed", data => {
        if (!isSocketOn) return
        const charState = getCharState()
        if (getGameStatus() === "loading") return
        if (!charState || data.currentPlaceId !== charState.currentPlace.placeId) return
        applyEnemyCurse(scene, data.targetId)
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
    // tcp/index.ts's own dynamic slime-spawning interval (openworld,
    // placeId 888) - tops territory back up near whichever players wander
    // into an empty pocket of it. Same shape/handling as enemy-respawned
    // above (full tcpEnemies snapshot -> reCreateMeshesInScene picks up
    // whatever's newly in range, per OPENWORLD_ENEMY_CREATE_DIST), just its
    // own event name since this isn't a specific enemy respawning after
    // death - a semantically distinct case even though the client-side
    // reaction is identical.
    socket.on('enemy-spawned', tcpEnemies => {
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

        player.body.lookAt(new Vector3(dirTarg.x, player.body.position.y, dirTarg.z),0,0,0)
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
        // player.body.rotation.y = Math.atan2(dx, dz)
        // player.body.rotation.x = -Math.atan2(dy, Math.sqrt(dx * dx + dz * dz))

    })
    socket.on("emitted-mode", data => {
        const { ownerId, mode, weaponName} = data
        const charState = getCharState()
        if(!charState) return
        const player = playersOnScene.find(pl => pl.owner === ownerId)
        if(!player) return
        const prevMode = player.mode
        if(ownerId === charState.owner) return
        
        console.log(`${player.name} `, mode, weaponName)
        setPlayerMode(ownerId, mode, weaponName)
    })
    socket.on("emitted-loc", data => {
        const { ownerId, pos, dirTarg, mode, weaponName} = data
        const charState = getCharState()
        if(!charState) return
        const player = playersOnScene.find(pl => pl.owner === ownerId)
        if(!player) return
        const prevMode = player.mode
        if(ownerId === charState.owner) return
        setPlayerMode(ownerId, mode, weaponName)
        
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



// Builds one quest marker plane on the guild board. Pulled out of
// reCreateMeshesInScene so the "quest-cancelled" handler can also call it
// to bring a single quest's marker back without re-running the whole
// player/enemy/quest resync.
function createQuestPlaneMesh(quest, _scene) {
    const isAlreadyHere = questsOnScene.find(q => q.questId === quest.questId)
    if (isAlreadyHere) return

    const guildboard = _scene.getMeshByName("guildboard")
    if (!guildboard) return

    const questPlane = MeshBuilder.CreatePlane(`quest.${quest.questId}`, { height: 0.6, width: 0.4 }, _scene)
    questPlane.material = createTransparentMat(_scene, `./images/modeltex/quest/${quest.questRequirements.modelStyle}.webp`)
    questPlane.isPickable = true
    questPlane.parent = guildboard;
    questPlane.position = new Vector3(-0.01, quest.pos.y, quest.pos.z)
    questPlane.addRotation(0, Math.PI/2,0)

    questPlane.actionManager = new ActionManager(_scene)
    questPlane.actionManager.registerAction(
        new ExecuteCodeAction(ActionManager.OnPickTrigger, () => showGuildQuest(quest))
    )

    // createTextMesh builds its plane at a fixed 5x5 size meant for
    // world-scale nametags, so it has to be scaled way down to sit as a
    // small corner badge on this 0.4x0.6 quest plane. It also always
    // forces billboardMode ON (for nametags following the camera), but
    // this label should stay flush with the board like questPlane does,
    // so it's reset to NONE right after.
    const rankLabel = createTextMesh(_scene, questPlane, quest.requiredRank.rankLabel, "black", { x: -0.13, y: 0.2, z: -0.0125 }, 27)
    rankLabel.billboardMode = Mesh.BILLBOARDMODE_NONE

    questsOnScene.push({ questId: quest.questId, mesh: questPlane })
}

export function reCreateMeshesInScene() {
    const gameStat = getGameStatus()
    if (gameStat === "loading") return

    const characterState = getCharState()
    const sceneDet = getSceneDet()

    // allPlayersFromTCP is the latest full snapshot from the server, so
    // anyone on my scene who isn't in it anymore for my place has since
    // moved elsewhere (or logged off without going through 'removeChar') -
    // drop their body here too, otherwise it's a ghost stuck in my scene.
    // playersOnScene.forEach(scenePlyr => {
    //     const stillHere = allPlayersFromTCP.find(tcpCharDet =>
    //         tcpCharDet.owner === scenePlyr.owner &&
    //         tcpCharDet.currentPlace.placeId === characterState.currentPlace.placeId
    //     )
    //     if (stillHere) return
    //     removePlayer({ ownerId: scenePlyr.owner, placeId: characterState.currentPlace.placeId })
    // })

    allPlayersFromTCP.length && allPlayersFromTCP.forEach(tcpCharDet => {
        if (tcpCharDet.owner === characterState.owner) return

        if (characterState.currentPlace.placeId !== tcpCharDet.currentPlace.placeId) return

        const isAlreadyHere = playersOnScene.find(plyer => plyer.owner === tcpCharDet.owner)
        if (isAlreadyHere) return
        // const tcpCharPlaceMD = findPlaceMetaData(tcpCharDet.currentPlace.placeId)
        const spawnPos = {x: tcpCharDet.pos.x, y: 0.01, z: tcpCharDet.pos.z }

        let player = createCharacter(sceneDet.scene, spawnPos, tcpCharDet, false)
        if(!player) return
        pushPlayer(player, tcpCharDet.owner)
    })
    // openworld only - see OPENWORLD_ENEMY_CREATE_DIST's own comment. null
    // everywhere else (village/dungeon never needed this, and skipping the
    // lookup there avoids paying for it on every single recreate pass).
    const myOwnBody = characterState.currentPlace.placeId === OPENWORLD_PLACE_ID
        ? playersOnScene.find(pl => pl.owner === characterState.owner)?.body
        : null
    allEnemiez.length && allEnemiez.forEach(enemTcpInfo => {
        if (characterState.currentPlace.placeId !== enemTcpInfo.currentPlaceId) return

        // distance check FIRST, before either of the (more expensive)
        // isAlreadyHere/getMeshByName lookups below - most of allEnemiez is
        // both already-created AND already excluded by this on any given
        // pass once the world settles, so this ordering means most entries
        // bail out on the cheapest possible check.
        if(myOwnBody){
            const dx = enemTcpInfo.x - myOwnBody.position.x
            const dz = enemTcpInfo.z - myOwnBody.position.z
            if((dx * dx + dz * dz) > OPENWORLD_ENEMY_CREATE_DIST_SQ) return
        }

        const isAlreadyHere = enemiez.find(enem => enem._id === enemTcpInfo._id)
        if (isAlreadyHere) return

        const enemyMesh = sceneDet.scene.getMeshByName(`enemy.${enemTcpInfo._id}`)
        if(enemyMesh) return

        const enemy = createEnemy(scene, enemTcpInfo)
        if(enemy) pushEnemyOnScene(enemy)
    })
    console.log("currentPlace.placeId: ", characterState.currentPlace.placeId)
    if(characterState.currentPlace.placeId === 9){
        console.log("You are inside currentPlaceId: 9, available quests: ", allQuests)

        allQuests.length && allQuests.forEach(quest => createQuestPlaneMesh(quest, sceneDet.scene))
    }
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

    console.log(`${ownerId} placeId: ${currentPlaceId} died`)
    player.anims.forEach(anim => {
        anim.weight = 0
        anim.stop()
        console.log(anim.name)
        if(anim.name === "death") anim.play()
    })
    player.characterAnimations.playAction(player.anims, "death", 1, null, true)
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
// same dedup-on-push guard pushPlayer above already has - reCreateMeshesInScene
// already checks enemiez/getMeshByName before ever calling createEnemy, and
// createEnemy itself now refuses to build a second mesh for an _id that
// already exists in the scene (see its own comment), but this is the third
// and cheapest layer: even if a future caller somehow got a real (non-null)
// enemy object back for an _id already sitting in enemiez, this stops it
// from ending up in the array twice.
export function pushEnemyOnScene(newEnemy){
    const isAlreadyHere = enemiez.find(enem => enem._id === newEnemy._id)
    if(isAlreadyHere) return
    enemiez.push(newEnemy)
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

    // remove this owner from the enemy target
    enemiez.forEach(enem => {
        if(enem._targetId === ownerId){
            enem._targetId = null;
            enem._attacking = false
        }
    })

    const { scene } = getSceneDet()
    const bodyOfPlayer = scene.getMeshByName(`player.${ownerId}`)
    if (bodyOfPlayer) bodyOfPlayer.dispose()
}
export function setPlayerMode(ownerId, _newMode, weaponName){
    const player = playersOnScene.find(pl => pl.owner === ownerId)
    if(!player) return;
    const prevMode = player.mode
    if(_newMode === "minning" && player.hasWeapon) player.equipSword(weaponName, true)
    console.log(prevMode)
    console.log(_newMode)
    console.log(player)
    if(prevMode === "idle" && _newMode === "fighting"){
        
        // first also think how you can get the character if equiping a weapon
        // the animation of idle to fight will depend if it is wearing weapon
        // if(player.hasWeapon && weaponName){
        if(weaponName){
            player.characterAnimations.playAction(player.anims, "act_idletoready1", 1, null, false, ANIM_STATE.COMBAT_IDLE)
            setTimeout(() => {
                console.log("equiping ", weaponName)
                player.equipSword(weaponName, true)
            }, 400)
        }
    }
    if(prevMode === "fighting" && _newMode === "idle"){
        if(weaponName){
            player.characterAnimations.playAction(player.anims, "act_readytoidle", 1, null, false, ANIM_STATE.IDLE)
            setTimeout(() => {
                console.log("equiping ", weaponName)
                player.equipSword(weaponName, false)
            }, 300)
        }
    }
    
    player.mode = _newMode
}


// npc
export function pushNpc(npcMeshDetail) {
    const theNpc = npcz.find(npc => npc.det?._id === npcMeshDetail.det?._id)
    if (theNpc) return
    npcz.push(npcMeshDetail)
}
export function resetNpcArray() {
    npcz = []
}
export function getNpcOnScene() {
    return npcz;
}