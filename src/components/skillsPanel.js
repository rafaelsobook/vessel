import * as GUI from "@babylonjs/gui"
import { getSceneDet } from "../main/main.js"
import { hideShowAllScreenUI } from "../charactersystem/uimanagement.js"
import { GOLD, GOLD_BRIGHT, FONT_BODY, createText } from "./guiKit.js"

// The skills window - the list of skills I know on the left, the one picked
// on the right (its ring, rank, cost, cooldown, what it does, and the button
// that puts it in or takes it out of a slot). Babylon GUI, the way campcraft's
// panel is (campcraft.js): one fullscreen texture per scene, its layer off
// while the window's closed, the HTML HUD hidden while it's open (the canvas
// draws under every DOM element, so the HUD would sit on top of it).
//
// It only draws. What a skill says (rank label, cost...) and what clicking
// does come from skillsui.js through renderSkillsPanel - see SkillsView there.
// The skill-slot bar under it stays HTML (index.html's .skill-slots).

// the old .skill-container's own size - shrunk to fit a smaller screen
const PANEL_W = 900
const PANEL_H = 600
const FRAMES = "./images/UI/frames"

const NAME_COLOR = "#dcc9f0"
const MUTED = "rgba(177,177,177,0.6)"
const ACTIVE_COLOR = "#edd59f"
const VALUE_COLOR = "#f5f5f5"
const DESC_COLOR = "#d8d5d5"
const FONT_RANK = "'Cormorant Garamond'"

// skillrank -> how its rank and description read (the old style.scss
// [data-rank] rules); 4 shimmers, see startShimmer
const RANK_LOOK = {
    0: { value: VALUE_COLOR, desc: DESC_COLOR },
    1: { value: "#7fe3b4", desc: "rgba(127,227,180,0.6)" },
    2: { value: "#c48bff", desc: "rgba(196,139,255,0.55)", glow: "rgba(196,139,255,0.5)", blur: 6 },
    3: { value: "#f0c94a", desc: "rgba(240,201,74,0.6)", glow: "rgba(240,201,74,0.65)", blur: 10, font: FONT_RANK, style: "italic", weight: "600" },
    4: { value: "#f0c94a", desc: "rgba(255,246,208,0.75)", glow: "rgba(240,201,74,0.65)", blur: 10, font: FONT_RANK, style: "italic", weight: "700", shimmer: true },
}

// the assign button's two looks - putting a skill in a slot, taking it out
const ASSIGN_LOOK = {
    assign: { border: "rgba(237,213,159,0.5)", idle: "rgba(142,81,32,0.35)", hover: "rgba(142,81,32,0.55)", text: "#edd59f" },
    remove: { border: "rgba(200,90,90,0.5)", idle: "rgba(120,30,30,0.25)", hover: "rgba(120,30,30,0.4)", text: "#e8b0b0" },
}
const ROW_BORDER = { idle: "transparent", hover: "rgba(202,165,1,0.3)", selected: "rgba(202,165,1,0.6)" }

let ui = null
let uiScene = null
let panel = null
let isOpen = false
let lastView = null

// one texture per scene - changeScene() disposes the old one with its scene
function getUI(scene){
    if(!ui || uiScene !== scene){
        ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("skillsUI", true, scene, undefined, true)
        ui.layer.isEnabled = false
        uiScene = scene
        panel = null
        // leaving the place with the window open mustn't strand the HUD hidden
        scene.onDisposeObservable.addOnce(() => {
            if(isOpen) hideShowAllScreenUI(true)
            isOpen = false
            ui = null
            uiScene = null
            panel = null
        })
    }
    return ui
}

const image = (name, path, width = "100%", height = "100%") => {
    const img = new GUI.Image(name, path)
    img.width = width
    img.height = height
    return img
}
const box = (name, width, height) => {
    const rect = new GUI.Rectangle(name)
    rect.width = width
    rect.height = height
    rect.thickness = 0
    return rect
}
const place = (control, left, top) => {
    control.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    control.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP
    control.left = `${left}px`
    control.top = `${top}px`
    return control
}
const leftText = (name, text, fontSize, color, height) => {
    const t = createText(name, text, { fontSize, color, height, align: GUI.Control.HORIZONTAL_ALIGNMENT_LEFT })
    t.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    return t
}
const rightText = (name, text, fontSize, color, height) => {
    const t = createText(name, text, { fontSize, color, height, align: GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT })
    t.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT
    return t
}

function buildPanel(scene){
    const texture = getUI(scene)

    const root = box("skills_root", `${PANEL_W}px`, `${PANEL_H}px`)
    // clicks on the window stay on the window, not the world behind it
    root.isPointerBlocker = true
    root.addControl(image("skills_bg", `${FRAMES}/rightbigcont.webp`))
    // a smaller screen than the window - it shrinks, centred
    root.onBeforeDrawObservable.add(() => {
        const size = texture.getSize()
        const fit = Math.min(1, size.width * 0.96 / PANEL_W, size.height * 0.96 / PANEL_H)
        if(root.scaleX !== fit){
            root.scaleX = fit
            root.scaleY = fit
        }
    })

    // --- left: the list ---
    const listBox = place(box("skills_list_box", "342px", "560px"), 30, 20)
    listBox.addControl(image("skills_list_bg", `${FRAMES}/leftbox.webp`))
    root.addControl(listBox)

    const scroll = place(new GUI.ScrollViewer("skills_list_scroll"), 30, 100)
    scroll.width = "282px"
    scroll.height = "410px"
    scroll.thickness = 0
    scroll.barSize = 8
    scroll.barColor = GOLD
    scroll.barBackground = "rgba(255,255,255,0.08)"
    listBox.addControl(scroll)

    const list = new GUI.StackPanel("skills_list")
    // short of the scroll's width by the bar, so it never wants a sideways one
    list.width = "270px"
    list.spacing = 14
    list.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    scroll.addControl(list)

    // --- right: the skill picked ---
    const infoBox = place(box("skills_info_box", "513px", "560px"), 372, 20)
    infoBox.addControl(image("skills_info_bg", `${FRAMES}/rightbox.webp`))
    root.addControl(infoBox)

    const info = new GUI.StackPanel("skills_info")
    info.width = "433px"
    info.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP
    info.top = "52px"
    infoBox.addControl(info)

    const ring = box("skills_info_ring", "164px", "164px")
    ring.addControl(image("skills_info_ring_bg", `${FRAMES}/skillring.webp`))
    // an ellipse clips what it holds to itself - the icon comes out round
    const portrait = new GUI.Ellipse("skills_info_portrait")
    portrait.width = "107px"
    portrait.height = "107px"
    portrait.thickness = 0
    const portraitImg = image("skills_info_img", "")
    portrait.addControl(portraitImg)
    ring.addControl(portrait)
    info.addControl(ring)

    info.addControl(box("skills_gap1", "100%", "18px"))

    const header = box("skills_info_header", "100%", "34px")
    const title = leftText("skills_info_title", "", 22, NAME_COLOR, "34px")
    title.width = "330px"
    header.addControl(title)
    const pill = box("skills_info_pill", "80px", "24px")
    pill.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT
    pill.thickness = 1
    pill.cornerRadius = 10
    const pillText = createText("skills_info_pill_text", "", { fontSize: 13, color: MUTED, height: "24px" })
    pill.addControl(pillText)
    header.addControl(pill)
    info.addControl(header)

    info.addControl(box("skills_gap2", "100%", "12px"))
    const rule = name => {
        const line = box(name, "100%", "1px")
        line.background = "rgba(255,255,255,0.1)"
        return line
    }
    info.addControl(rule("skills_rule1"))
    const statValues = {}
    ;[["type", "Type"], ["rank", "Rank"], ["cost", "Mana Cost"], ["cooldown", "Cooldown"]].forEach(([key, label]) => {
        const row = box(`skills_stat_${key}`, "100%", "25px")
        row.addControl(leftText(`skills_stat_${key}_label`, label, 14, MUTED, "25px"))
        const value = rightText(`skills_stat_${key}_value`, "", 14, VALUE_COLOR, "25px")
        value.width = "260px"
        row.addControl(value)
        statValues[key] = value
        info.addControl(row)
    })
    info.addControl(rule("skills_rule2"))

    const desc = createText("skills_info_desc", "", {
        fontSize: 13, color: DESC_COLOR, wrap: true, resizeToFit: true, paddingTop: "12px",
        align: GUI.Control.HORIZONTAL_ALIGNMENT_LEFT,
    })
    desc.lineSpacing = "4px"
    info.addControl(desc)

    info.addControl(box("skills_gap3", "100%", "14px"))
    const assign = box("skills_assign", "100%", "36px")
    assign.thickness = 1
    assign.cornerRadius = 4
    assign.hoverCursor = "pointer"
    assign.isPointerBlocker = true
    const assignText = createText("skills_assign_text", "", { fontSize: 13, height: "36px" })
    assign.addControl(assignText)
    const assignLook = () => ASSIGN_LOOK[assign.metadata?.look ?? "assign"]
    assign.onPointerEnterObservable.add(() => { assign.background = assignLook().hover })
    assign.onPointerOutObservable.add(() => { assign.background = assignLook().idle })
    assign.onPointerClickObservable.add(() => lastView?.onAssign())
    info.addControl(assign)

    // the old close-parent shield, top right
    const close = GUI.Button.CreateImageOnlyButton("skills_close", "./images/UI/xshield.png")
    close.width = "50px"
    close.height = "50px"
    close.thickness = 0
    close.hoverCursor = "pointer"
    close.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT
    close.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP
    close.left = "9px"
    close.top = "-6px"
    close.onPointerClickObservable.add(() => openCloseSkillsPanel(false))
    root.addControl(close)

    root.isVisible = false
    texture.addControl(root)
    panel = {
        scene, root, list, infoBox, rows: [],
        portraitImg, title, pill, pillText, statValues, desc, assign, assignText,
        shimmer: null,
    }
    return panel
}

// a row in the list
function buildRow(skill, view){
    const d = view.describe(skill)
    const row = box(`skills_row_${skill.name}`, "100%", "70px")
    row.thickness = 1
    row.cornerRadius = 4
    row.hoverCursor = "pointer"
    row.isPointerBlocker = true
    row.addControl(image(`skills_row_${skill.name}_bg`, `${FRAMES}/skillbox.webp`))

    const icon = place(image(`skills_row_${skill.name}_icon`, `./images/skills/${skill.name}.webp`, "50px", "50px"), 14, 10)
    row.addControl(icon)

    const name = place(leftText(`skills_row_${skill.name}_name`, skill.displayName, 15, NAME_COLOR, "22px"), 76, 13)
    name.width = "120px"
    row.addControl(name)
    row.addControl(place(leftText(`skills_row_${skill.name}_lvl`, `Lv. ${skill.lvl}`, 12, MUTED, "18px"), 76, 36))

    const status = rightText(`skills_row_${skill.name}_status`, skill.isActive ? "Active" : "Inactive", 12, skill.isActive ? ACTIVE_COLOR : MUTED, "18px")
    status.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP
    status.top = "14px"
    status.left = "-14px"
    row.addControl(status)
    const slot = rightText(`skills_row_${skill.name}_slot`, d.slotLabel, 10, d.equipped ? "#f8d584" : "rgb(173,173,166)", "16px")
    slot.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP
    slot.top = "36px"
    slot.left = "-14px"
    row.addControl(slot)

    row.onPointerEnterObservable.add(() => { if(row.metadata?.selected !== true) row.color = ROW_BORDER.hover })
    row.onPointerOutObservable.add(() => { if(row.metadata?.selected !== true) row.color = ROW_BORDER.idle })
    row.onPointerClickObservable.add(() => lastView?.onSelect(skill))
    return { row, skill }
}

function markSelected(rows, selectedName){
    rows.forEach(({ row, skill }) => {
        const selected = skill.name === selectedName
        row.metadata = { selected }
        row.color = selected ? ROW_BORDER.selected : ROW_BORDER.idle
        row.background = selected ? "rgba(202,165,1,0.08)" : ""
    })
}

// rank 4 - "God Tier" - its rank glimmers gold-white while the window's open
function startShimmer(text){
    stopShimmer()
    const from = { r: 1, g: 0.965, b: 0.816 }, to = { r: 0.941, g: 0.788, b: 0.29 }
    const hex = v => Math.round(v * 255).toString(16).padStart(2, "0")
    let t = 0
    panel.shimmer = panel.scene.onBeforeRenderObservable.add(() => {
        t += panel.scene.getEngine().getDeltaTime() / 1000
        const k = (Math.sin(t * Math.PI * 2 / 1.5) + 1) / 2
        text.color = `#${hex(from.r + (to.r - from.r) * k)}${hex(from.g + (to.g - from.g) * k)}${hex(from.b + (to.b - from.b) * k)}`
        text.shadowBlur = 6 + 10 * k
    })
}
function stopShimmer(){
    if(panel?.shimmer) panel.scene.onBeforeRenderObservable.remove(panel.shimmer)
    if(panel) panel.shimmer = null
}

function drawInfo(skill, view){
    const d = view.describe(skill)
    panel.portraitImg.source = `./images/skills/${skill.name}.webp`
    panel.title.text = skill.displayName
    panel.pillText.text = skill.isActive ? "Active" : "Inactive"
    panel.pillText.color = skill.isActive ? ACTIVE_COLOR : MUTED
    panel.pill.color = skill.isActive ? "rgba(237,213,159,0.5)" : "rgba(177,177,177,0.3)"

    const { statValues } = panel
    statValues.type.text = d.type
    statValues.cost.text = d.cost
    statValues.cooldown.text = d.cooldown
    const look = RANK_LOOK[d.rank] ?? RANK_LOOK[0]
    const rank = statValues.rank
    rank.text = d.rankLabel
    rank.color = look.value
    rank.fontFamily = look.font ?? FONT_BODY
    rank.fontStyle = look.style ?? ""
    rank.fontWeight = look.weight ?? ""
    rank.shadowColor = look.glow ?? "transparent"
    rank.shadowBlur = look.blur ?? 0
    if(look.shimmer) startShimmer(rank)
    else stopShimmer()

    panel.desc.text = skill.desc ?? ""
    panel.desc.color = look.desc

    const assignLook = d.equipped ? "remove" : "assign"
    const a = ASSIGN_LOOK[assignLook]
    panel.assign.metadata = { look: assignLook }
    panel.assign.color = a.border
    panel.assign.background = a.idle
    panel.assignText.color = a.text
    panel.assignText.text = d.equipped ? "Remove from Slot" : "Assign to Slot"
}

function draw(view){
    const { list } = panel
    // a few skills - rebuilt whole rather than diffed
    panel.rows.forEach(({ row }) => row.dispose())
    panel.rows = view.skills.map(skill => buildRow(skill, view))
    panel.rows.forEach(({ row }) => list.addControl(row))
    markSelected(panel.rows, view.selectedName)
    const selected = view.skills.find(skill => skill.name === view.selectedName)
    panel.infoBox.isVisible = !!selected
    if(selected) drawInfo(selected, view)
    else stopShimmer()
}

// SkillsView (skillsui.js builds it): { skills, selectedName,
// describe(skill) -> { type, rank, rankLabel, cost, cooldown, equipped,
// slotLabel }, onSelect(skill), onAssign() }. Drawn now if the window's open,
// kept for when it next opens otherwise.
export function renderSkillsPanel(view){
    lastView = view
    if(isOpen && panel) draw(view)
}

export function isSkillsPanelOpen(){
    return isOpen
}

// forceOpen omitted toggles, the same as openCloseCampcraftUI
export function openCloseSkillsPanel(forceOpen){
    const scene = getSceneDet()?.scene
    if(!scene) return
    if(!panel || panel.scene !== scene) buildPanel(scene)

    const willOpen = forceOpen !== undefined ? forceOpen : !isOpen
    if(willOpen === isOpen) return
    isOpen = willOpen
    panel.root.isVisible = willOpen
    // a closed window costs nothing - the layer is what draws it
    ui.layer.isEnabled = willOpen
    hideShowAllScreenUI(!willOpen)
    if(willOpen && lastView) draw(lastView)
    if(!willOpen) stopShimmer()
}
