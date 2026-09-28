import { Vector3 } from "@babylonjs/core"
import { getSocketContainers } from "../sockets/worldsocket.js"
import { randomNum } from "../tools/tools.js"

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
export function createTrunkMesh(scene, position, craftId){
    const trunkRoot = getSocketContainers()?.trunkRoot
    if(!trunkRoot){
        // missing/failed-to-load trunk.glb already warned about once in
        // containers.js - no need to spam the console again per spawn,
        // just bail quietly like createBonfireMesh's own bonfireRoot check
        return null
    }

    const trunk = trunkRoot.clone(`trunk_${craftId ?? randomNum()}`)
    trunk.isVisible = true
    trunk.setEnabled(true)
    trunk.isPickable = false
    trunk.position = new Vector3(position.x, position.y, position.z)

    return trunk
}
