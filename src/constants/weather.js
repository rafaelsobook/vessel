// Weather + ambient temperature — the single source of truth for BOTH sides.
//
// tcp/recources/weather.ts holds a deliberate mirror of WEATHER_TYPES and
// WEATHER_AMBIENT_TEMP. They have to stay identical: tcp decides which weather
// is active and broadcasts only the NAME ("rain"), never the temperature, so
// each client looks the number up locally. If the two tables ever disagree,
// players in the same storm quietly take different damage - the same class of
// bug renderer.js's own BOT_SPRINT_SPEED comment warns about, where the client
// and npcBrain.ts must agree on a constant neither one sends.
//
// There is exactly ONE weather in the world at a time, not one per place -
// whatever is falling in the openworld is falling in the village too.

export const WEATHER_TYPES = ["clear", "rain", "fog", "snow", "sandstorm"]

// Absolute ambient temperature in degrees, NOT a modifier on some per-place
// baseline. "clear" is the normal, comfortable case everything else is read
// against.
export const WEATHER_AMBIENT_TEMP = {
    clear:      20,
    rain:       10,
    fog:         0,
    snow:      -30,
    sandstorm:  40,
}

// Only outdoor places get weather. A "room" is indoors, a "dungeon" is
// underground, and a "duel" is a bounded 1v1 arena where a sandstorm would
// change the terms of a fight - all three stay permanently clear, and a player
// standing in one reads CLEAR_TEMP rather than whatever the sky is doing
// outside.
export const WEATHERED_AREA_TYPES = ["openworld", "village"]
export const INDOOR_AMBIENT_TEMP = WEATHER_AMBIENT_TEMP.clear

// ── Body temperature ──────────────────────────────────────────────────────
// A third survival stat alongside hunger (needs to eat) and sleep (needs to
// rest), stored in the same character.survival object and persisted with it.

// what a healthy character sits at, and what they recover back toward once
// they're out of the weather. Note this is also BODY_TEMP_MAX_SAFE - a
// character rests at the TOP of the safe band, so heat has much less headroom
// than cold before it starts hurting. That's intentional per the spec
// (maintain 15-35), just worth knowing when tuning: any sustained heat
// exposure crosses the line quickly, while cold has 20 degrees of slack.
export const BODY_TEMP_NORMAL = 35
export const BODY_TEMP_MIN_SAFE = 15

// 40, not 35 - a deliberate deviation from the stated "maintain 15-35", and
// the one number here worth a second look.
//
// A character RESTS at 35, so with the ceiling also at 35 the very first tick
// of any heat at all pushes them over it. Simulated against the real 6.2s
// survival cadence, a sandstorm with no heat gear started costing hp after
// SIX SECONDS and ran body temp up to 75 - which contradicts the other half of
// the spec, that a 40-degree sandstorm is "normal, a little heat". The cold
// end has 20 degrees of slack before damage (35 down to 15); the hot end had
// literally none.
//
// 40 gives heat 5 degrees of the same kind of slack, which at scaled drift
// works out to roughly three minutes in an unprotected sandstorm before the
// first hp is lost - a burn you can feel coming and walk out of, rather than
// a wall. Set this back to 35 if instant heat damage was actually intended.
export const BODY_TEMP_MAX_SAFE = 40

// hp lost per survival tick while body temp is outside the safe band
export const TEMP_DAMAGE_PER_TICK = 1

// how far body temp moves per tick at FULL strain. Drift, not a jump, so
// sprinting through a snowfield is survivable and stopping to fight in one
// isn't - and so stepping back indoors visibly recovers rather than snapping.
export const BODY_TEMP_DRIFT_PER_TICK = 1

// Strain (degrees past your safe limit) at which drift runs at full rate.
// Below it the drift scales down proportionally, which is what makes PARTIAL
// resistance worth wearing: a flat drift rate made cold:15 in a -30 blizzard
// behave identically to wearing nothing at all - both started taking damage at
// the same moment - so every piece of gear below the full 30 was decorative.
// Scaled, cold:15 halves the strain and therefore doubles your survival time.
// It also turns a 5-degree overshoot (a sandstorm with no heat gear) into the
// slow burn it should be rather than damage within one tick.
export const STRAIN_FOR_FULL_DRIFT = 30

// hard stops so an unattended character in an extreme doesn't run off to
// absurd values - nothing reads body temp past the damage threshold anyway,
// and an unbounded number shows up in the HUD readout
export const BODY_TEMP_FLOOR = -10
export const BODY_TEMP_CEILING = 60
// recovery is faster than exposure, so getting out of the weather actually
// feels like relief rather than a second slow crawl
export const BODY_TEMP_RECOVER_PER_TICK = 2

// ── Resistance ────────────────────────────────────────────────────────────
// Gear carries `tempResistance: { cold: N, heat: N }` (armors, pauldrons,
// helmets, gauntlets, boots). Totals are summed across everything equipped.
//
// COLD: resistance N means safe down to -N degrees. So cold:40 shrugs off
// anything to -40, and cold:0 is only safe down to 0 (fog sits exactly on
// that edge; snow at -30 needs cold:30 to be harmless).
//
// HEAT: resistance N means safe up to HEAT_SAFE_BASE + N. With no heat gear
// at all you're fine to 35, so a 40-degree sandstorm puts you 5 over - a slow
// burn rather than a wall, and any heat resistance at all removes it.
export const HEAT_SAFE_BASE = 35
export const COLD_SAFE_BASE = 0

/**
 * How far outside the safe range this ambient temperature is, given gear.
 * Negative = too cold by that many degrees, positive = too hot by that many,
 * 0 = comfortable. The sign is what tells a caller which way body temp drifts.
 */
export function temperatureStrain(ambient, resistance = { cold: 0, heat: 0 }){
    const coldFloor = COLD_SAFE_BASE - (resistance.cold ?? 0)
    const heatCeiling = HEAT_SAFE_BASE + (resistance.heat ?? 0)

    if(ambient < coldFloor) return ambient - coldFloor
    if(ambient > heatCeiling) return ambient - heatCeiling
    return 0
}
