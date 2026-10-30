import { ParticleSystem, MeshParticleEmitter, ConeParticleEmitter, TransformNode, Texture, Vector3, Color4, Color3, PointLight, Attractor } from "@babylonjs/core"
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
export function getParticleTexture(scene, path){
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
// (empty now - thin1.webp exists)
const PARTICLE_TEXTURE_STILL_PNG = new Set()
export function particleTexturePath(name){
    const ext = PARTICLE_TEXTURE_STILL_PNG.has(name) ? "png" : "webp"
    return `./images/particles/${name}.${ext}`
}

// intensity/range: the flickering light's level and reach - the defaults are
// the fireplace's own. A fire on much darker surfaces (the dungeon's torches)
// passes a stronger intensity; the flicker scales with it.
export function createFireParticles(position, scene, { intensity = 1.2, range = 5 } = {}) {
    const light = new PointLight("fire_light", new Vector3(position.x, position.y + 0.6, position.z), scene)
    light.diffuse  = new Color3(1.0, 0.4, 0.1)
    light.specular = new Color3(0, 0, 0)
    light.intensity = intensity
    light.range = range

    let tick = 0
    const flicker = intensity / 1.2
    scene.registerBeforeRender(() => {
        tick += 0.08
        light.intensity = intensity + (Math.sin(tick * 4.3) * 0.15 + Math.sin(tick * 7.1) * 0.08) * flicker
    })

    const particles = createFireFlame(position, scene)
    return { particles, light }
}

// Just the flame - createFireParticles' exact fire, with no PointLight of its
// own, for a fire whose light comes from somewhere else (or that shouldn't
// light anything). A fire that needs its own light can use createFireParticles
// freely, however many there are - tools/lightBudget.js keeps only the 5 point
// lights nearest the player switched on.
export function createFireFlame(position, scene) {
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

    return particles
}
// A whole body burning - an enemy set alight (a fire skill's burn, the
// Majestic Sword's, Azure Pyre's blue fire), a duel opponent caught in a
// fire trap, the player burning. Drawn the way the auras' flame is
// (effects/aura.js): upright tongues of flame licking up off the body's
// surface, each growing then thinning to a tip, a bright core going to a
// deep colour, added so it glows - over a deeper layer of the same fire drawn
// normally, which keeps it the fire's own colour in daylight instead of
// washing out pale. Sparks rising off it; smoke off an orange one.
//
// mesh: what's burning - followed, not emitted from: disposing a mesh
// disposes every particle system it's the emitter of, textures and all, and
// these textures are shared (getParticleTexture). So a burning enemy dying
// mid-burn can't take every other fire's texture with it - the flames just
// stay where it fell and burn out.
// bodyHeight/bodyRadius: its size - the body's origin is the middle of it
// (createEnemy.js's capsule), the flames start at its feet. color: "orange"
// or "blue" (Azure Pyre - blessingEffects.js).
//
// Returns { stop, dispose, pulse }: stop() ends the emitting, dispose() also
// frees it all once what's still burning has burnt out - so a burn ending
// fades rather than vanishing (callers call both, back to back). pulse() - a
// flare-up on each of the burn's damage ticks (skillEffects.js's
// startTargetBurn); only the blue fire has one, so callers call pulse?.()
// The blue fire is its own look - createAzureFire below.
const BODY_FIRE = {
    orange: {
        core: new Color3(1.0, 0.85, 0.45), mid: new Color3(1.0, 0.42, 0.06), deep: new Color3(0.6, 0.06, 0.0),
        body: new Color3(0.85, 0.22, 0.02), spark: new Color3(1.0, 0.7, 0.25), smoke: true,
    },
    blue: {
        core: new Color3(0.82, 0.95, 1.0), mid: new Color3(0.28, 0.66, 1.0), deep: new Color3(0.04, 0.16, 0.85),
        body: new Color3(0.06, 0.24, 0.9), spark: new Color3(0.6, 0.85, 1.0), smoke: false,
    },
}
// how long after dispose() before it's freed - the longest-lived spark's life
const BODY_FIRE_BURNOUT_MS = 1600
export function createBodyFireParticles(mesh, scene, bodyHeight = 1.6, bodyRadius = 0.6, color = "orange") {
    if(color === "blue") return createAzureFire(mesh, scene, bodyHeight, bodyRadius)
    const palette = BODY_FIRE[color] ?? BODY_FIRE.orange
    const h = bodyHeight || 1.6
    const r = (bodyRadius || 0.6) * 0.5
    // a flame's size goes with the body's - a slime's smaller than a person's.
    // flame2's flame is small in its square: sprites this big are what it
    // takes for the tongues to overlap into one fire, not scattered drops
    const s = Math.min(0.6, Math.max(0.25, h * 0.32))
    const c4 = (c, a) => new Color4(c.r, c.g, c.b, a)
    const rnd = (a, b) => a + Math.random() * (b - a)

    // where the body is, every frame (see the header)
    const at = mesh.getAbsolutePosition().clone()
    const follow = scene.onBeforeRenderObservable.add(() => {
        if(!mesh.isDisposed()) at.copyFrom(mesh.getAbsolutePosition())
    })
    // a spot on the body's surface, feet to near the top
    // (from inside it out - flames born at the surface alone stand apart)
    const onBody = (pos, out = 1) => {
        const a = Math.random() * Math.PI * 2
        const rr = r * rnd(0.35, 1.05) * out
        pos.set(at.x + Math.cos(a) * rr, at.y - h / 2 + Math.random() * h * 0.8, at.z + Math.sin(a) * rr)
    }
    const upward = (dir, spread) => dir.set(rnd(-spread, spread), rnd(0.85, 1.2), rnd(-spread, spread))

    // real units (updateSpeed 1/60): lifetimes in seconds, speeds per second,
    // sizes in metres - a size gradient's values ARE the sizes
    const system = (name, capacity, texture, blendMode) => {
        const ps = new ParticleSystem(name, capacity, scene)
        ps.particleTexture = getParticleTexture(scene, particleTexturePath(texture))
        ps.emitter = at
        ps.isLocal = false
        ps.blendMode = blendMode
        ps.updateSpeed = 1 / 60
        return ps
    }
    // a layer of flame tongues - the glowing edge, or the deep body under it
    const flames = (name, deep) => {
        const ps = system(name, deep ? 160 : 260, "flame2", deep ? ParticleSystem.BLENDMODE_STANDARD : ParticleSystem.BLENDMODE_ADD)
        ps.startPositionFunction = (m, pos) => onBody(pos, deep ? 0.8 : 1)
        ps.startDirectionFunction = (m, dir) => upward(dir, 0.25)
        ps.billboardMode = ParticleSystem.BILLBOARDMODE_Y
        const size = s * (deep ? 0.85 : 1)
        ps.addSizeGradient(0, size * 0.5, size * 0.9)
        ps.addSizeGradient(0.25, size, size * 1.7)
        ps.addSizeGradient(1, size * 0.2, size * 0.4)
        ps.minScaleX = 0.7
        ps.maxScaleX = 1
        ps.minScaleY = 1.3
        ps.maxScaleY = 1.9
        ps.minLifeTime = 0.35
        ps.maxLifeTime = 0.6
        ps.minEmitPower = 0.4 * h
        ps.maxEmitPower = 0.8 * h
        ps.gravity = new Vector3(0, 0.7 * h, 0)
        ps.minInitialRotation = -0.15
        ps.maxInitialRotation = 0.15
        if(deep){
            ps.addColorGradient(0, c4(palette.body, 0))
            ps.addColorGradient(0.15, c4(palette.body, 0.5))
            ps.addColorGradient(0.6, c4(palette.deep, 0.32))
            ps.addColorGradient(1, c4(palette.deep, 0))
        } else {
            ps.addColorGradient(0, c4(palette.core, 0))
            ps.addColorGradient(0.12, c4(palette.core, 0.95))
            ps.addColorGradient(0.45, c4(palette.mid, 0.7))
            ps.addColorGradient(1, c4(palette.deep, 0))
        }
        ps.emitRate = (deep ? 55 : 110) * h
        return ps
    }

    const systems = []
    if(palette.smoke){
        const smoke = system("body_fire_smoke", 60, "smoke2", ParticleSystem.BLENDMODE_STANDARD)
        smoke.startPositionFunction = (m, pos) => { onBody(pos, 0.6); pos.y += h * 0.3 }
        smoke.startDirectionFunction = (m, dir) => upward(dir, 0.2)
        smoke.minEmitPower = 0.3
        smoke.maxEmitPower = 0.6
        smoke.gravity = new Vector3(0, 0.6, 0)
        smoke.minLifeTime = 0.8
        smoke.maxLifeTime = 1.4
        smoke.addSizeGradient(0, s * 1.5, s * 2.5)
        smoke.addSizeGradient(1, s * 4, s * 6)
        smoke.minInitialRotation = 0
        smoke.maxInitialRotation = Math.PI * 2
        smoke.addColorGradient(0, new Color4(0.08, 0.06, 0.05, 0))
        smoke.addColorGradient(0.2, new Color4(0.08, 0.06, 0.05, 0.22))
        smoke.addColorGradient(1, new Color4(0.08, 0.06, 0.05, 0))
        smoke.emitRate = 14 * h
        systems.push(smoke)
    }
    systems.push(flames("body_fire_deep", true), flames("body_fire", false))
    const sparks = system("body_fire_sparks", 60, "thin1", ParticleSystem.BLENDMODE_ADD)
    sparks.startPositionFunction = (m, pos) => onBody(pos, 1.1)
    sparks.startDirectionFunction = (m, dir) => upward(dir, 0.5)
    sparks.minEmitPower = 0.8
    sparks.maxEmitPower = 1.8
    sparks.gravity = new Vector3(0, 0.5, 0)
    sparks.minLifeTime = 0.6
    sparks.maxLifeTime = 1.2
    // thin1 is a sliver in a big square - this much of it reads as a spark
    sparks.addSizeGradient(0, 0.2, 0.35)
    sparks.addSizeGradient(1, 0, 0.04)
    sparks.minInitialRotation = 0
    sparks.maxInitialRotation = Math.PI
    sparks.minAngularSpeed = -3
    sparks.maxAngularSpeed = 3
    sparks.color1 = c4(palette.core, 1)
    sparks.color2 = c4(palette.spark, 1)
    sparks.colorDead = c4(palette.deep, 0)
    sparks.emitRate = 12 * h
    systems.push(sparks)
    systems.forEach(ps => ps.start())

    let stopped = false
    let disposed = false
    const stop = () => {
        if(stopped) return
        stopped = true
        systems.forEach(ps => ps.stop())
    }
    // not the textures - they're the shared cache's (getParticleTexture)
    const dispose = () => {
        stop()
        if(disposed) return
        disposed = true
        setTimeout(() => {
            scene.onBeforeRenderObservable.remove(follow)
            if(!scene.isDisposed) systems.forEach(ps => ps.dispose(false))
        }, BODY_FIRE_BURNOUT_MS)
    }
    return { stop, dispose }
}
// AZURE PYRE's blue fire - spirit fire rather than a campfire: few flames, but
// big, long and slow, white-hot at the root going through azure to a violet
// fringe, so it reads as one cold blaze from a distance rather than a swarm
// of drops. What makes it worth watching is the rhythm, not the count:
//   - catching: a flash and a ring of flames bursting off the body, once
//   - burning:  30 flames a second (plus a few deep ones under them that keep
//               it blue in daylight - added light alone washes out pale)
//   - each damage tick: pulse() - a flare-up, so the fire visibly bites
//   - embers drifting up off it
// Bursts are manualEmitCount on systems that otherwise emit nothing - no new
// systems per pulse, ~50 particles a second in all.
const AZURE = {
    core:   new Color4(0.9, 0.98, 1.0, 1),
    cyan:   new Color4(0.35, 0.85, 1.0, 1),
    azure:  new Color4(0.1, 0.45, 1.0, 1),
    violet: new Color4(0.38, 0.12, 0.95, 1),
    deep:   new Color4(0.03, 0.12, 0.7, 1),
}
const AZURE_FLAME_RATE = 30
function createAzureFire(mesh, scene, bodyHeight, bodyRadius){
    const h = bodyHeight || 1.6
    const r = (bodyRadius || 0.6) * 0.5
    // flame2's flame fills only the lower middle of its square - the sprite
    // has to be about twice the flame it shows
    const s = Math.min(1.3, Math.max(0.55, h * 0.75))
    const rnd = (a, b) => a + Math.random() * (b - a)
    const a4 = (c, a) => new Color4(c.r, c.g, c.b, a)

    // followed, not emitted from - see createBodyFireParticles' header
    const at = mesh.getAbsolutePosition().clone()
    const follow = scene.onBeforeRenderObservable.add(() => {
        if(!mesh.isDisposed()) at.copyFrom(mesh.getAbsolutePosition())
    })
    const feet = () => at.y - h / 2
    // a spot on the body's surface - on the side the camera sees: a flame
    // behind the body is hidden by it, so every one of the few goes where
    // it shows. (out > 1 stands it off the surface, upTo is how far up.)
    const onBody = (pos, out = 1, upTo = 0.6) => {
        const cam = scene.activeCamera?.globalPosition
        const toCam = cam ? Math.atan2(cam.z - at.z, cam.x - at.x) : Math.random() * Math.PI * 2
        const a = toCam + rnd(-1.75, 1.75)
        const rr = r * rnd(0.85, 1.15) * out
        pos.set(at.x + Math.cos(a) * rr, feet() + Math.random() * h * upTo, at.z + Math.sin(a) * rr)
    }
    const system = (name, capacity, texture, blendMode) => {
        const ps = new ParticleSystem(name, capacity, scene)
        ps.particleTexture = getParticleTexture(scene, particleTexturePath(texture))
        ps.emitter = at
        ps.isLocal = false
        ps.blendMode = blendMode
        ps.updateSpeed = 1 / 60
        return ps
    }
    // upright, a little taller than wide, barely leaning
    const tongue = ps => {
        ps.billboardMode = ParticleSystem.BILLBOARDMODE_Y
        ps.minScaleX = 0.75
        ps.maxScaleX = 1.05
        ps.minScaleY = 1.2
        ps.maxScaleY = 1.7
        ps.minInitialRotation = -0.12
        ps.maxInitialRotation = 0.12
        ps.gravity = new Vector3(0, 0.9 * h, 0)
    }

    // the blaze
    const flames = system("azure_fire", 60, "flame2", ParticleSystem.BLENDMODE_ADD)
    tongue(flames)
    flames.startPositionFunction = (m, pos) => onBody(pos, 1, 0.75)
    flames.startDirectionFunction = (m, dir) => dir.set(rnd(-0.12, 0.12), 1, rnd(-0.12, 0.12))
    flames.minEmitPower = 0.25 * h
    flames.maxEmitPower = 0.55 * h
    flames.minLifeTime = 0.7
    flames.maxLifeTime = 1.05
    flames.addSizeGradient(0, s * 0.45, s * 0.6)
    flames.addSizeGradient(0.3, s * 0.95, s * 1.15)
    flames.addSizeGradient(1, s * 0.3, s * 0.45)
    flames.addColorGradient(0, a4(AZURE.core, 0))
    flames.addColorGradient(0.08, a4(AZURE.core, 0.9))
    flames.addColorGradient(0.3, a4(AZURE.cyan, 0.75))
    flames.addColorGradient(0.65, a4(AZURE.azure, 0.45))
    flames.addColorGradient(1, a4(AZURE.violet, 0))
    flames.emitRate = AZURE_FLAME_RATE

    // under it, drawn normally - the blue that daylight can't wash out
    const deep = system("azure_fire_deep", 20, "flame2", ParticleSystem.BLENDMODE_STANDARD)
    tongue(deep)
    deep.startPositionFunction = (m, pos) => onBody(pos, 0.9, 0.55)
    deep.startDirectionFunction = (m, dir) => dir.set(0, 1, 0)
    deep.minEmitPower = 0.2 * h
    deep.maxEmitPower = 0.4 * h
    deep.minLifeTime = 0.6
    deep.maxLifeTime = 0.9
    deep.addSizeGradient(0, s * 0.6, s * 0.75)
    deep.addSizeGradient(0.4, s * 1.05, s * 1.25)
    deep.addSizeGradient(1, s * 0.5, s * 0.6)
    deep.addColorGradient(0, a4(AZURE.azure, 0))
    deep.addColorGradient(0.2, a4(AZURE.azure, 0.42))
    deep.addColorGradient(0.7, a4(AZURE.deep, 0.25))
    deep.addColorGradient(1, a4(AZURE.deep, 0))
    deep.emitRate = 10

    // embers - wandering up and fading through violet
    const embers = system("azure_fire_embers", 24, "flare", ParticleSystem.BLENDMODE_ADD)
    embers.startPositionFunction = (m, pos) => onBody(pos, 1.2, 0.9)
    embers.startDirectionFunction = (m, dir) => dir.set(rnd(-0.45, 0.45), 1, rnd(-0.45, 0.45))
    embers.minEmitPower = 0.5 * h
    embers.maxEmitPower = 1.1 * h
    embers.gravity = new Vector3(0, 0.3, 0)
    embers.minLifeTime = 0.8
    embers.maxLifeTime = 1.4
    embers.addSizeGradient(0, 0.05, 0.09)
    embers.addSizeGradient(1, 0.01, 0.02)
    embers.addColorGradient(0, a4(AZURE.core, 1))
    embers.addColorGradient(0.4, a4(AZURE.cyan, 0.9))
    embers.addColorGradient(1, a4(AZURE.violet, 0))
    embers.emitRate = 7

    // the bursts: flames thrown out sideways and up, and a flash at the core.
    // They emit nothing until flare() hands them a count.
    const burst = system("azure_fire_burst", 40, "flame2", ParticleSystem.BLENDMODE_ADD)
    tongue(burst)
    burst.startPositionFunction = (m, pos) => onBody(pos, 1, 0.6)
    burst.startDirectionFunction = (m, dir) => {
        const a = Math.random() * Math.PI * 2
        dir.set(Math.cos(a) * 0.55, rnd(0.8, 1.3), Math.sin(a) * 0.55)
    }
    burst.minEmitPower = 1.2 * h
    burst.maxEmitPower = 2 * h
    burst.gravity = new Vector3(0, 0.6 * h, 0)
    burst.minLifeTime = 0.35
    burst.maxLifeTime = 0.6
    burst.addSizeGradient(0, s * 0.5, s * 0.7)
    burst.addSizeGradient(0.35, s * 0.8, s * 1)
    burst.addSizeGradient(1, s * 0.15, s * 0.25)
    burst.addColorGradient(0, a4(AZURE.core, 1))
    burst.addColorGradient(0.35, a4(AZURE.cyan, 0.8))
    burst.addColorGradient(1, a4(AZURE.violet, 0))
    burst.emitRate = 0

    const flash = system("azure_fire_flash", 2, "flare", ParticleSystem.BLENDMODE_ADD)
    flash.startPositionFunction = (m, pos) => { onBody(pos, 1.3, 0); pos.y = feet() + h * 0.45 }
    flash.minEmitPower = 0
    flash.maxEmitPower = 0
    flash.minLifeTime = 0.22
    flash.maxLifeTime = 0.22
    flash.addSizeGradient(0, h * 0.8)
    flash.addSizeGradient(1, h * 2.2)
    flash.addColorGradient(0, a4(AZURE.cyan, 0.85))
    flash.addColorGradient(1, a4(AZURE.azure, 0))
    flash.emitRate = 0

    const systems = [deep, flames, embers, burst, flash]
    systems.forEach(ps => ps.start())

    let stopped = false
    let disposed = false
    const flare = (count, bright) => {
        if(stopped) return
        burst.manualEmitCount = count
        if(bright) flash.manualEmitCount = 1
    }
    // catching fire
    flare(18, true)

    const stop = () => {
        if(stopped) return
        stopped = true
        systems.forEach(ps => ps.stop())
    }
    // not the textures - they're the shared cache's (getParticleTexture)
    const dispose = () => {
        stop()
        if(disposed) return
        disposed = true
        setTimeout(() => {
            scene.onBeforeRenderObservable.remove(follow)
            if(!scene.isDisposed) systems.forEach(ps => ps.dispose(false))
        }, BODY_FIRE_BURNOUT_MS)
    }
    return { stop, dispose, pulse: () => flare(8, false) }
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

// "Shooting star" comet tail - a tight cone of particles streaming BEHIND a
// moving mesh, diamond-shaped size gradient (near-zero at both ends, a hard
// peak mid-length) so it reads as one continuous bright core rather than a
// puffy cloud. Generic/reusable (skillEffects.js's pyroclasmSkill is the
// first caller, via projectileVisual.trail - see renderGenericProjectile),
// every option below has the same default that skill was designed around,
// so a future skill can override just the one or two values it cares about
// (color/texture/size) without having to restate the whole shape.
//
// emitterMesh should be the projectile's own invisible root box (already
// rotated to face its direction of travel every cast - see
// fireElementalProjectile's box.rotation.x/y). ConeParticleEmitter always
// emits along its OWN local Y axis, no matter what particleSystem.direction1/
// direction2 are set to (those are only read by the plain/box emitter's
// default startDirectionFunction - the shape emitters, cone included,
// compute direction from their own axis internally and ignore them
// entirely) - setting direction1/2 here used to do nothing, and the cone's
// real Y-axis emission lined up with world-up instead of "backward", which
// is why it shot a column straight into the sky instead of trailing behind
// the projectile. Fixed by an intermediate TransformNode, parented to
// emitterMesh and rotated +90deg on X - that maps its own local Y (the
// cone's fixed emission axis) onto emitterMesh's local Z, i.e. its forward/
// backward travel axis - and using THAT node as the actual particle emitter
// instead of emitterMesh directly.
export function createCometTrailParticles(scene, emitterMesh, options = {}){
    const {
        texture = "flare2",
        capacity = 500,
        coneRadius = 0.1,
        coneAngle = Math.PI,     // tight, stays thin - not a wide spray
        minEmitPower = 10,
        maxEmitPower = 12,
        updateSpeed = 0.01,
        minLifeTime = 0.2,
        maxLifeTime = 0.45,
        // way down from an initial 900 - that emitRate combined with up to
        // 0.75s lifetime kept 600+ particles alive/overlapping at once,
        // reading as one solid beam instead of a comet tail
        emitRate = 100,
        // [gradientPos, r, g, b, a] - default white-hot core fading through
        // orange to a transparent red tail tip
        colorStops = [
            [0,   1, 1,    1,   1],
            [0.4, 1, 0.85, 0.4, 1],
            [1,   1, 0.4,  0.1, 0],
        ],
        // [gradientPos, size] - sharp diamond: near-zero at both ends, hard
        // peak mid-length
        sizeStops = [
            [0,   0.05],
            [0.5, 0.9],
            [1,   0.1],
        ],
        // isLocal:true (below) means this is read in the EMITTER'S own local
        // space, not world space - see the header comment on why. Straight
        // up (+Y) relative to the emitter's own rotated frame is what
        // pyroclasmSkill wants here (skillsData.js's projectileVisual.trail
        // has no override, so this default is what actually applies to it).
        gravity = new Vector3(0, 0.5, 0),
    } = options

    const emitterNode = new TransformNode(`comet_trail_node_${Date.now()}`, scene)
    emitterNode.parent = emitterMesh


    const trail = new ParticleSystem(`comet_trail_${Date.now()}`, capacity, scene)
    trail.particleTexture = getParticleTexture(scene, particleTexturePath(texture))
    trail.emitter = emitterNode
    trail.isLocal = true
    trail.blendMode = ParticleSystem.BLENDMODE_ADD

    trail.particleEmitterType = new ConeParticleEmitter(coneRadius, coneAngle)

    trail.minEmitPower = minEmitPower
    trail.maxEmitPower = maxEmitPower
    trail.updateSpeed = updateSpeed

    trail.minLifeTime = minLifeTime
    trail.maxLifeTime = maxLifeTime
    trail.emitRate = emitRate

    colorStops.forEach(([g, r, gg, b, a]) => trail.addColorGradient(g, new Color4(r, gg, b, a)))
    sizeStops.forEach(([g, s]) => trail.addSizeGradient(g, s))

    trail.gravity = gravity
    // emitterNode isn't tracked/disposed anywhere else - tying its lifetime
    // to the particle system's own dispose means every existing caller
    // (skillEffects.js's trailParticles.dispose(false)) already cleans it
    // up for free, no extra disposal call needed on their end
    trail.onDisposeObservable.add(() => emitterNode.dispose())
    trail.start()
    emitterNode.addRotation(-Math.PI/4,0,0)
    return trail
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
// color ({r,g,b}, optional) - defaults to buildBloodSystem's own red, so
// every EXISTING caller (createcharacter.js's player bloodps) is unaffected.
// createEnemy.js's own per-modelStyle blood is the one caller that passes
// something else.
export function createBloodSplatter(scene, pos, burst, color){
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
            color,
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

    // bleeding (characterstate.js's refreshBleeding, worldsocket.js's
    // "emitted-bleeding") - keeps the splatter running non-stop until it's
    // turned off again. A hit's play() while bleeding leaves it running
    // instead of cutting it off after its stopDelay.
    let bleeding = false
    function play(stopDelay = 1000){
        ps.start()
        setTimeout(() => { if(!bleeding) ps.stop() }, stopDelay);
    }
    function setBleeding(on){
        bleeding = on
        if(on) ps.start()
        else ps.stop()
    }

    return { ps, play, setBleeding }
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

    // opts.color (default: the original red) - the peak/brightest tint,
    // darkened toward black at the same 3 falloff stops this system always
    // had, alpha fade unchanged. Lets a caller reuse this whole "burst of
    // spatter that fades out" system for a non-red fluid (createEnemy.js's
    // own per-modelStyle blood color) without duplicating the rest of it.
    const { r, g, b } = opts.color ?? { r: 0.88, g: 0.05, b: 0.05 }
    ps.addColorGradient(0,   new Color4(r,        g,        b,        1.0));
    ps.addColorGradient(0.3, new Color4(r * 0.7,  g * 0.7,  b * 0.7,  0.85));
    ps.addColorGradient(0.7, new Color4(r * 0.34, g * 0.34, b * 0.34, 0.5));
    ps.addColorGradient(1,   new Color4(r * 0.09, g * 0.09, b * 0.09, 0.0));

    ps.blendMode = ParticleSystem.BLENDMODE_ADD

    // ps.minAngularSpeed = -Math.PI * 2;
    // ps.maxAngularSpeed =  Math.PI * 2;
    ps.minInitialRotation = 0;
    ps.maxInitialRotation = Math.PI/8;

    return ps;
}
// ============================================================
// REFERENCE EXAMPLE - a plain Babylon ParticleSystem, start to finish.
// ============================================================
// Written to be read rather than reused: every property that matters is set
// explicitly and in the order you'd normally think about them, so this doubles
// as a walkthrough of the API. Called from areascene.js's "village" branch,
// gated to placeId 1, and returns the system so the caller can stop/dispose it.
//
// This is the CPU-side particle API - the opposite approach from
// effects/weather.js, which hand-writes a shader because rain needs thousands
// of particles. For anything in the low hundreds, this is the right tool: far
// less code, and Babylon handles billboarding, fading and sorting for you.
export function createDemoParticles(scene, position = { x: 0, y: 0.5, z: 0 }) {

    // 1. CAPACITY - the max particles alive at once. Allocated up front as one
    //    fixed buffer, so this is the real memory/CPU cost knob. It is a
    //    CEILING, not a rate: emitRate and lifetime below decide how many
    //    actually exist at any moment.
    const particles = new ParticleSystem("demoParticles", 300, scene)

    // 2. TEXTURE - the sprite each particle draws. Routed through
    //    getParticleTexture (this file's own cache) rather than `new Texture`,
    //    so repeated calls share one GPU upload. A wrong path here renders
    //    NOTHING and logs nothing, so it's worth double-checking against
    //    public/images/particles/.
    particles.particleTexture = getParticleTexture(scene, particleTexturePath("flare"))

    // 3. BLEND MODE - ADD makes overlapping particles brighten and reads as
    //    light/energy (what a fire or a spell wants). BLENDMODE_STANDARD is
    //    normal alpha blending, for smoke, dust or anything solid.
    particles.blendMode = ParticleSystem.BLENDMODE_ADD

    // 4. WHERE THEY SPAWN. emitter can be a Vector3 (a fixed point in the
    //    world, as here) OR a mesh - pass a mesh and the emitter follows it
    //    every frame for free, which is how createBodyFireParticles tracks a
    //    moving enemy.
    //    min/maxEmitBox is a box AROUND the emitter that spawn points are
    //    picked from at random. Leave both at zero and every particle is born
    //    at exactly the same point, which looks like a jet rather than a
    //    volume.
    particles.emitter = new Vector3(position.x, position.y, position.z)
    particles.minEmitBox = new Vector3(-0.2, 0, -0.2)
    particles.maxEmitBox = new Vector3(0.2, 0, 0.2)

    // 5. COLOUR OVER LIFE. Each particle picks a random mix of color1 and
    //    color2 at birth, then fades toward colorDead as it ages. The 4th
    //    component is alpha - colorDead usually ends at 0 so particles fade
    //    out instead of popping.
    particles.color1 = new Color4(0.4, 0.8, 1.0, 1.0)
    particles.color2 = new Color4(0.2, 0.4, 1.0, 1.0)
    particles.colorDead = new Color4(0.0, 0.0, 0.2, 0.0)

    // 6. SIZE - a random value per particle between the two. A spread rather
    //    than one value is most of what stops a system looking mechanical.
    particles.minSize = 0.1
    particles.maxSize = 0.4

    // 7. LIFETIME in seconds. Together with emitRate this decides how many are
    //    alive at once: roughly emitRate * average lifetime. Here 80 * ~1.2 is
    //    about 96 live particles, comfortably under the 300 capacity. Push
    //    that product past capacity and emission silently starts throttling.
    particles.minLifeTime = 0.8
    particles.maxLifeTime = 1.6

    // 8. EMIT RATE - new particles per second.
    particles.emitRate = 80

    // 9. DIRECTION - each particle picks a random vector between these two.
    //    Both mostly +Y here, so everything drifts upward with some sideways
    //    spread. Widen the x/z values for a fountain, narrow them for a beam.
    particles.direction1 = new Vector3(-0.4, 1.5, -0.4)
    particles.direction2 = new Vector3(0.4, 2.5, 0.4)

    // 10. EMIT POWER scales that direction vector - the launch speed.
    particles.minEmitPower = 0.5
    particles.maxEmitPower = 1.2

    // 11. GRAVITY, in world units/sec^2. Applied continuously, so particles
    //     launched upward arc and fall back. Leave it zero and they travel in
    //     straight lines forever.
    particles.gravity = new Vector3(0, -1.2, 0)

    // 12. SPIN - radians/sec, randomised per particle. Negative-to-positive
    //     means some spin each way, which stops the sprite repetition from
    //     being obvious.
    particles.minAngularSpeed = -Math.PI / 4
    particles.maxAngularSpeed = Math.PI / 4

    // 13. UPDATE SPEED - the simulation step. Higher is faster but coarser;
    //     0.01 is Babylon's default and 0.02 is what createFireParticles above
    //     uses. This is NOT the same as emitRate - it scales the whole
    //     simulation, including how fast particles age.
    particles.updateSpeed = 0.01

    // 14. START. Nothing renders until this is called - a fully configured
    //     system that was never started is the single most common reason a
    //     particle system appears to do nothing.
    particles.start()

    // Returned so the caller owns the lifetime. scene.dispose() on a place
    // change takes this with it anyway, but an explicit
    // particles.stop() / particles.dispose(false) is how you'd kill it early.
    // dispose(false) - NOT dispose() - because the texture came from the
    // shared cache above and is not this system's to destroy.
    return particles
}
