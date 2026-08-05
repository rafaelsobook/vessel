import { startQuestionare } from '../components/conversations'
import { getCharState, updateMyDetailsOL } from '../charactersystem/characterstate.js'
import { checkIfTokenSaved } from '../tools/tools.js'
import { exitScene } from '../sockets/exitsocket.js'
import { changeScene } from '../main/main.js'
import { findPlaceMetaData } from '../states/placestates.js'
import { offerStarterQuest } from '../npc/questOffer.js'

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
                // same transition procedure areascene.js's roomPaths trigger uses

                const { placeId, meta, areaType, spawn } = findPlaceMetaData(888)
                
                const charState = getCharState()

                charState.currentPlace.placeId = placeId
                charState.currentPlace.name = meta.name
                charState.currentPlace.areaType = areaType

                console.log(spawn)
                charState.x = spawn.x
                charState.y = spawn.y
                charState.z = spawn.z

                await updateMyDetailsOL(charState, checkIfTokenSaved(), true, true)
                exitScene(charState.owner)
                await changeScene("whatever")
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
