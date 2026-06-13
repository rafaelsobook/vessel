import npcDetails from "../staticRecources/npcDetails.js"
import { getNpcOnScene, getPlayersOnScene } from "../sockets/worldsocket.js"
import { getCharState, updateMyDetailsOL } from "./characterState.js"
import { getSceneDet } from "../main/main.js"
// import { checkDistance } from "../createFunctions/creationTools.js"
import { openClosePopup } from "../tools/popupUI.js"
// import { setPointerTargetName, stop } from "../controllers/pointerMovement.js"
import { checkIfTokenSaved } from "../tools/tools.js"

const storyCont = document.querySelector('.story-notif-container')
const storyTtle = document.querySelector('.story-title')
const storyReq = document.querySelector('.story-required')
const storyDesc = document.querySelector('.story-desc')

const interactBtn = document.getElementById("interactBtn")

let storyQst
let npcDetail
let npcMeshDetail

let storySystemInitiated = false
let goingToSpeakInterval

export function initOnceStorySystem(){
    if(storySystemInitiated) return

    storyCont.addEventListener("click", e => {
        const qName = e.target.className.split(" ")[1]
        if(!qName) return
        npcDetail = undefined
        npcMeshDetail = undefined

        npcDetails.forEach(npc=> {
            const myNextStoryQuest = npc.forQuests.find(stryqst => stryqst.qName === storyQst.qName)
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
export async function changeStory(_newStory){
    const state = getCharState()

    state.stories[0] = _newStory

    await updateMyDetailsOL(state, checkIfTokenSaved())

    openClosePopup('story updated', true, 1000)

    updateStoryQuestUI(_newStory)
}
export function checkStoryQuestIfCompleted(_reqType, itemOrEnemyName){
    //_reqType === 'enemy' || 'item'
    // so if my quest type is correct and the name of requirements is that then ill increment 
    getCharState().quests.forEach(qst => {
        if(qst.questRequirements.reqType === _reqType && qst.questRequirements.name === itemOrEnemyName){
            qst.questRequirements.current++
            if(qst.questRequirements.current >= qst.questRequirements.requiredNum) {
                updateStoryQuestUI(qst)
                return qst.questRequirements.completed=true
            }   
        }
    })
}
export function updateStoryQuestUI(story){
    storyCont.style.display="block"
    storyQst = story

    const {qName,qTtle,desc,questRequirements} = story
    storyTtle.innerHTML = qTtle
    storyDesc.innerHTML = desc

    storyCont.className = `story-notif-container ${qName}`
    if(questRequirements.reqType){
        storyReq.innerHTML = `${questRequirements.current}/${questRequirements.requiredNum}`
    }else storyReq.innerHTML =''
}
