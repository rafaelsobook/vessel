// How strong a character's flex aura looks (effects/aura.js draws it). Plain
// numbers, no Babylon, so characterstate.js can work it out from the live
// stats and it can ride the socket to every other player as-is.
//
//   power (0-1)    - how far max hp / mp / sp have grown past a fresh
//                    character's. 0 is just glitter on the body; 1 is a full
//                    blaze with lightning and pressure waves.
//   darkness (0-1) - a "darkness" aptitude, by its level. 0 without one. Shows
//                    as black flame and tendrils mixed into the aura.
//   form           - what the character has evolved into (evolution.js's
//                    names - "demon"), or null for a human. A form has a look
//                    of its own (aura.js); power still sets how strong it is.

// what server/routes/characterR.js rolls for a new character (hp 4100-4199,
// mp 100-199, sp 1000-1099)
const FRESH = { hp: 4150, mp: 150, sp: 1050 }
// how much of each, grown on its own, reads as a full-strength aura. Picked so
// a strength point (+50 hp, +5 mp, +30 sp - statsSystem.js) and a magic point
// (+90 mp) each push the aura about the same amount: roughly 8 points brings
// the first flames, 15 the streaks, and 25-30 the full blaze.
const FULL_GROWTH = { hp: 2500, mp: 2200, sp: 1500 }

// server's aptitude name is "darkness", skills call the element "dark"
// (aptitudeSystem.js's APTITUDE_ELEMENT_ALIASES) - either counts
const DARK_ELEMENTS = ["darkness", "dark"]
// level 1 already shows a clear black streak; level 6 and up is all of it
const DARKNESS_AT_LEVEL_1 = 0.45
const DARKNESS_PER_LEVEL = 0.11

const clamp01 = n => Math.min(1, Math.max(0, n))
const round2 = n => Math.round(n * 100) / 100

function growth(value, stat){
    if(!(value > 0)) return 0
    return clamp01((value - FRESH[stat]) / FULL_GROWTH[stat])
}

export function darknessOf(aptitude){
    const dark = Array.isArray(aptitude) ? aptitude.find(apt => DARK_ELEMENTS.includes(apt?.element)) : null
    if(!dark) return 0
    return round2(clamp01(DARKNESS_AT_LEVEL_1 + DARKNESS_PER_LEVEL * ((dark.level ?? 1) - 1)))
}

// Any one stat growing raises the power, several growing together raise it
// faster, and it never passes 1: power = 1 - (1-hp)(1-mp)(1-sp).
export function computeAuraProfile({ maxHp, maxMp, maxSp, aptitude, evolution }){
    const power = 1 - (1 - growth(maxHp, "hp")) * (1 - growth(maxMp, "mp")) * (1 - growth(maxSp, "sp"))
    return { power: round2(power), darkness: darknessOf(aptitude), form: evolution?.evolutionName ?? null }
}

// a character record (charState, or another player's det from the socket)
// when no ready-made profile came with it - only its base max stats, so it
// can read a little lower than that player's own live profile
export function auraProfileFromDet(det){
    if(det?.aura) return det.aura
    return computeAuraProfile({ maxHp: det?.maxHp, maxMp: det?.maxMp, maxSp: det?.maxSp, aptitude: det?.aptitude, evolution: det?.evolution })
}

// whether two profiles look different enough to rebuild the aura over
export function auraProfileChanged(a, b){
    if(!a || !b) return a !== b
    return Math.abs(a.power - b.power) >= 0.02 || a.darkness !== b.darkness || (a.form ?? null) !== (b.form ?? null)
}
