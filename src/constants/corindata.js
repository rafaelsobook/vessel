import { startQuestionare } from '../components/conversations'
import { offerStarterQuest } from '../npc/questOffer.js'

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

const CORIN_STARTER_QUEST = {
    qName: "corin-treeline-1",
    qTtle: "Wider Loop",
    desc: "The tree line past my usual loop has been thick with slimes lately. Thin them out before they wander in toward the market.",
    questRequirements: { reqType: "enemy", name: "waterslime", current: 0, requiredNum: 4, completed: false },
}

const corinQuestGranted = [
    "Follow the tree line out past where I turn back. That's where it gets sloppy - four or so should thin them out proper.",
]
const corinQuestActive = [
    "Tree line's still thick with them, from what I can see out here.",
]
const corinQuestDone = [
    "Made my loop a lot quieter, that did. Strong and Vordz get all the credit for the market - you keep the outer ring safe, and nobody even notices. Story of a scout's life.",
]

export function corinData(){
    return [
        {
            questionId: 95,
            conversationWithQuestion: toLines(pick(corinOpener)),
            answers: [
                { text: "Any advice for the border?", cb: () => startQuestionare(96) },
                {
                    text: "Need help with the tree line?",
                    cb: async () => {
                        const result = await offerStarterQuest(CORIN_STARTER_QUEST, "corin-treeline-2")
                        if(result === "granted") startQuestionare(530)
                        else if(result === "already-active") startQuestionare(531)
                        else startQuestionare(532)
                    }
                },
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
        {
            questionId: 530,
            conversationWithQuestion: toLines(corinQuestGranted),
            answers: [],
            cb: () => {}
        },
        {
            questionId: 531,
            conversationWithQuestion: toLines(corinQuestActive),
            answers: [],
            cb: () => {}
        },
        {
            questionId: 532,
            conversationWithQuestion: toLines(corinQuestDone),
            answers: [],
            cb: () => {}
        },
    ]
}
