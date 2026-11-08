// titlesData.js
//
// Canonical source for every title in the game - same pattern skillsData.js
// already established (named export per entry PLUS one aggregate array
// pulling them all together), so a title only ever gets defined ONCE and
// every consumer (npcDetails.js's own npcFighter reward, the "t" debug
// cheat below, any future quest/kill-count reward) references the same
// object instead of hand-duplicating {titleId, dn} inline and risking two
// copies drifting apart.
//
// titleId is the real database key (components/titleUI.js's receiveTitle,
// server/routes/characterR.js's /claim-title/:id) - exclusivity is enforced
// against this exact string, so once a titleId has ever been granted to a
// real character, DO NOT change it here or a currently-held title silently
// stops matching its own holder record.
//
// Only flameWardTitle is actually wired up to a real in-game trigger today
// (Renarden's own npcDetails.js entry). The rest are real, valid, claimable
// data - loosely themed after charDetM.js's own defeatedFoes foeType
// buckets (monster/human/demon/higher demon/dragon/god) as a natural future
// hook - but nothing currently grants them except the "t" debug cheat.
// color - a CSS color, themed to what the title actually is (Flame Ward is
// fire, so red; a higher demon reads darker/more ominous than a common one;
// dragon/god both lean into the same gold this game's own divine/legendary
// UI already uses elsewhere, e.g. the Title Acquired popup). Read by
// htmlcomp/guildboard.js's own leaderboard row to color each title
// individually instead of one flat color for the whole column.
export const flameWardTitle = {
    titleId: "101_flameward",
    dn: "Flame Ward",
    desc: "Earned by proving your strength against Renarden in single combat.",
    color: "#e05c3e",
}
export const monsterBaneTitle = {
    titleId: "102_monsterbane",
    dn: "Monster Bane",
    desc: "A hunter feared by every beast that stalks the wilds.",
    color: "#7fae5c",
}
export const demonsBaneTitle = {
    titleId: "103_demonsbane",
    dn: "Demon's Bane",
    desc: "Struck down a creature of the lower abyss and walked away standing.",
    color: "#9d6bd1",
}
export const heraldOfRuinTitle = {
    titleId: "104_heraldofruin",
    dn: "Herald of Ruin",
    desc: "Faced a higher demon and became the last thing it ever saw.",
    color: "#8f2f4f",
}
export const dragonSlayerTitle = {
    titleId: "105_dragonslayer",
    dn: "Dragon Slayer",
    desc: "Felled a dragon - a feat sung about long after the blade goes cold.",
    color: "#d19a3d",
}
export const godslayerTitle = {
    titleId: "106_godslayer",
    dn: "Godslayer",
    desc: "Defied something that was never meant to be defeated.",
    color: "#e8dfc8",
}

// ── SIDE-STORY TITLES (sidestories/) ─────────────────────────────────────────
// Earned by finishing an NPC's side story, not by being first - shared: true,
// so every character who earns one holds it (sidestories/kit.js's grantTitle
// saves it with the character, never through the server's one-holder
// /claim-title route the titles above use).
// bonus: what holding it does, read by titleBonus below -
//   critChance  percentage points on every melee swing's crit roll
//               (attackingSystem.js's calcDmg, on top of the capped accuracy chance)
//   meleeDmg    flat damage on every melee swing (calcDmg's physicalDmg)
export const heroesDescendantTitle = {
    titleId: "201_heroesdescendant",
    dn: "Heroes Descendant",
    desc: "Strong told you the Lantern's secret: strike where they bend, for whoever stands behind you. +8% critical strike chance.",
    color: "#f2d27a",
    shared: true,
    bonus: { critChance: 8 },
}
export const oathkeeperTitle = {
    titleId: "202_oathkeeper",
    dn: "Oathkeeper",
    desc: "Closed the debt Halden carried for thirteen years: Vargoth is dead. +15 damage on every melee strike.",
    color: "#c9d6e8",
    shared: true,
    bonus: { meleeDmg: 15 },
}
export const friendOfTheHearthTitle = {
    titleId: "203_friendofthehearth",
    dn: "Friend of the Hearth",
    desc: "Brought Tobbin the Founders' Brew's grain, caps and fire-slime core. Your mug is never empty at the Hearth.",
    color: "#d9894a",
    shared: true,
}

export const titlesData = [
    flameWardTitle,
    monsterBaneTitle,
    demonsBaneTitle,
    heraldOfRuinTitle,
    dragonSlayerTitle,
    godslayerTitle,
    heroesDescendantTitle,
    oathkeeperTitle,
    friendOfTheHearthTitle,
]

// title.titleId -> title object, same lookup convention skillsData.js's own
// SKILLS_BY_NAME already uses
export const TITLES_BY_ID = Object.fromEntries(titlesData.map(title => [title.titleId, title]))

/** The total of one bonus (e.g. "critChance") over every title a character holds. */
export function titleBonus(charState, stat){
    return (charState?.titles ?? []).reduce((total, held) => total + (TITLES_BY_ID[held?.titleId]?.bonus?.[stat] ?? 0), 0)
}
