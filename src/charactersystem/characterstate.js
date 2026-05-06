import  {charDet}  from "../constants/character/detail.js";

let charState = null;

export function getCharDetFromDB(){
    return charDet
}

export function setCharState(_characterDetail){
    charState = _characterDetail;
}
export function getCharState(_characterDetail){
    return charState
}
export function getCharSocket(){
    return {
        owner: charState.owner,
        name: charState.name,
        lvl: charState.lvl,
        cloth: charState.cloth,
        pants: charState.pants,
        hair: charState.hair,
        boots: charState.boots,
        currentPlace: charState.currentPlace
    }
}


// DUAL PURPOSE FUNCTIONS

// this should be converted to async func if have database
export function getCharDetFromDBAndUpdateCharState(){
    const charDetFromDB = getCharDetFromDB()
    setCharState(charDetFromDB)
    return charState
}
