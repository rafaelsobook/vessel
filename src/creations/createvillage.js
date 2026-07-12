/**
 * createVillage.js
 *
 * Builds an open-air village scene in Babylon.js from the descriptor
 * produced by generateVillageMetaData(). Mirrors the createArea.js
 * conventions (instanced floor tiles, PhysicsAggregate, PBR materials)
 * but operates on an open world — no walls or ceiling.
 *
 * Usage:
 *   import { createVillage } from './createVillage';
 *
 *   const village = generateVillageMetaData({ seed: 42, ... });
 *   createVillage(scene, village, assetRegistry);
 *
 * assetRegistry shape:
 *   {
 *     smallHouse:  [mesh0, mesh1, mesh2],   // indexed by variant
 *     mediumHouse: [mesh0, mesh1, mesh2],
 *     bigHouse:    [mesh0, mesh1],
 *     smallTree:   [mesh0, mesh1, mesh2, mesh3],
 *     mediumTree:  [mesh0, mesh1, mesh2],
 *     bigTree:     [mesh0, mesh1],
 *     lightPole:   [mesh0],
 *     grass:       [mesh0, ..., mesh4],
 *     herb:        [mesh0, ..., mesh3],
 *     mushroom:    [mesh0, mesh1, mesh2],
 *   }
 *
 * Each registry entry must be a Babylon.js Mesh already loaded into the
 * scene (e.g. via SceneLoader.ImportMesh). createVillage will call
 * createInstance() on the correct variant, so templates should have
 * isVisible = false before being passed in.
 */

import {
    Vector3,
    MeshBuilder,
    PhysicsAggregate,
    PhysicsShapeType,
    PhysicsShapeConvexHull,
    PhysicsShapeMesh,
    PhysicsBody,
    PhysicsMotionType,
    StandardMaterial,
    Color3,
    HemisphericLight,
    DirectionalLight,
    PointLight,
    PBRMaterial,
    PhysicsShapeBox,
    Quaternion
} from '@babylonjs/core';
import { createGroundMat, createPathMat } from '../tools/groundmat';
import { onIntersecEnterTrig,onIntersecExitTrig } from '../components/actionManager';
import { getCharState, setCharState, updateMyDetailsOL } from '../charactersystem/characterstate';
import { exitScene } from '../sockets/exitsocket';
import { findMyCurrentPlace, findPlaceMetaData } from '../states/placestates';
import { getEngine, changeScene, getSceneDet, getGameStatus } from '../main/main';
import { openCloseInteractBtn } from '../tools/popupUI';
import { randNum } from '../tools/random';
import { checkIfTokenSaved } from '../tools/tools';

// ─── Material helper ──────────────────────────────────────────────────────────
/**
 * Creates a StandardMaterial from a PBR-like descriptor.
 * @param {string} id
 * @param {{ albedoColor?: string, roughness?: number, metallic?: number }} cfg
 * @param {BABYLON.Scene} scene
 */


// ─── Lighting ─────────────────────────────────────────────────────────────────
/**
 * Applies the village lighting descriptor to the scene.
 * Supports 'directional', 'point', and 'hemisphere' light types.
 * @param {BABYLON.Scene} scene
 * @param {{ ambient: object, lights: object[] }} lightingData
 * @param {string} namePrefix
 */
// function applyLighting(scene, lightingData, namePrefix) {
//     const { ambient, lights } = lightingData;

//     // Ambient via a low-intensity hemispheric light pointing straight up.
//     if (ambient) {
//         const ambLight = new HemisphericLight(
//             `${namePrefix}_ambient`,
//             new Vector3(0, 1, 0),
//             scene,
//         );
//         ambLight.intensity   = ambient.intensity ?? 0.55;
//         ambLight.diffuse     = Color3.FromHexString(ambient.color ?? '#ffffff');
//         ambLight.specular    = new Color3(0, 0, 0);
//         ambLight.groundColor = new Color3(0, 0, 0);
//     }

//     (lights ?? []).forEach((l, i) => {
//         const id = `${namePrefix}_light_${i}`;

//         if (l.type === 'directional') {
//             // DirectionalLight direction = position vector normalised toward origin.
//             const dir  = new Vector3(-l.x, -l.y, -l.z).normalize();
//             const dLight = new DirectionalLight(id, dir, scene);
//             dLight.intensity = l.intensity ?? 1.0;
//             dLight.diffuse   = Color3.FromHexString(l.color ?? '#ffffff');

//         } else if (l.type === 'point') {
//             const pLight = new PointLight(id, new Vector3(l.x, l.y, l.z), scene);
//             pLight.intensity = l.intensity ?? 1.0;
//             pLight.range     = l.range     ?? 20;
//             pLight.diffuse   = Color3.FromHexString(l.color ?? '#ffffff');

//         } else if (l.type === 'hemisphere') {
//             const hLight = new HemisphericLight(id, new Vector3(0, 1, 0), scene);
//             hLight.intensity   = l.intensity ?? 0.2;
//             hLight.diffuse     = Color3.FromHexString(l.color ?? '#ffffff');
//             hLight.groundColor = new Color3(0, 0, 0);
//         }
//     });
// }

// ─── Ground plane ─────────────────────────────────────────────────────────────
function buildFloor(scene, layout, palisade, namePrefix) {
    const groundOffset = 10
    // Extend to the palisade perimeter so there's no gap under the stakes.
    const w = palisade?.outerWidth  ?? layout.width;
    const h = palisade?.outerHeight ?? layout.height;

    const ground = MeshBuilder.CreateGround(`${namePrefix}_ground`, {
        width: w+groundOffset, height: h+groundOffset, subdivisions: 1,
    }, scene);
    ground.material = createGroundMat(scene);
    ground.position.y = 0;

    const agg = new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene);
    agg.shape.material = { restitution: 0, friction: 1 };
}

// ─── Dirt paths ───────────────────────────────────────────────────────────────
/**
 * Renders each path segment as a flat quad (thin box) on top of the grass floor.
 * @param {BABYLON.Scene} scene
 * @param {object[]} paths  - [{ id, x1, z1, x2, z2, width, pbr }]
 * @param {string} namePrefix
 */
function buildPaths(scene, paths, namePrefix) {
    if (!paths?.length) return;

    const TILE = 4;

    const template = MeshBuilder.CreatePlane(`${namePrefix}_path_tmpl`, {
        width: TILE, height: TILE,
    }, scene);
    template.rotation.x  = Math.PI / 2;
    template.material    = createPathMat(scene);
    template.setEnabled(false);

    paths.forEach(tile => {
        const inst = template.createInstance(`${namePrefix}_path_${tile.id}`);
        inst.position       = new Vector3(tile.x, 0.01, tile.z);
        inst.receiveShadows = true;
    });
}

// ─── Prop placement ───────────────────────────────────────────────────────────
/**
 * Instantiates a single prop array (e.g. smallHouses, bigTrees …) into the scene.
 *
 * @param {BABYLON.Scene}   scene
 * @param {object[]}        items          - prop descriptors from the metadata
 * @param {BABYLON.Mesh[]}  templateMeshes - registry entry for this type, indexed by variant
 * @param {boolean}         addPhysics     - whether to attach a static PhysicsAggregate
 * @param {string}          namePrefix
 */
function spawnProps(scene, items, mainMesh, addPhysics, shapeType) {
    if (!mainMesh) return;

    if (mainMesh.material) mainMesh.material.unlit = true;

    // Compute the collision shape once, reuse it for every instance.
    let sharedShape = null;
    if (addPhysics) {
        switch(shapeType){
            case "mesh":
                sharedShape = new PhysicsShapeMesh(mainMesh, scene);
            break
            case "convex":
                sharedShape = new PhysicsShapeConvexHull(mainMesh, scene);
            break
            default: {
                // const bb = mainMesh.getBoundingInfo().boundingBox;
                // sharedShape = new PhysicsShapeBox(bb.center, Quaternion.Identity(), bb.extendSize, scene);
                sharedShape = new PhysicsShapeMesh(mainMesh, scene);
                break;
            }
        }

        if (sharedShape) sharedShape.material = { restitution: 0, friction: 1 };
    }

    items.forEach(item => {
        const inst = mainMesh.createInstance(`${mainMesh.name}_${item.id}`);
        inst.position   = new Vector3(item.x, item.y, item.z);
        inst.rotation   = new Vector3(0, (item.rotation * Math.PI) / 180, 0);
        inst.scaling    = new Vector3(item.scale.x, item.scale.y, item.scale.z);
        inst.isPickable = false;
        if (addPhysics) {
            if (sharedShape) {
                const body = new PhysicsBody(inst, PhysicsMotionType.STATIC, false, scene);
                body.shape = sharedShape;
            } else {
                const agg = new PhysicsAggregate(inst, PhysicsShapeType.BOX, { mass: 0 }, scene);
                agg.shape.material = { restitution: 0, friction: 1 };
            }
        }
        inst.freezeWorldMatrix();
    });
}
function spawnNonPhysics(scene, items, mainMesh, yRotOffset = 0) {
    if (!mainMesh) return;
    if (mainMesh.material) mainMesh.material.unlit = true;
    items.forEach(item => {
        const inst = mainMesh.createInstance(`${mainMesh.name}_${item.id}`);
        inst.position   = new Vector3(item.x, item.y, item.z);
        inst.rotation   = new Vector3(0, (item.rotation * Math.PI) / 180 + yRotOffset, 0);
        inst.scaling    = new Vector3(item.scale.x, item.scale.y, item.scale.z);
        inst.isPickable = false;
        inst.freezeWorldMatrix();
    });
}
// ─── Palisade wall ────────────────────────────────────────────────────────────
/**
 * Builds the rectangular perimeter palisade from cylinder instances.
 * Each stake is an independent MeshBuilder.CreateCylinder with a flat top
 * and a slightly pointed tip (diameterTop smaller than diameterBottom).
 *
 * @param {BABYLON.Scene} scene
 * @param {object}        palisade   - from village.palisade
 * @param {string}        namePrefix
 */
function buildPalisade(scene, palisade, woodenstake, namePrefix) {
    if (!palisade?.stakes?.length) return;

    const { stakeHeight, stakeRadius, stakes } = palisade;
    woodenstake.isVisible = false

    stakes.forEach(stake => {
        const inst = woodenstake.createInstance(`${namePrefix}_${stake.id}`);
        inst.position  = new Vector3(stake.x, 0, stake.z);
        // Subtle tilt so the wall looks hand-planted, not machine-perfect
        inst.rotation  = new Vector3(stake.tiltX+randNum(-0.2,0.2) ?? 0, 0, 0);
        inst.isVisible = true;

        // Static physics so player cannot walk through the wall
        const agg = new PhysicsAggregate(inst, PhysicsShapeType.CYLINDER, { mass: 0 }, scene);
        agg.shape.material = { restitution: 0, friction: 1 };
    });
}
// ─── Gate slabs ───────────────────────────────────────────────────────────────
// If you want to move the gate inside change the INSET
function buildGates(scene, palisade, entry, exit, entryExitPlaceIds, characterBody, gateTemplate) {
    if (!palisade) return;
    if(!entryExitPlaceIds) return

    const { entryPlaceDetail, exitPlaceDetail } = entryExitPlaceIds
    const { stakeHeight, doorWidth } = palisade;
    const hw   = palisade.outerWidth  / 2;
    const hh   = palisade.outerHeight / 2;
    const SLAB = 0.8;

    function place(dir, pathname) {
        const isNS = dir === 'north' || dir === 'south';
        const w = isNS ? doorWidth : SLAB;
        const d = isNS ? SLAB      : doorWidth;
        const INSET = 4;
        const x = dir === 'east' ? hw - INSET : dir === 'west' ? -hw + INSET : 0;
        const z = dir === 'north' ? hh - INSET : dir === 'south' ? -hh + INSET : 0;

        // Offset the trigger toward the player's approach side so they hit it before the gate model's physics
        const approachOffset =
            dir === 'south' ? new Vector3(0, 0,  3) :
            dir === 'north' ? new Vector3(0, 0, -3) :
            dir === 'east'  ? new Vector3(-3, 0, 0) :
                              new Vector3( 3, 0, 0);

        const triggerBox = MeshBuilder.CreateBox(`gate_${pathname}`, {
            width: w/2, height: stakeHeight/2, depth: d,
        }, scene);
        triggerBox.position  = new Vector3(x + approachOffset.x, stakeHeight / 4, z + approachOffset.z);
        triggerBox.isVisible = false;
        triggerBox.isPickable = false;

        if (gateTemplate) {
            const gateModel = gateTemplate.createInstance(`gate_model_${pathname}`)
            gateModel.position  = new Vector3(x, 0, z)
            gateModel.rotation.y = isNS ? 0 : Math.PI / 2
            gateModel.isVisible = true
            new PhysicsAggregate(gateModel, PhysicsShapeType.BOX, { mass: 0 }, scene)
        }

        onIntersecEnterTrig(triggerBox, characterBody, scene, async () => {
            openCloseInteractBtn(null, true, async () => {
                let placeDetailShort

                switch(pathname){
                    case "entry":
                        placeDetailShort = entryPlaceDetail
                    break
                    case "exit":
                        placeDetailShort = exitPlaceDetail
                    break
                }
                const charState = getCharState()
                const tcpCharPlaceMD = findPlaceMetaData(placeDetailShort.placeId)

                charState.currentPlace.placeId = placeDetailShort.placeId
                charState.currentPlace.name = placeDetailShort.name
                charState.currentPlace.areaType = placeDetailShort.areaType

                charState.x = tcpCharPlaceMD.spawn.x
                charState.y = tcpCharPlaceMD.spawn.y
                charState.z = tcpCharPlaceMD.spawn.z
                
                const newCharData = await updateMyDetailsOL(charState, checkIfTokenSaved(), true, true)
                exitScene(charState.owner);

                const placeDetail = findMyCurrentPlace()
                await changeScene(placeDetail, "whatever")
            })
            
        })
        onIntersecExitTrig(triggerBox, characterBody, scene, () => {
            openCloseInteractBtn(false, false)
        })
    }

    if (entry?.direction) place(entry.direction, 'entry');
    if (exit?.direction)  place(exit.direction,  'exit');
}

// ─── Light-pole point lights ──────────────────────────────────────────────────
/**
 * For each light pole that has `lit: true`, adds a small PointLight hovering
 * just above the top of the pole mesh so it illuminates the surroundings.
 * @param {BABYLON.Scene} scene
 * @param {object[]} poles
 * @param {string} namePrefix
 */
function spawnPoleLights(scene, poles, namePrefix) {
    const POLE_LIGHT_HEIGHT = 5;  // world units above pole origin

    (poles ?? []).forEach((pole, i) => {
        if (!pole.lit) return;
        const pl = new PointLight(
            `${namePrefix}_poleLight_${i}`,
            new Vector3(pole.x, pole.y + POLE_LIGHT_HEIGHT, pole.z),
            scene,
        );
        pl.intensity = 0.8;
        pl.range     = 18;
        pl.diffuse   = new Color3(1.0, 0.95, 0.78); // warm lantern colour
    });
}

// ─── Public API ───────────────────────────────────────────────────────────────
/**
 * Builds a full village scene from a generateVillageMetaData() descriptor.
 *
 * @param {BABYLON.Scene}  scene
 * @param {object}         village        - output of generateVillageMetaData()
 * @param {object}         assetRegistry  - { [type]: BABYLON.Mesh[] }
 *
 * assetRegistry example:
 *   {
 *     smallHouse:  [houseSmall_v0, houseSmall_v1, houseSmall_v2],
 *     mediumHouse: [houseMed_v0,   houseMed_v1,   houseMed_v2],
 *     bigHouse:    [houseBig_v0,   houseBig_v1],
 *     smallTree:   [treeS_v0, treeS_v1, treeS_v2, treeS_v3],
 *     mediumTree:  [treeM_v0, treeM_v1, treeM_v2],
 *     bigTree:     [treeB_v0, treeB_v1],
 *     lightPole:   [pole_v0],
 *     grass:       [grass_v0, grass_v1, grass_v2, grass_v3, grass_v4],
 *     herb:        [herb_v0, herb_v1, herb_v2, herb_v3],
 *     mushroom:    [shroom_v0, shroom_v1, shroom_v2],
 *   }
 *
 * Each mesh in the registry must already be hidden (isVisible = false) so only
 * the spawned instances are visible.
 */
export function createVillage(scene, village, assetRegistry = {}, characterBody) {

    const {entryExitPlaceIds} = village
    const prefix = village.meta?.name ?? 'village';

    // ── 1. Lighting ───────────────────────────────────────────────────────────
    // applyLighting(scene, village.lighting, prefix);

    // ── 2. Ground ─────────────────────────────────────────────────────────────
    buildFloor(scene, village.layout, village.palisade, prefix);

    // console.log(village.paths)

    buildPalisade(scene, village.palisade, assetRegistry.woodenstake, prefix);
    buildGates(scene, village.palisade, village.entry, village.exit, entryExitPlaceIds, characterBody, assetRegistry.gate);

    // ── 4. Props ──────────────────────────────────────────────────────────────
    // Houses — with physics so the player can't walk through them.
    spawnProps(scene, village.bigHouses,    assetRegistry.bigHouse,   true);
    spawnProps(scene, village.mediumHouses, assetRegistry.mediumHouse, true);
    spawnProps(scene, village.smallHouses,  assetRegistry.smallHouse,  true);

    // Trees — with physics (trunks block movement).
    spawnProps(scene, village.bigTrees,    assetRegistry.bigTree,    true, "mesh");
    spawnProps(scene, village.mediumTrees, assetRegistry.mediumTree,  true, "mesh");
    spawnProps(scene, village.smallTrees,  assetRegistry.smallTree,   true, "mesh");

    // Light poles — with physics.
    spawnProps(scene, village.lightPoles, assetRegistry.lightPole, true);

    // Foliage — no physics (purely decorative, high count, no collision needed).
    spawnNonPhysics(scene, village.grass, assetRegistry.grass);
    spawnNonPhysics(scene, village.grass, assetRegistry.grass2, Math.PI / 2);
    spawnNonPhysics(scene, village.herbs,     assetRegistry.herb);
    spawnNonPhysics(scene, village.mushrooms, assetRegistry.mushroom);
    spawnNonPhysics(scene, village.rocks,     assetRegistry.rocks);
    spawnNonPhysics(scene, village.flowers,   assetRegistry.flower);
    spawnNonPhysics(scene, village.bushes,    assetRegistry.bush);

    // ── 5. Point lights on lit poles ──────────────────────────────────────────
    // spawnPoleLights(scene, village.lightPoles, prefix);

    // ── 6. Return spawn info so the caller can position the player ────────────
    const spawnOut = village.spawn ?? { x: 0, y: 1, z: 0, rotation: 0 };
    // console.log('[createVillage] spawn descriptor:', spawnOut,
    //             '| entry:', village.entry,
    //             '| exit:', village.exit,
    //             '| area:', village.layout?.width, 'x', village.layout?.height);
    return { spawn: spawnOut };
}