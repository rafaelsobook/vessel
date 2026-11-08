// Which skills MY OWN character cast just now, by name.
//
// A skill runs on every client watching it (attackingSystem.js's
// activateSkill, off tcp's "skillactivated" relay), hit detection included.
// Anything that turns one of those hits into server damage has to know the
// hit came from MY cast - otherwise every client watching a spell land would
// report it, once each. Most hit paths gate on the caster's charState; the
// ones that only get handed the skill (skillEffects.js's duel-opponent
// branches, which the undead ride - enemies/undead.js) ask here instead.
// No imports, so both sides can use it without an import cycle.

// long enough to cover a cast window plus a slow projectile's flight
const RECENT_MS = 12000

const castAt = new Map()

export function markLocalSkillCast(skillName){
    if(skillName) castAt.set(skillName, performance.now())
}

export function wasCastLocallyRecently(skillName){
    const at = castAt.get(skillName)
    return at !== undefined && performance.now() - at < RECENT_MS
}
