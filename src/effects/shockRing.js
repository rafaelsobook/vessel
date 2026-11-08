import { Color3, Constants, DynamicTexture, MeshBuilder, StandardMaterial } from "@babylonjs/core"
import { drawRing } from "./transformationFire.js"

// THE SHOCK RING - a ring of light sweeping out along the ground from a point
// and fading as it goes: the one the evolution's fire throws when it catches
// (effects/transformationFire.js's shockRing), on its own. A slam landing
// (charactersystem/knockback.js's bash) pops one at the feet of whoever it hit.

// one per scene - it's small and never changes
const textures = new WeakMap()

function ringTexture(scene){
    let tex = textures.get(scene)
    if(tex) return tex
    // mipmapped - small on screen, and without mips the thin ring breaks up
    tex = new DynamicTexture("shockRing", { width: 256, height: 256 }, scene, true)
    const ctx = tex.getContext()
    ctx.clearRect(0, 0, 256, 256)
    drawRing(ctx, 256)
    tex.hasAlpha = true
    tex.update()
    textures.set(scene, tex)
    return tex
}

// one material per scene and colour, shared by every ring of it - each ring
// fades through its own mesh's visibility, so they needn't be made and thrown
// away per ring (a blast pops two or three of them at once)
const materials = new WeakMap()   // scene -> Map(colour hex -> material)

function ringMaterial(scene, color){
    let byColor = materials.get(scene)
    if(!byColor) materials.set(scene, byColor = new Map())
    const key = color.toHexString()
    let mat = byColor.get(key)
    if(mat) return mat
    mat = new StandardMaterial(`shockRingMat.${key}`, scene)
    mat.disableLighting = true
    mat.diffuseColor = Color3.Black()
    mat.specularColor = Color3.Black()
    mat.emissiveColor = color.clone()
    mat.opacityTexture = ringTexture(scene)
    mat.backFaceCulling = false
    mat.alphaMode = Constants.ALPHA_ADD
    byColor.set(key, mat)
    return mat
}

// position: the point on the ground it spreads from. size: metres across at
// its widest; seconds: how long it takes to get there and fade out
export function popShockRing(scene, position, { size = 3, seconds = 0.5, color = new Color3(1, 0.45, 0.1) } = {}){
    if(!scene || scene.isDisposed) return
    const mat = ringMaterial(scene, color)

    const ring = MeshBuilder.CreateGround("shockRing", { width: 1, height: 1 }, scene)
    ring.isPickable = false
    ring.material = mat
    ring.position.set(position.x, position.y + 0.04, position.z)

    let t = 0
    const grow = scene.onBeforeRenderObservable.add(() => {
        t = Math.min(1, t + scene.getAnimationRatio() / 60 / seconds)
        // fast out, slowing - like the evolution's
        const scale = 0.4 + (size - 0.4) * (1 - Math.pow(1 - t, 3))
        ring.scaling.set(scale, 1, scale)
        ring.visibility = 1 - t
        if(t < 1) return
        scene.onBeforeRenderObservable.remove(grow)
        // the mesh only - its material is shared (ringMaterial)
        ring.dispose()
    })
}
