import { startQuestionare } from '../components/conversations'
import { findPlaceMetaData } from '../states/placestates.js'
import { offerStarterQuest } from '../npc/questOffer.js'
import { travelToPlace } from '../tools/travel.js'

function toLines(messages){
    return messages.map(message => ({ name: "Doran", isLeft: false, message }))
}

// destination for the "Travel" answer below - the openworld area added to
// localroomdb.js's metaDatas (placeId 888). Its own `spawn` field is the
// canonical entry point, same convention the dungeon (placeId 12) uses.
const TRAVEL_DESTINATION = {
    placeId: 888,
    name: "Wilderness",
    areaType: "openworld",
    spawn: { x: 0.6, y: 5, z: -10 },
}

const doranOpener = [
    { name: "Doran", isLeft: false, message: "Wagon's fixed, wheels greased, horses fed. Ready whenever you are." },
    { name: "Doran", isLeft: false, message: "Looking to travel, or just admiring the cart?" },
]

const doranTravel = [
    "Hop in, then. Hold onto something.",
]

const doranAck = [
    "Suit yourself. I'll be right here when you change your mind.",
]

const DORAN_STARTER_QUEST = {
    qName: "doran-road-1",
    qTtle: "Clear Passage",
    desc: "Slimes have been crowding the road out toward the wilderness route, spooking the horses. Clear a path so passengers feel safe riding along.",
    questRequirements: { reqType: "enemy", name: "waterslime", current: 0, requiredNum: 3, completed: false },
}

const doranQuestGranted = [
    "Just past the last fence post, that's where they keep bunching up. Horses won't go near it.",
]
const doranQuestActive = [
    "Road's still not clear. I'm not risking the horses on it yet.",
]
const doranQuestDone = [
    "Rode that stretch myself this morning, quiet as anything. Passengers'll thank you, even if they never know your name.",
]

export function wagonData(){
    return [
        {
            questionId: 80,
            conversationWithQuestion: doranOpener,
            answers: [
                { text: "Travel", cb: () => startQuestionare(81) },
                {
                    text: "Any trouble on the road?",
                    cb: async () => {
                        const result = await offerStarterQuest(DORAN_STARTER_QUEST, "doran-road-2")
                        if(result === "granted") startQuestionare(83)
                        else if(result === "already-active") startQuestionare(84)
                        else startQuestionare(85)
                    }
                },
                { text: "Just passing by.", cb: () => startQuestionare(82) },
            ],
            cb: () => {}
        },
        {
            questionId: 81,
            conversationWithQuestion: toLines(doranTravel),
            answers: [],
            cb: async () => {
                // travelToPlace (tools/travel.js) - same transition procedure
                // areascene.js's roomPaths trigger uses
                const { placeId, meta, areaType, spawn } = findPlaceMetaData(888)
                await travelToPlace({ placeId, name: meta.name, areaType, x: spawn.x, y: spawn.y, z: spawn.z })
            }
        },
        {
            questionId: 82,
            conversationWithQuestion: toLines(doranAck),
            answers: [],
            cb: () => {}
        },
        {
            questionId: 83,
            conversationWithQuestion: toLines(doranQuestGranted),
            answers: [],
            cb: () => {}
        },
        {
            questionId: 84,
            conversationWithQuestion: toLines(doranQuestActive),
            answers: [],
            cb: () => {}
        },
        {
            questionId: 85,
            conversationWithQuestion: toLines(doranQuestDone),
            answers: [],
            cb: () => {}
        },
    ]
}
