import { createElement } from "../tools/tools.js"

const questContainer = document.querySelector(".quest-container")
const questTitleElem = document.querySelector(".quest-title")
const questSubtitleElem = document.querySelector(".quest-subtitle")
const questDescElem = document.querySelector(".quest-desc")
const questObjectiveImgElem = document.querySelector(".quest-objective-img")
const questObjectiveNameElem = document.querySelector(".quest-objective-name")
const questObjectiveProgressElem = document.querySelector(".quest-objective-progress")
const questRewardsListElem = document.querySelector(".quest-rewards-list")

const REQ_TYPE_LABELS = {
    monster: "Kill Quest",
    item: "Gathering Quest",
    money: "Delivery Quest",
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

export function showGuildQuest(questDetail) {
    if (!questDetail) return
    const { qTtle, desc, questRequirements, reward } = questDetail

    console.log(questDetail)

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
