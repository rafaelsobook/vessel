// Per-skill/family "level up" bonuses, layered ON TOP of the generic
// baseline every skill already gets in attackingSystem.js's upgradeSkill()
// (plusDmg/dmgPm bump, explosionScale, and now projectileScale too - see
// that function). This file is the "or add an additional aura" half of the
// request: rather than every skill just getting numerically bigger, each
// FAMILY of skill gets a genuinely different kind of upgrade, matching
// whatever visual lever that family's projectile style actually has:
//
//   - blade-only (no arcs at lvl 1) -> growArcAura: UNLOCKS crackling arcs
//     partway through leveling, rather than just growing existing ones
//   - already-arced styles (lightning/halo/bladecross/spearlance/
//     crystalshard/twinhalo/boxcross) -> growArcAura: grows the arc COUNT
//   - bolt-style (particleStyles array) -> growParticleAura: literally
//     layers an ADDITIONAL particle system onto the trail at higher levels
//   - astralrain -> growSwordRain: more swords, not bigger/more-arc'd ones
//   - darkorb -> growDarkOrb: its own onHit stick-and-swell sequence itself
//     gets more extreme
//   - radiantjudgment additionally -> growBindPower: its enemyBind gets
//     longer/more reliable ("chance would go higher", literally, for the
//     one skill that has a chance-based secondary effect to grow)
//
// A skill with no onLevelUp at all (singlecastSkill) just gets the generic
// baseline - deliberate, matches its "Basic Class" identity.
//
// onLevelUp on a skill is a STRING KEY into UPGRADE_TEMPLATES below (e.g.
// "growArcAura"), never a function reference directly - see that registry's
// own comment for why. attackingSystem.js's upgradeSkill() looks the real
// function up from there and calls it once per level, AFTER the generic
// baseline - these mutate the skill object in place, same contract every
// other part of the upgrade already follows.

const AURA_PARTICLE_LEVEL_THRESHOLDS = [3, 6] // gains one more particle layer at each of these levels
const AURA_ARC_GROWTH_PER_LEVEL = 2 // +1 arc every 2 levels past lvl 1
const AURA_ARC_CAP = 6

// bolt-style skills: layers an EXTRA particle system onto the trail instead
// of just scaling the existing one up (projectileScale/the generic baseline
// already covers uniform growth) - a plain white "oneline" sparkle riding
// alongside whatever the skill's own colored trail is, reading as raw magic
// power building up underneath the element rather than a recolor of it.
export function growParticleAura(skillDetail){
    if(!AURA_PARTICLE_LEVEL_THRESHOLDS.includes(skillDetail.lvl)) return
    skillDetail.particleStyles = skillDetail.particleStyles ?? []
    skillDetail.particleStyles.push({ name: "oneline", color: "white" })
}

// anything wrapped in attachLightning (lightning/halo/bladecross/spearlance/
// crystalshard/twinhalo/boxcross, and blade once unlocked) - grows the arc
// count read by skillEffects.js's own PROJECTILE_STYLES (skill.arcCount ??
// each style's own default). _baseArcCount is remembered on first upgrade
// so repeated levels grow off the ORIGINAL starting count, not whatever the
// previous upgrade already bumped it to.
export function growArcAura(skillDetail){
    const base = skillDetail._baseArcCount ?? skillDetail.arcCount ?? 0
    skillDetail._baseArcCount = base
    skillDetail.arcCount = Math.min(AURA_ARC_CAP, base + Math.floor((skillDetail.lvl - 1) / AURA_ARC_GROWTH_PER_LEVEL))
}

// radiantjudgment only - its enemyBind itself gets stronger with level, on
// top of whichever aura template it's also using. Call combined with
// growArcAura via combineUpgrades below, not standalone.
export function growBindPower(skillDetail){
    if(!skillDetail.enemyBind) return
    skillDetail.enemyBind.bindDuration = +(skillDetail.enemyBind.bindDuration + 0.3).toFixed(2)
    skillDetail.enemyBind.bindChance = Math.min(1, +(skillDetail.enemyBind.bindChance + 0.08).toFixed(2))
}

// pyroclasmSkill only - its projectileVisual.plasma dot count grows 1-for-1
// with level (lvl 2 -> qnty:2, lvl 3 -> qnty:3, and so on - literally
// `base + (lvl-1)`, per how this was asked for), on top of whichever aura
// template it's also using (see growArcAuraAndPlasma below). _basePlasmaQnty
// remembered once (same "remembered base" pattern every other grow*
// template here uses) so repeated levels compute off the ORIGINAL starting
// qnty, not whatever a previous upgrade already bumped it to.
export function growPlasmaCount(skillDetail){
    const plasma = skillDetail.projectileVisual?.plasma
    if(!plasma) return
    const base = skillDetail._basePlasmaQnty ?? plasma.qnty
    skillDetail._basePlasmaQnty = base
    plasma.qnty = base + (skillDetail.lvl - 1)
}

// astralrain only - the whole point of the feature per its own request:
// MORE swords per level, not bigger or more-arc'd ones. Reaches min 6 /
// max 10 by lvl 5 ("if it is lvl5 maybe 10 swords", verbatim).
export function growSwordRain(skillDetail){
    if(!skillDetail.swordRain) return
    const lvl = skillDetail.lvl
    skillDetail.swordRain.max = Math.min(10, 3 + (lvl - 1) * 2)
    skillDetail.swordRain.min = Math.min(7, 2 + (lvl - 1))
}

// meteor only - same exact shape/reasoning as growSwordRain above, just
// meteors instead of swords ("when you upgrade the skill similar to
// astralrain it adds more falling projectiles", verbatim)
export function growMeteorRain(skillDetail){
    if(!skillDetail.meteorRain) return
    const lvl = skillDetail.lvl
    skillDetail.meteorRain.max = Math.min(10, 3 + (lvl - 1) * 2)
    skillDetail.meteorRain.min = Math.min(7, 2 + (lvl - 1))
}

// continentalrend only - one more spike per level, capped so the line
// doesn't grow absurdly long. _baseGroundSpikeCount remembers the
// ORIGINAL count (same "remembered once" pattern every other grow* template
// here uses) so repeated levels compute from that, not a compounding
// previous value.
export function growGroundSpikes(skillDetail){
    if(!skillDetail.groundSpikes) return
    const base = skillDetail._baseGroundSpikeCount ?? skillDetail.groundSpikes.count
    skillDetail._baseGroundSpikeCount = base
    skillDetail.groundSpikes.count = Math.min(12, base + (skillDetail.lvl - 1))
}

// darkorb only - skillEffects.js's runSingleOnHitEffect (the generic
// "stickAndGrow" onHitVisual.type handler) reads ohv.stickAndGrow.growScale/
// intensityRamp (falling back to its own defaults, 5x/1x, if absent) - so the
// stick-and-swell sequence itself becomes more extreme at higher levels, on
// top of projectileScale making its BASE size bigger too (both compound
// together automatically, since the grow animation starts from box.scaling,
// which projectileScale already set at spawn time). Was two top-level fields
// (darkorbGrowScale/darkorbGrowIntensity), then a single onHitVisual object,
// before onHitVisual became an ARRAY (a skill can layer more than one on-hit
// effect) - same numbers, [0] is the one stickAndGrow entry darkorb declares.
export function growDarkOrb(skillDetail){
    const lvl = skillDetail.lvl
    skillDetail.onHitVisual = skillDetail.onHitVisual || [{ type: "stickAndGrow" }]
    const entry = skillDetail.onHitVisual[0]
    entry.stickAndGrow = entry.stickAndGrow || {}
    entry.stickAndGrow.growScale = Math.min(16, 10 + (lvl - 1) * 1.5)
    entry.stickAndGrow.intensityRamp = Math.min(3, 1 + (lvl - 1) * 0.4)
}

// radiantjudgment only - wants both growArcAura AND growBindPower
function growArcAuraAndBind(skillDetail){
    growArcAura(skillDetail)
    growBindPower(skillDetail)
}

// pyroclasmSkill only - wants both growArcAura AND growPlasmaCount
function growArcAuraAndPlasma(skillDetail){
    growArcAura(skillDetail)
    growPlasmaCount(skillDetail)
}

// multicast only - a pure trigger has no damage/projectile of its own to
// scale, so leveling makes it cheaper and faster to re-trigger instead: its
// own mana cost and cooldown both shrink. _base* remembered once (same
// pattern as growArcAura's _baseArcCount) so repeated levels shrink off the
// ORIGINAL values, not whatever the previous upgrade already reduced them to.
export function growMulticastEfficiency(skillDetail){
    const mpDemand = skillDetail.demand?.find(d => d.name === "mp")
    if(mpDemand){
        const baseCost = skillDetail._baseMpCost ?? mpDemand.minCost
        skillDetail._baseMpCost = baseCost
        mpDemand.minCost = Math.max(8, baseCost - (skillDetail.lvl - 1) * 2)
    }

    const baseCooldown = skillDetail._baseCooldown ?? skillDetail.skillCoolDown
    skillDetail._baseCooldown = baseCooldown
    skillDetail.skillCoolDown = Math.max(3000, baseCooldown - (skillDetail.lvl - 1) * 400)
}

// Registry, looked up by STRING KEY - skillsData.js sets onLevelUp to one of
// these key names (e.g. "growArcAura"), never a function reference directly.
// This matters: skill objects get JSON.stringify'd on every save
// (characterstate.js's updateMyDetailsOL -> the REST API) and relayed over
// the socket (activate-skill/skillactivated) - a function property survives
// neither, it's silently dropped. A string key survives both perfectly, and
// attackingSystem.js's upgradeSkill() always looks the real function up
// fresh from here, so it keeps working correctly after a save/reload
// instead of quietly stopping after the first one.
export const UPGRADE_TEMPLATES = {
    growParticleAura,
    growArcAura,
    growArcAuraAndBind,
    growArcAuraAndPlasma,
    growSwordRain,
    growMeteorRain,
    growGroundSpikes,
    growDarkOrb,
    growMulticastEfficiency,
}
