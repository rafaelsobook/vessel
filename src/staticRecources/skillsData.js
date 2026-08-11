// Player-castable skills (charState.skills, see skillsui.js) - a different
// thing from abilities.js's "blessings" (passive stat perks, abilitySystem.js)
// and creations/skills.js (projectile VFX spawning), which just happen to
// share the word "skill". Kept as its own static file, same pattern as
// swordsdata.js/resourceLoot.js, instead of being hand-typed inline wherever
// a skill gets granted.
//
// onLevelUp (see staticRecources/skillUpgrades.js) is each skill's own
// per-family "additional aura" upgrade flavor, called by attackingSystem.js's
// upgradeSkill() on top of the generic damage/explosionScale/projectileScale
// bumps every skill already gets - not every skill has one (singlecastSkill
// doesn't, matching its "Basic Class" identity). Always a STRING KEY into
// skillUpgrades.js's UPGRADE_TEMPLATES (e.g. "growArcAura"), never the
// function itself - skill objects get JSON.stringify'd on save/socket relay,
// which silently drops function properties but not strings. No import
// needed here for this file itself - only attackingSystem.js's upgradeSkill()
// actually looks the key up against the UPGRADE_TEMPLATES registry.
//
// Every offense skill here (effects.effectType === "offense") runs through
// ONE generic engine - skillEffects.js's castOffenseSkill/fireElementalProjectile
// - driven entirely by these fields, so adding another skill later is just
// adding another object below, not writing a new cast function:
//   - element: "normal"/"fire"/"light"/"earth"/"water"/"dark"/"lightning" - picks the
//     magic circle texture (ELEMENT_CIRCLES in skillEffects.js) unless
//     magicCircleImg overrides it directly (radiantjudgment does, for a
//     "divine1" circle instead of the plain apt_light every other light
//     skill gets - same element, a deliberately fancier circle for the
//     highest-rank skill of that element)
//   - projectileStyle: "bolt" (particle trail, see particleStyles), "blade"
//     (a tiny glowing sword flying out - reuses createWeapon's own glow
//     support), "lightning" (a glowing orb wrapped in attachLightning arcs),
//     or "halo" (a spinning glowing torus wrapped in the same arcs - just
//     radiantjudgment for now). Five more styles further down all wrap the
//     same attachLightning arc treatment around a more elaborate shape
//     instead of a plain box: "bladecross" (two createWeapon swords crossed
//     into an X, from allweapons - fire), "spearlance" (a single createWeapon
//     spear, point-first - water), "crystalshard" (a tumbling
//     MeshBuilder.CreatePolyhedron shard - earth), "twinhalo" (two tori
//     crossed perpendicular, each spinning its own axis - light,
//     seraphicascension only), "boxcross" (two thin glowing boxes crossed
//     into an X, a sigil rather than a shaped weapon - dark). "lightorb"
//     (a plain glowing sphere wrapped in the same arcs - light,
//     celestialverdict only - it used to share "twinhalo" with
//     seraphicascension, split out so the two read as genuinely different)
//   - explosionStyle: "fire"/"water"/"earth"/"light" (all four are the same
//     createExplosionBurst, just retextured/retinted/regravitied per style -
//     see EXPLOSION_STYLES) or "dark" (createImplosionBurst - particles get
//     pulled IN via a real Attractor instead of bursting out, then a bright
//     "snap" flash once they've collapsed - genuinely different shape, not
//     just a recolor)
//   - explosionColor: a GLOW_COLORS/LIGHTNING_COLORS name - tints the burst/
//     blade/lightning. The two palettes mostly share color words, but not
//     entirely (LIGHTNING_COLORS has both "purple" and "violet", GLOW_COLORS
//     only "violet") - use "violet" if a color needs to look right in both
//     an attachLightning arc AND a createExplosionBurst/particle trail
//   - skillrank: no mechanical effect, just how impressive the skill READS -
//     0 "Basic Class" (singlecast, the starter skill), 1 "Elite Skill" (the
//     fire/water/earth pairs), 2 "High Skill" (the light/dark pairs, plus the
//     ten newer violet-tinted ones further down - they share "violet" with
//     shadowbolt/voidrend, so they read as this same tier, not a standout
//     one above it), 3 "Legendary Class" (multicast), 4 "God Tier" (nothing
//     yet) - labels shown in the info panel via skillsui.js's SKILL_RANK_LABELS
//   - element: "dark" is also an engine-level RULE, not just a data field -
//     skillEffects.js's hit handler curses any enemy a dark skill lands on
//     (every dark skill, not just the two below - see that section's own
//     comment further down for the full curse mechanic)
//   - explosionScale: baseline 1, raised by attackingSystem.js's
//     upgradeSkill() as lvl climbs - multiplies into the particle system's
//     powerScale at cast time, independent of how much mana was committed
export const singlecastSkill = {
    slotNumber: 2,
    equiped: true,
    isActive: false,
    name: "singlecast",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "normal",  //fire,light,earth, water, dark,
    requireMode: "casting",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Single Cast",
    castDuration: 3,
    returnModeDura: 900,
    skillCoolDown: 2000,
    demand: [{ name: "mp", minCost: 20, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 100, chance: 1, bashPower: 0.5 },
    skillrank: 0,
    upgradePlus: 60,
    explosionColor: "blue",
    // multiplies into createExplosionBurst's powerScale at cast time (see
    // skillEffects.js) - baseline 1 at lvl 1, upgradeSkill() (attackingSystem.js)
    // raises it as the skill levels up
    explosionScale: 1,
    projectileStyle: "bolt",
    particleStyles: [{ name: "oneline", color: "blue" }],
    explosionStyle: "water",
    desc: "A basic arcane bolt. Casting it opens a 3-second window to combo into another elemental skill instead - if none is used in time, a magic circle blooms in front of your right hand and looses a bolt that deals damage based on your magic power.",
}

// --- FIRE ---
export const flamebrandSkill = {
    slotNumber: 3,
    equiped: true,
    isActive: false,
    name: "flamebrand",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "fire",
    requireMode: "casting",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Flamebrand",
    castDuration: 2,
    returnModeDura: 900,
    skillCoolDown: 1500,
    demand: [{ name: "mp", minCost: 15, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 70, chance: 1, bashPower: 0.3 },
    skillrank: 1,
    upgradePlus: 15,
    explosionColor: "red",
    explosionScale: 1,
    projectileStyle: "blade",
    explosionStyle: "fire",
    arcCount: 0, // no arcs at lvl 1 - growArcAura unlocks them partway through leveling
    onLevelUp: "growArcAura",
    desc: "A small blade of solidified flame is hurled forward, bursting into fire on impact.",
}
export const infernorushSkill = {
    slotNumber: 4,
    equiped: true,
    isActive: false,
    name: "infernorush",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "fire",
    requireMode: "casting",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Infernorush",
    castDuration: 2.8,
    returnModeDura: 900,
    skillCoolDown: 2200,
    demand: [{ name: "mp", minCost: 32, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 140, chance: 1, bashPower: 0.4 },
    skillrank: 1,
    upgradePlus: 28,
    explosionColor: "red",
    explosionScale: 1,
    projectileStyle: "bolt",
    particleStyles: [{ name: "flames", color: "red" }],
    explosionStyle: "fire",
    onLevelUp: "growParticleAura",
    desc: "A roaring column of flame trails behind the bolt, detonating into a much larger blaze.",
}

// --- WATER ---
export const tidalspikeSkill = {
    slotNumber: 5,
    equiped: true,
    isActive: false,
    name: "tidalspike",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "water",
    requireMode: "casting",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Tidalspike",
    castDuration: 2,
    returnModeDura: 900,
    skillCoolDown: 1500,
    demand: [{ name: "mp", minCost: 15, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 70, chance: 1, bashPower: 0.3 },
    skillrank: 1,
    upgradePlus: 15,
    explosionColor: "blue",
    explosionScale: 1,
    // "beam" (skillEffects.js's own PROJECTILE_STYLES) - the projectile
    // itself stays fully invisible for its whole flight; on impact, a
    // glowing plane spans from the caster to whoever it hit instead of the
    // usual traveling shaped projectile
    projectileStyle: "beam",
    explosionStyle: "water",
    arcCount: 0,
    onLevelUp: "growArcAura",
    desc: "A blade of pressurized water lances forward, bursting into a spray on impact.",
}
export const maelstromboltSkill = {
    slotNumber: 6,
    equiped: true,
    isActive: false,
    name: "maelstrombolt",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "water",
    requireMode: "casting",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Maelstrom Bolt",
    castDuration: 2.8,
    returnModeDura: 900,
    skillCoolDown: 2200,
    demand: [{ name: "mp", minCost: 32, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 140, chance: 1, bashPower: 0.4 },
    skillrank: 1,
    upgradePlus: 28,
    explosionColor: "blue",
    explosionScale: 1,
    // "icon" (skillEffects.js's own PROJECTILE_STYLES) - flies this skill's
    // own skill-bar icon (./images/skills/maelstrombolt.webp) as a
    // billboarded, spinning glowing plane instead of the plain particle-
    // trail bolt every other bolt-style skill uses
    projectileStyle: "icon",
    explosionStyle: "water",
    onLevelUp: "growParticleAura",
    desc: "Writhing tendrils of water coil around the bolt, crashing outward in a wide burst on impact.",
}

// --- EARTH ---
export const stoneshardSkill = {
    slotNumber: 7,
    equiped: true,
    isActive: false,
    name: "stoneshard",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "earth",
    requireMode: "casting",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Stoneshard",
    castDuration: 2,
    returnModeDura: 900,
    skillCoolDown: 1500,
    demand: [{ name: "mp", minCost: 15, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 75, chance: 1, bashPower: 0.35 },
    skillrank: 1,
    upgradePlus: 15,
    explosionColor: "green",
    explosionScale: 1,
    // "sting" (skillEffects.js's own PROJECTILE_STYLES) - a thin glowing
    // cone/needle instead of "blade"'s tiny sword, since this is the exact
    // skill monolith/orangelith casts (tcp's monolithBase.skills) and a
    // sword read oddly for what's meant to be an insect-like sting attack.
    // Own separate style, doesn't touch flamebrand/tidalspike/lightningbolt
    // (still "blade").
    projectileStyle: "sting",
    explosionStyle: "earth",
    magicCircleImg: "apt_earth",
    arcCount: 0,
    onLevelUp: "growArcAura",
    desc: "A jagged shard of stone is flung forward, shattering into a spray of rock and dust.",
}
export const quakeboltSkill = {
    slotNumber: 8,
    equiped: true,
    isActive: false,
    name: "quakebolt",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "earth",
    requireMode: "casting",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Quakebolt",
    castDuration: 2.8,
    returnModeDura: 900,
    skillCoolDown: 2200,
    demand: [{ name: "mp", minCost: 32, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 145, chance: 1, bashPower: 0.45 },
    skillrank: 1,
    upgradePlus: 28,
    explosionColor: "green",
    explosionScale: 1,
    projectileStyle: "bolt",
    particleStyles: [{ name: "tentacles", color: "green" }],
    explosionStyle: "earth",
    magicCircleImg: "apt_earth_second",
    onLevelUp: "growParticleAura",
    desc: "Chunks of rock tumble along in the bolt's wake, slamming down in a rockslide on impact.",
}

// --- LIGHTNING ---
// electricslime's own element (tcp/recources/enemyDetails.ts) - added
// specifically so it has a real elite skill to be assigned, matching the
// fire/water/earth pairs' exact stat shape. "lightning" not "electric" -
// see enemyDetails.ts's own comment on that naming.
export const lightningboltSkill = {
    slotNumber: 27,
    equiped: true,
    isActive: false,
    name: "lightningbolt",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "lightning",
    requireMode: "casting",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Lightning Bolt",
    castDuration: 2,
    returnModeDura: 900,
    skillCoolDown: 1500,
    demand: [{ name: "mp", minCost: 15, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 70, chance: 1, bashPower: 0.3 },
    skillrank: 1,
    upgradePlus: 15,
    explosionColor: "yellow",
    explosionScale: 1,
    projectileStyle: "blade",
    explosionStyle: "lightning",
    arcCount: 0,
    onLevelUp: "growArcAura",
    desc: "A short blade of crackling electricity is hurled forward, arcing into a bright flash on impact.",
}
export const stormsurgeSkill = {
    slotNumber: 28,
    equiped: true,
    isActive: false,
    name: "stormsurge",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "lightning",
    requireMode: "casting",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Storm Surge",
    castDuration: 2.8,
    returnModeDura: 900,
    skillCoolDown: 2200,
    demand: [{ name: "mp", minCost: 32, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 140, chance: 1, bashPower: 0.4 },
    skillrank: 1,
    upgradePlus: 28,
    explosionColor: "yellow",
    explosionScale: 1,
    projectileStyle: "lightorb",
    explosionStyle: "lightning", // unused when player-cast (stickAndGrow below) - see comment
    arcCount: 2,
    // stickAndGrow (see PROJECTILE_STYLES.lightorb's own onHit) - skips the
    // usual EXPLOSION_STYLES burst entirely: on hit the sphere itself
    // setParent()s to whatever it struck, swells to stickGrowScale (5x)
    // over half a second, then fades out over the next ~0.7s instead of
    // just disappearing, same "stick and swell" precedent darkorbSkill's
    // own onHit set (that one grows 10x with no fade, this one is smaller/
    // faster and actually fades). explosionStyle above only still matters
    // if this skill is ever enemy-cast (fireEnemySkillProjectile has no
    // onHit support, same known gap darkorbSkill already has).
    stickAndGrow: true,
    stickGrowScale: 5,
    onLevelUp: "growArcAura",
    desc: "A storm-charged bolt trails crackling arcs of electricity, discharging into a violent surge on impact.",
}

// --- LIGHT ---
export const lightpierceSkill = {
    slotNumber: 9,
    equiped: true,
    isActive: false,
    name: "lightpierce",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "light",
    requireMode: "casting",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Lightpierce",
    castDuration: 2.3,
    returnModeDura: 900,
    skillCoolDown: 1800,
    demand: [{ name: "mp", minCost: 22, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 100, chance: 1, bashPower: 0.4 },
    skillrank: 2,
    upgradePlus: 20,
    explosionColor: "white",
    explosionScale: 1,
    projectileStyle: "lightning",
    explosionStyle: "light",
    arcCount: 3,
    onLevelUp: "growArcAura",
    desc: "A radiant orb crackling with light lances forward, flashing into a bright burst on impact.",
}
export const radiantjudgmentSkill = {
    slotNumber: 10,
    equiped: true,
    isActive: false,
    name: "radiantjudgment",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "light",
    requireMode: "casting",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Radiant Judgment",
    castDuration: 3.3,
    returnModeDura: 900,
    skillCoolDown: 3000,
    demand: [{ name: "mp", minCost: 45, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 190, chance: 1, bashPower: 0.55 },
    skillrank: 2,
    upgradePlus: 38,
    explosionColor: "white",
    explosionScale: 1,
    projectileStyle: "halo",
    explosionStyle: "light",
    magicCircleImg: "divine1",
    enemyBind: { effectType: "bind", shape: "torus", bindDuration: 10.5, bindChance: 1 }, // shape: // torus, box,
    arcCount: 3,
    onLevelUp: "growArcAuraAndBind",
    desc: "A divine circle blooms and calls down a lance of pure light, erupting in a blinding flash.",
}

// --- DARK ---
export const shadowboltSkill = {
    slotNumber: 11,
    equiped: true,
    isActive: false,
    name: "shadowbolt",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "dark",
    requireMode: "casting",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Shadowbolt",
    castDuration: 2,
    returnModeDura: 900,
    skillCoolDown: 1500,
    demand: [{ name: "mp", minCost: 15, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 70, chance: 1, bashPower: 0.3 },
    skillrank: 2,
    upgradePlus: 15,
    explosionColor: "violet",
    explosionScale: 1,
    projectileStyle: "shadowblade",
    explosionStyle: "dark",
    magicCircleImg: "apt_darkness",
    arcCount: 0, // no arcs at lvl 1 - growArcAura unlocks them partway through leveling, same pattern flamebrand's own "blade" style uses
    onLevelUp: "growArcAura",
    desc: "A spectral blade wreathed in shadow tears through the air, collapsing inward on impact before snapping shut.",
}
export const voidrendSkill = {
    slotNumber: 12,
    equiped: true,
    isActive: false,
    name: "voidrend",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "dark",
    requireMode: "casting",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Voidrend",
    castDuration: 3.3,
    returnModeDura: 900,
    skillCoolDown: 3000,
    demand: [{ name: "mp", minCost: 45, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 195, chance: 1, bashPower: 0.5 },
    skillrank: 2,
    upgradePlus: 38,
    explosionColor: "violet",
    explosionScale: 1,
    projectileStyle: "lightning",
    explosionStyle: "dark",
    magicCircleImg: "apt_darkness_second",
    arcCount: 3,
    onLevelUp: "growArcAura",
    desc: "A crackling void-touched blade tears through the air, folding space inward before it snaps closed.",
}

// --- HIGH SKILL, second wave (skillrank 2) ---
// Originally built at skillrank 4 "God Tier" tinted uniformly "violet" as an
// "ascended" signature - demoted back to 2 once that stopped meaning
// anything: shadowbolt/voidrend above already use "violet" too (it's dark
// magic's own color, not an exclusive top-tier one), so a dozen skills all
// sharing one glow color just reads as "this is what violet skills look
// like," not "these ten are special." Kept the elaborate per-element
// projectile shapes (bladecross/spearlance/crystalshard/twinhalo/boxcross -
// see the projectileStyle bullet above) since those ARE genuinely distinct
// per skill; only the rank/tier framing was wrong, not the visuals
// themselves. Nothing currently sits at skillrank 4 "God Tier".
//
// The two dark ones curse their target on hit - though this is actually an
// ELEMENT rule, not a per-skill flag: skillEffects.js's hit handler curses
// on ANY dark-element hit landing (shadowbolt/voidrend included, not just
// these two), and worldsocket.js's "enemy-attacked" handler redirects a
// _cursed enemy's own attack damage back onto its own hp instead of the
// player's, every time it attacks, for the rest of its life (no duration -
// it only ever clears by the enemy dying, see createEnemy.js's
// applyEnemyCurse). See tcp/index.ts's enemyCurse handler for the
// server-authoritative half of this.
export const pyroclasmSkill = {
    slotNumber: 14,
    equiped: true,
    isActive: false,
    name: "pyroclasm",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "fire",
    requireMode: "casting",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Pyroclasm",
    castDuration: 3.5,
    returnModeDura: 900,
    skillCoolDown: 3500,
    demand: [{ name: "mp", minCost: 58, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 225, chance: 1, bashPower: 0.6 },
    skillrank: 2,
    upgradePlus: 45,
    explosionColor: "red",
    explosionScale: 1,
    projectileStyle: "bladecross",
    explosionStyle: "fire",
    arcCount: 2,
    onLevelUp: "growArcAura",
    desc: "A god-scale eruption crackling with borrowed lightning tears through the air, detonating into a mountain-splitting blaze.",
}
export const solarcataclysmSkill = {
    slotNumber: 15,
    equiped: true,
    isActive: false,
    name: "solarcataclysm",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "fire",
    requireMode: "casting",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Solar Cataclysm",
    castDuration: 4.2,
    returnModeDura: 900,
    skillCoolDown: 4200,
    demand: [{ name: "mp", minCost: 68, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 270, chance: 1, bashPower: 0.68 },
    skillrank: 2,
    upgradePlus: 52,
    explosionColor: "red",
    explosionScale: 1,
    projectileStyle: "bladecross",
    explosionStyle: "fire",
    arcCount: 2,
    onLevelUp: "growArcAura",
    desc: "A miniature sun given form, hurled as a lightning-wreathed lance that erupts into a cataclysmic solar flare.",
}

export const tsunamiwrathSkill = {
    slotNumber: 16,
    equiped: true,
    isActive: false,
    name: "tsunamiwrath",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "water",
    requireMode: "casting",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Tsunami Wrath",
    castDuration: 3.5,
    returnModeDura: 900,
    skillCoolDown: 3500,
    demand: [{ name: "mp", minCost: 58, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 225, chance: 1, bashPower: 0.6 },
    skillrank: 2,
    upgradePlus: 45,
    explosionColor: "blue",
    explosionScale: 1,
    projectileStyle: "spearlance",
    explosionStyle: "water",
    arcCount: 2,
    onLevelUp: "growArcAura",
    desc: "A wall of ocean given divine fury lances forward wreathed in crackling lightning, crashing down as a tsunami.",
}
export const abyssalcurrentSkill = {
    slotNumber: 17,
    equiped: true,
    isActive: false,
    name: "abyssalcurrent",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "water",
    requireMode: "casting",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Abyssal Current",
    castDuration: 4.2,
    returnModeDura: 900,
    skillCoolDown: 4200,
    demand: [{ name: "mp", minCost: 68, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 270, chance: 1, bashPower: 0.68 },
    skillrank: 2,
    upgradePlus: 52,
    explosionColor: "blue",
    explosionScale: 1,
    // "lightorb" (skillEffects.js's own PROJECTILE_STYLES) - a glowing
    // sphere with a Fresnel "hollow shell" material, wrapped in
    // attachLightning arcs, tinted by explosionColor above (blue) - same
    // style celestialverdict/stormsurge already reuse, just their own color
    projectileStyle: "lightorb",
    explosionStyle: "water",
    arcCount: 2,
    onLevelUp: "growArcAura",
    desc: "The crushing weight of the deepest trench rides a bolt of god-lightning, erupting into a drowning maelstrom.",
}

// continentalrend used to be a crystalshard-style projectile identical to
// seismicjudgment right below it (same shard shape, same green, same earth
// burst - only the damage numbers differed). Rebuilt into its own genuinely
// different mechanic: no projectile at all - groundSpikes = { count,
// spacing, staggerMs } marches a line of jagged rock spikes straight out
// from the caster, each one erupting a beat after the last (see
// triggerGroundSpikeLine/spawnGroundSpike in skillEffects.js). plusDmg is
// PER SPIKE, not a one-shot total - same reasoning astralrainSkill's own
// per-sword plusDmg already follows, since a target standing in the line
// can take more than one hit as spikes march past it.
export const continentalrendSkill = {
    slotNumber: 18,
    equiped: true,
    isActive: false,
    name: "continentalrend",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "earth",
    requireMode: "casting",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Continental Rend",
    castDuration: 1.4,
    returnModeDura: 900,
    skillCoolDown: 3500,
    demand: [{ name: "mp", minCost: 58, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 110, chance: 1, bashPower: 0.6 },
    skillrank: 2,
    upgradePlus: 22,
    explosionColor: "green",
    explosionScale: 1,
    explosionStyle: "earth",
    magicCircleImg: "apt_earth_second",
    groundSpikes: { count: 5, spacing: 2.2, staggerMs: 160 },
    onLevelUp: "growGroundSpikes",
    desc: "A line of jagged stone spikes tears forward from the ground, each one erupting a beat after the last.",
}
export const seismicjudgmentSkill = {
    slotNumber: 19,
    equiped: true,
    isActive: false,
    name: "seismicjudgment",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "earth",
    requireMode: "casting",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Seismic Judgment",
    castDuration: 4.2,
    returnModeDura: 900,
    skillCoolDown: 4200,
    demand: [{ name: "mp", minCost: 68, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 270, chance: 1, bashPower: 0.68 },
    skillrank: 2,
    upgradePlus: 52,
    explosionColor: "green",
    explosionScale: 1,
    projectileStyle: "crystalshard",
    explosionStyle: "earth",
    magicCircleImg: "apt_earth_second",
    arcCount: 2,
    onLevelUp: "growArcAura",
    desc: "The world's own tectonic wrath channeled through a lightning-wreathed lance, judging the ground itself to ruin.",
}

export const celestialverdictSkill = {
    slotNumber: 20,
    equiped: true,
    isActive: false,
    name: "celestialverdict",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "light",
    requireMode: "casting",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Celestial Verdict",
    castDuration: 3.5,
    returnModeDura: 900,
    skillCoolDown: 3500,
    demand: [{ name: "mp", minCost: 58, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 225, chance: 1, bashPower: 0.6 },
    skillrank: 2,
    upgradePlus: 45,
    explosionColor: "white",
    explosionScale: 1,
    projectileStyle: "lightorb",
    explosionStyle: "light",
    magicCircleImg: "divine1",
    arcCount: 2,
    onLevelUp: "growArcAura",
    desc: "A verdict passed by the heavens themselves descends through the divine circle, wreathed in crackling light.",
}
export const seraphicascensionSkill = {
    slotNumber: 21,
    equiped: true,
    isActive: false,
    name: "seraphicascension",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "light",
    requireMode: "casting",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Seraphic Ascension",
    castDuration: 4.2,
    returnModeDura: 900,
    skillCoolDown: 4200,
    demand: [{ name: "mp", minCost: 68, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 270, chance: 1, bashPower: 0.68 },
    skillrank: 2,
    upgradePlus: 52,
    explosionColor: "white",
    explosionScale: 1,
    projectileStyle: "twinhalo",
    explosionStyle: "light",
    magicCircleImg: "divine1",
    arcCount: 2,
    onLevelUp: "growArcAura",
    desc: "A seraph's own ascending light given form, a lance of pure judgment erupting in a blinding heavenly flash.",
}

// dark - both curse on hit (see the header comment above; this is an
// element rule in skillEffects.js, not something read off these objects)
export const voidcurseSkill = {
    slotNumber: 22,
    equiped: true,
    isActive: false,
    name: "voidcurse",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "dark",
    requireMode: "casting",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Void Curse",
    castDuration: 3.5,
    returnModeDura: 900,
    skillCoolDown: 3500,
    demand: [{ name: "mp", minCost: 58, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 225, chance: 1, bashPower: 0.6 },
    skillrank: 2,
    upgradePlus: 45,
    explosionColor: "violet",
    explosionScale: 1,
    projectileStyle: "boxcross",
    explosionStyle: "dark",
    magicCircleImg: "apt_darkness_second",
    arcCount: 2,
    onLevelUp: "growArcAura",
    desc: "A sliver of the void given form curses whatever it touches - every blow the cursed lands is turned back upon itself.",
}
export const abyssaldamnationSkill = {
    slotNumber: 23,
    equiped: true,
    isActive: false,
    name: "abyssaldamnation",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "dark",
    requireMode: "casting",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Abyssal Damnation",
    castDuration: 4.2,
    returnModeDura: 900,
    skillCoolDown: 4200,
    demand: [{ name: "mp", minCost: 68, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 270, chance: 1, bashPower: 0.68 },
    additionalEffects:[{ effectType: "absorb", effectiveOnDeath: true, absorbStats: ["hp", "mp", "sp", "skill"] ,absorbPercent: 1, chance: 1}],
    skillrank: 2,
    upgradePlus: 52,
    explosionColor: "violet",
    explosionScale: 1,
    projectileStyle: "boxcross",
    explosionStyle: "dark",
    magicCircleImg: "apt_darkness_second",
    arcCount: 2,
    onLevelUp: "growArcAura",
    desc: "Damnation itself given form crackles forth, cursing its target so thoroughly that its own strength becomes its undoing.",
}

// --- ASTRAL RAIN (God Tier - genuinely different mechanic, not a recolor) ---
// The invisible marker box (projectileStyle "marker" - see PROJECTILE_STYLES
// in skillEffects.js, it's completely silent and never visible) deals no
// damage and doesn't explode itself - it only marks where it lands. skill.
// swordRain = { min, max, spread } is what actually happens once it does:
// a random min-max count of swords (creations/skills.js's spawnProjectile,
// same mesh/movement the "throw weapon" mechanic uses) fall from directly
// above, each scattered within `spread` units of the marked point and
// staggered a short beat apart rather than all landing at once - see
// triggerSwordRain/spawnFallingSword in skillEffects.js for the full
// mechanic (including why it can't use spawnProjectile's own hit detection -
// that only ever triggers against players, never enemies).
export const astralrainSkill = {
    slotNumber: 24,
    equiped: true,
    isActive: false,
    name: "astralrain",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "light",
    requireMode: "casting",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Astral Rain",
    castDuration: 1.8,
    returnModeDura: 900,
    skillCoolDown: 4500,
    demand: [{ name: "mp", minCost: 62, cost: 0 }],
    // plusDmg here is PER SWORD, not a one-shot total - 2-3 swords each
    // landing for this much adds up to noticeably more than a single-bolt
    // skill of similar mana cost, same reasoning multicast's own (lower)
    // per-shot plusDmg already follows
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 90, chance: 1, bashPower: 0.4 },
    skillrank: 4,
    upgradePlus: 18,
    explosionColor: "white",
    explosionScale: 1,
    projectileStyle: "marker",
    explosionStyle: "light",
    swordRain: { min: 2, max: 3, spread: 4.5 },
    onLevelUp: "growSwordRain",
    desc: "An invisible arrow marks its target - moments later, blades of astral light rain down from above.",
}

// --- DARK ORB (God Tier - dark magic's own signature, alongside astralrain) ---
// projectileStyle "darkorb" (see skillEffects.js) is a genuinely built mesh -
// a glassy dark-purple sphere (real StandardMaterial Fresnel rim glow + a
// NoiseProceduralTexture veined bump map) wrapped around a jagged white-
// glowing splinter built with createRock.js's own displaceWithNoise, plus
// two orbiting particle layers (a dark smoky aura, a purple spark layer) -
// not a recolor of an existing shape. It also skips the usual explode-and-
// vanish impact entirely: darkorb is the one projectile style with its own
// onHit hook (see fireElementalProjectile), so explosionStyle below is
// unused for this skill - on hit it setParent()s to whatever it struck and
// swells 10x "like a wildfire" instead (both particle layers grow with it),
// only actually despawning once that sequence finishes. element "dark" still
// curses its target for free on hit, same as every other dark-element skill
// (see this file's top header comment on that rule) - that part isn't
// skipped, only the visual explosion is.
export const darkorbSkill = {
    slotNumber: 25,
    equiped: true,
    isActive: false,
    name: "darkorb",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "dark",
    requireMode: "casting",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Dark Orb",
    castDuration: 4,
    returnModeDura: 900,
    skillCoolDown: 4500,
    demand: [{ name: "mp", minCost: 65, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 260, chance: 1, bashPower: 0.62 },
    skillrank: 4,
    upgradePlus: 50,
    explosionColor: "violet",
    explosionScale: 1,
    projectileStyle: "darkorb",
    explosionStyle: "dark", // unused by darkorb itself - see comment above
    onLevelUp: "growDarkOrb",
    desc: "A crackling black-purple sphere given form - a white-hot splinter caged inside branching dark veins, latching onto its target and swelling into an inferno of caged energy.",
}

// --- BURST SHOTS (normal element) - formerly named "multicast" ---
// Renamed to free up "multicast" for the new pure-trigger skill below (see
// its own header comment) - this skill's own mechanic is completely
// unchanged. requireMode-gated + mp-charged exactly like every offense
// skill above, but dispatched separately in attackingSystem.js (not through
// castOffenseSkill) - see castMulticast in skillEffects.js. lvl+1 magic
// circles, one at a time, each firing its own bolt - so this hits harder in
// total the more it's upgraded, without upgradeSkill needing any
// special-casing for it.
export const burstshotsSkill = {
    slotNumber: 13,
    equiped: true,
    isActive: false,
    name: "burstshots",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "normal",
    requireMode: "casting",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Burst Shots",
    castDuration: 1.4, // per-circle interval, not a one-shot total wait
    returnModeDura: 900,
    skillCoolDown: 4000,
    demand: [{ name: "mp", minCost: 40, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 55, chance: 1, bashPower: 0.25 },
    skillrank: 3,
    upgradePlus: 20,
    explosionColor: "blue",
    explosionScale: 1,
    projectileStyle: "bolt",
    particleStyles: [{ name: "oneline", color: "blue" }],
    explosionStyle: "water",
    onLevelUp: "growParticleAura",
    desc: "Weaves multiple arcane circles in sequence - one at a time, never all at once - each loosing its own bolt. More circles at higher levels.",
}

// --- MULTICAST - a pure TRIGGER, not a caster ---
// Activating this fires NO projectile/damage of its own. effects.effectType
// is "trigger" (not "offense"), so attackingSystem.js's activateSkill switch
// explicitly no-ops for it instead of routing it through castOffenseSkill -
// see that case's own comment. All the REAL behavior lives in skillsui.js's
// slotbuttons click handler: once this skill's own mode/mana gate passes,
// it programmatically .click()s every OTHER assigned skill-slot-button,
// running each one through the exact same activation path (mana check/
// charge, requireMode gate, multiplayer relay) a real manual press would -
// so pressing this ONE button can trigger up to 4 other skills at once (5
// total including this one, though this one deals no damage itself).
// effects.effectType === "trigger" is also what that same click handler
// checks to (a) know to run the cascade and (b) auto-reset isActive shortly
// after, alongside "offense" skills, rather than staying stuck active like
// a toggle.
export const multicastSkill = {
    slotNumber: 26,
    equiped: true,
    isActive: false,
    name: "multicast",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "normal",
    requireMode: "casting",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Multicast",
    castDuration: 0.2, // no real cast window of its own - just how long the auto-reset (see skillsui.js) waits before flipping isActive back off
    returnModeDura: 900,
    skillCoolDown: 6000,
    demand: [{ name: "mp", minCost: 20, cost: 0 }],
    effects: { effectType: "trigger", dmgPm: 0, plusDmg: 0, chance: 1, bashPower: 0 },
    skillrank: 4,
    upgradePlus: 0,
    // no damage/projectile to scale, so leveling makes it cheaper and
    // faster to re-trigger instead - see growMulticastEfficiency
    onLevelUp: "growMulticastEfficiency",
    desc: "Channels no power of its own - instead, it triggers every other skill currently in your bar, all at once.",
}

// --- DISINTEGRATION (fire) - a ground trap, not a projectile ---
// requireMode intentionally OMITTED, not set to "none" - skillsui.js's own
// gate is `if(skill.requireMode && charState.mode !== skill.requireMode)`,
// which only skips the check when requireMode is FALSY. The literal string
// "none" is truthy, so setting it to that would make the gate demand
// charState.mode === "none" forever - a mode that doesn't exist and never
// will - permanently locking the skill instead of freeing it. Leaving the
// field out entirely is what every other unrestricted-mode skill in this
// game actually does to mean "no gate."
//
// slotNumber bumped from 13 to 29 - 13 is already burstshotsSkill's own
// slot (see above); giveSkill would auto-bump a live collision at grant
// time anyway, but there's no reason to declare a collision in the static
// data when 29 is simply the next free slot (every other number 2-28 is
// already claimed - see every other skill's own slotNumber above).
//
// groundTrap (new flag, read by castOffenseSkill/spawnGroundTrap in
// skillEffects.js) replaces the usual fired projectile entirely: after the
// normal castDuration windup, a flat ground-rune circle blooms a short
// distance in front of the caster (createMagicCircle with no
// facingDirection - lies flat facing the sky, not the usual upright
// in-front-of-hand circle) with an invisible box trigger over the same
// spot. The FIRST enemy to walk into that box consumes the trap: fire
// particles burst, they take a hit, and get bound via enemyBind below -
// same bind mechanic radiantjudgmentSkill already uses, just triggered by
// a walked-into trap instead of a landed hit.
export const disintegrationSkill = {
    slotNumber: 29,
    equiped: true,
    isActive: false,
    name: "disintegration",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "fire",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Disintegration",
    castDuration: 1.4,
    returnModeDura: 900,
    skillCoolDown: 4000,
    demand: [{ name: "mp", minCost: 40, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 100, chance: 1, bashPower: 0.25 },
    skillrank: 3,
    upgradePlus: 20,
    explosionColor: "fire",
    explosionScale: 1,
    projectileStyle: "trap",
    // distance omitted - defaults to 0 (skillEffects.js's own
    // GROUND_TRAP_DEFAULT_DISTANCE), i.e. centered on the caster's own
    // body, not thrown out in front like a targeted skill would be
    groundTrap: { radius: 1.8, duration: 8000 },
    explosionStyle: "fire",
    magicCircleImg: "apt_fire_second",
    enemyBind: { effectType: "bind", shape: "torus", bindDuration: 6, bindChance: 1 },
    onLevelUp: "growParticleAura",
    desc: "It traps the enemy in a circle of magic, then burn them until they disintegrate",
}

// --- MASSIVE DISINTEGRATION (fire) - the AOE version of disintegrationSkill ---
// Same groundTrap mechanic, but with aoe: true (new flag, read by
// castOffenseSkill/spawnMassGroundTrap in skillEffects.js) - instead of a
// small trap waiting for one enemy to walk into it, a much bigger circle
// blooms and, a beat later, hits EVERY enemy currently within radius at
// once (see spawnMassGroundTrap's own header comment for the full
// mechanism - it reuses disintegrationSkill's own applyDisintegrationHit
// for the actual fire-burst/burning-body/hit/bind, so both skills apply
// the identical effect, just triggered differently).
//
// radius: 10 scales LINEARLY with level (getGroundTrapRadius multiplies by
// skill.lvl whenever aoe is set) - 10 at lvl 1, 20 at lvl 2, exactly as
// specified, unlike disintegrationSkill's own radius which stays fixed
// regardless of level (aoe isn't set on it).
export const massivedisintegrationSkill = {
    slotNumber: 30,
    equiped: true,
    isActive: false,
    name: "massivedisintegration",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "fire",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Massive Disintegration",
    castDuration: 3,
    returnModeDura: 900,
    skillCoolDown: 14000,
    demand: [{ name: "mp", minCost: 140, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 220, chance: 1, bashPower: 0.55 },
    skillrank: 4,
    upgradePlus: 40,
    explosionColor: "fire",
    explosionScale: 1,
    projectileStyle: "trap",
    // distance omitted - defaults to 0, centered on the caster's own body,
    // same as disintegrationSkill's own trap
    groundTrap: { radius: 10, duration: 8000, aoe: true },
    explosionStyle: "fire",
    magicCircleImg: "apt_fire_second",
    enemyBind: { effectType: "bind", shape: "torus", bindDuration: 6, bindChance: 1 },
    onLevelUp: "growParticleAura",
    desc: "Summons a massive circle of annihilation - anyone caught near or inside its radius is consumed by disintegrating flame.",
}

export const skillsData = [
    singlecastSkill,
    flamebrandSkill, infernorushSkill,
    tidalspikeSkill, maelstromboltSkill,
    stoneshardSkill, quakeboltSkill,
    lightningboltSkill, stormsurgeSkill,
    lightpierceSkill, radiantjudgmentSkill,
    shadowboltSkill, voidrendSkill,
    pyroclasmSkill, solarcataclysmSkill,
    tsunamiwrathSkill, abyssalcurrentSkill,
    continentalrendSkill, seismicjudgmentSkill,
    celestialverdictSkill, seraphicascensionSkill,
    voidcurseSkill, abyssaldamnationSkill,
    astralrainSkill,
    darkorbSkill,
    burstshotsSkill,
    multicastSkill, disintegrationSkill, massivedisintegrationSkill
]

// name -> skill object, e.g. skillsData.js's own exports plus anything an
// enemy is assigned (tcp/recources/enemyDetails.ts's det.skills, an array
// of skill NAMES - the server only ever knows enemies as plain data, it has
// no notion of the actual skill objects, so createEnemy.js/worldsocket.js
// resolve the real object through this map). Built once here instead of at
// each call site.
export const SKILLS_BY_NAME = Object.fromEntries(skillsData.map(skill => [skill.name, skill]))
