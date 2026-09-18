import { getPlayersOnScene, getEnemiesOnScene, getDuelOpponentsOnScene, pushProjectile, removeProjectile } from "../sockets/worldsocket"
import { onIntersecEnterTrig, onIntersecExitTrig, removeIntersecTrig } from "../components/actionManager.js"
import { MeshBuilder, Vector3 } from "@babylonjs/core"
import { getCharState, dealDamageToEnemy } from "../charactersystem/characterstate"
import { randNum } from "../tools/random.js"
import { getProjectilesOnScene } from "../sockets/worldsocket.js"
import { createWeapon } from "../assetcreation/createweapon.js"
import { createGroundWeapon } from "../assetcreation/creategroundweapon.js"
import { getAllSounds, playSound } from "../components/soundSystem.js"
import { poppingTextMesh } from "../tools/GUITools.js"
import { openCloseInteractBtn } from "../tools/popupUI.js"
import { obtain } from "../charactersystem/inventory.js"
import { calcDmg } from "../charactersystem/attackingSystem.js"

// mesh-name substrings (case-insensitive) that count as "natural terrain" for
// groundWeaponItem's own env-hit check below - openworld chunk meshes
// (infterrain), any mesh literally named "ground", and trees. Deliberately
// narrower than "anything the raycast can hit" - a spear that sticks into a
// WALL or building still just behaves like every other env hit always has
// (decorative, disposed after willDisposeCountDown), only a natural-terrain
// hit is recoverable as real ground loot.
const GROUND_WEAPON_TERRAIN_KEYWORDS = ["ground", "chunk", "tree"]

// a thrown weapon that stuck into an ENEMY (not the env raycast branch,
// which already gets its own createGroundWeapon treatment above) - rather
// than despawning after willDisposeCountDown, it stays parented to that
// enemy indefinitely and becomes a real walk-up pickup, same
// interact-button pattern creategroundweapon.js's own onIntersecEnterTrig/
// onIntersecExitTrig pair already uses, just registered directly against
// the still-flying projectileMesh (already following the enemy's own body
// via setParent) instead of a fresh static collider box - it has no fixed
// lootPosition to build one at, it's riding around on whatever the enemy
// does next. Resolved against the LOCAL player only, same scoping
// groundWeaponItem's env-hit case above already settled on.
function registerStuckWeaponPickup(scene, projectileMesh, item, projectileId){
    const myPlayer = getPlayersOnScene().find(pl => pl.owner === getCharState()?.owner)
    if(!myPlayer?.body) return
    let pickedUp = false
    onIntersecEnterTrig(projectileMesh, myPlayer.body, scene, () => {
        if(pickedUp) return
        openCloseInteractBtn("normal", true, () => {
            if(pickedUp) return
            pickedUp = true
            openCloseInteractBtn(false)
            obtain({ ...item, equiped: false })
            removeProjectile(projectileId)
        })
    })
    onIntersecExitTrig(projectileMesh, myPlayer.body, scene, () => {
        if(pickedUp) return
        openCloseInteractBtn(false, false)
    })
}

// groundWeaponItem - optional, defaults to null so every EXISTING caller is
// unaffected. When passed (only uimanagement.js's own throwSpearProjectile
// does, with the full spear item it just unequipped), a MISS that the env
// raycast branch below resolves against natural terrain (see
// GROUND_WEAPON_TERRAIN_KEYWORDS above) doesn't just stick decoratively and
// later despawn like every other env hit - it becomes a real, permanent,
// walk-up-and-reclaim pickup via assetcreation/creategroundweapon.js's own
// createGroundWeapon, same mechanic localroomdb.js's own placeId 200
// swordsStrucked entries already use. A miss against anything else (a wall,
// a building) still just behaves like a normal env hit always has.
//
// dmgDetails ({physicalDmg, weaponDmg}, e.g. attackingSystem.js's own
// calcDmg() return shape) - optional, defaults to null so every EXISTING
// caller (astralrainSkill's own spawnFallingSword in skillEffects.js, which
// deliberately deals no damage through this function at all - see the
// enemies-loop's own header comment just below for why) keeps behaving
// exactly as before. Only uimanagement.js's own throwSpearProjectile passes
// one, so a thrown spear can actually hurt something instead of just
// visually sticking into it. Captured ONCE by the caller at THROW time, not
// recomputed here at hit time - calcDmg(charState) reads charState.items
// for the currently-equipped weapon, and throwSpearProjectile immediately
// unequips/removes the spear from the inventory right after this function
// is called, so a hit-time recompute would see an unarmed player and silently
// undercount the damage.
// pitchOffset (radians, default 0) - added on top of the real target-direction
// pitch below. NOT purely cosmetic: this mesh has no separate "visual facing"
// vs "movement direction" - renderer.js's own per-frame projectile loop moves
// it via `body.locallyTranslate(0,0,spd*dt)`, i.e. straight along whatever
// its CURRENT local Z axis (set once here, at spawn, and never touched again)
// happens to point, and the env-hit raycast a few dozen lines below reads the
// same axis via `instance.getDirection(Vector3.Forward())`. So tilting this
// down doesn't just make the spear LOOK like it's diving - it genuinely
// flies in a straight line angled downward from release, and the env
// raycast tilts down with it. That's exactly what makes it usable for "bend
// the spear down a little so it looks like it's already falling" - a small
// positive value here is a nose-down pitch (positive rotation.x = downward,
// same sign the real dy branch below already uses for an actually-descending
// targetDirection).
//
// speedMult (default 1, every EXISTING caller unaffected) - multiplies the
// base flight speed (10) the projectile object below spawns with. Only
// uimanagement.js's own throwSpearProjectile passes one (SPEAR_THROW_SPEED_MULT,
// 3 - "make the spear three times faster").
export function spawnProjectile(spawnPos, targetDirection, glowingColor, scene, _weaponPartDetails = "default", cbAfterHitAPlayer, willDisposeCountDown, cbAfterHitAnEnemy, willNotHitTheGround, weaponType = "sword", dmgDetails = null, groundWeaponItem = null, pitchOffset = 0, speedMult = 1){
    let weaponPartDetails = _weaponPartDetails;

    if(weaponPartDetails === "default"){
        weaponPartDetails = {
            bladeRarity: "rare2",
            guardRarity: "rare1",
            handleRarity: "common1",
            pommelRarity: "common1"
        }
    }
    const itemId = randNum(1000,9999).toLocaleString()

    let container = scene.getMeshByName("projectile")
    
    if(!container) {
        container = MeshBuilder.CreateBox("projectile", {size: 0.2, depth: 1}, scene)
        container.isVisible = false
        container.checkCollisions = true
        container.isPickable = false
        container.visibility = 0.4
    }
    const instance = container.createInstance(`projectile.${itemId}`)
    instance.position = new Vector3(spawnPos.x, spawnPos.y, spawnPos.z)
    // instance.position.y += 0.25
    instance.isVisible = false
    // const dir = new Vector3(targetDirection.x, targetDirection.y, targetDirection.z)
    // instance.lookAt(new Vector3(-1, 1, -0.2), 0, 0, 0, Space.LOCAL)
    // createWeapon's real signature is (scene, weaponType, pos, parent,
    // itemName, options, glowingColor) - itemName only matters for single-
    // mesh weapon types (sword has part meshes, so it's unused here), but
    // omitting it used to silently shift weaponPartDetails into the
    // itemName slot and glowingColor into the options slot, leaving the
    // real glowingColor param empty - no sword spawned via this function
    // ever actually glowed. null keeps the arg count correct.
    //
    // weaponType (new, defaults to "sword" - every existing caller keeps
    // rendering a sword exactly as before) - lets a thrown weapon actually
    // look like whatever's being thrown instead of always a sword. Only
    // meaningful for a part-based weaponType (sword/spear/axe/pickaxe -
    // see createweapon.js's hasPartMeshes); a single-mesh weaponType would
    // need itemName wired through here too, not done yet since nothing
    // calls this with one.
    const weaponsRoot = createWeapon(scene, weaponType, {x:0, y:0, z:0}, instance, null, weaponPartDetails, glowingColor)
    weaponsRoot.addRotation(Math.PI,0,Math.random())
    weaponsRoot.scaling = new Vector3(0.2,0.2,0.2)
    // weaponsRoot.bakeCurrentTransformIntoVertices()

    // instance.visibility = 1
    const dx = targetDirection.x - instance.position.x
    const dy = targetDirection.y - instance.position.y
    const dz = targetDirection.z - instance.position.z

    instance.rotation.y = Math.atan2(dx, dz)
    // instance.rotation.x = -Math.atan2(dy, Math.sqrt(dx * dx + dz * dz)) + pitchOffset
    instance.addRotation( -Math.atan2(dy, Math.sqrt(dx * dx + dz * dz)) + pitchOffset,0,0)


    const projectile = {
        itemId,
        body: instance,
        targetDirection: {x:dx, y:dy, z:dz},
        // speedMult (default 1) - only scales this base flight speed, not
        // the brief 2/5 wind-down speeds the hit branches below switch to
        // while the projectile settles into whatever it struck
        spd: 10 * speedMult,
        placeId: getCharState().currentPlace.placeId,
        stuck: false,
        // this file's own env branch below already does real ground/wall/
        // tree hit detection via physicsEngine.raycast() every frame - opts
        // out of renderer.js's generic openworld ground-following nudge
        // (PROJECTILE_GROUND_*), which was fighting this projectile's own
        // intentional fall/flight path (most visibly astralrainSkill's
        // falling swords: nudging them back up out of PROJECTILE_GROUND_LOW
        // right as they were trying to embed into the ground kept them from
        // ever actually reaching it, so they never registered a hit)
        willDetectSurface: false,
    }

    let hasHit = false
    // only ever populated below - the environment raycast observer, kept
    // in scope up here so BOTH the player/enemy trigger branches AND the
    // raycast branch can clean each other up, whichever one fires first
    let envHitObserver = null

    const players = getPlayersOnScene()
    players.forEach(pl => {
        // aegiswardSkill's own rotating barrier (skillEffects.js's
        // spawnBarrier, player.barrierMesh) - if this player currently has
        // one up, register a trigger against the barrier's own box too,
        // sharing the same `hasHit` flag the bodytarget trigger below
        // uses. Same "whichever mesh this thing's flight path actually
        // reaches first wins" reasoning skillEffects.js's own
        // fireEnemySkillProjectile already follows for enemy/npcFighter
        // projectiles - see that function's own comment for the full
        // rundown (not duplicated import-wise here on purpose, to avoid a
        // skillEffects.js <-> skills.js import cycle - this file already
        // gets imported BY skillEffects.js).
        const targetBarrier = pl.barrierMesh
        let barrierAction = null
        if(targetBarrier?.box){
            barrierAction = onIntersecEnterTrig(instance, targetBarrier.box, scene, () => {
                if(hasHit) return
                hasHit = true
                if(envHitObserver) scene.onBeforeRenderObservable.remove(envHitObserver)
                removeIntersecTrig(instance, barrierAction)
                getAllSounds().weaponblockS?.play()
                poppingTextMesh("Blocked!", "cyan", 40 + Math.random() * 25, Math.random() * 1, { x: -0.3 + Math.random() * 0.6, y: 0.3, z: -0.3 + Math.random() * 0.6 }, targetBarrier.box, true)
                removeProjectile(projectile.itemId)
            })
        }

        const enterAction = onIntersecEnterTrig(instance, pl.bodytarget, scene, () => {
            if(hasHit) return
            hasHit = true
            if(envHitObserver) scene.onBeforeRenderObservable.remove(envHitObserver)
            if(barrierAction) removeIntersecTrig(instance, barrierAction)
            getAllSounds().struckS?.play()
            let theProjectile = getProjectilesOnScene().find(proj => proj.itemId === projectile.itemId)
            theProjectile.spd = 2
            removeIntersecTrig(instance, enterAction)
            setTimeout(() => {
                theProjectile = getProjectilesOnScene().find(proj => proj.itemId === projectile.itemId)
                if(!theProjectile) return
                theProjectile.spd = 5
                theProjectile.stuck = true
                theProjectile.body.setParent(pl.bodytarget)
                if(willDisposeCountDown){
                    setTimeout(() => {
                        removeProjectile(theProjectile.itemId)

                    }, willDisposeCountDown)
                }
                if(cbAfterHitAPlayer) cbAfterHitAPlayer(pl.owner)
            }, 100)

        })
    })

    // enemies - visual mirror of the player branch above (sticks the
    // sword into whatever it hit, same 100ms wind-down + stuck flag). No
    // damage dealt here UNLESS a caller actually passed dmgDetails (see
    // that param's own header comment) - astralrainSkill's own
    // spawnFallingSword (skillEffects.js) still runs its own separate,
    // analytically-timed hit check instead of relying on this trigger, and
    // keeps doing so unchanged (it never passes dmgDetails, so this stays a
    // pure visual for it, exactly as before). Shares the same `hasHit`
    // guard as the player loop, so whichever body (player or enemy) this
    // sword reaches FIRST is the one it visually sticks to, never both.
    const enemies = getEnemiesOnScene()
    enemies.forEach(enem => {
        if(!enem.body) return
        const enterAction = onIntersecEnterTrig(instance, enem.body, scene, () => {
            if(hasHit) return
            hasHit = true
            if(envHitObserver) scene.onBeforeRenderObservable.remove(envHitObserver)
            
            // playSound()
            getAllSounds().struckS.play()
            let theProjectile = getProjectilesOnScene().find(proj => proj.itemId === projectile.itemId)
            theProjectile.spd = 2
            removeIntersecTrig(instance, enterAction)
            
            // same weaponDmg-else-physicalDmg rule every other real hit
            // resolution in this game already follows (tcp/index.ts's own
            // enemyIsHit handler, duelSystem.js's own atkCollider handler)
            if(dmgDetails){
                console.log(dmgDetails)
                const freshCharState = getCharState()
                // const dmgToApply = dmgDetails.weaponDmg ? dmgDetails.weaponDmg : dmgDetails.physicalDmg
                dealDamageToEnemy({
                    playerId: freshCharState.owner,
                    dmgDetails: calcDmg(freshCharState),
                    targetId: enem._id,
                    currentPlaceId: freshCharState.currentPlace.placeId,
                    isPhysical: true,
                })
            }

            setTimeout(() => {
                theProjectile = getProjectilesOnScene().find(proj => proj.itemId === projectile.itemId)
                if(!theProjectile) return
                theProjectile.spd = 5
                theProjectile.stuck = true
                theProjectile.body.setParent(enem.body)
                // groundWeaponItem (thrown spear) - stays stuck in the enemy
                // for good and becomes a real pickup (registerStuckWeaponPickup
                // above) instead of despawning on willDisposeCountDown. Every
                // other caller (no groundWeaponItem passed) keeps the old
                // despawn-after-a-few-seconds behavior unchanged.
                if(groundWeaponItem){
                    registerStuckWeaponPickup(scene, theProjectile.body, groundWeaponItem, theProjectile.itemId)
                }else if(willDisposeCountDown){
                    setTimeout(() => {
                        removeProjectile(theProjectile.itemId)

                    }, willDisposeCountDown)
                }
                if(cbAfterHitAnEnemy) cbAfterHitAnEnemy(enem._id, "monster")
            }, 100)

        })
    })

    // duelSystem.js's npcFighters (Renarden/Vesper etc, pushDuelOpponentOnScene) -
    // never server-tracked (getEnemiesOnScene above never sees them), same
    // parallel every other hit-registration loop in this game already adds
    // for them (skillEffects.js's fireElementalProjectile/findNearestBlinkTarget).
    // Only meaningful when dmgDetails was actually passed (thrown spear) -
    // otherwise this is inert, matching every other caller's existing
    // visual-only behavior. isPhysical:true - a blocking opponent
    // (opponent.weaponBlocking, duelSystem.js's own performBlock) nullifies
    // this the same way it nullifies a normal melee swing.
    if(dmgDetails){
        const duelOpponents = getDuelOpponentsOnScene()
        duelOpponents.forEach(duelOpp => {
            if(!duelOpp.bodytarget) return console.log(`${duelOpp.name} has no mesh bodytarget`)
            const enterAction = onIntersecEnterTrig(instance, duelOpp.bodytarget, scene, () => {
                if(hasHit) return
                hasHit = true
                if(envHitObserver) scene.onBeforeRenderObservable.remove(envHitObserver)
                getAllSounds().struckS?.play()
                let theProjectile = getProjectilesOnScene().find(proj => proj.itemId === projectile.itemId)
                theProjectile.spd = 2
                removeIntersecTrig(instance, enterAction)

                const dmgToApply = dmgDetails.weaponDmg ? dmgDetails.weaponDmg : dmgDetails.physicalDmg
                duelOpp.applyDamage(dmgToApply, { weaponType, hitSound: "spearS1", isPhysical: true })

                setTimeout(() => {
                    theProjectile = getProjectilesOnScene().find(proj => proj.itemId === projectile.itemId)
                    if(!theProjectile) return
                    theProjectile.spd = 5
                    theProjectile.stuck = true
                    theProjectile.body.setParent(duelOpp.body)
                    if(willDisposeCountDown){
                        setTimeout(() => {
                            removeProjectile(theProjectile.itemId)
                        }, willDisposeCountDown)
                    }
                    if(cbAfterHitAnEnemy) cbAfterHitAnEnemy(duelOpp._id, "character")
                }, 100)
            })
        })
    }

    // environment (ground/wall/tree/anything with a physics collider) - a
    // short physics raycast a hair ahead of the projectile, checked every
    // frame via physicsEngine.raycast() (same API inputMovement.js's own
    // isGrounded() ground check already uses). Not an ActionManager
    // intersection trigger like the player/enemy branches above: this
    // projectile's own hitbox is a tiny 0.2-unit box and village's ground
    // mesh is a zero-thickness flat plane - two AABBs that thin, checked
    // once per rendered frame, can skip straight past each other between
    // frames without ever overlapping on a sampled frame (confirmed via a
    // Playground isolate). A physics raycast queries the physics WORLD
    // directly instead of relying on two bounding boxes happening to
    // overlap on the exact frame the check runs, so it doesn't have that
    // failure mode.
    const physicsEngine = scene.getPhysicsEngine()
    if(physicsEngine && !willNotHitTheGround){
        envHitObserver = scene.onBeforeRenderObservable.add(() => {
            if(hasHit) return
            if(instance.isDisposed()){
                scene.onBeforeRenderObservable.remove(envHitObserver)
                return
            }
            const dir = instance.getDirection(Vector3.Forward()).normalize()
            const rayEnd = instance.position.add(dir.scale(0.6))
            const result = physicsEngine.raycast(instance.position, rayEnd)
            if(!result?.hasHit) return

            const hitMesh = result.body?.transformNode
            if(!hitMesh) return

            hasHit = true
            scene.onBeforeRenderObservable.remove(envHitObserver)
            getAllSounds().struckS?.play()

            // groundWeaponItem + a natural-terrain hit - becomes real,
            // permanent ground loot instead of the generic decorative
            // stick-then-despawn below. Resolved against the LOCAL player
            // only (getPlayersOnScene().find on getCharState().owner), same
            // "purely a local pickup, no other client needs to race for it"
            // scope creategroundweapon.js's own header comment already
            // settled on - matches dmgDetails' own precedent just above of
            // only ever doing the "real" thing on the thrower's own client.
            const hitMeshName = (hitMesh.name || "").toLowerCase()
            const isNaturalTerrain = GROUND_WEAPON_TERRAIN_KEYWORDS.some(kw => hitMeshName.includes(kw))
            if(groundWeaponItem && isNaturalTerrain){
                const myPlayer = getPlayersOnScene().find(pl => pl.owner === getCharState()?.owner)
                createGroundWeapon(scene, {
                    ...groundWeaponItem,
                    equiped: false,
                    lootPosition: { x: instance.position.x, y: instance.position.y, z: instance.position.z },
                }, myPlayer?.body)
                removeProjectile(projectile.itemId)
                return
            }

            let theProjectile = getProjectilesOnScene().find(proj => proj.itemId === projectile.itemId)
            if(!theProjectile) return
            theProjectile.spd = 2
            setTimeout(() => {
                theProjectile = getProjectilesOnScene().find(proj => proj.itemId === projectile.itemId)
                if(!theProjectile) return
                theProjectile.spd = 5
                theProjectile.stuck = true
                theProjectile.body.setParent(hitMesh)
                if(willDisposeCountDown){
                    setTimeout(() => {
                        removeProjectile(theProjectile.itemId)

                    }, willDisposeCountDown)
                }
            }, 100)
        })
    }

    pushProjectile(projectile)
    // cbAfterWeaponCreation()
    return itemId
}