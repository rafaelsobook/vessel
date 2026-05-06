import { dungeonScene } from "../scenes/dungeonscene.js";
import { areaScene } from "../scenes/areascene.js";
import { setGameStatus } from "./main.js";
export default async function loadScene(placeDetail, accountDetail){
    setGameStatus("loading")
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
        default:
            scene = await dungeonScene(placeDetail)
        break
    }
    if(scene) {
        setGameStatus("running")
        return scene
    }
}