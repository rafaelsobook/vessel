import { GlowLayer } from "@babylonjs/core"
export function addGlow(scene, mesh, intensity = 2){
    let gl = scene.effectLayers?.find(l => l.name === "magicGlow")
    if (!gl) {
        gl = new GlowLayer("magicGlow", scene)
        gl.intensity = intensity
    }
    gl.addIncludedOnlyMesh(mesh)

    mesh._glowLayer = gl
}