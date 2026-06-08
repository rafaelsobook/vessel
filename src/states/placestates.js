import { metaDatas } from "../constants/localroomdb";
import { getSocketPlacesMD } from "../sockets/joinsocket";
import {  getCharState } from "../charactersystem/characterstate.js";

let prevPlace = null;
let currentPlace = null;

export function setPlaceDetails(details) {
    prevPlace = currentPlace;
    currentPlace = details;
}

export function findMyCurrentPlace(){
    const charState = getCharState()
    let placeMetaData = metaDatas.find( localplace => localplace.placeId === charState.currentPlace.placeId )
    if(!placeMetaData) {
        placeMetaData = getSocketPlacesMD().find( place => place.placeId === charState.currentPlace.placeId )
    }

    if(!placeMetaData) {
        console.warn("place metadata not found for current place ID:", charState.currentPlace.placeId);
        placeMetaData = null
    }
    return placeMetaData
}

export function findPlaceMetaData(placeId){

    let placeMetaData = metaDatas.find( localplace => localplace.placeId === placeId )
    if(!placeMetaData) {
        placeMetaData = getSocketPlacesMD().find( place => place.placeId === placeId )
    }

    if(!placeMetaData) {
        console.warn("place metadata not found for current place ID:", placeId);
        placeMetaData = null
    }
    return placeMetaData
}