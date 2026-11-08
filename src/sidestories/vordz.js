import { say, ask, line, startQuest, isActive, isCleared, hasFlag, setFlag, fetchQuest, turnIn, coins } from "./kit.js"
import { startQuestionare } from "../components/conversations.js"
import { captainsPour } from "./fare.js"

// VORDZ - the captain who meddles from a distance. Eleven years ago he put
// Tobbin's champion's arm down through the tavern's oldest oak table, and never
// paid for it. Too proud to apologise, not too proud to send wood: this fetch is
// handed in to TOBBIN (tobbin.js's NPC), who squares the tab, and pays you out of
// what Vordz left with him - a captain pays in coin and in his own drink, the
// Captain's Pour, which goes back on Tobbin's shelf (tobbin.js's tobbinStock reads
// this quest's clearing). An errand (tier 1): eight logs.
const NAME = "Vordz"
const ID = "105_vords"
const TOBBIN_ID = "123_tobbin"
const B = 1020
const S = messages => say(NAME, messages)
const TOLD = "side:vordz-tab-square"

export const VORDZ_DEBT = fetchQuest({
    qName: "vordz-old-debt",
    qTtle: "The Tavern Incident",
    desc: "Vordz broke Tobbin's oldest table eleven years ago and never paid. Take Tobbin 8 Wood - any tree gives logs to a blade - and don't say it's an apology.",
    items: [["wood", "Wood", 8]],
})

export default {
    npcId: ID,
    option(){
        if(!isCleared("vordz-intel-2")) return null
        if(isActive(VORDZ_DEBT.qName)) return ["About the wood for Tobbin...", B + 5]
        if(!isCleared(VORDZ_DEBT.qName)) return ["You mentioned a tavern incident.", B]
        if(!hasFlag(TOLD)) return ["Tobbin says your tab's square.", B + 3]
        return null
    },
    questions: () => [
        ask(B, S([
            "...Strong told you about that, did he. Or Rendal. Somebody always tells.",
            "Eleven years ago, Tobbin's champion bet me a month's pay I couldn't put his arm down. I put it down. Through the table.",
            "Oak. Older than the tavern's sign. Tobbin hasn't let me near the good stuff since, and I never paid for it.",
            "I'm too proud to walk in there with an apology. I'm not too proud to send wood. Eight good logs - he'll know what they're for.",
        ]), [
            ["I'll take him the wood.", () => { startQuest(VORDZ_DEBT); startQuestionare(B + 1) }],
            ["Pay your own debts, captain.", B + 2],
        ]),
        line(B + 1, S(["Don't tell him I said sorry. I didn't say sorry."])),
        line(B + 2, S(["Hah. Fair. That's what Strong said, too."])),
        line(B + 3, S([
            "Square? He said square?",
            "...Did he smile when he said it? No - don't tell me. I'll go and see for myself. Eventually.",
            "One more thing, since you hauled my wood. The Captain's Pour: drink one before a hard fight and it steadies the hand. Never drink two. That's how you lose a table.",
        ]), () => setFlag(TOLD)),
        line(B + 5, S(["Eight logs, to Tobbin at the tavern. Any tree - put an edge to it and it gives. And no apology."])),
    ],
    turnIns: [[TOBBIN_ID, turnIn({
        npcName: "Tobbin",
        quest: VORDZ_DEBT,
        tier: 1,
        done: [
            "Eight logs... and no note. That's Vordz all right.",
            "Eleven years late and still no apology. Hah! Tell him his tab's square.",
            "And tell him the Captain's Pour is back on the shelf. He'll know what it means.",
            "He always pays ahead, the stubborn old goat - he left a bottle of his own Pour and four silver with me, for whoever carried these. Here.",
        ],
        waiting: ["You're hauling wood for Vordz? Then haul it in, friend - eight logs for the table he broke."],
        reopen: 1300,
        reward: () => ({ items: [captainsPour(1), coins("silver", 4)] }),
    })]],
}
