import { io } from "socket.io-client";
import { getCharSocket } from "../states/characterstate";

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
    socket = io("http://localhost:3000", {
        transports: ["websocket"],
    });
}
export const joinWorld = (roomId) => {
    const playerSocket = getCharSocket();
    if (!playerSocket) {
        console.error("Socket not initialized. Call initSocket() first.");
        return;
    }
    socket.emit("join-world", playerSocket, (response) => {
        socketId = response.socketId;
        socketPlacesMD = response.placesMD;
        console.log("Joined world with socket ID:", socketId);
        console.log("Received places metadata:", socketPlacesMD);
    });
};

