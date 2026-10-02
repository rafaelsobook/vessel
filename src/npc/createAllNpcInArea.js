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
import { createBloodSplatter } from "../tools/particlesystem.js"
import { playAnim } from "../tools/animation.js"
import { displaySpeech } from "../tools/speechgui.js"


// The player's own swing landing on an npc - the shared "atkCollider" every
// weapon/fist swing hits through (createMyCharacter.js; dashstrike/blinkstrike
// reuse it too), same trigger createEnemy.js registers per enemy. Purely a
// reaction, npcs have no hp: a "hit1" flinch and a blood splatter. Local to
// the swinging player's own screen, since atkCollider only exists for them.
//
// Three kinds of npc come through createAllNpcInArea:
//   - npcFighter (createFighterNpc) - the full player rig, already carrying
//     its own bloodps and characterAnimations, which plays hit1 and returns
//     to whatever state it was in;
//   - avatar npcs (createNpc, no glbPath) - hit1 is kept for them in
//     createcharacter.js's isNpc animation trim; flinch played by hand here,
//     then the loop it interrupted (idle, or walk mid-patrol) resumes;
//   - glbPath npcs (emry/halric/vanessa .glb) - those models only have an
//     "idle" clip, so they just bleed, no flinch.
// a whole combo of swings would otherwise restart the line on every hit
// before it's even finished typing out
const HURT_SPEECH_COOLDOWN_MS = 4000

// one of the npc's own npcDetails.js hurtSpeech lines, at random - never the
// same one twice running. Centered, auto-advancing (displaySpeech's
// isCenterAndNoBackground mode, same as duelSystem.js's fight lines), so it
// doesn't open a dialogue box that needs clicking away.
function sayHurtLine(npc){
    const lines = npc.det?.hurtSpeech
    if(!lines?.length) return
    const now = Date.now()
    if(now < (npc._hurtSpeechUntil ?? 0)) return
    npc._hurtSpeechUntil = now + HURT_SPEECH_COOLDOWN_MS

    let index = Math.floor(Math.random() * lines.length)
    if(lines.length > 1 && index === npc._lastHurtLine) index = (index + 1) % lines.length
    npc._lastHurtLine = index
    displaySpeech([{ name: npc.det.name, isLeft: false, message: lines[index] }], undefined, undefined, true)
}

function registerNpcHitReaction(scene, npc){
    const atkCollider = scene.getMeshByName("atkCollider")
    if(!atkCollider || !npc.body) return

    // the splatter emits from the npc's own body - same setup createEnemy.js
    // gives every enemy (the full-rig fighter already has one on its spine)
    if(!npc.bloodps){
        npc.bloodps = createBloodSplatter(scene)
        npc.bloodps.ps.emitter = npc.body
    }

    onIntersecEnterTrig(atkCollider, npc.body, scene, () => {
        npc.bloodps.play()
        sayHurtLine(npc)

        if(npc.characterAnimations) return npc.characterAnimations.playAction(npc.anims, "hit1", 1)

        const hit = npc.anims?.find(anim => anim.name.toLowerCase() === "hit1")
        if(!hit) return
        // hit again mid-flinch - restart it rather than stacking a second
        // resume on top of the first
        if(npc._hitFlinching) return hit.goToFrame(hit.from)
        npc._hitFlinching = true
        const interrupted = npc.anims.find(anim => anim !== hit && anim.isPlaying)
        interrupted?.stop()
        hit.onAnimationGroupEndObservable.addOnce(() => {
            npc._hitFlinching = false
            // deferred, and skipped if something's already playing: npcPatrol.js's
            // walk/idle switch stops every clip (ending this flinch early,
            // which fires this same observer synchronously) and then starts
            // its own - resuming the old loop here would run both at once
            setTimeout(() => {
                if(npc.body?.isDisposed() || npc.anims.some(anim => anim.isPlaying)) return
                if(interrupted) interrupted.play(true)
                else playAnim(npc.anims, "idle", true)
            }, 0)
        })
        hit.play(false)
    })
}

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
        registerNpcHitReaction(scene, anNpc)

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
                // storyInfo.cbAfterNotCompletedSpeech (npcDetails.js, e.g.
                // Colousa's own duel challenge) - fires once this speech
                // finishes playing, same "cb runs after the conversation
                // closes" contract every other startConv call in this file
                // already relies on. Optional - most notCompletedSpeech
                // entries have nothing to do beyond just saying their line,
                // so this no-ops via ?. for all of those.
                if(!myQuestShortDetail.questRequirements.completed && storyInfo.notCompletedSpeech) return startConv(storyInfo.notCompletedSpeech, () => storyInfo.cbAfterNotCompletedSpeech?.())


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