import { GlowLayer } from "@babylonjs/core"

// GlowLayer.intensity is a single property on the WHOLE shared layer, not
// per-mesh - every skill/effect in this game reuses the same "magicGlow"
// layer (see below), so a fixed layer intensity is the only way to keep
// ANY effect from dragging every other glowing mesh in the scene up to
// its own brightness. Per-mesh variation instead comes from
// customEmissiveColorSelector below, which reads each mesh's own
// _glowBrightness (stashed by addGlow's intensity param, same call
// signature as before - only this file changed, no call site needed to).
const GLOW_LAYER_INTENSITY = 1

export function addGlow(scene, mesh, intensity = 2){
    let gl = scene.effectLayers?.find(l => l.name === "magicGlow")
    if (!gl) {
        // excludeByDefault: without this, once the included list empties out (e.g. all
        // magic circles despawn) the layer falls back to glowing every emissive mesh in
        // the scene - including the character's emissive eye texture.
        gl = new GlowLayer("magicGlow", scene, { excludeByDefault: true, blurKernelSize: 64 })
        gl.intensity = GLOW_LAYER_INTENSITY

        // per-mesh brightness (see the constant's own comment above) - this
        // completely REPLACES the default "just read material.emissiveColor"
        // behavior, so it has to redo that part itself, then scale by
        // whatever this specific mesh asked for via addGlow's intensity arg.
        // Runs at render time, not call time, so it doesn't matter whether a
        // mesh's material.emissiveColor gets set before or after addGlow()
        // is called on it.
        gl.customEmissiveColorSelector = (mesh, subMesh, material, result) => {
            const brightness = mesh._glowBrightness ?? 1
            const emissive = material.emissiveColor
            if (emissive) {
                result.set(emissive.r * brightness, emissive.g * brightness, emissive.b * brightness, material.alpha ?? 1)
            } else {
                result.set(0, 0, 0, material.alpha ?? 1)
            }
        }
    }
    mesh._glowBrightness = intensity
    gl.addIncludedOnlyMesh(mesh)

    mesh._glowLayer = gl
}
