import { getCharState } from "../charactersystem/characterstate";
import { setGameStatus } from "../main/main";
import { getSocket } from "./joinsocket";

export function exitScene(){
    const socket = getSocket()
    if(!socket) return console.warn("exit scene with no socket")
        
    setGameStatus("loading")

    const charState = getCharState();

    socket.emit("dispose", 
        {
            owner: charState.owner,
            currentPlaceId: charState.currentPlace.placeId
        }
    )
}