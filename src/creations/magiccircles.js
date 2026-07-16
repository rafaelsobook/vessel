import { Animation, MeshBuilder, StandardMaterial, Texture, Color3, Vector3, 
    BackEase, EasingFunction, GlowLayer } from "@babylonjs/core"
import { createParticlesForMesh } from "../tools/particlesystem.js";
import { addGlow } from "../tools/glow.js";
import { getAllSounds } from "../components/soundSystem.js";

export function spawnMagicCircle(position, scene, imgName, intensity = 0.5, timeOut = 5000) {
    const disc = MeshBuilder.CreatePlane("magic_circle", { width: 2.5, height: 2.5 }, scene)
    disc.rotation.x = Math.PI / 2
    disc.position = new Vector3(position.x, 0, position.z)
    disc.scaling = new Vector3(0.01, 0.01, 0.01)
    disc.isPickable = false
    disc.renderingGroupId = 1
    scene.setRenderingAutoClearDepthStencil(1, false)

    const mat = new StandardMaterial("magic_circle_mat", scene)
    const circleTexture = new Texture(`./images/circles/${imgName}.webp`, scene, false, false)
    mat.diffuseTexture = circleTexture
    mat.diffuseTexture.hasAlpha = true
    mat.useAlphaFromDiffuseTexture = true
    mat.emissiveTexture = circleTexture
    mat.emissiveColor = new Color3(intensity, intensity, intensity)
    
    mat.zOffset = -2
    mat.backFaceCulling = false
    mat.alpha = 0
    disc.material = mat

    const ease = new BackEase(0.6)
    ease.setEasingMode(EasingFunction.EASINGMODE_EASEOUT)

    let fps = 30
    const scaleUp = new Animation("scaleUp", "scaling", fps, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT)
    scaleUp.setKeys([
        { frame: 0,  value: new Vector3(0.01, 0.01, 0.01) },
        { frame: fps*2, value: new Vector3(1, 1, 1) },
    ])
    scaleUp.setEasingFunction(ease)

    const fadeIn = new Animation("fadeIn", "material.alpha", fps, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT)
    fadeIn.setKeys([
        { frame: 0,  value: 0 },
        { frame: 20, value: 1 },
    ])

    const spin = new Animation("spin", "rotation.y", fps, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE)
    spin.setKeys([
        { frame: 0,   value: 0 },
        { frame: 120, value: Math.PI * 2 },
    ])

    scene.beginDirectAnimation(disc, [fadeIn, scaleUp], 0, 25, false)
    scene.beginDirectAnimation(disc, [spin], 0, 120, true)

    addGlow(scene, disc, 2)

    createParticlesForMesh(disc, scene, "thin1")

    setTimeout(() => {
        despawnMagicCircle(disc, scene)
    }, timeOut)

    getAllSounds().magicCircle.play()
    return disc
}
export function createMagicCircle(position, scene, imgName, intensity = 0.5, timeOut = 5000){
    const disc = MeshBuilder.CreatePlane("magic_circle", { width: 2.5, height: 2.5 }, scene)
    disc.rotation.x = Math.PI / 2
    
    disc.scaling = new Vector3(0.01, 0.01, 0.01)
    disc.isPickable = false
    disc.renderingGroupId = 1
    scene.setRenderingAutoClearDepthStencil(1, false)

    const mat = new StandardMaterial("magic_circle_mat", scene)
    const circleTexture = new Texture(`./images/circles/${imgName}.webp`, scene, false, false)
    
    circleTexture.getAlphaFromRGB = true
    
    mat.emissiveTexture = circleTexture
    mat.opacityTexture  = circleTexture
    mat.emissiveColor = new Color3(intensity, intensity, intensity)
    
    mat.zOffset = -2
    mat.backFaceCulling = false
    mat.alpha = 0
    disc.material = mat

    const ease = new BackEase(0.6)
    ease.setEasingMode(EasingFunction.EASINGMODE_EASEOUT)

    let fps = 30
    const scaleUp = new Animation("scaleUp", "scaling", fps, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT)
    scaleUp.setKeys([
        { frame: 0,  value: new Vector3(0.01, 0.01, 0.01) },
        { frame: fps*2, value: new Vector3(1, 1, 1) },
    ])
    scaleUp.setEasingFunction(ease)

    const fadeIn = new Animation("fadeIn", "material.alpha", fps, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT)
    fadeIn.setKeys([
        { frame: 0,  value: 0 },
        { frame: 20, value: 1 },
    ])

    const spin = new Animation("spin", "rotation.y", fps, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE)
    spin.setKeys([
        { frame: 0,   value: 0 },
        { frame: 120, value: Math.PI * 2 },
    ])

    scene.beginDirectAnimation(disc, [fadeIn, scaleUp], 0, 25, false)
    scene.beginDirectAnimation(disc, [spin], 0, 120, true)

    disc.position = new Vector3(position.x, position.y, position.z)

    addGlow(scene, disc, 2)

    createParticlesForMesh(disc, scene, "thin1")

    getAllSounds().magicCircle.play()
    setTimeout(() => {
        despawnMagicCircle(disc, scene)
    }, timeOut)
    return disc
}
export function spawnMultipleCircles(){

}
function despawnMagicCircle(disc, scene) {
    const fadeOut = new Animation("fadeOut", "material.alpha", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT)
    fadeOut.setKeys([
        { frame: 0,  value: disc.material.alpha },
        { frame: 15, value: 0 },
    ])
    scene.beginDirectAnimation(disc, [fadeOut], 0, 15, false, 1, () => {
        if (disc._glowLayer) disc._glowLayer.removeIncludedOnlyMesh(disc)
        disc.dispose()
    })
}


