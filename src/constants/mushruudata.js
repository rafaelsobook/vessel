import { startQuestionare } from '../components/conversations'

function toLines(messages){
    return messages.map(message => ({ name: "Mushruu", isLeft: false, message }))
}

function pick(variants){
    return variants[Math.floor(Math.random() * variants.length)]
}

// Mushruu (npcDetails.js's "121_mushruu") - the forager who sits by the
// dungeon's cave mouth and knows every mushroom growing inside it. Talking to
// him opens a menu (questionId 590): the common caps, the rare ones, the deep
// ones, and how to cook them. Each mushroom is one level further in, and goes
// back to its own list when he's done. He doesn't sell anything.
//
// What he knows is tcp/recources/mushroomLibrary.ts's MUSHROOM_LIBRARY, which
// the client can't import (tcp is its own project - the same reason
// botItems.ts mirrors inventory.js from the other side). kind, dn, minDepth
// and stats below are copied from it field for field, and the effect lines are
// written from `stats` instead of typed out, so a tuned number is a one-place
// edit here. A mushroom added or tuned there has to be changed here too.
const MUSHROOMS = [
    {
        kind: "brown", dn: "Loam Cap", group: "common", minDepth: 0,
        stats: { plusHp: 30, fillHunger: 18 },
        tale: "The Loam Cap - plain, brown, and everywhere. The first mushroom every delver learns, and the one that never lets them down.",
    },
    {
        kind: "orange", dn: "Ember Cap", group: "common", minDepth: 0,
        stats: { plusHp: 60, fillHunger: 12 },
        tale: "The Ember Cap. Bright orange, and it tastes faintly of smoke. It warms the blood a little.",
    },
    {
        kind: "swamp", dn: "Bog Cap", group: "common", minDepth: 0,
        stats: { plusHp: 40, plusSp: 60, fillHunger: 10 },
        tale: "The Bog Cap - slick and olive green, grown wherever the floor stays wet. It tastes like pond water, but it gets your legs moving again.",
    },
    {
        kind: "white", dn: "Pale Deathcap", group: "common", minDepth: 0,
        // the server's carries the whole poison effect; only its type is told here
        stats: { fillHunger: 8, inflict: [{ effectType: "poisoned" }] },
        tale: "The Pale Deathcap. Pale, pretty, and poisonous - the cap that fools every new forager exactly once.",
        extra: ["A Lunaraqum cures the poison. Better still, roast the cap first - the fire burns the poison clean out of it."],
    },
    {
        kind: "purple", dn: "Duskveil", group: "rare", minDepth: 0.4,
        stats: { plusMp: 150, fillHunger: 8, cure: ["bleed"] },
        tale: "The Duskveil - a violet cap streaked with darker veins. Mages chew it before a long night of casting.",
        extra: ["Its sap closes wounds, too. If you're going to face something whose claws leave you bleeding - the werewolves, say - carry one."],
    },
    {
        kind: "bluemist", dn: "Mistcap", group: "rare", minDepth: 0.4,
        stats: { plusMp: 80, plusSp: 150, fillTireness: 15 },
        tale: "The Mistcap. Cold to the touch and wreathed in a faint blue haze - it clears the head and the lungs alike.",
    },
    {
        kind: "crimson", dn: "Bloodcap", group: "rare", minDepth: 0.55,
        stats: { plusHp: 120, plusDmg: 1, fillHunger: 10 },
        tale: "The Bloodcap - deep red and faintly warm, as if something still beats inside it.",
    },
    {
        kind: "galaxygreen", dn: "Starspore", group: "deep", minDepth: 0.65,
        stats: { plusHp: 250, plusMp: 250, plusSp: 150, fillHunger: 15, fillTireness: 20 },
        tale: "The Starspore. Its cap is flecked with points of light, like a night sky. It mends body and mind at once.",
    },
    {
        kind: "devilred", dn: "Devil's Crown", group: "deep", minDepth: 0.75,
        stats: { plusHp: 300, plusDmg: 3, fillHunger: 10 },
        tale: "The Devil's Crown. It burns going down, and leaves the eater stronger for it.",
    },
]

// how deep (mushroomLibrary.ts's 0-1, by walking distance from the entrance) it starts to grow
function whereLine(minDepth){
    if(minDepth <= 0) return "It grows anywhere in the cave, from the entrance in."
    if(minDepth < 0.5) return "It only grows in the deeper half of the cave."
    if(minDepth < 0.7) return "It only grows well past the middle of the cave."
    return "It only grows in the deepest rooms, near where the cave's master sleeps."
}

function joinList(parts){
    if(parts.length < 2) return parts.join("")
    return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
}

const CURES = { bleed: "stops bleeding", poisoned: "cures poison", cursed: "lifts a curse" }
const INFLICTS = { poisoned: "poisons you" }

// "Eaten raw, it restores 150 mana and fills 8 hunger. It also stops bleeding."
// - written off the mushroom's own stats (see MUSHROOMS)
function effectsLine(stats){
    const restores = []
    if(stats.plusHp) restores.push(`${stats.plusHp} life`)
    if(stats.plusMp) restores.push(`${stats.plusMp} mana`)
    if(stats.plusSp) restores.push(`${stats.plusSp} stamina`)
    if(stats.fillTireness) restores.push(`${stats.fillTireness} rest`)

    const eaten = []
    if(restores.length) eaten.push(`restores ${joinList(restores)}`)
    if(stats.fillHunger) eaten.push(`fills ${stats.fillHunger} hunger`)

    // a comma before the "and" only once the list before it has its own "and"
    const sentences = [`Eaten raw, it ${eaten.join(restores.length > 1 ? ", and " : " and ")}.`]
    // plusDmg / plusSpd are permanent: consumeItemFunc adds them to strength / speed
    if(stats.plusDmg) sentences.push(`It also adds ${stats.plusDmg} strength, for good.`)
    if(stats.plusSpd) sentences.push(`It also adds ${stats.plusSpd} speed, for good.`)
    stats.cure?.forEach(status => sentences.push(`It ${CURES[status] ?? `cures ${status}`}.`))
    stats.inflict?.forEach(effect => sentences.push(`But it ${INFLICTS[effect.effectType] ?? `inflicts ${effect.effectType}`}.`))
    return sentences.join(" ")
}

function mushroomLines(mushroom){
    return [`${mushroom.tale} ${whereLine(mushroom.minDepth)}`, effectsLine(mushroom.stats), ...(mushroom.extra ?? [])]
}

// Question ids: 590-595 are the menus, each mushroom is MUSHROOM_ID_BASE plus
// its place in MUSHROOMS. Clear of every other NPC's (Zerech's run to 585).
const MENU = 590
const GROUP_MENUS = { common: 591, rare: 592, deep: 593 }
const COOKING = 594
const FAREWELL = 595
const MUSHROOM_ID_BASE = 600

// each list stays at 5 buttons or fewer - the choice box shows about that many
const GROUPS = {
    common: {
        label: "The common caps",
        openers: ["The ones you'll trip over the moment you step inside. Which one?", "Common, but never boring. Which one?"],
    },
    rare: {
        label: "The rare caps",
        openers: ["Past the first rooms, where the air turns damp. Worth the walk. Which one?", "You have to go looking for these. Which one?"],
    },
    deep: {
        label: "The deep ones",
        openers: ["Only the deepest rooms grow these. Few come back with one. Which?", "The ones the cave guards. Which one?"],
    },
}

const menuOpeners = [
    "Which cap is troubling you?",
    "Ask away. I never tire of this.",
    "Well? Which one shall we talk about?",
]

const cookingLines = [
    "Roasting is the other half of the craft. Craft yourself a bonfire, set a cap on the spit, and give it a few seconds.",
    "Roasted, a cap gives half again as much - life, mana, stamina, hunger, rest - and fetches twice the price.",
    "The fire burns the poison out of a Pale Deathcap. It won't make a Bloodcap or a Devil's Crown any stronger, though - and a roasted Duskveil still closes wounds.",
]

const farewells = [
    ["Mind the spores on your way. And don't eat anything I haven't named."],
    ["Come back when you find one you can't name. I'll be here, as always."],
]

export function mushruuData(){
    return [
        {
            questionId: MENU,
            conversationWithQuestion: toLines([pick(menuOpeners)]),
            answers: [
                ...Object.entries(GROUPS).map(([group, { label }]) => ({ text: label, cb: () => startQuestionare(GROUP_MENUS[group]) })),
                { text: "Preparing them", cb: () => startQuestionare(COOKING) },
                { text: "Never mind", cb: () => startQuestionare(FAREWELL) },
            ],
            cb: () => {}
        },
        ...Object.entries(GROUPS).map(([group, { openers }]) => ({
            questionId: GROUP_MENUS[group],
            conversationWithQuestion: toLines([pick(openers)]),
            answers: [
                ...MUSHROOMS
                    .map((mushroom, i) => ({ mushroom, id: MUSHROOM_ID_BASE + i }))
                    .filter(({ mushroom }) => mushroom.group === group)
                    .map(({ mushroom, id }) => ({ text: mushroom.dn, cb: () => startQuestionare(id) })),
                { text: "Ask about something else", cb: () => startQuestionare(MENU) },
            ],
            cb: () => {}
        })),
        // answers: [] - when he's done talking, cb takes you back to the list
        ...MUSHROOMS.map((mushroom, i) => ({
            questionId: MUSHROOM_ID_BASE + i,
            conversationWithQuestion: toLines(mushroomLines(mushroom)),
            answers: [],
            cb: () => startQuestionare(GROUP_MENUS[mushroom.group])
        })),
        {
            questionId: COOKING,
            conversationWithQuestion: toLines(cookingLines),
            answers: [],
            cb: () => startQuestionare(MENU)
        },
        {
            questionId: FAREWELL,
            conversationWithQuestion: toLines(pick(farewells)),
            answers: [],
            cb: () => {}
        },
    ]
}
