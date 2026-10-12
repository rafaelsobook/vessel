import { getProjectilesOnScene, getPlayersOnScene, getIsSocketOn, getEnemiesOnScene, getNpcOnScene } from "./worldsocket";
import { getCharState } from "../charactersystem/characterstate.js";
import { playAnim, ANIM_STATE, findAnimVariants } from "../tools/animation.js";
import { getGameStatus } from "../main/main.js";
import { Vector3, PhysicsRaycastResult } from "@babylonjs/core";
import { updateNpcPatrol } from "../npc/npcPatrol.js";
import { sampleTerrainSurfaceHeight } from 'infterrain'
import { OPENWORLD_PLACE_ID, OPENWORLD_TERRAIN_VERTS } from "../constants/constants.js";
import { emitEnemyChasePosition } from "./emits.js";
import { capsuleHeight } from "../charactersystem/createcharacter.js";
import { stopEnemyEating, isEnemyRoaring, stopEnemyRoar } from "../enemies/createEnemy.js";
import { findPlaceMetaData } from "../states/placestates.js";

let scene;

// reused every frame instead of `new Vector3(...)` inline below - this loop
// runs for every projectile/enemy/npc every single frame, so allocating a
// fresh Vector3 per call adds up to real GC pressure under load
const _moveVec = new Vector3()
const _lookTarget = new Vector3()

// openworld enemy distance-hiding thresholds (see the getEnemiesOnScene
// loop below) - squared since planar distance is compared as dx*dx+dz*dz,
// never actually sqrt'd. SHOW < HIDE on purpose (hysteresis), not the same
// value - see that loop's own comment.
const OPENWORLD_ENEMY_HIDE_DIST = 200
const OPENWORLD_ENEMY_SHOW_DIST = 180
const OPENWORLD_ENEMY_HIDE_DIST_SQ = OPENWORLD_ENEMY_HIDE_DIST * OPENWORLD_ENEMY_HIDE_DIST
const OPENWORLD_ENEMY_SHOW_DIST_SQ = OPENWORLD_ENEMY_SHOW_DIST * OPENWORLD_ENEMY_SHOW_DIST

// openworld projectile ground-following (see the getProjectilesOnScene loop
// below) - a straight-line projectile fired across sloping terrain will
// either plow into a rising hill or sail way up over a dip, since it has no
// idea the ground even exists. clearance is purely vertical (projectile's
// own y minus the terrain surface directly below it), not a true distance
// to the nearest surface point - cheap, and matches what "how high above
// the ground am I" actually means here.
//   clearance < LOW  (too close / about to clip into rising ground) -> nudge UP
//   clearance > HIGH (drifting too far above a dip, but still under FAR) -> nudge DOWN
//   LOW..HIGH -> dead zone, left alone (stops it from jittering constantly
//   trying to hold an exact height)
//   > FAR -> leave it alone entirely - e.g. cast mid-jump/from a ledge, way
//   above the ground on purpose, not something to fight back down to earth
//
// proj.willDetectSurface === false opts a projectile OUT of this entirely -
// creations/skills.js's own spawnProjectile (astralrainSkill's falling
// swords, spawnFallingSword) sets this because it already does its own real
// ground/wall/tree hit detection via physicsEngine.raycast() every frame;
// without the opt-out, this nudge was fighting that projectile's own
// intentional fall path - pushing a sword back up out of PROJECTILE_GROUND_LOW
// right as it was trying to embed into the ground kept it from ever actually
// reaching it, so it never registered a hit at all.
// BOT MOVEMENT (see the getPlayersOnScene loop below) - BOT_WALK_SPEED
// matches real players' own controllers/inputMovement.js walkSpeed:1.
// BOT_SPRINT_SPEED is real sprintSpeed:20 cut 80% (20*0.2 = 4) on request -
// full speed read as too fast/frantic. MUST match tcp/recources/npcBrain.ts's
// own SPRINT_SPEED exactly, that file's the one actually deciding
// arrival/combat timing based on this same number, this is only what steps
// a bot's position each frame client-side.
const BOT_WALK_SPEED = 1
const BOT_SPRINT_SPEED = 4

// how often a chasing enemy pings its own live x/z back to tcp (see
// emitEnemyChasePosition's own header comment, sockets/emits.js) - close to
// npcBrain.ts's own COMBAT_CHECK_MS (1000ms), so a bot's next combat
// re-check is never working off more than about one report-cycle of
// staleness, without reporting anywhere near every frame
const CHASE_POS_REPORT_INTERVAL_MS = 1200

// CHASE OBSTACLE AVOIDANCE - enemies have no physics body of their own (they're
// translated directly), so a chase used to walk straight through walls, houses
// and props. While chasing, three physics rays - ahead, ahead-left and
// ahead-right, at the enemy's body height - find what's in the way, and the
// enemy veers around it. Every wall/house/prop/rock already has a collider.
const AVOID_RAY_LENGTH = 2.5
const AVOID_RAY_ANGLE = Math.PI / 5          // the side rays, 36° off the heading
// how far it veers when blocked ahead, tried in this order (see chaseHeading)
const AVOID_TURN_ANGLES = [Math.PI / 2.5, Math.PI / 2, Math.PI * 2 / 3, Math.PI * 5 / 6]
// once it picks a side to go around, it keeps it this long - otherwise it
// flip-flops left/right in front of a wall it's facing head-on
const AVOID_COMMIT_MS = 700
// closer than this, a direction counts as blocked even for the fallback turns
const AVOID_MIN_CLEARANCE = 0.6
// rays re-cast every Nth frame per enemy, the chosen heading reused between
const AVOID_RECHECK_FRAMES = 4

const _rayFrom = new Vector3()
const _rayTo = new Vector3()
const _rayResult = new PhysicsRaycastResult()

// distance to the first obstacle along the planar direction (dirX, dirZ) within
// maxLength, or Infinity. Floors and slopes (mostly-upward normals - openworld
// terrain, the dungeon's stair ramp) aren't obstacles, and neither is a
// player's body - the chased player must not block its own chaser.
function obstacleDistance(physicsEngine, origin, dirX, dirZ, maxLength){
    _rayFrom.copyFrom(origin)
    _rayTo.set(origin.x + dirX * maxLength, origin.y, origin.z + dirZ * maxLength)
    physicsEngine.raycastToRef(_rayFrom, _rayTo, _rayResult)
    if(!_rayResult.hasHit) return Infinity
    if(Math.abs(_rayResult.hitNormalWorld.y) > 0.6) return Infinity
    if(_rayResult.body?.transformNode?.name?.startsWith("player.")) return Infinity
    const hit = _rayResult.hitPointWorld
    return Math.hypot(hit.x - origin.x, hit.z - origin.z)
}

// DUNGEON ROUTING - the rays only see what's right in front, so a target on the
// far side of a long wall left the chaser pressed against it (Havok test: 3 of
// 5 dungeon chases stalled). In a dungeon the grid is known, so the chase aims
// along the shortest route through it instead of straight at the target - the
// rays still keep it off walls along the way. Elsewhere (village, openworld:
// isolated houses/trees, no grid) it's rays only.
const ROUTE_LOOKAHEAD_CELLS = 6
const ROUTE_SAMPLE_STEP = 0.5
const MAX_CACHED_ROUTES = 32
// `${placeId}:${cellX}_${cellZ}` (the target's cell) -> Int32Array of route
// lengths in cells from every cell to it, -1 for walls/unreachable. Shared by
// every enemy chasing anyone standing in that cell.
const _routeFields = new Map()

// props createDungeon gives a collider - the route treats their cells as
// blocked, or it keeps steering into a barrel/chest the rays then push away from
const SOLID_PROP_TYPES = new Set(["barrel", "chest", "ancient_chest", "crystal_pillar", "stalagmite"])

function dungeonOf(en){
    const place = findPlaceMetaData(en.det?.currentPlaceId)
    return place?.areaType === "dungeon" ? place : null
}

function routeField(placeId, dungeon, tx, tz){
    const key = `${placeId}:${tx}_${tz}`
    let field = _routeFields.get(key)
    if(field) return field
    const { grid } = dungeon.layout
    const solid = new Set((dungeon.props ?? []).filter(p => SOLID_PROP_TYPES.has(p.type)).map(p => p.x + p.y * grid[0].length))
    const w = grid[0].length, h = grid.length
    field = new Int32Array(w * h).fill(-1)
    if(grid[tz]?.[tx]){
        const queue = [tx + tz * w]
        field[queue[0]] = 0
        for(let i = 0; i < queue.length; i++){
            const x = queue[i] % w, z = (queue[i] - x) / w
            for(const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]){
                if(nx < 0 || nz < 0 || nx >= w || nz >= h || !grid[nz][nx] || field[nx + nz * w] !== -1 || solid.has(nx + nz * w)) continue
                field[nx + nz * w] = field[queue[i]] + 1
                queue.push(nx + nz * w)
            }
        }
    }
    if(_routeFields.size >= MAX_CACHED_ROUTES) _routeFields.delete(_routeFields.keys().next().value)
    _routeFields.set(key, field)
    return field
}

// is the straight line between two world points entirely over floor cells?
function gridLineClear(grid, cs, ax, az, bx, bz){
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / ROUTE_SAMPLE_STEP)
    for(let i = 1; i <= steps; i++){
        const t = i / steps
        if(!grid[Math.floor((az + (bz - az) * t) / cs)]?.[Math.floor((ax + (bx - ax) * t) / cs)]) return false
    }
    return true
}

// Where a chasing enemy in a dungeon should head for: the target itself if
// nothing but floor lies between them, otherwise the furthest cell a few
// steps down the shortest route that's still in a straight, all-floor line.
// null outside dungeons (or with no route), meaning "straight at the target".
function dungeonWaypoint(en, targetPos){
    const dungeon = dungeonOf(en)
    if(!dungeon) return null
    const { grid, cellSize: cs } = dungeon.layout
    const ex = en.body.position.x, ez = en.body.position.z
    if(gridLineClear(grid, cs, ex, ez, targetPos.x, targetPos.z)) return null

    const w = grid[0].length
    const field = routeField(en.det.currentPlaceId, dungeon, Math.floor(targetPos.x / cs), Math.floor(targetPos.z / cs))
    let x = Math.floor(ex / cs), z = Math.floor(ez / cs)
    let best = null
    for(let step = 0; step < ROUTE_LOOKAHEAD_CELLS; step++){
        const here = field[x + z * w]
        if(here <= 0) break
        const next = [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]].find(([nx, nz]) => field[nx + nz * w] === here - 1)
        if(!next) break
        ;[x, z] = next
        const cx = (x + 0.5) * cs, cz = (z + 0.5) * cs
        if(best && !gridLineClear(grid, cs, ex, ez, cx, cz)) break
        best = { x: cx, z: cz }
    }
    return best
}

// The planar unit heading a chasing enemy should move along this frame, or null
// to hold still (boxed in). Heads for the target - or, in a dungeon, the next
// point on the route to it - unless the rays say something's in the way.
function chaseHeading(en, targetPos, dist){
    // route and rays are re-worked every AVOID_RECHECK_FRAMES frames, the
    // heading they settled on reused in between
    en._avoidFrame = (en._avoidFrame ?? -1) + 1
    if(en._avoidFrame % AVOID_RECHECK_FRAMES !== 0 && en._chaseHeading !== undefined) return en._chaseHeading

    const aim = dungeonWaypoint(en, targetPos) ?? targetPos
    let dirX = aim.x - en.body.position.x
    let dirZ = aim.z - en.body.position.z
    const aimDist = Math.hypot(dirX, dirZ) || 1
    dirX /= aimDist
    dirZ /= aimDist
    dist = Math.min(dist, aimDist)

    const physicsEngine = scene?.getPhysicsEngine()
    if(!physicsEngine) return (en._chaseHeading = { x: dirX, z: dirZ })

    const rotate = angle => ({
        x: dirX * Math.cos(angle) - dirZ * Math.sin(angle),
        z: dirX * Math.sin(angle) + dirZ * Math.cos(angle),
    })
    // never further than the target itself - a wall behind the player isn't in the way
    const reach = Math.min(AVOID_RAY_LENGTH, dist)
    const origin = en.body.position
    const cast = d => obstacleDistance(physicsEngine, origin, d.x, d.z, reach)
    const left = rotate(AVOID_RAY_ANGLE)
    const right = rotate(-AVOID_RAY_ANGLE)
    const ahead = cast({ x: dirX, z: dirZ })
    const leftClear = cast(left)
    const rightClear = cast(right)

    const now = performance.now()
    let heading
    if(ahead < reach){
        // blocked ahead - go around on the clearer side (or the side it
        // already committed to), turning harder if that's blocked too, and
        // only then trying the other side (a committed side that dead-ends in
        // a corner used to pin the enemy there for good). The turns go past
        // 90°: sliding along a wall, the direction to the target rotates, so
        // "90° off it" ends up angled into the wall - without the wider turns
        // that read as blocked and the enemy paced back and forth in front of
        // a house instead of rounding its corner.
        const side = en._avoidSide && now < en._avoidUntil ? en._avoidSide : (leftClear >= rightClear ? 1 : -1)
        const turn = [side, -side]
            .flatMap(s => AVOID_TURN_ANGLES.map(angle => ({ s, d: rotate(s * angle) })))
            .find(t => cast(t.d) >= AVOID_MIN_CLEARANCE)
        heading = turn ? turn.d : null
        if(turn){
            en._avoidSide = turn.s
            en._avoidUntil = now + AVOID_COMMIT_MS
        }
    } else if(leftClear < reach / 2 || rightClear < reach / 2){
        // clear ahead but grazing something on one side - ease away from it
        heading = rotate(leftClear < rightClear ? -AVOID_RAY_ANGLE / 2 : AVOID_RAY_ANGLE / 2)
    } else {
        heading = { x: dirX, z: dirZ }
    }
    en._chaseHeading = heading
    return heading
}

// radians/sec a projectile may turn while making its one-time aim correction
// (see the aimPoint block in renderCallback). ~230 deg/sec - fast enough to
// come onto the direction quickly, slow enough that it reads as a curve rather
// than a snap. Per-projectile override via proj.homingTurnRate.
const PROJECTILE_HOMING_TURN_RATE = 4

// how close to the aimed heading counts as "done steering", in radians
// (~0.6 deg). Below this the correction is finished and aimPoint is dropped,
// so the projectile can never re-steer toward a point it has already passed.
const AIM_LOCKED_EPSILON = 0.01

// shortest-path step from `current` toward `target`, capped at `maxStep`.
// Plain lerping two angles takes the long way round whenever they straddle
// the -PI/+PI wrap - a projectile facing just past PI locking onto something
// just under -PI would spin almost a full turn the wrong way.
function stepAngle(current, target, maxStep){
    let diff = (target - current) % (Math.PI * 2)
    if(diff > Math.PI) diff -= Math.PI * 2
    if(diff < -Math.PI) diff += Math.PI * 2
    if(Math.abs(diff) <= maxStep) return target
    return current + Math.sign(diff) * maxStep
}

const PROJECTILE_GROUND_LOW = 0.4
const PROJECTILE_GROUND_HIGH = 0.95
const PROJECTILE_GROUND_FAR = 3
const PROJECTILE_GROUND_ADJUST_SPEED = 8 // units/sec of vertical nudge

// ENEMY SEPARATION - same problem, same fix duelSystem.js's own
// separationInterval already solved for npcFighter gauntlets: every enemy
// chasing the SAME player beelines straight for that player's exact
// position, so with 2+ enemies on one target they visually converge into
// one merged mesh (reported from an actual in-game screenshot - a Lucifer
// Deer standing on top of the player). This is the openworld-enemy
// equivalent - a periodic reactive nudge, not a targeting/pathing change,
// so it costs nothing when nobody's ganging up on anyone.
//
// Multiplayer note (this is NOT server-synced, and that's deliberate, not
// an oversight): enemy chase movement is already purely LOCAL per client -
// the chase loop below moves en.body via locallyTranslate() on THIS
// client's own frame, only ever snapped back in sync at key moments
// (worldsocket.js's "enemy-attacked"/"enemy-teleported" handlers), same as
// every other enemy in this file. What IS server-authoritative and synced
// to everyone is _targetId itself (set from socket data - see
// worldsocket.js's "enemy-attacked"/"newTargetId"/"enemy-attacking-me"
// handlers), so every client groups enemies by shared target identically
// even though the exact per-frame nudge amounts can drift slightly client
// to client - the visible result (enemies spread out instead of stacking)
// stays consistent on every screen without a new network message, the same
// tradeoff this file's own local chase movement already makes.
const ENEMY_SEPARATION_CHECK_MS = 200
// extra clearance on top of each pair's own combined bodyWidenes (their
// real box "size" - see createEnemy.js's own body creation) - a fixed
// distance would be too tight for a big monolith and too loose for a small
// slime, so this scales per-pair instead of duelSystem's single constant
// (every player-shaped fighter there is roughly the same size, enemies
// aren't).
const ENEMY_SEPARATION_MARGIN = 0.6
let enemySeparationInterval = null

function runEnemySeparationPass(){
    const chasers = getEnemiesOnScene().filter(en => en._isMoving && en._targetId && en.body && !en._disabled)
    if(chasers.length < 2) return

    // grouped by target FIRST - the pairwise check below only ever runs
    // WITHIN one group, so this stays bounded by however many enemies are
    // actually piled onto any one player, never the whole scene's enemy
    // count squared
    const groups = new Map()
    chasers.forEach(en => {
        const group = groups.get(en._targetId)
        if(group) group.push(en)
        else groups.set(en._targetId, [en])
    })

    groups.forEach(group => {
        if(group.length < 2) return
        for(let i = 0; i < group.length; i++){
            const a = group[i]
            for(let j = i + 1; j < group.length; j++){
                const b = group[j]
                const dx = b.body.position.x - a.body.position.x
                const dz = b.body.position.z - a.body.position.z
                const dist = Math.hypot(dx, dz)
                const minSeparation = (a.det.bodyWidenes + b.det.bodyWidenes) / 2 + ENEMY_SEPARATION_MARGIN
                if(dist >= minSeparation || dist < 0.001) continue

                // split the correction evenly, same as duelSystem.js's own
                const overlap = (minSeparation - dist) / 2
                const nx = dx / dist
                const nz = dz / dist
                a.body.position.x -= nx * overlap
                a.body.position.z -= nz * overlap
                b.body.position.x += nx * overlap
                b.body.position.z += nz * overlap
            }
        }
    })
}

export function removeRenderObservable(_scene){
    if(_scene) _scene.onBeforeRenderObservable.remove(renderCallback)
    if(enemySeparationInterval){
        clearInterval(enemySeparationInterval)
        enemySeparationInterval = null
    }
}
export function addRenderObservable(_scene){
    scene = _scene;
    scene.onBeforeRenderObservable.add(renderCallback)
    if(enemySeparationInterval) clearInterval(enemySeparationInterval)
    enemySeparationInterval = setInterval(runEnemySeparationPass, ENEMY_SEPARATION_CHECK_MS)
}


let renderCallback = function () {
    if(getGameStatus() === "loading") return;
    const charState = getCharState()
    if(!charState) return

    const dt = scene.getEngine().getDeltaTime()/1000
    
    getProjectilesOnScene().forEach(proj => {
        if(charState.currentPlace.placeId !== proj.placeId) return
        if(!proj.body) return
        if(proj.stuck) return

        // ONE-TIME AIM CORRECTION - proj.aimPoint is a FIXED world point,
        // captured by creations/aimProbe.js at the instant its scout overlapped
        // something (see fireElementalProjectile). Deliberately a point, not a
        // mesh reference: this steers toward where the target WAS when the lock
        // happened and then stops. It is aim assist, not a guided missile - a
        // projectile that kept reading a live body position would chase a
        // running enemy around corners forever.
        //
        // Steering happens HERE rather than in skillEffects because this loop
        // is the only thing that moves a projectile: movement is
        // locallyTranslate along the body's own local Z, so heading lives
        // entirely in body.rotation and nothing reads proj.targetDirection.
        //
        // Turned at a rate rather than snapped so the correction reads as a
        // curve, and so a late lock can't hook a projectile backwards. Once
        // aligned, aimPoint is cleared and the projectile flies straight for
        // the rest of its life - including straight PAST the target if it has
        // moved, which is the intended behaviour.
        if(proj.aimPoint){
            const tx = proj.aimPoint.x - proj.body.position.x
            const ty = proj.aimPoint.y - proj.body.position.y
            const tz = proj.aimPoint.z - proj.body.position.z

            const desiredYaw = Math.atan2(tx, tz)
            const desiredPitch = -Math.atan2(ty, Math.sqrt(tx * tx + tz * tz))
            const maxTurn = (proj.homingTurnRate ?? PROJECTILE_HOMING_TURN_RATE) * dt

            proj.body.rotation.y = stepAngle(proj.body.rotation.y, desiredYaw, maxTurn)
            proj.body.rotation.x = stepAngle(proj.body.rotation.x, desiredPitch, maxTurn)

            // aligned (or as close as one step gets) - lock the heading in and
            // never steer again. Without this the projectile would keep
            // correcting toward a point it is about to fly past, and start
            // circling it once overshot.
            const yawLeft = Math.abs(stepAngle(proj.body.rotation.y, desiredYaw, Math.PI) - proj.body.rotation.y)
            const pitchLeft = Math.abs(stepAngle(proj.body.rotation.x, desiredPitch, Math.PI) - proj.body.rotation.x)
            if(yawLeft < AIM_LOCKED_EPSILON && pitchLeft < AIM_LOCKED_EPSILON) proj.aimPoint = null
        }

        _moveVec.set(0, 0, proj.spd * dt)
        proj.body.locallyTranslate(_moveVec)

        // ground-following (openworld only - see the PROJECTILE_GROUND_*
        // constants' own comment above) - a straight shot fired across
        // sloping terrain has no idea the ground exists otherwise, so it'll
        // either plow straight into a rising hill or sail way up over a dip.
        // willDetectSurface === false opts out entirely (see that constant
        // block's own comment) - default (unset/true) still gets this.
        if(proj.placeId === OPENWORLD_PLACE_ID && proj.willDetectSurface !== false){
            const groundY = sampleTerrainSurfaceHeight(proj.body.position.x, proj.body.position.z, OPENWORLD_TERRAIN_VERTS)
            const clearance = proj.body.position.y - groundY
            if(clearance <= PROJECTILE_GROUND_FAR){
                if(clearance < PROJECTILE_GROUND_LOW){
                    proj.body.position.y += PROJECTILE_GROUND_ADJUST_SPEED * dt
                } else if(clearance > PROJECTILE_GROUND_HIGH){
                    proj.body.position.y -= PROJECTILE_GROUND_ADJUST_SPEED * dt
                }
            }
        }
    })

    getPlayersOnScene().forEach(player => {

        if(charState.currentPlace.placeId !== player.currentPlaceId) return
        if(!player.body) return

        // BOT MOVEMENT (tcp/recources/npcBrain.ts) - moved like npc/enemy
        // movement, not the real-player snap-to-exact-position model every
        // other playersOnScene entry uses. worldsocket.js's own
        // "bot-moving"/"bot-stopped" handlers only ever set facing
        // (body.lookAt) + _moving/mode - no x/z ever rides over the wire
        // for a bot, so actually covering ground is this client's own job,
        // every frame, independently - same "the server just says which
        // way, my own client does the stepping" trust level a real
        // enemy's own wander/chase already runs on. Bot-detection is a
        // plain owner-prefix check (bot_<id>, spawnBot's own id scheme) -
        // no dedicated isBot flag exists on the synced player data, this
        // is the cheapest way to tell without adding one.
        if(player.owner?.startsWith("bot_")){
            // "bot-dashing" (worldsocket.js, dashstrikeSkill's own melee
            // bots) - takes priority over the plain _moving check below and
            // runs regardless of it, since a dash fires from the "holding
            // still in attack range" state (_moving already false there) -
            // same locallyTranslate-ramp idea client/src/npc/duelSystem.js's
            // own performOpponentDashStrike uses for its dashstrike-using
            // npcFighters, just driven by a broadcast speed/duration instead
            // of a local scene.onBeforeRenderObservable
            if(player._dashUntil && performance.now() < player._dashUntil){
                _moveVec.set(0, 0, player._dashSpeedPerSec * dt)
                player.body.locallyTranslate(_moveVec)
            } else if(player._moving){
                const spd = player.mode === "fighting" ? BOT_SPRINT_SPEED : BOT_WALK_SPEED
                _moveVec.set(0, 0, spd * dt)
                player.body.locallyTranslate(_moveVec)
            }

            // openworld terrain-follow - same sampleTerrainSurfaceHeight()
            // correction every enemy already gets above (see this file's own
            // en.body.position.y lines in the wander/chase branches) - a
            // bot's own y only ever arrives as tcp's flat RESTING_Y constant
            // (spawnBot's own pos.y, tcp/index.ts - never resampled against
            // real terrain server-side, same reasoning enemies handle this
            // entirely client-side too), so without this every bot sits
            // wherever RESTING_Y happens to land relative to whatever's
            // actually under it on openworld's uneven ground - usually
            // buried below it. Applied unconditionally here (not gated to
            // _moving like the enemy branches, which only need it while
            // actively translating) so a bot that's simply standing still
            // the moment this client first renders it - never having moved
            // at all yet on THIS client - still gets corrected on its very
            // first frame instead of staying stuck underground until it
            // happens to move again.
            if(player.currentPlaceId === OPENWORLD_PLACE_ID){
                player.body.position.y = sampleTerrainSurfaceHeight(player.body.position.x, player.body.position.z, OPENWORLD_TERRAIN_VERTS) + capsuleHeight / 2 + 0.05
            }
        }

        if(!player.characterAnimations) return

        if(player.mode === "death") return
        if(player._attacking || player.characterAnimations.isActionPlaying()) return
        player.characterAnimations.tickBlend()

        // worn out (characterstate.js's isCharacterTired, synced as
        // player.isTired) - "walk_tired" takes over moving and "structed"
        // takes over standing, in or out of a fight. Every other mode
        // (casting, mining, sitting, falling...) keeps its own clip.
        const tiredPose = player.isTired && (player.mode === "idle" || player.mode === "fighting")

        if(player._moving && player.mode !== "inAir"){
            if(tiredPose){
                player.characterAnimations.setState(ANIM_STATE.WALK_TIRED, 8)
                return
            }
            switch(player.mode){
                case "idle":
                    player.characterAnimations.setState(ANIM_STATE.WALK, 8)
                break
                case "fighting":
                    player.characterAnimations.setState(ANIM_STATE.RUNNING, 8)
                break
            }
            return
        }

        if(tiredPose){
            player.characterAnimations.setState(ANIM_STATE.STRUCTED, 8)
            return
        }

        switch(player.mode){
            case "idle":
                player.characterAnimations.setState(ANIM_STATE.IDLE, 8)
            break
            case "fighting":
                player.characterAnimations.setState(ANIM_STATE.COMBAT_IDLE, 8)
            break
            case "structed":
                player.characterAnimations.setState(ANIM_STATE.STRUCTED, 8)
            break
            // uimanagement.js's startResting/stopResting - reuses the same
            // STRUCTED clip "structed" mode already plays (a kneeling/
            // seated-looking pose), just under its own distinct mode name
            // rather than overloading "structed" itself, which questions.js
            // already uses for an unrelated one-off post-hit stagger state
            case "resting":
                player.characterAnimations.setState(ANIM_STATE.STRUCTED, 8)
            break
            case "casting":
                player.characterAnimations.setState(ANIM_STATE.CASTING, 8)
            break
            case "minning":
                player.characterAnimations.setState(ANIM_STATE.MINNING, 8)
            break
            // charactersystem/seating.js - the root is already re-parented
            // onto the seat by then; this just keeps the pose held
            case "sitting":
                player.characterAnimations.setState(ANIM_STATE.SITTING, 8)
            break
            // a tent's bed - same seating.js re-parenting, lying down instead
            case "sleeping":
                player.characterAnimations.setState(ANIM_STATE.SLEEPING, 8)
            break
            case "inAir":
                player.characterAnimations.setState(ANIM_STATE.FALLING, 4)
            break
        }
        // player.anims.forEach(anim => {
        //     if(anim.isPlaying) console.log(anim.name)
        // })
    })
    // openworld (see OPENWORLD_PLACE_ID) can have hundreds of enemies alive
    // at once (tcp/recources/enemyDetails.ts spawns ~500 fireslime/
    // electricslime in banded rings 300-1000 units out from spawn), all
    // synced to every client currently in that place regardless of their own
    // character actually is - rendering (skinning + draw calls) for
    // hundreds of them when the camera could only ever see a handful
    // nearby would be wasted work. myOwnBody is only looked up once here
    // (not per-enemy) and only when it's actually needed.
    const myOwnBody = charState.currentPlace.placeId === OPENWORLD_PLACE_ID
        ? getPlayersOnScene().find(pl => pl.owner === charState.owner)?.body
        : null

    getEnemiesOnScene().forEach(en => {
        if(!en) return

        // distance-based hide/show, openworld only - purely a per-client
        // rendering decision, never touches the enemy's actual simulated
        // state (position/AI intervals/hp all keep running in
        // createEnemy.js regardless of enabled state, unaffected by this).
        // Each client decides this off its OWN character's position only,
        // completely independent of every other client - an enemy clashing
        // with a DIFFERENT player elsewhere in the same open world still
        // renders fully on THEIR screen; hiding it here only ever affects
        // this one client's own draw list. setEnabled (not isVisible) so
        // the whole hierarchy - nameMesh/hpbar/hpmesh/mainBodyMeshes are
        // all parented under en.body (see createEnemy.js) - hides/skips
        // skinning together in one call, and so atkDetection/chaseDetector
        // (also children of en.body) stop bothering to evaluate
        // intersections against a target this far away anyway.
        // OPENWORLD_ENEMY_SHOW_DIST < HIDE_DIST is deliberate hysteresis -
        // without a gap, hovering exactly at the boundary would toggle
        // setEnabled (and its internal dirty/recompute bookkeeping) every
        // single frame.
        if(myOwnBody && en.det?.currentPlaceId === OPENWORLD_PLACE_ID && en.body){
            const dx = en.body.position.x - myOwnBody.position.x
            const dz = en.body.position.z - myOwnBody.position.z
            const distSq = dx * dx + dz * dz
            const thresholdSq = en._farHidden ? OPENWORLD_ENEMY_SHOW_DIST_SQ : OPENWORLD_ENEMY_HIDE_DIST_SQ
            const shouldHide = distSq > thresholdSq
            if(shouldHide !== !!en._farHidden){
                en._farHidden = shouldHide
                en.body.setEnabled(!shouldHide)
            }
        }

        // eating (createEnemy.js's startEnemyEating) - ends on its own timer,
        // or immediately once the enemy gets a target (never eat with one)
        // or starts moving (wander/dodge/chase)
        if(en._eatingUntil && (en._targetId || en._isMoving || performance.now() >= en._eatingUntil)){
            stopEnemyEating(en)
        }

        // bound (see createEnemy.js's applyEnemyBind/skillEffects.js's
        // enemyBind) - "cannot move" while true, regardless of
        // _isMoving/_targetId state
        if(en._disabled) return

        // roaring at the target it just picked (createEnemy.js's
        // startEnemyRoar) - stands its ground, turned to face them, until
        // the roar's done; the chase below picks up from there
        if(en._roaringUntil){
            if(isEnemyRoaring(en)){
                const roarTarget = en._targetId && getPlayersOnScene().find(pl => pl.owner === en._targetId)?.body
                if(roarTarget){
                    _lookTarget.set(roarTarget.position.x, en.body.position.y, roarTarget.position.z)
                    en.body.lookAt(_lookTarget)
                }
                return
            }
            stopEnemyRoar(en)
        }

        // wander/dodge - moving toward a plain waypoint (tcp/index.ts's
        // own wander interval, or a locally-detected projectile dodge -
        // see worldsocket.js's "enemy-wander"/"enemy-dodge" handlers),
        // not a player. Takes priority over chasing below: a dodge
        // mid-fight should interrupt the chase for its short burst rather
        // than get silently skipped because _targetId is also still set -
        // _wanderTarget never touches _targetId itself, so the chase
        // simply resumes on its own once the waypoint is reached and this
        // branch stops claiming the frame.
        if(en._isMoving && en._wanderTarget){
            if(en.det.currentPlaceId === OPENWORLD_PLACE_ID){
                en.body.position.y = sampleTerrainSurfaceHeight(en.body.position.x, en.body.position.z, OPENWORLD_TERRAIN_VERTS) + en.det.bodyHeight / 2 + 0.05
            }

            const dx = en.body.position.x - en._wanderTarget.x
            const dz = en.body.position.z - en._wanderTarget.z
            const dist = Math.sqrt(dx * dx + dz * dz)

            const WANDER_ARRIVAL_THRESHOLD = 0.6
            if(dist < WANDER_ARRIVAL_THRESHOLD){
                en._wanderTarget = null
                en._isDodging = false
                // _isMoving is shared with the chase branch below - only
                // clear it for a pure wander (no _targetId). If this was a
                // dodge mid-fight, _targetId is still set and _isMoving
                // must stay true so the chase branch picks back up next
                // frame instead of the enemy freezing in place post-dodge.
                if(!en._targetId) en._isMoving = false
            } else {
                _lookTarget.set(en._wanderTarget.x, en.body.position.y, en._wanderTarget.z)
                en.body.lookAt(_lookTarget)

                // a plain wander (not a dodge burst) strolls at its own pace
                // instead of sprinting everywhere it idly roams - opt-in via
                // det.stats.walkSpd (genenemy.ts's own forestDeer/deerBase is
                // the first enemy to set one). Any enemy without it
                // (slime/monolith/lesserdemon etc) falls straight through to
                // the exact same en.spd/speedMult behavior this always had.
                const walkSpd = en.det.stats?.walkSpd
                const isWalking = !en._isDodging && !!walkSpd
                // dodging moves at 3x normal speed for its short burst -
                // see createEnemy.js's own dodge-detection interval
                const speedMult = en._isDodging ? 3 : 1
                const moveSpd = isWalking ? walkSpd : en.spd * speedMult
                _moveVec.set(0, 0, moveSpd * dt)
                en.body.locallyTranslate(_moveVec)

                // findAnimVariants returns [] for a rig with no "walking"
                // clip at all (slime/monolith/lesserdemon's own glbs never
                // modeled one) - falls back to "running" for those instead
                // of silently playing nothing
                const animBase = isWalking && findAnimVariants(en.anims, "walking").length ? "walking" : "running"
                findAnimVariants(en.anims, animBase).forEach(anim => {
                    if (!anim.isPlaying) {
                        anim.speedRatio = .9 + moveSpd * .05
                        anim.play()
                    }
                })
                // no dedicated walk sound asset exists yet (monsterSounds
                // only ever loads a run clip, ${modelStyle}run.mp3) - skip it
                // entirely while walking rather than playing running audio
                // under a walking animation
                if(!isWalking && en.runSound && !en.runSound.isPlaying) en.runSound.play()
            }
            return
        }

        // actionType === "chasing" gate is new - lesserdemon's own
        // actionType is "teleporting" (genenemy.ts's lesserDemonBase): it
        // can still end up with _isMoving/_targetId set true via the exact
        // same generic atkDetection-exit-trigger/emitChase path every other
        // enemy uses (left untouched - harmless, just inert for it now),
        // but should never actually WALK toward its target - it teleports
        // in near the player instead (createEnemy.js's own teleport
        // interval) rather than covering the distance on foot. Every
        // existing enemy's own actionType is already "chasing", so this is
        // a no-op change for all of them.
        if (en._isMoving && en._targetId && en.det.actionType === "chasing") {
            // was scene.getMeshByName() - an O(n) linear scan over every mesh in
            // the scene (thousands, counting village foliage instances), done
            // every frame per chasing enemy. getPlayersOnScene() is a tiny array.
            const targetPlayer = getPlayersOnScene().find(pl => pl.owner === en._targetId)?.body
            if(targetPlayer){
                // planar (Y-ignoring) distance, computed inline instead of via
                // checkDistance() - that helper clones both of its arguments
                // internally, so combined with the Vector3s built just to call
                // it, this avoided ~4 short-lived Vector3 allocations/frame/enemy
                const dx = en.body.position.x - targetPlayer.position.x
                const dz = en.body.position.z - targetPlayer.position.z
                const dist = Math.sqrt(dx * dx + dz * dz)

                // enemies only ever translate horizontally (no physics/gravity) - on
                // openworld's uneven terrain this needs to run regardless of attack
                // range, since nothing else corrects height once the enemy stops
                // advancing. Placing this AFTER the maxDistance return below meant
                // it never ran once close enough to attack - the enemy would freeze
                // at its last pre-attack height and visibly float/sink while attacking.
                if(en.det.currentPlaceId === OPENWORLD_PLACE_ID){
                    en.body.position.y = sampleTerrainSurfaceHeight(en.body.position.x, en.body.position.z, OPENWORLD_TERRAIN_VERTS) + en.det.bodyHeight / 2 + 0.05
                }

                // see emitEnemyChasePosition's own header comment
                // (sockets/emits.js) - keeps tcpEnemies' x/z reasonably
                // fresh while this enemy is actively chasing anyone (a
                // real player or a bot), not just at the next attack/
                // wander report. Throttled per-enemy, not every frame.
                const now = performance.now()
                if(!en._lastChasePosReportAt || now - en._lastChasePosReportAt > CHASE_POS_REPORT_INTERVAL_MS){
                    en._lastChasePosReportAt = now
                    emitEnemyChasePosition(en._id, en.body.position.x, en.body.position.z)
                }

                if(dist < en.det.maxDistance) return

                // around walls/props instead of through them - see chaseHeading
                const heading = chaseHeading(en, targetPlayer.position, dist)
                if(heading){
                    _lookTarget.set(en.body.position.x + heading.x, en.body.position.y, en.body.position.z + heading.z)
                    en.body.lookAt(_lookTarget)
                    _moveVec.set(0, 0, en.spd * dt)
                    en.body.locallyTranslate(_moveVec)
                } else {
                    // boxed in - hold still, still facing the target
                    _lookTarget.set(targetPlayer.position.x, en.body.position.y, targetPlayer.position.z)
                    en.body.lookAt(_lookTarget)
                }
            }
            
            // I asign the running animation here so if ever a multiplayer connected they wont see the character running while on idle
            findAnimVariants(en.anims, "running").forEach(anim => {
                if (!anim.isPlaying) {
                    anim.speedRatio = .9 + en.spd * .05
                    anim.play()
                }
            })
            if(en.runSound){
                if(!en.runSound.isPlaying) en.runSound.play()
            }
        } else {
            // en.anims.forEach(anim => {
            //     if(anim.name.includes('hit') && anim.isPlaying) return
            // })
        }
    })
    getNpcOnScene().forEach(player => {
        if(charState.currentPlace.placeId !== player.currentPlaceId) return
        if(!player.body) return

        updateNpcPatrol(player, dt)

        const isActionPlaying = player.anims.some(anim =>
            (anim.name.includes("act_") || anim.name.includes("hit") || anim.name.includes("walk") || anim.name.includes("running")) && anim.isPlaying
        )
        if (!isActionPlaying) {
            if(player._attacking) return
            
            if(player._moving){
                // return
                switch(player.mode){
                    case "idle":
                        playAnim(player.anims, "walk")
                    break
                    case "fighting":
                        playAnim(player.anims, "running")
                    break
                }
                return
            }
            // switch(player.mode){
            //     case "idle":
            //         playAnim(player.anims, "idle")
            //     break
            //     case "fighting":
            //         playAnim(player.anims, "combatIdle")
            //     break
            // }
            // const loopAnim = player.anims.find(anim => anim.name.toLowerCase() === player.mode.toLowerCase())
            // if (loopAnim && !loopAnim.isPlaying) {
            //     console.log(player.mode)
            //     playAnim(player.anims, player.mode)
            //     switch(player.mode){
            //         case "idle":
            //             playAnim(player.anims, "idle")
            //         break
            //         case "fighting":
            //             playAnim(player.anims, "combatIdle")
            //         break
            //     }
            // }
        }
    })
    if(!getIsSocketOn()) return;
    // enemiez.forEach(en => {
    //     if (en._isMoving && en._targetId) {
    //         en.body.locallyTranslate(new Vector3(0, 0, en.spd * dt))
    //         // I asign the running animation here so if ever a multiplayer connected they wont see the character running while on idle 
    //         en.anims.forEach(anim => {
    //             if (anim.name === "running" && !anim.isPlaying) {
    //                 anim.speedRatio = .9 + en.spd * .05
    //                 anim.play()
    //             }
    //         })
    //     } else {
    //         // en.anims.forEach(anim => {
    //         //     if(anim.name.includes('hit') && anim.isPlaying) return
    //         // })
    //     }
    // })
    // if (npcz.length) {
    //     npcz.forEach(pl => {
    //         if (pl._isMoving) {
    //             pl.body.locallyTranslate(new Vector3(0, 0, pl.spd * dt))
    //             playAnim(pl.anims, "running")
    //         }
    //     })
    // }
}