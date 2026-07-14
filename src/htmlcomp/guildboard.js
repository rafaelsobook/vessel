import { checkIfTokenSaved, createElement } from "../tools/tools.js"
import { getCharState } from "../charactersystem/characterstate.js"
import { getAllCharacters } from "../serverApiFun/getAllCharacters.js"

const GUILD_HOUSE_PLACE_ID = 9

const lbContainer = document.querySelector(".leaderboard-container")
const lbList = document.querySelector(".lb-list")
const lbMyRankValue = document.querySelector(".lb-my-rank-value")
const guildIconBtn = document.querySelector(".guild-icon-btn")

guildIconBtn.addEventListener("click", () => showOrHideGuildBoard())

export function updateGuildIconVisibility(){
    const isInGuildHouse = getCharState()?.currentPlace?.placeId === GUILD_HOUSE_PLACE_ID
    guildIconBtn.style.display = isInGuildHouse ? "block" : "none"
    if(!isInGuildHouse) showOrHideGuildBoard(false)
}

export async function showOrHideGuildBoard(_visible){
    const isOpen = lbContainer.style.display === "flex"
    const willShow = _visible !== undefined ? _visible : !isOpen

    lbContainer.style.display = willShow ? "flex" : "none"
    if(willShow) await renderLeaderboard()
}

async function renderLeaderboard(){
    lbList.innerHTML = ""
    lbList.append(createElement("p", "lb-empty-msg", "Loading..."))
    lbMyRankValue.textContent = "-"

    const accountDet = checkIfTokenSaved()
    const characters = await getAllCharacters(accountDet ? accountDet.token : null)

    lbList.innerHTML = ""

    if(!characters.length){
        lbList.append(createElement("p", "lb-empty-msg", "No players found"))
        return
    }

    const sorted = [...characters].sort((a, b) => {
        if(b.lvl !== a.lvl) return b.lvl - a.lvl
        return (b.rank?.rankNumber || 0) - (a.rank?.rankNumber || 0)
    })

    const myId = getCharState()?._id

    sorted.forEach((char, i) => {
        const rank = i + 1
        const isMe = char._id === myId
        if(isMe) lbMyRankValue.textContent = rank

        const row = createElement("div", isMe ? "lb-row self" : "lb-row")
        row.append(
            createElement("p", "lb-rank", rank),
            createElement("p", "lb-player", char.name),
            createElement("p", "lb-race", char.race || "human"),
            createElement("p", "lb-lvl", char.lvl),
            createElement("p", "lb-ranklabel", (char.rank?.rankLabel || "f").toUpperCase()),
            createElement("p", "lb-title-lbl", char.titles?.[0] || "Rookie"),
        )
        lbList.append(row)
    })
}
