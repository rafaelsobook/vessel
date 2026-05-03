/**
 * generateDungeon.js – v4 (fixed)
 */

import {
    Vector3,
    MeshBuilder,
    PhysicsAggregate,
    PhysicsShapeType,
    PBRMaterial,
    Color3,
    PointLight,
    Tools,
    Texture,
    StandardMaterial
} from '@babylonjs/core';
import { createPBRMat } from '../tools/pbrmat';

// ─── Constants ────────────────────────────────────────────────────────────────
const FLOOR_THICKNESS = 0.3;
const FLOOR_Y         = -(FLOOR_THICKNESS / 2);
const DEFAULT_CEIL_H  = 15;

const STEP_W     = 12;
const STEP_H     = 0.1;
const STEP_D     = 0.40;
const STEP_COUNT = 20;

const STAIR_TOTAL_HEIGHT = STEP_COUNT * STEP_H;

// ─── makePBR — props only ─────────────────────────────────────────────────────
export function makePBR(name, cfg, scene) {
    const mat = new StandardMaterial(name, scene);
    if (cfg?.albedoColor) mat.diffuseColor = Color3.FromHexString(cfg.albedoColor);
    if (cfg?.emissiveColor) mat.emissiveColor = Color3.FromHexString(cfg.emissiveColor);
    mat.specularColor = new Color3(0, 0, 0);
    return mat;
}
export function clearPBRCache() {}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const worldX = (gx, cs) => gx * cs + cs / 2;
const worldZ = (gz, cs) => gz * cs + cs / 2;

function spawnLight(id, x, y, z, cfg, scene) {
    const l = new PointLight(id, new Vector3(x, y, z), scene);
    l.diffuse = l.specular = Color3.FromHexString(cfg.color ?? "#ffffff");
    l.intensity = cfg.intensity ?? 1.0;
    l.range     = cfg.range     ?? 20;
    return l;
}

function getCeilHeight(dungeon, gx, gz) {
    for (const r of dungeon.rooms) {
        const { x, y, width, height } = r.bounds;
        if (gx >= x && gx < x+width && gz >= y && gz < y+height)
            return r.ceiling?.height ?? DEFAULT_CEIL_H;
    }
    return DEFAULT_CEIL_H;
}

// ─── Staircase + Boss Gate ────────────────────────────────────────────────────
function buildStaircaseAndGate(scene, dungeon, cs, wallH) {
    const { bossRoom, stairApproach } = dungeon;
    if (!bossRoom || !stairApproach) return;

    const {
        approachDir,
        floorEdgeX, floorEdgeZ,
        stairCentreX, stairCentreZ,
        corridorWorldWidth,
        stairBaseX, stairBaseZ,
    } = stairApproach;
    const { dx, dz } = approachDir;

    const stepW    = corridorWorldWidth;
    const totalRun = STEP_COUNT * STEP_D;

    const stepMat = makePBR("mat_stair_step", { albedoColor: "#3a3030", roughness: 0.75, metallic: 0.1 }, scene);
    const rimMat  = makePBR("mat_stair_rim",  { albedoColor: "#6a4020", emissiveColor: "#3a1800", emissiveIntensity: 0.4, roughness: 0.5, metallic: 0.3 }, scene);
    const gateMat = makePBR("mat_boss_gate",  { albedoColor: "#1a0505", emissiveColor: "#cc2200", emissiveIntensity: 1.5, roughness: 0.2, metallic: 0.9 }, scene);

    for (let i = 0; i < STEP_COUNT; i++) {
        const distFromEdge = totalRun - i * STEP_D - STEP_D / 2;
        const stepX = dz !== 0 ? stairCentreX : floorEdgeX - dx * distFromEdge;
        const stepZ = dx !== 0 ? stairCentreZ : floorEdgeZ - dz * distFromEdge;
        const stepY = i * STEP_H + STEP_H / 2;

        const step = MeshBuilder.CreateBox(`stair_step_${i}`, {
            width:  dz !== 0 ? stepW  : STEP_D,
            height: STEP_H,
            depth:  dx !== 0 ? stepW  : STEP_D,
        }, scene);
        step.position = new Vector3(stepX, stepY, stepZ);
        step.material = i % 2 === 0 ? stepMat : rimMat;
        new PhysicsAggregate(step, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }

    // spawnLight("light_stair_base",
    //     dz !== 0 ? stairCentreX : stairBaseX,
    //     1.5,
    //     dx !== 0 ? stairCentreZ : stairBaseZ,
    //     { color: "#ff4400", intensity: 0.5, range: 14 }, scene);

    const landingX = dz !== 0 ? stairCentreX : floorEdgeX + dx * (cs / 2);
    const landingZ = dx !== 0 ? stairCentreZ : floorEdgeZ + dz * (cs / 2);
    const landingMat = makePBR("mat_landing", { albedoColor: "#3a1a1a", roughness: 0.6, metallic: 0.1 }, scene);
    const landing = MeshBuilder.CreateBox("boss_landing", {
        width:  dz !== 0 ? stepW : cs,
        height: FLOOR_THICKNESS,
        depth:  dx !== 0 ? stepW : cs,
    }, scene);
    landing.position = new Vector3(landingX, STAIR_TOTAL_HEIGHT + FLOOR_Y, landingZ);
    landing.material = landingMat;
    new PhysicsAggregate(landing, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const gateX = dz !== 0 ? stairCentreX : floorEdgeX + dx * cs;
    const gateZ = dx !== 0 ? stairCentreZ : floorEdgeZ + dz * cs;
    const gateY = STAIR_TOTAL_HEIGHT;
    const gateW = corridorWorldWidth;
    const gateH = wallH;

    const gate = MeshBuilder.CreateBox("boss_gate", {
        width:  dz !== 0 ? gateW : 0.3,
        height: gateH,
        depth:  dx !== 0 ? gateW : 0.3,
    }, scene);
    gate.position = new Vector3(gateX, gateY + gateH / 2, gateZ);
    gate.material = gateMat;
    new PhysicsAggregate(gate, PhysicsShapeType.BOX, { mass: 0 }, scene);

    // spawnLight("light_boss_gate", gateX, gateY + gateH * 0.6, gateZ,
    //     { color: "#ff1100", intensity: 1.2, range: 20 }, scene);

    const sealMat   = makePBR("mat_gate_seal", { albedoColor: "#1a0808", roughness: 0.7, metallic: 0.15 }, scene);
    const sealH     = wallH + STAIR_TOTAL_HEIGHT;
    const sealHalfW = gateW / 2 + cs / 2;

    [1, -1].forEach((side, fi) => {
        const sx = dz !== 0 ? gateX + side * sealHalfW : gateX;
        const sz = dx !== 0 ? gateZ + side * sealHalfW : gateZ;

        const seal = MeshBuilder.CreateBox(`gate_seal_${fi}`, {
            width:  cs,
            height: sealH,
            depth:  cs,
        }, scene);
        seal.position = new Vector3(sx, sealH / 2, sz);
        seal.material = sealMat;
        new PhysicsAggregate(seal, PhysicsShapeType.BOX, { mass: 0 }, scene);

        // spawnLight(`light_gate_seal_${fi}`, sx, gateY + 2, sz,
        //     { color: "#ff3300", intensity: 0.5, range: 8 }, scene);
    });
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function createDungeon(scene, dungeon, matOverrides = {}, rockTemplate = null, tileTemplate = null) {
    const { grid } = dungeon.layout;
    const cs       = dungeon.layout.cellSize;
    const wallH    = dungeon.walls.height;

    const { wallTexName, floorTexName, ceilingTexName } = dungeon.textures;

    // ── Single material per surface type ──────────────────────────────────────
    const wallMat  = createPBRMat("walls",wallTexName, scene, {}, new Color3(0.07, 0.11, 0.09));
    const floorMat = createPBRMat("floors",floorTexName, scene, {}, new Color3(0.12, 0.18, 0.14));

    const ceilMat = new StandardMaterial("mat_ceil", scene);
    ceilMat.albedoColor       = Color3.FromHexString("#080808");
    ceilMat.roughness         = 1;
    ceilMat.metallic          = 0;
    ceilMat.environmentIntensity = 0.05;

    const bossRoom = dungeon.rooms.find(r => r.type === "boss_room");

    function isInBossRoom(gx, gz) {
        if (!bossRoom) return false;
        const { x, y, width, height } = bossRoom.bounds;
        return gx >= x && gx < x+width && gz >= y && gz < y+height;
    }

    const BOSS_ELEVATION = STAIR_TOTAL_HEIGHT;

    // Pre-build boss wall key set
    const bossWallKeys = new Set();
    if (bossRoom) {
        const { x: bx, y: by, width: bw, height: bh } = bossRoom.bounds;
        for (let gz = 0; gz < grid.length; gz++) {
            for (let gx = 0; gx < grid[gz].length; gx++) {
                if (grid[gz][gx] !== 0) continue;
                const neighbours = [[gx-1,gz],[gx+1,gz],[gx,gz-1],[gx,gz+1]];
                for (const [nx, nz] of neighbours) {
                    if (nx >= bx && nx < bx+bw && nz >= by && nz < by+bh) {
                        bossWallKeys.add(`${gx}_${gz}`);
                        break;
                    }
                }
            }
        }
    }

    // ── Single wall template ───────────────────────────────────────────────────
    const wallTemplate = MeshBuilder.CreateBox("_tpl_wall", { width: cs, height: wallH, depth: cs }, scene);
    wallTemplate.material = wallMat;
    wallTemplate.isVisible = false;

    // ── Floor template — GLB tile or simple box ────────────────────────────────
    let floorTemplate;
    if (tileTemplate) {
        const bbox  = tileTemplate.getBoundingInfo().boundingBox;
        const tileW = (bbox.maximum.x - bbox.minimum.x) || 1;
        const tileD = (bbox.maximum.z - bbox.minimum.z) || 1;
        tileTemplate.scaling   = new Vector3(cs / tileW, 5, cs / tileD);
        tileTemplate.isVisible = false;
        tileTemplate.isPickable = false;

        // Apply floorMat to the GLB root and all child meshes
        tileTemplate.material = floorMat;
        tileTemplate.getChildMeshes?.().forEach(child => {
            child.material = floorMat
            child.isPickable = false
        });

        floorTemplate = tileTemplate;
    } else {
        floorTemplate = MeshBuilder.CreateBox("_tpl_floor", { width: cs, height: FLOOR_THICKNESS, depth: cs }, scene);
        floorTemplate.material = floorMat;
        floorTemplate.isVisible = false;
    }

    // ── Single ceiling template ────────────────────────────────────────────────
    const ceilTemplate = MeshBuilder.CreateBox("_tpl_ceil", { width: cs, height: FLOOR_THICKNESS, depth: cs }, scene);
    ceilTemplate.material = ceilMat;
    ceilTemplate.isVisible = false;

    let wallCount = 0, floorCount = 0, ceilCount = 0;

    for (let gz = 0; gz < grid.length; gz++) {
        for (let gx = 0; gx < grid[gz].length; gx++) {
            const cell   = grid[gz][gx];
            const cx     = worldX(gx, cs);
            const cz     = worldZ(gz, cs);
            const inBoss = isInBossRoom(gx, gz);

            if (cell === 0) {
                // Wall cell
                const isBossWall = bossWallKeys.has(`${gx}_${gz}`);
                const elev = isBossWall ? BOSS_ELEVATION : 0;
                const inst = wallTemplate.createInstance(`wall_${wallCount++}`);
                inst.position = new Vector3(cx, elev + wallH / 2, cz);
                new PhysicsAggregate(inst, PhysicsShapeType.BOX, { mass: 0 }, scene);
                continue;
            }

            // Floor + ceiling cell
            const elev = inBoss ? 0 : 0;

            // Floor instance
            const fi = floorTemplate.createInstance(`floor_${floorCount++}`);
            const tileJitter = dungeon.tileHeights?.[`${gx}_${gz}`] ?? 0;

            if (tileTemplate) {
                const bbox  = tileTemplate.getBoundingInfo().boundingBox;
                const halfH = ((bbox.maximum.y - bbox.minimum.y) / 2) || 0.05;
                fi.position = new Vector3(cx, elev - halfH + tileJitter, cz);
            } else {
                fi.position = new Vector3(cx, elev + FLOOR_Y + tileJitter, cz);
            }
            fi.rotationQuaternion = null
   

            const fiAggregate = new PhysicsAggregate(fi, PhysicsShapeType.BOX, { mass: 0 }, scene);
            fiAggregate.shape.material = {
                restitution: 0,    // no bounciness
                friction: 1,     // moderate friction for better ground control
            }
            // Ceiling instance
            const ch = getCeilHeight(dungeon, gx, gz);
            const ci = ceilTemplate.createInstance(`ceil_${ceilCount++}`);
            ci.position = new Vector3(cx, elev + ch + FLOOR_THICKNESS / 2, cz);
        }
    }

    // ── Props ──────────────────────────────────────────────────────────────────
    dungeon.props?.forEach(prop => {
        const px   = worldX(prop.x, cs);
        const pz   = worldZ(prop.y, cs);
        const sc   = prop.scale ?? 1.0;
        const pMat = prop.pbr ? makePBR(`pmat_${prop.id}`, prop.pbr, scene) : null;

        // switch (prop.type) {
        //     case "torch": {
        //         const poleMat  = makePBR("mat_tpole",  { albedoColor: "#4a2a10", roughness: 0.8,  metallic: 0.05 }, scene);
        //         const flameMat = makePBR("mat_tflame", { albedoColor: "#ff6600", emissiveColor: "#ff4400", emissiveIntensity: 3.0, roughness: 0.4, metallic: 0.0 }, scene);
        //         const pole  = MeshBuilder.CreateCylinder(`${prop.id}_pole`,  { height: 1.2, diameter: 0.1 }, scene);
        //         const flame = MeshBuilder.CreateSphere  (`${prop.id}_flame`, { diameter: 0.3 }, scene);
        //         pole.position  = new Vector3(px, 0.6,  pz);
        //         flame.position = new Vector3(px, 1.35, pz);
        //         pole.material  = poleMat;
        //         flame.material = flameMat;
        //         spawnLight(`light_${prop.id}`, px, 1.5, pz, { color: "#ff8844", intensity: 0.7, range: 12 }, scene);
        //         break;
        //     }
        //     case "barrel": {
        //         const mat = pMat ?? makePBR("mat_barrel", { albedoColor: "#5c3317", roughness: 0.75, metallic: 0.05 }, scene);
        //         const h   = 1.5 * sc;
        //         const b   = MeshBuilder.CreateCylinder(prop.id, { height: h, diameter: 0.8 * sc }, scene);
        //         b.position   = new Vector3(px, h / 2, pz);
        //         b.rotation.y = Tools.ToRadians(prop.rotation ?? 0);
        //         b.material   = mat;
        //         new PhysicsAggregate(b, PhysicsShapeType.CYLINDER, { mass: 10 }, scene);
        //         break;
        //     }
        //     case "chest":
        //     case "ancient_chest": {
        //         const mat = pMat ?? makePBR("mat_chest", { albedoColor: "#8b6914", roughness: 0.4, metallic: 0.6 }, scene);
        //         const W = 1.0*sc, H = 0.8*sc, D = 0.6*sc;
        //         const c = MeshBuilder.CreateBox(prop.id, { width: W, height: H, depth: D }, scene);
        //         c.position   = new Vector3(px, H / 2, pz);
        //         c.rotation.y = Tools.ToRadians(prop.rotation ?? 0);
        //         c.material   = mat;
        //         new PhysicsAggregate(c, PhysicsShapeType.BOX, { mass: 20 }, scene);
        //         break;
        //     }
        //     case "crystal_cluster": {
        //         const mat = pMat ?? makePBR("mat_ccluster", { albedoColor: "#4488ff", emissiveColor: "#2244dd", emissiveIntensity: 2.0, roughness: 0.05, metallic: 0.7 }, scene);
        //         [
        //             { h: 1.8*sc, d: 0.28*sc, ox: 0,        oz: 0,        rz: 0   },
        //             { h: 1.2*sc, d: 0.18*sc, ox:  0.25*sc, oz:  0.10*sc, rz: 10  },
        //             { h: 1.0*sc, d: 0.15*sc, ox: -0.20*sc, oz:  0.15*sc, rz: -10 },
        //         ].forEach((s, i) => {
        //             const m = MeshBuilder.CreateCylinder(`${prop.id}_s${i}`, {
        //                 height: s.h, diameterTop: 0, diameterBottom: s.d, tessellation: 6
        //             }, scene);
        //             m.position   = new Vector3(px + s.ox, s.h / 2, pz + s.oz);
        //             m.rotation.y = Tools.ToRadians((prop.rotation ?? 0) + i * 25);
        //             m.rotation.z = Tools.ToRadians(s.rz);
        //             m.material   = mat;
        //         });
        //         if (prop.pbr?.emissiveIntensity > 1.0)
        //             spawnLight(`light_${prop.id}`, px, 1.2*sc, pz,
        //                 { color: prop.pbr.emissiveColor ?? "#4466ff", intensity: prop.pbr.emissiveIntensity * 0.25, range: 12*sc }, scene);
        //         break;
        //     }
        //     case "crystal_pillar": {
        //         const mat = pMat ?? makePBR("mat_cpillar", { albedoColor: "#44aaff", emissiveColor: "#1166dd", emissiveIntensity: 2.5, roughness: 0.04, metallic: 0.7 }, scene);
        //         const ph  = 3.5 * sc;
        //         const p   = MeshBuilder.CreateCylinder(`${prop.id}_body`, {
        //             height: ph, diameterTop: 0.12*sc, diameterBottom: 0.38*sc, tessellation: 7
        //         }, scene);
        //         p.position   = new Vector3(px, ph / 2, pz);
        //         p.rotation.y = Tools.ToRadians(prop.rotation ?? 0);
        //         p.material   = mat;
        //         new PhysicsAggregate(p, PhysicsShapeType.CYLINDER, { mass: 0 }, scene);
        //         const tip = MeshBuilder.CreateSphere(`${prop.id}_tip`, { diameter: 0.45*sc }, scene);
        //         tip.position = new Vector3(px, ph + 0.2*sc, pz);
        //         tip.material = mat;
        //         spawnLight(`light_${prop.id}`, px, ph + 0.3*sc, pz,
        //             { color: prop.pbr?.emissiveColor ?? "#4488ff", intensity: (prop.pbr?.emissiveIntensity ?? 2.5) * 0.35, range: 18*sc }, scene);
        //         break;
        //     }
        //     case "stalagmite": {
        //         const mat = pMat ?? makePBR("mat_stalagmite", { albedoColor: "#222228", roughness: 0.88, metallic: 0.02 }, scene);
        //         const h   = 1.6 * sc;
        //         const s   = MeshBuilder.CreateCylinder(prop.id, { height: h, diameterTop: 0.04*sc, diameterBottom: 0.3*sc, tessellation: 6 }, scene);
        //         s.position   = new Vector3(px, h / 2, pz);
        //         s.rotation.y = Tools.ToRadians(prop.rotation ?? 0);
        //         s.material   = mat;
        //         new PhysicsAggregate(s, PhysicsShapeType.CYLINDER, { mass: 0 }, scene);
        //         break;
        //     }
        //     default:
        //         console.warn(`[generateDungeon] Unknown prop type: "${prop.type}"`);
        // }
    });

    // ── Scene lights ───────────────────────────────────────────────────────────
    // dungeon.lighting?.lights?.forEach((cfg, i) => {
    //     if (cfg.type === "point")
    //         spawnLight(`scene_light_${i}`, cfg.x * cs, cfg.y, cfg.z * cs,
    //             { color: cfg.color, intensity: cfg.intensity, range: cfg.range }, scene);
    // });

    // ── Rocks ──────────────────────────────────────────────────────────────────
    if (rockTemplate && dungeon.rocks?.length) {
        rockTemplate.isVisible = false;

        const bossElev = dungeon.bossRoom ? STAIR_TOTAL_HEIGHT : 0;

        dungeon.rocks.forEach(rock => {
            const inst = rockTemplate.createInstance(rock.id);
            const wx   = rock.gridX * cs + cs / 2;
            const wz   = rock.gridZ * cs + cs / 2;

            let elev = 0;
            if (bossRoom) {
                const { x, y, width, height } = bossRoom.bounds;
                if (rock.gridX >= x && rock.gridX < x + width &&
                    rock.gridZ >= y && rock.gridZ < y + height) {
                    elev = bossElev;
                }
            }

            const halfH = (rock.scaleY ?? rock.scale ?? 1.5) * 1.2 * 0.72;
            inst.position = new Vector3(wx, elev + halfH, wz);
            inst.scaling  = new Vector3(
                rock.scaleX ?? rock.scale ?? 1.5,
                rock.scaleY ?? rock.scale ?? 1.5,
                rock.scaleZ ?? rock.scale ?? 1.5
            );
            inst.rotation.x = Tools.ToRadians(rock.rotX ?? 0);
            inst.rotation.y = Tools.ToRadians(rock.rotY ?? rock.rotation ?? 0);
            inst.rotation.z = Tools.ToRadians(rock.rotZ ?? 0);

            const avgScale = ((rock.scaleX ?? 1.5) + (rock.scaleZ ?? 1.5)) / 2;
            new PhysicsAggregate(inst, PhysicsShapeType.SPHERE,
                { mass: 0, radius: 1.2 * avgScale }, scene);
        });
    }

    buildStaircaseAndGate(scene, dungeon, cs, wallH);
}