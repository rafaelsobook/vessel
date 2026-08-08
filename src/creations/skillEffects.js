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
import { MeshBuilder, TransformNode, Vector3, StandardMaterial, Color3, FresnelParameters, NoiseProceduralTexture, ParticleSystem } from "@babylonjs/core"
import { createMagicCircle } from "./magiccircles.js"
import { createParticleSystem, createExplosionBurst, createImplosionBurst, createParticle } from "../tools/particlesystem.js"
import { createWeapon } from "../assetcreation/createweapon.js"
import { spawnProjectile } from "./skills.js"
import { createGlowingMat } from "../tools/materials.js"
import { addGlow } from "../tools/glow.js"
import { attachLightning } from "../effects/lightning.js"
import { createSimplex } from "../tools/noise.js"
import { displaceWithNoise } from "../assetcreation/createRock.js"
import { getEnemiesOnScene, getPlayersOnScene, pushProjectile, removeProjectile } from "../sockets/worldsocket.js"
import { onIntersecEnterTrig, removeIntersecTrig } from "../components/actionManager.js"
import { emitEnemyIsHit, emitEnemyBind, emitEnemyCurse, emitDied } from "../sockets/emits.js"
import { getAdditionalsFromAbilities, getCharState, deductHp } from "../charactersystem/characterstate.js"
import { randNum, randBetween } from "../tools/random.js"
import { getAllSounds } from "../components/soundSystem.js"
import { getSceneDet } from "../main/main.js"
import { camShake } from "../tools/camera.js"

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

    // circle stays up roughly through the cast window plus a beat after the
    // projectile launches, instead of despawning the instant it fires
    createMagicCircle(spawnPos, scene, circleImg, 0.8, skill.castDuration * 1000 + 800, forward, CIRCLE_SIZE_SCALE)

    const timeoutId = setTimeout(() => {
        pendingCasts.delete(skill.name)
        fireElementalProjectile(scene, charState, skill, spawnPos, forward, powerScale)
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

// --- projectile visuals ---
// fn(scene, box, skill) => cleanup() - called once the projectile despawns
// (hit or miss) to stop/dispose whatever this style attached to it.
const PROJECTILE_STYLES = {
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
    // particle trail, box stays invisible - the default look. skill.particleStyles
    // ([{name, color}, ...], see tools/particlesystem.js's createParticleSystem)
    // picks the trail's shape; falls back to a plain colored "oneline" streak.
    bolt(scene, box, skill){
        const styles = skill.particleStyles ?? [{ name: "oneline", color: skill.explosionColor || "blue" }]
        const systems = createParticleSystem(scene, box, styles)
        return () => systems.forEach(ps => { ps.stop(); ps.dispose() })
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
        return () => bladeRoot.dispose() // recurses into the 4 part meshes (and the arcs, if any - attachLightning's own onDisposeObservable wiring) by default
    },
    // a small glowing core wrapped in crackling arcs - attachLightning
    // already handles both the arcs AND making the mesh itself glow
    // (weaponGlow: true), see effects/lightning.js
    lightning(scene, box, skill){
        box.isVisible = true
        box.scaling = new Vector3(0.4, 0.4, 0.4).scale(skill.projectileScale ?? 1)
        box.material = createGlowingMat(scene, skill.explosionColor || "white")
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
        const halo = MeshBuilder.CreateTorus(`halo_${skill.name}_${Date.now()}`, { diameter: 0.55, thickness: 0.09, tessellation: 24 }, scene)
        halo.parent = box
        halo.position = Vector3.Zero()
        halo.isPickable = false
        halo.scaling = new Vector3(1, 1, 1).scale(skill.projectileScale ?? 1)
        attachLightning(scene, halo, skill.explosionColor || "white", true, { arcCount: skill.arcCount ?? 3, width: 0.02, updateInterval: 60 })

        // spins face-on as it flies instead of just sitting there
        const spinObserver = scene.onBeforeRenderObservable.add(() => { halo.rotation.z += 0.12 })
        return () => {
            scene.onBeforeRenderObservable.remove(spinObserver)
            halo.dispose() // attachLightning's own arcs/light/mat teardown is wired to halo.onDisposeObservable, fires from this
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
            root.dispose() // recurses into both blades' part meshes and the arcs
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
        return () => spearRoot.dispose()
    },

    // earth - a jagged glowing crystal shard (MeshBuilder.CreatePolyhedron,
    // type 3 = icosahedron - a many-faceted, rock-like silhouette instead of
    // a smooth primitive), tumbling irregularly on all three axes rather
    // than spinning cleanly like everything else here
    crystalshard(scene, box, skill){
        box.isVisible = false
        const shard = MeshBuilder.CreatePolyhedron(`shard_${skill.name}_${Date.now()}`, { type: 3, size: 0.22 }, scene)
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
            shard.dispose()
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

        const ringA = MeshBuilder.CreateTorus(`twinhaloA_${skill.name}_${Date.now()}`, { diameter: 0.45, thickness: 0.05, tessellation: 24 }, scene)
        ringA.parent = root
        ringA.isPickable = false
        ringA.material = createGlowingMat(scene, skill.explosionColor || "white")
        addGlow(scene, ringA, 0.5)

        const ringB = MeshBuilder.CreateTorus(`twinhaloB_${skill.name}_${Date.now()}`, { diameter: 0.45, thickness: 0.05, tessellation: 24 }, scene)
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
            root.dispose()
        }
    },

    // dark - two thin glowing bars crossed into an X (exactly two boxes,
    // rotated) - a stark geometric sigil/rune instead of a shaped weapon,
    // fitting a curse mark more than a blade would
    boxcross(scene, box, skill){
        box.isVisible = false
        const root = new TransformNode(`boxcross_${skill.name}_${Date.now()}`, scene)
        root.parent = box
        root.scaling = new Vector3(1, 1, 1).scale(skill.projectileScale ?? 1)

        const barA = MeshBuilder.CreateBox(`boxcrossA_${skill.name}_${Date.now()}`, { width: 0.06, height: 0.06, depth: 0.5 }, scene)
        barA.parent = root
        barA.isPickable = false
        barA.rotation.z = Math.PI / 4
        barA.material = createGlowingMat(scene, skill.explosionColor || "violet")
        addGlow(scene, barA, 0.5)

        const barB = MeshBuilder.CreateBox(`boxcrossB_${skill.name}_${Date.now()}`, { width: 0.06, height: 0.06, depth: 0.5 }, scene)
        barB.parent = root
        barB.isPickable = false
        barB.rotation.z = -Math.PI / 4
        barB.material = createGlowingMat(scene, skill.explosionColor || "violet")
        addGlow(scene, barB, 0.5)

        const spinObserver = scene.onBeforeRenderObservable.add(() => { root.rotation.y += 0.06 })
        attachLightning(scene, root, skill.explosionColor || "violet", false, { arcCount: skill.arcCount ?? 2, width: 0.015, updateInterval: 90, withLight: false })
        return () => {
            scene.onBeforeRenderObservable.remove(spinObserver)
            root.dispose()
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

        const orb = MeshBuilder.CreateSphere(`darkorb_${skill.name}_${Date.now()}`, { diameter: 0.5, segments: 20 }, scene)
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
            blackAura.stop(); blackAura.dispose()
            purpleSpark.stop(); purpleSpark.dispose()
            veinNoise.dispose()
            orbMat.dispose()
            orb.dispose()
            core.dispose()
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

const EXPLOSION_STYLES = {
    fire(scene, pos, powerScale, color, skill){
        createExplosionBurst(scene, pos, powerScale, 1, 1, 30, color, { burstTexture: "explodeTex", gravitySign: 1, includeSmoke: !WEAPON_LIKE_STYLES.has(skill.projectileStyle) })
    },
    water(scene, pos, powerScale, color, skill){
        // bubbles drifting up instead of embers - drunkBubble.png is
        // literally a bubble sprite, sitting unused until now
        createExplosionBurst(scene, pos, powerScale, 0.9, 0.7, 22, color, { burstTexture: "drunkBubble", gravitySign: 1, includeSmoke: !WEAPON_LIKE_STYLES.has(skill.projectileStyle) })
    },
    earth(scene, pos, powerScale, color, skill){
        // debris FALLS (gravitySign -1) instead of rising like fire/embers do
        createExplosionBurst(scene, pos, powerScale, 1.2, 1.3, 25, color, { burstTexture: "rockTex", gravitySign: -1, includeSmoke: !WEAPON_LIKE_STYLES.has(skill.projectileStyle) })
    },
    light(scene, pos, powerScale, color, skill){
        // clean and bright - no smoke residue, cooler/faster burst
        createExplosionBurst(scene, pos, powerScale, 0.8, 0.5, 15, color, { burstTexture: "flare2", gravitySign: 1, includeSmoke: false })
    },
    dark(scene, pos, powerScale, color, skill){
        createImplosionBurst(scene, pos, powerScale, color)
    },
    lightning(scene, pos, powerScale, color, skill){
        // clean and sharp like "light"'s burst, but its own texture
        // (flare3, otherwise unused) so a bright lightning discharge reads
        // as a distinct flash rather than a recolored light skill
        createExplosionBurst(scene, pos, powerScale, 0.85, 0.6, 20, color, { burstTexture: "flare3", gravitySign: 1, includeSmoke: false })
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

// lightningboltSkill only (skillsData.js) - "blade" style already gets its
// own struckS impact like every other blade skill, but a bolt of
// electricity landing should ALSO carry its own elemental hit sound on top
// of the generic weapon-strike one, not just the blade sound alone the way
// flamebrand/tidalspike/stoneshard (the other "blade" skills) do. Called
// from both player-cast and enemy-cast hit handlers below so lightningbolt
// sounds the same either way it's cast.
function playImpactSound(skill){
    const impactSoundName = IMPACT_SOUND_BY_STYLE[skill.projectileStyle] || "fireHitS"
    getAllSounds()[impactSoundName]?.play()
    if(skill.name === "lightningbolt") getAllSounds().fireHitS?.play()
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

function fireElementalProjectile(scene, charState, skill, spawnPos, forward, powerScale){
    const targetPoint = spawnPos.add(forward.scale(10)) // far enough out that direction is stable regardless of distance to anything

    const itemId = `${skill.name}_${randNum(1000, 9999)}`
    const box = MeshBuilder.CreateBox(`projectile.${itemId}`, { size: 0.25 }, scene)
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

            // magic damage recomputed at impact (not at activation) - same
            // formula attackingSystem.js's calcDmg uses for magicDmg,
            // duplicated here instead of importing calcDmg to avoid a
            // 2-file import cycle with attackingSystem.js (which is what
            // calls castOffenseSkill in the first place). additionalMagicDmg
            // is {toAdd, percent}, not a plain number - see calcDmg's own
            // comment on this same formula.
            const abilityAdditions = getAdditionalsFromAbilities()
            let magicDmg = abilityAdditions.additionalMagicDmg.toAdd + charState.stats.magic * 16
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
                playerId: charState.owner,
                dmgDetails: { physicalDmg: totalDmg, weaponDmg: 0 },
                targetId: enemy._id,
                currentPlaceId: charState.currentPlace.placeId,
            })

            // skill.enemyBind (see skillsData.js's radiantjudgmentSkill) -
            // bindChance rolled here, client-side, same as every other hit-
            // resolution decision in this game (server is only authoritative
            // for hp/removal, never for "did this even land" - see
            // emitEnemyIsHit's own comment). tcp/index.ts's enemyBind
            // handler is the actual _disabled timer authority.
            if(skill.enemyBind && Math.random() < (skill.enemyBind.bindChance ?? 1)){
                emitEnemyBind({
                    targetId: enemy._id,
                    shape: skill.enemyBind.shape,
                    bindDuration: skill.enemyBind.bindDuration,
                    currentPlaceId: charState.currentPlace.placeId,
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
                    currentPlaceId: charState.currentPlace.placeId,
                })
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
    const ENV_HIT_KEYWORDS = ["wall", "floor", "ground", "tree"]
    if(skill.swordRain){
        scene.meshes.forEach(mesh => {
            if(mesh === box || !mesh.name) return
            const lowerName = mesh.name.toLowerCase()
            if(!ENV_HIT_KEYWORDS.some(keyword => lowerName.includes(keyword))) return

            const enterAction = onIntersecEnterTrig(box, mesh, scene, () => {
                if(hasHit) return
                hasHit = true
                clearTimeout(missTimeout)
                envTriggerCleanups.forEach(fn => fn())

                const hitPos = mesh.getAbsolutePosition ? mesh.getAbsolutePosition().clone() : box.position.clone()
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
    // mechanic uses) - but NOT its built-in hit detection, which only ever
    // triggers against players (see that file's own header comment), never
    // enemies. The travel time below is computed analytically instead
    // (straight-line distance over spawnProjectile's own hardcoded spd: 10 -
    // see its source - this drifts out of sync if that ever changes) and
    // drives this file's own enemy-hit/damage/explosion logic once the
    // sword should have landed, same shape as fireElementalProjectile's own
    // hit handling just timer-driven instead of trigger-driven.
    spawnProjectile(startPos, landingPos, skill.explosionColor || "white", scene, "default")

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
        const IMPACT_RADIUS = 1.8
        getEnemiesOnScene().forEach(enemy => {
            if(!enemy.body) return
            const dx = enemy.body.position.x - landingPos.x
            const dz = enemy.body.position.z - landingPos.z
            if((dx * dx + dz * dz) > IMPACT_RADIUS * IMPACT_RADIUS) return

            const abilityAdditions = getAdditionalsFromAbilities()
            let magicDmg = abilityAdditions.additionalMagicDmg.toAdd + charState.stats.magic * 16
            if(abilityAdditions.additionalMagicDmg.percent){
                magicDmg += magicDmg * abilityAdditions.additionalMagicDmg.percent
            }
            const totalDmg = Math.round(((skill.effects?.plusDmg || 0) + magicDmg) * powerScale)

            emitEnemyIsHit({
                playerId: charState.owner,
                dmgDetails: { physicalDmg: totalDmg, weaponDmg: 0 },
                targetId: enemy._id,
                currentPlaceId: charState.currentPlace.placeId,
            })

            if(skill.element === "dark"){
                emitEnemyCurse({ targetId: enemy._id, currentPlaceId: charState.currentPlace.placeId })
            }
        })
    }, travelMs)
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
    const box = MeshBuilder.CreateBox(`projectile.${itemId}`, { size: 0.25 }, scene)
    box.position.copyFrom(spawnPos)
    box.isPickable = false
    box.isVisible = false

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
        targetDirection: { x: dx, y: dy, z: dz },
        spd: PROJECTILE_SPEED,
        placeId: enemy.det.currentPlaceId,
        stuck: false,
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

    // only ever registered on the intended victim's own client - see this
    // section's header comment. Every other client just watches the same
    // projectile fly past and time out above, with no hit-test at all.
    const charState = getCharState()
    if(!charState || targetOwner !== charState.owner) return
    const myCharacter = getPlayersOnScene().find(pl => pl.owner === charState.owner)
    // bodytarget (createcharacter.js) - a small mesh parented to the
    // player's own spine bone, not the whole capsule body - same hit
    // volume creations/skills.js's spawnProjectile ("throw weapon") already
    // tests against for its own stick-in-target behavior, reused here so a
    // "blade" style skill can setParent() into it below for an identical
    // "stuck in your chest" look
    if(!myCharacter?.bodytarget) return

    const enterAction = onIntersecEnterTrig(box, myCharacter.bodytarget, scene, async () => {
        if(hasHit) return
        hasHit = true
        clearTimeout(missTimeout)
        removeIntersecTrig(box, enterAction)

        // "blade" style skills - play the actual "got struck" reaction
        // (animation + a struckS play spatially re-attached to bodytarget,
        // so it audibly comes from the player's own body rather than
        // wherever struckS last played from) before the generic impact
        // sound/explosion/damage below. attachToMesh right before
        // playImpactSound's own struckS.play() call (IMPACT_SOUND_BY_STYLE
        // maps "blade" to struckS already) rather than playing it twice.
        if(skill.projectileStyle === "blade"){
            myCharacter.characterAnimations?.playAction(myCharacter.anims, "hit_struct1", 1)
            getAllSounds().struckS?.attachToMesh(myCharacter.bodytarget)
        }

        playImpactSound(skill)
        const explosionFn = EXPLOSION_STYLES[skill.explosionStyle] || EXPLOSION_STYLES.fire
        explosionFn(scene, box.position.clone(), 1, skill.explosionColor || "red", skill)

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

        // "blade" style skills (flamebrand/lightningbolt, the only two
        // enemy-castable ones so far) stick into the player's bodytarget
        // for MARKER_STICK_DURATION_MS instead of vanishing on impact,
        // same as the player-cast direction above
        if(skill.projectileStyle === "blade"){
            stickMarkerToMesh(projectile, box, myCharacter.bodytarget, cleanupProjectile)
        } else {
            cleanupProjectile()
        }
    })
}
