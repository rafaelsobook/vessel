// Real GLB projectile assets (models/projectiles/*.glb), same load-once/
// clone-many pattern createweapon.js already established for allswords.glb:
// every model this file knows about gets loaded ONCE, at scene startup (see
// loadProjectileModels, called from containers.js's setStartingContainers),
// into a template stored on getSocketContainers().projectileModels - never
// loaded again after that. createProjectileModelInstance then just clones
// the already-loaded template synchronously, at whatever moment a skill
// actually casts - no await needed at cast time, same as createWeapon's own
// clone-from-container calls.
import { Vector3, StandardMaterial, Texture, Color3, Animation } from "@babylonjs/core"
import { loadModel } from "../tools/loadmodel.js"
import { getSocketContainers } from "../sockets/worldsocket.js"
import { addGlow } from "../tools/glow.js"

// name -> glb path. Add an entry here (and give the matching skill
// projectileVisual: { shape: "glbModel", model: { name: "..." } }) any time
// a new skill wants a real modeled projectile instead of a primitive shape/
// weapon-part assembly. "stoneshard" is the first - stoneshardSkill
// (skillsData.js) is what actually requests it.
const PROJECTILE_MODEL_PATHS = {
    stoneshard: "./models/projectiles/stoneshard.glb",
    plasma: "./models/projectiles/plasma.glb",
}

// loads every registered path in parallel - one failed/missing glb (a typo'd
// path, an asset not added yet) shouldn't take the rest down with it, same
// "warn and fall back to nothing" reasoning containers.js's own
// importMeshSafe/loadMonsterRoot already use for every other optional asset.
// Returns { name: templateMesh } - a name with no successfully-loaded
// template just won't be in the returned object, which
// createProjectileModelInstance below already treats as "nothing to clone,
// warn and no-op" rather than throwing.
export async function loadProjectileModels(scene){
    const entries = await Promise.all(
        Object.entries(PROJECTILE_MODEL_PATHS).map(async ([name, path]) => {
            try {
                const template = await loadModel(path, scene)
                return [name, template]
            } catch (error) {
                console.warn(`[createProjectileModel] failed to load "${name}" (${path})`, error)
                return null
            }
        })
    )
    return Object.fromEntries(entries.filter(Boolean))
}

// clones the named template (already loaded by loadProjectileModels above)
// and parents it under the given projectile box - mirrors createWeapon's own
// clone/parent/position-zero pattern in createweapon.js. Returns null (not a
// mesh) if the name has no loaded template, same "missing part -> warn,
// don't crash" convention createWeapon's own createPartsWeapon already
// follows for a missing weapon part.
export function createProjectileModelInstance(scene, name, parent){
    const { projectileModels } = getSocketContainers()
    const template = projectileModels?.[name]
    if(!template){
        console.warn(`[createProjectileModel] no loaded template for "${name}" - was it registered in PROJECTILE_MODEL_PATHS and awaited by setStartingContainers?`)
        return null
    }
    const inst = template.clone(`${name}_projectile_${Date.now()}`)
    inst.isVisible = true
    inst.parent = parent
    inst.position = Vector3.Zero()
    return inst
}

// qnty clones line up one behind the other along parentMesh's own local -Z
// (its backward axis - box.rotation already faces +Z toward the direction
// of travel, same convention createCometTrailParticles' own trail streams
// out of, see its header comment) instead of scattering randomly - each
// clone sits PLASMA_LINE_SPACING further back than the last, and
// PLASMA_LINE_SCALE_STEP bigger than the last (index 0 stays at the plain
// 1x base scale, right at the projectile itself) - reads as a single
// trailing line of dots that grows as it recedes, not a jittered cluster.
const PLASMA_LINE_SPACING = 1
const PLASMA_LINE_SCALE_STEP = 0.15

// how bright each plasma clone reads in the shared "magicGlow" GlowLayer
// (tools/glow.js) - only meaningful when isEmissive is true (addGlow's own
// GlowLayer reads material.emissiveColor to drive the bloom - a mesh with
// no emissiveColor set just glows as black/nothing, see addGlow's own
// customEmissiveColorSelector fallback), which is why this is only ever
// applied gated behind that same flag below
const PLASMA_GLOW_INTENSITY = 2.5

// one full spin + one full scale-pulse cycle every 2s (60 frames at 30fps) -
// arbitrary "feels alive but not frantic" pace, tune freely
const PLASMA_ANIM_FPS = 30
const PLASMA_ANIM_CYCLE_FRAMES = 60

// heartbeat visibility impulse range - dims down to 20%, never fully
// disappears, then flashes back up to fully opaque
const PLASMA_VISIBILITY_MIN = 0.2
const PLASMA_VISIBILITY_MAX = 1

// "life" animation - a continuous Y-axis spin, a gentle scale pulse
// (breathing in and out around whatever base scale the mesh already has),
// and a "heartbeat" visibility pulse, all built with Babylon's own
// Animation class (not this file's usual manual per-frame math) since
// that's what was actually asked for here. staggerFrames offsets ONLY the
// visibility pulse's own starting phase (spin/scale always start together
// at frame 0, unstaggered) - createPlasma passes each clone in a line a
// different offset so a qnty>1 row pulses one after another down the line
// like a heartbeat traveling along it, instead of every clone flashing in
// perfect unison.
//
// Returns an array of every Animatable handle scene.beginAnimation/
// beginDirectAnimation hand back, so the caller can .stop() each one
// explicitly on cleanup instead of relying on Babylon to notice the mesh
// got disposed on its own.
function addLifeAnimation(scene, mesh, staggerFrames = 0){
    const spin = new Animation(`plasma_spin_${mesh.name}`, "rotation.z", PLASMA_ANIM_FPS, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE)
    spin.setKeys([
        { frame: 0, value: 0 },
        { frame: PLASMA_ANIM_CYCLE_FRAMES, value: Math.PI * 2 },
    ])

    const baseScale = mesh.scaling.clone()
    const pulse = new Animation(`plasma_pulse_${mesh.name}`, "scaling", PLASMA_ANIM_FPS, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CYCLE)
    pulse.setKeys([
        { frame: 0, value: baseScale.scale(0.8) },
        { frame: PLASMA_ANIM_CYCLE_FRAMES / 2, value: baseScale.scale(2.2) },
        { frame: PLASMA_ANIM_CYCLE_FRAMES, value: baseScale.scale(0.7) },
    ])

    mesh.animations = [spin, pulse]
    const spinScaleAnimatable = scene.beginAnimation(mesh, 0, PLASMA_ANIM_CYCLE_FRAMES, true)

    // same 3-key low/high/low shape as the scale pulse above ("similar on
    // how they scale animate too"), just targeting visibility (0-1) instead
    // of scaling.
    const visibilityPulse = new Animation(`plasma_visibility_${mesh.name}`, "visibility", PLASMA_ANIM_FPS, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE)
    visibilityPulse.setKeys([
        { frame: 0, value: PLASMA_VISIBILITY_MIN },
        { frame: PLASMA_ANIM_CYCLE_FRAMES / 2, value: PLASMA_VISIBILITY_MAX },
        { frame: PLASMA_ANIM_CYCLE_FRAMES, value: PLASMA_VISIBILITY_MIN },
    ])
    // beginDirectHierarchyAnimation (not beginDirectAnimation targeting
    // just `mesh`) - unlike rotation/scaling, a mesh's own .visibility does
    // NOT cascade down to its children: transform properties compose
    // through the scene graph automatically (a parent's rotation/scale
    // already visually affects every descendant, which is why spin/pulse
    // above only ever needed to touch the root clone), but .visibility is a
    // per-node RENDER property each mesh reads independently. plasma.glb's
    // actual visible geometry lives on child mesh(es) under the cloned root
    // (loadModel's own "skip __root__ and empty nodes" picks the mesh WITH
    // geometry as the template, but that mesh can still have its own child
    // primitives) - animating only the root's .visibility was doing
    // nothing visible at all, exactly the "vanishing none" symptom. This
    // hierarchy variant runs the SAME animation on the root AND every
    // descendant, so whichever node actually renders gets it too. Returns
    // one Animatable PER node in the hierarchy (root + each descendant).
    const visibilityAnimatables = scene.beginDirectHierarchyAnimation(mesh, false, [visibilityPulse], 0, PLASMA_ANIM_CYCLE_FRAMES, true)
    // goToFrame (not a shifted from/to range) - the animation's own keys
    // only cover frames 0-PLASMA_ANIM_CYCLE_FRAMES, so asking
    // beginDirectAnimation to loop some OTHER range like
    // staggerFrames..staggerFrames+CYCLE would run past the last real
    // keyframe and just hold there instead of looping. Starting the loop
    // normally at 0 and then immediately jumping its current playback
    // position is what actually phase-shifts it while keeping the loop
    // range valid.
    if(staggerFrames){
        visibilityAnimatables.forEach(a => a.goToFrame(staggerFrames % PLASMA_ANIM_CYCLE_FRAMES))
    }

    return [spinScaleAnimatable, ...visibilityAnimatables]
}

// Same "treat the source image's own black background as transparent"
// (getAlphaFromRGB) technique skillEffects.js's own getGenericTransparentTextureMat/
// getGenericIconMat already use for every other projectile texture in this
// codebase - kept consistent here rather than reaching for materials.js's
// createTransparentMat (ALPHA_ADD additive blending), which is a visually
// different technique (glow-style "add", not real alpha transparency) and
// wasn't actually clearing explodeTex.webp's black background on this GLB
// mesh the way it does on a flat plane.
//
// color ({r,g,b}, 0-1 each) tints the diffuse (and, when isEmissive, the
// glow too) - optional, defaults to no tint (plain white, i.e. the texture's
// own colors untouched). isEmissive makes the clone self-lit/glowing
// (ignores scene lighting for its own brightness, same as every "icon"-style
// material elsewhere) - optional and OFF by default, since a real 3D model
// (unlike a flat HUD-style icon) might legitimately want to just sit lit by
// normal scene lighting instead.
function createPlasmaMat(scene, texturePath, color, isEmissive){
    const mat = new StandardMaterial(`plasma_mat_${Date.now()}`, scene)
    const tex = new Texture(texturePath, scene)
    tex.getAlphaFromRGB = true
    mat.diffuseTexture = tex
    mat.opacityTexture = tex
    mat.backFaceCulling = false
    mat.specularColor = new Color3(0, 0, 0)

    const tint = color ? new Color3(color.r, color.g, color.b) : new Color3(1, 1, 1)
    mat.diffuseColor = tint
    if(isEmissive){
        mat.emissiveTexture = tex
        mat.emissiveColor = tint
    }
    return mat
}

// qnty clones of the "plasma" GLB (PROJECTILE_MODEL_PATHS above), all
// parented onto parentMesh (a skill's own projectile mesh - pyroclasmSkill's
// crossed-blade box is the first caller, via renderGenericProjectile in
// skillEffects.js), each sharing one createPlasmaMat built from `texture`/
// `color`/`isEmissive`.
//
// rotationX applies to every clone - GLB meshes come in with
// rotationQuaternion already set (glTF stores rotation as quaternions),
// which makes Babylon silently ignore a plain .rotation assignment, so
// that's nulled out first, same trap renderGenericProjectile's own
// "glbModel" shape branch (skillEffects.js) already documents.
//
// Returns { meshes, material, animatables } rather than just the mesh array -
// material is ONE shared instance across every clone in this call (not a
// per-clone copy, no reason to pay for that when they all want the exact
// same look), so the caller disposes it once on its own, separately from
// disposing each mesh (mesh.dispose(false, false) - false for
// materialAndTextures, since this shared material isn't owned by any single
// one of them). animatables is one Animatable per mesh (addLifeAnimation
// above) - the caller stops each on cleanup too.
export function createPlasma(qnty, texture, parentMesh, rotationX, color, isEmissive){
    const scene = parentMesh.getScene()
    const material = createPlasmaMat(scene, texture, color, isEmissive)

    const meshes = []
    const animatables = []
    for(let i = 0; i < qnty; i++){
        const inst = createProjectileModelInstance(scene, "plasma", parentMesh)
        if(!inst) continue
        inst.rotationQuaternion = null
        inst.rotation.x = rotationX
        // straight line trailing back along -Z, growing bigger the further
        // back it sits - see PLASMA_LINE_SPACING/PLASMA_LINE_SCALE_STEP's
        // own comment above
        inst.position = new Vector3(0, 0, -i * PLASMA_LINE_SPACING)
        const lineScale = 1 + i * PLASMA_LINE_SCALE_STEP
        inst.scaling = new Vector3(lineScale, lineScale, lineScale)
        inst.material = material
        // addGlow (tools/glow.js) is the actual bloom/halo effect every
        // other glowing mesh in this game uses (swords, arcs, magic circle
        // planes) - emissiveColor/emissiveTexture alone (createPlasmaMat
        // above) only makes the mesh render bright regardless of scene
        // lighting, it doesn't put a soft light halo around it the way
        // "glowing" reads visually elsewhere. Gated on isEmissive since the
        // GlowLayer reads material.emissiveColor - a non-emissive material
        // would just glow as black/nothing anyway (addGlow's own
        // customEmissiveColorSelector fallback).
        if(isEmissive) addGlow(scene, inst, PLASMA_GLOW_INTENSITY)
        meshes.push(inst)
        // spreads the qnty clones' heartbeat pulses evenly across one full
        // cycle (index 0 always starts un-staggered, at frame 0) - see
        // addLifeAnimation's own staggerFrames comment for why only the
        // visibility pulse actually uses this, not spin/scale
        const staggerFrames = (i * PLASMA_ANIM_CYCLE_FRAMES) / qnty
        animatables.push(...addLifeAnimation(scene, inst, staggerFrames))
    }
    return { meshes, material, animatables }
}
