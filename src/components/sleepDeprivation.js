import { Effect, PostProcess, Texture } from "@babylonjs/core"
import { getCharState, isDead } from "../charactersystem/characterstate.js"

// Running on no sleep - the eyes start to fail. Once characterState.survival
// .sleep drops under SLEEP_THRESHOLD, the view goes soft and doubled, drains of
// colour, and a smoky dark creeps in from the edges, its reach throbbing with a
// heart that beats faster the more tired you are. Every so often the eyelids
// drag shut - a microsleep: the world dims to a slit, then to the dark red of
// light through your own lids, swelling with each heartbeat, the vessels in
// them dark across it - until you jerk awake and the light floods back in too
// bright. The less sleep, the darker it gets, the sooner the next one comes and
// the longer it holds. Resting, a bed or food that fills tireness brings the
// meter back up, and it all fades out again.
//
// One WebGL pass (the fragment shader below) on whatever camera is active, as
// the last post-process - attached only while there's something to show, so
// at 40+ sleep it costs nothing. Menus drawn with Babylon GUI stay sharp over
// it (keepMenusSharp); the HTML HUD is outside the canvas and never touched.

const SLEEP_THRESHOLD = 40

// Everything scales from just under the threshold (first value) to no sleep
// at all (second) - see lerp() below.
// seconds between microsleeps, give or take MICROSLEEP_GAP_SPREAD
const MICROSLEEP_GAP_S     = [40, 5]
const MICROSLEEP_GAP_SPREAD = 0.35
// how long the eyes stay down, give or take a quarter
const MICROSLEEP_LENGTH_S  = [0.9, 3.6]
// how far they close - 1 is shut
const MICROSLEEP_DEPTH     = [0.35, 1]
// the chance a microsleep is fought - the lids flutter back up as they fall
const MICROSLEEP_FIGHT     = [0.3, 0.8]
// a microsleep that closes the eyes at least this far ends in a jolt awake
const JOLT_DEPTH           = 0.6
const HEART_BPM            = [72, 130]
// how quickly the steady part of it follows the sleep meter (time constant)
const SEVERITY_EASE_S      = 2
// the shader's clock wraps here - small values keep the noise smooth at the
// game's mediump precision (main.js: useHighPrecisionFloats false)
const SHADER_TIME_WRAP_S   = 3600

const SHADER = "sleepDeprivation"
Effect.ShadersStore[`${SHADER}FragmentShader`] = `
precision highp float;

varying vec2 vUV;
uniform sampler2D textureSampler;
uniform float time;
uniform float severity;   // 0 rested enough .. 1 no sleep at all
uniform float lids;       // 0 open .. 1 shut - a microsleep
uniform float jolt;       // 1 the moment you snap awake, fading
uniform float pulse;      // the heartbeat, 0..1
uniform float aspect;

float hash(vec2 p){
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
}
float noise(vec2 p){
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
    float v = 0.0;
    float a = 0.5;
    for(int i = 0; i < 4; i++){
        v += a * noise(p);
        p = p * 2.07 + vec2(13.7, 7.3);
        a *= 0.5;
    }
    return v;
}

void main(void){
    vec2 c = vUV - 0.5;
    vec2 p = c * vec2(aspect, 1.0);
    float r = length(p);

    // a heavy head - the view sways, and shudders as you jerk awake
    vec2 uv = vUV;
    uv += vec2(sin(time * 0.53) + 0.5 * sin(time * 1.37), cos(time * 0.41) + 0.5 * sin(time * 0.93)) * 0.003 * severity;
    uv += (vec2(hash(vec2(time, 1.7)), hash(vec2(time, 9.1))) - 0.5) * 0.018 * jolt;

    // fuzzy - a blur that thickens toward the edges and as the lids fall,
    // its ring of taps slowly turning
    float blur = (0.0015 + 0.009 * smoothstep(0.1, 0.8, r)) * severity + 0.010 * lids;
    vec2 rad = vec2(blur / aspect, blur);
    vec3 col = texture2D(textureSampler, uv).rgb;
    for(int i = 0; i < 8; i++){
        float a = float(i) * 0.7854 + time * 0.5;
        float ring = mod(float(i), 2.0) < 0.5 ? 1.0 : 0.5;
        col += texture2D(textureSampler, uv + vec2(cos(a), sin(a)) * rad * ring).rgb;
    }
    col /= 9.0;

    // double vision - a ghost of the view drifting off to one side
    vec2 drift = vec2(cos(time * 0.37), sin(time * 0.23)) * (0.010 * severity + 0.008 * lids) * (0.6 + 0.4 * sin(time * 0.71));
    col = mix(col, texture2D(textureSampler, uv + drift).rgb, 0.4 * min(1.0, severity * 1.6));

    // the colour and the edges go first - plain from just under the threshold,
    // deepening more slowly after; the blur and ghosting above build steadily
    float onset = sqrt(severity);

    // the colour drains out - grey, cold and dim, dimmer on every heartbeat
    float grey = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, grey * vec3(0.9, 0.96, 1.1), 0.7 * onset);
    col *= 1.0 - 0.25 * severity - 0.08 * pulse * onset;

    // the dark closing in - smoky tendrils writhing in from the edges, the
    // clear window narrowing with each beat and as the eyes droop
    vec2 q = p * 2.3;
    float warp = noise(q * 1.6 - time * 0.12);
    float smoke = fbm(q + vec2(time * 0.06, -time * 0.045) + warp * 1.6);
    float window = mix(1.05, 0.4, onset) - 0.06 * pulse * onset - 0.3 * lids;
    float edge = r + (smoke - 0.5) * (0.3 + 0.35 * severity);
    float dark = smoothstep(window - 0.2, window + 0.22, edge) * min(1.0, onset * 2.0 + lids);
    vec3 shadow = vec3(0.01, 0.0, 0.004) + vec3(0.035, 0.0, 0.008) * smoke * pulse;
    col = mix(col, shadow, dark);

    if(lids > 0.001){
        // nodding off - the world dims behind the falling lids
        col *= 1.0 - 0.65 * lids * lids;
        // the lids: an almond-shaped opening narrowing to nothing, soft (your
        // own eyelid is never in focus), ragged where the lashes are
        float xn = c.x * 2.0;
        float halfOpen = mix(-0.1, 0.8, 1.0 - lids) * (1.0 - 0.3 * xn * xn);
        float rag = (noise(vec2(vUV.x * 14.0, time * 0.7)) - 0.5) * 0.05;
        float lid = smoothstep(halfOpen - 0.05 - 0.15 * lids, halfOpen + 0.05, abs(c.y) + rag);
        // light through them: a dim blood-red glow, warmest in the middle and
        // swelling with each heartbeat, the vessels in the lid - big ones and
        // fine ones - dark lines across it
        float big = pow(1.0 - abs(fbm(vUV * vec2(5.0, 3.0) + vec2(1.3, time * 0.01)) * 2.0 - 1.0), 16.0);
        float fine = pow(1.0 - abs(noise(vUV * vec2(26.0, 17.0) + 3.7) * 2.0 - 1.0), 12.0);
        float glow = (0.35 + 0.65 * max(0.0, 1.0 - r * 1.15)) * (0.45 + 0.55 * pulse);
        vec3 inside = vec3(0.14, 0.014, 0.008) * glow * (1.0 - 0.75 * clamp(big + 0.5 * fine, 0.0, 1.0))
            + vec3(0.012, 0.0, 0.002);
        col = mix(col, inside, lid);
    }

    // snapping awake - the light floods back in, too bright for a moment
    col = col * (1.0 + 1.2 * jolt) + 0.05 * jolt;

    // grain - straining to see
    col += (hash(vUV * 1000.0 + fract(time * 7.13) * 91.0) - 0.5) * 0.07 * severity;

    gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`

const lerp = ([from, to], t) => from + (to - from) * t
const clamp01 = v => Math.min(1, Math.max(0, v))

// 0 at SLEEP_THRESHOLD and above, 1 with no sleep left - and 0 once dead
// (gameOver zeroes the meter, and the death screen isn't a microsleep)
function targetSeverity(){
    const sleep = getCharState()?.survival?.sleep
    if(typeof sleep !== "number" || isDead()) return 0
    return clamp01((SLEEP_THRESHOLD - sleep) / SLEEP_THRESHOLD)
}

// areascene.js starts this for every place - the pass itself only appears once
// the sleep meter is under the threshold
export function startSleepDeprivation(scene){
    const engine = scene.getEngine()
    const fx = {
        pp: null, camera: null,
        // null until the first frame - you arrive in a new place already as
        // tired as you are, not easing into it from nothing
        severity: null,
        lids: 0, jolt: 0, pulse: 0, beat: 0, time: 0,
        microsleep: null, nextMicrosleepIn: null,
        sinceMenuCheck: 0,
    }

    scene.onBeforeRenderObservable.add(() => {
        const dt = Math.min(engine.getDeltaTime() / 1000, 0.1)
        fx.time = (fx.time + dt) % SHADER_TIME_WRAP_S
        const target = targetSeverity()
        fx.severity ??= target
        fx.severity += (target - fx.severity) * (1 - Math.exp(-dt / SEVERITY_EASE_S))
        if(fx.severity < 0.001 && target === 0) fx.severity = 0

        updateMicrosleeps(fx, dt)
        updateHeart(fx, dt)
        fx.jolt *= Math.exp(-dt * 5)

        const showing = fx.severity > 0 || fx.lids > 0.002 || fx.jolt > 0.01
        syncPass(scene, fx, showing)
        if(fx.pp && (fx.sinceMenuCheck += dt) > 0.5){
            fx.sinceMenuCheck = 0
            keepMenusSharp(scene)
        }
    })
    // first thing in scene.dispose(), while the camera is still there
    scene.onDisposeObservable.add(() => {
        fx.pp?.dispose(fx.camera)
        fx.pp = null
        fx.camera = null
    })
}

// ── microsleeps ──────────────────────────────────────────────────────────────

function updateMicrosleeps(fx, dt){
    const s = fx.severity
    const m = fx.microsleep
    if(m){
        m.t += dt / m.length
        if(!m.reopened && m.t >= m.reopenAt){
            m.reopened = true
            if(m.depth >= JOLT_DEPTH) fx.jolt = 1
        }
        if(m.t >= 1){
            fx.microsleep = null
            fx.lids = 0
            fx.nextMicrosleepIn = nextGap(s)
            return
        }
        fx.lids = microsleepLids(m, fx.time)
        return
    }
    fx.lids = 0
    if(s <= 0.01){ fx.nextMicrosleepIn = null; return }
    // just slipped under the threshold - the first one doesn't come at once
    fx.nextMicrosleepIn ??= nextGap(s)
    if((fx.nextMicrosleepIn -= dt) > 0) return
    fx.microsleep = {
        t: 0,
        length: lerp(MICROSLEEP_LENGTH_S, s) * (0.75 + Math.random() * 0.5),
        depth: Math.min(1, lerp(MICROSLEEP_DEPTH, s) * (0.85 + Math.random() * 0.25)),
        fights: Math.random() < lerp(MICROSLEEP_FIGHT, s),
        // [0, closeEnd) falling, [closeEnd, reopenAt) shut, then open again
        closeEnd: 0.5,
        reopenAt: 0.82,
        reopened: false,
    }
}

function nextGap(severity){
    return lerp(MICROSLEEP_GAP_S, severity) * (1 - MICROSLEEP_GAP_SPREAD + Math.random() * 2 * MICROSLEEP_GAP_SPREAD)
}

// how closed the eyes are partway through a microsleep
function microsleepLids({ t, depth, fights, closeEnd, reopenAt }, time){
    if(t < closeEnd){
        // heavy - slow to start, then dropping; fought, they flutter back up
        const k = t / closeEnd
        let closed = k * k * (3 - 2 * k)
        if(fights) closed -= 0.3 * Math.sin(k * Math.PI * 3) ** 2 * (1 - k)
        return depth * clamp01(closed)
    }
    // shut, trembling
    if(t < reopenAt) return depth * (0.96 + 0.04 * Math.sin(time * 40))
    // and snapping open
    const k = Math.min(1, (t - reopenAt) / (1 - reopenAt) * 1.6)
    return depth * (1 - k) ** 3
}

// lub-dub, faster the more tired you are
function updateHeart(fx, dt){
    fx.beat = (fx.beat + dt * lerp(HEART_BPM, fx.severity) / 60) % 1
    const lub = Math.exp(-fx.beat * 20)
    const dub = fx.beat > 0.17 ? 0.75 * Math.exp(-(fx.beat - 0.17) * 20) : 0
    fx.pulse = Math.min(1, lub + dub)
}

// ── the pass ─────────────────────────────────────────────────────────────────

// On the active camera while there's something to show, gone otherwise - and
// moved along if the scene switches cameras. Dropping and rebuilding it is
// cheap: the compiled shader stays cached in the engine.
function syncPass(scene, fx, showing){
    const camera = scene.activeCamera
    if(fx.pp && (!showing || fx.camera !== camera)){
        fx.pp.dispose(fx.camera)
        fx.pp = null
        fx.camera = null
    }
    if(!showing || !camera || fx.pp) return

    const pp = new PostProcess("sleepDeprivation", SHADER,
        ["time", "severity", "lids", "jolt", "pulse", "aspect"], null, 1, camera, Texture.BILINEAR_SAMPLINGMODE)
    pp.onApply = effect => {
        effect.setFloat("time", fx.time)
        effect.setFloat("severity", fx.severity)
        effect.setFloat("lids", fx.lids)
        effect.setFloat("jolt", fx.jolt)
        effect.setFloat("pulse", fx.pulse)
        effect.setFloat("aspect", pp.width / Math.max(1, pp.height))
    }
    fx.pp = pp
    fx.camera = camera
    keepMenusSharp(scene)
}

// A fullscreen Babylon GUI (the campcraft panel, the cook list) is drawn before
// the camera's post-processes by default - this would blur and black it out
// with the world. Drawn after them instead, a menu stays readable while your
// eyes fail. Checked again now and then: those panels are built on first use.
function keepMenusSharp(scene){
    // no layers list at all until the first layer is made
    scene.layers?.forEach(layer => {
        if(!layer.isBackground && layer.texture?.getClassName?.() === "AdvancedDynamicTexture") layer.applyPostProcess = false
    })
}
