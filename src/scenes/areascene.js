import { ArcRotateCamera, SceneLoader, HemisphericLight, MeshBuilder, Scene, Vector3, Color3, Texture, PBRMaterial, StandardMaterial, MultiMaterial, GlowLayer, PhysicsShapeGroundMesh, PhysicsShapeMesh, PhysicsAggregate, Mesh, VertexData, VertexBuffer } from "@babylonjs/core"
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
import { getVillageAssetRegistry } from "../components/assetregistry.js";
import { getSocket, joinWorld } from "../sockets/joinsocket.js";
import { changeScene, getEngine, setGameStatus } from "../main/main.js";
import { getCharState, initiateCharacter, setCanPress, setCharStateMode, updateMyDetailsOL } from "../charactersystem/characterstate.js";
import { createMyCharacter } from "../charactersystem/createMyCharacter.js";
import { pushPlayer, setSocketContainers, playSocketScene } from "../sockets/worldsocket.js";
import { openCloseInteractBtn, openCloseLScreen, openClosePopup } from "../tools/popupUI.js";
import { checkIfTokenSaved, randomNum } from "../tools/tools.js";
import { startMyOwnSpeech } from "../components/conversations.js";
import { loadMeshOnlyParts } from "../tools/loadmodel.js";
import { spawnProjectile } from "../creations/skills.js";
import {emitMyLoc, runEmitMyLocInterval } from "../sockets/emits.js";
import { disableEnableAttackButtonsContainer, hideShowAllScreenUI, openCloseLifeDisplay, showHideIcons } from "../charactersystem/uimanagement.js";
import { obtain, reduceDurability } from "../charactersystem/inventory.js";
import createAllNpcInArea from "../npc/createAllNpcInArea.js";
import { exitScene } from "../sockets/exitsocket.js";
import { onIntersecEnterTrig, onIntersecExitTrig } from "../components/actionManager.js";
import { createFireParticles } from "../tools/particlesystem.js";
import { initSounds, getAllSounds, playSound } from "../components/soundSystem.js";
import { createOriginal, createSky } from "../creations/creationTools.js";
import { setWorldChatAvailable } from "../components/worldChatSystem.js";
import { faceForward } from "../controllers/inputMovement.js";
import { createLootItem } from "../staticRecources/resourceLoot.js";
import { attachLightning } from "../effects/lightning.js";
import { createOpenWorld, SPAWN_X, SPAWN_Z, terrainHeight } from 'infterrain'
import { showGamePerformanceUI } from "babylonstats"

export async function areaScene(placeDetail){
    // showHideIcons()
    const { placeId, sceneTemp, isMultiplayer } = placeDetail
    const spawnPos = getSpawnPos(placeDetail);
    const scene = new Scene(getEngine())
    const cam = createArcCam(scene, placeDetail)
    const light = setupLighting(scene, placeDetail)

    await initializePhysics(scene);

    const allsounds = initSounds(scene);

    let reg
    if(placeDetail.areaType === "village"){
        reg = await getVillageAssetRegistry()
    }
    const animeBodyContainer = await loadAvatarContainer("./models/avatar/avatar.glb", scene)
    let goblinRoot = await loadAvatarContainer("./models/monsters/goblin.glb", scene)
    let monolithRoot = await loadAvatarContainer("./models/monsters/monolith.glb", scene)
    let slimeRoot = await loadAvatarContainer("./models/monsters/slime.glb", scene)

    const HairModel = await SceneLoader.ImportMeshAsync("", "./models/avatar/", "hairModels.glb", scene)
    const helmets = await SceneLoader.ImportMeshAsync("", "./models/helmets/", "helmets.glb", scene)
    helmets.meshes.forEach(m => m.isVisible = false)
    const gauntlets = await SceneLoader.ImportMeshAsync("", "./models/gauntlets/", "gauntlets.glb", scene)
    gauntlets.meshes.forEach(m => m.isVisible = false)
    const pauldrons = await SceneLoader.ImportMeshAsync("", "./models/pauldrons/", "pauldrons.glb", scene)
    pauldrons.meshes.forEach(m => m.isVisible = false)
    // const helmets = await loadModel("./models/helmets/helmets.glb", scene, true)
  
    const allweaponParts = await loadMeshOnlyParts("./models/swords/allswords.glb", scene)

    const containers = setSocketContainers({
        hairs: HairModel.meshes,
        animeBody: animeBodyContainer,
        allweapons: allweaponParts,
        helmets: helmets.meshes,
        gauntlets: gauntlets.meshes,
        pauldrons: pauldrons.meshes,
        armors: null,
        belts: null,
        cloaks: null,

        goblinRoot,
        monolithRoot,
        slimeRoot
    })
    
    const charState = await initiateCharacter(checkIfTokenSaved())
    const myCharacter = createMyCharacter(charState, scene, allsounds)
    pushPlayer(myCharacter)

    switch(placeDetail.areaType){
        case "village":
            createVillage(scene, placeDetail, reg, myCharacter.body)
            // createSky(light, scene, false)
        break;
        case "room":
            createRoom(scene, placeDetail, myCharacter.body);
        break;
        case "openworld":
            // Use the InfiniteTerrain here
              const sun = new HemisphericLight('sun', new Vector3(0.5, 1, 0.3), scene)
            sun.intensity   = 1.6
            sun.diffuse     = new Color3(1.00, 0.94, 0.84)
            sun.groundColor = new Color3(0.27, 0.37, 0.22)
            scene.fogMode  = Scene.FOGMODE_LINEAR
            scene.fogColor = new Color3(0.65, 0.78, 0.88)
            scene.fogStart = 400
            scene.fogEnd   = 1400
            const {chunks} = await createOpenWorld(scene, {
                // viewRadius: 1,
                // verts: 12, // 17 // 36
                onChunkBuilt: (mesh) => { 
                    createAggregate(mesh, { mass: 0 }, 'mesh', scene)
                    // PhysicsShapeGroundMesh (havokPlugin.js's _createOptionsFromGroundMesh)
                    // stores heights as (y - minY) and implicitly assumes the mesh's own
                    // .position already sits at its bounding-box center - true for a plain
                    // MeshBuilder.CreateGround() mesh, but infterrain's chunks bake absolute
                    // world coordinates directly into every vertex and leave mesh.position
                    // at (0,0,0). Left as-is, every chunk's heightfield body gets placed at
                    // world (0,~0,0) instead of its actual location - whichever chunk's
                    // misplaced surface happens to intersect near the player is what they
                    // land on, at the wrong height. Building an invisible, re-centered proxy
                    // (real position = chunk's true world center, geometry shifted to be
                    // local to that center) satisfies the assumption without touching
                    // infterrain's rendering mesh at all.
                    // try {
                    //     const positions = mesh.getVerticesData(VertexBuffer.PositionKind)

                    //     mesh.computeWorldMatrix(true)
                    //     const center = mesh.getBoundingInfo().boundingBox.centerWorld.clone()

                    //     let minY = Infinity, maxY = -Infinity
                    //     for (let i = 1; i < positions.length; i += 3) {
                    //         if (positions[i] < minY) minY = positions[i]
                    //         if (positions[i] > maxY) maxY = positions[i]
                    //     }

                    //     const localPositions = new Float32Array(positions.length)
                    //     for (let i = 0; i < positions.length; i += 3) {
                    //         localPositions[i]     = positions[i]     - center.x
                    //         localPositions[i + 1] = positions[i + 1] - center.y
                    //         localPositions[i + 2] = positions[i + 2] - center.z
                    //     }

                    //     const proxy = new Mesh(`${mesh.name}_physproxy`, scene)
                    //     const vd = new VertexData()
                    //     vd.positions = localPositions
                    //     vd.indices = mesh.getIndices()
                    //     vd.applyToMesh(proxy)
                    //     proxy.position.copyFrom(center)
                    //     proxy.isVisible = false
                    //     proxy.isPickable = false

                    //     // testing PhysicsShapeMesh instead of PhysicsShapeGroundMesh/HEIGHTFIELD -
                    //     // same recentering, different shape type, to isolate whether HEIGHTFIELD
                    //     // itself is the broken part rather than the positioning
                    //     const groundShape = new PhysicsShapeMesh(proxy, scene)
                    //     new PhysicsAggregate(proxy, groundShape, { mass: 0 }, scene)

                    //     mesh.onDisposeObservable.add(() => proxy.dispose())

                    //     // self-test: raycast straight down through THIS chunk's own center,
                    //     // guaranteed to be over its own ground - isolates "proxy construction
                    //     // doesn't work at all" from "proxy works but isn't where the player is"
                    //     const physicsEngine = scene.getPhysicsEngine()
                    //     const selfTestResult = physicsEngine.raycast(
                    //         new Vector3(center.x, center.y + 500, center.z),
                    //         new Vector3(center.x, center.y - 500, center.z)
                    //     )
                    //     // console.log(`[terrain] ${mesh.name} rawVertY=[${minY.toFixed(1)}, ${maxY.toFixed(1)}] center=`, center.asArray().map(n => n.toFixed(1)),
                    //     //     ' SELF-TEST raycast hasHit=', selfTestResult?.hasHit, ' hitY=', selfTestResult?.hitPointWorld?.y, ' hitBody=', selfTestResult?.body?.transformNode?.name)
                    // } catch (err) {
                    //     console.error(`[terrain] onChunkBuilt FAILED for ${mesh.name}:`, err)
                    // }
                },
                onChunkDisposed: (mesh) => {
                    // proxy (and its physics body) disposed via mesh.onDisposeObservable above
                }
            })
            showGamePerformanceUI(scene.getEngine(), scene, chunks)
            // chunks only ever get queued/built around infterrain's own SPAWN_X/SPAWN_Z
            // (world.js: 0, 500) - dropping the player anywhere else means there's no
            // terrain built under them at all, physics or not. Spawning right at the
            // real ground height (instead of dropping from a fixed y and hoping physics
            // catches it) sidesteps fall-speed/tunneling risk entirely - this runs once,
            // not per-chunk like the old myCharacter.body.position.y assignment did.
            // myCharacter.body.position.x = SPAWN_X
            // myCharacter.body.position.z = SPAWN_Z
            // myCharacter.body.position.y = terrainHeight(SPAWN_X, SPAWN_Z) + 10

            // teleporting .position directly doesn't necessarily wake a physics body Havok
            // has flagged as resting/asleep - setting velocity to exactly zero probably reads
            // as "no change, stay asleep". A tiny non-zero nudge is a real perturbation that
            // should force an actual wake through the physics API instead of just theorizing it.
            // if (myCharacter.aggregate?.body) {
            //     myCharacter.aggregate.body.setLinearVelocity(new Vector3(0, -0.5, 0))
            // }

            // console.log(`[terrain] terrainHeight(${SPAWN_X},${SPAWN_Z}) =`, terrainHeight(SPAWN_X, SPAWN_Z), ' spawnY set to', myCharacter.body.position.y)
            // console.log('[terrain] character aggregate motionType/mass check - body exists?', !!myCharacter.aggregate?.body)
            // for (let s = 1; s <= 3; s++) {
            //     setTimeout(() => {
            //         const vel = myCharacter.aggregate?.body?.getLinearVelocity()
            //         console.log(`[terrain] t+${s}s: y=`, myCharacter.body.position.y.toFixed(3),
            //             ' velocity=', vel ? [vel.x.toFixed(3), vel.y.toFixed(3), vel.z.toFixed(3)] : 'NO BODY')
            //     }, s * 1000)
            // }
            // setTimeout(() => {
            //     const physicsEngine = scene.getPhysicsEngine()
            //     // start BELOW the character's current resting spot so the ray can't hit its own capsule
            //     const startY = myCharacter.body.position.y - 1
            //     const origin = new Vector3(SPAWN_X, startY, SPAWN_Z)
            //     const end    = new Vector3(SPAWN_X, -5000, SPAWN_Z)
            //     const result = physicsEngine.raycast(origin, end)
            //     console.log(`[terrain] 3s after spawn - raycast DOWN FROM BELOW CHARACTER (y=${startY.toFixed(2)}) at (${SPAWN_X},${SPAWN_Z}):`,
            //         ' hasHit=', result?.hasHit,
            //         ' hitY=', result?.hitPointWorld?.y,
            //         ' hitBodyName=', result?.body?.transformNode?.name,
            //         ' actualCharacterY=', myCharacter.body.position.y,
            //         ' terrainHeight()=', terrainHeight(SPAWN_X, SPAWN_Z))
            // }, 3000)
        break;
    }
    
    if(placeDetail.originalGlbs && placeDetail.originalGlbs.length > 0){
        placeDetail.originalGlbs.forEach( async origin => {
            console.log(origin)
            await createOriginal(scene, origin.pos, origin.rot, origin.textures, origin.glbPath)
        })
    }

    if(placeDetail.optionalObjects && placeDetail.optionalObjects.length > 0){
        placeDetail.optionalObjects.forEach(async item => {
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
                console.log(`[${item.name}] material is PBRMaterial — setting unlit`)
                // model.material.unlit = true
            } else if (model.material instanceof StandardMaterial) {
                console.log(`[${item.name}] material is StandardMaterial — disabling lighting`)
                model.material.disableLighting = true
            } else {
                console.log(`[${item.name}] material type:`, model.material?.getClassName())
            }
        })
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
                console.log(res.position)
                faceForward(res.position)
                setCharStateMode("minning")
                currentMiningResource = res
                myCharacter.equipSword(hasWeaponEquipped.name, true, hasWeaponEquipped.parts, hasWeaponEquipped.weaponType)
                emitMyLoc("minning", hasWeaponEquipped.name)
            }

            onIntersecEnterTrig(collider, myCharacter.body, scene, () => {
                openCloseInteractBtn("pickaxe", true, () => startMining())
            })
            onIntersecExitTrig(collider, myCharacter.body, scene, stopMining)
        })
    }

    placeDetail.roomPaths?.forEach(path => {
        const { name, pos,startingPos, placeId ,areaType } = path
        const pathTrigger = MeshBuilder.CreateBox(`trig_${placeId}`, { }, scene)
        pathTrigger.position = new Vector3(pos.x, pos.y, pos.z)
        pathTrigger.isVisible = false
        pathTrigger.isPickable = false

        onIntersecEnterTrig(pathTrigger, myCharacter.body, scene, () => {
            openCloseInteractBtn("normal", true, async () => {
                openCloseInteractBtn(false)

                const charState = getCharState()

                charState.currentPlace.placeId = placeId
                charState.currentPlace.name = name
                charState.currentPlace.areaType = areaType

                charState.x = startingPos.x
                charState.y = startingPos.y
                charState.z = startingPos.z

                const newCharData = await updateMyDetailsOL(charState, checkIfTokenSaved(), true, true)
                exitScene(charState.owner)
                await changeScene("whatever")
            })
        })
        onIntersecExitTrig(pathTrigger, myCharacter.body, scene, () => {
            openCloseInteractBtn(false, false)
        })
    })
    // createAllNpcInArea(BABYLON, myHeroDatabase, hero, scene, freeCam, wearableTex, characterRoot, swords, helmets, armors, HairModel.meshes, mainShadow)

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

    // const rod = MeshBuilder.CreateBox("lightningrod", { depth: 2, size: 0.05}, scene)
    // rod.position.y += 1

    // setTimeout(() => {
    //     attachLightning(scene, rod, "blue")
    //     setTimeout(() => {
    //         attachLightning(scene, rod, "blue", true, {width: 0.001})
    //         attachLightning(scene, rod, "blue", true, {width: 0.004})

    //     }, 2000)

    // }, 1000)

    return {scene, isSocketOn: isMultiplayer }
}