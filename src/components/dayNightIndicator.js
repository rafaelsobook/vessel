import * as GUI from "@babylonjs/gui"
import { GOLD_BRIGHT, TEXT_BODY } from "./guiKit.js"

// The world clock on screen - top centre, hanging under the weather badge
// (index.html's .weather-indicator): the moon, a timeline bar, the sun, and
// a small marker sliding along the bar with the time of day, over a plate
// reading "Night / 02:15 AM".
//
// The bar is one day, starting where night does: its left end is sunset
// (6 PM), so its left half - painted night blue, by the moon - is the night
// and its right half - painted orange, by the sun - is the day, with sunrise
// (6 AM) in the grey middle. The marker crosses it left to right, reaching the
// right end at the next sunset and starting over from the left. (Starting it
// at midnight instead put the whole morning in the blue night half.)
//
// Babylon GUI, but it follows the HTML weather badge: shown whenever that
// is (both live in DAYNIGHT_AREA_TYPES only, and the badge is already hidden
// for cutscenes, resting and the HUD toggle - uimanagement.js's
// hideShowAllScreenUI), and placed right under wherever it sits.
//
// A fullscreen GUI texture is redrawn and re-uploaded whenever anything on
// it changes, so nothing is touched per frame unless it actually moved: the
// marker steps a fraction of a pixel per real second (a 24-minute day across
// a few hundred pixels) and the time text changes once per game minute.

const ICONS = "./images/UI/daynightcycle/"
const BAR_WIDTH   = 380
// timelinebar.webp is 2172x188
const BAR_HEIGHT  = Math.round(BAR_WIDTH * 188 / 2172)
const ICON_SIZE   = 46
// where the bar's glowing line runs, as fractions of the image: across
// (its tapered tips are left out) and down
const TRACK_FROM  = 0.03
const TRACK_TO    = 0.97
const TRACK_Y     = 0.69
// the time of day at the bar's left end - sunset (dayNightSystem.js: 0.25
// sunrise, 0.75 sunset)
const BAR_STARTS_AT = 0.75
const MARKER_KNOB  = 9
const MARKER_STICK = 15
const PLATE_WIDTH  = 150
const PLATE_HEIGHT = 46
const GAP_UNDER_BADGE = 2
// with no badge to hang from (it hasn't laid out yet), this far from the top
const FALLBACK_TOP = 56
const CHECK_VISIBILITY_EVERY = 15
// the icons glow for their half of the day and dim for the other
const ICON_DIM = 0.45

// [from hour, name] - the period the clock is in reads under the bar
const PERIODS = [
    [0, "Night"], [5, "Dawn"], [7, "Morning"], [11, "Midday"],
    [13, "Afternoon"], [17, "Dusk"], [19, "Evening"], [21, "Night"],
]

function periodOf(hour){
    let name = PERIODS[0][1]
    for(const [from, label] of PERIODS) if(hour >= from) name = label
    return name
}

// "02:15 AM"
function clockText(timeOfDay){
    const minutes = Math.floor(timeOfDay * 24 * 60) % (24 * 60)
    const h24 = Math.floor(minutes / 60)
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12
    return `${String(h12).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`
}

// getTimeOfDay: 0..1, 0 = midnight. getDaylight: 0 night .. 1 day.
// Lives and dies with the scene (the GUI texture and the observer are both
// the scene's).
export function startDayNightIndicator(scene, { getTimeOfDay, getDaylight }){
    const badge = document.querySelector(".weather-indicator")
    const ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("dayNightUI", true, scene)

    const root = new GUI.StackPanel("dayNight_root")
    root.isVertical = true
    root.width = `${BAR_WIDTH + ICON_SIZE * 2}px`
    root.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP
    root.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER
    root.isPointerBlocker = false
    root.isHitTestVisible = false
    ui.addControl(root)

    // ── moon | bar | sun ─────────────────────────────────────────────────────
    const row = new GUI.Rectangle("dayNight_row")
    row.thickness = 0
    row.height = `${ICON_SIZE}px`
    root.addControl(row)

    const icon = (name, file, align) => {
        const img = new GUI.Image(name, ICONS + file)
        img.width = img.height = `${ICON_SIZE}px`
        img.stretch = GUI.Image.STRETCH_UNIFORM
        img.horizontalAlignment = align
        row.addControl(img)
        return img
    }
    const moon = icon("dayNight_moon", "moon.webp", GUI.Control.HORIZONTAL_ALIGNMENT_LEFT)
    const sun  = icon("dayNight_sun", "sun.webp", GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT)

    const bar = new GUI.Image("dayNight_bar", ICONS + "timelinebar.webp")
    bar.width = `${BAR_WIDTH}px`
    bar.height = `${BAR_HEIGHT}px`
    bar.stretch = GUI.Image.STRETCH_FILL
    // the line sits low in the image - drop the bar so the line meets the
    // icons' middles, like the mockup
    bar.top = `${Math.round(BAR_HEIGHT / 2 - BAR_HEIGHT * TRACK_Y)}px`
    row.addControl(bar)

    // the marker: a small upright line with a bright knob on top, its foot on
    // the bar's line. Positioned from the row's left edge.
    const marker = new GUI.Rectangle("dayNight_marker")
    marker.thickness = 0
    marker.width = `${MARKER_KNOB}px`
    marker.height = `${MARKER_KNOB + MARKER_STICK}px`
    marker.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    marker.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP
    const barTopInRow = (ICON_SIZE - BAR_HEIGHT) / 2 + parseFloat(bar.top)
    marker.top = `${Math.round(barTopInRow + BAR_HEIGHT * TRACK_Y - (MARKER_KNOB + MARKER_STICK))}px`
    row.addControl(marker)

    const stick = new GUI.Rectangle("dayNight_marker_stick")
    stick.width = "2px"
    stick.height = `${MARKER_STICK}px`
    stick.thickness = 0
    stick.background = GOLD_BRIGHT
    stick.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM
    marker.addControl(stick)

    const knob = new GUI.Ellipse("dayNight_marker_knob")
    knob.width = knob.height = `${MARKER_KNOB}px`
    knob.thickness = 1
    knob.color = GOLD_BRIGHT
    knob.background = "#fff8e6"
    knob.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP
    knob.shadowColor = "rgba(255,230,160,0.9)"
    knob.shadowBlur = 8
    marker.addControl(knob)

    // ── "Night / 02:15 AM" plate ─────────────────────────────────────────────
    // the weather badge's own look (style.scss's .weather-indicator)
    const plateHolder = new GUI.Rectangle("dayNight_plateHolder")
    plateHolder.thickness = 0
    plateHolder.height = `${PLATE_HEIGHT + 4}px`
    root.addControl(plateHolder)

    const plate = new GUI.Rectangle("dayNight_plate")
    plate.width = `${PLATE_WIDTH}px`
    plate.height = `${PLATE_HEIGHT}px`
    plate.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM
    plate.background = "rgba(0,0,0,0.45)"
    plate.color = "rgba(202,165,1,0.35)"
    plate.thickness = 1
    plate.cornerRadius = 4
    plateHolder.addControl(plate)

    const period = new GUI.TextBlock("dayNight_period", "")
    period.fontFamily = "Caudex, serif"
    period.fontSize = 16
    period.color = GOLD_BRIGHT
    period.height = "22px"
    period.top = "-9px"
    plate.addControl(period)

    const time = new GUI.TextBlock("dayNight_time", "")
    time.fontFamily = "Caudex, serif"
    time.fontSize = 14
    time.color = TEXT_BODY
    time.height = "20px"
    time.top = "11px"
    plate.addControl(time)

    // ── keeping it current ───────────────────────────────────────────────────
    const trackFrom = ICON_SIZE + BAR_WIDTH * TRACK_FROM
    const trackLen  = BAR_WIDTH * (TRACK_TO - TRACK_FROM)
    let shownLeft = null
    let shownMinute = null
    let shownIconAlpha = null
    let visible = null
    let frame = 0

    const placeUnderBadge = () => {
        // GUI pixels are the render target's; the badge is in CSS pixels
        const canvas = scene.getEngine().getRenderingCanvas()
        const scale = canvas?.clientHeight ? ui.getSize().height / canvas.clientHeight : 1
        const rect = badge?.getBoundingClientRect()
        const cssTop = rect?.height ? rect.bottom - (canvas?.getBoundingClientRect().top ?? 0) + GAP_UNDER_BADGE : FALLBACK_TOP
        const top = `${Math.round(cssTop * scale)}px`
        if(root.top !== top) root.top = top
    }

    const refreshVisibility = () => {
        const show = !!badge && getComputedStyle(badge).display !== "none"
        if(show === visible) return
        visible = show
        root.isVisible = show
        // a hidden fullscreen GUI still composites its layer every frame
        // (campcraft.js) - switch the layer off while there's nothing on it
        if(ui.layer) ui.layer.isEnabled = show
    }

    const update = () => {
        if(frame++ % CHECK_VISIBILITY_EVERY === 0){
            refreshVisibility()
            if(visible) placeUnderBadge()
        }
        if(!visible) return

        const t = getTimeOfDay()
        const along = (t - BAR_STARTS_AT + 1) % 1
        const left = `${(trackFrom + along * trackLen - MARKER_KNOB / 2).toFixed(1)}px`
        if(left !== shownLeft){
            marker.left = left
            shownLeft = left
        }

        const minute = Math.floor(t * 24 * 60)
        if(minute !== shownMinute){
            shownMinute = minute
            period.text = periodOf(minute / 60)
            time.text = clockText(t)
            const daylight = getDaylight()
            const alpha = Math.round(daylight * 20) / 20
            if(alpha !== shownIconAlpha){
                shownIconAlpha = alpha
                sun.alpha  = ICON_DIM + (1 - ICON_DIM) * daylight
                moon.alpha = ICON_DIM + (1 - ICON_DIM) * (1 - daylight)
            }
        }
    }
    update()
    return scene.onBeforeRenderObservable.add(update)
}
