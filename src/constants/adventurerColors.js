// Shared hair/cloth/pants color palette - reused by NPC data (npcDetails.js)
// and the player's character-creation defaults/color picker
// (setupcharacterscene.js) instead of the same r/g/b literals being
// retyped (with slightly inconsistent formatting) at every call site.
export const ADVENTURER_COLORS = {
    black:     { r: 0,    g: 0,    b: 0    },
    white:     { r: 1,    g: 1,    b: 1    },
    gray:      { r: 0.5,  g: 0.5,  b: 0.5  },
    charcoal:  { r: 0.15, g: 0.15, b: 0.15 },
    red:       { r: 0.9,  g: 0,    b: 0    },
    maroon:    { r: 0.5,  g: 0.1,  b: 0.1  },
    yellow:    { r: 0.9,  g: 1,    b: 0    },
    tan:       { r: 0.42, g: 0.30, b: 0.16 },
    brown:     { r: 0.3,  g: 0.2,  b: 0.1  },
    darkBrown: { r: 0.22, g: 0.13, b: 0.05 },
    darkTeal:  { r: 0.1,  g: 0.2,  b: 0.2  },
    slateBlue: { r: 0.2,  g: 0.3,  b: 0.4  },
    blue:      { r: 0.1,  g: 0.2,  b: 0.5  },
}
