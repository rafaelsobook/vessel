import { SKILLS_BY_NAME } from "./skillsData"
import { randomNum } from "../tools/tools"

// ============================================================
// SKILL BOOKS
// ============================================================
// A skill sold as an ITEM. itemCateg/itemType are both "skillbook" - the
// category is what itemInfoSystem.js's own switch keys off to swap the
// equip/consume button for a "learn" one, and the itemType is what the rest
// of the game reads the same way it reads "weapon"/"helmet"/etc.
//
// The only field that actually matters at learn time is `skillName`: it is a
// key into skillsData.js's own SKILLS_BY_NAME, and learnSkillFunc resolves
// the real skill object through it rather than the book carrying a copy of
// the skill. That matters because skills get rebalanced - a book bought
// three patches ago should teach the CURRENT version of the skill, not a
// snapshot of whatever it looked like when it was printed.
//
// Books have no icon art of their own and do not need any: a book's icon is
// the icon of the skill it teaches (./images/skills/<skillName>.webp, which
// already exists for every skill but purification). That is also the most
// readable choice - you can see what a book teaches from the inventory grid
// without opening it. inventory.js/buyorsell.js/itemInfoSystem.js each carry
// the same one-line override for it, alongside the ones they already have
// for weapons and helmets.

// A book's price and rarity come from the SKILL's own skillrank, not from
// hand-written per-book numbers - so a new skill dropped into skillsData.js
// is priced correctly the moment a witch stocks it, with nothing to keep in
// sync. skillrank 0 is "Basic Class", 1+ is "Elite Skill" and up (see
// skillsData.js's own header).
export const SKILLBOOK_PRICE_BY_RANK = { 0: 40, 1: 90, 2: 220, 3: 500, 4: 1100 }
export const SKILLBOOK_RARITY_BY_RANK = { 0: "normal", 1: "normal", 2: "rare", 3: "epic", 4: "legendary" }

/**
 * Build a sellable/inventory-ready skill book for one skill name.
 *
 * Returns null for a name that is not in SKILLS_BY_NAME rather than a book
 * that looks fine in a shop and then cannot be learned - a witch's toSell
 * array filters those out, so a typo costs you the listing and a console
 * warning instead of an item that silently does nothing when clicked.
 *
 * priceOverride is there for a witch who should sell something above or
 * below the standard rate for her own reasons; leave it out otherwise.
 */
export function makeSkillBook(skillName, priceOverride){
    const skill = SKILLS_BY_NAME[skillName]
    if(!skill){
        console.warn(`makeSkillBook: no skill named "${skillName}" in skillsData.js`)
        return null
    }

    const rank = skill.skillrank ?? 0
    return {
        itemId: randomNum(),
        // `name` stays the skill's own name so the book stacks with other
        // copies of itself (inventory.js's addItemToCharState stacks by name
        // for anything that is not "equipable") and so any future
        // name-keyed lookup lands on something real
        name: skillName,
        skillName,
        dn: `Tome of ${skill.displayName}`,
        itemCateg: "skillbook",
        itemType: "skillbook",
        // shown in the item panel instead of the stat rows (non-equipables
        // render desc, see showItemInfo) - leads with what the book DOES,
        // then repeats the skill's own description so you know what you are
        // buying before you learn it
        desc: `A witch's bound tome. Study it to learn ${skill.displayName}. ${skill.desc ?? ""}`.trim(),
        price: { coinType: "bronze", pieces: priceOverride ?? SKILLBOOK_PRICE_BY_RANK[rank] ?? 200 },
        qnty: 1,
        rarity: SKILLBOOK_RARITY_BY_RANK[rank] ?? "rare",
    }
}

/**
 * Build a whole shelf at once, dropping anything that did not resolve.
 * Used by npcDetails.js's witch toSell arrays.
 */
export function makeSkillBooks(skillNames){
    return skillNames.map(n => makeSkillBook(n)).filter(Boolean)
}
