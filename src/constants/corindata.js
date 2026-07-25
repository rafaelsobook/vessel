import { startQuestionare } from '../components/conversations'

function pick(variants){
    return variants[Math.floor(Math.random() * variants.length)]
}
function toLines(messages){
    return messages.map(message => ({ name: "Corin", isLeft: false, message }))
}

const corinOpener = [
    ["Border's quiet for now. Picking up Strong and Vordz's slack, or just passing through?"],
    ["Keeping a wide loop around the market. Never hurts to have more eyes on the tree line."],
]

const corinTips = [
    "Slimes creep in from the border most mornings. Nothing a decent weapon can't handle, but don't go in empty-handed.",
    "Strong and Vordz hold the market proper. I cover the wider loop around it, further out where things get sloppier.",
    "If you're heading toward the border, keep your weapon equipped before you go picking fights — or picking ore, for that matter.",
    "New to the guild? Talk to Strong. Man's distracted but he'll point you toward work worth doing.",
]

const corinFarewell = [
    "Keep your guard up.",
    "I'll be circling back around. Watch the tree line.",
]

export function corinData(){
    return [
        {
            questionId: 95,
            conversationWithQuestion: toLines(pick(corinOpener)),
            answers: [
                { text: "Any advice for the border?", cb: () => startQuestionare(96) },
                { text: "Just passing through.", cb: () => startQuestionare(97) },
            ],
            cb: () => {}
        },
        {
            questionId: 96,
            conversationWithQuestion: toLines([pick(corinTips)]),
            answers: [
                { text: "Anything else?", cb: () => startQuestionare(96) },
                { text: "Good to know, thanks.", cb: () => startQuestionare(97) },
            ],
            cb: () => {}
        },
        {
            questionId: 97,
            conversationWithQuestion: toLines(corinFarewell),
            answers: [],
            cb: () => {}
        },
    ]
}
