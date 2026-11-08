import { Sound } from "@babylonjs/core"

// SOUNDS MADE IN CODE - no file to ship. An OfflineAudioContext renders the
// graph build(ctx, seconds) wires up, the result is normalised, packed into a
// 16-bit WAV and handed to Babylon as an ArrayBuffer: from there it's a Sound
// like any other in soundSystem.js's allSounds (play, playSoundNear, volume).
// Rendering takes a few milliseconds, so the sound turns up in `into[key]` a
// moment after the call, not on it - every allSounds user already copes with
// a missing sound (optional chaining).

const SAMPLE_RATE = 44100

/**
 * Renders build(ctx, seconds) - wire everything to ctx.destination - and puts
 * the Sound in into[key] once it's ready. options: Babylon's Sound options
 * (volume, playbackRate...).
 */
export function synthSound(scene, into, key, seconds, build, options = {}){
    if(typeof OfflineAudioContext === "undefined") return
    let ctx
    try {
        ctx = new OfflineAudioContext(1, Math.ceil(seconds * SAMPLE_RATE), SAMPLE_RATE)
        build(ctx, seconds)
    } catch(error){
        console.warn(`[synthSound] couldn't build "${key}"`, error)
        return
    }
    ctx.startRendering().then(buffer => {
        if(scene?.isDisposed) return
        const wav = toWav(normalise(buffer.getChannelData(0)), SAMPLE_RATE)
        try {
            into[key] = new Sound(key, wav, scene, null, { autoplay: false, loop: false, ...options })
        } catch(error){
            console.warn(`[synthSound] couldn't make "${key}"`, error)
        }
    }).catch(error => console.warn(`[synthSound] couldn't render "${key}"`, error))
}

// ── building blocks ──────────────────────────────────────────────────────────

/** A buffer of noise - white, or brown (deep, rumbling: each sample a step off the last). */
export function noiseBuffer(ctx, seconds, { brown = false } = {}){
    const length = Math.ceil(seconds * ctx.sampleRate)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for(let i = 0; i < length; i++){
        const white = Math.random() * 2 - 1
        if(brown){
            last = (last + 0.02 * white) / 1.02
            data[i] = last * 3.5
        } else data[i] = white
    }
    return buffer
}

/** A noise source playing from `at` for `seconds`. */
export function noiseSource(ctx, at, seconds, options){
    const source = ctx.createBufferSource()
    source.buffer = noiseBuffer(ctx, seconds, options)
    source.start(at)
    source.stop(at + seconds)
    return source
}

/** An oscillator playing from `at` to `until`. */
export function oscillator(ctx, type, frequency, at, until){
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(frequency, at)
    osc.start(at)
    osc.stop(until)
    return osc
}

/** A gain node starting silent. */
export function gainNode(ctx, value = 0){
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(value, 0)
    return gain
}

/** A filter. */
export function filter(ctx, type, frequency, q = 0.7){
    const node = ctx.createBiquadFilter()
    node.type = type
    node.frequency.setValueAtTime(frequency, 0)
    node.Q.setValueAtTime(q, 0)
    return node
}

/** A soft clipper - drive pushes it harder, rounding the peaks into grit. */
export function softClip(ctx, drive = 2){
    const shaper = ctx.createWaveShaper()
    const curve = new Float32Array(1024)
    for(let i = 0; i < curve.length; i++){
        const x = i / (curve.length - 1) * 2 - 1
        curve[i] = Math.tanh(x * drive) / Math.tanh(drive)
    }
    shaper.curve = curve
    return shaper
}

/** A sharp hit: up to `peak` in `attack`, then an exponential fall to nothing over `decay`. */
export function hit(param, at, peak, attack, decay){
    param.setValueAtTime(0.0001, at)
    param.exponentialRampToValueAtTime(peak, at + attack)
    param.exponentialRampToValueAtTime(0.0001, at + attack + decay)
}

/** Chains nodes a -> b -> c ..., returns the last. */
export function chain(...nodes){
    for(let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1])
    return nodes[nodes.length - 1]
}

// ── packing ──────────────────────────────────────────────────────────────────

// loud as it can go without clipping
function normalise(samples){
    let peak = 0
    for(let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]))
    if(peak > 0.0001){
        const k = 0.95 / peak
        for(let i = 0; i < samples.length; i++) samples[i] *= k
    }
    return samples
}

function toWav(samples, rate){
    const buffer = new ArrayBuffer(44 + samples.length * 2)
    const view = new DataView(buffer)
    const text = (at, s) => { for(let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i)) }
    text(0, "RIFF")
    view.setUint32(4, 36 + samples.length * 2, true)
    text(8, "WAVE")
    text(12, "fmt ")
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)          // PCM
    view.setUint16(22, 1, true)          // mono
    view.setUint32(24, rate, true)
    view.setUint32(28, rate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    text(36, "data")
    view.setUint32(40, samples.length * 2, true)
    for(let i = 0; i < samples.length; i++){
        const s = Math.max(-1, Math.min(1, samples[i]))
        view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    }
    return buffer
}
