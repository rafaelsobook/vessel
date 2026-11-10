import { Axis, Camera, Color3, Constants, DynamicTexture, MeshBuilder, StandardMaterial, Texture, TransformNode, Vector3 } from "@babylonjs/core"
import { getPlayersOnScene } from "../sockets/worldsocket.js"
import { getCharState } from "../charactersystem/characterstate.js"
import { getAllSounds } from "../components/soundSystem.js"
import { addCameraTrauma, punchCameraFov } from "../tools/cameraShake.js"
import { createRewardText, createSpinPrompt, createWheelFace, createWheelToken, SLOT_RADIUS } from "../gui/fortuneWheelGui.js"
import { sparkBurst } from "./blessingFx.js"
import { popShockRing } from "./shockRing.js"
import { shockRipple } from "./sonicDistortion.js"
import { chestOf, feetOf, headOf } from "./comicHit.js"
import { fireParticles } from "./fireball.js"
import { GOLD, animate, c4, easeInCubic, easeOutBack, easeOutCubic, helix, later, lightPillar, lightPlane, motes, popPlane, prewarmBlessingMotifs, tintBody } from "./blessingMotifs.js"

// THE FORTUNE WHEEL, IN THE WORLD - the level-up wheel (charactersystem/
// skillWheel.js decides what's on it and what you win) laid on the ground
// round you, face up, you standing in its hub like the middle of a clock:
//   1. it opens       out of the ground at your feet, turning into place, a
//                     ring of light running out; the eight rewards rise one
//                     by one to float over their wedges (gui/fortuneWheelGui.js);
//                     SPIN over your head. Twelve o'clock - slot 0 - is the
//                     wedge away from the camera, the way you look at it
//   2. you spin it    a tap on the wheel or on SPIN (or Enter): the hand
//                     sweeps round from under your feet - six turns and more,
//                     a blur of light behind it, ticking past each peg,
//                     slower and slower (the old wheel's own curve), the lamps
//                     on the rim chasing it
//   3. it lands       a bell; the winner flares, a column of light off it,
//                     the others dim
//   4. it pays out    the winner flies into your chest; the reward taken
//                     (onImpact - skillWheel.js's grantReward) and shown its
//                     own way; the wheel sinks away
// It follows you if you walk. The scene going under it (a place change), or
// your body (death), ends it at once: onGone(decided) - decided: the hand had
// already been let go, so the reward's already settled.

const RADIUS = 3.2                 // the wheel, spikes and all, in metres
const TOKEN_LIFT = 0.7             // how high the rewards float over it
const TOKEN_SIZE = 0.9
// the hand runs from under their feet, past the rewards, to the rim's inside
// (shares of RADIUS)
const HAND_FROM = 0.16
const HAND_TO = 0.88
const HAND_WIDTH = 0.8
const OPEN_MS = 950
const TOKEN_POP_AT = 330
const TOKEN_POP_GAP = 65
const TOKEN_POP_MS = 380
const SPIN_MS = 4200
const SPIN_TURNS = 6
const SETTLE_MS = 420
const LAND_HOLD_MS = 700
const COLLECT_MS = 460
const CLOSE_MS = 700
const READY_WAIT_MS = 1500
// how tall SPIN and the payout's words are, as a share of the screen's height
const PROMPT_SHARE = 0.24
const TEXT_SHARE = 0.14
// the order the wheel's see-through layers are drawn in, bottom up - they lie
// a hair apart, too close for distance sorting to keep them in order (and
// the face, drawn last, hid everything under it)
const LAYER = { face: 1, light: 2, sweep: 3, hand: 4, gem: 5, token: 6 }
const SLOT = Math.PI / 4
const WHITE = new Color3(1, 1, 1)

// CSS's cubic-bezier() - the curve the old wheel spun on, kept
function cubicBezier(x1, y1, x2, y2){
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
    const along = (a, b, c, t) => ((a * t + b) * t + c) * t
    return x => {
        if(x <= 0) return 0
        if(x >= 1) return 1
        let lo = 0, hi = 1, t = x
        for(let i = 0; i < 30; i++){
            const v = along(ax, bx, cx, t)
            if(Math.abs(v - x) < 1e-6) break
            if(v < x) lo = t
            else hi = t
            t = (lo + hi) / 2
        }
        return along(ay, by, cy, t)
    }
}
const spinCurve = cubicBezier(0.12, 0.72, 0.15, 1)

let open = null     // the wheel up now - never two

function myPlayer(){
    const owner = getCharState()?.owner
    return owner ? getPlayersOnScene().find(player => player.owner === owner) : null
}
function canShowOn(player){
    const scene = player?.body?.getScene?.()
    return !!scene && !scene.isDisposed && !player.body.isDisposed() && !!scene.activeCamera
}
/** True when there's a body of yours in the world to open a wheel round. */
export function canOpenFortuneWheel(){
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

// ── the hand, and the blur behind it (drawn once per scene) ──────────────────

const drawnCache = new WeakMap()   // scene -> { hand, handMat, sweepMat }
function handParts(scene){
    let parts = drawnCache.get(scene)
    if(parts) return parts
    // the hand: a gold blade from a collar under their feet to a point at the
    // rim, a ruby set in its tip - the tip at the canvas's top (v = 1, +z)
    const hand = new DynamicTexture("fortune.hand", { width: 128, height: 1024 }, scene, true)
    const ctx = hand.getContext()
    const w = 128, h = 1024, cx = w / 2
    ctx.clearRect(0, 0, w, h)
    ctx.shadowColor = "rgba(255, 196, 96, 0.95)"
    ctx.shadowBlur = 20
    const gold = ctx.createLinearGradient(cx - 24, 0, cx + 24, 0)
    gold.addColorStop(0, "#8a6224")
    gold.addColorStop(0.45, "#fff0c4")
    gold.addColorStop(0.55, "#f2cd78")
    gold.addColorStop(1, "#7a5418")
    ctx.fillStyle = gold
    // the blade, tapering out to the tip
    ctx.beginPath()
    ctx.moveTo(cx - 17, h - 70)
    ctx.lineTo(cx - 8, 240)
    ctx.lineTo(cx + 8, 240)
    ctx.lineTo(cx + 17, h - 70)
    ctx.closePath()
    ctx.fill()
    // the point: a long diamond
    ctx.beginPath()
    ctx.moveTo(cx, 18)
    ctx.lineTo(cx + 30, 170)
    ctx.lineTo(cx, 290)
    ctx.lineTo(cx - 30, 170)
    ctx.closePath()
    ctx.fill()
    // a collar where it leaves the hub
    ctx.beginPath()
    ctx.ellipse(cx, h - 74, 26, 14, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    // the ruby in the point
    const ruby = ctx.createLinearGradient(0, 100, 0, 240)
    ruby.addColorStop(0, "#ff8a7a")
    ruby.addColorStop(0.5, "#e2231d")
    ruby.addColorStop(1, "#6b0a0a")
    ctx.fillStyle = ruby
    ctx.beginPath()
    ctx.moveTo(cx, 96)
    ctx.lineTo(cx + 15, 170)
    ctx.lineTo(cx, 236)
    ctx.lineTo(cx - 15, 170)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)"
    ctx.beginPath()
    ctx.ellipse(cx - 4, 150, 3, 12, 0, 0, Math.PI * 2)
    ctx.fill()
    hand.hasAlpha = true
    hand.update()
    hand.wrapU = hand.wrapV = Texture.CLAMP_ADDRESSMODE
    const handMat = new StandardMaterial("fortune.hand", scene)
    handMat.disableLighting = true
    handMat.diffuseColor = Color3.Black()
    handMat.specularColor = Color3.Black()
    handMat.emissiveTexture = hand
    handMat.opacityTexture = hand
    handMat.backFaceCulling = false
    handMat.fogEnabled = false
    handMat.zOffset = -4

    // the blur behind it: a fan of light trailing back (anticlockwise, as seen
    // from above - it turns clockwise) from where it points (up, +z)
    const sweep = new DynamicTexture("fortune.sweep", { width: 256, height: 256 }, scene, true)
    const sctx = sweep.getContext()
    const img = sctx.createImageData(256, 256)
    const fan = 1.25
    const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
    for(let y = 0; y < 256; y++){
        for(let x = 0; x < 256; x++){
            const dx = (x + 0.5) / 128 - 1
            const dy = 1 - (y + 0.5) / 128
            const r = Math.hypot(dx, dy)
            // clockwise from up
            const theta = Math.atan2(dx, dy)
            const behind = ((-theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
            const along = behind < fan ? Math.pow(1 - behind / fan, 1.3) : 0
            const across = smooth(HAND_FROM + 0.04, HAND_FROM + 0.14, r) * (1 - smooth(HAND_TO - 0.06, HAND_TO + 0.02, r))
            const i = (y * 256 + x) * 4
            img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
            img.data[i + 3] = Math.round(255 * along * across)
        }
    }
    sctx.putImageData(img, 0, 0)
    sweep.hasAlpha = true
    sweep.update()
    sweep.wrapU = sweep.wrapV = Texture.CLAMP_ADDRESSMODE
    const sweepMat = new StandardMaterial("fortune.sweep", scene)
    sweepMat.disableLighting = true
    sweepMat.diffuseColor = Color3.Black()
    sweepMat.specularColor = Color3.Black()
    sweepMat.emissiveColor = new Color3(1, 0.82, 0.45)
    sweepMat.opacityTexture = sweep
    sweepMat.alphaMode = Constants.ALPHA_ADD
    sweepMat.disableDepthWrite = true
    sweepMat.backFaceCulling = false
    sweepMat.fogEnabled = false
    sweepMat.zOffset = -3
    parts = { handMat, sweepMat }
    drawnCache.set(scene, parts)
    return parts
}

// ── what each reward looks like going into you ───────────────────────────────

const HEART_PARTS = [
    { stat: "HP", main: Color3.FromHexString("#FF4D6D"), colors: ["#ffe0e6", "#ff6f86", "#b3203a"] },
    { stat: "MP", main: Color3.FromHexString("#4DA3FF"), colors: ["#e0f0ff", "#6fb4ff", "#1f5fb3"] },
    { stat: "SP", main: Color3.FromHexString("#FFD24D"), colors: ["#fff8dc", "#ffd866", "#b38a1f"] },
]
const ARCANE = { core: Color3.FromHexString("#F2E8FF"), main: Color3.FromHexString("#9B6BFF"), deep: Color3.FromHexString("#2E1680") }
const CYAN = { core: Color3.FromHexString("#E6FDFF"), main: Color3.FromHexString("#4FE3FF"), deep: Color3.FromHexString("#0E4C8C") }
const GOLDEN = { core: Color3.FromHexString("#FFF8E6"), main: GOLD, deep: Color3.FromHexString("#9A6A20") }
const tint = color => ({ core: Color3.Lerp(color, WHITE, 0.8), main: color, deep: color.scale(0.4) })

const PAYOUT = {
    // +50 to hp, mana and stamina: three rings out, three streams of light up -
    // red, blue, gold - and the amounts in the same colours
    heart(ctx, result){
        const { scene, player, feet, chest } = ctx
        HEART_PARTS.forEach((part, i) => later(scene, i * 110, () => {
            popShockRing(scene, feet().clone(), { size: 3.2 + i * 0.7, seconds: 0.5, color: part.main })
            sparkBurst(scene, chest().clone(), part.main, { count: 22, power: 4.5, size: [0.05, 0.12], life: [0.3, 0.6] })
            tintBody(player, part.main, { peak: 0.55, ms: 320 })
        }))
        HEART_PARTS.forEach(part => motes(scene, feet, tint(part.main), { ms: 1300, rate: 26, radius: 0.6 }))
        const amount = result?.amount ?? 50
        return HEART_PARTS.map((part, i) => ({ text: `+${amount} ${part.stat}${i < 2 ? " " : ""}`, colors: part.colors }))
    },
    // a blessing: a flash of gold - the blessing's own ceremony
    // (effects/blessingReveal.js) takes it from there
    blessing(ctx){
        const { scene, player, chest, feet } = ctx
        popPlane(scene, "star", GOLDEN.core, chest, { from: 0.5, to: 3, ms: 380, spin: 0.6 })
        sparkBurst(scene, chest().clone(), GOLD, { count: 40, power: 6, size: [0.06, 0.15], life: [0.3, 0.7] })
        popShockRing(scene, feet().clone(), { size: 4.6, seconds: 0.55, color: GOLD })
        tintBody(player, GOLD, { peak: 0.7, ms: 600, whiteFor: 60 })
        return null
    },
    // a skill: arcane light - violet rings, cyan spiralling up - and its name
    skill(ctx, result){
        const { scene, player, chest, feet } = ctx
        popShockRing(scene, feet().clone(), { size: 4.4, seconds: 0.55, color: ARCANE.main })
        later(scene, 120, () => popShockRing(scene, feet().clone(), { size: 3, seconds: 0.45, color: CYAN.main }))
        popPlane(scene, "ring", ARCANE.main, chest, { from: 0.4, to: 2.6, ms: 360 })
        sparkBurst(scene, chest().clone(), ARCANE.main, { count: 36, power: 5.5, size: [0.05, 0.13], life: [0.3, 0.65] })
        helix(scene, feet, CYAN, { strands: 2, turns: 2, ms: 900, radius: 0.65 })
        tintBody(player, ARCANE.main, { peak: 0.6, ms: 520, whiteFor: 50 })
        const name = result?.skill?.displayName ?? result?.skill?.name
        if(!name) return [{ text: "NEW SKILL", colors: ["#f7f0ff", "#c9a8ff", "#6a3fc9"] }]
        return result.upgraded
            ? [{ text: `${name} `, colors: ["#f7f0ff", "#c9a8ff", "#6a3fc9"] }, { text: `LV. ${result.skill.lvl ?? ""}`, colors: ["#effdff", "#7fe8ff", "#1f7fb3"] }]
            : [{ text: "NEW SKILL ", colors: ["#effdff", "#7fe8ff", "#1f7fb3"] }, { text: name, colors: ["#f7f0ff", "#c9a8ff", "#6a3fc9"] }]
    },
}

// ── the wheel ────────────────────────────────────────────────────────────────

/**
 * Opens the wheel round you. rewards: [{ type, icon }], slot by slot. level:
 * for its caption. onSpinRequest(): they've asked to spin it - answer with
 * spin(). onGone(decided): it went before it could finish (see the header).
 * Returns { spin(index, { onImpact, onClosed }), abort() } - or null with no
 * body of yours to open it round.
 *   onImpact()  the winner has gone into them: take the reward now - return
 *               what it was ({ amount } / { skill, upgraded }) for its words
 *   onClosed()  the wheel's gone, all done
 */
export function openFortuneWheel({ rewards, level = null, onSpinRequest = null, onGone = null }){
    const player = myPlayer()
    if(!canShowOn(player) || !rewards?.length) return null
    open?.abort()
    open = build(player, rewards, level, onSpinRequest, onGone)
    return open
}

function build(player, rewards, level, onSpinRequest, onGone){
    const scene = player.body.getScene()
    const engine = scene.getEngine()
    const w = {
        state: "loading",       // loading, opening, waiting, spinning, landed, collecting, closing, gone
        since: performance.now(),
        decided: false,
        wantsSpin: false,
        result: -1,
        target: 0,
        angle: 0,
        lastPeg: 0,
        lastTickAt: 0,
        callbacks: null,
        last: performance.now(),
    }

    // where things are, once a frame
    const view = { cam: new Vector3(), forward: new Vector3(), tanHalf: 0.4, chest: new Vector3(), feet: new Vector3(), head: new Vector3() }
    const chest = () => view.chest
    const feet = () => view.feet
    function measure(){
        const cam = scene.activeCamera
        view.cam.copyFrom(cam.globalPosition)
        cam.getDirectionToRef(Axis.Z, view.forward)
        const aspect = engine.getAspectRatio(cam) || 1.6
        const tan = Math.tan((cam.fov || 0.8) / 2)
        view.tanHalf = cam.fovMode === Camera.FOVMODE_HORIZONTAL_FIXED ? tan / aspect : tan
        view.chest.copyFrom(chestOf(player))
        view.feet.copyFrom(feetOf(player))
        view.head.copyFrom(headOf(player))
    }
    // how big something `share` of the screen tall is, where it stands
    const sized = (at, share) => share * 2 * Math.max(1.5, Vector3.Distance(view.cam, at)) * view.tanHalf
    measure()

    // ── the pieces ──
    const root = new TransformNode("fortune.wheel", scene)
    root.position.set(view.feet.x, view.feet.y + 0.03, view.feet.z)
    // twelve o'clock away from the camera
    const away = new Vector3(view.chest.x - view.cam.x, 0, view.chest.z - view.cam.z)
    if(away.lengthSquared() < 0.01) away.set(view.forward.x, 0, view.forward.z)
    const facing = Math.atan2(away.x, away.z || 0.0001)
    root.rotation.y = facing
    root.scaling.setAll(0.001)

    const { handMat, sweepMat } = handParts(scene)
    const handPivot = new TransformNode("fortune.handPivot", scene)
    handPivot.parent = root
    handPivot.position.y = 0.014
    const handLength = (HAND_TO - HAND_FROM) * RADIUS
    const hand = MeshBuilder.CreateGround("fortune.hand", { width: HAND_WIDTH, height: handLength }, scene)
    hand.parent = handPivot
    hand.position.z = HAND_FROM * RADIUS + handLength / 2
    hand.material = handMat
    const sweep = MeshBuilder.CreateGround("fortune.sweep", { width: RADIUS * 2, height: RADIUS * 2 }, scene)
    sweep.parent = handPivot
    sweep.position.y = -0.004
    sweep.material = sweepMat
    sweep.visibility = 0
    // the ruby's glint at the tip - facing the camera, so it reads from any angle
    const gem = lightPlane(scene, "dot", new Color3(1, 0.4, 0.3), { name: "fortune.gem" })
    gem.parent = handPivot
    gem.position.set(0, 0.12, HAND_TO * RADIUS - handLength * 0.17)
    gem.scaling.setAll(0.6)

    // sparks streaming off the tip as it flies - laid round the arc it swept
    // since the last frame (not across it: it can turn most of a slot a
    // frame), lifting a little. Sparks face the camera: a hand lying flat
    // is a sliver seen from low down, the comet behind it never is
    const tipTrail = (() => {
        const emitter = new Vector3()
        const local = new Vector3()
        const frameOf = root.getWorldMatrix().clone()
        let from = 0
        let to = 0
        const ps = fireParticles(scene, "fortune.tip", 520, "flare", emitter)
        ps.startPositionFunction = (matrix, position) => {
            const a = from + (to - from) * Math.random()
            const r = HAND_TO * RADIUS * (0.8 + Math.random() * 0.2)
            local.set(Math.sin(a) * r, 0.1 + Math.random() * 0.08, Math.cos(a) * r)
            Vector3.TransformCoordinatesToRef(local, frameOf, position)
        }
        ps.startDirectionFunction = (matrix, direction) => direction.set(0, 0.2 + Math.random() * 0.35, 0)
        ps.minEmitPower = ps.maxEmitPower = 1
        ps.minLifeTime = 0.22
        ps.maxLifeTime = 0.4
        ps.addSizeGradient(0, 0.16, 0.28)
        ps.addSizeGradient(1, 0.02, 0.05)
        ps.addColorGradient(0, c4(WHITE, 1))
        ps.addColorGradient(0.3, c4(GOLD, 0.9))
        ps.addColorGradient(1, c4(new Color3(0.9, 0.35, 0.08), 0))
        ps.emitRate = 0
        ps.start()
        return {
            step(before, angle, speed){
                frameOf.copyFrom(root.computeWorldMatrix(true))
                from = before
                to = angle
                ps.emitRate = speed > 0.6 ? Math.min(900, 80 + speed * 14) : 0
            },
            stop(){ ps.stop() },
        }
    })()

    // a glow on the wheel under each slot, and a lamp on each of the rim's spikes
    const slotAt = (i, r) => new Vector3(Math.sin(i * SLOT) * r, 0, Math.cos(i * SLOT) * r)
    const sockets = rewards.map((reward, i) => {
        const light = lightPlane(scene, "dot", GOLD, { flat: true, name: "fortune.socket" })
        light.parent = root
        light.position.copyFrom(slotAt(i, SLOT_RADIUS * RADIUS))
        light.position.y = 0.02
        light.scaling.setAll(1.1)
        light.visibility = 0
        return { light, flash: 0 }
    })
    const lamps = rewards.map((reward, i) => {
        const lamp = lightPlane(scene, "dot", new Color3(1, 0.78, 0.4), { flat: true, name: "fortune.lamp" })
        lamp.parent = root
        lamp.position.copyFrom(slotAt(i, 0.955 * RADIUS))
        lamp.position.y = 0.02
        lamp.scaling.setAll(0.5)
        lamp.visibility = 0
        return lamp
    })
    ;[hand, sweep, gem, ...sockets.map(s => s.light), ...lamps].forEach(mesh => {
        mesh.isPickable = false
        mesh.isVisible = false
    })
    hand.alphaIndex = LAYER.hand
    sweep.alphaIndex = LAYER.sweep
    gem.alphaIndex = LAYER.gem
    ;[...sockets.map(s => s.light), ...lamps].forEach(mesh => { mesh.alphaIndex = LAYER.light })

    let face = null
    let prompt = null
    const tokens = rewards.map(() => null)
    const tokenState = rewards.map(() => ({ pop: 0, flash: 0, dim: 1 }))
    const loads = [
        createWheelFace(scene, rewards).then(({ mesh, loaded }) => {
            if(w.state === "gone") return mesh.dispose()
            face = mesh
            mesh.parent = root
            mesh.alphaIndex = LAYER.face
            mesh.scaling.set(RADIUS * 2, RADIUS * 2, 1)
            // (late - it had already begun without it)
            mesh.isVisible = w.state !== "loading"
            return loaded
        }),
        ...rewards.map((reward, i) => createWheelToken(scene, reward.icon, i).then(({ mesh, loaded }) => {
            if(w.state === "gone") return mesh.dispose()
            tokens[i] = mesh
            mesh.parent = root
            mesh.alphaIndex = LAYER.token
            mesh.position.copyFrom(slotAt(i, SLOT_RADIUS * RADIUS))
            mesh.position.y = TOKEN_LIFT
            // shown as it pops up (every frame)
            mesh.isVisible = false
            return loaded
        })),
        createSpinPrompt(scene, level).then(mesh => {
            if(w.state === "gone") return mesh.dispose()
            prompt = mesh
            mesh.renderingGroupId = 1
            mesh.isVisible = false
        }),
        prewarmBlessingMotifs(scene, []),
    ]
    Promise.race([Promise.all(loads), wait(READY_WAIT_MS)]).then(() => {
        if(w.state === "loading") begin()
    })

    // ── asking to spin: a tap on the wheel or on SPIN, or Enter ──
    const canvas = engine.getRenderingCanvas()
    let press = null
    const onDown = e => {
        if(w.state !== "opening" && w.state !== "waiting") return
        press = { id: e.pointerId, x: e.clientX, y: e.clientY, at: Date.now(), target: e.target }
    }
    const onUp = e => {
        const pressed = press
        press = null
        if(!pressed || e.pointerId !== pressed.id) return
        // a tap, not a drag of the camera - and on the world, not on a menu
        if(Math.hypot(e.clientX - pressed.x, e.clientY - pressed.y) > 14 || Date.now() - pressed.at > 700) return
        if(pressed.target !== canvas && pressed.target?.id !== "touch-overlay") return
        const rect = canvas.getBoundingClientRect()
        const hit = scene.pick(e.clientX - rect.left, e.clientY - rect.top, mesh => (mesh === face || mesh === prompt) && mesh.isVisible)
        if(hit?.hit) ask()
    }
    const onKey = e => {
        if(e.key !== "Enter" || e.repeat) return
        // typing in the chat - not a hidden field that kept its focus
        // (the character creator's name box, once it's gone)
        const field = document.activeElement?.closest?.("input, textarea, [contenteditable]")
        if(field && field.getClientRects().length && getComputedStyle(field).visibility !== "hidden") return
        ask()
    }
    window.addEventListener("pointerdown", onDown, true)
    window.addEventListener("pointerup", onUp, true)
    window.addEventListener("keydown", onKey)
    function ask(){
        if(w.state === "opening" || w.state === "loading") w.wantsSpin = true
        else if(w.state === "waiting") onSpinRequest?.()
    }

    // ── 1. opening ──
    function begin(){
        w.state = "opening"
        w.since = performance.now()
        measure()
        root.position.set(view.feet.x, view.feet.y + 0.03, view.feet.z)
        ;[face, hand, gem, ...sockets.map(s => s.light), ...lamps].forEach(mesh => { if(mesh) mesh.isVisible = true })
        play("wheelAppearS")
        popShockRing(scene, view.feet.clone(), { size: RADIUS * 2.4, seconds: 0.7, color: GOLD })
        // (a hair over the face, or the two fight)
        popPlane(scene, "ring", GOLD, () => root.position.add(new Vector3(0, 0.04, 0)), { flat: true, group: 0, from: 0.5, to: RADIUS * 2.3, ms: 650, alpha: 0.9 })
        motes(scene, () => root.position, GOLDEN, { ms: 700, rate: 70, radius: RADIUS * 0.85 })
        addCameraTrauma(scene, 0.15)
        rewards.forEach((reward, i) => later(scene, TOKEN_POP_AT + i * TOKEN_POP_GAP, () => {
            const token = tokens[i]
            if(!token || w.state === "gone") return
            play("wheelTickS", 0.9 + i * 0.05)
            popPlane(scene, "star", GOLDEN.core, () => token.getAbsolutePosition(), { from: 0.1, to: 1.1, ms: 260, spin: 0.8, group: 0 })
        }))
    }

    // ── 2. spinning ──
    function spin(index, { onImpact = null, onClosed = null } = {}){
        if(w.state !== "waiting" || w.decided) return false
        w.decided = true
        w.state = "spinning"
        w.since = performance.now()
        w.result = ((index % rewards.length) + rewards.length) % rewards.length
        // from wherever it rests, on round SPIN_TURNS times and more, to the winner
        const from = w.angle
        const rest = ((w.result * SLOT - from) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
        w.from = from
        w.target = from + SPIN_TURNS * Math.PI * 2 + rest
        w.lastPeg = pegOf(from)
        w.callbacks = { onImpact, onClosed }
        sweep.isVisible = true
        play("wheelSpinS")
        addCameraTrauma(scene, 0.12)
        // SPIN goes, its job done
        if(prompt){
            const shown = prompt
            const scale = shown.scaling.x
            animate(scene, 220, k => {
                shown.scaling.setAll(Math.max(0.001, scale * (1 + 0.25 * k) * (1 - k)))
                shown.visibility = 1 - k
            }, { onEnd: () => { shown.isVisible = false } })
        }
        return true
    }
    // the pegs sit between the slots
    const pegOf = angle => Math.floor((angle + SLOT / 2) / SLOT)
    function tick(slot, now){
        const s = sockets[slot]
        if(s) s.flash = 1
        tokenState[slot].flash = 1
        // the clicks come too fast to all be heard while it's flying
        if(now - w.lastTickAt > 38){
            w.lastTickAt = now
            play("wheelTickS", 0.92 + Math.random() * 0.16)
        }
    }

    // ── 3. landed ──
    function land(){
        w.state = "landed"
        w.since = performance.now()
        sweep.visibility = 0
        const i = w.result
        const token = tokens[i]
        play("wheelLandS")
        addCameraTrauma(scene, 0.22)
        punchCameraFov(scene, 0.035)
        tokenState.forEach((ts, j) => { ts.dim = j === i ? 1 : 0.35 })
        if(token){
            const at = token.getAbsolutePosition().clone()
            popPlane(scene, "star", GOLDEN.core, at, { from: 0.4, to: 2.4, ms: 360, spin: 0.7, group: 0 })
            sparkBurst(scene, at, GOLD, { count: 30, power: 4.5, size: [0.05, 0.13], life: [0.3, 0.6] })
        }
        const socketAt = Vector3.TransformCoordinates(slotAt(i, SLOT_RADIUS * RADIUS), root.computeWorldMatrix(true))
        lightPillar(scene, () => socketAt, GOLD, { height: 5, radius: 0.35, ms: 900, mode: "up", alpha: 0.85 })
        popShockRing(scene, socketAt, { size: 2.2, seconds: 0.45, color: GOLD })
        later(scene, LAND_HOLD_MS, collect)
    }

    // ── 4. paying out ──
    function collect(){
        if(w.state !== "landed") return
        w.state = "collecting"
        w.since = performance.now()
        const token = tokens[w.result]
        play("blessDrawS")
        if(!token) return impact()
        const from = token.getAbsolutePosition().clone()
        token.setParent(null)
        token.position.copyFrom(from)
        const startScale = token.scaling.x
        const prev = from.clone()
        const now = from.clone()
        const trail = fireParticles(scene, "fortune.trail", 160, "flare", now)
        trail.startPositionFunction = (matrix, position) => Vector3.LerpToRef(prev, now, Math.random(), position)
        trail.startDirectionFunction = (matrix, direction) => direction.set(Math.random() * 0.3 - 0.15, Math.random() * 0.3 - 0.15, Math.random() * 0.3 - 0.15)
        trail.minEmitPower = trail.maxEmitPower = 1
        trail.minLifeTime = 0.25
        trail.maxLifeTime = 0.4
        trail.addSizeGradient(0, 0.1, 0.16)
        trail.addSizeGradient(1, 0, 0.02)
        trail.addColorGradient(0, c4(GOLDEN.core, 1))
        trail.addColorGradient(0.4, c4(GOLD, 0.85))
        trail.addColorGradient(1, c4(GOLDEN.deep, 0))
        trail.emitRate = 360
        trail.start()
        animate(scene, COLLECT_MS, k => {
            const e = easeInCubic(k)
            const to = view.chest
            // up and over, then down into them
            const lift = 0.9
            prev.copyFrom(now)
            now.set(
                from.x + (to.x - from.x) * e,
                from.y + (to.y - from.y) * e + lift * Math.sin(Math.PI * Math.min(1, k * 1.1)),
                from.z + (to.z - from.z) * e,
            )
            token.position.copyFrom(now)
            token.scaling.setAll(startScale * (1 - 0.75 * e))
            token.rotation.z = -Math.PI * 2 * e
            token.visibility = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25
        }, { onEnd: () => {
            trail.stop()
            if(!token.isDisposed()) token.dispose()
            tokens[w.result] = null
            impact()
        } })
    }
    function impact(){
        if(w.state === "gone") return
        const type = rewards[w.result]?.type
        const at = view.chest.clone()
        sparkBurst(scene, at, WHITE, { count: 14, power: 7, size: [0.03, 0.07], life: [0.12, 0.3] })
        shockRipple(scene, at, { radius: 3, ms: 450, strength: 0.5, thickness: 0.8, chroma: 0.7, rim: 0.3, tint: GOLD })
        addCameraTrauma(scene, 0.25)
        punchCameraFov(scene, 0.035)
        play("blessAbsorbS")
        // the reward itself - skillWheel.js's
        let result = null
        try {
            result = w.callbacks?.onImpact?.() ?? null
        } catch(error){
            console.error("[fortuneWheel] reward", error)
        }
        try {
            const words = PAYOUT[type]?.({ scene, player, chest, feet }, result)
            if(words?.length) say(words)
        } catch(error){
            console.error("[fortuneWheel] payout", error)
        }
        close()
    }
    // words over their head, rising and fading
    async function say(parts){
        let mesh
        try {
            mesh = await createRewardText(scene, parts)
        } catch(error){
            return console.error("[fortuneWheel] words", error)
        }
        if(scene.isDisposed) return mesh.dispose()
        mesh.renderingGroupId = 1
        const head = view.head.clone()
        const planeHeight = 4 * 200 / 1024
        animate(scene, 1900, k => {
            if(w.state !== "gone") head.copyFrom(view.head)
            const pop = k < 0.07 ? 1.15 * easeOutBack(k / 0.07) : k < 0.14 ? 1.15 - 0.15 * (k - 0.07) / 0.07 : 1
            const at = head.add(new Vector3(0, 0.6 + 0.35 * easeOutCubic(k), 0))
            mesh.position.copyFrom(at)
            mesh.scaling.setAll(Math.max(0.01, pop * sized(at, TEXT_SHARE) / planeHeight))
            mesh.visibility = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1
        }, { onEnd: () => mesh.dispose() })
    }

    // ── closing ──
    function close(){
        w.state = "closing"
        w.since = performance.now()
        popShockRing(scene, root.position.clone(), { size: RADIUS * 2.2, seconds: 0.6, color: GOLD })
        motes(scene, () => root.position, GOLDEN, { ms: 500, rate: 60, radius: RADIUS * 0.8 })
    }

    // ── every frame ──
    function frame(){
        if(player.body.isDisposed() || !scene.activeCamera) return abort()
        const now = performance.now()
        const dt = Math.min(0.05, Math.max(0, (now - w.last) / 1000))
        w.last = now
        measure()
        const t = now - w.since
        // it follows them - its hub stays under their feet
        if(w.state !== "loading"){
            const k = 1 - Math.exp(-dt * 6)
            root.position.x += (view.feet.x - root.position.x) * k
            root.position.z += (view.feet.z - root.position.z) * k
            root.position.y += (view.feet.y + 0.03 - root.position.y) * k
        }

        let scale = 1
        let fade = 1
        if(w.state === "opening"){
            const k = Math.min(1, t / OPEN_MS)
            scale = Math.max(0.001, easeOutBack(Math.min(1, k / 0.8)))
            root.rotation.y = facing - (1 - easeOutCubic(k)) * 1.3
            fade = Math.min(1, k * 3)
            if(k >= 1){
                w.state = "waiting"
                w.since = now
                root.rotation.y = facing
                if(w.wantsSpin){
                    w.wantsSpin = false
                    onSpinRequest?.()
                }
            }
        } else if(w.state === "closing"){
            const k = Math.min(1, t / CLOSE_MS)
            scale = 1 - 0.45 * easeInCubic(k)
            fade = 1 - k
            root.rotation.y = facing - 0.9 * easeInCubic(k)
            if(k >= 1) return finish()
        }
        root.scaling.setAll(scale)
        if(face) face.visibility = fade

        // the hand
        let speed = 0
        const before = w.angle
        if(w.state === "waiting" || w.state === "opening"){
            // at rest on twelve, stirring
            w.angle = 0.06 * Math.sin(now / 420) * Math.min(1, t / 400)
        } else if(w.state === "spinning"){
            const k = Math.min(1, t / SPIN_MS)
            if(t < SPIN_MS) w.angle = w.from + (w.target - w.from) * spinCurve(k)
            else {
                // settling on its peg - a little shiver back and forth
                const e = t - SPIN_MS
                w.angle = w.target + 0.05 * Math.exp(-e / 110) * Math.sin(e / 32)
                if(e >= SETTLE_MS){
                    w.angle = w.target
                    land()
                }
            }
            speed = dt > 0 ? Math.abs(w.angle - before) / dt : 0
            const peg = pegOf(w.angle)
            if(peg !== w.lastPeg){
                // every peg passed since the last frame - the slot it's now over flashes
                w.lastPeg = peg
                const n = rewards.length
                tick(((peg % n) + n) % n, now)
            }
        }
        handPivot.rotation.y = w.angle
        tipTrail.step(before, w.angle, w.state === "spinning" ? speed : 0)
        hand.visibility = fade
        gem.visibility = fade * (0.55 + 0.35 * Math.sin(now / 140))
        sweep.visibility = Math.min(0.9, speed / 22) * fade

        // the slots: their glow, flashing as the hand passes; the rewards
        // floating over them, bobbing, popping on a pass
        const handNow = ((w.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
        rewards.forEach((reward, i) => {
            const s = sockets[i]
            s.flash = Math.max(0, s.flash - dt * 4)
            const ts = tokenState[i]
            ts.flash = Math.max(0, ts.flash - dt * 5)
            const winner = (w.state === "landed" || w.state === "collecting") && i === w.result
            s.light.visibility = fade * Math.min(1, (winner ? 1 : 0.28 * ts.dim) + 0.8 * s.flash + (w.state === "waiting" ? 0.12 * Math.sin(now / 300 + i) : 0))
            // the lamps chase the hand round the rim; waiting, a slow wave runs round them
            const off = Math.abs(((handNow - i * SLOT + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI)
            const near = Math.pow(Math.max(0, Math.cos(off)), 6)
            const wave = 0.3 + 0.3 * Math.max(0, Math.cos(now / 350 - i * SLOT))
            lamps[i].visibility = fade * (w.state === "spinning" ? 0.25 + 0.75 * near : winner ? 1 : wave)
            const token = tokens[i]
            if(!token || token.parent !== root) return
            const popAt = TOKEN_POP_AT + i * TOKEN_POP_GAP
            const sincePop = w.state === "opening" ? t - popAt : TOKEN_POP_MS
            const grow = sincePop <= 0 ? 0 : easeOutBack(Math.min(1, sincePop / TOKEN_POP_MS))
            const bump = 1 + 0.25 * ts.flash + (winner ? 0.3 : 0)
            token.isVisible = grow > 0.001
            token.scaling.setAll(Math.max(0.001, TOKEN_SIZE * grow * bump))
            token.position.y = TOKEN_LIFT + 0.05 * Math.sin(now / 420 + i * 0.8) + (winner ? 0.25 * Math.min(1, (now - w.since) / 300) : 0)
            token.visibility = fade * ts.dim
        })

        // SPIN over their head, a share of the screen, beating gently
        if(prompt && (w.state === "waiting" || w.state === "opening")){
            const at = view.head.add(new Vector3(0, 1.05, 0))
            prompt.position.copyFrom(at)
            const appear = w.state === "waiting" ? easeOutBack(Math.min(1, t / 260)) : 0
            prompt.isVisible = appear > 0.001
            const beat = 1 + 0.04 * Math.sin(now / 170)
            prompt.scaling.setAll(Math.max(0.001, appear * beat * sized(at, PROMPT_SHARE) / (2 * 360 / 512)))
            prompt.visibility = 1
        }
    }

    function finish(){
        const closed = w.callbacks?.onClosed
        teardown()
        try { closed?.() } catch(error){ console.error("[fortuneWheel] onClosed", error) }
    }
    // gone before it could finish - the place changed under it, or they did
    function abort(){
        if(w.state === "gone") return
        const decided = w.decided
        const impacted = w.state === "closing"
        const closed = w.callbacks?.onClosed
        teardown()
        // already paid out - only the closing was cut short
        if(impacted){
            try { closed?.() } catch(error){ console.error("[fortuneWheel] onClosed", error) }
            return
        }
        try { onGone?.(decided) } catch(error){ console.error("[fortuneWheel] onGone", error) }
    }
    function teardown(){
        w.state = "gone"
        if(!scene.isDisposed){
            scene.onBeforeRenderObservable.remove(observer)
            scene.onDisposeObservable.remove(sceneGone)
        }
        if(!player.body.isDisposed()) player.body.onDisposeObservable.remove(bodyGone)
        window.removeEventListener("pointerdown", onDown, true)
        window.removeEventListener("pointerup", onUp, true)
        window.removeEventListener("keydown", onKey)
        tipTrail.stop()
        tokens.forEach(token => { if(token && !token.isDisposed()) token.dispose() })
        if(prompt && !prompt.isDisposed()) prompt.dispose()
        if(!root.isDisposed()) root.dispose()
        if(open === api) open = null
    }

    const observer = scene.onBeforeRenderObservable.add(() => {
        try {
            frame()
        } catch(error){
            // an exception in a frame's observer stops the engine queueing frames
            console.error("[fortuneWheel]", error)
            abort()
        }
    })
    const sceneGone = scene.onDisposeObservable.add(() => abort())
    const bodyGone = player.body.onDisposeObservable.add(() => abort())

    const api = {
        spin,
        abort,
        get state(){ return w.state },
    }
    return api
}
