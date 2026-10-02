import { MeshBuilder, Mesh, StandardMaterial, Texture, Color3, Vector4, SceneLoader } from "@babylonjs/core"
import { sampleTerrainSurfaceHeight } from "infterrain"
import { createAggregate } from "../tools/physics.js"
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
//
// Two ways in:
//   createGraveyards - builds every plot at once and keeps it (the village's
//     one small plot).
//   streamGraveyards - the openworld's many plots. Only a plot near the
//     player exists: it's built once they come within GRAVEYARD_LOAD_DIST of
//     its fence, a few instances per frame so it never hitches, and disposed
//     - instances, fence colliders and every stone's physics body with them -
//     once they're past GRAVEYARD_UNLOAD_DIST. The shared masters (glbs,
//     textures) are freed too once no plot has been loaded for a while.
//
// Both go through planGraveyard: a plot is a list of small build tasks (a
// long fence run is one task called repeatedly until it's done), each
// recording what it created in the plot's own list so the whole plot can be
// torn down again. Tasks run in order, so the seeded layout comes out the
// same however many frames the build is spread across - and the same on
// every client, which matters because every stone and post has a collider.

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

// Streaming (streamGraveyards). Distances are from the player to the plot's
// nearest fence, not its center, so a big plot and a small one both appear
// when their edge is this close. LOAD sits a little past where openworld
// enemies turn visible (renderer.js's OPENWORLD_ENEMY_SHOW_DIST, 180) so the
// ghosts and their graveyard show up together; UNLOAD leaves a 100-unit gap
// so walking along the boundary never rebuilds the same plot over and over.
// Both sit inside what the terrain keeps built around you (infterrain's
// 256-unit chunks, viewRadius 1 - areascene.js).
const GRAVEYARD_LOAD_DIST = 200
const GRAVEYARD_UNLOAD_DIST = 300
const GRAVEYARD_CHECK_INTERVAL_MS = 500
// build work allowed per frame - an 80-wide plot is ~600 stones, each an
// instance plus a physics body, far too much for one frame. At this budget
// it finishes in a second or two, long before anyone walks 200 units.
const GRAVEYARD_BUILD_BUDGET_MS = 4
// the masters are cheap to keep but the gravestone atlas alone is a
// 2048x2048 texture - freed once no plot has been loaded for this long, kept
// otherwise so walking back and forth between plots doesn't reload it
const GRAVEYARD_MASTERS_IDLE_MS = 60 * 1000

// a glb's own meshes merged into one hidden master (materials replaced by
// the caller), the container's empty __root__ and its own materials thrown
// away - mergeAndLoadModel (tools/loadmodel.js) does the merge but keeps the
// root around, which a master that gets disposed and reloaded would leak
async function loadMergedMasters(scene, path, perMesh){
    const container = await SceneLoader.LoadAssetContainerAsync("", path, scene)
    container.addAllToScene()
    const meshes = container.meshes[0].getChildMeshes().filter(mesh => mesh.getTotalVertices() > 0)
    if(!meshes.length) throw new Error(`[graveyards] no meshes with geometry in ${path}`)
    const groups = perMesh ? meshes.map(mesh => [mesh]) : [meshes]
    const masters = groups.map(group => {
        const sourceName = group[0].name
        const master = Mesh.MergeMeshes(group, true, true, undefined, false, false)
        master.isVisible = false
        master.isPickable = false
        return { sourceName, mesh: master }
    })
    container.materials.forEach(glbMat => glbMat.dispose())
    container.meshes[0].dispose()
    return masters
}

// everything every plot instances from, loaded once and shared: the pillar,
// one master per stone in gravestones.glb (however many there are), fence
// panel masters (made on demand, see getPanelMaster) and their materials.
// dispose() frees all of it, textures included - only ever called once no
// plot is using any of it (a master's dispose takes its instances with it).
async function loadGraveyardMasters(scene){
    const fenceMat = new StandardMaterial("graveyardFenceMat", scene)
    const fenceTex = new Texture(FENCE_TEX_PATH, scene)
    fenceTex.hasAlpha = true // alpha test - the gaps between pickets cut out
    fenceTex.wrapU = Texture.CLAMP_ADDRESSMODE
    fenceTex.wrapV = Texture.CLAMP_ADDRESSMODE
    fenceMat.diffuseTexture = fenceTex
    fenceMat.specularColor = new Color3(0, 0, 0)

    // fencepillar.glb ships with no material of its own - its one mesh's UVs
    // span a clean 0..1 already, so pillartex2.webp goes on at 1:1, no tiling
    const pillarMat = new StandardMaterial("graveyardPillarMat", scene)
    pillarMat.diffuseTexture = new Texture(PILLAR_TEX_PATH, scene, false, false)
    pillarMat.specularColor = new Color3(0.05, 0.05, 0.05)

    // glTF UVs - invertY off, same as every other glb texture in this project
    const stoneMat = new StandardMaterial("graveyardStoneMat", scene)
    stoneMat.diffuseTexture = new Texture(GRAVESTONES_TEX_PATH, scene, false, false)
    stoneMat.specularColor = new Color3(0.05, 0.05, 0.05)

    const [[pillar], stones] = await Promise.all([
        loadMergedMasters(scene, PILLAR_PATH, false),
        loadMergedMasters(scene, GRAVESTONES_PATH, true),
    ])
    pillar.mesh.name = "graveyard_pillar_master"
    pillar.mesh.material = pillarMat

    // each stone baked into world space on its own, so every master sits
    // base-down on y:0 at the origin, ready to instance
    const stoneMasters = stones.map(({ sourceName, mesh }) => {
        mesh.name = `graveyard_${sourceName}_master`
        mesh.material = stoneMat
        const { minimum, maximum } = mesh.getBoundingInfo().boundingBox
        return {
            name: sourceName,
            mesh,
            height: maximum.y - minimum.y,
            // how far the base reaches from its pivot across (x) and
            // front-to-back (z) - a headstone is ~3x wider than it is deep
            halfWidth: Math.max(-minimum.x, maximum.x),
            halfDepth: Math.max(-minimum.z, maximum.z),
        }
    })

    const masters = {
        fenceMat,
        panelMasters: new Map(),
        pillarMaster: pillar.mesh,
        stoneMasters,
        dispose(){
            masters.panelMasters.forEach(panel => panel.dispose())
            masters.panelMasters.clear()
            masters.pillarMaster.dispose()
            masters.stoneMasters.forEach(stone => stone.mesh.dispose())
            ;[fenceMat, pillarMat, stoneMat].forEach(mat => mat.dispose(false, true))
        },
    }
    return masters
}

// one master per picket-gap count (the 9-gap full panel, plus whichever
// shorter remainders the runs need), shared by every run in the scene.
// Unit width - each instance is scaled to its real length.
function getPanelMaster(scene, masters, gaps){
    if(masters.panelMasters.has(gaps)) return masters.panelMasters.get(gaps)
    const uvs = new Vector4(PANEL_U0, 0, PANEL_U0 + gaps * GAP_U, 1)
    const panel = MeshBuilder.CreatePlane(`graveyard_fence_master_${gaps}`, {
        width: 1,
        height: FENCE_HEIGHT,
        sideOrientation: Mesh.DOUBLESIDE,
        frontUVs: uvs,
        backUVs: uvs,
    }, scene)
    panel.material = masters.fenceMat
    panel.isVisible = false
    panel.isPickable = false
    masters.panelMasters.set(gaps, panel)
    return panel
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

// one build task per stone (in slot order, then the centerpiece), each
// pushing what it made onto `track`. The slot pick and every jitter draw come
// off one seeded random stream consumed in that same order, so the result
// doesn't depend on how the tasks end up spread across frames.
function planGravestones(name, stoneMasters, cx, cz, half, gateHalf, graveyard, entrance, groundAt, scene, hasPhysics, track){
    if(!stoneMasters.length) return []
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
        track.push(instance)
    }

    const tasks = pickGraveSlots(half, gateHalf, density, random, seededValueNoise(seed))
        .map(slot => () => place(nextStone(), slot.lx, slot.lz, true))
    tasks.push(() => place(tallest, 0, half - CENTERPIECE_BACK_MARGIN, false))
    return tasks
}

// how much of a fence run one build step does - a whole 100-long side is
// ~40 panels and 13 colliders, too much to fit one streaming frame's budget
const FENCE_PANELS_PER_STEP = 10
const FENCE_COLLIDERS_PER_STEP = 3

// a straight fence run from (x1, z1) to (x2, z2) along one axis: a whole
// number of picket gaps stretched a touch to fit exactly, plus invisible box
// colliders covering the whole run. Returns a STEPPED task - each call lays
// down the next few panels (then colliders) and returns true while there's
// more to do, so a long run can be spread across frames like everything else.
function fenceRunTask(name, masters, x1, z1, x2, z2, groundAt, scene, hasPhysics, track){
    const alongX = z1 === z2
    const length = alongX ? Math.abs(x2 - x1) : Math.abs(z2 - z1)
    if(length <= 0) return () => false

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
    const segments = hasPhysics ? Math.max(1, Math.ceil(length / COLLIDER_SEGMENT)) : 0
    const segLength = length / Math.max(1, segments)
    let placedGaps = 0
    let panelIndex = 0
    let segment = 0

    function placePanel(){
        const from = placedGaps * gapWidth
        let gaps = Math.min(PANEL_GAPS, totalGaps - placedGaps)
        let [low, high] = groundRange(from, from + gaps * gapWidth, 2)
        while(gaps > 1 && high - low > FENCE_MAX_STEP){
            gaps--
            ;[low, high] = groundRange(from, from + gaps * gapWidth, 2)
        }
        const width = gaps * gapWidth
        const [px, pz] = pointAt(from + width / 2)
        const panel = getPanelMaster(scene, masters, gaps).createInstance(`${name}_panel_${panelIndex++}`)
        panel.scaling.x = width
        panel.position.set(px, low + FENCE_HEIGHT / 2, pz)
        if(!alongX) panel.rotation.y = Math.PI / 2
        panel.isPickable = false
        track.push(panel)
        placedGaps += gaps
    }

    function placeCollider(){
        const from = segment * segLength
        const [low, high] = groundRange(from, from + segLength, Math.max(2, Math.ceil(segLength / COLLIDER_SAMPLE_STEP)))
        const height = high - low + COLLIDER_HEIGHT
        const collider = MeshBuilder.CreateBox(`${name}_collider_${segment}`, {
            width: alongX ? segLength : COLLIDER_THICKNESS,
            height,
            depth: alongX ? COLLIDER_THICKNESS : segLength,
        }, scene)
        const [px, pz] = pointAt(from + segLength / 2)
        collider.position.set(px, low + height / 2, pz)
        collider.isVisible = false
        collider.isPickable = false
        createAggregate(collider, { mass: 0 }, "box", scene)
        track.push(collider)
        segment++
    }

    return () => {
        if(placedGaps < totalGaps){
            for(let n = 0; n < FENCE_PANELS_PER_STEP && placedGaps < totalGaps; n++) placePanel()
            return placedGaps < totalGaps || segment < segments
        }
        for(let n = 0; n < FENCE_COLLIDERS_PER_STEP && segment < segments; n++) placeCollider()
        return segment < segments
    }
}

// alongX: the fence this post belongs to runs along x - the pillar's wider
// face (its x side) goes along the fence line either way
function addPillar(name, pillarMaster, x, z, groundAt, alongX, scene, hasPhysics, track){
    const pillar = pillarMaster.createInstance(name)
    pillar.position.set(x, footprintGround(groundAt, x, z, PILLAR_HALF_WIDTH, PILLAR_HALF_DEPTH, alongX ? 0 : Math.PI / 2)[0], z)
    pillar.scaling.setAll(PILLAR_SCALE)
    if(!alongX) pillar.rotation.y = Math.PI / 2
    pillar.isPickable = false
    if(hasPhysics) createAggregate(pillar, { mass: 0 }, "box", scene)
    track.push(pillar)
}

// the whole plot as an ordered list of build tasks - fence runs and posts
// first (the outline you see from a distance), then one task per stone.
// Everything created lands in `track`, which is what tearing the plot back
// down disposes.
function planGraveyard(scene, graveyard, index, masters, onTerrain, hasPhysics, track){
    const { pillarMaster, stoneMasters } = masters
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
    const tasks = []

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
            tasks.push(fenceRunTask(`${name}_${side}`, masters, x1, z1, x2, z2, groundAt, scene, hasPhysics, track))
            return
        }
        // split around the gap, gate posts on both sides of it
        const midX = (x1 + x2) / 2
        const midZ = (z1 + z2) / 2
        const gapX = alongX ? gateHalf : 0
        const gapZ = alongX ? 0 : gateHalf
        tasks.push(fenceRunTask(`${name}_${side}_a`, masters, x1, z1, midX - gapX, midZ - gapZ, groundAt, scene, hasPhysics, track))
        tasks.push(fenceRunTask(`${name}_${side}_b`, masters, midX + gapX, midZ + gapZ, x2, z2, groundAt, scene, hasPhysics, track))
        tasks.push(() => addPillar(`${name}_gatepost_a`, pillarMaster, midX - gapX, midZ - gapZ, groundAt, alongX, scene, hasPhysics, track))
        tasks.push(() => addPillar(`${name}_gatepost_b`, pillarMaster, midX + gapX, midZ + gapZ, groundAt, alongX, scene, hasPhysics, track))
    })

    ;[[-half, -half], [half, -half], [-half, half], [half, half]].forEach(([dx, dz], i) => {
        tasks.push(() => addPillar(`${name}_corner_${i}`, pillarMaster, cx + dx, cz + dz, groundAt, true, scene, hasPhysics, track))
    })

    tasks.push(...planGravestones(name, stoneMasters, cx, cz, half, gateHalf, graveyard, entrance, groundAt, scene, hasPhysics, track))
    return tasks
}

// createGraveyards(scene, placeDetail.graveYards, { onTerrain }) - builds
// every plot at once and keeps it for the scene's life (the village's one
// small plot). onTerrain: ground everything on the openworld terrain instead
// of each graveyard's own flat position.y. See streamGraveyards for the
// openworld's many plots.
export async function createGraveyards(scene, graveYards, { onTerrain = false, hasPhysics = true } = {}){
    if(!graveYards?.length) return
    const masters = await loadGraveyardMasters(scene)
    graveYards.forEach((graveyard, i) => {
        // a stepped task (fence runs) returns true until it's finished
        planGraveyard(scene, graveyard, i, masters, onTerrain, hasPhysics, []).forEach(task => { while(task()){} })
    })
}

// streamGraveyards(scene, placeDetail.graveYards, getFocusPosition) - only
// the plots near the player exist (see the GRAVEYARD_* constants and the
// header comment). getFocusPosition returns the point distances are measured
// from - the local player's body. Cleans itself up with the scene; the
// returned handle's dispose() stops it early, and stats() reports what's
// currently built.
export function streamGraveyards(scene, graveYards, getFocusPosition, { onTerrain = true, hasPhysics = true } = {}){
    if(!graveYards?.length) return null

    // state: "unloaded" -> "queued" (in range, waiting for masters/its turn)
    // -> "building" (tasks running) -> "loaded"; any of the last three
    // goes straight back to "unloaded" once out of range
    const plots = graveYards.map((graveyard, index) => ({
        graveyard, index,
        half: graveyard.areaSize / 2,
        state: "unloaded",
        tasks: null,
        taskIndex: 0,
        nodes: [],
    }))

    let masters = null
    let mastersLoading = false
    let idleSince = null
    let sinceCheckMs = 0
    let stopped = false

    // player -> nearest point of the plot's square
    const edgeDistance = (plot, pos) => {
        const dx = Math.max(Math.abs(pos.x - plot.graveyard.position.x) - plot.half, 0)
        const dz = Math.max(Math.abs(pos.z - plot.graveyard.position.z) - plot.half, 0)
        return Math.hypot(dx, dz)
    }

    function unload(plot){
        // an instance/collider's dispose takes its physics body with it
        // (PhysicsAggregate hooks onDisposeObservable)
        plot.nodes.forEach(node => node.dispose())
        plot.nodes = []
        plot.tasks = null
        plot.taskIndex = 0
        plot.state = "unloaded"
    }

    function ensureMasters(){
        if(masters || mastersLoading) return
        mastersLoading = true
        loadGraveyardMasters(scene)
            .then(loaded => {
                mastersLoading = false
                if(stopped || scene.isDisposed) return loaded.dispose()
                masters = loaded
            })
            .catch(err => {
                mastersLoading = false
                console.warn("[graveyards] failed to load graveyard assets", err)
            })
    }

    function check(){
        const pos = getFocusPosition()
        if(!pos) return
        plots.forEach(plot => {
            const dist = edgeDistance(plot, pos)
            if(plot.state === "unloaded" && dist < GRAVEYARD_LOAD_DIST) plot.state = "queued"
            else if(plot.state !== "unloaded" && dist > GRAVEYARD_UNLOAD_DIST) unload(plot)
        })

        if(plots.some(plot => plot.state !== "unloaded")){
            idleSince = null
            ensureMasters()
        } else if(masters){
            // nothing in range - hold the masters a while in case the player
            // turns back, then free them
            if(idleSince === null) idleSince = performance.now()
            if(performance.now() - idleSince > GRAVEYARD_MASTERS_IDLE_MS){
                masters.dispose()
                masters = null
                idleSince = null
            }
        }
    }

    function build(){
        if(!masters) return
        const pending = plots.filter(plot => plot.state === "queued" || plot.state === "building")
        if(!pending.length) return
        const pos = getFocusPosition()
        if(pos) pending.sort((a, b) => edgeDistance(a, pos) - edgeDistance(b, pos)) // nearest first

        const start = performance.now()
        for(const plot of pending){
            if(plot.state === "queued"){
                // planning (picking every grave slot) gets a frame of its own
                plot.tasks = planGraveyard(scene, plot.graveyard, plot.index, masters, onTerrain, hasPhysics, plot.nodes)
                plot.taskIndex = 0
                plot.state = "building"
                return
            }
            while(plot.taskIndex < plot.tasks.length){
                if(performance.now() - start > GRAVEYARD_BUILD_BUDGET_MS) return
                let more = false
                try {
                    // a stepped task (fence runs) returns true while it has more to do
                    more = plot.tasks[plot.taskIndex]()
                } catch (err) {
                    console.warn(`[graveyards] graveyard_${plot.index} build step failed`, err)
                }
                if(!more) plot.taskIndex++
            }
            plot.tasks = null
            plot.state = "loaded"
        }
    }

    const observer = scene.onBeforeRenderObservable.add(() => {
        sinceCheckMs += scene.getEngine().getDeltaTime()
        if(sinceCheckMs >= GRAVEYARD_CHECK_INTERVAL_MS){
            sinceCheckMs = 0
            check()
        }
        build()
    })
    check()

    function stop(){
        if(stopped) return
        stopped = true
        scene.onBeforeRenderObservable.remove(observer)
        plots.forEach(unload)
        masters?.dispose()
        masters = null
    }
    // the scene takes every mesh/material with it anyway - just stop ticking
    scene.onDisposeObservable.addOnce(() => {
        stopped = true
        scene.onBeforeRenderObservable.remove(observer)
    })

    return {
        dispose: stop,
        stats: () => ({
            loaded: plots.filter(plot => plot.state === "loaded").map(plot => plot.index),
            building: plots.filter(plot => plot.state === "building" || plot.state === "queued").map(plot => plot.index),
            nodes: plots.reduce((sum, plot) => sum + plot.nodes.length, 0),
            mastersLoaded: !!masters,
        }),
    }
}
