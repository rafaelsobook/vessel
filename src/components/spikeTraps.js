import { getCharState } from "../charactersystem/characterstate.js"
import { getEnemiesOnScene, getPlayersOnScene } from "../sockets/worldsocket.js"
import { emitEnemyIsHit } from "../sockets/emits.js"

// Spike barricades (createstructure.js's "spikes") hurt any enemy that gets
// close enough to touch the stakes - once every `everyMs` per enemy, while it
// stays there. Wandering enemies walk straight into them; chasing ones steer
// around them (renderer.js's rays) and get cut brushing past.
//
// Every client watching sees the same enemies, but a hit must be dealt
// exactly once: only the client whose own character is the nearest player to
// that enemy sends it - the same "closest player decides" rule
// createEnemy.js's own skill casts use. That player is also who it counts as
// hitting it (kill credit included). Physical damage, so a ghost
// (physicalImmune) floats through untouched - skipped outright here rather
// than popping "miss" over it every second.

const CHECK_EVERY_N_FRAMES = 10

// one per scene - changeScene() disposes the old one along with its spikes
let state = null

function getState(scene){
    if(state?.scene === scene) return state
    const s = { scene, spikes: new Set(), lastHit: new Map(), frame: 0 }
    state = s
    scene.onBeforeRenderObservable.add(() => {
        if(++s.frame % CHECK_EVERY_N_FRAMES) return
        tick(s)
    })
    return s
}

/**
 * Arms one placed barricade. cfg: { damage, everyMs, reach } - reach is how
 * far past the stakes' own footprint an enemy still gets caught.
 */
export function armSpikes(scene, mesh, cfg){
    const s = getState(scene)
    // the footprint in the barricade's own (unrotated) space - its template
    // already has its scale baked in (createstructure.js)
    const bb = (mesh.sourceMesh ?? mesh).getBoundingInfo().boundingBox
    const trap = {
        mesh,
        cfg,
        centreX: (bb.maximum.x + bb.minimum.x) / 2,
        centreZ: (bb.maximum.z + bb.minimum.z) / 2,
        halfX: (bb.maximum.x - bb.minimum.x) / 2 + cfg.reach,
        halfZ: (bb.maximum.z - bb.minimum.z) / 2 + cfg.reach,
    }
    s.spikes.add(trap)
    mesh.onDisposeObservable.add(() => s.spikes.delete(trap))
}

// is the world point (x, z) on this barricade, reach included?
function touches(trap, x, z){
    const { mesh } = trap
    const dx = x - mesh.position.x
    const dz = z - mesh.position.z
    // into the barricade's own space - Babylon's y rotation maps local (lx, lz)
    // to world (lx cos + lz sin, -lx sin + lz cos), so this is its inverse
    const c = Math.cos(mesh.rotation.y), sn = Math.sin(mesh.rotation.y)
    const lx = dx * c - dz * sn
    const lz = dx * sn + dz * c
    return Math.abs(lx - trap.centreX) <= trap.halfX && Math.abs(lz - trap.centreZ) <= trap.halfZ
}

// the real player nearest to (x, z) - bots have no client to send anything
function nearestPlayerOwner(x, z){
    let best = null, bestDistSq = Infinity
    getPlayersOnScene().forEach(pl => {
        if(!pl?.body || pl.owner?.startsWith("bot_")) return
        const dx = pl.body.position.x - x
        const dz = pl.body.position.z - z
        const d = dx * dx + dz * dz
        if(d < bestDistSq){ bestDistSq = d; best = pl.owner }
    })
    return best
}

function tick(s){
    if(!s.spikes.size) return
    const charState = getCharState()
    if(!charState) return
    const now = Date.now()

    getEnemiesOnScene().forEach(enemy => {
        if(!enemy?.body || enemy.det?.physicalImmune || (enemy.det?.hp ?? 1) <= 0) return
        const { x, z } = enemy.body.position
        for(const trap of s.spikes){
            if(!touches(trap, x, z)) continue
            const last = s.lastHit.get(enemy._id) ?? 0
            if(now - last < trap.cfg.everyMs) return
            s.lastHit.set(enemy._id, now)
            if(nearestPlayerOwner(x, z) !== charState.owner) return
            emitEnemyIsHit({
                playerId: charState.owner,
                dmgDetails: { physicalDmg: trap.cfg.damage, weaponDmg: 0, isPhysicalDmg: true },
                targetId: enemy._id,
                currentPlaceId: charState.currentPlace.placeId,
            })
            return
        }
    })
}
