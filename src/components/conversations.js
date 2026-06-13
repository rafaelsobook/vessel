import { questions } from "../constants/questions"
import { myownspeeches } from "../constants/myownspeech";
import { showAnswerButtons } from "../tools/popupUI"
import  Conversation from "../tools/rpgconv"
import { getPlayersOnScene } from "../sockets/worldsocket";
import { getCharState, setCanPress, setCharStateMode, updateMyDetailsOL } from "../charactersystem/characterstate";
import { playAnim } from "../tools/animation";
import { checkIfTokenSaved, playAnimWithCallback } from "../tools/tools";
import { disableEnableAttackButtonsContainer, hideShowAllScreenUI } from "../charactersystem/uimanagement";

const conv = new Conversation(document, 30)

export function startConv(speechesArray, cb){
    conv.startConversation(speechesArray, 0, cb)
}

export function startQuestionare(questionId, characterBody){
    const question = questions.find(q => q.questionId === questionId)
    if(!question) return
    disableEnableAttackButtonsContainer(false, true)
    conv.startConversation(question.conversationWithQuestion,0, () => {
        // question.cb()
        if(!question.answers.length){
            return question.cb && question.cb(characterBody) // default to 0 if no answer chosen, but should not be the case since showAnswerButtons will only show if there are answers
        }
        showAnswerButtons(question.answers, (indx) => { 
            question.answers[indx].cb(indx, characterBody)
        })
    })
}
export function startMyOwnSpeech(){
    const charState = getCharState()

    const ownSpeech = myownspeeches.find(speech => speech.ownSpeechId === charState.currentspeechId)
    if(!ownSpeech) return

    let mycharacter = getPlayersOnScene().find(pl => pl.owner === charState.owner)
    if(!mycharacter) return

    setCanPress(false)
    hideShowAllScreenUI()

    playAnimWithCallback(mycharacter.anims, ownSpeech.animationName, false, () => {
        mycharacter = getPlayersOnScene().find(pl => pl.owner === charState.owner)
        if(!mycharacter) return
        setCharStateMode("idle")
    })
    // playAnim(mycharacter.anims, ownSpeech.animationName)
    conv.startConversation(ownSpeech.speeches, 0, () => {
        hideShowAllScreenUI()
        ownSpeech.cb()
    })
}
export async function setCurrentSpeechId(numberOrNull){
    const charState = getCharState()
    charState.currentspeechId = numberOrNull

    await updateMyDetailsOL(charState, checkIfTokenSaved())
}