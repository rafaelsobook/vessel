import { Color3, DirectionalLight, HemisphericLight, PointLight } from "@babylonjs/core"
import { getSocket } from "../sockets/joinsocket.js"

// Bridges tcp's world clock (tcp/recources/dayNight.ts) to how outdoor places
// are lit. tcp owns the time - ONE time of day for the whole world - and sends
// it with every userJoined snapshot plus a periodic "daynight-sync"; between
// those this client advances it on its own clock.
//
// Only DAYNIGHT_AREA_TYPES are affected. Rooms and dungeons light themselves
// (createroom.js / createdungeon.js) and never see the sky.
//
// Every value this touches is SCALED from the place's own level rather than
// overwritten, and a value something else changed since this last wrote it
// becomes the new base - so weather.js can keep swapping the fog colour and
// night just darkens whatever fog is current, with neither side owning it.

export const DAYNIGHT_AREA_TYPES = ["openworld", "village"]

// timeOfDay: 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
let clock = { timeOfDay: 0.3, dayLengthMs: 24 * 60 * 1000, receivedAt: performance.now() }

// how often the lighting is re-evaluated - a 24-minute day moves very little in
// half a second, so there's no visible stepping
const UPDATE_EVERY_FRAMES = 30

// how much of each light/feature is left at the darkest point of the night
const NIGHT_SUN_INTENSITY = 0.12      // directional light - moonlight
const NIGHT_AMBIENT_INTENSITY = 0.3   // hemispheric fill
const NIGHT_FOG_BRIGHTNESS = 0.15     // fog fades to near-black instead of glowing
const NIGHT_ENVIRONMENT = 0.25        // PBR image-based lighting
const NIGHT_SKY_LUMINANCE = 0.05
const MOON_TINT = new Color3(0.55, 0.65, 1.0)
const DUSK_TINT = new Color3(1.0, 0.6, 0.35)
// how far below the horizon the sun is fully set, and above it fully up
// (in sin(sun angle) - sunrise/sunset are spread over a short window, not a switch)
const SUN_SET_HEIGHT = -0.08
const SUN_UP_HEIGHT = 0.3
const SKY_SUN_DISTANCE = 100

// village lamp posts (createvillage.js's spawnPoleLights) - off by day, full at night
const LAMP_LIGHT_NAME = "_poleLight_"

export function setDayNightState(state){
    if(typeof state?.timeOfDay !== "number") return
    clock = { timeOfDay: state.timeOfDay, dayLengthMs: state.dayLengthMs || clock.dayLengthMs, receivedAt: performance.now() }
}

export function getTimeOfDay(){
    return (clock.timeOfDay + (performance.now() - clock.receivedAt) / clock.dayLengthMs) % 1
}

const clamp01 = v => Math.min(1, Math.max(0, v))
const lerp = (a, b, t) => a + (b - a) * t
const smoothstep = (lo, hi, v) => { const t = clamp01((v - lo) / (hi - lo)); return t * t * (3 - 2 * t) }

// sun height (sin of its angle above the horizon) and how much daylight that
// gives (0 night .. 1 day), plus how strong the warm sunrise/sunset glow is
function sunState(timeOfDay){
    const angle = (timeOfDay - 0.25) * Math.PI * 2
    const height = Math.sin(angle)
    return {
        angle,
        daylight: smoothstep(SUN_SET_HEIGHT, SUN_UP_HEIGHT, height),
        dusk: clamp01(1 - Math.abs(height) / 0.25),
    }
}

// Starts day/night for `scene` if its place is outdoors. Call once the place's
// lights and sky exist (areascene.js, after the place is built). Lives and dies
// with the scene's own observable.
export function startDayNight(scene, areaType){
    if(!DAYNIGHT_AREA_TYPES.includes(areaType)) return

    // key -> { base, written }: the value's own level, and what was last
    // written - anything else seen there means someone changed it (see header)
    const tracked = new Map()
    const scaleNumber = (key, current, factor) => {
        let t = tracked.get(key)
        if(!t || current !== t.written) t = { base: current }
        t.written = t.base * factor
        tracked.set(key, t)
        return t.written
    }
    const scaleColor = (key, current, tint) => {
        let t = tracked.get(key)
        if(!t || !current.equals(t.written)) t = { base: current.clone() }
        t.written = t.base.multiply(tint)
        tracked.set(key, t)
        return t.written.clone()
    }

    const apply = () => {
        const { angle, daylight, dusk } = sunState(getTimeOfDay())
        const sunTint = Color3.Lerp(MOON_TINT, Color3.White(), daylight)
        const warmTint = Color3.Lerp(sunTint, DUSK_TINT, dusk * 0.6)

        scene.lights.forEach(light => {
            if(light instanceof DirectionalLight){
                light.intensity = scaleNumber(`${light.uniqueId}:i`, light.intensity, lerp(NIGHT_SUN_INTENSITY, 1, daylight))
                light.diffuse = scaleColor(`${light.uniqueId}:c`, light.diffuse, warmTint)
            } else if(light instanceof HemisphericLight){
                light.intensity = scaleNumber(`${light.uniqueId}:i`, light.intensity, lerp(NIGHT_AMBIENT_INTENSITY, 1, daylight))
            } else if(light instanceof PointLight && light.name.includes(LAMP_LIGHT_NAME)){
                light.intensity = scaleNumber(`${light.uniqueId}:i`, light.intensity, 1 - daylight)
            }
        })

        const fogBrightness = lerp(NIGHT_FOG_BRIGHTNESS, 1, daylight)
        scene.fogColor = scaleColor("fog", scene.fogColor, new Color3(fogBrightness, fogBrightness, fogBrightness))
        scene.environmentIntensity = scaleNumber("env", scene.environmentIntensity, lerp(NIGHT_ENVIRONMENT, 1, daylight))

        // createSky's SkyMaterial - the sun placed directly (it ignores
        // inclination/azimuth while useSunPosition is on), arcing east to
        // west overhead and dipping below the horizon at night
        const sky = scene.getMeshByName("skyBox")?.material
        if(sky?.sunPosition){
            sky.useSunPosition = true
            sky.sunPosition.set(Math.cos(angle) * SKY_SUN_DISTANCE, Math.sin(angle) * SKY_SUN_DISTANCE, 0)
            sky.luminance = lerp(NIGHT_SKY_LUMINANCE, 1, daylight)
        }
    }

    apply()
    let frame = 0
    return scene.onBeforeRenderObservable.add(() => {
        if(++frame % UPDATE_EVERY_FRAMES === 0) apply()
    })
}

// debug helper - jumps the WORLD clock forward 3 in-game hours through tcp, so
// every connected client changes together. Wired to a debug key in
// inputMovement.js, like weatherSystem.js's forceWeather.
export function skipTimeOfDayDebug(){
    const socket = getSocket()
    if(!socket) return
    socket.emit("set-time-of-day", { timeOfDay: (getTimeOfDay() + 0.125) % 1 })
}
