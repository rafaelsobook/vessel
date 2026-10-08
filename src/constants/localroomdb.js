// roomdb.js
// Every place's details. The openworld's are written out here; every other
// place has its own file in ./places/ - the village, the dungeons, the guild
// hall and its rooms, the witches' towers, the duel arenas, the tavern.
// metaDatas is the one list everything else reads (states/placestates.js's
// findPlaceMetaData), by placeId.
import { generateArea } from '../generate-datas/genareamd.js';
import { randNum } from '../tools/random.js';
import { OPENWORLD_GRAVEYARDS } from './graveyards.js';
import { getSpawnPos } from '../tools/position.js';
import { DUNGEON_12 } from './places/dungeons.js';
import { VILLAGE } from './places/village.js';
import { STARTING_ROOM, GUILD_HALL, GUILDMASTER_OFFICE } from './places/guildHall.js';
import { WITCH_HOUSE, ILVARA_TOWER, SABLE_TOWER } from './places/witchTowers.js';
import { DUELING_GROUNDS, COLOUSA_DUELING_GROUNDS, VESPER_DUELING_GROUNDS } from './places/duelingGrounds.js';
import { TAVERN } from './places/tavern.js';

export const metaDatas = [
    DUNGEON_12,
    VILLAGE,
    STARTING_ROOM,
    WITCH_HOUSE,
    ILVARA_TOWER,
    SABLE_TOWER,
    GUILD_HALL,
    GUILDMASTER_OFFICE,
    DUELING_GROUNDS,
    COLOUSA_DUELING_GROUNDS,
    VESPER_DUELING_GROUNDS,
    // openworld
    {
        // 13 plots across the openworld, streamed in around the player - the
        // list (and why each site was picked) lives in constants/graveyards.js
        graveYards: OPENWORLD_GRAVEYARDS,
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
                pos: {x: -1.5, y: 3, z: 510},
                startingPos: getSpawnPos(DUNGEON_12)
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
        // the palisade side its gate gap and gate are on (genareamd.js) - not a
        // way out; doors to other places are roomPaths
        exit: "east",
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
    TAVERN,
]
