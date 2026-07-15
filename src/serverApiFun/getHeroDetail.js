import {APIURL, sessionStorageName, webSocketURL} from "../constants/constants.js"
import { openCloseLScreen } from "../tools/popupUI.js"
import { useFetch } from "../tools/tools.js"

export async function getHeroDetail(accountDet){

    if(!accountDet || !accountDet.details) {
        openCloseLScreen(false)
        return false
    }
    const data = await useFetch(`${APIURL}/characters/${accountDet.details._id}`, "GET", accountDet.token, false)
    if(data === "tokenfailed") {
        openCloseLScreen(false)
        return false
    }
    return data
}