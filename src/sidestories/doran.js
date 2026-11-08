import { say, ask, line, startQuest, isActive, isCleared, hasFlag, setFlag, fetchQuest, turnIn, giveRewards, coins } from "./kit.js"
import { startQuestionare } from "../components/conversations.js"
import { sylfple, lunaraqum, jerky } from "./fare.js"

// DORAN - thirty-one years on the roads, and an old mare called Biscuit. Ask
// about the worst road the right way and he tells you about the night fog and
// the bones that rise in it (the undead - enemies/undead.js): don't fight in
// the fog, keep to the roads. Then Biscuit's shoes.
const NAME = "Doran"
const ID = "106_doran"
const B = 1100
const S = messages => say(NAME, messages)
const FOG = "side:doran-fog"

const SHOES = fetchQuest({
    qName: "doran-shoes",
    qTtle: "Biscuit's Shoes",
    desc: "Doran's old mare Biscuit has worn her shoes to nothing. The smith wants 4 Bronze Ore for new ones and 4 Wood for the fire.",
    items: [["bronzeore", "Bronze Ore", 4], ["wood", "Wood", 4]],
})

export default {
    npcId: ID,
    option(){
        if(!isCleared("doran-road-2") || isActive(SHOES.qName)) return null
        if(!hasFlag(FOG)) return ["How long have you been hauling?", B]
        if(!isCleared(SHOES.qName)) return ["Biscuit looks tired.", B + 4]
        return ["How's Biscuit?", B + 7]
    },
    questions: () => [
        ask(B, S([
            "Thirty-one years. Started with one mare, Biscuit. She's still with me - mostly retired, mostly asleep.",
            "I've seen every road out of this village, and a few that weren't there the next morning.",
        ]), [
            ["Tell me about the worst road.", B + 1],
            ["Must be boring, driving a cart all day.", B + 2],
        ]),
        line(B + 1, S([
            "The fog road. A night with no moon, and the fog came up off the low ground so thick Biscuit walked by memory.",
            "Then the bones started. Clicking, out in the white. Things that used to be people, getting up out of the ground - and every one of them coming for ME.",
            "Here's what kept me alive. Running only buys you time; they don't tire. But when the fog lifts, they drop where they stand. So if you can't beat them, outlast the fog.",
            "And at night they rise twice as strong. Fog after dark, you get somewhere safe and you wait it out.",
            "Take these - road fruit. Sylfple keeps a man walking when there's nothing else to eat.",
        ]), () => { setFlag(FOG); giveRewards({ items: [sylfple(3)] }) }),
        line(B + 2, S(["Boring keeps you alive, friend. Every exciting driver I ever knew is a story now."])),
        ask(B + 4, S([
            "She is. Her shoes are worn to nothing. The smith wants bronze for new ones, and wood for his fire.",
            "Four bronze ore, four logs. I'd fetch them myself, but my knees and I have an agreement.",
        ]), [
            ["I'll fetch them.", () => { startQuest(SHOES); startQuestionare(B + 5) }],
            ["Maybe later.", B + 6],
        ]),
        line(B + 5, S(["Bless you. Biscuit will pretend not to care. She'll care."])),
        line(B + 6, S(["No rush. She's been walking on them a year. What's another week."])),
        line(B + 7, S(["Trotting like a filly! For about four steps. Then she lies down. Progress."])),
    ],
    turnIns: [[ID, turnIn({
        npcName: NAME,
        quest: SHOES,
        tier: 1,
        done: [
            "Bronze and wood - Biscuit, look! New shoes!",
            "...She's asleep. She's happy, trust me.",
            "Here, for your trouble - eight silver, and the road rations I keep for the long hauls: lunaraqum, and a little jerky. A carter doesn't carry much else, but he carries that well.",
        ],
        waiting: ["Four bronze ore and four logs, for Biscuit's shoes. The vein's past the guild hall; any tree gives wood."],
        reward: () => ({ items: [coins("silver", 8), lunaraqum(4), jerky(2)] }),
    })]],
}
