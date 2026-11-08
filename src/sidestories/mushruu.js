import { say, ask, line, startQuest, isActive, isCleared, fetchQuest, turnIn } from "./kit.js"
import { startQuestionare } from "../components/conversations.js"
import { duskveil, mistcap, bloodcap, devilsCrown } from "./fare.js"

// MUSHRUU - the cap-keeper. He had an apprentice once, Pell, who went too deep
// chasing a Starspore (the epic glowing cap - tcp's mushroomLibrary.ts
// "galaxygreen") and the cave kept him. Ask about him kindly and you can bring
// one back for the empty jar on Pell's shelf. A Starspore grows only where the dark
// is thickest (tcp's mushroomLibrary.ts - depth 0.65 and out, over two thousand
// out from the spawn): a hunt in dangerous country, tier 3. The cap-keeper pays in
// caps: a Devil's Crown, Bloodcaps, Mistcaps and three Duskveil (the bleed cure) -
// a sample of every rare cap he has. His mushroom menu stays open (reopen 590).
const NAME = "Mushruu"
const ID = "121_mushruu"
const B = 1140
const S = messages => say(NAME, messages)

const STARSPORE = fetchQuest({
    qName: "mushruu-starspore",
    qTtle: "Pell's Jar",
    desc: "Mushruu's apprentice died chasing a Starspore - a glowing green cap that grows only where the dark is thickest, deep in the cave or at the far edge of the wilds. Bring one for the empty jar on Pell's shelf.",
    items: [["galaxygreen", "Starspore", 1]],
})

export default {
    npcId: ID,
    option(){
        if(isActive(STARSPORE.qName)) return null
        if(!isCleared(STARSPORE.qName)) return ["Did you always work alone?", B]
        return ["How is the jar on Pell's shelf?", B + 5]
    },
    questions: () => [
        ask(B, S([
            "...No. I had an apprentice once. Pell. Quick hands, quicker feet, no patience at all.",
            "He wanted to see a Starspore. They glow, you know - green as a summer sky at midnight. They only grow where the dark is thickest.",
            "He went down too deep, chasing one. The cave kept him.",
        ]), [
            ["I'm sorry. What was he like?", B + 1],
            ["Mushrooms aren't worth dying for.", B + 2],
        ]),
        ask(B + 1, S([
            "He laughed at everything. He named every cap he found - even the poisonous ones. Especially the poisonous ones.",
            "There's an empty jar on his shelf. I promised him it would hold a Starspore one day.",
            "If you ever find one - deep in the cave, or out at the far edge of the wilds - would you bring it to me? Not for me. For the jar.",
        ]), [
            ["I'll bring you one.", () => { startQuest(STARSPORE); startQuestionare(B + 3) }],
            ["I'll keep an eye out.", B + 4],
        ]),
        line(B + 2, S(["...He'd have argued with you. I won't."])),
        line(B + 3, S(["Thank you. Mind the dark on the way. And if something opens you up - a Duskveil closes a bleed. Violet, with dark veins."])),
        line(B + 4, S(["That's all anyone can do."])),
        line(B + 5, S(["I talk to the jar sometimes. It doesn't answer. It glows, though."])),
    ],
    turnIns: [[ID, turnIn({
        npcName: NAME,
        quest: STARSPORE,
        tier: 3,
        done: [
            "...It's glowing. He said they glowed.",
            "The jar's not empty any more.",
            "Here. One of every rare cap I keep: a Devil's Crown, two Bloodcaps, three Mistcaps - and three Duskveil. They close a bleed, any bleed. Even a standing wolf's.",
            "And something Pell taught ME, that I never taught anyone: eat slowly, listen to your body, and it learns to listen back.",
        ],
        waiting: ["A Starspore - green, glowing, from wherever the dark is thickest. For Pell's jar."],
        reopen: 590,
        reward: () => ({ items: [devilsCrown(1), bloodcap(2), mistcap(3), duskveil(3)] }),
    })]],
}
