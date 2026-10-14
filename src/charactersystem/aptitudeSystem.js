// aptitudeSystem.js
//
// Aptitude LEVELING - charState.aptitude entries ({element, level}, server's
// own generateAptitudes in server/routes/characterR.js) started at level 1
// and never grew before this. Now: casting a skill of a given element
// enough times raises THAT element's own aptitude level - "practice makes
// you better at it," and the same thing skillWheel.js's own aptitude-gated
// skill offers (grantSkillReward/eligibleSkillsFor) already build on.
//
// "darkness" (the server's own aptitude naming) vs "dark" (skillsData.js's
// element field) is a real, pre-existing mismatch between the two data
// sources - the same alias skillWheel.js already established is mirrored
// here so both sides keep agreeing on what "the fire aptitude" etc actually
// means.
import { getCharState, updateMyDetailsOL } from "./characterstate.js"
import { checkIfTokenSaved } from "../tools/tools.js"
import { openClosePopup } from "../tools/popupUI.js"
import { skillsData } from "../staticRecources/skillsData.js"
import { getPlayerCoord } from "./createcharacter.js"
import { createMagicCircle } from "../creations/magiccircles.js"
import { getSceneDet } from "../main/main.js"
import { emitSpawnCircle } from "../sockets/emits.js"

// skillsData.js element -> server aptitude element name. Exported -
// skillWheel.js's own eligibleSkillsFor reuses this exact table instead of
// keeping a second copy that could drift out of sync.
export const APTITUDE_ELEMENT_ALIASES = { darkness: "dark" }
// the reverse direction - needed when a brand new aptitude entry has to be
// created (see trackAptitudeUsage below) for an element the character never
// rolled an aptitude for in the first place
const ELEMENT_TO_APTITUDE_NAME = { dark: "darkness" }

// how many casts of a given element's skills raise that element's own
// aptitude level by 1 - middle of the "20-30" range this was asked for
export const USES_PER_APTITUDE_LEVEL = 25

// fire aptitude level strictly ABOVE this unlocks lightning-element skills
// (see skillWheel.js's own eligibleSkillsFor) - lightning has no aptitude
// slot of its own at all (generateAptitudes never rolls one), by design:
// it's meant to read as an offshoot of a character's fire mastery, not a
// separate element you can roll independently.
export const LIGHTNING_UNLOCK_FIRE_LEVEL = 5

// lightning casts feed the FIRE aptitude's own usage count (see
// LIGHTNING_UNLOCK_FIRE_LEVEL above for why) rather than tracking a
// separate lightning aptitude that can never actually exist.
const USAGE_ELEMENT_ALIASES = { lightning: "fire" }

function capitalize(str){
    return str.charAt(0).toUpperCase() + str.slice(1)
}

// Halric's guildmaster ritual (npcDetails.js's own return-to-guildmaster
// quest, cbAfterNewQuestReceived) grants one skill matching the player's
// own PRIMARY aptitude (aptitude[0]) - a genuine High Skill-tier one
// (skillsData.js's own skillrank 2) when their element actually has one,
// Basic Class (skillrank 0, the starter skill for that element) otherwise.
// Shared here - not computed separately in npcDetails.js's own grant code
// and createAllNpcInArea.js's own speech-selection code - so both always
// agree on which tier actually landed, since they're deriving it from the
// exact same charState.aptitude rather than each re-deriving their own
// answer that could drift apart.
//
// In PRACTICE this always resolves "high": generateAptitudes
// (server/routes/characterR.js) only ever rolls fire/water/earth/light/
// darkness as a real aptitude slot - lightning is never one (it unlocks
// off fire aptitude level instead, see LIGHTNING_UNLOCK_FIRE_LEVEL above),
// and light/dark/fire/water/earth ALL already have a skillrank:2 entry in
// skillsData.js. The "basic" fallback below is real, working code - not
// dead - it just isn't reachable through this specific ritual today unless
// that element pool changes later (e.g. a rollable element gets added
// without its own High Skill entry yet).
export function resolveGuildmasterRitualSkill(charState){
    const aptitudes = charState?.aptitude || []
    if(!aptitudes.length) return { skill: null, tier: "none" }

    const primaryElement = APTITUDE_ELEMENT_ALIASES[aptitudes[0].element] ?? aptitudes[0].element
    const highSkill = skillsData.find(sk => sk.element === primaryElement && sk.skillrank === 2)
    if(highSkill) return { skill: highSkill, tier: "high" }

    const basicSkill = skillsData.find(sk => sk.element === primaryElement)
    return { skill: basicSkill ?? null, tier: basicSkill ? "basic" : "none" }
}

// Call once per successful skill activation - attackingSystem.js's
// activateSkill is the one call site, gated there to the REAL local caster
// only (its own isMe check) and to skills that actually have a real
// elemental element (not "normal"/undefined - singlecast, dashstrike,
// multicast etc aren't tied to any one aptitude at all and never reach
// this function). Bumps that element's own usage count, leveling it up
// once it crosses USES_PER_APTITUDE_LEVEL.
//
// The use-COUNT itself is only kept in local charState memory, not saved
// to the server on every single cast (that would mean a save request per
// skill press, mid-combat, far too chatty) - it rides along on whatever
// OTHER save already happens next (there are many throughout the game).
// The LEVEL itself, once it actually changes, IS saved immediately here -
// that's the one moment actually worth a dedicated round-trip.
export function trackAptitudeUsage(skillElement){
    const charState = getCharState()
    // "normal" (singlecast/dashstrike/multicast/etc) isn't tied to any
    // element/aptitude at all - guarded here, not just left to callers, so
    // this never accidentally creates a bogus "normal" aptitude entry
    if(!charState || !skillElement || skillElement === "normal") return

    const trackedElement = USAGE_ELEMENT_ALIASES[skillElement] ?? skillElement
    const aptitudeName = ELEMENT_TO_APTITUDE_NAME[trackedElement] ?? trackedElement

    charState.aptitude = charState.aptitude || []
    let apt = charState.aptitude.find(a => (APTITUDE_ELEMENT_ALIASES[a.element] ?? a.element) === trackedElement)
    if(!apt){
        // casting a skill in an element the character never rolled an
        // aptitude for at all (e.g. a debug-granted skill via "n"/"l"/"b")
        // starts a real one at level 1 instead of silently doing nothing -
        // same "using it is how you get good at it" spirit as the rest of
        // this system
        apt = { element: aptitudeName, level: 1, uses: 0 }
        charState.aptitude.push(apt)
    }
    apt.uses = (apt.uses ?? 0) + 1

    if(apt.uses >= USES_PER_APTITUDE_LEVEL){
        apt.uses = 0
        apt.level = (apt.level ?? 1) + 1
        openClosePopup(`${capitalize(trackedElement)} aptitude reached level ${apt.level}!`, true, 2000)
        updateMyDetailsOL(charState, checkIfTokenSaved())
    }
}

// what an aptitude can be - generateAptitudes' own five (server/routes/
// characterR.js). Not lightning: that one has no slot, it unlocks off fire
// (LIGHTNING_UNLOCK_FIRE_LEVEL above).
const APTITUDE_ELEMENTS = ["fire", "water", "earth", "light", "darkness"]

// Grants the character an aptitude it doesn't have yet, at level 1 - the same
// entry generateAptitudes would have rolled for it. Takes the server's name
// or the skills' ("darkness" or "dark"). Its magic circle (apt_<element>, the
// art the guild crystal shows aptitudes with) flares on the character for
// everyone in the place, a popup says so, and it's saved. Returns whether it
// was granted - false for an unknown element or one the character already has.
//
// Everything that reads charState.aptitude picks it up from there: the skill
// wheel's offers (skillWheel.js), Halric's ritual, and the flex aura (a
// darkness aptitude shows in it within a couple of seconds).
export function receiveAptitude(elementalType){
    const charState = getCharState()
    if(!charState) return false

    const element = ELEMENT_TO_APTITUDE_NAME[elementalType] ?? elementalType
    if(!APTITUDE_ELEMENTS.includes(element)){
        console.warn(`receiveAptitude: "${elementalType}" isn't an aptitude - one of ${APTITUDE_ELEMENTS.join(", ")} (or "dark")`)
        return false
    }

    charState.aptitude = charState.aptitude || []
    const alreadyHas = charState.aptitude.some(apt => (ELEMENT_TO_APTITUDE_NAME[apt.element] ?? apt.element) === element)
    if(alreadyHas){
        openClosePopup(`You already have the ${capitalize(element)} aptitude`, true, 1500)
        return false
    }

    charState.aptitude.push({ element, level: 1, uses: 0 })

    const coord = getPlayerCoord(charState.owner)
    const scene = getSceneDet()?.scene
    if(coord && scene){
        createMagicCircle(coord.pos, scene, `apt_${element}`)
        emitSpawnCircle(coord.pos, element)
    }
    openClosePopup(`You received the ${capitalize(element)} aptitude!`, true, 2000)
    updateMyDetailsOL(charState, checkIfTokenSaved())
    return true
}
