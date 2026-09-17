import { ArcRotateCamera, SceneLoader, HemisphericLight, MeshBuilder, Scene, Vector3, Color3, Texture, PBRMaterial, StandardMaterial, MultiMaterial, GlowLayer, PhysicsShapeGroundMesh, PhysicsAggregate, Mesh, DirectionalLight, ConeParticleEmitter, ParticleSystem, Color4 } from "@babylonjs/core"
import { createMatV2, dungeonMaterial } from "../tools/materials.js";
import { createDungeon } from "../creations/createdungeon.js";
import { createArcCam, attachCam } from "../tools/camera.js";
import { setupLighting } from "../tools/lighting.js";
import { createAggregate, initializePhysics } from "../tools/physics.js";
import { createRock, createOre } from "../assetcreation/createRock.js";
import { loadAvatarContainer, loadModel, mergeAndLoadModel } from "../tools/loadmodel.js";
import { createSunRay } from "../tools/sunrays.js";
import { sceneCleanupReady } from "../components/cleanup.js";
import { getSpawnPos } from "../tools/position.js";
import { createArea } from "../creations/createArea.js";
import { createVillage } from "../creations/createvillage.js";
import { createRoom } from "../creations/createroom.js";
import { createCastle } from "../creations/createcastle.js";
import { createStoneScriptures } from "../creations/createstonescripture.js";
import { createDuelArena } from "../creations/createduelarena.js";
import { startDuel } from "../npc/duelSystem.js";
import { getVillageAssetRegistry } from "../components/assetregistry.js";
import { getSocket, joinWorld } from "../sockets/joinsocket.js";
import { getEngine, setGameStatus } from "../main/main.js";
import { travelToPlace } from "../tools/travel.js";
import { getCharState, initiateCharacter, setAllowDeath, setCanPress, setCharStateMode } from "../charactersystem/characterstate.js";
import { createMyCharacter } from "../charactersystem/createMyCharacter.js";
import { pushPlayer, playSocketScene, getEnemiesOnScene } from "../sockets/worldsocket.js";
import { openCloseInteractBtn, openCloseLScreen, openClosePopup } from "../tools/popupUI.js";
import { checkIfTokenSaved, randomNum } from "../tools/tools.js";
import { startMyOwnSpeech } from "../components/conversations.js";
import { loadMeshOnlyParts } from "../tools/loadmodel.js";
import { spawnProjectile } from "../creations/skills.js";
import {emitMyLoc, runEmitMyLocInterval } from "../sockets/emits.js";
import { disableEnableAttackButtonsContainer, hideShowAllScreenUI, openCloseLifeDisplay, showHideIcons } from "../charactersystem/uimanagement.js";
import { obtain, reduceDurability } from "../charactersystem/inventory.js";
import createAllNpcInArea from "../npc/createAllNpcInArea.js";
import { onIntersecEnterTrig, onIntersecExitTrig } from "../components/actionManager.js";
import { createFireParticles } from "../tools/particlesystem.js";
import { initSounds, getAllSounds, playSound } from "../components/soundSystem.js";
import { createOriginal, createSky, createMainShadow, putFakeShadow } from "../creations/creationTools.js";
import { setWorldChatAvailable } from "../components/worldChatSystem.js";
import { clearLocTimeOut, faceForward } from "../controllers/inputMovement.js";
import { createLootItem } from "../staticRecources/resourceLoot.js";
import { attachLightning } from "../effects/lightning.js";
import { capsuleHeight } from "../charactersystem/createcharacter.js";
import { createOpenWorld, createOpenWorldGrass, SPAWN_X, SPAWN_Z, terrainHeight } from 'infterrain'
import { showGamePerformanceUI } from "babylonstats"
import { setStartingContainers } from "./containers.js";
import { registerToAtkCollider } from "../charactersystem/attackingSystem.js";
import { createGroundWeapon } from "../assetcreation/creategroundweapon.js";
import { createTreasureMesh } from "../assetcreation/createtreasure.js";
import { receiveAchievement } from "../charactersystem/achievement.js";

export async function areaScene(placeDetail){
    // showHideIcons()
    const { placeId, sceneTemp, isMultiplayer } = placeDetail
    const spawnPos = getSpawnPos(placeDetail);
    const scene = new Scene(getEngine())
    const cam = createArcCam(scene, placeDetail)
    const lights = setupLighting(scene, placeDetail)
    // const light = new DirectionalLight("asd", new Vector3(-1,-1, 1), scene)
    // scene.fogMode = Scene.FOGMODE_EXP;
    // scene.fogColor = new Color3(1,0,0.2);
    // scene.fogDensity = 0.01;
    const fakeShadowRoot = createMainShadow(scene)

    await initializePhysics(scene);

    const allsounds = initSounds(scene);

    // const wagon = await SceneLoader.ImportMeshAsync("", "", "./models/outdors/wagon.glb", scene);
    // wagon.meshes[0].position = new Vector3(0, 2, 503);
    let reg
    if(placeDetail.areaType === "village"){
        reg = await getVillageAssetRegistry()
    }
    await setStartingContainers(scene)
    
    const charState = await initiateCharacter(checkIfTokenSaved())
    const myCharacter = createMyCharacter(charState, scene, allsounds)
    pushPlayer(myCharacter)

    // default true (normal death) on every scene load - only the "duel" case
    // below overrides it. This is what makes duelSystem.js's soft-loss
    // self-correcting on any way out of the arena (win, lose, or just
    // walking out the exit trigger) instead of needing to remember to flip
    // it back manually on every one of those paths - see characterstate.js's
    // own comment on setAllowDeath for the full reasoning.
    setAllowDeath(true)

    switch(placeDetail.areaType){
        case "village":
            createSky(lights[0], scene, false)
            createVillage(scene, placeDetail, reg, myCharacter.body)
            // createSky(light, scene, false)
        break;
        case "room":
            createRoom(scene, placeDetail, myCharacter.body);
        break;
        case "duel":
            createDuelArena(scene, placeDetail, myCharacter.body);
            setAllowDeath(false)
            startDuel(scene, myCharacter.body, placeDetail);
        break;
        case "openworld":
            receiveAchievement("into-the-wild")
            createSky(lights[0], scene, true)
            // real ShadowGenerator didn't work here - infterrain's streaming chunk
            // mesh/material isn't set up to receive a projected shadow map, and a
            // directional light's shadow frustum doesn't track a moving player over
            // an effectively unbounded terrain anyway. Blob shadow instead - same
            // trick already wired up (but unused) for enemies in createEnemy.js.
            
            
            // Use the InfiniteTerrain here
            //   const sun = new HemisphericLight('sun', new Vector3(0.5, 1, 0.3), scene)
            // sun.intensity   = 1.6
            // sun.diffuse     = new Color3(1.00, 0.94, 0.84)
            // sun.groundColor = new Color3(0.27, 0.37, 0.22)
            // scene.fogMode  = Scene.FOGMODE_LINEAR
            // scene.fogColor = new Color3(0.65, 0.78, 0.88)
            // scene.fogStart = 400
            // scene.fogEnd   = 1400

            const {chunks} = await createOpenWorld(scene, [
                "./models/trees/tree_1.glb",
                "./models/trees/dead_tree_1.glb",
                "./models/trees/deadtree1.glb" ], "./images/fakeprops/faketree.webp", 
            
                {
                    viewRadius: 1,
                    verts: 17,//12 // 17 // 36
                // 'mesh' shape never collides in this Havok build (confirmed: raycast
                // AND real dynamic-body contact both fail on every chunk). 'box' DOES
                // collide (confirmed) but createAggregate's box auto-fit uses the
                // chunk's full bounding box, so the player rests on top of each
                // chunk's tallest point instead of following the actual slope.
                //
                // PhysicsShapeGroundMesh (HEIGHTFIELD) is Havok's real terrain shape -
                // it reads the chunk mesh's geometry once (via _createOptionsFromGroundMesh
                // in havokPlugin.js) into a height matrix relative to the mesh's WORLD
                // min corner, then expects the shape to be centered at the body's local
                // origin (0,0,0) in X/Z and offset by minY in Y. So the body carrying
                // this shape can't be the chunk mesh itself (whose .position is the
                // corner, not the center) - it needs its own anchor positioned at
                // (boundingBox.centerWorld.x, boundingBox.minimumWorld.y, boundingBox.centerWorld.z).
                // The anchor has no geometry of its own; PhysicsShapeGroundMesh only reads
                // `mesh`'s vertex data once at construction time to build the height matrix.
                onChunkBuilt: (mesh) => {
                    mesh.computeWorldMatrix(true)
                    const bb = mesh.getBoundingInfo().boundingBox

                    const anchor = new Mesh(`${mesh.name}_groundAnchor`, scene)
                    anchor.position.set(bb.centerWorld.x, bb.minimumWorld.y, bb.centerWorld.z)
                    anchor.isVisible = false
                    anchor.isPickable = false

                    const groundShape = new PhysicsShapeGroundMesh(mesh, scene)
                    const agg = new PhysicsAggregate(anchor, groundShape, { mass: 0, friction: 1, restitution: 0 }, scene)

                    mesh.onDisposeObservable.add(() => anchor.dispose())

                    const physicsEngine = scene.getPhysicsEngine()
                    const selfTest = physicsEngine.raycast(
                        new Vector3(bb.centerWorld.x, bb.centerWorld.y + 500, bb.centerWorld.z),
                        new Vector3(bb.centerWorld.x, bb.centerWorld.y - 500, bb.centerWorld.z)
                    )
                    // console.log(`[terrain] ${mesh.name} bodyMotionType=`, agg?.body?.getMotionType?.(),
                    //     ' anchorPos=', anchor.position.asArray().map(n => n.toFixed(1)),
                    //     ' expectedSurfaceY~=', bb.centerWorld.y.toFixed(1),
                    //     ' SELF-TEST hasHit=', selfTest?.hasHit, ' hitY=', selfTest?.hitPointWorld?.y, ' hitBody=', selfTest?.body?.transformNode?.name)
                }
            })

            await createOpenWorldGrass(scene, [
                { texturePath: "./images/textures/grass/flower1.jpg", qnty: 10, size: "small" },
                { texturePath: "./images/textures/grass/grass2_black.jpg", qnty: 10, size: "medium" },
                { texturePath: "./images/textures/grass/bush1.jpg", qnty: 10, size: "large" },
            ], { viewRadius: 1, verts: 12 })

            // medieval castle (placeId 888 only), ~100 units north of the
            // player's own openworld spawn (0, 500) - see createcastle.js's
            // own header comment for the full build/merge/physics rundown.
            // Called here (not from a data-driven optionalObjects entry) so
            // it can sample the REAL terrain height at (0, 600) live via
            // sampleTerrainSurfaceHeight, now that createOpenWorld above has
            // actually generated the chunk covering it - a plain
            // localroomdb.js data entry has no scene/terrain access at
            // author time to do that itself (see the witch towers' own
            // hardcoded y guess for what that limitation looks like).
            if(placeDetail.placeId === 888){
                createCastle(scene, { x: 0, z: 600 })
                // four stone scriptures, one per cardinal direction, ringed
                // 15 units out from the player's own spawn point (0, 500) -
                // see createstonescripture.js's own header comment for the
                // full "why" (ties into Vesper's post-duel warning about
                // dark beasts guarding each direction, npcDetails.js).
                // myCharacter.body - same characterBody param createRoom's
                // own exit-door trigger already takes, wiring up each
                // stone's own proximity/interact danger message.
                createStoneScriptures(scene, myCharacter.body, 0, 500, 15)
            }

            // showGamePerformanceUI(scene.getEngine(), scene, chunks)


            for (let s = 1; s <= 5; s++) {
                setTimeout(() => {
                    const pos = myCharacter.body.position
                    const vel = myCharacter.aggregate?.body?.getLinearVelocity()
                    const physicsEngine = scene.getPhysicsEngine()
                    const startY = pos.y - 1
                    const result = physicsEngine.raycast(
                        new Vector3(pos.x, startY, pos.z),
                        new Vector3(pos.x, startY - 5000, pos.z)
                    )
                }, s * 1000)
            }
        break;
    }


    // never declared before this - slashes++ below is strict-mode module
    // code, so referencing it undeclared threw a ReferenceError on every
    // single tree hit (not just the ~30% chance one), before the loot roll
    // ever ran. Nothing reads this counter yet; declared here just to stop
    // the crash and preserve whatever it was meant to track.

    registerToAtkCollider(scene, "tree", (meshHIT) => {
        console.log("hit tree")
        meshHIT.showBoundingbox = true
        console.log(meshHIT.position)
        console.log(meshHIT.name)
        if(!myCharacter.hasWeapon) return
        playSound(getAllSounds().woodcuttingS)

        if(Math.random() >= 0.7){
            // same "wood" loot factory the mining loop below already uses for
            // resources[].loots ("wood" -> LOOT_TEMPLATES.wood, resourceLoot.js)
            // - woodDetail was never actually defined anywhere, a dormant
            // ReferenceError that only fires on the ~30% roll that hits it
            const woodItem = createLootItem("wood")
            if(woodItem) obtain(woodItem)
            receiveAchievement("woodcutter")
        }
    }, true) // excludeSkillStrikes - see registerToAtkCollider's own comment: without this, casting dashstrike anywhere near a tree chopped it too, since it rides the same shared atkCollider

    const bootsItem = {
        itemId: randomNum(), // should be string also in client
        name: "leatherboots", // is also the image name
        dn: "Leather Boots",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "boots", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        equipAbilities: {
            dmg: 0, def: 0, resistance: 5, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: false, // only for weapons
        enhancedLevel: 0,
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 9 },
        qnty: 1,
        desc: "This Boots is light and useful for first time adventurers",
        rarity: "common"
    }
    // createTreasureMesh(scene, {x:2.20,y:0,z: 0}, bootsItem)
    // createTreasureMesh(scene, {x:-2.20,y:0,z: 0}, {...bootsItem, rarity: "rare", itemId: randomNum()})
    // createTreasureMesh(scene, {x:0,y:0,z: -1}, {...bootsItem, rarity: "legendary", itemId: randomNum()})

    if(placeDetail.originalGlbs && placeDetail.originalGlbs.length > 0){
        placeDetail.originalGlbs.forEach( async origin => {
            await createOriginal(scene, origin.pos, origin.rot, origin.textures, origin.glbPath)
        })
    }

    if(placeDetail.optionalObjects && placeDetail.optionalObjects.length > 0){
        // awaited (not fire-and-forget forEach) - joinWorld() below tells the
        // server we've arrived, which triggers a "userJoined" broadcast back
        // that calls createQuestPlaneMesh() looking for the "guildboard" mesh
        // by name. Without this await, whether that mesh exists yet came down
        // to a race between this GLB load and the socket round-trip - one a
        // warm/already-connected socket (i.e. any in-app scene transition,
        // as opposed to a fresh page load where the socket has to connect
        // first) usually won, leaving the board silently blank.
        await Promise.all(placeDetail.optionalObjects.map(async item => {
            if (item.name.includes("particle_fire")) {
                createFireParticles(item.position, scene)
                return
            }

            // const model = await loadModelByIndx(item.glbPath, 1, scene);
            const model = await mergeAndLoadModel(item.glbPath, scene, item.functionBeforeMerge);
            model.position = new Vector3(item.position.x, item.position.y, item.position.z);
            model.addRotation(0, item.rotation, 0);
            model.name = item.name

            if(item.bumpTexPath){
                // if model.material.unlit = true bumpTexture has no effect because there's nothing reflecting the light
                // const bumpTex = new Texture(item.bumpTexPath, scene)
                // if(!model.material) return console.log("no material")
                // model.material.bumpTexture = bumpTex
                // model.material.specularTexture = bumpTex
            }
 

            // shadowGenerator.addShadowCaster(model)
            // model.receiveShadows = true
            if(item.cbAfterMade) item.cbAfterMade(scene)
            // console.log(model.getClassName())
            if(model.getClassName() === "Mesh") createAggregate(model, item.physics.opt, item.physics.type, scene);

            if(item.diffuseTexPath){
                const mat = createMatV2(scene, item.diffuseTexPath)
                model.material = mat
                model.material.backFaceCulling  = false
                return
            }


            if (model.material instanceof MultiMaterial) {
                // console.log(`[${item.name}] MultiMaterial with ${model.material.subMaterials.length} sub-materials — setting each unlit`)
                model.material.subMaterials.forEach(sub => {
                    if (sub instanceof PBRMaterial) sub.unlit = true
                    else if (sub instanceof StandardMaterial) sub.disableLighting = true
                })
            } else if (model.material instanceof PBRMaterial) {
                // model.material.unlit = true
            } else if (model.material instanceof StandardMaterial) {
                model.material.disableLighting = true
            } else {
            }
        }))
    }

    // MINEABLE RESOURCES (ore etc.) - walk up to one, interact button shows up,
    // pressing it puts you in "minning" mode - a looping state like idle/
    // fighting (see renderer.js/animation.js), not a one-shot action anim.
    // Walking away resets it back to idle.
    if(placeDetail.resources && placeDetail.resources.length > 0){
        // fixed setInterval timing can never line up with the animation's own
        // frame-based loop cadence - AnimationGroup already fires its own
        // event every time it wraps back to the start, so just use that
        // instead of guessing a frame or a millisecond duration. Guarded so
        // re-entering the mining trigger doesn't stack a duplicate listener
        // on the same AnimationGroup each time.
        // this hook is shared by every resource (registered once on the
        // character's animation, not per-resource), so it needs to know
        // which resource is actually being mined right now to know which
        // loot table applies - startMining()/stopMining() below keep this
        // pointed at the right one.
        let currentMiningResource = null

        const miningAnim = myCharacter.anims.find(a => a.name.toLowerCase() === "minning")
        if(miningAnim && !miningAnim._hookedMiningSound){
            miningAnim.onAnimationGroupLoopObservable.add(() => {
                playSound(getAllSounds().minningS)
                const equippedWeapon = getCharState().items.find(itm => itm.itemType === "weapon" && itm.equiped)
                if(equippedWeapon) reduceDurability(equippedWeapon)

                currentMiningResource?.loots?.forEach(loot => {
                    if(Math.random() > loot.chance) return
                    const lootItem = createLootItem(loot.name)
                    if(lootItem) obtain(lootItem)
                })
                if(currentMiningResource?.resourceType === "ore") receiveAchievement("miner")
            })
            miningAnim._hookedMiningSound = true
        }

        // one shared box built once and cloned per resource, instead of
        // building fresh box geometry with MeshBuilder.CreateBox for every
        // single resource - clones share the source's vertex buffer, so it's
        // cheaper than rebuilding identical geometry over and over.
        let resourceColliderTemplate = scene.getMeshByName("resource_collider_template")
        if(!resourceColliderTemplate){
            resourceColliderTemplate = MeshBuilder.CreateBox("resource_collider_template", { size: 2 }, scene);
            resourceColliderTemplate.isVisible = false;
            resourceColliderTemplate.setEnabled(false); // template only - never used directly, just cloned
        }

        placeDetail.resources.forEach(async res => {
            // ore is a procedural mesh (see createRock.js's createOre), everything
            // else falls back to loading a glb like optionalObjects does
            const model = res.resourceType === "ore"
                ? createOre(scene, res.position)
                : await mergeAndLoadModel(res.glbPath, scene, res.functionBeforeMerge);

            if(res.resourceType !== "ore") model.position = new Vector3(res.position.x, res.position.y, res.position.z);
            model.addRotation(0, res.rotation, 0);
            model.name = res.name

            if(model.getClassName() === "Mesh" && res.physics) createAggregate(model, res.physics.opt, res.physics.type, scene);

            const collider = resourceColliderTemplate.clone(`${res.name}_collider`, model);
            collider.isVisible = false;
            collider.setEnabled(true);

            const stopMining = () => {
                openCloseInteractBtn("normal", false)
                if(getCharState().mode === "minning") setCharStateMode("idle")
                if(currentMiningResource === res) currentMiningResource = null
            }
            const startMining = () => {
                const hasWeaponEquipped = getCharState().items.find(itm => itm.itemType === "weapon" && itm.equiped)
                if(!hasWeaponEquipped){
                    // leave the interact button up as-is (still wired to this
                    // same callback) so you can just retry after equipping,
                    // without needing to walk away and back
                    openClosePopup("Required pickaxe", true, 1500)
                    return
                }

                openCloseInteractBtn("pickaxe", false)

                faceForward(res.position)
                setCharStateMode("minning")
                currentMiningResource = res
                myCharacter.equipSword(hasWeaponEquipped.name, true, hasWeaponEquipped.parts, hasWeaponEquipped.weaponType, hasWeaponEquipped.metalColor)
                emitMyLoc("minning", hasWeaponEquipped.name)
            }

            onIntersecEnterTrig(collider, myCharacter.body, scene, () => {
                openCloseInteractBtn("pickaxe", true, () => startMining())
            })
            onIntersecExitTrig(collider, myCharacter.body, scene, stopMining)
        })
    }

    // CHOPPABLE TREES - same walk-up/interact-button/looping-anim/loot
    // interaction as the resources block above, but auto-detected by mesh
    // name instead of needing an explicit placeDetail.resources entry, since
    // trees come from procedural village/openworld generation
    // (createvillage.js/infterrain), not room data. Reuses the same
    // "minning" animation/mode - there's no separate chopping animation clip.
    // NOTE: only wires up trees already present in scene.meshes at this
    // point - fine for the village (built upfront), but the open world's
    // infterrain chunks stream in as the player walks, so trees in
    // not-yet-loaded chunks won't get a collider until this runs again on a
    // fresh scene load.
    let currentChoppingTree = null
 
    placeDetail.roomPaths?.forEach(path => {
        const { name, pos,startingPos, placeId ,areaType } = path
        const pathTrigger = MeshBuilder.CreateBox(`trig_${placeId}`, { size: 2 }, scene)
        pathTrigger.position = new Vector3(pos.x, pos.y, pos.z)
        pathTrigger.isVisible = false
        pathTrigger.isPickable = false

        onIntersecEnterTrig(pathTrigger, myCharacter.body, scene, () => {

            clearLocTimeOut()

            openCloseInteractBtn("normal", true, async () => {
                openCloseInteractBtn(false)

                await travelToPlace(path)
            })
        })
        onIntersecExitTrig(pathTrigger, myCharacter.body, scene, () => {
            openCloseInteractBtn(false, false)
        })
    })
    
    // GROUND WEAPON LOOT (placeDetail.swordsStrucked, e.g. placeId 200's
    // duel grounds) - see assetcreation/creategroundweapon.js's own header
    // comment for the full "why" (rotation guess, template-instancing,
    // local-only pickup). Purely a local pickup against myCharacter.body
    // ONLY (not getPlayersOnScene()) - no other client needs to see or race
    // for it, so there's nothing multiplayer-aware to wire up here.
    placeDetail.swordsStrucked?.forEach(item => createGroundWeapon(scene, item, myCharacter.body))

    await scene.whenReadyAsync()

    createAllNpcInArea(myCharacter, scene)
    // const isTouchDevice = navigator.maxTouchPoints > 0;

    // scene.meshes.forEach(mesh => mesh.isPickable = false)
    // sceneCleanupReady(scene, createCharacterControls(player, camera, scene));


    // make your architecture to everytime you recreateMeshes from the scene
    // that has interaction with character best practise to spawn your character first
    // before thoses meshes so those meshes will just find your character and apply interaction

    if(isMultiplayer) {
        joinWorld(getCharState().currentPlace.placeId)
        setWorldChatAvailable(true)
        runEmitMyLocInterval()
        // emitMyLoc()
    }else{
        setWorldChatAvailable(false)
    }

    openCloseLScreen("normal", false)
    playSocketScene(scene)
    setCanPress(true)

    showHideIcons("block")
    if(charState.currentspeechId){
        startMyOwnSpeech()
        hideShowAllScreenUI(false)
    }else{
        disableEnableAttackButtonsContainer(true)
    }

  
    return {scene, isSocketOn: isMultiplayer }
}