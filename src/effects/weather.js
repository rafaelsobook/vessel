import { GPUParticleSystem, ParticleSystem, TransformNode, Texture, Vector3, Color3, Color4, Scene } from "@babylonjs/core"
import { WEATHER_TYPES } from "../constants/weather.js"
import { getPlayersOnScene } from "../sockets/worldsocket.js"
import { getCharState } from "../charactersystem/characterstate.js"

// Rain / snow / sandstorm, built on Babylon's own particle API.
//
// This file previously hand-wrote a GLSL points shader to avoid the CPU cost
// of a CPU-updated ParticleSystem at these particle counts. The performance
// reasoning was sound, the execution was not: it failed to render three times
// over - once on a zero submesh index count, once on a semicolon inside a
// shader comment (Babylon's preprocessor splits source on ";" and orphaned the
// remainder), and neither failure reports an error anywhere. A bespoke shader
// that silently draws nothing is worse than a slightly costlier system that
// works.
//
// GPUParticleSystem is the tool that was wanted all along: particles are
// simulated on the GPU via transform feedback, so there is no per-particle CPU
// work and no buffer re-upload - the same win the shader was chasing - but
// through an API Babylon tests, rather than one this file invents. It falls
// back to a plain ParticleSystem where transform feedback is unavailable, at
// reduced counts, so weather still appears on weaker hardware.
//
// Fog is not particles at all - it is scene.fogDensity/fogColor, which costs
// nothing because Babylon's materials already sample it. "Foggy" weather is
// purely a fog change, and rain/snow/sand each adjust fog on top of their
// particles.

// Horizontal half-extent of the emit area around the player, and how far above
// them particles are born. Together these define a ceiling plane that follows
// the player, wide enough that the edges are past where fog has swallowed them.
const AREA_HALF_WIDTH = 40
const SPAWN_HEIGHT = 25
// Vertical thickness of the emit volume. 0 makes a flat ceiling plane, which
// is right for anything that falls - particles are born overhead and drop
// through the play area. A sandstorm blows mostly SIDEWAYS though, so it
// barely descends during its life: born on a ceiling it would drift past
// far overhead and never reach the player at all. It gets a tall, low volume
// instead so grit spawns at every height from the ground up.
const DEFAULT_BOX_HEIGHT = 0

// Per-weather setup. `capacity` is the cost knob; `emitRate * lifetime` is
// roughly how many are actually alive at once and must stay under it.
const WEATHER_VISUALS = {
    rain: {
        texture: "./images/particles/thin1.webp",
        capacity: 5000,
        // dropped from 6000 alongside the 3x size bump below. Screen coverage
        // scales with the SQUARE of sprite size, so tripling it makes each
        // drop cover ~9x the pixels - keeping the old rate would have turned
        // rain into an opaque sheet. 2500 still lands at roughly 3x the
        // visible coverage of the original, which is the direction wanted.
        emitRate: 2500,
        // 1.2s at ~30 u/s covers ~36 units - from the ceiling plane to below
        // the player. This HAD to grow when the fall speed came down: at the
        // old 0.6s, slower drops would cover only 18 units and wink out
        // roughly 7 units above head height, so rain would visibly stop in
        // mid-air. Lifetime and fall speed have to move together.
        lifetime: 1.2,
        // roughly half the previous fall rate. A side benefit of slowing down:
        // BILLBOARDMODE_STRETCHED scales each sprite along its own velocity,
        // so slower drops are shorter, fatter streaks instead of long thin
        // slivers - which is much of why the texture was hard to make out.
        direction1: new Vector3(-2.5, -28, -0.5),
        direction2: new Vector3(-1, -32, 0.5),
        // 3x the previous 0.12/0.3
        size: { min: 0.36, max: 0.9 },
        color1: new Color4(0.70, 0.80, 0.92, 0.55),
        color2: new Color4(0.55, 0.68, 0.85, 0.45),
        colorDead: new Color4(0.55, 0.68, 0.85, 0.0),
        // stretches each sprite along its own velocity - this is what turns a
        // round drop into a rain streak, and it is why rain needs no special
        // texture handling the way the old shader did
        stretched: true,
        fog: { density: 0.012, color: new Color3(0.45, 0.50, 0.56) },
    },
    snow: {
        // flare2, NOT flare - and this distinction matters more than it looks.
        // flare.webp is lossy VP8 with NO alpha channel at all, so its black
        // background is fully opaque and every flake rendered as a dark square
        // (confirmed in-game). flare2.webp is the same soft round glow with a
        // real alpha channel, so it composites correctly.
        // Only these are safe for weather - the rest of ./images/particles are
        // opaque and will produce the same black squares: explodeTex, flare,
        // maelstromboltprojectile, smoke2.png, splash, thin1.png, watercurrent.
        texture: "./images/particles/flare2.webp",
        capacity: 6000,
        emitRate: 700,
        // long life and a slow fall - 30 units over ~6s is what makes it read
        // as settling rather than dropping
        lifetime: 6,
        direction1: new Vector3(-2.5, -5, -1.5),
        direction2: new Vector3(2.5, -3.5, 1.5),
        size: { min: 0.18, max: 0.5 },
        // ADDITIVE, unlike rain and sandstorm below - this is what actually
        // makes a flake read as GLOWING rather than merely being white.
        // Additive blending adds the sprite's light to whatever is behind it
        // instead of covering it, the same way createFireParticles lights an
        // ember. It's also why the colours below run past 1.0: in additive
        // those are not clamped to "white", they drive how hard the flake
        // burns against the background.
        //
        // Trade-off worth knowing: additive white against a BRIGHT sky adds
        // white to white, so flakes are subtle up against an overcast horizon
        // and blaze against the darker ground, trees and buildings. If they
        // ever read as too hot, pull these multipliers back toward 1.0 rather
        // than switching blend mode - STANDARD makes them flat again.
        blendMode: "add",
        color1: new Color4(1.6, 1.7, 1.9, 1.0),
        color2: new Color4(1.2, 1.35, 1.6, 0.95),
        colorDead: new Color4(0.9, 1.0, 1.2, 0.0),
        stretched: false,
        fog: { density: 0.020, color: new Color3(0.72, 0.76, 0.82) },
    },
    sandstorm: {
        texture: "./images/particles/smoke.webp",
        capacity: 8000,
        emitRate: 3500,
        lifetime: 2.2,
        // born low and across the full height of the play area rather than
        // overhead: this barely descends in 2.2s (~11 units), so a ceiling
        // spawn would sail past far above the player and never be seen
        spawnHeight: 8,
        boxHeight: 16,
        // mostly HORIZONTAL - a sandstorm is wind carrying grit, so the
        // dominant motion is across the player rather than down
        direction1: new Vector3(-50, -6, -14),
        direction2: new Vector3(-40, -3, -8),
        size: { min: 0.8, max: 2.4 },
        color1: new Color4(0.80, 0.63, 0.36, 0.35),
        color2: new Color4(0.65, 0.50, 0.28, 0.25),
        colorDead: new Color4(0.65, 0.50, 0.28, 0.0),
        stretched: false,
        fog: { density: 0.045, color: new Color3(0.72, 0.58, 0.36) },
    },
    // no particles - fog is a scene setting, nothing to emit
    fog: {
        // Forest green rather than the neutral grey this used to be. Taken
        // from the value already in constants/localroomdb.js (a village's own
        // sceneTemp, line ~1272), whose own comment gives the reasoning this
        // inherits: "murky olive-green mist, same hue family as the grass
        // instead of fighting it".
        //
        // Deliberately the LIGHTER of the two greens in that file, not the
        // dark { 0.05, 0.15, 0.1 } used by the other seven places. Those are
        // per-place ambient fog at density 0.003 - barely-there tinting across
        // a whole scene. This runs at 0.055, roughly eighteen times denser, so
        // the same dark value would drain almost all the light and read as
        // nightfall rather than fog.
        //
        // Only the "fog" weather is green. Rain, snow and sandstorm keep
        // colours tied to what is actually falling - green snow or green grit
        // would look like a rendering fault rather than weather.
        fog: { density: 0.055, color: new Color3(0.38, 0.45, 0.30) },
    },
    clear: {
        fog: null,   // null = restore whatever the place's own sceneTemp set
    },
}

// CPU fallback runs at a fraction of the count - a CPU-updated system at
// 6000 particles would cost real frame time, which is the whole reason the GPU
// path is preferred. Thinner weather beats a stutter.
const CPU_FALLBACK_SCALE = 0.15

let current = null     // { weather, system, emitterNode, scene, observer }
let baseFog = null     // the place's own fog, captured on first change

function buildSystem(scene, weather, config){
    // A TransformNode rather than a bare Vector3 so the emit area can follow
    // the player by moving one node, instead of rebuilding the emitter.
    // Deliberately NOT parented to the player's body: the body rotates as they
    // turn, and a parented emit box would rotate with it, swinging the whole
    // storm around every time the player looks left.
    const emitterNode = new TransformNode(`weatherEmitter_${weather}`, scene)

    const useGPU = GPUParticleSystem.IsSupported
    const capacity = Math.floor(config.capacity * (useGPU ? 1 : CPU_FALLBACK_SCALE))

    const system = useGPU
        ? new GPUParticleSystem(`weather_${weather}`, { capacity }, scene)
        : new ParticleSystem(`weather_${weather}`, capacity, scene)

    // hasAlpha set explicitly rather than left to inference - every sprite used
    // here is chosen specifically for having a real alpha channel (see the
    // texture comments above), and BLENDMODE_STANDARD below relies on it. An
    // opaque sprite renders as a solid block of its own background colour.
    const texture = new Texture(config.texture, scene)
    texture.hasAlpha = true
    system.particleTexture = texture
    system.emitter = emitterNode

    // A flat rectangle ABOVE the player, not a volume around them - particles
    // are born on a ceiling plane and fall through the play area. The two
    // direction vectors give each particle a random velocity between them.
    const boxHeight = config.boxHeight ?? DEFAULT_BOX_HEIGHT
    system.createBoxEmitter(
        config.direction1,
        config.direction2,
        new Vector3(-AREA_HALF_WIDTH, -boxHeight / 2, -AREA_HALF_WIDTH),
        new Vector3(AREA_HALF_WIDTH, boxHeight / 2, AREA_HALF_WIDTH)
    )

    system.minEmitPower = 1
    system.maxEmitPower = 1
    system.minSize = config.size.min
    system.maxSize = config.size.max
    system.minLifeTime = config.lifetime * 0.85
    system.maxLifeTime = config.lifetime
    system.emitRate = Math.floor(config.emitRate * (useGPU ? 1 : CPU_FALLBACK_SCALE))

    system.color1 = config.color1
    system.color2 = config.color2
    system.colorDead = config.colorDead

    // Per-weather, because the two modes say different things. STANDARD is
    // ordinary alpha compositing - correct for rain and wind-blown grit, which
    // are lit matter that OCCLUDES what is behind them. ADD emits light
    // instead of covering, which is what makes snow glow. Defaulting to
    // STANDARD keeps anything added later opaque unless it opts in.
    system.blendMode = config.blendMode === "add"
        ? ParticleSystem.BLENDMODE_ADD
        : ParticleSystem.BLENDMODE_STANDARD

    if(config.stretched){
        system.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED
    }

    // world space (the default) matters here: already-emitted particles must
    // stay where they fell as the emitter moves with the player. Local space
    // would drag the entire storm along with them like a curtain.
    system.isLocal = false

    system.start()

    return { system, emitterNode, useGPU, capacity }
}

function applyFog(scene, fog){
    if(!fog){
        // "clear" - put back whatever setupLighting set for this place rather
        // than hardcoding a default, so a naturally murky swamp doesn't come
        // out of a storm looking like open grassland
        if(baseFog){
            scene.fogMode = baseFog.mode
            scene.fogDensity = baseFog.density
            scene.fogColor = baseFog.color.clone()
        }
        return
    }
    scene.fogMode = Scene.FOGMODE_EXP
    scene.fogDensity = fog.density
    scene.fogColor = fog.color.clone()
}

/**
 * Show `weather` in this scene, replacing whatever is showing now.
 * "clear" tears everything down and restores the place's own fog.
 */
export function applyWeather(scene, weather){
    if(!scene || scene.isDisposed) return
    if(!WEATHER_TYPES.includes(weather)) return

    // captured once per scene, before anything overwrites it
    if(!baseFog || baseFog.scene !== scene){
        baseFog = { scene, mode: scene.fogMode, density: scene.fogDensity, color: scene.fogColor.clone() }
    }

    if(current?.scene === scene && current.weather === weather) return
    stopWeather()

    const config = WEATHER_VISUALS[weather]
    applyFog(scene, config.fog)

    if(!config.capacity){
        current = { weather, scene, system: null, emitterNode: null, observer: null }
        return
    }

    const { system, emitterNode, useGPU, capacity } = buildSystem(scene, weather, config)

    // Anchor on the PLAYER, not the camera. Both keep the storm around you,
    // but centred on the camera the whole emit area translates as you orbit,
    // so rotating the view drags the weather along and it reads as stuck to
    // the viewport. Centred on the character it stays put and the camera swings
    // through it. Falls back to the camera until the player's body exists.
    const heroBody = getPlayersOnScene()?.find(pl => pl.owner === getCharState()?.owner)?.body

    const spawnHeight = config.spawnHeight ?? SPAWN_HEIGHT
    const observer = scene.onBeforeRenderObservable.add(() => {
        const anchor = (heroBody && !heroBody.isDisposed()) ? heroBody : scene.activeCamera
        if(!anchor) return
        emitterNode.position.x = anchor.position.x
        emitterNode.position.y = anchor.position.y + spawnHeight
        emitterNode.position.z = anchor.position.z
    })

    current = { weather, scene, system, emitterNode, observer }

    // This effect drew nothing three times under the old implementation, in
    // ways that raised no error at all. Logging what actually got built keeps
    // that diagnosable from devtools instead of by guesswork.
    console.log(`[weather] ${weather}: ${useGPU ? "GPU" : "CPU fallback"}, capacity=${capacity}, texture=${config.texture}`)
}

export function stopWeather(){
    if(!current) return
    const { scene, system, emitterNode, observer } = current
    current = null

    if(scene && !scene.isDisposed){
        if(observer) scene.onBeforeRenderObservable.remove(observer)
        // true - this texture was created for this system alone (not taken
        // from particlesystem.js's shared cache), so it dies with it rather
        // than leaking one sprite per weather change
        system?.dispose(true)
        emitterNode?.dispose()
    }
}

export function getActiveWeather(){
    return current?.weather ?? "clear"
}
