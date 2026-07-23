import { GlowLayer } from "@babylonjs/core"
export function addGlow(scene, mesh, intensity = 2){
    let gl = scene.effectLayers?.find(l => l.name === "magicGlow")
    if (!gl) {
        // excludeByDefault: without this, once the included list empties out (e.g. all
        // magic circles despawn) the layer falls back to glowing every emissive mesh in
        // the scene - including the character's emissive eye texture.
        gl = new GlowLayer("magicGlow", scene, { excludeByDefault: true, blurKernelSize: 64 })
        gl.intensity = intensity
    } else if (intensity > gl.intensity) {
        // intensity is global to the shared layer, not per-mesh - whichever caller
        // wants the strongest glow wins, rather than freezing at whoever ran first
        gl.intensity = intensity
    }
    gl.addIncludedOnlyMesh(mesh)

    mesh._glowLayer = gl
}