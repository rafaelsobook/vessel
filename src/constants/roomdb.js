// roomdb.js
import { generateBSPDungeon } from '../generatives/generatebsp.js';

export const rooms = [
    generateBSPDungeon({ seed: 99182, name: "The Forgotten Catacombs", difficulty: 1 }),
    generateBSPDungeon({ seed: 77431, name: "The Crystal Depths",      difficulty: 2 }),
];