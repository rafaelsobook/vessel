import { showLoginPage } from "./loginpage.js"
import { showRegisterPage } from "./registerpage.js"
import { getCharDetFromDB } from "../constants/api.js"
import { startScene } from "../main/main.js"

export function showMainPage(accountDet) {
    const overlay = document.createElement("div")
    overlay.id = "main-overlay"
    overlay.className = "page-overlay"

    if (accountDet) {
        overlay.innerHTML = `
            <h1>GRIMWRAITH</h1>
            <p id="main-msg" class="page-msg"></p>
            <button id="main-continue-btn" class="page-btn">Continue</button>
        `
        document.body.appendChild(overlay)

        overlay.querySelector("#main-continue-btn").addEventListener("click", async () => {
            if (!navigator.onLine) {
                const msg = overlay.querySelector("#main-msg")
                msg.textContent = "No internet connection."
                return
            }
            const charData = await getCharDetFromDB(accountDet)
            overlay.remove()
            startScene(charData === "notfound")
        })
    } else {
        overlay.innerHTML = `
            <h1>GRIMWRAITH</h1>
            <button id="main-login-btn" class="page-btn">Login</button>
            <button id="main-register-btn" class="page-btn">Register</button>
        `
        document.body.appendChild(overlay)

        overlay.querySelector("#main-login-btn").addEventListener("click", () => {
            overlay.remove()
            showLoginPage()
        })
        overlay.querySelector("#main-register-btn").addEventListener("click", () => {
            overlay.remove()
            showRegisterPage()
        })
    }
}
