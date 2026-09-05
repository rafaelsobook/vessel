import { MeshBuilder, TransformNode, Vector3 } from "@babylonjs/core"
import { getSocketContainers } from "../sockets/worldsocket"
import { createGlowingMat } from "../tools/materials"
import { createBladeMat, createGuardMat, createHandleMat, createPommelMat, SELF_GLOW } from "../tools/weaponmat"
import { createMetalMat } from "../tools/metalmat"
import { addGlow } from "../tools/glow"
import { getSceneDet } from "../main/main"

const partMatFns = {
    blade: createBladeMat,
    guard: createGuardMat,
    handle: createHandleMat,
    pommel: createPommelMat,
}

let partMatCacheScene = null
const partMatCache = new Map()

function getPartMat(scene, part, rarity, materialName, instanceName) {
    if (partMatCacheScene !== scene) {
        partMatCache.clear()
        partMatCacheScene = scene
    }
    const key = `${part}_${rarity}_${materialName}`
    let baseMat = partMatCache.get(key)
    if (!baseMat) {
        baseMat = partMatFns[part](scene, rarity, materialName)
        partMatCache.set(key, baseMat)
    }
    return baseMat.clone(`${key}_${instanceName}`)
}

// which weaponTypes are built from separate part meshes (blade/guard/
// handle/pommel) isn't hardcoded to "sword" - it's whatever allweapons
// (allswords.glb, see loadMeshOnlyParts) actually has a "<weaponType>_..."
// entry for. Sword has 4 tiers per part; spear has just one (spear_blade_
// rare1 etc, see swordsdata.js's stormpiercer). Any weaponType with NO
// matching part meshes falls back to a single mesh instead - same pattern
// as createHelmet/createPauldron in createcharacter.js - looked up from
// containers.weapons by "<weaponType>.<itemName>".
function hasPartMeshes(weaponType){
    const { allweapons } = getSocketContainers()
    if(!allweapons) return false
    return Object.keys(allweapons).some(key => key.startsWith(`${weaponType}_`))
}

// Which parts each weaponType actually has - sword and spear (both from
// allswords.glb) are the original 4-part weapons (blade/guard/handle/
// pommel). axe/pickaxe (models/axe/axes.glb) only ever have 3 - there's no
// axe_pommel_*/pickaxe_pommel_* mesh at all, the artist never modeled one
// (see the Blender outliner: axe_blade/axe_guard/axe_handle, pickaxe_blade/
// pickaxe_guard, nothing else). Any weaponType not listed here falls back
// to the original 4-part list, so this only needs an entry for families
// that deviate from that.
const WEAPON_PART_LIST = {
    axe: ["blade", "guard", "handle"],
    pickaxe: ["blade", "guard", "handle"],
}
const DEFAULT_PART_LIST = ["blade", "guard", "handle", "pommel"]

// Some weapon families SHARE a specific part's actual mesh with a
// DIFFERENT weaponType instead of having their own - pickaxe has no
// pickaxe_handle_* mesh in axes.glb at all (the artist's own outliner only
// has axe_handle_common1, meant to double as the pickaxe's handle too), so
// pickaxe's "handle" part is looked up under weaponType "axe" instead of
// "pickaxe". { [weaponType]: { [part]: sourceWeaponType } } - any
// part/weaponType combination not listed here just uses its own
// weaponType, no override (every part of every OTHER weapon, and blade/
// guard for pickaxe specifically, which DO have their own pickaxe_ meshes).
const SHARED_PART_SOURCE = {
    pickaxe: { handle: "axe" },
}

// Epic recipe accent sub-meshes (staticRecources/epiccrafts.js,
// craftingui.js's own matchEpicRecipe) - allswords.glb's epic1 tier adds
// EXTRA sibling meshes alongside some parts' own main mesh (Blender
// outliner: sword_blade_epic1_outer, sword_guard_epic1_cores/_outer -
// handle/pommel's own epic1 mesh has no accent siblings at all), named
// "<mainKey>_<suffix>". Keyed by the GLB's own suffix spelling (note
// "cores" is plural in the mesh name but the matching epiccrafts.js color
// field is singular - "guardCoreColor", not "guardCoresColor") -
// colorField is what actually gets concatenated onto the part name
// ("blade"+"Outer"+"Color" -> options.epicAccents.bladeOuterColor).
// matType picks which material treatment this accent gets: "glow" for the
// gem-like glowing core (createGlowingMat, a GLOW_COLORS key like "red"),
// "metal" for the outer shell (createMetalMat, a METAL_TINTS key like
// "gold"/"silver") - only the core was ever meant to glow, the outer shell
// is a normal metal trim around it.
const EPIC_ACCENT_SUFFIXES = {
    outer: { colorField: "Outer", matType: "metal" },
    cores: { colorField: "Core", matType: "glow" },
}

function createPartsWeapon(scene, weaponType, root, options, glowingColor) {
    const { allweapons } = getSocketContainers()
    if (!allweapons) return console.warn("allweapons not yet imported")

    const {
        bladeRarity = "rare2", guardRarity = "rare1", handleRarity = "common1", pommelRarity = "common1",
        // defaults match the old hardcoded per-part looks, so weapon data
        // that predates *Color (npcDetails.js, skills.js) renders unchanged
        bladeColor = "steel", guardColor = "bronze", handleColor = "leather", pommelColor = "gold",
        // only ever set by an epic-recipe craft (craftingui.js's
        // buildSwordParts) - {bladeOuterColor, guardCoreColor,
        // guardOuterColor} today, see EPIC_ACCENT_SUFFIXES above. {} default
        // so every non-epic weapon (the vast majority) skips the accent
        // lookup below entirely, same "not every option is always present"
        // convention this whole options bag already follows.
        epicAccents = {},
    } = options

    const PART_RARITY = { blade: bladeRarity, guard: guardRarity, handle: handleRarity, pommel: pommelRarity }
    const PART_COLOR  = { blade: bladeColor,  guard: guardColor,  handle: handleColor,  pommel: pommelColor  }
    const parts = WEAPON_PART_LIST[weaponType] ?? DEFAULT_PART_LIST

    let mat = null
    if(glowingColor){
        mat = createGlowingMat(scene, glowingColor)
    }

    for (const part of parts) {
        const rarity = PART_RARITY[part]
        const materialName = PART_COLOR[part]
        const sourceWeaponType = SHARED_PART_SOURCE[weaponType]?.[part] ?? weaponType
        const key = `${sourceWeaponType}_${part}_${rarity}`
        const template = allweapons[key]
        if (!template) {
            console.warn(`createWeapon: missing part "${key}"`)
            continue
        }
        const inst = template.clone(`${key}_${root.name}`)
        inst.addRotation(Math.PI/2,0,0)
        inst.isVisible = true
        inst.parent = root
        inst.position = Vector3.Zero()
        if(glowingColor && mat !== null){
            inst.material = mat
            addGlow(scene, inst, 0.4)
        } else {
            inst.material = getPartMat(scene, part, rarity, materialName, inst.name)
            // SELF_GLOW (weaponmat.js) - firecrystal/frostshard/stormcrystal
            // already carry a faint emissive floor baked into the material
            // itself, but phoenixore specifically asked to genuinely "be
            // glowing" - a real GlowLayer bloom (tools/glow.js), same
            // mechanism the epic accent core just below and the whole-
            // weapon glowingColor path above both already use, not just an
            // emissive tint with no actual bleed/halo. Applies to whichever
            // PART actually got a self-glow material, not just one fixed
            // slot - phoenixore could end up on any of the 4 in a non-epic
            // craft, not only the handle the majesticsword recipe uses it for.
            if(SELF_GLOW.has((materialName || "").toLowerCase())) addGlow(scene, inst, 0.4)
        }

        // epic accent sub-meshes, if this exact (part, rarity) has any and
        // the recipe actually supplied a color for it - scanned by real key
        // existence in allweapons (same "ground truth from the glb, not a
        // hardcoded list" approach getAvailableRarityVariants already uses),
        // not hardcoded to which parts happen to have one today, so a future
        // epic tier/part combination just works without touching this file
        Object.entries(EPIC_ACCENT_SUFFIXES).forEach(([meshSuffix, { colorField, matType }]) => {
            const accentKey = `${key}_${meshSuffix}`
            const accentTemplate = allweapons[accentKey]
            if(!accentTemplate) return
            const accentColor = epicAccents[`${part}${colorField}Color`]
            if(!accentColor) return

            const accentInst = accentTemplate.clone(`${accentKey}_${root.name}`)
            accentInst.addRotation(Math.PI/2,0,0)
            accentInst.isVisible = true
            accentInst.parent = root
            accentInst.position = Vector3.Zero()
            if(matType === "glow"){
                accentInst.material = createGlowingMat(scene, accentColor)
                addGlow(scene, accentInst, 0.4)
            } else {
                accentInst.material = createMetalMat(scene, accentColor)
            }
        })
    }
}

function createSingleMeshWeapon(scene, weaponType, itemName, root, options, glowingColor) {
    const { weapons } = getSocketContainers()
    if (!weapons) return console.warn("weapons not yet imported")
    if (!itemName) return console.warn(`createWeapon: single-mesh weaponType "${weaponType}" needs an itemName to look up its mesh`)

    // same dot-naming/lookup convention as createHelmet/createPauldron in
    // createcharacter.js - "<weaponType>.<itemName>", e.g. "spear.stormpiercer"
    const template = weapons.find(msh => msh.name.split(".")[1] === itemName)
    if (!template) return console.warn(`createWeapon: missing single-mesh weapon "${weaponType}.${itemName}"`)

    const inst = template.clone(`${weaponType}.${itemName}_${root.name}`)
    // matches the per-part rotation fix below - unverified until an actual
    // single-mesh weapon glb exists to test against, may need adjusting
    inst.addRotation(Math.PI/2,0,0)
    inst.isVisible = true
    inst.parent = root
    inst.position = Vector3.Zero()

    if(glowingColor){
        inst.material = createGlowingMat(scene, glowingColor)
        addGlow(scene, inst, 0.4)
    } else {
        inst.material = createMetalMat(scene, options.metalColor)
    }
}

export function createWeapon(scene, weaponType = "sword", pos = {x:0,y:0,z:0}, parent, itemName, options = {
    bladeRarity: "rare2",
    guardRarity: "rare1",
    handleRarity: "common1",
    pommelRarity: "common1"
}, glowingColor) {
    const root = new TransformNode(`weapon_${weaponType}_${Date.now()}`,scene)

    root.position = new Vector3(pos.x, pos.y,pos.z)
    root.isVisible = true
    if (parent) {
        root.parent = parent
    }
    if (hasPartMeshes(weaponType)) {
        createPartsWeapon(scene, weaponType, root, options, glowingColor)
    } else {
        createSingleMeshWeapon(scene, weaponType, itemName, root, options, glowingColor)
    }

    return root
}

// Explicit convenience wrappers for the axe family (models/axe/axes.glb,
// containers.js's own setStartingContainers merges it into the SAME
// allweapons object allswords.glb already fills) - createWeapon(scene,
// "axe", ...) / createWeapon(scene, "pickaxe", ...) already work fine on
// their own (weaponType is fully data-driven, same generic engine sword/
// spear already ride), these just give the axe family its own named entry
// point rather than a bare string literal at every call site. Options
// default to axe/pickaxe's ONLY currently-modeled tier (common1 on every
// part - axes.glb has no rare variants yet, unlike allswords.glb) instead
// of createWeapon's own sword-shaped defaults (rare2/rare1/common1/common1)
// which don't correspond to any real axe mesh.
const AXE_DEFAULT_OPTIONS = {
    bladeRarity: "common1",
    guardRarity: "common1",
    handleRarity: "common1",
}

export function createAxe(scene, pos = {x:0,y:0,z:0}, parent, options = AXE_DEFAULT_OPTIONS, glowingColor) {
    return createWeapon(scene, "axe", pos, parent, undefined, options, glowingColor)
}

export function createPickaxe(scene, pos = {x:0,y:0,z:0}, parent, options = AXE_DEFAULT_OPTIONS, glowingColor) {
    return createWeapon(scene, "pickaxe", pos, parent, undefined, options, glowingColor)
}
