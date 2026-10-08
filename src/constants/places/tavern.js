// The tavern (placeId 18), in the village.
import { randNum } from '../../tools/random.js';

export const TAVERN = {
    // Tavern interior - entered via placeId 1's own roomPaths entry
    // (walking up to the "Tavern" building placed in optionalObjects
    // above). Standalone room, not nested under another interior like
    // Simple Room(10) is under Guild House(9) - same procedural boxed
    // room shape (createroom.js), just its own placeId/door/exit back to
    // the village instead of back to another interior.
    placeId: 18,
    name: 'Tavern',
    width: 20,
    height: 14,
    areaType: "room",
    layout: { cellSize: 1 },
    // matches the village door's own startingPos (both are "just inside
    // the front door, facing into the room") - clear of the exit door's
    // trigger (roomPaths below, z -7..-5)
    spawn: {x: 0, y: 1, z: -4, rotation: 0},

    optionalObjects: [
        {
            itemId: randNum(0,9999).toString(),
            name: "roomdoor",
            // the way out - its roomPaths entry below stands in front of it
            position: {x: 0, y: 0, z: -6.5},
            scale: null,
            rotation: 0,
            glbPath: "./models/indors/door.glb",
            physics: {
                opt: {mass: 0},
                type: "box"
            },
            functionBeforeMerge: null
        },
    ],
    // Both glbs are long along local X with the pivot at floor center
    // (table 2.16 x 0.80, bench 1.72 x 0.55), so rotationY 0 runs them
    // east-west and Math.PI/2 runs them north-south. Benches sit 0.8 off
    // a table's center on each long side. Layout: a feast table (3 tables
    // end to end) along the north wall, two lengthwise tables against
    // each side wall, and a middle pair leaving a ~4.6-wide aisle from
    // the door (south) to the feast table.
    tables: {
        mainGlbpath: "./models/indors/tavernTable.glb",
        locations: [
            { pos: {x: -2.16, y: 0, z: 4.2}, rotationY: 0 },
            { pos: {x: 0, y: 0, z: 4.2}, rotationY: 0 },
            { pos: {x: 2.16, y: 0, z: 4.2}, rotationY: 0 },
            { pos: {x: -7, y: 0, z: -2.2}, rotationY: Math.PI/2 },
            { pos: {x: -7, y: 0, z: 1.6}, rotationY: Math.PI/2 },
            { pos: {x: 7, y: 0, z: -2.2}, rotationY: Math.PI/2 },
            { pos: {x: 7, y: 0, z: 1.6}, rotationY: Math.PI/2 },
            { pos: {x: -3.4, y: 0, z: -0.2}, rotationY: 0 },
            { pos: {x: 3.4, y: 0, z: -0.2}, rotationY: 0 },
        ]
    },
    chairs: {
        mainGlbpath: "./models/indors/tavChair.glb",
        locations: [
            // feast table
            { pos: {x: -2.16, y: 0, z: 3.4}, rotationY: 0 },
            { pos: {x: -2.16, y: 0, z: 5}, rotationY: 0 },
            { pos: {x: 0, y: 0, z: 3.4}, rotationY: 0 },
            { pos: {x: 0, y: 0, z: 5}, rotationY: 0 },
            { pos: {x: 2.16, y: 0, z: 3.4}, rotationY: 0 },
            { pos: {x: 2.16, y: 0, z: 5}, rotationY: 0 },
            // west wall tables
            { pos: {x: -7.8, y: 0, z: -2.2}, rotationY: Math.PI/2 },
            { pos: {x: -6.2, y: 0, z: -2.2}, rotationY: Math.PI/2 },
            { pos: {x: -7.8, y: 0, z: 1.6}, rotationY: Math.PI/2 },
            { pos: {x: -6.2, y: 0, z: 1.6}, rotationY: Math.PI/2 },
            // east wall tables
            { pos: {x: 6.2, y: 0, z: -2.2}, rotationY: Math.PI/2 },
            { pos: {x: 7.8, y: 0, z: -2.2}, rotationY: Math.PI/2 },
            { pos: {x: 6.2, y: 0, z: 1.6}, rotationY: Math.PI/2 },
            { pos: {x: 7.8, y: 0, z: 1.6}, rotationY: Math.PI/2 },
            // middle pair
            { pos: {x: -3.4, y: 0, z: -1}, rotationY: 0 },
            { pos: {x: -3.4, y: 0, z: 0.6}, rotationY: 0 },
            { pos: {x: 3.4, y: 0, z: -1}, rotationY: 0 },
            { pos: {x: 3.4, y: 0, z: 0.6}, rotationY: 0 },
        ]
    },
    roomPaths: [
        {
            // the door in the south wall ("roomdoor" above), out to the
            // village's spawn. Its trigger (z -7..-5) stays clear of this
            // room's spawn at z -4
            placeId: 1,
            name: "village",
            areaType: "village",
            pos: {x: 0, y: 0.5, z: -6},
            doorSound: true,
        },
    ],
    sceneTemp: {
        fogDensity: 0.1,
        fogColor:{ r:0.05, g:0.15, b:0.1},

        lights: [
            {name:"directional", intensity: 0.9},
        ],
    },
    // shared room, like Guild House(9) - other players are rendered here
    // and seat claims sync through tcp (charactersystem/seating.js)
    isMultiplayer: true
}
