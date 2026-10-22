import { Color3 } from "@babylonjs/core"

// How an evolution (evolution.js) changes a character's face - applied the
// moment the change breaks through, and every time the character is built
// after that (createcharacter.js), so it lasts like the wings do.
//   eyes:    images/modeltex/eyes/<eyes>eye.jpg, in place of the race's own
//   eyeback: the colour behind the eyes (their whites)
export const EVOLUTION_LOOKS = {
    demon: { eyes: "demon", eyeback: new Color3(0, 0, 0) },
}

// the look for a character's evolution ({ evolutionName, ... }), or null.
// Own keys only - the name can come from another player over the network.
export function evolutionLook(evolution){
    const name = evolution?.evolutionName
    return Object.hasOwn(EVOLUTION_LOOKS, name ?? "") ? EVOLUTION_LOOKS[name] : null
}
