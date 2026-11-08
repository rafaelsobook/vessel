import { Color3, MeshBuilder, Vector3 } from "@babylonjs/core"
import * as GUI from "@babylonjs/gui"
import { createCrystalNode } from "infterrain"
import { createOre } from "../assetcreation/createRock.js"
import { createAggregate } from "../tools/physics.js"
import { onIntersecEnterTrig, onIntersecExitTrig } from "./actionManager.js"
import { openCloseInteractBtn, openClosePopup } from "../tools/popupUI.js"
import { getCharState, setCharStateMode } from "../charactersystem/characterstate.js"
import { obtain, reduceDurability } from "../charactersystem/inventory.js"
import { createLootItem } from "../staticRecources/resourceLoot.js"
import { receiveAchievement } from "../charactersystem/achievement.js"
import { getAllSounds, playSound } from "./soundSystem.js"
import { faceForward } from "../controllers/inputMovement.js"
import { emitMineOre, emitMyLoc } from "../sockets/emits.js"
import { getPlayersOnScene } from "../sockets/worldsocket.js"
import { sparkBurst } from "../effects/blessingFx.js"

// ORE DEPOSITS - tcp's (recources/ores.ts): the village's, the dungeons', the
// open world's rich veins. Each is built from tcp's data - its look (the
// colour of the rarest thing it holds), where it stands, what it yields and
// how many hit points it has left.
//
// Walk up to one and the pickaxe button shows; press it to start mining (the
// looping "minning" mode, like a tree or any minable resource). Every swing -
// each loop of the animation - digs: a roll against the deposit's loots, a
// point of the pickaxe's durability, and a "mineOre" to tcp, which takes one
// of its hit points and tells everyone how many are left ("ore-hp" - the bar
// over it). At 0 tcp removes it ("ore-removed"): it breaks apart, for
// everyone, and whoever was mining it stops.
//
// worldsocket.js calls createOreDeposit for each of tcp's ores in this place
// (on every reCreateMeshesInScene - a deposit already standing is left alone),
// setOreHp / removeOreDeposit from tcp's broadcasts.

// scene -> Map(oreId -> deposit)
const depositsByScene = new WeakMap()
// the deposit I'm mining right now - the one the swings land on
let mining = null

// the splinters of a broken crystal, by tint (violet, teal, rose)
const CRYSTAL_BURST = [new Color3(0.7, 0.55, 1), new Color3(0.45, 0.95, 0.95), new Color3(1, 0.55, 0.78)]

const HP_BAR = { width: 70, height: 7, offsetY: -55 }

function depositsOf(scene){
    let deposits = depositsByScene.get(scene)
    if(!deposits) depositsByScene.set(scene, deposits = new Map())
    return deposits
}

// one shared GUI layer per scene for the hp bars
const hpLayers = new WeakMap()
function hpLayer(scene){
    let ui = hpLayers.get(scene)
    if(ui) return ui
    ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("oreHpUI", true, scene)
    hpLayers.set(scene, ui)
    return ui
}

function myPlayer(){
    const owner = getCharState()?.owner
    return getPlayersOnScene().find(pl => pl.owner === owner)
}

// every swing of the pickaxe - hooked once onto my character's "minning"
// clip (its loop event, so it lands in step with the swing)
function hookSwings(player){
    const clip = player?.anims?.find(anim => anim.name.toLowerCase() === "minning")
    if(!clip || clip._hookedOreSwings) return
    clip._hookedOreSwings = true
    clip.onAnimationGroupLoopObservable.add(() => {
        const deposit = mining
        if(!deposit || deposit.gone) return
        playSound(getAllSounds().minningS)
        const weapon = getCharState()?.items.find(itm => itm.itemType === "weapon" && itm.equiped)
        if(weapon) reduceDurability(weapon)
        deposit.ore.loots?.forEach(loot => {
            if(Math.random() > loot.chance) return
            const item = createLootItem(loot.name)
            if(item) obtain(item)
        })
        receiveAchievement("miner")
        emitMineOre(deposit.ore.oreId)
    })
}

function stopMining(deposit){
    openCloseInteractBtn("normal", false)
    if(mining !== deposit) return
    mining = null
    if(getCharState()?.mode === "minning") setCharStateMode("idle")
}

function startMining(deposit){
    const weapon = getCharState()?.items.find(itm => itm.itemType === "weapon" && itm.equiped)
    if(!weapon){
        // the button stays up, still wired here - equip one and press again
        openClosePopup("Required pickaxe", true, 1500)
        return
    }
    const player = myPlayer()
    hookSwings(player)
    openCloseInteractBtn("pickaxe", false)
    faceForward(deposit.mesh.position)
    setCharStateMode("minning")
    mining = deposit
    player?.equipSword(weapon.name, true, weapon.parts, weapon.weaponType, weapon.metalColor)
    emitMyLoc("minning", weapon.name)
}

function hpBar(scene, mesh, ore){
    const frame = new GUI.Rectangle(`oreHp_${ore.oreId}`)
    frame.width = `${HP_BAR.width}px`
    frame.height = `${HP_BAR.height}px`
    frame.thickness = 1
    frame.color = "#1a1208"
    frame.background = "rgba(10, 8, 6, 0.75)"
    frame.cornerRadius = 2
    frame.isVisible = false
    const fill = new GUI.Rectangle(`oreHpFill_${ore.oreId}`)
    fill.thickness = 0
    fill.background = "#c9a24a"
    fill.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    frame.addControl(fill)
    hpLayer(scene).addControl(frame)
    frame.linkWithMesh(mesh)
    frame.linkOffsetY = HP_BAR.offsetY
    const show = (hp, maxHp) => { fill.width = `${Math.max(0, Math.min(1, hp / maxHp)) * 100}%` }
    show(ore.hp, ore.maxHp)
    return { frame, show }
}

// ore: tcp's record. groundY: the ground's height there - the open world's
// terrain (tcp has none, its y is 0), anywhere else the ore's own y
export function createOreDeposit(scene, ore, groundY = ore.pos.y){
    const deposits = depositsOf(scene)
    if(deposits.has(ore.oreId) || !(ore.hp > 0)) return deposits.get(ore.oreId) ?? null
    const player = myPlayer()
    if(!player?.body) return null

    // the Crystal Hollows' "hollow" vein stands as one of the hollows' own great
    // crystals (infterrain's createCrystalNode) - violet, teal or rose by tcp's
    // tint, its shape from the oreId so everyone sees the same one. Every other
    // vein is the rock mound.
    const isCrystal = ore.vein === "hollow"
    const mesh = isCrystal
        ? createCrystalNode(scene, { x: ore.pos.x, y: groundY, z: ore.pos.z }, { palette: ore.tint ?? 0, scale: 1.1, seed: parseInt(String(ore.oreId).slice(-4)) || 0 })
        : createOre(scene, { x: ore.pos.x, y: groundY, z: ore.pos.z }, ore.color)
    mesh.name = `ore_${ore.oreId}`
    mesh.rotation.y = ore.rotation ?? 0
    mesh.isPickable = false
    const aggregate = createAggregate(mesh, { mass: 0 }, "box", scene)

    // the walk-up zone round it
    // (a crystal's body is wide - the zone has to reach out past it, to where
    // the player's own body can stand)
    let zoneSize = 2
    if(isCrystal){
        mesh.computeWorldMatrix(true)
        const ext = mesh.getBoundingInfo().boundingBox.extendSizeWorld
        zoneSize = 2 * (Math.max(ext.x, ext.z) + 1.6) / mesh.scaling.x
    }
    const zone = MeshBuilder.CreateBox(`ore_zone_${ore.oreId}`, { size: zoneSize }, scene)
    zone.isVisible = false
    zone.isPickable = false
    zone.parent = mesh

    const deposit = { ore: { ...ore }, mesh, aggregate, zone, gone: false, burstColor: isCrystal ? CRYSTAL_BURST[ore.tint ?? 0] : null }
    deposit.bar = hpBar(scene, mesh, ore)
    onIntersecEnterTrig(zone, player.body, scene, () => {
        if(deposit.gone) return
        deposit.bar.frame.isVisible = true
        openCloseInteractBtn("pickaxe", true, () => startMining(deposit))
    })
    onIntersecExitTrig(zone, player.body, scene, () => {
        deposit.bar.frame.isVisible = false
        stopMining(deposit)
    })
    deposits.set(ore.oreId, deposit)
    return deposit
}

// tcp's "ore-hp" - how many hit points it has left now
export function setOreHp(scene, oreId, hp, maxHp){
    const deposit = depositsOf(scene).get(oreId)
    if(!deposit || deposit.gone) return
    deposit.ore.hp = hp
    if(maxHp) deposit.ore.maxHp = maxHp
    deposit.bar.show(hp, deposit.ore.maxHp)
}

// tcp's "ore-removed" - worked out: it breaks apart in a burst of rubble and
// dust, and whoever was mining it stops
export function removeOreDeposit(scene, oreId){
    const deposits = depositsOf(scene)
    const deposit = deposits.get(oreId)
    if(!deposit || deposit.gone) return
    deposit.gone = true
    deposits.delete(oreId)
    stopMining(deposit)
    const at = deposit.mesh.position.clone().addInPlaceFromFloats(0, 0.4, 0)
    sparkBurst(scene, at, deposit.burstColor ?? new Color3(0.55, 0.5, 0.45), { count: 50, power: 3.5, size: [0.25, 0.5], life: [0.5, 1.1] })
    playSound(getAllSounds().minningS)
    deposit.bar.frame.dispose()
    deposit.aggregate?.dispose()
    deposit.zone.dispose()
    deposit.mesh.dispose()
}
