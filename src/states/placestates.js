import { metaDatas } from "../constants/localroomdb";
import { getSocketPlacesMD } from "../sockets/joinsocket";
import { getCharDet } from "./characterstate";

let prevPlace = null;
let currentPlace = null;

export function setPlaceDetails(details) {
    prevPlace = currentPlace;
    currentPlace = details;
}

export function findMyCurrentPlace(){
    const charDet = getCharDet()
    let placeMetaData = metaDatas.find( localplace => localplace.placeId === charDet.currentPlace.placeId )
    if(!placeMetaData) {
        placeMetaData = getSocketPlacesMD().find( place => place.placeId === charDet.currentPlace.placeId )
    }

    if(!placeMetaData) {
        console.warn("place metadata not found for current place ID:", charDet.currentPlace.placeId);
        placeMetaData = null
    }
    return placeMetaData
}