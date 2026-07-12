import { createElement, checkIfTokenSaved } from "../tools/tools.js"
import { getCharState, updateMyDetailsOL } from "./characterstate.js"
import { emitClaimQuest, emitCancelQuest, emitCompleteQuest } from "../sockets/emits.js"
import { obtain } from "./inventory.js"
import { earnFromPrice } from "./currencySystem.js"
import { openClosePopup } from "../tools/popupUI.js"

const questContainer = document.querySelector(".quest-container")
const questTitleElem = document.querySelector(".quest-title")
const questSubtitleElem = document.querySelector(".quest-subtitle")
const questDescElem = document.querySelector(".quest-desc")
const questObjectiveImgElem = document.querySelector(".quest-objective-img")
const questObjectiveNameElem = document.querySelector(".quest-objective-name")
const questObjectiveProgressElem = document.querySelector(".quest-objective-progress")
const questRewardsListElem = document.querySelector(".quest-rewards-list")
const questTrackBtn = document.querySelector(".quest-track-btn")
const inventoryContainer = document.querySelector(".inventory-container")

const REQ_TYPE_LABELS = {
    monster: "Kill Quest",
    item: "Gathering Quest",
    money: "Delivery Quest",
}

// The quest board (tcp/recources/quests.ts) and charState.items use two
// completely different shapes, so a claimed quest is carried around as an
// item wrapping the original quest object under questDetail — that's what
// lets showGuildQuest() re-render the exact same popup later from the
// inventory, and what unclaimQuest() sends back to the server on cancel.
export function questToItem(quest) {
    // claimed, desc, pos, price, qName, qTtle, questId, 
    // quesRequirements{completed, current, modelStyle, name, reqType,requiredNum}
    console.log(quest)
    return {
        itemId: quest.questId,
        name: quest.questRequirements.modelStyle ,
        dn: quest.qTtle,
        itemCateg: "quest",
        itemType: "quest",
        qnty: 1,
        price: { coinType: "bronze", pieces: 0 },
        desc: quest.desc,
        questDetail: quest
    }
}

// Vanessa's "Report my Quest" hub option - finds whichever guild-board
// contract quest is sitting in the inventory (checkStoryQuestIfCompleted in
// storyQuestSystem.js is what flips questRequirements.completed as monsters
// die), grants the reward if it's done, and clears the item either way.
export async function reportQuest(){
    const charState = getCharState()
    if(!charState) return

    const questItem = charState.items.find(itm => itm.itemCateg === "quest")
    if(!questItem) return openClosePopup("You have no quest to report", true, 2000)

    const { questDetail } = questItem
    const { questRequirements, reward, qTtle } = questDetail

    if(!questRequirements.completed){
        return openClosePopup(`${qTtle} isn't finished yet (${questRequirements.current}/${questRequirements.requiredNum})`, true, 2000)
    }

    for(const rewardItem of reward.rewardItems){
        await obtain(rewardItem)
    }
    if(reward.rewardCoin){
        await earnFromPrice({ coinType: reward.receiveRewardType, pieces: reward.rewardCoin })
    }

    charState.items = charState.items.filter(itm => itm.itemId !== questItem.itemId)
    await updateMyDetailsOL(charState, checkIfTokenSaved())

    openClosePopup(`${qTtle} complete! Rewards claimed.`, true, 2000)
    // tells the server to retire this quest for good and top the board's
    // f-rank pool back up if this drops it below F_RANK_QUEST_COUNT
    emitCompleteQuest(questDetail.questId)
}

function removeQuestItem(questItem) {
    const charState = getCharState()
    if (!charState) return
    charState.items = charState.items.filter(itm => itm.itemId !== questItem.itemId)
    updateMyDetailsOL(charState, checkIfTokenSaved())
}

function capitalize(str) {
    if (!str) return ""
    return str.charAt(0).toUpperCase() + str.slice(1)
}

function createRewardSlot({ img, qnty, label, hasBadge }) {
    const slot = createElement("div", "quest-reward-slot")

    if (hasBadge) {
        const imgBx = createElement("div", "quest-reward-img-bx")
        const iconImg = createElement("img", "quest-reward-img")
        iconImg.src = img
        imgBx.appendChild(iconImg)
        if (qnty !== undefined) imgBx.appendChild(createElement("span", "quest-reward-badge", qnty))
        slot.appendChild(imgBx)
    } else {
        const iconImg = createElement("img", "quest-reward-img")
        iconImg.src = img
        slot.appendChild(iconImg)
        if (qnty !== undefined) slot.appendChild(createElement("p", "quest-reward-qty", qnty.toLocaleString()))
    }

    slot.appendChild(createElement("p", "quest-reward-label", label))
    return slot
}

// currentQuestItem is only set when showGuildQuest is opened in "owned"
// mode (isOwned = true), so the Cancel Quest handler knows which inventory
// item to remove — it's null while just browsing quests on the board.
let currentQuest = null
let currentQuestItem = null

export function showGuildQuest(questDetail, isOwned = false, questItem = null) {
    if (!questDetail) return
    const { qTtle, desc, questRequirements, reward } = questDetail

    currentQuest = questDetail
    currentQuestItem = isOwned ? questItem : null
    questTrackBtn.textContent = isOwned ? "Cancel Quest" : "Take Contract"

    // .quest-container is a full-screen centered popup, same as
    // .inventory-container — opening on top of it would just overlap, so
    // when this is opened from clicking a quest item in the inventory,
    // close the inventory behind it rather than stacking both.
    if (isOwned && inventoryContainer) inventoryContainer.style.display = "none"

    questTitleElem.textContent = qTtle
    questSubtitleElem.textContent = REQ_TYPE_LABELS[questRequirements.reqType] || "Quest"
    questDescElem.textContent = desc

    questObjectiveImgElem.src = `./images/modeltex/quest/${questRequirements.modelStyle}.webp`
    questObjectiveNameElem.textContent = `Defeat ${questRequirements.modelStyle}`
    questObjectiveProgressElem.textContent = `${questRequirements.current} / ${questRequirements.requiredNum}`

    questRewardsListElem.innerHTML = ""
    // if (reward.rewardCoin) {
    //     questRewardsListElem.appendChild(createRewardSlot({
    //         img: "./images/UI/coins.png",
    //         qty: reward.rewardCoin,
    //         label: "Gold"
    //     }))
    // }
    reward.rewardItems.forEach(item => {
        questRewardsListElem.appendChild(createRewardSlot({
            img: `./images/items/consumable/${item.name}.webp`,
            label: item.dn,
            qnty: item.qnty,
            hasBadge: true
        }))
    })

    questContainer.style.display = "flex"
}

questTrackBtn.addEventListener("click", () => {
    if (!currentQuest) return

    if (currentQuestItem) {
        // Cancel Quest: only the owner can do this and there's no other
        // player contending for it, so it's safe to drop locally right
        // away — the emit just hands the quest back to the board for
        // everyone else, it isn't waited on.
        removeQuestItem(currentQuestItem)
        emitCancelQuest(currentQuest.questId)
        questContainer.style.display = "none"
        currentQuest = null
        currentQuestItem = null
        return
    }

    // Take Contract: never call obtain() here — another player could be
    // claiming the same quest at the same instant, so the server has to be
    // the one to decide who actually gets it. worldsocket.js's
    // "quest-claim-result" handler is what calls obtain() once (and only
    // once) the server confirms this claim actually went through.
    emitClaimQuest(currentQuest.questId)
    questContainer.style.display = "none"
    currentQuest = null
})
