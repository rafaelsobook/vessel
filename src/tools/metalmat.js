import { PBRMaterial, Color3, Texture } from "@babylonjs/core"

export const METAL_TINTS = {
    iron:       new Color3(0.56, 0.57, 0.58),
    steel:      new Color3(0.65, 0.67, 0.7),
    bronze:     new Color3(0.55, 0.42, 0.25),
    silver:     new Color3(0.75, 0.75, 0.78),
    gold:       new Color3(0.83, 0.68, 0.21),
    mythril:    new Color3(0.55, 0.85, 0.9),
    adamantine: new Color3(0.2, 0.55, 0.7),
    ruby:       new Color3(0.55, 0.08, 0.1),
    // near-black with a faint cold undertone - moved here from weaponmat.js's
    // own GEM_TINTS (which used to be dragonscale's only home) so armor/
    // pauldrons/helmets/gauntlets (createMetalMat below is the ONLY material
    // function those go through - createcharacter.js's equipArmor/
    // createHelmet/createGauntlet/createPauldron, none of them touch
    // weaponmat.js's own resolveMaterialTint at all) recognize "dragonscale"
    // too, not just weapon parts. resolveMaterialTint checks METAL_TINTS
    // before GEM_TINTS, so weapon parts still resolve it fine from here -
    // nothing else needed on that side. See MATERIAL_TEXTURES below for the
    // real scale-pattern image this material now also carries.
    dragonscale: new Color3(0.05, 0.05, 0.07),
}

export const METAL_ROUGHNESS = {
    iron: 0.5,
    steel: 0.3,
    bronze: 0.4,
    silver: 0.2,
    gold: 0.25,
    mythril: 0.15,
    adamantine: 0.2,
    ruby: 0.25,
    dragonscale: 0.18, // hard, glossy scale
}

// A real image texture some materials carry ON TOP of their flat tint above
// (most materials here are tint-only, no entry needed) - applied as
// albedoTexture (PBRMaterial - armor/weapon hard parts) or diffuseTexture
// (StandardMaterial - the handle) UNDERNEATH the tint's own albedoColor/
// diffuseColor, which still multiplies over it same as always - a textured-
// but-untinted material would just look washed out grey. Keyed by the same
// tint-key METAL_TINTS/weaponmat.js's GEM_TINTS use, so any consumer (armor
// via createMetalMat below, weapon parts via weaponmat.js) picks it up for
// free just by recognizing the material name - nothing per-consumer to wire.
export const MATERIAL_TEXTURES = {
    dragonscale: "./images/modeltex/items/blackdragonscale.webp",
    // phoenixore's own tintKey (itemDictionary.js) - reuses the existing
    // particle sprite rather than a new dedicated surface image, per request
    firecrystal: "./images/particles/smoke2.webp",
}

// Name-safe keys into METAL_TINTS/METAL_ROUGHNESS (derived, not hand-copied,
// so it can't drift out of sync) - use METAL_COLOR.ADAMANTINE etc. instead of
// bare strings so a typo is a ReferenceError instead of a silent fallback to
// iron (see createMetalMat's ?? METAL_TINTS.iron below).
export const METAL_COLOR = Object.fromEntries(
    Object.keys(METAL_TINTS).map(key => [key.toUpperCase(), key])
)

export function createMetalMat(scene, metalColor = "iron") {
    const tint = METAL_TINTS[metalColor] ?? METAL_TINTS.iron
    const roughness = METAL_ROUGHNESS[metalColor] ?? 0.4
    const mat = new PBRMaterial(`metalMat_${metalColor}`, scene)
    mat.albedoColor = tint
    mat.metallic = 1
    mat.roughness = roughness
    mat.environmentIntensity = 0.7
    mat.emissiveColor = tint.scale(0.05)
    // MATERIAL_TEXTURES - only materials that actually have a real surface
    // image set one (dragonscale so far); everything else stays flat-tinted
    // exactly as before, this doesn't touch them
    const texturePath = MATERIAL_TEXTURES[metalColor]
    if(texturePath) mat.albedoTexture = new Texture(texturePath, scene)
    return mat
}
