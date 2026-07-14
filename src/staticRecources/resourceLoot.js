import { randomNum } from "../tools/tools.js"

// raw materials minable from world resources (see localroomdb.js's
// "resources" -> loots, and areascene.js's mining loop). Each factory
// returns a fresh instance so repeated pickups never share an itemId.
const LOOT_TEMPLATES = {
    ore: () => ({
        itemId: randomNum(),
        name: "ore",
        dn: "Ore",
        itemCateg: "crafting",
        itemType: "material",
        qnty: 1,
        price: { coinType: "bronze", pieces: 5 },
        desc: "A raw chunk of ore, useful for crafting and enhancing gear.",
        rarity: "common"
    }),
    crystal: () => ({
        itemId: randomNum(),
        name: "crystal",
        dn: "Crystal",
        itemCateg: "crafting",
        itemType: "material",
        qnty: 1,
        price: { coinType: "bronze", pieces: 15 },
        desc: "A shard of raw crystal, prized by enchanters.",
        rarity: "uncommon"
    }),
    adamantine: () => ({
        itemId: randomNum(),
        name: "adamantine",
        dn: "Adamantine",
        itemCateg: "crafting",
        itemType: "material",
        qnty: 1,
        price: { coinType: "bronze", pieces: 40 },
        desc: "A rare, near-indestructible metal ore.",
        rarity: "rare"
    })
}

export function createLootItem(name){
    const factory = LOOT_TEMPLATES[name]
    if(!factory) return null
    return factory()
}
