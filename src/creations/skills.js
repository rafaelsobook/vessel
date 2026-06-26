import { getPlayersOnScene, pushProjectile, removeProjectile } from "../sockets/worldsocket"
import { onIntersecEnterTrig, removeIntersecTrig } from "../components/actionManager.js"
import { MeshBuilder, Vector3 } from "@babylonjs/core"
import { getCharState } from "../charactersystem/characterstate"
import { randNum } from "../tools/random.js"
import { getProjectilesOnScene } from "../sockets/worldsocket.js"
import { createWeapon } from "../assetcreation/createweapon.js"
import { getAllSounds } from "../components/soundSystem.js"

export function spawnProjectile(spawnPos, targetDirection, glowingColor, scene, _weaponPartDetails = "default", cbAfterHit, willDisposeCountDown){
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
    const weaponsRoot = createWeapon(scene, "sword", {x:0, y:0, z:0}, instance,weaponPartDetails, glowingColor)
    weaponsRoot.addRotation(Math.PI,0,Math.random())
    weaponsRoot.scaling = new Vector3(0.1,0.1,0.1)
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
    const players = getPlayersOnScene()
    players.forEach(pl => {
        const enterAction = onIntersecEnterTrig(instance, pl.bodytarget, scene, () => {
            if(hasHit) return
            hasHit = true
            getAllSounds().struckS.play()
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
                if(cbAfterHit) cbAfterHit()
            }, 100)

        })
    })

    pushProjectile(projectile)
    return itemId
}