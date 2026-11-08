import { Color3, Color4, Constants, DynamicTexture, FresnelParameters, Material, Mesh, MeshBuilder, ParticleSystem, StandardMaterial, Vector3 } from "@babylonjs/core"
import { addGlow } from "../tools/glow.js"
import { getParticleTexture, particleTexturePath } from "../tools/particlesystem.js"
import { sparkBurst } from "./blessingFx.js"
import { popShockRing } from "./shockRing.js"
import { smokePuff } from "./comicHit.js"

// THE FIREBALL, ENEMY TO PLAYER (enemies/rangeAttack.js runs the timeline):
//  1. the wind-up - a ball of fire swelling over the enemy, flames and sparks
//     drawn into it, fire catching on the ground round it
//  2. the lob - it arcs through the air streaming flame, smoke and dripping
//     embers, while a ring on the ground marks where it's coming down and
//     fills in as it falls (full the moment it lands)
//  3. the blast - a flash, a ball of fire swelling out, flames, embers and
//     dirt thrown everywhere, two shock rings, a column of smoke, and the
//     ground left burnt and smouldering
// Any colour: every flame here is the white flame2 sprite tinted by a palette
// (firePalette - red, blue, green, purple, white, or a "#rrggbb" of your own).
// No lights: adding and removing them recompiles every material they touch
// (and past 8 the shaders stop compiling - tools/lightBudget.js). The glow
// layer (tools/glow.js) does the shine instead.
//
// Every particle system runs on updateSpeed 1/60, so its numbers are real
// units: lifetimes in seconds, rates per second, speeds in units per second,
// sizes in metres (with size gradients, the gradient values ARE the sizes).

// ── palettes ─────────────────────────────────────────────────────────────────

// core: the white-hot heart. hot: the flame's bright body. mid: its colour.
// edge: where it cools, at the tips. smoke: what it leaves behind. glow: what
// it blooms (mesh._glowColor)
const c3 = (r, g, b) => new Color3(r, g, b)
const PALETTES = {
    red:    { core: c3(1, 0.97, 0.82), hot: c3(1, 0.76, 0.22),  mid: c3(1, 0.4, 0.07),    edge: c3(0.7, 0.08, 0.02),  smoke: c3(0.1, 0.075, 0.06),  glow: c3(1, 0.42, 0.08) },
    blue:   { core: c3(0.9, 0.98, 1),  hot: c3(0.45, 0.85, 1),  mid: c3(0.15, 0.45, 1),   edge: c3(0.06, 0.1, 0.55),  smoke: c3(0.07, 0.08, 0.12),  glow: c3(0.22, 0.52, 1) },
    green:  { core: c3(0.95, 1, 0.82), hot: c3(0.72, 1, 0.3),   mid: c3(0.25, 0.88, 0.12), edge: c3(0.04, 0.4, 0.06),  smoke: c3(0.07, 0.1, 0.06),   glow: c3(0.35, 1, 0.18) },
    purple: { core: c3(1, 0.9, 1),     hot: c3(0.95, 0.5, 1),   mid: c3(0.62, 0.2, 1),    edge: c3(0.28, 0.03, 0.52), smoke: c3(0.09, 0.05, 0.11),  glow: c3(0.7, 0.28, 1) },
    white:  { core: c3(1, 1, 1),       hot: c3(1, 0.96, 0.78),  mid: c3(1, 0.84, 0.45),   edge: c3(0.85, 0.55, 0.22), smoke: c3(0.17, 0.16, 0.15),  glow: c3(1, 0.9, 0.62) },
}
PALETTES.orange = PALETTES.red
PALETTES.cyan = PALETTES.blue
PALETTES.violet = PALETTES.purple

/** A fireball's colours by name - or worked out from any "#rrggbb". */
export function firePalette(color = "red"){
    const name = String(color ?? "red").toLowerCase()
    if(PALETTES[name]) return { ...PALETTES[name], name }
    if(/^#[0-9a-f]{6}$/.test(name)){
        const mid = Color3.FromHexString(name)
        return {
            name,
            core: Color3.Lerp(mid, Color3.White(), 0.82),
            hot: Color3.Lerp(mid, Color3.White(), 0.42),
            mid,
            edge: mid.scale(0.5),
            smoke: Color3.Lerp(mid.scale(0.12), new Color3(0.08, 0.08, 0.08), 0.6),
            glow: mid.clone(),
        }
    }
    return { ...PALETTES.red, name: "red" }
}

// ── shared bits ──────────────────────────────────────────────────────────────

const UPDATE_SPEED = 1 / 60
const c4 = (color, alpha) => new Color4(color.r, color.g, color.b, alpha)

// shared per scene and key - a fireball is thrown every few seconds, its
// materials and drawn textures needn't be made and thrown away each time
const materialCache = new WeakMap()   // scene -> Map(key -> material)
function material(scene, key, make){
    let byKey = materialCache.get(scene)
    if(!byKey) materialCache.set(scene, byKey = new Map())
    let mat = byKey.get(key)
    if(!mat || mat.isDisposed?.()){
        mat = make()
        byKey.set(key, mat)
    }
    return mat
}
// lit by nothing - its colour is all its own
function emissiveMaterial(scene, key, setup){
    return material(scene, key, () => {
        const mat = new StandardMaterial(key, scene)
        mat.disableLighting = true
        mat.diffuseColor = Color3.Black()
        mat.specularColor = Color3.Black()
        setup(mat)
        return mat
    })
}
// see-through and added on - a glow, a flash, a ring of light
function additive(mat){
    mat.alphaMode = Constants.ALPHA_ADD
    mat.transparencyMode = Material.MATERIAL_ALPHABLEND
    mat.disableDepthWrite = true
    mat.backFaceCulling = false
}
// flat on the ground, drawn over it rather than fighting it
function onGround(mat){
    mat.zOffset = -2
    mat.backFaceCulling = false
}

const textureCache = new WeakMap()   // scene -> Map(name -> texture)
function drawn(scene, name, size, draw){
    let byName = textureCache.get(scene)
    if(!byName) textureCache.set(scene, byName = new Map())
    let tex = byName.get(name)
    if(tex) return tex
    // mipmapped - small on screen, and without mips thin lines break up
    tex = new DynamicTexture(`fireball.${name}`, { width: size, height: size }, scene, true)
    const ctx = tex.getContext()
    ctx.clearRect(0, 0, size, size)
    draw(ctx, size)
    tex.hasAlpha = true
    tex.update()
    byName.set(name, tex)
    return tex
}
// the same "random" every time it's drawn
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
function flat(scene, name, mat){
    const plane = noPick(MeshBuilder.CreateGround(name, { width: 1, height: 1 }, scene))
    plane.material = mat
    return plane
}
// frees a system once it's stopped and its last particle is gone - not
// disposeOnStop: that takes the shared particle texture with it
// (tools/particlesystem.js's cache)
function freeWhenDone(scene, ps){
    ps.onAnimationEnd = () => setTimeout(() => { if(!scene.isDisposed) ps.dispose(false) }, 0)
    return ps
}
// a particle system set up the way every one here is - real units, freed
// once it's done - from one of images/particles' sprites (by name) or a
// texture of its own
export function fireParticles(scene, name, capacity, texture, emitter, blendMode = ParticleSystem.BLENDMODE_ADD){
    const ps = freeWhenDone(scene, new ParticleSystem(name, capacity, scene))
    ps.particleTexture = typeof texture === "string" ? getParticleTexture(scene, particleTexturePath(texture)) : texture
    ps.emitter = emitter
    ps.updateSpeed = UPDATE_SPEED
    ps.blendMode = blendMode
    return ps
}
// white-hot, to its colour, to its cooling edge, then gone
export function flameColors(ps, palette, alpha = 1){
    ps.addColorGradient(0, c4(palette.core, alpha))
    ps.addColorGradient(0.18, c4(palette.hot, alpha))
    ps.addColorGradient(0.5, c4(palette.mid, 0.85 * alpha))
    ps.addColorGradient(0.8, c4(palette.edge, 0.45 * alpha))
    ps.addColorGradient(1, c4(palette.edge, 0))
}

// ── materials ────────────────────────────────────────────────────────────────

// the ball itself: white-hot where it faces you, the flame's colour at its rim
const coreMaterial = (scene, palette) => emissiveMaterial(scene, `fireball.core.${palette.name}`, mat => {
    mat.emissiveColor = Color3.White()
    mat.emissiveFresnelParameters = new FresnelParameters({ leftColor: palette.hot, rightColor: palette.core, bias: 0.2, power: 2 })
})
// the soft light round it (flare2, tinted)
const auraMaterial = (scene, palette) => emissiveMaterial(scene, `fireball.aura.${palette.name}`, mat => {
    mat.opacityTexture = getParticleTexture(scene, particleTexturePath("flare2"))
    mat.emissiveColor = palette.mid
    additive(mat)
})
// the blast's first instant - a white-hot starburst (explodeTex, black where
// it's empty, so added on it shows only the burst)
const flashMaterial = (scene, palette) => emissiveMaterial(scene, `fireball.flash.${palette.name}`, mat => {
    mat.diffuseTexture = getParticleTexture(scene, particleTexturePath("explodeTex"))
    mat.emissiveColor = palette.core
    additive(mat)
})
// the ball of fire the blast swells into: hot at its middle, its colour out
// at the rim, and soft there - see-through where it turns away. Seen from
// inside (a camera caught in it) it's nothing, not a blinding screen.
const blastMaterial = (scene, palette) => emissiveMaterial(scene, `fireball.blast.${palette.name}`, mat => {
    mat.emissiveColor = Color3.White()
    mat.emissiveFresnelParameters = new FresnelParameters({ leftColor: palette.mid, rightColor: palette.hot, bias: 0.1, power: 1.5 })
    mat.opacityFresnelParameters = new FresnelParameters({ leftColor: Color3.Black(), rightColor: Color3.White(), bias: 0, power: 1.6 })
    mat.alpha = 0.75
    additive(mat)
    mat.backFaceCulling = true
})
// the warning on the ground: its ring, and the fill closing in
const markerMaterial = (scene, palette, part) => emissiveMaterial(scene, `fireball.marker.${part}.${palette.name}`, mat => {
    mat.opacityTexture = part === "ring" ? ringTexture(scene) : fillTexture(scene)
    mat.emissiveColor = part === "ring" ? palette.hot : palette.mid
    additive(mat)
    onGround(mat)
})
// the burnt ground: a dark blotch, and embers glowing in it
const burnMaterial = (scene, palette) => emissiveMaterial(scene, `fireball.burn.${palette.name}`, mat => {
    mat.opacityTexture = burnTexture(scene)
    mat.emissiveColor = Color3.Lerp(new Color3(0.035, 0.03, 0.025), palette.edge, 0.06)
    mat.transparencyMode = Material.MATERIAL_ALPHABLEND
    mat.disableDepthWrite = true
    onGround(mat)
})
const emberMaterial = (scene, palette) => emissiveMaterial(scene, `fireball.embers.${palette.name}`, mat => {
    mat.opacityTexture = emberTexture(scene)
    mat.emissiveColor = palette.mid
    additive(mat)
    onGround(mat)
})

// ── drawn textures ───────────────────────────────────────────────────────────

// the warning ring: a bright band round the edge with a soft glow either side,
// sixteen notches pointing in, a faint wash inside
const ringTexture = scene => drawn(scene, "marker.ring", 256, (ctx, size) => {
    const c = size / 2
    const wash = ctx.createRadialGradient(c, c, 0, c, c, c * 0.92)
    wash.addColorStop(0, "rgba(255,255,255,0.04)")
    wash.addColorStop(0.85, "rgba(255,255,255,0.16)")
    wash.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = wash
    ctx.fillRect(0, 0, size, size)
    const band = (width, alpha) => {
        ctx.lineWidth = width
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`
        ctx.beginPath()
        ctx.arc(c, c, size * 0.45, 0, Math.PI * 2)
        ctx.stroke()
    }
    band(size * 0.09, 0.18)
    band(size * 0.05, 0.4)
    band(size * 0.022, 1)
    ctx.fillStyle = "rgba(255,255,255,0.9)"
    for(let i = 0; i < 16; i++){
        ctx.save()
        ctx.translate(c, c)
        ctx.rotate(i / 16 * Math.PI * 2)
        ctx.beginPath()
        ctx.moveTo(size * 0.405, -size * 0.022)
        ctx.lineTo(size * 0.35, 0)
        ctx.lineTo(size * 0.405, size * 0.022)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
    }
})
// the fill: a disc, faint in the middle, bright at its edge - so as it
// closes in on the ring, its edge is the clock
const fillTexture = scene => drawn(scene, "marker.fill", 256, (ctx, size) => {
    const c = size / 2
    const fill = ctx.createRadialGradient(c, c, 0, c, c, c * 0.97)
    fill.addColorStop(0, "rgba(255,255,255,0.06)")
    fill.addColorStop(0.7, "rgba(255,255,255,0.22)")
    fill.addColorStop(0.96, "rgba(255,255,255,0.85)")
    fill.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.arc(c, c, c * 0.97, 0, Math.PI * 2)
    ctx.fill()
})
// a burnt blotch, ragged at the edge, with streaks thrown out from the middle
const burnTexture = scene => drawn(scene, "scorch.burn", 256, (ctx, size) => {
    const c = size / 2
    const random = seeded(3)
    for(let i = 0; i < 26; i++){
        const a = random() * Math.PI * 2
        const d = random() * size * 0.2
        const r = size * (0.12 + random() * 0.15)
        const x = c + Math.cos(a) * d
        const y = c + Math.sin(a) * d
        const blot = ctx.createRadialGradient(x, y, 0, x, y, r)
        blot.addColorStop(0, "rgba(255,255,255,0.55)")
        blot.addColorStop(1, "rgba(255,255,255,0)")
        ctx.fillStyle = blot
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
    }
    for(let i = 0; i < 24; i++){
        const a = random() * Math.PI * 2
        const reach = size * (0.3 + random() * 0.18)
        const spread = 0.04 + random() * 0.05
        ctx.fillStyle = `rgba(255,255,255,${0.25 + random() * 0.3})`
        ctx.beginPath()
        ctx.moveTo(c + Math.cos(a - spread) * size * 0.12, c + Math.sin(a - spread) * size * 0.12)
        ctx.lineTo(c + Math.cos(a) * reach, c + Math.sin(a) * reach)
        ctx.lineTo(c + Math.cos(a + spread) * size * 0.12, c + Math.sin(a + spread) * size * 0.12)
        ctx.closePath()
        ctx.fill()
    }
})
// a clod the blast throws up - a dark lump, ragged, lit on one side
const clodTexture = scene => drawn(scene, "clod", 64, (ctx, size) => {
    const c = size / 2
    const random = seeded(5)
    ctx.beginPath()
    for(let i = 0; i < 9; i++){
        const a = i / 9 * Math.PI * 2
        const r = size * (0.3 + random() * 0.16)
        if(i === 0) ctx.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r)
        else ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r)
    }
    ctx.closePath()
    const fill = ctx.createRadialGradient(c - size * 0.12, c - size * 0.12, 2, c, c, size * 0.48)
    fill.addColorStop(0, "#8a7560")
    fill.addColorStop(1, "#2a211a")
    ctx.fillStyle = fill
    ctx.fill()
})
// embers left glowing in it - specks, more of them toward the middle
const emberTexture = scene => drawn(scene, "scorch.embers", 256, (ctx, size) => {
    const c = size / 2
    const random = seeded(19)
    for(let i = 0; i < 80; i++){
        const a = random() * Math.PI * 2
        const d = Math.pow(random(), 1.6) * size * 0.4
        const x = c + Math.cos(a) * d
        const y = c + Math.sin(a) * d
        const r = 1.2 + random() * 3
        const speck = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2)
        speck.addColorStop(0, "rgba(255,255,255,1)")
        speck.addColorStop(0.4, "rgba(255,255,255,0.6)")
        speck.addColorStop(1, "rgba(255,255,255,0)")
        ctx.fillStyle = speck
        ctx.beginPath()
        ctx.arc(x, y, r * 2.2, 0, Math.PI * 2)
        ctx.fill()
    }
})

// ── ready before it's needed ─────────────────────────────────────────────────

const prewarmed = new WeakMap()   // scene -> Set(palette name)

/**
 * Everything a fireball draws, compiled and loaded ahead of the first one -
 * or its first wind-up and blast stay invisible for a few frames while their
 * shaders compile and their textures arrive. Once per scene and colour
 * (enemies/rangeAttack.js, when an enemy that throws them shows up).
 */
export function prewarmFireball(scene, color){
    if(!scene || scene.isDisposed) return
    const palette = firePalette(color)
    let done = prewarmed.get(scene)
    if(!done) prewarmed.set(scene, done = new Set())
    if(done.has(palette.name)) return
    done.add(palette.name)
    ;["flame2", "flare", "flare2", "explodeTex", "smoke", "thin1"].forEach(name => getParticleTexture(scene, particleTexturePath(name)))
    clodTexture(scene)
    // the particle shaders - added on, and drawn over - on particles nobody will see
    const away = new Vector3(0, -1000, 0)
    sparkBurst(scene, away, palette.hot, { count: 1, power: 0, life: [0.05, 0.05] })
    smokePuff(scene, away, { count: 1 })
    // the materials, against the shapes they go on, and the glow pass over them
    const sphere = noPick(MeshBuilder.CreateSphere("fireball.prewarm.sphere", { diameter: 0.01, segments: 12 }, scene))
    const plane = noPick(MeshBuilder.CreatePlane("fireball.prewarm.plane", { size: 0.01 }, scene))
    const ground = noPick(MeshBuilder.CreateGround("fireball.prewarm.ground", { width: 0.01, height: 0.01 }, scene))
    const shapes = [sphere, plane, ground]
    shapes.forEach(mesh => { mesh.isVisible = false })
    const jobs = [
        [coreMaterial(scene, palette), sphere],
        [blastMaterial(scene, palette), sphere],
        [auraMaterial(scene, palette), plane],
        [flashMaterial(scene, palette), plane],
        [markerMaterial(scene, palette, "ring"), ground],
        [markerMaterial(scene, palette, "fill"), ground],
        [burnMaterial(scene, palette), ground],
        [emberMaterial(scene, palette), ground],
    ]
    addGlow(scene, sphere, 1)
    ;[coreMaterial(scene, palette), blastMaterial(scene, palette)].forEach(mat => {
        sphere.material = mat
        sphere._glowLayer?.isReady(sphere.subMeshes[0], false)
    })
    Promise.all(jobs.map(([mat, mesh]) => mat.forceCompilationAsync(mesh)))
        .catch(() => {})
        .finally(() => shapes.forEach(mesh => { dropGlow(mesh); mesh.dispose() }))
}

// ── flames ───────────────────────────────────────────────────────────────────

// flames licking up off a ball of fire at `at` (moved with it). radius(r) -
// the ball's size now, the flames' with it; rate(n) - flames a second
function flameShell(scene, at, palette){
    const ps = fireParticles(scene, "fireball.shell", 260, "flame2", at)
    const emitter = ps.createSphereEmitter(0.1, 0.3)
    ps.minEmitPower = 0.15
    ps.maxEmitPower = 0.5
    ps.minLifeTime = 0.16
    ps.maxLifeTime = 0.3
    ps.gravity = new Vector3(0, 2.4, 0)
    ps.minInitialRotation = -0.4
    ps.maxInitialRotation = 0.4
    ps.addSizeGradient(0, 0.2, 0.3)
    ps.addSizeGradient(1, 0.06, 0.1)
    flameColors(ps, palette)
    ps.emitRate = 60
    ps.start()
    const sizes = ps.getSizeGradients()
    return {
        radius(r){
            emitter.radius = r * 0.8
            sizes[0].factor1 = r * 1.7
            sizes[0].factor2 = r * 2.5
            sizes[1].factor1 = r * 0.5
            sizes[1].factor2 = r * 0.8
        },
        rate(n){ ps.emitRate = n },
        stop(){ ps.stop() },
    }
}

// flames and sparks drawn in from all round to `at` - sphere emitters
// shooting inward (negative power), each dying as it reaches the middle
function drawIn(scene, at, palette){
    const sparks = fireParticles(scene, "fireball.gather", 140, "flare", at)
    sparks.createSphereEmitter(1.3, 0)
    sparks.minEmitPower = -3.6
    sparks.maxEmitPower = -3
    sparks.minLifeTime = 0.34
    sparks.maxLifeTime = 0.4
    sparks.addSizeGradient(0, 0.07, 0.14)
    sparks.addSizeGradient(1, 0.02, 0.04)
    sparks.addColorGradient(0, c4(palette.mid, 0))
    sparks.addColorGradient(0.25, c4(palette.hot, 1))
    sparks.addColorGradient(1, c4(palette.core, 1))
    sparks.emitRate = 90
    sparks.start()
    const wisps = fireParticles(scene, "fireball.gather.wisps", 90, "flame2", at)
    wisps.createSphereEmitter(1.05, 0)
    wisps.minEmitPower = -2.9
    wisps.maxEmitPower = -2.4
    wisps.minLifeTime = 0.36
    wisps.maxLifeTime = 0.42
    wisps.minInitialRotation = -Math.PI
    wisps.maxInitialRotation = Math.PI
    wisps.addSizeGradient(0, 0.14, 0.22)
    wisps.addSizeGradient(1, 0.05, 0.08)
    wisps.addColorGradient(0, c4(palette.edge, 0))
    wisps.addColorGradient(0.3, c4(palette.mid, 0.8))
    wisps.addColorGradient(1, c4(palette.hot, 1))
    wisps.emitRate = 40
    wisps.start()
    return {
        rate(t){
            sparks.emitRate = 90 + 200 * t
            wisps.emitRate = 40 + 90 * t
        },
        stop(){
            sparks.stop()
            wisps.stop()
        },
    }
}

/**
 * Flames rising off the ground round `at` for `ms` - a ring of them (fire
 * catching round an enemy winding up) or, ring: false, all over a patch (a
 * blast's burnt ground smouldering).
 */
export function fireRing(scene, at, palette, { radius = 0.8, ms = 400, rate = 120, ring = true, size = [0.22, 0.4] } = {}){
    if(!scene || scene.isDisposed) return
    const ps = fireParticles(scene, "fireball.ring", Math.ceil(rate * 0.7) + 12, "flame2", at.add(new Vector3(0, 0.05, 0)))
    ps.createDirectedCylinderEmitter(radius, 0, ring ? 0 : 1, new Vector3(-0.15, 1, -0.15), new Vector3(0.15, 1, 0.15))
    ps.minEmitPower = 0.3
    ps.maxEmitPower = 0.9
    ps.minLifeTime = 0.3
    ps.maxLifeTime = 0.6
    ps.gravity = new Vector3(0, 1.6, 0)
    ps.minInitialRotation = -0.3
    ps.maxInitialRotation = 0.3
    ps.addSizeGradient(0, size[0], size[1])
    ps.addSizeGradient(1, size[0] * 0.3, size[1] * 0.3)
    flameColors(ps, palette)
    ps.emitRate = rate
    ps.targetStopDuration = ms / 1000
    ps.start()
}

// ── 1. the wind-up ───────────────────────────────────────────────────────────

// a wind-up still there this long after it should have been thrown snuffs
// itself out - whatever stopped the throw, it doesn't hang there for good
const ORPHANED_AFTER_MS = 1500

/**
 * A ball of fire swelling at getAnchor() for `ms` - white-hot, flames licking
 * off it, flames and sparks drawn into it. flare(): the moment it's spat, a
 * pop. dispose({ fizzled }): gone - the shot takes over from here - or, its
 * thrower killed or bound mid-way, snuffed out in a puff of smoke (as it is,
 * by itself, ORPHANED_AFTER_MS past its time).
 */
export function chargeFireball(scene, getAnchor, palette, ms){
    const start = performance.now()
    const at = getAnchor().clone()
    const core = noPick(MeshBuilder.CreateSphere("fireball.charge", { diameter: 1, segments: 12 }, scene))
    core.material = coreMaterial(scene, palette)
    core._glowColor = palette.glow
    addGlow(scene, core, 1)
    core.scaling.setAll(0.05)
    core.position.copyFrom(at)
    const aura = billboard(scene, "fireball.charge.aura", auraMaterial(scene, palette))
    aura.position.copyFrom(at)
    aura.scaling.setAll(0.3)
    const shell = flameShell(scene, at, palette)
    const gather = drawIn(scene, at, palette)

    let flareAt = 0
    let disposed = false
    const observer = scene.onBeforeRenderObservable.add(() => {
        const now = performance.now()
        if(now - start > ms + ORPHANED_AFTER_MS) return dispose({ fizzled: true })
        const t = Math.min(1, (now - start) / ms)
        const flare = flareAt ? Math.max(0, 1 - (now - flareAt) / 140) : 0
        // swells faster as it goes, and won't hold still
        const radius = 0.04 + 0.15 * Math.pow(t, 1.4)
        const shiver = 1 + (Math.random() - 0.5) * 0.12
        core.scaling.setAll((radius * 2 + flare * 0.3) * shiver)
        core._glowBrightness = 0.9 + 1.1 * t + flare * 2.2
        aura.scaling.setAll(0.5 + 2.1 * t + flare * 1.4)
        aura.visibility = Math.min(1, 0.45 + 0.4 * t + (Math.random() - 0.5) * 0.15)
        at.copyFrom(getAnchor())
        core.position.copyFrom(at)
        aura.position.copyFrom(at)
        shell.radius(radius)
        shell.rate(40 + 200 * t)
        gather.rate(t)
    })

    function dispose({ fizzled = false } = {}){
        if(disposed) return
        disposed = true
        scene.onBeforeRenderObservable.remove(observer)
        dropGlow(core)
        core.dispose()
        aura.dispose()
        shell.stop()
        gather.stop()
        if(fizzled) smokePuff(scene, at, { count: 10, size: 1.2 })
    }
    return {
        position: () => at.clone(),
        flare(){ flareAt = performance.now() },
        dispose,
    }
}

// ── 2. the lob ───────────────────────────────────────────────────────────────

/**
 * The fireball thrown from -> to over `ms`, arcing `apex` over the straight
 * line between them: white-hot, flames streaming off it, a trail of fire and
 * smoke behind, embers dripping. onLand(at) when it comes down; dispose()
 * snuffs it out on the way.
 */
export function flyFireball(scene, from, to, palette, ms, { apex = 2, onLand = null } = {}){
    const start = performance.now()
    const at = from.clone()
    const core = noPick(MeshBuilder.CreateSphere("fireball.shot", { diameter: 1, segments: 12 }, scene))
    core.material = coreMaterial(scene, palette)
    core._glowColor = palette.glow
    addGlow(scene, core, 1.6)
    core.position.copyFrom(at)
    const aura = billboard(scene, "fireball.shot.aura", auraMaterial(scene, palette))
    aura.position.copyFrom(at)
    const shell = flameShell(scene, at, palette)
    shell.radius(0.23)
    shell.rate(320)

    // the trail: a glowing streak of fire left hanging where it's been,
    // cooling - soft blobs for its body, flame tongues licking off it
    const trail = fireParticles(scene, "fireball.trail", 160, "flare2", at)
    trail.createSphereEmitter(0.1, 1)
    trail.minEmitPower = 0.05
    trail.maxEmitPower = 0.25
    trail.minLifeTime = 0.2
    trail.maxLifeTime = 0.38
    trail.gravity = new Vector3(0, 1, 0)
    trail.addSizeGradient(0, 0.5, 0.62)
    trail.addSizeGradient(1, 0.12, 0.18)
    flameColors(trail, palette, 0.6)
    trail.emitRate = 280
    trail.start()
    const tongues = fireParticles(scene, "fireball.tongues", 80, "flame2", at)
    tongues.createSphereEmitter(0.16, 1)
    tongues.minEmitPower = 0.1
    tongues.maxEmitPower = 0.4
    tongues.minLifeTime = 0.15
    tongues.maxLifeTime = 0.3
    tongues.gravity = new Vector3(0, 1.8, 0)
    tongues.minInitialRotation = -Math.PI
    tongues.maxInitialRotation = Math.PI
    tongues.addSizeGradient(0, 0.3, 0.44)
    tongues.addSizeGradient(1, 0.1, 0.14)
    flameColors(tongues, palette)
    tongues.emitRate = 140
    tongues.start()
    // and smoke behind that
    const smoke = fireParticles(scene, "fireball.trail.smoke", 90, "smoke", at, ParticleSystem.BLENDMODE_STANDARD)
    smoke.createSphereEmitter(0.1, 1)
    smoke.minEmitPower = 0.05
    smoke.maxEmitPower = 0.2
    smoke.minLifeTime = 0.6
    smoke.maxLifeTime = 1
    smoke.gravity = new Vector3(0, 0.6, 0)
    smoke.minInitialRotation = -Math.PI
    smoke.maxInitialRotation = Math.PI
    smoke.minAngularSpeed = -1
    smoke.maxAngularSpeed = 1
    smoke.addSizeGradient(0, 0.18, 0.26)
    smoke.addSizeGradient(1, 0.7, 0.95)
    smoke.addColorGradient(0, c4(palette.smoke, 0))
    smoke.addColorGradient(0.2, c4(palette.smoke, 0.5))
    smoke.addColorGradient(1, c4(palette.smoke.scale(2), 0))
    smoke.startDelay = 60
    smoke.emitRate = 70
    smoke.start()
    // embers dripping off it, falling
    const drips = fireParticles(scene, "fireball.drips", 60, "flare", at)
    drips.createSphereEmitter(0.18, 1)
    drips.minEmitPower = 0.4
    drips.maxEmitPower = 1.4
    drips.minLifeTime = 0.4
    drips.maxLifeTime = 0.8
    drips.gravity = new Vector3(0, -6, 0)
    drips.addSizeGradient(0, 0.05, 0.09)
    drips.addSizeGradient(1, 0.02, 0.03)
    drips.addColorGradient(0, c4(palette.core, 1))
    drips.addColorGradient(0.3, c4(palette.hot, 1))
    drips.addColorGradient(1, c4(palette.edge, 0))
    drips.emitRate = 45
    drips.start()

    let done = false
    const observer = scene.onBeforeRenderObservable.add(() => {
        const t = Math.min(1, (performance.now() - start) / ms)
        Vector3.LerpToRef(from, to, t, at)
        at.y += apex * 4 * t * (1 - t)
        core.position.copyFrom(at)
        aura.position.copyFrom(at)
        const shiver = 1 + (Math.random() - 0.5) * 0.1
        core.scaling.setAll(0.42 * shiver)
        core._glowBrightness = 1.4 + Math.random() * 0.5
        aura.scaling.setAll(2.5 * shiver)
        aura.visibility = 0.8 + Math.random() * 0.2
        if(t >= 1) finish(true)
    })
    function finish(landed){
        if(done) return
        done = true
        scene.onBeforeRenderObservable.remove(observer)
        dropGlow(core)
        core.dispose()
        aura.dispose()
        shell.stop()
        trail.stop()
        tongues.stop()
        smoke.stop()
        drips.stop()
        if(landed) onLand?.(to.clone())
    }
    return {
        position: () => at.clone(),
        dispose: () => finish(false),
    }
}

/**
 * Where it's coming down: a ring as wide as the blast on the ground at `at`,
 * its inside filling in as it falls - full the moment it lands - and pulsing
 * faster as it gets close. dispose() when it lands.
 */
export function landingMarker(scene, at, radius, palette, ms){
    const start = performance.now()
    const ring = flat(scene, "fireball.marker.ring", markerMaterial(scene, palette, "ring"))
    const fill = flat(scene, "fireball.marker.fill", markerMaterial(scene, palette, "fill"))
    ring.position.set(at.x, at.y + 0.05, at.z)
    fill.position.set(at.x, at.y + 0.04, at.z)
    const across = radius * 2
    let phase = 0
    let last = start
    const observer = scene.onBeforeRenderObservable.add(() => {
        const now = performance.now()
        const t = Math.min(1, (now - start) / ms)
        phase += (now - last) / 1000 * (8 + 26 * t)
        last = now
        // it slams down into place, then throbs - faster and faster
        const pop = Math.min(1, (now - start) / 140)
        const size = across * (1 + 0.35 * (1 - pop) * (1 - pop))
        ring.scaling.set(size, 1, size)
        ring.rotation.y += 0.012
        ring.visibility = pop * (0.55 + 0.45 * Math.max(0, Math.sin(phase)))
        const closing = Math.max(0.001, across * t)
        fill.scaling.set(closing, 1, closing)
        fill.visibility = 0.5 + 0.4 * t
    })
    return {
        dispose(){
            scene.onBeforeRenderObservable.remove(observer)
            ring.dispose()
            fill.dispose()
        },
    }
}

// ── 3. the blast ─────────────────────────────────────────────────────────────

const SCORCH_MARK_MS = 6000

/**
 * The fireball coming down at `at` (on the ground): a white-hot flash, a ball
 * of fire swelling out to about `radius`, flames thrown out and up, embers
 * and dirt flying, two shock rings racing out along the ground, a column of
 * smoke - and a burnt patch left smouldering a while.
 */
export function fireExplosion(scene, at, palette, { radius = 1.6 } = {}){
    if(!scene || scene.isDisposed) return
    const start = performance.now()
    const middle = at.add(new Vector3(0, 0.45, 0))

    const flash = billboard(scene, "fireball.flash", flashMaterial(scene, palette))
    flash.position.copyFrom(middle)
    flash.rotation.z = Math.random() * Math.PI * 2
    const blast = noPick(MeshBuilder.CreateSphere("fireball.blast", { diameter: 1, segments: 16 }, scene))
    blast.material = blastMaterial(scene, palette)
    blast._glowColor = palette.glow
    addGlow(scene, blast, 1.2)
    blast.position.copyFrom(middle)
    blast.scaling.setAll(0.4)
    const observer = scene.onBeforeRenderObservable.add(() => {
        const t = performance.now() - start
        if(t >= 420){
            scene.onBeforeRenderObservable.remove(observer)
            flash.dispose()
            dropGlow(blast)
            blast.dispose()
            return
        }
        // the flash: in a blink to full, then gone
        const f = Math.min(1, t / 70)
        flash.scaling.setAll(0.6 + radius * 1.9 * f)
        flash.visibility = t < 70 ? 1 : Math.max(0, 1 - (t - 70) / 150)
        flash.isVisible = flash.visibility > 0
        // the ball of fire: out fast and slowing, rising, burning out
        const b = Math.min(1, t / 220)
        blast.scaling.setAll(0.4 + (radius * 1.7 - 0.4) * (1 - Math.pow(1 - b, 3)))
        blast.position.y = middle.y + 0.3 * b
        blast.visibility = t < 90 ? 1 : Math.max(0, 1 - (t - 90) / 320)
        blast._glowBrightness = 1.2 * blast.visibility
    })

    // flames thrown out and up, slowing as they swell
    const burst = fireParticles(scene, "fireball.burst", 90, "flame2", middle.clone())
    burst.createHemisphericEmitter(0.3, 1)
    burst.manualEmitCount = 75
    burst.targetStopDuration = 0.1
    burst.minEmitPower = radius * 2.3
    burst.maxEmitPower = radius * 4.6
    burst.minLifeTime = 0.35
    burst.maxLifeTime = 0.75
    burst.gravity = new Vector3(0, 3, 0)
    burst.minInitialRotation = -Math.PI
    burst.maxInitialRotation = Math.PI
    burst.minAngularSpeed = -2
    burst.maxAngularSpeed = 2
    burst.addSizeGradient(0, 0.4, 0.65)
    burst.addSizeGradient(0.4, 0.85, 1.25)
    burst.addSizeGradient(1, 1.1, 1.5)
    burst.addDragGradient(0, 0)
    burst.addDragGradient(1, 0.92)
    flameColors(burst, palette)
    burst.start()

    // the smoke rolling up after it
    const smoke = fireParticles(scene, "fireball.column", 60, "smoke", at.add(new Vector3(0, 0.3, 0)), ParticleSystem.BLENDMODE_STANDARD)
    smoke.createDirectedCylinderEmitter(radius * 0.45, 0.4, 1, new Vector3(-0.35, 1, -0.35), new Vector3(0.35, 1.5, 0.35))
    smoke.emitRate = 150
    smoke.targetStopDuration = 0.3
    smoke.startDelay = 60
    smoke.minEmitPower = 0.8
    smoke.maxEmitPower = 1.8
    smoke.minLifeTime = 1.3
    smoke.maxLifeTime = 2.1
    smoke.gravity = new Vector3(0, 0.9, 0)
    smoke.minInitialRotation = -Math.PI
    smoke.maxInitialRotation = Math.PI
    smoke.minAngularSpeed = -0.8
    smoke.maxAngularSpeed = 0.8
    smoke.addSizeGradient(0, 0.5, 0.8)
    smoke.addSizeGradient(1, 1.6, 2.4)
    smoke.addDragGradient(0, 0)
    smoke.addDragGradient(1, 0.7)
    smoke.addColorGradient(0, c4(palette.smoke, 0))
    smoke.addColorGradient(0.08, c4(palette.smoke, 0.8))
    smoke.addColorGradient(0.55, c4(palette.smoke.scale(1.6), 0.5))
    smoke.addColorGradient(1, c4(palette.smoke.scale(2.2), 0))
    smoke.start()

    // dirt and stones kicked up, falling back
    const dirt = fireParticles(scene, "fireball.dirt", 20, clodTexture(scene), at.add(new Vector3(0, 0.1, 0)), ParticleSystem.BLENDMODE_STANDARD)
    dirt.createHemisphericEmitter(0.4, 1)
    dirt.manualEmitCount = 16
    dirt.targetStopDuration = 0.1
    dirt.minEmitPower = 4
    dirt.maxEmitPower = 7
    dirt.minLifeTime = 0.7
    dirt.maxLifeTime = 1.05
    dirt.gravity = new Vector3(0, -12, 0)
    dirt.minSize = 0.07
    dirt.maxSize = 0.17
    dirt.minAngularSpeed = -8
    dirt.maxAngularSpeed = 8
    dirt.color1 = new Color4(1, 1, 1, 1)
    dirt.color2 = new Color4(0.75, 0.72, 0.7, 1)
    dirt.colorDead = new Color4(0.75, 0.72, 0.7, 1)
    dirt.start()

    // embers everywhere, a few white-hot ones further
    sparkBurst(scene, middle, palette.hot, { count: 55, power: 9, size: [0.06, 0.16], life: [0.4, 1] })
    sparkBurst(scene, middle, palette.core, { count: 20, power: 11, size: [0.04, 0.1], life: [0.2, 0.45] })
    popShockRing(scene, at, { size: radius * 2.1, seconds: 0.22, color: palette.core })
    popShockRing(scene, at, { size: radius * 3.8, seconds: 0.55, color: palette.hot })
    scorchMark(scene, at, palette, radius)
}

// the ground it came down on, burnt - a dark blotch with embers glowing in it
// and flames licking up a while - gone after SCORCH_MARK_MS
function scorchMark(scene, at, palette, radius){
    const size = radius * 2.3
    const burn = flat(scene, "fireball.scorch", burnMaterial(scene, palette))
    const embers = flat(scene, "fireball.scorch.embers", emberMaterial(scene, palette))
    burn.scaling.set(size, 1, size)
    embers.scaling.set(size * 0.8, 1, size * 0.8)
    burn.position.set(at.x, at.y + 0.03, at.z)
    embers.position.set(at.x, at.y + 0.035, at.z)
    burn.rotation.y = Math.random() * Math.PI * 2
    embers.rotation.y = Math.random() * Math.PI * 2
    fireRing(scene, at, palette, { radius: radius * 0.7, ms: 1500, rate: 36, ring: false, size: [0.16, 0.3] })
    const start = performance.now()
    const observer = scene.onBeforeRenderObservable.add(() => {
        const t = performance.now() - start
        if(t >= SCORCH_MARK_MS){
            scene.onBeforeRenderObservable.remove(observer)
            burn.dispose()
            embers.dispose()
            return
        }
        burn.visibility = 0.92 * Math.min(1, (SCORCH_MARK_MS - t) / 1500)
        // the embers glow, flicker, and die down
        embers.visibility = Math.max(0, 1 - t / 2600) * (0.75 + 0.25 * Math.sin(t / 70))
        embers.isVisible = embers.visibility > 0.01
    })
}
