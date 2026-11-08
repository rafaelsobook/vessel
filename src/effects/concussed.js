import { Color3, Constants, Material, Mesh, MeshBuilder, StandardMaterial, Vector3 } from "@babylonjs/core"
import { addCameraTrauma, punchCameraFov } from "../tools/cameraShake.js"
import { getAllSounds, playSoundNear } from "../components/soundSystem.js"
import { stunPlayer } from "../charactersystem/stun.js"
import { knockAway } from "../charactersystem/knockback.js"
import { slowMotion } from "../charactersystem/meleeCombat.js"
import { popShockRing } from "./shockRing.js"
import { sparkBurst } from "./blessingFx.js"
import { sonicPalette } from "./sonicBoom.js"
import { concuss, shockRipple } from "./sonicDistortion.js"
import { DODGED_COLOR, chestOf, comicText, feetOf, headOf, prewarmWords, screenFlash, soundFor } from "./comicHit.js"

// CONCUSSED - caught by the orangelith's sonic boom (enemies/rangeAttack.js,
// effects/sonicBoom.js): it goes off right in them - a white flash through
// the whole body, rings of sound bursting off their chest, the air round them
// bent in a ring - and they're thrown down the way the wave was going, off
// their feet, and left reeling, their ears ringing: rings of sound circling
// their head and pulsing off it till they shake it off. "BOOM!"
//
// Everyone sees it: the victim's own client the moment the wave catches them,
// everyone else off tcp's "range-attack-landed" relay (worldsocket.js). Only
// the victim's own screen goes white, swims and splits into its colours
// (effects/sonicDistortion.js's concuss), and only they hear the ringing.

const RINGING_MS = 1700
// thrown off their feet - out to this far from the point behind them, and up
const THROWN = 3.6
const HOP = 2.6
// reeling: the hit clip (rangeAtkDetails.victimAnimation) a touch quick,
// slumping into the dazed pose - the rings are the gag, no stars
const STUN_MS = 1150
const HIT_SPEED = 1.25
const DAZED_POSE = "structed"
// the white flash through them, then their colour, gone by FLASH_MS
const FLASH_MS = 420
// the rings circling their head: how many, how wide, how often one pulses off it
const HALO_RINGS = 3
const HALO_RADIUS = 0.27
const PULSE_EVERY_MS = 230

// ── materials ────────────────────────────────────────────────────────────────

const haloMats = new WeakMap()   // scene -> Map(palette -> material)
function haloMaterial(scene, palette){
    let byPalette = haloMats.get(scene)
    if(!byPalette) haloMats.set(scene, byPalette = new Map())
    let mat = byPalette.get(palette.name)
    if(mat && !mat.isDisposed?.()) return mat
    mat = new StandardMaterial(`concussed.halo.${palette.name}`, scene)
    mat.disableLighting = true
    mat.diffuseColor = Color3.Black()
    mat.specularColor = Color3.Black()
    mat.emissiveColor = palette.hot
    mat.alphaMode = Constants.ALPHA_ADD
    mat.transparencyMode = Material.MATERIAL_ALPHABLEND
    mat.disableDepthWrite = true
    mat.backFaceCulling = false
    byPalette.set(palette.name, mat)
    return mat
}
// a ring of sound pulsing off them - a thin torus stood up to face the camera
function pulseRing(scene, palette, at){
    const ring = MeshBuilder.CreateTorus("concussed.pulse", { diameter: 1, thickness: 0.035, tessellation: 40 }, scene)
    ring.isPickable = false
    ring.material = haloMaterial(scene, palette)
    ring.billboardMode = Mesh.BILLBOARDMODE_ALL
    // the torus lies flat - stood up, it faces the camera with the billboard
    ring.rotation.x = Math.PI / 2
    ring.bakeCurrentTransformIntoVertices()
    ring.refreshBoundingInfo()
    ring.position.copyFrom(at)
    const start = performance.now()
    const observer = scene.onBeforeRenderObservable.add(() => {
        const t = (performance.now() - start) / 420
        if(t >= 1 || ring.isDisposed()){
            scene.onBeforeRenderObservable.remove(observer)
            ring.dispose()
            return
        }
        ring.scaling.setAll(0.25 + 0.75 * (1 - Math.pow(1 - t, 2)))
        ring.visibility = (1 - t) * 0.8
    })
}

/**
 * Compiles what a boom does to `player` ahead of time - its words, its rings -
 * so the first one doesn't stall. rangeAttack.js calls it when an orangelith
 * shows up.
 */
export function prewarmConcussion(player, color){
    const scene = player?.body?.getScene()
    if(!scene || scene.isDisposed) return
    const palette = sonicPalette(color)
    const torus = MeshBuilder.CreateTorus("concussed.prewarm", { diameter: 0.01, thickness: 0.001, tessellation: 6 }, scene)
    torus.isVisible = false
    haloMaterial(scene, palette).forceCompilationAsync(torus).catch(() => {}).finally(() => torus.dispose())
    prewarmWords(scene, [
        { word: "BOOM!", color: palette.mid, burst: palette.core },
        { word: "DODGED!", color: DODGED_COLOR },
    ])
}

// ── the hit ──────────────────────────────────────────────────────────────────

/**
 * The boom landing on `player` (a createCharacter() rig). isMine: it's my own
 * character - my screen goes white, swims and splits, shakes, my ears ring,
 * the stun holds my input, and I'm the one thrown (everyone else slides their
 * copy of me). from: the point they're thrown away from (behind them, back
 * along the wave). animation: the clip they reel in. Caught again while still
 * ringing, it rings on longer.
 */
export function concussPlayer(player, { isMine = false, color = "orange", soundWhenHit = "sonichit", animation = "hit_struct1", from = null, ms = RINGING_MS } = {}){
    const body = player?.body
    if(!body || body.isDisposed()) return
    const scene = body.getScene()
    const palette = sonicPalette(color)
    const now = performance.now()
    const chest = chestOf(player)

    const sound = soundFor(soundWhenHit)
    if(isMine){
        sound?.play()
        getAllSounds()?.earRingS?.play()
    } else playSoundNear(sound, body.position)

    // it goes off in them
    comicText(scene, "BOOM!", headOf(player).add(new Vector3(0, 0.85, 0)), palette.mid, { burst: palette.core })
    sparkBurst(scene, chest, palette.core, { count: 30, power: 6, size: [0.04, 0.1], life: [0.15, 0.4] })
    sparkBurst(scene, chest, palette.hot, { count: 20, power: 3.5, size: [0.08, 0.16], life: [0.25, 0.5] })
    pulseRing(scene, palette, chest)
    setTimeout(() => !scene.isDisposed && !body.isDisposed() && pulseRing(scene, palette, chestOf(player)), 70)
    popShockRing(scene, feetOf(player), { size: 2.4, seconds: 0.3, color: palette.core })
    popShockRing(scene, feetOf(player), { size: 4.4, seconds: 0.55, color: palette.mid })
    shockRipple(scene, chest, { radius: 3.6, ms: 480, strength: 0.9, thickness: 1, chroma: 0.8, rim: 0.2, tint: palette.hot })
    if(isMine){
        screenFlash({ core: Color3.White(), glow: palette.mid })
        concuss(scene, 1600, 1)
        addCameraTrauma(scene, 0.9, { x: (Math.random() - 0.5) * 0.6, y: -0.7 })
        punchCameraFov(scene, 0.085)
        // the world stops dead for a blink
        slowMotion(scene, 0.08, 130)
    }
    if(from) knockAway(player, from, THROWN, isMine, { hop: HOP })
    reel(player, isMine, animation)

    // already ringing - on longer, and flashed again
    if(player._concussed){
        player._concussed.until = Math.max(player._concussed.until, now + ms)
        player._concussed.hitAt = now
        return
    }
    const state = { until: now + ms, hitAt: now }
    player._concussed = state

    const meshes = (player.root?.getChildMeshes(false) ?? []).filter(mesh => mesh !== player.skeletonMesh && mesh.isVisible && mesh.getTotalVertices() > 0)
    const halo = Array.from({ length: HALO_RINGS }, (_, i) => {
        const ring = MeshBuilder.CreateTorus("concussed.halo", { diameter: 1, thickness: 0.03, tessellation: 36 }, scene)
        ring.isPickable = false
        ring.material = haloMaterial(scene, palette)
        return { ring, tilt: (i / HALO_RINGS) * Math.PI + Math.random() * 0.4, phase: Math.random() * Math.PI * 2 }
    })
    let nextPulse = now + 120
    let overlaid = false
    const observer = scene.onBeforeRenderObservable.add(() => {
        const t = performance.now()
        if(t >= state.until || body.isDisposed()) return finish()
        const left = (state.until - t) / ms
        const head = headOf(player).add(new Vector3(0, 0.12, 0))
        // white through them, then their colour, gone
        const since = t - state.hitAt
        const flash = Math.max(0, 1 - since / FLASH_MS)
        meshes.forEach(mesh => {
            // a blow's own white flash (meleeCombat.js) wins while it lasts
            if(mesh.isDisposed() || mesh._hitFlashUntil > t) return
            if(flash > 0){
                mesh.renderOverlay = true
                mesh.overlayColor = since < 90 ? Color3.White() : palette.hot
                mesh.overlayAlpha = 0.75 * flash
            } else if(overlaid) mesh.renderOverlay = false
        })
        overlaid = flash > 0
        // the rings round their head - wobbling, each on its own tilt
        halo.forEach(({ ring, tilt, phase }, i) => {
            const wobble = Math.sin(t / 90 + phase) * 0.3
            ring.position.copyFrom(head)
            ring.rotation.set(0.9 * Math.cos(tilt) + wobble, t / 160 * (i % 2 ? -1 : 1), 0.9 * Math.sin(tilt))
            ring.scaling.setAll(HALO_RADIUS * 2 * (1 + 0.12 * Math.sin(t / 70 + phase)))
            ring.visibility = Math.min(1, left * 2.2) * 0.75
        })
        if(t >= nextPulse){
            pulseRing(scene, palette, head)
            nextPulse = t + PULSE_EVERY_MS / Math.max(0.5, left)
        }
    })

    function finish(){
        scene.onBeforeRenderObservable.remove(observer)
        halo.forEach(({ ring }) => ring.dispose())
        if(overlaid) meshes.forEach(mesh => { if(!mesh.isDisposed()) mesh.renderOverlay = false })
        if(player._concussed === state) player._concussed = null
    }
}

// thrown off their feet: the hit clip, quick, into the dazed slump, held by
// the stun (and, mine, my input with it) - not for someone dying of it
function reel(player, isMine, animation){
    const anims = player.characterAnimations
    if(!anims || player.isDead || player.mode === "death") return
    const pose = anims.stateForClip(player.anims, DAZED_POSE)
    if(!pose) return
    // not the slump itself as the hit clip (see scorch.js's reel)
    const played = !!animation && animation.toLowerCase() !== DAZED_POSE &&
        anims.playAction(player.anims, animation, HIT_SPEED, null, false, pose)
    if(!played) anims.setState(pose, 4)
    stunPlayer(player, STUN_MS / 1000, pose, isMine, { stars: false })
}
