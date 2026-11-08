import { priceToBronze, COIN_VALUES } from "../charactersystem/currencySystem.js"
import { createLootItem } from "../staticRecources/resourceLoot.js"

// WHAT A SIDE QUEST'S REWARD SHOULD BE WORTH - so "matches how hard the quest is"
// is something that can be checked, not just eyeballed (sidestories test).
//
// The scale is the game's own: the guild board's pay (tcp's quests.ts RANK_TERMS
// coins - hand-copied below, keep them in step). A posted contract pays 100
// bronze for 2 water slimes, 150 for 3 fire slimes, 320 for 3 ghosts, 450 for
// 3 stray wolves, 700 for one standing wolf. Selling is at full price
// (buyorsell.js's earnFromPrice(item.price)), so what a reward sells for is what
// it is worth, and a quest that asks for materials must pay more than just
// selling them would.
//
//   tier 1  an errand      safe and near the village - a gather of cheap goods
//   tier 2  a task         a real effort: ore from the vein, a long chop
//   tier 3  a hunt         slime packs, ghosts, a rare cap deep in the wilds (D/C rank)
//   tier 4  a dangerous hunt   stray wolf packs, a long gather with a fight in it (B rank)
//   tier 5  a legend       a standing wolf (A rank)
export const TIER_WORTH = { 1: 70, 2: 150, 3: 300, 4: 480, 5: 800 }
/** a reward may land this far under or over its tier's worth */
export const TIER_BAND = [0.8, 1.65]
/** and a gather quest must pay this many times what the goods would sell for */
export const MATERIALS_FLOOR = 2
/**
 * A repeatable job (the tavern's grain run) pays less than a one-time errand of its tier -
 * between MATERIALS_FLOOR and this many times the goods - or it would be a farm.
 */
export const REPEATABLE_CEILING = 3

// tcp/recources/quests.ts RANK_TERMS.coins
export const GUILD_PAY = { f: 100, e: 150, d: 220, c: 320, b: 450, a: 700, s: 1000 }
/** a hunt is worth about this share of what the board pays for the same kills */
export const GUILD_SHARE = 0.8
/** `count` kills of what a contract of `rank` asks `per` of */
export const guildWorth = ({ rank, count, per }) => Math.round(GUILD_PAY[rank] * (count / per) * GUILD_SHARE)

// what a gather quest's goods sell for. The ores, wood, stone and grain come from
// resourceLoot.js itself; these are the rest (tcp's coreDetails.ts, meatLoots.ts,
// mushroomLibrary.ts)
const MATERIAL_PRICE = { fireslimecore: 50, rib: 5, orange: 2, brown: 1, galaxygreen: 55 }
export function materialPrice(name){
    const loot = createLootItem(name)
    return loot ? priceToBronze(loot.price) : (MATERIAL_PRICE[name] ?? 0)
}
export function materialsWorth(quest){
    return (quest?.questRequirements?.itemLists ?? []).reduce((total, entry) => total + materialPrice(entry.name) * entry.total, 0)
}

// ── a reward's worth ────────────────────────────────────────────────────────
export const STAT_POINT_WORTH = 150
export const MAX_HP_WORTH = 4          // per point
// a title's bonus: a point of crit chance is worth a lot more than a point of damage
const TITLE_BONUS_WORTH = { critChance: 40, meleeDmg: 15 }
const TITLE_HONOUR_WORTH = 50           // a title with no bonus is still a title

export function titleWorth(title){
    if(!title) return 0
    const bonuses = Object.entries(title.bonus ?? {})
    return bonuses.length ? bonuses.reduce((total, [stat, amount]) => total + (TITLE_BONUS_WORTH[stat] ?? 0) * amount, 0) : TITLE_HONOUR_WORTH
}
export function itemWorth(item){
    if(!item) return 0
    if(item.itemCateg === "currency") return (COIN_VALUES[item.name] ?? 0) * item.qnty
    return priceToBronze(item.price) * (item.qnty ?? 1)
}
export function rewardWorth({ items = [], title, maxHp = 0, statPoints = 0 } = {}){
    return items.filter(Boolean).reduce((total, item) => total + itemWorth(item), 0)
        + titleWorth(title) + maxHp * MAX_HP_WORTH + statPoints * STAT_POINT_WORTH
}

// ── what kind of thing a reward is, and what each NPC would hand out ────────
const CAPS = new Set(["orange", "brown", "swamp", "white", "purple", "bluemist", "crimson", "galaxygreen", "devilred"])
export function itemKind(item){
    if(item.itemCateg === "currency") return "coin"
    if(item.itemCateg === "skillbook") return "tome"
    if(item.itemCateg === "crafting") return "ore"
    if(item.itemCateg === "consumable"){
        if(CAPS.has(item.name)) return "mushroom"
        return item.itemType === "potion" ? "drink" : "food"
    }
    if(item.itemType === "weapon") return "weapon"
    return "gear"
}
/** The kinds of reward each NPC's story pays in - their trade, not a random purse. */
export const NPC_THEME = {
    "123_tobbin": ["drink"],                  // the tavern: drinks, and better ones for harder jobs
    "121_mushruu": ["mushroom"],              // the cap-keeper: caps
    "103_kraun": ["ore", "coin"],             // the smith: ore
    "115_maela": ["food", "coin"],            // the food stall
    "109_talin": ["tome", "coin"],            // the clerk with a mage's tome
    "108_corin": ["tome", "coin", "food"],    // the scout: notes, bounty, herbs
    "102_armin": ["gear", "coin"],            // the veteran: his old plate
    "122_halden": ["weapon", "coin"],         // the gate veteran: his spear and his savings
    "104_strong": ["coin", "food"],           // a guard: pay and rations
    "105_vords": ["coin", "drink"],           // the captain: coin and his own drink
    "107_wren": ["coin", "food"],             // a young guard: pay and rations
    "106_doran": ["coin", "food"],            // the carter: pay and road rations
}
