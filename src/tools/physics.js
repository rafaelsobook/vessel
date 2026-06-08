// File: src/tools/physics.js

import HavokPhysics from "@babylonjs/havok";
import { HavokPlugin, Vector3, PhysicsShapeType, PhysicsAggregate } from "@babylonjs/core";

let havokInstance = null;
let havokPlugin = null

export function disposePhysics(scene) {
    if(!scene) return
    try {
        // console.log(scene.getPhysicsEngine() === null) // true 
        if(scene.getPhysicsEngine() === null) {
            if(havokPlugin) {
                havokPlugin?.dispose()
                havokPlugin = null
            }
        }
        const physicsEngine = scene.getPhysicsEngine();

        if (physicsEngine) {
            havokPlugin?.dispose();
            physicsEngine.dispose();
        }

        havokPlugin = null;
        havokInstance = null;
    } catch (error) {
        console.error("❌ Failed to dispose physics:", error);
    }
}
export async function initializePhysics(scene) {
    disposePhysics(scene)
    if (havokInstance) {
        return havokInstance;
    }

    try {
        // Load Havok WASM from CDN
        havokInstance = await HavokPhysics();
        
        // Create Havok plugin
        havokPlugin = new HavokPlugin(true, havokInstance);
        
        // Enable physics in the scene (no gravity for now)
        scene.enablePhysics(new Vector3(0, -9.81, 0), havokPlugin);

        return havokInstance;
    } catch (error) {
        console.error("❌ Failed to initialize physics:", error);
        throw error;
    }
}
export function createAggregate(mesh, options = { mass: 0 }, shapeType, scene){
    
    let shape
    switch(shapeType){
        case "mesh":
            shape = PhysicsShapeType.MESH
        break;
        case "capsule":
            shape = PhysicsShapeType.CAPSULE
        break;
        default:
            shape = PhysicsShapeType.BOX
        break
    }
    let agg = new PhysicsAggregate(mesh, shape, options, scene);
    agg.shape.material = { restitution: 0, friction: 1 };
    return agg
}
/**
 * Set gravity for the scene
 * @param {Scene} scene - Babylon.js scene
 * @param {Vector3} gravity - Gravity vector (e.g., new Vector3(0, -9.81, 0))
 */


/**
 * Check if physics is initialized
 */
export function isPhysicsReady() {
    return havokInstance !== null;
}

/**
 * Get the physics instance
 */
export function getPhysicsInstance() {
    return havokInstance;
}

// This thing works too if the import Havok does not work
// File: src/tools/physics.js
// Using jsdelivr CDN with proper UMD handling

// import { HavokPlugin, Vector3 } from "@babylonjs/core";

// let havokInstance = null;

// /**
//  * Initialize Havok physics engine using CDN
//  * Call this once before creating any physics objects
//  */
// export async function initializePhysics(scene) {
//     if (havokInstance) {
//         console.log("Physics already initialized");
//         return havokInstance;
//     }

//     try {
//         // Load HavokPhysics from CDN as a script tag (works better with UMD)
//         const scriptUrl = "https://cdn.babylonjs.com/havok/HavokPhysics_umd.js";
        
//         // Check if already loaded
//         if (!window.HavokPhysics) {
//             await new Promise((resolve, reject) => {
//                 const script = document.createElement('script');
//                 script.src = scriptUrl;
//                 script.async = true;
//                 script.onload = resolve;
//                 script.onerror = reject;
//                 document.head.appendChild(script);
//             });
//         }
        
//         // Initialize Havok
//         havokInstance = await window.HavokPhysics();
        
//         // Create Havok plugin
//         const havokPlugin = new HavokPlugin(true, havokInstance);
        
//         // Enable physics in the scene with gravity
//         scene.enablePhysics(new Vector3(0, -9.81, 0), havokPlugin);
        
//         console.log("✅ Physics engine initialized from CDN");
//         return havokInstance;
//     } catch (error) {
//         console.error("❌ Failed to initialize physics:", error);
//         throw error;
//     }
// }

// /**
//  * Set gravity for the scene
//  * @param {Scene} scene - Babylon.js scene
//  * @param {Vector3} gravity - Gravity vector (e.g., new Vector3(0, -9.81, 0))
//  */
// export function setGravity(scene, gravity = new Vector3(0, -9.81, 0)) {
//     const physicsEngine = scene.getPhysicsEngine();
//     if (physicsEngine) {
//         physicsEngine.setGravity(gravity);
//         console.log("✅ Gravity set to:", gravity);
//     }
// }

// /**
//  * Check if physics is initialized
//  */
// export function isPhysicsReady() {
//     return havokInstance !== null;
// }

// /**
//  * Get the physics instance
//  */
// export function getPhysicsInstance() {
//     return havokInstance;
// }