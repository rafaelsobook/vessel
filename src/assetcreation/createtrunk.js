import { Vector3 } from "@babylonjs/core"
import { getSocketContainers } from "../sockets/worldsocket.js"
import { randomNum } from "../tools/tools.js"
import { addSeat } from "../charactersystem/seating.js"

// local-space offset from the trunk model's own pivot to a sensible spot to
// sit along its length - measured off trunk.glb's real bounding box
// (min -0.951,-0.022,-0.218 / max 0.768,0.307,0.252, so a 1.72-unit-long
// log): the pivot sits off-center toward the model's own +X end, so this
// re-centers along the log's ACTUAL length instead of sitting near that
// off-center pivot. No Y offset here - seat.y is FLOOR height, same
// convention every other seat (createroom.js's chairs) already uses; the
// "sitting" animation clip itself lifts the hips to log height from there,
// this never needs the log's own top-surface height at all.
const SEAT_LOCAL_X = -0.1

// A placed tree log - clones containers.js's shared trunkRoot template, same
// static-prop cloning shape createBonfireMesh (createbonfire.js) uses for
// the bonfire craft, just with no light/particles attached since a log has
// nothing to animate.
//
// craftId, when passed, is the SAME id worldsocket.js's "trunk-crafted" sync
// uses (tcp/index.ts's own Ttrunk.craftId) - it becomes this mesh's own name
// (trunk_${craftId}), so reCreateMeshesInScene's getMeshByName dedup check
// can find THIS exact log again and never spawn a second one for the same
// craft, whether that's the crafter's own client (already has it) or
// another player's (doesn't yet). Left undefined falls back to a fresh
// randomNum() - fine for one-off local/scripted placements that have no
// server-tracked craftId to stay in sync with at all.
//
// placeId - which place this log actually belongs to (campcraft.js's own
// craft handler already has it; worldsocket.js's reCreateMeshesInScene has
// it as trunkTcpInfo.currentPlaceId). Needed to register the log as a seat
// (charactersystem/seating.js's addSeat) scoped to the right place - left
// undefined skips seat registration entirely rather than guessing.
export function createTrunkMesh(scene, position, craftId, placeId){
    const trunkRoot = getSocketContainers()?.trunkRoot
    if(!trunkRoot){
        // missing/failed-to-load trunk.glb already warned about once in
        // containers.js - no need to spam the console again per spawn,
        // just bail quietly like createBonfireMesh's own bonfireRoot check
        return null
    }

    const resolvedId = craftId ?? randomNum()
    const trunk = trunkRoot.clone(`trunk_${resolvedId}`)
    trunk.isVisible = true
    trunk.setEnabled(true)
    trunk.isPickable = false
    trunk.position = new Vector3(position.x, position.y, position.z)

    // Every placed log is sittable, same as the tavern's own benches.
    // rotation.y is never actually set on a trunk today (always the default
    // 0), but the seat offset is still rotated properly in case that
    // changes later - same local-offset-rotated-by-rotation.y convention
    // this codebase already settled on for building-door placement
    // (localroomdb.js's own Tavern optionalObjects entry comment): a local
    // point at (lx, 0) maps to world (lx*cos(rot), lx*sin(rot)).
    if(placeId !== undefined){
        const rot = trunk.rotation.y
        addSeat(scene, placeId, {
            seatId: `trunk_${resolvedId}`,
            x: trunk.position.x + SEAT_LOCAL_X * Math.cos(rot),
            y: trunk.position.y,
            z: trunk.position.z + SEAT_LOCAL_X * Math.sin(rot),
            yaw: rot,
        })
    }

    return trunk
}
