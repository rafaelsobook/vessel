// The guild hall (placeId 9) and the rooms off it: your own room up its
// stairs (placeId 10 - where a new character starts) and the Guildmaster's
// Office (placeId 101) under its gallery.
import { ActionManager, MeshBuilder } from '@babylonjs/core';
import { getCharState, setCanPress, setCharStateMode, setQuestCompleted } from '../../charactersystem/characterstate.js';
import { onIntersecEnterTrig, onIntersecExitTrig } from '../../components/actionManager.js';
import { getSceneDet } from '../../main/main.js';
import { getIsSocketOn, getPlayersOnScene } from '../../sockets/worldsocket.js';
import { randNum } from '../../tools/random.js';
import { openCloseInteractBtn } from '../../tools/popupUI.js';
import { playAnim } from '../../tools/animation.js';
import { disableEnableAttackButtonsContainer } from '../../charactersystem/uimanagement.js';
import { faceForward } from '../../controllers/inputMovement.js';
import { createMagicCircle } from '../../creations/magiccircles.js';
import { getAllSounds } from '../../components/soundSystem.js';
import { getSocket } from '../../sockets/joinsocket.js';
import { emitSpawnCircle } from '../../sockets/emits.js';

export const STARTING_ROOM = {
    // the starting room - your own room up the guild hall's stairs. A
    // small timber hall of its own (creations/roomHall.js): the bed's up
    // on a loft along the north wall, reached by stairs up the east wall;
    // fireplace, table and benches below. {x:0, z:-2} - where a new
    // character is saved as standing (server/routes/characterR.js) -
    // stays open floor.
    placeId: 10,
    name: 'Simple Room',
    width: 14, // ground width
    height: 14, // ground height
    wallHeight: 7.5,
    wallTexPath: "./images/modeltex/wood3.jpg",
    // wood3 is horizontal boards, ~2.7 units of them per repeat
    wallTexScale: { uScale: 0.37, vScale: 2.8 },
    areaType: "room",
    layout: { cellSize: 1 },
    spawn: {x: 0, y: 1, z: -2, rotation: 0},
    gallery: { height: 3.5, depth: 4.5, stairs: "east" },
    wallTorches: [
        { wall: "s", along: -3.5, y: 2.4 },
        { wall: "s", along: 3.5, y: 2.4 },
        { wall: "w", along: -4.5, y: 2.4 },
        { wall: "w", along: 1.8, y: 2.4 },
        { wall: "e", along: -5.2, y: 2.4 },
        // up on the loft
        { wall: "n", along: -2, y: 5.6 },
        { wall: "n", along: 3, y: 5.6 },
    ],
    paintedPlanes: [
        {
            name: "roomrug",
            texturePath: "./images/modeltex/decor1.jpg",
            position: {x: -0.5, y: 0.016, z: -2},
            width: 3,
            height: 4.5,
        }
    ],
    woodboxes: [
        // under the loft, north-west corner
        { name: "roomcrate1", position: {x: -6.2, y: 0.5, z: 6.1} },
        { name: "roomcrate2", position: {x: -6.2, y: 1.5, z: 6.1} },
        { name: "roomcrate3", position: {x: -5.1, y: 0.5, z: 6.1} },
        // up on the loft, by the bed
        { name: "roomcrate4", position: {x: -6.2, y: 4, z: 3.2} },
    ],
    tables: {
        mainGlbpath: "./models/indors/tavernTable.glb",
        locations: [
            { pos: {x: -3.2, y: 0, z: -3.6}, rotationY: 0 },
        ]
    },
    chairs: {
        mainGlbpath: "./models/indors/tavChair.glb",
        locations: [
            { pos: {x: -3.2, y: 0, z: -4.4}, rotationY: 0 },
            { pos: {x: -3.2, y: 0, z: -2.8}, rotationY: 0 },
        ]
    },
    optionalObjects: [
        {
            itemId: randNum(0,9999).toString(),
            name: "roomdoor",
            // set into the south wall (inner face -6.85), proud enough
            // that the exit trigger in front of it stays reachable
            position: {x: 0, y: 0, z: -6.6},
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
            // on the loft (its floor is at y 3.5)
            position: {x: -4.6, y: 3.5, z: 4.7},
            scale: null,
            rotation: 0,
            glbPath: "./models/beds/bed1.glb",
            physics: {
                opt: {mass: 0},
                type: "box"
            },
            // you can sleep in it (charactersystem/seating.js addBedSeat). The
            // bed lies along its own z with the pillow at +z, so the sleeper
            // does too (yawOffset 0). height: the blanket's top (0.47 at the
            // vertices, a little more between them - lower, and they sink into
            // it). bodyCentre negative: the body is slid 0.45 toward the pillow,
            // so the head lies on it.
            seat: { height: 0.6, bodyCentre: -0.25, radius: 2.2, yawOffset: 0 },
            functionBeforeMerge: null
        },
        {
            itemId: randNum(1000,9999).toString(),
            name: "table",
            position: {x: -1, y: 3.5, z: 5.8},
            scale: null,
            rotation: 0,
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
            position: {x: 0.6, y: 4.4, z: 5.8},
            scale: null,
            rotation: Math.PI / 2,
            glbPath: "./models/indors/book1.glb",
            
        },
        {
            itemId: randNum(1000,9999).toString(),
            name: "fireplace",
            // against the west wall, its opening facing into the room
            // (east) - checked in a render, 0/±PI/2 show its back or sides
            position: {x: -6.2, y: 0, z: -1.3},
            scale: null,
            rotation: Math.PI,
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
            position: {x: -6.2, y: 0, z: -1.3},
            scale: null,
            rotation:0,
            glbPath: null,
            physics: null,
            functionBeforeMerge: null, // this table has a transform node we don't need, so dispose it before merging

        }
    ],
    roomPaths: [
        {
            // the door in the south wall ("roomdoor" above), out onto
            // the guild hall's gallery in front of the door back in
            // (that door's own trigger reaches z 7.9 - this stays clear)
            placeId: 9,
            name: "guild house",
            areaType: "room",
            pos: {x: 0, y: 0.5, z: -6},
            startingPos: {x: 6, y: 3.6, z: 7.2},
            doorSound: true,
        },
    ],
    sceneTemp: {
        // was 0.1 in a room half this size - here that hides the far wall
        fogDensity: 0.03,
        fogColor:{ r:0.05, g:0.15, b:0.1},

        lights: [
            {name:"directional", intensity: 0.9},
            // {name:"hemispheric", intensity: 0.1},
        ],
    },
    isMultiplayer: false
}

export const GUILD_HALL = {
    placeId: 9, // Guild House
    // A timber hall (creations/roomHall.js): a gallery along the north
    // wall, stairs up the east wall to it. Grown from 16x13 around the
    // same middle - every NPC (npcDetails.js, all within ~6 of the
    // centre), the desk, board and crystal keep their spots; only the
    // walls and doors moved out.
    name: 'Guild House',
    width: 24, // ground width
    height: 20, // ground height
    wallHeight: 8,
    wallTexPath: "./images/modeltex/wood3.jpg",
    wallTexScale: { uScale: 0.37, vScale: 3 },
    areaType: "room",
    layout: { cellSize: 1 },
    spawn: {x: 4.4, y: 0.4, z: 2.5, rotation: 0},
    gallery: { height: 3.5, depth: 4, stairs: "east" },
    wallTorches: [
        // either side of the front gate
        { wall: "s", along: -3.2, y: 2.6 },
        { wall: "s", along: 3.2, y: 2.6 },
        { wall: "w", along: -6, y: 2.6 },
        { wall: "w", along: 0.5, y: 2.6 },
        { wall: "e", along: -6, y: 2.6 },
        // under the gallery
        { wall: "n", along: -8.5, y: 2.1 },
        { wall: "n", along: 1, y: 2.1 },
        // up on the gallery
        { wall: "n", along: -6, y: 5.8 },
        { wall: "n", along: 2, y: 5.8 },
        { wall: "n", along: 9.5, y: 5.8 },
    ],
    paintedPlanes: [
        {
            // the walk in from the gate to the desk
            name: "guildrug",
            texturePath: "./images/modeltex/decor1.jpg",
            position: {x: 0, y: 0.016, z: -3.6},
            width: 3,
            height: 10,
        }
    ],
    woodboxes: [
        { name: "guildcrate1", position: {x: -11.2, y: 0.5, z: 9.1} },
        { name: "guildcrate2", position: {x: -11.2, y: 1.5, z: 9.1} },
        { name: "guildcrate3", position: {x: -10.1, y: 0.5, z: 9.1} },
        { name: "guildcrate4", position: {x: 11.2, y: 0.5, z: -9.1} },
        { name: "guildcrate5", position: {x: -11.2, y: 4, z: 9.1} },
    ],
    // the hall's tables, west side - benches either side of each
    tables: {
        mainGlbpath: "./models/indors/tavernTable.glb",
        locations: [
            { pos: {x: -9, y: 0, z: -6.5}, rotationY: Math.PI/2 },
            { pos: {x: -9, y: 0, z: -2}, rotationY: Math.PI/2 },
            // up on the gallery
            { pos: {x: -2, y: 3.5, z: 8}, rotationY: 0 },
        ]
    },
    chairs: {
        mainGlbpath: "./models/indors/tavChair.glb",
        locations: [
            { pos: {x: -9.8, y: 0, z: -6.5}, rotationY: Math.PI/2 },
            { pos: {x: -8.2, y: 0, z: -6.5}, rotationY: Math.PI/2 },
            { pos: {x: -9.8, y: 0, z: -2}, rotationY: Math.PI/2 },
            { pos: {x: -8.2, y: 0, z: -2}, rotationY: Math.PI/2 },
            { pos: {x: -2, y: 3.5, z: 7.2}, rotationY: 0 },
            { pos: {x: -2, y: 3.5, z: 8.8}, rotationY: 0 },
        ]
    },
    roomPaths: [
        // your room - up the stairs, on the gallery (its floor is y 3.5,
        // so the trigger box (size 2) is centred 0.5 above it, out of
        // reach from the floor below)
        {
            placeId: 10,
            name: "room",
            areaType: "room",
            pos: {x: 6, y: 4, z: 8.9},
            // just inside your room's door, clear of its exit trigger
            // (z -7..-5)
            startingPos: {x: 0, y: 0.2, z: -4.5},
            doorSound: true,
        },
        {
            placeId: 101,
            name: "Guildmaster's Office",
            areaType: "room",
            pos: {x: -4, y: 0.5, z: 8.9},
            // just inside the office's door, clear of its exit trigger
            // (z -8..-6) and of its desk further north
            startingPos: {x: 0, y: 1, z: -3},
            doorSound: true,
        },
        // the front gate ("guildgate" below) - out to the village, where
        // you arrive at its spawn
        {
            placeId: 1,
            name: "village",
            areaType: "village",
            pos: {x: 0, y: 0.5, z: -9},
            doorSound: true,
        },
    ],
    optionalObjects: [
        {
            // your room's door - up on the gallery
            itemId: randNum(0,9999).toString(),
            name: "roomdoor",
            position: {x: 6, y: 3.5, z: 9.65},
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
            // the Guildmaster's Office - ground floor, under the gallery
            itemId: randNum(0,9999).toString(),
            name: "roomdoor",
            position: {x: -4, y: 0, z: 9.65},
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
            // half into the south wall (centred on its line, z -10),
            // its face 0.2 proud - its roomPaths trigger above
            // (z -10..-8) reaches past where you stop against it
            position: {x: 0, y: 0, z: -10},
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
                    const touchCrystalQuest = charState.quests.find(qst => qst.qName === "touchTheCrystal")
                    if(!touchCrystalQuest) return 
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
                            if(!isQuestExist) return 
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
    sceneTemp: {
        fogDensity: 0,
        fogColor:{ r:0.05, g:0.15, b:0.1},

        lights: [
            // {name:"directional", intensity: 0.9},
            // was 0.8 - the torches carry the warm light now
            {name:"hemispheric", intensity: 0.6},
        ],
    },
    isMultiplayer: true
}

export const GUILDMASTER_OFFICE = {
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
            // just inside the south wall (inner face -7.85) - it used to
            // sit at -8.5, behind the wall, where it couldn't be seen
            position: {x: 0, y: 0, z: -7.65},
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
    roomPaths: [
        {
            // the door in the south wall ("roomdoor" above), back out to
            // the guild hall in front of this office's door there (that
            // door's own trigger reaches z 7.9 - this stays clear)
            placeId: 9,
            name: "guild house",
            areaType: "room",
            pos: {x: 0, y: 0.5, z: -7},
            startingPos: {x: -4, y: 0.4, z: 7.3},
            doorSound: true,
        },
    ],
    sceneTemp: {
        fogDensity: 0,
        fogColor:{ r:0.05, g:0.15, b:0.1},

        lights: [
            {name:"directional", intensity: 0.9},
            // {name:"hemispheric", intensity: 0.1},
        ],
    },
    isMultiplayer: false
}
