import { receiveAbilities } from "../charactersystem/abilitySystem.js"
import { evaluateRank, getCharState } from "../charactersystem/characterstate.js"
import { updateStoryQuestUI } from "../charactersystem/storyQuestSystem.js"
import { startQuestionare } from "../components/conversations.js"
// import { openCloseShop, updateShopItem } from "../charactersystem/shopSystem.js"
// import { activateCinemaOne } from "../tools/cameraTools.js"
import { randomNum, getNumUntil} from "../tools/tools.js"

const npcEnemySpd = 4
export default [
    {
        glbPath: "./models/avatar/vanessa.glb",
        currentPlaceId: 9,
        mode: "idle",
        _id: "101_receptionist",
        name: "Vanessa",
        stats: { weapon: 1, accuracy: 1, critical: 1.4, dex: 1, strength: 1, magic: 1, spd: npcEnemySpd},
        lvl: 1,
        rank: "none",
        hp: 100,
        maxHp:100,
        mp: 100,
        maxMp: 100,
        sp: 100,
        maxSp:100,
        exp: 0,
        maxExp: 100,
        x:0,
        y: 0.01,
        z: 4.7,
        _dirTarg: {x:0,z:0},
        cloth: 'style3',
        pants: 'style1',
        hair: 'style1',
        boots: 'style1',
        skinColor: {r:0.45,g:0.30,b:0.16, name: "color2"},
        hairColor: {r: 0, g: 0, b: 0},
        clothColor: {r: 0, g: 0, b: 0},
        pantsColor: {r: 0, g: 0, b: 0},
        items: [
        ],
        titles: ['priest'],
        skills: [], 
        status: [], // sickness //poisoned etc
        regens: {sp: 1, hp: 1, mana: 1},
        monsSoul: 2, // same like points system
        coins: 300,
        aptitude: ['light'],
        blessings: ["holyHand"],
        race: "human",
        characterType:"npcStandby",// npcStandby//npcEnemy//npcFighter//npcWalk
        randomSpeech: [
            {name: "", message:"..."}
        ],
        forQuests: [

        ],
        callbackAfterRandomSpeech: () => {
            startQuestionare(6)
            
        }
    },
    {
        glbPath: "./models/avatar/emry.glb",
        currentPlaceId: 9,
        mode: "idle",
        _id: "101_emry",
        name: "Emry",
        stats: { weapon: 1, accuracy: 1, critical: 1.4, dex: 1, strength: 1, magic: 1, spd: npcEnemySpd},
        lvl: 1,
        rank: "none",
        hp: 100,
        maxHp:100,
        mp: 100,
        maxMp: 100,
        sp: 100,
        maxSp:100,
        exp: 0,
        maxExp: 100,
        x:3.4,
        y: 0.01,
        z: 2.45,
        _dirTarg: {x:-100,z:1},
        cloth: 'style3',
        pants: 'style1',
        hair: 'style1',
        boots: 'style1',
        skinColor: {r:0.45,g:0.30,b:0.16, name: "color2"},
        hairColor: {r: 0, g: 0, b: 0},
        clothColor: {r: 0, g: 0, b: 0},
        pantsColor: {r: 0, g: 0, b: 0},
        items: [
        ],
        titles: ['priest'],
        skills: [], 
        status: [], // sickness //poisoned etc
        regens: {sp: 1, hp: 1, mana: 1},
        monsSoul: 2, // same like points system
        coins: 300,
        aptitude: ['light'],
        blessings: ["holyHand"],
        race: "human",
        characterType:"npcStandby",// npcStandby//npcEnemy//npcFighter//npcWalk
        randomSpeech: [
            {name: "", message:"Time will come, and all evil will be vanquished"},
            {name: "" ,message: "Set your heart ablaze"}
        ],
        forQuests: [
            { // storyInfo
                qName: "talk-to-emilia-1",
                desc: false, 
                questType: "story", //story//hunt//reqItem }, // story means you will get reward after you talk to the
                //receiveRT: //afterTalk//afterHunt//afterFoundItem 
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                speech: [
                    {name:"", message: "Oh !! you're finally awake"},
                    {name:"", message: "You gave us quite a scare, you know. One of our members, he does scouting near the Forest — he found you two nights ago. You were just... lying there at the tree line. Barely breathing. Monsters had clearly been at you for a while."},
                    {name:"", message: "While you were unconscious, our guildmaster made a decision. Outsiders aren't supposed to be brought inside without registration — it's a safety rule for the members. So rather than leave you as an unknown... he registered you. Officially."},
                    {name:"", message: "Now I'll be honest with you. We don't know who you are. You had no identification on you. No guild mark. Nothing. Daran said there were at least eight monster tracks around where he found you, and you were still alive — so whatever you are, you're either very strong or very lucky."},
                    {name:"", message: "Either way, you're a member of the Guild now. The guildmaster will want to speak with you when he returns — he's out on a commission until tomorrow evening. Until then, you're free to rest, eat in the hall, and look at the board for available requests if you're feeling up to it."},
                    {name:"", message: "If you need anything, have questions, or just don't know where to go... I'm usually right here."},
                    {name:"", message: "Actually — before I let you go, there are two things I still need from you"},
                    {name:"", message: "This is an Aptitude Crystal. Every new member has to go through this — no exceptions, guildmaster's orders. You simply place both hands on it and hold still for a moment."},
                    {name:"", message: "It reads your mana capacity — how much magical energy your body can hold — and your aptitudes. Fire, water, wind, earth, lightning, light, dark... whatever affinity lives in you, the crystal finds it. Some people have one. Some have two. A rare few have none at all and rely purely on physical strength — nothing wrong with that either."},
                    {name:"", message: "The results get written into your guild file. That way when you take on commissions, we can match you with jobs that suit what you're capable of. Healers go to medical requests. Fire users go to ice cave jobs. You understand."},
                    {name:"", message: "I realise I never actually asked... and I wrote 'Unknown' in the registry which the guildmaster is going to scold me for later."},
                    {name:"", message: "What is your name?"},
                    {name:"", message: "Great! Now Feel free to register your magic on the crystal"},
                ],
                notCompletedSpeech: false,
                questsToReceive: [
                    { 
                        qName: "touchTheCrystal", 
                        qTtle: "AptitudeTest", 
                        desc: "Place your hand on the crystal and check your magic aptitude", 
                        questRequirements: { reqType: false, completed: false}, //reqType'enemy/item/money
                    }
                ],
                cbAfterNewQuestReceived: () => {
                    // actually none because the questToReceive will activate when you go near the crystal
                }
            },
            { // storyInfo
                qName: "touchTheCrystal",
                desc: false, 
                questType: "story", //story//hunt//reqItem }, // story means you will get reward after you talk to the
                //receiveRT: //afterTalk//afterHunt//afterFoundItem 
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                speech: [
                    {name:"", message: "Let me just finish your registration..."},
                    {name:"", message: "Alright. The crystal has your reading on file now. Mana capacity, aptitudes — all logged. Every adventurer starts somewhere, and this gives us a baseline to track your growth over time."},
                    {name:"", message: "Your rank has been set to F. That is standard for new registrants. It is not a judgment — it simply means you have not yet taken on guild commissions. That changes the moment you start."},
                    {name:"", message: "Now, I do have something for you if you."},
                    {name:"", message: "Slimes have been crossing the eastern border for about a week now. Small, fast, and relentless when it comes to farmland. The villagers are losing crops every day and their requests have been sitting in the queue longer than they should."},
                    {name:"", message: "Most of our available members are out on higher priority commissions right now. We are stretched thin and we simply do not have the hands to spare."},
                    {name:"", message: "So yes — it is an F rank request. But urgent is urgent, and the villagers need someone there soon."},
                    {name:"", message: "Standard reward plus guild points. Nothing flashy, but it is honest work and a good way to get your first commission on the record."},
                    {name:"", message: "I apologize for throwing this at you on your first day. "},
                    {name:"", message: "Good luck !!!"},                   
                ],
                notCompletedSpeech: [
                    {name:"", message: "Go near the crstal and simply place your hand there"},
                ],
                questsToReceive: [
                    { 
                        qName: "slayFirstSlime", 
                        qTtle: "Hunt Down Slimes", 
                        desc: "Slay slimes near the borders", 
                        questRequirements: { reqType: "enemy", name: "waterslime", current: 0, requiredNum: 3, completed: false }, //reqType'enemy/item/money
                    }
                ],
                cbAfterNewQuestReceived: () => {
                    evaluateRank(0, { rankNumber: 0, rankLabel: "f"})
                    updateStoryQuestUI({ 
                        qName: "slayFirstSlime", 
                        qTtle: "Hunt Down Slimes", 
                        desc: "Slay slimes near the borders", 
                        questRequirements: { reqType: "enemy", name: "waterslime", current: 0, requiredNum: 3, completed: false }, //reqType'enemy/item/money
                    })
                }
            },
            { // storyInfo
                qName: "slayFirstSlime",
                desc: false, 
                questType: "story", //story//hunt//reqItem }, // story means you will get reward after you talk to the
                //receiveRT: //afterTalk//afterHunt//afterFoundItem 
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                speech: [
                    {name:"", message: "Congratulations on exterminating those pesky slimes"},
                    {name:"", message: "Time for your reward"},
                   
                ],
                notCompletedSpeech: [
                    {name:"", message: "I know you can kill those Slimes ! 3 Heads is enough !"},
                ],
                questsToReceive: [
                    { 
                        qName: "talk-to-guild-master-first", 
                        qTtle: "Hunt Down Insects", 
                        desc: "Slay insects near the borders", 
                        questRequirements: { reqType: false, completed: true }, //reqType'enemy/item/money
                    }
                ],
                cbAfterNewQuestReceived: () => {
                    // actually none because the questToReceive will activate when you go near the crystal
                }
            },
        ]
    },
    {
        glbPath: null,
        currentPlaceId: 9,
        mode: "idle",
        _id: "102_armin",
        name: "Armin",
        stats: { weapon: 1, accuracy: 1, critical: 1.4, dex: 1, strength: 1, magic: 1, spd: npcEnemySpd},
        lvl: 1,
        rank: "none",
        hp: 100,
        maxHp:100,
        mp: 100,
        maxMp: 100,
        sp: 100,
        maxSp:100,
        exp: 0,
        maxExp: 100,
        x:-5.9,
        y: 0.01,
        z: 0.3,
        _dirTarg: {x:10,z:100},
        cloth: 'style3',
        pants: 'style2',
        hair: 'style1',
        boots: 'style1',
        skinColor: { r: 0.93, g: 0.78, b: 0.63 },
        hairColor: {r: 1, g: 1, b: 1},
        clothColor: {r: 1, g: 1, b: 1},
        pantsColor: {r: 0.2, g: 0.3, b: 0.4},
        items: [
        {
            itemId: randomNum(), // should be string also in client
            name: "knightscale", // is also the image name
            dn: "Knight's Scale",
            itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
            itemType: "armor", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
            weaponType: undefined,
            equipAbilities: {
                dmg: 0, def: 20, resistance: 10, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
            }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
            // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
            consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
            equiped: true,
            soulFeed: 0,
            isEnhanceAble: true, // only for equipable items
            enhancedLevel: 0,
            slots: [],// { name, dn, equipAbilities } cores
            durability: { current: 100, max: 100},
            price: { coinType: "bronze", pieces: 10 },
            qnty: 1,
            desc: undefined,
            rarity: "rare",
            metalColor: "adamantine"
        },
        {
            itemId: randomNum(), // should be string also in client
            name: "ironpaul", // is also the image name
            dn: "Iron Pauldron",
            itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
            itemType: "pauldron", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
            weaponType: undefined,
            equipAbilities: { 
                dmg: 0, def: 20, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
            }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
            // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
            consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
            equiped: true,
            soulFeed: 0,
            isEnhanceAble: true, // only for equipable items
            enhancedLevel: 0,
            slots: [],// { name, dn, equipAbilities } cores
            durability: { current: 100, max: 100},
            price: { coinType: "bronze", pieces: 10 },
            qnty: 1,
            desc: undefined,
            rarity: "rare",
            metalColor: "adamantine"
        },
        {
        itemId: randomNum(), // should be string also in client
        name: "gauntler", // is also the image name
        dn: "Gauntlet",
        itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
        itemType: "gauntlet", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
        weaponType: undefined,
        equipAbilities: {
            dmg: 0, def: 20, resistance: 10, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
        // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
        equiped: true,
        soulFeed: 0,
        isEnhanceAble: true, // only for equipable items
        enhancedLevel: 0,
        slots: [],// { name, dn, equipAbilities } cores
        durability: { current: 100, max: 100},
        price: { coinType: "bronze", pieces: 10 },
        qnty: 1,
        desc: undefined,
        rarity: "rare",
        metalColor: "adamantine"
    },
        {
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
            equiped: true,
            soulFeed: 0,
            isEnhanceAble: false, // only for weapons
            enhancedLevel: 0,
            durability: { current: 100, max: 100},
            price: { coinType: "bronze", pieces: 9 },
            qnty: 1,
            desc: "This Boots is light and useful for first time adventurers",
            rarity: "common"
        },
        {
            itemId: randomNum(), // should be string also in client
            name: "ironjaw", // is also the image name
            dn: "Knight's Helm III",
            itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
            itemType: "helmet", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
            weaponType: undefined,
            equipAbilities: {
                dmg: 0, def: 20, resistance: 10, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
            }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
            // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
            consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 1, }, //for buffs foods potions
            equiped: true,
            soulFeed: 0,
            isEnhanceAble: true, // only for equipable items
            enhancedLevel: 0,
            slots: [],// { name, dn, equipAbilities } cores
            durability: { current: 100, max: 100},
            price: { coinType: "bronze", pieces: 10 },
            qnty: 1,
            desc: undefined,
            rarity: "rare",
            metalColor: "adamantine"
        },
        {
            itemId: randomNum(), // should be string also in client
            name: "frostbite", // is also the image name
            dn: "Frost Bite",
            itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
            itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
            weaponType: "sword",
            equipAbilities: { 
                dmg: 20, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
            }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
            // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
            consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 10, plusSpd: 1, }, //for buffs foods potions
            equiped: true,
            soulFeed: 0,
            isEnhanceAble: true, // only for equipable items
            enhancedLevel: 0,
            slots: [],// { name, dn, equipAbilities } cores
            durability: { current: 100, max: 100},
            price: { coinType: "bronze", pieces: 10 },
            qnty: 1,
            desc: undefined,
            rarity: "rare",

            parts: {
                bladeRarity: "rare2",
                guardRarity: "rare2",
                handleRarity: "common1",
                pommelRarity: "common1"
            }
        },
        {
            itemModelStyle: "prieststyle1",
            name: "priestbelt", // is also the image name
            dn: "Priest Belt",
            itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
            itemType: "belt", // sword/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
            equipAbilities: { 
                dmg: 100, def: 100, magicDmg: 100, plusStr: 0, plusDex: 0, plusInt: 0,
            }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
            // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
            consumeAbilities: { plusHp: 100, plusMp: 100, plusSp: 100, plusDmg: 10, plusSpd: 1, }, //for buffs foods potions
            equiped: true,
            soulFeed: 0,
            isEnhanceAble: true, // only for equipable items
            enhancedLevel: 0,
            durability: { current: 100, max: 100},
            price: { coinType: "bronze", pieces: 1000 },
            qnty: 1,
            desc: "A Priest Vest, Plus Holyness",
            rarity: "normal"//rare//mystical//legendary
        },
        {
            itemModelStyle: "prieststyle1",
            name: "priestvest", // is also the image name
            dn: "Priest Vest",
            itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
            itemType: "cloak", // sword/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
            equipAbilities: { 
                dmg: 100, def: 100, magicDmg: 100, plusStr: 0, plusDex: 0, plusInt: 0,
            }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
            // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
            consumeAbilities: { plusHp: 100, plusMp: 100, plusSp: 100, plusDmg: 10, plusSpd: 1, }, //for buffs foods potions
            equiped: true,
            soulFeed: 0,
            isEnhanceAble: true, // only for equipable items
            enhancedLevel: 0,
            durability: { current: 100, max: 100},
            price: { coinType: "bronze", pieces: 1000 },
            qnty: 1,
            desc: "A Priest Cloak, Plus Holyness",
            rarity: "normal"//rare//mystical//legendary
        }
        ],
        titles: ['priest'],
        skills: [], 
        status: [], // sickness //poisoned etc
        regens: {sp: 1, hp: 1, mana: 1},
        monsSoul: 2, // same like points system
        coins: 300,
        aptitude: ['light'],
        blessings: ["holyHand"],
        race: "human",
        characterType:"npcStandby",// npcStandby//npcEnemy//npcFighter//npcWalk
        randomSpeech: [
            {name: "", message:"Time will come, and all evil will be vanquished"},
            {name: "" ,message: "Set your heart ablaze"}
        ],
        forQuests: [

        ]
    },
    {
        glbPath: null,
        currentPlaceId: 9,
        mode: "idle",
        _id: "103_kraun",
        name: "Kraun",
        stats: { weapon: 1, accuracy: 1, critical: 1.4, dex: 1, strength: 1, magic: 1, spd: npcEnemySpd},
        lvl: 1,
        rank: "none",
        hp: 100,
        maxHp:100,
        mp: 100,
        maxMp: 100,
        sp: 100,
        maxSp:100,
        exp: 0,
        maxExp: 100,
        x: 5.5,
        y: 0.01,
        z: -1.5,
        _dirTarg: {x:0,z:0},
        cloth: 'style1',
        pants: 'style2',
        hair: 'style1',
        boots: 'style2',
        skinColor: {r: 0.93, g: 0.78, b: 0.63},
        hairColor: {r: 0.5, g: 0.5, b: 0.5},
        clothColor: {r: 0.3, g: 0.2, b: 0.1},
        pantsColor: {r: 0.15, g: 0.15, b: 0.15},
        items: [
            {
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
                equiped: true,
                soulFeed: 0,
                isEnhanceAble: false, // only for weapons
                enhancedLevel: 0,
                durability: { current: 100, max: 100},
                price: { coinType: "bronze", pieces: 9 },
                qnty: 1,
                desc: "This Boots is light and useful for first time adventurers",
                rarity: "common"
            }
        ],
        titles: ['miner'],
        skills: [],
        status: [], // sickness //poisoned etc
        regens: {sp: 1, hp: 1, mana: 1},
        monsSoul: 2, // same like points system
        coins: 300,
        aptitude: ['earth'],
        blessings: [],
        race: "human",
        characterType:"npcStandby",// npcStandby//npcEnemy//npcFighter//npcWalk
        randomSpeech: [
            {name: "", message:"..."}
        ],
        forQuests: [

        ],
        callbackAfterRandomSpeech: () => {
            startQuestionare(20)
        }
    },
    {
        _id: "65465",
        name: "genesis",
        stats: { weapon: 1, accuracy: 1, critical: 1.4, dex: 1, strength: 1, magic: 1, spd: npcEnemySpd},
        lvl: 1,
        rank: "none",
        hp: 100,
        maxHp:100,
        mp: 100,
        maxMp: 100,
        sp: 100,
        maxSp:100,
        exp: 0,
        maxExp: 100,
        x:3.6,
        z: 7,
        _dirTarg: {x:0,z:0},
        cloth: 'style3',
        pants: 'style1',
        hair: 'style1',
        boots: 'style1',
        skinColor: {r:0.45,g:0.30,b:0.16, name: "color2"},
        hairColor: {r: 0, g: 0, b: 0},
        clothColor: {r: 0, g: 0, b: 0},
        pantsColor: {r: 0, g: 0, b: 0},
        items: [{
            itemModelStyle: "prieststyle1",
            name: "priestbelt", // is also the image name
            dn: "Priest Belt",
            itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
            itemType: "belt", // sword/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
            equipAbilities: { 
                dmg: 100, def: 100, magicDmg: 100, plusStr: 0, plusDex: 0, plusInt: 0,
            }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
            // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
            consumeAbilities: { plusHp: 100, plusMp: 100, plusSp: 100, plusDmg: 10, plusSpd: 1, }, //for buffs foods potions
            equiped: true,
            soulFeed: 0,
            isEnhanceAble: true, // only for equipable items
            enhancedLevel: 0,
            durability: { current: 100, max: 100},
            price: { coinType: "bronze", pieces: 1000 },
            qnty: 1,
            desc: "A Priest Vest, Plus Holyness",
            rarity: "normal"//rare//mystical//legendary
        },
        {
            itemModelStyle: "prieststyle1",
            name: "priestvest", // is also the image name
            dn: "Priest Vest",
            itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
            itemType: "cloak", // sword/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
            equipAbilities: { 
                dmg: 100, def: 100, magicDmg: 100, plusStr: 0, plusDex: 0, plusInt: 0,
            }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
            // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
            consumeAbilities: { plusHp: 100, plusMp: 100, plusSp: 100, plusDmg: 10, plusSpd: 1, }, //for buffs foods potions
            equiped: true,
            soulFeed: 0,
            isEnhanceAble: true, // only for equipable items
            enhancedLevel: 0,
            durability: { current: 100, max: 100},
            price: { coinType: "bronze", pieces: 1000 },
            qnty: 1,
            desc: "A Priest Cloak, Plus Holyness",
            rarity: "normal"//rare//mystical//legendary
        }
        ],
        titles: ['priest'],
        skills: [], 
        currentPlaceId: "church",
        status: [], // sickness //poisoned etc
        regens: {sp: 1, hp: 1, mana: 1},
        monsSoul: 2, // same like points system
        coins: 300,
        aptitude: ['light'],
        blessings: ["holyHand"],
        race: "human",
        characterType:"npcStandby",// npcStandby//npcEnemy//npcFighter//npcWalk
        randomSpeech: [            
            {name: "", message: "Weapons are reliable when facing danger"}, 
            {name: "", message: "But If you're planning to flee, better drop it to loss weight"},
            {name: "", message: "We have Geralt for crafting weapons, he just need the materials for it"}
        ],
        forQuests: [
            { 
                qName: "talkToGenesis1",
                desc: false, 
                questType: "story", //story//hunt//reqItem }, // story means you will get reward after you talk to the
                //receiveRT: //afterTalk//afterHunt//afterFoundItem 
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                
                speech: [
                    {name: "", message: "let us aid you in unlocking your true strength."},
                    {name: "", message: 'Awakening your abilities will require courage, focus, and determination.'},
                    {name: "", message: "Now possess and accept the awakened abilities that have always been yours"},
                ],
                
                callBack: function (arg) {
                    receiveAbilities(4, 6)
                },
                questsToReceive: [
                    { 
                        qName: "talkToGenesis2", 
                        qTtle: "Abilities Unlocked", 
                        desc: "Having abilities is helpful to guide you on your adventure" ,
                        questRequirements: { reqType: false, completed: true },
                    }
                ]
            },
            { 
                qName: "talkToGenesis2",
                desc: false, 
                questType: "story", //story//hunt//reqItem }, // story means you will get reward after you talk to the
                //receiveRT: //afterTalk//afterHunt//afterFoundItem 
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                
                speech: [
                    {name: "", message: "I can sense the awakening of your abilities"},
                    {name: "", message: "Use them wisely and with honor"},
                    {name: "", message: 'And know this, Great one'},
                    {name: "", message: "the power you now wield is but a fraction of what lies within you."},
                    {name: "", message: "Deep within your spirit, there are more sleeping abilities"},
                    {name: "", message: "These abilities are not something I can draw out"},
                    {name: "", message: "Your journey, the challenges and experiences will be the key to uncovering these hidden strengths."},
                    {name: "", message: "let the adventure ahead awaken the true strength that lies within you."},
                    {name: "", message: "Go to the right side of this hall, and you will find Barun"},
                    {name: "", message: "He can provide you with invaluable ideas and strategies for the challenges ahead."},
                ],
                questsToReceive: [
                    { 
                        qName: "talkToBarun1", 
                        qTtle: "Talk To Barun", 
                        desc: "Barun is an expert when it comes to fighting " ,
                        questRequirements: { reqType: false, completed: true },
                    }
                ]
            },
        ]
    },
    {
        _id: "3412",
        name: "barun",
        stats: { weapon: 1, accuracy: 1, critical: 1.4, dex: 1, strength: 1, magic: 1, spd: npcEnemySpd},
        lvl: 1,
        rank: "none",
        hp: 100,
        maxHp:100,
        mp: 100,
        maxMp: 100,
        sp: 100,
        maxSp:100,
        exp: 0,
        maxExp: 100,
        x:5,
        z: -7,
        _dirTarg: {x:0,z:0},
        cloth: 'style3',
        pants: 'style1',
        hair: 'style1',
        boots: 'style1',
        skinColor: {r:0.45,g:0.30,b:0.16, name: "color2"},
        hairColor: {r: 0, g: 0, b: 0},
        clothColor: {r: 0, g: 0, b: 0},
        pantsColor: {r: 0, g: 0, b: 0},
        items: [{
            itemModelStyle: "prieststyle1",
            name: "priestbelt", // is also the image name
            dn: "Priest Belt",
            itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
            itemType: "belt", // sword/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
            equipAbilities: { 
                dmg: 100, def: 100, magicDmg: 100, plusStr: 0, plusDex: 0, plusInt: 0,
            }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
            // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
            consumeAbilities: { plusHp: 100, plusMp: 100, plusSp: 100, plusDmg: 10, plusSpd: 1, }, //for buffs foods potions
            equiped: true,
            soulFeed: 0,
            isEnhanceAble: true, // only for equipable items
            enhancedLevel: 0,
            durability: { current: 100, max: 100},
            price: { coinType: "bronze", pieces: 1000 },
            qnty: 1,
            desc: "A Priest Vest, Plus Holyness",
            rarity: "normal"//rare//mystical//legendary
        }
        ],
        titles: ['priest', 'warrior'],
        skills: [], 
        currentPlaceId: "churchTrainingHall",
        status: [], // sickness //poisoned etc
        regens: {sp: 1, hp: 1, mana: 1},
        monsSoul: 2, // same like points system
        coins: 300,
        aptitude: ['light'],
        blessings: ["holyHand"],
        race: "human",
        characterType:"npcStandby",// npcStandby//npcEnemy//npcFighter//npcWalk
        randomSpeech: [            
            {name: "", message: "There is no other way of becoming strong"}, 
            {name: "", message: "You need to build that muscle and earn your way to valhalla"},
            {name: "", message: "Train so that monsters will run in fear if they sense you"}
        ],
        forQuests: [
            { 
                qName: "talkToBarun1",
                desc: false, 
                questType: "story", //story//hunt//reqItem }, // story means you will get reward after you talk to the
                //receiveRT: //afterTalk//afterHunt//afterFoundItem 
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                
                speech: [
                    {name: "", message: "Here you are, Good thing you found me"},
                    {name: "", message: 'those priest are very bad at directions'},
                    {name: "", message: "but here you are now, Let's start your training"},
                    {name: "", message: "See those dummies, Attack them !"},
                    {name: "", message: "gather your strength"},
                    {name: "", message: "Be careful those dummies can't move but can steal some sp from you"},
                    {name: "", message: "Good luck !"},
                ],
                questsToReceive: [
                    { 
                        qName: "talkToBarun2", 
                        qTtle: "Defeat Wooden Dummy", 
                        desc: "Barun is an expert when it comes to fighting, Talk to him and start your first step", 
                        questRequirements: { reqType: "enemy", name: "wooddummy", current: 0, requiredNum: 1, completed: false }, //reqType'enemy/item/money
                    }
                ]
            },
            { 
                qName: "talkToBarun2",
                desc: false, 
                questType: "story", //story//hunt//reqItem }, // story means you will get reward after you talk to the
                //receiveRT: //afterTalk//afterHunt//afterFoundItem 
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                speech: [
                    {name: "", message: "well done, you nailed those dummies"},
                    {name: "", message: 'looks like you have potential in you'},
                    {name: "", message: "what more if you have weapons !"},
                    {name: "", message: "I think it's time for you to meet lezby"},
                    {name: "", message: "He's expert in weapons"},
                    {name: "", message: "He don't look like one but trust me he's an expert"},
                    {name: "", message: "he's outside, You'll see him near our church's gate ..."},
                    {name: "", message: "Comeback any time to train here ..."},
                ],
                questsToReceive: [
                    { 
                        qName: "talktolezby1", //librarian for monsters info 
                        qTtle: "Talk To Lezby", 
                        desc: "Lezby our weapons expert, is specialized on our blades, he'll give you what you need",
                        questRequirements: { reqType: false, completed: true }
                    }
                ]
            },
        ]
    },
    {
        _id: "s23112",
        name: "lezby",
        stats: { weapon: 1, accuracy: 1, critical: 1.4, dex: 1, strength: 1, magic: 1, spd: npcEnemySpd},
        lvl: 1,
        currentPlaceId: "wisemanVillage",
        rank: "none",
        hp: 100,
        maxHp:100,
        mp: 100,
        maxMp: 100,
        sp: 100,
        maxSp:100,
        exp: 0,
        maxExp: 100,
        x:23,
        z: -42,
        _dirTarg: {x:-13,z:-42},
        cloth: 'style3',
        pants: 'style1',
        hair: 'style1',
        boots: 'style1',
        skinColor: {r:0.45,g:0.30,b:0.16, name: "color2"},
        hairColor: {r: 0, g: 0, b: 0},
        clothColor: {r: 0, g: 0, b: 0},
        pantsColor: {r: 0, g: 0, b: 0},
        items: [{
            itemModelStyle: "prieststyle1",
            name: "priestbelt", // is also the image name
            dn: "Priest Belt",
            itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
            itemType: "belt", // sword/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
            equipAbilities: { 
                dmg: 100, def: 100, magicDmg: 100, plusStr: 0, plusDex: 0, plusInt: 0,
            }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
            // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
            consumeAbilities: { plusHp: 100, plusMp: 100, plusSp: 100, plusDmg: 10, plusSpd: 1, }, //for buffs foods potions
            equiped: true,
            soulFeed: 0,
            isEnhanceAble: true, // only for equipable items
            enhancedLevel: 0,
            durability: { current: 100, max: 100},
            price: { coinType: "bronze", pieces: 1000 },
            qnty: 1,
            desc: "A Priest Vest, Plus Holyness",
            rarity: "normal"//rare//mystical//legendary
        }
        ],
        titles: ['priest', 'warrior'],
        skills: [], 

        status: [], // sickness //poisoned etc
        regens: {sp: 1, hp: 1, mana: 1},
        monsSoul: 2, // same like points system
        coins: 300,
        aptitude: ['light'],
        blessings: ["holyHand"],
        race: "human",
        characterType:"npcStandby",// npcStandby//npcEnemy//npcFighter//npcWalk
        randomSpeech: [            
            {name: "", message: "Weapons are your reliable companion"}, 
            {name: "", message: "Choosing the best is a must !"}
        ],
        forQuests: [
            { 
                qName: "talktolezby1",
                desc: false, 
                questType: "story", //story//hunt//reqItem }, // story means you will get reward after you talk to the
                //receiveRT: //afterTalk//afterHunt//afterFoundItem 
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                
                speech: [
                    {name: "", message: "Young one ! Your journey starts here"},
                    {name: "", message: 'Do you already have a weapon in mind ?'},
                    {name: "", message: "listen ! weapons are tools and can be broken on the heat of the battle"},
                    {name: "", message: "So you must wield it with care"},
                    {name: "", message: "They can also be enhanced and crafted"},
                    {name: "", message: "Now choose your weapon !"},
                ],
                questsToReceive: [
                    { 
                        qName: "talktolezby2", 
                        qTtle: "Talk To Lezby", 
                        desc: "Lezby our weapons expert, specialized on blades", 
                        questRequirements: { reqType: false, completed: true } //reqType'enemy/item/money
                    }
                ]
            },
            { 
                qName: "talktolezby2",
                desc: false, 
                questType: "story", //story//hunt//reqItem }, // story means you will get reward after you talk to the
                //receiveRT: //afterTalk//afterHunt//afterFoundItem 
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                // cores can be smallcores, mediumcores, diamantinecores, diabolicCores etc
                speech: [
                    {name: "", message: "Good choice !"},
                    {name: "", message: 'Our next step is enhancing your weapon'},
                    {name: "", message: "Try on getting some cores from the monsters outside"},
                    {name: "", message: "One is enough for now, I don't want you to get killed on the start of your journey"},
                    {name: "", message: "Equip your weapon ! And Go !"},
                    {name: "", message: "Goodluck !"},
                ],
                questsToReceive: [
                    { 
                        qName: "talktolezby3", 
                        qTtle: "Talk To Lezby", 
                        desc: "Defeat a goblin and take its core", 
                        questRequirements: { reqType: "enemy", name: "dirtGoblin", current: 0, requiredNum: 1, completed: false }, //reqType'enemy/item/money
                    }
                ]
            },
            { 
                qName: "talktolezby3",
                desc: false, 
                questType: "story", //story//hunt//reqItem }, // story means you will get reward after you talk to the
                //receiveRT: //afterTalk//afterHunt//afterFoundItem 
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                // cores can be smallcores, mediumcores, diamantinecores, diabolicCores etc
                speech: [
                    {name: "", message: "Well done ! How's your first kill !"},
                    {name: "", message: "I got worried a little, but seems like you're going to be fine"},
                    {name: "", message: "For now ..."},
                    {name: "", message: "As long as you're cautious and always upgrading your weapons"},
                    {name: "", message: "You will be fine"},
                    {name: "", message: "Now Let's enhance your weapon !"},
                    {name: "", message: "On your enhancing tab, Insert your weapon and press enhanced !"},
                    {name: "", message: "Be aware ! Enhancing can be risky ..."},
                    {name: "", message: "Enhancing a weapon 2 or 3 times can be fine, more than that can break your weapon"},
                ],
                questsToReceive: [
                    { 
                        qName: "talktolezby4", 
                        qTtle: "Talk To Lezby", 
                        desc: "Enhance your weapon to upgrade its stats", 
                        questRequirements: { reqType: false, completed: true } //reqType'enemy/item/money
                    }
                ]
            },
            { 
                qName: "talktolezby4",
                desc: false, 
                questType: "story", //story//hunt//reqItem }, // story means you will get reward after you talk to the
                //receiveRT: //afterTalk//afterHunt//afterFoundItem 
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                // cores can be smallcores, mediumcores, diamantinecores, diabolicCores etc
                speech: [
                    {name: "", message: "Great ! Enhance your weapons wisely !"},
                    {name: "", message: "It is time for you to meet the guild master"},
                    {name: "", message: "Your journey will be safer when you're in a guild's care"},
                    {name: "", message: "Just across the road you will find the guild"},
                    {name: "", message: "The guild are responsible for exploring the depths of forest"},
                    {name: "", message: "but exploring alone would not be safe"},
                    {name: "", message: "hoping you meet helpful people on the guild"},
                    {name: "", message: "Good luck !"}
                ],
                questsToReceive: [
                    { 
                        qName: "talktogm1", 
                        qTtle: "Find The Guild", 
                        desc: "Speak with the guild master", 
                        questRequirements: { reqType: false, completed: true }
                    }
                ]
            },
        ]
    },
    {
        _id: "32sw41421",
        name: "Officer Dan",
        stats: { weapon: 1, accuracy: 1, critical: 1.4, dex: 1, strength: 1, magic: 1, spd: npcEnemySpd},
        lvl: 1,
        currentPlaceId: "guild",
        rank: "none",
        hp: 100,
        maxHp:100,
        mp: 100,
        maxMp: 100,
        sp: 100,
        maxSp:100,
        exp: 0,
        maxExp: 100,
        x:0,
        z: 12.5,
        _dirTarg: {x:0,z:0},
        cloth: 'style1',
        pants: 'style1',
        hair: 'style1',
        boots: 'style1',
        skinColor: {r:0.45,g:0.30,b:0.16, name: "color2"},
        hairColor: {r: 0, g: .1, b: .6},
        clothColor: {r: .4, g: .1, b: .2},
        pantsColor: {r: 0, g: 0, b: 0},
        items: [{
            itemModelStyle: "prieststyle1",
            name: "priestbelt", // is also the image name
            dn: "Priest Belt",
            itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
            itemType: "belt", // sword/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
            equipAbilities: { 
                dmg: 100, def: 100, magicDmg: 100, plusStr: 0, plusDex: 0, plusInt: 0,
            }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
            // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
            consumeAbilities: { plusHp: 100, plusMp: 100, plusSp: 100, plusDmg: 10, plusSpd: 1, }, //for buffs foods potions
            equiped: true,
            soulFeed: 0,
            isEnhanceAble: true, // only for equipable items
            enhancedLevel: 0,
            durability: { current: 100, max: 100},
            price: { coinType: "bronze", pieces: 1000 },
            qnty: 1,
            desc: "A Priest Vest, Plus Holyness",
            rarity: "normal"//rare//mystical//legendary
        }
        ],
        titles: ['priest', 'warrior'],
        skills: [], 

        status: [], // sickness //poisoned etc
        regens: {sp: 1, hp: 1, mana: 1},
        monsSoul: 2, // same like points system
        coins: 300,
        aptitude: ['light'],
        blessings: ["holyHand"],
        race: "human",
        characterType:"npcStandby",// npcStandby//npcEnemy//npcFighter//npcWalk
        randomSpeech: [            
            {name: "", message: "bring us one step closer to a world where our children can grow up without fear"}, 
            {name: "", message: " where our villages can thrive in the light of freedom."},
        ],
        forQuests: [
            { 
                qName: "talktogm1",
                desc: false, 
                questType: "story", //story//hunt//reqItem }, // story means you will get reward after you talk to the
                //receiveRT: //afterTalk//afterHunt//afterFoundItem 
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                
                speech: [
                    {name: "", message: "Welcome, brave soul. It is an honor to have you here, standing within these hallowed halls"},
                    {name: "", message: 'Our guild, forged in the fires of countless battles, exists for one noble purpose'},
                    {name: "", message: "to protect the people of this land !"},
                    {name: "", message: "Free ourselves from the monstrous threats that lurk beyond our walls."},
                    {name: "", message: "we will drive back the darkness and reclaim the peace that our people deserve. "},
                    {name: "", message: "Now that you understand our mission, it's time to learn about how we operate"},
                    {name: "", message: "Our officer Carl will explain on how to get started"},
                    {name: "", message: "I will See you in a while !"},
                ],
                questsToReceive: [
                    { 
                        qName: "talktocarl1", 
                        qTtle: "Speak With Carl", 
                        desc: "Carl is an expert guide for new adventurers", 
                        questRequirements: { reqType: false, completed: true }
                    }
                ]
            },
            { 
                qName: "talktogm2",
                desc: false, 
                questType: "story", //story//hunt//reqItem }, // story means you will get reward after you talk to the
                //receiveRT: //afterTalk//afterHunt//afterFoundItem 
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                
                speech: [
                    {name: "", message: "Ah, our newest member returns. I see you've completed your task and earned your first rank. "},
                    {name: "", message: "You've shown courage and determination, qualities we hold in high regard here at the Guild"},
                    {name: "", message: "Remember, every mission, no matter how small it may seem, is a step toward greater strength and wisdom."},
                    {name: "", message: "For now, take some time to rest and get to know your Guild"},
                    {name: "", message: "Welcome once again, and congratulations on your first achievement. May it be the first of many"},
                ],
                questsToReceive: [
                    { 
                        qName: "talktodemian1", 
                        qTtle: "Explore the Guild", 
                        desc: "talk to the officers and get to know them", 
                        questRequirements: { reqType: false, completed: true }
                    }
                ]
            },
        ]
    },
    {
        _id: "2314dca234r2",
        name: "Officer Carl",
        stats: { weapon: 1, accuracy: 1, critical: 1.4, dex: 1, strength: 1, magic: 1, spd: npcEnemySpd},
        lvl: 1,
        currentPlaceId: "guild",
        rank: "none",
        hp: 100,
        maxHp:100,
        mp: 100,
        maxMp: 100,
        sp: 100,
        maxSp:100,
        exp: 0,
        maxExp: 100,
        x:6,
        z: -7,
        _dirTarg: {x:0,z:0},
        cloth: 'style2',
        pants: 'style2',
        hair: 'style1',
        boots: 'style1',
        skinColor: {r:0.45,g:0.30,b:0.16, name: "color2"},
        hairColor: {r: .2, g: .6, b: .1},
        clothColor: {r: .2, g: .7, b: .4},
        pantsColor: {r: .4, g: .8, b: 0},
        items: [{
            itemModelStyle: "prieststyle1",
            name: "priestbelt", // is also the image name
            dn: "Priest Belt",
            itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
            itemType: "belt", // sword/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
            equipAbilities: { 
                dmg: 100, def: 100, magicDmg: 100, plusStr: 0, plusDex: 0, plusInt: 0,
            }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
            // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
            consumeAbilities: { plusHp: 100, plusMp: 100, plusSp: 100, plusDmg: 10, plusSpd: 1, }, //for buffs foods potions
            equiped: true,
            soulFeed: 0,
            isEnhanceAble: true, // only for equipable items
            enhancedLevel: 0,
            durability: { current: 100, max: 100},
            price: { coinType: "bronze", pieces: 1000 },
            qnty: 1,
            desc: "A Priest Vest, Plus Holyness",
            rarity: "normal"//rare//mystical//legendary
        }
        ],
        titles: ['priest', 'warrior'],
        skills: [], 
        status: [], // sickness //poisoned etc
        regens: {sp: 1, hp: 1, mana: 1},
        monsSoul: 2, // same like points system
        coins: 300,
        aptitude: ['light'],
        blessings: ["holyHand"],
        race: "human",
        characterType:"npcStandby",// npcStandby//npcEnemy//npcFighter//npcWalk
        randomSpeech: [            
            {name: "", message: "Advancing through the ranks requires not just strength and bravery"}, 
            {name: "", message: "but also wisdom, teamwork, and dedication to our guild’s principles."},
        ],
        forQuests: [
            { 
                qName: "talktocarl1",
                desc: false, 
                questType: "story", //story//hunt//reqItem }, // story means you will get reward after you talk to the
                //receiveRT: //afterTalk//afterHunt//afterFoundItem 
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                
                speech: [
                    {name: "", message: "We have a system in place to recognize the skills and experience of each member"},
                    {name: "", message: "ensuring that everyone is given tasks suited to their abilities and that there's always room for growth and advancement."},
                    {name: "", message: "ranks are a measure of your experience, skill, and the contributions you've made to our cause."},
                    {name: "", message: "The ranking system starts at F, for newcomers like yourself, and ascends to S, reserved for our most seasoned and heroic adventurers."},
                    {name: "", message: "I'll help you get acquainted with our ranking system and guide you on your path"},
                    {name: "", message: "let's get you started on your journey to becoming a protector of our realm."},
                    {name: "", message: "Your first task is straightforward but important."},
                    {name: "", message: "Your task is to bring back three goblin heads as proof of your success."},
                    {name: "", message: "Good luck out there, and stay safe."},
                ],
                questsToReceive: [
                    { 
                        qName: "talktocarl2", 
                        qTtle: "Defeat 3 Goblins", 
                        desc: "Prove you're worthy to have a rank by taking down goblins", 
                        questRequirements: { reqType: "enemy", name: "dirtGoblin", current: 0, requiredNum: 3, completed: false }, //reqType'enemy/item/money
                    }
                ]
            },
            { 
                qName: "talktocarl2",
                desc: false, 
                questType: "story", //story//hunt//reqItem }, // story means you will get reward after you talk to the
                //receiveRT: //afterTalk//afterHunt//afterFoundItem 
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                
                speech: [
                    {name: "", message: "Welcome back! I see you’ve completed your task. "},
                    {name: "", message: "You’ve proven your mettle and your commitment to the safety of our town"},
                    {name: "", message: "By the authority vested in me as an officer of the Guild."},
                    {name: "", message: "I hereby induct you into our guild with the rank of F"},
                    {name: "", message: "As you continue to undertake missions and prove your worth"},
                    {name: "", message: "You will ascend through the ranks, gaining greater responsibilities and recognition."},
                    {name: "", message: "Welcome to the Guild, and may your courage light the way for others."}
                ],
                questsToReceive: [
                    { 
                        qName: "talktogm2", 
                        qTtle: "Return To Guild Officer", 
                        desc: "Report your achievement", 
                        questRequirements: { reqType: false, completed: true } //reqType'enemy/item/money
                    }
                ]
            },
        ]
    },
    {
        _id: "bnkm56753df34",
        name: "Officer Demian",
        stats: { weapon: 1, accuracy: 1, critical: 1.4, dex: 1, strength: 1, magic: 1, spd: npcEnemySpd},
        lvl: 1,
        currentPlaceId: "guild",
        rank: "none",
        hp: 100,
        maxHp:100,
        mp: 100,
        maxMp: 100,
        sp: 100,
        maxSp:100,
        exp: 0,
        maxExp: 100,
        x:-10,
        z: -10,
        _dirTarg: {x:0,z:0},
        cloth: 'style3',
        pants: 'style1',
        hair: 'style1',
        boots: 'style1',
        skinColor: {r:0.45,g:0.30,b:0.16, name: "color2"},
        hairColor: {r: .9, g: 0, b: 0},
        clothColor: {r: 0, g: 0, b: 0},
        pantsColor: {r: .1, g: .2, b: .5},
        items: [{
            itemModelStyle: "prieststyle1",
            name: "priestbelt", // is also the image name
            dn: "Priest Belt",
            itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
            itemType: "belt", // sword/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
            equipAbilities: { 
                dmg: 100, def: 100, magicDmg: 100, plusStr: 0, plusDex: 0, plusInt: 0,
            }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
            // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
            consumeAbilities: { plusHp: 100, plusMp: 100, plusSp: 100, plusDmg: 10, plusSpd: 1, }, //for buffs foods potions
            equiped: true,
            soulFeed: 0,
            isEnhanceAble: true, // only for equipable items
            enhancedLevel: 0,
            durability: { current: 100, max: 100},
            price: { coinType: "bronze", pieces: 1000 },
            qnty: 1,
            desc: "A Priest Vest, Plus Holyness",
            rarity: "normal"//rare//mystical//legendary
        }
        ],
        titles: ['priest', 'warrior'],
        skills: [], 
        status: [], // sickness //poisoned etc
        regens: {sp: 1, hp: 1, mana: 1},
        monsSoul: 2, // same like points system
        coins: 300,
        aptitude: ['light'],
        blessings: ["holyHand"],
        race: "human",
        characterType:"npcStandby",// npcStandby//npcEnemy//npcFighter//npcWalk
        randomSpeech: [            
            {name: "", message: "Don't be afraid on taking risk"}, 
            {name: "", message: "Adventurers should risk their lives on battle"},
        ],
        forQuests: [
            { 
                qName: "talktodemian1",
                desc: false, 
                questType: "story", //story//hunt//reqItem }, // story means you will get reward after you talk to the
                //receiveRT: //afterTalk//afterHunt//afterFoundItem 
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                
                speech: [
                    {name: "", message: "Well, well, look who’s fresh from their first triumph. Impressive work !"},
                    {name: "", message: "But tell me, are you ready for something... more challenging?"},
                    {name: "", message: "You see, there’s a certain quest that requires a special kind of adventurer."},
                    {name: "", message: " One who’s not afraid to take risks. A secret mission, if you will"},
                    {name: "", message: "Outside these walls you will find a creature with a thin wing like a bug"},
                    {name: "", message: "This creatures spits out venom out of its stingy tail like, looks menacing"},
                    {name: "", message: "But even rookies can handle them just fine and I sense power in you"},
                    {name: "", message: "I can feel that overwhelming power in you"},
                    {name: "", message: "If you see one of them don't hesitate to engage"},
                    {name: "", message: "Now go, before anyone notices us speaking. And remember, not a word of this to anyone."},
                ],
                questsToReceive: [
                    { 
                        qName: "talktodemian2", 
                        qTtle: "Defeat The Creature", 
                        desc: "Find and defeat a certain creature", 
                        questRequirements: { reqType: "enemy", name: "orangelith", current: 0, requiredNum: 1, completed: false }, //reqType'enemy/item/money
                    }
                ]
            },
            { 
                qName: "talktodemian2",
                desc: false, 
                questType: "story", //story//hunt//reqItem }, // story means you will get reward after you talk to the
                //receiveRT: //afterTalk//afterHunt//afterFoundItem 
                hasReward: true,
                reward: {receiveRewardType: 'item', rewardItems: [
                    {
                        itemId: randomNum(), // should be string also in client
                        name: `key_f${getNumUntil(3)}`, // is also the image name
                        dn: "F Class Gate Key",
                        itemCateg: "keys",//equipable,crafting(for item looted),consum(/foods/buffs/potions/key)
                        itemType: "key", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff
                        equipAbilities: { 
                            dmg: 0, def: 0, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
                        }, //str(hp,dmg) // dex(def, spd) // int(magicDmg, mana)
                        // if you calc spd(1/10 = .1) mychar.spd += plusSpd/10// it should only be .1 to 1
                        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: 0, }, //for buffs foods potions
                        equiped: false,
                        price: { coinType: "bronze", pieces: 2 },
                        qnty: 1,
                        desc: "This key can open gates outside this dimension",
                        rarity: "rare",
                        placeDetail: {
                            bossInfo: {
                                name: "lesserdemon",
                                x: 0,
                                z: -38
                            },
                            placeStatusInfo: {
                                completed: false
                            },
                            isGatePlace: true,
                            creepsInfo: {name: "dirtGoblin"},
                            placeName: "gateplace.forestAbyss",
                            respawnPos: {x:-2+ Math.random()*5,z:-55}, // If died respawn in prev place
                            fogDetails: {
                                hasFog: true,
                                details: { ambient: {r:10,g:30,b:10}, 
                                clearColor: {r:127,g:165,b:13}}
                            },
                            ground: {
                                widthHeight: { width: 140, height: 140},
                                pos: {x:0,y:0,z:0},
                                textureName: "afterWarScene",
                                uAndvScale: 1,
                                otherRoughOrNormal: {
                                    texName: "rockey1",
                                    uAndVscale: 15
                                }
                            },
                            // walls
                            smallWallGlb: {
                                name: "brokenWall",
                                textureDets: [
                                    {name: "wall", tex:"brokenwall1", normal: "brokenwall1normal", uScale: 1, lighten: 1}
                                ]
                            },
                            smallWallsCoord: [
                                {x:0,y:0,z:-70, rotateY: 0, scaleFloat: 6.1},
                                {x:0,y:0,z:70, rotateY: 0, scaleFloat: 6.1},
                                // left  
                                {x:-70.1,y:0,z:-5, rotateY: -Math.PI/2, scaleFloat: 6.1},
                                {x:-70.3,y:0,z:-35, rotateY: Math.PI/2+.2, scaleFloat: 6.4},
                                {x:-70,y:0,z:-60, rotateY: -Math.PI/2, scaleFloat: 6.2},
                                {x:-70.4,y:0,z:5, rotateY: Math.PI/2+.2, scaleFloat: 6.3},
                                {x:-70.1,y:0,z:35, rotateY: -Math.PI/2, scaleFloat: 6.4},
                                {x:-70.3,y:0,z:60, rotateY: Math.PI/2+.2, scaleFloat: 6.3},
                    
                                {x:-10,y:0,z:63, rotateY: .4, scaleFloat: 3.4},
                                {x:-19,y:Math.random()*-1.1,z:15, rotateY: 1, scaleFloat: 2.3},
                                {x:-9,y:0,z:51, rotateY: 0.2, scaleFloat: 1.1},
                                {x:-11,y:Math.random()*-1.1,z:20, rotateY: 0.5, scaleFloat: .9},
                                {x:-30,y:0,z:5, rotateY: 2, scaleFloat: .8},
                                {x:-40,y:0,z:-7, rotateY: .1, scaleFloat: 1.3},
                                {x:-50,y:Math.random()*-1.1,z:-30, rotateY: .6, scaleFloat: 1},
                                {x:-30,y:0,z:-50, rotateY: 2.5, scaleFloat: 2.4},
                                {x:-20,y:0,z:-62, rotateY: 1.2, scaleFloat: 2.3, showBounding: true},
                                // right
                                {x:70.1,y:0,z:-5, rotateY: -Math.PI/2+.2, scaleFloat: 6.1},
                                {x:70.3,y:Math.random()*-1.1,z:-35, rotateY: Math.PI/2, scaleFloat: 6.4},
                                {x:70,y:0,z:-60, rotateY: -Math.PI/2+.2, scaleFloat: 6.2},
                                {x:70.4,y:0,z:5, rotateY: Math.PI/2+.2, scaleFloat: 6.3},
                                {x:70.1,y:Math.random()*-1.1,z:35, rotateY: -Math.PI/2, scaleFloat: 6.4},
                                {x:70.3,y:0,z:60, rotateY: Math.PI/2+.2, scaleFloat: 6.3},
                    
                                {x:22,y:0,z:60, rotateY: -.3, scaleFloat: 1.4},
                                {x:33,y:Math.random()*-1.1,z:65, rotateY: -.5, scaleFloat: 1.8},
                                {x:40,y:0,z:51, rotateY: -3, scaleFloat: 1},
                                {x:11,y:0,z:20, rotateY: -4, scaleFloat: 1.1},
                                {x:30,y:Math.random()*-1.1,z:5, rotateY: -1, scaleFloat: 2.8},
                                {x:40,y:Math.random()*-1.1,z:-7, rotateY: -2, scaleFloat: 1},
                                {x:50,y:0,z:-30, rotateY: .5, scaleFloat: 1.2},
                                {x:40,y:0,z:-50, rotateY: .7, scaleFloat: 2.3},
                                {x:20,y:0,z:-62, rotateY: 1, scaleFloat: 2.1, showBounding: true},
                    
                                // front wall
                                // {x:-5.1,y:0,z:, rotateY: -Math.PI/2+.2, scaleFloat: 6.1},
                                {x:-35.3,y:0,z:71, rotateY: .2, scaleFloat: 6.4},
                                {x:-60,y:0,z:71, rotateY:Math.PI+.2, scaleFloat: 6.2},
                                // {x:-5.4,y:0,z:71, rotateY:.2, scaleFloat: 6.3},
                                {x:35.1,y:0,z:71, rotateY:Math.PI+.2, scaleFloat: 6.4},
                                {x:60.3,y:0,z:71, rotateY:.2, scaleFloat: 6.3},
                                // back wall
                                // {x:-5.1,y:0,z:, rotateY: -Math.PI/2+.2, scaleFloat: 6.1},
                                {x:-29.3,y:0,z:-67, rotateY: .21, scaleFloat: 6.4},
                                {x:-60,y:0,z:-71, rotateY: .1, scaleFloat: 6.2},
                                // {x:5.4,y:0,z:-71, rotateY: .2, scaleFloat: 6.3},
                                {x:29.1,y:0,z:-67, rotateY: .12, scaleFloat: 6.2},
                                {x:60.3,y:0,z:-71, rotateY:.2, scaleFloat: 6.3},
                            ],
                            // stands
                            standGlb: {
                                name: "brokenStand",
                                textureDets: [
                                    {name: "stand", tex:"brokenStand", normal: "brokenStandnormal", uScale: 1, lighten: 1}
                                ]
                            },
                            standCoord: [
                                // left
                                {x:-11.1,y:0,z:-5, rotateY: -Math.random()*5, scaleFloat: 1.1},
                                {x:-21.1,y:0,z:-10, rotateY: -Math.random()*5, scaleFloat: 1.3},
                                {x:-10.1,y:0,z:-30, rotateY: -Math.random()*5, scaleFloat: 1.2},
                                {x:-20.1,y:0,z:2, rotateY: -Math.random()*5, scaleFloat: 1.4},
                                {x:-34.1,y:0,z:20, rotateY: -Math.random()*5, scaleFloat: 1.5},
                                {x:-30.1,y:0,z:42, rotateY: -Math.random()*5, scaleFloat: 1.1},
                                //right
                                {x:11.1,y:0,z:-5, rotateY: -Math.random()*5, scaleFloat: 1.1},
                                {x:21.1,y:0,z:-10, rotateY: -Math.random()*5, scaleFloat: 1.3},
                                {x:10.1,y:0,z:-30, rotateY: -Math.random()*5, scaleFloat: 1.2},
                                {x:15.1,y:0,z:2, rotateY: -Math.random()*5, scaleFloat: 1.4},
                                {x:34.1,y:0,z:20, rotateY: -Math.random()*5, scaleFloat: 1.5},
                                {x:30.1,y:0,z:42, rotateY: -Math.random()*5, scaleFloat: 1.1},
                            ],
                            // trees
                            treesGlbName: "brokenWall",
                            trees: [], //pos x y z,
                            // doors
                            doors: [
                                {
                                    glbName: "gateDoor",
                                    pos: {x: 0,y:0,z:-55, rotateY: Math.PI/2},
                                    textureDets: [
                                        {name: "gateDoor", tex:"sement3", uScale: 4, lighten: 1},
                                        {name: "gate", tex:"gate1", uScale: 1, lighten: 1},
                                    ]
                                },
                            ],
                            // paths
                            paths:[
                                
                            ],
                            shadows: [
                            ],
                            // grasses or any spam instances
                            toSpamGlbName: "flower",
                            toSpamTexName: "corngrassTex",
                            toSpamTotal: 500,
                            toSpamCoord: {fromPos: {x: -50, y: -1,z: -50},toPos: {x: 50, y: .2,z: 50}}
                        }
                    },
                ], rewardCoin: 0},                
                speech: [
                    {name: "", message: "Well, I'll be damned. Look who's returned, not just alive, but victorious."},
                    {name: "", message: "The creature you faced was not just powerful—it was a terror that has plagued us"},
                    {name: "", message: "And my deepest apologies for not telling it earlier"},
                    {name: "", message: "The task was daunting, the danger insurmountable"},
                    {name: "", message: "But here you stand, a testament to courage, skill, and sheer willpower."},
                    {name: "", message: "For that, I present to you this key as a reward."},
                    {name: "", message: "That Item is special and will take you to unknown places"},
                    {name: "", message: "Make sure to use it wisely ..."},
                ],
                questsToReceive: [
                    { 
                        qName: "talktodemian3", 
                        qTtle: "Unknown Keys", 
                        desc: "Ask demian about the keys", 
                        questRequirements: { reqType: false, completed: true } //reqType'enemy/item/money
                    }
                ]
            },
            { 
                qName: "talktodemian3",
                desc: false, 
                questType: "story", //story//hunt//reqItem }, // story means you will get reward after you talk to the
                //receiveRT: //afterTalk//afterHunt//afterFoundItem 
                hasReward: true,
                reward: {receiveRewardType: "krit", rewardItems: [], rewardCoin: 6},                
                speech: [
                    {name: "", message: "This keys origin is still unknown"},
                    {name: "", message: "But it is the reason where we get rare materials and unique abilities"},
                    {name: "", message: "Rumor says it is the proof that the evil exists"},
                    {name: "", message: "Those keys suddenly appeared when the creatures and demons appeared"},
                    {name: "", message: "So we suspect that they are all connected somehow"},
                    {name: "", message: "There are people who are studying these things"},
                    {name: "", message: "You will see a Merchant Shop near here"},
                    {name: "", message: "and you can look for a guy named pobo there"},
                    {name: "", message: "He knows more things than one ..."},
                    {name: "", message: "You can also check if he has something that you need for your adventuring"},
                    {name: "", message: "Also Please accept this small gift as a token of my apology"},
                    {name: "", message: "We called this krit here, you can buy things using this "},
                ],
                questsToReceive: [
                    { 
                        qName: "talktopobo1", 
                        qTtle: "Look for Pobo", 
                        desc: "Pobo an expert in crafting potions", 
                        questRequirements: { reqType: false, completed: true } //reqType'enemy/item/money
                    }
                ]
            },
        ]
    },
    {
        _id: "eirikgrasuvolt125",
        name: "Eirik Grausvolt",
        stats: { weapon: 1, accuracy: 1, critical: 1.4, dex: 1, strength: 1, magic: 1, spd: npcEnemySpd},
        lvl: 1,
        currentPlaceId: "wisemanVillage",
        rank: "none",
        hp: 100,
        maxHp:100,
        mp: 100,
        maxMp: 100,
        sp: 100,
        maxSp:100,
        exp: 0,
        maxExp: 100,
        x:10,
        z: 50,
        _dirTarg: {x:0,z:60},
        cloth: 'style3',
        pants: 'style2',
        hair: 'style1',
        boots: 'style1',
        skinColor: {r:0.45,g:0.30,b:0.16, name: "color2"},
        hairColor: {r:0.45,g:0.30,b:0.16},
        clothColor: {r: 0.1, g: .1, b: .8},
        pantsColor: {r: .3, g: 0, b: .2},
        items: [
            {
                itemId: randomNum(), // should be string also in client
                name: "knightaxe", // is also the image name
                dn: "Knight's Axe",
                itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
                itemType: "weapon", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff/cores
                weaponType: "axe",
                equipAbilities: { 
                    dmg: 25, def: 100, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
                },
                equiped: true,
                soulFeed: 0,
                isEnhanceAble: true, // only for equipable items
                enhancedLevel: 0,
                slots: [],// { name, dn, equipAbilities } cores
                durability: { current: 100, max: 100},
                price: { coinType: "bronze", pieces: 1000 },
                qnty: 1,
                desc: "From war to war this axe is commendable for battle, durable and sharp",
                rarity: "rare"
            },
            {
                itemId: randomNum(), // should be string also in client
                name: "bronzehelm", // is also the image name
                dn: "Bronze Helm",
                itemCateg: "equipable",//equipable,crafting(for item looted),consum(/foods/buffs/potions)
                itemType: "helmet", // weapon/staff/spear/Pauldrons//armor/greaves || //food//potion//buff/cores
                equipAbilities: {
                    dmg: 25, def: 100, resistance: 50, magicDmg: 0, plusStr: 0, plusDex: 0, plusInt: 0,
                },
                equiped: true,
                soulFeed: 0,
                isEnhanceAble: true, // only for equipable items
                enhancedLevel: 0,
                slots: [],// { name, dn, equipAbilities } cores
                durability: { current: 100, max: 100},
                price: { coinType: "bronze", pieces: 4 },
                qnty: 1,
                desc: "A bronze helmet used for blocking arrows from the goblin and any small attacks",
                rarity: "rare"
            },
        ],
        titles: ['priest', 'warrior'],
        skills: [], 
        status: [], // sickness //poisoned etc
        regens: {sp: 1, hp: 1, mana: 1},
        monsSoul: 2, // same like points system
        coins: 300,
        aptitude: ['light'],
        blessings: ["holyHand"],
        race: "human",
        characterType:"npcStandby",// npcStandby//npcEnemy//npcFighter//npcWalk
        randomSpeech: [            
            {name: "", message: "You can’t imagine how vast the world is until you see it with your own eyes"}, 
            {name: "", message: "But that vastness—there’s something else out there."},
            {name: "", message: "The miasma... it’s thicker, denser the further you go."},
            {name: "", message: "I don’t know how far I traveled, but there’s no end in sight."},
            {name: "", message: "If we don’t do something, the miasma will reach us... it's already creeping closer."}
        ],
        forQuests: []
    },
    {
        _id: "sellerEldric123",
        name: "Eldric Merchant",
        stats: { weapon: 1, accuracy: 1, critical: 1.4, dex: 1, strength: 1, magic: 1, spd: npcEnemySpd},
        lvl: 1,
        currentPlaceId: "wisemanVillage",
        rank: "none",
        hp: 100,
        maxHp:100,
        mp: 100,
        maxMp: 100,
        sp: 100,
        maxSp:100,
        exp: 0,
        maxExp: 100,
        x: -44.9,
        z: -26.4,
        _dirTarg: {x:-37.7,z:-32.4},
        cloth: 'style1',
        pants: 'style2',
        hair: 'style1',
        boots: 'style1',
        skinColor: {r:0.45,g:0.30,b:0.16, name: "color2"},
        hairColor: {r: .9, g: 0, b: 0},
        clothColor: {r: 0, g: 0, b: 0},
        pantsColor: {r: .1, g: .2, b: .5},
        items: [
        ],
        titles: ['priest', 'warrior'],
        skills: [], 
        status: [], // sickness //poisoned etc
        regens: {sp: 1, hp: 1, mana: 1},
        monsSoul: 2, // same like points system
        coins: 300,
        aptitude: ['light'],
        blessings: ["holyHand"],
        race: "human",
        characterType:"npcStandby",// npcStandby//npcEnemy//npcFighter//npcWalk
        randomSpeech: [            
            {name: "", message: "Greetings ! What can I offer to ease your journey?", cb: ()=> {
                // openCloseShop(true)
                // updateShopItem('sellerEldric123')
            }}
        ],
        forQuests: [
        ]
    },
    {
        _id: "sellerSylvan123",
        name: "Sylvan Merchant",
        stats: { weapon: 1, accuracy: 1, critical: 1.4, dex: 1, strength: 1, magic: 1, spd: npcEnemySpd},
        lvl: 1,
        currentPlaceId: "wisemanVillage",
        rank: "none",
        hp: 100,
        maxHp:100,
        mp: 100,
        maxMp: 100,
        sp: 100,
        maxSp:100,
        exp: 0,
        maxExp: 100,
        x: -40,
        z: -36,
        _dirTarg: {x:-17.7,z:-32.4},
        cloth: 'style2',
        pants: 'style1',
        hair: 'style1',
        boots: 'style1',
        skinColor: {r:0.45,g:0.30,b:0.16, name: "color2"},
        hairColor: {r: .9, g: 1, b: 0},
        clothColor: {r: .1, g: .2, b: .2},
        pantsColor: {r: .5, g: .1, b: .1},
        items: [
        ],
        titles: ['merchant'],
        skills: [], 
        status: [], // sickness //poisoned etc
        regens: {sp: 1, hp: 1, mana: 1},
        monsSoul: 2, // same like points system
        coins: 300,
        aptitude: ['light'],
        blessings: ["holyHand"],
        race: "human",
        characterType:"npcStandby",// npcStandby//npcEnemy//npcFighter//npcWalk
        randomSpeech: [            
            {name: "", message: "Nothing but a nice meal will start your day hmm ?", cb: ()=> {
                // openCloseShop(true)
                // updateShopItem('sellerSylvan123')
            }}
        ],
        forQuests: []
    },
]