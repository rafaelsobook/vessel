// roomdb.js
import { ActionManager, MeshBuilder, Vector3 } from '@babylonjs/core';
import { getCharState, setCanPress, setCharState, setCharStateMode, setQuestCompleted } from '../charactersystem/characterstate.js';
import { onIntersecEnterTrig, onIntersecExitTrig } from '../components/actionManager.js';
import { generateArea } from '../generate-datas/genareamd.js';
import { generateBSPDungeon } from '../generate-datas/generatebsp.js';
import { getSceneDet } from '../main/main.js';
import { getIsSocketOn, getPlayersOnScene } from '../sockets/worldsocket.js';
import { randNum } from '../tools/random.js';
import { openCloseInteractBtn } from '../tools/popupUI.js';
import { playAnim } from '../tools/animation.js';
import { disableEnableAttackButtonsContainer } from '../charactersystem/uimanagement.js';
import { faceForward, getControllerObjects } from '../controllers/inputMovement.js';
import { createMagicCircle } from '../creations/magiccircles.js';
import { getAllSounds } from '../components/soundSystem.js';
import { getSocket } from '../sockets/joinsocket.js';
import { emitSpawnCircle } from '../sockets/emits.js';
import { randomNum } from '../tools/tools.js';

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
        originalGlbs: [
            {
                pos: {x: -12, y: 0, z: -24}, 
                rot: Math.PI,
                textures: [
                    {name: "clothroof", tex:"wall3", normal: "fabricnormal", uScale: 10.5, lighten: 1.5},
                    {name: "lightwood", tex:"wood3", normal: "wood3normal", uScale: 10, lighten: 1},
                    {name: "redwood", tex:"wood2", uScale: 2, lighten: 1.5},
                    {name: "vase", tex:"wall1", normal: "wall1normal", uScale: 3, lighten: .5},
                    {name: "wheel", tex:"iron2", uScale: 2, lighten: .5},
                    {name: "wood", tex:"wood1", normal: "wood1normal", uScale: 5, lighten: 1.15},
                    {name: "books", tex:"decor1", uScale: 2, lighten: 1.15},
                    {name: "grass", tex:"fabric2", uScale: 2, lighten: 1.15},
                    {name: "lemon", tex:"fabric4amb", uScale: 2, lighten: 1.15},
                    {name: "carrot", tex:"floor2", uScale: .1, lighten: 1.15},
                    {name: "potatoe", tex:"potatoe", uScale: 1, lighten: 2},
                ], 
                glbPath:"./models/outdors/smallmarket.glb"
            },
            {
                pos: {x: 28, y: 0, z: -43},
                rot: Math.PI/2,
                textures: [
                    {name: "roof", tex:"iron2", uScale: 3, lighten: 1.5},
                    {name: "housebody", tex:"sement2", uScale: 3, lighten: 1.5}
                ],
                glbPath: "./models/outdors/weaponHouse.glb"
            },
            {
                pos: {x: 29, y: 0, z: -42},
                rot: Math.PI,
                textures: [
                    {name: "iron", tex:"rockTex", uScale: 3, lighten: 1.5},
                    {name: "fabric", tex:"fabric1", uScale: 3, lighten: 1.5},
                    {name: "metalforge", tex:"iron2", uScale: 3, lighten: 1.5},
                    {name: "fire", tex:"iron1", emissive: {r:1, g:0,b:0}, uScale: 3, lighten: 1.5},
                ],
                glbPath: "./models/outdors/forge.glb"
            }
        ],
        optionalObjects: [
            {
                itemId: randNum(0,9999).toString(),
                name: "Guild House",
                position: {x: -8, y: 0, z: -12},
                scale: null,
                rotation:-Math.PI/2,
                glbPath: "./models/houses/guild1.glb",
                diffuseTexPath:null,
                bumpTexPath: "./images/textures/houses/guild1.jpg",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
            {
                itemId: randNum(0,9999).toString(),
                name: "Travel Wagon",
                position: {x: 12, y: 0, z: -1.6},
                scale: null,
                rotation:Math.PI/2 + 0.5,
                glbPath: "./models/outdors/wagon.glb",
                diffuseTexPath:null,
                // bumpTexPath: "./images/textures/houses/guild1.jpg",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
        ],
        roomPaths: [
            {
                placeId: 9,
                name: "Guild Room",
                areaType: "room",
                pos: {x: -2.75, y: 0.5, z: -12.02},
                startingPos: {x: 0.12, y: 1, z: -4.4}
            }
        ],
        resources: [
            {
                resourceId: randNum(0,9999).toString(),
                resourceType: "ore", // procedurally generated, see createOre() in createRock.js
                name: "ore",
                position: {x: 3, y: 0, z: -5},
                scale: null,
                rotation: 0,
                loots: [
                    {name: "stone", chance: 0.2},
                    {name: "solarore", chance: 0.02},
                    {name: "bronzeore", chance: 0.1},
                ],
                physics: {
                    opt: {mass: 0},
                    type: "box"
                }
            }
        ],

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
        totalMediumTrees: 10,
        totalSmallTrees: 100,
        totalRocks: 500,
        totalGrass: 10000,
        totalBushes: 5000,
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
                {name:"hemispheric", intensity: 1},
            ],
        },
        isMultiplayer: true
        }),
        spawn: {x: 0.6, y: 1, z: -10},
    },
    {
        placeId: 10,
        name: 'Simple Room',
        width: 7, // ground width
        height: 10, // ground height
        areaType: "room",
        layout: { cellSize: 1 },
        spawn: {x: 0, y: 1, z: -2, rotation: 0},
        
        optionalObjects: [
            {
                itemId: randNum(0,9999).toString(),
                name: "roomdoor",
                position: {x: 0, y: 0, z: -5.5},
                scale: null,
                rotation: 0,
                glbPath: "./models/indors/door.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
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
                functionBeforeMerge: null, // this table has a transform node we don't need, so dispose it before merging
                cbAfterMade: (scene) => {
                    
                    getAllSounds().bonfireS?.play()
                }
            },
            {
                itemId: randNum(1000,9999).toString(),
                name: "particle_fire",
                position: {x: -2.5, y: 0, z: 4},
                scale: null,
                rotation:0,
                glbPath: null,
                physics: null,
                functionBeforeMerge: null, // this table has a transform node we don't need, so dispose it before merging

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
        spawn: {x: 4.4, y: 0.4, z: 2.5, rotation: 0},
        roomPaths: [ // pabalik sa room naten dapat sa taas ng hagdan to e
            {
                placeId: 10,
                name: "room",
                areaType: "room",
                pos: {x: 6, y: 0.5, z: 5.25},
                startingPos: {x: 0, y: 1, z: -2}
            },
            {
                placeId: 101,
                name: "Guildmaster's Office",
                areaType: "room",
                pos: {x: 0.9, y: 0.5, z: 5.25},
                startingPos: {x: 0, y: 1, z: -3}
            },
            // placeId 101 (Guildmaster's Office) already exists fully built
            // (desk/chair/shelves) and already has its OWN way back out
            // (exitPlaceDetail: placeId 9, createroom.js's south-wall exit
            // trigger) - but nothing here ever led INTO it, a one-way dead
            // end. Anchored on "guildgate" below (optionalObjects) - its own
            // dedicated guilddoor.glb (every other door mesh here just uses
            // the generic door.glb), sitting unused with no roomPaths entry
            // of its own, is the obvious intended front door for this exact
            // destination. startingPos is a guess (just inside 101's own
            // south wall, clear of both that room's own exit trigger and
            // its desk/chair cluster further north) - adjust in-game if it
            // doesn't land cleanly.
        ],
        optionalObjects: [
            {
                itemId: randNum(0,9999).toString(),
                name: "roomdoor",
                position: {x: 6, y: 0, z: 6.1},
                scale: null,
                rotation: 0,
                glbPath: "./models/indors/door.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
            {
                itemId: randNum(0,9999).toString(),
                name: "roomdoor",
                position: {x: 0.9, y: 0, z: 6.1},
                scale: null,
                rotation: 0,
                glbPath: "./models/indors/door.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
            {
                itemId: randNum(0,9999).toString(),
                name: "guildgate",
                position: {x: 0, y: 0, z: -7},
                scale: null,
                rotation: 0,
                glbPath: "./models/indors/guilddoor.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
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
                name: "guildboard",
                position: {x: -5, y: 0, z: 4.9},
                scale: null,
                rotation: -Math.PI/2 - 0.3,
                glbPath: "./models/indors/guildboard.glb",
                // diffuseTexPath: "./images/modeltex/wood2.jpg",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
            // { // I commented this out because the physics is complaining of how many the geometry is
            //     itemId: randNum(0,9999).toString(),
            //     name: "guildstair",
            //     position: {x: -6, y: 0, z: 5},
            //     scale: null,
            //     rotation: Math.PI,
            //     glbPath: "./models/indors/guildstairs.glb",
            //     // diffuseTexPath: "./images/modeltex/wood2.jpg",
            //     physics: {
            //         opt: {mass: 0},
            //         type: "mesh"
            //     },
            //     functionBeforeMerge: null
            // },
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
                        console.log(charState.quests)
                        const touchCrystalQuest = charState.quests.find(qst => qst.qName === "touchTheCrystal")
                        if(!touchCrystalQuest) return console.log("no touchCrystalQuest")
                        openCloseInteractBtn("normal", true, () => {
                            openCloseInteractBtn("none", false)
                            
                            player.characterAnimations.playAction(player.anims, "cast", 1, () => {
                                setCharStateMode("casting")
                            })
                            setCanPress(false)
                            disableEnableAttackButtonsContainer(false, true)
                            playAnim(player.anims, "cast", false)

                            faceForward({x: 1, y: 0.9, z: 3.1})

                            // const elementNames = charState.aptitude.map(a => `apt_${a.element}`)
                            const elementNames = ["apt_fire", "apt_water", "apt_earth", "apt_light", "apt_darkness"]

                            let timeoutnums = 1000
                            let discPosY = 2
                            charState.aptitude.forEach(apt => {
                                console.log(apt)
                                const capturedY = discPosY
                                setTimeout(() => {
                                    createMagicCircle({x: 1, y: capturedY, z: 3.1}, getSceneDet().scene, `apt_${apt.element}`, 2, 4000)
                                    const socket = getSocket()
                                    if(getIsSocketOn()) emitSpawnCircle({x: 1, y: capturedY, z: 3.1},apt.element)
                                }, timeoutnums)
                                timeoutnums += 2000
                                discPosY += 0.25
                            })

                            setTimeout( async () => {
                                // touchCrystalQuest.questRequirements.completed = true
                                const isQuestExist = setQuestCompleted("touchTheCrystal")
                                if(!isQuestExist) return console.log("quest completion failed")
                                // save to database

                                setCharStateMode("idle")
                                setCanPress(true)
                                disableEnableAttackButtonsContainer(true)
                            }, 8000)
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
        isMultiplayer: true
    },


    {
        placeId: 101, // Guildmaster's Office
        name: "Guildmaster's Office",
        width: 20, // ground width
        height: 16, // ground height - was 10; the desk/chair/shelves cluster needs
        // more depth to breathe (see the repositioning below) than a shallow room allows
        wallTexPath: "./images/modeltex/brick2.jpg", // wallHeight left at the default 0.5 knee-wall, same as every other room
        areaType: "room",
        layout: { cellSize: 1 },
        spawn: {x: 0, y: 0.4, z: -1, rotation: Math.PI}, // was z:3, same spot as the desk - moved clear of it
        paintedPlanes: [
            {
                name: "floorcarpet",
                texturePath: "./images/modeltex/decor1.jpg",
                rotation: {x: Math.PI/2, y: Math.PI/2, z: 0},
                position: {x: 0, y: 0.016, z: -2.5},
                width: 6,
                height: 10,
            }
        ],
        woodboxes: [
            { name: "woodbox1", position: {x: -8.5, y: 0.5, z: -6} },
            { name: "woodbox2", position: {x: -8.5, y: 1.5, z: -6} }, // stacked on top of woodbox1
            { name: "woodbox3", position: {x: -7.3, y: 0.5, z: -6} },
        ],

        optionalObjects: [
            {
                itemId: randNum(0,9999).toString(),
                name: "roomdoor",
                position: {x: 0, y: 0, z: -8.5}, // south wall now at z:-8 (height:16 → halfH:8)
                scale: null,
                rotation: 0,
                glbPath: "./models/indors/door.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
            {
                itemId: randNum(0,9999).toString(),
                name: "guildmasterdesk",
                position: {x: 0, y: 0, z: 3},
                scale: null,
                rotation: Math.PI,
                glbPath: "./models/indors/guildDesk.glb",
                diffuseTexPath: "./images/modeltex/wood2.jpg",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
            {
                itemId: randNum(0,9999).toString(),
                name: "guildmasterchair",
                position: {x: 0, y: 0, z: 3.7},
                scale: null,
                rotation: 0,
                glbPath: "./models/indors/tavChair.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
            {
                itemId: randNum(0,9999).toString(),
                name: "officescroll",
                position: {x: 0.9, y: 0.9, z: 3},
                scale: null,
                rotation: Math.PI/2,
                glbPath: "./models/indors/scroll.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
            {
                itemId: randNum(0,9999).toString(),
                name: "officeshelvesleft",
                position: {x: -6, y: 0, z: 7.3},
                scale: null,
                rotation: Math.PI,
                glbPath: "./models/indors/shelves.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
            {
                itemId: randNum(0,9999).toString(),
                name: "officeshelvesright",
                position: {x: 6, y: 0, z: 7.3},
                scale: null,
                rotation: Math.PI,
                glbPath: "./models/indors/shelves.glb",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
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
            fogDensity: 0,
            fogColor:{ r:0.05, g:0.15, b:0.1},

            lights: [
                {name:"directional", intensity: 0.9},
                // {name:"hemispheric", intensity: 0.1},
            ],
        },
        isMultiplayer: false
    },
    {
        placeId: 200,
        name: "Dueling Grounds",
        areaType: "duel",
        npcEnemies: [
            {
                npcId: "112_renarden",
                // flanking left/right on the opponents' side of the arena
                // (placeId 200's own player spawn is {x:0,z:-20}) instead of
                // both stacking on duelSystem.js's single OPPONENT_SPAWN
                // default - same side-by-side pairing convention already used
                // elsewhere in this project (e.g. the guildmaster's office
                // shelves/woodboxes)
                position: {x: -6, y: 0.01, z: 20},
                assistants: [
                    {
                        npcId: "113_robin",
                        position: {x: 6, y: 0.01, z: 20}
                    }
                ]
            }
        ],
        width: 50,
        height: 50,
        wallHeight: 0.5,
        layout: { cellSize: 1 },
        spawn: {x: 0, y: 0.4, z: -20, rotation: 0},
        exitPlaceDetail: {
            placeId: 1,
            name: "village",
            areaType: "village",
        },
        sceneTemp: {
            fogDensity: 0,
            fogColor:{ r:0.05, g:0.15, b:0.1},

            lights: [
                {name:"directional", intensity: 0.9},
                {name:"hemispheric", intensity: 0.6},
            ],
        },
        swordsStrucked: [
            {
                lootPosition: {x: 0, y: 0.2, z: 1},
                itemId: randomNum(), // should be string also in client
                name: "frostbite", // is also the image name
                dn: "Frost Bite",
                itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
                itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
                weaponType: "sword",
                equipAbilities: { 
                    dmg: 20, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
                }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
                // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
                consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 10, plusSpd: 1, }, //for buffs foods potions
                equiped: false,
                soulFeed: 0,
                isEnhanceAble: true, // only for equipable items
                enhancedLevel: 0,
                slots: [],// { name, dn, equipAbilities } cores
                durability: { current: 100, max: 100},
                price: { coinType: "bronze", pieces: 10 },
                qnty: 1,
                desc: "Frost Bite, A deadly Blade. It's blade is sharp as frozen blade",
                rarity: "rare",
            
                parts: {
                    bladeRarity: "rare1",
                    guardRarity: "rare1",
                    handleRarity: "common1",
                    pommelRarity: "common1",
            
                    bladeColor: "iron",
                    guardColor: "sodalite", // bluegranite, Steel, iron, bronze (practical/common)
                    handleColor: "wood", // bone,
                    pommelColor: "firecrystal", // frostshard, stormcrystal,beastheart
                }
            }
        ],

        isMultiplayer: false
    },


    // openworld
    {
        // "Travel Wagon" removed - it was leftover from copy-pasting this area's
        // structure from another placeDetail, hardcoded at y:0 which only made
        // sense on the old flat village ground, not procedural terrain height.
        optionalObjects: [
            {
                itemId: randNum(0,9999).toString(),
                name: "Travel Wagon",
                position: {x: 0, y: 2, z: 500},
                scale: null,
                rotation:Math.PI/2 + 0.5,
                glbPath: "./models/outdors/wagon.glb",
                diffuseTexPath:null,
                // bumpTexPath: "./images/textures/houses/guild1.jpg",
                physics: {
                    opt: {mass: 0},
                    type: "box"
                },
                functionBeforeMerge: null
            },
        ],
        roomPaths: [
            {
                placeId: 1,
                name: "Village",
                areaType: "village",
                pos: {x: 1.5, y: 3, z: 502},
                startingPos: {x: 11, y: 1.75, z: -6}
            },
            {
                placeId: 1,
                name: "Village",
                areaType: "village",
                pos: {x: -1.5, y: 3, z: 497},
                startingPos: {x: 11, y: 1.75, z: -6}
            },

            {
                placeId: 12,
                name: "Dungeon",
                areaType: "dungeon",
                pos: {x: -1.5, y: 3, z: 510}
            },
        ],
        resources: [
            // {
            //     resourceId: randNum(0,9999).toString(),
            //     resourceType: "ore", // procedurally generated, see createOre() in createRock.js
            //     name: "ore",
            //     position: {x: 3, y: 0, z: -5},
            //     scale: null,
            //     rotation: 0,
            //     loots: [
            //         {name: "ore", chance: 0.4},
            //         {name: "crystal", chance: 0.2},
            //         {name: "adamantine", chance: 0.4},
            //     ],
            //     physics: {
            //         opt: {mass: 0},
            //         type: "box"
            //     }
            // }
        ],

        ...generateArea({
        placeId: 888,
        areaType: "openworld",
        width:      300,
        height:     300,
        seed: 12365,
        totalBigHouse: 4,
        totalSmallHouse : 3,
        totalMediumHouse: 0,
        totalBigTrees: 5,
        totalMediumTrees: 10,
        totalSmallTrees: 100,
        totalRocks: 500,
        totalGrass: 10000,
        totalBushes: 5000,
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
            fogDensity: 0.0055, // thicker than open-sky haze — swamp air is heavy/humid
            fogColor:{ r:0.38, g:0.45, b:0.3 }, // murky olive-green mist, same hue family as the grass instead of fighting it
            skyColor:{ r:0.15, g:0.19, b:0.15 }, // dark overcast green-gray — swamp canopy/cloud cover, not open sky

            lights: [
                {name:"directional", intensity: 0.55, color:{ r:0.75, g:0.8, b:0.55 }, direction:{x:-0.6, y:-0.5, z:-0.4}}, // pale sickly green-yellow light filtering down through canopy, steeper angle than a horizon sun
                {name:"hemispheric", intensity: 0.5, color:{ r:0.3, g:0.38, b:0.28 }}, // green ambient fill, moderate so it doesn't flatten everything
            ],
        },
        isMultiplayer: true
        }),
        spawn: {x: 0.6, y: 10, z: 500},
    },
];
