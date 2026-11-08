import { Axis, Color3, Effect, Matrix, PostProcess, Texture, Vector3 } from "@babylonjs/core"

// THE AIR BENDING - a screen-space pass for the sonic boom (effects/sonicBoom.js,
// effects/concussed.js). A shock front is a ring of compressed air: whatever's
// behind it is seen bent through it, like through a lens, and split into its
// colours at the edge. Up to MAX_RIPPLES rings at once, each placed in the
// world and projected to the screen every frame:
//   shockRipple   a ring tearing out from a point and fading (the boom, a hit)
//   trackRipple   a lens riding along with something (the wave in flight)
//   concuss       the whole view, for the one it hit: warped, drained, split
//                 into its colours, dark at the edges - easing back to normal
// The pass is on the active camera only while something's showing, so it
// costs nothing the rest of the time; its shader is compiled ahead
// (prewarmSonicDistortion) so the first boom doesn't wait for it. Menus drawn
// with Babylon GUI stay sharp over it (keepMenusSharp, as sleepDeprivation.js).

const MAX_RIPPLES = 4
// how long the pass stays on with nothing to show before it's taken off -
// booms come in runs, no point rebuilding it between them
const IDLE_DETACH_MS = 1500
// past this from the camera a ring's not worth a slot
const MAX_DISTANCE = 45
// the clock wraps here - small values keep the wobble smooth at mediump
const TIME_WRAP_S = 600

const SHADER = "sonicDistortion"
const RIPPLE_UNIFORMS = Array.from({ length: MAX_RIPPLES }, (_, i) => [`wave${i}`, `look${i}`]).flat()
Effect.ShadersStore[`${SHADER}FragmentShader`] = `
precision highp float;

varying vec2 vUV;
uniform sampler2D textureSampler;
${RIPPLE_UNIFORMS.map(name => `uniform vec4 ${name};`).join("\n")}
uniform float aspect;
uniform float concussion;
uniform float time;
uniform vec3 tint;

// wave: centre (uv), radius and strength. look: thickness, colour split, rim
// light. Radius and thickness in screen heights.
void ripple(vec2 uv, vec4 wave, vec4 look, inout vec2 bend, inout vec2 split, inout float rim){
    if(wave.w <= 0.0001) return;
    vec2 d = (uv - wave.xy) * vec2(aspect, 1.0);
    float dist = length(d);
    float band = (dist - wave.z) / max(look.x, 0.0001);
    if(abs(band) >= 1.0) return;
    float k = 1.0 - band * band;
    k *= k;
    vec2 n = dist > 0.0001 ? d / dist : vec2(0.0);
    n.x /= aspect;
    // the lens: behind the front pulled out, ahead of it pulled in - the
    // world behind it bulges through the ring
    bend -= n * band * k * wave.w * look.x;
    split += n * k * wave.w * look.y * look.x * 0.22;
    rim += k * k * wave.w * look.z;
}

void main(void){
    vec2 uv = vUV;
    vec2 bend = vec2(0.0);
    vec2 split = vec2(0.0);
    float rim = 0.0;
${Array.from({ length: MAX_RIPPLES }, (_, i) => `    ripple(uv, wave${i}, look${i}, bend, split, rim);`).join("\n")}

    // concussed: everything swims, splits apart toward the edges
    vec2 c = uv - 0.5;
    float edge = dot(c * vec2(aspect, 1.0), c * vec2(aspect, 1.0));
    bend += concussion * 0.007 * vec2(sin(uv.y * 23.0 + time * 13.0), cos(uv.x * 17.0 + time * 11.0));
    split += c * concussion * 0.035;

    vec2 at = uv + bend;
    float r = texture2D(textureSampler, clamp(at + split, 0.001, 0.999)).r;
    float g = texture2D(textureSampler, clamp(at, 0.001, 0.999)).g;
    float b = texture2D(textureSampler, clamp(at - split, 0.001, 0.999)).b;
    vec3 colour = vec3(r, g, b) + tint * min(rim, 1.2);

    float grey = dot(colour, vec3(0.299, 0.587, 0.114));
    colour = mix(colour, vec3(grey), concussion * 0.3);
    colour *= 1.0 - concussion * smoothstep(0.15, 0.65, edge) * 0.38;
    colour += concussion * concussion * 0.06;
    gl_FragColor = vec4(colour, 1.0);
}
`

// ── the rings ────────────────────────────────────────────────────────────────

const states = new WeakMap()   // scene -> state

function stateOf(scene){
    let state = states.get(scene)
    if(state) return state
    state = {
        ripples: new Set(),
        concussion: { start: 0, ms: 0, amount: 0 },
        pp: null, camera: null, idleSince: 0, time: 0,
        uniforms: { waves: [], tint: new Color3(0, 0, 0), concussion: 0, aspect: 1 },
        observer: null,
    }
    for(let i = 0; i < MAX_RIPPLES; i++) state.uniforms.waves.push({ wave: [0, 0, 0, 0], look: [0, 0, 0, 0] })
    states.set(scene, state)
    scene.onDisposeObservable.addOnce(() => states.delete(scene))
    return state
}

/**
 * A ring of bent air tearing out from `at` (world) to `radius` metres over
 * `ms`, fading as it goes. thickness: how deep the shell is, in metres, at
 * its start (it thins as it spreads). strength: how hard it bends (about
 * 0.3 a shimmer .. 1 a slam). chroma: how far it splits the colours. rim:
 * how much it lights up, in `tint`.
 */
export function shockRipple(scene, at, { radius = 6, ms = 600, strength = 0.8, thickness = 1.4, chroma = 1, rim = 0.4, tint = null } = {}){
    if(!scene || scene.isDisposed) return
    const start = performance.now()
    const centre = at.clone()
    track(scene, {
        sample(now){
            const t = (now - start) / ms
            if(t >= 1) return null
            const out = 1 - Math.pow(1 - t, 2.2)
            const across = 0.15 + (radius - 0.15) * out
            return {
                at: centre,
                radius: across,
                // born a thin ring, not a lens over everything inside it -
                // it only thickens as it opens out, then thins as it fades
                thickness: Math.min(thickness, 0.12 + across * 0.45) * (1 - 0.55 * t),
                strength: strength * Math.pow(1 - t, 1.3),
                chroma, rim, tint,
            }
        },
    })
}

/**
 * A lens of bent air riding along with something - get() each frame returns
 * { at, radius, thickness, strength } (world, metres), or null once it's
 * done. Also dispose() to take it off.
 */
export function trackRipple(scene, get, { chroma = 0.8, rim = 0.3, tint = null } = {}){
    if(!scene || scene.isDisposed) return { dispose(){} }
    const ripple = track(scene, {
        sample(){
            const now = get()
            return now ? { chroma, rim, tint, ...now } : null
        },
    })
    return { dispose: () => stateOf(scene).ripples.delete(ripple) }
}

/** My own view knocked silly for `ms`, `amount` (0..1) at its worst, easing off. */
export function concuss(scene, ms = 1500, amount = 1){
    if(!scene || scene.isDisposed) return
    const state = stateOf(scene)
    const now = performance.now()
    const left = concussionAt(state, now)
    state.concussion = { start: now, ms, amount: Math.min(1, Math.max(left, amount)) }
    watch(scene)
}

function concussionAt(state, now){
    const { start, ms, amount } = state.concussion
    const t = (now - start) / Math.max(1, ms)
    if(t >= 1 || !amount) return 0
    // in hard, a beat at its worst, then easing back
    const fall = t < 0.12 ? 1 : 1 - Math.pow((t - 0.12) / 0.88, 0.7)
    return amount * fall
}

function track(scene, ripple){
    stateOf(scene).ripples.add(ripple)
    watch(scene)
    return ripple
}

// ── each frame ───────────────────────────────────────────────────────────────

const projected = new Vector3()
const toward = new Vector3()

function watch(scene){
    const state = stateOf(scene)
    state.idleSince = 0
    if(state.observer) return
    state.observer = scene.onBeforeRenderObservable.add(() => step(scene, state))
}

function step(scene, state){
    const now = performance.now()
    state.time = (state.time + scene.getEngine().getDeltaTime() / 1000) % TIME_WRAP_S
    const camera = scene.activeCamera
    const samples = []
    for(const ripple of state.ripples){
        const sample = ripple.sample(now)
        if(!sample){
            state.ripples.delete(ripple)
            continue
        }
        if(camera){
            const placed = onScreen(scene, camera, sample)
            if(placed) samples.push(placed)
        }
    }
    samples.sort((a, b) => b.weight - a.weight)
    const u = state.uniforms
    u.waves.forEach((slot, i) => {
        const s = samples[i]
        if(!s){
            slot.wave[3] = 0
            return
        }
        slot.wave[0] = s.x
        slot.wave[1] = s.y
        slot.wave[2] = s.radius
        slot.wave[3] = s.strength
        slot.look[0] = s.thickness
        slot.look[1] = s.chroma
        slot.look[2] = s.rim
    })
    const lead = samples.find(s => s.tint)
    if(lead) u.tint.copyFrom(lead.tint)
    u.concussion = concussionAt(state, now)

    const showing = samples.length > 0 || u.concussion > 0.001
    if(showing) state.idleSince = 0
    else if(!state.idleSince) state.idleSince = now
    const keep = showing || now - state.idleSince < IDLE_DETACH_MS
    syncPass(scene, state, keep)
    // nothing left to watch at all - stop looking until the next one
    if(!keep && !state.ripples.size){
        scene.onBeforeRenderObservable.remove(state.observer)
        state.observer = null
    }
}

// a ring from the world onto the screen: its centre in uv, its radius and
// thickness in screen heights - or null, behind the camera or too far to see
function onScreen(scene, camera, sample){
    const engine = scene.getEngine()
    const width = engine.getRenderWidth()
    const height = engine.getRenderHeight()
    if(!width || !height) return null
    camera.globalPosition.subtractToRef(sample.at, toward)
    const distance = toward.length()
    if(distance > MAX_DISTANCE) return null
    const depth = -Vector3.Dot(toward, camera.getDirection(Axis.Z))
    if(depth < 0.2) return null
    const viewport = camera.viewport.toGlobal(width, height)
    Vector3.ProjectToRef(sample.at, Matrix.IdentityReadOnly, scene.getTransformMatrix(), viewport, projected)
    // metres -> screen heights, at that depth
    const perMetre = 1 / (2 * depth * Math.tan((camera.fov ?? 0.8) / 2))
    const radius = sample.radius * perMetre
    const thickness = Math.min(0.3, Math.max(0.012, sample.thickness * perMetre))
    const x = projected.x / width
    const y = 1 - projected.y / height
    // wholly off the screen
    if(x + radius + thickness < -0.5 || x - radius - thickness > 1.5 || y + radius + thickness < 0 || y - radius - thickness > 1) return null
    // the far ones barely bend - a ring a few pixels wide can't carry it
    const near = 1 - Math.max(0, (distance - MAX_DISTANCE * 0.6) / (MAX_DISTANCE * 0.4))
    const strength = sample.strength * near
    if(strength < 0.01) return null
    return { x, y, radius, thickness, strength, chroma: sample.chroma, rim: sample.rim, tint: sample.tint, weight: strength * thickness }
}

// ── the pass ─────────────────────────────────────────────────────────────────

function syncPass(scene, state, showing){
    const camera = scene.activeCamera
    if(state.pp && (!showing || state.camera !== camera)){
        state.pp.dispose(state.camera)
        state.pp = null
        state.camera = null
    }
    if(!showing || !camera || state.pp) return
    const pp = makePass(camera, scene.getEngine())
    const u = state.uniforms
    pp.onApply = effect => {
        u.waves.forEach((slot, i) => {
            effect.setFloat4(`wave${i}`, slot.wave[0], slot.wave[1], slot.wave[2], slot.wave[3])
            effect.setFloat4(`look${i}`, slot.look[0], slot.look[1], slot.look[2], 0)
        })
        effect.setFloat("aspect", pp.width / Math.max(1, pp.height))
        effect.setFloat("concussion", u.concussion)
        effect.setFloat("time", state.time)
        effect.setColor3("tint", u.tint)
    }
    state.pp = pp
    state.camera = camera
    keepMenusSharp(scene)
}

function makePass(camera, engine){
    return new PostProcess(SHADER, SHADER, [...RIPPLE_UNIFORMS, "aspect", "concussion", "time", "tint"],
        null, 1, camera, Texture.BILINEAR_SAMPLINGMODE, engine)
}

const prewarmed = new WeakSet()
/**
 * Compiles the pass's shader now, off any camera - the engine keeps it, so the
 * first boom's pass is ready the moment it's made.
 */
export function prewarmSonicDistortion(scene){
    if(!scene || scene.isDisposed || prewarmed.has(scene)) return
    prewarmed.add(scene)
    const pp = new PostProcess(SHADER, SHADER, [...RIPPLE_UNIFORMS, "aspect", "concussion", "time", "tint"],
        null, 1, null, Texture.BILINEAR_SAMPLINGMODE, scene.getEngine())
    const done = () => pp.dispose()
    let tries = 0
    const wait = () => {
        if(pp.isReady() || ++tries > 200) return done()
        setTimeout(wait, 50)
    }
    wait()
}

// a fullscreen Babylon GUI is drawn before the camera's post-processes by
// default - bent and split with the world. Drawn after them instead.
function keepMenusSharp(scene){
    scene.layers?.forEach(layer => {
        if(!layer.isBackground && layer.texture?.getClassName?.() === "AdvancedDynamicTexture") layer.applyPostProcess = false
    })
}
