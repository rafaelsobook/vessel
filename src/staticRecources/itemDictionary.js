// Central catalog of every craftable material - the single source of truth
// for what a material IS (display name, category, which visual tint from
// metalmat.js/weaponmat.js it paints a part with) and how good it is at each
// weapon stat once forged. Two systems read this:
//   - craftingui.js's material picker (which materials are pickable, their
//     icon/tint) - replaces what used to be a separate hardcoded
//     MATERIAL_TINTS map duplicating this same key list.
//   - computeCraftedWeaponStats() below, which turns a set of 4 picked
//     materials (blade/guard/handle/pommel) into the crafted item's actual
//     dmg/magicDmg/durability/magicResistance numbers.
//
// statWeights are a 0-10 "how good is this material at X" quality score,
// NOT a final game number - see computeCraftedWeaponStats for how a
// material's weights get turned into real stats (they're combined with
// PART_ROLE_WEIGHTS below, since a material means something different in a
// blade than it does in a pommel).
export const ITEM_DICTIONARY = {
    // --- metals (see metalmat.js's METAL_TINTS) ---
    solarore: {
        dn: "Solar Ore", category: "metal", tintKey: "gold",
        statWeights: { physicalDamage: 5, magicDamage: 2, durability: 5, magicResistance: 1 },
    },
    bronzeore: {
        dn: "Bronze Ore", category: "metal", tintKey: "bronze",
        statWeights: { physicalDamage: 4, magicDamage: 1, durability: 4, magicResistance: 1 },
    },
    silverore: {
        dn: "Silver Ore", category: "metal", tintKey: "silver",
        // silver's the traditional anti-magic metal in most fantasy lore -
        // reads that way here too (best magicResistance among the metals)
        statWeights: { physicalDamage: 5, magicDamage: 3, durability: 5, magicResistance: 6 },
    },
    adamantine: {
        dn: "Adamantine", category: "metal", tintKey: "adamantine",
        // "near-indestructible" (resourceLoot.js desc) -> durability leader
        statWeights: { physicalDamage: 7, magicDamage: 2, durability: 10, magicResistance: 4 },
    },
    orichalcum: {
        dn: "Orichalcum", category: "metal", tintKey: "mythril",
        // "legendary alloy... never tarnish" - strong across the board
        statWeights: { physicalDamage: 8, magicDamage: 6, durability: 8, magicResistance: 6 },
    },
    unobtanium: {
        dn: "Unobtanium", category: "metal", tintKey: "stormcrystal",
        // priciest material in resourceLoot.js by a wide margin (100 vs the
        // next-highest at 60) - stats should say "this is the best material
        // in the game" unambiguously
        statWeights: { physicalDamage: 9, magicDamage: 9, durability: 9, magicResistance: 9 },
    },

    // --- gems/crystals (see weaponmat.js's GEM_TINTS) ---
    // dragonscale is the first genuinely BLACK tint in weaponmat.js's whole
    // palette (added alongside this entry) - every metal before it topped
    // out at iron's dull grey. Priced above every other material in
    // resourceLoot.js (150, vs unobtanium's own 100) - deliberately NOT
    // given a flat stat edge over unobtanium though (that material's own
    // comment: "stats should say this is the best material in the game
    // unambiguously"). Instead it's the specialist pick for raw toughness -
    // durability ties adamantine's own max (10, "near-indestructible"),
    // physicalDamage matches unobtanium's 9, but magicDamage/magicResistance
    // sit a notch below it - a dragon's hide reads as legendarily tough
    // before it reads as magical.
    blackdragon: {
        dn: "Black Dragon Scale", category: "gem", tintKey: "dragonscale",
        statWeights: { physicalDamage: 9, magicDamage: 6, durability: 10, magicResistance: 7 },
    },
    celestineore: {
        dn: "Celestine Ore", category: "gem", tintKey: "frostshard",
        // "prized by enchanters" - magic specialist, fragile
        statWeights: { physicalDamage: 2, magicDamage: 7, durability: 3, magicResistance: 6 },
    },
    bloodstone: {
        dn: "Bloodstone", category: "gem", tintKey: "beastheart",
        // "sharpens the wielder's aggression" - raw offense, no wards
        statWeights: { physicalDamage: 6, magicDamage: 4, durability: 3, magicResistance: 2 },
    },
    phoenixore: {
        dn: "Phoenix Ore", category: "gem", tintKey: "firecrystal",
        statWeights: { physicalDamage: 5, magicDamage: 8, durability: 4, magicResistance: 3 },
    },
    rubyore: {
        dn: "Ruby Ore", category: "gem", tintKey: "ruby",
        statWeights: { physicalDamage: 5, magicDamage: 5, durability: 4, magicResistance: 3 },
    },
    sunduskore: {
        dn: "Sundusk Ore", category: "gem", tintKey: "gold",
        statWeights: { physicalDamage: 4, magicDamage: 6, durability: 3, magicResistance: 4 },
    },
    manastone: {
        dn: "Manastone", category: "stone", tintKey: "sodalite",
        // "humming with latent magical energy" - the purest magic stat
        // stick in the dictionary, but soft/fragile as a structural part
        statWeights: { physicalDamage: 1, magicDamage: 9, durability: 2, magicResistance: 7 },
    },

    // --- organic/base materials (see weaponmat.js's ORGANIC_TINTS) ---
    wood: {
        dn: "Wood", category: "organic", tintKey: "wood",
        statWeights: { physicalDamage: 1, magicDamage: 1, durability: 2, magicResistance: 2 },
    },
    leather: {
        dn: "Leather", category: "organic", tintKey: "leather",
        // flexible grip material - doesn't shatter, decent ward, no edge
        statWeights: { physicalDamage: 1, magicDamage: 0, durability: 3, magicResistance: 3 },
    },
    stone: {
        dn: "Stone", category: "stone", tintKey: "bluegranite",
        // plain quarried rock - the baseline "common" material, no magic to speak of
        statWeights: { physicalDamage: 3, magicDamage: 0, durability: 4, magicResistance: 1 },
    },
}

// how much a material's statWeights matter depends on WHICH part it's used
// in - a magic-heavy material means a lot more in a pommel (the traditional
// "focus" part in fantasy sword design) than it does in a handle. Weights
// don't need to sum to 1 - they're independent per stat, tuned by feel.
export const PART_ROLE_WEIGHTS = {
    blade:  { physicalDamage: 1.0, magicDamage: 0.3, durability: 0.5, magicResistance: 0.2 },
    guard:  { physicalDamage: 0.4, magicDamage: 0.4, durability: 0.4, magicResistance: 0.5 },
    handle: { physicalDamage: 0.2, magicDamage: 0.2, durability: 0.7, magicResistance: 0.4 },
    pommel: { physicalDamage: 0.3, magicDamage: 0.7, durability: 0.3, magicResistance: 0.4 },
}

// maps a raw weighted-sum score (see computeCraftedWeaponStats) to an
// actual game number. BASE is what an all-zero-weight build would produce
// (never happens in practice, everything in ITEM_DICTIONARY has at least
// some weight), SCALE is how much each point of raw score is worth.
// Tuned so the result lands in roughly the same range the hand-authored
// swordsdata.js entries already use (dmg 14-27) rather than introducing a
// wildly different power level - see the comment above buildSwordItem() in
// craftingui.js for the actual min/max this produces.
const STAT_CURVE = {
    physicalDamage:  { base: 10, scale: 1 },
    magicDamage:     { base: 0,  scale: 1.5 },
    durability:      { base: 60, scale: 3 },
    magicResistance: { base: 0,  scale: 1.5 },
}

// selectedMaterials: { blade: {materialName}, guard: {...}, handle: {...}, pommel: {...} }
// (craftingui.js's shape - only materialName is read here, tintKey/label
// are UI concerns). Returns the crafted weapon's real stats.
//
// NOT wired into combat yet beyond that - magicDmg has always existed in
// weapon equipAbilities but attackingSystem.js's calcDmg() never reads it
// (magic damage there comes purely from character stats), and
// magicResistance is a brand new field with no consumer yet at all (no
// existing system - buffs like attachLightning.js's effect are purely
// visual, they don't read or apply against any stat). This function only
// promises to GENERATE the right numbers from materials; making combat
// actually use magicDmg/magicResistance is a separate, larger change to
// attackingSystem.js's live damage formulas that needs its own balance
// pass, not something to fold in silently here.
export function computeCraftedWeaponStats(selectedMaterials){
    const raw = { physicalDamage: 0, magicDamage: 0, durability: 0, magicResistance: 0 }

    for (const part of ["blade", "guard", "handle", "pommel"]) {
        const picked = selectedMaterials[part]
        const material = picked && ITEM_DICTIONARY[picked.materialName]
        if (!material) continue
        const roleWeights = PART_ROLE_WEIGHTS[part]
        for (const stat in raw) {
            raw[stat] += material.statWeights[stat] * roleWeights[stat]
        }
    }

    const toGameNumber = (stat) => Math.round(STAT_CURVE[stat].base + raw[stat] * STAT_CURVE[stat].scale)

    return {
        dmg: toGameNumber("physicalDamage"),
        magicDmg: toGameNumber("magicDamage"),
        durabilityMax: toGameNumber("durability"),
        magicResistance: toGameNumber("magicResistance"),
    }
}
