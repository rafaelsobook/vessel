import { dungeonScene } from "../scenes/dungeonscene.js";
import { areaScene } from "../scenes/areascene.js";
import { setGameStatus } from "./main.js";
import {getIsSocketOn } from "../sockets/worldsocket.js";
import { findMyCurrentPlace } from "../states/placestates.js";
import { initiateCharacter } from "../charactersystem/characterstate.js";
import { checkIfTokenSaved } from "../tools/tools.js";
import { getAllSounds } from "../components/soundSystem.js";
import { openCloseLScreen } from "../tools/popupUI.js";
import { applyAreaIconPolicy } from "../charactersystem/uimanagement.js";
import { showMainPage } from "../pages/mainpage.js";
import { showLoginPage } from "../pages/loginpage.js";

export default async function loadScene(){

    setGameStatus("loading")

    const charState = await initiateCharacter(checkIfTokenSaved())
   
    if(!charState) {
        sessionStorage.clear()
        showMainPage()
        showLoginPage()
        return openCloseLScreen(false)
    }

    const placeDetail = findMyCurrentPlace()

    // here rather than inside areaScene() - this is the one path every place
    // transition goes through regardless of which scene builder handles it, so
    // dungeons (dungeonScene, the one areaType that doesn't route through
    // areaScene) get the policy re-evaluated too. Putting it in areaScene would
    // mean walking room -> dungeon left the icon hidden, since nothing would
    // have run to re-show it.
    applyAreaIconPolicy(placeDetail.areaType)

    let sceneDetail;
    switch(placeDetail.areaType){
        case "dungeon":
            sceneDetail = await dungeonScene(placeDetail)
        break
        case "room":
            sceneDetail = await areaScene(placeDetail)
        break
        case "village":
            sceneDetail = await areaScene(placeDetail)
        break
        case "openworld":
            sceneDetail = await areaScene(placeDetail)
        break
        case "duel":
            sceneDetail = await areaScene(placeDetail)
        break
    }

    getAllSounds().enteredS?.play()
    if(sceneDetail) return sceneDetail
}