import * as GUI from "@babylonjs/gui"

// Babylon GUI building blocks shared by every in-canvas panel - first written
// for the campcraft panel (campcraft.js), which was a deliberate first step
// toward moving UI onto Babylon GUI rather than HTML, and moved here so the
// next panel (bonfireCooking.js's cook list) uses the very same look instead
// of a copy of it. Nothing in here knows about any one panel.

// GOLD/DARK palette already established across style.css's own UI (the
// same #edd59f / rgba(202,165,1,...) gold this game already uses for
// hover borders, rarity readouts, etc) - reused here so a Babylon-GUI panel
// doesn't visually clash with the DOM ones sitting right next to it.
export const GOLD        = "#caa501"
export const GOLD_BRIGHT = "#edd59f"
export const TEXT_MUTED  = "rgba(245,245,245,0.65)"
export const TEXT_BODY   = "rgba(245,245,245,0.85)"
// one shared source for createGoldButton's idle/hover fill - previously
// duplicated as the literal "rgba(202,165,1,0.12)" string in three places
// (initial background, onPointerOut, setButtonDisabled), which is exactly
// how the idle fill drifted out of sync with itself when only one of the
// three got bumped up for visibility
export const BTN_BG_IDLE  = "rgba(202,165,1,0.35)"
export const BTN_BG_HOVER = "rgba(202,165,1,0.55)"

export const FONT_TITLE = "'M PLUS Rounded 1c'"
export const FONT_BODY  = "'Bellefair'"
export const FONT_NUM   = "'Graduate'"

// A panel built at a fixed pixel size, shrunk whole (centred) on a screen
// smaller than it - a phone on its side is ~320-440px tall - so its close
// button never ends up off the edge. Checked every draw, the way
// skillsPanel.js does, so turning the phone or resizing the window refits it;
// it goes with the control. width/height: the room it needs, including any
// offset (top/left) it's moved by.
export function fitToScreen(control, ui, width, height, margin = 0.94){
    control.onBeforeDrawObservable.add(() => {
        const size = ui.getSize()
        const fit = Math.min(1, size.width * margin / width, size.height * margin / height)
        if(control.scaleX !== fit){
            control.scaleX = fit
            control.scaleY = fit
        }
    })
}

// Nine-patch background - the ornate bordered frame art (corner flourishes,
// notched edges) stays crisp at any control size instead of the corners
// stretching into mush the way a plain STRETCH_FILL would.
//
// sliceLeft/sliceRight/sliceTop/sliceBottom are NOT four independent insets
// from each control's own nearest edge, despite what their names suggest -
// read straight from @babylonjs/gui's own _renderNinePatch (image.pure.js):
// centerWidth = sliceRight - sliceLeft, rightWidth = sw - sliceRight. All
// four are absolute pixel COORDINATES in the SOURCE image, measured from
// its top-left origin - sliceLeft/sliceTop are "where the left/top border
// ends" (fine, an inset from 0 IS just that coordinate), but sliceRight/
// sliceBottom are "where the right/bottom border STARTS", i.e. (imageWidth
// - insetFromRight) / (imageHeight - insetFromBottom), not the inset
// itself. Setting all four to the same "inset" value (this function's
// original bug) makes centerWidth/centerHeight collapse to 0 and mangles
// the right/bottom patches into stretching nearly the whole image - the
// exact "border shows on some edges, not others" result this was built to
// fix. Computed here off the image's own real decoded size
// (onImageLoadedObservable) instead of a second hardcoded guess, since
// nothing in this file actually knows these images' pixel dimensions.
export function createNinePatchBg(name, imgPath, sliceInset){
    const img = new GUI.Image(name, imgPath)
    img.stretch = GUI.Image.STRETCH_NINE_PATCH
    img.sliceLeft = sliceInset
    img.sliceTop = sliceInset
    img.width = "100%"
    img.height = "100%"
    img.onImageLoadedObservable.add(() => {
        img.sliceRight = img.imageWidth - sliceInset
        img.sliceBottom = img.imageHeight - sliceInset
    })
    return img
}

export function createDivider(width = "100%"){
    const div = new GUI.Rectangle("divider")
    div.width = width
    div.height = "1px"
    div.thickness = 0
    div.background = "rgba(202,165,1,0.35)"
    return div
}

export function createText(name, text, options = {}){
    const t = new GUI.TextBlock(name, text)
    t.fontFamily = options.fontFamily ?? FONT_BODY
    t.fontSize = options.fontSize ?? 16
    t.color = options.color ?? TEXT_BODY
    t.textWrapping = options.wrap ?? false
    t.textHorizontalAlignment = options.align ?? GUI.Control.HORIZONTAL_ALIGNMENT_CENTER
    t.height = options.height ?? "24px"
    t.resizeToFit = options.resizeToFit ?? false
    // was silently dropped before - every options.width a caller passed
    // (the section label, each resource-cost qty text) never actually
    // reached the control, leaving it at Babylon GUI's own default sizing
    // inside a horizontal StackPanel (effectively collapsed/fighting its
    // siblings for space), which is why both read as missing entirely
    // rather than just mis-positioned
    if(options.width !== undefined) t.width = options.width
    // Control's own padding properties (Babylon GUI's equivalent of CSS
    // padding) - same "only touch it if the caller actually asked" as
    // width above, so every existing call site that didn't pass these
    // keeps its old (zero-padding) behavior unchanged
    if(options.paddingLeft !== undefined) t.paddingLeft = options.paddingLeft
    if(options.paddingRight !== undefined) t.paddingRight = options.paddingRight
    if(options.paddingTop !== undefined) t.paddingTop = options.paddingTop
    if(options.paddingBottom !== undefined) t.paddingBottom = options.paddingBottom
    return t
}

// A clickable Rectangle+TextBlock button - Babylon GUI's own Button.
// CreateSimpleButton does almost this, but doesn't give hover/disabled
// states of our own styling, which the Craft button needs (greyed out +
// unclickable when the player can't afford it, same spirit as
// craftingui.js's disabled material swatches)
export function createGoldButton(name, label, onClick){
    const btn = new GUI.Rectangle(name)
    btn.height = "34px"
    // was thickness:1 + a 12%-alpha fill - read as a barely-visible hairline
    // with floating text rather than an actual button. Thicker border +
    // much stronger fill so it reads as a pressable box against the
    // panel's near-black background.
    btn.thickness = 2
    btn.color = GOLD
    btn.background = BTN_BG_IDLE
    btn.cornerRadius = 4
    // Control's own built-in hover cursor - Babylon GUI applies this to the
    // canvas's CSS cursor automatically while the pointer is over this
    // control, no manual pointer-event/DOM cursor juggling needed
    btn.hoverCursor = "pointer"

    const label_ = createText(`${name}_label`, label, { fontFamily: FONT_BODY, fontSize: 15, color: GOLD_BRIGHT })
    btn.addControl(label_)

    btn.isPointerBlocker = true
    btn.onPointerClickObservable.add(() => onClick(btn))
    // hover brightens both the fill AND the border, not just the fill - a
    // color-only border change with no thickness/cursor cue read as too
    // subtle on its own (same complaint the original barely-visible idle
    // state got)
    btn.onPointerEnterObservable.add(() => {
        if(btn.metadata?.disabled) return
        btn.background = BTN_BG_HOVER
        btn.color = GOLD_BRIGHT
    })
    btn.onPointerOutObservable.add(() => {
        if(btn.metadata?.disabled) return
        btn.background = BTN_BG_IDLE
        btn.color = GOLD
    })

    return btn
}

export function setButtonDisabled(btn, disabled){
    // merge into whatever metadata the control already carries rather than
    // replacing the object outright - createGoldButton's hover handlers only
    // read metadata.disabled today, so a wholesale `= { disabled }` happens to
    // be harmless right now, but Control.metadata is Babylon GUI's one general
    // "stash your own state here" slot and the next thing to use it on a
    // button would get silently wiped every time affordability changed
    btn.metadata = { ...btn.metadata, disabled }
    btn.alpha = disabled ? 0.4 : 1
    btn.isPointerBlocker = !disabled
    btn.background = BTN_BG_IDLE
    // resets the border too, not just the fill - a button can go from
    // affordable to disabled (refresh(), right after a successful craft)
    // while still mid-hover, and onPointerOut won't fire just because the
    // mouse hasn't actually moved - without this it could get stuck showing
    // the brightened GOLD_BRIGHT hover border on a now-unclickable button
    btn.color = GOLD
}

// A labelled progress bar hanging over a point in the world - the bonfire's
// "Roasting ..." (bonfireCooking.js) and a chest being opened
// (assetcreation/createtreasure.js). anchor: the mesh/node it follows; offsetY:
// pixels up (negative) from it. Fill it by setting fill.width ("0%".."100%").
export function createWorldProgressBar(ui, name, anchor, labelText, { fillColor = "#ff9a2e", offsetY = -14 } = {}){
    // tall and wide enough for the label over the bar - a control clips what
    // it holds to its own box, so a smaller one cut the label off entirely
    const root = new GUI.Rectangle(name)
    root.width = "180px"
    root.height = "34px"
    root.thickness = 0
    ui.addControl(root)
    root.linkWithMesh(anchor)
    // offsetY places the bar itself; the box reaches up past it for the label
    root.linkOffsetY = offsetY - 11

    const label = createText(`${name}_label`, labelText, {
        fontFamily: FONT_BODY, fontSize: 13, color: GOLD_BRIGHT, height: "18px",
    })
    label.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP
    label.outlineWidth = 3
    label.outlineColor = "black"
    root.addControl(label)

    const track = new GUI.Rectangle(`${name}_track`)
    track.width = "50px"
    track.height = "12px"
    track.thickness = 1
    track.color = GOLD
    track.cornerRadius = 3
    track.background = "rgba(0,0,0,0.65)"
    track.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM
    root.addControl(track)

    const fill = new GUI.Rectangle(`${name}_fill`)
    fill.thickness = 0
    fill.width = "0%"
    fill.background = fillColor
    fill.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    track.addControl(fill)

    return { root, label, fill }
}
