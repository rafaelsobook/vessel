import { MeshBuilder, Scene, Vector3 } from "@babylonjs/core"
import { sampleTerrainSurfaceHeight } from "infterrain"
import { createWagon } from "./createwagon.js"
import { getSocketContainers, getPlayersOnScene, getWagonsOnScene } from "../sockets/worldsocket.js"
import { getSceneDet } from "../main/main.js"
import { getCharState } from "../charactersystem/characterstate.js"
import { onIntersecEnterTrig, onIntersecExitTrig } from "../components/actionManager.js"
import { openCloseInteractBtn } from "../tools/popupUI.js"
import { OPENWORLD_TERRAIN_VERTS } from "../constants/constants.js"
import { randomNum } from "../tools/tools.js"
import { attachCam } from "../tools/camera.js"

// A wagon summoned to a fixed stand, facing wherever it's about to go, that
// the player walks up to and boards to set off - Zerech's travel service
// (constants/zerechdata.js) is the caller, and owns where the stand is.
// Kept out of that dialogue file: everything here is scene work (placement,
// physics, triggers), and none of it is Zerech-specific, so a future
// return-trip driver at each tower can summon the same way.
//
// Parked STATIC (createWagon's isForTravel:false). A mass:0 body never
// drifts, can't be shoved around by the player walking up to it, and can't
// be launched by the physics solver if it ends up brushing another static
// prop - all of which a light mass:2 dynamic body (isForTravel:true) would
// do while it just sits there waiting. It stays parked until boarded; a
// real ride would switch its body to dynamic at that point.

// how far around the wagon the "board" button reaches
const BOARD_REACH = 1.5

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

/** Remove the currently summoned wagon, if any (its physics and trigger go with it). */
export function dismissTravelWagon(){
    if(!summoned) return
    // only hide the interact button if it's OURS that's showing - another
    // trigger (a door, an NPC) may own it by now
    if(summoned.buttonShown) openCloseInteractBtn(false, false)
    // disposing the collider takes the visible wagon, its wheels, the board
    // trigger (all descendants) and its PhysicsAggregate (which disposes
    // itself off the mesh's own onDisposeObservable) with it in one call
    if(!summoned.wagon.isDisposed()) summoned.wagon.dispose()
    summoned = null
}

/**
 * Summon a wagon to `at` ({x, z}, world space - its height is read off the
 * ground there), facing `facing` ({x, z}). Walking up to it shows the
 * interact button; pressing it calls `onBoard()`, which should return true
 * once the trip is actually under way (or false - e.g. short on coin - to
 * let the player try boarding again). Returns the wagon's collider mesh, or
 * null if there's no scene/player.
 */
export function summonTravelWagon({ at, facing, onBoard }){
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
    const y = sampleTerrainSurfaceHeight(at.x, at.z, OPENWORLD_TERRAIN_VERTS)
    const pos = new Vector3(at.x, y, at.z)
    // flattened to the wagon's own height so it turns to face the
    // destination without pitching toward it (the towers sit higher)
    const lookAt = new Vector3(facing.x, y, facing.z)
    // justTheWagon:false - the real collider-driven wagon (the visible model
    // rides on its collider), same shape a moving wagon would need
    const { wg, agg, frontWheels, rearWheels } = createWagon(scene, pos, lookAt, false, true)

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

    const record = { wagon: wg, buttonShown: false, boarding: false }
    summoned = record

    const board = async () => {
        if(record.boarding) return
        record.boarding = true
        record.buttonShown = false
        openCloseInteractBtn(false, false)
        const underway = await onBoard()
        if(!underway) record.boarding = false
    }
    onIntersecEnterTrig(trigger, me.body, scene, () => {
        if(record.boarding) return
        record.buttonShown = true
        // openCloseInteractBtn("normal", true, board)
        openCloseInteractBtn("normal", true, () => {
            const thewagon = getWagonsOnScene().find(wag => wag.meshId === meshId)
            if(!thewagon) return console.log("not here")
            if(thewagon.isMoving) return console.log("wagon is already moving")
            thewagon.isMoving = true
            let spd = 25
            let dirForward = thewagon.wg.getDirection(Vector3.Forward())
            
            let dest = new Vector3(thewagon.dest.x, 0, thewagon.dest.z)

            attachCam(thewagon.frontWheels)
            const scene = getSceneDet().scene

            agg.body.setMassProperties({
                mass: 100
            })
            let renderer = scene.onAfterRenderObservable.add(() => {
                const vel = thewagon.agg.body.getLinearVelocity()

                thewagon.agg.body.setLinearVelocity(new Vector3(dirForward.x*spd, vel.y, dirForward.z*spd))
                thewagon.frontWheels.addRotation(Math.PI/10,0,0)
                thewagon.rearWheels.addRotation(Math.PI/10,0,0)

                dest.y = thewagon.wg.position.y

                dirForward = thewagon.wg.getDirection(Vector3.Forward())

                

                me.body.position.x = thewagon.wg.position.x
                me.body.position.z = thewagon.wg.position.z
                me.body.position.y = thewagon.wg.position.y + 100

                console.log(Vector3.Distance(dest, thewagon.wg.position))
                if(Vector3.Distance(dest, thewagon.wg.position) <= 40){
                    wagonStop(thewagon.meshId)
                }
                if(thewagon.wg.position.y <= -10) {
                    thewagon.wg.position.y = 10
                    thewagon.wg.lookAt(new Vector3(dest.x, thewagon.wg.position.y+1, dest.z),0,0,0)
                }
            })
            function wagonStop(_meshId){
                const thewagon = getWagonsOnScene().find(wag => wag.meshId === _meshId)
                if(!thewagon) return console.log("not here")
                thewagon.isMoving = false
                scene.onAfterRenderObservable.remove(renderer)
                
                me.body.position.x += 2
                me.body.position.y = thewagon.wg.position.y + 3

                attachCam(me.body)

                openCloseInteractBtn(false,false)
                agg.body.setMassProperties({
                    mass: 0,
                    // inertia: new Vector3(1, 0, 1),
                    // inertiaOrientation: Quaternion.Identity(),
                })
            }
            setTimeout(() => {
                openCloseInteractBtn("normal", true, () => {
                    wagonStop(thewagon.meshId)
                })
            }, 1000)

            
        })
    })
    onIntersecExitTrig(trigger, me.body, scene, () => {
        if(!record.buttonShown) return
        record.buttonShown = false
        openCloseInteractBtn(false, false)
    })
    const wagonDet = { wg, isMoving: false, meshId, frontWheels, rearWheels, agg, dest: {x: facing.x, z: facing.z}  }
    
    getWagonsOnScene().push(wagonDet)
    return wagonDet
}
