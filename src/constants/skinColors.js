// Single source of truth for the game's skin texture options - reused by the
// character creation swatch picker (setupcharacterscene.js), the actual body
// material builder (createcharacter.js), and NPC/enemy defaults
// (npcDetails.js) so there's one place to add/adjust skins instead of the
// same texture paths copy-pasted at every call site.
//
// Keys (not the paths) are what actually gets persisted - server/models/
// charDetM.js stores a player's skinColor as this plain string, e.g. "skin1".
export const SKIN_TEXTURES = {
    skin1: "./images/skincolors/skin1.webp",
    skin2: "./images/skincolors/skin2.webp",
    skin3: "./images/skincolors/skin3.webp",
    skin4: "./images/skincolors/skin4.webp",
}

// {key, path} pairs, in swatch-button order - the key is what's sent/stored,
// the path is only needed for rendering the swatch thumbnail.
export const SKIN_TEXTURE_LIST = Object.entries(SKIN_TEXTURES).map(([key, path]) => ({ key, path }))
