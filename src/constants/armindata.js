import { startQuestionare } from '../components/conversations'
import { offerStarterQuest } from '../npc/questOffer.js'

function pick(variants){
    return variants[Math.floor(Math.random() * variants.length)]
}
function toLines(messages){
    return messages.map(message => ({ name: "Armin", isLeft: false, message }))
}

const arminOpener = [
    ["Standing guard duty, more or less. You look like you could use some seasoning."],
    ["Quiet in here. Suits me fine. What do you need?"],
]

const arminAbout = [
    "Used to take commissions myself, back before this gear started feeling heavier every year. Now I mostly just stand here and let recruits stare at it.",
    "Every piece on me came off a job I'd rather not talk about twice. Ask again some other day and maybe I will.",
]

const arminFarewell = [
    "Mind yourself out there.",
    "Go on, then. I'll be right here, same as always.",
]

const ARMIN_STARTER_QUEST = {
    qName: "armin-trial-1",
    qTtle: "Trial of Iron",
    desc: "Prove you can handle yourself. There's no shortage of slimes crawling in from the border - bring back proof you've thinned the herd, five will do.",
    questRequirements: { reqType: "enemy", name: "waterslime", current: 0, requiredNum: 5, completed: false },
}

const arminQuestGranted = [
    "Five. Not one less. Border's crawling with them if you know where to look.",
]
const arminQuestActive = [
    "Still counting, are you? Five, when you're able.",
]
const arminQuestDone = [
    "Five down. Not bad, most recruits at your stage still can't tell a slime from a puddle.",
    "Come back if you ever want another test. Assuming I think of one worth your time.",
]

export function arminData(){
    return [
        {
            questionId: 400,
            conversationWithQuestion: toLines(pick(arminOpener)),
            answers: [
                { text: "What are you doing here?", cb: () => startQuestionare(401) },
                {
                    text: "Got a trial for me?",
                    cb: async () => {
                        const result = await offerStarterQuest(ARMIN_STARTER_QUEST, "armin-trial-2")
                        if(result === "granted") startQuestionare(402)
                        else if(result === "already-active") startQuestionare(403)
                        else startQuestionare(404)
                    }
                },
                { text: "Just passing by.", cb: () => startQuestionare(405) },
            ],
            cb: () => {}
        },
        {
            questionId: 401,
            conversationWithQuestion: toLines([pick(arminAbout)]),
            answers: [],
            cb: () => {}
        },
        {
            questionId: 402,
            conversationWithQuestion: toLines(arminQuestGranted),
            answers: [],
            cb: () => {}
        },
        {
            questionId: 403,
            conversationWithQuestion: toLines(arminQuestActive),
            answers: [],
            cb: () => {}
        },
        {
            questionId: 404,
            conversationWithQuestion: toLines(arminQuestDone),
            answers: [],
            cb: () => {}
        },
        {
            questionId: 405,
            conversationWithQuestion: toLines(arminFarewell),
            answers: [],
            cb: () => {}
        },
    ]
}
