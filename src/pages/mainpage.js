import { hideShowAllScreenUI } from "../charactersystem/uimanagement.js"
import { showLoadingScreen } from "../htmlcomp/loadingscreen.js"
import { showLoginPage, login, continueSession } from "./loginpage.js"
import { showRegisterPage, register } from "./registerpage.js"
import { checkIfTokenSaved } from "../tools/tools.js"

const homePage = document.querySelector(".home-page")
const authFields = document.querySelector(".auth-fields")
const toggleBtn = document.querySelector("#toggleAuthMode")
const enterBtn = document.querySelector("#enterWorldBtn")
const passwordInput = document.querySelector("#passwordInp")
const confirmInput = document.querySelector("#confirmpass")

let isRegisterMode = false
let hasSavedSession = false

function submit() {
    if (hasSavedSession) return continueSession()
    isRegisterMode ? register() : login()
}

toggleBtn.addEventListener("click", () => {
    isRegisterMode = !isRegisterMode
    if (isRegisterMode) {
        showRegisterPage()
        toggleBtn.textContent = "Already have an account? Login"
    } else {
        showLoginPage()
        toggleBtn.textContent = "Need an account? Register"
    }
})

enterBtn.addEventListener("click", submit)
passwordInput.addEventListener("keydown", e => e.key === "Enter" && !isRegisterMode && submit())
confirmInput.addEventListener("keydown", e => e.key === "Enter" && isRegisterMode && submit())

export function showMainPage() {
    // showLoadingScreen(["Welcome to Vessel", "Loading"])
    hideShowAllScreenUI(false)
    homePage.classList.remove("hidden")

    hasSavedSession = !!checkIfTokenSaved()
    authFields.classList.toggle("hidden", hasSavedSession)
    if (hasSavedSession) return

    isRegisterMode = false
    showLoginPage()
    toggleBtn.textContent = "Need an account? Register"
}
