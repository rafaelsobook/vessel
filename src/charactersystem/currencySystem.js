// Currency isn't a numeric wallet - bronze/silver/gold are real inventory
// items (itemCateg "currency"), same as any other stackable item. 1 silver
// = 10 bronze, 1 gold = 10 silver.
import { obtain } from "./inventory.js"

export const COIN_VALUES = { bronze: 1, silver: 10, gold: 100 }
const COIN_ORDER = ["gold", "silver", "bronze"]

function createCoinItem(coinType, qnty){
    return {
        itemId: `coin_${coinType}`,
        name: coinType, // bronze/silver/gold - also the image name
        dn: `${coinType.charAt(0).toUpperCase()}${coinType.slice(1)} Coin`,
        itemCateg: "currency",
        itemType: "coin",
        price: { coinType, pieces: 1 },
        qnty,
        desc: `A ${coinType} coin.`,
        rarity: "common"
    }
}

// items saved before prices became {coinType, pieces} objects can still have
// a plain number sitting in the database - treat that number as bronze
// pieces so old data doesn't silently compute NaN and swallow the coins
export function priceToBronze(price){
    if(!price) return 0
    if(typeof price === "number") return price
    return price.pieces * (COIN_VALUES[price.coinType] || 1)
}

export function getWealthInBronze(charState){
    return charState.items.reduce((total, itm) => {
        if(itm.itemCateg !== "currency") return total
        return total + (COIN_VALUES[itm.name] || 0) * itm.qnty
    }, 0)
}

export function canAfford(charState, price){
    return getWealthInBronze(charState) >= priceToBronze(price)
}

// selling something deposits its value as plain bronze coins through the
// normal obtain() flow, so it stacks onto whatever bronze you already have
// exactly like any other stackable item (and gets the same acquired popup)
export async function earnFromPrice(price){
    const bronzeEarned = priceToBronze(price)
    if(bronzeEarned <= 0) return
    await obtain(createCoinItem("bronze", bronzeEarned))
}

// spending draws from whichever coins you're holding (bronze/silver/gold)
// and may need to make change, so it recomputes the 3 stacks from the new
// bronze-equivalent total rather than tracking exactly which coins were spent
export function spendOnPrice(charState, price){
    const cost = priceToBronze(price)
    const wealth = getWealthInBronze(charState)
    if(wealth < cost) return false

    charState.items = charState.items.filter(itm => itm.itemCateg !== "currency")
    let remaining = wealth - cost
    COIN_ORDER.forEach(coinType => {
        const value = COIN_VALUES[coinType]
        const count = Math.floor(remaining / value)
        remaining -= count * value
        if(count > 0) charState.items.push(createCoinItem(coinType, count))
    })
    return true
}
