 /**
 * createArea.js
 *
 * Builds a single enclosed room in a Babylon.js scene from the data
 * produced by generateArea(). Floor is a grid of individual tile boxes
 * with micro-jitter Y offsets, matching the dungeon tile system.
 *
 * Usage:
 *   import { createArea } from './createArea';
 *   createArea(scene, generateArea({ name: "The Antechamber", ... }));
 */

import {
    Vector3,
    MeshBuilder,
    PhysicsAggregate,
    PhysicsShapeType,
    StandardMaterial,
    Color3,
} from '@babylonjs/core';

// ─── Constants ────────────────────────────────────────────────────────────────
const FLOOR_THICKNESS = 0.3;
const WALL_THICKNESS  = 0.3;
const CEIL_THICKNESS  = 0.3;

// ─── Material helper ──────────────────────────────────────────────────────────
function makeColorMat(id, cfg, scene) {
    const mat = new StandardMaterial(id, scene);
    mat.diffuseColor  = Color3.FromHexString(cfg?.albedoColor ?? '#222222');
    mat.specularColor = new Color3(
        cfg?.metallic ?? 0,
        cfg?.metallic ?? 0,
        cfg?.metallic ?? 0,
    );
    mat.specularPower = Math.round((1 - (cfg?.roughness ?? 0.9)) * 128);
    return mat;
}

// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * @param {BABYLON.Scene} scene
 * @param {ReturnType<import('./generateArea').generateArea>} area
 * @param {BABYLON.Mesh|null} tileTemplate  Optional GLB mesh used as floor tile template
 */
export function createArea(scene, area, tileTemplate = null) {
    const { layout, walls: wallData, ceiling: ceilData, floor: floorPBR, tileHeights } = area;
    const { width, height, cellSize, cols, rows } = layout;

    const wallHeight = wallData.height;
    const halfW      = width  / 2;
    const halfD      = height / 2;
    const halfWt     = WALL_THICKNESS  / 2;
    const halfFt     = FLOOR_THICKNESS / 2;
    const halfCt     = CEIL_THICKNESS  / 2;

    // ── Materials ─────────────────────────────────────────────────────────────
    const floorMat = makeColorMat(`${area.meta.name}_mat_floor`,   floorPBR,        scene);
    const wallMat  = makeColorMat(`${area.meta.name}_mat_walls`,   wallData.pbr,    scene);
    const ceilMat  = makeColorMat(`${area.meta.name}_mat_ceiling`, ceilData.pbr,    scene);

    // ── Floor tile template ───────────────────────────────────────────────────
    // If a GLB tile mesh is provided use it (same as createDungeon),
    // otherwise fall back to a plain box.
    let floorTemplate;
    if (tileTemplate) {
        const bbox  = tileTemplate.getBoundingInfo().boundingBox;
        const tileW = (bbox.maximum.x - bbox.minimum.x) || 1;
        const tileD = (bbox.maximum.z - bbox.minimum.z) || 1;
        tileTemplate.scaling    = new Vector3(cellSize / tileW, 5, cellSize / tileD);
        tileTemplate.isVisible  = false;
        tileTemplate.isPickable = false;
        tileTemplate.material   = floorMat;
        tileTemplate.getChildMeshes?.().forEach(c => {
            c.material  = floorMat;
            c.isPickable = false;
        });
        floorTemplate = tileTemplate;
    } else {
        floorTemplate = MeshBuilder.CreateBox(`${area.meta.name}_tpl_floor`, {
            width:  cellSize,
            height: FLOOR_THICKNESS,
            depth:  cellSize,
        }, scene);
        floorTemplate.material  = floorMat;
        floorTemplate.isVisible = false;
    }

    // ── Tile grid ─────────────────────────────────────────────────────────────
    // The room is centred on the world origin.
    // Tile (0,0) starts at the top-left corner (-halfW, -halfD).
    const originX = -halfW + cellSize / 2;
    const originZ = -halfD + cellSize / 2;

    let tileCount = 0;

    for (let tz = 0; tz < rows; tz++) {
        for (let tx = 0; tx < cols; tx++) {
            const wx     = originX + tx * cellSize;
            const wz     = originZ + tz * cellSize;
            const jitter = tileHeights?.[`${tx}_${tz}`] ?? 0;

            const inst = floorTemplate.createInstance(`${area.meta.name}_floor_${tileCount++}`);

            if (tileTemplate) {
                const bbox  = tileTemplate.getBoundingInfo().boundingBox;
                const halfH = ((bbox.maximum.y - bbox.minimum.y) / 2) || 0.05;
                inst.position = new Vector3(wx, -halfH + jitter, wz);
            } else {
                inst.position = new Vector3(wx, -halfFt + jitter, wz);
            }

            const agg = new PhysicsAggregate(inst, PhysicsShapeType.BOX, { mass: 0 }, scene);
            agg.shape.material = { restitution: 0, friction: 1 };
        }
    }

    // ── Ceiling ───────────────────────────────────────────────────────────────
    const ceiling = MeshBuilder.CreateBox(`${area.meta.name}_ceiling`, {
        width:  width,
        height: CEIL_THICKNESS,
        depth:  height,
    }, scene);
    ceiling.position = new Vector3(0, wallHeight + halfCt, 0);
    ceiling.material = ceilMat;

    // ── Four walls ────────────────────────────────────────────────────────────
    //   north / south span the full width along X
    //   east  / west  span the full depth along Z
    const halfH = wallHeight / 2;

    const wallDefs = [
        {
            id:   `${area.meta.name}_wall_north`,
            size: { width,            height: wallHeight, depth: WALL_THICKNESS },
            pos:  new Vector3(0,       halfH, halfD  + halfWt),
        },
        {
            id:   `${area.meta.name}_wall_south`,
            size: { width,            height: wallHeight, depth: WALL_THICKNESS },
            pos:  new Vector3(0,       halfH, -(halfD + halfWt)),
        },
        {
            id:   `${area.meta.name}_wall_east`,
            size: { width: WALL_THICKNESS, height: wallHeight, depth: height },
            pos:  new Vector3( halfW + halfWt, halfH, 0),
        },
        {
            id:   `${area.meta.name}_wall_west`,
            size: { width: WALL_THICKNESS, height: wallHeight, depth: height },
            pos:  new Vector3(-(halfW + halfWt), halfH, 0),
        },
    ];

    wallDefs.forEach(({ id, size, pos }) => {
        const wall = MeshBuilder.CreateBox(id, size, scene);
        wall.position = pos;
        wall.material = wallMat;
        new PhysicsAggregate(wall, PhysicsShapeType.BOX, { mass: 0 }, scene);
    });
}