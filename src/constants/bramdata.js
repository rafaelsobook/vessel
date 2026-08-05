import { startQuestionare } from '../components/conversations'
import { buyOrSell } from '../components/buyorsell'
import { openCloseCraftUI } from '../components/craftingui'

function pick(variants){
    return variants[Math.floor(Math.random() * variants.length)]
}
function toLines(messages){
    return messages.map(message => ({ name: "Bram", isLeft: false, message }))
}

const bramGreetings = [
    ["Forge's hot, stock's fresh. Looking to buy, or just admiring the craftsmanship?"],
    ["Careful near the anvil, still cooling from this morning's work. What can I do for you?"],
]

const bramFarewell = [
    "Come back when your coin purse is heavier.",
    "Mind the sparks on your way out.",
]

export function bramData(){
    return [
        {
            questionId: 300,
            conversationWithQuestion: toLines(pick(bramGreetings)),
            answers: [
                { text: "Show me your wares", cb: () => buyOrSell(false) },
                { text: "I'd like to craft something", cb: () => openCloseCraftUI(true) },
                { text: "Just looking around.", cb: () => startQuestionare(301) },
            ],
            cb: () => {}
        },
        {
            questionId: 301,
            conversationWithQuestion: toLines(bramFarewell),
            answers: [],
            cb: () => {}
        },
    ]
}
