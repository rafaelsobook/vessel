import { ParticleSystem, MeshParticleEmitter, Texture, Vector3, Color4, Color3, PointLight, Attractor } from "@babylonjs/core"
import { GLOW_COLORS } from "./materials.js"
import { randNum } from "./random.js"

// persistent per-path texture cache - every function in this file is
// called on basically every skill cast/hit/explosion/aura in the game, and
// every one of them used to load `new Texture(path, scene)` completely
// fresh, every single time. Babylon's own Texture constructor already
// dedupes the underlying GPU resource by URL (Texture._getFromCache,
// @babylonjs/core/Materials/Textures/texture.pure.js - same fact
// magiccircles.js's own texture cache already leans on), but every
// particle system created here also gets .dispose()'d with disposeTexture
// defaulting to true (ParticleSystem.dispose's own default, opposite of
// Mesh.dispose's), which evicts that cached GPU texture the instant the
// LAST currently-active particle system using it stops - the next burst/
// trail/aura using the same sprite then pays the full decode+upload cost
// all over again. Holding one Texture object per path here, forever, keeps
// it permanently cached - a small, fixed, bounded set (the handful of
// sprites in ./images/particles), not a leak. Every caller below must now
// dispose ITS OWN particle system with disposeTexture explicitly false
// (see each .dispose(false) call site, here and in skillEffects.js/
// magiccircles.js) - the texture is shared/persistent now, not owned by
// any single particle system anymore.
// scene-scoped: main.js's changeScene() fully disposes the old Scene object
// and creates a brand new one on every place transition (village <->
// openworld <-> dungeon, a routine, frequent event) - Texture has no
// isDisposed() to self-detect that the way Mesh does, so a cache keyed only
// by path would silently keep handing back a Texture belonging to a scene
// that no longer exists after the very next place change. Same
// scene-tracking guard assetcreation/createweapon.js's own partMatCache
// already established (partMatCacheScene) - clear the whole cache the
// moment the scene we're being asked for differs from the one we last
// cached against.
const particleTextureCache = new Map()
let particleTextureCacheScene = null
function getParticleTexture(scene, path){
    if(particleTextureCacheScene !== scene){
        particleTextureCache.clear()
        particleTextureCacheScene = scene
    }
    let tex = particleTextureCache.get(path)
    if(!tex){
        tex = new Texture(path, scene)
        particleTextureCache.set(path, tex)
    }
    return tex
}

// every ./images/particles/* sprite is .webp now EXCEPT the ones listed
// here - still only a .png on disk, never actually converted. Route every
// particle-texture-by-name lookup through this instead of hand-building the
// `.webp` path inline, so a name missing its webp conversion doesn't just
// silently 404 (magic circles' own sparkle trail - "thin1" - did exactly
// this: nothing rendered, no console error either, since a failed Texture
// load just shows nothing rather than throwing). Delete a name from this
// set once its real .webp file actually exists.
const PARTICLE_TEXTURE_STILL_PNG = new Set(["thin1"])
function particleTexturePath(name){
    const ext = PARTICLE_TEXTURE_STILL_PNG.has(name) ? "png" : "webp"
    return `./images/particles/${name}.${ext}`
}

export function createFireParticles(position, scene) {
    const light = new PointLight("fire_light", new Vector3(position.x, position.y + 0.6, position.z), scene)
    light.diffuse  = new Color3(1.0, 0.4, 0.1)
    light.specular = new Color3(0, 0, 0)
    light.intensity = 1.4
    light.range = 5

    let tick = 0
    scene.registerBeforeRender(() => {
        tick += 0.08
        light.intensity = 1.2 + Math.sin(tick * 4.3) * 0.15 + Math.sin(tick * 7.1) * 0.08
    })

    const particles = new ParticleSystem("fire", 250, scene)
    particles.particleTexture = getParticleTexture(scene, "./images/particles/fireTex.webp")
    particles.blendMode = ParticleSystem.BLENDMODE_ADD

    particles.emitter = new Vector3(position.x, position.y + 0.25, position.z)
    particles.minEmitBox = new Vector3(-0.12, 0, -0.12)
    particles.maxEmitBox = new Vector3( 0.12, 0,  0.12)

    particles.color1    = new Color4(1.0, 0.7, 0.1, 1.0)
    particles.color2    = new Color4(1.0, 0.2, 0.0, 1.0)
    particles.colorDead = new Color4(0.15, 0.0, 0.0, 0.0)

    particles.minSize = 0.08
    particles.maxSize = 0.28

    particles.minLifeTime = 0.25
    particles.maxLifeTime = 0.65

    particles.emitRate = 120

    particles.direction1 = new Vector3(-0.15, 1.0, -0.15)
    particles.direction2 = new Vector3( 0.15, 2.0,  0.15)

    particles.minEmitPower = 0.4
    particles.maxEmitPower = 0.9
    particles.updateSpeed  = 0.02

    particles.minAngularSpeed = -Math.PI / 6
    particles.maxAngularSpeed =  Math.PI / 6

    particles.start()

    return { particles, light }
}
// "wreathed in flame" look for a whole body, not a single torch flame -
// skillEffects.js's disintegrationSkill (a fire ground-trap that binds
// whoever walks into it) wanted the bound enemy to actually look like it's
// burning. Tried createParticlesForMesh(enemy.body, ...) for this first,
// but that emits from the MESH SURFACE via MeshParticleEmitter - enemy.body
// is the invisible collision capsule (createEnemy.js), not the visible
// monster model, and it's small/simply-shaped, so particles only ever
// showed up as one small poof near the top instead of covering the
// creature. This instead uses createFireParticles' own proven "rising
// flame" recipe (direction1/2 drifting upward, warm color gradient) but
// with minEmitBox/maxEmitBox sized to the mesh's own real bodyHeight/
// bodyRadius, spawning particles anywhere from feet to head instead of one
// fixed point - and emitter is the MESH itself (not a static position), so
// it tracks automatically frame to frame like createParticlesForMesh does.
export function createBodyFireParticles(mesh, scene, bodyHeight = 1.6, bodyRadius = 0.6) {
    const particles = new ParticleSystem("body_fire", 300, scene)
    particles.particleTexture = getParticleTexture(scene, "./images/particles/fireTex.webp")
    particles.blendMode = ParticleSystem.BLENDMODE_ADD

    // enemy.body's own position is VERTICALLY CENTERED on the capsule, not
    // based at the feet (createEnemy.js: yPos = groundY + bodyHeight/2 +
    // 0.05) - a first version spanned local Y 0 (assumed feet) to
    // bodyHeight (assumed head), which actually put the whole emission
    // volume from mid-body up to a full bodyHeight ABOVE that, floating
    // well over the creature's actual head. Centered on 0 instead
    // (-bodyHeight/2 to +bodyHeight/2) correctly spans feet to head
    // relative to where the mesh's own origin really sits.
    particles.emitter = mesh
    particles.minEmitBox = new Vector3(-bodyRadius * 0.5, -bodyHeight * 0.5, -bodyRadius * 0.5)
    particles.maxEmitBox = new Vector3( bodyRadius * 0.5,  bodyHeight * 0.5,  bodyRadius * 0.5)

    particles.color1    = new Color4(1.0, 0.7, 0.1, 1.0)
    particles.color2    = new Color4(1.0, 0.2, 0.0, 1.0)
    particles.colorDead = new Color4(0.15, 0.0, 0.0, 0.0)

    particles.minSize = 0.14
    particles.maxSize = 0.4

    particles.minLifeTime = 0.3
    particles.maxLifeTime = 0.7

    // scaled up from createFireParticles' own 120 - covering a whole body
    // instead of one torch-sized point needs more particles in flight at
    // once to read as continuous flame instead of sparse individual puffs
    particles.emitRate = 220

    particles.direction1 = new Vector3(-0.15, 1.0, -0.15)
    particles.direction2 = new Vector3( 0.15, 2.0,  0.15)

    particles.minEmitPower = 0.4
    particles.maxEmitPower = 0.9
    particles.updateSpeed  = 0.02

    particles.minAngularSpeed = -Math.PI / 6
    particles.maxAngularSpeed =  Math.PI / 6

    particles.start()
    return particles
}
export function createParticlesForMesh(mesh, scene, textureName = "flare", options = {}) {
    const {
        color1    = new Color4(1.0, 1.0, 1.0, 1.0),
        color2    = new Color4(0.6, 0.6, 1.0, 1.0),
        colorDead = new Color4(0.0, 0.0, 0.3, 0.0),
        minSize   = 0.05,
        maxSize   = 0.18,
        minLife   = 0.3,
        maxLife   = 0.9,
        emitRate  = 80,
        minPower  = 0.3,
        maxPower  = 1.2,
        capacity  = 200,
    } = options

    const particles = new ParticleSystem("mesh_particles", capacity, scene)
    particles.particleTexture = getParticleTexture(scene, particleTexturePath(textureName))
    particles.blendMode = ParticleSystem.BLENDMODE_ADD

    particles.emitter = mesh

    particles.addSizeGradient(0, 0.6, 0);
    particles.addSizeGradient(0, .7, 0);
    particles.addSizeGradient(0, .7, 0);
    particles.addSizeGradient(0, .7, 0);

    const meshEmitter = new MeshParticleEmitter(mesh)
    meshEmitter.useMeshNormalsForDirection = true
    particles.particleEmitterType = meshEmitter

    particles.color1    = color1
    particles.color2    = color2
    particles.colorDead = colorDead

    particles.minSize = minSize
    particles.maxSize = maxSize

    particles.minLifeTime = minLife
    particles.maxLifeTime = maxLife

    particles.emitRate  = emitRate
    particles.minEmitPower = minPower
    particles.maxEmitPower = maxPower
    particles.updateSpeed  = 0.01

    particles.start()

    return particles
}


// Named trailing-particle "styles" for offense-skill projectiles - built for
// skillEffects.js's singlecast but deliberately generic so any future
// elemental skill can reuse it instead of hand-rolling its own particle
// system. Colors reuse GLOW_COLORS (materials.js) so "blue" reads as the
// same blue whether it's a glowing weapon, a lightning arc, or this.
const PARTICLE_STYLE_PRESETS = {
    // tight, fast streak trailing the projectile - the default "magic bolt" look
    oneline:   { texture: "flare",  minSize: 0.08, maxSize: 0.22, minLife: 0.15, maxLife: 0.35, emitRate: 150, spread: 0.05 },
    // warmer, more chaotic, slightly larger puffs
    flames:    { texture: "fireTex", minSize: 0.15, maxSize: 0.4,  minLife: 0.25, maxLife: 0.55, emitRate: 200, spread: 0.15 },
    // slow, wide, writhing wisps trailing behind
    tentacles: { texture: "smoke2", minSize: 0.2,  maxSize: 0.5,  minLife: 0.4,  maxLife: 0.9,  emitRate: 90,  spread: 0.3 },
}

function resolveParticleColor(colorName){
    const palette = GLOW_COLORS[colorName] ?? GLOW_COLORS.blue
    return {
        color1:    new Color4(palette.emissive.r, palette.emissive.g, palette.emissive.b, 0.9),
        color2:    new Color4(palette.diffuse.r,  palette.diffuse.g,  palette.diffuse.b,  0.6),
        colorDead: new Color4(palette.diffuse.r * 0.2, palette.diffuse.g * 0.2, palette.diffuse.b * 0.2, 0),
    }
}

// emitter: a mesh (e.g. an invisible projectile box) particles trail from.
// particleStyles: [{name: "oneline", color: "blue"}, ...] - one ParticleSystem
// per entry, all attached to the same emitter, so a skill can layer several
// looks at once (e.g. flames + oneline). Unknown style names fall back to
// "oneline". Returns the created systems so the caller can stop/dispose them
// when the projectile itself goes away (see skillEffects.js).
export function createParticleSystem(scene, emitter, particleStyles = [{ name: "oneline", color: "blue" }]){
    return particleStyles.map(({ name, color }) => {
        const preset = PARTICLE_STYLE_PRESETS[name] ?? PARTICLE_STYLE_PRESETS.oneline
        const { color1, color2, colorDead } = resolveParticleColor(color)

        const particles = new ParticleSystem(`skillfx_${name}_${Date.now()}`, 300, scene)
        particles.particleTexture = getParticleTexture(scene, `./images/particles/${preset.texture}.webp`)
        particles.blendMode = ParticleSystem.BLENDMODE_ADD

        const meshEmitter = new MeshParticleEmitter(emitter)
        particles.particleEmitterType = meshEmitter
        particles.emitter = emitter

        particles.minEmitBox = new Vector3(-preset.spread, -preset.spread, -preset.spread)
        particles.maxEmitBox = new Vector3(preset.spread, preset.spread, preset.spread)

        particles.color1    = color1
        particles.color2    = color2
        particles.colorDead = colorDead

        particles.minSize = preset.minSize
        particles.maxSize = preset.maxSize
        particles.minLifeTime = preset.minLife
        particles.maxLifeTime = preset.maxLife
        particles.emitRate    = preset.emitRate

        particles.minEmitPower = 0.05
        particles.maxEmitPower = 0.2
        particles.updateSpeed  = 0.01

        particles.start()
        return particles
    })
}

// Generic one-off particle system builder - ported from an older build of
// this game (was a class method reading `this._scene`/`BABYLON.x`; scene is
// now an explicit param, `BABYLON.x` imports are the same ones already used
// throughout this file). Kept close to the original rather than folded into
// one of the more specific helpers above, since createExplosionBurst below
// needs exactly this shape.
export function createParticle(scene, imgTex, capac, pos, spd, lifetime, minSize, maxSize, gravityY, particleType, willStart, emitterMesh, haveColor, haveScale){
    const myParticleSystem = new ParticleSystem(`particle.${randNum(1000, 99999)}`, capac, scene)

    myParticleSystem.minEmitPower = 1
    myParticleSystem.maxEmitPower = 1
    switch(particleType){
        case "sphere":
            myParticleSystem.createSphereEmitter(1)
        break
        case "cone":
            const radius = 2
            const angle = Math.PI / 4
            myParticleSystem.createConeEmitter(radius, angle)
        break
    }
    myParticleSystem.particleTexture = getParticleTexture(scene, particleTexturePath(imgTex))
    if(pos) myParticleSystem.emitter = new Vector3(pos.x, pos.y, pos.z)
    if(emitterMesh) myParticleSystem.emitter = emitterMesh
    willStart ? myParticleSystem.start() : myParticleSystem.stop()

    myParticleSystem.updateSpeed = spd
    myParticleSystem.minSize = minSize
    myParticleSystem.maxSize = maxSize
    myParticleSystem.gravity = new Vector3(0, gravityY, 0)

    myParticleSystem.minLifeTime = lifetime.min
    myParticleSystem.maxLifeTime = lifetime.max

    if(haveColor){
        switch(haveColor){
            case "red":
                myParticleSystem.color1 = new Color4(0.95, 0, 0)
                myParticleSystem.color2 = new Color4(0.72, 0.42, 0.09)
                myParticleSystem.colorDead = new Color4(0.29, 0.01, 0, 0)
            break
        }
        if(haveColor.r || haveColor.r === 0){
            const {r, g, b} = haveColor
            myParticleSystem.color1 = new Color4(r, g, b)
            myParticleSystem.color2 = new Color4(r + .2, g + .2, b + .2)
            myParticleSystem.colorDead = new Color4(r - .6, g - .6, b - .6)
        }
    }
    if(haveScale){
        myParticleSystem.minScaleX = haveScale.x
        myParticleSystem.maxScaleX = haveScale.x + .5
        myParticleSystem.minScaleY = haveScale.y
        myParticleSystem.minScaleY = haveScale.y + .5
    }
    return myParticleSystem
}

// Babylon Particle Editor export (ParticleSystem.Parse's JSON format), used
// as the base for the floating-embers layer below - texture swapped from
// the babylonjs.com CDN to the local flare.png every other particle system
// in this file already uses.
const EMBER_JSON = {"name":"Explode Particle","id":"default system","capacity":10000,"disposeOnStop":false,"manualEmitCount":-1,"emitter":[0,0,0],"particleEmitterType":{"type":"SphereParticleEmitter","radius":1,"radiusRange":1,"directionRandomizer":0},"texture":{"tags":null,"url":"./images/particles/flare.webp","uOffset":0,"vOffset":0,"uScale":1,"vScale":1,"uAng":0,"vAng":0,"wAng":0,"uRotationCenter":0.5,"vRotationCenter":0.5,"wRotationCenter":0.5,"homogeneousRotationInUVTransform":false,"isBlocking":true,"name":"./images/particles/flare.webp","hasAlpha":false,"getAlphaFromRGB":false,"level":1,"coordinatesIndex":0,"coordinatesMode":0,"wrapU":1,"wrapV":1,"wrapR":1,"anisotropicFilteringLevel":4,"isCube":false,"is3D":false,"is2DArray":false,"gammaSpace":true,"invertZ":false,"lodLevelInAlpha":false,"lodGenerationOffset":0,"lodGenerationScale":0,"linearSpecularLOD":false,"isRenderTarget":false,"animations":[],"invertY":true,"samplingMode":3,"_useSRGBBuffer":false},"isLocal":false,"animations":[],"beginAnimationOnStart":false,"beginAnimationFrom":0,"beginAnimationTo":60,"beginAnimationLoop":false,"startDelay":0,"renderingGroupId":0,"isBillboardBased":true,"billboardMode":7,"minAngularSpeed":0,"maxAngularSpeed":0,"minSize":0.1,"maxSize":0.1,"minScaleX":1,"maxScaleX":1,"minScaleY":1,"maxScaleY":1,"minEmitPower":3,"maxEmitPower":3,"minLifeTime":2.9,"maxLifeTime":3,"emitRate":800,"gravity":[0,0,0],"noiseStrength":[10,10,10],"color1":[0.10588235294117647,0,0,1],"color2":[0.1803921568627451,0.01568627450980392,0,1],"colorDead":[0.1568627450980392,0,0,1],"updateSpeed":0.083,"targetStopDuration":0,"blendMode":0,"preWarmCycles":0,"preWarmStepOffset":1,"minInitialRotation":0,"maxInitialRotation":0,"startSpriteCellID":0,"spriteCellLoop":true,"endSpriteCellID":0,"spriteCellChangeSpeed":1,"spriteCellWidth":0,"spriteCellHeight":0,"spriteRandomStartCell":false,"isAnimationSheetEnabled":false,"sizeGradients":[{"gradient":0,"factor1":1.4,"factor2":2},{"gradient":1,"factor1":0.01,"factor2":0.25}],"textureMask":[1,1,1,1],"customShader":null,"preventAutoStart":false}

// Three layered systems - a quick bright sphere burst (createParticle,
// texture "explodeTex"), floating embers (ParticleSystem.Parse from
// EMBER_JSON, reconfigured), and billowing smoke (createCustomizedSmoke,
// already above) - all anchored at `position`. Each layer sets its own
// targetStopDuration (Babylon stops emission on its own after that many
// seconds), this function just needs to dispose them all once the longest-
// lived particles have finished playing out.
//
// powerScale is meant to come from the same source a skill scaled its
// damage by (e.g. skillEffects.js's mana-output powerScale) - a weak cast
// gets a visibly weaker explosion, not just a smaller damage number.
// fireScale/smokeScale are separate per-layer multipliers on TOP of that,
// for hand-tuning what a specific explosion "type" should look like later
// (color is the other lever for that - GLOW_COLORS, same palette every
// other particle/glow effect in this codebase already shares). Smoke stays
// its natural grey/brown regardless of color - real smoke doesn't turn blue
// just because the fire that made it did.
//
// Trailing options bag (kept separate from the positional args above so
// every existing call site stays valid untouched) is what lets this same
// function cover fire/water/earth/light instead of writing 4 near-identical
// copies of it - see EXPLOSION_STYLES in skillEffects.js:
//   - burstTexture: swaps the bright first-layer sprite (explodeTex for
//     fire, drunkBubble for a rising water spray, rockTex for falling
//     earth debris, flare2 for a clean light flash)
//   - gravitySign: +1 = embers/smoke rise (fire, water bubbles, light),
//     -1 = debris falls (earth)
//   - includeSmoke: false skips the smoke layer entirely - a light burst
//     doesn't leave smoke behind
export function createExplosionBurst(scene, position, powerScale = 1, fireScale = 1, smokeScale = 1, emberEmitRate = 30, color = "red", { burstTexture = "explodeTex", gravitySign = 1, includeSmoke = true } = {}){
    const palette = GLOW_COLORS[color] ?? GLOW_COLORS.red
    const fireSizeScale = fireScale * powerScale
    const smokeSizeScale = smokeScale * powerScale
    const scaledEmberRate = Math.max(1, Math.round(emberEmitRate * powerScale))

    const fireExp1 = createParticle(scene, burstTexture, 10, position, .05, { min: .3, max: .8 }, 8, 8.5, 0, "sphere", false, false, {r: palette.diffuse.r, g: palette.diffuse.g, b: palette.diffuse.b}, false)
    fireExp1.addSizeGradient(0, .8 * fireSizeScale, 0.9 * fireSizeScale)
    fireExp1.addSizeGradient(0.3, 1 * fireSizeScale, 11 * fireSizeScale)
    fireExp1.targetStopDuration = 1
    fireExp1.createPointEmitter(Vector3.Zero(), Vector3.Zero())
    fireExp1.isLocal = true
    fireExp1.direction1 = Vector3.Zero()
    fireExp1.direction2 = Vector3.Zero()

    const fColor = palette.emissive
    const rgb2 = palette.diffuse
    fireExp1.addColorGradient(0,  new Color4(fColor.r, fColor.g, fColor.b, .01), new Color4(rgb2.r, rgb2.g, rgb2.b, .07))
    fireExp1.addColorGradient(.4, new Color4(fColor.r, fColor.g, fColor.b, .8),  new Color4(rgb2.r, rgb2.g, rgb2.b, 1))
    fireExp1.addColorGradient(.7, new Color4(fColor.r, fColor.g, fColor.b, 1),   new Color4(rgb2.r, rgb2.g, rgb2.b, .9))
    fireExp1.addColorGradient(1,  new Color4(fColor.r, fColor.g, fColor.b, .1),  new Color4(rgb2.r, rgb2.g, rgb2.b, .1))
    fireExp1.start()

    const emberFire = ParticleSystem.Parse(EMBER_JSON, scene, "")
    emberFire.emitter = new Vector3(position.x, position.y, position.z)
    emberFire.emitRate = scaledEmberRate
    emberFire.gravity = new Vector3(0, 2 * gravitySign, 0)
    emberFire.updateSpeed = 0.03
    emberFire.targetStopDuration = 2
    const emb1 = palette.emissive
    const emb2 = palette.diffuse
    emberFire.addColorGradient(0,   new Color4(emb1.r, emb1.g, emb1.b, .01), new Color4(emb2.r, emb2.g, emb2.b, .07))
    emberFire.addColorGradient(.2,  new Color4(emb1.r, emb1.g, emb1.b, 1),   new Color4(emb2.r, emb2.g, emb2.b, 1))
    emberFire.addColorGradient(.95, new Color4(emb1.r, emb1.g, emb1.b, .01), new Color4(emb2.r, emb2.g, emb2.b, .07))
    emberFire.removeSizeGradient(0)
    emberFire.removeSizeGradient(1)
    emberFire.removeSizeGradient(2)
    emberFire.addSizeGradient(0, 0.05 * fireSizeScale, .1 * fireSizeScale)
    emberFire.addSizeGradient(0.2, .1 * fireSizeScale, .2 * fireSizeScale)
    emberFire.addSizeGradient(0.95, .01 * fireSizeScale, .02 * fireSizeScale)

    let spherSmoke = null
    if(includeSmoke){
        // qnty (7th arg) is this layer's own emitRate - halved from 5 to 3
        spherSmoke = createCustomizedSmoke(scene, new Vector3(position.x, position.y, position.z), "smoke", false, { min: 2, max: 3 }, { min: 1.5, max: 2 }, 3, false, {r: 0, g: 0, b: 0}, {r: 0.37, g: 0.2, b: 0.2}, false, false, 1, true)
        spherSmoke.targetStopDuration = 1
        spherSmoke.updateSpeed = 0.04
        spherSmoke.createPointEmitter(new Vector3(.5, .2, .5), new Vector3(-.5, -.2, .5))
        spherSmoke.addSizeGradient(0, 8 * smokeSizeScale, 10 * smokeSizeScale)
        spherSmoke.addSizeGradient(0.2, 10 * smokeSizeScale, 14 * smokeSizeScale)
        spherSmoke.addSizeGradient(0.95, 11 * smokeSizeScale, 12 * smokeSizeScale)
        spherSmoke.start()
    }

    const systems = [fireExp1, emberFire, spherSmoke].filter(Boolean)
    // longest-lived layer is emberFire: stops emitting at 2s, its own
    // particles (from EMBER_JSON) live up to 3s more - dispose everything
    // together once that's had time to fully play out. dispose(false) -
    // particleTexture is the shared/persistent cache above now (emberFire's
    // own texture comes from ParticleSystem.Parse(EMBER_JSON,...) instead,
    // a separate Texture object, but pointing at the same cached URL - not
    // disposing it either is harmless, nothing else needs that instance
    // freed specifically), disposing true here would evict it out from
    // under every other explosion currently using the same sprite.
    setTimeout(() => systems.forEach(ps => { ps.stop(); ps.dispose(false) }), 5200)
    return systems
}

// Dark-element explosion - genuinely different shape from createExplosionBurst
// above rather than just a recolor: dark wisps scatter outward for a beat,
// then get pulled back IN by a real Babylon Attractor (@babylonjs/core's
// Particles/attractor.js - .strength positive attracts, negative repels;
// this is the actual "implosion" physics, not faked with reversed gravity),
// and once they've mostly collapsed, a short bright "snap" flash plays -
// the visual beat of something folding in on itself and then popping shut.
export function createImplosionBurst(scene, position, powerScale = 1, color = "violet"){
    const palette = GLOW_COLORS[color] ?? GLOW_COLORS.violet
    const pos = new Vector3(position.x, position.y, position.z)

    const draw = new ParticleSystem(`implode_${randNum(1000, 99999)}`, 200, scene)
    draw.particleTexture = getParticleTexture(scene, "./images/particles/smoke2.webp")
    draw.blendMode = ParticleSystem.BLENDMODE_STANDARD
    draw.createSphereEmitter(2.2 * powerScale, 1)
    draw.emitter = pos.clone()
    draw.minEmitPower = 0.3
    draw.maxEmitPower = 0.8
    draw.minLifeTime = 0.55
    draw.maxLifeTime = 0.9
    draw.minSize = 0.3 * powerScale
    draw.maxSize = 0.7 * powerScale
    draw.emitRate = 70 // halved from 140
    draw.updateSpeed = 0.02
    draw.color1 = new Color4(palette.diffuse.r, palette.diffuse.g, palette.diffuse.b, 0.8)
    draw.color2 = new Color4(0.02, 0.0, 0.04, 0.6)
    draw.colorDead = new Color4(0, 0, 0, 0)

    // the pull - spawns scattered on the sphere shell above, this drags
    // them back toward `pos` over their lifetime instead of letting the
    // initial outward emitPower carry them away
    const attractor = new Attractor()
    attractor.position = pos.clone()
    attractor.strength = 6 * powerScale
    draw.addAttractor(attractor)

    draw.targetStopDuration = 0.5
    draw.start()

    // the "snap" - fires once the pull's mostly finished collapsing everything in
    let flash = null
    const flashTimeout = setTimeout(() => {
        flash = createParticle(scene, "flare", 40, position, .03, { min: .15, max: .3 }, 1.5 * powerScale, 2.5 * powerScale, 0, "sphere", false, false, {r: palette.emissive.r, g: palette.emissive.g, b: palette.emissive.b}, false)
        flash.createPointEmitter(Vector3.Zero(), Vector3.Zero())
        flash.isLocal = true
        flash.minEmitPower = 2
        flash.maxEmitPower = 4
        flash.emitRate = 200 // halved from 400
        flash.manualEmitCount = 60
        flash.targetStopDuration = 0.15
        flash.start()
    }, 480)

    setTimeout(() => {
        clearTimeout(flashTimeout)
        draw.stop()
        draw.dispose(false) // particleTexture is the shared/persistent cache above now
        if(flash){ flash.stop(); flash.dispose(false) }
    }, 1700)

    return [draw]
}

export function createBloodParticle(scene,  monsFos, particleType = "sphere", targStop, willDisposeOnStop, emitterMesh){
    const ps = new ParticleSystem("bloodParticle", 30)
    
    if(particleType === "sphere") ps.createSphereEmitter(2,1);
    ps.particleTexture = getParticleTexture(scene, "./images/particles/blood.jpg");
    if(monsFos) ps.emitter = new Vector3(monsFos.x,monsFos.y+Math.random()*.4,monsFos.z)
    // if(emitterMesh) ps.emitter = emitterMesh
    // if(willStart) ps.start()
    // if(willDisposeOnStop) ps.disposeOnStop = true;
    ps.targetStopDuration = targStop
    ps.updateSpeed = 0.05;
    ps.minSize = 0.09;
    ps.maxSize = 0.2;
    ps.gravity = new Vector3(0, -.5, 0);
    ps.minAngularSpeed = -Math.PI * 2;
    ps.maxAngularSpeed =  Math.PI * 2;
    ps.minInitialRotation = 0;
    ps.maxInitialRotation = Math.PI/4;
    setTimeout(() => ps.start(), 2000)
    return ps
}
export function createBloodSplatter(scene, pos,burst){
    const capacity = 15
    const ps = buildBloodSystem(scene,
        `blood_${Date.now()}`, capacity, pos ? pos : Vector3.Zero(),
        {
            emitRate: capacity,
            maxPower: burst ? 0.55 : 0.32,
            minLife:  0.5,
            maxLife:  burst ? 2.0 : 1.3,
            minSize: 0.25,
            maxSize: 1.50,
        }
    );

    if (burst) {
        ps.manualEmitCount = capacity;
        ps.direction1 = new Vector3(-1.8, 0.4, -1.8);
        ps.direction2 = new Vector3( 1.8, 1.8,  1.8);
    }

    // ps.start();
    // setTimeout(() => ps.start(), 1000)
    // const stopDelay = burst ? 60 : 600;
    // setTimeout(() => ps.stop(), stopDelay);
    // setTimeout(() => ps.dispose(), stopDelay + 3000);

    function play(stopDelay = 1000){
        ps.start()
        setTimeout(() => ps.stop(), stopDelay);
    }

    return { ps, play }
}
export function createCustomizedSmoke(scene, emitter, particleImgName, minMaxSize, minMaxLifeTime, minMaxEmitPower, qnty, gravityVector3, rgb1, rgb2, isDefaultSizeGrad, particleType, particleTypeRadius, activateRotations){
    const particleSystem = new ParticleSystem("particles", 8000, scene);
    //Texture of each particle
    particleSystem.particleTexture = getParticleTexture(scene, particleTexturePath(particleImgName));
    // lifetime
    if(minMaxLifeTime){
        const {min,max} = minMaxLifeTime
        particleSystem.minLifeTime = min
        particleSystem.maxLifeTime = max
    }
    if(minMaxEmitPower){
        const {min,max} = minMaxEmitPower
        particleSystem.minEmitPower = min
        particleSystem.maxEmitPower = max
    }
    if(minMaxSize){
        const {min,max} = minMaxSize
        particleSystem.minSize = min
        particleSystem.maxSize = max
    }
    // emit rate
    particleSystem.emitRate = qnty;

    // gravity
    if(gravityVector3) particleSystem.gravity = gravityVector3;    

    if(isDefaultSizeGrad){
        // size gradient
        particleSystem.addSizeGradient(0, 0.6, .7);
        particleSystem.addSizeGradient(0.3, 2, .9);
        particleSystem.addSizeGradient(0.5, 2, 1);
        particleSystem.addSizeGradient(.9, .8, 2);
    }
    // color gradient
    // yung unang param yan yung 0-1 kung meron kang apat na colorGrad hatiin mo sa apat yung 1 parang add size gradient lang yan sa babylon js playground
    const Col4 = Color4;
    const {r,g,b} = rgb1        
    particleSystem.addColorGradient(0, new Col4(r,g,b, .01), new Col4(rgb2.r,rgb2.g,rgb2.b, .07))
    particleSystem.addColorGradient(.4, new Col4(r,g,b, .1), new Col4(rgb2.r,rgb2.g,rgb2.b, .2))
    particleSystem.addColorGradient(.7, new Col4(r,g,b, 1), new Col4(rgb2.r,rgb2.g,rgb2.b,.9))
    particleSystem.addColorGradient(1, new Col4(r,g,b, .1), new Col4(rgb2.r,rgb2.g,rgb2.b,  .1))

    // speed gradient
    particleSystem.addVelocityGradient(0, 1, 1.5);
    particleSystem.addVelocityGradient(0.1, 0.8, 0.9);
    particleSystem.addVelocityGradient(0.7, 0.4, 0.5);
    particleSystem.addVelocityGradient(1, 0.1, 0.2);

    // rotation
    if(activateRotations){
        particleSystem.minInitialRotation = 0;
        particleSystem.maxInitialRotation = Math.PI;
        particleSystem.minAngularSpeed = -1;
        particleSystem.maxAngularSpeed = 1;
    }

    // blendmode
    particleSystem.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    
    // emitter shape
    let psRadius = particleTypeRadius ? particleTypeRadius : 0.1
    switch(particleType){
        case "cylinder":                
            particleSystem.createCylinderEmitter(psRadius, psRadius*3, 1, 1)
        break;
        case "mesh":
            const {x,y,z} = emitter.position
            particleSystem.createBoxEmitter(new Vector3(0,0,0), new Vector3(0,0,0), new Vector3(-1,0,-1), new Vector3(1,0,1))
        break;
        default:
            // sphere
            particleSystem.createSphereEmitter(psRadius)
        break
    }       

    // particleSystem.createCylinderEmitter(.1,.1,2)
    if(emitter) particleSystem.emitter = emitter
    particleSystem.stop()
    return particleSystem
}
function buildBloodSystem(scene, name, capacity, position, opts = {}){
    const ps = new ParticleSystem(name, capacity, scene);
    ps.particleTexture = getParticleTexture(scene, "./images/particles/blood.jpg");
    ps.emitter = position.clone();

    ps.createSphereEmitter(2, 1);

    ps.minLifeTime  = opts.minLife  ?? 0.6;
    ps.maxLifeTime  = opts.maxLife  ?? 1.4;

    ps.minEmitPower = 0.1;
    // ps.maxEmitPower = opts.maxPower ?? 0.01;
    ps.updateSpeed  = 0.02;

    ps.emitRate = opts.emitRate ?? 1000550;

    ps.minSize = opts.minSize ?? 1;
    ps.maxSize = opts.maxSize ?? 2;

    ps.addSizeGradient(1,   ps.maxSize);
    ps.addSizeGradient(0.5, ps.maxSize * 0.7);
    ps.addSizeGradient(0,   0);

    ps.gravity = new Vector3(0, -1, 0);

    const d = opts.dir ?? new Vector3(0, 1, 0);
    ps.direction1 = new Vector3(d.x - 1.2, d.y + 0.1, d.z - 1.2);
    ps.direction2 = new Vector3(d.x + 1.2, d.y + 0.8, d.z + 1.2);

    ps.addColorGradient(0,   new Color4(0.88, 0.05, 0.05, 1.0));
    ps.addColorGradient(0.3, new Color4(0.65, 0.02, 0.02, 0.85));
    ps.addColorGradient(0.7, new Color4(0.3,  0.01, 0.01, 0.5));
    ps.addColorGradient(1,   new Color4(0.08, 0.0,  0.0,  0.0));

    ps.blendMode = ParticleSystem.BLENDMODE_ADD

    // ps.minAngularSpeed = -Math.PI * 2;
    // ps.maxAngularSpeed =  Math.PI * 2;
    ps.minInitialRotation = 0;
    ps.maxInitialRotation = Math.PI/8;

    return ps;
}