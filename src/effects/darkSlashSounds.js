import { chain, filter, gainNode, hit, noiseSource, oscillator, softClip, synthSound } from "../tools/synthSound.js"

// THE FURY CUTTERS' SOUNDS - the dark slime's ranged attack
// (enemies/rangeAttack.js, effects/darkSlash.js), made in code
// (tools/synthSound.js) like effects/sonicSounds.js's:
//   darkChargeS  it drawing itself in - a low growl swelling, a dark
//                breath sucked in over it, faster and faster
//   darkGlintS   the glint before it lets go - a high, thin "ting" of steel
//   darkSlashS   each cutter leaving it - a tearing whoosh with an edge of
//                ringing steel on it and a weight under it
//   darkCutS     a cutter going through someone - a crack, a wet slice, a thud
// soundSystem.js's initSounds calls addDarkSlashSounds; each turns up in its
// allSounds a moment later.

const CHARGE_S = 1.05

export function addDarkSlashSounds(scene, into){
    synthSound(scene, into, "darkChargeS", CHARGE_S + 0.05, charge, { volume: 0.55 })
    synthSound(scene, into, "darkGlintS", 0.9, glint, { volume: 0.35 })
    synthSound(scene, into, "darkSlashS", 0.7, slash, { volume: 0.75 })
    synthSound(scene, into, "darkCutS", 0.8, cut, { volume: 0.9 })
}

function charge(ctx){
    const T = CHARGE_S
    const out = chain(softClip(ctx, 1.8), ctx.destination)
    const master = gainNode(ctx)
    master.connect(out)
    master.gain.linearRampToValueAtTime(0.85, T * 0.8)
    master.gain.linearRampToValueAtTime(1, T - 0.03)
    master.gain.linearRampToValueAtTime(0, T)

    // the growl: two low saws a hair apart, dark (low-passed), climbing a little
    const growl = filter(ctx, "lowpass", 180, 3)
    growl.frequency.exponentialRampToValueAtTime(700, T)
    const tremolo = gainNode(ctx, 0.55)
    chain(growl, tremolo, master)
    ;[1, 1.021].forEach(detune => {
        const saw = oscillator(ctx, "sawtooth", 46 * detune, 0, T)
        saw.frequency.exponentialRampToValueAtTime(74 * detune, T)
        saw.connect(growl)
    })
    const lfo = oscillator(ctx, "sine", 5, 0, T)
    lfo.frequency.exponentialRampToValueAtTime(26, T)
    const depth = gainNode(ctx, 0.4)
    chain(lfo, depth, tremolo.gain)

    // the breath drawn in over it - a band of noise rising and swelling
    const breath = noiseSource(ctx, 0, T)
    const breathBand = filter(ctx, "bandpass", 400, 2.5)
    breathBand.frequency.exponentialRampToValueAtTime(3000, T)
    const breathGain = gainNode(ctx, 0.0001)
    breathGain.gain.exponentialRampToValueAtTime(0.7, T - 0.02)
    chain(breath, breathBand, breathGain, master)

    // something wrong under it all: a tritone, faint, swelling in
    ;[[110, 0.12], [155.6, 0.09]].forEach(([frequency, loud]) => {
        const tone = oscillator(ctx, "triangle", frequency, 0, T)
        const toneGain = gainNode(ctx, 0.0001)
        toneGain.gain.exponentialRampToValueAtTime(loud, T - 0.05)
        chain(tone, toneGain, master)
    })
}

// steel catching the light: a few high partials, not in tune with each
// other (that's what makes it metal), struck and ringing out
function glint(ctx, seconds){
    const master = gainNode(ctx, 1)
    master.connect(ctx.destination)
    ;[[2637, 0.5, 0.7], [3951, 0.32, 0.5], [5274, 0.2, 0.35], [7040, 0.12, 0.2]].forEach(([frequency, loud, ring]) => {
        const tone = oscillator(ctx, "sine", frequency, 0, seconds)
        const gain = gainNode(ctx)
        hit(gain.gain, 0, loud, 0.003, ring)
        chain(tone, gain, master)
    })
    const tick = noiseSource(ctx, 0, 0.05)
    const tickGain = gainNode(ctx)
    hit(tickGain.gain, 0, 0.3, 0.001, 0.03)
    chain(tick, filter(ctx, "highpass", 6000), tickGain, master)
}

function slash(ctx){
    const out = chain(softClip(ctx, 2), ctx.destination)
    const master = gainNode(ctx, 1)
    master.connect(out)

    // the whoosh: noise through a band sweeping up fast, then falling away
    const air = noiseSource(ctx, 0, 0.6)
    const band = filter(ctx, "bandpass", 500, 1.6)
    band.frequency.exponentialRampToValueAtTime(3800, 0.08)
    band.frequency.exponentialRampToValueAtTime(900, 0.45)
    const airGain = gainNode(ctx)
    hit(airGain.gain, 0, 1, 0.025, 0.4)
    chain(air, band, airGain, master)

    // the edge on it: ringing steel, quick
    ;[[1760, 0.16], [2794, 0.1]].forEach(([frequency, loud]) => {
        const tone = oscillator(ctx, "sine", frequency, 0, 0.5)
        tone.frequency.exponentialRampToValueAtTime(frequency * 0.94, 0.4)
        const gain = gainNode(ctx)
        hit(gain.gain, 0.01, loud, 0.004, 0.32)
        chain(tone, gain, master)
    })

    // the weight under it
    const thoom = oscillator(ctx, "sine", 95, 0, 0.4)
    thoom.frequency.exponentialRampToValueAtTime(42, 0.3)
    const thoomGain = gainNode(ctx)
    hit(thoomGain.gain, 0, 0.9, 0.006, 0.28)
    chain(thoom, thoomGain, master)
}

function cut(ctx){
    const out = chain(softClip(ctx, 2.2), ctx.destination)
    const master = gainNode(ctx, 1)
    master.connect(out)

    // the crack as it goes in
    const crack = noiseSource(ctx, 0, 0.08)
    const crackGain = gainNode(ctx)
    hit(crackGain.gain, 0, 1.2, 0.001, 0.05)
    chain(crack, filter(ctx, "highpass", 2500), crackGain, master)

    // the slice: a hiss of steel through, falling
    const hiss = noiseSource(ctx, 0.005, 0.3)
    const hissBand = filter(ctx, "bandpass", 5200, 3)
    hissBand.frequency.exponentialRampToValueAtTime(2200, 0.25)
    const hissGain = gainNode(ctx)
    hit(hissGain.gain, 0.005, 0.8, 0.004, 0.22)
    chain(hiss, hissBand, hissGain, master)

    // wet: its liquid splattering - a low band of noise, its filter closing fast
    const splat = noiseSource(ctx, 0.01, 0.45)
    const splatBand = filter(ctx, "lowpass", 2000, 4)
    splatBand.frequency.exponentialRampToValueAtTime(260, 0.3)
    const splatGain = gainNode(ctx)
    hit(splatGain.gain, 0.01, 0.9, 0.006, 0.35)
    chain(splat, splatBand, splatGain, master)

    // and the blow itself, in the chest
    const thud = oscillator(ctx, "sine", 120, 0, 0.6)
    thud.frequency.exponentialRampToValueAtTime(40, 0.35)
    const thudGain = gainNode(ctx)
    hit(thudGain.gain, 0, 1.3, 0.003, 0.45)
    chain(thud, thudGain, master)
}
