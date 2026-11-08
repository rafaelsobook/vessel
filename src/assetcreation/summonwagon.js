import { MeshBuilder, PhysicsMotionType, TransformNode, Vector3 } from "@babylonjs/core"
import { sampleTerrainSurfaceHeight, ROADS, nearestRoad, roadPointAt } from "infterrain"
import { createWagon } from "./createwagon.js"
import { getSocketContainers, getPlayersOnScene, getWagonsOnScene } from "../sockets/worldsocket.js"
import { getSceneDet } from "../main/main.js"
import { getCharState, setCanPress } from "../charactersystem/characterstate.js"
import { onIntersecEnterTrig, onIntersecExitTrig } from "../components/actionManager.js"
import { openCloseInteractBtn } from "../tools/popupUI.js"
import { OPENWORLD_TERRAIN_VERTS } from "../constants/constants.js"
import { randomNum } from "../tools/tools.js"
import { attachCam } from "../tools/camera.js"
import { relocatePos, forceStopMovement } from "../controllers/inputMovement.js"

// A wagon summoned to a fixed stand that the player walks up to and boards -
// Zerech's travel service (constants/zerechdata.js) is the caller, and owns
// where the stand is. Kept out of that dialogue file: everything here is
// scene work (placement, physics, triggers, the ride), and none of it is
// Zerech-specific, so a future return-trip driver at each tower can summon the
// same way.
//
// THE RIDE keeps to the roads (infterrain's ROADS): out from the stand onto the
// destination's road (roadRoute below), along it, and to a stop ON the road at
// the point nearest the destination - the roads are flattened and kept clear
// of trees, and the castles were placed off them, so nothing is in the way.
// The wagon is driven along that line (its body ANIMATED, set down on the
// ground every frame) rather than pushed by physics: a pushed wagon on open
// ground climbed hills, tipped and drove into castles.
//
// Parked STATIC (createWagon's isForTravel:false). A mass:0 body never drifts,
// can't be shoved around by the player walking up to it, and can't be
// launched by the solver if it brushes another static prop.
//
// Single player for now: nobody else sees the ride.

// how far around the wagon the "board" button reaches
const BOARD_REACH = 1.5
// how far out along a road the wagon joins it - past the hub's ring of stone
// scriptures (createstonescripture.js, 15 out from the spawn) and the wagon
// parked in its middle
const JOIN_ROAD_AT = 45
// the route's points are this far apart along the road
const ROUTE_STEP = 8
// metres a second at full pace, and how long it takes to get up to it / how
// far from the stop it starts slowing
const RIDE_SPEED = 30
const RIDE_SPEEDUP_SECONDS = 3
const RIDE_SLOWDOWN_DISTANCE = 45
// it steers toward the road this far ahead, which rounds the corners
const LOOK_AHEAD = 7
// the axles' wheel radius (createwagon.js sets them at this height)
const WHEEL_RADIUS = 0.7
// where the rider gets down, toward the destination from the stop
const STEP_DOWN = 4
// the rider rides out of sight, this far above the wagon, the camera on the wagon
const RIDER_ABOVE = 100
// what the camera follows during the ride: this far above the top of the wagon,
// about where a rider's head would be. Not the wagon's own origin - that's where
// its wheels meet the ground, and the camera's collision ray (camera.js) starts
// at what it follows, so from down there every rise in the road behind the
// wagon read as a wall and pulled the camera in under the cart
const CAMERA_ABOVE_WAGON = 0.8

// one summoned wagon per player at a time - summoning again replaces it
let summoned = null

// The wagon's own footprint in its local frame (+z = the way it faces),
// read off the loaded prefabs rather than written down here: the union of
// the visible model (whose long end is the shafts) and its physics
// collider. A re-export of either glb moves this with it.
function wagonFootprint(){
    const { wagonRoot, wagonBodyColliderRoot } = getSocketContainers()
    const boxes = [wagonRoot, wagonBodyColliderRoot].filter(Boolean).map(m => m.getBoundingInfo().boundingBox)
    const min = new Vector3(Math.min(...boxes.map(b => b.minimum.x)), Math.min(...boxes.map(b => b.minimum.y)), Math.min(...boxes.map(b => b.minimum.z)))
    const max = new Vector3(Math.max(...boxes.map(b => b.maximum.x)), Math.max(...boxes.map(b => b.maximum.y)), Math.max(...boxes.map(b => b.maximum.z)))
    return { size: max.subtract(min), center: min.add(max).scale(0.5) }
}

// how far along road `r` the point of it nearest (x, z) is
function distanceAlongRoad(r, x, z){
    const road = ROADS[r]
    let best = Infinity, bestS = 0, acc = 0
    for(let i = 0; i < road.length - 1; i++){
        const a = road[i], b = road[i + 1]
        const abx = b.x - a.x, abz = b.z - a.z
        const len = Math.hypot(abx, abz)
        const t = len > 0 ? Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / (len * len))) : 0
        const d = Math.hypot(x - a.x - abx * t, z - a.z - abz * t)
        if(d < best){ best = d; bestS = acc + t * len }
        acc += len
    }
    return bestS
}

/**
 * The way a wagon at `start` ({x, z}) takes to `destination` ({x, z}) by road:
 * onto the road nearest the destination (at least JOIN_ROAD_AT out from the
 * spawn), along it, and to the point on it nearest the destination - the
 * last point, where the wagon stops. Points every ROUTE_STEP along the road.
 */
export function roadRoute(start, destination){
    const end = nearestRoad(destination.x, destination.z)
    const join = Math.max(JOIN_ROAD_AT, distanceAlongRoad(end.road, start.x, start.z))
    const route = []
    // the right way along the road - out toward the destination, or back in
    const dir = end.s >= join ? 1 : -1
    for(let s = join; dir * (end.s - s) > ROUTE_STEP / 2; s += dir * ROUTE_STEP) route.push(roadPointAt(end.road, s))
    route.push(roadPointAt(end.road, end.s))
    return route
}

/** Remove the currently summoned wagon, if any (its physics and trigger go with it). */
export function dismissTravelWagon(){
    if(!summoned) return
    // a ride still under way ends first, so the rider is let down and given control back
    summoned.endRide?.()
    // only hide the interact button if it's OURS that's showing - another
    // trigger (a door, an NPC) may own it by now
    if(summoned.buttonShown) openCloseInteractBtn(false, false)
    // disposing the collider takes the visible wagon, its wheels, the board
    // trigger (all descendants) and its PhysicsAggregate (which disposes
    // itself off the mesh's own onDisposeObservable) with it in one call
    if(!summoned.wagon.isDisposed()) summoned.wagon.dispose()
    const wagons = getWagonsOnScene()
    const i = wagons.findIndex(w => w.wg === summoned.wagon)
    if(i >= 0) wagons.splice(i, 1)
    summoned = null
}

function groundY(x, z){
    return sampleTerrainSurfaceHeight(x, z, OPENWORLD_TERRAIN_VERTS)
}

/**
 * Drive the wagon from where it stands through `route`, the rider `me` with it,
 * and stop at the end (or wherever the "stop" button is pressed). `toward`: where
 * the rider steps down toward. `onArrive` runs once it's stopped.
 */
function ride(wagonDet, me, route, toward, onArrive){
    const { wg, agg, frontWheels, rearWheels } = wagonDet
    const scene = wg.getScene()

    // the line it follows, with how far along it each point is
    const path = [{ x: wg.position.x, z: wg.position.z }, ...route]
    const along = [0]
    for(let i = 1; i < path.length; i++) along.push(along[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z))
    const total = along[along.length - 1]
    const pointAt = d => {
        if(d <= 0) return path[0]
        for(let i = 1; i < path.length; i++){
            if(d > along[i]) continue
            const t = (d - along[i - 1]) / (along[i] - along[i - 1] || 1)
            return { x: path[i - 1].x + (path[i].x - path[i - 1].x) * t, z: path[i - 1].z + (path[i].z - path[i - 1].z) * t }
        }
        return path[path.length - 1]
    }

    wagonDet.isMoving = true
    agg.body.setMotionType(PhysicsMotionType.ANIMATED)
    forceStopMovement()
    setCanPress(false)
    // parented to the wagon, so camera.js still finds - and ignores - the wagon's own body
    const fp = wagonFootprint()
    const cameraAnchor = new TransformNode("wagon_camera_anchor", scene)
    cameraAnchor.parent = wg
    cameraAnchor.position.set(fp.center.x, fp.center.y + fp.size.y / 2 + CAMERA_ABOVE_WAGON, fp.center.z)
    attachCam(cameraAnchor)

    let travelled = 0
    let elapsed = 0
    let ended = false
    const riderSpot = new Vector3()
    const lookTarget = new Vector3()

    const observer = scene.onBeforeRenderObservable.add(() => {
        if(wg.isDisposed()) return endRide()
        const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000)
        elapsed += dt
        const speedUp = Math.min(1, elapsed / RIDE_SPEEDUP_SECONDS)
        const slowDown = Math.max(0.15, Math.min(1, (total - travelled) / RIDE_SLOWDOWN_DISTANCE))
        const step = RIDE_SPEED * Math.min(speedUp, slowDown) * dt
        travelled = Math.min(total, travelled + step)

        const p = pointAt(travelled)
        wg.position.set(p.x, groundY(p.x, p.z), p.z)
        // steer at the road a little ahead - unless that's where it already is (the stop)
        const ahead = pointAt(travelled + LOOK_AHEAD)
        if(Math.hypot(ahead.x - p.x, ahead.z - p.z) > LOOK_AHEAD * 0.5){
            lookTarget.set(ahead.x, groundY(ahead.x, ahead.z), ahead.z)
            wg.lookAt(lookTarget, 0, 0, 0)
        }
        frontWheels?.addRotation(step / WHEEL_RADIUS, 0, 0)
        rearWheels?.addRotation(step / WHEEL_RADIUS, 0, 0)

        riderSpot.set(p.x, wg.position.y + RIDER_ABOVE, p.z)
        relocatePos(me.body, riderSpot)

        if(travelled >= total) endRide()
    })

    function endRide(){
        if(ended) return
        ended = true
        scene.onBeforeRenderObservable.remove(observer)
        wagonDet.isMoving = false
        if(!wg.isDisposed()) agg.body.setMotionType(PhysicsMotionType.STATIC)
        openCloseInteractBtn(false, false)

        // down beside the wagon, on the side the destination is
        const at = wg.position
        const dx = toward.x - at.x, dz = toward.z - at.z
        const len = Math.hypot(dx, dz) || 1
        const x = at.x + dx / len * STEP_DOWN, z = at.z + dz / len * STEP_DOWN
        relocatePos(me.body, new Vector3(x, groundY(x, z) + 1.5, z))
        attachCam(me.body)
        cameraAnchor.dispose()
        setCanPress(true)
        onArrive?.()
    }

    // a way off before the end of the road
    setTimeout(() => { if(!ended) openCloseInteractBtn("normal", true, endRide) }, 1000)
    return endRide
}

/**
 * Summon a wagon to `at` ({x, z}, world space - its height is read off the
 * ground there), facing `facing` ({x, z}). Walking up to it shows the
 * interact button; pressing it calls `onBoard()`, which should return true
 * once the trip is paid for (or false - e.g. short on coin - to let the
 * player try boarding again), and then the wagon rides `route` ({x, z}
 * points, roadRoute's) to its last point and stops there, the rider stepping
 * down toward `destination`. Returns the wagon, or null if there's no
 * scene/player.
 */
export function summonTravelWagon({ at, facing, route, destination, onBoard }){
    const meshId = randomNum()
    dismissTravelWagon()

    const scene = getSceneDet()?.scene
    const owner = getCharState()?.owner
    const me = getPlayersOnScene().find(pl => pl.owner === owner)
    if(!scene || !me?.body){
        console.warn("[summonwagon] no scene or player body to summon a wagon for")
        return null
    }

    // the wagon's pivot is where its wheels meet the ground, so it sits AT
    // ground height, not above it
    const y = groundY(at.x, at.z)
    const pos = new Vector3(at.x, y, at.z)
    // flattened to the wagon's own height so it turns to face the way it's
    // going without pitching toward it
    const lookAt = new Vector3(facing.x, y, facing.z)
    // justTheWagon:false - the real collider-driven wagon (the visible model
    // rides on its collider)
    const { wg, agg, frontWheels, rearWheels } = createWagon(scene, pos, lookAt, false, false)

    const fp = wagonFootprint()
    const trigger = MeshBuilder.CreateBox("wagon_board_trigger", {
        width: fp.size.x + BOARD_REACH * 2,
        height: fp.size.y + 1,
        depth: fp.size.z + BOARD_REACH * 2,
    }, scene)
    trigger.parent = wg
    trigger.position.copyFrom(fp.center)
    trigger.isVisible = false
    trigger.isPickable = false

    const wagonDet = { wg, isMoving: false, meshId, frontWheels, rearWheels, agg, dest: route?.[route.length - 1] ?? { x: facing.x, z: facing.z } }
    const record = { wagon: wg, buttonShown: false, boarding: false, done: false, endRide: null }
    summoned = record

    const board = async () => {
        if(record.boarding || record.done) return
        record.boarding = true
        record.buttonShown = false
        openCloseInteractBtn(false, false)
        const paid = await onBoard()
        if(!paid){
            record.boarding = false
            return
        }
        record.endRide = ride(wagonDet, me, route ?? [facing], destination ?? facing, () => {
            // it has done its trip - it stays parked on the road, but takes nobody anywhere again
            record.done = true
            record.endRide = null
            if(!trigger.isDisposed()) trigger.dispose()
        })
    }
    onIntersecEnterTrig(trigger, me.body, scene, () => {
        if(record.boarding || record.done) return
        record.buttonShown = true
        openCloseInteractBtn("normal", true, board)
    })
    onIntersecExitTrig(trigger, me.body, scene, () => {
        if(!record.buttonShown) return
        record.buttonShown = false
        openCloseInteractBtn(false, false)
    })

    getWagonsOnScene().push(wagonDet)
    return wagonDet
}
