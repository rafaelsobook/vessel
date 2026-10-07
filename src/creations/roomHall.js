import { Color3, Mesh, MeshBuilder, StandardMaterial, Texture, Vector3, Vector4 } from "@babylonjs/core"
import { createAggregate } from "../tools/physics.js"
import { mergeAndLoadModel } from "../tools/loadmodel.js"
import { createFireParticles } from "../tools/particlesystem.js"
import { letCameraPassThrough } from "../tools/camera.js"

// A HALL - createroom.js's room grown into a timber hall with an upper
// floor: a gallery along the north wall, reached by a straight flight of
// stairs up one side wall, with posts, railings, beams and wall torches.
// Driven by a room's data (localroomdb.js):
//
//   gallery: {
//       height: 3.5,        // top of the gallery's floor
//       depth: 4,           // how far it reaches out from the north wall
//       stairs: "east",     // the side wall the stairs climb along ("east"/"west")
//       stairWidth: 1.6,
//   },
//   wallTorches: [ { wall: "s", along: -4, y: 2.2 }, ... ],
//
// Room frame (createroom.js's): centred on the origin, north +Z, east +X.
// The stairs always climb north, arriving at the gallery's front edge.
//
// THE STAIRS: the player's collider is a box with no step-up - it can't
// climb a ledge over ~0.04 - so the steps are only what you see; you walk
// up an invisible ramp under them (createdungeon.js's boss stairs do the
// same). How steep that ramp can be was tested in Havok with the player's
// exact body and movement: everything up to 33° climbs at walking speed (1),
// 37° stalls just short of the top. 29° (rise/run 0.55) keeps a margin.
// The ramp runs through the MIDDLE of every step (half a rise above the
// nosings' line) so feet don't sink into the steps, and a lip at the top
// meets the gallery floor dead level - no ledge either way.
//
// THE CAMERA: everything here that the player can walk under or past - the
// gallery floor, posts, railings, the stairs - lets the camera's collision
// ray through (letCameraPassThrough), so standing under the gallery doesn't
// pull the camera in to your head. The visible hall is one pickable mesh,
// which createroom.js's camera occlusion fades whenever it's in the way.

const STAIR_SLOPE      = 0.55   // rise per run - see the header
const STAIR_STEP_RISE  = 0.2
const STAIR_WIDTH      = 1.6
const TREAD_THICKNESS  = 0.05
const TREAD_NOSING     = 0.04
const SLAB_THICKNESS   = 0.35
const EDGE_BEAM_HEIGHT = 0.45   // the deep beam under the gallery's front edge
const JOIST_HEIGHT     = 0.25
const JOIST_SPACING    = 1.5
const POST_SIZE        = 0.3
const POST_SPACING     = 4
const RAIL_HEIGHT      = 1      // top of a railing above what it guards
const RAIL_SIZE        = 0.12
const BALUSTER_SIZE    = 0.07
const BALUSTER_SPACING = 0.42
const RAIL_COLLIDER_HEIGHT = 1.2
const RAMP_THICKNESS   = 0.4
const RAMP_UNDERRUN    = 0.5    // past the bottom, sunk into the floor
// the space under the upper part of the stairs is closed off from here up
// the ramp - lower down, the ramp's own edge is what you bump into
const UNDER_STAIR_FROM = 1.7
// walls are centred on the room's edge (createroom.js's WALL_THICKNESS 0.3)
const WALL_INSET       = 0.15
const PILASTER_SIZE    = 0.28
const PILASTER_SPACING = 4
const PILASTER_DOOR_CLEARANCE = 1.6
const BAND_HEIGHT      = 0.3
const BAND_DEPTH       = 0.12

// world units per texture repeat
const PLANK_TILE  = 2.5
const TIMBER_TILE = 1.5

const TORCH_GLB        = "./models/indors/wallTorch.glb"
const TORCH_FLAME_UP   = 0.3    // flame above the torch's mount point
const TORCH_FLAME_OUT  = 0.22   // and out from the wall
const TORCH_LIGHT      = { intensity: 1.6, range: 9 }

function hallMaterials(scene, name){
    const plank = new StandardMaterial(`${name}_hall_plank`, scene)
    plank.diffuseTexture = new Texture("./images/modeltex/planks.jpg", scene)
    plank.specularColor = Color3.Black()

    const timber = new StandardMaterial(`${name}_hall_timber`, scene)
    timber.diffuseTexture = new Texture("./images/modeltex/wood2.jpg", scene)
    // wood2 is a mid brown - the hall's frame reads darker than its boards
    timber.diffuseColor = new Color3(0.55, 0.42, 0.34)
    timber.specularColor = Color3.Black()
    return { plank, timber }
}

// A box whose texture repeats every `tile` world units on every face,
// instead of stretching once across each face whatever its size
function texturedBox(name, w, h, d, tile, scene){
    const uv = (a, b) => new Vector4(0, 0, a / tile, b / tile)
    return MeshBuilder.CreateBox(name, {
        width: w, height: h, depth: d,
        // front/back (±z): w x h, sides (±x): d x h, top/bottom (±y): w x d
        faceUV: [uv(w, h), uv(w, h), uv(d, h), uv(d, h), uv(w, d), uv(w, d)],
    }, scene)
}

// An invisible static collider. passThrough: the camera's ray ignores it
function collider(name, w, h, d, position, scene, { rotation, passThrough = true } = {}){
    const box = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene)
    box.position.copyFrom(position)
    if(rotation) box.rotation.copyFrom(rotation)
    box.isVisible = false
    box.isPickable = false
    const agg = createAggregate(box, { mass: 0 }, "box", scene)
    if(passThrough) letCameraPassThrough(agg.shape)
    return box
}

// x positions spread evenly from `from` to `to`, at most `spacing` apart
function spread(from, to, spacing){
    const n = Math.max(1, Math.ceil(Math.abs(to - from) / spacing))
    return Array.from({ length: n + 1 }, (_, i) => from + (to - from) * i / n)
}

export function buildGallery(scene, room, hasPhysics = true){
    const { gallery, name = "Room", width = 7, height = 10, optionalObjects = [] } = room
    if(!gallery) return null

    const H         = gallery.height
    const depth     = gallery.depth
    const stairW    = gallery.stairWidth ?? STAIR_WIDTH
    const stairSide = gallery.stairs === "west" ? -1 : 1
    const halfW     = width / 2
    const halfH     = height / 2
    const xMin      = -halfW + WALL_INSET
    const xMax      =  halfW - WALL_INSET
    const zBack     =  halfH - WALL_INSET
    const zFront    =  halfH - depth
    const mats      = hallMaterials(scene, name)
    const planks    = []   // visible pieces, by material - merged at the end
    const timbers   = []

    // the stairs' column along its side wall, and the railing that runs from
    // the far wall to where the stairs arrive
    const stairX0 = stairSide > 0 ? xMax - stairW : xMin
    const stairX1 = stairX0 + stairW
    const stairCX = (stairX0 + stairX1) / 2
    const stairInnerX = stairSide > 0 ? stairX0 : stairX1     // the open side
    const railFrom = stairSide > 0 ? xMin : stairX1
    const railTo   = stairSide > 0 ? stairX0 : xMax

    const plank = (n, w, h, d, x, y, z) => {
        const m = texturedBox(n, w, h, d, PLANK_TILE, scene)
        m.position.set(x, y, z)
        planks.push(m)
        return m
    }
    const timber = (n, w, h, d, x, y, z) => {
        const m = texturedBox(n, w, h, d, TIMBER_TILE, scene)
        m.position.set(x, y, z)
        timbers.push(m)
        return m
    }

    // ── the gallery floor ─────────────────────────────────────────────────────
    const spanX = xMax - xMin
    const slabD = zBack - zFront
    const slabY = H - SLAB_THICKNESS / 2
    plank("hall_slab", spanX, SLAB_THICKNESS, slabD, 0, slabY, (zFront + zBack) / 2)
    if(hasPhysics) collider("hall_slab_collider", spanX, SLAB_THICKNESS, slabD, new Vector3(0, slabY, (zFront + zBack) / 2), scene)

    // deep edge beam along the front, posts under it down to the floor -
    // neither runs through the stairs' column, where the steps are solid
    const beamBottom = H - SLAB_THICKNESS - EDGE_BEAM_HEIGHT
    const beamLen = railTo - railFrom
    timber("hall_edgebeam", beamLen, EDGE_BEAM_HEIGHT, POST_SIZE, (railFrom + railTo) / 2, beamBottom + EDGE_BEAM_HEIGHT / 2, zFront + POST_SIZE / 2)
    spread(railFrom + POST_SIZE / 2, railTo - POST_SIZE / 2, POST_SPACING).forEach((x, i) => {
        const pos = new Vector3(x, beamBottom / 2, zFront + POST_SIZE / 2)
        timber(`hall_post_${i}`, POST_SIZE, beamBottom, POST_SIZE, pos.x, pos.y, pos.z)
        if(hasPhysics) collider(`hall_post_${i}_collider`, POST_SIZE, beamBottom, POST_SIZE, pos, scene)
    })
    // joists from the edge beam back to the wall
    spread(xMin + 0.3, xMax - 0.3, JOIST_SPACING).forEach((x, i) => {
        timber(`hall_joist_${i}`, 0.18, JOIST_HEIGHT, slabD, x, H - SLAB_THICKNESS - JOIST_HEIGHT / 2, (zFront + zBack) / 2)
    })

    // ── railing along the gallery's front ─────────────────────────────────────
    const railZ = zFront + RAIL_SIZE / 2
    buildRailing(timber, "hall_rail", railFrom, railTo, H, railZ)
    if(hasPhysics) collider("hall_rail_collider", beamLen, RAIL_COLLIDER_HEIGHT, 0.15, new Vector3((railFrom + railTo) / 2, H + RAIL_COLLIDER_HEIGHT / 2, railZ), scene)

    // ── the stairs ────────────────────────────────────────────────────────────
    const run   = H / STAIR_SLOPE
    const steps = Math.max(2, Math.round(H / STAIR_STEP_RISE))
    const rise  = H / steps
    const tread = run / steps
    const z0    = zFront - run                    // foot of the bottom step
    // solid timber blocks from the floor up, a plank tread on each with a
    // little nosing over the front
    for(let i = 0; i < steps; i++){
        const top = (i + 1) * rise
        const zMid = z0 + (i + 0.5) * tread
        timber(`hall_step_${i}`, stairW, top - TREAD_THICKNESS, tread, stairCX, (top - TREAD_THICKNESS) / 2, zMid)
        plank(`hall_tread_${i}`, stairW, TREAD_THICKNESS, tread + TREAD_NOSING, stairCX, top - TREAD_THICKNESS / 2, zMid - TREAD_NOSING / 2)
    }
    // a board down the open side, covering the steps' ends
    const slope = Math.atan2(H, run)
    const stringer = timber("hall_stringer", 0.08, 0.5, Math.hypot(run, H) + 0.3, stairInnerX - stairSide * 0.04, 0, 0)
    stringer.rotation.x = -slope
    stringer.position.set(stairInnerX - stairSide * 0.04, H / 2 + rise * 0.3, (z0 + zFront) / 2)
    // handrail up the open side: a newel at the foot, balusters, a raked rail
    const handX = stairInnerX - stairSide * 0.06
    timber("hall_newel", 0.2, RAIL_HEIGHT + 0.25, 0.2, handX, (RAIL_HEIGHT + 0.25) / 2, z0 + 0.15)
    const handrail = timber("hall_handrail", RAIL_SIZE, RAIL_SIZE, Math.hypot(run, H), handX, 0, 0)
    handrail.rotation.x = -slope
    handrail.position.set(handX, H / 2 + rise / 2 + RAIL_HEIGHT, (z0 + zFront) / 2)
    for(let z = z0 + 0.15 + BALUSTER_SPACING; z < zFront - 0.1; z += BALUSTER_SPACING){
        const stepTop = Math.min(H, Math.ceil((z - z0) / tread) * rise)
        const railY = (z - z0) * STAIR_SLOPE + rise / 2 + RAIL_HEIGHT
        timber(`hall_baluster_s_${Math.round(z * 100)}`, BALUSTER_SIZE, railY - stepTop, BALUSTER_SIZE, handX, (railY + stepTop) / 2, z)
    }

    if(hasPhysics){
        // the ramp you actually walk up: its top surface is the steps' nosing
        // line lifted half a rise, from where that meets the floor to where it
        // reaches the gallery
        const lift  = rise / 2
        const zLow  = z0 - lift / STAIR_SLOPE
        const zTop  = zFront - lift / STAIR_SLOPE
        const up     = new Vector3(0, Math.sin(slope), Math.cos(slope))
        const normal = new Vector3(0, Math.cos(slope), -Math.sin(slope))
        const mid    = new Vector3(stairCX, H / 2, (zLow + zTop) / 2)
        const rampPos = mid.subtract(normal.scale(RAMP_THICKNESS / 2)).subtract(up.scale(RAMP_UNDERRUN / 2))
        collider("hall_stair_ramp", stairW, RAMP_THICKNESS, Math.hypot(zTop - zLow, H) + RAMP_UNDERRUN, rampPos, scene, { rotation: new Vector3(-slope, 0, 0) })
        // level lip from the ramp's top to the gallery's edge
        collider("hall_stair_lip", stairW, SLAB_THICKNESS, zFront - zTop, new Vector3(stairCX, slabY, (zTop + zFront) / 2), scene)
        // handrail: a raked wall standing on the ramp's line along the open side
        const handPos = mid.add(normal.scale(RAIL_COLLIDER_HEIGHT / 2))
        handPos.x = stairInnerX - stairSide * 0.06
        collider("hall_stair_handrail", 0.12, RAIL_COLLIDER_HEIGHT, Math.hypot(zTop - zLow, H), handPos, scene, { rotation: new Vector3(-slope, 0, 0) })
        // closes off the space under the upper part of the stairs
        const zUnder = z0 + UNDER_STAIR_FROM / STAIR_SLOPE
        collider("hall_understair", stairW, 1.5, zFront - zUnder, new Vector3(stairCX, 0.75, (zUnder + zFront) / 2), scene)
    }

    // ── timber framing on the walls ───────────────────────────────────────────
    // pilasters stand proud of the walls you walk along (the gallery's north
    // wall above all), so they're solid too
    const pilaster = (n, w, h, d, x, y, z) => {
        timber(n, w, h, d, x, y, z)
        if(hasPhysics) collider(`${n}_collider`, w, h, d, new Vector3(x, y, z), scene, { passThrough: false })
    }
    buildWallFrame(timber, pilaster, { xMin, xMax, zBack, zMin: -halfH + WALL_INSET, H, wallHeight: room.wallHeight, stairSide, optionalObjects })

    const hall = Mesh.MergeMeshes([...planks.map(m => { m.material = mats.plank; return m }), ...timbers.map(m => { m.material = mats.timber; return m })], true, true, undefined, false, true)
    hall.name = `${name}_hall`
    hall.freezeWorldMatrix()
    return hall
}

// a run of railing at floor level `y`, from x0 to x1 along z
function buildRailing(timber, name, x0, x1, y, z){
    const len = x1 - x0
    const cx = (x0 + x1) / 2
    timber(`${name}_top`, len, RAIL_SIZE, RAIL_SIZE, cx, y + RAIL_HEIGHT, z)
    timber(`${name}_bottom`, len, RAIL_SIZE * 0.8, RAIL_SIZE * 0.8, cx, y + 0.12, z)
    spread(x0, x1, POST_SPACING).forEach((x, i) => {
        timber(`${name}_newel_${i}`, 0.18, RAIL_HEIGHT + 0.15, 0.18, x, y + (RAIL_HEIGHT + 0.15) / 2, z)
    })
    const n = Math.floor(len / BALUSTER_SPACING)
    for(let i = 1; i < n; i++){
        timber(`${name}_baluster_${i}`, BALUSTER_SIZE, RAIL_HEIGHT - 0.12, BALUSTER_SIZE, x0 + len * i / n, y + 0.12 + (RAIL_HEIGHT - 0.12) / 2, z)
    }
}

// Pilasters up the walls and a beam band round them at the gallery's level -
// the hall's frame. Pilasters keep clear of doors (any optionalObjects glb
// with "door" in its path) and of the stairs' wall; the band is visual only,
// it sits at the gallery's level, out of reach from the floor.
function buildWallFrame(timber, pilaster, { xMin, xMax, zBack, zMin, H, wallHeight = 3.5, stairSide, optionalObjects }){
    const doors = optionalObjects
        .filter(o => o.glbPath?.includes("door"))
        .map(o => o.position)
    const clearOfDoors = (x, z) => !doors.some(d => Math.hypot(d.x - x, d.z - z) < PILASTER_DOOR_CLEARANCE)
    const bandY = H - SLAB_THICKNESS / 2
    const half = PILASTER_SIZE / 2

    // south wall: pilasters + band; north wall: band only above the gallery's
    // floor is hidden by it, so just pilasters below it
    spread(xMin + half, xMax - half, PILASTER_SPACING).forEach((x, i) => {
        if(clearOfDoors(x, zMin)) pilaster(`hall_pil_s_${i}`, PILASTER_SIZE, wallHeight, PILASTER_SIZE, x, wallHeight / 2, zMin + half)
        if(clearOfDoors(x, zBack)) pilaster(`hall_pil_n_${i}`, PILASTER_SIZE, wallHeight, PILASTER_SIZE, x, wallHeight / 2, zBack - half)
    })
    timber("hall_band_s", xMax - xMin, BAND_HEIGHT, BAND_DEPTH, (xMin + xMax) / 2, bandY, zMin + BAND_DEPTH / 2)
    // east/west walls - the stairs' wall keeps its band (it reads as the
    // stair's top rail line) but no pilasters behind the steps
    ;[[xMax, "e", 1], [xMin, "w", -1]].forEach(([x, tag, side]) => {
        const inner = x - side * half
        spread(zMin + half, zBack - half, PILASTER_SPACING).forEach((z, i) => {
            if(side === stairSide) return
            if(clearOfDoors(inner, z)) pilaster(`hall_pil_${tag}_${i}`, PILASTER_SIZE, wallHeight, PILASTER_SIZE, inner, wallHeight / 2, z)
        })
        timber(`hall_band_${tag}`, BAND_DEPTH, BAND_HEIGHT, zBack - zMin, x - side * BAND_DEPTH / 2, bandY, (zMin + zBack) / 2)
    })
}

// Torches on the walls, each with createFireParticles' flame and flickering
// warm light (tools/lightBudget.js keeps only the nearest few lit, so a hall
// can have as many as looks right). { wall: "n"|"s"|"e"|"w", along, y }:
// `along` is x on the north/south walls, z on the east/west ones.
export async function placeWallTorches(scene, room){
    const torches = room.wallTorches
    if(!torches?.length) return

    const halfW = (room.width ?? 7) / 2
    const halfH = (room.height ?? 10) / 2
    let master
    try {
        master = await mergeAndLoadModel(TORCH_GLB, scene)
    } catch (error) {
        return console.warn("[roomHall] wall torch failed to load", error)
    }
    master.isVisible = false
    master.isPickable = false

    // the torch model sticks out along its own -z; per wall: where its face
    // is, which way is out of it, and the yaw that points -z that way
    const walls = {
        n: { at: a => new Vector3(a, 0,  halfH - WALL_INSET), out: new Vector3(0, 0, -1), yaw: 0 },
        s: { at: a => new Vector3(a, 0, -halfH + WALL_INSET), out: new Vector3(0, 0,  1), yaw: Math.PI },
        e: { at: a => new Vector3( halfW - WALL_INSET, 0, a), out: new Vector3(-1, 0, 0), yaw: Math.PI / 2 },
        w: { at: a => new Vector3(-halfW + WALL_INSET, 0, a), out: new Vector3( 1, 0, 0), yaw: -Math.PI / 2 },
    }
    torches.forEach(({ wall, along, y = 2.2 }, i) => {
        const w = walls[wall]
        if(!w) return console.warn(`[roomHall] torch ${i}: unknown wall "${wall}"`)
        const mount = w.at(along)
        mount.y = y
        const torch = master.createInstance(`${room.name}_torch_${i}`)
        torch.position.copyFrom(mount)
        torch.rotation.y = w.yaw
        torch.isPickable = false
        torch.freezeWorldMatrix()
        const flame = mount.add(w.out.scale(TORCH_FLAME_OUT))
        flame.y += TORCH_FLAME_UP - 0.25   // createFireParticles puts the flame 0.25 above the point
        createFireParticles(flame, scene, TORCH_LIGHT)
    })
}
