import { getCharState, setCharStateMode } from "../charactersystem/characterstate.js";
import { getSocket } from "../sockets/joinsocket.js";
import { getIsSocketOn } from "../sockets/worldsocket.js";
import { createElement } from "../tools/tools.js";
import { activateSkill } from "../charactersystem/attackingSystem.js";
const skillCont = document.querySelector(".skill-container");


// skills list inside the container on left side
const skillListLeft = document.querySelector(".skill-list");

const skillInfoImg      = document.querySelector(".skillInfoImg");
const skillInfoTitle    = document.querySelector(".skillInfoTitle");
const skillInfoStatus   = document.querySelector(".skillInfoStatus");
const skillInfoType     = document.querySelector(".skillInfoType");
const skillInfoCost     = document.querySelector(".skillInfoCost");
const skillInfoCooldown = document.querySelector(".skillInfoCooldown");
const skillInfoDesc     = document.querySelector(".skillInfoDesc");

// SLOTS
const skillslotsContainer = document.querySelector(".skill-slots");
const slotbuttons = document.querySelectorAll(".skill-slot-button");


const log = console.log

export function openCloseSkills(){
    skillCont.style.display = skillCont.style.display === "flex" ? "none" : "flex";

    console.log(skillCont.style.display)

    updateSkillListUI()
}

export function updateSkillListUI(){
    const state = getCharState()
    updateSkillSlotsUI(state.skills)
    skillListLeft.innerHTML = ""
    state.skills.forEach((skill, i) => {
        const bx = createElement("div", "skill-bx")
        const background = createElement("img", "skill-background")
        background.src = `./images/UI/frames/skillbox.webp`

        const skillImg = createElement("img", "skill-img")
        skillImg.src = `./images/skills/${skill.name}.jpg`

        const textBx = createElement("div", "skill-bx-text")
        const skillName = createElement("p", "skill-name", skill.displayName)
        const skillLvl = createElement("p", "skill-lvl", `Lv. ${skill.lvl}`)
        textBx.append(skillName, skillLvl)

        const status = createElement("span", `skill-status ${skill.isActive ? "active" : ""}`, skill.isActive ? "Active" : "Inactive")

        bx.append(background, skillImg, textBx, status)
        bx.addEventListener("click", () => selectSkill(bx, skill))

        skillListLeft.append(bx)

        if(i === 0) selectSkill(bx, skill)
    })
}

function updateSkillSlotsUI(skills){
    slotbuttons.forEach(btn => {
        const slotNumber = Number(btn.classList[1])
        const skill = skills.find(sk => sk.slotNumber === slotNumber)
        const plusSign = btn.querySelector(".plus-sign")

        
        if(!skill){
            plusSign.style.height = "40%";
            plusSign.style.width = "40%";

            btn.className = `skill-slot-button ${slotNumber}`
            return
        }

        btn.className = `skill-slot-button ${slotNumber} ${skill.name}`
        plusSign.style.height = "70%";
        plusSign.style.width = "70%";
        plusSign.src = skill ? `./images/skills/${skill.name}.jpg` : `./images/UI/frames/plus.webp`
    })
}

function selectSkill(bx, skill){
    skillListLeft.querySelectorAll(".skill-bx").forEach(elem => elem.classList.remove("selected"))
    bx.classList.add("selected")
    renderSkillInfo(skill)
}

function renderSkillInfo(skill){
    skillInfoImg.src = `./images/skills/${skill.name}.jpg`
    skillInfoTitle.innerText = skill.displayName

    skillInfoStatus.innerText = skill.isActive ? "Active" : "Inactive"
    skillInfoStatus.classList.toggle("active", skill.isActive)

    skillInfoType.innerText = capitalize(skill.effects?.effectType)

    const demand = skill.demand?.[0]
    skillInfoCost.innerText = demand ? `${demand.cost} ${demand.name.toUpperCase()}` : "—"

    skillInfoCooldown.innerText = `${skill.skillCoolDown / 1000}s`
    skillInfoDesc.innerText = skill.desc
}

slotbuttons.forEach(btn => {
    console.log("asdasd")
    btn.addEventListener("click", () => {
        const socket = getSocket()
        const charState = getCharState()
        const skillName = btn.className.split(" ")[2]
        log(skillName)
        if(!skillName) return

        const skill = charState.skills.find(sk => sk.name === skillName)
        console.log(skill)
        skill.isActive = !skill.isActive

        // casting a skill mid-mining should drop it same as walking away or unequipping
        if(charState.mode === "minning") setCharStateMode("idle")

        if(getIsSocketOn()){
            socket.emit("activate-skill", {ownerId: charState.owner, skill, currentPlaceId: charState.currentPlace.placeId})
        } else{
            activateSkill(charState.owner, skill)
        }
    })

    const skillName = btn.className.split(" ")[2]
    // log(skillName)
})

function capitalize(str){
    if(!str) return "—"
    return str.charAt(0).toUpperCase() + str.slice(1)
}

