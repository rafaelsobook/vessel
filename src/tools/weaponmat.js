import { StandardMaterial, PBRMaterial, Color3, Texture } from "@babylonjs/core"
import { METAL_TINTS, METAL_ROUGHNESS } from "./metalmat"

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

function parseRarity(rarity = "common1") {
    const match = /^([a-zA-Z]+)(\d*)$/.exec(rarity) || []
    const tier = (match[1] || "common").toLowerCase()
    const level = parseInt(match[2], 10) || 1
    const base = RARITY_COLORS[tier] ?? RARITY_COLORS.common
    return { tier, level, base }
}

// Metals (iron/steel/bronze/silver/gold/mythril/adamantine) come from
// metalmat.js's METAL_TINTS, so armor and weapons agree on what each metal
// looks like. These cover the rest: hard mineral/gem parts and organic ones.
const GEM_TINTS = {
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
const ORGANIC_TINTS = {
    wood:       new Color3(0.32, 0.21, 0.12),
    bone:       new Color3(0.82, 0.78, 0.66),
    leather:    new Color3(0.30, 0.18, 0.10),
    beastheart: new Color3(0.50, 0.06, 0.09), // raw, visceral red
}
// The magical crystals carry their own light regardless of rarity; plain
// metals/stones/organics only pick up the faint rarity-tier emissive below.
const SELF_GLOW = new Set(["firecrystal", "frostshard", "stormcrystal"])
// emissiveColor ignores scene lighting entirely, so it acts as a floor
// under the whole surface - kept low so it reads as a glow accent instead
// of flattening out the shading into one flat blob of color
const SELF_GLOW_INTENSITY = 0.15

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
    const { level, base } = parseRarity(rarity)
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
    const blend = Math.min(blendBase + level * blendPerLevel, blendCap)
    mat.albedoColor = Color3.Lerp(tint, base, blend)
    mat.emissiveColor = base.scale(emissiveScale * level)
    if (SELF_GLOW.has(resolvedKey)) mat.emissiveColor = mat.emissiveColor.add(tint.scale(SELF_GLOW_INTENSITY))
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
    const { level, base } = parseRarity(rarity)
    const { key, color } = resolveMaterialTint(materialName)
    const tint = color ?? ORGANIC_TINTS.leather
    const mat = new StandardMaterial(`handleMat_${key}_${rarity}`, scene)
    mat.diffuseColor = Color3.Lerp(tint, base, Math.min(0.03 + level * 0.015, 0.12))
    mat.specularColor = new Color3(0.05, 0.05, 0.05)
    mat.specularPower = 8
    if (SELF_GLOW.has(key)) mat.emissiveColor = tint.scale(SELF_GLOW_INTENSITY)
    return mat
}

export function createPommelMat(scene, rarity = "common1", materialName = "gold") {
    return buildHardPartMat(scene, "pommel", rarity, materialName, "gold", 0.08, 0.03, 0.26, 0.02)
}
