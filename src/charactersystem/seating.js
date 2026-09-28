import { TransformNode } from "@babylonjs/core"
import { getCharState, setCanPress, setCharStateMode } from "./characterstate.js"
import { parentRoot } from "./createcharacter.js"
import { getPlayersOnScene, getIsSocketOn } from "../sockets/worldsocket.js"
import { emitMode, emitSitDown, emitStandUp } from "../sockets/emits.js"
import { forceStopMovement } from "../controllers/inputMovement.js"
import { openCloseInteractBtn, openClosePopup } from "../tools/popupUI.js"

// Sitting on furniture - player.mode "sitting", same shape as
// uimanagement.js's startResting/stopResting: input is locked while seated,
// and inputMovement.js stands you back up the moment a movement key/joystick
// is pressed. The physics body stays where the player was standing; only the
// visible avatar (plus its name tag and fake shadow) moves onto the seat.
//
// Multiplayer: you sit down on your own screen immediately, then tcp/index.ts
// ("sit-down") settles races - if someone else claimed the seat first you get
// "sit-rejected" and stand back up. Everyone else learns who sits where from
// "player-sat"/"player-stood", or from the roster (tcp Tplayers.seat) when
// they join after you sat down.

// body center -> bench center. From the aisle side the body gets within
// ~0.65 of a bench's center, from its end within ~1.2
const SIT_RADIUS = 1.5
const CHECK_EVERY_N_FRAMES = 8

// The current room's seats and who's on them - rebuilt per room, since a new
// scene means every seat node from the old one was disposed along with it.
// { scene, placeId, seats: Map(seatId -> seat), nearest,
//   occupiedBy: Map(seatId -> ownerId), seated: Map(ownerId -> { seatId, seatNode }) }
let seatState = null

function myOwner(){
    return getCharState()?.owner
}

function findPlayer(ownerId){
    return getPlayersOnScene().find(pl => pl.owner === ownerId)
}

function equippedWeaponName(){
    return getCharState()?.items.find(itm => itm.itemType === "weapon" && itm.equiped)?.name
}

// seats: [{ seatId, x, y, z, yaw }] - seatId must be the same on every client
// (built from the room data), y is the floor under the seat, yaw uses the same
// atan2(dx, dz) facing convention as inputMovement.js's faceForward().
// One nearest-seat check instead of a trigger box per seat: seats sit close
// together (0.44 apart end to end on the feast table), and overlapping
// triggers would each show/hide the one shared interact button on their own.
export function registerSeats(scene, placeId, seats){
    if(!seats?.length) return
    const state = {
        scene,
        placeId,
        seats: new Map(seats.map(seat => [seat.seatId, seat])),
        nearest: null,
        occupiedBy: new Map(),
        seated: new Map(),
    }
    seatState = state

    let frame = 0
    scene.onBeforeRenderObservable.add(() => {
        if(++frame % CHECK_EVERY_N_FRAMES) return
        const owner = myOwner()
        if(state.seated.has(owner)) return

        const bodyPos = findPlayer(owner)?.body?.position
        if(!bodyPos) return

        let best = null
        let bestDistSq = SIT_RADIUS * SIT_RADIUS
        state.seats.forEach(seat => {
            const takenBy = state.occupiedBy.get(seat.seatId)
            if(takenBy && takenBy !== owner) return
            const dx = seat.x - bodyPos.x
            const dz = seat.z - bodyPos.z
            const distSq = dx * dx + dz * dz
            if(distSq < bestDistSq){
                bestDistSq = distSq
                best = seat
            }
        })

        if(best === state.nearest) return
        state.nearest = best
        if(best) openCloseInteractBtn("normal", true, () => sitDown(best))
        else openCloseInteractBtn(false, false)
    })
}

// Puts any player on the scene (local or remote) onto a seat. parentRoot keeps
// root's local offset from its parent (-0.74), so the seat node goes where the
// body's center would be if it stood on this seat's floor spot - the sitting
// clip puts the hips at seat height from there.
function seatPlayer(ownerId, seatId){
    const seat = seatState?.seats.get(seatId)
    const player = findPlayer(ownerId)
    if(!seat || !player?.root) return false

    unseatPlayer(ownerId)

    const seatNode = new TransformNode(`seatNode_${ownerId}`, seatState.scene)
    seatNode.position.set(seat.x, seat.y - player.root.position.y, seat.z)
    seatNode.rotation.y = seat.yaw

    // renderer.js holds the pose off player.mode - set here too so a remote
    // player whose "emitted-mode" hasn't arrived yet doesn't blend back to idle
    player.mode = "sitting"
    parentRoot(ownerId, seatNode, "sitting")
    if(player.nameMesh) player.nameMesh.parent = seatNode
    if(player.fshadow) player.fshadow.parent = seatNode

    seatState.seated.set(ownerId, { seatId, seatNode })
    seatState.occupiedBy.set(seatId, ownerId)
    return true
}

function unseatPlayer(ownerId){
    const entry = seatState?.seated.get(ownerId)
    if(!entry) return false

    // re-parent BEFORE disposing - TransformNode.dispose() takes its children with it
    const player = findPlayer(ownerId)
    if(player){
        parentRoot(ownerId, player.body)
        if(player.nameMesh) player.nameMesh.parent = player.body
        if(player.fshadow) player.fshadow.parent = player.body
    }
    entry.seatNode.dispose()

    seatState.seated.delete(ownerId)
    if(seatState.occupiedBy.get(entry.seatId) === ownerId) seatState.occupiedBy.delete(entry.seatId)
    return true
}

export function sitDown(seat){
    const owner = myOwner()
    if(!owner || !seatState || seatState.seated.has(owner)) return

    const takenBy = seatState.occupiedBy.get(seat.seatId)
    if(takenBy && takenBy !== owner) return openClosePopup("Someone is already sitting there", true, 1500)

    openCloseInteractBtn(false, false)
    // before setCanPress(false) - same reason startResting gives: a movement
    // key still held right now would otherwise never get its keyup handled
    forceStopMovement()
    if(!seatPlayer(owner, seat.seatId)) return

    setCharStateMode("sitting")
    setCanPress(false)
    if(getIsSocketOn()){
        emitMode("sitting", equippedWeaponName())
        emitSitDown(seatState.placeId, seat.seatId)
    }
}

export function standUp(){
    unseatPlayer(myOwner())
    // forces the next proximity check to re-offer the seat you're still next to
    if(seatState) seatState.nearest = null

    // still runs with nothing seated: mode is saved with the character, so a
    // save made mid-sit reloads as "sitting" with no seat behind it - this
    // is what gets that player moving again
    if(getCharState()?.mode !== "sitting") return
    setCharStateMode("idle")
    setCanPress(true)
    if(getIsSocketOn()){
        emitMode("idle", equippedWeaponName())
        emitStandUp()
    }
}

export function isSitting(){
    return !!seatState?.seated.has(myOwner())
}

// ── multiplayer entry points (sockets/worldsocket.js) ─────────────────────────

export function onPlayerSat({ ownerId, placeId, seatId }){
    if(!seatState || seatState.placeId !== placeId) return
    // my own echo - already seated locally, just keep occupancy in step
    if(ownerId === myOwner()) return seatState.occupiedBy.set(seatId, ownerId)
    seatPlayer(ownerId, seatId)
}

export function onPlayerStood({ ownerId, placeId, seatId }){
    if(!seatState || seatState.placeId !== placeId) return
    if(ownerId === myOwner()) return
    unseatPlayer(ownerId)
    if(seatState.occupiedBy.get(seatId) === ownerId) seatState.occupiedBy.delete(seatId)
}

// someone else claimed this seat first (tcp/index.ts's "sit-down")
export function onSitRejected({ placeId, seatId }){
    if(!seatState || seatState.placeId !== placeId) return
    const mine = seatState.seated.get(myOwner())
    if(!mine || mine.seatId !== seatId) return
    standUp()
    openClosePopup("Someone is already sitting there", true, 1500)
}

// a player who was already seated before I arrived (tcp Tplayers.seat)
export function applyRosterSeat(ownerId, seat){
    if(!seat || !seatState || seatState.placeId !== seat.placeId) return
    seatPlayer(ownerId, seat.seatId)
}

// userJoined's roster is the server's full picture of who sits where
export function syncSeatOccupancy(roster){
    if(!seatState || !Array.isArray(roster)) return
    const occupiedBy = new Map()
    roster.forEach(pl => {
        if(pl.seat && pl.seat.placeId === seatState.placeId) occupiedBy.set(pl.seat.seatId, pl.owner)
    })
    // this snapshot can predate my own sit-down reaching the server
    const mine = seatState.seated.get(myOwner())
    if(mine) occupiedBy.set(mine.seatId, myOwner())
    seatState.occupiedBy = occupiedBy
}

// before a remote player's body gets disposed (worldsocket.js's removePlayer) -
// a seated avatar hangs off the seat node, not the body, so it wouldn't go with it
export function releaseSeatOf(ownerId){
    unseatPlayer(ownerId)
}
