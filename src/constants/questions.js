import { startQuestionare } from '../components/conversations';
import { spawnProjectile} from "../creations/skills"
import { getCharState, setCharStateMode } from '../charactersystem/characterState';
import { getPlayersOnScene } from '../sockets/worldsocket';
import { getSceneDet } from '../main/main';
import { setCanPress } from '../charactersystem/characterState';
import { receiveAbilities } from '../charactersystem/abilitySystem';
import { createMagicCircle, spawnMagicCircle } from '../creations/magiccircles';
import { playAnim, stopAllAnim } from '../tools/animation';
import { playAnimWithCallback, randomNum, stopAnim } from '../tools/tools';
import { Vector3 } from '@babylonjs/core';
import { obtain } from '../charactersystem/inventory';
import { showHideIcons } from '../charactersystem/uimanagement';
import { getPlayerCoord } from '../charactersystem/createcharacter';
import abilities from '../staticRecources/abilities';



export const questions = [
    {
        questionId: 1,
        conversationWithQuestion:[
            {
                name: "kamisama",
                isLeft: false,
                message: "Thank you for hearing my call"
            },
            {
                name: "kamisama",
                isLeft: false,
                message: "I'm the first player of this game... unfortunately, I died before I could even finish it. So I stayed here, trapped between worlds, summoning players like you to carry on what I could not."
            },
            {
                name: "kamisama",
                isLeft: false,
                message: " I will guide you by lending you powers I gained from this world ..."
            },
        ],
        answers: [
            {
                text: "Interested",
                cb: () => {
                    startQuestionare(2)
                }
            },
            {
                text: "Don't Care",
                cb: () => {
                    // will receive a weapon
                    startQuestionare(5)
                }
            },
            {
                text: "How'd I get here",
                cb: () => {
                    startQuestionare(3)
                }
            },
        ],
        cb: (answerIndx) => {
            if(answerIndx === 0){
            }else{
            }
        }
    },
    {
        questionId: 2,
        conversationWithQuestion:[
            {
                name: "kamisama",
                isLeft: false,
                message: "This is not a simple world that you can mess with ..."
            },
            {
                name: "kamisama",
                isLeft: false,
                message: "I am not wasting souls, just to summon weak players here"
            },
            {
                name: "kamisama",
                isLeft: false,
                message: "Therefore, I will bestow one blessing that will help you"
            },
            {
                name: "kamisama",
                isLeft: false,
                message: "Choose wisely. This will shape who you become in this world."
            },
        ],
        answers: [
            {
                text: "Osiris' Hearth",
                cb: () => {
                    const charState = getCharState()
                    const {pos} = getPlayerCoord(charState.owner)
                    createMagicCircle(pos, getSceneDet().scene, "apt_fire" )
                    setTimeout(() => {
                        receiveAbilities(false, false, abilities[0])
                        setCanPress(true)
                    }, 2000)
                }
            },
            {
                text: "Aether's Core",
                cb: () => {
                    const charState = getCharState()
                    const {pos} = getPlayerCoord(charState.owner)
                    createMagicCircle(pos, getSceneDet().scene, "apt_water" )
                    setTimeout(() => {
                        receiveAbilities(false, false, abilities[1])
                        setCanPress(true)
                    }, 2000)
                }
            },
            {
                text: "Golden Fortitude",
                cb: () => {
                    const charState = getCharState()
                    const {pos} = getPlayerCoord(charState.owner)
                    createMagicCircle(pos, getSceneDet().scene, "apt_earth")
                    setTimeout(() => {
                        receiveAbilities(false, false, abilities[2])
                        setCanPress(true)
                    }, 2000)
                }
            },
        ],
        cb: () => { 
            setTimeout(() => {
                obtain(bootsItem)
                setCanPress(true)
                showHideIcons("block")
            }, 1000)
            // In conversations.js it will check if answers.length obviously we dont have any so direct call the cb with characterbody passed in
            // const charState = getCharState()
            // if(!charState) return
            // let character = getPlayersOnScene().find(player => player.owner === charState.owner)
            // if(!character) return
            // const charPos = character.body.position.clone()
            // const scene = getSceneDet().scene
            // spawnProjectile({x:0,y:-2,z:3}, {x:charPos.x, y:charPos.y+0.5, z:charPos.z}, "yellow", scene, "default", () => {
            //     console.log("will play hit_struc1")
            //     playAnimWithCallback(character.anims, "hit_struct1", false, () => {
            //         const disc = spawnMagicCircle(new Vector3(charPos.x, 0.05, charPos.z), scene, "divine1", 0.8)
            //         stopAllAnim(character.anims)
            //         setCharStateMode("structed")
            //         setTimeout(() => {
            //             receiveAbilities(5, 10)
            //             setTimeout(() => { 
            //                 character = getPlayersOnScene().find(player => player.owner === charState.owner)
                            
            //                 despawnMagicCircle(disc,scene)
            //                 setCanPress(true)
            //                 stopAllAnim(character.anims)
            //                 setCharStateMode("idle")
            //                 // console.log(`animation ${ownSpeech.animationName} finished playing`)
            //                 console.log(`mycharactermode : ${character.mode}`)
            //             }, 2000)
            //         }, 3000)
            //     })
            // }, 6500)
        }
    },
    {
        questionId: 3,
        conversationWithQuestion:[
            {
                name: "kamisama",
                isLeft: false,
                message: "Summoning has become... surprisingly easy, All I need... is a pure soul. Someone innocent."
            },
            {
                name: "kamisama",
                isLeft: false,
                message: "I took their life. And in exchange... you arrive. A new player. A new hope. A new chance to finish what I could not"
            },
            {
                name: "kamisama",
                isLeft: false,
                message: "The question is... was it worth their lives? Will YOU make it worth it?"
            },
        ],
        answers: [
            {
                text: "You are cruel",
                cb: () => {
                    startQuestionare(4)
                }
            },
            {
                text: "Will do my best",
                cb: () => {
                    startQuestionare(2)
                }
            }
        ],
        cb: (answerIndx) => {
            // if(answerIndx === 0){
            //     log("interested")
            // }else{
            //     log("not interested")
            // }
        }
    },
    {
        questionId: 4,
        conversationWithQuestion:[
            {
                name: "kamisama",
                isLeft: false,
                message: "...Cruel !! HAHAHA"
            },
            {
                name: "kamisama",
                isLeft: false,
                message: "You know full well that I hold your fate in these lands.. and called me cruel"
            },
            {
                name: "kamisama",
                isLeft: false,
                message: "A Soul for a Life ..."
            },
            {
                name: "kamisama",
                isLeft: false,
                message: "Player ... Take MORE than what I planned to give you. "
            },
            {
                name: "kamisama",
                isLeft: false,
                message: "You have earned it by being BRAVE enough to tell me the TRUTH."
            },
            {
                name: "kamisama",
                isLeft: false,
                message: "Receive this extra abilities"
            }
        ],
        answers: [],
        cb: () => { // In conversations.js it will check if answers.length obviously we dont have any so direct call the cb with characterbody passed in
            const charState = getCharState()
            if(!charState) return
            let character = getPlayersOnScene().find(player => player.owner === charState.owner)
            if(!character) return
            const charPos = character.body.position.clone()
            const scene = getSceneDet().scene
            spawnProjectile({x:0,y:-2,z:3}, {x:charPos.x, y:charPos.y+0.5, z:charPos.z}, "yellow", scene, "default", () => {
                
                console.log("played")
                const disc = spawnMagicCircle(new Vector3(charPos.x, 0.05, charPos.z), scene, "divine1", 0.8)
                character.characterAnimations.playAction(character.anims, "hit_struct1", 1)

                setCharStateMode("structed")
                setTimeout(() => {
                    receiveAbilities(5, 10)
                    setTimeout(() => { 
                        character = getPlayersOnScene().find(player => player.owner === charState.owner)
                        setCanPress(true)
                        // stopAllAnim(character.anims)
                        setCharStateMode("idle")
                        // console.log(`animation ${ownSpeech.animationName} finished playing`)
                    }, 2000)
                }, 5000)
                // playAnimWithCallback(character.anims, "hit_struct1", false, () => {
                    
                // })
            }, 6500)
        }
    },
    {
        questionId: 5,
        conversationWithQuestion:[
            {
                name: "kamisama",
                isLeft: false,
                message: "I sense POWER from you .."
            },
            {
                name: "kamisama",
                isLeft: false,
                message: "Farewell Player, You have a potential to be my vesse....."
            },
            {
                name: "kamisama",
                isLeft: false,
                message: "...Eh Eheemm"
            },
            {
                name: "kamisama",
                isLeft: false,
                message: "I will now bestow you a weapon useful for your adventure !"
            }
        ],
        answers: [],
        cb: () => { // In conversations.js it will check if answers.length obviously we dont have any so direct call the cb with characterbody passed in
            setTimeout(() => {
                obtain(swordItem)
                obtain(bootsItem)
                startQuestionare(2)
                showHideIcons("block")
            }, 1000)
        }
    }
]


var bootsItem = {
    itemId: randomNum(), // should be string also in client
    name: "leatherboots", // is also the image name
    dn: "Leather Boots",
    itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
    itemType: "boots", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
    equipAbilities: { 
        dmg: 0, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
    }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
    // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
    consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
    equiped: false,
    soulFeed: 0,
    isEnhanceAble: false, // only for weapons
    enhancedLevel: 0,
    durability: { current: 100, max: 100},
    price: 9,
    qnty: 1,
    desc: "This Boots is light and useful for first time adventurers",
    rarity: "common"
}

var swordItem = {
    itemId: randomNum(), // should be string also in client
    name: "frostbite", // is also the image name
    dn: "Frost Bite",
    itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
    itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
    weaponType: "sword",
    equipAbilities: { 
        dmg: 100, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
    }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
    // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
    consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 10, plusSpd: 1, }, //for buffs foods potions
    equiped: false,
    soulFeed: 0,
    isEnhanceAble: true, // only for equipable items
    enhancedLevel: 0,
    slots: [],// { name, dn, equipAbilities } cores
    durability: { current: 100, max: 100},
    price: 10,
    qnty: 1,
    desc: "Frost Bite, A deadly Blade. It's blade is sharp as frozen blade",
    rarity: "rare",

    parts: {
        bladeRarity: "rare2",
        guardRarity: "rare1",
        handleRarity: "common1",
        pommelRarity: "common1"
    }
}