import { PhysicsMotionType } from "@babylonjs/core"
import { getSceneDet } from "../main/main.js"
import { getGameStatus } from "../main/main.js"
import { getCharState } from "../charactersystem/characterstate.js"
import { getPlayersOnScene, getIsSocketOn } from "./worldsocket.js"
import { emitBotObstacleReport } from "./emits.js"

// BOT OBSTACLE SENSOR - tcp/index.ts has zero knowledge of static scene
// geometry (trees, buildings, decorations) - that's all client-authored/
// procedural data (localroomdb.js's optionalObjects, createvillage.js's
// trees, createcastle.js's walls) with no server-side equivalent at all.
// A bot's own Brain (tcp/recources/npcBrain.ts) needs SOME idea of what's
// solid nearby to route around, so this borrows whichever real player's
// client happens to be reading this - periodically scanning ITS OWN
// already-loaded scene for physics obstacles near the local player and
// reporting them back. Every currently-connected real player runs this
// independently (not just one hardcoded name) - tcp/index.ts just keeps
// the MOST RECENT report per place, so bot pathing quality in a given
// place depends on at least one real player having been there recently
// enough to have reported it, not any one specific person being online.
//
// "obstacle" here means: has a physics body, that body is STATIC (mass:0,
// never moves - excludes the local player's own DYNAMIC capsule and
// anything else that isn't scenery), and its name doesn't match a small
// deny-list of known walkable-ground/floor mesh names (a flat ground plane
// also has a static physics body, but a bot should walk ON it, not around
// it). Not a perfect classifier - a big merged structure (a whole castle
// wall run, or courtyard floor) can still slip through if its name doesn't
// happen to contain one of these substrings - good enough for a first pass
// obstacle-avoidance signal, not a claim of pixel-perfect scene understanding.
const GROUND_NAME_KEYWORDS = ["ground", "floor", "chunk", "terrain", "infterrain"]

const SENSOR_INTERVAL_MS = 4000
// how far from the local player to look for obstacles - matches the rough
// scale of npcBrain.ts's own WANDER_RADIUS (40), no point reporting
// something a bot would never wander near anyway
const SENSOR_RADIUS = 60
const SENSOR_RADIUS_SQ = SENSOR_RADIUS * SENSOR_RADIUS
// cap on how many obstacles get reported per tick - keeps the payload
// small and bounded regardless of how dense a scene's foliage/decoration
// count gets, closest-first (the ones actually relevant to a bot wandering
// near THIS player right now)
const MAX_OBSTACLES_REPORTED = 40

function isObstacleMesh(mesh){
    if(!mesh.physicsBody) return false
    if(mesh.physicsBody.getMotionType?.() !== PhysicsMotionType.STATIC) return false
    const name = (mesh.name || "").toLowerCase()
    if(GROUND_NAME_KEYWORDS.some(kw => name.includes(kw))) return false
    return true
}

function scanAndReport(){
    if(getGameStatus() !== "running") return
    if(!getIsSocketOn()) return

    const charState = getCharState()
    if(!charState) return
    const scene = getSceneDet()?.scene
    if(!scene) return

    const myPlayer = getPlayersOnScene().find(pl => pl.owner === charState.owner)
    if(!myPlayer?.body) return
    const myPos = myPlayer.body.position

    const candidates = []
    for(const mesh of scene.meshes){
        if(!isObstacleMesh(mesh)) continue

        const dx = mesh.position.x - myPos.x
        const dz = mesh.position.z - myPos.z
        const distSq = dx * dx + dz * dz
        if(distSq > SENSOR_RADIUS_SQ) continue

        const radius = mesh.getBoundingInfo?.().boundingSphere?.radiusWorld ?? 1
        candidates.push({ x: mesh.position.x, z: mesh.position.z, radius, distSq })
    }

    candidates.sort((a, b) => a.distSq - b.distSq)
    const obstacles = candidates.slice(0, MAX_OBSTACLES_REPORTED).map(({ x, z, radius }) => ({ x, z, radius }))

    emitBotObstacleReport(obstacles, charState.currentPlace.placeId)
}

// self-starting, module-level - same "one interval for the whole client
// lifetime, gated by internal checks rather than started/stopped per scene"
// pattern worldsocket.js's own OPENWORLD_ENEMY_RECHECK_INTERVAL_MS already
// uses, so no new wiring is needed anywhere a scene gets set up/torn down
setInterval(scanAndReport, SENSOR_INTERVAL_MS)
