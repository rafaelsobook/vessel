import { randomNum } from "../tools/tools.js"
import { METAL_COLOR } from "../tools/metalmat.js"
import { createLootItem } from "../staticRecources/resourceLoot.js"

// The items the side stories hand out, and the tavern's fare.
//
// The game's own consumables are mirrored here field for field (the same
// copies tcp's quests.ts REWARD_FOODS and npcDetails.js's shops keep) - same
// name, so they stack with the ones a player already carries. The tavern's drinks
// borrow a picture through `icon`: the ale mug, tinted by quality
// (images/items/consumable/amberale.webp, hearthfirestout.webp, foundersbrew.webp,
// captainspour.webp - drawn by tools like the stew's, replace with real art any time).
//
// Eating or drinking applies plusDmg and plusSpd to the character FOR GOOD
// (itemInfoSystem.js's consumeItemFunc: stats.strength += plusDmg). So no
// repeatable reward carries one, and only the rare caps and the top-shelf brew do.

// ── how a consumable is built ───────────────────────────────────────────────
function consumable(name, dn, itemType, consumeAbilities, pieces, desc, { rarity = "normal", icon } = {}){
    return qnty => ({
        itemId: randomNum(),
        name,
        dn,
        itemCateg: "consumable",
        itemType,
        weaponType: false,
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, fillHunger: 0, fillTireness: 0, cure: [], ...consumeAbilities },
        price: { coinType: "bronze", pieces },
        qnty,
        desc,
        rarity,
        ...(icon ? { icon } : {}),
    })
}
const food = (name, dn, abilities, pieces, desc, options) => consumable(name, dn, "food", abilities, pieces, desc, options)
// a drink is a "potion" - it plays the drinking sound (and, unlike food, isn't mended after)
const drink = (name, dn, abilities, pieces, desc, options) => consumable(name, dn, "potion", abilities, pieces, desc, options)

// tcp's mushroomLibrary.ts cookableFood: fine raw, better roasted over a bonfire
// (cooking.js reads cookRecipe). ROAST_BOOST / ROAST_PRICE_BOOST are its own.
const ROAST_BOOST = 1.5
const ROAST_PRICE_BOOST = 2
function cap(name, dn, rarity, pieces, desc, stats){
    const base = { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, fillHunger: 0, fillTireness: 0, cure: [], ...stats }
    const boost = n => n ? Math.round(n * ROAST_BOOST) : 0
    return qnty => ({
        itemId: randomNum(),
        name, dn,
        itemCateg: "consumable",
        itemType: "food",
        consumeAbilities: { ...base },
        price: { coinType: "bronze", pieces },
        qnty, desc, rarity,
        canBeCooked: true,
        cookRecipe: {
            name: `roasted${name}`,
            dn: `Roasted ${dn}`,
            icon: `./images/items/consumable/${name}.webp`,
            consumeAbilities: { ...base, plusHp: boost(base.plusHp), plusMp: boost(base.plusMp), plusSp: boost(base.plusSp), fillHunger: boost(base.fillHunger), fillTireness: boost(base.fillTireness) },
            price: { coinType: "bronze", pieces: pieces * ROAST_PRICE_BOOST },
            desc: `Roasted over a bonfire - more filling, and it does more for you than eaten raw. ${desc}`,
        },
    })
}

// ── the game's own (mirrors) ────────────────────────────────────────────────
export const jerky = food("jerky", "Jerky", { plusHp: 50, plusSp: 10, fillHunger: 30 }, 5,
    "Strips of dried, salted meat - tough to chew, but it keeps for weeks on the road. A guild ration for new members.")
export const travelersAle = food("commonale", "Traveler's Ale", { plusHp: 150, plusSpd: 1, fillHunger: 20, fillTireness: 5 }, 4,
    "Thin, bitter, and exactly what every guide on a long road swears by. Keeps your feet moving after the sun's given up.")
export const sylfple = food("sylfple", "Sylfple", { plusHp: 200, fillHunger: 25 }, 2,
    "A delicate, green-skinned fruit, with soft, velvety flesh that emits a fresh, herbal fragrance.")
export const lunaraqum = food("lunaraqum", "Lunaraqum", { plusHp: 400, fillHunger: 30, fillTireness: 10, cure: ["poisoned"] }, 3,
    "A striking fruit with a deep crimson skin that glimmers like molten metal under moonlight. Its content can even cure poisons")

// the cap-keeper's caps (tcp's mushroomLibrary.ts - the client has no copy of them,
// Mushruu's table is only their text)
export const duskveil = cap("purple", "Duskveil", "rare", 18,
    "A violet cap streaked with darker veins. Mages chew it before a long night of casting. Its sap also closes open wounds, stopping a bleed.",
    { plusMp: 150, fillHunger: 8, cure: ["bleed"] })
export const mistcap = cap("bluemist", "Mistcap", "rare", 20,
    "Cold to the touch and wreathed in a faint blue haze. Clears the head and the lungs alike.",
    { plusMp: 80, plusSp: 150, fillTireness: 15 })
export const bloodcap = cap("crimson", "Bloodcap", "rare", 30,
    "Deep red and faintly warm, as if something still beats inside it. Hardens the arm that eats it - for good.",
    { plusHp: 120, plusDmg: 1, fillHunger: 10 })
export const devilsCrown = cap("devilred", "Devil's Crown", "epic", 80,
    "Found only near where the dungeon's master sleeps. Burns going down, and leaves the eater stronger for it.",
    { plusHp: 300, plusDmg: 3, fillHunger: 10 })

// ── the tavern's drinks - a ladder, so a harder job pours something better ──
// brewed from the grain players bring Tobbin (sidestories/tobbin.js). Each rung is
// worth more (price is what it sells for) and does more:
//   Hearth Ale (common) < Amber Ale (uncommon) < Hearthfire Stout (rare) < Founders' Brew (epic)
export const hearthAle = drink("hearthale", "Hearth Ale", { plusHp: 150, plusSp: 150, fillHunger: 10, fillTireness: 10 }, 14,
    "Tobbin's everyday pour, brewed from village grain. Pale, malty, and it puts the wind back in your legs.",
    { rarity: "common", icon: "./images/items/consumable/commonale.webp" })
export const amberAle = drink("amberale", "Amber Ale", { plusHp: 320, plusSp: 260, plusMp: 40, fillHunger: 15, fillTireness: 15 }, 40,
    "A second mash and a pinch of loam cap: darker, fuller, and twice the kick of the pale stuff. Tobbin only pours it for folk who've earned it.",
    { rarity: "uncommon", icon: "./images/items/consumable/amberale.webp" })
export const hearthfireStout = drink("hearthfirestout", "Hearthfire Stout", { plusHp: 650, plusSp: 350, plusMp: 120, fillHunger: 25, fillTireness: 20 }, 110,
    "Black as the spit's underside, brewed with ember caps and smoked over the tavern fire. Tobbin keeps a few barrels for those who come back from the wolves.",
    { rarity: "rare", icon: "./images/items/consumable/hearthfirestout.webp" })
// the one cup that stays with you: a point of strength, for good (see the note on top)
export const foundersBrew = drink("foundersbrew", "Founders' Brew", { plusHp: 1200, plusSp: 500, plusMp: 300, plusDmg: 1, fillHunger: 30, fillTireness: 30 }, 400,
    "The old guild's once-a-year brew: grain for the body, ember caps for the bite, a fire slime's core in the copper so the whole batch glows. Drink it when it matters.",
    { rarity: "epic", icon: "./images/items/consumable/foundersbrew.webp" })

// Vordz's old drink - back on the shelf once his debt is paid (sidestories/vordz.js)
export const captainsPour = drink("captainspour", "Captain's Pour", { plusHp: 250, plusSp: 150, plusMp: 60, fillHunger: 10, fillTireness: 5 }, 30,
    "Dark, peppery and older than the tavern's sign. Vordz swears one before a hard fight steadies the hand. He also swears two is how he lost a table.",
    { rarity: "uncommon", icon: "./images/items/consumable/captainspour.webp" })

// ── the tavern's food, and Maela's ──────────────────────────────────────────
export const hearthStew = food("hearthstew", "Hearth Stew", { plusHp: 350, plusSp: 60, fillHunger: 55, fillTireness: 10 }, 12,
    "Wolf rib, wild caps and barley, simmered all day over the tavern fire. A bowl of it and you can face the road again.",
    { rarity: "common" })
// Maela's gran's recipe (sidestories/maela.js)
export const gransStew = food("gransstew", "Gran's Mushroom Stew", { plusHp: 280, plusMp: 120, fillHunger: 50 }, 10,
    "Ember caps, loam caps and barley, the way Maela's gran made it for the guild before the long march. It tastes like somebody's home.",
    { rarity: "common", icon: "./images/items/consumable/hearthstew.webp" })

// ── ore ─────────────────────────────────────────────────────────────────────
/** `qnty` of an ore or material by resourceLoot.js's name ("silverore"...). */
export function ore(name, qnty){
    const item = createLootItem(name)
    if(item) item.qnty = qnty
    return item
}

// ── gear, scaled by the metal it's made of ─────────────────────────────────
// tcp's botItems.ts METAL_TIERS - the same ladder a bot's drops follow, so a
// reward in steel or silver is exactly what a bot's steel or silver piece would be
// (hand-copied; keep in step)
const METAL = {
    steel:  { prefix: "Steel",  rarity: "uncommon", defMult: 1.25, resMult: 1.1, priceMult: 1.8, color: METAL_COLOR.STEEL },
    silver: { prefix: "Silver", rarity: "uncommon", defMult: 1.2,  resMult: 1.6, priceMult: 2.4, color: METAL_COLOR.SILVER },
    gold:   { prefix: "Gold",   rarity: "rare",     defMult: 1.3,  resMult: 1.5, priceMult: 3.5, color: METAL_COLOR.GOLD },
}
// the plain iron pieces' base stats (Bram's shop: Pauldron 30, Gauntlet 30, Scale 45)
const PIECE = {
    pauldron: { name: "ironpaul", dn: "Pauldron", itemType: "pauldron", def: 20, res: 0, price: 30 },
    gauntlet: { name: "gauntler", dn: "Gauntlet", itemType: "gauntlet", def: 20, res: 10, price: 30 },
    armor:    { name: "knightscale", dn: "Knight's Scale", itemType: "armor", def: 20, res: 10, price: 45 },
}
/** A named piece of armour in a metal: stats and price follow the ladder. */
export function metalPiece(piece, metal, dn, desc){
    const base = PIECE[piece], tier = METAL[metal]
    return () => ({
        itemId: randomNum(),
        name: base.name,
        dn,
        itemCateg: "equipable",
        itemType: base.itemType,
        weaponType: undefined,
        equipAbilities: { dmg: 0, def: Math.round(base.def * tier.defMult), resistance: Math.round(base.res * tier.resMult), magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0 },
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0 },
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true,
        enhancedLevel: 0,
        slots: [],
        durability: { current: 100, max: 100 },
        price: { coinType: "bronze", pieces: Math.round(base.price * tier.priceMult) },
        qnty: 1,
        desc,
        rarity: tier.rarity,
        metalColor: tier.color,
    })
}
// Armin's old pauldron - dented on the left where a demon's knife turned against it
export const arminsPauldron = metalPiece("pauldron", "silver", "Armin's Silver Pauldron",
    "Dented on the left where a demon's knife turned against it. Armin wore it for nine years and never once had it mended.")

// Halden's spear - the one he carried the day Vargoth took the others. The game's one
// spear model (swordsdata.js's stormpiercer), a good deal better made than the plain ones
export const haldensSpear = () => ({
    itemId: randomNum(),
    name: "stormpiercer",
    dn: "Halden's Oathspear",
    itemCateg: "equipable",
    itemType: "weapon",
    weaponType: "spear",
    effectsWhenHit: [
        { effectName: "bash", distanceKnockback: 4, triggerWhen: "critical", particlesystem: null, texture: null },
    ],
    equipAbilities: { dmg: 40, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0 },
    consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0 },
    equiped: false,
    soulFeed: 0,
    isEnhanceAble: true,
    enhancedLevel: 0,
    slots: [],
    durability: { current: 100, max: 100 },
    price: { coinType: "bronze", pieces: 180 },
    qnty: 1,
    desc: "Steel-headed, ash-shafted, and scarred along the haft where a werewolf's claws once raked it. Halden carried it thirteen years and never once let it out of reach.",
    rarity: "rare",
    parts: {
        bladeRarity: "rare1", guardRarity: "rare1", handleRarity: "rare1", pommelRarity: "rare1",
        bladeColor: "steel", guardColor: "steel", handleColor: "wood", pommelColor: "steel",
    },
})
