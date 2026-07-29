import { startQuestionare } from '../components/conversations'
import { getCharState, updateMyDetailsOL } from '../charactersystem/characterstate.js'
import { checkIfTokenSaved } from '../tools/tools.js'
import { exitScene } from '../sockets/exitsocket.js'
import { changeScene } from '../main/main.js'

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
    startingPos: { x: 0.6, y: 5, z: -10 },
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

export function wagonData(){
    return [
        {
            questionId: 80,
            conversationWithQuestion: doranOpener,
            answers: [
                { text: "Travel", cb: () => startQuestionare(81) },
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
                const { placeId, name, areaType, startingPos } = TRAVEL_DESTINATION
                const charState = getCharState()

                charState.currentPlace.placeId = placeId
                charState.currentPlace.name = name
                charState.currentPlace.areaType = areaType

                charState.x = startingPos.x
                charState.y = startingPos.y
                charState.z = startingPos.z

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
    ]
}
