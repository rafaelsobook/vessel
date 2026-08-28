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
// ONE generic engine - skillEffects.js's castOffenseSkill/fireElementalProjectile/
// renderGenericProjectile/runOnHitVisual - driven entirely by these fields,
// so adding another skill later is just adding another object below, not
// writing a new render function:
//   - element: "normal"/"fire"/"light"/"earth"/"water"/"dark"/"lightning" - picks the
//     magic circle texture (ELEMENT_CIRCLES in skillEffects.js) unless
//     magicCircleImg overrides it directly (radiantjudgment does, for a
//     "divine1" circle instead of the plain apt_light every other light
//     skill gets - same element, a deliberately fancier circle for the
//     highest-rank skill of that element)
//   - explosionColor: a GLOW_COLORS name (tools/materials.js) - the single
//     color source for BOTH the projectile's own material (projectileVisual)
//     AND its impact visual (onHitVisual) - not duplicated as raw {r,g,b}
//     anywhere, every material helper (createGlowingMat/fresnelMat) already
//     takes a palette name, not RGB
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
//
// projectileVisual - the REAL, functional description of what a skill's
// projectile looks like in flight. skillEffects.js's renderGenericProjectile
// reads this directly - there is no more per-skill hand-written render
// function, adding/re-skinning a skill's look is entirely a data edit here.
//   - useProjectile: false = no projectile fires at all (groundTrap/
//     groundSpikes/buff/trigger skills already route to their own dedicated
//     mechanic before fireElementalProjectile is ever called)
//   - visible: does a real mesh/particle trail appear while it's actually in
//     flight? false for "marker" (silent+invisible targeting box) and "beam"
//     (nothing exists until impact)
//   - shape: "sphere" | "box" | "cone" | "icosahedron" | "torus" | "plane" |
//     "particle" | "weapon" | "custom" | undefined (no shape at all).
//     "box" reuses the shared projectile box mesh itself directly (no extra
//     child mesh) - shapeParams.boxScale is its own extra size multiplier on
//     top of projectileScale, since that shared box starts pre-sized larger
//     than any other shape's own dimensions. "weapon" loads a real GLB
//     weapon asset via createWeapon (the `weapon` field: type/rarities/scale).
//     "custom" is darkorb only - hand-built mesh/material too bespoke for the
//     shape/material model, fully described via the `customMesh` field
//     instead (still pure data, just a much bigger bucket of it).
//   - shapeParams: per-shape numeric dimensions (diameter/width/height/depth/
//     thickness/tessellation/segments/size, whichever the chosen shape needs)
//   - copies: array of { rotation:{x,y,z}, animation:{x,y,z}? } - one entry
//     per mesh instance. >1 entry is how "twin"/"crossed" shapes (twinhalo,
//     boxcross, bladecross) work - each copy gets its own rotation offset,
//     and optionally its OWN independent spin (twinhalo's two rings each
//     spin on a different axis with no shared root spin at all) instead of
//     inheriting the top-level `animation`
//   - weapon: { type: "sword"|"spear", rarities: {...}, scale } - only for
//     shape:"weapon", passed straight into createWeapon (assetcreation/
//     createweapon.js)
//   - material.kind: "glow" (flat createGlowingMat) | "fresnel" (hollow-shell
//     fresnelMat) | "texture" (shape:"plane" only, skill.name-derived image)
//     | "none"
//   - animation: {x,y,z} per-frame rotation speed on whichever axis, applied
//     to the shared root (single mesh, or the wrapping TransformNode for a
//     multi-copy shape spinning as one rigid unit)
//   - arcs: { enabled, weaponGlow, width, updateInterval } - wraps the
//     existing attachLightning() call; arc COUNT itself still comes from the
//     skill's own top-level arcCount (growArcAura already targets that exact
//     field name, unchanged)
//   - launchSound / silentLaunch: which sound plays when the projectile
//     fires (falls back to "fireBallS"), or true to fire completely
//     silently (astralrainSkill's own targeting marker only)
//
// onHitVisual - the REAL description of what happens on impact.
// skillEffects.js's runOnHitVisual (called from renderGenericProjectile's
// own returned `onHit`) reads this directly.
//   - type: "burst" (the old EXPLOSION_STYLES fire/water/earth/light/lightning,
//     now just burst params on the skill itself) | "implode" (dark magic's
//     particles-pulled-IN effect) | "stickAndGrow" (darkorb/stormsurge - box
//     sticks to whatever it hit and swells instead of exploding) | "beam"
//     (tidalspike - nothing exists until impact, a caster->target plane
//     snaps into place) | "none" (no impact visual of its own - astralrainSkill's
//     marker, whose real payload is its separate swordRain field/mechanic)
//   - burst: { texture, fireScale, smokeScale, emberEmitRate, gravitySign,
//     includeSmoke } - the exact params createExplosionBurst already takes,
//     just per-skill instead of per-style. includeSmoke:false on every
//     weapon-shaped skill that reads as a solid strike, not an elemental
//     detonation (same reasoning the old WEAPON_LIKE_STYLES set encoded)
//   - stickAndGrow: { growScale, growDurationMs, fadeOutMs (null = no fade,
//     just grows and lingers - darkorb), lingerMs, intensityRamp (only
//     meaningful for shape:"custom", ramps its particle layers too) }
//   - beam: { width, lingerMs }
//   - stickBriefly: true = after a normal burst/implode, the projectile
//     ALSO embeds briefly into whatever it hit (MARKER_STICK_DURATION_MS)
//     instead of despawning immediately - the old code's exact
//     `skill.projectileStyle === "blade"` special case, now data instead of
//     a hardcoded string check. Only flamebrandSkill/lightningboltSkill ever
//     had this (NOT bladecross/spearlance/shadowblade, despite being
//     similarly weapon-shaped - the old code's own check was that narrow)
//   - impactSound: overrides the default "fireHitS" (e.g. "electricHitS",
//     "waterHitS", "struckS")
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
    particleStyles: [{ name: "oneline", color: "blue" }],
    projectileVisual: { useProjectile: true, visible: true, shape: "particle", material: { kind: "none" } },
    onHitVisual: [{ type: "burst", burst: { texture: "drunkBubble", fireScale: 0.9, smokeScale: 0.7, emberEmitRate: 11, gravitySign: 1, includeSmoke: true } }],
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
    arcCount: 0, // no arcs at lvl 1 - growArcAura unlocks them partway through leveling
    onLevelUp: "growArcAura",
    // a tiny glowing sword flies out (createWeapon's own glow support) - arcs
    // unlock in as arcCount grows past 0 via growArcAura
    projectileVisual: {
        useProjectile: true, visible: false, shape: "weapon",
        weapon: { type: "sword", rarities: { bladeRarity: "rare2", guardRarity: "rare1", handleRarity: "common1", pommelRarity: "common1" }, scale: 0.12 },
        copies: [{ rotation: { x: Math.PI, y: 0, z: Math.PI / 2 } }],
        material: { kind: "glow" },
        arcs: { enabled: true, weaponGlow: false, width: 0.015, updateInterval: 90 },
        launchSound: "spearS1",
    },
    onHitVisual: [{ type: "burst", burst: { texture: "explodeTex", fireScale: 1, smokeScale: 1, emberEmitRate: 15, gravitySign: 1, includeSmoke: false }, stickBriefly: true, impactSound: "struckS" }],
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
    particleStyles: [{ name: "flames", color: "red" }],
    onLevelUp: "growParticleAura",
    projectileVisual: { useProjectile: true, visible: true, shape: "particle", material: { kind: "none" } },
    onHitVisual: [{ type: "burst", burst: { texture: "explodeTex", fireScale: 1, smokeScale: 1, emberEmitRate: 15, gravitySign: 1, includeSmoke: true } }],
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
    arcCount: 0,
    onLevelUp: "growArcAura",
    // stays fully invisible for its whole flight - nothing to show until
    // impact, where onHitVisual's "beam" type snaps a glowing plane into
    // place spanning from the caster to whoever it hit
    projectileVisual: { useProjectile: true, visible: false, material: { kind: "none" } },
    // two effects layered on one hit: the beam itself, plus an extra splash
    // burst right at the impact point on top of it - burst.texture is a bare
    // NAME key (createParticle resolves it to ./images/particles/{name}.webp
    // internally), not a file path - "splash" resolves to the real
    // ./images/particles/splash.webp asset. impactSound only needs stating
    // once (first entry with one wins, see playImpactSound) - not worth two
    // slightly-different sounds overlapping
    onHitVisual: [
        { type: "beam", beam: { width: 0.5, lingerMs: 3000, texturePath: "./images/particles/watercurrent.webp", scrollSpeed: 0.6, uScale: 4 }, impactSound: "waterHitS" },
        { type: "burst", burst: { texture: "splash", fireScale: 0.9, smokeScale: 0.7, emberEmitRate: 11, gravitySign: 1, includeSmoke: false } },
    ],

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
    onLevelUp: "growParticleAura",
    // flies this skill's own skill-bar icon (./images/projectiles/maelstromboltprojectile.webp)
    // as a glowing plane instead of a plain particle-trail bolt, wrapped in
    // the same crackling arcs every other style gets
    projectileVisual: { useProjectile: true, visible: true, shape: "plane", material: { kind: "texture" }, arcs: { enabled: true, weaponGlow: false, width: 0.015, updateInterval: 90 } },
    arcCount: 2,
    onHitVisual: [
        // { type: "burst", burst: { texture: "drunkBubble", fireScale: 0.9, smokeScale: 0.7, emberEmitRate: 11, gravitySign: 1, includeSmoke: true }, impactSound: "electricHitS" }
        { type: "burst", burst: { texture: "splash", fireScale: 0.9, smokeScale: 0.7, emberEmitRate: 11, gravitySign: 1, includeSmoke: false } }, 
    ],
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
    magicCircleImg: "apt_earth",
    arcCount: 0,
    onLevelUp: "growArcAura",
    // real modeled shard (models/projectiles/stoneshard.glb, see
    // assetcreation/createProjectileModel.js) instead of a procedural cone -
    // this is the exact skill monolith/orangelith casts too (tcp's
    // monolithBase.skills). material.kind must NOT be "none" here -
    // loadModel (tools/loadmodel.js) always strips the glb's own imported
    // material to null on load, same convention allweapons' own part
    // templates already follow (createweapon.js) - a "none" projectile here
    // would render with no material at all. "texture" + texturePath instead
    // of a flat glow color - a real rock surface, not tinted green.
    // rotation is a first REAL test now (a prior guess here never actually
    // applied - GLB-cloned meshes come with rotationQuaternion already set,
    // which silently overrides a plain .rotation assignment; the engine now
    // nulls it first, see renderGenericProjectile's own comment on this) -
    // still just a guess at the right value though, adjust copies[0].rotation
    // here if the shard doesn't point the direction it's actually flying
    projectileVisual: {
        useProjectile: true, visible: true, shape: "glbModel",
        model: { name: "stoneshard", scale: 1 },
        copies: [{ rotation: { x: Math.PI / 2, y: 0, z: 0 } }],
        material: { kind: "texture", texturePath: "./images/modeltex/rock1.jpg" },
    },
    onHitVisual: [{ type: "burst", burst: { texture: "rockTex", fireScale: 1.2, smokeScale: 1.3, emberEmitRate: 13, gravitySign: -1, includeSmoke: true } }],
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
    castDuration: 0.8,
    returnModeDura: 900,
    skillCoolDown: 2200,
    demand: [{ name: "mp", minCost: 32, cost: 0 }],
    effects: { effectType: "offense", dmgPm: 0, plusDmg: 145, chance: 1, bashPower: 0.45 },
    skillrank: 1,
    upgradePlus: 28,
    explosionColor: "green",
    explosionScale: 1,
    particleStyles: [{ name: "tentacles", color: "green" }],
    magicCircleImg: "apt_earth_second",
    onLevelUp: "growParticleAura",
    // shape:"plane" + material.texturePath - a small textured plane clone
    // (thin1.webp, a wispy particle-style image, not a per-skill icon) marks
    // each bolt in flight instead of a full particleStyles system or a bare
    // box - see renderGenericProjectile's "plane" branch in skillEffects.js
    // for the texturePath override. projectileScale scales the default
    // 1-unit-wide plane template - 0.4 read as basically invisible at actual
    // play distance/speed, bumped up to stay visible without turning into a
    // full-size banner. speedMult doubles this skill's flight speed off the
    // shared PROJECTILE_SPEED baseline (fireElementalProjectile reads it).
    // burstCount/burstIntervalMs/spreadDeg fire 5 bolts, 100ms apart (1
    // every 100ms, 5 total), fanned out across a 30deg arc instead of one
    // single shot (see castOffenseSkill's fireProjectileVolley).
    projectileScale: 1.4,
    projectileVisual: { useProjectile: true, shape: "plane", material: { kind: "texture", texturePath: "./images/particles/thin1.webp" }, launchSound: "bulletS", speedMult: 2, burstCount: 5, burstIntervalMs: 100, spreadDeg: 30 },
    onHitVisual: [{ type: "burst", burst: { texture: "rockTex", fireScale: 1.2, smokeScale: 1.3, emberEmitRate: 13, gravitySign: -1, includeSmoke: true }, impactSound: "bulletS" }],
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
    arcCount: 0,
    onLevelUp: "growArcAura",
    projectileVisual: {
        useProjectile: true, visible: false, shape: "weapon",
        weapon: { type: "sword", rarities: { bladeRarity: "rare2", guardRarity: "rare1", handleRarity: "common1", pommelRarity: "common1" }, scale: 0.12 },
        copies: [{ rotation: { x: Math.PI, y: 0, z: Math.PI / 2 } }],
        material: { kind: "glow" },
        arcs: { enabled: true, weaponGlow: false, width: 0.015, updateInterval: 90 },
        launchSound: "spearS1",
    },
    // "lightning" onHitVisual burst is ALWAYS includeSmoke:false, regardless
    // of weapon-shape - its own distinct texture (flare3) so it doesn't read
    // as a recolored "light" skill
    onHitVisual: [{ type: "burst", burst: { texture: "flare3", fireScale: 0.85, smokeScale: 0.6, emberEmitRate: 10, gravitySign: 1, includeSmoke: false }, stickBriefly: true, impactSound: "electricHitS" }],
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
    arcCount: 2,
    onLevelUp: "growArcAura",
    // a plain glowing sphere with a Fresnel "hollow shell" material, wrapped
    // in crackling arcs - this is the FLIGHT look only
    projectileVisual: { useProjectile: true, visible: true, shape: "sphere", shapeParams: { diameter: 0.4, segments: 16 }, material: { kind: "fresnel" }, arcs: { enabled: true, weaponGlow: false, width: 0.015, updateInterval: 90 } },
    // skips the usual burst entirely: on hit the sphere itself sticks to
    // whatever it struck, swells to 5x over half a second, then fades out
    // over the next ~0.7s instead of just disappearing - same "stick and
    // swell" precedent darkorbSkill's own onHit set, just smaller/faster and
    // actually fades (darkorb grows 10x with no fade)
    onHitVisual: [{ type: "stickAndGrow", stickAndGrow: { growScale: 5, growDurationMs: 500, fadeOutMs: 700 } }],
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
    enemyBind: { effectType: "bind", shape: "box", bindDuration: 10.5, bindChance: 1 }, // shape: // torus, box,
    arcCount: 3,
    onLevelUp: "growArcAura",
    // reuses the shared projectile box itself (kept visible, scaled to 0.4x)
    // wrapped in crackling arcs - a small glowing core, not a shaped mesh
    projectileVisual: { useProjectile: true, visible: true, shape: "box", shapeParams: { boxScale: 0.4 }, material: { kind: "glow" }, arcs: { enabled: true, weaponGlow: true, width: 0.025, updateInterval: 60 } },
    onHitVisual: [{ type: "burst", burst: { texture: "flare2", fireScale: 0.8, smokeScale: 0.5, emberEmitRate: 8, gravitySign: 1, includeSmoke: false } }],
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
    magicCircleImg: "divine1",
    enemyBind: { effectType: "bind", shape: "torus", bindDuration: 10.5, bindChance: 1 }, // shape: // torus, box,
    arcCount: 3,
    onLevelUp: "growArcAuraAndBind",
    // a spinning glowing torus instead of the shared box - "divine judgment
    // descending" carried into the projectile itself, matching its own
    // fancier "divine1" magic circle
    projectileVisual: { useProjectile: true, visible: false, shape: "torus", shapeParams: { diameter: 0.55, thickness: 0.09, tessellation: 24 }, material: { kind: "glow" }, animation: { z: 0.12 }, arcs: { enabled: true, weaponGlow: true, width: 0.02, updateInterval: 60 } },
    onHitVisual: [{ type: "burst", burst: { texture: "flare2", fireScale: 0.8, smokeScale: 0.5, emberEmitRate: 8, gravitySign: 1, includeSmoke: false } }],
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
    magicCircleImg: "apt_darkness",
    arcCount: 0, // no arcs at lvl 1 - growArcAura unlocks them partway through leveling, same pattern flamebrand's own weapon-shape uses
    onLevelUp: "growArcAura",
    // the FULL assembled spear (blade+guard+handle+pommel, not just a bare
    // blade piece) - fresnelMat (hollow-shell) applied uniformly over all 4
    // parts instead of createWeapon's own flat glow. Hardcodes "purple" for
    // both material and arcs, ignoring explosionColor above ("violet")
    // entirely - same RGB either way (GLOW_COLORS treats them as synonyms),
    // so this doesn't actually change how it looks, just how it's driven
    projectileVisual: {
        useProjectile: true, visible: false, shape: "weapon",
        weapon: { type: "spear", rarities: { bladeRarity: "rare1", guardRarity: "rare1", handleRarity: "rare1", pommelRarity: "rare1" }, scale: 0.16 },
        copies: [{ rotation: { x: Math.PI, y: 0, z: Math.PI / 2 } }],
        material: { kind: "fresnel" },
        arcs: { enabled: true, weaponGlow: false, width: 0.015, updateInterval: 90 },
    },
    onHitVisual: [{ type: "implode" }],
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
    magicCircleImg: "apt_darkness_second",
    arcCount: 3,
    onLevelUp: "growArcAura",
    projectileVisual: { useProjectile: true, visible: true, shape: "box", shapeParams: { boxScale: 0.4 }, material: { kind: "glow" }, arcs: { enabled: true, weaponGlow: true, width: 0.025, updateInterval: 60 } },
    onHitVisual: [{ type: "implode" }],
    desc: "A crackling void-touched blade tears through the air, folding space inward before it snaps closed.",
}

// --- HIGH SKILL, second wave (skillrank 2) ---
// Originally built at skillrank 4 "God Tier" tinted uniformly "violet" as an
// "ascended" signature - demoted back to 2 once that stopped meaning
// anything: shadowbolt/voidrend above already use "violet" too (it's dark
// magic's own color, not an exclusive top-tier one), so a dozen skills all
// sharing one glow color just reads as "this is what violet skills look
// like," not "these ten are special." Kept the elaborate per-element
// projectile shapes (bladecross/spearlance/crystalshard/twinhalo/boxcross)
// since those ARE genuinely distinct per skill; only the rank/tier framing
// was wrong, not the visuals themselves. Nothing currently sits at skillrank
// 4 "God Tier".
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
//
// arcs.weaponGlow is deliberately false on every "God Tier" skill below -
// true would flatten every child mesh's material to a flat glow color,
// wiping out createWeapon's own part materials/glow (bladecross/spearlance)
// or this style's own hand-set material (crystalshard/twinhalo/boxcross);
// false only adds the arc tubes around the shape, untouched otherwise.
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
    arcCount: 2,
    // growArcAuraAndPlasma (skillUpgrades.js) - grows arc count the same as
    // every other arced style, AND grows projectileVisual.plasma.qnty
    // 1-for-1 with level (lvl2 -> qnty:2, lvl3 -> qnty:3, ...)
    onLevelUp: "growArcAuraAndPlasma",
    // two glowing sword blades crossed into an X, spinning as one unit
    projectileVisual: {
        useProjectile: true, visible: false, shape: "weapon",
        weapon: { type: "sword", rarities: { bladeRarity: "rare2", guardRarity: "rare1", handleRarity: "common1", pommelRarity: "common1" }, scale: 0.1 },
        copies: [{ rotation: { x: Math.PI, y: 0, z: Math.PI / 4 } }, { rotation: { x: Math.PI, y: 0, z: -Math.PI / 4 } }],
        material: { kind: "glow" },
        animation: { z: 0.05 },
        arcs: { enabled: true, weaponGlow: false, width: 0.015, updateInterval: 90 },
        // "shooting star" comet tail streaming behind the crossed blades -
        // see createCometTrailParticles (tools/particlesystem.js) for what
        // enabled:true alone defaults to (tight cone, white->orange->red,
        // diamond size gradient); every field here is just an override of
        // one of those defaults, not a full re-statement
        trail: { enabled: true, texture: "explodeTex" },
        // qnty small "plasma dot" GLB clones (models/projectiles/plasma.glb,
        // see assetcreation/createProjectileModel.js's createPlasma) parented
        // directly onto the projectile alongside the crossed blades - texture
        // is a real image path (not a particles/ name lookup like trail.texture
        // above), since createPlasma hands it straight to createTransparentMat
        // (tools/materials.js). rotationX/qnty are a starting guess, not a
        // confirmed-correct value yet - tune both once this is actually visible in-game.
        plasma: { qnty: 1, texture: "./images/particles/explodeTex.webp", rotationX: 0, color: {r: 0.8,g:0,b:0 }, isEmissive: true },
        launchSound: "swordS1",
    },
    onHitVisual: [{ type: "burst", burst: { texture: "explodeTex", fireScale: 1, smokeScale: 1, emberEmitRate: 15, gravitySign: 1, includeSmoke: false }, impactSound: "struckS" }],
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
    arcCount: 2,
    onLevelUp: "growArcAura",
    projectileVisual: {
        useProjectile: true, visible: false, shape: "weapon",
        weapon: { type: "sword", rarities: { bladeRarity: "rare2", guardRarity: "rare1", handleRarity: "common1", pommelRarity: "common1" }, scale: 0.1 },
        copies: [{ rotation: { x: Math.PI, y: 0, z: Math.PI / 4 } }, { rotation: { x: Math.PI, y: 0, z: -Math.PI / 4 } }],
        material: { kind: "glow" },
        animation: { z: 0.05 },
        arcs: { enabled: true, weaponGlow: false, width: 0.015, updateInterval: 90 },
        launchSound: "swordS1",
    },
    onHitVisual: [{ type: "burst", burst: { texture: "explodeTex", fireScale: 1, smokeScale: 1, emberEmitRate: 15, gravitySign: 1, includeSmoke: false }, impactSound: "struckS" }],
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
    arcCount: 2,
    onLevelUp: "growArcAura",
    // a single spear (spear only exists at one part-tier, see swordsdata.js's
    // stormpiercer) flying point-first
    projectileVisual: {
        useProjectile: true, visible: false, shape: "weapon",
        weapon: { type: "spear", rarities: { bladeRarity: "rare1", guardRarity: "rare1", handleRarity: "rare1", pommelRarity: "rare1" }, scale: 0.16 },
        copies: [{ rotation: { x: Math.PI, y: 0, z: Math.PI / 2 } }],
        material: { kind: "glow" },
        arcs: { enabled: true, weaponGlow: false, width: 0.015, updateInterval: 90 },
        launchSound: "spearS1",
    },
    onHitVisual: [{ type: "burst", burst: { texture: "drunkBubble", fireScale: 0.9, smokeScale: 0.7, emberEmitRate: 11, gravitySign: 1, includeSmoke: false }, impactSound: "struckS" }],
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
    arcCount: 2,
    onLevelUp: "growArcAura",
    // a glowing sphere with a Fresnel "hollow shell" material, wrapped in
    // crackling arcs - same shape stormsurge/celestialverdict reuse, just its
    // own color
    projectileVisual: { useProjectile: true, visible: true, shape: "sphere", shapeParams: { diameter: 0.4, segments: 16 }, material: { kind: "fresnel" }, arcs: { enabled: true, weaponGlow: false, width: 0.015, updateInterval: 90 } },
    onHitVisual: [{ type: "burst", burst: { texture: "drunkBubble", fireScale: 0.9, smokeScale: 0.7, emberEmitRate: 11, gravitySign: 1, includeSmoke: true } }],
    desc: "The crushing weight of the deepest trench rides a bolt of god-lightning, erupting into a drowning maelstrom.",
}

// continentalrend used to be a crystalshard-style projectile identical to
// seismicjudgment right below it (same shard shape, same green, same earth
// burst - only the damage numbers differed). Rebuilt into its own genuinely
// different mechanic: no projectile at all - groundSpikes = { count,
// spacing, staggerMs } marches a line of jagged rock spikes straight out
// from the caster, each one erupting a beat after the last (see
// triggerGroundSpikeLine/spawnGroundSpike in skillEffects.js, which still
// reads onHitVisual.burst below for the eruption's own params even though no
// projectile ever fires). plusDmg is PER SPIKE, not a one-shot total - same
// reasoning astralrainSkill's own per-sword plusDmg already follows, since a
// target standing in the line can take more than one hit as spikes march
// past it.
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
    magicCircleImg: "apt_earth_second",
    groundSpikes: { count: 5, spacing: 2.2, staggerMs: 160 },
    onLevelUp: "growGroundSpikes",
    // no projectile at all - marches ground spikes out from the caster instead, see groundSpikes above
    projectileVisual: { useProjectile: false },
    onHitVisual: [{ type: "burst", burst: { texture: "rockTex", fireScale: 1.2, smokeScale: 1.3, emberEmitRate: 13, gravitySign: -1, includeSmoke: true } }],
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
    magicCircleImg: "apt_earth_second",
    arcCount: 2,
    onLevelUp: "growArcAura",
    // a jagged glowing crystal shard (a many-faceted, rock-like icosahedron
    // instead of a smooth primitive), tumbling irregularly on all three axes
    // rather than spinning cleanly
    projectileVisual: { useProjectile: true, visible: false, shape: "icosahedron", shapeParams: { size: 0.22 }, material: { kind: "glow" }, animation: { x: 0.04, y: 0.07, z: 0.02 }, arcs: { enabled: true, weaponGlow: false, width: 0.015, updateInterval: 100 } },
    onHitVisual: [{ type: "burst", burst: { texture: "rockTex", fireScale: 1.2, smokeScale: 1.3, emberEmitRate: 13, gravitySign: -1, includeSmoke: true } }],
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
    magicCircleImg: "divine1",
    arcCount: 2,
    onLevelUp: "growArcAura",
    // a plain radiant glowing sphere with a Fresnel "hollow shell" material -
    // its own distinct look (used to share "twinhalo" with seraphicascension,
    // pulled into its own shape so the two no longer look identical), same
    // shape stormsurge/abyssalcurrent reuse, just its own color
    projectileVisual: { useProjectile: true, visible: true, shape: "sphere", shapeParams: { diameter: 0.4, segments: 16 }, material: { kind: "fresnel" }, arcs: { enabled: true, weaponGlow: false, width: 0.015, updateInterval: 90 } },
    onHitVisual: [{ type: "burst", burst: { texture: "flare2", fireScale: 0.8, smokeScale: 0.5, emberEmitRate: 8, gravitySign: 1, includeSmoke: false } }],
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
    magicCircleImg: "divine1",
    arcCount: 2,
    onLevelUp: "growArcAura",
    // two tori crossed perpendicular (a gyroscope/aegis read), each spinning
    // on its own independent axis - no shared root spin at all, distinct
    // from "halo" (radiantjudgment's single flat ring)
    projectileVisual: {
        useProjectile: true, visible: false, shape: "torus",
        shapeParams: { diameter: 0.45, thickness: 0.05, tessellation: 24 },
        copies: [{ rotation: { x: 0, y: 0, z: 0 }, animation: { z: 0.03 } }, { rotation: { x: 0, y: Math.PI / 2, z: 0 }, animation: { x: 0.045 } }],
        material: { kind: "glow" },
        arcs: { enabled: true, weaponGlow: false, width: 0.015, updateInterval: 90 },
    },
    onHitVisual: [{ type: "burst", burst: { texture: "flare2", fireScale: 0.8, smokeScale: 0.5, emberEmitRate: 8, gravitySign: 1, includeSmoke: false } }],
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
    magicCircleImg: "apt_darkness_second",
    arcCount: 2,
    onLevelUp: "growArcAura",
    // two thin glowing bars crossed into an X (exactly two boxes, rotated) -
    // a stark geometric sigil/rune instead of a shaped weapon, fitting a
    // curse mark more than a blade would
    projectileVisual: {
        useProjectile: true, visible: false, shape: "box",
        shapeParams: { width: 0.06, height: 0.06, depth: 0.5 },
        copies: [{ rotation: { x: 0, y: 0, z: Math.PI / 4 } }, { rotation: { x: 0, y: 0, z: -Math.PI / 4 } }],
        material: { kind: "glow" },
        animation: { y: 0.06 },
        arcs: { enabled: true, weaponGlow: false, width: 0.015, updateInterval: 90 },
    },
    onHitVisual: [{ type: "implode" }],
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
    magicCircleImg: "apt_darkness_second",
    arcCount: 2,
    onLevelUp: "growArcAura",
    projectileVisual: {
        useProjectile: true, visible: false, shape: "box",
        shapeParams: { width: 0.06, height: 0.06, depth: 0.5 },
        copies: [{ rotation: { x: 0, y: 0, z: Math.PI / 4 } }, { rotation: { x: 0, y: 0, z: -Math.PI / 4 } }],
        material: { kind: "glow" },
        animation: { y: 0.06 },
        arcs: { enabled: true, weaponGlow: false, width: 0.015, updateInterval: 90 },
    },
    onHitVisual: [{ type: "implode" }],
    desc: "Damnation itself given form crackles forth, cursing its target so thoroughly that its own strength becomes its undoing.",
}

// --- ASTRAL RAIN (God Tier - genuinely different mechanic, not a recolor) ---
// The invisible marker box (projectileVisual.visible:false, no shape) deals
// no damage and doesn't explode itself - it only marks where it lands. skill.
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
    swordRain: { min: 2, max: 3, spread: 4.5 },
    onLevelUp: "growSwordRain",
    // invisible+silent targeting marker only - a stealthy targeting box
    // firing off a fireball whoosh would undercut the whole point of it
    projectileVisual: { useProjectile: true, visible: false, material: { kind: "none" }, silentLaunch: true },
    // "none" - the marker's own hit never actually reaches onHitVisual
    // dispatch at all (its swordRain branch in fireElementalProjectile
    // returns before onHit ever runs) - the real visual is the falling
    // sword rain, entirely separate from this
    onHitVisual: [{ type: "none" }],
    desc: "An invisible arrow marks its target - moments later, blades of astral light rain down from above.",
}

// --- DARK ORB (God Tier - dark magic's own signature, alongside astralrain) ---
// shape:"custom" (see skillEffects.js's buildCustomMesh) is a genuinely built
// mesh - a glassy dark-purple sphere (real StandardMaterial Fresnel rim glow
// + a NoiseProceduralTexture veined bump map) wrapped around a jagged white-
// glowing splinter built with createRock.js's own displaceWithNoise, plus
// two orbiting particle layers (a dark smoky aura, a purple spark layer) -
// not a recolor of an existing shape, and too bespoke for the plain
// shape/material model every other skill uses, hence its own `customMesh`
// data bucket. It also skips the usual explode-and-vanish impact entirely:
// onHitVisual.type "stickAndGrow" sticks to whatever it struck and swells
// 10x "like a wildfire" instead (both particle layers grow with it), only
// actually despawning once that sequence finishes (fadeOutMs:null - no fade,
// unlike stormsurge's own smaller/faster stickAndGrow). element "dark" still
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
    onLevelUp: "growDarkOrb",
    projectileVisual: {
        useProjectile: true, visible: true, shape: "custom",
        // slow independent tumble so the vein pattern/rim glow/core facets
        // all read as alive rather than a static prop flying in a straight line
        animation: { x: 0.008, y: 0.02, z: 0 },
        customMesh: {
            shell: { diameter: 0.5, segments: 20 },
            shellMaterial: {
                diffuse: { r: 0.05, g: 0.0, b: 0.08 }, specular: { r: 0.05, g: 0.0, b: 0.08 }, emissive: { r: 0.3, g: 0.05, b: 0.45 }, alpha: 0.9,
                bumpOctaves: 4, bumpPersistence: 0.65, bumpAnimSpeed: 3,
                fresnelBias: 0.3, fresnelPower: 2, fresnelLeft: { r: 0.8, g: 0.4, b: 1.0 }, fresnelRight: { r: 0.2, g: 0.0, b: 0.3 },
            },
            core: { radius: 0.14, subdivisions: 3, color: "white" },
            coreAnimation: { x: 0.05, y: 0.08, z: 0 },
            particleLayers: [
                // dark smoky aura - standard alpha blend, not additive, so it
                // reads as smoke/shadow rather than another glow layer
                { texture: "smoke2", capacity: 40, spd: 0.02, lifetimeMin: 0.5, lifetimeMax: 0.9, minSize: 0.12, maxSize: 0.3, particleType: "sphere", color: { r: 0.02, g: 0.0, b: 0.04 }, emitterRadius: 0.32, emitterRadiusRange: 0.4, minEmitPower: 0.05, maxEmitPower: 0.15, emitRate: 26, blendMode: "standard" },
                // purple energetic sparks - additive, the "crackling" read
                { texture: "flare", capacity: 30, spd: 0.025, lifetimeMin: 0.15, lifetimeMax: 0.4, minSize: 0.04, maxSize: 0.12, particleType: "sphere", color: { r: 0.55, g: 0.15, b: 0.9 }, emitterRadius: 0.28, emitterRadiusRange: 0.6, minEmitPower: 0.3, maxEmitPower: 0.65, emitRate: 40, blendMode: "additive" },
            ],
        },
    },
    // growDarkOrb (skillUpgrades.js) writes growScale/intensityRamp here as
    // this levels up - starting defaults (10x/1x) match what darkorb always
    // used before leveling made the sequence itself more extreme
    onHitVisual: [{
        type: "stickAndGrow",
        stickAndGrow: { growScale: 10, growDurationMs: 900, lingerMs: 400, fadeOutMs: null, intensityRamp: 1, growEmissive: { r: 0.85, g: 0.5, b: 1.0 } },
    }],
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
    particleStyles: [{ name: "oneline", color: "blue" }],
    onLevelUp: "growParticleAura",
    projectileVisual: { useProjectile: true, visible: true, shape: "particle", material: { kind: "none" } },
    onHitVisual: [{ type: "burst", burst: { texture: "drunkBubble", fireScale: 0.9, smokeScale: 0.7, emberEmitRate: 11, gravitySign: 1, includeSmoke: true } }],
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
    // trigger skill - fires no projectile of its own, clicks other skill
    // slots instead. Never actually reaches fireElementalProjectile/
    // renderGenericProjectile at all (activateSkill's own switch no-ops for
    // effects.effectType === "trigger"), these are here only so scanning the
    // file top-to-bottom stays uniform.
    projectileVisual: { useProjectile: false },
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
// groundTrap (read by castOffenseSkill/spawnGroundTrap in skillEffects.js)
// replaces the usual fired projectile entirely: after the normal
// castDuration windup, a flat ground-rune circle blooms a short distance in
// front of the caster (createMagicCircle with no facingDirection - lies flat
// facing the sky, not the usual upright in-front-of-hand circle) with an
// invisible box trigger over the same spot. The FIRST enemy to walk into
// that box consumes the trap: fire particles burst (onHitVisual.burst below,
// read by applyDisintegrationHit even though no projectile ever fires), they
// take a hit, and get bound via enemyBind below - same bind mechanic
// radiantjudgmentSkill already uses, just triggered by a walked-into trap
// instead of a landed hit.
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
    // distance omitted - defaults to 0 (skillEffects.js's own
    // GROUND_TRAP_DEFAULT_DISTANCE), i.e. centered on the caster's own
    // body, not thrown out in front like a targeted skill would be
    groundTrap: { radius: 1.8, duration: 8000 },
    magicCircleImg: "apt_fire_second",
    enemyBind: { effectType: "bind", shape: "torus", bindDuration: 6, bindChance: 1 },
    onLevelUp: "growParticleAura",
    // no projectile - ground trap instead, see groundTrap above
    projectileVisual: { useProjectile: false },
    onHitVisual: [{ type: "burst", burst: { texture: "explodeTex", fireScale: 1, smokeScale: 1, emberEmitRate: 15, gravitySign: 1, includeSmoke: true } }],
    desc: "It traps the enemy in a circle of magic, then burn them until they disintegrate",
}

// --- MASSIVE DISINTEGRATION (fire) - the AOE version of disintegrationSkill ---
// Same groundTrap mechanic, but with aoe: true (read by castOffenseSkill/
// spawnMassGroundTrap in skillEffects.js) - instead of a small trap waiting
// for one enemy to walk into it, a much bigger circle blooms and, a beat
// later, hits EVERY enemy currently within radius at once (see
// spawnMassGroundTrap's own header comment for the full mechanism - it
// reuses disintegrationSkill's own applyDisintegrationHit for the actual
// fire-burst/burning-body/hit/bind, so both skills apply the identical
// effect, just triggered differently).
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
    // distance omitted - defaults to 0, centered on the caster's own body,
    // same as disintegrationSkill's own trap
    groundTrap: { radius: 10, duration: 8000, aoe: true },
    magicCircleImg: "apt_fire_second",
    enemyBind: { effectType: "bind", shape: "torus", bindDuration: 6, bindChance: 1 },
    onLevelUp: "growParticleAura",
    // no projectile - AOE ground trap instead, see groundTrap above
    projectileVisual: { useProjectile: false },
    onHitVisual: [{ type: "burst", burst: { texture: "explodeTex", fireScale: 1, smokeScale: 1, emberEmitRate: 15, gravitySign: 1, includeSmoke: true } }],
    desc: "Summons a massive circle of annihilation - anyone caught near or inside its radius is consumed by disintegrating flame.",
}

// --- MJOLNIR (lightning) - the first BUFF skill, not an offense skill: no
// target, no projectile, no damage roll of its own. Casting it wreathes
// your own equipped weapon in lightning and grants a temporary flat bonus
// to your melee weapon damage - see attackingSystem.js's activateSkill
// ("buff" effectType, alongside "offense"/"trigger") and skillEffects.js's
// castBuffSkill/applyWeaponBuff.
//
// requireMode intentionally OMITTED, not the literal string "none" -
// disintegrationSkill's own comment above explains why: skillsui.js's gate
// is `if(skill.requireMode && charState.mode !== skill.requireMode)`, only
// skipped when requireMode is FALSY. Setting it to "none" would demand
// charState.mode === "none" forever, a mode that doesn't exist - permanently
// locking the skill instead of freeing it to fire from any mode.
//
// buff (read by skillEffects.js's applyWeaponBuff) - toAdd is scaled by
// powerScale (mana-output-slider * lvl-based explosionScale) at cast time,
// same convention every other skill's plusDmg already follows, so upgrading
// mjolnir's level (which bumps explosionScale automatically, see
// upgradeSkill) makes the buff itself stronger even though
// effects.plusDmg/dmgPm stay 0 here (there's no direct damage to bump).
// buffDuration is independent of skillCoolDown - some overlap window (buff
// still has 5s left when it comes off cooldown) is intentional, not a bug.
export const mjolnirSkill = {
    slotNumber: 31,
    equiped: true,
    isActive: false,
    name: "mjolnir",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "lightning",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Mjolnir",
    castDuration: 0.6,
    returnModeDura: 900,
    skillCoolDown: 15000,
    demand: [{ name: "mp", minCost: 35, cost: 0 }],
    effects: { effectType: "buff", dmgPm: 0, plusDmg: 0, chance: 1, bashPower: 0 },
    buff: { stat: "meeleeDmg", toAdd: 60, percent: 0, buffDuration: 20000 },
    skillrank: 3,
    // no plusDmg/dmgPm to bump per level (same reasoning multicastSkill's
    // own upgradePlus: 0 gives) - the buff itself still scales via
    // explosionScale/powerScale at cast time, see the header comment above
    upgradePlus: 0,
    explosionColor: "blue",
    magicCircleImg: "apt_lightning",
    // buff skill - wreathes own equipped weapon, no target/projectile of any
    // kind. castBuffSkill never touches fireElementalProjectile/
    // renderGenericProjectile at all.
    projectileVisual: { useProjectile: false },
    desc: "Calls down the hammer's own charge into your weapon - your blade crackles with lightning and strikes harder for a short time.",
}

// --- DASHSTRIKE (Elite Skill) - a WEAPON skill, not a caster or a buff: no
// magic circle, no cast windup, no requireMode gate at all (omitted, not the
// literal string "none" - see disintegrationSkill/mjolnirSkill's own
// comments above for why that distinction matters to skillsui.js's gate:
// `if(skill.requireMode && ...)` only skips the check when it's falsy).
// Activating it fires IMMEDIATELY - no castDuration window to sit through
// like every requireMode:"casting" skill above - the dash itself plays out
// over dash.durationMs while the "dashstrike" clip plays, instead of a
// separate windup animation before some other payoff lands later.
//
// effects.effectType is "dash", a NEW type - attackingSystem.js's
// activateSkill will need its own case for it (alongside "offense"/"buff"/
// "trigger"), and skillEffects.js will need a castDashSkill to actually move
// the player + apply the strike's damage. NOT implemented yet - this is data
// only for now, per your request to review the shape before any of that gets
// wired up.
//
// dash - read by the not-yet-written castDashSkill: a physics-enabled
// character gets a forward applyImpulse of impulseForce; without physics,
// falls back to a plain forward locallyTranslate ramp over durationMs
// instead, covering roughly `distance` units either way (both fields kept
// so whichever path fires has its own tuned number, since an impulse and a
// manual translate don't cover the same distance for the same input).
// animationName ("dashstrike") is a bare clip name - same convention every
// weapon-combo animation already uses (uimanagement.js's punch1/kick1/
// swordattack1), not a whole visual descriptor like projectileVisual/
// onHitVisual above.
//
// demand still reads "mp" (not "sp") even though this is a physical weapon
// skill - skillsui.js's mana-slider charging logic (the only demand
// mechanic actually wired up right now) only ever reads demand.name==="mp";
// an "sp" demand here would silently never charge or cost anything.
export const dashstrikeSkill = {
    slotNumber: 32,
    equiped: true,
    isActive: false,
    name: "dashstrike",
    lvl: 1,
    pointsToClaim: 1,
    pointsForUpgrade: 1,
    element: "normal",
    skillElementType: "na",
    animationLoop: false,
    displayName: "Dashstrike",
    // a WEAPON skill - skillsui.js's own click handler refuses to activate
    // this at all (popup + no mana charged) unless a weapon is actually
    // equipped, same rule the npcFighter side of this skill enforces too
    requiresWeapon: true,
    // 0, not omitted - activating this skill IS the dash+strike, nothing
    // plays out after a separate cast bar finishes the way every
    // requireMode:"casting" skill above works
    castDuration: 0,
    returnModeDura: 900,
    skillCoolDown: 3000,
    demand: [{ name: "mp", minCost: 25, cost: 0 }],
    effects: { effectType: "dash", dmgPm: 0, plusDmg: 90, chance: 1, bashPower: 0.5 },
    dash: { distance: 6, impulseForce: 120, durationMs: 350 },
    animationName: "dashstrike",
    // played on a timeout after activation (durationMs -> ms, read by the
    // not-yet-written castDashSkill: setTimeout(..., activationSound.willPlayAfterSeconds)),
    // not immediately on cast the way launchSound/impactSound above fire -
    // lets the strike's own sound land in sync with the animation's actual
    // swing frame instead of right when the button is pressed
    activationSound: { soundType: "blade", willPlayAfterSeconds: 200 },
    impactSound: "struckS", // allsounds.struckS.play()
    skillrank: 1,
    upgradePlus: 18,
    explosionColor: "red",
    explosionScale: 1,
    // no target circle/projectile at all - a melee weapon skill, not a caster
    projectileVisual: { useProjectile: false },
    desc: "Surge forward in an instant and cleave through anything in your path.",
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
    multicastSkill, disintegrationSkill, massivedisintegrationSkill,
    mjolnirSkill, dashstrikeSkill
]

// name -> skill object, e.g. skillsData.js's own exports plus anything an
// enemy is assigned (tcp/recources/enemyDetails.ts's det.skills, an array
// of skill NAMES - the server only ever knows enemies as plain data, it has
// no notion of the actual skill objects, so createEnemy.js/worldsocket.js
// resolve the real object through this map). Built once here instead of at
// each call site.
export const SKILLS_BY_NAME = Object.fromEntries(skillsData.map(skill => [skill.name, skill]))
