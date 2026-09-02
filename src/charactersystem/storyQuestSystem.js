import npcDetails from "../staticRecources/npcDetails.js"
import { getNpcOnScene, getPlayersOnScene } from "../sockets/worldsocket.js"
import { getCharState, updateMyDetailsOL } from "./characterstate.js"
import { getSceneDet } from "../main/main.js"
// import { checkDistance } from "../createFunctions/creationTools.js"
import { openClosePopup } from "../tools/popupUI.js"
// import { setPointerTargetName, stop } from "../controllers/pointerMovement.js"
import { checkIfTokenSaved, createElement } from "../tools/tools.js"

const storyCont = document.querySelector('.story-notif-container')

const interactBtn = document.getElementById("interactBtn")

let npcDetail
let npcMeshDetail

let storySystemInitiated = false
let goingToSpeakInterval

export function initOnceStorySystem(){
    if(storySystemInitiated) return

    storyCont.addEventListener("click", e => {
        // renderStoryQuests below stamps each quest's own qName onto its
        // .story block via dataset (not the container's own className,
        // which only ever had room for ONE quest at a time) - .closest so a
        // click on a child (.story-bx/.story-title/etc, though those are
        // pointer-events:none in CSS anyway) still resolves to the right block
        const qName = e.target.closest(".story")?.dataset.qname
        if(!qName) return
        npcDetail = undefined
        npcMeshDetail = undefined

        npcDetails.forEach(npc=> {
            const myNextStoryQuest = npc.forQuests.find(stryqst => stryqst.qName === qName)
            if(!myNextStoryQuest) return
            const theNpc = getNpcOnScene().find(npcInScene => npcInScene.name === npc.name)
            if(!theNpc) return
            npcDetail = npc
            npcMeshDetail = theNpc
        })
        if(!npcMeshDetail) return openClosePopup(`Not applicable here`, true, 2000)
        // setPointerTargetName(`npc.${npcMeshDetail._id}`)
        // if(!npcMeshDetail.canSpeak) return openClosePopup(`Can't speak right now`, true, 2000)
        const charState = getCharState()
        const myMeshDetail = getPlayersOnScene().find(pl => pl._id === charState._id)
        if(!myMeshDetail) return
        if(npcDetail.currentPlace !== charState.currentPlace) {
            return openClosePopup(`${npcDetail.name} not here`, true, 2000)
        }

        let myPos = myMeshDetail.body.position
        let npcPos = npcMeshDetail.body.position
        const scene = getSceneDet().scene
        const cam = scene.getCameraByName("cam")

        let willMove = true
        clearInterval(goingToSpeakInterval)
   
        // const distance = checkDistance(myPos, npcPos)
        // console.log(distance)
        // if(distance <= 3) {
        //     clearInterval(goingToSpeakInterval)
        //     // stop(myMeshDetail.body, myMeshDetail.anims, false)
        //     willMove = false
        //     return interactBtn.click()
        // }else{
        //     // clearInterval(goingToSpeakInterval)
        //     // goingToSpeakInterval = setInterval(() => {
        //     //     myPos = myMeshDetail.body.position
        //     //     npcPos = npcMeshDetail.body.position
        //     //     const distance = checkDistance(myPos, npcPos)
        //     //     console.log(distance)
        //     //     if(distance <= 3) {                    
        //     //         let itemName = false    
        //     //         charState.items.forEach(itm => {
        //     //             // CAUTION: maybe not only one weapon is equiped but
        //     //             // will get whoever the last weapon in my items is equiped
        //     //             if(itm.itemType === "weapon" && itm.equiped) itemName = itm.name
        //     //         })
        //     //         clearInterval(goingToSpeakInterval)
        //     //         emitStop({x: myPos.x, z: myPos.z}, {x:npcPos.x,z:npcPos.z}, charState._id, false, itemName)
        //     //         willMove = false
        //     //     }
        //     // }, 100)
        // }        
        cam.setTarget(myMeshDetail.body)
        scene.activeCamera = cam
        
        // if(willMove)emitMove({x:myPos.x, y:myPos.y, z:myPos.z}, {x:npcPos.x,y: npcPos.y,z:npcPos.z}, myMeshDetail._id, false) 
    })
    storySystemInitiated = true
}
// Every "grant a quest" call site (createAllNpcInArea.js, questOffer.js,
// questHelpers.js, changeStory below) used to push the SAME object straight
// out of npcDetails.js's static forQuests/questsToReceive array onto
// charState.quests, not a copy - checkStoryQuestIfCompleted then mutates
// questRequirements.current (or itemLists[].current) in place, so that
// mutation landed on npcDetails.js's own module-level source object and
// stuck around for the rest of the page's lifetime (a second grant of the
// same quest - a new character, or the "x" dev reset - came back already
// partway done, or even pre-completed). This clones a quest into a private
// copy for every grant, and - for item-list requirements (proveYourself
// etc.) - syncs each entry up to whatever's already sitting in the player's
// inventory before the quest was even received (e.g. stone mined while
// exploring, before ever meeting Bram), instead of always starting every
// entry at 0 regardless of what's already owned.
export function prepareGrantedQuest(quest){
    const cloned = { ...quest, questRequirements: { ...quest.questRequirements } }
    const req = cloned.questRequirements
    if(!req.itemLists) return cloned

    const charState = getCharState()
    req.itemLists = req.itemLists.map(listEntry => {
        const owned = charState.items
            .filter(itm => itm.name === listEntry.name)
            .reduce((total, itm) => total + (itm.qnty || 0), 0)
        return { ...listEntry, current: Math.min(listEntry.total, owned) }
    })
    if(req.itemLists.every(listEntry => listEntry.current >= listEntry.total)) req.completed = true

    return cloned
}
// "Live" requirement types - checked fresh every time the player talks to
// the NPC holding this quest (createAllNpcInArea.js calls this right
// before deciding whether to play notCompletedSpeech or the completion
// speech), instead of reactively via obtain()/checkStoryQuestIfCompleted
// the way the "enemy" and "item" (itemLists) reqTypes above are. "craft" is
// the first of these - a crafted sword's name is randomly generated per
// craft (customsword_${Date.now()}, craftingui.js's buildSwordItem), so
// there's no fixed item name obtain() could ever match against an
// itemLists entry the way gathered materials do. Scanning current
// ownership at interact time is also just the more honest mechanic here -
// unlike a gather quest, there's no meaningful running count to track
// along the way ("crafted 1 of however many"), only "do you have one right
// now". No-ops (returns the quest untouched) for every other reqType.
export function evaluateLiveQuestRequirements(quest){
    const req = quest?.questRequirements
    if(!req || req.completed) return quest

    if(req.reqType === "craft"){
        const charState = getCharState()
        const owns = charState.items.some(itm => itm.weaponType === req.weaponType)
        if(owns) req.completed = true
    }

    return quest
}
// Dev-only reset (bound to the "x" key in inputMovement.js): drops the
// player straight into whatever story quest is passed in, so that quest's
// speech/behavior can be iterated on repeatedly without replaying the whole
// chain of quests that would normally lead up to it. Takes the quest object
// directly (usually one of npcDetails.js's own questsToReceive entries,
// pasted at the inputMovement.js call site) instead of hardcoding a lookup
// for one specific quest, so any quest can be jumped to this way, not just
// "talk-to-guild-master-first".
export async function changeStory(quest){
    if(!quest) return console.warn("changeStory: no quest passed")

    const state = getCharState()
    const resetQuest = prepareGrantedQuest(quest)

    state.quests = [resetQuest]
    state.clearedQuests = state.clearedQuests.filter(qName => qName !== resetQuest.qName)

    await updateMyDetailsOL(state, checkIfTokenSaved())

    openClosePopup(`story reset - go talk about "${resetQuest.qTtle}"`, true, 1000)

    updateStoryQuestUI(resetQuest)
}
// story quests (npcDetails.js forQuests) use reqType "enemy"/"item"/"money",
// guild board contract quests (tcp/recources/quests.ts, carried around as an
// itemCateg "quest" item wrapping questDetail, see guildQuest.js) use
// "monster"/"item"/"money" for the same concepts - this maps one to the other
// so a single kill/gather event can update whichever quest actually cares.
const CONTRACT_REQ_TYPE = { enemy: "monster", item: "item", money: "money" }

export function checkStoryQuestIfCompleted(_reqType, itemOrEnemyName){
    //_reqType === 'enemy' || 'item'
    // so if my quest type is correct and the name of requirements is that then ill increment
    const charState = getCharState()

    charState.quests.forEach(qst => {
        const req = qst.questRequirements
        if(req.reqType !== _reqType || req.completed) return

        // multi-item requirement (proveYourself-style gathering quests -
        // npcDetails.js) - several different item names each with their own
        // current/total, instead of the single name/requiredNum pair below.
        // Every matching list entry increments (not just the first) so a
        // single item name appearing twice in itemLists - shouldn't happen,
        // but nothing here assumes uniqueness - both still get credit.
        if(req.itemLists){
            let matched = false
            req.itemLists.forEach(listEntry => {
                if(listEntry.name !== itemOrEnemyName || listEntry.current >= listEntry.total) return
                listEntry.current++
                matched = true
            })
            if(!matched) return

            const allDone = req.itemLists.every(listEntry => listEntry.current >= listEntry.total)
            if(allDone){
                req.completed = true
                // see the popup comment below - same reasoning applies here
                openClosePopup(`${qst.qTtle} complete!`, true, 2000)
                updateStoryQuestUI(qst)
            }
            return
        }

        if(req.name !== itemOrEnemyName) return
        req.current++
        if(req.current >= req.requiredNum) {
            req.completed = true
            // storyQst/the banner is a SINGLE slot (one .story-notif-container
            // in the DOM) - if a single event completes more than one
            // quest in this same forEach pass, each updateStoryQuestUI
            // call below overwrites the last, so only the FINAL one
            // ever actually gets seen in the banner. This popup (same
            // "notify on completion" convention the contract-quest
            // branch further down already uses) is what guarantees
            // every completion still gets seen by the player even when
            // that happens, not just whichever one "won" the banner.
            openClosePopup(`${qst.qTtle} complete!`, true, 2000)
            updateStoryQuestUI(qst)
        }
    })

    // contract quests claimed from the guild board live in the inventory, not charState.quests
    const contractReqType = CONTRACT_REQ_TYPE[_reqType] || _reqType
    charState.items.forEach(itm => {
        if(itm.itemCateg !== "quest") return
        const req = itm.questDetail.questRequirements
        if(req.reqType !== contractReqType || req.name !== itemOrEnemyName || req.completed) return

        req.current++
        if(req.current >= req.requiredNum){
            req.completed = true
            openClosePopup(`${itm.questDetail.qTtle} complete! Turn it in for your reward.`, true, 2000)
        }
    })

    updateStoryQuestUI()
}
// Rebuilds the ENTIRE story-quest tracker from scratch, one .story block
// per still-active (not yet completed) entry in charState.quests - replaces
// the old single-slot design, which had exactly one shared set of
// title/required/desc elements for the WHOLE tracker, so a second active
// quest didn't get its own space at all - showing it just overwrote the
// first one's text in place (storyQst, the old "which quest is this" state,
// was a symptom of that: a single variable standing in for "whichever quest
// currently occupies the one slot", not a real multi-quest list).
//
// Every element is freshly created per quest (createElement, tools.js) -
// NOT the old cached single storyTtle/storyDesc/storyReq references reused
// across quests, which would have just relocated the same one DOM node
// into whichever .story block ran last, leaving every earlier block empty.
//
// index.html's own .story-notif-container is now just an empty shell - all
// of .story/.story-bx/.story-title/.story-required/.story-desc gets built
// here instead of hand-authored in the markup, so there's exactly one place
// that ever has to agree on this structure.
// questRequirements.itemLists (proveYourself-style gathering quests) has no
// top-level current/requiredNum to show, unlike the single-name shape - one
// row per item instead of cramming every item's progress into a single
// comma-separated line (which just wrapped into an unreadable block once
// there were more than two or three items).
function buildRequiredEl(questRequirements){
    if(!questRequirements.reqType) return createElement("p", "story-required", '')

    if(questRequirements.itemLists){
        const list = createElement("ul", "story-required-list")
        questRequirements.itemLists.forEach(listEntry => {
            const done = listEntry.current >= listEntry.total
            const row = createElement("li", `story-required-item${done ? ' done' : ''}`,
                `${listEntry.dn} ${listEntry.current}/${listEntry.total}`)
            list.append(row)
        })
        return list
    }

    // "craft" (evaluateLiveQuestRequirements above) has no current/total to
    // count toward - it's a one-shot "do you own one" check, re-evaluated
    // live rather than incrementally, so there's nothing to show but
    // whether it's done yet or not.
    if(questRequirements.reqType === "craft"){
        return createElement("p", "story-required", questRequirements.completed ? "Crafted!" : "Not yet crafted")
    }

    return createElement("p", "story-required", `${questRequirements.current}/${questRequirements.requiredNum}`)
}
function renderStoryQuests(){
    const charState = getCharState()
    if(!charState) return

    storyCont.innerHTML = ''

    const activeQuests = charState.quests?.filter(qst => !qst.questRequirements?.completed) || []
    // nothing to show at all (no quests yet, or every one already
    // completed) - hide the tracker entirely instead of leaving an empty box
    // storyCont.style.display = activeQuests.length ? "block" : "none"
    storyCont.style.display = "block"

    charState.quests.forEach(({ qName, qTtle, desc, questRequirements }) => {
        console.log(qName)
        const storyBx = createElement("div", "story-bx")
        storyBx.append(
            createElement("h4", "story-title", qTtle),
            buildRequiredEl(questRequirements)
        )

        const storyBlock = createElement("div", "story")
        // qName lives on THIS block's own dataset now, not smuggled onto
        // the shared container's className (which only ever had room to
        // remember one quest at a time) - read back by the click handler above
        storyBlock.dataset.qname = qName
        storyBlock.append(storyBx, createElement("p", "story-desc", desc))

        storyCont.appendChild(storyBlock)
    })
}

// The single shared entry point every "a quest changed" call site across
// this codebase already calls - npcDetails.js's own cbAfterNewQuestReceived
// chains, questOffer.js's offerStarterQuest, questHelpers.js's
// grantStoryQuest, changeStory/checkStoryQuestIfCompleted below - and
// characterstate.js's initiateCharacter (runs at the top of every single
// areaScene() call, i.e. on login AND every scene change) for restoring the
// tracker after a reload. Every one of those already pushes/mutates
// charState.quests BEFORE calling this, so a full fresh re-render from that
// same state is always correct here - the `story` argument itself is kept
// only so none of those existing call sites need to change (this function
// no longer needs it to do a full rebuild each time).
export function updateStoryQuestUI(){
    renderStoryQuests()
}