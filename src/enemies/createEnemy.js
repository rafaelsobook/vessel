import { Texture,PhysicsMotionType, Vector3, Color3, StandardMaterial, ActionManager, Mesh, MeshBuilder, Quaternion, Sound } from "@babylonjs/core"
import { checkDistance, createMesh, createMonsterMaterial } from "../creations/creationTools.js"
import { lookAt } from "../tools/tools"
import { createGlowingMat, fresnelMat } from "../tools/materials.js"
import { addGlow } from "../tools/glow.js"
import { attachLightning } from "../effects/lightning.js"
import { getEnemiesOnScene, getIsSocketOn, getPlayersOnScene, getProjectilesOnScene, getSocketContainers, removeEnemyOnScene } from "../sockets/worldsocket.js"
import { createTextMesh } from "../gui/textmesh.js"
import { createHpBar, poppingTextMesh } from "../tools/GUITools.js"
import { onIntersecEnterTrig, onIntersecExitTrig } from "../components/actionManager.js"
import { getCharState, gainExp } from "../charactersystem/characterstate.js"
import { getGameStatus, getSceneDet } from "../main/main.js"
import { playAnim, playRandomAnim, pickAnimVariant } from "../tools/animation.js"
import { getSocket } from "../sockets/joinsocket.js"
import { createAggregate } from "../tools/physics.js"
import { calcDmg, getAttackInfo } from "../charactersystem/attackingSystem.js"
import { emitEnemyIsHit, emitEnemyYCorrection, emitSpawnCircle, emitFaceTarget } from "../sockets/emits.js"
import { createMagicCircle } from "../creations/magiccircles.js"
import { obtain } from "../charactersystem/inventory.js"
import { openClosePopup } from "../tools/popupUI.js"
import { checkStoryQuestIfCompleted } from "../charactersystem/storyQuestSystem.js"
import { createSlimeMat } from "./skins.js"
import { getAllSounds, playSound, runSound } from "../components/soundSystem.js"
import { sampleTerrainSurfaceHeight } from 'infterrain'
import { OPENWORLD_PLACE_ID, OPENWORLD_TERRAIN_VERTS } from "../constants/constants.js"
import { SKILLS_BY_NAME } from "../staticRecources/skillsData.js"
import { castEnemySkill } from "../creations/skillEffects.js"
import { faceForward, lastHitEnemy, setLastHitEnemy } from "../controllers/inputMovement.js"



export default function createEnemy(scene, det) {
    // guards the actual mesh-creation choke point itself, not just whatever
    // check the caller happens to do first (worldsocket.js's own
    // reCreateMeshesInScene already checks enemiez/getMeshByName before
    // calling this, but that's a courtesy, not a guarantee every path/every
    // future caller respects - MeshBuilder.CreateBox below doesn't care if
    // a mesh named `enemy.${det._id}` already exists, it'll happily build a
    // second overlapping one on top of the first if this is ever called
    // twice for the same _id) - returning null here early is the one place
    // that can't be bypassed no matter what called this or why
    if(scene.getMeshByName(`enemy.${det._id}`)) return null
    console.log(det)
    const {goblinRoot, monolithRoot, slimeRoot, lesserDemonRoot} = getSocketContainers()
    // tcp's enemyDetails/genenemy.ts hardcode y:0 (flat-ground assumption) - wrong
    // on openworld's uneven terrain, so look up the real ground height instead.
    // sampleTerrainSurfaceHeight (not terrainHeight) - matches the coarse,
    // interpolated grid the actual rendered chunk mesh was built from
    // (OPENWORLD_TERRAIN_VERTS), rather than the exact analytical noise
    // curve, which the mesh only approximates between samples - see that
    // constant's own comment.
    const groundY = det.currentPlaceId === OPENWORLD_PLACE_ID ? sampleTerrainSurfaceHeight(det.x, det.z, OPENWORLD_TERRAIN_VERTS) : det.y
    let yPos = groundY+(det.bodyHeight/2) + 0.05
    const body = createMesh(scene, `enemy.${det._id}`, { size: det.bodyWidenes, height: det.bodyHeight }, //height 1.7 // size: .5
        { x: det.x, y:yPos , z: det.z }, 1, true, true)

    // openworld's terrain is uneven and this enemy's y can drift (chunk streaming,
    // chase movement across slopes, etc.) - periodically verify against the real
    // terrain height and correct + report it to the server so other clients (now,
    // via the broadcast, or later when they join/re-sync) see the right height.
    // Covers idle/attacking states too, unlike the per-frame resnap in renderer.js's
    // chase loop, which only runs while actively chasing beyond attack range.
    if(det.currentPlaceId === OPENWORLD_PLACE_ID){
        const Y_CORRECTION_THRESHOLD = 1 // ignore tiny float noise, only correct real desync
        const yCheckInterval = setInterval(() => {
            const correctY = sampleTerrainSurfaceHeight(body.position.x, body.position.z, OPENWORLD_TERRAIN_VERTS) + det.bodyHeight / 2 + 0.05
            if(Math.abs(body.position.y - correctY) > Y_CORRECTION_THRESHOLD){
                body.position.y = correctY
                emitEnemyYCorrection(det._id, correctY, body.position.x, body.position.z)
            }
        }, 500)
        body.onDisposeObservable.add(() => clearInterval(yCheckInterval))
    }

    // const agg = createAggregate(body, { mass: 0.1}, "box", scene)
    // // Make it kinematic
    // agg.body.setMotionType(PhysicsMotionType.STATIC);
    // agg.disablePreStep = false; // must be false for ANIMATED to work
    const atkDetection = createMesh(scene, `atkDetection.${det._id}`, { size: det.bodyWidenes*2, height: det.bodyWidenes },
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
            entries = goblinRoot?.instantiateModelsToScene()
        break
        case "monolith":
            entries = monolithRoot?.instantiateModelsToScene()
        break
        case "slime":
            entries = slimeRoot?.instantiateModelsToScene()
        break
        case "lesserdemon":
            entries = lesserDemonRoot?.instantiateModelsToScene()
        break
    }
    // model container failed to load (missing glb) or modelStyle has no case
    // above - skip rendering this enemy instead of crashing the whole scene
    if(!entries){
        console.warn(`[createEnemy] no model available for modelStyle "${det.modelStyle}" (${det.name}) - skipping`)
        atkDetection.dispose()
        chaseDetector.dispose()
        body.dispose()
        return null
    }
    entries.animationGroups.map(ani => ani.name = ani.name.split(" ")[2])
    const mainBodyMeshes = entries.rootNodes[0]
    mainBodyMeshes.parent = body
    mainBodyMeshes.position.y -= det.bodyHeight/2
    mainBodyMeshes.rotationQuaternion = Quaternion.Identity()

    if (det._dirTarg) body.lookAt(new Vector3(det._dirTarg.x, yPos, det._dirTarg.z))

        
    // const fshadow = putFakeShadow(body, fakeShadowRoot, det.bodyHeight * .7, -yPos + .01)
    // nameMesh/hpmesh are both parented to body (see createTextMesh/createHpBar),
    // so their own .position.y is a LOCAL offset relative to body's own
    // origin, not an absolute world height - body itself already sits at
    // yPos (an absolute height, groundY + bodyHeight/2 + 0.05). Was yPos +
    // 0.5/yPos + 0.1 here before, which - being a LOCAL offset - stacked
    // yPos on top of body's own already-yPos position a second time,
    // roughly doubling the actual height. Invisible in the village (yPos
    // stays near 0 on flat ground, so the error was ~1 unit, unnoticeable)
    // but blew up badly in openworld, where yPos includes real hillside
    // elevation (tens of units) - the health bar/name tag ended up floating
    // roughly twice as high as the terrain the enemy is actually standing
    // on. bodyHeight/2 (same "reach the top of the body" offset
    // mainBodyMeshes.position.y above already uses, just in the opposite
    // direction) is the correct local offset instead.
    const nameMesh = createTextMesh(scene, body, det.dn, "white", { x: 0, y: det.bodyHeight / 2 + 0.5, z: 0 }, 35)
    nameMesh.isVisible = true
    const { hpbar, hpmesh } = createHpBar(det.bodyHeight / 2 + .1, det._id, body, det.hp, det.maxHp)
    // const theCharacterRoot = monsRoots.find(rootInfo => rootInfo.name === det.modelStyle)
    // if (!theCharacterRoot) return

    mainBodyMeshes.getChildMeshes().forEach(enemyasset => {
        enemyasset.name = enemyasset.name.split(" ")[2].toLowerCase()
        enemyasset.isPickable = false
        if (enemyasset.name === 'slime') {
            // det.elementType (water/fire/electric - see SLIME_ELEMENT_COLORS
            // in skins.js) was never actually passed through here before,
            // so every slime silently rendered with the same green "water"
            // default regardless of its own elementType
            const mat = createSlimeMat(scene, enemyasset, det.elementType)
            enemyasset.material = mat
            return
        }
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
    let timeOutWillChase
    function initAttack() {
        let attackSpdInterval = Math.floor(det.stats.atkSpd * 900)
        if (attackSpdInterval >= 3900) attackSpdInterval = 3950
        if(Math.random() > 0.7) attack()
        clearInterval(intervalWillAttack)
        clearTimeout(timeOutWillChase)
        intervalWillAttack = setInterval(() => {
            // console.log(det.stats.atkSpd)
            attack()
        }, 4400 - attackSpdInterval)
    }
    function attack(){

        const thisEnemy = getEnemiesOnScene().find(ene => ene._id === det._id)
        if (getGameStatus() === "loading") return console.log("game status loading")
        if (!thisEnemy) return clearInterval(intervalWillAttack)
        // bound (see applyEnemyBind below) - "cannot move, cannot attack,
        // cannot do anything" - the interval itself is only actually
        // stopped at bind-time (see applyEnemyBind), this is the safety net
        // for whatever's still in flight the instant the bind lands
        if (thisEnemy._disabled) return
        if (thisEnemy._targetId) {
            const targetHero = getPlayersOnScene().find(pl => pl.owner === thisEnemy._targetId)
            if (!targetHero) return
            if (targetHero.isDead) return
            // was scene.getMeshByName(`player.${...}`) - an O(n) linear scan
            // over every mesh in the scene (thousands, counting village
            // foliage instances), done on every single attack tick, for
            // every enemy currently engaged. targetHero.body is the exact
            // same mesh, already in hand from the tiny getPlayersOnScene()
            // array above - same fix already applied to renderer.js's own
            // movement loop, just missed here. This runs per-enemy on a
            // roughly 1-4s interval (not every frame), but several enemies
            // clashing with the player at once (e.g. the three slimes
            // sitting only 3 units apart near the village) each pay this
            // cost independently, on top of whatever's already lagging
            // during a real fight.
            const targBody = targetHero.body
            if (!targBody) return

            const enPos = thisEnemy.body.position.clone()
            const targPos = targBody.position
            const dist = checkDistance(new Vector3(enPos.x, targPos.y, enPos.z), targPos)
            if (dist <= thisEnemy.det.maxDistance + 1.3) {  // PLUS 1
                emitAttack(det, thisEnemy._id, thisEnemy._targetId, det.currentPlaceId, { x: enPos.x, z: enPos.z }, thisEnemy.anims)
            }
        }
    }
    const charState = getCharState()
    if(!charState) return
    const myChar = getPlayersOnScene().find(pl => pl.owner === charState.owner)
    if(!myChar) return

    onIntersecEnterTrig(atkDetection, myChar.body, scene, () => {
        const thisEnemy = getEnemiesOnScene().find(ene => ene._id === det._id)
        const myCharId = myChar.body.name.split(".")[1]

        if (!thisEnemy) return
        thisEnemy._isMoving = false
        // myChar.body IS this exact mesh already, no scan needed (myCharId
        // is just myChar's own owner id split back out of its mesh name)
        const enemyTargetBody = myChar.body

        const plPos = enemyTargetBody.position
        // still register as its target even while bound (see applyEnemyBind/
        // removeEnemyBind below) - so unbinding can resume straight into
        // attacking - just don't actually start the attack loop yet
        emitRegisterAsEnemy(thisEnemy._id, myCharId, {x: plPos.x, y: yPos, z: plPos.z})
        // emitChase(thisEnemy._id, myCharId, det.currentPlace, det.actionType)
        if (thisEnemy._disabled) return
        clearInterval(intervalWillAttack)
        clearTimeout(timeOutWillChase)
        initAttack()
    })
    onIntersecExitTrig(atkDetection, myChar.body, scene, () => {
        const thisEnemy = getEnemiesOnScene().find(ene => ene._id === det._id)
        if (!thisEnemy) return

        const myCharId = myChar.body.name.split(".")[1]
        if (thisEnemy._targetId !== myCharId) return 
        clearInterval(intervalWillAttack)
        clearTimeout(timeOutWillChase)
        timeOutWillChase = setTimeout(() => {
            emitChase(thisEnemy._id, myCharId, det.currentPlaceId, det.actionType)
        }, 1000)
    })

    // onIntersecEnterTrig(chaseDetector, myChar.body, scene, () => {
    //     const thisEnemy = getEnemiesOnScene().find(ene => ene._id === det._id)
    //     const myCharId = myChar.body.name.split(".")[1]

    //     if (!thisEnemy) return

    //     const enemyTargetBody = scene.getMeshByName(`player.${myCharId}`)


    //     const plPos = enemyTargetBody.position
    //     emitRegisterAsEnemy(thisEnemy._id, myCharId, {x: plPos.x, y: yPos, z: plPos.z})
    //     // emitChase(thisEnemy._id, myCharId, det.currentPlace, det.actionType)
    //     initAttack(det)
        
    // })
    onIntersecExitTrig(chaseDetector, myChar.body, scene, () => {
        // const thisEnemy = getEnemiesOnScene().find(ene => ene._id === det._id)
        // const myCharId = myChar.body.name.split(".")[1]

        // if (!thisEnemy) return

        // const enemyTargetBody = scene.getMeshByName(`player.${thisEnemy._targetId}`)
        // const plPos = enemyTargetBody.position
        // if (!enemyTargetBody) {
        //     emitRegisterAsEnemy(thisEnemy._id, myCharId, {x: plPos.x, y: yPos, z: plPos.z})
        //     // emitChase(thisEnemy._id, myCharId, det.currentPlace, det.actionType)
        //     initAttack(det)
        // }
    })

    // --- enemy skill casting (det.skills - only fireslime/electricslime
    // for now, see tcp/recources/enemyDetails.ts) - deliberately its own
    // plain proximity poll, not the atkDetection/chaseDetector
    // ActionManager triggers above: those only ever fire from "did MY OWN
    // character walk into a trigger zone", but a skill needs to know about
    // EVERY nearby player at once to pick the closest one, which
    // detectPlayerNearby below computes directly off getPlayersOnScene().
    //
    // Multiplayer-safe by construction: every client near this enemy runs
    // this same interval and computes the same closestPlayer (player
    // positions are already synced identically to everyone, so there's
    // nothing client-specific about the answer) - but only the client
    // whose OWN character actually IS that closest player ever emits.
    // Exactly one client decides per cast, never zero, never more than
    // one, no matter how many players happen to be nearby - see
    // skillEffects.js's castEnemySkill/fireEnemySkillProjectile for how
    // the actual cast (broadcast to everyone, damage applied only by the
    // real target) stays safe on top of that single decision.
    const ENEMY_SKILL_CHECK_INTERVAL_MS = 10000
    const ENEMY_SKILL_RANGE = 20
    let enemySkillCooldownUntil = 0
    if(det.skills?.length){
        const enemySkillInterval = setInterval(() => {
            const thisEnemy = getEnemiesOnScene().find(ene => ene._id === det._id)
            if (!thisEnemy) return clearInterval(enemySkillInterval)
            const theEnemyBodyMesh = getSceneDet().scene.getMeshByName(`enemy.${det._id}`)
            if(!theEnemyBodyMesh) {
                console.log(`enemy.${det._id} body mesh not found, and is still casting skill remove this body`)
                return clearInterval(enemySkillInterval)
            }
            if (thisEnemy._disabled) return
            if (Date.now() < enemySkillCooldownUntil) return

            detectPlayerNearby(thisEnemy.body.position, ENEMY_SKILL_RANGE, (playersNearby, closestPlayer) => {
                if (!closestPlayer) return
                const charState = getCharState()
                if (!charState || closestPlayer.owner !== charState.owner) return

                const skillName = det.skills[0]
                const skill = SKILLS_BY_NAME[skillName]
                if (!skill) return console.warn(`[enemy skill] unknown skill "${skillName}" on enemy`, det.name)

                enemySkillCooldownUntil = Date.now() + skill.skillCoolDown
                const enPos = thisEnemy.body.position
                if(getIsSocketOn()){

                    emitEnemyCastSkill(thisEnemy._id, skillName, closestPlayer.owner, { x: enPos.x, y: enPos.y, z: enPos.z }, det.currentPlaceId)
                }else{
                    castEnemySkill(scene, thisEnemy, skill, closestPlayer)
                }
            })
        }, ENEMY_SKILL_CHECK_INTERVAL_MS)
    }

    // --- lesserdemon-only: teleport-to-melee instead of chasing (det.
    // actionType "teleporting", see tcp/generate-datas/genenemy.ts's
    // lesserDemonBase, and renderer.js's own chase-translation guard,
    // which only actually walks an enemy forward when actionType is
    // "chasing") - stands its ground rather than covering distance on
    // foot: periodically checks for a nearby player, telegraphs with a
    // magic circle near them, then teleports there a beat later, close
    // enough to melee (atkDetection's own trigger picks up the overlap the
    // instant it lands, same as it would from walking in - Babylon's
    // intersection checks don't care how two meshes ended up touching).
    // Same "closest player's own client decides, everyone else just
    // watches" arbitration the skill-cast interval above already uses -
    // exactly one client ever emits the teleport request.
    const LESSERDEMON_TELEPORT_CHECK_INTERVAL_MS = 4000
    const LESSERDEMON_TELEPORT_RANGE = 20 // "notices" a player this far out - matches ENEMY_SKILL_RANGE
    const LESSERDEMON_TELEPORT_SKIP_DIST = 2.5 // already close enough (about to melee/mid-melee) - don't bother
    const LESSERDEMON_TELEPORT_LAND_OFFSET = 1.4 // lands this far from the player - inside melee reach (maxDistance 1.0) with a little slack, not literally on top of them
    const LESSERDEMON_TELEPORT_WINDUP_MS = 1000 // telegraph-to-teleport delay - how long the magic circle warns before it fires
    let lesserdemonTeleportCooldownUntil = 0
    if(det.name === "lesserdemon"){
        const teleportInterval = setInterval(() => {
            const thisEnemy = getEnemiesOnScene().find(ene => ene._id === det._id)
            if (!thisEnemy) return clearInterval(teleportInterval)
            if (thisEnemy._disabled) return
            if (Date.now() < lesserdemonTeleportCooldownUntil) return

            detectPlayerNearby(thisEnemy.body.position, LESSERDEMON_TELEPORT_RANGE, (playersNearby, closestPlayer) => {
                if (!closestPlayer?.body) return
                const charState = getCharState()
                if (!charState || closestPlayer.owner !== charState.owner) return

                const enPos = thisEnemy.body.position
                const plPos = closestPlayer.body.position
                const dx = plPos.x - enPos.x, dz = plPos.z - enPos.z
                if (Math.sqrt(dx * dx + dz * dz) < LESSERDEMON_TELEPORT_SKIP_DIST) return // already close enough

                // windup (telegraph->teleport) plus a beat before it's
                // willing to do this again - stops it from immediately
                // re-teleporting right after landing/attacking once
                lesserdemonTeleportCooldownUntil = Date.now() + LESSERDEMON_TELEPORT_WINDUP_MS + 3000

                // random angle around the player's own CURRENT position -
                // not literally on top of them
                const angle = Math.random() * Math.PI * 2
                const landX = plPos.x + Math.cos(angle) * LESSERDEMON_TELEPORT_LAND_OFFSET
                const landZ = plPos.z + Math.sin(angle) * LESSERDEMON_TELEPORT_LAND_OFFSET

                // telegraph - spawned locally right away (so the deciding
                // client sees it with zero round-trip delay), and relayed
                // for everyone else watching (see worldsocket.js's own
                // "circle-spawned" listener, and tcp/index.ts's spawncirc
                // handler for why this doesn't ALSO echo back and double up
                // on this same client). createMagicCircle (not
                // spawnMagicCircle) - respects the actual y passed in,
                // needed on openworld's uneven terrain.
                createMagicCircle(new Vector3(landX, plPos.y, landZ), scene, "apt_darkness", 0.8, LESSERDEMON_TELEPORT_WINDUP_MS + 300)
                emitSpawnCircle({ x: landX, y: plPos.y, z: landZ }, "darkness")

                setTimeout(() => {
                    const stillThere = getEnemiesOnScene().find(ene => ene._id === det._id)
                    if (!stillThere || stillThere._disabled) return
                    emitEnemyTeleport(det._id, { x: landX, z: landZ }, det.currentPlaceId)
                }, LESSERDEMON_TELEPORT_WINDUP_MS)
            })
        }, LESSERDEMON_TELEPORT_CHECK_INTERVAL_MS)
    }

    // --- projectile dodge (det.canDodge - fireslime/electricslime/
    // orangelith for now, see tcp/recources/enemyDetails.ts and
    // tcp/generate-datas/genenemy.ts) - every DODGE_CHECK_INTERVAL_MS,
    // checks every projectile currently on scene for whether its
    // straight-line path is about to pass close enough to this enemy to
    // hit it, and sidesteps if so.
    //
    // Multiplayer model: unlike the skill-cast interval above (which
    // restricts the actual decision to the closest player's own client,
    // since only ONE client should ever pick who an enemy targets), a
    // projectile isn't a shared network entity at all - every client
    // renders its OWN local copy the instant a skill is cast, so there's
    // no single "authoritative" client to defer to here. Any client
    // watching this enemy can independently decide it's under threat and
    // emit a dodge request; since they're all watching roughly the same
    // cast (same travel-time math, same target), they'll tend to agree
    // within a moment of each other. tcp/index.ts's own per-enemy
    // _dodgeCooldownUntil collapses those near-simultaneous duplicates
    // into one broadcast instead of relaying every single one.
    const DODGE_CHECK_INTERVAL_MS = 2000
    const DODGE_THREAT_RADIUS = 2.2
    const DODGE_MAX_LOOKAHEAD = 12
    const DODGE_DISTANCE = 2
    if(det.canDodge){
        const dodgeInterval = setInterval(() => {
            const thisEnemy = getEnemiesOnScene().find(ene => ene._id === det._id)
            if (!thisEnemy) return clearInterval(dodgeInterval)
            if (thisEnemy._disabled) return
            // already mid-wander/mid-dodge - don't stack a second one on
            // top before the first even finishes
            if (thisEnemy._wanderTarget) return

            const enemyPos = thisEnemy.body.position
            const threat = getProjectilesOnScene().find(proj => {
                if (!proj.body || proj.stuck) return false
                if (proj.placeId !== det.currentPlaceId) return false

                // point-to-ray distance: project (enemy - projectile) onto
                // the projectile's own travel direction to find how far
                // ahead its closest approach to the enemy is, then measure
                // the perpendicular miss distance at that point
                const dir = proj.body.getDirection(Vector3.Forward()).normalize()
                const toEnemy = enemyPos.subtract(proj.body.position)
                const t = Vector3.Dot(toEnemy, dir)
                if (t <= 0 || t > DODGE_MAX_LOOKAHEAD) return false // already past this enemy, or still too far out to matter yet

                const closest = proj.body.position.add(dir.scale(t))
                const missDist = Vector3.Distance(enemyPos, closest)
                return missDist <= DODGE_THREAT_RADIUS
            })
            if (!threat) return

            // sidestep AWAY from the threat's flight path specifically
            // (not just an arbitrary perpendicular direction) - the exact
            // direction from the closest point on that path to the
            // enemy's own current position, so the dodge always increases
            // distance from the incoming projectile rather than
            // potentially stepping back into its way
            const dir = threat.body.getDirection(Vector3.Forward()).normalize()
            const t = Vector3.Dot(enemyPos.subtract(threat.body.position), dir)
            const closestOnLine = threat.body.position.add(dir.scale(t))
            const awayVec = enemyPos.subtract(closestOnLine)
            const awayFromLine = awayVec.lengthSquared() > 0.0001 ? awayVec.normalize() : new Vector3(-dir.z, 0, dir.x)
            const dodgeTo = enemyPos.add(awayFromLine.scale(DODGE_DISTANCE))

            emitEnemyDodge(thisEnemy._id, { x: dodgeTo.x, z: dodgeTo.z }, det.currentPlaceId)
        }, DODGE_CHECK_INTERVAL_MS)
    }
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
            // no notPlayerBody arg - faceForward targets the LOCAL PLAYER's
            // own body (see its own comment on why it can't just reuse the
            // shared rotationHelper mesh: updateMovement() copies that
            // mesh's rotationQuaternion onto the player's body every frame,
            // so this animates aggregate.transformNode.rotationQuaternion
            // directly instead of fighting that). Smoothly slerps to face
            // whichever enemy this swing actually landed on, same call
            // areascene.js's own faceForward(res.position) already uses to
            // turn the player toward an NPC.
            // faceForward(enemy.body.position)
            // multiplayer sync - faceForward above only turns MY OWN body
            // locally, nothing about it reaches the server on its own (see
            // emitFaceTarget's own comment) - every other client watching
            // this fight needs to see the same turn, not whatever facing I
            // had right before the swing landed.
            // emitFaceTarget(enemy.body.position)
            // positionAtkCollider (createMyCharacter.js) reads this to bias
            // the NEXT attack-dash toward whatever I just actually hit,
            // instead of always my own local forward direction - cleared
            // below once this specific enemy dies (see the hp<=0 branch)
            setLastHitEnemy(enemy)
        })
    }
    playRandomAnim(entries.animationGroups, "idle", true)

    //  sounds
    const  { runSound, deathSound, hitSound, attackSound } = monsterSounds(scene, det, body)

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
        // bind effect (see applyEnemyBind below, skillEffects.js's
        // enemyBind) - "cannot move, cannot attack, cannot do anything"
        // while true. renderer.js's per-frame movement loop and attack()
        // above both check this.
        _disabled: det._disabled ? det._disabled : false,
        // exposed so removeEnemyBind can resume attacking immediately on
        // unbind (if this enemy still has a target) instead of waiting on
        // the next atkDetection enter/exit trigger, which won't refire if
        // the player never actually left attack range during the bind
        resumeAttack: initAttack,
        // dark magic curse (see applyEnemyCurse below, skillEffects.js's
        // hit handler) - permanent for this enemy's life, no duration.
        // worldsocket.js's "enemy-attacked" handler checks this to redirect
        // a cursed enemy's own attack damage back onto itself.
        _cursed: det._cursed ? det._cursed : false,
        // wander/dodge waypoint (tcp/index.ts's wander interval, or this
        // file's own dodge-detection interval below) - a plain {x,z}
        // point, not a player. renderer.js's movement loop moves toward
        // this INSTEAD of chasing _targetId whenever it's set, then clears
        // it back to null on arrival. _isDodging just flags the 3x speed
        // burst while _wanderTarget is a dodge rather than a lazy wander.
        _wanderTarget: null,
        _isDodging: false,

        runSound,
        deathSound,
        hitSound,
        attackSound,

        intervalWillAttack
    }
}
// missing mp3s don't throw synchronously - Sound fetches async and fails later
// (unhandled promise rejection), so wrap creation defensively and let callers
// treat a null sound as "nothing to play" instead of crashing on .play()/.attachToMesh()
function createSoundSafe(name, url, scene, options){
    try{
        return new Sound(name, url, scene, null, options)
    }catch(err){
        console.warn(`[monsterSounds] failed to load "${url}"`, err)
        return null
    }
}
function monsterSounds(scene, det, body){
    const runSound = createSoundSafe(`${det.modelStyle}run`, `./sounds/monsters/${det.modelStyle}/${det.modelStyle}run.mp3`, scene, {
        maxDistance: 30, spatialSound: true, loop: false, autoplay: false
    })
    runSound?.setPlaybackRate(0.5)

    const deathSound = createSoundSafe(`${det.modelStyle}death`, `./sounds/monsters/${det.modelStyle}/${det.modelStyle}death.mp3`, scene, {
        maxDistance: 50, spatialSound: true, loop: false, autoplay: false
    })

    const hitSound = createSoundSafe(`${det.modelStyle}hitbynosharp`, `./sounds/monsters/${det.modelStyle}/${det.modelStyle}hitbynosharp.mp3`, scene, {
        maxDistance: 50, spatialSound: true, loop: false, autoplay: false
    })
    const attackSound = createSoundSafe(`${det.modelStyle}attack`, `./sounds/monsters/${det.modelStyle}/${det.modelStyle}attack.mp3`, scene, {
        maxDistance: 50, spatialSound: true, loop: false, autoplay: false
    })

    runSound?.attachToMesh(body)
    deathSound?.attachToMesh(body)
    hitSound?.attachToMesh(body)
    attackSound?.attachToMesh(body)

    return { runSound, deathSound, hitSound, attackSound }
}
function createChaseDetector(scene){
    const detector = createMesh(scene, "chasedetector", { size: 19, height: 0.1 }, { x: 0, y: 0, z: 0 }, 1, false, false)
    detector.isPickable = false
    return detector
}
// tools
function emitAttack(detail, enemId, targetId, placeId, pos, anims) {
    // log(`enemy will attack ${detail.name}`)
    const attackAnim = pickAnimVariant(anims, "attack")
    getSocket().emit("enemyWillAttack", {
        currentPlaceId: placeId,
        _id: enemId,
        pos,
        targetId: targetId,
        dmg: detail.stats.dmg,
        atkSpd: detail.stats.atkSpd,
        attackAnimName: attackAnim ? attackAnim.name : "attack1",
        effects: detail.effects
    })
}
function emitRangeAttack(detail, enemId, targetId, cPlace, pos, targetPos, rangeAtkDetails, anims){
    const attackAnim = pickAnimVariant(anims, "attack")
    getSocket().emit("enemyAttackedRange", {
        currentPlace: cPlace,
        _id: enemId,
        pos,
        targetPos,
        targetId: false,
        dmg: detail.stats.dmg,
        atkSpd: detail.stats.atkSpd,
        attackAnimName: attackAnim ? attackAnim.name : "attack1",
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
// nearby/closest player lookup for enemy skill-casting (see the setInterval
// above) - plain distance check over getPlayersOnScene(), not an
// ActionManager trigger, since this needs every nearby player at once, not
// just "did my own character enter a zone"
function detectPlayerNearby(enemyPos, distance, callback) {
    let closest = null
    let closestDist = Infinity
    const nearby = getPlayersOnScene().filter(pl => {
        if (!pl.body || pl.isDead) return false
        const plPos = pl.body.position.clone()
        plPos.y = enemyPos.y // ignore vertical distance, only care about horizontal proximity
        const d = Vector3.Distance(enemyPos, plPos)
        if (d > distance) return false
        if (d < closestDist) { closestDist = d; closest = pl }
        return true
    })
    callback(nearby, closest)
}
function emitEnemyCastSkill(enemId, skillName, targetId, pos, placeId) {
    getSocket().emit("enemyWillCastSkill", {
        currentPlaceId: placeId,
        _id: enemId,
        skillName,
        targetId,
        pos,
    })
}
function emitEnemyDodge(enemId, dest, placeId) {
    getSocket().emit("enemyWillDodge", {
        currentPlaceId: placeId,
        _id: enemId,
        x: dest.x,
        z: dest.z,
    })
}
function emitEnemyTeleport(enemId, dest, placeId) {
    getSocket().emit("enemyWillTeleport", {
        currentPlaceId: placeId,
        _id: enemId,
        x: dest.x,
        z: dest.z,
    })
}

export function enemyIsHit(data){
    const charState = getCharState()
    if(!charState) return
    const { playerId, targetId, dmgToApply, currentPlaceId, hp, maxHp } = data
    const enemy = getEnemiesOnScene().find(ene => ene._id === targetId)
    if (!enemy) return
    // for weapon when hit something sound
    // playSound(soundToPlay, .9, .3)
    const enemPos = enemy.body.position
 
    poppingTextMesh(`-${Math.floor(dmgToApply)}`, "red", 40 + Math.random() * 25, Math.random() * 1, { x: -1 + Math.random() * 2, y: enemy.det.bodyHeight/2+.5, z: -1 + Math.random() * 2 }, enemy.body, true)

    enemy.hpbar.width = `${data.hp / data.maxHp * 100 * 3}px`
    // keep the underlying data live-synced too, not just the visual bar -
    // enemy.det is the enemy's original spawn-data object and previously
    // never got touched here, so det.hp stayed frozen at spawn value
    // forever while only the bar width tracked the server's broadcast hp.
    // Needed so anything that wants "this enemy's current hp" (e.g.
    // abyssaldamnationSkill's absorb effect in skillEffects.js) reads a
    // real, live number instead of a stale spawn-time one.
    enemy.det.hp = data.hp
    playRandomAnim(enemy.anims, "hit")
    enemy.hitSound?.play()

    const player = getPlayersOnScene().find(pl => pl.owner === playerId)
    if(!player) return
    lookAt(enemy.body, player.body.position) // enemy will look on the player

    // console.log(`killer ID: ${playerId}`)
    // console.log(`${player.name}`)
    // console.log(`my own ID: ${getCharState().owner}`)


    if (playerId === getCharState().owner){
        const { hasWeapon } = getAttackInfo()
        if(hasWeapon) {
            playSound(getAllSounds().swordS1)
        }else playSound(getAllSounds().punchedS)
    }

    if (data.hp <= 0) {
        // this enemy's own body is about to get disposed below (enemyDispose) -
        // if it was the one positionAtkCollider's dash was biasing toward,
        // clear it now so the next attack falls back to local forward
        // instead of reading .position off a disposed mesh
        if(lastHitEnemy === enemy) setLastHitEnemy(null)
        enemy.deathSound?.play()
        removeEnemyOnScene(targetId)
        clearInterval(enemy.intervalWillAttack)
        playAnim(enemy.anims, "death")
        enemyDispose(enemy)
        // if (enemy.deathSound) {
        //     enemy.deathSound.attachToMesh(enemy.body)
        //     enemy.deathSound.play()
        // }
        // TEMP DIAGNOSTIC - remove once the "other player also gets exp"
        // report is confirmed/resolved. Every code path granting exp
        // (gainExp, only ever called from defeatedAmonster) is already
        // gated on this exact comparison - if it's STILL happening, this
        // will show on the NEXT repro whether the gate itself is failing
        // (playerId genuinely !== my own owner but defeatedAmonster still
        // ran - a real bug) or whether it's passing correctly (both
        // "players" actually share the same owner id, e.g. two windows
        // logged into the same account/character for a local multiplayer
        // test - not a bug, just the same identity on both screens).
        // console.log(`[exp-gate] killerPlayerId=${playerId} myOwnOwner=${getCharState().owner} willGrantExpToMe=${playerId === getCharState().owner}`)
        if (playerId === getCharState().owner) {
            
            defeatedAmonster(enemy.det)
            // getSocket().emit('enemyChangeTarget', { _id: targetId, newTargetId: null })
        }
        return getSocket().emit("removeEnemy", {enemyId: targetId})        
    }
}
export function defeatedAmonster(data){
    const {name,dn, monsSoul,skills,effects,effectsWhenHit, loots, expToGain} = data

    const characterState = getCharState()
    characterState.monsSoul += monsSoul
    if(expToGain) gainExp(expToGain)
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
    console.log(characterState.quests)
    // getSocket().emit('respawnEnemy', data)
}
// ENEMY WHEN HIT RELATED
export function enemyDispose(enemy) {
    removeEnemyBind(enemy._id) // stop the spin observer/pending timeout - body.dispose() below takes the mesh itself with it either way
    curseAppliedIds.delete(enemy._id) // the arcs themselves clean up on their own (see applyEnemyCurse), this just stops tracking a dead id
    enemy.hpbar.width = `0px`
    enemy.hpmesh.dispose()
    enemy.anims.forEach(anim => anim.name === "death" ? anim.play() : anim.stop())
    // enemy.fshadow.dispose()

    setTimeout(() => {
        enemy.anims.forEach(anim => anim?.dispose())
        enemy.meshes.forEach(chld => chld.dispose())
        enemy.body.dispose()
        enemy.chaseDetector.dispose()
        enemy.nameMesh.dispose()
        enemy._cursedLabel?.dispose() // only exists if this enemy was ever cursed (applyEnemyCurse)
        // hpmesh already disposed synchronously above, right when this
        // function first ran (not re-disposed here - was a stray leftover)
        enemy.hpbar.dispose()
    }, 2000)
}

// ENEMY BIND (skill.enemyBind, see skillsData.js's radiantjudgmentSkill and
// skillEffects.js's hit handler) - "disable the enemy: cannot move, cannot
// attack, cannot do anything" for bindDuration seconds. tcp/index.ts's
// enemyBind handler is the actual timer/state authority (flips _disabled
// back off server-side and broadcasts "enemy-unbound" to every client, see
// worldsocket.js) - this file only reacts to that broadcast: toggling the
// local _disabled flag (which attack()/renderer.js's movement loop both
// check) and showing/hiding the bind mesh itself.
//
// targetId -> { mesh, observer, timeoutId } - timeoutId here is only a
// client-side safety net in case the server's "enemy-unbound" broadcast is
// ever missed (dropped message, this client reconnecting mid-bind, etc.),
// not the source of truth for how long the bind lasts.
const enemyBindEntries = new Map()

// mesh/observer/timeout teardown only - deliberately does NOT touch
// enemy._disabled/resumeAttack (removeEnemyBind, below, does both). Needed
// as its own function so applyEnemyBind can clear a stale leftover visual
// without also immediately undoing the bind it's in the middle of applying -
// calling the full removeEnemyBind for that would flip _disabled back off
// (and even resume attacking) a few lines after just turning it on.
function disposeBindVisual(targetId){
    const entry = enemyBindEntries.get(targetId)
    if(!entry) return
    clearTimeout(entry.timeoutId)
    if(entry.mesh){
        if(entry.observer) entry.mesh.getScene()?.onBeforeRenderObservable.remove(entry.observer)
        entry.mesh.dispose()
    }
    enemyBindEntries.delete(targetId)
}

export function applyEnemyBind(scene, targetId, shape, bindDuration){
    const enemy = getEnemiesOnScene().find(ene => ene._id === targetId)
    if(!enemy) return

    disposeBindVisual(targetId) // clear a stale bind visual/timer first, just in case (shouldn't normally overlap)

    enemy._disabled = true
    enemy._isMoving = false
    clearInterval(enemy.intervalWillAttack)

    let mesh = null
    if(shape === "torus"){
        // encircles the whole body, roughly torso height - a "seal" holding
        // it in place, not just a ring at its feet. CreateTorus's default
        // orientation already lies flat (ring in the XZ-plane, hole along Y -
        // confirmed straight from torusBuilder.pure.js's vertex generation,
        // which sweeps the main ring with RotationY), so no extra rotation
        // is needed to get a ring encircling a Y-up body - an earlier
        // rotation.x = Math.PI/2 here stood it up on its edge instead
        // (visibly wrong - see the bug report this fixed). And since the
        // hole IS the Y axis, spinning around Y would be invisible anyway
        // (rotationally symmetric about its own axis) - not animating it at
        // all, rather than spinning it uselessly every frame for nothing.
        const diameter = Math.max(enemy.det.bodyWidenes * 1.8, 1)
        mesh = MeshBuilder.CreateTorus(`bind.${targetId}`, { diameter, thickness: diameter * 0.045, tessellation: 28 }, scene)
        mesh.parent = enemy.body
        mesh.position = new Vector3(0, 0, 0)
        mesh.isPickable = false
        mesh.material = createGlowingMat(scene, "white")
        addGlow(scene, mesh, 0.5)
    } else if(shape === "box"){
        // a full cage enclosing the whole body, not just a torso-height ring -
        // enemy.body's own local origin already sits at roughly the body's
        // vertical center (see spawn: groundY + bodyHeight/2, then
        // mainBodyMeshes shifted down by bodyHeight/2 to compensate), so a box
        // sized to det.bodyHeight and centered at (0,0,0) naturally spans feet
        // to head with no extra vertical offset needed, same as the torus's
        // own (0,0,0) above. width/depth reuse the torus's own bodyWidenes*1.8
        // scale-up so both bind shapes read as roughly the same "size" choice,
        // just applied to a box instead of a ring diameter.
        const width = Math.max(enemy.det.bodyWidenes * 1.8, 1)
        const height = enemy.det.bodyHeight * 1.05 // slight margin so the body doesn't clip through the cage faces
        mesh = MeshBuilder.CreateBox(`bind.${targetId}`, { width, depth: width, height }, scene)
        mesh.parent = enemy.body
        mesh.position = new Vector3(0, 0, 0)
        mesh.isPickable = false
        // fresnelMat instead of createGlowingMat (unlike the torus above) -
        // a hollow, translucent-shell energy cage reads better for "trapped
        // inside a box" than a solid opaque glowing brick would. Matches
        // lightpierceSkill's own projectile shape ("box", see its
        // projectileVisual in skillsData.js) rather than reusing that flying
        // projectile mesh itself, which is already disposed by the time this
        // runs - same "own dedicated mesh, not the projectile" approach the
        // torus branch above already takes.
        mesh.material = fresnelMat(scene, "white")
        addGlow(scene, mesh, 0.5)
    }

    const timeoutId = setTimeout(() => removeEnemyBind(targetId), bindDuration * 1000 + 300)
    enemyBindEntries.set(targetId, { mesh, observer: null, timeoutId })
}

export function removeEnemyBind(targetId){
    const enemy = getEnemiesOnScene().find(ene => ene._id === targetId)
    if(enemy){
        const wasDisabled = enemy._disabled
        enemy._disabled = false
        // resume straight into attacking if it still has a target instead of
        // waiting on the next atkDetection enter/exit trigger, which won't
        // refire if the player never actually left attack range during the bind
        if(wasDisabled && enemy._targetId) enemy.resumeAttack?.()
    }

    disposeBindVisual(targetId)
}

// ENEMY CURSE (dark magic's element-level hit rule, see skillsData.js's
// header comment and skillEffects.js's hit handler) - permanent for the
// rest of this enemy's life, no timer/duration like the bind above. tcp/
// index.ts's enemyCurse handler is the _cursed authority; the actual
// damage-reflection this causes lives in worldsocket.js's "enemy-attacked"
// handler, not here - this file only owns the flag + the visual.
//
// targetId Set, not a Map - unlike the bind there's nothing to ever tear
// down early (no un-curse), so all this tracks is "don't attach a second
// set of arcs if a second dark hit lands on an already-cursed enemy".
const curseAppliedIds = new Set()

export function applyEnemyCurse(scene, targetId){
    const enemy = getEnemiesOnScene().find(ene => ene._id === targetId)
    if(!enemy) return

    enemy._cursed = true
    if(curseAppliedIds.has(targetId)) return // arcs already crackling around it
    curseAppliedIds.add(targetId)

    // "cursed" label - same createTextMesh nameMesh itself uses (see its own
    // creation above), parented to enemy.body so it billboards/follows
    // along for free, stacked just above the name tag rather than
    // overlapping it. Stored on the enemy so enemyDispose can clean it up
    // like every other per-enemy mesh (nameMesh/hpmesh/etc).
    enemy._cursedLabel = createTextMesh(scene, enemy.body, "cursed", "purple", { x: 0, y: enemy.det.bodyHeight / 2 + 0.85, z: 0 }, 30)

    // weaponGlow: false - only spawns the crackling arc tubes, doesn't touch
    // the enemy's own body material. weaponGlow: true would flatten every
    // child mesh's material to a plain glow color, wiping out the actual
    // monster skin/texture underneath - fine for a small weapon mesh
    // (see PROJECTILE_STYLES.lightning in skillEffects.js), not for a whole
    // character body with its own material already set up. No light
    // (withLight: false) - one extra PointLight per cursed enemy adds up.
    // Disposes itself automatically when enemy.body is disposed (on death) -
    // see attachLightning's own onDisposeObservable wiring, same as
    // PROJECTILE_STYLES.lightning already relies on.
    attachLightning(scene, enemy.body, "purple", false, { arcCount: 2, width: 0.015, updateInterval: 140, withLight: false })
}