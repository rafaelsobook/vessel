import { dungeonScene } from "../scenes/dungeonscene.js";
export default async function loadScene(engine, currentStage, placeDetail, accountDetail){
    let scene;
    console.log(`We are in ${currentStage}`)
    switch(currentStage){
        case "dungeon":
            scene = await dungeonScene(engine, placeDetail)
        break
        default:
            scene = await dungeonScene(engine, placeDetail)
        break
    } 
    if(scene) return scene
}