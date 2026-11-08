import { say, ask, line, startQuest, isActive, isCleared, hasFlag, setFlag, huntQuest, turnIn, coins } from "./kit.js"
import { startQuestionare } from "../components/conversations.js"
import { arminsPauldron } from "./fare.js"

// ARMIN - the guild hall's veteran, whose every piece of gear "came off a job
// I'd rather not talk about twice". After his trial (armin-trial-2) he'll tell
// it: an escort job, demon assassins (Colousa's warning), five of his people
// buried in the old graveyards. Ask about THEM, not the pay, and he asks you to
// lay their ghosts to rest - ghosts shrug off steel (genenemy.ts's
// physicalImmune), so bring fire or magic. Three ghosts is the guild board's C rank
// (320) - he pays it as a veteran would: his old silver pauldron, and coin.
const NAME = "Armin"
const ID = "102_armin"
const B = 1160
const S = messages => say(NAME, messages)
const TOLD = "side:armin-job"

const GHOSTS = huntQuest({
    qName: "armin-ghosts",
    qTtle: "Rest for the Fallen",
    desc: "Armin's squad lies in the old graveyards out in the wilds, and ghosts walk there. Lay 3 of them to rest. Steel passes straight through a ghost - bring fire or magic.",
    enemy: "ghost",
    count: 3,
})

export default {
    npcId: ID,
    option(){
        if(!isCleared("armin-trial-2") || isActive(GHOSTS.qName)) return null
        if(!hasFlag(TOLD)) return ["You said you'd tell me about the job, some day.", B]
        if(!isCleared(GHOSTS.qName)) return ["About your people in the graveyard...", B + 1]
        return ["Did it help, laying them to rest?", B + 6]
    },
    questions: () => [
        ask(B, S([
            "...Some day, I said. Fine. Today's some day.",
            "An escort job, nine years back. A merchant, his family, a road through the hill country. Six of us.",
            "Demon assassins. You don't hear them. You don't see them. You notice the man beside you has stopped talking - and then you notice why.",
            "I got the family out. I didn't get my people out.",
        ]), [
            ["Who did you lose?", () => { setFlag(TOLD); startQuestionare(B + 1) }],
            ["Did you get paid, at least?", B + 2],
        ]),
        ask(B + 1, S([
            "Hesk, my second. Talia. The twins, Aud and Oder. Brannoc, who never once stopped singing.",
            "We buried them in the old graveyards out past the fields. And the ghosts walk there now. One of them wears Hesk's cloak. I'd know it anywhere.",
            "I can't go. I've tried. Would you put them to rest for me?",
        ]), [
            ["I'll put them to rest.", () => { startQuest(GHOSTS); startQuestionare(B + 3) }],
            ["I need time.", B + 4],
        ]),
        line(B + 2, S(["...Get out of my sight. Come back when you've grown some manners."])),
        line(B + 3, S(["Steel goes straight through them. Bring fire, or magic. Three of them, and they'll be quiet."])),
        line(B + 4, S(["Take all the time you need. They've waited nine years."])),
        line(B + 6, S(["I slept last night. All the way through. I'd forgotten what that was like."])),
    ],
    turnIns: [[ID, turnIn({
        npcName: NAME,
        quest: GHOSTS,
        tier: 3,
        guild: { rank: "c", count: 3, per: 3 },
        done: [
            "...Three of them. Quiet, now?",
            "Then they're resting. Thank you.",
            "This was mine. The dent on the left is where a demon's knife turned against it - it saved my life once. Let it save yours.",
            "And twenty-five silver. The guild paid me for nine years of work I'd rather not talk about twice. I can't think of a better use for it.",
        ],
        waiting: ["The ghosts in the old graveyards. Steel won't touch them - fire, or magic."],
        reward: () => ({ items: [arminsPauldron(), coins("silver", 25)] }),
    })]],
}
