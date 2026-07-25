import { startQuestionare } from '../components/conversations'

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

export function wrenData(){
    return [
        {
            questionId: 90,
            conversationWithQuestion: toLines(pick(wrenOpener)),
            answers: [
                { text: "Got any tips?", cb: () => startQuestionare(91) },
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
    ]
}
