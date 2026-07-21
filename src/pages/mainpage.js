import { hideShowAllScreenUI } from "../charactersystem/uimanagement.js"
import { showLoadingScreen } from "../htmlcomp/loadingscreen.js"
import { showLoginPage, login, continueSession } from "./loginpage.js"
import { showRegisterPage, register } from "./registerpage.js"
import { checkIfTokenSaved } from "../tools/tools.js"
import { tcpHttpURL } from "../constants/constants.js"

const homePage = document.querySelector(".home-page")
const authFields = document.querySelector(".auth-fields")
const toggleBtn = document.querySelector("#toggleAuthMode")
const enterBtn = document.querySelector("#enterWorldBtn")
const passwordInput = document.querySelector("#passwordInp")
const confirmInput = document.querySelector("#confirmpass")
const siteFooter = document.querySelector(".site-footer")
const socialIcon = document.querySelector(".social-icon")
const playersCountSmall = document.querySelector(".players-count-small")
const playersCountBig = document.querySelector(".players-count-big")

let isRegisterMode = false
let hasSavedSession = false

function displayOnlinePL(numbertoDisplay){
    playersCountSmall.textContent = numbertoDisplay
    playersCountBig.textContent = numbertoDisplay
}
async function updatePlayersOnlineDisplay() {
    if (!playersCountSmall || !playersCountBig) return
    let numberToDisplay = 16 + Math.floor(Math.random()*8)
    console.log(numberToDisplay)
    displayOnlinePL(numberToDisplay)
    console.log(tcpHttpURL)

    const res = await fetch(`${tcpHttpURL}`)
    console.log(res)
    const tcpPlayers = await res.json()
    console.log(tcpPlayers)
    // const count = tcpPlayers.length.toLocaleString()
    numberToDisplay += tcpPlayers.length
    console.log(numberToDisplay)

    displayOnlinePL(numberToDisplay)

}

updatePlayersOnlineDisplay()
setInterval(updatePlayersOnlineDisplay, 10000)

if (siteFooter && socialIcon) {
    const footerObserver = new IntersectionObserver(
        ([entry]) => {
            if (entry.isIntersecting) {
                const rect = socialIcon.getBoundingClientRect()
                const marginX = rect.width / 2 + 10
                const marginY = rect.height / 2 + 10
                const cx = Math.min(Math.max(rect.left + rect.width / 2, marginX), window.innerWidth - marginX)
                const cy = Math.min(Math.max(rect.top + rect.height / 2, marginY), window.innerHeight - marginY)
                socialIcon.style.setProperty("--fly-x", `${cx}px`)
                socialIcon.style.setProperty("--fly-y", `${cy}px`)
                socialIcon.classList.add("flying")
            } else {
                socialIcon.classList.remove("flying")
            }
        },
        { threshold: 0.6 }
    )
    footerObserver.observe(siteFooter)
}

export function hideHomePage(){
    homePage.classList.add("hidden")
    siteFooter?.classList.add("hidden")
}

export function setLoading(isLoading){
    // enterBtn.disabled = isLoading
    // rotatingIcon.classList.toggle("hidden", !isLoading)
    const rotatingIcon = document.querySelector(".rotating")
    const caption = document.querySelector(".enter-caption")
    
    if(isLoading) {
        enterBtn.style.pointerEvents = "none"
        rotatingIcon.style.display = "block"
        caption.style.display = "none"
        authFields.style.display = "none"
    }else {
        authFields.style.display = "contents"
        enterBtn.style.pointerEvents = "visible"
        rotatingIcon.style.display = "none"
        caption.style.display = "block"
    }
}
function submit() {
    setLoading(true)
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
    siteFooter?.classList.remove("hidden")

    hasSavedSession = !!checkIfTokenSaved()
    authFields.classList.toggle("hidden", hasSavedSession)
    if (hasSavedSession) return

    isRegisterMode = false
    showLoginPage()
    toggleBtn.textContent = "Need an account? Register"
}
