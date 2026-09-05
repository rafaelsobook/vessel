import { randomNum } from "../tools/tools.js"

// raw materials minable from world resources (see localroomdb.js's
// "resources" -> loots, and areascene.js's mining loop). Each factory
// returns a fresh instance so repeated pickups never share an itemId.
const LOOT_TEMPLATES = {
    solarore: () => ({
        itemId: randomNum(),
        name: "solarore",
        dn: "Solar Ore",
        itemCateg: "crafting",
        itemType: "material",
        qnty: 1,
        price: { coinType: "bronze", pieces: 5 },
        desc: "A raw chunk of solar ore, useful for crafting and enhancing gear.",
        rarity: "rare"
    }),
    crystal: () => ({
        itemId: randomNum(),
        name: "celestineore",
        dn: "Celestine Ore",
        itemCateg: "crafting",
        itemType: "material",
        qnty: 1,
        price: { coinType: "bronze", pieces: 15 },
        desc: "A shard of Celestine Ore, prized by enchanters.",
        rarity: "rare"
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
    }),
    // newly added icons (./images/items/crafting) - none of these are wired
    // into any place's resources[].loots yet (see localroomdb.js), so they
    // aren't minable in the world until a loot entry references their key
    bloodstone: () => ({
        itemId: randomNum(),
        name: "bloodstone",
        dn: "Bloodstone",
        itemCateg: "crafting",
        itemType: "material",
        qnty: 1,
        price: { coinType: "bronze", pieces: 25 },
        desc: "A dark, blood-red mineral said to sharpen the wielder's aggression.",
        rarity: "rare"
    }),
    // no ./images/items/crafting/blackdragon.webp yet either (unlike the
    // rest of this "newly added" block above, which all already have their
    // icon sitting in that folder) - will 404 until that art exists.
    // Priced above every other material here (even unobtanium/phoenixore) -
    // a dragon scale should read as the single most prized material in the
    // game, matching how dragonSlayerTitle sits near the top of
    // titlesData.js's own tier (only godslayerTitle outranks it).
    blackdragon: () => ({
        itemId: randomNum(),
        name: "blackdragon",
        dn: "Black Dragon Scale",
        itemCateg: "crafting",
        itemType: "material",
        qnty: 1,
        price: { coinType: "bronze", pieces: 150 },
        desc: "A scale torn from a black dragon's hide, still cold as void and harder than any forged steel.",
        rarity: "legendary"
    }),
    bronzeore: () => ({
        itemId: randomNum(),
        name: "bronzeore",
        dn: "Bronze Ore",
        itemCateg: "crafting",
        itemType: "material",
        qnty: 1,
        price: { coinType: "bronze", pieces: 8 },
        desc: "A common coppery ore, the backbone of everyday gear.",
        rarity: "common"
    }),
    manastone: () => ({
        itemId: randomNum(),
        name: "manastone",
        dn: "Manastone",
        itemCateg: "crafting",
        itemType: "stone",
        qnty: 1,
        price: { coinType: "bronze", pieces: 22 },
        desc: "A stone humming faintly with latent magical energy.",
        rarity: "uncommon"
    }),
    orichalcum: () => ({
        itemId: randomNum(),
        name: "orichalcum",
        dn: "Orichalcum",
        itemCateg: "crafting",
        itemType: "material",
        qnty: 1,
        price: { coinType: "bronze", pieces: 60 },
        desc: "A legendary alloy from a bygone age, said to never tarnish.",
        rarity: "epic"
    }),
    phoenixore: () => ({
        itemId: randomNum(),
        name: "phoenixore",
        dn: "Phoenix Ore",
        itemCateg: "crafting",
        itemType: "material",
        qnty: 1,
        price: { coinType: "bronze", pieces: 135 },
        desc: "Ore said to have cooled in phoenix-fire - it's still warm to the touch.",
        rarity: "epic"
    }),
    rubyore: () => ({
        itemId: randomNum(),
        name: "rubyore",
        dn: "Ruby Ore",
        itemCateg: "crafting",
        itemType: "material",
        qnty: 1,
        price: { coinType: "bronze", pieces: 28 },
        desc: "Ore veined with raw ruby, prized for its brilliant red glow.",
        rarity: "rare"
    }),
    silverore: () => ({
        itemId: randomNum(),
        name: "silverore",
        dn: "Silver Ore",
        itemCateg: "crafting",
        itemType: "material",
        qnty: 1,
        price: { coinType: "bronze", pieces: 12 },
        desc: "A pale, lustrous ore favored by silversmiths.",
        rarity: "uncommon"
    }),
    sunduskore: () => ({
        itemId: randomNum(),
        name: "sunduskore",
        dn: "Sundusk Ore",
        itemCateg: "crafting",
        itemType: "material",
        qnty: 1,
        price: { coinType: "bronze", pieces: 30 },
        desc: "Ore quarried at the edge of dusk, warm gold shot through with violet.",
        rarity: "rare"
    }),
    unobtanium: () => ({
        itemId: randomNum(),
        name: "unobtanium",
        dn: "Unobtanium",
        itemCateg: "crafting",
        itemType: "material",
        qnty: 1,
        price: { coinType: "bronze", pieces: 100 },
        desc: "An impossibly rare material. If you're holding this, you got lucky.",
        rarity: "legendary"
    }),
    // baseline organic/stone materials - see itemDictionary.js for their
    // crafting stat weights (these three are the low end on purpose: cheap,
    // common, and the only options a brand new character can craft with)
    wood: () => ({
        itemId: randomNum(),
        name: "wood",
        dn: "Wood",
        itemCateg: "crafting",
        itemType: "material",
        qnty: 1,
        price: { coinType: "bronze", pieces: 4 },
        desc: "A sturdy length of timber, good for grips and shafts.",
        rarity: "common"
    }),
    leather: () => ({
        itemId: randomNum(),
        name: "leather",
        dn: "Leather",
        itemCateg: "crafting",
        itemType: "material",
        qnty: 1,
        price: { coinType: "bronze", pieces: 6 },
        desc: "Tanned hide, supple enough to wrap a grip without slipping.",
        rarity: "common"
    }),
    // itemType "stone" (not "material") to match manastone's category -
    // see craftingui.js's getOwnedMaterials, which accepts both
    stone: () => ({
        itemId: randomNum(),
        name: "stone",
        dn: "Stone",
        itemCateg: "crafting",
        itemType: "stone",
        qnty: 1,
        price: { coinType: "bronze", pieces: 3 },
        desc: "A plain chunk of quarried stone. Common, but dependable.",
        rarity: "common"
    })
}

export function createLootItem(name){
    const factory = LOOT_TEMPLATES[name]
    if(!factory) return null
    return factory()
}
export const lootNames = Object.keys(LOOT_TEMPLATES)
