import { startQuestionare } from '../components/conversations'

function toLines(messages){
    return messages.map(message => ({ name: "Doran", isLeft: false, message }))
}

const doranOpener = [
    { name: "Doran", isLeft: false, message: "Wagon's fixed, wheels greased, horses fed. Ready whenever you are." },
    { name: "Doran", isLeft: false, message: "Looking to travel, or just admiring the cart?" },
]

const doranTravelStub = [
    "Ha, I like the enthusiasm.",
    "Truth is the routes aren't running yet, still waiting on the guildmaster to sort out the roads. Check back soon.",
]

const doranAck = [
    "Suit yourself. I'll be right here when you change your mind.",
]

export function wagonData(){
    return [
        {
            questionId: 80,
            conversationWithQuestion: doranOpener,
            answers: [
                { text: "Travel", cb: () => startQuestionare(81) },
                { text: "Just passing by.", cb: () => startQuestionare(82) },
            ],
            cb: () => {}
        },
        {
            questionId: 81,
            conversationWithQuestion: toLines(doranTravelStub),
            answers: [],
            cb: () => {
                // TODO: wire to a real destination once fast-travel between areas exists
            }
        },
        {
            questionId: 82,
            conversationWithQuestion: toLines(doranAck),
            answers: [],
            cb: () => {}
        },
    ]
}
