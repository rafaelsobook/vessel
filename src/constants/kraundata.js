import { startQuestionare } from '../components/conversations';
import { getCharState, rankOrder } from '../charactersystem/characterstate';

// tier key is literally the rank label - every rank gets its own flavor of Kraun's ore lore
function getKraunTier(){
    const charState = getCharState()
    const idx = rankOrder.indexOf(charState?.rank?.rankLabel)
    const rankIdx = idx === -1 ? 0 : idx
    return rankOrder[rankIdx]
}

// picks a random variant so repeat visits at the same rank don't always say the exact same thing
function pick(variants){
    return variants[Math.floor(Math.random() * variants.length)]
}

function toLines(messages){
    return messages.map(message => ({ name: "Kraun", isLeft: false, message }))
}

const kraunGreetings = {
    f: [
        ["Ah, a new face. Fresh recruit, unless I miss my guess.", "See that orange-rusted stone by the wall? That's iron ore, cheapest thing to mine, and still the backbone of every blade a rookie ever swings.", "Smelt it right and you've got a decent sword. Won't win you any songs, but it'll keep you breathing out there."],
        ["You've got that lost look. Let me guess, you don't know iron ore from a river rock yet.", "That rust-colored stone underfoot? Iron ore. Melt it down, hammer it flat, and that's your first real weapon.", "There's stronger stuff out there, adamantine and the like. But that's a conversation for when you've got a few more scars on you."],
    ],
    e: [
        ["Back again? Good, this stuff sinks in better with repetition.", "You should be smelting iron regularly by now. Refine it clean and it holds an edge a lot longer than raw ore ever will.", "Keep your ears open for talk of adamantine too. It's out there. Just not for someone still finding their footing."],
        ["Iron ore again, I take it? No shame in it, everyone starts there.", "The trick is temperature, not strength. Cook it too hot and you ruin the blade before you even swing it.", "Ask me about adamantine again once you've got a few kills under your belt."],
    ],
    d: [
        ["You're moving past iron now, aren't you? I can see it in how you carry yourself.", "Iron's fine for a start, but adamantine is where real smiths start paying attention. Strongest steel this side of the mountains, when it's forged properly.", "It doesn't come cheap or easy. But you're getting close enough that I don't mind saying its name out loud anymore."],
        ["Iron ore's basically instinct for you now, I'd wager.", "Time to set your sights higher. Adamantine, denser, harder, holds an edge iron could only dream of.", "Find yourself a vein of it and bring it to a proper smith. You'll feel the difference the first time you swing it."],
    ],
    c: [
        ["Adamantine's the word on everyone's lips once they reach your rank.", "It's the strongest steel we know how to work, at least with the tools most guilds have. A blade forged from it doesn't chip, doesn't dull, not for a long, long time.", "There are stronger metals still. But those names aren't spoken carelessly, not even in a guild hall like this."],
        ["You've got the look of someone who's swung an adamantine blade already.", "Good. That's the metal that separates adventurers from corpses, most days.", "Beyond that, there are ores that make even adamantine look common. But I'll let you earn the right to hear those names."],
    ],
    b: [
        ["Orichalcum. Lunarium. You've probably heard the names whispered by now.", "Legendary ores, both of them. Smiths dream of them their whole careers and never so much as touch a shard.", "A weapon forged from either one isn't just strong, it's remembered. Songs get written about blades like that."],
        ["You're strong enough now that I don't mind talking about the real stuff.", "Orichalcum burns gold under torchlight, they say. Lunarium glows faintly even in the dark. Both near-impossible to find, harder still to forge.", "Keep climbing. A weapon built from either one is worth more than every sword in this guild hall combined."],
    ],
    a: [
        ["Orichalcum and Lunarium aren't just stories anymore, are they? Not to someone at your rank.", "A blade forged from Orichalcum cuts like it remembers every battle it was ever meant for. Lunarium, they say it never truly dulls, like the moon itself sharpens it each night.", "Find one. Forge one. You've more than earned the right to carry a legend."],
        ["Look at you. Rank like yours, I'd wager you've already gone looking for Orichalcum or Lunarium.", "Smart. Nothing else comes close, not iron, not even adamantine. Those two ores are the only things legendary weapons are ever built from.", "When you find one, don't trust just any smith with it. Bring it to someone who understands what they're holding."],
    ],
    s: [
        ["I don't get many at your rank walking through that door, you know.", "Orichalcum, Lunarium, you're past needing me to explain them. You've probably held both by now.", "Whatever you're forging next, I hope I'm still around to see it swung."],
        ["Truth be told, I've got nothing left to teach someone at your rank.", "You already know what Orichalcum and Lunarium can do in the right hands. Yours, clearly.", "Just promise me one thing, when that legendary blade is finished, you bring it back here first. I want to see it."],
    ],
}

const kraunMoreInfo = {
    f: ["Iron ore's easy to spot if you know what to look for, that dull orange-red crust on the rock is the giveaway.", "You'll find veins of it near cave entrances and shallow tunnels. Anywhere the ground's been disturbed, really.", "Bring me a decent haul sometime and I'll make sure it doesn't go to waste."],
    e: ["Keep digging in the shallow tunnels, iron doesn't hide too deep.", "The deeper you go, the better the yield, but the deeper you go, the more it costs to bring it back up in one piece.", "Adamantine veins run deeper still. You'll know you're close when the rock turns almost black."],
    d: ["Adamantine veins run deep and dark, almost black compared to the rock around it.", "Miners avoid those tunnels for a reason. Whatever guards deep veins like that isn't friendly.", "Bring a weapon better than iron if you're going hunting for it."],
    c: ["Adamantine doesn't just sit around waiting to be found. The deep veins are guarded, one way or another.", "Most smiths in this guild have worked with it at least once. Ask around, someone will point you to a good vein.", "Just don't go alone. Not for that metal."],
    b: ["Orichalcum's found where the sun barely reaches, deep ruins, old dead volcanoes, that sort of place.", "Lunarium's stranger still, some say it only appears under moonlight, in places touched by old magic.", "Neither one is going to just fall into your lap. You'll have to go looking, and go prepared."],
    a: ["I've heard tales of Orichalcum veins inside collapsed ruins, still warm centuries after whatever fire forged them.", "Lunarium's rarer. Some swear it only reveals itself during a full moon, in places where the old magic still lingers.", "Whatever you find, don't waste it on an ordinary smith. Find someone who's forged legendary steel before."],
    s: ["At this point you probably know more about where to find Orichalcum and Lunarium than I do.", "If you ever do find a fresh vein of either, the guild would be in your debt to know about it.", "But I trust your judgment. You've clearly earned that much."],
}

const kraunFarewell = {
    f: ["Take care out there. And watch where you swing that pickaxe."],
    e: ["Off you go. Try not to lose a finger to a bad iron vein."],
    d: ["Go on then. Adamantine won't mine itself."],
    c: ["Stay sharp. Both you and whatever blade you're carrying."],
    b: ["Go find your legend, then. I'll be here when you do."],
    a: ["May Orichalcum or Lunarium find their way to you soon."],
    s: ["Go on, hero. The guild's lucky to have someone like you asking about ore at all."],
}

export function kraunsData(){
    const tier = getKraunTier()
    return [
        {
            questionId: 20,
            conversationWithQuestion: toLines(pick(kraunGreetings[tier])),
            answers: [
                {
                    text: "Tell me more about ores",
                    cb: () => {
                        startQuestionare(21)
                    }
                },
                {
                    text: "Thanks, that's helpful",
                    cb: () => {
                        startQuestionare(22)
                    }
                },
            ],
            cb: () => {}
        },
        {
            questionId: 21,
            conversationWithQuestion: toLines(kraunMoreInfo[tier]),
            answers: [],
            cb: () => {}
        },
        {
            questionId: 22,
            conversationWithQuestion: toLines(kraunFarewell[tier]),
            answers: [],
            cb: () => {}
        },
    ]
}
