// The duel arenas (areaType "duel") - one per challenger roster.
import { randomNum } from '../../tools/tools.js';

export const DUELING_GROUNDS = {
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
    // through the gate in the middle of the south wall (z -25) - the gate
    // itself is part of the arena (createduelarena.js), this is the trigger
    // in front of it. Also how duelSystem.js sends you out after the fight.
    // You arrive at the destination's spawn.
    roomPaths: [
        {
            placeId: 1,
            name: "village",
            areaType: "village",
            pos: {x: 0, y: 0.5, z: -24},
            // no door to creak - the gate stands open, portcullis up
        },
    ],
    // night - createduelarena.js puts the moon where this directional light
    // shines from, and builds the sky and the fires around it
    sceneTemp: {
        fogDensity: 0,
        fogColor:{ r:0.03, g:0.045, b:0.09},
        skyColor:{ r:0.01, g:0.015, b:0.035},

        lights: [
            {name:"directional", intensity: 0.9, color:{ r:0.62, g:0.72, b:1 }, direction:{ x:-0.35, y:-0.6, z:-0.72 }},
            {name:"hemispheric", intensity: 0.5},
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
}

export const COLOUSA_DUELING_GROUNDS = {
    // Colousa's own dueling grounds - a SEPARATE arena from placeId 200
    // above (Renarden's), not a reuse of it. duelSystem.js's startDuel
    // reads WHO to fight straight off THIS place's own static
    // npcEnemies list (placeDetail.npcEnemies) - there's no
    // per-challenger parameter threaded through the travel/teleport
    // call, so one arena can only ever hold one fixed roster. Colousa's
    // own "meet-colousa" quest (npcDetails.js, "114_colousa"'s
    // cbAfterNotCompletedSpeech) travels here specifically instead of
    // placeId 200.
    placeId: 201,
    name: "Colousa's Dueling Grounds",
    areaType: "duel",
    npcEnemies: [
        {
            npcId: "114_colousa",
            position: {x: 0, y: 0.01, z: 20}, // duelSystem.js's own OPPONENT_SPAWN default, spelled out for consistency with placeId 200's own entries
        }
    ],
    width: 50,
    height: 50,
    wallHeight: 0.5,
    layout: { cellSize: 1 },
    spawn: {x: 0, y: 0.4, z: -20, rotation: 0},
    // through the gate in the middle of the south wall (z -25) - the gate
    // itself is part of the arena (createduelarena.js), this is the trigger
    // in front of it. Also how duelSystem.js sends you out after the fight.
    // You arrive at the destination's spawn.
    roomPaths: [
        {
            placeId: 1,
            name: "village",
            areaType: "village",
            pos: {x: 0, y: 0.5, z: -24},
            // no door to creak - the gate stands open, portcullis up
        },
    ],
    // night - createduelarena.js puts the moon where this directional light
    // shines from, and builds the sky and the fires around it
    sceneTemp: {
        fogDensity: 0,
        fogColor:{ r:0.03, g:0.045, b:0.09},
        skyColor:{ r:0.01, g:0.015, b:0.035},

        lights: [
            {name:"directional", intensity: 0.9, color:{ r:0.62, g:0.72, b:1 }, direction:{ x:-0.35, y:-0.6, z:-0.72 }},
            {name:"hemispheric", intensity: 0.5},
        ],
    },
    isMultiplayer: false
}

export const VESPER_DUELING_GROUNDS = {
    // Vesper's own dueling grounds - same one-arena-one-roster
    // limitation placeId 201 (Colousa's) already documents, just for
    // her instead. Its door (roomPaths) sends the player back into placeId
    // 15 (the Witch House interior, where the challenge was actually
    // issued) rather than the village - the fight started at her own
    // front door, not back in town.
    placeId: 202,
    name: "Vesper's Dueling Grounds",
    areaType: "duel",
    npcEnemies: [
        {
            npcId: "117_vesper",
            position: {x: 0, y: 0.01, z: 20},
        }
    ],
    width: 50,
    height: 50,
    wallHeight: 0.5,
    layout: { cellSize: 1 },
    spawn: {x: 0, y: 0.4, z: -20, rotation: 0},
    // through the gate in the middle of the south wall (z -25) - the gate
    // itself is part of the arena (createduelarena.js), this is the trigger
    // in front of it. Also how duelSystem.js sends you out after the fight.
    // You arrive at the destination's spawn.
    roomPaths: [
        {
            placeId: 15,
            name: "Witch House",
            areaType: "room",
            pos: {x: 0, y: 0.5, z: -24},
            // no door to creak - the gate stands open, portcullis up
        },
    ],
    // night under a violet moon
    sceneTemp: {
        fogDensity: 0,
        fogColor:{ r:0.06, g:0.03, b:0.1},
        skyColor:{ r:0.02, g:0.01, b:0.04},

        lights: [
            {name:"directional", intensity: 0.9, color:{ r:0.78, g:0.62, b:1 }, direction:{ x:-0.35, y:-0.6, z:-0.72 }},
            {name:"hemispheric", intensity: 0.5},
        ],
    },
    // a witch's arena - the forest has taken it back (createduelarena.js's
    // THEMES: "colosseum", the default, or "forest"), her banners in her own
    // colours. Just theme: "forest" keeps the forest's own green.
    theme: { name: "forest", banner: "#3e1460", trim: "#c7c9d6" },
    isMultiplayer: false
}
