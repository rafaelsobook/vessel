import { Axis, Camera, Color3, Constants, DynamicTexture, LoadAssetContainerAsync, Mesh, MeshBuilder, ParticleSystem, Quaternion, StandardMaterial, Texture, TransformNode, Vector3, VertexData } from "@babylonjs/core"
import { getPlayersOnScene } from "../sockets/worldsocket.js"
import { getCharState } from "../charactersystem/characterstate.js"
import { getAllSounds } from "../components/soundSystem.js"
import { addCameraTrauma, punchCameraFov } from "../tools/cameraShake.js"
import { addGlow } from "../tools/glow.js"
import { CARD_ASPECT, CARD_PLANE_HEIGHT, createSkillCard } from "../gui/blessingCard.js"
import { createRewardText } from "../gui/fortuneWheelGui.js"
import { sparkBurst } from "./blessingFx.js"
import { popShockRing } from "./shockRing.js"
import { shockRipple } from "./sonicDistortion.js"
import { chestOf, feetOf, headOf, screenFlash, smokePuff } from "./comicHit.js"
import { fireParticles } from "./fireball.js"
import { crackle, pointOnSphere } from "./zap.js"
import { animate, c4, easeInCubic, easeInQuad, easeOutBack, easeOutCubic, fireAura, gather, inflow, later, lightMaterial, lightPillar, lightPlane, motes, popPlane, prewarmBlessingMotifs, shell, tintBody } from "./blessingMotifs.js"

// LEARNING A SKILL FROM A TOME, SHOWN - what itemInfoSystem.js's "learn"
// button plays in place of the flat "Skill Learned" popup. The tome itself
// (models/indors/book1.glb - an open book, split here at its spine so its
// cover really swings) is called up beside you and opened, and the skill
// comes out of it as a card (gui/blessingCard.js's createSkillCard) and is
// drawn into you the way a blessing is (effects/blessingReveal.js). How hard
// it all hits is the tome's RARITY - a ladder of fanfare, each rung a colour
// players already read (grey, green, blue, purple, gold, crimson):
//   1. it comes       the closed tome rises up beside you, turning, light
//                     leaking round it in common grey
//   2. it climbs      its light steps up the rarities to its own - each step a
//                     pulse, a ring, a chime a note higher, the tome shaking
//                     harder, light pulled into it from all round; arcs of
//                     lightning crawl over an epic one, a crimson storm over a
//                     mythic one. The rarer, the longer it builds (the build
//                     is the thrill - the reveal pays it off)
//   3. it opens       the cover swings open, a flash, the air bent; pages race
//                     over (more, the rarer); runes stream up off them; the
//                     skill's own magic circle (its element's - the one its
//                     cast draws) turns behind it; a plume of light off the
//                     pages - a legendary one is struck by light from the
//                     sky, a mythic one darkens the world round it
//   4. the card       rises out of the pages, held up to be read
//   5. it's yours     drawn into your chest - the impact as big as the rarity
//                     (rings, a shell of light, lightning, a column from the
//                     sky, the screen flashing), the words over your head
//   6. the tome       slams shut and burns away - it's spent
// Only on your own screen; the skill was already taken (and saved) before
// this starts. One at a time - a second tome waits for the first.

const hex = text => Color3.FromHexString(text)
// the rarities, lowest first - their colours, their names on the card
const TIERS = [
    { key: "normal",    label: "Common",    core: hex("#FFFFFF"), main: hex("#D2DAE6"), deep: hex("#4E586E") },
    { key: "uncommon",  label: "Uncommon",  core: hex("#ECFFEF"), main: hex("#5FE07A"), deep: hex("#145C28") },
    { key: "rare",      label: "Rare",      core: hex("#E6F1FF"), main: hex("#3D8BFF"), deep: hex("#0B2A7A") },
    { key: "epic",      label: "Epic",      core: hex("#F5E9FF"), main: hex("#B356FF"), deep: hex("#3A0A6E") },
    { key: "legendary", label: "Legendary", core: hex("#FFF7DA"), main: hex("#FFB21E"), deep: hex("#8A4600") },
    { key: "mythic",    label: "Mythic",    core: hex("#FFE4EA"), main: hex("#FF2D55"), deep: hex("#3D0012") },
]
const TIER_OF = { normal: 0, common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 }
// the rungs a tome of this rarity climbs on its way up
const climbFor = tier => tier === 1 ? [0, 1] : [0, 2, 3, 4, 5].filter(i => i <= tier)
// by rarity: pages that race over, runes a second, how long the card's held up
const PAGES = [4, 5, 7, 10, 13, 16]
const RUNES = [18, 26, 40, 60, 90, 130]
const HOLD_MS = [950, 1000, 1100, 1250, 1450, 1650]
// lightning over the tome as it climbs, and over you as it goes in
const ARCS = {
    3: { name: "tome.epic", core: hex("#FBF2FF"), glow: hex("#B356FF"), halo: hex("#9B3DFF"), spark: hex("#D9A8FF"), rim: hex("#B356FF") },
    4: { name: "tome.legendary", core: hex("#FFFBEA"), glow: hex("#FFB21E"), halo: hex("#FFC94D"), spark: hex("#FFE08A"), rim: hex("#FFB21E") },
    5: { name: "tome.mythic", core: hex("#FFF0F3"), glow: hex("#FF1744"), halo: hex("#D5002A"), spark: hex("#FF6F86"), rim: hex("#FF2D55") },
}
const CIRCLES = { normal: "apt_water", fire: "apt_fire", water: "apt_water", earth: "apt_earth", light: "apt_light", dark: "apt_darkness", lightning: "apt_lightning" }
const RANK_LABELS = { 0: "Basic Class", 1: "Elite Skill", 2: "High Skill", 3: "Legendary Class", 4: "God Tier" }

const APPEAR_MS = 750
const CHARGE_MS = 450
const STEP_MS = 430
const OPEN_MS = 300
const PAGE_MS = 190
const PAGE_GAP_MS = 55
const CARD_AFTER_MS = 520
const RISE_MS = 420
const WIND_MS = 150
const FLY_MS = 320
const CLOSE_AFTER_MS = 120
const CLOSE_MS = 220
const BURN_MS = 650
const READY_WAIT_MS = 1600
// the book's shape (book1.glb, open, its spine along z): how wide open, where
// its cover hinges (the spine's top), where the racing pages lie
const BOOK_WIDTH = 0.667
const HINGE_Y = 0.09
const PAGE_Y = 0.13
// shares of the screen's height: the open book's width, the card's height
const BOOK_SHARE = 0.32
const CARD_SHARE = 0.42

const queue = []
let running = false

function myPlayer(){
    const owner = getCharState()?.owner
    return owner ? getPlayersOnScene().find(player => player.owner === owner) : null
}
function canShowOn(player){
    const scene = player?.body?.getScene?.()
    return !!scene && !scene.isDisposed && !player.body.isDisposed() && !!scene.activeCamera
}
/** True when there's a body of yours in the world to show a tome to. */
export function canRevealSkillTome(){
    return canShowOn(myPlayer())
}
function play(name, rate = 1){
    const sound = getAllSounds()?.[name]
    if(!sound) return
    try {
        sound.setPlaybackRate?.(rate)
        sound.play()
    } catch(error){}
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const rand = (a, b) => a + Math.random() * (b - a)

/**
 * Shows a skill learned from a tome: skill (the character's own copy, after
 * it was given or levelled), rarity (the tome's), upgraded (one they knew -
 * it's gone up to `level`). onDone once it's over. False with no body of
 * yours to show it to - nothing shown.
 */
export function revealSkillTome({ skill, rarity = "normal", upgraded = false, level = 1, onDone = null }){
    if(!skill) return false
    const player = myPlayer()
    if(!canShowOn(player)) return false
    queue.push({ player, skill, rarity, upgraded, level, onDone })
    if(!running) next()
    return true
}
function next(){
    const job = queue.shift()
    if(!job){
        running = false
        return
    }
    running = true
    const finish = () => {
        try { job.onDone?.() } catch(error){ console.error("[tomeReveal] onDone", error) }
        next()
    }
    if(!canShowOn(job.player)) return finish()
    try {
        ceremony(job, finish)
    } catch(error){
        console.error("[tomeReveal]", error)
        finish()
    }
}

// ── shared with effects/tomeLoot.js (a tome lying in the world) ──────────────

/** book1.glb split at its spine: a Promise of { left, right, material } (hidden templates to clone), or null. */
export function tomeBookTemplate(scene){ return bookTemplate(scene) }
/** A rarity's colours ({ core, main, deep } Color3s) and its label. */
export function tomeTierOf(rarity){ return TIERS[TIER_OF[rarity] ?? 0] }
/** Where a rarity stands, 0 (common) .. 5 (mythic). */
export function tomeTierIndex(rarity){ return TIER_OF[rarity] ?? 0 }
/** A skill element's magic circle (images/circles), added on - shared per scene. */
export function tomeCircleMaterial(scene, element){ return circleMaterial(scene, CIRCLES[element] ?? CIRCLES.normal) }

// ── the book (book1.glb, split at its spine) ─────────────────────────────────

const books = new WeakMap()   // scene -> Promise<{ left, right, material } | null>
function bookTemplate(scene){
    let loading = books.get(scene)
    if(loading) return loading
    loading = LoadAssetContainerAsync("./models/indors/book1.glb", scene).then(container => {
        container.addAllToScene()
        const source = container.meshes.find(mesh => mesh.getTotalVertices() > 0)
        if(!source) return null
        source.setParent(null)
        source.bakeCurrentTransformIntoVertices()
        // or its bounds stay where the bake moved it from
        source.refreshBoundingInfo()
        // its own look, unlit - a book held up in light of its own reads the
        // same at noon and at night
        const material = new StandardMaterial("tome.book", scene)
        const tex = source.material?.diffuseTexture ?? null
        material.diffuseColor = Color3.Black()
        material.specularColor = Color3.Black()
        material.disableLighting = true
        material.emissiveTexture = tex
        material.emissiveColor = tex ? Color3.Black() : new Color3(0.4, 0.28, 0.16)
        material.backFaceCulling = false
        material.fogEnabled = false
        const [left, right] = splitAtSpine(scene, source)
        ;[left, right].forEach(half => {
            half.material = material
            half.isPickable = false
            half.isVisible = false
        })
        container.meshes.filter(mesh => !mesh.isDisposed()).forEach(mesh => mesh.dispose(false, false))
        container.transformNodes?.forEach(node => { if(!node.isDisposed()) node.dispose() })
        return { left, right, material }
    }).catch(error => {
        console.warn("[tomeReveal] book1.glb didn't load", error?.message ?? error)
        return null
    })
    books.set(scene, loading)
    return loading
}
// the book in two - every triangle to the side of the spine (x = 0) it's on
function splitAtSpine(scene, source){
    const positions = source.getVerticesData("position")
    const normals = source.getVerticesData("normal")
    const uvs = source.getVerticesData("uv")
    const indices = source.getIndices()
    const sides = [[], []]
    for(let t = 0; t < indices.length; t += 3){
        const x = (positions[indices[t] * 3] + positions[indices[t + 1] * 3] + positions[indices[t + 2] * 3]) / 3
        sides[x < 0 ? 0 : 1].push(indices[t], indices[t + 1], indices[t + 2])
    }
    return sides.map((triangles, side) => {
        const remap = new Map()
        const p = [], n = [], u = [], idx = []
        triangles.forEach(i => {
            if(!remap.has(i)){
                remap.set(i, remap.size)
                p.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
                if(normals) n.push(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2])
                if(uvs) u.push(uvs[i * 2], uvs[i * 2 + 1])
            }
            idx.push(remap.get(i))
        })
        const mesh = new Mesh(side ? "tome.right" : "tome.left", scene)
        const data = new VertexData()
        data.positions = p
        data.indices = idx
        if(n.length) data.normals = n
        if(u.length) data.uvs = u
        data.applyToMesh(mesh)
        return mesh
    })
}

// ── drawn: its cover, its pages, runes ───────────────────────────────────────

const drawnCache = new WeakMap()   // scene -> Map(key -> material | texture)
function cachedOf(scene){
    let cache = drawnCache.get(scene)
    if(!cache) drawnCache.set(scene, cache = new Map())
    return cache
}
const cssOf = (c, a = 1) => `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${a})`
function drawnMaterial(scene, key, width, height, draw, { added = false } = {}){
    const cache = cachedOf(scene)
    if(cache.has(key)) return cache.get(key)
    const tex = new DynamicTexture(`tome.${key}`, { width, height }, scene, true)
    const ctx = tex.getContext()
    ctx.clearRect(0, 0, width, height)
    draw(ctx, width, height)
    tex.hasAlpha = true
    tex.update()
    tex.wrapU = tex.wrapV = Texture.CLAMP_ADDRESSMODE
    const mat = new StandardMaterial(`tome.${key}`, scene)
    mat.disableLighting = true
    mat.diffuseColor = Color3.Black()
    mat.specularColor = Color3.Black()
    mat.backFaceCulling = false
    mat.fogEnabled = false
    if(added){
        mat.emissiveColor = Color3.White()
        mat.opacityTexture = tex
        mat.alphaMode = Constants.ALPHA_ADD
        mat.disableDepthWrite = true
    } else {
        mat.emissiveTexture = tex
        mat.opacityTexture = tex
    }
    cache.set(key, mat)
    return mat
}
// the cover: dark leather, a gold frame, a gem of its rarity glowing in the middle
const coverMaterial = (scene, tier) => drawnMaterial(scene, `cover.${tier.key}`, 256, 384, (ctx, w, h) => {
    const leather = ctx.createLinearGradient(0, 0, w, h)
    leather.addColorStop(0, "#3a2416")
    leather.addColorStop(0.5, "#24150c")
    leather.addColorStop(1, "#160c06")
    ctx.fillStyle = leather
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = "rgba(226, 182, 96, 0.95)"
    ctx.lineWidth = 6
    ctx.strokeRect(14, 14, w - 28, h - 28)
    ctx.lineWidth = 2
    ctx.strokeRect(26, 26, w - 52, h - 52)
    const cx = w / 2, cy = h / 2
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90)
    glow.addColorStop(0, cssOf(tier.core, 1))
    glow.addColorStop(0.25, cssOf(tier.main, 0.95))
    glow.addColorStop(1, cssOf(tier.main, 0))
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = cssOf(tier.main)
    ctx.strokeStyle = "rgba(255, 226, 150, 1)"
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(cx, cy - 46)
    ctx.lineTo(cx + 30, cy)
    ctx.lineTo(cx, cy + 46)
    ctx.lineTo(cx - 30, cy)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)"
    ctx.beginPath()
    ctx.ellipse(cx - 8, cy - 12, 5, 12, -0.4, 0, Math.PI * 2)
    ctx.fill()
    // corner pieces
    ctx.fillStyle = "rgba(226, 182, 96, 0.95)"
    ;[[14, 14, 1, 1], [w - 14, 14, -1, 1], [14, h - 14, 1, -1], [w - 14, h - 14, -1, -1]].forEach(([x, y, sx, sy]) => {
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + 40 * sx, y)
        ctx.lineTo(x, y + 40 * sy)
        ctx.closePath()
        ctx.fill()
    })
})
// a page racing over: parchment, lines of writing, a rune glowing in its rarity
const pageMaterial = (scene, tier) => drawnMaterial(scene, `page.${tier.key}`, 256, 384, (ctx, w, h) => {
    const paper = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, h * 0.7)
    paper.addColorStop(0, "#f3e4bd")
    paper.addColorStop(1, "#c9a96c")
    ctx.fillStyle = paper
    ctx.fillRect(0, 0, w, h)
    let seed = 17
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    ctx.strokeStyle = "rgba(70, 44, 20, 0.45)"
    ctx.lineWidth = 2
    for(let y = 34; y < h - 30; y += 16){
        if(y > h / 2 - 60 && y < h / 2 + 60) continue
        ctx.beginPath()
        let x = 24
        ctx.moveTo(x, y)
        const end = w - 24 - random() * 60
        while(x < end){
            x += 6 + random() * 8
            ctx.lineTo(x, y + (random() - 0.5) * 4)
        }
        ctx.stroke()
    }
    ctx.shadowColor = cssOf(tier.main)
    ctx.shadowBlur = 18
    ctx.strokeStyle = cssOf(tier.main)
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, 42, 0, Math.PI * 2)
    ctx.moveTo(w / 2, h / 2 - 54)
    ctx.lineTo(w / 2, h / 2 + 54)
    ctx.moveTo(w / 2 - 30, h / 2 - 20)
    ctx.lineTo(w / 2 + 30, h / 2 + 20)
    ctx.stroke()
})
// runes: four glyphs side by side, white (the particles colour them)
function runeTexture(scene){
    const cache = cachedOf(scene)
    if(cache.has("runes")) return cache.get("runes")
    const tex = new DynamicTexture("tome.runes", { width: 512, height: 128 }, scene, true)
    const ctx = tex.getContext()
    ctx.clearRect(0, 0, 512, 128)
    ctx.strokeStyle = "white"
    ctx.lineWidth = 9
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.shadowColor = "white"
    ctx.shadowBlur = 14
    const glyphs = [
        g => { g.moveTo(64, 20); g.lineTo(64, 108); g.moveTo(64, 50); g.lineTo(34, 24); g.moveTo(64, 50); g.lineTo(94, 24) },
        g => { g.moveTo(64, 18); g.lineTo(100, 64); g.lineTo(64, 110); g.lineTo(28, 64); g.closePath(); g.moveTo(64, 56); g.lineTo(64, 72) },
        g => { g.moveTo(30, 100); g.lineTo(64, 24); g.lineTo(98, 100); g.moveTo(44, 74); g.lineTo(84, 74) },
        g => { g.arc(64, 64, 34, 0, Math.PI * 2); g.moveTo(64, 18); g.lineTo(64, 110); g.moveTo(18, 64); g.lineTo(110, 64) },
    ]
    glyphs.forEach((glyph, i) => {
        ctx.save()
        ctx.translate(i * 128, 0)
        ctx.beginPath()
        glyph(ctx)
        ctx.stroke()
        ctx.restore()
    })
    tex.hasAlpha = true
    tex.update()
    cache.set("runes", tex)
    return tex
}
// the skill's own magic circle - glowing art on black, so added on
function circleMaterial(scene, image){
    const cache = cachedOf(scene)
    const key = `circle.${image}`
    if(cache.has(key)) return cache.get(key)
    const mat = new StandardMaterial(`tome.${key}`, scene)
    mat.disableLighting = true
    mat.diffuseColor = Color3.Black()
    mat.specularColor = Color3.Black()
    mat.emissiveTexture = new Texture(`./images/circles/${image}.webp`, scene)
    // blended - black adds nothing
    mat.alpha = 0.999
    mat.alphaMode = Constants.ALPHA_ADD
    mat.disableDepthWrite = true
    mat.backFaceCulling = false
    mat.fogEnabled = false
    cache.set(key, mat)
    return mat
}

// a crimson dark closing in round the edges of the screen - a mythic tome
function darkness(ms){
    if(typeof document === "undefined") return
    const veil = document.createElement("div")
    veil.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9997;" +
        "background:radial-gradient(ellipse at center, rgba(0,0,0,0) 30%, rgba(40,0,10,0.55) 70%, rgba(8,0,3,0.85) 100%)"
    document.body.appendChild(veil)
    veil.animate([{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: ms, easing: "ease-in-out" }).onfinish = () => veil.remove()
}

// ── the ceremony ─────────────────────────────────────────────────────────────

function ceremony({ player, skill, rarity, upgraded, level }, done){
    const scene = player.body.getScene()
    const tierIndex = TIER_OF[String(rarity).toLowerCase()] ?? 0
    const tier = TIERS[tierIndex]
    const climb = climbFor(tierIndex)
    const steps = climb.length - 1
    const element = skill.element ?? "normal"

    // when everything happens, ms from the start
    const T = {}
    T.appear = APPEAR_MS
    T.open = APPEAR_MS + CHARGE_MS + steps * STEP_MS
    T.card = T.open + CARD_AFTER_MS
    T.absorb = T.card + RISE_MS + HOLD_MS[tierIndex]
    T.impact = T.absorb + WIND_MS + FLY_MS
    T.close = T.absorb + CLOSE_AFTER_MS
    T.burn = T.close + CLOSE_MS + 80
    T.end = T.impact + (tierIndex >= 4 ? 2600 : 1600)

    const view = {
        cam: new Vector3(), forward: new Vector3(), right: new Vector3(), up: new Vector3(),
        tanHalf: 0.4, aspect: 1.6, dist: 10, halfH: 1,
        chest: new Vector3(), feet: new Vector3(), head: new Vector3(),
        book: new Vector3(), card: new Vector3(), bookWidth: 0.5, cardH: 1,
    }
    const chest = () => view.chest
    const feet = () => view.feet
    function measure(){
        const cam = scene.activeCamera
        view.cam.copyFrom(cam.globalPosition)
        cam.getDirectionToRef(Axis.Z, view.forward)
        cam.getDirectionToRef(Axis.X, view.right)
        cam.getDirectionToRef(Axis.Y, view.up)
        const aspect = scene.getEngine().getAspectRatio(cam) || 1.6
        const tan = Math.tan((cam.fov || 0.8) / 2)
        view.tanHalf = cam.fovMode === Camera.FOVMODE_HORIZONTAL_FIXED ? tan / aspect : tan
        view.aspect = aspect
        view.chest.copyFrom(chestOf(player))
        view.feet.copyFrom(feetOf(player))
        view.head.copyFrom(headOf(player))
        view.dist = Vector3.Distance(view.cam, view.chest)
        // beside them on the screen, just this side of them: the book low,
        // the card above it
        const d = Math.max(1.6, view.dist - 1)
        const halfH = d * view.tanHalf
        const halfW = halfH * aspect
        view.halfH = halfH
        view.bookWidth = BOOK_SHARE * 2 * halfH
        view.cardH = CARD_SHARE * 2 * halfH
        const wide = Math.max(view.bookWidth, view.cardH * CARD_ASPECT)
        const x = Math.min(halfW * 0.95 - wide / 2, halfH * 0.22 + wide / 2)
        const place = (out, y) => {
            out.copyFrom(view.cam)
            view.forward.scaleAndAddToRef(d, out)
            view.right.scaleAndAddToRef(x, out)
            view.up.scaleAndAddToRef(y, out)
        }
        place(view.book, -0.34 * halfH)
        place(view.card, 0.22 * halfH)
    }
    measure()

    // ── its pieces ──
    const root = new TransformNode("tome.root", scene)
    root.rotationQuaternion = new Quaternion()
    const hinge = new TransformNode("tome.hinge", scene)
    hinge.parent = root
    hinge.position.y = HINGE_Y
    const pages = []
    let left = null, right = null, cover = null
    const aura = lightPlane(scene, "dot", tier.main, { name: "tome.aura" })
    aura.isVisible = false
    const circle = MeshBuilder.CreatePlane("tome.circle", { size: 1 }, scene)
    circle.isPickable = false
    circle.billboardMode = Mesh.BILLBOARDMODE_ALL
    circle.material = circleMaterial(scene, skill.magicCircleImg || CIRCLES[element] || CIRCLES.normal)
    circle.isVisible = false
    const halo = tierIndex >= 4 ? MeshBuilder.CreatePlane("tome.halo", { size: 1 }, scene) : null
    if(halo){
        halo.isPickable = false
        halo.billboardMode = Mesh.BILLBOARDMODE_ALL
        halo.material = circleMaterial(scene, "divine1")
        halo.isVisible = false
    }
    let card = null
    let cardMat = null
    let ended = false

    const ready = Promise.all([
        bookTemplate(scene).then(template => {
            if(!template || ended) return
            left = template.left.clone("tome.left", hinge)
            left.position.y = -HINGE_Y
            right = template.right.clone("tome.right", root)
            ;[left, right].forEach(half => {
                half.isVisible = false
                half._glowColor = TIERS[0].main
                addGlow(scene, half, 0.4)
            })
            // its cover, on the outside of the half that swings
            cover = MeshBuilder.CreateGround("tome.cover", { width: BOOK_WIDTH / 2 - 0.02, height: 0.47 }, scene)
            cover.isPickable = false
            cover.parent = hinge
            cover.rotation.z = Math.PI
            cover.position.set(-(BOOK_WIDTH / 4), -HINGE_Y - 0.004, 0)
            cover.material = coverMaterial(scene, tier)
            cover.isVisible = false
        }),
        createSkillCard(scene, skill, tier, { rankLabel: RANK_LABELS[skill.skillrank] ?? "", upgraded, level }).then(({ mesh, loaded }) => {
            if(ended) return mesh.dispose()
            card = mesh
            cardMat = mesh.material
            mesh.isVisible = false
            mesh.renderingGroupId = 1
            return loaded
        }),
        prewarmBlessingMotifs(scene, []),
    ])
    // the pages racing over, hinged at the spine, on the right to start
    const pageMat = pageMaterial(scene, tier)
    for(let i = 0; i < PAGES[tierIndex]; i++){
        const pivot = new TransformNode("tome.pagePivot", scene)
        pivot.parent = root
        pivot.position.y = PAGE_Y + i * 0.003
        const page = MeshBuilder.CreateGround("tome.page", { width: BOOK_WIDTH / 2 - 0.05, height: 0.42 }, scene)
        page.isPickable = false
        page.parent = pivot
        page.position.x = BOOK_WIDTH / 4
        page.material = pageMat
        page.isVisible = false
        pages.push({ pivot, page })
    }

    let start = 0
    let last = performance.now()
    const fired = new Set()
    const once = (key, at, t, fn) => {
        if(t < at || fired.has(key)) return
        fired.add(key)
        try { fn() } catch(error){ console.error(`[tomeReveal] ${key}`, error) }
    }
    // what's running that has to be stopped
    let pull = null
    let arcs = null
    let runes = null
    let chestPull = null
    let chestSparks = null
    let motesOff = null
    let trail = null
    let comet = null
    let climbColor = TIERS[0].main.clone()
    let climbTo = TIERS[0].main
    let climbAt = 0
    let stepFlash = 0
    let shake = 0
    let cardBase = new Vector3()
    let cardHeight = 0.05
    let flyFrom = null
    let cardWhite = 0

    Promise.race([ready, wait(READY_WAIT_MS)]).then(() => {
        if(ended) return
        if(scene.isDisposed || player.body.isDisposed()) return finish()
        measure()
        start = performance.now()
        root.position.copyFrom(view.book)
        ;[left, right, cover].forEach(mesh => { if(mesh) mesh.isVisible = true })
        aura.isVisible = true
        play("tomeAppearS")
        popShockRing(scene, view.feet.clone(), { size: 3, seconds: 0.6, color: TIERS[0].main })
        pull = inflow(scene, () => root.position, { core: TIERS[0].core, main: TIERS[0].main }, { reach: 1.4, rate: [10, 120], life: 0.3 })
    })

    // ── the climb: a rung up to the next rarity ──
    function rung(i){
        const to = TIERS[climb[i]]
        climbAt = performance.now()
        climbTo = to.main
        stepFlash = 1
        play("tomeStepS", Math.pow(2, (i - 1) * 3 / 12))
        const at = root.position.clone()
        popPlane(scene, "ring", to.main, () => root.position, { from: 0.2, to: view.bookWidth * 2.6, ms: 420, group: 1 })
        sparkBurst(scene, at, to.main, { count: 18 + i * 8, power: 3 + i, size: [0.04, 0.1], life: [0.25, 0.5] })
        addCameraTrauma(scene, 0.06 + 0.05 * i)
        // the pull in the new colour, harder
        pull?.stop()
        pull = inflow(scene, () => root.position, { core: to.core, main: to.main }, { reach: 1.5 + 0.2 * i, rate: [60 + i * 40, 200 + i * 90], life: 0.3 })
        // lightning crawling over it, an epic tome and up
        if(climb[i] >= 3){
            arcs?.dispose()
            const radius = view.bookWidth * 0.55
            arcs = crackle(scene, () => {
                const middle = root.position
                return [pointOnSphere(middle, radius), pointOnSphere(middle, radius)]
            }, ARCS[climb[i]], { count: 2 + i, interval: 60, width: 0.006 + 0.002 * i })
        }
    }

    // ── it opens ──
    function burst(){
        stepFlash = 1.4
        play("tomeOpenS")
        pull?.stop()
        pull = null
        arcs?.dispose()
        arcs = null
        const at = root.position.clone()
        popPlane(scene, "dot", tier.core, () => root.position, { from: 0.3, to: view.bookWidth * 2.2, ms: 220, alpha: 0.8, group: 1 })
        popPlane(scene, "star", tier.core, () => root.position, { from: 0.3, to: view.bookWidth * 2.4, ms: 380, spin: 0.8, group: 1 })
        sparkBurst(scene, at, tier.main, { count: 30 + tierIndex * 14, power: 4 + tierIndex, size: [0.05, 0.13], life: [0.3, 0.7] })
        shockRipple(scene, at, { radius: 2 + tierIndex * 0.6, ms: 420, strength: 0.4 + 0.1 * tierIndex, thickness: 0.7, chroma: 0.6, rim: 0.3, tint: tier.main })
        addCameraTrauma(scene, 0.12 + 0.06 * tierIndex)
        punchCameraFov(scene, 0.02 + 0.008 * tierIndex)
        // a plume of light up off the pages
        lightPillar(scene, () => root.position, tier.main, { height: 2.5 + tierIndex * 0.8, radius: view.bookWidth * 0.16, ms: 1100 + tierIndex * 150, mode: "up", alpha: 0.5 })
        // a legendary tome: struck by light from the sky
        if(tierIndex >= 4) lightPillar(scene, () => root.position, tier.main, { height: 12, radius: view.bookWidth * 0.35, ms: 1000, mode: "down", alpha: 0.85 })
        if(tierIndex >= 5) darkness(2600)
        // runes streaming up off the open pages
        const from = root.position.clone()
        runes = fireParticles(scene, "tome.runes", Math.ceil(RUNES[tierIndex] * 1.6) + 10, runeTexture(scene), from)
        runes.isAnimationSheetEnabled = true
        runes.spriteCellWidth = 128
        runes.spriteCellHeight = 128
        runes.startSpriteCellID = 0
        runes.endSpriteCellID = 3
        runes.spriteRandomStartCell = true
        runes.spriteCellChangeSpeed = 0
        runes.startPositionFunction = (matrix, position) => {
            const w = view.bookWidth * 0.4
            position.copyFrom(root.position)
            view.right.scaleAndAddToRef(rand(-w, w), position)
            view.up.scaleAndAddToRef(rand(-w * 0.3, w * 0.3), position)
        }
        runes.startDirectionFunction = (matrix, direction) => direction.set(rand(-0.3, 0.3), 1, rand(-0.3, 0.3))
        runes.minEmitPower = 0.5
        runes.maxEmitPower = 1.2
        runes.minLifeTime = 0.9
        runes.maxLifeTime = 1.5
        runes.minInitialRotation = -0.5
        runes.maxInitialRotation = 0.5
        runes.minAngularSpeed = -1.5
        runes.maxAngularSpeed = 1.5
        const s = view.bookWidth * 0.18
        runes.addSizeGradient(0, s * 0.5, s)
        runes.addSizeGradient(0.2, s, s * 1.3)
        runes.addSizeGradient(1, s * 0.3, s * 0.5)
        runes.addColorGradient(0, c4(tier.core, 0))
        runes.addColorGradient(0.15, c4(tier.core, 1))
        runes.addColorGradient(0.5, c4(tier.main, 0.9))
        runes.addColorGradient(1, c4(tier.deep, 0))
        runes.renderingGroupId = 1
        runes.emitRate = RUNES[tierIndex]
        runes.start()
        later(scene, 1500 + tierIndex * 150, () => runes?.stop())
    }

    // ── the card leaves the book: drawn into them ──
    function absorbStart(){
        chestPull = inflow(scene, chest, { core: tier.core, main: tier.main }, { reach: 2.2, rate: [80, 380] })
        chestSparks = gather(scene, chest, { core: tier.core, main: tier.main }, { radius: 1.1, rate: 140 })
        if(!card) return
        // the card coming apart into motes streaming into their chest
        const life = 0.42
        motesOff = fireParticles(scene, "tome.cardMotes", 220, "flare", cardBase)
        motesOff.renderingGroupId = 1
        motesOff.startPositionFunction = (matrix, position) => {
            position.copyFrom(card.position)
            view.right.scaleAndAddToRef(rand(-1, 1) * cardHeight * CARD_ASPECT * 0.5, position)
            view.up.scaleAndAddToRef(rand(-1, 1) * cardHeight * 0.5, position)
        }
        motesOff.startDirectionFunction = (matrix, direction, particle) => direction.set(view.chest.x - particle.position.x, view.chest.y - particle.position.y, view.chest.z - particle.position.z).scaleInPlace(1 / life)
        motesOff.minEmitPower = motesOff.maxEmitPower = 1
        motesOff.minLifeTime = motesOff.maxLifeTime = life
        const size = Math.max(0.03, view.cardH * 0.045)
        motesOff.addSizeGradient(0, size * 0.6, size)
        motesOff.addSizeGradient(1, size * 0.15, size * 0.3)
        motesOff.addColorGradient(0, c4(Color3.White(), 1))
        motesOff.addColorGradient(0.35, c4(tier.core, 1))
        motesOff.addColorGradient(1, c4(tier.main, 0))
        motesOff.emitRate = 140
        motesOff.start()
    }
    function flyStart(){
        play("blessDrawS")
        flyFrom = cardBase.clone()
        const prev = cardBase.clone()
        const now = cardBase.clone()
        trail = fireParticles(scene, "tome.trail", 200, "flare", now)
        trail.renderingGroupId = 1
        trail.startPositionFunction = (matrix, position) => Vector3.LerpToRef(prev, now, Math.random(), position)
        trail.startDirectionFunction = (matrix, direction) => direction.set(rand(-0.2, 0.2), rand(-0.2, 0.2), rand(-0.2, 0.2))
        trail.minEmitPower = trail.maxEmitPower = 1
        trail.minLifeTime = 0.22
        trail.maxLifeTime = 0.38
        const size = view.cardH * 0.09
        trail.addSizeGradient(0, size * 0.7, size)
        trail.addSizeGradient(1, 0, size * 0.1)
        trail.addColorGradient(0, c4(tier.core, 1))
        trail.addColorGradient(0.4, c4(tier.main, 0.85))
        trail.addColorGradient(1, c4(tier.deep, 0))
        trail.emitRate = 420
        trail.start()
        const head = lightPlane(scene, "dot", tier.core, { group: 1, name: "tome.comet" })
        const glow = lightPlane(scene, "dot", tier.main, { group: 1, name: "tome.comet.halo" })
        comet = {
            step(k){
                prev.copyFrom(now)
                now.copyFrom(cardBase)
                head.position.copyFrom(cardBase)
                glow.position.copyFrom(cardBase)
                head.scaling.setAll(view.cardH * (0.12 + 0.45 * k))
                glow.scaling.setAll(view.cardH * (0.3 + 0.9 * k))
            },
            stop(){
                trail?.stop()
                head.dispose()
                glow.dispose()
            },
        }
    }

    // ── it's theirs: the impact, as big as the rarity ──
    function impact(){
        chestPull?.stop()
        chestSparks?.stop()
        motesOff?.stop()
        comet?.stop()
        chestPull = chestSparks = motesOff = comet = null
        if(card && !card.isDisposed()) card.dispose()
        card = null
        const at = view.chest.clone()
        const foot = view.feet.clone()
        tintBody(player, tier.main, { peak: 0.75, ms: 520 + tierIndex * 60, whiteFor: 70 })
        sparkBurst(scene, at, tier.main, { count: 30 + tierIndex * 12, power: 5 + tierIndex, size: [0.06, 0.15], life: [0.3, 0.7] })
        sparkBurst(scene, at, tier.core, { count: 14, power: 8.5, size: [0.03, 0.07], life: [0.12, 0.3] })
        popShockRing(scene, foot, { size: 3.4 + tierIndex * 0.7, seconds: 0.5, color: tier.main })
        popPlane(scene, "ring", tier.main, chest, { from: 0.3, to: 2.4 + tierIndex * 0.3, ms: 340 })
        popPlane(scene, "dot", tier.core, chest, { from: 0.4, to: 1.9, ms: 240, alpha: 0.95 })
        shockRipple(scene, at, { radius: 2.8 + tierIndex * 0.6, ms: 450, strength: 0.4 + 0.08 * tierIndex, thickness: 0.8, chroma: 0.7, rim: 0.3, tint: tier.main })
        addCameraTrauma(scene, 0.2 + 0.06 * tierIndex)
        punchCameraFov(scene, 0.03 + 0.006 * tierIndex)
        fireAura(scene, feet, { main: tier.main }, { radius: 0.55, ms: 600 + tierIndex * 120, rate: 90 + tierIndex * 30 })
        motes(scene, feet, { core: tier.core, main: tier.main, deep: tier.deep }, { ms: 1100 + tierIndex * 200, rate: 26 + tierIndex * 10 })
        play(tierIndex >= 4 ? "blessFinaleS" : "blessAbsorbS")
        // a rare tome and up: a shell of its light closing round them
        if(tierIndex >= 2) shell(scene, chest, tier.main, { radius: 1.1 + tierIndex * 0.08, ms: 800 })
        // epic and up: lightning crawling over them
        if(tierIndex >= 3){
            const crawl = crackle(scene, () => {
                const middle = player.body.position
                return [pointOnSphere(middle, 0.55), pointOnSphere(middle, 0.75)]
            }, ARCS[Math.min(5, tierIndex)], { count: 2 + tierIndex, interval: 55, width: 0.012 })
            later(scene, 500 + tierIndex * 120, () => crawl.dispose())
        }
        // legendary and up: light from the sky onto them, the world flashing
        if(tierIndex >= 4){
            lightPillar(scene, feet, tier.main, { height: 13, radius: 0.6, ms: 1300, mode: "down", alpha: 0.85 })
            popPlane(scene, "rays", tier.main, () => view.chest.add(view.forward.scale(0.7)), { group: 0, from: 1, to: 6, ms: 1500, spin: 0.7, alpha: 0.9, fade: k => k < 0.12 ? k / 0.12 : Math.pow(1 - (k - 0.12) / 0.88, 1.3) })
            screenFlash({ core: Color3.White(), glow: tier.main })
            popShockRing(scene, foot, { size: 8, seconds: 0.8, color: tier.main })
        }
        // mythic: the heart of it beating through them, crimson rings after it
        if(tierIndex >= 5){
            ;[260, 520, 780].forEach((delay, i) => later(scene, delay, () => {
                tintBody(player, tier.main, { peak: 0.6 - i * 0.12, ms: 240 })
                popShockRing(scene, view.feet.clone(), { size: 5 + i * 1.5, seconds: 0.55, color: tier.main })
                addCameraTrauma(scene, 0.18)
            }))
        }
        say()
    }
    // the words over their head
    async function say(){
        const colors = [cssOf(tier.core), cssOf(Color3.Lerp(tier.main, tier.core, 0.35)), cssOf(tier.main)]
        const gold = ["#fffaf0", "#f6d488", "#c08a2e"]
        // (an en space between parts - the GUI trims a plain trailing one)
        const gap = " "
        const parts = upgraded
            ? [{ text: `${skill.displayName ?? skill.name}${gap}`, colors: gold }, { text: `LV. ${level}`, colors }]
            : tierIndex >= 4
                ? [{ text: `${tier.label.toUpperCase()}${gap}`, colors }, { text: "SKILL!", colors: gold }]
                : [{ text: tierIndex >= 2 ? `${tier.label.toUpperCase()} SKILL${gap}` : `SKILL${gap}`, colors }, { text: "LEARNED", colors: gold }]
        let mesh
        try {
            mesh = await createRewardText(scene, parts, { glow: cssOf(tier.main, 0.95) })
        } catch(error){
            return console.error("[tomeReveal] words", error)
        }
        if(scene.isDisposed) return mesh.dispose()
        mesh.renderingGroupId = 1
        const head = view.head.clone()
        const planeHeight = 4 * 200 / 1024
        animate(scene, 1900 + tierIndex * 150, k => {
            if(!ended) head.copyFrom(view.head)
            const pop = k < 0.07 ? 1.15 * easeOutBack(k / 0.07) : k < 0.14 ? 1.15 - 0.15 * (k - 0.07) / 0.07 : 1
            const at = head.add(new Vector3(0, 0.6 + 0.35 * easeOutCubic(k), 0))
            const tall = (0.11 + 0.01 * tierIndex) * 2 * Math.max(1.5, Vector3.Distance(view.cam, at)) * view.tanHalf
            mesh.position.copyFrom(at)
            mesh.scaling.setAll(Math.max(0.01, pop * tall / planeHeight))
            mesh.visibility = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1
        }, { onEnd: () => mesh.dispose() })
    }

    // ── the tome, spent: shut, and burnt away ──
    function slam(){
        play("tomeCloseS")
        addCameraTrauma(scene, 0.1)
    }
    function burn(){
        const at = root.position.clone()
        sparkBurst(scene, at, tier.main, { count: 26 + tierIndex * 6, power: 3.5, size: [0.04, 0.1], life: [0.4, 0.8] })
        if(tierIndex >= 2) {
            const flames = fireParticles(scene, "tome.burn", 90, "flame2", at)
            flames.startPositionFunction = (matrix, position) => {
                position.copyFrom(root.position)
                view.right.scaleAndAddToRef(rand(-0.5, 0.5) * view.bookWidth * 0.5, position)
            }
            flames.startDirectionFunction = (matrix, direction) => direction.set(rand(-0.2, 0.2), 1, rand(-0.2, 0.2))
            flames.minEmitPower = 0.4
            flames.maxEmitPower = 1
            flames.minLifeTime = 0.3
            flames.maxLifeTime = 0.55
            flames.addSizeGradient(0, view.bookWidth * 0.2, view.bookWidth * 0.3)
            flames.addSizeGradient(1, view.bookWidth * 0.05, view.bookWidth * 0.1)
            flames.addColorGradient(0, c4(tier.core, 1))
            flames.addColorGradient(0.4, c4(tier.main, 0.8))
            flames.addColorGradient(1, c4(tier.deep, 0))
            flames.emitRate = 160
            flames.renderingGroupId = 1
            flames.start()
            later(scene, BURN_MS * 0.8, () => flames.stop())
        } else smokePuff(scene, at, { count: 10, size: 0.8 })
    }

    // ── every frame ──
    const observer = scene.onBeforeRenderObservable.add(() => {
        try {
            frame()
        } catch(error){
            console.error("[tomeReveal]", error)
            finish()
        }
    })
    const sceneGone = scene.onDisposeObservable.add(() => finish())
    const bodyGone = player.body.onDisposeObservable.add(() => finish())

    const basis = { x: new Vector3(), y: new Vector3(), z: new Vector3() }
    function frame(){
        if(player.body.isDisposed() || !scene.activeCamera) return finish()
        const now = performance.now()
        const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
        last = now
        measure()
        if(!start) return
        const t = now - start

        // what happens when
        for(let i = 1; i <= steps; i++) once(`rung${i}`, APPEAR_MS + CHARGE_MS * 0.6 + (i - 1) * STEP_MS, t, () => rung(i))
        once("open", T.open, t, burst)
        once("card", T.card, t, () => {
            play("blessRevealS", Math.pow(2, Math.min(tierIndex, 5) * 2 / 12))
            cardBase.copyFrom(root.position)
        })
        once("absorb", T.absorb, t, absorbStart)
        once("fly", T.absorb + WIND_MS, t, flyStart)
        once("close", T.close, t, slam)
        once("burn", T.burn, t, burn)
        once("impact", T.impact, t, impact)
        if(t >= T.end) return finish()

        // ── the book ──
        // where it is: risen up into place, then held there, shaking as it climbs
        const appear = Math.min(1, t / APPEAR_MS)
        const charging = t >= APPEAR_MS && t < T.open
        shake = charging ? 0.004 + 0.006 * Math.min(steps, (t - APPEAR_MS) / STEP_MS) : Math.max(0, shake - dt * 0.05)
        const target = view.book.clone()
        view.up.scaleAndAddToRef(-(1 - easeOutCubic(appear)) * view.halfH * 0.9, target)
        view.up.scaleAndAddToRef(Math.sin(now / 520) * view.halfH * 0.015, target)
        // the cover's swing: shut till it opens, open, then slammed shut
        const opening = Math.min(1, Math.max(0, (t - T.open) / OPEN_MS))
        const closing = Math.min(1, Math.max(0, (t - T.close) / CLOSE_MS))
        const open = closing > 0 ? 1 - easeInCubic(closing) : easeOutBack(opening)
        hinge.rotation.z = -Math.PI * (1 - Math.min(1.08, open))
        // shut, it's only its right half wide - kept in the middle of its spot
        const scale = view.bookWidth / BOOK_WIDTH
        view.right.scaleAndAddToRef(-BOOK_WIDTH / 4 * scale * (1 - Math.min(1, open)), target)
        if(shake) {
            view.right.scaleAndAddToRef(rand(-1, 1) * shake * scale * 4, target)
            view.up.scaleAndAddToRef(rand(-1, 1) * shake * scale * 4, target)
        }
        root.position.copyFrom(target)
        // burnt away at the end
        const burnt = Math.min(1, Math.max(0, (t - T.burn) / BURN_MS))
        const grow = Math.max(0.001, easeOutBack(appear) * (1 - easeInQuad(burnt)))
        root.scaling.setAll(scale * grow)
        // facing the camera, leaning back a little, turning into place as it comes
        basis.x.copyFrom(view.right)
        basis.y.copyFrom(view.forward).scaleInPlace(-1)
        view.up.scaleAndAddToRef(0.35, basis.y)
        basis.y.normalize()
        Vector3.CrossToRef(basis.x, basis.y, basis.z)
        Quaternion.RotationQuaternionFromAxisToRef(basis.x, basis.y, basis.z, root.rotationQuaternion)
        const turn = (1 - easeOutCubic(appear)) * Math.PI * 3 + burnt * Math.PI * 1.5
        if(turn) root.rotationQuaternion.multiplyInPlace(Quaternion.RotationAxis(Axis.Z, turn))

        // its glow - leaking round it shut, stepping up the colours, flashing each rung
        if(climbAt){
            const k = Math.min(1, (now - climbAt) / 220)
            Color3.LerpToRef(climbColor, climbTo, k, climbColor)
        }
        stepFlash = Math.max(0, stepFlash - dt * 2.2)
        const glowNow = t >= T.open ? tier.main : climbColor
        // (the glow layer draws over everything - much more and the book's own
        // art is lost in its colour)
        const bright = (t >= T.open ? 0.12 : 0.18 + 0.03 * Math.min(tierIndex, 5)) * (1 + 0.3 * Math.sin(now / 90) * (charging ? 1 : 0.3)) + stepFlash * 0.6
        ;[left, right].forEach(half => {
            if(!half) return
            half._glowColor = glowNow
            half._glowBrightness = bright * (1 - burnt)
        })
        // the light behind it in the rung it's on (a shared light material per colour)
        aura.material = lightMaterial(scene, "dot", t >= T.open ? tier.main : climbTo)
        aura.position.copyFrom(root.position)
        view.forward.scaleAndAddToRef(0.15 * scale, aura.position)
        aura.scaling.setAll(view.bookWidth * (1.3 + 0.4 * stepFlash + (t >= T.open ? 0.5 : 0)) * (1 - burnt))
        aura.visibility = (0.45 + 0.25 * Math.sin(now / 130)) * (1 - burnt)

        // the pages racing over once it's open
        pages.forEach(({ pivot, page }, i) => {
            const from = T.open + 120 + i * PAGE_GAP_MS
            const k = Math.min(1, Math.max(0, (now - start - from) / PAGE_MS))
            page.isVisible = k > 0 && k < 1 && closing === 0
            pivot.rotation.z = Math.PI * easeInQuad(k)
        })

        // the circle turning behind it, once it's open
        const shown = Math.min(1, Math.max(0, (t - T.open) / 350)) * (1 - burnt)
        circle.isVisible = shown > 0.01
        circle.position.copyFrom(root.position)
        view.forward.scaleAndAddToRef(0.35 * scale, circle.position)
        circle.scaling.setAll(view.bookWidth * (1.55 + 0.15 * Math.sin(now / 400)) * easeOutBack(shown))
        circle.rotation.z = now / 1600
        circle.visibility = shown * 0.9
        if(halo){
            halo.isVisible = shown > 0.01
            halo.position.copyFrom(circle.position)
            view.forward.scaleAndAddToRef(0.05, halo.position)
            halo.scaling.setAll(view.bookWidth * 2.2 * easeOutBack(shown))
            halo.rotation.z = -now / 2300
            halo.visibility = shown * 0.6
        }

        // ── the card ──
        if(card && t >= T.card){
            card.isVisible = true
            const since = t - T.card
            if(t < T.absorb){
                // up out of the pages, then held up to be read
                const k = Math.min(1, since / RISE_MS)
                if(k < 1){
                    Vector3.LerpToRef(root.position, view.card, easeOutCubic(k), cardBase)
                    cardHeight = Math.max(0.02, view.cardH * easeOutBack(k))
                } else {
                    Vector3.LerpToRef(cardBase, view.card, 1 - Math.exp(-dt * 12), cardBase)
                    cardHeight += (view.cardH - cardHeight) * (1 - Math.exp(-dt * 10))
                }
                cardWhite = Math.max(0, 0.6 * (1 - since / 300))
                card.rotation.z = 0.04 * Math.sin(now / 420)
                card.position.copyFrom(cardBase)
                view.up.scaleAndAddToRef(Math.sin(now / 300) * cardHeight * 0.012, card.position)
            } else if(t < T.absorb + WIND_MS){
                // the pull takes it: shivering, whitening
                const w = (t - T.absorb) / WIND_MS
                cardWhite = 0.3 * w
                chestPull?.step(0.6 * w)
                chestSparks?.step()
                card.position.copyFrom(cardBase)
                const jitter = cardHeight * 0.014 * w
                view.right.scaleAndAddToRef(rand(-1, 1) * jitter, card.position)
                view.up.scaleAndAddToRef(rand(-1, 1) * jitter, card.position)
            } else if(flyFrom){
                // swooping into their chest, spinning, shrinking
                const f = Math.min(1, (t - T.absorb - WIND_MS) / FLY_MS)
                const e = easeInCubic(f)
                const to = view.chest
                const lift = view.cardH * 0.35
                const cx = flyFrom.x + (to.x - flyFrom.x) * 0.2 + view.up.x * lift
                const cy = flyFrom.y + (to.y - flyFrom.y) * 0.2 + view.up.y * lift
                const cz = flyFrom.z + (to.z - flyFrom.z) * 0.2 + view.up.z * lift
                const a = (1 - e) * (1 - e), b = 2 * (1 - e) * e, d = e * e
                cardBase.set(a * flyFrom.x + b * cx + d * to.x, a * flyFrom.y + b * cy + d * to.y, a * flyFrom.z + b * cz + d * to.z)
                cardHeight = view.cardH * (1 - 0.94 * easeInQuad(f))
                card.rotation.z = -Math.PI * 2.5 * e
                cardWhite = 0.3 + 0.9 * f
                card.visibility = f < 0.62 ? 1 : 1 - (f - 0.62) / 0.38
                card.position.copyFrom(cardBase)
                chestPull?.step(0.6 + 0.4 * f)
                chestSparks?.step()
                comet?.step(f)
            }
            const s = cardHeight / CARD_PLANE_HEIGHT
            card.scaling.set(s, s, s)
            tier.core.scaleToRef(cardWhite, cardMat.emissiveColor)
        }
    }
    function finish(){
        if(ended) return
        ended = true
        if(!scene.isDisposed){
            scene.onBeforeRenderObservable.remove(observer)
            scene.onDisposeObservable.remove(sceneGone)
        }
        if(!player.body.isDisposed()) player.body.onDisposeObservable.remove(bodyGone)
        pull?.stop()
        arcs?.dispose()
        runes?.stop()
        chestPull?.stop()
        chestSparks?.stop()
        motesOff?.stop()
        comet?.stop()
        if(card && !card.isDisposed()) card.dispose()
        ;[aura, circle, halo].forEach(mesh => { if(mesh && !mesh.isDisposed()) mesh.dispose() })
        if(!root.isDisposed()) root.dispose()
        done()
    }
}
