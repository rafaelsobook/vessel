export default [
    {
        name: 'lifeblood',
        dn: "Life Blood",
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
]