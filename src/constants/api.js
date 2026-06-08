import { APIURL, sessionStorageName, webSocketURL } from "./constants.js";
import { useFetch } from "../tools/tools.js";

export async function getCharDetFromDB(accountDet){
    if(!accountDet.details) return console.log("NO SessionStorage (accounts)")
    console.log(accountDet.details)
    const res = await fetch(`${APIURL}/characters/${accountDet.details._id}`, {
        headers: { authori: `Bearer ${accountDet.token}` }
    })
    return res.json()
}

export function keepAccountWithTokenDet(accoundDetail){
    sessionStorage.setItem(sessionStorageName, JSON.stringify(accoundDetail))
}