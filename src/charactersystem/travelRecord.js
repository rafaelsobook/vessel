import { getCharState } from "./characterstate.js"
import { getPlayersOnScene } from "../sockets/worldsocket.js"
import { findPlaceMetaData } from "../states/placestates.js"
import { emitTravelRecord } from "../sockets/emits.js"
import { refreshPlayerListIfOpen } from "../components/playerListUI.js"
import { OPENWORLD_PLACE_ID } from "../constants/constants.js"

// DISTANCE TRAVELED - how far from the openworld's spawn point this character
// has ever been, in metres: the Tab list's "Distance Traveled" column
// (components/playerListUI.js). It's kept on the character itself
// (characterState.maxDistanceTraveled - saved along with the vitals by
// characterstate.js, and only ever raised, server-side too) and told to tcp as
// it grows, which hands it to everyone else looking at their own list.
//
// Sampled once a second while I'm in the openworld, not every frame: a runner
// covers a few metres between samples at most, which isn't worth a per-frame
// hypot for a record.
const SAMPLE_MS = 1000
// a growing record is told to tcp at most this often - a long run outward
// isn't a stream of emits
const TELL_EVERY_MS = 5000

let sampleTimer = null
let tellTimer = null
let lastTold = -Infinity

/** The farthest I've been from the openworld's spawn, metres - 0 before I've left it */
export function getMaxDistanceTraveled(){
    return Math.max(0, getCharState()?.maxDistanceTraveled ?? 0)
}

function tellTcp(){
    tellTimer = null
    lastTold = performance.now()
    emitTravelRecord(getMaxDistanceTraveled())
}

function sample(){
    const state = getCharState()
    if(!state || state.currentPlace?.placeId !== OPENWORLD_PLACE_ID) return

    // the player built for THIS place: while a place change is still loading the
    // state already says openworld, but the body in the list is the old place's,
    // standing somewhere in an entirely different coordinate space
    const me = getPlayersOnScene().find(pl => pl.owner === state.owner)
    if(!me?.body || me.currentPlaceId !== OPENWORLD_PLACE_ID) return

    const spawn = findPlaceMetaData(OPENWORLD_PLACE_ID)?.spawn
    if(!spawn) return
    const meters = Math.floor(Math.hypot(me.body.position.x - spawn.x, me.body.position.z - spawn.z))
    if(!Number.isFinite(meters) || meters <= getMaxDistanceTraveled()) return

    state.maxDistanceTraveled = meters
    refreshPlayerListIfOpen()

    // told now, or once the wait since the last is over - so the last stretch
    // of a run still gets through even if I stop right after
    const wait = TELL_EVERY_MS - (performance.now() - lastTold)
    if(wait <= 0) tellTcp()
    else if(!tellTimer) tellTimer = setTimeout(tellTcp, wait)
}

export function initOnceTravelRecord(){
    if(sampleTimer) return
    sampleTimer = setInterval(sample, SAMPLE_MS)
}
