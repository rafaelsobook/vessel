export default [
    {
        name: 'lifeblood',
        dn: "Osiris Hearth",
        desc: "This power granted its wielder to increase their current life by some percent, making them significantly stronger and more resilient than ordinary beings.",
        lvl: 1,
        isActive: true, //if false then the trigger will turn it on
        trigger: false, // playerState(attacking, walking, idle)
        percents: {
            hp: .1, //10%
            mp: 0,
            sp: 0,
            spd: 0,
            atkSpd: 0,

            accuracy: 0,
            critical: 0,

            meeleeDmg:{ toAdd: 20, percent: 0},
            magicDmg:{ toAdd: 0, percent: 0},
            defense: { toAdd: 0, percent: 0},

            trigger: false // so when this is true it will only activate if the trigger condition met
        },
        regens: {
            hp: .1, //10%
            mp: 0,
            sp: 0,
        },
        resistance:[{name: 'critical', percent: .1}], 
        requireForLeveling: {
            requireType: "kill", //none(will level up the same as you do) // kill(if higher than (number) from you) // percent (number)a percent of that if reached below. example your mana or life reached .1 below then this will level up
        }
    },
    {
        name: 'bluecore',
        dn: "Aether's Core",
        desc: "This power granted its wielder to increase their current mana, making them terrifying in the eyes of the sages",
        lvl: 1,
        isActive: true, //if false then the trigger will turn it on
        trigger: false, // playerState(attacking, walking, idle)
        percents: {
            hp: .1, //10%
            mp: 0,
            sp: 0,
            spd: 0,
            atkSpd: 0,

            accuracy: 0,
            critical: 0,

            meeleeDmg:{ toAdd: 0, percent: 0},
            magicDmg:{ toAdd: 20, percent: 0},
            defense: { toAdd: 0, percent: 0},

            trigger: false // so when this is true it will only activate if the trigger condition met
        },
        regens: {
            hp: 0, //10%
            mp: 0.1,
            sp: 0,
        },
        resistance:[{name: 'critical', percent: .1}], 
        requireForLeveling: {
            requireType: "kill", //none(will level up the same as you do) // kill(if higher than (number) from you) // percent (number)a percent of that if reached below. example your mana or life reached .1 below then this will level up
        }
    },
    {
        name: 'goldenfort',
        dn: "Golden Fortitude",
        desc: "This power granted its wielder to increase their current stamina Making them war lords, hungry for endless war",
        lvl: 1,
        isActive: true, //if false then the trigger will turn it on
        trigger: false, // playerState(attacking, walking, idle)
        percents: {
            hp: .1, //10%
            mp: 0,
            sp: 0,
            spd: 0,
            atkSpd: 0,

            accuracy: 0,
            critical: 0,

            meeleeDmg:{ toAdd: 20, percent: 0},
            magicDmg:{ toAdd: 0, percent: 0},
            defense: { toAdd: 0, percent: 0},

            trigger: false // so when this is true it will only activate if the trigger condition met
        },
        regens: {
            hp: 0, //10%
            mp: 0,
            sp: 0.1,
        },
        resistance:[{name: 'critical', percent: .1}], 
        requireForLeveling: {
            requireType: "kill", //none(will level up the same as you do) // kill(if higher than (number) from you) // percent (number)a percent of that if reached below. example your mana or life reached .1 below then this will level up
        }
    },
    {
        name: 'devilspower',
        dn: "Devils Power",
        desc: "Unleash the dark force within, dramatically enhanced your physical speed and health. This ability grants permanent surge in agility and vitality.",
        lvl: 1,
        isActive: true, //if false then the trigger will turn it on
        trigger: false, // playerState(attacking, walking, idle)
        percents: {
            hp: .1, //10%
            mp: 0,
            sp: 0,
            spd: .3,
            atkSpd: 0,

            accuracy: 0,
            critical: 0,

            meeleeDmg:{ toAdd: 0, percent: 0},
            magicDmg:{ toAdd: 0, percent: 0},
            defense: { toAdd: 0, percent: .2},

            trigger: false // so when this is true it will only activate if the trigger condition met
        },
        regens: {
            hp: .1, //10%
            mp: 0,
            sp: 0,
        },
        resistance:[{name: 'poison', percent: .1}], 
        requireForLeveling: {
            requireType: "kill", //none(will level up the same as you do) // kill(if higher than (number) from you) // percent (number)a percent of that if reached below. example your mana or life reached .1 below then this will level up
        }
    },
    {
        name: 'chimastery',
        dn: "Chi Mastery",
        desc: "This ability enhances your energy flow, increasing your attack power and providing a protective aura that reduces incoming damage.",
        lvl: 1,
        isActive: true, //if false then the trigger will turn it on
        trigger: false, // playerState(attacking, walking, idle)
        percents: {
            hp: 0, //10%
            mp: 0,
            sp: .05,
            spd: 0,
            atkSpd: 0,

            accuracy: .2,
            critical: 0,

            meeleeDmg:{ toAdd: 30, percent: .1},
            magicDmg:{ toAdd: 0, percent: 0},
            defense: { toAdd: 0, percent: .2},

            trigger: false // so when this is true it will only activate if the trigger condition met
        },
        regens: {
            hp: .1, //10%
            mp: 0,
            sp: 0,
        },
        resistance:[], 
        requireForLeveling: {
            requireType: "kill", //none(will level up the same as you do) // kill(if higher than (number) from you) // percent (number)a percent of that if reached below. example your mana or life reached .1 below then this will level up
        }
    },
    {
        name: 'warriorsun',
        dn: "Warrior Sun",
        desc: "Channel the radiant power of the sun through your blade and fortify your defense with a shield as dark as the cosmos. This ability greatly enhances your attack strength with searing strikes and bolsters your defense with cosmic resilience, making you a beacon of might and protection on the battlefield.",
        lvl: 1,
        isActive: true, //if false then the trigger will turn it on
        trigger: false, // playerState(attacking, walking, idle)
        percents: {
            hp: 0, //10%
            mp: 0,
            sp: .05,
            spd: 0,
            atkSpd: .05,

            accuracy: .1,
            critical: 0,

            meeleeDmg:{ toAdd: 10, percent: .1},
            magicDmg:{ toAdd: 0, percent: 0},
            defense: { toAdd: 0, percent: .1},

            trigger: false // so when this is true it will only activate if the trigger condition met
        },
        regens: {
            hp: .1, //10%
            mp: 0,
            sp: 0,
        },
        resistance:[], 
        requireForLeveling: {
            requireType: "kill", //none(will level up the same as you do) // kill(if higher than (number) from you) // percent (number)a percent of that if reached below. example your mana or life reached .1 below then this will level up
        }
    },
    {
        name: 'blueflame',
        dn: "Azure Pyre",
        desc: "A cold blue fire that burns hotter than any forge. It answers to rage, not to fuel.",
        lvl: 1,
        isActive: true,
        trigger: false,
        // how often the random rolls (skill wheel, level 10) land on it, against
        // 1 for the rest - abilitySystem.js's receiveAbilities
        rarity: 1,
        percents: {
            hp: 0,
            mp: 0,
            sp: 0,
            spd: 0,
            atkSpd: 0,

            accuracy: 0,
            critical: 0,

            meeleeDmg:{ toAdd: 0, percent: 0},
            magicDmg:{ toAdd: 0, percent: 0.15},
            defense: { toAdd: 0, percent: 0},

            trigger: false
        },
        regens: {
            hp: 0,
            mp: 0.1,
            sp: 0,
        },
        resistance: [],
        tempResistance: { cold: 8, heat: 0 },
        signature: [
            "your melee hits set enemies alight with blue fire",
            "the fire keeps the cold off you"
        ],
        requireForLeveling: {
            requireType: "kill",
        }
    },
    {
        name: 'divineblade',
        dn: "Divine Edge",
        desc: "Two blades crossed beneath the light. The heavens favour those who never sheathe them.",
        lvl: 1,
        isActive: true,
        trigger: false,
        // how often the random rolls (skill wheel, level 10) land on it, against
        // 1 for the rest - abilitySystem.js's receiveAbilities
        rarity: 1,
        percents: {
            hp: 0,
            mp: 0,
            sp: 0,
            spd: 0,
            atkSpd: 0.05,

            accuracy: 0,
            critical: 0,

            meeleeDmg:{ toAdd: 20, percent: 0},
            magicDmg:{ toAdd: 0, percent: 0},
            defense: { toAdd: 0, percent: 0},

            trigger: false
        },
        regens: {
            hp: 0,
            mp: 0,
            sp: 0,
        },
        resistance: [],
        signature: [
            "with a sword or spear, every 4th hit lands a radiant slash for double damage"
        ],
        requireForLeveling: {
            requireType: "kill",
        }
    },
    {
        name: 'divinefour',
        dn: "Four Heavens' Ward",
        desc: "North, south, east and west: the four heavens stand guard over the chosen.",
        lvl: 1,
        isActive: true,
        trigger: false,
        // how often the random rolls (skill wheel, level 10) land on it, against
        // 1 for the rest - abilitySystem.js's receiveAbilities
        rarity: 0.5,
        percents: {
            hp: 0.05,
            mp: 0.05,
            sp: 0.05,
            spd: 0,
            atkSpd: 0,

            accuracy: 0,
            critical: 0,

            meeleeDmg:{ toAdd: 0, percent: 0},
            magicDmg:{ toAdd: 0, percent: 0},
            defense: { toAdd: 0, percent: 0.1},

            trigger: false
        },
        regens: {
            hp: 0,
            mp: 0,
            sp: 0,
        },
        resistance: [],
        signature: [
            "a golden ward circles you and absorbs one hit completely",
            "it returns 20 seconds after it breaks"
        ],
        requireForLeveling: {
            requireType: "kill",
        }
    },
    {
        name: 'fistdomain',
        dn: "Domain of the Fist",
        desc: "Steel is a crutch. The body is the weapon.",
        lvl: 1,
        isActive: true,
        trigger: false,
        // how often the random rolls (skill wheel, level 10) land on it, against
        // 1 for the rest - abilitySystem.js's receiveAbilities
        rarity: 1,
        percents: {
            hp: 0,
            mp: 0,
            sp: 0.1,
            spd: 0,
            atkSpd: 0,

            accuracy: 0,
            critical: 0,

            meeleeDmg:{ toAdd: 0, percent: 0},
            magicDmg:{ toAdd: 0, percent: 0},
            defense: { toAdd: 0, percent: 0},

            trigger: false
        },
        regens: {
            hp: 0.1,
            mp: 0,
            sp: 0,
        },
        resistance: [],
        signature: [
            "barehanded: +40 melee damage and +20% attack speed",
            "each hit within 1.5 s of the last adds 5% damage, up to 5 times"
        ],
        requireForLeveling: {
            requireType: "kill",
        }
    },
    {
        name: 'moonpiece',
        dn: "Shard of the Moon",
        desc: "A piece of the moon fell to earth. It still remembers the night.",
        lvl: 1,
        isActive: true,
        trigger: false,
        // how often the random rolls (skill wheel, level 10) land on it, against
        // 1 for the rest - abilitySystem.js's receiveAbilities
        rarity: 1,
        percents: {
            hp: 0,
            mp: 0.1,
            sp: 0,
            spd: 0,
            atkSpd: 0,

            accuracy: 0,
            critical: 0,

            meeleeDmg:{ toAdd: 0, percent: 0},
            magicDmg:{ toAdd: 10, percent: 0},
            defense: { toAdd: 0, percent: 0},

            trigger: false
        },
        regens: {
            hp: 0,
            mp: 0,
            sp: 0,
        },
        resistance: [],
        darkResistance: 0.15,
        signature: [
            "turns aside 15% of dark magic",
            "at night, outdoors: +25% magic damage, faster mana regen and +10% speed"
        ],
        requireForLeveling: {
            requireType: "kill",
        }
    },
    {
        name: 'redemption',
        dn: "Blood Redemption",
        desc: "The pact was simple: one death, refused.",
        lvl: 1,
        isActive: true,
        trigger: false,
        // how often the random rolls (skill wheel, level 10) land on it, against
        // 1 for the rest - abilitySystem.js's receiveAbilities
        rarity: 0.4,
        percents: {
            hp: 0.1,
            mp: 0,
            sp: 0,
            spd: 0,
            atkSpd: 0,

            accuracy: 0,
            critical: 0,

            meeleeDmg:{ toAdd: 0, percent: 0},
            magicDmg:{ toAdd: 0, percent: 0},
            defense: { toAdd: 0, percent: 0},

            trigger: false
        },
        regens: {
            hp: 0.1,
            mp: 0,
            sp: 0,
        },
        resistance: [],
        signature: [
            "a killing blow leaves you at 1 hp instead, and untouchable for 2 seconds (once every 5 minutes)",
            "under 25% hp, your hits heal you for 10% of the damage dealt"
        ],
        requireForLeveling: {
            requireType: "kill",
        }
    },
]