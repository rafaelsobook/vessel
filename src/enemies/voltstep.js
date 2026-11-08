import { Vector3 } from "@babylonjs/core"
import { getEnemiesOnScene, getIsSocketOn, getPlayersOnScene } from "../sockets/worldsocket.js"
import { getCharState } from "../charactersystem/characterstate.js"
import { emitEnemyTeleport } from "../sockets/emits.js"
import { SKILLS_BY_NAME, getSkillEffect } from "../staticRecources/skillsData.js"
import { hasDungeonLineOfSight } from "../tools/dungeonSight.js"
import { openworldGroundY } from "../tools/groundHeight.js"
import { OPENWORLD_PLACE_ID } from "../constants/constants.js"
import { getAllSounds, playSoundNear } from "../components/soundSystem.js"
import { strikeBolt, zapImpact, zapPalette } from "../effects/zap.js"

// AN ENEMY'S ESCAPE - a skill with an "escape" effect in its det.skills (the
// electric slime's Volt Step, skillsData.js's voltstepSkill). Not cast on the
// enemy skill timer like the rest (createEnemy.js leaves escapes out of that
// pick): hit while hurt, it may flee - gone in a crack of lightning, a bolt
// streaking to a spot well away from every player round it, no warning
// circle. From there its ranged lightning (rangeAttack.js) takes over - it
// only fires from out of melee reach.
//
// Who decides: whoever's hit it is (enemyIsHit - each client only for its own
// blows), so exactly one client picks the spot. tcp's "enemyWillTeleport"
// stamps it and relays "enemy-teleported" with the style, and every client
// moves it and plays the bolt (playEscape, from worldsocket.js).

// how far round it to count players to get away from
const THREAT_RADIUS = 25
// angles (radians) off straight-away tried in turn, until one is clear
const TRIES = [0, 0.5, -0.5, 1, -1, 1.5, -1.5, Math.PI]

// the escape skill this enemy has, if any
export function escapeSkillOf(enemy){
    for(const name of enemy?.det?.skills ?? []){
        const skill = SKILLS_BY_NAME[name]
        if(getSkillEffect(skill, "escape")) return skill
    }
    return null
}

/**
 * enemyIsHit, on every client: my own blow on `enemy` (hp left `hp` of `maxHp`)
 * - it might flee.
 */
export function maybeEscape(enemy, { playerId, hp, maxHp }){
    const charState = getCharState()
    if(!charState || playerId !== charState.owner) return
    if(!enemy?.body || enemy.body.isDisposed() || enemy.isDead || enemy._disabled || !(hp > 0)) return
    const skill = escapeSkillOf(enemy)
    const escape = getSkillEffect(skill, "escape")
    if(!escape) return
    if(performance.now() < (enemy._escapeReadyAt ?? 0)) return
    if(hp / maxHp > (escape.hpBelow ?? 1)) return
    if(Math.random() > (escape.chance ?? 1)) return

    const spot = escapeSpot(enemy, escape)
    if(!spot) return
    // its cooldown starts now here too - not only once the relay comes back
    enemy._escapeReadyAt = performance.now() + (skill.skillCoolDown ?? 8000)
    const from = enemy.body.position
    const data = {
        _id: enemy._id,
        currentPlaceId: enemy.det.currentPlaceId,
        x: spot.x,
        z: spot.z,
        style: skill.name,
        from: { x: from.x, y: from.y, z: from.z },
    }
    if(getIsSocketOn()) emitEnemyTeleport(enemy._id, spot, enemy.det.currentPlaceId, { style: skill.name, from: data.from })
    else playEscape(data)
}

// a spot well away from every player round it: straight away from them
// (their pull added up), or turned off that if a wall's in the way (dungeons)
// or it would land near someone else. null - nowhere to go.
function escapeSpot(enemy, escape){
    const from = enemy.body.position
    const placeId = enemy.det.currentPlaceId
    const players = getPlayersOnScene().filter(pl => pl.body && !pl.body.isDisposed() && flat(pl.body.position, from) < THREAT_RADIUS)
    let ax = 0
    let az = 0
    players.forEach(pl => {
        const dx = from.x - pl.body.position.x
        const dz = from.z - pl.body.position.z
        const d = Math.hypot(dx, dz) || 1
        ax += dx / d
        az += dz / d
    })
    const away = Math.hypot(ax, az) > 0.01 ? Math.atan2(az, ax) : Math.random() * Math.PI * 2
    const minDist = escape.minDist ?? 9
    const maxDist = escape.maxDist ?? 13
    for(const turn of TRIES){
        const angle = away + turn
        const reach = minDist + Math.random() * (maxDist - minDist)
        const spot = new Vector3(from.x + Math.cos(angle) * reach, from.y, from.z + Math.sin(angle) * reach)
        if(!hasDungeonLineOfSight(placeId, from, spot)) continue
        if(players.some(pl => flat(pl.body.position, spot) < minDist * 0.8)) continue
        return spot
    }
    return null
}

/**
 * Every client: `data` ({ _id, x, z, style, from }) - the enemy's gone from
 * `from` to (x, z) in a crack of lightning. Moves it too (worldsocket.js's
 * "enemy-teleported" does that itself for a plain teleport).
 */
export function playEscape(data){
    const enemy = getEnemiesOnScene().find(ene => ene._id === data._id)
    if(!enemy?.body || enemy.body.isDisposed()) return
    const skill = SKILLS_BY_NAME[data.style]
    const scene = enemy.body.getScene()
    const palette = zapPalette(skill?.color)
    const height = enemy.det.bodyHeight ?? 1
    const from = data.from ? new Vector3(data.from.x, data.from.y, data.from.z) : enemy.body.position.clone()

    enemy.body.position.x = data.x
    enemy.body.position.z = data.z
    if(enemy.det.currentPlaceId === OPENWORLD_PLACE_ID){
        enemy.body.position.y = openworldGroundY(data.x, data.z) + height / 2 + 0.05
    }
    enemy._escapeReadyAt = performance.now() + (skill?.skillCoolDown ?? 8000)
    const to = enemy.body.position.clone()

    // gone in a flash, a bolt across, a pop where it lands
    zapImpact(scene, from, palette, { big: true })
    strikeBolt(scene, from, to, palette, { width: 0.05 })
    zapImpact(scene, to, palette, { big: false })
    const sound = getAllSounds()?.[`${skill?.sound ?? "voltstep"}S`]
    playSoundNear(sound, from)
}

function flat(a, b){
    return Math.hypot(a.x - b.x, a.z - b.z)
}
