import { Color3, Vector3 } from "@babylonjs/core"
import { DAYNIGHT_AREA_TYPES, getSunState } from "./dayNightSystem.js"
import { getActiveWeather } from "../effects/weather.js"
import { createFireflies, createGroundMist, createMoon } from "../effects/nightAtmosphere.js"
import { setMushroomNightGlow } from "../assetcreation/createmushroom.js"
import { openworldSurfaceY } from "../tools/groundHeight.js"

// THE NIGHT OUTDOORS - after dark in the open world and the village, the
// character setup forest's mood (setupbackdrop.js): fireflies in the woods,
// low mist creeping over the ground, the moon low in the sky, and the rare
// mushrooms glowing (createmushroom.js). dayNightSystem.js does the rest of
// it - the blue mist the world fades into, the moonlight.
//
// It all comes in at dusk and goes at dawn with the daylight, and the
// fireflies keep out of rain, snow and sandstorms. Lives and dies with the
// scene, like dayNightSystem.js.

// Fireflies only among trees: each is born beside one of the trees near the
// player, and the more trees there are about, the more of them - none out in
// an open field or on the village green. They stay where they're born, so a
// player walking on leaves them behind and meets new ones in the next wood.
// The openworld's trees stand on a 35-unit grid (infterrain), so even its
// thickest woods have them 20-45 apart - the reach has to be wide enough to
// find a few, and each tree's share is its whole canopy (tree_1 is ~10 across).
const FIREFLIES = {
    capacity: 100,
    // per second, for each tree within reach, up to the most
    perTree: 1, maxRate: 8,
    // how far from the player a tree still counts
    reach: 45,
    // where round a tree they're born: this far out from the trunk, this high off the ground
    fromTrunk: [1.2, 8], height: [0.4, 3.2],
}
// the trees (their source meshes - each one's .instances stays current as the
// openworld streams its chunks in and out): infterrain's, named t<x>_<z>, in
// the openworld; createvillage.js's three in the village
const OPENWORLD_TREE = /^t-?\d+_-?\d+$/
const VILLAGE_TREES = ["smallTree", "mediumTree", "bigTree"]
// looking for the openworld's tree kinds again now and then, in case one
// first turns up in a chunk that streams in later
const FIND_TREES_EVERY_UPDATES = 20
// the player's body position is its centre - about this far above its feet
const BODY_ABOVE_GROUND = 0.9
// the mist is born in a box round the player, round the body's centre, so
// the bottom of the box is about the ground. Bigger and fainter than the
// setup forest's (see createGroundMist): the camera looks down on it, so each
// sprite shows face-on, and only many of them overlapping read as a haze
// rather than separate puffs
const MIST = {
    min: new Vector3(-24, -0.9, -24), max: new Vector3(24, -0.2, 24), rate: 9, capacity: 160,
    color: new Color3(0.42, 0.52, 0.68), alpha: 0.05, size: [[6, 9], [10, 14]],
}
const NO_FIREFLIES_IN = ["rain", "snow", "sandstorm"]
// a sandstorm's grit is mist enough
const NO_MIST_IN = ["sandstorm"]

// the moon rides this far out from the camera, this high over the horizon -
// low enough to show over the trees when the camera looks out, not just
// straight up
const MOON_DISTANCE = 400
const MOON_ELEVATION = 0.32
const MOON_SIZE = 34

// how much night there is for these: none until the daylight's under this,
// all of it once the sun's fully down
const NIGHT_FROM_DAYLIGHT = 0.6
// re-checking the night and the weather - they move slowly
const UPDATE_EVERY_FRAMES = 30

const clamp01 = v => Math.min(1, Math.max(0, v))
const rand = (a, b) => a + Math.random() * (b - a)

function findTreeKinds(scene, areaType){
    if(areaType === "village") return VILLAGE_TREES.map(name => scene.getMeshByName(name)).filter(Boolean)
    const kinds = new Set()
    scene.meshes.forEach(mesh => {
        if(mesh.sourceMesh && OPENWORLD_TREE.test(mesh.name)) kinds.add(mesh.sourceMesh)
    })
    return [...kinds]
}

// getAnchor: () => what they gather round (the player's body) - the camera
// stands in until it exists
export function startNightAmbience(scene, areaType, getAnchor){
    if(!DAYNIGHT_AREA_TYPES.includes(areaType)) return

    const nightness = () => clamp01((NIGHT_FROM_DAYLIGHT - getSunState().daylight) / NIGHT_FROM_DAYLIGHT)
    let night = nightness()
    const emitAt = new Vector3()
    const follow = () => {
        const anchor = getAnchor?.()
        const at = anchor && !anchor.isDisposed() ? anchor.position : scene.activeCamera?.target ?? scene.activeCamera?.position
        if(at) emitAt.copyFrom(at)
    }
    follow()

    // the trees within FIREFLIES.reach of the player - their positions
    let treeKinds = findTreeKinds(scene, areaType)
    let updates = 0
    const nearTrees = []
    const findNearTrees = () => {
        // every time until the first trees have streamed in, then now and then
        if(areaType === "openworld" && (!treeKinds.length || ++updates % FIND_TREES_EVERY_UPDATES === 0)) treeKinds = findTreeKinds(scene, areaType)
        nearTrees.length = 0
        const reach2 = FIREFLIES.reach * FIREFLIES.reach
        treeKinds.forEach(kind => kind.instances?.forEach(tree => {
            const dx = tree.position.x - emitAt.x, dz = tree.position.z - emitAt.z
            if(dx * dx + dz * dz < reach2) nearTrees.push(tree.position)
        }))
    }
    findNearTrees()
    // beside a random one of them, a little way out from the trunk, off the
    // ground there - not the tree's own y: the openworld's billboard trees
    // stand at the middle of their card, metres up, and the village's trunks
    // are sunk into its floor. The openworld's real ground; the village's
    // floor is flat, so wherever my feet are
    const groundAt = areaType === "openworld" ? (x, z) => openworldSurfaceY(x, z) : () => emitAt.y - BODY_ABOVE_GROUND
    const spawnAmongTrees = out => {
        const tree = nearTrees[Math.floor(Math.random() * nearTrees.length)] ?? emitAt
        const a = Math.random() * Math.PI * 2
        const r = rand(FIREFLIES.fromTrunk[0], FIREFLIES.fromTrunk[1])
        const x = tree.x + Math.cos(a) * r, z = tree.z + Math.sin(a) * r
        out.set(x, groundAt(x, z, tree) + rand(FIREFLIES.height[0], FIREFLIES.height[1]), z)
    }
    const fireflyRate = () => Math.min(FIREFLIES.maxRate, nearTrees.length * FIREFLIES.perTree)

    // already drifting if the place is entered at night
    const fireflies = createFireflies(scene, {
        name: "night_fireflies", emitter: emitAt, spawnAt: spawnAmongTrees,
        rate: fireflyRate() * night, capacity: FIREFLIES.capacity, preWarm: night > 0 && nearTrees.length > 0,
    })
    const mist = createGroundMist(scene, { name: "night_mist", emitter: emitAt, ...MIST, preWarm: night > 0 })
    const moon = createMoon(scene, { name: "night_moon", size: MOON_SIZE })

    const moonAt = new Vector3()
    const away = new Vector3()
    const update = () => {
        night = nightness()
        const weather = getActiveWeather()
        // not worth looking for trees by day
        if(night) findNearTrees()
        // dying out at dawn rather than vanishing - the ones in the air live on
        fireflies.emitRate = NO_FIREFLIES_IN.includes(weather) ? 0 : fireflyRate() * night
        mist.emitRate = NO_MIST_IN.includes(weather) ? 0 : MIST.rate * night
        moon.setVisibility(night)
        setMushroomNightGlow(scene, night)
    }
    update()

    let frame = 0
    return scene.onBeforeRenderObservable.add(() => {
        follow()
        if(++frame % UPDATE_EVERY_FRAMES === 0) update()
        const camera = scene.activeCamera
        if(!night || !camera) return
        // across the sky opposite the sun (dayNightSystem.js's angle), from one
        // side to the other over the night - but always this low, so the third-
        // person camera, looking down at the player, still catches it near the
        // horizon
        const across = -Math.cos(getSunState().angle)
        away.set(across, 0, 0.6).normalize()
        away.set(away.x * Math.cos(MOON_ELEVATION), Math.sin(MOON_ELEVATION), away.z * Math.cos(MOON_ELEVATION))
        moonAt.copyFrom(camera.position)
        away.scaleAndAddToRef(MOON_DISTANCE, moonAt)
        moon.place(moonAt, away)
    })
}
