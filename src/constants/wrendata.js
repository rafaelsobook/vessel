import { startQuestionare } from '../components/conversations'
import { offerStarterQuest } from '../npc/questOffer.js'

function pick(variants){
    return variants[Math.floor(Math.random() * variants.length)]
}
function toLines(messages){
    return messages.map(message => ({ name: "Wren", isLeft: false, message }))
}

const wrenOpener = [
    ["Scouting the courtyard, same as always. Need a hand finding your way around?"],
    ["Oh, a new face. Making the rounds keeps me sharp — ask away if you're lost."],
]

const wrenTips = [
    "That wagon behind me isn't running trips yet — word is the guild's still sorting out the roads. Check back another time.",
    "The guild hall's just north of here, big door and all. That's where you'll find quests and the registration desk.",
    "Head south long enough and you'll hit the market, guarded day and night. Mind the slimes wandering in from the border out there.",
    "If you ever feel turned around, just follow the road. It loops right past this courtyard eventually.",
]

const wrenFarewell = [
    "Stay safe out there.",
    "Off I go, rounds don't walk themselves.",
]

const WREN_STARTER_QUEST = {
    qName: "wren-courtyard-1",
    qTtle: "Courtyard Watch",
    desc: "A few slimes have been slipping past the courtyard edge during my rounds. Deal with them quietly - I'd rather not admit I missed them.",
    questRequirements: { reqType: "enemy", name: "waterslime", current: 0, requiredNum: 3, completed: false },
}

const wrenQuestGranted = [
    "Near the courtyard's far edge, where the light doesn't quite reach. And, ah, discretion appreciated.",
]
const wrenQuestActive = [
    "Still slipping past, are they? My rounds keep missing them somehow.",
]
const wrenQuestDone = [
    "Courtyard's clean. Whatever you did, nobody up the chain needs to know I needed the help. Much obliged.",
]

export function wrenData(){
    return [
        {
            questionId: 90,
            conversationWithQuestion: toLines(pick(wrenOpener)),
            answers: [
                { text: "Got any tips?", cb: () => startQuestionare(91) },
                {
                    text: "Need a hand with anything?",
                    cb: async () => {
                        const result = await offerStarterQuest(WREN_STARTER_QUEST, "wren-courtyard-2")
                        if(result === "granted") startQuestionare(520)
                        else if(result === "already-active") startQuestionare(521)
                        else startQuestionare(522)
                    }
                },
                { text: "Just saying hi.", cb: () => startQuestionare(92) },
            ],
            cb: () => {}
        },
        {
            questionId: 91,
            conversationWithQuestion: toLines([pick(wrenTips)]),
            answers: [
                { text: "One more?", cb: () => startQuestionare(91) },
                { text: "Thanks, that's helpful.", cb: () => startQuestionare(92) },
            ],
            cb: () => {}
        },
        {
            questionId: 92,
            conversationWithQuestion: toLines(wrenFarewell),
            answers: [],
            cb: () => {}
        },
        {
            questionId: 520,
            conversationWithQuestion: toLines(wrenQuestGranted),
            answers: [],
            cb: () => {}
        },
        {
            questionId: 521,
            conversationWithQuestion: toLines(wrenQuestActive),
            answers: [],
            cb: () => {}
        },
        {
            questionId: 522,
            conversationWithQuestion: toLines(wrenQuestDone),
            answers: [],
            cb: () => {}
        },
    ]
}
