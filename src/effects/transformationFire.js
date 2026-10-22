import { Color3, Color4, Constants, DynamicTexture, MeshBuilder, NoiseProceduralTexture, ParticleSystem, StandardMaterial, Vector3 } from "@babylonjs/core"
import { getParticleTexture, particleTexturePath } from "../tools/particlesystem.js"

// THE TRANSFORMATION FIRE (charactersystem/evolution.js) - dark fire taking a
// body while it changes. Black flame with a burning red edge licks up off
// every part of the body - it comes off the bones, along each arm, leg and the
// trunk, so it takes the body's shape and follows it lying down, getting up
// and standing - while a ring of the same fire runs out across the ground
// around it like wildfire, under smoke, embers and black spikes lashing out of
// the chest. ignite() is the fire catching (a burst that hides the body
// dropping to the ground); flare() the change breaking through: black
// feathers, embers and smoke bursting off the back, and a shock ring along the
// ground.
//
// Drawn the way effects/aura.js draws its dark flame: the burning colour
// added (so it glows at night), and black drawn normally, narrower, over it,
// so what shows is black flame with a glowing edge - added black would be
// invisible, and plain black flame vanishes at night. Each flame is small and
// short-lived, and many of them are layered thin: a few big ones merge into
// solid shards (flame2's core is a hard shape, its tail soft).
//
// Every system here runs on updateSpeed 1/60, so its numbers are real units:
// lifetimes in seconds, emitRate per second, speeds in units per second. Sizes
// are metres - set with sizeOverLife: with size gradients Babylon ignores
// minSize/maxSize and takes the gradient values AS the sizes (a gradient of 1
// is a metre-wide particle, not "full size").

// a fire's colours, by evolution (evolution.js's EVOLUTIONS)
export const FIRE_PALETTES = {
    demon: {
        hot:   new Color3(1.0, 0.62, 0.2),     // the embers' cores
        ember: new Color3(1.0, 0.2, 0.05),     // the burning edge
        blood: new Color3(0.5, 0.02, 0.03),    // the edge cooling off
        char:  new Color3(0.1, 0.0, 0.025),    // the black flame's red-black middle
        smoke: new Color3(0.06, 0.03, 0.035),
        spikeGlow: "rgba(255,50,20,1)",
    },
}

const UPDATE_SPEED = 1 / 60
// the ground fire's front: starts this far out and runs out toward
// RING_RADIUS, fast at first and slowing, like a spreading fire running out
// of fuel (RING_SPREAD seconds for about two thirds of the way)
const RING_START = 0.35
const RING_RADIUS = 2.4
const RING_SPREAD = 0.9
// the flames swell and ebb a little (cycles per second, +/- share)
const BREATH_RATE = 0.9
const BREATH_DEPTH = 0.18

// a particle's size over its life: [[at, small, big], ...] - at 0..1 through
// its life, its size then somewhere between small and big, in metres
function sizeOverLife(ps, stops){
    stops.forEach(([at, small, big]) => ps.addSizeGradient(at, small, big))
}

const lerp = (a, b, t) => a + (b - a) * t
const rand = (a, b) => a + Math.random() * (b - a)
const c4 = (color, alpha) => new Color4(color.r, color.g, color.b, alpha)

// ── textures ─────────────────────────────────────────────────────────────────
// The spike and the ground ring are drawn here - nothing in
// images/particles is either. One set per scene and palette, kept with
// the scene (they're small and never change).

const texturesByScene = new WeakMap()

function drawTexture(scene, name, width, height, draw){
    // mipmapped - these are small on screen, and without mips their thin
    // points break up into dots
    const tex = new DynamicTexture(name, { width, height }, scene, true)
    const ctx = tex.getContext()
    ctx.clearRect(0, 0, width, height)
    draw(ctx, width, height)
    tex.hasAlpha = true
    tex.update()
    return tex
}

// a long jagged spike, point at the top - black, with a burning glow round it
// (effects/aura.js's drawSpike, in this fire's colour)
function drawSpike(ctx, width, height, glow){
    const mid = width / 2
    const barbs = [0.12, -0.18, 0.22, -0.1, 0.16, -0.14]
    ctx.shadowColor = glow
    ctx.shadowBlur = width * 0.2
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

// a soft ring, for the shock along the ground (effects/shockRing.js too)
export function drawRing(ctx, size){
    const c = size / 2
    const ring = ctx.createRadialGradient(c, c, 0, c, c, c)
    ring.addColorStop(0, "rgba(255,255,255,0)")
    ring.addColorStop(0.55, "rgba(255,255,255,0)")
    ring.addColorStop(0.8, "rgba(255,255,255,1)")
    ring.addColorStop(0.9, "rgba(255,255,255,0.35)")
    ring.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = ring
    ctx.fillRect(0, 0, size, size)
}

// also effects/dark.js's attachDark - the same fire, kept burning on a mesh
export function fireTextures(scene, palette){
    let byPalette = texturesByScene.get(scene)
    if(!byPalette) texturesByScene.set(scene, byPalette = new Map())
    let tex = byPalette.get(palette)
    if(tex) return tex
    tex = {
        spike: drawTexture(scene, "transformSpike", 64, 256, (ctx, w, h) => drawSpike(ctx, w, h, palette.spikeGlow)),
        ring: drawTexture(scene, "transformRing", 256, 256, (ctx, w) => drawRing(ctx, w)),
        // the feather particles' image - a whole black feather, corner to corner
        feather: getParticleTexture(scene, "./images/UI/feather.webp"),
        // shared with the rest of the game's effects (particlesystem.js's cache)
        flame: getParticleTexture(scene, particleTexturePath("flame2")),
        smoke: getParticleTexture(scene, particleTexturePath("smoke2")),
        spark: getParticleTexture(scene, particleTexturePath("thin1")),
    }
    byPalette.set(palette, tex)
    return tex
}

// ── the fire ─────────────────────────────────────────────────────────────────

// anchors: where on the body the fire comes off - [{ from, to, weight,
//          radius, lift, chest }]. from/to: bones (or any nodes) - the fire
//          comes off the stretch between them (a forearm, a thigh), following
//          both; no `to`: just round `from`. weight: its share of the flames.
//          radius: how far off the line they start. lift: metres up (a head
//          bone sits at the neck). chest: the one the spikes lash out of.
// ground:  () => the point on the ground under the body (the ground fire's
//          centre)
// palette: one of FIRE_PALETTES
export function createTransformationFire(scene, { anchors, ground, palette }){
    const tex = fireTextures(scene, palette)
    // its own: a procedural texture redraws every frame, so it goes when this does
    const noise = new NoiseProceduralTexture("transformNoise", 128, scene)
    noise.animationSpeedFactor = 6
    noise.persistence = 2
    noise.brightness = 0.5
    noise.octaves = 2
    const ringMat = new StandardMaterial("transformRingMat", scene)
    ringMat.disableLighting = true
    ringMat.diffuseColor = Color3.Black()
    ringMat.specularColor = Color3.Black()
    ringMat.emissiveColor = palette.ember
    ringMat.opacityTexture = tex.ring
    ringMat.backFaceCulling = false
    ringMat.alphaMode = Constants.ALPHA_ADD

    const points = anchors.map(anchor => ({ ...anchor, a: new Vector3(), b: new Vector3() }))
    const totalWeight = points.reduce((sum, p) => sum + p.weight, 0)
    const groundPos = new Vector3()
    // every system's emitter: the world origin - each one places its own
    // particles, in world space (startPositionFunction)
    const origin = Vector3.Zero()
    const systems = new Set()     // every system running or burning out
    const continuous = []         // the ones intensity drives
    const rings = new Set()
    let intensity = 0
    let burning = false           // between ignite() and stop()
    let burnTime = 0
    let ringRadius = RING_START
    let stopped = false
    let disposed = false

    function track(){
        points.forEach(p => {
            if(p.from.isDisposed?.()) return
            p.from.computeWorldMatrix(true)
            p.a.copyFrom(p.from.getAbsolutePosition())
            if(p.to && !p.to.isDisposed?.()){
                p.to.computeWorldMatrix(true)
                p.b.copyFrom(p.to.getAbsolutePosition())
            } else p.b.copyFrom(p.a)
            if(p.lift){
                p.a.y += p.lift
                p.b.y += p.lift
            }
        })
        groundPos.copyFrom(ground())
    }

    function pickPoint(){
        let roll = Math.random() * totalWeight
        for(const p of points){
            roll -= p.weight
            if(roll < 0) return p
        }
        return points[points.length - 1]
    }
    // a random spot on the body: along a random anchor's line, a little off it
    function onBody(out, spread = 1, lift = 0){
        const p = pickPoint()
        const along = Math.random()
        const r = p.radius * spread * Math.cbrt(Math.random())
        const a = Math.random() * Math.PI * 2
        const y = rand(-1, 1)
        const s = Math.sqrt(1 - y * y)
        out.set(
            lerp(p.a.x, p.b.x, along) + Math.cos(a) * s * r,
            lerp(p.a.y, p.b.y, along) + y * r + lift,
            lerp(p.a.z, p.b.z, along) + Math.sin(a) * s * r)
    }
    // a spot on the ground fire: mostly its front, some behind it
    function onGround(out){
        const a = Math.random() * Math.PI * 2
        const r = Math.random() < 0.75
            ? ringRadius + rand(-0.2, 0.2)
            : ringRadius * Math.sqrt(Math.random())
        out.set(groundPos.x + Math.cos(a) * r, groundPos.y + 0.02, groundPos.z + Math.sin(a) * r)
    }
    function upward(out, spread){
        out.set(rand(-spread, spread), rand(0.85, 1.25), rand(-spread, spread))
    }

    function system(name, capacity, texture, blendMode){
        const ps = new ParticleSystem(name, capacity, scene)
        ps.particleTexture = texture
        ps.emitter = origin
        ps.isLocal = false
        ps.blendMode = blendMode
        ps.updateSpeed = UPDATE_SPEED
        systems.add(ps)
        return ps
    }
    // driven by intensity - rate is its emitRate at full
    function sustained(ps, rate, { ground = false } = {}){
        ps._rate = rate
        ps._onGround = ground
        ps.emitRate = 0
        continuous.push(ps)
        return ps
    }
    // fire once and free itself when its last particle is gone. Not
    // disposeOnStop: that disposes the texture too, and these are shared
    function oneShot(ps, count){
        ps.manualEmitCount = count
        ps.targetStopDuration = 0.1
        ps.onAnimationEnd = () => setTimeout(() => release(ps), 0)
        ps.start()
        return ps
    }
    function release(ps){
        if(!systems.delete(ps)) return
        if(!scene.isDisposed) ps.dispose(false)
        if(stopped) cleanUpWhenDone()
    }

    // ── the layers, in draw order: smoke behind, then each fire's burning
    // edge with its black over it, the spikes, the embers on top ──

    const smoke = sustained(system("transformSmoke", 180, tex.smoke, ParticleSystem.BLENDMODE_STANDARD), 46)
    smoke.startPositionFunction = (m, pos) => onBody(pos, 1.6, 0.1)
    smoke.startDirectionFunction = (m, dir) => upward(dir, 0.3)
    smoke.minEmitPower = 0.4
    smoke.maxEmitPower = 0.9
    smoke.gravity = new Vector3(0, 0.55, 0)
    smoke.minLifeTime = 1.4
    smoke.maxLifeTime = 2.4
    sizeOverLife(smoke, [[0, 0.25, 0.45], [1, 0.9, 1.6]])
    smoke.minInitialRotation = 0
    smoke.maxInitialRotation = Math.PI * 2
    smoke.minAngularSpeed = -0.6
    smoke.maxAngularSpeed = 0.6
    smoke.addColorGradient(0, c4(palette.smoke, 0))
    smoke.addColorGradient(0.2, c4(palette.smoke, 0.4))
    smoke.addColorGradient(1, c4(palette.smoke, 0))

    // dark: the black flame, drawn normally; otherwise the burning edge, added.
    // ground: the wildfire along the ground - low, wide and quick; otherwise
    // the flames on the body, which lick up a short way
    function flameLayer(name, capacity, rate, { dark, ground: onTheGround }){
        const ps = sustained(system(name, capacity, tex.flame, dark ? ParticleSystem.BLENDMODE_STANDARD : ParticleSystem.BLENDMODE_ADD), rate, { ground: onTheGround })
        ps.startPositionFunction = onTheGround
            ? (m, pos) => onGround(pos)
            : (m, pos) => onBody(pos, dark ? 0.7 : 1)
        ps.startDirectionFunction = (m, dir) => upward(dir, onTheGround ? 0.2 : 0.3)
        // upright tongues of flame, whatever the camera's pitch
        ps.billboardMode = ParticleSystem.BILLBOARDMODE_Y
        // the black inside the burning edge: a little smaller, so the edge
        // shows round it
        const size = (onTheGround ? 0.3 : 0.24) * (dark ? 0.85 : 1)
        // a tongue of flame: widest a quarter of the way through its life,
        // half as tall again as wide to twice
        sizeOverLife(ps, [[0, size * 0.5, size * 0.9], [0.25, size, size * 1.9], [1, size * 0.25, size * 0.45]])
        // tall and narrow, swaying on the noise
        ps.minScaleX = 0.6
        ps.maxScaleX = 0.85
        ps.minScaleY = 2
        ps.maxScaleY = 3
        ps.minLifeTime = onTheGround ? 0.35 : 0.4
        ps.maxLifeTime = (onTheGround ? 0.6 : 0.75) * (dark ? 1 : 0.9)
        // how far they rise: about half a metre on the body, a hand's width on the ground
        ps.minEmitPower = onTheGround ? 0.15 : 0.5
        ps.maxEmitPower = onTheGround ? 0.45 : 1.2
        ps.gravity = new Vector3(0, onTheGround ? 0.6 : 1.1, 0)
        ps.minInitialRotation = -0.15
        ps.maxInitialRotation = 0.15
        if(dark){
            ps.addColorGradient(0, c4(palette.char, 0))
            ps.addColorGradient(0.15, new Color4(0, 0, 0, 0.8))
            ps.addColorGradient(0.6, c4(palette.char, 0.55))
            ps.addColorGradient(1, new Color4(0, 0, 0, 0))
        } else {
            ps.addColorGradient(0, c4(palette.ember, 0))
            ps.addColorGradient(0.12, c4(palette.ember, 0.9))
            ps.addColorGradient(0.5, c4(palette.blood, 0.55))
            ps.addColorGradient(1, c4(palette.blood, 0))
        }
        ps.noiseTexture = noise
        ps.noiseStrength = new Vector3(1, 0.3, 1)
        return ps
    }
    flameLayer("transformGroundEdge", 420, 300, { dark: false, ground: true })
    flameLayer("transformGroundFire", 500, 380, { dark: true, ground: true })
    flameLayer("transformBodyEdge", 380, 300, { dark: false, ground: false })
    flameLayer("transformBodyFire", 420, 340, { dark: true, ground: false })

    // black spikes lashing up and out of the chest - the anchor marked chest,
    // or else the one with the most weight
    const chest = points.find(p => p.chest) ?? points.reduce((best, p) => p.weight > best.weight ? p : best, points[0])
    function spikes(ps){
        ps.startPositionFunction = (m, pos) => {
            pos.set(
                (chest.a.x + chest.b.x) / 2 + rand(-0.12, 0.12),
                (chest.a.y + chest.b.y) / 2 + rand(-0.12, 0.12),
                (chest.a.z + chest.b.z) / 2 + rand(-0.12, 0.12))
        }
        // fanned up and out, never flat along the ground (aura.js's tendrils)
        ps.startDirectionFunction = (m, dir) => {
            const a = Math.random() * Math.PI * 2
            const out = rand(0.45, 0.95)
            dir.set(Math.cos(a) * out, rand(0.75, 1.35), Math.sin(a) * out)
        }
        ps.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED
        // 0.14-0.22 wide at most, 3-5 times that long: a half to a metre
        sizeOverLife(ps, [[0, 0.06, 0.1], [0.2, 0.14, 0.22], [1, 0.08, 0.12]])
        ps.minScaleY = 3.2
        ps.maxScaleY = 4.8
        // kept moving the whole way: stretched billboards misdraw when still
        ps.minEmitPower = 2.2
        ps.maxEmitPower = 3.8
        ps.gravity = new Vector3(0, 2, 0)
        ps.minLifeTime = 0.3
        ps.maxLifeTime = 0.5
        // the texture carries its own black and glow - faded by alpha alone
        ps.addColorGradient(0, new Color4(1, 1, 1, 0))
        ps.addColorGradient(0.12, new Color4(1, 1, 1, 0.95))
        ps.addColorGradient(0.7, new Color4(1, 1, 1, 0.7))
        ps.addColorGradient(1, new Color4(1, 1, 1, 0))
        return ps
    }
    sustained(spikes(system("transformSpikes", 100, tex.spike, ParticleSystem.BLENDMODE_STANDARD)), 22)

    function embers(ps){
        ps.startDirectionFunction = (m, dir) => dir.set(rand(-0.6, 0.6), rand(0.6, 1.3), rand(-0.6, 0.6))
        // thin1 is a sliver in a big square - a quarter to half a metre of it
        // reads as a spark a few centimetres long
        sizeOverLife(ps, [[0, 0.3, 0.55], [1, 0, 0.05]])
        ps.minLifeTime = 0.8
        ps.maxLifeTime = 1.6
        ps.minInitialRotation = 0
        ps.maxInitialRotation = Math.PI
        ps.minAngularSpeed = -3
        ps.maxAngularSpeed = 3
        ps.color1 = c4(palette.hot, 1)
        ps.color2 = c4(palette.ember, 1)
        ps.colorDead = c4(palette.blood, 0)
        ps.noiseTexture = noise
        ps.noiseStrength = new Vector3(1.2, 0.4, 1.2)
        return ps
    }
    const sparks = sustained(embers(system("transformEmbers", 260, tex.spark, ParticleSystem.BLENDMODE_ADD)), 70)
    sparks.startPositionFunction = (m, pos) => Math.random() < 0.3 ? onGround(pos) : onBody(pos, 1.4)
    sparks.minEmitPower = 1.2
    sparks.maxEmitPower = 2.8
    sparks.gravity = new Vector3(0, 0.6, 0)

    // ── bursts ──

    // a ring sweeping out along the ground from under the body, fading as it goes
    function shockRing(size, seconds){
        const ring = MeshBuilder.CreateGround("transformShock", { width: 1, height: 1 }, scene)
        ring.isPickable = false
        ring.material = ringMat
        ring.position.set(groundPos.x, groundPos.y + 0.04, groundPos.z)
        let t = 0
        const grow = scene.onBeforeRenderObservable.add(() => {
            t = Math.min(1, t + scene.getAnimationRatio() / 60 / seconds)
            const scale = lerp(0.4, size, 1 - Math.pow(1 - t, 3))
            ring.scaling.set(scale, 1, scale)
            ring.visibility = 1 - t
            if(t >= 1) endRing(ring)
        })
        ring._transformObserver = grow
        rings.add(ring)
    }
    function endRing(ring){
        if(!rings.delete(ring)) return
        scene.onBeforeRenderObservable.remove(ring._transformObserver)
        ring.dispose()
        if(stopped) cleanUpWhenDone()
    }

    function smokePuff(count, size, at){
        const puff = system("transformPuff", count, tex.smoke, ParticleSystem.BLENDMODE_STANDARD)
        puff.startPositionFunction = (m, pos) => at ? pos.set(at.x + rand(-0.3, 0.3), at.y + rand(-0.3, 0.3), at.z + rand(-0.3, 0.3)) : onBody(pos, 2)
        puff.startDirectionFunction = (m, dir) => dir.set(rand(-1, 1), rand(-0.2, 1), rand(-1, 1))
        puff.minEmitPower = 0.6
        puff.maxEmitPower = 1.8
        puff.addDragGradient(0, 0.6)
        puff.gravity = new Vector3(0, 0.4, 0)
        puff.minLifeTime = 0.9
        puff.maxLifeTime = 1.6
        sizeOverLife(puff, [[0, size * 0.35, size * 0.55], [1, size * 0.8, size]])
        puff.minInitialRotation = 0
        puff.maxInitialRotation = Math.PI * 2
        puff.minAngularSpeed = -0.8
        puff.maxAngularSpeed = 0.8
        puff.addColorGradient(0, c4(palette.smoke, 0.7))
        puff.addColorGradient(0.6, c4(palette.smoke, 0.4))
        puff.addColorGradient(1, c4(palette.smoke, 0))
        return oneShot(puff, count)
    }
    function emberBurst(count, power, at){
        const burst = embers(system("transformEmberBurst", count, tex.spark, ParticleSystem.BLENDMODE_ADD))
        burst.startPositionFunction = (m, pos) => at ? pos.copyFrom(at) : onBody(pos)
        burst.startDirectionFunction = (m, dir) => dir.set(rand(-1, 1), rand(-0.1, 1.2), rand(-1, 1))
        burst.minEmitPower = power * 0.45
        burst.maxEmitPower = power
        burst.addDragGradient(0, 0.5)
        burst.gravity = new Vector3(0, 0.3, 0)
        return oneShot(burst, count)
    }

    // ── the controls ──

    let breathTime = 0
    const tick = scene.onBeforeRenderObservable.add(() => {
        track()
        if(!burning) return
        const dt = scene.getAnimationRatio() / 60
        burnTime += dt
        breathTime += dt
        ringRadius = RING_RADIUS - (RING_RADIUS - RING_START) * Math.exp(-burnTime / RING_SPREAD)
        const breath = 1 + BREATH_DEPTH * Math.sin(breathTime * Math.PI * 2 * BREATH_RATE)
        // a wider front takes more fire to keep it unbroken
        const groundShare = 0.3 + 0.7 * (ringRadius / RING_RADIUS)
        continuous.forEach(ps => {
            ps.emitRate = ps._rate * intensity * breath * (ps._onGround ? groundShare : 1)
        })
    })

    track()

    // the fire catching - a burst of smoke and embers off the body hides it
    // dropping to the ground, and the ground fire starts running out
    function ignite(){
        if(burning || stopped) return
        burning = true
        continuous.forEach(ps => ps.start())
        smokePuff(36, 1.6)
        emberBurst(70, 4)
        shockRing(3.4, 0.6)
    }

    // the change breaking through at `at` (a point on the body - the back,
    // for wings): black feathers bursting off it and drifting down, embers,
    // smoke, a ring of spikes and a shock ring out along the ground
    function flare(at){
        if(stopped) return
        const from = at?.clone() ?? new Vector3((chest.a.x + chest.b.x) / 2, (chest.a.y + chest.b.y) / 2, (chest.a.z + chest.b.z) / 2)
        const feathers = system("transformFeathers", 48, tex.feather, ParticleSystem.BLENDMODE_STANDARD)
        feathers.startPositionFunction = (m, pos) => pos.set(from.x + rand(-0.25, 0.25), from.y + rand(-0.15, 0.3), from.z + rand(-0.25, 0.25))
        feathers.startDirectionFunction = (m, dir) => dir.set(rand(-1, 1), rand(0.2, 1.4), rand(-1, 1))
        feathers.minEmitPower = 2.5
        feathers.maxEmitPower = 5.5
        // flung out, then caught by the air and floating down
        feathers.addDragGradient(0, 0.9)
        feathers.gravity = new Vector3(0, -1.4, 0)
        feathers.minLifeTime = 2.6
        feathers.maxLifeTime = 4.2
        // no size gradient, so these two are the size - the image is a
        // square with the feather along its diagonal, so a feather is about
        // 1.4 times this long
        feathers.minSize = 0.22
        feathers.maxSize = 0.4
        feathers.minInitialRotation = 0
        feathers.maxInitialRotation = Math.PI * 2
        feathers.minAngularSpeed = -4
        feathers.maxAngularSpeed = 4
        feathers.addColorGradient(0, new Color4(1, 1, 1, 1))
        feathers.addColorGradient(0.8, new Color4(1, 1, 1, 1))
        feathers.addColorGradient(1, new Color4(1, 1, 1, 0))
        oneShot(feathers, 48)

        const spikeBurst = spikes(system("transformSpikeBurst", 36, tex.spike, ParticleSystem.BLENDMODE_STANDARD))
        spikeBurst.minEmitPower = 4
        spikeBurst.maxEmitPower = 6.5
        oneShot(spikeBurst, 36)

        smokePuff(30, 2, from)
        emberBurst(130, 7, from)
        shockRing(5.5, 0.85)
    }

    // 0 (out) to 1 (full); a little over 1 is a surge
    function setIntensity(next){
        intensity = Math.max(0, next)
    }

    // stop feeding it - what's burning burns out, then it all frees itself
    function stop(){
        if(stopped) return
        stopped = true
        burning = false
        continuous.forEach(ps => {
            ps.onAnimationEnd = () => setTimeout(() => release(ps), 0)
            ps.stop()
        })
        cleanUpWhenDone()
    }

    function cleanUpWhenDone(){
        if(disposed || systems.size || rings.size) return
        dispose()
    }

    // gone at once - the body it was burning on went away
    function dispose(){
        if(disposed) return
        disposed = true
        stopped = true
        burning = false
        scene.onBeforeRenderObservable.remove(tick)
        ;[...systems].forEach(ps => {
            systems.delete(ps)
            if(!scene.isDisposed) ps.dispose(false)
        })
        ;[...rings].forEach(endRing)
        noise.dispose()
        ringMat.dispose()
    }

    return {
        ignite,
        flare,
        setIntensity,
        stop,
        dispose,
        get stopped(){ return stopped },
    }
}
