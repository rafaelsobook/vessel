/**
 * genvillagemd.js — unified area / village metadata generator
 *
 * One function handles open-air areas (forest, plains) and settlements.
 * The caller shapes the output by adjusting property counts:
 *
 *   Forest  →  totalSmallHouse: 0,  totalBigTrees: 20, wallHeight: 0
 *   Village →  totalBigHouse: 15,   totalBigTrees: 2,  palisadeSpacing: 2.5
 *   Room    →  totalSmallHouse: 0,  totalBigTrees: 0,  wallHeight: 15
 *
 * entry / exit set which edge connects to the next zone and punch a gate gap
 * in the palisade (village) or mark a transition point on the boundary (area).
 *
 * Usage:
 *   import { generateVillageMetaData } from './genvillagemd';
 *
 *   const village = generateVillageMetaData({
 *       name: 'Oakwood', totalBigHouse: 15, totalBigTrees: 2,
 *       entry: 'north', exit: 'south',
 *   });
 */

// ─── PRNG ──────────────────────────────────────────────────────────────────────
function seededRNG(seed) {
    let s = seed >>> 0;
    return () => {
        s += 0x6d2b79f5;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CELL_SIZE = 4;

const CLEARANCE = {
    smallHouse:  1,
    mediumHouse: 1,
    bigHouse:    1,
    smallTree:   2,
    mediumTree:  2,
    bigTree:     2,
    lightPole:   1,
    grass:       0,
    herb:        1,
    mushroom:    1,
};

const VARIANTS = {
    smallHouse:  3,
    mediumHouse: 3,
    bigHouse:    2,
    smallTree:   4,
    mediumTree:  3,
    bigTree:     2,
    lightPole:   1,
    grass:       5,
    herb:        4,
    mushroom:    3,
};

// ─── PBR defaults ─────────────────────────────────────────────────────────────
const DEFAULT_OUTDOOR_FLOOR_PBR = { albedoColor: '#4a6741', roughness: 0.95, metallic: 0.00 };
const DEFAULT_DIRT_PBR          = { albedoColor: '#7a5c3a', roughness: 0.98, metallic: 0.00 };
const DEFAULT_INDOOR_FLOOR_PBR  = { albedoColor: '#282828', roughness: 0.88, metallic: 0.02 };
const DEFAULT_WALL_PBR          = { albedoColor: '#1c1c1c', roughness: 0.92, metallic: 0.02 };
const DEFAULT_CEIL_PBR          = { albedoColor: '#080808', roughness: 1.00, metallic: 0.00 };

// ─── Tile height jitter ───────────────────────────────────────────────────────
const TILE_JITTER = { min: 0.0, max: 0.06 };

function buildTileHeightMap(cols, rows, rng) {
    const map  = {};
    const lerp = (a, b, t) => a + t * (b - a);
    for (let tz = 0; tz < rows; tz++)
        for (let tx = 0; tx < cols; tx++)
            map[`${tx}_${tz}`] = lerp(TILE_JITTER.min, TILE_JITTER.max, rng());
    return map;
}

// ─── Occupancy grid ───────────────────────────────────────────────────────────
function makeGrid() {
    const occupied = new Set();

    function worldToCell(wx, wz) {
        return { gx: Math.floor(wx / CELL_SIZE), gz: Math.floor(wz / CELL_SIZE) };
    }

    function markOccupied(wx, wz, radius) {
        const r = Math.ceil(radius / CELL_SIZE);
        const { gx: cx, gz: cz } = worldToCell(wx, wz);
        for (let dz = -r; dz <= r; dz++)
            for (let dx = -r; dx <= r; dx++)
                if (dx * dx + dz * dz <= r * r)
                    occupied.add(`${cx + dx}_${cz + dz}`);
    }

    function isAreaFree(wx, wz, radius) {
        const r = Math.ceil(radius / CELL_SIZE);
        const { gx: cx, gz: cz } = worldToCell(wx, wz);
        for (let dz = -r; dz <= r; dz++)
            for (let dx = -r; dx <= r; dx++)
                if (dx * dx + dz * dz <= r * r)
                    if (occupied.has(`${cx + dx}_${cz + dz}`)) return false;
        return true;
    }

    return { markOccupied, isAreaFree };
}

// ─── Palisade ─────────────────────────────────────────────────────────────────
/**
 * Stakes along all 4 sides. entryDir / exitDir each open a doorWidth-wide gap
 * at the centre of that side so a gate mesh can be placed there.
 */
function buildPalisade(width, height, spacing, stakeHeight, stakeRadius, entryDir, exitDir, doorWidth) {
    const stakes = [];
    let id = 0;

    const halfW = width  / 2;
    const halfH = height / 2;
    const y     = stakeHeight / 2;
    const hw    = doorWidth   / 2;

    const tiltVariants = [0, 0.04, -0.03, 0.02, -0.05, 0.03];

    function addStake(x, z) {
        const tilt = tiltVariants[id % tiltVariants.length];
        stakes.push({
            id:      `palisade_${id++}`,
            type:    'palisadeStake',
            x, y, z,
            rotation: 0,
            tiltX:    tilt,
            scale:   { x: 1, y: 1, z: 1 },
            radius:   stakeRadius,
            height:   stakeHeight,
        });
    }

    // Returns true when the stake at `along` world-units from centre falls
    // inside the gate gap for that side direction.
    function inGap(along, sideDir) {
        return (sideDir === entryDir || sideDir === exitDir) && Math.abs(along) < hw;
    }

    // north = +Z, south = -Z
    for (let x = -halfW; x <= halfW; x += spacing)
        if (!inGap(x, 'north')) addStake(x,  halfH);

    for (let x = -halfW; x <= halfW; x += spacing)
        if (!inGap(x, 'south')) addStake(x, -halfH);

    for (let z = -halfH + spacing; z < halfH; z += spacing)
        if (!inGap(z, 'west')) addStake(-halfW, z);

    for (let z = -halfH + spacing; z < halfH; z += spacing)
        if (!inGap(z, 'east')) addStake( halfW, z);

    return { stakeHeight, stakeRadius, spacing, doorWidth, stakes };
}

// ─── Item placement ───────────────────────────────────────────────────────────
function placeItems({ type, count, clearance, halfW, halfH, grid, rng, scaleRange = [1.0, 1.0], yOffset = 0 }) {
    const MAX_ATTEMPTS = 250;
    const items = [];
    for (let i = 0; i < count; i++) {
        for (let a = 0; a < MAX_ATTEMPTS; a++) {
            const x = (rng() * 2 - 1) * halfW;
            const z = (rng() * 2 - 1) * halfH;
            if (clearance > 0 && !grid.isAreaFree(x, z, clearance)) continue;
            const s = scaleRange[0] + rng() * (scaleRange[1] - scaleRange[0]);
            items.push({
                id:       `${type}_${i}`,
                type,
                x,
                y:        yOffset,
                z,
                rotation: Math.floor(rng() * 4) * 90,
                scale:    { x: s, y: s, z: s },
                variant:  Math.floor(rng() * VARIANTS[type]),
            });
            if (clearance > 0) grid.markOccupied(x, z, clearance);
            break;
        }
    }
    return items;
}

function placeLightPoles(count, halfW, halfH, grid, rng) {
    return placeItems({
        type: 'lightPole', count, clearance: CLEARANCE.lightPole,
        halfW, halfH, grid, rng, scaleRange: [1.0, 1.0],
    }).map(pole => ({ ...pole, lit: true }));
}

// ─── Indoor torches (enclosed rooms) ─────────────────────────────────────────
function placeTorches(width, height) {
    const hw = width  / 2 - 1;
    const hd = height / 2 - 1;
    return [
        { id: 'torch_nw', type: 'torch', x: -hw, y: 0, z: -hd, rotation:   0, lit: true },
        { id: 'torch_ne', type: 'torch', x:  hw, y: 0, z: -hd, rotation: 180, lit: true },
        { id: 'torch_sw', type: 'torch', x: -hw, y: 0, z:  hd, rotation:   0, lit: true },
        { id: 'torch_se', type: 'torch', x:  hw, y: 0, z:  hd, rotation: 180, lit: true },
    ];
}

// ─── Lighting ─────────────────────────────────────────────────────────────────
function buildOutdoorLighting(width, height) {
    const hw = width  / 2;
    const hd = height / 2;
    return {
        ambient: { intensity: 0.55, color: '#c8d4e8' },
        lights: [
            { type: 'directional', x:  hw * 0.6, y: 80, z: -hd * 0.4, color: '#fffbe6', intensity: 1.1,  range: 0 },
            { type: 'directional', x: -hw * 0.5, y: 40, z:  hd * 0.3, color: '#dce8ff', intensity: 0.35, range: 0 },
            { type: 'hemisphere',  x:  0,         y:  0, z:  0,        color: '#7a9c5a', intensity: 0.2,  range: 0 },
        ],
    };
}

function buildIndoorLighting(width, height, wallHeight) {
    const hw = width  / 2;
    const hd = height / 2;
    const y  = wallHeight * 0.7;
    return {
        ambient: { intensity: 0.15, color: '#2a2a3e' },
        lights: [
            { type: 'point', x:  0,        y, z:  0,        color: '#445566', intensity: 0.4, range: Math.max(width, height) * 1.2 },
            { type: 'point', x: -hw * 0.6, y, z: -hd * 0.6, color: '#334455', intensity: 0.2, range: 14 },
            { type: 'point', x:  hw * 0.6, y, z: -hd * 0.6, color: '#334455', intensity: 0.2, range: 14 },
            { type: 'point', x: -hw * 0.6, y, z:  hd * 0.6, color: '#334455', intensity: 0.2, range: 14 },
            { type: 'point', x:  hw * 0.6, y, z:  hd * 0.6, color: '#334455', intensity: 0.2, range: 14 },
        ],
    };
}

// ─── Dirt paths ───────────────────────────────────────────────────────────────
function buildPaths(width, height) {
    const hw = width  / 2;
    const hd = height / 2;
    return [
        { id: 'path_ew', x1: -hw, z1:  0,   x2: hw, z2:  0,  width: 4, pbr: DEFAULT_DIRT_PBR },
        { id: 'path_ns', x1:  0,  z1: -hd,  x2:  0, z2:  hd, width: 4, pbr: DEFAULT_DIRT_PBR },
    ];
}

// ─── Portal descriptor ────────────────────────────────────────────────────────
// edgeOffset pushes the portal point to the palisade edge for villages,
// or keeps it flush with the area boundary for open-air / enclosed zones.
function buildPortal(dir, halfW, halfH, edgeOffset) {
    // north = +Z, south = -Z
    switch (dir) {
        case 'north': return { direction: 'north', x:  0,               z:  halfH + edgeOffset  };
        case 'south': return { direction: 'south', x:  0,               z: -(halfH + edgeOffset) };
        case 'east':  return { direction: 'east',  x:  halfW + edgeOffset, z: 0                  };
        case 'west':  return { direction: 'west',  x: -(halfW + edgeOffset), z: 0                };
        default:      return { direction: 'north', x:  0,               z:  halfH + edgeOffset  };
    }
}

// ─── Spawn point ──────────────────────────────────────────────────────────────
// Placed just inside the entry edge so the player starts near where they came
// from and has the full area ahead of them. The spawn zone is reserved in the
// occupancy grid before any prop is placed, so nothing blocks the player.
const SPAWN_CLEARANCE = 6; // world-unit radius kept prop-free around spawn

function buildSpawn(entry, halfW, halfH, isEnclosed) {
    // 1 Babylon.js unit = 1 metre. Spawn 3 m inside the area boundary so the
    // player appears just through the gate, not in the middle of the area.
    const inset = 3;
    const y = isEnclosed ? 10 : 1;
    // north = +Z  →  north entry: spawn near +Z edge, face toward -Z (into area)
    // south = -Z  →  south entry: spawn near -Z edge, face toward +Z (into area)
    switch (entry) {
        case 'north': return { x:  0,               y, z:  halfH - inset,  rotation: 180 };
        case 'south': return { x:  0,               y, z: -(halfH - inset), rotation:   0 };
        case 'east':  return { x:  halfW - inset,   y, z:  0,              rotation: 270 };
        case 'west':  return { x: -(halfW - inset),  y, z:  0,              rotation:  90 };
        default:      return { x:  0,               y, z:  halfH - inset,  rotation: 180 };
    }
}

// ─── Public API ───────────────────────────────────────────────────────────────
/**
 * @param {{
 *   placeId?:               string,
 *   name?:               string,
 *   width?:              number,
 *   height?:             number,
 *   cellSize?:           number,
 *   seed?:               number,
 *   theme?:              string,
 *   areaType?:           string,         // auto-derived when omitted
 *   totalSmallHouse?:    number,         // 0 keeps area/forest mode
 *   totalMediumHouse?:   number,
 *   totalBigHouse?:      number,
 *   totalSmallTrees?:    number,
 *   totalMediumTrees?:   number,
 *   totalBigTrees?:      number,
 *   totalLightPoles?:    number,
 *   totalGrass?:         number,
 *   totalHerbs?:         number,
 *   totalMushrooms?:     number,
 *   palisadeSpacing?:    number,
 *   palisadeStakeHeight?:number,
 *   palisadeStakeRadius?:number,
 *   palisadeMargin?:     number,
 *   palisadeDoorWidth?:  number,
 *   wallHeight?:         number,         // >0 makes an enclosed room
 *   difficulty?:         number,
 *   textures?:           object,
 *   floor?:              object,         // PBR override
 *   walls?:              object,         // PBR override
 *   ceiling?:            object,         // PBR override
 *   entry?:              'north'|'south'|'east'|'west',
 *   exit?:               'north'|'south'|'east'|'west',
 * }} options
 */
export function generateArea({
    name             = 'village',
    width            = 200,
    height           = 200,
    cellSize         = CELL_SIZE,
    seed             = Date.now(),
    theme            = 'japanese_village',
    placeId,
    areaType,
    // houses
    totalSmallHouse  = 0,
    totalMediumHouse = 0,
    totalBigHouse    = 0,
    // trees
    totalSmallTrees  = 10,
    totalMediumTrees = 5,
    totalBigTrees    = 2,
    // foliage / poles
    totalLightPoles  = 10,
    totalGrass       = 1000,
    totalHerbs       = 10,
    totalMushrooms   = 10,
    // palisade (village only)
    palisadeSpacing      = 2.5,
    palisadeStakeHeight  = 6,
    palisadeStakeRadius  = 0.4,
    palisadeMargin       = 6,
    palisadeDoorWidth    = 8,
    // enclosed room
    wallHeight = 0,
    difficulty = 1,
    textures   = null,
    floor:   floorOverride = null,
    walls:   wallsOverride = null,
    ceiling: ceilOverride  = null,
    // navigation
    entry = 'north',
    exit  = 'south',
} = {}) {

    const isVillage  = (totalSmallHouse + totalMediumHouse + totalBigHouse) > 0;
    const isEnclosed = wallHeight > 0 && !isVillage;
   
    const floorPBR = floorOverride ?? (isEnclosed ? DEFAULT_INDOOR_FLOOR_PBR : DEFAULT_OUTDOOR_FLOOR_PBR);
    const wallsPBR = wallsOverride ?? DEFAULT_WALL_PBR;
    const ceilPBR  = ceilOverride  ?? DEFAULT_CEIL_PBR;

    const cols  = Math.ceil(width  / cellSize);
    const rows  = Math.ceil(height / cellSize);
    const halfW = width  / 2;
    const halfH = height / 2;

    // Independent sub-RNGs so changing one count never shifts other placements.
    const houseRng   = seededRNG(seed);
    const treeRng    = seededRNG(seed + 1);
    const foliageRng = seededRNG(seed + 2);
    const poleRng    = seededRNG(seed + 3);
    const jitterRng  = seededRNG(seed + 4);

    const grid = makeGrid();

    // Reserve spawn zone first so no prop can land on top of the player.
    const spawn = buildSpawn(entry, halfW, halfH, isEnclosed);
    grid.markOccupied(spawn.x, spawn.z, SPAWN_CLEARANCE);

    // ── Houses (priority placement so trees cluster around them) ──────────────
    const bigHouses = placeItems({
        type: 'bigHouse', count: totalBigHouse,
        clearance: CLEARANCE.bigHouse, halfW, halfH, grid, rng: houseRng,
        scaleRange: [1.0, 1.2],
    });
    const mediumHouses = placeItems({
        type: 'mediumHouse', count: totalMediumHouse,
        clearance: CLEARANCE.mediumHouse, halfW, halfH, grid, rng: houseRng,
        scaleRange: [0.9, 1.1],
    });
    const smallHouses = placeItems({
        type: 'smallHouse', count: totalSmallHouse,
        clearance: CLEARANCE.smallHouse, halfW, halfH, grid, rng: houseRng,
        scaleRange: [0.85, 1.05],
    });

    // ── Trees ─────────────────────────────────────────────────────────────────
    const bigTrees = placeItems({
        type: 'bigTree', count: totalBigTrees,
        clearance: CLEARANCE.bigTree, halfW, halfH, grid, rng: treeRng,
        scaleRange: [1.0, 1.4],
    });
    const mediumTrees = placeItems({
        type: 'mediumTree', count: totalMediumTrees,
        clearance: CLEARANCE.mediumTree, halfW, halfH, grid, rng: treeRng,
        scaleRange: [0.9, 1.2],
    });
    const smallTrees = placeItems({
        type: 'smallTree', count: totalSmallTrees,
        clearance: CLEARANCE.smallTree, halfW, halfH, grid, rng: treeRng,
        scaleRange: [0.8, 1.1],
    });

    // ── Foliage / poles ───────────────────────────────────────────────────────
    const lightPoles = placeLightPoles(totalLightPoles, halfW, halfH, grid, poleRng);
    const grass      = placeItems({
        type: 'grass', count: totalGrass, clearance: 0,
        halfW, halfH, grid, rng: foliageRng, scaleRange: [0.6, 1.3],
    });
    const herbs = placeItems({
        type: 'herb', count: totalHerbs,
        clearance: CLEARANCE.herb, halfW, halfH, grid, rng: foliageRng,
        scaleRange: [0.7, 1.1],
    });
    const mushrooms = placeItems({
        type: 'mushroom', count: totalMushrooms,
        clearance: CLEARANCE.mushroom, halfW, halfH, grid, rng: foliageRng,
        scaleRange: [0.5, 1.0],
    });

    const tileHeights = buildTileHeightMap(cols, rows, jitterRng);

    // Portal sits at the palisade edge for villages, flush with the boundary otherwise.
    const portalOffset = isVillage ? palisadeMargin : 0;

    return {
        placeId,
        areaType,

        meta: {
            name, difficulty, theme, seed,
            created: Date.now(),
            counts: {
                smallHouses:  smallHouses.length,
                mediumHouses: mediumHouses.length,
                bigHouses:    bigHouses.length,
                smallTrees:   smallTrees.length,
                mediumTrees:  mediumTrees.length,
                bigTrees:     bigTrees.length,
                lightPoles:   lightPoles.length,
                grass:        grass.length,
                herbs:        herbs.length,
                mushrooms:    mushrooms.length,
            },
        },

        layout: { width, height, cellSize, cols, rows, grid: [] },

        floor:      { pbr: floorPBR },
        tileHeights,

        // ── Navigation connections ─────────────────────────────────────────────
        entry: buildPortal(entry, halfW, halfH, portalOffset),
        exit:  buildPortal(exit,  halfW, halfH, portalOffset),

        // ── Village-specific (null for area/forest/room) ───────────────────────
        paths:    isVillage ? buildPaths(width, height) : null,
        palisade: isVillage
            ? {
                ...buildPalisade(
                    width  + palisadeMargin * 2,
                    height + palisadeMargin * 2,
                    palisadeSpacing, palisadeStakeHeight, palisadeStakeRadius,
                    entry, exit, palisadeDoorWidth,
                ),
                // Full outer extent so createVillage can size the ground to match.
                outerWidth:  width  + palisadeMargin * 2,
                outerHeight: height + palisadeMargin * 2,
              }
            : null,

        // ── Props ─────────────────────────────────────────────────────────────
        smallHouses, mediumHouses, bigHouses,
        smallTrees, mediumTrees, bigTrees,
        lightPoles, grass, herbs, mushrooms,

        // ── Enclosed-room surfaces (null for open-air) ────────────────────────
        rooms: isEnclosed ? [{
            id:      'room_0',
            type:    'area',
            bounds:  { x: -(width / 2), y: -(height / 2), width, height },
            floor:   'stone_tile',
            ceiling: { height: wallHeight - 0.1, texture: 'stone_ceiling' },
            pbr:     { floor: floorPBR, ceiling: ceilPBR },
        }] : null,
        walls:   isEnclosed ? { thickness: 0.3, height: wallHeight, pbr: wallsPBR, segments: [] } : null,
        ceiling: isEnclosed ? { height: wallHeight, pbr: ceilPBR } : null,
        textures: isEnclosed ? textures : null,
        props:    isEnclosed ? placeTorches(width, height) : [],

        // ── Lighting ──────────────────────────────────────────────────────────
        lighting: isEnclosed
            ? buildIndoorLighting(width, height, wallHeight)
            : buildOutdoorLighting(width, height),

        doors:         [],
        rocks:         [],
        bossRoom:      null,
        stairApproach: null,

        spawn,
    };
}
