import { createElement } from "../tools/GUITools.js"
import { openCloseMiniLS, openClosePopup } from "../tools/popupUI.js"
import { checkIfTokenSaved, randomNum, setPointerClickable, useFetch } from "../tools/tools.js"
import { getCharState, setCharStateMode, updateHunger, updateMyDetailsOL } from "./characterstate.js"
import { obtain, openUpdateInventory } from "./inventory.js"
import { getSceneDet } from "../main/main.js"
// import { getAllSounds } from "./soundSystem.js"
import { APIURL } from "../constants/constants.js" //validGatePlaces
// import { deleteGate, saveNewGate } from "./gatesSystem.js"
// import { getNodePos, setAndGetNodePos } from "./heroCoordSystem.js"
// import { uploadToIpfs } from "./blockChnSystem.js"
import { updateHeartStatus, updateStatUI } from "./statsSystem.js"
import { emitEquipItem } from "../sockets/emits.js"
import { getIsSocketOn, getPlayersOnScene } from "../sockets/worldsocket.js"
import { getSocket } from "../sockets/joinsocket.js"
import { showGuildQuest } from "./guildQuest.js"


const itemInfoCont = document.querySelector(".item-info-cont")
const itemImg = document.querySelector(".itemInfoImg")
const itemTtle = document.querySelector(".iteminfoTtle")
const slotBx = document.querySelector(".slots-bx")
const itemQnty = document.querySelector(".item-qnty")
const itemDesc = document.querySelector(".item-desc")

const itemStatsCont = document.querySelector(".item-stats")
const defRow = document.querySelector(".def-row")
const resistanceRow = document.querySelector(".resistance-row")
const dmgRow = document.querySelector(".dmg-row")
const durabilityRow = document.querySelector(".durability-row")
const itemDefValue = document.querySelector(".itemDefValue")
const itemResistanceValue = document.querySelector(".itemResistanceValue")
const itemDmgValue = document.querySelector(".itemDmgValue")
const itemDurabilityBar = document.querySelector(".itemDurabilityBar")

// weapon parts material breakdown (blade/guard/handle/pommel) - only
// meaningful for weapons built from part meshes, see createweapon.js/parts
const MATERIAL_ROWS = [
    { part: "blade",  row: document.querySelector(".blade-material-row"),  value: document.querySelector(".itemBladeMaterialValue") },
    { part: "guard",  row: document.querySelector(".guard-material-row"),  value: document.querySelector(".itemGuardMaterialValue") },
    { part: "handle", row: document.querySelector(".handle-material-row"), value: document.querySelector(".itemHandleMaterialValue") },
    { part: "pommel", row: document.querySelector(".pommel-material-row"), value: document.querySelector(".itemPommelMaterialValue") },
]
const capitalize = str => str.charAt(0).toUpperCase() + str.slice(1)

const DURABILITY_LOW_THRESHOLD = 0.3

const ARMOR_TYPES = ["armor", "gauntlet", "helmet", "boots"]

const claimContainer = document.querySelector(".claim-container")

const equipOrOpenBtn = document.getElementById("equipItemBtn")
// const weaponAccessoryList = document.querySelector(".weapon-accessory")
const weaponAccessoryList = document.querySelectorAll(".eqpd-slot")

const armorybx = document.querySelector(".armory-bx")


let itemDetail= undefined
let activateFunc = () => {

}
let equipItemFunc = () => {
    if(!itemDetail) return
    if(itemDetail.itemCateg !== "equipable") return
    openCloseMiniLS(`Equiping ${itemDetail.dn} ...`, true)
    // for UI and setting charState item to equiped
    equipItem(itemDetail, true)
    const { itemType, name, parts, itemId, metalColor } = itemDetail
    //  for 3d multiplayer sword mesh logic
    const isMultiplayerZone = getIsSocketOn()
    const charState = getCharState()
    if(isMultiplayerZone){
        emitEquipItem(itemDetail, true)
    }else{
        const myChar = getPlayersOnScene().find(pl => pl.owner === charState.owner)
        if(!myChar) return
        
        if (itemType === "boots") myChar.equipBoots(name)
        if(itemType === "weapon") myChar.equipSword(name, myChar.mode === "fighting", parts)
        if(itemType === "helmet") myChar.equipHelmet(name, itemDetail.metalColor)
        if(itemType === "gauntlet") myChar.equipGauntlet(name, itemDetail.metalColor)
        if(itemType === "pauldron") myChar.equipPauldron(name, itemDetail.metalColor)
        if(itemType === "armor") myChar.equipArmor(name, itemDetail.metalColor)

    }
    
    // const equipS = getSceneDet().scene.getSoundByName("itemEquipS")
    // equipS.play()
    // saving
    
    updateMyDetailsOL(charState, checkIfTokenSaved()).then( result => {
        openCloseMiniLS(`Equiping ${itemDetail.dn} ...`, false)
    })
}
// let emitAddGateFunc = async () => {
//     if(!itemDetail) return
//     const charState = getCharState()
//     const isValidPlace = validGatePlaces.some(placeName => placeName === charState.currentPlace)
//     if(!isValidPlace) return openClosePopup('Unable To Summon Gate Here', true, 1500)
//     const scene = getSceneDet().scene
//     const myBody = scene.getMeshByName(`body.${charState._id}`)
//     if(!myBody) return
//     const myPos = myBody.position

//     const newId = `${randomNum()}${randomNum()}`
    
//     const nodePos = getNodePos(scene, {x:0,y:0,z:2})//getting my forward pos
//     const gateData = { 
//         _id: newId, 
//         pos: {x: nodePos.x, y: 0, z: nodePos.z}, 
//         dirTarg: {x:myPos.x,y:0,z:myPos.z},
//         currentPlace: charState.currentPlace,
//         placeDetail: {...itemDetail.placeDetail,
//             placeId: newId,
//             placeName: `${itemDetail.placeDetail.placeName}${newId}`
//         }
//     }
//     itemDetail.placeDetail.paths.push(
//         { 
//             widthHeight:{ width: 5, height: 5}, 
//             placeDestination: charState.currentPlace, 
//             placeDestinationPos: { x: myPos.x, z: myPos.z},
//             pos:{...itemDetail.placeDetail.respawnPos, y: 0},
//         }
//     )
//     charState.items = charState.items.filter(itm => itm.itemId !== itemDetail.itemId)
//     // getAllSounds().keyUnlockingS.play()
//     await updateMyDetailsOL(charState, checkIfTokenSaved())
//     await saveNewGate(gateData)
//     openUpdateInventory(true)
//     // getSocket().emit("add-gate", {...gateData,enemyClass: itemDetail.name.split("_")[1].split("")[0],})
//     closeItemInfo()
//     // await deleteGate(newId)
// }
let consumeItemFunc = async () => {
    if(!itemDetail) return
    if(itemDetail.itemCateg !== "consumable") return
    
    openCloseMiniLS(`Consuming ${itemDetail.dn} ...`, true)
    const { cure, plusHp, plusMp, plusSp, plusDmg, plusSpd,fillHunger,  fillTireness } = itemDetail.consumeAbilities
    // saving
    const charState = getCharState()
    charState.hp+=plusHp
    charState.mp+=plusMp
    charState.sp+=plusSp
    charState.stats.strength+= plusDmg
    charState.stats.spd+= plusSpd
    if(charState.hp > charState.maxHp) charState.hp = charState.maxHp
    if(charState.mp > charState.maxMp) charState.mp = charState.maxMp
    if(charState.sp > charState.maxSp) charState.sp = charState.maxSp
    
    if(fillHunger){
        charState.survival.hunger += fillHunger
        if(charState.survival.hunger > 100) charState.survival.hunger = 100
    }
    if(fillTireness){
        charState.survival.sleep += fillTireness
        if(charState.survival.sleep > 100) charState.survival.sleep = 100
    }
    if(cure && cure.length && charState.status.length){
        cure.forEach(effectTypeName => {
            const hasCure = charState.status.find(effect => effect.effectType === effectTypeName)
            charState.status = charState.status.filter(effect => effect.effectType !== effectTypeName)
        })
    }
    let theItemAfterDeducted = itemDetail
    charState.items.forEach(invItm => {
        if(invItm.itemId === itemDetail.itemId){
            if(invItm.qnty > 1) {
                invItm.qnty--
                theItemAfterDeducted = invItm
            }else{
                removeItem(invItm)
                theItemAfterDeducted = false
            }
        }
    })

    enableDisableInfoBtns(true)
    updateMyDetailsOL(charState, checkIfTokenSaved()).then( result => {
        openCloseMiniLS(`Item Consumed`, false)
        enableDisableInfoBtns(false)
        openUpdateInventory(true)
        if(theItemAfterDeducted) showItemInfo(theItemAfterDeducted)
        updateHunger()
        updateStatUI()
    })
}
export function equipItem(itemDet, updateItemsListUI){
    weaponAccessoryList.forEach(chld => {
        const slotName = chld.className
        if(slotName === undefined) return
        if(slotName.split(" ")[1] === itemDet.itemType){
            chld.innerHTML = ''
            const eqpdImg = createElement('img', `slot-img slot-${itemDet.rarity ? itemDet.rarity : "normal"}`)
            eqpdImg.src = `./images/items/${itemDet.itemCateg}/${itemDet.name}.webp`
            if(itemDet.weaponType === "sword" || itemDet.weaponType === "spear") eqpdImg.src = `./images/items/${itemDet.itemCateg}/${itemDet.weaponType}.webp`
            chld.append(eqpdImg)
            const charState = getCharState()
            charState.items.forEach(itm => {                
                if(itm.itemType === itemDet.itemType){
                    itm.equiped = false
                }
                if(itm.itemId === itemDet.itemId) {
                    itm.equiped = true
                }
            })
        }
    })
     // for UI
    if(updateItemsListUI) openUpdateInventory(false)
    closeItemInfo()
}
export function unEquip(itemType){
    weaponAccessoryList.forEach(chld => {
        const slotName = chld.className
        if(slotName === undefined) return
        if(slotName.split(" ")[1] === itemType){
            chld.innerHTML = ''

            const charState = getCharState()
            charState.items.forEach(itm => {
                if(itm.itemType === itemType){
                    itm.equiped = false
                }
            })
        }
    })

    // no sword in hand, no more mining - drop back to idle same as walking away from the ore
    if(itemType === "weapon" && getCharState().mode === "minning") setCharStateMode("idle")

    openUpdateInventory(false)
    closeItemInfo()
}
export function closeItemInfo(){
    itemInfoCont.style.display = "none"
}
export function enableDisableInfoBtns(_willClose, _timeOut){
    setPointerClickable(equipOrOpenBtn, _willClose ? "none" : "visible", _timeOut)
}
export function showItemInfo(_itemDet){
    if(_itemDet.itemCateg === "quest"){
        showGuildQuest(_itemDet.questDetail, true, _itemDet)
        return
    }
    const {itemCateg, itemType, weaponType, name, dn, desc} = _itemDet
    itemInfoCont.style.display = "flex"

    itemImg.src = `./images/items/${itemCateg}/${name}.webp`

    itemTtle.innerHTML = dn

    // equipables show their combat stats instead of flavor text - most of
    // them don't even have a desc set (see helmetItem etc. in questions.js)
    const isEquipable = itemCateg === "equipable"
    itemDesc.style.display = isEquipable ? "none" : "block"
    itemStatsCont.style.display = isEquipable ? "flex" : "none"
    itemDesc.innerHTML = desc || ''

    if(isEquipable){
        const isArmorType = ARMOR_TYPES.includes(itemType)
        defRow.style.display = isArmorType ? "flex" : "none"
        resistanceRow.style.display = isArmorType ? "flex" : "none"
        dmgRow.style.display = itemType === "weapon" ? "flex" : "none"

        if(isArmorType){
            itemDefValue.innerHTML = _itemDet.equipAbilities.def
            itemResistanceValue.innerHTML = _itemDet.equipAbilities.resistance
        }
        if(itemType === "weapon"){
            itemDmgValue.innerHTML = _itemDet.equipAbilities.dmg
            itemImg.src = `./images/items/${itemCateg}/${weaponType}.webp`
        }

        MATERIAL_ROWS.forEach(({ part, row, value }) => {
            const materialName = _itemDet.parts?.[`${part}Color`]
            row.style.display = materialName ? "flex" : "none"
            if(materialName) value.innerHTML = capitalize(materialName)
        })

        if(_itemDet.durability){
            durabilityRow.style.display = "flex"
            const percent = (_itemDet.durability.current / _itemDet.durability.max) * 100
            itemDurabilityBar.style.width = `${percent}%`
            itemDurabilityBar.classList.toggle("low", percent <= DURABILITY_LOW_THRESHOLD * 100)
        }else{
            durabilityRow.style.display = "none"
        }
    }

    itemDetail = _itemDet
    if(_itemDet.qnty > 1){
        itemQnty.style.display="block"
        itemQnty.innerHTML = `x${_itemDet.qnty}`
    }else itemQnty.style.display="none"

    equipOrOpenBtn.style.display = "none"
    switch(_itemDet.itemCateg){
        case "equipable":
            equipOrOpenBtn.style.display = "block"
            activateFunc = equipItemFunc
            equipOrOpenBtn.innerHTML = "equip"
        break
        case "keys":
            equipOrOpenBtn.style.display = "block"
            // activateFunc = emitAddGateFunc
            equipOrOpenBtn.innerHTML = "open"
        break
        case "consumable":
            equipOrOpenBtn.style.display = "block"
            activateFunc = consumeItemFunc
            equipOrOpenBtn.innerHTML = "consume"
        break
    }

    if(_itemDet.itemType === "weapon" && _itemDet.enhancedLevel > 0){
        slotBx.style.display = "flex"
        slotBx.innerHTML = ''
        _itemDet.slots.forEach(cre => {
            const coreImg = createElement('img', 'slotcore-img')
            coreImg.src = `./images/items/crafting/${cre.name}.webp`

            slotBx.append(coreImg)
        })
    }else slotBx.style.display = "none"
}
export function openClaimableItems(_claimableItems){
    claimContainer.style.display="flex"
    claimContainer.innerHTML=''
    // getAllSounds().notif2S.play()
    _claimableItems.forEach(itm=>{
        const bx = createElement('div', 'claim-bx')
        const imgBxTag = createElement('div', 'img-bx')

        const imgBorder = createElement('img', 'img-border')
        imgBorder.src="./images/UI/border.png"
        const itmImgTag = createElement('img', 'item-img')
        itmImgTag.src=`./images/items/${itm.itemCateg}/${itm.name}.png`
    
        const itemTagName = createElement('p', 'item-ttle', itm.dn)

        imgBxTag.append(imgBorder)
        imgBxTag.append(itmImgTag)
        bx.append(imgBxTag)
        bx.append(itemTagName)

        claimContainer.append(bx)

        bx.addEventListener('click', async ()=>{
            setPointerClickable(bx, "none")
            // getAllSounds().pickItemS.play()
            await obtain(itm)    
            claimContainer.style.display="none"
            claimContainer.innerHTML=''        
        })
    })
}

export function removeItem(_invItem, updateDetailOnline){
    const charState = getCharState()
    const itemToRemove = charState.items.find(itm => itm.itemId === _invItem.itemId)
    if(!itemToRemove) return
    
    charState.items = charState.items.filter(itm => itm.itemId !== _invItem.itemId)

    if(updateDetailOnline){
        updateMyDetailsOL(charState, checkIfTokenSaved()).then( result => {
        })
    }
}
equipOrOpenBtn.addEventListener("click", () => activateFunc())
armorybx.addEventListener("click", e => {
    const className = e.target.className;
    const state = getCharState()
    const myChar = getPlayersOnScene().find(pl => pl.owner === state.owner)
    if(!myChar) return
    if(className && className.split(" ")[0] === "eqpd-slot"){
        const itemType = className.split(" ")[1] //weapon //boots// belt // armor
        if(!itemType) return console.log("category undefined");

        unEquip(itemType)
        const isMultiplayerZone = getIsSocketOn()
        if(isMultiplayerZone){
            const socket = getSocket()
            socket.emit("emitUnEquip", 
                { 
                    ownerId: state.owner, 
                    itemType,
                    currentPlaceId: state.currentPlace.placeId
                })
        }else{
            myChar.unEquip(itemType)
        }
        // switch(categname){
        //     case "weapon":
        //         const state = getCharState()
        //         state.items.forEach(item => {
        //             console.log(item)
        //             if(item.equiped) console.log(item)
        //             // console.log(item.isEquiped)
        //         })
        //     break
        // }
    }
})
