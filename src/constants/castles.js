// The openworld's castles (placeId 888) - areascene.js builds each with
// createCastle (creations/createcastle.js). Each one's look is rolled from its
// seed, so changing a seed gives that castle a new face and leaves the others
// alone; `look` pins any of rollLayout's values instead.
//
// The four far ones sit ~1000 out from the spawn (0, 500), one each way, on
// uneven ground - the exact cardinal points all land on the roads that run out
// from the spawn, so each is set off to the side of its road (its gate faces
// that road). Picked from a terrain survey: no river, no water, not on a road,
// clear of the graveyards (graveyards.js), 6-10 units of rise across the
// footprint.
export const OPENWORLD_CASTLES = [
    // the original castle north of the spawn, bigger now - flat ground, gate
    // toward the spawn, keeping its old grey-stone, red-cone look
    {
        name: "castle_hub", x: 0, z: 600, seed: "hub",
        faceToward: { x: 0, z: 500 },
        look: { towerShape: "round", roof: "pointed", keepShape: "square", keepRoof: "pointed", palaceRoof: "hip", stone: 0, roofLook: 2, yawJitter: 0 },
    },
    { name: "castle_north", x: 100.6, z: 1500, seed: "north" },
    { name: "castle_south", x: 80.6, z: -600, seed: "south" },
    { name: "castle_east", x: 1000.6, z: 380, seed: "east" },
    { name: "castle_west", x: -974.4, z: 480, seed: "west" },
]
