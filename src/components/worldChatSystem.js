import { createElement } from "../tools/GUITools.js"
import { getCharState } from "../charactersystem/characterstate.js"
import { getSocket } from "../sockets/joinsocket.js"
import { getIsSocketOn } from "../sockets/worldsocket.js"
import { useFetch, checkIfTokenSaved } from "../tools/tools.js"
import { APIURL } from "../constants/constants.js"

const chatContainer = document.querySelector(".chat-container")
const chatsList = document.querySelector(".chats-list")
const chatInp = document.querySelector(".chat-inp")
const chatSendBtn = document.querySelector(".chat-sendbtn")
const chatToggleBtn = document.querySelector(".chat-toggle-btn")

let chatSystemInitiated = false
let isChatOpen = false

function appendChatMessage({ name, message }){
    const bx = createElement("div", "chat-bx")
    bx.append(
        createElement("span", "chat-name", `${name}: `),
        createElement("span", "chat-message", message)
    )
    chatsList.append(bx)
    chatsList.scrollTop = chatsList.scrollHeight
}

// world chat has no rooms/parties - just the full history so far, capped
// client-side since the DB collection has no pagination yet
async function loadChatHistory(){
    const messages = await useFetch(`${APIURL}/worldmessage`, "GET", checkIfTokenSaved().token, false)
    if(!Array.isArray(messages)) return
    chatsList.innerHTML = ''
    messages.slice(-50).forEach(appendChatMessage)
}

function sendChatMessage(){
    const message = chatInp.value.trim()
    chatInp.value = ''
    if(!message) return
    if(!getIsSocketOn()) return

    const charState = getCharState()
    const socket = getSocket()
    if(!charState || !socket) return

    const chatData = {
        playerId: charState.owner,
        name: charState.name,
        message,
        place: `${charState.currentPlace.placeId}`,
        msgType: "world"
    }

    // realtime broadcast goes through the tcp socket server, persistence
    // goes straight to the server's own REST api (tcp has no db access)
    socket.emit("worldChatMessage", chatData)
    useFetch(`${APIURL}/worldmessage/save`, "POST", checkIfTokenSaved().token, chatData)
}

export function initOnceWorldChatSystem(){
    if(chatSystemInitiated) return
    chatSystemInitiated = true

    chatSendBtn.addEventListener("click", sendChatMessage)
    chatInp.addEventListener("keydown", e => {
        if(e.key === "Enter") sendChatMessage()
    })
    chatToggleBtn.addEventListener("click", toggleChatContainer)
}

// called by worldsocket.js's "worldChatMessage" listener when any player
// (including yourself, echoed back) sends a message
export function receiveWorldChatMessage(data){
    appendChatMessage(data)
}

export function openCloseChatContainer(willOpen){
    isChatOpen = willOpen
    chatContainer.style.display = willOpen ? "flex" : "none"
    chatToggleBtn.textContent = willOpen ? "Hide Chat" : "Show Chat"
    if(willOpen) loadChatHistory()
}

// areascene.js/dungeonscene.js drive open/closed automatically based on
// whether the place is multiplayer - this just lets the player collapse/
// reopen it manually on top of that without needing to leave the place
export function toggleChatContainer(){
    openCloseChatContainer(!isChatOpen)
}

// single-player places have no world chat at all - hide the toggle button
// itself too, not just the message box, so there's no way to reopen it
export function setWorldChatAvailable(isAvailable){
    chatToggleBtn.style.display = isAvailable ? "block" : "none"
    openCloseChatContainer(isAvailable)
}
