import { Vector3 } from '@babylonjs/core'
import { playAnim, stopAllAnim } from '../tools/animation.js'

const ARRIVE_DIST = 0.3
const PAUSE_SECONDS = 6.5

// reused every frame per npc instead of `new Vector3(...)` inline - this runs
// for every patrolling npc every frame, see the same fix in renderer.js
const _lookTarget = new Vector3()
const _moveVec = new Vector3()

// plain NPCs have no CharacterAnimations wrapper (see createcharacter.js's isNpc
// branch), so playAnim() alone never stops whatever was previously playing -
// walk and idle would end up looping simultaneously and fighting over the same
// bones. Stop everything first so only one state is ever active.
function setNpcAnim(npc, name){
    stopAllAnim(npc.anims)
    playAnim(npc.anims, name, true)
}

// Moves an NPC in a straight-line loop between det.patrolPoints, mirroring the
// lookAt + locallyTranslate idiom used for enemy-chase movement in renderer.js
// (npcs spawn with usePhysics=false, so there's no physics body to push around,
// position has to be mutated directly). Pauses briefly at each waypoint and
// swaps the walk/idle animation on state transitions only, not every frame,
// so the loop-animation doesn't keep getting restarted from frame 0.
export function updateNpcPatrol(npc, dt){
    const points = npc.det?.patrolPoints
    if(!points || points.length < 2 || !npc.body || !npc.anims) return

    if(npc._patrolIndex === undefined){
        npc._patrolIndex = 0
        npc._patrolPause = 0
        npc._patrolMoving = false
    }

    // set by createAllNpcInArea.js while the player is talking to this npc -
    // hold still and face them instead of wandering off mid-conversation
    if(npc._patrolFrozen){
        if(npc._patrolMoving){
            npc._patrolMoving = false
            setNpcAnim(npc, "idle")
        }
        return
    }

    if(npc._patrolPause > 0){
        npc._patrolPause -= dt
        return
    }

    const target = points[npc._patrolIndex]
    const pos = npc.body.position
    const dx = target.x - pos.x
    const dz = target.z - pos.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    if(dist < ARRIVE_DIST){
        npc._patrolIndex = (npc._patrolIndex + 1) % points.length
        npc._patrolPause = PAUSE_SECONDS
        if(npc._patrolMoving){
            npc._patrolMoving = false
            setNpcAnim(npc, "idle")
        }
        return
    }

    if(!npc._patrolMoving){
        npc._patrolMoving = true
        setNpcAnim(npc, "walk")
    }

    const speed = npc.det.patrolSpeed ?? 1.2
    _lookTarget.set(target.x, pos.y, target.z)
    npc.body.lookAt(_lookTarget)
    _moveVec.set(0, 0, Math.min(speed * dt, dist))
    npc.body.locallyTranslate(_moveVec)
}
