// Tucks one layer of a character in under the layer worn over it - the male
// avatar's skin under his shirt and pants, the top of his pants under his
// shirt (createcharacter.js).
//
// avatar.glb carries every layer on under the next: the head mesh runs down
// over the upper chest and back, the arms run up the sleeves, the shins up
// inside the pants, the pants' waistband up under the shirt. None of that is
// ever meant to be seen, but left in it showed through - each layer is
// skinned on its own, so wherever an animation bends two a little differently
// the inner one pokes out in front (by more than a few centimetres in places),
// and even where it doesn't, layers a few millimetres apart z-fight once the
// camera is pulled back.
//
// Two parts to it:
//  - what's covered isn't drawn at all: an inner triangle is dropped once all
//    three of its corners are under the cover - cover found within REACH_OUT
//    outside it along its normal, or REACH_IN inside it (where it already
//    pokes through). Worked out on the rig's bind pose, the one every
//    animation deforms from, so it holds whatever the character is doing.
//  - a triangle with even one corner in the open stays, so the inner layer
//    still runs right up under every hem and collar and no gap opens. That
//    band along the edge is the one place left where the two can fight, so
//    its vertices get a "depthPushWeight" of 1 (0 everywhere else) for
//    tools/depthPush.js to push back just there: the edge of the skin goes
//    behind the cloth, while a hand held in front of the chest - nowhere near
//    a hem - stays exactly where it is, in front.
//
// Once per outfit a session: every character wearing the same outfit reuses
// the result.

export const PUSH_WEIGHT_KIND = "depthPushWeight"
// how far under the cover's nearest edge (a hem, cuff or collar) a vertex is,
// in metres - negative out in the open. Blended across a triangle that
// straddles a hem it crosses 0 right about at the hem, which is where
// tools/tuckClip.js cuts it off
export const TUCK_DEPTH_KIND = "tuckDepth"

const REACH_OUT = 0.06
const REACH_IN = 0.03
const CELL = 0.05
const EDGE_RINGS = 2

const resultByOutfit = new Map()  // outfit key -> Map(mesh name -> { indices, weights })
// by lowercased name - the game lowercases avatar.glb's mesh names, the
// character-creation preview keeps them as they come ("mainBodyhand")
const nameOf = mesh => mesh.name.toLowerCase()
const fullIndices = new WeakMap() // mesh -> its indices before any were dropped

// innerMeshes: the layer to tuck in; coverMeshes: what's worn over it;
// outfitKey: names that pairing, e.g. "skin|style1|style2"; reachOut: how far
// out from the inner layer the cover may hang and still count as over it
export function tuckUnder(innerMeshes, coverMeshes, outfitKey, reachOut = REACH_OUT){
    innerMeshes = innerMeshes.filter(mesh => mesh.getIndices?.() && mesh.getVerticesData?.("position"))
    innerMeshes.forEach(mesh => {
        if(!fullIndices.has(mesh)) fullIndices.set(mesh, mesh.getIndices().slice())
    })
    let result = resultByOutfit.get(outfitKey)
    if(!result){
        result = new Map()
        const covers = buildCoverGrid(coverMeshes)
        innerMeshes.forEach(mesh => result.set(nameOf(mesh), tuck(mesh, fullIndices.get(mesh), covers, reachOut)))
        resultByOutfit.set(outfitKey, result)
    }
    innerMeshes.forEach(mesh => {
        const tucked = result.get(nameOf(mesh))
        if(!tucked) return
        // every character is a clone of the one avatar, and clones share
        // their geometry - this one's outfit may not be the next one's
        mesh.makeGeometryUnique()
        mesh.setIndices(tucked.indices)
        mesh.setVerticesData(PUSH_WEIGHT_KIND, tucked.weights, false, 1)
        mesh.setVerticesData(TUCK_DEPTH_KIND, tucked.depth, false, 1)
    })
}

// every cover triangle, binned into a grid of CELL-sized boxes by the boxes
// its bounds touch - so a ray only tests the few triangles near it
function buildCoverGrid(coverMeshes){
    const tris = []
    coverMeshes.forEach(mesh => {
        const pos = mesh.getVerticesData("position")
        const idx = fullIndices.get(mesh) ?? mesh.getIndices()
        if(!pos || !idx) return
        for(let i = 0; i < idx.length; i += 3){
            const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3
            tris.push([pos[a], pos[a + 1], pos[a + 2], pos[b], pos[b + 1], pos[b + 2], pos[c], pos[c + 1], pos[c + 2]])
        }
    })
    const cells = new Map()
    tris.forEach((t, ti) => {
        const x0 = Math.floor(Math.min(t[0], t[3], t[6]) / CELL), x1 = Math.floor(Math.max(t[0], t[3], t[6]) / CELL)
        const y0 = Math.floor(Math.min(t[1], t[4], t[7]) / CELL), y1 = Math.floor(Math.max(t[1], t[4], t[7]) / CELL)
        const z0 = Math.floor(Math.min(t[2], t[5], t[8]) / CELL), z1 = Math.floor(Math.max(t[2], t[5], t[8]) / CELL)
        for(let x = x0; x <= x1; x++) for(let y = y0; y <= y1; y++) for(let z = z0; z <= z1; z++){
            const key = `${x},${y},${z}`
            if(!cells.has(key)) cells.set(key, [])
            cells.get(key).push(ti)
        }
    })
    // seen[triangle] = the query that last tested it, so one segment never
    // tests the same triangle twice when it sits in several of its cells
    return { tris, cells, seen: new Int32Array(tris.length).fill(-1), query: 0, hems: coverHems(coverMeshes) }
}

// the cover's open edges - its hems, cuffs, collar, waist: edges only one of
// its triangles uses. Counted on welded positions, so a UV seam (one edge,
// split into two vertices a side) doesn't count as one
function coverHems(coverMeshes){
    const hems = []
    coverMeshes.forEach(mesh => {
        const pos = mesh.getVerticesData("position")
        const idx = fullIndices.get(mesh) ?? mesh.getIndices()
        if(!pos || !idx) return
        const welded = new Map()
        const id = new Int32Array(pos.length / 3)
        for(let v = 0; v < id.length; v++){
            const p = v * 3
            const key = `${Math.round(pos[p] * 1e4)},${Math.round(pos[p + 1] * 1e4)},${Math.round(pos[p + 2] * 1e4)}`
            if(!welded.has(key)) welded.set(key, v)
            id[v] = welded.get(key)
        }
        const uses = new Map()
        const edge = (a, b) => {
            const key = a < b ? `${a},${b}` : `${b},${a}`
            uses.set(key, (uses.get(key) ?? 0) + 1)
        }
        for(let i = 0; i < idx.length; i += 3){
            const a = id[idx[i]], b = id[idx[i + 1]], c = id[idx[i + 2]]
            edge(a, b); edge(b, c); edge(c, a)
        }
        uses.forEach((count, key) => {
            if(count !== 1) return
            const [a, b] = key.split(",").map(Number)
            hems.push([pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2], pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]])
        })
    })
    return hems
}

// distance from a point to the nearest of the cover's hem edges
function distanceToHem(hems, x, y, z){
    let best = Infinity
    for(const h of hems){
        const dx = h[3] - h[0], dy = h[4] - h[1], dz = h[5] - h[2]
        const len2 = dx * dx + dy * dy + dz * dz
        let t = len2 ? ((x - h[0]) * dx + (y - h[1]) * dy + (z - h[2]) * dz) / len2 : 0
        t = Math.max(0, Math.min(1, t))
        const ex = h[0] + dx * t - x, ey = h[1] + dy * t - y, ez = h[2] + dz * t - z
        const d2 = ex * ex + ey * ey + ez * ez
        if(d2 < best) best = d2
    }
    return Math.sqrt(best)
}

// { indices: the triangles that keep a corner in the open, weights: 1 on
// every vertex of a triangle that still has a corner under the cover }
function tuck(mesh, indices, covers, reachOut){
    const pos = mesh.getVerticesData("position")
    const nor = mesh.getVerticesData("normal")
    if(!pos || !nor || !covers.tris.length) return null
    const count = pos.length / 3
    const covered = new Uint8Array(count)
    for(let v = 0; v < count; v++){
        const p = v * 3
        const nx = nor[p], ny = nor[p + 1], nz = nor[p + 2]
        // the segment through this point along its normal, from a little
        // inside to a little outside
        covered[v] = segmentHitsCover(covers,
            pos[p] - nx * REACH_IN, pos[p + 1] - ny * REACH_IN, pos[p + 2] - nz * REACH_IN,
            pos[p] + nx * reachOut, pos[p + 1] + ny * reachOut, pos[p + 2] + nz * reachOut) ? 1 : 0
    }
    const kept = []
    const weights = new Float32Array(count)
    for(let i = 0; i < indices.length; i += 3){
        const a = indices[i], b = indices[i + 1], c = indices[i + 2]
        if(covered[a] && covered[b] && covered[c]) continue
        kept.push(a, b, c)
        if(covered[a] || covered[b] || covered[c]) weights[a] = weights[b] = weights[c] = 1
    }
    // a UV seam (down the back of a calf, say) splits one point of the
    // surface into separate vertices, one per side - the weight has to cross
    // it, or the band stops dead at the seam and half of it is never pushed
    const twins = new Map()
    for(let v = 0; v < count; v++){
        const p = v * 3
        const key = `${Math.round(pos[p] * 1e4)},${Math.round(pos[p + 1] * 1e4)},${Math.round(pos[p + 2] * 1e4)}`
        if(!twins.has(key)) twins.set(key, [])
        twins.get(key).push(v)
    }
    const acrossSeams = () => twins.forEach(group => {
        if(group.length < 2 || !group.some(v => weights[v])) return
        group.forEach(v => weights[v] = 1)
    })
    acrossSeams()
    // the band reaches EDGE_RINGS more triangles out from the cover - where a
    // hem hangs loose (the back of a pant cuff, over a bending knee) the skin
    // just inside it is too far off the cloth to count as covered, yet still
    // pokes out through it when the knee bends
    for(let ring = 0; ring < EDGE_RINGS; ring++){
        const before = weights.slice()
        for(let i = 0; i < kept.length; i += 3){
            const a = kept[i], b = kept[i + 1], c = kept[i + 2]
            if(before[a] || before[b] || before[c]) weights[a] = weights[b] = weights[c] = 1
        }
        acrossSeams()
    }
    // how far under the cover's edge each vertex is (TUCK_DEPTH_KIND) - only
    // the vertices of triangles that straddle a hem matter, the rest are
    // either dropped or nowhere near one
    const depth = new Float32Array(count).fill(-1)
    for(let i = 0; i < kept.length; i += 3){
        const tri = [kept[i], kept[i + 1], kept[i + 2]]
        if(!tri.some(v => covered[v])) continue
        tri.forEach(v => {
            const p = v * 3
            const d = distanceToHem(covers.hems, pos[p], pos[p + 1], pos[p + 2])
            depth[v] = covered[v] ? d : -d
        })
    }
    return { indices: kept, weights, depth }
}

function segmentHitsCover(covers, ax, ay, az, bx, by, bz){
    const { tris, cells, seen } = covers
    const stamp = ++covers.query
    const x0 = Math.floor(Math.min(ax, bx) / CELL), x1 = Math.floor(Math.max(ax, bx) / CELL)
    const y0 = Math.floor(Math.min(ay, by) / CELL), y1 = Math.floor(Math.max(ay, by) / CELL)
    const z0 = Math.floor(Math.min(az, bz) / CELL), z1 = Math.floor(Math.max(az, bz) / CELL)
    const dx = bx - ax, dy = by - ay, dz = bz - az
    for(let x = x0; x <= x1; x++) for(let y = y0; y <= y1; y++) for(let z = z0; z <= z1; z++){
        const list = cells.get(`${x},${y},${z}`)
        if(!list) continue
        for(const ti of list){
            if(seen[ti] === stamp) continue
            seen[ti] = stamp
            if(segmentHitsTriangle(tris[ti], ax, ay, az, dx, dy, dz)) return true
        }
    }
    return false
}

// Moller-Trumbore, limited to the segment (t in 0..1), either face
function segmentHitsTriangle(t, ox, oy, oz, dx, dy, dz){
    const e1x = t[3] - t[0], e1y = t[4] - t[1], e1z = t[5] - t[2]
    const e2x = t[6] - t[0], e2y = t[7] - t[1], e2z = t[8] - t[2]
    const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x
    const det = e1x * px + e1y * py + e1z * pz
    if(Math.abs(det) < 1e-12) return false
    const inv = 1 / det
    const sx = ox - t[0], sy = oy - t[1], sz = oz - t[2]
    const u = (sx * px + sy * py + sz * pz) * inv
    if(u < 0 || u > 1) return false
    const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x
    const w = (dx * qx + dy * qy + dz * qz) * inv
    if(w < 0 || u + w > 1) return false
    const along = (e2x * qx + e2y * qy + e2z * qz) * inv
    return along >= 0 && along <= 1
}
