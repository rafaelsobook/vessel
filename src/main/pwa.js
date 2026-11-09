// THE PWA's service worker (vite.config.js's VitePWA) - registered here, and
// the one thing it asks of the player: when a new version has been deployed,
// it is downloaded in the background and then waits. A small notice offers
// "Reload"; until the player takes it, the game keeps running the version it
// started with, so nobody is reloaded out of a fight. Dismissed ("Later"),
// it stays away - and the app, closed and opened again, starts on the new
// version anyway (a waiting service worker takes over once no page uses the
// old one).
//
// Only in a build: the dev server has no service worker (vite.config.js).

const UPDATE_CHECK_MS = 30 * 60 * 1000   // a phone left open for hours still hears about deploys

export async function startPwa(){
    if(!import.meta.env.PROD || !("serviceWorker" in navigator)) return
    const { registerSW } = await import("virtual:pwa-register")
    const updateSW = registerSW({
        onNeedRefresh(){ showUpdateNotice(() => updateSW(true)) },
        onRegisteredSW(swUrl, registration){
            if(registration) setInterval(() => registration.update().catch(() => {}), UPDATE_CHECK_MS)
        },
        onRegisterError(error){ console.warn("service worker not registered", error) },
    })
}

// styled inline - it has to show on any screen, the home page or mid-game,
// without depending on style.scss being compiled
function showUpdateNotice(reload){
    if(document.querySelector(".pwa-update")) return
    const box = document.createElement("div")
    box.className = "pwa-update"
    Object.assign(box.style, {
        position: "fixed", left: "16px", bottom: "16px", zIndex: "100000",
        display: "flex", alignItems: "center", gap: "12px",
        padding: "10px 14px", borderRadius: "10px",
        background: "rgba(20, 16, 28, 0.94)", border: "1px solid rgba(214, 170, 96, 0.55)",
        color: "#f1e6cf", font: "15px Georgia, serif", boxShadow: "0 4px 18px rgba(0,0,0,0.5)",
    })
    const text = document.createElement("span")
    text.textContent = "A new version of Vessel is ready"
    const button = (label, primary) => {
        const b = document.createElement("button")
        b.textContent = label
        Object.assign(b.style, {
            padding: "6px 12px", borderRadius: "6px", cursor: "pointer", font: "inherit",
            border: "1px solid rgba(214, 170, 96, 0.7)",
            background: primary ? "#b8893f" : "transparent", color: primary ? "#14101c" : "#f1e6cf",
        })
        return b
    }
    const reloadBtn = button("Reload", true)
    const laterBtn = button("Later", false)
    reloadBtn.addEventListener("click", () => { reloadBtn.disabled = true; reload() })
    laterBtn.addEventListener("click", () => box.remove())
    box.append(text, reloadBtn, laterBtn)
    document.body.appendChild(box)
}
