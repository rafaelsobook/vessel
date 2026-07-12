import { getCharState } from "../charactersystem/characterstate";
import { setGameStatus } from "../main/main";
import { getSocket } from "./joinsocket";
import { getPlayersOnScene, removePlayer, resetArray } from "./worldsocket";

export function exitScene(ownerId){
    const socket = getSocket()
    if(!socket) return console.warn("exit scene with no socket")
        
    setGameStatus("loading")

    const charState = getCharState();

    resetArray()

    // this one is okay not to put my currentPlaceId right ?
    socket.emit("dispose", 
        {
            owner: ownerId,
            // currentPlaceId: charState.currentPlace.placeId
        }
    )
}