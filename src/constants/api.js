import { APIURL, sessionStorageName, webSocketURL } from "./constants.js";
import { useFetch } from "../tools/tools.js";

export async function getCharDetFromDB(accountDet){

    if(!accountDet.details) return false
    try {
        const res = await fetch(`${APIURL}/characters/${accountDet.details._id}`, {
            headers: { authori: `Bearer ${accountDet.token}` }
        }) 
        return res.json()
    } catch (error) {
         console.log(error)
         return false
    }

}
   
    

export function keepAccountWithTokenDet(accoundDetail){
    console.log(JSON.stringify(accoundDetail))
    sessionStorage.setItem(sessionStorageName, JSON.stringify(accoundDetail))
}