import { MeshBuilder, Mesh, StandardMaterial, Texture, Color3, Vector3, Vector4, Matrix, TransformNode, LoadAssetContainerAsync } from "@babylonjs/core"
import { createAggregate } from "../tools/physics.js"
import { createFireParticles } from "../tools/particlesystem.js"
import { mergeAndLoadModel } from "../tools/loadmodel.js"
import { sampleTerrainSurfaceHeight, roadDistance } from "infterrain"
import { OPENWORLD_TERRAIN_VERTS } from "../constants/constants.js"

// A procedural medieval castle for the openworld's uneven terrain, entirely
// MeshBuilder primitives - no glb. Every castle is rolled from its own seed
// (constants/castles.js), so each one looks different but is the same on
// every client and every load.
//
// Uneven ground: the castle stands on a masonry TERRACE whose top (the
// courtyard, `platformY`) is the highest ground anywhere under the walls, plus
// a little - so terrain can never poke up through the courtyard - and whose
// sides reach down past the lowest ground under it. On a slope that reads as
// a castle built up on a stone platform: tall foundation on the low side,
// almost buried on the high side. Anything sticking out past the terrace
// (corner/gate towers, bastions) gets its own foundation down to the ground
// under it. The gate gets a stepped stone ramp down to wherever the ground
// in front of it meets it, and faces the nearest road (or a given point).
//
// Walls are thick enough to walk on, with a parapet along the outside edge,
// and stone stairs climb the inside faces up to them. On the gate's axis
// stands the palace - front door, hallway, throne room with the throne on a
// dais (buildPalace) - with the keep, a tall tower, against its side; the
// castle is sized to fit them. The player's physics
// body is a box with no step-up (anything over ~0.04 stops it), so every
// staircase is visual steps over one invisible ramp collider - same as the
// dungeon's boss stairs (createdungeon.js buildBossStairs) - at a slope the
// body can walk up (0.55 rise per run, ~29 degrees).
//
// Rendering vs physics: the visible pieces are all merged into ONE mesh per
// castle (one draw call per material) and their sources disposed. Collision
// is a separate, smaller set of invisible static boxes - a wall run, a
// parapet run, a tower, a ramp - not one per merlon or step. Each box is
// built at its final world pose before its aggregate is made: a static
// PhysicsBody bakes its pose once and never re-syncs (physicsBody.js
// disableSync), so nothing here is built at the origin and moved later.
// Havok's "mesh" shape doesn't collide in this build (areascene.js), hence
// boxes throughout.

const PLATFORM_LIFT = 0.3       // courtyard above the highest ground under the walls
const BERM = 3.5                // terrace past the walls' outer faces
const PARAPET_T = 0.7           // breastwork thickness
const PARAPET_H = 1.0           // breastwork height
const MERLON_H = 0.9
const MERLON_W = 0.9
const MERLON_STEP = 1.9
const STAIR_W = 2.6
const STAIR_SLOPE = 0.55        // rise per run - the player's box climbs up to ~0.65
const RAMP_SLOPE = 0.5          // the gate's ramp down to the ground
const STEP_RISE = 0.38
const LANDING = 2.8
const RAMP_T = 0.4              // invisible ramp collider thickness
const RAMP_UNDER = 0.6          // ramp collider run sunk past the bottom step
const TEX = 4                   // world units per stone texture repeat

// the palace
const PALACE_WALL = 1.2
const FRONT_YARD = 20           // gate to palace door, at least
const BACK_GAP = 7              // palace to the back wall - room for the stairs there
const DAIS_H = 0.9
const DAIS_D = 4.5
const DAIS_SLOPE = 0.5
const THRONE_GLB = "./models/indors/thrones.glb"
const THRONE_HEIGHT = 3.2       // the model is scaled to this, whatever size it comes in
// added to the castle's yaw - the throne should face the door down the room
// (local -z). glTF models in this project face -z (standingwolf.glb does);
// flip this to Math.PI if thrones.glb turns out to face the back wall
const THRONE_YAW = 0
const TORCH_GLB = "./models/indors/wallTorch.glb"
const TORCH_FLAME_UP = 0.3      // flame above / out from the torch's mount (roomHall.js)
const TORCH_FLAME_OUT = 0.22
const TORCH_LIGHT = { intensity: 2, range: 13 }
const FLAMES_NEAR = 110         // torch flames only burn with the camera this close

// hue, not darkness - rockTex is already dark under the openworld's dim light
const STONE_TINTS = [[1, 1, 1], [1, 0.93, 0.82], [0.9, 0.93, 1], [0.92, 1, 0.88], [1, 0.97, 0.92]]
const ROOFS = [
    { tex: "roof1.jpg" }, { tex: "roof2.jpg" },
    { color: [0.36, 0.08, 0.08] }, { color: [0.16, 0.22, 0.38] }, { color: [0.18, 0.32, 0.18] }, { color: [0.26, 0.17, 0.11] },
]
// no black - hung on the throne room's dark walls, it read as a hole in them
const BANNERS = [[0.72, 0.08, 0.08], [0.1, 0.2, 0.62], [0.86, 0.64, 0.1], [0.84, 0.82, 0.76], [0.12, 0.46, 0.16], [0.42, 0.1, 0.52]]

// ── seeded randomness ─────────────────────────────────────────────────────────

function hashSeed(seed){
    let h = 2166136261
    for(const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
    return h >>> 0
}
// mulberry32
function seededRandom(seed){
    let a = hashSeed(seed)
    return () => {
        a = (a + 0x6D2B79F5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

// Everything that makes one castle look unlike another. Rolled in a fixed
// order, then `look` (constants/castles.js) overrides any of it - overriding
// one value never reshuffles the others.
function rollLayout(rand, look = {}){
    const r = (a, b) => a + rand() * (b - a)
    const pick = arr => arr[Math.floor(rand() * arr.length)]
    return {
        hx: r(26, 33), hz: r(26, 33),           // half extents, to the wall centrelines
        wallH: r(9, 11), wallT: r(5, 5.6),
        towerShape: pick(["round", "round", "square"]),
        towerR: r(4.6, 6), towerRise: r(5, 9),
        roof: pick(["pointed", "pointed", "flat"]),
        roofLift: r(0.85, 1.35),
        gateW: r(8, 10.5), gateH: r(6.2, 7.5),
        gateTowerR: r(3.6, 4.4), gateTowerRise: r(3, 6),
        bastionR: r(3.2, 3.8), bastionRise: r(2, 4),
        // the keep: a tall tower standing beside the palace, on towerSide
        keepShape: pick(["square", "square", "round"]),
        keepSize: r(7, 9.5), keepH: r(24, 32),
        keepRoof: pick(["pointed", "pointed", "flat"]),
        keepTurrets: rand() < 0.6,
        towerSide: rand() < 0.5 ? -1 : 1,
        // the palace: front door, hallway, throne room (inside sizes)
        throneW: r(16, 21), throneD: r(20, 25), throneH: r(9, 11.5),
        hallW: r(5, 6), hallL: r(10, 13), hallH: r(6.5, 7.5),
        palaceRoof: pick(["hip", "hip", "flat"]),
        halls: Math.floor(r(1, 3.99)),
        well: rand() < 0.65,
        stone: Math.floor(rand() * STONE_TINTS.length),
        roofLook: Math.floor(rand() * ROOFS.length),
        banner: Math.floor(rand() * BANNERS.length),
        yawJitter: r(-0.2, 0.2),
        ...look,
    }
}

// ── materials (cached per scene, shared between castles) ─────────────────────

let matCache = null
function cacheFor(scene){
    if(matCache?.scene !== scene) matCache = { scene, textures: new Map(), mats: new Map() }
    return matCache
}
function getMat(scene, key, build){
    const { mats } = cacheFor(scene)
    if(!mats.has(key)) mats.set(key, build())
    return mats.get(key)
}
function getTex(scene, file){
    const { textures } = cacheFor(scene)
    if(!textures.has(file)) textures.set(file, new Texture(`./images/modeltex/${file}`, scene))
    return textures.get(file)
}
function texturedMat(scene, key, file, tint){
    return getMat(scene, key, () => {
        const mat = new StandardMaterial(key, scene)
        mat.diffuseTexture = getTex(scene, file)
        if(tint) mat.diffuseColor = new Color3(...tint)
        mat.specularColor = new Color3(0, 0, 0)
        return mat
    })
}
function colorMat(scene, key, color, twoSided = false){
    return getMat(scene, key, () => {
        const mat = new StandardMaterial(key, scene)
        mat.diffuseColor = new Color3(...color)
        mat.specularColor = new Color3(0.04, 0.04, 0.04)
        mat.backFaceCulling = !twoSided
        return mat
    })
}
function castleMaterials(scene, L){
    const roof = ROOFS[L.roofLook]
    return {
        stone: texturedMat(scene, `castleStone${L.stone}`, "rockTex.jpg", STONE_TINTS[L.stone]),
        foundation: texturedMat(scene, "castleFoundation", "rock2.jpg", [0.7, 0.68, 0.64]),
        paving: texturedMat(scene, "castlePaving", "tile7.jpg"),
        wood: texturedMat(scene, "castleWood", "gate1.jpg"),
        roof: roof.tex ? texturedMat(scene, `castleRoof${L.roofLook}`, roof.tex) : colorMat(scene, `castleRoof${L.roofLook}`, roof.color),
        dark: colorMat(scene, "castleDark", [0.04, 0.04, 0.05]),
        banner: colorMat(scene, `castleBanner${L.banner}`, BANNERS[L.banner], true),
        // the palace's insides
        floor: texturedMat(scene, "castleHallFloor", "stonefloor.jpg"),
        ceiling: texturedMat(scene, "castleCeiling", "planks.jpg", [0.8, 0.7, 0.6]),
        pillar: texturedMat(scene, "castlePillar", "pillartex1.webp"),
        carpet: getMat(scene, "castleCarpet", () => {
            const mat = texturedMat(scene, "castleCarpetBase", "carpet2.jpg", [0.85, 0.3, 0.3])
            // a hair above the floor - won the depth test against it by a bias, not a gap
            mat.zOffset = -2
            return mat
        }),
        glass: getMat(scene, "castleGlass", () => {
            const mat = new StandardMaterial("castleGlass", scene)
            mat.diffuseColor = new Color3(0.5, 0.58, 0.68)
            mat.emissiveColor = new Color3(0.42, 0.5, 0.62)
            mat.specularColor = new Color3(0.2, 0.2, 0.2)
            return mat
        }),
    }
}

// ── building blocks, in castle-local coordinates ─────────────────────────────
// Local +z points from the gate to the back wall; local x across. y is always
// a real world height. ctx turns local (x, z) into the world, yawed so the
// gate faces where it should.

function makeCtx(scene, name, origin, yaw, hasPhysics){
    const cos = Math.cos(yaw), sin = Math.sin(yaw)
    const toWorld = (lx, lz) => ({ x: origin.x + lx * cos + lz * sin, z: origin.z - lx * sin + lz * cos })
    return {
        scene, name, yaw, hasPhysics, toWorld,
        visuals: [], colliders: [],
        // walkable patches for castleSurfaceY: local rects, flat (y) or
        // sloping along an axis (y0 + slope * distance along it from a0)
        surfaces: [],
        ground: (lx, lz) => {
            const w = toWorld(lx, lz)
            return sampleTerrainSurfaceHeight(w.x, w.z, OPENWORLD_TERRAIN_VERTS)
        },
    }
}

// lowest/highest ground over a local rectangle, edges included
function groundRange(ctx, x0, x1, z0, z1, step = 2){
    let min = Infinity, max = -Infinity
    const nx = Math.max(1, Math.ceil((x1 - x0) / step)), nz = Math.max(1, Math.ceil((z1 - z0) / step))
    for(let i = 0; i <= nx; i++) for(let j = 0; j <= nz; j++){
        const h = ctx.ground(x0 + (x1 - x0) * i / nx, z0 + (z1 - z0) * j / nz)
        if(h < min) min = h
        if(h > max) max = h
    }
    return { min, max }
}

function place(ctx, mesh, lx, y, lz, localYaw = 0, pitch = 0){
    const w = ctx.toWorld(lx, lz)
    mesh.position.set(w.x, y, w.z)
    mesh.rotation.set(pitch, ctx.yaw + localYaw, 0)
    return mesh
}

// a box whose texture repeats every `tex` world units on every face, instead
// of stretching one repeat across a face of any size (wrap: sides upright)
function makeBox(ctx, w, h, d, mat, tex = TEX){
    const uv = (a, b) => new Vector4(0, 0, a / tex, b / tex)
    const box = MeshBuilder.CreateBox(`${ctx.name}_part`, {
        width: w, height: h, depth: d, wrap: true,
        faceUV: [uv(w, h), uv(w, h), uv(d, h), uv(d, h), uv(w, d), uv(w, d)],
    }, ctx.scene)
    box.material = mat
    return box
}
function makeCylinder(ctx, dTop, dBottom, h, tessellation, mat, tex = TEX){
    const d = Math.max(dTop, dBottom)
    const cyl = MeshBuilder.CreateCylinder(`${ctx.name}_part`, {
        diameterTop: dTop, diameterBottom: dBottom, height: h, tessellation,
        faceUV: [new Vector4(0, 0, d / tex, d / tex), new Vector4(0, 0, Math.PI * d / tex, h / tex), new Vector4(0, 0, d / tex, d / tex)],
    }, ctx.scene)
    cyl.material = mat
    return cyl
}

function visual(ctx, mesh, lx, y, lz, localYaw = 0, pitch = 0){
    place(ctx, mesh, lx, y, lz, localYaw, pitch)
    ctx.visuals.push(mesh)
    return mesh
}
function collider(ctx, w, h, d, lx, y, lz, localYaw = 0, pitch = 0){
    if(!ctx.hasPhysics) return
    const box = MeshBuilder.CreateBox(`${ctx.name}_collider`, { width: w, height: h, depth: d }, ctx.scene)
    place(ctx, box, lx, y, lz, localYaw, pitch)
    box.isVisible = false
    box.isPickable = false
    createAggregate(box, { mass: 0 }, "box", ctx.scene)
    box.freezeWorldMatrix()
    ctx.colliders.push(box)
}
// a box you can see and bump into
function solid(ctx, w, h, d, lx, y, lz, mat, localYaw = 0){
    visual(ctx, makeBox(ctx, w, h, d, mat), lx, y, lz, localYaw)
    collider(ctx, w, h, d, lx, y, lz, localYaw)
}

// pieces laid along one of the local axes: `a` is the coordinate along it,
// `perp` the other one
const alongXZ = (axis, a, perp) => axis === "x" ? [a, perp] : [perp, a]
const alongWD = (axis, len, wid) => axis === "x" ? [len, wid] : [wid, len]
// the local rect spanning a1..a2 along `axis`, `width` wide around `perp`
function rectAlong(axis, a1, a2, perp, width){
    const [x1, z1] = alongXZ(axis, Math.min(a1, a2), perp - width / 2)
    const [x2, z2] = alongXZ(axis, Math.max(a1, a2), perp + width / 2)
    return { x0: x1, x1: x2, z0: z1, z1: z2 }
}

// One straight flight of stairs climbing `rise` from y0, starting at `a0`
// along `axis` and going `dir` (+1/-1). Visible steps are solid from `base`
// up; underneath, the invisible ramp is what's actually walked on. Under the
// ramp, short blocks fill the space so nobody walks into the stairs from the
// side - each topped below the ramp, with too little headroom left above it
// for the player's body. An optional flat landing at the top.
function flight(ctx, mat, f){
    const { axis, a0, dir, perp, width, y0, rise, base } = f
    const run = rise / f.slope
    const count = Math.max(1, Math.ceil(rise / STEP_RISE))
    const tread = run / count
    for(let i = 0; i < count; i++){
        const top = y0 + (i + 1) * rise / count
        const [w, d] = alongWD(axis, tread, width)
        const [x, z] = alongXZ(axis, a0 + dir * (i + 0.5) * tread, perp)
        visual(ctx, makeBox(ctx, w, top - base, d, mat), x, (top + base) / 2, z)
    }
    if(f.landing){
        const [w, d] = alongWD(axis, f.landing, width)
        const [x, z] = alongXZ(axis, a0 + dir * (run + f.landing / 2), perp)
        solid(ctx, w, y0 + rise - base, d, x, (y0 + rise + base) / 2, z, mat)
        ctx.surfaces.push({ ...rectAlong(axis, a0 + dir * run, a0 + dir * (run + f.landing), perp, width), y: y0 + rise })
    }
    ctx.surfaces.push({ ...rectAlong(axis, a0, a0 + dir * run, perp, width), axis, a0, dir, y0, slope: f.slope, top: y0 + rise })

    // the ramp: its top face runs from (a0, y0) to (a0 + dir*run, y0 + rise).
    // Box local +z points up the slope - yawed onto the flight's direction,
    // pitched up by -angle - then pushed down half its thickness and back
    // half its underrun so the TOP face is the one on that line.
    const ux = axis === "x" ? dir : 0, uz = axis === "z" ? dir : 0
    const angle = Math.atan2(rise, run)
    const upAlong = Math.cos(angle), upY = Math.sin(angle)
    const [mx, mz] = alongXZ(axis, a0 + dir * run / 2, perp)
    const shiftAlong = Math.sin(angle) * RAMP_T / 2 - upAlong * RAMP_UNDER / 2
    collider(ctx, width, RAMP_T, Math.hypot(run, rise) + RAMP_UNDER,
        mx + ux * shiftAlong, y0 + rise / 2 - Math.cos(angle) * RAMP_T / 2 - upY * RAMP_UNDER / 2, mz + uz * shiftAlong,
        Math.atan2(ux, uz), -angle)

    for(let s = 2; s < run; s += 2){
        const len = Math.min(2, run - s)
        const top = y0 + s * f.slope - 0.1
        const [w, d] = alongWD(axis, len, width)
        const [x, z] = alongXZ(axis, a0 + dir * (s + len / 2), perp)
        collider(ctx, w, top - base, d, x, (top + base) / 2, z)
    }
    return run + (f.landing ?? 0)
}

// a ring of merlons around the top of a round piece / along a square one's edges
function merlonRing(ctx, mat, shape, cx, cz, r, y){
    if(shape === "round"){
        const n = Math.max(6, Math.floor(2 * Math.PI * (r - PARAPET_T / 2) / MERLON_STEP))
        for(let i = 0; i < n; i++){
            const a = i / n * Math.PI * 2
            visual(ctx, makeBox(ctx, MERLON_W, MERLON_H, PARAPET_T, mat),
                cx + Math.sin(a) * (r - PARAPET_T / 2), y + MERLON_H / 2, cz + Math.cos(a) * (r - PARAPET_T / 2), a)
        }
        return
    }
    const n = Math.max(2, Math.floor(2 * r / MERLON_STEP))
    for(let side = 0; side < 4; side++){
        for(let i = 0; i < n; i++){
            const t = -r + (i + 0.5) * 2 * r / n
            const e = r - PARAPET_T / 2
            const [x, z] = [[t, e], [e, -t], [-t, -e], [-e, t]][side]
            visual(ctx, makeBox(ctx, MERLON_W, MERLON_H, PARAPET_T, mat), cx + x, y + MERLON_H / 2, cz + z, side * Math.PI / 2)
        }
    }
}

// a pointed roof (cone on round, pyramid on square) or a crenellated flat top.
// Nobody can climb up there - the colliders are for the camera's spring arm
// (camera.js), which only stops at physics bodies: without them it swung
// straight into a roof and showed it from the inside.
function topOff(ctx, mats, shape, roof, cx, cz, r, y, lift){
    if(roof === "flat"){
        const band = 1.1
        const body = shape === "round"
            ? makeCylinder(ctx, 2 * r + 0.6, 2 * r + 0.6, band, 20, mats.stone)
            : makeBox(ctx, 2 * r + 0.6, band, 2 * r + 0.6, mats.stone)
        visual(ctx, body, cx, y + band / 2, cz)
        merlonRing(ctx, mats.stone, shape, cx, cz, r + 0.3, y + band)
        collider(ctx, 2 * r + 0.6, band + MERLON_H, 2 * r + 0.6, cx, y + (band + MERLON_H) / 2, cz)
        return y + band + MERLON_H
    }
    const h = r * 1.6 * lift
    const cone = shape === "round"
        ? makeCylinder(ctx, 0, 2 * r * 1.18, h, 20, mats.roof, 3)
        : makeCylinder(ctx, 0, 2 * r * Math.SQRT2 * 1.1, h, 4, mats.roof, 3)
    visual(ctx, cone, cx, y + h / 2, cz, shape === "round" ? 0 : Math.PI / 4)
    // two stacked boxes around it, each as wide as the roof at its own
    // bottom - outside the slope, so the camera stops short of it, not in it
    const half = shape === "round" ? r * 1.18 : r * 1.1
    collider(ctx, 2 * half, h / 2, 2 * half, cx, y + h / 4, cz)
    collider(ctx, half, h / 2, half, cx, y + h * 3 / 4, cz)
    return y + h
}

// a hip roof over a w x d rectangle: a 4-sided cone turned square to the
// axes, then stretched to the rectangle (baked - a rotated mesh can't be
// scaled along the world's axes otherwise)
function makeHipRoof(ctx, w, d, h, mat){
    const roof = MeshBuilder.CreateCylinder(`${ctx.name}_part`, {
        diameterTop: 0, diameterBottom: Math.SQRT2, height: h, tessellation: 4,
        faceUV: [new Vector4(0, 0, 1, 1), new Vector4(0, 0, 2 * (w + d) / 3, h * 1.3 / 3), new Vector4(0, 0, 1, 1)],
    }, ctx.scene)
    roof.bakeTransformIntoVertices(Matrix.RotationY(Math.PI / 4).multiply(Matrix.Scaling(w, 1, d)))
    roof.refreshBoundingInfo()
    roof.material = mat
    return roof
}

// merlons along the edges of a w x d rectangle centred at (cx, cz)
function merlonRect(ctx, mat, cx, cz, w, d, y){
    ;[["x", w, d], ["z", d, w]].forEach(([axis, len, across]) => {
        const n = Math.max(2, Math.floor(len / MERLON_STEP))
        ;[-1, 1].forEach(side => {
            for(let i = 0; i < n; i++){
                const a = -len / 2 + (i + 0.5) * len / n
                const [mw, md] = alongWD(axis, MERLON_W, PARAPET_T)
                const [mx, mz] = alongXZ(axis, a, side * (across / 2 - PARAPET_T / 2))
                visual(ctx, makeBox(ctx, mw, MERLON_H, md, mat), cx + mx, y + MERLON_H / 2, cz + mz)
            }
        })
    })
}

// the palace wings' roofs: a hip roof, or a crenellated flat top. Colliders
// for the camera, as in topOff.
function roofOver(ctx, mats, style, cx, cz, w, d, y){
    if(style === "flat"){
        const band = 1.1
        visual(ctx, makeBox(ctx, w + 0.6, band, d + 0.6, mats.stone), cx, y + band / 2, cz)
        merlonRect(ctx, mats.stone, cx, cz, w + 0.6, d + 0.6, y + band)
        collider(ctx, w + 0.6, band + MERLON_H, d + 0.6, cx, y + (band + MERLON_H) / 2, cz)
        return
    }
    const h = Math.min(w, d) * 0.42
    visual(ctx, makeHipRoof(ctx, w + 0.8, d + 0.8, h, mats.roof), cx, y + h / 2, cz)
    collider(ctx, w + 0.8, h / 2, d + 0.8, cx, y + h / 4, cz)
    collider(ctx, (w + 0.8) / 2, h / 2, (d + 0.8) / 2, cx, y + h * 3 / 4, cz)
}

// A tower from its foundation (`base`, down in the ground) to `top`, roofed.
// Collides as a box.
function tower(ctx, mats, t){
    const { lx, lz, r, shape, base, top } = t
    const body = shape === "round"
        ? makeCylinder(ctx, 2 * r, 2 * r, top - base, 20, mats.stone)
        : makeBox(ctx, 2 * r, top - base, 2 * r, mats.stone)
    visual(ctx, body, lx, (top + base) / 2, lz)
    collider(ctx, 2 * r, top - base, 2 * r, lx, (top + base) / 2, lz)
    // arrow slits, half sunk into the face - mid-face on a square tower
    for(let i = 0; i < 4; i++){
        const a = i * Math.PI / 2 + (shape === "round" ? Math.PI / 4 : 0)
        visual(ctx, makeBox(ctx, 0.45, 1.6, 0.3, mats.dark), lx + Math.sin(a) * r, top - 3, lz + Math.cos(a) * r, a)
    }
    return topOff(ctx, mats, shape, t.roof, lx, lz, r, top, t.lift ?? 1)
}

// the foundation for something round/square of radius r centred at (lx, lz)
const footBase = (ctx, lx, lz, r, platformY) =>
    Math.min(platformY, groundRange(ctx, lx - r, lx + r, lz - r, lz + r, 1.5).min - 1)

const overlaps = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1

// ── the palace ────────────────────────────────────────────────────────────────
// Front door -> hallway -> throne room, walkable inside. Every wall is its own
// slab - a box seen from inside shows nothing, its faces all point out - and
// every floor is at courtyard height, so no doorway has a step the player's
// box can't get over. Ceilings collide, so the camera's spring arm stays under
// them. The throne room: two rows of pillars, a carpet from the front door,
// tall windows, torches, banners, and a dais at the back whose steps are
// visual over an invisible ramp, like every stair here; the throne itself is
// a model (furnish, below).
// p: zh0 (palace door), zr0 (throne room's front), zr1 (its back) - outside
// faces, castle-local. Returns where the throne and the torches go.
function buildPalace(ctx, mats, L, y0, p){
    const { zh0, zr0, zr1 } = p
    const PW = PALACE_WALL
    const TWo = L.throneW + 2 * PW, HWo = L.hallW + 2 * PW
    const roomTop = L.throneH + 0.6, hallTop = L.hallH + 0.6      // walls, ceiling slab included
    const roomZ = (zr0 + zr1) / 2, hallZ = zh0 + PW + L.hallL / 2
    const wall = (w, h, d, x, z, base = y0) => solid(ctx, w, h, d, x, base + h / 2, z, mats.stone)
    const torches = []
    // out: the way the torch points, into the room
    const torch = (lx, y, lz, ox, oz) => torches.push({ lx, y, lz, ox, oz })

    // floors - the courtyard paving stops at the palace walls, so these don't
    // sit coplanar with it
    visual(ctx, makeBox(ctx, TWo, 0.2, zr1 - zr0, mats.floor, 3), 0, y0 - 0.08, roomZ)
    visual(ctx, makeBox(ctx, HWo, 0.2, zr0 - zh0, mats.floor, 3), 0, y0 - 0.08, (zh0 + zr0) / 2)

    // ── the throne room's shell, open onto the hallway at the front
    wall(TWo, roomTop, PW, 0, zr1 - PW / 2)
    ;[-1, 1].forEach(s => wall(PW, roomTop, L.throneD, s * (TWo / 2 - PW / 2), roomZ))
    const sideW = (TWo - L.hallW) / 2
    ;[-1, 1].forEach(s => wall(sideW, roomTop, PW, s * (L.hallW / 2 + sideW / 2), zr0 + PW / 2))
    wall(L.hallW, roomTop - L.hallH, PW, 0, zr0 + PW / 2, y0 + L.hallH)
    solid(ctx, L.throneW, 0.6, L.throneD, 0, y0 + L.throneH + 0.3, roomZ, mats.ceiling)
    roofOver(ctx, mats, L.palaceRoof, 0, roomZ, TWo, zr1 - zr0, y0 + roomTop)

    // ── the hallway's shell, the front door in its front wall
    ;[-1, 1].forEach(s => wall(PW, hallTop, L.hallL, s * (HWo / 2 - PW / 2), hallZ))
    const doorW = Math.min(3.4, L.hallW - 1.2), doorH = 4.6
    const doorSideW = (HWo - doorW) / 2
    ;[-1, 1].forEach(s => wall(doorSideW, hallTop, PW, s * (doorW / 2 + doorSideW / 2), zh0 + PW / 2))
    wall(doorW, hallTop - doorH, PW, 0, zh0 + PW / 2, y0 + doorH)
    solid(ctx, L.hallW, 0.6, L.hallL, 0, y0 + L.hallH + 0.3, hallZ, mats.ceiling)
    roofOver(ctx, mats, L.palaceRoof, 0, (zh0 + zr0) / 2, HWo, zr0 - zh0, y0 + hallTop)
    // the door's leaves, swung open into the hallway
    ;[-1, 1].forEach(s => {
        visual(ctx, makeBox(ctx, 0.2, doorH, doorW / 2, mats.wood, doorH), s * (doorW / 2 - 0.1), y0 + doorH / 2, zh0 + PW + doorW / 4)
    })
    // pilasters down the hallway, a torch either side between them
    ;[0.25, 0.75].forEach(t => [-1, 1].forEach(s => wall(0.4, L.hallH, 0.9, s * (L.hallW / 2 - 0.2), zh0 + PW + L.hallL * t)))
    ;[-1, 1].forEach(s => torch(s * L.hallW / 2, y0 + 3, hallZ, -s, 0))

    // ── the dais against the back wall, steps up its front
    const daisBack = zr1 - PW
    const daisFront = daisBack - DAIS_D
    const daisW = Math.min(L.throneW - 7, 11)
    const stepsRun = DAIS_H / DAIS_SLOPE
    solid(ctx, daisW, DAIS_H + 0.2, DAIS_D, 0, y0 - 0.2 + (DAIS_H + 0.2) / 2, daisFront + DAIS_D / 2, mats.stone)
    ctx.surfaces.push({ x0: -daisW / 2, x1: daisW / 2, z0: daisFront, z1: daisBack, y: y0 + DAIS_H })
    flight(ctx, mats.stone, { axis: "z", a0: daisFront - stepsRun, dir: 1, perp: 0, width: daisW,
        y0, rise: DAIS_H, slope: DAIS_SLOPE, base: y0 - 0.2 })

    // the carpet, front door to the dais steps, and a rug under the throne
    const carpetFrom = zh0 + PW, carpetTo = daisFront - stepsRun
    visual(ctx, makeBox(ctx, 2.4, 0.03, carpetTo - carpetFrom, mats.carpet, 3), 0, y0 + 0.035, (carpetFrom + carpetTo) / 2)
    visual(ctx, makeBox(ctx, 4.4, 0.03, 3.4, mats.carpet, 3), 0, y0 + DAIS_H + 0.015, daisBack - 1.9)

    // ── two rows of pillars down the room
    const pillarX = L.throneW / 2 - 2.4
    const pz0 = zr0 + PW + 3, pz1 = daisFront - stepsRun - 1.5
    const pillars = Math.max(2, Math.floor((pz1 - pz0) / 5) + 1)
    const pillarZ = i => pz0 + i * (pz1 - pz0) / (pillars - 1)
    for(let i = 0; i < pillars; i++){
        ;[-1, 1].forEach(s => {
            const x = s * pillarX, z = pillarZ(i)
            visual(ctx, makeCylinder(ctx, 1.3, 1.3, L.throneH, 16, mats.pillar, 3), x, y0 + L.throneH / 2, z)
            visual(ctx, makeBox(ctx, 1.8, 0.5, 1.8, mats.stone), x, y0 + 0.25, z)
            visual(ctx, makeBox(ctx, 1.7, 0.45, 1.7, mats.stone), x, y0 + L.throneH - 0.225, z)
            collider(ctx, 1.8, L.throneH, 1.8, x, y0 + L.throneH / 2, z)
        })
    }
    // between the pillars: a tall window high in each side wall (through it -
    // seen from in and out), and a torch under it in every other gap
    for(let i = 0; i < pillars - 1; i++){
        const z = (pillarZ(i) + pillarZ(i + 1)) / 2
        ;[-1, 1].forEach(s => {
            visual(ctx, makeBox(ctx, PW + 0.08, 3.2, 1.1, mats.glass), s * (TWo / 2 - PW / 2), y0 + L.throneH - 2.8, z)
            if(i % 2 === 0) torch(s * L.throneW / 2, y0 + 3.4, z, -s, 0)
        })
    }

    // behind the throne: a great banner, one either side, a torch beyond each
    visual(ctx, makeBox(ctx, 3.4, 6, 0.08, mats.banner), 0, y0 + L.throneH * 0.58, daisBack - 0.05)
    ;[-1, 1].forEach(s => {
        visual(ctx, makeBox(ctx, 1.8, 4.6, 0.08, mats.banner), s * (daisW / 2 + 0.6), y0 + L.throneH * 0.52, daisBack - 0.05)
        torch(s * (daisW / 2 + 2.2), y0 + 3.6, daisBack, 0, -1)
    })

    return { throne: { lx: 0, lz: daisBack - 1.9, y: y0 + DAIS_H }, torches }
}

// ── the castle ────────────────────────────────────────────────────────────────

// createCastle(scene, spot, hasPhysics = true)
// spot: { x, z, name?, seed?, faceToward?: {x, z}, look?: {...rollLayout overrides} }
// y is never taken from the caller - the ground is sampled here. The gate
// faces `faceToward` if given, otherwise the nearest road.
export function createCastle(scene, spot, hasPhysics = true){
    const name = spot.name ?? "castle"
    const rand = seededRandom(spot.seed ?? `${spot.x},${spot.z}`)
    const L = rollLayout(rand, spot.look)
    const mats = castleMaterials(scene, L)
    const ri = (a, b) => a + Math.floor(rand() * (b - a + 1))

    const T = L.wallT, WH = L.wallH
    // the castle grows to fit its palace: a yard between the gate and the
    // palace door, the back stairs behind it, the keep and the side stairs
    // beside it
    const PW = PALACE_WALL
    const TWo = L.throneW + 2 * PW, HWo = L.hallW + 2 * PW
    const HZ = Math.max(L.hz, (FRONT_YARD + L.hallL + PW + L.throneD + 2 * PW + BACK_GAP) / 2 + T / 2)
    const HX = Math.max(L.hx, TWo / 2 + L.keepSize - 1 + 4 + STAIR_W + 3.5 + T / 2)
    const outerX = HX + T / 2, outerZ = HZ + T / 2
    const EX = outerX + BERM, EZ = outerZ + BERM
    // the palace along the middle, back to front (outside faces)
    const zr1 = HZ - T / 2 - BACK_GAP           // throne room's back wall
    const zr0 = zr1 - L.throneD - 2 * PW        // its front wall, open onto the hallway
    const zh0 = zr0 - L.hallL - PW              // the hallway's front wall, the palace door

    // gate direction: local -z must point at the target. World direction of
    // local (0,0,-1) under yaw y is (-sin y, -cos y).
    let dx, dz
    if(spot.faceToward){
        dx = spot.faceToward.x - spot.x
        dz = spot.faceToward.z - spot.z
    } else {
        const reach = Math.max(EX, EZ) + 30
        let best = Infinity
        for(let i = 0; i < 48; i++){
            const a = i / 48 * Math.PI * 2
            const d = roadDistance(spot.x + Math.sin(a) * reach, spot.z + Math.cos(a) * reach)
            if(d < best){
                best = d
                dx = Math.sin(a)
                dz = Math.cos(a)
            }
        }
    }
    const yaw = Math.atan2(-dx, -dz) + L.yawJitter
    const ctx = makeCtx(scene, name, spot, yaw, hasPhysics)

    // ── terrace: the courtyard sits on the highest ground under the walls
    const platformY = groundRange(ctx, -outerX, outerX, -outerZ, outerZ, 2).max + PLATFORM_LIFT
    const terraceBottom = groundRange(ctx, -EX, EX, -EZ, EZ, 4).min - 2
    solid(ctx, 2 * EX, platformY - terraceBottom, 2 * EZ, 0, (platformY + terraceBottom) / 2, 0, mats.foundation)
    // paving, a hair above the terrace top (visual only - the terrace
    // collides), in strips around the palace - not under its own floors, which
    // would sit almost exactly level with it and flicker
    const PX = HX - T / 2, PZ = HZ - T / 2
    ;[
        [-PX, PX, -PZ, zh0], [-PX, PX, zr1, PZ],
        [-PX, -TWo / 2, zr0, zr1], [TWo / 2, PX, zr0, zr1],
        [-PX, -HWo / 2, zh0, zr0], [HWo / 2, PX, zh0, zr0],
    ].forEach(([x0, x1, z0, z1]) => {
        visual(ctx, makeBox(ctx, x1 - x0, 0.2, z1 - z0, mats.paving, 3), (x0 + x1) / 2, platformY - 0.08, (z0 + z1) / 2)
    })

    const wallTop = platformY + WH
    const wallY = platformY + WH / 2

    // ── curtain walls - front split around the gate, a lintel over it
    solid(ctx, 2 * outerX, WH, T, 0, wallY, HZ, mats.stone)
    solid(ctx, T, WH, 2 * HZ - T, HX, wallY, 0, mats.stone)
    solid(ctx, T, WH, 2 * HZ - T, -HX, wallY, 0, mats.stone)
    const segLen = outerX - L.gateW / 2
    const segMid = L.gateW / 2 + segLen / 2
    solid(ctx, segLen, WH, T, segMid, wallY, -HZ, mats.stone)
    solid(ctx, segLen, WH, T, -segMid, wallY, -HZ, mats.stone)
    solid(ctx, L.gateW, WH - L.gateH, T, 0, platformY + L.gateH + (WH - L.gateH) / 2, -HZ, mats.stone)
    // walkable tops: the terrace, and the wall walks - not over the gate,
    // where anything walking through stays at courtyard height
    ctx.surfaces.push(
        { x0: -EX, x1: EX, z0: -EZ, z1: EZ, y: platformY },
        { x0: -outerX, x1: outerX, z0: HZ - T / 2, z1: HZ + T / 2, y: wallTop },
        { x0: HX - T / 2, x1: HX + T / 2, z0: -outerZ, z1: outerZ, y: wallTop },
        { x0: -HX - T / 2, x1: -HX + T / 2, z0: -outerZ, z1: outerZ, y: wallTop },
        { x0: L.gateW / 2, x1: outerX, z0: -HZ - T / 2, z1: -HZ + T / 2, y: wallTop },
        { x0: -outerX, x1: -L.gateW / 2, z0: -HZ - T / 2, z1: -HZ + T / 2, y: wallTop },
    )
    // gate leaves, swung open into the courtyard
    ;[-1, 1].forEach(side => {
        visual(ctx, makeBox(ctx, 0.25, L.gateH, L.gateW / 2, mats.wood, L.gateH),
            side * (L.gateW / 2 - 0.15), platformY + L.gateH / 2, -HZ + T / 2 + L.gateW / 4)
    })

    // where each side's outer edge is covered by a tower - no parapet there
    const skips = { back: [], front: [], left: [], right: [] }
    const skip = (side, center, r) => skips[side].push([center - r - 0.4, center + r + 0.4])

    // ── corner towers
    const R = L.towerR
    ;[[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
        const lx = sx * HX, lz = sz * HZ
        tower(ctx, mats, { lx, lz, r: R, shape: L.towerShape, roof: L.roof, lift: L.roofLift,
            base: footBase(ctx, lx, lz, R, platformY), top: wallTop + L.towerRise })
        skip(sz > 0 ? "back" : "front", lx, R)
        skip(sx > 0 ? "right" : "left", lz, R)
    })

    // ── gatehouse towers, standing out past the front wall
    const GR = L.gateTowerR
    ;[-1, 1].forEach(side => {
        const lx = side * (L.gateW / 2 + GR), lz = -outerZ - 0.35 * GR
        tower(ctx, mats, { lx, lz, r: GR, shape: L.towerShape, roof: L.roof, lift: L.roofLift,
            base: footBase(ctx, lx, lz, GR, platformY), top: wallTop + L.gateTowerRise })
        skip("front", lx, GR)
    })

    // ── bastions along the other walls - half outside, so the wall walk
    // only narrows beside them
    const sides = {
        back: { axis: "x", half: HX, outer: outerZ, out: 1 },
        right: { axis: "z", half: HZ, outer: outerX, out: 1 },
        left: { axis: "z", half: HZ, outer: -outerX, out: -1 },
    }
    Object.entries(sides).forEach(([sideName, s]) => {
        const count = ri(0, s.half > 29 ? 2 : 1)
        const BR = L.bastionR
        for(let k = 0; k < count; k++){
            const a = -s.half + (k + 1) * 2 * s.half / (count + 1)
            const [lx, lz] = alongXZ(s.axis, a, s.outer + s.out * 0.45 * BR)
            tower(ctx, mats, { lx, lz, r: BR, shape: L.towerShape, roof: L.roof, lift: L.roofLift,
                base: footBase(ctx, lx, lz, BR, platformY), top: wallTop + L.bastionRise })
            skip(sideName, a, BR)
        }
    })

    // ── parapets: a breastwork with merlons along every outer edge, one
    // collider per uncovered run (the gaps between merlons are wider than
    // the player)
    const parapetSides = [
        { name: "back", axis: "x", half: outerX, perp: outerZ - PARAPET_T / 2 },
        { name: "front", axis: "x", half: outerX, perp: -outerZ + PARAPET_T / 2 },
        { name: "right", axis: "z", half: outerZ, perp: outerX - PARAPET_T / 2 },
        { name: "left", axis: "z", half: outerZ, perp: -outerX + PARAPET_T / 2 },
    ]
    parapetSides.forEach(p => {
        const covered = skips[p.name].sort((a, b) => a[0] - b[0])
        let from = -p.half
        const runs = []
        covered.forEach(([c0, c1]) => {
            if(c0 > from) runs.push([from, c0])
            from = Math.max(from, c1)
        })
        if(from < p.half) runs.push([from, p.half])
        runs.forEach(([a0, a1]) => {
            const len = a1 - a0
            if(len < 1) return
            const [w, d] = alongWD(p.axis, len, PARAPET_T)
            const [x, z] = alongXZ(p.axis, (a0 + a1) / 2, p.perp)
            visual(ctx, makeBox(ctx, w, PARAPET_H, d, mats.stone), x, wallTop + PARAPET_H / 2, z)
            collider(ctx, w, PARAPET_H + MERLON_H, d, x, wallTop + (PARAPET_H + MERLON_H) / 2, z)
            const n = Math.floor(len / MERLON_STEP)
            for(let i = 0; i < n; i++){
                const a = a0 + (len - n * MERLON_STEP) / 2 + (i + 0.5) * MERLON_STEP
                const [mw, md] = alongWD(p.axis, MERLON_W, PARAPET_T)
                const [mx, mz] = alongXZ(p.axis, a, p.perp)
                visual(ctx, makeBox(ctx, mw, MERLON_H, md, mats.stone), mx, wallTop + PARAPET_H + MERLON_H / 2, mz)
            }
        })
    })

    // ── stairs up the inside faces. The corner towers' colliders reach
    // R in from each corner, so flights stay clear of them.
    const reserved = []   // local rects the halls/well must keep out of
    const stairRun = WH / STAIR_SLOPE + LANDING
    const stairSides = [
        { axis: "x", lo: -(HX - R - 1), hi: HX - R - 1, perp: HZ - T / 2 - STAIR_W / 2, inward: -1, chance: 1 },
        { axis: "z", lo: -(HZ - R - 1), hi: HZ - R - 1, perp: HX - T / 2 - STAIR_W / 2, inward: -1, chance: 0.8 },
        { axis: "z", lo: -(HZ - R - 1), hi: HZ - R - 1, perp: -HX + T / 2 + STAIR_W / 2, inward: 1, chance: 0.8 },
        { axis: "x", lo: L.gateW / 2 + 2, hi: HX - R - 1, perp: -HZ + T / 2 + STAIR_W / 2, inward: 1, chance: 0.7 },
        { axis: "x", lo: -(HX - R - 1), hi: -(L.gateW / 2 + 2), perp: -HZ + T / 2 + STAIR_W / 2, inward: 1, chance: 0.7 },
    ]
    let flights = 0
    stairSides.forEach((s, i) => {
        const roll = rand(), dir = rand() < 0.5 ? 1 : -1, slide = rand()
        if(s.hi - s.lo < stairRun + 0.5) return
        // the back wall always gets one; at least two flights overall
        if(roll > s.chance && !(i === 2 && flights < 2)) return
        const start = s.lo + slide * (s.hi - s.lo - stairRun)
        const a0 = dir > 0 ? start : start + stairRun
        flight(ctx, mats.stone, { axis: s.axis, a0, dir, perp: s.perp, width: STAIR_W,
            y0: platformY, rise: WH, slope: STAIR_SLOPE, landing: LANDING, base: platformY - 0.2 })
        flights++
        const perp1 = s.perp + s.inward * (STAIR_W / 2 + 3.5)
        const [x0, z0] = alongXZ(s.axis, start - 2.5, Math.min(s.perp - s.inward * STAIR_W / 2, perp1))
        const [x1, z1] = alongXZ(s.axis, start + stairRun + 2.5, Math.max(s.perp - s.inward * STAIR_W / 2, perp1))
        reserved.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) })
    })

    // ── the palace on the gate's axis: door, hallway, throne room
    const palace = buildPalace(ctx, mats, L, platformY, { zh0, zr0, zr1 })
    reserved.push({ x0: -TWo / 2 - 3, x1: TWo / 2 + 3, z0: zh0 - 4, z1: zr1 + 3 })
    // the way in, gate to palace door
    reserved.push({ x0: -L.gateW / 2 - 2.5, x1: L.gateW / 2 + 2.5, z0: -HZ, z1: zh0 })

    // ── the keep: a tall tower against the throne room's side, flush with
    // its back, overlapping its wall by less than the wall is thick
    const KS = L.keepSize, KH = L.keepH
    const kx = L.towerSide * (TWo / 2 + KS / 2 - 1)
    const kz = zr1 - KS / 2
    const keepBody = L.keepShape === "round"
        ? makeCylinder(ctx, KS, KS, KH, 24, mats.stone)
        : makeBox(ctx, KS, KH, KS, mats.stone)
    visual(ctx, keepBody, kx, platformY + KH / 2, kz)
    collider(ctx, KS, KH, KS, kx, platformY + KH / 2, kz)
    visual(ctx, makeBox(ctx, 3, 4.5, 0.3, mats.wood, 4.5), kx, platformY + 2.25, kz - KS / 2 - 0.1)
    // windows, three rows on every side - on a round keep, set back to where
    // the curved wall actually is at that offset
    for(let side = 0; side < 4; side++){
        const a = side * Math.PI / 2
        ;[0.4, 0.62, 0.84].forEach(row => {
            ;[-0.22, 0.22].forEach(t => {
                const out = (L.keepShape === "round" ? Math.sqrt((KS / 2) ** 2 - (t * KS) ** 2) : KS / 2) + 0.05
                const px = Math.sin(a) * out + Math.cos(a) * t * KS
                const pz = Math.cos(a) * out - Math.sin(a) * t * KS
                visual(ctx, makeBox(ctx, 0.9, 1.8, 0.2, mats.dark), kx + px, platformY + KH * row, kz + pz, a)
            })
        })
    }
    const keepPeak = topOff(ctx, mats, L.keepShape, L.keepRoof, kx, kz, KS / 2, platformY + KH, L.roofLift * 0.8)
    if(L.keepTurrets && L.keepShape === "square"){
        const td = KS * 0.34
        ;[[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
            const tx = kx + sx * (KS / 2 - 0.3), tz = kz + sz * (KS / 2 - 0.3)
            const tb = platformY + KH * 0.7, tt = platformY + KH + 2.5
            visual(ctx, makeCylinder(ctx, td, td, tt - tb, 14, mats.stone), tx, (tt + tb) / 2, tz)
            collider(ctx, td, tt - tb, td, tx, (tt + tb) / 2, tz)
            topOff(ctx, mats, "round", "pointed", tx, tz, td / 2, tt, 1)
        })
    }
    // banner on top
    const poleBase = L.keepRoof === "flat" ? platformY + KH + 1.1 : keepPeak - 0.5
    visual(ctx, makeCylinder(ctx, 0.2, 0.2, 6, 8, mats.dark), kx, poleBase + 3, kz)
    visual(ctx, makeBox(ctx, 3.2, 2, 0.05, mats.banner), kx + 1.7, poleBase + 4.8, kz)
    reserved.push({ x0: kx - KS / 2 - 3, x1: kx + KS / 2 + 3, z0: kz - KS / 2 - 3, z1: kz + KS / 2 + 3 })

    // ── halls against the inside walls, wherever they fit
    const hallSides = [
        { axis: "x", half: HX - R - 1, face: HZ - T / 2, inward: -1 },
        { axis: "z", half: HZ - R - 1, face: HX - T / 2, inward: -1 },
        { axis: "z", half: HZ - R - 1, face: -HX + T / 2, inward: 1 },
    ]
    for(let h = 0; h < L.halls; h++){
        for(let attempt = 0; attempt < 24; attempt++){
            const s = hallSides[Math.floor(rand() * hallSides.length)]
            const len = 8 + rand() * 6, dep = 6 + rand() * 2, hgt = 4.5 + rand() * 1.5
            const a = -s.half + len / 2 + rand() * Math.max(0, 2 * s.half - len)
            const perp = s.face + s.inward * (dep / 2 + 0.3)
            const [hx, hz] = alongXZ(s.axis, a, perp)
            const [w, d] = alongWD(s.axis, len, dep)
            const rect = { x0: hx - w / 2 - 1, x1: hx + w / 2 + 1, z0: hz - d / 2 - 1, z1: hz + d / 2 + 1 }
            if(reserved.some(r => overlaps(r, rect))) continue
            reserved.push(rect)
            solid(ctx, w, hgt, d, hx, platformY + hgt / 2, hz, mats.stone)
            // gable roof: a long box turned 45 degrees about its length, its
            // lower half inside the hall
            const side = dep / Math.SQRT2
            visual(ctx, makeBox(ctx, len + 0.6, side, side, mats.roof, 3), hx, platformY + hgt, hz,
                s.axis === "x" ? 0 : Math.PI / 2, Math.PI / 4)
            // around the roof, for the camera (see topOff)
            const [rw, rd] = alongWD(s.axis, len + 0.6, dep)
            collider(ctx, rw, dep / 2, rd, hx, platformY + hgt + dep / 4, hz)
            // door on the courtyard side
            const [doorX, doorZ] = alongXZ(s.axis, a, perp + s.inward * (dep / 2 + 0.06))
            visual(ctx, makeBox(ctx, 1.8, 3, 0.2, mats.wood, 3), doorX, platformY + 1.5, doorZ, s.axis === "x" ? 0 : Math.PI / 2)
            break
        }
    }

    // ── a well somewhere in the open
    if(L.well){
        for(let attempt = 0; attempt < 24; attempt++){
            const wx = (rand() * 2 - 1) * (HX - T / 2 - 6), wz = (rand() * 2 - 1) * (HZ - T / 2 - 6)
            const rect = { x0: wx - 2.5, x1: wx + 2.5, z0: wz - 2.5, z1: wz + 2.5 }
            if(reserved.some(r => overlaps(r, rect))) continue
            reserved.push(rect)
            visual(ctx, makeCylinder(ctx, 2.8, 3, 1.1, 16, mats.stone, 2), wx, platformY + 0.55, wz)
            visual(ctx, makeCylinder(ctx, 2.2, 2.2, 0.05, 16, mats.dark), wx, platformY + 1.08, wz)
            collider(ctx, 2.9, 1.1, 2.9, wx, platformY + 0.55, wz)
            break
        }
    }

    // ── the gate's ramp down to the ground, when the ground in front is
    // lower than the courtyard. It runs on until it's below the ground
    // across its WHOLE width - stopping where it first touched the ground
    // anywhere left its bottom edge hanging over the lower side, a ledge the
    // player can't climb. Where the ground is higher, it just covers the ramp.
    const frontZ = -EZ
    const lowestAcross = d => {
        let min = Infinity
        for(let x = -L.gateW / 2; x <= L.gateW / 2; x += 1) min = Math.min(min, ctx.ground(x, frontZ - d))
        return min
    }
    let rampRun = 0
    if(platformY - lowestAcross(0) > 0.04){
        rampRun = 60
        for(let d = 0.5; d <= 60; d += 0.5){
            if(platformY - RAMP_SLOPE * d <= lowestAcross(d) - 0.1){
                rampRun = d
                break
            }
        }
        const rise = RAMP_SLOPE * rampRun
        const base = groundRange(ctx, -L.gateW / 2, L.gateW / 2, frontZ - rampRun, frontZ, 1).min - 1
        flight(ctx, mats.foundation, { axis: "z", a0: frontZ - rampRun, dir: 1, perp: 0, width: L.gateW,
            y0: platformY - rise, rise, slope: RAMP_SLOPE, base })
    }

    keepVegetationOut(scene, { origin: { x: spot.x, z: spot.z }, yaw, x0: -EX - 6, x1: EX + 6, z0: -EZ - rampRun - 6, z1: EZ + 6 })
    registerCastle(scene, { origin: { x: spot.x, z: spot.z }, cos: Math.cos(yaw), sin: Math.sin(yaw),
        reach: Math.hypot(EX, EZ + rampRun) + 2, surfaces: ctx.surfaces, outerX, outerZ })
    furnish(scene, { name, origin: { x: spot.x, z: spot.z }, yaw, throne: palace.throne, torches: palace.torches })

    // one mesh, one draw call per material; the sources go
    const castle = Mesh.MergeMeshes(ctx.visuals, true, true, undefined, false, true)
    castle.name = name
    castle.isPickable = false
    castle.receiveShadows = true
    castle.freezeWorldMatrix()
    // where its courtyard and wall walk are, for anything that needs to know
    castle.metadata = { platformY, wallTop, yaw, hx: HX, hz: HZ, wallT: T, gateW: L.gateW, flights, rampRun, colliders: ctx.colliders.length,
        reach: Math.hypot(EX, EZ + rampRun), palace: { zh0, zr0, zr1, throneW: L.throneW, hallW: L.hallW, throne: palace.throne } }
    return castle
}

// ── where the castles' walkable surfaces are ──────────────────────────────────
// Enemies, bots, projectiles and ground-placed skill effects in the openworld
// take their height from the terrain (sampleTerrainSurfaceHeight) - which, in a
// castle, is down under the terrace. tools/groundHeight.js's openworldGroundY
// asks here too and takes whichever is higher.
let castleRegistry = null
function registerCastle(scene, castle){
    if(castleRegistry?.scene !== scene) castleRegistry = { scene, castles: [] }
    castleRegistry.castles.push(castle)
}
// the castle-local (x, z) of a world point, or null if it's nowhere near this castle
function castleLocal(castle, x, z, margin = 0){
    const dx = x - castle.origin.x, dz = z - castle.origin.z
    const reach = castle.reach + margin
    if(dx * dx + dz * dz > reach * reach) return null
    return { lx: dx * castle.cos - dz * castle.sin, lz: dx * castle.sin + dz * castle.cos }
}

// height of the highest castle surface at world (x, z) - courtyard and berm,
// wall walks, stairs, the gate ramp - or -Infinity outside every castle
export function castleSurfaceY(x, z){
    let best = -Infinity
    castleRegistry?.castles.forEach(castle => {
        const at = castleLocal(castle, x, z)
        if(!at) return
        castle.surfaces.forEach(s => {
            if(at.lx < s.x0 || at.lx > s.x1 || at.lz < s.z0 || at.lz > s.z1) return
            const y = s.y ?? Math.min(s.top, Math.max(s.y0, s.y0 + s.slope * ((s.axis === "x" ? at.lx : at.lz) - s.a0) * s.dir))
            if(y > best) best = y
        })
    })
    return best
}

// whether world (x, z) is inside any castle's curtain walls (courtyard,
// palace, keep, the walls themselves) - weatherSystem.js keeps the weather
// out there, the same as in a room
export function isInsideCastle(x, z){
    return !!castleRegistry?.castles.some(castle => {
        const at = castleLocal(castle, x, z)
        return !!at && Math.abs(at.lx) <= castle.outerX && Math.abs(at.lz) <= castle.outerZ
    })
}

// whether world (x, z) is within `margin` of the circle around any castle's
// footprint (gate ramp included)
export function isNearCastle(x, z, margin = 0){
    return !!castleRegistry?.castles.some(castle => castleLocal(castle, x, z, margin))
}

// ── furnishings loaded from files: the wall torches, the throne ─────────────
// Each file loads once per scene and is shared by every castle; createCastle
// stays synchronous, these turn up a moment later. A file that's missing just
// leaves its spots empty (one warning) - thrones.glb doesn't exist yet.
let furniture = null
function furnitureFor(scene){
    if(furniture?.scene === scene) return furniture
    const state = furniture = {
        scene, castles: [],
        throne: LoadAssetContainerAsync(THRONE_GLB, scene).catch(error => {
            console.warn(`[castle] ${THRONE_GLB} didn't load - the throne rooms stay empty until it's there`, error?.message ?? error)
            return null
        }),
        torch: mergeAndLoadModel(TORCH_GLB, scene).catch(error => {
            console.warn("[castle] wall torch failed to load", error)
            return null
        }),
    }
    // the flames only burn with the camera near their castle - eight particle
    // systems a castle, five castles. Their lights are left to lightBudget.js,
    // which only ever has the 5 nearest the player on.
    let frame = 0
    scene.onBeforeRenderObservable.add(() => {
        if(++frame % 30) return
        const cam = scene.activeCamera?.position
        if(!cam) return
        state.castles.forEach(c => {
            const near = (cam.x - c.origin.x) ** 2 + (cam.z - c.origin.z) ** 2 < FLAMES_NEAR ** 2
            if(near === c.flamesOn) return
            c.flamesOn = near
            c.flames.forEach(flame => near ? flame.start() : flame.stop())
        })
    })
    return state
}

// c: { name, origin, yaw, throne: { lx, lz, y }, torches: [{ lx, y, lz, ox, oz }] }
function furnish(scene, c){
    const state = furnitureFor(scene)
    const cos = Math.cos(c.yaw), sin = Math.sin(c.yaw)
    const world = (lx, y, lz) => new Vector3(c.origin.x + lx * cos + lz * sin, y, c.origin.z - lx * sin + lz * cos)
    const turn = (ox, oz) => new Vector3(ox * cos + oz * sin, 0, -ox * sin + oz * cos)

    // torches: flame and light now, the model once it's loaded. The model
    // sticks out along its own -z (roomHall.js) - yawed to point that way out.
    const castle = { origin: c.origin, flamesOn: false, flames: [] }
    state.castles.push(castle)
    const mounts = c.torches.map(t => {
        const pos = world(t.lx, t.y, t.lz)
        const out = turn(t.ox, t.oz)
        const flame = pos.add(out.scale(TORCH_FLAME_OUT))
        flame.y += TORCH_FLAME_UP - 0.25   // createFireParticles puts the flame 0.25 above the point
        const { particles } = createFireParticles(flame, scene, TORCH_LIGHT)
        particles.stop()
        castle.flames.push(particles)
        return { pos, yaw: Math.atan2(-out.x, -out.z) }
    })
    state.torch.then(master => {
        if(!master || scene.isDisposed) return
        master.isVisible = false
        master.isPickable = false
        mounts.forEach((m, i) => {
            const torch = master.createInstance(`${c.name}_torch_${i}`)
            torch.position.copyFrom(m.pos)
            torch.rotation.y = m.yaw
            torch.isPickable = false
            torch.freezeWorldMatrix()
        })
    })

    // the throne: scaled to THRONE_HEIGHT whatever size it comes in, standing
    // on the dais, centred on its spot, facing down the room - with a box to
    // bump into
    state.throne.then(container => {
        if(!container || scene.isDisposed) return
        const { rootNodes } = container.instantiateModelsToScene(n => `${c.name}_throne_${n}`, false)
        const holder = new TransformNode(`${c.name}_throne`, scene)
        rootNodes.forEach(n => n.parent = holder)
        const { min, max } = holder.getHierarchyBoundingVectors(true)
        const size = max.subtract(min)
        if(!(size.y > 0)){
            console.warn(`[castle] ${THRONE_GLB} has no visible size - left out`)
            return holder.dispose()
        }
        const s = THRONE_HEIGHT / size.y
        const yaw = c.yaw + THRONE_YAW
        const spot = world(c.throne.lx, c.throne.y, c.throne.lz)
        // where the model's own centre ends up once scaled and turned
        const centre = Vector3.TransformCoordinates(new Vector3((min.x + max.x) / 2 * s, 0, (min.z + max.z) / 2 * s), Matrix.RotationY(yaw))
        holder.scaling.setAll(s)
        holder.rotation.y = yaw
        holder.position.set(spot.x - centre.x, spot.y - min.y * s, spot.z - centre.z)
        holder.computeWorldMatrix(true)
        holder.getChildMeshes().forEach(mesh => {
            mesh.isPickable = false
            mesh.computeWorldMatrix(true)
            mesh.freezeWorldMatrix()
        })
        const box = MeshBuilder.CreateBox(`${c.name}_collider`, { width: size.x * s, height: size.y * s, depth: size.z * s }, scene)
        box.position.set(spot.x, spot.y + size.y * s / 2, spot.z)
        box.rotation.y = yaw
        box.isVisible = false
        box.isPickable = false
        createAggregate(box, { mass: 0 }, "box", scene)
        box.freezeWorldMatrix()
    })
}

// ── vegetation ────────────────────────────────────────────────────────────────
// infterrain scatters trees (instances named t<x>_<z>) and grass cards
// (grass<...>) over the ground as chunks stream in, and knows nothing about
// castles - trees grew up through courtyards and walls, grass through the
// paving. Each is created and positioned inside infterrain's own
// onBeforeRender chunk build, so every frame, right before the scene decides
// what to draw, the meshes added since the last check get looked at and any
// that landed in a castle are switched off - before they're ever drawn.
//
// "Added since the last check" without scanning everything: scene.meshes
// only ever grows at the end (disposal splices, which keeps the order), and
// uniqueIds only go up, so walking back from the end until an already-seen id
// covers exactly the new ones. (Not onNewMeshAddedObservable - Babylon raises
// that on a later tick, after the mesh has already been drawn once.)
let vegetation = null
function keepVegetationOut(scene, zone){
    if(vegetation?.scene !== scene){
        const state = vegetation = { scene, zones: [], lastId: -1 }
        const isScattered = mesh => mesh.getClassName() === "InstancedMesh" && /^(t-?\d+_-?\d+|grass\d)/.test(mesh.name)
        scene.onBeforeActiveMeshesEvaluationObservable.add(() => {
            const meshes = scene.meshes
            let newest = state.lastId
            for(let i = meshes.length - 1; i >= 0; i--){
                const mesh = meshes[i]
                if(mesh.uniqueId <= state.lastId) break
                if(mesh.uniqueId > newest) newest = mesh.uniqueId
                if(isScattered(mesh) && insideAny(state.zones, mesh.position)) mesh.setEnabled(false)
            }
            state.lastId = newest
        })
    }
    vegetation.zones.push(zone)
    // a castle built after some vegetation already streamed in
    vegetation.lastId = -1
}
function insideAny(zones, p){
    return zones.some(z => {
        const dx = p.x - z.origin.x, dz = p.z - z.origin.z
        const c = Math.cos(z.yaw), s = Math.sin(z.yaw)
        const lx = dx * c - dz * s, lz = dx * s + dz * c
        return lx > z.x0 && lx < z.x1 && lz > z.z0 && lz < z.z1
    })
}
