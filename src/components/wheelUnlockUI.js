import * as GUI from "@babylonjs/gui"
import { getSceneDet } from "../main/main.js"
import { getAllSounds } from "./soundSystem.js"
import { GOLD, GOLD_BRIGHT, FONT_TITLE, FONT_BODY } from "./guiKit.js"

// The notice that comes before a skill wheel spin - "Conditions Reached" over
// "Spinning Wheel Activated" on a dark gold-edged plate, centre screen a little
// above the middle. Fades in, holds, fades out, then calls onDone (which opens
// the wheel - characterstate.js's gainExp). Babylon GUI on the current scene,
// texture made per scene on first use, same as warningUI.js.

const WIDTH  = 380
const HEIGHT = 92
// how far above the screen's middle it sits
const ABOVE_CENTRE = 140
const FADE_MS = 350
const HOLD_MS = 2200

let state = null   // { scene, ui, root, timer, fade, pendingDone }

function getState(){
    const scene = getSceneDet()?.scene
    if(!scene) return null
    if(state?.scene === scene) return state

    const ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("wheelUnlockUI", true, scene)
    // a fullscreen GUI composites its layer every frame even when empty
    // (campcraft.js) - only on while the notice shows
    ui.layer.isEnabled = false

    const root = new GUI.Rectangle("wheelUnlock_root")
    root.width = `${WIDTH}px`
    root.height = `${HEIGHT}px`
    root.top = `${-ABOVE_CENTRE}px`
    root.thickness = 2
    root.color = GOLD
    root.background = "rgba(0,0,0,0.72)"
    root.cornerRadius = 6
    root.isHitTestVisible = false
    root.isVisible = false
    ui.addControl(root)

    const col = new GUI.StackPanel("wheelUnlock_col")
    col.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER
    root.addControl(col)

    const title = new GUI.TextBlock("wheelUnlock_title", "Conditions Reached")
    title.fontFamily = FONT_TITLE
    title.fontSize = 26
    title.color = GOLD_BRIGHT
    title.height = "38px"
    col.addControl(title)

    const sub = new GUI.TextBlock("wheelUnlock_sub", "Spinning Wheel Activated")
    sub.fontFamily = FONT_BODY
    sub.fontSize = 18
    sub.color = GOLD
    sub.height = "28px"
    col.addControl(sub)

    state = { scene, ui, root, timer: null, fade: null, pendingDone: null }
    const own = state
    scene.onDisposeObservable.add(() => {
        clearTimeout(own.timer)
        if(state === own) state = null
        // a place change mid-notice - the wheel is plain DOM, so it can
        // still open on the next scene instead of being lost with this one
        const done = own.pendingDone
        own.pendingDone = null
        done?.()
    })
    return state
}

// alpha at `ms` into the notice: fade in, hold, fade out
function alphaAt(ms){
    if(ms < FADE_MS) return ms / FADE_MS
    if(ms < FADE_MS + HOLD_MS) return 1
    return Math.max(0, 1 - (ms - FADE_MS - HOLD_MS) / FADE_MS)
}

// onDone runs once the notice is gone - or straight away if there's no scene
// to show it on, so the wheel is never lost
export function showWheelUnlockNotice(onDone){
    const s = getState()
    if(!s) return onDone?.()

    clearTimeout(s.timer)
    // a second milestone while one is showing (unlikely) - run the first's
    // onDone now rather than drop it
    const previous = s.pendingDone
    s.pendingDone = onDone
    previous?.()
    s.ui.layer.isEnabled = true
    s.root.isVisible = true
    getAllSounds().notif2S?.play()

    // the frames only draw the fade, off the clock - the timer below is what
    // ends it, so a hidden tab (no frames) still opens the wheel on time
    const start = performance.now()
    s.root.alpha = 0
    if(s.fade) s.scene.onBeforeRenderObservable.remove(s.fade)
    s.fade = s.scene.onBeforeRenderObservable.add(() => { s.root.alpha = alphaAt(performance.now() - start) })

    s.timer = setTimeout(() => {
        s.scene.onBeforeRenderObservable.remove(s.fade)
        s.fade = null
        s.root.isVisible = false
        s.ui.layer.isEnabled = false
        const done = s.pendingDone
        s.pendingDone = null
        done?.()
    }, FADE_MS * 2 + HOLD_MS)
}
