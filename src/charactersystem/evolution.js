import { applyEvolutionBonus, getCharState, isDead, setCanPress, updateMyDetailsOL } from "./characterstate.js"
import { capsuleHeight, findDeepByName } from "./createcharacter.js"
import { standUp } from "./seating.js"
import { stopResting } from "./uimanagement.js"
import { attachWings, loadWings, removeWings } from "./wings.js"
import { getPlayersOnScene } from "../sockets/worldsocket.js"
import { forceStopMovement } from "../controllers/inputMovement.js"
import { emitEvolve } from "../sockets/emits.js"
import { createTransformationFire, FIRE_PALETTES } from "../effects/transformationFire.js"
import { addCameraTrauma, punchCameraFov } from "../tools/cameraShake.js"
import { getAllSounds } from "../components/soundSystem.js"
import { checkIfTokenSaved } from "../tools/tools.js"
import { openClosePopup } from "../tools/popupUI.js"
import { sparkBurst } from "../effects/blessingFx.js"

// EVOLUTION - evolveInto({ evolutionName, wingdetail }) changes a character
// into something new, announced by shortNotice.js ("conditions reached",
// "Activating Evolution"). It plays out over avatar.glb's act_gettingupconfused
// (10.4 s): struck down, the body burns in dark fire on the ground while that
// fire runs out across it like wildfire (0-3 s), rolls up through the flames
// (3-4.5 s), and the moment it's on its feet the wings tear out of its back
// (REVEAL_AT) - then the fire dies down while it stands looking itself over.
// No moving until the clip's done.
//
// What you became stays on you: characterState.evolution, saved with the
// rest of you. createcharacter.js puts the wings back on whenever it builds a
// character with one, so they're still there in the next place and the next
// session, and getCharSocket (characterstate.js) hands it to everyone else's
// client, so they see them too.

// how each evolution looks while it happens - its fire's colours
const EVOLUTIONS = {
    demon: { fire: FIRE_PALETTES.demon },
}

const CLIP = "act_gettingupconfused"
// seconds into CLIP - lying 0-2 s, rolling up 3-4.5 s, on its feet from ~4.7 s
const CATCH = 0.45          // how hard the fire burns the moment it catches
const BUILD_UNTIL = 4.3     // ...growing to full while the body's down
const REVEAL_AT = 4.65      // up: the wings break out, the fire surges
const SURGE = 0.4           // seconds the surge lasts, and how far over full
const SURGE_OVER = 0.15
const FADE_FROM = 5.4       // then it dies down
const FADE_TO = 7.4
const CLIP_SECONDS = 10.42  // if the clip's missing, the change still takes this long

// where the fire comes off the body: the stretch between two bones (a thigh,
// a forearm), or round one (the head, a foot) - its share of the flames, and
// how far off the line they start. lift: metres up (the head bone sits at the
// neck). chest: the spikes lash out of it, and the wings tear out of it.
const BURNING_BODY = [
    { from: "pelvis", to: "spine", weight: 2.2, radius: 0.17 },
    { from: "spine", to: "upperSpine", weight: 2.4, radius: 0.18 },
    { from: "upperSpine", to: "neck", weight: 2.4, radius: 0.17, chest: true },
    { from: "neck", to: "head", weight: 0.7, radius: 0.08 },
    { from: "head", weight: 1.3, radius: 0.13, lift: 0.1 },
    { from: "upperArm.L", to: "lowerArm.L", weight: 0.9, radius: 0.07 },
    { from: "lowerArm.L", to: "hand.L", weight: 0.9, radius: 0.06 },
    { from: "upperArm.R", to: "lowerArm.R", weight: 0.9, radius: 0.07 },
    { from: "lowerArm.R", to: "hand.R", weight: 0.9, radius: 0.06 },
    { from: "upperLeg.L", to: "lowerLeg.L", weight: 1.5, radius: 0.1 },
    { from: "lowerLeg.L", to: "foot.L", weight: 1.3, radius: 0.08 },
    { from: "upperLeg.R", to: "lowerLeg.R", weight: 1.5, radius: 0.1 },
    { from: "lowerLeg.R", to: "foot.R", weight: 1.3, radius: 0.08 },
    { from: "foot.L", weight: 0.4, radius: 0.08 },
    { from: "foot.R", weight: 0.4, radius: 0.08 },
]

const smoothstep = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)
}

// how hard the fire burns `seconds` into the change: catching, growing to
// full while the body's down, a surge as it breaks through, dying away
function fireAt(seconds){
    if(seconds < BUILD_UNTIL) return CATCH + (1 - CATCH) * smoothstep(0, BUILD_UNTIL, seconds)
    if(seconds < REVEAL_AT) return 1
    if(seconds < REVEAL_AT + SURGE) return 1 + SURGE_OVER * Math.sin(Math.PI * (seconds - REVEAL_AT) / SURGE)
    if(seconds < FADE_FROM) return 1
    return Math.max(0, 1 - (seconds - FADE_FROM) / (FADE_TO - FADE_FROM))
}

// avatar.glb's bones come in as "Clone of <name>"
function boneNamed(root, name){
    return findDeepByName(root, node => node.name === name || node.name.endsWith(` ${name}`))
}

function myCharacter(){
    const owner = getCharState()?.owner
    return getPlayersOnScene().find(pl => pl.owner === owner)
}

const changing = new WeakSet()

// details: { evolutionName, wingdetail: { wingmodel, wingtexture } } - which
// evolution (EVOLUTIONS), and the wings it brings (wings.js). character: who
// changes - you unless given (another player, once their client tells this
// one). Only your own change locks the controls, shakes the camera, plays its
// sounds and is saved.
// Back to human: the wings come off, the face goes back to what it was, and it's
// saved and told to everyone else. Does nothing mid-change, or if there's
// nothing to undo. character: whoever - you unless given (another player,
// once their client tells this one).
export function devolve(character = myCharacter()){
    const body = character?.body
    if(!body || body.isDisposed() || changing.has(character)) return
    const scene = body.getScene()
    const charState = getCharState()
    const isMine = !!charState && character.owner === charState.owner
    if(!character.wings && !(isMine && charState.evolution?.evolutionName)) return

    removeWings(character)
    character.resetLook?.()
    // the change leaving them: embers off the back
    sparkBurst(scene, body.getAbsolutePosition().clone().addInPlaceFromFloats(0, 0.3, 0), FIRE_PALETTES.demon.ember, { count: 70, power: 4 })
    if(!isMine) return
    // an empty name, not a deleted field: a save leaves a missing field as it was
    charState.evolution = { evolutionName: null }
    // and the extra hp/mp/sp goes with it
    applyEvolutionBonus()
    updateMyDetailsOL(charState, checkIfTokenSaved())
    emitEvolve({ evolutionName: null })
    addCameraTrauma(scene, 0.3)
    getAllSounds()?.fireHitS?.play()
    openClosePopup("You are human again", true, 2000)
}

export function evolveInto(details, character = myCharacter()){
    // own keys only - the name can come from another player over the network
    const evolution = Object.hasOwn(EVOLUTIONS, details?.evolutionName) ? EVOLUTIONS[details.evolutionName] : null
    if(!evolution) return console.warn(`evolveInto: no evolution "${details?.evolutionName}"`)
    const body = character?.body
    if(!body || body.isDisposed() || changing.has(character)) return
    const scene = body.getScene()
    const charState = getCharState()
    const isMine = !!charState && character.owner === charState.owner
    changing.add(character)
    // wanted the instant the clip reaches REVEAL_AT - start loading them now
    if(details.wingdetail) loadWings(scene).catch(() => {})

    if(isMine){
        // out of a rest or a seat first - the clip plays standing in place
        if(charState.mode === "resting") stopResting()
        if(["sitting", "sleeping"].includes(charState.mode)) standUp()
        setCanPress(false)
        forceStopMovement()
        // everyone else sees it happen
        emitEvolve({ evolutionName: details.evolutionName, wingdetail: details.wingdetail })
    }
    character.characterAnimations?.playAction(character.anims, CLIP, 1)
    const clip = character.anims?.find(anim => anim.name === CLIP)
    const clipSeconds = clip
        ? (clip.to - clip.from) / (clip.targetedAnimations[0]?.animation.framePerSecond ?? 60)
        : CLIP_SECONDS

    const anchors = BURNING_BODY
        .map(({ from, to, ...rest }) => ({ ...rest, from: boneNamed(character.root, from), to: to ? boneNamed(character.root, to) : null }))
        .filter(anchor => anchor.from)
    // no rig to burn on (shouldn't happen) - the middle of the body will do
    if(!anchors.length) anchors.push({ from: body, weight: 1, radius: 0.4, chest: true })
    const chest = anchors.find(anchor => anchor.chest)?.from ?? body
    const feet = body.position.clone()
    const fire = createTransformationFire(scene, {
        anchors,
        ground: () => feet.copyFrom(body.absolutePosition).addInPlaceFromFloats(0, -capsuleHeight / 2, 0),
        palette: evolution.fire,
    })
    fire.setIntensity(fireAt(0))
    fire.ignite()
    if(isMine){
        // hitting the ground, and the fire catching
        getAllSounds()?.landedOnGroundS?.play()
        getAllSounds()?.igniteFireS?.play()
        addCameraTrauma(scene, 0.3)
    }

    let seconds = 0
    let revealed = false
    let finished = false
    const tick = scene.onBeforeRenderObservable.add(() => {
        if(body.isDisposed()) return finish(true)
        // the scene's animation clock - the one the clip runs on
        seconds += scene.getAnimationRatio() / 60
        fire.setIntensity(fireAt(seconds))
        if(!revealed && seconds >= REVEAL_AT) reveal()
        if(seconds >= FADE_TO) fire.stop()
        // timed, not tied to the clip's end - a hit reaction cutting the clip
        // short must not leave you stuck
        if(seconds >= clipSeconds) finish(false)
    })

    function reveal(){
        revealed = true
        chest.computeWorldMatrix(true)
        fire.flare(chest.getAbsolutePosition())
        if(details.wingdetail) attachWings(character, details.wingdetail, { grow: true })
        // and the face changes with it - the eyes, the black behind them
        character.applyLook?.(details)
        if(!isMine) return
        getAllSounds()?.demonoidS?.play()
        getAllSounds()?.fireHitS?.play()
        getAllSounds()?.horrorExplosionS?.play()
        getAllSounds()?.wingsFlappedS?.play()
        addCameraTrauma(scene, 0.65)
        punchCameraFov(scene, 0.05)
        charState.evolution = { evolutionName: details.evolutionName, wingdetail: details.wingdetail }
        // the evolution's extra hp/mp/sp (evolutionBonuses.js), filled
        applyEvolutionBonus()
        updateMyDetailsOL(charState, checkIfTokenSaved())
    }

    // gone: the body went away mid-change - everything goes with it at once
    function finish(gone){
        if(finished) return
        finished = true
        scene.onBeforeRenderObservable.remove(tick)
        changing.delete(character)
        if(gone) fire.dispose()
        else fire.stop()
        if(isMine && !gone && !isDead()) setCanPress(true)
    }
}
