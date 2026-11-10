import { chain, filter, gainNode, hit, noiseSource, oscillator, softClip, synthSound } from "../tools/synthSound.js"

// THE SKILL TOME'S SOUNDS (effects/tomeReveal.js), made in code
// (tools/synthSound.js) like effects/blessingSounds.js's:
//   tomeAppearS  the tome rising before you - a hum swelling, a breath of air,
//                paper stirring
//   tomeStepS    its light climbing a rarity - a rising sweep and a bright
//                ting (played a step higher each time)
//   tomeOpenS    it bursting open - a heavy thoom, the cover slapping back,
//                pages fluttering, a chord opening up over it all
//   tomeCloseS   it slamming shut and crumbling - a thud, dust, a falling chime
// soundSystem.js's initSounds calls addTomeSounds; each turns up in its
// allSounds a moment later.

export function addTomeSounds(scene, into){
    synthSound(scene, into, "tomeAppearS", 1.3, appear, { volume: 0.5 })
    synthSound(scene, into, "tomeStepS", 0.9, step, { volume: 0.5 })
    synthSound(scene, into, "tomeOpenS", 1.8, burst, { volume: 0.7 })
    synthSound(scene, into, "tomeCloseS", 1, slam, { volume: 0.55 })
}

// paper stirring: short bursts of bright noise, scattered
function flutter(ctx, into, from, until, count, loud){
    for(let i = 0; i < count; i++){
        const at = from + (until - from) * (i / count) + Math.random() * 0.02
        const leaf = noiseSource(ctx, at, 0.05)
        const gain = gainNode(ctx)
        hit(gain.gain, at, loud * (0.6 + Math.random() * 0.4), 0.002, 0.04)
        chain(leaf, filter(ctx, "bandpass", 2400 + Math.random() * 2600, 1.6), gain, into)
    }
}

function appear(ctx, T){
    const master = gainNode(ctx, 1)
    master.connect(ctx.destination)
    const hum = oscillator(ctx, "sine", 110, 0, T)
    hum.frequency.exponentialRampToValueAtTime(165, T * 0.7)
    const humGain = gainNode(ctx, 0.0001)
    humGain.gain.exponentialRampToValueAtTime(0.5, 0.5)
    humGain.gain.exponentialRampToValueAtTime(0.0001, T - 0.05)
    chain(hum, humGain, master)
    const air = noiseSource(ctx, 0, T)
    const band = filter(ctx, "bandpass", 300, 1.2)
    band.frequency.exponentialRampToValueAtTime(2400, 0.7)
    const airGain = gainNode(ctx)
    hit(airGain.gain, 0, 0.5, 0.35, T - 0.45)
    chain(air, band, airGain, master)
    flutter(ctx, master, 0.25, 0.75, 6, 0.25)
    ;[659.25, 987.77].forEach(frequency => {
        const tone = oscillator(ctx, "sine", frequency, 0.5, T)
        const gain = gainNode(ctx)
        hit(gain.gain, 0.5, 0.12, 0.05, T - 0.6)
        chain(tone, gain, master)
    })
}

function step(ctx, T){
    const out = chain(softClip(ctx, 1.4), ctx.destination)
    const master = gainNode(ctx, 1)
    master.connect(out)
    // the rush up into it
    const rush = noiseSource(ctx, 0, 0.3)
    const band = filter(ctx, "bandpass", 600, 1.5)
    band.frequency.exponentialRampToValueAtTime(5000, 0.22)
    const rushGain = gainNode(ctx, 0.0001)
    rushGain.gain.exponentialRampToValueAtTime(0.6, 0.2)
    rushGain.gain.exponentialRampToValueAtTime(0.0001, 0.28)
    chain(rush, band, rushGain, master)
    // and the ting as it lands on the new colour - a bell, its fifth over it
    ;[[1174.7, 0.6], [1760, 0.3], [2349.3, 0.15]].forEach(([frequency, loud]) => {
        const tone = oscillator(ctx, "sine", frequency, 0.2, T)
        const gain = gainNode(ctx)
        hit(gain.gain, 0.2, loud, 0.003, T - 0.25)
        chain(tone, gain, master)
    })
    const thump = oscillator(ctx, "sine", 140, 0.2, 0.6)
    thump.frequency.exponentialRampToValueAtTime(60, 0.45)
    const thumpGain = gainNode(ctx)
    hit(thumpGain.gain, 0.2, 0.6, 0.004, 0.25)
    chain(thump, thumpGain, master)
}

function burst(ctx, T){
    const out = chain(softClip(ctx, 1.7), ctx.destination)
    const master = gainNode(ctx, 1)
    master.connect(out)
    const thoom = oscillator(ctx, "sine", 95, 0, 0.9)
    thoom.frequency.exponentialRampToValueAtTime(34, 0.6)
    const thoomGain = gainNode(ctx)
    hit(thoomGain.gain, 0, 1.2, 0.004, 0.75)
    chain(thoom, thoomGain, master)
    // the cover slapping back
    const slap = noiseSource(ctx, 0, 0.12)
    const slapGain = gainNode(ctx)
    hit(slapGain.gain, 0, 0.9, 0.002, 0.09)
    chain(slap, filter(ctx, "lowpass", 1400), slapGain, master)
    // pages racing over
    flutter(ctx, master, 0.06, 0.7, 16, 0.35)
    // the chord opening up - C major, a choir-ish pad, its filter opening
    const pad = filter(ctx, "lowpass", 600, 1)
    pad.frequency.exponentialRampToValueAtTime(5000, 0.6)
    const padGain = gainNode(ctx, 0.0001)
    padGain.gain.exponentialRampToValueAtTime(0.3, 0.25)
    padGain.gain.exponentialRampToValueAtTime(0.0001, T - 0.05)
    chain(pad, padGain, master)
    ;[261.63, 329.63, 392, 523.25, 659.25].forEach(frequency => {
        ;[0, 2.4].forEach(beat => {
            const voice = oscillator(ctx, "sawtooth", frequency + beat, 0, T)
            const level = gainNode(ctx, 0.07)
            chain(voice, level, pad)
        })
    })
    const sparkle = noiseSource(ctx, 0.05, 1)
    const sparkleGain = gainNode(ctx)
    hit(sparkleGain.gain, 0.05, 0.18, 0.02, 0.9)
    chain(sparkle, filter(ctx, "bandpass", 9000, 2), sparkleGain, master)
}

function slam(ctx, T){
    const master = gainNode(ctx, 1)
    master.connect(ctx.destination)
    const thud = oscillator(ctx, "sine", 120, 0, 0.4)
    thud.frequency.exponentialRampToValueAtTime(45, 0.25)
    const thudGain = gainNode(ctx)
    hit(thudGain.gain, 0, 1, 0.002, 0.3)
    chain(thud, thudGain, master)
    const clap = noiseSource(ctx, 0, 0.1)
    const clapGain = gainNode(ctx)
    hit(clapGain.gain, 0, 0.7, 0.001, 0.07)
    chain(clap, filter(ctx, "lowpass", 2000), clapGain, master)
    // dust crumbling away
    const dust = noiseSource(ctx, 0.08, T - 0.1)
    const dustGain = gainNode(ctx)
    hit(dustGain.gain, 0.08, 0.35, 0.05, T - 0.25)
    chain(dust, filter(ctx, "lowpass", 900), dustGain, master)
    ;[1318.5, 987.77, 783.99].forEach((frequency, i) => {
        const tone = oscillator(ctx, "sine", frequency, 0.12 + i * 0.1, T)
        const gain = gainNode(ctx)
        hit(gain.gain, 0.12 + i * 0.1, 0.12, 0.004, 0.45)
        chain(tone, gain, master)
    })
}
