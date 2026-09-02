import { setCurrentSpeechId, startQuestionare } from '../components/conversations';

import { getCharState, setCharStateMode } from '../charactersystem/characterstate';
import { getPlayersOnScene } from '../sockets/worldsocket';
import { getSceneDet } from '../main/main';
import { setCanPress } from '../charactersystem/characterstate';
import { receiveAbilities } from '../charactersystem/abilitySystem';
import { getAllSounds } from '../components/soundSystem';
import { randomNum } from '../tools/tools';
import { createTreasureMesh } from '../assetcreation/createtreasure';

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
            getAllSounds().woodCreakS?.play()

            const bootsItem = {
                itemId: randomNum(), // should be string also in client
                name: "leatherboots", // is also the image name
                dn: "Leather Boots",
                itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
                itemType: "boots", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
                equipAbilities: {
                    dmg: 0, def: 0, resistance: 5, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
                }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
                // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
                consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
                equiped: false,
                soulFeed: 0,
                isEnhanceAble: false, // only for weapons
                enhancedLevel: 0,
                durability: { current: 100, max: 100},
                price: { coinType: "bronze", pieces: 9 },
                qnty: 1,
                desc: "This Boots is light and useful for first time adventurers",
                rarity: "common"
            }
            createTreasureMesh(getSceneDet().scene, {x:2.20,y:0,z: 4.12}, bootsItem)
            setTimeout( async () => {
                const myChar = getPlayersOnScene().find(pl => pl.owner === charState.owner)
                if(!myChar) return
                await setCurrentSpeechId(null)
                startQuestionare(1, myChar.body)
            }, 2000)
        }
    }
]