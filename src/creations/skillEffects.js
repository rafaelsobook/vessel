// Execution for player-cast offense skills (charState.skills, see
// skillsui.js) - singlecast plus the 10 elemental skills and multicast, all
// defined in skillsData.js. Mostly separate from creations/skills.js's
// spawnProjectile (that one throws a tiny sword-shaped weapon and sticks it
// to whoever it hits - a different, unfinished "throw weapon" mechanic,
// built for PvP-ish player-vs-player collision only) - astralrainSkill's
// falling swords are the one place this file reuses it directly, see
// triggerSwordRain/spawnFallingSword further down. creations/magiccircles.js
// (the circle VFX itself) is reused here as-is throughout.
//
// One generic engine drives every offense skill instead of one function per
// skill: castOffenseSkill (single circle -> single bolt, gated by
// castDuration) and castMulticast (N circles in sequence, see its own
// comment) both end at fireElementalProjectile, which reads the skill's own
// data (element/projectileStyle/explosionStyle/explosionColor) to decide
// what the bolt looks like and what it does on impact - see PROJECTILE_STYLES
// and EXPLOSION_STYLES below. Adding another skill is a skillsData.js entry,
// not a new function here - skill.swordRain (astralrainSkill) is the one
// exception, an opt-in branch inside fireElementalProjectile's hit handler
// (its marker doesn't deal damage/explode itself, see that section).
import { MeshBuilder, TransformNode, Vector3, Quaternion, StandardMaterial, Color3, Color4, Texture, FresnelParameters, NoiseProceduralTexture, ParticleSystem } from "@babylonjs/core"
import { createMagicCircle } from "./magiccircles.js"
import { createParticleSystem, createExplosionBurst, createImplosionBurst, createParticle, createBodyFireParticles } from "../tools/particlesystem.js"
import { createWeapon } from "../assetcreation/createweapon.js"
import { createProjectileModelInstance } from "../assetcreation/createProjectileModel.js"
import { spawnProjectile } from "./skills.js"
import { createGlowingMat, fresnelMat } from "../tools/materials.js"
import { addGlow } from "../tools/glow.js"
import { attachLightning } from "../effects/lightning.js"
import { createSimplex } from "../tools/noise.js"
import { displaceWithNoise } from "../assetcreation/createRock.js"
import { getEnemiesOnScene, getPlayersOnScene, getSocketContainers, pushProjectile, removeProjectile } from "../sockets/worldsocket.js"
import { onIntersecEnterTrig, removeIntersecTrig } from "../components/actionManager.js"
import { emitEnemyIsHit, emitEnemyBind, emitEnemyCurse, emitDied, emitRegisterPlayerAsEnemy } from "../sockets/emits.js"
import { getAdditionalsFromAbilities, getCharState, deductHp, updateHpMpSp_UI, updateMyDetailsOL, addTempBuff, removeTempBuff } from "../charactersystem/characterstate.js"
import { randNum, randBetween } from "../tools/random.js"
import { getAllSounds } from "../components/soundSystem.js"
import { getSceneDet } from "../main/main.js"
import { camShake } from "../tools/camera.js"
import { capsuleHeight } from "../charactersystem/createcharacter.js"
import { sampleTerrainSurfaceHeight } from 'infterrain'
import { OPENWORLD_PLACE_ID, OPENWORLD_TERRAIN_VERTS } from "../constants/constants.js"
import { SKILLS_BY_NAME } from "../staticRecources/skillsData.js"
import { giveSkill, upgradeOwnedSkill } from "../components/skillsui.js"
import { checkIfTokenSaved } from "../tools/tools.js"

// element -> magic circle texture (./images/circles/*.webp). A skill can
// override this directly via magicCircleImg (radiantjudgment uses "divine1"
// instead of the plain "apt_light" every other light skill gets) - this is
// only the fallback when it doesn't.
const ELEMENT_CIRCLES = {
    normal: "apt_water",
    fire: "apt_fire",
    water: "apt_water",
    earth: "apt_earth",
    light: "apt_light",
    dark: "apt_darkness",
    lightning: "apt_lightning",
}

// skill.name -> { skill, timeoutIds: [] } - one pending cast slot PER SKILL,
// not a single shared one. This used to be a single module-level variable,
// which was fine as long as only one skill could ever be mid-cast at a
// time - but multicastSkill's cascade (skillsui.js's slotbuttons click
// handler, skill.effects.effectType === "trigger") activates several other
// skills in the same synchronous tick now. With a single shared slot, each
// new cast's own cancelPendingCast() call at the top of castOffenseSkill/
// castMulticast was cancelling the PREVIOUS skill's still-charging cast
// instead of its own - only the last skill in the cascade ever actually
// fired, the rest were silently cancelled before their circle even finished
// blooming. Keying by skill.name lets N different skills stay pending
// concurrently, each only ever cancelled by its own activation/deactivation.
const pendingCasts = new Map()

export function getPendingCast(skillName){
    return pendingCasts.get(skillName) ?? null
}

export function cancelPendingCast(skillName){
    const pending = pendingCasts.get(skillName)
    if(!pending) return
    pending.timeoutIds.forEach(id => clearTimeout(id))
    pendingCasts.delete(skillName)
}

// how far in front of the hand the circle/projectile spawn - right at
// handPos put it inside the character's own body/arm
const CAST_SPAWN_OFFSET = 1
// small random spread around that point - ONLY applied when skill._castSpread
// is set (see skillsui.js's slotbuttons click handler), which only happens
// for skills activated AS PART OF multicastSkill's cascade - a normal solo
// press of any skill stays dead-centered in front of the hand like before.
// Neither "multicast" nor "burstshots" ever reach this function themselves
// (multicast fires no projectile of its own; burstshots' circles already
// scatter via their own separate computeMulticastCircleOrigin) - this only
// ever matters for the OTHER skills multicast triggers, which is exactly
// when several of them can otherwise land in the same instant and stack.
const CAST_SPAWN_JITTER = 0.35
const CIRCLE_SIZE_SCALE = 0.5

function computeCastOrigin(player, skill){
    // "in front of my right hand" - rHand's world position if the bone's
    // available, otherwise fall back to roughly chest-height in front of
    // the body so this doesn't just silently no-op for a character whose
    // rig didn't resolve an rHand bone (see createcharacter.js's warnings) -
    // then pushed further out along forward so it's clear of the body/arm
    const handPos = player.rHand
        ? player.rHand.getAbsolutePosition()
        : player.body.absolutePosition.add(new Vector3(0, 1, 0))
    const forward = Vector3.TransformNormal(new Vector3(0, 0, 1), player.body.getWorldMatrix()).normalize()
    const spawnPos = handPos.add(forward.scale(CAST_SPAWN_OFFSET))
    if(skill?._castSpread){
        spawnPos.addInPlace(new Vector3(
            randNum(-CAST_SPAWN_JITTER, CAST_SPAWN_JITTER),
            randNum(-CAST_SPAWN_JITTER, CAST_SPAWN_JITTER),
            randNum(-CAST_SPAWN_JITTER, CAST_SPAWN_JITTER),
        ))
    }
    return { spawnPos, forward }
}

// bound to any offense skill's activation (attackingSystem.js's
// activateSkill, default branch). mp was already charged in skillsui.js's
// click handler. The circle spawns right away as the "you're now casting"
// tell; the projectile itself still waits out the full castDuration (or
// never fires at all, if a future elemental skill combos out of the window -
// singlecast's own desc/data documents that window, this engine is generic
// to whichever skill is casting it).
export function castOffenseSkill(scene, player, skill, charState){
    cancelPendingCast(skill.name)
    if(!player?.body || !scene) return

    // captured now, not read again at fire time - skillsui.js sets this at
    // the moment mp got charged, based on wherever the mana slider was then;
    // defaults to full power for a skill with no mp demand at all (the
    // output slider concept doesn't apply to it). explosionScale is the
    // skill's OWN lvl-based power (see attackingSystem.js's upgradeSkill) -
    // independent axis from how much mana was committed.
    const powerScale = (skill._castPowerScale ?? 1) * (skill.explosionScale ?? 1)
    const { spawnPos, forward } = computeCastOrigin(player, skill)
    const circleImg = skill.magicCircleImg || ELEMENT_CIRCLES[skill.element] || ELEMENT_CIRCLES.normal

    // skill.groundTrap (disintegrationSkill) - this skill has no target to
    // aim at, so its OWN pre-cast circle lies flat on the ground where the
    // trap will actually deploy (facingDirection omitted - see
    // createMagicCircle's own comment) instead of standing upright in front
    // of the caster's hand like every other offense skill's does.
    // computeGroundTrapPos resolved once here so this circle and the trap
    // itself (spawnGroundTrap below) land on the exact same spot.
    const groundTrapPos = skill.groundTrap ? computeGroundTrapPos(charState, player, skill, forward) : null
    if(groundTrapPos){
        createMagicCircle(groundTrapPos, scene, circleImg, 0.8, skill.castDuration * 1000 + 800, null, groundTrapCircleScale(getGroundTrapRadius(skill)))
    } else {
        // circle stays up roughly through the cast window plus a beat after
        // the projectile launches, instead of despawning the instant it fires
        createMagicCircle(spawnPos, scene, circleImg, 0.8, skill.castDuration * 1000 + 800, forward, CIRCLE_SIZE_SCALE)
    }

    const timeoutId = setTimeout(() => {
        pendingCasts.delete(skill.name)
        // skill.groundSpikes (continentalrendSkill) - no projectile at all,
        // just a marching line of ground spikes straight out from the
        // caster - see triggerGroundSpikeLine's own header comment
        if(skill.groundSpikes){
            triggerGroundSpikeLine(scene, charState, skill, player, spawnPos, forward, powerScale)
        } else if(skill.groundTrap?.aoe){
            // skill.groundTrap.aoe (massivedisintegrationSkill) - the mass
            // version, see spawnMassGroundTrap's own header comment
            spawnMassGroundTrap(scene, charState, skill, groundTrapPos, powerScale)
        } else if(skill.groundTrap){
            // skill.groundTrap (disintegrationSkill) - also no projectile,
            // see spawnGroundTrap's own header comment
            spawnGroundTrap(scene, charState, skill, groundTrapPos, powerScale)
        } else {
            fireElementalProjectile(scene, charState, skill, spawnPos, forward, powerScale)
        }
    }, skill.castDuration * 1000)

    pendingCasts.set(skill.name, { skill, timeoutIds: [timeoutId] })
}

// multicast's circles don't all bloom from the same fixed spot in front of
// the right hand like every other offense skill's computeCastOrigin does -
// each one scatters to a random point around the caster's body (could be
// behind them, above their head, off to either side, near another circle or
// not) for a "circles orbiting the caster" barrage read. The bolt each one
// fires still travels along the player's actual facing direction though
// (not radially outward from wherever the circle happens to be) - only the
// circle's spawn point is randomized, not what direction/what it can hit,
// so this stays consistent with every other skill's straight-line
// forward-facing projectile/hit-detection.
function computeMulticastCircleOrigin(player){
    const bodyPos = player.body.absolutePosition
    const forward = Vector3.TransformNormal(new Vector3(0, 0, 1), player.body.getWorldMatrix()).normalize()

    const angle = randNum(0, Math.PI * 2)
    const radius = randNum(0.8, 1.6)
    const height = randNum(0.3, 2.3) // roughly knee-height up past the top of the head

    const spawnPos = bodyPos.add(new Vector3(Math.sin(angle) * radius, height, Math.cos(angle) * radius))
    return { spawnPos, forward }
}

// how staggered each circle's spawn is from cast start - independently
// randomized per circle (not chained one-after-another), so all of them
// spawn "together" in the sense that they're all triggered within this same
// short window, just not on the exact same frame. MULTICAST_MAX_STAGGER_MS
// is exported so skillsui.js's click handler can compute how long to wait
// before resetting skill.isActive back to false once a multicast is done
// (see that file's comment on why it does this itself instead of relying on
// this file to do it - the socket relay means whatever object reference
// runs through castMulticast/fireElementalProjectile here is a deserialized
// clone, not the persistent one sitting in charState.skills).
const MULTICAST_MIN_STAGGER_MS = 600
export const MULTICAST_MAX_STAGGER_MS = 1600

// multicast: lvl+1 circles, each spawning at its own random 10-100ms delay
// from the moment the skill activates (not one fully after another - every
// circle's spawn timer is scheduled independently up front, so they all
// bloom in a tight, staggered burst instead of a slow one-then-the-next
// sequence). Each circle still waits out its own skill.castDuration before
// firing its bolt, same as every other offense skill.
export function castMulticast(scene, player, skill, charState){
    cancelPendingCast(skill.name)
    if(!player?.body || !scene) return

    const powerScale = (skill._castPowerScale ?? 1) * (skill.explosionScale ?? 1)
    const circleCount = skill.lvl + 1
    const perCircleMs = skill.castDuration * 1000

    const timeoutIds = []
    pendingCasts.set(skill.name, { skill, timeoutIds })

    function spawnCircle(){
        if(!player?.body) return
        const { spawnPos, forward } = computeMulticastCircleOrigin(player)
        const circleImg = skill.magicCircleImg || ELEMENT_CIRCLES[skill.element] || ELEMENT_CIRCLES.normal
        createMagicCircle(spawnPos, scene, circleImg, 0.8, perCircleMs + 800, forward, CIRCLE_SIZE_SCALE)

        const fireId = setTimeout(() => {
            fireElementalProjectile(scene, charState, skill, spawnPos, forward, powerScale)
        }, perCircleMs)
        timeoutIds.push(fireId)
    }

    let maxStaggerMs = 0
    for(let i = 0; i < circleCount; i++){
        const staggerMs = randBetween(MULTICAST_MIN_STAGGER_MS, MULTICAST_MAX_STAGGER_MS)
        maxStaggerMs = Math.max(maxStaggerMs, staggerMs)
        const spawnId = setTimeout(spawnCircle, staggerMs)
        timeoutIds.push(spawnId)
    }

    // nothing left pending once the latest-spawned circle's own bolt has had
    // time to fire - not load-bearing for cancelPendingCast (all timeoutIds
    // are already scheduled above, clearTimeout on an already-fired one is a
    // harmless no-op), just keeps getPendingCast() accurate afterward
    const doneId = setTimeout(() => { pendingCasts.delete(skill.name) }, maxStaggerMs + perCircleMs + 50)
    timeoutIds.push(doneId)
}

// "below my feet" ground position for a self-cast skill - same ground-height
// resolution computeGroundTrapPos already uses (flat-ground fallback vs
// per-point terrain sampling for openworld's uneven ground), just centered
// exactly on the caster's own body with no forward offset at all (a buff
// has no direction to aim, unlike a ground trap which can be thrown some
// distance out via skill.groundTrap.distance)
function computeSelfCastGroundPos(charState, player){
    const isOpenworld = charState.currentPlace.placeId === OPENWORLD_PLACE_ID
    const x = player.body.position.x
    const z = player.body.position.z
    const y = isOpenworld
        ? sampleTerrainSurfaceHeight(x, z, OPENWORLD_TERRAIN_VERTS)
        : player.body.position.y - capsuleHeight / 2
    return new Vector3(x, y, z)
}

// bound to any buff skill's activation (attackingSystem.js's activateSkill,
// "buff" effectType branch) - mjolnirSkill and any future one. No target,
// no projectile: a magic circle blooms flat on the ground right under the
// caster's own feet (facingDirection omitted, same "lies flat facing the
// sky" reasoning disintegrationSkill's own trap circle uses - this is an
// on-yourself effect, not the usual upright in-front-of-hand circle every
// targeted offense skill shows), then once castDuration elapses,
// applyWeaponBuff below actually wreathes the weapon and grants the stat.
export function castBuffSkill(scene, player, skill, charState){
    cancelPendingCast(skill.name)
    if(!player?.body || !scene) return

    const powerScale = (skill._castPowerScale ?? 1) * (skill.explosionScale ?? 1)
    const groundPos = computeSelfCastGroundPos(charState, player)
    const circleImg = skill.magicCircleImg || ELEMENT_CIRCLES[skill.element] || ELEMENT_CIRCLES.normal
    createMagicCircle(groundPos, scene, circleImg, 0.8, skill.castDuration * 1000 + 800, null, CIRCLE_SIZE_SCALE)

    const timeoutId = setTimeout(() => {
        pendingCasts.delete(skill.name)
        applyWeaponBuff(scene, player, charState, skill, powerScale)
    }, skill.castDuration * 1000)

    pendingCasts.set(skill.name, { skill, timeoutIds: [timeoutId] })
}

// the actual "wreathe the weapon + grant the stat" - runs identically on
// every client watching the cast (same as every offense skill's own hit
// handler - this function, like fireElementalProjectile, is reached via the
// "skillactivated" relay on every connected client, caster included).
// charState here is the CASTER's info (a lightweight stand-in for anyone
// who isn't the real caster - see activateSkill's own comment), so the
// weapon lookup below (player.swordMeshes, keyed off the REAL rendered
// mesh, not charState) works the same regardless of who cast this, but the
// actual stat mutation is still gated to the real caster's own client -
// crediting every watching client with their OWN stat boost from someone
// else's cast would be the exact same "other players get exp too" bug
// class fireElementalProjectile's own isCaster comment describes, just for
// a buff instead of a hit.
function applyWeaponBuff(scene, player, charState, skill, powerScale){
    const buffDuration = skill.buff?.buffDuration ?? 15000

    // whichever weapon is actually visibly equipped right now -
    // swordMeshes holds every weapon this player has ever equipped
    // (createcharacter.js's createSword pushes, never removes), only one
    // shown at a time. showHideSword only toggles the CHILD meshes'
    // isVisible (see its own definition), not the parent sword entry's own
    // mesh, so the visible weapon has to be found by checking its children,
    // not sw.mesh.isVisible itself. Reading real rendered state instead of
    // charState.items also means this works identically for a remote
    // caster, whose charState here has no items list at all.
    const weaponEntry = player.swordMeshes?.find(sw => sw.mesh?.getChildMeshes().some(m => m.isVisible))
    // weaponGlow:false - the weapon keeps its own real material/texture,
    // just gets lightning arcs crackling around it (same reasoning
    // getIconMat's own comment gives for why true would flatten a mesh
    // that already has real art onto it). Purely visual, runs for every
    // watching client, no isCaster gate - everyone who saw the weapon light
    // up should see it stop too, not just the caster.
    const lightningFx = weaponEntry
        ? attachLightning(scene, weaponEntry.mesh, skill.explosionColor || "blue", false, { arcCount: 3, width: 0.022, updateInterval: 80 })
        : null
    setTimeout(() => {
        lightningFx?.dispose()
    }, buffDuration)

    if(charState.owner === getCharState()?.owner){
        // one buff slot per skill name - recasting before the previous one
        // expires refreshes the duration instead of stacking a second,
        // independent bonus (see addTempBuff's own comment)
        const buffId = `skillbuff_${skill.name}`
        addTempBuff({
            id: buffId,
            stat: skill.buff?.stat || "meeleeDmg",
            // scaled by powerScale (mana-output-slider * lvl-based
            // explosionScale) at the moment the buff actually lands, same
            // convention every offense skill's own totalDmg calc already
            // follows for plusDmg
            toAdd: Math.round((skill.buff?.toAdd || 0) * powerScale),
            percent: skill.buff?.percent || 0,
            expiresAt: Date.now() + buffDuration,
        })
        setTimeout(() => {
            removeTempBuff(buffId)
        }, buffDuration)
    }
}

// cached template mesh per shape, CLONED (not instanced) per cast - every
// shape below needs its OWN independent material every single time
// (skill.explosionColor varies per skill/per cast, and createGlowingMat/
// fresnelMat/attachLightning's own weaponGlow all assign a fresh material
// directly onto it), so a true InstancedMesh - which always mirrors its
// SOURCE mesh's own material, confirmed via @babylonjs/core/Meshes/
// instancedMesh.pure.js, same fact fireEnemySkillProjectile's own cached
// box already leans on - would silently break every one of them (a
// material "set" on an instance is a no-op). .clone() still skips
// MeshBuilder's own geometry/UV/normal build every single cast, which is
// the actual win here - the material was never the expensive part.
// Templates are built once (isVisible/isEnabled false, parked off-screen -
// same convention creations/skills.js's own "projectile" template and
// magiccircles.js's own circleTemplate already use) and kept forever - a
// small, fixed set (one per distinct shape/size used below), not a leak.
// scene-scoped like every other cache in this pass (see particlesystem.js's
// own getParticleTexture for the full "why" - main.js's changeScene() fully
// disposes and replaces the Scene object on every place change) - Mesh DOES
// have isDisposed() (unlike Texture), which already self-heals this on its
// own, but tracked explicitly anyway for the same uniform, obviously-correct
// pattern every cache in this pass now follows, rather than leaning on that
// as the only guard.
const shapeTemplateCache = new Map()
let shapeTemplateCacheScene = null
function getShapeClone(scene, key, build){
    if(shapeTemplateCacheScene !== scene){
        shapeTemplateCache.clear()
        shapeTemplateCacheScene = scene
    }
    let template = shapeTemplateCache.get(key)
    if(!template || template.isDisposed()){
        template = build()
        template.isVisible = false
        template.isPickable = false
        template.setEnabled(false)
        template.position.y = -1000
        shapeTemplateCache.set(key, template)
    }
    const clone = template.clone(`${key}_${Date.now()}`)
    clone.isVisible = true
    clone.setEnabled(true)
    // .clone() copies the template's own transform too, including the
    // position.y = -1000 it's deliberately parked at above (so it never
    // flashes visible before the first clone) - every caller then parents
    // this clone under its own projectile box via a plain `.parent = box`
    // assignment (not .setParent(), which would recompute local position
    // to compensate), so that -1000 was carrying straight through as a
    // LOCAL offset relative to the new parent instead of resetting to
    // local origin the way a fresh MeshBuilder.CreateXXX() call always
    // starts. Real, visible bug: every style below that doesn't ALSO
    // explicitly zero its own position after parenting (crystalshard,
    // twinhalo's rings, boxcross's bars, lightorb's sphere, darkorb's orb)
    // was rendering 1000 units below the actual projectile - effectively
    // invisible. Only "halo" survived, purely because it already reset
    // its own position for an unrelated reason.
    clone.position.set(0, 0, 0)
    return clone
}

// beam onHitVisual's own impact splash (tidalspikeSkill) - a burst of
// particles (not a single mesh - see spawnSplashBurst's own header comment
// for why) at the enemy's own hit position, using splash.webp as every
// particle's own sprite. Cached persistently, same reasoning every other
// texture cache in this file already uses - a small, fixed asset, no
// reason to decode it fresh every single cast.
let splashParticleTex = null
let splashParticleTexScene = null
function getSplashParticleTex(scene){
    if(!splashParticleTex || splashParticleTexScene !== scene){
        splashParticleTex = new Texture("./images/projectiles/splash.webp", scene)
        splashParticleTexScene = scene
    }
    return splashParticleTex
}

// two earlier versions of this used a single mesh (a billboarded plane,
// then a vertex-displaced "wiggling" plane) - a real burst of many small
// particles flying outward reads as an actual water splash far more
// directly than trying to fake it on one flat surface. BLENDMODE_ADD
// (same as every other particle effect in this file, e.g.
// createBodyFireParticles) is what makes splash.png's own black background
// disappear for free - additive blending adds black to the scene behind it
// unchanged, no real alpha channel needed the way a StandardMaterial's
// opacityTexture would.
//
// "just scaling" per its own request - size is the ONLY thing animated
// over each particle's own lifetime (addSizeGradient: starts tiny, grows
// as it flies outward) - no color gradient dance, no rotation, nothing else.
// scale (default 1) - skill.projectileScale, same generic per-level growth
// every other projectile style already reads (attackingSystem.js's
// upgradeSkill) - grows both the particle sizes AND how far the burst
// actually spreads (the sphere emitter's own radius), so a higher-level
// cast visibly makes a bigger splash, not just more damage.
function spawnSplashBurst(scene, position, scale = 1){
    const SPLASH_PARTICLE_COUNT = 40
    const particles = new ParticleSystem(`tidalspike_splash_${Date.now()}`, SPLASH_PARTICLE_COUNT, scene)
    particles.particleTexture = getSplashParticleTex(scene)
    particles.blendMode = ParticleSystem.BLENDMODE_ADD

    particles.emitter = position.clone()
    particles.minEmitBox = Vector3.Zero()
    particles.maxEmitBox = Vector3.Zero()
    particles.createSphereEmitter(0.4 * scale, 0.7 * scale)

    particles.color1 = new Color4(1, 1, 1, 1)
    particles.color2 = new Color4(1, 1, 1, 1)
    particles.colorDead = new Color4(0, 0, 1, 0.2)

    particles.addSizeGradient(0.05, 0.1 * scale)
    particles.addSizeGradient(1.1, 1.9 * scale)

    particles.minLifeTime = 0.55
    particles.maxLifeTime = 0.9
    particles.minEmitPower = 1
    particles.maxEmitPower = 2.2
    particles.gravity = new Vector3(0, -3, 0)

    particles.emitRate = 100
    particles.targetStopDuration = 0.52 // a quick burst, not a continuous spray
    particles.disposeOnStop = false // the caller (beam style's onHit) owns disposal on its own timer, not the particle system itself

    particles.start()
    return particles
}

// tidalspikeSkill's beam origin (startPos, where beamMesh actually starts) -
// a plain rotating spin/impact burst was wrong here, same as it was wrong
// for the impact end earlier - this isn't a splash landing, it's water
// welling up at the source. Particles stay put (zero emit box, zero emit
// power, no gravity) instead of flying outward like spawnSplashBurst's own
// impact version does, and emit sparsely (emitRate: 5, not a burst) for as
// long as the caller keeps this system alive.
// scale (default 1) - same skill.projectileScale generic per-level growth
// spawnSplashBurst reads - this one has no spread to widen (it deliberately
// stays in one spot), so only the particle size itself grows with level.
function spawnSplashHover(scene, position, scale = 1){
    const particles = new ParticleSystem(`tidalspike_splash_origin_${Date.now()}`, 30, scene)
    particles.particleTexture = getSplashParticleTex(scene)
    particles.blendMode = ParticleSystem.BLENDMODE_ADD

    particles.emitter = position.clone()
    // zero emit box AND zero emit power/direction - every particle spawns
    // and stays at this exact single spot for its own lifetime instead of
    // drifting or flying outward
    particles.minEmitBox = Vector3.Zero()
    particles.maxEmitBox = Vector3.Zero()
    particles.direction1 = Vector3.Zero()
    particles.direction2 = Vector3.Zero()
    particles.minEmitPower = 0
    particles.maxEmitPower = 0
    particles.gravity = Vector3.Zero()

    particles.color1 = new Color4(1, 1, 1, 1)
    particles.color2 = new Color4(1, 1, 1, 1)
    particles.colorDead = new Color4(1, 1, 1, 0)

    particles.addSizeGradient(0, 0.05 * scale)
    particles.addSizeGradient(1, 1.0 * scale)

    particles.minLifeTime = 0.5
    particles.maxLifeTime = 0.9
    particles.emitRate = 5
    particles.disposeOnStop = false // the caller owns disposal on its own timer, not the particle system itself

    particles.start()
    return particles
}
// --- projectile/on-hit visuals - GENERIC, data-driven engine ---
// Replaces the old per-style hand-written functions entirely. What a skill's
// projectile looks like (shape/material/color/animation/arcs) and what
// happens when it lands (burst/implode/stick-and-grow/beam) is read straight
// off skill.projectileVisual/skill.onHitVisual (skillsData.js) - adding or
// re-skinning a skill is a data edit here, never a new function. The
// underlying mesh/material/particle helpers (createWeapon, createGlowingMat,
// fresnelMat, attachLightning, createExplosionBurst, createImplosionBurst,
// createParticle(System), displaceWithNoise) are unchanged - this only
// replaces the hardcoded per-skill wiring that used to call them.
//
// Hard rule carried over from the old code (see fireEnemySkillProjectile's
// own InstancedMesh comment): material NEVER gets assigned to the shared
// `box` itself - always to a spawned child mesh. InstancedMesh.material is a
// silent no-op, so this is what keeps every shape safe to hand to an enemy,
// not just the ones that happened to already route through a child mesh.

function buildProjectileShapeMesh(scene, shape, shapeParams = {}){
    switch(shape){
        case "sphere":
            return getShapeClone(scene, `gen_sphere_${shapeParams.diameter}_${shapeParams.segments}`, () =>
                MeshBuilder.CreateSphere("gen_sphere_template", { diameter: shapeParams.diameter ?? 0.4, segments: shapeParams.segments ?? 16 }, scene))
        case "box":
            return getShapeClone(scene, `gen_box_${shapeParams.width}_${shapeParams.height}_${shapeParams.depth}`, () =>
                MeshBuilder.CreateBox("gen_box_template", { width: shapeParams.width ?? 0.5, height: shapeParams.height ?? shapeParams.width ?? 0.5, depth: shapeParams.depth ?? shapeParams.width ?? 0.5 }, scene))
        case "cone":
            return getShapeClone(scene, `gen_cone_${shapeParams.diameterBottom}_${shapeParams.height}`, () =>
                MeshBuilder.CreateCylinder("gen_cone_template", { diameterTop: 0, diameterBottom: shapeParams.diameterBottom ?? 0.15, height: shapeParams.height ?? 0.9, tessellation: shapeParams.tessellation ?? 10 }, scene))
        case "icosahedron":
            return getShapeClone(scene, `gen_poly_${shapeParams.size}`, () =>
                MeshBuilder.CreatePolyhedron("gen_poly_template", { type: 3, size: shapeParams.size ?? 0.22 }, scene))
        case "torus":
            return getShapeClone(scene, `gen_torus_${shapeParams.diameter}_${shapeParams.thickness}`, () =>
                MeshBuilder.CreateTorus("gen_torus_template", { diameter: shapeParams.diameter ?? 0.5, thickness: shapeParams.thickness ?? 0.08, tessellation: shapeParams.tessellation ?? 24 }, scene))
        default:
            return null
    }
}

// material.kind: "glow"/"fresnel" applied directly to a plain-shape mesh.
// "texture" is only meaningful for shape:"plane" (icon-style) and "weapon"
// material handling lives in buildWeaponCopies below (createWeapon's own
// glowingColor path vs a uniform fresnelMat override) - not handled here.
function applyPlainMaterial(scene, mesh, materialKind, color, texturePath){
    if(materialKind === "glow"){
        mesh.material = createGlowingMat(scene, color)
        addGlow(scene, mesh, 0.5)
    } else if(materialKind === "fresnel"){
        mesh.material = fresnelMat(scene, color)
        addGlow(scene, mesh, 0.6)
    } else if(materialKind === "texture" && texturePath){
        mesh.material = getGenericFlatTextureMat(scene, texturePath)
    }
}

// Material (unlike Mesh/AbstractMesh) has no isDisposed() at all - confirmed
// against @babylonjs/core's own material.pure.d.ts, not just assumed. What
// it DOES have is onDisposeObservable, which is the actually-correct tool
// here anyway: rather than polling a flag, this makes the CACHE react the
// instant a disposal genuinely happens, from whichever code path triggers
// it (this file's own disposables array, OR worldsocket.js's removeProjectile,
// which disposes shape:"box" skills' shared box through a call this file
// doesn't control at all) - evict the entry so the next getXMat() call for
// that same key naturally falls into its own existing "not cached yet"
// branch and rebuilds, instead of ever handing out a dead material.
function evictCacheOnDispose(cache, key, mat){
    mat.onDisposeObservable.addOnce(() => {
        if(cache.get(key) === mat) cache.delete(key)
    })
}

// a plain image texture with no glow/fresnel treatment, for any shape that
// wants a real photographed/painted surface instead of a flat glow color -
// stoneshardSkill's own modeled shard (shape:"glbModel") is the first user,
// pointed at a rock texture instead of a glow tint. Cached per path, same
// "one shared material per distinct asset, never rebuilt per cast" reasoning
// every other texture cache in this file already follows.
const genFlatTexMatCache = new Map()
let genFlatTexMatCacheScene = null
function getGenericFlatTextureMat(scene, texturePath){
    if(genFlatTexMatCacheScene !== scene){ genFlatTexMatCache.clear(); genFlatTexMatCacheScene = scene }
    let mat = genFlatTexMatCache.get(texturePath)
    if(!mat){
        mat = new StandardMaterial(`flat_tex_mat_${texturePath}`, scene)
        mat.diffuseTexture = new Texture(texturePath, scene)
        genFlatTexMatCache.set(texturePath, mat)
        evictCacheOnDispose(genFlatTexMatCache, texturePath, mat)
    }
    return mat
}

// skill.name-derived texture, same convention getIconMat used to hardcode -
// still one shared cache per skill name, just living here now
const genIconMatCache = new Map()
let genIconMatCacheScene = null
function getGenericIconMat(scene, skill){
    if(genIconMatCacheScene !== scene){ genIconMatCache.clear(); genIconMatCacheScene = scene }
    let mat = genIconMatCache.get(skill.name)
    if(!mat){
        mat = new StandardMaterial(`icon_mat_${skill.name}`, scene)
        const tex = new Texture(`./images/projectiles/${skill.name}projectile.webp`, scene)
        tex.getAlphaFromRGB = true
        mat.diffuseTexture = tex
        mat.emissiveTexture = tex
        mat.opacityTexture = tex
        mat.emissiveColor = new Color3(1, 1, 1)
        mat.backFaceCulling = false
        mat.specularColor = new Color3(0, 0, 0)
        genIconMatCache.set(skill.name, mat)
        evictCacheOnDispose(genIconMatCache, skill.name, mat)
    }
    return mat
}

// beam material - keyed by texturePath (skill.onHitVisual.beam.texturePath)
// so a future beam-type skill can use its own scrolling texture instead of
// tidalspikeSkill's watercurrent.webp; each distinct path gets one shared,
// persistent instance (texture/scroll-speed never vary per cast of the same
// skill, only the plane mesh's own stretched width does)
const genBeamMatCache = new Map()
let genBeamMatCacheScene = null
function getGenericBeamMat(scene, texturePath, scrollSpeed, uScale){
    if(genBeamMatCacheScene !== scene){ genBeamMatCache.clear(); genBeamMatCacheScene = scene }
    let mat = genBeamMatCache.get(texturePath)
    if(!mat){
        mat = new StandardMaterial(`beam_mat_${texturePath}`, scene)
        const tex = new Texture(texturePath, scene)
        tex.getAlphaFromRGB = true
        tex.wrapU = Texture.WRAP_ADDRESSMODE
        tex.uScale = uScale
        mat.diffuseTexture = tex
        mat.emissiveTexture = tex
        mat.opacityTexture = tex
        mat.emissiveColor = new Color3(1, 1, 1)
        mat.backFaceCulling = false
        mat.specularColor = new Color3(0, 0, 0)

        // continuously scrolls the pattern toward the target - registered
        // once here (shared material/texture), same as the original
        // getBeamMat's own scroll observer
        scene.onBeforeRenderObservable.add(() => {
            tex.uOffset -= (scene.getEngine().getDeltaTime() / 1000) * scrollSpeed
        })
        genBeamMatCache.set(texturePath, mat)
        evictCacheOnDispose(genBeamMatCache, texturePath, mat)
    }
    return mat
}

// weapon copies (blade/shadowblade/spearlance/bladecross/bladecross's 2nd
// blade) - createWeapon (assetcreation/createweapon.js) is reused verbatim.
// "glow" material: createWeapon's own glowingColor arg gives each part its
// own createGlowingMat instance, same as the old per-style code. "fresnel":
// no glowingColor passed (parts default to createMetalMat), then every part
// across every copy gets ONE shared fresnelMat instance overlaid uniformly -
// same "shadowblade" approach the old code used for its single copy,
// extended to however many copies a skill's data asks for.
function buildWeaponCopies(scene, box, weapon, copies, materialKind, color){
    const roots = []
    const glowingColor = materialKind === "glow" ? color : undefined
    copies.forEach(copy => {
        const root = createWeapon(scene, weapon.type, { x: 0, y: 0, z: 0 }, box, null, weapon.rarities, glowingColor)
        root.scaling = new Vector3(weapon.scale ?? 0.16, weapon.scale ?? 0.16, weapon.scale ?? 0.16)
        const rot = copy.rotation || { x: 0, y: 0, z: 0 }
        root.addRotation(rot.x, rot.y, rot.z)
        roots.push(root)
    })
    if(materialKind === "fresnel"){
        const sharedMat = fresnelMat(scene, color)
        roots.forEach(root => root.getChildMeshes().forEach(part => {
            part.material = sharedMat
            addGlow(scene, part, 0.6)
        }))
    }
    return roots
}

// darkorbSkill's own build - the one shape genuinely too bespoke for the
// generic shape/copies model above (a displaced-noise inner mesh, a hand-
// wired StandardMaterial+NoiseProceduralTexture+FresnelParameters shell, two
// particle layers). Still fully driven by skill.projectileVisual.customMesh -
// every number that used to be hardcoded here now comes from data; this
// function itself stays generic (shape:"custom" is the only thing that
// routes here, nothing here reads skill.name).
function buildCustomMesh(scene, box, customMesh, color){
    const shell = customMesh.shell || {}
    const core = customMesh.core || {}
    const mat = customMesh.shellMaterial || {}

    const orb = getShapeClone(scene, `gen_custom_shell_${shell.diameter}_${shell.segments}`, () =>
        MeshBuilder.CreateSphere("gen_custom_shell_template", { diameter: shell.diameter ?? 0.5, segments: shell.segments ?? 20 }, scene))
    orb.parent = box
    orb.isPickable = false

    const orbMat = new StandardMaterial(`custom_shell_mat_${Date.now()}`, scene)
    orbMat.diffuseColor = new Color3(mat.diffuse?.r ?? 0.05, mat.diffuse?.g ?? 0, mat.diffuse?.b ?? 0.08)
    orbMat.specularColor = new Color3(mat.specular?.r ?? 0.05, mat.specular?.g ?? 0, mat.specular?.b ?? 0.08)
    orbMat.emissiveColor = new Color3(mat.emissive?.r ?? 0.3, mat.emissive?.g ?? 0.05, mat.emissive?.b ?? 0.45)
    orbMat.alpha = mat.alpha ?? 0.9

    const veinNoise = new NoiseProceduralTexture(`custom_shell_veins_${Date.now()}`, 256, scene)
    veinNoise.octaves = mat.bumpOctaves ?? 4
    veinNoise.persistence = mat.bumpPersistence ?? 0.65
    veinNoise.animationSpeedFactor = mat.bumpAnimSpeed ?? 3
    orbMat.bumpTexture = veinNoise

    orbMat.emissiveFresnelParameters = new FresnelParameters()
    orbMat.emissiveFresnelParameters.bias = mat.fresnelBias ?? 0.3
    orbMat.emissiveFresnelParameters.power = mat.fresnelPower ?? 2
    orbMat.emissiveFresnelParameters.leftColor = new Color3(mat.fresnelLeft?.r ?? 0.8, mat.fresnelLeft?.g ?? 0.4, mat.fresnelLeft?.b ?? 1.0)
    orbMat.emissiveFresnelParameters.rightColor = new Color3(mat.fresnelRight?.r ?? 0.2, mat.fresnelRight?.g ?? 0, mat.fresnelRight?.b ?? 0.3)

    orb.material = orbMat
    addGlow(scene, orb, 0.6)

    const coreRadius = core.radius ?? 0.14
    const coreNoise = createSimplex(randBetween(1, 9999))
    const coreMesh = MeshBuilder.CreateIcoSphere(`custom_core_${Date.now()}`, {
        radius: coreRadius, subdivisions: core.subdivisions ?? 3, updatable: true, flat: false,
    }, scene)
    coreMesh.parent = box
    coreMesh.isPickable = false
    displaceWithNoise(coreMesh, coreNoise, 0, coreRadius)
    coreMesh.convertToFlatShadedMesh()
    coreMesh.material = createGlowingMat(scene, core.color || "white")
    addGlow(scene, coreMesh, 1)

    const particles = (customMesh.particleLayers || []).map(layer => {
        const ps = createParticle(scene, layer.texture, layer.capacity ?? 30, null, layer.spd ?? 0.02,
            { min: layer.lifetimeMin ?? 0.2, max: layer.lifetimeMax ?? 0.5 }, layer.minSize ?? 0.05, layer.maxSize ?? 0.2,
            0, layer.particleType || "sphere", true, orb, layer.color || { r: 1, g: 1, b: 1 }, false)
        ps.createSphereEmitter(layer.emitterRadius ?? 0.3, layer.emitterRadiusRange ?? 0.5)
        ps.minEmitPower = layer.minEmitPower ?? 0.1
        ps.maxEmitPower = layer.maxEmitPower ?? 0.3
        ps.emitRate = layer.emitRate ?? 30
        ps.blendMode = layer.blendMode === "additive" ? ParticleSystem.BLENDMODE_ADD : ParticleSystem.BLENDMODE_STANDARD
        return ps
    })

    return { orb, orbMat, veinNoise, core: coreMesh, particles }
}

// the single entry point every projectile now goes through - reads
// skill.projectileVisual, builds whatever it describes, returns
// {cleanup, onHit}. onHit is ALWAYS present now (the old code sometimes
// returned a plain function, sometimes {cleanup, onHit} depending on style -
// collapsed into one consistent shape here, with onHit itself internally
// dispatching skill.onHitVisual.type instead of the caller having to branch).
function renderGenericProjectile(scene, box, skill){
    const pv = skill.projectileVisual || {}
    const color = skill.explosionColor || "white"
    const scale = skill.projectileScale ?? 1
    const copies = pv.copies && pv.copies.length ? pv.copies : [{ rotation: { x: 0, y: 0, z: 0 } }]
    const materialKind = pv.material?.kind || "none"
    // captured NOW, before this projectile ever starts flying (box.position
    // still equals spawnPos - the caster's own hand position at cast time) -
    // onHitVisual's "beam" type needs this exact launch point later, at hit
    // time, to draw a plane spanning caster->target. Reading box.position
    // again AT HIT TIME instead (the bug this fixed) gives the wrong answer:
    // by the moment onHit fires, box.position IS essentially the enemy's own
    // position (that's what "hit" means), so start and end would be almost
    // the same point - dist collapses to ~0 and the beam never even builds
    // (see the dist < 0.001 guard below).
    const launchPosition = box.position.clone()

    // box itself stays invisible by default - every shape below (plane,
    // sphere, weapon, custom, etc.) builds its OWN visible child mesh and
    // parents it to this invisible box, same as the old code always did.
    // Only the shape:"box" branch further down flips this back to true (it
    // reuses the shared box directly, with no child mesh at all) - doing it
    // here unconditionally off pv.visible was the actual bug behind "why
    // does my plane/sphere-shaped skill show as a plain box": ANY visible:
    // true skill got the raw shared box turned on too, floating right on
    // top of (or instead of) whatever shape it actually built.
    box.isVisible = false

    let animatables = [] // {node, axes} - driven every frame by the shared spin observer below
    let disposables = [] // anything with its own .dispose() not already covered by root/box disposal
    let root = null // set for shapes needing an intermediate TransformNode (multi-copy, or explicit root request)
    let customBuild = null

    if(pv.shape === "particle"){
        const styles = skill.particleStyles ?? [{ name: "oneline", color }]
        const systems = createParticleSystem(scene, box, styles)
        disposables.push(() => systems.forEach(ps => { ps.stop(); ps.dispose(false) }))
    } else if(pv.shape === "plane"){
        const plane = getShapeClone(scene, "gen_icon_plane", () => MeshBuilder.CreatePlane("gen_icon_plane_template", { width: 1, height: 1254 / 705 }, scene))
        plane.parent = box
        plane.isPickable = false
        plane.rotation.x = Math.PI / 2
        plane.material = materialKind === "texture" ? getGenericIconMat(scene, skill) : (materialKind === "fresnel" ? fresnelMat(scene, color) : createGlowingMat(scene, color))
        plane.scaling = new Vector3(1, 1, 1).scale(scale)
        addGlow(scene, plane, 0.6)
        animatables.push({ node: plane, axes: pv.animation })
        disposables.push(() => plane.dispose(false, materialKind !== "texture"))
        root = plane
    } else if(pv.shape === "glbModel" && pv.model){
        // a real modeled GLB projectile (models/projectiles/*.glb, see
        // assetcreation/createProjectileModel.js) instead of a primitive
        // MeshBuilder shape or a weapon-part assembly - material.kind:"none"
        // (the default) leaves the model's own baked-in material untouched;
        // "glow"/"fresnel" override it the same way every other shape can,
        // for a skill that wants its modeled projectile tinted/glowing too
        const useRoot = copies.length > 1
        if(useRoot){ root = new TransformNode(`gen_glbmodel_root_${skill.name}_${Date.now()}`, scene); root.parent = box }
        const instances = copies.map(copy => {
            const inst = createProjectileModelInstance(scene, pv.model.name, useRoot ? root : box)
            if(!inst) return null
            inst.isPickable = false
            inst.scaling = new Vector3(1, 1, 1).scale(scale * (pv.model.scale ?? 1))
            // GLB-imported meshes come with rotationQuaternion already set
            // (glTF stores rotation as quaternions) - Babylon computes the
            // world transform from THAT when it's non-null and silently
            // ignores a plain .rotation assignment entirely. Null it out
            // first so the Euler rotation below actually takes effect -
            // same trap createweapon.js's own createPartsWeapon avoids by
            // using .addRotation() instead of a raw assignment.
            inst.rotationQuaternion = null
            const rot = copy.rotation || { x: 0, y: 0, z: 0 }
            inst.rotation = new Vector3(rot.x, rot.y, rot.z)
            if(materialKind !== "none") applyPlainMaterial(scene, inst, materialKind, color, pv.material?.texturePath)
            return inst
        }).filter(Boolean)
        if(instances.length){
            if(!useRoot){ root = instances[0] }
            instances.forEach((inst, i) => { if(copies[i]?.animation) animatables.push({ node: inst, axes: copies[i].animation }) })
            if(!copies.some(c => c.animation)) animatables.push({ node: root, axes: pv.animation })
            // dispose the MATERIAL too only for "glow"/"fresnel" - those are
            // a fresh instance created per cast (createGlowingMat/fresnelMat),
            // safe/correct to free right along with the mesh. "texture" is
            // the OPPOSITE: getGenericFlatTextureMat hands back one SHARED,
            // cached-by-path instance reused across every cast - disposing
            // it here would destroy it the moment the very first stoneshard
            // cast finishes, leaving every cast after that pointing at an
            // already-disposed material (renders as nothing - exactly the
            // "only see it once" bug this fixes). Same reasoning the "plane"
            // branch's own disposal already correctly follows above.
            const disposeMat = materialKind === "glow" || materialKind === "fresnel"
            disposables.push(() => (useRoot ? root : instances[0]).dispose(false, disposeMat))
            if(pv.arcs?.enabled){
                attachLightning(scene, root, color, !!pv.arcs.weaponGlow, { arcCount: skill.arcCount ?? 2, width: pv.arcs.width ?? 0.015, updateInterval: pv.arcs.updateInterval ?? 90, withLight: false })
            }
        }
        // instances.length === 0 (model failed/never loaded, already warned
        // by createProjectileModelInstance) - box stays invisible, same
        // silent-degrade behavior every other optional asset in this game falls back to
    } else if(pv.shape === "weapon" && pv.weapon){
        const useRoot = copies.length > 1
        if(useRoot){ root = new TransformNode(`gen_weapon_root_${skill.name}_${Date.now()}`, scene); root.parent = box }
        const weaponRoots = buildWeaponCopies(scene, useRoot ? root : box, pv.weapon, copies, materialKind, color)
        weaponRoots.forEach((wroot, i) => { if(copies[i]?.animation) animatables.push({ node: wroot, axes: copies[i].animation }) })
        if(!useRoot) root = weaponRoots[0]
        else animatables.push({ node: root, axes: pv.animation })
        disposables.push(() => (useRoot ? root : weaponRoots[0]).dispose(false, true))
        if(pv.arcs?.enabled && (skill.arcCount ?? 0) > 0){
            attachLightning(scene, useRoot ? root : weaponRoots[0], color, false, { arcCount: skill.arcCount, width: pv.arcs.width ?? 0.015, updateInterval: pv.arcs.updateInterval ?? 90, withLight: false })
        }
    } else if(pv.shape === "custom"){
        customBuild = buildCustomMesh(scene, box, pv.customMesh || {}, color)
        box.scaling = new Vector3(1, 1, 1).scale(scale)
        animatables.push({ node: customBuild.orb, axes: pv.animation || { x: 0.008, y: 0.02, z: 0 } })
        if(pv.customMesh?.coreAnimation) animatables.push({ node: customBuild.core, axes: pv.customMesh.coreAnimation })
        disposables.push(() => {
            customBuild.particles.forEach(ps => { ps.stop(); ps.dispose(false) })
            customBuild.veinNoise.dispose()
            customBuild.orbMat.dispose()
            customBuild.orb.dispose()
            customBuild.core.dispose(false, true)
        })
        root = box // "custom" grows box.scaling itself in the onHit stickAndGrow path, matching darkorb's original behavior
    } else if(pv.shape === "box" && copies.length === 1){
        // reuses the shared projectile box ITSELF (already sized 0.7, no
        // child mesh) - matching the old "lightning" style exactly, which
        // flipped box.isVisible back on and materialed box directly rather
        // than spawning a same-sized-or-different child. Only takes this
        // fast path for a single copy - a "box" skill wanting multiple
        // crossed boxes would fall through to the generic multi-copy branch
        // below instead, same as any other primitive shape.
        box.isVisible = true
        // shapeParams.boxScale - the old "lightning" style always scaled the
        // shared 0.7-sized box DOWN to 0.4x rather than showing it at full
        // size - only meaningful here, every other shape builds its own
        // appropriately-sized child mesh instead
        box.scaling = new Vector3(1, 1, 1).scale(scale * (pv.shapeParams?.boxScale ?? 1))
        applyPlainMaterial(scene, box, materialKind, color)
        root = box
        animatables.push({ node: box, axes: pv.animation })
        if(pv.arcs?.enabled){
            attachLightning(scene, box, color, !!pv.arcs.weaponGlow, { arcCount: skill.arcCount ?? 3, width: pv.arcs.width ?? 0.025, updateInterval: pv.arcs.updateInterval ?? 60, withLight: false })
        }
        // no manual dispose pushed here - attachLightning already wires its
        // own arc/material teardown to box.onDisposeObservable, same as the
        // original "lightning" style's own comment on this exact point
    } else if(pv.shape){
        // every other plain primitive shape (sphere/cone/icosahedron/torus,
        // or "box" with more than one copy)
        const useRoot = copies.length > 1
        if(useRoot){ root = new TransformNode(`gen_shape_root_${skill.name}_${Date.now()}`, scene); root.parent = box }
        const meshes = copies.map(copy => {
            const mesh = buildProjectileShapeMesh(scene, pv.shape, pv.shapeParams)
            mesh.parent = useRoot ? root : box
            mesh.isPickable = false
            applyPlainMaterial(scene, mesh, materialKind, color, pv.material?.texturePath)
            const rot = copy.rotation || { x: 0, y: 0, z: 0 }
            mesh.rotation = new Vector3(rot.x, rot.y, rot.z)
            return mesh
        })
        if(!useRoot){ root = meshes[0]; root.scaling = new Vector3(1, 1, 1).scale(scale) }
        else root.scaling = new Vector3(1, 1, 1).scale(scale)
        meshes.forEach((mesh, i) => { if(copies[i]?.animation) animatables.push({ node: mesh, axes: copies[i].animation }) })
        if(!copies.some(c => c.animation)) animatables.push({ node: root, axes: pv.animation })
        // same "texture" is a SHARED cache, never dispose it per-cast
        // reasoning the glbModel branch's own comment covers in full
        const disposeMat = materialKind === "glow" || materialKind === "fresnel"
        disposables.push(() => (useRoot ? root : meshes[0]).dispose(false, disposeMat))
        if(pv.arcs?.enabled){
            attachLightning(scene, root, color, !!pv.arcs.weaponGlow, { arcCount: skill.arcCount ?? 2, width: pv.arcs.width ?? 0.015, updateInterval: pv.arcs.updateInterval ?? 90, withLight: false })
        }
    }
    // no shape at all ("none"/marker/beam-in-flight) - box just stays
    // invisible, nothing built, nothing to dispose beyond the caller's own
    // box.dispose() later

    const spinObserver = animatables.length
        ? scene.onBeforeRenderObservable.add(() => {
            animatables.forEach(({ node, axes }) => {
                if(!axes || node.isDisposed?.()) return
                if(axes.x) node.rotation.x += axes.x
                if(axes.y) node.rotation.y += axes.y
                if(axes.z) node.rotation.z += axes.z
            })
        })
        : null

    function cleanup(){
        if(spinObserver) scene.onBeforeRenderObservable.remove(spinObserver)
        disposables.forEach(fn => fn())
    }

    function onHit(enemy, finishCleanup, projectile){
        runOnHitVisual(scene, box, skill, skill.onHitVisual, { root, customBuild, launchPosition }, enemy, finishCleanup, projectile)
    }

    return { cleanup, onHit }
}

// skill.onHitVisual is an ARRAY of effect descriptors, not a single object -
// a skill can layer more than one on-hit effect at once (e.g. a beam AND a
// splash burst) instead of being locked to exactly one. Normalizes a bare
// object (or undefined) into a 1-entry/0-entry array too, so nothing else
// has to care which shape a given skill actually wrote. The real
// finishCleanup only runs once EVERY effect in the array has finished its
// own sequence - each effect gets its own private "I'm done" callback that
// just decrements a shared counter, same idea as Promise.all but for these
// callback-based visual sequences instead of promises.
function runOnHitVisual(scene, box, skill, onHitVisual, built, enemy, finishCleanup, projectile){
    const effects = Array.isArray(onHitVisual) ? onHitVisual : (onHitVisual ? [onHitVisual] : [])
    if(effects.length === 0){ finishCleanup(); return }

    let pending = effects.length
    function effectDone(){
        pending -= 1
        if(pending <= 0) finishCleanup()
    }
    effects.forEach(ohv => runSingleOnHitEffect(scene, box, skill, ohv, built, enemy, effectDone, projectile))
}

// one entry from the onHitVisual array - burst/implode (position-only, box
// already stops moving/gets disposed right after by the caller), stickAndGrow
// (grows whatever renderGenericProjectile just built, sticking to the target
// first), beam (tidalspikeSkill - nothing exists until impact, built
// entirely here). finishCleanup here is really "this ONE effect is done",
// wired by runOnHitVisual above - not the projectile's real cleanup.
function runSingleOnHitEffect(scene, box, skill, ohv, built, enemy, finishCleanup, projectile){
    const powerScale = skill.projectileScale ?? 1
    const type = ohv.type || "burst"

    function finishWithOptionalStick(){
        // "stickBriefly" (old code's `skill.projectileStyle === "blade"` check) -
        // embeds briefly into the enemy after a normal burst, same as every
        // weapon-shaped skill used to, instead of despawning instantly
        if(ohv.stickBriefly && enemy?.body && projectile) return stickMarkerToMesh(projectile, box, enemy.body, finishCleanup)
        finishCleanup()
    }

    if(type === "burst" || type === "implode"){
        fireGenericBurst(scene, box.position.clone(), powerScale, ohv, skill.explosionColor || "red")
        finishWithOptionalStick()
    } else if(type === "beam"){
        const beam = ohv.beam || {}
        if(!enemy?.body){ finishCleanup(); return }
        // built.launchPosition (captured at spawn, see renderGenericProjectile) -
        // NOT box.position here, which by hit time is essentially AT the
        // enemy already (see renderGenericProjectile's own comment on this)
        const startPos = built.launchPosition ? built.launchPosition.clone() : box.position.clone()
        const endPos = enemy.body.position.clone()
        const dir = endPos.subtract(startPos)
        const dist = dir.length()
        if(dist < 0.001){ finishCleanup(); return }
        dir.normalize()

        const thickness = (beam.width ?? 0.5) * powerScale
        const beamMesh = MeshBuilder.CreatePlane(`gen_beam_${Date.now()}`, { width: dist, height: thickness }, scene)
        beamMesh.position = Vector3.Lerp(startPos, endPos, 0.5)
        beamMesh.isPickable = false
        const referenceAxis = new Vector3(1, 0, 0)
        const rotationAxis = Vector3.Cross(referenceAxis, dir)
        if(rotationAxis.lengthSquared() < 0.0001){
            beamMesh.rotationQuaternion = Vector3.Dot(referenceAxis, dir) < 0 ? Quaternion.RotationAxis(Vector3.Up(), Math.PI) : Quaternion.Identity()
        } else {
            const angle = Math.acos(Math.min(1, Math.max(-1, Vector3.Dot(referenceAxis, dir))))
            beamMesh.rotationQuaternion = Quaternion.RotationAxis(rotationAxis.normalize(), angle)
        }
        beamMesh.material = getGenericBeamMat(scene, beam.texturePath || "./images/projectiles/watercurrent.webp", beam.scrollSpeed ?? 0.6, beam.uScale ?? 4)
        addGlow(scene, beamMesh, 0.6)
        const beamMesh2 = beamMesh.clone(`gen_beam2_${Date.now()}`)
        beamMesh2.rotationQuaternion = beamMesh.rotationQuaternion.multiply(Quaternion.RotationAxis(new Vector3(1, 0, 0), Math.PI / 2))
        addGlow(scene, beamMesh2, 0.6)

        const endSplashParticles = spawnSplashBurst(scene, endPos, powerScale)
        const startSplashParticles = spawnSplashHover(scene, startPos, powerScale)
        const lingerMs = beam.lingerMs ?? 3000
        setTimeout(() => {
            endSplashParticles.dispose(false)
            startSplashParticles.dispose(false)
            beamMesh.dispose(false, false)
            beamMesh2.dispose(false, false)
            finishCleanup()
        }, lingerMs)
    } else if(type === "stickAndGrow"){
        const sag = ohv.stickAndGrow || {}
        const growDurationMs = sag.growDurationMs ?? 900
        const lingerMs = sag.lingerMs ?? 400
        const growScale = sag.growScale ?? 5
        const fadeOutMs = sag.fadeOutMs ?? null

        if(enemy?.body) box.setParent(enemy.body)
        const startScale = box.scaling.clone()
        const targetScale = startScale.scale(growScale)
        const startTime = performance.now()

        // darkorb's own custom build additionally lerps its emissive color +
        // grows both particle layers' emitRate/maxSize - a plain shape (e.g.
        // lightorb-based stormsurge) only ever grows box.scaling and fades
        // its own material alpha, nothing else
        const material = built.customBuild ? built.customBuild.orbMat : (built.root?.material || null)
        const startEmissive = built.customBuild ? built.customBuild.orbMat.emissiveColor.clone() : null
        const targetEmissive = built.customBuild ? new Color3(sag.growEmissive?.r ?? 0.85, sag.growEmissive?.g ?? 0.5, sag.growEmissive?.b ?? 1.0) : null
        const particleStarts = built.customBuild ? built.customBuild.particles.map(ps => ({ ps, rate: ps.emitRate, size: ps.maxSize })) : []
        const intensityRamp = sag.intensityRamp ?? 1
        const baseAlpha = material?.alpha ?? 1

        const growObserver = scene.onBeforeRenderObservable.add(() => {
            if(box.isDisposed()){ scene.onBeforeRenderObservable.remove(growObserver); return }
            const t = Math.min((performance.now() - startTime) / growDurationMs, 1)
            const eased = 1 - Math.pow(1 - t, 3)
            box.scaling = Vector3.Lerp(startScale, targetScale, eased)
            if(built.customBuild){
                built.customBuild.orbMat.emissiveColor = Color3.Lerp(startEmissive, targetEmissive, eased)
                particleStarts.forEach(({ ps, rate, size }) => {
                    ps.emitRate = rate + (rate * 3 * intensityRamp) * eased
                    ps.maxSize = size + (size * 2 * intensityRamp) * eased
                })
            }
            if(t >= 1){
                scene.onBeforeRenderObservable.remove(growObserver)
                if(fadeOutMs && material){
                    const fadeStart = performance.now()
                    const fadeObserver = scene.onBeforeRenderObservable.add(() => {
                        if(box.isDisposed()){ scene.onBeforeRenderObservable.remove(fadeObserver); return }
                        const ft = Math.min((performance.now() - fadeStart) / fadeOutMs, 1)
                        material.alpha = baseAlpha * (1 - ft)
                        if(ft >= 1){ scene.onBeforeRenderObservable.remove(fadeObserver); finishCleanup() }
                    })
                } else {
                    setTimeout(finishCleanup, lingerMs)
                }
            }
        })
    } else {
        // "none" - no on-hit visual of its own (astralrainSkill's marker never
        // actually reaches here - its swordRain branch returns before onHit
        // dispatch ever runs, see fireElementalProjectile) - defensive no-op
        finishCleanup()
    }
}

// skill.onHitVisual is always an array of effect descriptors now (see
// runOnHitVisual's own header comment) - this is the one place that
// normalizing happens, every other reader (playImpactSound, fireGenericBurst's
// two non-projectile callers, the stuck-flag check in fireElementalProjectile)
// goes through this instead of re-deriving the array/object distinction itself
function getOnHitEffects(skill){
    const onHitVisual = skill.onHitVisual
    return Array.isArray(onHitVisual) ? onHitVisual : (onHitVisual ? [onHitVisual] : [])
}

function playImpactSound(skill){
    const withSound = getOnHitEffects(skill).find(e => e.impactSound)
    getAllSounds()[withSound?.impactSound || "fireHitS"]?.play()
}

// shared by runSingleOnHitEffect's own "burst"/"implode" branch AND the two
// other spots that need an impact burst without going through a fired
// projectile at all (spawnGroundSpike/applyDisintegrationHit) - takes the
// specific effect entry directly (not the whole skill) so it works the same
// whether it's one of several entries in an array or the only one either
// call site found
function fireGenericBurst(scene, pos, powerScale, ohv, color){
    if(ohv?.type === "implode"){
        createImplosionBurst(scene, pos, powerScale, color)
        return
    }
    const b = ohv?.burst || {}
    createExplosionBurst(scene, pos, powerScale, b.fireScale ?? 1, b.smokeScale ?? 1, b.emberEmitRate ?? 15, color,
        { burstTexture: b.texture || "explodeTex", gravitySign: b.gravitySign ?? 1, includeSmoke: b.includeSmoke ?? true })
}

// tcp/index.ts's registerPlayerAsEnemy handler (enem._targetId/_dirTarg) -
// createEnemy.js's own melee atkDetection trigger already does this the
// instant a player's body physically walks into the enemy's trigger zone,
// but a skill can land on an enemy from well outside that range (a
// projectile, an AOE ground trap, a falling sword) with no proximity
// trigger involved at all - without this, an enemy hit purely by a skill
// never picked up a target and just kept doing whatever it was already
// doing (usually nothing), regardless of who'd actually hit it. Called
// from every real hit-emitting spot below, right alongside emitEnemyIsHit -
// only from the real caster's own client, same isCaster gate. Cheap to
// call repeatedly: _targetId is sticky server-side (registerPlayerAsEnemy
// only ever sets it once), so re-registering an already-aggroed enemy is a
// harmless no-op.
function registerSkillHitTarget(enemy, freshCharState){
    const caster = getPlayersOnScene().find(pl => pl.owner === freshCharState.owner)
    if(!caster?.body) return
    const pos = caster.body.position
    emitRegisterPlayerAsEnemy({
        _id: enemy._id,
        targetId: freshCharState.owner,
        dirTarg: { x: pos.x, y: pos.y, z: pos.z },
    })
}

const PROJECTILE_SPEED = 12
const PROJECTILE_RANGE_TIMEOUT = 3000 // ms of flight before despawning on a miss

// shared "stick instead of vanish" behavior - a hit projectile doesn't
// always just explode and despawn immediately. Attaches via a real
// .setParent() (recomputes local transform to stay exactly where it hit,
// not a raw .parent assignment) and stays attached for
// MARKER_STICK_DURATION_MS before actually disposing. Also flips the
// shared projectile.stuck flag so renderer.js's own per-projectile
// movement loop stops translating it forward once it's attached somewhere.
// Used by: skill.swordRain markers (astralrainSkill - sticks to whatever
// environment/enemy it hit), PROJECTILE_STYLES.darkorb's own onHit (grows
// instead of just sticking, doesn't use this helper directly), and every
// "blade" style skill (fireElementalProjectile/fireEnemySkillProjectile -
// sticks into the target like a thrown blade, on top of its normal
// explosion/damage, not instead of it).
const MARKER_STICK_DURATION_MS = 10000
function stickMarkerToMesh(projectile, box, hitMesh, cleanupProjectile){
    projectile.stuck = true
    box.setParent(hitMesh)
    setTimeout(cleanupProjectile, MARKER_STICK_DURATION_MS)
}

// skill.additionalEffects (abyssaldamnationSkill's own "absorb" entry, e.g.
// { effectType: "absorb", absorbStats: ["hp","mp","sp","skill"],
// absorbPercent: 1, chance: 1 }) - drains the enemy just hit and heals the
// caster by the same amount, plus optionally steals a skill the enemy
// knows. Standalone/reusable so any future hit handler (spawnFallingSword,
// spawnGroundSpike) can wire it in later without duplicating this logic -
// only fireElementalProjectile actually calls it for now, since
// abyssaldamnationSkill uses the default projectile/explosion flow.
//
// - "hp"/"mp"/"sp": reads enemy.det.<stat> (createEnemy.js's enemyIsHit now
//   keeps det.hp live-synced from the server's own broadcast hp instead of
//   the frozen spawn-time value - see its own comment; enemies have no
//   mp/sp fields anywhere in this game's data model today, so those two
//   branches are pure future-proofing and currently just no-op, matching
//   the "if it has" framing this was requested with). freshCharState is the
//   real characterState object (getCharState() returns the live reference,
//   not a clone - see grantHeartReward's identical direct-mutation pattern
//   in skillWheel.js), so writing freshCharState.hp here mutates real state
//   directly; current AND max both rise together by the absorbed amount,
//   same "current and max move together" pattern grantHeartReward
//   (skillWheel.js) already uses for its own permanent stat boost - a
//   plain current-only top-up would be invisible/silently capped away
//   whenever the caster is already near full, which isn't the intent here.
// - "skill": resolves every entry in enemy.det.skills (name strings) through
//   SKILLS_BY_NAME and hands each real skill object to giveSkill - already
//   a no-op with its own "Already know X" popup if the caster owns it.
// - chance is rolled on the same 0-1 scale skill.enemyBind.bindChance
//   already uses right in this same hit handler (not deductHp's own
//   separate 0-100 scale) - the more directly analogous mechanic living
//   right next to this one.
function applyAbsorbEffects(skill, enemy, freshCharState){
    skill.additionalEffects.forEach(effect => {
        if(effect.effectType !== "absorb") return
        if(Math.random() >= (effect.chance ?? 1)) return
        const absorbStats = effect.absorbStats || []
        const absorbPercent = effect.absorbPercent ?? 1
        let healedAnything = false
        if(absorbStats.includes("hp") && enemy.det?.hp){
            const drained = enemy.det.hp * absorbPercent
            freshCharState.maxHp += drained
            freshCharState.hp += drained
            healedAnything = true
        }
        if(absorbStats.includes("mp") && enemy.det?.mp){
            const drained = enemy.det.mp * absorbPercent
            freshCharState.maxMp += drained
            freshCharState.mp += drained
            healedAnything = true
        }
        if(absorbStats.includes("sp") && enemy.det?.sp){
            const drained = enemy.det.sp * absorbPercent
            freshCharState.maxSp += drained
            freshCharState.sp += drained
            healedAnything = true
        }
        if(healedAnything){
            updateHpMpSp_UI()
            updateMyDetailsOL(freshCharState, checkIfTokenSaved())
        }
        if(absorbStats.includes("skill") && enemy.det?.skills?.length){
            enemy.det.skills.forEach(skillName => {
                const enemySkill = SKILLS_BY_NAME[skillName]
                if(!enemySkill) return
                // giveSkill itself isn't upgrade-aware - it no-ops with an
                // "Already know X" popup if the caster already owns it (see
                // its own comment in skillsui.js). Same "already have it ->
                // upgrade instead" fallback grantSkillReward already uses in
                // skillWheel.js, so absorbing a skill you already know still
                // DOES something instead of being a wasted proc.
                const alreadyKnown = freshCharState.skills.some(sk => sk.name === enemySkill.name)
                if(alreadyKnown) upgradeOwnedSkill(enemySkill)
                else giveSkill(enemySkill)
            })
        }
    })
}

function fireElementalProjectile(scene, charState, skill, spawnPos, forward, powerScale){
    const targetPoint = spawnPos.add(forward.scale(10)) // far enough out that direction is stable regardless of distance to anything

    const itemId = `${skill.name}_${randNum(1000, 9999)}`
    // getShapeClone (not .createInstance()) - "lightning" style below sets
    // box.material directly, which is a silent no-op on an InstancedMesh
    // (same trap already documented on fireEnemySkillProjectile's own box)
    const box = getShapeClone(scene, "box_projectile", () => MeshBuilder.CreateBox("box_projectile_template", { size: 0.7 }, scene))
    box.position.copyFrom(spawnPos)
    box.isPickable = false
    box.isVisible = false // renderGenericProjectile flips this back on for shapes that want the box itself visible (e.g. shape:"box")

    // reads skill.projectileVisual/skill.onHitVisual - see renderGenericProjectile's
    // own header comment. onHit is always present now (it internally dispatches
    // skill.onHitVisual.type), collapsing the old "sometimes a plain cleanup
    // function, sometimes {cleanup, onHit}" split into one consistent shape.
    const { cleanup: cleanupStyle, onHit } = renderGenericProjectile(scene, box, skill)
    // marker-style skills (projectileVisual.silentLaunch, astralrainSkill's
    // own targeting box) stay silent too, not just invisible - a stealthy
    // targeting box firing off a fireball whoosh would undercut the whole
    // point of it. Explicit flag, not inferred from visible/shape - "beam"
    // (tidalspike) is ALSO invisible in flight but still launches with sound.
    if(!skill.projectileVisual?.silentLaunch){
        getAllSounds()[skill.projectileVisual?.launchSound || "fireBallS"]?.play()
    }

    const dx = targetPoint.x - box.position.x
    const dy = targetPoint.y - box.position.y
    const dz = targetPoint.z - box.position.z
    box.rotation.y = Math.atan2(dx, dz)
    box.rotation.x = -Math.atan2(dy, Math.sqrt(dx * dx + dz * dz))

    const projectile = {
        itemId,
        body: box,
        targetDirection: { x: dx, y: dy, z: dz },
        spd: PROJECTILE_SPEED,
        placeId: charState.currentPlace.placeId,
        stuck: false,
        willDetectSurface: false
    }
    pushProjectile(projectile)

    // removeProjectile only disposes the box - whatever the projectile style
    // attached (particles/blade/lightning) is this file's own responsibility
    // to clean up, on every exit path
    function cleanupProjectile(){
        cleanupStyle()
        removeProjectile(itemId)
    }

    let hasHit = false
    // only ever populated below, for skill.swordRain skills - cleanup fns
    // for every environment intersection trigger registered (see the
    // ENV_HIT_KEYWORDS block after the enemy loop), tracked up here so
    // BOTH hit paths (enemy intersection and environment intersection) can
    // tear all of them down together, no matter which one fires first
    const envTriggerCleanups = []
    const missTimeout = setTimeout(() => {
        if(hasHit) return
        envTriggerCleanups.forEach(fn => fn())
        cleanupProjectile()
    }, PROJECTILE_RANGE_TIMEOUT)

    // enemies only - hitting other players isn't wired up here (no PvP
    // damage path was asked for, and deductHp's multiplayer contract wasn't
    // verified against this), so a bolt just passes through them
    getEnemiesOnScene().forEach(enemy => {
        if(!enemy.body) return
        const enterAction = onIntersecEnterTrig(box, enemy.body, scene, () => {
            if(hasHit) return
            // this trigger is bound to ONE SPECIFIC enemy, captured in this
            // closure back at cast time - if THIS enemy died from
            // something else entirely while this projectile was still in
            // flight, nothing tears its own trigger down just because it
            // died elsewhere, and its body isn't actually disposed until
            // enemyDispose's own 2s-later cleanup (deliberately delayed so
            // the death animation can play) - a stale trigger like this
            // can still fire during that window, sending a hit/bind/curse
            // for an _id the server has already forgotten about ("not
            // found enemy to be damaged/curse/bind" - always the exact
            // same _id, since it's always this one stale closure). Same
            // fresh re-check createEnemy.js's own atkCollider melee
            // trigger already does - if it's not still actually tracked,
            // just ignore this stale trigger entirely (not even counted
            // as this projectile's one hit) and let it keep flying toward
            // whatever it might genuinely still reach.
            if(!getEnemiesOnScene().some(e => e._id === enemy._id)) return
            hasHit = true
            clearTimeout(missTimeout)
            removeIntersecTrig(box, enterAction)
            envTriggerCleanups.forEach(fn => fn())

            // skill.swordRain (astralrainSkill) - this marker doesn't deal
            // damage or explode itself, it only marks where it landed;
            // triggerSwordRain spawns the actual damage-dealing swords from
            // above at that spot. Sticks to whatever it hit instead of
            // disposing right away (stickMarkerToMesh) and bails out before
            // any of the standard damage/explosion/bind/curse flow below,
            // which doesn't apply to the marker itself.
            if(skill.swordRain){
                triggerSwordRain(scene, charState, skill, enemy.body.position.clone(), powerScale)
                stickMarkerToMesh(projectile, box, enemy.body, cleanupProjectile)
                return
            }

            playImpactSound(skill)

            // "stickAndGrow"/"beam" onHitVisual types stick to (or hang
            // around near) the enemy instead of a one-shot burst - stop the
            // shared projectile-movement loop from still trying to translate
            // it forward now that it's effectively stuck (renderer.js's
            // per-projectile loop checks this flag every frame; set it
            // immediately here rather than waiting for the visual sequence
            // itself to get around to it, same timing the old code used).
            // "burst"/"implode"/"none" all despawn immediately instead
            // (cleanupProjectile removes it from that array right away
            // regardless), so this flag doesn't matter for them.
            if(getOnHitEffects(skill).some(e => e.type === "stickAndGrow" || e.type === "beam")) projectile.stuck = true

            // this callback fires whenever the projectile actually CONNECTS,
            // which can be several seconds after the skill was activated
            // (castDuration + travel time) - AND it fires identically on
            // EVERY client watching this cast (fireElementalProjectile runs
            // once per connected client via the "skillactivated" relay, see
            // attackingSystem.js's activateSkill), caster included. The
            // charState parameter here is the CASTER's own info - for
            // anyone who isn't the caster, it's a lightweight descriptor
            // built from the relay (owner/currentPlace/stats only, see
            // activateSkill's own comment), NOT that watcher's own local
            // state. Emitting a hit/damage/absorb unconditionally from every
            // watching client would credit every single one of them for the
            // same one hit - this was the actual root cause of "other
            // players get exp too" - so only the real caster's own client
            // (the one where my own local getCharState().owner actually
            // matches this charState.owner) is allowed to emit anything
            // real below. Everyone else just watched the same explosion/
            // stick/sound above and stops there.
            if(charState.owner === getCharState()?.owner){
                // fresh getCharState() here (not the charState parameter) -
                // safe now that the isCaster check above guarantees this
                // really is MY OWN live state and not a stand-in for
                // someone else. Still re-fetched fresh rather than reusing
                // the parameter, matching createEnemy.js's own melee
                // atkCollider trigger, which re-fetches getCharState() at
                // the moment of the actual hit rather than trusting
                // whatever was captured back at cast/activation time.
                const freshCharState = getCharState()

                // magic damage recomputed at impact (not at activation) -
                // same formula attackingSystem.js's calcDmg uses for
                // magicDmg, duplicated here instead of importing calcDmg to
                // avoid a 2-file import cycle with attackingSystem.js
                // (which is what calls castOffenseSkill in the first
                // place). additionalMagicDmg is {toAdd, percent}, not a
                // plain number - see calcDmg's own comment on this same
                // formula.
                const abilityAdditions = getAdditionalsFromAbilities()
                let magicDmg = abilityAdditions.additionalMagicDmg.toAdd + freshCharState.stats.magic * 16
                if(abilityAdditions.additionalMagicDmg.percent){
                    magicDmg += magicDmg * abilityAdditions.additionalMagicDmg.percent
                }
                // scaled by how much mana was actually committed at cast time,
                // same ratio the mp cost itself was charged at (see castOffenseSkill)
                const totalDmg = Math.round(((skill.effects?.plusDmg || 0) + magicDmg) * powerScale)

                // server's enemyIsHit handler only ever reads weaponDmg (if
                // truthy) or physicalDmg - there's no separate magic-damage
                // field anywhere in the existing damage pipeline, so this rides
                // through physicalDmg rather than needing a server change
                emitEnemyIsHit({
                    playerId: freshCharState.owner,
                    dmgDetails: { physicalDmg: totalDmg, weaponDmg: 0 },
                    targetId: enemy._id,
                    currentPlaceId: freshCharState.currentPlace.placeId,
                })
                registerSkillHitTarget(enemy, freshCharState)

                // skill.enemyBind (see skillsData.js's radiantjudgmentSkill) -
                // bindChance rolled here, client-side, same as every other hit-
                // resolution decision in this game (server is only authoritative
                // for hp/removal, never for "did this even land" - see
                // emitEnemyIsHit's own comment). tcp/index.ts's enemyBind
                // handler is the actual _disabled timer authority.
                // if(skill.enemyBind && Math.random() < (skill.enemyBind.bindChance ?? 1)){
                if(skill.enemyBind){
                    emitEnemyBind({
                        targetId: enemy._id,
                        shape: skill.enemyBind.shape,
                        bindDuration: skill.enemyBind.bindDuration,
                        currentPlaceId: freshCharState.currentPlace.placeId,
                    })
                }

                // dark magic curses on hit - an ELEMENT rule (every dark skill,
                // not a per-skill flag), unconditional/no chance roll unlike
                // enemyBind above. See skillsData.js's header comment and
                // worldsocket.js's "enemy-attacked" handler for the actual
                // damage-reflection this curse causes.
                if(skill.element === "dark"){
                    emitEnemyCurse({
                        targetId: enemy._id,
                        currentPlaceId: freshCharState.currentPlace.placeId,
                    })
                }

                // skill.additionalEffects (abyssaldamnationSkill's own "absorb"
                // entry) - see applyAbsorbEffects's own comment for the full
                // breakdown
                if(skill.additionalEffects){
                    applyAbsorbEffects(skill, enemy, freshCharState)
                }
            }

            // onHit owns when cleanupProjectile actually runs from here -
            // for "stickAndGrow" that's after its grow(+fade) sequence
            // finishes; for onHitVisual.stickBriefly (the old "blade" style's
            // own behavior) it embeds into the enemy for MARKER_STICK_DURATION_MS
            // first (enemies have no bodytarget/spine mount like players do,
            // so this attaches to the enemy's own whole body); everything
            // else calls finishCleanup immediately, right when it lands
            onHit(enemy, cleanupProjectile, projectile)
        })
    })

    // skill.swordRain (astralrainSkill) only - the marker can ALSO strike
    // the environment (floor/wall/tree), not just an enemy, via the same
    // ActionManager.OnIntersectionEnterTrigger mechanism the enemy loop
    // above uses - onIntersecEnterTrig always needs one specific target
    // mesh per registration, and there's no single "environment" mesh to
    // point it at, so this scans the scene for meshes whose own name marks
    // them as structural/authored geometry and registers a trigger against
    // each match individually.
    //
    // Coverage gap (known, accepted): this only catches authored/instanced
    // geometry with a matching name - dungeon walls/floors (wall_N/floor_N,
    // createdungeon.js) and village ground (${namePrefix}_ground,
    // createvillage.js). The open-world OUTDOOR terrain and its scattered
    // trees are placed by the infterrain package under generated names
    // (master_N for terrain chunks, tN_M for trees) with no "ground"/"tree"
    // substring and no single mesh to filter for, so a marker landing on
    // open wilderness ground or an outdoor tree currently won't trigger
    // this at all (a physics raycast against the physics world would catch
    // those too, but was deliberately traded away for a pure ActionManager
    // approach here).
    // "wall"/"floor"/"_ground"/"tree" - "_ground" not bare "ground": Babylon's
    // own createDefaultEnvironment() root mesh is literally named
    // "BackgroundHelper", which matches the bare substring "ground" (back-
    // GROUND-Helper) despite being nowhere near terrain (same false
    // positive already caught and fixed in creations/skills.js's own
    // spawnProjectile). Real ground meshes are always ${namePrefix}_ground
    // (createvillage.js), so the underscore excludes it without excluding
    // anything real.
    const ENV_HIT_KEYWORDS = ["wall", "floor", "_ground", "tree"]
    if(skill.swordRain){
        scene.meshes.forEach(mesh => {
            if(mesh === box || !mesh.name) return
            // real "Mesh" instances only - excludes InstancedMesh and
            // anything else that isn't the kind of solid, uniquely-named
            // environment geometry this is looking for
            if(mesh.getClassName() !== "Mesh") return
            const lowerName = mesh.name.toLowerCase()
            if(!ENV_HIT_KEYWORDS.some(keyword => lowerName.includes(keyword))) return

            const enterAction = onIntersecEnterTrig(box, mesh, scene, () => {
                if(hasHit) return
                hasHit = true
                clearTimeout(missTimeout)
                envTriggerCleanups.forEach(fn => fn())

                // the MARKER's own position at the moment it registered the
                // hit, not the hit mesh's own transform origin - a ground
                // plane's pivot can sit anywhere (village center, world
                // origin, wherever it was authored), completely unrelated
                // to where the marker actually was when it touched it. This
                // was the actual cause of swords raining down right next to
                // the caster instead of out where the marker really landed.
                const hitPos = box.position.clone()
                triggerSwordRain(scene, charState, skill, hitPos, powerScale)
                stickMarkerToMesh(projectile, box, mesh, cleanupProjectile)
            })
            envTriggerCleanups.push(() => removeIntersecTrig(box, enterAction))
        })
    }
}

// --- astralrainSkill's sword rain (skill.swordRain, see skillsData.js and
// the "marker" branch in fireElementalProjectile above) ---
// The invisible marker box (PROJECTILE_STYLES.marker) does the actual
// targeting - once it touches an enemy, THIS is what fires: skill.swordRain
// = { min, max, spread } picks a random count of swords, each staggered a
// short beat apart (not all landing in the same instant) and scattered
// within `spread` units of the marked point instead of every sword
// converging on the exact same spot.
//
// Swords don't drop straight down from directly over the target (which
// could be off-screen, far from the caster) - they conjure from a shared
// point above and to the RIGHT of the caster (computeSwordRainOrigin) and
// streak diagonally down onto their own scattered landing spot, reading as
// summoned near the player and thrown at the enemy rather than just
// appearing already hovering over them.
const SWORD_RAIN_HEIGHT = 6 // how far above the caster this origin point sits
const SWORD_RAIN_RIGHT_OFFSET = 2.5 // how far to the caster's own right the origin sits
const SWORD_RAIN_ORIGIN_JITTER = 0.6 // small per-sword scatter around the shared origin, so 2-3 swords don't all spawn at one identical point
const SWORD_RAIN_STAGGER_MS = 180 // gap between each sword's own spawn, not their landing

function triggerSwordRain(scene, charState, skill, groundPos, powerScale){
    const swordRain = skill.swordRain
    const count = randBetween(swordRain.min ?? 2, swordRain.max ?? 3)

    const player = getPlayersOnScene().find(pl => pl.owner === charState.owner)
    const originPos = computeSwordRainOrigin(player, groundPos)

    for(let i = 0; i < count; i++){
        setTimeout(() => spawnFallingSword(scene, charState, skill, originPos, groundPos, powerScale), i * SWORD_RAIN_STAGGER_MS)
    }
}

// above-and-right of the caster's own current position/facing - falls back
// to directly above the marked ground point (the old behavior) if the
// caster's body isn't available for some reason
function computeSwordRainOrigin(player, groundPos){
    if(!player?.body) return { x: groundPos.x, y: groundPos.y + SWORD_RAIN_HEIGHT, z: groundPos.z }

    const rightVec = Vector3.TransformNormal(new Vector3(1, 0, 0), player.body.getWorldMatrix()).normalize()
    const basePos = player.body.absolutePosition
    return {
        x: basePos.x + rightVec.x * SWORD_RAIN_RIGHT_OFFSET,
        y: basePos.y + SWORD_RAIN_HEIGHT,
        z: basePos.z + rightVec.z * SWORD_RAIN_RIGHT_OFFSET,
    }
}

function spawnFallingSword(scene, charState, skill, originPos, groundPos, powerScale){
    const spread = skill.swordRain.spread ?? 3.5
    const landingPos = {
        x: groundPos.x + randNum(-spread, spread),
        y: groundPos.y,
        z: groundPos.z + randNum(-spread, spread),
    }
    // a little jitter per sword so 2-3 of them don't all spawn from the
    // exact same point in the air before fanning out to their own landing spot
    const startPos = {
        x: originPos.x + randNum(-SWORD_RAIN_ORIGIN_JITTER, SWORD_RAIN_ORIGIN_JITTER),
        y: originPos.y + randNum(-SWORD_RAIN_ORIGIN_JITTER, SWORD_RAIN_ORIGIN_JITTER),
        z: originPos.z + randNum(-SWORD_RAIN_ORIGIN_JITTER, SWORD_RAIN_ORIGIN_JITTER),
    }

    // reuses creations/skills.js's spawnProjectile for the falling sword
    // itself (same small glowing-sword mesh/movement the "throw weapon"
    // mechanic uses) - but NOT its built-in player/enemy/ground hit
    // detection, since this skill needs its own damage/curse logic either
    // way. The travel time below is computed analytically instead
    // (straight-line distance over spawnProjectile's own hardcoded spd: 10 -
    // see its source - this drifts out of sync if that ever changes) and
    // drives this file's own enemy-hit/damage/explosion logic once the
    // sword should have landed, same shape as fireElementalProjectile's own
    // hit handling just timer-driven instead of trigger-driven.
    //
    // willDisposeCountDown (6s) - once a sword sticks into whatever it hit
    // (player/enemy/ground - spawnProjectile's own trigger/raycast
    // branches all still run and stick it independently of this file's own
    // damage logic above), it stayed there forever with nothing to ever
    // clean it up - a real leak over a long play session with this skill
    // used repeatedly. 6s is long enough to read as "the sword lands and
    // lingers a moment" without piling up indefinitely.
    const SWORD_DISPOSE_MS = 6000
    const swordItemId = spawnProjectile(startPos, landingPos, skill.explosionColor || "white", scene, "default", null, SWORD_DISPOSE_MS)

    // now a diagonal path (origin near the player, not straight above the
    // landing spot) - real distance instead of assuming a fixed drop height
    const SPAWN_PROJECTILE_SPD = 10
    const dx = landingPos.x - startPos.x
    const dy = landingPos.y - startPos.y
    const dz = landingPos.z - startPos.z
    const travelDistance = Math.sqrt(dx * dx + dy * dy + dz * dz)
    const travelMs = (travelDistance / SPAWN_PROJECTILE_SPD) * 1000

    setTimeout(() => {
        // a physical blade landing, not an elemental bolt detonating - same
        // struckS sound melee/blade-style projectiles use, no burst/flare
        // at all (EXPLOSION_STYLES intentionally isn't called here)
        getAllSounds().struckS?.play()

        // whatever enemy is actually standing near the landing spot NOW
        // (re-queried at impact time, not the enemy the marker originally
        // hit) takes the hit - a sword falling from the sky should land on
        // whatever's there when it arrives, not track a target that's since
        // moved off. Same magic-damage formula as fireElementalProjectile's
        // own hit handler, at this sword's own (usually lower per-sword)
        // skill.effects.plusDmg.
        //
        // this whole setTimeout, like the falling sword's flight itself,
        // runs identically on every client watching the cast - see
        // fireElementalProjectile's own isCaster comment for the full
        // reasoning. charState here is the CASTER's info (a relayed stand-in
        // for anyone who isn't the real caster), so the actual hit-emitting
        // work below only runs on the real caster's own client.
        if(charState.owner === getCharState()?.owner){
            const freshCharState = getCharState()
            const IMPACT_RADIUS = 1.8
            getEnemiesOnScene().forEach(enemy => {
                if(!enemy.body) return
                const dx = enemy.body.position.x - landingPos.x
                const dz = enemy.body.position.z - landingPos.z
                if((dx * dx + dz * dz) > IMPACT_RADIUS * IMPACT_RADIUS) return

                const abilityAdditions = getAdditionalsFromAbilities()
                let magicDmg = abilityAdditions.additionalMagicDmg.toAdd + freshCharState.stats.magic * 16
                if(abilityAdditions.additionalMagicDmg.percent){
                    magicDmg += magicDmg * abilityAdditions.additionalMagicDmg.percent
                }
                const totalDmg = Math.round(((skill.effects?.plusDmg || 0) + magicDmg) * powerScale)

                emitEnemyIsHit({
                    playerId: freshCharState.owner,
                    dmgDetails: { physicalDmg: totalDmg, weaponDmg: 0 },
                    targetId: enemy._id,
                    currentPlaceId: freshCharState.currentPlace.placeId,
                })
                registerSkillHitTarget(enemy, freshCharState)

                if(skill.element === "dark"){
                    emitEnemyCurse({ targetId: enemy._id, currentPlaceId: freshCharState.currentPlace.placeId })
                }
            })
        }

        // fallback cleanup - spawnProjectile's own willDisposeCountDown
        // (SWORD_DISPOSE_MS above) only ever starts counting down if ITS
        // OWN player/enemy/ground hit detection actually registers a hit;
        // a sword that misses everything entirely (e.g. flying over open-
        // world terrain, which spawnProjectile's ground raycast doesn't
        // reliably catch on every surface) would never trigger that timer
        // at all and just sit there forever. This fires on the exact same
        // schedule a genuine stick-and-linger would (impact time +
        // SWORD_DISPOSE_MS), and safely no-ops via removeProjectile's own
        // "already gone" guard if the real hit path already disposed it.
        setTimeout(() => removeProjectile(swordItemId), SWORD_DISPOSE_MS)
    }, travelMs)
}

// --- continentalrendSkill's ground spike line (skill.groundSpikes, see
// skillsData.js and the branch in castOffenseSkill above) ---
// No projectile, no marker, no hit-detection step at all - unlike
// swordRain, this doesn't need to find a target first. skill.groundSpikes
// = { count, spacing, staggerMs } marches a straight line of jagged rock
// spikes forward from the caster along their own facing direction, each
// one erupting staggerMs after the last (a rippling "ground splitting
// open" read, not all 5 at once) - each spike deals its own AoE damage
// independently the instant it erupts, so a target standing in the line's
// path can take more than one hit as it marches past them.
const GROUND_SPIKE_STAGGER_MS = 160
const GROUND_SPIKE_SPACING = 2.2
// small scatter so the line doesn't read as a perfectly straight, evenly-
// spaced row - see triggerGroundSpikeLine
const GROUND_SPIKE_LATERAL_JITTER = 0.8
const GROUND_SPIKE_DIST_JITTER = 0.4
const GROUND_SPIKE_HEIGHT = 1.8
const GROUND_SPIKE_ERUPT_MS = 280
const GROUND_SPIKE_LIFETIME_MS = 4000
const GROUND_SPIKE_IMPACT_RADIUS = 1.6

// shared/cached material, not per-spike - unlike every other style in this
// file, a ground spike's own look never actually varies with
// skill.explosionColor (always the same fixed dark-rock-with-a-green-glow
// read regardless of element - see spawnGroundSpike's own comment), so
// there's nothing per-cast to give it an independent material for. One
// StandardMaterial, created once, reused by every spike forever. Scene-
// scoped (Material has no isDisposed() to self-detect a stale reference
// the way Mesh does - see particlesystem.js's own getParticleTexture for
// the full "why" this matters at all) - tracked explicitly instead.
let groundSpikeMat = null
let groundSpikeMatScene = null
function getGroundSpikeMat(scene){
    if(!groundSpikeMat || groundSpikeMatScene !== scene){
        groundSpikeMat = new StandardMaterial("groundspikeMat", scene)
        groundSpikeMat.diffuseColor = new Color3(0.16, 0.13, 0.08) // dark rock
        groundSpikeMat.specularColor = new Color3(0.05, 0.05, 0.05)
        groundSpikeMat.emissiveColor = new Color3(0.15, 0.55, 0.2) // faint earthy-green glow along the facets
        groundSpikeMatScene = scene
    }
    return groundSpikeMat
}

function triggerGroundSpikeLine(scene, charState, skill, player, spawnPos, forward, powerScale){
    const groundSpikes = skill.groundSpikes
    const count = groundSpikes.count ?? 5
    const spacing = groundSpikes.spacing ?? GROUND_SPIKE_SPACING
    const staggerMs = groundSpikes.staggerMs ?? GROUND_SPIKE_STAGGER_MS

    // horizontal-only direction - spikes erupt straight up out of the
    // ground, shouldn't drift because the caster's hand happened to be
    // aimed slightly up or down at cast time
    const flatForward = new Vector3(forward.x, 0, forward.z)
    if(flatForward.lengthSquared() < 0.0001) flatForward.set(0, 0, 1)
    flatForward.normalize()

    // perpendicular to flatForward (90° rotation in the XZ plane) - used to
    // scatter each spike a little side-to-side so the line doesn't read as
    // a perfectly ruler-straight row of identical copies
    const perp = new Vector3(-flatForward.z, 0, flatForward.x)

    // player.body's own position is the capsule's CENTER, not its base -
    // same capsuleHeight/2 correction inputMovement.js's own isGrounded()
    // ground check already relies on. Fine as a FLAT-ground fallback (every
    // non-openworld place), but on openworld's uneven terrain a single
    // height sampled once at the caster's own feet and reused for the
    // whole marching line drifts further from the real ground the farther
    // forward a spike lands (a line can march ~11+ units out, plenty for a
    // slope to noticeably rise/fall along its path) - spikes erupted
    // floating in mid-air or half-swallowed by a hillside instead of
    // planting into the actual surface. sampleTerrainSurfaceHeight (not
    // terrainHeight - matches the coarse, interpolated grid the rendered
    // chunk mesh was actually built from, see OPENWORLD_TERRAIN_VERTS's own
    // comment) is now sampled per spike, at THAT spike's own (x,z), same
    // fix already applied to enemy Y-positioning and projectile ground-
    // following.
    const isOpenworld = charState.currentPlace.placeId === OPENWORLD_PLACE_ID
    const flatGroundY = player.body.position.y - capsuleHeight / 2

    for(let i = 0; i < count; i++){
        // forward distance and sideways offset both jittered - keeps the
        // overall "marching away from the caster" read while no two spikes
        // land in a perfectly straight line or evenly spaced apart
        const dist = spacing * (i + 1) + randNum(-GROUND_SPIKE_DIST_JITTER, GROUND_SPIKE_DIST_JITTER)
        const lateral = randNum(-GROUND_SPIKE_LATERAL_JITTER, GROUND_SPIKE_LATERAL_JITTER)
        const groundX = spawnPos.x + flatForward.x * dist + perp.x * lateral
        const groundZ = spawnPos.z + flatForward.z * dist + perp.z * lateral
        const groundY = isOpenworld ? sampleTerrainSurfaceHeight(groundX, groundZ, OPENWORLD_TERRAIN_VERTS) : flatGroundY
        const groundPos = new Vector3(groundX, groundY, groundZ)
        setTimeout(() => spawnGroundSpike(scene, charState, skill, groundPos, powerScale), i * staggerMs)
    }
}

function spawnGroundSpike(scene, charState, skill, groundPos, powerScale){
    const scaleMult = skill.projectileScale ?? 1
    const height = GROUND_SPIKE_HEIGHT * scaleMult
    // a cone (diameterTop 0) for the sharp point, low tessellation for a
    // faceted/jagged rock read instead of a smooth spike - geometry is
    // built once at its BASE (1x) size and scaled per-cast via .scaling
    // instead of baking scaleMult into the dimensions themselves, so every
    // level/every cast of this skill clones the exact same cached template
    const spike = getShapeClone(scene, "cylinder_groundspike", () => MeshBuilder.CreateCylinder("cylinder_groundspike_template", {
        diameterTop: 0, diameterBottom: 0.55, height: GROUND_SPIKE_HEIGHT, tessellation: 6,
    }, scene))
    spike.scaling.set(scaleMult, scaleMult, scaleMult)
    spike.isPickable = false
    spike.rotation.y = randNum(0, Math.PI * 2) // random yaw - a row of identical spikes reads as stamped copies otherwise
    spike.material = getGroundSpikeMat(scene)

    // buried -> erupted: mesh origin is centered, so buried means the
    // WHOLE cone sits below ground (only its tip grazing ground level),
    // erupted means the wide base has risen to ground level with the tip
    // sticking up `height` - eased over GROUND_SPIKE_ERUPT_MS instead of
    // popping instantly, same manual onBeforeRenderObservable lerp
    // PROJECTILE_STYLES.darkorb's own onHit grow sequence already uses
    const buriedY = groundPos.y - height / 2
    const eruptedY = groundPos.y + height / 2 - 0.15 // sits slightly sunk in rather than floating exactly at ground level
    spike.position.set(groundPos.x, buriedY, groundPos.z)

    const startTime = performance.now()
    const eruptObserver = scene.onBeforeRenderObservable.add(() => {
        if(spike.isDisposed()){
            scene.onBeforeRenderObservable.remove(eruptObserver)
            return
        }
        const t = Math.min(1, (performance.now() - startTime) / GROUND_SPIKE_ERUPT_MS)
        const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
        spike.position.y = buriedY + (eruptedY - buriedY) * eased
        if(t >= 1) scene.onBeforeRenderObservable.remove(eruptObserver)
    })

    getAllSounds().rockSmashS?.play()
    // continentalrend's own onHitVisual burst entry (earth-style: debris
    // FALLS, gravitySign -1, instead of rising like fire/embers do) -
    // groundSpikes bypasses projectileVisual entirely (no projectile fires),
    // but the burst itself still reads its params from skill data like every
    // other burst. getOnHitEffects()[0] - a ground spike only ever needs ONE
    // effect, no reason for continentalrend to declare more than one entry
    fireGenericBurst(scene, new Vector3(groundPos.x, groundPos.y, groundPos.z), powerScale, getOnHitEffects(skill)[0], skill.explosionColor || "red")

    // magic damage recomputed at each spike's own eruption, same formula
    // fireElementalProjectile's own hit handler uses. Same isCaster gate as
    // fireElementalProjectile too - this function (like every other skill
    // visual) runs identically on every client watching the cast, and
    // charState here is the CASTER's info, not necessarily my own local
    // state, so only the real caster's own client emits the actual hit.
    if(charState.owner === getCharState()?.owner){
        const freshCharState = getCharState()
        getEnemiesOnScene().forEach(enemy => {
            if(!enemy.body) return
            const dx = enemy.body.position.x - groundPos.x
            const dz = enemy.body.position.z - groundPos.z
            if((dx * dx + dz * dz) > GROUND_SPIKE_IMPACT_RADIUS * GROUND_SPIKE_IMPACT_RADIUS) return

            const abilityAdditions = getAdditionalsFromAbilities()
            let magicDmg = abilityAdditions.additionalMagicDmg.toAdd + freshCharState.stats.magic * 16
            if(abilityAdditions.additionalMagicDmg.percent){
                magicDmg += magicDmg * abilityAdditions.additionalMagicDmg.percent
            }
            const totalDmg = Math.round(((skill.effects?.plusDmg || 0) + magicDmg) * powerScale)

            emitEnemyIsHit({
                playerId: freshCharState.owner,
                dmgDetails: { physicalDmg: totalDmg, weaponDmg: 0 },
                targetId: enemy._id,
                currentPlaceId: freshCharState.currentPlace.placeId,
            })
            registerSkillHitTarget(enemy, freshCharState)
        })
    }

    // material is NOT disposed here - getGroundSpikeMat's own instance is
    // shared/persistent, reused by every spike (this cast's remaining
    // ones and every future cast's), not owned by this one spike
    setTimeout(() => {
        spike.dispose()
    }, GROUND_SPIKE_LIFETIME_MS)
}

// --- disintegrationSkill's ground trap (skill.groundTrap, see skillsData.js
// and the branch in castOffenseSkill above) ---
// No projectile at all, and nothing aimed at a target - instead, a flat
// ground-rune circle blooms a short distance in front of the caster
// (createMagicCircle with facingDirection omitted - see that function's own
// comment: without it, the circle lies flat facing the sky, the same
// "environmental rune" look every non-combat circle in this game already
// uses, instead of the usual upright in-front-of-hand circle every OTHER
// offense skill's pre-cast circle shows), with an invisible box trigger
// hovering over the same spot. The FIRST enemy to walk into that box (not
// aimed, not a hit roll - purely "did anything cross into this box")
// consumes the trap: fire particles burst, they take a hit, and get bound
// via skill.enemyBind, same bind mechanic radiantjudgmentSkill already uses
// off a landed hit instead of a walked-into trap.
const GROUND_TRAP_DEFAULT_RADIUS = 1.8
// 0 - "myBody position" (see skillsData.js's own groundTrap.distance on
// disintegrationSkill), not out in front like the pre-cast circle every
// other offense skill shows. Kept as a real (overridable) default rather
// than hardcoded 0 below, in case a future groundTrap skill wants an
// actual thrown-out-in-front trap instead of one centered on the caster.
const GROUND_TRAP_DEFAULT_DISTANCE = 0
const GROUND_TRAP_DEFAULT_DURATION_MS = 8000

// createMagicCircle's own template is a fixed 2.5x2.5 plane (see
// magiccircles.js's getCircleTemplate) - converts a real world-space radius
// into the sizeScale multiplier that makes the circle's actual visual
// diameter match its real trigger/AOE footprint, whether that's
// disintegrationSkill's small 1.8-unit trap or massivedisintegrationSkill's
// own 10-20-unit AOE, instead of a single fixed scale that only looked
// right for one specific radius.
const MAGIC_CIRCLE_BASE_DIAMETER = 2.5
function groundTrapCircleScale(radius){
    return (radius * 2) / MAGIC_CIRCLE_BASE_DIAMETER
}

// massivedisintegrationSkill (skill.groundTrap.aoe) scales its radius
// linearly with level - radius: 10 at lvl 1, exactly radius*lvl, matching
// "10 at lvl1, 20 at lvl2" as given. disintegrationSkill's own small
// single-target trap stays fixed regardless of level (aoe isn't set on it).
function getGroundTrapRadius(skill){
    const baseRadius = skill.groundTrap?.radius ?? GROUND_TRAP_DEFAULT_RADIUS
    return skill.groundTrap?.aoe ? baseRadius * skill.lvl : baseRadius
}

// the actual "disintegrate this one enemy" hit - shared between
// spawnGroundTrap (one enemy, walked into a box trigger) and
// spawnMassGroundTrap (every qualifying enemy in an AOE sweep) so both
// trigger mechanisms produce the identical fire-burst/burning-body/hit/bind
// sequence instead of two copies of the same logic drifting apart over
// time. Visual portion (burst + burning body + sound) runs for every client
// watching the cast; the actual hit/bind only fires from the real caster's
// own client - see fireElementalProjectile's own isCaster comment for the
// full multiplayer reasoning, identical here.
function applyDisintegrationHit(scene, charState, skill, enemy, powerScale, durationMs){
    // no projectile fires for a ground trap (projectileVisual.useProjectile:false),
    // but the burst itself still reads its onHitVisual entry like every other burst
    fireGenericBurst(scene, enemy.body.position.clone(), powerScale, getOnHitEffects(skill)[0], skill.explosionColor || "red")
    playImpactSound(skill)

    // persistent "burning" fire, ON the enemy's own body - see
    // createBodyFireParticles' own comment in particlesystem.js for why
    // this (not createParticlesForMesh) is what actually reads as
    // "wreathed in flame" instead of one small poof. Lifetime matches
    // skill.enemyBind's own bindDuration (falls back to durationMs if the
    // skill somehow has no bind) - same client-side visual-duration
    // convention applyEnemyBind's own torus ring already uses.
    const burnMs = (skill.enemyBind?.bindDuration ?? durationMs / 1000) * 1000
    const burnParticles = createBodyFireParticles(enemy.body, scene, enemy.det?.bodyHeight, enemy.det?.bodyWidenes)
    setTimeout(() => {
        burnParticles.stop()
        // (false) - particleTexture is particlesystem.js's own
        // shared/persistent texture cache, not owned by this one system
        burnParticles.dispose(false)
    }, burnMs)

    if(charState.owner === getCharState()?.owner){
        const freshCharState = getCharState()
        const abilityAdditions = getAdditionalsFromAbilities()
        let magicDmg = abilityAdditions.additionalMagicDmg.toAdd + freshCharState.stats.magic * 16
        if(abilityAdditions.additionalMagicDmg.percent){
            magicDmg += magicDmg * abilityAdditions.additionalMagicDmg.percent
        }
        const totalDmg = Math.round(((skill.effects?.plusDmg || 0) + magicDmg) * powerScale)

        emitEnemyIsHit({
            playerId: freshCharState.owner,
            dmgDetails: { physicalDmg: totalDmg, weaponDmg: 0 },
            targetId: enemy._id,
            currentPlaceId: freshCharState.currentPlace.placeId,
        })
        registerSkillHitTarget(enemy, freshCharState)

        if(skill.enemyBind){
            emitEnemyBind({
                targetId: enemy._id,
                shape: skill.enemyBind.shape,
                bindDuration: skill.enemyBind.bindDuration,
                currentPlaceId: freshCharState.currentPlace.placeId,
            })
        }
    }
}

// resolves where the trap actually sits, on the ground - shared between
// castOffenseSkill's own pre-cast circle (so it blooms flat on the ground
// in the right spot from the very start of the cast, not the usual upright
// in-front-of-hand circle every other offense skill shows) and
// spawnGroundTrap itself once the trap actually deploys, so both land on
// the exact same spot instead of each computing it independently and
// risking a slight drift if the caster turns mid-cast.
function computeGroundTrapPos(charState, player, skill, forward){
    const distance = skill.groundTrap?.distance ?? GROUND_TRAP_DEFAULT_DISTANCE

    // horizontal-only direction, same reasoning triggerGroundSpikeLine's own
    // flatForward has - the trap sits ON the ground straight out from the
    // caster, shouldn't drift because their hand happened to be aimed
    // slightly up/down at cast time
    const flatForward = new Vector3(forward.x, 0, forward.z)
    if(flatForward.lengthSquared() < 0.0001) flatForward.set(0, 0, 1)
    flatForward.normalize()

    // same ground-height resolution triggerGroundSpikeLine/spawnGroundSpike
    // already use - flat-ground fallback (village/dungeon) vs per-point
    // terrain sampling (openworld's uneven ground). Origin is the caster's
    // own BODY position, not spawnPos (computeCastOrigin's hand-height,
    // already-offset-forward spawn point) - distance: 0 needs to land
    // exactly on the caster, not on wherever their hand happens to be.
    const isOpenworld = charState.currentPlace.placeId === OPENWORLD_PLACE_ID
    const originX = player.body.position.x
    const originZ = player.body.position.z
    const groundX = originX + flatForward.x * distance
    const groundZ = originZ + flatForward.z * distance
    const groundY = isOpenworld
        ? sampleTerrainSurfaceHeight(groundX, groundZ, OPENWORLD_TERRAIN_VERTS)
        : player.body.position.y - capsuleHeight / 2
    return new Vector3(groundX, groundY, groundZ)
}

function spawnGroundTrap(scene, charState, skill, groundPos, powerScale){
    const trapCfg = skill.groundTrap || {}
    const radius = getGroundTrapRadius(skill)
    const durationMs = trapCfg.duration ?? GROUND_TRAP_DEFAULT_DURATION_MS

    const circleImg = skill.magicCircleImg || ELEMENT_CIRCLES[skill.element] || ELEMENT_CIRCLES.normal
    createMagicCircle(groundPos, scene, circleImg, 0.8, durationMs, null, groundTrapCircleScale(radius))

    const box = MeshBuilder.CreateBox(`groundtrap_${skill.name}_${randNum(1000, 9999)}`, { width: radius * 2, height: 2, depth: radius * 2 }, scene)
    // centered a couple units up off the ground - an enemy's own body
    // origin sits at roughly its OWN mid-height (see createEnemy.js), so a
    // box hugging ground level would only catch very short enemies; this
    // comfortably overlaps a normal-height body walking through
    box.position.set(groundPos.x, groundPos.y + 1, groundPos.z)
    box.isVisible = false
    box.isPickable = false

    let hasTriggered = false
    // registered against whichever enemies exist right now - same accepted
    // "won't catch an enemy created after this point" tradeoff
    // fireElementalProjectile's own per-enemy trigger list already has (see
    // its own comment) - an ActionManager intersection trigger keeps
    // watching every frame though, so an enemy already on scene but far
    // away still gets caught correctly whenever it later wanders in, this
    // just can't register against something that doesn't exist yet
    const triggerCleanups = []
    const expireTimeout = setTimeout(() => {
        if(hasTriggered) return
        triggerCleanups.forEach(fn => fn())
        box.dispose()
    }, durationMs)

    getEnemiesOnScene().forEach(enemy => {
        if(!enemy.body) return
        const enterAction = onIntersecEnterTrig(box, enemy.body, scene, () => {
            if(hasTriggered) return
            // stale trigger against an enemy that's since died elsewhere -
            // same fresh liveness re-check fireElementalProjectile's own
            // hit loop already does
            if(!getEnemiesOnScene().some(e => e._id === enemy._id)) return
            hasTriggered = true
            clearTimeout(expireTimeout)
            triggerCleanups.forEach(fn => fn())
            box.dispose()
            applyDisintegrationHit(scene, charState, skill, enemy, powerScale, durationMs)
        })
        triggerCleanups.push(() => removeIntersecTrig(box, enterAction))
    })
}

// --- massivedisintegrationSkill's mass ground trap (skill.groundTrap.aoe,
// see skillsData.js and the branch in castOffenseSkill above) ---
// Same ground-rune circle as disintegrationSkill's own single-target trap
// above, sized to a much bigger radius (getGroundTrapRadius scales it with
// skill.lvl - see that function's own comment), but instead of waiting
// indefinitely for one enemy to walk into a small box trigger, this hits
// EVERY qualifying enemy at once: a brief beat after the circle blooms
// (MASS_TRAP_ACTIVATE_DELAY_MS - long enough to read as "the circle just
// activated", not an instant snap), it sweeps every enemy currently on
// scene and runs the exact same applyDisintegrationHit on anyone within
// radius, not just the first thing that wanders in.
const MASS_TRAP_ACTIVATE_DELAY_MS = 600

function spawnMassGroundTrap(scene, charState, skill, groundPos, powerScale){
    const trapCfg = skill.groundTrap || {}
    const radius = getGroundTrapRadius(skill)
    const durationMs = trapCfg.duration ?? GROUND_TRAP_DEFAULT_DURATION_MS

    const circleImg = skill.magicCircleImg || ELEMENT_CIRCLES[skill.element] || ELEMENT_CIRCLES.normal
    createMagicCircle(groundPos, scene, circleImg, 0.8, durationMs, null, groundTrapCircleScale(radius))

    setTimeout(() => {
        getEnemiesOnScene().forEach(enemy => {
            if(!enemy.body) return
            const dx = enemy.body.position.x - groundPos.x
            const dz = enemy.body.position.z - groundPos.z
            if((dx * dx + dz * dz) > radius * radius) return
            applyDisintegrationHit(scene, charState, skill, enemy, powerScale, durationMs)
        })
    }, MASS_TRAP_ACTIVATE_DELAY_MS)
}

// --- ENEMY-CAST SKILLS (det.skills, see tcp/recources/enemyDetails.ts -
// fireslime/electricslime) - the reverse direction of everything above: an
// ENEMY casting a player skill AT a player instead of a player casting one
// at an enemy. Reuses the same magic circle + PROJECTILE_STYLES/
// EXPLOSION_STYLES building blocks, but is its own pair of functions rather
// than a flag on fireElementalProjectile - the damage math is different
// (an enemy has no "magic" stat, no mana slider/powerScale to read), and
// most importantly the hit-detection direction is flipped (testing against
// the LOCAL player's own body, not iterating getEnemiesOnScene()).
//
// Multiplayer model (see createEnemy.js's own comment on the decision side
// of this): the DECISION of "should this enemy cast, at whom" is made by
// exactly one client (whichever player is currently closest) and relayed
// through the server as a plain broadcast (enemyWillCastSkill ->
// enemy-cast-skill, mirroring enemyWillAttack/enemy-attacked) - every
// connected client, including the one that made the decision, receives
// that broadcast and calls castEnemySkill below identically. The safety
// comes entirely from what happens NEXT, inside fireEnemySkillProjectile:
// every client renders the same circle/projectile (so it looks consistent
// to everyone watching), but only the client whose OWN character is the
// intended target ever registers a hit-test or calls deductHp - so no
// matter how many clients are watching this same broadcast, exactly one of
// them (the victim) can ever actually apply damage from it.
function computeEnemyCastOrigin(enemy, targetPos){
    const enemyPos = enemy.body.absolutePosition.clone()
    const spawnPos = enemyPos.add(new Vector3(0, (enemy.det?.bodyHeight ?? 1) * 0.6, 0))
    const forward = targetPos.subtract(spawnPos).normalize()
    return { spawnPos, forward }
}

// called by worldsocket.js's "enemy-cast-skill" listener, once per client,
// for every client watching - see the header comment above for why this is
// safe despite running identically everywhere.
export function castEnemySkill(scene, enemy, skill, targetPlayer){
    if(!enemy?.body || !targetPlayer?.body || !scene) return
    const targetOwner = targetPlayer.owner
    // aim toward bodytarget (createcharacter.js - a box parented to the
    // spine bone, roughly chest height) rather than the raw capsule body's
    // own position (its center, which sits much lower - closer to the
    // pelvis). This used to aim at body while fireEnemySkillProjectile's
    // hit-test checked against bodytarget instead - two different points -
    // so the blade would keep flying past chest height and only actually
    // register/stick once it dipped low enough to clip the target's lower
    // half. Aiming at the exact mesh being hit-tested fixes both at once.
    const aimPos = targetPlayer.bodytarget?.getAbsolutePosition() ?? targetPlayer.body.absolutePosition
    const { spawnPos, forward } = computeEnemyCastOrigin(enemy, aimPos)
    const circleImg = skill.magicCircleImg || ELEMENT_CIRCLES[skill.element] || ELEMENT_CIRCLES.normal

    createMagicCircle(spawnPos, scene, circleImg, 0.8, skill.castDuration * 1000 + 800, forward, CIRCLE_SIZE_SCALE)

    setTimeout(() => {
        // re-resolve the target at FIRE time, not cast-start time - same
        // "recomputed at impact, not activation" principle every other hit
        // calc in this file already follows, so a player who moved during
        // the cast window is aimed at from where they are NOW, not where
        // they stood when the circle first bloomed
        const liveTarget = getPlayersOnScene().find(pl => pl.owner === targetOwner)
        if(!liveTarget?.body) return
        const liveAimPos = liveTarget.bodytarget?.getAbsolutePosition() ?? liveTarget.body.absolutePosition
        const freshForward = liveAimPos.subtract(spawnPos).normalize()
        fireEnemySkillProjectile(scene, enemy, skill, spawnPos, freshForward, targetOwner)
    }, skill.castDuration * 1000)
}

const ENEMY_SKILL_PROJECTILE_TIMEOUT = 3000

function fireEnemySkillProjectile(scene, enemy, skill, spawnPos, forward, targetOwner){
    const itemId = `enemyskill_${skill.name}_${randNum(1000, 9999)}`
    // cached template + clone per cast, instead of a fresh MeshBuilder.CreateBox
    // every single time - same pattern creations/skills.js's own spawnProjectile
    // already uses for its "projectile" template, worth doing here too now
    // that enemies cast skills far more often (many more fireslime/
    // electricslime alive at once - see enemyDetails.ts)
    let mainBox = scene.getMeshByName("enemy_projectile")
    if(!mainBox){
        mainBox = MeshBuilder.CreateBox("enemy_projectile", { size: 0.7, depth: 0.5 }, scene)
        mainBox.isPickable = false
        mainBox.isVisible = false
        mainBox.position.y = -1000
    }
    // createInstance (shares mainBox's geometry buffer) instead of clone
    // (a full independent copy) - cheaper, and confirmed safe for
    // everything this box actually needs: position/rotation/isVisible/
    // setParent are all genuinely per-instance on InstancedMesh (verified
    // against @babylonjs/core/Meshes/instancedMesh.pure.js), and
    // onIntersecEnterTrig (this function's own hit-test) already works
    // fine against an instance elsewhere in this game (creations/skills.js's
    // spawnProjectile does the exact same box-instance-vs-bodytarget check).
    // One real trap for later though: InstancedMesh.material is a NO-OP
    // setter (silently warns instead of applying, same source file) - fine
    // today since flamebrand/lightningbolt (the only two skills any enemy
    // currently casts) both use projectileStyle "blade", which only ever
    // sets box.isVisible, never box.material (its own visual comes from a
    // separate child mesh). If an enemy is ever given a skill using
    // "lightning" or "halo" (the two styles that DO assign box.material
    // directly), that material would silently fail to apply here - swap
    // this back to .clone() first if that ever happens.
    const box = mainBox.createInstance(`enemy_projectile.${itemId}`, scene)
    box.position.copyFrom(spawnPos)
    box.isPickable = false

    const { cleanup: cleanupStyle, onHit } = renderGenericProjectile(scene, box, skill)

    if(!skill.projectileVisual?.silentLaunch){
        getAllSounds()[skill.projectileVisual?.launchSound || "fireBallS"]?.play()
    }

    const targetPoint = spawnPos.add(forward.scale(10))
    const dx = targetPoint.x - box.position.x
    const dy = targetPoint.y - box.position.y
    const dz = targetPoint.z - box.position.z
    box.rotation.y = Math.atan2(dx, dz)
    box.rotation.x = -Math.atan2(dy, Math.sqrt(dx * dx + dz * dz))

    const projectile = {
        itemId, body: box,
        targetDirection: { x: dx, y: dy+0.5, z: dz },
        spd: PROJECTILE_SPEED,
        placeId: enemy.det.currentPlaceId,
        stuck: false,
        willDetectSurface: false
    }
    pushProjectile(projectile)

    function cleanupProjectile(){
        cleanupStyle()
        removeProjectile(itemId)
    }

    let hasHit = false
    const missTimeout = setTimeout(() => {
        if(hasHit) return
        cleanupProjectile()
    }, ENEMY_SKILL_PROJECTILE_TIMEOUT)

    // registered on EVERY client watching now, not just the intended
    // victim - was gated to `targetOwner === charState.owner` before
    // anything here even ran, so every OTHER client watching the same
    // broadcast never registered a hit-test at all: the projectile just
    // flew past and silently timed out on their own screen, never visually
    // landing/sticking into the target - only the actual victim's own
    // client ever saw the "blade" style's stick-in-chest effect. The
    // visual impact (explosion, impact sound, hit reaction, stick-to-body)
    // needs to be consistent for everyone in the scene; only the actual
    // DAMAGE APPLICATION stays restricted to the victim's own client
    // further down - deductHp reads/writes THIS client's own local
    // characterState, so running it for anyone other than the real target
    // would incorrectly hurt THEIR OWN character instead.
    const targetPlayer = getPlayersOnScene().find(pl => pl.owner === targetOwner)
    // bodytarget (createcharacter.js) - a small mesh parented to the
    // player's own spine bone, not the whole capsule body - same hit
    // volume creations/skills.js's spawnProjectile ("throw weapon") already
    // tests against for its own stick-in-target behavior, reused here so a
    // "blade" style skill can setParent() into it below for an identical
    // "stuck in your chest" look. If the target isn't on THIS client's own
    // scene at all (different place, not loaded yet), there's nothing to
    // visually stick to here - the projectile just times out normally via
    // missTimeout above.
    if(!targetPlayer?.bodytarget) return

    const enterAction = onIntersecEnterTrig(box, targetPlayer.bodytarget, scene, async () => {
        if(hasHit) return
        hasHit = true
        clearTimeout(missTimeout)
        removeIntersecTrig(box, enterAction)

        // onHitVisual.stickBriefly skills (weapon-shaped: blade/bladecross/
        // spearlance/shadowblade family) - play the actual "got struck"
        // reaction (animation + a struckS play spatially re-attached to
        // bodytarget, so it audibly comes from the target's own body rather
        // than wherever struckS last played from) before the generic impact
        // sound/explosion/damage below. targetPlayer's own characterAnimations
        // (not necessarily "my own character" anymore) - this now plays the
        // right person's own reaction animation whether targetPlayer is this
        // client's own character or someone else's being watched.
        if(skill.onHitVisual?.stickBriefly){
            targetPlayer.characterAnimations?.playAction(targetPlayer.anims, "hit_struct1", 1)
            getAllSounds().struckS?.attachToMesh(targetPlayer.bodytarget)
            // bloodps (createcharacter.js) - createBloodSplatter's own
            // returned shape is { ps, play(stopDelay) }, not a start()
            // method directly - play() already does exactly "start, then
            // auto-stop after a burst window" (default 1000ms), which is
            // exactly what a one-shot splatter on getting hit should do
            targetPlayer.bloodps?.play()
        }

        playImpactSound(skill)
        // onHit (renderGenericProjectile's own return) owns the actual burst/
        // stick dispatch from here - stickBriefly skills embed into the
        // target's bodytarget for MARKER_STICK_DURATION_MS instead of
        // vanishing on impact, everything else cleans up immediately.
        // targetPlayer has no `.body` (players use `.bodytarget` for this
        // exact stick point, not the whole capsule body an enemy uses) - a
        // thin { body: targetPlayer.bodytarget } wrapper lets the same
        // generic onHit function work against either shape uniformly.
        onHit({ body: targetPlayer.bodytarget }, cleanupProjectile, projectile)

        // damage/death and camera shake are local-feedback-only from here
        // on - only the actual victim's own client should ever apply
        // damage to their own characterState, or feel their own screen
        // shake from getting hit. Every other client watching stops here,
        // having already done everything they needed to (the visual hit
        // above).
        const charState = getCharState()
        if(!charState || targetOwner !== charState.owner) return

        const sceneDet = getSceneDet()
        if(sceneDet?.scene?.activeCamera) camShake(sceneDet.scene, sceneDet.scene.activeCamera, .01, true)

        // no "magic stat" to scale off for an enemy caster (unlike the
        // player-cast version above) - just the skill's own plusDmg plus a
        // small bump from the enemy's own magDmg stat, matching how
        // emitAttack's melee damage reads straight off detail.stats.dmg
        // with no separate scaling layer either
        const totalDmg = Math.round((skill.effects?.plusDmg || 0) + (enemy.det.stats?.magDmg || 0) * 20)
        const isDead = await deductHp(totalDmg, enemy.det.effects || [])
        if(isDead) emitDied()
    })
}
