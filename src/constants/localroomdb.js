// roomdb.js
import { ActionManager, MeshBuilder, Vector3 } from '@babylonjs/core';
import { getCharState, setCanPress, setCharState, setCharStateMode, setQuestCompleted } from '../charactersystem/characterstate.js';
import { onIntersecEnterTrig, onIntersecExitTrig } from '../components/actionManager.js';
import { generateArea } from '../generate-datas/genareamd.js';
import { generateBSPDungeon } from '../generate-datas/generatebsp.js';
import { getSceneDet } from '../main/main.js';
import { getIsSocketOn, getPlayersOnScene } from '../sockets/worldsocket.js';
import { randNum } from '../tools/random.js';
import { openCloseInteractBtn } from '../tools/popupUI.js';
import { playAnim } from '../tools/animation.js';
import { disableEnableAttackButtonsContainer } from '../charactersystem/uimanagement.js';
import { faceForward, getControllerObjects } from '../controllers/inputMovement.js';
import { createMagicCircle } from '../creations/magiccircles.js';
import { getAllSounds } from '../components/soundSystem.js';
import { getSocket } from '../sockets/joinsocket.js';
import { emitSpawnCircle } from '../sockets/emits.js';
import { randomNum } from '../tools/tools.js';
import { sampleTerrainSurfaceHeight } from 'infterrain';
import { OPENWORLD_TERRAIN_VERTS } from './constants.js';

export const metaDatas = [

    generateBSPDungeon({
        placeId: 12,
        areaType: "dungeon",
        seed: 12345,
        rockDensity: 0,
        gridWidth: 32,
        gridHeight: 32,
        cellSize: 4,
        wallHeight: 15,
        corridorWidth: 3,
        difficulty: 1,
        textures: { wallTexName: "wall1", floorTexName: "floor1", ceilingTexName: "ceil1" },
        // ↑ shorthand — applies rock2.jpg to wall, floor AND ceiling

        //new
        sceneTemp: {
            fogDensity: 0.008,
            fogColor:{ r:0.05, g:0.15, b:0.1},

            lights: [
                {name:"directional", intensity: 0.9},
                // {name:"hemispheric", intensity: 0.1},
            ],
        },
        isMultiplayer: true
    }),
    {   
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
        ],
        roomPaths: [
            {
                placeId: 9,
                name: "Guild Room",
                areaType: "room",
                pos: {x: -2.75, y: 0.5, z: -12.02},
                startingPos: {x: 0.12, y: 1, z: -4.4}
            }
        ],
        resources: [
            {
                resourceId: randNum(0,9999).toString(),
                resourceType: "ore", // procedurally generated, see createOre() in createRock.js
                name: "ore",
                position: {x: -16, y: 0, z: 108},
                scale: null,
                rotation: 0,
                loots: [
                    {name: "stone", chance: 0.2},
                    {name: "solarore", chance: 0.045},
                    {name: "bronzeore", chance: 0.1},
                ],
                physics: {
                    opt: {mass: 0},
                    type: "box"
                }
            },
            {
                resourceId: randNum(0,9999).toString(),
                resourceType: "ore", // procedurally generated, see createOre() in createRock.js
                name: "ore",
                position: {x: 30, y: 0, z: -100},
                scale: null,
                rotation: 0,
                loots: [
                    {name: "stone", chance: 0.2},
                    {name: "solarore", chance: 0.045},
                    {name: "bronzeore", chance: 0.1},
                ],
                physics: {
                    opt: {mass: 0},
                    type: "box"
                }
            },
        ],

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
        totalGrass: 10000,
        totalBushes: 5000,
        // entry: "south",
        exit: "east",
        entryExitPlaceIds: {
            // entryPlaceDetail: {
            //     placeId: 1,
            //     name: "village",
            //     areaType: "village",
            // },
            exitPlaceDetail: {
                placeId: 2,
                name: "village",
                areaType: "village",
            }
        },
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
    },
    {
        placeId: 10,
        name: 'Simple Room',
        width: 7, // ground width
        height: 10, // ground height
        areaType: "room",
        layout: { cellSize: 1 },
        spawn: {x: 0, y: 1, z: -2, rotation: 0},
        
        optionalObjects: [
            {
                itemId: randNum(0,9999).toString(),
                name: "roomdoor",
                position: {x: 0, y: 0, z: -5.5},
                scale: null,
                rotation: 0,
                glbPath: "./models/indors/door.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
            {
                itemId: randNum(0,9999).toString(),
                name: "bed",
                position: {x: 1, y: 0, z: 2},
                scale: null,
                rotation: 0,
                glbPath: "./models/beds/bed1.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
            {
                itemId: randNum(1000,9999).toString(),
                name: "table",
                position: {x: -2.5, y: 0, z: 2},
                scale: null,
                rotation: Math.PI / 2,
                glbPath: "./models/indors/table1.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge:(container) => { 
                    container.meshes[0].getChildren()[0].dispose() 

                    return container.meshes[0].getChildren()[0]
                } // this table has a transform node we don't need, so dispose it before merging
            },
            {
                itemId: randNum(1000,9999).toString(),
                name: "book",
                position: {x: 2.2, y: 0.9, z: 2},
                scale: null,
                rotation: Math.PI / 2,
                glbPath: "./models/indors/book1.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null // this table has a transform node we don't need, so dispose it before merging
            },
            {
                itemId: randNum(1000,9999).toString(),
                name: "fireplace",
                position: {x: -2.5, y: 0, z: 4},
                scale: null,
                rotation: Math.PI + 1,
                glbPath: "./models/indors/fireplace.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null, // this table has a transform node we don't need, so dispose it before merging
                cbAfterMade: (scene) => {
                    
                    getAllSounds().bonfireS?.play()
                }
            },
            {
                itemId: randNum(1000,9999).toString(),
                name: "particle_fire",
                position: {x: -2.5, y: 0, z: 4},
                scale: null,
                rotation:0,
                glbPath: null,
                physics: null,
                functionBeforeMerge: null, // this table has a transform node we don't need, so dispose it before merging

            }
        ],
        exit: "south",
        exitPlaceDetail: {
            placeId: 9,
            name: "guild house",
            areaType: "room",
        },
        entryExitPlaceId: {
            exit: {
                placeId: 9,
                name: "guild house",
                areaType: "room",
            }
        },
        sceneTemp: {
            fogDensity: 0.1,
            fogColor:{ r:0.05, g:0.15, b:0.1},

            lights: [
                {name:"directional", intensity: 0.9},
                // {name:"hemispheric", intensity: 0.1},
            ],
        },
        isMultiplayer: false
    },
    {
        // Witch House interior - entered via placeId 888's own roomPaths
        // entry (walking up to the "Witch House" building at {x:20,z:10} in
        // the wilderness), same procedural boxed-room shape as "Simple
        // Room"/"Guild House" above (createroom.js), not a custom modeled
        // interior. Houses Colousa's own "friend" ("114_colousa"'s
        // post-duel speech: "she's capable of different types of magic! and
        // she can help you enhance your skills") - see npcDetails.js's
        // "117_vesper".
        placeId: 15,
        name: 'Witch House',
        width: 9, // ground width
        height: 12, // ground height
        areaType: "room",
        // Vesper's own floor - a round disc inscribed in the room's usual
        // rectangular wall footprint instead of the flat plane every other
        // "room" areaType place gets (createroom.js's own roomShape option -
        // walls are unaffected, still the same straight box-wall shape)
        roomShape: "cylinder",
        layout: { cellSize: 1 },
        // just inside the south door (same door-adjacent spawn convention
        // "Simple Room"'s own spawn:{x:0,y:1,z:-2} uses)
        spawn: {x: 0, y: 1, z: -4, rotation: 0},
        roomPaths: [
            {
                placeId: 888,
                name: "openworld",
                areaType: "openworld",
                pos: {x: 0, y: 1, z: -5},
                startingPos: {x: -1890, y:7.5, z: 560},
            },
        ],
        optionalObjects: [
            // {
            //     itemId: randNum(0,9999).toString(),
            //     name: "roomdoor",
            //     position: {x: 0, y: 0, z: -5.5},
            //     scale: null,
            //     rotation: 0,
            //     glbPath: "./models/indors/door.glb",
            //     physics: {
            //         opt: {mass: 0},
            //         type: "box"
            //     },
            //     functionBeforeMerge: null
            // },
            // {
            //     itemId: randNum(1000,9999).toString(),
            //     name: "table",
            //     position: {x: 3, y: 0, z: 3},
            //     scale: null,
            //     rotation: Math.PI / 2,
            //     glbPath: "./models/indors/table1.glb",
            //     physics: {
            //         opt: {mass: 0},
            //         type: "box"
            //     },
            //     // this table has a transform node we don't need, so dispose
            //     // it before merging - same fix "Simple Room"'s own table
            //     // entry above already needed for this exact glb
            //     functionBeforeMerge:(container) => {
            //         container.meshes[0].getChildren()[0].dispose()

            //         return container.meshes[0].getChildren()[0]
            //     }
            // },
            // {
            //     itemId: randNum(1000,9999).toString(),
            //     name: "spellbook",
            //     position: {x: 3.7, y: 0.9, z: 3},
            //     scale: null,
            //     rotation: Math.PI / 2,
            //     glbPath: "./models/indors/book1.glb",
            //     physics: {
            //         opt: {mass: 0},
            //         type: "box"
            //     },
            //     functionBeforeMerge: null
            // },
            // {
            //     itemId: randNum(1000,9999).toString(),
            //     name: "scroll",
            //     position: {x: 2.4, y: 0.9, z: 3},
            //     scale: null,
            //     rotation: 0,
            //     glbPath: "./models/indors/scroll.glb",
            //     physics: {
            //         opt: {mass: 0},
            //         type: "box"
            //     },
            //     functionBeforeMerge: null
            // },
            // {
            //     itemId: randNum(1000,9999).toString(),
            //     name: "shelves",
            //     position: {x: -3.7, y: 0, z: -3},
            //     scale: null,
            //     rotation: Math.PI / 2,
            //     glbPath: "./models/indors/shelves.glb",
            //     physics: {
            //         opt: {mass: 0},
            //         type: "box"
            //     },
            //     functionBeforeMerge: null
            // },
            // {
            //     // a witch's own magic crystal, standing centerpiece -
            //     // testcrystal.glb (indoor asset), not a resource-node
            //     // "crystal" (staticRecources/resourceLoot.js's own mined
            //     // material of the same generic word - unrelated glb/system)
            //     itemId: randNum(1000,9999).toString(),
            //     name: "witch_crystal",
            //     position: {x: 0, y: 0, z: 0.5},
            //     scale: null,
            //     rotation: 0,
            //     glbPath: "./models/indors/testcrystal.glb",
            //     physics: {
            //         opt: {mass: 0},
            //         type: "box"
            //     },
            //     functionBeforeMerge: null
            // },
            // {
            //     itemId: randNum(1000,9999).toString(),
            //     name: "fireplace",
            //     position: {x: -3, y: 0, z: 4},
            //     scale: null,
            //     rotation: Math.PI + 1,
            //     glbPath: "./models/indors/fireplace.glb",
            //     physics: {
            //         opt: {mass: 0},
            //         type: "box"
            //     },
            //     functionBeforeMerge: null,
            //     cbAfterMade: (scene) => {
            //         getAllSounds().bonfireS?.play()
            //     }
            // },
            // {
            //     itemId: randNum(1000,9999).toString(),
            //     name: "particle_fire",
            //     position: {x: -3, y: 0, z: 4},
            //     scale: null,
            //     rotation: 0,
            //     glbPath: null,
            //     physics: null,
            //     functionBeforeMerge: null
            // },
            // {
            //     itemId: randNum(1000,9999).toString(),
            //     name: "wallTorch1",
            //     position: {x: -4.3, y: 1.6, z: -4},
            //     scale: null,
            //     rotation: Math.PI / 2,
            //     glbPath: "./models/indors/wallTorch.glb",
            //     physics: null,
            //     functionBeforeMerge: null
            // },
            // {
            //     itemId: randNum(1000,9999).toString(),
            //     name: "wallTorch2",
            //     position: {x: 4.3, y: 1.6, z: -4},
            //     scale: null,
            //     rotation: -Math.PI / 2,
            //     glbPath: "./models/indors/wallTorch.glb",
            //     physics: null,
            //     functionBeforeMerge: null
            // },
        ],
        sceneTemp: {
            // a shade purpler than "Simple Room"'s own green-tinted fog -
            // reads as a mystical hut rather than a plain lived-in room
            fogDensity: 0.1,
            fogColor:{ r:0.12, g:0.05, b:0.16},

            lights: [
                {name:"directional", intensity: 0.9},
            ],
        },
        isMultiplayer: false
    },
    {
        // Ilvara's Tower interior - entered via placeId 888's own roomPaths
        // entry ({x:1200,z:800} in the openworld), same round-room shape as
        // Vesper's own Witch House (placeId 15) above, just a different
        // witch living in it - see npcDetails.js's "118_ilvara".
        placeId: 16,
        name: "Ilvara's Tower",
        width: 8,
        height: 10,
        areaType: "room",
        roomShape: "cylinder",
        layout: { cellSize: 1 },
        spawn: {x: 0, y: 1, z: -4, rotation: 0},
        roomPaths: [
            {
                placeId: 888,
                name: "openworld",
                areaType: "openworld",
                pos: {x: 0, y: 1, z: -5},
                startingPos: {x: 1200, y: 7.5, z: 800},
            },
        ],
        optionalObjects: [],
        sceneTemp: {
            // warm ember-orange tint - a fire witch's own hearth-lit tower,
            // contrasting Vesper's cooler purple
            fogDensity: 0.1,
            fogColor: { r: 0.2, g: 0.08, b: 0.04 },

            lights: [
                {name:"directional", intensity: 0.9},
            ],
        },
        isMultiplayer: false
    },
    {
        // Sable's Tower interior - entered via placeId 888's own roomPaths
        // entry ({x:-600,z:-1400} in the openworld), same round-room shape
        // as Vesper's own Witch House (placeId 15) above, just a different
        // witch living in it - see npcDetails.js's "119_sable".
        placeId: 17,
        name: "Sable's Tower",
        width: 8,
        height: 10,
        areaType: "room",
        roomShape: "cylinder",
        layout: { cellSize: 1 },
        spawn: {x: 0, y: 1, z: -4, rotation: 0},
        roomPaths: [
            {
                placeId: 888,
                name: "openworld",
                areaType: "openworld",
                pos: {x: 0, y: 1, z: -5},
                startingPos: {x: -600, y: 7.5, z: -1400},
            },
        ],
        optionalObjects: [],
        sceneTemp: {
            // near-black, barely-there fog - a shadow witch's own dim tower,
            // darker than Vesper's own purple-tinted one
            fogDensity: 0.12,
            fogColor: { r: 0.03, g: 0.02, b: 0.05 },

            lights: [
                {name:"directional", intensity: 0.5},
            ],
        },
        isMultiplayer: false
    },
    {
        placeId: 9, // Guild House
        name: 'Guild House',
        width: 16, // ground width
        height: 13, // ground height
        areaType: "room",
        layout: { cellSize: 1 },
        spawn: {x: 4.4, y: 0.4, z: 2.5, rotation: 0},
        roomPaths: [ // pabalik sa room naten dapat sa taas ng hagdan to e
            {
                placeId: 10,
                name: "room",
                areaType: "room",
                pos: {x: 6, y: 0.5, z: 5.25},
                startingPos: {x: 0, y: 1, z: -2}
            },
            {
                placeId: 101,
                name: "Guildmaster's Office",
                areaType: "room",
                pos: {x: 0.9, y: 0.5, z: 5.25},
                startingPos: {x: 0, y: 1, z: -3}
            },
            // placeId 101 (Guildmaster's Office) already exists fully built
            // (desk/chair/shelves) and already has its OWN way back out
            // (exitPlaceDetail: placeId 9, createroom.js's south-wall exit
            // trigger) - but nothing here ever led INTO it, a one-way dead
            // end. Anchored on "guildgate" below (optionalObjects) - its own
            // dedicated guilddoor.glb (every other door mesh here just uses
            // the generic door.glb), sitting unused with no roomPaths entry
            // of its own, is the obvious intended front door for this exact
            // destination. startingPos is a guess (just inside 101's own
            // south wall, clear of both that room's own exit trigger and
            // its desk/chair cluster further north) - adjust in-game if it
            // doesn't land cleanly.
        ],
        optionalObjects: [
            {
                itemId: randNum(0,9999).toString(),
                name: "roomdoor",
                position: {x: 6, y: 0, z: 6.1},
                scale: null,
                rotation: 0,
                glbPath: "./models/indors/door.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
            {
                itemId: randNum(0,9999).toString(),
                name: "roomdoor",
                position: {x: 0.9, y: 0, z: 6.1},
                scale: null,
                rotation: 0,
                glbPath: "./models/indors/door.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
            {
                itemId: randNum(0,9999).toString(),
                name: "guildgate",
                position: {x: 0, y: 0, z: -7},
                scale: null,
                rotation: 0,
                glbPath: "./models/indors/guilddoor.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
            {
                itemId: randNum(0,9999).toString(),
                name: "guildtable",
                position: {x: 0, y: 0, z: 3.5},
                scale: null,
                rotation: Math.PI,
                glbPath: "./models/indors/guildDesk2.glb",
                diffuseTexPath: "./images/modeltex/wood2.jpg",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
            {
                itemId: randNum(0,9999).toString(),
                name: "guildboard",
                position: {x: -5, y: 0, z: 4.9},
                scale: null,
                rotation: -Math.PI/2 - 0.3,
                glbPath: "./models/indors/guildboard.glb",
                // diffuseTexPath: "./images/modeltex/wood2.jpg",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
            // { // I commented this out because the physics is complaining of how many the geometry is
            //     itemId: randNum(0,9999).toString(),
            //     name: "guildstair",
            //     position: {x: -6, y: 0, z: 5},
            //     scale: null,
            //     rotation: Math.PI,
            //     glbPath: "./models/indors/guildstairs.glb",
            //     // diffuseTexPath: "./images/modeltex/wood2.jpg",
            //     physics: {
            //         opt: {mass: 0},
            //         type: "mesh"
            //     },
            //     functionBeforeMerge: null
            // },
            {
                itemId: randNum(0,9999).toString(),
                name: "testcrystal",
                position: {x: 1, y: 0.9, z: 3.1},
                scale: null,
                rotation: Math.PI/2,
                glbPath: "./models/indors/testcrystal.glb",
                diffuseTexPath: null,
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null,
                cbAfterMade: (scene) => {
                    let charState = getCharState()
                    if(!charState) return
                    const player = getPlayersOnScene().find(pl => pl.owner === charState.owner)
                    if(!player) return
                    // const scene = getSceneDet().scene
                    const testCrystal = scene.getMeshByName("testcrystal")
                    if(!testCrystal) return
                    const collider = MeshBuilder.CreateBox("testcrystalcollider", {size: 2, height: 0.2}, scene)
                    collider.parent = testCrystal
                    collider.isVisible = false
                    collider.actionManager = new ActionManager(scene)
                    onIntersecEnterTrig(collider, player.body, scene, () => {
                        charState = getCharState()
                        const touchCrystalQuest = charState.quests.find(qst => qst.qName === "touchTheCrystal")
                        if(!touchCrystalQuest) return 
                        openCloseInteractBtn("normal", true, () => {
                            openCloseInteractBtn("none", false)
                            
                            player.characterAnimations.playAction(player.anims, "cast", 1, () => {
                                setCharStateMode("casting")
                            })
                            setCanPress(false)
                            disableEnableAttackButtonsContainer(false, true)
                            playAnim(player.anims, "cast", false)

                            faceForward({x: 1, y: 0.9, z: 3.1})

                            // const elementNames = charState.aptitude.map(a => `apt_${a.element}`)
                            const elementNames = ["apt_fire", "apt_water", "apt_earth", "apt_light", "apt_darkness"]

                            let timeoutnums = 1000
                            let discPosY = 2
                            charState.aptitude.forEach(apt => {
                                const capturedY = discPosY
                                setTimeout(() => {
                                    createMagicCircle({x: 1, y: capturedY, z: 3.1}, getSceneDet().scene, `apt_${apt.element}`, 2, 4000)
                                    const socket = getSocket()
                                    if(getIsSocketOn()) emitSpawnCircle({x: 1, y: capturedY, z: 3.1},apt.element)
                                }, timeoutnums)
                                timeoutnums += 2000
                                discPosY += 0.25
                            })

                            setTimeout( async () => {
                                // touchCrystalQuest.questRequirements.completed = true
                                const isQuestExist = setQuestCompleted("touchTheCrystal")
                                if(!isQuestExist) return 
                                // save to database

                                setCharStateMode("idle")
                                setCanPress(true)
                                disableEnableAttackButtonsContainer(true)
                            }, 8000)
                        });
                    })
                    onIntersecExitTrig(collider, player.body, scene, () => openCloseInteractBtn("none", false))
                }
            }
        ],
        exit: "south",
        exitPlaceDetail: {
            placeId: 1,
            name: "village",
            areaType: "village",
        },
        entryExitPlaceId: {
            exit: {
                placeId: 1,
                name: "village",
                areaType: "village",
            }
        },
        sceneTemp: {
            fogDensity: 0,
            fogColor:{ r:0.05, g:0.15, b:0.1},

            lights: [
                // {name:"directional", intensity: 0.9},
                {name:"hemispheric", intensity: 0.8},
            ],
        },
        isMultiplayer: true
    },


    {
        placeId: 101, // Guildmaster's Office
        name: "Guildmaster's Office",
        width: 20, // ground width
        height: 16, // ground height - was 10; the desk/chair/shelves cluster needs
        // more depth to breathe (see the repositioning below) than a shallow room allows
        wallTexPath: "./images/modeltex/brick2.jpg", // wallHeight left at the default 0.5 knee-wall, same as every other room
        areaType: "room",
        layout: { cellSize: 1 },
        spawn: {x: 0, y: 0.4, z: -1, rotation: Math.PI}, // was z:3, same spot as the desk - moved clear of it
        paintedPlanes: [
            {
                name: "floorcarpet",
                texturePath: "./images/modeltex/decor1.jpg",
                rotation: {x: Math.PI/2, y: Math.PI/2, z: 0},
                position: {x: 0, y: 0.016, z: -2.5},
                width: 6,
                height: 10,
            }
        ],
        woodboxes: [
            { name: "woodbox1", position: {x: -8.5, y: 0.5, z: -6} },
            { name: "woodbox2", position: {x: -8.5, y: 1.5, z: -6} }, // stacked on top of woodbox1
            { name: "woodbox3", position: {x: -7.3, y: 0.5, z: -6} },
        ],

        optionalObjects: [
            {
                itemId: randNum(0,9999).toString(),
                name: "roomdoor",
                position: {x: 0, y: 0, z: -8.5}, // south wall now at z:-8 (height:16 → halfH:8)
                scale: null,
                rotation: 0,
                glbPath: "./models/indors/door.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
            {
                itemId: randNum(0,9999).toString(),
                name: "guildmasterdesk",
                position: {x: 0, y: 0, z: 3},
                scale: null,
                rotation: Math.PI,
                glbPath: "./models/indors/guildDesk.glb",
                diffuseTexPath: "./images/modeltex/wood2.jpg",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
            {
                itemId: randNum(0,9999).toString(),
                name: "guildmasterchair",
                position: {x: 0, y: 0, z: 3.7},
                scale: null,
                rotation: 0,
                glbPath: "./models/indors/tavChair.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
            {
                itemId: randNum(0,9999).toString(),
                name: "officescroll",
                position: {x: 0.9, y: 0.9, z: 3},
                scale: null,
                rotation: Math.PI/2,
                glbPath: "./models/indors/scroll.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
            {
                itemId: randNum(0,9999).toString(),
                name: "officeshelvesleft",
                position: {x: -6, y: 0, z: 7.3},
                scale: null,
                rotation: Math.PI,
                glbPath: "./models/indors/shelves.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
            {
                itemId: randNum(0,9999).toString(),
                name: "officeshelvesright",
                position: {x: 6, y: 0, z: 7.3},
                scale: null,
                rotation: Math.PI,
                glbPath: "./models/indors/shelves.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
        ],
        exit: "south",
        exitPlaceDetail: {
            placeId: 9,
            name: "guild house",
            areaType: "room",
        },
        entryExitPlaceId: {
            exit: {
                placeId: 9,
                name: "guild house",
                areaType: "room",
            }
        },
        sceneTemp: {
            fogDensity: 0,
            fogColor:{ r:0.05, g:0.15, b:0.1},

            lights: [
                {name:"directional", intensity: 0.9},
                // {name:"hemispheric", intensity: 0.1},
            ],
        },
        isMultiplayer: false
    },
    {
        placeId: 200,
        name: "Dueling Grounds",
        areaType: "duel",
        npcEnemies: [
            {
                npcId: "112_renarden",
                // flanking left/right on the opponents' side of the arena
                // (placeId 200's own player spawn is {x:0,z:-20}) instead of
                // both stacking on duelSystem.js's single OPPONENT_SPAWN
                // default - same side-by-side pairing convention already used
                // elsewhere in this project (e.g. the guildmaster's office
                // shelves/woodboxes)
                position: {x: -6, y: 0.01, z: 20},
                assistants: [
                    {
                        npcId: "113_robin",
                        position: {x: 6, y: 0.01, z: 20}
                    }
                ]
            }
        ],
        width: 50,
        height: 50,
        wallHeight: 0.5,
        layout: { cellSize: 1 },
        spawn: {x: 0, y: 0.4, z: -20, rotation: 0},
        exitPlaceDetail: {
            placeId: 1,
            name: "village",
            areaType: "village",
        },
        sceneTemp: {
            fogDensity: 0,
            fogColor:{ r:0.05, g:0.15, b:0.1},

            lights: [
                {name:"directional", intensity: 0.9},
                {name:"hemispheric", intensity: 0.6},
            ],
        },
        swordsStrucked: [
            {
                lootPosition: {x: 0, y: 0.2, z: 1},
                itemId: randomNum(), // should be string also in client
                name: "frostbite", // is also the image name
                dn: "Frost Bite",
                itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
                itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
                weaponType: "sword",
                equipAbilities: { 
                    dmg: 20, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
                }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
                // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
                consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 10, plusSpd: 1, }, //for buffs foods potions
                equiped: false,
                soulFeed: 0,
                isEnhanceAble: true, // only for equipable items
                enhancedLevel: 0,
                slots: [],// { name, dn, equipAbilities } cores
                durability: { current: 100, max: 100},
                price: { coinType: "bronze", pieces: 10 },
                qnty: 1,
                desc: "Frost Bite, A deadly Blade. It's blade is sharp as frozen blade",
                rarity: "rare",
            
                parts: {
                    bladeRarity: "rare1",
                    guardRarity: "rare1",
                    handleRarity: "common1",
                    pommelRarity: "common1",
            
                    bladeColor: "iron",
                    guardColor: "sodalite", // bluegranite, Steel, iron, bronze (practical/common)
                    handleColor: "wood", // bone,
                    pommelColor: "firecrystal", // frostshard, stormcrystal,beastheart
                }
            }
        ],

        isMultiplayer: false
    },
    {
        // Colousa's own dueling grounds - a SEPARATE arena from placeId 200
        // above (Renarden's), not a reuse of it. duelSystem.js's startDuel
        // reads WHO to fight straight off THIS place's own static
        // npcEnemies list (placeDetail.npcEnemies) - there's no
        // per-challenger parameter threaded through the travel/teleport
        // call, so one arena can only ever hold one fixed roster. Colousa's
        // own "meet-colousa" quest (npcDetails.js, "114_colousa"'s
        // cbAfterNotCompletedSpeech) travels here specifically instead of
        // placeId 200.
        placeId: 201,
        name: "Colousa's Dueling Grounds",
        areaType: "duel",
        npcEnemies: [
            {
                npcId: "114_colousa",
                position: {x: 0, y: 0.01, z: 20}, // duelSystem.js's own OPPONENT_SPAWN default, spelled out for consistency with placeId 200's own entries
            }
        ],
        width: 50,
        height: 50,
        wallHeight: 0.5,
        layout: { cellSize: 1 },
        spawn: {x: 0, y: 0.4, z: -20, rotation: 0},
        exitPlaceDetail: {
            placeId: 1,
            name: "village",
            areaType: "village",
        },
        sceneTemp: {
            fogDensity: 0,
            fogColor:{ r:0.05, g:0.15, b:0.1},

            lights: [
                {name:"directional", intensity: 0.9},
                {name:"hemispheric", intensity: 0.6},
            ],
        },
        isMultiplayer: false
    },
    {
        // Vesper's own dueling grounds - same one-arena-one-roster
        // limitation placeId 201 (Colousa's) already documents, just for
        // her instead. exitPlaceDetail sends the player back into placeId
        // 15 (the Witch House interior, where the challenge was actually
        // issued) rather than the village - the fight started at her own
        // front door, not back in town.
        placeId: 202,
        name: "Vesper's Dueling Grounds",
        areaType: "duel",
        npcEnemies: [
            {
                npcId: "117_vesper",
                position: {x: 0, y: 0.01, z: 20},
            }
        ],
        width: 50,
        height: 50,
        wallHeight: 0.5,
        layout: { cellSize: 1 },
        spawn: {x: 0, y: 0.4, z: -20, rotation: 0},
        exitPlaceDetail: {
            placeId: 15,
            name: "Witch House",
            areaType: "room",
        },
        sceneTemp: {
            fogDensity: 0,
            fogColor:{ r:0.1, g:0.05, b:0.16},

            lights: [
                {name:"directional", intensity: 0.9},
                {name:"hemispheric", intensity: 0.6},
            ],
        },
        isMultiplayer: false
    },


    // openworld
    {
        // "Travel Wagon" removed - it was leftover from copy-pasting this area's
        // structure from another placeDetail, hardcoded at y:0 which only made
        // sense on the old flat village ground, not procedural terrain height.
        optionalObjects: [
            {
                itemId: randNum(0,9999).toString(),
                name: "wagon",
                position: {x: 0, y: 2, z: 500},
                dirTarg: {x:0, y:2, z:0},
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
            {
                itemId: randNum(0,9999).toString(),
                name: "Vesper's Tower",
                position: {x: -1893, y:7.5, z: 563},
                scale: null,
                rotation:-Math.PI/2,
                glbPath: "./models/outdors/tower.glb",
                diffuseTexPath:null,
                // bumpTexPath: "./images/textures/houses/guild1.jpg",
                physics: {
                    opt: {mass: 0},
                    type: "cylinder"
                },
                functionBeforeMerge: null
            },
            // Two more witch towers scattered elsewhere across this same
            // 300x300 openworld, same tower.glb/rotation/physics as
            // Vesper's own above - just a different witch inside each one
            // (see npcDetails.js's "118_ilvara"/"119_sable" and the matching
            // interior rooms, placeId 16/17, below). y:7.5 reused as a
            // starting guess from Vesper's own tower, NOT independently
            // sampled against the terrain at these new x/z spots - this is
            // procedurally generated ground (generateArea, seed:12365), so
            // there's no way to know the real height here without actually
            // loading the game at these coordinates. Flagging this
            // explicitly: if either tower ends up floating or sunk into the
            // ground, adjust its own y (and the matching door-trigger/
            // startingPos y values below) after checking in-game.
            {
                itemId: randNum(0,9999).toString(),
                name: "Ilvara's Tower",
                position: {x: 1200, y: 7.5, z: 800},
                scale: null,
                rotation: -Math.PI/2,
                glbPath: "./models/outdors/tower.glb",
                diffuseTexPath: null,
                physics: {
                    opt: {mass: 0},
                    type: "cylinder"
                },
                functionBeforeMerge: null
            },
            {
                itemId: randNum(0,9999).toString(),
                name: "Sable's Tower",
                position: {x: -600, y: 7.5, z: -1400},
                scale: null,
                rotation: -Math.PI/2,
                glbPath: "./models/outdors/tower.glb",
                diffuseTexPath: null,
                physics: {
                    opt: {mass: 0},
                    type: "cylinder"
                },
                functionBeforeMerge: null
            }
        ],
        roomPaths: [
            {
                placeId: 1,
                name: "Village",
                areaType: "village",
                pos: {x: 1.5, y: 3, z: 502},
                startingPos: {x: 11, y: 1.75, z: -6}
            },
            {
                placeId: 1,
                name: "Village",
                areaType: "village",
                pos: {x: -1.5, y: 3, z: 497},
                startingPos: {x: 11, y: 1.75, z: -6}
            },

            {
                placeId: 12,
                name: "Dungeon",
                areaType: "dungeon",
                pos: {x: -1.5, y: 3, z: 510}
            },
            {
                // door into the Witch House (this same optionalObjects
                // entry above, {x:20,z:10}) - same "+1 off the sampled
                // ground" trigger-height convention as that building's own
                // ground-snap, not a guessed flat number, since this spot
                // is on the same uneven openworld terrain
                placeId: 15,
                name: "Witch House",
                areaType: "room",
                pos: {x: -1888.8, y: 7.5, z: 562.9},
                startingPos: {x: 0, y: 1, z: -4}
            },
            // doors into the two new witch towers above - same +4.2/-0.1
            // offset from each tower's own base position Vesper's own door
            // trigger uses relative to HER tower (same glb, same rotation,
            // so the modeled door sits at the same relative spot every time)
            {
                placeId: 16,
                name: "Ilvara's Tower",
                areaType: "room",
                pos: {x: 1204.2, y: 7.5, z: 799.9},
                startingPos: {x: 0, y: 1, z: -4}
            },
            {
                placeId: 17,
                name: "Sable's Tower",
                areaType: "room",
                pos: {x: -595.8, y: 7.5, z: -1400.1},
                startingPos: {x: 0, y: 1, z: -4}
            },
        ],
        resources: [
            // {
            //     resourceId: randNum(0,9999).toString(),
            //     resourceType: "ore", // procedurally generated, see createOre() in createRock.js
            //     name: "ore",
            //     position: {x: 3, y: 0, z: -5},
            //     scale: null,
            //     rotation: 0,
            //     loots: [
            //         {name: "ore", chance: 0.4},
            //         {name: "crystal", chance: 0.2},
            //         {name: "adamantine", chance: 0.4},
            //     ],
            //     physics: {
            //         opt: {mass: 0},
            //         type: "box"
            //     }
            // }
        ],

        ...generateArea({
        placeId: 888,
        areaType: "openworld",
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
        totalGrass: 10000,
        totalBushes: 5000,
        // entry: "south",
        exit: "east",
        entryExitPlaceIds: {
            // entryPlaceDetail: {
            //     placeId: 1,
            //     name: "village",
            //     areaType: "village",
            // },
            exitPlaceDetail: {
                placeId: 2,
                name: "village",
                areaType: "village",
            }
        },
        sceneTemp: {
            fogDensity: 0.0055, // thicker than open-sky haze — swamp air is heavy/humid
            fogColor:{ r:0.38, g:0.45, b:0.3 }, // murky olive-green mist, same hue family as the grass instead of fighting it
            skyColor:{ r:0.15, g:0.19, b:0.15 }, // dark overcast green-gray — swamp canopy/cloud cover, not open sky

            lights: [
                {name:"directional", intensity: 0.55, color:{ r:0.75, g:0.8, b:0.55 }, direction:{x:-0.6, y:-0.5, z:-0.4}}, // pale sickly green-yellow light filtering down through canopy, steeper angle than a horizon sun
                {name:"hemispheric", intensity: 0.5, color:{ r:0.3, g:0.38, b:0.28 }}, // green ambient fill, moderate so it doesn't flatten everything
            ],
        },
        isMultiplayer: true
        }),
        spawn: {x: 0.6, y: 10, z: 500},
    },
];
