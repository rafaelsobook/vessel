import { startQuestionare } from '../components/conversations'
import { buyOrSell } from '../components/buyorsell'

function pick(variants){
    return variants[Math.floor(Math.random() * variants.length)]
}
function toLines(messages){
    return messages.map(message => ({ name: "Maela", isLeft: false, message }))
}

const maelaGreetings = [
    ["Hungry, or just thirsty? Either way, I've got somethin' for it."],
    ["Come, come - nothing sours a journey faster than an empty stomach."],
]

const maelaFarewell = [
    "Eat well, travel far.",
    "Mind you don't let that fruit go soft in your pack - eat it while it's fresh.",
]

// consumables-only seller stationed near Colousa (npcDetails.js's "115_maela") -
// buyOrSell(false, "115_maela") hands buyorsell.js her own _id, which it
// uses to read straight off her own toSell array (npcDetails.js) instead of
// a shared catalog. Same shape as Bram's own "Show me your wares"
// (bramdata.js's buyOrSell(false, "110_bram")), just a different seller id.
export function maelaData(){
    return [
        {
            questionId: 320,
            conversationWithQuestion: toLines(pick(maelaGreetings)),
            answers: [
                { text: "Show me your wares", cb: () => buyOrSell(false, "115_maela") },
                { text: "Just looking around.", cb: () => startQuestionare(321) },
            ],
            cb: () => {}
        },
        {
            questionId: 321,
            conversationWithQuestion: toLines(maelaFarewell),
            answers: [],
            cb: () => {}
        },
    ]
}
