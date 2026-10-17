import { Color3, Color4, Constants, DynamicTexture, MeshBuilder, NoiseProceduralTexture, ParticleSystem, Quaternion, StandardMaterial, Vector3 } from "@babylonjs/core"
import { getParticleTexture, particleTexturePath } from "../tools/particlesystem.js"
import { attachLightning } from "./lightning.js"
import { auraProfileChanged, auraProfileFromDet } from "./auraProfile.js"

// THE FLEX AURA (skill "flexaura") - what a character's aura looks like, grown
// from effects/auraProfile.js's profile:
//
//   power 0     - glitter: small glints popping on and off the body
//   power 0.12+ - a faint blue haze rising off it
//   power 0.3+  - blue flame licking up the whole body (glowing, with a deep
//                 blue body under it so it stays blue in daylight)
//   power 0.5+  - streaks of light shooting up, embers trailing behind
//   power 0.8+  - a second, taller ring of flame from the ground, lightning
//                 crackling over the body, and a pressure wave every few
//                 seconds - the "overwhelming aura" of a demon lord
//
// darkness (a darkness aptitude) mixes black in at every stage: dark motes
// even on a weak aura, then black flame inside the blue, then black tendrils
// lashing up and out from the chest (the spiky dark aura from Noblesse), all
// with a violet shimmer over them. The more darkness, the more of it.
//
// Nothing is built until the aura is first shown, so the many characters that
// never flare it cost nothing. A change in profile (stats grew) rebuilds it:
// the old particles burn out while the new ones start, so it never blinks.

const BLUE = {
    core: new Color3(0.82, 0.95, 1.0),
    mid:  new Color3(0.28, 0.66, 1.0),
    deep: new Color3(0.06, 0.24, 0.9),
}
const DARK = {
    core: new Color3(0.0, 0.0, 0.0),
    body: new Color3(0.05, 0.0, 0.08),
    rim:  new Color3(0.5, 0.12, 0.75),
}
// power each stage starts at (see the header)
const TIER = { haze: 0.12, flames: 0.3, tendrils: 0.45, streaks: 0.5, overflow: 0.8 }
// the ground ring and lightning take the violet once darkness is past this
const DARK_TINT_FROM = 0.5
// the overflow tier's pressure waves - seconds between them, give or take
const PULSE_EVERY = 2.6
// flames rise and fall a little, like breathing (cycles per second, +/- share)
const BREATH_RATE = 0.75
const BREATH_DEPTH = 0.22

const lerp = (a, b, t) => a + (b - a) * t
const ramp = (x, from, to) => Math.min(1, Math.max(0, (x - from) / (to - from)))
const c4 = (color, alpha) => new Color4(color.r, color.g, color.b, alpha)

// ── textures ─────────────────────────────────────────────────────────────────
// The dark tendril and the ring are drawn here rather than shipped as images:
// nothing in images/particles is either shape. One set per scene.
const texturesByScene = new WeakMap()

// mipmapped - these are small on screen, and without them their thin
// points break up into a dot
function drawTexture(scene, name, width, height, draw){
    const tex = new DynamicTexture(name, { width, height }, scene, true)
    const ctx = tex.getContext()
    ctx.clearRect(0, 0, width, height)
    draw(ctx, width, height)
    tex.hasAlpha = true
    tex.update()
    return tex
}

// a long jagged spike, point at the top - barbs down both edges so it reads
// as a tendril rather than a needle. Drawn in its own colors (the tendril
// layer tints it white, i.e. not at all): pitch black, with a violet glow
// around the edge so it still reads against a night sky
function drawSpike(ctx, width, height){
    const mid = width / 2
    const barbs = [0.12, -0.18, 0.22, -0.1, 0.16, -0.14]
    ctx.shadowColor = "rgba(175,70,255,1)"
    ctx.shadowBlur = width * 0.18
    ctx.fillStyle = "rgba(0,0,0,1)"
    ctx.beginPath()
    ctx.moveTo(mid, height * 0.03)
    barbs.forEach((barb, i) => {
        const t = (i + 1) / barbs.length
        ctx.lineTo(mid + width * 0.26 * t * (1 + barb), height * (0.05 + 0.9 * t))
    })
    ctx.lineTo(mid, height * 0.97)
    barbs.slice().reverse().forEach((barb, i) => {
        const t = 1 - i / barbs.length
        ctx.lineTo(mid - width * 0.26 * t * (1 - barb), height * (0.05 + 0.9 * t) - height * 0.05)
    })
    ctx.closePath()
    // twice - the second pass thickens the glow
    ctx.fill()
    ctx.fill()
}

// a soft ring, for the ground pulse
function drawRing(ctx, size){
    const c = size / 2
    const ring = ctx.createRadialGradient(c, c, 0, c, c, c)
    ring.addColorStop(0, "rgba(255,255,255,0)")
    ring.addColorStop(0.6, "rgba(255,255,255,0)")
    ring.addColorStop(0.82, "rgba(255,255,255,1)")
    ring.addColorStop(0.9, "rgba(255,255,255,0.35)")
    ring.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = ring
    ctx.fillRect(0, 0, size, size)
}

function auraTextures(scene){
    let tex = texturesByScene.get(scene)
    if(tex) return tex
    const noise = new NoiseProceduralTexture("auraNoise", 256, scene)
    noise.animationSpeedFactor = 5
    noise.persistence = 2
    noise.brightness = 0.5
    noise.octaves = 2
    tex = {
        spike: drawTexture(scene, "auraSpike", 64, 256, drawSpike),
        ring: drawTexture(scene, "auraRing", 256, 256, (ctx, w) => drawRing(ctx, w)),
        flame: getParticleTexture(scene, particleTexturePath("flame2")),
        smoke: getParticleTexture(scene, particleTexturePath("smoke2")),
        // thin1: the long streaks, and the small glints - glitter, embers, the ignition burst
        streak: getParticleTexture(scene, particleTexturePath("thin1")),
        noise,
    }
    texturesByScene.set(scene, tex)
    return tex
}

// ── layers ───────────────────────────────────────────────────────────────────
// Each takes the build context (k) and returns its particle system, not yet
// started. All of them ride the body (isLocal) except the embers, which trail.

function particles(k, name, capacity, texture, emitter = k.root){
    const ps = new ParticleSystem(name, capacity, k.scene)
    ps.particleTexture = texture
    ps.emitter = emitter
    ps.isLocal = true
    ps.blendMode = ParticleSystem.BLENDMODE_ADD
    k.owned.add(ps)
    return ps
}

// Stop emitting, and free the system once its last particle is gone. Not
// disposeOnStop: that disposes the texture along with it, and these are
// shared - by every aura, and flame2/smoke2 with the rest of the game's
// effects (particlesystem.js's cache).
function retire(k, ps){
    ps.onAnimationEnd = () => setTimeout(() => release(k, ps), 0)
    ps.stop()
}
function release(k, ps){
    if(!k.owned.delete(ps)) return
    const scene = ps.getScene()
    if(scene && !scene.isDisposed) ps.dispose(false)
}

function glitter(k){
    const ps = particles(k, "auraGlitter", 160, k.tex.streak)
    // on the body's surface, not inside it
    ps.createCylinderEmitter(k.radius + 0.03, k.height * 0.95, 0, 0.6)
    ps.minLifeTime = 0.3
    ps.maxLifeTime = 0.65
    // thin1 is a sliver in a big square - about 2.3x the old star's sizes
    // for the same presence
    ps.minSize = lerp(0.3, 0.38, k.P)
    ps.maxSize = lerp(0.55, 0.7, k.P)
    // pop in, then out
    ps.addSizeGradient(0, 0)
    ps.addSizeGradient(0.25, 1)
    ps.addSizeGradient(1, 0)
    ps.minEmitPower = 0.05
    ps.maxEmitPower = 0.25
    ps.gravity = new Vector3(0, 0.35, 0)
    ps.minInitialRotation = 0
    ps.maxInitialRotation = Math.PI
    ps.minAngularSpeed = -2
    ps.maxAngularSpeed = 2
    ps.color1 = new Color4(1, 1, 1, 1)
    ps.color2 = c4(Color3.Lerp(BLUE.core, DARK.rim, k.D * 0.6), 1)
    ps.colorDead = c4(BLUE.mid, 0)
    // they're the whole show on a weak aura; a strong one has flame for that
    ps.emitRate = lerp(18, 34, k.P)
    return ps
}

function darkMotes(k){
    const ps = particles(k, "auraDarkMotes", 120, k.tex.smoke)
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD
    ps.createCylinderEmitter(k.radius * 0.9, k.height * 0.9, 0.5, 0.3)
    ps.minLifeTime = 0.7
    ps.maxLifeTime = 1.2
    ps.minSize = lerp(0.12, 0.25, k.P)
    ps.maxSize = lerp(0.25, 0.45, k.P)
    ps.addSizeGradient(0, 0.4)
    ps.addSizeGradient(1, 1.2)
    ps.minEmitPower = 0.05
    ps.maxEmitPower = 0.2
    ps.gravity = new Vector3(0, lerp(0.5, 1, k.P), 0)
    ps.minInitialRotation = 0
    ps.maxInitialRotation = Math.PI * 2
    ps.minAngularSpeed = -0.8
    ps.maxAngularSpeed = 0.8
    ps.addColorGradient(0, c4(DARK.core, 0))
    ps.addColorGradient(0.25, c4(DARK.core, 0.6 * k.D))
    ps.addColorGradient(1, c4(DARK.body, 0))
    ps.emitRate = lerp(6, 28, k.P) * k.D
    return ps
}

function haze(k){
    const t = ramp(k.P, TIER.haze, 0.65)
    const ps = particles(k, "auraHaze", 90, k.tex.smoke)
    ps.createCylinderEmitter(k.radius * 0.8, k.height * 0.85, 1, 0.3)
    ps.minLifeTime = 0.8
    ps.maxLifeTime = 1.3
    ps.minSize = lerp(0.55, 0.8, t)
    ps.maxSize = lerp(0.85, 1.25, t)
    ps.addSizeGradient(0, 0.5)
    ps.addSizeGradient(1, 1.2)
    ps.minEmitPower = 0.1
    ps.maxEmitPower = 0.3
    ps.gravity = new Vector3(0, lerp(0.4, 0.9, t), 0)
    ps.minInitialRotation = 0
    ps.maxInitialRotation = Math.PI * 2
    ps.minAngularSpeed = -0.6
    ps.maxAngularSpeed = 0.6
    ps.addColorGradient(0, c4(BLUE.mid, 0))
    ps.addColorGradient(0.3, c4(BLUE.mid, lerp(0.12, 0.24, t)))
    ps.addColorGradient(1, c4(BLUE.deep, 0))
    ps.emitRate = lerp(10, 32, t)
    return ps
}

// violet shimmer over the dark layers - drawn after them, so it tints the black
function darkGlow(k){
    const t = ramp(k.P, TIER.haze, 1)
    const ps = particles(k, "auraDarkGlow", 80, k.tex.smoke)
    ps.createCylinderEmitter(k.radius, k.height * 0.85, 1, 0.3)
    ps.minLifeTime = 0.6
    ps.maxLifeTime = 1.1
    ps.minSize = lerp(0.4, 0.7, t)
    ps.maxSize = lerp(0.6, 1.0, t)
    ps.minEmitPower = 0.1
    ps.maxEmitPower = 0.3
    ps.gravity = new Vector3(0, lerp(0.5, 1.2, t), 0)
    ps.minInitialRotation = 0
    ps.maxInitialRotation = Math.PI * 2
    ps.addColorGradient(0, c4(DARK.rim, 0))
    ps.addColorGradient(0.35, c4(DARK.rim, lerp(0.1, 0.2, t) * k.D))
    ps.addColorGradient(1, c4(DARK.body, 0))
    ps.emitRate = lerp(8, 26, t) * k.D
    return ps
}

// blue flame up the whole body; `outer` is the overflow tier's taller ring
// rising from the ground around it
function flames(k, outer = false){
    const t = outer ? ramp(k.P, TIER.overflow, 1) : ramp(k.P, TIER.flames, 0.95)
    const ps = particles(k, outer ? "auraFlamesOuter" : "auraFlames", 320, k.tex.flame, outer ? k.feet : k.root)
    const radius = outer ? k.radius * 1.55 : k.radius * lerp(0.95, 1.2, t)
    ps.createDirectedCylinderEmitter(radius, outer ? 0.25 : k.height * 0.8, 0.35, new Vector3(-0.12, 1, -0.12), new Vector3(0.12, 1, 0.12))
    // upright tongues of flame, whatever the camera's pitch
    ps.billboardMode = ParticleSystem.BILLBOARDMODE_Y
    const life = lerp(0.42, 0.7, t) * (outer ? 1.5 : 1)
    ps.minLifeTime = life
    ps.maxLifeTime = life * 1.6
    const size = lerp(0.36, 0.52, t) * (outer ? 1.45 : 1)
    ps.minSize = size
    ps.maxSize = size * 1.7
    ps.minScaleX = 0.75
    ps.maxScaleX = 1.05
    ps.minScaleY = 1.3
    ps.maxScaleY = 1.9
    ps.addSizeGradient(0, 0.45)
    ps.addSizeGradient(0.3, 1)
    ps.addSizeGradient(1, 0.2)
    ps.minEmitPower = lerp(0.5, 1.1, t)
    ps.maxEmitPower = lerp(0.8, 1.7, t)
    ps.gravity = new Vector3(0, lerp(0.8, 1.6, t), 0)
    ps.minInitialRotation = -0.15
    ps.maxInitialRotation = 0.15
    const alpha = outer ? 0.45 : 0.9
    ps.addColorGradient(0, c4(BLUE.core, 0))
    ps.addColorGradient(0.12, c4(BLUE.core, alpha))
    ps.addColorGradient(0.5, c4(BLUE.mid, alpha * 0.7))
    ps.addColorGradient(1, c4(BLUE.deep, 0))
    ps.noiseTexture = k.tex.noise
    ps.noiseStrength = new Vector3(0.6, 0.15, 0.6)
    ps.emitRate = lerp(50, 120, t) * (outer ? 0.6 : 1)
    ps._auraBreathes = true
    return ps
}

// The additive flame above glows at night but washes out to white against a
// bright sky - this deep blue under it, drawn normally (not added), keeps the
// flame blue in daylight and gives it some body at night.
function flameBody(k){
    const t = ramp(k.P, TIER.flames, 0.95)
    const ps = particles(k, "auraFlameBody", 200, k.tex.flame)
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD
    ps.createDirectedCylinderEmitter(k.radius * lerp(0.9, 1.1, t), k.height * 0.75, 0.35, new Vector3(-0.1, 1, -0.1), new Vector3(0.1, 1, 0.1))
    ps.billboardMode = ParticleSystem.BILLBOARDMODE_Y
    ps.minLifeTime = lerp(0.4, 0.62, t)
    ps.maxLifeTime = ps.minLifeTime * 1.5
    ps.minSize = lerp(0.32, 0.46, t)
    ps.maxSize = ps.minSize * 1.6
    ps.minScaleX = 0.75
    ps.maxScaleX = 1
    ps.minScaleY = 1.3
    ps.maxScaleY = 1.8
    ps.addSizeGradient(0, 0.45)
    ps.addSizeGradient(0.3, 1)
    ps.addSizeGradient(1, 0.25)
    ps.minEmitPower = lerp(0.5, 1, t)
    ps.maxEmitPower = lerp(0.8, 1.5, t)
    ps.gravity = new Vector3(0, lerp(0.8, 1.5, t), 0)
    ps.minInitialRotation = -0.15
    ps.maxInitialRotation = 0.15
    ps.addColorGradient(0, c4(BLUE.mid, 0))
    ps.addColorGradient(0.15, c4(BLUE.mid, 0.5))
    ps.addColorGradient(0.6, c4(BLUE.deep, 0.32))
    ps.addColorGradient(1, c4(BLUE.deep, 0))
    ps.noiseTexture = k.tex.noise
    ps.noiseStrength = new Vector3(0.5, 0.15, 0.5)
    ps.emitRate = lerp(25, 60, t)
    ps._auraBreathes = true
    return ps
}

// black flame, inside the blue - a little narrower and shorter, so the blue
// still edges it
function darkFlames(k){
    const t = ramp(k.P, TIER.flames, 0.95)
    const ps = particles(k, "auraDarkFlames", 260, k.tex.flame)
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD
    ps.createDirectedCylinderEmitter(k.radius * lerp(0.8, 1.0, t), k.height * 0.75, 0.4, new Vector3(-0.1, 1, -0.1), new Vector3(0.1, 1, 0.1))
    ps.billboardMode = ParticleSystem.BILLBOARDMODE_Y
    ps.minLifeTime = lerp(0.38, 0.6, t)
    ps.maxLifeTime = ps.minLifeTime * 1.5
    ps.minSize = lerp(0.28, 0.46, t)
    ps.maxSize = ps.minSize * 1.6
    ps.minScaleX = 0.7
    ps.maxScaleX = 1
    ps.minScaleY = 1.3
    ps.maxScaleY = 2
    ps.addSizeGradient(0, 0.5)
    ps.addSizeGradient(0.3, 1)
    ps.addSizeGradient(1, 0.25)
    ps.minEmitPower = lerp(0.45, 1, t)
    ps.maxEmitPower = lerp(0.75, 1.5, t)
    ps.gravity = new Vector3(0, lerp(0.8, 1.5, t), 0)
    ps.minInitialRotation = -0.15
    ps.maxInitialRotation = 0.15
    ps.addColorGradient(0, c4(DARK.core, 0))
    ps.addColorGradient(0.15, c4(DARK.core, 0.9 * k.D))
    ps.addColorGradient(0.6, c4(DARK.body, 0.6 * k.D))
    ps.addColorGradient(1, c4(DARK.body, 0))
    ps.noiseTexture = k.tex.noise
    ps.noiseStrength = new Vector3(0.5, 0.15, 0.5)
    ps.emitRate = lerp(25, 95, t) * k.D
    ps._auraBreathes = true
    return ps
}

// the Noblesse look: thin black spikes lashing up and out from the chest,
// curling upward as they go - each one points along its own flight
function tendrils(k){
    const t = ramp(k.P, TIER.tendrils, 1)
    const ps = particles(k, "auraTendrils", 160, k.tex.spike, k.chest)
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD
    ps.createHemisphericEmitter(0.26, 0.2)
    // fanned up and out, 38-72 degrees above level - never flat along the
    // ground, where one pointing at the camera foreshortens into a wide wedge
    ps.startDirectionFunction = (worldMatrix, direction, particle, isLocal) => {
        const angle = Math.random() * Math.PI * 2
        const out = 0.45 + Math.random() * 0.5
        const up = 0.75 + Math.random() * 0.6
        if(isLocal) direction.set(Math.cos(angle) * out, up, Math.sin(angle) * out)
        else Vector3.TransformNormalFromFloatsToRef(Math.cos(angle) * out, up, Math.sin(angle) * out, worldMatrix, direction)
    }
    ps.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED_LOCAL
    ps.minLifeTime = 0.3
    ps.maxLifeTime = lerp(0.5, 0.7, t)
    ps.minSize = lerp(0.09, 0.12, t)
    ps.maxSize = lerp(0.14, 0.2, t)
    ps.minScaleY = lerp(2.5, 3.2, t)
    ps.maxScaleY = lerp(3.5, 4.5, t)
    ps.addSizeGradient(0, 0.3)
    ps.addSizeGradient(0.2, 1)
    ps.addSizeGradient(1, 0.6)
    // kept moving the whole way: a near-still particle has no direction to
    // stretch along, and stretched billboards are known to misdraw then
    ps.minEmitPower = lerp(1.4, 2.2, t)
    ps.maxEmitPower = lerp(2.2, 3.4, t)
    ps.gravity = new Vector3(0, 2.2, 0)
    // the texture carries its own black and violet - tinted white (unchanged),
    // faded by alpha alone
    const white = new Color3(1, 1, 1)
    ps.addColorGradient(0, c4(white, 0))
    ps.addColorGradient(0.12, c4(white, 0.95 * k.D))
    ps.addColorGradient(0.7, c4(white, 0.7 * k.D))
    ps.addColorGradient(1, c4(white, 0))
    ps.emitRate = lerp(14, 44, t) * k.D
    return ps
}

function streaks(k){
    const t = ramp(k.P, TIER.streaks, 1)
    const ps = particles(k, "auraStreaks", 80, k.tex.streak)
    ps.createDirectedCylinderEmitter(k.radius * 1.15, k.height * 0.9, 0.3, new Vector3(-0.05, 1, -0.05), new Vector3(0.05, 1, 0.05))
    ps.billboardMode = ParticleSystem.BILLBOARDMODE_Y
    ps.minLifeTime = 0.25
    ps.maxLifeTime = 0.45
    ps.minSize = 0.15
    ps.maxSize = 0.25
    ps.minScaleY = lerp(3, 4.5, t)
    ps.maxScaleY = lerp(4.5, 7, t)
    ps.minEmitPower = lerp(2.5, 3.5, t)
    ps.maxEmitPower = lerp(3.5, 5, t)
    ps.color1 = c4(BLUE.core, 1)
    ps.color2 = c4(Color3.Lerp(BLUE.mid, DARK.rim, k.D * 0.7), 1)
    ps.colorDead = c4(BLUE.deep, 0)
    ps.emitRate = lerp(10, 40, t)
    return ps
}

// left behind as the body moves (not isLocal), drifting up on the noise
function embers(k){
    const t = ramp(k.P, TIER.streaks, 1)
    const ps = particles(k, "auraEmbers", 120, k.tex.streak)
    ps.isLocal = false
    ps.createCylinderEmitter(k.radius * 1.2, k.height * 0.9, 0.5, 0.4)
    ps.minLifeTime = 1
    ps.maxLifeTime = 1.8
    ps.minSize = 0.08
    ps.maxSize = 0.16
    ps.addSizeGradient(0, 1)
    ps.addSizeGradient(1, 0)
    ps.minEmitPower = 0.1
    ps.maxEmitPower = 0.4
    ps.gravity = new Vector3(0, 0.8, 0)
    ps.color1 = c4(BLUE.core, 1)
    ps.color2 = c4(Color3.Lerp(BLUE.mid, DARK.rim, k.D), 1)
    ps.colorDead = c4(BLUE.deep, 0)
    ps.noiseTexture = k.tex.noise
    ps.noiseStrength = new Vector3(0.8, 0.3, 0.8)
    ps.emitRate = lerp(10, 35, t)
    return ps
}

// ── one-off effects ──────────────────────────────────────────────────────────

// the flare as it lights (or grows): a burst of glints off the chest, and from
// the flame stage up a ring sweeping out along the ground
function ignite(k, ringMat){
    const burst = particles(k, "auraIgnite", 100, k.tex.streak, k.chest)
    burst.isLocal = false
    burst.createSphereEmitter(0.3, 1)
    burst.manualEmitCount = Math.round(lerp(18, 70, k.P))
    burst.minLifeTime = 0.35
    burst.maxLifeTime = 0.8
    burst.minSize = 0.18
    burst.maxSize = lerp(0.36, 0.62, k.P)
    burst.addSizeGradient(0, 1)
    burst.addSizeGradient(1, 0)
    burst.minEmitPower = lerp(1, 2.5, k.P)
    burst.maxEmitPower = lerp(2, 4.5, k.P)
    burst.minAngularSpeed = -3
    burst.maxAngularSpeed = 3
    burst.color1 = new Color4(1, 1, 1, 1)
    burst.color2 = c4(Color3.Lerp(BLUE.core, DARK.rim, k.D * 0.6), 1)
    burst.colorDead = c4(BLUE.mid, 0)
    // stops itself after the one burst, then frees itself like any retired layer
    burst.targetStopDuration = 0.2
    burst.onAnimationEnd = () => setTimeout(() => release(k, burst), 0)
    burst.start()
    if(k.P >= TIER.flames) ringPulse(k, ringMat, lerp(1.8, 3.4, k.P))
}

// a ring sweeping out along the ground from the feet, fading as it goes
function ringPulse(k, ringMat, size, seconds = 0.75){
    const ring = MeshBuilder.CreateGround("auraPulse", { width: 1, height: 1 }, k.scene)
    ring.isPickable = false
    ring.material = ringMat
    const feet = k.feet.getAbsolutePosition()
    ring.position.set(feet.x, feet.y + 0.03, feet.z)
    let t = 0
    ring._auraObserver = k.scene.onBeforeRenderObservable.add(() => {
        // the scene's animation clock - the one the particles run on
        t = Math.min(1, t + k.scene.getAnimationRatio() / 60 / seconds)
        const eased = 1 - Math.pow(1 - t, 3)
        const scale = lerp(0.4, size, eased)
        ring.scaling.set(scale, 1, scale)
        ring.visibility = 1 - t
        if(t >= 1) endRing(k, ring)
    })
    k.rings.add(ring)
}
function endRing(k, ring){
    if(!k.rings.delete(ring)) return
    k.scene.onBeforeRenderObservable.remove(ring._auraObserver)
    ring.dispose()
}

function ringColor(profile){
    return Color3.Lerp(BLUE.mid, DARK.rim, profile.darkness >= DARK_TINT_FROM ? 0.8 : profile.darkness * 0.5)
}

// ── the aura itself ──────────────────────────────────────────────────────────

// Every player rig gets one (createcharacter.js). start(profile) shows it -
// with no profile, the last one it had, or one worked out from det. update()
// redraws it if the profile changed enough to see, and says whether it did.
export function createBodyAura(det, scene, body, bodyHeight = 1.5){
    const fallback = auraProfileFromDet(det)
    let profile = null
    let running = false
    let build = null
    let anchors = null
    let ringMat = null
    let observer = null
    let follow = null
    let disposed = false
    // every particle system and pulse ring this aura has going, burning out
    // ones included - all freed at once if the body goes
    const owned = new Set()
    const rings = new Set()

    // The points the layers emit from - made on first start. They hang off a
    // root of the aura's own that FOLLOWS the body each frame, not off the body
    // itself: disposing a mesh makes Babylon dispose every particle system
    // emitting from it or its children, textures and all, before any
    // onDispose hook runs - a player walking away would take the shared
    // textures (every aura's, and the game's other fires') with them. Off the
    // body, its dispose never touches them; dispose() below frees them instead.
    function ensureAnchors(){
        if(anchors) return anchors
        const root = MeshBuilder.CreateBox(`aura.root.${body.name}`, { size: 0.01 }, scene)
        root.isVisible = false
        root.isPickable = false
        root.rotationQuaternion = new Quaternion()
        const sync = () => body.computeWorldMatrix(true).decompose(undefined, root.rotationQuaternion, root.position)
        sync()
        follow = scene.onBeforeRenderObservable.add(sync)
        const point = (name, y) => {
            const mesh = MeshBuilder.CreateBox(`aura.${name}.${body.name}`, { size: 0.01 }, scene)
            mesh.isVisible = false
            mesh.isPickable = false
            mesh.parent = root
            mesh.position.y = y
            return mesh
        }
        // body's origin is the middle of the capsule, so the feet are half its height down
        const feet = point("feet", -bodyHeight / 2)
        const chest = point("chest", bodyHeight * 0.12)
        ringMat = new StandardMaterial(`aura.ringMat.${body.name}`, scene)
        ringMat.disableLighting = true
        ringMat.diffuseColor = Color3.Black()
        ringMat.specularColor = Color3.Black()
        ringMat.backFaceCulling = false
        ringMat.alphaMode = Constants.ALPHA_ADD
        anchors = { root, feet, chest }
        return anchors
    }

    // What the overflow lightning crackles over - a body-sized box of its own
    // for each build. attachLightning cleans itself up when its mesh goes, so
    // disposing this box is the one way it's ever torn down (calling its
    // dispose() as well would run it twice once the body went too).
    function lightningHost(){
        const host = MeshBuilder.CreateBox(`aura.lightning.${body.name}`, { width: 0.8, height: bodyHeight * 1.05, depth: 0.8 }, scene)
        host.isVisible = false
        host.isPickable = false
        host.parent = anchors.root
        return host
    }

    function context(p){
        const tex = auraTextures(scene)
        ringMat.opacityTexture = tex.ring
        ringMat.emissiveColor = ringColor(p)
        return { scene, ...anchors, tex, owned, rings, P: p.power, D: p.darkness, height: bodyHeight, radius: 0.3 }
    }

    // the layers for one profile, in draw order: glows and blue flame first,
    // the black over them, the violet shimmer over the black, then the bright
    // details on top of everything
    function buildFor(p, warm){
        const k = context(p)
        const D = k.D, P = k.P
        const layers = []
        if(P >= TIER.haze) layers.push(haze(k))
        if(P >= TIER.flames) layers.push(flameBody(k), flames(k))
        if(P >= TIER.overflow) layers.push(flames(k, true))
        if(D > 0) layers.push(darkMotes(k))
        if(D > 0 && P >= TIER.flames) layers.push(darkFlames(k))
        if(D > 0 && P >= TIER.tendrils) layers.push(tendrils(k))
        if(D > 0 && P >= TIER.haze) layers.push(darkGlow(k))
        if(P >= TIER.streaks) layers.push(streaks(k), embers(k))
        layers.push(glitter(k))
        layers.forEach(ps => {
            ps._auraBaseRate = ps.emitRate
            // a rebuild starts already burning, so the swap doesn't blink
            if(warm){
                ps.preWarmCycles = 40
                ps.preWarmStepOffset = 3
            }
            ps.start()
        })
        // no point light (withLight) - materials stop compiling past 8 lights
        // on some GPUs, and every aura in view would add one
        let lightningOn = null
        if(P >= TIER.overflow){
            lightningOn = lightningHost()
            attachLightning(scene, lightningOn, D >= DARK_TINT_FROM ? "purple" : "cyan", false, {
                arcCount: Math.round(lerp(2, 4, ramp(P, TIER.overflow, 1))), width: 0.012, updateInterval: 110, withLight: false,
            })
        }
        return { k, layers, lightningOn, pulses: P >= TIER.overflow, ringSize: lerp(2.6, 3.8, ramp(P, TIER.overflow, 1)) }
    }

    // stop emitting and let what's in the air burn out (retire)
    function burnOut(old){
        if(!old) return
        old.layers.forEach(ps => retire(old.k, ps))
        old.lightningOn?.dispose()
    }

    function watch(){
        if(observer) return
        let time = 0
        let sincePulse = 0
        let nextPulse = PULSE_EVERY
        observer = scene.onBeforeRenderObservable.add(() => {
            if(!build) return
            const dt = scene.getAnimationRatio() / 60
            time += dt
            const breath = 1 + BREATH_DEPTH * Math.sin(time * Math.PI * 2 * BREATH_RATE)
            build.layers.forEach(ps => { if(ps._auraBreathes) ps.emitRate = ps._auraBaseRate * breath })
            if(!build.pulses) return
            sincePulse += dt
            if(sincePulse < nextPulse) return
            sincePulse = 0
            nextPulse = PULSE_EVERY * (0.85 + Math.random() * 0.3)
            ringPulse(build.k, ringMat, build.ringSize, 0.9)
        })
    }

    function unwatch(){
        if(!observer) return
        scene.onBeforeRenderObservable.remove(observer)
        observer = null
    }

    function start(next){
        if(disposed) return
        const p = next ?? profile ?? fallback
        if(running){
            update(p)
            return
        }
        running = true
        profile = p
        ensureAnchors()
        build = buildFor(p, false)
        ignite(build.k, ringMat)
        watch()
    }

    function update(next){
        if(!next || disposed) return false
        if(!running){
            profile = next
            return false
        }
        if(!auraProfileChanged(profile, next)) return false
        const grew = next.power > profile.power || next.darkness > profile.darkness
        burnOut(build)
        profile = next
        build = buildFor(next, true)
        // getting stronger flares it up again
        if(grew) ignite(build.k, ringMat)
        return true
    }

    function stop(){
        if(!running) return
        running = false
        burnOut(build)
        build = null
        unwatch()
    }

    function dispose(){
        if(disposed) return
        stop()
        disposed = true
        // the body's gone - nothing left to burn out against. The particles go
        // first, so the root's own dispose finds none of them to take textures with
        const k = { scene, owned, rings }
        owned.forEach(ps => release(k, ps))
        rings.forEach(ring => endRing(k, ring))
        if(follow) scene.onBeforeRenderObservable.remove(follow)
        anchors?.root.dispose()
        ringMat?.dispose()
    }

    body.onDisposeObservable.addOnce(dispose)

    return {
        start,
        stop,
        update,
        dispose,
        get isRunning(){ return running },
        get profile(){ return profile ?? fallback },
    }
}
