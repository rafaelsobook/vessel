import {
    Vector3,
    MeshBuilder,
    StandardMaterial,
    Color3,
    HemisphericLight,
    PointLight,
} from '@babylonjs/core';
import { createAggregate } from '../tools/physics';
import { loadModelByIndx, mergeAndLoadModel } from '../tools/loadmodel';
import { createMat } from '../tools/materials';

const WALL_HEIGHT    = 0.5;
const WALL_THICKNESS = 0.3;


function buildWall(name, brickMaster, capMaster, startPos, stepVec, count, wh, scene) {
    for (let i = 0; i < count; i++) {
        const px = startPos.x + stepVec.x * i;
        const pz = startPos.z + stepVec.z * i;

        const brick = brickMaster.createInstance(`${name}_${i}`);
        brick.position = new Vector3(px, wh / 2, pz);
        createAggregate(brick, { mass: 0 }, "box", scene);

        const cap = capMaster.createInstance(`${name}_cap_${i}`);
        cap.position = new Vector3(px, wh/2, pz);
        createAggregate(cap, { mass: 0 }, "box", scene);

        brick.isVisible =true
        cap.isVisible =true
    }
}

export async function createRoom(scene, room) {
    const {
        name       = 'Room',
        width      = 7,
        height     = 10,
        wallHeight = WALL_HEIGHT,
        bedConfig,
        indorItems = [],
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
    createAggregate(ground, { mass: 0 }, "box", scene);

    // ── Wall masters (hidden, used only for instancing) ───────────────────────
    const brickNS = MeshBuilder.CreateBox(`${name}_mbrick_ns`, { width: 1,   height: wh,  depth: wt }, scene);
    brickNS.material  = wallMat;
    brickNS.isVisible = true;

    const brickEW = MeshBuilder.CreateBox(`${name}_mbrick_ew`, { width: wt,  height: wh,  depth: 1  }, scene);
    brickEW.material  = wallMat;
    brickEW.isVisible = true;

    const brickTop = MeshBuilder.CreateBox(`${name}_mcap_ns`, { height: 0.4, size: 0.6 }, scene);
    brickTop.material  = wallMat;
    brickTop.isVisible = false;

    // ── Walls — north=+Z, south=-Z ────────────────────────────────────────────
    const nsCount = Math.ceil(width);
    const ewCount = Math.ceil(height);

    buildWall(`${name}_wall_n`, brickNS, brickTop, new Vector3(-halfW + 0.5, 0,  halfH),  new Vector3(1, 0, 0), nsCount, wh, scene);
    buildWall(`${name}_wall_s`, brickNS, brickTop, new Vector3(-halfW + 0.5, 0, -halfH),  new Vector3(1, 0, 0), nsCount, wh, scene);
    buildWall(`${name}_wall_e`, brickEW, brickTop, new Vector3( halfW, 0, -halfH + 0.5),  new Vector3(0, 0, 1), ewCount, wh, scene);
    buildWall(`${name}_wall_w`, brickEW, brickTop, new Vector3(-halfW, 0, -halfH + 0.5),  new Vector3(0, 0, 1), ewCount, wh, scene);

    // ── Lighting ──────────────────────────────────────────────────────────────
    const ambient = new HemisphericLight(`${name}_ambient`, new Vector3(0, 1, 0), scene);
    ambient.intensity   = 0.5;
    ambient.diffuse     = new Color3(1.0, 0.92, 0.82);
    ambient.groundColor = new Color3(0.1, 0.08, 0.06);

    const pt = new PointLight(`${name}_point`, new Vector3(0, wh * 0.85, 0), scene);
    pt.intensity = 0.7;
    pt.range     = Math.max(width, height) * 2;
    pt.diffuse   = new Color3(1.0, 0.90, 0.75);

    if (bedConfig?.hasBed) {
        const model = await mergeAndLoadModel(`./models/beds/${bedConfig.bedGlbName}`, scene);

        model.position = new Vector3(bedConfig.bedPosition.x, bedConfig.bedPosition.y, bedConfig.bedPosition.z);
        model.rotation.y = bedConfig.bedRotation;
        createAggregate(model, { mass: 0 }, "box", scene);
    }
    if(indorItems.length > 0){
        indorItems.forEach(async item => {
            const model = await loadModelByIndx(item.glbPath, 1, scene);

            model.position = new Vector3(item.position.x, item.position.y, item.position.z);
            model.addRotation(0, item.rotation, 0);
            createAggregate(model, item.physics.opt, item.physics.type, scene);
        })
    }
}
