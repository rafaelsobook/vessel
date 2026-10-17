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
import { WITCH_HOUSE, ILVARA_TOWER, SABLE_TOWER, TOWER_SPOTS, TOWER_FOOTPRINT, TOWER_DOOR, towerDoor } from './places/witchTowers.js';
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
            // the three witch towers - same tower.glb/rotation/physics,
            // a different witch inside each one (npcDetails.js's
            // "117_vesper"/"118_ilvara"/"119_sable", interiors placeId
            // 15/16/17). Where they stand is witchTowers.js's TOWER_SPOTS;
            // how high is measured off the real ground as each is placed
            // (groundSnap - creations/groundBuilding.js), so y here is unused.
            ...[
                ["Vesper's Tower", TOWER_SPOTS.vesper],
                ["Ilvara's Tower", TOWER_SPOTS.ilvara],
                ["Sable's Tower",  TOWER_SPOTS.sable],
            ].map(([name, spot]) => ({
                itemId: randNum(0,9999).toString(),
                name,
                position: { x: spot.x, y: 0, z: spot.z },
                groundSnap: { footprint: TOWER_FOOTPRINT, anchor: TOWER_DOOR },
                scale: null,
                rotation: -Math.PI/2,
                glbPath: "./models/outdors/tower.glb",
                diffuseTexPath: null,
                physics: {
                    opt: {mass: 0},
                    type: "cylinder"
                },
                functionBeforeMerge: null
            })),
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
            // the three witch towers' doors - each tower's own door spot
            // (witchTowers.js's towerDoor). Like every door in the openworld,
            // its trigger is put 1 above the measured ground there
            // (areascene.js), so the y is unused.
            {
                placeId: 15,
                name: "Witch House",
                areaType: "room",
                pos: towerDoor(TOWER_SPOTS.vesper),
                startingPos: {x: 0, y: 1, z: -4}
            },
            {
                placeId: 16,
                name: "Ilvara's Tower",
                areaType: "room",
                pos: towerDoor(TOWER_SPOTS.ilvara),
                startingPos: {x: 0, y: 1, z: -4}
            },
            {
                placeId: 17,
                name: "Sable's Tower",
                areaType: "room",
                pos: towerDoor(TOWER_SPOTS.sable),
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
