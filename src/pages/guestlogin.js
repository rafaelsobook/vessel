import { APIURL } from "../constants/constants.js"
import { useFetch } from "../tools/tools.js"
import { setLoading, rememberHowEntered } from "./mainpage.js"
import { enterWithAccount } from "./loginpage.js"
import { showAuthError, clearAuthError } from "./authform.js"

// PLAY AS GUEST - the server (server/routes/userR.js's /users/guest) makes a
// real account with a Guest##### name and a random secret for its password.
// This device keeps both in localStorage (the session itself only lives as
// long as the tab) and logs in with them next time, so the guest's hero is
// still there. Registering on this device claims that same account
// (registerpage.js) instead of starting over.
const GUEST_KEY = "vessel_guest"

/** This device's guest - { username, secret } - or null */
export function getSavedGuest(){
    try {
        const guest = JSON.parse(localStorage.getItem(GUEST_KEY))
        return guest?.username && guest?.secret ? guest : null
    } catch {
        return null
    }
}
export function forgetGuest(){
    try { localStorage.removeItem(GUEST_KEY) } catch {}
}
function keepGuest(username, secret){
    try { localStorage.setItem(GUEST_KEY, JSON.stringify({ username, secret })) } catch {}
}

/** { token, details } for this device's guest, "norecord" if its account is gone, undefined if the server can't be reached */
export function logInGuest(guest){
    return useFetch(`${APIURL}/users/login`, "POST", null, { username: guest.username, password: guest.secret })
}

export async function playAsGuest(){
    setLoading(true)
    clearAuthError()

    const saved = getSavedGuest()
    let data = saved ? await logInGuest(saved) : null
    // unreachable - keep this guest and let them try again, a new one would orphan its hero
    if(saved && data === undefined) return refuse()
    if(data === "norecord"){
        forgetGuest()
        data = null
    }
    if(!data){
        data = await useFetch(`${APIURL}/users/guest`, "POST", null, {})
        if(data === "toomanyguests") return refuse("Too many new guests from here. Try again later.")
        if(!data?.token || !data.guestSecret) return refuse()
        keepGuest(data.details.username, data.guestSecret)
    }
    if(!data.token) return refuse()

    if(await enterWithAccount(data)) rememberHowEntered("guest")
}

function refuse(text = "Server error, try again."){
    setLoading(false)
    showAuthError(text)
}
