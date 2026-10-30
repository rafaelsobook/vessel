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
                { text: "Show me your wares", cb: () => buyOrSell(false, "110_bram") },
                // was: cb: () => openCloseCraftUI(true) - the crafting menu, off for now
                { text: "I'd like to borrow your anvil", cb: () => startQuestionare(302) },
                { text: "Just looking around.", cb: () => startQuestionare(301) },
            ],
            cb: () => {}
        },
        {
            questionId: 302,
            conversationWithQuestion: toLines(["Absolutely. Young adventurers would need to learn and master the art of smithing."]),
            answers: [],
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
