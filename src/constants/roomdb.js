// roomdb.js
import { generateBSPDungeon } from '../generatives/generatebsp.js';

export const rooms = [
    generateBSPDungeon({ seed: 99182, name: "The Forgotten Catacombs", difficulty: 5 }),
    generateBSPDungeon({ seed: 77431, name: "The Crystal Depths",      difficulty: 2 }),
    generateBSPDungeon({
    seed:          12345,   // ← change this for a new layout

    gridWidth:     32,      // wider map = more rooms side by side
    gridHeight:    120,      // taller map = more rooms top to bottom
                            // (increase both for a bigger dungeon)

    cellSize:      10,       // world units per grid cell
                            // bigger = wider corridors and rooms in world space

    wallHeight:    15,      // ceiling height (you already set this to 15)

    corridorWidth: 3,       // corridor width in grid cells
                            // 3 = default, 4-5 = wide open halls, 2 = tight

    difficulty:    1,       // stored in meta, not used for generation yet
})
];