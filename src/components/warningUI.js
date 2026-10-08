import * as GUI from "@babylonjs/gui"
import { getSceneDet } from "../main/main.js"
import { GOLD_BRIGHT, FONT_BODY } from "./guiKit.js"

// A small warning - the warning sign and a short label ("Find Food") on a
// dark plate, centre screen a little above the middle, blinking WARNING_BLINKS
// times and then gone. Babylon GUI, on the current scene: every place change
// builds a new scene (and disposes the old one's GUI with it), so the texture
// is made per scene, on first use.
//
// Calling it again while one is still blinking restarts it with the new label.

const WIDTH  = 200
const HEIGHT = 40
const ICON   = 26
// how far above the screen's middle it sits
const ABOVE_CENTRE = 120
const WARNING_BLINKS = 5
const BLINK_ON_MS  = 420
const BLINK_OFF_MS = 260

let state = null   // { scene, ui, label, root, timer }

function getState(){
    const scene = getSceneDet()?.scene
    if(!scene) return null
    if(state?.scene === scene) return state

    const ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("warningUI", true, scene)
    // a fullscreen GUI composites its layer every frame even when empty
    // (campcraft.js) - only on while a warning shows
    ui.layer.isEnabled = false

    const root = new GUI.Rectangle("warning_root")
    root.width = `${WIDTH}px`
    root.height = `${HEIGHT}px`
    root.top = `${-ABOVE_CENTRE}px`
    root.thickness = 1
    root.color = "rgba(224,85,85,0.75)"
    root.background = "rgba(0,0,0,0.6)"
    root.cornerRadius = 4
    root.isHitTestVisible = false
    root.isVisible = false
    ui.addControl(root)

    const row = new GUI.StackPanel("warning_row")
    row.isVertical = false
    row.height = `${HEIGHT}px`
    row.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER
    root.addControl(row)

    const icon = new GUI.Image("warning_icon", "./images/UI/warning.webp")
    icon.width = `${ICON + 8}px`
    icon.height = `${ICON}px`
    icon.paddingRight = "8px"
    icon.stretch = GUI.Image.STRETCH_UNIFORM
    row.addControl(icon)

    const label = new GUI.TextBlock("warning_label", "")
    label.fontFamily = FONT_BODY
    label.fontSize = 17
    label.color = GOLD_BRIGHT
    label.resizeToFit = true
    label.height = `${HEIGHT}px`
    row.addControl(label)

    state = { scene, ui, root, label, timer: null }
    scene.onDisposeObservable.add(() => {
        clearTimeout(state?.timer)
        if(state?.scene === scene) state = null
    })
    return state
}

// labelName - what to do about it, e.g. "Find Food", "Find Warmth"
export function showWarning(labelName = "Find Food"){
    const s = getState()
    if(!s) return

    clearTimeout(s.timer)
    s.label.text = labelName
    s.ui.layer.isEnabled = true

    let blinksLeft = WARNING_BLINKS
    const on = () => {
        s.root.isVisible = true
        s.timer = setTimeout(off, BLINK_ON_MS)
    }
    const off = () => {
        s.root.isVisible = false
        if(--blinksLeft > 0){
            s.timer = setTimeout(on, BLINK_OFF_MS)
        } else {
            s.ui.layer.isEnabled = false
            s.timer = null
        }
    }
    on()
}
