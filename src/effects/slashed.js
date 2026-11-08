import { Color3, Color4, Constants, DynamicTexture, Material, Mesh, MeshBuilder, ParticleSystem, StandardMaterial, Vector3 } from "@babylonjs/core"
import { addCameraTrauma, punchCameraFov } from "../tools/cameraShake.js"
import { playSoundNear } from "../components/soundSystem.js"
import { knockAway } from "../charactersystem/knockback.js"
import { slowMotion } from "../charactersystem/meleeCombat.js"
import { stunPlayer } from "../charactersystem/stun.js"
import { popShockRing } from "./shockRing.js"
import { sparkBurst } from "./blessingFx.js"
import { fireParticles } from "./fireball.js"
import { darkSlashPalette, inkSplash } from "./darkSlash.js"
import { shockRipple } from "./sonicDistortion.js"
import { DODGED_COLOR, chestOf, comicText, feetOf, headOf, prewarmWords, soundFor } from "./comicHit.js"

// SLASHED - cut by one of the dark slime's fury cutters (enemies/rangeAttack.js,
// effects/darkSlash.js): a line of light drawn clean across them, blood and
// the slime's dark liquid thrown off the cut, a ring off their feet, and
// they're shoved back a step and stagger. Each cutter that lands on top of
// the last one hits harder - "SLASH!", "SLASH!!", "SLASH!!!" - the words
// bigger, the shake harder, the world stopping a beat longer. The cut leaves
// them bleeding (the attack's own bleed effect - characterstate.js's
// tickBleed - shows its own blood).
//
// Everyone sees it: the victim's own client the moment a cutter goes through
// them, everyone else off tcp's "range-attack-landed" relay (worldsocket.js).
// Only the victim's own screen is cut across, darkens at the edges, shakes
// and freezes for the hitstop.

// cutters landing this close together are one combo
const COMBO_MS = 700
const WORDS = ["SLASH!", "SLASH!!", "SLASH!!!"]
// shoved back from where the cutter came through them - out to this, more each hit
const SHOVE = [1.1, 1.5, 2.1]
const HOP = 0.7
// the stagger: the hit clip, quick, into the reeling pose, held this long
const STAGGER_S = [0.3, 0.32, 0.45]
const HIT_SPEED = 1.4
const DAZED_POSE = "structed"
// the cut across them: drawn, held, then thinning out and gone
const CUT_DRAW_MS = 60
const CUT_HOLD_MS = 70
const CUT_FADE_MS = 280
const CUT_LENGTH = 2.3
const CUT_HAIRLINE = 0.14
const CUT_GLOW = 0.6
// the flash through their body
const FLASH_MS = 260
const BLOOD = new Color3(0.62, 0.02, 0.05)

// ── the cut's own texture and materials ──────────────────────────────────────

// a line, thickest through its middle and tapering to points: a hairline
// core, a soft glow round it
const cutTextures = new WeakMap()
function cutTexture(scene){
    let tex = cutTextures.get(scene)
    if(tex) return tex
    const W = 256, H = 64
    tex = new DynamicTexture("slashed.cut", { width: W, height: H }, scene, true)
    const ctx = tex.getContext()
    const img = ctx.createImageData(W, H)
    for(let x = 0; x < W; x++){
        const taper = Math.pow(Math.sin(Math.PI * (x + 0.5) / W), 0.7)
        for(let y = 0; y < H; y++){
            const d = Math.abs(y / (H - 1) - 0.5) * 2 / Math.max(0.05, taper)
            const a = Math.min(1, Math.exp(-Math.pow(d / 0.16, 2)) + 0.35 * Math.exp(-Math.pow(d / 0.6, 2))) * taper
            const i = (y * W + x) * 4
            img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
            img.data[i + 3] = Math.round(a * 255)
        }
    }
    ctx.putImageData(img, 0, 0)
    tex.hasAlpha = true
    tex.update()
    cutTextures.set(scene, tex)
    scene.onDisposeObservable.addOnce(() => cutTextures.delete(scene))
    return tex
}
const cutMats = new WeakMap()   // scene -> Map(key -> material)
function cutMaterial(scene, key, color){
    let byKey = cutMats.get(scene)
    if(!byKey) cutMats.set(scene, byKey = new Map())
    let mat = byKey.get(key)
    if(mat && !mat.isDisposed?.()) return mat
    mat = new StandardMaterial(`slashed.cut.${key}`, scene)
    mat.disableLighting = true
    mat.diffuseColor = Color3.Black()
    mat.specularColor = Color3.Black()
    mat.emissiveColor = color
    mat.opacityTexture = cutTexture(scene)
    mat.alphaMode = Constants.ALPHA_ADD
    mat.transparencyMode = Material.MATERIAL_ALPHABLEND
    mat.disableDepthWrite = true
    mat.backFaceCulling = false
    byKey.set(key, mat)
    return mat
}

/**
 * Compiles what a cutter does to `player` ahead of time - its words, its cut -
 * so the first one doesn't stall. rangeAttack.js calls it when a dark slime
 * shows up.
 */
export function prewarmSlashed(player, color){
    const scene = player?.body?.getScene()
    if(!scene || scene.isDisposed) return
    const palette = darkSlashPalette(color)
    const plane = MeshBuilder.CreatePlane("slashed.prewarm", { size: 0.01 }, scene)
    plane.isVisible = false
    Promise.all([
        cutMaterial(scene, `glow.${palette.name}`, palette.edge).forceCompilationAsync(plane),
        cutMaterial(scene, `core.${palette.name}`, palette.core).forceCompilationAsync(plane),
    ]).catch(() => {}).finally(() => plane.dispose())
    prewarmWords(scene, [
        ...WORDS.map((word, i) => ({ word, color: palette.edge, burst: i === WORDS.length - 1 ? palette.vein : null })),
        { word: "DODGED!", color: DODGED_COLOR },
    ])
}

// ── the hit ──────────────────────────────────────────────────────────────────

/**
 * A cutter going through `player` (a createCharacter() rig). isMine: it's my
 * own character - my screen is cut across, shakes and freezes, the stagger
 * holds my input, and I'm the one shoved (everyone else slides their copy
 * of me). from: the point they're shoved away from (just behind them, back
 * along the cutter's way). roll: the way the cutter leaned (radians) - the
 * cut across them leans with it; not known, a lean of its own.
 */
export function slashPlayer(player, { isMine = false, color = "purple", soundWhenHit = "darkCutS", animation = "hit_struct1", from = null, roll = null } = {}){
    const body = player?.body
    if(!body || body.isDisposed()) return
    const scene = body.getScene()
    const palette = darkSlashPalette(color)
    const now = performance.now()
    const combo = now - (player._slashedAt ?? -Infinity) < COMBO_MS ? Math.min(WORDS.length - 1, (player._slashCombo ?? 0) + 1) : 0
    player._slashedAt = now
    player._slashCombo = combo
    const chest = chestOf(player)
    // the way the cut leans across them, on screen
    const lean = roll === null ? (Math.random() < 0.5 ? -1 : 1) * (25 + Math.random() * 30) : screenLean(roll)

    const sound = soundFor(soundWhenHit)
    if(isMine) sound?.play()
    else playSoundNear(sound, body.position)

    comicText(scene, WORDS[combo], headOf(player).add(new Vector3(0, 0.85 + 0.18 * combo, 0)), palette.edge, {
        burst: combo === WORDS.length - 1 ? palette.vein : null,
        size: 0.9 + 0.14 * combo,
    })
    cutAcross(scene, chest, lean, palette, combo)
    bloodSpray(scene, chest, from, combo)
    inkSplash(scene, chest, palette, { count: 12 + 4 * combo, power: 3.5, size: [0.05, 0.11] })
    sparkBurst(scene, chest, palette.edge, { count: 22 + 8 * combo, power: 6, size: [0.04, 0.1], life: [0.12, 0.3] })
    popShockRing(scene, feetOf(player), { size: 2.2 + 0.5 * combo, seconds: 0.32, color: palette.edge })
    shockRipple(scene, chest, { radius: 2.4 + 0.6 * combo, ms: 360, strength: 0.6, thickness: 0.7, chroma: 0.7, rim: 0.15, tint: palette.edge })
    flashBody(player, palette)

    if(isMine){
        screenCut(lean, palette, combo)
        const side = (Math.random() - 0.5) * 2
        addCameraTrauma(scene, 0.45 + 0.15 * combo, { x: side * 0.8, y: -0.35 })
        punchCameraFov(scene, 0.04 + 0.015 * combo)
        // the hitstop - longer every cut of the combo
        slowMotion(scene, 0.1, 70 + 30 * combo)
    }
    if(from) knockAway(player, from, SHOVE[combo], isMine, { hop: HOP })
    stagger(player, isMine, animation, STAGGER_S[combo])
}

// a cutter's roll as a lean on screen, -90..90 degrees (an arch, rolled
// right over, cuts them flat across)
function screenLean(roll){
    let deg = -(roll * 180) / Math.PI
    while(deg > 90) deg -= 180
    while(deg <= -90) deg += 180
    return deg
}

// the cut: a line of light drawn across their chest at `lean` - in a blink,
// held, then thinning out to nothing - a soft glow round a white-hot hairline
function cutAcross(scene, at, lean, palette, combo){
    const length = CUT_LENGTH * (1 + 0.12 * combo)
    const layers = [
        { mat: cutMaterial(scene, `glow.${palette.name}`, palette.edge), thick: CUT_GLOW, alpha: 0.9 },
        { mat: cutMaterial(scene, `core.${palette.name}`, palette.core), thick: CUT_HAIRLINE, alpha: 1 },
    ].map(({ mat, thick, alpha }) => {
        const plane = MeshBuilder.CreatePlane("slashed.cut", { size: 1 }, scene)
        plane.isPickable = false
        plane.material = mat
        plane.billboardMode = Mesh.BILLBOARDMODE_ALL
        // over the body it's cutting across
        plane.renderingGroupId = 1
        plane.position.copyFrom(at)
        plane.rotation.z = (lean * Math.PI) / 180
        plane.scaling.set(0.01, thick, 1)
        return { plane, thick, alpha }
    })
    const start = performance.now()
    const observer = scene.onBeforeRenderObservable.add(() => {
        const t = performance.now() - start
        if(t >= CUT_DRAW_MS + CUT_HOLD_MS + CUT_FADE_MS){
            scene.onBeforeRenderObservable.remove(observer)
            layers.forEach(({ plane }) => plane.dispose())
            return
        }
        const drawn = 1 - Math.pow(1 - Math.min(1, t / CUT_DRAW_MS), 3)
        const fading = Math.max(0, (t - CUT_DRAW_MS - CUT_HOLD_MS) / CUT_FADE_MS)
        layers.forEach(({ plane, thick, alpha }) => {
            plane.scaling.set(length * drawn * (1 + 0.08 * fading), thick * (1 - 0.85 * fading), 1)
            plane.visibility = alpha * (1 - fading * fading)
        })
    })
}

// blood thrown off the cut - mostly on away from the cutter, and up, falling
function bloodSpray(scene, at, from, combo){
    const away = from ? at.subtract(from) : new Vector3(Math.random() - 0.5, 0, Math.random() - 0.5)
    away.y = 0
    if(away.lengthSquared() > 0.0001) away.normalize()
    const count = 30 + 10 * combo
    const spray = fireParticles(scene, "slashed.blood", count, "flare", at.clone(), ParticleSystem.BLENDMODE_STANDARD)
    spray.startDirectionFunction = (matrix, direction) => {
        direction.set(away.x * 1.1 + (Math.random() - 0.5) * 1.4, 0.35 + Math.random() * 0.8, away.z * 1.1 + (Math.random() - 0.5) * 1.4)
        direction.normalize()
    }
    spray.manualEmitCount = count
    spray.targetStopDuration = 0.1
    spray.minEmitPower = 2.5
    spray.maxEmitPower = 5.5
    spray.minLifeTime = 0.4
    spray.maxLifeTime = 0.8
    spray.minSize = 0.05
    spray.maxSize = 0.12
    spray.gravity = new Vector3(0, -12, 0)
    spray.addColorGradient(0, new Color4(BLOOD.r, BLOOD.g, BLOOD.b, 1))
    spray.addColorGradient(0.7, new Color4(BLOOD.r * 0.55, 0, 0.02, 0.85))
    spray.addColorGradient(1, new Color4(BLOOD.r * 0.4, 0, 0.02, 0))
    spray.start()
}

// a flash of its violet through their body, gone in FLASH_MS
function flashBody(player, palette){
    const scene = player.body.getScene()
    const meshes = (player.root?.getChildMeshes(false) ?? []).filter(mesh => mesh !== player.skeletonMesh && mesh.isVisible && mesh.getTotalVertices() > 0)
    if(!meshes.length) return
    const start = performance.now()
    const observer = scene.onBeforeRenderObservable.add(() => {
        const t = performance.now() - start
        const k = Math.max(0, 1 - t / FLASH_MS)
        meshes.forEach(mesh => {
            // a blow's own white flash (meleeCombat.js) wins while it lasts
            if(mesh.isDisposed() || mesh._hitFlashUntil > performance.now()) return
            mesh.renderOverlay = k > 0
            mesh.overlayColor = t < 60 ? palette.core : palette.edge
            mesh.overlayAlpha = 0.7 * k
        })
        if(k <= 0) scene.onBeforeRenderObservable.remove(observer)
    })
}

// the stagger: the hit clip, quick, into the reeling pose, held by the stun
// (and, mine, my input with it) - not for someone dying of it
function stagger(player, isMine, animation, seconds){
    const anims = player.characterAnimations
    if(!anims || player.isDead || player.mode === "death") return
    const pose = anims.stateForClip(player.anims, DAZED_POSE)
    if(!pose) return
    // not the slump itself as the hit clip (see scorch.js's reel)
    const played = !!animation && animation.toLowerCase() !== DAZED_POSE &&
        anims.playAction(player.anims, animation, HIT_SPEED, null, false, pose)
    if(!played) anims.setState(pose, 4)
    stunPlayer(player, seconds, pose, isMine, { stars: false })
}

// ── my own screen ────────────────────────────────────────────────────────────

const css = color => `${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)}`

// my screen cut clean across at `lean` - a white line with the cutter's glow
// round it, drawn out from the middle in a blink and gone - and the dark
// closing in at the edges for a moment
function screenCut(lean, palette, combo){
    if(typeof document === "undefined") return
    const wrap = document.createElement("div")
    wrap.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;"
    const shade = document.createElement("div")
    shade.style.cssText = `position:absolute;inset:0;background:radial-gradient(ellipse at center, rgba(0,0,0,0) 35%, rgba(${css(palette.ink)},${0.5 + 0.12 * combo}) 100%);`
    const line = document.createElement("div")
    const thick = 3 + combo
    line.style.cssText = `position:absolute;left:-15%;top:50%;width:130%;height:${thick}px;margin-top:${-thick / 2}px;` +
        `background:linear-gradient(90deg, rgba(255,255,255,0) 0%, #fff 20%, #fff 80%, rgba(255,255,255,0) 100%);` +
        `box-shadow:0 0 12px 3px rgba(${css(palette.edge)},0.95), 0 0 40px 12px rgba(${css(palette.vein)},0.55);` +
        `transform-origin:50% 50%;`
    wrap.append(shade, line)
    document.body.appendChild(wrap)
    const turn = `rotate(${lean}deg)`
    line.animate([
        { transform: `${turn} scaleX(0)`, opacity: 1 },
        { transform: `${turn} scaleX(1)`, opacity: 1, offset: 0.15 },
        { transform: `${turn} scaleX(1.04) scaleY(0.15)`, opacity: 0 },
    ], { duration: 420, easing: "ease-out" })
    shade.animate([{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 0 }], { duration: 560, easing: "ease-out" }).onfinish = () => wrap.remove()
}
