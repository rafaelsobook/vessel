import { startQuestionare } from '../components/conversations'

function pick(variants){
    return variants[Math.floor(Math.random() * variants.length)]
}
function toLines(messages){
    return messages.map(message => ({ name: "Talin", isLeft: false, message }))
}

const talinOpener = [
    ["Pacing the hall helps me think. Need pointing in the right direction?"],
    ["Can't sit still in here for too long. What can I help you with?"],
]

const talinTips = [
    "That crystal by the desk reads your magic aptitude. Every registered member goes through it once.",
    "Vanessa handles quest reports and selling at the front desk — that's your first stop most days.",
    "Your rank climbs as you finish guild commissions. Nothing fancy, just keep taking jobs off the board.",
    "This floor is guild business only. Living quarters are further in, past the desk.",
]

const talinFarewell = [
    "Good luck out there.",
    "I'll be around if you need anything else.",
]

export function talinData(){
    return [
        {
            questionId: 100,
            conversationWithQuestion: toLines(pick(talinOpener)),
            answers: [
                { text: "Tell me how things work here.", cb: () => startQuestionare(101) },
                { text: "Just looking around.", cb: () => startQuestionare(102) },
            ],
            cb: () => {}
        },
        {
            questionId: 101,
            conversationWithQuestion: toLines([pick(talinTips)]),
            answers: [
                { text: "What else?", cb: () => startQuestionare(101) },
                { text: "Got it, thanks.", cb: () => startQuestionare(102) },
            ],
            cb: () => {}
        },
        {
            questionId: 102,
            conversationWithQuestion: toLines(talinFarewell),
            answers: [],
            cb: () => {}
        },
    ]
}
