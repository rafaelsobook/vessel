// The witches' towers - Vesper's (the Witch House, placeId 15), Ilvara's
// (16) and Sable's (17). Their tower buildings stand in the openworld.

// Where each tower stands in the openworld (placeId 888) - the one place
// these numbers live. The tower itself (localroomdb.js's openworld
// optionalObjects), its door and the spot you come out at when you leave
// (each interior's roomPaths below) are all worked out from it. No y: the
// tower is stood on the real ground as it's placed (creations/
// groundBuilding.js), and its door and way out go on the ground with it.
export const TOWER_SPOTS = {
    vesper: { x: -1893, z: 563 },
    ilvara: { x: 1200,  z: 800 },
    sable:  { x: -600,  z: -1400 },
}
// tower.glb at the towers' shared rotation (-PI/2): its base is about this
// wide, and its door is this far off its centre, facing +x
export const TOWER_FOOTPRINT = 4.13
export const TOWER_DOOR = { x: 4.2, z: -0.1 }
// where the door's 2x2 trigger goes (areascene.js grounds its y)
export function towerDoor(spot){
    return { x: spot.x + TOWER_DOOR.x, y: 0, z: spot.z + TOWER_DOOR.z }
}
// a couple of steps out of the door - clear of the tower's own collider and
// the door's trigger. The y is only a fallback: arriving through a door,
// areascene.js stands you on the measured ground.
function towerExit(spot){
    return { x: spot.x + TOWER_DOOR.x + 2.3, y: 1, z: spot.z + TOWER_DOOR.z }
}


export const WITCH_HOUSE = {
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
            startingPos: towerExit(TOWER_SPOTS.vesper),
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
}

export const ILVARA_TOWER = {
    // Ilvara's Tower interior - entered via placeId 888's own roomPaths
    // entry (TOWER_SPOTS.ilvara in the openworld), same round-room shape as
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
            startingPos: towerExit(TOWER_SPOTS.ilvara),
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
}

export const SABLE_TOWER = {
    // Sable's Tower interior - entered via placeId 888's own roomPaths
    // entry (TOWER_SPOTS.sable in the openworld), same round-room shape
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
            startingPos: towerExit(TOWER_SPOTS.sable),
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
}
