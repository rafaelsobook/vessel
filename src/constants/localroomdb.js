// roomdb.js
import { ActionManager, MeshBuilder, Vector3 } from '@babylonjs/core';
import { getCharState, setCanPress, setCharStateMode } from '../charactersystem/characterstate.js';
import { onIntersecEnterTrig, onIntersecExitTrig } from '../components/actionManager.js';
import { generateArea } from '../generate-datas/genareamd.js';
import { generateBSPDungeon } from '../generate-datas/generatebsp.js';
import { getSceneDet } from '../main/main.js';
import { getPlayersOnScene } from '../sockets/worldsocket.js';
import { randNum } from '../tools/random.js';
import { openCloseInteractBtn } from '../tools/popupUI.js';
import { playAnim } from '../tools/animation.js';
import { disableEnableAttackButtonsContainer } from '../charactersystem/uimanagement.js';
import { faceForward, getControllerObjects } from '../controllers/inputMovement.js';
import { createMagicCircle } from '../creations/magiccircles.js';

export const metaDatas = [

    generateBSPDungeon({
        placeId: 12,
        areaType: "dungeon",
        seed: 12345,
        rockDensity: 0,
        gridWidth: 32,
        gridHeight: 32,
        cellSize: 4,
        wallHeight: 15,
        corridorWidth: 3,
        difficulty: 1,
        textures: { wallTexName: "wall1", floorTexName: "floor1", ceilingTexName: "ceil1" },
        // ↑ shorthand — applies rock2.jpg to wall, floor AND ceiling

        //new
        sceneTemp: {
            fogDensity: 0.008,
            fogColor:{ r:0.05, g:0.15, b:0.1},

            lights: [
                {name:"directional", intensity: 0.9},
                // {name:"hemispheric", intensity: 0.1},
            ],
        },
        isMultiplayer: true
    }),
    {
        ...generateArea({
        placeId: 1,
        areaType: "village",
        width:      300,
        height:     300,
        seed: 12365,
        totalBigHouse: 4,
        totalSmallHouse : 3,
        totalMediumHouse: 0,
        totalBigTrees: 5,
        totalMediumTrees: 300,
        totalSmallTrees: 300,
        totalRocks: 1000,
        totalGrass: 100000,
        // entry: "south",
        exit: "east",
        entryExitPlaceIds: {
            // entryPlaceDetail: {
            //     placeId: 1,
            //     name: "village",
            //     areaType: "village",
            // },
            exitPlaceDetail: {
                placeId: 2,
                name: "village",
                areaType: "village",
            }
        },
        sceneTemp: {
            fogDensity: 0.008,
            fogColor:{ r:0.05, g:0.15, b:0.1},

            lights: [
                {name:"directional", intensity: 0.9},
                // {name:"hemispheric", intensity: 0.1},
            ],
        },
        isMultiplayer: true
    })
    },
    {
    ...generateArea({
        placeId: 2,
        areaType: "village",
        width:      100,
        height:     100,
        seed: 123,
        totalBigHouse: 10,
        totalSmallHouse : 19,
        totalMediumHouse: 0,
        totalBigTrees: 100,
        totalMediumTrees: 100,
        entry: "west",
        exit: "east",
        entryExitPlaceId: {
            entry: {
                placeId: 1,
                name: "village",
                areaType: "village",
            },
            exit: {
                placeId: 2,
                name: "village",
                areaType: "village",
            }
        },
        sceneTemp: {
            fogDensity: 0.008,
            fogColor:{ r:0.05, g:0.15, b:0.1},

            lights: [
                {name:"directional", intensity: 0.9},
                // {name:"hemispheric", intensity: 0.1},
            ],
        },
        isMultiplayer: true
    })
    },
    {
        placeId: 10,
        name: 'Simple Room',
        width: 7, // ground width
        height: 10, // ground height
        areaType: "room",
        layout: { cellSize: 1 },
        spawn: {x: 0, y: 1, z: -2, rotation: 0},

        indorItems: [
            {
                itemId: randNum(0,9999).toString(),
                name: "bed",
                position: {x: 1, y: 0, z: 2},
                scale: null,
                rotation: 0,
                glbPath: "./models/beds/bed1.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
            {
                itemId: randNum(1000,9999).toString(),
                name: "table",
                position: {x: -2.5, y: 0, z: 2},
                scale: null,
                rotation: Math.PI / 2,
                glbPath: "./models/indors/table1.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge:(container) => { 
                    container.meshes[0].getChildren()[0].dispose() 

                    return container.meshes[0].getChildren()[0]
                } // this table has a transform node we don't need, so dispose it before merging
            },
            {
                itemId: randNum(1000,9999).toString(),
                name: "book",
                position: {x: 2.2, y: 0.9, z: 2},
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
                itemId: randNum(1000,9999).toString(),
                name: "fireplace",
                position: {x: -2.5, y: 0, z: 4},
                scale: null,
                rotation: Math.PI + 1,
                glbPath: "./models/indors/fireplace.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null // this table has a transform node we don't need, so dispose it before merging
            },
            {
                itemId: randNum(1000,9999).toString(),
                name: "particle_fire",
                position: {x: -2.5, y: 0, z: 4},
                scale: null,
                rotation:0,
                glbPath: null,
                physics: null,
                functionBeforeMerge: null // this table has a transform node we don't need, so dispose it before merging
            }
        ],
        exit: "south",
        exitPlaceDetail: {
            placeId: 9,
            name: "guild house",
            areaType: "room",
        },
        entryExitPlaceId: {
            exit: {
                placeId: 9,
                name: "guild house",
                areaType: "room",
            }
        },
        sceneTemp: {
            fogDensity: 0.1,
            fogColor:{ r:0.05, g:0.15, b:0.1},

            lights: [
                {name:"directional", intensity: 0.9},
                // {name:"hemispheric", intensity: 0.1},
            ],
        },
        isMultiplayer: false
    },
    {
        placeId: 9, // Guild House
        name: 'Guild House',
        width: 16, // ground width
        height: 13, // ground height
        areaType: "room",
        layout: { cellSize: 1 },
        spawn: {x: 3, y: 0.4, z: 2.5, rotation: 0},

        indorItems: [
            {
                itemId: randNum(0,9999).toString(),
                name: "guildtable",
                position: {x: 0, y: 0, z: 3.5},
                scale: null,
                rotation: Math.PI,
                glbPath: "./models/indors/guildDesk2.glb",
                diffuseTexPath: "./images/modeltex/wood2.jpg",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
            {
                itemId: randNum(0,9999).toString(),
                name: "guildstair",
                position: {x: -6, y: 0, z: 5},
                scale: null,
                rotation: Math.PI,
                glbPath: "./models/indors/guildstairs.glb",
                // diffuseTexPath: "./images/modeltex/wood2.jpg",
                physics: {
                    opt: {mass: 0},
                    type: "mesh"
                },
                functionBeforeMerge: null
            },
            {
                itemId: randNum(0,9999).toString(),
                name: "testcrystal",
                position: {x: 1, y: 0.9, z: 3.1},
                scale: null,
                rotation: Math.PI/2,
                glbPath: "./models/indors/testcrystal.glb",
                diffuseTexPath: null,
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null,
                cbAfterMade: (scene) => {
                    let charState = getCharState()
                    if(!charState) return
                    const player = getPlayersOnScene().find(pl => pl.owner === charState.owner)
                    if(!player) return
                    // const scene = getSceneDet().scene
                    const testCrystal = scene.getMeshByName("testcrystal")
                    if(!testCrystal) return
                    const collider = MeshBuilder.CreateBox("testcrystalcollider", {size: 2, height: 0.2}, scene)
                    collider.parent = testCrystal
                    collider.isVisible = false
                    collider.actionManager = new ActionManager(scene)
                    onIntersecEnterTrig(collider, player.body, scene, () => {
                        charState = getCharState()
                        const touchCrystalQuest = charState.quests.find(qst => qst.qName === "touchTheCrystal")
                        if(!touchCrystalQuest) return
                        openCloseInteractBtn("true", true, () => {
                            openCloseInteractBtn("none", false)
                            setCharStateMode("casting")
                            setCanPress(false)
                            disableEnableAttackButtonsContainer(false, true)
                            playAnim(player.anims, "cast", false)

                            faceForward({x: 1, y: 0.9, z: 3.1})

                            // const elementNames = charState.aptitude.map(a => `apt_${a.element}`)
                            const elementNames = ["apt_fire", "apt_water", "apt_earth", "apt_light", "apt_darkness"]

                            let timeoutnums = 1000
                            let discPosY = 2
                            elementNames.forEach(name => {
                                const capturedY = discPosY
                                setTimeout(() => {
                                    createMagicCircle({x: 1, y: capturedY, z: 3.1}, getSceneDet().scene, name, 2, 4000)
                                }, timeoutnums)
                                timeoutnums += 2000
                                discPosY += 0.25
                            })

                            setTimeout( async () => {
                                touchCrystalQuest.questRequirements.completed = true
                                // save to database

                                setCharStateMode("idle")
                                setCanPress(true)
                                disableEnableAttackButtonsContainer(true)
                            }, 10000)
                        });
                    })
                    onIntersecExitTrig(collider, player.body, scene, () => openCloseInteractBtn("none", false))
                }
            }
        ],
        exit: "south",
        exitPlaceDetail: {
            placeId: 1,
            name: "village",
            areaType: "village",
        },
        entryExitPlaceId: {
            exit: {
                placeId: 1,
                name: "village",
                areaType: "village",
            }
        },
        sceneTemp: {
            fogDensity: 0,
            fogColor:{ r:0.05, g:0.15, b:0.1},

            lights: [
                // {name:"directional", intensity: 0.9},
                {name:"hemispheric", intensity: 0.8},
            ],
        },
        isMultiplayer: false
    }
];
