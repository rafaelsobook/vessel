import { setCurrentSpeechId, startQuestionare } from '../components/conversations';

import { getCharState, setCharStateMode } from '../charactersystem/characterstate';
import { getPlayersOnScene } from '../sockets/worldsocket';
import { getSceneDet } from '../main/main';
import { setCanPress } from '../charactersystem/characterstate';
import { receiveAbilities } from '../charactersystem/abilitySystem';
import { getAllSounds } from '../components/soundSystem';

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
        loadingMessage: ["Not Everyone Is Given A Chance", "To Have A Second Life"],
        cb: function() {
            const charState = getCharState()
            if(!charState) return
            setCanPress(false)
            setCharStateMode("idle")
            getAllSounds().woodCreakS.play()
            setTimeout( async () => {
                const myChar = getPlayersOnScene().find(pl => pl.owner === charState.owner)
                if(!myChar) return
                await setCurrentSpeechId(null)
                startQuestionare(1, myChar.body)
            }, 2000)
        }
    }
]