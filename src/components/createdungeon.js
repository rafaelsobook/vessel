/**
 * generateDungeon.js – v4
 *
 * What changed from v3:
 *  - No door generation (doors array is always empty / ignored)
 *  - buildStaircaseAndGate() creates:
 *      • A 10-step staircase of CreateBox steps leading UP to boss room level
 *        Each step: width=5, height=0.5, depth=0.5  (as requested)
 *        Steps stack so each one is 0.5 units higher and 0.5 units deeper than the last
 *      • A wide ornate boss gate (single wide door box) at the top of the stairs
 *        at the boss room entrance wall
 *
 * BabylonJS box coordinate rules (unchanged):
 *   width  = X axis
 *   height = Y axis  (up/down)
 *   depth  = Z axis
 *   Box position = centre of the box
 *
 *   Floor tile top face at Y=0:
 *     pos.y = -FLOOR_THICKNESS / 2
 *
 *   Step i (0-based) sitting on the floor with stacking:
 *     pos.y   = STEP_H/2 + i * STEP_H      ← each step sits on the one below
 *     pos.z   = startZ + i * STEP_D        ← each step protrudes outward
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
} from '@babylonjs/core';

// ─── Constants ────────────────────────────────────────────────────────────────
const FLOOR_THICKNESS = 0.3;
const FLOOR_Y         = -(FLOOR_THICKNESS / 2);
const DEFAULT_CEIL_H  = 15;

// ── Staircase tuning: ALL stair visuals controlled here ──────────────────────
//
//  STEP_W      width across the staircase (perpendicular to travel direction).
//              Must match the corridor mouth: corridorWidth(3) x cellSize(4) = 12.
//              Set to 12 to fill the full opening with no side gaps.
//
//  STEP_H      rise per step. 0.1 = very flat and walkable.
//
//  STEP_D      tread depth per step (along travel direction). 0.40 = comfortable.
//
//  STEP_COUNT  number of steps. Boss room is elevated by STEP_COUNT * STEP_H.
//              20 steps x 0.1 = 2.0 units total elevation.
//
const STEP_W     = 12;   // widened to fill corridor mouth (no more side gaps)
const STEP_H     = 0.1;  // flat step rise (as requested)
const STEP_D     = 0.40; // step tread depth
const STEP_COUNT = 20;   // 20 steps as requested

// Boss room floor elevation = total stair height = 20 x 0.1 = 2.0 units
const STAIR_TOTAL_HEIGHT = STEP_COUNT * STEP_H;

// ─── PBR factory (cached) ─────────────────────────────────────────────────────
const _pbrCache = new Map();

export function makePBR(name, cfg, scene) {
    if (_pbrCache.has(name)) return _pbrCache.get(name);
    const mat = new PBRMaterial(name, scene);
    if (cfg.albedoColor)       mat.albedoColor      = Color3.FromHexString(cfg.albedoColor);
    if (cfg.emissiveColor)     mat.emissiveColor     = Color3.FromHexString(cfg.emissiveColor);
    if (cfg.emissiveIntensity) mat.emissiveIntensity = cfg.emissiveIntensity;
    mat.roughness               = cfg.roughness ?? 0.8;
    mat.metallic                = cfg.metallic  ?? 0.0;
    mat.usePhysicalLightFalloff = true;
    mat.environmentIntensity    = 0.1;
    _pbrCache.set(name, mat);
    return mat;
}
export function clearPBRCache() { _pbrCache.clear(); }

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

function inferDoorOrientation(grid, gx, gz) {
    const rows = grid.length, cols = grid[0].length;
    const W = gx > 0      && grid[gz][gx-1] !== 0;
    const E = gx < cols-1 && grid[gz][gx+1] !== 0;
    const N = gz > 0      && grid[gz-1][gx] !== 0;
    const S = gz < rows-1 && grid[gz+1][gx] !== 0;
    if ((W || E) && !(N || S)) return "horizontal";
    if ((N || S) && !(W || E)) return "vertical";
    return null;
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
/**
 * Builds a 10-step staircase leading to the boss room, then a wide boss gate
 * at the top of the stairs on the boss room's entrance wall.
 *
 * The staircase is always oriented so it approaches the nearest wall of the
 * boss room. Steps are stacked: each step is STEP_W wide, STEP_H tall, STEP_D deep.
 * Step i sits at:
 *   worldY  = STEP_H/2 + i * STEP_H       (stacks upward)
 *   worldZ  = approachZ + i * STEP_D * dir (marches toward the boss room)
 *
 * @param {Scene}  scene
 * @param {object} dungeon
 * @param {number} cs        cellSize
 * @param {number} wallH     wall height
 */
function buildStaircaseAndGate(scene, dungeon, cs, wallH) {
    const { bossRoom, stairApproach } = dungeon;
    if (!bossRoom || !stairApproach) return;

    const {
        approachDir,
        floorEdgeX, floorEdgeZ,   // outer wall face on corridor side
        stairCentreX, stairCentreZ, // world XZ centre of corridor opening
        corridorWorldWidth,          // ACTUAL corridor width in world units
        stairBaseX, stairBaseZ,     // world XZ of step 0 centre
    } = stairApproach;
    const { dx, dz } = approachDir;

    // stepW = actual corridor width — steps fill the opening exactly, no gaps
    const stepW    = corridorWorldWidth;
    const totalRun = STEP_COUNT * STEP_D;

    const stepMat = makePBR("mat_stair_step", { albedoColor: "#3a3030", roughness: 0.75, metallic: 0.1 }, scene);
    const rimMat  = makePBR("mat_stair_rim",  { albedoColor: "#6a4020", emissiveColor: "#3a1800", emissiveIntensity: 0.4, roughness: 0.5, metallic: 0.3 }, scene);
    const gateMat = makePBR("mat_boss_gate",  { albedoColor: "#1a0505", emissiveColor: "#cc2200", emissiveIntensity: 1.5, roughness: 0.2, metallic: 0.9 }, scene);

    // Build steps anchored from floorEdge backwards.
    // stairCentreX/Z is the corridor centre — steps are centred there.
    // Each step i:
    //   - XZ centre along travel axis: floorEdge - dir*(totalRun - i*STEP_D - STEP_D/2)
    //   - XZ centre perp axis: stairCentreX or stairCentreZ (constant)
    //   - Y centre: i*STEP_H + STEP_H/2
    for (let i = 0; i < STEP_COUNT; i++) {
        const distFromEdge = totalRun - i * STEP_D - STEP_D / 2;
        // Move along travel axis from floorEdge; use corridor centre on perp axis
        const stepX = dz !== 0 ? stairCentreX : floorEdgeX - dx * distFromEdge;
        const stepZ = dx !== 0 ? stairCentreZ : floorEdgeZ - dz * distFromEdge;
        const stepY = i * STEP_H + STEP_H / 2;

        const step = MeshBuilder.CreateBox(`stair_step_${i}`, {
            width:  dz !== 0 ? stepW  : STEP_D,   // wide along perp, thin along travel
            height: STEP_H,
            depth:  dx !== 0 ? stepW  : STEP_D,
        }, scene);
        step.position = new Vector3(stepX, stepY, stepZ);
        step.material = i % 2 === 0 ? stepMat : rimMat;
        new PhysicsAggregate(step, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }

    spawnLight("light_stair_base",
        dz !== 0 ? stairCentreX : stairBaseX,
        1.5,
        dx !== 0 ? stairCentreZ : stairBaseZ,
        { color: "#ff4400", intensity: 0.5, range: 14 }, scene);

    // ── Landing platform ──────────────────────────────────────────────────
    // Raised slab at STAIR_TOTAL_HEIGHT covering the wall-thickness gap.
    // Width = corridorWorldWidth (exact corridor opening), depth = cs (wall thickness).
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

    // ── Boss Gate ─────────────────────────────────────────────────────────
    // Gate at inner wall face (floorEdge + cs along travel).
    // Width = corridorWorldWidth — exactly covers the opening, no gaps, no overrun.
    // Height = full wallH from boss floor to boss ceiling.
    const gateX = dz !== 0 ? stairCentreX : floorEdgeX + dx * cs;
    const gateZ = dx !== 0 ? stairCentreZ : floorEdgeZ + dz * cs;
    const gateY = STAIR_TOTAL_HEIGHT;
    const gateW = corridorWorldWidth;   // ← from actual grid scan, not a constant
    const gateH = wallH;

    const gate = MeshBuilder.CreateBox("boss_gate", {
        width:  dz !== 0 ? gateW : 0.3,
        height: gateH,
        depth:  dx !== 0 ? gateW : 0.3,
    }, scene);
    gate.position = new Vector3(gateX, gateY + gateH / 2, gateZ);
    gate.material = gateMat;
    new PhysicsAggregate(gate, PhysicsShapeType.BOX, { mass: 0 }, scene);

    spawnLight("light_boss_gate", gateX, gateY + gateH * 0.6, gateZ,
        { color: "#ff1100", intensity: 1.2, range: 20 }, scene);

    // ── Side seal blocks ──────────────────────────────────────────────────
    // Two blocks, one on each side of the gate.
    // They fill from the gate edge to the dungeon wall (cs wide each side).
    // Height spans from Y=0 to boss ceiling to leave zero gap anywhere.
    const sealMat = makePBR("mat_gate_seal", { albedoColor: "#1a0808", roughness: 0.7, metallic: 0.15 }, scene);
    const sealH   = wallH + STAIR_TOTAL_HEIGHT;  // Y=0 → boss ceiling
    const sealHalfW = gateW / 2 + cs / 2;        // offset from gate centre to seal centre

    [1, -1].forEach((side, fi) => {
        // Offset along the PERPENDICULAR axis only
        const sx = dz !== 0 ? gateX + side * sealHalfW : gateX;
        const sz = dx !== 0 ? gateZ + side * sealHalfW : gateZ;

        const seal = MeshBuilder.CreateBox(`gate_seal_${fi}`, {
            // cs wide along perpendicular, cs deep along travel
            width:  dz !== 0 ? cs : cs,
            height: sealH,
            depth:  dx !== 0 ? cs : cs,
        }, scene);
        seal.position = new Vector3(sx, sealH / 2, sz);
        seal.material = sealMat;
        new PhysicsAggregate(seal, PhysicsShapeType.BOX, { mass: 0 }, scene);

        spawnLight(`light_gate_seal_${fi}`, sx, gateY + 2, sz,
            { color: "#ff3300", intensity: 0.5, range: 8 }, scene);
    });
}


// ─── Main export ──────────────────────────────────────────────────────────────
export function generateDungeon(scene, dungeon, matOverrides = {}) {
    const { grid } = dungeon.layout;
    const cs       = dungeon.layout.cellSize;
    const wallH    = dungeon.walls.height;

    // Shared surface materials
    const wallMat  = matOverrides.wall
        ?? makePBR("mat_wall",  dungeon.walls?.pbr  ?? { albedoColor: "#1e1e1e", roughness: 0.9,  metallic: 0.02 }, scene);
    const floorMat = matOverrides.floor
        ?? makePBR("mat_floor", dungeon.rooms?.[0]?.pbr?.floor ?? { albedoColor: "#2a2a2a", roughness: 0.85, metallic: 0.0 }, scene);
    const ceilMat  = matOverrides.ceiling
        ?? makePBR("mat_ceil",  dungeon.rooms?.[0]?.pbr?.ceiling ?? { albedoColor: "#111111", roughness: 0.92, metallic: 0.0 }, scene);

    // Boss room gets its own floor/ceil material
    const bossRoom  = dungeon.rooms.find(r => r.type === "boss_room");
    const bFloorMat = bossRoom?.pbr?.floor
        ? makePBR("mat_boss_floor", bossRoom.pbr.floor, scene)
        : makePBR("mat_boss_floor", { albedoColor: "#3a1a1a", roughness: 0.6, metallic: 0.1 }, scene);
    const bCeilMat  = bossRoom?.pbr?.ceiling
        ? makePBR("mat_boss_ceil", bossRoom.pbr.ceiling, scene)
        : makePBR("mat_boss_ceil", { albedoColor: "#2a0808", roughness: 0.7, metallic: 0.05 }, scene);

    // Helper: is this cell inside the boss room?
    function isInBossRoom(gx, gz) {
        if (!bossRoom) return false;
        const { x, y, width, height } = bossRoom.bounds;
        return gx >= x && gx < x+width && gz >= y && gz < y+height;
    }

    // ── Grid loop: walls + floors + ceilings ──────────────────────────────────
    //
    // BOSS ROOM ELEVATION = STAIR_TOTAL_HEIGHT (20 steps x 0.1 = 2.0 units)
    //
    // THREE things must be elevated together so everything lines up:
    //   1. Boss room FLOOR tiles  → top face at BOSS_ELEVATION (= 2.0)
    //   2. Boss room CEILING tiles → bottom face at BOSS_ELEVATION + ceilH
    //   3. Boss room WALL cells   → base at BOSS_ELEVATION, not at 0
    //      A wall cell is "boss-adjacent" if ANY of its 4 neighbours is inside
    //      the boss room bounds. This catches the perimeter walls correctly.
    //
    const BOSS_ELEVATION = STAIR_TOTAL_HEIGHT; // = 2.0 units

    // Pre-build a Set of "boss wall" grid keys so the loop is O(1) per cell
    const bossWallKeys = new Set();
    if (bossRoom) {
        const { x: bx, y: by, width: bw, height: bh } = bossRoom.bounds;
        for (let gz = 0; gz < grid.length; gz++) {
            for (let gx = 0; gx < grid[gz].length; gx++) {
                if (grid[gz][gx] !== 0) continue; // only wall cells
                // Check all 4 neighbours — if any is inside boss room, this wall is elevated
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

    for (let gz = 0; gz < grid.length; gz++) {
        for (let gx = 0; gx < grid[gz].length; gx++) {
            const cell   = grid[gz][gx];
            const cx     = worldX(gx, cs);
            const cz     = worldZ(gz, cs);
            const inBoss = isInBossRoom(gx, gz);

            if (cell === 0) {
                // Wall cell — elevated if it borders the boss room
                const isBossWall = bossWallKeys.has(`${gx}_${gz}`);
                const elev = isBossWall ? BOSS_ELEVATION : 0;

                const wall = MeshBuilder.CreateBox(`wall_${gx}_${gz}`, {
                    width: cs, height: wallH, depth: cs
                }, scene);
                // Base of wall at elev, centre at elev + wallH/2
                wall.position = new Vector3(cx, elev + wallH / 2, cz);
                wall.material = wallMat;
                new PhysicsAggregate(wall, PhysicsShapeType.BOX, { mass: 0 }, scene);
                continue;
            }

            // Walkable cell — elevated if inside boss room
            const elev = inBoss ? BOSS_ELEVATION : 0;

            // FLOOR: top face at Y = elev  →  centre at elev + FLOOR_Y
            const floor = MeshBuilder.CreateBox(`floor_${gx}_${gz}`, {
                width: cs, height: FLOOR_THICKNESS, depth: cs
            }, scene);
            floor.position = new Vector3(cx, elev + FLOOR_Y, cz);
            floor.material = inBoss ? bFloorMat : floorMat;
            new PhysicsAggregate(floor, PhysicsShapeType.BOX, { mass: 0 }, scene);

            // CEILING: bottom face at elev + ceilH  →  centre at elev + ceilH + FLOOR_THICKNESS/2
            const ch   = getCeilHeight(dungeon, gx, gz);
            const ceil = MeshBuilder.CreateBox(`ceil_${gx}_${gz}`, {
                width: cs, height: FLOOR_THICKNESS, depth: cs
            }, scene);
            ceil.position = new Vector3(cx, elev + ch + FLOOR_THICKNESS / 2, cz);
            ceil.material = inBoss ? bCeilMat : ceilMat;
        }
    }

    // ── Props ──────────────────────────────────────────────────────────────────
    dungeon.props?.forEach(prop => {
        const px   = worldX(prop.x, cs);
        const pz   = worldZ(prop.y, cs);
        const sc   = prop.scale ?? 1.0;
        const pMat = prop.pbr ? makePBR(`pmat_${prop.id}`, prop.pbr, scene) : null;

        switch (prop.type) {

            case "torch": {
                const poleMat  = makePBR("mat_tpole",  { albedoColor: "#4a2a10", roughness: 0.8,  metallic: 0.05 }, scene);
                const flameMat = makePBR("mat_tflame", { albedoColor: "#ff6600", emissiveColor: "#ff4400", emissiveIntensity: 3.0, roughness: 0.4, metallic: 0.0 }, scene);
                const pole  = MeshBuilder.CreateCylinder(`${prop.id}_pole`,  { height: 1.2, diameter: 0.1 }, scene);
                const flame = MeshBuilder.CreateSphere  (`${prop.id}_flame`, { diameter: 0.3 }, scene);
                pole.position  = new Vector3(px, 0.6,  pz);
                flame.position = new Vector3(px, 1.35, pz);
                pole.material  = poleMat;
                flame.material = flameMat;
                spawnLight(`light_${prop.id}`, px, 1.5, pz, { color: "#ff8844", intensity: 0.7, range: 12 }, scene);
                break;
            }

            case "barrel": {
                const mat = pMat ?? makePBR("mat_barrel", { albedoColor: "#5c3317", roughness: 0.75, metallic: 0.05 }, scene);
                const h   = 1.5 * sc;
                const b   = MeshBuilder.CreateCylinder(prop.id, { height: h, diameter: 0.8 * sc }, scene);
                b.position   = new Vector3(px, h / 2, pz);
                b.rotation.y = Tools.ToRadians(prop.rotation ?? 0);
                b.material   = mat;
                new PhysicsAggregate(b, PhysicsShapeType.CYLINDER, { mass: 10 }, scene);
                break;
            }

            case "chest":
            case "ancient_chest": {
                const mat = pMat ?? makePBR("mat_chest", { albedoColor: "#8b6914", roughness: 0.4, metallic: 0.6 }, scene);
                const W = 1.0*sc, H = 0.8*sc, D = 0.6*sc;
                const c = MeshBuilder.CreateBox(prop.id, { width: W, height: H, depth: D }, scene);
                c.position   = new Vector3(px, H / 2, pz);
                c.rotation.y = Tools.ToRadians(prop.rotation ?? 0);
                c.material   = mat;
                new PhysicsAggregate(c, PhysicsShapeType.BOX, { mass: 20 }, scene);
                break;
            }

            case "crystal_cluster": {
                const mat = pMat ?? makePBR("mat_ccluster", { albedoColor: "#4488ff", emissiveColor: "#2244dd", emissiveIntensity: 2.0, roughness: 0.05, metallic: 0.7 }, scene);
                [
                    { h: 1.8*sc, d: 0.28*sc, ox: 0,        oz: 0,        rz: 0   },
                    { h: 1.2*sc, d: 0.18*sc, ox:  0.25*sc, oz:  0.10*sc, rz: 10  },
                    { h: 1.0*sc, d: 0.15*sc, ox: -0.20*sc, oz:  0.15*sc, rz: -10 },
                ].forEach((s, i) => {
                    const m = MeshBuilder.CreateCylinder(`${prop.id}_s${i}`, {
                        height: s.h, diameterTop: 0, diameterBottom: s.d, tessellation: 6
                    }, scene);
                    m.position   = new Vector3(px + s.ox, s.h / 2, pz + s.oz);
                    m.rotation.y = Tools.ToRadians((prop.rotation ?? 0) + i * 25);
                    m.rotation.z = Tools.ToRadians(s.rz);
                    m.material   = mat;
                });
                if (prop.pbr?.emissiveIntensity > 1.0)
                    spawnLight(`light_${prop.id}`, px, 1.2*sc, pz,
                        { color: prop.pbr.emissiveColor ?? "#4466ff", intensity: prop.pbr.emissiveIntensity * 0.25, range: 12*sc }, scene);
                break;
            }

            case "crystal_pillar": {
                const mat = pMat ?? makePBR("mat_cpillar", { albedoColor: "#44aaff", emissiveColor: "#1166dd", emissiveIntensity: 2.5, roughness: 0.04, metallic: 0.7 }, scene);
                const ph  = 3.5 * sc;
                const p   = MeshBuilder.CreateCylinder(`${prop.id}_body`, {
                    height: ph, diameterTop: 0.12*sc, diameterBottom: 0.38*sc, tessellation: 7
                }, scene);
                p.position   = new Vector3(px, ph / 2, pz);
                p.rotation.y = Tools.ToRadians(prop.rotation ?? 0);
                p.material   = mat;
                new PhysicsAggregate(p, PhysicsShapeType.CYLINDER, { mass: 0 }, scene);
                const tip = MeshBuilder.CreateSphere(`${prop.id}_tip`, { diameter: 0.45*sc }, scene);
                tip.position = new Vector3(px, ph + 0.2*sc, pz);
                tip.material = mat;
                spawnLight(`light_${prop.id}`, px, ph + 0.3*sc, pz,
                    { color: prop.pbr?.emissiveColor ?? "#4488ff", intensity: (prop.pbr?.emissiveIntensity ?? 2.5) * 0.35, range: 18*sc }, scene);
                break;
            }

            case "stalagmite": {
                const mat = pMat ?? makePBR("mat_stalagmite", { albedoColor: "#222228", roughness: 0.88, metallic: 0.02 }, scene);
                const h   = 1.6 * sc;
                const s   = MeshBuilder.CreateCylinder(prop.id, { height: h, diameterTop: 0.04*sc, diameterBottom: 0.3*sc, tessellation: 6 }, scene);
                s.position   = new Vector3(px, h / 2, pz);
                s.rotation.y = Tools.ToRadians(prop.rotation ?? 0);
                s.material   = mat;
                new PhysicsAggregate(s, PhysicsShapeType.CYLINDER, { mass: 0 }, scene);
                break;
            }

            default:
                console.warn(`[generateDungeon] Unknown prop type: "${prop.type}"`);
        }
    });

    // ── Scene lights ──────────────────────────────────────────────────────────
    dungeon.lighting?.lights?.forEach((cfg, i) => {
        if (cfg.type === "point")
            spawnLight(`scene_light_${i}`, cfg.x * cs, cfg.y, cfg.z * cs,
                { color: cfg.color, intensity: cfg.intensity, range: cfg.range }, scene);
    });

    // ── Staircase + Boss Gate (built last so it's on top of the floor) ────────
    buildStaircaseAndGate(scene, dungeon, cs, wallH);
}