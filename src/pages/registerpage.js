import { APIURL } from "../constants/constants.js"
import { keepAccountWithTokenDet } from "../constants/api.js"
import { startScene } from "../main/main.js"
import { setLoading} from "./mainpage.js"
const homePage = document.querySelector(".home-page")
const usernameInput = document.querySelector("#usernameInp")
const passwordInput = document.querySelector("#passwordInp")
const confirmInput = document.querySelector("#confirmpass")
const enterBtn = document.querySelector("#enterWorldBtn")
const rotatingIcon = document.querySelector(".rotating")
const msg = document.querySelector("#auth-msg")


export function showRegisterPage() {
    confirmInput.classList.remove("hidden")
    setLoading(false)
    msg.textContent = ""
    usernameInput.value = ""
    passwordInput.value = ""
    confirmInput.value = ""
    usernameInput.focus()
}

export async function   register() {
    const username = usernameInput.value.trim()
    const password = passwordInput.value
    const confirmPassword = confirmInput.value

    if (!username || !password) { msg.textContent = "Fill in all fields."; return }
    if (password !== confirmPassword) { msg.textContent = "Passwords do not match."; return }

    setLoading(true)
    msg.textContent = ""

    try {
        const res = await fetch(`${APIURL}/users/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        })

        const data = await res.json()

        if (data === "Username Exist") {
            msg.textContent = "Username already taken."
            setLoading(false)
            return
        }
        console.log(data)
        keepAccountWithTokenDet(data)

        const entered = await startScene(true)
        if (!entered) {
            msg.textContent = "Server error, try again."
            setLoading(false)
            return
        }
        homePage.classList.add("hidden")

    } catch (err) {
        msg.textContent = "Server error, try again."
        setLoading(false)
    }
}
