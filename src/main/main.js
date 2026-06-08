
import { Engine, WebGPUEngine, Scene } from "@babylonjs/core"
import loadScene from "./loadScene.js"
import "@babylonjs/loaders"
import { getSocketPlacesMD, initSocket, joinWorld } from "../sockets/joinsocket.js";
import { metaDatas } from "../constants/localroomdb.js";
import { setCharState } from "../charactersystem/characterstate.js"
import { activateBtnOnce } from "../charactersystem/uimanagement.js";
import { findMyCurrentPlace } from "../states/placestates.js";
import { disposePhysics } from "../tools/physics.js";
import { makeSureArraysAreClean } from "../components/cleanup.js";
import { checkIfTokenSaved } from "../tools/tools.js";
import { setupCharacterScene } from "../scenes/setupcharacterscene.js";
import { closeCharacterPage } from "../pages/createcharacterpage.js";
import { activateInteractBtn } from "../tools/popupUI.js";
import { initOnceStatsSystem } from "../charactersystem/statsSystem.js";
import { initOnceStorySystem } from "../charactersystem/storyQuestSystem.js";
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
    if(!engine) return null
    return engine
}
// 
export function changeScene(_sceneName){
    setGameStatus("loading")

    scene.meshes.forEach(mesh => mesh.dispose())
    scene.dispose()
    // In the village or any path I will intersect the exit() will emit making sure every info of us is deleted
    makeSureArraysAreClean(async () => {
        const newScene = await loadScene()
        scene = newScene
        sceneName = _sceneName;
    })

}
export async function startScene(willCreateCharacter){

    await initEngine()
    if(!willCreateCharacter){
        closeCharacterPage()
        initSocket()

        scene = await loadScene()

        if(!scene) return console.warn("creating scene failed")
        // changeScene(scene, "new scene")
        // beginWorldRenderInWorldSocket(scene)
        activateBtnOnce()
        activateInteractBtn()
        // initOnceWorlChatSystem()
        initOnceStatsSystem()
        initOnceStorySystem()
        // initOnceEnhanceSystem()
        // initOnceEmojiActions()
        // playSocketScene(_scene)
    }else{
        scene = await setupCharacterScene(engine)
    }

    engine.runRenderLoop(() => gameStatus === "running" && scene.render())
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
        adaptToDeviceRatio: false,   
        disableWebGL2Support: false,
        useHighPrecisionFloats: false,  
        powerPreference: "high-performance",
        failIfMajorPerformanceCaveat: false,
        preserveDrawingBuffer: false,
    });

    return engine
}