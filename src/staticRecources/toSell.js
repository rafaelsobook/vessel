import { randomNum } from "../tools/tools";

export default  [
    {
        sellerId: "sellerEldric123",
        itemId: randomNum(), // should be string also in client
        name: "knightaxe", // is also the image name
        dn: "Knight's Axe",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff/cores
        weaponType: "axe",
        equipAbilities: { 
            dmg: 100, def: 100, magicDmg: 100, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
        consumeAbilities: { plusHp: 100, plusMp: 100, plusSp: 100, plusDmg: 10, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: 10,
        qnty: 1,
        desc: "From war to war this axe is commendable for battle, durable and sharp",
        rarity: "rare"
    },
    {
        sellerId: "sellerEldric123",
        itemId: randomNum(), // should be string also in client
        name: "silverwood", // is also the image name
        dn: "Silver & Wood",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff/cores
        weaponType: "axe",
        equipAbilities: { 
            dmg: 100, def: 100, magicDmg: 100, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
        consumeAbilities: { plusHp: 100, plusMp: 100, plusSp: 100, plusDmg: 10, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: 10,
        qnty: 1,
        desc: "The classic Silver & wood crafted from nature's spirit and silverine",
        rarity: "rare"
    },
    {
        sellerId: "sellerEldric123",
        itemId: randomNum(), // should be string also in client
        name: "daedalus", // is also the image name
        dn: "Daedalus",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff/cores
        weaponType: "axe",
        equipAbilities: { 
            dmg: 100, def: 100, magicDmg: 100, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
        consumeAbilities: { plusHp: 100, plusMp: 100, plusSp: 100, plusDmg: 10, plusSpd: 1, }, //for buffs foods potions
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: 10,
        qnty: 1,
        desc: "Daedalus Axe, named after Daedalus a fallen meteor that killed dozen of life",
        rarity: "rare"
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
        price: 1,
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
        price: 2,
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
        price: 3,
        qnty: 1,
        desc: "A striking fruit with a deep crimson skin that glimmers like molten metal under moonlight. Its content can even cure poisons",
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
        price: 13,
        qnty: 1,
        desc: "Its rarity stems from the fact that it only grows in the heart of enchanted swamps, blooming at dusk under the watchful eye of ancient spirits.",
        rarity: "rare"
    },
]