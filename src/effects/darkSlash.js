import { Color3, Color4, Constants, DynamicTexture, FresnelParameters, Material, Matrix, Mesh, MeshBuilder, ParticleSystem, Quaternion, StandardMaterial, Texture, Vector3, VertexData } from "@babylonjs/core"
import { getSocketContainers } from "../sockets/worldsocket.js"
import { addGlow } from "../tools/glow.js"
import { getParticleTexture, particleTexturePath } from "../tools/particlesystem.js"
import { bakedCrescent, gashTexture } from "./crescentHowl.js"
import { fireParticles } from "./fireball.js"
import { popShockRing } from "./shockRing.js"
import { sparkBurst } from "./blessingFx.js"
import { prewarmSonicDistortion, shockRipple } from "./sonicDistortion.js"

// THE FURY CUTTERS, ENEMY TO PLAYER - the dark slime's ranged attack
// (enemies/rangeAttack.js runs the timeline): crescents of its own dark
// liquid, thrown two or three at a time, a getsuga-tensho-style slash.
//  1. the charge (chargeDarkSlash) - it draws itself in: black flames pour
//     up off it, a pool of its dark spreads under it, violet light is sucked
//     into it from all round
//  2. the lock - a glint flashes off it (the beat before a blade is drawn),
//     and the lanes the cutters will fly down light up on the ground
//  3. each cutter's release (slashRelease) - a spray of its liquid and
//     sparks, a ring off its feet, the air split round it
//  4. the cutter (flyDarkSlash) - crescent.glb's own outline, rebuilt as a
//     blade with real depth (a lens across it, razor-thin at the leading
//     edge) in the dark slime's own gel (skins.js's "dark" palette): a dark
//     liquid body, violet light flowing inside it, a white-hot razor edge,
//     a violet rim round all of it. Black flames stream off its trailing
//     edge, its liquid drips off it as it goes, afterimages trail it, and it
//     scores a scar along the ground under it
// What it does to whoever it cuts: effects/slashed.js.
// The look of it is built the way a hit that feels good always is - a
// readable wind-up, a telegraph you can react to, then a release and an
// impact layered out of several short, simple pieces rather than one big
// one (meleeCombat.js's own header says the same of a plain blow).
// No lights - the glow layer (tools/glow.js) does the shine. Every particle
// system runs on updateSpeed 1/60, so its numbers are real units.

// ── palettes ─────────────────────────────────────────────────────────────────

// ink: the liquid at its darkest. body: the dark slime's own purple (skins.js's
// "dark" diffuse). vein: the light flowing inside it. edge: its rim. core:
// the razor edge, white-hot. glow: what it blooms
const c3 = (r, g, b) => new Color3(r, g, b)
const c4 = (color, alpha) => new Color4(color.r, color.g, color.b, alpha)
const PALETTES = {
    purple: {
        ink: c3(0.03, 0, 0.055), body: c3(0.28, 0.05, 0.4), vein: c3(0.58, 0.14, 1),
        edge: c3(0.76, 0.42, 1), core: c3(0.98, 0.9, 1), glow: c3(0.52, 0.12, 0.95),
    },
}
PALETTES.dark = PALETTES.purple
PALETTES.violet = PALETTES.purple

/** The cutters' colours by name - or worked out from any "#rrggbb". */
export function darkSlashPalette(color = "purple"){
    const name = String(color ?? "purple").toLowerCase()
    if(PALETTES[name]) return { ...PALETTES[name], name }
    if(/^#[0-9a-f]{6}$/.test(name)){
        const mid = Color3.FromHexString(name)
        return {
            name,
            ink: mid.scale(0.1),
            body: mid.scale(0.45),
            vein: mid,
            edge: Color3.Lerp(mid, Color3.White(), 0.35),
            core: Color3.Lerp(mid, Color3.White(), 0.88),
            glow: mid.clone(),
        }
    }
    return { ...PALETTES.purple, name: "purple" }
}

// ── the blade (crescent.glb's outline, given depth) ──────────────────────────

// crescent.glb is a flat ribbon - 14 points, no thickness. Its outline is
// kept (both arcs, tip to tip), smoothed and rebuilt ALONG x ACROSS, swelling
// to HALF_THICK through its middle: a liquid wants real curved faces for its
// rim to catch the light (skins.js's Fresnel), and a flat sheet has none
const ALONG = 40
const ACROSS = 8
const HALF_THICK = 0.075
// the razor edge's width at its widest - it thins out to the tips
const RAZOR_WIDTH = 0.07
// crescent.glb's own outline, belly leading along +z, centred - only for a
// scene where it didn't load
const FALLBACK_OUTLINE = {
    lead: [[-1.707, -0.848], [-1.466, -0.223], [-1.466, 0.086], [-0.795, 0.631], [0, 0.848], [0.795, 0.631], [1.466, 0.086], [1.466, -0.223], [1.707, -0.848]].map(([x, z]) => ({ x, z })),
    trail: [[-1.707, -0.848], [-1.466, -0.479], [-0.795, 0.128], [0, 0.412], [0.795, 0.128], [1.466, -0.479], [1.707, -0.848]].map(([x, z]) => ({ x, z })),
}

// The two arcs of a crescent mesh lying flat (crescentHowl.js's bakedCrescent -
// belly leading along +z): its boundary edges walked round from the left tip
// to the right one, both ways - the way round reaching furthest forward is
// the leading arc. null if it isn't one clean loop.
function outlineFrom(mesh){
    const pos = mesh.getVerticesData("position")
    const idx = mesh.getIndices()
    if(!pos || !idx?.length) return null
    // welded by where they are - a loader may split one point in two
    const weld = new Map()
    const points = []
    const remap = []
    for(let i = 0; i < pos.length / 3; i++){
        const key = `${Math.round(pos[i * 3] * 1000)}|${Math.round(pos[i * 3 + 2] * 1000)}`
        let id = weld.get(key)
        if(id === undefined){
            id = points.length
            weld.set(key, id)
            points.push({ x: pos[i * 3], z: pos[i * 3 + 2] })
        }
        remap.push(id)
    }
    // an edge only one triangle uses is on the outline
    const uses = new Map()
    const edgeKey = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`)
    for(let i = 0; i + 2 < idx.length; i += 3){
        const tri = [remap[idx[i]], remap[idx[i + 1]], remap[idx[i + 2]]]
        for(let k = 0; k < 3; k++){
            const a = tri[k], b = tri[(k + 1) % 3]
            if(a !== b) uses.set(edgeKey(a, b), (uses.get(edgeKey(a, b)) ?? 0) + 1)
        }
    }
    const links = new Map()
    const link = (a, b) => {
        if(!links.has(a)) links.set(a, [])
        links.get(a).push(b)
    }
    uses.forEach((count, key) => {
        if(count !== 1) return
        const [a, b] = key.split("_").map(Number)
        link(a, b)
        link(b, a)
    })
    if(links.size < 6 || [...links.values()].some(next => next.length !== 2)) return null
    let left = -1, right = -1
    links.forEach((_, id) => {
        if(left < 0 || points[id].x < points[left].x) left = id
        if(right < 0 || points[id].x > points[right].x) right = id
    })
    const walk = first => {
        const chain = [left]
        let prev = left, at = first
        while(at !== right && chain.length <= links.size){
            chain.push(at)
            const [a, b] = links.get(at)
            const next = a === prev ? b : a
            prev = at
            at = next
        }
        if(at !== right) return null
        chain.push(right)
        return chain.map(id => points[id])
    }
    const [one, two] = links.get(left)
    const a = walk(one), b = walk(two)
    if(!a || !b) return null
    const reach = chain => Math.max(...chain.map(p => p.z))
    return reach(a) >= reach(b) ? { lead: a, trail: b } : { lead: b, trail: a }
}

const catmull = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t)
// `n + 1` points evenly along a chain, smoothed through its corners
function resample(chain, n){
    const lengths = [0]
    for(let i = 1; i < chain.length; i++) lengths.push(lengths[i - 1] + Math.hypot(chain[i].x - chain[i - 1].x, chain[i].z - chain[i - 1].z))
    const total = lengths[lengths.length - 1] || 1
    const out = []
    let seg = 0
    for(let k = 0; k <= n; k++){
        const d = total * k / n
        while(seg < chain.length - 2 && lengths[seg + 1] < d) seg++
        const span = lengths[seg + 1] - lengths[seg] || 1
        const t = Math.min(1, Math.max(0, (d - lengths[seg]) / span))
        const p0 = chain[Math.max(0, seg - 1)], p1 = chain[seg], p2 = chain[seg + 1], p3 = chain[Math.min(chain.length - 1, seg + 2)]
        out.push({ x: catmull(p0.x, p1.x, p2.x, p3.x, t), z: catmull(p0.z, p1.z, p2.z, p3.z, t) })
    }
    return out
}
const taperAt = u => Math.pow(Math.sin(Math.PI * u), 0.6)

// the blade: top and bottom faces meeting at both edges, u along it, v across
// it (0 the leading edge, 1 the trailing one)
function bladeMesh(scene, lead, trail){
    const positions = [], uvs = [], indices = []
    ;[1, -1].forEach(side => {
        const base = positions.length / 3
        for(let i = 0; i <= ALONG; i++){
            const u = i / ALONG
            const taper = taperAt(u)
            for(let j = 0; j <= ACROSS; j++){
                const s = j / ACROSS
                // a lens across it, fullest a little behind the leading edge
                const swell = Math.pow(Math.sin(Math.PI * Math.pow(s, 0.75)), 0.85)
                positions.push(
                    lead[i].x + (trail[i].x - lead[i].x) * s,
                    side * HALF_THICK * swell * taper,
                    lead[i].z + (trail[i].z - lead[i].z) * s,
                )
                uvs.push(u, s)
            }
        }
        for(let i = 0; i < ALONG; i++) for(let j = 0; j < ACROSS; j++){
            const a = base + i * (ACROSS + 1) + j, b = a + 1, c = a + ACROSS + 1, d = c + 1
            if(side > 0) indices.push(a, c, b, b, c, d)
            else indices.push(a, b, c, b, d, c)
        }
    })
    let normals = []
    VertexData.ComputeNormals(positions, indices, normals)
    // the top face's normals point up, or both faces are wound the wrong way round
    const middle = ((ALONG / 2) * (ACROSS + 1) + ACROSS / 2) * 3
    if(normals[middle + 1] < 0){
        for(let k = 0; k < indices.length; k += 3) [indices[k + 1], indices[k + 2]] = [indices[k + 2], indices[k + 1]]
        normals = []
        VertexData.ComputeNormals(positions, indices, normals)
    }
    return built(scene, "darkSlash.blade", { positions, indices, normals, uvs })
}

// the razor edge: a thin strip laid along the leading arc, most of it just
// outside it - u along it, v across (0 inside, 1 outside)
function razorMesh(scene, lead, trail){
    const positions = [], uvs = [], indices = []
    let out = { x: 0, z: 1 }
    for(let i = 0; i <= ALONG; i++){
        const u = i / ALONG
        const dx = lead[i].x - trail[i].x, dz = lead[i].z - trail[i].z
        const length = Math.hypot(dx, dz)
        // at the tips the arcs meet - the way out stays the last one found
        if(length > 0.0001) out = { x: dx / length, z: dz / length }
        const w = RAZOR_WIDTH * Math.pow(Math.sin(Math.PI * u), 0.8)
        positions.push(lead[i].x - out.x * w * 0.35, 0, lead[i].z - out.z * w * 0.35)
        positions.push(lead[i].x + out.x * w * 0.65, 0, lead[i].z + out.z * w * 0.65)
        uvs.push(u, 0, u, 1)
        if(i < ALONG){
            const a = i * 2
            indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
        }
    }
    const normals = []
    VertexData.ComputeNormals(positions, indices, normals)
    return built(scene, "darkSlash.razor", { positions, indices, normals, uvs })
}

function built(scene, name, { positions, indices, normals, uvs }){
    const data = new VertexData()
    data.positions = positions
    data.indices = indices
    data.normals = normals
    data.uvs = uvs
    const mesh = new Mesh(name, scene)
    data.applyToMesh(mesh)
    // a template - only its clones draw
    mesh.isVisible = false
    mesh.isPickable = false
    return mesh
}

// one kit per scene: the two arcs and the two template meshes
const kits = new WeakMap()
function kitFor(scene){
    let kit = kits.get(scene)
    if(kit) return kit
    let outline = null
    const base = getSocketContainers()?.projectileModels?.crescent
    if(base){
        try {
            const baked = bakedCrescent(scene, base, "darkSlash.outline")
            outline = outlineFrom(baked)
            baked.dispose()
        } catch(error){
            console.warn("[darkSlash] couldn't read crescent.glb's outline", error)
        }
    }
    if(!outline){
        if(!base) console.warn("[darkSlash] crescent.glb isn't loaded (createProjectileModel.js's PROJECTILE_MODEL_PATHS) - its outline as shipped stands in")
        outline = FALLBACK_OUTLINE
    }
    const lead = resample(outline.lead, ALONG)
    const trail = resample(outline.trail, ALONG)
    kit = { lead, trail, blade: bladeMesh(scene, lead, trail), razor: razorMesh(scene, lead, trail) }
    kits.set(scene, kit)
    scene.onDisposeObservable.addOnce(() => kits.delete(scene))
    return kit
}

// a point on the blade at u (along) and s (across), its own space
function bladePoint(kit, u, s, out){
    const f = u * ALONG
    const i = Math.min(ALONG - 1, Math.floor(f))
    const r = f - i
    const lx = kit.lead[i].x + (kit.lead[i + 1].x - kit.lead[i].x) * r
    const lz = kit.lead[i].z + (kit.lead[i + 1].z - kit.lead[i].z) * r
    const tx = kit.trail[i].x + (kit.trail[i + 1].x - kit.trail[i].x) * r
    const tz = kit.trail[i].z + (kit.trail[i + 1].z - kit.trail[i].z) * r
    return out.set(lx + (tx - lx) * s, 0, lz + (tz - lz) * s)
}

// ── drawn textures ───────────────────────────────────────────────────────────

const textureCache = new WeakMap()   // scene -> Map(name -> texture)
function drawn(scene, name, width, height, draw, { wrapU = false } = {}){
    let byName = textureCache.get(scene)
    if(!byName) textureCache.set(scene, byName = new Map())
    let tex = byName.get(name)
    if(tex) return tex
    tex = new DynamicTexture(`darkSlash.${name}`, { width, height }, scene, true)
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

// The canvas's top row is v = 1 (the blade's trailing edge), its bottom v = 0
// (the leading edge).

// the light flowing inside it: wavering streaks running along the blade
// (tiled along u, scrolled), in its middle band - none at the very edges
const veinTexture = scene => drawn(scene, "veins", 512, 128, (ctx, w, h) => {
    const random = seeded(53)
    for(let i = 0; i < 46; i++){
        const v = 0.12 + random() * 0.66
        const y0 = (1 - v) * h
        const length = w * (0.2 + random() * 0.55)
        const x0 = random() * w
        const width = 1.5 + random() * 4.5
        const alpha = 0.18 + random() * 0.55
        const wave = 2 + random() * 5
        const phase = random() * Math.PI * 2
        // drawn twice, a width apart, so it wraps round seamlessly
        ;[0, -w].forEach(shift => {
            const grad = ctx.createLinearGradient(x0 + shift, 0, x0 + shift + length, 0)
            grad.addColorStop(0, "rgba(255,255,255,0)")
            grad.addColorStop(0.3, `rgba(255,255,255,${alpha})`)
            grad.addColorStop(0.7, `rgba(255,255,255,${alpha})`)
            grad.addColorStop(1, "rgba(255,255,255,0)")
            ctx.strokeStyle = grad
            ctx.lineWidth = width
            ctx.lineCap = "round"
            ctx.beginPath()
            for(let x = 0; x <= length; x += 8){
                const y = y0 + Math.sin(x / length * Math.PI * 2 + phase) * wave
                if(x === 0) ctx.moveTo(x0 + shift + x, y)
                else ctx.lineTo(x0 + shift + x, y)
            }
            ctx.stroke()
        })
    }
}, { wrapU: true })
// the rim's falloff across the blade: full at the leading edge, a third of
// that by the trailing one
const rimTexture = scene => drawn(scene, "rim", 8, 128, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, h, 0, 0)
    grad.addColorStop(0, "rgba(255,255,255,1)")
    grad.addColorStop(0.4, "rgba(255,255,255,0.7)")
    grad.addColorStop(1, "rgba(255,255,255,0.3)")
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
})
// the razor edge across its strip: a hairline, a glow either side of it
const razorTexture = scene => drawn(scene, "razor", 8, 64, (ctx, w, h) => {
    const img = ctx.createImageData(w, h)
    for(let y = 0; y < h; y++){
        const v = 1 - y / (h - 1)
        const d = (v - 0.35) / 0.65
        const a = Math.min(1, Math.exp(-Math.pow(d / 0.12, 2)) + 0.45 * Math.exp(-Math.pow(d / 0.45, 2)))
        for(let x = 0; x < w; x++){
            const i = (y * w + x) * 4
            img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
            img.data[i + 3] = Math.round(a * 255)
        }
    }
    ctx.putImageData(img, 0, 0)
})
// the pool of its dark under it: dark at the middle, a violet rim, ragged
const poolTexture = (scene, palette) => drawn(scene, `pool.${palette.name}`, 256, 256, (ctx, size) => {
    const c = size / 2
    const css = (color, a) => `rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},${a})`
    const random = seeded(71)
    const fill = ctx.createRadialGradient(c, c, 0, c, c, size * 0.48)
    fill.addColorStop(0, css(palette.ink, 0.85))
    fill.addColorStop(0.65, css(palette.ink, 0.8))
    fill.addColorStop(0.84, css(palette.body, 0.85))
    fill.addColorStop(0.92, css(palette.edge, 0.9))
    fill.addColorStop(1, css(palette.edge, 0))
    ctx.fillStyle = fill
    ctx.fillRect(0, 0, size, size)
    // blobs round the rim, so it reads as a spill, not a disc
    for(let i = 0; i < 26; i++){
        const a = random() * Math.PI * 2
        const d = size * (0.3 + random() * 0.12)
        const r = size * (0.04 + random() * 0.06)
        const x = c + Math.cos(a) * d, y = c + Math.sin(a) * d
        const blob = ctx.createRadialGradient(x, y, 0, x, y, r)
        blob.addColorStop(0, css(palette.ink, 0.85))
        blob.addColorStop(0.75, css(palette.ink, 0.6))
        blob.addColorStop(1, css(palette.ink, 0))
        ctx.fillStyle = blob
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
    }
})
// the glint: a four-point star - long thin spikes and a soft heart
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

// ── materials ────────────────────────────────────────────────────────────────

const materialCache = new WeakMap()   // scene -> Map(key -> material)
function material(scene, key, setup){
    let byKey = materialCache.get(scene)
    if(!byKey) materialCache.set(scene, byKey = new Map())
    let mat = byKey.get(key)
    if(!mat || mat.isDisposed?.()){
        mat = new StandardMaterial(key, scene)
        mat.backFaceCulling = false
        setup(mat)
        byKey.set(key, mat)
    }
    return mat
}
function unlit(mat){
    mat.disableLighting = true
    mat.diffuseColor = Color3.Black()
    mat.specularColor = Color3.Black()
}
function additive(mat){
    unlit(mat)
    mat.alphaMode = Constants.ALPHA_ADD
    mat.transparencyMode = Material.MATERIAL_ALPHABLEND
    mat.disableDepthWrite = true
}

// the liquid itself - the dark slime's own gel (skins.js's createSlimeMat with
// the "dark" palette): lit purple, glossy, its rim lit violet and the more
// solid for it, dark straight through the middle - only a deal more solid,
// or the cutter would barely be there
const bodyMaterial = (scene, palette) => material(scene, `darkSlash.body.${palette.name}`, mat => {
    mat.diffuseColor = palette.body
    mat.specularColor = new Color3(0.85, 0.7, 1)
    mat.specularPower = 90
    mat.emissiveColor = Color3.White()
    mat.emissiveFresnelParameters = new FresnelParameters({ leftColor: palette.edge, rightColor: palette.ink, power: 2.2, bias: 0.05 })
    mat.alpha = 0.92
    mat.opacityFresnelParameters = new FresnelParameters({ leftColor: Color3.White(), rightColor: new Color3(0.62, 0.62, 0.62), power: 2, bias: 0.1 })
    mat.twoSidedLighting = true
    mat.transparencyMode = Material.MATERIAL_ALPHABLEND
    mat.alphaMode = Constants.ALPHA_COMBINE
})
// the light flowing inside it, over it
const veinMaterial = (scene, palette) => material(scene, `darkSlash.veins.${palette.name}`, mat => {
    additive(mat)
    mat.emissiveColor = palette.vein
    mat.opacityTexture = veinTexture(scene)
})
// its rim round it - brightest at the edge you see it side-on (Fresnel), and
// along its leading edge (rimTexture). The afterimages are made of it too.
const rimMaterial = (scene, palette) => material(scene, `darkSlash.rim.${palette.name}`, mat => {
    additive(mat)
    mat.emissiveColor = palette.edge
    mat.opacityTexture = rimTexture(scene)
    mat.opacityFresnelParameters = new FresnelParameters({ leftColor: Color3.White(), rightColor: new Color3(0.22, 0.22, 0.22), power: 1.6, bias: 0.05 })
})
const razorMaterial = (scene, palette) => material(scene, `darkSlash.razor.${palette.name}`, mat => {
    additive(mat)
    mat.emissiveColor = palette.core
    mat.opacityTexture = razorTexture(scene)
})
// the scar in the ground: a dark burn, and a seam of violet down it that cools
const scarMaterial = (scene, palette) => material(scene, `darkSlash.scar.${palette.name}`, mat => {
    unlit(mat)
    mat.emissiveColor = palette.ink
    mat.opacityTexture = gashTexture(scene)
    mat.alpha = 0.999
    mat.transparencyMode = Material.MATERIAL_ALPHABLEND
    mat.alphaMode = Constants.ALPHA_COMBINE
})
const seamMaterial = (scene, palette) => material(scene, `darkSlash.seam.${palette.name}`, mat => {
    additive(mat)
    mat.alpha = 0.999
    mat.emissiveColor = palette.vein
    mat.opacityTexture = gashTexture(scene)
})
const poolMaterial = (scene, palette) => material(scene, `darkSlash.pool.${palette.name}`, mat => {
    unlit(mat)
    const tex = poolTexture(scene, palette)
    mat.emissiveTexture = tex
    mat.emissiveColor = Color3.White()
    mat.opacityTexture = tex
    mat.transparencyMode = Material.MATERIAL_ALPHABLEND
    mat.alphaMode = Constants.ALPHA_COMBINE
    mat.disableDepthWrite = true
    mat.zOffset = -2
})
const starMaterial = (scene, palette) => material(scene, `darkSlash.star.${palette.name}`, mat => {
    additive(mat)
    mat.emissiveColor = Color3.Lerp(palette.core, palette.edge, 0.25)
    mat.opacityTexture = starTexture(scene)
})

// ── the scar's instances (one template per scene and colour) ─────────────────

const scarTemplates = new WeakMap()   // scene -> Map(palette -> { scar, seam })
function scarTemplatesFor(scene, palette){
    let byPalette = scarTemplates.get(scene)
    if(!byPalette) scarTemplates.set(scene, byPalette = new Map())
    let tpl = byPalette.get(palette.name)
    if(tpl) return tpl
    const make = (name, mat) => {
        const mesh = MeshBuilder.CreateGround(name, { width: 1, height: 1 }, scene)
        mesh.material = mat
        mesh.isPickable = false
        mesh.hasVertexAlpha = true
        mesh.registerInstancedBuffer("color", 4)
        mesh.instancedBuffers.color = new Color4(1, 1, 1, 1)
        mesh.alwaysSelectAsActiveMesh = true
        // the template never draws - only its instances
        mesh.scaling.setAll(0)
        return mesh
    }
    tpl = {
        scar: make(`darkSlash.scar.${palette.name}`, scarMaterial(scene, palette)),
        seam: make(`darkSlash.seam.${palette.name}`, seamMaterial(scene, palette)),
    }
    tpl.seam.alphaIndex = 1
    byPalette.set(palette.name, tpl)
    return tpl
}
function scarInstance(template, name){
    const inst = template.createInstance(name)
    inst.isPickable = false
    inst.instancedBuffers.color = new Color4(1, 1, 1, 1)
    return inst
}

// ── ready before it's needed ─────────────────────────────────────────────────

const prewarmed = new WeakMap()   // scene -> Set(palette name)

/**
 * Everything the cutters draw, compiled and loaded ahead of the first one -
 * or their first charge and flight stay invisible for a few frames while
 * their shaders compile. Once per scene and colour (enemies/rangeAttack.js,
 * when a dark slime shows up).
 */
export function prewarmDarkSlash(scene, color){
    if(!scene || scene.isDisposed) return
    const palette = darkSlashPalette(color)
    let done = prewarmed.get(scene)
    if(!done) prewarmed.set(scene, done = new Set())
    if(done.has(palette.name)) return
    done.add(palette.name)
    prewarmSonicDistortion(scene)
    ;["flare", "smoke", "thin1"].forEach(name => getParticleTexture(scene, particleTexturePath(name)))
    const kit = kitFor(scene)
    scarTemplatesFor(scene, palette)
    sparkBurst(scene, new Vector3(0, -1000, 0), palette.edge, { count: 1, power: 0, life: [0.05, 0.05] })
    const blade = kit.blade.clone("darkSlash.prewarm.blade")
    const plane = MeshBuilder.CreatePlane("darkSlash.prewarm.plane", { size: 0.01 }, scene)
    ;[blade, plane].forEach(mesh => {
        mesh.isVisible = false
        mesh.isPickable = false
    })
    const jobs = [
        [bodyMaterial(scene, palette), blade],
        [veinMaterial(scene, palette), blade],
        [rimMaterial(scene, palette), blade],
        [razorMaterial(scene, palette), blade],
        [poolMaterial(scene, palette), plane],
        [starMaterial(scene, palette), plane],
    ]
    Promise.all(jobs.map(([mat, mesh]) => mat.forceCompilationAsync(mesh)))
        .catch(() => {})
        .finally(() => {
            blade.dispose()
            plane.dispose()
        })
}

// ── 1. the charge ────────────────────────────────────────────────────────────

// a charge still there this long after it should have let go snuffs itself out
const ORPHANED_AFTER_MS = 2200
const POOL_SPREAD = 2.6     // across, × its radius

/**
 * The dark slime drawing itself in for `ms`: black flames pouring up off it
 * (round `getFeet()`), a pool of its dark spreading under it, violet light
 * sucked in to `getCenter()`. Its flames come thicker and faster the nearer
 * it gets. lock(): the glint. release(): its cutters are all away - the
 * flames die back, the pool drains. dispose({ fizzled }): gone at once.
 */
export function chargeDarkSlash(scene, { getCenter, getFeet, palette, ms, radius = 0.7 }){
    const start = performance.now()
    const feet = getFeet().clone()
    const center = getCenter().clone()

    const pool = MeshBuilder.CreateGround("darkSlash.pool", { width: 1, height: 1 }, scene)
    pool.isPickable = false
    pool.material = poolMaterial(scene, palette)
    pool.scaling.setAll(0.01)

    // black flames pouring up off it, round its feet
    const flames = fireParticles(scene, "darkSlash.charge.flames", 360, "smoke", feet, ParticleSystem.BLENDMODE_STANDARD)
    flames.startPositionFunction = (matrix, position) => {
        const a = Math.random() * Math.PI * 2
        const r = radius * (0.3 + Math.random() * 0.55)
        position.set(feet.x + Math.cos(a) * r, feet.y + 0.05 + Math.random() * 0.25, feet.z + Math.sin(a) * r)
    }
    flames.startDirectionFunction = (matrix, direction) => direction.set((Math.random() - 0.5) * 0.35, 1, (Math.random() - 0.5) * 0.35)
    flames.minEmitPower = 1.3
    flames.maxEmitPower = 2.6
    flames.minLifeTime = 0.4
    flames.maxLifeTime = 0.75
    flames.minInitialRotation = -Math.PI
    flames.maxInitialRotation = Math.PI
    flames.minAngularSpeed = -2
    flames.maxAngularSpeed = 2
    flames.addSizeGradient(0, 0.28, 0.42)
    flames.addSizeGradient(1, 0.75, 1.15)
    flames.addColorGradient(0, c4(palette.ink, 0))
    flames.addColorGradient(0.12, c4(palette.ink, 0.9))
    flames.addColorGradient(0.6, c4(palette.body.scale(0.55), 0.55))
    flames.addColorGradient(1, c4(palette.body, 0))
    flames.emitRate = 40
    flames.start()

    // violet licks of it rising through the black
    const licks = fireParticles(scene, "darkSlash.charge.licks", 220, "thin1", feet)
    licks.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED
    licks.startPositionFunction = flames.startPositionFunction
    licks.startDirectionFunction = flames.startDirectionFunction
    licks.minEmitPower = 2.4
    licks.maxEmitPower = 4.2
    licks.minLifeTime = 0.2
    licks.maxLifeTime = 0.4
    licks.minScaleX = 0.04
    licks.maxScaleX = 0.08
    licks.minScaleY = 0.35
    licks.maxScaleY = 0.8
    licks.minSize = licks.maxSize = 1
    licks.addColorGradient(0, c4(palette.core, 0.9))
    licks.addColorGradient(0.35, c4(palette.edge, 0.8))
    licks.addColorGradient(1, c4(palette.vein, 0))
    licks.emitRate = 30
    licks.start()

    // light sucked in to it from all round - born on a sphere, arriving as they die
    const INFLOW_LIFE = 0.24, INFLOW_REACH = 2.2
    const inflow = fireParticles(scene, "darkSlash.charge.inflow", 200, "thin1", center)
    inflow.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED
    inflow.startPositionFunction = (matrix, position) => {
        const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u)
        position.set(center.x + Math.cos(a) * r * INFLOW_REACH, center.y + Math.abs(u) * INFLOW_REACH * 0.7, center.z + Math.sin(a) * r * INFLOW_REACH)
    }
    inflow.startDirectionFunction = (matrix, direction, particle) => direction.set(center.x - particle.position.x, center.y - particle.position.y, center.z - particle.position.z).scaleInPlace(1 / INFLOW_LIFE)
    inflow.minEmitPower = inflow.maxEmitPower = 1
    inflow.minLifeTime = inflow.maxLifeTime = INFLOW_LIFE
    inflow.minScaleX = 0.03
    inflow.maxScaleX = 0.06
    inflow.minScaleY = 0.4
    inflow.maxScaleY = 0.9
    inflow.minSize = inflow.maxSize = 1
    inflow.addColorGradient(0, c4(palette.vein, 0))
    inflow.addColorGradient(0.4, c4(palette.edge, 0.85))
    inflow.addColorGradient(1, c4(palette.core, 1))
    inflow.emitRate = 60
    inflow.start()

    let releasedAt = 0
    let flaredAt = 0
    let last = start
    const observer = scene.onBeforeRenderObservable.add(() => {
        const now = performance.now()
        const dt = Math.min(0.05, (now - last) / 1000)
        last = now
        if(now - start > ms + ORPHANED_AFTER_MS) return dispose({ fizzled: true })
        feet.copyFrom(getFeet())
        center.copyFrom(getCenter())
        const t = Math.min(1, (now - start) / ms)
        // the pool: spreading, throbbing faster as it comes; once it's let go,
        // draining away
        const spread = 1 - Math.pow(1 - Math.min(1, t * 1.35), 3)
        const throb = 1 + 0.05 * Math.sin(now / 1000 * (6 + 22 * t))
        const flare = flaredAt ? 1 + 0.25 * Math.max(0, 1 - (now - flaredAt) / 220) : 1
        const drain = releasedAt ? Math.max(0, 1 - (now - releasedAt) / 520) : 1
        pool.scaling.set(radius * POOL_SPREAD * spread * throb * flare, 1, radius * POOL_SPREAD * spread * throb * flare)
        pool.position.set(feet.x, feet.y + 0.04, feet.z)
        pool.rotation.y += dt * 0.5
        pool.visibility = Math.min(1, t * 4) * drain
        if(releasedAt){
            if(drain <= 0) dispose({ fizzled: false })
            return
        }
        // thicker and faster the nearer it gets
        flames.emitRate = 40 + 280 * t
        licks.emitRate = 30 + 230 * t
        inflow.emitRate = 60 + 340 * t
    })

    function stopEmitting(){
        flames.stop()
        licks.stop()
        inflow.stop()
    }
    let disposed = false
    function dispose({ fizzled = false } = {}){
        if(disposed) return
        disposed = true
        scene.onBeforeRenderObservable.remove(observer)
        stopEmitting()
        pool.dispose()
        // snuffed out - its dark just splashes away
        if(fizzled) inkSplash(scene, center, palette, { count: 18, power: 2.5 })
    }
    return {
        // the glint - the beat before the blade comes out
        lock(){
            flaredAt = performance.now()
            glint(scene, center.add(new Vector3(0, 0.2, 0)), palette)
            popShockRing(scene, feet, { size: 2.6, seconds: 0.32, color: palette.edge })
        },
        // its cutters are all away
        release(){
            if(releasedAt || disposed) return
            releasedAt = performance.now()
            stopEmitting()
        },
        dispose,
    }
}

// a four-point star flashing off it - big in a blink, turning, gone
function glint(scene, at, palette){
    const star = MeshBuilder.CreatePlane("darkSlash.glint", { size: 1 }, scene)
    star.isPickable = false
    star.material = starMaterial(scene, palette)
    star.billboardMode = Mesh.BILLBOARDMODE_ALL
    // over the body it's flashing off
    star.renderingGroupId = 1
    star.position.copyFrom(at)
    const start = performance.now()
    const observer = scene.onBeforeRenderObservable.add(() => {
        const t = (performance.now() - start) / 300
        if(t >= 1 || star.isDisposed()){
            scene.onBeforeRenderObservable.remove(observer)
            star.dispose()
            return
        }
        const pop = t < 0.18 ? t / 0.18 : 1 - (t - 0.18) / 0.82
        star.scaling.setAll(0.2 + 2.2 * Math.pow(pop, 0.7))
        star.rotation.z = 0.15 + t * 0.7
        star.visibility = Math.min(1, pop * 1.4)
    })
}

/**
 * A splash of the dark slime's liquid - dark drops thrown out from `at` and
 * falling. dir: thrown mostly that way.
 */
export function inkSplash(scene, at, palette, { count = 20, power = 3, dir = null, size = [0.06, 0.14] } = {}){
    if(!scene || scene.isDisposed) return
    const drops = fireParticles(scene, "darkSlash.ink", count, "flare", at.clone(), ParticleSystem.BLENDMODE_STANDARD)
    drops.startDirectionFunction = (matrix, direction) => {
        direction.set(Math.random() - 0.5, Math.random() * 0.8 + 0.1, Math.random() - 0.5)
        if(dir) direction.addInPlace(dir.scale(1.2))
        direction.normalize()
    }
    drops.manualEmitCount = count
    drops.targetStopDuration = 0.1
    drops.minEmitPower = power * 0.5
    drops.maxEmitPower = power
    drops.minLifeTime = 0.45
    drops.maxLifeTime = 0.8
    drops.minSize = size[0]
    drops.maxSize = size[1]
    drops.gravity = new Vector3(0, -12, 0)
    drops.addColorGradient(0, c4(palette.ink, 0.95))
    drops.addColorGradient(0.7, c4(palette.body.scale(0.6), 0.85))
    drops.addColorGradient(1, c4(palette.body, 0))
    drops.start()
}

// ── 2. each cutter's release ─────────────────────────────────────────────────

/**
 * A cutter leaving it at `at`, toward `dir`: sparks and its liquid sprayed
 * after it, a ring off its feet, the air split round the mouth.
 */
export function slashRelease(scene, at, dir, palette, { feet = null } = {}){
    if(!scene || scene.isDisposed) return
    const way = new Vector3(dir.x, 0, dir.z).normalize()
    sparkBurst(scene, at, palette.edge, { count: 26, power: 6.5, size: [0.05, 0.12], life: [0.15, 0.35] })
    sparkBurst(scene, at, palette.core, { count: 10, power: 9, size: [0.03, 0.07], life: [0.1, 0.22] })
    inkSplash(scene, at, palette, { count: 16, power: 4, dir: way })
    if(feet) popShockRing(scene, feet, { size: 3.4, seconds: 0.32, color: palette.edge })
    shockRipple(scene, at, { radius: 3.2, ms: 380, strength: 0.5, thickness: 0.8, chroma: 0.6, rim: 0.15, tint: palette.edge })
}

// ── 3. the cutter in flight ──────────────────────────────────────────────────

// tilted back so its tips trail up behind it: it shows its face to someone
// it's flying at as well as to someone watching it go past (a crescent lying
// flat in the way it flies is only a line, seen head on)
const PITCH = (50 * Math.PI) / 180
// how high its middle rides over the ground
const LIFT = 0.95
// its size (× crescent.glb's own, ~3.4 m tip to tip) at its mouth and out at
// full reach - it widens as it goes
const SIZE = [0.8, 1.1]
// it springs out of the swing past its size and back
const UNFURL_MS = 170
const UNFURL_FROM = 0.3
const RIM_GROW = 1.1
const GHOSTS = [{ lagMs: 45, alpha: 0.5, size: 0.97 }, { lagMs: 95, alpha: 0.3, size: 0.92 }, { lagMs: 150, alpha: 0.16, size: 0.86 }]
const HISTORY_MS = 200
// its scar: strips laid every SCAR_EVERY, each SCAR_LENGTH long (twice as
// long as they're apart - gashTexture's sin² ends add up to one even line)
const SCAR_EVERY = 0.7
const SCAR_LENGTH = 1.4
const SCAR_WIDTH = 0.5
const SCAR_MS = 1700
const SEAM_MS = 800
// it fades back to this over its last FADE_OUT of reach, then bursts
const FADE_OUT = 2.5
const FADE_TO = 0.4
const END_MS = 220
const END_GROW = 1.5
// a flash through it as it cuts through someone
const CUT_FLASH_MS = 140
// closer to the camera than NEAR it's gone; it thins out over the next FADE
const CAMERA_NEAR = 1.2
const CAMERA_FADE = 2.4
// the light inside it flowing along it, tile-lengths a second
const VEIN_FLOW = 0.9

const easeOut = t => 1 - Math.pow(1 - t, 3)
const backOut = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2) }

function clearOfCamera(scene, at){
    const camera = scene.activeCamera
    if(!camera) return 1
    const d = Vector3.Distance(camera.globalPosition, at)
    return Math.min(1, Math.max(0, (d - CAMERA_NEAR) / CAMERA_FADE))
}

let cutterCount = 0

/**
 * A cutter flying from `from` (on the ground) flat along `dir` at `speed` u/s
 * for `length`, LIFT over the ground under it - groundAt(x, z) - all the
 * way, rolled round the way it flies by `roll` (radians: which way the slash
 * leans). onStep(fromAlong, toAlong, center) each frame it moves - the
 * caller checks who it's passed. onEnd() when it's burst.
 * Returns { position(), cut(), dispose() } - cut(): it's cutting through
 * someone - a flash through it (it flies on).
 */
export function flyDarkSlash(scene, { from, dir, roll = 0, speed = 22, length, groundAt, palette, onStep = null, onEnd = null }){
    const kit = kitFor(scene)
    const id = ++cutterCount
    const flat = new Vector3(dir.x, 0, dir.z).normalize()
    const yaw = Math.atan2(flat.x, flat.z)
    // tilted back, then leaned over round the way it flies, then turned that way
    const turn = Quaternion.FromRotationMatrix(Matrix.RotationX(PITCH).multiply(Matrix.RotationZ(roll)).multiply(Matrix.RotationY(yaw)))

    const part = (template, mat, alphaIndex, glow = null) => {
        const mesh = template.clone(`darkSlash.${template.name.split(".").pop()}.${id}`)
        mesh.material = mat
        mesh.isVisible = true
        mesh.isPickable = false
        mesh.alphaIndex = alphaIndex
        mesh.rotationQuaternion = turn.clone()
        mesh.scaling.setAll(0.001)
        if(glow){
            mesh._glowColor = glow.color
            addGlow(scene, mesh, glow.brightness)
            mesh._glowFull = glow.brightness
        }
        return mesh
    }
    // drawn back to front: the rim round it, the liquid over that, the light
    // inside it over that, the razor edge on top
    const rim = part(kit.blade, rimMaterial(scene, palette), 1, { color: palette.glow, brightness: 0.65 })
    const body = part(kit.blade, bodyMaterial(scene, palette), 2, { color: palette.glow, brightness: 0.28 })
    const veins = part(kit.blade, veinMaterial(scene, palette), 3)
    const razor = part(kit.razor, razorMaterial(scene, palette), 4, { color: palette.core, brightness: 1.1 })
    const layers = [
        { mesh: rim, grow: RIM_GROW, alpha: 0.55 },
        { mesh: body, grow: 1, alpha: 1 },
        { mesh: veins, grow: 1.004, alpha: 0.9 },
        { mesh: razor, grow: 1, alpha: 1 },
    ]
    const ghosts = GHOSTS.map(g => ({ ...g, mesh: part(kit.blade, rimMaterial(scene, palette), 0) }))
    const veinTex = veins.material.opacityTexture

    const center = new Vector3(from.x, groundAt(from.x, from.z) + LIFT, from.z)
    const world = Matrix.Identity()
    const local = new Vector3()
    // a random point on the blade, out where it is now - for what comes off it
    const pointOn = (sFrom, sTo, out) => {
        bladePoint(kit, 0.06 + Math.random() * 0.88, sFrom + Math.random() * (sTo - sFrom), local)
        return Vector3.TransformCoordinatesToRef(local, world, out)
    }

    // black flames streaming off its trailing edge, left behind it
    const wisps = fireParticles(scene, `darkSlash.wisps.${id}`, 300, "smoke", center, ParticleSystem.BLENDMODE_STANDARD)
    wisps.startPositionFunction = (matrix, position) => pointOn(0.55, 1, position)
    wisps.startDirectionFunction = (matrix, direction) => direction.set(-flat.x * 1.6 + (Math.random() - 0.5) * 0.8, 0.8 + Math.random() * 0.8, -flat.z * 1.6 + (Math.random() - 0.5) * 0.8)
    wisps.minEmitPower = 0.8
    wisps.maxEmitPower = 1.7
    wisps.minLifeTime = 0.28
    wisps.maxLifeTime = 0.5
    wisps.minInitialRotation = -Math.PI
    wisps.maxInitialRotation = Math.PI
    wisps.minAngularSpeed = -2.5
    wisps.maxAngularSpeed = 2.5
    wisps.addSizeGradient(0, 0.22, 0.35)
    wisps.addSizeGradient(1, 0.6, 0.95)
    wisps.addColorGradient(0, c4(palette.ink, 0))
    wisps.addColorGradient(0.12, c4(palette.ink, 0.85))
    wisps.addColorGradient(0.6, c4(palette.body.scale(0.6), 0.45))
    wisps.addColorGradient(1, c4(palette.body, 0))
    wisps.emitRate = 0
    wisps.start()
    // violet embers among them
    const embers = fireParticles(scene, `darkSlash.embers.${id}`, 200, "flare", center)
    embers.startPositionFunction = (matrix, position) => pointOn(0.25, 1, position)
    embers.startDirectionFunction = wisps.startDirectionFunction
    embers.minEmitPower = 1
    embers.maxEmitPower = 2.5
    embers.minLifeTime = 0.18
    embers.maxLifeTime = 0.38
    embers.minSize = 0.05
    embers.maxSize = 0.12
    embers.addColorGradient(0, c4(palette.core, 1))
    embers.addColorGradient(0.3, c4(palette.edge, 0.9))
    embers.addColorGradient(1, c4(palette.vein, 0))
    embers.emitRate = 0
    embers.start()
    // its liquid dripping off it as it goes
    const drips = fireParticles(scene, `darkSlash.drips.${id}`, 120, "flare", center, ParticleSystem.BLENDMODE_STANDARD)
    drips.startPositionFunction = (matrix, position) => pointOn(0.15, 0.9, position)
    drips.startDirectionFunction = (matrix, direction) => direction.set(-flat.x * 0.6 + (Math.random() - 0.5) * 0.6, -0.4 + Math.random() * 0.6, -flat.z * 0.6 + (Math.random() - 0.5) * 0.6)
    drips.minEmitPower = 0.5
    drips.maxEmitPower = 1.5
    drips.minLifeTime = 0.35
    drips.maxLifeTime = 0.7
    drips.minSize = 0.06
    drips.maxSize = 0.13
    drips.gravity = new Vector3(0, -14, 0)
    drips.addColorGradient(0, c4(palette.ink, 0.95))
    drips.addColorGradient(0.75, c4(palette.body.scale(0.6), 0.85))
    drips.addColorGradient(1, c4(palette.body, 0))
    drips.emitRate = 0
    drips.start()
    const systems = [wisps, embers, drips]
    const RATES = [220, 140, 60]

    // the scar it scores in the ground under it
    const scarTpl = scarTemplatesFor(scene, palette)
    const scars = []
    let lastScar = null
    function dropScar(at, now){
        const y = groundAt(at.x, at.z)
        const make = (template, lift) => {
            const inst = scarInstance(template, `darkSlash.scar.${id}.${scars.length}`)
            inst.position.set(at.x, y + lift, at.z)
            inst.rotation.y = yaw
            inst.scaling.set(SCAR_WIDTH, 1, SCAR_LENGTH)
            return inst
        }
        scars.push({ scar: make(scarTpl.scar, 0.06), seam: make(scarTpl.seam, 0.07), at: now })
    }

    const born = performance.now()
    const history = []
    let along = 0
    let last = born
    let cutAt = 0
    let ended = false
    const scale = new Vector3()
    const observer = scene.onBeforeRenderObservable.add(() => {
        const now = performance.now()
        const dt = Math.min(0.05, (now - last) / 1000)
        last = now
        const before = along
        along = Math.min(length, along + speed * dt)
        const x = from.x + flat.x * along
        const z = from.z + flat.z * along
        center.set(x, groundAt(x, z) + LIFT, z)

        const unfurl = UNFURL_FROM + (1 - UNFURL_FROM) * backOut(Math.min(1, (now - born) / UNFURL_MS))
        const cut = cutAt ? Math.max(0, 1 - (now - cutAt) / CUT_FLASH_MS) : 0
        const size = (SIZE[0] + (SIZE[1] - SIZE[0]) * along / length) * unfurl * (1 + 0.1 * cut)
        const fade = (FADE_TO + (1 - FADE_TO) * Math.min(1, (length - along) / FADE_OUT)) * clearOfCamera(scene, center)
        layers.forEach(({ mesh, grow, alpha }) => {
            mesh.position.copyFrom(center)
            mesh.scaling.setAll(size * grow)
            mesh.visibility = alpha * fade
            if(mesh._glowFull) mesh._glowBrightness = mesh._glowFull * fade * (1 + 1.5 * cut)
        })
        veinTex.uOffset = -((now / 1000) * VEIN_FLOW) % 1

        // afterimages: where it was lagMs ago
        history.push({ t: now, pos: center.clone(), size })
        while(history.length && now - history[0].t > HISTORY_MS) history.shift()
        ghosts.forEach(g => {
            const past = history.find(h => now - h.t <= g.lagMs) ?? history[0]
            if(!past || now - born < g.lagMs){
                g.mesh.isVisible = false
                return
            }
            g.mesh.isVisible = true
            g.mesh.position.copyFrom(past.pos)
            g.mesh.scaling.setAll(past.size * g.size * RIM_GROW)
            g.mesh.visibility = g.alpha * fade
        })

        // what comes off it, from where it is now
        scale.setAll(size)
        Matrix.ComposeToRef(scale, turn, center, world)
        systems.forEach((ps, i) => { ps.emitRate = RATES[i] * fade })

        // the scar: a strip every SCAR_EVERY of the way, however far a slow
        // frame carried it
        const ground = new Vector3(x, 0, z)
        if(!lastScar){
            lastScar = ground.clone()
            dropScar(lastScar, now)
        }
        let run = Vector3.Distance(lastScar, ground)
        while(run >= SCAR_EVERY){
            lastScar = Vector3.Lerp(lastScar, ground, SCAR_EVERY / run)
            dropScar(lastScar, now)
            run = Vector3.Distance(lastScar, ground)
        }

        onStep?.(before, along, center)
        if(along >= length) finish()
    })
    // the scars fade on their own clock - they outlive the cutter. The seam
    // cools fast; the burn stays a while
    const scarObserver = scene.onBeforeRenderObservable.add(() => {
        const now = performance.now()
        for(let i = scars.length - 1; i >= 0; i--){
            const s = scars[i]
            const t = (now - s.at) / SCAR_MS
            const tSeam = (now - s.at) / SEAM_MS
            if(t >= 1){
                s.scar.dispose()
                if(!s.seam.isDisposed()) s.seam.dispose()
                scars.splice(i, 1)
                continue
            }
            s.scar.instancedBuffers.color = new Color4(1, 1, 1, 0.85 * (1 - t * t))
            if(!s.seam.isDisposed()){
                if(tSeam >= 1) s.seam.dispose()
                else {
                    s.seam.scaling.x = SCAR_WIDTH * 0.7 * (1 - 0.7 * tSeam)
                    s.seam.instancedBuffers.color = new Color4(1, 1, 1, (1 - tSeam) * (1 - tSeam))
                }
            }
        }
        if(ended && !scars.length) scene.onBeforeRenderObservable.remove(scarObserver)
    })

    // the end of its run: it bursts - swelling, fading, its liquid sprayed on
    function finish(){
        if(ended) return
        ended = true
        scene.onBeforeRenderObservable.remove(observer)
        systems.forEach(ps => ps.stop())
        ghosts.forEach(g => g.mesh.dispose())
        const at = center.clone()
        inkSplash(scene, at, palette, { count: 22, power: 3.5, dir: flat })
        sparkBurst(scene, at, palette.edge, { count: 20, power: 3.5, size: [0.06, 0.14], life: [0.2, 0.4] })
        const startScale = layers.map(({ mesh }) => mesh.scaling.x)
        const startAlpha = layers.map(({ mesh }) => mesh.visibility)
        const burstAt = performance.now()
        const endObserver = scene.onBeforeRenderObservable.add(() => {
            const t = Math.min(1, (performance.now() - burstAt) / END_MS)
            const grow = 1 + (END_GROW - 1) * easeOut(t)
            layers.forEach(({ mesh }, i) => {
                mesh.scaling.setAll(startScale[i] * grow)
                mesh.visibility = startAlpha[i] * (1 - t)
                if(mesh._glowFull) mesh._glowBrightness = mesh._glowFull * (1 - t)
            })
            if(t < 1) return
            scene.onBeforeRenderObservable.remove(endObserver)
            layers.forEach(({ mesh }) => {
                mesh._glowLayer?.removeIncludedOnlyMesh(mesh)
                mesh.dispose()
            })
            onEnd?.()
        })
    }

    return {
        position: () => center.clone(),
        cut(){ cutAt = performance.now() },
        dispose: finish,
    }
}
