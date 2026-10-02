// The openworld's (placeId 888) graveyards - localroomdb.js's openworld
// entry uses this as its graveYards list, and areascene.js streams them in
// around the player (creations/creategraveyard.js's streamGraveyards: built
// once you're within 200 units of a fence, disposed past 300).
//
// Same entry shape as any graveYards list - see creategraveyard.js's header.
// y is ignored here: the openworld grounds every piece on the terrain.
//
// MIRRORED in tcp/recources/graveyards.ts, which spawns each plot's ghosts -
// tcp can't import client code, so a graveyard added, moved or resized here
// has to be changed there too (only position and areaSize matter to tcp).
//
// The first entry is the original hand-placed one. The rest were picked by
// an offline search over infterrain's own terrain functions (world.js,
// river.js - the exact formulas the game grounds on), keeping sites where:
//   - no part of the plot, plus a 6-unit margin, is in the river channel,
//     below the waterline, or within 10 units of a road;
//   - the ground inside rises no more than 10% of the plot's width
//     (several land in infterrain's flattened forest clearings, nearly 0);
//   - a road passes within ~70 units of the fence, so you come across them
//     while travelling - the entrance faces that road;
//   - few of infterrain's forest trees stand inside (its tree placement is
//     a deterministic hash, so the search counted them);
//   - every plot is 420+ from spawn (outside the flattened hub and the
//     castle) and 450+ from every other plot.
export const OPENWORLD_GRAVEYARDS = [
    { position: { x: 412,   y: 0, z: 255 },  areaSize: 100, entrance: "south" },
    { position: { x: 875,   y: 0, z: 400 },  areaSize: 80,  entrance: "north" },
    { position: { x: 775,   y: 0, z: 1125 }, areaSize: 70,  entrance: "west" },
    { position: { x: -325,  y: 0, z: 2025 }, areaSize: 60,  entrance: "south" },
    { position: { x: -50,   y: 0, z: 1575 }, areaSize: 60,  entrance: "east" },
    { position: { x: -50,   y: 0, z: 2850 }, areaSize: 60,  entrance: "east" },
    { position: { x: 50,    y: 0, z: 2400 }, areaSize: 50,  entrance: "west" },
    { position: { x: 325,   y: 0, z: 1875 }, areaSize: 50,  entrance: "north" },
    { position: { x: -1750, y: 0, z: 500 },  areaSize: 50,  entrance: "north" },
    { position: { x: -1300, y: 0, z: 625 },  areaSize: 40,  entrance: "south" },
    { position: { x: 1650,  y: 0, z: 525 },  areaSize: 40,  entrance: "south" },
    { position: { x: -825,  y: 0, z: 600 },  areaSize: 40,  entrance: "south" },
    { position: { x: 325,   y: 0, z: 825 },  areaSize: 40,  entrance: "south" },
]
