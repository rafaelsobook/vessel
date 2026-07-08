import { createElement } from "../tools/GUITools.js"
import { openCloseMiniLS, openClosePopup } from "../tools/popupUI.js"
import { checkIfTokenSaved, randomNum, setDisplayALl, setDisplayOfElements, setPointerClickable, useFetch } from "../tools/tools.js"
import { getCharState, updateHunger, updateMyDetailsOL } from "./characterstate.js"
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


const itemInfoCont = document.querySelector(".item-info-cont")
const itemImg = document.querySelector(".itemInfoImg")
const itemTtle = document.querySelector(".iteminfoTtle")
const slotBx = document.querySelector(".slots-bx")
const itemQnty = document.querySelector(".item-qnty")
const itemDesc = document.querySelector(".item-desc")
const itemPrice = document.querySelector(".item-selling-price")

const claimContainer = document.querySelector(".claim-container")

const sellItemBtn = document.getElementById("sellItemBtn")
const equipOrOpenBtn = document.getElementById("equipItemBtn")
const listNftBtn = document.getElementById("listNftBtn")
const inpNft = document.getElementById("inpNft")
// const weaponAccessoryList = document.querySelector(".weapon-accessory")
const weaponAccessoryList = document.querySelectorAll(".eqpd-slot")

const armorybx = document.querySelector(".armory-bx")


let itemDetail= undefined
let sellItemFunc = async () => {
    if(!itemDetail) return
    const charState = getCharState()
    if(!itemDetail.price) return
    if(itemDetail.itemCateg === "equipable"){
        charState.assets.krit += itemDetail.price
    }else{
        for(var i = 0;i<=itemDetail.qnty;i++){
            // charState.coins += itemDetail.price
            charState.assets.krit += itemDetail.price
        }
    }
    charState.items = charState.items.filter(itm => itm.itemId !== itemDetail.itemId)

    // getAllSounds().coinReceivedS.play()
    await updateMyDetailsOL(charState, checkIfTokenSaved())
    openUpdateInventory(true)
}
let activateFunc = () => {
    
}
// functionalities for activateFunc and listNftFunc
let listingThisItem = async () => {
    if(!itemDetail) return
    closeItemInfo()
    enableDisableInfoBtns(true)
    const charState = getCharState()    
    // const isSuccess = await uploadToIpfs(`./images/items/${itemDetail.itemCateg}/${itemDetail.name}.png`, itemDetail)
    // if(isSuccess){
    //     // delete item
    //     charState.items = charState.items.filter(itm => itm.itemId !== itemDetail.itemId)
    //     await updateMyDetailsOL(charState, checkIfTokenSaved())
    // }
    enableDisableInfoBtns(false)
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
    openUpdateInventory(false)
    closeItemInfo()
}
export function closeItemInfo(){
    itemInfoCont.style.display = "none"
}
export function enableDisableInfoBtns(_willClose, _timeOut){    
    setPointerClickable(sellItemBtn, _willClose ? "none" : "visible", _timeOut)
    setPointerClickable(equipOrOpenBtn, _willClose ? "none" : "visible", _timeOut)
    setPointerClickable(listNftBtn, _willClose ? "none" : "visible", _timeOut)
}
export function showItemInfo(_itemDet){
    const {itemCateg, name, dn, price, desc} = _itemDet
    itemInfoCont.style.display = "flex"

    itemImg.src = `./images/items/${itemCateg}/${name}.webp`

    itemTtle.innerHTML = dn
    itemPrice.innerHTML = `x${price}`
    itemDesc.innerHTML = desc

    itemDetail = _itemDet 
    if(_itemDet.qnty > 1){ 
        itemQnty.style.display="block"
        itemQnty.innerHTML = `x${_itemDet.qnty}`
    }else itemQnty.style.display="none"

    let infoContBtns = [equipOrOpenBtn,listNftBtn,inpNft]
    setDisplayOfElements(infoContBtns, "none")
    switch(_itemDet.rarity){
        case "rare":
            infoContBtns = [equipOrOpenBtn,listNftBtn,inpNft]
        break;
        default:
            infoContBtns = [equipOrOpenBtn]
        break
    }
    switch(_itemDet.itemCateg){
        case "equipable":
            setDisplayOfElements(infoContBtns, "block")
            activateFunc = equipItemFunc
            equipOrOpenBtn.innerHTML = "equip"
        break
        case "keys":
            setDisplayOfElements(infoContBtns, "block")
            // activateFunc = emitAddGateFunc
            equipOrOpenBtn.innerHTML = "open"
        break
        case "consumable":
            setDisplayOfElements(infoContBtns, "block")
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
sellItemBtn.addEventListener("click", () => sellItemFunc())
equipOrOpenBtn.addEventListener("click", () => activateFunc())
listNftBtn.addEventListener("click", () => listingThisItem())
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
