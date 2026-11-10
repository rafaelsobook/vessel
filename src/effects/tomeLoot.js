import { Color3, Color4, Mesh, MeshBuilder, ParticleSystem, TransformNode, Vector3 } from "@babylonjs/core"
import { getPlayersOnScene } from "../sockets/worldsocket.js"
import { getCharState } from "../charactersystem/characterstate.js"
import { onIntersecEnterTrig, onIntersecExitTrig } from "../components/actionManager.js"
import { openCloseInteractBtn } from "../tools/popupUI.js"
import { obtain } from "../charactersystem/inventory.js"
import { emitRemoveTreasure } from "../sockets/emits.js"
import { startTimedPickup } from "../components/timedPickup.js"
import { makeSkillBook } from "../staticRecources/skillBooks.js"
import { SKILLS_BY_NAME } from "../staticRecources/skillsData.js"
import { getAllSounds } from "../components/soundSystem.js"
import { getParticleTexture, particleTexturePath } from "../tools/particlesystem.js"
import { lightMaterial, lightPlane, popPlane } from "./blessingMotifs.js"
import { sparkBurst } from "./blessingFx.js"
import { tomeBookTemplate, tomeCircleMaterial, tomeTierIndex, tomeTierOf } from "./tomeReveal.js"

// A SKILL TOME LYING IN THE WORLD - the one at the end of each grotto's maze
// (tcp's hiddenHoards.ts: a chest record with look "tome", so it rides the
// chests' own claim / removeTreasure / respawn flow). Drawn as the tome
// ceremony's own book (book1.glb, effects/tomeReveal.js) floating open over
// its skill's magic circle, in an aura of its rarity's colour - the rarer,
// the taller its column of light and the more it gives off:
//   every one     the book turning and bobbing, a halo behind it, its skill's
//                 element circle and a ring of its colour on the floor, a
//                 column of light, motes rising
//   epic and up   glints flashing round it
//   legendary up  a sunburst behind it
//   mythic        a second ring, the light pulsing like a heartbeat
// Taking it is a TEN-SECOND bar (components/timedPickup.js) - the server holds
// it for you meanwhile - and the aura swells as it fills. Then it's in your
// bag as a skill book, to learn from with the "learn" button.
//
// Light only, no glow layer: the game's GlowLayer draws over everything, and
// a glowing tome would shine through the maze's walls (the struck weapons
// keep to plain metal for the same reason - hiddenHoards.ts's glows()).
// Nothing animates or emits while you're further than AWAKE_RANGE off.

const PICKUP_SECONDS = 10
const PICKUP_RADIUS = 2.6
const HOVER = 1.1           // the book over the floor
const BOOK_SCALE = 1.55     // book1.glb is 0.67 wide open
const BOOK_TILT = 0.6       // its pages tipped up toward whoever looks at it
const SWAY = 0.3            // how far it turns either way from facing them
const AWAKE_RANGE = 60
const AWAKE_CHECK_MS = 500
// by rarity (tomeReveal.js's ladder: 0 common .. 5 mythic)
const PILLAR_HEIGHT = [1.6, 1.9, 2.4, 3.2, 4.4, 5.6]
const PILLAR_ALPHA  = [0.22, 0.24, 0.28, 0.32, 0.36, 0.4]
const MOTES_PER_SEC = [6, 8, 12, 18, 26, 36]
const HALO_SIZE     = [1.1, 1.2, 1.4, 1.7, 2.1, 2.5]
const CIRCLE_SIZE   = [1.8, 1.9, 2.1, 2.3, 2.6, 2.9]

function play(name, rate = 1){
    const sound = getAllSounds()?.[name]
    if(!sound) return
    try {
        sound.setPlaybackRate?.(rate)
        sound.play()
    } catch(error){}
}

/**
 * A tome on the floor at `position` (its floor height) holding `item` (a skill
 * book - tcp's tomeItem, the description filled in here from the skill).
 * options.treasureId: the server's record id - the root mesh is named
 * treasure_<id>, so worldsocket.js's "treasure-removed" finds and disposes it.
 * Returns that root (an invisible box - the walk-up trigger), or null.
 */
export function createTomeLoot(scene, position, item, { treasureId } = {}){
    if(!scene || !item) return null
    const tierIndex = tomeTierIndex(item.rarity)
    const tier = tomeTierOf(item.rarity)
    const element = SKILLS_BY_NAME[item.skillName]?.element
    const name = treasureId ?? item.itemId

    const root = MeshBuilder.CreateBox(`treasure_${name}`, { width: 2.2, depth: 2.2, height: 2.3 }, scene)
    root.position.set(position.x, position.y + 1.15, position.z)
    root.isVisible = false
    root.isPickable = false
    // everything you see hangs off this, its origin on the floor
    const look = new TransformNode(`tomeloot.${name}`, scene)
    look.parent = root
    look.position.y = -1.15

    // ── the floor: its skill's circle, a ring of its colour ─────────────────
    const circle = MeshBuilder.CreateGround(`tomeloot.circle.${name}`, { width: 1, height: 1 }, scene)
    circle.material = tomeCircleMaterial(scene, element)
    circle.isPickable = false
    circle.parent = look
    circle.position.y = 0.03
    circle.scaling.set(CIRCLE_SIZE[tierIndex], 1, CIRCLE_SIZE[tierIndex])
    const ring = lightPlane(scene, "ring", tier.main, { flat: true, name: `tomeloot.ring.${name}` })
    ring.parent = look
    ring.position.y = 0.04
    ring.scaling.set(CIRCLE_SIZE[tierIndex] * 1.25, 1, CIRCLE_SIZE[tierIndex] * 1.25)
    const outerRing = tierIndex >= 5 ? lightPlane(scene, "ring", tier.core, { flat: true, name: `tomeloot.ring2.${name}` }) : null
    if(outerRing){
        outerRing.parent = look
        outerRing.position.y = 0.05
        outerRing.scaling.set(CIRCLE_SIZE[tierIndex] * 1.7, 1, CIRCLE_SIZE[tierIndex] * 1.7)
    }

    // ── the column of light: upright cards turned to the camera round their
    // own upright (the beam texture is soft to its sides, thinning upward)
    const pillarHeight = PILLAR_HEIGHT[tierIndex]
    const pillar = (across, color, label) => {
        const mesh = MeshBuilder.CreatePlane(`tomeloot.${label}.${name}`, { size: 1 }, scene)
        mesh.material = lightMaterial(scene, "beam", color)
        mesh.billboardMode = Mesh.BILLBOARDMODE_Y
        mesh.isPickable = false
        mesh.parent = look
        mesh.scaling.set(across, pillarHeight, 1)
        mesh.position.y = pillarHeight / 2
        return mesh
    }
    const pillarOuter = pillar(1.7, tier.main, "pillar")
    const pillarCore = pillar(0.55, Color3.Lerp(tier.main, Color3.White(), 0.7), "pillarcore")

    // ── behind the book: a halo, and a sunburst on a legendary one ──────────
    const halo = lightPlane(scene, "dot", tier.main, { name: `tomeloot.halo.${name}` })
    halo.parent = look
    halo.position.y = HOVER
    halo.scaling.setAll(HALO_SIZE[tierIndex])
    const rays = tierIndex >= 4 ? lightPlane(scene, "rays", tier.main, { name: `tomeloot.rays.${name}` }) : null
    if(rays){
        rays.parent = look
        rays.position.y = HOVER
        rays.scaling.setAll(HALO_SIZE[tierIndex] * 1.35)
    }

    // ── the book (once book1.glb is in) ─────────────────────────────────────
    // turned to face the camera, swaying (open flat it reads as a plank side on)
    const pivot = new TransformNode(`tomeloot.book.${name}`, scene)
    pivot.parent = look
    pivot.position.y = HOVER
    const swayPhase = Math.random() * Math.PI * 2
    // its pages face its +z once tipped (tilt.rotation.x > 0)
    const tilt = new TransformNode(`tomeloot.tilt.${name}`, scene)
    tilt.parent = pivot
    tilt.rotation.x = BOOK_TILT
    tilt.scaling.setAll(BOOK_SCALE)
    tomeBookTemplate(scene).then(template => {
        if(!template || root.isDisposed()) return
        ;[template.left, template.right].forEach(half => {
            const copy = half.clone(`tomeloot.page.${name}`, tilt)
            copy.isVisible = true
            copy.isPickable = false
        })
    })

    // ── motes rising off the circle ─────────────────────────────────────────
    const floor = new Vector3(position.x, position.y, position.z)
    const motes = new ParticleSystem(`tomeloot.motes.${name}`, 120, scene)
    motes.particleTexture = getParticleTexture(scene, particleTexturePath("flare"))
    // a point, not the root: a mesh's particle systems go with it, textures
    // and all - and the texture is the shared cache's
    motes.emitter = floor.clone()
    motes.createDirectedCylinderEmitter(CIRCLE_SIZE[tierIndex] * 0.42, 0.1, 1, new Vector3(-0.06, 1, -0.06), new Vector3(0.06, 1, 0.06))
    motes.blendMode = ParticleSystem.BLENDMODE_ADD
    motes.minEmitPower = 0.35
    motes.maxEmitPower = 0.8
    motes.minLifeTime = 1.6
    motes.maxLifeTime = Math.min(3.2, 1.8 + pillarHeight * 0.25)
    motes.minSize = 0.05
    motes.maxSize = 0.13
    motes.color1 = new Color4(tier.main.r, tier.main.g, tier.main.b, 1)
    motes.color2 = new Color4(tier.core.r, tier.core.g, tier.core.b, 1)
    motes.colorDead = new Color4(tier.main.r, tier.main.g, tier.main.b, 0)
    motes.emitRate = MOTES_PER_SEC[tierIndex]
    motes.updateSpeed = 1 / 60

    // ── alive ───────────────────────────────────────────────────────────────
    const me = getCharState()?.owner
    const myPlayer = getPlayersOnScene().find(pl => pl.owner === me)
    let awake = false
    let nextAwakeCheck = 0
    let charge = 0          // 0 .. 1 while it's being taken
    let chargingSince = 0   // when the bar started, 0 when it isn't running
    let nextGlint = 0
    let last = performance.now()
    // taking it (below)
    let taken = false
    let inside = false
    const setAwake = on => {
        if(on === awake) return
        awake = on
        look.setEnabled(on)
        if(on) motes.start()
        else motes.stop()
    }
    look.setEnabled(false)
    const observer = scene.onBeforeRenderObservable.add(() => {
        const now = performance.now()
        const dt = Math.min(0.1, (now - last) / 1000)
        last = now
        if(now >= nextAwakeCheck){
            nextAwakeCheck = now + AWAKE_CHECK_MS
            const body = myPlayer?.body
            const near = !!body && !body.isDisposed() &&
                Math.hypot(body.position.x - position.x, body.position.z - position.z) < AWAKE_RANGE &&
                Math.abs(body.position.y - position.y) < AWAKE_RANGE
            setAwake(near)
        }
        if(!awake) return
        // the bar's own pace while it runs, easing back off if it stops
        const goal = chargingSince ? Math.min(1, (now - chargingSince) / (PICKUP_SECONDS * 1000)) : 0
        charge += (goal - charge) * Math.min(1, (chargingSince ? 12 : 3) * dt)
        const t = now / 1000
        // a heartbeat for a mythic one - two quick beats - a slow breath otherwise
        const beat = tierIndex >= 5
            ? Math.max(0, Math.sin(t * 7.5)) ** 8 + 0.6 * Math.max(0, Math.sin(t * 7.5 - 1.1)) ** 8
            : 0.5 + 0.5 * Math.sin(t * 2.2)

        pivot.position.y = HOVER + Math.sin(t * 2.1) * 0.06 + charge * 0.3
        // facing whoever looks at it, swaying - straining harder, shaking, as
        // it's taken
        const eye = scene.activeCamera?.globalPosition
        const face = eye ? Math.atan2(eye.x - position.x, eye.z - position.z) : 0
        pivot.rotation.y = face + Math.sin(t * (0.8 + charge * 3) + swayPhase) * (SWAY + charge * 0.15)
        pivot.rotation.z = Math.sin(t * 37) * 0.07 * charge * charge
        halo.position.y = rays ? (rays.position.y = pivot.position.y) : pivot.position.y
        halo.visibility = 0.42 + 0.18 * beat + 0.4 * charge
        halo.scaling.setAll(HALO_SIZE[tierIndex] * (1 + 0.08 * beat + 0.35 * charge))
        if(rays){
            rays.rotation.z += dt * 0.25
            rays.visibility = 0.45 + 0.15 * beat + 0.4 * charge
        }
        circle.rotation.y += dt * (0.3 + charge * 1.2)
        circle.visibility = 0.75 + 0.25 * beat
        ring.rotation.y -= dt * 0.45
        ring.visibility = 0.55 + 0.3 * beat + 0.15 * charge
        if(outerRing){
            outerRing.rotation.y += dt * 0.3
            outerRing.visibility = 0.25 + 0.5 * beat
        }
        const pillarAlpha = PILLAR_ALPHA[tierIndex] * (0.85 + 0.3 * beat) * (1 + 1.4 * charge)
        pillarOuter.visibility = pillarAlpha
        pillarCore.visibility = pillarAlpha * 1.3
        motes.emitRate = MOTES_PER_SEC[tierIndex] * (1 + 3 * charge)
        // glints round an epic one and up - faster while it's being taken
        if(tierIndex >= 3 && now >= nextGlint){
            nextGlint = now + (420 + Math.random() * 800) * (1 - 0.65 * charge) * (tierIndex >= 5 ? 0.7 : 1)
            const a = Math.random() * Math.PI * 2
            const r = 0.35 + Math.random() * 0.5
            const at = new Vector3(position.x + Math.cos(a) * r, position.y + pivot.position.y + (Math.random() - 0.4) * 0.7, position.z + Math.sin(a) * r)
            popPlane(scene, "star", tier.core, at, { from: 0.05, to: 0.38 + 0.2 * Math.random(), ms: 380, group: 0, spin: 1.2, angle: Math.random() * Math.PI })
        }
    })
    root.onDisposeObservable.addOnce(() => {
        scene.onBeforeRenderObservable.remove(observer)
        // not with its texture - that's the particle cache's
        motes.dispose(false)
        // its button, if I was standing at it (someone else took it)
        if(inside && !taken) openCloseInteractBtn(false, false)
    })

    if(!myPlayer?.body){
        console.warn("[tomeLoot] no local player on scene yet, pickup trigger skipped")
        return root
    }

    // ── taking it ───────────────────────────────────────────────────────────
    const book = () => ({ ...(makeSkillBook(item.skillName) ?? {}), ...item })
    const take = () => {
        taken = true
        chargingSince = 0
        const at = new Vector3(position.x, position.y + pivot.position.y, position.z)
        play("tomeOpenS", 1.1)
        sparkBurst(scene, at, tier.main, { count: 40 + 16 * tierIndex, power: 3.5 })
        popPlane(scene, "dot", tier.core, at, { from: 0.4, to: 2.2 + 0.3 * tierIndex, ms: 380, group: 0 })
        popPlane(scene, "ring", tier.main, new Vector3(position.x, position.y + 0.06, position.z), { flat: true, from: 0.6, to: 4 + tierIndex * 0.5, ms: 520, group: 0 })
        obtain(book())
        // the server first - nobody else can take it now (and it comes back,
        // rolled anew, a while later - hiddenHoards.ts)
        if(treasureId) emitRemoveTreasure(treasureId)
        root.dispose()
    }
    const offer = () => openCloseInteractBtn("normal", true, () => {
        if(taken) return
        openCloseInteractBtn(false)
        chargingSince = performance.now()
        play("tomeStepS", 0.9)
        startTimedPickup({
            scene,
            target: root,
            label: `Taking the ${item.dn ?? "tome"}`,
            seconds: PICKUP_SECONDS,
            radius: PICKUP_RADIUS,
            claim: treasureId ? { kind: "treasure", id: treasureId } : null,
            onDone: take,
            onCancel: () => {
                chargingSince = 0
                if(inside && !taken && !root.isDisposed()) offer()
            },
        })
    })
    onIntersecEnterTrig(root, myPlayer.body, scene, () => {
        inside = true
        if(!taken) offer()
    })
    onIntersecExitTrig(root, myPlayer.body, scene, () => {
        inside = false
        if(taken) return
        openCloseInteractBtn(false, false)
    })
    return root
}
