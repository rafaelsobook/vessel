import * as GUI from "@babylonjs/gui"
import { Vector3 } from "@babylonjs/core"
import { getCharState, updateMyDetailsOL } from "../charactersystem/characterstate.js"
import { getSceneDet } from "../main/main.js"
import { getPlayersOnScene } from "../sockets/worldsocket.js"
import { checkIfTokenSaved, randomNum } from "../tools/tools.js"
import { openClosePopup } from "../tools/popupUI.js"
import { createBonfireMesh } from "../assetcreation/createbonfire.js"
import { hideShowAllScreenUI } from "../charactersystem/uimanagement.js"
import { findGroundY } from "../tools/position.js"
import { emitCraftBonfire } from "../sockets/emits.js"
import { receiveAchievement } from "../charactersystem/achievement.js"

// Data for every camp-craftable thing. Only "bonfire" has a real
// CRAFT_HANDLERS entry (below) for now - anything added here without one
// still renders a full card (icon/desc/cost), it just tells the player it
// isn't built yet instead of crafting nothing silently. `section` is what
// buildCampcraftPanel groups cards under ("Structures" vs "Crafting" in the
// reference mockup) - add more entries under either name and they slot into
// the right group automatically, no renderer changes needed.
export const campcrafts = [
    {
        name: "bonfire",
        dn: "Bonfire",
        section: "Structures",
        desc: "A bonfire is a large, controlled outdoor fire used for warmth, cooking, and social gatherings. It is typically built with wood and can be used for various purposes such as camping, celebrations, or simply enjoying the outdoors.",
        requiredItems: [
            { name: "wood", qnty: 10 },
            { name: "stone", qnty: 5 }
        ]
    }
]

// every craft icon lives at this exact path, keyed off craft.name - derived
// here instead of also being stored per-entry (an earlier draft had an
// `img` field on each campcrafts entry), so a future entry can't drift out
// of sync with its own icon just by being added with a typo'd path
function craftIconPath(craft){
    return `./images/campcrafts/${craft.name}.webp`
}

// ============================================================
// Babylon.js GUI - reusable low-level builders
// ============================================================
// This whole panel is built with @babylonjs/gui instead of the DOM overlay
// every other menu (inventory/skills/craftingui.js) uses - a deliberate
// first step toward moving UI onto Babylon GUI rather than HTML, so these
// builders are written generic enough for whatever panel comes after this
// one to reuse, not hardcoded to campcraft specifics.

// GOLD/DARK palette already established across style.css's own UI (the
// same #edd59f / rgba(202,165,1,...) gold this game already uses for
// hover borders, rarity readouts, etc) - reused here so a Babylon-GUI panel
// doesn't visually clash with the DOM ones sitting right next to it.
const GOLD        = "#caa501"
const GOLD_BRIGHT = "#edd59f"
const TEXT_MUTED  = "rgba(245,245,245,0.65)"
const TEXT_BODY   = "rgba(245,245,245,0.85)"
// one shared source for createGoldButton's idle/hover fill - previously
// duplicated as the literal "rgba(202,165,1,0.12)" string in three places
// (initial background, onPointerOut, setButtonDisabled), which is exactly
// how the idle fill drifted out of sync with itself when only one of the
// three got bumped up for visibility
const BTN_BG_IDLE  = "rgba(202,165,1,0.35)"
const BTN_BG_HOVER = "rgba(202,165,1,0.55)"

const FONT_TITLE = "'M PLUS Rounded 1c'"
const FONT_BODY  = "'Bellefair'"
const FONT_NUM   = "'Graduate'"

// One AdvancedDynamicTexture per scene, built lazily and cached - not one
// per call. changeScene() fully disposes the old Scene (and everything
// drawn on it) on every place transition, so this is scene-tracked the same
// way magiccircles.js's own texture cache guards against a stale reference
// surviving past its scene's lifetime - a second call after a scene change
// rebuilds fresh instead of silently drawing onto a disposed texture.
let uiTexture = null
let uiTextureScene = null
function getUITexture(scene){
    if(!uiTexture || uiTextureScene !== scene){
        uiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("campcraftUI", true, scene)
        uiTextureScene = scene
    }
    return uiTexture
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
function createNinePatchBg(name, imgPath, sliceInset){
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

function createDivider(width = "100%"){
    const div = new GUI.Rectangle("divider")
    div.width = width
    div.height = "1px"
    div.thickness = 0
    div.background = "rgba(202,165,1,0.35)"
    return div
}

function createText(name, text, options = {}){
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
function createGoldButton(name, label, onClick){
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

function setButtonDisabled(btn, disabled){
    btn.metadata = { disabled }
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

// ============================================================
// requirement checking / spending - same "check first, only spend on
// actual success" contract craftingui.js's own material picker + finish()
// established for sword crafting (see its own deductSelectedMaterials)
// ============================================================

function getOwnedQty(charState, itemName){
    const owned = charState.items.find(itm => itm.name === itemName)
    return owned?.qnty ?? 0
}

function canAffordCraft(charState, craft){
    return craft.requiredItems.every(req => getOwnedQty(charState, req.name) >= req.qnty)
}

// Permanently removes the required materials - only ever called after a
// craft has actually succeeded (handleCraftClick below), never just from
// opening/looking at the panel. Same "delete the item once qnty hits 0"
// convention every other consume-an-item flow in this codebase follows.
function deductCraftCost(charState, craft){
    craft.requiredItems.forEach(req => {
        const owned = charState.items.find(itm => itm.name === req.name)
        if(!owned) return
        owned.qnty -= req.qnty
        if(owned.qnty <= 0) charState.items = charState.items.filter(itm => itm !== owned)
    })
}

// ============================================================
// what actually happens when a craft succeeds - keyed by craft.name so
// adding a new campcrafts entry later just means adding a handler here (or
// leaving it out, which now cleanly tells the player it's not built yet
// instead of silently consuming materials for nothing)
// ============================================================
// (scene, position, craftId, placeId) - craftId/placeId only matter for
// structures that need multiplayer sync (bonfire does, via emitCraftBonfire
// below); a handler that doesn't care about either is free to ignore them
const CRAFT_HANDLERS = {
    bonfire(scene, position, craftId, placeId){
        const bonfire = createBonfireMesh(scene, position, craftId)
        // emitCraftBonfire already no-ops in single-player places
        // (getIsSocketOn() check lives inside it, same as every other
        // emit* in sockets/emits.js) - only sync it if it actually built,
        // same "don't tell the server about something that didn't happen"
        // logic buildSwordItem/deductSelectedMaterials already follow
        if(bonfire){
            emitCraftBonfire({
                craftId,
                position: { x: position.x, y: position.y, z: position.z },
                placeId
            })
        }
        return bonfire
    }
}

function handleCraftClick(craft, refreshCard){
    const charState = getCharState()
    if(!charState) return

    if(!canAffordCraft(charState, craft)){
        openClosePopup("Not enough materials", true, 1500)
        return
    }

    const handler = CRAFT_HANDLERS[craft.name]
    if(!handler){
        openClosePopup(`${craft.dn} isn't buildable yet`, true, 1500)
        return
    }

    const sceneDet = getSceneDet()
    const myPlayer = getPlayersOnScene().find(pl => pl.owner === charState.owner)
    if(!sceneDet?.scene || !myPlayer?.body){
        openClosePopup("Can't build that right now", true, 1500)
        return
    }

    // spawn a little in front of the player, not exactly on top of them -
    // same "forward" direction attackingSystem.js's own melee range checks
    // already read off the body
    const forward = myPlayer.body.getDirection(Vector3.Forward())
    const pos = myPlayer.body.position.add(forward.scale(2))
    // was myPlayer.body.position.y - the player's own Y is the capsule's
    // pivot (center-ish, not ground level - createcharacter.js's own
    // capsuleHeight), so the bonfire was never actually reading real
    // ground height at all, just wherever the player's mid-body happened
    // to sit. findGroundY ray-picks the real ground/chunk mesh under this
    // exact spawn spot instead (which can differ from directly under the
    // player on sloped/uneven terrain, since this point is 2 units ahead
    // of them) - falls back to the player's own Y only if no ground mesh
    // is found at all, so this still never leaves pos.y undefined.
    pos.y = findGroundY(sceneDet.scene, pos.x, pos.z, myPlayer.body.position.y)

    // generated here (not inside a handler) so it's the SAME id used both
    // for this mesh's own name (createBonfireMesh's craftId param) and for
    // whatever gets synced to other players - keeping those two in lockstep
    // is what lets reCreateMeshesInScene's getMeshByName check recognize
    // this exact craft again later (the server's own echo of this same
    // event coming back to THIS client included) instead of double-spawning
    const craftId = randomNum()
    const built = handler(sceneDet.scene, pos, craftId, charState.currentPlace.placeId)
    if(!built){
        // handler itself already warned (e.g. containers.js's own
        // "prop model missing/failed to load" log) - just tell the player
        // something went wrong rather than silently eating their materials
        openClosePopup(`Couldn't build ${craft.dn}`, true, 1500)
        return
    }

    deductCraftCost(charState, craft)
    updateMyDetailsOL(charState, checkIfTokenSaved())
    openClosePopup(`${craft.dn} built!`, true, 1500)
    if(craft.name === "bonfire") receiveAchievement("camp-builder")
    refreshCard()
}

// ============================================================
// card / section / panel assembly
// ============================================================

const CARD_WIDTH = "210px"
// was 260px - too short once the description switched to resizeToFit
// (buildCraftCard's own desc, above) and actually grew to its real ~6-line
// height instead of being truncated/overlapping at a fixed 60px. Bumped
// with some slack rather than the exact minimum, so a future card with a
// slightly longer description doesn't immediately need this touched again.
const CARD_HEIGHT = "310px"

// returns {row, qtyText} rather than just the row - buildCraftCard's own
// refresh() needs to update the qty text in place later, and reaching for
// it via row.children[N] would silently break the moment this function's
// own internal child order ever changes
function buildResourceRow(req, owned){
    const row = new GUI.StackPanel(`${req.name}_row`)
    row.isVertical = false
    row.height = "20px"
    row.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER

    const icon = new GUI.Image(`${req.name}_icon`, `./images/items/crafting/${req.name}.webp`)
    icon.width = "18px"
    icon.height = "18px"
    icon.paddingRight = "4px"
    row.addControl(icon)

    const hasEnough = owned >= req.qnty
    const qtyText = createText(`${req.name}_qty`, `${owned}/${req.qnty}`, {
        fontFamily: FONT_NUM, fontSize: 13, color: hasEnough ? GOLD_BRIGHT : "rgba(220,90,90,0.9)",
        width: "60px", height: "20px", align: GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    })
    qtyText.resizeToFit = false
    row.addControl(qtyText)

    return { row, qtyText }
}

// One full item card - icon, name, description, cost rows, Craft button.
// refresh() (returned) re-reads the player's current items and updates the
// cost rows' owned counts + the Craft button's enabled state in place,
// without rebuilding the whole card - called right after a successful
// craft (handleCraftClick) and whenever the panel is reopened.
function buildCraftCard(craft){
    const card = new GUI.Rectangle(`card_${craft.name}`)
    card.width = CARD_WIDTH
    card.height = CARD_HEIGHT
    card.thickness = 0
    card.paddingLeft = "8px"
    card.paddingRight = "8px"
    card.paddingTop = "8px"
    card.paddingBottom = "8px"

    // was 40 - nine-patch slice thickness renders at true 1:1 source-to-
    // target pixels (Babylon GUI's own idealRatio scaling defaults to 1
    // with no idealWidth/idealHeight set on the ADT), NOT proportionally
    // to the control's own size. 40px was picked for the outer panel's own
    // nine-patch (campcraftcontainer.webp, buildCampcraftPanel below),
    // which renders ~8% of that much bigger control's width - the exact
    // same 40px on this ~210px card ate up ~19% of it, reading as a
    // noticeably thicker border than the source art (craftingframe.webp's
    // actual painted border line is only ~10-12px thick natively) ever was.
    const bg = createNinePatchBg(`card_${craft.name}_bg`, "./images/UI/frames/craftingframe.webp", 16)
    card.addControl(bg)

    // was 92% - too close to craftingframe.webp's own painted border art,
    // which is what card.paddingLeft/Right/Top/Bottom above DOESN'T fix
    // (that padding shrinks the card's box relative to ITS OWN parent row,
    // for gutter space between adjacent cards - bg and content are both
    // children of card itself, sized relative to card's already-padded
    // box, so it does nothing for clearance between content and the
    // border art painted just inside that box). A tighter percentage here
    // is what actually pulls content in from the frame.
    const content = new GUI.StackPanel(`card_${craft.name}_content`)
    content.width = "84%"
    content.height = "90%"
    content.paddingTop = "10px"
    card.addControl(content)

    const icon = new GUI.Image(`${craft.name}_img`, craftIconPath(craft))
    icon.width = "64px"
    icon.height = "64px"
    icon.paddingBottom = "6px"
    content.addControl(icon)

    content.addControl(createText(`${craft.name}_name`, craft.dn, { fontFamily: FONT_TITLE, fontSize: 16, color: GOLD_BRIGHT, height: "22px" }))

    // resizeToFit:true, not a fixed height guess - a hardcoded "60px" here
    // wasn't tall enough for this card's actual description length. Babylon
    // GUI's own TextBlock._draw recomputes height as fontOffset.height *
    // lines.length whenever resizeToFit is true, REGARDLESS of wrap mode
    // (only the width-resize path is gated to non-wrapped text) - so this
    // wraps at the fixed inherited width same as before, and grows to
    // however many lines that produces, instead of silently truncating (or,
    // worse, since TextBlock vertical-centers by default: overflowing
    // upward into the name above AND downward into the cost rows below,
    // which is what a too-short fixed height actually did here - the
    // opening words weren't missing, they were pushed up out of view).
    // Scales correctly for any future campcrafts entry's description
    // length without needing its own hand-tuned height.
    const desc = createText(`${craft.name}_desc`, craft.desc, {
        fontFamily: FONT_BODY, fontSize: 11, color: TEXT_MUTED, wrap: true, resizeToFit: true,
        paddingLeft: "6px", paddingRight: "6px"
    })
    content.addControl(desc)

    const costRows = craft.requiredItems.map(req => {
        const { row, qtyText } = buildResourceRow(req, 0)
        content.addControl(row)
        return { req, qtyText }
    })

    content.addControl(createDivider("80%"))

    const craftBtn = createGoldButton(`${craft.name}_craftbtn`, "Craft", () => handleCraftClick(craft, refresh))
    craftBtn.width = "90%"
    craftBtn.paddingTop = "6px"
    content.addControl(craftBtn)

    function refresh(){
        const charState = getCharState()
        if(!charState) return
        costRows.forEach(({ req, qtyText }) => {
            const owned = getOwnedQty(charState, req.name)
            const hasEnough = owned >= req.qnty
            qtyText.text = `${owned}/${req.qnty}`
            qtyText.color = hasEnough ? GOLD_BRIGHT : "rgba(220,90,90,0.9)"
        })
        setButtonDisabled(craftBtn, !canAffordCraft(charState, craft) || !CRAFT_HANDLERS[craft.name])
    }
    refresh()

    return { card, refresh }
}

// A plain Rectangle with two independently-ALIGNED children (label pinned
// left, divider pinned right) instead of a horizontal StackPanel - a
// StackPanel lays children out sequentially at their own fixed sizes with
// no "fill whatever's left" behavior, which is what the divider actually
// needs here. It used to get a hardcoded width ("700px") sized for the
// panel's old fixed 980px width - once that panel size itself is
// percentage-based (buildCampcraftPanel below), a hardcoded px divider
// would be sized for the wrong assumption immediately. Percentage width +
// right-alignment scales correctly regardless of the panel's actual
// on-screen size.
function buildSectionRow(title){
    const row = new GUI.Rectangle(`section_${title}`)
    row.thickness = 0
    row.height = "30px"
    row.width = "100%"
    row.paddingTop = "10px"
    row.paddingBottom = "6px"

    const label = createText(`section_${title}_label`, title, {
        fontFamily: FONT_TITLE, fontSize: 16, color: GOLD, width: "150px", height: "30px",
        align: GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    })
    label.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    row.addControl(label)

    const div = createDivider("78%")
    div.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT
    row.addControl(div)

    return row
}

// chunks a section's crafts into rows of CARDS_PER_ROW - no Babylon GUI
// control natively wraps children onto a new row the way CSS flex-wrap
// does, so rows are built explicitly instead. Anything added to campcrafts
// later just grows into more rows automatically, no layout code to touch.
const CARDS_PER_ROW = 4

function buildCardGrid(crafts, refreshers){
    const grid = new GUI.StackPanel("card_grid")
    grid.width = "100%"

    for(let i = 0; i < crafts.length; i += CARDS_PER_ROW){
        const rowCrafts = crafts.slice(i, i + CARDS_PER_ROW)
        const row = new GUI.StackPanel(`card_row_${i}`)
        row.isVertical = false
        row.height = CARD_HEIGHT
        row.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT

        rowCrafts.forEach(craft => {
            const { card, refresh } = buildCraftCard(craft)
            row.addControl(card)
            refreshers.push(refresh)
        })

        grid.addControl(row)
    }

    return grid
}

let panelRoot = null
let panelScene = null
let cardRefreshers = []

function buildCampcraftPanel(scene){
    const texture = getUITexture(scene)

    // percentage, not a fixed px guess - AdvancedDynamicTexture.
    // CreateFullscreenUI sizes its texture off the actual render-target
    // resolution, which this codebase never actually inspected before
    // picking "980px"/"680px" - on the resolution this was tested at,
    // that read as nearly the full viewport instead of a bounded floating
    // panel. Percentage sizing scales correctly regardless of what that
    // resolution actually turns out to be, sidestepping the question
    // entirely instead of trying to pin down the exact right px number.
    const root = new GUI.Rectangle("campcraft_root")
    root.width = "70%"
    root.height = "75%"
    root.thickness = 0
    root.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER
    root.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER

    root.addControl(createNinePatchBg("campcraft_bg", "./images/UI/frames/campcraftcontainer.webp", 60))

    const inner = new GUI.StackPanel("campcraft_inner")
    inner.width = "94%"
    inner.height = "94%"
    inner.paddingTop = "18px"
    root.addControl(inner)

    // --- header row: icon, title+subtitle, close button ---
    // A plain Rectangle with each child independently ALIGNED (left/left/
    // right), not a horizontal StackPanel - this used to be one, with
    // titleBx sized as "75% of the header". That's the same class of bug
    // buildSectionRow's divider had: a horizontal StackPanel just places
    // each child immediately after the previous one, it doesn't push a
    // later child out to the row's own far edge - so closeBtn rendered
    // wherever icon+titleBx's cumulative width happened to end (overlapping
    // the title text), not pinned to the right side of the panel the way
    // the mockup showed. Alignment-based positioning doesn't have this
    // problem: each control is placed relative to the ROW's own bounds,
    // not relative to its siblings.
    const header = new GUI.Rectangle("campcraft_header")
    header.thickness = 0
    header.height = "70px"
    header.width = "100%"
    inner.addControl(header)

    const headerIcon = new GUI.Image("campcraft_header_icon", "./images/UI/campcraft.webp")
    headerIcon.width = "56px"
    headerIcon.height = "56px"
    headerIcon.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    headerIcon.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER
    header.addControl(headerIcon)

    const titleBx = new GUI.StackPanel("campcraft_title_bx")
    titleBx.width = "70%"
    titleBx.height = "60px"
    titleBx.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    titleBx.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER
    // clears the icon (56px wide + a 14px gap) - titleBx is independently
    // left-aligned now, not flowing after the icon the way a StackPanel
    // child would, so it needs its own explicit offset to not sit under it
    titleBx.paddingLeft = "70px"
    header.addControl(titleBx)
    titleBx.addControl(createText("campcraft_title", "Survival Crafting", {
        fontFamily: FONT_TITLE, fontSize: 26, color: GOLD_BRIGHT, height: "34px", align: GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    }))
    titleBx.addControl(createText("campcraft_subtitle", "Build structures and craft items to survive in the wild.", {
        fontFamily: FONT_BODY, fontSize: 13, color: TEXT_MUTED, height: "20px", align: GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    }))

    const closeBtn = createGoldButton("campcraft_close", "X", () => openCloseCampcraftUI(false))
    closeBtn.width = "36px"
    closeBtn.height = "36px"
    closeBtn.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT
    closeBtn.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER
    header.addControl(closeBtn)

    inner.addControl(createDivider("100%"))

    // --- sections + card grid, grouped by campcrafts[].section ---
    const sections = {}
    campcrafts.forEach(craft => {
        const key = craft.section ?? "Crafting"
        sections[key] = sections[key] || []
        sections[key].push(craft)
    })

    cardRefreshers = []
    Object.entries(sections).forEach(([title, crafts]) => {
        inner.addControl(buildSectionRow(title))
        inner.addControl(buildCardGrid(crafts, cardRefreshers))
    })

    // starts hidden - a Control defaults to isVisible:true on construction,
    // and openCloseCampcraftUI's own toggle below reads panelRoot.isVisible
    // to decide whether THIS click is opening or closing it. Without this,
    // the very first click would build the panel already "visible", the
    // toggle would read that as "already open" and immediately flip it back
    // off, and it'd take a second click just to actually see anything.
    root.isVisible = false

    texture.addControl(root)
    panelRoot = root
    panelScene = scene
    return root
}

// Exported toggle, same naming/shape as craftingui.js's openCloseCraftUI -
// lazily builds the panel on first call (or after a scene change, since
// panelScene tracking mirrors getUITexture's own guard above), just flips
// isVisible afterward. forceOpen omitted toggles from whatever it's
// currently showing, same convention openCloseCraftUI already uses.
export function openCloseCampcraftUI(forceOpen){
    const sceneDet = getSceneDet()
    if(!sceneDet?.scene) return

    if(!panelRoot || panelScene !== sceneDet.scene){
        buildCampcraftPanel(sceneDet.scene)
    }

    const willOpen = forceOpen !== undefined ? forceOpen : !panelRoot.isVisible
    panelRoot.isVisible = willOpen
    if(willOpen) cardRefreshers.forEach(refresh => refresh())

    // this panel is canvas-rendered (Babylon GUI), not a DOM element, so it
    // has no z-index relationship with the DOM-based HUD (story tracker,
    // hunger/stamina icons, the menu bar itself) at all - without this the
    // two layers just collide, which is exactly what showed up open:
    // "Meet The Receptionist" and the hunger icons rendering on top of the
    // panel instead of being covered by it. Same mechanism startResting/
    // cutscene dialogue already use to hide the rest of the HUD while
    // something fullscreen is showing - not something special to this panel.
    hideShowAllScreenUI(!willOpen)
}
