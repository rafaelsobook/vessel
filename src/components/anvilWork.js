import { Color3, Mesh, MeshBuilder, StandardMaterial, Vector3 } from "@babylonjs/core"
import * as GUI from "@babylonjs/gui"
import { getCharState } from "../charactersystem/characterstate.js"
import { getPlayersOnScene } from "../sockets/worldsocket.js"
import { faceAttackTarget } from "../controllers/inputMovement.js"
import { sparkBurst } from "../effects/blessingFx.js"
import { getAllSounds, playSoundNear } from "./soundSystem.js"
import { ITEM_DICTIONARY, computeCraftedWeaponStats, weaponElements } from "../staticRecources/itemDictionary.js"
import { getPartVariants } from "../assetcreation/createweapon.js"
import { obtain } from "../charactersystem/inventory.js"
import { randomNum } from "../tools/tools.js"
import { GOLD, GOLD_BRIGHT, TEXT_MUTED, FONT_BODY, FONT_NUM, createText } from "./guiKit.js"
import { addGlow } from "../tools/glow.js"
import { receiveAchievement } from "../charactersystem/achievement.js"

// THE ANVIL (assetcreation/createstructure.js's "anvil", built from campcraft.js)
//
//  - Walk up to one (NEAR_RADIUS) and two ore slots appear over it: a GUI drawn
//    on a plane that always faces the camera (AdvancedDynamicTexture.
//    CreateForMesh). Click an empty slot and the ores you carry come up to
//    choose from; click a filled one to take its ore back out. The two have to
//    be different ores. Only you see your slots - each client draws its own.
//  - Press attack while you're near it WITH A HAMMER IN HAND and you turn to it
//    and hammer (avatar.glb's "hammering") instead of swinging
//    (uimanagement.js asks getNearbyAnvil). Only a hammer works an anvil -
//    anything else swings as usual. It rides the ordinary attack relay, so everyone sees it,
//    and every client throws sparks off the anvil and plays the anvil-hit
//    and weaponblock sounds together on the blow (hammerStruck, from attackingSystem.js's attack()) -
//    heard by anyone close enough, not the whole place.
//
//  - Fill both slots and the panel goes, and the bar of ore lying on the
//    anvil's face shows (anvil.glb's "ore" - createstructure.js keeps every
//    anvil's own copy apart from the rest, hidden). Every blow on it throws
//    fiery sparks and heats it: it glows dull red, then orange, then yellow-
//    white the more it's struck, cooling off slowly between blows. The blow's
//    relay carries anvilOre, so everyone else sees the ore show and glow too
//    while it's being worked.
//
//  - FORGING A SWORD: the first slot is the blade's ore, the second the
//    guard's (the same ore may go in both, if you carry two). With both in, a
//    bar over the anvil (another CreateForMesh plane) fills with each of YOUR
//    blows - an everyday ore in few, a rare one in many (HITS_BY_RARITY) - and
//    drains back to nothing if you leave it be. Full, the two ores are spent
//    and the sword is yours (forgeSword): the blade ore's rarity sets the tier
//    of every part, and the ores their metals.
//
// Putting an ore in a slot only chooses it - it stays in your inventory until
// the sword's done, so walking off or leaving loses nothing.

export const HAMMER_CLIP = "hammering"
// how far into the clip the hammer comes down on the anvil - measured off
// avatar.glb's hand.R: raised highest at ~0.7, back down by ~0.86
const HAMMER_IMPACT_AT = 0.86
const HAMMER_CLIP_MS = 830
// how close (XZ, body to the anvil's centre) counts as "at" it
const NEAR_RADIUS = 2.2
const CHECK_EVERY_N_FRAMES = 6
// the panel: this big in the world, its bottom this far over the anvil's top
const PANEL_WIDTH = 1.5
const PANEL_HEIGHT = 1.15
const PANEL_ABOVE = 0.25
const PANEL_PX = { w: 520, h: 400 }
const SLOT_PX = 140
const PICK_PX = 82
const PICK_PER_ROW = 5
const SPARK_COLOR = new Color3(1, 0.62, 0.2)
// the ore being worked: how much each blow heats it (0..1, 1 white-hot), how
// fast it cools (per second), and its colours on the way up - cold it's
// plain dark iron
const HEAT_PER_HIT = 0.3
const HEAT_LOSS_PER_SEC = 0.05
const ORE_COLD = new Color3(0.27, 0.26, 0.25)
const ORE_HOT_SURFACE = new Color3(0.5, 0.12, 0.04)
const HEAT_GLOW = [
    [0,    new Color3(0, 0, 0)],
    [0.15, new Color3(0.45, 0.05, 0)],      // dull red
    [0.5,  new Color3(1, 0.36, 0.04)],      // orange
    [1,    new Color3(1, 0.78, 0.42)],      // yellow-white
]
const ORE_SPARK_COLOR = new Color3(1, 0.5, 0.08)
const ORE_GLOW_BRIGHTNESS = 0.9

// forging: the slots' parts, in order
const SLOT_PARTS = ["blade", "guard"]
const SLOT_LABELS = ["Blade", "Guard"]
// blows a sword takes, by its ores' rarity (the two averaged) - an everyday
// ore works fast, a rare one makes you earn it
const HITS_BY_RARITY = { common: 5, uncommon: 7, rare: 10, epic: 14, legendary: 18 }
const DEFAULT_HITS = 7
// left alone, the work goes cold: after this long without a blow, the bar
// drains this much (of a full bar) a second
const WORK_IDLE_MS = 3000
const WORK_LOSS_PER_SEC = 0.04
// which of allswords.glb's mesh tiers the sword gets, by the blade ore's
// rarity - rare and up get the rare meshes; the epic1 meshes stay with the
// epic recipes (craftingui.js), which bring the accent colours they need
const TIER_BY_RARITY = { common: "common", uncommon: "common", rare: "rare", epic: "rare", legendary: "rare" }
const FORGE_BAR_FILL = "#ff9a2e"
const FORGED_SPARK_COLOR = new Color3(1, 0.85, 0.4)

// the items that count as ore - every metal (itemDictionary.js) and anything named "...ore"
export function isOre(item){
    return ITEM_DICTIONARY[item.name]?.category === "metal" || item.name.endsWith("ore")
}

const oreIcon = name => `./images/items/crafting/${name}.webp`

// one per scene - changeScene() disposes the old one along with its anvils
let state = null

function getState(scene){
    if(state?.scene === scene) return state
    // forges: anvil -> { ore, mat, heat } for every anvil with an ore to work
    // work: anvil -> { value 0..1, lastHitAt } - my own forging progress on it
    // bar: the progress bar over the anvil I'm at, while I'm forging there
    const s = { scene, anvils: new Set(), forges: new Map(), work: new Map(), near: null, panel: null, bar: null, frame: 0 }
    state = s
    scene.onBeforeRenderObservable.add(() => {
        const dt = scene.getEngine().getDeltaTime() / 1000
        coolOres(s, dt)
        drainWork(s, dt)
        if(++s.frame % CHECK_EVERY_N_FRAMES) return
        tick(s)
    })
    return s
}

// the ores chosen at each anvil - kept per anvil, so stepping away and back
// finds them as you left them
const chosenAt = new WeakMap()
const chosen = anvil => {
    let slots = chosenAt.get(anvil)
    if(!slots){ slots = [null, null]; chosenAt.set(anvil, slots) }
    return slots
}

export function armAnvil(scene, mesh){
    const s = getState(scene)
    s.anvils.add(mesh)
    // its own ore bar (createstructure.js's def.loose), with a material of its
    // own to heat - hidden till there's ore on the anvil
    const ore = mesh._loose?.ore
    if(ore){
        const mat = new StandardMaterial(`anvilOreMat_${mesh.name}`, scene)
        mat.diffuseColor = ORE_COLD.clone()
        mat.specularColor = new Color3(0.3, 0.3, 0.32)
        mat.emissiveColor = Color3.Black()
        mat.maxSimultaneousLights = 8
        ore.material = mat
        ore.isVisible = false
        // the bloom reads the emissive colour every frame (tools/glow.js) - cold, it's black: no glow
        addGlow(scene, ore, ORE_GLOW_BRIGHTNESS)
        s.forges.set(mesh, { ore, mat, heat: 0 })
    }
    mesh.onDisposeObservable.add(() => {
        s.anvils.delete(mesh)
        s.forges.delete(mesh)
        s.work.delete(mesh)
        if(s.near === mesh) closePanel(s)
        if(s.bar?.anvil === mesh) closeBar(s)
    })
}

// both slots filled - there's ore on the anvil (for me)
const isLoaded = anvil => chosen(anvil).every(Boolean)

// ores no longer carried (sold, used) come out of their slots - the guard's
// first, when one ore fills both and only one's left
function dropMissingOres(anvil){
    const owned = ownedOres()
    const slots = chosen(anvil)
    for(let i = slots.length - 1; i >= 0; i--){
        const name = slots[i]
        if(!name) continue
        const carried = owned.find(o => o.name === name)?.qnty ?? 0
        const placed = slots.filter(n => n === name).length
        if(carried < placed) slots[i] = null
    }
}

// the ore shows while it's on the anvil for me, or still hot from someone's blows
function showOre(s, anvil){
    const forge = s.forges.get(anvil)
    if(forge) forge.ore.isVisible = isLoaded(anvil) || forge.heat > 0
}

// the glow colour of a 0..1 heat, into out
function heatGlow(heat, out){
    let i = 1
    while(i < HEAT_GLOW.length - 1 && heat > HEAT_GLOW[i][0]) i++
    const [from, fromColor] = HEAT_GLOW[i - 1]
    const [to, toColor] = HEAT_GLOW[i]
    return Color3.LerpToRef(fromColor, toColor, Math.min(1, Math.max(0, (heat - from) / (to - from))), out)
}

function applyHeat(forge){
    heatGlow(forge.heat, forge.mat.emissiveColor)
    // the hotter, the more the surface itself goes from iron-grey to red
    Color3.LerpToRef(ORE_COLD, ORE_HOT_SURFACE, Math.min(1, forge.heat * 1.5), forge.mat.diffuseColor)
}

function coolOres(s, dt){
    s.forges.forEach((forge, anvil) => {
        if(forge.heat <= 0) return
        forge.heat = Math.max(0, forge.heat - HEAT_LOSS_PER_SEC * dt)
        applyHeat(forge)
        if(forge.heat === 0) showOre(s, anvil)
    })
}

function myPlayer(){
    const owner = getCharState()?.owner
    return owner ? getPlayersOnScene().find(pl => pl.owner === owner) : null
}

const flatDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)

function tick(s){
    const me = myPlayer()
    let near = null, best = NEAR_RADIUS
    if(me?.body && !me.body.isDisposed()) s.anvils.forEach(anvil => {
        const d = flatDist(anvil.position, me.body.position)
        if(d <= best){ best = d; near = anvil }
    })
    if(near !== s.near){
        closePanel(s)
        closeBar(s)
        s.near = near
    }
    if(!near) return
    dropMissingOres(near)
    // both ores in: the slots give way to the ore itself, and the forging bar
    const loaded = isLoaded(near)
    if(loaded && s.panel) closePanel(s)
    else if(!loaded && !s.panel) openPanel(s, near)
    else if(s.panel) refreshPanel(s)
    if(loaded && !s.bar) openBar(s, near)
    else if(!loaded && s.bar) closeBar(s)
    if(s.bar) labelBar(s)
    showOre(s, near)
}

// am I holding a hammer - the only thing that works an anvil
function holdingHammer(){
    return !!getCharState()?.items.some(item => item.itemType === "weapon" && item.equiped && item.weaponType === "hammer")
}

// what's being forged - or, with no hammer in hand, what's missing to forge it
function labelBar(s){
    const text = holdingHammer() ? `Forging ${metalName(chosen(s.bar.anvil)[0])} Sword` : "Equip a hammer to forge"
    if(s.bar.label.text !== text) s.bar.label.text = text
}

// the anvil I'm standing at, or null - the attack button hammers on it
export function getNearbyAnvil(){
    const anvil = state?.near
    return anvil && !anvil.isDisposed() ? anvil : null
}

// turns me to the anvil for the length of the blow, and gives back the attack
// relay's info aimed at it (so everyone else sees me turn to it too) - not a
// swing at anyone: no lunge
export function aimAtAnvil(anvil, attackInfo){
    const at = anvil.position
    faceAttackTarget(at, HAMMER_CLIP_MS)
    // anvilOre: there's ore on it to work - everyone watching shows it and heats it
    return { ...attackInfo, dirTarg: { x: at.x, y: attackInfo.pos?.y ?? at.y, z: at.z }, lunge: undefined, anvilOre: isLoaded(anvil) }
}

// someone's hammer coming down (attackingSystem.js's attack(), on every
// client): sparks off the top of the anvil they're aimed at, and a clang -
// and with ore on it (onOre), the ore takes the blow: fiery sparks off it, and
// it heats up. mine: it's my own blow - with my ores on the anvil, it forges
export function hammerStruck(dirTarg, speedRatio = 1, onOre = false, mine = false){
    const s = state
    if(!s || !dirTarg) return
    let anvil = null, best = 1.5
    s.anvils.forEach(a => {
        const d = flatDist(a.position, dirTarg)
        if(d <= best){ best = d; anvil = a }
    })
    if(!anvil) return
    setTimeout(() => {
        if(anvil.isDisposed() || s.scene.isDisposed) return
        const top = anvil.getBoundingInfo().boundingBox.maximumWorld.y
        const struckAt = new Vector3(anvil.position.x, top + 0.02, anvil.position.z)
        const forge = onOre ? s.forges.get(anvil) : null
        if(forge){
            forge.heat = Math.min(1, forge.heat + HEAT_PER_HIT)
            applyHeat(forge)
            showOre(s, anvil)
            forge.ore.computeWorldMatrix(true)
            const bar = forge.ore.getBoundingInfo().boundingBox
            const hit = bar.centerWorld.clone()
            hit.y = bar.maximumWorld.y + 0.02
            // the hotter it is, the more fire comes off it
            sparkBurst(s.scene, hit, ORE_SPARK_COLOR, { count: Math.round(30 + 40 * forge.heat), power: 3.5 + 2 * forge.heat, size: [0.1, 0.3], life: [0.3, 0.8] })
        } else {
            sparkBurst(s.scene, struckAt, SPARK_COLOR, { count: 26, power: 3, size: [0.12, 0.28], life: [0.25, 0.55] })
        }
        // the anvil's own ring, over the clang a raised guard makes when it
        // takes a blow - only within earshot of the anvil, not from across the map
        const sounds = getAllSounds()
        playSoundNear(sounds?.anvilHitS, struckAt)
        playSoundNear(sounds?.weaponblockS, struckAt)
        if(mine && isLoaded(anvil)) forgeBlow(s, anvil)
    }, HAMMER_CLIP_MS * HAMMER_IMPACT_AT / speedRatio)
}

// ── the panel over the anvil ──────────────────────────────────────────────────

function openPanel(s, anvil){
    const top = anvil.getBoundingInfo().boundingBox.maximumWorld.y
    const plane = MeshBuilder.CreatePlane("anvilPanel", { width: PANEL_WIDTH, height: PANEL_HEIGHT }, s.scene)
    plane.position.set(anvil.position.x, top + PANEL_ABOVE + PANEL_HEIGHT / 2, anvil.position.z)
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL
    plane.applyFog = false
    // drawn over everything - you stand between the camera and the anvil to
    // work it, and your own body would otherwise hide the slots
    plane.renderingGroupId = 1
    // picked by the GUI for its clicks
    plane.isPickable = true
    const ui = GUI.AdvancedDynamicTexture.CreateForMesh(plane, PANEL_PX.w, PANEL_PX.h)

    const slotRow = new GUI.StackPanel("anvilSlots")
    slotRow.isVertical = false
    slotRow.height = `${SLOT_PX + 30}px`
    slotRow.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM
    ui.addControl(slotRow)

    const slots = [0, 1].map(i => {
        const box = new GUI.Rectangle(`anvilSlot${i}`)
        box.width = `${SLOT_PX}px`
        box.height = `${SLOT_PX}px`
        box.thickness = 3
        box.color = GOLD
        box.cornerRadius = 12
        box.background = "rgba(10,8,4,0.72)"
        box.paddingLeft = "10px"
        box.paddingRight = "10px"
        // which part of the sword this slot's ore becomes
        const part = createText(`anvilSlot${i}_part`, SLOT_LABELS[i], { fontFamily: FONT_BODY, fontSize: 19, color: GOLD, height: "24px" })
        part.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP
        part.top = "6px"
        box.addControl(part)
        const icon = new GUI.Image(`anvilSlot${i}_icon`, "")
        icon.width = "68px"
        icon.height = "68px"
        icon.top = "2px"
        icon.isVisible = false
        box.addControl(icon)
        const plus = createText(`anvilSlot${i}_plus`, "+", { fontFamily: FONT_NUM, fontSize: 52, color: GOLD, height: "66px" })
        plus.top = "2px"
        box.addControl(plus)
        const name = createText(`anvilSlot${i}_name`, "Ore", { fontFamily: FONT_BODY, fontSize: 18, color: TEXT_MUTED, height: "24px" })
        name.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM
        name.top = "-6px"
        box.addControl(name)
        box.onPointerClickObservable.add(() => clickSlot(s, i))
        box.onPointerEnterObservable.add(() => { box.color = GOLD_BRIGHT })
        box.onPointerOutObservable.add(() => { box.color = GOLD })
        slotRow.addControl(box)
        return { box, icon, plus, name }
    })

    const hint = createText("anvilHint", "", { fontFamily: FONT_BODY, fontSize: 20, color: GOLD_BRIGHT, height: "28px" })
    hint.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM
    hint.top = `-${SLOT_PX + 22}px`
    hint.outlineWidth = 3
    hint.outlineColor = "black"
    ui.addControl(hint)

    // the ores to choose from - above the slots, only while a slot is being filled
    const picker = new GUI.Rectangle("anvilPicker")
    picker.width = "100%"
    // leaving a band between it and the slots for the hint
    picker.height = `${PANEL_PX.h - SLOT_PX - 72}px`
    picker.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP
    picker.thickness = 2
    picker.color = GOLD
    picker.cornerRadius = 12
    picker.background = "rgba(10,8,4,0.82)"
    picker.isVisible = false
    ui.addControl(picker)

    s.panel = { anvil, plane, ui, slots, hint, picker, picking: null, shownKey: null }
    refreshPanel(s)
}

function closePanel(s){
    if(!s.panel) return
    s.panel.ui.dispose()
    s.panel.plane.dispose()
    s.panel = null
}

function ownedOres(){
    return (getCharState()?.items ?? []).filter(item => isOre(item) && item.qnty > 0)
}

function clickSlot(s, i){
    const p = s.panel
    if(!p) return
    const slots = chosen(p.anvil)
    if(slots[i]){
        // take it back out
        slots[i] = null
        p.picking = null
    } else {
        p.picking = p.picking === i ? null : i
    }
    refreshPanel(s)
}

function pickOre(s, name){
    const p = s.panel
    if(!p || p.picking === null) return
    chosen(p.anvil)[p.picking] = name
    p.picking = null
    // the ore drops into its slot - only I hear it, it's my own panel
    getAllSounds()?.insertStoneS?.play()
    // the second one in: the slots give way to the ore on the anvil
    const anvil = p.anvil
    if(isLoaded(anvil)){
        closePanel(s)
        showOre(s, anvil)
        return
    }
    refreshPanel(s)
}

// brings the slots, hint and picker up to date with what's chosen and carried -
// cheap when nothing changed, so it runs on every tick while the panel is up
function refreshPanel(s){
    const p = s.panel
    if(!p) return
    dropMissingOres(p.anvil)
    const owned = ownedOres()
    const slots = chosen(p.anvil)

    const key = JSON.stringify([slots, p.picking, owned.map(o => `${o.name}:${o.qnty}`)])
    if(key === p.shownKey) return
    p.shownKey = key

    p.slots.forEach((slot, i) => {
        const name = slots[i]
        slot.icon.isVisible = !!name
        slot.plus.isVisible = !name
        if(name) slot.icon.source = oreIcon(name)
        slot.name.text = name ? (ITEM_DICTIONARY[name]?.dn ?? owned.find(o => o.name === name)?.dn ?? name) : "Ore"
        slot.name.color = name ? GOLD_BRIGHT : TEXT_MUTED
        slot.box.thickness = p.picking === i ? 5 : 3
        slot.box.background = p.picking === i ? "rgba(202,165,1,0.25)" : "rgba(10,8,4,0.72)"
    })

    const filled = slots.filter(Boolean).length
    p.hint.text = p.picking !== null ? `Choose the ${SLOT_PARTS[p.picking]}'s ore` : filled < 2 ? "Place the blade and guard ores" : ""

    buildPicker(s, owned, slots)
}

function buildPicker(s, owned, slots){
    const p = s.panel
    p.picker.clearControls()
    p.picker.isVisible = p.picking !== null
    if(p.picking === null) return

    // the other slot's ore goes in this one too only if there's a second of it
    const other = slots[1 - p.picking]
    const choices = owned.filter(o => o.name !== other || o.qnty >= 2)
    if(!choices.length){
        p.picker.addControl(createText("anvilPickerNone", other ? "You carry no other ore" : "You carry no ore", {
            fontFamily: FONT_BODY, fontSize: 22, color: TEXT_MUTED, height: "40px",
        }))
        return
    }

    const rows = new GUI.StackPanel("anvilPickerRows")
    p.picker.addControl(rows)
    for(let r = 0; r * PICK_PER_ROW < choices.length; r++){
        const row = new GUI.StackPanel(`anvilPickerRow${r}`)
        row.isVertical = false
        row.height = `${PICK_PX + 8}px`
        rows.addControl(row)
        choices.slice(r * PICK_PER_ROW, (r + 1) * PICK_PER_ROW).forEach(ore => {
            const btn = new GUI.Rectangle(`anvilPick_${ore.name}`)
            btn.width = `${PICK_PX}px`
            btn.height = `${PICK_PX}px`
            btn.thickness = 2
            btn.color = GOLD
            btn.cornerRadius = 8
            btn.paddingLeft = "4px"
            btn.paddingRight = "4px"
            btn.background = "rgba(0,0,0,0.45)"
            const icon = new GUI.Image(`anvilPick_${ore.name}_icon`, oreIcon(ore.name))
            icon.width = "56px"
            icon.height = "56px"
            icon.top = "-6px"
            btn.addControl(icon)
            const qnty = createText(`anvilPick_${ore.name}_qnty`, `x${ore.qnty}`, { fontFamily: FONT_NUM, fontSize: 15, color: GOLD_BRIGHT, height: "20px" })
            qnty.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM
            btn.addControl(qnty)
            btn.onPointerClickObservable.add(() => pickOre(s, ore.name))
            btn.onPointerEnterObservable.add(() => { btn.color = GOLD_BRIGHT })
            btn.onPointerOutObservable.add(() => { btn.color = GOLD })
            row.addControl(btn)
        })
    }
}

// ── forging ───────────────────────────────────────────────────────────────────

const carriedItem = name => getCharState()?.items.find(item => item.name === name)
const metalName = name => (ITEM_DICTIONARY[name]?.dn ?? carriedItem(name)?.dn ?? name).replace(/ Ore$/, "")

// blows the ores on this anvil take to forge - their rarities' HITS_BY_RARITY, averaged
function hitsNeeded(anvil){
    const hits = chosen(anvil).map(name => HITS_BY_RARITY[carriedItem(name)?.rarity] ?? DEFAULT_HITS)
    return Math.max(1, Math.round(hits.reduce((a, b) => a + b, 0) / hits.length))
}

function workOn(s, anvil){
    let work = s.work.get(anvil)
    if(!work){ work = { value: 0, lastHitAt: 0 }; s.work.set(anvil, work) }
    return work
}

function forgeBlow(s, anvil){
    const work = workOn(s, anvil)
    work.value = Math.min(1, work.value + 1 / hitsNeeded(anvil))
    work.lastHitAt = performance.now()
    showWork(s, anvil)
    if(work.value >= 1) finishForging(s, anvil)
}

// left alone, the work cools off and the bar drains back to nothing
function drainWork(s, dt){
    const now = performance.now()
    s.work.forEach((work, anvil) => {
        if(work.value <= 0 || now - work.lastHitAt < WORK_IDLE_MS) return
        work.value = Math.max(0, work.value - WORK_LOSS_PER_SEC * dt)
        showWork(s, anvil)
    })
}

function showWork(s, anvil){
    if(s.bar?.anvil !== anvil) return
    s.bar.fill.width = `${(s.work.get(anvil)?.value ?? 0) * 100}%`
}

// The sword the two ores on this anvil make - the same item shape
// craftingui.js's crafting table builds. The blade ore's rarity sets the tier
// of every part's mesh (TIER_BY_RARITY) and the sword's own rarity; the blade
// is its metal, the guard and pommel the guard ore's, and the grip is leather
// on a rare sword, wood on a common one. Stats and elements come from those
// four materials, as the crafting table's do (itemDictionary.js).
export function forgeSword(bladeOre, guardOre){
    const tier = TIER_BY_RARITY[bladeOre.rarity] ?? "common"
    const grip = tier === "rare" ? "leather" : "wood"
    const materials = {
        blade: { materialName: bladeOre.name },
        guard: { materialName: guardOre.name },
        handle: { materialName: grip },
        pommel: { materialName: guardOre.name },
    }
    const { dmg, magicDmg, durabilityMax, magicResistance } = computeCraftedWeaponStats(materials)
    const tint = name => ITEM_DICTIONARY[name]?.tintKey ?? "iron"
    const variant = part => {
        const variants = getPartVariants("sword", part, tier)
        return variants[Math.floor(Math.random() * variants.length)]
    }
    const blade = metalName(bladeOre.name), guard = metalName(guardOre.name)
    const dn = `${blade} Sword`
    return {
        itemId: randomNum(),
        // unique - a crafted sword's look is random, and createcharacter.js
        // caches a weapon's mesh by its name
        name: `customsword_${Date.now()}`,
        dn,
        itemCateg: "equipable",
        itemType: "weapon",
        weaponType: "sword",
        effectsWhenHit: [
            { effectName: "bash", distanceKnockback: 4, triggerWhen: "critical", particlesystem: null, texture: null },
        ],
        equipAbilities: { dmg, magicDmg, magicResistance, def: 0, plusStr: 0, plusDex: 0, plusInt: 0 },
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: tier === "rare" ? 1 : 0 },
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true,
        enhancedLevel: 0,
        slots: [],
        durability: { current: durabilityMax, max: durabilityMax },
        // worth a good deal more than the ore that went into it
        price: { coinType: "bronze", pieces: Math.max(5, 3 * ((bladeOre.price?.pieces ?? 4) + (guardOre.price?.pieces ?? 4))) },
        qnty: 1,
        desc: `${dn}, hammered out on an anvil - a ${blade.toLowerCase()} blade with a ${guard.toLowerCase()} guard and pommel, on a ${grip} grip.`,
        rarity: bladeOre.rarity ?? "common",
        parts: {
            bladeRarity: variant("blade"),
            guardRarity: variant("guard"),
            handleRarity: variant("handle"),
            pommelRarity: variant("pommel"),
            bladeColor: tint(bladeOre.name),
            guardColor: tint(guardOre.name),
            handleColor: tint(grip),
            pommelColor: tint(guardOre.name),
        },
        // the fire a Phoenix Ore part brings
        elements: weaponElements(materials),
    }
}

// a full bar: the two ores are spent and the sword is mine
function finishForging(s, anvil){
    const charState = getCharState()
    const [bladeName, guardName] = chosen(anvil)
    const bladeOre = carriedItem(bladeName), guardOre = carriedItem(guardName)
    const work = workOn(s, anvil)
    work.value = 0
    if(!charState || !bladeOre || !guardOre) return

    const sword = forgeSword(bladeOre, guardOre)
    ;[bladeName, guardName].forEach(name => {
        const owned = charState.items.find(item => item.name === name)
        if(!owned) return
        owned.qnty -= 1
        if(owned.qnty <= 0) charState.items = charState.items.filter(item => item !== owned)
    })
    chosenAt.set(anvil, [null, null])
    // obtain() adds it, pops its "acquired" toast and saves - the spent ores with it
    obtain(sword)
    getAllSounds()?.brokenS?.play()
    receiveAchievement("hammer-and-heat")

    // the ore became the sword - it goes, in a burst of sparks
    const forge = s.forges.get(anvil)
    if(forge){
        const bar = forge.ore.getBoundingInfo().boundingBox
        const at = bar.centerWorld.clone()
        at.y = bar.maximumWorld.y + 0.05
        sparkBurst(s.scene, at, FORGED_SPARK_COLOR, { count: 110, power: 6, size: [0.12, 0.35], life: [0.5, 1.1] })
        forge.heat = 0
        applyHeat(forge)
        showOre(s, anvil)
    }
    closeBar(s)
}

// ── the forging bar over the anvil ────────────────────────────────────────────

const BAR_PX = { w: 512, h: 140 }

function openBar(s, anvil){
    const top = anvil.getBoundingInfo().boundingBox.maximumWorld.y
    const plane = MeshBuilder.CreatePlane("anvilForgeBar", { width: 1.1, height: 0.3 }, s.scene)
    plane.position.set(anvil.position.x, top + 0.5, anvil.position.z)
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL
    plane.applyFog = false
    // over everything, like the slots - you stand between it and the camera
    plane.renderingGroupId = 1
    plane.isPickable = false
    const ui = GUI.AdvancedDynamicTexture.CreateForMesh(plane, BAR_PX.w, BAR_PX.h)

    const label = createText("anvilForgeLabel", "", { fontFamily: FONT_BODY, fontSize: 34, color: GOLD_BRIGHT, height: "48px" })
    label.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP
    label.outlineWidth = 5
    label.outlineColor = "black"
    ui.addControl(label)

    const track = new GUI.Rectangle("anvilForgeTrack")
    track.width = "440px"
    track.height = "40px"
    track.thickness = 3
    track.color = GOLD
    track.cornerRadius = 8
    track.background = "rgba(0,0,0,0.7)"
    track.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM
    track.top = "-20px"
    ui.addControl(track)

    const fill = new GUI.Rectangle("anvilForgeFill")
    fill.thickness = 0
    fill.width = "0%"
    fill.background = FORGE_BAR_FILL
    fill.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    track.addControl(fill)

    s.bar = { anvil, plane, ui, label, fill }
    labelBar(s)
    showWork(s, anvil)
}

function closeBar(s){
    if(!s.bar) return
    s.bar.ui.dispose()
    s.bar.plane.dispose()
    s.bar = null
}
