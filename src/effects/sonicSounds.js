import { chain, filter, gainNode, hit, noiseSource, oscillator, softClip, synthSound } from "../tools/synthSound.js"

// THE SONIC BOOM'S SOUNDS - the orangelith's ranged attack
// (enemies/rangeAttack.js, effects/sonicBoom.js), made in code
// (tools/synthSound.js) rather than shipped as files:
//   sonicChargeS  the stone humming itself up - a growl that climbs into a
//                 whine, a tremolo speeding up under it, the air sucked in
//                 at the end
//   sonicBoomS    the boom - a real sonic boom is an N-wave, two cracks a
//                 beat apart ("ba-BOOM"), then the low thump and the long
//                 rumble rolling away
//   sonicHitS     it landing on someone - a hard, close, chest-deep thump
//   earRingS      their ears ringing after (the victim's own client only)
// soundSystem.js's initSounds calls addSonicSounds; each turns up in its
// allSounds a moment later.

const CHARGE_S = 0.95

export function addSonicSounds(scene, into){
    synthSound(scene, into, "sonicChargeS", CHARGE_S + 0.05, charge, { volume: 0.55 })
    synthSound(scene, into, "sonicBoomS", 2, boom, { volume: 1 })
    synthSound(scene, into, "sonicHitS", 1, thump, { volume: 0.9 })
    synthSound(scene, into, "earRingS", 2.6, ringing, { volume: 0.22 })
}

function charge(ctx){
    const T = CHARGE_S
    const out = chain(softClip(ctx, 1.6), ctx.destination)
    const master = gainNode(ctx)
    master.connect(out)
    master.gain.linearRampToValueAtTime(0.9, T * 0.85)
    master.gain.linearRampToValueAtTime(1, T - 0.02)
    master.gain.linearRampToValueAtTime(0, T)

    // the stone's growl: two saws a hair apart, through a band sweeping up
    const band = filter(ctx, "bandpass", 260, 5)
    band.frequency.exponentialRampToValueAtTime(3400, T)
    const tremolo = gainNode(ctx, 0.6)
    chain(band, tremolo, master)
    ;[1, 1.013].forEach(detune => {
        const saw = oscillator(ctx, "sawtooth", 52 * detune, 0, T)
        saw.frequency.exponentialRampToValueAtTime(150 * detune, T)
        saw.connect(band)
    })
    // the throb under it, faster and faster
    const lfo = oscillator(ctx, "sine", 6, 0, T)
    lfo.frequency.exponentialRampToValueAtTime(38, T)
    const depth = gainNode(ctx, 0.4)
    chain(lfo, depth, tremolo.gain)

    // the whine climbing out of it
    const whine = oscillator(ctx, "sine", 240, 0, T)
    whine.frequency.exponentialRampToValueAtTime(1900, T)
    const whineGain = gainNode(ctx, 0.0001)
    whineGain.gain.exponentialRampToValueAtTime(0.28, T)
    chain(whine, whineGain, master)

    // the air drawn in, the last third
    const air = noiseSource(ctx, T * 0.55, T * 0.45)
    const airGain = gainNode(ctx, 0.0001)
    airGain.gain.setValueAtTime(0.0001, T * 0.55)
    airGain.gain.exponentialRampToValueAtTime(0.5, T - 0.01)
    const airBand = filter(ctx, "highpass", 1400)
    airBand.frequency.exponentialRampToValueAtTime(4200, T)
    chain(air, airBand, airGain, master)
}

function boom(ctx){
    const out = chain(softClip(ctx, 2.4), ctx.destination)
    const master = gainNode(ctx, 1)
    master.connect(out)

    // ba-BOOM: the N-wave's two cracks
    ;[[0, 1], [0.12, 0.85]].forEach(([at, loud]) => {
        const crack = noiseSource(ctx, at, 0.25)
        const crackGain = gainNode(ctx)
        hit(crackGain.gain, at, 1.4 * loud, 0.002, 0.09)
        chain(crack, filter(ctx, "lowpass", 5200), crackGain, master)
        // each with its own thump, dropping
        const thud = oscillator(ctx, "sine", 120, at, at + 0.9)
        thud.frequency.exponentialRampToValueAtTime(30, at + 0.5)
        const thudGain = gainNode(ctx)
        hit(thudGain.gain, at, 1.5 * loud, 0.004, 0.75)
        chain(thud, thudGain, master)
    })
    // the air tearing - a band of noise falling
    const tear = noiseSource(ctx, 0, 0.6)
    const tearBand = filter(ctx, "bandpass", 2200, 1.4)
    tearBand.frequency.exponentialRampToValueAtTime(260, 0.55)
    const tearGain = gainNode(ctx)
    hit(tearGain.gain, 0, 0.7, 0.01, 0.5)
    chain(tear, tearBand, tearGain, master)
    // and the rumble rolling away
    const rumble = noiseSource(ctx, 0.02, 1.95, { brown: true })
    const rumbleGain = gainNode(ctx)
    hit(rumbleGain.gain, 0.02, 1.1, 0.05, 1.8)
    chain(rumble, filter(ctx, "lowpass", 220), rumbleGain, master)
}

function thump(ctx){
    const out = chain(softClip(ctx, 2), ctx.destination)
    const master = gainNode(ctx, 1)
    master.connect(out)
    const crack = noiseSource(ctx, 0, 0.2)
    const crackGain = gainNode(ctx)
    hit(crackGain.gain, 0, 1, 0.002, 0.06)
    chain(crack, filter(ctx, "lowpass", 3800), crackGain, master)
    const body = oscillator(ctx, "sine", 150, 0, 0.9)
    body.frequency.exponentialRampToValueAtTime(38, 0.4)
    const bodyGain = gainNode(ctx)
    hit(bodyGain.gain, 0, 1.6, 0.003, 0.6)
    chain(body, bodyGain, master)
    // muffled, as if heard through ringing ears
    const muffle = noiseSource(ctx, 0, 0.9, { brown: true })
    const muffleGain = gainNode(ctx)
    hit(muffleGain.gain, 0, 0.7, 0.02, 0.8)
    chain(muffle, filter(ctx, "lowpass", 600), muffleGain, master)
}

function ringing(ctx, seconds){
    const master = gainNode(ctx)
    master.connect(ctx.destination)
    master.gain.linearRampToValueAtTime(1, 0.12)
    master.gain.setValueAtTime(1, 0.5)
    master.gain.exponentialRampToValueAtTime(0.0001, seconds)
    // two high tones a little apart - they beat against each other, the way a ringing ear wavers
    ;[[3520, 0.6], [3527, 0.5], [4180, 0.25]].forEach(([frequency, loud]) => {
        const tone = oscillator(ctx, "sine", frequency, 0, seconds)
        const gain = gainNode(ctx, loud)
        chain(tone, gain, master)
    })
}
