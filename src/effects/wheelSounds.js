import { chain, filter, gainNode, hit, noiseSource, oscillator, softClip, synthSound } from "../tools/synthSound.js"

// THE FORTUNE WHEEL'S SOUNDS (effects/fortuneWheel.js), made in code
// (tools/synthSound.js) like effects/blessingSounds.js's:
//   wheelAppearS  the wheel unfolding round you - a deep swell, a ratchet of
//                 clockwork clicks, a shimmer on top as it locks in place
//   wheelSpinS    the hand let go - a whoosh tearing round
//   wheelTickS    the hand passing a peg - a crisp click (played many times,
//                 a little differently each)
//   wheelLandS    the hand landing - a deep bell, its octave, a sparkle, a thump
// soundSystem.js's initSounds calls addWheelSounds; each turns up in its
// allSounds a moment later.

export function addWheelSounds(scene, into){
    synthSound(scene, into, "wheelAppearS", 1.4, appear, { volume: 0.5 })
    synthSound(scene, into, "wheelSpinS", 0.75, spin, { volume: 0.45 })
    synthSound(scene, into, "wheelTickS", 0.09, tick, { volume: 0.35 })
    synthSound(scene, into, "wheelLandS", 1.8, land, { volume: 0.6 })
}

function appear(ctx, T){
    const out = chain(softClip(ctx, 1.5), ctx.destination)
    const master = gainNode(ctx, 1)
    master.connect(out)

    // the swell under it, rising as it opens out
    const swell = oscillator(ctx, "sine", 55, 0, 0.9)
    swell.frequency.exponentialRampToValueAtTime(110, 0.6)
    const swellGain = gainNode(ctx, 0.0001)
    swellGain.gain.exponentialRampToValueAtTime(0.9, 0.35)
    swellGain.gain.exponentialRampToValueAtTime(0.0001, 0.85)
    chain(swell, swellGain, master)

    // clockwork: clicks coming faster, then the catch
    let at = 0.04
    for(let i = 0; i < 7; i++){
        const click = noiseSource(ctx, at, 0.03)
        const clickGain = gainNode(ctx)
        hit(clickGain.gain, at, 0.55, 0.001, 0.025)
        chain(click, filter(ctx, "bandpass", 2600 + i * 180, 5), clickGain, master)
        at += 0.085 - i * 0.008
    }
    const knock = oscillator(ctx, "sine", 160, at, at + 0.3)
    knock.frequency.exponentialRampToValueAtTime(70, at + 0.2)
    const knockGain = gainNode(ctx)
    hit(knockGain.gain, at, 0.9, 0.003, 0.25)
    chain(knock, knockGain, master)

    // the shimmer as it locks
    ;[880, 1318.5, 1760].forEach((frequency, i) => {
        const tone = oscillator(ctx, "sine", frequency, at, T)
        const gain = gainNode(ctx)
        hit(gain.gain, at, 0.18 / (1 + i * 0.5), 0.01, T - at - 0.05)
        chain(tone, gain, master)
    })
}

function spin(ctx, T){
    const master = gainNode(ctx, 1)
    master.connect(ctx.destination)
    const air = noiseSource(ctx, 0, T)
    const band = filter(ctx, "bandpass", 500, 1.4)
    band.frequency.exponentialRampToValueAtTime(3200, 0.18)
    band.frequency.exponentialRampToValueAtTime(700, T - 0.05)
    const airGain = gainNode(ctx)
    hit(airGain.gain, 0, 1, 0.06, T - 0.1)
    chain(air, band, airGain, master)
}

function tick(ctx){
    const master = gainNode(ctx, 1)
    master.connect(ctx.destination)
    const click = noiseSource(ctx, 0, 0.04)
    const clickGain = gainNode(ctx)
    hit(clickGain.gain, 0, 1, 0.0008, 0.03)
    chain(click, filter(ctx, "bandpass", 3200, 4), clickGain, master)
    const ping = oscillator(ctx, "sine", 1900, 0, 0.08)
    const pingGain = gainNode(ctx)
    hit(pingGain.gain, 0, 0.3, 0.001, 0.06)
    chain(ping, pingGain, master)
    const knock = oscillator(ctx, "sine", 210, 0, 0.06)
    const knockGain = gainNode(ctx)
    hit(knockGain.gain, 0, 0.45, 0.001, 0.045)
    chain(knock, knockGain, master)
}

function land(ctx, T){
    const out = chain(softClip(ctx, 1.6), ctx.destination)
    const master = gainNode(ctx, 1)
    master.connect(out)
    const thump = oscillator(ctx, "sine", 110, 0, 0.5)
    thump.frequency.exponentialRampToValueAtTime(42, 0.3)
    const thumpGain = gainNode(ctx)
    hit(thumpGain.gain, 0, 1, 0.003, 0.4)
    chain(thump, thumpGain, master)
    // a big bell, struck - partials out of tune with each other, the high ones dying first
    ;[[1, 0.9, 1], [2, 0.4, 0.75], [2.76, 0.3, 0.55], [4.07, 0.14, 0.35], [5.4, 0.08, 0.25]].forEach(([ratio, loud, length]) => {
        ;[392, 784].forEach((base, octave) => {
            const tone = oscillator(ctx, "sine", base * ratio, 0, T)
            const gain = gainNode(ctx)
            hit(gain.gain, 0.002, loud * (octave ? 0.45 : 0.6), 0.003, (T - 0.1) * length)
            chain(tone, gain, master)
        })
    })
    const sparkle = noiseSource(ctx, 0.01, 0.7)
    const sparkleGain = gainNode(ctx)
    hit(sparkleGain.gain, 0.01, 0.2, 0.01, 0.6)
    chain(sparkle, filter(ctx, "bandpass", 8500, 2), sparkleGain, master)
}
