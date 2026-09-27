import { startQuestionare, startConv } from '../components/conversations'
import { buyOrSell } from '../components/buyorsell.js'
import { findPlaceMetaData } from '../states/placestates.js'
import { travelToPlace } from '../tools/travel.js'
import { summonTravelWagon } from '../assetcreation/summonwagon.js'
import { getCharState } from '../charactersystem/characterstate.js'
import { canAfford, spendOnPrice, priceToBronze, getWealthInBronze } from '../charactersystem/currencySystem.js'
import { SPAWN_X, SPAWN_Z } from 'infterrain'
import { OPENWORLD_PLACE_ID, ZERECH_FARE } from './constants.js'

function toLines(messages){
    return messages.map(message => ({ name: "Zerech", isLeft: false, message }))
}

function pick(variants){
    return variants[Math.floor(Math.random() * variants.length)]
}

// Zerech - the hub's paid guide (npcDetails.js's "120_zerech"), standing in
// the middle of the four stone scriptures (createstonescripture.js). His
// randomSpeech is the pitch; this file is everything after it: the top
// Travel/Buy wares/Never mind menu, the destination submenu one level under
// Travel, the departure, and the "you can't afford that" branch. His actual
// stock (Traveler's Ale, Embergale) lives on his own npcDetails.js entry's
// toSell, same as every other seller in this game - Buy wares just opens it
// via buyOrSell, nothing about the items themselves is duplicated here.
//
// Picking a destination doesn't send you there on the spot: Zerech calls a
// wagon round to his stand (WAGON_STAND below), parked facing that tower
// (assetcreation/summonwagon.js), and the trip starts when you walk up and
// board it. The fare is charged at boarding, not at summoning, so a wagon
// you never board costs nothing - and summoning again just replaces it.
//
// Every trip goes to exactly where that tower's OWN door goes. The routes
// below are read live off the openworld's roomPaths (localroomdb.js,
// placeId 888) - the same entries areascene.js hands to travelToPlace when
// you walk through a tower door - and passed through untouched. Nothing
// about any destination (interior placeId, arrival spot, place name) is
// restated here, so moving a tower or its door can never leave Zerech
// ferrying people somewhere stale.
//
// One-way by design: leaving a tower drops you outside it in the wilderness
// (each tower interior's own exit, localroomdb.js), not back at the hub.
const ROUTES = [
    {
        placeId: 15,
        tower: "Vesper's Tower",
        label: "Vesper's Witch House",
        departId: 581,
        closer: "And mind your manners with Vesper. She notices everything, and forgets nothing.",
    },
    {
        placeId: 16,
        tower: "Ilvara's Tower",
        label: "Ilvara's Tower",
        departId: 582,
        closer: "Don't stare at Ilvara's fire. She takes it personally.",
    },
    {
        placeId: 17,
        tower: "Sable's Tower",
        label: "Sable's Tower",
        departId: 583,
        closer: "Sable will know you're coming before we even arrive. Try not to let that rattle you.",
    },
]

// The fare is flat - ZERECH_FARE (constants.js), the same for every tower,
// and quoted by his own speech in npcDetails.js off that same constant.

// +z north, +x east - this project's own convention (createstonescripture.js).
// Measured from the hub, where Zerech stands. Worked out from the real door
// positions rather than written into each route, so the road Zerech
// describes can't drift from the road you take.
const COMPASS = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"]
function compassFromHub(pos){
    const deg = Math.atan2(pos.x - SPAWN_X, pos.z - SPAWN_Z) * 180 / Math.PI
    return COMPASS[((Math.round(deg / 45) % 8) + 8) % 8]
}

// Each cardinal road runs past the beast that direction's scripture warns
// about - Zerech is the one person who reads those stones as a route map
// rather than a warning. The diagonals have no stone of their own, so they
// fall back to a line that doesn't name one.
const ROAD_LINES = {
    north: "North, under whatever the northern stone is too afraid to name. Stay close, and don't answer if anything calls your name.",
    south: "South, right past the beast that holds the southern approach. It doesn't forgive trespassers, so we won't trespass. We'll slip by.",
    east: "East it is. The eastern road is watched, but whatever watches it has never seen me twice. Keep up.",
    west: "West, where the guardian waits in the dark for a reason to wake. We won't be giving it one. Quiet feet from here.",
}
const OFF_ROAD_LINE = "Off the beaten road, then. Stay close, and trust my eyes over yours."

// top-level menu (Travel / Buy wares / Never mind) - kept neutral about
// which one the player's actually after, since it now offers both
const menuOpeners = [
    "So, adventurer - what'll it be?",
    "So tell me, adventurer - road or provisions, which first?",
]

// only once "Travel" is actually picked, one level in, does he ask where -
// same lines the old single-tier menu opened with
const travelOpeners = [
    "So, where does your journey lead?",
    "Which road is calling your name?",
]

// Where his wagon waits - one fixed stand rather than somewhere worked out
// around wherever the player happens to be standing: the hub is crowded
// (its own wagon, two door triggers, the scripture stones, Zerech), and a
// wagon that always turns up in the same place is one players learn to find.
// Clear open ground 30 units south of the hub. Only x/z - the wagon is set
// down at whatever height the ground actually is there.
const WAGON_STAND = { x: 8, z: 470 }

// last line of the send-off - the wagon appears as the dialogue closes. The
// direction is worked out from the stand, same compass the road lines use,
// so moving the stand can't leave him pointing players the wrong way.
const STAND_DIRECTION = compassFromHub(WAGON_STAND)
const wagonReady = [
    `Your wagon's waiting just ${STAND_DIRECTION} of the stones. Climb aboard when you're ready.`,
    `I've had a wagon brought round - you'll find it ${STAND_DIRECTION} of the stones, and it won't leave without you.`,
]

const farewells = [
    "Then the stones and I will keep watch. Everyone comes back to these four sooner or later.",
    "Suit yourself. When the road starts calling, you know where to find me - right between the warnings.",
]

let warnedMissing = false

// A ROUTE joined with the door it leads through and its bearing. null when
// that door can't be found - dropped from the menu rather than offered and
// then failing, which would take the player's coin first.
function resolve(route){
    const door = findPlaceMetaData(OPENWORLD_PLACE_ID)?.roomPaths?.find(p => p.placeId === route.placeId)
    if(!door){
        if(!warnedMissing){
            warnedMissing = true
            console.warn(`[zerech] no openworld door leads to placeId ${route.placeId} - that route is hidden from his menu`)
        }
        return null
    }
    return {
        ...route,
        door,
        fare: ZERECH_FARE,
        direction: compassFromHub(door.pos),
    }
}

let warnedNoTower = false

// Where the wagon should face: the tower itself, found by name among the
// openworld's own props (localroomdb.js, placeId 888 optionalObjects). Falls
// back to the tower's door - four units off the tower, so from the hub the
// heading is the same to within a fraction of a degree - if the tower was
// ever renamed out from under this.
function towerPosition(trip){
    const tower = findPlaceMetaData(OPENWORLD_PLACE_ID)?.optionalObjects?.find(o => o.name === trip.tower)
    if(tower) return tower.position
    if(!warnedNoTower){
        warnedNoTower = true
        console.warn(`[zerech] no openworld prop named "${trip.tower}" - facing its door instead`)
    }
    return trip.door.pos
}

function tellShortfall(trip){
    const short = priceToBronze(trip.fare) - getWealthInBronze(getCharState())
    startConv(toLines([
        `That road runs ${priceToBronze(trip.fare)} bronze, and you're ${short} short. The beasts don't haggle - and neither do I.`,
    ]), () => {})
}

// Checked BEFORE the departure lines play, so nobody hears the whole
// send-off only to be told afterwards they can't pay for it.
function chooseRoute(trip){
    if(canAfford(getCharState(), trip.fare)) return startQuestionare(trip.departId)
    tellShortfall(trip)
}

// Boarding = paying and going, in one step. spendOnPrice only edits
// charState in memory, and travelToPlace saves charState on its way out, so
// the fare and the arrival persist together - there's no moment where one
// is saved without the other. spendOnPrice's own refusal is the last guard,
// for coin spent between summoning the wagon and climbing into it (his own
// wares are right there) - false tells the wagon the trip didn't start, so
// the player can board again once they can pay.
async function boardWagon(trip){
    const charState = getCharState()
    if(!spendOnPrice(charState, trip.fare)){
        tellShortfall(trip)
        return false
    }
    // await travelToPlace(trip.door)
    return true
}

export function zerechData(){
    const trips = ROUTES.map(resolve).filter(Boolean)
    return [
        {
            // top-level menu - Travel / Buy wares / Never mind, opened
            // straight off his randomSpeech (npcDetails.js's own
            // callbackAfterRandomSpeech). "Buy wares" calls buyOrSell
            // directly as its answer, same one-step shape Maela's "Something
            // to eat"/Vesper's "Teach me something" already use for their
            // own shops - no dialogue in between, the shop UI just opens.
            questionId: 580,
            conversationWithQuestion: toLines([pick(menuOpeners)]),
            answers: [
                { text: "Travel", cb: () => startQuestionare(585) },
                { text: "Buy wares", cb: () => buyOrSell(false, "120_zerech") },
                { text: "Never mind", cb: () => startQuestionare(584) },
            ],
            cb: () => {}
        },
        {
            // one level in from "Travel" - the actual destination list,
            // what questionId 580 used to be before Buy wares split off a
            // level above it
            questionId: 585,
            conversationWithQuestion: toLines([pick(travelOpeners)]),
            answers: [
                ...trips.map(trip => ({
                    text: trip.label,
                    cb: () => chooseRoute(trip),
                })),
                { text: "Never mind", cb: () => startQuestionare(584) },
            ],
            cb: () => {}
        },
        ...trips.map(trip => ({
            questionId: trip.departId,
            conversationWithQuestion: toLines([ROAD_LINES[trip.direction] ?? OFF_ROAD_LINE, trip.closer, pick(wagonReady)]),
            answers: [],
            cb: () => summonTravelWagon({ at: WAGON_STAND, facing: towerPosition(trip), onBoard: () => boardWagon(trip) }),
        })),
        {
            questionId: 584,
            conversationWithQuestion: toLines([pick(farewells)]),
            answers: [],
            cb: () => {}
        },
    ]
}
