import { Axis, Camera, Color3, Mesh, MeshBuilder, Vector3 } from "@babylonjs/core"
import { getPlayersOnScene } from "../sockets/worldsocket.js"
import { getCharState } from "../charactersystem/characterstate.js"
import { getAllSounds } from "../components/soundSystem.js"
import { addCameraTrauma, punchCameraFov } from "../tools/cameraShake.js"
import { addGlow } from "../tools/glow.js"
import { CARD_ASPECT, CARD_PLANE_HEIGHT, createBlessingCard, createBlessingTitle } from "../gui/blessingCard.js"
import { sparkBurst } from "./blessingFx.js"
import { popShockRing } from "./shockRing.js"
import { shockRipple } from "./sonicDistortion.js"
import { chestOf, feetOf, headOf, screenFlash } from "./comicHit.js"
import { fireParticles } from "./fireball.js"
import { GOLD, animate, c4, easeInCubic, easeInQuad, easeOutBack, easeOutCubic, fireAura, gather, hotMaterial, inflow, later, lightMaterial, lightPillar, lightPlane, motes, popPlane, prewarmBlessingMotifs, themeOf, tintBody } from "./blessingMotifs.js"

// RECEIVING A BLESSING, SHOWN - what abilitySystem.js's receiveAbilities plays
// in place of a flat list on the screen. Every blessing comes as a card in
// the world beside you (gui/blessingCard.js), and is drawn into your body the
// way an enemy charges its ranged attack (enemies/rangeAttack.js) - only in
// the blessing's own colours, and ending in its own motif
// (effects/blessingMotifs.js). The beats, one after another, each a little
// peak of its own, the last the biggest (an anticipation parade):
//   1. the summons   light comes down out of the sky onto you, a ring off your
//                    feet, the body flushing gold
//   2. the cards     come out of you face down, only their glow giving away
//                    their colour: one alone straight to beside you; several
//                    out into a ring circling you
//   3. one by one    each card comes up beside you, big enough to read (a share
//                    of the screen, however far the camera's out), and turns
//                    over - a flash, a sunburst behind it, a chime a step
//                    higher than the last. The next comes up as this one flies
//                    in, and only turns over once it has landed - each a little
//                    quicker than the one before. Then it's drawn in: it shivers and whitens,
//                    light and sparks pour into your chest from all round, it
//                    comes apart into motes streaming into you, and swoops in,
//                    spinning, shrinking, a comet of its colour. As it goes in:
//                    a flash, the body lit, a ring, the air bent, the camera
//                    punched, its colour flaming up off you - and its motif
//   4. the finale    a column of light shooting up off you, a sunburst behind
//                    you, rings of every colour you took in, the air bent wide,
//                    the screen flashing, the words over your head
// Only on your own screen. You can walk the whole while - it all follows you.
// Your blessings are saved the moment they're received (abilitySystem.js);
// onDone (their perks taking hold) runs once the last one's in - or at once
// if the ceremony's cut short (the place changing under it).

const SUMMON_LAND_MS = 190
const EMERGE_AT_MS = 300
const EMERGE_MS = 520
const EMERGE_STAGGER_MS = 70
// up beside them, then (once the one before has landed) turned over
const TRAVEL_MS = 260
const FLIP_MS = 220
// face down a beat at the spot before it turns
const FLIP_AFTER_MS = 60
const ALONE_FLIP_AFTER_MS = 160
// the one before it landed in them this long before it turns
const FLIP_AFTER_LAND_MS = 110
const WIND_MS = 150
const FLY_MS = 300
// long enough for the last one's own motif to show before the finale
const FINALE_AFTER_MS = 600
const FINALE_MS = 2300
// the most it waits for its shaders and its cards' pictures before it starts
const READY_WAIT_MS = 1200
// how tall a card is, as a share of the screen's height: shown, and waiting
// in the ring
const PRESENT_SHARE = 0.5
const RING_SHARE = 0.14
// how long a card stays up to be read, face up: one alone, longest; a run of
// them quicker and quicker - the last a breath longer before the finale
const holdFor = (index, total) => total <= 1 ? 900 : index >= total - 1 ? 560 : Math.max(380, 600 - 55 * index)
// the steps the chimes climb (a major pentatonic), card by card - held at the
// top after the eighth, past that a bell only gets shrill - and the gentler
// climb of the chord each one goes in on
const CHIME_STEPS = [0, 2, 4, 7, 9, 12, 14, 16]
const CHORD_STEPS = [0, 2, 4, 5, 7, 9]
const pitch = (steps, i) => Math.pow(2, steps[Math.min(i, steps.length - 1)] / 12)

let ceremony = null          // the one playing
const waiting = []           // what came in once its finale had begun

/**
 * Shows `entries` ([{ blessing, upgraded }] - the character's own copies)
 * being received. More while one's still going join it. onDone once
 * they're all in. False if there's no body of yours to show it on - nothing
 * shown, onDone never called.
 */
export function revealBlessings(entries, { onDone = null } = {}){
    if(!entries?.length) return false
    if(ceremony && !ceremony.closing){
        ceremony.add(entries, onDone)
        return true
    }
    const player = myPlayer()
    if(!canShowOn(player)) return false
    if(ceremony) waiting.push({ entries, onDone })
    else ceremony = begin(player, entries, onDone)
    return true
}

/** True while a ceremony's playing (or waiting to) - the next level-up wheel holds back till it's over. */
export function isRevealingBlessings(){
    return !!ceremony || waiting.length > 0
}

function myPlayer(){
    const owner = getCharState()?.owner
    return owner ? getPlayersOnScene().find(player => player.owner === owner) : null
}
function canShowOn(player){
    const scene = player?.body?.getScene?.()
    return !!scene && !scene.isDisposed && !player.body.isDisposed() && !!scene.activeCamera
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

function begin(player, entries, onDone){
    const scene = player.body.getScene()
    const c = {
        cards: [],
        dones: [],
        started: false,
        startedAt: 0,
        closing: false,
        ended: false,
        // cards brought up so far, turned over so far, gone in so far
        presented: 0,
        shown: 0,
        absorbed: 0,
        showing: null,
        nextShowAt: Infinity,
        // when the card flying in now lands
        landsAt: 0,
        lastImpactAt: 0,
        ringAngle: Math.random() * Math.PI * 2,
        last: performance.now(),
        add,
    }

    // where things are, measured once a frame: the camera, which way it looks,
    // how much of the world the screen takes in at a distance - and them
    const view = {
        cam: new Vector3(), forward: new Vector3(), right: new Vector3(), up: new Vector3(),
        tanHalf: 0.4, aspect: 1.6, dist: 10,
        chest: new Vector3(), feet: new Vector3(), head: new Vector3(),
        present: new Vector3(), presentH: 1, ringH: 1,
    }
    const chest = () => view.chest
    const feet = () => view.feet
    const head = () => view.head
    // from the camera through them, flat - "behind them", as you see them
    const awayDir = new Vector3()
    const away = () => {
        awayDir.set(view.chest.x - view.cam.x, 0, view.chest.z - view.cam.z)
        if(awayDir.lengthSquared() < 0.01) awayDir.set(view.forward.x, 0, view.forward.z)
        if(awayDir.lengthSquared() < 0.0001) awayDir.set(0, 0, 1)
        return awayDir.normalize()
    }
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
        // where a card's shown: just this side of them, beside them on the
        // screen (clear of them, unless the screen's too narrow for that)
        const d = Math.max(1.7, view.dist - 0.9)
        const halfH = d * view.tanHalf
        const halfW = halfH * aspect
        const H = PRESENT_SHARE * 2 * halfH
        const x = Math.min(halfW * 0.96 - H * CARD_ASPECT / 2, halfH * 0.2 + H * CARD_ASPECT / 2)
        view.present.copyFrom(view.cam)
        view.forward.scaleAndAddToRef(d, view.present)
        view.right.scaleAndAddToRef(x, view.present)
        view.up.scaleAndAddToRef(halfH * 0.04, view.present)
        view.presentH = H
        view.ringH = Math.min(1.35, Math.max(0.45, RING_SHARE * 2 * view.dist * view.tanHalf))
    }

    // ── the cards ──

    function add(more, done){
        if(done) c.dones.push(done)
        more.forEach(({ blessing, upgraded = false }) => {
            if(!blessing?.name) return
            const card = {
                blessing, upgraded, theme: themeOf(blessing.name),
                state: "loading", goal: "ring",
                mesh: null, back: null, glow: null, rays: null,
                base: new Vector3(), from: new Vector3(), flyFrom: null,
                height: 0.02, fromHeight: 0, presentH: 1,
                since: 0, flipAt: 0, absorbAt: 0, revealedAt: 0, direct: false,
                glowLevel: 0, raysLevel: 0, white: 0, alpha: 1, squeeze: 0, shake: 0,
            }
            c.cards.push(card)
            card.ready = createBlessingCard(scene, blessing, card.theme, { upgraded })
                .then(({ mesh, back, loaded }) => {
                    if(c.ended || scene.isDisposed){
                        mesh.dispose()
                        return null
                    }
                    setUp(card, mesh, back)
                    return Promise.race([loaded, wait(READY_WAIT_MS)])
                })
                .catch(error => console.error("[blessingReveal] card", blessing.name, error))
                .then(() => {
                    if(card.state === "loading") card.state = card.mesh ? "ready" : "gone"
                })
        })
    }
    function setUp(card, mesh, back){
        card.mesh = mesh
        card.back = back
        mesh.isVisible = false
        back.isVisible = false
        // face down till it's turned over
        mesh.rotation.y = Math.PI
        // its colour glowing behind it - and, while it's up, a sunburst
        const behind = (tex, size, z) => {
            const plane = lightPlane(scene, tex, card.theme.main, { name: `blessing.card.${tex}` })
            plane.billboardMode = Mesh.BILLBOARDMODE_NONE
            plane.parent = mesh
            plane.position.z = z
            plane.scaling.set(size[0], size[1], 1)
            plane.isVisible = false
            return plane
        }
        card.glow = behind("dot", [2.1, 2.5], 0.03)
        card.rays = behind("rays", [3.6, 3.6], 0.05)
    }
    function setGroup(card, group){
        ;[card.mesh, card.back, card.glow, card.rays].forEach(mesh => { if(mesh) mesh.renderingGroupId = group })
    }

    // where a card waiting in the ring goes: spaced evenly round them, the
    // ring turning slowly, wide enough for all of them
    const ringSpot = new Vector3()
    function ringSpotOf(card){
        const waitingCards = c.cards.filter(other => other.state === "ring" || (other.state === "emerge" && other.goal === "ring"))
        const n = Math.max(1, waitingCards.length)
        const i = Math.max(0, waitingCards.indexOf(card))
        const radius = Math.max(1.35, n * view.ringH * CARD_ASPECT * 1.12 / (Math.PI * 2))
        const a = c.ringAngle + (i / n) * Math.PI * 2
        ringSpot.set(view.chest.x + Math.cos(a) * radius, view.chest.y + 0.3 + Math.sin(performance.now() / 420 + i) * 0.05, view.chest.z + Math.sin(a) * radius)
        return ringSpot
    }
    const follow = (from, to, dt, rate) => Vector3.LerpToRef(from, to, 1 - Math.exp(-dt * rate), from)

    // ── the timeline ──

    async function start(){
        measure()
        const themes = c.cards.map(card => card.theme)
        await Promise.race([
            Promise.all([prewarmBlessingMotifs(scene, themes), ...c.cards.map(card => card.ready)]),
            wait(READY_WAIT_MS),
        ])
        if(c.ended) return
        if(scene.isDisposed || player.body.isDisposed()) return finish()
        c.started = true
        c.startedAt = performance.now()
        summon()
    }

    function summon(){
        play("blessSummonS")
        lightPillar(scene, feet, GOLD, { height: 11, radius: 0.55, ms: 1000, mode: "down", alpha: 0.85 })
        later(scene, SUMMON_LAND_MS, () => {
            popShockRing(scene, view.feet.clone(), { size: 4.8, seconds: 0.55, color: GOLD })
            sparkBurst(scene, view.chest.clone(), GOLD, { count: 40, power: 5, size: [0.06, 0.15], life: [0.3, 0.7] })
            addCameraTrauma(scene, 0.28)
            tintBody(player, GOLD, { peak: 0.55, ms: 600, whiteFor: 60 })
            floor.show()
        })
    }

    function direct(now){
        if(!c.started) return
        // out of them, once they're ready - the first ones on the summons' beat
        if(now >= c.startedAt + EMERGE_AT_MS){
            const fresh = c.cards.filter(card => card.state === "ready")
            const alone = c.cards.length === 1
            fresh.forEach((card, i) => {
                card.state = "emerge"
                card.goal = alone ? "present" : "ring"
                card.since = now + i * EMERGE_STAGGER_MS
                card.base.copyFrom(view.chest)
            })
            if(fresh.length && !alone && c.nextShowAt === Infinity) c.nextShowAt = now + EMERGE_MS + EMERGE_STAGGER_MS * (fresh.length - 1) + 380
        }
        // the one up beside them, its time over: drawn in
        const up = c.showing
        if(up?.state === "present" && now >= up.absorbAt) startAbsorb(up, now)
        // the next comes up as the one before flies in
        if(now >= c.nextShowAt && c.showing?.state !== "present"){
            const next = c.cards.find(card => card.state === "ring")
            if(next) present(next, now)
        }
        // all in: the finale
        if(!c.closing && c.cards.length && c.cards.every(card => card.state === "gone") && now >= c.lastImpactAt + FINALE_AFTER_MS) finale()
    }

    // brought up beside them - turned over once it's there and the one before
    // it has landed. direct: it came straight here (a card alone)
    function present(card, now, { direct = false } = {}){
        card.state = "present"
        card.direct = direct
        card.since = now
        card.from.copyFrom(card.base)
        card.fromHeight = card.height
        card.revealedAt = 0
        const there = direct ? now + ALONE_FLIP_AFTER_MS : now + TRAVEL_MS + FLIP_AFTER_MS
        card.flipAt = Math.max(there, c.landsAt + FLIP_AFTER_LAND_MS)
        card.absorbAt = card.flipAt + FLIP_MS + holdFor(c.presented, c.cards.length)
        c.presented++
        c.showing = card
        setGroup(card, 1)
    }
    // face up: the chime (a step higher than the last), a glint, the card flashing
    function reveal(card, now){
        card.revealedAt = now
        play("blessRevealS", pitch(CHIME_STEPS, c.shown))
        c.shown++
        popPlane(scene, "star", card.theme.core, () => card.mesh.position, { from: view.presentH * 0.25, to: view.presentH * 1.6, ms: 340, spin: 0.9 })
        sparkBurst(scene, card.mesh.position.clone(), card.theme.main, { count: 22, power: 3.5, size: [0.04, 0.1], life: [0.25, 0.5] })
    }

    function startAbsorb(card, now){
        card.state = "absorb"
        card.since = now
        card.presentH = card.height
        c.landsAt = now + WIND_MS + FLY_MS
        c.nextShowAt = now + WIND_MS
        // the pull: light streaming into their chest from all round, sparks
        // sucked in with it, the card coming apart into motes that stream in too
        card.pull = inflow(scene, chest, card.theme, { reach: 2.3, rate: [60, 420] })
        card.sparks = gather(scene, chest, card.theme, { radius: 1.1, rate: 140 })
        card.motes = dissolve(card)
    }

    // ── a card coming apart into motes, streaming into their chest ──

    function dissolve(card){
        const t = card.theme
        const life = 0.42
        const ps = fireParticles(scene, "blessing.card.motes", 240, "flare", card.base)
        ps.renderingGroupId = 1
        ps.startPositionFunction = (matrix, position) => {
            const halfW = card.height * CARD_ASPECT * (1 - 0.45 * card.squeeze) * 0.5
            const halfH = card.height * 0.5
            position.copyFrom(card.mesh.position)
            view.right.scaleAndAddToRef(rand(-1, 1) * halfW, position)
            view.up.scaleAndAddToRef(rand(-1, 1) * halfH, position)
        }
        // into the chest, arriving as they die
        ps.startDirectionFunction = (matrix, direction, particle) => direction.set(view.chest.x - particle.position.x, view.chest.y - particle.position.y, view.chest.z - particle.position.z).scaleInPlace(1 / life)
        ps.minEmitPower = ps.maxEmitPower = 1
        ps.minLifeTime = ps.maxLifeTime = life
        const size = Math.max(0.03, card.height * 0.045)
        ps.addSizeGradient(0, size * 0.6, size)
        ps.addSizeGradient(1, size * 0.15, size * 0.3)
        ps.addColorGradient(0, c4(Color3.White(), 1))
        ps.addColorGradient(0.35, c4(t.core, 1))
        ps.addColorGradient(1, c4(t.main, 0))
        ps.emitRate = 0
        ps.start()
        return {
            rate(r){ ps.emitRate = r },
            stop(){ ps.stop() },
        }
    }
    // its flight in: a trail of its colour, a comet's head on it
    function flight(card){
        const t = card.theme
        const prev = card.base.clone()
        const now = card.base.clone()
        const ps = fireParticles(scene, "blessing.card.trail", 200, "flare", now)
        ps.renderingGroupId = 1
        ps.startPositionFunction = (matrix, position) => Vector3.LerpToRef(prev, now, Math.random(), position)
        ps.startDirectionFunction = (matrix, direction) => direction.set(rand(-0.2, 0.2), rand(-0.2, 0.2), rand(-0.2, 0.2))
        ps.minEmitPower = ps.maxEmitPower = 1
        ps.minLifeTime = 0.22
        ps.maxLifeTime = 0.38
        const size = card.presentH * 0.09
        ps.addSizeGradient(0, size * 0.7, size)
        ps.addSizeGradient(1, 0, size * 0.1)
        ps.addColorGradient(0, c4(t.core, 1))
        ps.addColorGradient(0.4, c4(t.main, 0.85))
        ps.addColorGradient(1, c4(t.deep, 0))
        ps.emitRate = 420
        ps.start()
        const head = lightPlane(scene, "dot", t.core, { group: 1, name: "blessing.comet" })
        const halo = lightPlane(scene, "dot", t.main, { group: 1, name: "blessing.comet.halo" })
        return {
            step(k){
                prev.copyFrom(now)
                now.copyFrom(card.base)
                head.position.copyFrom(card.base)
                halo.position.copyFrom(card.base)
                head.scaling.setAll(card.presentH * (0.12 + 0.45 * k))
                halo.scaling.setAll(card.presentH * (0.3 + 0.9 * k))
                head.visibility = 0.4 + 0.6 * k
                halo.visibility = 0.35 + 0.5 * k
            },
            stop(){
                ps.stop()
                head.dispose()
                halo.dispose()
            },
        }
    }

    function moveCard(card, now, dt){
        if(!card.mesh || card.mesh.isDisposed() || !["emerge", "ring", "present", "absorb"].includes(card.state)) return
        const mesh = card.mesh
        const t = now - card.since
        let offsetUp = 0
        let offsetSide = 0
        card.squeeze = 0
        switch(card.state){
            case "emerge": {
                if(t < 0) return
                const k = Math.min(1, t / EMERGE_MS)
                const toPresent = card.goal === "present"
                const goal = toPresent ? view.present : ringSpotOf(card)
                const goalH = toPresent ? view.presentH : view.ringH
                Vector3.LerpToRef(view.chest, goal, easeOutCubic(k), card.base)
                card.height = Math.max(0.02, goalH * easeOutBack(k))
                // a turn and a half on the way out, landing face down
                mesh.rotation.y = Math.PI * (1 + 2 * (1 - easeOutCubic(k)))
                card.glowLevel = 0.6 + 0.6 * (1 - k)
                card.raysLevel = 0
                if(k >= 1){
                    popPlane(scene, "star", card.theme.core, card.base.clone(), { from: goalH * 0.25, to: goalH * 1.5, ms: 280, spin: 0.9, group: toPresent ? 1 : 0 })
                    if(toPresent) present(card, now, { direct: true })
                    else {
                        card.state = "ring"
                        card.since = now
                    }
                }
                break
            }
            case "ring": {
                follow(card.base, ringSpotOf(card), dt, 9)
                card.height += (view.ringH - card.height) * (1 - Math.exp(-dt * 8))
                mesh.rotation.y = Math.PI
                // its colour throbbing through the back - the only hint
                card.glowLevel = 0.5 + 0.15 * Math.sin(now / 160 + card.since)
                card.raysLevel = 0
                break
            }
            case "present": {
                const k = card.direct ? 1 : Math.min(1, t / TRAVEL_MS)
                const flip = now < card.flipAt ? 0 : Math.min(1, (now - card.flipAt) / FLIP_MS)
                // swelling a little as it turns
                const swell = 1 + 0.1 * Math.sin(Math.PI * flip)
                if(k < 1){
                    Vector3.LerpToRef(card.from, view.present, easeOutCubic(k), card.base)
                    card.height = card.fromHeight + (view.presentH - card.fromHeight) * easeOutCubic(k)
                } else {
                    follow(card.base, view.present, dt, 12)
                    card.height += (view.presentH * swell - card.height) * (1 - Math.exp(-dt * 14))
                }
                mesh.rotation.y = Math.PI * (1 - easeOutBack(flip))
                if(flip >= 0.5 && !card.revealedAt) reveal(card, now)
                if(!card.revealedAt){
                    // face down, waiting to turn: trembling, its colour throbbing faster
                    card.shake = k >= 1 ? card.height * 0.006 : 0
                    offsetSide = rand(-1, 1) * card.shake
                    offsetUp = rand(-1, 1) * card.shake
                    card.glowLevel = 0.75 + 0.35 * Math.sin(now / 70)
                    card.raysLevel = 0
                    card.white = 0
                } else {
                    // face up: a flash as it turns, a sunburst behind it, breathing
                    const since = now - card.revealedAt
                    card.white = 0.75 * Math.max(0, 1 - since / 260)
                    card.raysLevel = Math.min(1, since / 220)
                    card.glowLevel = 1
                    offsetUp = Math.sin(now / 300) * card.height * 0.012
                }
                break
            }
            case "absorb": {
                if(t < WIND_MS){
                    // the wind-up: it shivers, and whitens, as the pull takes it
                    const w = t / WIND_MS
                    follow(card.base, view.present, dt, 12)
                    card.shake = card.height * 0.014 * w
                    offsetSide = rand(-1, 1) * card.shake
                    offsetUp = rand(-1, 1) * card.shake
                    card.white = 0.3 * w
                    card.raysLevel = 1 - w
                    card.glowLevel = 1 + 0.5 * w
                    card.pull.step(0.6 * w)
                    card.sparks.step()
                    card.motes.rate(140 * w)
                    break
                }
                if(!card.flyFrom){
                    card.flyFrom = card.base.clone()
                    card.flight = flight(card)
                    play("blessDrawS")
                }
                const f = Math.min(1, (t - WIND_MS) / FLY_MS)
                const e = easeInCubic(f)
                // a swoop - up a little, then down and in
                const from = card.flyFrom
                const to = view.chest
                const lift = card.presentH * 0.35
                const cx = from.x + (to.x - from.x) * 0.2 + view.up.x * lift
                const cy = from.y + (to.y - from.y) * 0.2 + view.up.y * lift
                const cz = from.z + (to.z - from.z) * 0.2 + view.up.z * lift
                const a = (1 - e) * (1 - e), b = 2 * (1 - e) * e, d = e * e
                card.base.set(a * from.x + b * cx + d * to.x, a * from.y + b * cy + d * to.y, a * from.z + b * cz + d * to.z)
                card.height = card.presentH * (1 - 0.94 * easeInQuad(f))
                mesh.rotation.y = 0
                mesh.rotation.z = -Math.PI * 2.5 * e
                card.squeeze = Math.sin(Math.PI * f)
                card.white = 0.3 + 0.9 * f
                card.alpha = f < 0.62 ? 1 : 1 - (f - 0.62) / 0.38
                card.raysLevel = 0
                card.glowLevel = 1.4 * (1 - f) + 0.2
                card.pull.step(0.6 + 0.4 * f)
                card.sparks.step()
                card.motes.rate(320)
                card.flight.step(f)
                if(f >= 1) return impact(card, now)
                break
            }
        }
        mesh.isVisible = true
        card.back.isVisible = true
        card.back.visibility = card.alpha
        const s = card.height / CARD_PLANE_HEIGHT
        mesh.scaling.set(s * (1 - 0.45 * card.squeeze), s * (1 + 0.2 * card.squeeze), s)
        mesh.position.copyFrom(card.base)
        if(offsetUp) view.up.scaleAndAddToRef(offsetUp, mesh.position)
        if(offsetSide) view.right.scaleAndAddToRef(offsetSide, mesh.position)
        mesh.visibility = card.alpha
        card.theme.core.scaleToRef(card.white, mesh.material.emissiveColor)
        card.glow.isVisible = true
        card.glow.visibility = Math.min(1, 0.55 * card.glowLevel) * card.alpha
        card.rays.isVisible = card.raysLevel > 0.01
        card.rays.visibility = 0.6 * card.raysLevel
        card.rays.rotation.z += dt * 0.5
    }

    // ── going in ──

    function impact(card, now){
        card.state = "gone"
        c.absorbed++
        c.lastImpactAt = now
        drop(card)
        const t = card.theme
        const at = view.chest.clone()
        tintBody(player, t.main, { peak: 0.75, ms: 520, whiteFor: 70 })
        sparkBurst(scene, at, t.main, { count: 34, power: 5.5, size: [0.06, 0.15], life: [0.25, 0.6] })
        sparkBurst(scene, at, t.core, { count: 14, power: 8.5, size: [0.03, 0.07], life: [0.12, 0.3] })
        popShockRing(scene, view.feet.clone(), { size: 3.6, seconds: 0.45, color: t.main })
        popPlane(scene, "ring", t.main, chest, { from: 0.3, to: 2.4, ms: 320 })
        popPlane(scene, "dot", t.core, chest, { from: 0.4, to: 1.9, ms: 240, alpha: 0.95 })
        shockRipple(scene, at, { radius: 2.8, ms: 420, strength: 0.45, thickness: 0.7, chroma: 0.6, rim: 0.3, tint: t.main })
        addCameraTrauma(scene, 0.22)
        punchCameraFov(scene, 0.03)
        play("blessAbsorbS", pitch(CHORD_STEPS, c.absorbed - 1))
        fireAura(scene, feet, t)
        motes(scene, feet, t, { ms: 1100, rate: 34 })
        core.pop(t)
        floor.pulse(t)
        try {
            t.motif({ scene, player, theme: t, chest, feet, head, away })
        } catch(error){
            console.error("[blessingReveal] motif", card.blessing.name, error)
        }
    }
    // a card's own pieces, gone
    function drop(card){
        card.pull?.stop()
        card.sparks?.stop()
        card.motes?.stop()
        card.flight?.stop()
        card.pull = card.sparks = card.motes = card.flight = null
        if(card.mesh && !card.mesh.isDisposed()) card.mesh.dispose()
    }

    // the light in their chest the cards go into - inside them, so only its
    // glow shows (the glow layer draws over everything), swelling as they
    // come in and flaring as each one lands
    const core = (() => {
        const orb = MeshBuilder.CreateSphere("blessing.core", { diameter: 1, segments: 12 }, scene)
        orb.isPickable = false
        orb.material = hotMaterial(scene)
        orb.isVisible = false
        orb._glowColor = GOLD
        addGlow(scene, orb, 0)
        let flashAt = 0
        let level = 0
        return {
            pop(t){
                orb._glowColor = t.main
                flashAt = performance.now()
            },
            step(now, dt){
                const pulling = c.cards.find(card => card.state === "absorb")
                if(pulling) orb._glowColor = pulling.theme.main
                const want = pulling ? 1 : c.closing ? 0 : 0.35
                level += (want - level) * (1 - Math.exp(-dt * 6))
                const flash = flashAt ? Math.max(0, 1 - (now - flashAt) / 280) : 0
                const bright = level * (1.4 + 0.25 * Math.sin(now / 90)) + flash * 3.2
                orb.isVisible = bright > 0.03
                orb.position.copyFrom(view.chest)
                orb.scaling.setAll(0.16 + 0.03 * Math.min(8, c.absorbed) + 0.3 * flash)
                orb._glowBrightness = bright
            },
            dispose(){ orb.dispose() },
        }
    })()

    // a ring of light on the ground under them, from the summons to the end,
    // throbbing in each blessing's colour as it goes in
    const floor = (() => {
        let ring = null
        let pulseAt = 0
        return {
            show(){
                ring = lightPlane(scene, "ring", GOLD, { flat: true, name: "blessing.floor" })
            },
            pulse(t){
                pulseAt = performance.now()
                if(ring) ring.material = lightMaterial(scene, "ring", t.main)
            },
            step(now){
                if(!ring) return
                const p = pulseAt ? Math.max(0, 1 - (now - pulseAt) / 500) : 0
                const fade = c.closing ? Math.max(0, 1 - (now - c.closingAt) / 900) : 1
                ring.position.set(view.feet.x, view.feet.y + 0.05, view.feet.z)
                const s = 2.3 + 0.5 * p
                ring.scaling.set(s, 1, s)
                ring.rotation.y = now / 1400
                ring.visibility = (0.4 + 0.5 * p) * fade
            },
            dispose(){ ring?.dispose() },
        }
    })()

    // ── the finale ──

    function finale(){
        c.closing = true
        c.closingAt = performance.now()
        const at = view.chest.clone()
        const foot = view.feet.clone()
        const themes = [...new Map(c.cards.map(card => [card.theme.name, card.theme])).values()]
        play("blessFinaleS")
        lightPillar(scene, feet, GOLD, { height: 13, radius: 0.6, ms: 1300, mode: "up", alpha: 0.85 })
        popPlane(scene, "rays", GOLD, () => view.chest.add(away().scale(0.7)), { group: 0, from: 1, to: 6.5, ms: 1500, spin: 0.7, alpha: 0.9, fade: k => k < 0.12 ? k / 0.12 : Math.pow(1 - (k - 0.12) / 0.88, 1.3) })
        popShockRing(scene, foot, { size: 7.5, seconds: 0.8, color: GOLD })
        themes.forEach((t, i) => {
            popShockRing(scene, foot, { size: 4.4 + i * 0.5, seconds: 0.55 + i * 0.05, color: t.main })
            sparkBurst(scene, at, t.main, { count: Math.max(14, Math.round(48 / themes.length)), power: 7, size: [0.07, 0.18], life: [0.4, 0.9] })
            motes(scene, feet, t, { ms: 2000, rate: Math.round(46 / themes.length) + 6, radius: 0.7 })
        })
        shockRipple(scene, at, { radius: 6, ms: 700, strength: 0.8, thickness: 1.3, chroma: 1, rim: 0.4, tint: GOLD })
        addCameraTrauma(scene, 0.45)
        punchCameraFov(scene, 0.055)
        screenFlash({ core: Color3.White(), glow: GOLD })
        tintBody(player, GOLD, { peak: 0.7, ms: 800, whiteFor: 80 })
        fireAura(scene, feet, { main: GOLD }, { radius: 0.6, ms: 800, rate: 130 })
        core.pop({ main: GOLD })
        title()
        later(scene, FINALE_MS, finish)
    }

    // the words over their head
    async function title(){
        const n = c.cards.length
        const all = c.cards.every(card => card.upgraded)
        const text = all
            ? (n === 1 ? "BLESSING EMPOWERED" : `${n} BLESSINGS EMPOWERED`)
            : (n === 1 ? "BLESSING OBTAINED" : `${n} BLESSINGS OBTAINED`)
        let mesh
        try {
            mesh = await createBlessingTitle(scene, text)
        } catch(error){
            return console.error("[blessingReveal] title", error)
        }
        if(scene.isDisposed || c.ended) return mesh.dispose()
        mesh.renderingGroupId = 1
        // a plane 4 wide, its words as tall as about half of it
        const planeHeight = 4 * 200 / 1024
        animate(scene, 1900, k => {
            const pop = k < 0.07 ? 1.15 * easeOutBack(k / 0.07) : k < 0.14 ? 1.15 - 0.15 * (k - 0.07) / 0.07 : 1
            const tall = 0.15 * 2 * Math.max(1.5, view.dist) * view.tanHalf
            mesh.scaling.setAll(Math.max(0.01, pop * tall / planeHeight))
            mesh.position.set(view.head.x, view.head.y + 0.55 + 0.3 * easeOutCubic(k), view.head.z)
            mesh.visibility = k > 0.78 ? 1 - (k - 0.78) / 0.22 : 1
        }, { onEnd: () => mesh.dispose() })
    }

    function finish(){
        if(c.ended) return
        c.ended = true
        if(!scene.isDisposed){
            scene.onBeforeRenderObservable.remove(observer)
            scene.onDisposeObservable.remove(sceneGone)
        }
        if(!player.body.isDisposed()) player.body.onDisposeObservable.remove(bodyGone)
        c.cards.forEach(drop)
        core.dispose()
        floor.dispose()
        if(ceremony === c) ceremony = null
        c.dones.forEach(done => {
            try { done() } catch(error){ console.error("[blessingReveal] onDone", error) }
        })
        // whatever came in once its finale had begun - its own ceremony now
        while(waiting.length){
            const next = waiting.shift()
            if(revealBlessings(next.entries, { onDone: next.onDone })) break
            next.onDone?.()
        }
    }

    // ── every frame ──

    const observer = scene.onBeforeRenderObservable.add(() => {
        try {
            if(player.body.isDisposed() || !scene.activeCamera) return finish()
            const now = performance.now()
            const dt = Math.min(0.05, Math.max(0, (now - c.last) / 1000))
            c.last = now
            c.ringAngle += dt * 0.45
            measure()
            direct(now)
            c.cards.forEach(card => moveCard(card, now, dt))
            core.step(now, dt)
            floor.step(now)
        } catch(error){
            // an exception in a frame's observer stops the engine queueing frames
            console.error("[blessingReveal]", error)
            finish()
        }
    })
    // the place changing under it, or them gone: over at once (their perks still take hold)
    const sceneGone = scene.onDisposeObservable.add(() => finish())
    const bodyGone = player.body.onDisposeObservable.add(() => finish())

    add(entries, onDone)
    start()
    return c
}
