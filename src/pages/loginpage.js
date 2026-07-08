import { APIURL } from "../constants/constants.js"
import { startScene } from "../main/main.js"
import { keepAccountWithTokenDet, getCharDetFromDB } from "../constants/api.js"
import { checkIfTokenSaved } from "../tools/tools.js"

const homePage = document.querySelector(".home-page")
const usernameInput = document.querySelector("#usernameInp")
const passwordInput = document.querySelector("#passwordInp")
const confirmInput = document.querySelector("#confirmpass")
const enterBtn = document.querySelector("#enterWorldBtn")
const msg = document.querySelector("#auth-msg")

export function showLoginPage() {
    confirmInput.classList.add("hidden")
    msg.textContent = ""
    usernameInput.value = ""
    passwordInput.value = ""
    confirmInput.value = ""
    usernameInput.focus()
}

export async function login() {
    const username = usernameInput.value.trim()
    const password = passwordInput.value

    if (!username || !password) { msg.textContent = "Fill in all fields."; return }

    enterBtn.disabled = true
    msg.textContent = ""

    try {
        const res = await fetch(`${APIURL}/users/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        })

        const data = await res.json()

        if (data === "norecord") {
            msg.textContent = "Invalid username or password."
            enterBtn.disabled = false
            return
        }
        keepAccountWithTokenDet(data)

        const charRes = await fetch(`${APIURL}/characters/${data.details._id}`, {
            headers: { authori: `Bearer ${data.token}` }
        })
        const charData = await charRes.json()

        homePage.classList.add("hidden")
        startScene(charData === "notfound")

    } catch (err) {
        msg.textContent = "Server error, try again."
        enterBtn.disabled = false
    }
}

export async function continueSession() {
    const saved = checkIfTokenSaved()
    if (!saved) return showLoginPage()

    enterBtn.disabled = true
    msg.textContent = ""

    try {
        const charData = await getCharDetFromDB(saved)

        homePage.classList.add("hidden")
        startScene(charData === "notfound")
    } catch (err) {
        msg.textContent = "Server error, try again."
        enterBtn.disabled = false
    }
}
