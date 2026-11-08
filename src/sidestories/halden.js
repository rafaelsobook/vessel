import { say, ask, line, startQuest, isActive, isCleared, hasFlag, huntQuest, turnIn, coins } from "./kit.js"
import { startQuestionare } from "../components/conversations.js"
import { oathkeeperTitle } from "../staticRecources/titlesData.js"
import { haldensSpear } from "./fare.js"

// HALDEN - the gate's veteran (constants/haldendata.js). Once he's told you
// about the chains of light (his 702 sets HEARD), you can offer to finish what
// he couldn't: Vargoth. The hardest hunt in the village - a standing wolf, the
// guild board's A rank, which posts 700 for one - and he pays it as a veteran
// would: the Oathkeeper title (+15 melee damage), his old spear, thirteen years
// of saved pay, and his promise that you'll be the first he teaches the chains
// to (the skill still to come).
const NAME = "Halden"
const ID = "122_halden"
const B = 1040
const S = messages => say(NAME, messages)
export const HALDEN_HEARD = "side:halden-chains"

const VARGOTH = huntQuest({
    qName: "halden-vargoth",
    qTtle: "Unfinished Business",
    desc: "Halden has waited thirteen years for someone to finish Vargoth - the brown standing wolf, far out where the wolf packs hunt. When he drops low, move sideways. Bring Duskveil for the bleeding.",
    enemy: "vargoth",
    count: 1,
})

export default {
    npcId: ID,
    option(){
        if(!hasFlag(HALDEN_HEARD) || isActive(VARGOTH.qName)) return null
        if(!isCleared(VARGOTH.qName)) return ["I'll finish what you started with Vargoth.", B]
        return ["How does it feel, now he's gone?", B + 5]
    },
    questions: () => [
        ask(B, S([
            "...You mean Vargoth.",
            "I've waited thirteen years for someone to say that and mean it.",
            "He's far out, past the deer, where the wolf packs run - one corner of the wilds. Bring him down, and I'll give you what I swore to Eddrick's mother I'd give whoever finished it.",
            "Remember what I told you. When he drops low - sideways. Carry Duskveil for the bleeding. And don't go before you're ready.",
        ]), [
            ["I'll bring him down.", () => { startQuest(VARGOTH); startQuestionare(B + 1) }],
            ["Not yet.", B + 2],
        ]),
        line(B + 1, S(["Then go when you're ready, not when you're angry. The dead don't need you to hurry."])),
        line(B + 2, S(["Good. 'Not yet' is the right answer for most people. Come back when it changes."])),
        line(B + 5, S([
            "I walked out past the fence this morning. First time in thirteen years. Just to look.",
            "It's only grass out there now. Just grass.",
        ])),
    ],
    turnIns: [[ID, turnIn({
        npcName: NAME,
        quest: VARGOTH,
        tier: 5,
        guild: { rank: "a", count: 1, per: 1 },
        done: [
            "...He's dead? Truly dead?",
            "Thirteen years. I can sleep facing the fence now.",
            "The guard used to give a name to whoever closed a debt nobody else could. Oathkeeper. Eddrick would have given it to you himself.",
            "My old pay - three gold, every coin I saved for this day. And the spear I carried that morning. It never left my reach for thirteen years. It should be in a hand that finished what it started.",
            "When the light is ready to be taught - the chains - you'll be the first I teach. That's a promise, and I keep those now.",
        ],
        waiting: ["Vargoth still walks. I'd feel it, if he didn't.", "Sideways when he drops. Duskveil for the bleeding."],
        reward: () => ({ title: oathkeeperTitle, items: [haldensSpear(), coins("gold", 3)] }),
    })]],
}
