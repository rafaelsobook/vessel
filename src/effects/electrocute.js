import { Color3, FresnelParameters, StandardMaterial, Vector3 } from "@babylonjs/core"
import { addGlow } from "../tools/glow.js"
import { addCameraTrauma, punchCameraFov } from "../tools/cameraShake.js"
import { getAllSounds, playSoundNear } from "../components/soundSystem.js"
import { stunPlayer } from "../charactersystem/stun.js"
import { disposeLayerMaterial, keepOverride, overrideMaterial, releaseMaterial } from "../tools/materialOverride.js"
import { popShockRing } from "./shockRing.js"
import { crackle, zapImpact, zapPalette } from "./zap.js"
import { DODGED_COLOR, chestOf, comicText, feetOf, headOf, prewarmWords, screenFlash, smokePuff, soundFor } from "./comicHit.js"

// ELECTROCUTED - the cartoon zap: the body and everything worn turn to a
// charred, see-through shell (black, visibility 0.3, an electric rim) and the
// skeleton inside lights up (avatar.glb's undeadbody - skinned to the same
// bones, so it strikes the same pose). It strobes - bones, body, bones -
// then holds on the bones, while they twitch in avatar.glb's "electrified"
// clip and electricity crawls round them. Then it lets go: a puff of smoke.
//
// Everyone sees it: the victim's own client the moment the bolt lands
// (enemies/rangeAttack.js), everyone else off tcp's "range-attack-landed"
// relay (worldsocket.js). Only the victim's own screen flashes and shakes.

const ELECTROCUTED_MS = 900
// [ms after the hit, bones showing?] - the strobe, then a hold on the bones
const STROBE = [[0, true], [70, false], [120, true], [185, false], [230, true], [290, false], [330, true]]
const SHELL_VISIBILITY = 0.3
// a twitchier "electrified" than the clip's own pace
const TWITCH_SPEED = 1.7
// the jolt in: hit1, fast, straight into the twitching
const JOLT_SPEED = 3
// the electricity crawls round the outside of the body on a cage this wide
// (round the capsule's middle), and leaps off these (avatar.glb's joints)
const ARC_CAGE_RADIUS = 0.5
const ARC_LIMBS = ["head", "hand.L", "hand.R", "foot.L", "foot.R"]
// the bones' cartoon ink
const BONE_INK = new Color3(0.04, 0.03, 0.02)
const BONE_INK_WIDTH = 0.006

// ── materials, one per scene ─────────────────────────────────────────────────

const shellMats = new WeakMap()   // scene -> Map(palette -> material)

// the charred shell everything worn turns into - black, lit by nothing, and
// rimmed in the bolt's colour where it turns away from the camera. Never worn
// itself: each piece wears its own copy (electrocutePlayer) - a spell's visual
// hung on the rig and disposed with its materials would otherwise take the
// one shell, and Babylon strips a disposed material off every mesh wearing it
function shellMaterial(scene, palette){
    let byPalette = shellMats.get(scene)
    if(!byPalette) shellMats.set(scene, byPalette = new Map())
    let mat = byPalette.get(palette.name)
    if(mat) return mat
    mat = new StandardMaterial(`electrocuted.shell.${palette.name}`, scene)
    mat.disableLighting = true
    mat.diffuseColor = Color3.Black()
    mat.specularColor = Color3.Black()
    // the fresnel below multiplies this - white lets its colours through as they are
    mat.emissiveColor = Color3.White()
    // a thin edge - the body itself stays black
    mat.emissiveFresnelParameters = new FresnelParameters({ leftColor: palette.rim.scale(0.75), rightColor: Color3.Black(), bias: 0, power: 3.4 })
    byPalette.set(palette.name, mat)
    return mat
}

// the bones: lit by nothing, a cool white with their own texture added over
// it - bright, cartoon x-ray bones whatever the light round them (the
// texture alone reads tan). One per skeleton, made the first time it shows,
// for the same reason as the shell's copies.
function wearBones(skeleton){
    let mat = skeleton._bones
    if(!mat || mat._bonesGone){
        // its own texture, read the first time - before it ever wore bones
        skeleton._bonesTexture ??= skeleton.material?.diffuseTexture ?? null
        mat = new StandardMaterial(`electrocuted.bones.${skeleton.uniqueId}`, skeleton.getScene())
        mat.emissiveTexture = skeleton._bonesTexture
        mat.disableLighting = true
        mat.diffuseColor = Color3.White()
        mat.emissiveColor = new Color3(0.42, 0.46, 0.54)
        mat.specularColor = Color3.Black()
        mat.onDisposeObservable.addOnce(() => { mat._bonesGone = true })
        skeleton._bones = mat
    }
    if(skeleton.material !== mat) skeleton.material = mat
}

/**
 * Compiles the shell and the bones for `player`'s meshes ahead of time, so the
 * first zap doesn't stall on its shaders. rangeAttack.js calls it when an
 * enemy that can electrocute shows up.
 */
export function prewarmElectrocution(player, color){
    const skeleton = player?.skeletonMesh
    if(!skeleton || skeleton.isDisposed()) return
    const scene = skeleton.getScene()
    const palette = zapPalette(color)
    wearBones(skeleton)
    skeleton.material.forceCompilationAsync(skeleton).catch(() => {})
    const body = shellTargets(player)[0]
    if(body) shellMaterial(scene, palette).forceCompilationAsync(body).catch(() => {})
    // its words, drawn now rather than on the hit
    prewarmWords(scene, [{ word: "ZZZT!", color: palette.core }, { word: "DODGED!", color: DODGED_COLOR }])
}

// everything showing on the rig - body, hair, clothes, armour, weapon - but
// the skeleton
function shellTargets(player){
    const skeleton = player.skeletonMesh
    return (player.root?.getChildMeshes(false) ?? []).filter(mesh =>
        mesh !== skeleton && mesh.isVisible && mesh.isEnabled() && mesh.material && mesh.getTotalVertices() > 0)
}

// ── the zap ──────────────────────────────────────────────────────────────────

/**
 * Light `player` (a createCharacter() rig) up to the bones. isMine: it's my
 * own character - the screen flashes and shakes, and the stun holds my input.
 * animation: the clip they twitch in meanwhile (rangeAtkDetails.victimAnimation).
 * Hit again while it's still going, it just runs on longer.
 */
export function electrocutePlayer(player, { isMine = false, color = "yellow", soundWhenHit = "electrichit", animation = "electrified", ms = ELECTROCUTED_MS } = {}){
    const body = player?.body
    if(!body || body.isDisposed()) return
    const scene = body.getScene()
    const palette = zapPalette(color)
    const now = performance.now()

    const sound = soundFor(soundWhenHit)
    const electrified = getAllSounds()?.electrifiedS
    if(isMine){
        sound?.play()
        electrified?.play()
    }else{
        playSoundNear(sound, body.position)
        playSoundNear(electrified, body.position)
    }
    zapImpact(scene, chestOf(player), palette)
    comicText(scene, "ZZZT!", chestOf(player).add(new Vector3(0, 1.05, 0)), palette.core)
    if(isMine){
        screenFlash(palette)
        addCameraTrauma(scene, 0.6, { x: (Math.random() - 0.5) * 0.8, y: -0.45 })
        punchCameraFov(scene, 0.055)
    }

    // already lit up - just longer
    if(player._electrocution){
        player._electrocution.until = Math.max(player._electrocution.until, now + ms)
        holdPose(player, ms, isMine, animation)
        return
    }

    const skeleton = player.skeletonMesh
    if(skeleton && !skeleton.isDisposed()) wearBones(skeleton)
    const shell = shellMaterial(scene, palette)
    const state = { until: now + ms }
    // worn over each piece as a layer (tools/materialOverride.js) - burnt by a
    // fireball meanwhile, it goes back to burnt after, not to clean. Each its
    // own copy of the shell (see shellMaterial)
    const targets = shellTargets(player)
    const shells = new Map(targets.map(mesh => [mesh, shell.clone(`${shell.name}.${mesh.uniqueId}`)]))
    let showing = null
    const showBones = on => {
        if(on === showing) return
        showing = on
        targets.forEach(mesh => {
            if(on) overrideMaterial(mesh, state, shells.get(mesh), SHELL_VISIBILITY)
            else releaseMaterial(mesh, state)
        })
        if(skeleton && !skeleton.isDisposed()) skeleton.isVisible = on
    }

    if(skeleton && !skeleton.isDisposed()){
        skeleton._glowColor = new Color3(0.85, 0.95, 1)
        addGlow(scene, skeleton, 0.4)
        // inked, like a cartoon's bones
        skeleton.renderOutline = true
        skeleton.outlineColor = BONE_INK
        skeleton.outlineWidth = BONE_INK_WIDTH
    }
    // the electricity crawling round the outside of them, and now and then
    // from a hand or foot out into the air
    const arcs = crackle(scene, () => Math.random() < 0.3 ? limbArc(player) : aroundBody(player), palette, { count: 5, interval: 40, width: 0.011 })
    popShockRing(scene, feetOf(player), { size: 2.6, seconds: 0.4, color: palette.glow })
    holdPose(player, ms, isMine, animation)

    player._electrocution = state
    const observer = scene.onBeforeRenderObservable.add(() => {
        const t = performance.now() - now
        if(performance.now() >= state.until || body.isDisposed()){
            finish()
            return
        }
        // the strobe, then the bones held - and they flicker brighter at random
        let on = true
        for(const [at, show] of STROBE) if(t >= at) on = show
        showBones(on)
        // a piece re-equipped meanwhile goes back under the shell
        if(showing) keepOverride(targets, state)
        if(skeleton) skeleton._glowBrightness = 0.28 + Math.random() * 0.27
    })

    function finish(){
        scene.onBeforeRenderObservable.remove(observer)
        showBones(false)
        shells.forEach(disposeLayerMaterial)
        if(skeleton){
            skeleton._glowLayer?.removeIncludedOnlyMesh(skeleton)
            skeleton._glowLayer = null
            skeleton.renderOutline = false
        }
        arcs.dispose()
        if(player._electrocution === state) player._electrocution = null
        if(!body.isDisposed()) smokePuff(scene, headOf(player))
    }
}

// the twitch ("electrified") for as long as it lasts, the stun holding it
// (and, mine, my input) - not for someone dying of it
function holdPose(player, ms, isMine, animation = "electrified"){
    const anims = player.characterAnimations
    if(!anims || player.isDead || player.mode === "death") return
    const pose = anims.stateForClip(player.anims, animation)
    if(!pose) return
    const clip = player.anims.find(anim => anim.name.toLowerCase() === animation.toLowerCase())
    if(clip) clip.speedRatio = TWITCH_SPEED
    // a jolt (hit1, fast) cutting off a swing or whatever else is playing,
    // settling into the twitch. Not the twitch itself as the action: an action
    // that is also the state it settles into ends at weight 0 (animation.js's
    // playAction) - the rig would drop to its bind pose
    if(!anims.playAction(player.anims, "hit1", JOLT_SPEED, null, false, pose)) anims.setState(pose, 2)
    stunPlayer(player, ms / 1000, pose, isMine, { stars: false })
}

// ── where the arcs go ────────────────────────────────────────────────────────

// the limbs arcs leap off, looked up once per rig
function limbsOf(player){
    if(player._zapLimbs) return player._zapLimbs
    const nodes = player.root?.getChildTransformNodes(false) ?? []
    const limbs = ARC_LIMBS.map(name => nodes.find(node => node.name === name || node.name.endsWith(` ${name}`))).filter(Boolean)
    player._zapLimbs = limbs
    return limbs
}
// a short arc crawling round the outside of the body - two points on a
// cylinder just wider than them, a little way apart
function aroundBody(player){
    const center = player.body.position
    const angle = Math.random() * Math.PI * 2
    const turn = (0.35 + Math.random() * 0.6) * (Math.random() < 0.5 ? -1 : 1)
    const y = (Math.random() - 0.5) * 1.5
    const at = (a, h, r) => new Vector3(center.x + Math.cos(a) * r, center.y + h, center.z + Math.sin(a) * r)
    return [
        at(angle, y, ARC_CAGE_RADIUS * (0.85 + Math.random() * 0.3)),
        at(angle + turn, Math.max(-0.74, Math.min(0.8, y + (Math.random() - 0.5) * 0.8)), ARC_CAGE_RADIUS * (0.85 + Math.random() * 0.3)),
    ]
}
// from a hand, foot or the head out into the air beside it
function limbArc(player){
    const limbs = limbsOf(player)
    if(!limbs.length) return aroundBody(player)
    const from = limbs[Math.floor(Math.random() * limbs.length)].getAbsolutePosition().clone()
    const out = from.subtract(player.body.position)
    out.y *= 0.3
    out.normalize()
    const to = from.add(out.scale(0.25 + Math.random() * 0.35)).add(new Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.3) * 0.4, (Math.random() - 0.5) * 0.3))
    return [from, to]
}
