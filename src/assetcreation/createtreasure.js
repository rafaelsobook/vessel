import { StandardMaterial, Texture, Vector3 } from "@babylonjs/core"
import { getSocketContainers, getPlayersOnScene } from "../sockets/worldsocket.js"
import { getCharState } from "../charactersystem/characterstate.js"
import { onIntersecEnterTrig, onIntersecExitTrig } from "../components/actionManager.js"
import { openCloseInteractBtn } from "../tools/popupUI.js"
import { obtain, obtainAll } from "../charactersystem/inventory.js"
import { randomNum } from "../tools/tools.js"
import { emitRemoveTreasure } from "../sockets/emits.js"
import { receiveAchievement } from "../charactersystem/achievement.js"
import { startTimedPickup } from "../components/timedPickup.js"

// rarity -> chest skin (client/public/images/modeltex/treasure{0,1,2}.jpg) -
// only 3 chest textures exist for the game's 5-tier rarity scale
// (common/uncommon/rare/epic/legendary - see resourceLoot.js/toSell.js for
// that scale in use), so the two tiers without a texture of their own double
// up onto their nearest visual neighbor instead: common/uncommon share the
// plain wood-and-brass look, rare/epic share the cool steel-blue look, and
// the gold-leaf skin is kept for the top tiers - legendary, and the mythic
// pieces in the hidden places' hoards (tcp's hiddenHoards.ts).
const RARITY_TREASURE_TEX = {
    common:    "./images/modeltex/treasure0.jpg",
    uncommon:  "./images/modeltex/treasure0.jpg",
    rare:      "./images/modeltex/treasure1.jpg",
    epic:      "./images/modeltex/treasure1.jpg",
    legendary: "./images/modeltex/treasure2.jpg",
    mythic:    "./images/modeltex/treasure2.jpg",
}

// OPENING TAKES A MOMENT - pressing interact starts a bar over the chest
// (components/timedPickup.js, the same one every pickup shows), and only a
// full bar hands the loot over. The better the loot, the longer it takes: the
// rarity of what's inside (itemDetail's - the same one that picks the skin)
// sets the time. While the bar fills, the server holds the chest for me
// (tcp's pickup claims) - nobody else can start opening it.
const OPEN_SECONDS_BY_RARITY = { rare: 10, epic: 15, legendary: 15, mythic: 15 }
// common, uncommon - and anything unrated (the crypt's lunaraqum is "normal")
const OPEN_SECONDS_DEFAULT = 5
// walk further than this from it and the opening stops
const OPEN_RADIUS = 2.5

const openSeconds = rarity => OPEN_SECONDS_BY_RARITY[rarity] ?? OPEN_SECONDS_DEFAULT

// A world-placed chest holding one item - clones containers.js's shared
// treasureRoot template (a merged, hidden, static mesh - see its own comment
// for why mergeAndLoadModel, not loadAvatarContainer, was used to load it),
// skins it per the item's rarity, and wires up the same "walk up, press
// interact, obtain()" flow areascene.js's own sword-in-the-ground loot
// boxes already use (onIntersecEnterTrig + openCloseInteractBtn), so this
// behaves exactly like every other pickable world object already does
// instead of inventing a new interaction convention.
//
// itemDetail is expected to already be a complete, ready-to-obtain() item
// object (whatever shape createLootItem/toSell.js/npcDetails.js items use) -
// this only reads rarity/dn/itemId off it for the chest itself, everything
// else passes straight through to obtain() untouched on pickup.
//
// options.treasureId, when passed, is a SERVER-known world-treasure id
// (tcp/recources/treasures.ts's own itemId - a different id than
// itemDetail.itemId, which only identifies the item once it's actually in
// someone's inventory) - opening the chest then tells the server to remove
// it (worldsocket.js's emitRemoveTreasure) so no other player can also loot
// it, and it also becomes this chest mesh's own name instead of a random
// one, so worldsocket.js's "treasure-removed" broadcast (from someone else
// opening it first) can find and dispose THIS exact mesh by that same id.
// Left undefined for one-off local/scripted treasures (myownspeech.js's
// wake-up cutscene) that have no server-side record to sync at all.
export function createTreasureMesh(scene, position, itemDetail, options = {}){
    if(!itemDetail) return console.warn("[createtreasure] no itemDetail passed")

    // extras: more items in the same chest (tcp's record's `extras`) - the chest's
    // skin follows itemDetail's rarity alone
    const { treasureId, extras } = options
    const { itemId, rarity } = itemDetail

    const treasureRoot = getSocketContainers()?.treasureRoot
    if(!treasureRoot){
        // missing/failed-to-load treasure.glb already warned about once in
        // containers.js - no need to spam the console again per spawn, just
        // bail quietly instead of crashing whatever placed this
        return null
    }

    const meshId = treasureId ?? itemId ?? randomNum()
    const chest = treasureRoot.clone(`treasure_${meshId}`)
    chest.isVisible = true
    chest.setEnabled(true)
    chest.isPickable = false
    chest.position = new Vector3(position.x, position.y, position.z)


    // material is cached/shared by rarity (below), not rebuilt fresh per
    // chest - several chests of the same rarity reuse one StandardMaterial/
    // Texture pair instead of each paying to load its own
    const texPath = RARITY_TREASURE_TEX[rarity] ?? RARITY_TREASURE_TEX.common
    // chest.material = createMat(`treasureMat_${chest.name}`, null, texPath, scene)
    let mat = scene.getMaterialByName(`treasuremat_${RARITY_TREASURE_TEX[rarity]}`)
    if(!mat){
        mat = new StandardMaterial(`treasuremat_${RARITY_TREASURE_TEX[rarity]}`, scene)
        mat.diffuseTexture = new Texture(texPath, scene, true, false)
    }
    chest.material = mat

    const myPlayer = getPlayersOnScene().find(pl => pl.owner === getCharState().owner)
    if(!myPlayer){
        // scene/player not fully spun up yet wherever this got called from -
        // the chest still exists and looks right, it just can't be opened
        // until a reload picks it up with the player actually on scene
        console.warn("[createtreasure] no local player on scene yet, interact trigger skipped")
        return chest
    }

    let opened = false
    // standing at it - a stopped opening offers the button again
    let inside = false

    const finishOpening = () => {
        opened = true
        // obtain() already pops its own "acquired X" toast - no need to
        // layer a second "you found a treasure!" popup on top of it
        if(extras?.length) obtainAll([itemDetail, ...extras])
        else obtain(itemDetail)
        receiveAchievement("treasure-hunter")
        // tell the server FIRST, before disposing locally - a
        // server-tracked treasure (treasureId set) needs every other
        // client to also drop this chest, so no one else can loot the
        // same one. No-op for a treasureId-less local/scripted treasure.
        if(treasureId) emitRemoveTreasure(treasureId)
        chest.dispose()
    }

    const offer = () => openCloseInteractBtn("normal", true, () => {
        if(opened) return
        openCloseInteractBtn(false)
        startTimedPickup({
            scene,
            target: chest,
            label: "Opening chest",
            seconds: openSeconds(rarity),
            radius: OPEN_RADIUS,
            // a server-tracked chest is held for me while it opens
            claim: treasureId ? { kind: "treasure", id: treasureId } : null,
            onDone: finishOpening,
            onCancel: () => { if(inside && !opened && !chest.isDisposed()) offer() },
        })
    })

    onIntersecEnterTrig(chest, myPlayer.body, scene, () => {
        inside = true
        if(!opened) offer()
    })
    onIntersecExitTrig(chest, myPlayer.body, scene, () => {
        inside = false
        if(opened) return
        openCloseInteractBtn(false, false)
    })

    return chest
}
