import { dungeonScene } from "../scenes/dungeonscene.js";
import { areaScene } from "../scenes/areascene.js";
import { setGameStatus } from "./main.js";
import {getIsSocketOn } from "../sockets/worldsocket.js";
import { findMyCurrentPlace } from "../states/placestates.js";
import { initiateCharacter } from "../charactersystem/characterstate.js";
import { checkIfTokenSaved } from "../tools/tools.js";

export default async function loadScene(){

    setGameStatus("loading")

    await initiateCharacter(checkIfTokenSaved())
    const placeDetail = findMyCurrentPlace()
    let scene;

    switch(placeDetail.areaType){
        case "dungeon":
            scene = await dungeonScene(placeDetail)
        break
        case "room":
            scene = await areaScene(placeDetail)
        break
        case "village":
            scene = await areaScene(placeDetail)
        break
    }
    if(scene) return scene
}