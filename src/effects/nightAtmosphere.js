import { Color3, Color4, Constants, DynamicTexture, Mesh, MeshBuilder, NoiseProceduralTexture, ParticleSystem, StandardMaterial, Vector3 } from "@babylonjs/core"
import { getParticleTexture, particleTexturePath } from "../tools/particlesystem.js"

// THE NIGHT'S ATMOSPHERE - the character setup forest's (scenes/setupbackdrop.js)
// mist, fireflies and moon, as pieces anything can build: the setup scene
// round its clearing, components/nightAmbience.js round the player out in the
// open world and the village after dark.
//
// The particle systems run on updateSpeed 1/60, so their numbers are real
// units: lifetimes in seconds, emitRate per second, sizes in metres (a size
// gradient's values ARE the sizes). They emit in world space round `emitter`,
// a Vector3 the caller may move every frame - ones already in the air stay
// where they are, so moving it doesn't drag them along.

// the colour of the night - the blue-teal mist the setup forest's trees fade
// into. dayNightSystem.js blends the outdoor fog to it after dark.
export const NIGHT_FOG_COLOR = new Color3(0.07, 0.11, 0.16)
export const MOONLIGHT = new Color3(0.55, 0.66, 1.0)

// little green-gold lights drifting about, blinking slowly in and out.
// min/max: the box they're born in, round the emitter - or spawnAt(out): put
// each new one's world position in `out` instead (nightAmbience.js, among the
// trees). preWarm: already flying the moment they start (only worth it when
// rate isn't 0)
export function createFireflies(scene, { name = "fireflies", emitter = Vector3.Zero(), min, max, spawnAt, rate = 26, capacity = 160, preWarm = true } = {}){
    const ps = new ParticleSystem(name, capacity, scene)
    ps.particleTexture = getParticleTexture(scene, particleTexturePath("flare"))
    ps.emitter = emitter
    if(spawnAt) ps.startPositionFunction = (worldMatrix, out) => spawnAt(out)
    else {
        ps.minEmitBox = min
        ps.maxEmitBox = max
    }
    ps.blendMode = ParticleSystem.BLENDMODE_ADD
    ps.updateSpeed = 1 / 60
    ps.emitRate = rate
    ps.minLifeTime = 4
    ps.maxLifeTime = 8
    ps.addSizeGradient(0, 0.06, 0.1)
    ps.addSizeGradient(1, 0.05, 0.09)
    ps.addColorGradient(0, new Color4(0.7, 1, 0.35, 0))
    ps.addColorGradient(0.2, new Color4(0.85, 1, 0.45, 1))
    ps.addColorGradient(0.45, new Color4(0.6, 0.9, 0.3, 0.25))
    ps.addColorGradient(0.65, new Color4(0.9, 1, 0.5, 1))
    ps.addColorGradient(1, new Color4(0.6, 0.9, 0.3, 0))
    ps.direction1 = new Vector3(-0.3, -0.1, -0.3)
    ps.direction2 = new Vector3(0.3, 0.25, 0.3)
    ps.minEmitPower = 0.05
    ps.maxEmitPower = 0.25
    const noise = new NoiseProceduralTexture(`${name}_noise`, 64, scene)
    noise.animationSpeedFactor = 1.5
    ps.noiseTexture = noise
    ps.noiseStrength = new Vector3(0.6, 0.35, 0.6)
    if(preWarm){
        ps.preWarmCycles = 120
        ps.preWarmStepOffset = 4
    }
    ps.start()
    return ps
}

// low mist creeping over the ground - big soft sprites, barely there each,
// thick where they pile up. The defaults are the setup forest's, seen from
// low down; looking down on it from above (the game's camera), each sprite
// shows face-on, so there it wants to be bigger and fainter (nightAmbience.js).
// color: its tint; alpha: how thick each sprite is at its thickest;
// size: [born, grown] in metres - each [min, max]
export function createGroundMist(scene, {
    name = "groundMist", emitter = Vector3.Zero(), min, max, rate = 5, capacity = 90, preWarm = true,
    color = new Color3(0.55, 0.65, 0.8), alpha = 0.11, size = [[2.5, 4], [5, 7]],
} = {}){
    const ps = new ParticleSystem(name, capacity, scene)
    ps.particleTexture = getParticleTexture(scene, particleTexturePath("smoke2"))
    ps.emitter = emitter
    ps.minEmitBox = min
    ps.maxEmitBox = max
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD
    ps.updateSpeed = 1 / 60
    ps.emitRate = rate
    ps.minLifeTime = 12
    ps.maxLifeTime = 18
    ps.addSizeGradient(0, size[0][0], size[0][1])
    ps.addSizeGradient(1, size[1][0], size[1][1])
    const tint = a => new Color4(color.r, color.g, color.b, a)
    ps.addColorGradient(0, tint(0))
    ps.addColorGradient(0.3, tint(alpha))
    ps.addColorGradient(0.7, tint(alpha * 0.8))
    ps.addColorGradient(1, tint(0))
    ps.direction1 = new Vector3(0.6, 0, -0.2)
    ps.direction2 = new Vector3(1, 0.04, 0.2)
    ps.minEmitPower = 0.08
    ps.maxEmitPower = 0.2
    ps.minInitialRotation = 0
    ps.maxInitialRotation = Math.PI * 2
    ps.minAngularSpeed = -0.05
    ps.maxAngularSpeed = 0.05
    if(preWarm){
        ps.preWarmCycles = 200
        ps.preWarmStepOffset = 10
    }
    ps.start()
    return ps
}

// a soft disc of light - the moon and its halo
function radialTexture(scene, name, stops){
    const size = 256
    const tex = new DynamicTexture(name, { width: size, height: size }, scene, true)
    const ctx = tex.getContext()
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    stops.forEach(([at, alpha]) => g.addColorStop(at, `rgba(255,255,255,${alpha})`))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    tex.hasAlpha = true
    tex.update()
    return tex
}

function glowCard(scene, name, size, color, texture, alphaMode){
    const card = MeshBuilder.CreatePlane(name, { size }, scene)
    const mat = new StandardMaterial(`${name}_mat`, scene)
    mat.disableLighting = true
    mat.emissiveColor = color
    mat.diffuseColor = Color3.Black()
    mat.specularColor = Color3.Black()
    mat.opacityTexture = texture
    // it's in the sky - the mist doesn't swallow it
    mat.fogEnabled = false
    mat.backFaceCulling = false
    mat.alphaMode = alphaMode
    card.material = mat
    card.isPickable = false
    card.billboardMode = Mesh.BILLBOARDMODE_ALL
    return card
}

// the moon: a pale disc with a wide halo in the mist. size: the disc across;
// the halo is haloScale times that. place(at, away): the disc at `at`, its
// halo a little further along `away` (from the viewer) so it sits behind.
// setVisibility(0..1) fades both.
export function createMoon(scene, { name = "moon", size = 7, haloScale = 6.5 } = {}){
    const disc = glowCard(scene, `${name}_disc`, size, new Color3(0.9, 0.94, 1.0),
        radialTexture(scene, `${name}_tex`, [[0, 1], [0.86, 1], [0.95, 0.4], [1, 0]]), Constants.ALPHA_COMBINE)
    const halo = glowCard(scene, `${name}_halo`, size * haloScale, new Color3(0.32, 0.42, 0.68),
        radialTexture(scene, `${name}_halo_tex`, [[0, 0.75], [0.25, 0.3], [0.6, 0.08], [1, 0]]), Constants.ALPHA_ADD)
    const behind = size / 7
    return {
        disc,
        halo,
        place(at, away){
            disc.position.copyFrom(at)
            halo.position.set(at.x + away.x * behind, at.y + away.y * behind, at.z + away.z * behind)
        },
        setVisibility(v){
            disc.visibility = v
            halo.visibility = v
            disc.setEnabled(v > 0)
            halo.setEnabled(v > 0)
        },
    }
}
