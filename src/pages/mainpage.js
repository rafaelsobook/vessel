import { hideShowAllScreenUI } from "../charactersystem/uimanagement.js"
import { login, continueSession } from "./loginpage.js"
import { register } from "./registerpage.js"
import { playAsGuest, getSavedGuest } from "./guestlogin.js"
import { startHomeFx, stopHomeFx, setSummoning, leaveHome, cancelLeave } from "./homefx.js"
import { startHomeMusic, stopHomeMusic, playSummonSound } from "./homemusic.js"
import { applyAuthMode, resetAuthFields, clearAuthError, usernameInput, passwordInput, confirmInput } from "./authform.js"
import { checkIfTokenSaved } from "../tools/tools.js"
import { initInstallButton } from "./installapp.js"
import { tcpHttpURL } from "../constants/constants.js"

const homePage = document.querySelector(".home-page")
const authForm = document.querySelector(".login-register-form")
const enterBtn = document.querySelector("#enterWorldBtn")
const enterCaption = document.querySelector(".enter-caption")
const enterSub = document.querySelector(".enter-sub")
const keepGuest = document.querySelector(".keep-guest")
const keepGuestName = document.querySelector(".keep-guest-name")
const guestLink = document.querySelector(".guest-link")
const tabs = [...authForm.querySelectorAll(".auth-tab")]
const siteFooter = document.querySelector(".site-footer")
const socialIcon = document.querySelector(".social-icon")
const playersCount = document.querySelector(".players-count")
const newsItems = [...document.querySelectorAll(".hp-news-item")]

// the form's three faces (authForm's data-mode): "play" is the big button alone -
// a guest, or the account this tab is still logged in as - "login" and "register"
// open the fields under it - and the button reads the same in both
const PANEL_CAPTION = "Enter World"
// under the big button for someone new - written in index.html
const FIRST_VISIT_SUB = enterSub.textContent
// how this device last got in - "account" opens the login form next time, its
// username already filled in; "guest" opens on the play button
const LAST_AUTH_KEY = "vessel_last_auth"
const LAST_USER_KEY = "vessel_last_user"
// the opening (style.scss's .home-page.intro) - index.html starts the page with
// it, so it plays from the first paint while the game's code is still loading.
// It ends when its animations do (or this long after this code runs, at most);
// a click or a key cuts it short
const INTRO_MS = 3400
const NEWS_MS = 5500

let authMode = "play"
let introShown = false
let newsIndex = 0
let newsTimer = 0

function displayOnlinePL(numbertoDisplay){
    playersCount.textContent = numbertoDisplay
}
async function updatePlayersOnlineDisplay() {
    if (!playersCount) return
    let numberToDisplay = 16 + Math.floor(Math.random()*8)
    displayOnlinePL(numberToDisplay)

    try {
        const res = await fetch(`${tcpHttpURL}`)
        const tcpPlayers = await res.json()
        numberToDisplay += tcpPlayers.length
        displayOnlinePL(numberToDisplay)
    } catch (err) {
        // tcp unreachable - the first number stays
    }
}

updatePlayersOnlineDisplay()
// setInterval(updatePlayersOnlineDisplay, 10000)

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

export function rememberHowEntered(kind, username){
    try {
        localStorage.setItem(LAST_AUTH_KEY, kind)
        if (username) localStorage.setItem(LAST_USER_KEY, username)
    } catch (err) {}
}
function lastAuth(){
    try { return localStorage.getItem(LAST_AUTH_KEY) } catch (err) { return null }
}
function lastUser(){
    try { return localStorage.getItem(LAST_USER_KEY) ?? "" } catch (err) { return "" }
}

// the news lines (index.html's .hp-news-item) take turns
function showNews(){
    newsItems.forEach((item, i) => item.classList.toggle("shown", i === newsIndex))
}
function startNews(){
    if (!newsItems.length) return
    showNews()
    clearInterval(newsTimer)
    newsTimer = setInterval(() => {
        newsIndex = (newsIndex + 1) % newsItems.length
        showNews()
    }, NEWS_MS)
}

function finishIntro(){
    const timer = setTimeout(endIntro, INTRO_MS)
    const animations = (homePage.getAnimations?.({ subtree: true }) ?? []).filter(a => a.animationName?.startsWith("hpIntro"))
    Promise.all(animations.map(a => a.finished)).then(endIntro, endIntro)
    function endIntro(){
        clearTimeout(timer)
        homePage.classList.remove("intro")
        homePage.removeEventListener("pointerdown", endIntro)
        document.removeEventListener("keydown", endIntro)
    }
    homePage.addEventListener("pointerdown", endIntro)
    document.addEventListener("keydown", endIntro)
}

export function hideHomePage(){
    clearInterval(newsTimer)
    stopHomeMusic()
    // the flash into the world, then gone
    leaveHome(() => {
        homePage.classList.add("hidden")
        siteFooter?.classList.add("hidden")
        stopHomeFx()
        setLoading(false)
    })
}

function refreshCaptions(){
    const guest = getSavedGuest()
    if (authMode === "play") {
        const session = checkIfTokenSaved()
        enterCaption.textContent = session ? "Continue" : "Play Now"
        enterSub.textContent = session ? `as ${session.details?.username ?? "your hero"}`
            : guest ? `Continue as ${guest.username}`
            : FIRST_VISIT_SUB
    } else {
        enterCaption.textContent = PANEL_CAPTION
        enterSub.textContent = ""
    }
    keepGuest.classList.toggle("hidden", !(authMode === "register" && guest))
    keepGuestName.textContent = guest?.username ?? ""
    // the panel's way in without an account
    guestLink.textContent = guest ? `Continue as ${guest.username}` : "Play as a guest"
}

export function setLoading(isLoading){
    const wasLoading = authForm.classList.contains("loading")
    authForm.classList.toggle("loading", isLoading)
    // the circle flares and the sparks spiral into it while the world loads
    setSummoning(isLoading)
    if (isLoading) {
        if (!wasLoading) playSummonSound()
        enterCaption.textContent = "Summoning"
        enterSub.textContent = ""
    } else {
        refreshCaptions()
    }
}

export function setAuthMode(mode){
    const wasPanel = authMode !== "play"
    // moving between the Log in and Create account tabs keeps what was typed as the username
    const typed = wasPanel ? usernameInput.value : ""
    authMode = mode
    authForm.dataset.mode = mode
    homePage.dataset.auth = mode
    tabs.forEach(tab => tab.setAttribute("aria-selected", String(tab.dataset.go === mode)))
    setLoading(false)
    clearAuthError()
    resetAuthFields()
    usernameInput.value = mode === "play" ? "" : typed || (mode === "login" ? lastUser() : "")
    applyAuthMode(mode)
    if (mode !== "play") (usernameInput.value ? passwordInput : usernameInput).focus()
    // back from the panel: the big button takes the keyboard's place
    else if (wasPanel) enterBtn.focus({ preventScroll: true })
}

function submit() {
    if (authForm.classList.contains("loading")) return
    clearAuthError()
    if (authMode === "login") return login()
    if (authMode === "register") return register()
    checkIfTokenSaved() ? continueSession() : playAsGuest()
}

// the form is a real <form>: the button submits it, and so does Enter in a field
authForm.addEventListener("submit", e => {
    e.preventDefault()
    submit()
})
// the tabs, the × and the links: [data-go] is the mode they go to, or "guest" to play at once
authForm.querySelectorAll("[data-go]").forEach(control => {
    control.addEventListener("click", () => {
        const go = control.dataset.go
        if (authForm.classList.contains("loading") || go === authMode) return
        if (go === "guest") return playAsGuest()
        setAuthMode(go)
    })
})
// Enter in the username goes on to the password; in the password, on to the confirmation when
// registering - anywhere else it submits
usernameInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !passwordInput.value) {
        e.preventDefault()
        passwordInput.focus()
    }
})
passwordInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && authMode === "register") {
        e.preventDefault()
        confirmInput.focus()
    }
})
document.addEventListener("keydown", e => {
    if (homePage.classList.contains("hidden")) return
    // Esc closes the panel
    if (e.key === "Escape" && authMode !== "play" && !authForm.classList.contains("loading")) return setAuthMode("play")
    // Enter on the bare page presses the big button
    if (e.key !== "Enter" || authMode !== "play") return
    if (e.target.closest?.("input, button, a")) return
    submit()
})

export function showMainPage() {
    hideShowAllScreenUI(false)
    cancelLeave()

    homePage.classList.remove("hidden")
    siteFooter?.classList.remove("hidden")

    if (!introShown) finishIntro()
    introShown = true
    startHomeFx()
    startHomeMusic()
    startNews()
    initInstallButton()

    // a tab still logged in continues; a device that last used an account opens the login form
    setAuthMode(!checkIfTokenSaved() && lastAuth() === "account" ? "login" : "play")
}
