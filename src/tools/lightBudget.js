import { PointLight } from "@babylonjs/core"

// POINT LIGHT BUDGET - only the MAX_ACTIVE_POINT_LIGHTS point lights nearest
// the player are ever switched on; every other point light in the scene is
// disabled until the player gets closer to it than to one of those.
//
// Why: Babylon spends one uniform block per light in every material's shader,
// and the user's GPU only has 12 - a material taking ~9+ lights fails to
// compile outright (createdungeon.js's room light pool comment). Places keep
// adding point lights on their own (village lamp posts, fire_light from every
// campfire/fireplace, lightning flashes, the dungeon's room lights), so the cap
// is enforced here, once, for all of them.
//
// Swapping WHICH lights are on costs nothing: once 5 are on, every material
// keeps seeing exactly 5 point lights, so its shader never has to recompile -
// only the light positions/colours fed into it change.
// Directional/hemispheric lights aren't touched - a place has one or two at
// most, and together with these 5 they stay under the 8-light ceiling.
const MAX_ACTIVE_POINT_LIGHTS = 5
// re-ranked every Nth frame - lights don't need to switch the instant you move
const RECHECK_FRAMES = 15

// Starts the budget for `scene`. getFocus returns the world position lights are
// ranked by (the player's body) - falls back to the active camera while it
// doesn't exist yet. Lives and dies with the scene's own observable.
export function startPointLightBudget(scene, getFocus){
    // Babylon switches a new light on the moment it's made, but only tells
    // onNewLightAddedObservable about it a timer later (Scene.addLight defers
    // that with SetImmediate). The guild hall's ten torches, made in one go,
    // were all on until the next rank - and a material compiled in that gap (a
    // frame, a whenReadyAsync check, another load finishing) took every one of
    // them, made worse by the glTF loader raising every material's
    // maxSimultaneousLights to the scene's whole light count after each load.
    // Past ~8 lights that shader fails to compile on the user's GPU, and a
    // material whose shader failed never becomes ready again, even once the
    // extra lights are off - so the scene never became ready and the place
    // hung on its loading screen, now and then, depending on timing. A point
    // light made while MAX_ACTIVE_POINT_LIGHTS are already on starts off
    // instead; the next rank switches it on if it's one of the nearest.
    const addLight = scene.addLight.bind(scene)
    scene.addLight = light => {
        if(light instanceof PointLight){
            const on = scene.lights.filter(l => l instanceof PointLight && l.isEnabled(false)).length
            if(on >= MAX_ACTIVE_POINT_LIGHTS) light.setEnabled(false)
        }
        addLight(light)
    }

    let frame = 0
    const rank = () => {
        const focus = getFocus?.() ?? scene.activeCamera?.position
        if(!focus) return
        const pointLights = scene.lights.filter(l => l instanceof PointLight)
        if(pointLights.length <= MAX_ACTIVE_POINT_LIGHTS){
            pointLights.forEach(l => { if(!l.isEnabled(false)) l.setEnabled(true) })
            return
        }
        pointLights
            .map(light => ({ light, d: light.position.subtract(focus).lengthSquared() }))
            .sort((a, b) => a.d - b.d)
            .forEach(({ light }, i) => {
                const on = i < MAX_ACTIVE_POINT_LIGHTS
                // only on a change - setEnabled marks every lit mesh dirty
                if(light.isEnabled(false) !== on) light.setEnabled(on)
            })
    }
    rank()

    // A burst of new point lights (the dungeon's 16 torches, a village full of
    // campfires) is ranked as soon as Babylon announces them, rather than up to
    // RECHECK_FRAMES later with every one of them still switched on. Babylon
    // fires onNewLightAddedObservable a tick after the light is built
    // (TimingTools.SetImmediate), once per light - the microtask folds each
    // batch of those into a single re-rank.
    let rankQueued = false
    const queueRank = light => {
        if(rankQueued || !(light instanceof PointLight)) return
        rankQueued = true
        queueMicrotask(() => {
            rankQueued = false
            if(!scene.isDisposed) rank()
        })
    }
    scene.onNewLightAddedObservable.add(queueRank)
    scene.onLightRemovedObservable.add(queueRank)

    return scene.onBeforeRenderObservable.add(() => {
        if(++frame % RECHECK_FRAMES === 0) rank()
    })
}
