import { StandardMaterial, Color3 } from "@babylonjs/core"
import { METAL_TINTS } from "./metalmat"

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
const ORGANIC_TINTS = {
    wood:       new Color3(0.32, 0.21, 0.12),
    bone:       new Color3(0.82, 0.78, 0.66),
    leather:    new Color3(0.30, 0.18, 0.10),
    beastheart: new Color3(0.50, 0.06, 0.09), // raw, visceral red
}
// The magical crystals carry their own light regardless of rarity; plain
// metals/stones/organics only pick up the faint rarity-tier emissive below.
const SELF_GLOW = new Set(["firecrystal", "frostshard", "stormcrystal"])

function resolveMaterialTint(materialName) {
    const key = (materialName || "").toLowerCase()
    const color = METAL_TINTS[key] ?? GEM_TINTS[key] ?? ORGANIC_TINTS[key]
    return { key, color }
}

export function createBladeMat(scene, rarity = "common1", materialName = "steel") {
    const { level, base } = parseRarity(rarity)
    const { key, color } = resolveMaterialTint(materialName)
    const tint = color ?? METAL_TINTS.steel
    const mat = new StandardMaterial(`bladeMat_${key}_${rarity}`, scene)
    mat.diffuseColor = Color3.Lerp(tint, base, Math.min(0.1 + level * 0.08, 0.5))
    mat.specularColor = new Color3(0.9, 0.9, 0.9)
    mat.specularPower = 128
    mat.emissiveColor = base.scale(0.05 * level)
    if (SELF_GLOW.has(key)) mat.emissiveColor = mat.emissiveColor.add(tint.scale(0.5))
    return mat
}

export function createGuardMat(scene, rarity = "common1", materialName = "bronze") {
    const { level, base } = parseRarity(rarity)
    const { key, color } = resolveMaterialTint(materialName)
    const tint = color ?? METAL_TINTS.bronze
    const mat = new StandardMaterial(`guardMat_${key}_${rarity}`, scene)
    mat.diffuseColor = Color3.Lerp(tint, base, Math.min(0.2 + level * 0.1, 0.7))
    mat.specularColor = new Color3(0.6, 0.55, 0.4)
    mat.specularPower = 64
    mat.emissiveColor = base.scale(0.04 * level)
    if (SELF_GLOW.has(key)) mat.emissiveColor = mat.emissiveColor.add(tint.scale(0.5))
    return mat
}

export function createHandleMat(scene, rarity = "common1", materialName = "leather") {
    const { level, base } = parseRarity(rarity)
    const { key, color } = resolveMaterialTint(materialName)
    const tint = color ?? ORGANIC_TINTS.leather
    const mat = new StandardMaterial(`handleMat_${key}_${rarity}`, scene)
    mat.diffuseColor = Color3.Lerp(tint, base, Math.min(0.1 + level * 0.05, 0.4))
    mat.specularColor = new Color3(0.05, 0.05, 0.05)
    mat.specularPower = 8
    if (SELF_GLOW.has(key)) mat.emissiveColor = tint.scale(0.4)
    return mat
}

export function createPommelMat(scene, rarity = "common1", materialName = "gold") {
    const { level, base } = parseRarity(rarity)
    const { key, color } = resolveMaterialTint(materialName)
    const tint = color ?? METAL_TINTS.gold
    const mat = new StandardMaterial(`pommelMat_${key}_${rarity}`, scene)
    mat.diffuseColor = Color3.Lerp(tint, base, Math.min(0.25 + level * 0.1, 0.75))
    mat.specularColor = new Color3(0.8, 0.75, 0.5)
    mat.specularPower = 96
    mat.emissiveColor = base.scale(0.06 * level)
    if (SELF_GLOW.has(key)) mat.emissiveColor = mat.emissiveColor.add(tint.scale(0.5))
    return mat
}
