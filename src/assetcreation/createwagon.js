import { Vector3, Quaternion } from "@babylonjs/core"
import { getSocketContainers } from "../sockets/worldsocket"
import { createAggregate } from "../tools/physics"
const spd = 20
export function createWagon(_scene, _pos, _targ, justTheWagon, isForTravel){
    // callers (areascene.js's optionalObjects loop) hand this a plain
    // {x,y,z} data literal off localroomdb.js, not a real Vector3. Assigning
    // that straight to .position looks fine (the numbers read back
    // correctly) but silently breaks rendering: Babylon's real Vector3 sets
    // an internal _isDirty flag on every mutation, and TransformNode's own
    // _isSynchronized() gates whether to recompute the world matrix on
    // exactly that flag (transformNode.pure.js) - a plain object has no
    // _isDirty at all, so Babylon concludes nothing moved and never
    // recomputes, leaving the mesh frozen wherever it was cloned to
    // (near the master prefab, not _pos). Normalized once here, then
    // .clone()'d per mesh below so wg/wroot never end up sharing one
    // Vector3 instance either (that would just trade this bug for a
    // "moving one drags the other" one).
    const pos = _pos instanceof Vector3 ? _pos : new Vector3(_pos.x, _pos.y, _pos.z)
    const targ = !_targ ? null : (_targ instanceof Vector3 ? _targ : new Vector3(_targ.x, _targ.y, _targ.z))

    const wagonbodycollider = getSocketContainers().wagonBodyColliderRoot
    const wagonroot = getSocketContainers().wagonRoot

    const wg = wagonbodycollider.clone()
    const wroot = wagonroot.clone()


    // // const justaBox = MeshBuilder.CreateBox("asd", {depth: 2}, currScene)
    // const forward = myPlayer.body.getDirection(Vector3.Forward())
    // // const spawnPos = myPlayer.body.position.add(forward.scale(2))
    // const distanceFromMe = 2
    // const plPos = myPlayer.body.position.clone()
    // const spawnPos = new Vector3(plPos.x+(forward.x*distanceFromMe), plPos.y+forward.y, plPos.z+(forward.z*distanceFromMe))
    // // const direction = new Vector3(plPos.x+(forward.x*4), plPos.y+forward.y, plPos.z+(forward.z*4))
    // const direction = spawnPos.add(forward.scale(2))
    // const direction = spawnPos.add(Vector3.Forward())
    // justaBox.position.copyFrom(spawnPos)
    // justaBox.position = spawnPos
    
    // justaBox.lookAt(direction,0,0,0)

    wg.parent = null
    wg.isVisible = false
    let mainWagon
    if(justTheWagon){
        wroot.parent = null
        wroot.isVisible = true
        mainWagon = wroot
    }else{
        wroot.parent = wg
        wroot.isVisible = true
        mainWagon = wg
    }


    mainWagon.position = pos.clone()
    if(targ) mainWagon.lookAt(targ,0,0,0)


    const agg = createAggregate(mainWagon, { mass: isForTravel ? 2 : 0, friction: isForTravel ? 1 : 0, restitution: 0}, "box", _scene)
    // agg.body.setMassProperties({
    //     mass: 100,
    //     // inertia: new Vector3(1, 0, 1),
    //     // inertiaOrientation: Quaternion.Identity(),
    // })
    // agg.body.setAngularFactor(new Vector3(1, 0, 1))
    agg.body.disablePreStep = false
    agg.body.setAngularDamping(30)
    // const boxForward = justaBox.getDirection(Vector3.Forward())


    // WHEELS - each glb is a full AXLE PAIR (both wheels modelled
    // together, X bounds -1.31..1.30), so one clone per axle, not
    // per wheel. Parented to wroot so they ride the visible wagon.
    //
    // Placement is derived from wroot own bounds rather than
    // hardcoded, so a re-export of wagon.glb moves the axles with
    // it. wagon.glb currently spans Z -1.74..5.49 with its body
    // bottom at Y 0.76, leaving exactly the gap these sit in.
    const wheelFrontRoot = getSocketContainers().wagonWheelFrontRoot
    const wheelRearRoot = getSocketContainers().wagonWheelRearRoot
    let frontWheels
    let rearWheels
    if(wheelFrontRoot && wheelRearRoot){
        const wb = wroot.getBoundingInfo().boundingBox
        // inset from each end so the axles sit under the bed
        // rather than poking past it
        const AXLE_INSET = 0.8
        const frontZ = wb.maximum.z - AXLE_INSET
        const rearZ = wb.minimum.z + AXLE_INSET
        // wheel is centre-pivoted vertically (Y -0.73..0.70), so
        // placing it at its own radius rests the bottom on y=0
        const wheelY = 0.7

        frontWheels = wheelFrontRoot.clone("wagonwheel_front_" + Date.now())
        frontWheels.parent = wroot
        frontWheels.position.set(0, wheelY, frontZ-2.5)
        frontWheels.rotationQuaternion = null
        frontWheels.rotation.set(0, 0, 0)
        frontWheels.isVisible = true
        frontWheels.setEnabled(true)
        frontWheels.isPickable = false

        rearWheels = wheelRearRoot.clone("wagonwheel_rear_" + Date.now())
        rearWheels.parent = wroot
        rearWheels.position.set(0, wheelY, rearZ)
        rearWheels.rotationQuaternion = null
        rearWheels.rotation.set(0, 0, 0)
        rearWheels.isVisible = true
        rearWheels.setEnabled(true)
        rearWheels.isPickable = false

        
        let dirForward = wg.getDirection(Vector3.Forward())
  
        // myPlayer.body.parent = wg
        // attachCam(frontWheels)
        
        // setInterval(() => {
        //     agg.body.disablePreStep = false
        //     wg.lookAt(dirForward,Math.PI,0,0, Space.LOCAL)
        //     setTimeout(() => {agg.body.disablePreStep = true}, 100)
        // }, 5000)
        // _scene.onAfterRenderObservable.add(() => {
        //     // dirForward = wg.getDirection(Vector3.Forward())
        //     const vel = agg.body.getLinearVelocity()
            
        //     agg.body.setLinearVelocity(new Vector3(dirForward.x*spd, vel.y, dirForward.z*spd))
        //     frontWheels.addRotation(Math.PI/10,0,0)
        //     rearWheels.addRotation(Math.PI/10,0,0)

        //         myPlayer.body.position.y = wg.position.y+10
        //         myPlayer.body.position.x = wg.position.x
        //         myPlayer.body.position.z = wg.position.z
        // })
    }

    if(justTheWagon){
        wroot.parent = null;
        wroot.position = pos.clone()
        wroot.isVisible = true
        if(targ) wroot.lookAt(targ,0,0,0)
            console.log(wroot.parent)
        return { wg: wroot}
    }else{
        return { wg, agg, frontWheels, rearWheels }
    }
}