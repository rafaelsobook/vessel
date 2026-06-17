import npcDetails from "../staticRecources/npcDetails"
import {createCharacter} from "../charactersystem/createcharacter.js"
import {pushNpc} from "../sockets/worldsocket.js"
// import registerActionsWhenCollide from "../characterSystem/talkingToNpcSystem.js"
import { onIntersecEnterTrig, onIntersecExitTrig } from "../components/actionManager.js"
import { openCloseInteractBtn } from "../tools/popupUI.js"
import { getCharState, updateMyDetailsOL } from "../charactersystem/characterstate.js"
import { startConv } from "../components/conversations.js"
import { createNpc } from "./createnpc.js"
import { disableEnableAttackButtonsContainer } from "../charactersystem/uimanagement.js"
import { checkIfTokenSaved } from "../tools/tools.js"


export function createAllNpcInArea(hero, scene){
    const myHeroDatabase = getCharState()
    npcDetails.forEach( async npcdet => {
        if(npcdet.currentPlaceId !== myHeroDatabase.currentPlace.placeId) return
        let anNpc = await createNpc(scene, npcdet)
        // if(npcdet.glbPath){
        //     anNpc = await createNpc(scene, npcdet)
        // }else{
        //     anNpc = createCharacter(scene,{x: npcdet.x, y: npcdet.y, z: npcdet.z}, npcdet, false, true)
        // }
        pushNpc({...anNpc, canSpeak: true})
        onIntersecEnterTrig(anNpc.body, hero.body, scene, () => {
            openCloseInteractBtn("normal", true, () => {
                disableEnableAttackButtonsContainer(false, true)
                openCloseInteractBtn("normal", false)
                let myState = getCharState()

                let storyInfo = false
                let myQuestShortDetail = false
                myState.quests.forEach(myqst => {
                    storyInfo = anNpc.det.forQuests.find(qst => qst.qName ===myqst.qName)
                    if(storyInfo) myQuestShortDetail = myqst
                })
                
                if(!storyInfo) return startConv(anNpc.det.randomSpeech, () => {})
                if(!myQuestShortDetail) return
                if(!myQuestShortDetail.questRequirements.completed && storyInfo.notCompletedSpeech) return startConv(storyInfo.notCompletedSpeech)
                

                if(myQuestShortDetail && myQuestShortDetail.questRequirements.completed) return startConv(storyInfo.speech, async () => {
                    myState = getCharState()
                    myState.quests = myState.quests.filter(stry=> stry.qName !== storyInfo.qName)
                    // then add the new questsToReceive

                    storyInfo.questsToReceive.forEach(qstToRec => myState.quests.push(qstToRec))
                    
                    if(storyInfo.hasReward){
                        switch(storyInfo.reward.receiveRewardType){
                            case "item":
                                storyInfo.reward.rewardItems.forEach(rwrdItm => {
                                    obtain(rwrdItm)
                                })
                            break
                            case "krit":
                                // myState.assets.krit += storyInfo.reward.rewardCoin
                                // showItemAcquiredPopUp("krit", storyInfo.reward.rewardCoin)
                            break
                        }
                    }
                    myState.clearedQuests.push(storyInfo.qName)
                    const updatedState = await updateMyDetailsOL(myState, checkIfTokenSaved(), true)
                })
                
                startConv(anNpc.det.speech, () => {})
                // returnCam(scene, freecam)
                // openCloseChatContainer(true)
                // theNpc = getNpcArray().find(npz => npz._id === anNpc._id)
                // if(!theNpc) return
                // const cb = anNpc.det.randomSpeech[anNpc.det.randomSpeech.length-1].cb
                // if(cb) cb()
                // setTimeout(()=> theNpc.canSpeak = true, 4500)
            })
            
        })
        onIntersecExitTrig(anNpc.body, hero.body, scene, () => {
            openCloseInteractBtn("normal", false)
            disableEnableAttackButtonsContainer(true)
        })
    })
    
}

export default createAllNpcInArea