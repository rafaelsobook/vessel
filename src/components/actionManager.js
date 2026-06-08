import { ActionManager, ExecuteCodeAction } from "@babylonjs/core";

export function onIntersecEnterTrig(mesh, otherMesh, scene, callb){
    if(!mesh.actionManager){
        mesh.actionManager = new ActionManager(scene)
    }
    return mesh.actionManager.registerAction(
        new ExecuteCodeAction(
            {
                trigger: ActionManager.OnIntersectionEnterTrigger,
                parameter: otherMesh
            },
            () => { if(callb) callb() }
        )
    );
}
export function onIntersecExitTrig(mesh, otherMesh, scene, callb){
    if(!mesh.actionManager){
        mesh.actionManager = new ActionManager(scene)
    }
    mesh.actionManager.registerAction(
        new ExecuteCodeAction(
            {
                trigger: ActionManager.OnIntersectionExitTrigger,
                parameter: otherMesh
            },
            () => { if(callb) callb() }
        )
    );
    
}
export function removeIntersecTrig(mesh, action){
    if(mesh.actionManager && action){
        mesh.actionManager.unregisterAction(action)
    }
}