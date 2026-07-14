import { APIURL } from "../constants/constants.js"
import { startScene } from "../main/main.js"
import {checkIfTokenSaved} from "../tools/tools.js"

export function closeCharacterPage(){
    const overlay = document.getElementById("create-char-overlay")
    const categoryIcons = document.querySelector(".cc-category-icons")
    const listbox = document.querySelector(".list-box-right")
    if(overlay) overlay.style.display = "none"
    if(categoryIcons) categoryIcons.style.display = "none"
    if(listbox) listbox.style.display = "none"
}
export function showCreateCharacterPage(getToSaveInfoFromSetup, meshData, onStyleSelect, onCategoryChange, onSkinSelect) {
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

    categories.forEach(cat => {
        const container = document.createElement("div")
        container.className = "cc-style-container"
        container.dataset.category = cat
        container.style.display = "none"

        if (cat === "skin") {
            const skinColors = meshData?.skinColors ?? []
            skinColors.forEach(color => {
                const btn = document.createElement("button")
                btn.className = "cc-style-btn cc-skin-swatch"
                btn.style.backgroundColor = `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`
                btn.addEventListener("click", () => {
                    container.querySelectorAll(".cc-style-btn").forEach(b => b.classList.remove("active"))
                    btn.classList.add("active")
                    onSkinSelect?.(color)
                })
                container.appendChild(btn)
            })
        } else {
            const meshArr = meshData?.[cat] ?? []
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

        listbox.appendChild(container)
        categoryContainers[cat] = container
    })

    categoryIcons.querySelectorAll(".cc-cat-icon").forEach(iconBtn => {
        iconBtn.addEventListener("click", () => {
            const cat = iconBtn.dataset.category
            onCategoryChange?.(cat)
            categories.forEach(c => {
                categoryContainers[c].style.display = c === cat ? "flex" : "none"
            })
            categoryIcons.querySelectorAll(".cc-cat-icon").forEach(b => b.classList.remove("active"))
            iconBtn.classList.add("active")
        })
    })

    document.body.appendChild(overlay)
    document.body.appendChild(categoryIcons)
    document.body.appendChild(listbox)

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
