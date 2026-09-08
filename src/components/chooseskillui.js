// "Choose a skill" popup - lets the player pick ONE skill for themselves out
// of a handed-in list, instead of a skill just being auto-granted or rolled
// randomly (skillWheel.js's own grantSkillReward). First caller: npcDetails.js's
// gatherElementalCores quest ("Choose a skill that you think will help you
// the most for your goal.") - Emry hands the player every skill they're
// actually eligible for (skillWheel.js's own eligibleSkillsFor - aptitude-
// matched, lightning-unlock-gated) that they don't already own, and lets
// them pick which one to learn. Same "grid of clickable cards in a popup"
// shape craftingui.js's own material picker (openMaterialPicker) already
// established - .cs-grid/.cs-card mirror .mp-grid/.mp-swatch's own CSS
// almost exactly (style.scss), just sized for a skill's icon+name+rank+desc
// instead of a material's icon+name+qty.
import { createElement } from "../tools/GUITools"
import { giveSkill, SKILL_RANK_LABELS } from "./skillsui"

const csCont = document.querySelector(".choose-skill-container")
const csGrid = document.querySelector(".cs-grid")

function closeChooseSkill(){
    if(csCont) csCont.style.display = "none"
}

// arrayOfSkills - plain skillsData.js-shaped objects (name/displayName/desc/
// skillrank/element etc), same shape giveSkill already expects. Callers
// decide what belongs in this list (eligibility/ownership filtering is
// THEIR job, e.g. npcDetails.js's own unowned-and-eligible filter) - this
// function only ever renders whatever it's handed and grants whichever one
// gets clicked.
export function chooseASkill(arrayOfSkills){
    if(!csCont || !csGrid) return console.warn("chooseASkill: choose-skill-container not found in DOM")

    csGrid.innerHTML = ""

    if(!arrayOfSkills?.length){
        csGrid.append(createElement("p", "cs-empty-msg", "There is nothing left I can teach you right now."))
        csCont.style.display = "flex"
        return
    }

    arrayOfSkills.forEach(skill => {
        const card = createElement("button", "cs-card")
        const img = createElement("img", "cs-card-img")
        img.src = `./images/skills/${skill.name}.webp`
        const name = createElement("p", "cs-card-name", skill.displayName)
        const rank = createElement("p", "cs-card-rank", SKILL_RANK_LABELS[skill.skillrank] ?? "—")
        // dataset.rank drives the same [data-rank="N"] escalating-color rules
        // skillsui.js's own skill-info panel already uses (style.scss) -
        // reused here instead of a third copy of that color ladder
        card.dataset.rank = skill.skillrank ?? 0
        const desc = createElement("p", "cs-card-desc", skill.desc)
        card.append(img, name, rank, desc)

        card.addEventListener("click", () => {
            giveSkill(skill)
            closeChooseSkill()
        })
        csGrid.append(card)
    })

    csCont.style.display = "flex"
}
