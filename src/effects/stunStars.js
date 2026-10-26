import { Color3, Constants, DynamicTexture, Mesh, MeshBuilder, StandardMaterial, TransformNode, Vector3 } from "@babylonjs/core"

// STUN STARS - the little ring of stars circling a dazed player's head
// (charactersystem/stun.js). They follow the head, not parented to it, so the
// ring stays level however the stunned pose tilts it, and they fade out on
// their own once the stun is over.

const STAR_COUNT    = 5
const STAR_SIZE     = 0.15   // m
const ORBIT_RADIUS  = 0.27   // m, around the head
const ORBIT_TILT    = 0.06   // m the ring dips front to back - reads as a ring, not a line
const ORBIT_SPEED   = 3.2    // rad/s
const ABOVE_HEAD    = 0.36   // the head bone sits at the base of the skull
const NO_HEAD_ABOVE = 0.95   // from the body's centre, for a rig with no head bone
const FADE_IN       = 0.15   // s
const FADE_OUT      = 0.3    // s
const STAR_COLOR    = new Color3(1, 0.86, 0.32)

// one per scene - shared by every ring of stars
const materials = new WeakMap()

function drawStar(ctx, size){
    const c = size / 2
    // a soft glow behind it
    const glow = ctx.createRadialGradient(c, c, 0, c, c, c)
    glow.addColorStop(0, "rgba(255,255,255,0.55)")
    glow.addColorStop(0.35, "rgba(255,255,255,0.18)")
    glow.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, size, size)
    // a fat five-point star
    const outer = size * 0.42, inner = size * 0.19
    ctx.beginPath()
    for(let i = 0; i < 10; i++){
        const r = i % 2 ? inner : outer
        const a = -Math.PI / 2 + i * Math.PI / 5
        ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fillStyle = "white"
    ctx.fill()
}

function starMaterial(scene){
    let mat = materials.get(scene)
    if(mat) return mat
    const tex = new DynamicTexture("stunStar", { width: 128, height: 128 }, scene, true)
    const ctx = tex.getContext()
    ctx.clearRect(0, 0, 128, 128)
    drawStar(ctx, 128)
    tex.hasAlpha = true
    tex.update()
    mat = new StandardMaterial("stunStarMat", scene)
    mat.disableLighting = true
    mat.diffuseColor = Color3.Black()
    mat.specularColor = Color3.Black()
    mat.emissiveColor = STAR_COLOR
    mat.opacityTexture = tex
    mat.backFaceCulling = false
    mat.alphaMode = Constants.ALPHA_COMBINE
    materials.set(scene, mat)
    return mat
}

// player: a createCharacter() rig. isOver(): true once the stun has worn off -
// checked every frame, so they fade out when it is, and back in if another
// stun lands before they're gone. onGone: called once they've gone, faded or
// disposed. Returns { dispose } to take them down at once.
export function showStunStars(scene, player, isOver, onGone){
    const root = new TransformNode("stunStars", scene)
    const mat = starMaterial(scene)
    const stars = Array.from({ length: STAR_COUNT }, (_, i) => {
        const star = MeshBuilder.CreatePlane(`stunStar${i}`, { size: STAR_SIZE }, scene)
        star.material = mat
        star.isPickable = false
        star.billboardMode = Mesh.BILLBOARDMODE_ALL
        star.parent = root
        star.visibility = 0
        return star
    })

    const head = new Vector3()
    let spin = 0, alpha = 0, done = false
    const follow = scene.onBeforeRenderObservable.add(() => {
        const body = player.body
        if(!body || body.isDisposed()) return dispose()
        const dt = scene.getEngine().getDeltaTime() / 1000
        if(player.headBone && !player.headBone.isDisposed?.()){
            head.copyFrom(player.headBone.getAbsolutePosition())
            head.y += ABOVE_HEAD
        } else {
            head.copyFrom(body.getAbsolutePosition())
            head.y += NO_HEAD_ABOVE
        }
        root.position.copyFrom(head)

        // not gone just for being at 0 - that's where they start, and a frame
        // can take no time at all
        const over = isOver()
        alpha = over ? alpha - dt / FADE_OUT : Math.min(1, alpha + dt / FADE_IN)
        if(over && alpha <= 0) return dispose()

        spin += ORBIT_SPEED * dt
        stars.forEach((star, i) => {
            const a = spin + i * Math.PI * 2 / STAR_COUNT
            star.position.set(Math.cos(a) * ORBIT_RADIUS, Math.sin(a) * ORBIT_TILT, Math.sin(a) * ORBIT_RADIUS)
            // twinkling, each a beat apart
            star.scaling.setAll(0.8 + 0.25 * Math.sin(spin * 2.3 + i * 1.7))
            star.visibility = alpha
        })
    })

    function dispose(){
        if(done) return
        done = true
        scene.onBeforeRenderObservable.remove(follow)
        // the planes only - the material and its texture are the scene's, shared
        root.dispose(false, false)
        onGone?.()
    }
    return { dispose }
}
