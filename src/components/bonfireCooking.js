import { Color3, LoadAssetContainerAsync, Matrix, Mesh, MeshBuilder, StandardMaterial, Texture, TransformNode, Vector3 } from "@babylonjs/core"
import * as GUI from "@babylonjs/gui"
import { getCharState, updateMyDetailsOL } from "../charactersystem/characterstate.js"
import { obtain, openUpdateInventory } from "../charactersystem/inventory.js"
import { canBeCooked, getCookableItems, itemIconPath, makeCookedItem, COOK_TIME_MS } from "../charactersystem/cooking.js"
import { createMushroomModel } from "../assetcreation/createmushroom.js"
import { getPlayersOnScene } from "../sockets/worldsocket.js"
import { openCloseInteractBtn, openClosePopup, getInteractBtnOwner, isInteractBtnVisible } from "../tools/popupUI.js"
import { checkIfTokenSaved } from "../tools/tools.js"
import { GOLD, GOLD_BRIGHT, TEXT_MUTED, FONT_TITLE, FONT_BODY, FONT_NUM, createNinePatchBg, createDivider, createText, createGoldButton, createWorldProgressBar } from "./guiKit.js"

// Cooking over a crafted bonfire (campcraft.js's "bonfire").
//
//  1. Walk up to a bonfire: the interact button shows the bonfire's own
//     campcraft picture. Pressing it opens a list of what you can cook - every
//     item in your inventory that carries a recipe (cooking.js), mushrooms for now.
//  2. Pick one: ONE of it comes out of your inventory and goes on a spit over
//     the fire - a stick through it, resting on a forked stick each side - and
//     turns there for COOK_TIME_MS, browning, with a progress bar above the
//     fire. bonfire.isCooking is true from now until it's picked up, so the
//     fire takes nothing else meanwhile.
//  3. Done: the interact button shows the mushroom. Pressing it hands you the
//     cooked item (cooking.js's makeCookedItem - `cooked: true`) and frees the fire.
//
// Leaving the place before picking it up never loses it: whatever's on the
// spit comes back to you - cooked if it was done, raw if it wasn't.
//
// Local to this player for now: nobody else sees your spit, and another
// player can cook at the same bonfire alongside you.

// the picture the campcraft list shows for the bonfire (campcraft.js's craftIconPath)
const BONFIRE_ICON = "./images/campcrafts/bonfire.webp"
// how close (XZ, to the body) the interact button shows
const INTERACT_RADIUS = 2.6
// a busy fire's progress bar shows within this distance - a linked GUI
// control draws on top of everything, walls included
const BAR_VIEW_RADIUS = 5
const CHECK_EVERY_N_FRAMES = 6
// the bar hangs over a point this far above the mushroom's top (world units),
// then this many pixels higher - anchored to the spit, not the fire, so it
// never covers the mushroom whatever the zoom
const BAR_ABOVE_MUSHROOM = 0.35
const BAR_OFFSET_Y = -14

// The spit, in bonfire-local units (bonfire.glb is ~0.9 wide, ~0.4 tall, and
// its flames rise from 0.25 up). It runs along x.
const SPIT_HEIGHT       = 0.78   // where the rod rests, in the forks
const HOLDER_X          = 0.68   // each holder stands this far from the fire's centre
const HOLDER_SINK       = 0.06   // pushed this far into the ground
const HOLDER_DIAMETER   = 0.05
const PRONG_LENGTH      = 0.17
const PRONG_TILT        = 0.45   // radians off vertical - the fork's V
const ROD_DIAMETER      = 0.03
const ROD_OVERHANG      = 0.16   // past each holder
// whole turns the spit makes while it roasts - whole, so it always stops cap-up
const SPIT_TURNS        = 1
const MUSHROOM_ON_SPIT  = 0.4    // how tall the mushroom on it is
// how far up its own height the rod goes through it - the stem
const ROD_THROUGH_AT    = 0.25
const WOOD_TEXTURE      = "./images/modeltex/wood2.jpg"
const WOOD_TINT         = new Color3(0.55, 0.42, 0.32)
// what a mushroom browns to by the time it's done - and it ends up glowing a
// warm ember red, hot off the fire. Lit only from the flames below, its cap
// would otherwise go nearly black right as it's ready.
const ROASTED_TINT      = new Color3(0.55, 0.38, 0.26)
const ROASTED_GLOW      = new Color3(0.32, 0.16, 0.06)
// dungeon materials take up to 8 lights (createdungeon.js) - with the default
// 4, the fire's own light usually isn't among them and the spit sits unlit
const SPIT_MAX_LIGHTS   = 8

const BAR_FILL_COOKING  = "#ff9a2e"
const BAR_FILL_READY    = GOLD_BRIGHT

// changeScene() disposes the whole old scene (bonfires, spits, GUI, the render
// observer), so this only ever belongs to one scene - a different one means
// starting fresh.
let state = null

function getState(scene){
    if(state?.scene === scene) return state
    const s = {
        scene,
        bonfires: new Set(),
        ui: null,            // fullscreen GUI: the list and the progress bars
        list: null,          // { bonfire, root } while the cook list is open
        nearest: null,       // the bonfire the interact button is about, if any
        shown: null,         // what the interact button was last set to show
        templates: null,     // hidden spit parts every spit is instanced from
        frame: 0,
    }
    state = s
    scene.onBeforeRenderObservable.add(() => tick(s))
    return s
}

// createbonfire.js calls this for every bonfire it places - crafted here or
// synced in from another player
export function makeCookingSpot(scene, bonfire){
    const s = getState(scene)
    bonfire.isCooking = false
    bonfire.cookedReady = false
    bonfire._cook = null
    s.bonfires.add(bonfire)
    bonfire.onDisposeObservable.add(() => bonfireGone(s, bonfire))
}

function myBody(){
    const owner = getCharState()?.owner
    return getPlayersOnScene().find(pl => pl.owner === owner)?.body
}

function distXZ(bonfire, pos){
    return Math.hypot(bonfire.position.x - pos.x, bonfire.position.z - pos.z)
}

// ── every frame ───────────────────────────────────────────────────────────────

function tick(s){
    const dt = s.scene.getEngine().getDeltaTime()
    s.bonfires.forEach(bonfire => {
        const cook = bonfire._cook
        if(!cook || bonfire.cookedReady) return
        cook.elapsed += dt
        const t = Math.min(1, cook.elapsed / COOK_TIME_MS)
        if(cook.axle) cook.axle.rotation.x = t * SPIT_TURNS * Math.PI * 2
        if(cook.mat){
            Color3.LerpToRef(Color3.White(), ROASTED_TINT, t, cook.mat.diffuseColor)
            Color3.LerpToRef(cook.startGlow, ROASTED_GLOW, t, cook.mat.emissiveColor)
        }
        if(cook.bar) cook.bar.fill.width = `${(t * 100).toFixed(1)}%`
        if(t >= 1) finishCooking(s, bonfire)
    })

    if(++s.frame % CHECK_EVERY_N_FRAMES) return
    const body = myBody()
    if(!body) return

    // the nearest fire in reach is the one the interact button is about
    let nearest = null
    let nearestDist = INTERACT_RADIUS
    s.bonfires.forEach(bonfire => {
        const d = distXZ(bonfire, body.position)
        if(d < nearestDist){ nearestDist = d; nearest = bonfire }
        // and a busy fire's bar only shows from close enough to matter
        if(bonfire._cook?.bar) bonfire._cook.bar.root.isVisible = d <= BAR_VIEW_RADIUS
    })
    s.nearest = nearest
    refreshInteract(s)

    // walked away from the fire with the list still open
    if(s.list && (s.list.bonfire !== nearest || s.list.bonfire.isCooking)) closeList(s)
    updateLayer(s)
}

// ── the interact button ───────────────────────────────────────────────────────

// What the shared HUD interact button should be for the nearest fire: its
// campcraft picture while it's free, the mushroom once one's done, nothing
// while one's still cooking or there's no fire in reach. It's shared with
// everything else you can walk up to (logs to sit on, ore, doors) - so it's
// only taken over when nothing else is showing on it, and only ever hidden
// again by whoever showed it (popupUI.js's owner).
function refreshInteract(s, force = false){
    const bonfire = s.nearest
    let want = null
    if(bonfire && bonfire.cookedReady){
        want = { bonfire, img: itemIconPath(bonfire._cook.raw), onClick: () => pickUpCooked(s, bonfire) }
    } else if(bonfire && !bonfire.isCooking){
        want = { bonfire, img: BONFIRE_ICON, onClick: () => toggleList(s, bonfire) }
    }

    const owner = getInteractBtnOwner()
    const showingOurs = isInteractBtnVisible() && s.bonfires.has(owner)

    if(!want){
        if(showingOurs) openCloseInteractBtn(false, false)
        s.shown = null
        return
    }
    const same = s.shown && s.shown.bonfire === want.bonfire && s.shown.img === want.img
    if(showingOurs && same && !force) return
    // something else (a log, a door) has the button - leave it be until it lets go
    if(isInteractBtnVisible() && !showingOurs) return
    openCloseInteractBtn(want.img, true, want.onClick, want.bonfire)
    s.shown = want
}

// ── the cook list ─────────────────────────────────────────────────────────────

function getUI(s){
    if(!s.ui){
        // adaptive scaling on, same reason as campcraft.js's own panel
        s.ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("bonfireCookingUI", true, s.scene, undefined, true)
        s.ui.layer.isEnabled = false
    }
    return s.ui
}

// A fullscreen GUI's layer composites every frame while enabled, even empty
// (campcraft.js's openCloseCampcraftUI explains) - so it's only on while the
// list or a progress bar is actually up.
function updateLayer(s){
    if(!s.ui) return
    let anyBar = false
    s.bonfires.forEach(b => { if(b._cook?.bar?.root.isVisible) anyBar = true })
    s.ui.layer.isEnabled = !!s.list || anyBar
}

function toggleList(s, bonfire){
    if(s.list){ closeList(s); return }
    openList(s, bonfire)
}

const LIST_WIDTH = 400
const ROW_HEIGHT = 56
const MAX_ROWS_SHOWN = 5

function openList(s, bonfire){
    closeList(s)
    if(bonfire.isCooking) return
    const ui = getUI(s)
    const items = getCookableItems(getCharState())

    const rowsShown = Math.max(1, Math.min(items.length, MAX_ROWS_SHOWN))
    const height = 96 + rowsShown * ROW_HEIGHT + 24

    const root = new GUI.Rectangle("cookList")
    root.width = `${LIST_WIDTH}px`
    root.height = `${height}px`
    root.thickness = 0
    // clicks on the panel itself mustn't fall through to the scene (a swing)
    root.isPointerBlocker = true
    root.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER
    root.top = "-60px"
    root.addControl(createNinePatchBg("cookList_bg", "./images/UI/frames/craftingframe.webp", 16))

    const inner = new GUI.StackPanel("cookList_inner")
    inner.width = "88%"
    inner.paddingTop = "16px"
    inner.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP
    root.addControl(inner)

    // header: the fire, title + how long, close
    const header = new GUI.Rectangle("cookList_header")
    header.thickness = 0
    header.height = "56px"
    inner.addControl(header)
    const icon = new GUI.Image("cookList_icon", BONFIRE_ICON)
    icon.width = "44px"
    icon.height = "44px"
    icon.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    header.addControl(icon)
    const titles = new GUI.StackPanel("cookList_titles")
    titles.width = "70%"
    titles.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    titles.paddingLeft = "54px"
    header.addControl(titles)
    titles.addControl(createText("cookList_title", "Cook over the fire", {
        fontFamily: FONT_TITLE, fontSize: 18, color: GOLD_BRIGHT, height: "26px", align: GUI.Control.HORIZONTAL_ALIGNMENT_LEFT,
    }))
    titles.addControl(createText("cookList_sub", `Roast food`, {
        fontFamily: FONT_BODY, fontSize: 12, color: TEXT_MUTED, height: "18px", align: GUI.Control.HORIZONTAL_ALIGNMENT_LEFT,
    }))
    const close = createGoldButton("cookList_close", "X", () => closeList(s))
    close.width = "32px"
    close.height = "32px"
    close.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT
    header.addControl(close)

    inner.addControl(createDivider("100%"))

    if(!items.length){
        inner.addControl(createText("cookList_empty", "Nothing to cook. Mushrooms you pick in the dungeon can be roasted here.", {
            fontFamily: FONT_BODY, fontSize: 14, color: TEXT_MUTED, wrap: true, height: `${ROW_HEIGHT}px`,
        }))
    } else {
        const rows = new GUI.StackPanel("cookList_rows")
        rows.width = "100%"
        items.forEach(item => rows.addControl(buildRow(s, bonfire, item)))
        if(items.length > MAX_ROWS_SHOWN){
            const scroll = new GUI.ScrollViewer("cookList_scroll")
            scroll.width = "100%"
            scroll.height = `${MAX_ROWS_SHOWN * ROW_HEIGHT}px`
            scroll.thickness = 0
            scroll.barColor = GOLD
            scroll.addControl(rows)
            inner.addControl(scroll)
        } else {
            inner.addControl(rows)
        }
    }

    ui.addControl(root)
    s.list = { bonfire, root }
    updateLayer(s)
}

// [icon] Name ........ x3 [Cook]
function buildRow(s, bonfire, item){
    const row = new GUI.Rectangle(`cookRow_${item.itemId}`)
    row.thickness = 0
    row.height = `${ROW_HEIGHT}px`

    const icon = new GUI.Image(`cookRow_${item.itemId}_icon`, itemIconPath(item))
    icon.width = "42px"
    icon.height = "42px"
    icon.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    row.addControl(icon)

    const name = createText(`cookRow_${item.itemId}_name`, item.dn, {
        fontFamily: FONT_BODY, fontSize: 16, color: GOLD_BRIGHT, width: "55%", height: `${ROW_HEIGHT}px`,
        align: GUI.Control.HORIZONTAL_ALIGNMENT_LEFT,
    })
    name.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    name.paddingLeft = "52px"
    row.addControl(name)

    const qty = createText(`cookRow_${item.itemId}_qty`, `x${item.qnty}`, {
        fontFamily: FONT_NUM, fontSize: 13, color: TEXT_MUTED, width: "50px", height: `${ROW_HEIGHT}px`,
    })
    qty.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT
    qty.paddingRight = "84px"
    qty.width = "134px"
    row.addControl(qty)

    const cookBtn = createGoldButton(`cookRow_${item.itemId}_btn`, "Cook", () => startCooking(s, bonfire, item.itemId))
    cookBtn.width = "76px"
    cookBtn.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT
    row.addControl(cookBtn)
    return row
}

function closeList(s){
    if(!s.list) return
    s.list.root.dispose()
    s.list = null
    updateLayer(s)
}

// ── cooking ───────────────────────────────────────────────────────────────────

function startCooking(s, bonfire, itemId){
    closeList(s)
    if(bonfire.isCooking){
        openClosePopup("The fire is busy - wait for it", true, 1500)
        return
    }
    const body = myBody()
    if(!body || distXZ(bonfire, body.position) > INTERACT_RADIUS){
        openClosePopup("Stand by the fire to cook", true, 1500)
        return
    }
    const charState = getCharState()
    const stack = charState?.items.find(itm => itm.itemId === itemId)
    if(!stack || !canBeCooked(stack)) return

    // ONE of the stack goes on the spit - a copy of it, so the stack left
    // behind can change (or be eaten) without touching what's cooking
    const raw = { ...JSON.parse(JSON.stringify(stack)), qnty: 1 }
    if(stack.qnty > 1) stack.qnty--
    else charState.items = charState.items.filter(itm => itm !== stack)
    updateMyDetailsOL(charState, checkIfTokenSaved())
    openUpdateInventory(false)

    bonfire.isCooking = true
    bonfire.cookedReady = false
    bonfire._cook = { raw, elapsed: 0, axle: null, mat: null, startGlow: null, bar: null, spit: null, barAnchor: null }
    buildSpit(s, bonfire)
    bonfire._cook.bar = buildBar(s, bonfire, bonfire._cook.barAnchor, raw)
    openClosePopup(`Roasting ${raw.dn}...`, true, 1400)
    refreshInteract(s, true)
    updateLayer(s)
}

function finishCooking(s, bonfire){
    const cook = bonfire._cook
    bonfire.cookedReady = true
    if(cook.bar){
        cook.bar.fill.width = "100%"
        cook.bar.fill.background = BAR_FILL_READY
        cook.bar.label.text = `${cook.raw.dn} is ready`
    }
    refreshInteract(s, true)
}

function pickUpCooked(s, bonfire){
    if(!bonfire.cookedReady || !bonfire._cook) return
    const cooked = makeCookedItem(bonfire._cook.raw)
    clearSpit(bonfire)
    // obtain() adds it, pops its own "acquired" toast and saves the character
    obtain(cooked)
    openUpdateInventory(false)
    refreshInteract(s, true)
    updateLayer(s)
}

// the fire's gone with something still on it - only ever because the whole
// place is being left (scene disposed) - so the player takes it with them
function bonfireGone(s, bonfire){
    s.bonfires.delete(bonfire)
    if(s.list?.bonfire === bonfire) s.list = null
    const cook = bonfire._cook
    if(!cook) return
    obtain(bonfire.cookedReady ? makeCookedItem(cook.raw) : cook.raw)
    bonfire._cook = null
    bonfire.isCooking = false
    bonfire.cookedReady = false
}

function clearSpit(bonfire){
    const cook = bonfire._cook
    if(cook){
        cook.bar?.root.dispose()
        cook.mat?.dispose()
        cook.spit?.dispose()
    }
    bonfire._cook = null
    bonfire.isCooking = false
    bonfire.cookedReady = false
}

// ── the spit ──────────────────────────────────────────────────────────────────

// Hidden source meshes every spit is made of (instances), built once per scene
function spitTemplates(s){
    if(s.templates) return s.templates
    const scene = s.scene
    const wood = new StandardMaterial("spitWoodMat", scene)
    wood.diffuseTexture = new Texture(WOOD_TEXTURE, scene)
    wood.diffuseColor = WOOD_TINT
    wood.specularColor = Color3.Black()
    wood.maxSimultaneousLights = SPIT_MAX_LIGHTS

    const make = (name, height, diameter) => {
        const tpl = MeshBuilder.CreateCylinder(name, { height, diameter, tessellation: 8 }, scene)
        tpl.material = wood
        tpl.isVisible = false
        tpl.isPickable = false
        return tpl
    }
    s.templates = {
        post:  make("_tpl_spit_post", SPIT_HEIGHT + HOLDER_SINK, HOLDER_DIAMETER),
        prong: make("_tpl_spit_prong", PRONG_LENGTH, HOLDER_DIAMETER * 0.8),
        rod:   make("_tpl_spit_rod", 2 * (HOLDER_X + ROD_OVERHANG), ROD_DIAMETER),
    }
    return s.templates
}

// A forked stick each side of the fire and a rod across them, through the
// mushroom - parented to the bonfire, so it goes when the bonfire does
function buildSpit(s, bonfire){
    const cook = bonfire._cook
    const t = spitTemplates(s)
    const spit = new TransformNode(`spit_${bonfire.name}`, s.scene)
    spit.parent = bonfire
    cook.spit = spit

    for(const side of [-1, 1]){
        const post = t.post.createInstance(`spit_post_${side}`)
        post.parent = spit
        post.position.set(side * HOLDER_X, (SPIT_HEIGHT - HOLDER_SINK) / 2, 0)
        // the fork: two prongs leaning apart across the rod's line
        for(const lean of [-1, 1]){
            const prong = t.prong.createInstance(`spit_prong_${side}_${lean}`)
            prong.parent = spit
            prong.rotation.x = lean * PRONG_TILT
            prong.position.set(side * HOLDER_X,
                SPIT_HEIGHT + Math.cos(PRONG_TILT) * PRONG_LENGTH / 2,
                lean * Math.sin(PRONG_TILT) * PRONG_LENGTH / 2)
        }
    }

    // the rod and the mushroom on it turn together around the rod's own line
    const axle = new TransformNode("spit_axle", s.scene)
    axle.parent = spit
    axle.position.y = SPIT_HEIGHT
    cook.axle = axle
    const rod = t.rod.createInstance("spit_rod")
    rod.parent = axle
    rod.rotation.z = Math.PI / 2

    // where the progress bar hangs - over the mushroom, not on the fire
    const barAnchor = new TransformNode("spit_barAnchor", s.scene)
    barAnchor.parent = spit
    barAnchor.position.y = SPIT_HEIGHT + (1 - ROD_THROUGH_AT) * MUSHROOM_ON_SPIT + BAR_ABOVE_MUSHROOM
    cook.barAnchor = barAnchor

    createSpitFood(s.scene, cook.raw).then(food => {
        // picked up (or the place left) before the model finished loading
        if(!food || bonfire._cook !== cook){ food?.root.dispose(); return }
        food.root.parent = axle
        const mat = food.mesh.material
        mat.maxSimultaneousLights = SPIT_MAX_LIGHTS
        cook.mat = mat
        cook.startGlow = mat.emissiveColor.clone()
        barAnchor.position.y = SPIT_HEIGHT + food.top + BAR_ABOVE_MUSHROOM
    })
}

// ── what goes on the spit ─────────────────────────────────────────────────────

// Cookables with a model of their own, by item name - laid along the rod,
// `length` long (bonfire-local units), the rod through their middle. Anything
// not listed is a mushroom (tcp's mushroomLibrary.ts - the item's name is its
// kind, its skin on the shared mushroom model).
const SPIT_MODELS = {
    // tcp's meatLoots.ts - the standing werewolves' Beast Meat
    standingwolfmeat: { path: "./models/outdors/standingwolfmeat.glb", length: 0.6 },
    // tcp's meatLoots.ts - the stray wolves' Wolf Rib
    rib: { path: "./models/outdors/rib.glb", length: 0.55 },
}

// scene -> Map(path -> Promise<Mesh|null>): each model loaded once, off its glTF
// __root__ and baked (the same as createmushroom.js's base), hidden - every
// roast is a clone of it
const foodBases = new WeakMap()
function loadFoodBase(scene, path){
    let bases = foodBases.get(scene)
    if(!bases){ bases = new Map(); foodBases.set(scene, bases) }
    if(bases.has(path)) return bases.get(path)
    const loading = (async () => {
        const container = await LoadAssetContainerAsync(path, scene)
        if(scene.isDisposed){ container.dispose(); return null }
        container.addAllToScene()
        const parts = container.meshes.filter(m => m.getTotalVertices() > 0)
        parts.forEach(m => { m.setParent(null); m.bakeCurrentTransformIntoVertices() })
        const base = parts.length > 1 ? Mesh.MergeMeshes(parts, true, true, undefined, false, true) : parts[0]
        container.meshes.filter(m => m !== base && !m.isDisposed()).forEach(m => m.dispose())
        base.isVisible = false
        base.isPickable = false
        base.refreshBoundingInfo()
        // its own textures on a StandardMaterial, like the mushroom's - the
        // browning and ember glow (ROASTED_TINT/GLOW) and the fire's light are
        // tuned for that. On the glb's PBR material the fire's close point
        // light and the glow washed it out to a flat, untextured peach.
        const pbr = base.material
        const mat = new StandardMaterial(`${base.name}_spitMat`, scene)
        mat.diffuseTexture = pbr?.albedoTexture ?? pbr?.diffuseTexture ?? null
        mat.bumpTexture = pbr?.bumpTexture ?? null
        mat.specularColor = new Color3(0.08, 0.08, 0.08)
        base.material = mat
        pbr?.dispose(false, false)
        return base
    })().catch(error => {
        console.warn(`[bonfireCooking] ${path} didn't load - that food roasts as a mushroom`, error?.message ?? error)
        return null
    })
    bases.set(path, loading)
    return loading
}

// The item on the spit, in the axle's space (the rod along x through its
// origin): { root, mesh, top } - top is how far its highest point sits above
// the rod. Its material is its own copy, free to brown as it roasts.
async function createSpitFood(scene, item){
    const own = SPIT_MODELS[item.name]
    const base = own ? await loadFoodBase(scene, own.path) : null
    if(scene.isDisposed) return null
    if(!base){
        const model = await createMushroomModel(scene, item.name, MUSHROOM_ON_SPIT)
        if(!model) return null
        // the rod through its stem
        model.root.position.y = -ROD_THROUGH_AT * MUSHROOM_ON_SPIT
        return { ...model, top: (1 - ROD_THROUGH_AT) * MUSHROOM_ON_SPIT }
    }
    const root = new TransformNode(`spitFood_${item.name}`, scene)
    const mesh = base.clone(`spitFood_${item.name}_mesh`)
    mesh.isVisible = true
    mesh.isPickable = false
    mesh.material = base.material.clone(`${base.material.name}_spit`)
    mesh.parent = root
    // lengthwise along the rod, scaled to its length, centred on it - so it
    // turns about its own length. (The clone's baked quaternion would
    // override rotation.)
    const { minimum, maximum } = base.getBoundingInfo().boundingBox
    const size = maximum.subtract(minimum)
    const turn = size.z > size.x ? Math.PI / 2 : 0
    const scale = own.length / Math.max(size.x, size.z)
    mesh.rotationQuaternion = null
    mesh.rotation.y = turn
    mesh.scaling.setAll(scale)
    const centre = Vector3.TransformCoordinates(minimum.add(maximum).scaleInPlace(0.5 * scale), Matrix.RotationY(turn))
    mesh.position.copyFrom(centre.negateInPlace())
    return { root, mesh, top: size.y * scale / 2 }
}

// "Roasting Ember Cap" over a bar that fills, above the mushroom on the spit
function buildBar(s, bonfire, anchor, raw){
    return createWorldProgressBar(getUI(s), `cookBar_${bonfire.name}`, anchor, `Roasting ${raw.dn}`, {
        fillColor: BAR_FILL_COOKING, offsetY: BAR_OFFSET_Y,
    })
}
