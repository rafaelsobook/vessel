import { dungeonScene } from "../scenes/dungeonscene.js";
import { areaScene } from "../scenes/areascene.js";
import { setGameStatus } from "./main.js";
export default async function loadScene(engine, placeDetail, accountDetail){
    setGameStatus("loading")
    let scene;

    switch(placeDetail.areaType){
        case "dungeon":
            scene = await dungeonScene(engine, placeDetail)
        break
        case "room":
            scene = await areaScene(engine, placeDetail)
        break
        case "village":
            scene = await areaScene(engine, placeDetail)
        break
        default:
            scene = await dungeonScene(engine, placeDetail)
        break
    }
    if(scene) {
        setGameStatus("running")
        return scene
    }
}