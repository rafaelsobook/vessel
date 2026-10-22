import { Color3, Color4, Constants, DynamicTexture, MeshBuilder, ParticleSystem, StandardMaterial, TransformNode, Vector3 } from "@babylonjs/core"
import { getParticleTexture, particleTexturePath } from "../tools/particlesystem.js"

// What a blessing's signature looks like (charactersystem/blessingEffects.js
// decides WHEN): the golden ward circling a body, it breaking, the red wave of
// a refused death. Everything is local to this client - the other players'
// screens don't see the ward - and cleans itself up.

const GOLD = new Color3(1, 0.82, 0.3)
const RED = new Color3(1, 0.12, 0.1)
const ORBS = 4
const ORBIT_RADIUS = 0.75
const ORBIT_SPEED = 1.6        // radians per second

// ── the ward ─────────────────────────────────────────────────────────────────
// Four gold orbs circling at chest height round a thin gold ring at the waist,
// riding the body. One per scene (the body it rides).

let ward = null   // { scene, body, root, observer }

function emissive(scene, name, color, alpha = 1){
    const mat = new StandardMaterial(name, scene)
    mat.disableLighting = true
    mat.diffuseColor = Color3.Black()
    mat.specularColor = Color3.Black()
    mat.emissiveColor = color
    mat.alpha = alpha
    return mat
}

export function showWard(body){
    const scene = body?.getScene()
    if(!scene) return
    if(ward && ward.body === body && !ward.root.isDisposed()) return
    hideWard()

    const root = new TransformNode("blessing.ward", scene)
    root.parent = body
    // the body's origin is the middle of its capsule (1.5 tall)
    root.position.set(0, 0.1, 0)
    const orbMat = emissive(scene, "blessing.wardOrb", GOLD)
    const ringMat = emissive(scene, "blessing.wardRing", GOLD, 0.45)
    const parts = []
    for(let i = 0; i < ORBS; i++){
        const a = (i / ORBS) * Math.PI * 2
        const orb = MeshBuilder.CreateSphere(`blessing.wardOrb.${i}`, { diameter: 0.13, segments: 8 }, scene)
        orb.material = orbMat
        orb.parent = root
        orb.position.set(Math.cos(a) * ORBIT_RADIUS, (i % 2 ? 0.28 : -0.12), Math.sin(a) * ORBIT_RADIUS)
        parts.push(orb)
    }
    const ring = MeshBuilder.CreateTorus("blessing.wardRingMesh", { diameter: ORBIT_RADIUS * 2, thickness: 0.025, tessellation: 40 }, scene)
    ring.material = ringMat
    ring.parent = root
    ring.position.y = 0.08
    parts.push(ring)
    // not pickable: indoors the camera fades every pickable mesh between it and you
    parts.forEach(mesh => { mesh.isPickable = false })

    const observer = scene.onBeforeRenderObservable.add(() => {
        root.rotation.y += ORBIT_SPEED * scene.getAnimationRatio() / 60
        // a slow breath in the ring, so it reads as alive
        ringMat.alpha = 0.4 + 0.12 * Math.sin(performance.now() / 380)
    })
    ward = { scene, body, root, observer, mats: [orbMat, ringMat] }
    body.onDisposeObservable.addOnce(() => { if(ward?.body === body) ward = null })
}

export function hideWard(){
    if(!ward) return
    const { scene, root, observer, mats } = ward
    ward = null
    if(scene.isDisposed) return
    scene.onBeforeRenderObservable.remove(observer)
    if(!root.isDisposed()) root.dispose(false, false)
    mats.forEach(mat => mat.dispose())
}

// ── bursts ───────────────────────────────────────────────────────────────────

// a ring running out along the ground, fading as it goes (aura.js's pulse)
const ringTextures = new WeakMap()
function ringTexture(scene){
    let tex = ringTextures.get(scene)
    if(tex) return tex
    tex = new DynamicTexture("blessing.ring", { width: 256, height: 256 }, scene, true)
    const ctx = tex.getContext()
    const c = 128
    const grad = ctx.createRadialGradient(c, c, 0, c, c, c)
    grad.addColorStop(0, "rgba(255,255,255,0)")
    grad.addColorStop(0.55, "rgba(255,255,255,0)")
    grad.addColorStop(0.8, "rgba(255,255,255,1)")
    grad.addColorStop(0.9, "rgba(255,255,255,0.35)")
    grad.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 256, 256)
    tex.hasAlpha = true
    tex.update()
    ringTextures.set(scene, tex)
    return tex
}

export function ringBurst(scene, position, color, size = 3.5, seconds = 0.7){
    if(!scene || scene.isDisposed) return
    const mat = emissive(scene, "blessing.burstRing", color)
    mat.opacityTexture = ringTexture(scene)
    mat.backFaceCulling = false
    mat.alphaMode = Constants.ALPHA_ADD
    const ring = MeshBuilder.CreateGround("blessing.burst", { width: 1, height: 1 }, scene)
    ring.isPickable = false
    ring.material = mat
    ring.position.set(position.x, position.y + 0.04, position.z)
    let t = 0
    const observer = scene.onBeforeRenderObservable.add(() => {
        t = Math.min(1, t + scene.getAnimationRatio() / 60 / seconds)
        const scale = 0.4 + (size - 0.4) * (1 - Math.pow(1 - t, 3))
        ring.scaling.set(scale, 1, scale)
        ring.visibility = 1 - t
        if(t < 1) return
        scene.onBeforeRenderObservable.remove(observer)
        ring.dispose()
        mat.dispose()
    })
}

// a one-off burst of glints from `position`. Sizes in metres - with the size
// gradient Babylon takes the values AS the sizes (see effects/transformationFire.js)
export function sparkBurst(scene, position, color, { count = 60, power = 4, size = [0.25, 0.5], life = [0.4, 0.9] } = {}){
    if(!scene || scene.isDisposed) return
    const ps = new ParticleSystem("blessing.sparks", count, scene)
    ps.particleTexture = getParticleTexture(scene, particleTexturePath("thin1"))
    ps.emitter = position.clone()
    ps.blendMode = ParticleSystem.BLENDMODE_ADD
    ps.updateSpeed = 1 / 60
    ps.createSphereEmitter(0.25, 1)
    ps.manualEmitCount = count
    ps.targetStopDuration = 0.1
    ps.minLifeTime = life[0]
    ps.maxLifeTime = life[1]
    ps.addSizeGradient(0, size[0], size[1])
    ps.addSizeGradient(1, 0, 0.05)
    ps.minEmitPower = power * 0.4
    ps.maxEmitPower = power
    ps.minAngularSpeed = -3
    ps.maxAngularSpeed = 3
    ps.gravity = new Vector3(0, -1.5, 0)
    ps.color1 = new Color4(color.r, color.g, color.b, 1)
    ps.color2 = new Color4(1, 1, 1, 1)
    ps.colorDead = new Color4(color.r, color.g, color.b, 0)
    // freed once its last glint is gone - not disposeOnStop: that takes the
    // shared texture with it (particlesystem.js's cache)
    ps.onAnimationEnd = () => setTimeout(() => { if(!scene.isDisposed) ps.dispose(false) }, 0)
    ps.start()
}

// the ward taking a blow and breaking: gold glints, a ring, off the body
export function wardBreak(body){
    hideWard()
    const scene = body.getScene()
    const at = body.getAbsolutePosition().clone()
    sparkBurst(scene, at, GOLD, { count: 70, power: 5 })
    ringBurst(scene, new Vector3(at.x, at.y - 0.75, at.z), GOLD, 3, 0.55)
}

// a death refused: a red wave out along the ground and a burst of red
export function redemptionBurst(body){
    const scene = body.getScene()
    const at = body.getAbsolutePosition().clone()
    sparkBurst(scene, at, RED, { count: 110, power: 7, size: [0.3, 0.6], life: [0.6, 1.3] })
    ringBurst(scene, new Vector3(at.x, at.y - 0.75, at.z), RED, 6, 0.9)
}

// the radiant slash: gold glints off the struck body
export function radiantBurst(scene, at){
    sparkBurst(scene, at, GOLD, { count: 45, power: 6, size: [0.3, 0.55], life: [0.3, 0.7] })
}
