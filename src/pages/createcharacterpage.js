import { APIURL } from "../constants/constants.js"
import { startScene } from "../main/main.js"
import {checkIfTokenSaved} from "../tools/tools.js"

export function closeCharacterPage(){
    const overlay = document.getElementById("create-char-overlay")
    const categoryIcons = document.querySelector(".cc-category-icons")
    const listbox = document.querySelector(".list-box-right")
    const genderBtns = document.querySelector(".cc-gender-btns")
    if(overlay) overlay.style.display = "none"
    if(categoryIcons) categoryIcons.style.display = "none"
    if(listbox) listbox.style.display = "none"
    if(genderBtns) genderBtns.style.display = "none"
}
export function showCreateCharacterPage(getToSaveInfoFromSetup, meshData, onStyleSelect, onCategoryChange, onSkinSelect, onGenderSelect) {
    const overlay = document.createElement("div")
    overlay.id = "create-char-overlay"
    overlay.className = "page-overlay"

    overlay.innerHTML = `
        <div class="cc-controls">
            <p id="cc-msg" class="page-msg"></p>
            <input id="cc-name" type="text" maxlength="24" placeholder="Enter character name" class="page-input" />
            <img src="./images/UI/begin.png" id="cc-btn" class="createpage-btn"></img>
        </div>
    `

    // gender toggle - lower-middle of the screen, above the name/begin
    // controls. Default is male (setupcharacterscene.js's own toSave.gender)
    const genderBtns = document.createElement("div")
    genderBtns.className = "cc-gender-btns"
    genderBtns.innerHTML = `
        <button class="cc-gender-btn active" data-gender="male">Male</button>
        <button class="cc-gender-btn" data-gender="female">Female</button>
    `

    const categoryIcons = document.createElement("div")
    categoryIcons.className = "cc-category-icons"
    categoryIcons.innerHTML = `
        <button class="cc-cat-icon" data-category="hair">
            <img src="./images/setup/hair.png" alt="hair" />
        </button>
        <button class="cc-cat-icon" data-category="cloth">
            <img src="./images/setup/cloth.png" alt="cloth" />
        </button>
        <button class="cc-cat-icon" data-category="pants">
            <img src="./images/setup/pants.png" alt="pants" />
        </button>
        <button class="cc-cat-icon" data-category="skin">
            <img src="./images/setup/skincolor.png" alt="skin" />
        </button>
    `

    const listbox = document.createElement("div")
    const listboxBackground = document.createElement("img")
    listboxBackground.src = "./images/UI/listbox.png"
    listbox.append(listboxBackground)
    listbox.classList.add("list-box-right")

    const categories = ["hair", "cloth", "pants", "skin"]
    const categoryContainers = {}
    // only "hair" exists for both genders (as two separate style lists -
    // see setupcharacterscene.js's own meshData.hair = {male, female}) -
    // cloth/pants have no female styles yet, so those two icons just get
    // hidden entirely for female (below) instead of needing a second list
    let hairGenderGroups

    const buildStyleButtons = (container, meshArr, cat) => {
        const styles = [...new Set(meshArr.map(m => m.name.split(".")[1]).filter(Boolean))]
        styles.forEach(style => {
            const btn = document.createElement("button")
            btn.className = "cc-style-btn"
            btn.textContent = style
            btn.addEventListener("click", () => {
                container.querySelectorAll(".cc-style-btn").forEach(b => b.classList.remove("active"))
                btn.classList.add("active")
                onStyleSelect?.(cat, style)
            })
            container.appendChild(btn)
        })
    }

    categories.forEach(cat => {
        const container = document.createElement("div")
        container.className = "cc-style-container"
        container.dataset.category = cat
        container.style.display = "none"

        if (cat === "skin") {
            // meshData.skinColors is now a list of {key, path} pairs
            // (SKIN_TEXTURE_LIST), not {r,g,b} colors - render each as a
            // thumbnail of the actual texture rather than a flat swatch, but
            // hand the key (not the path) back to onSkinSelect since that's
            // what actually gets persisted.
            const skinTextures = meshData?.skinColors ?? []
            skinTextures.forEach(({ key, path }) => {
                const btn = document.createElement("button")
                btn.className = "cc-style-btn cc-skin-swatch"
                btn.style.backgroundImage = `url(${path})`
                btn.style.backgroundSize = "cover"
                btn.style.backgroundPosition = "center"
                btn.addEventListener("click", () => {
                    container.querySelectorAll(".cc-style-btn").forEach(b => b.classList.remove("active"))
                    btn.classList.add("active")
                    onSkinSelect?.(key)
                })
                container.appendChild(btn)
            })
        } else if (cat === "hair") {
            // two independent button groups, one per gender's own mesh
            // list - only the current gender's group is ever visible
            // (toggled by the gender buttons below), so the style names
            // shown always match what's actually on the body right now
            const maleGroup = document.createElement("div")
            maleGroup.className = "cc-hair-group cc-hair-group-male"
            buildStyleButtons(maleGroup, meshData?.hair?.male ?? [], "hair")

            const femaleGroup = document.createElement("div")
            femaleGroup.className = "cc-hair-group cc-hair-group-female"
            femaleGroup.style.display = "none"
            buildStyleButtons(femaleGroup, meshData?.hair?.female ?? [], "hair")

            container.appendChild(maleGroup)
            container.appendChild(femaleGroup)
            hairGenderGroups = { male: maleGroup, female: femaleGroup }
        } else {
            buildStyleButtons(container, meshData?.[cat] ?? [], cat)
        }

        listbox.appendChild(container)
        categoryContainers[cat] = container
    })

    let activeCategory = "hair"
    const showCategory = (cat) => {
        activeCategory = cat
        categories.forEach(c => {
            categoryContainers[c].style.display = c === cat ? "flex" : "none"
        })
        categoryIcons.querySelectorAll(".cc-cat-icon").forEach(b => {
            b.classList.toggle("active", b.dataset.category === cat)
        })
    }

    categoryIcons.querySelectorAll(".cc-cat-icon").forEach(iconBtn => {
        iconBtn.addEventListener("click", () => {
            const cat = iconBtn.dataset.category
            onCategoryChange?.(cat)
            showCategory(cat)
        })
    })

    const clothIcon = categoryIcons.querySelector('[data-category="cloth"]')
    const pantsIcon = categoryIcons.querySelector('[data-category="pants"]')
    const skinIcon = categoryIcons.querySelector('[data-category="skin"]')

    genderBtns.querySelectorAll(".cc-gender-btn").forEach(genderBtn => {
        genderBtn.addEventListener("click", () => {
            const gender = genderBtn.dataset.gender
            genderBtns.querySelectorAll(".cc-gender-btn").forEach(b => b.classList.remove("active"))
            genderBtn.classList.add("active")

            onGenderSelect?.(gender)

            const isFemale = gender === "female"
            // cloth/pants have no female styles yet, and skin color is a
            // male-only option for now (createcharacter.js/setupcharacterscene.js
            // no longer touch femalebody's material at all) - hide all three
            // icons entirely for female rather than show an empty/dead panel.
            // style.css's own ".hidden" utility class (display:none!important),
            // not the native `hidden` DOM property - .cc-category-icons
            // .cc-cat-icon's own "display:flex" rule is MORE specific than the
            // browser's default [hidden] rule and would silently win over it
            if(clothIcon) clothIcon.classList.toggle("hidden", isFemale)
            if(pantsIcon) pantsIcon.classList.toggle("hidden", isFemale)
            if(skinIcon) skinIcon.classList.toggle("hidden", isFemale)
            if(hairGenderGroups){
                hairGenderGroups.male.style.display = isFemale ? "none" : "flex"
                hairGenderGroups.female.style.display = isFemale ? "flex" : "none"
            }
            // currently viewing a category that just got hidden - fall back
            // to hair (the only category female actually has) rather than
            // leave an empty panel showing
            if(isFemale && activeCategory !== "hair") showCategory("hair")
        })
    })

    document.body.appendChild(overlay)
    document.body.appendChild(categoryIcons)
    document.body.appendChild(listbox)
    document.body.appendChild(genderBtns)

    const input = overlay.querySelector("#cc-name")
    const btn = overlay.querySelector(".createpage-btn")
    const msg = overlay.querySelector("#cc-msg")

    input.focus()
    btn.addEventListener("click", () => createCharacter(input, btn, msg, overlay, getToSaveInfoFromSetup))
    input.addEventListener("keydown", e => e.key === "Enter" && createCharacter(input, btn, msg, overlay, getToSaveInfoFromSetup))
}

async function createCharacter(input, btn, msg, overlay, getToSaveInfoFromSetup) {
    const name = input.value.trim()
    if (!name) { msg.textContent = "Name cannot be empty."; return }

    const accountDet = checkIfTokenSaved()
    if (!accountDet || !accountDet.token) { msg.textContent = "Not logged in."; return }
    const token = accountDet.token

    btn.disabled = true
    btn.textContent = "Creating..."
    msg.textContent = ""

    const newChar = getToSaveInfoFromSetup(input.value.trim())
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

        console.log(data)

        if (data === "exist") {
            msg.textContent = "Name already taken, choose another."
            btn.disabled = false
            btn.textContent = "Begin"
            return
        }

        overlay.remove()
        startScene(false)

    } catch (err) {
        msg.textContent = "Server error, try again."
        btn.disabled = false
        btn.textContent = "Begin"
    }
}
