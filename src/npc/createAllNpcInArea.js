import npcDetails from "../staticRecources/npcDetails"
import {pushNpc} from "../sockets/worldsocket.js"
// import registerActionsWhenCollide from "../characterSystem/talkingToNpcSystem.js"
import { onIntersecEnterTrig, onIntersecExitTrig } from "../components/actionManager.js"
import { openCloseInteractBtn } from "../tools/popupUI.js"
import { getCharState, updateMyDetailsOL } from "../charactersystem/characterstate.js"
import { startConv, startQuestionare } from "../components/conversations.js"
import { createNpc } from "./createnpc.js"
import { disableEnableAttackButtonsContainer } from "../charactersystem/uimanagement.js"
import { checkIfTokenSaved } from "../tools/tools.js"
import { faceForward } from "../controllers/inputMovement.js"
import { getPlayerCoord } from "../charactersystem/createcharacter.js"
import { setCanPress } from "../charactersystem/characterstate.js"


export function createAllNpcInArea(hero, scene){
    const myHeroDatabase = getCharState()
    npcDetails.forEach( async npcdet => {
        if(npcdet.currentPlaceId !== myHeroDatabase.currentPlace.placeId) return
        let anNpc = await createNpc(scene, npcdet)
        pushNpc({...anNpc, canSpeak: true})
        onIntersecEnterTrig(anNpc.body, hero.body, scene, () => {
            openCloseInteractBtn("normal", true, () => {
                disableEnableAttackButtonsContainer(false, true)
                openCloseInteractBtn("normal", false)
                setCanPress(false)

                faceForward(hero.body.position.clone(), anNpc.body)

                let myState = getCharState()

                let storyInfo = false // the long forquest that has a speech property
                let myQuestShortDetail = false // the short quest info// has the questRequirements.completed = false|true property
                myState.quests.forEach(myqst => {
                    storyInfo = anNpc.det.forQuests.find(qst => qst.qName ===myqst.qName)
                    if(storyInfo) myQuestShortDetail = myqst
                })
                
                if(!storyInfo) return startConv(anNpc.det.randomSpeech, () => {
                    if(anNpc.det.callbackAfterRandomSpeech) anNpc.det.callbackAfterRandomSpeech()
                })
                
                if(!myQuestShortDetail) return
                if(!myQuestShortDetail.questRequirements.completed && storyInfo.notCompletedSpeech) return startConv(storyInfo.notCompletedSpeech)
                

                if(myQuestShortDetail.questRequirements.completed) return startConv(storyInfo.speech, async () => {
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
                    if(storyInfo.cbAfterNewQuestReceived) storyInfo.cbAfterNewQuestReceived()
                    const updatedState = await updateMyDetailsOL(myState, checkIfTokenSaved(), true)
                })
                
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
            setCanPress(true)
        })
    })
    
}

export default createAllNpcInArea