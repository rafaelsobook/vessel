import {
    Vector3,
    MeshBuilder,
    StandardMaterial,
    Color3,
    HemisphericLight,
    PointLight,
    DirectionalLight,
    ShadowGenerator,
} from '@babylonjs/core';
import { createAggregate } from '../tools/physics';
import { loadModelByIndx, mergeAndLoadModel } from '../tools/loadmodel';
import { createMat, createMatV2 } from '../tools/materials';
import { createFireParticles } from '../tools/particlesystem';
import { spawnMagicCircle } from './magiccircles';
import { onIntersecEnterTrig, onIntersecExitTrig } from '../components/actionManager';
import { getCharState, updateMyDetailsOL } from '../charactersystem/characterstate';
import { exitScene } from '../sockets/exitsocket';
import { findMyCurrentPlace, findPlaceMetaData } from '../states/placestates';
import { changeScene } from '../main/main';
import { openCloseInteractBtn } from '../tools/popupUI';

import { startQuestionare } from '../components/conversations';
import { checkIfTokenSaved } from "../tools/tools"
import { getAllSounds } from '../components/soundSystem';

const WALL_HEIGHT    = 0.5;
const WALL_THICKNESS = 0.3;


function buildWall(name, brickMaster, capMaster, startPos, stepVec, count, wh, scene, hasPhysics,shadowGenerator) {
    for (let i = 0; i < count; i++) {
        const px = startPos.x + stepVec.x * i;
        const pz = startPos.z + stepVec.z * i;

        const brick = brickMaster.createInstance(`${name}_${i}`);
        brick.position = new Vector3(px, wh / 2, pz);
        if(hasPhysics)createAggregate(brick, { mass: 0 }, "box", scene);

        const cap = capMaster.createInstance(`${name}_cap_${i}`);
        cap.position = new Vector3(px, wh/2, pz);
        if(hasPhysics)createAggregate(cap, { mass: 0 }, "box", scene);

        brick.isVisible = true
        cap.isVisible = true

        if (shadowGenerator) {
            shadowGenerator.addShadowCaster(brick)
            shadowGenerator.addShadowCaster(cap)
            brick.receiveShadows = true
            cap.receiveShadows = true
        }
    }
}

export async function createRoom(scene, room, characterBody, hasPhysics = true) {
    
    const {
        name       = 'Room',
        width      = 7,
        height     = 10,
        wallHeight = WALL_HEIGHT,
        bedConfig,
        optionalObjects = [],
        spawn,
        exitPlaceDetail
    } = room;
    const halfW = width  / 2;
    const halfH = height / 2;
    const wh    = wallHeight;
    const wt    = WALL_THICKNESS;

    const floorMat = createMat("floorMat", false, "./images/modeltex/planks.jpg", scene, { uScale: 2, vScale: 2});
    const wallMat  = createMat(`${name}_mat_wall`, false, "./images/modeltex/rockTex.jpg", scene,  { uScale: 0.5, vScale: 0.5 });

    scene.clearColor = new Color3(0,0,0);
    // ── Ground ────────────────────────────────────────────────────────────────
    const ground = MeshBuilder.CreateGround(`${name}_ground`, { width, height, subdivisions: 1 }, scene);
    ground.material   = floorMat;
    ground.position.y = 0;
    if(hasPhysics) createAggregate(ground, { mass: 0 }, "box", scene);

    // ── Wall masters (hidden, used only for instancing) ───────────────────────
    const brickNS = MeshBuilder.CreateBox(`${name}_mbrick_ns`, { width: 1,   height: wh,  depth: wt }, scene);
    brickNS.material  = wallMat;
    brickNS.isVisible = false;

    const brickEW = MeshBuilder.CreateBox(`${name}_mbrick_ew`, { width: wt,  height: wh,  depth: 1  }, scene);
    brickEW.material  = wallMat;
    brickEW.isVisible = false;

    const brickTop = MeshBuilder.CreateBox(`${name}_mcap_ns`, { height: 0.4, size: 0.6 }, scene);
    brickTop.material  = wallMat;
    brickTop.isVisible = false;

    // ── Walls — north=+Z, south=-Z ────────────────────────────────────────────
    const nsCount = Math.ceil(width);
    const ewCount = Math.ceil(height);

    // ── Lighting ──────────────────────────────────────────────────────────────
    const ambient = new HemisphericLight(`${name}_ambient`, new Vector3(0, 1, 0), scene);
    ambient.intensity   = 0.4;
    ambient.diffuse     = new Color3(1.0, 0.92, 0.82);
    ambient.groundColor = new Color3(0.1, 0.08, 0.06);

    // const dirLight = new DirectionalLight(`${name}_dirlight`, new Vector3(-1, -2, -1), scene);
    // dirLight.position  = new Vector3(halfW, wh * 4, halfH);
    // dirLight.intensity = 0.8;
    // dirLight.diffuse   = new Color3(1.0, 0.92, 0.82);

    // const shadowGenerator = new ShadowGenerator(1024, dirLight);
    // shadowGenerator.useBlurExponentialShadowMap = true;

    ground.receiveShadows = true;

    // ── Walls ─────────────────────────────────────────────────────────────────
    buildWall(`${name}_wall_n`, brickNS, brickTop, new Vector3(-halfW + 0.5, 0,  halfH),  new Vector3(1, 0, 0), nsCount, wh, scene, hasPhysics);
    buildWall(`${name}_wall_s`, brickNS, brickTop, new Vector3(-halfW + 0.5, 0, -halfH),  new Vector3(1, 0, 0), nsCount, wh, scene, hasPhysics);
    buildWall(`${name}_wall_e`, brickEW, brickTop, new Vector3( halfW, 0, -halfH + 0.5),  new Vector3(0, 0, 1), ewCount, wh, scene, hasPhysics);
    buildWall(`${name}_wall_w`, brickEW, brickTop, new Vector3(-halfW, 0, -halfH + 0.5),  new Vector3(0, 0, 1), ewCount, wh, scene, hasPhysics);



    // setTimeout(() => {
    //     spawnMagicCircle(new Vector3(spawn.x, spawn.y, spawn.z), scene, "divine1", 0.8)
    //     spawnProjectileFromBelow({x:0,y:-1,z:0}, characterBody.position, scene)

    //     setTimeout(() => {
    //         startQuestionare(1)
    //     })
    // }, 2000)

    if (exitPlaceDetail && characterBody) {
        const exitTrigger = MeshBuilder.CreateBox(`${name}_exit_trig`, { width: width/4, height: 2, depth: 1/2 }, scene)
        exitTrigger.position = new Vector3(0, 1, -halfH + 0.5)
        exitTrigger.isVisible = false
        exitTrigger.isPickable = false

        onIntersecEnterTrig(exitTrigger, characterBody, scene, () => {
            openCloseInteractBtn("normal", "none", async () => {
                openCloseInteractBtn(false)

                const charState = getCharState()
                
                const tcpCharPlaceMD = findPlaceMetaData(exitPlaceDetail.placeId)

                charState.currentPlace.placeId = exitPlaceDetail.placeId
                charState.currentPlace.name = exitPlaceDetail.name
                charState.currentPlace.areaType = exitPlaceDetail.areaType
                charState.x = tcpCharPlaceMD.spawn.x
                charState.y = tcpCharPlaceMD.spawn.y
                charState.z = tcpCharPlaceMD.spawn.z
                console.log(tcpCharPlaceMD)
                getAllSounds().normalDoorOC.play()
                const newCharData = await updateMyDetailsOL(charState, checkIfTokenSaved(), true, true)
                console.log(newCharData)
                exitScene(charState.owner)
                
                await changeScene("whatever")
            })
        })
        onIntersecExitTrig(exitTrigger, characterBody, scene, () => {
            openCloseInteractBtn(false, false)
        })
    }
}
