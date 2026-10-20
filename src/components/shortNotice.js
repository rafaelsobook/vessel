import * as GUI from "@babylonjs/gui"
import { getSceneDet } from "../main/main.js"
import { getAllSounds } from "./soundSystem.js"

// A one-line notice in a gold frame - showShortNotice("conditions reached",
// onDone): the round exclamation mark (images/UI/mark.webp) on the left, the
// text in spaced gold capitals, a little above the middle of the screen. Fades
// in, holds, fades out, then calls onDone - the skill wheel opens from there
// (characterstate.js's gainExp). Notices that come while one is showing wait
// their turn. Babylon GUI on the current scene, its texture made per scene on
// first use, same as warningUI.js.

const FRAME_IMG = "./images/UI/shortnotice.webp"
const MARK_IMG = "./images/UI/mark.webp"
// shortnotice.webp is 2172x344 - its two rounded ends are drawn as they are
// (the first and last END_SRC pixels) and only the straight bars between them
// stretch, so a longer text widens the frame without squashing its ends
const FRAME_SRC_W = 2172
const FRAME_SRC_H = 344
const END_SRC = 260

const HEIGHT = 56
const END_W = Math.round(END_SRC * HEIGHT / FRAME_SRC_H)
// the mark sits inside the left end; mark.webp's circle fills ~86% of it
const MARK_SIZE = HEIGHT
const MARK_LEFT = 22
const TEXT_GAP = 12      // mark -> text
const TEXT_RIGHT = 34    // text -> the right end's inner curve
const MIN_WIDTH = 300

const FONT_FAMILY = "'Cormorant Garamond', serif"
const FONT_WEIGHT = "700"
const FONT_SIZE = 21
const TEXT_COLOR = "#e9c97c"

// how far above the screen's middle it sits
const ABOVE_CENTRE = 140
const FADE_MS = 350
const HOLD_MS = 2200

// Babylon GUI has no letter spacing - thin spaces between the letters (and a
// wider gap between words) give the capitals their engraved look
const THIN = " "
function spaced(text){
    return text.toUpperCase().split(" ").map(word => [...word].join(THIN)).join(THIN + " " + THIN)
}

// the text's drawn width, measured the way the GUI will draw it - the font is
// asked for up front (below) so it's in by the first notice
const measureCtx = document.createElement("canvas").getContext("2d")
function textWidth(text){
    measureCtx.font = `${FONT_WEIGHT} ${FONT_SIZE}px ${FONT_FAMILY}`
    return Math.ceil(measureCtx.measureText(text).width)
}
document.fonts?.load(`${FONT_WEIGHT} ${FONT_SIZE}px ${FONT_FAMILY}`).catch(() => {})

let state = null   // { scene, ui, root, frameMid, label, timer, fade, current, queue }

function frameSlice(name, srcLeft, srcWidth){
    const img = new GUI.Image(name, FRAME_IMG)
    img.sourceLeft = srcLeft
    img.sourceTop = 0
    img.sourceWidth = srcWidth
    img.sourceHeight = FRAME_SRC_H
    img.stretch = GUI.Image.STRETCH_FILL
    img.height = `${HEIGHT}px`
    return img
}

function getState(){
    const scene = getSceneDet()?.scene
    if(!scene) return null
    if(state?.scene === scene) return state

    const ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("shortNoticeUI", true, scene)
    // a fullscreen GUI composites its layer every frame even when empty
    // (campcraft.js) - only on while a notice shows
    ui.layer.isEnabled = false

    const root = new GUI.Container("shortNotice_root")
    root.height = `${HEIGHT}px`
    root.top = `${-ABOVE_CENTRE}px`
    root.isHitTestVisible = false
    root.isVisible = false
    ui.addControl(root)

    // the dark inside, a stadium just within the frame's inner edge
    const fill = new GUI.Rectangle("shortNotice_fill")
    fill.width = `calc(100% - 12px)`
    fill.height = `${HEIGHT - 8}px`
    fill.cornerRadius = (HEIGHT - 8) / 2
    fill.thickness = 0
    fill.background = "rgba(12,10,7,0.88)"
    root.addControl(fill)

    const frameLeft = frameSlice("shortNotice_frameL", 0, END_SRC)
    frameLeft.width = `${END_W}px`
    frameLeft.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    // the middle runs a pixel under each end so no seam shows between them
    const frameMid = frameSlice("shortNotice_frameM", END_SRC, FRAME_SRC_W - END_SRC * 2)
    const frameRight = frameSlice("shortNotice_frameR", FRAME_SRC_W - END_SRC, END_SRC)
    frameRight.width = `${END_W}px`
    frameRight.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT
    root.addControl(frameMid)
    root.addControl(frameLeft)
    root.addControl(frameRight)

    const mark = new GUI.Image("shortNotice_mark", MARK_IMG)
    mark.width = `${MARK_SIZE}px`
    mark.height = `${MARK_SIZE}px`
    mark.left = `${MARK_LEFT}px`
    mark.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    root.addControl(mark)

    const label = new GUI.TextBlock("shortNotice_text", "")
    label.fontFamily = FONT_FAMILY
    label.fontWeight = FONT_WEIGHT
    label.fontSize = FONT_SIZE
    label.color = TEXT_COLOR
    label.shadowColor = "rgba(0,0,0,0.9)"
    label.shadowBlur = 4
    label.shadowOffsetY = 1
    label.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    label.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    label.left = `${MARK_LEFT + MARK_SIZE + TEXT_GAP}px`
    root.addControl(label)

    state = { scene, ui, root, frameMid, label, timer: null, fade: null, current: null, queue: [] }
    const own = state
    scene.onDisposeObservable.add(() => {
        clearTimeout(own.timer)
        if(state === own) state = null
        // a place change mid-notice - whatever was waiting on these still
        // happens (the wheel is plain DOM, it opens on the next scene)
        const pending = [own.current, ...own.queue].filter(Boolean)
        own.current = null
        own.queue = []
        pending.forEach(n => n.onDone?.())
    })
    return state
}

// alpha at `ms` into the notice: fade in, hold, fade out
function alphaAt(ms){
    if(ms < FADE_MS) return ms / FADE_MS
    if(ms < FADE_MS + HOLD_MS) return 1
    return Math.max(0, 1 - (ms - FADE_MS - HOLD_MS) / FADE_MS)
}
// a small settle on the way in - 0.94 up to full size over the fade
function scaleAt(ms){
    const t = Math.min(1, ms / FADE_MS)
    return 0.94 + 0.06 * (1 - (1 - t) * (1 - t))
}

function play(s, notice){
    s.current = notice
    const text = spaced(notice.text)
    s.label.text = text
    const textW = textWidth(text)
    const width = Math.max(MIN_WIDTH, MARK_LEFT + MARK_SIZE + TEXT_GAP + textW + TEXT_RIGHT)
    s.root.width = `${width}px`
    s.frameMid.width = `${width - END_W * 2 + 2}px`
    s.label.width = `${textW + 8}px`

    s.ui.layer.isEnabled = true
    s.root.isVisible = true
    getAllSounds().notif2S?.play()

    // the frames only draw the fade, off the clock - the timer below is what
    // ends it, so a hidden tab (no frames) still calls onDone on time
    const start = performance.now()
    s.root.alpha = 0
    if(s.fade) s.scene.onBeforeRenderObservable.remove(s.fade)
    s.fade = s.scene.onBeforeRenderObservable.add(() => {
        const ms = performance.now() - start
        s.root.alpha = alphaAt(ms)
        s.root.scaleX = s.root.scaleY = scaleAt(ms)
    })

    s.timer = setTimeout(() => {
        s.scene.onBeforeRenderObservable.remove(s.fade)
        s.fade = null
        const done = s.current
        s.current = null
        const next = s.queue.shift()
        if(next) play(s, next)
        else {
            s.root.isVisible = false
            s.ui.layer.isEnabled = false
        }
        done?.onDone?.()
    }, FADE_MS * 2 + HOLD_MS)
}

// text - shown in capitals, e.g. "conditions reached". onDone runs once the
// notice is gone - or straight away if there's no scene to show it on, so
// whatever waits on it is never lost
export function showShortNotice(text, onDone){
    const s = getState()
    if(!s) return onDone?.()
    const notice = { text, onDone }
    if(s.current) s.queue.push(notice)
    else play(s, notice)
}
