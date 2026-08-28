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
