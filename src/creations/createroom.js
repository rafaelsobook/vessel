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
import { onIntersecEnterTrig, onIntersecExitTrig } from '../components/actionManager';
import { findMyCurrentPlace, findPlaceMetaData } from '../states/placestates';
import { travelToPlace } from '../tools/travel';
import { openCloseInteractBtn } from '../tools/popupUI';

import { startQuestionare } from '../components/conversations';
import { getAllSounds } from '../components/soundSystem';

const WALL_HEIGHT    = 0.5;
const WALL_THICKNESS = 0.3;


// Circular ring of wall segments (roomShape:"cylinder") - approximates a
// circle as a regular polygon, same "roughly one brick per world unit"
// density buildWall's own straight nsCount/ewCount already use for a
// comparable brick size. Each segment is a straight chord
// (2*radius*sin(π/count) long, so `count` of them tile the full
// circumference edge-to-edge with no gaps/overlaps), rotated to face
// outward at its own angle - same atan2(x,z)-is-yaw convention every other
// facing calculation in this project already uses (duelSystem.js's own
// chase-facing, the wagon, every skill projectile): since each segment
// sits at (radius*sin(angle), radius*cos(angle)), rotation.y = angle
// directly orients its own local +z (its thin/normal axis, same role
// brickNS/brickEW's own `depth` plays for the straight walls) to point
// radially outward, with its long "width" axis running tangentially.
function buildCylinderWalls(name, radius, wh, wt, wallMat, scene, hasPhysics, shadowGenerator){
    const circumference = 2 * Math.PI * radius;
    const count = Math.max(8, Math.ceil(circumference)); // floor of 8 - a small room still reads as round, not a square/octagon
    const chordWidth = 2 * radius * Math.sin(Math.PI / count);

    const brick = MeshBuilder.CreateBox(`${name}_cylbrick`, { width: chordWidth, height: wh, depth: wt }, scene);
    brick.material  = wallMat;
    brick.isVisible = false;

    const cap = MeshBuilder.CreateBox(`${name}_cylcap`, { height: 0.4, size: Math.min(0.6, chordWidth) }, scene);
    cap.material  = wallMat;
    cap.isVisible = false;

    for(let i = 0; i < count; i++){
        const angle = (2 * Math.PI / count) * i;
        const px = radius * Math.sin(angle);
        const pz = radius * Math.cos(angle);

        const seg = brick.createInstance(`${name}_${i}`);
        seg.position = new Vector3(px, wh / 2, pz);
        seg.rotation.y = angle;
        if(hasPhysics) createAggregate(seg, { mass: 0 }, "box", scene);

        const segCap = cap.createInstance(`${name}_cap_${i}`);
        segCap.position = new Vector3(px, wh / 2, pz);
        segCap.rotation.y = angle;
        if(hasPhysics) createAggregate(segCap, { mass: 0 }, "box", scene);

        seg.isVisible    = true;
        segCap.isVisible = true;

        if(shadowGenerator){
            shadowGenerator.addShadowCaster(seg);
            shadowGenerator.addShadowCaster(segCap);
            seg.receiveShadows    = true;
            segCap.receiveShadows = true;
        }
    }
}

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
        name        = 'Room',
        width       = 7,
        height      = 10,
        wallHeight  = WALL_HEIGHT,
        wallTexPath = "./images/modeltex/rockTex.jpg",
        // "box" (default, every existing room) keeps today's flat
        // CreateGround plane floor. "cylinder" (Vesper's own Witch House,
        // localroomdb.js's placeId 15) swaps just the FLOOR mesh for a real
        // cylinder instead - walls still build the same straight box-wall
        // way (nsCount/ewCount below), only the ground shape changes.
        roomShape   = "box",
        bedConfig,
        optionalObjects = [],
        paintedPlanes   = [],
        woodboxes       = [],
        spawn,
        exitPlaceDetail
    } = room;
    const halfW = width  / 2;
    const halfH = height / 2;
    const wh    = wallHeight;
    const wt    = WALL_THICKNESS;

    const floorMat = createMat("floorMat", false, "./images/modeltex/planks.jpg", scene, { uScale: 2, vScale: 2});
    const wallMat  = createMat(`${name}_mat_wall`, false, wallTexPath, scene,  { uScale: 0.5, vScale: 0.5 });

    // shared by BOTH the floor and the walls below when roomShape is
    // "cylinder" - a true circle now that the walls actually curve too
    // (used to be an ellipse inscribed in the rectangle, floor-only, back
    // when only the floor shape had changed - see this room's own git
    // history/comment trail if that ever needs to come back). max(halfW,
    // halfH), not min or an average - guarantees the new circular wall
    // still fully contains everything that was already positioned relative
    // to the ORIGINAL rectangular footprint along its LONGER axis (this
    // room's own spawn/exitPlaceDetail door trigger, both z-positioned
    // against halfH) - using the smaller half would leave those outside
    // the new wall entirely. The tradeoff is open floor space near the
    // shorter axis's own former wall line (the circle extends past it) -
    // acceptable for a round room, unlike stranding the exit outside a
    // solid wall.
    const cylinderRadius = Math.max(halfW, halfH);

    scene.clearColor = new Color3(0,0,0);
    // ── Ground ────────────────────────────────────────────────────────────────
    let ground;
    if(roomShape === "cylinder"){
        const FLOOR_THICKNESS = 0.1;
        ground = MeshBuilder.CreateCylinder(`${name}_ground`, { diameter: cylinderRadius * 2, height: FLOOR_THICKNESS, tessellation: 48 }, scene);
        ground.position.y = -FLOOR_THICKNESS / 2; // top face sits at y=0, same as the plane
    } else {
        ground = MeshBuilder.CreateGround(`${name}_ground`, { width, height, subdivisions: 1 }, scene);
        ground.position.y = 0;
    }
    ground.material = floorMat;
    // box collider either way - even the cylinder floor's own real shape is
    // still just "solid ground you can walk on top of", same as the plane's
    // existing box aggregate already approximates; a true CYLINDER physics
    // shape (tools/physics.js does support one) isn't worth the risk here
    // against this mesh's own non-uniform ellipse scaling
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
    if(roomShape === "cylinder"){
        buildCylinderWalls(`${name}_wall`, cylinderRadius, wh, wt, wallMat, scene, hasPhysics);
    } else {
        buildWall(`${name}_wall_n`, brickNS, brickTop, new Vector3(-halfW + 0.5, 0,  halfH),  new Vector3(1, 0, 0), nsCount, wh, scene, hasPhysics);
        buildWall(`${name}_wall_s`, brickNS, brickTop, new Vector3(-halfW + 0.5, 0, -halfH),  new Vector3(1, 0, 0), nsCount, wh, scene, hasPhysics);
        buildWall(`${name}_wall_e`, brickEW, brickTop, new Vector3( halfW, 0, -halfH + 0.5),  new Vector3(0, 0, 1), ewCount, wh, scene, hasPhysics);
        buildWall(`${name}_wall_w`, brickEW, brickTop, new Vector3(-halfW, 0, -halfH + 0.5),  new Vector3(0, 0, 1), ewCount, wh, scene, hasPhysics);
    }

    // ── Painted planes — flat textured overlays laid onto the room (rugs,
    // wall maps, etc). Default rotation lies it flat facing up like a rug;
    // default size/position fall back to a large centered rug so a minimal
    // {name, texturePath} entry still renders something sensible.
    paintedPlanes.forEach(plane => {
        const {
            name: planeName,
            texturePath,
            position = { x: 0, y: 0.02, z: 0 },
            rotation = { x: Math.PI/2, y: 0, z: 0 },
            width: planeWidth   = 1.5,
            height: planeHeight = 1,
            uScale = 1,
            vScale = 1,
        } = plane;

        const planeMat = createMat(`${name}_${planeName}_mat`, false, texturePath, scene, { uScale, vScale });
        const planeMesh = MeshBuilder.CreatePlane(planeName, { width: planeWidth, height: planeHeight }, scene);
        planeMesh.position = new Vector3(position.x, position.y, position.z);
        planeMesh.rotation = new Vector3(rotation.x, rotation.y, rotation.z);
        planeMesh.material = planeMat;
        planeMesh.receiveShadows = true;
    });

    // ── Wood boxes — plain stackable crates. Same instancing trick buildWall
    // already uses for bricks: one hidden master mesh + one material, shared
    // by every crate via createInstance (geometry/material cost stays flat
    // no matter how many boxes a room stacks up) - only the physics aggregate
    // is genuinely per-instance, since each crate needs its own collider.
    // No rotation/texture per entry - crates only ever sit upright and all
    // share the one woodbox.jpg master.
    if(woodboxes.length){
        const woodboxMat = createMat(`${name}_woodbox_mat`, false, "./images/modeltex/woodbox.jpg", scene);
        const woodboxMaster = MeshBuilder.CreateBox(`${name}_woodbox_master`, { size: 1 }, scene);
        woodboxMaster.material  = woodboxMat;
        woodboxMaster.isVisible = false;

        woodboxes.forEach((box, i) => {
            const { name: boxName = `${name}_woodbox_${i}`, position, scale } = box;

            const instance = woodboxMaster.createInstance(boxName);
            instance.position = new Vector3(position.x, position.y, position.z);
            if(scale) instance.scaling = new Vector3(scale.x ?? scale, scale.y ?? scale, scale.z ?? scale);

            if(hasPhysics) createAggregate(instance, { mass: 0 }, "box", scene);
        });
    }

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

                const tcpCharPlaceMD = findPlaceMetaData(exitPlaceDetail.placeId)

                getAllSounds().normalDoorOC?.play()
                await travelToPlace({
                    placeId: exitPlaceDetail.placeId,
                    name: exitPlaceDetail.name,
                    areaType: exitPlaceDetail.areaType,
                    x: tcpCharPlaceMD.spawn.x,
                    y: tcpCharPlaceMD.spawn.y,
                    z: tcpCharPlaceMD.spawn.z,
                })
            })
        })
        onIntersecExitTrig(exitTrigger, characterBody, scene, () => {
            openCloseInteractBtn(false, false)
        })
    }
}
