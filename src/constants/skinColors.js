// Single source of truth for the game's skin tone palette - reused by the
// character creation swatch picker (setupcharacterscene.js) and NPC/enemy
// defaults (npcDetails.js) so there's one place to add/adjust tones instead
// of the same r/g/b literals copy-pasted at every call site.
export const SKIN_COLORS = {
    dark:  { r: 0.45, g: 0.30, b: 0.16 },
    mid:   { r: 0.76, g: 0.57, b: 0.38 },
    light: { r: 0.93, g: 0.78, b: 0.63 },
}

// Ordered dark -> light for rendering swatch buttons in sequence.
export const SKIN_COLOR_LIST = Object.values(SKIN_COLORS)
