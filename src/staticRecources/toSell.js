import { randomNum } from "../tools/tools";
import { METAL_COLOR } from "../tools/metalmat.js";

export default  [

    // pickaxe (weaponType "pickaxe", same axes.glb as the axe entries
    // above) - shares its handle mesh directly with the axe family (no
    // separate pickaxe_handle_* mesh exists at all, see createweapon.js's
    // own SHARED_PART_SOURCE), only blade/guard are actually its own.
    // First pickaxe item added, mainly to prove the weaponType actually
    // works end to end - rename/reprice/reflavor freely.
    {
        sellerId: "sellerEldric123",
        itemId: randomNum(), // should be string also in client
        name: "minersedge", // is also the image name
        dn: "Miner's Edge",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff/cores
        weaponType: "pickaxe",
        equipAbilities: {
            dmg: 10, def: 10, magicDmg: 10, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 100, plusMp: 100, plusSp: 100, plusDmg: 10, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 10 },
        qnty: 1,
        desc: "A well-balanced pick, equally at home splitting stone or skulls",
        rarity: "rare",
        parts: {
            bladeRarity: "common1",
            guardRarity: "common1",
            handleRarity: "common1",

            bladeColor: "steel",
            guardColor: "iron",
            handleColor: "leather",
        }
    },

   {
        sellerId: "sellerEldric123",
        itemId: randomNum(), // should be string also in client
        name: "farmersaxe", // is also the image name
        dn: "Farmer's Axe",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff/cores
        weaponType: "axe",
        equipAbilities: {
            dmg: 10, def: 10, magicDmg: 10, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        consumeAbilities: { plusHp: 100, plusMp: 100, plusSp: 100, plusDmg: 10, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 10 },
        qnty: 1,
        desc: "A well-balanced Axe, equally at home cutting trees",
        rarity: "rare",
        parts: {
            bladeRarity: "common1",
            guardRarity: "common1",
            handleRarity: "common1",

            bladeColor: "steel",
            guardColor: "iron",
            handleColor: "wood",
        }
    },
    {
        sellerId: "sellerSylvan123",
        itemId: randomNum(), // should be string also in client
        name: "etherpearl", // is also the image name
        dn: "Etherpearl",
        itemCateg: "consumable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "food", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff/cores
        // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
        consumeAbilities: { plusHp: 100, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, fillHunger: 15, fillTireness: 0, cure: []}, //for buffs foods potions
        price: { coinType: "bronze", pieces: 1 },
        qnty: 1,
        desc: "A rare, luminous fruit that shimmers with a soft, otherworldly glow. ",
        rarity: "normal"
    },
    {
        sellerId: "sellerSylvan123",
        itemId: randomNum(), // should be string also in client
        name: "sylfple", // is also the image name
        dn: "Sylfple",
        itemCateg: "consumable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "food", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff/cores
        // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
        consumeAbilities: { plusHp: 200, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, fillHunger: 25, fillTireness: 0, cure: []}, //for buffs foods potions
        price: { coinType: "bronze", pieces: 2 },
        qnty: 1,
        desc: "A delicate, green-skinned fruit, with soft, velvety flesh that emits a fresh, herbal fragrance.",
        rarity: "normal"
    },
    {
        sellerId: "sellerSylvan123",
        itemId: randomNum(), // should be string also in client
        name: "lunaraqum", // is also the image name
        dn: "Lunaraqum",
        itemCateg: "consumable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "food", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff/cores
        // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
        consumeAbilities: { plusHp: 400, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, fillHunger: 30, fillTireness: 10, cure: ["poisoned"]}, //for buffs foods potions
        price: { coinType: "bronze", pieces: 3 },
        qnty: 1,
        desc: "A striking fruit with a deep crimson skin that glimmers like molten metal under moonlight. Its content can even cure poisons",
        rarity: "normal"
    },
    // cures "cursed" (charactersystem/characterstate.js's curseStatusEffect/
    // isPlayerCursed - dark magic's "your own damage backfires on you"
    // debuff, skillsData.js's own curse effect entries) - same cure:[]
    // mechanism lunaraqum's own poison-cure above already uses
    // (itemInfoSystem.js's consumeItemFunc), just naming "cursed" instead of
    // "poisoned". Priced above every fruit above it and sold no cheaper than
    // that - curing a PERMANENT debuff (unlike poison, which also just wears
    // off a status tick at a time) needs a reliably purchasable source, not
    // a rare drop, so it's here in the same vendor stock rather than gated
    // behind loot RNG.
    {
        sellerId: "sellerSylvan123",
        itemId: randomNum(), // should be string also in client
        name: "antidote", // is also the image name
        dn: "Antidote",
        itemCateg: "consumable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "potion", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff/cores
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, fillHunger: 0, fillTireness: 0, cure: ["cursed"]}, //for buffs foods potions
        price: { coinType: "bronze", pieces: 5 },
        qnty: 1,
        desc: "A bitter, silver-blue tonic brewed to burn a curse out of the blood. Does nothing for wounds, hunger, or poison - only for the mark dark magic leaves behind.",
        rarity: "normal"
    },
    {
        sellerId: "sellerSylvan123",
        itemId: randomNum(), // should be string also in client
        name: "duskmire", // is also the image name
        dn: "Duskmire",
        itemCateg: "consumable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "food", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff/cores
        // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
        consumeAbilities: { plusHp: 900, plusMp: 200, plusSp: 200, plusDmg: 10, plusSpd: 0, fillHunger: 60, fillTireness: 15 }, //for buffs foods potions
        price: { coinType: "bronze", pieces: 13 },
        qnty: 1,
        desc: "Its rarity stems from the fact that it only grows in the heart of enchanted swamps, blooming at dusk under the watchful eye of ancient spirits.",
        rarity: "rare"
    },

    // Bram's forge (weaponHouse, see localroomdb.js originalGlbs) - armor and
    // weapons fresh off the anvil, reusing the same item shapes already worn
    // by Armin/Strong/Vordz so the art (images/items/equipable/*) is
    // guaranteed to already exist.
    {
        sellerId: "sellerBram",
        itemId: randomNum(),
        name: "knightscale",
        dn: "Knight's Scale",
        itemCateg: "equipable",
        itemType: "armor",
        weaponType: undefined,
        equipAbilities: { dmg: 0, def: 20, resistance: 10, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0 },
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1 },
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true,
        enhancedLevel: 0,
        slots: [],
        durability: { current: 100, max: 100 },
        price: { coinType: "bronze", pieces: 45 },
        qnty: 1,
        desc: "Sturdy scale armor, fresh off Bram's anvil.",
        rarity: "rare",
        metalColor: METAL_COLOR.ADAMANTINE
    },
    {
        sellerId: "sellerBram",
        itemId: randomNum(),
        name: "ironpaul",
        dn: "Iron Pauldron",
        itemCateg: "equipable",
        itemType: "pauldron",
        weaponType: undefined,
        equipAbilities: { dmg: 0, def: 20, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0 },
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1 },
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true,
        enhancedLevel: 0,
        slots: [],
        durability: { current: 100, max: 100 },
        price: { coinType: "bronze", pieces: 30 },
        qnty: 1,
        desc: "A solid iron pauldron, hammered to shape by Bram himself.",
        rarity: "rare",
        metalColor: METAL_COLOR.ADAMANTINE
    },
    {
        sellerId: "sellerBram",
        itemId: randomNum(),
        name: "gauntler",
        dn: "Gauntlet",
        itemCateg: "equipable",
        itemType: "gauntlet",
        weaponType: undefined,
        equipAbilities: { dmg: 0, def: 20, resistance: 10, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0 },
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1 },
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true,
        enhancedLevel: 0,
        slots: [],
        durability: { current: 100, max: 100 },
        price: { coinType: "bronze", pieces: 30 },
        qnty: 1,
        desc: "A well-fitted gauntlet, straight from the forge.",
        rarity: "rare",
        metalColor: METAL_COLOR.ADAMANTINE
    },
    {
        sellerId: "sellerBram",
        itemId: randomNum(),
        name: "ironjaw",
        modelName: "ironjaw",
        dn: "Knight's Helm III",
        itemCateg: "equipable",
        itemType: "helmet",
        weaponType: undefined,
        equipAbilities: { dmg: 0, def: 20, resistance: 10, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0 },
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1 },
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true,
        enhancedLevel: 0,
        slots: [],
        durability: { current: 100, max: 100 },
        price: { coinType: "bronze", pieces: 35 },
        qnty: 1,
        desc: "A full iron helm, dented once and re-forged since.",
        rarity: "rare",
        metalColor: METAL_COLOR.ADAMANTINE
    },
    {
        sellerId: "sellerBram",
        itemId: randomNum(),
        name: "leatherboots",
        dn: "Leather Boots",
        itemCateg: "equipable",
        itemType: "boots",
        equipAbilities: { dmg: 0, def: 0, resistance: 5, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0 },
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0 },
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: false,
        enhancedLevel: 0,
        durability: { current: 100, max: 100 },
        price: { coinType: "bronze", pieces: 9 },
        qnty: 1,
        desc: "This Boots is light and useful for first time adventurers",
        rarity: "common"
    },
    {
        sellerId: "sellerBram",
        itemId: randomNum(),
        name: "frostbite",
        dn: "Frost Bite",
        itemCateg: "equipable",
        itemType: "weapon",
        weaponType: "sword",
        equipAbilities: { dmg: 20, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0 },
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 10, plusSpd: 1 },
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true,
        enhancedLevel: 0,
        slots: [],
        durability: { current: 100, max: 100 },
        price: { coinType: "bronze", pieces: 50 },
        qnty: 1,
        desc: "A frost-etched blade, quenched in ice water the moment it left the forge.",
        rarity: "rare",
        parts: {
            bladeRarity: "rare2",
            guardRarity: "rare2",
            handleRarity: "common1",
            pommelRarity: "common1"
        }
    },
]


//     {
    //     sellerId: "sellerEldric123",
    //     itemId: randomNum(), // should be string also in client
    //     name: "knightaxe", // is also the image name
    //     dn: "Knight's Axe",
    //     itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
    //     itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff/cores
    //     weaponType: "axe",
    //     equipAbilities: { 
    //         dmg: 100, def: 100, magicDmg: 100, plusStr: 0, plusDex: 0, plusInt: 0,
    //     }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
    //     // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
    //     consumeAbilities: { plusHp: 100, plusMp: 100, plusSp: 100, plusDmg: 10, plusSpd: 1, }, //for buffs foods potions
    //     equiped: false,
    //     soulFeed: 0,
    //     isEnhanceAble: true, // only for equipable items
    //     enhancedLevel: 0,
    //     slots: [],// { name, dn, equipAbilities } cores
    //     durability: { current: 100, max: 100},
    //     price: { coinType: "bronze", pieces: 10 },
    //     qnty: 1,
    //     desc: "From war to war this axe is commendable for battle, durable and sharp",
    //     rarity: "rare",
    //     // axe only ever has blade/guard/handle (no pommel mesh exists for
    //     // this weaponType - see createweapon.js's own WEAPON_PART_LIST) and
    //     // axes.glb only has ONE modeled tier per part (common1, no rare
    //     // variants yet, unlike allswords.glb) - without this, equipping this
    //     // item would've silently tried (and failed) to look up
    //     // axe_blade_rare2/axe_guard_rare1 (createWeapon's own default
    //     // options), which don't exist in the glb at all.
    //     parts: {
    //         bladeRarity: "common1",
    //         guardRarity: "common1",
    //         handleRarity: "common1",

    //         bladeColor: "steel",
    //         guardColor: "bronze",
    //         handleColor: "leather",
    //     }
    // },
    // {
    //     sellerId: "sellerEldric123",
    //     itemId: randomNum(), // should be string also in client
    //     name: "silverwood", // is also the image name
    //     dn: "Silver & Wood",
    //     itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
    //     itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff/cores
    //     weaponType: "axe",
    //     equipAbilities: { 
    //         dmg: 100, def: 100, magicDmg: 100, plusStr: 0, plusDex: 0, plusInt: 0,
    //     }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
    //     // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
    //     consumeAbilities: { plusHp: 100, plusMp: 100, plusSp: 100, plusDmg: 10, plusSpd: 1, }, //for buffs foods potions
    //     equiped: false,
    //     soulFeed: 0,
    //     isEnhanceAble: true, // only for equipable items
    //     enhancedLevel: 0,
    //     slots: [],// { name, dn, equipAbilities } cores
    //     durability: { current: 100, max: 100},
    //     price: { coinType: "bronze", pieces: 10 },
    //     qnty: 1,
    //     desc: "The classic Silver & wood crafted from nature's spirit and silverine",
    //     rarity: "rare",
    //     parts: {
    //         bladeRarity: "common1",
    //         guardRarity: "common1",
    //         handleRarity: "common1",

    //         bladeColor: "silver",
    //         guardColor: "silver",
    //         handleColor: "wood",
    //     }
    // },
    // {
    //     sellerId: "sellerEldric123",
    //     itemId: randomNum(), // should be string also in client
    //     name: "daedalus", // is also the image name
    //     dn: "Daedalus",
    //     itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
    //     itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff/cores
    //     weaponType: "axe",
    //     equipAbilities: { 
    //         dmg: 100, def: 100, magicDmg: 100, plusStr: 0, plusDex: 0, plusInt: 0,
    //     }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
    //     // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
    //     consumeAbilities: { plusHp: 100, plusMp: 100, plusSp: 100, plusDmg: 10, plusSpd: 1, }, //for buffs foods potions
    //     equiped: false,
    //     soulFeed: 0,
    //     isEnhanceAble: true, // only for equipable items
    //     enhancedLevel: 0,
    //     slots: [],// { name, dn, equipAbilities } cores
    //     durability: { current: 100, max: 100},
    //     price: { coinType: "bronze", pieces: 10 },
    //     qnty: 1,
    //     desc: "Daedalus Axe, named after Daedalus a fallen meteor that killed dozen of life",
    //     rarity: "rare",
    //     parts: {
    //         bladeRarity: "common1",
    //         guardRarity: "common1",
    //         handleRarity: "common1",

    //         bladeColor: "mythril",
    //         guardColor: "iron",
    //         handleColor: "bone",
    //     }
    // },