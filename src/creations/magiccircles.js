import { Animation, MeshBuilder, StandardMaterial, Texture, Color3, Vector3,
    BackEase, EasingFunction, GlowLayer } from "@babylonjs/core"
import { createParticlesForMesh } from "../tools/particlesystem.js";
import { addGlow } from "../tools/glow.js";
import { getAllSounds } from "../components/soundSystem.js";

// persistent texture cache (at most ~9 imgName values, see ./images/circles,
// x2 for the two alpha modes below - small, fixed, bounded, not a leak) -
// avoids re-decoding/re-uploading the same circle .webp on every single
// cast. Babylon's own Texture constructor already dedupes by URL internally
// (Texture._getFromCache, @babylonjs/core/Materials/Textures/texture.pure.js) -
// the GPU pixel data itself was never truly duplicated across casts of the
// SAME style even before this - but despawnMagicCircle used to call
// mat.dispose(false, true) (forceDisposeTextures), which evicted that
// cached GPU texture the instant the LAST currently-active circle of a
// given style despawned. The next cast of that same style then paid the
// full decode+upload cost all over again, every time. Holding one Texture
// object per (imgName, alphaMode) here, forever, keeps it permanently in
// Babylon's own cache so that reload never happens (see despawnMagicCircle's
// own updated comment on why materials still get disposed WITHOUT their
// texture now).
//
// keyed by alphaMode too, not just imgName: spawnMagicCircle and
// createMagicCircle get their alpha two genuinely different ways
// (diffuseTexture.hasAlpha - the image's own real alpha channel - vs
// emissiveTexture/opacityTexture.getAlphaFromRGB - alpha DERIVED from RGB
// luminance instead), both of which are properties ON THE TEXTURE OBJECT
// ITSELF, not the material. The same imgName genuinely gets used through
// BOTH functions in practice ("divine1" - spawnMagicCircle in questions.js,
// createMagicCircle via radiantjudgmentSkill's own magicCircleImg) - a
// single shared texture per imgName would mean whichever function's mode
// got set last quietly overrides the other's rendering the next time either
// one reuses that same "divine1" texture object.
//
// scene-scoped: main.js's changeScene() fully disposes the old Scene object
// and creates a brand new one on every place transition - Texture has no
// isDisposed() to self-detect that (unlike Mesh below), so without this the
// cache would silently keep handing back a Texture belonging to a scene
// that no longer exists after the very next place change. Same
// scene-tracking guard assetcreation/createweapon.js's own partMatCache
// already established.
const circleTextureCache = new Map()
let circleCacheScene = null
function getCircleTexture(scene, imgName, alphaMode){
    if(circleCacheScene !== scene){
        circleTextureCache.clear()
        circleCacheScene = scene
    }
    const key = `${imgName}::${alphaMode}`
    let tex = circleTextureCache.get(key)
    if(!tex){
        tex = new Texture(`./images/circles/${imgName}.webp`, scene, false, false)
        if(alphaMode === "rgb") tex.getAlphaFromRGB = true
        else tex.hasAlpha = true
        circleTextureCache.set(key, tex)
    }
    return tex
}

// cached template plane, CLONED (not instanced) per cast - skips
// MeshBuilder.CreatePlane's own geometry/UV/normal build every single cast.
// Deliberately .clone(), not .createInstance(): every circle still needs
// its OWN independent material, since the fade-in/fade-out animation below
// targets "material.alpha" per-cast and multiple circles of the SAME style
// can genuinely be on screen at once (a shrine's permanent apt_fire circle
// in localroomdb.js alongside a player casting flamebrand nearby, say) -
// InstancedMesh always mirrors its source mesh's own material (confirmed
// via @babylonjs/core/Meshes/instancedMesh.pure.js - same fact
// skillEffects.js's fireEnemySkillProjectile already leaned on), so a true
// instance would make every simultaneously-active circle of that style
// fade in/out together instead of independently. Mesh DOES have
// isDisposed() (unlike Texture above), which already self-heals across a
// scene change on its own - kept as the guard here rather than duplicating
// the scene-tracking var for a case that doesn't strictly need it.
let circleTemplate = null
function getCircleTemplate(scene){
    if(!circleTemplate || circleTemplate.isDisposed()){
        circleTemplate = MeshBuilder.CreatePlane("magic_circle_template", { width: 2.5, height: 2.5 }, scene)
        circleTemplate.isVisible = false
        circleTemplate.isPickable = false
        circleTemplate.setEnabled(false)
    }
    return circleTemplate
}

export function spawnMagicCircle(position, scene, imgName, intensity = 0.5, timeOut = 5000) {
    const disc = getCircleTemplate(scene).clone("magic_circle")
    disc.isVisible = true
    disc.setEnabled(true)
    disc.rotation.x = Math.PI / 2
    disc.position = new Vector3(position.x, 0, position.z)
    disc.scaling = new Vector3(0.01, 0.01, 0.01)
    disc.isPickable = false
    disc.renderingGroupId = 1
    scene.setRenderingAutoClearDepthStencil(1, false)

    const mat = new StandardMaterial("magic_circle_mat", scene)
    const circleTexture = getCircleTexture(scene, imgName, "hasAlpha")
    mat.diffuseTexture = circleTexture
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

    // stashed on the disc itself (same pattern addGlow already uses for
    // disc._glowLayer) so despawnMagicCircle can find and dispose it - the
    // return value used to be discarded entirely here, meaning every single
    // magic circle spawned in the game (every skill cast, player or enemy)
    // left this sparkle trail running forever, orphaned, after the circle
    // itself was long gone
    disc._sparkles = createParticlesForMesh(disc, scene, "thin1")

    setTimeout(() => {
        despawnMagicCircle(disc, scene)
    }, timeOut)

    getAllSounds().magicCircle?.play()
    return disc
}
// facingDirection (optional Vector3): when omitted, the circle lies flat
// facing straight up - the original ground-rune look every existing caller
// (localroomdb.js, questions.js) already relies on, untouched. When given,
// the circle stands upright and yaws to face that direction instead (e.g.
// "in front of a hand, facing whatever's being aimed at" - skillEffects.js's
// singlecast) - CreatePlane's front face points -Z by default, so aiming it
// at facingDirection is a yaw of atan2(dir.x, dir.z) + PI, not the ground
// rune's rotation.x flatten. The endless "spin" animation below owns
// rotation.y in the ground-rune case (spinning flat in place reads fine),
// but rotation.y is exactly the yaw that's now doing the aiming, so spin
// moves to rotation.z instead - same clock-face spin, staying face-on.
export function createMagicCircle(position, scene, imgName, intensity = 0.5, timeOut = 5000, facingDirection = null, sizeScale = 1){
    const disc = getCircleTemplate(scene).clone("magic_circle")
    disc.isVisible = true
    disc.setEnabled(true)
    if(facingDirection){
        disc.rotation.y = Math.atan2(facingDirection.x, facingDirection.z) + Math.PI
    } else {
        disc.rotation.x = Math.PI / 2
    }

    disc.scaling = new Vector3(0.01, 0.01, 0.01)
    disc.isPickable = false
    disc.renderingGroupId = 1
    scene.setRenderingAutoClearDepthStencil(1, false)

    const mat = new StandardMaterial("magic_circle_mat", scene)
    const circleTexture = getCircleTexture(scene, imgName, "rgb")

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
        { frame: fps*2, value: new Vector3(sizeScale, sizeScale, sizeScale) },
    ])
    scaleUp.setEasingFunction(ease)

    const fadeIn = new Animation("fadeIn", "material.alpha", fps, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT)
    fadeIn.setKeys([
        { frame: 0,  value: 0 },
        { frame: 20, value: 1 },
    ])

    const spin = new Animation("spin", facingDirection ? "rotation.z" : "rotation.y", fps, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE)
    spin.setKeys([
        { frame: 0,   value: 0 },
        { frame: 120, value: Math.PI * 2 },
    ])

    scene.beginDirectAnimation(disc, [fadeIn, scaleUp], 0, 25, false)
    scene.beginDirectAnimation(disc, [spin], 0, 120, true)

    disc.position = new Vector3(position.x, position.y, position.z)

    addGlow(scene, disc, 2)

    // stashed on the disc itself (same pattern addGlow already uses for
    // disc._glowLayer) so despawnMagicCircle can find and dispose it - the
    // return value used to be discarded entirely here, meaning every single
    // magic circle spawned in the game (every skill cast, player or enemy)
    // left this sparkle trail running forever, orphaned, after the circle
    // itself was long gone
    disc._sparkles = createParticlesForMesh(disc, scene, "thin1")

    getAllSounds().magicCircle?.play()
    setTimeout(() => {
        despawnMagicCircle(disc, scene)
    }, timeOut)
    return disc
}
export function spawnMultipleCircles(){

}
function despawnMagicCircle(disc, scene) {
    // runs off a setTimeout (see spawnMagicCircle/createMagicCircle) - the
    // scene can change or the disc can get cleaned up some other way before
    // that timeout fires, leaving disc disposed (material already null) by
    // the time this runs
    if (!disc || disc.isDisposed() || !disc.material) return

    const fadeOut = new Animation("fadeOut", "material.alpha", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT)
    fadeOut.setKeys([
        { frame: 0,  value: disc.material.alpha },
        { frame: 15, value: 0 },
    ])
    scene.beginDirectAnimation(disc, [fadeOut], 0, 15, false, 1, () => {
        if (disc.isDisposed()) return
        if (disc._glowLayer) disc._glowLayer.removeIncludedOnlyMesh(disc)
        // createParticlesForMesh's own sparkle trail (see spawnMagicCircle/
        // createMagicCircle above) - its emitter is the disc itself, but
        // Babylon doesn't auto-dispose a particle system just because its
        // emitter mesh gets disposed, so this was left running forever
        // otherwise. dispose(false) - particleTexture is particlesystem.js's
        // own shared/persistent cache, not owned by this one system.
        if(disc._sparkles){
            disc._sparkles.stop()
            disc._sparkles.dispose(false)
        }
        // captured before disposing the mesh - disc.material itself is
        // never read again after this point, so order doesn't matter for
        // correctness, just kept mesh-then-material for safety (nothing
        // still mid-render-pass tries to rebind an already-disposed
        // material this way)
        const mat = disc.material
        disc.dispose()
        // disc.dispose() alone only frees the MESH - Mesh.dispose()'s own
        // disposeMaterialAndTextures parameter defaults to false, so the
        // StandardMaterial itself was never actually freed before the
        // original fix here (a material leaked per cast - every single
        // skill cast in the game runs through one of these two functions).
        // Deliberately NOT forceDisposeTextures anymore though (was
        // mat.dispose(false, true)) - the material's own diffuseTexture/
        // emissiveTexture/opacityTexture is now circleTextureCache's
        // persistent, shared Texture object (see top of file), reused by
        // every other circle of the same (imgName, alphaMode) including
        // ones still actively on screen right now. Disposing it here would
        // pull the GPU texture out from under every other currently-active
        // circle sharing it, not just this one.
        mat?.dispose(false, false)
    })
}


