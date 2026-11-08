import { APIURL } from "../constants/constants.js"
import { startScene } from "../main/main.js"
import { keepAccountWithTokenDet, getCharDetFromDB } from "../constants/api.js"
import { checkIfTokenSaved } from "../tools/tools.js"
import { setLoading, hideHomePage, setAuthMode, rememberHowEntered } from "./mainpage.js"
import { usernameInput, passwordInput, showAuthError, clearAuthError } from "./authform.js"

export function formMessage(_infoMessage){
    const homePage = document.querySelector(".home-page")
    homePage.classList.remove("hidden")
    showAuthError(_infoMessage)
}
export function showLoginPage() {
    setAuthMode("login")
}

/**
 * Into the game with an account the server just answered with ({ token, details }):
 * kept for this tab, then the world - or character creation if it has no hero yet.
 * Shows the error and returns false when it can't get in.
 */
export async function enterWithAccount(data){
    try {
        keepAccountWithTokenDet(data)

        const charData = await getCharDetFromDB(data)
        if(!charData || charData === "tokenfailed") return failEntry()

        const entered = await startScene(charData === "notfound")
        if(!entered) return failEntry()

        hideHomePage()
        return true
    } catch (err) {
        return failEntry()
    }
}
function failEntry(){
    setLoading(false)
    showAuthError("Server error, try again.")
    return false
}

export async function login() {
    const username = usernameInput.value.trim()
    const password = passwordInput.value

    if (!username || !password) {
        return showAuthError("Fill in all fields.", username ? passwordInput : usernameInput)
    }

    setLoading(true)
    clearAuthError()

    try {
        const res = await fetch(`${APIURL}/users/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        })

        const data = await res.json()

        if (data === "norecord") {
            setLoading(false)
            return showAuthError("Invalid username or password.", passwordInput)
        }
        if (!data?.token) return failEntry()

        if (await enterWithAccount(data)) rememberHowEntered("account", username)

    } catch (err) {
        failEntry()
    }
}

export async function continueSession() {
    const saved = checkIfTokenSaved()
    if (!saved) return showLoginPage()

    setLoading(true)
    clearAuthError()
    await enterWithAccount(saved)
}
