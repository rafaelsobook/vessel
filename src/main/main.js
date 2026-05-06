
import { Engine, WebGPUEngine, Scene } from "@babylonjs/core"
import loadScene from "./loadScene.js"
import "@babylonjs/loaders"
import { getSocketPlacesMD, initSocket, joinWorld } from "../sockets/joinsocket.js";
import { metaDatas } from "../constants/localroomdb.js";
import { getCharDetFromDB, getCharDetFromDBAndUpdateCharState, setCharState } from "../charactersystem/characterstate.js"
import { findMyCurrentPlace } from "../states/placestates.js";
import { disposePhysics } from "../tools/physics.js";
import { beginWorldRenderInWorldSocket } from "../sockets/worldsocket.js";

const canvas = document.querySelector("canvas")


let engine 
let scene

let sceneName
// Game states
let gameStatus = "loading" // loading, running

export function getGameStatus(){
    return gameStatus
}
export function setGameStatus(_gameStat){
    gameStatus = _gameStat
}
export function getSceneDet(){
    return {scene,sceneName}
}
export function getEngine(){
    if(!engine) return console.log("NO ENGINE")
    return engine
}
export function changeScene(newScene, _sceneName){
    setGameStatus("loading")
    disposePhysics(scene)
    scene.meshes.forEach(mesh => mesh.dispose())
    scene.dispose()
    scene = newScene
    sceneName = _sceneName;

    setGameStatus("running")
}
export async function startScene(){
    await initEngine()
    initSocket()
    
    const charDet = getCharDetFromDBAndUpdateCharState()

    scene = await loadScene(findMyCurrentPlace())

    if(!scene) return console.warn("creating scene failed")
    // changeScene(scene, "new scene")
    // beginWorldRenderInWorldSocket(scene)
    engine.runRenderLoop(() => scene.render())
    window.addEventListener("resize", ()  => engine.resize())
}

async function initEngine(){
    // if (await WebGPUEngine.IsSupportedAsync) {
    //     engine = new WebGPUEngine(canvas);
    //     await engine.initAsync();
    //     // alert("WebGPU  !!!!!!!!!!!!! is supported");
    // } else {
    //     engine = new Engine(canvas, true, {
    //         stencil: false,                  
    //         antialias: false,     
    //         audioEngine: false,
    //         adaptToDeviceRatio: true,   
    //         disableWebGL2Support: false,
    //         useHighPrecisionFloats: !isSafari,  
    //         powerPreference: "high-performance",
    //         failIfMajorPerformanceCaveat: false,
    //         preserveDrawingBuffer: false,
    //     });
    //     // alert("WebGPU is NOT supported");
    // }

    engine = new Engine(canvas, true, {
        stencil: false,                  
        antialias: false,     
        audioEngine: false,
        adaptToDeviceRatio: true,   
        disableWebGL2Support: false,
        useHighPrecisionFloats: false,  
        powerPreference: "high-performance",
        failIfMajorPerformanceCaveat: false,
        preserveDrawingBuffer: false,
    });

    return engine
}