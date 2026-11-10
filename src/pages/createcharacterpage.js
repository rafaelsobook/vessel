import { APIURL } from "../constants/constants.js"
import { startScene } from "../main/main.js"
import { checkIfTokenSaved } from "../tools/tools.js"

// THE RIDER'S FORGE - the character creation screen's UI, over the moonlit
// forest and its campfire (scenes/setupbackdrop.js, setupcharacterscene.js).
// Dressed to match the scene: smoked glass in the mist's midnight blue,
// edged with firelight, Cinzel for anything engraved.
//
//   top left     who you are making: the name you type, shown as you type it
//                (the character is yours before you've pressed anything),
//                and a line naming the look ("Raven hair · Wine tunic...")
//   right        the forge: Male / Female, a die that rolls a whole look, the
//                Hair / Tunic / Trousers / Skin tabs, a style stepper and the
//                dyes - each one named, a custom one at the end
//   bottom right the name (a die there too, for a name from the old tongue)
//                and BEGIN THE JOURNEY, which only glows once there's a name
//
// The scene is driven through the same callbacks as before (style, category,
// skin, gender) plus onColorSelect(category, {r, g, b}) - the dyes replace
// the Babylon GUI colour wheel the scene used to draw.

const CATEGORIES = [
    { key: "hair",  label: "Hair",     icon: "./images/setup/hair_icon.webp",      both: true },
    { key: "cloth", label: "Tunic",    icon: "./images/setup/cloth_icon.webp" },
    { key: "pants", label: "Trousers", icon: "./images/setup/pants_icon.webp" },
    { key: "skin",  label: "Skin",     icon: "./images/setup/skincolor_icon.webp" },
]
// named dyes per category, first one the default. r/g/b are the material's
// own diffuse colour (0-1), as the colour wheel used to send
const c = (name, r, g, b) => ({ name, r, g, b })
const DYES = {
    hair: [
        c("Raven", 0.03, 0.03, 0.035), c("Chestnut", 0.3, 0.15, 0.06), c("Auburn", 0.46, 0.13, 0.05),
        c("Honey", 0.72, 0.5, 0.22), c("Ash", 0.52, 0.52, 0.54), c("Frost", 0.86, 0.89, 0.93),
        c("Ember", 0.82, 0.22, 0.05), c("Moss", 0.2, 0.33, 0.13), c("Twilight", 0.32, 0.2, 0.56),
        c("Abyss", 0.08, 0.17, 0.42), c("Blood", 0.46, 0.03, 0.06),
    ],
    cloth: [
        c("Tanned", 0.42, 0.3, 0.16), c("Bark", 0.22, 0.13, 0.05), c("Bone", 0.78, 0.72, 0.58),
        c("Ashen", 0.36, 0.36, 0.38), c("Midnight", 0.1, 0.14, 0.28), c("Forest", 0.12, 0.26, 0.13),
        c("Wine", 0.42, 0.06, 0.1), c("Crimson", 0.7, 0.09, 0.06), c("Saffron", 0.82, 0.56, 0.13),
        c("Royal", 0.22, 0.13, 0.46), c("Tide", 0.08, 0.33, 0.35),
    ],
    pants: [
        c("Bark", 0.22, 0.13, 0.05), c("Tanned", 0.42, 0.3, 0.16), c("Raven", 0.04, 0.04, 0.05),
        c("Ashen", 0.36, 0.36, 0.38), c("Midnight", 0.1, 0.14, 0.28), c("Forest", 0.12, 0.26, 0.13),
        c("Wine", 0.42, 0.06, 0.1), c("Bone", 0.78, 0.72, 0.58), c("Saffron", 0.82, 0.56, 0.13),
        c("Royal", 0.22, 0.13, 0.46), c("Tide", 0.08, 0.33, 0.35),
    ],
}
// the four skin textures (constants/skinColors.js), named as they look
const SKIN_NAMES = ["Fair", "Sunlit", "Ivory", "Umber"]
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"]
const NAME_MAX = 24

// a name from the old tongue - three pieces, never twice the same in a row
const NAME_PARTS = {
    start: ["Ka", "Vor", "Ael", "Thal", "Mor", "Ri", "Sy", "Bran", "Ea", "Dra", "Ny", "Il", "Kae", "Ser", "Zeph", "Ash", "Wy", "Ro", "Fen", "Isa", "Tor", "Lu", "Gar", "Ora"],
    middle: ["ra", "the", "lo", "ven", "ri", "sa", "dor", "mi", "an", "el", "gri", "va", "", "", ""],
    end: ["th", "n", "ric", "wyn", "ys", "mir", "ra", "dris", "on", "el", "ia", "eth", "or", "a", "is", "ar", "ion", "wen"],
}
const pick = list => list[Math.floor(Math.random() * list.length)]
function rollName(previous){
    for(let i = 0; i < 8; i++){
        const name = pick(NAME_PARTS.start) + pick(NAME_PARTS.middle) + pick(NAME_PARTS.end)
        if(name !== previous && name.length >= 4 && name.length <= 12) return name
    }
    return pick(NAME_PARTS.start) + pick(NAME_PARTS.end)
}

const DIE_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8.5" cy="8.5" r="1.4" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.4" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.4" fill="currentColor"/></svg>`
const css = ({ r, g, b }) => `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`
const hexToColor = hex => ({ r: parseInt(hex.slice(1, 3), 16) / 255, g: parseInt(hex.slice(3, 5), 16) / 255, b: parseInt(hex.slice(5, 7), 16) / 255 })
const colorToHex = ({ r, g, b }) => "#" + [r, g, b].map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("")
const styleOf = mesh => mesh.name.split(".")[1]

export function closeCharacterPage(){
    document.getElementById("create-char-overlay")?.remove()
}

/**
 * The creation screen. getToSaveInfoFromSetup(name) -> the character to save;
 * meshData: { hair: { male, female }, cloth, pants, skinColors } (meshes and
 * skin {key, path}s); the callbacks drive the scene. options.onColorSelect(
 * category, {r, g, b}) dyes it; options.current() is the scene's own pick so
 * far (toSave), so the screen opens showing what the character wears.
 */
export function showCreateCharacterPage(getToSaveInfoFromSetup, meshData, onStyleSelect, onCategoryChange, onSkinSelect, onGenderSelect, { onColorSelect, current } = {}){
    closeCharacterPage()
    const start = current?.() ?? {}
    const stylesOf = (category, gender) => {
        const meshes = category === "hair" ? meshData?.hair?.[gender] ?? [] : meshData?.[category] ?? []
        return [...new Set(meshes.map(styleOf).filter(Boolean))]
    }
    const skins = meshData?.skinColors ?? []
    const state = {
        gender: start.gender ?? "male",
        category: "hair",
        style: { hair: start.hair, cloth: start.cloth, pants: start.pants },
        dye: { hair: DYES.hair[0], cloth: DYES.cloth[0], pants: DYES.pants[0] },
        skin: start.skinColor ?? skins[0]?.key,
        name: "",
    }

    const root = document.createElement("div")
    root.id = "create-char-overlay"
    root.className = "forge"
    root.innerHTML = `
        <header class="forge-title">
            <p class="forge-kicker">A rider of the Vessel</p>
            <h1 class="forge-name is-empty">Unnamed Rider</h1>
            <p class="forge-look"></p>
        </header>
        <div class="forge-column">
            <section class="forge-panel">
                <div class="forge-head">
                    <div class="forge-gender" role="radiogroup" aria-label="Body">
                        <span class="forge-gender-thumb"></span>
                        <button class="forge-gender-btn" data-gender="male" role="radio">Male</button>
                        <button class="forge-gender-btn" data-gender="female" role="radio">Female</button>
                    </div>
                    <button class="forge-roll" title="Roll a whole new look" aria-label="Roll a whole new look">${DIE_SVG}</button>
                </div>
                <nav class="forge-tabs">
                    ${CATEGORIES.map(cat => `
                        <button class="forge-tab" data-category="${cat.key}" aria-label="${cat.label}">
                            <img src="${cat.icon}" alt="" draggable="false" />
                            <span>${cat.label}</span>
                        </button>`).join("")}
                </nav>
                <div class="forge-section forge-style-row">
                    <p class="forge-label">Style</p>
                    <div class="forge-stepper">
                        <button class="forge-arrow" data-step="-1" aria-label="Previous style">&#8249;</button>
                        <div class="forge-style-name"></div>
                        <button class="forge-arrow" data-step="1" aria-label="Next style">&#8250;</button>
                    </div>
                    <div class="forge-dots"></div>
                </div>
                <div class="forge-section">
                    <p class="forge-label"><span class="forge-dye-label">Dye</span><em class="forge-dye-name"></em></p>
                    <div class="forge-swatches"></div>
                </div>
            </section>
            <section class="forge-begin">
                <label class="forge-label" for="cc-name">Name your rider</label>
                <div class="forge-name-field">
                    <input id="cc-name" type="text" maxlength="${NAME_MAX}" placeholder="Type a name..." autocomplete="off" spellcheck="false" />
                    <span class="forge-count">0/${NAME_MAX}</span>
                    <button class="forge-name-roll" title="A name from the old tongue" aria-label="Roll a name">${DIE_SVG}</button>
                </div>
                <p id="cc-msg" class="forge-msg" role="status"></p>
                <button id="cc-btn" class="createpage-btn forge-cta"><span>Begin the Journey</span></button>
            </section>
        </div>
    `
    document.body.appendChild(root)

    const $ = selector => root.querySelector(selector)
    const nameTitle = $(".forge-name")
    const lookLine = $(".forge-look")
    const styleName = $(".forge-style-name")
    const styleRow = $(".forge-style-row")
    const dots = $(".forge-dots")
    const swatches = $(".forge-swatches")
    const dyeLabel = $(".forge-dye-label")
    const dyeName = $(".forge-dye-name")
    const input = $("#cc-name")
    const count = $(".forge-count")
    const msg = $("#cc-msg")
    const cta = $("#cc-btn")
    const panel = $(".forge-panel")

    const isFemale = () => state.gender === "female"
    // what each body can change - she has her hair, and one fixed outfit
    const offered = cat => !isFemale() || CATEGORIES.find(entry => entry.key === cat)?.both

    const describe = () => {
        const parts = [`${state.dye.hair.name} hair`]
        if(!isFemale()){
            parts.push(`${state.dye.cloth.name} tunic`, `${state.dye.pants.name} trousers`)
            const skinIndex = skins.findIndex(skin => skin.key === state.skin)
            if(skinIndex >= 0) parts.push(`${SKIN_NAMES[skinIndex] ?? "Fair"} skin`)
        }
        lookLine.textContent = parts.join("  ·  ")
    }

    const renderStyle = () => {
        const cat = state.category
        if(cat === "skin"){
            styleRow.classList.add("hidden")
            return
        }
        styleRow.classList.remove("hidden")
        const styles = stylesOf(cat, state.gender)
        const at = Math.max(0, styles.indexOf(state.style[cat]))
        styleName.textContent = styles.length ? `Style ${ROMAN[at] ?? at + 1}` : "None"
        dots.innerHTML = styles.map((_, i) => `<i class="${i === at ? "on" : ""}"></i>`).join("")
    }

    const renderSwatches = () => {
        const cat = state.category
        swatches.innerHTML = ""
        if(cat === "skin"){
            dyeLabel.textContent = "Tone"
            skins.forEach(({ key, path }, i) => {
                const swatch = document.createElement("button")
                swatch.className = "forge-swatch forge-skin" + (key === state.skin ? " active" : "")
                swatch.style.backgroundImage = `url(${path})`
                swatch.title = SKIN_NAMES[i] ?? key
                swatch.setAttribute("aria-label", swatch.title)
                swatch.addEventListener("click", () => setSkin(key))
                swatches.appendChild(swatch)
            })
            const skinIndex = skins.findIndex(skin => skin.key === state.skin)
            dyeName.textContent = SKIN_NAMES[skinIndex] ?? ""
            return
        }
        dyeLabel.textContent = "Dye"
        DYES[cat].forEach(dye => {
            const swatch = document.createElement("button")
            swatch.className = "forge-swatch" + (state.dye[cat] === dye ? " active" : "")
            swatch.style.setProperty("--dye", css(dye))
            swatch.title = dye.name
            swatch.setAttribute("aria-label", dye.name)
            swatch.addEventListener("click", () => setDye(cat, dye))
            swatches.appendChild(swatch)
        })
        // any colour at all, through the browser's own picker
        const custom = document.createElement("label")
        const isCustom = !DYES[cat].includes(state.dye[cat])
        custom.className = "forge-swatch forge-custom" + (isCustom ? " active" : "")
        custom.title = "Your own dye"
        if(isCustom) custom.style.setProperty("--dye", css(state.dye[cat]))
        custom.innerHTML = `<input type="color" value="${colorToHex(state.dye[cat])}" aria-label="Your own dye" />`
        custom.querySelector("input").addEventListener("input", event => {
            setDye(cat, { name: "Your own", ...hexToColor(event.target.value) }, { keepSwatches: true })
            swatches.querySelectorAll(".forge-swatch").forEach(s => s.classList.remove("active"))
            custom.classList.add("active")
            custom.style.setProperty("--dye", event.target.value)
        })
        swatches.appendChild(custom)
        dyeName.textContent = state.dye[cat].name
    }

    const renderTabs = () => {
        root.querySelectorAll(".forge-tab").forEach(tab => {
            tab.classList.toggle("active", tab.dataset.category === state.category)
            tab.classList.toggle("hidden", !offered(tab.dataset.category))
        })
        root.querySelectorAll(".forge-gender-btn").forEach(btn => {
            const on = btn.dataset.gender === state.gender
            btn.classList.toggle("active", on)
            btn.setAttribute("aria-checked", on)
        })
        root.querySelector(".forge-gender").classList.toggle("is-female", isFemale())
    }

    const render = () => { renderTabs(); renderStyle(); renderSwatches(); describe() }

    // ── changes - the scene first, then the screen ──────────────────────────
    function setStyle(cat, style){
        state.style[cat] = style
        onStyleSelect?.(cat, style)
        renderStyle()
    }
    function setDye(cat, dye, { keepSwatches = false } = {}){
        state.dye[cat] = dye
        onColorSelect?.(cat, { r: dye.r, g: dye.g, b: dye.b })
        if(keepSwatches) dyeName.textContent = dye.name
        else renderSwatches()
        describe()
    }
    function setSkin(key){
        state.skin = key
        onSkinSelect?.(key)
        renderSwatches()
        describe()
    }
    function setCategory(cat){
        if(!offered(cat)) cat = "hair"
        state.category = cat
        onCategoryChange?.(cat)
        render()
        // the panel's contents swap in with a breath of light
        panel.classList.remove("swap")
        void panel.offsetWidth
        panel.classList.add("swap")
    }
    function setGender(gender){
        if(gender === state.gender) return
        state.gender = gender
        // the scene falls back to this body's first hairstyle when the last
        // one picked was the other body's
        const hair = onGenderSelect?.(gender)
        if(hair) state.style.hair = hair
        setCategory(offered(state.category) ? state.category : "hair")
    }
    function step(direction){
        const cat = state.category
        const styles = stylesOf(cat, state.gender)
        if(!styles.length) return
        const at = Math.max(0, styles.indexOf(state.style[cat]))
        setStyle(cat, styles[(at + direction + styles.length) % styles.length])
        styleName.classList.remove("flip-left", "flip-right")
        void styleName.offsetWidth
        styleName.classList.add(direction > 0 ? "flip-right" : "flip-left")
    }
    // a whole new look on this body - every style, dye and tone rolled
    function rollLook(){
        const cats = isFemale() ? ["hair"] : ["hair", "cloth", "pants"]
        cats.forEach(cat => {
            const styles = stylesOf(cat, state.gender)
            if(styles.length) setStyle(cat, pick(styles))
            setDye(cat, pick(DYES[cat]))
        })
        if(!isFemale() && skins.length) setSkin(pick(skins).key)
        render()
        const die = $(".forge-roll")
        die.classList.remove("rolling")
        void die.offsetWidth
        die.classList.add("rolling")
        panel.classList.remove("swap")
        void panel.offsetWidth
        panel.classList.add("swap")
    }
    function setName(value){
        state.name = value
        const trimmed = value.trim()
        nameTitle.textContent = trimmed || "Unnamed Rider"
        nameTitle.classList.toggle("is-empty", !trimmed)
        count.textContent = `${value.length}/${NAME_MAX}`
        cta.classList.toggle("ready", !!trimmed)
        if(trimmed) msg.textContent = ""
    }

    root.querySelectorAll(".forge-tab").forEach(tab => tab.addEventListener("click", () => setCategory(tab.dataset.category)))
    root.querySelectorAll(".forge-gender-btn").forEach(btn => btn.addEventListener("click", () => setGender(btn.dataset.gender)))
    root.querySelectorAll(".forge-arrow").forEach(btn => btn.addEventListener("click", () => step(Number(btn.dataset.step))))
    $(".forge-roll").addEventListener("click", rollLook)
    $(".forge-name-roll").addEventListener("click", () => {
        input.value = rollName(input.value)
        setName(input.value)
        nameTitle.classList.remove("reveal")
        void nameTitle.offsetWidth
        nameTitle.classList.add("reveal")
    })
    input.addEventListener("input", () => setName(input.value))
    input.addEventListener("keydown", event => { if(event.key === "Enter") begin() })
    cta.addEventListener("click", begin)

    function begin(){
        if(!state.name.trim()){
            msg.textContent = "Your rider needs a name."
            const field = $(".forge-name-field")
            field.classList.remove("shake")
            void field.offsetWidth
            field.classList.add("shake")
            input.focus()
            return
        }
        createCharacter(input, cta, msg, root, getToSaveInfoFromSetup)
    }

    // the screen opens on what the character already wears, the default dyes on
    ;["hair", "cloth", "pants"].forEach(cat => onColorSelect?.(cat, state.dye[cat]))
    setCategory("hair")
    setName("")
    input.focus({ preventScroll: true })
}

async function createCharacter(input, btn, msg, overlay, getToSaveInfoFromSetup){
    const name = input.value.trim()
    if(!name){ msg.textContent = "Your rider needs a name."; return }

    const accountDet = checkIfTokenSaved()
    if(!accountDet || !accountDet.token){ msg.textContent = "Not logged in."; return }
    const token = accountDet.token

    const label = btn.querySelector("span") ?? btn
    const idle = label.textContent
    btn.disabled = true
    btn.classList.add("busy")
    label.textContent = "Forging..."
    msg.textContent = ""
    const restore = () => {
        btn.disabled = false
        btn.classList.remove("busy")
        label.textContent = idle
    }

    const newChar = getToSaveInfoFromSetup(name)
    newChar.owner = accountDet.details._id
    try {
        const res = await fetch(`${APIURL}/characters/save`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                authori: `Bearer ${token}`
            },
            body: JSON.stringify(newChar)
        })

        const data = await res.json()

        if(data === "exist"){
            msg.textContent = "That name is already taken - choose another."
            restore()
            return
        }

        overlay.remove()
        startScene(false)
    } catch (err) {
        msg.textContent = "The road is closed - server error, try again."
        restore()
    }
}
