/** 
 * @typedef {{
 *  placeId: string,
 *  name: string,
 *  areaType: string
 * }} CurrentPlaceShort
 */

/**
 * @typedef {{
 *  boots: string,
 *  cloth: string,
 *  currentPlace: CurrentPlaceShort,
 *  hair: string,
 *  lvl: number,
 *  name: string,
 *  owner: string,
 *  pants: string,
 *  socketId: string
 * }} TcpCharDet
 */

/**
 * @param {TcpCharDet} tcpCharDet
 */
import { sceneCleanupReady } from "../components/cleanup.js"
import { attachControllerToThisCharacter, activateMouseControls, markDashActive, lastHitEnemy } from "../controllers/inputMovement.js"
import { getSceneDet } from "../main/main.js"
import { findPlaceMetaData } from "../states/placestates.js"
import { attachCam } from "../tools/camera.js"
import { getSpawnPos } from "../tools/position.js"
import { createCharacter } from "./createcharacter.js"
import { ActionManager, MeshBuilder, Quaternion, Vector3 } from "@babylonjs/core"
import { getCharState, setCharStateMode } from "./characterstate"
import { getPlayersOnScene } from "../sockets/worldsocket.js"


export function createMyCharacter(charState, scene, allsounds){

    // const tcpCharPlaceMD = findPlaceMetaData(tcpCharDet.currentPlace.placeId)

    // let spawnPos = getSpawnPos(tcpCharPlaceMD)
    let spawnPos = { x: charState.x, y: charState.y, z: charState.z}

    const player = createCharacter(scene, spawnPos, {...charState,
        // mode would be by default always Idle if newly joined
    // addiditonal infos because our tcpCharDet does not come from tcp(in tcp we put this additional info) 
    _moving: false,
    _minning: false, 
    }, true)
    if(!player) return
    attachCam(player.camParent)

    const controls = attachControllerToThisCharacter(player, scene, allsounds)
    // r-click hold-to-block - myPlayer (inputMovement.js's own module-level
    // ref) is already set to this exact `player` object by
    // attachControllerToThisCharacter above, so this is safe to activate
    // right after it returns
    activateMouseControls(scene)

    const atkCollider = createAttackColliderForEnemy(scene, player.body)

    sceneCleanupReady(scene, controls)

    setCharStateMode(charState.mode)

    return player
}

function createAttackColliderForEnemy(scene, body){
    const atkCollider = MeshBuilder.CreateBox("atkCollider", {width: 2, height: 0.25, depth: 1}, scene)
    atkCollider.isPickable = false
    // Parented to the player's own body instead of being repositioned in
    // world space every swing (positionAtkCollider used to recompute a
    // worldForward vector off player.body.getWorldMatrix() and clone its
    // rotationQuaternion every single attack just to keep the box "in front
    // of me"). Parenting means the box just sits at a fixed LOCAL offset
    // (position.z, see positionAtkCollider's reach) and Babylon's own
    // transform hierarchy keeps it correctly positioned/rotated relative to
    // the body for free, every frame, with no manual math needed.
    // skillEffects.js's strikeWithHandCollider (dashstrike) already expects
    // this - it saves whatever atkCollider.parent already is as
    // originalParent before reparenting onto player.rHand, then restores it
    // afterward, so it hands the box right back to the body once its own
    // hand-parented window ends.
    atkCollider.parent = body
    atkCollider.position = new Vector3(0, ATK_COLLIDER_PARKED_Y, 0)
    atkCollider.isVisible = false
    // flipped true only for skillEffects.js's own strikeWithHandCollider
    // window (dashstrike) - see that function's own comment. Lets
    // attackingSystem.js's registerToAtkCollider tell "this overlap is a
    // real melee swing/skill-strike against an enemy" apart from "this
    // overlap is just the same shared box passing through whatever happens
    // to be standing in its temporarily-hijacked, hand-parented, 12-units-
    // longer path" for callbacks (like tree-chopping) that should only ever
    // fire off an intentional attack, not a skill's incidental sweep.
    atkCollider.isSkillHijacked = false
    atkCollider.actionManager = new ActionManager(scene)
    // parked far out of reach of anything at rest - see positionAtkCollider's
    // own comment. No more perpetual registerBeforeRender climb here: that
    // used to run every frame for the entire life of the scene with nothing
    // ever capping it, so between attacks (most of actual play time) the box
    // sat at some arbitrary, ever-growing Y - and Scene._checkIntersections()
    // (@babylonjs/core/scene.pure.js) still bounding-box-tests it against
    // every currently-loaded enemy every single frame regardless, since
    // that check is unconditional for any mesh with an OnIntersection
    // trigger registered, no matter how far away it actually is. Parking it
    // at a single fixed, bounded position when idle doesn't reduce that
    // per-frame check count (still O(enemy count), inherent to using
    // ActionManager's intersection triggers at all), but at least it's a
    // fixed number instead of drifting into the hundreds of thousands over
    // a long session. (Position already set above.)
    return atkCollider
}
// how far below the ground the box waits between attacks - arbitrary, just
// has to be somewhere no enemy's hitbox could ever reach
export const ATK_COLLIDER_PARKED_Y = -1000
// how long the box stays at the caster's own body height (where it was
// positioned in front of them) before getting parked back out of reach -
// long enough for a real swing to land (the exit-intersection trigger only
// needs a single "was overlapping, now isn't" transition, whether that's
// from the enemy walking out of it or from the box itself moving away), but
// not so long it lingers as a stale hit zone well after the swing animation
// finished
const ATK_COLLIDER_ACTIVE_MS = 500
// player mass is 10 (see createcharacter.js's createAggregate call) - impulse
// = mass * deltaV, so this gives an instant forward deltaV of 2 m/s. Bump
// this up (not the deltaV math) if the dash should feel punchier.
const DASH_IMPULSE = 25
// how much bigger atkCollider's own Z depth gets for a running attack (see
// positionAtkCollider's own pos.isRunningAttack branch) - tune this number
// directly if it still whiffs too often, or overshoots too far
const RUNNING_ATK_COLLIDER_Z_MULT = 2.5
// tracks the pending "park it back out of reach" timeout across calls - a
// second attack press before the first one's timeout fires would otherwise
// leave two competing timeouts racing, the earlier one yanking the box away
// mid-way through the SECOND swing's own intersection window
let parkTimeoutId
export function positionAtkCollider(pos, dirTarg){
    const charState = getCharState()
    if(!charState) return
    const player = getPlayersOnScene().find(pl => pl.owner === charState.owner)
    if(!player) return
    const atkCollider = getSceneDet().scene.getMeshByName(`atkCollider`)
    if(!atkCollider) return

    // atkCollider is parented to player.body (createAttackColliderForEnemy)
    // now instead of being repositioned in world space every swing - so
    // "in front of me" is just a fixed LOCAL z offset, and Babylon's
    // transform hierarchy keeps it correctly positioned/rotated relative to
    // the body for free every frame. No more per-attack worldForward
    // recompute off getWorldMatrix() or rotationQuaternion cloning needed -
    // a local Identity rotation always faces the same way the parent does.
    const reach = pos?.reach ?? 1.0       // local forward distance (punch ~0.8, kick ~1.0, weapon ~1.5)

    // local X/Y stay 0 (centered on the body, chest height) - only Z (how
    // far in front) changes per attack
    atkCollider.position.set(0, 0, reach)
    atkCollider.rotationQuaternion = Quaternion.Identity()

    // Get forward direction from player's world matrix - still needed below
    // for the dash impulse direction (world-space), unrelated to the box's
    // own now-local positioning above
    const forward = new Vector3(0, 0, 1)
    const worldForward = Vector3.TransformNormal(
        forward,
        player.body.getWorldMatrix()
    )
    worldForward.normalize()

    // running attacks (uimanagement.js's own "running_<weaponType>1" clip,
    // pos.isRunningAttack) cover more ground mid-swing than a stationary
    // one - the collider's own fixed depth (1 unit, see
    // createAttackColliderForEnemy) was too short to still be overlapping
    // the target by the time the hit actually needs to register, reading
    // as "attacks while running just don't land." Temporarily scale up its
    // Z (forward/backward depth) for this one swing, restored by this same
    // call's own park-timeout below.
    //
    // Only touches scaling.z when THIS call actually boosted it (never for
    // a plain grounded/stationary attack) - skillEffects.js's own
    // strikeWithHandCollider independently scales this exact shared mesh
    // for dashstrike's own reach extension, and a plain attack forcing it
    // back to 1 here could clip a dashstrike's own still-active window
    // short. Set to a fixed absolute value (not "current * multiplier")
    // for the same reason parkTimeoutId's own comment above already flags -
    // a second running attack landing before the first one's timeout fires
    // would otherwise compound the multiplier further each time instead of
    // just re-applying the same boost.
    if(pos?.isRunningAttack) atkCollider.scaling.z = RUNNING_ATK_COLLIDER_Z_MULT

    // Attack dash - shove the player forward in the swing direction.
    // applyImpulse lives on aggregate.BODY, not the aggregate itself.
    // mass:10 (set at aggregate creation, see createcharacter.js) means
    // an impulse of DASH_IMPULSE gives an instant deltaV of
    // DASH_IMPULSE/10 m/s forward (impulse = mass * deltaV) - tune the
    // constant, not the math. Applied at the body's own position (its
    // center) so this stays pure translation - the aggregate's inertia
    // was already zeroed out at creation (locked rotation, capsule
    // shouldn't tip over), so an off-center location wouldn't spin it
    // anyway, but there's no reason to rely on that here.
    if(player.aggregate){
        setTimeout(() => {
            // lastHitEnemy (inputMovement.js) - dash toward whatever I most
            // recently landed a melee hit on instead of always my own local
            // forward direction, if there IS a live one. Read fresh here
            // (not captured back when positionAtkCollider itself was
            // called) since this runs 300ms later - the tracked enemy could
            // have died in that window (createEnemy.js's own melee hit
            // handler clears it back to null the instant that happens, see
            // setLastHitEnemy there) or gotten disposed some other way,
            // hence the isDisposed() check on top of the null check.
            let dashDirection = worldForward
            // if(lastHitEnemy?.body && !lastHitEnemy.body.isDisposed()){
            //     const toEnemy = lastHitEnemy.body.absolutePosition.subtract(player.body.absolutePosition)
            //     toEnemy.y = 0 // keep the dash horizontal, same plane worldForward already stays in
            //     if(toEnemy.lengthSquared() > 0.0001) dashDirection = toEnemy.normalize()
            // }
            player.aggregate.body.applyImpulse(dashDirection.scale(DASH_IMPULSE), player.body.absolutePosition)
            // without this, inputMovement.js's own movement loop hard-overwrites
            // linear velocity every physics tick while a movement key/joystick is
            // held - which stomps this impulse before it ever renders a frame
            markDashActive()
        }, 300)

    }

    clearTimeout(parkTimeoutId)
    parkTimeoutId = setTimeout(() => {
        atkCollider.position.y = ATK_COLLIDER_PARKED_Y
        // only undo what THIS call actually set - see this function's own
        // isRunningAttack comment above for why a blind reset here would
        // be wrong
        if(pos?.isRunningAttack) atkCollider.scaling.z = 1
    }, ATK_COLLIDER_ACTIVE_MS)
}