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
export function createBonfireMesh(scene, position){
    const bonfireRoot = getSocketContainers()?.bonfireRoot
    if(!bonfireRoot){
        // missing/failed-to-load bonfire.glb already warned about once in
        // containers.js - no need to spam the console again per spawn,
        // just bail quietly like createtreasure.js's own treasureRoot check
        return null
    }

    const bonfire = bonfireRoot.clone(`bonfire_${randomNum()}`)
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
