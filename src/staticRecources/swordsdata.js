import { randomNum } from "../tools/tools.js"

// Every sword whose parts all share ONE rarity tier - a "common" sword uses
// only common-tier part meshes, a "rare" sword uses only rare-tier part
// meshes (never mixed), so a sword's overall rarity always matches what
// every one of its parts actually looks like. Available part meshes: blade
// common1/rare1/rare2, guard common1/common2/rare1/rare2, handle
// common1/common2/rare1, pommel common1/common2/rare1 - blade and handle/
// pommel each only have one rare-tier mesh, which caps this at 8 common +
// 4 rare = 12 swords total. Material colors (bladeColor etc.) are resolved
// to real colors in tools/weaponmat.js.
export const swordsData = [
    {
        itemId: randomNum(), // should be string also in client
        name: "frostmarkblade",
        dn: "Frostmark Blade",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 14, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 8 },
        qnty: 1,
        desc: "Frostmark Blade, a common blade forged with a sodalite guard, a wood grip, and a firecrystal pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "common1",
            handleRarity: "common1",
            pommelRarity: "common1",

            bladeColor: "iron",
            guardColor: "sodalite",
            handleColor: "wood",
            pommelColor: "firecrystal",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "emberfallblade",
        dn: "Emberfall Blade",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 14, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 8 },
        qnty: 1,
        desc: "Emberfall Blade, a common blade forged with a bronze guard, a leather grip, and a firecrystal pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "common1",
            handleRarity: "common1",
            pommelRarity: "common2",

            bladeColor: "steel",
            guardColor: "bronze",
            handleColor: "leather",
            pommelColor: "firecrystal",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "winterlaceblade",
        dn: "Winterlace Blade",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 14, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 8 },
        qnty: 1,
        desc: "Winterlace Blade, a common blade forged with a silver guard, a bone grip, and a frostshard pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "common1",
            handleRarity: "common2",
            pommelRarity: "common1",

            bladeColor: "silver",
            guardColor: "silver",
            handleColor: "bone",
            pommelColor: "frostshard",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "stoneguardblade",
        dn: "Stoneguard Blade",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 14, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 8 },
        qnty: 1,
        desc: "Stoneguard Blade, a common blade forged with a bluegranite guard, a leather grip, and a bronze pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "common1",
            handleRarity: "common2",
            pommelRarity: "common2",

            bladeColor: "steel",
            guardColor: "bluegranite",
            handleColor: "leather",
            pommelColor: "bronze",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "highsteelblade",
        dn: "Highsteel Blade",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 14, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 8 },
        qnty: 1,
        desc: "Highsteel Blade, a common blade forged with a steel guard, a leather grip, and a silver pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "common2",
            handleRarity: "common1",
            pommelRarity: "common1",

            bladeColor: "mythril",
            guardColor: "steel",
            handleColor: "leather",
            pommelColor: "silver",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "ashenboneblade",
        dn: "Ashenbone Blade",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 14, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 8 },
        qnty: 1,
        desc: "Ashenbone Blade, a common blade forged with a iron guard, a bone grip, and a beastheart pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "common2",
            handleRarity: "common1",
            pommelRarity: "common2",

            bladeColor: "bronze",
            guardColor: "iron",
            handleColor: "bone",
            pommelColor: "beastheart",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "deepstoneblade",
        dn: "Deepstone Blade",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 14, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 8 },
        qnty: 1,
        desc: "Deepstone Blade, a common blade forged with a bluegranite guard, a leather grip, and a iron pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "common2",
            handleRarity: "common2",
            pommelRarity: "common1",

            bladeColor: "adamantine",
            guardColor: "bluegranite",
            handleColor: "leather",
            pommelColor: "iron",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "bloodfangblade",
        dn: "Bloodfang Blade",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 14, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 8 },
        qnty: 1,
        desc: "Bloodfang Blade, a common blade forged with a bronze guard, a leather grip, and a beastheart pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "common2",
            handleRarity: "common2",
            pommelRarity: "common2",

            bladeColor: "iron",
            guardColor: "bronze",
            handleColor: "leather",
            pommelColor: "beastheart",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "stormcalleredge",
        dn: "Stormcaller Edge",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 23, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 17 },
        qnty: 1,
        desc: "Stormcaller Edge, a rare blade forged with a silver guard, a wood grip, and a stormcrystal pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "rare1",
            handleRarity: "rare1",
            pommelRarity: "rare1",

            bladeColor: "mythril",
            guardColor: "silver",
            handleColor: "wood",
            pommelColor: "stormcrystal",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "voidboundedge",
        dn: "Voidbound Edge",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 23, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 17 },
        qnty: 1,
        desc: "Voidbound Edge, a rare blade forged with a adamantine guard, a leather grip, and a stormcrystal pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "rare2",
            handleRarity: "rare1",
            pommelRarity: "rare1",

            bladeColor: "adamantine",
            guardColor: "adamantine",
            handleColor: "leather",
            pommelColor: "stormcrystal",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "glacierbornfang",
        dn: "Glacierborn Fang",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 27, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 21 },
        qnty: 1,
        desc: "Glacierborn Fang, a rare blade forged with a silver guard, a bone grip, and a frostshard pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "rare1",
            handleRarity: "rare1",
            pommelRarity: "rare1",

            bladeColor: "mythril",
            guardColor: "silver",
            handleColor: "bone",
            pommelColor: "frostshard",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "sunforgedfang",
        dn: "Sunforged Fang",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 27, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 21 },
        qnty: 1,
        desc: "Sunforged Fang, a rare blade forged with a gold guard, a wood grip, and a firecrystal pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "rare2",
            handleRarity: "rare1",
            pommelRarity: "rare1",

            bladeColor: "silver",
            guardColor: "gold",
            handleColor: "wood",
            pommelColor: "firecrystal",
        }
    }
]
