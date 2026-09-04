import { Vector3 } from "@babylonjs/core"
import { getSocketContainers } from "../sockets/worldsocket.js"
import { createFireParticles } from "../tools/particlesystem.js"
import { randomNum } from "../tools/tools.js"

// A placed bonfire - clones containers.js's shared bonfireRoot template (a
// merged, hidden, static mesh - see loadPropRootSafe's own comment in
// containers.js for why mergeAndLoadModel, not loadAvatarContainer, is
// used to load it) and lights it with the same flickering firelight +
// ember particles every other fire effect in this game already uses
// (tools/particlesystem.js's createFireParticles), instead of hand-rolling
// a new light/particle rig just for this.
//
// craftId, when passed, is the SAME id worldsocket.js's "bonfire-crafted"
// sync uses (tcp/index.ts's own Tbonfire.craftId) - it becomes this mesh's
// own name (bonfire_${craftId}), so reCreateMeshesInScene's getMeshByName
// dedup check can find THIS exact bonfire again and never spawn a second
// one for the same craft, whether that's the crafter's own client (already
// has it) or another player's (doesn't yet). Left undefined falls back to
// a fresh randomNum() - fine for one-off local/scripted placements that
// have no server-tracked craftId to stay in sync with at all.
export function createBonfireMesh(scene, position, craftId){
    const bonfireRoot = getSocketContainers()?.bonfireRoot
    if(!bonfireRoot){
        // missing/failed-to-load bonfire.glb already warned about once in
        // containers.js - no need to spam the console again per spawn,
        // just bail quietly like createtreasure.js's own treasureRoot check
        return null
    }

    const bonfire = bonfireRoot.clone(`bonfire_${craftId ?? randomNum()}`)
    bonfire.isVisible = true
    bonfire.setEnabled(true)
    bonfire.isPickable = false
    bonfire.position = new Vector3(position.x, position.y, position.z)

    // stashed on the mesh itself (same convention magiccircles.js's own
    // disc._sparkles/_glowLayer already follows) so a future despawn path
    // can find and stop these instead of leaving them running orphaned
    // forever once the mesh itself is gone
    const { particles, light } = createFireParticles(bonfire.position, scene)
    bonfire._fireParticles = particles
    bonfire._fireLight = light

    return bonfire
}
