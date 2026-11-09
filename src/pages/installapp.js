// INSTALL THE GAME - the home page's Install button (index.html .hp-install,
// top right) and, where the page can't install it by itself, the sheet that
// says how (.hp-install-sheet). The PWA itself is vite.config.js / main/pwa.js.
//
// Who sees what:
//   - Chrome, Edge, Android: the browser offers the install (beforeinstallprompt)
//     - the button shows, and pressing it opens the browser's own dialog. If
//     that was turned down and the browser won't offer again, the button
//     opens the sheet's "menu" steps instead.
//   - iPhone / iPad: no page can open an install dialog there, so the button
//     always shows and opens the sheet's Share -> Add to Home Screen steps.
//   - Already installed (opened from the home screen), or a browser that
//     can't install at all: no button.
//
// It's meant to pull the eye the whole time the home page is up: it breathes,
// a light runs over it, a ring pings off it, and the line under "Install"
// changes every few seconds (style.scss's INSTALL block).

const button = document.querySelector(".hp-install")
const sheet = document.querySelector(".hp-install-sheet")
const lines = button ? [...button.querySelectorAll(".hpi-line")] : []
const LINE_MS = 3200
const DONE_MS = 2400   // the "installed" flourish - hpiDone in style.scss

let deferredPrompt = null
let lineIndex = 0
let lineTimer = null

const isStandalone = () =>
    matchMedia("(display-mode: standalone)").matches ||
    matchMedia("(display-mode: fullscreen)").matches ||
    navigator.standalone === true
// iPadOS reports itself as a Mac; a Mac has no touch screen
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)

// at import - the browser can offer the install before the home page is shown
window.addEventListener("beforeinstallprompt", e => {
    // our button instead of the browser's own banner
    e.preventDefault()
    deferredPrompt = e
    showButton()
})
window.addEventListener("appinstalled", () => {
    deferredPrompt = null
    celebrate()
})

function showButton(){
    if (!button || isStandalone()) return
    button.classList.remove("hidden", "done")
    startLines()
}

function startLines(){
    if (lineTimer || lines.length < 2) return
    lineTimer = setInterval(() => {
        lineIndex = (lineIndex + 1) % lines.length
        lines.forEach((line, i) => line.classList.toggle("shown", i === lineIndex))
    }, LINE_MS)
}

// installed: a last flourish, then it goes
function celebrate(){
    if (!button || button.classList.contains("hidden")) return
    closeSheet()
    button.querySelector(".hpi-title").textContent = "Installed"
    lines.forEach((line, i) => line.classList.toggle("shown", i === 0))
    if (lines[0]) lines[0].textContent = "See you on your home screen"
    clearInterval(lineTimer)
    lineTimer = null
    button.classList.add("done")
    setTimeout(() => button.classList.add("hidden"), DONE_MS)
}

function openSheet(kind){
    if (!sheet) return
    sheet.dataset.kind = kind
    sheet.hidden = false
    sheet.querySelector(".hpi-close")?.focus({ preventScroll: true })
}
function closeSheet(){
    if (!sheet || sheet.hidden) return
    sheet.hidden = true
    button?.focus({ preventScroll: true })
}

button?.addEventListener("click", async () => {
    if (isIOS) return openSheet("ios")
    if (!deferredPrompt) return openSheet("menu")
    const prompt = deferredPrompt
    // a prompt can only be shown once
    deferredPrompt = null
    try {
        await prompt.prompt()
        const { outcome } = await prompt.userChoice
        if (outcome === "accepted") celebrate()
    } catch {
        openSheet("menu")
    }
})
sheet?.addEventListener("click", e => {
    // the dark around the card, the ×, or "I'll do it now"
    if (e.target === sheet || e.target.closest(".hpi-close, .hpi-ok")) closeSheet()
})
// Esc closes the sheet - and only the sheet: capturing on window runs before
// mainpage.js's own Esc (which would also close the sign-in panel)
window.addEventListener("keydown", e => {
    if (e.key !== "Escape" || !sheet || sheet.hidden) return
    e.stopPropagation()
    closeSheet()
}, true)

// mainpage.js's showMainPage - an iPhone gets the button straight away; a
// browser that can install shows it when it says so (beforeinstallprompt)
// On the dev server it always shows: the PWA only exists in a build
// (vite.config.js), so the browser never offers an install there and the
// button could never be seen while working on it. A click there opens the
// sheet's "menu" steps (the "ios" ones on an iPhone, or DevTools' iPhone view).
export function initInstallButton(){
    if (isIOS || deferredPrompt || import.meta.env.DEV) showButton()
}
