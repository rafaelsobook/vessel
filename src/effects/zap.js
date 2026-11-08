import { Color3, Color4, Constants, Mesh, MeshBuilder, ParticleSystem, StandardMaterial, Vector3 } from "@babylonjs/core"
import { buildBoltPath, makeRadiusFunction } from "./lightning.js"
import { addGlow } from "../tools/glow.js"
import { getParticleTexture, particleTexturePath } from "../tools/particlesystem.js"
import { sparkBurst } from "./blessingFx.js"

// LIGHTNING, ENEMY TO PLAYER (enemies/rangeAttack.js runs the timeline):
//  1. the charge - a ball of light swelling over the enemy, sparks sucked into
//     it, arcs crackling round its body
//  2. the stepped leader - faint, forking tendrils groping out to the spot it
//     locked on to, like real lightning feeling its way down before it strikes
//  3. the return stroke - a white-hot bolt with a coloured halo and forks,
//     re-struck twice in a blink, a burst of light and sparks where it lands
// No lights anywhere: adding and removing them recompiles every material
// they touch (and past 8 the shaders stop compiling - tools/lightBudget.js).
// The glow layer (tools/glow.js) does the shine instead.

// core: the white-hot middle. glow: what it blooms (mesh._glowColor). halo /
// spark / rim: the soft outer bolt, the sparks, a lit body's edge
const PALETTES = {
    yellow: { core: new Color3(1, 1, 0.88), glow: new Color3(1, 0.85, 0.22), halo: new Color3(1, 0.78, 0.18), spark: new Color3(1, 0.86, 0.3), rim: new Color3(1, 0.82, 0.2) },
    cyan:   { core: new Color3(0.9, 1, 1),  glow: new Color3(0.3, 0.9, 1),   halo: new Color3(0.25, 0.8, 1),  spark: new Color3(0.5, 0.95, 1), rim: new Color3(0.35, 0.9, 1) },
    blue:   { core: new Color3(0.9, 0.95, 1), glow: new Color3(0.3, 0.55, 1), halo: new Color3(0.25, 0.5, 1), spark: new Color3(0.55, 0.75, 1), rim: new Color3(0.35, 0.6, 1) },
    purple: { core: new Color3(1, 0.9, 1),  glow: new Color3(0.7, 0.3, 1),   halo: new Color3(0.62, 0.25, 1), spark: new Color3(0.8, 0.55, 1), rim: new Color3(0.72, 0.35, 1) },
    white:  { core: new Color3(1, 1, 1),    glow: new Color3(0.85, 0.92, 1), halo: new Color3(0.8, 0.88, 1),  spark: new Color3(0.95, 0.97, 1), rim: new Color3(0.9, 0.95, 1) },
}
PALETTES.violet = PALETTES.purple

export function zapPalette(color = "yellow"){
    const palette = PALETTES[color] ?? PALETTES.yellow
    return { ...palette, name: PALETTES[color] ? color : "yellow" }
}

// shared per scene and palette - a bolt is struck every few seconds, its
// materials needn't be made and thrown away each time
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
function glowingMaterial(scene, name, color, alpha = 1){
    return material(scene, name, () => {
        const mat = new StandardMaterial(name, scene)
        mat.disableLighting = true
        mat.diffuseColor = Color3.Black()
        mat.specularColor = Color3.Black()
        mat.emissiveColor = color.clone()
        mat.alpha = alpha
        if(alpha < 1){
            mat.alphaMode = Constants.ALPHA_ADD
            mat.disableDepthWrite = true
        }
        return mat
    })
}
const coreMaterial = (scene, palette) => glowingMaterial(scene, `zap.core.${palette.name}`, palette.core)
const haloMaterial = (scene, palette) => glowingMaterial(scene, `zap.halo.${palette.name}`, palette.halo, 0.35)

function dropGlow(mesh){
    mesh?._glowLayer?.removeIncludedOnlyMesh(mesh)
}
function noPick(mesh){
    mesh.isPickable = false
    return mesh
}

// a jagged tube along `path` that can be reshaped in place (same point count)
function boltTube(scene, name, path, radiusFunction, mat){
    const tube = noPick(MeshBuilder.CreateTube(name, { path, radiusFunction, tessellation: 5, cap: Mesh.CAP_ALL, updatable: true }, scene))
    tube.material = mat
    return tube
}
function reshape(scene, tube, path, radiusFunction){
    MeshBuilder.CreateTube(tube.name, { path, radiusFunction, instance: tube }, scene)
}

// ── ready before it's needed ───────────────────────────────────────────────

const prewarmed = new WeakMap()   // scene -> Set(palette name)

/**
 * Everything a zap draws, compiled and loaded ahead of the first one - or its
 * first charge and bolt stay invisible for a few frames while their shaders
 * compile and their textures arrive. Once per scene and colour
 * (enemies/rangeAttack.js, when an enemy that zaps shows up).
 */
export function prewarmZap(scene, color){
    if(!scene || scene.isDisposed) return
    const palette = zapPalette(color)
    let done = prewarmed.get(scene)
    if(!done) prewarmed.set(scene, done = new Set())
    if(done.has(palette.name)) return
    done.add(palette.name)
    // the sparks', the smoke's textures - loading now
    ;["flare", "thin1", "smoke"].forEach(name => getParticleTexture(scene, particleTexturePath(name)))
    // the particle shader, on one spark nobody will see
    sparkBurst(scene, new Vector3(0, -1000, 0), palette.spark, { count: 1, power: 0, life: [0.05, 0.05] })
    // the materials, against the shapes they go on - a tube and a sphere -
    // and the glow pass over them
    const tube = noPick(MeshBuilder.CreateTube("zap.prewarm.tube", { path: [Vector3.Zero(), new Vector3(0, 1, 0)], radius: 0.01, tessellation: 5, cap: Mesh.CAP_ALL }, scene))
    const sphere = noPick(MeshBuilder.CreateSphere("zap.prewarm.sphere", { diameter: 0.01, segments: 10 }, scene))
    tube.isVisible = sphere.isVisible = false
    const core = coreMaterial(scene, palette)
    const halo = haloMaterial(scene, palette)
    tube.material = core
    sphere.material = core
    addGlow(scene, tube, 1)
    addGlow(scene, sphere, 1)
    ;[tube, sphere].forEach(mesh => mesh._glowLayer?.isReady(mesh.subMeshes[0], false))
    Promise.all([core.forceCompilationAsync(tube), core.forceCompilationAsync(sphere), halo.forceCompilationAsync(tube)])
        .catch(() => {})
        .finally(() => [tube, sphere].forEach(mesh => { dropGlow(mesh); mesh.dispose() }))
}

// ── 1. the charge ────────────────────────────────────────────────────────────

// a charge still there this long after it should have struck goes by itself -
// whatever stopped the strike, it doesn't hang over its caster for good
const ORPHANED_AFTER_MS = 1500

/**
 * A ball of light swelling at getAnchor() for `ms`, sparks pulled into it from
 * all round. flash() - the moment it locks on: a white pop. Disposed by the
 * caller (dispose()), or by itself once the scene goes - or once it's
 * ORPHANED_AFTER_MS past its time.
 */
export function chargeOrb(scene, getAnchor, palette, ms){
    const start = performance.now()
    const orb = noPick(MeshBuilder.CreateSphere("zap.charge", { diameter: 1, segments: 10 }, scene))
    orb.material = coreMaterial(scene, palette)
    orb._glowColor = palette.glow
    addGlow(scene, orb, 1.2)
    orb.scaling.setAll(0.05)
    orb.position.copyFrom(getAnchor())

    // sparks sucked in - a sphere emitter shooting inward (negative power),
    // each one dying as it reaches the middle
    const emitAt = getAnchor().clone()
    const gather = new ParticleSystem("zap.gather", 90, scene)
    gather.particleTexture = getParticleTexture(scene, particleTexturePath("flare"))
    gather.emitter = emitAt
    gather.createSphereEmitter(1.15, 0)
    gather.minEmitPower = -3.4
    gather.maxEmitPower = -2.6
    gather.minLifeTime = 0.3
    gather.maxLifeTime = 0.38
    gather.emitRate = 160
    gather.updateSpeed = 1 / 60
    gather.blendMode = ParticleSystem.BLENDMODE_ADD
    gather.addSizeGradient(0, 0.05, 0.12)
    gather.addSizeGradient(1, 0.01, 0.02)
    gather.color1 = new Color4(palette.spark.r, palette.spark.g, palette.spark.b, 1)
    gather.color2 = new Color4(1, 1, 1, 1)
    gather.colorDead = new Color4(palette.spark.r, palette.spark.g, palette.spark.b, 0)
    gather.start()

    let flashAt = 0
    let disposed = false
    const observer = scene.onBeforeRenderObservable.add(() => {
        if(performance.now() - start > ms + ORPHANED_AFTER_MS) return dispose()
        const t = Math.min(1, (performance.now() - start) / ms)
        // swells faster as it goes, and won't hold still
        const size = 0.12 + 0.32 * t * t
        const flash = flashAt ? Math.max(0, 1 - (performance.now() - flashAt) / 140) : 0
        const shiver = 1 + (Math.random() - 0.5) * 0.22
        orb.scaling.setAll((size + flash * 0.35) * shiver)
        orb._glowBrightness = 1.2 + 2.2 * t + flash * 3
        const at = getAnchor()
        orb.position.copyFrom(at)
        emitAt.copyFrom(at)
        // more sparks the fuller it gets
        gather.emitRate = 120 + 220 * t
    })

    function dispose(){
        if(disposed) return
        disposed = true
        scene.onBeforeRenderObservable.remove(observer)
        dropGlow(orb)
        orb.dispose()
        gather.stop()
        // its last sparks fly in first - and not disposeOnStop: that takes the
        // shared particle texture with it (tools/particlesystem.js's cache)
        setTimeout(() => { if(!scene.isDisposed) gather.dispose(false) }, 450)
    }
    return {
        position: () => orb.position.clone(),
        flash(){ flashAt = performance.now() },
        dispose,
    }
}

// ── crackling arcs ───────────────────────────────────────────────────────────

/**
 * `count` little arcs jumping about, every `interval` ms between the two
 * points pickEnds() hands back (world space) - round an enemy's body, or
 * from joint to joint of someone being electrocuted.
 */
export function crackle(scene, pickEnds, palette, { count = 3, interval = 45, width = 0.014, segments = 6 } = {}){
    const radiusFunction = makeRadiusFunction(segments, width, width * 1.8)
    const mat = coreMaterial(scene, palette)
    const arcs = []
    const arcPath = () => {
        const [a, b] = pickEnds()
        return buildBoltPath(a, b, segments, Math.max(0.08, Vector3.Distance(a, b) * 0.35))
    }
    for(let i = 0; i < count; i++){
        const arc = boltTube(scene, `zap.arc.${i}`, arcPath(), radiusFunction, mat)
        arc._glowColor = palette.glow
        addGlow(scene, arc, 1.6)
        arcs.push(arc)
    }
    let last = 0
    const observer = scene.onBeforeRenderObservable.add(() => {
        const now = performance.now()
        if(now - last < interval) return
        last = now
        arcs.forEach(arc => {
            reshape(scene, arc, arcPath(), radiusFunction)
            // now and then one blinks out for a beat
            arc.isVisible = Math.random() > 0.18
        })
    })
    return {
        dispose(){
            scene.onBeforeRenderObservable.remove(observer)
            arcs.forEach(arc => { dropGlow(arc); arc.dispose() })
        },
    }
}

// a random point on a sphere's surface
export function pointOnSphere(center, radius){
    const u = Math.random() * 2 - 1
    const a = Math.random() * Math.PI * 2
    const r = Math.sqrt(1 - u * u)
    return new Vector3(center.x + r * Math.cos(a) * radius, center.y + u * radius, center.z + r * Math.sin(a) * radius)
}

// ── 2. the stepped leader ────────────────────────────────────────────────────

/**
 * Two faint tendrils groping from `from` to `to` over `ms` - fork-tipped,
 * flickering - where the bolt is about to go. Gone by itself after `ms`.
 */
export function steppedLeader(scene, from, to, palette, ms){
    const start = performance.now()
    const segments = 9
    const width = 0.011
    const radiusFunction = makeRadiusFunction(segments, width, width * 1.6)
    const mat = coreMaterial(scene, palette)
    const length = Vector3.Distance(from, to)
    // each tendril aims a little off the spot, as a leader does
    const aims = [0, 1].map(() => to.add(new Vector3((Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.9)))
    const pathTo = (aim, reach) => buildBoltPath(from, Vector3.Lerp(from, aim, reach), segments, length * 0.09 * Math.max(0.3, reach))
    const tendrils = aims.map((aim, i) => {
        const tendril = boltTube(scene, `zap.leader.${i}`, pathTo(aim, 0.05), radiusFunction, mat)
        tendril._glowColor = palette.glow
        addGlow(scene, tendril, 0.9)
        return tendril
    })
    let last = 0
    const observer = scene.onBeforeRenderObservable.add(() => {
        const now = performance.now()
        const t = (now - start) / ms
        if(t >= 1){
            scene.onBeforeRenderObservable.remove(observer)
            tendrils.forEach(tendril => { dropGlow(tendril); tendril.dispose() })
            return
        }
        // steps forward in jerks, not a smooth slide
        if(now - last < 45) return
        last = now
        const reach = Math.min(1, 0.15 + Math.floor(t * 7) / 7)
        tendrils.forEach((tendril, i) => {
            reshape(scene, tendril, pathTo(aims[i], reach * (i ? 0.92 : 1)), radiusFunction)
            tendril.isVisible = Math.random() > 0.25
            tendril.visibility = 0.45 + Math.random() * 0.4
        })
    })
}

// ── 3. the return stroke ─────────────────────────────────────────────────────

// when the bolt blinks out between its strokes, ms after it first strikes
const STROKE_GAPS = [[75, 100], [170, 192]]
const BOLT_LIFE_MS = 360
const BOLT_FADE_FROM_MS = 240

/**
 * The bolt itself, from -> to: white-hot core blooming its colour, a soft
 * halo, three forks. Reshaped every few ms so it writhes, blinks out twice
 * and comes back (re-strikes), then fades. Cleans itself up.
 */
export function strikeBolt(scene, from, to, palette, { width = 0.04 } = {}){
    const start = performance.now()
    const length = Vector3.Distance(from, to)
    const segments = Math.max(8, Math.min(22, Math.round(length * 1.4)))
    const jitter = Math.max(0.25, length * 0.075)
    const coreRadius = makeRadiusFunction(segments, width, width * 1.9)
    const haloRadius = makeRadiusFunction(segments, width * 3, width * 5.5)
    const forkSegments = 5
    const forkRadius = makeRadiusFunction(forkSegments, width * 0.45, width * 0.8)

    let path = buildBoltPath(from, to, segments, jitter)
    const core = boltTube(scene, "zap.bolt", path, coreRadius, coreMaterial(scene, palette))
    core._glowColor = palette.glow
    addGlow(scene, core, 2.6)
    const halo = boltTube(scene, "zap.halo", path, haloRadius, haloMaterial(scene, palette))

    // forks: off a point part-way down the bolt, angled away from it
    const along = to.subtract(from).normalize()
    const forks = [0, 1, 2].map(i => ({
        at: 2 + Math.floor(Math.random() * Math.max(1, segments - 5)),
        dir: along.add(new Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 0.8, Math.random() - 0.5).scale(1.6)).normalize(),
        reach: length * (0.1 + Math.random() * 0.16),
        tube: null,
        index: i,
    }))
    const forkPath = fork => {
        const base = path[Math.min(fork.at, path.length - 2)]
        return buildBoltPath(base, base.add(fork.dir.scale(fork.reach)), forkSegments, fork.reach * 0.3)
    }
    forks.forEach(fork => {
        fork.tube = boltTube(scene, `zap.fork.${fork.index}`, forkPath(fork), forkRadius, coreMaterial(scene, palette))
        fork.tube._glowColor = palette.glow
        addGlow(scene, fork.tube, 1.8)
    })

    const parts = [core, halo, ...forks.map(fork => fork.tube)]
    let lastShape = start
    const observer = scene.onBeforeRenderObservable.add(() => {
        const now = performance.now()
        const t = now - start
        if(t >= BOLT_LIFE_MS){
            scene.onBeforeRenderObservable.remove(observer)
            parts.forEach(part => { dropGlow(part); part.dispose() })
            return
        }
        // a fresh shape every few ms - and a brand new one after each blink
        if(now - lastShape > 32){
            lastShape = now
            path = buildBoltPath(from, to, segments, jitter)
            reshape(scene, core, path, coreRadius)
            reshape(scene, halo, path, haloRadius)
            forks.forEach(fork => reshape(scene, fork.tube, forkPath(fork), forkRadius))
        }
        const dark = STROKE_GAPS.some(([a, b]) => t >= a && t < b)
        const fade = t > BOLT_FADE_FROM_MS ? 1 - (t - BOLT_FADE_FROM_MS) / (BOLT_LIFE_MS - BOLT_FADE_FROM_MS) : 1
        parts.forEach(part => {
            part.isVisible = !dark
            part.visibility = fade
        })
        core._glowBrightness = 2.6 * fade
        forks.forEach(fork => { fork.tube._glowBrightness = 1.8 * fade })
    })
}

// ── where it lands ───────────────────────────────────────────────────────────

/**
 * The blast where a bolt lands: a pop of light, a spray of sparks (white and
 * coloured), a few heavier embers that fall.
 */
export function zapImpact(scene, at, palette, { big = true } = {}){
    if(!scene || scene.isDisposed) return
    // the pop - a handful of big, short-lived flares
    sparkBurst(scene, at, palette.core, { count: big ? 4 : 2, power: 0.2, size: big ? [1.4, 2.1] : [0.8, 1.2], life: [0.07, 0.13] })
    sparkBurst(scene, at, palette.spark, { count: big ? 70 : 35, power: big ? 7 : 5, size: [0.1, 0.24], life: [0.2, 0.55] })
    sparkBurst(scene, at, Color3.White(), { count: big ? 24 : 12, power: big ? 9 : 6, size: [0.05, 0.12], life: [0.12, 0.3] })
}
