import { ActionManager, ExecuteCodeAction } from "@babylonjs/core";

export function onIntersecEnterTrig(mesh, otherMesh, scene, callb){
    if(!mesh.actionManager){
        mesh.actionManager = new ActionManager(scene)
    }
    

    // OnIntersectionEnterTrigger
    mesh.actionManager.registerAction(
        new ExecuteCodeAction(
            {
                trigger: ActionManager.OnIntersectionEnterTrigger,
                parameter: otherMesh  // the mesh to check against
            },
            () => {
                if(callb) callb()
            }
        )
    );
}