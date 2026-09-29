import { MeshBuilder, Vector3, StandardMaterial, Color3 } from "@babylonjs/core"
import { getEnemiesOnScene, getPlayersOnScene, getDuelOpponentsOnScene } from "../sockets/worldsocket.js"

// AIM PROBE - a soft-lock pass for projectile skills.
//
// Skills used to aim at a fixed point 10 units straight ahead
// (fireElementalProjectile's own `spawnPos.add(forward.scale(10))`), which
// means a cast only ever went exactly where the body happened to be facing.
// This fires a deliberately oversized scout ahead of the real
// projectile; the first thing it overlaps becomes that projectile's target,
// and the projectile curves onto it mid-flight.
//
// The probe leads the projectile on purpose (PROBE_SPEED is well above
// skillEffects.js's PROJECTILE_SPEED of 12) so a lock lands early in the
// projectile's flight, while it still has room to turn. Launching them at the
// same speed would mean the target is only found around the moment the
// projectile arrives, far too late to steer.

// Multiplier on the 0.7-unit template box, so the probe sweeps a ~2.1-unit
// volume. Fat on purpose: this is aim ASSIST, and a thin probe would only ever
// lock onto something already dead-centre, which is exactly the case that did
// not need help.
const PROBE_SCALE = 1
// how far ahead it will look before giving up
const PROBE_RANGE = 2050
// units/sec. ~1.25s to cover PROBE_RANGE.
const PROBE_SPEED = 300

// DEBUG - draws the probe as a green wireframe box so its flight and the
// moment it overlaps a target are visible. Set back to false for normal play.
const PROBE_VISIBLE = false

/**
 * Fire an aim probe forward from `spawnPos`. Invisible unless PROBE_VISIBLE.
 *
 * @param {Scene}    scene
 * @param {Vector3}  spawnPos
 * @param {Vector3}  forward      normalized direction
 * @param {string}   casterOwner  so the caster never locks onto themselves
 * @param {(targetBody) => void} onLock  called once, with the first body hit
 * @returns {() => void} cancel - tears the probe down early
 */
export function fireAimProbe(scene, spawnPos, forward, casterOwner, onLock){
    if(!scene || scene.isDisposed || !onLock) return () => {}

    const probe = MeshBuilder.CreateBox(`aimprobe_${Date.now()}`, { size: PROBE_SCALE, height: PROBE_SCALE*10 }, scene)
    probe.position.copyFrom(spawnPos)
    probe.scaling.setAll(PROBE_SCALE)
    // DEBUG VISIBILITY - flip PROBE_VISIBLE back to false once you have seen
    // it fly. This is meant to be invisible in normal play: the probe is a
    // crude oversized volume, it outruns the projectile it is aiming for, and
    // at scale 3 it is far bigger than anything it represents.
    probe.isVisible = PROBE_VISIBLE
    if(PROBE_VISIBLE){
        // wireframe rather than a solid block, so it does not simply fill the
        // screen as it passes the camera, and so overlaps stay readable
        const debugMat = new StandardMaterial("aimprobe_debug_mat", scene)
        debugMat.wireframe = true
        debugMat.emissiveColor = new Color3(0.1, 1, 0.3)
        debugMat.disableLighting = true
        probe.material = debugMat
        // the material is this probe's own, so it dies with it rather than
        // leaking one per cast
        probe._debugMat = debugMat
    }
    probe.isPickable = false
    // placementMode.js's obstacle scan walks scene.meshes - while PROBE_VISIBLE
    // is false the isVisible check already excludes it, but with it true this
    // flag is what keeps a probe from registering as an obstacle mid-flight
    probe._isPlacementGhost = true

    // Candidates resolved ONCE at launch rather than per frame. The probe
    // lives ~1.25s at most, and rebuilding three arrays every frame for every
    // in-flight projectile is real cost in a fight - openworld can hold
    // hundreds of enemies (see renderer.js's own distance-culling comment).
    const candidates = []
    const add = (entry) => {
        const body = entry?.body
        if(!body || body.isDisposed()) return
        // never lock onto whoever fired this
        if(entry.owner && entry.owner === casterOwner) return
        candidates.push(body)
    }
    getEnemiesOnScene()?.forEach(add)
    getPlayersOnScene()?.forEach(add)
    getDuelOpponentsOnScene()?.forEach(add)

    let travelled = 0
    let done = false
    const step = new Vector3()

    const finish = () => {
        if(done) return
        done = true
        if(!scene.isDisposed && observer) scene.onBeforeRenderObservable.remove(observer)
        // dispose the debug material too - Mesh.dispose leaves materials alone
        // by default (they are usually shared), but this one belongs to this
        // probe alone, and a probe is created on EVERY projectile cast. Without
        // this, a long fight strands one StandardMaterial per shot.
        probe._debugMat?.dispose()
        probe.dispose()
    }

    const observer = scene.onBeforeRenderObservable.add(() => {
        if(done) return
        const dt = scene.getEngine().getDeltaTime() / 1000
        const distance = PROBE_SPEED * dt

        step.copyFrom(forward).scaleInPlace(distance)
        probe.position.addInPlace(step)
        travelled += distance

        for(const body of candidates){
            if(body.isDisposed()) continue
            // bounding-box test (precise:false) - the probe is a crude
            // oversized volume by design, so triangle-accurate intersection
            // would cost more and mean nothing
            if(probe.intersectsMesh(body, false)){
                finish()
                onLock(body)
                return
            }
        }

        if(travelled >= PROBE_RANGE) finish()
    })

    return finish
}
