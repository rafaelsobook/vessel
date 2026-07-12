import toSellCatalog from "../staticRecources/toSell.js"
import { createElement } from "../tools/GUITools.js"
import { checkIfTokenSaved, randomNum } from "../tools/tools.js"
import { getCharState, updateMyDetailsOL } from "../charactersystem/characterstate.js"
import { obtain } from "../charactersystem/inventory.js"
import { openClosePopup } from "../tools/popupUI.js"
import { canAfford, earnFromPrice, getWealthInBronze, spendOnPrice } from "../charactersystem/currencySystem.js"

const bsCont      = document.querySelector(".buysell-container")
const tabBtns     = document.querySelectorAll(".bs-tab-btn")
const categBtns   = document.querySelectorAll(".bs-categ-btn")
const itemsGrid   = document.querySelector(".bs-items-grid")
const walletAmount = document.querySelector(".bs-wallet-amount")
const actionBtn   = document.querySelector(".bs-action-btn")

let mode = "buy" // buy // sell
let activeCategory = "all"
let selectedItem = null

const CATEG_MATCHERS = {
    all: () => true,
    weapon: itm => itm.itemType === "weapon",
    armor: itm => itm.itemType === "armor",
    helmet: itm => itm.itemType === "helmet",
    boots: itm => itm.itemType === "boots",
    material: itm => itm.itemCateg === "crafting",
    consumable: itm => itm.itemCateg === "consumable",
}

export function buyOrSell(willSell){
    mode = willSell ? "sell" : "buy"
    activeCategory = "all"
    selectedItem = null

    tabBtns.forEach(btn => btn.classList.toggle("active", btn.classList.contains(mode)))
    categBtns.forEach(btn => btn.classList.toggle("active", btn.dataset.categ === "all"))

    bsCont.style.display = "flex"
    render()
}

function getSellableItems(){
    const charState = getCharState()
    return charState.items.filter(itm =>
        itm.itemCateg !== "currency" &&
        itm.itemCateg !== "quest" &&
        !itm.equiped
    )
}

function render(){
    const charState = getCharState()
    walletAmount.innerHTML = `x${getWealthInBronze(charState)}`

    const sourceItems = mode === "buy" ? toSellCatalog : getSellableItems()
    const matcher = CATEG_MATCHERS[activeCategory] || CATEG_MATCHERS.all
    const filteredItems = sourceItems.filter(matcher)

    itemsGrid.innerHTML = ""
    actionBtn.textContent = mode === "buy" ? "Buy" : "Sell"
    actionBtn.disabled = true

    if(!filteredItems.length){
        itemsGrid.append(createElement("p", "bs-empty-msg", mode === "buy" ? "Nothing here for sale" : "You have nothing to sell here"))
        return
    }

    filteredItems.forEach(itm => {
        const slot = createElement("button", "bs-item-slot")
        const img = createElement("img", "bs-item-img")
        img.src = `./images/items/${itm.itemCateg}/${itm.name}.webp`
        // some existing item art is .png rather than .webp (see toSell.js weapons) - fall back once
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
        buyOrSell(btn.classList.contains("sell"))
    })
})

categBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        activeCategory = btn.dataset.categ
        selectedItem = null
        categBtns.forEach(b => b.classList.toggle("active", b === btn))
        render()
    })
})

actionBtn.addEventListener("click", async () => {
    if(!selectedItem) return
    const charState = getCharState()

    if(mode === "buy"){
        if(!canAfford(charState, selectedItem.price)) return openClosePopup("Not enough coins", true, 1500)
        spendOnPrice(charState, selectedItem.price)
        // obtain() handles stacking, the acquired popup, and persisting charState
        await obtain({...selectedItem, itemId: randomNum(), sellerId: undefined})
    }else{
        await earnFromPrice(selectedItem.price)
        charState.items = charState.items.filter(itm => itm.itemId !== selectedItem.itemId)
        await updateMyDetailsOL(charState, checkIfTokenSaved())
    }

    selectedItem = null
    actionBtn.disabled = true
    render()
})
