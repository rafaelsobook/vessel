// A WEAPON'S ON-HIT EFFECTS - item.effectsWhenHit, one entry per effect:
//
//   { effectName: "bash", distanceKnockback: 4, triggerWhen: "critical", particlesystem: null, texture: null }
//   { effectName: "stun", stunDuration: 1.5,    triggerWhen: "critical", particlesystem: null, texture: null }
//
//   effectName         bash - the enemy is thrown straight back from whoever hit it
//                             (charactersystem/knockback.js's knockEnemyAway)
//                      stun - it can't move or attack for stunDuration seconds, stars
//                             circling its head (hammers - createEnemy.js's "stun" bind)
//   distanceKnockback  bash: how far it's thrown, metres
//   stunDuration       stun: seconds
//   triggerWhen        when it happens: "critical" (only on a critical hit), or
//                      "always" / left out (every hit)
//   particlesystem     reserved for a custom effect look - nothing reads it yet
//   texture            bash: a particle texture name (images/particles/) for the burst
//                      at its feet in place of the default sparks; null for those
//
// The burn the Majestic Sword and Azure Pyre carry is an older entry in the same
// list ({ effectType: "burn", ... }) - read by its own code, untouched by this.
//
// Only a weapon's blow on an enemy reads these: the world's enemies here and in
// createEnemy.js, the fog's undead on the server (tcp/recources/undead.ts, which
// has its own copy of triggerMet). Another player or a bot isn't thrown.

export const BASH_ON_CRITICAL = { effectName: "bash", distanceKnockback: 4, triggerWhen: "critical", particlesystem: null, texture: null }
export const STUN_ON_CRITICAL = { effectName: "stun", stunDuration: 1.5, triggerWhen: "critical", particlesystem: null, texture: null }

/** What a weapon of this type carries by default - every weapon bashes, a hammer stuns too. */
export function effectsWhenHitFor(weaponType){
    const effects = [{ ...BASH_ON_CRITICAL }]
    if(weaponType === "hammer") effects.push({ ...STUN_ON_CRITICAL })
    return effects
}

/**
 * The on-hit effects of the weapon in hand: its own effectsWhenHit, or - for
 * one made before weapons carried them (already in a player's bag, saved
 * without it) - its type's default. undefined bare-handed.
 */
export function weaponEffectsWhenHit(weapon){
    if(!weapon) return undefined
    return weapon.effectsWhenHit ?? effectsWhenHitFor(weapon.weaponType)
}

/** Whether an effect's triggerWhen is met by this hit ({ isCritical }). */
export function triggerMet(triggerWhen, hit){
    if(!triggerWhen || triggerWhen === "always") return true
    if(triggerWhen === "critical") return !!hit?.isCritical
    return false
}

/** The effect named `effectName` in `effects` whose trigger this hit meets, or null. */
export function triggeredEffect(effects, effectName, hit){
    if(!Array.isArray(effects)) return null
    return effects.find(effect => effect?.effectName === effectName && triggerMet(effect.triggerWhen, hit)) ?? null
}
