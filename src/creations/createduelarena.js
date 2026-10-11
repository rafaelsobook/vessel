// createduelarena.js
//
// "duel" areaType (placeIds 200-202) - a gladiator arena at night. A sand
// floor; a stone podium wall ringed with torches and banners; two arched
// gates - the way out at the south (portcullis up, a torch-lit tunnel), the
// opponents' gate at the north (portcullis down, red light behind the bars)
// with the emperor's box above it; tiered stands packed with a crowd that
// jumps when blood is drawn (cheerArenaCrowd - duelSystem.js calls it); a
// colonnade with pennants along the top; stars, and a moon placed where the
// place's own directional light (sceneTemp) shines from.
//
// That's the "colosseum" theme, the default. A place's `theme` can pick
// another (THEMES below): "forest" is an old arena the forest took back -
// mossy stone and a forest floor, giant trees on the rim whose roots
// (assetcreation/createRoots.js) pour down the stands and over the wall,
// hanging roots, a ruined colonnade, fireflies, a thinner crowd.
//
// Goes through areascene.js's shared setup (character, physics, roomPaths,
// NPCs) exactly like "room" does - this only builds the place. The sand is a
// circle of radius 25, the old square arena's half-size, so the spawns at
// z -20/+20 and the exit trigger at z -24 (roomPaths) sit where they did.
//
// Physics: only the sand is walkable. The podium wall is a ring of static
// boxes (open at the south gate, whose tunnel is closed off at its end), and
// the stands get one invisible sloped collider - nobody can reach them, but
// the camera's spring arm (camera.js) stops at physics, so a camera swung
// over the wall comes to rest on the seats instead of inside them.
//
// Light: some 30 fires, each with its own point light - tools/lightBudget.js
// only ever has the 5 nearest the player switched on, and every material here
// takes 8 lights (the most the user's GPU compiles - see createdungeon.js) so
// those 5 actually reach it.
import {
    Vector3,
    Matrix,
    Color3,
    Color4,
    Mesh,
    MeshBuilder,
    VertexData,
    VertexBuffer,
    StandardMaterial,
    Texture,
    DynamicTexture,
    ParticleSystem,
    PointLight,
    HemisphericLight,
    DirectionalLight,
    TransformNode,
    CSG,
    Constants,
    Material,
    NoiseProceduralTexture,
} from '@babylonjs/core';
import { createAggregate } from '../tools/physics';
import { createFireParticles } from '../tools/particlesystem';
import { mergeAndLoadModel } from '../tools/loadmodel';
import { growRoots, hangRoots, seededRandom } from '../assetcreation/createRoots';

// ── Layout (metres - the arena's centre is the origin, north +Z) ─────────────
const R           = 25      // the sand's radius = the podium wall's inner face
const WALL_H      = 3.8     // the podium wall
const PODIUM_Y    = 4.1     // top of its cornice - the front walkway's level
const PARAPET_TOP = 4.95
const NORTH       = Math.PI / 2     // the opponents' gate, under the emperor's box
const SOUTH       = -Math.PI / 2    // the way out - roomPaths' trigger sits in front of it

// gates
const GATE_HALF   = 3.5     // half the width of a gate's stone face
const OPENING_W   = 3.4
const SPRING_Y    = 1.9     // where the arch starts to curve
const ARCH_TOP    = SPRING_Y + OPENING_W / 2
const FACADE_D    = 1.2
const FACADE_Z    = -0.15   // the face stands this far proud of the wall
const TUNNEL_LEN  = 3.6

// the stands - two tiers of seats, with a walkway (and its doorways) between
const ROW_DEPTH   = 0.85
const LOWER_ROWS  = 8
const LOWER_RISE  = 0.5
const UPPER_ROWS  = 7
const UPPER_RISE  = 0.55
const MID_WALL_H  = 1.7
const COLUMN_H    = 5
const COLUMNS     = 48

// metres per texture repeat - every surface maps its texture in metres, so
// blocks of every size and every ring share one scale per material
const STONE_TILE  = 2.4
const SEAT_TILE   = 1.8
const TRIM_TILE   = 1.6
const SAND_TILE   = 3.5
// the longest chord a curved surface is cut into
const ARC_STEP    = 1.2

const MAX_LIGHTS  = 8       // see the header

// fires
const TORCH_GLB       = "./models/indors/wallTorch.glb"
const TORCH_Y         = 2.6
const TORCH_FLAME_UP  = 0.3     // the torch model's flame above / out from its
const TORCH_FLAME_OUT = 0.22    // mount point (same as roomHall.js's)
const TORCH_LIGHT     = { intensity: 1.7, range: 11 }
const BRAZIER_LIGHT   = { intensity: 2.2, range: 15 }
// a fire bowl's flame point above the bowl's foot (its coals sit at 0.28)
const FLAME_ABOVE_BOWL = 0.45

// crowd
const SEAT_SPACING = 0.66
const HOP_MS       = 420
const AISLE_HALF   = 0.7

// ── Themes ────────────────────────────────────────────────────────────────────
// A place picks one with `theme` in its data - a name ("forest"), or
// { name, banner, trim } to give that theme's banners and drapes its own
// colours. mats: [texture, tint] for every surface that changes with it.
const THEMES = {
    // sand, travertine and marble, a packed house, crimson and gold
    colosseum: {
        banner: "#7c1515", trim: "#d6a63a",
        mats: {
            sand:   ["./textures/road.jpg", [1, 0.93, 0.84]],
            wall:   ["./images/modeltex/pillartex1.webp", [0.9, 0.86, 0.82]],
            trim:   ["./images/modeltex/rock2.jpg", [0.95, 0.93, 0.89]],
            seat:   ["./images/modeltex/brick3.jpg", [1, 1, 1]],
            riser:  ["./images/modeltex/brick3.jpg", [0.6, 0.55, 0.48]],
            dark:   ["./images/modeltex/wall5.webp", [1, 1, 1]],
            paving: ["./images/modeltex/stonefloor.jpg", [0.62, 0.6, 0.58]],
        },
        ground: "raked",
        medallion: { tint: [0.6, 0.5, 0.4], alpha: 0.85 },
        emptySeats: 0.22,
        overgrown: false,
    },
    // an old arena the forest took back - mossy stone and a forest floor,
    // giant trees on the rim whose roots pour down the seats and over the
    // wall (createRoots.js), hanging roots and leaves, a ruined colonnade,
    // fireflies, and a thinner crowd that keeps off the roots
    forest: {
        banner: "#3f6b26", trim: "#cdb86c",
        mats: {
            sand:   ["./textures/first_dark_grass.jpg", [1.05, 1.1, 0.98]],
            wall:   ["./images/textures/walls/wall1_diff.jpg", [1, 1.05, 0.98]],
            trim:   ["./images/modeltex/rock2.jpg", [0.62, 0.68, 0.6]],
            seat:   ["./images/textures/floors/floor1_diff.jpg", [0.78, 0.85, 0.76]],
            riser:  ["./images/modeltex/pillartex2.webp", [0.62, 0.68, 0.6]],
            dark:   ["./images/modeltex/wall4.jpg", [1, 1, 1]],
            paving: ["./images/textures/floors/floor1_diff.jpg", [0.6, 0.65, 0.58]],
        },
        ground: "moss",
        medallion: { tint: [0.45, 0.5, 0.4], alpha: 0.6 },
        emptySeats: 0.55,
        overgrown: true,
    },
}

function resolveTheme(theme){
    const { name = "colosseum", ...colors } = typeof theme === "string" ? { name: theme } : theme ?? {}
    if(!THEMES[name]) console.warn(`[duel arena] unknown theme "${name}" - building the colosseum`)
    return { ...(THEMES[name] ?? THEMES.colosseum), ...colors }
}

// overgrown themes: giant trees on the rim (degrees round from +X, clear of
// both gates) and the models they're drawn from
const RIM_TREE_ANGLES = [18, 52, 128, 162, 200, 236, 305, 338]
const TREE_MODELS = [
    { path: "./models/trees/tree_1.glb", lift: 0 },
    { path: "./models/trees/deadtree1.glb", lift: 0.6 },   // its own roots reach 1.1 below its origin
    { path: "./models/trees/dead_tree_1.glb", lift: 0 },
]

// the arena on screen's crowd, for cheerArenaCrowd - one arena at a time
let crowd = null

export async function createDuelArena(scene, room, characterBody, hasPhysics = true) {
    const theme = resolveTheme(room.theme)
    // seeded by the place - an overgrown arena grows the same way every visit
    const rng = seededRandom(room.placeId ?? 1)
    const profile = caveaProfile()

    nightAtmosphere(scene)
    const mats = arenaMaterials(scene, theme)

    // ── Sand ──────────────────────────────────────────────────────────────────
    // the collider is a plain square slab, as before - the wall ring decides
    // where the sand actually ends
    const ground = MeshBuilder.CreateGround("arena_ground", { width: 2 * R + 10, height: 2 * R + 10 }, scene);
    ground.material = mats.sand
    planarUVs(ground, SAND_TILE)
    ground.isPickable = false
    if(hasPhysics) createAggregate(ground, { mass: 0 }, "box", scene);
    sandDetails(scene, mats, theme)

    if(hasPhysics) wallColliders(scene, profile)

    // ── Podium wall, cornice and parapet ──────────────────────────────────────
    // open where the gates' stone faces stand - the gaps sit a hair inside
    // each face so the face covers the wall's cut ends
    const faceGap    = Math.asin(3.4 / R)
    const corniceGap = Math.asin(3.45 / R)
    const ring = (gapS, gapN) => [[SOUTH + gapS, NORTH - gapN], [NORTH + gapN, SOUTH + 2 * Math.PI - gapS]]

    ring(faceGap, faceGap).forEach(([a0, a1], i) => {
        sweep(`arena_wall_${i}`, [[R, -0.05, R, WALL_H]], a0, a1, STONE_TILE, mats.wall, scene)
    })
    ring(corniceGap, corniceGap).forEach(([a0, a1], i) => {
        sweep(`arena_cornice_${i}`, [
            [R, WALL_H, R - 0.25, WALL_H],                   // underside
            [R - 0.25, WALL_H, R - 0.25, PODIUM_Y],          // front
            [R - 0.25, PODIUM_Y, R - 0.05, PODIUM_Y],        // top, up to the parapet
        ], a0, a1, TRIM_TILE, mats.trim, scene)
    })
    // the parapet stops short of the south gate's attic and the emperor's box
    ring(Math.asin(3.8 / R), Math.asin(4.25 / R)).forEach(([a0, a1], i) => {
        sweep(`arena_parapet_${i}`, [
            [R - 0.05, PODIUM_Y, R - 0.05, PARAPET_TOP],
            [R + 0.35, PARAPET_TOP, R + 0.35, PODIUM_Y],
        ], a0, a1, STONE_TILE, mats.wall, scene)
        sweep(`arena_parapet_cap_${i}`, [[R - 0.08, PARAPET_TOP, R + 0.38, PARAPET_TOP]], a0, a1, TRIM_TILE, mats.trim, scene)
    })

    // ── Gates ─────────────────────────────────────────────────────────────────
    const fires = []      // { pos, big, light } - lit after the stone is up
    // { pos, yaw, inward, theta? } - wallTorch.glb, loaded at the end; theta
    // only on the podium wall's own torches
    const torchMounts = []
    buildGate(scene, "arena_gate_s", SOUTH, mats, room, { open: true, hasPhysics, fires, torchMounts })
    buildGate(scene, "arena_gate_n", NORTH, mats, room, { open: false, hasPhysics, fires, torchMounts })

    // ── Stands ────────────────────────────────────────────────────────────────
    const TAU = 2 * Math.PI
    sweep("arena_walkway", [[R + 0.35, PODIUM_Y, R + 1.6, PODIUM_Y]], 0, TAU, SEAT_TILE, mats.seat, scene)
    sweep("arena_treads", profile.treads, 0, TAU, SEAT_TILE, mats.seat, scene)
    sweep("arena_risers", profile.risers, 0, TAU, SEAT_TILE, mats.riser, scene)
    sweep("arena_midwall", [profile.midWall], 0, TAU, STONE_TILE, mats.dark, scene)
    sweep("arena_outer", [[profile.top.r, profile.top.y, profile.top.r, profile.top.y - 4]], 0, TAU, SEAT_TILE, mats.riser, scene)
    // an overgrown arena's rim trees - where they stand, which model, how big
    const rimTrees = theme.overgrown ? RIM_TREE_ANGLES.map((deg, i) => ({
        theta: deg * Math.PI / 180,
        model: TREE_MODELS[i % TREE_MODELS.length],
        scale: 1.9 + rng() * 0.6,
        yaw: rng() * Math.PI * 2,
    })) : []
    vomitoria(scene, profile, mats)
    colonnade(scene, profile, mats, fires, theme, rimTrees)
    const ledges = wallBanners(scene, mats, torchMounts, theme)
    // the roots first - the crowd keeps off them, and some empty seats grow
    // a bush instead
    const roots = theme.overgrown ? forestRoots(scene, profile, mats, rimTrees, rng) : null
    const seatPlants = []
    buildCrowd(scene, profile, theme.emptySeats, roots?.near, (x, y, z) => {
        if(theme.overgrown && rng() < 0.06) seatPlants.push(new Vector3(x, y, z))
    })

    // ── Fire ──────────────────────────────────────────────────────────────────
    const fx = {
        fire:  new Texture("./images/particles/fireTex.webp", scene),
        spark: new Texture("./images/particles/flare.webp", scene),
    }
    const glows = fireGlows(scene)
    fires.forEach(f => {
        if(f.light) createFireParticles(f.pos, scene, f.big ? BRAZIER_LIGHT : TORCH_LIGHT)
        if(f.big) bigFlame(scene, f.pos, fx)
        glows.flare(f.pos.add(new Vector3(0, 0.3, 0)), f.big ? 3 : 1.1)
    })
    torchMounts.forEach(m => {
        const flame = m.pos.add(m.inward.scale(TORCH_FLAME_OUT))
        flame.y += TORCH_FLAME_UP - 0.25   // createFireParticles puts the flame 0.25 above the point
        createFireParticles(flame, scene, TORCH_LIGHT)
        glows.flare(flame.add(new Vector3(0, 0.3, 0)), 1.1)
        glows.torch(m)
    })
    glows.podiumWashes(torchMounts.filter(m => m.theta !== undefined))

    if(theme.overgrown) overgrowth(scene, mats, fx, { roots, ledges, seatPlants, rng })

    // the crowd greets the fighters
    cheerArenaCrowd(0.55, 2600)

    // models last - the flames, light and roots above don't wait on them
    await Promise.all([
        placeTorchModels(scene, torchMounts),
        placeRimTrees(scene, profile, rimTrees),
    ])
}

// Makes a share of the crowd jump - strength 0..1 is the share (and how high),
// durationMs how long they keep it up. Called by duelSystem.js on every hit
// that lands and when a fight ends; harmless outside an arena.
export function cheerArenaCrowd(strength = 0.3, durationMs = 1300){
    if(!crowd || crowd.scene.isDisposed) return
    const now = performance.now()
    const count = Math.round(crowd.n * Math.min(1, strength))
    for(let k = 0; k < count; k++){
        const i = Math.floor(Math.random() * crowd.n)
        const start = crowd.hopEnd[i] > now ? crowd.hopStart[i] : now + Math.random() * 350
        const wanted = Math.max(HOP_MS, durationMs * (0.6 + Math.random() * 0.4))
        // whole hops only, so nobody drops back down mid-air
        const end = start + Math.ceil((now - start + wanted) / HOP_MS) * HOP_MS
        if(crowd.hopEnd[i] > now){
            crowd.hopEnd[i] = Math.max(crowd.hopEnd[i], end)
            continue
        }
        crowd.hopStart[i] = start
        crowd.hopEnd[i] = end
        crowd.hopHeight[i] = 0.1 + Math.random() * 0.12 + 0.1 * Math.min(1, strength)
        crowd.active.push(i)
    }
}

// ── Atmosphere ────────────────────────────────────────────────────────────────
// Night: sceneTemp (tools/lighting.js) already made the moonlight - its colour
// and direction - and the fog's colour. This adds the sky, a moonlit ambient,
// thicker haze, and turns the PBR environment down so the fighters' own
// image-based light doesn't read as daylight.
function nightAtmosphere(scene){
    const moonLight = scene.lights.find(l => l instanceof DirectionalLight)
    scene.lights.forEach(light => {
        if(!(light instanceof HemisphericLight)) return
        light.diffuse = new Color3(0.5, 0.56, 0.82)
        light.groundColor = new Color3(0.22, 0.14, 0.08)   // torchlight off the sand
        light.specular = Color3.Black()
    })
    if(moonLight) moonLight.specular = new Color3(0.12, 0.14, 0.2)
    scene.fogDensity = 0.0065
    scene.environmentIntensity = 0.35

    const toMoon = moonLight ? moonLight.direction.scale(-1).normalize() : new Vector3(-0.3, 0.6, 0.75).normalize()
    const moonColor = moonLight?.diffuse ?? new Color3(0.62, 0.72, 1)
    starDome(scene)
    moon(scene, toMoon, moonColor)
}

function starDome(scene){
    const W = 2048, H = 1024
    const tex = new DynamicTexture("arena_stars_tex", { width: W, height: H }, scene, true)
    const ctx = tex.getContext()
    // canvas top is the zenith, the middle row the horizon
    const sky = ctx.createLinearGradient(0, 0, 0, H)
    sky.addColorStop(0, "#03050c")
    sky.addColorStop(0.36, "#061022")
    sky.addColorStop(0.49, "#17233d")
    sky.addColorStop(0.52, "#0a0f1a")
    sky.addColorStop(1, "#020306")
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, H)

    // a faint milky band across the upper sky
    const bandY = x => H * 0.24 + Math.sin(x / W * Math.PI * 2) * H * 0.1
    ctx.save()
    ctx.filter = "blur(26px)"
    ctx.strokeStyle = "rgba(120, 140, 195, 0.12)"
    ctx.lineWidth = 120
    ctx.beginPath()
    for(let x = -40; x <= W + 40; x += 32) x < 0 ? ctx.moveTo(x, bandY(x)) : ctx.lineTo(x, bandY(x))
    ctx.stroke()
    ctx.restore()

    const star = (x, y, lat, r, a, rgb) => {
        ctx.fillStyle = `rgba(${rgb}, ${a})`
        ctx.beginPath()
        // an equirect row shrinks toward the zenith - widen to keep stars round
        ctx.ellipse(x, y, r / Math.max(Math.cos(lat), 0.2), r, 0, 0, Math.PI * 2)
        ctx.fill()
    }
    const colors = ["255,255,255", "205,220,255", "255,240,215", "190,205,255"]
    for(let i = 0; i < 2600; i++){
        const lat = Math.asin(Math.random())   // even over the upper hemisphere
        const big = Math.random() < 0.025
        const fade = Math.min(1, lat / 0.14)   // into the haze at the horizon
        star(Math.random() * W, (0.5 - lat / Math.PI) * H, lat,
            big ? 1 + Math.random() * 0.7 : 0.4 + Math.random() * 0.55,
            (big ? 0.95 : 0.3 + Math.random() * 0.5) * fade,
            colors[Math.floor(Math.random() * colors.length)])
    }
    for(let i = 0; i < 1400; i++){
        const x = Math.random() * W
        const y = bandY(x) + (Math.random() + Math.random() + Math.random() - 1.5) * 70
        const lat = Math.PI * (0.5 - y / H)
        if(lat <= 0) continue
        star(x, y, lat, 0.35 + Math.random() * 0.4, 0.25 + Math.random() * 0.35, "215,225,255")
    }
    // not flipped on upload - the sphere's v starts at its top pole, so the
    // canvas's top row lands on the zenith
    tex.update(false)
    tex.wrapU = Texture.WRAP_ADDRESSMODE

    const dome = MeshBuilder.CreateSphere("arena_sky", { diameter: 900, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene)
    const mat = new StandardMaterial("arena_sky_mat", scene)
    mat.emissiveTexture = tex
    mat.diffuseColor = Color3.Black()
    mat.specularColor = Color3.Black()
    mat.disableLighting = true
    mat.fogEnabled = false
    dome.material = mat
    dome.infiniteDistance = true
    dome.isPickable = false
}

function moon(scene, toMoon, color){
    const rgb = c => `${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}`
    // its light's colour, washed toward white - moonlight is tinted, the moon barely
    const tint = Color3.Lerp(color, Color3.White(), 0.6)

    const S = 256
    const tex = new DynamicTexture("arena_moon_tex", { width: S, height: S }, scene, true)
    const ctx = tex.getContext()
    ctx.clearRect(0, 0, S, S)
    const glow = ctx.createRadialGradient(S / 2, S / 2, S * 0.27, S / 2, S / 2, S / 2)
    glow.addColorStop(0, `rgba(${rgb(tint)}, 0.4)`)
    glow.addColorStop(1, `rgba(${rgb(tint)}, 0)`)
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, S, S)
    const r = S * 0.29
    const disc = ctx.createRadialGradient(S * 0.45, S * 0.43, r * 0.1, S / 2, S / 2, r)
    disc.addColorStop(0, "rgb(255, 255, 255)")
    disc.addColorStop(1, `rgb(${rgb(Color3.Lerp(tint, Color3.White(), 0.3))})`)
    ctx.beginPath()
    ctx.arc(S / 2, S / 2, r, 0, Math.PI * 2)
    ctx.fillStyle = disc
    ctx.fill()
    ctx.save()
    ctx.clip()
    ;[[0.42, 0.4, 0.1], [0.56, 0.46, 0.075], [0.5, 0.6, 0.085], [0.37, 0.56, 0.055], [0.6, 0.6, 0.04]].forEach(([x, y, rr]) => {
        ctx.beginPath()
        ctx.arc(S * x, S * y, S * rr, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(120, 128, 152, 0.26)"
        ctx.fill()
    })
    ctx.restore()
    tex.hasAlpha = true
    tex.update()

    const disc3d = MeshBuilder.CreatePlane("arena_moon", { size: 44 }, scene)
    const mat = new StandardMaterial("arena_moon_mat", scene)
    mat.emissiveTexture = tex
    mat.opacityTexture = tex
    mat.diffuseColor = Color3.Black()
    mat.specularColor = Color3.Black()
    mat.disableLighting = true
    mat.fogEnabled = false
    disc3d.material = mat
    disc3d.billboardMode = Mesh.BILLBOARDMODE_ALL
    disc3d.position = toMoon.scale(400)
    disc3d.infiniteDistance = true
    disc3d.isPickable = false

    // a wide, faint halo around it
    const haloTex = radialTexture("arena_moon_halo_tex", scene, [[0, `rgba(${rgb(color)}, 0.22)`], [0.35, `rgba(${rgb(color)}, 0.07)`], [1, `rgba(${rgb(color)}, 0)`]])
    haloTex.hasAlpha = true
    const halo = MeshBuilder.CreatePlane("arena_moon_halo", { size: 210 }, scene)
    const haloMat = new StandardMaterial("arena_moon_halo_mat", scene)
    haloMat.emissiveTexture = haloTex
    haloMat.opacityTexture = haloTex
    haloMat.diffuseColor = Color3.Black()
    haloMat.specularColor = Color3.Black()
    haloMat.disableLighting = true
    haloMat.fogEnabled = false
    halo.material = haloMat
    halo.billboardMode = Mesh.BILLBOARDMODE_ALL
    halo.position = toMoon.scale(410)
    halo.infiniteDistance = true
    halo.isPickable = false
}

// ── Materials ─────────────────────────────────────────────────────────────────
function arenaMaterials(scene, theme){
    const mat = (name, tex, { normal, tint = [1, 1, 1] } = {}) => {
        const m = new StandardMaterial(name, scene)
        if(tex) m.diffuseTexture = new Texture(tex, scene)
        if(normal) m.bumpTexture = new Texture(normal, scene)
        m.diffuseColor = new Color3(...tint)
        m.specularColor = Color3.Black()
        m.maxSimultaneousLights = MAX_LIGHTS
        return m
    }
    const glow = (name, tex) => {
        const m = new StandardMaterial(name, scene)
        m.emissiveTexture = tex
        m.diffuseColor = Color3.Black()
        m.specularColor = Color3.Black()
        m.disableLighting = true
        return m
    }
    const mats = {
        iron:   mat("arena_iron", "./images/modeltex/iron2.jpg", { tint: [0.34, 0.32, 0.32] }),
        wood:   mat("arena_wood", "./images/modeltex/wood3.jpg", { tint: [0.55, 0.42, 0.32] }),
        cloth:  mat("arena_cloth", "./images/modeltex/carpet2.jpg", { tint: hexTint(theme.banner, 1.6) }),
        gold:   mat("arena_gold", null, { tint: [0.72, 0.55, 0.2] }),
        purple: mat("arena_purple", null, { tint: [0.33, 0.12, 0.38] }),
        bronze: mat("arena_bronze", null, { tint: [0.55, 0.38, 0.18] }),
        skin:   mat("arena_skin", null, { tint: [0.72, 0.53, 0.4] }),
    }
    // the theme's own surfaces - no normal maps: at arena distances they broke
    // up into speckle
    Object.entries(theme.mats).forEach(([key, [tex, tint]]) => {
        mats[key] = mat(`arena_${key}`, tex, { tint })
    })
    if(theme.overgrown) mats.bark = mat("arena_bark", "./images/modeltex/tree1.jpg", { tint: [0.55, 0.5, 0.42] })

    mats.gold.specularColor = new Color3(0.35, 0.3, 0.15)
    mats.bronze.specularColor = new Color3(0.3, 0.22, 0.1)
    mats.iron.specularColor = new Color3(0.15, 0.15, 0.15)

    mats.void = glow("arena_void", null)
    mats.void.emissiveColor = Color3.Black()
    // firelight somewhere past the end of the way out
    mats.exitGlow = glow("arena_exit_glow", radialTexture("arena_exit_glow_tex", scene, [[0, "#b07a40"], [0.5, "#3c2611"], [1, "#000000"]]))
    mats.hellGlow = glow("arena_hell_glow", radialTexture("arena_hell_glow_tex", scene, [[0, "#b02a08"], [0.45, "#4a0c02"], [1, "#0a0100"]]))
    mats.coals = glow("arena_coals", radialTexture("arena_coals_tex", scene, [[0, "#ffd27a"], [0.5, "#ff7a1a"], [1, "#8a1d02"]]))

    const banner = bannerTexture(scene, theme)
    mats.banner = mat("arena_banner")
    mats.banner.diffuseTexture = banner
    mats.banner.diffuseTexture.hasAlpha = true
    mats.banner.backFaceCulling = false
    const drape = drapeTexture(scene, theme)
    mats.drape = mat("arena_drape")
    mats.drape.diffuseTexture = drape
    mats.drape.diffuseTexture.hasAlpha = true
    mats.drape.backFaceCulling = false
    mats.pennant = mat("arena_pennant", null, { tint: hexTint(theme.banner, 1.35) })
    mats.pennant.backFaceCulling = false
    return mats
}

function hexTint(hex, gain = 1){
    const c = Color3.FromHexString(hex)
    return [Math.min(1, c.r * gain), Math.min(1, c.g * gain), Math.min(1, c.b * gain)]
}

function radialTexture(name, scene, stops, size = 256){
    const tex = new DynamicTexture(name, { width: size, height: size }, scene, false)
    const ctx = tex.getContext()
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    stops.forEach(([at, color]) => g.addColorStop(at, color))
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    tex.update()
    return tex
}

// a hanging banner - swallowtail foot, gold border, crossed swords in a wreath
function bannerTexture(scene, theme){
    const W = 256, H = 576
    const tex = new DynamicTexture("arena_banner_tex", { width: W, height: H }, scene, true)
    const ctx = tex.getContext()
    ctx.clearRect(0, 0, W, H)
    const shape = inset => {
        ctx.beginPath()
        ctx.moveTo(inset, inset)
        ctx.lineTo(W - inset, inset)
        ctx.lineTo(W - inset, H - inset * 1.4)
        ctx.lineTo(W / 2, H - 90 - inset * 0.4)
        ctx.lineTo(inset, H - inset * 1.4)
        ctx.closePath()
    }
    shape(0)
    ctx.fillStyle = theme.banner
    ctx.fill()
    // folds - soft vertical light and shade across the cloth
    ctx.save()
    ctx.clip()
    for(let x = 0; x < W; x += 4){
        const shade = Math.sin(x / W * Math.PI * 5) * 0.5 + Math.sin(x / W * Math.PI * 11) * 0.2
        ctx.fillStyle = shade > 0 ? `rgba(255, 220, 200, ${shade * 0.08})` : `rgba(0, 0, 0, ${-shade * 0.25})`
        ctx.fillRect(x, 0, 4, H)
    }
    ctx.restore()
    shape(14)
    ctx.lineWidth = 7
    ctx.strokeStyle = theme.trim
    ctx.stroke()
    crest(ctx, W / 2, 205, 82, theme.trim)
    tex.update()
    return tex
}

// the cloth draped over the emperor's box rail - wide, fringed, the same crest
function drapeTexture(scene, theme){
    const W = 512, H = 256
    const tex = new DynamicTexture("arena_drape_tex", { width: W, height: H }, scene, true)
    const ctx = tex.getContext()
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = theme.banner
    ctx.fillRect(0, 0, W, H - 26)
    for(let x = 0; x < W; x += 4){
        const shade = Math.sin(x / W * Math.PI * 7) * 0.5
        ctx.fillStyle = shade > 0 ? `rgba(255, 220, 200, ${shade * 0.07})` : `rgba(0, 0, 0, ${-shade * 0.22})`
        ctx.fillRect(x, 0, 4, H - 26)
    }
    ctx.fillStyle = theme.trim
    ctx.fillRect(0, 16, W, 8)
    ctx.fillRect(0, H - 40, W, 8)
    // fringe
    for(let x = 4; x < W; x += 9) ctx.fillRect(x, H - 32, 4, 26 + (x % 18 ? 0 : 4))
    crest(ctx, W / 2, H / 2 - 12, 60, theme.trim)
    tex.update()
    return tex
}

function crest(ctx, cx, cy, size, color){
    ctx.save()
    ctx.translate(cx, cy)
    ctx.fillStyle = color
    ctx.strokeStyle = color
    // laurel - two arcs of leaves
    for(const side of [-1, 1]){
        for(let k = 0; k < 9; k++){
            const t = Math.PI * (0.62 + k * 0.085)
            const x = Math.cos(t) * size * side * -1
            const y = Math.sin(t) * size * 0.95 - size * 0.12
            ctx.save()
            ctx.translate(x, y)
            ctx.rotate(t * side + (side > 0 ? Math.PI : 0) + 0.5 * side)
            ctx.beginPath()
            ctx.ellipse(0, 0, size * 0.16, size * 0.065, 0, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()
        }
    }
    // crossed swords
    for(const side of [-1, 1]){
        ctx.save()
        ctx.rotate(side * 0.62)
        ctx.fillRect(-size * 0.045, -size * 0.95, size * 0.09, size * 1.35)       // blade
        ctx.beginPath()
        ctx.moveTo(-size * 0.045, -size * 0.95)
        ctx.lineTo(0, -size * 1.1)
        ctx.lineTo(size * 0.045, -size * 0.95)
        ctx.fill()                                                                  // point
        ctx.fillRect(-size * 0.24, size * 0.38, size * 0.48, size * 0.07)          // guard
        ctx.fillRect(-size * 0.035, size * 0.45, size * 0.07, size * 0.28)         // grip
        ctx.beginPath()
        ctx.arc(0, size * 0.78, size * 0.07, 0, Math.PI * 2)
        ctx.fill()                                                                  // pommel
        ctx.restore()
    }
    ctx.restore()
}

// the arena's name cut into the plaque over the way out, in Roman letters
function plaqueTexture(scene, name){
    const W = 1024, H = 192
    const tex = new DynamicTexture("arena_plaque_tex", { width: W, height: H }, scene, true)
    const ctx = tex.getContext()
    ctx.fillStyle = "#cfc6b4"
    ctx.fillRect(0, 0, W, H)
    for(let i = 0; i < 900; i++){
        ctx.fillStyle = `rgba(${Math.random() < 0.5 ? "90, 80, 66" : "255, 250, 240"}, ${Math.random() * 0.12})`
        ctx.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 6, 1 + Math.random() * 3)
    }
    ctx.strokeStyle = "rgba(70, 60, 48, 0.8)"
    ctx.lineWidth = 6
    ctx.strokeRect(14, 14, W - 28, H - 28)
    const text = name.toUpperCase().replace(/U/g, "V").replace(/J/g, "I").replace(/'/g, "").split(" ").join(" · ")
    let px = 92
    ctx.font = `bold ${px}px "Times New Roman", Georgia, serif`
    while(ctx.measureText(text).width > W - 110 && px > 30){
        px -= 4
        ctx.font = `bold ${px}px "Times New Roman", Georgia, serif`
    }
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle = "rgba(255, 252, 245, 0.7)"
    ctx.fillText(text, W / 2 + 2, H / 2 + 4)
    ctx.fillStyle = "#3b3226"
    ctx.fillText(text, W / 2, H / 2 + 1)
    tex.update()
    return tex
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

// Sweeps 2D profile segments [r0, y0, r1, y1] around the arena's axis from
// angle a0 to a1 (a0 < a1, radians): one quad strip per segment with its own
// flat normal, UVs in metres / tile. Segments run outward/upward, which makes
// their front (the normal's side) the one that faces the arena: up for a
// tread, in toward the sand for a riser.
function sweep(name, segments, a0, a1, tile, mat, scene){
    const positions = [], normals = [], uvs = [], indices = []
    segments.forEach(([r0, y0, r1, y1]) => {
        const dr = r1 - r0, dy = y1 - y0
        const len = Math.hypot(dr, dy)
        const nr = -dy / len, ny = dr / len
        const midR = (r0 + r1) / 2
        const v0 = (r0 + y0) / tile
        const steps = Math.max(2, Math.ceil((a1 - a0) * Math.max(r0, r1) / ARC_STEP))
        const base = positions.length / 3
        for(let s = 0; s <= steps; s++){
            const a = a0 + (a1 - a0) * s / steps
            const c = Math.cos(a), sn = Math.sin(a)
            positions.push(r0 * c, y0, r0 * sn, r1 * c, y1, r1 * sn)
            normals.push(nr * c, ny, nr * sn, nr * c, ny, nr * sn)
            const u = a * midR / tile
            uvs.push(u, v0, u, v0 + len / tile)
        }
        for(let s = 0; s < steps; s++){
            const i = base + s * 2
            indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2)
        }
    })
    const mesh = new Mesh(name, scene)
    const data = new VertexData()
    data.positions = positions
    data.normals = normals
    data.uvs = uvs
    data.indices = indices
    data.applyToMesh(mesh)
    mesh.material = mat
    return settle(mesh)
}

// UVs from the two axes each face spans, in metres / tile - a box (or a CSG
// cut of one) of any size gets the same texture scale as everything else
function planarUVs(mesh, tile){
    const pos = mesh.getVerticesData(VertexBuffer.PositionKind)
    const nor = mesh.getVerticesData(VertexBuffer.NormalKind)
    const uvs = new Float32Array(pos.length / 3 * 2)
    for(let i = 0, v = 0; i < pos.length; i += 3, v += 2){
        const ax = Math.abs(nor[i]), ay = Math.abs(nor[i + 1]), az = Math.abs(nor[i + 2])
        let u, w
        if(ay >= ax && ay >= az){ u = pos[i]; w = pos[i + 2] }
        else if(ax >= az){ u = pos[i + 2]; w = pos[i + 1] }
        else { u = pos[i]; w = pos[i + 1] }
        uvs[v] = u / tile
        uvs[v + 1] = w / tile
    }
    mesh.setVerticesData(VertexBuffer.UVKind, uvs)
    return mesh
}

function block(name, w, h, d, mat, scene, tile = STONE_TILE){
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene)
    mesh.material = mat
    planarUVs(mesh, tile)
    mesh.isPickable = false
    return mesh
}

function settle(mesh){
    mesh.isPickable = false
    mesh.freezeWorldMatrix()
    return mesh
}

function collider(name, pos, w, h, d, rotY, scene){
    const box = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene)
    box.position.copyFrom(pos)
    box.rotation.y = rotY
    box.isVisible = false
    box.isPickable = false
    createAggregate(box, { mass: 0 }, "box", scene)
    return box
}

// A frame standing on the wall line at angle theta: local -z points in to the
// sand, +z out through the wall, x runs along it. Torches, banners and gates
// are all built in one of these.
function wallFrame(name, theta, r, y, scene){
    const node = new TransformNode(name, scene)
    node.position.set(r * Math.cos(theta), y, r * Math.sin(theta))
    node.rotation.y = Math.PI / 2 - theta
    node.computeWorldMatrix(true)
    return node
}
const atLocal = (node, x, y, z) => Vector3.TransformCoordinates(new Vector3(x, y, z), node.getWorldMatrix())
const inwardAt = theta => new Vector3(-Math.cos(theta), 0, -Math.sin(theta))
const angleDist = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))

function parentAll(node, meshes){
    meshes.forEach(m => {
        m.parent = node
        settle(m)
    })
}

// ── The stands' profile ───────────────────────────────────────────────────────
// [r0, y0, r1, y1] segments, from the front walkway's back edge outward: the
// lower tier, the wall between the tiers and its walkway, the upper tier, and
// the platform the colonnade stands on. rows - where the crowd sits.
function caveaProfile(){
    const treads = [], risers = [], rows = []
    let r = R + 1.6, y = PODIUM_Y
    const step = (rise, depth, seat) => {
        risers.push([r, y, r, y + rise])
        y += rise
        treads.push([r, y, r + depth, y])
        if(seat) rows.push({ r: r + depth * 0.58, y, tier: rows.length < LOWER_ROWS ? 0 : 1 })
        r += depth
    }
    for(let i = 0; i < LOWER_ROWS; i++) step(LOWER_RISE, ROW_DEPTH, true)
    const midWall = [r, y, r, y + MID_WALL_H]
    const midWallBase = { r, y }
    y += MID_WALL_H
    treads.push([r, y, r + 1.4, y])
    r += 1.4
    for(let i = 0; i < UPPER_ROWS; i++) step(UPPER_RISE, ROW_DEPTH, true)
    step(0.6, 2.0, false)
    const top = { r, y }
    // what roots crawl over (createRoots.js), [r, y] from the centre of the
    // sand outward: up the podium wall and round its cornice, over the
    // parapet, across the walkway, then the seats' front edges (a root
    // bridges from step to step), the wall between the tiers, and the top
    const rootPath = [
        [0, 0], [R, 0],
        [R, WALL_H], [R - 0.25, WALL_H], [R - 0.25, PODIUM_Y], [R - 0.05, PODIUM_Y],
        [R - 0.05, PARAPET_TOP], [R + 0.35, PARAPET_TOP], [R + 0.4, PODIUM_Y], [R + 1.6, PODIUM_Y],
        [R + 1.6, PODIUM_Y + LOWER_RISE],
        [midWallBase.r - ROW_DEPTH, midWallBase.y], [midWallBase.r, midWallBase.y],
        [midWallBase.r, midWallBase.y + MID_WALL_H],
        [midWallBase.r + 1.4, midWallBase.y + MID_WALL_H],
        [midWallBase.r + 1.4, midWallBase.y + MID_WALL_H + UPPER_RISE],
        [top.r - 2 - ROW_DEPTH, top.y - 0.6], [top.r - 2, top.y - 0.6],
        [top.r - 2, top.y], [top.r, top.y],
    ]
    return { treads, risers, rows, midWall, midWallBase, top, rootPath }
}

// ── Physics ───────────────────────────────────────────────────────────────────
function wallColliders(scene, profile){
    // the podium wall - 120 boxes, a gap only where the open south gate is
    const SEGMENTS = 120
    const ringR = R + 0.6
    for(let i = 0; i < SEGMENTS; i++){
        const a = (i + 0.5) / SEGMENTS * 2 * Math.PI
        if(angleDist(a, SOUTH) < 0.04) continue
        collider(`arena_wallcol_${i}`, new Vector3(ringR * Math.cos(a), 2.5, ringR * Math.sin(a)),
            2 * Math.PI * ringR / SEGMENTS * 1.08, 5, 1.2, Math.PI / 2 - a, scene)
    }

    // the stands, for the camera - one slope from the parapet to the colonnade
    const { top, midWallBase } = profile
    const shape = [
        new Vector3(R - 0.05, PARAPET_TOP + 0.05, 0),
        new Vector3(R + 1.6, PARAPET_TOP + 0.05, 0),
        new Vector3(midWallBase.r, midWallBase.y + MID_WALL_H, 0),
        new Vector3(top.r - 2, top.y, 0),
        new Vector3(top.r + 0.4, top.y + COLUMN_H + 0.7, 0),
    ]
    const stands = MeshBuilder.CreateLathe("arena_stands_collider", { shape, tessellation: 48, sideOrientation: Mesh.DOUBLESIDE }, scene)
    stands.isVisible = false
    stands.isPickable = false
    createAggregate(stands, { mass: 0 }, "mesh", scene)
}

// ── Gates ─────────────────────────────────────────────────────────────────────
// A stone face with an arched opening (a CSG cut), voussoirs and a keystone
// round the arch, a portcullis, and a short vaulted tunnel behind. open: the
// way out - portcullis up, a torch in the tunnel, the tunnel walkable (its
// own colliders close off its end). Closed: the opponents' gate - portcullis
// down, red light and smoke behind the bars, the emperor's box on top.
function buildGate(scene, name, theta, mats, room, { open, hasPhysics, fires, torchMounts }){
    const node = wallFrame(name, theta, R, 0, scene)
    const rotY = node.rotation.y
    const parts = []

    // the face
    const solid = MeshBuilder.CreateBox(`${name}_solid`, { width: GATE_HALF * 2, height: PODIUM_Y, depth: FACADE_D }, scene)
    solid.position.y = PODIUM_Y / 2
    const cutLow = MeshBuilder.CreateBox(`${name}_cutlow`, { width: OPENING_W, height: SPRING_Y + 1, depth: FACADE_D + 1 }, scene)
    cutLow.position.y = (SPRING_Y - 1) / 2
    const cutArc = MeshBuilder.CreateCylinder(`${name}_cutarc`, { diameter: OPENING_W, height: FACADE_D + 1, tessellation: 40 }, scene)
    cutArc.rotation.x = Math.PI / 2
    cutArc.position.y = SPRING_Y
    const face = CSG.FromMesh(solid).subtract(CSG.FromMesh(cutLow)).subtract(CSG.FromMesh(cutArc)).toMesh(`${name}_face`, mats.wall, scene)
    ;[solid, cutLow, cutArc].forEach(m => m.dispose())
    planarUVs(face, STONE_TILE)
    face.position.set(0, PODIUM_Y / 2, FACADE_Z + FACADE_D / 2)
    parts.push(face)

    // the cornice carried across the face
    const course = block(`${name}_course`, GATE_HALF * 2, 0.3, 0.45, mats.trim, scene, TRIM_TILE)
    course.position.set(0, WALL_H + 0.15, FACADE_Z - 0.25 + 0.225)
    parts.push(course)

    // voussoirs round the arch, keystone at the crown, imposts at the springing
    const archR = OPENING_W / 2 + 0.27
    const STONES = 13
    for(let k = 0; k < STONES; k++){
        const t = Math.PI * (k + 0.5) / STONES
        const key = k === (STONES - 1) / 2
        const stone = block(`${name}_vs${k}`, key ? 0.56 : 0.42, key ? 0.78 : 0.54, key ? 0.34 : 0.22, mats.trim, scene, TRIM_TILE)
        stone.position.set(Math.cos(t) * archR, SPRING_Y + Math.sin(t) * archR + (key ? 0.06 : 0), FACADE_Z - (key ? 0.12 : 0.06))
        stone.rotation.z = t - Math.PI / 2
        parts.push(stone)
    }
    for(const side of [-1, 1]){
        const impost = block(`${name}_impost${side}`, 0.62, 0.24, 0.3, mats.trim, scene, TRIM_TILE)
        impost.position.set(side * (OPENING_W / 2 + 0.2), SPRING_Y - 0.12, FACADE_Z - 0.08)
        parts.push(impost)
    }

    // pilasters either side - the way out's carry fire bowls above the attic,
    // the opponents' hold up the emperor's box
    const pilasterH = open ? 6.3 : PODIUM_Y
    const pilasterZ = FACADE_Z - 0.3 + 0.325
    for(const side of [-1, 1]){
        const x = side * (GATE_HALF - 0.325)
        const pilaster = block(`${name}_pilaster${side}`, 0.65, pilasterH, 0.65, mats.wall, scene)
        pilaster.position.set(x, pilasterH / 2, pilasterZ)
        parts.push(pilaster)
        if(hasPhysics) collider(`${name}_pilastercol${side}`, atLocal(node, x, pilasterH / 2, pilasterZ), 0.65, pilasterH, 0.65, rotY, scene)
        if(open){
            const cap = block(`${name}_cap${side}`, 0.85, 0.25, 0.85, mats.trim, scene, TRIM_TILE)
            cap.position.set(x, pilasterH + 0.125, pilasterZ)
            parts.push(cap)
            parts.push(...fireBowl(scene, `${name}_bowl${side}`, new Vector3(x, pilasterH + 0.25, pilasterZ), mats))
            fires.push({ pos: atLocal(node, x, pilasterH + 0.25 + FLAME_ABOVE_BOWL, pilasterZ), big: true, light: true })
        }
    }

    // the tunnel
    const z0 = FACADE_Z + FACADE_D
    const zMid = z0 + TUNNEL_LEN / 2
    const sideX = OPENING_W / 2 + 0.25
    for(const side of [-1, 1]){
        const wall = block(`${name}_tunnel${side}`, 0.5, ARCH_TOP, TUNNEL_LEN, mats.wall, scene)
        wall.position.set(side * sideX, ARCH_TOP / 2, zMid)
        parts.push(wall)
        if(hasPhysics && open) collider(`${name}_tunnelcol${side}`, atLocal(node, side * sideX, ARCH_TOP / 2, zMid), 0.5, ARCH_TOP, TUNNEL_LEN, rotY, scene)
    }
    const vault = MeshBuilder.CreateCylinder(`${name}_vault`, {
        diameter: OPENING_W + 0.02, height: TUNNEL_LEN, tessellation: 24, arc: 0.5, enclose: false, sideOrientation: Mesh.BACKSIDE,
    }, scene)
    vault.material = mats.wall
    planarUVs(vault, STONE_TILE)
    vault.rotation.set(Math.PI / 2, 0, 0)   // the upper half-cylinder
    vault.position.set(0, SPRING_Y, zMid)
    parts.push(vault)
    const paving = MeshBuilder.CreateGround(`${name}_paving`, { width: OPENING_W + 0.2, height: TUNNEL_LEN + FACADE_D }, scene)
    paving.material = mats.paving
    planarUVs(paving, STONE_TILE)
    paving.position.set(0, 0.004, z0 + (TUNNEL_LEN - FACADE_D) / 2)
    parts.push(paving)
    const end = MeshBuilder.CreatePlane(`${name}_end`, { width: OPENING_W + 0.6, height: ARCH_TOP + 0.3 }, scene)
    end.material = open ? mats.exitGlow : mats.hellGlow
    end.position.set(0, (ARCH_TOP + 0.3) / 2, z0 + TUNNEL_LEN - 0.02)
    parts.push(end)
    if(hasPhysics && open) collider(`${name}_endcol`, atLocal(node, 0, ARCH_TOP / 2, z0 + TUNNEL_LEN + 0.25), OPENING_W + 1, ARCH_TOP, 0.5, rotY, scene)

    // the portcullis - up (only its spikes show under the crown) or down
    const grid = portcullis(`${name}_portcullis`, OPENING_W + 0.1, open ? 3.0 : ARCH_TOP + 0.3, mats.iron, scene)
    grid.position.set(0, open ? 2.6 : 0, FACADE_Z + FACADE_D / 2)
    parts.push(grid)

    if(open){
        // a torch partway down the tunnel, on its left wall
        const torch = new Vector3(-sideX + 0.25, TORCH_Y - 0.4, z0 + 1.4)
        torchMounts.push({ pos: atLocal(node, torch.x, torch.y, torch.z), yaw: rotY - Math.PI / 2, inward: rotateY(new Vector3(1, 0, 0), rotY) })

        // the attic over the way out, with the arena's name cut into it
        const attic = block(`${name}_attic`, GATE_HALF * 2 + 0.6, 1.9, 1.3, mats.wall, scene)
        attic.position.set(0, WALL_H + 0.95, FACADE_Z + 0.65)
        parts.push(attic)
        const coping = block(`${name}_coping`, GATE_HALF * 2 + 0.8, 0.16, 1.42, mats.trim, scene, TRIM_TILE)
        coping.position.set(0, WALL_H + 1.98, FACADE_Z + 0.62)
        parts.push(coping)
        const plaque = MeshBuilder.CreatePlane(`${name}_plaque`, { width: 4.6, height: 0.86 }, scene)
        const plaqueMat = new StandardMaterial(`${name}_plaque_mat`, scene)
        plaqueMat.diffuseTexture = plaqueTexture(scene, room.name ?? "Dueling Grounds")
        plaqueMat.specularColor = Color3.Black()
        plaqueMat.maxSimultaneousLights = MAX_LIGHTS
        plaque.material = plaqueMat
        plaque.position.set(0, WALL_H + 0.95, FACADE_Z - 0.01)
        parts.push(plaque)
    } else {
        // something waiting behind the bars - red light, smoke curling out
        const glowAt = atLocal(node, 0, 1.4, z0 + 1.2)
        const light = new PointLight("fire_light", glowAt, scene)
        light.diffuse = new Color3(1, 0.22, 0.06)
        light.specular = Color3.Black()
        light.range = 9
        let tick = 0
        scene.registerBeforeRender(() => {
            tick += 0.02
            light.intensity = 1.5 + Math.sin(tick * 1.7) * 0.35 + Math.sin(tick * 5.3) * 0.12
        })
        gateSmoke(scene, atLocal(node, 0, 0.3, z0 + 0.6), inwardAt(theta))
        parts.push(...emperorsBox(scene, name, mats, fires, node))
        // banners on the face, either side of the arch
        for(const side of [-1, 1]){
            const banner = MeshBuilder.CreatePlane(`${name}_banner${side}`, { width: 0.9, height: 2.3 }, scene)
            banner.material = mats.banner
            banner.position.set(side * 2.35, WALL_H - 1.25, FACADE_Z - 0.02)
            parts.push(banner)
        }
    }

    parentAll(node, parts)
    return node
}

// the emperor's box (pulvinar) on top of the opponents' gate, in its frame
function emperorsBox(scene, name, mats, fires, node){
    const parts = []
    const front = -1.0, back = 1.55
    const W = 8.4
    const floorY = PODIUM_Y + 0.35
    const platform = block(`${name}_box_floor`, W, 0.35, back - front, mats.trim, scene, TRIM_TILE)
    platform.position.set(0, PODIUM_Y + 0.175, (front + back) / 2)
    parts.push(platform)
    // a fascia under the overhang, closing the gap where the cornice stops
    const fascia = block(`${name}_box_fascia`, W, 0.3, 1.25, mats.wall, scene)
    fascia.position.set(0, WALL_H + 0.15, front + 0.62)
    parts.push(fascia)
    for(let k = 0; k < 5; k++){
        const corbel = block(`${name}_corbel${k}`, 0.34, 0.5, 1.0, mats.trim, scene, TRIM_TILE)
        corbel.position.set(-3.2 + k * 1.6, WALL_H - 0.25, front + 0.5)
        parts.push(corbel)
    }
    // the rail
    const rail = block(`${name}_rail`, W, 0.85, 0.22, mats.wall, scene)
    rail.position.set(0, floorY + 0.425, front + 0.11)
    parts.push(rail)
    for(const side of [-1, 1]){
        const sideRail = block(`${name}_rail${side}`, 0.22, 0.85, back - front, mats.wall, scene)
        sideRail.position.set(side * (W / 2 - 0.11), floorY + 0.425, (front + back) / 2)
        parts.push(sideRail)
    }
    const railCap = block(`${name}_railcap`, W + 0.16, 0.09, 0.32, mats.trim, scene, TRIM_TILE)
    railCap.position.set(0, floorY + 0.9, front + 0.11)
    parts.push(railCap)
    const drape = MeshBuilder.CreatePlane(`${name}_drape`, { width: 3.4, height: 1.7 }, scene)
    drape.material = mats.drape
    drape.position.set(0, floorY + 0.85 - 0.85, front - 0.02)
    parts.push(drape)

    // columns and the cloth canopy
    const colH = 3.4
    for(const x of [-3.85, 3.85]){
        for(const z of [front + 0.3, back - 0.25]){
            const column = MeshBuilder.CreateCylinder(`${name}_col`, { diameter: 0.34, height: colH, tessellation: 12 }, scene)
            column.material = mats.trim
            column.position.set(x, floorY + colH / 2, z)
            parts.push(column)
        }
    }
    const canopy = block(`${name}_canopy`, W + 0.5, 0.1, back - front + 0.5, mats.cloth, scene, 1.2)
    canopy.position.set(0, floorY + colH + 0.05, (front + back) / 2)
    canopy.rotation.x = -0.08
    parts.push(canopy)
    const valance = MeshBuilder.CreatePlane(`${name}_valance`, { width: W + 0.5, height: 0.55 }, scene)
    valance.material = mats.drape
    valance.position.set(0, floorY + colH - 0.2, front - 0.27)
    parts.push(valance)

    // the throne, its emperor, two guards
    const seat = block(`${name}_throne_seat`, 1.1, 0.45, 0.75, mats.gold, scene, 1)
    seat.position.set(0, floorY + 0.225, 1.0)
    const backrest = block(`${name}_throne_back`, 1.1, 1.5, 0.16, mats.gold, scene, 1)
    backrest.position.set(0, floorY + 0.75, 1.4)
    const cushion = block(`${name}_throne_cushion`, 0.8, 1.0, 0.06, mats.cloth, scene, 1)
    cushion.position.set(0, floorY + 0.85, 1.31)
    parts.push(seat, backrest, cushion)
    parts.push(...figure(scene, `${name}_emperor`, new Vector3(0, floorY + 0.45, 1.0), mats.purple, mats, { seated: true, wreath: mats.gold }))
    for(const side of [-1, 1]){
        parts.push(...figure(scene, `${name}_guard${side}`, new Vector3(side * 2.5, floorY, 1.0), mats.bronze, mats, { helmet: mats.bronze, crest: mats.cloth, spear: mats.wood }))
    }

    // braziers at the rail's corners
    for(const side of [-1, 1]){
        const x = side * 3.25
        const z = front + 0.55
        for(let leg = 0; leg < 3; leg++){
            const a = leg * Math.PI * 2 / 3
            const legMesh = MeshBuilder.CreateCylinder(`${name}_tripod`, { diameter: 0.05, height: 1.0, tessellation: 5 }, scene)
            legMesh.material = mats.iron
            legMesh.position.set(x + Math.cos(a) * 0.16, floorY + 0.48, z + Math.sin(a) * 0.16)
            legMesh.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25)
            parts.push(legMesh)
        }
        parts.push(...fireBowl(scene, `${name}_brazier${side}`, new Vector3(x, floorY + 0.92, z), mats))
        fires.push({ pos: atLocal(node, x, floorY + 0.92 + FLAME_ABOVE_BOWL, z), big: true, light: true })
    }
    return parts
}

// a person, all primitives - seated: on a seat at pos; standing: on the floor
function figure(scene, name, pos, robe, mats, { seated, wreath, helmet, crest, spear } = {}){
    const parts = []
    const bodyH = seated ? 0.62 : 1.18
    const body = MeshBuilder.CreateCylinder(`${name}_body`, { height: bodyH, diameterTop: 0.32, diameterBottom: seated ? 0.5 : 0.4, tessellation: 10 }, scene)
    body.material = robe
    body.position.set(pos.x, pos.y + bodyH / 2, pos.z)
    const headY = pos.y + bodyH + 0.14
    const head = MeshBuilder.CreateSphere(`${name}_head`, { diameter: 0.26, segments: 8 }, scene)
    head.material = mats.skin
    head.position.set(pos.x, headY, pos.z)
    parts.push(body, head)
    if(wreath){
        const ring = MeshBuilder.CreateTorus(`${name}_wreath`, { diameter: 0.25, thickness: 0.04, tessellation: 16 }, scene)
        ring.material = wreath
        ring.position.set(pos.x, headY + 0.05, pos.z)
        parts.push(ring)
    }
    if(helmet){
        const cap = MeshBuilder.CreateSphere(`${name}_helmet`, { diameter: 0.3, segments: 8, slice: 0.55 }, scene)
        cap.material = helmet
        cap.position.set(pos.x, headY + 0.01, pos.z)
        const plume = block(`${name}_crest`, 0.06, 0.16, 0.34, crest, scene, 1)
        plume.position.set(pos.x, headY + 0.2, pos.z)
        parts.push(cap, plume)
    }
    if(spear){
        const shaft = MeshBuilder.CreateCylinder(`${name}_spear`, { diameter: 0.04, height: 2.3, tessellation: 6 }, scene)
        shaft.material = spear
        shaft.position.set(pos.x + 0.3, pos.y + 1.15, pos.z - 0.05)
        const tip = MeshBuilder.CreateCylinder(`${name}_spear_tip`, { diameterTop: 0, diameterBottom: 0.08, height: 0.22, tessellation: 4 }, scene)
        tip.material = mats.iron
        tip.position.set(pos.x + 0.3, pos.y + 2.4, pos.z - 0.05)
        parts.push(shaft, tip)
    }
    return parts
}

// iron grid with spiked feet, built standing on y 0
function portcullis(name, w, h, mat, scene){
    const bars = []
    const verticals = Math.round(w / 0.3)
    for(let i = 0; i <= verticals; i++){
        const x = -w / 2 + 0.08 + i * (w - 0.16) / verticals
        const bar = MeshBuilder.CreateBox(`${name}_v`, { width: 0.07, height: h - 0.2, depth: 0.07 }, scene)
        bar.position.set(x, 0.2 + (h - 0.2) / 2, 0)
        const spike = MeshBuilder.CreateCylinder(`${name}_spike`, { diameterTop: 0.09, diameterBottom: 0, height: 0.22, tessellation: 4 }, scene)
        spike.position.set(x, 0.11, 0)
        bars.push(bar, spike)
    }
    for(let y = 0.42; y < h; y += 0.5){
        const bar = MeshBuilder.CreateBox(`${name}_h`, { width: w, height: 0.06, depth: 0.1 }, scene)
        bar.position.set(0, y, 0)
        bars.push(bar)
    }
    const grid = Mesh.MergeMeshes(bars, true, true)
    grid.name = name
    grid.material = mat
    return grid
}

// a fire bowl standing at base (in its frame); the flame is lit separately
function fireBowl(scene, name, base, mats){
    const bowl = MeshBuilder.CreateCylinder(`${name}`, { height: 0.32, diameterTop: 0.95, diameterBottom: 0.42, tessellation: 16 }, scene)
    bowl.material = mats.iron
    bowl.position.set(base.x, base.y + 0.16, base.z)
    const coals = MeshBuilder.CreateDisc(`${name}_coals`, { radius: 0.42, tessellation: 16 }, scene)
    coals.material = mats.coals
    coals.rotation.x = Math.PI / 2
    coals.position.set(base.x, base.y + 0.28, base.z)
    return [bowl, coals]
}

function gateSmoke(scene, at, inward){
    const smoke = new ParticleSystem("arena_gate_smoke", 60, scene)
    smoke.particleTexture = new Texture("./images/particles/smoke.webp", scene)
    smoke.blendMode = ParticleSystem.BLENDMODE_STANDARD
    smoke.emitter = at
    smoke.minEmitBox = new Vector3(-1.2, 0, -0.3)
    smoke.maxEmitBox = new Vector3(1.2, 0.4, 0.3)
    smoke.color1 = new Color4(0.35, 0.1, 0.06, 0.32)
    smoke.color2 = new Color4(0.18, 0.06, 0.05, 0.22)
    smoke.colorDead = new Color4(0.05, 0.03, 0.03, 0)
    smoke.minSize = 0.8
    smoke.maxSize = 1.8
    smoke.minLifeTime = 3
    smoke.maxLifeTime = 5
    smoke.emitRate = 7
    smoke.direction1 = inward.scale(0.25).add(new Vector3(-0.1, 0.12, -0.1))
    smoke.direction2 = inward.scale(0.45).add(new Vector3(0.1, 0.3, 0.1))
    smoke.minEmitPower = 0.4
    smoke.maxEmitPower = 0.8
    smoke.minAngularSpeed = -0.3
    smoke.maxAngularSpeed = 0.3
    smoke.start()
}

// a brazier's flame - createFireParticles' (which also brings the light),
// scaled up, with sparks
function bigFlame(scene, pos, fx){
    const flame = new ParticleSystem("arena_brazier_fire", 320, scene)
    flame.particleTexture = fx.fire
    flame.blendMode = ParticleSystem.BLENDMODE_ADD
    flame.emitter = pos.clone()
    flame.minEmitBox = new Vector3(-0.28, -0.2, -0.28)
    flame.maxEmitBox = new Vector3(0.28, -0.15, 0.28)
    flame.color1 = new Color4(1, 0.72, 0.25, 1)
    flame.color2 = new Color4(1, 0.32, 0.05, 1)
    flame.colorDead = new Color4(0.12, 0.02, 0, 0)
    flame.minSize = 0.3
    flame.maxSize = 0.8
    flame.minLifeTime = 0.35
    flame.maxLifeTime = 0.85
    flame.emitRate = 150
    flame.direction1 = new Vector3(-0.25, 1.2, -0.25)
    flame.direction2 = new Vector3(0.25, 2.2, 0.25)
    flame.minEmitPower = 0.5
    flame.maxEmitPower = 1.1
    flame.updateSpeed = 0.02
    flame.minAngularSpeed = -Math.PI / 4
    flame.maxAngularSpeed = Math.PI / 4
    flame.start()

    const sparks = new ParticleSystem("arena_brazier_sparks", 70, scene)
    sparks.particleTexture = fx.spark
    sparks.blendMode = ParticleSystem.BLENDMODE_ADD
    sparks.emitter = pos.clone()
    sparks.minEmitBox = new Vector3(-0.25, 0, -0.25)
    sparks.maxEmitBox = new Vector3(0.25, 0.2, 0.25)
    sparks.color1 = new Color4(1, 0.9, 0.55, 1)
    sparks.color2 = new Color4(1, 0.55, 0.15, 1)
    sparks.colorDead = new Color4(1, 0.3, 0, 0)
    sparks.minSize = 0.025
    sparks.maxSize = 0.06
    sparks.minLifeTime = 1
    sparks.maxLifeTime = 2.2
    sparks.emitRate = 14
    sparks.direction1 = new Vector3(-0.5, 1.6, -0.5)
    sparks.direction2 = new Vector3(0.5, 2.6, 0.5)
    sparks.minEmitPower = 0.8
    sparks.maxEmitPower = 1.6
    sparks.gravity = new Vector3(0, -0.25, 0)
    sparks.start()
}

const rotateY = (v, yaw) => Vector3.TransformNormal(v, Matrix.RotationY(yaw))

// Additive glows that need no light: a halo round every flame, and the warm
// wash a torch throws on its wall and the ground below it. lightBudget.js only
// has the 5 point lights nearest the player on, so without these the fires
// further round the ring would burn without lighting anything at all.
function fireGlows(scene){
    const additive = (name, stops) => {
        const mat = new StandardMaterial(name, scene)
        mat.emissiveTexture = radialTexture(`${name}_tex`, scene, stops)
        mat.diffuseColor = Color3.Black()
        mat.specularColor = Color3.Black()
        mat.disableLighting = true
        mat.fogEnabled = false   // fog would add its own colour where the glow is black
        mat.alphaMode = Constants.ALPHA_ADD
        mat.alpha = 0.999        // below 1 turns blending on; ALPHA_ADD then adds
        return mat
    }
    const master = (name, w, h, mat) => {
        const plane = MeshBuilder.CreatePlane(name, { width: w, height: h }, scene)
        plane.material = mat
        plane.isVisible = false
        plane.isPickable = false
        return plane
    }
    const halo = master("arena_flare", 1, 1, additive("arena_flare_mat", [[0, "#ffc46a"], [0.18, "#b8581a"], [0.5, "#260e03"], [1, "#000000"]]))
    const wash = master("arena_wash", 4.6, 4.2, additive("arena_wash_mat", [[0, "#8a4c18"], [0.4, "#3a1c08"], [1, "#000000"]]))
    const pool = master("arena_pool", 4.2, 2.6, additive("arena_pool_mat", [[0, "#5a3212"], [0.5, "#1c0e05"], [1, "#000000"]]))
    let n = 0
    return {
        flare(pos, size){
            const g = halo.createInstance(`arena_flare_${n++}`)
            g.position.copyFrom(pos)
            g.scaling.setAll(size)
            g.billboardMode = Mesh.BILLBOARDMODE_ALL
            g.isPickable = false
        },
        // m: a torch mount - the glow on the ground in front of it, and on a
        // flat wall (the tunnel's) the one on the wall too
        torch(m){
            const below = pool.createInstance(`arena_pool_${n++}`)
            below.position.set(m.pos.x + m.inward.x, 0.03, m.pos.z + m.inward.z)
            below.rotation.set(Math.PI / 2, m.yaw, 0)
            settle(below)
            if(m.theta !== undefined) return
            const onWall = wash.createInstance(`arena_wash_${n++}`)
            onWall.position.copyFrom(m.pos.add(m.inward.scale(0.05)))
            onWall.position.y += 0.15
            onWall.rotation.y = m.yaw
            settle(onWall)
        },
        // the podium wall's torches (mounts with a theta): one mesh, each
        // patch curved to the wall - a flat one that wide sinks into the
        // curve at its edges and shows as a stepped rectangle
        podiumWashes(mounts){
            const positions = [], normals = [], uvs = [], indices = []
            const W = 4.6, H = 4.2, SEGS = 8, r = R - 0.04
            const yc = TORCH_Y + 0.15
            // up to the cornice's underside, which hides the cut
            const y0 = 0.2, y1 = WALL_H
            const v0 = (y0 - (yc - H / 2)) / H, v1 = (y1 - (yc - H / 2)) / H
            mounts.forEach(m => {
                const base = positions.length / 3
                const half = W / 2 / r
                for(let s = 0; s <= SEGS; s++){
                    const a = m.theta - half + 2 * half * s / SEGS
                    const c = Math.cos(a), sn = Math.sin(a)
                    positions.push(r * c, y0, r * sn, r * c, y1, r * sn)
                    normals.push(-c, 0, -sn, -c, 0, -sn)
                    uvs.push(s / SEGS, v0, s / SEGS, v1)
                }
                for(let s = 0; s < SEGS; s++){
                    const i = base + s * 2
                    indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2)
                }
            })
            const mesh = new Mesh("arena_podium_washes", scene)
            const data = new VertexData()
            data.positions = positions
            data.normals = normals
            data.uvs = uvs
            data.indices = indices
            data.applyToMesh(mesh)
            mesh.material = wash.material
            settle(mesh)
        },
    }
}

// ── Stands' details ───────────────────────────────────────────────────────────

// doorways into the stands, in the wall between the tiers - every 30°, clear
// of the gates; the crowd's aisles run down from them
const DOORWAY_ANGLES = Array.from({ length: 12 }, (_, k) => (15 + k * 30) * Math.PI / 180)
    .filter(a => angleDist(a, NORTH) > 0.35 && angleDist(a, SOUTH) > 0.35)

function vomitoria(scene, profile, mats){
    const { r, y } = profile.midWallBase
    const opening = MeshBuilder.CreatePlane("arena_doorway", { width: 1.15, height: 1.45 }, scene)
    opening.material = mats.void
    opening.isVisible = false
    const jamb = block("arena_doorway_jamb", 0.18, 1.55, 0.22, mats.trim, scene, TRIM_TILE)
    jamb.isVisible = false
    const lintel = block("arena_doorway_lintel", 1.6, 0.2, 0.24, mats.trim, scene, TRIM_TILE)
    lintel.isVisible = false
    DOORWAY_ANGLES.forEach((a, i) => {
        const node = wallFrame(`arena_doorway_${i}`, a, r, y, scene)
        const hole = opening.createInstance(`arena_doorway_${i}_hole`)
        hole.position.set(0, 0.725, -0.01)
        const left = jamb.createInstance(`arena_doorway_${i}_l`)
        left.position.set(-0.67, 0.775, -0.06)
        const right = jamb.createInstance(`arena_doorway_${i}_r`)
        right.position.set(0.67, 0.775, -0.06)
        const top = lintel.createInstance(`arena_doorway_${i}_t`)
        top.position.set(0, 1.62, -0.07)
        parentAll(node, [hole, left, right, top])
    })
}

// The colonnade along the top. An overgrown theme's is a ruin: some columns
// gone, others broken off with their fallen drums beside them, none where a
// rim tree stands, no entablature or pennants left - just the fire bowls.
function colonnade(scene, profile, mats, fires, theme, rimTrees){
    const { top } = profile
    const colR = top.r - 0.7
    const TAU = 2 * Math.PI
    const ruined = theme.overgrown
    const rng = seededRandom(7)   // its own, so the ruin's the same every visit
    const byTree = a => rimTrees.some(t => angleDist(a, t.theta) < 0.09)

    const columnMat = mats.trim.clone("arena_column")
    columnMat.diffuseTexture = mats.trim.diffuseTexture.clone()
    columnMat.diffuseTexture.uScale = Math.PI * 0.7 / TRIM_TILE
    columnMat.diffuseTexture.vScale = COLUMN_H / TRIM_TILE
    const column = MeshBuilder.CreateCylinder("arena_column", { diameter: 0.7, height: COLUMN_H, tessellation: 12 }, scene)
    column.material = columnMat
    column.isVisible = false
    const base = block("arena_column_base", 0.95, 0.3, 0.95, mats.trim, scene, TRIM_TILE)
    base.isVisible = false
    const capital = block("arena_column_capital", 1.0, 0.35, 1.0, mats.trim, scene, TRIM_TILE)
    capital.isVisible = false
    const drum = MeshBuilder.CreateCylinder("arena_column_drum", { diameter: 0.7, height: 1.1, tessellation: 12 }, scene)
    drum.material = columnMat
    drum.isVisible = false
    const place = (master, name, x, y, z, rotation, scaleY = 1) => {
        const inst = master.createInstance(name)
        inst.position.set(x, y, z)
        inst.rotation.copyFrom(rotation)
        inst.scaling.y = scaleY
        settle(inst)
    }
    for(let i = 0; i < COLUMNS; i++){
        const a = (i + 0.5) / COLUMNS * TAU
        if(ruined && (byTree(a) || rng() < 0.3)) continue
        const x = colR * Math.cos(a), z = colR * Math.sin(a)
        const facing = new Vector3(0, Math.PI / 2 - a, 0)
        // standing whole, or broken off somewhere up the shaft
        const h = !ruined || rng() < 0.3 ? COLUMN_H : 0.8 + rng() * 3.4
        place(column, `arena_colonnade_${i}`, x, top.y + h / 2, z, facing, h / COLUMN_H)
        place(base, `arena_colonnade_${i}_base`, x, top.y + 0.15, z, facing)
        if(h === COLUMN_H) place(capital, `arena_colonnade_${i}_capital`, x, top.y + COLUMN_H - 0.175, z, facing)
        else if(rng() < 0.45){
            // what broke off, lying on the platform in front of it
            const da = a + (rng() - 0.5) * 0.04, dr = colR - 0.9 - rng() * 0.3
            place(drum, `arena_colonnade_${i}_drum`, dr * Math.cos(da), top.y + 0.35, dr * Math.sin(da), new Vector3(0, rng() * Math.PI, Math.PI / 2))
        }
    }
    if(ruined){
        for(let k = 0; k < 8; k++){
            const fa = (k + 0.5) / 8 * TAU
            if(byTree(fa)) continue
            const bowlAt = new Vector3((colR - 0.6) * Math.cos(fa), top.y, (colR - 0.6) * Math.sin(fa))
            fireBowl(scene, `arena_top_bowl_${k}`, bowlAt, mats).forEach(settle)
            fires.push({ pos: bowlAt.add(new Vector3(0, FLAME_ABOVE_BOWL, 0)), big: true, light: false })
        }
        return
    }
    // the entablature on top
    const y0 = top.y + COLUMN_H, y1 = y0 + 0.7
    const r0 = colR - 0.65, r1 = colR + 0.75
    sweep("arena_entablature", [
        [r0, y0, r0, y1],       // inner face
        [r0, y1, r1, y1],       // top
        [r1, y1, r1, y0],       // outer face
        [r1, y0, r0, y0],       // underside
    ], 0, TAU, TRIM_TILE, mats.trim, scene)

    // masts with pennants all streaming the same way, and fires between
    // every other pair - no light of their own, far above everyone
    const pennants = []
    const MASTS = 16
    for(let i = 0; i < MASTS; i++){
        const a = i / MASTS * TAU
        const x = colR * Math.cos(a), z = colR * Math.sin(a)
        const mast = MeshBuilder.CreateCylinder(`arena_mast_${i}`, { diameter: 0.09, height: 4.2, tessellation: 6 }, scene)
        mast.material = mats.iron
        mast.position.set(x, y1 + 2.1, z)
        settle(mast)
        const pennant = new Mesh(`arena_pennant_${i}`, scene)
        const data = new VertexData()
        data.positions = [0, 0, 0, 0, -0.9, 0, 2.3, -0.45, 0]
        data.indices = [0, 1, 2]
        data.normals = [0, 0, -1, 0, 0, -1, 0, 0, -1]
        data.applyToMesh(pennant)
        pennant.material = mats.pennant
        pennant.position.set(x, y1 + 4.15, z)
        pennant.isPickable = false
        pennants.push({ mesh: pennant, phase: Math.random() * TAU })
        if(i % 2) continue
        // halfway to the next mast
        const fa = a + Math.PI / MASTS
        const bowlAt = new Vector3(colR * Math.cos(fa), y1, colR * Math.sin(fa))
        fireBowl(scene, `arena_top_bowl_${i}`, bowlAt, mats).forEach(settle)
        fires.push({ pos: bowlAt.add(new Vector3(0, FLAME_ABOVE_BOWL, 0)), big: true, light: false })
    }
    // wind from the east - every pennant streams west, each fluttering on its own
    let t = 0
    scene.onBeforeRenderObservable.add(() => {
        t += scene.getEngine().getDeltaTime() / 1000
        pennants.forEach(({ mesh, phase }) => {
            mesh.rotation.y = Math.PI + Math.sin(t * 2.1 + phase) * 0.28
            mesh.rotation.x = Math.sin(t * 3.3 + phase * 1.7) * 0.12
        })
    })
}

// banners hung from the cornice between the torches, and the torches' mounts.
// An overgrown theme hangs every other banner's place with roots and leaves
// instead - returns those places' angles (overgrowth)
function wallBanners(scene, mats, torchMounts, theme){
    const banner = MeshBuilder.CreatePlane("arena_wall_banner", { width: 1.0, height: 2.3 }, scene)
    banner.material = mats.banner
    banner.isVisible = false
    const ledges = []
    for(let k = 0; k < 24; k++){
        const torchA = k * Math.PI / 12
        if(angleDist(torchA, NORTH) > 0.2 && angleDist(torchA, SOUTH) > 0.2){
            const node = wallFrame(`arena_torch_${k}`, torchA, R, 0, scene)
            torchMounts.push({ pos: atLocal(node, 0, TORCH_Y, 0), yaw: node.rotation.y, inward: inwardAt(torchA), theta: torchA })
            node.dispose()
        }
        const bannerA = torchA + Math.PI / 24
        if(angleDist(bannerA, NORTH) < 0.28 || angleDist(bannerA, SOUTH) < 0.28) continue
        if(theme.overgrown && k % 2){
            ledges.push(bannerA)
            continue
        }
        const node = wallFrame(`arena_banner_${k}`, bannerA, R, 0, scene)
        const inst = banner.createInstance(`arena_banner_${k}_cloth`)
        inst.position.set(0, WALL_H - 0.05 - 1.15, -0.03)
        parentAll(node, [inst])
    }
    return ledges
}

async function placeTorchModels(scene, mounts){
    let master
    try {
        master = await mergeAndLoadModel(TORCH_GLB, scene)
    } catch (error) {
        return console.warn("[duel arena] wall torch failed to load", error)
    }
    if(!master || scene.isDisposed) return
    master.isVisible = false
    master.isPickable = false
    mounts.forEach((m, i) => {
        const torch = master.createInstance(`arena_torch_model_${i}`)
        torch.position.copyFrom(m.pos)
        torch.rotation.y = m.yaw
        settle(torch)
    })
}

// ── Sand ──────────────────────────────────────────────────────────────────────
// the medallion at the centre, wear darkening toward the wall, old blood
function sandDetails(scene, mats, theme){
    const decal = (name, tex, alpha) => {
        const m = new StandardMaterial(name, scene)
        m.diffuseTexture = tex
        m.diffuseTexture.hasAlpha = true
        m.useAlphaFromDiffuseTexture = true
        m.alpha = alpha
        m.specularColor = Color3.Black()
        m.zOffset = -2
        m.maxSimultaneousLights = MAX_LIGHTS
        return m
    }

    const ring = MeshBuilder.CreateDisc("arena_wear", { radius: R + 0.05, tessellation: 96 }, scene)
    ring.material = decal("arena_wear_mat", theme.ground === "moss" ? mossOverlayTexture(scene) : sandOverlayTexture(scene), 1)
    ring.rotation.x = Math.PI / 2
    ring.position.y = 0.006
    settle(ring)

    const medallionMat = new StandardMaterial("arena_medallion_mat", scene)
    medallionMat.diffuseTexture = new Texture("./images/modeltex/decor1.jpg", scene)
    medallionMat.diffuseColor = new Color3(...theme.medallion.tint)
    medallionMat.alpha = theme.medallion.alpha   // sand (or moss) over it
    medallionMat.specularColor = Color3.Black()
    medallionMat.zOffset = -3
    medallionMat.maxSimultaneousLights = MAX_LIGHTS
    const medallion = MeshBuilder.CreateDisc("arena_medallion", { radius: 4.2, tessellation: 72 }, scene)
    medallion.material = medallionMat
    medallion.rotation.x = Math.PI / 2
    medallion.position.y = 0.012
    settle(medallion)
    const rim = MeshBuilder.CreateTorus("arena_medallion_rim", { diameter: 8.55, thickness: 0.22, tessellation: 72 }, scene)
    rim.material = mats.trim
    rim.scaling.y = 0.12
    rim.position.y = 0.0
    settle(rim)

    const bloodMat = decal("arena_blood_mat", new Texture("./images/particles/blood.webp", scene), 0.8)
    bloodMat.diffuseColor = new Color3(0.42, 0.05, 0.03)
    const stains = [[7.5, -6, 1.9], [-9, 4, 1.4], [3.5, 9.5, 2.3], [-5.5, -11, 1.2], [13, 7, 1.6], [-14, -3, 1.1]]
    stains.forEach(([x, z, size], i) => {
        const stain = MeshBuilder.CreateGround(`arena_blood_${i}`, { width: size, height: size }, scene)
        stain.material = bloodMat
        stain.position.set(x, 0.009, z)
        stain.rotation.y = i * 1.7
        settle(stain)
    })
}

// Over the whole sand: trampled patches and raked arcs that break up the sand
// texture's repeat, and wear darkening toward the wall. The disc maps the
// canvas's inscribed circle, so its centre is the arena's.
function sandOverlayTexture(scene){
    const S = 1024, c = S / 2
    const tex = new DynamicTexture("arena_sand_overlay_tex", { width: S, height: S }, scene, true)
    const ctx = tex.getContext()
    ctx.clearRect(0, 0, S, S)
    for(let i = 0; i < 150; i++){
        const r = 20 + Math.random() * 95
        const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * c * 0.92
        const x = c + Math.cos(a) * d, y = c + Math.sin(a) * d
        const dark = Math.random() < 0.6
        const color = dark ? "40, 24, 12" : "255, 225, 180"
        const g = ctx.createRadialGradient(x, y, 0, x, y, r)
        g.addColorStop(0, `rgba(${color}, ${dark ? 0.22 : 0.08})`)
        g.addColorStop(1, `rgba(${color}, 0)`)
        ctx.fillStyle = g
        ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
    for(let k = 0; k < 24; k++){
        const start = Math.random() * Math.PI * 2
        ctx.strokeStyle = `rgba(${Math.random() < 0.5 ? "30, 18, 8" : "255, 230, 190"}, ${0.04 + Math.random() * 0.05})`
        ctx.lineWidth = 1.5 + Math.random() * 2.5
        ctx.beginPath()
        ctx.arc(c, c, c * (0.2 + Math.random() * 0.72), start, start + Math.PI * (0.6 + Math.random()))
        ctx.stroke()
    }
    const wear = ctx.createRadialGradient(c, c, c * 0.6, c, c, c)
    wear.addColorStop(0, "rgba(30, 18, 9, 0)")
    wear.addColorStop(0.85, "rgba(30, 18, 9, 0.42)")
    wear.addColorStop(1, "rgba(20, 12, 6, 0.7)")
    ctx.fillStyle = wear
    ctx.fillRect(0, 0, S, S)
    tex.update()
    return tex
}

// ── Overgrowth (overgrown themes) ─────────────────────────────────────────────

// What roots crawl over (createRoots.js's growRoots): the stands'
// cross-section (caveaProfile's rootPath) swept round the ring. u - metres
// along the cross-section from the centre of the sand; v - metres round the
// ring at the podium wall. Off it (null) close to either gate, and toward the
// middle of the sand, which stays clear for the fight.
const ROOT_FLOOR_KEEP = 13
const ROOT_GATE_KEEP  = 0.2
function rootSurface(path){
    const segs = []
    let total = 0
    for(let k = 0; k < path.length - 1; k++){
        const [r0, y0] = path[k], [r1, y1] = path[k + 1]
        const len = Math.hypot(r1 - r0, y1 - y0)
        segs.push({ s0: total, len, r0, y0, r1, y1, nr: -(y1 - y0) / len, ny: (r1 - r0) / len })
        total += len
    }
    const surface = (u, v) => {
        if(u < 0 || u > total) return null
        const theta = v / R
        if(angleDist(theta, NORTH) < ROOT_GATE_KEEP || angleDist(theta, SOUTH) < ROOT_GATE_KEEP) return null
        const seg = segs.find(g => u <= g.s0 + g.len) ?? segs[segs.length - 1]
        const t = (u - seg.s0) / seg.len
        const r = seg.r0 + (seg.r1 - seg.r0) * t
        if(r < ROOT_FLOOR_KEEP) return null
        const y = seg.y0 + (seg.y1 - seg.y0) * t
        const c = Math.cos(theta), sn = Math.sin(theta)
        return {
            pos: new Vector3(r * c, y, r * sn),
            normal: new Vector3(seg.nr * c, seg.ny, seg.nr * sn),
            across: Math.max(r, 1) / R,
        }
    }
    // u where the cross-section reaches radius r on a level stretch at height y
    const uAt = (r, y) => {
        const seg = segs.find(g => g.y0 === y && g.y1 === y && r >= Math.min(g.r0, g.r1) && r <= Math.max(g.r0, g.r1))
        return seg ? seg.s0 + Math.abs(r - seg.r0) : null
    }
    return { surface, uAt }
}

// Roots from the rim trees: two or three thick ones pouring down the seats,
// over the parapet and down the podium wall onto the floor, two more running
// along the top of the stands - plus thinner ones breaking out from under
// the wall. Returns { points, near(x, y, z) } - near: true over a root.
function forestRoots(scene, profile, mats, rimTrees, rng){
    const { surface, uAt } = rootSurface(profile.rootPath)
    const treeU = uAt(profile.top.r - 0.9, profile.top.y)
    const seeds = []
    rimTrees.forEach(tree => {
        const v = tree.theta * R
        const pours = 2 + (rng() < 0.5 ? 1 : 0)
        for(let k = 0; k < pours; k++){
            const reach = R - 2 - rng() * 5   // how far out onto the floor it gets
            seeds.push({
                u: treeU, v: v + (k - (pours - 1) / 2) * 0.9,
                heading: Math.PI + (rng() - 0.5) * 0.5,
                length: treeU - reach + 1.5,
                radius: 0.5 + rng() * 0.2,
                pull: 0.55, wander: 0.45, branching: 0.16, taper: 0.6,   // still thick going over the wall
            })
        }
        for(const side of [-1, 1]){
            seeds.push({
                u: treeU, v,
                heading: side * (Math.PI / 2 + 0.2 + rng() * 0.3),   // along the rim, drifting down
                length: 5 + rng() * 6,
                radius: 0.24 + rng() * 0.1,
                pull: 0.3, wander: 0.55, branching: 0.2,
            })
        }
    })
    const footU = uAt(R, 0)
    for(let k = 0; k < 18; k++){
        const theta = rng() * Math.PI * 2
        if(angleDist(theta, NORTH) < 0.3 || angleDist(theta, SOUTH) < 0.3) continue
        seeds.push({
            u: footU + 0.5, v: theta * R,   // from a little way up the wall, out across the floor
            heading: Math.PI + (rng() - 0.5) * 0.8,
            length: 3 + rng() * 5,
            radius: 0.2 + rng() * 0.18,
            pull: 0.25, wander: 0.6, branching: 0.25, taper: 0.7,
        })
    }
    const { points } = growRoots(scene, "arena_roots", { surface, seeds, material: mats.bark, seed: Math.floor(rng() * 1e9) })

    // the points on a 1 m grid, for near()
    const grid = new Map()
    points.forEach(p => {
        const key = `${Math.floor(p.pos.x)},${Math.floor(p.pos.z)}`
        if(!grid.has(key)) grid.set(key, [])
        grid.get(key).push(p)
    })
    const near = (x, y, z, margin = 0.35) => {
        const cx = Math.floor(x), cz = Math.floor(z)
        for(let dx = -1; dx <= 1; dx++){
            for(let dz = -1; dz <= 1; dz++){
                const cell = grid.get(`${cx + dx},${cz + dz}`)
                if(cell?.some(p => Math.abs(p.pos.y - y) < 1.2 && Math.hypot(p.pos.x - x, p.pos.z - z) < p.radius + margin)) return true
            }
        }
        return false
    }
    return { points, near }
}

// The rest of an overgrown arena: aerial roots and a fall of leaves off the
// cornice where banners would hang (ledges), grass, bushes and flowers (along
// the wall's foot, round the roots on the floor, on some empty seats),
// fireflies, and a forest all round the outside with its crowns over the rim.
function overgrowth(scene, mats, fx, { roots, ledges, seatPlants, rng }){
    const anchors = []
    ledges.forEach(a => {
        const count = 4 + Math.floor(rng() * 5)
        for(let k = 0; k < count; k++){
            const t = a + (rng() - 0.5) * 1.3 / R
            anchors.push({
                pos: new Vector3((R - 0.27) * Math.cos(t), PODIUM_Y - 0.02, (R - 0.27) * Math.sin(t)),
                out: inwardAt(t),
                length: 1.1 + rng() * 2.2,
                radius: 0.025 + rng() * 0.035,
            })
        }
    })
    hangRoots(scene, "arena_hanging_roots", { anchors, material: mats.bark, seed: Math.floor(rng() * 1e9) })

    const leafMat = new StandardMaterial("arena_leaves_mat", scene)
    leafMat.diffuseTexture = new Texture("./images/modeltex/treeleaves.png", scene)
    leafMat.diffuseTexture.hasAlpha = true
    leafMat.diffuseColor = new Color3(0.85, 0.95, 0.8)
    leafMat.specularColor = Color3.Black()
    leafMat.backFaceCulling = false
    leafMat.maxSimultaneousLights = MAX_LIGHTS
    const leaves = MeshBuilder.CreatePlane("arena_leaves", { width: 1.8, height: 2.6 }, scene)
    leaves.material = leafMat
    leaves.isVisible = false
    ledges.forEach((a, i) => {
        if(rng() < 0.25) return
        const node = wallFrame(`arena_leaves_${i}`, a, R, 0, scene)
        const fall = leaves.createInstance(`arena_leaves_${i}_fall`)
        const size = 0.8 + rng() * 0.45
        fall.scaling.setAll(size)
        fall.position.set((rng() - 0.5) * 0.6, PODIUM_Y + 0.15 - 1.3 * size, -0.33)
        parentAll(node, [fall])
    })

    // plants - two crossed planes each, the village's own grass textures
    // (black reads as clear), lit like everything else
    const plant = (name, file, w, h) => {
        const tex = new Texture(`./images/textures/grass/${file}`, scene)
        tex.getAlphaFromRGB = true
        const mat = new StandardMaterial(`${name}_mat`, scene)
        mat.diffuseTexture = tex
        mat.opacityTexture = tex
        mat.transparencyMode = Material.MATERIAL_ALPHATEST
        mat.alphaCutOff = 0.3
        mat.backFaceCulling = false
        mat.specularColor = Color3.Black()
        mat.maxSimultaneousLights = MAX_LIGHTS
        const a = MeshBuilder.CreatePlane(`${name}_a`, { width: w, height: h }, scene)
        const b = MeshBuilder.CreatePlane(`${name}_b`, { width: w, height: h }, scene)
        b.rotation.y = Math.PI / 2
        const mesh = Mesh.MergeMeshes([a, b], true)
        mesh.bakeTransformIntoVertices(Matrix.Translation(0, h / 2, 0))
        mesh.name = name
        mesh.material = mat
        mesh.isVisible = false
        mesh.isPickable = false
        return mesh
    }
    const grass = plant("arena_grass", "grass_black.jpg", 0.9, 0.8)
    const grass2 = plant("arena_grass2", "grass2_black.jpg", 0.9, 0.9)
    const bush = plant("arena_bush", "bush1.jpg", 1.1, 1)
    const flower = plant("arena_flower", "flower1.jpg", 0.5, 0.45)
    const pickPlant = () => {
        const p = rng()
        return p < 0.5 ? grass : p < 0.75 ? grass2 : p < 0.93 ? bush : flower
    }
    let n = 0
    const put = (master, x, y, z, size) => {
        const inst = master.createInstance(`arena_plant_${n++}`)
        inst.position.set(x, y, z)
        inst.rotation.y = rng() * Math.PI
        inst.scaling.setAll(size)
        settle(inst)
    }
    // thick along the foot of the wall
    for(let a = 0; a < Math.PI * 2; a += 0.6 / R){
        if(angleDist(a, NORTH) < 0.2 || angleDist(a, SOUTH) < 0.2 || rng() < 0.2) continue
        const r = R - 0.2 - rng() * 1.4
        put(pickPlant(), r * Math.cos(a), 0, r * Math.sin(a), 0.8 + rng() * 0.7)
    }
    roots.points.forEach(p => {
        if(p.pos.y > 0.4 || rng() > 0.06) return
        put(pickPlant(), p.pos.x + (rng() - 0.5) * 1.4, 0, p.pos.z + (rng() - 0.5) * 1.4, 0.5 + rng() * 0.6)
    })
    for(let k = 0; k < 70; k++){
        const a = rng() * Math.PI * 2, r = 15 + rng() * 8
        put(rng() < 0.3 ? flower : grass, r * Math.cos(a), 0, r * Math.sin(a), 0.45 + rng() * 0.5)
    }
    seatPlants.forEach(p => put(bush, p.x, p.y, p.z, 0.6 + rng() * 0.4))

    // fireflies - drifting on a noise field, each blinking on and off
    const flies = new ParticleSystem("arena_fireflies", 360, scene)
    flies.particleTexture = fx.spark
    flies.blendMode = ParticleSystem.BLENDMODE_ADD
    flies.emitter = new Vector3(0, 2.4, 0)
    flies.minEmitBox = new Vector3(-24, -1.9, -24)
    flies.maxEmitBox = new Vector3(24, 4, 24)
    flies.minSize = 0.08
    flies.maxSize = 0.16
    flies.minLifeTime = 4
    flies.maxLifeTime = 8
    flies.emitRate = 50
    flies.direction1 = new Vector3(-0.3, -0.12, -0.3)
    flies.direction2 = new Vector3(0.3, 0.2, 0.3)
    flies.minEmitPower = 0.08
    flies.maxEmitPower = 0.3
    flies.addColorGradient(0, new Color4(0.7, 1, 0.3, 0))
    flies.addColorGradient(0.12, new Color4(0.8, 1, 0.35, 1))
    flies.addColorGradient(0.45, new Color4(0.45, 0.7, 0.15, 0.25))
    flies.addColorGradient(0.7, new Color4(0.85, 1, 0.4, 1))
    flies.addColorGradient(1, new Color4(0.6, 0.9, 0.3, 0))
    flies.noiseTexture = new NoiseProceduralTexture("arena_firefly_noise", 64, scene)
    flies.noiseStrength = new Vector3(0.6, 0.35, 0.6)
    flies.start()

    // the forest outside - only the crowns ever show, over the rim
    const farMat = new StandardMaterial("arena_far_trees_mat", scene)
    farMat.diffuseTexture = new Texture("./images/fakeprops/faketree.webp", scene)
    farMat.diffuseTexture.hasAlpha = true
    farMat.diffuseColor = new Color3(0.4, 0.5, 0.42)
    farMat.specularColor = Color3.Black()
    farMat.backFaceCulling = false
    const farTree = MeshBuilder.CreatePlane("arena_far_tree", { size: 1 }, scene)
    farTree.material = farMat
    farTree.isVisible = false
    for(let k = 0; k < 90; k++){
        const a = (k + rng()) / 90 * Math.PI * 2
        const r = 50 + rng() * 30
        const h = 20 + rng() * 16
        const inst = farTree.createInstance(`arena_far_tree_${k}`)
        inst.scaling.set(h * 0.95, h, 1)
        inst.position.set(r * Math.cos(a), h / 2 - 0.5, r * Math.sin(a))
        inst.billboardMode = Mesh.BILLBOARDMODE_Y
        inst.isPickable = false
    }
}

// the giant trees on an overgrown arena's rim, scaled-up tree models, each
// trunk where forestRoots started that tree's roots
async function placeRimTrees(scene, profile, rimTrees){
    if(!rimTrees.length) return
    const masters = new Map()
    await Promise.all([...new Set(rimTrees.map(t => t.model))].map(async model => {
        try {
            const mesh = await mergeAndLoadModel(model.path, scene)
            if(!mesh) return
            mesh.isVisible = false
            mesh.isPickable = false
            masters.set(model, mesh)
        } catch (error) {
            console.warn(`[duel arena] tree model failed to load: ${model.path}`, error)
        }
    }))
    if(scene.isDisposed) return
    const r = profile.top.r - 0.9
    rimTrees.forEach((tree, i) => {
        const master = masters.get(tree.model)
        if(!master) return
        const inst = master.createInstance(`arena_rim_tree_${i}`)
        inst.position.set(r * Math.cos(tree.theta), profile.top.y - 0.15 + tree.model.lift * tree.scale, r * Math.sin(tree.theta))
        inst.rotation.y = tree.yaw
        inst.scaling.setAll(tree.scale)
        settle(inst)
    })
}

// the overgrown arena's floor: moss and dark earth, fallen leaves, and the
// same wear toward the wall as the sand
function mossOverlayTexture(scene){
    const S = 1024, c = S / 2
    const tex = new DynamicTexture("arena_moss_overlay_tex", { width: S, height: S }, scene, true)
    const ctx = tex.getContext()
    ctx.clearRect(0, 0, S, S)
    const patches = [["55, 85, 28", 0.24], ["24, 17, 9", 0.26], ["80, 70, 30", 0.16]]
    for(let i = 0; i < 220; i++){
        const r = 15 + Math.random() * 70
        const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * c * 0.95
        const x = c + Math.cos(a) * d, y = c + Math.sin(a) * d
        const [color, alpha] = patches[Math.floor(Math.random() * patches.length)]
        const g = ctx.createRadialGradient(x, y, 0, x, y, r)
        g.addColorStop(0, `rgba(${color}, ${alpha})`)
        g.addColorStop(1, `rgba(${color}, 0)`)
        ctx.fillStyle = g
        ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
    // fallen leaves, thicker toward the wall
    const leaves = ["110, 70, 28", "140, 95, 35", "90, 52, 22", "120, 110, 40"]
    for(let i = 0; i < 2600; i++){
        const a = Math.random() * Math.PI * 2, d = Math.pow(Math.random(), 0.45) * c * 0.98
        ctx.fillStyle = `rgba(${leaves[i % leaves.length]}, ${0.35 + Math.random() * 0.4})`
        ctx.beginPath()
        ctx.ellipse(c + Math.cos(a) * d, c + Math.sin(a) * d, 1.5 + Math.random() * 2.5, 0.8 + Math.random(), Math.random() * Math.PI, 0, Math.PI * 2)
        ctx.fill()
    }
    const wear = ctx.createRadialGradient(c, c, c * 0.6, c, c, c)
    wear.addColorStop(0, "rgba(20, 16, 8, 0)")
    wear.addColorStop(0.85, "rgba(20, 16, 8, 0.4)")
    wear.addColorStop(1, "rgba(14, 10, 5, 0.7)")
    ctx.fillStyle = wear
    ctx.fillRect(0, 0, S, S)
    tex.update()
    return tex
}

// ── Crowd ─────────────────────────────────────────────────────────────────────
// thin instances - every spectator is one matrix (and one colour) in two
// meshes, body and head, so the whole crowd is two draw calls. cheerArenaCrowd
// makes them hop by moving those matrices' y.
const TUNICS = ["#7b2b22", "#8d6a3c", "#5e4935", "#bcae92", "#3e4e66", "#5c6236", "#6b3858", "#9b8f78", "#a54a2a", "#2f3b2b", "#d8cfbd"]
const SKIN = ["#c79a74", "#a8744f", "#7d5236", "#e0b48d", "#5b3b27"]

// emptySeats - the share of seats left empty; avoid(x, y, z) - true where
// nobody can sit (over a root); onEmptySeat(x, y, z) - each seat left empty
function buildCrowd(scene, profile, emptySeats, avoid, onEmptySeat){
    const spots = []
    const pulvinarGap = Math.asin(4.4 / (R + 1.6))
    profile.rows.forEach((row, ri) => {
        const step = SEAT_SPACING / row.r
        for(let a = 0; a < 2 * Math.PI; a += step){
            if(DOORWAY_ANGLES.some(d => angleDist(a, d) * row.r < AISLE_HALF)) continue
            if(ri < 2 && angleDist(a, NORTH) < pulvinarGap) continue
            const seatX = row.r * Math.cos(a), seatZ = row.r * Math.sin(a)
            if(avoid?.(seatX, row.y, seatZ)) continue
            if(Math.random() < emptySeats){
                onEmptySeat?.(seatX, row.y, seatZ)
                continue
            }
            const aj = a + (Math.random() - 0.5) * step * 0.35
            const rj = row.r + (Math.random() - 0.5) * 0.12
            spots.push([rj * Math.cos(aj), row.y, rj * Math.sin(aj), 0.9 + Math.random() * 0.22])
        }
    })
    const n = spots.length
    const matrices = new Float32Array(n * 16)
    const bodyColors = new Float32Array(n * 4)
    const headColors = new Float32Array(n * 4)
    const baseY = new Float32Array(n)
    const pick = list => Color3.FromHexString(list[Math.floor(Math.random() * list.length)])
    spots.forEach(([x, y, z, s], i) => {
        matrices.set([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, x, y, z, 1], i * 16)
        baseY[i] = y
        const tunic = pick(TUNICS).scale(0.88 + Math.random() * 0.24)
        bodyColors.set([tunic.r, tunic.g, tunic.b, 1], i * 4)
        const skin = pick(SKIN).scale(0.92 + Math.random() * 0.16)
        headColors.set([skin.r, skin.g, skin.b, 1], i * 4)
    })

    const mat = new StandardMaterial("arena_crowd_mat", scene)
    mat.specularColor = Color3.Black()
    mat.emissiveColor = new Color3(0.05, 0.045, 0.045)   // a little lift, so the far stands don't sink into the dark
    mat.maxSimultaneousLights = MAX_LIGHTS
    const body = MeshBuilder.CreateCylinder("arena_crowd_body", { height: 0.5, diameterTop: 0.24, diameterBottom: 0.38, tessellation: 6 }, scene)
    body.bakeTransformIntoVertices(Matrix.Translation(0, 0.25, 0))
    const head = MeshBuilder.CreateSphere("arena_crowd_head", { diameter: 0.21, segments: 3 }, scene)
    head.bakeTransformIntoVertices(Matrix.Translation(0, 0.6, 0))
    ;[[body, bodyColors], [head, headColors]].forEach(([mesh, colors]) => {
        mesh.material = mat
        mesh.isPickable = false
        mesh.thinInstanceSetBuffer("matrix", matrices, 16, false)
        mesh.thinInstanceSetBuffer("color", colors, 4, true)
        mesh.thinInstanceRefreshBoundingInfo(false)
    })

    crowd = {
        scene, n, matrices, baseY,
        meshes: [body, head],
        hopStart: new Float64Array(n),
        hopEnd: new Float64Array(n),
        hopHeight: new Float32Array(n),
        active: [],
    }
    scene.onDisposeObservable.addOnce(() => { if(crowd?.scene === scene) crowd = null })

    // hops, plus a few restless spectators at any time
    let restless = 0
    scene.onBeforeRenderObservable.add(() => {
        const now = performance.now()
        restless += scene.getEngine().getDeltaTime()
        if(restless > 700){
            restless = 0
            cheerArenaCrowd(0.004, HOP_MS)
        }
        if(!crowd?.active.length) return
        let kept = 0
        for(const i of crowd.active){
            let y = baseY[i]
            if(now < crowd.hopEnd[i]){
                if(now > crowd.hopStart[i]) y += crowd.hopHeight[i] * Math.abs(Math.sin(Math.PI * (now - crowd.hopStart[i]) / HOP_MS))
                crowd.active[kept++] = i
            }
            matrices[i * 16 + 13] = y
        }
        crowd.active.length = kept
        body.thinInstanceBufferUpdated("matrix")
        head.thinInstanceBufferUpdated("matrix")
    })
}
