import * as GUI from "@babylonjs/gui"
import { getCharState } from "../charactersystem/characterstate.js"
import { getSceneDet } from "../main/main.js"
import { getPlayersOnScene } from "../sockets/worldsocket.js"

// same GOLD/DARK palette campcraft.js already established for a Babylon-GUI
// panel (see that file's own header comment) - reused here so this doesn't
// visually clash with it or the rest of the game's existing UI
const GOLD        = "#caa501"
const GOLD_BRIGHT = "#edd59f"
const TEXT_BODY   = "rgba(245,245,245,0.85)"
const TEXT_MUTED  = "rgba(245,245,245,0.55)"
const FONT_TITLE  = "'M PLUS Rounded 1c'"
const FONT_BODY   = "'Bellefair'"

// fixed pixel widths shared by the column-header row and every data row
// below it, so everything actually lines up in columns - must sum to the
// panel's own content width (root's 660px minus its 40px left and 24px right
// padding) MINUS SCROLLBAR_WIDTH_PX below, since the data rows sit inside a
// ScrollViewer that reserves that much width for its own bar - the column
// header row above it isn't squeezed the same way, so the header just ends
// with a few pixels of blank space where the bar would sit below it.
// "distance" is the Distance Traveled column (charactersystem/travelRecord.js)
const COL_WIDTH = { index: "30px", name: "190px", lvl: "56px", map: "174px", distance: "136px" }

// data rows scroll instead of the panel growing forever - past this many
// players the ScrollViewer below caps out and a scrollbar takes over,
// so a crowded place (30+ players) never grows the panel taller than the
// screen. Matches buildRow's own fixed 24px height + 2px paddingBottom.
const MAX_VISIBLE_ROWS = 14
const ROW_HEIGHT_PX = 26
const SCROLLBAR_WIDTH_PX = 10

function createText(name, text, options = {}){
    const t = new GUI.TextBlock(name, text)
    t.fontFamily = options.fontFamily ?? FONT_BODY
    t.fontSize = options.fontSize ?? 15
    t.color = options.color ?? TEXT_BODY
    t.textHorizontalAlignment = options.align ?? GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    t.height = options.height ?? "22px"
    t.resizeToFit = false
    // a name or map too long for its column ends in "..." instead of running into the next one
    if(options.ellipsis) t.textWrapping = GUI.TextWrapping?.Ellipsis ?? 2
    if(options.width !== undefined) t.width = options.width
    return t
}

// one AdvancedDynamicTexture for this panel, built lazily and scene-tracked
// the same way campcraft.js's own getUITexture guards against a stale
// texture surviving a scene change (changeScene() fully disposes the old
// Scene on every place transition)
let uiTexture = null
let uiTextureScene = null
function getUITexture(scene){
    if(!uiTexture || uiTextureScene !== scene){
        uiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("playerListUI", true, scene)
        uiTextureScene = scene
    }
    return uiTexture
}

let panelRoot = null
let panelScene = null
let rowsPanel = null
let rowsScrollViewer = null
// live-updated every refresh with the current "Players (N)" count - kept
// separate from the static column-header row below it
let titleText = null

// "1,284 m" - what the Distance Traveled column shows. "-" for anyone with no
// record to show (a bot, or a player whose client predates it)
function formatDistance(meters){
    if(typeof meters !== "number" || !Number.isFinite(meters)) return "-"
    return `${Math.round(meters).toLocaleString("en-US")} m`
}

function buildRow(index, name, lvl, mapName, distance, isSelf, isBot){
    const row = new GUI.StackPanel(`playerlist_row_${name}_${Math.random()}`)
    row.isVertical = false
    row.height = "24px"
    row.paddingLeft = "15px"
    row.paddingBottom = "2px"
    row.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT

    const nameColor = isSelf ? GOLD_BRIGHT : (isBot ? TEXT_MUTED : TEXT_BODY)
    const label = name + (isSelf ? " (You)" : "") + (isBot ? "" : "")

    row.addControl(createText("idx", `${index}`, { fontSize: 13, color: TEXT_MUTED, width: COL_WIDTH.index }))
    row.addControl(createText("name", label, { fontSize: 14, color: nameColor, width: COL_WIDTH.name, ellipsis: true }))
    row.addControl(createText("lvl", `${lvl}`, { fontSize: 14, color: GOLD, width: COL_WIDTH.lvl }))
    row.addControl(createText("map", mapName, { fontSize: 13, color: TEXT_MUTED, width: COL_WIDTH.map, ellipsis: true }))
    row.addControl(createText("distance", distance, { fontSize: 13, color: isSelf ? GOLD_BRIGHT : TEXT_BODY, width: COL_WIDTH.distance }))
    return row
}

function buildColumnHeaderRow(){
    const row = new GUI.StackPanel("playerlist_colheader")
    row.isVertical = false
    row.height = "22px"
    row.paddingLeft = "15px"
    row.paddingBottom = "4px"
    row.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT

    const headerOpts = { fontFamily: FONT_TITLE, fontSize: 12, color: GOLD }
    row.addControl(createText("h_idx", "#", { ...headerOpts, width: COL_WIDTH.index }))
    row.addControl(createText("h_name", "Name", { ...headerOpts, width: COL_WIDTH.name }))
    row.addControl(createText("h_lvl", "Level", { ...headerOpts, width: COL_WIDTH.lvl }))
    row.addControl(createText("h_map", "Map/Area", { ...headerOpts, width: COL_WIDTH.map }))
    row.addControl(createText("h_distance", "Distance Traveled", { ...headerOpts, width: COL_WIDTH.distance }))
    return row
}

function buildPanel(scene){
    const texture = getUITexture(scene)

    const root = new GUI.Rectangle("playerlist_root")
    // wide enough for #/Name/Level/Map-Area/Distance Traveled side by side
    // (COL_WIDTH above sums to 586, plus the scrollbar's 10 = this minus the
    // 40px/24px left/right padding)
    root.width = "660px"
    // grown/shrunk per-refresh below (rows.length * rowHeight + header) -
    // starts at a single-row height so an empty place doesn't flash a tall
    // empty box before the first refresh sizes it properly
    root.height = "80px"
    root.thickness = 0
    root.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER
    root.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER
    root.left = "20px"

    // ornate frame art instead of a flat rgba fill - same asset
    // style.scss's own .craft-container uses for a right-side panel
    // (stretched 100%/100% there too, not nine-patch - its 1081x799 native
    // aspect only really holds at that fixed CSS size; here the panel's
    // own height changes with the row count, so the frame stretches
    // non-uniformly to match whatever height refreshRows() lands on).
    // Added before `inner` so it renders behind every other control on
    // root (Babylon GUI stacks children in the order they're added).
    // Deliberately NOT inset via root's own padding - a Container's padding
    // shrinks the area every CHILD gets measured against, this image
    // included, so padding on root just shrank the frame graphic itself
    // inward and left the same tight gap between its (now smaller) border
    // and the text next to it. root stays padding-free so this fills its
    // true full bounds edge-to-edge; the breathing room instead lives on
    // `inner` below, which only insets the actual text content.
    const bgImage = new GUI.Image("playerlist_bg", "./images/UI/frames/rightbigcont.webp")
    bgImage.stretch = GUI.Image.STRETCH_FILL
    bgImage.width = "100%"
    bgImage.height = "100%"
    root.addControl(bgImage)

    const inner = new GUI.StackPanel("playerlist_inner")
    inner.width = "100%"
    // left padding bumped well past the others - the frame art's own
    // decorative border eats into the left edge more than the flat rgba
    // fill it replaced did, crowding the "#" column against it otherwise
    inner.paddingLeft = "40px"
    inner.paddingRight = "24px"
    inner.paddingTop = "20px"
    inner.paddingBottom = "20px"
    root.addControl(inner)

    // title ("Players (N)") + "Press Tab to close" hint, side by side -
    // widths below (440 + 156 = 596) match the table's own width (COL_WIDTH
    // plus the scrollbar) so this row lines up flush with the table beneath it
    const headerRow = new GUI.StackPanel("playerlist_header")
    headerRow.isVertical = false
    headerRow.height = "28px"
    headerRow.paddingBottom = "8px"
    headerRow.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    inner.addControl(headerRow)

    titleText = createText("playerlist_title", "Players", {
        fontFamily: FONT_TITLE, fontSize: 18, color: GOLD_BRIGHT, height: "28px", width: "440px",
    })
    titleText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER
    headerRow.addControl(titleText)

    headerRow.addControl(createText("playerlist_hint", "Press Tab to close", {
        fontFamily: FONT_BODY, fontSize: 12, color: TEXT_MUTED, height: "28px", width: "156px",
        align: GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT,
    }))

    inner.addControl(buildColumnHeaderRow())

    // caps the visible rows at MAX_VISIBLE_ROWS and scrolls past that -
    // height is re-set every refresh (see refreshRows below) to exactly fit
    // however many rows are actually showing, up to that cap, so a quiet
    // place doesn't leave a tall empty scroll area and a crowded one
    // doesn't grow the panel off the bottom of the screen
    rowsScrollViewer = new GUI.ScrollViewer("playerlist_scroll")
    rowsScrollViewer.width = "100%"
    rowsScrollViewer.height = `${ROW_HEIGHT_PX}px`
    rowsScrollViewer.thickness = 0
    rowsScrollViewer.barSize = SCROLLBAR_WIDTH_PX
    rowsScrollViewer.barColor = GOLD
    rowsScrollViewer.barBackground = "rgba(255,255,255,0.1)"
    inner.addControl(rowsScrollViewer)

    rowsPanel = new GUI.StackPanel("playerlist_rows")
    rowsPanel.width = "100%"
    rowsScrollViewer.addControl(rowsPanel)

    // added directly to root (not inner's vertical stack) so it floats at
    // the panel's own top-right corner instead of consuming row space -
    // lets a mouse click close the panel same as releasing Tab does,
    // useful if Tab got held through a focus change that swallowed its keyup
    const closeBtn = new GUI.TextBlock("playerlist_close", "✕")
    closeBtn.fontFamily = FONT_BODY
    closeBtn.fontSize = 16
    closeBtn.color = TEXT_MUTED
    closeBtn.width = "20px"
    closeBtn.height = "20px"
    closeBtn.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT
    closeBtn.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP
    // added straight to root (see comment above), which is deliberately
    // padding-free now - so unlike everything inside `inner`, this needs
    // its own explicit inset from root's true edges instead of getting one
    // for free from a parent's padding
    closeBtn.left = "-20px"
    closeBtn.top = "18px"
    closeBtn.isPointerBlocker = true
    closeBtn.onPointerClickObservable.add(() => openClosePlayerListUI(false))
    closeBtn.onPointerEnterObservable.add(() => closeBtn.color = GOLD_BRIGHT)
    closeBtn.onPointerOutObservable.add(() => closeBtn.color = TEXT_MUTED)
    root.addControl(closeBtn)

    root.isVisible = false
    texture.addControl(root)
    panelRoot = root
    panelScene = scene
    return root
}

// rebuilds the row list from scratch every time this is called (a live
// snapshot, not something that needs incremental add/remove tracking) -
// cheap enough for however many players actually share one place, and
// matches campcraft.js's own "just refresh on open" convention rather than
// trying to keep a persistent list in sync with every join/leave while
// the panel is closed and nobody's even looking at it
function refreshRows(){
    if(!rowsPanel) return
    rowsPanel.clearControls()

    const charState = getCharState()
    if(!charState) return
    const myPlaceId = charState.currentPlace.placeId

    // getPlayersOnScene() is meant to already only ever hold players sharing
    // my current place (reCreateMeshesInScene only pushes a player whose
    // currentPlace.placeId matched mine AT THE MOMENT it was created), but
    // that guard only runs on creation, not on every frame afterward - this
    // filter is the actual safety net for anyone who's since moved to a
    // different place without their stale render object being cleaned up
    // client-side yet.
    // pl.owner !== charState.owner is a second safety net, this one against
    // ever showing the local player twice - reCreateMeshesInScene (worldsocket.js)
    // is already supposed to skip creating a render object for my own owner,
    // but if a stale/duplicate entry for myself ever slips into
    // getPlayersOnScene() anyway (two tabs on the same account, a leftover
    // session that never disconnected, etc.), this list is the one place
    // that actually has to not show me twice regardless of the cause

    // const others = getPlayersOnScene().filter(pl => pl.currentPlaceId === myPlaceId && pl.owner !== charState.owner)
    // the fog's undead are bodies in playersOnScene too (enemies/undead.js),
    // but nobody you'd call people
    // areascene.js pushes MY OWN player into this list too, and I'm already the
    // first row below (from charState) - so everyone else only
    const others = getPlayersOnScene().filter(pl => pl.owner !== charState.owner && !pl.owner?.startsWith("undead_"))

    if(titleText) titleText.text = `People`

    let index = 1
    // charState.owner/lvl/name is what THIS client actually
    // is - never in getPlayersOnScene() itself (that array is every OTHER
    // player/bot's own render object, see worldsocket.js's
    // reCreateMeshesInScene, which explicitly skips pushing a mesh for
    // tcpCharDet.owner === my own owner)
    rowsPanel.addControl(buildRow(
        index++, charState.name, charState.lvl,
        charState.currentPlace?.name ?? "-",
        formatDistance(charState.maxDistanceTraveled ?? 0),
        true, false,
    ))

    others.forEach(pl => {
        const isBot = Boolean(pl.det?.attitudeName)
        console.log(pl)
        rowsPanel.addControl(buildRow(
            index++, pl.name, pl.det?.lvl ?? 1,
            pl.det?.currentPlace?.name ?? "-",
            isBot ? "-" : formatDistance(pl.det?.maxDistanceTraveled),
            false, isBot,
        ))
    })

    // title row (28+8) + column-header row (22+4) + inner's own
    // paddingTop/Bottom (20px each) + one row per VISIBLE player (24px
    // content + 2px paddingBottom each, capped at MAX_VISIBLE_ROWS) -
    // matches buildRow/buildColumnHeaderRow's own fixed sizes above, so the
    // panel always hugs exactly however many rows it's actually showing
    // (up to the cap) instead of a fixed size that leaves a big empty gap
    // in a quiet place, or growing past the cap into a crowded one
    const rowCount = rowsPanel.children.length
    const visibleRows = Math.min(rowCount, MAX_VISIBLE_ROWS)
    rowsScrollViewer.height = `${visibleRows * ROW_HEIGHT_PX}px`
    panelRoot.height = `${(28 + 8) + (22 + 4) + 40 + visibleRows * ROW_HEIGHT_PX}px`
}

// Exported toggle, same shape as campcraft.js's own openCloseCampcraftUI -
// lazily builds the panel on first call (or after a scene change), refreshes
// its rows every time it opens, just flips isVisible the rest of the time.
// Deliberately does NOT call hideShowAllScreenUI like campcraft's own modal
// popup does - this is a quick-glance overlay meant to sit on top of the
// normal HUD (inputMovement.js holds it open only while Tab is actually
// held down), not a fullscreen menu that takes over the screen.
// called by worldsocket.js whenever the player roster actually changes
// (someone - real or bot - joins/leaves the place) so a currently-held-open
// panel reflects it live, instead of only ever refreshing on the next
// Tab press. A no-op while the panel is closed - nobody's looking at rows
// that are about to get rebuilt from scratch on the next open anyway
export function refreshPlayerListIfOpen(){
    if(panelRoot?.isVisible) refreshRows()
}

export function openClosePlayerListUI(forceOpen){
    const sceneDet = getSceneDet()
    if(!sceneDet?.scene) return

    if(!panelRoot || panelScene !== sceneDet.scene){
        buildPanel(sceneDet.scene)
    }

    const willOpen = forceOpen !== undefined ? forceOpen : !panelRoot.isVisible
    if(willOpen) refreshRows()
    panelRoot.isVisible = willOpen

    // see campcraft.js's own openCloseCampcraftUI for the full reasoning -
    // this file copied that panel's structure, and inherited the same gap
    // with it. Short version: CreateFullscreenUI also attaches a core Layer,
    // and Layer.render() only early-outs on isEnabled, never on whether the
    // controls drawn on the texture are visible. So isVisible:false alone
    // leaves a fullscreen alpha-blended quad compositing every frame (plus a
    // canvas-sized RGBA texture resident) for the rest of the scene's life,
    // once this panel has been opened a single time.
    if(uiTexture?.layer) uiTexture.layer.isEnabled = willOpen
}
