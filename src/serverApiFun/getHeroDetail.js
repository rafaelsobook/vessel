import {APIURL, sessionStorageName, webSocketURL} from "../constants/constants.js"
import { useFetch } from "../tools/tools.js"

export async function getHeroDetail(accountDet){

    if(!accountDet || !accountDet.details) return null
    const data = await useFetch(`${APIURL}/characters/${accountDet.details._id}`, "GET", accountDet.token, false)

    return data
}