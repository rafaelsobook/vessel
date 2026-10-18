import { setWorldWeather } from "../components/weatherSystem.js";
import { showHitmark } from "../effects/hitmarks.js"
import { setDayNightState } from "../components/dayNightSystem.js";
import { deductHp, getCharState, getTotalDefense } from "../charactersystem/characterstate"
import { createCharacter, capsuleHeight } from "../charactersystem/createcharacter"
import { getGameStatus, getSceneDet } from "../main/main"
import { findPlaceMetaData } from "../states/placestates"
import { attachCam, camShake } from "../tools/camera"
import { getSpawnPos } from "../tools/position"
import { Vector3, Mesh, MeshBuilder, ActionManager, ExecuteCodeAction, Quaternion, Sound } from "@babylonjs/core"
import { createTransparentMat } from "../tools/materials"
import { createTextMesh } from "../gui/textmesh"
import { showGuildQuest, questToItem } from "../charactersystem/guildQuest"
import { playAnim, ANIM_STATE, playBlockingLoop } from "../tools/animation"
import { getAllSounds } from "../components/soundSystem"
import { removeRenderObservable, addRenderObservable } from "./renderer"
import { stopAnim } from "../tools/tools"
import { poppingTextMesh } from "../tools/GUITools"
import { attack, activateSkill } from "../charactersystem/attackingSystem"
import createEnemy, { enemyIsHit, applyEnemyBind, removeEnemyBind, applyEnemyCurse, enemyDispose, startEnemyEating, startEnemyRoar } from "../enemies/createEnemy"
import { randBetween } from "../tools/random"
import { emitEnemyIsHit } from "./emits"
import { castEnemySkill } from "../creations/skillEffects.js"
import { SKILLS_BY_NAME } from "../staticRecources/skillsData.js"
import { obtain } from "../charactersystem/inventory"
import { popStatusEffect, openClosePopup } from "../tools/popupUI"
import { receiveWorldChatMessage, appendSystemMessage, sendWorldMessage } from "../components/worldChatSystem"
import { OPENWORLD_PLACE_ID } from "../constants/constants.js"
import { openworldGroundY } from '../tools/groundHeight.js'
import { createMagicCircle } from "../creations/magiccircles.js"
import { createTreasureMesh } from "../assetcreation/createtreasure.js"
import { createBonfireMesh } from "../assetcreation/createbonfire.js"
import { createTrunkMesh } from "../assetcreation/createtrunk.js"
import { placeStructure } from "../assetcreation/createstructure.js"
import { createGrainMesh, removeGrainMesh } from "../assetcreation/creategrain.js"
import { createMushroomMesh, removeMushroomMesh } from "../assetcreation/createmushroom.js"
import { onPlayerSat, onPlayerStood, onSitRejected, applyRosterSeat, syncSeatOccupancy, releaseSeatOf } from "../charactersystem/seating.js"
import { spawnProjectile } from "../creations/skills.js"
import { createGroundWeapon, createEnemyStuckWeapon } from "../assetcreation/creategroundweapon.js"
import { refreshPlayerListIfOpen } from "../components/playerListUI"
// From TCPs
let allPlayersFromTCP = []
let allEnemiez = []
let allQuests = []
let tcpTreasures = []
let tcpBonfires = []
// campcraft.js's "treelog" craft - same permanence/sync model as
// tcpBonfires right above, just for trunk.glb placements
let tcpTrunks = []
// campcraft.js's other structures (tent, spikes... - assetcreation/
// createstructure.js), all in one list with their kind. createstructure.js
// dedupes by craftId per scene itself, so no ...InScene list alongside.
let tcpStructures = []
// tcp/recources/grains.ts - seeded, pickup-able like tcpTreasures. No
// grainsInScene array alongside it: creategrain.js dedupes by grainId in its
// own per-scene Map, which also resets itself on every scene change
let tcpGrains = []
// tcp/recources/mushroomsInDungeon.ts - same model as tcpGrains right above
// (createmushroom.js dedupes by mushroomId in its own per-scene Map)
let tcpMushrooms = []
// weapons struck into the ground or an enemy body at runtime (see
// itemInfoSystem.js's struckItemFunc, creations/skills.js's spawnProjectile
// env-hit/enemy-hit cases) - server-tracked (tcp/index.ts's struckWeapons),
// same permanence/removal model as tcpTreasures below (pickup-able,
// filtered out on "struck-weapon-removed"), just player-created at runtime
// like tcpBonfires instead of seeded.
let tcpStruckWeapons = []

// In Client
let playersOnScene = []
let enemiez = []
let npcz = []
let projectilesOnScene = []
let questsOnScene = []

let wagonsOnScene = []
// { itemId } entries only - createTreasureMesh already tracks its own
// mesh/interact state internally, this just needs enough to know which
// tcpTreasures ids already have a chest spawned (reCreateMeshesInScene's
// own isAlreadyHere check, same idea as enemiez) and to drop an entry once
// "treasure-removed" comes in for it
let treasuresInScene = []
// { craftId } entries - same idea as treasuresInScene above, but bonfires
// are never removed once placed (no "bonfire-removed" counterpart to
// treasure-removed), so this only ever grows, never gets spliced
let bonfiresInScene = []
// { craftId } entries - same idea as bonfiresInScene right above, for
// campcraft.js's "treelog" craft
let trunksInScene = []
// { itemId } entries - same idea as treasuresInScene, dropped once
// "struck-weapon-removed" comes in for it
let struckWeaponsInScene = []
// npcFighter duel opponents (npc/duelSystem.js) - purely local combat, never
// server-tracked (duels are always isMultiplayer:false). Mirrors enemiez so
// creations/skillEffects.js's hit-registration sites can target duel
// opponents with player skills the same way they already target real enemies
let duelOpponentsOnScene = []

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
// "enemy-attacked"'s own weaponBlocking check below - a hit under this
// deals so little it reads as deflected rather than a real wound, so it
// gets the same weaponblockS-instead-of-blood treatment as an actual block
const LOW_DAMAGE_NO_BLOOD_THRESHOLD = 10
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
const OPENWORLD_ENEMY_RECHECK_INTERVAL_MS = 1000
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
    lesserDemonRoot: null,
    deerRoot: null,
    ghostRoot: null,
    giantScorpionRoot: null,
    wolfroot: null,
    standingWolfRoot: null,
    wagonRoot: null,
    wagonWheelFrontRoot: null,
    wagonWheelRearRoot: null,
    wagonBodyColliderRoot: null
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
    wagonsOnScene = []
    // createQuestPlaneMesh dedupes against this by questId - the meshes it
    // tracks get destroyed along with the rest of the old scene on every
    // transition (changeScene() disposes the whole scene), but without
    // clearing this too the stale questId entries survive and make
    // createQuestPlaneMesh silently skip re-creating them next time you're
    // back in a quest-board place
    questsOnScene = []
    duelOpponentsOnScene = []
    // unlike treasuresInScene/bonfiresInScene above (never reset here - a
    // pre-existing gap for those, not something copied on purpose), a
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
        projectileModels: null,

        goblinRoot: null,
        monolithRoot: null,
        slimeRoot: null,
        lesserDemonRoot: null,
        deerRoot: null,
        ghostRoot: null,
        giantScorpionRoot: null,
        wolfroot: null,
        standingWolfRoot: null,
        wagonRoot: null,
        wagonWheelFrontRoot: null,
        wagonWheelRearRoot: null,
        wagonBodyColliderRoot: null
    }
}
export function setSocketContainers(newContainers){
    containers = newContainers
}
export function getSocketContainers(){ 
    return containers
}

export function getWagonsOnScene(){
    return wagonsOnScene;
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
export function getDuelOpponentsOnScene(){
    return duelOpponentsOnScene
}
export function pushDuelOpponentOnScene(opp){
    duelOpponentsOnScene.push(opp)
}
export function removeDuelOpponentOnScene(body){
    duelOpponentsOnScene = duelOpponentsOnScene.filter(o => o.body !== body)
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
    // tcp's weather clock (recources/weather.ts) - one weather for the whole
    // world, so there's no placeId to filter on here. Every client records it;
    // weatherSystem.js decides whether THIS player's current place actually
    // shows it and whether they feel the temperature.
    socket.on("weather-changed", data => {
        if(!data?.weather) return
        setWorldWeather(data.weather)
    })

    // tcp's world clock (recources/dayNight.ts) - periodic resync; this client
    // advances the time itself in between (dayNightSystem.js)
    socket.on("daynight-sync", setDayNightState)

    socket.on("worldChatMessage", data => {
        if (!isSocketOn) return
        // tcp announces server-side events on this same channel with
        // msgType:"system" and no sender name (currently only a bot rolling
        // the legendary black Knight's Scale on level-up). Those read as full
        // sentences, so they render like the "player-death" line further
        // down instead of through appendChatMessage, which always prefixes
        // `${name}: ` and would leave a stray leading ": ".
        if(data?.msgType === "system") return appendSystemMessage(data.message)
        receiveWorldChatMessage(data)
    })

    socket.on("userJoined", allDataFromServer => {
        if (!isSocketOn) return
        const { currentPlaceId, newPlayerName, isBot, players, placesMD, tcpEnemies, quests, treasures, bonfires, trunks, structures, grains, mushrooms, struckWeapons, weather, dayNight } = allDataFromServer
        // world clock rides on every snapshot too, same reasoning as weather below
        if(dayNight) setDayNightState(dayNight)
        // weather rides on every snapshot, not just its own "weather-changed"
        // broadcast - this handler also fires on every PLACE CHANGE, so a
        // player walking out of a dungeon into a blizzard gets the current sky
        // immediately instead of standing in clear weather until tcp's next
        // roll. Applied before the place-match guard below, since world
        // weather is global and this client needs it recorded even while it's
        // somewhere the weather isn't drawn.
        if(weather?.weather) setWorldWeather(weather.weather)
        // isBot:true only ever rides on tcp/index.ts's own bot-spawn
        // broadcast (recources/npcBrain.ts's Brain), never a real player's
        // own join-world (which fires on every PLACE CHANGE too, not just
        // first login - announcing THOSE would spam "X has joined" every
        // time any real player walks through a door). World chat is global
        // (see worldsocket.js's own "player-death" handler comment) - this
        // runs before the currentPlaceId/place-match guard below on
        // purpose, so every connected client sees it regardless of which
        // place they're currently in, same as a death announcement does.
        // players already has this bot's full entry (tcp just pushed it
        // server-side before broadcasting) - looked up by name since this
        // payload only ever sends the bare newPlayerName, not an owner id,
        // alongside it. Name lookup is safe/unique here the same way
        // pickBotName's own retry-for-uniqueness (tcp/index.ts) and a real
        // player's own name-uniqueness check at creation already guarantee.
        if(isBot && newPlayerName){
            const newBot = players.find(pl => pl.name === newPlayerName)
            if(newBot) sendWorldMessage(newBot)
        }
        allPlayersFromTCP = players
        syncSeatOccupancy(players)
        allEnemiez = tcpEnemies
        allQuests = quests
        tcpTreasures = treasures ?? []
        tcpBonfires = bonfires ?? []
        tcpTrunks = trunks ?? []
        tcpStructures = structures ?? []
        tcpGrains = grains ?? []
        tcpMushrooms = mushrooms ?? []
        tcpStruckWeapons = struckWeapons ?? []
        
        const characterState = getCharState()
        const gameStat = getGameStatus()
        if (gameStat === "loading") return
        if(currentPlaceId !== characterState.currentPlace.placeId) return
        if (socket === undefined) return console.warn("socket UNDEFINED !")

        if (!characterState) return 

        if (gameStat === "running") {
            reCreateMeshesInScene()
            refreshPlayerListIfOpen()
        }
    })
    // equiping
    socket.on("equiped-item", data => {
        if (!isSocketOn) return
        const charState = getCharState()
        const {ownerId, itemName, itemModelStyle, itemModelName, itemType, currentPlaceId, metalColor, weaponType, hairVisible} = data
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
        if(itemType === "helmet") theEquipingPlayer.equipHelmet(itemModelName, metalColor, itemName, hairVisible)
        if(itemType === "gauntlet") theEquipingPlayer.equipGauntlet(itemName, metalColor)
        if(itemType === "pauldron") theEquipingPlayer.equipPauldron(itemName, metalColor)
        if(itemType === "belt") theEquipingPlayer.equipBelt(itemModelStyle, itemName)

        // if (itemType === "weapon") theEquipingPlayer.equipSword(swordRoot, itemName, theEquipingPlayer._attacking, data.isHide)
        // if (itemType === "helmet") theEquipingPlayer.equipHelmet(helmRoot, itemName)


        // if (itemType === "armor") theEquipingPlayer.equipArmor(armorRoot, itemName)
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
        // casterStats (skillsui.js's own activate-skill emit) rides along
        // here too - this handler fires identically on EVERY connected
        // client, caster included, so activateSkill needs to know the
        // actual caster's stats rather than assuming "me". See
        // activateSkill's own comment for why this matters.
        // aura - flexaura only, how strong the caster's aura looks (effects/auraProfile.js)
        const { ownerId, skill, currentPlaceId, casterStats, aura, dirYaw, weaponName, parts, weaponType, metalColor, debugTargetId, debugTargetPos } = data
        const charState = getCharState()
        if (!charState) return
        if (charState.currentPlace.placeId !== currentPlaceId) return

        // dirYaw (tcp/index.ts's own dealDamage callback, bot casters only -
        // a real player's own skillsui.js click never sends this, so this is
        // a no-op for every real cast) - re-faces the caster ONE more time,
        // synchronously, in this exact handler, immediately before
        // activateSkill reads the body's CURRENT rotation to aim the cast
        // (computeCastOrigin, creations/skillEffects.js). A plain angle, not
        // a dirTarg point - see "bot-moving"/"bot-stopped"'s own header
        // comment above for why a point silently breaks once this bot's
        // client-rendered position has drifted from what the server
        // believes it is (confirmed via live matching server/client
        // console logs - a lookAt(point) computed from THIS body's own
        // drifted position produced a badly wrong angle even though the
        // server's own reported point was correct).
        if(typeof dirYaw === "number"){
            const player = playersOnScene.find(pl => pl.owner === ownerId)
            if(player?.body){
                if(data.botTcpPos){
                    // console.log(data.botTcpPos)
                    player.body.position.x = data.botTcpPos.x
                    player.body.position.z = data.botTcpPos.z
                    // openworld terrain-follow (same sampleTerrainSurfaceHeight()
                    // correction renderer.js's own per-frame bot-stepping loop
                    // applies) - without this, the snap above moves x/z to
                    // wherever the bot actually is server-side, but leaves y
                    // sitting at whatever it was BEFORE the snap (last frame's
                    // correction, computed for the OLD x/z). On flat ground
                    // (village) that's still numerically correct everywhere, so
                    // it never showed - but openworld's uneven terrain means the
                    // old y can be very wrong for the new spot. This runs
                    // synchronously, right before computeCastOrigin
                    // (skillEffects.js) reads player.rHand's absolute position
                    // to place the magic circle - without correcting y here
                    // first, the circle spawns using that stale height instead
                    // of waiting for the next render frame's own correction.
                    if(player.currentPlaceId === OPENWORLD_PLACE_ID){
                        player.body.position.y = openworldGroundY(player.body.position.x, player.body.position.z) + capsuleHeight / 2 + 0.05
                    }
                }

                player.body.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), dirYaw)

                // re-parents the caster's own weapon (a staff) onto rHand -
                // createcharacter.js only ever equips a weapon onto rHand
                // if mode==="fighting" AT CREATION TIME (see "bot-dashing"'s
                // own identical comment for the full reasoning); a caster
                // bot's mode is "casting", never "fighting", so without
                // this its staff would stay sheathed on its back forever,
                // never actually held while casting
                if(weaponName) player.equipSword(weaponName, true, parts, weaponType, metalColor)

                // debug only - matches tcp/index.ts's own [botAim] log
                // (same debugTargetId/debugTargetPos, sent verbatim in this
                // same payload) so the two can be diffed side by side to
                // confirm the fix - forward should now point from THIS
                // body's own position toward targetPos, not off at
                // whatever angle the old drift-sensitive lookAt(point)
                // produced.
                const forward = Vector3.TransformNormal(new Vector3(0, 0, 1), player.body.getWorldMatrix()).normalize()
                // console.log(`[clientBotAim] ${ownerId} bodyPos=(${player.body.position.x.toFixed(2)},${player.body.position.z.toFixed(2)}) dirYaw=${dirYaw.toFixed(3)} forward=(${forward.x.toFixed(2)},${forward.z.toFixed(2)}) target=${debugTargetId} targetPos=(${debugTargetPos?.x?.toFixed(2)},${debugTargetPos?.z?.toFixed(2)})`)
            }
        }

        activateSkill(ownerId, skill, casterStats, aura)
    })
    socket.on("player-attacked", data => {
        if (!isSocketOn) return
        // my own swing - uimanagement.js already played it the moment I
        // pressed attack; tcp's io.emit echoes it back to me as well
        if (data.owner === getCharState()?.owner) return
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
        
        // One attack is one swing - or, for an enemy whose det.attackCombo
        // lists several (the standing werewolves' attack1 then attack2, tcp
        // genenemy.ts), those swings back to back. The attack's damage is
        // split evenly across them, each share landing as its swing starts,
        // so a combo hurts no more in total than a single swing did. Bleed
        // and the other effects ride on the first swing only, same odds as
        // before. (deductHp takes the victim's defense off EVERY call, so
        // the shares are worked out on the victim's client from what's left
        // after defense - see landEnemyHit - not by halving the raw number,
        // which would have taken defense off twice.)
        const enemy = theEnemyToAttack
        const swings = enemy.det?.attackCombo?.length ? enemy.det.attackCombo : [data.attackAnimName]
        const clips = swings.map(name => enemy.anims.find(a => a.name.toLowerCase() === name.toLowerCase()))
        const clipMs = clip => clip
            ? (clip.to - clip.from) / (clip.targetedAnimations[0]?.animation.framePerSecond || 60) * 1000
            : 0
        // the whole combo has to be over before this enemy's next attack
        // (createEnemy.js schedules one every atkSpd * 900 ms) - a quick
        // attacker plays it a little faster rather than cut into it
        const comboMs = clips.reduce((sum, clip) => sum + clipMs(clip), 0)
        const speed = swings.length > 1 ? Math.max(1, comboMs / (data.atkSpd * 900 * 0.95)) : 1
        // a new attack cancels what's left of the last one's combo
        const comboId = enemy._comboId = (enemy._comboId ?? 0) + 1

        const swing = i => {
            if(enemy._comboId !== comboId || !enemiez.includes(enemy) || enemy.body.isDisposed()) return
            // a follow-up swing: not if it's already turned to chasing, and
            // it only lands on a victim still within reach (createEnemy.js's
            // own attack range) - otherwise it's a swing at the air
            let lands = true
            if(i > 0){
                if(enemy._isMoving) return
                const victim = playersOnScene.find(pl => pl.owner === targetId)
                if(!victim?.body) return
                const dx = victim.body.position.x - enemy.body.position.x
                const dz = victim.body.position.z - enemy.body.position.z
                lands = Math.hypot(dx, dz) <= enemy.det.maxDistance + 1.3
                if(lands) enemy.body.lookAt(new Vector3(victim.body.position.x, enemy.body.position.y, victim.body.position.z), 0, 0, 0)
            }
            if(clips[i]) clips[i].speedRatio = speed
            playAnim(enemy.anims, swings[i])
            enemy.attackSound?.play()
            if(lands) landEnemyHit(enemy, swings.length, i === 0 ? data.effects : [], swings[i])
            if(i + 1 < swings.length) setTimeout(() => swing(i + 1), clipMs(clips[i]) / speed)
        }

        // one swing connecting with the victim - everyone watching sees it,
        // only the victim's own client takes the damage
        // shares: how many swings this attack's damage is split across;
        // swingAnim: the clip this swing plays
        const landEnemyHit = (enemy, shares, effects, swingAnim) => {
            const victimPlayer = playersOnScene.find(victim => victim.owner === targetId)
            if(!victimPlayer) return
            // weaponBlocking (createcharacter.js/inputMovement.js's own r-click
            // hold-to-block, duelSystem.js's applyDamageToOpponent for the
            // reverse direction) - a blocking victim gets NO blood and no hit
            // reaction, just the block sound instead. Read off victimPlayer
            // itself (playersOnScene's own createCharacter() rig, kept in sync
            // multiplayer-wide by emits.js's emitWeaponBlock/worldsocket.js's
            // own "emitted-weaponblock" handler above), not charState - so
            // EVERY client watching this fight sees the same outcome, not just
            // the victim's own client.
            //
            // data.dmg < LOW_DAMAGE_NO_BLOOD_THRESHOLD - a hit this weak reads as
            // deflected/absorbed rather than a real wound, same visual
            // treatment as an actual block (weaponblockS, no blood), just
            // triggered by the damage number instead of the player's own
            // blocking state. Unconditional/everyone-sees-it, same reasoning as
            // weaponBlocking right above - this is armor/toughness reading as
            // "shrugged off", not something only the victim's own client knows.
            // (the whole attack's damage - a combo's swings bleed as much as the one swing did)
            // if(victimPlayer.weaponBlocking || data.dmg < LOW_DAMAGE_NO_BLOOD_THRESHOLD){
            if(victimPlayer.weaponBlocking){
                getAllSounds().weaponblockS?.play()
            } else {
                // bloodps (createcharacter.js's createBloodSplatter, emitter
                // parented to spineBone) - the same one-shot play() call
                // skillEffects.js's own stickBriefly hit reaction and
                // duelSystem.js's melee hits use. Unconditional (not gated to
                // the victim's own client like the deductHp block below) -
                // purely visual, everyone watching should see it land
                victimPlayer.bloodps?.play()
                // and if this swing leaves a mark (det.hitmarks - the
                // werewolves' claw rake on attack2), it shows on the victim -
                // in the world, so everyone watching sees it (effects/hitmarks.js)
                const mark = enemy.det?.hitmarks?.find(h => h.attackType === "normal" && h.animationName?.toLowerCase() === swingAnim?.toLowerCase())
                if(mark) showHitmark(enemy.body.getScene(), mark.hitmarkTexture, victimPlayer.body)
            }
            if (victimPlayer.owner !== charState.owner || victimPlayer.weaponBlocking) return
            // this swing's raw share: deductHp takes defense off it, leaving
            // 1/shares of what the single swing would have dealt after defense
            const defense = getTotalDefense()
            const dmg = (data.dmg + defense * (shares - 1)) / shares
            setTimeout( async () => {
                const shakeScene = getSceneDet().scene
                if(shakeScene) camShake(shakeScene, shakeScene.activeCamera, .01, true)

                // dark magic's curse (see skillsData.js's header comment,
                // skillEffects.js's hit handler) - a cursed enemy's own
                // attack damage returns to its own hp instead of hurting
                // the victim, every single time it attacks, for the rest of
                // its life. Gated the same way deductHp below already is
                // (only the victim's own client acts on it) so this doesn't
                // fire once per client watching the fight and multi-apply
                // the self-damage.
                if(enemy._cursed){
                    emitEnemyIsHit({
                        playerId: charState.owner,
                        dmgDetails: { physicalDmg: dmg, weaponDmg: 0 },
                        targetId: enemy._id,
                        currentPlaceId: charState.currentPlace.placeId,
                    })
                    return
                }

                // a death reports itself (characterstate.js's die)
                await deductHp(dmg, effects)
            }, data.atkSpd / 5)
        }

        swing(0)
    })
    // OPEN PVP - tcp/index.ts's own "playerIsHit" handler relays this the
    // moment ANY player's own atkCollider exit trigger (createcharacter.js's
    // new one, mirroring createEnemy.js's identical mechanism) lands on
    // another player's or bot's body. Same blood/block-sound-then-
    // self-deductHp shape as "enemy-attacked" above, just without that
    // handler's own enemy-side animation/lookAt (the ATTACKER's own swing
    // animation already plays through the existing separate
    // "player-attacked" relay regardless of whether it actually hit anyone)
    // or its setTimeout(atkSpd/5) sync delay (that exists to line the hit up
    // with an enemy's OWN attack animation playing out over time - this
    // event only ever fires from the exit trigger already firing right as
    // the swing visually connects, so applying it immediately is already
    // in sync).
    //
    // A bot victim has no real client of its own to ever satisfy the
    // "owner === charState.owner" check below (nor even necessarily a
    // rendered body on THIS particular client's scene at all) - its hp/
    // death is already fully handled server-side (applyDamageToBot, tcp/
    // index.ts), broadcast the same "player-death" way a real death already
    // is. This handler's own job is purely: show a hit reaction to whoever's
    // actually watching it land, and apply it to MY OWN hp if I'm the one
    // who got hit.
    socket.on("player-is-hit", data => {
        if (!isSocketOn) return
        const { currentPlaceId, targetId, dmgToApply } = data
        const charState = getCharState()
        if (getGameStatus() === "loading") return
        if (currentPlaceId !== charState.currentPlace.placeId) return
        const victimPlayer = playersOnScene.find(pl => pl.owner === targetId)
        if (!victimPlayer) return

        if(victimPlayer.weaponBlocking || dmgToApply < LOW_DAMAGE_NO_BLOOD_THRESHOLD){
            getAllSounds().weaponblockS?.play()
        } else {
            victimPlayer.bloodps?.play()
        }

        if (victimPlayer.owner === charState.owner && !victimPlayer.weaponBlocking) {
            camShake(getSceneDet().scene, getSceneDet().scene.activeCamera, .01, true)
            // no effects array yet - effectsWhenHit (a weapon's own on-hit
            // status, e.g. burn) rides along in `data` the same inert way
            // it already does for a real enemy target (see npcDetails.js's
            // own comment: "nothing currently reads a WEAPON item's own
            // effectsWhenHit on a melee swing" - not a gap unique to PvP)
            // a death reports itself (characterstate.js's die)
            deductHp(dmgToApply, [])
        }
    })
    // SERVANTS - tcp/index.ts's own "recruit-bot"/"dismiss-bot" handlers
    // both broadcast this regardless of who asked or whether it actually
    // changed anything - every connected client (not just whoever clicked
    // the prompt) needs its own local copy of this bot's det.servantOfOwnerId
    // kept current, since npc/botInteraction.js's own choice list reads it
    // fresh off `det` every time the interact button is clicked to decide
    // "invite" vs "dismiss" vs "already someone else's". Mutated in place on
    // the existing det object (not replaced) so botInteraction.js's own
    // closure over that same object sees the update with no extra wiring.
    socket.on("bot-servant-updated", data => {
        if (!isSocketOn) return
        const { botOwnerId, servantOfOwnerId } = data
        const bot = playersOnScene.find(pl => pl.owner === botOwnerId)
        if(!bot) return
        bot.det.servantOfOwnerId = servantOfOwnerId
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
                    // a death reports itself (characterstate.js's die) - this
                    // used to test deductHp's promise itself, always truthy,
                    // so every ranged hit told tcp the player had died
                    deductHp(dmg, effects)
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
                    // captured BEFORE overwriting below - createEnemy.js's
                    // own initAttack() (the thing that actually starts the
                    // repeating attack() interval) is ONLY ever called from
                    // one place: onIntersecEnterTrig(atkDetection,
                    // myChar.body, ...), hardcoded to the LOCAL real
                    // player's own body. A bot has no client of its own to
                    // ever trigger that, so an enemy whose target is a bot
                    // would otherwise sit there marked as targeting it
                    // forever, never actually swinging (confirmed - "the
                    // deers are not attacking them"). This only fires once
                    // per enemy (tcp/index.ts's own registerTargetIfNone
                    // never re-registers once _targetId is already set, so
                    // !enem._targetId here can only be true on this
                    // enemy's very first acquisition). Real-player
                    // registrations are untouched (gated on the bot_
                    // prefix) - their own atkDetection trigger already
                    // calls initAttack() directly, synchronously, before
                    // this broadcast even round-trips back; calling
                    // resumeAttack() again here would just restart their
                    // attack cadence for no reason.
                    const justAcquiredBotTarget = !enem._targetId && typeof enemDetail._targetId === "string" && enemDetail._targetId.startsWith("bot_")
                    // it just noticed someone (nobody before, someone now) -
                    // a rig with a roar clip roars at them first
                    // (createEnemy.js's startEnemyRoar). Here, not on the
                    // detecting client alone, so everyone watching sees it.
                    const justAcquiredTarget = !enem._targetId && !!enemDetail._targetId

                    enem._targetId = enemDetail._targetId
                    enem._dirTarg = enemDetail._dirTarg
                    // enem._isMoving = enemDetail._isMoving
                    enem._attacking = enemDetail._attacking

                    if(justAcquiredTarget) startEnemyRoar(enem)

                    if(justAcquiredBotTarget){
                        enem.resumeAttack?.()
                        // _isMoving is the ONLY gate on renderer.js's own
                        // chase-movement branch (en._isMoving && en._targetId
                        // && en.det.actionType==="chasing") - the SAME branch
                        // that both walks the enemy toward its target AND
                        // periodically reports its own live position back to
                        // tcp (emitEnemyChasePosition). Never true here
                        // before, so a bot-targeted enemy just stood frozen
                        // at whatever position it last had - it never
                        // physically moved, so tcpEnemies' own x/z (and
                        // therefore any dirYaw a bot computes off it) never
                        // updated even while the real enemy should have been
                        // closing in. Only ever set true otherwise via a
                        // real player's own atkDetection EXIT trigger
                        // ("enemyWillChase") - a bot has no such trigger to
                        // ever fire it, same reasoning resumeAttack's own
                        // comment gives for the attack loop.
                        enem._isMoving = true
                    }

                    // the flip side of the same problem - tcp/index.ts's own
                    // death-handling (both "will-die" for a real player and
                    // the bot-death branch in "enemyWillAttack") resets
                    // _isMoving/_targetId on tcpEnemies the instant this
                    // enemy's target dies, but that reset used to never
                    // reach any already-connected client at all. Without
                    // this, an enemy that just killed its target kept
                    // _isMoving stuck at whatever it was BEFORE the kill -
                    // renderer.js's own chase branch gates purely on that
                    // flag, not on whether its target lookup still resolves
                    // to anything, so it kept replaying the running
                    // animation forever even though the actual translate/
                    // lookAt beneath it had already gone silently inert
                    // (its target vanished from playersOnScene). Confirmed
                    // from an actual report: a deer that had just killed a
                    // bot stayed "running" in place, never moving again.
                    if(!enemDetail._targetId) enem._isMoving = false
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
    // enemy eating (same tcp/index.ts interval as enemy-wander above) -
    // holds still and plays its "eating" clip, or "idle" for a rig without
    // one (see createEnemy.js's startEnemyEating). The server already never
    // sends this for an enemy with a target - the _targetId/_isMoving guard
    // here just covers this client being a beat ahead of the server on a
    // fresh aggro or chase.
    socket.on("enemy-eating", data => {
        if (!isSocketOn) return
        const charState = getCharState()
        if (getGameStatus() === "loading") return
        if (!charState || data.currentPlaceId !== charState.currentPlace.placeId) return
        const enemy = enemiez.find(enem => enem._id === data._id)
        if (!enemy || enemy.isDead) return
        if (enemy._targetId || enemy._isMoving) return
        startEnemyEating(enemy, data.duration)
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
    // lesserdemon's own "teleport in near you instead of chasing" (see
    // genenemy.ts's lesserDemonBase, actionType "teleporting", and
    // createEnemy.js's own teleport interval) - just snaps x/z straight to
    // the landing spot tcp/index.ts already stamped onto this enemy's own
    // record. Y is recomputed here too (openworld only) for a clean instant
    // landing instead of waiting on createEnemy.js's own 500ms yCheckInterval
    // to catch up - that interval still exists as the fallback/ongoing
    // corrector, this is just the one-frame head start.
    // tcp/index.ts's werewolf hunts - I went far enough out that a standing
    // wolf is coming for me. It's brought in out of sight, too far off for
    // its own roar to carry, so the warning and a distant roar come here.
    socket.on("being-hunted", ({ name }) => {
        if (!isSocketOn) return
        openClosePopup(`${name} is hunting you`, true, 3500)
        const huntScene = getSceneDet()?.scene
        if (!huntScene) return
        const roar = new Sound("huntRoar", "./sounds/monsters/standingwolf/roar.mp3", huntScene, () => roar.play(), { volume: 0.5 })
        roar.onEndedObservable.add(() => roar.dispose())
    })
    socket.on("enemy-teleported", data => {
        if (!isSocketOn) return
        const charState = getCharState()
        if (getGameStatus() === "loading") return
        if (!charState || data.currentPlaceId !== charState.currentPlace.placeId) return
        const enemy = enemiez.find(enem => enem._id === data._id)
        if (!enemy || !enemy.body) return

        enemy.body.position.x = data.x
        enemy.body.position.z = data.z
        if(enemy.det.currentPlaceId === OPENWORLD_PLACE_ID){
            enemy.body.position.y = openworldGroundY(data.x, data.z) + enemy.det.bodyHeight / 2 + 0.05
        }
    })
    // MAGIC CIRCLES (see emits.js's emitSpawnCircle) - purely visual sync,
    // no server state to touch (tcp/index.ts's own comment on the
    // "spawncirc" relay). Was never actually listened for client-side
    // before this - every existing caller (localroomdb.js's shrine
    // circles, createEnemy.js's own lesserdemon teleport telegraph) only
    // ever showed up on the CASTER's own screen. socket.broadcast.emit on
    // the server side (not io.emit) means this never fires for the client
    // that emitted it in the first place - they already spawned their own
    // local copy, same "I already applied it locally" pattern
    // correctEnemyY's own listener uses. createMagicCircle (not
    // spawnMagicCircle) - that one hardcodes y:0, fine for a flat village/
    // room floor but wrong on openworld's uneven terrain; createMagicCircle
    // actually respects data.pos.y.
    socket.on("circle-spawned", data => {
        if (!isSocketOn) return
        const charState = getCharState()
        if (getGameStatus() === "loading") return
        if (!charState || data.placeId !== charState.currentPlace.placeId) return
        createMagicCircle(new Vector3(data.pos.x, data.pos.y, data.pos.z), scene, `apt_${data.element}`, 0.8, 4000)
    })
    // SPEAR THROW - same shape as "circle-spawned" right above: tcp's own
    // "throwspear" handler relays via socket.broadcast.emit (not io.emit),
    // so this never fires for the thrower's own client - they already
    // spawned their own local copy (uimanagement.js's throwSpearProjectile).
    // No damage/hit-detection here, same as that local spawn - purely the
    // visual so everyone else actually sees the spear fly too.
    socket.on("spear-thrown", data => {
        if (!isSocketOn) return
        const charState = getCharState()
        if (getGameStatus() === "loading") return
        if (!charState || data.placeId !== charState.currentPlace.placeId) return
        spawnProjectile(data.spawnPos, data.targetPos, null, scene, data.parts, null, false, null, false, "spear")
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
            // console.log("enemyDiedHere ", enemyDiedHere._id)
            enemyDiedHere.targetId = false
            enemiez = enemiez.filter(enmy => enmy._id !== enemyId)
            allEnemiez = allEnemiez.filter(enmy => enmy._id !== enemyId)
         
            // disposal after a 2s delay.
            enemyDispose(enemyDiedHere)
        }

        // separate catch from the enemiez check above - a mesh can exist
        // in the SCENE without a matching enemiez entry (e.g. it was
        // already filtered out of enemiez by an earlier pass but the mesh
        // itself never got disposed for some other reason) - (false, true)
        // also frees its material/texture, same convention every other
        // dispose call in this codebase follows now, not just the mesh
        const enemyBodyHere = getSceneDet().scene.getMeshByName(`enemy.${enemyId}`)
        if (enemyBodyHere) {
            // console.log("enemyBodyHere ", enemyBodyHere.name)
            enemyBodyHere.dispose(false, true)
        }
    })
    socket.on('enemy-respawned', tcpEnemies => {
        allEnemiez = tcpEnemies

        reCreateMeshesInScene()
    })
    // mirrors "enemy-removed" right above - fires for EVERY client
    // (including whoever opened it, echoed back), not just everyone else,
    // so this has to be safe to run against a chest this same client
    // already disposed itself (createtreasure.js's own interact callback
    // already emitRemoveTreasure()'d and disposed its local mesh before
    // this round-trips back) - both the treasuresInScene filter and the
    // getMeshByName lookup below are no-ops when there's nothing left to
    // find, so a redundant call here is harmless either way
    socket.on("treasure-removed", treasureId => {
        if (!isSocketOn) return

        treasuresInScene = treasuresInScene.filter(trs => trs.itemId !== treasureId)
        tcpTreasures = tcpTreasures.filter(trs => trs.itemId !== treasureId)

        // NOT dispose(false, true) like the enemy cleanup above - treasure
        // materials are shared/cached by rarity across every chest of that
        // rarity (createtreasure.js's getMaterialByName cache), not
        // per-mesh like enemy materials are. Disposing the material here
        // would take every OTHER still-alive same-rarity chest's material
        // down with it. Just the mesh/geometry.
        const treasureBodyHere = getSceneDet().scene.getMeshByName(`treasure_${treasureId}`)
        if (treasureBodyHere) treasureBodyHere.dispose()
    })

    // tcp/index.ts's own "craft-bonfire" handler echoes this to EVERY
    // connected client, including whoever actually crafted it (bare
    // io.emit there, not socket.broadcast.emit) - reCreateMeshesInScene's
    // own tcpBonfires loop already no-ops on a craftId it's seen before
    // (bonfiresInScene / getMeshByName double-check, same shape as
    // tcpTreasures), so pushing this in and just re-running that loop
    // (same pattern "enemy-respawned" above already uses) is safe for the
    // crafter's own echo too, not just everyone else.
    socket.on("bonfire-crafted", bonfire => {
        if (!isSocketOn) return
        if (tcpBonfires.some(bf => bf.craftId === bonfire.craftId)) return
        tcpBonfires.push(bonfire)
        reCreateMeshesInScene()
    })

    // tcp/index.ts's own "craft-trunk" handler - same echo-to-everyone,
    // dedup-and-replay shape "bonfire-crafted" right above uses
    socket.on("trunk-crafted", trunk => {
        if (!isSocketOn) return
        if (tcpTrunks.some(tr => tr.craftId === trunk.craftId)) return
        tcpTrunks.push(trunk)
        reCreateMeshesInScene()
    })
    // tcp/index.ts's "craft-structure" echo - same shape as "trunk-crafted"
    socket.on("structure-crafted", structure => {
        if (!isSocketOn) return
        if (tcpStructures.some(st => st.craftId === structure.craftId)) return
        tcpStructures.push(structure)
        reCreateMeshesInScene()
    })

    // tcp/index.ts's "pickupGrain" echo - reaches every client, including the
    // one that picked it (removeGrainMesh is a no-op there, it's already gone)
    socket.on("grain-removed", grainId => {
        if (!isSocketOn) return
        tcpGrains = tcpGrains.filter(grain => grain.grainId !== grainId)
        removeGrainMesh(grainId)
    })
    // tcp/index.ts's "pickupMushroom" echo - same as "grain-removed" right above
    socket.on("mushroom-removed", mushroomId => {
        if (!isSocketOn) return
        tcpMushrooms = tcpMushrooms.filter(mushroom => mushroom.mushroomId !== mushroomId)
        removeMushroomMesh(mushroomId)
    })
    // a picked grain / mushroom grown back where it was (tcp/index.ts's
    // GRAIN_REGROW_MS / MUSHROOM_REGROW_MS) - same dedup-and-replay shape as
    // "bonfire-crafted" above
    // (one, or a list - the admin page adds many at once)
    socket.on("grain-added", added => {
        if (!isSocketOn) return
        const fresh = [].concat(added).filter(grain => grain && !tcpGrains.some(known => known.grainId === grain.grainId))
        if (!fresh.length) return
        tcpGrains.push(...fresh)
        reCreateMeshesInScene()
    })
    socket.on("mushroom-added", added => {
        if (!isSocketOn) return
        const fresh = [].concat(added).filter(mushroom => mushroom && !tcpMushrooms.some(known => known.mushroomId === mushroom.mushroomId))
        if (!fresh.length) return
        tcpMushrooms.push(...fresh)
        reCreateMeshesInScene()
    })
    // a chest put down while the game is running (tcp/admin's "treasures.place") -
    // the same dedup-and-replay shape as the two above. A chest that was
    // already there is created by reCreateMeshesInScene from userJoined's list.
    socket.on("treasure-added", added => {
        if (!isSocketOn) return
        const fresh = [].concat(added).filter(chest => chest && !tcpTreasures.some(known => known.itemId === chest.itemId))
        if (!fresh.length) return
        tcpTreasures.push(...fresh)
        reCreateMeshesInScene()
    })

    // THE MASTER CONTROL (tcp/admin) - an admin moving me, telling me something,
    // or sending me away. A player's position is their own game's to change, so
    // the server asks and this does it.
    socket.on("admin-teleport", async ({ placeId, x, y, z, lift } = {}) => {
        if (!isSocketOn) return
        const charState = getCharState()
        if (!charState || getGameStatus() === "loading") return
        const me = playersOnScene.find(pl => pl.owner === charState.owner)
        if (!me?.body) return
        const { relocatePos } = await import("../controllers/inputMovement.js")

        // stuck inside something: straight up and out
        if (lift) {
            return relocatePos(me.body, me.body.position.add(new Vector3(0, lift, 0)))
        }
        if (typeof x !== "number" || typeof z !== "number") return

        // another place: the same trip a door makes. The openworld works out the
        // ground itself when I arrive (areascene.js's settleArrival)
        if (placeId != null && placeId !== charState.currentPlace.placeId) {
            const meta = findPlaceMetaData(placeId)
            if (!meta) return openClosePopup("An admin tried to move you somewhere that doesn't exist", true, 3000)
            const { travelToPlace } = await import("../tools/travel.js")
            openClosePopup("An admin is moving you...", true, 2500)
            return travelToPlace({ placeId, name: meta.name, areaType: meta.areaType, startingPos: { x, y: y ?? 1, z } })
        }

        // the same place: feet on the floor at (x, z), dropped in from just above
        const floor = charState.currentPlace.placeId === OPENWORLD_PLACE_ID ? openworldGroundY(x, z) : (y ?? 0)
        relocatePos(me.body, new Vector3(x, floor + capsuleHeight / 2 + 0.4, z))
        openClosePopup("An admin moved you", true, 2000)
    })
    socket.on("admin-message", ({ text } = {}) => {
        if (!isSocketOn || !text) return
        openClosePopup(String(text).slice(0, 300), true, 6000)
    })
    socket.on("admin-kicked", ({ reason } = {}) => {
        openClosePopup(`An admin disconnected you${reason ? ": " + String(reason).slice(0, 200) : ""}. Reload the page to come back.`, true, 60000)
    })
    // the item for a mushroom THIS player picked - tcp sends it only to the
    // picker, and only if nobody took that mushroom first (mushroomLibrary.ts
    // is where the kinds and their items live)
    socket.on("mushroom-picked", ({ item }) => {
        if (!isSocketOn || !item) return
        obtain(item)
    })

    // tcp/index.ts's own "strike-weapon" handler echoes this to EVERY
    // connected client, including whoever struck it (bare io.emit there,
    // not socket.broadcast.emit) - same reasoning "bonfire-crafted" above
    // already documents. reCreateMeshesInScene's own tcpStruckWeapons loop
    // skips the striker's own ownerId (it already has its own local copy,
    // rendered the instant it struck), so pushing this in and re-running
    // that loop is safe for the striker's own echo too, not just everyone
    // else.
    socket.on("weapon-struck", weapon => {
        if (!isSocketOn) return
        if (tcpStruckWeapons.some(w => w.itemId === weapon.itemId)) return
        tcpStruckWeapons.push(weapon)
        reCreateMeshesInScene()
    })
    // mirrors "treasure-removed" above - fires for EVERY client (including
    // whoever picked it up, echoed back), safe to run redundantly against a
    // weapon this same client already disposed itself
    // (creategroundweapon.js's own pickup callback already
    // emitPickupStruckWeapon()'d and disposed its local mesh before this
    // round-trips back).
    socket.on("struck-weapon-removed", weaponId => {
        if (!isSocketOn) return

        struckWeaponsInScene = struckWeaponsInScene.filter(w => w.itemId !== weaponId)
        tcpStruckWeapons = tcpStruckWeapons.filter(w => w.itemId !== weaponId)

        const weaponMesh = getSceneDet().scene.getMeshByName(`swordstuck_${weaponId}`)
        if (weaponMesh) weaponMesh.dispose()
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
    // tcp/recources/npcBrain.ts's own bots - moved like npc/enemy movement
    // now (renderer.js's own new bot-movement branch does the actual
    // per-frame body.locallyTranslate() stepping), NOT the real-player
    // snap-to-exact-position model "emitted-moving"/"stopped" above still
    // use. Only y/direction/moving actually ride over the wire - no x/z at
    // all, so this only ever sets facing + moving/mode state, same as
    // enemy-wander's own client handler does for _wanderTarget.
    //
    // dirYaw (a plain Y-axis angle, radians) - NOT a dirTarg point/lookAt.
    // A real player's own "emitted-moving"/"stopped" can safely lookAt a
    // point because their body.position is SNAPPED directly from the same
    // server-reported pos that point was computed relative to - always in
    // sync. A bot's never is: this client steps its OWN position forward
    // every frame via a simple constant-speed locallyTranslate
    // (renderer.js), completely independent of npcBrain.ts's own richer
    // yuka steering/deceleration/obstacle-avoidance simulation, so this
    // body's position visibly drifts from what the server believes it is.
    // lookAt(dirTargPoint) computed from THIS body's own (drifted)
    // position was producing a badly wrong angle - confirmed via live
    // matching server/client console logs, worse the closer the target
    // since CAST_RANGE is only 10 units. Applying a pure angle directly
    // (Quaternion.RotationAxis, same convention createcharacter.js's own
    // creation-time facing already uses) needs no position of any kind to
    // reconstruct the rotation, so this drift can't corrupt it anymore.
    socket.on("bot-moving", data => {
        if (!isSocketOn) return
        const { ownerId, y, dirYaw, mode, pos } = data
        const player = playersOnScene.find(pl => pl.owner === ownerId)
        if(!player) return

        player._moving = true
        player.mode = mode
        player.body.position.y = y
        // SERVANTS - tcp/index.ts's own onMove callback only ever includes
        // this for a bot that's currently someone's servant (see its own
        // comment for the full "why" - this client's own locallyTranslate
        // dead-reckoning has nothing correcting it during pure following
        // the way combat's own attack-triggered botTcpPos snaps already
        // do, so drift from the server's real position accumulates
        // unchecked without it). undefined for every other bot-moving
        // broadcast, unchanged from before.
        if(pos){
            player.body.position.x = pos.x
            player.body.position.z = pos.z
        }
        player.body.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), dirYaw)
    })
    socket.on("bot-stopped", data => {
        if (!isSocketOn) return
        const { ownerId, y, dirYaw, mode, pos } = data
        const player = playersOnScene.find(pl => pl.owner === ownerId)
        if(!player) return

        player._moving = false
        player.mode = mode
        player.body.position.y = y
        // see "bot-moving"'s own identical comment just above
        if(pos){
            player.body.position.x = pos.x
            player.body.position.z = pos.z
        }
        player.body.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), dirYaw)
    })
    // tcp/index.ts's own dealDamage callback (melee-style bots, dashstrikeSkill) -
    // castDashSkill (creations/skillEffects.js) is entirely PLAYER-shaped
    // (physics impulse, isCaster-gated), same reason client/src/npc/
    // duelSystem.js's own dashstrike-using npcFighters never reuse it either
    // and instead run their own dedicated locallyTranslate ramp
    // (performOpponentDashStrike) - this is that same idea for a bot: no
    // position/direction rides along at all (the bot is already facing the
    // right way from "bot-stopped"/the "skillactivated" dirTarg above), just
    // "translate yourself forward this fast for this long," consumed by
    // renderer.js's own per-frame bot-stepping loop every frame until
    // _dashUntil elapses.
    socket.on("bot-dashing", data => {
        if (!isSocketOn) return
        const { ownerId, distance, durationMs, weaponName, parts, weaponType, metalColor } = data
        const player = playersOnScene.find(pl => pl.owner === ownerId)
        if(!player) return
        if(data.botTcpPos){
            player.body.position.x = data.botTcpPos.x
            player.body.position.z = data.botTcpPos.z
        }
        player._dashUntil = performance.now() + durationMs
        player._dashSpeedPerSec = (distance / durationMs) * 1000

        // re-parents the sword mesh createCharacter already built for this
        // bot back onto rHand (onHand:true) - see this handler's own header
        // comment above for why nothing else was ever doing this for a bot.
        // weaponName undefined (attitude.weapon>0.5 guaranteed a real
        // equipped weapon server-side, but defensive here regardless) skips
        // the call entirely rather than handing equipSword a broken name.
        if(weaponName) player.equipSword(weaponName, true, parts, weaponType, metalColor)
    })
    socket.on("emitted-mode", data => {
        const { ownerId, mode, weaponName} = data
        const charState = getCharState()
        if(!charState) return
        const player = playersOnScene.find(pl => pl.owner === ownerId)
        if(!player) return
        const prevMode = player.mode
        if(ownerId === charState.owner) return

        setPlayerMode(ownerId, mode, weaponName)
    })
    // r-click hold-to-block, other players' side - inputMovement.js's
    // activateMouseControls already applied this on the ATTACKER's own
    // client the instant the button was pressed/released (no round-trip
    // wait needed for their own rig), so this only needs to mirror it onto
    // everyone ELSE's copy of that player's mesh - same ownerId===own early-
    // return every other "emitted-*" handler here already uses to skip
    // re-applying an echo of this client's own action back onto itself.
    socket.on("emitted-weaponblock", data => {
        const { ownerId, isBlocking, currentPlaceId } = data
        if (!isSocketOn) return
        const charState = getCharState()
        if (!charState) return
        if (getGameStatus() === "loading") return
        if (currentPlaceId !== charState.currentPlace.placeId) return
        if (ownerId === charState.owner) return
        const player = playersOnScene.find(pl => pl.owner === ownerId)
        if (!player) return

        player.weaponBlocking = isBlocking
        // only need to KICK OFF the loop on true - animation.js's own
        // playBlockingLoop re-checks player.weaponBlocking on every replay
        // and simply stops re-triggering once it sees false, so setting the
        // flag above is enough for the false case on its own
        if(isBlocking) playBlockingLoop(player)
    })
    // another player wore out or recovered (emits.js's emitTired) - renderer.js
    // picks the tired walk/stand clips off this flag. Skips this client's own
    // echo like the handler above.
    socket.on("emitted-tired", data => {
        const { ownerId, isTired, currentPlaceId } = data
        if (!isSocketOn) return
        const charState = getCharState()
        if (!charState) return
        if (getGameStatus() === "loading") return
        if (currentPlaceId !== charState.currentPlace.placeId) return
        if (ownerId === charState.owner) return
        const player = playersOnScene.find(pl => pl.owner === ownerId)
        if (!player) return
        player.isTired = !!isTired
    })
    // another player started or stopped bleeding (emits.js's emitBleeding) -
    // their blood splatter runs non-stop while it lasts. Skips this client's
    // own echo like the handler above (refreshBleeding already did mine).
    socket.on("emitted-bleeding", data => {
        const { ownerId, isBleeding, currentPlaceId } = data
        if (!isSocketOn) return
        const charState = getCharState()
        if (!charState) return
        if (getGameStatus() === "loading") return
        if (currentPlaceId !== charState.currentPlace.placeId) return
        if (ownerId === charState.owner) return
        const player = playersOnScene.find(pl => pl.owner === ownerId)
        if (!player) return
        player.isBleeding = !!isBleeding
        player.bloodps?.setBleeding(player.isBleeding)
    })
    // another player's flex aura grew while it was up (emits.js's emitAura) -
    // redrawn at the new strength. Skips this client's own echo like the
    // handlers above (refreshMyAura already redrew mine).
    socket.on("emitted-aura", data => {
        const { ownerId, aura, currentPlaceId } = data
        if (!isSocketOn) return
        const charState = getCharState()
        if (!charState) return
        if (getGameStatus() === "loading") return
        if (currentPlaceId !== charState.currentPlace.placeId) return
        if (ownerId === charState.owner) return
        const player = playersOnScene.find(pl => pl.owner === ownerId)
        player?.auraz?.update(aura)
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

        // worldChat is global (see its own "no rooms/parties" comment), so
        // this announces regardless of place - but the player's name is
        // only known locally if they're actually in MY currently-loaded
        // scene (playersOnScene), so a death in a place I've never shared
        // with them silently has no name to announce and is skipped
        const diedPlayer = playersOnScene.find(pl => pl.owner === ownerId)
        if(diedPlayer) appendSystemMessage(`${diedPlayer.name} died!`)

        playerDied(ownerId, currentPlaceId)
    })
    // tcp/index.ts's "sit-down"/"stand-up" (plus a "player-stood" it sends by
    // itself when a seated player disconnects or changes place) - see
    // charactersystem/seating.js for the local half
    socket.on("player-sat", data => {
        if (!isSocketOn) return
        onPlayerSat(data)
    })
    socket.on("player-stood", data => {
        if (!isSocketOn) return
        onPlayerStood(data)
    })
    socket.on("sit-rejected", data => {
        if (!isSocketOn) return
        onSitRejected(data)
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

        // TEMP DIAGNOSTIC - checkpoint BEFORE createCharacter even runs, so
        // we can tell whether a wrong gender already arrived over the socket
        // relay (server/getCharSocket() issue) vs. something going wrong
        // inside createCharacter itself. Remove once resolved.

        let player = createCharacter(sceneDet.scene, spawnPos, tcpCharDet, false)
        if(!player) return
        pushPlayer(player, tcpCharDet.owner)
        // already sitting before I got here - after pushPlayer, since
        // seating.js looks the player up in playersOnScene
        if(tcpCharDet.seat) applyRosterSeat(tcpCharDet.owner, tcpCharDet.seat)
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
    // same isAlreadyHere + getMeshByName double-check the enemy block above
    // uses - treasuresInScene alone would already catch a repeat pass, but
    // the mesh-name check is what catches it even if treasuresInScene ever
    // got out of sync with what's actually still in the scene
    tcpTreasures.length && tcpTreasures.forEach(treasureTcpInfo => {
        if (characterState.currentPlace.placeId !== treasureTcpInfo.currentPlaceId) return

        const isAlreadyHere = treasuresInScene.find(trs => trs.itemId === treasureTcpInfo.itemId)
        if (isAlreadyHere) return

        const treasureMesh = sceneDet.scene.getMeshByName(`treasure_${treasureTcpInfo.itemId}`)
        if(treasureMesh) return

        // tcp has no terrain - an openworld chest stands on the ground found here
        const chestPos = treasureTcpInfo.currentPlaceId === OPENWORLD_PLACE_ID
            ? { x: treasureTcpInfo.pos.x, y: openworldGroundY(treasureTcpInfo.pos.x, treasureTcpInfo.pos.z), z: treasureTcpInfo.pos.z }
            : treasureTcpInfo.pos
        const chest = createTreasureMesh(scene, chestPos, treasureTcpInfo.itemDetail, { treasureId: treasureTcpInfo.itemId })
        if(chest) treasuresInScene.push({ itemId: treasureTcpInfo.itemId })
    })
    // same three-guard shape as tcpTreasures right above (place filter,
    // local tracking array, getMeshByName fallback) - createBonfireMesh's
    // own mesh naming (bonfire_${craftId}) has to actually receive craftId
    // for that fallback check to find the right mesh, same reason
    // createTreasureMesh takes an explicit treasureId
    tcpBonfires.length && tcpBonfires.forEach(bonfireTcpInfo => {
        if (characterState.currentPlace.placeId !== bonfireTcpInfo.currentPlaceId) return

        const isAlreadyHere = bonfiresInScene.find(bf => bf.craftId === bonfireTcpInfo.craftId)
        if (isAlreadyHere) return

        const bonfireMesh = sceneDet.scene.getMeshByName(`bonfire_${bonfireTcpInfo.craftId}`)
        if(bonfireMesh) return

        const bonfire = createBonfireMesh(scene, bonfireTcpInfo.pos, bonfireTcpInfo.craftId)
        if(bonfire) bonfiresInScene.push({ craftId: bonfireTcpInfo.craftId })
    })
    // same three-guard shape as tcpBonfires right above, for campcraft.js's
    // "treelog" craft (createTrunkMesh's own trunk_${craftId} naming)
    tcpTrunks.length && tcpTrunks.forEach(trunkTcpInfo => {
        if (characterState.currentPlace.placeId !== trunkTcpInfo.currentPlaceId) return

        const isAlreadyHere = trunksInScene.find(tr => tr.craftId === trunkTcpInfo.craftId)
        if (isAlreadyHere) return

        const trunkMesh = sceneDet.scene.getMeshByName(`trunk_${trunkTcpInfo.craftId}`)
        if(trunkMesh) return

        const trunk = createTrunkMesh(scene, trunkTcpInfo.pos, trunkTcpInfo.craftId, trunkTcpInfo.currentPlaceId)
        if(trunk) trunksInScene.push({ craftId: trunkTcpInfo.craftId })
    })
    // tents, spikes... - placeStructure loads the kind's model the first time
    // and skips anything already standing
    tcpStructures.length && tcpStructures.forEach(structure => {
        if (characterState.currentPlace.placeId !== structure.currentPlaceId) return
        placeStructure(scene, structure)
    })
    // createGrainMesh dedupes by grainId itself - no getMeshByName fallback
    // here, since that scans every mesh in the scene (15k+ grass/bush
    // instances in the village) once per grain
    tcpGrains.length && tcpGrains.forEach(grainTcpInfo => {
        if (characterState.currentPlace.placeId !== grainTcpInfo.currentPlaceId) return
        const { x, z } = grainTcpInfo.pos
        // tcp has no terrain - openworld ground height only exists client-side
        const groundY = grainTcpInfo.currentPlaceId === OPENWORLD_PLACE_ID
            ? openworldGroundY(x, z)
            : grainTcpInfo.pos.y
        createGrainMesh(scene, { x, y: groundY, z }, grainTcpInfo.grainId)
    })
    // dungeon floors: tcp knows each one's floor height. One an admin put in the
    // openworld has no height there, so it's grounded here like a grain
    tcpMushrooms.length && tcpMushrooms.forEach(mushroomTcpInfo => {
        if (characterState.currentPlace.placeId !== mushroomTcpInfo.currentPlaceId) return
        const { x, z } = mushroomTcpInfo.pos
        const mushroomPos = mushroomTcpInfo.currentPlaceId === OPENWORLD_PLACE_ID
            ? { x, y: openworldGroundY(x, z), z }
            : mushroomTcpInfo.pos
        createMushroomMesh(scene, mushroomPos, mushroomTcpInfo.mushroomId, mushroomTcpInfo.kind)
    })
    if(characterState.currentPlace.placeId === 9){

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
    // a bleeding player stops bleeding once dead
    player.isBleeding = false
    player.bloodps?.setBleeding(false)

    player.anims.forEach(anim => {
        anim.weight = 0
        anim.stop()
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
    // a seated avatar hangs off its seat node, not the body - put it back on
    // the body first so the body's dispose below takes it too. Before the
    // playersOnScene filter, since seating.js finds the player through it
    releaseSeatOf(ownerId)
    playerToRemove.anims.forEach(anim => anim.dispose())
    // the body's dispose below doesn't take the blood splatter with it - a
    // bleeding one would keep spraying where they stood. (false) keeps
    // particlesystem.js's shared texture cache
    playerToRemove.bloodps?.ps.dispose(false)
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

    refreshPlayerListIfOpen()
}
export function setPlayerMode(ownerId, _newMode, weaponName){
    const player = playersOnScene.find(pl => pl.owner === ownerId)
    if(!player) return;
    const prevMode = player.mode
    if(_newMode === "minning" && player.hasWeapon) player.equipSword(weaponName, true)
    if(prevMode === "idle" && _newMode === "fighting"){
        
        // first also think how you can get the character if equiping a weapon
        // the animation of idle to fight will depend if it is wearing weapon
        // if(player.hasWeapon && weaponName){
        if(weaponName){
            player.characterAnimations.playAction(player.anims, "act_idletoready1", 1, null, false, ANIM_STATE.COMBAT_IDLE)
            setTimeout(() => {
                player.equipSword(weaponName, true)
            }, 400)
        }
    }
    if(prevMode === "fighting" && _newMode === "idle"){
        if(weaponName){
            player.characterAnimations.playAction(player.anims, "act_readytoidle", 1, null, false, ANIM_STATE.IDLE)
            setTimeout(() => {
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