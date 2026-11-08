import { Color3, Color4, ParticleSystem, StandardMaterial, Texture, Vector3 } from "@babylonjs/core"
import { addGlow } from "../tools/glow.js"
import { addCameraTrauma, punchCameraFov } from "../tools/cameraShake.js"
import { disposeLayerMaterial, isGone, keepOverride, overrideMaterial, ownMaterial, releaseMaterial } from "../tools/materialOverride.js"
import { playSoundNear } from "../components/soundSystem.js"
import { stunPlayer } from "../charactersystem/stun.js"
import { knockAway } from "../charactersystem/knockback.js"
import { slowMotion } from "../charactersystem/meleeCombat.js"
import { facePartOf } from "../charactersystem/createcharacter.js"
import { fireParticles, firePalette, flameColors } from "./fireball.js"
import { DODGED_COLOR, chestOf, comicText, headOf, prewarmWords, screenFlash, smokePuff, soundFor } from "./comicHit.js"

// BURNT TO A CRISP - the cartoon blast: caught in a fireball's blast
// (enemies/rangeAttack.js), they're thrown back off their feet and everything
// they wear goes to charcoal - their own textures gone soot-black, cracked
// all over with glowing embers that cool and go out - while flames lick up
// off them, embers drift away and smoke curls from their head. Only their
// eyes are spared, white in the black face: they blink... blink. A cough of
// smoke. Then the soot crumbles off them in a shower of ash.
//
// Everyone sees it: the victim's own client the moment the blast lands,
// everyone else off tcp's "range-attack-landed" relay (worldsocket.js). Only
// the victim's own screen flashes, burns at its edges and shakes.

const SCORCHED_MS = 2600
// thrown off their feet - out to this far from the blast's middle, and up
const THROWN = 2.4
const HOP = 3.2
// knocked silly: the hit clip (rangeAtkDetails.victimAnimation) a touch
// quicker than its own pace, slumping into the dazed pose - no stars, the
// smoke's the gag
const STUN_MS = 1300
const HIT_SPEED = 1.2
const DAZED_POSE = "structed"
// the whole of them white-hot for an instant, then the cracks cooling to
// nothing by COOL_MS (the cracks' texture level, flickering)
const HOT_FLASH_MS = 260
const COOL_MS = 1700
const CRACK_LEVEL = 1.9
const CRACK_TILING = 3
// soot: each piece's own texture darkened to this - or, untextured, this
const SOOT = new Color3(0.2, 0.17, 0.15)
const SOOT_PLAIN = new Color3(0.09, 0.08, 0.07)
const SMOKE = new Color3(0.13, 0.12, 0.11)
const ASH = new Color3(0.16, 0.15, 0.14)
// the face: blink... blink. A cough.
const BLINKS = [1250, 1600]
const BLINK_MS = 120
const COUGH_AT = 1950
const COUGH_COLOR = new Color3(0.72, 0.7, 0.68)

const c4 = (color, alpha) => new Color4(color.r, color.g, color.b, alpha)
const rgb = c => `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`

// ── materials ────────────────────────────────────────────────────────────────

// The cracks are drawn once per scene and palette, and every burn gets its
// own handle on that one image: a texture's level (how bright the cracks
// glow) is per handle, so each burn cools at its own pace.
const crackImages = new WeakMap()   // scene -> Map(palette name -> { name, url, keeper })
function crackTexture(scene, palette){
    let byPalette = crackImages.get(scene)
    if(!byPalette) crackImages.set(scene, byPalette = new Map())
    let image = byPalette.get(palette.name)
    if(!image){
        image = { name: `scorch.cracks.${palette.name}`, url: drawCracks(palette) }
        // held for the scene's life: while any handle's alive, the image stays loaded
        image.keeper = crackHandle(scene, image)
        byPalette.set(palette.name, image)
    }
    const handle = crackHandle(scene, image)
    handle.uScale = handle.vScale = CRACK_TILING
    return handle
}
// the same "data:" name every time - Babylon's texture cache hands back the
// one already loaded
function crackHandle(scene, image){
    return Texture.CreateFromBase64String(image.url, image.name, scene, false, true, Texture.TRILINEAR_SAMPLINGMODE)
}

// lava cracks: a mosaic of cells, the borders between them burning -
// white-hot at the crack, through its colour, to a dull glow beside it - and
// here and there a cell still smouldering. Tiles seamlessly.
function drawCracks(palette){
    const size = 256
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = size
    const ctx = canvas.getContext("2d")
    const image = ctx.createImageData(size, size)
    let seed = 11
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const cells = Array.from({ length: 24 }, () => ({ x: random() * size, y: random() * size, smoulder: random() < 0.18 ? 0.12 + random() * 0.15 : 0 }))
    const stops = [[0, [0, 0, 0]], [0.2, palette.edge.asArray()], [0.45, palette.mid.asArray()], [0.75, palette.hot.asArray()], [1, palette.core.asArray()]]
    for(let y = 0; y < size; y++){
        for(let x = 0; x < size; x++){
            let d1 = Infinity
            let d2 = Infinity
            let smoulder = 0
            for(const cell of cells){
                let dx = Math.abs(x - cell.x)
                let dy = Math.abs(y - cell.y)
                if(dx > size / 2) dx = size - dx
                if(dy > size / 2) dy = size - dy
                const d = dx * dx + dy * dy
                if(d < d1){
                    d2 = d1
                    d1 = d
                    smoulder = cell.smoulder
                } else if(d < d2) d2 = d
            }
            // how far from the border between the two nearest cells
            const gap = Math.sqrt(d2) - Math.sqrt(d1)
            const v = Math.min(1, Math.max(0, 1 - gap / 3) + Math.max(0, 1 - gap / 11) ** 2 * 0.32 + smoulder)
            let k = 1
            while(k < stops.length - 1 && v > stops[k][0]) k++
            const [a, from] = stops[k - 1]
            const [b, to] = stops[k]
            const f = Math.min(1, Math.max(0, (v - a) / (b - a)))
            const i = (y * size + x) * 4
            image.data[i] = (from[0] + (to[0] - from[0]) * f) * 255
            image.data[i + 1] = (from[1] + (to[1] - from[1]) * f) * 255
            image.data[i + 2] = (from[2] + (to[2] - from[2]) * f) * 255
            image.data[i + 3] = 255
        }
    }
    ctx.putImageData(image, 0, 0)
    return canvas.toDataURL("image/png")
}

// a piece of them, charred: its own texture (or colour) gone to soot, the
// cracks glowing through - and a cut-out piece (hair cards) stays cut out
function charMaterial(scene, original, cracks){
    const mat = new StandardMaterial("scorched", scene)
    const texture = original?.diffuseTexture ?? null
    mat.diffuseTexture = texture
    mat.diffuseColor = texture ? SOOT : SOOT_PLAIN
    mat.specularColor = new Color3(0.05, 0.045, 0.04)
    mat.emissiveTexture = cracks
    mat.emissiveColor = Color3.Black()
    if(original){
        mat.useAlphaFromDiffuseTexture = !!original.useAlphaFromDiffuseTexture
        mat.opacityTexture = original.opacityTexture ?? null
        mat.alphaCutOff = original.alphaCutOff ?? mat.alphaCutOff
        mat.transparencyMode = original.transparencyMode ?? null
        mat.backFaceCulling = original.backFaceCulling ?? true
        mat.alpha = original.alpha ?? 1
    }
    return mat
}

// the eyelids a blink shows - soot, like the rest of the face
const lidMats = new WeakMap()   // scene -> material
function lidMaterial(scene){
    let mat = lidMats.get(scene)
    // made again if something threw it away with a rig it was on
    if(mat && !isGone(mat)) return mat
    mat = new StandardMaterial("scorched.lids", scene)
    mat.diffuseColor = SOOT_PLAIN
    mat.specularColor = Color3.Black()
    lidMats.set(scene, mat)
    return mat
}

// everything showing on the rig - body, hair, clothes, armour, weapon - but
// the skeleton and the eyes: white in the black face, the cartoon's gag
function charTargets(player){
    const skeleton = player.skeletonMesh
    return (player.root?.getChildMeshes(false) ?? []).filter(mesh =>
        mesh !== skeleton && mesh.isVisible && mesh.isEnabled() && mesh.material && mesh.getTotalVertices() > 0 && !isEye(mesh))
}
function eyesOf(player){
    return (player.root?.getChildMeshes(false) ?? []).filter(mesh => mesh.isVisible && mesh.isEnabled() && isEye(mesh))
}
function isEye(mesh){
    const part = facePartOf(mesh.name)?.part
    return part === "eyes" || part === "eyeback"
}

/**
 * Compiles the charring for `player`'s own pieces ahead of time (and its glow
 * pass, and its words), so the first blast doesn't stall on its shaders.
 * rangeAttack.js calls it when an enemy that throws fireballs shows up.
 */
export function prewarmScorch(player, color){
    const scene = player?.body?.getScene()
    if(!scene || scene.isDisposed) return
    const palette = firePalette(color)
    const cracks = crackTexture(scene, palette)
    const pieces = charTargets(player).map(mesh => ({ mesh, mat: charMaterial(scene, ownMaterial(mesh), cracks) }))
    Promise.all(pieces.map(({ mesh, mat }) => mat.forceCompilationAsync(mesh).catch(() => {})))
        .then(() => {
            // the glow pass over them too - each worn for an instant, nothing
            // drawn in between
            const glow = scene.effectLayers?.find(layer => layer.name === "magicGlow")
            pieces.forEach(({ mesh, mat }) => {
                if(!glow || mesh.isDisposed() || !mesh.subMeshes?.length) return
                const own = mesh.material
                mesh.material = mat
                try {
                    glow.isReady(mesh.subMeshes[0], false)
                } finally {
                    mesh.material = own
                }
            })
        })
        .finally(() => {
            pieces.forEach(({ mat }) => mat.dispose(false, false))
            cracks.dispose()
        })
    const eye = eyesOf(player)[0]
    if(eye) lidMaterial(scene).forceCompilationAsync(eye).catch(() => {})
    prewarmWords(scene, [
        { word: "KABOOM!", color: palette.mid, burst: palette.hot },
        { word: "DODGED!", color: DODGED_COLOR },
        { word: "*cough*", color: COUGH_COLOR },
    ])
}

// ── the blast ────────────────────────────────────────────────────────────────

/**
 * Burn `player` (a createCharacter() rig) to a crisp. isMine: it's my own
 * character - my screen flashes, burns at its edges and shakes, the stun
 * holds my input, and I'm the one thrown (everyone else slides their copy of
 * me). from: the blast's middle - they're thrown away from it. animation: the
 * clip they reel in (rangeAtkDetails.victimAnimation). Caught again while
 * still burnt, it flares up hot again, and lasts longer.
 */
export function scorchPlayer(player, { isMine = false, color = "red", soundWhenHit = "firehit", animation = "hit_struct1", from = null, ms = SCORCHED_MS } = {}){
    const body = player?.body
    if(!body || body.isDisposed()) return
    const scene = body.getScene()
    const palette = firePalette(color)
    const now = performance.now()

    const sound = soundFor(soundWhenHit)
    if(isMine) sound?.play()
    else playSoundNear(sound, body.position)
    comicText(scene, "KABOOM!", headOf(player).add(new Vector3(0, 0.85, 0)), palette.mid, { burst: palette.hot })
    if(isMine){
        screenFlash({ core: palette.core, glow: palette.mid })
        heatHaze(palette)
        addCameraTrauma(scene, 0.85, { x: (Math.random() - 0.5) * 1.2, y: -0.6 })
        punchCameraFov(scene, 0.075)
        // the world holds its breath for a blink
        slowMotion(scene, 0.12, 110)
    }
    if(from) knockAway(player, from, THROWN, isMine, { hop: HOP })
    reel(player, isMine, animation)

    // already burnt - hot again, and for longer
    if(player._scorch){
        player._scorch.until = Math.max(player._scorch.until, now + ms)
        player._scorch.heatedAt = now
        return
    }

    const state = { until: now + ms, heatedAt: now }
    player._scorch = state
    const cracks = crackTexture(scene, palette)
    // each piece charred as a layer worn over its own look
    // (tools/materialOverride.js) - lightning meanwhile, and it goes back to
    // burnt after, not to clean
    const pieces = charTargets(player).map(mesh => {
        const mat = charMaterial(scene, ownMaterial(mesh), cracks)
        overrideMaterial(mesh, state, mat)
        // the cracks bloom - unless something else already glows this piece
        // (a blessed blade), which is left to it
        const saved = { layer: mesh._glowLayer, color: mesh._glowColor, brightness: mesh._glowBrightness }
        const glows = !mesh._glowLayer?.hasMesh?.(mesh)
        if(glows){
            mesh._glowColor = palette.mid
            addGlow(scene, mesh, CRACK_LEVEL)
        }
        return { mesh, mat, glows, saved }
    })
    const charred = pieces.map(piece => piece.mesh)

    // flames licking up off them, embers drifting away, smoke curling off
    // their head - all following them (Vector3 emitters: a mesh as the
    // emitter would take them, and their shared textures, with it when the
    // rig's disposed)
    const middle = body.position.clone()
    const crown = headOf(player)
    const flames = fireParticles(scene, "scorch.flames", 160, "flame2", middle)
    flames.createDirectedCylinderEmitter(0.3, 1.3, 1, new Vector3(-0.2, 1, -0.2), new Vector3(0.2, 1, 0.2))
    flames.minEmitPower = 0.4
    flames.maxEmitPower = 1
    flames.minLifeTime = 0.25
    flames.maxLifeTime = 0.5
    flames.gravity = new Vector3(0, 1.5, 0)
    flames.minInitialRotation = -0.3
    flames.maxInitialRotation = 0.3
    flames.addSizeGradient(0, 0.26, 0.42)
    flames.addSizeGradient(1, 0.08, 0.12)
    flameColors(flames, palette)
    flames.start()
    const embers = fireParticles(scene, "scorch.embers", 80, "flare", middle)
    embers.createDirectedCylinderEmitter(0.35, 1.4, 1, new Vector3(-0.3, 1, -0.3), new Vector3(0.3, 1, 0.3))
    embers.minEmitPower = 0.3
    embers.maxEmitPower = 0.9
    embers.minLifeTime = 0.6
    embers.maxLifeTime = 1.2
    embers.gravity = new Vector3(0, 0.7, 0)
    embers.addSizeGradient(0, 0.03, 0.06)
    embers.addSizeGradient(1, 0.01, 0.02)
    embers.addColorGradient(0, c4(palette.hot, 1))
    embers.addColorGradient(0.5, c4(palette.mid, 0.9))
    embers.addColorGradient(1, c4(palette.edge, 0))
    embers.start()
    const smoke = fireParticles(scene, "scorch.smoke", 70, "smoke", crown, ParticleSystem.BLENDMODE_STANDARD)
    smoke.createSphereEmitter(0.2, 1)
    smoke.minEmitPower = 0.25
    smoke.maxEmitPower = 0.6
    smoke.minLifeTime = 1
    smoke.maxLifeTime = 1.6
    smoke.gravity = new Vector3(0, 1.1, 0)
    smoke.minInitialRotation = -Math.PI
    smoke.maxInitialRotation = Math.PI
    smoke.minAngularSpeed = -1
    smoke.maxAngularSpeed = 1
    smoke.addSizeGradient(0, 0.16, 0.24)
    smoke.addSizeGradient(1, 0.7, 0.9)
    smoke.addColorGradient(0, c4(SMOKE, 0))
    smoke.addColorGradient(0.15, c4(SMOKE, 0.65))
    smoke.addColorGradient(1, c4(SMOKE.scale(2.4), 0))
    smoke.start()

    const eyes = eyesOf(player)
    const lids = {}   // the blink's own layer over the eyes
    const blinks = BLINKS.slice()
    let blinkUntil = 0
    let coughed = false
    let overlaid = false
    const observer = scene.onBeforeRenderObservable.add(() => {
        const t = performance.now()
        if(t >= state.until || body.isDisposed()) return finish()
        // a piece re-equipped meanwhile goes back to charcoal
        keepOverride(charred, state)
        const since = t - now
        const heat = Math.max(0, 1 - (t - state.heatedAt) / COOL_MS)
        const flash = Math.max(0, 1 - (t - state.heatedAt) / HOT_FLASH_MS)
        // the cracks cooling - flickering as they go
        cracks.level = CRACK_LEVEL * Math.pow(heat, 1.3) * (0.85 + Math.random() * 0.15)
        pieces.forEach(({ mesh, glows }) => {
            if(mesh.isDisposed()) return
            if(glows) mesh._glowBrightness = cracks.level * 0.8
            // white-hot all over, for an instant
            if(flash > 0){
                mesh.renderOverlay = true
                mesh.overlayColor = palette.hot
                mesh.overlayAlpha = 0.85 * flash
            } else if(overlaid) mesh.renderOverlay = false
        })
        overlaid = flash > 0
        flames.emitRate = 170 * heat * heat
        embers.emitRate = 6 + 44 * heat
        smoke.emitRate = 12 + 22 * heat
        middle.copyFrom(body.position)
        crown.copyFrom(headOf(player))
        // blink... blink
        if(blinks.length && since >= blinks[0]){
            blinks.shift()
            blinkUntil = t + BLINK_MS
            eyes.forEach(eye => overrideMaterial(eye, lids, lidMaterial(scene)))
        }
        if(blinkUntil && t >= blinkUntil){
            blinkUntil = 0
            eyes.forEach(eye => releaseMaterial(eye, lids))
        }
        if(!coughed && since >= COUGH_AT){
            coughed = true
            cough(scene, player)
        }
    })

    function finish(){
        scene.onBeforeRenderObservable.remove(observer)
        pieces.forEach(({ mesh, mat, glows, saved }) => {
            releaseMaterial(mesh, state)
            if(!mesh.isDisposed()){
                if(overlaid) mesh.renderOverlay = false
                if(glows){
                    mesh._glowLayer?.removeIncludedOnlyMesh(mesh)
                    mesh._glowLayer = saved.layer
                    mesh._glowColor = saved.color
                    mesh._glowBrightness = saved.brightness
                }
            }
            disposeLayerMaterial(mat)
        })
        eyes.forEach(eye => releaseMaterial(eye, lids))
        cracks.dispose()
        flames.stop()
        embers.stop()
        smoke.stop()
        if(player._scorch === state) player._scorch = null
        if(!body.isDisposed()) crumble(scene, player)
    }
}

// thrown off their feet: the hit clip, quick, into the dazed slump, held by
// the stun (and, mine, my input with it) - not for someone dying of it
function reel(player, isMine, animation){
    const anims = player.characterAnimations
    if(!anims || player.isDead || player.mode === "death") return
    const pose = anims.stateForClip(player.anims, DAZED_POSE)
    if(!pose) return
    // not the slump itself as the hit clip: an action that is also the state
    // it settles into ends at weight 0 (animation.js's playAction) - the rig
    // would drop to its bind pose
    const played = !!animation && animation.toLowerCase() !== DAZED_POSE &&
        anims.playAction(player.anims, animation, HIT_SPEED, null, false, pose)
    if(!played) anims.setState(pose, 4)
    stunPlayer(player, STUN_MS / 1000, pose, isMine, { stars: false })
}

// a cough: a little puff of smoke out of them, and the word
function cough(scene, player){
    const head = headOf(player)
    smokePuff(scene, head.add(new Vector3(0, 0.05, 0)), { count: 8, size: 0.7 })
    comicText(scene, "*cough*", head.add(new Vector3(0, 0.55, 0)), COUGH_COLOR, { size: 0.45 })
}

// the soot crumbling off them: ash falling away, a puff of dust
function crumble(scene, player){
    const ash = fireParticles(scene, "scorch.ash", 100, "smoke", player.body.position.clone(), ParticleSystem.BLENDMODE_STANDARD)
    ash.createCylinderEmitter(0.32, 1.4, 1, 0.4)
    ash.manualEmitCount = 90
    ash.targetStopDuration = 0.1
    ash.minEmitPower = 0.3
    ash.maxEmitPower = 1
    ash.minLifeTime = 0.6
    ash.maxLifeTime = 1.1
    ash.gravity = new Vector3(0, -3.5, 0)
    ash.minInitialRotation = -Math.PI
    ash.maxInitialRotation = Math.PI
    ash.addSizeGradient(0, 0.05, 0.1)
    ash.addSizeGradient(1, 0.03, 0.06)
    ash.addColorGradient(0, c4(ASH, 0.9))
    ash.addColorGradient(1, c4(ASH.scale(2), 0))
    ash.start()
    smokePuff(scene, chestOf(player), { count: 16, size: 1.8 })
}

// my own screen, burning: its edges glowing the fire's colours and fading,
// embers drifting up across it
function heatHaze(palette, ms = 1700){
    if(typeof document === "undefined") return
    const layer = document.createElement("div")
    layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9998;overflow:hidden;"
    const edges = document.createElement("div")
    edges.style.cssText = `position:absolute;inset:0;mix-blend-mode:screen;` +
        `background:radial-gradient(ellipse at center, rgba(0,0,0,0) 42%, rgba(${rgb(palette.mid)},0.34) 76%, rgba(${rgb(palette.edge)},0.75) 100%)`
    layer.appendChild(edges)
    edges.animate(
        [{ opacity: 1 }, { opacity: 0.5, offset: 0.12 }, { opacity: 0.85, offset: 0.24 }, { opacity: 0.45, offset: 0.55 }, { opacity: 0 }],
        { duration: ms, easing: "ease-out", fill: "forwards" },
    )
    for(let i = 0; i < 18; i++){
        const ember = document.createElement("div")
        const size = 3 + Math.random() * 5
        ember.style.cssText = `position:absolute;left:${Math.random() * 100}%;bottom:${-4 + Math.random() * 22}%;` +
            `width:${size}px;height:${size}px;border-radius:50%;background:rgb(${rgb(palette.hot)});` +
            `box-shadow:0 0 ${size * 2}px ${size * 0.6}px rgba(${rgb(palette.mid)},0.9);opacity:0;`
        layer.appendChild(ember)
        ember.animate(
            [
                { transform: "translate(0, 0)", opacity: 0 },
                { opacity: 1, offset: 0.15 },
                { transform: `translate(${(Math.random() - 0.5) * 12}vw, -${25 + Math.random() * 45}vh)`, opacity: 0 },
            ],
            { duration: 800 + Math.random() * 900, delay: Math.random() * 350, easing: "ease-out", fill: "both" },
        )
    }
    document.body.appendChild(layer)
    setTimeout(() => layer.remove(), ms + 500)
}
