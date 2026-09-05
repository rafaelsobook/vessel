import { StandardMaterial, PBRMaterial, Color3, Texture } from "@babylonjs/core"
import { METAL_TINTS, METAL_ROUGHNESS, MATERIAL_TEXTURES } from "./metalmat"

// shared across every guard material instance - avoids reloading the same
// image once per (rarity, materialName) cache entry in createweapon.js.
// Tracks its scene the same way createweapon.js's partMatCache does, so a
// scene change (changeScene()) doesn't leave this pointing at a disposed one.
let guardBumpTexture = null
let guardBumpTextureScene = null
function getGuardBumpTexture(scene) {
    if (!guardBumpTexture || guardBumpTextureScene !== scene) {
        guardBumpTexture = new Texture("./images/modeltex/guard_normal.jpg", scene)
        guardBumpTextureScene = scene
    }
    return guardBumpTexture
}

// blended into each part's albedo at a low fraction (see the Lerp calls
// below) - these are fairly saturated on purpose to read as a rarity cue,
// but blending too much of them in washes out the part's own material
// color (e.g. a blue metal like adamantine + a heavy blend of RARITY_COLORS
// .rare's blue turns the whole weapon into one flat blue blob instead of
// looking like shiny worked metal)
const RARITY_COLORS = {
    common: new Color3(0.55, 0.55, 0.55),
    uncommon: new Color3(0.2, 0.7, 0.25),
    rare: new Color3(0.15, 0.45, 0.9),
    epic: new Color3(0.55, 0.15, 0.85),
    legendary: new Color3(0.95, 0.6, 0.05),
    mythic: new Color3(0.9, 0.1, 0.1),
}

// isBudgetTier - RARITY_COLORS' own uncommon/epic/legendary/mythic entries
// were written for a common->mythic budget ladder the crafting UI never
// actually reaches (craftingui.js's getRarityBase only ever produces
// "common"/"rare" from budget), so they sat completely dead until
// epiccrafts.js's own NAMED recipes ("epic1" etc, matchEpicRecipe) started
// reusing the word "epic" for something unrelated - a specific, one-off
// recipe identity, not a rung on that generic ladder - and accidentally
// woke this branch up. A recipe already fully owns its own visual identity
// (its required materials' own tints, plus its own explicit accent colors -
// see createweapon.js's EPIC_ACCENT_SUFFIXES), so it should NOT also pick
// up this generic per-tier color cue on top - that's what was muddying
// blackdragon's own near-black dragonscale tint toward violet on every
// epic1 part. Only "common"/"rare" (the tiers the budget system can
// actually produce) count as a real budget tier; anything else - including
// every recipe's own rarityName - skips the blend entirely below.
function parseRarity(rarity = "common1") {
    const match = /^([a-zA-Z]+)(\d*)$/.exec(rarity) || []
    const tier = (match[1] || "common").toLowerCase()
    const level = parseInt(match[2], 10) || 1
    const base = RARITY_COLORS[tier] ?? RARITY_COLORS.common
    const isBudgetTier = tier === "common" || tier === "rare"
    return { tier, level, base, isBudgetTier }
}

// Metals (iron/steel/bronze/silver/gold/mythril/adamantine) come from
// metalmat.js's METAL_TINTS, so armor and weapons agree on what each metal
// looks like. These cover the rest: hard mineral/gem parts and organic ones.
// exported so the crafting UI's material picker (craftingui.js) can list
// these as pickable swatches without duplicating the color data
// dragonscale (resourceLoot.js's blackdragon material) used to live here -
// moved to metalmat.js's own METAL_TINTS/METAL_ROUGHNESS instead, so
// createMetalMat (armor/pauldrons/helmets/gauntlets - none of which touch
// this file at all) recognizes it too, not just weapon parts.
// resolveMaterialTint below checks METAL_TINTS before GEM_TINTS, so weapon
// parts still resolve "dragonscale" correctly from its new home - nothing
// else needed here.
export const GEM_TINTS = {
    sodalite:     new Color3(0.16, 0.26, 0.55), // deep royal-blue mineral
    bluegranite:  new Color3(0.24, 0.29, 0.36), // speckled blue-grey stone
    firecrystal:  new Color3(0.95, 0.32, 0.05), // glowing ember-orange crystal
    frostshard:   new Color3(0.68, 0.90, 0.97), // pale icy-cyan crystal
    stormcrystal: new Color3(0.44, 0.32, 0.95), // electric violet-blue crystal
}
const GEM_ROUGHNESS = {
    sodalite: 0.35,     // polished stone
    bluegranite: 0.55,  // rougher, unpolished stone
    firecrystal: 0.15,  // glassy crystal
    frostshard: 0.1,
    stormcrystal: 0.12,
}
export const ORGANIC_TINTS = {
    wood:       new Color3(0.32, 0.21, 0.12),
    bone:       new Color3(0.82, 0.78, 0.66),
    leather:    new Color3(0.30, 0.18, 0.10),
    beastheart: new Color3(0.50, 0.06, 0.09), // raw, visceral red
}
// The magical crystals carry their own light regardless of rarity; plain
// metals/stones/organics only pick up the faint rarity-tier emissive below.
// Exported so createweapon.js's own per-part loop can also attach a REAL
// GlowLayer bloom (tools/glow.js's addGlow) on top of this material-level
// emissive floor for these same keys - firecrystal (phoenixore) specifically
// asked to "be glowing", not just carry a faint internal tint (see that
// file's own comment for the full reasoning).
export const SELF_GLOW = new Set(["firecrystal", "frostshard", "stormcrystal"])
// emissiveColor ignores scene lighting entirely, so it acts as a floor
// under the whole surface. Was 0.15 - deliberately faint, back when this
// was only ever a subtle ambient tint with no bloom involved. That's also
// exactly why createweapon.js's own addGlow(SELF_GLOW parts) barely showed
// anything: GlowLayer's bloom is driven BY this same emissiveColor
// (tools/glow.js's customEmissiveColorSelector reads material.emissiveColor
// directly, then just multiplies it by addGlow's own intensity arg) - a
// bloom built on top of an already-dim 0.15-scaled color stays dim no
// matter how high addGlow's own multiplier goes. 0.7 brings it into the
// same brightness class createGlowingMat's own GLOW_COLORS emissives sit
// in (full-saturation colors, also fed through the identical addGlow(0.4)
// call), which is what a real GlowLayer bloom actually needs to read as
// visibly glowing rather than a faint warm tint.
const SELF_GLOW_INTENSITY = 0.7

function resolveMaterialTint(materialName) {
    const key = (materialName || "").toLowerCase()
    if (METAL_TINTS[key]) return { key, color: METAL_TINTS[key], category: "metal" }
    if (GEM_TINTS[key]) return { key, color: GEM_TINTS[key], category: "gem" }
    if (ORGANIC_TINTS[key]) return { key, color: ORGANIC_TINTS[key], category: "organic" }
    return { key, color: undefined, category: undefined }
}

// blade/guard/pommel are "hard" parts - metal or polished stone/crystal.
// They use PBRMaterial so they pick up scene.environmentTexture reflections
// (set up once in tools/lighting.js) the same way armor already does via
// metalmat.js - a StandardMaterial only ever shows a small specular
// highlight dot from direct lights and never reflects its surroundings,
// which is why the sword looked dull/flat next to the armor.
function buildHardPartMat(scene, namePrefix, rarity, materialName, fallbackKey, blendBase, blendPerLevel, blendCap, emissiveScale) {
    const { level, base, isBudgetTier } = parseRarity(rarity)
    const { key, color, category } = resolveMaterialTint(materialName)
    const tint = color ?? METAL_TINTS[fallbackKey]
    const resolvedKey = color ? key : fallbackKey
    const resolvedCategory = color ? category : "metal"
    const matName = `${namePrefix}Mat_${resolvedKey}_${rarity}`

    // organic materialName shouldn't normally reach blade/guard/pommel (that's
    // handle's job), but fall back safely to a matte look instead of a PBR one
    if (resolvedCategory === "organic") {
        const mat = new StandardMaterial(matName, scene)
        mat.diffuseColor = tint
        mat.specularColor = new Color3(0.1, 0.1, 0.1)
        return mat
    }

    const mat = new PBRMaterial(matName, scene)
    mat.metallic = resolvedCategory === "metal" ? 1 : 0
    mat.roughness = resolvedCategory === "metal" ? (METAL_ROUGHNESS[resolvedKey] ?? 0.4) : (GEM_ROUGHNESS[resolvedKey] ?? 0.3)
    mat.environmentIntensity = 0.7
    // isBudgetTier gate - see parseRarity's own comment. A recipe-driven
    // rarity (epic1 etc) skips this blend/emissive entirely instead of
    // picking up RARITY_COLORS' generic per-tier tint on top of the
    // material's own true color.
    const blend = isBudgetTier ? Math.min(blendBase + level * blendPerLevel, blendCap) : 0
    mat.albedoColor = isBudgetTier ? Color3.Lerp(tint, base, blend) : tint
    mat.emissiveColor = isBudgetTier ? base.scale(emissiveScale * level) : Color3.Black()
    if (SELF_GLOW.has(resolvedKey)) mat.emissiveColor = mat.emissiveColor.add(tint.scale(SELF_GLOW_INTENSITY))
    // MATERIAL_TEXTURES (metalmat.js) - only materials with a real surface
    // image set one (dragonscale so far); everything else stays flat-tinted
    // exactly as before
    const texturePath = MATERIAL_TEXTURES[resolvedKey]
    if(texturePath) mat.albedoTexture = new Texture(texturePath, scene)
    return mat
}

export function createBladeMat(scene, rarity = "common1", materialName = "steel") {
    return buildHardPartMat(scene, "blade", rarity, materialName, "steel", 0.04, 0.02, 0.16, 0.02)
}

export function createGuardMat(scene, rarity = "common1", materialName = "bronze") {
    const mat = buildHardPartMat(scene, "guard", rarity, materialName, "bronze", 0.06, 0.03, 0.22, 0.015)
    mat.bumpTexture = getGuardBumpTexture(scene)
    return mat
}

export function createHandleMat(scene, rarity = "common1", materialName = "leather") {
    const { level, base, isBudgetTier } = parseRarity(rarity)
    const { key, color } = resolveMaterialTint(materialName)
    const tint = color ?? ORGANIC_TINTS.leather
    const mat = new StandardMaterial(`handleMat_${key}_${rarity}`, scene)
    // isBudgetTier gate - see parseRarity's/buildHardPartMat's own comment;
    // a recipe rarity (epic1 etc) uses the material's true color unblended
    mat.diffuseColor = isBudgetTier ? Color3.Lerp(tint, base, Math.min(0.03 + level * 0.015, 0.12)) : tint
    mat.specularColor = new Color3(0.05, 0.05, 0.05)
    mat.specularPower = 8
    if (SELF_GLOW.has(key)) mat.emissiveColor = tint.scale(SELF_GLOW_INTENSITY)
    // MATERIAL_TEXTURES (metalmat.js) - same as buildHardPartMat above, just
    // diffuseTexture instead of albedoTexture since this is a StandardMaterial
    const texturePath = MATERIAL_TEXTURES[key]
    if(texturePath) mat.diffuseTexture = new Texture(texturePath, scene)
    return mat
}

export function createPommelMat(scene, rarity = "common1", materialName = "gold") {
    return buildHardPartMat(scene, "pommel", rarity, materialName, "gold", 0.08, 0.03, 0.26, 0.02)
}
