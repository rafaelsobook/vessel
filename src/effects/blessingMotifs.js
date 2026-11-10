import { Color3, Color4, Constants, DynamicTexture, FresnelParameters, Mesh, MeshBuilder, ParticleSystem, StandardMaterial, Texture, Vector3 } from "@babylonjs/core"
import { addGlow } from "../tools/glow.js"
import { createBodyFireParticles, getParticleTexture, particleTexturePath } from "../tools/particlesystem.js"
import { addCameraTrauma } from "../tools/cameraShake.js"
import { fireParticles, firePalette, fireRing } from "./fireball.js"
import { sparkBurst } from "./blessingFx.js"
import { popShockRing } from "./shockRing.js"
import { prewarmSonicDistortion, shockRipple } from "./sonicDistortion.js"

// WHAT EACH BLESSING LOOKS LIKE GOING INTO YOU - the colours and the motif of
// every blessing in staticRecources/abilities.js (effects/blessingReveal.js
// runs the ceremony and plays them), and the pieces they're made of. Each
// colour is taken off the blessing's own picture (images/uniques/), each
// motif off what it says it does:
//   lifeblood   Osiris Hearth      a heart beating out of you, the hearth's fire at your feet
//   bluecore    Aether's Core      mana crystals circling you, drawn into your chest
//   goldenfort  Golden Fortitude   the ground slammed: gold shards, dust, a war lord's weight
//   devilspower Devils Power       black flames pouring up off you, red licks, a pool of red
//   chimastery  Chi Mastery        chi spiralling up you, a shield of it closing round you
//   warriorsun  Warrior Sun        a sunburst behind you, a ring of cosmos-dark stars round you
//   blueflame   Azure Pyre         you, alight with the blue fire for a breath
//   divineblade Divine Edge        two radiant blades crossing before you, light from above
//   divinefour  Four Heavens' Ward four lights from north, south, east and west, into you
//   fistdomain  Domain of the Fist three blows of force off your body, fighting spirit rising
//   moonpiece   Shard of the Moon  a shard of the moon falling into you, night mist round you
//   redemption  Blood Redemption   blood from all round drawn back into you, the pact sealed
// No lights (they recompile every material they touch); the glow layer and
// added (light) blending do the shine. Every particle system runs on
// updateSpeed 1/60 (fireball.js's fireParticles), so its numbers are real
// units, and frees itself once it's stopped and its last particle is gone.

// ── colours ──────────────────────────────────────────────────────────────────

const hex = text => Color3.FromHexString(text)
export const c4 = (color, alpha) => new Color4(color.r, color.g, color.b, alpha)
// core: white-hot, just tinted. main: its colour. deep: where it darkens -
// or, for the two whose picture is light against dark, that dark
const theme = (name, core, main, deep, motif, more = {}) => ({ name, core: hex(core), main: hex(main), deep: hex(deep), motif, ...more })
// the ceremony's own gold - the menus' (style.scss's rgb(240, 204, 128))
export const GOLD = hex("#F0CC80")

export const THEMES = {
    lifeblood:   theme("lifeblood",   "#FFE2DC", "#FF2B3D", "#8A0015", heartbeat),
    bluecore:    theme("bluecore",    "#E2FBFF", "#2FB2FF", "#1631C9", manaCrystals),
    goldenfort:  theme("goldenfort",  "#FFF5CF", "#FFC51F", "#A85A00", goldenEarth),
    devilspower: theme("devilspower", "#FFD2C4", "#FF2A12", "#3A0200", hellfire),
    chimastery:  theme("chimastery",  "#FFFBE2", "#FFD60A", "#D97400", chiSpiral),
    warriorsun:  theme("warriorsun",  "#FFFBE8", "#FFB627", "#2A1670", solarFlare, { cosmos: hex("#7A52FF") }),
    blueflame:   theme("blueflame",   "#E8FBFF", "#3A9DFF", "#4A17E0", azurePyre),
    divineblade: theme("divineblade", "#FFFBEA", "#FFD84D", "#B07800", crossedBlades),
    divinefour:  theme("divinefour",  "#FFFBE2", "#FFD34D", "#B06E00", fourHeavens),
    fistdomain:  theme("fistdomain",  "#FFF0C8", "#FF9A1F", "#6A2600", fistShockwaves),
    moonpiece:   theme("moonpiece",   "#FFFDE9", "#FFE485", "#2C2F7A", moonfall),
    redemption:  theme("redemption",  "#FFD9DC", "#FF1438", "#4A0010", bloodPact),
}
// a blessing added later with no look of its own yet: the ceremony's gold
const PLAIN = theme("plain", "#FFF8E6", "#F0CC80", "#9A6A20", goldenGlow)
export function themeOf(name){
    return THEMES[name] ?? PLAIN
}

// ── easing ───────────────────────────────────────────────────────────────────

export const easeOutCubic = t => 1 - Math.pow(1 - t, 3)
export const easeInCubic = t => t * t * t
export const easeInQuad = t => t * t
export const easeInOutSine = t => -(Math.cos(Math.PI * t) - 1) / 2
export const easeOutBack = t => {
    const c = 1.70158
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)
}
const rand = (a, b) => a + Math.random() * (b - a)

// ── time ─────────────────────────────────────────────────────────────────────

/**
 * step(t, elapsedMs) every frame for `ms` (t 0..1) - from `delay` on - then
 * onEnd. step returning false ends it early. Off the frame loop and
 * performance.now(), like every other effect here: it holds still while the
 * tab's hidden, and goes with the scene. Returns a function that ends it now.
 */
export function animate(scene, ms, step, { delay = 0, onEnd = null } = {}){
    if(!scene || scene.isDisposed){
        return () => {}
    }
    const start = performance.now() + delay
    let observer = null
    const finish = () => {
        if(!observer) return
        scene.onBeforeRenderObservable.remove(observer)
        observer = null
        try { onEnd?.() } catch(error){ console.error("[blessing fx] end", error) }
    }
    observer = scene.onBeforeRenderObservable.add(() => {
        const now = performance.now()
        if(now < start) return
        const t = ms > 0 ? Math.min(1, (now - start) / ms) : 1
        let keep = true
        // an exception in a frame's observer stops the engine queueing frames
        try { keep = step(t, now - start) !== false } catch(error){
            console.error("[blessing fx]", error)
            keep = false
        }
        if(t >= 1 || !keep) finish()
    })
    return finish
}
/** fn() `ms` from now, on the frame loop (see animate). */
export function later(scene, ms, fn){
    return animate(scene, 0, () => {}, { delay: ms, onEnd: fn })
}

// ── drawn textures ───────────────────────────────────────────────────────────

const textureCache = new WeakMap()   // scene -> Map(name -> texture)
function drawn(scene, name, width, height, draw){
    let byName = textureCache.get(scene)
    if(!byName) textureCache.set(scene, byName = new Map())
    let tex = byName.get(name)
    if(tex) return tex
    tex = new DynamicTexture(`bless.${name}`, { width, height }, scene, true)
    const ctx = tex.getContext()
    ctx.clearRect(0, 0, width, height)
    draw(ctx, width, height)
    tex.hasAlpha = true
    tex.update()
    tex.wrapU = Texture.CLAMP_ADDRESSMODE
    tex.wrapV = Texture.CLAMP_ADDRESSMODE
    byName.set(name, tex)
    return tex
}
function seeded(seed){
    return () => (seed = (seed * 16807) % 2147483647) / 2147483647
}

// a soft round light - halos, flashes, the comet's head
const dotTexture = scene => drawn(scene, "dot", 128, 128, (ctx, size) => {
    const c = size / 2
    const fill = ctx.createRadialGradient(c, c, 0, c, c, c)
    fill.addColorStop(0, "rgba(255,255,255,1)")
    fill.addColorStop(0.22, "rgba(255,255,255,0.7)")
    fill.addColorStop(0.5, "rgba(255,255,255,0.22)")
    fill.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = fill
    ctx.fillRect(0, 0, size, size)
})
// a sunburst: rays of uneven length and width, a glow in the middle
const raysTexture = scene => drawn(scene, "rays", 512, 512, (ctx, size) => {
    const c = size / 2
    const random = seeded(29)
    ctx.globalCompositeOperation = "lighter"
    const count = 22
    for(let i = 0; i < count; i++){
        const a = (i / count) * Math.PI * 2 + (random() - 0.5) * 0.14
        const length = c * (0.55 + random() * 0.45)
        const half = 0.022 + random() * 0.05
        const fill = ctx.createRadialGradient(c, c, 0, c, c, length)
        fill.addColorStop(0, "rgba(255,255,255,0.8)")
        fill.addColorStop(0.35, "rgba(255,255,255,0.42)")
        fill.addColorStop(1, "rgba(255,255,255,0)")
        ctx.fillStyle = fill
        ctx.beginPath()
        ctx.moveTo(c, c)
        ctx.arc(c, c, length, a - half, a + half)
        ctx.closePath()
        ctx.fill()
    }
    const heart = ctx.createRadialGradient(c, c, 0, c, c, c * 0.3)
    heart.addColorStop(0, "rgba(255,255,255,0.85)")
    heart.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = heart
    ctx.fillRect(0, 0, size, size)
})
// a four-point star - long thin spikes and a soft heart (a glint)
const starTexture = scene => drawn(scene, "star", 256, 256, (ctx, size) => {
    const c = size / 2
    const heart = ctx.createRadialGradient(c, c, 0, c, c, size * 0.2)
    heart.addColorStop(0, "rgba(255,255,255,1)")
    heart.addColorStop(0.3, "rgba(255,255,255,0.55)")
    heart.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = heart
    ctx.fillRect(0, 0, size, size)
    ;[[size * 0.5, size * 0.022], [size * 0.3, size * 0.014]].forEach(([reach, width], k) => {
        ctx.save()
        ctx.translate(c, c)
        ctx.rotate(k * Math.PI / 4)
        for(let q = 0; q < 4; q++){
            const spike = ctx.createLinearGradient(0, 0, reach, 0)
            spike.addColorStop(0, "rgba(255,255,255,1)")
            spike.addColorStop(1, "rgba(255,255,255,0)")
            ctx.fillStyle = spike
            ctx.beginPath()
            ctx.moveTo(0, -width)
            ctx.lineTo(reach, 0)
            ctx.lineTo(0, width)
            ctx.closePath()
            ctx.fill()
            ctx.rotate(Math.PI / 2)
        }
        ctx.restore()
    })
})
// a thin ring with a glow either side of it
const ringTexture = scene => drawn(scene, "ring", 256, 256, (ctx, size) => {
    const c = size / 2
    const fill = ctx.createRadialGradient(c, c, 0, c, c, c)
    fill.addColorStop(0, "rgba(255,255,255,0)")
    fill.addColorStop(0.6, "rgba(255,255,255,0)")
    fill.addColorStop(0.74, "rgba(255,255,255,0.3)")
    fill.addColorStop(0.8, "rgba(255,255,255,1)")
    fill.addColorStop(0.86, "rgba(255,255,255,0.3)")
    fill.addColorStop(0.97, "rgba(255,255,255,0)")
    ctx.fillStyle = fill
    ctx.fillRect(0, 0, size, size)
})
// a column of light (v 0 at its foot, 1 at its top): brightest down its
// middle, soft to its sides, full from just off the ground and thinning out
// to nothing at the top
const beamTexture = scene => drawn(scene, "beam", 64, 256, (ctx, width, height) => {
    const img = ctx.createImageData(width, height)
    for(let y = 0; y < height; y++){
        // the canvas's top row is v = 1
        const v = 1 - y / (height - 1)
        const along = Math.min(1, v / 0.04) * Math.pow(1 - v, 1.5)
        for(let x = 0; x < width; x++){
            const u = (x / (width - 1) - 0.5) / 0.22
            const a = along * Math.exp(-u * u)
            const i = (y * width + x) * 4
            img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
            img.data[i + 3] = Math.round(a * 255)
        }
    }
    ctx.putImageData(img, 0, 0)
})
// a heart, drawn in glowing line
const heartTexture = scene => drawn(scene, "heart", 256, 256, (ctx, size) => {
    const c = size / 2
    const k = size * 0.34
    const path = () => {
        ctx.beginPath()
        ctx.moveTo(c, c + k * 0.95)
        ctx.bezierCurveTo(c - k * 1.3, c + k * 0.15, c - k * 1.0, c - k * 1.0, c, c - k * 0.4)
        ctx.bezierCurveTo(c + k * 1.0, c - k * 1.0, c + k * 1.3, c + k * 0.15, c, c + k * 0.95)
        ctx.closePath()
    }
    ctx.lineJoin = "round"
    ctx.shadowColor = "rgba(255,255,255,1)"
    ;[[22, 0.3, 26], [11, 0.75, 14], [4.5, 1, 5]].forEach(([width, alpha, blur]) => {
        ctx.shadowBlur = blur
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`
        ctx.lineWidth = width
        path()
        ctx.stroke()
    })
})
// a crescent moon, glowing
const crescentTexture = scene => drawn(scene, "crescent", 256, 256, (ctx, size) => {
    const c = size / 2
    const r = size * 0.3
    ctx.shadowColor = "rgba(255,255,255,1)"
    ctx.shadowBlur = 26
    ctx.fillStyle = "rgba(255,255,255,1)"
    ctx.beginPath()
    ctx.arc(c, c, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.globalCompositeOperation = "destination-out"
    ctx.beginPath()
    ctx.arc(c + r * 0.48, c - r * 0.26, r * 0.9, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = "source-over"
})
// a blade's flash - a long streak, thickest in the middle, a white line down it
const slashTexture = scene => drawn(scene, "slash", 512, 64, (ctx, width, height) => {
    const m = height / 2
    ctx.shadowColor = "rgba(255,255,255,1)"
    ctx.shadowBlur = 14
    ctx.fillStyle = "rgba(255,255,255,0.85)"
    ctx.beginPath()
    ctx.moveTo(10, m)
    ctx.quadraticCurveTo(width / 2, m - height * 0.36, width - 10, m)
    ctx.quadraticCurveTo(width / 2, m + height * 0.36, 10, m)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = "rgba(255,255,255,1)"
    ctx.beginPath()
    ctx.moveTo(34, m)
    ctx.quadraticCurveTo(width / 2, m - height * 0.1, width - 34, m)
    ctx.quadraticCurveTo(width / 2, m + height * 0.1, 34, m)
    ctx.fill()
})
const TEXTURES = { dot: dotTexture, rays: raysTexture, star: starTexture, ring: ringTexture, beam: beamTexture, heart: heartTexture, crescent: crescentTexture, slash: slashTexture }

// ── materials ────────────────────────────────────────────────────────────────

const materialCache = new WeakMap()   // scene -> Map(key -> material)
function cached(scene, key, setup){
    let byKey = materialCache.get(scene)
    if(!byKey) materialCache.set(scene, byKey = new Map())
    let mat = byKey.get(key)
    if(!mat){
        mat = new StandardMaterial(`bless.${key}`, scene)
        setup(mat)
        byKey.set(key, mat)
    }
    return mat
}
function unlit(mat){
    mat.disableLighting = true
    mat.diffuseColor = Color3.Black()
    mat.specularColor = Color3.Black()
    // light isn't fogged - an added colour pulled toward the fog's only washes out
    mat.fogEnabled = false
}
function added(mat){
    unlit(mat)
    mat.alphaMode = Constants.ALPHA_ADD
    mat.disableDepthWrite = true
}

/** One of the drawn textures above, as light added on in `color` (shared per scene, texture and colour). */
export function lightMaterial(scene, tex, color){
    return cached(scene, `light.${tex}.${color.toHexString()}`, mat => {
        added(mat)
        mat.backFaceCulling = false
        mat.emissiveColor = color.clone()
        mat.opacityTexture = TEXTURES[tex](scene)
    })
}
// a shell of light - only its rim shows. Babylon ADDS the opacity Fresnel's
// term to the material's alpha (default.fragment: alpha += ...), so the alpha
// starts at nothing and the rim is all there is. Its alpha is 1 - |cos|^power:
// a power well under 1 keeps it to a thin rim (2.4 filled most of the disc -
// a solid ball from the camera)
function shellMaterial(scene, color){
    return cached(scene, `shell.${color.toHexString()}`, mat => {
        added(mat)
        mat.alpha = 0
        mat.emissiveColor = color.clone()
        mat.opacityFresnelParameters = new FresnelParameters({ leftColor: Color3.White(), rightColor: Color3.Black(), power: 0.45, bias: 0 })
    })
}
// a mana crystal - glassy, lit, its edges glowing
function crystalMaterial(scene, t){
    return cached(scene, `crystal.${t.main.toHexString()}`, mat => {
        mat.diffuseColor = t.deep.scale(0.4)
        mat.specularColor = new Color3(0.9, 0.95, 1)
        mat.specularPower = 96
        mat.emissiveColor = Color3.White()
        mat.emissiveFresnelParameters = new FresnelParameters({ leftColor: t.core, rightColor: t.main.scale(0.55), power: 1.6, bias: 0.1 })
        mat.alpha = 0.9
    })
}
// white-hot (the orb in your chest the cards go into)
export function hotMaterial(scene){
    return cached(scene, "hot", mat => {
        unlit(mat)
        mat.emissiveColor = Color3.White()
    })
}

// ── pieces ───────────────────────────────────────────────────────────────────

const at = where => typeof where === "function" ? where : () => where

/** A square of drawn light, facing the camera (or lying flat). group 1: over the bodies. */
export function lightPlane(scene, tex, color, { flat = false, group = 0, name = "bless.light" } = {}){
    const plane = flat
        ? MeshBuilder.CreateGround(name, { width: 1, height: 1 }, scene)
        : MeshBuilder.CreatePlane(name, { size: 1 }, scene)
    plane.isPickable = false
    plane.material = lightMaterial(scene, tex, color)
    if(!flat) plane.billboardMode = Mesh.BILLBOARDMODE_ALL
    plane.renderingGroupId = group
    return plane
}

/**
 * A drawn light popping at `where` (a point, or a function of one to
 * follow): from `from` to `to` metres across over `ms`, fading as it goes
 * (fade(t)), turning `spin` radians. stretch: wider than tall.
 */
export function popPlane(scene, tex, color, where, { from = 0.3, to = 2, ms = 400, alpha = 1, spin = 0, angle = 0, delay = 0, group = 1, flat = false, stretch = 1, ease = easeOutCubic, fade = t => 1 - t } = {}){
    if(!scene || scene.isDisposed) return null
    const plane = lightPlane(scene, tex, color, { flat, group })
    const place = at(where)
    plane.isVisible = false
    animate(scene, ms, t => {
        plane.isVisible = true
        const s = from + (to - from) * ease(t)
        if(flat) plane.scaling.set(s * stretch, 1, s)
        else plane.scaling.set(s * stretch, s, 1)
        plane.position.copyFrom(place())
        if(flat) plane.rotation.y = angle + spin * t
        else plane.rotation.z = angle + spin * t
        plane.visibility = Math.max(0, alpha * fade(t))
    }, { delay, onEnd: () => plane.dispose() })
    return plane
}

/**
 * A column of light on `feet`, `height` tall. mode "down": it comes down out
 * of the sky onto them, widens and fades. "up": it shoots up off them and
 * thins away. alpha: how strong (added light goes white fast).
 */
export function lightPillar(scene, feet, color, { height = 10, radius = 0.6, ms = 900, mode = "down", delay = 0, alpha = 0.8 } = {}){
    if(!scene || scene.isDisposed) return
    const footOf = at(feet)
    // an upright card of drawn light turned to the camera round its own
    // upright (the beam texture is soft to its sides): a column from any side
    const make = (name, mat) => {
        const mesh = MeshBuilder.CreatePlane(name, { size: 1 }, scene)
        mesh.isPickable = false
        mesh.material = mat
        mesh.billboardMode = Mesh.BILLBOARDMODE_Y
        mesh.isVisible = false
        return mesh
    }
    const outer = make("bless.pillar", lightMaterial(scene, "beam", color))
    const inner = make("bless.pillar.core", lightMaterial(scene, "beam", Color3.Lerp(color, Color3.White(), 0.75)))
    animate(scene, ms, t => {
        const foot = footOf()
        let bottom, top, r, fade
        if(mode === "down"){
            const land = 0.2
            const k = Math.min(1, t / land)
            const after = Math.max(0, (t - land) / (1 - land))
            top = foot.y + height
            bottom = top - height * easeInCubic(k)
            r = radius * (k < 1 ? 0.5 : 1 + 0.55 * easeOutCubic(after))
            fade = k < 1 ? 1 : Math.pow(1 - after, 1.5)
        } else {
            const rise = 0.22
            const k = Math.min(1, t / rise)
            const after = Math.max(0, (t - rise) / (1 - rise))
            bottom = foot.y
            top = foot.y + height * easeOutCubic(k)
            r = radius * (k < 1 ? 1 : 1 - 0.75 * easeOutCubic(after))
            fade = k < 1 ? 1 : 1 - after
        }
        const span = Math.max(0.02, top - bottom)
        // (the texture's light is in its middle half - the card is twice the column)
        ;[[outer, r * 4], [inner, r * 1.2]].forEach(([mesh, across]) => {
            mesh.isVisible = true
            mesh.position.set(foot.x, bottom + span / 2, foot.z)
            mesh.scaling.set(across, span, 1)
            mesh.visibility = fade * alpha
        })
    }, { delay, onEnd: () => { outer.dispose(); inner.dispose() } })
}

/** A shell of light closing round `center`: out past `radius`, settling, fading. */
export function shell(scene, center, color, { radius = 1.2, ms = 1100, delay = 0 } = {}){
    if(!scene || scene.isDisposed) return
    const centerOf = at(center)
    const sphere = MeshBuilder.CreateSphere("bless.shell", { diameter: 2, segments: 24 }, scene)
    sphere.isPickable = false
    sphere.material = shellMaterial(scene, color)
    sphere.isVisible = false
    animate(scene, ms, t => {
        sphere.isVisible = true
        const grow = Math.min(1, t / 0.24)
        sphere.scaling.setAll(radius * (0.35 + 0.65 * easeOutBack(grow)) * (1 + 0.025 * Math.sin(t * 34)))
        sphere.position.copyFrom(centerOf())
        sphere.visibility = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4
    }, { delay, onEnd: () => sphere.dispose() })
}

/**
 * Streaks of light pulled in to center() from all round - born out on a
 * sphere `reach` across, arriving as they die (darkSlash.js's charge, in a
 * blessing's colours). step(k) every frame: k 0..1, how hard it's pulling.
 */
export function inflow(scene, center, t, { reach = 2.2, life = 0.26, rate = [40, 420], capacity = 260 } = {}){
    const centerOf = at(center)
    const middle = centerOf().clone()
    const ps = fireParticles(scene, "bless.inflow", capacity, "thin1", middle)
    ps.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED
    ps.startPositionFunction = (matrix, position) => {
        // more from above than below - the ground's in the way down there
        const u = rand(-0.35, 1)
        const a = Math.random() * Math.PI * 2
        const r = Math.sqrt(1 - u * u)
        position.set(middle.x + Math.cos(a) * r * reach, middle.y + u * reach * 0.8, middle.z + Math.sin(a) * r * reach)
    }
    ps.startDirectionFunction = (matrix, direction, particle) => direction.set(middle.x - particle.position.x, middle.y - particle.position.y, middle.z - particle.position.z).scaleInPlace(1 / life)
    ps.minEmitPower = ps.maxEmitPower = 1
    ps.minLifeTime = ps.maxLifeTime = life
    ps.minScaleX = 0.03
    ps.maxScaleX = 0.06
    ps.minScaleY = 0.35
    ps.maxScaleY = 0.85
    ps.minSize = ps.maxSize = 1
    ps.addColorGradient(0, c4(t.main, 0))
    ps.addColorGradient(0.4, c4(t.main, 0.85))
    ps.addColorGradient(1, c4(t.core, 1))
    ps.emitRate = rate[0]
    ps.start()
    return {
        step(k){
            middle.copyFrom(centerOf())
            ps.emitRate = rate[0] + (rate[1] - rate[0]) * k
        },
        stop(){ ps.stop() },
    }
}

/** Sparks sucked in to center() off a sphere round it (zap.js's charge, in a blessing's colours). */
export function gather(scene, center, t, { radius = 1.1, rate = 150, capacity = 110 } = {}){
    const centerOf = at(center)
    const middle = centerOf().clone()
    const ps = fireParticles(scene, "bless.gather", capacity, "flare", middle)
    ps.createSphereEmitter(radius, 0)
    // inward - each one reaching the middle as it dies
    ps.minEmitPower = -radius / 0.3
    ps.maxEmitPower = -radius / 0.38
    ps.minLifeTime = 0.3
    ps.maxLifeTime = 0.36
    ps.addSizeGradient(0, 0.05, 0.12)
    ps.addSizeGradient(1, 0.01, 0.02)
    ps.color1 = c4(t.main, 1)
    ps.color2 = c4(t.core, 1)
    ps.colorDead = c4(t.main, 0)
    ps.emitRate = rate
    ps.start()
    return {
        step(){ middle.copyFrom(centerOf()) },
        stop(){ ps.stop() },
    }
}

/**
 * Ribbons of light drawn along paths: `strands` points moving along
 * path(t, phase, out) over `ms`, each leaving a fading trail of light (new
 * light laid along the whole way it moved since the last frame, so it's one
 * line, not dots).
 */
export function trails(scene, path, colors, { strands = 2, ms = 900, delay = 0, size = [0.07, 0.13], life = [0.3, 0.45], rate = 600, drift = 0.05 } = {}){
    if(!scene || scene.isDisposed) return
    const lines = []
    for(let i = 0; i < strands; i++){
        const prev = new Vector3(0, -1000, 0)
        const now = new Vector3(0, -1000, 0)
        const ps = fireParticles(scene, "bless.trail", Math.ceil(rate * life[1]) + 20, "flare", now)
        ps.startPositionFunction = (matrix, position) => Vector3.LerpToRef(prev, now, Math.random(), position)
        ps.startDirectionFunction = (matrix, direction) => direction.set(rand(-1, 1) * drift, rand(-1, 1) * drift, rand(-1, 1) * drift)
        ps.minEmitPower = ps.maxEmitPower = 1
        ps.minLifeTime = life[0]
        ps.maxLifeTime = life[1]
        ps.addSizeGradient(0, size[0], size[1])
        ps.addSizeGradient(1, 0, size[0] * 0.1)
        const [head, body, tail] = colors(i)
        ps.addColorGradient(0, c4(head, 1))
        ps.addColorGradient(0.4, c4(body, 0.9))
        ps.addColorGradient(1, c4(tail, 0))
        ps.emitRate = 0
        ps.start()
        lines.push({ ps, prev, now, phase: (i / strands) * Math.PI * 2, started: false })
    }
    animate(scene, ms, t => {
        lines.forEach(line => {
            line.prev.copyFrom(line.now)
            path(t, line.phase, line.now)
            // not from where it was parked before it started
            if(!line.started){
                line.prev.copyFrom(line.now)
                line.started = true
            }
            line.ps.emitRate = rate
        })
    }, { delay, onEnd: () => lines.forEach(({ ps }) => ps.stop()) })
}

/** Light spiralling up round feet() - chi, mana. */
export function helix(scene, feet, t, { strands = 2, turns = 2.2, height = 1.9, radius = 0.62, ms = 950, delay = 0, size = [0.07, 0.13] } = {}){
    const footOf = at(feet)
    trails(scene, (k, phase, out) => {
        const foot = footOf()
        const a = phase + k * turns * Math.PI * 2
        const r = radius * (1 - 0.35 * k)
        out.set(foot.x + Math.cos(a) * r, foot.y + 0.1 + easeInOutSine(k) * height, foot.z + Math.sin(a) * r)
    }, () => [t.core, t.main, t.deep], { strands, ms, delay, size })
}

/** Little lights rising off the ground round feet() for `ms`. */
export function motes(scene, feet, t, { ms = 1400, rate = 40, radius = 0.55, delay = 0, size = [0.04, 0.08] } = {}){
    if(!scene || scene.isDisposed) return
    const footOf = at(feet)
    const ps = fireParticles(scene, "bless.motes", Math.ceil(rate * 1.5) + 10, "flare", footOf().clone())
    ps.startPositionFunction = (matrix, position) => {
        const foot = footOf()
        const a = Math.random() * Math.PI * 2
        const r = radius * rand(0.5, 1.1)
        position.set(foot.x + Math.cos(a) * r, foot.y + Math.random() * 0.6, foot.z + Math.sin(a) * r)
    }
    ps.startDirectionFunction = (matrix, direction) => direction.set(rand(-0.15, 0.15), 1, rand(-0.15, 0.15))
    ps.minEmitPower = 0.6
    ps.maxEmitPower = 1.4
    ps.minLifeTime = 0.8
    ps.maxLifeTime = 1.4
    ps.addSizeGradient(0, size[0], size[1])
    ps.addSizeGradient(1, size[0] * 0.25, size[1] * 0.25)
    ps.addColorGradient(0, c4(t.core, 1))
    ps.addColorGradient(0.4, c4(t.main, 0.9))
    ps.addColorGradient(1, c4(t.deep, 0))
    ps.emitRate = 0
    ps.start()
    later(scene, delay, () => { ps.emitRate = rate })
    later(scene, delay + ms, () => ps.stop())
}

/** Flames rising round feet() in a blessing's colour - the power coming up off them. */
export function fireAura(scene, feet, t, { radius = 0.55, ms = 650, rate = 100, ring = true } = {}){
    if(!scene || scene.isDisposed) return
    fireRing(scene, at(feet)(), firePalette(t.main.toHexString()), { radius, ms, rate, ring, size: [0.2, 0.36] })
}

/**
 * Something bright flying from `from` to `to()` over `ms` - a head of light
 * (a drawn texture), a halo round it, a trail of light behind - then onHit(at).
 */
export function meteor(scene, from, to, t, { ms = 450, size = 0.4, tex = "dot", arc = 0, ease = easeInCubic, delay = 0, onHit = null } = {}){
    if(!scene || scene.isDisposed) return
    const target = at(to)
    const head = lightPlane(scene, tex, t.core, { group: 1 })
    const halo = lightPlane(scene, "dot", t.main, { group: 1 })
    head.isVisible = halo.isVisible = false
    const position = from.clone()
    const prev = from.clone()
    const trail = fireParticles(scene, "bless.meteor", 220, "flare", position)
    trail.startPositionFunction = (matrix, p) => Vector3.LerpToRef(prev, position, Math.random(), p)
    trail.startDirectionFunction = (matrix, d) => d.set(rand(-0.15, 0.15), rand(-0.15, 0.15), rand(-0.15, 0.15))
    trail.minEmitPower = trail.maxEmitPower = 1
    trail.minLifeTime = 0.25
    trail.maxLifeTime = 0.45
    trail.addSizeGradient(0, size * 0.55, size * 0.8)
    trail.addSizeGradient(1, 0, size * 0.08)
    trail.addColorGradient(0, c4(t.core, 1))
    trail.addColorGradient(0.35, c4(t.main, 0.85))
    trail.addColorGradient(1, c4(t.deep, 0))
    trail.renderingGroupId = 1
    trail.emitRate = 0
    trail.start()
    animate(scene, ms, k => {
        head.isVisible = halo.isVisible = true
        prev.copyFrom(position)
        const e = ease(k)
        Vector3.LerpToRef(from, target(), e, position)
        position.y += arc * Math.sin(Math.PI * e)
        head.position.copyFrom(position)
        halo.position.copyFrom(position)
        head.scaling.setAll(size)
        halo.scaling.setAll(size * 2.6)
        head.rotation.z += 0.15
        trail.emitRate = 380
    }, { delay, onEnd: () => {
        head.dispose()
        halo.dispose()
        trail.stop()
        onHit?.(position.clone())
    } })
}

/** A burst of `count` particles of `texture` thrown up and out of `from`, falling. */
function debris(scene, from, t, { texture = "rockTex", count = 26, power = [4, 7], size = [0.08, 0.2], life = [0.7, 1], gravity = -12, radius = 0.45, blend = ParticleSystem.BLENDMODE_ADD, colors = null } = {}){
    const ps = fireParticles(scene, "bless.debris", count + 4, texture, from.clone(), blend)
    ps.startPositionFunction = (matrix, position) => {
        const a = Math.random() * Math.PI * 2
        const r = radius * rand(0.3, 1)
        position.set(from.x + Math.cos(a) * r, from.y + 0.1, from.z + Math.sin(a) * r)
    }
    ps.startDirectionFunction = (matrix, direction, particle) => {
        direction.set(particle.position.x - from.x, 0, particle.position.z - from.z).normalize().scaleInPlace(rand(0.3, 0.7))
        direction.y = rand(0.8, 1.3)
    }
    ps.minEmitPower = power[0]
    ps.maxEmitPower = power[1]
    ps.minLifeTime = life[0]
    ps.maxLifeTime = life[1]
    ps.minSize = size[0]
    ps.maxSize = size[1]
    ps.minAngularSpeed = -6
    ps.maxAngularSpeed = 6
    ps.gravity = new Vector3(0, gravity, 0)
    const [a, b, dead] = colors ?? [c4(t.core, 1), c4(t.main, 1), c4(t.deep, 0)]
    ps.color1 = a
    ps.color2 = b
    ps.colorDead = dead
    ps.manualEmitCount = count
    ps.targetStopDuration = 0.1
    ps.start()
}

// ── the body lit up ──────────────────────────────────────────────────────────

const tints = new WeakMap()   // player -> { pulses, observer }

/**
 * `player`'s whole body washed in `color` (each mesh's overlay): up to `peak`
 * fast, fading over `ms` - white for the first `whiteFor` ms. Pulses that
 * overlap don't fight: the strongest one shows.
 */
export function tintBody(player, color, { peak = 0.6, ms = 420, attack = 0.08, whiteFor = 0, delay = 0 } = {}){
    const body = player?.body
    if(!body || body.isDisposed()) return
    const scene = body.getScene()
    let tint = tints.get(player)
    if(!tint){
        tint = { pulses: [], lit: [], observer: null }
        tints.set(player, tint)
        const meshes = () => (player.root?.getChildMeshes(false) ?? []).filter(mesh =>
            mesh !== player.skeletonMesh && mesh.isVisible && mesh.isEnabled() && mesh.material && mesh.getTotalVertices() > 0)
        tint.observer = scene.onBeforeRenderObservable.add(() => {
            const now = performance.now()
            tint.pulses = tint.pulses.filter(p => now < p.start + p.ms)
            let best = null
            let strength = 0
            tint.pulses.forEach(p => {
                if(now < p.start) return
                const k = (now - p.start) / p.ms
                const level = p.peak * (k < p.attack ? k / p.attack : 1 - (k - p.attack) / (1 - p.attack))
                if(level > strength){
                    strength = level
                    best = p
                }
            })
            if(!tint.pulses.length || body.isDisposed()){
                tint.lit.forEach(mesh => { if(!mesh.isDisposed()) mesh.renderOverlay = false })
                scene.onBeforeRenderObservable.remove(tint.observer)
                tints.delete(player)
                return
            }
            if(!tint.lit.length) tint.lit = meshes()
            const color = best && now - best.start < best.whiteFor ? Color3.White() : best?.color
            tint.lit.forEach(mesh => {
                // a blow's own flash (meleeCombat.js) wins while it lasts
                if(mesh.isDisposed() || mesh._hitFlashUntil > now) return
                mesh.renderOverlay = strength > 0.01
                if(color) mesh.overlayColor = color
                mesh.overlayAlpha = strength
            })
        })
    }
    tint.pulses.push({ start: performance.now() + delay, color, peak, ms, attack, whiteFor })
}

// ── ready before it's needed ─────────────────────────────────────────────────

const prewarmed = new WeakMap()   // scene -> Set(keys)

/**
 * The ceremony's shaders compiled and its pictures drawn ahead of it, so the
 * first one isn't invisible for a few frames while they compile. Every
 * material of a kind (a light in any colour and texture - the columns too -
 * or a shell) is one shader: one of each is enough. Resolves when it's done
 * (or couldn't be).
 */
export function prewarmBlessingMotifs(scene, themes){
    if(!scene || scene.isDisposed) return Promise.resolve()
    let done = prewarmed.get(scene)
    if(!done) prewarmed.set(scene, done = new Set())
    prewarmSonicDistortion(scene)
    ;["flare", "thin1", "smoke", "flame2", "rockTex"].forEach(name => getParticleTexture(scene, particleTexturePath(name)))
    Object.values(TEXTURES).forEach(draw => draw(scene))
    const jobs = []
    const meshes = []
    const job = (key, mat, make) => {
        if(done.has(key)) return
        done.add(key)
        const mesh = make()
        mesh.isVisible = false
        mesh.isPickable = false
        meshes.push(mesh)
        jobs.push(mat.forceCompilationAsync(mesh).catch(() => {}))
    }
    const plane = () => MeshBuilder.CreatePlane("bless.prewarm.plane", { size: 0.01 }, scene)
    const ball = () => MeshBuilder.CreateSphere("bless.prewarm.ball", { diameter: 0.01, segments: 4 }, scene)
    job("light", lightMaterial(scene, "dot", GOLD), plane)
    job("shell", shellMaterial(scene, GOLD), ball)
    job("hot", hotMaterial(scene), ball)
    const crystal = themes.find(t => t.motif === manaCrystals)
    if(crystal) job("crystal", crystalMaterial(scene, crystal), ball)
    // the particle shader, on one spark nobody will see
    sparkBurst(scene, new Vector3(0, -1000, 0), GOLD, { count: 1, power: 0, life: [0.05, 0.05] })
    return Promise.all(jobs).finally(() => meshes.forEach(mesh => mesh.dispose()))
}

// ── the motifs ───────────────────────────────────────────────────────────────
// Each is handed { scene, player, theme, chest(), feet(), head(), away() }:
// where their chest, feet and head are now, and away() - the way from the
// camera through them, flat (behind them, as you see them). Played the moment
// the blessing goes in, on top of the burst every blessing gets.

// OSIRIS HEARTH - a heart beating out of them, twice and twice again (lub-dub),
// the body flushing red with each beat; the hearth's fire round their feet
function heartbeat({ scene, player, theme: t, chest, feet }){
    const beat = (delay, strength) => {
        popPlane(scene, "heart", t.main, chest, { from: 0.35, to: 1.3 + 0.6 * strength, ms: 520, alpha: strength, delay, fade: k => Math.pow(1 - k, 1.4) })
        popPlane(scene, "heart", t.core, chest, { from: 0.3, to: 0.8 + 0.3 * strength, ms: 280, alpha: 0.85 * strength, delay })
        tintBody(player, t.main, { peak: 0.55 * strength, ms: 300, delay })
        later(scene, delay, () => popShockRing(scene, feet(), { size: 2.4 + strength * 1.6, seconds: 0.45, color: t.main }))
    }
    beat(0, 1)
    beat(200, 0.8)
    beat(820, 0.55)
    beat(1010, 0.42)
    fireRing(scene, feet(), firePalette(t.main.toHexString()), { radius: 0.62, ms: 800, rate: 110, size: [0.18, 0.32] })
    motes(scene, feet, t, { ms: 1500, rate: 34 })
}

// AETHER'S CORE - mana crystals springing up round them, circling, rising,
// then all drawn into their chest at once: a flash of mana, a shell of it
function manaCrystals({ scene, player, theme: t, chest, feet }){
    const count = 8
    const mat = crystalMaterial(scene, t)
    const shards = []
    for(let i = 0; i < count; i++){
        const shard = MeshBuilder.CreatePolyhedron("bless.crystal", { type: 1, size: 0.5 }, scene)
        shard.isPickable = false
        shard.material = mat
        shard.isVisible = false
        shard._glowColor = t.main
        addGlow(scene, shard, 0.8)
        shards.push({ shard, a: (i / count) * Math.PI * 2, h: 0.2 + (i % 4) * 0.36, size: rand(0.75, 1.2), turn: rand(-3, 3) })
    }
    const circling = 0.66
    const orbit = new Vector3()
    animate(scene, 1080, k => {
        const foot = feet()
        const middle = chest()
        shards.forEach(s => {
            s.shard.isVisible = true
            const a = s.a + k * 4.4
            const r = 1.05 * (1 - 0.15 * k)
            orbit.set(foot.x + Math.cos(a) * r, foot.y + s.h + k * 0.35, foot.z + Math.sin(a) * r)
            let grow
            if(k < circling){
                s.shard.position.copyFrom(orbit)
                grow = easeOutBack(Math.min(1, k / 0.14))
            } else {
                const pull = easeInCubic((k - circling) / (1 - circling))
                Vector3.LerpToRef(orbit, middle, pull, s.shard.position)
                grow = 1 - 0.85 * pull
            }
            s.shard.scaling.set(0.17 * s.size * grow, 0.55 * s.size * grow, 0.17 * s.size * grow)
            s.shard.rotation.y += 0.12
            s.shard.rotation.z = 0.25 * Math.sin(k * 6 + s.a) + s.turn * 0.05
        })
    }, { onEnd: () => {
        shards.forEach(({ shard }) => shard.dispose())
        sparkBurst(scene, chest(), t.core, { count: 26, power: 4.5, size: [0.05, 0.12], life: [0.2, 0.45] })
        shell(scene, chest, t.main, { radius: 0.95, ms: 560 })
        tintBody(player, t.main, { peak: 0.6, ms: 420, whiteFor: 50 })
        popShockRing(scene, feet(), { size: 3.4, seconds: 0.45, color: t.main })
    } })
    helix(scene, feet, t, { strands: 3, turns: 1.6, ms: 900, size: [0.06, 0.11] })
}

// GOLDEN FORTITUDE - the ground slammed: a ring of dust thrown out, gold
// shards flung up and falling, the war lord's weight felt through the camera
function goldenEarth({ scene, player, theme: t, chest, feet }){
    const foot = feet()
    popShockRing(scene, foot, { size: 5.6, seconds: 0.6, color: t.main })
    popShockRing(scene, foot, { size: 3.2, seconds: 0.4, color: t.core })
    shockRipple(scene, foot.add(new Vector3(0, 0.3, 0)), { radius: 4.5, ms: 520, strength: 0.6, thickness: 1, chroma: 0.5, rim: 0.3, tint: t.main })
    // the dust, rolling out low along the ground
    const dust = fireParticles(scene, "bless.dust", 44, "smoke", foot.clone(), ParticleSystem.BLENDMODE_STANDARD)
    dust.startPositionFunction = (matrix, position) => {
        const a = Math.random() * Math.PI * 2
        position.set(foot.x + Math.cos(a) * 0.4, foot.y + 0.1, foot.z + Math.sin(a) * 0.4)
    }
    dust.startDirectionFunction = (matrix, direction, particle) => {
        direction.set(particle.position.x - foot.x, 0, particle.position.z - foot.z).normalize()
        direction.y = rand(0.05, 0.25)
    }
    dust.minEmitPower = 2.4
    dust.maxEmitPower = 4.2
    dust.minLifeTime = 0.6
    dust.maxLifeTime = 1.1
    dust.addSizeGradient(0, 0.35, 0.5)
    dust.addSizeGradient(1, 1.1, 1.5)
    dust.minInitialRotation = -Math.PI
    dust.maxInitialRotation = Math.PI
    const earth = Color3.Lerp(t.deep, new Color3(0.32, 0.26, 0.16), 0.5)
    dust.addColorGradient(0, c4(earth, 0.5))
    dust.addColorGradient(1, c4(earth, 0))
    dust.manualEmitCount = 40
    dust.targetStopDuration = 0.15
    dust.start()
    debris(scene, foot, t, { texture: "rockTex", count: 28 })
    motes(scene, feet, t, { ms: 1100, rate: 30 })
    tintBody(player, t.main, { peak: 0.6, ms: 700 })
    addCameraTrauma(scene, 0.25)
}

// DEVILS POWER - black flames pouring up off them, red licks rising through
// it, a pool of red spreading under them, the body gone dark red
function hellfire({ scene, player, theme: t, chest, feet }){
    const foot = feet()
    const around = (position, spread, up) => {
        const f = feet()
        const a = Math.random() * Math.PI * 2
        const r = spread * rand(0.35, 1)
        position.set(f.x + Math.cos(a) * r, f.y + 0.05 + Math.random() * up, f.z + Math.sin(a) * r)
    }
    const flames = fireParticles(scene, "bless.hell.flames", 240, "smoke", foot.clone(), ParticleSystem.BLENDMODE_STANDARD)
    flames.startPositionFunction = (matrix, position) => around(position, 0.55, 0.5)
    flames.startDirectionFunction = (matrix, direction) => direction.set(rand(-0.15, 0.15), 1, rand(-0.15, 0.15))
    flames.minEmitPower = 1.6
    flames.maxEmitPower = 3
    flames.minLifeTime = 0.45
    flames.maxLifeTime = 0.8
    flames.minInitialRotation = -Math.PI
    flames.maxInitialRotation = Math.PI
    flames.minAngularSpeed = -2
    flames.maxAngularSpeed = 2
    flames.addSizeGradient(0, 0.28, 0.42)
    flames.addSizeGradient(1, 0.75, 1.1)
    const ink = t.deep.scale(0.35)
    flames.addColorGradient(0, c4(ink, 0))
    flames.addColorGradient(0.12, c4(ink, 0.9))
    flames.addColorGradient(0.6, c4(t.deep, 0.55))
    flames.addColorGradient(1, c4(t.deep, 0))
    flames.emitRate = 210
    flames.start()
    const licks = fireParticles(scene, "bless.hell.licks", 200, "thin1", foot.clone())
    licks.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED
    licks.startPositionFunction = (matrix, position) => around(position, 0.5, 0.6)
    licks.startDirectionFunction = flames.startDirectionFunction
    licks.minEmitPower = 3
    licks.maxEmitPower = 6.5
    licks.minLifeTime = 0.18
    licks.maxLifeTime = 0.36
    licks.minScaleX = 0.04
    licks.maxScaleX = 0.08
    licks.minScaleY = 0.4
    licks.maxScaleY = 0.9
    licks.minSize = licks.maxSize = 1
    licks.addColorGradient(0, c4(t.core, 0.9))
    licks.addColorGradient(0.35, c4(t.main, 0.85))
    licks.addColorGradient(1, c4(t.deep, 0))
    licks.emitRate = 170
    licks.start()
    later(scene, 950, () => {
        flames.stop()
        licks.stop()
    })
    popPlane(scene, "dot", t.main, () => feet().add(new Vector3(0, 0.05, 0)), { flat: true, group: 0, from: 0.5, to: 3.4, ms: 1200, alpha: 0.75, fade: k => k < 0.25 ? 1 : 1 - (k - 0.25) / 0.75 })
    popShockRing(scene, foot, { size: 4.2, seconds: 0.5, color: t.main })
    tintBody(player, Color3.Lerp(t.main, t.deep, 0.55), { peak: 0.7, ms: 1000 })
}

// CHI MASTERY - chi spiralling up round them, two strands, then a shield of it
// closing round them (the protective aura)
function chiSpiral({ scene, player, theme: t, chest, feet }){
    helix(scene, feet, t, { strands: 2, turns: 2.4, ms: 900, radius: 0.7, height: 2.05, size: [0.08, 0.14] })
    shell(scene, chest, t.main, { radius: 1.25, ms: 1250, delay: 380 })
    later(scene, 380, () => {
        popShockRing(scene, feet(), { size: 3.8, seconds: 0.45, color: t.main })
        tintBody(player, t.main, { peak: 0.45, ms: 520 })
    })
}

// WARRIOR SUN - a sunburst flaring behind them, searing sparks thrown up, and a
// ring of cosmos-dark stars circling them (the blade of the sun, the shield of
// the cosmos)
function solarFlare({ scene, player, theme: t, chest, feet, away }){
    popPlane(scene, "rays", t.main, () => chest().add(away().scale(0.6)), { group: 0, from: 0.8, to: 4.6, ms: 1150, spin: 0.9, fade: k => k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85 })
    popPlane(scene, "dot", t.core, chest, { from: 0.3, to: 2.4, ms: 420, alpha: 0.9 })
    sparkBurst(scene, chest(), t.main, { count: 40, power: 6.5, size: [0.06, 0.15], life: [0.3, 0.7] })
    const cosmos = t.cosmos ?? t.deep
    trails(scene, (k, phase, out) => {
        const middle = chest()
        const a = phase + k * Math.PI * 2 * 1.6
        out.set(middle.x + Math.cos(a) * 1.05, middle.y + Math.sin(a * 2 + phase) * 0.18, middle.z + Math.sin(a) * 1.05)
    }, i => i % 2 ? [Color3.White(), cosmos, t.deep] : [t.core, cosmos, t.deep], { strands: 3, ms: 1300, size: [0.06, 0.12], life: [0.35, 0.6] })
    tintBody(player, t.main, { peak: 0.5, ms: 600 })
}

// AZURE PYRE - they catch the blue fire themselves for a breath (the same
// fire their hits will set on enemies - particlesystem.js's createAzureFire),
// a ring of it round their feet
function azurePyre({ scene, player, theme: t, feet }){
    const fire = createBodyFireParticles(player.body, scene, 1.5, 0.6, "blue")
    later(scene, 1300, () => fire.dispose())
    fireRing(scene, feet(), firePalette("blue"), { radius: 0.85, ms: 550, rate: 170, size: [0.25, 0.42] })
    popShockRing(scene, feet(), { size: 4, seconds: 0.5, color: t.main })
    tintBody(player, t.main, { peak: 0.5, ms: 650 })
}

// DIVINE EDGE - two radiant blades crossing before them, one stroke and the
// other, a glint where they cross; light coming down on them from above
function crossedBlades({ scene, player, theme: t, chest, feet, away }){
    const front = () => chest().subtract(away().scale(0.45))
    const stroke = (angle, delay) => {
        ;[[t.main, 0.32], [t.core, 0.13]].forEach(([color, thick]) => {
            const plane = lightPlane(scene, "slash", color, { group: 1 })
            plane.isVisible = false
            animate(scene, 380, k => {
                plane.isVisible = true
                const length = 2.6 * easeOutCubic(Math.min(1, k / 0.22))
                plane.scaling.set(length, length * thick * (1 - 0.6 * k) + 0.02, 1)
                plane.rotation.z = angle
                plane.position.copyFrom(front())
                plane.visibility = k < 0.22 ? 1 : 1 - (k - 0.22) / 0.78
            }, { delay, onEnd: () => plane.dispose() })
        })
        later(scene, delay, () => addCameraTrauma(scene, 0.14))
    }
    stroke(Math.PI / 4, 0)
    stroke(-Math.PI / 4, 110)
    popPlane(scene, "star", t.core, front, { from: 0.4, to: 2.6, ms: 320, spin: 0.7, delay: 170 })
    lightPillar(scene, feet, t.main, { height: 9, radius: 0.2, ms: 650, mode: "down", alpha: 0.75 })
    sparkBurst(scene, chest(), t.main, { count: 30, power: 6, size: [0.05, 0.13], life: [0.25, 0.55] })
    tintBody(player, t.core, { peak: 0.55, ms: 450, delay: 110 })
}

// FOUR HEAVENS' WARD - four lights from north, east, south and west, each
// marked by light coming down where it starts, flying in to them together;
// a ward of light closing round them as they meet (the ward itself shows once
// the ceremony's over - blessingEffects.js)
function fourHeavens({ scene, player, theme: t, chest, feet }){
    const middle = chest()
    const FLY_AT = 260
    const FLY_MS = 520
    for(let i = 0; i < 4; i++){
        const a = (i * Math.PI) / 2
        const start = middle.add(new Vector3(Math.cos(a) * 2.4, 0.7, Math.sin(a) * 2.4))
        popPlane(scene, "star", t.core, start, { from: 0.2, to: 1.5, ms: 300, spin: 0.6 })
        lightPillar(scene, () => new Vector3(start.x, feet().y, start.z), t.main, { height: 3.2, radius: 0.09, ms: 650, mode: "down", alpha: 0.65 })
        meteor(scene, start, chest, t, { ms: FLY_MS, size: 0.3, delay: FLY_AT + i * 40, arc: 0.35, onHit: hitAt => sparkBurst(scene, hitAt, t.core, { count: 10, power: 3, size: [0.04, 0.09], life: [0.15, 0.35] }) })
    }
    later(scene, FLY_AT + 120 + FLY_MS, () => {
        popShockRing(scene, feet(), { size: 4.4, seconds: 0.5, color: t.main })
        shell(scene, chest, t.main, { radius: 1.0, ms: 650 })
        tintBody(player, t.main, { peak: 0.6, ms: 450, whiteFor: 50 })
    })
}

// DOMAIN OF THE FIST - three blows of force off their body, one on the other
// (a ring of force, the air bent round it, the ground ringing), the third
// white-hot; the fighting spirit rising off them in flame
function fistShockwaves({ scene, player, theme: t, chest, feet }){
    for(let i = 0; i < 3; i++){
        later(scene, i * 150, () => {
            const middle = chest()
            popPlane(scene, "ring", i === 2 ? t.core : t.main, chest, { from: 0.4, to: 2.4 + i * 0.6, ms: 340 })
            popShockRing(scene, feet(), { size: 3 + i, seconds: 0.35, color: t.main })
            shockRipple(scene, middle, { radius: 2.4 + i * 0.7, ms: 340, strength: 0.55, thickness: 0.7, chroma: 0.7, rim: 0.25, tint: t.main })
            addCameraTrauma(scene, 0.16)
            tintBody(player, i === 2 ? Color3.White() : t.main, { peak: 0.5, ms: 220 })
        })
    }
    fireRing(scene, feet(), firePalette(t.main.toHexString()), { radius: 0.5, ms: 750, rate: 140, ring: false, size: [0.22, 0.38] })
}

// SHARD OF THE MOON - a shard of the moon falling out of the sky into them;
// where it lands, night: a mist the colour of it rolling out round their
// feet, pale lights rising
function moonfall({ scene, player, theme: t, chest, feet, away }){
    const sky = chest().add(new Vector3(0, 8, 0)).addInPlace(away().scale(2))
    meteor(scene, sky, chest, t, { tex: "crescent", size: 0.9, ms: 560, ease: easeInQuad, onHit: hitAt => {
        popPlane(scene, "dot", t.core, hitAt, { from: 0.3, to: 2.6, ms: 380 })
        popShockRing(scene, feet(), { size: 4.2, seconds: 0.55, color: t.main })
        const foot = feet()
        const mist = fireParticles(scene, "bless.mist", 40, "smoke", foot.clone(), ParticleSystem.BLENDMODE_STANDARD)
        mist.startPositionFunction = (matrix, position) => {
            const a = Math.random() * Math.PI * 2
            position.set(foot.x + Math.cos(a) * 0.5, foot.y + 0.15, foot.z + Math.sin(a) * 0.5)
        }
        mist.startDirectionFunction = (matrix, direction, particle) => {
            direction.set(particle.position.x - foot.x, 0, particle.position.z - foot.z).normalize()
            direction.y = rand(0, 0.15)
        }
        mist.minEmitPower = 0.8
        mist.maxEmitPower = 1.8
        mist.minLifeTime = 1.3
        mist.maxLifeTime = 2
        mist.addSizeGradient(0, 0.5, 0.7)
        mist.addSizeGradient(1, 1.5, 2)
        mist.minInitialRotation = -Math.PI
        mist.maxInitialRotation = Math.PI
        mist.addColorGradient(0, c4(t.deep, 0))
        mist.addColorGradient(0.2, c4(t.deep, 0.5))
        mist.addColorGradient(1, c4(t.deep, 0))
        mist.manualEmitCount = 30
        mist.targetStopDuration = 0.2
        mist.start()
        motes(scene, feet, t, { ms: 1600, rate: 30, radius: 0.9 })
        tintBody(player, t.core, { peak: 0.55, ms: 600 })
    } })
}

// BLOOD REDEMPTION - the blood comes back: dark drops from all round drawn
// into them, then the pact sealed in a wave of red
function bloodPact({ scene, player, theme: t, chest, feet }){
    const middle = chest().clone()
    const life = 0.42
    // dark drops, drawn over (not added on) - so a sprite with real alpha:
    // images/particles' flare sits on opaque black
    const drops = fireParticles(scene, "bless.blood", 160, dotTexture(scene), middle, ParticleSystem.BLENDMODE_STANDARD)
    drops.startPositionFunction = (matrix, position) => {
        const u = rand(-0.3, 1)
        const a = Math.random() * Math.PI * 2
        const r = Math.sqrt(1 - u * u)
        position.set(middle.x + Math.cos(a) * r * 2.4, middle.y + u * 1.8, middle.z + Math.sin(a) * r * 2.4)
    }
    drops.startDirectionFunction = (matrix, direction, particle) => direction.set(middle.x - particle.position.x, middle.y - particle.position.y, middle.z - particle.position.z).scaleInPlace(1 / life)
    drops.minEmitPower = drops.maxEmitPower = 1
    drops.minLifeTime = drops.maxLifeTime = life
    drops.addSizeGradient(0, 0.07, 0.13)
    drops.addSizeGradient(1, 0.04, 0.07)
    drops.addColorGradient(0, c4(t.deep, 0))
    drops.addColorGradient(0.3, c4(t.deep, 0.95))
    drops.addColorGradient(1, c4(t.main, 0.95))
    drops.emitRate = 280
    drops.start()
    animate(scene, 450, () => middle.copyFrom(chest()), { onEnd: () => drops.stop() })
    later(scene, 470, () => {
        popShockRing(scene, feet(), { size: 6.2, seconds: 0.75, color: t.main })
        popPlane(scene, "star", t.main, chest, { from: 0.5, to: 3.2, ms: 400, spin: 0.5 })
        sparkBurst(scene, chest(), t.main, { count: 60, power: 6, size: [0.08, 0.2], life: [0.4, 0.9] })
        tintBody(player, t.main, { peak: 0.7, ms: 650 })
        addCameraTrauma(scene, 0.25)
    })
}

// anything with no look of its own yet: a ring of gold and light rising
function goldenGlow({ scene, player, theme: t, chest, feet }){
    popShockRing(scene, feet(), { size: 4, seconds: 0.5, color: t.main })
    helix(scene, feet, t, { strands: 2, turns: 1.8, ms: 800 })
    tintBody(player, t.main, { peak: 0.5, ms: 500 })
}
