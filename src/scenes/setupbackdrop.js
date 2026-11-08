import {
    ArcRotateCamera, Color3, Color4, DirectionalLight, HemisphericLight, LoadAssetContainerAsync,
    Material, Matrix, Mesh, MeshBuilder, NoiseProceduralTexture, Quaternion, Scene, ShadowGenerator,
    StandardMaterial, Texture, Vector3,
} from "@babylonjs/core"
import "@babylonjs/loaders"
import { mergeAndLoadModel } from "../tools/loadmodel.js"
import { swayInWind } from "../tools/windSway.js"
import { createFireParticles } from "../tools/particlesystem.js"
import { createMushroomModel, MUSHROOM_NIGHT_GLOW } from "../assetcreation/createmushroom.js"
import { findDeepByName } from "../charactersystem/createcharacter.js"
import { NIGHT_FOG_COLOR, MOONLIGHT, createFireflies, createGroundMist, createMoon } from "../effects/nightAtmosphere.js"

// THE CHARACTER SETUP BACKDROP (setupcharacterscene.js) - the first thing a
// new player sees: their character riding the mythical beast in a forest
// clearing at dusk. Cool blue mist the trees fade into, a moon low behind
// them, a campfire in front lighting the rider's face warm (warm key against
// a cool world, so the character stands out from it), the moon catching
// their outline from behind, fireflies, glowing mushrooms and low mist
// drifting through grass that sways in a slow breeze.
//
// The beast stands at the origin facing -Z, the rider on its back. The camera
// looks at the rider from the beast's +X side, a little ahead of its
// shoulder: the rider's face in profile and the whole outfit. Further round
// the front, the horns hide the rider's face; from behind, all you see is
// their back. Players can drag to look around within limits; left alone it
// drifts back and sways gently.
//
// The trees are the heaviest thing here (tree_1.glb is ~7MB) - they stream in
// after everything else is up and fade in out of the mist, so the scene
// shows without waiting on them.

const BEAST_MODEL = "./models/monsters/mythicalbeast.glb"
// the model is ~2.9m to the tip of its horns - this makes it a mount the
// rider doesn't vanish on
const BEAST_SCALE = 0.82
// where the rider's root sits from the beast's middlespine bone, and how far
// their thighs open to straddle it (avatar.glb's "sitting" is a chair pose,
// knees together)
const SEAT_OFFSET = new Vector3(0, -0.3, 0.07)
const LEG_SPLAY = 0.55

const FOG_COLOR = NIGHT_FOG_COLOR
const FOG_DENSITY = 0.045
// ahead of the beast and beyond it, where the rider is looking - lighting
// their face, and in the lower left of the camera's view, left of the
// category icons (createcharacterpage.js)
const FIRE_SPOT = new Vector3(-1.65, 0, -2.4)
// warm enough to read as firelight, not so strong it tints the outfit the
// player is choosing colours for
const FIRE_INTENSITY = 1.5

// the camera: on the rider, from the beast's side (see the header). Low and
// looking a little up - heroic, and it lifts the rider clear of the gender
// buttons (createcharacterpage.js) in the lower middle of the screen
export const RIDER_CAMERA = {
    alpha: -0.3, beta: 1.52, radius: 4.4, target: new Vector3(0, 1.2, -0.3),
    alphaRange: 0.65, betaMin: 1.1, betaMax: 1.62, radiusMin: 3, radiusMax: 6.5,
    // how long after the player lets go before it drifts back to sway on its own
    idleMs: 3500,
}

const rand = (a, b) => a + Math.random() * (b - a)

// where RIDER_CAMERA starts, on the ground plane - nothing tall grows right
// in front of the lens
function cameraGroundSpot(){
    const c = RIDER_CAMERA
    return {
        x: c.target.x + c.radius * Math.cos(c.alpha) * Math.sin(c.beta),
        z: c.target.z + c.radius * Math.sin(c.alpha) * Math.sin(c.beta),
    }
}

// ── the world ────────────────────────────────────────────────────────────────

export async function createRidingForest(scene){
    scene.clearColor = new Color4(FOG_COLOR.r, FOG_COLOR.g, FOG_COLOR.b, 1)
    scene.fogMode = Scene.FOGMODE_EXP2
    scene.fogColor = FOG_COLOR
    scene.fogDensity = FOG_DENSITY
    scene.ambientColor = new Color3(0.05, 0.06, 0.09)

    // the night sky's light: cool from above, the moss's green from below.
    // Kept fairly neutral - it's most of what lights the side of the rider
    // the camera sees, and the outfit's colours should read true
    const sky = new HemisphericLight("setup_sky", new Vector3(0, 1, 0), scene)
    sky.diffuse = new Color3(0.5, 0.56, 0.72)
    sky.groundColor = new Color3(0.08, 0.1, 0.07)
    sky.specular = Color3.Black()
    sky.intensity = 0.62

    // the moon, low behind the beast - the rim on the rider and the beast,
    // and the long shadows reaching toward the camera
    const moon = new DirectionalLight("setup_moon", new Vector3(0.75, -0.45, 0.3), scene)
    moon.diffuse = MOONLIGHT
    moon.specular = new Color3(0.2, 0.25, 0.4)
    moon.intensity = 0.9
    moon.position = new Vector3(-20, 14, -8)
    const shadowGenerator = new ShadowGenerator(1024, moon)
    shadowGenerator.useBlurExponentialShadowMap = true
    shadowGenerator.blurKernel = 16
    shadowGenerator.darkness = 0.35

    // the campfire in front of the beast: its warm light on the rider's face
    createFireParticles(FIRE_SPOT, scene, { intensity: FIRE_INTENSITY, range: 11 })
    placeBonfire(scene, shadowGenerator)

    createGround(scene)
    // the moon low over the trees, upper left of RIDER_CAMERA's view, above
    // the category icons; its halo behind it
    createMoon(scene, { name: "setup_moon" }).place(new Vector3(-80, 20, -6), new Vector3(-1, 0, 0))
    createFireflies(scene, { name: "setup_fireflies", min: new Vector3(-9, 0.3, -9), max: new Vector3(7, 3.4, 9) })
    // thickest in the distance behind the beast
    createGroundMist(scene, { name: "setup_mist", min: new Vector3(-16, 0.1, -14), max: new Vector3(6, 0.7, 14) })
    scatterGrass(scene)
    scatterRocks(scene, shadowGenerator)
    scatterGlowingMushrooms(scene)

    const beast = await loadBeast(scene, shadowGenerator)
    // not awaited - see the header
    plantTrees(scene)

    return {
        shadowGenerator,
        beast,
        seatRider: (root, animationGroups) => seatRider(scene, beast, root, animationGroups),
    }
}

// the camera on the rider, with limited orbit and an idle sway
export function createRiderCamera(scene){
    const c = RIDER_CAMERA
    const cam = new ArcRotateCamera("setup_camera", c.alpha, c.beta, c.radius, c.target.clone(), scene)
    cam.fov = 0.72
    cam.minZ = 0.1
    cam.lowerAlphaLimit = c.alpha - c.alphaRange
    cam.upperAlphaLimit = c.alpha + c.alphaRange
    cam.lowerBetaLimit = c.betaMin
    cam.upperBetaLimit = c.betaMax
    cam.lowerRadiusLimit = c.radiusMin
    cam.upperRadiusLimit = c.radiusMax
    cam.wheelDeltaPercentage = 0.01
    cam.panningSensibility = 0
    const canvas = scene.getEngine().getRenderingCanvas()
    if(canvas) cam.attachControl(canvas, true)

    // after a drag, ease back to where it started and sway a little, as if
    // the beast were shifting its weight under the rider
    let lastTouched = -Infinity
    scene.onPointerObservable.add(() => { lastTouched = performance.now() })
    let t = 0
    scene.onBeforeRenderObservable.add(() => {
        const dt = scene.getEngine().getDeltaTime() / 1000
        t += dt
        if(performance.now() - lastTouched < c.idleMs) return
        const ease = 1 - Math.exp(-dt * 0.8)
        cam.alpha += (c.alpha + Math.sin(t * 0.17) * 0.12 - cam.alpha) * ease
        cam.beta += (c.beta + Math.sin(t * 0.11) * 0.03 - cam.beta) * ease
        cam.radius += (c.radius - cam.radius) * ease
    })
    return cam
}

// ── the beast and its rider ──────────────────────────────────────────────────

async function loadBeast(scene, shadowGenerator){
    const container = await LoadAssetContainerAsync(BEAST_MODEL, scene)
    container.addAllToScene()
    const root = container.meshes[0]
    root.scaling.scaleInPlace(BEAST_SCALE)
    container.meshes.forEach(m => {
        m.isPickable = false
        m.receiveShadows = true
    })
    shadowGenerator.addShadowCaster(root, true)
    container.animationGroups.forEach(anim => anim.stop())
    container.animationGroups.find(anim => anim.name === "idle")?.start(true)
    const spine = container.transformNodes.find(node => node.name === "middlespine")
    return { root, spine, anims: container.animationGroups }
}

// root: the avatar's glTF root. Sits it on the beast's back every frame (so it
// rides the beast's breathing), in avatar.glb's "sitting" pose with its thighs
// opened to straddle, a slow sway through the body and the head turning now
// and then to look around.
function seatRider(scene, beast, root, animationGroups){
    animationGroups.forEach(anim => anim.stop())
    animationGroups.find(anim => anim.name.toLowerCase() === "sitting")?.start(true)
    // facing the way the beast does (-Z), toward its head - turned half round
    // from the glTF root's own facing, which sat the rider looking at the tail
    root.rotationQuaternion = null
    root.rotation.set(0, Math.PI, 0)

    const bone = name => findDeepByName(root, node => node.name === name || node.name.endsWith(` ${name}`))
    const legL = bone("upperLeg.L"), legR = bone("upperLeg.R")
    const spine = bone("upperSpine") ?? bone("spine")
    const head = bone("head")
    const splayL = Quaternion.RotationAxis(Vector3.Forward(), LEG_SPLAY)
    const splayR = Quaternion.RotationAxis(Vector3.Forward(), -LEG_SPLAY)
    const sway = new Quaternion()
    const look = new Quaternion()
    let t = 0

    scene.onBeforeRenderObservable.add(() => {
        if(!beast.spine) return
        beast.spine.computeWorldMatrix(true)
        root.position.copyFrom(beast.spine.getAbsolutePosition()).addInPlace(SEAT_OFFSET)
    })
    // after the pose is applied, so these add to it instead of being overwritten
    scene.onAfterAnimationsObservable.add(() => {
        t += scene.getEngine().getDeltaTime() / 1000
        legL?.rotationQuaternion?.multiplyInPlace(splayL)
        legR?.rotationQuaternion?.multiplyInPlace(splayR)
        if(spine?.rotationQuaternion){
            Quaternion.RotationYawPitchRollToRef(Math.sin(t * 0.6) * 0.04, Math.sin(t * 1.3) * 0.025, Math.sin(t * 0.8) * 0.03, sway)
            spine.rotationQuaternion.multiplyInPlace(sway)
        }
        if(head?.rotationQuaternion){
            // mostly still, now and then a slow look aside
            const glance = Math.sin(t * 0.23) * 0.5 + Math.sin(t * 0.07) * 0.3
            Quaternion.RotationYawPitchRollToRef(glance * 0.45, Math.sin(t * 0.31) * 0.05, 0, look)
            head.rotationQuaternion.multiplyInPlace(look)
        }
    })
}

// ── the clearing ─────────────────────────────────────────────────────────────

function createGround(scene){
    const ground = MeshBuilder.CreateGround("setup_ground", { width: 160, height: 160 }, scene)
    const mat = new StandardMaterial("setup_ground_mat", scene)
    // mottled moss - drawn once, not every frame
    const noise = new NoiseProceduralTexture("setup_ground_noise", 256, scene)
    noise.octaves = 4
    noise.persistence = 0.8
    noise.brightness = 0.55
    noise.refreshRate = 0
    noise.uScale = noise.vScale = 22
    mat.diffuseTexture = noise
    mat.diffuseColor = new Color3(0.28, 0.36, 0.2)
    mat.specularColor = Color3.Black()
    ground.material = mat
    ground.receiveShadows = true
    ground.isPickable = false
}

function placeBonfire(scene, shadowGenerator){
    mergeAndLoadModel("./models/outdors/bonfire.glb", scene).then(logs => {
        if(!logs || scene.isDisposed) return
        logs.position.copyFrom(FIRE_SPOT)
        logs.scaling.setAll(1.3)
        logs.isPickable = false
        logs.receiveShadows = true
        shadowGenerator.addShadowCaster(logs)
    }).catch(err => console.warn("[setupbackdrop] bonfire", err))
}

// grass cards - the village's tufts (black reads as clear), two crossed
// planes each, thin-instanced: a lot of them for very little. All of them
// sway in a slow breeze (tools/windSway.js) - sway is that file's strength:
// the stiff bushes barely, the flowers on their thin stems a little more
function scatterGrass(scene){
    const kinds = [
        { file: "grass_black.jpg", w: 0.9, h: 0.75, count: 260, sway: 0.08 },
        { file: "grass2_black.jpg", w: 0.9, h: 0.9, count: 220, sway: 0.07 },
        { file: "bush1.jpg", w: 1.2, h: 1.0, count: 50, sway: 0.035 },
        { file: "flower1.jpg", w: 0.5, h: 0.45, count: 70, sway: 0.15 },
    ]
    const cam = cameraGroundSpot()
    kinds.forEach(({ file, w, h, count, sway }) => {
        const tex = new Texture(`./images/textures/grass/${file}`, scene)
        tex.getAlphaFromRGB = true
        const mat = new StandardMaterial(`setup_${file}_mat`, scene)
        mat.diffuseTexture = tex
        mat.opacityTexture = tex
        mat.transparencyMode = Material.MATERIAL_ALPHATEST
        mat.alphaCutOff = 0.3
        mat.backFaceCulling = false
        mat.specularColor = Color3.Black()
        swayInWind(mat, sway)
        const a = MeshBuilder.CreatePlane(`setup_${file}_a`, { width: w, height: h }, scene)
        const b = MeshBuilder.CreatePlane(`setup_${file}_b`, { width: w, height: h }, scene)
        b.rotation.y = Math.PI / 2
        const tuft = Mesh.MergeMeshes([a, b], true)
        tuft.bakeTransformIntoVertices(Matrix.Translation(0, h / 2, 0))
        tuft.material = mat
        tuft.isPickable = false
        const matrices = []
        for(let i = 0; i < count; i++){
            // a ring round the clearing, thinning right under the beast
            const angle = Math.random() * Math.PI * 2
            const r = 1.2 + Math.pow(Math.random(), 0.7) * 16
            const x = Math.cos(angle) * r, z = Math.sin(angle) * r
            // keep the lens and the strip between it and the rider clear of
            // tall tufts
            if(Math.hypot(x - cam.x, z - cam.z) < 3.2) continue
            // and round the campfire, so its flames show
            if(Math.hypot(x - FIRE_SPOT.x, z - FIRE_SPOT.z) < 1.6) continue
            if(x > 1.2 && Math.abs(z - x * Math.tan(RIDER_CAMERA.alpha)) < 1.4) continue
            const s = rand(0.7, 1.3)
            matrices.push(Matrix.Compose(new Vector3(s, s, s), Quaternion.RotationAxis(Vector3.Up(), Math.random() * Math.PI), new Vector3(x, 0, z)))
        }
        tuft.thinInstanceAdd(matrices)
    })
}

function scatterRocks(scene, shadowGenerator){
    mergeAndLoadModel("./models/rocks/rocks_1.glb", scene).then(rock => {
        if(!rock || scene.isDisposed) return
        rock.isVisible = false
        rock.isPickable = false
        // instances take it from here
        rock.receiveShadows = true
        const f = FIRE_SPOT
        const spots = [
            // round the fire
            [f.x + 1.1, f.z + 0.6, 1.1], [f.x - 0.9, f.z - 0.9, 0.9], [f.x + 0.8, f.z - 1.1, 0.7],
            [-2.6, 2.4, 1.8], [-3.4, -1.6, 2.4], [2.6, 3.2, 1.4], [-6, 5.5, 3], [-5, -6.5, 2.6],
        ]
        spots.forEach(([x, z, s], i) => {
            const inst = rock.createInstance(`setup_rock_${i}`)
            inst.position.set(x, 0, z)
            inst.scaling.setAll(s)
            inst.rotation.y = Math.random() * Math.PI * 2
            shadowGenerator.addShadowCaster(inst)
        })
    }).catch(err => console.warn("[setupbackdrop] rocks", err))
}

// clusters of softly glowing toadstools at the edge of the clearing
// (createmushroom.js's model and skins). Their own light only, not the glow
// layer: that's drawn over everything, so a cluster behind the beast glowed
// straight through its neck
function scatterGlowingMushrooms(scene){
    const clusters = [
        { kind: "bluemist", x: -2.2, z: 1.8, n: 4 },
        { kind: "galaxygreen", x: 2.8, z: 2.6, n: 3 },
        { kind: "bluemist", x: -1.6, z: -3.4, n: 3 },
        { kind: "purple", x: -4.5, z: -0.5, n: 4 },
        { kind: "bluemist", x: 2.2, z: -4.4, n: 3 },
    ]
    clusters.forEach(({ kind, x, z, n }) => {
        for(let i = 0; i < n; i++){
            createMushroomModel(scene, kind, rand(0.18, 0.5)).then(made => {
                if(!made) return
                made.root.position.set(x + rand(-0.45, 0.45), 0, z + rand(-0.45, 0.45))
                made.root.rotation.set(rand(-0.15, 0.15), Math.random() * Math.PI * 2, rand(-0.15, 0.15))
                made.mesh.material.emissiveColor = MUSHROOM_NIGHT_GLOW[kind].clone()
            }).catch(err => console.warn("[setupbackdrop] mushroom", err))
        }
    })
}

// the forest round the clearing - thickest behind the beast, framing the
// sides, open toward the camera. Streams in after the rest, fading out of
// the mist.
async function plantTrees(scene){
    const kinds = [
        { path: "./models/trees/tree_1.glb", weight: 0.75 },
        { path: "./models/trees/dead_tree_1.glb", weight: 0.25 },
    ]
    let templates
    try {
        templates = await Promise.all(kinds.map(k => mergeAndLoadModel(k.path, scene)))
    } catch (err) {
        return console.warn("[setupbackdrop] trees", err)
    }
    if(scene.isDisposed) return
    templates.forEach(t => {
        t.isVisible = false
        t.isPickable = false
        t.visibility = 0
    })
    const pick = () => Math.random() < kinds[0].weight ? templates[0] : templates[1]
    let n = 0
    const plant = (x, z, s) => {
        const tree = pick().createInstance(`setup_tree_${n++}`)
        tree.position.set(x, 0, z)
        tree.scaling.setAll(s)
        tree.rotation.y = Math.random() * Math.PI * 2
        tree.isPickable = false
    }
    // rings out into the mist; the camera's side (+X, within ~70° of it) kept open
    for(let ring = 0; ring < 4; ring++){
        const radius = 9 + ring * 7
        const count = 9 + ring * 5
        for(let i = 0; i < count; i++){
            const angle = (i / count) * Math.PI * 2 + rand(-0.15, 0.15) + ring
            const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius
            if(Math.abs(Math.atan2(z, x)) < 1.2 && ring < 2) continue
            plant(x + rand(-2, 2), z + rand(-2, 2), rand(0.7, 1.15))
        }
    }
    // fade in
    let t = 0
    const fade = scene.onBeforeRenderObservable.add(() => {
        t = Math.min(1, t + scene.getEngine().getDeltaTime() / 1500)
        templates.forEach(tmpl => tmpl.visibility = t)
        if(t < 1) return
        scene.onBeforeRenderObservable.remove(fade)
        // fully opaque now - off the alpha-blended path
        templates.forEach(tmpl => tmpl.visibility = 1)
    })
}
