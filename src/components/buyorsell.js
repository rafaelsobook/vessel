import npcDetails from "../staticRecources/npcDetails.js"
import { createElement } from "../tools/GUITools.js"
import { checkIfTokenSaved, randomNum } from "../tools/tools.js"
import { getCharState, updateMyDetailsOL } from "../charactersystem/characterstate.js"
import { obtain } from "../charactersystem/inventory.js"
import { openClosePopup } from "../tools/popupUI.js"
import { canAfford, earnFromPrice, getWealthInBronze, spendOnPrice } from "../charactersystem/currencySystem.js"

const bsCont      = document.querySelector(".buysell-container")
const tabBtns     = document.querySelectorAll(".bs-tab-btn")
const itemsGrid   = document.querySelector(".bs-items-grid")
const walletAmount = document.querySelector(".bs-wallet-amount")
const actionBtn   = document.querySelector(".bs-action-btn")

let mode = "buy" // buy // sell
let selectedItem = null
let sellableCategories = null // null = no restriction, otherwise an array of itemCateg values (e.g. ["consumable", "crafting"]) - some shops don't buy weapons/armor
// which NPC's toSell array the "buy" tab reads from - set whenever a seller
// opens their own shop (buyOrSell(false, npcDet._id)), stays put across a
// Buy/Sell tab switch inside that same already-open shop
let currentSellerId = null

// switching tabs inside an already-open shop must NOT touch
// sellableCategories/currentSellerId - only opening the shop (buyOrSell, below) sets those
function switchMode(willSell){
    mode = willSell ? "sell" : "buy"
    selectedItem = null

    tabBtns.forEach(btn => btn.classList.toggle("active", btn.classList.contains(mode)))

    render()
}

// willSell false: `arg` is the seller NPC's own _id (npcDetails.js) - its
// toSell array becomes the buy list. willSell true: `arg` is an optional
// itemCateg restriction on what this shop will buy back from the player
// (e.g. flirtdata.js's buyOrSell(true, "crafting")) - unused when buying.
export function buyOrSell(willSell, arg){
    if(willSell) sellableCategories = arg || null
    else if(arg !== undefined) currentSellerId = arg
    switchMode(willSell)
    bsCont.style.display = "flex"
}

// each seller now owns their own stock (npcDetails.js's toSell:[] on that
// NPC) instead of everyone sharing one big toSell.js catalog - no more
// "every vendor sells everything" (buyorsell.js used to filter ONE shared
// array down by the left-hand category sidebar, which has been removed
// entirely along with that sidebar)
function getBuyableItems(){
    const seller = npcDetails.find(npc => npc._id === currentSellerId)
    return seller?.toSell || []
}

function getSellableItems(){
    const charState = getCharState()
    return charState.items.filter(itm =>
        itm.itemCateg !== "currency" &&
        itm.itemCateg !== "quest" &&
        !itm.equiped &&
        (!sellableCategories || sellableCategories.includes(itm.itemCateg))
    )
}

function render(){
    const charState = getCharState()
    walletAmount.innerHTML = `x${getWealthInBronze(charState)}`

    const sourceItems = mode === "buy" ? getBuyableItems() : getSellableItems()

    itemsGrid.innerHTML = ""
    actionBtn.textContent = mode === "buy" ? "Buy" : "Sell"
    actionBtn.disabled = true

    if(!sourceItems.length){
        itemsGrid.append(createElement("p", "bs-empty-msg", mode === "buy" ? "Nothing here for sale" : "You have nothing to sell here"))
        return
    }

    sourceItems.forEach(itm => {
        const slot = createElement("button", "bs-item-slot")
        const img = createElement("img", "bs-item-img")
        img.src = `./images/items/${itm.itemCateg}/${itm.name}.webp`
        // sword/spear/axe/pickaxe each get their own shared icon (sword.webp/
        // spear.webp/axes.webp/pickaxe.webp) - same override inventory.js
        // already applies for its own item icon lookup. Sword/spear matter
        // even more here than axe/pickaxe: a CRAFTED sword/spear
        // (craftingui.js's buildSwordItem) gets a randomly-generated unique
        // name (`customsword_${Date.now()}`) that can never match a real
        // per-item icon file - without this override every crafted weapon
        // in the sell list rendered a permanently broken image (itm.name.webp
        // 404s, the onerror .png retry 404s too, same broken name).
        if(itm.weaponType === "sword" || itm.weaponType === "spear") img.src = `./images/items/${itm.itemCateg}/${itm.weaponType}.webp`
        if(itm.weaponType === "axe") img.src = `./images/items/${itm.itemCateg}/axes.webp`
        // helmets key their own icon off modelName, not name - same override
        // inventory.js already applies. Every helmet item's own name is a
        // flavor/save-key string, separate from modelName (the real art
        // file) - e.g. laurietsHatItem: name "lauriethat", dn "Lauriet's
        // Hat", modelName "magicianhat" (questions.js), matching the actual
        // magicianhat.webp on disk. Without this override, itm.name.webp
        // (here, "lauriethat.webp") was requested instead - a file that was
        // never meant to exist.
        if(itm.itemType === "helmet") img.src = `./images/items/${itm.itemCateg}/${itm.modelName}.webp`
        if(itm.weaponType === "pickaxe") img.src = `./images/items/${itm.itemCateg}/pickaxe.webp`
        // a skill book shows the icon of the skill it teaches, not an item
        // icon - it has no art of its own (staticRecources/skillBooks.js).
        // Set before the .png onerror fallback below so a book that somehow
        // has no skill icon still falls back the same way everything else does.
        if(itm.itemCateg === "skillbook") img.src = `./images/skills/${itm.skillName}.webp`
        // some existing item art is .png rather than .webp (see npcDetails.js sellers' toSell weapons) - fall back once
        img.onerror = () => { img.onerror = null; img.src = `./images/items/${itm.itemCateg}/${itm.name}.png` }
        const name = createElement("p", "bs-item-name", itm.dn)

        const priceRow = createElement("div", "bs-item-price")
        const priceIcon = createElement("img", "bs-price-icon")
        priceIcon.src = "./images/UI/coins.png"
        const priceAmount = createElement("p", "bs-price-amount", itm.price.pieces)
        priceRow.append(priceIcon, priceAmount)

        slot.append(img, name, priceRow)
        itemsGrid.append(slot)

        slot.addEventListener("click", () => {
            itemsGrid.querySelectorAll(".bs-item-slot").forEach(s => s.classList.remove("selected"))
            slot.classList.add("selected")
            selectedItem = itm
            actionBtn.disabled = false
        })
    })
}

tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        switchMode(btn.classList.contains("sell"))
    })
})

actionBtn.addEventListener("click", async () => {
    if(!selectedItem) return
    const charState = getCharState()

    if(mode === "buy"){
        if(!canAfford(charState, selectedItem.price)) return openClosePopup("Not enough coins", true, 1500)
        spendOnPrice(charState, selectedItem.price)
        // obtain() handles stacking, the acquired popup, and persisting charState
        await obtain({...selectedItem, itemId: randomNum()})
    }else{
        await earnFromPrice(selectedItem.price)
        charState.items = charState.items.filter(itm => itm.itemId !== selectedItem.itemId)
        await updateMyDetailsOL(charState, checkIfTokenSaved())
    }

    selectedItem = null
    actionBtn.disabled = true
    render()
})
