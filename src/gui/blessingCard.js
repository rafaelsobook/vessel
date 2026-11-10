import { Color3, DynamicTexture, Mesh, MeshBuilder, StandardMaterial } from "@babylonjs/core"
import { Control, Ellipse, Image, LinearGradient, RadialGradient, Rectangle, TextBlock, TextWrapping } from "@babylonjs/gui"
import { createMeshGui } from "./textmesh.js"

// THE BLESSING CARD - one blessing shown in the world beside you as you
// receive it (effects/blessingReveal.js moves it about and draws it into
// you): a Babylon GUI drawn on a plane (gui/textmesh.js's createMeshGui -
// freed with its mesh), in the menus' own look - Cinzel, gold rimmed, a double
// frame - lit in the blessing's colour. On it: NEW BLESSING (or the level it's
// reached), its picture, its name, and what it gives. On its back (a plane of
// its own, turned away, one drawing shared by every card): the same frame
// round a gold star - the same for every blessing, so turning it over is the
// reveal.
//
//   createBlessingCard(scene, blessing, theme, { upgraded }) -> { mesh, back, loaded }
//   createBlessingTitle(scene, text) -> mesh     the words over your head at the end
//
// The plane is 1 wide (CARD_PLANE_HEIGHT tall); scale it to size. Both face
// the camera (billboard) and are never picked; the card shows its back at
// rotation.y = PI.

const TEX_W = 512
const TEX_H = 720
export const CARD_ASPECT = TEX_W / TEX_H
// how tall the plane comes out, at scaling 1
export const CARD_PLANE_HEIGHT = TEX_H / TEX_W

const GOLD = "rgb(240, 204, 128)"
const css = (c, a = 1) => `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${a})`
const shade = (c, k) => ({ r: c.r * k, g: c.g * k, b: c.b * k })
// letter-spaced, the way the menus' small capitals are
const spaced = text => [...text].join(" ")

// the card's fonts are style.css's (Google Fonts) - drawn before they've
// arrived, a GUI keeps the fallback for good, so it waits for them (a little)
let fontsLoading = null
function fontsReady(){
    if(!fontsLoading){
        const fonts = typeof document !== "undefined" ? document.fonts : null
        const loads = fonts?.load ? ['800 60px "Cinzel"', '700 30px "Cinzel"', '700 36px "Cormorant Garamond"'].map(font => fonts.load(font).catch(() => {})) : []
        fontsLoading = Promise.race([Promise.all(loads), new Promise(resolve => setTimeout(resolve, 1500))])
    }
    return fontsLoading
}

// the biggest size `text` fits `width` at, from `max` down to `min` - or, still
// too long at `min`, that and wrapped
let measurer = null
function fit(text, font, max, min, width){
    measurer ??= document.createElement("canvas").getContext("2d")
    for(let size = max; size >= min; size -= 2){
        measurer.font = font(size)
        if(measurer.measureText(text).width <= width) return { size, wrap: false }
    }
    return { size: min, wrap: true }
}

// what it gives, shortest first-hand: "+10% HP", "+20 MELEE" - at most three
function perksOf(blessing){
    const p = blessing.percents ?? {}
    const r = blessing.regens ?? {}
    const pct = v => `+${Math.round(v * 100)}%`
    const out = []
    if(p.hp) out.push(`${pct(p.hp)} HP`)
    if(p.mp) out.push(`${pct(p.mp)} MANA`)
    if(p.sp) out.push(`${pct(p.sp)} STAMINA`)
    if(p.spd) out.push(`${pct(p.spd)} SPEED`)
    if(p.atkSpd) out.push(`${pct(p.atkSpd)} ATTACK SPEED`)
    if(p.meeleeDmg?.toAdd) out.push(`+${p.meeleeDmg.toAdd} MELEE`)
    if(p.meeleeDmg?.percent) out.push(`${pct(p.meeleeDmg.percent)} MELEE`)
    if(p.magicDmg?.toAdd) out.push(`+${p.magicDmg.toAdd} MAGIC`)
    if(p.magicDmg?.percent) out.push(`${pct(p.magicDmg.percent)} MAGIC`)
    if(p.defense?.toAdd) out.push(`+${p.defense.toAdd} DEFENSE`)
    if(p.defense?.percent) out.push(`${pct(p.defense.percent)} DEFENSE`)
    if(p.accuracy) out.push(`${pct(p.accuracy)} ACCURACY`)
    if(p.critical) out.push(`${pct(p.critical)} CRITICAL`)
    if(r.hp) out.push("HP REGEN")
    if(r.mp) out.push("MANA REGEN")
    if(r.sp) out.push("STAMINA REGEN")
    return out.slice(0, 3)
}

function topped(control, top){
    control.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
    control.top = `${top}px`
    return control
}

/**
 * blessing: the character's own copy (abilities.js's shape - name, dn,
 * percents, regens, lvl). theme: blessingMotifs.js's colours for it.
 * upgraded: one they had already, gone up a level. Resolves once the fonts
 * are in, to { mesh, loaded } - loaded resolves once its picture is (or
 * soon after, if it never comes).
 */
export async function createBlessingCard(scene, blessing, theme, { upgraded = false } = {}){
    await fontsReady()
    const { mesh, ui } = createMeshGui(`blessing.card.${blessing.name}`, 1, TEX_W, TEX_H, scene)
    mesh.isPickable = false
    mesh.billboardMode = Mesh.BILLBOARDMODE_ALL
    // light of its own, not lit by the scene - and not fogged; one-sided, its
    // back is the back plane's
    mesh.material.disableLighting = true
    mesh.material.fogEnabled = false
    mesh.material.backFaceCulling = true
    const back = MeshBuilder.CreatePlane(`blessing.card.back.${blessing.name}`, { width: 1, height: CARD_PLANE_HEIGHT }, scene)
    back.isPickable = false
    back.material = cardBackMaterial(scene)
    back.parent = mesh
    back.rotation.y = Math.PI

    // the card: a deep glow of its colour behind the picture, near-black at the
    // edges; a gold rim running into its colour
    const frame = new Rectangle("frame")
    frame.width = `${TEX_W - 14}px`
    frame.height = `${TEX_H - 14}px`
    frame.cornerRadius = 34
    frame.thickness = 7
    frame.color = GOLD
    const rim = new LinearGradient(0, 0, TEX_W, TEX_H)
    rim.addColorStop(0, "#fff4d2")
    rim.addColorStop(0.35, GOLD)
    rim.addColorStop(0.65, css(theme.main))
    rim.addColorStop(1, "#9c7430")
    frame.gradient = rim
    const fill = new RadialGradient(TEX_W / 2, 270, 10, TEX_W / 2, 330, 560)
    fill.addColorStop(0, css(shade(theme.main, 0.55), 0.97))
    fill.addColorStop(0.42, css(shade(theme.deep, 0.5), 0.97))
    fill.addColorStop(1, "rgba(9, 7, 14, 0.97)")
    frame.backgroundGradient = fill
    ui.addControl(frame)

    // the frame doubled, a line in - like the menus'
    const inner = new Rectangle("inner")
    inner.width = `${TEX_W - 50}px`
    inner.height = `${TEX_H - 50}px`
    inner.cornerRadius = 24
    inner.thickness = 2
    inner.color = "rgba(240, 204, 128, 0.42)"
    ui.addControl(inner)

    const label = topped(new TextBlock("label", spaced(upgraded ? `LEVEL ${blessing.lvl ?? 2}` : "NEW BLESSING")), 38)
    label.height = "44px"
    label.fontFamily = "Cinzel, serif"
    label.fontWeight = "700"
    label.fontSize = 27
    label.color = upgraded ? css(theme.core) : GOLD
    label.shadowColor = css(theme.main, 0.95)
    label.shadowBlur = 14
    ui.addControl(label)

    // the light behind the picture
    const ICON = 300
    const ICON_TOP = 118
    const middle = ICON_TOP + ICON / 2
    const halo = topped(new Ellipse("halo"), middle - 220)
    halo.width = halo.height = "440px"
    halo.thickness = 0
    const haloFill = new RadialGradient(TEX_W / 2, middle, 0, TEX_W / 2, middle, 220)
    haloFill.addColorStop(0, css(theme.main, 0.95))
    haloFill.addColorStop(0.5, css(theme.main, 0.3))
    haloFill.addColorStop(1, css(theme.main, 0))
    halo.backgroundGradient = haloFill
    ui.addControl(halo)

    // the picture, its corners rounded off (the box clips it), a rim over it
    const iconBox = topped(new Rectangle("iconBox"), ICON_TOP)
    iconBox.width = iconBox.height = `${ICON}px`
    iconBox.cornerRadius = 28
    iconBox.thickness = 0
    const icon = new Image("icon", `./images/uniques/${blessing.name}.jpeg`)
    icon.stretch = Image.STRETCH_FILL
    iconBox.addControl(icon)
    ui.addControl(iconBox)
    const iconRim = topped(new Rectangle("iconRim"), ICON_TOP)
    iconRim.width = iconRim.height = `${ICON}px`
    iconRim.cornerRadius = 28
    iconRim.thickness = 5
    iconRim.color = css(theme.core)
    iconRim.shadowColor = css(theme.main)
    iconRim.shadowBlur = 26
    ui.addControl(iconRim)

    // its name, as big as it fits
    const title = blessing.dn ?? blessing.name
    const nameFit = fit(title, size => `800 ${size}px Cinzel`, 58, 40, 440)
    const name = topped(new TextBlock("name", title), 438)
    name.width = "456px"
    name.height = "128px"
    name.fontFamily = "Cinzel, serif"
    name.fontWeight = "800"
    name.fontSize = nameFit.size
    name.textWrapping = nameFit.wrap ? TextWrapping.WordWrap : TextWrapping.Clip
    name.lineSpacing = "-4px"
    name.color = "#fff8ec"
    name.outlineWidth = 6
    name.outlineColor = "rgba(18, 8, 2, 0.9)"
    name.shadowColor = css(theme.main)
    name.shadowBlur = 22
    ui.addControl(name)

    const line = topped(new Rectangle("line"), 574)
    line.width = "300px"
    line.height = "3px"
    line.thickness = 0
    const lineFill = new LinearGradient(TEX_W / 2 - 150, 0, TEX_W / 2 + 150, 0)
    lineFill.addColorStop(0, "rgba(240, 204, 128, 0)")
    lineFill.addColorStop(0.5, GOLD)
    lineFill.addColorStop(1, "rgba(240, 204, 128, 0)")
    line.backgroundGradient = lineFill
    ui.addControl(line)

    const perks = perksOf(blessing).join("  ·  ")
    if(perks){
        const perkFit = fit(perks, size => `700 ${size}px "Cormorant Garamond"`, 38, 30, 440)
        const gives = topped(new TextBlock("perks", perks), 588)
        gives.width = "456px"
        gives.height = "96px"
        gives.fontFamily = '"Cormorant Garamond", serif'
        gives.fontWeight = "700"
        gives.fontSize = perkFit.size
        gives.textWrapping = perkFit.wrap ? TextWrapping.WordWrap : TextWrapping.Clip
        gives.color = "#ffe9b8"
        gives.outlineWidth = 4
        gives.outlineColor = "rgba(10, 5, 0, 0.85)"
        ui.addControl(gives)
    }

    const pictured = new Promise(resolve => {
        if(icon.isLoaded) return resolve()
        icon.onImageLoadedObservable.addOnce(() => resolve())
        setTimeout(resolve, 2500)
    })
    // its shaders too, front and back, before it's ever shown
    const compiled = Promise.all([mesh.material.forceCompilationAsync(mesh), back.material.forceCompilationAsync(back)]).catch(() => {})
    return { mesh, back, loaded: Promise.all([pictured, compiled]) }
}

// ── the back ─────────────────────────────────────────────────────────────────

const backMaterials = new WeakMap()   // scene -> material
function cardBackMaterial(scene){
    let mat = backMaterials.get(scene)
    if(mat) return mat
    const tex = new DynamicTexture("blessing.cardback", { width: TEX_W, height: TEX_H }, scene, true)
    drawCardBack(tex.getContext(), TEX_W, TEX_H)
    tex.hasAlpha = true
    tex.update()
    mat = new StandardMaterial("blessing.cardback", scene)
    mat.disableLighting = true
    mat.diffuseColor = Color3.Black()
    mat.specularColor = Color3.Black()
    mat.emissiveTexture = tex
    mat.opacityTexture = tex
    mat.fogEnabled = false
    backMaterials.set(scene, mat)
    return mat
}
function roundedRect(ctx, x, y, w, h, r){
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
}
// night-violet, a lattice of faint gold, the frame doubled, and in the middle
// two rings round an eight-pointed star of gold, glowing
function drawCardBack(ctx, w, h){
    const cx = w / 2
    const cy = h / 2
    ctx.clearRect(0, 0, w, h)
    roundedRect(ctx, 7, 7, w - 14, h - 14, 34)
    const fill = ctx.createRadialGradient(cx, cy, 20, cx, cy, h * 0.62)
    fill.addColorStop(0, "#2c1c40")
    fill.addColorStop(0.55, "#150e24")
    fill.addColorStop(1, "#07050c")
    ctx.fillStyle = fill
    ctx.fill()
    const rim = ctx.createLinearGradient(0, 0, w, h)
    rim.addColorStop(0, "#fff4d2")
    rim.addColorStop(0.45, GOLD)
    rim.addColorStop(1, "#9c7430")
    ctx.lineWidth = 7
    ctx.strokeStyle = rim
    ctx.stroke()

    ctx.save()
    roundedRect(ctx, 25, 25, w - 50, h - 50, 24)
    ctx.lineWidth = 2
    ctx.strokeStyle = "rgba(240, 204, 128, 0.45)"
    ctx.stroke()
    ctx.clip()
    ctx.strokeStyle = "rgba(240, 204, 128, 0.08)"
    ctx.lineWidth = 1.5
    for(let i = -h; i < w + h; i += 36){
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i + h, h)
        ctx.moveTo(i, h)
        ctx.lineTo(i + h, 0)
        ctx.stroke()
    }
    ctx.restore()

    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 200)
    glow.addColorStop(0, "rgba(255, 214, 140, 0.5)")
    glow.addColorStop(1, "rgba(255, 214, 140, 0)")
    ctx.fillStyle = glow
    ctx.fillRect(25, 25, w - 50, h - 50)
    ctx.strokeStyle = GOLD
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(cx, cy, 130, 0, Math.PI * 2)
    ctx.stroke()
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, 110, 0, Math.PI * 2)
    ctx.stroke()
    const star = (outer, inner, points) => {
        ctx.beginPath()
        for(let i = 0; i < points * 2; i++){
            const r = i % 2 ? inner : outer
            const a = -Math.PI / 2 + (i * Math.PI) / points
            ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
        }
        ctx.closePath()
    }
    ctx.shadowColor = "rgba(255, 210, 120, 0.95)"
    ctx.shadowBlur = 26
    star(102, 40, 8)
    const starFill = ctx.createRadialGradient(cx, cy, 0, cx, cy, 102)
    starFill.addColorStop(0, "#fffaf0")
    starFill.addColorStop(0.5, "#f6d488")
    starFill.addColorStop(1, "#b8862f")
    ctx.fillStyle = starFill
    ctx.fill()
    ctx.shadowBlur = 0
    star(46, 18, 4)
    ctx.fillStyle = "#fffef6"
    ctx.fill()
    // a diamond above and below, a line from each to the rings
    ctx.fillStyle = GOLD
    ;[78, h - 78].forEach(y => {
        ctx.beginPath()
        ctx.moveTo(cx, y - 15)
        ctx.lineTo(cx + 11, y)
        ctx.lineTo(cx, y + 15)
        ctx.lineTo(cx - 11, y)
        ctx.closePath()
        ctx.fill()
    })
    ctx.strokeStyle = "rgba(240, 204, 128, 0.6)"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx, 96)
    ctx.lineTo(cx, cy - 138)
    ctx.moveTo(cx, h - 96)
    ctx.lineTo(cx, cy + 138)
    ctx.stroke()
}

// ── the skill card (effects/tomeReveal.js) ────────────────────────────────────

const ELEMENT_WORDS = { normal: "ARCANE", fire: "FIRE", water: "WATER", earth: "EARTH", light: "LIGHT", dark: "DARK", lightning: "LIGHTNING" }

/**
 * A skill learned from a tome - the same card as a blessing's, framed in its
 * tome's rarity: rank (or the level it's reached) on top, the skill's own
 * picture (images/skills/ - glowing art on black, so a black box), its name,
 * its element, cost and cooldown. tier: { label, core, main, deep }
 * (tomeReveal.js's rarities). Resolves to { mesh, loaded } like
 * createBlessingCard, without a back - it rises face up out of the book.
 */
export async function createSkillCard(scene, skill, tier, { rankLabel = "", upgraded = false, level = 1 } = {}){
    await fontsReady()
    const { mesh, ui } = createMeshGui(`skill.card.${skill.name}`, 1, TEX_W, TEX_H, scene)
    mesh.isPickable = false
    mesh.billboardMode = Mesh.BILLBOARDMODE_ALL
    mesh.material.disableLighting = true
    mesh.material.fogEnabled = false

    const frame = new Rectangle("frame")
    frame.width = `${TEX_W - 14}px`
    frame.height = `${TEX_H - 14}px`
    frame.cornerRadius = 34
    frame.thickness = 8
    frame.color = css(tier.main)
    const rim = new LinearGradient(0, 0, TEX_W, TEX_H)
    rim.addColorStop(0, css(tier.core))
    rim.addColorStop(0.4, css(tier.main))
    rim.addColorStop(0.7, GOLD)
    rim.addColorStop(1, css(shade(tier.main, 0.55)))
    frame.gradient = rim
    const fill = new RadialGradient(TEX_W / 2, 270, 10, TEX_W / 2, 330, 560)
    fill.addColorStop(0, css(shade(tier.main, 0.5), 0.97))
    fill.addColorStop(0.42, css(shade(tier.deep, 0.55), 0.97))
    fill.addColorStop(1, "rgba(8, 6, 12, 0.97)")
    frame.backgroundGradient = fill
    ui.addControl(frame)
    const inner = new Rectangle("inner")
    inner.width = `${TEX_W - 50}px`
    inner.height = `${TEX_H - 50}px`
    inner.cornerRadius = 24
    inner.thickness = 2
    inner.color = css(tier.main, 0.5)
    ui.addControl(inner)

    const top = upgraded ? `LEVEL ${level}` : (rankLabel || `${tier.label} SKILL`).toUpperCase()
    const label = topped(new TextBlock("label", spaced(top)), 38)
    label.height = "44px"
    label.fontFamily = "Cinzel, serif"
    label.fontWeight = "700"
    label.fontSize = fit(spaced(top), size => `700 ${size}px Cinzel`, 27, 18, 440).size
    label.color = css(tier.core)
    label.shadowColor = css(tier.main, 0.95)
    label.shadowBlur = 14
    ui.addControl(label)

    const ICON = 300
    const ICON_TOP = 118
    const middle = ICON_TOP + ICON / 2
    const halo = topped(new Ellipse("halo"), middle - 220)
    halo.width = halo.height = "440px"
    halo.thickness = 0
    const haloFill = new RadialGradient(TEX_W / 2, middle, 0, TEX_W / 2, middle, 220)
    haloFill.addColorStop(0, css(tier.main, 0.95))
    haloFill.addColorStop(0.5, css(tier.main, 0.3))
    haloFill.addColorStop(1, css(tier.main, 0))
    halo.backgroundGradient = haloFill
    ui.addControl(halo)
    // the skill's picture is glowing art on black: a black box it sits in
    const iconBox = topped(new Rectangle("iconBox"), ICON_TOP)
    iconBox.width = iconBox.height = `${ICON}px`
    iconBox.cornerRadius = 28
    iconBox.thickness = 0
    iconBox.background = "#050307"
    const icon = new Image("icon", `./images/skills/${skill.name}.webp`)
    icon.stretch = Image.STRETCH_FILL
    iconBox.addControl(icon)
    ui.addControl(iconBox)
    const iconRim = topped(new Rectangle("iconRim"), ICON_TOP)
    iconRim.width = iconRim.height = `${ICON}px`
    iconRim.cornerRadius = 28
    iconRim.thickness = 6
    iconRim.color = css(tier.core)
    iconRim.shadowColor = css(tier.main)
    iconRim.shadowBlur = 28
    ui.addControl(iconRim)

    const title = skill.displayName ?? skill.name
    const nameFit = fit(title, size => `800 ${size}px Cinzel`, 58, 40, 440)
    const name = topped(new TextBlock("name", title), 438)
    name.width = "456px"
    name.height = "128px"
    name.fontFamily = "Cinzel, serif"
    name.fontWeight = "800"
    name.fontSize = nameFit.size
    name.textWrapping = nameFit.wrap ? TextWrapping.WordWrap : TextWrapping.Clip
    name.lineSpacing = "-4px"
    name.color = "#fff8ec"
    name.outlineWidth = 6
    name.outlineColor = "rgba(18, 8, 2, 0.9)"
    name.shadowColor = css(tier.main)
    name.shadowBlur = 22
    ui.addControl(name)

    const line = topped(new Rectangle("line"), 574)
    line.width = "300px"
    line.height = "3px"
    line.thickness = 0
    const lineFill = new LinearGradient(TEX_W / 2 - 150, 0, TEX_W / 2 + 150, 0)
    lineFill.addColorStop(0, css(tier.main, 0))
    lineFill.addColorStop(0.5, css(tier.main))
    lineFill.addColorStop(1, css(tier.main, 0))
    line.backgroundGradient = lineFill
    ui.addControl(line)

    const demand = skill.demand?.find(d => d.cost || d.minCost)
    const facts = [
        ELEMENT_WORDS[skill.element] ?? String(skill.element ?? "").toUpperCase(),
        demand ? `${demand.cost || demand.minCost} ${String(demand.name).toUpperCase()}` : null,
        skill.skillCoolDown ? `${Math.round(skill.skillCoolDown / 100) / 10}s` : null,
    ].filter(Boolean).join("  ·  ")
    if(facts){
        const gives = topped(new TextBlock("facts", facts), 590)
        gives.width = "456px"
        gives.height = "90px"
        gives.fontFamily = '"Cormorant Garamond", serif'
        gives.fontWeight = "700"
        gives.fontSize = fit(facts, size => `700 ${size}px "Cormorant Garamond"`, 38, 28, 440).size
        gives.color = css(tier.core)
        gives.outlineWidth = 4
        gives.outlineColor = "rgba(10, 5, 0, 0.85)"
        ui.addControl(gives)
    }

    const pictured = new Promise(resolve => {
        if(icon.isLoaded) return resolve()
        icon.onImageLoadedObservable.addOnce(() => resolve())
        setTimeout(resolve, 2500)
    })
    const compiled = mesh.material.forceCompilationAsync(mesh).catch(() => {})
    return { mesh, loaded: Promise.all([pictured, compiled]) }
}

/** The words over your head as the last blessing goes in - gold, glowing, 4 wide. */
export async function createBlessingTitle(scene, text){
    await fontsReady()
    const { mesh, ui } = createMeshGui("blessing.title", 4, 1024, 200, scene)
    mesh.isPickable = false
    mesh.billboardMode = Mesh.BILLBOARDMODE_ALL
    mesh.material.disableLighting = true
    mesh.material.fogEnabled = false
    const words = new TextBlock("title", text)
    words.fontFamily = "Cinzel, serif"
    words.fontWeight = "800"
    words.fontSize = fit(text, size => `800 ${size}px Cinzel`, 92, 44, 940).size
    const fill = new LinearGradient(0, 52, 0, 148)
    fill.addColorStop(0, "#fffaf0")
    fill.addColorStop(0.5, "#f6d488")
    fill.addColorStop(1, "#c08a2e")
    words.gradient = fill
    words.outlineWidth = 12
    words.outlineColor = "#1b0f04"
    words.shadowColor = "rgba(255, 196, 80, 0.95)"
    words.shadowBlur = 30
    ui.addControl(words)
    return mesh
}
