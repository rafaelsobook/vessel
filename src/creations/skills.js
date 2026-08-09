import { getPlayersOnScene, getEnemiesOnScene, pushProjectile, removeProjectile } from "../sockets/worldsocket"
import { onIntersecEnterTrig, removeIntersecTrig } from "../components/actionManager.js"
import { MeshBuilder, Vector3 } from "@babylonjs/core"
import { getCharState } from "../charactersystem/characterstate"
import { randNum } from "../tools/random.js"
import { getProjectilesOnScene } from "../sockets/worldsocket.js"
import { createWeapon } from "../assetcreation/createweapon.js"
import { getAllSounds } from "../components/soundSystem.js"

export function spawnProjectile(spawnPos, targetDirection, glowingColor, scene, _weaponPartDetails = "default", cbAfterHitAPlayer, willDisposeCountDown, cbAfterHitAnEnemy){
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
    const weaponsRoot = createWeapon(scene, "sword", {x:0, y:0, z:0}, instance, null, weaponPartDetails, glowingColor)
    weaponsRoot.addRotation(Math.PI,0,Math.random())
    weaponsRoot.scaling = new Vector3(0.3,0.3,0.3)
    // weaponsRoot.bakeCurrentTransformIntoVertices()

    // instance.visibility = 1
    const dx = targetDirection.x - instance.position.x
    const dy = targetDirection.y - instance.position.y
    const dz = targetDirection.z - instance.position.z

    instance.rotation.y = Math.atan2(dx, dz)
    instance.rotation.x = -Math.atan2(dy, Math.sqrt(dx * dx + dz * dz))



    const projectile = {
        itemId,
        body: instance,
        targetDirection: {x:dx, y:dy, z:dz},
        spd: 10,
        placeId: getCharState().currentPlace.placeId,
        stuck: false
    }

    let hasHit = false
    // only ever populated below - the environment raycast observer, kept
    // in scope up here so BOTH the player/enemy trigger branches AND the
    // raycast branch can clean each other up, whichever one fires first
    let envHitObserver = null

    const players = getPlayersOnScene()
    players.forEach(pl => {
        const enterAction = onIntersecEnterTrig(instance, pl.bodytarget, scene, () => {
            if(hasHit) return
            hasHit = true
            if(envHitObserver) scene.onBeforeRenderObservable.remove(envHitObserver)
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
                if(cbAfterHitAPlayer) cbAfterHitAPlayer()
            }, 100)

        })
    })

    // enemies - visual-only mirror of the player branch above (sticks the
    // sword into whatever it hit, same 100ms wind-down + stuck flag), not
    // a damage source on its own. Deals no damage here on purpose: callers
    // that need enemies to actually take damage from this projectile (see
    // astralrainSkill's spawnFallingSword in skillEffects.js) already run
    // their own separate, analytically-timed hit check instead of relying
    // on this trigger, and keep doing so unchanged - this only adds the
    // matching VISUAL. Shares the same `hasHit` guard as the player loop,
    // so whichever body (player or enemy) this sword reaches FIRST is the
    // one it visually sticks to, never both.
    const enemies = getEnemiesOnScene()
    enemies.forEach(enem => {
        if(!enem.body) return
        const enterAction = onIntersecEnterTrig(instance, enem.body, scene, () => {
            if(hasHit) return console.log("this projectile already hit something, ignoring enemy collision")
            hasHit = true
            if(envHitObserver) scene.onBeforeRenderObservable.remove(envHitObserver)
            getAllSounds().struckS?.play()
            let theProjectile = getProjectilesOnScene().find(proj => proj.itemId === projectile.itemId)
            theProjectile.spd = 2
            removeIntersecTrig(instance, enterAction)
            setTimeout(() => {
                theProjectile = getProjectilesOnScene().find(proj => proj.itemId === projectile.itemId)
                if(!theProjectile) return
                theProjectile.spd = 5
                theProjectile.stuck = true
                theProjectile.body.setParent(enem.body)
                if(willDisposeCountDown){
                    setTimeout(() => {
                        removeProjectile(theProjectile.itemId)

                    }, willDisposeCountDown)
                }
                if(cbAfterHitAnEnemy) cbAfterHitAnEnemy()
            }, 100)

        })
    })

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
    if(physicsEngine){
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