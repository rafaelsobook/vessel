import { showItemInfo } from "./itemInfoSystem.js"
import { closeInventory, openUpdateInventory } from "./inventory.js"
import { openOrCloseStats } from "./statsSystem.js"
import { getCharState, getTotal, setCanPress, getCanPress, setCharStateMode, updateSP_UI } from "./characterstate.js"
import { getIsSocketOn } from "../sockets/worldsocket.js"
import { emitAttack, emitMode, emitMyLoc } from "../sockets/emits.js"
import { attack, calcDmg, getAttackInfo } from "./attackingSystem.js"
import { positionAtkCollider } from "./createMyCharacter.js"
import { getAllSounds, playSound } from "../components/soundSystem.js"
import { openClosePopup, popStatusEffect } from "../tools/popupUI.js"
import { getGameStatus } from "../main/main.js"
import { openCloseSkills } from "../components/skillsui.js"
import { getIsGrounded, getPlayerMode, forceStopMovement } from "../controllers/inputMovement.js"
import { showHideOutputSliders, toggleDisableOutputSliders } from "./outputSliders.js"
import { openCloseChatContainer, hideShowChatToggleBtn } from "../components/worldChatSystem.js"


const lifeManaStamCont  = document.querySelector(".simple-details-gui")
const menuBtns       = document.querySelectorAll(".menu-btns")
const walkRunBtns       = document.querySelectorAll(".walkrun-btns")
const conts       = document.querySelectorAll(".cont")
const itemSlotList   = document.querySelector(".slots-list")
const inventoryCont  = document.querySelector(".inventory-container")
const wakeUpBtn      = document.querySelector(".wake-up-btn")

// RESTING - player.mode "resting" (see skillsData.js-style mode gating
// throughout this game: renderer.js's own switch drives the "structed"
// clip off it, tcp/index.ts's "emitMode" handler just stores/rebroadcasts
// it like any other mode). While resting, canPress is false - every other
// input path (keyboard/joystick movement in inputMovement.js, this file's
// own walkRunBtns click handler below, skillsui.js's skill-slot clicks)
// already gates on getCanPress()/checks it here, so the ONLY thing still
// reachable is wakeUpBtn's own click handler further below, which isn't
// gated at all.
export function startResting(){
    const charState = getCharState()
    if(!charState) return
    if(charState.mode === "resting") return
    const weapon = charState.items.find(itm => itm.itemType === "weapon" && itm.equiped)

    // BEFORE setCanPress(false) - forceStopMovement's own comment covers
    // why: a movement key still physically down at this exact instant
    // would otherwise never get a clean release (canPress swallows the
    // keyup that would've handled it), leaving stale input/velocity and no
    // emitStop() ever reaching other clients
    forceStopMovement()

    setCharStateMode("resting")
    if(getIsSocketOn()) emitMode("resting", weapon?.name)
    setCanPress(false)
    hideShowAllScreenUI(false)
    if(wakeUpBtn) wakeUpBtn.style.display = "block"
}
export function stopResting(){
    const charState = getCharState()
    if(!charState) return
    if(charState.mode !== "resting") return
    const weapon = charState.items.find(itm => itm.itemType === "weapon" && itm.equiped)

    setCharStateMode("idle")
    if(getIsSocketOn()) emitMode("idle", weapon?.name)
    setCanPress(true)
    hideShowAllScreenUI(true)
    if(wakeUpBtn) wakeUpBtn.style.display = "none"
}

let buttonsActivated = false
let canChangeMode = true
export function setCanChangeMode(_canChangeMode){
    canChangeMode = _canChangeMode
}

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
    showHideIcons(_isVisible ?  "block" : "none")
    disableEnableAttackButtonsContainer(_isVisible, !_isVisible)
    openCloseLifeDisplay(_isVisible)
    openCloseChatContainer(_isVisible)
    showHideOutputSliders(_isVisible ? "flex" : "none")
    hideShowChatToggleBtn(!_isVisible)
}
export function openCloseLifeDisplay(_isVisible){
    lifeManaStamCont.style.display = _isVisible ? "block":"none"
}
export function activateBtnOnce(){
    if(buttonsActivated) return
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
                case 'skills':
                    openCloseSkills()
                break
            }
        }) 
    })
    let clickedTimeOut
    let swordAnimNum = 1
    walkRunBtns.forEach(iconBtn => {
        iconBtn.addEventListener("click", e => {
            if(getGameStatus() === "gameover" || getGameStatus() === "loading") return
            // resting (see startResting/stopResting above) - canPress is
            // already what every raw movement input path gates on
            // (inputMovement.js), this is the same gate extended to these
            // buttons too, so attack/cast/walk/running/rest are all
            // unreachable while resting - only wakeUpBtn's own untouched
            // handler further below can end it
            if(!getCanPress()) return
            const btnName = e.target.className.split(" ")[1]
            const isSocketOn = getIsSocketOn()
            
            disableEnableWalkRunButtons(false)

            const charState = getCharState()
            if(!charState) return
            const attackInfo = getAttackInfo()
            const weapon = charState.items.find(itm => itm.itemType === "weapon" && itm.equiped)
            const currentMode = charState.mode

            console.log("currentMode ", currentMode)
            const plMode = getPlayerMode()
            clickedTimeOut = setTimeout(() => {
                disableEnableWalkRunButtons(true)
            }, 500)
            // attack is allowed through even while airborne - everything
            // else (walk/running/cast) still can't change mode mid-jump.
            // case "attack" below already has its own dedicated air-attack
            // clip (equippedWeaponType + "attackair") wired up for exactly
            // this - it was just unreachable before, since this early
            // return happens before the switch ever runs.
            if(plMode === "inAir" && btnName !== "attack") return console.log("cannot change mode while inAir")

            
            clearTimeout(clickedTimeOut)
            switch(btnName){
                case "walk":
                    if(canChangeMode){
                        setCharStateMode("idle")
                    
                    
                        if(isSocketOn) emitMode("idle", attackInfo.hasWeapon)
                    }
                    clickedTimeOut = setTimeout(() => {
                        disableEnableWalkRunButtons(true)
                    }, 500)
                    // inventoryCont.style.display === "none" ? openUpdateInventory(true) : closeInventory()
                break
                case "running":  
                    if(canChangeMode){
                        setCharStateMode("fighting")
                        
                        if(isSocketOn) emitMode("fighting", attackInfo.hasWeapon)
                    }

                //    openOrCloseStats()
                    clickedTimeOut = setTimeout(() => {
                        disableEnableWalkRunButtons(true)
                    }, 100)
                break
                case "attack":
                    if(currentMode === "idle"){
                        setCharStateMode("fighting")
                        clickedTimeOut = setTimeout(() => {
                            disableEnableWalkRunButtons(true)
                        }, 500)
                        return
                    }
                    const dmgDetails = calcDmg(charState)

                    const spToDeduct = (dmgDetails.physicalDmg/2) + (dmgDetails.weaponDmg/4)
                    clickedTimeOut = setTimeout(() => {
                        disableEnableWalkRunButtons(true)
                    },swordAnimNum === 1 ? 400: 800)
                    if(getTotal().sp < spToDeduct) {
                        // openClosePopup("no stamina", true, 1000)
                        popStatusEffect("no stamina", "yellow")
                        console.log("physical damage ", dmgDetails.physicalDmg)
                        console.log("weapon damage ", dmgDetails.weaponDmg)
                        return console.log("not enough sp")
                    }
                    
                    // charState.sp -= spToDeduct
                    updateSP_UI()
                    
                    getAllSounds().voiceAttackS?.setPlaybackRate(0.9 + (Math.random()*0.2))
                    getAllSounds().voiceAttackS?.play()
                    
                    let animName = 'kick1'
                    let equippedWeaponType = null
                    charState.items.forEach(itm => {
                        if (itm.itemType === "weapon" && itm.equiped) {
                            equippedWeaponType = itm.weaponType
                            animName = `${itm.weaponType}attack${swordAnimNum}`
                        }
                    })

                    // airborne + weapon equipped uses the dedicated air-attack
                    // clip instead of the normal grounded combo (no alternating
                    // swordAnimNum for this one - there's only one air-attack
                    // anim). "swordattackair" for weaponType "sword" - no
                    // underscore/number, unlike the grounded combo's own
                    // "swordattack1"/"swordattack2" naming.
                    if(equippedWeaponType && !getIsGrounded()){
                        animName = `${equippedWeaponType}attackair`
                    }

                    swordAnimNum = swordAnimNum === 1 ? 2 : 1

                    

                    if(attackInfo.weaponType) playSound(getAllSounds().swordWhooshS)
                    
                    if(isSocketOn){
                        emitAttack(attackInfo, animName)
                    }else{
                        attack(attackInfo, animName)
                    } 
                    positionAtkCollider({ reach: 1})

                break
                case "cast":
                    clickedTimeOut = setTimeout(() => {
                        disableEnableWalkRunButtons(true)
                    }, 100)
                    if(!canChangeMode) break
                    if(currentMode === "casting"){
                        setCharStateMode("idle")
                        if(isSocketOn) emitMode("idle", attackInfo.hasWeapon)
                    } else {
                        // mana drain itself lives in characterstate.js's
                        // castingDrainInterval (-1/500ms while mode is
                        // "casting") - this is just the entry gate so you
                        // can't start a cast already sitting at 0
                        if(getTotal().mp <= 0){
                            popStatusEffect("no mana", "yellow")
                            break
                        }
                        setCharStateMode("casting")
                        if(isSocketOn) emitMode("casting", attackInfo.hasWeapon)
                    }

                break
                case "rest":
                    clickedTimeOut = setTimeout(() => {
                        disableEnableWalkRunButtons(true)
                    }, 100)
                    if(!canChangeMode) break
                    startResting()
                break
                case "throw":
                    // if(this.myChar.mode !== "weapon") return this._statPopUp("You must hold a weapon")
                    // closeGameUI()
                    // this.stopPress()
                    // this.myChar.mode = "noneweapon"
                    // this.stopAnim(this.myChar.anims, "running", true)
                    // this.playAnim(this.myChar.anims, "throw")

                    // const myCurSword = this.myChar.swordz.find(swrd => swrd.name.split(".")[1] === this.det.weapon.name)
                    // if(!myCurSword) return
                    // const weaponDetail = this.det.items.find(itm => itm.meshId === this.det.weapon.meshId)
                    // if(!weaponDetail) return
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
    // wake up from resting - deliberately NOT gated by getCanPress() (it's
    // false the entire time we're resting - this is the one control meant
    // to still work)
    wakeUpBtn?.addEventListener("click", () => {
        stopResting()
    })

    document.addEventListener("keyup", e => {
        if(e.key === " "){
        }
    })
    itemSlotList.addEventListener("click", e => {
        const btnName = e.target.className
        if(!btnName || !btnName.includes("slot-btn")) return

        const itemClickedId = btnName.split(" ")[1]
        let myItem = getCharState().items.find(itm => itm.itemId === itemClickedId)
        // if(!myItem) { // if not in my database maybe in my nftz collection
        //     myItem = myNftz.find(itm => itm.itemId === itemClickedId)
        // }
        if(!myItem) return
        showItemInfo(myItem)
        // getAllSounds().pickItemS.play()
    })
    buttonsActivated = true
}


// Spam-click debounce for the walk/run/attack/cast icon buttons themselves
// (briefly disabled right after a press while their own action/animation is
// still playing) - deliberately only touches .walk-run-icons-container, not
// .skill-slots. disableEnableAttackButtonsContainer below toggles BOTH,
// which meant pressing "cast" then immediately clicking a skill-slot-button
// within that same ~100ms debounce window did nothing at all - the
// container's own .disabled class sets pointer-events: none, silently
// swallowing the click - and the skill only activated on a SECOND press once
// the debounce had cleared. Used only for the walkRunBtns click handler's
// own internal debounce, further down in this file; every other caller of
// disableEnableAttackButtonsContainer (npc dialogue, scene setup, respawn,
// etc.) genuinely wants skill-slots hidden/disabled too and is unaffected.
function disableEnableWalkRunButtons(enable){
    const container = document.querySelector(".walk-run-icons-container")
    if(!container) return
    container.classList.toggle("disabled", !enable)
}

export function disableEnableAttackButtonsContainer(enable, hide = false){
    const container = document.querySelector(".walk-run-icons-container")
    const skillSlotContainer = document.querySelector(".skill-slots")
    if (!container) return  // guard in case element doesn't exist
    if (!skillSlotContainer) return  // guard in case element doesn't exist
    container.style.display = "block"
    skillSlotContainer.style.display = "flex"
    showHideOutputSliders("flex")
    container.classList.toggle("disabled", !enable)
    skillSlotContainer.classList.toggle("disabled", !enable)
    toggleDisableOutputSliders(enable)
    if(hide){
        container.style.display = "none"
        skillSlotContainer.style.display = "none"
        showHideOutputSliders("none")
    }
}