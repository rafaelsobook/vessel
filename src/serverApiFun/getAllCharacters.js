import { APIURL } from "../constants/constants.js"
import { useFetch } from "../tools/tools.js"

export async function getAllCharacters(token){
    const data = await useFetch(`${APIURL}/characters`, "GET", token, false)
    return Array.isArray(data) ? data : []
}
