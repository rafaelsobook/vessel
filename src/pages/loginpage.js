import { APIURL } from "../constants/constants.js"
import { showMainPage } from "./mainpage.js"
import { showCreateCharacterPage } from "./createcharacterpage.js"
import { startScene } from "../main/main.js"
import { keepAccountWithTokenDet } from "../constants/api.js"


export function showLoginPage() {
    const overlay = document.createElement("div")
    overlay.id = "login-overlay"
    overlay.className = "page-overlay"

    overlay.innerHTML = `
        <h2 class="page-title">Login</h2>
        <p id="login-msg" class="page-msg"></p>
        <input id="login-username" type="text" placeholder="Username" class="page-input" />
        <input id="login-password" type="password" placeholder="Password" class="page-input" />
        <button id="login-btn" class="page-btn">Login</button>
        <button id="login-back" class="page-btn-back">Back</button>
    `

    document.body.appendChild(overlay)

    const usernameInput = overlay.querySelector("#login-username")
    const passwordInput = overlay.querySelector("#login-password")
    const btn = overlay.querySelector("#login-btn")
    const msg = overlay.querySelector("#login-msg")

    usernameInput.focus()

    btn.addEventListener("click", () => login(usernameInput, passwordInput, btn, msg, overlay))
    passwordInput.addEventListener("keydown", e => e.key === "Enter" && login(usernameInput, passwordInput, btn, msg, overlay))

    overlay.querySelector("#login-back").addEventListener("click", () => {
        overlay.remove()
        showMainPage()
    })
}

async function login(usernameInput, passwordInput, btn, msg, overlay) {
    const username = usernameInput.value.trim()
    const password = passwordInput.value

    if (!username || !password) { msg.textContent = "Fill in all fields."; return }

    btn.disabled = true
    btn.textContent = "Logging in..."
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
            btn.disabled = false
            btn.textContent = "Login"
            return
        }
        keepAccountWithTokenDet(data)

        const charRes = await fetch(`${APIURL}/characters/${data.details._id}`, {
            headers: { authori: `Bearer ${data.token}` }
        })
        const charData = await charRes.json()

        overlay.remove()


        startScene(charData === "notfound")
        

    } catch (err) {
        msg.textContent = "Server error, try again."
        btn.disabled = false
        btn.textContent = "Login"
    }
}
