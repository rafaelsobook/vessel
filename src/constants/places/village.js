// The village (placeId 1) - the guild hall, tavern and the dungeon door's cave are in it.
import { DUNGEON_12 } from './dungeons.js';
import { generateArea } from '../../generate-datas/genareamd.js';
import { randNum } from '../../tools/random.js';
import { getSpawnPos } from '../../tools/position.js';
import { createCaveEntrance } from '../../assetcreation/createCaveEntrance.js';

export const VILLAGE = {
    originalGlbs: [
        {
            pos: {x: -12, y: 0, z: -24}, 
            rot: Math.PI,
            textures: [
                {name: "clothroof", tex:"wall3", normal: "fabricnormal", uScale: 10.5, lighten: 1.5},
                {name: "lightwood", tex:"wood3", normal: "wood3normal", uScale: 10, lighten: 1},
                {name: "redwood", tex:"wood2", uScale: 2, lighten: 1.5},
                {name: "vase", tex:"wall1", normal: "wall1normal", uScale: 3, lighten: .5},
                {name: "wheel", tex:"iron2", uScale: 2, lighten: .5},
                {name: "wood", tex:"wood1", normal: "wood1normal", uScale: 5, lighten: 1.15},
                {name: "books", tex:"decor1", uScale: 2, lighten: 1.15},
                {name: "grass", tex:"fabric2", uScale: 2, lighten: 1.15},
                {name: "lemon", tex:"fabric4amb", uScale: 2, lighten: 1.15},
                {name: "carrot", tex:"floor2", uScale: .1, lighten: 1.15},
                {name: "potatoe", tex:"potatoe", uScale: 1, lighten: 2},
            ], 
            glbPath:"./models/outdors/smallmarket.glb"
        },
        {
            pos: {x: 28, y: 0, z: -43},
            rot: Math.PI/2,
            textures: [
                {name: "roof", tex:"iron2", uScale: 3, lighten: 1.5},
                {name: "housebody", tex:"sement2", uScale: 3, lighten: 1.5}
            ],
            glbPath: "./models/outdors/weaponHouse.glb"
        },
        {
            pos: {x: 29, y: 0, z: -42},
            rot: Math.PI,
            textures: [
                {name: "iron", tex:"rockTex", uScale: 3, lighten: 1.5},
                {name: "fabric", tex:"fabric1", uScale: 3, lighten: 1.5},
                {name: "metalforge", tex:"iron2", uScale: 3, lighten: 1.5},
                {name: "fire", tex:"iron1", emissive: {r:1, g:0,b:0}, uScale: 3, lighten: 1.5},
            ],
            glbPath: "./models/outdors/forge.glb"
        }
    ],
    optionalObjects: [
        {
            itemId: randNum(0,9999).toString(),
            name: "Guild House",
            position: {x: -8, y: 0, z: -12},
            scale: null,
            rotation:-Math.PI/2,
            glbPath: "./models/houses/guild1.glb",
            diffuseTexPath:null,
            bumpTexPath: "./images/textures/houses/guild1.jpg",
            physics: {
                opt: {mass: 0},
                type: "box"
            },
            functionBeforeMerge: null
        },
        {
            itemId: randNum(0,9999).toString(),
            name: "wagon",
            position: {x: 12, y: 0, z: -1.6},
            scale: null,
            rotation:Math.PI/2 + 0.5,
            // glbPath: "./models/outdors/wagon.glb",
            diffuseTexPath:null,
            // bumpTexPath: "./images/textures/houses/guild1.jpg",
            physics: {
                opt: {mass: 0},
                type: "box"
            },
            functionBeforeMerge: null
        },
        // Tavern - placed well clear of every other village prop (the
        // nearest neighbor, bigHouse at {43.8,13.5}, is ~40 units away -
        // confirmed by actually running generateArea() with this exact
        // village's own seed/counts and diffing against every hand-placed
        // item above, not just eyeballed). rotation Math.PI/2 turns its
        // door (confirmed at local {x:0,z:2.67} - the model's own +Z face,
        // dead-center on X - by loading tavern.glb in isolation and
        // reading its real bounding box) to face -X, back toward the
        // village center the same way Guild House's own rotation faces
        // its door back toward the wagon/spawn cluster.
        {
            itemId: randNum(0,9999).toString(),
            name: "Tavern",
            position: {x: 75, y: 0, z: 10},
            scale: null,
            rotation: -Math.PI/2,
            glbPath: "./models/houses/tavern.glb",
            diffuseTexPath:null,
            bumpTexPath: null,
            physics: {
                opt: {mass: 0},
                type: "box"
            },
            functionBeforeMerge: null
        },
        // the door to the dungeon (placeId 12) - the rooms' own generic
        // door.glb, set into a rocky cave mouth (createCaveEntrance.js)
        // that runs back into a small hill behind it. Open ground beside
        // the south path, ~7.5 from spawn: checked against this village's
        // generateArea() output and every hand-placed prop/npc (nearest:
        // light pole {12.7,-19} ~7.6 away, Doran ~11.5) - the cave stays
        // within ~7 of the door, on its far side from the path.
        // door.glb is thin along Z, so rotation PI/2 turns it to face -X,
        // back toward the path, where its roomPaths trigger sits
        {
            itemId: randNum(0,9999).toString(),
            name: "dungeondoor",
            position: {x: 7, y: 0, z: -14},
            scale: null,
            rotation: Math.PI/2,
            glbPath: "./models/indors/door.glb",
            diffuseTexPath: null,
            bumpTexPath: null,
            physics: {
                opt: {mass: 0},
                type: "box"
            },
            functionBeforeMerge: null,
            cbAfterMade: (scene, door) => createCaveEntrance(scene, door.position, door.rotation.y),
        },
    ],
    roomPaths: [
        {
            placeId: 9,
            name: "Guild Room",
            areaType: "room",
            pos: {x: -2.75, y: 0.5, z: -12.02},
            startingPos: {x: 0.12, y: 1, z: -4.4}
        },
        // door trigger position = tavern position + rotated local door
        // offset (0, 3.17) [2.67 real wall face + 0.5 clearance], using
        // this same file's own rotation->world-offset relationship
        // (worldX = -D*sin(rot), worldZ = D*cos(rot)) reverse-engineered
        // from the Guild House entry above (rotation -PI/2, door offset
        // {5.25,~0} => D=5.25) and confirmed against it algebraically
        // before reusing it here
        {
            placeId: 18,
            name: "Tavern",
            areaType: "room",
            pos: {x: 71.83, y: 0.5, z: 10},
            startingPos: {x: 0, y: 1, z: -4}
        },
        // in front of the "dungeondoor" above ({x:7,z:-14}, facing -X) -
        // 1.2 out from it, so the door's own physics box keeps you from
        // reaching this trigger from behind
        {
            placeId: 12,
            name: "Dungeon",
            areaType: "dungeon",
            pos: {x: 5.8, y: 0.5, z: -14},
            startingPos: getSpawnPos(DUNGEON_12)
        }
    ],
    // creations/creategraveyard.js - areaSize is the plot's full side
    // length, entrance defaults to "south". x:55 rather than 50: this
    // seed's generated bigHouse at (43.8, 13.5) reaches x ~48, which put
    // it ~3 units inside a plot centered on x:50
    graveYards: [
        {
            position: {x: 55, y: 0, z: 10},
            areaSize: 10,
            entrance: "south",
        }
    ],
    // the village's ore comes from tcp now (tcp/recources/ores.ts - one plain
    // vein of stone and bronze at (-16, 108), with hit points)
    resources: [],

    ...generateArea({
    placeId: 1,
    areaType: "village",
    width:      300,
    height:     300,
    seed: 12365,
    totalBigHouse: 4,
    totalSmallHouse : 3,
    totalMediumHouse: 0,
    totalBigTrees: 5,
    totalMediumTrees: 10,
    totalSmallTrees: 100,
    totalRocks: 500,
    totalGrass: 1000,
    totalBushes: 1000,
    
    // entry: "south",
    // the palisade side its gate gap and gate are on (genareamd.js) - not a
    // way out; doors to other places are roomPaths
    exit: "east",
    sceneTemp: {
        fogDensity: 0.008,
        fogColor:{ r:0.05, g:0.15, b:0.1},

        lights: [
            {name:"directional", intensity: 0.9},
            {name:"hemispheric", intensity: 1},
        ],
    },
    isMultiplayer: true
    }),
    spawn: {x: 0.6, y: 1, z: -10},
}
