import { say, ask, line, startQuest, isActive, isCleared, fetchQuest, turnIn, coins } from "./kit.js"
import { startQuestionare } from "../components/conversations.js"
import { jerky } from "./fare.js"

// WREN - the courtyard watch who keeps missing slimes. He's near-sighted and
// hiding it - if the captain finds out, he loses the post he's wanted since he
// was nine. Keep his secret (the right reply) and fetch the ore for Bram to
// grind him lenses, and he tells you where the wild wheat grows - the grain
// half the village's side stories, and the tavern, run on. A young guard's pay is
// a wage and his rations: an errand (tier 1), paid like one.
const NAME = "Wren"
const ID = "107_wren"
const B = 1060
const S = messages => say(NAME, messages)

const LENSES = fetchQuest({
    qName: "wren-lenses",
    qTtle: "A Clearer View",
    desc: "Wren can't see past twenty paces, and nobody can know. Bram will grind him lenses from 3 Bronze Ore and 2 Stone - mine them from the ore vein at the far end of the village, past the guild hall.",
    items: [["bronzeore", "Bronze Ore", 3], ["stone", "Stone", 2]],
})

export default {
    npcId: ID,
    option(){
        if(isActive(LENSES.qName)) return null
        if(!isCleared(LENSES.qName)) return ["You keep squinting at the road.", B]
        return ["How are the lenses?", B + 6]
    },
    questions: () => [
        ask(B, S([
            "Squinting? I'm not squinting. It's the sun.",
            "...It's cloudy. I know it's cloudy.",
        ]), [
            ["Your secret's safe with me. Can you see the slimes at all?", B + 1],
            ["If you can't see, you shouldn't be on watch.", B + 2],
        ]),
        ask(B + 1, S([
            "...Not past the fountain. Everything beyond twenty paces is a green smear. That's how they keep slipping past me.",
            "If the captain finds out, I'm off the watch. I've wanted this post since I was nine.",
            "Bram says he could grind me lenses - polished bronze in a little frame - if somebody brought him the ore. Three bronze ore, and two good stones for the grinding.",
        ]), [
            ["I'll get them for you.", () => { startQuest(LENSES); startQuestionare(B + 3) }],
            ["Maybe later.", B + 4],
        ]),
        line(B + 2, S(["...Right. Thanks for that. Really helpful."])),
        line(B + 3, S([
            "There's an ore vein at the far end of the village, past the guild hall - the rust-coloured rock. Swing a pick at it; you'll get both.",
            "And... thank you. Really.",
        ])),
        line(B + 4, S(["Sure. My eyes aren't going anywhere. Unfortunately."])),
        line(B + 6, S([
            "I can see the fence. I can see the FENCE. I can see a slime on the fence.",
            "...I'm going to go and kill it. Personally. While it can see me coming.",
        ])),
    ],
    turnIns: [[ID, turnIn({
        npcName: NAME,
        quest: LENSES,
        tier: 1,
        done: [
            "Bronze and stone - Bram says two days. TWO days, and I'll see the far fence!",
            "You kept quiet for me. So here's one back, and it's a real one.",
            "Wheat grows wild along the inside of the village wall - all four sides, away from the gates. Out in the wilds too, in little fields. Tobbin at the tavern pays good bronze for it.",
            "Here - five silver from my wage, and the jerky from my rounds. Don't tell the captain I handed out my rations.",
        ],
        waiting: ["Three bronze ore and two stones, from the vein past the guild hall. Bram's waiting on them."],
        reward: () => ({ items: [coins("silver", 5), jerky(4)] }),
    })]],
}
