import  {charDet}  from "../constants/character/detail.js";

let charState = null;

export function getCharDet(){
    return charDet
}

export function setCharState(_characterDetail){
    charState = _characterDetail;
}

export function getCharSocket(){
    return {
        owner: charDet.owner,
        name: charDet.name,
        placeId: charDet.placeId,
    }
}