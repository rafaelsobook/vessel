// Candidate titles per rank (rankOrder: f, e, d, c, b, a, s - see characterstate.js).
// Nothing here is wired up yet - review the pools below before any code assigns these to a character.
export const rankTitles = {
    f: [
        "Rookie Adventurer",
        "Wandering Novice",
        "Greenhorn",
        "Fledgling Explorer",
        "Wide-Eyed Wanderer",
        "Guild Initiate",
        "Untested Blade",
    ],
    e: [
        "Novice Explorer",
        "Apprentice Adventurer",
        "Trailblazer-in-Training",
        "Budding Mercenary",
        "Scrappy Survivor",
        "Junior Guildsman",
        "Rising Novice",
    ],
    d: [
        "Aspiring Hero",
        "Seasoned Novice",
        "Capable Adventurer",
        "Field-Tested",
        "Steady Hand",
        "Proven Wanderer",
        "Journeyman-in-Waiting",
    ],
    c: [
        "Brave Initiate",
        "Journeyman Adventurer",
        "Battle-Hardened",
        "Guild Regular",
        "Dependable Blade",
        "Skilled Wayfarer",
        "Vanguard Recruit",
    ],
    b: [
        "Rising Star",
        "Veteran Adventurer",
        "Distinguished Guildsman",
        "Formidable Hunter",
        "Trusted Vanguard",
        "Elite Recruit",
        "Renowned Wanderer",
    ],
    a: [
        "Elite Adventurer",
        "Champion of the Guild",
        "Legend-in-the-Making",
        "Master Hunter",
        "Heroic Vanguard",
        "Storied Warrior",
        "Peerless Blade",
    ],
    s: [
        "Legendary Hero",
        "Mythic Adventurer",
        "Guild Paragon",
        "Ascended Champion",
        "Living Legend",
        "Sovereign of the Guild",
        "Immortalized Vanguard",
    ],
}

// Not called anywhere yet - left here for when title assignment is ready to wire up.
export function getTitlesForRank(rankLabel){
    return rankTitles[rankLabel] || []
}

export function getRandomTitleForRank(rankLabel){
    const pool = getTitlesForRank(rankLabel)
    if(!pool.length) return null
    return pool[Math.floor(Math.random() * pool.length)]
}
