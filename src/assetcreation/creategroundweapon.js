import { MeshBuilder, Vector3 } from "@babylonjs/core"
import { createWeapon } from "./createweapon.js"
import { onIntersecEnterTrig, onIntersecExitTrig } from "../components/actionManager.js"
import { openCloseInteractBtn } from "../tools/popupUI.js"
import { obtain } from "../charactersystem/inventory.js"
import { emitPickupStruckWeapon } from "../sockets/emits.js"

// GROUND WEAPON LOOT (placeDetail.swordsStrucked, e.g. placeId 200's duel
// grounds - localroomdb.js) - a real weapon mesh (createWeapon, same call
// convention equipSword/startMining already use) stuck vertically into the
// ground at item.lootPosition, parented to an invisible collider box instead
// of a visible one of its own. Same walk-up/interact-button pattern as
// areascene.js's own MINEABLE RESOURCES block, but against ONE specific
// characterBody (not getPlayersOnScene()) - this is purely a local pickup,
// no other client needs to see or race for it.
//
// rotation.x = Math.PI / 2 is a corrected guess, not a verified fact about
// the sword asset's own authored orientation - the original guess here
// (Math.PI, a 180° flip) came back from an in-game screenshot showing the
// blade still lying FLAT on the ground, just mirrored - a pure 180°
// rotation on one axis can only ever do that to something that's already
// flat (a flat XZ-plane shape stays in the XZ plane however far you spin it
// around X), which means the raw unrotated mesh must rest flat to begin
// with, not blade-up as first assumed. A 90° turn on the same axis is what
// actually tips a flat shape up into vertical - if this still isn't right
// (sideways, or blade pointing UP instead of down into the floor), try
// z: Math.PI / 2 instead of x, or flip the sign (-Math.PI / 2).
//
// characterBody is purely a local pickup TRIGGER target - no other client's
// own onIntersecEnterTrig races against this one, since every connected
// client runs createGroundWeapon separately against its OWN local player
// (see worldsocket.js's reCreateMeshesInScene, and this file's own
// isMultiplayerSynced param below), the same way createtreasure.js's
// createTreasureMesh already does for chests.
//
// isMultiplayerSynced (default false) - true for a weapon that's also a
// real server-tracked entry (tcp/index.ts's struckWeapons array via
// emitStrikeWeapon), so picking it up here also has to tell the server
// (emitPickupStruckWeapon) that no one else can loot it anymore. Left false
// for the original, purely local/scripted case (areascene.js's own
// placeDetail.swordsStrucked replay, e.g. placeId 200's duel grounds
// Frostbite sword) - that one has no server record at all to remove.
//
// Called once per placeDetail.swordsStrucked entry - areascene.js's own
// setup does `placeDetail.swordsStrucked?.forEach(item => createGroundWeapon(scene, item, myCharacter.body))`.
export function createGroundWeapon(scene, item, characterBody, isMultiplayerSynced = false){
    const { lootPosition } = item

    // shared geometry template, same "build once, reuse via clone/instance"
    // precedent areascene.js's own MINEABLE RESOURCES block already sets for
    // its resourceColliderTemplate - kept invisible AND disabled
    // (setEnabled(false)) so the TEMPLATE itself never renders as its own
    // extra box sitting at the origin; only instances of it ever appear
    let templateLootBox = scene.getMeshByName('swordstuckbox')
    if(!templateLootBox){
        templateLootBox = MeshBuilder.CreateBox('swordstuckbox', { size: 1.4 }, scene)
        templateLootBox.isVisible = false
        templateLootBox.setEnabled(false) // template only - never used directly, just instanced
    }
    // createInstance() (unlike clone()) gives the instance its OWN
    // independent transform - position/rotation/scaling are NOT inherited
    // from the source mesh at creation time, only geometry/material are
    // shared - so rotation has to be set on the INSTANCE itself below, not
    // the template above (setting it on the template silently did nothing
    // to any of the actual spawned swords)
    const lootBox = templateLootBox.createInstance(`swordstuck_${item.itemId}`)
    lootBox.position = new Vector3(lootPosition.x, lootPosition.y, lootPosition.z)
    // Math.PI/2 got it standing vertically, but tip-up/pommel-down - the
    // opposite of "stuck in the ground" (tip down, hilt up). Flipping the
    // sign keeps the same 90° vertical turn but reverses which end faces
    // down, per the last screenshot.
    lootBox.rotation.x = -Math.PI / 2
    lootBox.isVisible = false
    lootBox.isPickable = false

    // createWeapon() applies no scale of its own - it only looks correctly
    // sized when parented to a character's hand bone, whose own tiny
    // bone-space scale implicitly shrinks it down. lootBox is a plain
    // world-space box (scale 1), so without this the sword renders at the
    // raw asset's actual huge native size. 0.2 matches creations/skills.js's
    // own weaponsRoot.scaling - the one other place in this codebase that
    // also parents createWeapon's output to a plain world-space box rather
    // than a bone (skillEffects.js's buildWeaponCopies is the same
    // situation too, defaulting to 0.16).
    const weaponRoot = createWeapon(scene, item.weaponType, { x: 0, y: 0, z: 0 }, lootBox, item.name, { ...item.parts, metalColor: item.metalColor })
    weaponRoot.scaling = new Vector3(0.2, 0.2, 0.2)

    let pickedUp = false
    onIntersecEnterTrig(lootBox, characterBody, scene, () => {
        if(pickedUp) return
        openCloseInteractBtn("normal", true, () => {
            if(pickedUp) return
            pickedUp = true
            openCloseInteractBtn(false)

            // lootPosition is ground-placement metadata, not part of the
            // actual inventory item shape (compare against any equipped
            // weapon item elsewhere, e.g. npcDetails.js's Renarden) - strip
            // it before this becomes a real charState.items entry
            const { lootPosition: _drop, ...itemToObtain } = item
            obtain(itemToObtain)
            // tell the server FIRST, before disposing locally - same
            // "so no one else can loot the same one" reasoning
            // createtreasure.js's own emitRemoveTreasure call already
            // follows
            if(isMultiplayerSynced) emitPickupStruckWeapon(item.itemId)
            lootBox.dispose()
        })
    })
    onIntersecExitTrig(lootBox, characterBody, scene, () => {
        if(pickedUp) return
        openCloseInteractBtn(false, false)
    })

    return lootBox
}

// A weapon visually stuck INTO an enemy's body (creations/skills.js's own
// enemy-hit branch, registerStuckWeaponPickup) - unlike createGroundWeapon
// above (a vertical stick into a fixed WORLD position), this parents
// directly to enemyBodyTarget so it rides along with that enemy wherever it
// moves, instead of floating statically at wherever the enemy happened to
// be standing the instant it got struck (which is also wrong for another
// reason: enemy.body.position is roughly mid-body height, not ground level,
// so createGroundWeapon's own "stand vertically at this Y" logic put it
// hanging in mid-air there). Called by worldsocket.js's own struck-weapon
// sync for every OTHER connected client's copy of an enemy-stick, so it
// visually matches what the striking player's own client already sees
// locally instead of a mismatched floating duplicate.
//
// Same shared 'swordstuckbox' template/instancing as createGroundWeapon
// (just reparented instead of world-positioned), and the SAME
// `swordstuck_${item.itemId}` mesh name - so worldsocket.js's
// "struck-weapon-removed" cleanup can find and dispose either kind of
// stuck weapon by that one name, regardless of which of these two
// functions actually built it.
//
// The exact stuck angle here is a fixed approximation (a modest outward
// poke + a little rotational variety), not a real replay of the original
// throw's own flight-angle-at-impact (spawnProjectile's own instance
// rotation) - that value never gets synced over the network, and isn't
// worth adding a field for just to shave a few degrees off a cosmetic
// detail nobody but the striker will ever compare side by side.
export function createEnemyStuckWeapon(scene, item, enemyBodyTarget, characterBody, isMultiplayerSynced = false){
    let templateLootBox = scene.getMeshByName('swordstuckbox')
    if(!templateLootBox){
        templateLootBox = MeshBuilder.CreateBox('swordstuckbox', { size: 1.4 }, scene)
        templateLootBox.isVisible = false
        templateLootBox.setEnabled(false)
    }
    const lootBox = templateLootBox.createInstance(`swordstuck_${item.itemId}`)
    lootBox.parent = enemyBodyTarget
    lootBox.position = new Vector3(0, 0, 0.4)
    lootBox.rotation = new Vector3(Math.PI / 2, (Math.random() - 0.5) * 0.6, 0)
    lootBox.isVisible = false
    lootBox.isPickable = false

    const weaponRoot = createWeapon(scene, item.weaponType, { x: 0, y: 0, z: 0 }, lootBox, item.name, { ...item.parts, metalColor: item.metalColor })
    weaponRoot.scaling = new Vector3(0.2, 0.2, 0.2)

    let pickedUp = false
    onIntersecEnterTrig(lootBox, characterBody, scene, () => {
        if(pickedUp) return
        openCloseInteractBtn("normal", true, () => {
            if(pickedUp) return
            pickedUp = true
            openCloseInteractBtn(false)

            const { lootPosition: _drop, ...itemToObtain } = item
            obtain(itemToObtain)
            if(isMultiplayerSynced) emitPickupStruckWeapon(item.itemId)
            lootBox.dispose()
        })
    })
    onIntersecExitTrig(lootBox, characterBody, scene, () => {
        if(pickedUp) return
        openCloseInteractBtn(false, false)
    })

    return lootBox
}
