// THE HOME PAGE'S SOUND - the theme while it shows, and the summoning when you
// enter. A browser plays nothing before the player's first click or key on the
// page, so the theme waits for one. It fades out as the world loads (the game
// has its own sounds). index.html's .hp-sound-btn turns all of it on and off,
// remembered on this device.
const THEME = "./sounds/backg/cinema1.mp3"
const THEME_VOLUME = 0.4
const THEME_FADE_IN_MS = 2500
const SUMMON = "./sounds/magic/magiccircle.mp3"
const SUMMON_VOLUME = 0.6
const SOUND_OFF_KEY = "vessel_home_sound_off"

const soundBtn = document.querySelector(".hp-sound-btn")

let theme = null
let fadeFrame = 0
// the home page is showing - the theme plays as soon as the browser lets it
let wanted = false

function soundOff(){
    try { return localStorage.getItem(SOUND_OFF_KEY) === "1" } catch (err) { return false }
}
function setSoundOff(off){
    try { off ? localStorage.setItem(SOUND_OFF_KEY, "1") : localStorage.removeItem(SOUND_OFF_KEY) } catch (err) {}
    soundBtn.classList.toggle("muted", off)
}

function fadeTheme(target, ms, onDone){
    cancelAnimationFrame(fadeFrame)
    const from = theme.volume
    const start = performance.now()
    const step = now => {
        // a frame's timestamp can be from just before this call
        const k = Math.min(1, Math.max(0, (now - start) / ms))
        theme.volume = from + (target - from) * k
        if(k < 1) fadeFrame = requestAnimationFrame(step)
        else onDone?.()
    }
    fadeFrame = requestAnimationFrame(step)
}

function playTheme(){
    if(!wanted || soundOff()) return
    if(!theme){
        theme = new Audio(THEME)
        theme.loop = true
        theme.volume = 0
    }
    // still blocked before the first click/key - the next one tries again
    theme.play().then(() => wanted && !soundOff() && fadeTheme(THEME_VOLUME, THEME_FADE_IN_MS)).catch(() => {})
}

function fadeOutTheme(ms){
    if(!theme || theme.paused) return
    fadeTheme(0, ms, () => theme.pause())
}

export function startHomeMusic(){
    wanted = true
    playTheme()
}

export function stopHomeMusic(ms = 1400){
    wanted = false
    fadeOutTheme(ms)
}

export function playSummonSound(){
    if(soundOff()) return
    const summon = new Audio(SUMMON)
    summon.volume = SUMMON_VOLUME
    summon.play().catch(() => {})
}

// the first click or key lets the theme start
const tryTheme = () => { if(wanted && (!theme || theme.paused)) playTheme() }
document.addEventListener("pointerdown", tryTheme)
document.addEventListener("keydown", tryTheme)

soundBtn.addEventListener("click", () => {
    const off = !soundOff()
    setSoundOff(off)
    if(off) fadeOutTheme(400)
    else playTheme()
})
setSoundOff(soundOff())
