import { Color3, Color4, Constants, DynamicTexture, FresnelParameters, Material, Mesh, MeshBuilder, ParticleSystem, Quaternion, StandardMaterial, Texture, Vector2, Vector3 } from "@babylonjs/core"
import { addGlow } from "../tools/glow.js"
import { getParticleTexture, particleTexturePath } from "../tools/particlesystem.js"
import { fireParticles } from "./fireball.js"
import { popShockRing } from "./shockRing.js"
import { sparkBurst } from "./blessingFx.js"
import { prewarmSonicDistortion, shockRipple, trackRipple } from "./sonicDistortion.js"

// THE SONIC BOOM, ENEMY TO PLAYER (enemies/rangeAttack.js runs the timeline -
// the orangelith's ranged attack):
//  1. the charge - the stone hums itself up: rings of sound collapse into a
//     white-hot point before it, sparks drawn in, stones lift off the ground
//     round it and hang there, the ground throbbing under it
//  2. the lock - the lane the boom will tear down lights up along the ground,
//     following it over every rise, chevrons racing down it
//  3. the boom - a flash, a vapor cone bursting off the point (the cloud a jet
//     wears going through the sound barrier), a condensation disc, the hanging
//     stones flung down the lane, the air itself bent out in a ring
//     (effects/sonicDistortion.js)
//  4. the wave - flaring shells of sound tearing down the lane, streaks
//     racing alongside, dust kicked up off the ground under it, the air
//     bending round it as it goes
// What it does to whoever it catches: effects/concussed.js.
// Any colour (sonicPalette - orange, blue, purple, green, white or a
// "#rrggbb"). No lights - the glow layer (tools/glow.js) does the shine.
// Every particle system runs on updateSpeed 1/60, so its numbers are real
// units: lifetimes in seconds, rates per second, speeds in units per second.

// ── palettes ─────────────────────────────────────────────────────────────────

// core: the white-hot heart. hot: the shells' bright edge. mid: the colour.
// edge: where it fades. dust: the ground it kicks up. glow: what it blooms
const c3 = (r, g, b) => new Color3(r, g, b)
const PALETTES = {
    orange: { core: c3(1, 0.97, 0.88), hot: c3(1, 0.8, 0.45),  mid: c3(1, 0.5, 0.12),   edge: c3(0.7, 0.22, 0.04), dust: c3(0.56, 0.47, 0.36), glow: c3(1, 0.48, 0.1) },
    blue:   { core: c3(0.92, 0.98, 1), hot: c3(0.6, 0.88, 1),  mid: c3(0.24, 0.58, 1),  edge: c3(0.08, 0.18, 0.6), dust: c3(0.5, 0.52, 0.56),  glow: c3(0.28, 0.58, 1) },
    purple: { core: c3(1, 0.92, 1),    hot: c3(0.92, 0.62, 1), mid: c3(0.6, 0.25, 1),   edge: c3(0.28, 0.05, 0.5), dust: c3(0.5, 0.46, 0.54),  glow: c3(0.66, 0.3, 1) },
    green:  { core: c3(0.95, 1, 0.88), hot: c3(0.72, 1, 0.5),  mid: c3(0.3, 0.9, 0.2),  edge: c3(0.06, 0.4, 0.08), dust: c3(0.48, 0.52, 0.4),  glow: c3(0.36, 1, 0.22) },
    white:  { core: c3(1, 1, 1),       hot: c3(0.94, 0.97, 1), mid: c3(0.72, 0.82, 1), edge: c3(0.4, 0.48, 0.65), dust: c3(0.58, 0.56, 0.52), glow: c3(0.8, 0.88, 1) },
}
PALETTES.red = PALETTES.orange
PALETTES.amber = PALETTES.orange
PALETTES.cyan = PALETTES.blue
PALETTES.violet = PALETTES.purple

/** The boom's colours by name - or worked out from any "#rrggbb". */
export function sonicPalette(color = "orange"){
    const name = String(color ?? "orange").toLowerCase()
    if(PALETTES[name]) return { ...PALETTES[name], name }
    if(/^#[0-9a-f]{6}$/.test(name)){
        const mid = Color3.FromHexString(name)
        return {
            name,
            core: Color3.Lerp(mid, Color3.White(), 0.85),
            hot: Color3.Lerp(mid, Color3.White(), 0.45),
            mid,
            edge: mid.scale(0.5),
            dust: Color3.Lerp(mid, new Color3(0.55, 0.5, 0.45), 0.8),
            glow: mid.clone(),
        }
    }
    return { ...PALETTES.orange, name: "orange" }
}

// ── shared bits ──────────────────────────────────────────────────────────────

const UPDATE_SPEED = 1 / 60
const c4 = (color, alpha) => new Color4(color.r, color.g, color.b, alpha)
const VAPOR = new Color3(0.86, 0.88, 0.92)

const materialCache = new WeakMap()   // scene -> Map(key -> material)
function material(scene, key, setup){
    let byKey = materialCache.get(scene)
    if(!byKey) materialCache.set(scene, byKey = new Map())
    let mat = byKey.get(key)
    if(!mat || mat.isDisposed?.()){
        mat = new StandardMaterial(key, scene)
        mat.disableLighting = true
        mat.diffuseColor = Color3.Black()
        mat.specularColor = Color3.Black()
        setup(mat)
        byKey.set(key, mat)
    }
    return mat
}
function additive(mat){
    mat.alphaMode = Constants.ALPHA_ADD
    mat.transparencyMode = Material.MATERIAL_ALPHABLEND
    mat.disableDepthWrite = true
    mat.backFaceCulling = false
}

const textureCache = new WeakMap()   // scene -> Map(name -> texture)
function drawn(scene, name, width, height, draw, { wrapU = false } = {}){
    let byName = textureCache.get(scene)
    if(!byName) textureCache.set(scene, byName = new Map())
    let tex = byName.get(name)
    if(tex) return tex
    tex = new DynamicTexture(`sonic.${name}`, { width, height }, scene, true)
    const ctx = tex.getContext()
    ctx.clearRect(0, 0, width, height)
    draw(ctx, width, height)
    tex.hasAlpha = true
    tex.update()
    tex.wrapU = wrapU ? Texture.WRAP_ADDRESSMODE : Texture.CLAMP_ADDRESSMODE
    tex.wrapV = Texture.CLAMP_ADDRESSMODE
    byName.set(name, tex)
    return tex
}
function seeded(seed){
    return () => (seed = (seed * 16807) % 2147483647) / 2147483647
}

function noPick(mesh){
    mesh.isPickable = false
    return mesh
}
function dropGlow(mesh){
    mesh?._glowLayer?.removeIncludedOnlyMesh(mesh)
}
function billboard(scene, name, mat){
    const plane = noPick(MeshBuilder.CreatePlane(name, { size: 1 }, scene))
    plane.material = mat
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL
    return plane
}
// a plane facing `dir` - flat across the way the boom goes
function facing(scene, name, mat, at, dir){
    const plane = noPick(MeshBuilder.CreatePlane(name, { size: 1, sideOrientation: Mesh.DOUBLESIDE }, scene))
    plane.material = mat
    plane.position.copyFrom(at)
    plane.lookAt(at.add(dir))
    return plane
}
// a tube along `dir`, its +y end (the wide end, `top`) leading
const tubeQuaternion = dir => {
    const q = new Quaternion()
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), dir.normalizeToNew(), q)
    return q
}
function tube(scene, name, mat, { top = 1, bottom = 0.8, tessellation = 48 } = {}){
    const mesh = noPick(MeshBuilder.CreateCylinder(name, { height: 1, diameterTop: top, diameterBottom: bottom, tessellation, cap: Mesh.NO_CAP, sideOrientation: Mesh.DOUBLESIDE }, scene))
    mesh.material = mat
    return mesh
}

// ── drawn textures ───────────────────────────────────────────────────────────

// a ring of sound: a bright band, a soft glow either side, a fainter echo
// inside it
const ringTexture = scene => drawn(scene, "ring", 256, 256, (ctx, size) => {
    const c = size / 2
    const band = (r, width, alpha) => {
        ctx.lineWidth = width
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`
        ctx.beginPath()
        ctx.arc(c, c, r, 0, Math.PI * 2)
        ctx.stroke()
    }
    band(size * 0.43, size * 0.11, 0.12)
    band(size * 0.43, size * 0.055, 0.35)
    band(size * 0.43, size * 0.022, 1)
    band(size * 0.31, size * 0.03, 0.22)
    band(size * 0.31, size * 0.01, 0.5)
})
// a soft cloud ring - the condensation disc
const vaporTexture = scene => drawn(scene, "vapor", 256, 256, (ctx, size) => {
    const c = size / 2
    const random = seeded(23)
    const disc = ctx.createRadialGradient(c, c, size * 0.08, c, c, size * 0.48)
    disc.addColorStop(0, "rgba(255,255,255,0)")
    disc.addColorStop(0.55, "rgba(255,255,255,0.25)")
    disc.addColorStop(0.82, "rgba(255,255,255,0.7)")
    disc.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = disc
    ctx.fillRect(0, 0, size, size)
    // puffs round the rim, so it reads as cloud, not a clean line
    for(let i = 0; i < 40; i++){
        const a = random() * Math.PI * 2
        const d = size * (0.36 + random() * 0.08)
        const r = size * (0.03 + random() * 0.05)
        const x = c + Math.cos(a) * d
        const y = c + Math.sin(a) * d
        const puff = ctx.createRadialGradient(x, y, 0, x, y, r)
        puff.addColorStop(0, `rgba(255,255,255,${0.25 + random() * 0.3})`)
        puff.addColorStop(1, "rgba(255,255,255,0)")
        ctx.fillStyle = puff
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
    }
})
// a shell of the wave, round a tube: v runs along it, the leading edge
// (v = 1, the canvas top) a hard bright line, glowing back from it and
// fading, a faint echo behind - broken up round the tube so it shimmers
const shellTexture = scene => drawn(scene, "shell", 128, 256, (ctx, w, h) => {
    const random = seeded(31)
    for(let x = 0; x < w; x += 2){
        const k = 0.6 + random() * 0.4
        const grad = ctx.createLinearGradient(0, 0, 0, h)
        grad.addColorStop(0, `rgba(255,255,255,0)`)
        grad.addColorStop(0.04, `rgba(255,255,255,${k})`)
        grad.addColorStop(0.09, `rgba(255,255,255,${0.55 * k})`)
        grad.addColorStop(0.35, `rgba(255,255,255,${0.16 * k})`)
        grad.addColorStop(0.52, `rgba(255,255,255,${0.32 * k})`)
        grad.addColorStop(0.6, `rgba(255,255,255,${0.08 * k})`)
        grad.addColorStop(1, "rgba(255,255,255,0)")
        ctx.fillStyle = grad
        ctx.fillRect(x, 0, 2, h)
    }
})
// the vapor cone: streaks running along it, thick at the point, thinning out
// to nothing at its open end (v = 1, the canvas top)
const streakTexture = scene => drawn(scene, "streaks", 256, 256, (ctx, w, h) => {
    const random = seeded(41)
    for(let i = 0; i < 90; i++){
        const x = random() * w
        const width = 1 + random() * 5
        const reach = 0.45 + random() * 0.55
        const alpha = 0.15 + random() * 0.4
        const grad = ctx.createLinearGradient(0, h, 0, h * (1 - reach))
        grad.addColorStop(0, `rgba(255,255,255,0)`)
        grad.addColorStop(0.1, `rgba(255,255,255,${alpha})`)
        grad.addColorStop(1, "rgba(255,255,255,0)")
        ctx.fillStyle = grad
        ctx.fillRect(x, h * (1 - reach), width, h * reach)
    }
}, { wrapU: true })
// the lane: u runs down it (tiled), v across - a bright edge each side with a
// glow inside it, a faint wash between, chevrons pointing down it. Drawn once
// per scene; each lane gets its own handle on the one image (laneMaterial) -
// a handle's offset and tiling are its own, so each lane's chevrons scroll on
// their own (and a DynamicTexture's clone() comes back blank)
const laneImages = new WeakMap()   // scene -> { url, name, keeper }
function laneImage(scene){
    let image = laneImages.get(scene)
    if(image) return image
    const canvas = document.createElement("canvas")
    canvas.width = 256
    canvas.height = 128
    drawLane(canvas.getContext("2d"), canvas.width, canvas.height)
    image = { url: canvas.toDataURL("image/png"), name: "sonic.lane.image" }
    // held for the scene's life: while any handle's alive, the image stays loaded
    image.keeper = laneHandle(scene, image)
    laneImages.set(scene, image)
    return image
}
function laneHandle(scene, image){
    const tex = Texture.CreateFromBase64String(image.url, image.name, scene, false, true, Texture.TRILINEAR_SAMPLINGMODE)
    tex.hasAlpha = true
    tex.wrapU = Texture.WRAP_ADDRESSMODE
    tex.wrapV = Texture.CLAMP_ADDRESSMODE
    return tex
}
function drawLane(ctx, w, h){
    const wash = ctx.createLinearGradient(0, 0, 0, h)
    wash.addColorStop(0, "rgba(255,255,255,0.45)")
    wash.addColorStop(0.14, "rgba(255,255,255,0.08)")
    wash.addColorStop(0.5, "rgba(255,255,255,0.03)")
    wash.addColorStop(0.86, "rgba(255,255,255,0.08)")
    wash.addColorStop(1, "rgba(255,255,255,0.45)")
    ctx.fillStyle = wash
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = "rgba(255,255,255,1)"
    ctx.fillRect(0, 0, w, 6)
    ctx.fillRect(0, h - 6, w, 6)
    // one chevron per tile, pointing +u (down the lane)
    ctx.strokeStyle = "rgba(255,255,255,0.75)"
    ctx.lineWidth = 12
    ctx.lineJoin = "miter"
    ctx.beginPath()
    ctx.moveTo(w * 0.32, h * 0.24)
    ctx.lineTo(w * 0.62, h * 0.5)
    ctx.lineTo(w * 0.32, h * 0.76)
    ctx.stroke()
}
// a stone the hum lifts off the ground - a grey-brown lump, lit from above
const pebbleTexture = scene => drawn(scene, "pebble", 64, 64, (ctx, size) => {
    const c = size / 2
    const random = seeded(7)
    ctx.beginPath()
    for(let i = 0; i < 8; i++){
        const a = i / 8 * Math.PI * 2
        const r = size * (0.3 + random() * 0.15)
        if(i === 0) ctx.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r)
        else ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r)
    }
    ctx.closePath()
    const fill = ctx.createRadialGradient(c - size * 0.1, c - size * 0.14, 2, c, c, size * 0.46)
    fill.addColorStop(0, "#a49482")
    fill.addColorStop(1, "#3a2f26")
    ctx.fillStyle = fill
    ctx.fill()
})

// ── materials ────────────────────────────────────────────────────────────────

// the point it gathers into: white-hot facing you, its colour round the rim
const focusMaterial = (scene, palette) => material(scene, `sonic.focus.${palette.name}`, mat => {
    mat.emissiveColor = Color3.White()
    mat.emissiveFresnelParameters = new FresnelParameters({ leftColor: palette.mid, rightColor: palette.core, bias: 0.2, power: 2 })
})
const auraMaterial = (scene, palette) => material(scene, `sonic.aura.${palette.name}`, mat => {
    mat.opacityTexture = getParticleTexture(scene, particleTexturePath("flare2"))
    mat.emissiveColor = palette.mid
    additive(mat)
})
const flashMaterial = (scene, palette) => material(scene, `sonic.flash.${palette.name}`, mat => {
    mat.diffuseTexture = getParticleTexture(scene, particleTexturePath("explodeTex"))
    mat.emissiveColor = palette.core
    additive(mat)
})
// rings of sound: hot for the ones closing in and the lead shell, the
// colour for the rest
const ringMaterial = (scene, palette, part = "hot") => material(scene, `sonic.ring.${part}.${palette.name}`, mat => {
    mat.opacityTexture = ringTexture(scene)
    mat.emissiveColor = palette[part]
    additive(mat)
})
const shellMaterial = (scene, palette, part) => material(scene, `sonic.shell.${part}.${palette.name}`, mat => {
    mat.opacityTexture = shellTexture(scene)
    mat.emissiveColor = palette[part]
    additive(mat)
})
const vaporMaterial = scene => material(scene, "sonic.vapor", mat => {
    mat.opacityTexture = vaporTexture(scene)
    mat.emissiveColor = VAPOR
    additive(mat)
})
const coneMaterial = (scene, palette) => material(scene, `sonic.cone.${palette.name}`, mat => {
    mat.opacityTexture = streakTexture(scene)
    mat.emissiveColor = Color3.Lerp(VAPOR, palette.hot, 0.35)
    additive(mat)
})
// the lane on the ground: its own handle on the lane image, so its chevrons
// scroll on their own
function laneMaterial(scene, palette, uScale){
    const tex = laneHandle(scene, laneImage(scene))
    tex.uScale = uScale
    const mat = new StandardMaterial(`sonic.lane.${palette.name}`, scene)
    mat.disableLighting = true
    mat.diffuseColor = Color3.Black()
    mat.specularColor = Color3.Black()
    mat.opacityTexture = tex
    mat.emissiveColor = palette.mid
    additive(mat)
    mat.zOffset = -2
    return mat
}

// ── ready before it's needed ─────────────────────────────────────────────────

const prewarmed = new WeakMap()   // scene -> Set(palette name)

/**
 * Everything a boom draws, compiled and loaded ahead of the first one - or
 * its first charge and wave stay invisible for a few frames while their
 * shaders compile. Once per scene and colour (enemies/rangeAttack.js, when an
 * orangelith shows up).
 */
export function prewarmSonic(scene, color){
    if(!scene || scene.isDisposed) return
    const palette = sonicPalette(color)
    let done = prewarmed.get(scene)
    if(!done) prewarmed.set(scene, done = new Set())
    if(done.has(palette.name)) return
    done.add(palette.name)
    prewarmSonicDistortion(scene)
    ;["flare", "flare2", "explodeTex", "smoke", "thin1"].forEach(name => getParticleTexture(scene, particleTexturePath(name)))
    pebbleTexture(scene)
    const away = new Vector3(0, -1000, 0)
    sparkBurst(scene, away, palette.hot, { count: 1, power: 0, life: [0.05, 0.05] })
    const sphere = noPick(MeshBuilder.CreateSphere("sonic.prewarm.sphere", { diameter: 0.01, segments: 8 }, scene))
    const plane = noPick(MeshBuilder.CreatePlane("sonic.prewarm.plane", { size: 0.01 }, scene))
    const cylinder = noPick(MeshBuilder.CreateCylinder("sonic.prewarm.tube", { height: 0.01, diameter: 0.01, cap: Mesh.NO_CAP }, scene))
    const shapes = [sphere, plane, cylinder]
    shapes.forEach(mesh => { mesh.isVisible = false })
    const lane = laneMaterial(scene, palette, 1)
    const jobs = [
        [focusMaterial(scene, palette), sphere],
        [auraMaterial(scene, palette), plane],
        [flashMaterial(scene, palette), plane],
        [ringMaterial(scene, palette, "hot"), plane],
        [ringMaterial(scene, palette, "mid"), plane],
        [vaporMaterial(scene), plane],
        [shellMaterial(scene, palette, "core"), cylinder],
        [shellMaterial(scene, palette, "hot"), cylinder],
        [shellMaterial(scene, palette, "mid"), cylinder],
        [coneMaterial(scene, palette), cylinder],
        [lane, plane],
    ]
    addGlow(scene, sphere, 1)
    sphere.material = focusMaterial(scene, palette)
    sphere._glowLayer?.isReady(sphere.subMeshes[0], false)
    Promise.all(jobs.map(([mat, mesh]) => mat.forceCompilationAsync(mesh)))
        .catch(() => {})
        .finally(() => {
            shapes.forEach(mesh => { dropGlow(mesh); mesh.dispose() })
            lane.opacityTexture?.dispose()
            lane.dispose()
        })
}

// ── 1. the charge ────────────────────────────────────────────────────────────

// a charge still there this long after it should have boomed snuffs itself out
const ORPHANED_AFTER_MS = 1500

/**
 * The stone humming itself up for `ms`: rings of sound collapsing into a
 * white-hot point at getFocus(), sparks drawn into it, stones lifting off the
 * ground round `feet` (getFeet()) and hanging there, the ground throbbing.
 * lock(): the moment it picks its line - a flash, the rings come faster.
 * release(dir): the boom's gone - the hanging stones are flung down `dir`.
 * dispose({ fizzled }): gone; fizzled - killed or bound mid-way - the stones
 * just drop.
 */
export function chargeSonic(scene, { getFocus, getFeet, palette, ms, radius = 1.3 }){
    const start = performance.now()
    const at = getFocus().clone()
    const feet = getFeet().clone()
    const core = noPick(MeshBuilder.CreateSphere("sonic.focus", { diameter: 1, segments: 12 }, scene))
    core.material = focusMaterial(scene, palette)
    core._glowColor = palette.glow
    addGlow(scene, core, 1)
    core.scaling.setAll(0.04)
    core.position.copyFrom(at)
    const aura = billboard(scene, "sonic.focus.aura", auraMaterial(scene, palette))
    aura.position.copyFrom(at)
    aura.scaling.setAll(0.3)

    // sparks drawn in to the point
    const sparks = fireParticles(scene, "sonic.gather", 160, "flare", at)
    sparks.createSphereEmitter(1.5, 0)
    sparks.minEmitPower = -4.2
    sparks.maxEmitPower = -3.4
    sparks.minLifeTime = 0.34
    sparks.maxLifeTime = 0.42
    sparks.addSizeGradient(0, 0.06, 0.12)
    sparks.addSizeGradient(1, 0.02, 0.04)
    sparks.addColorGradient(0, c4(palette.mid, 0))
    sparks.addColorGradient(0.3, c4(palette.hot, 1))
    sparks.addColorGradient(1, c4(palette.core, 1))
    sparks.emitRate = 70
    sparks.start()

    // stones lifting off the ground in a ring round it, slowing, hanging
    const stones = fireParticles(scene, "sonic.stones", 60, pebbleTexture(scene), feet, ParticleSystem.BLENDMODE_STANDARD)
    stones.startPositionFunction = (matrix, position) => {
        const a = Math.random() * Math.PI * 2
        const d = radius * (0.55 + Math.random() * 0.75)
        Vector3.TransformCoordinatesFromFloatsToRef(Math.cos(a) * d, 0.05, Math.sin(a) * d, matrix, position)
    }
    stones.startDirectionFunction = (matrix, direction) => {
        direction.set((Math.random() - 0.5) * 0.15, 1, (Math.random() - 0.5) * 0.15)
    }
    stones.minEmitPower = 0.55
    stones.maxEmitPower = 1.05
    stones.gravity = new Vector3(0, -0.5, 0)
    stones.minLifeTime = 1.4
    stones.maxLifeTime = 1.9
    stones.minSize = 0.06
    stones.maxSize = 0.17
    stones.minAngularSpeed = -4
    stones.maxAngularSpeed = 4
    stones.color1 = new Color4(1, 1, 1, 1)
    stones.color2 = new Color4(0.8, 0.76, 0.72, 1)
    stones.colorDead = new Color4(0.8, 0.76, 0.72, 1)
    stones.emitRate = 36
    stones.start()

    const rings = []
    let nextRing = start
    let nextThrob = start
    let lockedAt = 0
    let disposed = false
    const observer = scene.onBeforeRenderObservable.add(() => {
        const now = performance.now()
        if(now - start > ms + ORPHANED_AFTER_MS) return dispose({ fizzled: true })
        const t = Math.min(1, (now - start) / ms)
        at.copyFrom(getFocus())
        feet.copyFrom(getFeet())
        const flash = lockedAt ? Math.max(0, 1 - (now - lockedAt) / 160) : 0
        const shiver = 1 + (Math.random() - 0.5) * 0.18 * t
        core.scaling.setAll((0.06 + 0.3 * Math.pow(t, 1.5) + flash * 0.25) * shiver)
        core.position.copyFrom(at)
        core._glowBrightness = 0.8 + 1.4 * t + flash * 2
        aura.position.copyFrom(at)
        aura.scaling.setAll((0.5 + 2.2 * t + flash * 1.6) * shiver)
        aura.visibility = Math.min(1, 0.4 + 0.5 * t)
        sparks.emitRate = 70 + 260 * t
        // a ring of sound closing in - faster and faster
        if(now >= nextRing){
            rings.push({ born: now, mesh: billboard(scene, "sonic.inhale", ringMaterial(scene, palette, t > 0.6 ? "core" : "hot")) })
            nextRing = now + (lockedAt ? 55 : 150 - 80 * t)
        }
        for(let i = rings.length - 1; i >= 0; i--){
            const ring = rings[i]
            const k = (now - ring.born) / 280
            if(k >= 1){
                ring.mesh.dispose()
                rings.splice(i, 1)
                continue
            }
            const e = k * k
            ring.mesh.position.copyFrom(at)
            ring.mesh.scaling.setAll(3.4 - 3.1 * e)
            ring.mesh.visibility = Math.min(1, k * 3) * 0.9
        }
        // the ground throbbing under it
        if(now >= nextThrob){
            popShockRing(scene, feet, { size: 2.2 + 1.2 * t, seconds: 0.4, color: palette.mid })
            nextThrob = now + 260 - 140 * t
        }
    })

    function dispose({ fizzled = false, dir = null } = {}){
        if(disposed) return
        disposed = true
        scene.onBeforeRenderObservable.remove(observer)
        dropGlow(core)
        core.dispose()
        aura.dispose()
        rings.forEach(ring => ring.mesh.dispose())
        sparks.stop()
        stones.stop()
        if(fizzled){
            // the hum's gone out of them - they drop
            stones.gravity.set(0, -9.8, 0)
            return
        }
        if(!dir) return
        // flung down the lane with the boom
        stones.gravity.set(0, -9.8, 0)
        stones.particles.forEach(stone => {
            const power = 8 + Math.random() * 7
            stone.direction.set(
                dir.x * power + (Math.random() - 0.5) * 2.5,
                1 + Math.random() * 3,
                dir.z * power + (Math.random() - 0.5) * 2.5)
            stone.lifeTime = stone.age + 0.6 + Math.random() * 0.5
        })
    }
    return {
        position: () => at.clone(),
        lock(){ lockedAt = performance.now() },
        release: dir => dispose({ dir }),
        dispose,
    }
}

// ── 2. the lane ──────────────────────────────────────────────────────────────

const LANE_STEP = 0.8
const LANE_LIFT = 0.07
const LANE_CHEVRON = 1.4
const LANE_REVEAL_MS = 130

/**
 * The lane the boom will tear down, lit up on the ground: from `from` along
 * `dir` (flat), `length` long, halfWidth(along) wide each side, laid over the
 * ground - groundAt(x, z) - point by point so it follows every rise and dip.
 * It shoots out from the stone, chevrons racing down it, throbbing harder
 * till dispose().
 */
export function sonicLane(scene, { from, dir, length, halfWidth, groundAt, palette }){
    const flat = new Vector3(dir.x, 0, dir.z).normalize()
    const side = new Vector3(-flat.z, 0, flat.x)
    const count = Math.max(2, Math.ceil(length / LANE_STEP) + 1)
    const full = Array.from({ length: count }, (_, i) => {
        const along = length * i / (count - 1)
        const middle = from.add(flat.scale(along))
        const w = halfWidth(along)
        const left = middle.add(side.scale(w))
        const right = middle.subtract(side.scale(w))
        left.y = groundAt(left.x, left.z) + LANE_LIFT
        right.y = groundAt(right.x, right.z) + LANE_LIFT
        return { along, left, right }
    })
    const paths = reach => [
        full.map(p => p.along <= reach ? p.left : Vector3.Lerp(full[0].left, p.left, reach / Math.max(0.001, p.along))),
        full.map(p => p.along <= reach ? p.right : Vector3.Lerp(full[0].right, p.right, reach / Math.max(0.001, p.along))),
    ]
    // u down it, a chevron every LANE_CHEVRON, v across - given, not worked
    // out from the points: the reveal starts them all bunched at the stone
    const uvs = [0, 1].flatMap(v => full.map(p => new Vector2(p.along / LANE_CHEVRON, v)))
    let ribbon = noPick(MeshBuilder.CreateRibbon("sonic.lane", { pathArray: paths(0.01), uvs, updatable: true, sideOrientation: Mesh.DOUBLESIDE }, scene))
    const mat = laneMaterial(scene, palette, 1)
    ribbon.material = mat
    const start = performance.now()
    let last = start
    let revealed = false
    const observer = scene.onBeforeRenderObservable.add(() => {
        const now = performance.now()
        const t = now - start
        if(!revealed){
            const k = Math.min(1, t / LANE_REVEAL_MS)
            ribbon = MeshBuilder.CreateRibbon("sonic.lane", { pathArray: paths(length * (1 - Math.pow(1 - k, 2))), instance: ribbon })
            revealed = k >= 1
        }
        // chevrons racing down it
        mat.opacityTexture.uOffset -= (now - last) / 1000 * 2.2
        last = now
        const throb = 0.5 + 0.5 * Math.sin(t / 1000 * (14 + t / 40))
        ribbon.visibility = Math.min(1, t / 60) * (0.45 + 0.4 * throb)
    })
    return {
        dispose(){
            scene.onBeforeRenderObservable.remove(observer)
            ribbon.dispose()
            mat.opacityTexture?.dispose()
            mat.dispose()
        },
    }
}

// ── 3. the boom ──────────────────────────────────────────────────────────────

/**
 * The boom going off at `at`, toward `dir`: a flash, a vapor cone bursting off
 * the point, a condensation disc, streaks thrown down the lane, rings
 * shuddering out along the ground at `feet`, the air bent out in a ring.
 */
export function sonicRelease(scene, at, dir, palette, { feet = null } = {}){
    if(!scene || scene.isDisposed) return
    const start = performance.now()
    const way = dir.normalizeToNew()

    const flash = billboard(scene, "sonic.flash", flashMaterial(scene, palette))
    flash.position.copyFrom(at)
    flash.rotation.z = Math.random() * Math.PI * 2
    const cone = tube(scene, "sonic.cone", coneMaterial(scene, palette), { top: 1, bottom: 0.06 })
    cone.rotationQuaternion = tubeQuaternion(way)
    const spin = Quaternion.RotationAxis(Vector3.Up(), Math.random() * Math.PI * 2)
    cone.rotationQuaternion.multiplyInPlace(spin)
    const disc = facing(scene, "sonic.vapor", vaporMaterial(scene), at, way)
    const ring = facing(scene, "sonic.ring", ringMaterial(scene, palette, "hot"), at, way)
    const observer = scene.onBeforeRenderObservable.add(() => {
        const t = performance.now() - start
        if(t >= 460){
            scene.onBeforeRenderObservable.remove(observer)
            flash.dispose()
            cone.dispose()
            disc.dispose()
            ring.dispose()
            return
        }
        // the flash: in a blink, gone
        flash.scaling.setAll(0.5 + 2.2 * Math.min(1, t / 45))
        flash.visibility = t < 45 ? 1 : Math.max(0, 1 - (t - 45) / 110)
        flash.isVisible = flash.visibility > 0
        // the cone bursting off the point, open end leading, thinning out
        const c = Math.min(1, t / 300)
        const ce = 1 - Math.pow(1 - c, 3)
        const length = 0.3 + 3.6 * ce
        const across = 0.5 + 2.4 * ce
        cone.scaling.set(across, length, across)
        cone.position.copyFrom(at).addInPlace(way.scale(length / 2 + 0.05))
        cone.visibility = Math.max(0, 1 - c) * 0.95
        cone.isVisible = cone.visibility > 0.01
        // the condensation disc - a cloud ring blown out flat
        const d = Math.min(1, t / 420)
        const de = 1 - Math.pow(1 - d, 2.4)
        disc.scaling.setAll(0.6 + 4.6 * de)
        disc.position.copyFrom(at).addInPlace(way.scale(0.35 * de))
        disc.visibility = Math.max(0, 1 - d) * 0.9
        // and a ring of light racing out ahead of it
        const r = Math.min(1, t / 260)
        ring.scaling.setAll(0.5 + 6.5 * (1 - Math.pow(1 - r, 2)))
        ring.position.copyFrom(at).addInPlace(way.scale(0.6 * r))
        ring.visibility = Math.max(0, 1 - r)
    })

    // streaks thrown down the lane
    const streaks = fireParticles(scene, "sonic.streaks", 70, "thin1", at.clone())
    streaks.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED
    streaks.startDirectionFunction = (matrix, direction) => {
        direction.set(way.x + (Math.random() - 0.5) * 0.7, way.y + (Math.random() - 0.5) * 0.5, way.z + (Math.random() - 0.5) * 0.7)
        direction.normalize()
    }
    streaks.manualEmitCount = 55
    streaks.targetStopDuration = 0.1
    streaks.minEmitPower = 14
    streaks.maxEmitPower = 26
    streaks.minLifeTime = 0.12
    streaks.maxLifeTime = 0.28
    streaks.minScaleX = 0.03
    streaks.maxScaleX = 0.06
    streaks.minScaleY = 0.5
    streaks.maxScaleY = 1.3
    streaks.minSize = streaks.maxSize = 1
    streaks.addColorGradient(0, c4(palette.core, 1))
    streaks.addColorGradient(0.5, c4(palette.hot, 0.9))
    streaks.addColorGradient(1, c4(palette.mid, 0))
    streaks.start()
    sparkBurst(scene, at, palette.core, { count: 24, power: 7, size: [0.04, 0.1], life: [0.15, 0.35] })

    if(feet){
        popShockRing(scene, feet, { size: 3.2, seconds: 0.25, color: palette.core })
        popShockRing(scene, feet, { size: 6, seconds: 0.6, color: palette.hot })
        dustRing(scene, feet, palette)
    }
    shockRipple(scene, at, { radius: 7, ms: 560, strength: 0.9, thickness: 1.3, chroma: 0.5, rim: 0.12, tint: palette.hot })
}

// dust blown out flat along the ground all round
function dustRing(scene, at, palette){
    const dust = fireParticles(scene, "sonic.dust.ring", 50, "smoke", at.add(new Vector3(0, 0.15, 0)), ParticleSystem.BLENDMODE_STANDARD)
    dust.startDirectionFunction = (matrix, direction) => {
        const a = Math.random() * Math.PI * 2
        direction.set(Math.cos(a), 0.08 + Math.random() * 0.15, Math.sin(a))
    }
    dust.manualEmitCount = 40
    dust.targetStopDuration = 0.1
    dust.minEmitPower = 3
    dust.maxEmitPower = 6
    dust.minLifeTime = 0.6
    dust.maxLifeTime = 1.1
    dust.minInitialRotation = -Math.PI
    dust.maxInitialRotation = Math.PI
    dust.addSizeGradient(0, 0.4, 0.6)
    dust.addSizeGradient(1, 1.2, 1.7)
    dust.addDragGradient(0, 0)
    dust.addDragGradient(1, 0.9)
    dust.addColorGradient(0, c4(palette.dust, 0))
    dust.addColorGradient(0.1, c4(palette.dust, 0.55))
    dust.addColorGradient(1, c4(palette.dust.scale(1.3), 0))
    dust.start()
}

// ── 4. the wave ──────────────────────────────────────────────────────────────

// the shells of the wave, nose to tail: how far behind the front, how thick,
// how wide against the lane, which colour, how bright
const SHELLS = [
    { lag: 0,    thick: 0.5,  wide: 1,    part: "core", alpha: 1 },
    { lag: 0.85, thick: 0.6,  wide: 0.86, part: "hot",  alpha: 0.85 },
    { lag: 1.7,  thick: 0.7,  wide: 0.72, part: "mid",  alpha: 0.65 },
    { lag: 2.55, thick: 0.8,  wide: 0.58, part: "mid",  alpha: 0.4 },
]
// it dies out over the last this-much of its reach
const FADE_OUT = 2.5
// closer to the camera than NEAR it's gone; it thins out over the next FADE
const CAMERA_NEAR = 1.6
const CAMERA_FADE = 3.4
// a shell seen straight down its axis, this bright
const SIDE_ON_MIN = 0.25
// breaking up on whoever it caught
const BREAK_MS = 140

// 0 right on the camera .. 1 well clear of it
function clearOfCamera(scene, at){
    const camera = scene.activeCamera
    if(!camera) return 1
    const d = Vector3.Distance(camera.globalPosition, at)
    return Math.min(1, Math.max(0, (d - CAMERA_NEAR) / CAMERA_FADE))
}

/**
 * The wave tearing from `from` along `dir` (3D - it may dip toward its
 * target) at `speed` u/s for `length` (measured flat): flaring shells of
 * sound, streaks racing alongside, dust kicked off the ground - groundAt(x, z)
 * - under it, the air bending round it. halfWidth(along): how wide it's grown
 * by then (flat distance). onStep(fromAlong, toAlong) each frame it moves -
 * the caller checks who it's passed. onEnd() when it's died out.
 */
export function flySonicWave(scene, { from, dir, speed, length, halfWidth, groundAt, palette, onStep = null, onEnd = null }){
    const way = dir.normalizeToNew()
    const flatScale = Math.hypot(way.x, way.z) || 1   // along (flat) per unit travelled
    const front = from.clone()
    const shells = SHELLS.map(spec => {
        const mesh = tube(scene, "sonic.shell", shellMaterial(scene, palette, spec.part), { top: 1, bottom: 0.7 })
        mesh.rotationQuaternion = tubeQuaternion(way)
        mesh.isVisible = false
        return { ...spec, mesh, spin: Math.random() * Math.PI * 2 }
    })
    const baseQuaternion = tubeQuaternion(way)
    const lens = facing(scene, "sonic.wave.ring", ringMaterial(scene, palette, "hot"), from, way)
    lens.isVisible = false

    // streaks racing alongside, a touch faster than it
    const streaks = fireParticles(scene, "sonic.wave.streaks", 120, "thin1", front)
    streaks.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED
    let streakRadius = halfWidth(0)
    streaks.startPositionFunction = (matrix, position) => {
        const a = Math.random() * Math.PI * 2
        const r = streakRadius * (0.5 + Math.random() * 0.6)
        // a point on a disc across the way it's going
        const u = Vector3.Cross(way, Math.abs(way.y) > 0.9 ? Vector3.Right() : Vector3.Up()).normalize()
        const v = Vector3.Cross(way, u)
        const off = u.scale(Math.cos(a) * r).addInPlace(v.scale(Math.sin(a) * r))
        Vector3.TransformCoordinatesFromFloatsToRef(off.x, off.y, off.z, matrix, position)
    }
    streaks.startDirectionFunction = (matrix, direction) => direction.copyFrom(way)
    streaks.minEmitPower = speed * 1.1
    streaks.maxEmitPower = speed * 1.35
    streaks.minLifeTime = 0.06
    streaks.maxLifeTime = 0.13
    streaks.minScaleX = 0.025
    streaks.maxScaleX = 0.05
    streaks.minScaleY = 0.6
    streaks.maxScaleY = 1.4
    streaks.minSize = streaks.maxSize = 1
    streaks.addColorGradient(0, c4(palette.core, 0.9))
    streaks.addColorGradient(0.6, c4(palette.hot, 0.6))
    streaks.addColorGradient(1, c4(palette.mid, 0))
    streaks.emitRate = 200
    streaks.start()

    // dust kicked up off the ground under it, thrown out to the sides
    const ground = new Vector3()
    const flat = new Vector3(way.x, 0, way.z).normalize()
    const side = new Vector3(-flat.z, 0, flat.x)
    const dust = fireParticles(scene, "sonic.wave.dust", 160, "smoke", ground, ParticleSystem.BLENDMODE_STANDARD)
    dust.startDirectionFunction = (matrix, direction) => {
        const s = Math.random() < 0.5 ? -1 : 1
        direction.set(side.x * s * (0.6 + Math.random() * 0.6) + flat.x * 0.4, 0.35 + Math.random() * 0.6, side.z * s * (0.6 + Math.random() * 0.6) + flat.z * 0.4)
    }
    dust.minEmitPower = 2
    dust.maxEmitPower = 4.5
    dust.minLifeTime = 0.5
    dust.maxLifeTime = 1
    dust.minInitialRotation = -Math.PI
    dust.maxInitialRotation = Math.PI
    dust.minAngularSpeed = -1.5
    dust.maxAngularSpeed = 1.5
    dust.addSizeGradient(0, 0.35, 0.55)
    dust.addSizeGradient(1, 1.1, 1.6)
    dust.addDragGradient(0, 0)
    dust.addDragGradient(1, 0.85)
    dust.addColorGradient(0, c4(palette.dust, 0))
    dust.addColorGradient(0.12, c4(palette.dust, 0.5))
    dust.addColorGradient(1, c4(palette.dust.scale(1.3), 0))
    dust.emitRate = 0
    dust.start()

    let along = 0          // flat distance the front's come
    let fade = 1
    // a ring of bent air round its front, not a lens over all of it - so
    // whoever it's on stays readable through it - gone at once when it breaks
    let breaking = 1
    const ripple = trackRipple(scene, () => along >= length ? null : {
        at: front,
        radius: halfWidth(along) * 0.85,
        thickness: halfWidth(along) * 0.55,
        strength: 0.75 * fade * breaking * breaking * clearOfCamera(scene, front),
    }, { chroma: 0.45, rim: 0.12, tint: palette.hot })

    let last = performance.now()
    let done = false
    const observer = scene.onBeforeRenderObservable.add(() => {
        const now = performance.now()
        const dt = Math.min(0.05, (now - last) / 1000)
        last = now
        const before = along
        along = Math.min(length, along + speed * dt * flatScale)
        front.copyFrom(from).addInPlace(way.scale(along / flatScale))
        // breaking up on whoever it caught - gone in BREAK_MS
        breaking = breakingAt ? Math.max(0, 1 - (now - breakingAt) / BREAK_MS) : 1
        fade = Math.min(1, (length - along) / FADE_OUT) * breaking
        if(breaking <= 0) return finish()
        onStep?.(before, along)
        const width = halfWidth(along)
        streakRadius = width
        streaks.emitRate = 200 * fade
        ground.set(front.x, groundAt(front.x, front.z) + 0.1, front.z)
        // the dust only where it's skimming the ground
        dust.emitRate = front.y - ground.y < 2.4 ? 120 * fade : 0
        shells.forEach(shell => {
            const back = along - shell.lag
            shell.mesh.position.copyFrom(from).addInPlace(way.scale(Math.max(0, back) / flatScale))
            // flying on through the camera, it'd fill the screen white - it
            // thins out as it gets there instead. And seen straight down its
            // axis, a shell is its whole inside stacked into a disc - the
            // ring (lens) carries that view; the shells are for side-on
            const show = shell.alpha * fade * Math.min(1, back / 0.6) * clearOfCamera(scene, shell.mesh.position) * sideOn(scene, shell.mesh.position, way)
            shell.mesh.isVisible = back > 0.05 && show > 0.01
            if(!shell.mesh.isVisible) return
            const w = halfWidth(back) * 2 * shell.wide
            shell.mesh.scaling.set(w, shell.thick, w)
            shell.spin += dt * 3
            baseQuaternion.multiplyToRef(Quaternion.RotationAxis(Vector3.Up(), shell.spin), shell.mesh.rotationQuaternion)
            shell.mesh.visibility = show
        })
        lens.position.copyFrom(front)
        lens.scaling.setAll(width * 2)
        lens.visibility = 0.4 * fade * clearOfCamera(scene, front)
        lens.isVisible = lens.visibility > 0.01
        if(along >= length) finish()
    })
    let breakingAt = 0
    function finish(){
        if(done) return
        done = true
        scene.onBeforeRenderObservable.remove(observer)
        shells.forEach(shell => shell.mesh.dispose())
        lens.dispose()
        streaks.stop()
        dust.stop()
        ripple.dispose()
        onEnd?.()
    }
    return {
        position: () => front.clone(),
        // it caught someone - it breaks up on them rather than flying on
        breakUp(){ if(!breakingAt) breakingAt = performance.now() },
        dispose: finish,
    }
}

// 1 seen side-on .. SIDE_ON_MIN seen straight down the way it's going
function sideOn(scene, at, way){
    const camera = scene.activeCamera
    if(!camera) return 1
    const look = at.subtract(camera.globalPosition)
    const d = look.length()
    if(d < 0.001) return SIDE_ON_MIN
    const along = Math.abs(Vector3.Dot(look, way)) / d
    const k = Math.min(1, Math.max(0, (along - 0.55) / 0.4))
    return 1 - (1 - SIDE_ON_MIN) * k * k * (3 - 2 * k)
}
