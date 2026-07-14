import { io } from "socket.io-client";
import { getCharSocket } from "../charactersystem/characterstate.js";
import { activateOnSocketListeners, getIsSocketOn, setSocketOn } from "./worldsocket.js";
import { webSocketURL } from "../constants/constants.js";

let socket = null;
let socketId = null
let socketPlacesMD = null

export function getSocket() {
    if (!socket) return null;
    return socket;
}
export function getSocketId() {
    if (!socketId) return null;
    return socketId;
}

export function getSocketPlacesMD() {
    if (!socketPlacesMD) return null;
    return socketPlacesMD;
}


export function initSocket() {
    socket = io(webSocketURL, {
        transports: ["websocket"],
    });

    activateOnSocketListeners(socket)
}
export const joinWorld = (roomId) => {
    const playerSocket = getCharSocket();
    if (!playerSocket) {
        console.error("Socket not initialized. Call initSocket() first.");
        return;
    }
    setSocketOn(true)
    socket.emit("join-world", playerSocket, (response) => {
        socketId = response.socketId;
        socketPlacesMD = response.placesMD;
    });
};
