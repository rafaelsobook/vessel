import { receiveAbilities } from "../charactersystem/abilitySystem.js"
import { evaluateRank, getCharState } from "../charactersystem/characterstate.js"
import { updateStoryQuestUI } from "../charactersystem/storyQuestSystem.js"
import { startQuestionare } from "../components/conversations.js"
// import { openCloseShop, updateShopItem } from "../charactersystem/shopSystem.js"
// import { activateCinemaOne } from "../tools/cameraTools.js"
import { randomNum, getNumUntil} from "../tools/tools.js"
import { SKIN_COLORS } from "../constants/skinColors.js"
import { METAL_COLOR } from "../tools/metalmat.js"
import { ADVENTURER_COLORS } from "../constants/adventurerColors.js"

const npcEnemySpd = 4
const npcPatrolSpd = 1
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
        skinColor: SKIN_COLORS.dark,
        hairColor: ADVENTURER_COLORS.black,
        clothColor: ADVENTURER_COLORS.black,
        pantsColor: ADVENTURER_COLORS.black,
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
        skinColor: SKIN_COLORS.dark,
        hairColor: ADVENTURER_COLORS.black,
        clothColor: ADVENTURER_COLORS.black,
        pantsColor: ADVENTURER_COLORS.black,
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
        skinColor: SKIN_COLORS.light,
        hairColor: ADVENTURER_COLORS.white,
        clothColor: ADVENTURER_COLORS.white,
        pantsColor: ADVENTURER_COLORS.slateBlue,
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
            metalColor: METAL_COLOR.ADAMANTINE
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
            metalColor: METAL_COLOR.ADAMANTINE
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
        metalColor: METAL_COLOR.ADAMANTINE
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
            modelName: "ironjaw",
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
            metalColor: METAL_COLOR.ADAMANTINE
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
            { // storyInfo
                qName: "armin-trial-1",
                desc: false,
                questType: "story",
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                speech: [
                    {name:"", message: "Five down. Not bad, most recruits at your stage still can't tell a slime from a puddle."},
                    {name:"", message: "Come back if you ever want another test. Assuming I think of one worth your time."},
                ],
                notCompletedSpeech: [
                    {name:"", message: "Still counting, are you? Five, when you're able."},
                ],
                questsToReceive: [
                    {
                        qName: "armin-trial-2",
                        qTtle: "Armin's Approval",
                        desc: "Let Armin know the trial is done.",
                        questRequirements: { reqType: false, completed: true },
                    }
                ],
                cbAfterNewQuestReceived: () => {
                    updateStoryQuestUI({
                        qName: "armin-trial-2",
                        qTtle: "Armin's Approval",
                        desc: "Let Armin know the trial is done.",
                        questRequirements: { reqType: false, completed: true },
                    })
                }
            },
            { // storyInfo
                qName: "armin-trial-2",
                desc: false,
                questType: "story",
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                speech: [
                    {name:"", message: "Still standing, still sharp. Good. This guild needs more of that."},
                ],
                notCompletedSpeech: [
                    {name:"", message: "..."},
                ],
                questsToReceive: []
            },
        ],
        callbackAfterRandomSpeech: () => {
            startQuestionare(400)
        }
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
        skinColor: SKIN_COLORS.light,
        hairColor: ADVENTURER_COLORS.gray,
        clothColor: ADVENTURER_COLORS.brown,
        pantsColor: ADVENTURER_COLORS.charcoal,
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
            { // storyInfo
                qName: "kraun-vein-guard-1",
                desc: false,
                questType: "story",
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                speech: [
                    {name:"", message: "Vein's clear? Good. Really good."},
                    {name:"", message: "Miners wouldn't set foot past the second tunnel marker with those things skittering around. Lost two days of work over it."},
                    {name:"", message: "That's iron ore that isn't getting mined, which means blades that aren't getting forged. Small thing, maybe, but it adds up."},
                    {name:"", message: "I won't forget this. Come back anytime you want to know more about ore, I'll talk your ear off for free."},
                ],
                notCompletedSpeech: [
                    {name:"", message: "Still hearing them skitter around near the tunnel mouth? Miners are still refusing to go in."},
                ],
                questsToReceive: [
                    {
                        qName: "kraun-vein-guard-2",
                        qTtle: "Kraun's Thanks",
                        desc: "Let Kraun know the vein is clear.",
                        questRequirements: { reqType: false, completed: true },
                    }
                ],
                cbAfterNewQuestReceived: () => {
                    updateStoryQuestUI({
                        qName: "kraun-vein-guard-2",
                        qTtle: "Kraun's Thanks",
                        desc: "Let Kraun know the vein is clear.",
                        questRequirements: { reqType: false, completed: true },
                    })
                }
            },
            { // storyInfo
                qName: "kraun-vein-guard-2",
                desc: false,
                questType: "story",
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                speech: [
                    {name:"", message: "Funny thing, some of that iron you cleared the way for is headed out to the new forge going up outside the market."},
                    {name:"", message: "Whoever's running that place is going to owe you same as I do. Small world, this guild."},
                ],
                notCompletedSpeech: [
                    {name:"", message: "..."},
                ],
                questsToReceive: []
            },
        ],
        callbackAfterRandomSpeech: () => {
            startQuestionare(20)
        }
    },
    {
        glbPath: null,
        currentPlaceId: 9,
        mode: "idle",
        _id: "109_talin",
        name: "Talin",
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
        x: 6,
        y: 0.01,
        z: -5,
        _dirTarg: {x:7,z:0},
        cloth: 'style1',
        pants: 'style2',
        hair: 'style1',
        boots: 'style1',
        skinColor: SKIN_COLORS.light,
        hairColor: ADVENTURER_COLORS.brown,
        clothColor: ADVENTURER_COLORS.darkTeal,
        pantsColor: ADVENTURER_COLORS.black,
        items: [
        ],
        titles: ['scout'],
        skills: [],
        status: [], // sickness //poisoned etc
        regens: {sp: 1, hp: 1, mana: 1},
        monsSoul: 2, // same like points system
        coins: 300,
        aptitude: ['light'],
        blessings: [],
        race: "human",
        characterType:"npcWalk",// npcStandby//npcEnemy//npcFighter//npcWalk
        patrolPoints: [
            {x: 6, y: 0.01, z: -5},
            {x: 7, y: 0.01, z: 0},
            {x: 6, y: 0.01, z: 4},
        ],
        patrolSpeed: npcPatrolSpd,
        randomSpeech: [
            {name: "", message:"..."}
        ],
        forQuests: [
            { // storyInfo
                qName: "talin-errand-1",
                desc: false,
                questType: "story",
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                speech: [
                    {name:"", message: "Word got back to me already - she says thanks, saved her a walk down here herself."},
                ],
                notCompletedSpeech: [
                    {name:"", message: "Still haven't caught her at the desk? No rush, she's not going anywhere."},
                ],
                questsToReceive: [
                    {
                        qName: "talin-errand-2",
                        qTtle: "Talin's Thanks",
                        desc: "Talin appreciates the help.",
                        questRequirements: { reqType: false, completed: true },
                    }
                ],
                cbAfterNewQuestReceived: () => {
                    updateStoryQuestUI({
                        qName: "talin-errand-2",
                        qTtle: "Talin's Thanks",
                        desc: "Talin appreciates the help.",
                        questRequirements: { reqType: false, completed: true },
                    })
                }
            },
            { // storyInfo
                qName: "talin-errand-2",
                desc: false,
                questType: "story",
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                speech: [
                    {name:"", message: "Owe you one for that. Small favors keep this place running smoother than people think."},
                ],
                notCompletedSpeech: [
                    {name:"", message: "..."},
                ],
                questsToReceive: []
            },
        ],
        callbackAfterRandomSpeech: () => {
            startQuestionare(100)
        }
    },

// Guards
    {
        glbPath: null,
        currentPlaceId: 1,
        mode: "idle",
        _id: "104_strong",
        name: "Strong",
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
        x:-4,
        y: 0.01,
        z: -33,
        _dirTarg: {x:-4,z:100},
        cloth: 'style3',
        pants: 'style2',
        hair: 'style1',
        boots: 'style1',
        skinColor: SKIN_COLORS.light,
        hairColor: ADVENTURER_COLORS.white,
        clothColor: ADVENTURER_COLORS.white,
        pantsColor: ADVENTURER_COLORS.charcoal,
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
            metalColor: METAL_COLOR.SILVER
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
            metalColor: METAL_COLOR.SILVER
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
            metalColor: METAL_COLOR.SILVER
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
            name: "orionhelm", // is also the image name
            modelName: "orionhelm",
            dn: "Orion Helm",
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
            metalColor: METAL_COLOR.SILVER
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
            {name: "", message: "Just doing my rounds. Nothing... nothing suspicious over by the fruit stalls. I check. Regularly."},
            {name: "", message: "A guard's gotta stand somewhere, right? Might as well be somewhere with a nice view."},
            {name: "", message: "*clears throat* Anyway. Market's safe. Very safe. I make sure of it. Every day."},
            {name: "", message: "She probably thinks I just really, really like fruit."}
        ],
        forQuests: [
            { // storyInfo
                qName: "strong-secret-1",
                desc: false,
                questType: "story", //story//hunt//reqItem }, // story means you will get reward after you talk to the
                //receiveRT: //afterTalk//afterHunt//afterFoundItem
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                speech: [
                    {name:"", message: "So. You actually came back. Wasn't sure you would."},
                    {name:"", message: "Look, I've been thinking. I can hold this post, keep an eye on the border edge, all of it. What I can't do is walk five feet toward that stall without my mouth stopping working."},
                    {name:"", message: "So here's what I'm asking: deal with whatever's been slipping in from the border and scaring off her morning customers. Slimes, most likely, this time of year."},
                    {name:"", message: "Nothing heroic. Just enough that she stops looking over her shoulder every ten minutes."},
                    {name:"", message: "Do that, and maybe - MAYBE - I'll find the nerve to say something myself."},
                ],
                notCompletedSpeech: [
                    {name:"", message: "Still thinking it over? No rush. I've waited eleven days, what's a few more."},
                ],
                questsToReceive: [
                    {
                        qName: "strong-pest-hunt",
                        qTtle: "Clear the Market Pests",
                        desc: "Slimes have been creeping toward Mira's fruit stall from the border. Thin them out before they scare off any more customers.",
                        questRequirements: { reqType: "enemy", name: "waterslime", current: 0, requiredNum: 5, completed: false }, //reqType'enemy/item/money
                    }
                ],
                cbAfterNewQuestReceived: () => {
                    updateStoryQuestUI({
                        qName: "strong-pest-hunt",
                        qTtle: "Clear the Market Pests",
                        desc: "Slimes have been creeping toward Mira's fruit stall from the border. Thin them out before they scare off any more customers.",
                        questRequirements: { reqType: "enemy", name: "waterslime", current: 0, requiredNum: 5, completed: false },
                    })
                }
            },
            { // storyInfo
                qName: "strong-pest-hunt",
                desc: false,
                questType: "story",
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                speech: [
                    {name:"", message: "You actually did it. Five of them, gone, just like that."},
                    {name:"", message: "I already heard about it, actually - word travels fast around a market this small. Mira mentioned it herself. Called it 'guild business.' Didn't know it was YOUR business specifically."},
                    {name:"", message: "...I haven't told her it was for her. I don't know if I will. But it's quieter over there now, and she's smiling more, and that's - that's enough, for today."},
                    {name:"", message: "Thank you. I mean it. Whatever you need from a guard who owes you one, you've got it."},
                ],
                notCompletedSpeech: [
                    {name:"", message: "Still a few of them out there. I can see them from here, actually. Very small, very slow, very killable."},
                ],
                questsToReceive: []
            },
        ],
        callbackAfterRandomSpeech: () => {
            startQuestionare(40)
        }
    },
    {
        glbPath: null,
        currentPlaceId: 1,
        mode: "idle",
        _id: "105_vords",
        name: "Vordz",
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
        x:4,
        y: 0.01,
        z: -33,
        _dirTarg: {x:4,z:100},
        cloth: 'style3',
        pants: 'style2',
        hair: 'style1',
        boots: 'style1',
        skinColor: SKIN_COLORS.light,
        hairColor: ADVENTURER_COLORS.white,
        clothColor: ADVENTURER_COLORS.white,
        pantsColor: ADVENTURER_COLORS.slateBlue,
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
            metalColor: METAL_COLOR.SILVER
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
            metalColor: METAL_COLOR.SILVER
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
            metalColor: METAL_COLOR.SILVER
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
            modelName: "ironjaw",
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
            metalColor: METAL_COLOR.SILVER
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
        
        ],
        titles: ['priest'],
        skills: [], 
        status: [], // sickness //poisoned etc
        regens: {sp: 1, hp: 1, mana: 1},
        monsSoul: 2, // same like points system
        coins: 300,
        aptitude: ['light'],
        blessings: ["holyHand"],
        race: "demon",
        characterType:"npcStandby",// npcStandby//npcEnemy//npcFighter//npcWalk
        randomSpeech: [
            {name: "", message: "State your business or move along."},
            {name: "", message: "Quiet morning. Too quiet, if you ask me. I don't trust quiet."},
            {name: "", message: "*glances toward the fruit stall, then back at you* ...What. I'm allowed to watch the market. It's the job."},
            {name: "", message: "Don't mind Strong. He gets like that sometimes. Ignore it and it usually passes. Eventually."}
        ],
        forQuests: [
            { // storyInfo
                qName: "vordz-intel-1",
                desc: false,
                questType: "story",
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                speech: [
                    {name:"", message: "Back already? Good. What did you find out?"},
                    {name:"", message: "Sunflowers, is it. And she's partial to the candied nuts old Rendal sells two stalls down, though she'd never admit it."},
                    {name:"", message: "Useful. Very useful. Rendal owes me a favor from the tavern incident, so that part's handled."},
                    {name:"", message: "The flowers, though - that's going to need someone with steadier hands than mine. And someone Strong won't recognize hovering near his post."},
                    {name:"", message: "Give me a few days to arrange it properly. Come back when the market's quieter."},
                ],
                notCompletedSpeech: [
                    {name:"", message: "Well? Any luck sniffing out what she likes?"},
                ],
                questsToReceive: [
                    {
                        qName: "vordz-intel-2",
                        qTtle: "The Arrangement",
                        desc: "Vordz is putting a plan together behind the scenes. Check back with him once it's ready.",
                        questRequirements: { reqType: false, completed: true },
                    }
                ],
                cbAfterNewQuestReceived: () => {
                    updateStoryQuestUI({
                        qName: "vordz-intel-2",
                        qTtle: "The Arrangement",
                        desc: "Vordz is putting a plan together behind the scenes. Check back with him once it's ready.",
                        questRequirements: { reqType: false, completed: true },
                    })
                }
            },
            { // storyInfo
                qName: "vordz-intel-2",
                desc: false,
                questType: "story",
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                speech: [
                    {name:"", message: "It's done. Sunflowers on her counter this morning, candied nuts included, no note, no name."},
                    {name:"", message: "She asked around, of course. Nobody in this market can keep a secret except me, apparently, because somehow it hasn't gotten back to Strong yet."},
                    {name:"", message: "I watched him walk past that stall four times this morning pretending not to look at the flowers he definitely noticed."},
                    {name:"", message: "Man's hopeless. Endearing, but hopeless. That's the last push I've got in me - whatever happens from here is on him."},
                    {name:"", message: "You did good work. Quiet, careful, exactly what I needed. I won't forget it."},
                ],
                notCompletedSpeech: [
                    {name:"", message: "Not yet. Give it time. These things can't be rushed, unlike Strong's ability to trip over his own feet."},
                ],
                questsToReceive: []
            },
        ],
        callbackAfterRandomSpeech: () => {
            startQuestionare(60)
        }
    },
    {
        glbPath: null,
        currentPlaceId: 1,
        mode: "idle",
        _id: "106_doran",
        name: "Doran",
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
        x: 7.5644731521606445,
        y: 0.01,
        z: -2.5271425247192383,
        _dirTarg: {x:12, z:-1.6},
        cloth: 'style2',
        pants: 'style2',
        hair: 'style1',
        boots: 'style1',
        skinColor: SKIN_COLORS.light,
        hairColor: ADVENTURER_COLORS.brown,
        clothColor: ADVENTURER_COLORS.brown,
        pantsColor: ADVENTURER_COLORS.charcoal,
        items: [
            {
                itemId: randomNum(), // should be string also in client
                name: "farmhat", // is also the image name
                modelName: "farmhat",
                dn: "Farmer's Hat",
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
                metalColor: METAL_COLOR.ADAMANTINE
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
            }
        ],
        titles: ['wagoner'],
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
            { // storyInfo
                qName: "doran-road-1",
                desc: false,
                questType: "story",
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                speech: [
                    {name:"", message: "Road's clear? You're a lifesaver, honestly."},
                    {name:"", message: "Horses could smell those things a mile off, wouldn't budge past the last fence post no matter how I coaxed them."},
                    {name:"", message: "Passengers were starting to ask questions too. Bad for business, worse for my nerves."},
                    {name:"", message: "I owe you one. Ride's free next time, wherever you're headed."},
                ],
                notCompletedSpeech: [
                    {name:"", message: "Road's still not clear. I'm not risking the horses on it yet."},
                ],
                questsToReceive: [
                    {
                        qName: "doran-road-2",
                        qTtle: "Doran's Thanks",
                        desc: "Let Doran know the road is clear.",
                        questRequirements: { reqType: false, completed: true },
                    }
                ],
                cbAfterNewQuestReceived: () => {
                    updateStoryQuestUI({
                        qName: "doran-road-2",
                        qTtle: "Doran's Thanks",
                        desc: "Let Doran know the road is clear.",
                        questRequirements: { reqType: false, completed: true },
                    })
                }
            },
            { // storyInfo
                qName: "doran-road-2",
                desc: false,
                questType: "story",
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                speech: [
                    {name:"", message: "Rode that stretch myself this morning, quiet as anything. Passengers'll thank you, even if they never know your name."},
                ],
                notCompletedSpeech: [
                    {name:"", message: "..."},
                ],
                questsToReceive: []
            },
        ],
        callbackAfterRandomSpeech: () => {
            startQuestionare(80)
        }
    },
    {
        glbPath: null,
        currentPlaceId: 1,
        mode: "idle",
        _id: "107_wren",
        name: "Wren",
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
        x: -2,
        y: 0.01,
        z: -3,
        _dirTarg: {x:9, z:-4},
        cloth: 'style1',
        pants: 'style1',
        hair: 'style1',
        boots: 'style1',
        skinColor: SKIN_COLORS.light,
        hairColor: ADVENTURER_COLORS.gray,
        clothColor: ADVENTURER_COLORS.slateBlue,
        pantsColor: ADVENTURER_COLORS.charcoal,
        items: [
              {
                itemId: randomNum(), // should be string also in client
                name: "farmhat", // is also the image name
                modelName: "farmhat",
                dn: "Farmer's Hat",
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
                metalColor: METAL_COLOR.ADAMANTINE
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
            }
        ],
        titles: ['scout'],
        skills: [],
        status: [], // sickness //poisoned etc
        regens: {sp: 1, hp: 1, mana: 1},
        monsSoul: 2, // same like points system
        coins: 300,
        aptitude: ['wind'],
        blessings: [],
        race: "human",
        characterType:"npcWalk",// npcStandby//npcEnemy//npcFighter//npcWalk
        patrolPoints: [
            {x: -2, y: 0.01, z: -3},
            {x: 9, y: 0.01, z: -4},
            {x: 2, y: 0.01, z: -10},
        ],
        patrolSpeed: npcPatrolSpd,
        randomSpeech: [
            {name: "", message:"..."}
        ],
        forQuests: [
            { // storyInfo
                qName: "wren-courtyard-1",
                desc: false,
                questType: "story",
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                speech: [
                    {name:"", message: "Courtyard's clean. Whatever you did, nobody up the chain needs to know I needed the help. Much obliged."},
                ],
                notCompletedSpeech: [
                    {name:"", message: "Still slipping past, are they? My rounds keep missing them somehow."},
                ],
                questsToReceive: [
                    {
                        qName: "wren-courtyard-2",
                        qTtle: "Wren's Thanks",
                        desc: "Let Wren know the courtyard is clear.",
                        questRequirements: { reqType: false, completed: true },
                    }
                ],
                cbAfterNewQuestReceived: () => {
                    updateStoryQuestUI({
                        qName: "wren-courtyard-2",
                        qTtle: "Wren's Thanks",
                        desc: "Let Wren know the courtyard is clear.",
                        questRequirements: { reqType: false, completed: true },
                    })
                }
            },
            { // storyInfo
                qName: "wren-courtyard-2",
                desc: false,
                questType: "story",
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                speech: [
                    {name:"", message: "Still quiet over there. I owe you for that one - discreetly, of course."},
                ],
                notCompletedSpeech: [
                    {name:"", message: "..."},
                ],
                questsToReceive: []
            },
        ],
        callbackAfterRandomSpeech: () => {
            startQuestionare(90)
        }
    },
    {
        glbPath: null,
        currentPlaceId: 1,
        mode: "idle",
        _id: "108_corin",
        name: "Corin",
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
        x: -6,
        y: 0.01,
        z: -31,
        _dirTarg: {x:6, z:-31},
        cloth: 'style2',
        pants: 'style2',
        hair: 'style1',
        boots: 'style2',
        skinColor: SKIN_COLORS.dark,
        hairColor: ADVENTURER_COLORS.black,
        clothColor: ADVENTURER_COLORS.maroon,
        pantsColor: ADVENTURER_COLORS.charcoal,
        items: [
            {
                itemId: randomNum(), // should be string also in client
                name: "farmhat", // is also the image name
                modelName: "farmhat",
                dn: "Farmer's Hat",
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
                metalColor: METAL_COLOR.ADAMANTINE
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
            }
        ],
        titles: ['scout'],
        skills: [],
        status: [], // sickness //poisoned etc
        regens: {sp: 1, hp: 1, mana: 1},
        monsSoul: 2, // same like points system
        coins: 300,
        aptitude: ['earth'],
        blessings: [],
        race: "human",
        characterType:"npcWalk",// npcStandby//npcEnemy//npcFighter//npcWalk
        patrolPoints: [
            {x: -6, y: 0.01, z: -31},
            {x: 6, y: 0.01, z: -31},
            {x: 0, y: 0.01, z: -36},
        ],
        patrolSpeed: npcPatrolSpd,
        randomSpeech: [
            {name: "", message:"..."}
        ],
        forQuests: [
            { // storyInfo
                qName: "corin-treeline-1",
                desc: false,
                questType: "story",
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                speech: [
                    {name:"", message: "Made my loop a lot quieter, that did. Strong and Vordz get all the credit for the market - you keep the outer ring safe, and nobody even notices."},
                    {name:"", message: "Story of a scout's life. Appreciate it either way."},
                ],
                notCompletedSpeech: [
                    {name:"", message: "Tree line's still thick with them, from what I can see out here."},
                ],
                questsToReceive: [
                    {
                        qName: "corin-treeline-2",
                        qTtle: "Corin's Thanks",
                        desc: "Let Corin know the tree line is clear.",
                        questRequirements: { reqType: false, completed: true },
                    }
                ],
                cbAfterNewQuestReceived: () => {
                    updateStoryQuestUI({
                        qName: "corin-treeline-2",
                        qTtle: "Corin's Thanks",
                        desc: "Let Corin know the tree line is clear.",
                        questRequirements: { reqType: false, completed: true },
                    })
                }
            },
            { // storyInfo
                qName: "corin-treeline-2",
                desc: false,
                questType: "story",
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                speech: [
                    {name:"", message: "Still holding quiet out there. Wider loop's a lot less trouble with you around."},
                ],
                notCompletedSpeech: [
                    {name:"", message: "..."},
                ],
                questsToReceive: []
            },
        ],
        callbackAfterRandomSpeech: () => {
            startQuestionare(95)
        }
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
        skinColor: SKIN_COLORS.dark,
        hairColor: ADVENTURER_COLORS.red,
        clothColor: ADVENTURER_COLORS.black,
        pantsColor: ADVENTURER_COLORS.blue,
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
        skinColor: SKIN_COLORS.dark,
        hairColor: ADVENTURER_COLORS.yellow,
        clothColor: ADVENTURER_COLORS.darkTeal,
        pantsColor: ADVENTURER_COLORS.maroon,
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
    {
        glbPath: null,
        currentPlaceId: 1,
        mode: "idle",
        _id: "110_bram",
        name: "Bram",
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
        // standing inside the weaponHouse/forge pair added at {x:28,z:-43} and
        // {x:29,z:-42} (see localroomdb.js originalGlbs) - between the two,
        // close enough to the forge to sell what comes out of it
        x: 28.4,
        y: 0.01,
        z: -42.6,
        _dirTarg: {x:28.4, z:-40},
        cloth: 'style2',
        pants: 'style2',
        hair: 'style1',
        boots: 'style2',
        skinColor: SKIN_COLORS.mid,
        hairColor: ADVENTURER_COLORS.gray,
        clothColor: ADVENTURER_COLORS.charcoal,
        pantsColor: ADVENTURER_COLORS.brown,
        items: [
        ],
        titles: ['blacksmith'],
        skills: [],
        status: [], // sickness //poisoned etc
        regens: {sp: 1, hp: 1, mana: 1},
        monsSoul: 2, // same like points system
        coins: 300,
        aptitude: ['fire'],
        blessings: [],
        race: "human",
        characterType:"npcStandby",// npcStandby//npcEnemy//npcFighter//npcWalk
        randomSpeech: [
            {name: "", message: "..."}
        ],
        forQuests: [],
        callbackAfterRandomSpeech: () => {
            startQuestionare(300)
        }
    }
]