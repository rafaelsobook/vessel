import { createElement, setLoadingInAList } from "../tools/GUITools.js"
import { getCharState, updateMyDetailsOL } from "./characterstate.js"
import { checkIfTokenSaved, randomNum } from "../tools/tools.js"
import { equipItem, showItemInfo, unEquip } from "./itemInfoSystem.js"
import { openClosePopup } from "../tools/popupUI.js"
import { getPlayersOnScene } from "../sockets/worldsocket.js"
import { createLootItem, lootNames } from "../staticRecources/resourceLoot.js"
import { activateSkill } from "./attackingSystem.js"
import { updateSkillListUI } from "../components/skillsui.js"
import { METAL_COLOR } from "../tools/metalmat.js"


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
// DEBUG CHEAT - bound to the "i" key in controllers/inputMovement.js. Drops
// one of every craftable material (resourceLoot.js's lootNames - ores, gems,
// wood/leather/stone) straight into the inventory, for testing the crafting
// UI without actually mining. createLootItem() already mints a fresh itemId
// per call, so no extra work needed here to keep pickups distinct.
export function giveAllItems(){
    obtainAll([...lootNames.map(name => createLootItem(name)),
        {
            itemId: randomNum(), // should be string also in client
            name: "lauriethat", // is also the image name
            modelName: "magicianhat",
            dn: "Lauriet's Hat",
            itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
            itemType: "helmet", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
            weaponType: undefined,
            equipAbilities: {
                dmg: 0, def: 20, resistance: 10, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
            }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
            // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
            consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
            equiped: false,
            soulFeed: 0,
            isEnhanceAble: true, // only for equipable items
            enhancedLevel: 0,
            slots: [],// { name, dn, equipAbilities } cores
            durability: { current: 100, max: 100},
            price: { coinType: "bronze", pieces: 10 },
            qnty: 1,
            desc: undefined,
            rarity: "rare",
            metalColor: METAL_COLOR.ADAMANTINE
        },
        {
            itemId: randomNum(), // should be string also in client
            name: "ironmask", // is also the image name
            modelName: "ironmask",
            dn: "Iron Mask",
            itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
            itemType: "helmet", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
            weaponType: undefined,
            equipAbilities: {
                dmg: 0, def: 12, resistance: 5, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
            }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
            consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
            equiped: false,
            soulFeed: 0,
            isEnhanceAble: true, // only for equipable items
            enhancedLevel: 0,
            slots: [],// { name, dn, equipAbilities } cores
            durability: { current: 100, max: 100},
            price: { coinType: "bronze", pieces: 6 },
            qnty: 1,
            desc: "A plain iron mask that hides the wearer's face, offering modest protection.",
            rarity: "common",
            metalColor: METAL_COLOR.GOLD,
            hairVisible: true, // if false, hair is hidden when this helmet is equipped (see createHelmet() for how this works)
        },
        {
            itemId: randomNum(), // should be string also in client
            name: "leatherboots", // is also the image name
            dn: "Leather Boots",
            itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
            itemType: "boots", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
            equipAbilities: {
                dmg: 0, def: 0, resistance: 5, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
            }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
            // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
            consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
            equiped: false,
            soulFeed: 0,
            isEnhanceAble: false, // only for weapons
            enhancedLevel: 0,
            durability: { current: 100, max: 100},
            price: { coinType: "bronze", pieces: 9 },
            qnty: 1,
            desc: "This Boots is light and useful for first time adventurers",
            rarity: "common"
        }
    ])
}
// DEBUG CHEAT - bound to the "p" key in controllers/inputMovement.js. Clears
// the inventory AND every learned skill. Unequips items first (both the
// UI-side equiped flag/armory slot via unEquip() and the actual 3D mesh
// visibility via myChar.unEquip()) so nothing's left floating on the
// character with no backing item - deactivates any active skill the same
// way (activateSkill's isActive:false branch, e.g. flexaura.auraz.stop() /
// singlecast's cancelPendingCast()) so nothing's left running with no
// backing skill either.
export function wipeAllItems(){
    const charState = getCharState()
    if(!charState) return

    const myChar = getPlayersOnScene().find(pl => pl.owner === charState.owner)
    const equippedTypes = new Set(charState.items.filter(itm => itm.equiped).map(itm => itm.itemType))
    equippedTypes.forEach(itemType => {
        unEquip(itemType)
        if(myChar) myChar.unEquip(itemType)
    })
    charState.items = []

    charState.skills.filter(skl => skl.isActive).forEach(skl => {
        activateSkill(charState.owner, { ...skl, isActive: false })
    })
    charState.skills = []
    updateSkillListUI()

    updateMyDetailsOL(charState, checkIfTokenSaved())
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