// THE HOME PAGE'S MOTION (index.html's .home-page, styled in style.scss):
//  - sparks drifting up out of the mist on the .hp-sparks canvas, shying away
//    from the cursor, and a burst of them wherever the page is clicked
//  - parallax: every .hp-parallax layer shifts against the mouse by its --depth
//    (this sets --px/--py, -1..1). With no mouse the view drifts on its own.
//    The illustration itself never moves - its artist credit sits in its corners
//  - the summoning while a login is in flight: the sparks spiral into the circle
//    (the circle's own flare is CSS, .home-page.summoning)
//  - the flash into the world when the home page goes (.home-page.leaving)
// Runs only while the home page shows - mainpage.js's showMainPage / hideHomePage.

const homePage = document.querySelector(".home-page")
const canvas = document.querySelector(".hp-sparks")
const ctx = canvas.getContext("2d")
const altar = document.querySelector(".hp-altar")

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")

// violet, pink, gold, white - the circle's and the logo's colours
const COLORS = ["201,160,255", "255,122,217", "240,204,128", "255,255,255"]
const SPRITE = 64
const REPEL_RADIUS = 120
const BURST_SPARKS = 26
// the leaving flash's length - style.scss's hpFlash/hpLeave
const LEAVE_MS = 1150
// no mouse for this long and the view starts drifting on its own
const IDLE_MS = 4000

// one soft glowing dot per colour, drawn once - every spark is a copy of one
const sprites = COLORS.map(rgb => {
    const sprite = document.createElement("canvas")
    sprite.width = sprite.height = SPRITE
    const g = sprite.getContext("2d")
    const half = SPRITE / 2
    const grad = g.createRadialGradient(half, half, 0, half, half, half)
    grad.addColorStop(0, "rgba(255,255,255,1)")
    grad.addColorStop(0.16, `rgba(${rgb},0.95)`)
    grad.addColorStop(0.42, `rgba(${rgb},0.25)`)
    grad.addColorStop(1, `rgba(${rgb},0)`)
    g.fillStyle = grad
    g.fillRect(0, 0, SPRITE, SPRITE)
    return sprite
})

let running = false
let frameId = 0
let lastTime = 0
let width = 0
let height = 0
let dpr = 1
let summoning = false
let leaveTimer = 0
const sparks = []
const pointer = { x: -9999, y: -9999, nx: 0, ny: 0, movedAt: -Infinity }
const view = { x: 0, y: 0 }

function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    width = homePage.clientWidth
    height = homePage.clientHeight
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
}

function sparkCount(){
    return Math.round(Math.min(110, Math.max(36, width * height / 15000)))
}

function pickColor(){
    const r = Math.random()
    return r < 0.45 ? 0 : r < 0.75 ? 1 : r < 0.88 ? 2 : 3
}

// a drifting spark - from the mist at the bottom, or anywhere when filling the screen
function respawn(spark, anywhere){
    spark.x = Math.random() * width
    spark.y = anywhere ? Math.random() * height : height * (0.6 + Math.random() * 0.45)
    spark.rise = 10 + Math.random() * 34
    spark.vx = (Math.random() - 0.5) * 8
    spark.vy = -spark.rise
    spark.size = 1.2 + Math.random() ** 2 * 5
    spark.color = pickColor()
    spark.age = anywhere ? Math.random() * 3 : 0
    spark.life = 5 + Math.random() * 7
    spark.phase = Math.random() * Math.PI * 2
    spark.sway = 6 + Math.random() * 16
    spark.depth = 0.4 + Math.random() * 1.2
    spark.burst = false
    return spark
}

/** A burst of sparks at x,y (page pixels) - where the page was clicked */
export function sparkBurst(x, y, count = BURST_SPARKS){
    if(!running || reducedMotion.matches) return
    for(let i = 0; i < count; i++){
        const angle = Math.random() * Math.PI * 2
        const speed = 60 + Math.random() * 220
        sparks.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 40,
            size: 1 + Math.random() * 3,
            color: pickColor(),
            age: 0,
            life: 0.5 + Math.random() * 0.7,
            phase: 0, sway: 0, depth: 0,
            burst: true,
        })
    }
}

function altarCentre(){
    const rect = altar.getBoundingClientRect()
    const page = homePage.getBoundingClientRect()
    return { x: rect.left - page.left + rect.width / 2, y: rect.top - page.top + rect.height / 2, r: rect.width / 2 }
}

function step(dt, now){
    // the view follows the mouse, or drifts slowly when there's none
    const idle = now - pointer.movedAt > IDLE_MS
    const aimX = idle ? Math.sin(now * 0.00013) * 0.35 : pointer.nx
    const aimY = idle ? Math.sin(now * 0.00009) * 0.25 : pointer.ny
    const ease = Math.min(1, dt * (idle ? 0.8 : 3))
    view.x += (aimX - view.x) * ease
    view.y += (aimY - view.y) * ease
    homePage.style.setProperty("--px", view.x.toFixed(4))
    homePage.style.setProperty("--py", view.y.toFixed(4))

    const centre = summoning ? altarCentre() : null
    for(let i = sparks.length - 1; i >= 0; i--){
        const s = sparks[i]
        s.age += dt
        if(s.burst){
            const drag = Math.max(0, 1 - 2.4 * dt)
            s.vx *= drag
            s.vy = s.vy * drag - 14 * dt
        } else if(centre){
            // spiral into the circle - pulled in, swung round
            const dx = centre.x - s.x, dy = centre.y - s.y
            const dist = Math.hypot(dx, dy) || 1
            s.vx += (dx / dist * 260 - dy / dist * 320) * dt
            s.vy += (dy / dist * 260 + dx / dist * 320) * dt
            const drag = Math.max(0, 1 - 1.6 * dt)
            s.vx *= drag
            s.vy *= drag
            if(dist < centre.r * 0.12) respawn(s, false)
        } else {
            // shy of the cursor, then back to rising
            const dx = s.x - pointer.x, dy = s.y - pointer.y
            const dist = Math.hypot(dx, dy)
            if(dist < REPEL_RADIUS && dist > 0){
                const push = (1 - dist / REPEL_RADIUS) * 900 * dt
                s.vx += dx / dist * push
                s.vy += dy / dist * push
            }
            s.vx += (0 - s.vx) * Math.min(1, dt * 1.2)
            s.vy += (-s.rise - s.vy) * Math.min(1, dt * 1.2)
        }
        s.x += s.vx * dt
        s.y += s.vy * dt

        if(s.age > s.life || s.y < -40 || s.x < -60 || s.x > width + 60){
            if(s.burst) sparks.splice(i, 1)
            else respawn(s, false)
        }
    }
    // more of them while summoning
    const wanted = summoning ? Math.round(sparkCount() * 1.6) : sparkCount()
    let drifting = sparks.reduce((n, s) => n + (s.burst ? 0 : 1), 0)
    while(drifting < wanted){
        sparks.push(respawn({}, false))
        drifting++
    }
}

function draw(){
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.globalCompositeOperation = "lighter"
    const shiftX = -view.x * 22, shiftY = -view.y * 22
    for(const s of sparks){
        const fadeIn = Math.min(1, s.age / (s.burst ? 0.05 : 1))
        const fadeOut = Math.min(1, (s.life - s.age) / (s.burst ? 0.4 : 1.6))
        const twinkle = s.burst ? 1 : 0.55 + 0.45 * Math.sin(s.age * 3 + s.phase)
        const alpha = Math.max(0, fadeIn * fadeOut * twinkle)
        if(alpha <= 0.01) continue
        const sway = s.burst ? 0 : Math.sin(s.age * 1.1 + s.phase) * s.sway
        const x = s.x + sway + shiftX * s.depth
        const y = s.y + shiftY * s.depth
        const size = s.size * 7
        ctx.globalAlpha = alpha
        ctx.drawImage(sprites[s.color], x - size / 2, y - size / 2, size, size)
    }
    ctx.globalAlpha = 1
}

function frame(now){
    if(!running) return
    frameId = requestAnimationFrame(frame)
    const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000))
    lastTime = now
    step(dt, now)
    draw()
}

export function startHomeFx(){
    if(running) return
    running = true
    resize()
    if(reducedMotion.matches) return
    sparks.length = 0
    for(let i = sparkCount(); i > 0; i--) sparks.push(respawn({}, true))
    lastTime = performance.now()
    frameId = requestAnimationFrame(frame)
}

export function stopHomeFx(){
    running = false
    cancelAnimationFrame(frameId)
    sparks.length = 0
    ctx.clearRect(0, 0, canvas.width, canvas.height)
}

export function setSummoning(isSummoning){
    summoning = isSummoning
    homePage.classList.toggle("summoning", isSummoning)
}

/** The flash into the world, then onGone - the home page hides itself there */
export function leaveHome(onGone){
    clearTimeout(leaveTimer)
    homePage.classList.add("leaving")
    leaveTimer = setTimeout(() => {
        homePage.classList.remove("leaving")
        onGone()
    }, LEAVE_MS)
}
export function cancelLeave(){
    clearTimeout(leaveTimer)
    homePage.classList.remove("leaving")
}

window.addEventListener("resize", () => running && resize())
homePage.addEventListener("pointermove", e => {
    const page = homePage.getBoundingClientRect()
    pointer.x = e.clientX - page.left
    pointer.y = e.clientY - page.top
    if(e.pointerType !== "mouse") return
    pointer.nx = (pointer.x / page.width) * 2 - 1
    pointer.ny = (pointer.y / page.height) * 2 - 1
    pointer.movedAt = performance.now()
})
homePage.addEventListener("pointerleave", () => {
    pointer.x = pointer.y = -9999
})
homePage.addEventListener("pointerdown", e => {
    if(e.target.closest("button, input, a, label")) return
    const page = homePage.getBoundingClientRect()
    sparkBurst(e.clientX - page.left, e.clientY - page.top)
})
