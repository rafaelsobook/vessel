import { APIURL } from "../constants/constants.js"
import { useFetch } from "../tools/tools.js"
import { setLoading, setAuthMode, rememberHowEntered } from "./mainpage.js"
import { enterWithAccount } from "./loginpage.js"
import { getSavedGuest, forgetGuest, logInGuest } from "./guestlogin.js"
import { usernameInput, passwordInput, confirmInput, showAuthError, clearAuthError, USERNAME_MIN, PASSWORD_MIN } from "./authform.js"
const keepGuestBox = document.querySelector("#keepGuestHero")


export function showRegisterPage() {
    setAuthMode("register")
}

export async function   register() {
    const username = usernameInput.value.trim()
    const password = passwordInput.value
    const confirmPassword = confirmInput.value

    if (!username || !password) return showAuthError("Fill in all fields.", username ? passwordInput : usernameInput)
    if (username.length < USERNAME_MIN) return showAuthError(`Username needs at least ${USERNAME_MIN} characters.`, usernameInput)
    if (password.length < PASSWORD_MIN) return showAuthError(`Password needs at least ${PASSWORD_MIN} characters.`, passwordInput)
    if (password !== confirmPassword) return showAuthError("Passwords do not match.", confirmInput)

    setLoading(true)
    clearAuthError()

    // on a device that has played as a guest the box starts ticked: the guest's
    // own account takes this username and password, so its hero comes along
    const guest = getSavedGuest()
    const claiming = !!guest && keepGuestBox.checked

    try {
        const data = claiming
            ? await claimGuest(guest, username, password)
            : await useFetch(`${APIURL}/users/register`, "POST", null, { username, password })

        if (data === "Username Exist") return refuse("Username already taken.", usernameInput)
        if (!data?.token) return refuse("Server error, try again.")
        if (claiming) forgetGuest()

        if (await enterWithAccount(data)) rememberHowEntered("account", username)

    } catch (err) {
        refuse("Server error, try again.")
    }
}

async function claimGuest(guest, username, password){
    const session = await logInGuest(guest)
    // the guest's account is gone - an ordinary new account then
    if (session === "norecord") {
        forgetGuest()
        return useFetch(`${APIURL}/users/register`, "POST", null, { username, password })
    }
    if (!session?.token) return session
    return useFetch(`${APIURL}/users/claim`, "POST", session.token, { username, password })
}

function refuse(text, field){
    setLoading(false)
    showAuthError(text, field)
}
