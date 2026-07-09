import { PBRMaterial, Color3 } from "@babylonjs/core"

const METAL_TINTS = {
    iron:       new Color3(0.56, 0.57, 0.58),
    steel:      new Color3(0.65, 0.67, 0.7),
    bronze:     new Color3(0.55, 0.42, 0.25),
    silver:     new Color3(0.75, 0.75, 0.78),
    gold:       new Color3(0.83, 0.68, 0.21),
    mythril:    new Color3(0.55, 0.85, 0.9),
    adamantine: new Color3(0.2, 0.55, 0.7),
}

const METAL_ROUGHNESS = {
    iron: 0.5,
    steel: 0.3,
    bronze: 0.4,
    silver: 0.2,
    gold: 0.25,
    mythril: 0.15,
    adamantine: 0.2,
}

export function createMetalMat(scene, metalColor = "iron") {
    const tint = METAL_TINTS[metalColor] ?? METAL_TINTS.iron
    const roughness = METAL_ROUGHNESS[metalColor] ?? 0.4
    const mat = new PBRMaterial(`metalMat_${metalColor}`, scene)
    mat.albedoColor = tint
    mat.metallic = 1
    mat.roughness = roughness
    mat.environmentIntensity = 0.7
    mat.emissiveColor = tint.scale(0.05)
    return mat
}
