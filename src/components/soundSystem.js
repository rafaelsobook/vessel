import { Sound, Vector3 } from "@babylonjs/core"
import { addSonicSounds } from "../effects/sonicSounds.js"
import { addDarkSlashSounds } from "../effects/darkSlashSounds.js"
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

    // a hammer's blow landing (meleeCombat.js's playHitSound, duelSystem.js's
    // WEAPON_HIT_SOUNDS) - quieter at the source than the others, so .6 puts it
    // level with the spear's and staff's at .5
    const hammerS1 = createSoundSafe("hammerS1", "./sounds/weapons/hammerS1.mp3", scene,
    {volume: .6, autoplay: false, loop: false})

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

    const weaponblockS = createSoundSafe("weaponblockS", "./sounds/weapons/weaponblock.mp3", scene,
    {volume: .5, autoplay: false, loop: false})

    // a hammer coming down on an anvil (components/anvilWork.js) - played with weaponblockS
    const anvilHitS = createSoundSafe("anvilHitS", "./sounds/weapons/anvilhit.mp3", scene,
    {volume: .7, autoplay: false, loop: false})

    const brokenS = createSoundSafe("brokenS", "./sounds/weapons/brokenS.mp3", scene,
    {volume: .8, autoplay: false, loop: false})

    const throwSpearS = createSoundSafe("throwSpearS", "./sounds/weapons/throwspear.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    const goblinDeathS = createSoundSafe("goblinDeathS", "./sounds/monsters/goblindeath.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    const demonoidS = createSoundSafe("demonoidS", "./sounds/monsters/demonoidS.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    const giantencounterS = createSoundSafe("giantencounter", "./sounds/monsters/giantencounter.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    // VOICE - eating and drinking (itemInfoSystem.js's consumeItemFunc: a
    // "food" plays eatS - pears, mushrooms - a "potion" plays drinkS)
    const eatS = createSoundSafe("eatS", "./sounds/voice/eat.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    const drinkS = createSoundSafe("drinkS", "./sounds/voice/drink.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    // MAGIC
    const magicCircle = createSoundSafe("magicCircle", "./sounds/magic/magiccircle.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    const fireBallS = createSoundSafe("fireBallS", "./sounds/magic/fireBall.mp3", scene,
    {volume: 0.8, autoplay: false, loop: false})

    const fireHitS = createSoundSafe("fireHitS", "./sounds/magic/firehit.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    const electricHitS = createSoundSafe("electricHitS", "./sounds/magic/electrichit.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    // the same crackle, quiet and pitched way up - an electric slime charging
    // its bolt (enemies/rangeAttack.js). Its own Sound: Sound.clone() hands
    // back a broken one in this Babylon (its name getter throws)
    const electricChargeS = createSoundSafe("electricChargeS", "./sounds/magic/electrichit.mp3", scene,
    {volume: 0.3, autoplay: false, loop: false, playbackRate: 2.2})

    // a player struck by an electric slime's bolt (effects/electrocute.js),
    // on top of electrichit
    const electrifiedS = createSoundSafe("electrifiedS", "./sounds/magic/electrified.mp3", scene,
    {volume: 1, autoplay: false, loop: false})
    // an electric slime fleeing in a bolt (enemies/voltstep.js)
    const voltstepS = createSoundSafe("voltstepS", "./sounds/magic/voltstep.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    const waterHitS = createSoundSafe("waterHitS", "./sounds/magic/waterhit.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    const enteredS = createSoundSafe("enteredS", "./sounds/enteredS.mp3", scene,
    {volume: 0.8, autoplay: false, loop: false})


    // effects
    const poisonS = createSoundSafe("poisonS", "./sounds/effects/poisonS.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    // generic "a periodic-damage effect just ticked" sound - not tied to one
    // specific effect (poisoned/burn/spdrain/etc), read off whichever
    // effect's own soundPlayPerDmg field names it (characterstate.js's
    // deductHp/startBurnDamage, skillEffects.js's startTargetBurn)
    const dmgpmS = createSoundSafe("dmgpmS", "./sounds/effects/dmgpm.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    const struckS = createSoundSafe("struckS", "./sounds/effects/struckS.mp3", scene,
    {volume: 1, autoplay: false, loop: false})
    struckS.setPlaybackRate(1.2)
    // {volume: 1, spatialSound: false, maxDistance: 50, autoplay: false, loop: false})

    const rockSmashS = createSoundSafe("rockSmashS", "./sounds/effects/rockSmashS.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    // the evolution (charactersystem/evolution.js): hitting the ground as it
    // starts, the fire catching, the change breaking through, the wings opening
    const landedOnGroundS = createSoundSafe("landedOnGroundS", "./sounds/effects/landedonground.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    const igniteFireS = createSoundSafe("igniteFireS", "./sounds/effects/ignitefire.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    const horrorExplosionS = createSoundSafe("horrorExplosionS", "./sounds/effects/horrorexplosion.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    const wingsFlappedS = createSoundSafe("wingsFlappedS", "./sounds/effects/wingsflapped.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    // the air rushing past while flying - a loop, faded in and out by inputMovement.js
    const windBlowS = createSoundSafe("windBlowS", "./sounds/effects/windblow.mp3", scene,
    {volume: 0.6, autoplay: false, loop: true})

    // coming down hard from a height (inputMovement.js's landing)
    const heavyLandedS = createSoundSafe("heavyLandedS", "./sounds/effects/heavylanded.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    const bulletS = createSoundSafe("bulletS", "./sounds/effects/bullet.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    const minningS = createSoundSafe("minningS", "./sounds/weapons/minning.mp3", scene,
    {volume: 1, autoplay: false, loop: false}) // not spatial - plays the same regardless of camera/mesh position

    const pickItemS = createSoundSafe("pickItemS", "./sounds/ui/pickitem.mp3", scene,
    {volume: .7, autoplay: false, loop: false})

    // an ore going into one of the anvil's slots (components/anvilWork.js)
    const insertStoneS = createSoundSafe("insertStoneS", "./sounds/ui/insertstone.mp3", scene,
    {volume: .8, autoplay: false, loop: false})

    const notif1S = createSoundSafe("notif1S", "./sounds/notifs/notif1S.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    const notif2S = createSoundSafe("notif2S", "./sounds/notifs/notif2S.mp3", scene,
    {volume: 1, autoplay: false, loop: false})
    notif2S?.setPlaybackRate(1.1)

    const titleAcquiredS = createSoundSafe("titleAcquiredS", "./sounds/notifs/titleacquired.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    const achievementUnlockS = createSoundSafe("achievementUnlockS", "./sounds/notifs/achievementunlock.mp3", scene,
    {volume: 1, autoplay: false, loop: false})

    const runningS = createSoundSafe("runningS", "./sounds/indor/running.mp3", scene,
    {volume: 0.5, autoplay: false, loop: false})

    const woodrunS = createSoundSafe("woodrunS", "./sounds/indor/woodrun.mp3", scene,
    {volume: 0.5, autoplay: false, loop: false})

    const woodcuttingS = createSoundSafe("woodcuttingS", "./sounds/effects/woodcuttingS.mp3", scene,
    {volume: 0.9, autoplay: false, loop: false})

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
    const rainy = createSoundSafe('cinema1', './sounds/backg/rain.mp3', scene,
    {volume: .4, autoplay: false, loop: true})

    const windy = createSoundSafe('cinema1', './sounds/backg/windy.mp3', scene,
    {volume: .2, autoplay: false, loop: true})

    // const cinema1 = createSoundSafe('cinema1', './sounds/backg/cinema1.mp3', scene,
    // {volume: .4, autoplay: false, loop: true})

    // const cinema2 = createSoundSafe('cinema2', './sounds/backg/cinema2.mp3', scene,
    // {volume: .4, autoplay: false, loop: true})


    allSounds = {
        bonfireS,
        magicCircle,
        fireBallS,
        fireHitS,
        electricHitS, electricChargeS, electrifiedS, voltstepS,
        waterHitS,
        enteredS,
        giantencounterS,
        struckS,
        rockSmashS,
        landedOnGroundS, igniteFireS, horrorExplosionS, wingsFlappedS, heavyLandedS, windBlowS,
        minningS,
        // cinema1,cinema2,
        woodCreakS,
        woodcuttingS,
        keyUnlockingS, normalDoorOC,
        enhanceS,spearS1,demonoidS,
        runningS, woodrunS,
        poisonS,
        dmgpmS,
        bulletS,
        pickItemS, insertStoneS,
        swordS1,punchedS,swordWhooshS, drawSword, voiceAttackS,
        staffS1,hammerS1,goblinDeathS,notif1S,notif2S,titleAcquiredS,achievementUnlockS,
        weaponblockS, anvilHitS, brokenS,
        throwSpearS,
        eatS, drinkS,

        rainy,
        windy
    }
    // the orangelith's sonic boom - made in code, they turn up in allSounds
    // a moment from now (effects/sonicSounds.js)
    addSonicSounds(scene, allSounds)
    addDarkSlashSounds(scene, allSounds)
    return allSounds;
}

export function getAllSounds(){
    return allSounds
}

// How far away a world sound can still be heard, in world units. ~27 player
// heights (capsuleHeight is 1.5), so roughly "in view and nearby" rather than
// "somewhere in this place".
//
// This gate exists because these sounds are NOT spatial. createSoundSafe above
// builds each one with only {volume, autoplay, loop} - no spatialSound, no
// maxDistance - so Babylon plays every one at full volume no matter where the
// thing that triggered it actually is. Combined with openworld being one huge
// place, that meant a bot casting 2000 units away (far past the 200-unit
// distance at which its body is hidden entirely, see renderer.js) was as loud
// as one standing next to you: audible casting from something you cannot see.
export const EARSHOT_DISTANCE = 20

// The local player's body, supplied by whoever knows it. Set from
// createMyCharacter so this module stays free of imports from the character/
// socket layers - it currently imports nothing but Babylon, and reaching into
// worldsocket.js or characterstate.js from here would close an import cycle
// through main.js.
let listenerBody = null
export function setSoundListener(body){
    listenerBody = body
}

/**
 * Play `sound` only if `position` is close enough to the local player to
 * plausibly be heard. Distant callers are dropped silently.
 *
 * Falls back to playing unconditionally when there is no listener yet (early
 * scene load, before the player's body exists) - better a sound that is too
 * loud than one that never plays because setup order changed.
 */
export function playSoundNear(sound, position, maxDistance = EARSHOT_DISTANCE){
    if(!sound) return
    if(!listenerBody || !position) return sound.play()
    if(Vector3.Distance(listenerBody.position, position) > maxDistance) return
    sound.play()
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
    if(allSounds.runningS.isPlaying) return
    allSounds.runningS.stop()
    allSounds.runningS.play()
    allSounds.runningS.setPlaybackRate(.8 + characterStatSpd*0.04)
}
