import { say, ask, line, startQuest, isActive, isCleared, huntQuest, turnIn, coins } from "./kit.js"
import { startQuestionare } from "../components/conversations.js"
import { lunaraqum } from "./fare.js"
import { makeSkillBook } from "../staticRecources/skillBooks.js"

// CORIN - the outer-ring scout. After his tree-line chain, he's found tracks:
// four sets, paw at the front and heel at the back - the standing wolves. Before
// any of that he teaches the slimes past the blue ones: the fire slimes (watch
// the ring on the ground) and the electric ones (they dodge and blink - let them
// come back). A scout pays in what a scout has: notes (a tome), the watch's
// bounty, and herbs - and the harder slimes pay better. Fire slimes (a rank-1
// tome, 16 silver) < electric slimes (a rank-2 tome, 14 silver, worth more) - the
// guild board pays the same 150 for 3 of either, so these are six and five. At
// the end he tells you which way one set of tracks leads.
const NAME = "Corin"
const ID = "108_corin"
const B = 1080
const S = messages => say(NAME, messages)

const FIRE_LINE = huntQuest({
    qName: "corin-fireline",
    qTtle: "The Fire Line",
    desc: "Fire slimes have crept in past the far fence - the red ones, a little further out than the blue. They lob fireballs: when a ring lights up under you, move. Thin out 6 of them.",
    enemy: "fireslime",
    count: 6,
})
const SPARK_LINE = huntQuest({
    qName: "corin-sparkline",
    qTtle: "Follow the Crackle",
    desc: "Electric slimes live past the fire ones. They dodge half your swings and blink away when hurt - don't chase, let them come back. Hunt 5 of them.",
    enemy: "electricslime",
    count: 5,
})

export default {
    npcId: ID,
    option(){
        if(!isCleared("corin-treeline-2") || isActive(FIRE_LINE.qName) || isActive(SPARK_LINE.qName)) return null
        if(!isCleared(FIRE_LINE.qName)) return ["Anything new past the tree line?", B]
        if(!isCleared(SPARK_LINE.qName)) return ["Anything else out there?", B + 4]
        return ["Still watching those tracks?", B + 8]
    },
    questions: () => [
        ask(B, S([
            "Tracks. Four sets, out past the deer ground. Paw at the front, heel at the back - something that walks on two legs when it wants to.",
            "Halden won't look at them when I bring it up. That tells me plenty.",
            "Before we worry about those - fire slimes have crept in past the far fence. The red ones. They don't just bump you. They spit fire.",
            "Watch the ground. When a ring lights up under your feet, that's where the fireball's coming down. Move, and keep moving.",
        ]), [
            ["I'll thin the fire slimes.", () => { startQuest(FIRE_LINE); startQuestionare(B + 1) }],
            ["Two legs?", B + 2],
        ]),
        line(B + 1, S(["Six should do it. They live a little further out than the blue ones - you'll see the glow."])),
        ask(B + 2, S([
            "Two legs. I've tracked everything that lives in these woods, and nothing that size walks upright.",
            "Ask Halden about it some day. Carefully.",
        ]), [
            ["I'll handle the fire slimes first.", () => { startQuest(FIRE_LINE); startQuestionare(B + 1) }],
            ["Later.", B + 3],
        ]),
        line(B + 3, S(["Suit yourself. The tracks will still be there. That's what worries me."])),
        ask(B + 4, S([
            "There's a yellow kind further out still. Electric. They dodge half your swings, and when they're hurt, they blink away in a flash of light.",
            "Don't chase. Let them come back to you - they always do.",
        ]), [
            ["I'll hunt them.", () => { startQuest(SPARK_LINE); startQuestionare(B + 5) }],
            ["Not today.", B + 3],
        ]),
        line(B + 5, S(["Five of them. They're past the fire ones - follow the crackle."])),
        line(B + 8, S([
            "Every morning. The prints don't come any closer - yet.",
            "You keep getting stronger. I'll keep watching. Deal?",
        ])),
    ],
    turnIns: [
        [ID, turnIn({
            npcName: NAME,
            quest: FIRE_LINE,
            tier: 3,
            guild: { rank: "e", count: 6, per: 3 },
            done: [
                "You came back unburnt. Most don't, their first time.",
                "The watch posts a bounty on fire slimes - sixteen silver, and it's yours. And a few herbs from my pack, for the burns.",
                "And this - I copied it out of an old scout's journal years ago. It's how you close a gap before they can turn. You'll want it for what's further out.",
            ],
            waiting: ["Six fire slimes. Remember the ring on the ground - move when it lights."],
            reward: () => ({ items: [makeSkillBook("dashstrike"), coins("silver", 16), lunaraqum(3)] }),
        })],
        [ID, turnIn({
            npcName: NAME,
            quest: SPARK_LINE,
            tier: 3,
            guild: { rank: "e", count: 5, per: 3 },
            done: [
                "Five. And you're still twitching - that's normal, it passes.",
                "The watch pays more for these - fourteen silver. And a mage passing through traded me this for a week of guiding: how the lightning is channelled. I never could cast it. You might.",
                "Now, the tracks. I followed one set as far as I dared. It heads out to a far corner of the wilds, where the wolf packs run. Brown fur caught on the thorns.",
                "Vargoth, if Halden's stories are true. Don't go yet. But now you know which way.",
            ],
            waiting: ["Five electric slimes. Let them come to you."],
            reward: () => ({ items: [makeSkillBook("thunderstrike"), coins("silver", 14)] }),
        })],
    ],
}
