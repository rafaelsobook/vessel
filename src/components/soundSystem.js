import { Sound } from "@babylonjs/core"
const log = console.log
let allSounds = {}

export function initSounds(scene){

    const swordS1 = new Sound("swordS1", "./sounds/weapons/swordS1.mp3", scene,
    null, {volume: .5, autoplay: false, loop: false})

    const spearS1 = new Sound("spearS1", "./sounds/weapons/spearS1.mp3", scene,
    null, {volume: .5, autoplay: false, loop: false})

    const staffS1 = new Sound("staffS1", "./sounds/weapons/staffS1.mp3", scene,
    null, {volume: .5, autoplay: false, loop: false})

    const punchedS = new Sound("punchedS", "./sounds/weapons/punched.mp3", scene,
    null, {volume: 1, autoplay: false, loop: false})

    const swordWhooshS = new Sound("swordWhooshS", "./sounds/weapons/swordWhooshS.mp3", scene,
    null, {volume: .5, autoplay: false, loop: false})

    const voiceAttackS = new Sound("voiceAttackS", "./sounds/weapons/voiceAttackS.mp3", scene,
    null, {volume: .3, autoplay: false, loop: false})

    const enhanceS = new Sound("enhanceS", "./sounds/weapons/enhanceS.mp3", scene,
    null, {volume: 1, autoplay: false, loop: false})

    const goblinDeathS = new Sound("goblinDeathS", "./sounds/monsters/goblindeath.mp3", scene,
    null, {volume: 1, autoplay: false, loop: false})

    const demonoidS = new Sound("demonoidS", "./sounds/monsters/demonoidS.mp3", scene,
    null, {volume: 1, autoplay: false, loop: false})

    const giantencounterS = new Sound("giantencounter", "./sounds/monsters/giantencounter.mp3", scene,
    null, {volume: 1, autoplay: false, loop: false})

    // MAGIC
    const magicCircle = new Sound("magicCircle", "./sounds/magic/magiccircle.mp3", scene,
    null, {volume: 1, autoplay: false, loop: false})

    const enteredS = new Sound("enteredS", "./sounds/enteredS.mp3", scene,
    null, {volume: 0.8, autoplay: false, loop: false})


    // effects
    const poisonS = new Sound("poisonS", "./sounds/effects/poisonS.mp3", scene,
    null, {volume: 1, autoplay: false, loop: false})

    const struckS = new Sound("struckS", "./sounds/effects/struckS.mp3", scene,
    null, {volume: 1, spatialSound: true, maxDistance: 50, autoplay: false, loop: false})

    const rockSmashS = new Sound("rockSmashS", "./sounds/effects/rockSmashS.mp3", scene,
    null, {volume: 1, autoplay: false, loop: false})

    const minningS = new Sound("minningS", "./sounds/weapons/minning.mp3", scene,
    null, {volume: 1, autoplay: false, loop: false}) // not spatial - plays the same regardless of camera/mesh position

    const pickItemS = new Sound("pickItemS", "./sounds/ui/pickitem.mp3", scene,
    null, {volume: .7, autoplay: false, loop: false})

    const notif1S = new Sound("notif1S", "./sounds/notifs/notif1S.mp3", scene,
    null, {volume: 1, autoplay: false, loop: false})

    const notif2S = new Sound("notif2S", "./sounds/notifs/notif2S.mp3", scene,
    null, {volume: 1, autoplay: false, loop: false})
    notif2S.setPlaybackRate(1.1)

    const runningS = new Sound("runningS", "./sounds/indor/running.mp3", scene,
    null, {volume: 0.5, autoplay: false, loop: false})

    const woodrunS = new Sound("woodrunS", "./sounds/indor/woodrun.mp3", scene,
    null, {volume: 0.5, autoplay: false, loop: false})

    // INDOORS
    const woodCreakS = new Sound("woodCreakS", "./sounds/indor/woodCreakS.mp3", scene,
    null, {volume: 1, autoplay: false, loop: false});

    const keyUnlockingS = new Sound("keyUnlocking", "./sounds/indor/keyUnlocking.mp3", scene,
    null, {volume: 1, autoplay: false, loop: false});

    const normalDoorOC = new Sound("keyUnlocking", "./sounds/indor/normalDoorOC.mp3", scene,
    null, {volume: 1, autoplay: false, loop: false});


    const bonfireS = new Sound("enteredS", "./sounds/bonfireS.mp3", scene,
    null, {volume: 0.4, autoplay: false, loop: true})

    // background music
    // const cinema1 = new Sound('cinema1', './sounds/backg/cinema1.mp3', scene,
    // null, {volume: .4, autoplay: false, loop: true})

    // const cinema2 = new Sound('cinema2', './sounds/backg/cinema2.mp3', scene,
    // null, {volume: .4, autoplay: false, loop: true})


    allSounds = {
        bonfireS,
        magicCircle,
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
        swordS1,punchedS,swordWhooshS,voiceAttackS,
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

export function runSound(characterStatSpd){
    if(allSounds.runningS.isPlaying) return log("is playing")
    getAllSounds().runningS.stop()
    getAllSounds().runningS.play()
    allSounds.runningS.setPlaybackRate(.8 + characterStatSpd*0.04)
}
