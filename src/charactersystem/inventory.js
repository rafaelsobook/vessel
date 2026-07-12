import { createElement, setLoadingInAList } from "../tools/GUITools.js"
import { getCharState, updateMyDetailsOL } from "./characterstate.js"
import { checkIfTokenSaved } from "../tools/tools.js"
import { equipItem, showItemInfo } from "./itemInfoSystem.js"


const inventoryCont  = document.querySelector(".inventory-container")
const itemSlotList   = document.querySelector(".slots-list")
const goldCoinP      = document.querySelector(".gold-coin")
const acquiredLists  = document.querySelector(".acquired-lists")


let isInventoryLoading = false
let buttonsActivated   = false

// INVENTORY
export function checkIfIsInventoryLoading(){
    if(isInventoryLoading) {              
        setLoadingInAList(itemSlotList, "Loading")
    }else openUpdateInventory()           
}                                        
export function setInventoryLoading(_isLoading){
    isInventoryLoading = _isLoading;    
    checkIfIsInventoryLoading()
}
export async function openUpdateInventory(willOpen){    
    if(willOpen) inventoryCont.style.display = "flex"
    if(isInventoryLoading) return setLoadingInAList(itemSlotList, "Loading")
    itemSlotList.innerHTML =''
    const charDet = getCharState()
    // goldCoinP.innerHTML = `${charDet.assets.krit}`
    // getAllSounds().pickItemS.play()
    charDet.items.forEach(itm => insertItemOnInventory(itm))

    // const {isConnected}= getBlockChainDetail()
    // if(isConnected){
    //     myNftz = await getNftsOfthisAccount()
    //     myNftz.forEach(itm => insertItemOnInventory(itm))
    // }    
}
export function insertItemOnInventory(itm){
    if(itm.equiped) {
        equipItem(itm)
        return
    }
    const button = createElement('button',  `slot-btn ${itm.itemId}`)
    const itemImg = createElement("img", `slot-img ${itm.rarity}`)

    const slotBrder = createElement("img", 'slot-border')
    slotBrder.src = './images/UI/border3.png'

    if(itm.itemCateg !== "equipable" || itm.itemCateg !== "quest"){
        const itmQntyBorder = createElement('p', 'itm-qnty-border', itm.qnty)
        button.append(itmQntyBorder)
    }

    button.append(itemImg)
    button.append(slotBrder)
    if(itm.itemCateg === "quest"){
        itemImg.src = `./images/UI/mark.webp`
    }else{
        itemImg.src = `./images/items/${itm.itemCateg}/${itm.name}.webp`
    }
    itemSlotList.append(button)
}
export function closeInventory(){
    inventoryCont.style.display = "none"
}

let timeOutForClearingLists
export async function obtain(itemToAdd){
    const charState = getCharState()
    let hasSameItem = false
    if(!charState) return 
    charState.items && charState.items.forEach(itm => {
        if(itm.name === itemToAdd.name && itm.itemCateg !== "equipable"){
            itm.qnty += itemToAdd.qnty
            hasSameItem = true
        }
    })
    // meaning hinde eqiupable kase magkaka same item lang pag ibang itemCateg
    if(!hasSameItem) charState.items.push(itemToAdd)
    
    showItemAcquiredPopUp(itemToAdd.dn, itemToAdd.qnty, () => {
        updateMyDetailsOL(charState, checkIfTokenSaved())
    })

}
export function showItemAcquiredPopUp(displayName, acquiredQnty, cb){
    //itemToAdd.itemCateg // consumable // equipable // crafting
    clearTimeout(timeOutForClearingLists)
    acquiredLists.style.display = "block"
    setTimeout(() => {
        const pElem = createElement("p", "float-up", `acquired ${displayName}  x${acquiredQnty}`)
        acquiredLists.append(pElem);
        // getAllSounds().itemEquipS.play()
        // if(itemName.includes("coin")) return this._allSounds.coinReceivedS.play()
        // this._allSounds.itemEquipedS.play()
    }, 100)

    timeOutForClearingLists = setTimeout(() => {
        acquiredLists.innerHTML = ''
        acquiredLists.style.display = "none"
        cb && cb()
    }, 5000);
}
