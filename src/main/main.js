
import { Engine, WebGPUEngine, Scene } from "@babylonjs/core"
import loadScene from "./loadScene.js"
import "@babylonjs/loaders"
import { getSocketPlacesMD, initSocket, joinWorld } from "../sockets/joinsocket.js";
import { metaDatas } from "../constants/localroomdb.js";
import { setCharState } from "../charactersystem/characterstate.js"
import { activateBtnOnce, hideShowAllScreenUI } from "../charactersystem/uimanagement.js";
import { findMyCurrentPlace } from "../states/placestates.js";
import { disposePhysics } from "../tools/physics.js";
import { makeSureArraysAreClean } from "../components/cleanup.js";
import { checkIfTokenSaved } from "../tools/tools.js";
import { setupCharacterScene } from "../scenes/setupcharacterscene.js";
import { closeCharacterPage } from "../pages/createcharacterpage.js";
import { activateInteractBtn, openCloseLScreen } from "../tools/popupUI.js";
import { initOnceStatsSystem } from "../charactersystem/statsSystem.js";
import { initOnceStorySystem } from "../charactersystem/storyQuestSystem.js";
import { setSocketOn } from "../sockets/worldsocket.js";
import { initOnceWorldChatSystem } from "../components/worldChatSystem.js";
import { updateGuildIconVisibility } from "../htmlcomp/guildboard.js";
import { showLoadingScreen } from "../htmlcomp/loadingscreen.js";
const canvas = document.querySelector("canvas")
const fpsCounter = document.querySelector(".fps-counter")


showLoadingScreen([], 2000);

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
export async function changeScene(_sceneName){
    openCloseLScreen(true)
    setGameStatus("loading")
    setSocketOn(false)

    scene?.meshes?.forEach(mesh => mesh.dispose())
    scene?.dispose()
    
    const sceneDetail = await loadScene()

    if(!sceneDetail) {
        openCloseLScreen(false)
        return false
    }
    scene = sceneDetail.scene
    sceneName = _sceneName;
    // // In the village or any path I will intersect the exit() will emit making sure every info of us is deleted
    // makeSureArraysAreClean(async () => {
    
    // })
    setSocketOn(sceneDetail.isSocketOn)
    setGameStatus("running")
    updateGuildIconVisibility()
    openCloseLScreen(false)
    return true
}
export async function startScene(willCreateCharacter){
    // whole <html>, not just the canvas - fullscreening only the canvas would
    // hide every sibling HTML overlay (HUD, chat, dialogue, touch buttons)
    // since fullscreen only renders the requested element's own subtree
    document.documentElement.requestFullscreen?.().catch(() => {})

    hideShowAllScreenUI()
    await initEngine()
    if(!willCreateCharacter){
        closeCharacterPage()
        initSocket()

        const succeed = await changeScene()

        if(!succeed) {
            console.warn("creating scene failed")
            return false
        }
        // changeScene(scene, "new scene")
        // beginWorldRenderInWorldSocket(scene)
        activateBtnOnce()
        activateInteractBtn()
        initOnceWorldChatSystem()
        initOnceStatsSystem()
        initOnceStorySystem()
        // initOnceEnhanceSystem()
        // initOnceEmojiActions()
        // playSocketScene(_scene)
    }else{
        const sceneDetail = await setupCharacterScene(engine)
        scene = sceneDetail.scene
    }
    engine.runRenderLoop(() => {
        if(gameStatus !== "running") return
        scene.render()
        fpsCounter.textContent = `${engine.getFps().toFixed(0)} FPS`
    })
    window.addEventListener("resize", ()  => engine.resize())
    return true
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
        audioEngine: true,
        adaptToDeviceRatio: false,   
        disableWebGL2Support: false,
        useHighPrecisionFloats: false,  
        powerPreference: "high-performance",
        failIfMajorPerformanceCaveat: false,
        preserveDrawingBuffer: false,
    });

    return engine
}