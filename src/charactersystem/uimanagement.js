import { showItemInfo } from "./itemInfoSystem.js"
import { closeInventory, openUpdateInventory } from "./inventory.js"
import { openOrCloseStats } from "./statsSystem.js"
import { getCharState, setCanPress, setCharStateMode } from "./characterstate.js"
import { getIsSocketOn } from "../sockets/worldsocket.js"
import { emitAttack, emitMyLoc } from "../sockets/emits.js"
import { attack, getAttackInfo } from "./attackingSystem.js"
import { positionAtkCollider } from "./createMyCharacter.js"


const lifeManaStamCont  = document.querySelector(".simple-details-gui")
const menuBtns       = document.querySelectorAll(".menu-btns")
const walkRunBtns       = document.querySelectorAll(".walkrun-btns")
const conts       = document.querySelectorAll(".cont")
const itemSlotList   = document.querySelector(".slots-list")
const inventoryCont  = document.querySelector(".inventory-container")

let buttonsActivated = false

const log = console.log

export function showHideIcons(display = "none", arrayOfIconNames = ['icons-container', 'walk-run-icons-container']){
    // arrayOfIconNames ['.icons-container', '.walk-run-icons-container']
    arrayOfIconNames.forEach(className => {
        document.querySelector(`.${className}`).style.display = display
    })
}

export function closeAllPopupAndUI(){
    closeInventory()
}
export function hideShowAllScreenUI(_isVisible = false){
    console.log(_isVisible)
    showHideIcons(_isVisible ?  "block" : "none")
    disableEnableAttackButtonsContainer(false, !_isVisible)
    openCloseLifeDisplay(_isVisible)
}
export function openCloseLifeDisplay(_isVisible){
    lifeManaStamCont.style.display = _isVisible ? "block":"none"
}
export function activateBtnOnce(){
    if(buttonsActivated) return console.log("Buttons are already activated")
    menuBtns.forEach(iconBtn => {
        iconBtn.addEventListener("click", e => {
            const btnName = e.target.className.split(" ")[3]
            
            switch(btnName){
                case "inventory":
                    inventoryCont.style.display === "none" ? openUpdateInventory(true) : closeInventory()
                break
                case "stats":           
                   openOrCloseStats()
                break
                case 'enhance':
                    // openCloseEnhanceSystem(true)
                break
            }
        }) 
    })
    let clickedTimeOut
    walkRunBtns.forEach(iconBtn => {
        iconBtn.addEventListener("click", e => {
            const btnName = e.target.className.split(" ")[1]
            const isSocketOn = getIsSocketOn()
            
            disableEnableAttackButtonsContainer(false)

            switch(btnName){
                case "walk":
                    setCharStateMode("idle")
                    if(isSocketOn) emitMyLoc("idle")
                    clickedTimeOut = setTimeout(() => {
                        disableEnableAttackButtonsContainer(true)
                    }, 500)
                    // inventoryCont.style.display === "none" ? openUpdateInventory(true) : closeInventory()
                break
                case "running":       
                    setCharStateMode("fighting")
                    if(isSocketOn) emitMyLoc("fighting")
                //    openOrCloseStats()
                    clickedTimeOut = setTimeout(() => {
                        disableEnableAttackButtonsContainer(true)
                    }, 100)
                break
                case "attack":
                    console.log("ATTACK !!!")
                    const charState = getCharState()
                    if(!charState) return
                    let weaponType = ""
                    let attackAnimName = ""
                    charState.items.find(itm=>{
                        if(itm.itemType === "weapon" && itm.equiped) weaponType = itm.weaponType
                    })

                    if(weaponType) attackAnimName = `${weaponType}attack1`

                    if(isSocketOn){
                        console.log("attack socket on")
                        emitAttack(attackAnimName)
                    }else{
                        console.log("attack socket off")
                        attack(getAttackInfo())
                    } 
                    positionAtkCollider({ reach: 1})
                    clickedTimeOut = setTimeout(() => {
                        disableEnableAttackButtonsContainer(true)
                    }, 900)
                break
                case "throw":
                    // if(this.myChar.mode !== "weapon") return this._statPopUp("You must hold a weapon")
                    // closeGameUI()
                    // this.stopPress()
                    // this.myChar.mode = "noneweapon"
                    // this.stopAnim(this.myChar.anims, "running", true)
                    // this.playAnim(this.myChar.anims, "throw")

                    // const myCurSword = this.myChar.swordz.find(swrd => swrd.name.split(".")[1] === this.det.weapon.name)
                    // if(!myCurSword) return log("current sword not found")
                    // const weaponDetail = this.det.items.find(itm => itm.meshId === this.det.weapon.meshId)
                    // if(!weaponDetail) return log("weapon not found")
                    // myCurSword.addRotation(Math.PI,0,0)
                    // log("cur sowrd " + myCurSword )
                    // if(this.socketAvailable) this.socket.emit("action-willthrow", {_id:this.det._id, weaponName: this.det.weapon.name})
                    
                    // setTimeout(() => this.myChar.whoopS.play(), 900)
                    // setTimeout( async () => {
                    //     const infrontPos = this.getMyPos(this.myChar.bx, 1)
                    //     const infrontPosX2 = this.getMyPos(this.myChar.bx, 3)
                    //     let myDmg = this.recalMeeleDmg()
                    //     myDmg = myDmg * 5
                    //     log('damage of spear ' + myDmg)
                    //     const myPpos = this.myChar.bx.position
                    //     if(this.socketAvailable){
                    //         this.socket.emit("will-throw", { _id: this.det._id, myFosNow: {x: myPpos.x, z: myPpos.z} , mode:this.myChar.mode, dmg: myDmg, frontPos: {x:infrontPos.x,z:infrontPos.z}, dirTa: { x: infrontPosX2.x,z:infrontPosX2.z}, weaponDetail, curPlace: this.currentPlace})
                    //     }else{
                    //         this.createFlyingWeapon(this.myChar.bx.position, myDmg, this.myChar.mode, myCurSword, infrontPos, infrontPosX2, weaponDetail, this.det._id)
                    //         this.hideAllSword(this.myChar.swordz)
                    //         this.keepSword(this.myChar.rootSword, this.myChar.rootBone)
                    //     }
                    //     setTimeout(() => this.setMode("fist"), 400)
                    //     // this.myChar.swordz = this.myChar.swordz.filter(swrd => swrd.name.split(".")[1] !== this.det.weapon.name)
                    //     const theItem = this.det.items.find(itm => itm.meshId === this.det.weapon.meshId)
                    //     await this.deductItem(theItem.meshId)
                    //     this.det.weapon.name = "none"
                    //     this.det.weapon.meshId = "none"
                    //     this.changeAtkBtnImg()
                    //     await this.updateMyDetailsOL(this.det, true)
                    //     openGameUI()
                    //     this.allCanPress()
                    //     myCurSword.addRotation(-Math.PI,0,0)
                    // },950)
                break
            }


        }) 
    })
    // all close buttons
    const closeBtns = document.querySelectorAll(".close-parent")
    closeBtns.forEach(btn => {
        btn.addEventListener("click", e=> {
            e.target.parentElement.style.display="none"
        })
    })

    document.addEventListener("keyup", e => {
        if(e.key === " "){
            console.log(getCharState())
        }
    })
    itemSlotList.addEventListener("click", e => {
        log(e.target.className)
        const btnName = e.target.className
        if(!btnName || !btnName.includes("slot-btn")) return log('not an item clicked')

        const itemClickedId = btnName.split(" ")[1]
        let myItem = getCharState().items.find(itm => itm.itemId === itemClickedId)
        // if(!myItem) { // if not in my database maybe in my nftz collection
        //     myItem = myNftz.find(itm => itm.itemId === itemClickedId)
        // }
        if(!myItem) return log("item not found in database or in Nftz")
        console.log(myItem)
        showItemInfo(myItem)
        // getAllSounds().pickItemS.play()
    })
    buttonsActivated = true
}


export function disableEnableAttackButtonsContainer(enable, hide = false){
    const container = document.querySelector(".walk-run-icons-container")
    if (!container) return  // guard in case element doesn't exist
    container.style.display = "block"
    container.classList.toggle("disabled", !enable)
    if(hide){
        container.style.display = "none"
    }
}