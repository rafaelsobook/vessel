// createRoots.js
//
// Root generator - branching, tapering, meandering roots that crawl over a
// surface, or hang off a ledge. All of one call's roots come back merged into
// a single mesh (one draw call), bark mapped in metres along each root.
//
// growRoots crawls over any surface the caller describes as a 2D
// parametrisation: surface(u, v) -> { pos, normal, across } with u, v in
// metres along it (createduelarena.js's is the arena's cross-section swept
// round the ring - sand, up the podium wall, over the parapet, up the seats -
// so a single root can run from a tree on the rim down the stands, over the
// wall and out across the floor). A root is a random walk in (u, v): it
// meanders, keeps being pulled back toward the heading it was given, tapers
// from its seed radius to a point, and sends off thinner branches (which
// branch again) as it goes. Each point sits partly sunk into the surface,
// rising and dipping along the way like real surface roots.
//
// hangRoots drops aerial roots off a ledge - bowing out from the wall as they
// hang, thinning to a point.
//
// Both are deterministic for a given seed (seededRandom), so a place grows the
// same roots on every visit.
import { Vector3, Mesh, MeshBuilder, VertexBuffer } from '@babylonjs/core';

const STEP         = 0.22    // metres between a root's path points
const TIP_RADIUS   = 0.018
const MAX_DEPTH    = 3       // branches of branches of branches
const MAX_ROOTS    = 260     // per growRoots call, branches included
const TESSELLATION = 7

// mulberry32 - a small seeded PRNG, 0..1 like Math.random
export function seededRandom(seed = 1){
    let s = seed >>> 0
    return () => {
        s = (s + 0x6D2B79F5) >>> 0
        let t = s
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

/**
 * Grows roots over a surface.
 * surface(u, v) -> { pos, normal, across } | null - u and v in metres along
 *   it; across = metres one unit of v spans at that u (1 on flat ground);
 *   null means off the surface, and a root stops there.
 * seeds: [{ u, v, heading, length, radius, pull?, wander?, branching?, sink?, taper? }]
 *   heading   - radians in (u, v) space: 0 runs toward +u, PI toward -u
 *   pull      - 0..1, how hard it keeps returning to that heading (0.35)
 *   wander    - how much it meanders (0.5)
 *   branching - branches sent off per metre, roughly (0.22)
 *   sink      - how far into the surface it sits, in radii (0.45)
 *   taper     - how soon it thins: radius * (1 - along)^taper - lower stays
 *               thick for longer (0.8)
 * Returns { mesh, points } - mesh null if nothing grew; points
 * [{ pos, radius }] along every root, for keeping other things off them.
 */
export function growRoots(scene, name, { surface, seeds, material, seed = 1, barkTile = 1.4 }){
    const rng = seededRandom(seed)
    const queue = seeds.map(s => ({ depth: 0, ...s }))
    const tubes = [], points = []
    while(queue.length && tubes.length < MAX_ROOTS){
        const path = walk(queue.shift(), surface, rng, queue)
        if(path.pts.length < 3) continue
        path.pts = smooth(path.pts, 2)
        tubes.push(tube(`${name}_${tubes.length}`, path, scene, barkTile))
        path.pts.forEach((pos, i) => points.push({ pos, radius: path.radii[i] }))
    }
    return { mesh: merge(name, tubes, material), points }
}

/**
 * Aerial roots hanging off a ledge.
 * anchors: [{ pos, out, length, radius }] - out: horizontal, away from the
 *   wall; each root bows out that way as it hangs, and drifts a little sideways.
 */
export function hangRoots(scene, name, { anchors, material, seed = 1, barkTile = 1.4 }){
    const rng = seededRandom(seed)
    const tubes = anchors.map((a, n) => {
        const steps = Math.max(3, Math.round(a.length / STEP))
        const side = Vector3.Cross(a.out, Vector3.Up()).normalize()
        const drift = (rng() - 0.5) * 0.6
        const bow = 0.08 + rng() * 0.25
        const phase = rng() * Math.PI * 2
        const pts = [], radii = []
        for(let i = 0; i <= steps; i++){
            const t = i / steps
            pts.push(a.pos
                .add(a.out.scale(0.03 + bow * Math.sin(Math.PI * Math.min(t * 1.2, 1))))
                .add(side.scale(drift * t * t + 0.04 * Math.sin(t * 9 + phase)))
                .add(new Vector3(0, -a.length * t, 0)))
            radii.push(TIP_RADIUS * 0.6 + (a.radius - TIP_RADIUS * 0.6) * (1 - t))
        }
        return tube(`${name}_${n}`, { pts, radii }, scene, barkTile)
    })
    return merge(name, tubes, material)
}

// one root's walk, queueing the branches it sends off
function walk(root, surface, rng, queue){
    const { pull = 0.35, wander = 0.5, branching = 0.22, sink = 0.45, taper = 0.8 } = root
    const steps = Math.max(3, Math.round(root.length / STEP))
    const pts = [], radii = []
    const phase = rng() * Math.PI * 2
    let { u, v } = root
    let heading = root.heading
    let turn = 0
    for(let i = 0; i <= steps; i++){
        const at = surface(u, v)
        if(!at) break
        const radius = TIP_RADIUS + (root.radius - TIP_RADIUS) * Math.pow(1 - i / steps, taper)
        // partly sunk into whatever it crawls over, rising and dipping along the way
        const lift = radius * (sink + 0.35 * Math.sin(i * 0.31 + phase))
        pts.push(at.pos.add(at.normal.scale(lift)))
        radii.push(radius)

        if(root.depth < MAX_DEPTH && i > 2 && i < steps - 4 && rng() < branching * STEP){
            queue.push({
                u, v,
                depth: root.depth + 1,
                heading: heading + (rng() < 0.5 ? -1 : 1) * (0.5 + rng() * 0.7),
                length: (steps - i) * STEP * (0.35 + rng() * 0.45),
                radius: radius * (0.42 + rng() * 0.2),
                pull: pull * 0.6,
                wander: wander * 1.15,
                branching, sink, taper,
            })
        }

        // meander - a smoothed random turn, pulled back toward its heading
        turn = turn * 0.82 + (rng() - 0.5) * wander * 0.35
        heading += turn + wrapAngle(root.heading - heading) * pull * 0.08
        u += Math.cos(heading) * STEP
        v += Math.sin(heading) * STEP / (at.across ?? 1)
    }
    return { pts, radii }
}

// a tube along the path, tapering with it; bark once round, metres along
function tube(name, { pts, radii }, scene, barkTile){
    const mesh = MeshBuilder.CreateTube(name, {
        path: pts,
        radiusFunction: i => radii[Math.min(i, radii.length - 1)],
        tessellation: TESSELLATION,
        cap: Mesh.NO_CAP,
    }, scene)
    const uvs = mesh.getVerticesData(VertexBuffer.UVKind)
    const ring = uvs.length / 2 / pts.length
    let along = 0
    for(let i = 0; i < pts.length; i++){
        if(i > 0) along += Vector3.Distance(pts[i], pts[i - 1])
        for(let j = 0; j < ring; j++){
            const k = (i * ring + j) * 2
            uvs[k] = j / (ring - 1)
            uvs[k + 1] = along / barkTile
        }
    }
    mesh.setVerticesData(VertexBuffer.UVKind, uvs)
    return mesh
}

// a few passes of a 1-2-1 average - turns the walk's corners (and the
// surface's own, where a wall meets the floor) into curves
function smooth(pts, passes){
    let out = pts
    for(let p = 0; p < passes; p++){
        out = out.map((pt, i) => (i === 0 || i === out.length - 1)
            ? pt
            : out[i - 1].add(pt.scale(2)).add(out[i + 1]).scale(0.25))
    }
    return out
}

function merge(name, tubes, material){
    if(!tubes.length) return null
    const mesh = tubes.length === 1 ? tubes[0] : Mesh.MergeMeshes(tubes, true, true)
    mesh.name = name
    mesh.material = material
    mesh.isPickable = false
    mesh.freezeWorldMatrix()
    return mesh
}

const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a))
