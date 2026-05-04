// roomdb.js
import { generateArea } from '../generate-datas/genareamd.js';
import { generateBSPDungeon } from '../generate-datas/generatebsp.js';

export const metaDatas = [
   
    generateBSPDungeon({ 
        placeId: "dungeon101",
        areaType: "dungeon",
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
        placeId: "village101",
        areaType: "village",
        width:      100,
        height:     100,
        seed: 123, 
        totalBigHouse: 1, 
        totalSmallHouse : 30,
        totalMediumHouse: 0,
        totalBigTrees: 1, 
        entry: "south",
        exit: "north",
        sceneTemp: {
            fogDensity: 0.008,
            fogColor:{ r:0.05, g:0.15, b:0.1},

            lights: [
                {name:"directional", intensity: 0.9}, 
                // {name:"hemispheric", intensity: 0.1}, 
            ],
        }
    }),
    {
        placeId: "room101",
        name: 'Simple Room',
        width: 7, // ground width
        height: 10, // ground height
        areaType: "room",
        layout: { cellSize: 1 },
        spawn: {x: 0, y: 1, z: -2, rotation: 0},
        bedConfig: {
            hasBed: true,
            bedPosition: {x: 0, y: 0, z: 2},
            bedRotation: 0,
            bedGlbName: "bed1.glb",
        },
        indorItems: [
            {
                itemId: "12390casj",
                name: "table",
                position: {x: 2.5, y: 0, z: 2},
                scale: null,
                rotation: Math.PI / 2,
                glbPath: "./models/indors/table1.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: (container) => { container.meshes[0].getChildren()[0].dispose() } // this table has a transform node we don't need, so dispose it before merging
            },
            {
                itemId: "1432fads",
                name: "book",
                position: {x: 2.2, y: 1, z: 2},
                scale: null,
                rotation: Math.PI / 2,
                glbPath: "./models/indors/book1.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null // this table has a transform node we don't need, so dispose it before merging
            },
            {
                itemId: "123s-0d12",
                name: "fireplace",
                position: {x: -2.5, y: 0, z: 4},
                scale: null,
                rotation: Math.PI / 5,
                glbPath: "./models/indors/fireplace.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null // this table has a transform node we don't need, so dispose it before merging
            }
        ]
    }
];