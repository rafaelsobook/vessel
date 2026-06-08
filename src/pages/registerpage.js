import { showMainPage } from "./mainpage.js"
import { showCreateCharacterPage } from "./createcharacterpage.js"
import { APIURL } from "../constants/constants.js"
import { keepAccountWithTokenDet } from "../constants/api.js"
import { startScene } from "../main/main.js"

export function showRegisterPage() {
    const overlay = document.createElement("div")
    overlay.id = "register-overlay"
    overlay.className = "page-overlay"

    overlay.innerHTML = `
        <h2 class="page-title">Register</h2>
        <p id="reg-msg" class="page-msg"></p>
        <input id="reg-username" type="text" placeholder="Username" class="page-input" />
        <input id="reg-password" type="password" placeholder="Password" class="page-input" />
        <button id="reg-btn" class="page-btn">Register</button>
        <button id="reg-back" class="page-btn-back">Back</button>
    `

    document.body.appendChild(overlay)

    const usernameInput = overlay.querySelector("#reg-username")
    const passwordInput = overlay.querySelector("#reg-password")
    const btn = overlay.querySelector("#reg-btn")
    const msg = overlay.querySelector("#reg-msg")

    usernameInput.focus()

    btn.addEventListener("click", () => register(usernameInput, passwordInput, btn, msg, overlay))
    passwordInput.addEventListener("keydown", e => e.key === "Enter" && register(usernameInput, passwordInput, btn, msg, overlay))

    overlay.querySelector("#reg-back").addEventListener("click", () => {
        overlay.remove()
        showMainPage()
    })
}

async function register(usernameInput, passwordInput, btn, msg, overlay) {
    const username = usernameInput.value.trim()
    const password = passwordInput.value

    if (!username || !password) { msg.textContent = "Fill in all fields."; return }

    btn.disabled = true
    btn.textContent = "Registering..."
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
            btn.disabled = false
            btn.textContent = "Register"
            return
        }
        keepAccountWithTokenDet(data)

        overlay.remove()
        // showCreateCharacterPage()
        startScene(true)

    } catch (err) {
        msg.textContent = "Server error, try again."
        btn.disabled = false
        btn.textContent = "Register"
    }
}
