import { Mesh } from "@babylonjs/core"
import { Control, Ellipse, Image, LinearGradient, RadialGradient, Rectangle, StackPanel, TextBlock } from "@babylonjs/gui"
import { createMeshGui } from "./textmesh.js"

// THE FORTUNE WHEEL'S FACES - Babylon GUIs drawn on planes (gui/textmesh.js's
// createMeshGui, freed with their meshes) for effects/fortuneWheel.js, which
// lays them out round the player, turns and lights them:
//   createWheelFace     the wheel itself, lying face up (wheel.webp) - a gold
//                       socket in each of its eight wedges, the reward in it
//                       faintly engraved, turned to face out from the middle
//   createWheelToken    a reward floating over its wedge, facing the camera
//   createSpinPrompt    over their head: the level, a round SPIN button, a hint
//   createRewardText    over their head when it pays out - one line, each part
//                       in its own colours ("+50 HP  +50 MP  +50 SP")
// Slot i sits i x 45 degrees clockwise from the face's top (its texture's top,
// which effects/fortuneWheel.js turns to +z). Nothing here is ever picked by
// the scene - the wheel does its own picking.

export const FACE_TEX = 1024
// where the slots sit, and the hub's edge, as shares of the wheel's radius -
// the middle of wheel.webp's leather wedges, and its inner bronze ring
export const SLOT_RADIUS = 0.6
export const HUB_RADIUS = 0.33

const GOLD = "rgb(240, 204, 128)"

// the card fonts (style.css's Google Fonts) - a GUI drawn before they arrive
// keeps its fallback for good
let fontsLoading = null
function fontsReady(){
    if(!fontsLoading){
        const fonts = typeof document !== "undefined" ? document.fonts : null
        const loads = fonts?.load ? ['800 60px "Cinzel"', '700 30px "Cinzel"', '700 34px "Cormorant Garamond"'].map(font => fonts.load(font).catch(() => {})) : []
        fontsLoading = Promise.race([Promise.all(loads), new Promise(resolve => setTimeout(resolve, 1500))])
    }
    return fontsLoading
}
// resolves once every image is in (or soon after, if one never comes)
function allLoaded(images){
    return Promise.all(images.map(image => new Promise(resolve => {
        if(image.isLoaded) return resolve()
        image.onImageLoadedObservable.addOnce(() => resolve())
        setTimeout(resolve, 2500)
    })))
}
function standing(mesh){
    mesh.isPickable = false
    mesh.billboardMode = Mesh.BILLBOARDMODE_ALL
    mesh.material.disableLighting = true
    mesh.material.fogEnabled = false
    return mesh
}

/**
 * The wheel, face up: rewards[i].icon in slot i. Resolves once the fonts are
 * in, to { mesh, loaded } (loaded: once its pictures are, and its shader).
 */
export async function createWheelFace(scene, rewards){
    await fontsReady()
    const { mesh, ui } = createMeshGui("fortune.face", 1, FACE_TEX, FACE_TEX, scene)
    mesh.isPickable = false
    // lying down, face up, its texture's top toward +z
    mesh.rotation.x = Math.PI / 2
    const mat = mesh.material
    mat.disableLighting = true
    mat.fogEnabled = false
    // drawn just over the ground it lies on, never into it
    mat.zOffset = -2

    const art = new Image("wheel", "./images/UI/wheel.webp")
    art.stretch = Image.STRETCH_UNIFORM
    ui.addControl(art)
    const images = [art]

    const r = SLOT_RADIUS * FACE_TEX / 2
    rewards.forEach((reward, i) => {
        const a = (i * Math.PI) / 4
        const socket = new Ellipse(`socket${i}`)
        socket.width = socket.height = "164px"
        socket.thickness = 6
        socket.color = GOLD
        // parchment, warm in the middle - the rewards are dark pictures
        const sx = FACE_TEX / 2 + Math.sin(a) * r
        const sy = FACE_TEX / 2 - Math.cos(a) * r
        const fill = new RadialGradient(sx, sy, 0, sx, sy, 82)
        fill.addColorStop(0, "rgba(232, 204, 150, 0.95)")
        fill.addColorStop(0.65, "rgba(170, 126, 66, 0.95)")
        fill.addColorStop(1, "rgba(70, 46, 18, 0.97)")
        socket.backgroundGradient = fill
        socket.left = `${Math.sin(a) * r}px`
        socket.top = `${-Math.cos(a) * r}px`
        socket.shadowColor = "rgba(255, 200, 110, 0.8)"
        socket.shadowBlur = 18
        // the reward engraved in it, its top pointing out from the middle
        const glyph = new Image(`glyph${i}`, reward.icon)
        glyph.width = glyph.height = "124px"
        glyph.alpha = 0.85
        glyph.rotation = a
        socket.addControl(glyph)
        images.push(glyph)
        ui.addControl(socket)
    })
    const compiled = mat.forceCompilationAsync(mesh).catch(() => {})
    return { mesh, loaded: Promise.all([allLoaded(images), compiled]) }
}

/** A reward floating over its wedge: its picture in a gold-rimmed disc. 1 across. */
export async function createWheelToken(scene, icon, index){
    const { mesh, ui } = createMeshGui(`fortune.token.${index}`, 1, 192, 192, scene)
    standing(mesh)
    // a gold-rimmed disc of warm parchment - the reward pictures are dark
    const disc = new Ellipse("disc")
    disc.width = disc.height = "178px"
    disc.thickness = 8
    disc.color = GOLD
    const fill = new RadialGradient(96, 82, 4, 96, 96, 90)
    fill.addColorStop(0, "rgba(255, 246, 222, 0.98)")
    fill.addColorStop(0.6, "rgba(226, 192, 128, 0.98)")
    fill.addColorStop(1, "rgba(128, 86, 34, 0.98)")
    disc.backgroundGradient = fill
    disc.shadowColor = "rgba(255, 200, 110, 0.9)"
    disc.shadowBlur = 10
    const image = new Image("icon", icon)
    image.width = image.height = "142px"
    disc.addControl(image)
    ui.addControl(disc)
    const compiled = mesh.material.forceCompilationAsync(mesh).catch(() => {})
    return { mesh, loaded: Promise.all([allLoaded([image]), compiled]) }
}

/**
 * Over their head while the wheel waits: "LEVEL 20 REWARD", a round red SPIN
 * button rimmed in gold (the old GO button's look), "TAP THE WHEEL". 2 wide.
 */
export async function createSpinPrompt(scene, level){
    await fontsReady()
    const W = 512, H = 360
    const { mesh, ui } = createMeshGui("fortune.prompt", 2, W, H, scene)
    standing(mesh)
    const caption = new TextBlock("caption", level ? `LEVEL ${level} REWARD` : "FORTUNE'S WHEEL")
    caption.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
    caption.top = "0px"
    caption.height = "62px"
    caption.fontFamily = "Cinzel, serif"
    caption.fontWeight = "800"
    caption.fontSize = 44
    caption.color = GOLD
    caption.outlineWidth = 8
    caption.outlineColor = "rgba(20, 10, 2, 0.95)"
    caption.shadowColor = "rgba(255, 190, 90, 0.9)"
    caption.shadowBlur = 16
    ui.addControl(caption)

    const button = new Ellipse("button")
    button.width = button.height = "200px"
    button.top = "4px"
    button.thickness = 9
    button.color = GOLD
    const red = new RadialGradient(W / 2, H / 2 - 20, 8, W / 2, H / 2 + 8, 110)
    red.addColorStop(0, "rgb(236, 72, 60)")
    red.addColorStop(0.55, "rgb(150, 24, 22)")
    red.addColorStop(1, "rgb(70, 8, 8)")
    button.backgroundGradient = red
    button.shadowColor = "rgba(255, 70, 50, 0.9)"
    button.shadowBlur = 30
    const word = new TextBlock("spin", "SPIN")
    word.fontFamily = "Cinzel, serif"
    word.fontWeight = "800"
    word.fontSize = 62
    word.color = "#fff6e8"
    word.outlineWidth = 8
    word.outlineColor = "rgba(40, 4, 2, 0.95)"
    button.addControl(word)
    ui.addControl(button)

    const hint = new TextBlock("hint", "TAP THE WHEEL")
    hint.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM
    hint.height = "52px"
    hint.top = "0px"
    hint.fontFamily = '"Cormorant Garamond", serif'
    hint.fontWeight = "700"
    hint.fontSize = 42
    hint.color = "#ffe9b8"
    hint.outlineWidth = 6
    hint.outlineColor = "rgba(10, 5, 0, 0.9)"
    ui.addControl(hint)
    mesh.material.forceCompilationAsync(mesh).catch(() => {})
    return mesh
}

/**
 * One line of words over their head - parts: [{ text, colors: [top, middle,
 * bottom] }] side by side, each filled top to bottom in its colours, outlined
 * dark, glowing. 4 wide.
 */
export async function createRewardText(scene, parts, { glow = "rgba(255, 196, 80, 0.95)" } = {}){
    await fontsReady()
    const W = 1024, H = 200
    const { mesh, ui } = createMeshGui("fortune.text", 4, W, H, scene)
    standing(mesh)
    const row = new StackPanel("row")
    row.isVertical = false
    row.height = `${H}px`
    // as big as the whole line fits
    const measure = document.createElement("canvas").getContext("2d")
    const line = parts.map(part => part.text).join("")
    let size = 90
    for(; size > 40; size -= 2){
        measure.font = `800 ${size}px Cinzel`
        if(measure.measureText(line).width <= W - 70) break
    }
    parts.forEach((part, i) => {
        // the gap between parts as padding - the GUI trims a part's trailing
        // spaces (even an en space), so "+50 HP" ran into "+50 MP"
        const words = new TextBlock(`part${i}`, part.text.trim())
        words.resizeToFit = true
        if(i > 0) words.paddingLeft = `${Math.round(size * 0.38)}px`
        words.fontFamily = "Cinzel, serif"
        words.fontWeight = "800"
        words.fontSize = size
        const [top, middle, bottom] = part.colors
        const fill = new LinearGradient(0, H / 2 - size * 0.55, 0, H / 2 + size * 0.55)
        fill.addColorStop(0, top)
        fill.addColorStop(0.5, middle)
        fill.addColorStop(1, bottom)
        words.gradient = fill
        words.color = middle
        words.outlineWidth = 12
        words.outlineColor = "#160b03"
        words.shadowColor = glow
        words.shadowBlur = 26
        row.addControl(words)
    })
    ui.addControl(row)
    mesh.material.forceCompilationAsync(mesh).catch(() => {})
    return mesh
}
