// roomdb.js
import { generateArea } from '../generate-datas/genareamd.js';
import { generateBSPDungeon } from '../generate-datas/generatebsp.js';

export const metaDatas = [
    generateBSPDungeon({ seed: 99182, name: "The Forgotten Catacombs", difficulty: 5 }),
    generateBSPDungeon({ seed: 77431, name: "The Crystal Depths",      difficulty: 2 }),
    generateBSPDungeon({
        seed: 12345,
        rockDensity: 0,
        gridWidth: 32,
        gridHeight: 32,
        cellSize: 4,
        wallHeight: 15,
        corridorWidth: 3,
        difficulty: 1,
        textures: { wallTexName: "wall1", floorTexName: "floor1", ceilingTexName: "ceil1" }
        // ↑ shorthand — applies rock2.jpg to wall, floor AND ceiling
    }),
    generateArea({
        name:       "The Antechamber",
        width:      40,
        height:     30,
        wallHeight: 15,
        difficulty: 1,
        seed:       55512,
        theme:      "stone_dungeon",
        floor:   { albedoColor: "#282828", roughness: 0.88, metallic: 0.02 },
        walls:   { albedoColor: "#1c1c1c", roughness: 0.92, metallic: 0.02 },
        ceiling: { albedoColor: "#080808", roughness: 1.00, metallic: 0.00 },
    }),
    generateArea({ 
        width:      100,
        height:     100,
        seed: 123, 
        totalBigHouse: 10, 
        totalBigTrees: 1, 
        entry: "south",
        exit: "north",
    }),
    {
        name: 'Simple Room',
        width: 7,
        height: 10,
        areaType: "room",
        spawn: {x: 0, y: 1, z: -2, rotation: 0},
        bedConfig: {
            hasBed: true,
            bedPosition: {x: 0, y: 0, z: 2},
            bedRotation: 0,
            bedGlbName: "bed1.glb",
        }
    }
];