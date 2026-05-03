export const charDet = {
    owner: "asdqwdasd",
    name: "sdawdasd",
    stats: { 
        weapon: 1, 
        accuracy: 1,
        critical: 1, 
        dex: 1, 
        strength: 1, 
        magic: 1, 
        spd: 3.4,
        atkSpd: .9,
    },
    lvl: 1,
    rank: "none",
    hp: 300,
    maxHp: 300,
    mp: 100,
    maxMp: 100,
    sp: 100,
    maxSp: 100,
    exp: 0,
    maxExp: 100,
    x: 0,
    z: 0,
    cloth: "rudeus",
    pants: "brown",
    hair: "aegon",
    boots: "silverboots",
    skinColor: {r: Number, g: Number, b: Number, name: String},
    hairColor: {r: Number, g: Number, b: Number},
    clothColor: {r: Number, g: Number, b: Number},
    pantsColor: {r: Number, g: Number, b: Number},
    items: {type: Array, default: []},
    skills: [
        {
            "name": "flexaura",
            "lvl": 1,
            "pointsToClaim": 1,
            "pointsForUpgrade": 1,
            "element": "normal",
            "requireMode": "any",
            "skillType": "na",
            "animationLoop": false,
            "displayName": "Flex aura",
            "castDuration": 10,
            "returnModeDura": 900,
            "skillCoolDown": 2000,
            "demand": {
                "name": "mp",
                "minCost": 1,
                "cost": 0.3
            },
            "effects": {
                "effectType": "buff",
                "dmgPm": 0,
                "plusDmg": 0,
                "chance": 10,
                "bashPower": 10
            },
            "tier": "common",
            "upgradePlus": 60,
            "desc": "You can conceal and show your aura, This is best to do when you want someone to easily spot you in some certain places. Your aura can be dense depends on your magic force."
        }
    ],
    titles: [
        "newbie"
    ],    
    currentPlace: String,
    places: { type: Array, default: [] }, 
    status: [], // sickness //poisoned etc
    regens: {sp: 0, hp: 0, mana: 0},
    monsSoul: {  default: 1}, // same like points system
    coins: {  default: 0 },
    assets: { 
        krit:  0,
        fins:  0,
        dramite: 0,
    },
    survival: { hunger:  100, sleep:  100 },
    aptitude: [],
    monsterKilled: 0,
    defeatedMonsters: [], // name of monsters
    blessings: [], // aka abilities
    // { qName: "", qTitle: "", desc: "", questType: //story//hunt//reqItem }
    // talkTo: npcName, huntRequire: { name: "daedalus"//reqItem//"goblin"//hunt, current:0, total: 5 }
    // in creation of NPC they have a list of quest that will match the title of this quest so
    // you wont have any problems what will go first
    stories:[],// for story
    quests:  [], //
    clearedQuests: [],
    race: "human",
    characterType: "player",
    lastSpoken:"none",
    deadCount:1,
    isDead:false
}