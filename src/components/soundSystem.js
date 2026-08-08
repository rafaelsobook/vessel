import { Sound } from "@babylonjs/core"
const log = console.log
let allSounds = {}

// Missing/corrupt sound files don't throw synchronously - Sound fetches
// async and fails later (an unhandled promise rejection deep inside
// Babylon's loader, see main.js's unhandledrejection filter for that half
// of it). This only guards the synchronous half: a bad path/options object,
// or the audio engine not being ready yet. Returns null on failure so every
// allSounds.xxx caller can safely no-op via optional chaining instead of
// crashing on a missing/undefined sound.
function createSoundSafe(name, url, scene, options){
    try{
        return new Sound(name, url, scene, null, options)
    }catch(err){
        console.warn(`[soundSystem] failed to load "${url}"`, err)
        return null
    }
}

export function initSounds(scene){

    const swordS1 = createSoundSafe("swordS1", "./sounds/weapons/swordS1.mp3", scene,
    {volume: .5, autoplay: false, loop: false})

    const spearS1 = createSoundSafe("spearS1", "./sounds/weapons/spearS1.mp3", scene,
    {volume: .5, autoplay: false, loop: false})

    const staffS1 = createSoundSafe("staffS1", "./sounds/weapons/staffS1.mp3", scene,
    {volume: .5, autoplay: false, loop: false})

    const punchedS = createSoundSafe("punchedS", "./sounds/weapons/punched.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    const swordWhooshS = createSoundSafe("swordWhooshS", "./sounds/weapons/swordWhooshS.mp3", scene,
    {volume: .5, autoplay: false, loop: false})

    const drawSword = createSoundSafe("drawSword", "./sounds/weapons/drawSword.mp3", scene,
    {volume: 0.8, autoplay: false, loop: false})

    const voiceAttackS = createSoundSafe("voiceAttackS", "./sounds/weapons/voiceAttackS.mp3", scene,
    {volume: .3, autoplay: false, loop: false})

    const enhanceS = createSoundSafe("enhanceS", "./sounds/weapons/enhanceS.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    const goblinDeathS = createSoundSafe("goblinDeathS", "./sounds/monsters/goblindeath.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    const demonoidS = createSoundSafe("demonoidS", "./sounds/monsters/demonoidS.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    const giantencounterS = createSoundSafe("giantencounter", "./sounds/monsters/giantencounter.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    // MAGIC
    const magicCircle = createSoundSafe("magicCircle", "./sounds/magic/magiccircle.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    const fireBallS = createSoundSafe("fireBallS", "./sounds/magic/fireBall.mp3", scene,
    {volume: 0.8, autoplay: false, loop: false})

    const fireHitS = createSoundSafe("fireHitS", "./sounds/magic/firehit.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    const enteredS = createSoundSafe("enteredS", "./sounds/enteredS.mp3", scene,
    {volume: 0.8, autoplay: false, loop: false})


    // effects
    const poisonS = createSoundSafe("poisonS", "./sounds/effects/poisonS.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    const struckS = createSoundSafe("struckS", "./sounds/effects/struckS.mp3", scene,
    {volume: 1, spatialSound: true, maxDistance: 50, autoplay: false, loop: false})

    const rockSmashS = createSoundSafe("rockSmashS", "./sounds/effects/rockSmashS.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    const minningS = createSoundSafe("minningS", "./sounds/weapons/minning.mp3", scene,
    {volume: 1, autoplay: false, loop: false}) // not spatial - plays the same regardless of camera/mesh position

    const pickItemS = createSoundSafe("pickItemS", "./sounds/ui/pickitem.mp3", scene,
    {volume: .7, autoplay: false, loop: false})

    const notif1S = createSoundSafe("notif1S", "./sounds/notifs/notif1S.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    const notif2S = createSoundSafe("notif2S", "./sounds/notifs/notif2S.mp3", scene,
    {volume: 1, autoplay: false, loop: false})
    notif2S?.setPlaybackRate(1.1)

    const runningS = createSoundSafe("runningS", "./sounds/indor/running.mp3", scene,
    {volume: 0.5, autoplay: false, loop: false})

    const woodrunS = createSoundSafe("woodrunS", "./sounds/indor/woodrun.mp3", scene,
    {volume: 0.5, autoplay: false, loop: false})

    // INDOORS
    const woodCreakS = createSoundSafe("woodCreakS", "./sounds/indor/woodCreakS.mp3", scene,
    {volume: 1, autoplay: false, loop: false});

    const keyUnlockingS = createSoundSafe("keyUnlocking", "./sounds/indor/keyUnlocking.mp3", scene,
    {volume: 1, autoplay: false, loop: false});

    const normalDoorOC = createSoundSafe("keyUnlocking", "./sounds/indor/normalDoorOC.mp3", scene,
    {volume: 1, autoplay: false, loop: false});


    const bonfireS = createSoundSafe("enteredS", "./sounds/bonfireS.mp3", scene,
    {volume: 0.4, autoplay: false, loop: true})

    // background music
    // const cinema1 = createSoundSafe('cinema1', './sounds/backg/cinema1.mp3', scene,
    // {volume: .4, autoplay: false, loop: true})

    // const cinema2 = createSoundSafe('cinema2', './sounds/backg/cinema2.mp3', scene,
    // {volume: .4, autoplay: false, loop: true})


    allSounds = {
        bonfireS,
        magicCircle,
        fireBallS,
        fireHitS,
        enteredS,
        giantencounterS,
        struckS,
        rockSmashS,
        minningS,
        // cinema1,cinema2,
        woodCreakS,
        keyUnlockingS, normalDoorOC,
        enhanceS,spearS1,demonoidS,
        runningS, woodrunS,
        poisonS,
        pickItemS,
        swordS1,punchedS,swordWhooshS, drawSword, voiceAttackS,
        staffS1,goblinDeathS,notif1S,notif2S
    }
    return allSounds;
}

export function getAllSounds(){
    return allSounds
}
export function playSound(sound){
    if(sound){
        sound.setPlaybackRate(0.9 + (Math.random()*0.6))
        sound.play()
    }
}

// Sound.play(time, offset, length) - time is a start delay, offset/length are
// where in the clip to start and how long to play, both in seconds. Falls
// back to a normal full-length play() if the buffer isn't decoded yet (can
// happen if this fires right as the scene loads, before getAudioBuffer()
// has anything to report).
export function playHalfSound(sound){
    if(!sound) return
    const duration = sound.getAudioBuffer()?.duration
    if(duration) sound.play(0, 0, duration / 2)
    else sound.play()
}

export function runSound(characterStatSpd){
    if(!allSounds.runningS) return
    if(allSounds.runningS.isPlaying) return log("is playing")
    allSounds.runningS.stop()
    allSounds.runningS.play()
    allSounds.runningS.setPlaybackRate(.8 + characterStatSpd*0.04)
}
