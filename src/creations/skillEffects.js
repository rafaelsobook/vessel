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
import { spawnProjectile } from "./skills.js"
import { createGlowingMat, fresnelMat } from "../tools/materials.js"
import { addGlow } from "../tools/glow.js"
import { attachLightning } from "../effects/lightning.js"
import { createSimplex } from "../tools/noise.js"
import { displaceWithNoise } from "../assetcreation/createRock.js"
import { getEnemiesOnScene, getPlayersOnScene, getSocketContainers, pushProjectile, removeProjectile } from "../sockets/worldsocket.js"
import { onIntersecEnterTrig, removeIntersecTrig } from "../components/actionManager.js"
import { emitEnemyIsHit, emitEnemyBind, emitEnemyCurse, emitDied } from "../sockets/emits.js"
import { getAdditionalsFromAbilities, getCharState, deductHp, updateHpMpSp_UI, updateMyDetailsOL } from "../charactersystem/characterstate.js"
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

// PROJECTILE_STYLES.icon's own material - one shared instance PER SKILL
// NAME, cached persistently, not per-cast like halo/crystalshard/etc's own
// materials. Those each need an INDEPENDENT material because they animate
// their own per-cast state (halo's spin, magic circles' fade) - a plain
// static texture has no such state to protect, so every cast of the same
// skill can safely reuse one material/texture pair forever instead of
// decoding ./images/projectiles/${skill.name}projectile.webp again each
// time. Same "shared, fixed look never varies per cast" reasoning
// getGroundSpikeMat already uses, just keyed per skill instead of a single
// fixed material.
const iconMatCache = new Map()
let iconMatCacheScene = null
function getIconMat(scene, skill){
    if(iconMatCacheScene !== scene){
        iconMatCache.clear()
        iconMatCacheScene = scene
    }
    let mat = iconMatCache.get(skill.name)
    if(!mat){
        mat = new StandardMaterial(`icon_mat_${skill.name}`, scene)
        const tex = new Texture(`./images/projectiles/${skill.name}projectile.webp`, scene)
        // same technique magiccircles.js's own createMagicCircle uses
        // (getCircleTexture's "rgb" alpha mode) - alpha DERIVED FROM RGB
        // LUMINANCE, not the image's own embedded alpha channel. A first
        // version used tex.hasAlpha (trusts the file's real alpha channel)
        // + useAlphaFromDiffuseTexture, which rendered the icon's black
        // background as solid black instead of transparent - these skill
        // icons apparently don't carry a real alpha channel the same way
        // circle textures don't either, which is exactly why every magic
        // circle already routes around this the same way.
        tex.getAlphaFromRGB = true
        // emissive + opacityTexture only (no diffuseTexture) - same pairing
        // createMagicCircle uses, reads as a glowing/self-lit icon
        // regardless of scene lighting instead of a flatly shaded image
        mat.emissiveTexture = tex
        mat.opacityTexture = tex
        mat.emissiveColor = new Color3(1, 1, 1)
        mat.backFaceCulling = false
        mat.specularColor = new Color3(0, 0, 0)
        
        iconMatCache.set(skill.name, mat)
    }
    return mat
}

// PROJECTILE_STYLES.beam's own material (tidalspikeSkill) - one shared
// instance, cached persistently, same "shared, fixed look never varies per
// cast" reasoning getIconMat above already uses. Safe to share even though
// beam length varies per cast: the texture itself isn't tiled/scaled per
// instance (it just stretches to fit whatever width the plane mesh itself
// is given), so nothing about this material actually differs cast to cast.
let beamMat = null
let beamMatScene = null
// units of texture-length scrolled per second - tuned so the current
// pattern reads as flowing steadily along the beam's length, not a slow
// crawl or a blur
const BEAM_SCROLL_SPEED = 0.6
function getBeamMat(scene){
    if(!beamMat || beamMatScene !== scene){
        beamMat = new StandardMaterial("beam_mat_watercurrent", scene)
        const tex = new Texture("./images/projectiles/watercurrent.webp", scene)
        // same getAlphaFromRGB technique getIconMat/createMagicCircle both
        // already use - alpha derived from RGB luminance, not a real alpha
        // channel in the file
        tex.getAlphaFromRGB = true
        // tiled (not clamped) along U so scrolling it wraps seamlessly
        // instead of dragging the same single copy off the edge into
        // nothing - U, not V, since CreatePlane's own width axis (the
        // beam's actual length) maps to U (V wraps the plane's short/
        // thickness axis instead)
        tex.wrapU = Texture.WRAP_ADDRESSMODE
        tex.uScale = 4
        beamMat.diffuseTexture = tex
        beamMat.emissiveTexture = tex
        beamMat.opacityTexture = tex
        beamMat.emissiveColor = new Color3(1, 1, 1)
        beamMat.backFaceCulling = false
        beamMat.specularColor = new Color3(0, 0, 0)
        beamMatScene = scene

        // continuously scrolls the water-current pattern along the beam's
        // own length so it reads as flowing water instead of a static
        // decal - registered ONCE here (not per-cast), tied to this shared
        // material/texture's own lifetime, same as createFireParticles' own
        // persistent flicker loop (particlesystem.js) - cleaned up
        // implicitly whenever the scene itself is disposed (main.js's
        // changeScene()), no separate teardown needed since every active
        // beam mesh shares this exact same texture object anyway.
        // U=0 sits at startPos (the caster) and U=1 at endPos (the target) -
        // see CreatePlaneVertexData's own corner/UV layout and the beam's
        // own alignment (local +X, i.e. increasing U, rotated to point
        // along dir, which points caster->target). Decrementing uOffset
        // (not incrementing) is what makes the pattern read as flowing
        // onward toward the target instead of back toward the caster.
        scene.onBeforeRenderObservable.add(() => {
            tex.uOffset -= (scene.getEngine().getDeltaTime() / 1000) * BEAM_SCROLL_SPEED
        })
    }
    return beamMat
}

// PROJECTILE_STYLES.beam's own impact splash (tidalspikeSkill) - a burst of
// particles (not a single mesh - see spawnSplashBurst's own header comment
// for why) at the enemy's own hit position, using splash.png as every
// particle's own sprite. Cached persistently, same reasoning every other
// texture cache in this file already uses - a small, fixed asset, no
// reason to decode it fresh every single cast.
let splashParticleTex = null
let splashParticleTexScene = null
function getSplashParticleTex(scene){
    if(!splashParticleTex || splashParticleTexScene !== scene){
        splashParticleTex = new Texture("./images/projectiles/splash.png", scene)
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
function spawnSplashBurst(scene, position){
    const SPLASH_PARTICLE_COUNT = 40
    const particles = new ParticleSystem(`tidalspike_splash_${Date.now()}`, SPLASH_PARTICLE_COUNT, scene)
    particles.particleTexture = getSplashParticleTex(scene)
    particles.blendMode = ParticleSystem.BLENDMODE_ADD

    particles.emitter = position.clone()
    particles.minEmitBox = Vector3.Zero()
    particles.maxEmitBox = Vector3.Zero()
    particles.createSphereEmitter(0.4, 0.7)

    particles.color1 = new Color4(1, 1, 1, 1)
    particles.color2 = new Color4(1, 1, 1, 1)
    particles.colorDead = new Color4(0, 0, 1, 0.2)

    particles.addSizeGradient(0.05, 0.1)
    particles.addSizeGradient(1.1, 1.9)

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
function spawnSplashHover(scene, position){
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

    particles.addSizeGradient(0, 0.05)
    particles.addSizeGradient(1, 1.0)

    particles.minLifeTime = 0.5
    particles.maxLifeTime = 0.9
    particles.emitRate = 5
    particles.disposeOnStop = false // the caller owns disposal on its own timer, not the particle system itself

    particles.start()
    return particles
}

// --- projectile visuals ---
// fn(scene, box, skill) => cleanup() - called once the projectile despawns
// (hit or miss) to stop/dispose whatever this style attached to it.
const PROJECTILE_STYLES = {
    // the skill's own dedicated projectile texture
    // (./images/projectiles/${skill.name}projectile.webp), flying as a flat
    // glowing plane instead of a shaped/colored projectile -
    // maelstromboltSkill is the first to use this (projectileStyle: "icon"),
    // but any skill can opt in the same way, since the texture path is
    // derived from the skill's own name rather than hardcoded. Not
    // billboarded - an earlier version billboarded it (always facing
    // camera) with a continuous rotation.z spin on top, which read as a
    // flat disc spinning face-on to the camera the whole time ("a flying
    // pizza") rather than something flying forward - static/no spin now,
    // just carried by box's own aim rotation like every other projectile
    // shape in this file.
    icon(scene, box, skill){
        box.isVisible = false
        // width:height matches maelstromboltprojectile.webp's own real
        // pixel dimensions (705x1254, confirmed via its VP8 header) so the
        // splash texture doesn't stretch/squash to fit a square plane -
        // a future skill adopting this same "icon" style with a
        // differently-shaped texture would need its own geometry key here
        // instead of reusing this one, since getShapeClone's cache is keyed
        // by shape, not by skill
        const plane = getShapeClone(scene, "icon_plane", () => MeshBuilder.CreatePlane("icon_plane_template", { width: 1, height: 1254 / 705 }, scene))
        plane.parent = box
        plane.position = Vector3.Zero()
        plane.isPickable = false
        // CreatePlane's own front face points -Z by default (see
        // createMagicCircle's identical comment) - box's own aim rotation
        // points its forward at +Z, so without this the icon's readable
        // face would point back toward the caster instead of the direction
        // it's actually flying
        // plane.rotation.y = Math.PI
        // one-time static correction (not animated/continuous) for the
        // projectile texture's own content orientation
        plane.rotation.x = Math.PI / 2
        plane.material = getIconMat(scene, skill)
        plane.scaling = new Vector3(1, 1, 1).scale(skill.projectileScale ?? 1)

        // every other shaped projectile style in this file (crystalshard,
        // twinhalo, lightorb, boxcross, darkorb...) calls addGlow on its own
        // mesh - this one didn't, which is why it read flat/dim instead of
        // the same glowing look everything else has despite emissiveTexture
        // already being set
        addGlow(scene, plane, 0.6)

        // (false, false) - material/texture are the shared persistent
        // cache above, not owned by this one clone
        return () => plane.dispose(false, false)
    },
    // fully invisible - no mesh, no particle trail, no launch sound either
    // (see fireElementalProjectile's launch-sound special-case below). Used
    // by skill.swordRain skills (astralrainSkill) - this box is purely a
    // targeting marker, never meant to be seen or heard flying through the
    // air. Box already defaults to invisible before any style runs, but this
    // is spelled out explicitly rather than left to fall through to "bolt"'s
    // default (which WOULD spawn a visible particle trail).
    marker(scene, box, skill){
        box.isVisible = false
        return () => {}
    },
    // tidalspikeSkill's own look - the projectile itself stays fully
    // invisible for its entire flight (box never turns visible, nothing
    // attached to it - same "marker" convention above), and only on actual
    // impact does a glowing plane snap into existence, spanning from the
    // caster's own position to wherever it hit, like a lance of water
    // connecting the two instantly rather than something that visibly flew
    // the distance. (A CreateCylinder version was tried in between - real
    // volume instead of a flat plane, stays visible from any angle - but
    // went back to a plane.) startPos is captured HERE, at style-setup
    // time - box.position already equals spawnPos by the time any style
    // function runs (fireElementalProjectile sets it just before calling
    // this), which is the caster's own hand position at the moment this
    // projectile launched - close enough to "starts from my character"
    // without this style needing charState/player threaded in just for
    // this one style.
    //
    // {cleanup, onHit} shape (not a plain function) - same darkorb uses -
    // is what makes fireElementalProjectile's hit handler skip the generic
    // EXPLOSION_STYLES burst entirely and defer to this style's own impact
    // visual instead (see that handler's own onHitStyle branch).
    beam(scene, box, skill){
        box.isVisible = false
        const startPos = box.position.clone()

        return {
            cleanup(){}, // nothing else was ever created during flight - the invisible box itself is disposed by the caller regardless
            onHit(enemy, finishCleanup){
                if(!enemy?.body){ finishCleanup(); return }
                const endPos = enemy.body.position.clone()
                const dir = endPos.subtract(startPos)
                const dist = dir.length()
                if(dist < 0.001){ finishCleanup(); return }
                dir.normalize()

                const BEAM_THICKNESS = 0.5
                const beamMesh = MeshBuilder.CreatePlane(`tidalspike_beam_${Date.now()}`, { width: dist, height: BEAM_THICKNESS }, scene)
                beamMesh.position = Vector3.Lerp(startPos, endPos, 0.5)
                beamMesh.isPickable = false

                // aligns the plane's own local +X axis (its width axis,
                // matching CreatePlane's own width/height convention) to
                // point along dir - axis-angle rotation derived from the
                // cross/dot product between the reference axis and the
                // actual travel direction, since dir is a fully arbitrary
                // 3D vector (not just a flat horizontal yaw like every
                // other style's box.rotation.y aim)
                const referenceAxis = new Vector3(1, 0, 0)
                const rotationAxis = Vector3.Cross(referenceAxis, dir)
                if(rotationAxis.lengthSquared() < 0.0001){
                    beamMesh.rotationQuaternion = Vector3.Dot(referenceAxis, dir) < 0
                        ? Quaternion.RotationAxis(Vector3.Up(), Math.PI)
                        : Quaternion.Identity()
                } else {
                    const angle = Math.acos(Math.min(1, Math.max(-1, Vector3.Dot(referenceAxis, dir))))
                    beamMesh.rotationQuaternion = Quaternion.RotationAxis(rotationAxis.normalize(), angle)
                }

                beamMesh.material = getBeamMat(scene)
                addGlow(scene, beamMesh, 0.6)

                // second plane, same position/alignment, rolled 90° around
                // the beam's own length axis (dir) - a single flat plane
                // can go edge-on and all but vanish depending on camera
                // angle (e.g. looking straight down from above), same
                // problem boxcross/twinhalo elsewhere in this file already
                // solve by crossing two planes instead of relying on one.
                // .clone() carries over beamMesh's position AND its
                // rotationQuaternion (see getShapeClone's own comment on
                // this exact behavior) - only the extra local-X roll needs
                // adding on top, not the whole alignment redone from scratch.
                const beamMesh2 = beamMesh.clone(`tidalspike_beam2_${Date.now()}`)
                beamMesh2.rotationQuaternion = beamMesh.rotationQuaternion.multiply(Quaternion.RotationAxis(new Vector3(1, 0, 0), Math.PI / 2))
                addGlow(scene, beamMesh2, 0.6)
                // playImpactSound already ran unconditionally, before the
                // caller ever checks onHitStyle - not called again here

                // impact splash - a burst of particles at the enemy's own
                // hit position (not spanning the distance like the beam).
                // Two earlier versions tried this as a single mesh (a
                // billboarded plane, then a vertex-displaced "wiggling"
                // plane) - a real particle burst reads as an actual splash
                // of water flying outward far more directly than either.
                const endSplashParticles = spawnSplashBurst(scene, endPos)
                // spawnSplashHover (not spawnSplashBurst) at the ORIGIN end
                // (startPos) - the beam mesh itself just starts abruptly
                // with a hard, straight cut edge right there (visible
                // in-game as a sharp line beginning near the caster's
                // hand), this covers that seam - but this is water welling
                // up at the SOURCE, not an impact, so it stays put in one
                // spot at a low emitRate instead of bursting outward
                const startSplashParticles = spawnSplashHover(scene, startPos)

                const BEAM_LINGER_MS = 3000
                setTimeout(() => {
                    // (false) - both particle systems' own particleTexture
                    // is getSplashParticleTex's shared persistent cache,
                    // not owned by either instance - same "don't dispose
                    // the shared texture out from under every other active
                    // instance" reasoning every particle cleanup in this
                    // file already follows (see e.g. spawnGroundTrap's own
                    // burnParticles.dispose(false))
                    endSplashParticles.dispose(false)
                    startSplashParticles.dispose(false)
                    // (false, false) - beamMesh's own material is
                    // getBeamMat's shared persistent cache, not owned by
                    // this one cast - (false, true) here disposed the
                    // shared material itself the first time any beam ever
                    // despawned, leaving every cast after that handing out
                    // a reference to an already-disposed material (nothing
                    // rendered - the "only appears once" bug this was)
                    beamMesh.dispose(false, false)
                    beamMesh2.dispose(false, false)
                    finishCleanup()
                }, BEAM_LINGER_MS)
            }
        }
    },
    // particle trail, box stays invisible - the default look. skill.particleStyles
    // ([{name, color}, ...], see tools/particlesystem.js's createParticleSystem)
    // picks the trail's shape; falls back to a plain colored "oneline" streak.
    bolt(scene, box, skill){
        const styles = skill.particleStyles ?? [{ name: "oneline", color: skill.explosionColor || "blue" }]
        const systems = createParticleSystem(scene, box, styles)
        // dispose(false) - particleTexture is particlesystem.js's own
        // shared/persistent texture cache now, not owned by this one
        // system; disposing it here would evict it for every OTHER trail/
        // burst currently using the same sprite
        return () => systems.forEach(ps => { ps.stop(); ps.dispose(false) })
    },
    // a tiny glowing sword flies out instead of a bolt - reuses createWeapon's
    // own glow support (the same one equipped weapons/thrown projectiles use)
    // rather than building a new glowing-mesh system from scratch. Starts
    // with no arcs at all - skill.arcCount (skillUpgrades.js's growArcAura)
    // UNLOCKS them partway through leveling instead of just growing an
    // already-crackling blade, since this style never had any to begin with.
    blade(scene, box, skill){
        box.isVisible = false
        const bladeRoot = createWeapon(scene, "sword", { x: 0, y: 0, z: 0 }, box, null, {
            bladeRarity: "rare2", guardRarity: "rare1", handleRarity: "common1", pommelRarity: "common1",
        }, skill.explosionColor || "blue")
        bladeRoot.scaling = new Vector3(0.12, 0.12, 0.12).scale(skill.projectileScale ?? 1)
        bladeRoot.addRotation(Math.PI, 0, Math.PI / 2) // tip-forward instead of a flat sideways blade
        if((skill.arcCount ?? 0) > 0){
            attachLightning(scene, bladeRoot, skill.explosionColor || "blue", false, { arcCount: skill.arcCount, width: 0.015, updateInterval: 90, withLight: false })
        }
        // (false, true) = recurse into the 4 part meshes (and the arcs, if
        // any) AND dispose each one's own material/texture along with it -
        // Mesh/Node.dispose()'s disposeMaterialAndTextures param defaults
        // to false, so a plain bladeRoot.dispose() was leaving every part's
        // material (createGlowingMat, a fresh instance per cast, never
        // shared - safe to free) behind every single time this skill fired.
        return () => bladeRoot.dispose(false, true)
    },
    // stoneshardSkill's own look (see its own projectileStyle in
    // skillsData.js) - monolith/orangelith casts this exact skill (tcp/
    // generate-datas/genenemy.ts's monolithBase.skills), where a tiny sword
    // read as an odd fit for what's meant to be an insect-like sting
    // attack. A thin glowing cone/needle instead - own separate style key,
    // not a change to the shared "blade" style itself, so flamebrand/
    // tidalspike/lightningbolt (the other 3 skills still using "blade")
    // are untouched.
    sting(scene, box, skill){
        box.isVisible = false
        const sting = getShapeClone(scene, "sting_projectile", () => MeshBuilder.CreateCylinder("sting_projectile_template", { diameterTop: 0, diameterBottom: 0.15, height: 0.9, tessellation: 10 }, scene))
        sting.parent = box
        sting.position = Vector3.Zero()
        sting.isPickable = false
        // cone's own local apex points +Y by default (diameterTop: 0) -
        // rotating 90° around X tips it to point along +Z instead, matching
        // box's own forward-aim rotation (fireElementalProjectile's atan2
        // math above) without needing bladeRoot's extra corrective
        // rotations (those exist to fix up an AUTHORED weapon asset's own
        // default orientation quirks - this cone has none, I built it)
        sting.rotation.x = Math.PI / 2
        sting.scaling = new Vector3(1, 1, 1).scale(skill.projectileScale ?? 1)
        sting.material = createGlowingMat(scene, skill.explosionColor || "green")
        return () => sting.dispose(false, true)
    },
    // dark - shadowboltSkill's own distinct look: the FULL assembled spear
    // (blade+guard+handle+pommel via createWeapon, same "spearlance" above
    // already uses successfully) instead of just the bare blade piece alone -
    // a single part with no guard/handle/pommel read as an unrecognizable
    // abstract chevron shape rather than an actual weapon silhouette.
    // fresnelMat (translucent hollow-shell look, tools/materials.js)
    // applied over all 4 parts uniformly, one shared material instance,
    // instead of createWeapon's own glowingColor path (a flat
    // createGlowingMat) - see that function's own comment.
    shadowblade(scene, box, skill){
        box.isVisible = false
        const spearOptions = { bladeRarity: "rare1", guardRarity: "rare1", handleRarity: "rare1", pommelRarity: "rare1" }
        // no glowingColor (7th arg) - createWeapon would assign a flat
        // createGlowingMat per part otherwise; material gets overridden
        // with fresnelMat uniformly below instead
        const spearRoot = createWeapon(scene, "spear", { x: 0, y: 0, z: 0 }, box, null, spearOptions)
        // 0.16 - same scale spearlance already uses for this exact asset.
        // The bare-blade attempt this replaced used 1 (no scale-down at
        // all) - full weapon-asset size, which is what actually made it
        // look "not properly positioned": not a location bug, just so much
        // bigger than every other projectile style's own 0.1-0.5 range
        // that it read as a huge shape floating apart from the caster
        // rather than a small thing flying from them.
        spearRoot.scaling = new Vector3(0.16, 0.16, 0.16).scale(skill.projectileScale ?? 1)
        // same tip-forward formula "blade"/"spearlance" both use for their
        // own weapon-derived projectiles
        spearRoot.addRotation(Math.PI, 0, Math.PI / 2)
        const spearMat = fresnelMat(scene, "purple")
        spearRoot.getChildMeshes().forEach(part => {
            part.material = spearMat
            addGlow(scene, part, 0.6)
        })
        if((skill.arcCount ?? 0) > 0){
            attachLightning(scene, spearRoot, "purple", false, { arcCount: skill.arcCount, width: 0.015, updateInterval: 90, withLight: false })
        }
        // (false, true) recurses into all 4 part meshes (and the arcs, if
        // any) and disposes their material along with them - all 4 parts
        // share the SAME spearMat instance, so this only actually frees it
        // once (Material.dispose() is safely idempotent against being
        // called more than once, same reasoning already established for
        // "bladecross"/"twinhalo"/"boxcross" above, each of which also
        // disposes more than one mesh sharing/holding its own material)
        return () => spearRoot.dispose(false, true)
    },
    // a small glowing core wrapped in crackling arcs - attachLightning
    // already handles both the arcs AND making the mesh itself glow
    // (weaponGlow: true), see effects/lightning.js
    lightning(scene, box, skill){
        box.isVisible = true
        box.scaling = new Vector3(0.4, 0.4, 0.4).scale(skill.projectileScale ?? 1)
        box.material = createGlowingMat(scene, skill.explosionColor || "white")
        // voidrendSkill only - lightpierceSkill shares this same "lightning"
        // style but doesn't get this
        if(skill.name === "voidrend") box.showBoundingBox = true
        attachLightning(scene, box, skill.explosionColor || "white", true, { arcCount: skill.arcCount ?? 3, width: 0.025, updateInterval: 60 })
        // no manual dispose here - attachLightning already wires its own
        // teardown to box.onDisposeObservable (addOnce), which fires when
        // removeProjectile() disposes the box right after this cleanup runs.
        // Calling bolt.dispose() here too would double-dispose the arcs/
        // light/material a second time when that observable then fires.
        return () => {}
    },
    // a spinning halo/ring instead of a glowing box - radiantjudgment's own
    // projectile style (it already gets the special "divine1" magic circle;
    // this carries the same "divine judgment descending" read into the
    // projectile itself). Same crackling-arcs-plus-glow treatment as
    // "lightning" above, attachLightning(weaponGlow: true) applies both the
    // material/glow AND the arcs to the torus in one call, just built from a
    // torus instead of a box.
    halo(scene, box, skill){
        box.isVisible = false
        const halo = getShapeClone(scene, "torus_halo", () => MeshBuilder.CreateTorus("torus_halo_template", { diameter: 0.55, thickness: 0.09, tessellation: 24 }, scene))
        halo.parent = box
        halo.position = Vector3.Zero()
        halo.isPickable = false
        halo.scaling = new Vector3(1, 1, 1).scale(skill.projectileScale ?? 1)
        attachLightning(scene, halo, skill.explosionColor || "white", true, { arcCount: skill.arcCount ?? 3, width: 0.02, updateInterval: 60 })

        // spins face-on as it flies instead of just sitting there
        const spinObserver = scene.onBeforeRenderObservable.add(() => { halo.rotation.z += 0.12 })
        return () => {
            scene.onBeforeRenderObservable.remove(spinObserver)
            // attachLightning's own arcs/light/mat teardown is wired to
            // halo.onDisposeObservable, fires from this either way - (false,
            // true) additionally frees halo's OWN material (createGlowingMat,
            // set inline by attachLightning's weaponGlow:true), which a plain
            // .dispose() would otherwise leave behind every cast
            halo.dispose(false, true)
        }
    },

    // --- God Tier styles (skillrank 4, see skillsData.js) - each element
    // pair gets its own distinct shape instead of reusing plain "lightning"'s
    // glowing box, all still wrapped in the same crackling-arc treatment.
    // weaponGlow is deliberately false on every attachLightning call below -
    // true would flatten every child mesh's material to a flat glow color,
    // wiping out createWeapon's own part materials/glow (bladecross/
    // spearlance) or this style's own hand-set material (crystalshard/
    // twinhalo/boxcross); false only adds the arc tubes around the shape,
    // untouched otherwise. No light (withLight: false) on any of them -
    // every hit already spawns its own EXPLOSION_STYLES burst with a real
    // light-adjacent glow; a PointLight per in-flight projectile on top of
    // that adds up fast with several God Tier casts on screen at once.

    // fire - two glowing sword blades (reused from allweapons/createWeapon,
    // the same part-mesh system equipped swords use) crossed into an X,
    // spinning as one unit
    bladecross(scene, box, skill){
        box.isVisible = false
        const root = new TransformNode(`bladecross_${skill.name}_${Date.now()}`, scene)
        root.parent = box

        const bladeOptions = { bladeRarity: "rare2", guardRarity: "rare1", handleRarity: "common1", pommelRarity: "common1" }
        const bladeA = createWeapon(scene, "sword", { x: 0, y: 0, z: 0 }, root, null, bladeOptions, skill.explosionColor || "red")
        bladeA.scaling = new Vector3(0.1, 0.1, 0.1).scale(skill.projectileScale ?? 1)
        bladeA.addRotation(Math.PI, 0, Math.PI / 4)
        const bladeB = createWeapon(scene, "sword", { x: 0, y: 0, z: 0 }, root, null, bladeOptions, skill.explosionColor || "red")
        bladeB.scaling = new Vector3(0.1, 0.1, 0.1).scale(skill.projectileScale ?? 1)
        bladeB.addRotation(Math.PI, 0, -Math.PI / 4)

        const spinObserver = scene.onBeforeRenderObservable.add(() => { root.rotation.z += 0.05 })
        attachLightning(scene, root, skill.explosionColor || "red", false, { arcCount: skill.arcCount ?? 2, width: 0.015, updateInterval: 90, withLight: false })
        return () => {
            scene.onBeforeRenderObservable.remove(spinObserver)
            // recurses into both blades' part meshes and the arcs; (false,
            // true) also frees each part's own material along with them
            root.dispose(false, true)
        }
    },

    // water - a single spear (also from allweapons - spear only exists at
    // one part-tier, see swordsdata.js's stormpiercer) flying point-first
    spearlance(scene, box, skill){
        box.isVisible = false
        const spearOptions = { bladeRarity: "rare1", guardRarity: "rare1", handleRarity: "rare1", pommelRarity: "rare1" }
        const spearRoot = createWeapon(scene, "spear", { x: 0, y: 0, z: 0 }, box, null, spearOptions, skill.explosionColor || "blue")
        spearRoot.scaling = new Vector3(0.16, 0.16, 0.16).scale(skill.projectileScale ?? 1)
        // same tip-forward formula as PROJECTILE_STYLES.blade above - spear's
        // own default orientation hasn't been visually verified against this
        // (no live render pass was possible), may need adjusting once seen
        spearRoot.addRotation(Math.PI, 0, Math.PI / 2)
        attachLightning(scene, spearRoot, skill.explosionColor || "blue", false, { arcCount: skill.arcCount ?? 2, width: 0.015, updateInterval: 90, withLight: false })
        return () => spearRoot.dispose(false, true)
    },

    // earth - a jagged glowing crystal shard (MeshBuilder.CreatePolyhedron,
    // type 3 = icosahedron - a many-faceted, rock-like silhouette instead of
    // a smooth primitive), tumbling irregularly on all three axes rather
    // than spinning cleanly like everything else here
    crystalshard(scene, box, skill){
        box.isVisible = false
        const shard = getShapeClone(scene, "polyhedron_shard", () => MeshBuilder.CreatePolyhedron("polyhedron_shard_template", { type: 3, size: 0.22 }, scene))
        shard.parent = box
        shard.isPickable = false
        shard.scaling = new Vector3(1, 1, 1).scale(skill.projectileScale ?? 1)
        shard.material = createGlowingMat(scene, skill.explosionColor || "green")
        addGlow(scene, shard, 0.5)

        const spinObserver = scene.onBeforeRenderObservable.add(() => {
            shard.rotation.x += 0.04
            shard.rotation.y += 0.07
            shard.rotation.z += 0.02
        })
        attachLightning(scene, shard, skill.explosionColor || "green", false, { arcCount: skill.arcCount ?? 2, width: 0.015, updateInterval: 100, withLight: false })
        return () => {
            scene.onBeforeRenderObservable.remove(spinObserver)
            shard.dispose(false, true) // also frees shard.material (createGlowingMat)
        }
    },

    // light - two tori crossed perpendicular (a gyroscope/aegis read),
    // each spinning on its own independent axis - distinct from "halo"
    // (radiantjudgment's single flat ring)
    twinhalo(scene, box, skill){
        box.isVisible = false
        const root = new TransformNode(`twinhalo_${skill.name}_${Date.now()}`, scene)
        root.parent = box
        root.scaling = new Vector3(1, 1, 1).scale(skill.projectileScale ?? 1) // scales both rings together

        const ringA = getShapeClone(scene, "torus_twinhalo", () => MeshBuilder.CreateTorus("torus_twinhalo_template", { diameter: 0.45, thickness: 0.05, tessellation: 24 }, scene))
        ringA.parent = root
        ringA.isPickable = false
        ringA.material = createGlowingMat(scene, skill.explosionColor || "white")
        addGlow(scene, ringA, 0.5)

        const ringB = getShapeClone(scene, "torus_twinhalo", () => MeshBuilder.CreateTorus("torus_twinhalo_template", { diameter: 0.45, thickness: 0.05, tessellation: 24 }, scene))
        ringB.parent = root
        ringB.isPickable = false
        ringB.rotation.y = Math.PI / 2 // perpendicular to ringA
        ringB.material = createGlowingMat(scene, skill.explosionColor || "white")
        addGlow(scene, ringB, 0.5)

        const spinObserver = scene.onBeforeRenderObservable.add(() => {
            ringA.rotation.z += 0.03
            ringB.rotation.x += 0.045
        })
        attachLightning(scene, root, skill.explosionColor || "white", false, { arcCount: skill.arcCount ?? 2, width: 0.015, updateInterval: 90, withLight: false })
        return () => {
            scene.onBeforeRenderObservable.remove(spinObserver)
            root.dispose(false, true) // also frees ringA/ringB's own separate materials (createGlowingMat, two of them)
        }
    },

    // a plain radiant glowing sphere with a Fresnel "hollow shell" material -
    // celestialverdictSkill's own distinct look (used to share "twinhalo"
    // with seraphicascension - pulled out into its own style so the two no
    // longer look identical), also reused by stormsurgeSkill (lightning,
    // yellow) and abyssalcurrentSkill (water, blue) - the shape/material
    // aren't light-element-specific, just driven by skill.explosionColor
    // like every other style here
    lightorb(scene, box, skill){
        box.isVisible = false
        const sphere = getShapeClone(scene, "sphere_lightorb", () => MeshBuilder.CreateSphere("sphere_lightorb_template", { diameter: 0.4, segments: 16 }, scene))
        sphere.parent = box
        sphere.isPickable = false
        sphere.scaling = new Vector3(1, 1, 1).scale(skill.projectileScale ?? 1)
        // fresnelMat (tools/materials.js) instead of a flat createGlowingMat -
        // a hollow-looking glowing shell (transparent center, brighter/more
        // opaque rim) rather than a solid glowing ball
        const sphereMat = fresnelMat(scene, skill.explosionColor || "white")
        sphere.material = sphereMat
        addGlow(scene, sphere, 0.6)

        const spinObserver = scene.onBeforeRenderObservable.add(() => {
            sphere.rotation.y += 0.05
            sphere.rotation.x += 0.03
        })
        attachLightning(scene, sphere, skill.explosionColor || "white", false, { arcCount: skill.arcCount ?? 2, width: 0.015, updateInterval: 90, withLight: false })

        function cleanup(){
            scene.onBeforeRenderObservable.remove(spinObserver)
            sphere.dispose(false, true) // also frees sphere's own material (createGlowingMat)
        }

        // skill.stickAndGrow (stormsurgeSkill) - instead of the usual
        // EXPLOSION_STYLES burst, the sphere itself sticks to whatever it
        // hit (box.setParent, same "ride along with the enemy" trick
        // darkorb's own onHit uses), swells to skill.stickGrowScale (default
        // 5x) over STICK_GROW_DURATION_MS, then fades out (material alpha ->
        // 0, not just an abrupt disappear) over STICK_FADE_DURATION_MS before
        // finishCleanup runs. celestialverdict never sets this flag, so its
        // own lightorb cast falls through to the plain cleanup-only return
        // below and keeps its usual EXPLOSION_STYLES.light burst untouched.
        if(!skill.stickAndGrow) return cleanup

        const STICK_GROW_DURATION_MS = 500
        const STICK_FADE_DURATION_MS = 700
        const STICK_GROW_SCALE = skill.stickGrowScale ?? 5
        const baseAlpha = sphereMat.alpha
        function onHit(hitTarget, finishCleanup){
            if(hitTarget?.body) box.setParent(hitTarget.body)

            const startScale = box.scaling.clone()
            const targetScale = startScale.scale(STICK_GROW_SCALE)
            const growStart = performance.now()
            const growObserver = scene.onBeforeRenderObservable.add(() => {
                // hit target died / projectile got disposed mid-grow - bail
                // rather than animating properties on a disposed mesh
                if(box.isDisposed()){
                    scene.onBeforeRenderObservable.remove(growObserver)
                    return
                }
                const t = Math.min((performance.now() - growStart) / STICK_GROW_DURATION_MS, 1)
                const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic, fast swell up front
                box.scaling = Vector3.Lerp(startScale, targetScale, eased)
                if(t >= 1){
                    scene.onBeforeRenderObservable.remove(growObserver)
                    const fadeStart = performance.now()
                    const fadeObserver = scene.onBeforeRenderObservable.add(() => {
                        if(box.isDisposed()){
                            scene.onBeforeRenderObservable.remove(fadeObserver)
                            return
                        }
                        const ft = Math.min((performance.now() - fadeStart) / STICK_FADE_DURATION_MS, 1)
                        sphereMat.alpha = baseAlpha * (1 - ft)
                        if(ft >= 1){
                            scene.onBeforeRenderObservable.remove(fadeObserver)
                            finishCleanup()
                        }
                    })
                }
            })
        }
        return { cleanup, onHit }
    },

    // dark - two thin glowing bars crossed into an X (exactly two boxes,
    // rotated) - a stark geometric sigil/rune instead of a shaped weapon,
    // fitting a curse mark more than a blade would
    boxcross(scene, box, skill){
        box.isVisible = false
        const root = new TransformNode(`boxcross_${skill.name}_${Date.now()}`, scene)
        root.parent = box
        root.scaling = new Vector3(1, 1, 1).scale(skill.projectileScale ?? 1)

        const barA = getShapeClone(scene, "box_boxcross", () => MeshBuilder.CreateBox("box_boxcross_template", { width: 0.06, height: 0.06, depth: 0.5 }, scene))
        barA.parent = root
        barA.isPickable = false
        barA.rotation.z = Math.PI / 4
        barA.material = createGlowingMat(scene, skill.explosionColor || "violet")
        addGlow(scene, barA, 0.5)

        const barB = getShapeClone(scene, "box_boxcross", () => MeshBuilder.CreateBox("box_boxcross_template", { width: 0.06, height: 0.06, depth: 0.5 }, scene))
        barB.parent = root
        barB.isPickable = false
        barB.rotation.z = -Math.PI / 4
        barB.material = createGlowingMat(scene, skill.explosionColor || "violet")
        addGlow(scene, barB, 0.5)

        const spinObserver = scene.onBeforeRenderObservable.add(() => { root.rotation.y += 0.06 })
        attachLightning(scene, root, skill.explosionColor || "violet", false, { arcCount: skill.arcCount ?? 2, width: 0.015, updateInterval: 90, withLight: false })
        return () => {
            scene.onBeforeRenderObservable.remove(spinObserver)
            root.dispose(false, true) // also frees barA/barB's own separate materials (createGlowingMat, two of them)
        }
    },

    // dark - a genuinely different build from every other style above: a
    // small glassy sphere with a real (if restrained) shader material -
    // dark base, purple emissive, and a StandardMaterial Fresnel rim so the
    // silhouette edge glows brighter than the face (no custom GLSL needed,
    // StandardMaterial has this built in) - wrapped in a NoiseProceduralTexture
    // bump map for a veined/cracked surface instead of a flat color. A tiny
    // jagged white-glowing splinter sits inside, built with createRock.js's
    // own displaceWithNoise (the exact technique createOre's rock peaks use,
    // just a much smaller radius) instead of a plain sphere/box, for a
    // sharp faceted point rather than a smooth ball. Two particle layers
    // orbit it - a dark smoky aura and a purple energetic spark layer -
    // for astralrainSkill-style layered ambience. darkorbSkill (skillsData.js)
    // is the only skill using this - it's meaningfully heavier than every
    // other projectile style here (a live shader material + a procedural
    // texture + a displaced mesh + two particle systems, all built fresh
    // per cast), so deliberately kept to one skill rather than reused broadly.
    darkorb(scene, box, skill){
        box.isVisible = false
        const color = skill.explosionColor || "violet"
        // base size grows with level same as every other style (skill.
        // projectileScale) - onHit's grow sequence below starts its own 1x
        // point FROM whatever box.scaling already is, so a leveled-up orb's
        // bigger starting size and its onHit swell compound automatically
        box.scaling = new Vector3(1, 1, 1).scale(skill.projectileScale ?? 1)

        const orb = getShapeClone(scene, "sphere_darkorb", () => MeshBuilder.CreateSphere("sphere_darkorb_template", { diameter: 0.5, segments: 20 }, scene))
        orb.parent = box
        orb.isPickable = false

        const orbMat = new StandardMaterial(`darkorbMat_${Date.now()}`, scene)
        orbMat.diffuseColor = new Color3(0.05, 0.0, 0.08)
        orbMat.specularColor = new Color3(0.05, 0.0, 0.08)
        orbMat.emissiveColor = new Color3(0.3, 0.05, 0.45)
        orbMat.alpha = 0.9

        // veined/cracked surface - real noise (not a flat color), bound as
        // a bump map so the cracks actually catch light as the orb turns
        const veinNoise = new NoiseProceduralTexture(`darkorbVeins_${Date.now()}`, 256, scene)
        veinNoise.octaves = 4
        veinNoise.persistence = 0.65
        veinNoise.animationSpeedFactor = 3
        orbMat.bumpTexture = veinNoise

        // brighter at the silhouette edge than face-on - the "electric
        // sphere" read, via StandardMaterial's built-in Fresnel support
        orbMat.emissiveFresnelParameters = new FresnelParameters()
        orbMat.emissiveFresnelParameters.bias = 0.3
        orbMat.emissiveFresnelParameters.power = 2
        orbMat.emissiveFresnelParameters.leftColor = new Color3(0.8, 0.4, 1.0)
        orbMat.emissiveFresnelParameters.rightColor = new Color3(0.2, 0.0, 0.3)

        orb.material = orbMat
        addGlow(scene, orb, 0.6)

        // inner white-hot splinter - createRock.js's displaceWithNoise
        // reused verbatim on a tiny icosphere (its own fresh noise
        // instance, seedOffset 0 since nothing else shares this noiseFn),
        // then flat-shaded once displacement is final for a faceted point
        // instead of a smooth pebble - same order createOre's own peaks use
        const coreRadius = 0.14
        const coreNoise = createSimplex(randBetween(1, 9999))
        const core = MeshBuilder.CreateIcoSphere(`darkorbCore_${skill.name}_${Date.now()}`, {
            radius: coreRadius, subdivisions: 3, updatable: true, flat: false,
        }, scene)
        core.parent = box
        core.isPickable = false
        displaceWithNoise(core, coreNoise, 0, coreRadius)
        core.convertToFlatShadedMesh()
        core.material = createGlowingMat(scene, "white")
        addGlow(scene, core, 1)

        // dark smoky aura - standard alpha blend, not additive, so it reads
        // as smoke/shadow rather than another glow layer
        const blackAura = createParticle(scene, "smoke2", 40, null, 0.02, { min: 0.5, max: 0.9 }, 0.12, 0.3, 0, "sphere", true, orb, { r: 0.02, g: 0.0, b: 0.04 }, false)
        blackAura.createSphereEmitter(0.32, 0.4)
        blackAura.minEmitPower = 0.05
        blackAura.maxEmitPower = 0.15
        blackAura.emitRate = 26
        blackAura.blendMode = ParticleSystem.BLENDMODE_STANDARD

        // purple energetic sparks - additive, the "crackling" read
        const purpleSpark = createParticle(scene, "flare", 30, null, 0.025, { min: 0.15, max: 0.4 }, 0.04, 0.12, 0, "sphere", true, orb, { r: 0.55, g: 0.15, b: 0.9 }, false)
        purpleSpark.createSphereEmitter(0.28, 0.6)
        purpleSpark.minEmitPower = 0.3
        purpleSpark.maxEmitPower = 0.65
        purpleSpark.emitRate = 40
        purpleSpark.blendMode = ParticleSystem.BLENDMODE_ADD

        // slow independent tumble so the vein pattern/rim glow/core facets
        // all read as alive rather than a static prop flying in a straight line -
        // keeps running through the onHit grow sequence below too (a
        // spinning, swelling inferno reads more alive than one that freezes
        // still the instant it lands)
        const spinObserver = scene.onBeforeRenderObservable.add(() => {
            orb.rotation.y += 0.02
            orb.rotation.x += 0.008
            core.rotation.x += 0.05
            core.rotation.y += 0.08
        })

        function cleanup(){
            scene.onBeforeRenderObservable.remove(spinObserver)
            // dispose(false) - both particleTextures are particlesystem.js's
            // own shared/persistent cache now (smoke2/flare), not owned by
            // these two systems specifically
            blackAura.stop(); blackAura.dispose(false)
            purpleSpark.stop(); purpleSpark.dispose(false)
            veinNoise.dispose()
            orbMat.dispose()
            orb.dispose()
            // core's own material (createGlowingMat, a SEPARATE instance
            // from orbMat above) was never disposed here before - core.dispose()
            // alone only freed the mesh, leaving that material behind every
            // single darkorb cast. (false, true) fixes it the same way every
            // other style's cleanup above does.
            core.dispose(false, true)
        }

        // on hit: instead of the usual explode-and-vanish every other style
        // gets, this sticks to whatever it hit and swells "like a wildfire"
        // catching - box.setParent(enemy.body) rides along with the enemy
        // from here on (Babylon's setParent, not a raw .parent assignment,
        // recomputes the local transform to keep it exactly where it hit
        // instead of snapping), scales up GROW_SCALE over GROW_DURATION_MS
        // (orb+core scale together for free since both are parented to box),
        // and both particle layers grow their emit rate/size to match.
        // finishCleanup (fireElementalProjectile's own cleanupProjectile) is
        // called by the caller once this whole sequence finishes, not here -
        // this only owns the growth, not the projectile's lifecycle.
        //
        // skill.darkorbGrowScale/darkorbGrowIntensity (skillUpgrades.js's
        // growDarkOrb) let leveling make this sequence itself more extreme,
        // not just bigger going in - falls back to the original fixed
        // 10x/1x if darkorbSkill was never upgraded past lvl 1.
        const GROW_DURATION_MS = 900
        const GROW_LINGER_MS = 400 // sits at full size/intensity for a beat before actually despawning
        const GROW_SCALE = skill.darkorbGrowScale ?? 10
        const GROW_INTENSITY = skill.darkorbGrowIntensity ?? 1
        function onHit(enemy, finishCleanup){
            if(enemy?.body) box.setParent(enemy.body)

            const startScale = box.scaling.clone()
            const targetScale = startScale.scale(GROW_SCALE)
            const startEmissive = orbMat.emissiveColor.clone()
            const targetEmissive = new Color3(0.85, 0.5, 1.0) // brighter, hotter, closer to the rim color as it swells

            const startBlackRate = blackAura.emitRate, targetBlackRate = startBlackRate * 4 * GROW_INTENSITY
            const startPurpleRate = purpleSpark.emitRate, targetPurpleRate = startPurpleRate * 4 * GROW_INTENSITY
            const startBlackMax = blackAura.maxSize, targetBlackMax = startBlackMax * 3 * GROW_INTENSITY
            const startPurpleMax = purpleSpark.maxSize, targetPurpleMax = startPurpleMax * 3 * GROW_INTENSITY

            const startTime = performance.now()
            const growObserver = scene.onBeforeRenderObservable.add(() => {
                // enemy died mid-grow (its body got disposed) - bail out
                // rather than animating properties on disposed objects
                if(box.isDisposed()){
                    scene.onBeforeRenderObservable.remove(growObserver)
                    return
                }

                const t = Math.min((performance.now() - startTime) / GROW_DURATION_MS, 1)
                const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic - fast swell up front, settles near the end

                box.scaling = Vector3.Lerp(startScale, targetScale, eased)
                orbMat.emissiveColor = Color3.Lerp(startEmissive, targetEmissive, eased)
                blackAura.emitRate = startBlackRate + (targetBlackRate - startBlackRate) * eased
                purpleSpark.emitRate = startPurpleRate + (targetPurpleRate - startPurpleRate) * eased
                blackAura.maxSize = startBlackMax + (targetBlackMax - startBlackMax) * eased
                purpleSpark.maxSize = startPurpleMax + (targetPurpleMax - startPurpleMax) * eased

                if(t >= 1){
                    scene.onBeforeRenderObservable.remove(growObserver)
                    setTimeout(finishCleanup, GROW_LINGER_MS)
                }
            })
        }

        return { cleanup, onHit }
    },
}

// --- explosion visuals ---
// fn(scene, position, powerScale, color, skill) - fire/water/earth/light are
// all createExplosionBurst with a different burstTexture/gravitySign/
// includeSmoke preset (see that function's own comment for why one function
// covers all four instead of four copies of it); dark is the genuinely
// different createImplosionBurst. skill is only read for projectileStyle -
// a "blade" skill (flamebrand/tidalspike/stoneshard) is a solid weapon
// striking something, not a bolt of pure element detonating, so it skips
// the smoke layer regardless of which explosionStyle it's using.
// a solid weapon striking something (a blade, a crossed pair of blades, a
// spear) shouldn't leave lingering smoke behind any more than the original
// "blade" style did - see EXPLOSION_STYLES.fire/water/earth below
const WEAPON_LIKE_STYLES = new Set(["blade", "bladecross", "spearlance"])

// emberEmitRate (the 6th positional arg to createExplosionBurst) halved
// across every element below - fire 30->15, water 22->11, earth 25->13,
// light 15->8, lightning 20->10 - fewer embers per explosion, cut for
// performance (see createImplosionBurst's own emitRate cuts too, same pass).
const EXPLOSION_STYLES = {
    fire(scene, pos, powerScale, color, skill){
        createExplosionBurst(scene, pos, powerScale, 1, 1, 15, color, { burstTexture: "explodeTex", gravitySign: 1, includeSmoke: !WEAPON_LIKE_STYLES.has(skill.projectileStyle) })
    },
    water(scene, pos, powerScale, color, skill){
        // bubbles drifting up instead of embers - drunkBubble.png is
        // literally a bubble sprite, sitting unused until now
        createExplosionBurst(scene, pos, powerScale, 0.9, 0.7, 11, color, { burstTexture: "drunkBubble", gravitySign: 1, includeSmoke: !WEAPON_LIKE_STYLES.has(skill.projectileStyle) })
    },
    earth(scene, pos, powerScale, color, skill){
        // debris FALLS (gravitySign -1) instead of rising like fire/embers do
        createExplosionBurst(scene, pos, powerScale, 1.2, 1.3, 13, color, { burstTexture: "rockTex", gravitySign: -1, includeSmoke: !WEAPON_LIKE_STYLES.has(skill.projectileStyle) })
    },
    light(scene, pos, powerScale, color, skill){
        // clean and bright - no smoke residue, cooler/faster burst
        createExplosionBurst(scene, pos, powerScale, 0.8, 0.5, 8, color, { burstTexture: "flare2", gravitySign: 1, includeSmoke: false })
    },
    dark(scene, pos, powerScale, color, skill){
        createImplosionBurst(scene, pos, powerScale, color)
    },
    lightning(scene, pos, powerScale, color, skill){
        // clean and sharp like "light"'s burst, but its own texture
        // (flare3, otherwise unused) so a bright lightning discharge reads
        // as a distinct flash rather than a recolored light skill
        createExplosionBurst(scene, pos, powerScale, 0.85, 0.6, 10, color, { burstTexture: "flare3", gravitySign: 1, includeSmoke: false })
    },
}

// launch/impact sound per projectile style - falls back to the generic
// fireball whoosh/impact (every bolt/lightning-style skill). The weapon-like
// styles reuse the spear/sword swing sounds already loaded for melee (see
// soundSystem.js's spearS1/swordS1/struckS) since an actual blade/spear
// whipping through the air and striking something reads better than a
// fireball whoosh - struckS covers the impact for all three, same sound
// melee already uses for a solid hit.
const LAUNCH_SOUND_BY_STYLE = { blade: "spearS1", bladecross: "swordS1", spearlance: "spearS1" }
const IMPACT_SOUND_BY_STYLE = { blade: "struckS", bladecross: "struckS", spearlance: "struckS" }

// per-skill-name overrides, checked BEFORE the generic per-style map -
// maelstrombolt (element: water, "icon" style - no style-based impact sound
// of its own, would otherwise fall through to the generic fireHitS),
// lightningbolt (element: lightning, "blade" style - previously layered its
// own extra fireHitS on top of the shared struckS weapon-strike sound), and
// shadowbolt (element: dark, "shadowblade" style - same "bolt" naming) all
// use electrichit.mp3 as their actual impact/explosion sound instead.
// tidalspike (element: water, "beam" style - also had no style-based sound
// of its own) uses waterhit.mp3.
const IMPACT_SOUND_BY_SKILL_NAME = { maelstrombolt: "electricHitS", lightningbolt: "electricHitS", shadowbolt: "electricHitS", tidalspike: "waterHitS" }

// Called from both player-cast and enemy-cast hit handlers below so a skill
// sounds the same either way it's cast.
function playImpactSound(skill){
    const impactSoundName = IMPACT_SOUND_BY_SKILL_NAME[skill.name] || IMPACT_SOUND_BY_STYLE[skill.projectileStyle] || "fireHitS"
    getAllSounds()[impactSoundName]?.play()
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
    box.isVisible = false // PROJECTILE_STYLES.lightning flips this back on for its own look

    const styleFn = PROJECTILE_STYLES[skill.projectileStyle] || PROJECTILE_STYLES.bolt
    const styleResult = styleFn(scene, box, skill)
    // every style but "darkorb" just returns its cleanup function directly;
    // darkorb also needs an onHit hook (sticks + grows instead of the usual
    // explode-and-vanish, see PROJECTILE_STYLES.darkorb's own comment), so
    // it returns { cleanup, onHit } instead - this stays backward compatible
    // with every plain-function style rather than changing all of their
    // return shapes for one skill's sake
    const cleanupStyle = typeof styleResult === "function" ? styleResult : styleResult.cleanup
    const onHitStyle = typeof styleResult === "function" ? null : styleResult.onHit
    // "marker" stays silent too, not just invisible - a stealthy targeting
    // box firing off a fireball whoosh would undercut the whole point of it
    if(skill.projectileStyle !== "marker"){
        const launchSoundName = LAUNCH_SOUND_BY_STYLE[skill.projectileStyle] || "fireBallS"
        getAllSounds()[launchSoundName]?.play()
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

            // onHitStyle (darkorb) owns its own impact visual (stick + grow)
            // instead of the usual burst - skip EXPLOSION_STYLES entirely
            // for it, and stop the shared projectile-movement loop from
            // still trying to translate it forward now that it's stuck
            // (renderer.js's per-projectile loop checks this same flag -
            // every other style skips this since cleanupProjectile below
            // removes it from that array immediately anyway)
            if(onHitStyle){
                projectile.stuck = true
            } else {
                const explosionFn = EXPLOSION_STYLES[skill.explosionStyle] || EXPLOSION_STYLES.fire
                explosionFn(scene, box.position.clone(), powerScale, skill.explosionColor || "red", skill)
            }

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

            // darkorb's onHit owns when cleanupProjectile actually runs from
            // here (after its stick-and-grow sequence finishes); "blade"
            // style skills stick into the enemy they hit for
            // MARKER_STICK_DURATION_MS instead of vanishing on impact
            // (enemies have no bodytarget/spine mount like players do, so
            // this attaches to the enemy's own whole body) - every other
            // style cleans up immediately, right when it lands
            if(onHitStyle){
                onHitStyle(enemy, cleanupProjectile)
            } else if(skill.projectileStyle === "blade"){
                stickMarkerToMesh(projectile, box, enemy.body, cleanupProjectile)
            } else {
                cleanupProjectile()
            }
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
    EXPLOSION_STYLES.earth(scene, new Vector3(groundPos.x, groundPos.y, groundPos.z), powerScale, skill.explosionColor || "green", skill)

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
    const explosionFn = EXPLOSION_STYLES[skill.explosionStyle] || EXPLOSION_STYLES.fire
    explosionFn(scene, enemy.body.position.clone(), powerScale, skill.explosionColor || "red", skill)
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

    const styleFn = PROJECTILE_STYLES[skill.projectileStyle] || PROJECTILE_STYLES.bolt
    const styleResult = styleFn(scene, box, skill)
    const cleanupStyle = typeof styleResult === "function" ? styleResult : styleResult.cleanup

    const launchSoundName = LAUNCH_SOUND_BY_STYLE[skill.projectileStyle] || "fireBallS"
    getAllSounds()[launchSoundName]?.play()

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

        // "blade" style skills - play the actual "got struck" reaction
        // (animation + a struckS play spatially re-attached to bodytarget,
        // so it audibly comes from the target's own body rather than
        // wherever struckS last played from) before the generic impact
        // sound/explosion/damage below. attachToMesh right before
        // playImpactSound's own struckS.play() call (IMPACT_SOUND_BY_STYLE
        // maps "blade" to struckS already) rather than playing it twice.
        // targetPlayer's own characterAnimations (not necessarily "my own
        // character" anymore) - this now plays the right person's own
        // reaction animation whether targetPlayer is this client's own
        // character or someone else's being watched.
        if(skill.projectileStyle === "blade"){
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
        const explosionFn = EXPLOSION_STYLES[skill.explosionStyle] || EXPLOSION_STYLES.fire
        explosionFn(scene, box.position.clone(), 1, skill.explosionColor || "red", skill)

        // "blade" style skills stick into the target's bodytarget for
        // MARKER_STICK_DURATION_MS instead of vanishing on impact - purely
        // visual, so this runs identically for everyone watching now, not
        // just the victim. Every client independently owns/cleans up its
        // own local projectile mesh either way, whether "blade" (stick,
        // then cleanupProjectile after the stick duration) or any other
        // style (clean up immediately on impact).
        if(skill.projectileStyle === "blade"){
            stickMarkerToMesh(projectile, box, targetPlayer.bodytarget, cleanupProjectile)
        } else {
            cleanupProjectile()
        }

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
