import { StandardMaterial, Color3 } from "@babylonjs/core"

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

export function createBladeMat(scene, rarity = "common1") {
    const { level, base } = parseRarity(rarity)
    const steel = new Color3(0.75, 0.76, 0.78)
    const mat = new StandardMaterial(`bladeMat_${rarity}`, scene)
    // mat.diffuseColor = Color3.Lerp(steel, base, Math.min(0.15 + level * 0.1, 0.6))
    mat.specularColor = new Color3(0.9, 0.9, 0.9)
    mat.specularPower = 128
    mat.emissiveColor = base.scale(0.05 * level)
    return mat
}

export function createGuardMat(scene, rarity = "common1") {
    const { level, base } = parseRarity(rarity)
    const bronze = new Color3(0.55, 0.45, 0.25)
    const mat = new StandardMaterial(`guardMat_${rarity}`, scene)
    mat.diffuseColor = Color3.Lerp(bronze, base, Math.min(0.2 + level * 0.1, 0.7))
    mat.specularColor = new Color3(0.6, 0.55, 0.4)
    mat.specularPower = 64
    mat.emissiveColor = base.scale(0.04 * level)
    return mat
}

export function createHandleMat(scene, rarity = "common1") {
    const { level, base } = parseRarity(rarity)
    const leather = new Color3(0.3, 0.18, 0.1)
    const mat = new StandardMaterial(`handleMat_${rarity}`, scene)
    mat.diffuseColor = Color3.Lerp(leather, base, Math.min(0.1 + level * 0.05, 0.4))
    mat.specularColor = new Color3(0.05, 0.05, 0.05)
    mat.specularPower = 8
    return mat
}

export function createPommelMat(scene, rarity = "common1") {
    const { level, base } = parseRarity(rarity)
    const gold = new Color3(0.6, 0.5, 0.2)
    const mat = new StandardMaterial(`pommelMat_${rarity}`, scene)
    mat.diffuseColor = Color3.Lerp(gold, base, Math.min(0.25 + level * 0.1, 0.75))
    mat.specularColor = new Color3(0.8, 0.75, 0.5)
    mat.specularPower = 96
    mat.emissiveColor = base.scale(0.06 * level)
    return mat
}
