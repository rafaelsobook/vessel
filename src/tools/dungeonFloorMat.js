import { Texture, Color3 } from "@babylonjs/core"
import { CustomMaterial } from "@babylonjs/materials"

// The dungeon floor's material - several textures mixed across the whole floor
// so it stops reading as one tile stamped out cell after cell. Same two tricks
// as the village ground (groundmat.js) and infterrain's terrain shader:
//
//  1. every cell sees its texture differently - its own random offset, turned
//     half a turn and/or mirrored - picked by a hash of the cell it's in. The
//     change lands exactly on the floor tiles' own bevelled seams, so there's
//     no blend zone to smear a brick pattern across (the village's
//     sampleNoTile blends neighbours, which suits grass but doubles up bricks).
//  2. big, soft noise patches (fbm) decide which texture shows where - they
//     run across cells, so stone gives way to cement and rubble in irregular
//     drifts instead of tile by tile.
//
// ...plus an accent texture that replaces a small share of whole cells, like
// the odd re-laid tile.
//
// Coordinates are WORLD space (vPositionW), so every floor instance - and the
// boss dais' plinths, a different mesh entirely - continues the same pattern.
// Faces that aren't horizontal (the sides of raised slabs and plinths) take the
// texture side-on instead, so it isn't smeared down them.
//
// A StandardMaterial underneath (CustomMaterial), so the torches and room
// lights light it like everything else. No bump map: a normal map's UVs would
// come from the mesh and no longer line up with the texture.

// how many of a texture's repeats fit across one cell, when a layer doesn't say
const DEFAULT_REPEAT = 1
// how big the patches each extra layer forms are, in world units across
const PATCH_SIZE = [14, 17]
// how much of the floor each extra layer takes over - the patch threshold
// (lower = more). Layer 0 is whatever's left.
const PATCH_THRESHOLD = [0.52, 0.56]
// how soft a patch's edge is
const PATCH_SOFTNESS = 0.12

// scene -> Map(path -> Texture) - both floor materials share their textures
const textureCache = new WeakMap()
function floorTexture(scene, path) {
    let cache = textureCache.get(scene)
    if (!cache) { cache = new Map(); textureCache.set(scene, cache) }
    let tex = cache.get(path)
    if (!tex) {
        tex = new Texture(path, scene)
        tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE
        cache.set(path, tex)
    }
    return tex
}

const SHADER_DEFINITIONS = `
    float dfHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    vec2 dfHash2(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453);
    }
    float dfNoise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(dfHash(i),               dfHash(i + vec2(1.0, 0.0)), u.x),
                   mix(dfHash(i + vec2(0.0, 1.0)), dfHash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    // ~37 degrees between octaves keeps the patches from lining up on the grid
    float dfFbm(vec2 p) {
        float v = 0.0, a = 0.5;
        mat2 rot = mat2(1.6, 1.2, -1.2, 1.6);
        for (int i = 0; i < 4; i++) {
            v += a * dfNoise(p);
            p = rot * p + vec2(3.1, 7.4);
            a *= 0.5;
        }
        return v;
    }
    // A texture as one cell sees it. local: 0-1 across the cell; flip: this
    // cell's half-turn/mirror; shift: its random offset. Sampled with explicit
    // gradients - the jump in UVs at a cell's edge would otherwise make the GPU
    // pick its smallest mip there, a bright seam around every tile.
    vec3 dfSample(sampler2D tex, vec2 local, vec2 flip, vec2 shift, float repeat, vec2 dx, vec2 dy) {
        vec2 uv = (local - 0.5) * flip * repeat + shift;
        return textureGrad(tex, uv, dx * flip * repeat, dy * flip * repeat).rgb;
    }
`

/**
 * layers: [{ path, repeat? }] - 1 to 3 textures; the first is the floor's main
 *         one, the others form patches over it
 * accent: optional { path, repeat?, chance } - replaces `chance` (0-1) of the cells
 * tint:   Color3 multiplied over the result (the boss dais' red)
 */
export function createDungeonFloorMat(scene, name, { layers, accent, cellSize, tint = Color3.White() }) {
    const mat = new CustomMaterial(name, scene)
    mat.specularColor = Color3.Black()

    // missing layers repeat the first, so the shader always has three
    const layerDefs = [0, 1, 2].map(i => layers[i] ?? layers[0])
    const layerTex  = layerDefs.map(l => floorTexture(scene, l.path))
    const accentTex = accent ? floorTexture(scene, accent.path) : layerTex[0]
    const repeats   = [...layerDefs.map(l => l.repeat ?? DEFAULT_REPEAT), accent?.repeat ?? DEFAULT_REPEAT]
    // a single texture: no patches at all
    const patchy    = layers.length > 1 ? 1 : 0
    const thirdOn   = layers.length > 2 ? 1 : 0

    ;["floorLayer0", "floorLayer1", "floorLayer2", "floorAccent"].forEach(u => mat.AddUniform(u, "sampler2D", null))
    mat.AddUniform("floorRepeats", "vec4", null)
    mat.AddUniform("floorTint", "vec3", null)
    // x: cell size, y: accent chance, z: layer 1 on, w: layer 2 on
    mat.AddUniform("floorParams", "vec4", null)

    mat.onBindObservable.add(() => {
        const effect = mat.getEffect()
        if (!effect) return
        effect.setTexture("floorLayer0", layerTex[0])
        effect.setTexture("floorLayer1", layerTex[1])
        effect.setTexture("floorLayer2", layerTex[2])
        effect.setTexture("floorAccent", accentTex)
        effect.setFloat4("floorRepeats", ...repeats)
        effect.setColor3("floorTint", tint)
        effect.setFloat4("floorParams", cellSize, accent?.chance ?? 0, patchy, thirdOn)
    })

    mat.Fragment_Definitions(SHADER_DEFINITIONS)
    mat.Fragment_Custom_Diffuse(`
        float cs = floorParams.x;
        vec3  n  = normalize(vNormalW);
        vec3  wp = vPositionW;

        // the plane this face is textured in: the floor for a floor, side-on
        // for the walls of a raised slab
        bool  top   = abs(n.y) > 0.5;
        vec2  plane = top ? wp.xz : (abs(n.x) > abs(n.z) ? wp.zy : wp.xy);
        vec2  local = fract(plane / cs);
        vec2  dx    = dFdx(plane) / cs;
        vec2  dy    = dFdy(plane) / cs;

        // which cell, and how this cell turns its textures - always keyed on
        // the cell's floor position, so a slab's sides match its top
        vec2  cell  = floor(wp.xz / cs);
        vec2  h     = dfHash2(cell);
        // a half turn and/or a mirror - never a quarter turn, which would set
        // brick rows running across each other from one tile to the next
        vec2  flip  = vec2(h.x < 0.5 ? 1.0 : -1.0, h.y < 0.5 ? 1.0 : -1.0);
        if (!top) flip.y = 1.0;   // never upside down on a side face
        vec2  shift = dfHash2(cell + 17.0) * 7.0;

        vec3 c0 = dfSample(floorLayer0, local, flip, shift, floorRepeats.x, dx, dy);
        vec3 c1 = dfSample(floorLayer1, local, flip, shift, floorRepeats.y, dx, dy);
        vec3 c2 = dfSample(floorLayer2, local, flip, shift, floorRepeats.z, dx, dy);

        // patches - soft-edged noise blobs across the floor, roughened at the edge
        vec2  pw  = wp.xz;
        float jit = (dfNoise(pw * 1.7) - 0.5) * ${PATCH_SOFTNESS.toFixed(3)};
        float m1  = smoothstep(${PATCH_THRESHOLD[0].toFixed(3)}, ${(PATCH_THRESHOLD[0] + PATCH_SOFTNESS).toFixed(3)},
                               dfFbm(pw / ${PATCH_SIZE[0].toFixed(1)}) + jit) * floorParams.z;
        float m2  = smoothstep(${PATCH_THRESHOLD[1].toFixed(3)}, ${(PATCH_THRESHOLD[1] + PATCH_SOFTNESS).toFixed(3)},
                               dfFbm(pw / ${PATCH_SIZE[1].toFixed(1)} + vec2(17.3, 5.1)) + jit) * floorParams.w;
        vec3 floorCol = mix(mix(c0, c1, m1), c2, m2);

        // the odd whole cell re-laid in the accent texture
        if (dfHash(cell + 91.7) < floorParams.y)
            floorCol = dfSample(floorAccent, local, flip, shift, floorRepeats.w, dx, dy);

        diffuseColor = floorCol * floorTint;
    `)
    return mat
}
