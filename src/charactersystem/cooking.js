import { randomNum } from "../tools/tools.js"

// What can be cooked and what it turns into - the recipe side of cooking.
// The cooking itself (the bonfire's interact button, the list, the spit, the
// 5 second roast) is components/bonfireCooking.js.
//
// An item can be cooked when it carries its own recipe: `canBeCooked: true`
// plus `cookRecipe`, what one of it becomes (tcp/recources/mushroomLibrary.ts
// gives every mushroom one). What comes off the fire is the raw item with the
// recipe laid over it, flagged `cooked: true`.

// a cooked item's picture is its raw one's, toasted
export const COOKED_ICON_FILTER = "sepia(0.6) saturate(1.4) brightness(0.8)"

// how long anything takes to cook over a bonfire
export const COOK_TIME_MS = 5000

// The recipe an item carries. Mushrooms picked before the recipe was renamed
// still have it under `cooked` (an object, where now `cooked` is just the
// cooked item's true flag) - still read, so they can be cooked too.
function recipeOf(item){
    if(item?.cookRecipe) return item.cookRecipe
    if(item?.cooked && typeof item.cooked === "object") return item.cooked
    return null
}

export function canBeCooked(item){
    return item?.canBeCooked === true && !!recipeOf(item)
}

// everything in the inventory that could go over the fire
export function getCookableItems(charState){
    return charState?.items?.filter(canBeCooked) ?? []
}

// isCooked: the flag's name for the few cooked before it was called `cooked`
export function isCookedItem(item){
    return item?.cooked === true || item?.isCooked === true
}

// the picture for any item - its own, or the one its category and name point at
export function itemIconPath(item){
    return item.icon ?? `./images/items/${item.itemCateg}/${item.name}.webp`
}

// One cooked item from one raw one: the raw item with its recipe laid over it
// (new name, stats, price...), `cooked: true`, and no recipe of its own left,
// so it can't be cooked again.
export function makeCookedItem(raw){
    const recipe = recipeOf(raw)
    const { canBeCooked: _c, cookRecipe: _r, cooked: _o, isCooked: _i, ...rest } = raw
    return { ...rest, ...recipe, itemId: randomNum(), qnty: 1, cooked: true }
}
