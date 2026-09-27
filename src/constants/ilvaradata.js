import { startQuestionare } from '../components/conversations'
import { buyOrSell } from '../components/buyorsell'

function toLines(messages){
    return messages.map(message => ({ name: "Ilvara", isLeft: false, message }))
}

// picks a random variant so repeat visits don't always read the same -
// same helper vesperdata.js/flirtdata.js already use
function pick(variants){
    return variants[Math.floor(Math.random() * variants.length)]
}

const ilvaraOffers = [
    ["Still here. Good - I've got more than a warm swing to sell you.", "Fire, written down. Takes longer to learn than to cast, but that's your problem."],
    ["You want something that lasts longer than a blessing?", "I keep tomes. Expensive ones. Look if you like."],
]

const ilvaraFarewell = [
    "Suit yourself. The shelf isn't going anywhere.",
    "Fine. Come back when you've got coin and a reason.",
]

// Ilvara - the fire witch in her own openworld tower (npcDetails.js's
// "118_ilvara", interior placeId 16). This menu opens AFTER her existing
// ember-blessing buff conversation finishes, not instead of it: the buff
// stays a no-menu, granted-on-arrival service exactly as before (see that
// NPC's own callbackAfterRandomSpeech comment), and this is a second thing
// offered afterwards rather than a replacement for it.
//
// buyOrSell(false, "118_ilvara") hands buyorsell.js her own _id, which it
// uses to read straight off her own toSell array - the same call
// bramdata.js/maeladata.js already make, just a different seller and a
// different kind of stock (skill books, staticRecources/skillBooks.js).
export function ilvaraData(){
    return [
        {
            questionId: 560,
            conversationWithQuestion: toLines(pick(ilvaraOffers)),
            answers: [
                { text: "Show me the tomes", cb: () => buyOrSell(false, "118_ilvara") },
                { text: "Not today", cb: () => startQuestionare(561) },
            ],
            cb: () => {}
        },
        {
            questionId: 561,
            conversationWithQuestion: toLines([pick(ilvaraFarewell)]),
            answers: [],
            cb: () => {}
        },
    ]
}
