import { MeshBuilder, Mesh, StandardMaterial, Texture, Color3, Vector4, SceneLoader } from "@babylonjs/core"
import { sampleTerrainSurfaceHeight } from "infterrain"
import { createAggregate } from "../tools/physics.js"
import { mergeAndLoadModel } from "../tools/loadmodel.js"
import { OPENWORLD_TERRAIN_VERTS } from "../constants/constants.js"

// A fenced graveyard plot - localroomdb.js's per-place graveYards entries:
//   { position: {x, y, z}, areaSize, entrance?: "north" | "south" | "east" | "west",
//     density?: 0..1, seed?: number }
// areaSize is the full side length of the square plot, centered on position.
// density is the share of grave slots that get a stone (default: every slot
// on a small plot, GRAVE_DEFAULT_DENSITY on a big one); seed reshuffles
// which ones (default: derived from position).
//
// Same layout idea as createcastle.js: three solid sides, the entrance side
// split into two runs around a centered gap, a post at every corner plus one
// on each side of the gap. Posts are fencepillar.glb instances; the fence
// between them is a flat alpha-tested plane textured with fence.webp.
//
// The fence is built out of panel instances, not one long plane with a tiled
// texture. fence.webp isn't seamless edge-to-edge (its first and last pickets
// sit ~100px apart across the wrap instead of the ~175px they sit apart
// everywhere else), so every panel starts and ends on a picket's center.
// Two panels side by side then join two half-pickets into one whole picket,
// and any panel can sit next to any other without a visible joint.
//
// Each run is sized in picket gaps rather than whole panels: a whole number
// of gaps at close to the texture's own spacing, laid down as full 9-gap
// panels plus one shorter panel for whatever's left. Rounding to whole panels
// instead stretched the 3.5-long runs beside the entrance to one 3.5 panel
// while the 10-long sides got four 2.5 panels - pickets ~40% further apart
// right where the two meet at a corner.
//
// Inside: gravestones on both sides of an aisle running straight in from the
// entrance, with the tallest stone standing at the aisle's far end. Every
// stone in gravestones.glb becomes its own instancing master, so adding a
// stone to the glb adds it to the mix with no code change.
//
// Ground: on terrain (onTerrain - the openworld), every piece samples the
// real surface under it with sampleTerrainSurfaceHeight, the same sampler
// createcastle.js uses. It works off the terrain formula, not the loaded
// chunk meshes, so a graveyard far from the player grounds correctly even
// though its chunks don't exist yet. Pillars and stones sit at the LOWEST
// point under their footprint, so no edge floats; fence panels get shorter
// wherever the ground under them changes, stepping down the slope.

const PILLAR_PATH = "./models/outdors/fencepillar.glb"
const PILLAR_TEX_PATH = "./images/modeltex/pillartex2.webp"
const FENCE_TEX_PATH = "./images/modeltex/fence.webp"
const GRAVESTONES_PATH = "./models/outdors/gravestones.glb"
const GRAVESTONES_TEX_PATH = "./images/modeltex/gravestones/gravestones.jpg"

// fencepillar.glb is 0.448 x 1.278 x 0.327 (x, y, z), pivot at its base
const PILLAR_SCALE = 1.3
const PILLAR_HALF_WIDTH = 0.224 * PILLAR_SCALE
const PILLAR_HALF_DEPTH = 0.163 * PILLAR_SCALE
const FENCE_HEIGHT = 1.4
// fence.webp is 1682x803. Picket centers sit at x ~50 and ~1630, 9 picket
// gaps apart; the top ~9% is empty sky above the spear tips.
const FENCE_TEX_W = 1682
const FENCE_TEX_H = 803
const PANEL_U0 = 50 / FENCE_TEX_W
const PANEL_U1 = 1630 / FENCE_TEX_W
const PANEL_GAPS = 9
const GAP_U = (PANEL_U1 - PANEL_U0) / PANEL_GAPS
// one picket gap's world width at the texture's own aspect ratio (~0.31)
const GAP_WIDTH = FENCE_HEIGHT * (GAP_U * FENCE_TEX_W) / FENCE_TEX_H
// most a panel's bottom edge may end up buried at its uphill end - a panel
// whose ground varies more than this gets split into shorter ones
const FENCE_MAX_STEP = 0.12
const ENTRANCE_WIDTH = 3
// taller than anything visible - a 1.4 fence is within jumping reach, and the
// point of an entrance is that it's the only way in
const COLLIDER_HEIGHT = 3
const COLLIDER_THICKNESS = 0.2
// fence colliders come in pieces this long, each sized to its own stretch of
// ground - one box down a whole 100-long sloped side would have to be as tall
// as the full height difference everywhere along it
const COLLIDER_SEGMENT = 8
const COLLIDER_SAMPLE_STEP = 2

// Gravestone layout, in plot-local units with the entrance at local -z. The
// aisle is as wide as the entrance; rows run from just past the open ground
// inside the gate to the back fence.
const GRAVE_FENCE_MARGIN = 0.8      // stone centers stay this far off the fence
const GRAVE_ENTRY_CLEARANCE = 2     // open ground inside the gate, no stones
const GRAVE_COL_SPACING = 1.3       // stone to stone within a row
const GRAVE_ROW_SPACING = 1.8       // a stone plus the grave in front of it
const CENTERPIECE_BACK_MARGIN = 1.2 // the tall stone, from the back fence
// Big plots leave room to walk. Which slots get a stone comes from seeded
// value noise, so stones gather into family plots with open lanes between
// them rather than being thinned out evenly; on top of that every Nth row is
// left empty as a path across, and a few round clearings are cut out.
const GRAVE_SMALL_PLOT = 20         // areaSize at or under this fills every slot
const GRAVE_DEFAULT_DENSITY = 0.3
const GRAVE_CLUSTER_SIZE = 7        // noise cell size - roughly a family plot
const GRAVE_CLUSTER_RAGGEDNESS = 0.3
const GRAVE_CROSS_PATH_EVERY = 6    // every 6th row stays empty
const GRAVE_CLEARING_AREA = 700     // one clearing per this much plot area
const GRAVE_CLEARING_RADIUS_MIN = 3
const GRAVE_CLEARING_RADIUS_MAX = 6
// a stone sits at the lowest ground under it, so its uphill side is buried
// by however much the ground drops across it - past this, skip the slot
const GRAVE_MAX_GROUND_DROP = 0.35
// weathered, not machine-placed - deterministic so every client agrees
const GRAVE_JITTER_POS = 0.08
const GRAVE_JITTER_YAW = 0.12
const GRAVE_JITTER_LEAN = 0.05
// gravestones.glb's carved faces point down their own -z once imported
const STONE_FRONT_YAW = Math.PI

let fenceMat = null
let fenceMatScene = null
function getFenceMat(scene){
    if(fenceMatScene !== scene) fenceMat = null
    fenceMatScene = scene
    if(!fenceMat){
        fenceMat = new StandardMaterial("graveyardFenceMat", scene)
        const tex = new Texture(FENCE_TEX_PATH, scene)
        tex.hasAlpha = true // alpha test - the gaps between pickets cut out
        tex.wrapU = Texture.CLAMP_ADDRESSMODE
        tex.wrapV = Texture.CLAMP_ADDRESSMODE
        fenceMat.diffuseTexture = tex
        fenceMat.specularColor = new Color3(0, 0, 0)
    }
    return fenceMat
}

// one master per picket-gap count (the 9-gap full panel, plus whichever
// shorter remainders the runs need), shared by every run in the scene.
// Unit width - each instance is scaled to its real length.
function getPanelMaster(scene, panelMasters, gaps){
    if(panelMasters.has(gaps)) return panelMasters.get(gaps)
    const uvs = new Vector4(PANEL_U0, 0, PANEL_U0 + gaps * GAP_U, 1)
    const panel = MeshBuilder.CreatePlane(`graveyard_fence_master_${gaps}`, {
        width: 1,
        height: FENCE_HEIGHT,
        sideOrientation: Mesh.DOUBLESIDE,
        frontUVs: uvs,
        backUVs: uvs,
    }, scene)
    panel.material = getFenceMat(scene)
    panel.isVisible = false
    panel.isPickable = false
    panelMasters.set(gaps, panel)
    return panel
}

// fencepillar.glb ships with no material of its own (mergeAndLoadModel's
// multiMultiMaterials merge just carries that "nothing" through, which is
// what actually rendered as flat gray) - its one mesh's UVs span a clean
// 0..1 already, so pillartex2.webp goes on at uScale/vScale:1, no tiling
let pillarMat = null
let pillarMatScene = null
function getPillarMat(scene){
    if(pillarMatScene !== scene) pillarMat = null
    pillarMatScene = scene
    if(!pillarMat){
        pillarMat = new StandardMaterial("graveyardPillarMat", scene)
        pillarMat.diffuseTexture = new Texture(PILLAR_TEX_PATH, scene, false, false)
        pillarMat.specularColor = new Color3(0.05, 0.05, 0.05)
    }
    return pillarMat
}

async function createPillarMaster(scene){
    const pillar = await mergeAndLoadModel(PILLAR_PATH, scene)
    pillar.name = "graveyard_pillar_master"
    pillar.material = getPillarMat(scene)
    pillar.isVisible = false
    pillar.isPickable = false
    return pillar
}

// one master per stone in gravestones.glb (however many there are), all
// sharing the one atlas texture. Each stone is baked into world space on
// its own - the same MergeMeshes pass mergeAndLoadModel does, just per mesh
// instead of all together - so every master sits base-down on y:0 at the
// origin, ready to instance.
async function createGravestoneMasters(scene){
    const container = await SceneLoader.LoadAssetContainerAsync("", GRAVESTONES_PATH, scene)
    container.addAllToScene()

    const mat = new StandardMaterial("graveyardStoneMat", scene)
    // glTF UVs - invertY off, same as every other glb texture in this project
    mat.diffuseTexture = new Texture(GRAVESTONES_TEX_PATH, scene, false, false)
    mat.specularColor = new Color3(0.05, 0.05, 0.05)

    const stones = container.meshes[0].getChildMeshes().filter(mesh => mesh.getTotalVertices() > 0)
    const masters = stones.map(stone => {
        const name = stone.name
        const master = Mesh.MergeMeshes([stone], true, true, undefined, false, false)
        master.name = `graveyard_${name}_master`
        master.material = mat
        master.isVisible = false
        master.isPickable = false
        const { minimum, maximum } = master.getBoundingInfo().boundingBox
        return {
            name,
            mesh: master,
            height: maximum.y - minimum.y,
            // how far the base reaches from its pivot across (x) and
            // front-to-back (z) - a headstone is ~3x wider than it is deep
            halfWidth: Math.max(-minimum.x, maximum.x),
            halfDepth: Math.max(-minimum.z, maximum.z),
        }
    })

    // the glb's own (untextured) material and the now-empty __root__
    container.materials.forEach(glbMat => glbMat.dispose())
    container.meshes[0].dispose()
    return masters
}

// [lowest, highest] ground under a rectangular footprint turned by yaw - the
// center plus its four corners. Using the real rectangle rather than a
// square as wide as its longest side matters on slopes: a headstone is thin
// front to back, and a square footprint sank it by its WIDTH's worth of
// slope instead.
function footprintGround(groundAt, x, z, halfWidth, halfDepth = halfWidth, yaw = 0){
    // yaw turns local +x toward (cos, -sin) and local +z toward (sin, cos)
    const cos = Math.cos(yaw)
    const sin = Math.sin(yaw)
    let low = groundAt(x, z)
    let high = low
    for(const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]){
        const lx = sx * halfWidth
        const lz = sz * halfDepth
        const y = groundAt(x + lx * cos + lz * sin, z - lx * sin + lz * cos)
        if(y < low) low = y
        if(y > high) high = y
    }
    return [low, high]
}

// small seeded PRNG (mulberry32) - the stones' variant picks and jitter have
// to come out the same on every client, since each stone has a collider
function seededRandom(seed){
    let a = seed >>> 0
    return () => {
        a = (a + 0x6D2B79F5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

// seeded 2D value noise, 0..1, one random value per integer lattice point
// smoothly blended in between - what makes the graves gather into clumps
function seededValueNoise(seed){
    const lattice = (ix, iz) => {
        let h = seed ^ Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263)
        h = Math.imul(h ^ (h >>> 13), 1274126177)
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296
    }
    const smooth = t => t * t * (3 - 2 * t)
    return (x, z) => {
        const ix = Math.floor(x)
        const iz = Math.floor(z)
        const sx = smooth(x - ix)
        const sz = smooth(z - iz)
        const top = lattice(ix, iz) + (lattice(ix + 1, iz) - lattice(ix, iz)) * sx
        const bottom = lattice(ix, iz + 1) + (lattice(ix + 1, iz + 1) - lattice(ix, iz + 1)) * sx
        return top + (bottom - top) * sz
    }
}

// plot-local (entrance at local -z) -> world offset from the plot center.
// Pure rotations, so the aisle always runs straight in from whichever side
// the entrance is on.
const LOCAL_TO_WORLD = {
    south: (lx, lz) => [lx, lz],
    north: (lx, lz) => [-lx, -lz],
    east:  (lx, lz) => [-lz, lx],
    west:  (lx, lz) => [lz, -lx],
}
// the way a visitor walking in through the gate is looking is local +z, so
// every stone faces local -z - back toward the entrance
const ENTRANCE_DIR = {
    south: [0, -1],
    north: [0, 1],
    east:  [1, 0],
    west:  [-1, 0],
}

// n evenly spread centers across [from, to]
function spread(from, to, spacing){
    const count = Math.floor((to - from) / spacing)
    if(count < 1) return []
    const step = (to - from) / count
    return Array.from({ length: count }, (_, i) => from + step * (i + 0.5))
}

// every grave slot on both sides of the aisle, minus the cross paths, the
// clearings, and whichever slots the clustering noise leaves empty
function pickGraveSlots(half, gateHalf, density, random, noise){
    const inner = half - GRAVE_FENCE_MARGIN
    const cols = spread(gateHalf, inner, GRAVE_COL_SPACING)
    const rows = spread(-half + GRAVE_ENTRY_CLEARANCE, inner, GRAVE_ROW_SPACING)
    const crossPaths = rows.length > GRAVE_CROSS_PATH_EVERY

    let slots = []
    rows.forEach((lz, rowIndex) => {
        if(crossPaths && (rowIndex + 1) % GRAVE_CROSS_PATH_EVERY === 0) return
        cols.forEach(lx => {
            slots.push({ lx: -lx, lz })
            slots.push({ lx, lz })
        })
    })
    if(density >= 1) return slots

    const clearings = Array.from({ length: Math.floor((half * 2) ** 2 / GRAVE_CLEARING_AREA) }, () => ({
        lx: (random() * 2 - 1) * inner,
        lz: -half + GRAVE_ENTRY_CLEARANCE + random() * (inner + half - GRAVE_ENTRY_CLEARANCE),
        radius: GRAVE_CLEARING_RADIUS_MIN + random() * (GRAVE_CLEARING_RADIUS_MAX - GRAVE_CLEARING_RADIUS_MIN),
    }))
    slots = slots.filter(slot => !clearings.some(c => (slot.lx - c.lx) ** 2 + (slot.lz - c.lz) ** 2 < c.radius ** 2))

    // keep the lowest-scoring share. Ranking instead of thresholding the
    // noise directly makes density the real fraction kept - blended noise
    // bunches up around 0.5, so a raw threshold would miss it badly
    const keep = Math.round(slots.length * density)
    return slots
        .map(slot => ({
            slot,
            score: noise(slot.lx / GRAVE_CLUSTER_SIZE, slot.lz / GRAVE_CLUSTER_SIZE) + random() * GRAVE_CLUSTER_RAGGEDNESS,
        }))
        .sort((a, b) => a.score - b.score)
        .slice(0, keep)
        .map(({ slot }) => slot)
}

function addGravestones(name, stoneMasters, cx, cz, half, gateHalf, graveyard, entrance, groundAt, scene, hasPhysics){
    if(!stoneMasters.length) return
    const toWorld = LOCAL_TO_WORLD[entrance]
    const [fx, fz] = ENTRANCE_DIR[entrance]
    const facingYaw = Math.atan2(fx, fz) + STONE_FRONT_YAW
    const seed = graveyard.seed ?? (Math.round(cx * 73856093) ^ Math.round(cz * 19349663))
    const random = seededRandom(seed)
    const jitter = amount => (random() * 2 - 1) * amount
    const density = graveyard.density ?? (half * 2 <= GRAVE_SMALL_PLOT ? 1 : GRAVE_DEFAULT_DENSITY)

    // the tallest stone is the centerpiece; the rows draw from every stone,
    // shuffled a full set at a time so each one shows up about equally often
    const tallest = stoneMasters.reduce((best, stone) => stone.height > best.height ? stone : best)
    let bag = []
    const nextStone = () => {
        if(!bag.length){
            bag = [...stoneMasters]
            for(let i = bag.length - 1; i > 0; i--){
                const j = Math.floor(random() * (i + 1))
                ;[bag[i], bag[j]] = [bag[j], bag[i]]
            }
        }
        return bag.pop()
    }

    let placed = 0
    const place = (stone, lx, lz, jittered) => {
        const [wx, wz] = toWorld(
            lx + (jittered ? jitter(GRAVE_JITTER_POS) : 0),
            lz + (jittered ? jitter(GRAVE_JITTER_POS) : 0),
        )
        const x = cx + wx
        const z = cz + wz
        const yaw = facingYaw + (jittered ? jitter(GRAVE_JITTER_YAW) : 0)
        const leanX = jittered ? jitter(GRAVE_JITTER_LEAN) : 0
        const leanZ = jittered ? jitter(GRAVE_JITTER_LEAN) : 0
        const [low, high] = footprintGround(groundAt, x, z, stone.halfWidth, stone.halfDepth, yaw)
        // too steep to have dug a grave - leave the slot empty (the
        // centerpiece always stands, wherever the back of the plot is)
        if(jittered && high - low > GRAVE_MAX_GROUND_DROP) return
        const instance = stone.mesh.createInstance(`${name}_stone_${placed++}`)
        instance.position.set(x, low, z)
        instance.rotation.set(leanX, yaw, leanZ)
        instance.isPickable = false
        // after rotation - a static collider bakes its pose once, at creation
        if(hasPhysics) createAggregate(instance, { mass: 0 }, "box", scene)
    }

    pickGraveSlots(half, gateHalf, density, random, seededValueNoise(seed))
        .forEach(slot => place(nextStone(), slot.lx, slot.lz, true))
    place(tallest, 0, half - CENTERPIECE_BACK_MARGIN, false)
}

// a straight fence run from (x1, z1) to (x2, z2) along one axis: a whole
// number of picket gaps stretched a touch to fit exactly, plus invisible box
// colliders covering the whole run
function addFenceRun(name, panelMasters, x1, z1, x2, z2, groundAt, scene, hasPhysics){
    const alongX = z1 === z2
    const length = alongX ? Math.abs(x2 - x1) : Math.abs(z2 - z1)
    if(length <= 0) return

    const startX = Math.min(x1, x2)
    const startZ = Math.min(z1, z2)
    // world (x, z) at distance d along the run
    const pointAt = d => alongX ? [startX + d, z1] : [x1, startZ + d]
    const groundRange = (from, to, samples) => {
        let low = Infinity
        let high = -Infinity
        for(let s = 0; s <= samples; s++){
            const y = groundAt(...pointAt(from + (to - from) * s / samples))
            if(y < low) low = y
            if(y > high) high = y
        }
        return [low, high]
    }

    const totalGaps = Math.max(1, Math.round(length / GAP_WIDTH))
    const gapWidth = length / totalGaps
    let placedGaps = 0
    for(let i = 0; placedGaps < totalGaps; i++){
        const from = placedGaps * gapWidth
        let gaps = Math.min(PANEL_GAPS, totalGaps - placedGaps)
        let [low, high] = groundRange(from, from + gaps * gapWidth, 2)
        while(gaps > 1 && high - low > FENCE_MAX_STEP){
            gaps--
            ;[low, high] = groundRange(from, from + gaps * gapWidth, 2)
        }
        const width = gaps * gapWidth
        const [px, pz] = pointAt(from + width / 2)
        const panel = getPanelMaster(scene, panelMasters, gaps).createInstance(`${name}_panel_${i}`)
        panel.scaling.x = width
        panel.position.set(px, low + FENCE_HEIGHT / 2, pz)
        if(!alongX) panel.rotation.y = Math.PI / 2
        panel.isPickable = false
        placedGaps += gaps
    }

    if(!hasPhysics) return
    const segments = Math.max(1, Math.ceil(length / COLLIDER_SEGMENT))
    const segLength = length / segments
    for(let s = 0; s < segments; s++){
        const from = s * segLength
        const [low, high] = groundRange(from, from + segLength, Math.max(2, Math.ceil(segLength / COLLIDER_SAMPLE_STEP)))
        const height = high - low + COLLIDER_HEIGHT
        const collider = MeshBuilder.CreateBox(`${name}_collider_${s}`, {
            width: alongX ? segLength : COLLIDER_THICKNESS,
            height,
            depth: alongX ? COLLIDER_THICKNESS : segLength,
        }, scene)
        const [px, pz] = pointAt(from + segLength / 2)
        collider.position.set(px, low + height / 2, pz)
        collider.isVisible = false
        collider.isPickable = false
        createAggregate(collider, { mass: 0 }, "box", scene)
    }
}

// alongX: the fence this post belongs to runs along x - the pillar's wider
// face (its x side) goes along the fence line either way
function addPillar(name, pillarMaster, x, z, groundAt, alongX, scene, hasPhysics){
    const pillar = pillarMaster.createInstance(name)
    pillar.position.set(x, footprintGround(groundAt, x, z, PILLAR_HALF_WIDTH, PILLAR_HALF_DEPTH, alongX ? 0 : Math.PI / 2)[0], z)
    pillar.scaling.setAll(PILLAR_SCALE)
    if(!alongX) pillar.rotation.y = Math.PI / 2
    pillar.isPickable = false
    if(hasPhysics) createAggregate(pillar, { mass: 0 }, "box", scene)
}

function createGraveyard(scene, graveyard, index, masters, onTerrain, hasPhysics){
    const { panelMasters, pillarMaster, stoneMasters } = masters
    const { position, areaSize } = graveyard
    const entrance = graveyard.entrance ?? "south"
    const half = areaSize / 2
    const cx = position.x
    const cz = position.z
    const flatY = position.y ?? 0
    const groundAt = onTerrain
        ? (x, z) => sampleTerrainSurfaceHeight(x, z, OPENWORLD_TERRAIN_VERTS)
        : () => flatY
    const gateHalf = Math.min(ENTRANCE_WIDTH, areaSize / 2) / 2
    const name = `graveyard_${index}`

    // each side as its two corners, walked in the same direction the
    // entrance gap gets cut from: [x1, z1, x2, z2]
    const sides = {
        north: [cx - half, cz + half, cx + half, cz + half],
        south: [cx - half, cz - half, cx + half, cz - half],
        east:  [cx + half, cz - half, cx + half, cz + half],
        west:  [cx - half, cz - half, cx - half, cz + half],
    }

    Object.entries(sides).forEach(([side, [x1, z1, x2, z2]]) => {
        const alongX = z1 === z2
        if(side !== entrance){
            addFenceRun(`${name}_${side}`, panelMasters, x1, z1, x2, z2, groundAt, scene, hasPhysics)
            return
        }
        // split around the gap, gate posts on both sides of it
        const midX = (x1 + x2) / 2
        const midZ = (z1 + z2) / 2
        const gapX = alongX ? gateHalf : 0
        const gapZ = alongX ? 0 : gateHalf
        addFenceRun(`${name}_${side}_a`, panelMasters, x1, z1, midX - gapX, midZ - gapZ, groundAt, scene, hasPhysics)
        addFenceRun(`${name}_${side}_b`, panelMasters, midX + gapX, midZ + gapZ, x2, z2, groundAt, scene, hasPhysics)
        addPillar(`${name}_gatepost_a`, pillarMaster, midX - gapX, midZ - gapZ, groundAt, alongX, scene, hasPhysics)
        addPillar(`${name}_gatepost_b`, pillarMaster, midX + gapX, midZ + gapZ, groundAt, alongX, scene, hasPhysics)
    })

    ;[[-half, -half], [half, -half], [-half, half], [half, half]].forEach(([dx, dz], i) => {
        addPillar(`${name}_corner_${i}`, pillarMaster, cx + dx, cz + dz, groundAt, true, scene, hasPhysics)
    })

    addGravestones(name, stoneMasters, cx, cz, half, gateHalf, graveyard, entrance, groundAt, scene, hasPhysics)
}

// createGraveyards(scene, placeDetail.graveYards, { onTerrain }) - every
// graveyard in the place shares the same pillar, fence panel and gravestone
// masters. onTerrain: ground everything on the openworld terrain instead of
// each graveyard's own flat position.y.
export async function createGraveyards(scene, graveYards, { onTerrain = false, hasPhysics = true } = {}){
    if(!graveYards?.length) return
    const [pillarMaster, stoneMasters] = await Promise.all([
        createPillarMaster(scene),
        createGravestoneMasters(scene),
    ])
    const masters = {
        panelMasters: new Map(),
        pillarMaster,
        stoneMasters,
    }
    graveYards.forEach((graveyard, i) => createGraveyard(scene, graveyard, i, masters, onTerrain, hasPhysics))
}
