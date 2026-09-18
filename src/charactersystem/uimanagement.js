import { showItemInfo, unEquip } from "./itemInfoSystem.js"
import { closeInventory, openUpdateInventory } from "./inventory.js"
import { openOrCloseStats } from "./statsSystem.js"
import { getCharState, getTotal, setCanPress, getCanPress, setCharStateMode, updateSP_UI, updateMyDetailsOL } from "./characterstate.js"
import { getIsSocketOn, getPlayersOnScene } from "../sockets/worldsocket.js"
import { getSceneDet } from "../main/main.js"
import { spawnProjectile } from "../creations/skills.js"
import { Vector3 } from "@babylonjs/core"
import { emitAttack, emitMode, emitMyLoc, emitThrowSpear } from "../sockets/emits.js"
import { getSocket } from "../sockets/joinsocket.js"
import { checkIfTokenSaved } from "../tools/tools.js"
import { attack, calcDmg, getAttackInfo } from "./attackingSystem.js"
import { positionAtkCollider } from "./createMyCharacter.js"
import { getAllSounds, playSound } from "../components/soundSystem.js"
import { openClosePopup, popStatusEffect } from "../tools/popupUI.js"
import { getGameStatus } from "../main/main.js"
import { openCloseSkills } from "../components/skillsui.js"
import { getIsGrounded, getIsMoving, getPlayerMode, forceStopMovement } from "../controllers/inputMovement.js"
import { showHideOutputSliders, toggleDisableOutputSliders } from "./outputSliders.js"
import { openCloseChatContainer, hideShowChatToggleBtn } from "../components/worldChatSystem.js"
import { updateStoryQuestUI } from "./storyQuestSystem.js"
import { openCloseCampcraftUI } from "../components/campcraft.js"


const lifeManaStamCont  = document.querySelector(".simple-details-gui")
const menuBtns       = document.querySelectorAll(".menu-btns")
const walkRunBtns       = document.querySelectorAll(".walkrun-btns")
const conts       = document.querySelectorAll(".cont")
const itemSlotList   = document.querySelector(".slots-list")
const inventoryCont  = document.querySelector(".inventory-container")
const storyNotifCont = document.querySelector(".story-notif-container")
const throwBtn       = document.querySelector(".walkrun-btns.throw")

// THROW BUTTON - spear-only basic action (style.scss's own .throw rule
// already ships with display:none baked in, waiting for exactly this).
// Visible only while a spear is actually equipped, hidden the rest of the
// time - called once at startup (activateBtnOnce below, so it starts
// correct for whatever's already equipped when the scene first loads) and
// again from itemInfoSystem.js's equipItemFunc/unequipItemFunc whenever
// the equipped weapon actually changes, since those are the only two
// places a weapon's own `equiped` flag flips.
export function updateThrowButtonVisibility(){
    if(!throwBtn) return
    const charState = getCharState()
    const hasSpearEquipped = !!charState?.items?.some(itm => itm.itemType === "weapon" && itm.equiped && itm.weaponType === "spear")
    throwBtn.style.display = hasSpearEquipped ? "block" : "none"
}

// the actual projectile release - called from case "throw" below once the
// "spearthrow" clip is 90% through (see that block's own comment on the
// timing). Spawns a real flying copy of whatever spear is currently
// equipped (creations/skills.js's spawnProjectile, now weaponType-aware
// instead of hardcoded to always render a sword) from roughly hand
// height, flying the same direction the player's currently facing.
//
// A real disarm now, not a disposable visual copy - throwing your spear
// actually costs you it, same as a real one would (supersedes the earlier
// "should throwing cost you your weapon" design call). Deals no damage
// yet though (spawnProjectile's own enemy-hit branch is visual-only by
// design, matching every other caller of it) - that's still a separate
// step on top of this. Multiplayer-visible - emitThrowSpear relays the
// flying projectile, and emitUnEquip (below) relays the disarm itself, to
// every other client.
function throwSpearProjectile(myChar, charState){
    if(!myChar?.body) return
    const spear = charState.items.find(itm => itm.itemType === "weapon" && itm.equiped && itm.weaponType === "spear")
    if(!spear) return

    
    playSound(getAllSounds().throwSpearS)

    const pos = myChar.body.position
    const forward = myChar.body.getDirection(Vector3.Forward())
    // roughly hand/shoulder height, not the capsule's own center - a flat
    // throw straight out along the facing direction
    const spawnPos = { x: pos.x, y: pos.y + 1, z: pos.z }
    const targetPos = { x: pos.x + forward.x, y: pos.y + 1, z: pos.z + forward.z }

    // captured NOW, with the spear still actually equipped - calcDmg reads
    // charState.items for the currently-equipped weapon (weaponDmg/
    // equipAbilities.dmg included), and a few lines down this same spear
    // gets unequipped AND filtered out of charState.items entirely. Passing
    // this snapshot into spawnProjectile (instead of letting it recompute
    // calcDmg at hit time, whenever that ends up being) is what makes the
    // thrown spear actually deal real spear damage instead of silently
    // falling back to bare-fisted damage once it lands.
    const dmgDetails = calcDmg(charState)

    // always spawn locally first - the multiplayer relay (below) is
    // deliberately broadcast-excluding-sender (tcp/index.ts's own
    // "throwspear" handler uses socket.broadcast.emit, not io.emit), same
    // "I already applied it locally, this is just for everyone else
    // watching" pattern circle-spawned/spawncirc already use - so this
    // client's own copy has to come from here, it'll never come back
    // through the socket. dmgDetails is only ever passed on THIS call - the
    // "spear-thrown" relay listener (worldsocket.js) spawns everyone else's
    // own visual-only copy with no dmgDetails at all, so only the actual
    // thrower's own client ever applies real damage, same "I already
    // applied it locally" split every other broadcast-excluding-sender
    // relay in this game already follows.
    //
    // spear itself (the full original item, captured above BEFORE it gets
    // unequipped/filtered out below) is also passed as spawnProjectile's own
    // groundWeaponItem - a miss that lands in natural terrain (ground/chunk/
    // tree) turns into real, permanent ground loot instead of just visually
    // sticking and despawning 3s later. Same broadcast-excluding-sender
    // scoping as dmgDetails just above - the relay listener never passes
    // this, so other clients just see the decorative stick, no race to pick
    // it up.
    spawnProjectile(spawnPos, targetPos, null, getSceneDet().scene, spear.parts, null, 3000, null, false, "spear", dmgDetails, spear)
    if(getIsSocketOn()){
        emitThrowSpear(spawnPos, targetPos, spear.parts)
    }

    // hide it in your own hand - myChar.unEquip (createcharacter.js), not a
    // literal `.isVisible = false` on the weapon mesh directly: swordMeshes'
    // own .mesh is a bare TransformNode with no isVisible of its own (only
    // its CHILD meshes actually render), so unEquip("weapon") -> that
    // file's own showHideSword is what actually hides those children -
    // same helper equipSword/createSword already use for this exact job.

    // myChar.unEquip("weapon")
    // unEquip("weapon")
    // // and actually gone from the bag too - filtered out, not just flipped
    // // to equiped:false, same "this item is genuinely gone now" pattern
    // // itemBroke()/the sell flow (buyorsell.js) already use
    // charState.items = charState.items.filter(itm => itm.itemId !== spear.itemId)

    // updateThrowButtonVisibility()

    // // same emitUnEquip relay itemInfoSystem.js's own unequipItemFunc
    // // already uses - tells the server to drop its own authoritative
    // // equiped flag AND every other client to hide this player's weapon
    // // mesh too (worldsocket.js's "unequiped-item" -> theEquipingPlayer.unEquip)
    // if(getIsSocketOn()){
    //     getSocket()?.emit("emitUnEquip", {
    //         ownerId: charState.owner,
    //         itemType: "weapon",
    //         currentPlaceId: charState.currentPlace.placeId
    //     })
    // }

    updateMyDetailsOL(charState, checkIfTokenSaved()).then(() => {
        openUpdateInventory(false)
    })
}

// RESTING - player.mode "resting" (see skillsData.js-style mode gating
// throughout this game: renderer.js's own switch drives the "structed"
// clip off it, tcp/index.ts's "emitMode" handler just stores/rebroadcasts
// it like any other mode). While resting, canPress is false - every other
// input path (keyboard/joystick movement in inputMovement.js, this file's
// own walkRunBtns click handler below, skillsui.js's skill-slot clicks)
// already gates on getCanPress()/checks it here. There's no dedicated
// "wake up" button anymore - inputMovement.js's own handleKeyDown/
// handleJoystickPointerDown call stopResting() directly the moment a
// movement input actually happens (checked BEFORE their own getCanPress()
// gate, specifically so a movement press can end resting instead of
// silently no-opping against it).
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
    // story-notif-container (storyQuestSystem.js) was missing from this list
    // entirely - every other call site of this function (conversations.js's
    // cutscene dialogue, startResting, etc) hid the rest of the HUD but left
    // the story tracker sitting there on top of a black screen. Hidden the
    // same blunt way as everything else above, but restored via a real
    // re-render (updateStoryQuestUI, not a blind display:block) - that
    // function already hides itself when there's no longer an active quest,
    // so this can't leave a stale/empty tracker box on screen if the one
    // active quest happened to complete while the UI was hidden.
    if(_isVisible) updateStoryQuestUI()
    else if(storyNotifCont) storyNotifCont.style.display = "none"
}
export function openCloseLifeDisplay(_isVisible){
    lifeManaStamCont.style.display = _isVisible ? "block":"none"
}
export function activateBtnOnce(){
    if(buttonsActivated) return
    // starting state - matches whatever's already equipped on this very
    // first scene load, not just whatever's equipped the NEXT time the
    // player opens their inventory and (un)equips something
    updateThrowButtonVisibility()
    menuBtns.forEach(iconBtn => {
        iconBtn.addEventListener("click", e => {
            // these are real <button> elements (index.html) - a mouse click
            // leaves them holding DOM focus, and a focused <button>'s native
            // browser behavior is to re-fire its own click the next time
            // Space/Enter is pressed anywhere, regardless of what else that
            // key is bound to (inputMovement.js's own jump-key comment has
            // the full story). Blurring right after handling this click
            // means nothing is left focused for a later keypress to
            // accidentally reactivate.
            e.target.blur()
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
                case 'campcraft':
                    openCloseCampcraftUI()
                break
            }
        }) 
    })
    let clickedTimeOut
    let swordAnimNum = 1
    walkRunBtns.forEach(iconBtn => {
        iconBtn.addEventListener("click", e => {
            // same reasoning as menuBtns' own blur() above - this is the
            // attack/cast/walk/running/rest group specifically, so this is
            // the fix for "pressing jump [Space] right after attack
            // re-triggers attack": the attack <button> was still focused
            // from the mouse click, and Space's default browser behavior
            // re-clicks whatever <button> currently has focus.
            e.target.blur()
            if(getGameStatus() === "gameover" || getGameStatus() === "loading") return
            // resting (see startResting/stopResting above) - canPress is
            // already what every raw movement input path gates on
            // (inputMovement.js), this is the same gate extended to these
            // buttons too, so attack/cast/walk/running/rest are all
            // unreachable while resting - only an actual movement input
            // (inputMovement.js's own handleKeyDown/handleJoystickPointerDown)
            // can end it now
            if(!getCanPress()) return
            const btnName = e.target.className.split(" ")[1]
            const isSocketOn = getIsSocketOn()
            
            disableEnableWalkRunButtons(false)

            const charState = getCharState()
            if(!charState) return
            const attackInfo = getAttackInfo()
            const weapon = charState.items.find(itm => itm.itemType === "weapon" && itm.equiped)
            const currentMode = charState.mode

            const plMode = getPlayerMode()
            clickedTimeOut = setTimeout(() => {
                disableEnableWalkRunButtons(true)
            }, 500)
            // attack is allowed through even while airborne - everything
            // else (walk/running/cast) still can't change mode mid-jump.
            // case "attack" below already has its own dedicated air-attack
            // clip (equippedWeaponType + "attack_1_air") wired up for exactly
            // this - it was just unreachable before, since this early
            // return happens before the switch ever runs.
            if(plMode === "inAir" && btnName !== "attack") return 

            
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
                        return 
                    }
                    
                    // charState.sp -= spToDeduct
                    updateSP_UI()
                    
                    // getAllSounds().voiceAttackS?.setPlaybackRate(0.9 + (Math.random()*0.2))
                    // getAllSounds().voiceAttackS?.play()
                    
                    // unarmed combo alternates punch1/kick1 - same swordAnimNum
                    // toggle already used for the weapon combo below, reused
                    // here since it flips 1/2 on every attack regardless of
                    // whether a weapon ends up overriding animName next.
                    let animName = swordAnimNum === 1 ? 'punch1' : 'kick1'
                    let equippedWeaponType = null
                    charState.items.forEach(itm => {
                        if (itm.itemType === "weapon" && itm.equiped) {
                            // pickaxe has no animation clips of its own on the
                            // rig (axeattack1/2, axeattack_1_air, running_axe1
                            // are the only ones that actually exist) - it
                            // swings using the exact same clips axe does.
                            // Only the CLIP NAME is aliased here, not
                            // itm.weaponType itself - hit sound
                            // (duelSystem.js's WEAPON_HIT_SOUNDS), the mesh
                            // building (createweapon.js), and attackInfo's
                            // own weaponType below all still correctly see
                            // the real "pickaxe".
                            const animWeaponType = itm.weaponType === "pickaxe" ? "axe" : itm.weaponType
                            equippedWeaponType = animWeaponType
                            animName = `${animWeaponType}attack${swordAnimNum}`
                        }
                    })

                    // airborne + weapon equipped uses the dedicated air-attack
                    // clip instead of the normal grounded combo (no alternating
                    // swordAnimNum for this one - there's only one air-attack
                    // anim). Real clip name confirmed as "swordattack_1_air"
                    // for weaponType "sword" (the previous "swordattackair"
                    // guess here never matched anything on the rig, so this
                    // branch silently never played at all) - "_1_" in the
                    // middle, unlike the grounded combo's own plain
                    // "swordattack1"/"swordattack2" naming.
                    // captured once, reused both for picking the clip below
                    // AND for telling positionAtkCollider to widen its own
                    // reach for this swing (see its own isRunningAttack
                    // comment - a running swing covers more ground than a
                    // stationary one, the collider's fixed default depth
                    // was too short to still catch the target in time)
                    const isRunningAttack = !!(equippedWeaponType && getIsGrounded() && getIsMoving())

                    // air-attack and running-attack clips only exist for
                    // weaponType "sword" on the rig (swordattack_1_air,
                    // running_sword1) - axe/pickaxe have no dedicated
                    // versions of either, so BOTH alias to "sword" for just
                    // these two special clips. Their own grounded combo
                    // (animName above) is untouched by this - it already
                    // correctly plays axeattack1/2 via equippedWeaponType's
                    // own pickaxe->axe alias.
                    const airRunWeaponType = (equippedWeaponType === "axe" || equippedWeaponType === "pickaxe")
                        ? "sword"
                        : equippedWeaponType

                    if(equippedWeaponType && !getIsGrounded()){
                        animName = `${airRunWeaponType}attack_1_air`
                    } else if(isRunningAttack){
                        // grounded + weapon equipped + actually running gets
                        // its own dedicated clip too, same "no alternating
                        // swordAnimNum, only one variant" precedent the
                        // air-attack clip above already set - only confirmed
                        // to exist for weaponType "sword" ("running_sword1")
                        animName = `running_${airRunWeaponType}1`
                    }

                    swordAnimNum = swordAnimNum === 1 ? 2 : 1

                    if(attackInfo.weaponType) playSound(getAllSounds().swordWhooshS)
                    
                    if(isSocketOn){
                        emitAttack(attackInfo, animName)
                    }else{
                        attack(attackInfo, animName)
                    } 
                    positionAtkCollider({ reach: 1, isRunningAttack })

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
                    // spear-only (uimanagement.js's own updateThrowButtonVisibility
                    // already hides this button unless one's equipped - this
                    // check is just a defensive backstop, not the real gate)
                    if(attackInfo.weaponType !== "spear") return

                    // release point - the actual spear leaves the hand once
                    // the "spearthrow" clip is 90% through, not when it
                    // ends. Real playback speed matters here (unlike the
                    // debug log this replaced): attack() plays every clip
                    // at speedRatio (0.8 + atkSpd), a faster swing speed
                    // shortens how long that 90% mark actually takes to
                    // arrive in real time, so the timeout below has to
                    // divide by the SAME ratio attack() itself uses, or the
                    // spear would visibly leave the hand early/late whenever
                    // atkSpd isn't exactly 0.
                    
                    const myChar = getPlayersOnScene().find(pl => pl.owner === charState.owner)
                    const spearThrowAnim = myChar?.anims.find(a => a.name.toLowerCase() === "spearthrow")
                    if(spearThrowAnim){
                        const fps = spearThrowAnim.targetedAnimations?.[0]?.animation.framePerSecond ?? 30
                        const frames = spearThrowAnim.to - spearThrowAnim.from
        
                        const releaseDelayMs = (frames / fps ) * 0.7 * 1000
                        setTimeout(() => {
                            throwSpearProjectile(myChar, charState);
                        }, releaseDelayMs)
                    } else {
                        console.warn(`[spearthrow] no "spearthrow" clip found on this rig's own animation groups - projectile never released`)
                    }
                    

                    clickedTimeOut = setTimeout(() => {
                        disableEnableWalkRunButtons(true)
                    }, 500)

                    // animation only here - same attack()/emitAttack() relay
                    // every other walkrun-btns action already rides
                    // (attack() -> attackingSystem.js's own
                    // characterAnimations.playAction) so every client
                    // watching sees the same throw play, not just the
                    // caster. throwSpearProjectile above is deliberately
                    // LOCAL-ONLY for now (no multiplayer relay of its own
                    // yet) - other clients watching this throw won't see
                    // the actual projectile fly until that gets wired up
                    // separately.
                    if(isSocketOn){
                        emitAttack(attackInfo, "spearthrow")
                    }else{
                        attack(attackInfo, "spearthrow")
                    }
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