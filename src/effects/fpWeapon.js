import { TransformNode, Vector3 } from "@babylonjs/core"
import { isFirstPerson } from "../tools/camera.js"
import { getIsMoving } from "../controllers/inputMovement.js"

// THE WEAPON IN FIRST PERSON - in first person (tools/camera.js - the grotto
// mazes) my own avatar is hidden, and the weapon in its hand is mostly below
// or beside the eye, so it barely showed even mid-swing. Instead, as
// first-person games do, a copy of the weapon I have drawn is held at the
// bottom right of the view: swaying as I walk, and slashing across when I
// swing (meleeCombat.js's prepareMeleeSwing calls swingFirstPersonWeapon, timed
// to land with the blow). Everyone else still sees my avatar's own swing.
//
// Drawn in the last rendering group, its depth cleared first, so it never
// sinks into a wall in front of me. Only while a weapon is drawn (in my
// hand, not on my back) and only in first person; the copy shares the
// weapon's geometry and materials and is kept until I draw another.

const GROUP = 3
// a sword about a metre long - createWeapon's blade runs 6.75 down its -z
// from the grip (and 1.3 of grip and pommel up its +z)
const SCALE = 0.125
// poses in the camera's space - x right, y up, z ahead - the grip's place and
// the weapon's turn (x pitch, y yaw, z roll about the blade). With the blade
// down -z, pitch p and yaw w point it along (-cos p sin w, sin p, -cos p cos w)
export const FP_WEAPON_POSES = {
    // held up and ahead, leaning in toward the middle of the view
    rest:   { pos: new Vector3(0.36, -0.4, 0.62),  rot: new Vector3(2.5, -0.32, 0.6) },
    // drawn back over the right shoulder
    raised: { pos: new Vector3(0.3, -0.1, 0.5), rot: new Vector3(1.02, 0.73, 0.3) },
    // slashed down across to the left
    struck: { pos: new Vector3(-0.12, -0.46, 0.72), rot: new Vector3(3.45, -0.82, 1.2) },
}
const MIN_WINDUP_MS = 80
const STRIKE_MS = 130
const RECOVER_MS = 260

const states = new WeakMap()    // scene -> its state
let swing = null                // { from, impact } in performance.now() time

const easeOut = t => 1 - (1 - t) * (1 - t)
const easeIn = t => t * t
const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
function blend(out, a, b, t){
    out.pos.copyFrom(a.pos).scaleInPlace(1 - t).addInPlace(b.pos.scale(t))
    out.rot.copyFrom(a.rot).scaleInPlace(1 - t).addInPlace(b.rot.scale(t))
}

/** My swing, its blow `impactMs` from now - the held copy raises and slashes across in time with it. */
export function swingFirstPersonWeapon(impactMs){
    const now = performance.now()
    swing = { from: now, impact: now + Math.max(MIN_WINDUP_MS, impactMs) }
}

// the weapon `player` has drawn (in its hand and shown), or null
function drawnWeapon(player){
    if(!player?.rHand || !player.swordMeshes?.length) return null
    return player.swordMeshes.find(entry => entry.mesh && !entry.mesh.isDisposed() &&
        entry.mesh.parent === player.rHand && entry.mesh.getChildMeshes().some(mesh => mesh.isVisible)) ?? null
}

/** Keeps my drawn weapon in view whenever I'm in first person - once per scene, for my own character. */
export function startFirstPersonWeapon(player){
    const scene = player?.body?.getScene?.()
    if(!scene || states.has(scene)) {
        if(scene) states.get(scene).player = player
        return
    }
    const holder = new TransformNode("fp.weapon.holder", scene)
    holder.setEnabled(false)
    const state = { player, holder, copy: null, source: null }
    states.set(scene, state)
    const pose = { pos: new Vector3(), rot: new Vector3() }
    scene.onBeforeRenderObservable.add(() => {
        const cam = scene.activeCamera
        const drawn = isFirstPerson() && cam ? drawnWeapon(state.player) : null
        if(!drawn){
            if(holder.isEnabled()) holder.setEnabled(false)
            return
        }
        if(holder.parent !== cam) holder.parent = cam
        if(state.source !== drawn.mesh){
            state.copy?.dispose(false, false)
            state.copy = copyOf(drawn.mesh, holder)
            state.source = drawn.mesh
        }
        if(!holder.isEnabled()) holder.setEnabled(true)

        const now = performance.now()
        const { rest, raised, struck } = FP_WEAPON_POSES
        if(swing && now < swing.impact + STRIKE_MS + RECOVER_MS){
            // the blade comes down through the blow's moment
            const windup = Math.max(MIN_WINDUP_MS, swing.impact - STRIKE_MS * 0.7 - swing.from)
            const t = now - swing.from
            if(t < windup) blend(pose, rest, raised, easeOut(t / windup))
            else if(t < windup + STRIKE_MS) blend(pose, raised, struck, easeIn((t - windup) / STRIKE_MS))
            else blend(pose, struck, rest, easeInOut(Math.min(1, (t - windup - STRIKE_MS) / RECOVER_MS)))
        } else {
            swing = null
            blend(pose, rest, rest, 0)
        }
        // walking sways it, standing it breathes
        const s = now / 1000
        if(getIsMoving()){
            pose.pos.y += Math.sin(s * 9) * 0.014
            pose.pos.x += Math.cos(s * 4.5) * 0.012
        } else {
            pose.pos.y += Math.sin(s * 1.7) * 0.005
        }
        holder.position.copyFrom(pose.pos)
        holder.rotation.copyFrom(pose.rot)
    })
}

// the drawn weapon again, under the holder: its own size and turn reset (in
// the hand a bone's scale shrank it), drawn over everything, never picked
function copyOf(source, holder){
    const copy = source.clone("fp.weapon", holder, false)
    if(!copy) return null
    copy.position.setAll(0)
    copy.rotationQuaternion = null
    copy.rotation.setAll(0)
    copy.scaling.setAll(SCALE)
    copy.getChildMeshes(false).forEach(mesh => {
        // a clone keeps the camera's hidden-avatar mask the original wore
        mesh.layerMask = 0x0FFFFFFF
        mesh.renderingGroupId = GROUP
        mesh.isPickable = false
        mesh.alwaysSelectAsActiveMesh = true
    })
    return copy
}
