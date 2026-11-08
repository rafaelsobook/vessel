import { say, ask, line, startQuest, isActive, isCleared, hasFlag, setFlag, fetchQuest, turnIn, coins } from "./kit.js"
import { startQuestionare } from "../components/conversations.js"
import { makeSkillBook } from "../staticRecources/skillBooks.js"

// TALIN - the guild hall's pacing clerk. A stray wolf took a piece of his leg
// on his second job ever; if he sits still it stiffens, so he paces and files
// reports and watches other people go out the door. Tell him what he still
// knows is worth something and he asks for a strange revenge: three wolf ribs
// (tcp's meatLoots.ts "rib", from the stray wolves). Three ribs is three stray
// wolves - the guild board's B rank, which posts 450 for exactly that - so he
// pays like it: a tome a mage left him that he never had the leg for, and a bonus
// out of the guild's purse (a clerk can write himself a cheque).
const NAME = "Talin"
const ID = "109_talin"
const B = 1200
const S = messages => say(NAME, messages)
const TOLD = "side:talin-leg"

const RIBS = fetchQuest({
    qName: "talin-ribs",
    qTtle: "A Taste of Revenge",
    desc: "A stray wolf ended Talin's adventuring at nineteen. He wants to taste one and win for once: bring him 3 Wolf Ribs from the stray wolves that hunt in packs far out past the deer.",
    items: [["rib", "Wolf Rib", 3]],
})

export default {
    npcId: ID,
    option(){
        if(!isCleared("talin-errand-2") || isActive(RIBS.qName)) return null
        if(!hasFlag(TOLD)) return ["Why do you pace so much?", B]
        if(!isCleared(RIBS.qName)) return ["About those wolf ribs...", B + 1]
        return ["How's the leg?", B + 5]
    },
    questions: () => [
        ask(B, S([
            "The leg. A stray wolf took a piece of it when I was nineteen - my second job, ever.",
            "If I sit still, it stiffens. So I pace, and I file reports, and I watch other people walk out that door.",
        ]), [
            ["You still know the wilds better than most of us.", () => { setFlag(TOLD); startQuestionare(B + 1) }],
            ["Sounds like you gave up.", B + 2],
        ]),
        ask(B + 1, S([
            "...I suppose I do. Every report in this guild crosses my desk.",
            "Here's a strange request. Bring me three wolf ribs - from the strays, out past the deer. I want to taste the thing that ended my career. Win, for once.",
        ]), [
            ["Three wolf ribs. Done.", () => { startQuest(RIBS); startQuestionare(B + 3) }],
            ["Not yet.", B + 4],
        ]),
        line(B + 2, S(["...Maybe I did. Thanks for saying it out loud, I suppose."])),
        line(B + 3, S([
            "They hunt in packs, far out - past the deer. Don't fight a whole pack at once.",
            "And roast one for yourself while you're at it. Raw, they'll turn your stomach.",
        ])),
        line(B + 4, S(["Whenever you're ready. They're not going anywhere. Neither am I - that's rather the problem."])),
        line(B + 5, S(["Still stiff. But I walked to the gate and back yesterday without stopping. First time in years."])),
    ],
    turnIns: [[ID, turnIn({
        npcName: NAME,
        quest: RIBS,
        tier: 4,
        guild: { rank: "b", count: 3, per: 3 },
        done: [
            "Wolf ribs. Ha! Three of them!",
            "...It tastes like revenge. Revenge needs salt.",
            "Three stray wolves' worth - the guild posts four hundred and fifty for that, and I'm the clerk who writes the cheques. Forty silver, and don't spend it all in one place.",
            "And a tome a travelling mage left with me as payment, years ago. A blink and a strike, faster than anything can turn. I never had the leg for it. You do.",
        ],
        waiting: ["Three wolf ribs, from the strays out past the deer. Mind the packs."],
        reward: () => ({ items: [makeSkillBook("blinkstrike"), coins("silver", 40)] }),
    })]],
}
