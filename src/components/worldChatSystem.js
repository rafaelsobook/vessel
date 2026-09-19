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

export function appendChatMessage({ name, message }){
    const bx = createElement("div", "chat-bx")
    bx.append(
        createElement("span", "chat-name", `${name}: `),
        createElement("span", "chat-message", message)
    )
    chatsList.append(bx)
    chatsList.scrollTop = chatsList.scrollHeight
}

// one plain line, no "name: " prefix - for announcements that read as a
// full sentence on their own (worldsocket.js's "player-death" handler:
// "PlayerName died!") rather than something someone said. appendChatMessage
// always renders `${name}: ` regardless of what's passed for name, so an
// empty name there would just leave a stray leading ": " instead of this.
//
// Exported for that same "player-death" handler - a synthesized local
// system line, not a real chat message, so it deliberately bypasses
// sendChatMessage entirely (no worldChatMessage socket emit, no
// /worldmessage/save POST) - every client already receives "player-death"
// independently and would otherwise each try to persist/re-broadcast the
// same announcement.
export function appendSystemMessage(text){
    const bx = createElement("div", "chat-bx chat-system")
    bx.append(createElement("span", "chat-system-message", text))
    chatsList.append(bx)
    chatsList.scrollTop = chatsList.scrollHeight
}

// same "full sentence, no name: prefix" shape as appendSystemMessage above,
// but two separately-colored spans instead of one flat message - the name
// itself highlighted (limegreen) apart from the "has joined" text around it
// (white). Its own function rather than teaching appendSystemMessage to
// take rich text, so "PlayerName died!" (that function's own existing
// caller) keeps its current single-color styling untouched.
export function appendJoinMessage(name){
    const bx = createElement("div", "chat-bx chat-system")
    bx.append(
        createElement("span", "chat-join-name", name),
        createElement("span", "chat-join-text", " has joined")
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

// server/routes/worldMessageR.js's own "DELETE /worldmessage/clear" -
// wipes every persisted world chat message, no undo (that route is a
// straight Messages.deleteMany({}), same "no soft-delete" style its own
// POST /save already has). Only clears THIS client's own local chat box
// after a successful call - every other connected client still has
// whatever it already rendered until its own next loadChatHistory() (e.g.
// reopening the chat panel), since there's no live "chat was cleared"
// broadcast wired up for this yet.
export async function clearWorldChatHistory(){
    if(!getIsSocketOn()) return console.log(getIsSocketOn())
    const result = await useFetch(`${APIURL}/worldmessage/clear`, "DELETE", checkIfTokenSaved().token, false)
    if(!result) return console.log("failed to clear world chat history")
    chatsList.innerHTML = ''
    return result
}

function sendChatMessage(_messageNotFromChatInput){
    const chatInpTxt = chatInp.value.trim() 
    chatInp.value = ''
    console.log(chatInpTxt)
    if(chatInpTxt === "adminclear") return clearWorldChatHistory()
    if(!chatInpTxt && !_messageNotFromChatInput) return console.log(chatInpTxt, _messageNotFromChatInput)
    if(!getIsSocketOn()) return console.log(getIsSocketOn())

    const charState = getCharState()
    const socket = getSocket()
    if(!charState || !socket) return console.log('no socket or charstate ', socket)

    const chatData = {
        playerId: charState.owner,
        name: charState.name,
        message: _messageNotFromChatInput ? _messageNotFromChatInput : chatInpTxt,
        place: `${charState.currentPlace.placeId}`,
        msgType: "world"
    }

    // realtime broadcast goes through the tcp socket server, persistence
    // goes straight to the server's own REST api (tcp has no db access)
    socket.emit("worldChatMessage", chatData)
    useFetch(`${APIURL}/worldmessage/save`, "POST", checkIfTokenSaved().token, chatData)
}

export function sendWorldMessage(_messageNotFromChatInput){
    sendChatMessage(_messageNotFromChatInput)
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

// used by uimanagement.js's hideShowAllScreenUI - saves/restores whatever
// display setWorldChatAvailable last put it in, instead of forcing it back
// to visible, so a temporary full-UI hide can't make the toggle button
// reappear in a place where world chat isn't available at all
let toggleBtnDisplayBeforeHide = null
export function hideShowChatToggleBtn(hide){
    if(hide){
        toggleBtnDisplayBeforeHide = chatToggleBtn.style.display
        chatToggleBtn.style.display = "none"
    }else if(toggleBtnDisplayBeforeHide !== null){
        chatToggleBtn.style.display = toggleBtnDisplayBeforeHide
        toggleBtnDisplayBeforeHide = null
    }
}
