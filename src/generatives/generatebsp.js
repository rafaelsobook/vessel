/**
 * bspDungeonGenerator.js  – v4
 * Changes from v3:
 *  - ALL door generation removed (no doors array)
 *  - Last BSP leaf is always the "boss_room" type
 *  - dungeon.bossRoom  exported  { gridX, gridY, width, height }
 *  - dungeon.stairEntry exported { gridX, gridY }  — the corridor cell
 *    just outside the boss room where the staircase base will be placed
 */

const T_WALL     = 0;
const T_FLOOR    = 1;
const T_CORRIDOR = 4;

// ─── PRNG ──────────────────────────────────────────────────────────────────
function seededRNG(seed) {
    let s = seed >>> 0;
    return () => {
        s += 0x6d2b79f5;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function rInt(rng, lo, hi) { return Math.floor(rng() * (hi - lo + 1)) + lo; }

// ─── Grid ──────────────────────────────────────────────────────────────────
function inBounds(grid, x, y) {
    return y >= 0 && y < grid.length && x >= 0 && x < grid[0].length;
}
function get(grid, x, y)        { return inBounds(grid, x, y) ? grid[y][x] : T_WALL; }
function set(grid, x, y, tile)  { if (inBounds(grid, x, y)) grid[y][x] = tile; }
function fillRect(grid, x, y, w, h, tile) {
    for (let row = y; row < y + h; row++)
        for (let col = x; col < x + w; col++)
            set(grid, col, row, tile);
}

// ─── BSP ───────────────────────────────────────────────────────────────────
const MIN_LEAF = 8;

class BSPNode {
    constructor(x, y, w, h) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.left = null; this.right = null; this.room = null;
    }
    isLeaf() { return !this.left && !this.right; }
    centre() {
        if (this.room) return {
            x: this.room.x + Math.floor(this.room.w / 2),
            y: this.room.y + Math.floor(this.room.h / 2),
        };
        const lc = this.left?.centre(), rc = this.right?.centre();
        if (lc && rc) return { x: Math.floor((lc.x + rc.x) / 2), y: Math.floor((lc.y + rc.y) / 2) };
        return lc ?? rc ?? { x: this.x + Math.floor(this.w / 2), y: this.y + Math.floor(this.h / 2) };
    }
    leaves(out = []) {
        if (this.isLeaf()) { out.push(this); return out; }
        this.left?.leaves(out); this.right?.leaves(out); return out;
    }
}

function splitNode(node, rng, depth = 0) {
    if (depth >= 5) return;
    const canW = node.w >= MIN_LEAF * 2, canH = node.h >= MIN_LEAF * 2;
    if (!canW && !canH) return;
    let horiz = node.h >= node.w;
    if (canW && !canH) horiz = false;
    if (canH && !canW) horiz = true;
    if (rng() < 0.2) horiz = !horiz;
    if (horiz) {
        const sp = rInt(rng, MIN_LEAF, node.h - MIN_LEAF);
        node.left  = new BSPNode(node.x, node.y,        node.w, sp);
        node.right = new BSPNode(node.x, node.y + sp,   node.w, node.h - sp);
    } else {
        const sp = rInt(rng, MIN_LEAF, node.w - MIN_LEAF);
        node.left  = new BSPNode(node.x,        node.y, sp,          node.h);
        node.right = new BSPNode(node.x + sp,   node.y, node.w - sp, node.h);
    }
    splitNode(node.left,  rng, depth + 1);
    splitNode(node.right, rng, depth + 1);
}

function carveRooms(node, rng) {
    if (node.isLeaf()) {
        const maxW = node.w - 2, maxH = node.h - 2;
        const rw = rInt(rng, 4, Math.max(4, maxW));
        const rh = rInt(rng, 4, Math.max(4, maxH));
        const rx = node.x + rInt(rng, 1, Math.max(1, maxW - rw + 1));
        const ry = node.y + rInt(rng, 1, Math.max(1, maxH - rh + 1));
        node.room = { x: rx, y: ry, w: rw, h: rh };
        return;
    }
    node.left  && carveRooms(node.left,  rng);
    node.right && carveRooms(node.right, rng);
}

function paintRooms(node, grid) {
    if (node.isLeaf() && node.room) {
        fillRect(grid, node.room.x, node.room.y, node.room.w, node.room.h, T_FLOOR);
        return;
    }
    node.left  && paintRooms(node.left,  grid);
    node.right && paintRooms(node.right, grid);
}

// ─── Corridors ─────────────────────────────────────────────────────────────
function digLine(grid, x0, y0, x1, y1, cw) {
    const hw = Math.floor(cw / 2);
    if (x0 === x1) {
        const [minY, maxY] = [Math.min(y0,y1), Math.max(y0,y1)];
        for (let y = minY; y <= maxY; y++)
            for (let dx = -hw; dx <= hw; dx++) {
                const t = get(grid, x0+dx, y);
                if (t !== T_FLOOR) set(grid, x0+dx, y, T_CORRIDOR);
            }
    } else {
        const [minX, maxX] = [Math.min(x0,x1), Math.max(x0,x1)];
        for (let x = minX; x <= maxX; x++)
            for (let dy = -hw; dy <= hw; dy++) {
                const t = get(grid, x, y0+dy);
                if (t !== T_FLOOR) set(grid, x, y0+dy, T_CORRIDOR);
            }
    }
}

function digLCorridor(grid, ax, ay, bx, by, cw, rng) {
    const hw = Math.floor(cw / 2);
    const bendX = rng() < 0.5 ? bx : ax;
    const bendY = bendX === bx  ? ay : by;
    digLine(grid, ax, ay, bendX, bendY, cw);
    digLine(grid, bendX, bendY, bx, by, cw);
    // Fill bend square
    for (let dy = -hw; dy <= hw; dy++)
        for (let dx = -hw; dx <= hw; dx++) {
            const t = get(grid, bendX+dx, bendY+dy);
            if (t !== T_FLOOR) set(grid, bendX+dx, bendY+dy, T_CORRIDOR);
        }
}

function connectSiblings(node, grid, rng, cw) {
    if (node.isLeaf()) return;
    node.left  && connectSiblings(node.left,  grid, rng, cw);
    node.right && connectSiblings(node.right, grid, rng, cw);
    const lc = node.left?.centre(), rc = node.right?.centre();
    if (lc && rc) digLCorridor(grid, lc.x, lc.y, rc.x, rc.y, cw, rng);
}

function finaliseTiles(grid) {
    for (let y = 0; y < grid.length; y++)
        for (let x = 0; x < grid[y].length; x++)
            if (grid[y][x] === T_CORRIDOR) grid[y][x] = T_FLOOR;
}

// ─── Compute exact stair approach geometry from the grid ─────────────────────
//
// This function scans every cell on all 4 sides of the boss room to find which
// side has floor tiles (the corridor entrance). It then measures the ACTUAL
// connected floor span on that side to get the real corridor width in world units.
//
// Everything generateDungeon needs is computed here in grid/world space:
//
//   approachDir  { dx, dz }  unit vector pointing INTO the boss room
//   floorEdgeX/Z             world XZ of the outer boss room wall face on the corridor side
//   stairCentreX/Z           world XZ centre of the corridor (used to centre the staircase)
//   corridorWorldWidth        actual corridor width in world units (for gate + seal sizing)
//   stairBaseX/Z             world XZ where step 0 is centred (STAIR_CELLS back from wall)
//
const STAIR_CELLS = 6;

function findStairApproach(grid, room, cellSize) {
    const { x, y, w, h } = room;
    const rows = grid.length;
    const cols = grid[0].length;

    // Scan a side and return the contiguous span of T_FLOOR cells
    function scanSide(fixedVal, scanFrom, scanTo, isRow) {
        // isRow=true  → we fix Y=fixedVal, scan X from scanFrom to scanTo
        // isRow=false → we fix X=fixedVal, scan Y from scanFrom to scanTo
        let minFloor = null, maxFloor = null;
        for (let i = scanFrom; i <= scanTo; i++) {
            const gx = isRow ? i        : fixedVal;
            const gy = isRow ? fixedVal : i;
            if (gy >= 0 && gy < rows && gx >= 0 && gx < cols && grid[gy][gx] === T_FLOOR) {
                if (minFloor === null) minFloor = i;
                maxFloor = i;
            }
        }
        return { minFloor, maxFloor };
    }

    // Check all 4 sides of the boss room, one cell outside each wall
    const candidates = [
        // South side: row y+h is outside the bottom wall
        { side: 'south', isRow: true,  fixedVal: y + h,  scanFrom: x, scanTo: x + w - 1,
          dir: { dx: 0, dz: -1 },
          floorEdgeZ: (y + h) * cellSize,  // outer face of south wall
          getFloorEdgeX: (mid) => mid * cellSize + cellSize / 2,
          getFloorEdgeZ: ()    => (y + h) * cellSize,
          getStairBaseZ: ()    => (y + h + STAIR_CELLS) * cellSize,
          getStairBaseX: (mid) => mid * cellSize + cellSize / 2,
        },
        // North side: row y-1 is outside the top wall
        { side: 'north', isRow: true,  fixedVal: y - 1,  scanFrom: x, scanTo: x + w - 1,
          dir: { dx: 0, dz: 1 },
          getFloorEdgeX: (mid) => mid * cellSize + cellSize / 2,
          getFloorEdgeZ: ()    => y * cellSize,
          getStairBaseZ: ()    => (y - STAIR_CELLS) * cellSize,
          getStairBaseX: (mid) => mid * cellSize + cellSize / 2,
        },
        // East side: col x+w is outside the right wall
        { side: 'east', isRow: false, fixedVal: x + w,  scanFrom: y, scanTo: y + h - 1,
          dir: { dx: -1, dz: 0 },
          getFloorEdgeX: ()    => (x + w) * cellSize,
          getFloorEdgeZ: (mid) => mid * cellSize + cellSize / 2,
          getStairBaseX: ()    => (x + w + STAIR_CELLS) * cellSize,
          getStairBaseZ: (mid) => mid * cellSize + cellSize / 2,
        },
        // West side: col x-1 is outside the left wall
        { side: 'west', isRow: false, fixedVal: x - 1,  scanFrom: y, scanTo: y + h - 1,
          dir: { dx: 1, dz: 0 },
          getFloorEdgeX: ()    => x * cellSize,
          getFloorEdgeZ: (mid) => mid * cellSize + cellSize / 2,
          getStairBaseX: ()    => (x - STAIR_CELLS) * cellSize,
          getStairBaseZ: (mid) => mid * cellSize + cellSize / 2,
        },
    ];

    for (const c of candidates) {
        const { minFloor, maxFloor } = scanSide(c.fixedVal, c.scanFrom, c.scanTo, c.isRow);
        if (minFloor === null) continue; // no floor on this side

        // Compute corridor centre cell index and actual span in grid cells
        const spanCells   = maxFloor - minFloor + 1;
        const midCell     = minFloor + (spanCells - 1) / 2;  // can be fractional for even spans

        // World-space centre of the corridor opening
        const corridorWorldWidth = spanCells * cellSize;
        const stairCentreX = c.getFloorEdgeX(midCell);
        const stairCentreZ = c.getFloorEdgeZ(midCell);

        return {
            approachDir:         c.dir,
            floorEdgeX:          c.getFloorEdgeX(midCell),
            floorEdgeZ:          c.getFloorEdgeZ(midCell),
            stairCentreX,
            stairCentreZ,
            corridorWorldWidth,           // ACTUAL corridor width in world units
            stairBaseX:          c.getStairBaseX(midCell),
            stairBaseZ:          c.getStairBaseZ(midCell),
        };
    }

    // Fallback (should never happen in a connected dungeon)
    const cx = x + Math.floor(w / 2);
    return {
        approachDir:        { dx: 0, dz: -1 },
        floorEdgeX:         (cx + 0.5) * cellSize,
        floorEdgeZ:         (y + h)    * cellSize,
        stairCentreX:       (cx + 0.5) * cellSize,
        stairCentreZ:       (y + h)    * cellSize,
        corridorWorldWidth: 3 * cellSize,
        stairBaseX:         (cx + 0.5) * cellSize,
        stairBaseZ:         (y + h + STAIR_CELLS) * cellSize,
    };
}

// ─── Room metadata ─────────────────────────────────────────────────────────
const ROOM_TYPES = ["chamber", "armory", "library", "crypt", "guard_post", "barracks"];

function collectRooms(leaves, wallH) {
    const ceilH = wallH - 0.1;
    return leaves.map((leaf, i) => {
        const { x, y, w, h } = leaf.room;
        const isLast = i === leaves.length - 1;
        const type   = i === 0     ? "entrance"
                     : isLast      ? "boss_room"
                     : ROOM_TYPES[i % ROOM_TYPES.length];
        return {
            id:     `room_${i}`,
            type,
            bounds: { x, y, width: w, height: h },
            floor:  type === "entrance"  ? "stone_tile"
                  : type === "boss_room" ? "marble"
                  : "cobblestone",
            // Boss room ceiling height is relative to its elevated floor (STAIR_TOTAL_HEIGHT).
            // All other rooms use ceilH relative to Y=0.
            ceiling: { height: ceilH, texture: "stone_ceiling" },
            pbr: {
                floor:   type === "boss_room"
                    ? { albedoColor: "#3a1a1a", roughness: 0.6, metallic: 0.1 }
                    : { albedoColor: "#282828", roughness: 0.88, metallic: 0.02 },
                ceiling: type === "boss_room"
                    ? { albedoColor: "#2a0808", roughness: 0.7, metallic: 0.05 }
                    : { albedoColor: "#111111", roughness: 0.92, metallic: 0.0  },
            },
        };
    });
}

// ─── Props ─────────────────────────────────────────────────────────────────
function placeProps(rooms, grid, rng) {
    const props = [];
    rooms.forEach((room, ri) => {
        const { x, y, width: w, height: h } = room.bounds;
        if (room.type === "boss_room") return; // boss room decorated separately

        // Two torches per room at the near corners
        if (w >= 4 && h >= 4) {
            [{ tx: x+1, ty: y+1 }, { tx: x+w-2, ty: y+1 }].forEach(({ tx, ty }, ti) => {
                if (get(grid, tx, ty) === T_FLOOR)
                    props.push({ id: `torch_${ri}_${ti}`, type: "torch", x: tx, y: ty, rotation: 0, lit: true });
            });
        }

        // Barrel
        if (w >= 3 && h >= 3) {
            const bx = x + rInt(rng, 1, w-2), bz = y + rInt(rng, 1, h-2);
            if (get(grid, bx, bz) === T_FLOOR)
                props.push({ id: `barrel_${ri}`, type: "barrel", x: bx, y: bz, rotation: rInt(rng, 0, 359) });
        }

        // Chest in crypt
        if (room.type === "crypt") {
            props.push({ id: `chest_${ri}`, type: "chest",
                x: x + Math.floor(w/2), y: y + Math.floor(h/2), rotation: 0, locked: true });
        }
    });
    return props;
}

// ─── Lights ────────────────────────────────────────────────────────────────
function placeLights(rooms, wallH) {
    return rooms.map(r => ({
        type:      "point",
        x:         r.bounds.x + r.bounds.width  / 2,
        y:         wallH * 0.7,
        z:         r.bounds.y + r.bounds.height / 2,
        intensity: r.type === "boss_room" ? 0.6 : 0.3,
        color:     r.type === "boss_room" ? "#ff2200" : "#445566",
        range:     Math.max(r.bounds.width, r.bounds.height) * 2,
    }));
}

// ─── Public API ────────────────────────────────────────────────────────────
//
// textures parameter shape:
//   textures: {
//     wall:    { diffuse: "rock2",  normal: "rock2normal"  },
//     floor:   { diffuse: "rock2",  normal: "rock2normal"  },
//     ceiling: { diffuse: "rock2",  normal: "rock2normal"  },
//   }
//
// You can also pass a single shorthand — if only `wall` is given (or just a
// top-level diffuse/normal), it is used for wall, floor AND ceiling:
//   textures: { diffuse: "rock2", normal: "rock2normal" }
//
// Texture paths are resolved in generateDungeon as:
//   "./images/modeltex/<diffuse>.jpg"   (albedo)
//   "./images/modeltex/<normal>.jpg"    (bump/normal map)
//
export function generateBSPDungeon({
    seed          = Date.now(),
    gridWidth     = 32,
    gridHeight    = 32,
    cellSize      = 4,
    wallHeight    = 15,
    corridorWidth = 3,
    name          = "Procedural Dungeon",
    difficulty    = 1,
    textures
} = {}) {
    // Normalise textures: if caller passes { diffuse, normal } at the top level,
    // treat it as applying to wall, floor and ceiling.
    // If caller passes { wall: {...}, floor: {...}, ceiling: {...} }, use as-is.
    // Missing sub-keys fall back to the wall texture.
    let normTex = { wall: textures, floor: textures, ceiling: textures };
    // if (textures) {
    //     console.log(textures.diffuse)
    //     if (textures.diffuse || textures.normal) {
    //         // Shorthand: same texture for everything
    //         normTex = { wall: textures, floor: textures, ceiling: textures };
    //     } else {
    //         normTex = {
    //             wall:    textures.wall    ?? textures.floor ?? textures.ceiling ?? null,
    //             floor:   textures.floor   ?? textures.wall  ?? textures.ceiling ?? null,
    //             ceiling: textures.ceiling ?? textures.wall  ?? textures.floor   ?? null,
    //         };
    //     }
    // }
    const rng = seededRNG(seed);

    const grid = Array.from({ length: gridHeight }, () => new Array(gridWidth).fill(T_WALL));

    const root = new BSPNode(1, 1, gridWidth - 2, gridHeight - 2);
    splitNode(root, rng);
    carveRooms(root, rng);
    paintRooms(root, grid);
    connectSiblings(root, grid, rng, corridorWidth);
    finaliseTiles(grid);

    const leaves = root.leaves();
    const rooms  = collectRooms(leaves, wallHeight);
    const props  = placeProps(rooms, grid, rng);
    const lights = placeLights(rooms, wallHeight);

    // Boss room is always the last leaf
    const bossLeaf = leaves[leaves.length - 1];
    const bossRoom = bossLeaf.room;

    // stairApproach gives generateDungeon everything it needs to place stairs:
    //   stairBaseX/Z  — world XZ where step 0 is centred (back of staircase)
    //   floorEdgeX/Z  — world XZ where boss room floor begins (top of staircase)
    //   approachDir   — { dx, dz } unit vector pointing from corridor into room
    const stairApproach = findStairApproach(grid, bossRoom, cellSize);

    const entranceRoom = rooms[0];
    const spawn = {
        x: entranceRoom.bounds.x + Math.floor(entranceRoom.bounds.width  / 2),
        y: 0,
        z: entranceRoom.bounds.y + Math.floor(entranceRoom.bounds.height / 2),
        rotation: 0,
    };

    return {
        meta: { name, difficulty, theme: "stone_dungeon", seed, created: Date.now() },
        layout: { width: gridWidth, height: gridHeight, cellSize, grid },
        rooms,
        walls: {
            thickness: 0.3,
            height:    wallHeight,
            // pbr:       { albedoColor: "#1c1c1c", roughness: 0.92, metallic: 0.02 },
            // textures sub-object — null if no textures were passed
            textures: normTex,
            segments: [],
        },
        doors:  [],
        props,
        lighting: {
            ambient: { intensity: 0.15, color: "#2a2a3e" },
            lights,
        },
        bossRoom: {
            gridX:  bossRoom.x,
            gridY:  bossRoom.y,
            width:  bossRoom.w,
            height: bossRoom.h,
        },
        stairApproach,  // { stairBaseX, stairBaseZ, floorEdgeX, floorEdgeZ, approachDir }
        spawn,
    };
}