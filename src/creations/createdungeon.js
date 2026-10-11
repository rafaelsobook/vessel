/**
 * generateDungeon.js – v5
 * Changes from v4:
 *  - floor tiles are placed by their TOP surface, so the walkable floor is at
 *    y 0 (+ jitter) - it used to end up ~1.64 up inside the 5x-tall tile
 *  - the boss room is a raised dais (bossRoom.elevation) with a staircase cut
 *    into it at its one entrance - walked via an invisible ramp
 *  - only walls that touch a floor cell are built (no buried physics bodies)
 *  - props and room lights from the generator are drawn
 */

import {
    Vector3,
    MeshBuilder,
    PhysicsAggregate,
    PhysicsShapeType,
    Color3,
    PointLight,
    HemisphericLight,
    Light,
    Tools,
    StandardMaterial,
    PBRMaterial,
    Texture
} from '@babylonjs/core';
import { createPBRMat, createHeightBumpTexture, createAlbedoTexture } from '../tools/pbrmat';
import { createFireParticles } from '../tools/particlesystem';
import { createDungeonFloorMat } from '../tools/dungeonFloorMat';
import { buildRivers, buildGrass, spawnVases, spawnTorchStands, TORCH_STAND_HEIGHT } from './dungeonNature';
import { spawnDungeonDoors } from './dungeonDoors';

// ─── Constants ────────────────────────────────────────────────────────────────
const FLOOR_THICKNESS = 0.3;
const FLOOR_Y         = -(FLOOR_THICKNESS / 2);
const DEFAULT_CEIL_H  = 15;
// walls reach this far below the floor - tile1.glb's bevelled edges dip just
// under y 0, which left a hairline view of the void under every wall
const WALL_FOOT       = 2;

// Boss staircase - STEP_COUNT visible steps from the corridor floor up to the
// dais. Rise and run per step follow bossRoom.elevation and the stair's depth
// in cells, so they always match what the generator laid out.
const STEP_COUNT     = 20;
// the invisible ramp under the steps that the player actually walks on
const RAMP_THICKNESS = 0.4;
const RAMP_UNDERRUN  = 0.5;   // extra length past the bottom step, sunk into the floor
// glowing archway over the foot of the stairs
const ARCH_HEIGHT    = 7;
const ARCH_BEAM      = 0.5;
// multiplies the floor's colour texture - white shows it as painted
const FLOOR_TEXTURE_TINT = Color3.White();
// torch prop - the standing model (dungeonNature.js, TORCH_STAND_HEIGHT tall)
// with the fireplace's fire (flame + flickering light) on top
// the fireplace's light is 1.2 / range 5 on its room's brighter floor - these
// dark dungeon tiles need ~4x that for the same warm pool, and range 7 reaches
// the wall behind (torches stand 6 units out from it)
const TORCH_LIGHT_INTENSITY = 5;
const TORCH_LIGHT_RANGE     = 7;

// Room lights - the generator's intensities (0.3 / 0.6 boss) are relative
// values for lights ~10 units over the floor; this scales them to standard
// (range-based) falloff, which is what spawnLight sets.
const ROOM_LIGHT_INTENSITY = 4;
// How many room lights exist at once. A WebGL2 fragment shader typically gets
// only 12 uniform blocks and Babylon spends one per light on top of
// scene/material/mesh, so a light for every room (11 lights) made every
// dungeon material fail to compile. This pool follows the camera to the
// nearest rooms instead - the light count never changes, so moving them
// never recompiles a shader.
const ROOM_LIGHT_POOL = 4;
// hard cap on the lights any dungeon material takes, whatever else exists
const MAX_MATERIAL_LIGHTS = 8;

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
    // range-based falloff - PBR materials default to physical inverse-square
    // falloff, which ignores range and fades these to nothing well before
    // they reach the floor
    l.falloffType = Light.FALLOFF_STANDARD;
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

// ─── Boss staircase ───────────────────────────────────────────────────────────
// The boss room's floor stands bossRoom.elevation above the rest; its one
// entrance gets a staircase cut entrance.stairCells deep into the dais, as wide
// as the opening. The steps are only visual: the player's collider is a box
// that can't climb even a single 0.1 riser (Havok-tested), so an invisible ramp
// under them at the same overall slope is what you actually walk up.
function buildBossStairs(scene, dungeon, cs, wallH, mats) {
    const { elevation, entrance } = dungeon.bossRoom;
    if (!(elevation > 0) || !entrance) return;
    const { dx, dz, cells, stairCells } = entrance;

    // entrance.cells are the corridor cells just outside the room - the room
    // edge is the boundary between them and the room, on the side dx/dz point to
    const c0    = cells[0];
    const edge  = dx > 0 ? (c0.x + 1) * cs : dx < 0 ? c0.x * cs
                : dz > 0 ? (c0.y + 1) * cs : c0.y * cs;
    const span  = cells.map(c => dx !== 0 ? c.y : c.x);
    const first = Math.min(...span) * cs;
    const last  = (Math.max(...span) + 1) * cs;
    const width = last - first;
    const mid   = (first + last) / 2;
    const run   = stairCells * cs;
    // world point s units into the room from the edge, centred on the opening
    const at = (s, y) => dx !== 0 ? new Vector3(edge + dx * s, y, mid) : new Vector3(mid, y, edge + dz * s);

    // visible steps - solid from the floor up, so there's no gap under them.
    // One hidden unit box per step material; every step is an instance of it
    // scaled to its size, so the 20 steps cost 2 draw calls instead of 20.
    const stepTemplates = [mats.step, mats.rim].map((mat, i) => {
        const tpl = MeshBuilder.CreateBox(`_tpl_stair_step_${i}`, { size: 1 }, scene);
        tpl.material = mat;
        tpl.isVisible = false;
        tpl.isPickable = false;
        return tpl;
    });
    const stepD = run / STEP_COUNT;
    const stepH = elevation / STEP_COUNT;
    for (let i = 0; i < STEP_COUNT; i++) {
        const top  = (i + 1) * stepH;
        const step = stepTemplates[i % 2].createInstance(`stair_step_${i}`);
        step.scaling.set(dx !== 0 ? stepD : width, top, dx !== 0 ? width : stepD);
        step.position = at((i + 0.5) * stepD, top / 2);
        step.isPickable = false;
        step.freezeWorldMatrix();
    }

    // the walkable ramp: its top face runs from the edge at floor level to
    // the dais at the far end. Local +z points up the slope - yawed onto
    // dx/dz, pitched up by -slope (positive rotation.x tips +z downward).
    const slope = Math.atan2(elevation, run);
    const up     = new Vector3(dx * Math.cos(slope), Math.sin(slope), dz * Math.cos(slope));
    const normal = new Vector3(-dx * Math.sin(slope), Math.cos(slope), -dz * Math.sin(slope));
    const ramp = MeshBuilder.CreateBox("stair_ramp", {
        width:  width,
        height: RAMP_THICKNESS,
        depth:  Math.hypot(run, elevation) + RAMP_UNDERRUN,
    }, scene);
    ramp.rotation = new Vector3(-slope, Math.atan2(dx, dz), 0);
    ramp.position = at(run / 2, elevation / 2)
        .subtract(normal.scale(RAMP_THICKNESS / 2))
        .subtract(up.scale(RAMP_UNDERRUN / 2));
    ramp.isVisible = false;
    ramp.isPickable = false;
    const rampAggregate = new PhysicsAggregate(ramp, PhysicsShapeType.BOX, { mass: 0 }, scene);
    rampAggregate.shape.material = { restitution: 0, friction: 1 };

    // archway straddling the edge - the old sealed boss gate's look, opened
    // up. Posts stand in the opening's two edges (solid), the beam is
    // overhead, out of reach.
    const postTemplate = MeshBuilder.CreateBox("_tpl_boss_gate_post", { width: ARCH_BEAM, height: ARCH_HEIGHT, depth: ARCH_BEAM }, scene);
    postTemplate.material = mats.gate;
    postTemplate.isVisible = false;
    postTemplate.isPickable = false;
    [first + ARCH_BEAM / 2, last - ARCH_BEAM / 2].forEach((p, i) => {
        const post = postTemplate.createInstance(`boss_gate_post_${i}`);
        post.position = dx !== 0 ? new Vector3(edge, ARCH_HEIGHT / 2, p) : new Vector3(p, ARCH_HEIGHT / 2, edge);
        post.freezeWorldMatrix();
        new PhysicsAggregate(post, PhysicsShapeType.BOX, { mass: 0 }, scene);
    });
    const beam = MeshBuilder.CreateBox("boss_gate", {
        width:  dx !== 0 ? ARCH_BEAM : width,
        height: ARCH_BEAM,
        depth:  dx !== 0 ? width : ARCH_BEAM,
    }, scene);
    beam.position = at(0, ARCH_HEIGHT + ARCH_BEAM / 2);
    beam.material = mats.gate;
    beam.isPickable = false;

    // the boss room's ceiling sits `elevation` higher than the corridor's, so
    // above the opening there'd be a slot open to the void between the two -
    // filled with wall from the corridor's wall top to the raised ceiling
    const header = MeshBuilder.CreateBox("boss_entrance_header", {
        width:  dx !== 0 ? cs / 2 : width,
        height: elevation + FLOOR_THICKNESS,
        depth:  dx !== 0 ? width : cs / 2,
    }, scene);
    header.position = at(0, wallH + (elevation + FLOOR_THICKNESS) / 2);
    header.material = mats.wall;
    header.isPickable = false;
    header.freezeWorldMatrix();
}

// ─── Main export ──────────────────────────────────────────────────────────────
// matOverrides: optional { wall, floor, bossFloor, ceiling } materials to use
// instead of the defaults built below.
// Returns { floorTopY } - the walkable surface height of an un-jittered floor
// tile, for callers that need to stand something on the floor.
export function createDungeon(scene, dungeon, matOverrides = {}, rockTemplate = null, tileTemplate = null) {
    const { grid } = dungeon.layout;
    const cs       = dungeon.layout.cellSize;
    const wallH    = dungeon.walls.height;

    // dungeon.textures.ceilingTexName has no texture files behind it (there is
    // no images/textures/ceilings folder), so the ceiling stays a plain colour.
    // textures can be null (tcp's placesMD dungeon) - fall back to placeId 12's.
    // Both optional, each a full image path:
    //  - floorBumpHeightMap: a grey height-map image used as the floor's bump
    //    instead of floors/<floorTexName>_normal.jpg - see createHeightBumpTexture
    //  - floorAlbedoMap: the floor's colour texture. Without it the floor is a flat
    //    colour (and the boss floor's colour below is that colour, not a tint)
    //  - floorLayers / floorAccent: several textures mixed across the floor so it
    //    doesn't look tiled (tools/dungeonFloorMat.js) - when set, they replace
    //    floorTexName, floorAlbedoMap and floorBumpHeightMap
    const { wallTexName = "wall1.jpg", wallBumpTexName = "wall5normal.jpg", floorTexName = "floor1", floorBumpHeightMap, floorAlbedoMap,
        floorLayers, floorAccent } = dungeon.textures ?? {};

    // ── Single material per surface type ──────────────────────────────────────
    // the floor's bump and albedo are each built once and shared by both floor
    // materials, so it's one texture on the GPU rather than two (undefined = the
    // default normal map / a flat colour). They share a repeat, so the relief
    // stays on the bricks it was made for.
    const floorBump   = floorBumpHeightMap && !floorLayers?.length ? createHeightBumpTexture(floorBumpHeightMap, scene) : undefined;
    const floorAlbedo = floorAlbedoMap && !floorLayers?.length ? createAlbedoTexture(floorAlbedoMap, scene) : undefined;
    const wallMat = new PBRMaterial("wall", scene);
    wallMat.albedoTexture = new Texture(`./images/modeltex/${wallTexName}`, scene);
    wallMat.bumpTexture = new Texture(`./images/modeltex/${wallBumpTexName}`, scene);
    wallMat.roughness = 0.8
    wallMat.albedoTexture.uScale = 1;
    wallMat.albedoTexture.vScale = 1;
    // const wallMat  = matOverrides.wall  ?? createPBRMat("walls",wallTexName, scene, { uScale: 2, vScale: 10}, new Color3(0.07, 0.11, 0.09));
    const mixedFloor = floorLayers?.length > 0;
    const floorMat = matOverrides.floor ?? (mixedFloor
        ? createDungeonFloorMat(scene, "mat_floor", { layers: floorLayers, accent: floorAccent, cellSize: cs })
        : createPBRMat("floors",floorTexName, scene, { bumpTexture: floorBump, albedoTexture: floorAlbedo },
            floorAlbedo ? FLOOR_TEXTURE_TINT : new Color3(0.12, 0.18, 0.14)));
    // the generator's own boss_room floor colour, so the dais reads as its own place
    const bossFloorColor = Color3.FromHexString(dungeon.rooms.find(r => r.type === "boss_room")?.pbr?.floor?.albedoColor ?? "#3a1a1a");
    // over a texture it's a TINT, which multiplies the stone - scaled up so its
    // brightest channel is 1, or the dark red would darken the texture twice over
    const bossFloorTint = bossFloorColor.scale(1 / Math.max(bossFloorColor.r, bossFloorColor.g, bossFloorColor.b, 0.001));
    const bossFloorMat = matOverrides.bossFloor ?? (mixedFloor
        // mostly neutral and darker - the boss room's own red light already
        // floods this material; the full tint on top came out solid scarlet
        ? createDungeonFloorMat(scene, "mat_boss_floor", { layers: floorLayers, accent: floorAccent, cellSize: cs,
            tint: Color3.Lerp(Color3.White(), bossFloorTint, 0.4).scale(0.55) })
        : createPBRMat("floors",floorTexName, scene, { bumpTexture: floorBump, albedoTexture: floorAlbedo },
            floorAlbedo ? bossFloorTint : bossFloorColor));

    // StandardMaterial has no albedoColor/roughness/metallic - setting those
    // did nothing and left the ceiling Babylon's default white
    let ceilMat = matOverrides.ceiling;
    if (!ceilMat) {
        ceilMat = new StandardMaterial("mat_ceil", scene);
        ceilMat.diffuseColor  = Color3.FromHexString("#080808");
        ceilMat.specularColor = Color3.Black();
    }

    // ── Boss dais ──────────────────────────────────────────────────────────────
    const boss      = dungeon.bossRoom;
    const elevation = boss?.elevation ?? 0;
    function isInBossRoom(gx, gz) {
        if (!boss) return false;
        return gx >= boss.gridX && gx < boss.gridX + boss.width && gz >= boss.gridY && gz < boss.gridY + boss.height;
    }
    // cells the staircase is cut into - they stay at floor level
    const stairKeys = new Set();
    if (elevation > 0 && boss.entrance) {
        const { dx, dz, cells, stairCells } = boss.entrance;
        cells.forEach(c => {
            for (let k = 1; k <= stairCells; k++) stairKeys.add(`${c.x + dx * k}_${c.y + dz * k}`);
        });
    }
    const isDais = (gx, gz) => elevation > 0 && isInBossRoom(gx, gz) && !stairKeys.has(`${gx}_${gz}`);

    // walls with any floor (or boss room) cell around them, diagonals included
    // - everything else is buried in solid rock, never seen or touched
    function nearCell(gx, gz, test) {
        for (let oz = -1; oz <= 1; oz++)
            for (let ox = -1; ox <= 1; ox++)
                if ((ox || oz) && test(gx + ox, gz + oz)) return true;
        return false;
    }
    const isFloor = (gx, gz) => grid[gz]?.[gx] !== undefined && grid[gz][gx] !== 0;

    // ── Single wall template ───────────────────────────────────────────────────
    // A wall cell is a stack of cs-sized CUBES, like the room's bricks - every
    // face shows the texture once at its real proportions. One cs x wallH x cs
    // box stretched it ~4x up the wall.
    // wrap: every side face's texture upright - by default the ±x faces show it
    // turned 90°, bricks standing on end
    const wallTemplate = MeshBuilder.CreateBox("_tpl_wall", { size: cs, wrap: true }, scene);
    wallTemplate.material = wallMat;
    wallTemplate.isVisible = false;
    // ...but still ONE physics body per wall cell: an invisible full-height box
    // (scaled per cell), rather than a body for every cube in the stack
    const wallColliderTemplate = MeshBuilder.CreateBox("_tpl_wall_collider", { width: cs, height: 1, depth: cs }, scene);
    wallColliderTemplate.isVisible = false;
    wallColliderTemplate.isPickable = false;

    // ── Floor template — GLB tile or simple box ────────────────────────────────
    // floorTemplateTop: height of the template's top face above its own
    // origin, so every tile can be placed by its top surface
    let floorTemplate, floorTemplateTop;
    if (tileTemplate) {
        const bbox  = tileTemplate.getBoundingInfo().boundingBox;
        const tileW = (bbox.maximum.x - bbox.minimum.x) || 1;
        const tileD = (bbox.maximum.z - bbox.minimum.z) || 1;
        tileTemplate.scaling   = new Vector3(cs / tileW, 5, cs / tileD);
        // loadModel's setParent(null) bakes a 180° Z flip into the tile (it
        // only came out upright because every instance reset its rotation)
        tileTemplate.rotationQuaternion = null;
        tileTemplate.isVisible = false;
        tileTemplate.isPickable = false;
        floorTemplateTop = bbox.maximum.y * tileTemplate.scaling.y;

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
        floorTemplateTop = -FLOOR_Y;
    }
    const bossFloorTemplate = floorTemplate.clone("_tpl_boss_floor");
    bossFloorTemplate.material = bossFloorMat;
    bossFloorTemplate.getChildMeshes?.().forEach(child => child.material = bossFloorMat);
    bossFloorTemplate.isVisible = false;

    // fills the dais from the dungeon floor up under its raised tiles - the
    // tiles alone leave a gap below them. Inset a hair so its sides never
    // z-fight with the tile sides above.
    const plinthTemplate = elevation > 0
        ? MeshBuilder.CreateBox("_tpl_dais_plinth", { width: cs - 0.02, height: elevation, depth: cs - 0.02 }, scene)
        : null;
    if (plinthTemplate) {
        plinthTemplate.material = bossFloorMat;
        plinthTemplate.isVisible = false;
    }

    // ── Single ceiling template ────────────────────────────────────────────────
    const ceilTemplate = MeshBuilder.CreateBox("_tpl_ceil", { width: cs, height: FLOOR_THICKNESS, depth: cs }, scene);
    ceilTemplate.material = ceilMat;
    ceilTemplate.isVisible = false;

    let wallCount = 0, floorCount = 0, ceilCount = 0, plinthCount = 0;
    // "gx_gz" -> that wall cell's column of cubes (its occlusion group) - the
    // doors join the columns they're set in (dungeonDoors.js)
    const wallColumns = new Map();

    for (let gz = 0; gz < grid.length; gz++) {
        for (let gx = 0; gx < grid[gz].length; gx++) {
            const cell   = grid[gz][gx];
            const cx     = worldX(gx, cs);
            const cz     = worldZ(gz, cs);

            if (cell === 0) {
                // Wall cell
                if (!nearCell(gx, gz, isFloor)) continue;
                // around the boss room the walls run from the dungeon floor all
                // the way up past the dais' raised ceiling - no gap under or over
                const top = elevation > 0 && nearCell(gx, gz, isInBossRoom) ? wallH + elevation : wallH;
                const h   = top + WALL_FOOT;
                const wallId = wallCount++;
                // cubes stacked DOWN from the top, so the wall ends exactly at
                // the ceiling and the leftover part of the last cube is buried
                // under the floor rather than poking up out of the dungeon
                const cubes = Math.ceil(h / cs);
                // the camera hides walls that come between it and the player
                // (tools/camera.js's occlusion) - a whole column at a time,
                // never one cube left floating over a gap
                const column = [];
                wallColumns.set(`${gx}_${gz}`, column);
                for (let i = 0; i < cubes; i++) {
                    const cube = wallTemplate.createInstance(`wall_${wallId}_${i}`);
                    cube.position.set(cx, top - cs / 2 - i * cs, cz);
                    cube.freezeWorldMatrix();
                    cube._cameraOccluder = true;
                    cube._occlusionGroup = column;
                    column.push(cube);
                }
                const collider = wallColliderTemplate.createInstance(`wall_${wallId}_collider`);
                collider.isVisible = false;
                collider.isPickable = false;
                collider.scaling.y = h;
                collider.position.set(cx, top - h / 2, cz);
                collider.freezeWorldMatrix();
                new PhysicsAggregate(collider, PhysicsShapeType.BOX, { mass: 0 }, scene);
                continue;
            }

            // Floor + ceiling cell
            const inBoss = isInBossRoom(gx, gz);
            const elev   = isDais(gx, gz) ? elevation : 0;

            // Floor instance - top surface at elev + jitter
            const fi = (inBoss ? bossFloorTemplate : floorTemplate).createInstance(`floor_${floorCount++}`);
            const tileJitter = dungeon.tileHeights?.[`${gx}_${gz}`] ?? 0;
            fi.position = new Vector3(cx, elev + tileJitter - floorTemplateTop, cz);
            fi.freezeWorldMatrix();
            // ground you can build a bonfire on (tools/position.js's isGroundMesh)
            fi._isGround = true;

            const fiAggregate = new PhysicsAggregate(fi, PhysicsShapeType.BOX, { mass: 0 }, scene);
            fiAggregate.shape.material = {
                restitution: 0,    // no bounciness
                friction: 1,     // moderate friction for better ground control
            }

            if (elev > 0) {
                const pl = plinthTemplate.createInstance(`dais_plinth_${plinthCount++}`);
                pl.position = new Vector3(cx, elevation / 2, cz);
                pl.freezeWorldMatrix();
            }

            // Ceiling instance - the whole boss room's ceiling is raised with its dais
            const ch = getCeilHeight(dungeon, gx, gz) + (inBoss ? elevation : 0);
            const ci = ceilTemplate.createInstance(`ceil_${ceilCount++}`);
            ci.position = new Vector3(cx, ch + FLOOR_THICKNESS / 2, cz);
            ci.freezeWorldMatrix();
            // hidden too while the camera is up past it, looking down
            ci._cameraOccluder = true;
        }
    }

    // ── Scene lights ───────────────────────────────────────────────────────────
    // ambient first: a mesh with the default 4-light cap (the player, other
    // characters) takes the scene's lights in creation order, so this one
    // always makes the cut
    const ambient = dungeon.lighting?.ambient;
    if (ambient) {
        const hemi = new HemisphericLight("dungeon_ambient", new Vector3(0, 1, 0), scene);
        hemi.intensity   = ambient.intensity;
        hemi.diffuse     = Color3.FromHexString(ambient.color);
        hemi.groundColor = Color3.FromHexString(ambient.color);
        hemi.specular    = Color3.Black();
    }
    // one entry per room (generator's placeLights) - only ROOM_LIGHT_POOL of
    // them are lit at a time, the ones nearest whatever the camera looks at
    const roomLights = (dungeon.lighting?.lights ?? []).filter(cfg => cfg.type === "point").map(cfg => ({
        position:  new Vector3(cfg.x * cs, cfg.y, cfg.z * cs),
        color:     Color3.FromHexString(cfg.color ?? "#ffffff"),
        intensity: cfg.intensity * ROOM_LIGHT_INTENSITY,
        range:     cfg.range * cs,
    }));
    const pool = roomLights.slice(0, ROOM_LIGHT_POOL).map((room, i) =>
        spawnLight(`room_light_${i}`, room.position.x, room.position.y, room.position.z, {}, scene));
    if (pool.length) {
        const slotRoom = pool.map(() => null);
        const showRoom = (i, room) => {
            const l = pool[i];
            l.position.copyFrom(room.position);
            l.diffuse.copyFrom(room.color);
            l.specular.copyFrom(room.color);
            l.intensity = room.intensity;
            l.range     = room.range;
            slotRoom[i] = room;
        };
        const lightNearestRooms = () => {
            const camera = scene.activeCamera;
            if (!camera) return;
            // an ArcRotateCamera's target is the player it orbits
            const focus = camera.getTarget?.() ?? camera.position;
            const nearest = roomLights
                .map(room => ({ room, d: Vector3.DistanceSquared(room.position, focus) }))
                .sort((a, b) => a.d - b.d)
                .slice(0, pool.length)
                .map(e => e.room);
            // nearest room in slot 0, next in slot 1... - meshes with the
            // default 4-light cap (the player, NPCs) take lights in creation
            // order, so after the directional and ambient they get the two
            // closest rooms. The dungeon's own materials take the whole pool,
            // so shuffling slots never changes what the walls show.
            nearest.forEach((room, i) => { if (slotRoom[i] !== room) showRoom(i, room); });
        };
        lightNearestRooms();
        let frame = 0;
        scene.onBeforeRenderObservable.add(() => {
            if (++frame % 15 === 0) lightNearestRooms();
        });
    }

    // ── Props ──────────────────────────────────────────────────────────────────
    // After the scene lights on purpose: a mesh with the default 4-light cap (the
    // player, other characters) takes the scene's lights in creation order, and
    // the ambient + room lights have to come before the torches' own lights.
    //
    // Each prop shape is ONE hidden source mesh, built the first time a prop
    // needs it; every prop of that shape is an instance of it - one draw call
    // per shape instead of one per prop. An instance always draws with its
    // source's material (setting one on the instance itself does nothing), so
    // the material lives on the template.
    // Static (mass 0): every client simulates its own copy of the dungeon, so a
    // barrel one player knocks over would stay upright for everyone else.
    const propTemplates = new Map();
    const propInstance = (shape, name, buildTemplate) => {
        let tpl = propTemplates.get(shape);
        if (!tpl) {
            tpl = buildTemplate();
            tpl.isVisible = false;
            tpl.isPickable = false;
            propTemplates.set(shape, tpl);
        }
        return tpl.createInstance(name);
    };
    const cylinderTemplate = (name, options, color, emissive) => () => {
        const tpl = MeshBuilder.CreateCylinder(name, options, scene);
        tpl.material = makePBR(`mat${name}`, { albedoColor: color, emissiveColor: emissive }, scene);
        return tpl;
    };
    // positions a prop instance (uniform scale) and freezes it - it never moves
    const settle = (inst, x, y, z, rotY = 0, scale = 1) => {
        inst.position.set(x, y, z);
        inst.rotation.y = rotY;
        inst.scaling.setAll(scale);
        inst.freezeWorldMatrix();
        return inst;
    };

    const vaseProps = [];
    const torchProps = [];
    dungeon.props?.forEach(prop => {
        const px   = worldX(prop.x, cs);
        const pz   = worldZ(prop.y, cs);
        // standing on the tile's own surface, raised slab or dais included
        const py   = (isDais(prop.x, prop.y) ? elevation : 0) + (dungeon.tileHeights?.[`${prop.x}_${prop.y}`] ?? 0);
        const sc   = prop.scale ?? 1.0;
        const rotY = Tools.ToRadians(prop.rotation ?? 0);

        switch (prop.type) {
            case "torch": {
                // the stand is a GLB, loaded in the background - spawnTorchStands below
                torchProps.push({ id: prop.id, x: px, y: py, z: pz });
                // the fireplace's own fire (placeId 10) - flame AND its
                // flickering light - on the stand's top (createFireParticles puts
                // the flame 0.25 and the light 0.6 above the position it's
                // given). A light per torch is fine: tools/lightBudget.js keeps
                // only the 5 point lights nearest the player switched on.
                const { light } = createFireParticles(new Vector3(px, py + TORCH_STAND_HEIGHT - 0.25, pz), scene,
                    { intensity: TORCH_LIGHT_INTENSITY, range: TORCH_LIGHT_RANGE });
                // range-based falloff, as the fireplace gets on its room's
                // StandardMaterials - on these PBR floors the default physical
                // (inverse-square) falloff left only a faint smudge of its glow
                light.falloffType = Light.FALLOFF_STANDARD;
                break;
            }
            case "barrel": {
                const barrel = propInstance("barrel", prop.id,
                    cylinderTemplate("_tpl_barrel", { height: 1.5, diameter: 0.8 }, "#5c3317"));
                settle(barrel, px, py + 1.5 * sc / 2, pz, rotY, sc);
                new PhysicsAggregate(barrel, PhysicsShapeType.CYLINDER, { mass: 0 }, scene);
                break;
            }
            case "chest":
                // a real, lootable chest stands here - tcp's treasuresInDungeon.ts
                // turns every generator chest into a world treasure
                break;
            case "vase":
                // a GLB, loaded in the background - spawnVases below
                vaseProps.push(prop);
                break;
            case "ancient_chest": {
                const chest = propInstance("chest", prop.id, () => {
                    const tpl = MeshBuilder.CreateBox("_tpl_chest", { width: 1.0, height: 0.8, depth: 0.6 }, scene);
                    tpl.material = makePBR("mat_chest", { albedoColor: "#8b6914" }, scene);
                    return tpl;
                });
                settle(chest, px, py + 0.8 * sc / 2, pz, rotY, sc);
                new PhysicsAggregate(chest, PhysicsShapeType.BOX, { mass: 0 }, scene);
                break;
            }
            case "crystal_cluster": {
                // three shards of one unit cone, each scaled to its own size
                [
                    { h: 1.8*sc, d: 0.28*sc, ox: 0,        oz: 0,        rz: 0   },
                    { h: 1.2*sc, d: 0.18*sc, ox:  0.25*sc, oz:  0.10*sc, rz: 10  },
                    { h: 1.0*sc, d: 0.15*sc, ox: -0.20*sc, oz:  0.15*sc, rz: -10 },
                ].forEach((s, i) => {
                    const shard = propInstance("crystal_shard", `${prop.id}_s${i}`,
                        cylinderTemplate("_tpl_crystal_shard", { height: 1, diameterTop: 0, diameterBottom: 1, tessellation: 6 }, "#4488ff", "#2244dd"));
                    shard.position.set(px + s.ox, py + s.h / 2, pz + s.oz);
                    shard.rotation.set(0, Tools.ToRadians((prop.rotation ?? 0) + i * 25), Tools.ToRadians(s.rz));
                    shard.scaling.set(s.d, s.h, s.d);
                    shard.freezeWorldMatrix();
                });
                break;
            }
            case "crystal_pillar": {
                const ph = 3.5 * sc;
                const body = propInstance("crystal_pillar", `${prop.id}_body`,
                    cylinderTemplate("_tpl_crystal_pillar", { height: 3.5, diameterTop: 0.12, diameterBottom: 0.38, tessellation: 7 }, "#44aaff", "#1166dd"));
                settle(body, px, py + ph / 2, pz, rotY, sc);
                new PhysicsAggregate(body, PhysicsShapeType.CYLINDER, { mass: 0 }, scene);
                const tip = propInstance("crystal_tip", `${prop.id}_tip`, () => {
                    const tpl = MeshBuilder.CreateSphere("_tpl_crystal_tip", { diameter: 0.45 }, scene);
                    tpl.material = body.material;
                    return tpl;
                });
                settle(tip, px, py + ph + 0.2 * sc, pz, 0, sc);
                break;
            }
            case "stalagmite": {
                const stalagmite = propInstance("stalagmite", prop.id,
                    cylinderTemplate("_tpl_stalagmite", { height: 1.6, diameterTop: 0.04, diameterBottom: 0.3, tessellation: 6 }, "#222228"));
                settle(stalagmite, px, py + 1.6 * sc / 2, pz, rotY, sc);
                new PhysicsAggregate(stalagmite, PhysicsShapeType.CYLINDER, { mass: 0 }, scene);
                break;
            }
            default:
                console.warn(`[generateDungeon] Unknown prop type: "${prop.type}"`);
        }
    });

    // ── Rocks ──────────────────────────────────────────────────────────────────
    if (rockTemplate && dungeon.rocks?.length) {
        rockTemplate.isVisible = false;

        dungeon.rocks.forEach(rock => {
            const inst = rockTemplate.createInstance(rock.id);
            const wx   = rock.gridX * cs + cs / 2;
            const wz   = rock.gridZ * cs + cs / 2;

            // sitting on the tile's surface, dais included
            const elev = (isDais(rock.gridX, rock.gridZ) ? elevation : 0)
                       + (dungeon.tileHeights?.[`${rock.gridX}_${rock.gridZ}`] ?? 0);

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
            inst.freezeWorldMatrix();

            // the rock's own scaled, rotated bounds - a sphere sized off the
            // average X/Z scale stood far above flat slab rocks (up to ~4 units
            // of invisible dome) and could shove a player off the spawn
            new PhysicsAggregate(inst, PhysicsShapeType.BOX, { mass: 0 }, scene);
        });
    }

    const stairMats = {
        step: makePBR("mat_stair_step", { albedoColor: "#3a3030" }, scene),
        rim:  makePBR("mat_stair_rim",  { albedoColor: "#6a4020", emissiveColor: "#3a1800" }, scene),
        gate: makePBR("mat_boss_gate",  { albedoColor: "#1a0505", emissiveColor: "#cc2200" }, scene),
    };
    buildBossStairs(scene, dungeon, cs, wallH, { ...stairMats, wall: wallMat });

    // A material only takes its first maxSimultaneousLights (default 4) of the
    // scene's ENABLED lights, and every wall/floor/ceiling is an instance of one
    // template sharing one material - raised to cover the ambient plus the
    // point lights tools/lightBudget.js leaves on, never past MAX_MATERIAL_LIGHTS.
    const lightCount = Math.min(scene.lights.length, MAX_MATERIAL_LIGHTS);

    // ── River, grass, display vases (the generator's placeNature) ─────────────
    const floorAt = (gx, gz) => (isDais(gx, gz) ? elevation : 0) + (dungeon.tileHeights?.[`${gx}_${gz}`] ?? 0);
    const natureMats = [
        ...buildRivers(scene, dungeon.rivers, cs),
        ...buildGrass(scene, dungeon.grass, cs, floorAt, dungeon.meta?.seed),
    ];
    spawnVases(scene, vaseProps, cs, floorAt, lightCount);
    spawnTorchStands(scene, torchProps, lightCount);
    // the entrance and the boss hall's exit - their walk-up triggers are the
    // dungeon's roomPaths (areascene.js)
    spawnDungeonDoors(scene, dungeon.doors, { maxLights: lightCount, wallColumnAt: (gx, gz) => wallColumns.get(`${gx}_${gz}`) });

    const propMats = [...propTemplates.values()].map(tpl => tpl.material);
    [wallMat, floorMat, bossFloorMat, ceilMat, ...propMats, ...Object.values(stairMats), ...natureMats]
        .forEach(m => { m.maxSimultaneousLights = Math.max(m.maxSimultaneousLights ?? 4, lightCount); });

    return { floorTopY: 0 };
}
