// roomdb.js
import { generateBSPDungeon } from '../generatives/generatebsp.js';

export const rooms = [
    generateBSPDungeon({ seed: 99182, name: "The Forgotten Catacombs", difficulty: 5 }),
    generateBSPDungeon({ seed: 77431, name: "The Crystal Depths",      difficulty: 2 }),
    generateBSPDungeon({
        seed: 12345,
        gridWidth: 32,
        gridHeight: 120,
        cellSize: 10,
        wallHeight: 15,
        corridorWidth: 3,
        difficulty: 1,
        textures: { diffuse: "rock2", normal: "rock2normal" }
        // ↑ shorthand — applies rock2.jpg to wall, floor AND ceiling
    })
];