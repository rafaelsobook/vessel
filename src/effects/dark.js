import { Color3, Color4, NoiseProceduralTexture, ParticleSystem, PointLight, StandardMaterial, TransformNode, Vector3, MeshBuilder, Mesh } from "@babylonjs/core"
import { addGlow } from "../tools/glow.js"
import { getLocalBoundingBox, pickArcEndpoints, buildBoltPath, makeRadiusFunction } from "./lightning.js"
import { FIRE_PALETTES, fireTextures } from "./transformationFire.js"

// attachDark(scene, mesh, palette, weaponGlow, options) - attachLightning's
// dark twin: the evolution's demon fire (effects/transformationFire.js) kept
// burning on a mesh - black flame with a burning edge, smoke, embers and the
// odd black spike - with black lightning crackling over it, glowing in the
// fire's colour round its edges and now and then flashing ember-hot.
//
// The bolts are drawn black and glow in the palette's blood red (glow.js's
// _glowColor). The glow layer is composited over everything after the scene,
// so no draw order puts the black over it - the core stays dark only because
// that glow is deep. A flashing bolt glows ember.
//
// The fire comes off the mesh's bounding box (the same box attachLightning's
// arcs run over), not off bones, so it fits a sword as well as a body. Its
// size follows the mesh's: a body's flames are the evolution's, a sword's
// smaller. It rises in the world whichever way the mesh is held, and trails
// behind it as it moves.
//
// The particle systems are NOT emitted from the mesh: a mesh being disposed
// disposes every system it's the emitter of, textures and all, and these
// textures are shared (particlesystem.js's cache). They emit from the world
// origin and place each particle on the mesh themselves.
//
// Every system runs on updateSpeed 1/60: lifetimes in seconds, emitRate per
// second, sizes in metres (size gradients ARE the sizes).

const UPDATE_SPEED = 1 / 60
// a body's diagonal, near enough - a mesh this size burns at the evolution's
// own flame sizes, a smaller one smaller
const BODY_DIAGONAL = 1.8
const BREATH_RATE = 0.8
const BREATH_DEPTH = 0.2

const rand = (a, b) => a + Math.random() * (b - a)
const c4 = (color, alpha) => new Color4(color.r, color.g, color.b, alpha)

function sizeOverLife(ps, stops, scale){
    stops.forEach(([at, small, big]) => ps.addSizeGradient(at, small * scale, big * scale))
}

// palette: a FIRE_PALETTES name or one of its entries. weaponGlow: the mesh
// itself turns black with a glow round it in the fire's colour (put back as
// it was when this goes). options - all optional:
//   arcCount, segments, width, maxWidth, tessellation, updateInterval,
//   glowIntensity - the lightning, as attachLightning's
//   flashChance - the share of arcs that flash ember-hot on each reshape
//   scale - flame size (1: a body's); worked out from the mesh if not given
//   density - how much fire (1: the default amount)
//   spikes - black spikes lashing out of the middle (on by default)
//   withLight - a flickering light in the fire's colour (off by default:
//     every light counts against each material's light limit)
export function attachDark(scene, mesh, palette = "demon", weaponGlow = false, options = {}) {
    if (!scene || !mesh) return null

    const colors = typeof palette === "string" ? (FIRE_PALETTES[palette] ?? FIRE_PALETTES.demon) : palette
    const {
        arcCount = 3,
        segments = 7,
        width = 0.024,
        maxWidth = width * 2,
        tessellation = 5,
        updateInterval = 70,
        glowIntensity = 1.6,
        flashChance = 0.2,
        density = 1,
        spikes: withSpikes = true,
        withLight = false,
    } = options

    const { min, max } = getLocalBoundingBox(mesh)
    const size = max.subtract(min)
    const center = min.add(max).scale(0.5)
    const half = size.scale(0.5)
    const diagonal = Vector3.TransformNormal(size, mesh.computeWorldMatrix(true)).length()
    const scale = options.scale ?? Math.min(1.4, Math.max(0.35, diagonal / BODY_DIAGONAL))
    const rateScale = scale * density
    const tex = fireTextures(scene, colors)

    const root = new TransformNode(`dark_${mesh.name || "mesh"}_${Date.now()}`, scene)
    root.parent = mesh

    // ── the lightning: black bolts glowing in the fire's colour ──

    const darkMat = new StandardMaterial(`${root.name}_mat`, scene)
    darkMat.diffuseColor = Color3.Black()
    darkMat.specularColor = Color3.Black()
    darkMat.emissiveColor = Color3.Black()
    darkMat.disableLighting = true
    // a flash: the bolt burning ember-hot for one reshape
    const hotMat = new StandardMaterial(`${root.name}_hotMat`, scene)
    hotMat.diffuseColor = Color3.Black()
    hotMat.specularColor = Color3.Black()
    hotMat.emissiveColor = colors.ember
    hotMat.disableLighting = true

    // the mesh itself gone black and glowing - what it was, to put back
    const glowing = []
    if (weaponGlow) {
        const parts = mesh.getChildMeshes()
        ;(parts.length ? parts : [mesh]).forEach(part => {
            glowing.push({ part, material: part.material, glowColor: part._glowColor, brightness: part._glowBrightness, hadGlow: !!part._glowLayer })
            part.material = darkMat
            part._glowColor = colors.blood
            addGlow(scene, part, glowIntensity)
        })
    }

    const jitterAmount = ((size.x + size.y + size.z) / 3) * 0.35
    const radiusFunction = makeRadiusFunction(segments, width, maxWidth)
    const arcs = []
    for (let i = 0; i < arcCount; i++) {
        const [start, end] = pickArcEndpoints(min, max, size)
        const tube = MeshBuilder.CreateTube(`${root.name}_arc${i}`, {
            path: buildBoltPath(start, end, segments, jitterAmount), radiusFunction, tessellation, cap: Mesh.CAP_ALL, updatable: true,
        }, scene)
        tube.parent = root
        tube.isPickable = false
        tube.material = darkMat
        tube._glowColor = colors.blood
        addGlow(scene, tube, glowIntensity)
        arcs.push(tube)
    }

    let light = null
    if (withLight) {
        light = new PointLight(`${root.name}_light`, center.clone(), scene)
        light.parent = root
        light.diffuse = colors.ember
        light.specular = Color3.Black()
        light.range = Math.max(diagonal, 1) * 2.5
        light.intensity = 0.5
    }

    // ── the fire ──

    const noise = new NoiseProceduralTexture(`${root.name}_noise`, 128, scene)
    noise.animationSpeedFactor = 6
    noise.persistence = 2
    noise.brightness = 0.5
    noise.octaves = 2

    const origin = Vector3.Zero()
    const systems = []

    // a random spot in the mesh's box (spread: share of the box), in the world
    function inBox(out, spread = 1){
        Vector3.TransformCoordinatesFromFloatsToRef(
            center.x + rand(-1, 1) * half.x * spread,
            center.y + rand(-1, 1) * half.y * spread,
            center.z + rand(-1, 1) * half.z * spread,
            mesh.getWorldMatrix(), out)
    }
    function upward(out, spread){
        out.set(rand(-spread, spread), rand(0.85, 1.25), rand(-spread, spread))
    }

    function system(name, capacity, texture, blendMode, rate){
        const ps = new ParticleSystem(`${root.name}_${name}`, capacity, scene)
        ps.particleTexture = texture
        ps.emitter = origin
        ps.isLocal = false
        ps.blendMode = blendMode
        ps.updateSpeed = UPDATE_SPEED
        ps._rate = rate * rateScale
        ps.emitRate = ps._rate
        systems.push(ps)
        return ps
    }

    const smoke = system("smoke", 80, tex.smoke, ParticleSystem.BLENDMODE_STANDARD, 12)
    smoke.startPositionFunction = (m, pos) => inBox(pos, 1.2)
    smoke.startDirectionFunction = (m, dir) => upward(dir, 0.3)
    smoke.minEmitPower = 0.3
    smoke.maxEmitPower = 0.7
    smoke.gravity = new Vector3(0, 0.5, 0)
    smoke.minLifeTime = 1.2
    smoke.maxLifeTime = 2
    sizeOverLife(smoke, [[0, 0.2, 0.35], [1, 0.6, 1.0]], scale)
    smoke.minInitialRotation = 0
    smoke.maxInitialRotation = Math.PI * 2
    smoke.minAngularSpeed = -0.6
    smoke.maxAngularSpeed = 0.6
    smoke.addColorGradient(0, c4(colors.smoke, 0))
    smoke.addColorGradient(0.2, c4(colors.smoke, 0.35))
    smoke.addColorGradient(1, c4(colors.smoke, 0))

    // the burning edge, added, and the black flame drawn over it, narrower -
    // transformationFire.js's flameLayer, on the box instead of the bones
    function flameLayer(name, capacity, rate, dark){
        const ps = system(name, capacity, tex.flame, dark ? ParticleSystem.BLENDMODE_STANDARD : ParticleSystem.BLENDMODE_ADD, rate)
        ps.startPositionFunction = (m, pos) => inBox(pos, dark ? 0.8 : 1)
        ps.startDirectionFunction = (m, dir) => upward(dir, 0.3)
        ps.billboardMode = ParticleSystem.BILLBOARDMODE_Y
        const s = 0.22 * (dark ? 0.85 : 1)
        sizeOverLife(ps, [[0, s * 0.5, s * 0.9], [0.25, s, s * 1.9], [1, s * 0.25, s * 0.45]], scale)
        ps.minScaleX = 0.6
        ps.maxScaleX = 0.85
        ps.minScaleY = 2
        ps.maxScaleY = 3
        ps.minLifeTime = 0.4
        ps.maxLifeTime = 0.75 * (dark ? 1 : 0.9)
        ps.minEmitPower = 0.5 * scale
        ps.maxEmitPower = 1.2 * scale
        ps.gravity = new Vector3(0, 1.1 * scale, 0)
        ps.minInitialRotation = -0.15
        ps.maxInitialRotation = 0.15
        if(dark){
            ps.addColorGradient(0, c4(colors.char, 0))
            ps.addColorGradient(0.15, new Color4(0, 0, 0, 0.8))
            ps.addColorGradient(0.6, c4(colors.char, 0.55))
            ps.addColorGradient(1, new Color4(0, 0, 0, 0))
        } else {
            ps.addColorGradient(0, c4(colors.ember, 0))
            ps.addColorGradient(0.12, c4(colors.ember, 0.9))
            ps.addColorGradient(0.5, c4(colors.blood, 0.55))
            ps.addColorGradient(1, c4(colors.blood, 0))
        }
        ps.noiseTexture = noise
        ps.noiseStrength = new Vector3(1, 0.3, 1)
        return ps
    }
    flameLayer("edge", 200, 120, false)
    flameLayer("fire", 230, 140, true)

    if(withSpikes){
        const spikes = system("spikes", 30, tex.spike, ParticleSystem.BLENDMODE_STANDARD, 5)
        spikes.startPositionFunction = (m, pos) => inBox(pos, 0.3)
        spikes.startDirectionFunction = (m, dir) => {
            const a = Math.random() * Math.PI * 2
            const out = rand(0.45, 0.95)
            dir.set(Math.cos(a) * out, rand(0.75, 1.35), Math.sin(a) * out)
        }
        spikes.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED
        sizeOverLife(spikes, [[0, 0.06, 0.1], [0.2, 0.14, 0.22], [1, 0.08, 0.12]], scale)
        spikes.minScaleY = 3.2
        spikes.maxScaleY = 4.8
        // kept moving the whole way: stretched billboards misdraw when still
        spikes.minEmitPower = 2.2 * scale
        spikes.maxEmitPower = 3.8 * scale
        spikes.gravity = new Vector3(0, 2 * scale, 0)
        spikes.minLifeTime = 0.3
        spikes.maxLifeTime = 0.5
        spikes.addColorGradient(0, new Color4(1, 1, 1, 0))
        spikes.addColorGradient(0.12, new Color4(1, 1, 1, 0.95))
        spikes.addColorGradient(0.7, new Color4(1, 1, 1, 0.7))
        spikes.addColorGradient(1, new Color4(1, 1, 1, 0))
    }

    const embers = system("embers", 80, tex.spark, ParticleSystem.BLENDMODE_ADD, 20)
    embers.startPositionFunction = (m, pos) => inBox(pos, 1.2)
    embers.startDirectionFunction = (m, dir) => dir.set(rand(-0.6, 0.6), rand(0.6, 1.3), rand(-0.6, 0.6))
    embers.minEmitPower = 0.8
    embers.maxEmitPower = 2
    embers.gravity = new Vector3(0, 0.6, 0)
    sizeOverLife(embers, [[0, 0.3, 0.55], [1, 0, 0.05]], Math.max(0.6, scale))
    embers.minLifeTime = 0.8
    embers.maxLifeTime = 1.4
    embers.minInitialRotation = 0
    embers.maxInitialRotation = Math.PI
    embers.minAngularSpeed = -3
    embers.maxAngularSpeed = 3
    embers.color1 = c4(colors.hot, 1)
    embers.color2 = c4(colors.ember, 1)
    embers.colorDead = c4(colors.blood, 0)
    embers.noiseTexture = noise
    embers.noiseStrength = new Vector3(1.2, 0.4, 1.2)

    systems.forEach(ps => ps.start())

    // ── running it ──

    let intensity = 1
    let breathTime = 0
    let acc = 0
    const observer = scene.onBeforeRenderObservable.add(() => {
        const dt = scene.getEngine().getDeltaTime()
        breathTime += dt / 1000
        const breath = 1 + BREATH_DEPTH * Math.sin(breathTime * Math.PI * 2 * BREATH_RATE)
        systems.forEach(ps => { ps.emitRate = ps._rate * intensity * breath })

        acc += dt
        if (acc < updateInterval) return
        acc = 0
        for (const tube of arcs) {
            const [start, end] = pickArcEndpoints(min, max, size)
            MeshBuilder.CreateTube(tube.name, { path: buildBoltPath(start, end, segments, jitterAmount), radiusFunction, instance: tube }, scene)
            const flash = Math.random() < flashChance
            tube.material = flash ? hotMat : darkMat
            // a flash glows its own ember; a dark bolt the deep blood red -
            // the glow is drawn over everything, so a brighter one would
            // wash its black out to orange
            tube._glowColor = flash ? null : colors.blood
            tube.isVisible = intensity > 0
        }
        if (light) light.intensity = (0.3 + Math.random() * 0.4) * intensity
    })

    // 0 (out) to 1 (full) - the fire and the light; the arcs hide at 0
    function setIntensity(next){
        intensity = Math.max(0, next)
    }

    let disposed = false
    function dispose() {
        if (disposed) return
        disposed = true
        scene.onBeforeRenderObservable.remove(observer)
        mesh.onDisposeObservable.remove(disposeObserver)
        // not dispose(true): the textures are shared
        systems.forEach(ps => ps.dispose(false))
        noise.dispose()
        for (const tube of arcs) {
            if (tube._glowLayer) tube._glowLayer.removeIncludedOnlyMesh(tube)
            tube.dispose()
        }
        glowing.forEach(({ part, material, glowColor, brightness, hadGlow }) => {
            if (part.isDisposed()) return
            part.material = material
            part._glowColor = glowColor
            part._glowBrightness = brightness
            if (!hadGlow && part._glowLayer) {
                part._glowLayer.removeIncludedOnlyMesh(part)
                part._glowLayer = null
            }
        })
        darkMat.dispose()
        hotMat.dispose()
        if (light) light.dispose()
        root.dispose()
    }

    const disposeObserver = mesh.onDisposeObservable.addOnce(dispose)

    return { root, arcs, light, systems, setIntensity, dispose }
}
