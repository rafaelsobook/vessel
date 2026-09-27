import { applyWeather, stopWeather, getActiveWeather } from "../effects/weather.js"
import { WEATHER_AMBIENT_TEMP, WEATHERED_AREA_TYPES, INDOOR_AMBIENT_TEMP, WEATHER_TYPES, COLD_SAFE_BASE, HEAT_SAFE_BASE } from "../constants/weather.js"
import { getCharState } from "../charactersystem/characterstate.js"
import { getSceneDet } from "../main/main.js"
import { getSocket } from "../sockets/joinsocket.js"
import { findMyCurrentPlace } from "../states/placestates.js"
import { getAllSounds } from "./soundSystem.js"

// Bridges tcp's world weather to (a) what this client draws and (b) what
// temperature its player is standing in.
//
// tcp owns the weather and there is only ONE in the world at a time, so this
// holds a single value rather than a per-place map. What varies per client is
// only whether that weather is VISIBLE and whether it BITES: a player in a
// room or a dungeon is indoors, so they see clear skies and feel
// INDOOR_AMBIENT_TEMP no matter what is happening outside. That decision has
// to live client-side because the server never tracks which place a player is
// standing in closely enough to make it per-player.

let worldWeather = "clear"

const weatherIndicator = document.querySelector(".weather-indicator")
const weatherName = document.querySelector(".weather-name")
const weatherTemp = document.querySelector(".weather-temp")

// player-facing names - the internal keys are lowercase single words that
// read badly in a HUD readout ("sandstorm" -> "Sandstorm", and "clear" wants
// to say what the sky is doing rather than name a state)
const WEATHER_LABELS = {
    clear:     "Clear Skies",
    rain:      "Rain",
    fog:       "Fog",
    snow:      "Snowfall",
    sandstorm: "Sandstorm",
}

export function getWorldWeather(){
    return worldWeather
}

// The temperature THIS player is actually exposed to right now. Indoors is
// always comfortable - weather is an outdoor concern, and a dungeon being
// -30 because it happens to be snowing above ground would be nonsense.
export function getAmbientTemperature(){
    const areaType = getCharState()?.currentPlace?.areaType ?? findMyCurrentPlace()?.areaType
    if(!WEATHERED_AREA_TYPES.includes(areaType)) return INDOOR_AMBIENT_TEMP
    return WEATHER_AMBIENT_TEMP[worldWeather] ?? INDOOR_AMBIENT_TEMP
}

// Called both from the "weather-changed" broadcast and from the weather field
// riding on every "userJoined" snapshot, so a client that joins or walks
// through a door mid-storm lands already showing it.
export function setWorldWeather(weather){
    if(!WEATHER_TYPES.includes(weather)) return
    worldWeather = weather
    refreshWeatherVisuals()

    setTimeout(() => {
        switch(weather){
            case "rain":
                getAllSounds().rainy.play()
            break
            case "rain", "sandstorm":
                getAllSounds().windy.play()
            break
            default:
                getAllSounds().rainy.stop()
                getAllSounds().windy.stop()
            break
        }
    },1000)
}

// Re-evaluates what should be on screen for the place this client is in NOW.
// Called on weather change AND on every scene load - walking from an
// openworld blizzard into a dungeon has to clear the visuals even though the
// world weather itself never changed.
export function refreshWeatherVisuals(){
    const { scene } = getSceneDet() ?? {}
    if(!scene || scene.isDisposed) return

    const areaType = getCharState()?.currentPlace?.areaType ?? findMyCurrentPlace()?.areaType
    const visible = WEATHERED_AREA_TYPES.includes(areaType)

    // "clear" rather than stopWeather() - applyWeather's own clear branch
    // restores the place's captured base fog, where a bare teardown would
    // leave whatever the last storm set on the scene
    applyWeather(scene, visible ? worldWeather : "clear")
    updateWeatherIndicator(visible)
}

// Top-centre HUD readout. Hidden entirely indoors rather than showing "Clear
// Skies" - a dungeon has no sky, and reporting one is worse than reporting
// nothing. The temperature shown is getAmbientTemperature(), i.e. what this
// player is actually exposed to, not the raw weather value, so it stays
// truthful in every place.
function updateWeatherIndicator(visible){
    if(!weatherIndicator) return

    if(!visible){
        weatherIndicator.style.display = "none"
        return
    }

    const ambient = getAmbientTemperature()
    weatherIndicator.style.display = "flex"
    if(weatherName) weatherName.textContent = WEATHER_LABELS[worldWeather] ?? worldWeather
    if(weatherTemp) weatherTemp.textContent = `${ambient}°`

    // tint toward what's falling. Thresholds are the bare COLD_SAFE_BASE /
    // HEAT_SAFE_BASE from constants/weather.js deliberately WITHOUT the
    // player's gear folded in - this says what the weather is doing, while the
    // survival readout next to hunger/sleep is what says whether they're
    // personally coping with it.
    weatherIndicator.classList.toggle("is-cold", ambient < COLD_SAFE_BASE)
    weatherIndicator.classList.toggle("is-hot", ambient > HEAT_SAFE_BASE)
}

// main.js's changeScene disposes the whole scene, taking the field mesh with
// it - this just clears effects/weather.js's module-level handle so the next
// place doesn't think a mesh from a dead scene is still live.
export function onSceneDisposedForWeather(){
    stopWeather()
}

// debug helper - forces the world onto one weather through tcp, so every
// connected client changes together rather than this one drifting out of sync
// with everyone else. Wired to a debug key in inputMovement.js.
export function forceWeather(weather){
    const socket = getSocket()
    if(!socket) return
    socket.emit("set-weather", { weather })
}

export function cycleWeatherDebug(){
    const index = WEATHER_TYPES.indexOf(getActiveWeather())
    forceWeather(WEATHER_TYPES[(index + 1) % WEATHER_TYPES.length])
}
