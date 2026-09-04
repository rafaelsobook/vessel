import { getCharState, updateMyDetailsOL } from "./characterstate.js"
import { checkIfTokenSaved } from "../tools/tools.js"
import { popupReceiveAchievementUI } from "../components/achievementAcquiredUI.js"

// Draft list - every entry here is grounded in a system that actually
// exists in this game already (the quest chain, duelSystem.js, mining/
// woodcutting in areascene.js, craftingui.js/campcraft.js, the aptitude/
// skill-tier ladder, etc), nothing speculative bolted on.
// (server/models/charDetM.js's own achievements:[] field is where earned
// ones get persisted, via receiveAchievement below.)
//
// Wiring status - most entries now have a real receiveAchievement() call at
// their trigger point (first-forge: craftingui.js, first-blood/monolith-
// breaker/into-the-dark/demons-bane: createEnemy.js's defeatedAmonster,
// camp-builder: campcraft.js, miner/woodcutter/into-the-wild: areascene.js,
// treasure-hunter: createtreasure.js, awakened/elite-skill: skillsui.js,
// first-duel: duelSystem.js, proven-hunter/three-of-a-kind/the-guildmaster-
// calls: createAllNpcInArea.js). Five are still NOT wired, each blocked on
// something that doesn't exist yet rather than a missed spot:
//   - slime-slayer / undefeated: both need a persisted COUNTER (kills of a
//     given species; win/loss streak) - no per-species kill count or
//     duelHistory-writing exists yet (charDetM.js's duelHistory field is
//     declared but nothing writes to it), and bolting one on as a side
//     effect of an achievements pass felt like the wrong place to invent
//     that schema/logic.
//   - guild-initiate: gated on the Aptitude Crystal interaction
//     (npcDetails.js's "touchTheCrystal" quest) - no code anywhere actually
//     completes that quest yet (no crystal mesh/interact-trigger found), so
//     there's no real trigger to hook.
//   - storm-within / matchmaker: no aptitude-threshold check or Renarden
//     match-making quest completion hook exists yet to hang these off of.
//
// icon path convention (not stored per-entry, same reasoning
// components/campcraft.js's own craftIconPath already settled on - a
// stored path can drift out of sync with a renamed/typo'd `name`, a
// derived one can't): ./images/achievements/${achievement.name}.webp
export function achievementIconPath(achievement){
    return `./images/achievements/${achievement.name}.webp`
}

export const achievements = [
    // --- Story / Progression ---
    {
        name: "guild-initiate",
        dn: "Guild Initiate",
        desc: "Register with the guild and have your aptitude read by the crystal.",
        category: "story",
    },
    {
        name: "proven-hunter",
        dn: "Proven Hunter",
        desc: "Complete Prove Your Worth for Bram.",
        category: "story",
    },
    {
        name: "first-forge",
        dn: "First Forge",
        desc: "Craft your very first weapon at Bram's anvil.",
        category: "story",
    },
    {
        name: "the-guildmaster-calls",
        dn: "The Guildmaster Calls",
        desc: "Be summoned back to Halric's office.",
        category: "story",
    },
    {
        name: "three-of-a-kind",
        dn: "Three of a Kind",
        desc: "Gather all nine elemental slime cores for Halric.",
        category: "story",
    },

    // --- Combat ---
    {
        name: "first-blood",
        dn: "First Blood",
        desc: "Defeat your first enemy.",
        category: "combat",
    },
    {
        name: "slime-slayer",
        dn: "Slime Slayer",
        desc: "Defeat 50 slimes, of any element.",
        category: "combat",
    },
    {
        name: "monolith-breaker",
        dn: "Monolith Breaker",
        desc: "Bring down a monolith.",
        category: "combat",
    },
    {
        name: "into-the-dark",
        dn: "Into the Dark",
        desc: "Defeat a dark slime out past the border.",
        category: "combat",
    },
    {
        name: "demons-bane",
        dn: "Demon's Bane",
        desc: "Defeat the lesser demon at the heart of the openworld.",
        category: "combat",
    },

    // --- Crafting & Gathering ---
    {
        name: "camp-builder",
        dn: "Camp Builder",
        desc: "Build your first bonfire.",
        category: "crafting",
    },
    {
        name: "miner",
        dn: "Miner",
        desc: "Mine your first ore.",
        category: "gathering",
    },
    {
        name: "woodcutter",
        dn: "Woodcutter",
        desc: "Chop your first tree.",
        category: "gathering",
    },

    // --- Aptitude & Skills ---
    {
        name: "awakened",
        dn: "Awakened",
        desc: "Learn your first skill.",
        category: "skills",
    },
    {
        name: "elite-skill",
        dn: "Rising Above",
        desc: "Own a skill of Elite rank or higher.",
        category: "skills",
    },
    {
        name: "storm-within",
        dn: "Storm Within",
        desc: "Raise your fire aptitude high enough to awaken lightning.",
        category: "skills",
    },

    // --- Duels ---
    {
        name: "first-duel",
        dn: "First Duel",
        desc: "Complete your first duel against another Hunter.",
        category: "duel",
    },
    {
        name: "undefeated",
        dn: "Undefeated",
        desc: "Win 5 duels without a single loss.",
        category: "duel",
    },

    // --- Social / Exploration ---
    {
        name: "matchmaker",
        dn: "Matchmaker",
        desc: "Help a certain guard finally work up the nerve.",
        category: "social",
    },
    {
        name: "into-the-wild",
        dn: "Into the Wild",
        desc: "Set foot in the openworld for the first time.",
        category: "exploration",
    },
    {
        name: "treasure-hunter",
        dn: "Treasure Hunter",
        desc: "Open your first treasure chest.",
        category: "exploration",
    },
]

// Grants the named achievement - same "already have it -> no-op with a
// popup, otherwise push + persist + celebrate" shape skillsui.js's own
// giveSkill already established for skills. name is one of the achievements
// array's own `name` keys above, not a display name - the same convention
// giveSkill/obtain() etc already use their item/skill's `name` field for.
export async function receiveAchievement(name){
    const charState = getCharState()
    if(!charState) return

    const achievementDetail = achievements.find(a => a.name === name)
    if(!achievementDetail){
        // a typo'd/unknown name here is a real bug in whatever called this,
        // not a normal "already earned" case - warn instead of failing silently
        return console.warn(`[achievement] no achievement data for "${name}"`)
    }

    charState.achievements = charState.achievements || []
    const alreadyHave = charState.achievements.some(a => a.name === name)
    if(alreadyHave) return

    charState.achievements.push(achievementDetail)
    await updateMyDetailsOL(charState, checkIfTokenSaved())
    // ceremonial banner - components/achievementAcquiredUI.js's
    // popupReceiveAchievementUI, same treatment titleUI.js's
    // popupReceiveTitleUI gives new titles
    popupReceiveAchievementUI(achievementDetail)
}