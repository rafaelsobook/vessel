import { Color3, Color4, DynamicTexture, Mesh, MeshBuilder, ParticleSystem, StandardMaterial, Vector3 } from "@babylonjs/core"
import { getParticleTexture, particleTexturePath } from "../tools/particlesystem.js"
import { getAllSounds } from "../components/soundSystem.js"

// A RANGED HIT LANDING ON A PLAYER - the bits lightning (./electrocute.js) and
// the fireball (./scorch.js) share: where on the body, the hit's sound by
// name, the cartoon word popping out of it ("ZZZT!", "KABOOM!", "DODGED!"),
// the victim's own screen flashing, a puff of smoke.

// ── where on the body ────────────────────────────────────────────────────────

export function chestOf(player){
    return player.body.position.add(new Vector3(0, 0.28, 0))
}
export function headOf(player){
    return player.headBone?.getAbsolutePosition?.()?.clone() ?? player.body.position.add(new Vector3(0, 0.75, 0))
}
export function feetOf(player){
    return player.body.position.add(new Vector3(0, -0.74, 0))
}

// a sound in soundSystem.js's allSounds by a loose name - "electrichit" finds
// electricHitS, "firehit" fireHitS
export function soundFor(name){
    const sounds = getAllSounds()
    if(!sounds || !name) return null
    if(sounds[name]) return sounds[name]
    if(sounds[`${name}S`]) return sounds[`${name}S`]
    const want = name.toLowerCase()
    return Object.entries(sounds).find(([key]) => {
        const k = key.toLowerCase()
        return k === want || k === `${want}s`
    })?.[1] ?? null
}

const rgb = c => `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`

// the whole screen lit, twice, like a real flash - white in the middle, the
// hit's colours (core, glow) out to the edges. The victim's own screen only.
export function screenFlash({ core, glow }){
    if(typeof document === "undefined") return
    const flash = document.createElement("div")
    flash.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:9999;mix-blend-mode:screen;` +
        `background:radial-gradient(ellipse at center, rgba(255,255,255,0.5) 0%, rgba(${rgb(core)},0.32) 45%, rgba(${rgb(glow)},0.6) 100%)`
    document.body.appendChild(flash)
    flash.animate(
        [{ opacity: 1 }, { opacity: 0.15, offset: 0.2 }, { opacity: 0.85, offset: 0.32 }, { opacity: 0 }],
        { duration: 420, easing: "ease-out" },
    ).onfinish = () => flash.remove()
}

// ── the cartoon word ─────────────────────────────────────────────────────────

// the "DODGED!" a ranged attack missing you shows (enemies/rangeAttack.js)
export const DODGED_COLOR = new Color3(0.45, 0.95, 1)
const INK = "#140b02"

/**
 * A cartoon word popping out of a hit - outlined, over everything, gone in
 * under a second. burst: a colour to put a jagged comic-book explosion behind
 * it (the fireball's "KABOOM!"); size scales the whole thing. Each word is
 * drawn once per scene, colour and burst.
 */
export function comicText(scene, word, at, color, { burst = null, size = 1 } = {}){
    if(!scene || scene.isDisposed) return
    const mat = wordMaterial(scene, word, color, burst)
    const plane = burst
        ? MeshBuilder.CreatePlane(`comic.${word}`, { width: 2.9 * size, height: 1.63 * size }, scene)
        : MeshBuilder.CreatePlane(`comic.${word}`, { width: 2.5 * size, height: 0.94 * size }, scene)
    plane.isPickable = false
    plane.material = mat
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL
    // drawn last, over the bodies and the blast
    plane.renderingGroupId = 1
    plane.position.copyFrom(at)
    const start = performance.now()
    const rise = 0.55
    const observer = scene.onBeforeRenderObservable.add(() => {
        const t = (performance.now() - start) / 760
        if(t >= 1){
            scene.onBeforeRenderObservable.remove(observer)
            plane.dispose()
            return
        }
        // pops big, settles, drifts up, fades
        const pop = t < 0.08 ? t / 0.08 * 1.4 : t < 0.2 ? 1.4 - (t - 0.08) / 0.12 * 0.4 : 1
        const shake = t < 0.25 ? (Math.random() - 0.5) * 0.06 : 0
        plane.scaling.setAll(pop)
        plane.position.set(at.x + shake, at.y + rise * (1 - Math.pow(1 - t, 2)), at.z)
        plane.visibility = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1
    })
}

/** Draws `words` ({ word, color, burst? }) now - texture and shader - rather than on the hit. */
export function prewarmWords(scene, words){
    const plane = MeshBuilder.CreatePlane("comic.prewarm", { width: 0.01, height: 0.01 }, scene)
    plane.isVisible = false
    Promise.all(words.map(({ word, color, burst = null }) => wordMaterial(scene, word, color, burst).forceCompilationAsync(plane)))
        .catch(() => {})
        .finally(() => plane.dispose())
}

const wordCache = new WeakMap()   // scene -> Map(key -> material)
// white-hot to its colour, a thick dark outline - on a burst, if it has one
function wordMaterial(scene, word, color, burst){
    let byKey = wordCache.get(scene)
    if(!byKey) wordCache.set(scene, byKey = new Map())
    const key = `${word}|${color.toHexString()}|${burst?.toHexString() ?? ""}`
    let mat = byKey.get(key)
    if(mat) return mat
    const width = 512
    const height = burst ? 288 : 192
    const texture = new DynamicTexture(`comic.${word}`, { width, height }, scene, true)
    texture.hasAlpha = true
    const ctx = texture.getContext()
    ctx.clearRect(0, 0, width, height)
    const middle = burst ? height / 2 + 4 : 100
    if(burst) drawBurst(ctx, width, height, color, burst)
    ctx.font = `900 ${word.length > 6 ? 104 : 128}px Impact, "Arial Black", sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.lineJoin = "round"
    ctx.lineWidth = 22
    ctx.strokeStyle = INK
    ctx.strokeText(word, width / 2, middle)
    const fill = ctx.createLinearGradient(0, middle - 60, 0, middle + 60)
    fill.addColorStop(0, "#ffffff")
    fill.addColorStop(0.55, color.toHexString())
    fill.addColorStop(1, Color3.Lerp(color, Color3.Black(), 0.35).toHexString())
    ctx.fillStyle = fill
    ctx.fillText(word, width / 2, middle)
    texture.update()
    mat = new StandardMaterial(`comic.${key}`, scene)
    mat.diffuseTexture = texture
    mat.useAlphaFromDiffuseTexture = true
    mat.disableLighting = true
    mat.emissiveColor = Color3.White()
    mat.specularColor = Color3.Black()
    mat.backFaceCulling = false
    byKey.set(key, mat)
    return mat
}

// a comic-book explosion: a jagged star, white-hot in the middle out to
// `burst` at its points, inked - every spike its own length, the same each time
function drawBurst(ctx, width, height, color, burst){
    const cx = width / 2
    const cy = height / 2
    const spikes = 15
    let seed = 7
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    ctx.beginPath()
    for(let i = 0; i < spikes * 2; i++){
        const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2
        const r = i % 2 === 0 ? 0.86 + random() * 0.14 : 0.56 + random() * 0.1
        const x = cx + Math.cos(a) * r * (width / 2 - 14)
        const y = cy + Math.sin(a) * r * (height / 2 - 12)
        if(i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
    }
    ctx.closePath()
    const fill = ctx.createRadialGradient(cx, cy, 10, cx, cy, width / 2)
    fill.addColorStop(0, "#ffffff")
    fill.addColorStop(0.35, Color3.Lerp(burst, Color3.White(), 0.55).toHexString())
    fill.addColorStop(1, burst.toHexString())
    ctx.fillStyle = fill
    ctx.lineJoin = "miter"
    ctx.lineWidth = 9
    ctx.strokeStyle = Color3.Lerp(color, Color3.Black(), 0.55).toHexString()
    ctx.fill()
    ctx.stroke()
}

// ── smoke ────────────────────────────────────────────────────────────────────

/** A little dark smoke at `at` - singed, or a cough. */
export function smokePuff(scene, at, { count = 14, size = 1 } = {}){
    if(!scene || scene.isDisposed) return
    const smoke = new ParticleSystem("hit.smoke", count + 4, scene)
    smoke.particleTexture = getParticleTexture(scene, particleTexturePath("smoke"))
    smoke.emitter = at.clone()
    smoke.createSphereEmitter(0.18 * size, 1)
    smoke.minEmitPower = 0.2
    smoke.maxEmitPower = 0.5
    smoke.minLifeTime = 0.8
    smoke.maxLifeTime = 1.3
    smoke.manualEmitCount = count
    smoke.updateSpeed = 1 / 60
    smoke.gravity = new Vector3(0, 0.9, 0)
    smoke.blendMode = ParticleSystem.BLENDMODE_STANDARD
    smoke.addSizeGradient(0, 0.18 * size, 0.26 * size)
    smoke.addSizeGradient(1, 0.55 * size, 0.8 * size)
    smoke.minAngularSpeed = -1
    smoke.maxAngularSpeed = 1
    smoke.color1 = new Color4(0.14, 0.13, 0.12, 0.7)
    smoke.color2 = new Color4(0.25, 0.24, 0.22, 0.6)
    smoke.colorDead = new Color4(0.3, 0.3, 0.3, 0)
    smoke.targetStopDuration = 0.1
    // not disposeOnStop - that takes the shared texture with it
    smoke.onAnimationEnd = () => setTimeout(() => { if(!scene.isDisposed) smoke.dispose(false) }, 0)
    smoke.start()
}
