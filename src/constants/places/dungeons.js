// The dungeons' place details. DUNGEON_12 is its own constant (not just an
// entry in metaDatas) so the doors into it - the village's and the
// openworld's - can point their startingPos at its spawn.
import { generateBSPDungeon } from '../../generate-datas/generatebsp.js';


// placeId 12's dungeon - built up here instead of inline in metaDatas so the
// openworld's own door into it (placeId 888's roomPaths, below) can point its
// startingPos at this exact dungeon's spawn. getSpawnPos converts the BSP's
// cell-index spawn into world units, the same conversion the void-fall
// respawn (inputMovement.js) already uses for it.
export const DUNGEON_12 = generateBSPDungeon({
    placeId: 12,
    areaType: "dungeon",
    seed: 12345,
    rockDensity: 0,
    gridWidth: 32,
    gridHeight: 32,
    cellSize: 4,
    wallHeight: 15,
    corridorWidth: 3,
    // boss room twice as wide as the BSP carved it
    bossRoomWidthScale: 5,
    // no resourceTemplates: the ore deposits are tcp's (tcp/recources/ores.ts),
    // standing on the generator's ore spots - a silver vein, then a rich one -
    // with hit points. tcp/recources/dungeonLayouts.ts runs this same
    // generator with these same layout arguments - change one, change both.
    difficulty: 1,
    // floorAlbedoMap: the floor's colour texture. floorBumpHeightMap: its bump -
    // images/modeltex/pillartex1normal.webp is a grey HEIGHT map (white = raised)
    // despite its name, so createDungeon has createHeightBumpTexture turn it into a
    // normal map rather than loading it as one. The two are a matched pair.
    //
    // floorLayers/floorAccent take over from both when set: the floor mixes
    // these across itself so it doesn't look tiled (tools/dungeonFloorMat.js) -
    // pillartex2 is the main stone, cement and rubble form patches over it, and
    // `chance` of the cells are re-laid in tile4. repeat: times the texture
    // repeats across one 4-unit cell.
    textures: { wallTexName: "wall5.webp", wallBumpTexName: "wall5normal.jpg", floorTexName: "pillartex2", ceilingTexName: "ceil1",
        // floorAlbedoMap: "./images/modeltex/pillartex1.webp",
        floorAlbedoMap: "./images/modeltex/pillartex2.webp",
        floorBumpHeightMap: "./images/modeltex/pillartex1normal.webp",
        floorLayers: [
            { path: "./images/modeltex/pillartex2.webp", repeat: 1 },
            { path: "./images/modeltex/sement1.jpg", repeat: 1 },
            { path: "./images/modeltex/rockTex.jpg", repeat: 1 },
        ],
        floorAccent: { path: "./images/modeltex/tile4.jpg", repeat: 1, chance: 0.05 },
    },
    // ↑ shorthand — applies rock2.jpg to wall, floor AND ceiling

    //new
    sceneTemp: {
        fogDensity: 0.008,
        fogColor:{ r:0.05, g:0.15, b:0.1},

        // no directional light: it shone straight through the ceiling (nothing
        // casts shadows) and lit every room equally. The dungeon's own
        // ambient + per-room lights come from creations/createdungeon.js.
        lights: [],
    },
    isMultiplayer: true,
    exitPlaceDetail: {
        placeId: 888,
        name: "openworld",
        areaType: "openworld",
        // 4 units back from the openworld's own dungeon door
        // ({x:-1.5, z:510}) so you don't land inside its trigger again.
        // y is the ground there (sampleTerrainSurfaceHeight = 2, flat
        // around the openworld spawn), same feet-on-the-ground convention
        // the Witch House's own exit startingPos uses
        startingPos: {x: -1.5, y: 2, z: 506},
    },
})
