import npcDetails from "../staticRecources/npcDetails"
import {pushNpc} from "../sockets/worldsocket.js"
// import registerActionsWhenCollide from "../characterSystem/talkingToNpcSystem.js"
import { onIntersecEnterTrig, onIntersecExitTrig } from "../components/actionManager.js"
import { openCloseInteractBtn } from "../tools/popupUI.js"
import { getCharState, updateMyDetailsOL } from "../charactersystem/characterstate.js"
import { obtain } from "../charactersystem/inventory.js"
import { prepareGrantedQuest, evaluateLiveQuestRequirements, updateStoryQuestUI } from "../charactersystem/storyQuestSystem.js"
import { startConv, startQuestionare } from "../components/conversations.js"
import { createNpc, createFighterNpc } from "./createnpc.js"
import { disableEnableAttackButtonsContainer } from "../charactersystem/uimanagement.js"
import { checkIfTokenSaved } from "../tools/tools.js"
import { clearLocTimeOut, faceForward } from "../controllers/inputMovement.js"
import { getPlayerCoord } from "../charactersystem/createcharacter.js"
import { setCanPress } from "../charactersystem/characterstate.js"
import { offerDuel } from "./duelSystem.js"
import { receiveAchievement } from "../charactersystem/achievement.js"


export function createAllNpcInArea(hero, scene){
    const myHeroDatabase = getCharState()
    npcDetails.forEach( async npcdet => {
        if(npcdet.currentPlaceId !== myHeroDatabase.currentPlace.placeId) return
        // npcFighter goes through the fuller createCharacter path (real
        // characterAnimations/equipSword rig) instead of createNpc()'s
        // lightweight isNpc:true one - see createFighterNpc's own comment
        let anNpc = npcdet.characterType === "npcFighter"
            ? createFighterNpc(scene, npcdet)
            : await createNpc(scene, npcdet)
        anNpc.canSpeak = true
        // pushed by reference (not a {...anNpc} copy) so the _patrolFrozen/_patrolIndex
        // flags set here and read by updateNpcPatrol() in renderer.js stay in sync
        pushNpc(anNpc)

        onIntersecEnterTrig(anNpc.body, hero.body, scene, () => {
            openCloseInteractBtn("normal", true, () => {
                disableEnableAttackButtonsContainer(false, true)
                openCloseInteractBtn("normal", false)
                setCanPress(false)
                clearLocTimeOut()
                anNpc._patrolFrozen = true
                faceForward(hero.body.position.clone(), anNpc.body)

                let myState = getCharState()

                let storyInfo = false // the long forquest that has a speech property
                let myQuestShortDetail = false // the short quest info// has the questRequirements.completed = false|true property
                myState.quests.forEach(myqst => {

                    storyInfo = anNpc.det.forQuests.find(qst => qst.qName ===myqst.qName)
                    if(storyInfo) myQuestShortDetail = myqst
                })
                
                if(!storyInfo) return startConv(anNpc.det.randomSpeech, () => {
                    // any NPC flagged npcFighter automatically gets the duel
                    // offer here - no per-NPC dialogue wiring needed, see duelSystem.js
                    if(anNpc.det.characterType === "npcFighter") return offerDuel(anNpc.det)
                    if(anNpc.det.callbackAfterRandomSpeech) anNpc.det.callbackAfterRandomSpeech()
                })
                
                if(!myQuestShortDetail) return
                // re-checks "live" reqTypes (currently just "craft" - see its
                // own comment) fresh on every talk, in case the condition's
                // become true since the LAST time this quest was checked (no
                // obtain()-time event exists to react to for these, unlike
                // the enemy-kill/item-gathering reqTypes, which flip
                // .completed reactively as they happen instead)
                evaluateLiveQuestRequirements(myQuestShortDetail)
                if(!myQuestShortDetail.questRequirements.completed && storyInfo.notCompletedSpeech) return startConv(storyInfo.notCompletedSpeech)
                

                if(myQuestShortDetail.questRequirements.completed) return startConv(storyInfo.speech, async () => {
                    myState = getCharState()
                    myState.quests = myState.quests.filter(stry=> stry.qName !== storyInfo.qName)
                    // then add the new questsToReceive

                    storyInfo.questsToReceive.forEach(qstToRec => myState.quests.push(prepareGrantedQuest(qstToRec)))

                    // story-quest achievements - qName here is the quest
                    // being turned in RIGHT NOW (npcDetails.js's own forQuests
                    // entries), matched against achievement.js's own data.
                    // the-guildmaster-calls is different: that achievement is
                    // about being SUMMONED (i.e. the moment Halric's own
                    // "return-to-guildmaster" quest gets granted as a reward
                    // here), not about turning anything in.
                    if(storyInfo.qName === "proveYourself") receiveAchievement("proven-hunter")
                    if(storyInfo.qName === "gatherElementalCores") receiveAchievement("three-of-a-kind")
                    if(storyInfo.questsToReceive.some(q => q.qName === "return-to-guildmaster")) receiveAchievement("the-guildmaster-calls")

                    if(storyInfo.hasReward){
                        switch(storyInfo.reward.receiveRewardType){
                            case "item":
                                // MUST be synchronous, not staggered via
                                // setTimeout (as this briefly was) - the
                                // updateMyDetailsOL(myState, ..., true) call
                                // below saves myState (and, since
                                // willUpdateCharState is true, REPLACES the
                                // whole characterState singleton with
                                // whatever the server echoes back -
                                // characterstate.js's own updateMyDetailsOL)
                                // right after this loop returns. A deferred
                                // obtain() would still be pending when that
                                // fires, so its items would never make it
                                // into the saved snapshot - obtain() would
                                // go on to add them to the OLD, by-then-
                                // orphaned object a moment later, silently
                                // wiped from what getCharState() actually
                                // returns from then on (only reappearing
                                // after a refresh re-pulls obtain()'s own
                                // later save from the server). The "acquired
                                // X" popups rendering stacked on top of each
                                // other when several fire at once is instead
                                // handled inside showItemAcquiredPopUp
                                // itself now (inventory.js) - staggered
                                // there, without delaying the actual state
                                // mutation.
                                storyInfo.reward.rewardItems.forEach(rwrdItm => obtain(rwrdItm))
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
                    updateStoryQuestUI()
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
            anNpc._patrolFrozen = false
        })
    })
    
}

export default createAllNpcInArea