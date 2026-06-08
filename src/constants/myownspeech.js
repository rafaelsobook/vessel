import { setCurrentSpeechId, startQuestionare } from '../components/conversations';

import { getCharState, setCharStateMode } from '../charactersystem/characterState';
import { getPlayersOnScene } from '../sockets/worldsocket';
import { getSceneDet } from '../main/main';
import { setCanPress } from '../charactersystem/characterState';
import { receiveAbilities } from '../charactersystem/abilitySystem';

export const myownspeeches = [
    {
        ownSpeechId: 1,
        characterstate: "confuse",
        animationName: "act_gettingupconfused",
        speeches:[
            {
                name: "",
                isLeft: true,
                message: "I'm dizzyy, did I fall ..."
            },
            {
                name: "",
                isLeft: true,
                message: "What is this room ..."
            }
        ],
        cb: function() {
            const charState = getCharState()
            if(!charState) return console.log("not found charstate")
            setCanPress(false)
            setCharStateMode("idle")
            setTimeout( async () => {
                const myChar = getPlayersOnScene().find(pl => pl.owner === charState.owner)
                if(!myChar) return console.log("not found getPlayersOnScene")
                await setCurrentSpeechId(null)
                startQuestionare(1, myChar.body)
            }, 2000)
        }
    }
]