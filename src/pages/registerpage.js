import { APIURL } from "../constants/constants.js"
import { keepAccountWithTokenDet } from "../constants/api.js"
import { startScene } from "../main/main.js"

const homePage = document.querySelector(".home-page")
const usernameInput = document.querySelector("#usernameInp")
const passwordInput = document.querySelector("#passwordInp")
const confirmInput = document.querySelector("#confirmpass")
const enterBtn = document.querySelector("#enterWorldBtn")
const msg = document.querySelector("#auth-msg")

export function showRegisterPage() {
    confirmInput.classList.remove("hidden")
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

    enterBtn.disabled = true
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
            enterBtn.disabled = false
            return
        }
        console.log(data)
        keepAccountWithTokenDet(data)

        homePage.classList.add("hidden")
        startScene(true)

    } catch (err) {
        msg.textContent = "Server error, try again."
        enterBtn.disabled = false
    }
}
