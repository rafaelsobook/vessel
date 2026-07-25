import { startQuestionare } from '../components/conversations'
import { grantStoryQuest } from '../tools/questHelpers'

function pick(variants){
    return variants[Math.floor(Math.random() * variants.length)]
}
function toLines(messages){
    return messages.map(message => ({ name: "Vordz", isLeft: false, message }))
}

const vordzOpener = [
    ["Move along if you've got no business here.", "...unless you're here to state the obvious. Everyone else already has."],
    ["Quiet morning. Too quiet, if you ask me. I don't trust quiet.", "State your business."],
]

const vordzDryAck = [
    ["Hm. Noted.", "Carry on, then."],
]

const vordzLore = [
    ["This posting covers the east market and the border tree line beyond it.", "Quiet work, mostly. The occasional slime wanders in when it rains. Nothing this guild hasn't handled a hundred times over."],
]

const vordzGossip = [
    "You noticed too, huh.",
    "Eleven days. I've counted. Eleven days of 'patrols' that consist of him standing very still, facing one direction, saying nothing.",
    "I've served with Strong for three years. Watched him walk into a goblin camp alone rather than wait for backup. Man doesn't know the meaning of hesitation.",
    "Then a girl selling apples says 'good morning' to him once, and suddenly he's a block of stone with a pulse.",
    "It's honestly the funniest thing I've seen since I made captain. Also, frankly, a little sad. I'd like to fix it before he retires still standing in that exact spot.",
    "I'm too old and too blunt to help with the talking part myself. But I'm not too old to meddle from a distance.",
]

const vordzRecruit = [
    "Here's what I'm thinking. Somebody neutral — somebody who isn't obviously his commanding officer — quietly finds out what she actually likes. Favorite flowers, favorite anything.",
    "Then that same somebody makes sure the information finds its way back to a certain guard, without him ever knowing where it came from.",
    "I'd do it myself, but the man knows my voice from three streets away. You, though — you're new. Useful, in that specific way.",
    "Interested?",
]

const vordzRecruitedBriefing = [
    "Good. Ask around the stalls, casually. Find out what she likes. Then come tell me — not him. Me.",
    "Don't make it weird. Well. Weirder than this already is.",
]

const vordzDecline = [
    "Suit yourself. Man's business is his own, I suppose.",
    "Though if you change your mind, you know where to find me. Standing here. Judging everyone's life choices.",
]

export function vordzData(){
    return [
        {
            questionId: 60,
            conversationWithQuestion: toLines(pick(vordzOpener)),
            answers: [
                { text: "Just saying hello.", cb: () => startQuestionare(61) },
                { text: "Is Strong okay? He seems... off.", cb: () => startQuestionare(62) },
                { text: "Tell me about this posting.", cb: () => startQuestionare(63) },
            ],
            cb: () => {}
        },
        {
            questionId: 61,
            conversationWithQuestion: toLines(pick(vordzDryAck)),
            answers: [],
            cb: () => {}
        },
        {
            questionId: 63,
            conversationWithQuestion: toLines(pick(vordzLore)),
            answers: [],
            cb: () => {}
        },
        {
            questionId: 62,
            conversationWithQuestion: toLines(vordzGossip),
            answers: [
                { text: "Go on, I'm listening.", cb: () => startQuestionare(66) },
            ],
            cb: () => {}
        },
        {
            questionId: 66,
            conversationWithQuestion: toLines(vordzRecruit),
            answers: [
                { text: "I'm in. How can I help?", cb: () => startQuestionare(64) },
                { text: "That's none of my business.", cb: () => startQuestionare(65) },
            ],
            cb: () => {}
        },
        {
            questionId: 64,
            conversationWithQuestion: toLines(vordzRecruitedBriefing),
            answers: [],
            cb: () => {
                grantStoryQuest({
                    qName: "vordz-intel-1",
                    qTtle: "A Quiet Favor",
                    desc: "Vordz wants you to quietly find out what Mira likes, without tipping her - or Strong - off. Talk to him again once you've asked around.",
                    questRequirements: { reqType: false, completed: true },
                })
            }
        },
        {
            questionId: 65,
            conversationWithQuestion: toLines(vordzDecline),
            answers: [],
            cb: () => {}
        },
    ]
}
