import { chain, filter, gainNode, hit, noiseSource, oscillator, softClip, synthSound } from "../tools/synthSound.js"

// THE BLESSING CEREMONY'S SOUNDS (effects/blessingReveal.js), made in code
// (tools/synthSound.js) like effects/darkSlashSounds.js's:
//   blessSummonS   the light coming down on you - a shimmer falling out of the
//                  sky, a soft boom as it lands
//   blessRevealS   a card turning to face you - a bell, struck. Played a step
//                  higher each card, so a run of them climbs
//   blessDrawS     a card being pulled into you - a breath drawn in, rising,
//                  cut off
//   blessAbsorbS   it going in - a thump in the chest, a bright chord ringing out
//   blessFinaleS   the last one in - a deep boom, a gong, the chord swelling
//                  open, bells climbing over it
// soundSystem.js's initSounds calls addBlessingSounds; each turns up in its
// allSounds a moment later.

export function addBlessingSounds(scene, into){
    synthSound(scene, into, "blessSummonS", 1.9, summon, { volume: 0.55 })
    synthSound(scene, into, "blessRevealS", 1.3, reveal, { volume: 0.42 })
    synthSound(scene, into, "blessDrawS", 0.6, draw, { volume: 0.5 })
    synthSound(scene, into, "blessAbsorbS", 1.6, absorb, { volume: 0.62 })
    synthSound(scene, into, "blessFinaleS", 3.2, finale, { volume: 0.75 })
}

// a bell: a few partials not quite in tune with each other, struck and
// ringing out - the higher ones dying first
const BELL = [[1, 1, 1], [2, 0.42, 0.7], [2.76, 0.32, 0.5], [4.07, 0.16, 0.32], [5.4, 0.09, 0.22]]
function bell(ctx, into, frequency, at, loud, ring){
    BELL.forEach(([ratio, level, length]) => {
        const tone = oscillator(ctx, "sine", frequency * ratio, at, at + ring * length + 0.05)
        const gain = gainNode(ctx)
        hit(gain.gain, at, loud * level, 0.003, ring * length)
        chain(tone, gain, into)
    })
}

function summon(ctx, T){
    const out = chain(softClip(ctx, 1.4), ctx.destination)
    const master = gainNode(ctx, 1)
    master.connect(out)

    // the shimmer coming down: a high major chord, each note a pair a few
    // hertz apart (that's the shimmer), sliding down a little as it falls
    const shimmer = gainNode(ctx)
    shimmer.gain.linearRampToValueAtTime(0.32, 0.25)
    shimmer.gain.linearRampToValueAtTime(0.22, 0.9)
    shimmer.gain.linearRampToValueAtTime(0.0001, T - 0.05)
    shimmer.connect(master)
    ;[1318.5, 1661.2, 1975.5, 2637].forEach((frequency, i) => {
        ;[0, 3.5].forEach(beat => {
            const tone = oscillator(ctx, "sine", frequency + beat, 0, T)
            tone.frequency.exponentialRampToValueAtTime((frequency + beat) * 0.94, 0.25)
            const level = gainNode(ctx, 0.5 / (1 + i * 0.4))
            chain(tone, level, shimmer)
        })
    })

    // the rush of it falling: noise through a band sweeping down
    const rush = noiseSource(ctx, 0, 0.75)
    const band = filter(ctx, "bandpass", 7000, 1.4)
    band.frequency.exponentialRampToValueAtTime(500, 0.24)
    const rushGain = gainNode(ctx, 0.0001)
    rushGain.gain.exponentialRampToValueAtTime(0.55, 0.2)
    rushGain.gain.exponentialRampToValueAtTime(0.0001, 0.7)
    chain(rush, band, rushGain, master)

    // landing - a soft boom, and a bell under the shimmer
    const boom = oscillator(ctx, "sine", 92, 0.19, 1.1)
    boom.frequency.exponentialRampToValueAtTime(36, 0.75)
    const boomGain = gainNode(ctx)
    hit(boomGain.gain, 0.19, 1, 0.006, 0.75)
    chain(boom, boomGain, master)
    bell(ctx, master, 659.25, 0.2, 0.35, 1.5)
}

function reveal(ctx){
    const master = gainNode(ctx, 1)
    master.connect(ctx.destination)
    bell(ctx, master, 1046.5, 0, 0.8, 1.2)
    // and its fifth, softer - a chime rather than one bell
    bell(ctx, master, 1568, 0.012, 0.3, 0.8)
    // the glint on it
    const glint = noiseSource(ctx, 0, 0.14)
    const glintGain = gainNode(ctx)
    hit(glintGain.gain, 0, 0.22, 0.002, 0.1)
    chain(glint, filter(ctx, "highpass", 7500), glintGain, master)
}

function draw(ctx, T){
    const master = gainNode(ctx, 1)
    master.connect(ctx.destination)
    const end = T - 0.03

    // the breath drawn in: noise through a band rising, swelling, cut off
    const breath = noiseSource(ctx, 0, T)
    const band = filter(ctx, "bandpass", 300, 1.3)
    band.frequency.exponentialRampToValueAtTime(5200, end)
    const breathGain = gainNode(ctx, 0.0001)
    breathGain.gain.exponentialRampToValueAtTime(0.9, end)
    breathGain.gain.linearRampToValueAtTime(0, T)
    chain(breath, band, breathGain, master)

    // the pull under it, a tone climbing
    const pull = oscillator(ctx, "triangle", 170, 0, T)
    pull.frequency.exponentialRampToValueAtTime(1100, end)
    const pullGain = gainNode(ctx, 0.0001)
    pullGain.gain.exponentialRampToValueAtTime(0.28, end)
    pullGain.gain.linearRampToValueAtTime(0, T)
    chain(pull, pullGain, master)
}

function absorb(ctx, T){
    const out = chain(softClip(ctx, 1.8), ctx.destination)
    const master = gainNode(ctx, 1)
    master.connect(out)

    // the thump in the chest
    const thump = oscillator(ctx, "sine", 125, 0, 0.6)
    thump.frequency.exponentialRampToValueAtTime(40, 0.3)
    const thumpGain = gainNode(ctx)
    hit(thumpGain.gain, 0, 1.15, 0.003, 0.45)
    chain(thump, thumpGain, master)
    const crack = noiseSource(ctx, 0, 0.08)
    const crackGain = gainNode(ctx)
    hit(crackGain.gain, 0, 0.45, 0.001, 0.06)
    chain(crack, filter(ctx, "highpass", 2400), crackGain, master)

    // the chord - C major, bright, ringing out
    const chord = gainNode(ctx, 1)
    chord.connect(master)
    ;[523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) => {
        ;[0, 2.2].forEach(beat => {
            const tone = oscillator(ctx, "triangle", frequency + beat, 0.01, T)
            const gain = gainNode(ctx)
            hit(gain.gain, 0.01, 0.2 / (1 + i * 0.25), 0.012, T - 0.2)
            chain(tone, gain, chord)
        })
    })
    // a sparkle over it
    const sparkle = noiseSource(ctx, 0.01, 0.9)
    const sparkleBand = filter(ctx, "bandpass", 9000, 2)
    const sparkleGain = gainNode(ctx)
    hit(sparkleGain.gain, 0.01, 0.16, 0.01, 0.8)
    chain(sparkle, sparkleBand, sparkleGain, master)
}

function finale(ctx, T){
    const out = chain(softClip(ctx, 1.6), ctx.destination)
    const master = gainNode(ctx, 1)
    master.connect(out)

    // the boom, and the ground rumbling with it
    const boom = oscillator(ctx, "sine", 72, 0, 1.6)
    boom.frequency.exponentialRampToValueAtTime(28, 0.7)
    const boomGain = gainNode(ctx)
    hit(boomGain.gain, 0, 1.25, 0.004, 1.2)
    chain(boom, boomGain, master)
    const rumble = noiseSource(ctx, 0, 1.4, { brown: true })
    const rumbleGain = gainNode(ctx)
    hit(rumbleGain.gain, 0, 0.7, 0.01, 1)
    chain(rumble, filter(ctx, "lowpass", 320), rumbleGain, master)

    // a gong - partials far out of tune with each other, long
    ;[[1, 0.42], [1.48, 0.3], [2.03, 0.24], [2.71, 0.16], [3.6, 0.1]].forEach(([ratio, level]) => {
        const tone = oscillator(ctx, "sine", 155 * ratio, 0, T)
        const gain = gainNode(ctx)
        hit(gain.gain, 0, level, 0.006, T - 0.4)
        chain(tone, gain, master)
    })

    // the chord swelling open: saws, their filter opening
    const pad = filter(ctx, "lowpass", 450, 1.2)
    pad.frequency.exponentialRampToValueAtTime(4200, 0.9)
    pad.frequency.exponentialRampToValueAtTime(1400, T)
    const padGain = gainNode(ctx, 0.0001)
    padGain.gain.exponentialRampToValueAtTime(0.32, 0.45)
    padGain.gain.exponentialRampToValueAtTime(0.0001, T - 0.05)
    chain(pad, padGain, master)
    ;[261.63, 392, 523.25, 659.25].forEach(frequency => {
        ;[0, 1.6].forEach(beat => {
            const saw = oscillator(ctx, "sawtooth", frequency + beat, 0, T)
            const level = gainNode(ctx, 0.12)
            chain(saw, level, pad)
        })
    })

    // bells climbing over it
    ;[1046.5, 1318.5, 1568, 2093].forEach((frequency, i) => bell(ctx, master, frequency, 0.14 + i * 0.12, 0.32, 1.1))
}
