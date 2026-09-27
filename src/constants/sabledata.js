import { startQuestionare } from '../components/conversations'
import { buyOrSell } from '../components/buyorsell'

function toLines(messages){
    return messages.map(message => ({ name: "Sable", isLeft: false, message }))
}

function pick(variants){
    return variants[Math.floor(Math.random() * variants.length)]
}

const sableOffers = [
    ["The reading's done. The other thing I do is less mysterious.", "I keep books. The ones the other two won't touch."],
    ["You came for a reading. You can leave with something heavier.", "Tomes. Difficult ones. I don't talk anyone into them."],
]

const sableFarewell = [
    "As you like. They'll still be here. So will I.",
    "Mm. Another time, then.",
]

// Sable - the third witch, in her own openworld tower (npcDetails.js's
// "119_sable", interior placeId 17). Her "reading" stays purely narrative
// with no mechanical effect, exactly as that NPC's own comment insists -
// this menu opens after it, so the reading is still the first thing that
// happens and the shop is a separate, optional second beat.
//
// Her shelf is deliberately the strange one: rank 3/4 oddities and the
// cast-modifiers, the things Vesper's foundation shelf and Ilvara's fire
// line don't carry. See her own toSell array in npcDetails.js.
export function sableData(){
    return [
        {
            questionId: 570,
            conversationWithQuestion: toLines(pick(sableOffers)),
            answers: [
                { text: "Let me see them", cb: () => buyOrSell(false, "119_sable") },
                { text: "Another time", cb: () => startQuestionare(571) },
            ],
            cb: () => {}
        },
        {
            questionId: 571,
            conversationWithQuestion: toLines([pick(sableFarewell)]),
            answers: [],
            cb: () => {}
        },
    ]
}
