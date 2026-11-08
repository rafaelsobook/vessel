import { say, ask, line, pick, startQuest, isActive, isCleared, fetchQuest, turnIn } from "./kit.js"
import { startQuestionare } from "../components/conversations.js"
import { buyOrSell } from "../components/buyorsell.js"
import { travelersAle, hearthAle, amberAle, hearthfireStout, foundersBrew, hearthStew, captainsPour } from "./fare.js"
import { friendOfTheHearthTitle } from "../staticRecources/titlesData.js"
import { getCharState } from "../charactersystem/characterstate.js"

// TOBBIN - keeper of the Hearth, the village tavern (placeId 18, npcDetails.js's
// "123_tobbin"). The tavern runs on what players bring him, grain above all -
// it's the beer - and he pays in what he brews. The harder the job, the better
// the pour (fare.js's ladder, rarity and all):
//
//   job                              asks                              pays
//   Barley for the Barrels   tier 1  10 grain (the village wall)       5 Hearth Ale        (common)
//   The Second Mash          tier 2  15 grain, 4 loam caps             4 Amber Ale         (uncommon)
//   Kindling for the Hearth  tier 2  10 wood                           4 Amber Ale
//   Meat for the Spit        tier 4  3 wolf ribs (the strays' packs)   4 Hearthfire Stout  (rare)
//   The Founders' Brew       tier 4  25 grain, 3 ember caps, a core    Founders' Brew + a Stout, and the title (epic)
//   A Grain Run (repeatable) tier 1  10 grain                          3 Hearth Ale
//
// Each job puts something on his shelf (tobbinStock below - his toSell). Vordz's
// old debt is handed in here too (vordz.js). He also trades in rumours - every one
// of them true of this world.
const NAME = "Tobbin"
export const TOBBIN_ID = "123_tobbin"
const B = 1300
const MENU = B
const BOARD = B + 10
const RUMOURS = B + 20
const T = messages => say(NAME, messages)

const BARLEY = fetchQuest({
    qName: "tobbin-barley",
    qTtle: "Barley for the Barrels",
    desc: "Tobbin's barley bins are empty and a tavern without beer is just a room with chairs. Bring him 10 Grain - it grows wild along the inside of the village wall, and in fields out in the wilds. He pays in Hearth Ale.",
    items: [["grain", "Grain", 10]],
})
const MASH = fetchQuest({
    qName: "tobbin-second-mash",
    qTtle: "The Second Mash",
    desc: "An amber ale wants a second mash and an earthy note. Bring Tobbin 15 Grain and 4 Loam Caps (the brown caps of the wilds and the cave). He pays in Amber Ale - darker and stronger than the pale stuff.",
    items: [["grain", "Grain", 15], ["brown", "Loam Cap", 4]],
})
const KINDLING = fetchQuest({
    qName: "tobbin-kindling",
    qTtle: "Kindling for the Hearth",
    desc: "The hearth is eating logs faster than Tobbin can buy them. Bring 10 Wood - put an edge to any tree and it gives. He pays in Amber Ale.",
    items: [["wood", "Wood", 10]],
})
const SPIT = fetchQuest({
    qName: "tobbin-spit",
    qTtle: "Meat for the Spit",
    desc: "The tavern's spit has been empty a week. Bring Tobbin 3 Wolf Ribs, raw - the stray wolves hunt in packs far out past the deer, and a pack is no small fight. He pays in Hearthfire Stout, the rare brew.",
    items: [["rib", "Wolf Rib", 3]],
})
const FOUNDERS = fetchQuest({
    qName: "tobbin-founders-brew",
    qTtle: "The Founders' Brew",
    desc: "The old guild's once-a-year brew: 25 Grain for the body, 3 Ember Caps for the bite, and a Fire Slime Core in the copper so the whole batch glows. The top shelf - a bottle of it is yours.",
    items: [["grain", "Grain", 25], ["orange", "Ember Cap", 3], ["fireslimecore", "Fire Slime Core", 1]],
})
const GRAIN_RUN = fetchQuest({
    qName: "tobbin-grain-run",
    qTtle: "A Grain Run",
    desc: "The barrels are thirsty again. Bring Tobbin 10 Grain for a round of Hearth Ale.",
    items: [["grain", "Grain", 10]],
})

// the chain, in order - what the board offers next
const CHAIN = [
    { quest: BARLEY, offer: [
        "Help? Friend, I'm drowning. The barley bins are empty, and a tavern without beer is just a room with chairs.",
        "Bring me ten bundles of grain. It grows wild along the inside of the village wall, away from the gates - and in little fields out in the wilds.",
        "I pay in what I brew. The first batch is a plain Hearth Ale, and you'll drink the first of it.",
    ] },
    { quest: MASH, offer: [
        "The first barrel's gone in a night. Folk want something darker, and a proper amber ale wants a second mash.",
        "Fifteen grain, and four loam caps - the brown ones, from out in the wilds or down in the cave. A pinch of loam gives it the earthy note.",
        "Amber Ale, that is. Twice the kick of the pale stuff, and I only pour it for folk who've earned it.",
    ] },
    { quest: KINDLING, offer: [
        "The fire's the heart of this place - and it's eating logs faster than I can buy them.",
        "Ten logs. Any tree will do; put an edge to one and it gives. Another four Amber for your trouble.",
    ] },
    { quest: SPIT, offer: [
        "The spit's been empty a week. Folk come in for meat, and I hand them soup and an apology.",
        "Three wolf ribs, from the stray wolves out past the deer. Bring them raw - I'll do the roasting.",
        "Mind it: they hunt in packs, and a pack is no small fight. That's why this one pays in stout. Hearthfire Stout - black, smoked, and I don't pour it for just anyone.",
    ] },
    { quest: FOUNDERS, offer: [
        "You've kept this place alive. So let me tell you about the Founders' Brew.",
        "The old guild brewed it once a year. Grain for the body, ember caps for the bite, and a fire slime's core dropped in the copper so the whole batch glows.",
        "Twenty-five grain, three ember caps, one fire slime core. Bring them, and a bottle of the top shelf is yours - and every adventurer in this village drinks to your name tonight.",
    ] },
]

const RUMOUR_LINES = [
    "Four stones stand at the crossroads past the gate, and each one names a beast at the edge of the world. Zerech reads them like a man reading his own death notice.",
    "Halden on the gate met one of those four beasts, and lived. Buy him a drink some day - he won't drink it, but he might talk.",
    "When fog rolls in, the dead get up out of the ground. Doran says running only buys you time - but when the fog lifts, they drop where they stand.",
    "Ghosts walk in the old graveyards out in the wilds. Steel goes straight through them. Folk who go in swinging a sword come back pale, if they come back.",
    "Guild saying: if the land ahead of you turns dark, you turn around. Nobody who kept walking ever came back to argue.",
    "The witches in their towers sell tomes - spells, bound in leather. Vesper's the one to start with. Her sisters are... less patient.",
    "Old wells, grottos, caves behind falling water. Adventurers swear the lost expeditions left their best gear down in places like that.",
    "Fire slimes lob their fire where you're going, not where you are. When the ground lights up under you, move. Every regular in here learned that the hard way.",
    "Stray wolves hunt in packs, far out past the deer. Their ribs make a fine stew, if you live long enough to bring them back.",
    "A standing wolf's claws leave a bleed that won't stop on its own. Mushruu knows the cap that closes it. Ask him before you need to.",
]

function nextJob(){
    return CHAIN.find(({ quest }) => !isCleared(quest.qName)) ?? null
}
function activeJob(){
    return [...CHAIN.map(({ quest }) => quest), GRAIN_RUN].find(quest => isActive(quest.qName)) ?? null
}

/** What's on Tobbin's shelf - his toSell (npcDetails.js), which grows with what you've brought him. */
export function tobbinStock(){
    const cleared = qName => !!getCharState()?.clearedQuests?.includes(qName)
    return [
        travelersAle(1),
        ...(cleared(BARLEY.qName) ? [hearthAle(1)] : []),
        ...(cleared(MASH.qName) ? [amberAle(1)] : []),
        ...(cleared(SPIT.qName) ? [hearthStew(1)] : []),
        // back on the shelf once Vordz's old debt is paid (vordz.js)
        ...(cleared("vordz-old-debt") ? [captainsPour(1)] : []),
        // the stout and the Founders' Brew are never for sale - they're what he pours for those who earn them
    ]
}

function boardNode(){
    const active = activeJob()
    if(active) return line(BOARD, T([`You're already on "${active.qTtle}" for me. The barrels won't fill themselves!`]), () => startQuestionare(MENU))
    const job = nextJob()
    if(job) return ask(BOARD, T(job.offer), [
        ["I'll do it.", () => { startQuest(job.quest); startQuestionare(BOARD + 1) }],
        ["Not right now.", BOARD + 2],
    ])
    return ask(BOARD, T([
        "You've done more for this place than anyone since the founders. But the barrels are always thirsty.",
        "Ten more grain, and a round of Hearth Ale for it - same as always?",
    ]), [
        ["Ten grain, coming up.", () => { startQuest(GRAIN_RUN, { repeatable: true }); startQuestionare(BOARD + 1) }],
        ["Not today.", BOARD + 2],
    ])
}

export default {
    npcId: TOBBIN_ID,
    option: () => null,     // his whole menu is his own (MENU below)
    questions: () => [
        ask(MENU, T(pick([
            ["Welcome to the Hearth! Mind the step - and the table on the left. It bites."],
            ["Tobbin, at your service. Sit, drink, and tell me something I haven't heard."],
            ["Back again? The good chair's free. Well - the less bad one."],
        ])), [
            ["What's on tap?", () => buyOrSell(false, TOBBIN_ID)],
            ["Need any help around here?", BOARD],
            ["Heard any rumours?", RUMOURS],
            ["Just warming my hands.", B + 1],
        ]),
        line(B + 1, T([pick(["Warm as you like. The fire's free. The ale isn't.", "Stay as long as you like. Mind the dog - there's no dog. Mind it anyway."])])),
        boardNode(),
        line(BOARD + 1, T(["Lovely. I'll keep a mug cold for you."]), () => startQuestionare(MENU)),
        line(BOARD + 2, T(["No harm. The board's here when you're ready."]), () => startQuestionare(MENU)),
        ask(RUMOURS, T([pick(RUMOUR_LINES)]), [
            ["Another one?", RUMOURS],
            ["Thanks, Tobbin.", MENU],
        ]),
    ],
    turnIns: [
        [TOBBIN_ID, turnIn({
            npcName: NAME, quest: BARLEY, reopen: MENU, tier: 1,
            done: [
                "Ten bundles! That's three barrels' worth, if I'm careful - and I'm never careful.",
                "First five pints of the batch are yours - Hearth Ale, still warm. And it's on the shelf from today.",
            ],
            waiting: ["The barley bins are still empty. Grain grows along the inside of the village wall."],
            reward: () => ({ items: [hearthAle(5)] }),
        })],
        [TOBBIN_ID, turnIn({
            npcName: NAME, quest: MASH, reopen: MENU, tier: 2,
            done: [
                "Fifteen grain and four loam caps. Smell that? That's a second mash done right.",
                "Four bottles of the first pour - Amber Ale. Darker, fuller, and it'll stand you up straighter than anything pale. It goes on the shelf too.",
            ],
            waiting: ["Fifteen grain and four loam caps - the brown ones, from the wilds or the cave."],
            reward: () => ({ items: [amberAle(4)] }),
        })],
        [TOBBIN_ID, turnIn({
            npcName: NAME, quest: KINDLING, reopen: MENU, tier: 2,
            done: [
                "That'll see us through the cold nights. Hear it crackle? That's the sound of a tavern staying open.",
                "Four more of the amber, on the house, as promised.",
            ],
            waiting: ["Ten logs for the hearth. Any tree gives, to a blade."],
            reward: () => ({ items: [amberAle(4)] }),
        })],
        [TOBBIN_ID, turnIn({
            npcName: NAME, quest: SPIT, reopen: MENU, tier: 4, guild: { rank: "b", count: 3, per: 3 },
            done: [
                "Three ribs - and you walked back through that pack with them. Now THAT is a smell.",
                "Ribs on the spit, barley in the pot - Hearth Stew's back on tonight, and it's on the shelf.",
                "And for what you went through: four bottles of Hearthfire Stout. Brewed with ember caps, smoked over this very fire. I don't pour it for just anyone.",
            ],
            waiting: ["Three wolf ribs, raw. The strays hunt far out past the deer, and they hunt in packs - mind yourself."],
            reward: () => ({ items: [hearthfireStout(4)] }),
        })],
        [TOBBIN_ID, turnIn({
            npcName: NAME, quest: FOUNDERS, reopen: MENU, tier: 4,
            done: [
                "Twenty-five bundles, three caps, and a core still warm. Into the copper with it...",
                "It's glowing. It's GLOWING.",
                "Everyone in here is raising a mug to you. Listen to them!",
                "The first bottle of the Founders' Brew is yours - the top shelf, and I've only ever poured it for the founders. One cup and you're stronger for good, the old guild swore. They never once lied about beer.",
                "And a Hearthfire Stout to go with it. You're a friend of this hearth now, for good.",
            ],
            waiting: ["The Founders' Brew wants 25 grain, 3 ember caps and a fire slime core - the red slimes drop them."],
            reward: () => ({ title: friendOfTheHearthTitle, items: [foundersBrew(1), hearthfireStout(1)] }),
        })],
        [TOBBIN_ID, turnIn({
            npcName: NAME, quest: GRAIN_RUN, reopen: MENU, tier: 1, repeatable: true,
            done: ["Fresh grain! You're the reason this place smells like a bakery. Here - a round of Hearth Ale."],
            waiting: ["Ten grain for the barrels, whenever you're passing."],
            reward: () => ({ items: [hearthAle(3)] }),
        })],
    ],
}
