import { Color3, Color4, Constants, DynamicTexture, Quaternion, StandardMaterial, TransformNode, Vector3, MeshBuilder, ParticleSystem } from "@babylonjs/core"
import { getSocketContainers, getPlayersOnScene } from "../sockets/worldsocket.js"
import { getCharState } from "../charactersystem/characterstate.js"
import { capsuleHeight } from "../charactersystem/createcharacter.js"
import { onMeleeConnect } from "../charactersystem/meleeCombat.js"
import { addCameraTrauma, punchCameraFov } from "../tools/cameraShake.js"
import { addGlow } from "../tools/glow.js"
import { getParticleTexture, particleTexturePath } from "../tools/particlesystem.js"
import { popShockRing } from "./shockRing.js"
import { sparkBurst } from "./blessingFx.js"
import { getAllSounds, playSoundNear } from "../components/soundSystem.js"
import { openworldGroundY } from "../tools/groundHeight.js"
import { OPENWORLD_PLACE_ID } from "../constants/constants.js"

// CRESCENT HOWL - the look of skillsData.js's crescenthowlSkill, the wave a
// weapon swing throws (models/projectiles/crescent.glb). Built as layers that
// each do one job and are over in a breath, the way a hit is built in
// meleeCombat.js:
//   1. WIND-UP  (windUp)  - light pulled into the weapon hand while the swing
//                           draws back: the beat of anticipation before it goes
//   2. RELEASE  (release) - a ring and dust off the caster's feet, a rush of air,
//                           and for the caster a kick of the camera and a punch
//                           of the FOV: the moment it leaves the blade
//   3. FLIGHT   (createWave) - the crescent unfurls out of the swing (springing
//                           past its size and back), a soft edge round it, a
//                           train of fading afterimages behind it, and a gash of
//                           light it carves in the ground under it as it goes
//   4. IMPACT   (wave.impact) - it cuts THROUGH (skill.projectileVisual.pierce):
//                           every body it passes flashes and is struck through
//                           meleeCombat.js's own blow (sparks, hitstop, shake,
//                           the weapon's sound - the caster's screen only), a
//                           ring and a spray of sparks off it on every screen
//   5. END      (wave.dispose) - at the end of its run it bursts, swelling and
//                           fading, instead of blinking out
// Everything is instanced off a few templates per form and scene - a fan of
// five waves leaving afterimages and a gash each is a few draw calls, not
// hundreds of meshes.
//
// Two forms (skill._castForm, stamped on the cast): a human's is white-hot in a
// blue edge, a demon's (evolution.js) black in a red one.

const LOOKS = {
    human: {
        core: new Color3(0.9, 0.97, 1), edge: new Color3(0.25, 0.6, 1), gash: new Color3(0.55, 0.88, 1),
        coreGlow: new Color3(0.75, 0.9, 1), edgeGlow: new Color3(0.2, 0.55, 1), spark: new Color3(0.6, 0.85, 1),
        coreBlend: Constants.ALPHA_ADD, edgeGlowBrightness: 1, edgeGrow: 1.22,
    },
    demon: {
        // a black core can't be drawn additively (adding black adds nothing) -
        // it's drawn over what's behind it, and only its edge glows
        core: new Color3(0.02, 0, 0.01), edge: new Color3(1, 0.08, 0.1), gash: new Color3(1, 0.12, 0.08),
        coreGlow: new Color3(0.22, 0, 0.03), edgeGlow: new Color3(1, 0.05, 0.08), spark: new Color3(1, 0.2, 0.15),
        // a wider red rim round the black, glowing softly - a bright glow is
        // composited over everything and would light the black core red too
        coreBlend: Constants.ALPHA_COMBINE, edgeGlowBrightness: 0.4, edgeGrow: 1.34,
    },
}
const formOf = skill => (skill?._castForm === "demon" ? "demon" : "human")

// the model is ~3.4 m tip to tip, ~1.7 m deep - its own size is the wave's at scale 1
const WAVE = {
    // how much it leans: tilted up at the front so a camera above and behind sees
    // its face, and rolled a little so it reads as a slash, each wave of a fan the
    // other way from its neighbour
    pitchDeg: -24, rollDeg: 10, fanRollDeg: 7,
    // the model at this size: ~4.6 m tip to tip - a wave that fills the view
    modelScale: 1.35,
    unfurlMs: 170, unfurlFrom: 0.3, // springs out of the blade to its full size
    ghosts: [{ lagMs: 60, alpha: 0.55, size: 0.95 }, { lagMs: 125, alpha: 0.34, size: 0.88 }, { lagMs: 200, alpha: 0.18, size: 0.8 }],
    historyMs: 260,
    // strips twice as long as they are apart, each fading to nothing at both
    // ends (gashTexture) - laid like that they add up to one even line
    gashEveryM: 0.8, gashMs: 1100, gashWidth: 1.7, gashLength: 1.6,
    endMs: 230, endGrow: 1.7,
    hitbox: { x: 4.4, y: 1.6, z: 2.2 }, // what the projectile box (0.7) is stretched to, before projectileScale
}
const BOX_SIZE = 0.7

// ── templates (per scene and form) ───────────────────────────────────────────
const templatesByScene = new WeakMap()

// The glb, with its import transform baked into the vertices and turned so its
// belly leads along +z (the projectile box's forward) and its tips trail - the
// way round is worked out from the vertices, not assumed, since an exporter can
// hand it over either way. (Also the dark slime's fury cutters' outline -
// effects/darkSlash.js.)
export function bakedCrescent(scene, base, name){
    const mesh = base.clone(name)
    mesh.makeGeometryUnique()
    mesh.setParent(null)
    mesh.position.setAll(0)
    mesh.bakeCurrentTransformIntoVertices()
    const pos = mesh.getVerticesData("position")
    let tipZ = 0, tipX = -Infinity, bellyZ = 0, bellyX = Infinity
    for(let i = 0; i < pos.length; i += 3){
        if(Math.abs(pos[i]) > tipX){ tipX = Math.abs(pos[i]); tipZ = pos[i + 2] }
        if(Math.abs(pos[i]) < bellyX){ bellyX = Math.abs(pos[i]); bellyZ = pos[i + 2] }
    }
    if(tipZ > bellyZ){
        mesh.rotationQuaternion = null
        mesh.rotation.set(0, Math.PI, 0)
        mesh.bakeCurrentTransformIntoVertices()
    }
    // centred on its own middle, so it turns and swells about itself
    mesh.refreshBoundingInfo()
    const centre = mesh.getBoundingInfo().boundingBox.center.clone()
    mesh.position.copyFrom(centre.scale(-1))
    mesh.bakeCurrentTransformIntoVertices()
    mesh.refreshBoundingInfo()
    return mesh
}

function material(scene, name, color, blend){
    const mat = new StandardMaterial(name, scene)
    // unlit, so its colour is its emissive (a diffuse comes out black with no
    // lighting) - and blended, so each instance's own alpha (instancedBuffers.color,
    // which multiplies the alpha) fades it
    mat.disableLighting = true
    mat.diffuseColor = Color3.Black()
    mat.emissiveColor = color
    mat.specularColor = Color3.Black()
    mat.backFaceCulling = false
    mat.alpha = 0.999
    mat.alphaMode = blend
    // light added on top hides nothing behind it - nor should it, by depth: a
    // shock ring on the ground would otherwise cut gaps in the gash
    if(blend === Constants.ALPHA_ADD) mat.disableDepthWrite = true
    return mat
}

// The gash's shape, as its opacity: a thin hot line down the middle of a soft
// glow, both running the strip's length (its v). Along the length it rises and
// falls as sin² - two strips half a length apart sum to exactly one, so the
// overlapping strips make one cut with no seams. One per scene.
const gashTextures = new WeakMap()
export function gashTexture(scene){
    let tex = gashTextures.get(scene)
    if(tex) return tex
    const W = 128, H = 64
    tex = new DynamicTexture("crescentHowl_gash", { width: W, height: H }, scene, true)
    const ctx = tex.getContext()
    const img = ctx.createImageData(W, H)
    for(let y = 0; y < H; y++){
        const v = y / (H - 1), along = Math.pow(Math.sin(Math.PI * v), 2)
        for(let x = 0; x < W; x++){
            const d = Math.abs(x / (W - 1) - 0.5) * 2
            const across = Math.max(0, Math.exp(-Math.pow(d / 0.09, 2)) + 0.5 * Math.exp(-Math.pow(d / 0.42, 2)) - 0.01)
            const a = Math.min(1, across * along)
            const i = (y * W + x) * 4
            img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
            img.data[i + 3] = Math.round(a * 255)
        }
    }
    ctx.putImageData(img, 0, 0)
    tex.hasAlpha = true
    tex.update()
    gashTextures.set(scene, tex)
    return tex
}

// one template, invisible itself, that instances are drawn from - each instance
// carries its own alpha (instancedBuffers.color)
function template(mesh, mat, glow, alphaIndex = 0){
    mesh.material = mat
    // drawn in this order among the blended: a demon's black core goes on last,
    // over its red edge, or the edge would light it red
    mesh.alphaIndex = alphaIndex
    mesh.isPickable = false
    mesh.hasVertexAlpha = true
    mesh.registerInstancedBuffer("color", 4)
    mesh.instancedBuffers.color = new Color4(1, 1, 1, 1)
    mesh.alwaysSelectAsActiveMesh = true
    if(glow){
        mesh._glowColor = glow.color
        addGlow(mesh.getScene(), mesh, glow.brightness)
    }
    mesh.isVisible = true
    mesh.setEnabled(true)
    // the template itself never draws - only its instances do
    mesh.scaling.setAll(0)
    return mesh
}

function templatesFor(scene, form){
    let byForm = templatesByScene.get(scene)
    if(!byForm) templatesByScene.set(scene, byForm = {})
    if(byForm[form]) return byForm[form]
    const base = getSocketContainers()?.projectileModels?.crescent
    if(!base){
        console.warn("[crescentHowl] crescent.glb isn't loaded (createProjectileModel.js's PROJECTILE_MODEL_PATHS)")
        return null
    }
    const look = LOOKS[form]
    const gashPlane = MeshBuilder.CreateGround(`crescentHowl_gash_${form}`, { width: 1, height: 1 }, scene)
    byForm[form] = {
        core: template(bakedCrescent(scene, base, `crescentHowl_core_${form}`), material(scene, `crescentHowl_core_${form}`, look.core, look.coreBlend), { color: look.coreGlow, brightness: 0.8 }, 3),
        edge: template(bakedCrescent(scene, base, `crescentHowl_edge_${form}`), material(scene, `crescentHowl_edge_${form}`, look.edge, Constants.ALPHA_ADD), { color: look.edgeGlow, brightness: look.edgeGlowBrightness }, 2),
        // afterimages and the gash fade one by one - kept off the glow layer,
        // which can't fade an instance with it
        ghost: template(bakedCrescent(scene, base, `crescentHowl_ghost_${form}`), material(scene, `crescentHowl_ghost_${form}`, look.edge, Constants.ALPHA_ADD), null),
        gash: template(gashPlane, material(scene, `crescentHowl_gash_${form}`, look.gash, Constants.ALPHA_ADD), null),
    }
    byForm[form].gash.material.opacityTexture = gashTexture(scene)
    scene.onDisposeObservable.addOnce(() => templatesByScene.delete(scene))
    return byForm[form]
}

function instance(tpl, name, alpha){
    const inst = tpl.createInstance(name)
    inst.isPickable = false
    inst.instancedBuffers.color = new Color4(1, 1, 1, alpha)
    inst.scaling.setAll(1)
    return inst
}
const setAlpha = (inst, a) => { inst.instancedBuffers.color = new Color4(1, 1, 1, a) }

const easeOut = t => 1 - Math.pow(1 - t, 3)
// springs past 1 and settles back - "unfurling" rather than growing
const backOut = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2) }

// the ground under (x, z): the openworld's terrain, else whatever solid is
// below (a room's or arena's floor), else fallbackY (the caster's feet)
function groundYAt(scene, x, z, fromY, fallbackY){
    if(getCharState()?.currentPlace?.placeId === OPENWORLD_PLACE_ID){
        const y = openworldGroundY(x, z)
        if(Number.isFinite(y)) return y
    }
    const hit = scene.getPhysicsEngine?.()?.raycast(new Vector3(x, fromY + 0.5, z), new Vector3(x, fromY - 8, z))
    if(hit?.hasHit) return hit.hitPointWorld.y
    return fallbackY
}

// ── 1. wind-up ───────────────────────────────────────────────────────────────
/** The swing drawing back: streaks of light rush in to the weapon hand. */
export function windUp(scene, player, skill){
    const look = LOOKS[formOf(skill)]
    const handNode = player?.rHand
    if(!handNode && !player?.body) return
    const at = (handNode?.getAbsolutePosition?.() ?? player.body.position).clone()
    // follows the hand through the swing, so they land in the blade
    const follow = scene.onBeforeRenderObservable.add(() => { if(handNode && !handNode.isDisposed?.()) at.copyFrom(handNode.getAbsolutePosition()) })
    const ps = new ParticleSystem("crescentHowl.gather", 110, scene)
    ps.particleTexture = getParticleTexture(scene, particleTexturePath("thin1"))
    ps.emitter = at
    ps.isLocal = false
    ps.blendMode = ParticleSystem.BLENDMODE_ADD
    ps.updateSpeed = 1 / 60
    const LIFE = 0.22, R = 1.4
    // born on a sphere round the hand, flying at it fast enough to arrive as they die
    ps.startPositionFunction = (m, pos) => {
        const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u)
        pos.set(at.x + Math.cos(a) * r * R, at.y + u * R, at.z + Math.sin(a) * r * R)
    }
    ps.startDirectionFunction = (m, dir, p) => dir.set(at.x - p.position.x, at.y - p.position.y, at.z - p.position.z).scaleInPlace(1 / LIFE)
    ps.minEmitPower = ps.maxEmitPower = 1
    ps.minLifeTime = ps.maxLifeTime = LIFE
    ps.emitRate = 420
    ps.targetStopDuration = 0.24
    ps.addSizeGradient(0, 0.12, 0.2)
    ps.addSizeGradient(1, 0.35, 0.5)
    ps.color1 = new Color4(look.spark.r, look.spark.g, look.spark.b, 0.7)
    ps.color2 = new Color4(1, 1, 1, 0.9)
    ps.colorDead = new Color4(1, 1, 1, 1)
    ps.onAnimationEnd = () => setTimeout(() => {
        scene.onBeforeRenderObservable.remove(follow)
        if(!scene.isDisposed) ps.dispose(false)
    }, 0)
    ps.start()
    // the sword's own sound as the skill is activated (not windBlowS: that one is
    // the flying loop, and nothing here would ever stop it)
    playSoundNear(getAllSounds()?.swordS1, player.body?.position)
}

// ── 2. release ───────────────────────────────────────────────────────────────
/** The wave leaving the blade. isMine: the caster's own screen shakes. */
export function release(scene, player, skill, isMine){
    const look = LOOKS[formOf(skill)]
    const body = player?.body
    if(!body) return
    const feet = body.position.clone()
    feet.y -= capsuleHeight / 2
    feet.y = groundYAt(scene, feet.x, feet.z, body.position.y, feet.y)
    popShockRing(scene, feet, { size: 4.2, seconds: 0.45, color: look.edge })
    sparkBurst(scene, feet.add(new Vector3(0, 0.15, 0)), new Color3(0.55, 0.55, 0.6), { count: 26, power: 2.6, size: [0.2, 0.45], life: [0.35, 0.7], texture: "smoke2" })
    const hand = player.rHand?.getAbsolutePosition?.()
    if(hand) sparkBurst(scene, hand.clone(), look.spark, { count: 34, power: 5, size: [0.1, 0.25], life: [0.2, 0.45] })
    playSoundNear(getAllSounds()?.swordWhooshS, body.position)
    if(!isMine) return
    // the camera is thrown forward with it, and opens up a touch
    addCameraTrauma(scene, 0.32, { x: 0, y: 0.45 })
    punchCameraFov(scene, 0.035)
}

// ── 3. flight ────────────────────────────────────────────────────────────────
/**
 * The wave on a projectile box (skillEffects.js's renderGenericProjectile, shape
 * "crescent"). Stretches the box to the wave so what it touches matches what is
 * seen; the wave itself sits under a node that undoes that stretch.
 * Returns { dispose, impact(target) } - dispose bursts it, impact is a body it
 * passed through.
 */
export function createWave(scene, box, skill, scale, { isMine = false, casterOwner = null } = {}){
    const form = formOf(skill)
    const look = LOOKS[form]
    const tpls = templatesFor(scene, form)
    if(!tpls) return { dispose(){}, impact(){} }

    const sx = WAVE.hitbox.x / BOX_SIZE * scale, sy = WAVE.hitbox.y / BOX_SIZE * scale, sz = WAVE.hitbox.z / BOX_SIZE * scale
    const visual = scale * WAVE.modelScale
    box.scaling.set(sx, sy, sz)
    const root = new TransformNode(`crescentHowl_root_${Date.now()}`, scene)
    root.parent = box
    // which wave of the fan this is decides its roll - fireProjectileVolley
    // fires them left to right
    const fanIndex = skill._fanIndex ?? 0
    const roll = ((WAVE.rollDeg + (fanIndex % 2 ? -1 : 1) * WAVE.fanRollDeg * Math.ceil(fanIndex / 2)) * Math.PI) / 180
    root.rotation.set((WAVE.pitchDeg * Math.PI) / 180, 0, roll)
    const inv = new Vector3(1 / sx, 1 / sy, 1 / sz)

    const id = Math.round(Math.random() * 1e9)
    const core = instance(tpls.core, `crescentHowl_core_${id}`, 1)
    const edge = instance(tpls.edge, `crescentHowl_edge_${id}`, 0.75)
    core.parent = root
    edge.parent = root
    edge.position.y = -0.02
    edge.scaling.setAll(look.edgeGrow)
    const ghosts = WAVE.ghosts.map((g, i) => ({ ...g, mesh: instance(tpls.ghost, `crescentHowl_ghost_${id}_${i}`, 0) }))
    const gashes = []

    const born = performance.now()
    const history = []            // [{ t, pos }] - where the wave has been, for its afterimages
    let lastGash = null
    // the caster's feet, for where no ground can be found
    const caster = getPlayersOnScene().find(pl => pl.owner === casterOwner)
    const feetY = caster?.body ? caster.body.position.y - capsuleHeight / 2 : null
    let ended = false
    const _s = new Vector3(), _q = new Quaternion(), _p = new Vector3()
    function dropGash(at, now){
        const g = instance(tpls.gash, `crescentHowl_gash_${id}_${gashes.length}`, 1)
        g.position.set(at.x, groundYAt(scene, at.x, at.z, at.y, feetY ?? at.y - 1.3) + 0.07, at.z)
        g.rotation.y = box.rotation.y
        g.scaling.set(WAVE.gashWidth * scale, 1, WAVE.gashLength)
        gashes.push({ mesh: g, at: now })
    }

    const observer = scene.onBeforeRenderObservable.add(() => {
        const now = performance.now()
        // the wave's own scale: unfurling, then steady
        const t = Math.min(1, (now - born) / WAVE.unfurlMs)
        const k = visual * (WAVE.unfurlFrom + (1 - WAVE.unfurlFrom) * backOut(t))
        root.scaling.set(inv.x * k, inv.y * k, inv.z * k)
        if(ended || box.isDisposed()) return

        root.computeWorldMatrix(true)
        root.getWorldMatrix().decompose(_s, _q, _p)
        history.push({ t: now, pos: _p.clone() })
        while(history.length && now - history[0].t > WAVE.historyMs) history.shift()
        // afterimages: where the wave was lagMs ago, the same way round, fading
        ghosts.forEach(g => {
            const past = history.find(h => now - h.t <= g.lagMs) ?? history[0]
            if(!past || now - born < g.lagMs){ setAlpha(g.mesh, 0); return }
            g.mesh.position.copyFrom(past.pos)
            g.mesh.rotationQuaternion = _q.clone()
            g.mesh.scaling.copyFrom(_s).scaleInPlace(g.size)
            setAlpha(g.mesh, g.alpha)
        })

        // the gash: a strip of light dropped on the ground every gashEveryM of the
        // way - every one of them, however far a slow frame carried it
        if(!lastGash){ lastGash = _p.clone(); dropGash(lastGash, now) }
        let run = Math.hypot(_p.x - lastGash.x, _p.z - lastGash.z)
        while(run >= WAVE.gashEveryM){
            lastGash = Vector3.Lerp(lastGash, _p, WAVE.gashEveryM / run)
            dropGash(lastGash, now)
            run = Math.hypot(_p.x - lastGash.x, _p.z - lastGash.z)
        }
    })
    // the gash fades on its own clock - it outlives the wave that cut it
    const gashObserver = scene.onBeforeRenderObservable.add(() => {
        const now = performance.now()
        for(let i = gashes.length - 1; i >= 0; i--){
            const g = gashes[i]
            const t = (now - g.at) / WAVE.gashMs
            if(t >= 1){ g.mesh.dispose(); gashes.splice(i, 1); continue }
            // narrows as it cools
            g.mesh.scaling.x = WAVE.gashWidth * scale * (1 - 0.7 * t)
            setAlpha(g.mesh, 1 - t * t)
        }
        if(ended && !gashes.length) scene.onBeforeRenderObservable.remove(gashObserver)
    })

    // ── 4. a body it passes through ─────────────────────────────────────────
    function impact(target){
        const body = target?.body
        if(!body || body.isDisposed?.()) return
        const at = body.position.clone()
        const feet = at.clone()
        feet.y -= (target.det?.bodyHeight ?? capsuleHeight) / 2
        popShockRing(scene, feet, { size: 3, seconds: 0.4, color: look.edge })
        sparkBurst(scene, at, look.spark, { count: 40, power: 6, size: [0.12, 0.3], life: [0.25, 0.55] })
        if(!isMine) return
        // the blow itself, as a swing of the weapon thrown lands: a flash, sparks,
        // a hitstop, the shake and the weapon's own sound (meleeCombat.js spaces
        // the shake out, so a wave through a pack doesn't stutter)
        onMeleeConnect({ targetBody: body, targetMeshes: target.meshes ?? [], targetAnims: target.anims ?? [], weaponType: skill._castWeaponType ?? "sword", isSkill: true })
    }

    // ── 5. the end of its run ───────────────────────────────────────────────
    function dispose(){
        if(ended) return
        ended = true
        scene.onBeforeRenderObservable.remove(observer)
        ghosts.forEach(g => g.mesh.dispose())
        // off the box (which is about to go) and left where it is, to burst
        const burst = [core, edge]
        burst.forEach(m => m.setParent(null))
        root.dispose()
        const startScale = burst.map(m => m.scaling.clone())
        const from = performance.now()
        if(!box.isDisposed()) sparkBurst(scene, box.position.clone(), look.spark, { count: 30, power: 3.5, size: [0.1, 0.25], life: [0.25, 0.5] })
        const endObserver = scene.onBeforeRenderObservable.add(() => {
            const t = Math.min(1, (performance.now() - from) / WAVE.endMs)
            const grow = 1 + (WAVE.endGrow - 1) * easeOut(t)
            burst.forEach((m, i) => {
                m.scaling.copyFrom(startScale[i]).scaleInPlace(grow)
                setAlpha(m, (i === 0 ? 1 : 0.75) * (1 - t))
            })
            if(t < 1) return
            scene.onBeforeRenderObservable.remove(endObserver)
            burst.forEach(m => m.dispose())
        })
    }

    return { dispose, impact }
}
