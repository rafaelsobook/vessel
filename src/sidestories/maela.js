import { say, ask, line, startQuest, isActive, isCleared, fetchQuest, turnIn, coins } from "./kit.js"
import { startQuestionare } from "../components/conversations.js"
import { gransStew } from "./fare.js"

// MAELA - the food stall. Her gran made one stew for the guild the night
// before the long march, and every adventurer who ate it came home. Gather the
// caps and grain and she makes it again - three bowls of Gran's Mushroom Stew.
// Her shop stays open while you gather (reopen: her menu, 320).
const NAME = "Maela"
const ID = "115_maela"
const B = 1120
const S = messages => say(NAME, messages)

const STEW = fetchQuest({
    qName: "maela-stew",
    qTtle: "Gran's Stew",
    desc: "Maela wants to make her gran's stew again: 3 Ember Caps (orange) and 2 Loam Caps (brown) - both grow in the wilds and the cave - and 4 Grain from along the village wall.",
    items: [["orange", "Ember Cap", 3], ["brown", "Loam Cap", 2], ["grain", "Grain", 4]],
})

export default {
    npcId: ID,
    option(){
        if(isActive(STEW.qName)) return null
        if(!isCleared(STEW.qName)) return ["That kettle smells amazing.", B]
        return ["Any more of that stew?", B + 5]
    },
    questions: () => [
        ask(B, S([
            "That's Gran's stew. Or it would be, if I had the caps for it.",
            "She made it for the guild the night before the long march. Every adventurer who ate it came home. Well. Most of them.",
            "I haven't made it properly since she passed. Three ember caps, two loam caps, and four bundles of grain for the barley.",
        ]), [
            ["I'd love to taste it. I'll gather them.", () => { startQuest(STEW); startQuestionare(B + 1) }],
            ["I only eat jerky.", B + 2],
        ]),
        line(B + 1, S(["Ember caps are the orange ones, loam caps the brown. Both grow out in the wilds and down in the cave. The grain grows along the village wall."])),
        line(B + 2, S(["...Then you're missing half of being alive. Come back when you're hungry."])),
        line(B + 5, S(["I make a pot every week now. Come by when you're hungry - just don't tell the guards, or there'll be none left."])),
    ],
    turnIns: [[ID, turnIn({
        npcName: NAME,
        quest: STEW,
        tier: 1,
        done: [
            "Ember, loam and grain - and it smells exactly right.",
            "Gran would have liked you.",
            "Here, four bowls, still warm - eat one before a long walk, a full belly mends you faster. And three silver for the caps; I won't have it said Maela's stall took your goods for nothing.",
        ],
        waiting: ["Three ember caps, two loam caps, four grain - Gran's stew waits on them."],
        reopen: 320,
        reward: () => ({ items: [gransStew(4), coins("silver", 3)] }),
    })]],
}
