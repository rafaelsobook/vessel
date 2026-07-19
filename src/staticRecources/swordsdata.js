import { randomNum } from "../tools/tools.js"

// Full catalog of every valid blade x guard x handle x pommel combination
// from the sword part meshes (see the Blender part-mesh collection: blade
// common1/rare1/rare2, guard common1/common2/rare1/rare2, handle
// common1/common2/rare1, pommel common1/common2/rare1 - 3x4x3x3 = 108 swords).
// Material colors (bladeColor etc.) are resolved to real colors in
// tools/weaponmat.js. Overall item rarity tracks the blade's tier since
// the blade is a sword's defining part, matching the frostbite reference item.
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
        desc: "Emberfall Blade, a common blade forged with a firecrystal guard, a leather grip, and a gold pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "common1",
            handleRarity: "common1",
            pommelRarity: "common2",

            bladeColor: "steel",
            guardColor: "firecrystal",
            handleColor: "leather",
            pommelColor: "gold",
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
        price: { coinType: "bronze", pieces: 9 },
        qnty: 1,
        desc: "Winterlace Blade, a common blade forged with a frostshard guard, a bone grip, and a frostshard pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "common1",
            handleRarity: "common1",
            pommelRarity: "rare1",

            bladeColor: "silver",
            guardColor: "frostshard",
            handleColor: "bone",
            pommelColor: "frostshard",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "stormcallerblade",
        dn: "Stormcaller Blade",
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
        desc: "Stormcaller Blade, a common blade forged with a stormcrystal guard, a wood grip, and a stormcrystal pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "common1",
            handleRarity: "common2",
            pommelRarity: "common1",

            bladeColor: "mythril",
            guardColor: "stormcrystal",
            handleColor: "wood",
            pommelColor: "stormcrystal",
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

            bladeColor: "iron",
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
        price: { coinType: "bronze", pieces: 9 },
        qnty: 1,
        desc: "Highsteel Blade, a common blade forged with a steel guard, a leather grip, and a silver pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "common1",
            handleRarity: "common2",
            pommelRarity: "rare1",

            bladeColor: "steel",
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
        price: { coinType: "bronze", pieces: 9 },
        qnty: 1,
        desc: "Ashenbone Blade, a common blade forged with a bone guard, a bone grip, and a beastheart pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "common1",
            handleRarity: "rare1",
            pommelRarity: "common1",

            bladeColor: "bronze",
            guardColor: "bone",
            handleColor: "bone",
            pommelColor: "beastheart",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "voidboundblade",
        dn: "Voidbound Blade",
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
        price: { coinType: "bronze", pieces: 9 },
        qnty: 1,
        desc: "Voidbound Blade, a common blade forged with a stormcrystal guard, a leather grip, and a stormcrystal pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "common1",
            handleRarity: "rare1",
            pommelRarity: "common2",

            bladeColor: "adamantine",
            guardColor: "stormcrystal",
            handleColor: "leather",
            pommelColor: "stormcrystal",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "sunforgedblade",
        dn: "Sunforged Blade",
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
        price: { coinType: "bronze", pieces: 10 },
        qnty: 1,
        desc: "Sunforged Blade, a common blade forged with a firecrystal guard, a wood grip, and a gold pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "common1",
            handleRarity: "rare1",
            pommelRarity: "rare1",

            bladeColor: "gold",
            guardColor: "firecrystal",
            handleColor: "wood",
            pommelColor: "gold",
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
            handleRarity: "common1",
            pommelRarity: "common1",

            bladeColor: "bluegranite",
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
        desc: "Bloodfang Blade, a common blade forged with a beastheart guard, a leather grip, and a beastheart pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "common2",
            handleRarity: "common1",
            pommelRarity: "common2",

            bladeColor: "iron",
            guardColor: "beastheart",
            handleColor: "leather",
            pommelColor: "beastheart",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "glacierbornblade",
        dn: "Glacierborn Blade",
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
        price: { coinType: "bronze", pieces: 9 },
        qnty: 1,
        desc: "Glacierborn Blade, a common blade forged with a frostshard guard, a bone grip, and a silver pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "common2",
            handleRarity: "common1",
            pommelRarity: "rare1",

            bladeColor: "mythril",
            guardColor: "frostshard",
            handleColor: "bone",
            pommelColor: "silver",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "frostmarkbladeii",
        dn: "Frostmark Blade II",
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
        desc: "Frostmark Blade II, a common blade forged with a sodalite guard, a wood grip, and a firecrystal pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "common2",
            handleRarity: "common2",
            pommelRarity: "common1",

            bladeColor: "iron",
            guardColor: "sodalite",
            handleColor: "wood",
            pommelColor: "firecrystal",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "emberfallbladeii",
        dn: "Emberfall Blade II",
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
        desc: "Emberfall Blade II, a common blade forged with a firecrystal guard, a leather grip, and a gold pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "common2",
            handleRarity: "common2",
            pommelRarity: "common2",

            bladeColor: "steel",
            guardColor: "firecrystal",
            handleColor: "leather",
            pommelColor: "gold",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "winterlacebladeii",
        dn: "Winterlace Blade II",
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
        price: { coinType: "bronze", pieces: 9 },
        qnty: 1,
        desc: "Winterlace Blade II, a common blade forged with a frostshard guard, a bone grip, and a frostshard pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "common2",
            handleRarity: "common2",
            pommelRarity: "rare1",

            bladeColor: "silver",
            guardColor: "frostshard",
            handleColor: "bone",
            pommelColor: "frostshard",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "stormcallerbladeii",
        dn: "Stormcaller Blade II",
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
        price: { coinType: "bronze", pieces: 9 },
        qnty: 1,
        desc: "Stormcaller Blade II, a common blade forged with a stormcrystal guard, a wood grip, and a stormcrystal pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "common2",
            handleRarity: "rare1",
            pommelRarity: "common1",

            bladeColor: "mythril",
            guardColor: "stormcrystal",
            handleColor: "wood",
            pommelColor: "stormcrystal",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "stoneguardbladeii",
        dn: "Stoneguard Blade II",
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
        price: { coinType: "bronze", pieces: 9 },
        qnty: 1,
        desc: "Stoneguard Blade II, a common blade forged with a bluegranite guard, a leather grip, and a bronze pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "common2",
            handleRarity: "rare1",
            pommelRarity: "common2",

            bladeColor: "iron",
            guardColor: "bluegranite",
            handleColor: "leather",
            pommelColor: "bronze",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "highsteelbladeii",
        dn: "Highsteel Blade II",
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
        price: { coinType: "bronze", pieces: 10 },
        qnty: 1,
        desc: "Highsteel Blade II, a common blade forged with a steel guard, a leather grip, and a silver pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "common2",
            handleRarity: "rare1",
            pommelRarity: "rare1",

            bladeColor: "steel",
            guardColor: "steel",
            handleColor: "leather",
            pommelColor: "silver",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "ashenbonebladeii",
        dn: "Ashenbone Blade II",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 17, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 9 },
        qnty: 1,
        desc: "Ashenbone Blade II, a common blade forged with a bone guard, a bone grip, and a beastheart pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "rare1",
            handleRarity: "common1",
            pommelRarity: "common1",

            bladeColor: "bronze",
            guardColor: "bone",
            handleColor: "bone",
            pommelColor: "beastheart",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "voidboundbladeii",
        dn: "Voidbound Blade II",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 17, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 9 },
        qnty: 1,
        desc: "Voidbound Blade II, a common blade forged with a stormcrystal guard, a leather grip, and a stormcrystal pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "rare1",
            handleRarity: "common1",
            pommelRarity: "common2",

            bladeColor: "adamantine",
            guardColor: "stormcrystal",
            handleColor: "leather",
            pommelColor: "stormcrystal",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "sunforgedbladeii",
        dn: "Sunforged Blade II",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 17, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 10 },
        qnty: 1,
        desc: "Sunforged Blade II, a common blade forged with a firecrystal guard, a wood grip, and a gold pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "rare1",
            handleRarity: "common1",
            pommelRarity: "rare1",

            bladeColor: "gold",
            guardColor: "firecrystal",
            handleColor: "wood",
            pommelColor: "gold",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "deepstonebladeii",
        dn: "Deepstone Blade II",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 17, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 9 },
        qnty: 1,
        desc: "Deepstone Blade II, a common blade forged with a bluegranite guard, a leather grip, and a iron pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "rare1",
            handleRarity: "common2",
            pommelRarity: "common1",

            bladeColor: "bluegranite",
            guardColor: "bluegranite",
            handleColor: "leather",
            pommelColor: "iron",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "bloodfangbladeii",
        dn: "Bloodfang Blade II",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 17, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 9 },
        qnty: 1,
        desc: "Bloodfang Blade II, a common blade forged with a beastheart guard, a leather grip, and a beastheart pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "rare1",
            handleRarity: "common2",
            pommelRarity: "common2",

            bladeColor: "iron",
            guardColor: "beastheart",
            handleColor: "leather",
            pommelColor: "beastheart",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "glacierbornbladeii",
        dn: "Glacierborn Blade II",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 17, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 10 },
        qnty: 1,
        desc: "Glacierborn Blade II, a common blade forged with a frostshard guard, a bone grip, and a silver pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "rare1",
            handleRarity: "common2",
            pommelRarity: "rare1",

            bladeColor: "mythril",
            guardColor: "frostshard",
            handleColor: "bone",
            pommelColor: "silver",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "frostmarkbladeiii",
        dn: "Frostmark Blade III",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 17, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 10 },
        qnty: 1,
        desc: "Frostmark Blade III, a common blade forged with a sodalite guard, a wood grip, and a firecrystal pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "rare1",
            handleRarity: "rare1",
            pommelRarity: "common1",

            bladeColor: "iron",
            guardColor: "sodalite",
            handleColor: "wood",
            pommelColor: "firecrystal",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "emberfallbladeiii",
        dn: "Emberfall Blade III",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 17, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 10 },
        qnty: 1,
        desc: "Emberfall Blade III, a common blade forged with a firecrystal guard, a leather grip, and a gold pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "rare1",
            handleRarity: "rare1",
            pommelRarity: "common2",

            bladeColor: "steel",
            guardColor: "firecrystal",
            handleColor: "leather",
            pommelColor: "gold",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "winterlacebladeiii",
        dn: "Winterlace Blade III",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 17, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 11 },
        qnty: 1,
        desc: "Winterlace Blade III, a common blade forged with a frostshard guard, a bone grip, and a frostshard pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "rare1",
            handleRarity: "rare1",
            pommelRarity: "rare1",

            bladeColor: "silver",
            guardColor: "frostshard",
            handleColor: "bone",
            pommelColor: "frostshard",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "stormcallerbladeiii",
        dn: "Stormcaller Blade III",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 17, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 9 },
        qnty: 1,
        desc: "Stormcaller Blade III, a common blade forged with a stormcrystal guard, a wood grip, and a stormcrystal pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "rare2",
            handleRarity: "common1",
            pommelRarity: "common1",

            bladeColor: "mythril",
            guardColor: "stormcrystal",
            handleColor: "wood",
            pommelColor: "stormcrystal",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "stoneguardbladeiii",
        dn: "Stoneguard Blade III",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 17, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 9 },
        qnty: 1,
        desc: "Stoneguard Blade III, a common blade forged with a bluegranite guard, a leather grip, and a bronze pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "rare2",
            handleRarity: "common1",
            pommelRarity: "common2",

            bladeColor: "iron",
            guardColor: "bluegranite",
            handleColor: "leather",
            pommelColor: "bronze",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "highsteelbladeiii",
        dn: "Highsteel Blade III",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 17, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 10 },
        qnty: 1,
        desc: "Highsteel Blade III, a common blade forged with a steel guard, a leather grip, and a silver pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "rare2",
            handleRarity: "common1",
            pommelRarity: "rare1",

            bladeColor: "steel",
            guardColor: "steel",
            handleColor: "leather",
            pommelColor: "silver",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "ashenbonebladeiii",
        dn: "Ashenbone Blade III",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 17, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 9 },
        qnty: 1,
        desc: "Ashenbone Blade III, a common blade forged with a bone guard, a bone grip, and a beastheart pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "rare2",
            handleRarity: "common2",
            pommelRarity: "common1",

            bladeColor: "bronze",
            guardColor: "bone",
            handleColor: "bone",
            pommelColor: "beastheart",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "voidboundbladeiii",
        dn: "Voidbound Blade III",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 17, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 9 },
        qnty: 1,
        desc: "Voidbound Blade III, a common blade forged with a stormcrystal guard, a leather grip, and a stormcrystal pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "rare2",
            handleRarity: "common2",
            pommelRarity: "common2",

            bladeColor: "adamantine",
            guardColor: "stormcrystal",
            handleColor: "leather",
            pommelColor: "stormcrystal",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "sunforgedbladeiii",
        dn: "Sunforged Blade III",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 17, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 10 },
        qnty: 1,
        desc: "Sunforged Blade III, a common blade forged with a firecrystal guard, a wood grip, and a gold pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "rare2",
            handleRarity: "common2",
            pommelRarity: "rare1",

            bladeColor: "gold",
            guardColor: "firecrystal",
            handleColor: "wood",
            pommelColor: "gold",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "deepstonebladeiii",
        dn: "Deepstone Blade III",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 17, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 10 },
        qnty: 1,
        desc: "Deepstone Blade III, a common blade forged with a bluegranite guard, a leather grip, and a iron pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "rare2",
            handleRarity: "rare1",
            pommelRarity: "common1",

            bladeColor: "bluegranite",
            guardColor: "bluegranite",
            handleColor: "leather",
            pommelColor: "iron",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "bloodfangbladeiii",
        dn: "Bloodfang Blade III",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 17, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 10 },
        qnty: 1,
        desc: "Bloodfang Blade III, a common blade forged with a beastheart guard, a leather grip, and a beastheart pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "rare2",
            handleRarity: "rare1",
            pommelRarity: "common2",

            bladeColor: "iron",
            guardColor: "beastheart",
            handleColor: "leather",
            pommelColor: "beastheart",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "glacierbornbladeiii",
        dn: "Glacierborn Blade III",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 17, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 11 },
        qnty: 1,
        desc: "Glacierborn Blade III, a common blade forged with a frostshard guard, a bone grip, and a silver pommel.",
        rarity: "common",

        parts: {
            bladeRarity: "common1",
            guardRarity: "rare2",
            handleRarity: "rare1",
            pommelRarity: "rare1",

            bladeColor: "mythril",
            guardColor: "frostshard",
            handleColor: "bone",
            pommelColor: "silver",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "frostmarkedge",
        dn: "Frostmark Edge",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 20, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 14 },
        qnty: 1,
        desc: "Frostmark Edge, a rare blade forged with a sodalite guard, a wood grip, and a firecrystal pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
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
        name: "emberfalledge",
        dn: "Emberfall Edge",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 20, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 14 },
        qnty: 1,
        desc: "Emberfall Edge, a rare blade forged with a firecrystal guard, a leather grip, and a gold pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "common1",
            handleRarity: "common1",
            pommelRarity: "common2",

            bladeColor: "steel",
            guardColor: "firecrystal",
            handleColor: "leather",
            pommelColor: "gold",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "winterlaceedge",
        dn: "Winterlace Edge",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 20, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 15 },
        qnty: 1,
        desc: "Winterlace Edge, a rare blade forged with a frostshard guard, a bone grip, and a frostshard pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "common1",
            handleRarity: "common1",
            pommelRarity: "rare1",

            bladeColor: "silver",
            guardColor: "frostshard",
            handleColor: "bone",
            pommelColor: "frostshard",
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
            dmg: 20, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 14 },
        qnty: 1,
        desc: "Stormcaller Edge, a rare blade forged with a stormcrystal guard, a wood grip, and a stormcrystal pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "common1",
            handleRarity: "common2",
            pommelRarity: "common1",

            bladeColor: "mythril",
            guardColor: "stormcrystal",
            handleColor: "wood",
            pommelColor: "stormcrystal",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "stoneguardedge",
        dn: "Stoneguard Edge",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 20, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 14 },
        qnty: 1,
        desc: "Stoneguard Edge, a rare blade forged with a bluegranite guard, a leather grip, and a bronze pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "common1",
            handleRarity: "common2",
            pommelRarity: "common2",

            bladeColor: "iron",
            guardColor: "bluegranite",
            handleColor: "leather",
            pommelColor: "bronze",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "highsteeledge",
        dn: "Highsteel Edge",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 20, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 15 },
        qnty: 1,
        desc: "Highsteel Edge, a rare blade forged with a steel guard, a leather grip, and a silver pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "common1",
            handleRarity: "common2",
            pommelRarity: "rare1",

            bladeColor: "steel",
            guardColor: "steel",
            handleColor: "leather",
            pommelColor: "silver",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "ashenboneedge",
        dn: "Ashenbone Edge",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 20, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 15 },
        qnty: 1,
        desc: "Ashenbone Edge, a rare blade forged with a bone guard, a bone grip, and a beastheart pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "common1",
            handleRarity: "rare1",
            pommelRarity: "common1",

            bladeColor: "bronze",
            guardColor: "bone",
            handleColor: "bone",
            pommelColor: "beastheart",
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
            dmg: 20, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 15 },
        qnty: 1,
        desc: "Voidbound Edge, a rare blade forged with a stormcrystal guard, a leather grip, and a stormcrystal pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "common1",
            handleRarity: "rare1",
            pommelRarity: "common2",

            bladeColor: "adamantine",
            guardColor: "stormcrystal",
            handleColor: "leather",
            pommelColor: "stormcrystal",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "sunforgededge",
        dn: "Sunforged Edge",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 20, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 16 },
        qnty: 1,
        desc: "Sunforged Edge, a rare blade forged with a firecrystal guard, a wood grip, and a gold pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "common1",
            handleRarity: "rare1",
            pommelRarity: "rare1",

            bladeColor: "gold",
            guardColor: "firecrystal",
            handleColor: "wood",
            pommelColor: "gold",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "deepstoneedge",
        dn: "Deepstone Edge",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 20, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 14 },
        qnty: 1,
        desc: "Deepstone Edge, a rare blade forged with a bluegranite guard, a leather grip, and a iron pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "common2",
            handleRarity: "common1",
            pommelRarity: "common1",

            bladeColor: "bluegranite",
            guardColor: "bluegranite",
            handleColor: "leather",
            pommelColor: "iron",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "bloodfangedge",
        dn: "Bloodfang Edge",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 20, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 14 },
        qnty: 1,
        desc: "Bloodfang Edge, a rare blade forged with a beastheart guard, a leather grip, and a beastheart pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "common2",
            handleRarity: "common1",
            pommelRarity: "common2",

            bladeColor: "iron",
            guardColor: "beastheart",
            handleColor: "leather",
            pommelColor: "beastheart",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "glacierbornedge",
        dn: "Glacierborn Edge",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 20, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 15 },
        qnty: 1,
        desc: "Glacierborn Edge, a rare blade forged with a frostshard guard, a bone grip, and a silver pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "common2",
            handleRarity: "common1",
            pommelRarity: "rare1",

            bladeColor: "mythril",
            guardColor: "frostshard",
            handleColor: "bone",
            pommelColor: "silver",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "frostmarkedgeii",
        dn: "Frostmark Edge II",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 20, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 14 },
        qnty: 1,
        desc: "Frostmark Edge II, a rare blade forged with a sodalite guard, a wood grip, and a firecrystal pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "common2",
            handleRarity: "common2",
            pommelRarity: "common1",

            bladeColor: "iron",
            guardColor: "sodalite",
            handleColor: "wood",
            pommelColor: "firecrystal",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "emberfalledgeii",
        dn: "Emberfall Edge II",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 20, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 14 },
        qnty: 1,
        desc: "Emberfall Edge II, a rare blade forged with a firecrystal guard, a leather grip, and a gold pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "common2",
            handleRarity: "common2",
            pommelRarity: "common2",

            bladeColor: "steel",
            guardColor: "firecrystal",
            handleColor: "leather",
            pommelColor: "gold",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "winterlaceedgeii",
        dn: "Winterlace Edge II",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 20, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 15 },
        qnty: 1,
        desc: "Winterlace Edge II, a rare blade forged with a frostshard guard, a bone grip, and a frostshard pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "common2",
            handleRarity: "common2",
            pommelRarity: "rare1",

            bladeColor: "silver",
            guardColor: "frostshard",
            handleColor: "bone",
            pommelColor: "frostshard",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "stormcalleredgeii",
        dn: "Stormcaller Edge II",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 20, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 15 },
        qnty: 1,
        desc: "Stormcaller Edge II, a rare blade forged with a stormcrystal guard, a wood grip, and a stormcrystal pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "common2",
            handleRarity: "rare1",
            pommelRarity: "common1",

            bladeColor: "mythril",
            guardColor: "stormcrystal",
            handleColor: "wood",
            pommelColor: "stormcrystal",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "stoneguardedgeii",
        dn: "Stoneguard Edge II",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 20, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 15 },
        qnty: 1,
        desc: "Stoneguard Edge II, a rare blade forged with a bluegranite guard, a leather grip, and a bronze pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "common2",
            handleRarity: "rare1",
            pommelRarity: "common2",

            bladeColor: "iron",
            guardColor: "bluegranite",
            handleColor: "leather",
            pommelColor: "bronze",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "highsteeledgeii",
        dn: "Highsteel Edge II",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 20, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 16 },
        qnty: 1,
        desc: "Highsteel Edge II, a rare blade forged with a steel guard, a leather grip, and a silver pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "common2",
            handleRarity: "rare1",
            pommelRarity: "rare1",

            bladeColor: "steel",
            guardColor: "steel",
            handleColor: "leather",
            pommelColor: "silver",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "ashenboneedgeii",
        dn: "Ashenbone Edge II",
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
        price: { coinType: "bronze", pieces: 15 },
        qnty: 1,
        desc: "Ashenbone Edge II, a rare blade forged with a bone guard, a bone grip, and a beastheart pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "rare1",
            handleRarity: "common1",
            pommelRarity: "common1",

            bladeColor: "bronze",
            guardColor: "bone",
            handleColor: "bone",
            pommelColor: "beastheart",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "voidboundedgeii",
        dn: "Voidbound Edge II",
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
        price: { coinType: "bronze", pieces: 15 },
        qnty: 1,
        desc: "Voidbound Edge II, a rare blade forged with a stormcrystal guard, a leather grip, and a stormcrystal pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "rare1",
            handleRarity: "common1",
            pommelRarity: "common2",

            bladeColor: "adamantine",
            guardColor: "stormcrystal",
            handleColor: "leather",
            pommelColor: "stormcrystal",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "sunforgededgeii",
        dn: "Sunforged Edge II",
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
        price: { coinType: "bronze", pieces: 16 },
        qnty: 1,
        desc: "Sunforged Edge II, a rare blade forged with a firecrystal guard, a wood grip, and a gold pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "rare1",
            handleRarity: "common1",
            pommelRarity: "rare1",

            bladeColor: "gold",
            guardColor: "firecrystal",
            handleColor: "wood",
            pommelColor: "gold",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "deepstoneedgeii",
        dn: "Deepstone Edge II",
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
        price: { coinType: "bronze", pieces: 15 },
        qnty: 1,
        desc: "Deepstone Edge II, a rare blade forged with a bluegranite guard, a leather grip, and a iron pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "rare1",
            handleRarity: "common2",
            pommelRarity: "common1",

            bladeColor: "bluegranite",
            guardColor: "bluegranite",
            handleColor: "leather",
            pommelColor: "iron",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "bloodfangedgeii",
        dn: "Bloodfang Edge II",
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
        price: { coinType: "bronze", pieces: 15 },
        qnty: 1,
        desc: "Bloodfang Edge II, a rare blade forged with a beastheart guard, a leather grip, and a beastheart pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "rare1",
            handleRarity: "common2",
            pommelRarity: "common2",

            bladeColor: "iron",
            guardColor: "beastheart",
            handleColor: "leather",
            pommelColor: "beastheart",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "glacierbornedgeii",
        dn: "Glacierborn Edge II",
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
        price: { coinType: "bronze", pieces: 16 },
        qnty: 1,
        desc: "Glacierborn Edge II, a rare blade forged with a frostshard guard, a bone grip, and a silver pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "rare1",
            handleRarity: "common2",
            pommelRarity: "rare1",

            bladeColor: "mythril",
            guardColor: "frostshard",
            handleColor: "bone",
            pommelColor: "silver",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "frostmarkedgeiii",
        dn: "Frostmark Edge III",
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
        price: { coinType: "bronze", pieces: 16 },
        qnty: 1,
        desc: "Frostmark Edge III, a rare blade forged with a sodalite guard, a wood grip, and a firecrystal pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "rare1",
            handleRarity: "rare1",
            pommelRarity: "common1",

            bladeColor: "iron",
            guardColor: "sodalite",
            handleColor: "wood",
            pommelColor: "firecrystal",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "emberfalledgeiii",
        dn: "Emberfall Edge III",
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
        price: { coinType: "bronze", pieces: 16 },
        qnty: 1,
        desc: "Emberfall Edge III, a rare blade forged with a firecrystal guard, a leather grip, and a gold pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "rare1",
            handleRarity: "rare1",
            pommelRarity: "common2",

            bladeColor: "steel",
            guardColor: "firecrystal",
            handleColor: "leather",
            pommelColor: "gold",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "winterlaceedgeiii",
        dn: "Winterlace Edge III",
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
        desc: "Winterlace Edge III, a rare blade forged with a frostshard guard, a bone grip, and a frostshard pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "rare1",
            handleRarity: "rare1",
            pommelRarity: "rare1",

            bladeColor: "silver",
            guardColor: "frostshard",
            handleColor: "bone",
            pommelColor: "frostshard",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "stormcalleredgeiii",
        dn: "Stormcaller Edge III",
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
        price: { coinType: "bronze", pieces: 15 },
        qnty: 1,
        desc: "Stormcaller Edge III, a rare blade forged with a stormcrystal guard, a wood grip, and a stormcrystal pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "rare2",
            handleRarity: "common1",
            pommelRarity: "common1",

            bladeColor: "mythril",
            guardColor: "stormcrystal",
            handleColor: "wood",
            pommelColor: "stormcrystal",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "stoneguardedgeiii",
        dn: "Stoneguard Edge III",
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
        price: { coinType: "bronze", pieces: 15 },
        qnty: 1,
        desc: "Stoneguard Edge III, a rare blade forged with a bluegranite guard, a leather grip, and a bronze pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "rare2",
            handleRarity: "common1",
            pommelRarity: "common2",

            bladeColor: "iron",
            guardColor: "bluegranite",
            handleColor: "leather",
            pommelColor: "bronze",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "highsteeledgeiii",
        dn: "Highsteel Edge III",
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
        price: { coinType: "bronze", pieces: 16 },
        qnty: 1,
        desc: "Highsteel Edge III, a rare blade forged with a steel guard, a leather grip, and a silver pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "rare2",
            handleRarity: "common1",
            pommelRarity: "rare1",

            bladeColor: "steel",
            guardColor: "steel",
            handleColor: "leather",
            pommelColor: "silver",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "ashenboneedgeiii",
        dn: "Ashenbone Edge III",
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
        price: { coinType: "bronze", pieces: 15 },
        qnty: 1,
        desc: "Ashenbone Edge III, a rare blade forged with a bone guard, a bone grip, and a beastheart pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "rare2",
            handleRarity: "common2",
            pommelRarity: "common1",

            bladeColor: "bronze",
            guardColor: "bone",
            handleColor: "bone",
            pommelColor: "beastheart",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "voidboundedgeiii",
        dn: "Voidbound Edge III",
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
        price: { coinType: "bronze", pieces: 15 },
        qnty: 1,
        desc: "Voidbound Edge III, a rare blade forged with a stormcrystal guard, a leather grip, and a stormcrystal pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "rare2",
            handleRarity: "common2",
            pommelRarity: "common2",

            bladeColor: "adamantine",
            guardColor: "stormcrystal",
            handleColor: "leather",
            pommelColor: "stormcrystal",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "sunforgededgeiii",
        dn: "Sunforged Edge III",
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
        price: { coinType: "bronze", pieces: 16 },
        qnty: 1,
        desc: "Sunforged Edge III, a rare blade forged with a firecrystal guard, a wood grip, and a gold pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "rare2",
            handleRarity: "common2",
            pommelRarity: "rare1",

            bladeColor: "gold",
            guardColor: "firecrystal",
            handleColor: "wood",
            pommelColor: "gold",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "deepstoneedgeiii",
        dn: "Deepstone Edge III",
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
        price: { coinType: "bronze", pieces: 16 },
        qnty: 1,
        desc: "Deepstone Edge III, a rare blade forged with a bluegranite guard, a leather grip, and a iron pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "rare2",
            handleRarity: "rare1",
            pommelRarity: "common1",

            bladeColor: "bluegranite",
            guardColor: "bluegranite",
            handleColor: "leather",
            pommelColor: "iron",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "bloodfangedgeiii",
        dn: "Bloodfang Edge III",
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
        price: { coinType: "bronze", pieces: 16 },
        qnty: 1,
        desc: "Bloodfang Edge III, a rare blade forged with a beastheart guard, a leather grip, and a beastheart pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "rare2",
            handleRarity: "rare1",
            pommelRarity: "common2",

            bladeColor: "iron",
            guardColor: "beastheart",
            handleColor: "leather",
            pommelColor: "beastheart",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "glacierbornedgeiii",
        dn: "Glacierborn Edge III",
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
        desc: "Glacierborn Edge III, a rare blade forged with a frostshard guard, a bone grip, and a silver pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare1",
            guardRarity: "rare2",
            handleRarity: "rare1",
            pommelRarity: "rare1",

            bladeColor: "mythril",
            guardColor: "frostshard",
            handleColor: "bone",
            pommelColor: "silver",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "frostmarkfang",
        dn: "Frostmark Fang",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 24, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 18 },
        qnty: 1,
        desc: "Frostmark Fang, a rare blade forged with a sodalite guard, a wood grip, and a firecrystal pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
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
        name: "emberfallfang",
        dn: "Emberfall Fang",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 24, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 18 },
        qnty: 1,
        desc: "Emberfall Fang, a rare blade forged with a firecrystal guard, a leather grip, and a gold pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "common1",
            handleRarity: "common1",
            pommelRarity: "common2",

            bladeColor: "steel",
            guardColor: "firecrystal",
            handleColor: "leather",
            pommelColor: "gold",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "winterlacefang",
        dn: "Winterlace Fang",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 24, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 19 },
        qnty: 1,
        desc: "Winterlace Fang, a rare blade forged with a frostshard guard, a bone grip, and a frostshard pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "common1",
            handleRarity: "common1",
            pommelRarity: "rare1",

            bladeColor: "silver",
            guardColor: "frostshard",
            handleColor: "bone",
            pommelColor: "frostshard",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "stormcallerfang",
        dn: "Stormcaller Fang",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 24, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 18 },
        qnty: 1,
        desc: "Stormcaller Fang, a rare blade forged with a stormcrystal guard, a wood grip, and a stormcrystal pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "common1",
            handleRarity: "common2",
            pommelRarity: "common1",

            bladeColor: "mythril",
            guardColor: "stormcrystal",
            handleColor: "wood",
            pommelColor: "stormcrystal",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "stoneguardfang",
        dn: "Stoneguard Fang",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 24, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 18 },
        qnty: 1,
        desc: "Stoneguard Fang, a rare blade forged with a bluegranite guard, a leather grip, and a bronze pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "common1",
            handleRarity: "common2",
            pommelRarity: "common2",

            bladeColor: "iron",
            guardColor: "bluegranite",
            handleColor: "leather",
            pommelColor: "bronze",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "highsteelfang",
        dn: "Highsteel Fang",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 24, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 19 },
        qnty: 1,
        desc: "Highsteel Fang, a rare blade forged with a steel guard, a leather grip, and a silver pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "common1",
            handleRarity: "common2",
            pommelRarity: "rare1",

            bladeColor: "steel",
            guardColor: "steel",
            handleColor: "leather",
            pommelColor: "silver",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "ashenbonefang",
        dn: "Ashenbone Fang",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 24, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 19 },
        qnty: 1,
        desc: "Ashenbone Fang, a rare blade forged with a bone guard, a bone grip, and a beastheart pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "common1",
            handleRarity: "rare1",
            pommelRarity: "common1",

            bladeColor: "bronze",
            guardColor: "bone",
            handleColor: "bone",
            pommelColor: "beastheart",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "voidboundfang",
        dn: "Voidbound Fang",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 24, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 19 },
        qnty: 1,
        desc: "Voidbound Fang, a rare blade forged with a stormcrystal guard, a leather grip, and a stormcrystal pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "common1",
            handleRarity: "rare1",
            pommelRarity: "common2",

            bladeColor: "adamantine",
            guardColor: "stormcrystal",
            handleColor: "leather",
            pommelColor: "stormcrystal",
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
            dmg: 24, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 20 },
        qnty: 1,
        desc: "Sunforged Fang, a rare blade forged with a firecrystal guard, a wood grip, and a gold pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "common1",
            handleRarity: "rare1",
            pommelRarity: "rare1",

            bladeColor: "gold",
            guardColor: "firecrystal",
            handleColor: "wood",
            pommelColor: "gold",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "deepstonefang",
        dn: "Deepstone Fang",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 24, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 18 },
        qnty: 1,
        desc: "Deepstone Fang, a rare blade forged with a bluegranite guard, a leather grip, and a iron pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "common2",
            handleRarity: "common1",
            pommelRarity: "common1",

            bladeColor: "bluegranite",
            guardColor: "bluegranite",
            handleColor: "leather",
            pommelColor: "iron",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "bloodfangfang",
        dn: "Bloodfang Fang",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 24, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 18 },
        qnty: 1,
        desc: "Bloodfang Fang, a rare blade forged with a beastheart guard, a leather grip, and a beastheart pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "common2",
            handleRarity: "common1",
            pommelRarity: "common2",

            bladeColor: "iron",
            guardColor: "beastheart",
            handleColor: "leather",
            pommelColor: "beastheart",
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
            dmg: 24, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 19 },
        qnty: 1,
        desc: "Glacierborn Fang, a rare blade forged with a frostshard guard, a bone grip, and a silver pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "common2",
            handleRarity: "common1",
            pommelRarity: "rare1",

            bladeColor: "mythril",
            guardColor: "frostshard",
            handleColor: "bone",
            pommelColor: "silver",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "frostmarkfangii",
        dn: "Frostmark Fang II",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 24, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 18 },
        qnty: 1,
        desc: "Frostmark Fang II, a rare blade forged with a sodalite guard, a wood grip, and a firecrystal pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "common2",
            handleRarity: "common2",
            pommelRarity: "common1",

            bladeColor: "iron",
            guardColor: "sodalite",
            handleColor: "wood",
            pommelColor: "firecrystal",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "emberfallfangii",
        dn: "Emberfall Fang II",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 24, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 18 },
        qnty: 1,
        desc: "Emberfall Fang II, a rare blade forged with a firecrystal guard, a leather grip, and a gold pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "common2",
            handleRarity: "common2",
            pommelRarity: "common2",

            bladeColor: "steel",
            guardColor: "firecrystal",
            handleColor: "leather",
            pommelColor: "gold",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "winterlacefangii",
        dn: "Winterlace Fang II",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 24, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 19 },
        qnty: 1,
        desc: "Winterlace Fang II, a rare blade forged with a frostshard guard, a bone grip, and a frostshard pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "common2",
            handleRarity: "common2",
            pommelRarity: "rare1",

            bladeColor: "silver",
            guardColor: "frostshard",
            handleColor: "bone",
            pommelColor: "frostshard",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "stormcallerfangii",
        dn: "Stormcaller Fang II",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 24, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 19 },
        qnty: 1,
        desc: "Stormcaller Fang II, a rare blade forged with a stormcrystal guard, a wood grip, and a stormcrystal pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "common2",
            handleRarity: "rare1",
            pommelRarity: "common1",

            bladeColor: "mythril",
            guardColor: "stormcrystal",
            handleColor: "wood",
            pommelColor: "stormcrystal",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "stoneguardfangii",
        dn: "Stoneguard Fang II",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 24, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 19 },
        qnty: 1,
        desc: "Stoneguard Fang II, a rare blade forged with a bluegranite guard, a leather grip, and a bronze pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "common2",
            handleRarity: "rare1",
            pommelRarity: "common2",

            bladeColor: "iron",
            guardColor: "bluegranite",
            handleColor: "leather",
            pommelColor: "bronze",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "highsteelfangii",
        dn: "Highsteel Fang II",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: "sword",
        equipAbilities: {
            dmg: 24, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 20 },
        qnty: 1,
        desc: "Highsteel Fang II, a rare blade forged with a steel guard, a leather grip, and a silver pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "common2",
            handleRarity: "rare1",
            pommelRarity: "rare1",

            bladeColor: "steel",
            guardColor: "steel",
            handleColor: "leather",
            pommelColor: "silver",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "ashenbonefangii",
        dn: "Ashenbone Fang II",
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
        price: { coinType: "bronze", pieces: 19 },
        qnty: 1,
        desc: "Ashenbone Fang II, a rare blade forged with a bone guard, a bone grip, and a beastheart pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "rare1",
            handleRarity: "common1",
            pommelRarity: "common1",

            bladeColor: "bronze",
            guardColor: "bone",
            handleColor: "bone",
            pommelColor: "beastheart",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "voidboundfangii",
        dn: "Voidbound Fang II",
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
        price: { coinType: "bronze", pieces: 19 },
        qnty: 1,
        desc: "Voidbound Fang II, a rare blade forged with a stormcrystal guard, a leather grip, and a stormcrystal pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "rare1",
            handleRarity: "common1",
            pommelRarity: "common2",

            bladeColor: "adamantine",
            guardColor: "stormcrystal",
            handleColor: "leather",
            pommelColor: "stormcrystal",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "sunforgedfangii",
        dn: "Sunforged Fang II",
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
        price: { coinType: "bronze", pieces: 20 },
        qnty: 1,
        desc: "Sunforged Fang II, a rare blade forged with a firecrystal guard, a wood grip, and a gold pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "rare1",
            handleRarity: "common1",
            pommelRarity: "rare1",

            bladeColor: "gold",
            guardColor: "firecrystal",
            handleColor: "wood",
            pommelColor: "gold",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "deepstonefangii",
        dn: "Deepstone Fang II",
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
        price: { coinType: "bronze", pieces: 19 },
        qnty: 1,
        desc: "Deepstone Fang II, a rare blade forged with a bluegranite guard, a leather grip, and a iron pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "rare1",
            handleRarity: "common2",
            pommelRarity: "common1",

            bladeColor: "bluegranite",
            guardColor: "bluegranite",
            handleColor: "leather",
            pommelColor: "iron",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "bloodfangfangii",
        dn: "Bloodfang Fang II",
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
        price: { coinType: "bronze", pieces: 19 },
        qnty: 1,
        desc: "Bloodfang Fang II, a rare blade forged with a beastheart guard, a leather grip, and a beastheart pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "rare1",
            handleRarity: "common2",
            pommelRarity: "common2",

            bladeColor: "iron",
            guardColor: "beastheart",
            handleColor: "leather",
            pommelColor: "beastheart",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "glacierbornfangii",
        dn: "Glacierborn Fang II",
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
        price: { coinType: "bronze", pieces: 20 },
        qnty: 1,
        desc: "Glacierborn Fang II, a rare blade forged with a frostshard guard, a bone grip, and a silver pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "rare1",
            handleRarity: "common2",
            pommelRarity: "rare1",

            bladeColor: "mythril",
            guardColor: "frostshard",
            handleColor: "bone",
            pommelColor: "silver",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "frostmarkfangiii",
        dn: "Frostmark Fang III",
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
        price: { coinType: "bronze", pieces: 20 },
        qnty: 1,
        desc: "Frostmark Fang III, a rare blade forged with a sodalite guard, a wood grip, and a firecrystal pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "rare1",
            handleRarity: "rare1",
            pommelRarity: "common1",

            bladeColor: "iron",
            guardColor: "sodalite",
            handleColor: "wood",
            pommelColor: "firecrystal",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "emberfallfangiii",
        dn: "Emberfall Fang III",
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
        price: { coinType: "bronze", pieces: 20 },
        qnty: 1,
        desc: "Emberfall Fang III, a rare blade forged with a firecrystal guard, a leather grip, and a gold pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "rare1",
            handleRarity: "rare1",
            pommelRarity: "common2",

            bladeColor: "steel",
            guardColor: "firecrystal",
            handleColor: "leather",
            pommelColor: "gold",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "winterlacefangiii",
        dn: "Winterlace Fang III",
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
        desc: "Winterlace Fang III, a rare blade forged with a frostshard guard, a bone grip, and a frostshard pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "rare1",
            handleRarity: "rare1",
            pommelRarity: "rare1",

            bladeColor: "silver",
            guardColor: "frostshard",
            handleColor: "bone",
            pommelColor: "frostshard",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "stormcallerfangiii",
        dn: "Stormcaller Fang III",
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
        price: { coinType: "bronze", pieces: 19 },
        qnty: 1,
        desc: "Stormcaller Fang III, a rare blade forged with a stormcrystal guard, a wood grip, and a stormcrystal pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "rare2",
            handleRarity: "common1",
            pommelRarity: "common1",

            bladeColor: "mythril",
            guardColor: "stormcrystal",
            handleColor: "wood",
            pommelColor: "stormcrystal",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "stoneguardfangiii",
        dn: "Stoneguard Fang III",
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
        price: { coinType: "bronze", pieces: 19 },
        qnty: 1,
        desc: "Stoneguard Fang III, a rare blade forged with a bluegranite guard, a leather grip, and a bronze pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "rare2",
            handleRarity: "common1",
            pommelRarity: "common2",

            bladeColor: "iron",
            guardColor: "bluegranite",
            handleColor: "leather",
            pommelColor: "bronze",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "highsteelfangiii",
        dn: "Highsteel Fang III",
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
        price: { coinType: "bronze", pieces: 20 },
        qnty: 1,
        desc: "Highsteel Fang III, a rare blade forged with a steel guard, a leather grip, and a silver pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "rare2",
            handleRarity: "common1",
            pommelRarity: "rare1",

            bladeColor: "steel",
            guardColor: "steel",
            handleColor: "leather",
            pommelColor: "silver",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "ashenbonefangiii",
        dn: "Ashenbone Fang III",
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
        price: { coinType: "bronze", pieces: 19 },
        qnty: 1,
        desc: "Ashenbone Fang III, a rare blade forged with a bone guard, a bone grip, and a beastheart pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "rare2",
            handleRarity: "common2",
            pommelRarity: "common1",

            bladeColor: "bronze",
            guardColor: "bone",
            handleColor: "bone",
            pommelColor: "beastheart",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "voidboundfangiii",
        dn: "Voidbound Fang III",
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
        price: { coinType: "bronze", pieces: 19 },
        qnty: 1,
        desc: "Voidbound Fang III, a rare blade forged with a stormcrystal guard, a leather grip, and a stormcrystal pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "rare2",
            handleRarity: "common2",
            pommelRarity: "common2",

            bladeColor: "adamantine",
            guardColor: "stormcrystal",
            handleColor: "leather",
            pommelColor: "stormcrystal",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "sunforgedfangiii",
        dn: "Sunforged Fang III",
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
        price: { coinType: "bronze", pieces: 20 },
        qnty: 1,
        desc: "Sunforged Fang III, a rare blade forged with a firecrystal guard, a wood grip, and a gold pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "rare2",
            handleRarity: "common2",
            pommelRarity: "rare1",

            bladeColor: "gold",
            guardColor: "firecrystal",
            handleColor: "wood",
            pommelColor: "gold",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "deepstonefangiii",
        dn: "Deepstone Fang III",
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
        price: { coinType: "bronze", pieces: 20 },
        qnty: 1,
        desc: "Deepstone Fang III, a rare blade forged with a bluegranite guard, a leather grip, and a iron pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "rare2",
            handleRarity: "rare1",
            pommelRarity: "common1",

            bladeColor: "bluegranite",
            guardColor: "bluegranite",
            handleColor: "leather",
            pommelColor: "iron",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "bloodfangfangiii",
        dn: "Bloodfang Fang III",
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
        price: { coinType: "bronze", pieces: 20 },
        qnty: 1,
        desc: "Bloodfang Fang III, a rare blade forged with a beastheart guard, a leather grip, and a beastheart pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "rare2",
            handleRarity: "rare1",
            pommelRarity: "common2",

            bladeColor: "iron",
            guardColor: "beastheart",
            handleColor: "leather",
            pommelColor: "beastheart",
        }
    },
    {
        itemId: randomNum(), // should be string also in client
        name: "glacierbornfangiii",
        dn: "Glacierborn Fang III",
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
        desc: "Glacierborn Fang III, a rare blade forged with a frostshard guard, a bone grip, and a silver pommel.",
        rarity: "rare",

        parts: {
            bladeRarity: "rare2",
            guardRarity: "rare2",
            handleRarity: "rare1",
            pommelRarity: "rare1",

            bladeColor: "mythril",
            guardColor: "frostshard",
            handleColor: "bone",
            pommelColor: "silver",
        }
    }
]
