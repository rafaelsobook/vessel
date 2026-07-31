import { createElement, setLoadingInAList } from "../tools/GUITools.js"
import { getCharState, updateMyDetailsOL } from "./characterstate.js"
import { checkIfTokenSaved, randomNum } from "../tools/tools.js"
import { equipItem, showItemInfo, unEquip } from "./itemInfoSystem.js"
import { openClosePopup } from "../tools/popupUI.js"
import { getPlayersOnScene } from "../sockets/worldsocket.js"
import { swordsData } from "../staticRecources/swordsdata.js"
import toSellCatalog from "../staticRecources/toSell.js"
import { createLootItem, lootNames } from "../staticRecources/resourceLoot.js"
import {
    farmhatItem, laurietsHatItem, armorItem, lightArmorItem, pauldronItem,
    gauntletItem, helmetItem, ironmaskItem, bootsItem, swordItem,
} from "../constants/questions.js"


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
    slotBrder.src = './images/UI/border3.webp'

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
    if(itm.weaponType === "sword" || itm.weaponType === "spear") itemImg.src = `./images/items/${itm.itemCateg}/${itm.weaponType}.webp`
    if(itm.itemType === "helmet") itemImg.src = `./images/items/${itm.itemCateg}/${itm.modelName}.webp`

    // every sword shares the same placeholder icon above, so this is the
    // only way to tell which generated variant a slot actually is - shown
    // on hover via CSS (see .slot-name-overlay), covers the icon in place
    // instead of floating outside the slot's own box
    const nameOverlay = createElement('p', 'slot-name-overlay', itm.dn)
    button.append(nameOverlay)
    button.title = itm.dn // truncated in the slot itself, full name still available on hover

    itemSlotList.append(button)
}
export function closeInventory(){
    inventoryCont.style.display = "none"
}

let timeOutForClearingLists

function addItemToCharState(charState, itemToAdd){
    let hasSameItem = false
    charState.items && charState.items.forEach(itm => {
        if(itm.name === itemToAdd.name && itm.itemCateg !== "equipable"){
            itm.qnty += itemToAdd.qnty
            hasSameItem = true
        }
    })
    // meaning hinde eqiupable kase magkaka same item lang pag ibang itemCateg
    if(!hasSameItem) charState.items.push(itemToAdd)
}

export async function obtain(itemToAdd){
    const charState = getCharState()
    if(!charState) return
    addItemToCharState(charState, itemToAdd)

    showItemAcquiredPopUp(itemToAdd.dn, itemToAdd.qnty, () => {
        updateMyDetailsOL(charState, checkIfTokenSaved())
    })

}
export function obtainAll(itemsArray){
    const charState = getCharState()
    if(!charState) return

    itemsArray.forEach((itemToAdd, i) => {
        addItemToCharState(charState, itemToAdd)
        setTimeout(() => showItemAcquiredPopUp(itemToAdd.dn, itemToAdd.qnty, null), i * 500)
    })

    updateMyDetailsOL(charState, checkIfTokenSaved())
}
// DEBUG CHEAT - bound to the "i" key in controllers/inputMovement.js. Pulls
// one of every item definition currently in the game (swords catalog, shop
// catalog minus a couple duplicate-feeling axes, craftable loot materials,
// and the armor set handed out by questions.js) and drops them straight into
// the inventory. Each item needs a fresh itemId - these are all shared static
// objects/arrays, so reusing their itemId as-is would give every pickup the
// same id instead of a distinct inventory entry.
const EXCLUDED_SHOP_ITEMS = ["silverwood", "daedalus", "knightaxe"]
const questArmorItems = [
    farmhatItem, laurietsHatItem, armorItem, lightArmorItem, pauldronItem,
    gauntletItem, helmetItem, ironmaskItem, bootsItem, swordItem,
]

export function giveAllItems(){
    const allItems = [
        ...swordsData.map(itm => ({ ...itm, itemId: randomNum() })),
        ...toSellCatalog
            .filter(({ name }) => !EXCLUDED_SHOP_ITEMS.includes(name))
            .map(({ sellerId, ...itm }) => ({ ...itm, itemId: randomNum() })),
        ...lootNames.map(name => createLootItem(name)),
        ...questArmorItems.map(itm => ({ ...itm, itemId: randomNum() })),
    ]
    obtainAll(allItems)
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
export function reduceDurability(item){
    if(!item || !item.durability) return

    // durability lives on itemType (weapon/armor/helmet/...), not itemCateg -
    // itemCateg is always "equipable" for all of these
    switch(item.itemType){
        case "weapon":
            item.durability.current -= 1
        break
        case "armor":
        case "helmet":
        case "gauntlet":
        case "boots":
        case "pauldron":
            item.durability.current -= 1
        break
        default:
            return
    }

    if(item.durability.current <= 0){
        item.durability.current = 0
        return itemBroke(item)
    }

    updateMyDetailsOL(getCharState(), checkIfTokenSaved())
}
export function itemBroke(item){
    const charState = getCharState()
    if(!charState) return

    openClosePopup(`${item.dn} broke!`, true, 2000)
    unEquip(item.itemType) // clears the armory slot icon, drops mining mode if a weapon just broke mid-swing

    charState.items = charState.items.filter(itm => itm.itemId !== item.itemId)

    // the visible sword mesh lives in the character's own swordMeshes cache
    // (see createcharacter.js's createSword/equipSword) - unEquip() above
    // only hides it for possible re-equip later, it doesn't dispose it, so a
    // broken weapon has to be torn down here instead
    if(item.itemType === "weapon"){
        const myChar = getPlayersOnScene().find(pl => pl.owner === charState.owner)
        if(myChar){
            const idx = myChar.swordMeshes.findIndex(swrd => swrd.name === item.name)
            if(idx !== -1){
                myChar.swordMeshes[idx].mesh.dispose(false, true) // recurse into child part-meshes, and dispose their cloned materials too
                myChar.swordMeshes.splice(idx, 1) // mutate in place - swordMeshes is shared by reference with createcharacter.js's closure, reassigning would only rebind this outer property
            }
        }
    }

    updateMyDetailsOL(charState, checkIfTokenSaved())
}