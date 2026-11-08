
import { Engine, WebGPUEngine, Scene, Effect } from "@babylonjs/core"
import loadScene from "./loadScene.js"
import "@babylonjs/loaders"
// self-starting side effect only (its own module-level setInterval) - see
// that file's own header comment for what it does and why
import "../sockets/botSensor.js"
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
import { initOnceOutputSliders } from "../charactersystem/outputSliders.js";
import { initOnceTravelRecord } from "../charactersystem/travelRecord.js";
import { updateGuildIconVisibility } from "../htmlcomp/guildboard.js";
import { refreshWeatherVisuals, onSceneDisposedForWeather } from "../components/weatherSystem.js";
const canvas = document.querySelector("canvas")
const fpsCounter = document.querySelector(".fps-counter")

// Missing/placeholder monster sound files (see createEnemy.js's monsterSounds)
// fail deep inside Babylon's async audio loader (sound.pure.js's internal
// _initAsync(...).then(...) has no .catch), so the rejection can't be caught
// at the call site - it only ever surfaces here. Only swallow this specific
// case (a bad/missing audio asset) so other unrelated bugs still show up as
// uncaught like normal.
window.addEventListener("unhandledrejection", (event) => {
    if (event.reason instanceof DOMException && event.reason.name === "EncodingError") {
        console.warn("[audio] failed to decode a sound file (missing or invalid asset) - ignoring:", event.reason.message)
        event.preventDefault()
    }
})

// the home page's opening (index.html's .home-page.intro) is what covers the
// load - a loading screen shown here at startup would hide it

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

    // before the dispose below, not after - effects/weather.js holds a
    // module-level handle to its field mesh and its onBeforeRenderObservable.
    // Disposing the scene out from under it would leave that handle pointing
    // at dead objects, and the next place's applyWeather would compare against
    // a scene that no longer exists instead of building a fresh field.
    onSceneDisposedForWeather()

    scene?.meshes?.forEach(mesh => mesh.dispose())
    scene?.dispose()
    releaseOneOffShaders()

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
    // after `scene` is assigned above - refreshWeatherVisuals reads the live
    // scene through getSceneDet(). Re-evaluated on every place change rather
    // than only when the weather itself changes, because whether a storm is
    // DRAWN depends on the areaType this player just walked into: the same
    // unchanged blizzard shows in the openworld and must not show in a room.
    refreshWeatherVisuals()
    updateGuildIconVisibility()
    openCloseLScreen(false)
    return true
}
export async function startScene(willCreateCharacter){
    // whole <html>, not just the canvas - fullscreening only the canvas would
    // hide every sibling HTML overlay (HUD, chat, dialogue, touch buttons)
    // since fullscreen only renders the requested element's own subtree
    // uncomment this if you have fully implemented mobile or game is 60% completion
    // document.documentElement.requestFullscreen?.().catch(() => {})

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
        initOnceOutputSliders()
        initOnceTravelRecord()
        // initOnceEnhanceSystem()
        // initOnceEmojiActions()
        // playSocketScene(_scene)
    }else{
        const sceneDetail = await setupCharacterScene(engine)
        scene = sceneDetail.scene
    }
    // the counter's text twice a second, not every frame - a DOM write per
    // frame is a style/layout invalidation per frame
    let fpsShownAt = 0
    engine.runRenderLoop(() => {
        if(gameStatus !== "running") return
        scene.render()
        const now = performance.now()
        if(now - fpsShownAt >= 500){
            fpsShownAt = now
            fpsCounter.textContent = `${engine.getFps().toFixed(0)} FPS`
        }
    })
    window.addEventListener("resize", ()  => engine.resize())
    engine.resize()
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

    // Compiled shaders stay compiled for the whole session. Babylon counts how
    // many materials/meshes/particle systems use each shader and deletes it
    // the moment the last one is disposed - so every enemy cast (its effect
    // meshes made, then all disposed a second later) threw its shaders away,
    // and the next cast compiled and linked them again: a ~50 ms frame on
    // every fireball/bolt/slash (measured, ANGLE on D3D11; WebGL on iOS also
    // goes through ANGLE, onto Metal). It also undid every prewarm (zap.js's
    // prewarmZap and the rest compile on a dummy mesh they then dispose).
    // The set of shader variants the game uses is small and fixed, so keeping
    // them all costs little - except CustomMaterial's, see releaseOneOffShaders.
    Effect.PersistentMode = true

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
        // useLargeWorldRendering: true,
    });

    return engine
}

// CustomMaterial (tools/groundmat.js, tools/dungeonFloorMat.js) builds a
// shader of its own for every material - "custom_<n>", never shared or used
// again once its scene is gone. With Effect.PersistentMode those would pile
// up one place change after another, so they're let go with the scene.
function releaseOneOffShaders(){
    const compiled = engine?._compiledEffects
    if(!compiled) return
    Object.keys(compiled).forEach(key => {
        if(key.startsWith("custom_")) compiled[key]?.dispose(true)
    })
}