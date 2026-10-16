import { TransformNode, Vector3, Matrix, Quaternion } from "@babylonjs/core"
import { getCharState, setCanPress, setCharStateMode } from "./characterstate.js"
import { parentRoot, findDeepByName } from "./createcharacter.js"
import { ANIM_STATE } from "../tools/animation.js"
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
// the modes being on a seat puts you in - each seat's own pose picks which
const SEATED_MODES = ["sitting", "sleeping"]
const poseOf = seat => seat?.pose ?? "sitting"
const CHECK_EVERY_N_FRAMES = 8

// The current place's seats and who's on them - rebuilt whenever the scene
// changes, since every seat node from the old one was disposed along with it.
// { scene, placeId, seats: Map(seatId -> seat), nearest,
//   occupiedBy: Map(seatId -> ownerId), seated: Map(ownerId -> { seatId, seatNode }) }
let seatState = null

// applyRosterSeat calls that arrived for a seat that doesn't exist YET on
// this client - ownerId -> seat. Only actually happens for treelogs: a room's
// chairs are all registered upfront (registerSeats, from createRoom, before
// any player ever syncs in), but a treelog only becomes sittable once
// createTrunkMesh runs for it (addSeat below), and worldsocket.js's
// reCreateMeshesInScene processes the PLAYER roster (and thus a seated
// remote player's own applyRosterSeat call) before it gets to placed world
// objects like treelogs in that same pass. Flushed the moment the seat those
// calls were actually waiting on shows up.
const pendingRosterSeats = new Map()

function myOwner(){
    return getCharState()?.owner
}

function findPlayer(ownerId){
    return getPlayersOnScene().find(pl => pl.owner === ownerId)
}

function equippedWeaponName(){
    return getCharState()?.items.find(itm => itm.itemType === "weapon" && itm.equiped)?.name
}

// Builds a fresh, empty seat registry for this exact scene+place, or returns
// the one already built for it. One nearest-seat proximity check (not a
// trigger box per seat): seats can sit close together (0.44 apart end to end
// on the tavern's own feast table), and overlapping triggers would each
// show/hide the one shared interact button on their own.
function ensureSeatState(scene, placeId){
    if(seatState?.scene === scene && seatState.placeId === placeId) return seatState

    const state = {
        scene,
        placeId,
        seats: new Map(),
        nearest: null,
        occupiedBy: new Map(),
        seated: new Map(),
    }
    seatState = state
    // Drop only pending seats belonging to whatever DIFFERENT place was
    // current before this one - NOT a blanket clear. A pending entry for
    // THIS placeId is not stale: it's the exact treelog scenario this queue
    // exists for (a remote player's roster seat for the place being entered,
    // queued before that place's very first seat - the one that creates this
    // seatState in the first place - is even registered yet).
    pendingRosterSeats.forEach((seat, ownerId) => {
        if(seat.placeId !== placeId) pendingRosterSeats.delete(ownerId)
    })

    let frame = 0
    scene.onBeforeRenderObservable.add(() => {
        if(++frame % CHECK_EVERY_N_FRAMES) return
        const owner = myOwner()
        if(state.seated.has(owner)) return

        const bodyPos = findPlayer(owner)?.body?.position
        if(!bodyPos) return

        // nearest by how far inside its OWN reach each seat is - a tent's
        // bed reaches further than a chair (seat.radius), but a chair right
        // beside the tent should still win when you're standing at it
        let best = null
        let bestScore = 1
        state.seats.forEach(seat => {
            const takenBy = state.occupiedBy.get(seat.seatId)
            if(takenBy && takenBy !== owner) return
            const dx = seat.x - bodyPos.x
            const dz = seat.z - bodyPos.z
            const reach = seat.radius ?? SIT_RADIUS
            const score = (dx * dx + dz * dz) / (reach * reach)
            if(score < bestScore){
                bestScore = score
                best = seat
            }
        })

        if(best === state.nearest) return
        state.nearest = best
        if(best) openCloseInteractBtn(best.icon ?? "normal", true, () => sitDown(best))
        else openCloseInteractBtn(false, false)
    })
    return state
}

function flushPendingRosterSeats(){
    if(!pendingRosterSeats.size) return
    pendingRosterSeats.forEach((seat, ownerId) => {
        if(!seatState || seatState.placeId !== seat.placeId || !seatState.seats.has(seat.seatId)) return
        pendingRosterSeats.delete(ownerId)
        seatPlayer(ownerId, seat.seatId)
    })
}

// seats: [{ seatId, x, y, z, yaw }] - seatId must be the same on every client
// (built from the room data), y is the floor under the seat, yaw uses the same
// atan2(dx, dz) facing convention as inputMovement.js's faceForward().
// Optional, per seat: pose - "sitting" (the default) or "sleeping" (a tent's
// bed, createstructure.js) - which is both the animation and the player's
// mode while on it; radius - how close you have to be (default SIT_RADIUS);
// icon - the interact button's picture (default "normal"). Used
// for a room's whole fixed furniture layout, known upfront in one batch - see
// addSeat below for the treelog equivalent (placed one at a time, at runtime).
export function registerSeats(scene, placeId, seats){
    if(!seats?.length) return
    const state = ensureSeatState(scene, placeId)
    seats.forEach(seat => state.seats.set(seat.seatId, seat))
    flushPendingRosterSeats()
}

// Adds ONE seat to whatever's already registered for this scene+place - or
// starts a fresh (empty) registration if this is the first seat this place
// has seen this session. assetcreation/createtrunk.js calls this per placed
// tree log, the moment it's created - both freshly crafted (campcraft.js) and
// synced in already-placed (worldsocket.js's reCreateMeshesInScene), so a
// treelog is sittable the instant it exists on your screen either way.
export function addSeat(scene, placeId, seat){
    const state = ensureSeatState(scene, placeId)
    if(state.seats.has(seat.seatId)) return
    state.seats.set(seat.seatId, seat)
    flushPendingRosterSeats()
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
    const pose = poseOf(seat)
    player.mode = pose
    parentRoot(ownerId, seatNode, pose)
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
        if(player.fshadow){
            player.fshadow.parent = player.body
            // sitHere hides it - it lies on the floor, not under a bone
            player.fshadow.setEnabled(true)
        }
        // the next seat sits in the ordinary clip again (sitHere's own pose)
        player.characterAnimations?.setStateClip(ANIM_STATE.SITTING, null)
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

    const pose = poseOf(seat)
    setCharStateMode(pose)
    setCanPress(false)
    if(getIsSocketOn()){
        emitMode(pose, equippedWeaponName())
        emitSitDown(seatState.placeId, seat.seatId, pose)
    }
}

export function standUp(){
    unseatPlayer(myOwner())
    // forces the next proximity check to re-offer the seat you're still next to
    if(seatState) seatState.nearest = null

    // still runs with nothing seated: mode is saved with the character, so a
    // save made mid-sit reloads as "sitting" (or "sleeping") with no seat
    // behind it - this is what gets that player moving again
    if(!SEATED_MODES.includes(getCharState()?.mode)) return
    setCharStateMode("idle")
    setCanPress(true)
    if(getIsSocketOn()){
        emitMode("idle", equippedWeaponName())
        emitStandUp()
    }
}

// how long sitHere waits for a player who isn't on the scene yet before it
// gives up - about ten seconds of frames
const SIT_HERE_WAIT_FRAMES = 600

// Where the pelvis ends up while `clip` holds its pose, in the frame the
// avatar's root hangs in (the body's). The sitting clips key the pelvis'
// position to lift the hips to seat height, so this is read off the clip's own
// keys - no hand-measured number per clip. Null when there's no pelvis to find.
function hipsInPose(root, clip){
    const pelvis = findDeepByName(root, node => node.name.toLowerCase().includes("pelvis"))
    if(!pelvis) return null
    const keyed = clip?.targetedAnimations.find(ta => ta.target === pelvis && ta.animation.targetProperty === "position")
    const local = keyed?.animation.getKeys()[0]?.value ?? pelvis.position

    root.parent.computeWorldMatrix(true)
    pelvis.parent.computeWorldMatrix(true)
    const world = Vector3.TransformCoordinates(local, pelvis.parent.getWorldMatrix())
    return Vector3.TransformCoordinates(world, Matrix.Invert(root.parent.getWorldMatrix()))
}

// Sits a player on a bone or node of any model - not one of the registered
// seats above - and keeps them there while that model animates.
//   where     the Bone (a skeleton's getChildren() chain) or TransformNode to
//             sit on - the player's hips land on it
//   ownerId   who sits - getCharState().owner for me
//   animName  the player's own clip to sit in, e.g. "sittinglower1" - the
//             plain "sitting" pose when the player has no clip by that name
//   opts      position { x, y, z } - moves the hips off the bone, in WORLD axes
//             as they are right now, same frame as rotation below (a bone
//             usually sits inside its model's body, so push the player out
//             onto the surface). offset is the same thing under its older
//             name - give both and they add;
//             yaw - which way they face, in radians, 0 faces +z like a seat's yaw;
//             rotation { x, y, z } - tilts them on top of that, radians, same as
//             a mesh's .rotation and in world axes as they are right now (y adds
//             to yaw). They turn about their hips, so those stay on the bone.
//             Like everything here it's what the bone's pose looks like at the
//             moment of sitting - the model moving on from it carries the
//             player along, tilt and all, so "up 1" while the model stands
//             turns into whatever way its bone has swung by the time it's down.
// Stays on the bone through whatever the model does until standUp() - a
// movement key does that, same as any seat. Local to this screen: nothing is
// emitted, so other players don't see it (the model isn't theirs either).
// Safe to call before the player exists (areascene.js builds its models first)
// - they sit as soon as they do. Returns whether they sat right now.
export function sitHere(where, ownerId, animName, opts = {}){
    const scene = where?.getScene?.()
    if(!scene){
        console.warn("sitHere: needs a Bone or TransformNode to sit on")
        return false
    }
    if(findPlayer(ownerId)?.root) return sitOnNode(scene, where, ownerId, animName, opts)

    let frames = 0
    const wait = scene.onBeforeRenderObservable.add(() => {
        const ready = !!findPlayer(ownerId)?.root
        if(!ready && ++frames < SIT_HERE_WAIT_FRAMES) return
        scene.onBeforeRenderObservable.remove(wait)
        if(ready) sitOnNode(scene, where, ownerId, animName, opts)
        else console.warn(`sitHere: player "${ownerId}" never showed up on the scene`)
    })
    return false
}

function sitOnNode(scene, where, ownerId, animName, opts){
    const player = findPlayer(ownerId)
    // a Bone from the skeleton is driven through the node the loader linked to it
    const boneNode = where.getTransformNode?.() ?? where
    if(!boneNode.computeWorldMatrix){
        console.warn("sitHere: that bone isn't linked to a node, nothing to sit on")
        return false
    }

    const isMe = ownerId === myOwner()
    if(isMe){
        // openCloseInteractBtn(false, false)
        // before setCanPress(false) - same reason sitDown gives
        // forceStopMovement()
    }
    ensureSeatState(scene, player.currentPlaceId)
    // off whatever they were on first: root is back on the body (the frame the
    // hips are measured in) and the pose clip is back to the default
    unseatPlayer(ownerId)

    const named = animName ? player.anims.find(a => a.name.toLowerCase() === animName.toLowerCase()) : null
    if(animName && !named) console.warn(`sitHere: no "${animName}" clip on this player, using the plain sitting pose`)
    const pose = named ?? player.anims.find(a => a.name.toLowerCase() === "sitting")
    if(named) player.characterAnimations?.setStateClip(ANIM_STATE.SITTING, named)

    // The seat node's WORLD transform: its origin put where the hips, turned
    // to face yaw (and tilt by rotation), land on the bone (plus position)
    const rotation = Quaternion.RotationYawPitchRoll(
        (opts.yaw ?? 0) + (opts.rotation?.y ?? 0), opts.rotation?.x ?? 0, opts.rotation?.z ?? 0)
    const hips = hipsInPose(player.root, pose) ?? player.root.position.clone()
    boneNode.computeWorldMatrix(true)
    const goal = boneNode.getAbsolutePosition().add(new Vector3(
        (opts.position?.x ?? 0) + (opts.offset?.x ?? 0),
        (opts.position?.y ?? 0) + (opts.offset?.y ?? 0),
        (opts.position?.z ?? 0) + (opts.offset?.z ?? 0)))
    const origin = goal.subtract(hips.rotateByQuaternionToRef(rotation, new Vector3()))
    const seatWorld = Matrix.Compose(Vector3.One(), rotation, origin)

    // Parented under the bone so it follows it. A glTF model's root is
    // mirrored (scaling z -1), which flips the bone's world matrix and would
    // flip the player with it - so the seat's LOCAL matrix is solved from the
    // world one above instead. Its local scaling comes out negative, cancelling
    // the flip; its world matrix, and the player under it, stay rigid.
    const seatLocal = seatWorld.multiply(Matrix.Invert(boneNode.getWorldMatrix()))
    const scaling = new Vector3()
    const rotationQ = new Quaternion()
    const position = new Vector3()
    seatLocal.decompose(scaling, rotationQ, position)
    const seatNode = new TransformNode(`seatNode_${ownerId}`, scene)
    seatNode.parent = boneNode
    seatNode.scaling = scaling
    seatNode.rotationQuaternion = rotationQ
    seatNode.position = position

    // same as seatPlayer, bar the shadow: that one lies on the floor under the
    // body, which is nowhere near a bone
    player.mode = "sitting"
    parentRoot(ownerId, seatNode, "sitting")
    if(player.nameMesh) player.nameMesh.parent = seatNode
    player.fshadow?.setEnabled(false)

    const seatId = `bone_${ownerId}`
    seatState.seated.set(ownerId, { seatId, seatNode })
    seatState.occupiedBy.set(seatId, ownerId)

    if(isMe){
        setCharStateMode("sitting")
        setCanPress(false)
    }
    return true
}

export function isSitting(){
    return !!seatState?.seated.has(myOwner())
}

// createtrunk.js's seatId is always `trunk_${craftId}` - the tavern's benches/
// chairs never use that prefix, so this is what tells a log apart from them
export function isSittingOnLog(){
    return !!seatState?.seated.get(myOwner())?.seatId.startsWith("trunk_")
}

// lying in a tent's bed (createstructure.js) - characterstate.js's faster regen
export function isSleepingInBed(){
    const seated = seatState?.seated.get(myOwner())
    return !!seated && poseOf(seatState.seats.get(seated.seatId)) === "sleeping"
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

// a player who was already seated before I arrived (tcp Tplayers.seat). The
// seat itself might not exist on this client yet (see pendingRosterSeats'
// own comment) - queued rather than dropped, flushed once it does.
export function applyRosterSeat(ownerId, seat){
    if(!seat) return
    if(!seatState || seatState.placeId !== seat.placeId || !seatState.seats.has(seat.seatId)){
        pendingRosterSeats.set(ownerId, seat)
        return
    }
    pendingRosterSeats.delete(ownerId)
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
    pendingRosterSeats.delete(ownerId)
}
