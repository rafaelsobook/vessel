import { Color3, LoadAssetContainerAsync, StandardMaterial, Texture } from "@babylonjs/core"
import "@babylonjs/loaders"

// Wings - models/wings/wings.glb. Each model in it (wing1, ...) is a skinned
// mesh on the glb's own small rig (wings_rig: wings_root -> wing_upper ->
// wing_fore -> wing_hand -> the feathers, .L and .R), with an "idle" clip (a
// slow flap, 2.5 s) and a "flying" one (1.5 s). A character wears them by
// carrying a copy of that whole rig on its bodytarget - the box riding its
// spine bone (createcharacter.js). Parenting the mesh alone wouldn't do: a
// skinned mesh goes where its bones go, not where its parent goes. Painted
// from images/modeltex/wings/<texture>.jpg.
//
// character.wings is what a character wears ({ root, wingmodel, wingtexture,
// play, stop }), null for none; character.winganims is every clip of the rig
// (whatever wings.glb holds - idle, flying, jumped, sleeping... a new clip in the
// glb is here with no change to this file), [] for none. Leaving with the
// character is automatic: the rig hangs under its body, so disposing the body
// takes the wings, and their own skeleton and clips go with them (attachWings'
// onDispose).
//
// What the wings play follows the body (createWingDriver): "flying" while it's
// falling, "sleeping" while it sleeps or rests, "idle" otherwise. Anything else -
// "jumped" is a take-off, for a flight to come - is asked for by hand:
// character.wings.play("jumped", { onComplete }), and the body-driven clip
// takes back over when it's done (or at wings.stop()).

const WINGS_GLB = "./models/wings/wings.glb"
// where a wing texture is looked for, in order - its own folder, then the
// general model textures'
const WING_TEXTURE_DIRS = ["./images/modeltex/wings", "./images/modeltex"]
// every wing's relief, whatever it's painted with - images/modeltex/wings/wingnormal.webp
const WING_NORMAL = "./images/modeltex/wings/wingnormal.webp"
// how long "flying" flaps on a reveal before settling into "idle"
const REVEAL_FLAPS = 2
const SETTLE_SECONDS = 0.5
// what the wings play while nothing's asked of them: the body's animation state
// (tools/animation.js's ANIM_STATE) -> a wing clip; any other state is the rest clip
const WING_CLIP_FOR_STATE = { falling: "flying", sleeping: "sleeping" }
// ...and by the character's mode, which comes first: resting (the Rest button)
// plays the body's "structed" pose, which says nothing about sleeping
const WING_CLIP_FOR_MODE = { sleeping: "sleeping", resting: "sleeping" }
const WING_REST_CLIP = "idle"
const WING_BLEND_SECONDS = 0.25

// one load per scene, every pair of wings a copy of it
const containersByScene = new WeakMap()
export function loadWings(scene){
    let loading = containersByScene.get(scene)
    if(!loading){
        loading = LoadAssetContainerAsync(WINGS_GLB, scene)
        // a failed load can be tried again later
        loading.catch(() => containersByScene.delete(scene))
        containersByScene.set(scene, loading)
    }
    return loading
}

// one material per texture per scene, shared by every pair painted with it
const materialsByScene = new WeakMap()
function wingMaterial(scene, textureName){
    let byName = materialsByScene.get(scene)
    if(!byName) materialsByScene.set(scene, byName = new Map())
    let mat = byName.get(textureName)
    if(!mat){
        mat = new StandardMaterial(`wingMat.${textureName}`, scene)
        // invertY false: the mesh's UVs are glTF's (origin top left), and this
        // image doesn't come through the glTF loader, which would flip for it
        const urlIn = dir => `${dir}/${textureName}.jpg`
        let tried = 0
        const texture = new Texture(urlIn(WING_TEXTURE_DIRS[0]), scene, false, false, Texture.TRILINEAR_SAMPLINGMODE, null,
            () => { if(++tried < WING_TEXTURE_DIRS.length) texture.updateURL(urlIn(WING_TEXTURE_DIRS[tried])) })
        mat.diffuseTexture = texture
        // same loading as the colour image, so the two line up on the UVs
        mat.bumpTexture = new Texture(WING_NORMAL, scene, false, false)
        // feathers don't shine
        mat.specularColor = new Color3(0.08, 0.08, 0.08)
        // a wing is a thin sheet - seen from either side
        mat.backFaceCulling = false
        byName.set(textureName, mat)
    }
    return mat
}

const easeOutBack = t => {
    const c1 = 1.70158, c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

// The wings opening out of the back: from nothing to a little past full size
// and back, with "flying"'s big flaps for a moment before the idle takes over.
function reveal(scene, wings, clips, onDone, seconds = 0.6){
    const { root } = wings
    // the glb's handedness flip (scaling z -1) stays in, only scaled
    const full = root.scaling.clone()
    let t = 0
    const grow = scene.onBeforeRenderObservable.add(() => {
        t = Math.min(1, t + scene.getAnimationRatio() / 60 / seconds)
        full.scaleToRef(Math.max(0.001, easeOutBack(t)), root.scaling)
        if(t < 1) return
        root.scaling.copyFrom(full)
        scene.onBeforeRenderObservable.remove(grow)
    })
    root.onDisposeObservable.addOnce(() => scene.onBeforeRenderObservable.remove(grow))

    const { flying, idle } = clips
    if(!flying || !idle){
        (idle ?? flying)?.start(true)
        onDone()
        return
    }
    idle.stop()
    flying.start(true)
    flying.weight = 1
    const flapSeconds = (flying.to - flying.from) / (flying.targetedAnimations[0]?.animation.framePerSecond ?? 60)
    let elapsed = 0
    const settle = scene.onBeforeRenderObservable.add(() => {
        elapsed += scene.getAnimationRatio() / 60
        const into = (elapsed - flapSeconds * REVEAL_FLAPS) / SETTLE_SECONDS
        if(into <= 0) return
        if(!idle.isPlaying){
            idle.start(true)
            idle.weight = 0
        }
        const w = Math.min(1, into)
        idle.weight = w
        flying.weight = 1 - w
        if(w < 1) return
        flying.stop()
        scene.onBeforeRenderObservable.remove(settle)
        onDone()
    })
    root.onDisposeObservable.addOnce(() => scene.onBeforeRenderObservable.remove(settle))
}

// The wings' animation: each frame the clip the body asks for (see
// WING_CLIP_FOR_STATE), crossfaded into from the last, unless a clip's been
// asked for by hand (play) - that one runs, and when it ends the body's takes
// over again. clips: every group of the rig, by their names up to the first "."
// ("idle.<owner>"). restClip: the one already playing. start() once the opening
// (reveal) is over - it has the clips until then.
function createWingDriver(scene, character, wings, clips, restClip){
    const named = name => clips.find(clip => clip.name.split(".")[0] === name)
    let current = restClip ?? null
    let from = null
    let blend = 1
    let asked = null
    let tick = null
    let frozen = false

    function clearAsked(){
        if(asked) asked.clip.onAnimationGroupEndObservable.remove(asked.onEnd)
        asked = null
    }

    function wanted(){
        if(asked) return asked
        const state = character.characterAnimations?.currentState()
        const name = WING_CLIP_FOR_MODE[character.mode] ?? WING_CLIP_FOR_STATE[state] ?? WING_REST_CLIP
        return { clip: named(name), loop: true, speed: 1 }
    }

    function onFrame(){
        if(character.wings !== wings) return
        // dead (worldsocket.js's playerDied): the wings stop where they are,
        // like the rest of the body under its death clip
        if(character.mode === "death"){
            if(!frozen) clips.forEach(clip => clip.pause())
            frozen = true
            return
        }
        const want = wanted()
        if(want.clip && want.clip !== current){
            from?.stop()
            from = current
            current = want.clip
            current.start(want.loop, want.speed)
            blend = from ? 0 : 1
            current.weight = blend
        }
        if(blend >= 1) return
        blend = Math.min(1, blend + scene.getAnimationRatio() / 60 / WING_BLEND_SECONDS)
        current.weight = blend
        if(from) from.weight = 1 - blend
        if(blend < 1) return
        from?.stop()
        from = null
    }

    return {
        start(){
            if(tick || wings.root.isDisposed()) return
            tick = scene.onBeforeRenderObservable.add(onFrame)
            wings.root.onDisposeObservable.addOnce(() => {
                scene.onBeforeRenderObservable.remove(tick)
                clearAsked()
            })
        },
        // clip: its name ("jumped"). Once unless loop (then until stop()).
        // false if the rig has no such clip.
        play(name, { loop = false, speed = 1, onComplete } = {}){
            const clip = named(name)
            if(!clip){
                console.warn(`[wings] no "${name}" clip in ${WINGS_GLB}`)
                return false
            }
            clearAsked()
            // asked for again while it's playing: from the top
            if(clip === current){
                clip.stop()
                current = null
            }
            const ask = { clip, loop, speed }
            asked = ask
            if(!loop){
                ask.onEnd = clip.onAnimationGroupEndObservable.add(() => {
                    if(asked !== ask) return
                    clearAsked()
                    onComplete?.()
                })
            }
            return true
        },
        // back to what the body asks for
        stop: clearAsked,
    }
}

// Puts wings on `character` (a createCharacter() rig), taking off any it
// already wears. wingdetail: { wingmodel, wingtexture } - which model in
// wings.glb, and which image in images/modeltex/wings. grow: open out with a
// flap (evolution.js) rather than just be there. Resolves to the wings, or
// null if they can't be made or the character went away while they loaded.
export async function attachWings(character, { wingmodel, wingtexture }, { grow = false } = {}){
    const scene = character?.bodytarget?.getScene()
    if(!scene || !wingmodel || !wingtexture) return null
    // names come over the network - only plain ones become part of a path
    if(!/^[\w-]+$/.test(wingmodel) || !/^[\w-]+$/.test(wingtexture)) return null
    let container
    try { container = await loadWings(scene) }
    catch(err){
        console.warn(`[wings] couldn't load ${WINGS_GLB}`, err)
        return null
    }
    if(scene.isDisposed || character.bodytarget.isDisposed()) return null

    const entries = container.instantiateModelsToScene(name => `${name}.${character.owner}`, false, { doNotInstantiate: true })
    const root = entries.rootNodes[0]
    const clips = {
        idle: entries.animationGroups.find(clip => clip.name.startsWith("idle.")),
        flying: entries.animationGroups.find(clip => clip.name.startsWith("flying.")),
    }
    root.onDisposeObservable.addOnce(() => {
        entries.animationGroups.forEach(clip => clip.dispose())
        entries.skeletons.forEach(skeleton => skeleton.dispose())
    })

    // just the asked-for model - the glb can hold more than one on its rig
    const meshes = root.getChildMeshes(false).filter(mesh => mesh.getTotalVertices() > 0)
    const worn = meshes.filter(mesh => mesh.name.startsWith(`${wingmodel}.`))
    if(!worn.length){
        console.warn(`[wings] no "${wingmodel}" in ${WINGS_GLB}`)
        root.dispose()
        return null
    }
    meshes.forEach(mesh => { if(!worn.includes(mesh)) mesh.dispose() })
    // good ones - the old pair, if any, comes off only now
    removeWings(character)
    const material = wingMaterial(scene, wingtexture)
    worn.forEach(mesh => {
        mesh.material = material
        // not pickable: indoors the camera fades every pickable mesh between
        // it and you (camera.js's room occlusion), and wings on your back
        // would be between them every time you're seen from behind
        mesh.isPickable = false
        // a skinned mesh's bounds are those of its bind pose, not of the
        // flapping wings - never culled by them
        mesh.alwaysSelectAsActiveMesh = true
    })

    root.parent = character.bodytarget
    entries.animationGroups.forEach(clip => clip.stop())
    const wings = { root, wingmodel, wingtexture }
    const driver = createWingDriver(scene, character, wings, entries.animationGroups, clips.idle)
    wings.play = driver.play
    wings.stop = driver.stop
    character.wings = wings
    character.winganims = entries.animationGroups
    if(grow) reveal(scene, wings, clips, driver.start)
    else {
        clips.idle?.start(true)
        driver.start()
    }
    return wings
}

export function removeWings(character){
    if(!character?.wings) return
    character.wings.root.dispose()
    character.wings = null
    character.winganims = []
}
