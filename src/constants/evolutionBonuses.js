// What an evolution adds to your max hp / mp / sp while you stay evolved
// (evolution.js's EVOLUTIONS names). characterstate.js adds it on top of the
// ability bonus whenever the stats are summed (summarizeStats) - read off the
// saved characterState.evolution, so it's there after a relog, never piles up
// from evolving twice, and is gone the moment you devolve.
export const EVOLUTION_BONUSES = {
    demon: { hp: 500, mp: 600, sp: 1000 },
}

export function evolutionBonus(evolution){
    const name = evolution?.evolutionName
    return Object.hasOwn(EVOLUTION_BONUSES, name) ? EVOLUTION_BONUSES[name] : { hp: 0, mp: 0, sp: 0 }
}
