import { ActionManager, ExecuteCodeAction } from "@babylonjs/core";

// precise defaults to false (Babylon's own default) - every existing
// walk-up-and-interact trigger (NPC talk range, resource/treasure/room-path
// colliders) WANTS a loose bounding-box check, that's what makes "walk
// near" work at all. Only pass precise:true for something that actually
// needs real mesh-level contact - see attackingSystem.js's own
// registerToAtkCollider for why combat hit detection needs it and these
// proximity triggers don't.
export function onIntersecEnterTrig(mesh, otherMesh, scene, callb, precise = false){
    if(!mesh.actionManager){
        mesh.actionManager = new ActionManager(scene)
    }
    return mesh.actionManager.registerAction(
        new ExecuteCodeAction(
            {
                trigger: ActionManager.OnIntersectionEnterTrigger,
                parameter: { mesh: otherMesh, usePreciseIntersection: precise }
            },
            () => { if(callb) callb() }
        )
    );
}
export function onIntersecExitTrig(mesh, otherMesh, scene, callb, precise = false){
    if(!mesh.actionManager){
        mesh.actionManager = new ActionManager(scene)
    }
    mesh.actionManager.registerAction(
        new ExecuteCodeAction(
            {
                trigger: ActionManager.OnIntersectionExitTrigger,
                parameter: { mesh: otherMesh, usePreciseIntersection: precise }
            },
            () => { if(callb) callb(otherMesh) }
        )
    );

}
export function removeIntersecTrig(mesh, action){
    if(mesh.actionManager && action){
        mesh.actionManager.unregisterAction(action)
    }
}