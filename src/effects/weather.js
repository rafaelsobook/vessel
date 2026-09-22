import { Mesh, VertexData, ShaderMaterial, ShaderStore, Material, Texture, Color3, Color4, Vector3, Scene } from "@babylonjs/core"
import { WEATHER_TYPES } from "../constants/weather.js"

// Rain / snow / sandstorm, drawn entirely on the GPU.
//
// NOT a Babylon ParticleSystem. Those update every particle's position on the
// CPU every frame and re-upload the whole buffer - fine for a 40-ember camp
// fire (tools/particlesystem.js's own createFireParticles), ruinous for the
// 6000+ a convincing downpour needs. Here each drop is one vertex whose
// position never changes; the vertex shader derives where it should be from a
// single `time` uniform, so the per-frame CPU cost of a full storm is one
// float upload plus one vector copy to follow the camera. The geometry is
// built once and never touched again.
//
// Fog isn't drawn at all - it's scene.fogDensity/fogColor, which costs nothing
// because Babylon's own materials already sample it. So "foggy weather" is
// purely a fog-setting change, and rain/snow/sand each ALSO adjust fog on top
// of their particles.
//
// The whole field lives in a box that recentres on the camera every frame, and
// every drop wraps inside that box (the mod() in the shader). A player can
// walk forever and never leave the storm, using a fixed vertex count that
// doesn't depend on world size.

const VERTEX_SHADER = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;          // x = per-drop random seed, y = size jitter

uniform mat4 worldViewProjection;
uniform float time;
uniform vec3 boxSize;
uniform vec3 fallVelocity;  // units/sec; x/z give wind, y is the fall rate
uniform float pointSize;

varying float vSeed;

void main(void) {
    vec3 p = position;

    // Each axis drifts at its own rate and wraps within the box. mod() on a
    // negative number still returns a positive result in GLSL, so upward wind
    // or an inverted fall direction both wrap correctly without a branch.
    vec3 drift = fallVelocity * time;
    p.x = mod(p.x + drift.x + boxSize.x * 0.5, boxSize.x) - boxSize.x * 0.5;
    p.y = mod(p.y + drift.y + boxSize.y * 0.5, boxSize.y) - boxSize.y * 0.5;
    p.z = mod(p.z + drift.z + boxSize.z * 0.5, boxSize.z) - boxSize.z * 0.5;

    vec4 clipPosition = worldViewProjection * vec4(p, 1.0);
    gl_Position = clipPosition;

    // shrink with distance the way a real perspective sprite would - without
    // this every drop is the same size on screen and the field reads as flat
    // noise stuck to the camera rather than weather with depth in it
    gl_PointSize = pointSize * uv.y * (30.0 / max(clipPosition.w, 1.0));
    vSeed = uv.x;
}
`

const FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D particleTexture;
uniform vec4 tint;
uniform float stretch;   // >1 squeezes the sprite horizontally into a streak

varying float vSeed;

void main(void) {
    // gl_PointCoord is 0..1 across the sprite. Squeezing x samples a narrow
    // vertical slice of the texture across the full sprite, which elongates
    // the art into a streak without needing quad geometry (and 4x the
    // vertices) per drop. stretch 1.0 leaves the sprite square.
    vec2 coord = vec2((gl_PointCoord.x - 0.5) * stretch + 0.5, gl_PointCoord.y);
    if (coord.x < 0.0 || coord.x > 1.0) discard;

    vec4 texel = texture2D(particleTexture, coord);
    if (texel.a < 0.01) discard;

    // slight per-drop brightness variation off the seed - a field where every
    // drop is identically bright reads as one flat texture, not as weather
    float shade = 0.75 + 0.25 * fract(vSeed * 91.17);

    gl_FragColor = vec4(texel.rgb * tint.rgb * shade, texel.a * tint.a);
}
`

ShaderStore.ShadersStore["gameWeatherVertexShader"] = VERTEX_SHADER
ShaderStore.ShadersStore["gameWeatherFragmentShader"] = FRAGMENT_SHADER

// Half-extent of the field around the camera. Big enough that the far edge is
// past where fog has already swallowed it, small enough that the fixed vertex
// budget still reads as dense up close.
const BOX = { x: 60, y: 40, z: 60 }

// Per-weather look. `count` is the real cost knob - everything else is free,
// since it's all uniforms on one draw call.
const WEATHER_VISUALS = {
    rain: {
        count: 6000,
        // thin1 is the narrow streak sprite - the same one magiccircles.js
        // uses for its sparkle trail. NOT "thin.webp": the file on disk is
        // thin1, and a wrong texture path fails silently in Babylon (a failed
        // Texture load just renders nothing, no console error), which is
        // exactly how this would look broken again.
        texture: "./images/particles/thin1.webp",
        fallVelocity: new Vector3(-2, -55, 0),   // fast, with a slight wind slant
        tint: new Color4(0.70, 0.80, 0.92, 0.6),
        pointSize: 14,
        stretch: 5,                               // squeeze into a rain streak
        fog: { density: 0.012, color: new Color3(0.45, 0.50, 0.56) },
    },
    snow: {
        count: 3500,
        // flare is the soft round glow sprite - reads as a snowflake catching
        // light rather than a hard dot
        texture: "./images/particles/flare.webp",
        // slow, and drifting sideways enough to read as tumbling rather than
        // dropping straight down like rain. At -4 a flake takes ~10s to cross
        // the field, which is what makes it look like it's settling.
        fallVelocity: new Vector3(2.5, -4, 1.2),
        tint: new Color4(1.0, 1.0, 1.0, 0.9),
        pointSize: 13,
        stretch: 1,                               // round, no elongation
        fog: { density: 0.020, color: new Color3(0.72, 0.76, 0.82) },
    },
    sandstorm: {
        count: 7000,
        texture: "./images/particles/smoke.webp",
        // mostly HORIZONTAL - a sandstorm is wind carrying grit, so the
        // dominant motion is across the player, with only a slow settle
        fallVelocity: new Vector3(-48, -4, -12),
        tint: new Color4(0.80, 0.63, 0.36, 0.38),
        pointSize: 22,
        stretch: 1.6,
        fog: { density: 0.045, color: new Color3(0.72, 0.58, 0.36) },
    },
    // no particles at all - fog is a scene setting, nothing to draw
    fog: {
        count: 0,
        fog: { density: 0.055, color: new Color3(0.70, 0.73, 0.76) },
    },
    clear: {
        count: 0,
        fog: null,   // null = restore whatever the place's own sceneTemp set
    },
}

let current = null     // { weather, mesh, material, scene, observer }
let baseFog = null     // the place's own fog, captured on first change

function buildField(scene, config){
    const positions = new Float32Array(config.count * 3)
    const uvs = new Float32Array(config.count * 2)

    for(let i = 0; i < config.count; i++){
        positions[i * 3]     = (Math.random() - 0.5) * BOX.x
        positions[i * 3 + 1] = (Math.random() - 0.5) * BOX.y
        positions[i * 3 + 2] = (Math.random() - 0.5) * BOX.z
        uvs[i * 2]     = Math.random()          // seed, for per-drop shading
        uvs[i * 2 + 1] = 0.6 + Math.random() * 0.8  // size jitter
    }

    // A REAL index buffer (0,1,2...N-1), even though points need no topology.
    //
    // This is the part that had the field drawing nothing, twice. Points
    // assemble no triangles, so the obvious move is to supply no indices - but
    // VertexData.applyToMesh then calls setIndices([]), and Mesh's submesh
    // builder computes its index count as
    //   getTotalIndices() || (isUnIndexed ? totalVertices : 0)
    // which lands on 0. The documented escape is mesh.isUnIndexed = true, but
    // that setter only calls _markSubMeshesAsAttributesDirty() - it does NOT
    // rebuild the submesh - so setting it after applyToMesh leaves the
    // already-created submesh stuck at 0. The field built, uploaded and ticked
    // every frame while drawing nothing, and a draw of zero elements raises no
    // WebGL error, so it looked like the system wasn't running at all.
    //
    // Supplying indices sidesteps the whole ordering trap and puts this on the
    // same code path every ordinary mesh uses. Cost is 4 bytes per drop
    // (~28KB for the 7000-grain sandstorm) - nothing, for a draw that
    // provably happens.
    const indices = new Uint32Array(config.count)
    for(let i = 0; i < config.count; i++) indices[i] = i

    const mesh = new Mesh("weatherField", scene)
    const vertexData = new VertexData()
    vertexData.positions = positions
    vertexData.uvs = uvs
    vertexData.indices = indices
    vertexData.applyToMesh(mesh, false)

    const material = new ShaderMaterial("weatherMat", scene, "gameWeather", {
        attributes: ["position", "uv"],
        uniforms: ["worldViewProjection", "time", "boxSize", "fallVelocity", "pointSize", "tint", "stretch"],
        samplers: ["particleTexture"],
        needAlphaBlending: true,
    })

    // owned by this material and disposed with it - unlike
    // tools/particlesystem.js's shared cache, exactly one weather field exists
    // at a time and it dies on every weather change, so there's nothing to
    // gain from keeping the texture alive past it
    const texture = new Texture(config.texture, scene)
    texture.hasAlpha = true
    material.setTexture("particleTexture", texture)

    material.setVector3("boxSize", new Vector3(BOX.x, BOX.y, BOX.z))
    material.setVector3("fallVelocity", config.fallVelocity)
    material.setFloat("pointSize", config.pointSize)
    material.setFloat("stretch", config.stretch ?? 1)
    material.setColor4("tint", new Color3(config.tint.r, config.tint.g, config.tint.b), config.tint.a)

    material.pointsCloud = true          // -> Material.PointFillMode
    material.backFaceCulling = false
    material.alphaMode = 2               // ALPHA_COMBINE
    // weather never occludes anything and everything is translucent, so
    // writing depth would make drops cut holes in each other and in the
    // alpha-blended things behind them (fake shadows, glow planes)
    material.disableDepthWrite = true

    mesh.material = material
    mesh.isPickable = false
    // placementMode.js's obstacle scan walks scene.meshes - without this the
    // storm field would register as one enormous thing standing on every
    // candidate spot. Its footprint is past MAX_OBSTACLE_FOOTPRINT so it's
    // already excluded, but the flag makes that intentional rather than
    // incidental on a constant someone may retune later.
    mesh._isPlacementGhost = true
    mesh.alwaysSelectAsActiveMesh = true  // it's always around the camera; skip frustum tests
    mesh.infiniteDistance = false

    return { mesh, material }
}

function applyFog(scene, fog){
    if(!fog){
        // "clear" - put back whatever setupLighting set for this place rather
        // than hardcoding a default, so a naturally murky swamp doesn't come
        // out of a storm looking like open grassland
        if(baseFog){
            scene.fogMode = baseFog.mode
            scene.fogDensity = baseFog.density
            scene.fogColor = baseFog.color.clone()
        }
        return
    }
    scene.fogMode = Scene.FOGMODE_EXP
    scene.fogDensity = fog.density
    scene.fogColor = fog.color.clone()
}

/**
 * Show `weather` in this scene, replacing whatever is showing now.
 * "clear" tears everything down and restores the place's own fog.
 */
export function applyWeather(scene, weather){
    if(!scene || scene.isDisposed) return
    if(!WEATHER_TYPES.includes(weather)) return

    // captured once per scene, before anything overwrites it
    if(!baseFog || baseFog.scene !== scene){
        baseFog = { scene, mode: scene.fogMode, density: scene.fogDensity, color: scene.fogColor.clone() }
    }

    if(current?.scene === scene && current.weather === weather) return
    stopWeather()

    const config = WEATHER_VISUALS[weather]
    applyFog(scene, config.fog)

    if(!config.count){
        current = { weather, scene, mesh: null, material: null, observer: null }
        return
    }

    const { mesh, material } = buildField(scene, config)

    // This field has now silently drawn nothing twice, both times because the
    // submesh ended up with an index count of 0 - a state WebGL reports no
    // error for. Logging the real count once per weather change makes that
    // failure mode visible in devtools instead of looking like the whole
    // system never ran. If indices is ever 0 here, nothing will appear.
    console.log(`[weather] ${weather}: ${config.count} points, submesh indices=${mesh.subMeshes?.[0]?.indexCount ?? 0}, texture=${config.texture}`)

    // The ONLY per-frame work in the entire system: one float, one vector
    // copy. Every drop's motion is derived from `time` inside the shader.
    let elapsed = 0
    const observer = scene.onBeforeRenderObservable.add(() => {
        elapsed += scene.getEngine().getDeltaTime() / 1000
        material.setFloat("time", elapsed)
        const camera = scene.activeCamera
        if(camera) mesh.position.copyFrom(camera.position)
    })

    current = { weather, scene, mesh, material, observer }
}

export function stopWeather(){
    if(!current) return
    const { scene, mesh, material, observer } = current
    current = null

    if(scene && !scene.isDisposed && observer) scene.onBeforeRenderObservable.remove(observer)
    // forceDisposeTextures true - Material.dispose leaves textures alone by
    // default (they're usually shared), but this one belongs solely to this
    // field and weather changes every few minutes, so without it each change
    // would strand another sprite texture on the GPU for the scene's lifetime
    material?.dispose(false, true)
    mesh?.dispose()
}

export function getActiveWeather(){
    return current?.weather ?? "clear"
}
