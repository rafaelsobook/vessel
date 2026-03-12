import { dungeon } from "../constants/temporary.js";
import { Engine, WebGPUEngine, Scene } from "@babylonjs/core"
import loadScene from "./loadScene.js"

const canvas = document.querySelector("canvas")


let engine 
let scene


let sceneName
// Game states
let gameStatus = "loading" // loading,running

export function getGameStatus(){
    return gameStatus
}
export function setGameStatus(_gameStat){
    gameStatus = _gameStat
}
export function getSceneDet(){
    return {scene,sceneName}
}
export function changeScene(newScene, _sceneName){
    scene.meshes.forEach(mesh => mesh.dispose())
    scene.dispose()
    scene = newScene
    sceneName = _sceneName;
}
export async function startScene(){
    await initEngine()
    scene = await loadScene(engine, "dungeon", dungeon)

    if(!scene) return console.warn("creating scene failed")

    window.addEventListener("resize", ()  => engine.resize())
    engine.runRenderLoop(() => {
        scene.render()
    })
}

async function initEngine(){	
    console.log("Starting the engine")	
    if (await WebGPUEngine.IsSupportedAsync) {
        engine = new WebGPUEngine(canvas);
        await engine.initAsync();
        // alert("WebGPU  !!!!!!!!!!!!! is supported");
    } else {
        engine = new Engine(canvas, true, {
            stencil: false,                  
            antialias: false,     
            audioEngine: false,
            adaptToDeviceRatio: true,   
            disableWebGL2Support: false,
            useHighPrecisionFloats: !isSafari,  
            powerPreference: "high-performance",
            failIfMajorPerformanceCaveat: false,
            preserveDrawingBuffer: false,
        });
        // alert("WebGPU is NOT supported");
    }
    scene = new Scene(engine)
    scene.createDefaultCamera()
    return engine
}