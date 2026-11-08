import { say, ask, line, startQuest, isActive, isCleared, hasFlag, setFlag, fetchQuest, turnIn, coins } from "./kit.js"
import { startQuestionare } from "../components/conversations.js"
import { ore } from "./fare.js"

// KRAUN - he knows ore because he was a smith, twenty years at the anvil, until
// a batch of steel he rushed broke on a bandit's helm and a guardsman didn't
// come home. Answer him kindly and he'll try the hammer again on a practice bar
// - and tell you where the good veins really are (tcp's ores.ts: silver in the
// dungeon and grotto veins, adamantine only in the wild veins far out, where
// the stray wolves hunt). A smith pays in ore - a task (tier 2, sixty bronze
// worth of mining), paid in silver ore and coin.
const NAME = "Kraun"
const ID = "103_kraun"
const B = 1180
const S = messages => say(NAME, messages)
const TOLD = "side:kraun-anvil"

const BAR = fetchQuest({
    qName: "kraun-practice-bar",
    qTtle: "The Hammer Remembers",
    desc: "Kraun wants to feel a hammer again - nothing anyone's life will hang on. Bring 6 Bronze Ore and 4 Stone from the village vein past the guild hall.",
    items: [["bronzeore", "Bronze Ore", 6], ["stone", "Stone", 4]],
})

export default {
    npcId: ID,
    option(){
        if(!isCleared("kraun-vein-guard-2") || isActive(BAR.qName)) return null
        if(!hasFlag(TOLD)) return ["Where did you learn so much about ore?", B]
        if(!isCleared(BAR.qName)) return ["Still thinking about that hammer?", B + 1]
        return ["Did the hammer remember you?", B + 5]
    },
    questions: () => [
        ask(B, S([
            "I was a smith before I was a guard. Twenty years at the anvil.",
            "Then a batch of steel I rushed went into a guardsman's sword. The sword broke on a bandit's helm, and the guardsman didn't come home.",
            "I haven't lifted a hammer since.",
        ]), [
            ["Mistakes teach. You still know more than anyone here.", () => { setFlag(TOLD); startQuestionare(B + 1) }],
            ["Maybe you should stay away from anvils, then.", B + 2],
        ]),
        ask(B + 1, S([
            "...Bram says the same. Kinder, but the same.",
            "Maybe I could feel the hammer again. Something small. Six bronze ore and four stones - a practice bar, nothing anyone's life will hang on.",
        ]), [
            ["I'll bring them.", () => { startQuest(BAR); startQuestionare(B + 3) }],
            ["Not today.", B + 4],
        ]),
        line(B + 2, S(["...Aye. Maybe I should. Go on."])),
        line(B + 3, S(["The vein's at the far end of the village, past the guild hall - the rust-coloured rock. Take your pick to it. Stone comes out of it too."])),
        line(B + 4, S(["When you're ready. The anvil isn't going anywhere. Neither am I."])),
        line(B + 5, S(["I made a nail. A single, perfect nail. I'm keeping it."])),
    ],
    turnIns: [[ID, turnIn({
        npcName: NAME,
        quest: BAR,
        tier: 2,
        done: [
            "Six bronze, four stones. ...My hands are shaking. Good. They should.",
            "Here's something I never told an apprentice. Silver shows in the dungeon veins and in the grottos out in the wilds.",
            "Adamantine, though - only in the wild veins far out, where the stray wolves hunt. Mine that, take it to Bram, and he'll make you something worth keeping.",
            "And this, for the trouble: six silver ore from my own stores - I kept it for a day I'd smith again - and eight silver for the hours.",
        ],
        waiting: ["Six bronze ore and four stones, when you've got them. The vein past the guild hall gives both."],
        reward: () => ({ items: [ore("silverore", 6), coins("silver", 8)] }),
    })]],
}
