// Crafting window: category list (sword/armor/helmet/pauldron) on the left,
// the part-slot diagram in the middle. Sword is the only itemType built from
// 4 parts (blade/guard/handle/pommel, see createweapon.js) - everything else
// equips a single mesh (see createcharacter.js's createHelmet/createGauntlet/
// createPauldron/equipArmor), so it only ever needs one slot.
//
// Clicking a part box opens a material picker listing the player's OWNED
// crafting materials (resourceLoot.js's solarore/adamantine/wood/etc, mined
// out in the world) - not a free palette. Each material's visual tint and
// crafting stat weights live in itemDictionary.js (ITEM_DICTIONARY), the
// single source of truth both this file and the stat formula read from.
// Rarity TIER (common/rare) is NOT picked per part: it's derived once from
// the budget and applied to every part of the sword uniformly - there's no
// such thing as a common blade on a rare guard. But within a tier,
// allswords.glb has more than one mesh for some parts (blade rare1 AND
// rare2, guard common1 AND common2, etc, see the Blender outliner
// screenshot) - which exact one gets used per part IS randomized per craft
// (getAvailableRarityVariants/pickRarityVariant below), so two rare swords
// don't come out looking identical. Which MATERIALS get picked, separately,
// drives the actual stats - see buildSwordItem()/computeCraftedWeaponStats.

import { createElement } from "../tools/GUITools"
import { openClosePopup } from "../tools/popupUI"
import { getCharState } from "../charactersystem/characterstate"
import { getSocketContainers } from "../sockets/worldsocket"
import { obtain } from "../charactersystem/inventory"
import { randomNum } from "../tools/tools"
import { ITEM_DICTIONARY, computeCraftedWeaponStats } from "../staticRecources/itemDictionary"

const craftCont     = document.querySelector(".craft-container")
const craftTitle    = document.querySelector(".craft-title")
const categBtns     = document.querySelectorAll(".craft-categ-btn")
const stage         = document.querySelector(".craft-parts-stage")
const singleLabel   = document.querySelector(".single-slot .part-slot-label")
const partBoxes     = document.querySelectorAll(".part-slot-box")
const budgetInput   = document.querySelector(".craft-budget-input")
const rarityValueEl = document.querySelector(".craft-rarity-value")
const craftBtn      = document.querySelector(".craft-btn")
const centerIcon    = document.querySelector(".craft-center-icon")

const mpCont = document.querySelector(".material-picker-container")
const mpGrid = document.querySelector(".mp-grid")

const CATEGORIES = {
    sword:    { dn: "Craft Sword" },
    armor:    { dn: "Craft Armor",    singleLabel: "Armor" },
    helmet:   { dn: "Craft Helmet",   singleLabel: "Helmet" },
    pauldron: { dn: "Craft Pauldron", singleLabel: "Pauldron" },
}
const SWORD_PARTS = ["blade", "guard", "handle", "pommel"]

const SWORD_ICON = "./images/UI/craftswordicon.webp"
const SWORD_FORGING_ICON = "./images/UI/swordforging.webp"
const FORGING_DURATION_MS = 3000

// budget < 100 -> every part built from the "common" tier, >= 100 -> "rare".
// The exact numbered variant within that tier (common1 vs common2, rare1 vs
// rare2) is chosen per part by pickRarityVariant() below.
const RARITY_BUDGET_THRESHOLD = 100

let activeCategory = "sword"
// { blade: { materialName, materialLabel, tintKey }, guard: {...}, ... } - reset whenever category changes
let selectedMaterials = {}
let currentRarityBase = "common" // "common" | "rare" - the tier, not a specific mesh variant
let isForging = false

function resetPartSelections(){
    selectedMaterials = {}
    partBoxes.forEach(box => {
        const icon = box.querySelector(".part-slot-icon")
        if(icon) icon.remove()
        const materialLabel = box.parentElement.querySelector(".part-slot-material")
        if(materialLabel) materialLabel.textContent = ""
    })
}

function selectCategory(categ){
    const config = CATEGORIES[categ]
    if(!config) return

    activeCategory = categ
    categBtns.forEach(btn => btn.classList.toggle("active", btn.dataset.categ === categ))

    const isSword = categ === "sword"
    stage.classList.toggle("sword-mode", isSword)
    stage.classList.toggle("single-mode", !isSword)
    if(!isSword) singleLabel.textContent = config.singleLabel

    craftTitle.textContent = config.dn
    resetPartSelections()
}

categBtns.forEach(btn => {
    btn.addEventListener("click", () => selectCategory(btn.dataset.categ))
})

// --- material picker popup ---

function closeMaterialPicker(){
    mpCont.style.display = "none"
}

// materials the player actually has - itemCateg "crafting" with itemType
// "material" or "stone" is the same shape createLootItem() in
// resourceLoot.js hands out (manastone/stone are itemType "stone", the rest
// are "material"). Only ones with a dictionary entry are pickable.
function getOwnedMaterials(){
    const charState = getCharState()
    if(!charState) return []
    return charState.items.filter(itm =>
        itm.itemCateg === "crafting" &&
        (itm.itemType === "material" || itm.itemType === "stone") &&
        itm.qnty > 0 &&
        ITEM_DICTIONARY[itm.name]
    )
}

function openMaterialPicker(part, onSelect){
    mpGrid.innerHTML = ""
    const owned = getOwnedMaterials()

    if(!owned.length){
        mpGrid.append(createElement("p", "mp-empty-msg", "You have no crafting materials"))
        mpCont.style.display = "flex"
        return
    }

    owned.forEach(itm => {
        const tintKey = ITEM_DICTIONARY[itm.name].tintKey
        const swatch = createElement("button", "mp-swatch")
        const img = createElement("img", "mp-swatch-img")
        img.src = `./images/items/crafting/${itm.name}.webp`
        img.onerror = () => { img.onerror = null; img.src = `./images/items/crafting/${itm.name}.png` }
        const name = createElement("p", "mp-swatch-name", itm.dn)
        const qty = createElement("p", "mp-swatch-qty", `x${itm.qnty}`)
        swatch.append(img, name, qty)
        swatch.addEventListener("click", () => {
            onSelect({ materialName: itm.name, materialLabel: itm.dn, tintKey })
            closeMaterialPicker()
        })
        mpGrid.append(swatch)
    })
    mpCont.style.display = "flex"
}

function applyMaterialToBox(box, material){
    let icon = box.querySelector(".part-slot-icon")
    if(!icon){
        icon = createElement("img", "part-slot-icon")
        box.append(icon)
    }
    icon.src = `./images/items/crafting/${material.materialName}.webp`
    icon.onerror = () => { icon.onerror = null; icon.src = `./images/items/crafting/${material.materialName}.png` }

    const materialLabel = box.parentElement.querySelector(".part-slot-material")
    if(materialLabel) materialLabel.textContent = material.materialLabel
}

partBoxes.forEach(box => {
    box.addEventListener("click", () => {
        if(isForging) return
        const part = box.closest(".part-slot").dataset.part
        openMaterialPicker(part, material => {
            selectedMaterials[part] = material
            applyMaterialToBox(box, material)
        })
    })
})

// --- budget -> rarity ---

function getRarityBase(budget){
    return budget >= RARITY_BUDGET_THRESHOLD ? "rare" : "common"
}

budgetInput.addEventListener("input", () => {
    const budget = Number(budgetInput.value) || 0
    currentRarityBase = getRarityBase(budget)
    rarityValueEl.textContent = currentRarityBase === "rare" ? "Rare" : "Common"
})

// --- craft ---

// allswords.glb doesn't always have just one mesh per (part, tier) - e.g.
// sword_blade_rare1 AND sword_blade_rare2 both exist (see the Blender
// outliner). allweapons (see createweapon.js/loadMeshOnlyParts) is keyed by
// the exact mesh name, so scanning its keys is the ground truth for which
// numbered variants actually exist, instead of hardcoding a list here that'd
// silently go stale the moment the glb changes.
function getAvailableRarityVariants(weaponType, part, tierBase){
    const { allweapons } = getSocketContainers()
    const pattern = new RegExp(`^${weaponType}_${part}_(${tierBase}\\d+)$`)
    const variants = []
    if(allweapons){
        Object.keys(allweapons).forEach(key => {
            const match = key.match(pattern)
            if(match) variants.push(match[1])
        })
    }
    // allweapons not loaded yet, or the glb genuinely has nothing for this
    // (part, tier) combo - fall back to *1 rather than crafting a broken part
    return variants.length ? variants : [`${tierBase}1`]
}

function pickRarityVariant(part){
    const variants = getAvailableRarityVariants("sword", part, currentRarityBase)
    return variants[Math.floor(Math.random() * variants.length)]
}

function buildSwordParts(){
    // every part shares the same TIER (currentRarityBase) - that's the
    // whole point, see the file-level comment - but which numbered mesh
    // within that tier is randomized independently per part
    return {
        bladeRarity: pickRarityVariant("blade"),
        guardRarity: pickRarityVariant("guard"),
        handleRarity: pickRarityVariant("handle"),
        pommelRarity: pickRarityVariant("pommel"),
        bladeColor: selectedMaterials.blade.tintKey,
        guardColor: selectedMaterials.guard.tintKey,
        handleColor: selectedMaterials.handle.tintKey,
        pommelColor: selectedMaterials.pommel.tintKey,
    }
}

// builds a real inventory item, same shape as the hand-authored entries in
// swordsdata.js, so equipSword/itemInfoSystem.js treat it identically to a
// shop/loot sword. NOT deducting the budget or the picked materials yet -
// that's still coming once the pricing rule is settled (see the file-level
// TODO on the craft-btn handler below).
//
// dmg/magicDmg/durability/magicResistance all come from computeCraftedWeaponStats
// (itemDictionary.js) - purely a function of which 4 materials got picked,
// independent of the common/rare tier above (which only picks the mesh
// variant, see buildSwordParts). Two swords built from identical materials
// always come out with identical stats regardless of budget/rarity tier.
function buildSwordItem(){
    const rarity = currentRarityBase
    const bladeLabel  = selectedMaterials.blade.materialLabel
    const guardLabel  = selectedMaterials.guard.materialLabel
    const handleLabel = selectedMaterials.handle.materialLabel
    const pommelLabel = selectedMaterials.pommel.materialLabel
    const dn = `${bladeLabel} Blade`

    const { dmg, magicDmg, durabilityMax, magicResistance } = computeCraftedWeaponStats(selectedMaterials)

    return {
        itemId: randomNum(),
        // timestamped so it's unique from every other crafted sword AND
        // from the static swordsdata.js catalog - createcharacter.js's
        // swordMeshes cache is keyed by name, so two different recipes
        // sharing a name would render whichever one built its mesh first
        // for both, regardless of which item is actually equipped
        name: `customsword_${Date.now()}`,
        dn,
        itemCateg: "equipable",
        itemType: "weapon",
        weaponType: "sword",
        equipAbilities: {
            dmg, magicDmg, magicResistance, def: 0, plusStr: 0, plusDex: 0, plusInt: 0,
        },
        consumeAbilities: { plusHp: 0, plusMp: 0, plusSp: 0, plusDmg: 0, plusSpd: rarity === "rare" ? 1 : 0 },
        equiped: false,
        soulFeed: 0,
        isEnhanceAble: true,
        enhancedLevel: 0,
        slots: [],
        durability: { current: durabilityMax, max: durabilityMax },
        price: { coinType: "bronze", pieces: Math.max(1, Number(budgetInput.value) || 0) },
        qnty: 1,
        desc: `${dn}, a ${rarity} blade forged with a ${guardLabel.toLowerCase()} guard, a ${handleLabel.toLowerCase()} grip, and a ${pommelLabel.toLowerCase()} pommel.`,
        rarity,
        parts: buildSwordParts(),
    }
}

// swaps the center icon to the forging animation for a beat before the
// recipe actually resolves - purely cosmetic, doesn't touch inventory/state
function playForgingAnimation(cb){
    isForging = true
    craftBtn.disabled = true
    centerIcon.src = SWORD_FORGING_ICON
    centerIcon.classList.add("forging")
    setTimeout(() => {
        centerIcon.src = SWORD_ICON
        centerIcon.classList.remove("forging")
        craftBtn.disabled = false
        isForging = false
        cb()
    }, FORGING_DURATION_MS)
}

craftBtn.addEventListener("click", () => {
    if(isForging) return

    const budget = Number(budgetInput.value) || 0
    if(budget <= 0) return openClosePopup("Enter a budget first", true, 1500)

    const isSword = activeCategory === "sword"
    const requiredParts = isSword ? SWORD_PARTS : ["item"]
    const missingParts = requiredParts.filter(part => !selectedMaterials[part])
    if(missingParts.length) return openClosePopup("Pick a material for every part first", true, 1500)

    const rarity = currentRarityBase

    // TODO: budget isn't spent and the picked materials' qnty isn't touched
    // yet - crafting is currently free. Once the pricing rule is settled,
    // spendOnPrice()+decrementing selectedMaterials' qnty go here (see
    // buyorsell.js's actionBtn handler for the spendOnPrice pattern).
    const finish = () => {
        if(isSword){
            const item = buildSwordItem()
            obtain(item)
            resetPartSelections()
        } else {
            // armor/helmet/pauldron still aren't real items yet - see
            // buildSwordItem's comment; those need a modelName that
            // actually matches a template in their .glb, which isn't
            // verified yet, so this stays a dry run for now
            console.log(`craft ${activeCategory} requested`, { itemType: activeCategory, rarity, budget, metalColor: selectedMaterials.item.tintKey })
        }
    }

    if(isSword) playForgingAnimation(finish)
    else finish()
})

export function openCloseCraftUI(forceOpen){
    const willOpen = forceOpen !== undefined ? forceOpen : craftCont.style.display === "none" || !craftCont.style.display
    if(willOpen) selectCategory("sword")
    craftCont.style.display = willOpen ? "flex" : "none"
}

selectCategory("sword")
