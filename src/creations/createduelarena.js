// createduelarena.js
//
// "duel" areaType - a bare arena for NPC-vs-player (or eventually NPC-vs-NPC)
// duels. Deliberately minimal for now: just a flat ground plane ringed by the
// same low knee-wall createroom.js's rooms use, nothing else. Goes through
// areascene.js's shared setup (character, physics, optionalObjects,
// resources, roomPaths, NPCs, multiplayer join) exactly like "room" does -
// this function only builds the ground/walls, same division of
// responsibility as createRoom().
//
// Kept as its own function/file rather than reusing createRoom() directly -
// this is meant to grow duel-specific behavior later (ring-out bounds,
// spectator stands, a countdown/start gate, etc.) that a plain room has no
// business carrying.
import {
    Vector3,
    MeshBuilder,
    Color3,
} from '@babylonjs/core';
import { createAggregate } from '../tools/physics';
import { createMat } from '../tools/materials';
import { onIntersecEnterTrig, onIntersecExitTrig } from '../components/actionManager';
import { getCharState, updateMyDetailsOL } from '../charactersystem/characterstate';
import { exitScene } from '../sockets/exitsocket';
import { findPlaceMetaData } from '../states/placestates';
import { changeScene } from '../main/main';
import { openCloseInteractBtn } from '../tools/popupUI';
import { checkIfTokenSaved } from "../tools/tools"
import { getAllSounds } from '../components/soundSystem';

const WALL_HEIGHT    = 0.5; // same knee-wall height every "room" defaults to
const WALL_THICKNESS = 0.3;

function buildWall(name, brickMaster, capMaster, startPos, stepVec, count, wh, scene, hasPhysics) {
    for (let i = 0; i < count; i++) {
        const px = startPos.x + stepVec.x * i;
        const pz = startPos.z + stepVec.z * i;

        const brick = brickMaster.createInstance(`${name}_${i}`);
        brick.position = new Vector3(px, wh / 2, pz);
        if(hasPhysics) createAggregate(brick, { mass: 0 }, "box", scene);

        const cap = capMaster.createInstance(`${name}_cap_${i}`);
        cap.position = new Vector3(px, wh / 2, pz);
        if(hasPhysics) createAggregate(cap, { mass: 0 }, "box", scene);

        brick.isVisible = true;
        cap.isVisible = true;
    }
}

export async function createDuelArena(scene, room, characterBody, hasPhysics = true) {

    const {
        name        = 'Duel',
        width       = 50,
        height      = 50,
        wallHeight  = WALL_HEIGHT,
        wallTexPath = "./images/modeltex/rockTex.jpg",
        exitPlaceDetail
    } = room;
    const halfW = width  / 2;
    const halfH = height / 2;
    const wh    = wallHeight;
    const wt    = WALL_THICKNESS;

    const floorMat = createMat("floorMat", false, "./images/modeltex/planks.jpg", scene, { uScale: 4, vScale: 4 });
    const wallMat  = createMat(`${name}_mat_wall`, false, wallTexPath, scene, { uScale: 0.5, vScale: 0.5 });

    scene.clearColor = new Color3(0,0,0);

    // ── Ground ────────────────────────────────────────────────────────────────
    const ground = MeshBuilder.CreateGround(`${name}_ground`, { width, height, subdivisions: 1 }, scene);
    ground.material   = floorMat;
    ground.position.y = 0;
    ground.receiveShadows = true;
    if(hasPhysics) createAggregate(ground, { mass: 0 }, "box", scene);

    // ── Wall masters (hidden, used only for instancing) ───────────────────────
    const brickNS = MeshBuilder.CreateBox(`${name}_mbrick_ns`, { width: 1,  height: wh, depth: wt }, scene);
    brickNS.material  = wallMat;
    brickNS.isVisible = false;

    const brickEW = MeshBuilder.CreateBox(`${name}_mbrick_ew`, { width: wt, height: wh, depth: 1  }, scene);
    brickEW.material  = wallMat;
    brickEW.isVisible = false;

    const brickTop = MeshBuilder.CreateBox(`${name}_mcap_ns`, { height: 0.4, size: 0.6 }, scene);
    brickTop.material  = wallMat;
    brickTop.isVisible = false;

    // ── Walls - north=+Z, south=-Z ────────────────────────────────────────────
    const nsCount = Math.ceil(width);
    const ewCount = Math.ceil(height);

    buildWall(`${name}_wall_n`, brickNS, brickTop, new Vector3(-halfW + 0.5, 0,  halfH),  new Vector3(1, 0, 0), nsCount, wh, scene, hasPhysics);
    buildWall(`${name}_wall_s`, brickNS, brickTop, new Vector3(-halfW + 0.5, 0, -halfH),  new Vector3(1, 0, 0), nsCount, wh, scene, hasPhysics);
    buildWall(`${name}_wall_e`, brickEW, brickTop, new Vector3( halfW, 0, -halfH + 0.5),  new Vector3(0, 0, 1), ewCount, wh, scene, hasPhysics);
    buildWall(`${name}_wall_w`, brickEW, brickTop, new Vector3(-halfW, 0, -halfH + 0.5),  new Vector3(0, 0, 1), ewCount, wh, scene, hasPhysics);

    // ── Exit (optional) - same south-wall trigger createroom.js uses, only
    // wired up if this place actually has somewhere to send you back to
    if (exitPlaceDetail && characterBody) {
        const exitTrigger = MeshBuilder.CreateBox(`${name}_exit_trig`, { width: width/8, height: 2, depth: 1/2 }, scene)
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

                getAllSounds().normalDoorOC?.play()
                await updateMyDetailsOL(charState, checkIfTokenSaved(), true, true)
                exitScene(charState.owner)
                await changeScene("whatever")
            })
        })
        onIntersecExitTrig(exitTrigger, characterBody, scene, () => {
            openCloseInteractBtn(false, false)
        })
    }
}
