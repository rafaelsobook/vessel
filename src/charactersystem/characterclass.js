import { openClosePopup } from "../tools/popupUI"
import { getCharState } from "./characterstate"

let swordSwing = 0
let spearSwing = 0
let axeSwing = 0
let hammerSwing = 0
let fistattacks = 0
let castMagic = 0

let maxSwingToLevelUp = 50
let maxCastToLevel = 30

export function triggerClassLeveling(_weaponType){

    const charState = getCharState()
    switch(_weaponType){
        case "sword":
            swordSwing++
            if(swordSwing >= (maxSwingToLevelUp+(charState.characterclass.warbringer.lvl*5))) {
                swordSwing = 0
                charState.characterclass.warbringer.lvl++
                openClosePopup(`warbringer reached level ${charState.characterclass.warbringer.lvl}`, true, 2500)
            }
        break
        case "axe":
            axeSwing++
            if(axeSwing >= (maxSwingToLevelUp+(charState.characterclass.viking.lvl*5))) {
                axeSwing = 0
                charState.characterclass.viking.lvl++
                openClosePopup(`viking reached level ${charState.characterclass.viking.lvl}`, true, 2500)
            }
        break
        case "spear":
            spearSwing++
            if(spearSwing >= (maxSwingToLevelUp+(charState.characterclass.paladin.lvl*5))) {
                spearSwing = 0
                charState.characterclass.paladin.lvl++
                openClosePopup(`paladin reached level ${charState.characterclass.paladin.lvl}`, true, 2500)
            }
                console.log("triggering ", _weaponType)
                console.log(spearSwing)
                console.log((maxSwingToLevelUp+(charState.characterclass.warhammer.lvl*5)))
        break

        case "hammer":
            hammerSwing++
            if(hammerSwing >= (maxSwingToLevelUp+(charState.characterclass.runecaller.lvl*5))) {
                hammerSwing = 0
                charState.characterclass.warbringer.lvl++
                openClosePopup(`warhammer reached level ${charState.characterclass.warhammer.lvl}`, true, 2500)
            }
        break
        case "cast":
            castMagic++
            if(castMagic >= (maxSwingToLevelUp+(charState.characterclass.berserker.lvl*5))) {
                castMagic = 0
                charState.characterclass.runecaller.lvl++
                openClosePopup(`runecaller reached level ${charState.characterclass.runecaller.lvl}`, true, 2500)
            }
        break
        case "fist":
            fistattacks++
            if(axeSwing >= maxCastToLevel) {
                fistattacks = 0
                charState.characterclass.berserker.lvl++
                openClosePopup(`berserker reached level ${charState.characterclass.berserker.lvl}`, true)
            }
        break
    }
}