import { getCharState } from "../charactersystem/characterstate";
import { setGameStatus } from "../main/main";
import { getSocket } from "./joinsocket";
import { getPlayersOnScene, removePlayer, resetArray } from "./worldsocket";

export function exitScene(willEmitDispose = true){
    const socket = getSocket()
    if(!socket) return console.warn("exit scene with no socket")
        
    setGameStatus("loading")

    const charState = getCharState();

    resetArray()
    if(!willEmitDispose) return
    socket.emit("dispose", 
        {
            owner: charState.owner,
            // currentPlaceId: charState.currentPlace.placeId
        }
    )
}