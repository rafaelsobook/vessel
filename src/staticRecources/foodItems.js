import { randomNum } from "../tools/tools.js"

// Jerky - strips of dried, salted meat. The guild's ration for new members:
// Emry hands out three on registering you as an F-rank adventurer
// (npcDetails.js's touchTheCrystal). Like every food it also mends you a
// little over the few seconds after you eat it (itemInfoSystem.js's
// mendAfterEating). Icon: images/items/consumable/jerky.webp.
export function jerkyItem(qnty = 1){
    return {
        itemId: randomNum(),
        name: "jerky",
        dn: "Jerky",
        itemCateg: "consumable",
        itemType: "food",
        weaponType: false,
        consumeAbilities: { plusHp: 50, plusMp: 0, plusSp: 10, plusDmg: 0, plusSpd: 0, fillHunger: 30, fillTireness: 0, cure: [] },
        price: { coinType: "bronze", pieces: 5 },
        qnty,
        desc: "Strips of dried, salted meat - tough to chew, but it keeps for weeks on the road. A guild ration for new members.",
        rarity: "normal",
    }
}
