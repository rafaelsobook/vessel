import { getCharState, setCharStateMode, getTotal, updateMP_UI, updateMyDetailsOL } from "../charactersystem/characterstate.js";
import { getSocket } from "../sockets/joinsocket.js";
import { getIsSocketOn } from "../sockets/worldsocket.js";
import { createElement, checkIfTokenSaved } from "../tools/tools.js";
import { activateSkill, upgradeSkill } from "../charactersystem/attackingSystem.js";
import { MULTICAST_MAX_STAGGER_MS } from "../creations/skillEffects.js";
import { popStatusEffect, openClosePopup } from "../tools/popupUI.js";
import { getManaOutputPercent } from "../charactersystem/outputSliders.js";
import { skillsData } from "../staticRecources/skillsData.js";
const skillCont = document.querySelector(".skill-container");


// skills list inside the container on left side
const skillListLeft = document.querySelector(".skill-list");

const skillInfoImg      = document.querySelector(".skillInfoImg");
const skillInfoTitle    = document.querySelector(".skillInfoTitle");
const skillInfoStatus   = document.querySelector(".skillInfoStatus");
const skillInfoType     = document.querySelector(".skillInfoType");
const skillInfoRank     = document.querySelector(".skillInfoRank");
const skillInfoCost     = document.querySelector(".skillInfoCost");
const skillInfoCooldown = document.querySelector(".skillInfoCooldown");
const skillInfoDesc     = document.querySelector(".skillInfoDesc");
const skillAssignBtn    = document.querySelector(".skillAssignBtn");

// SLOTS
const skillslotsContainer = document.querySelector(".skill-slots");
const slotbuttons = document.querySelectorAll(".skill-slot-button");
// only slotbuttons.length physical buttons exist in the equip bar (5, see
// index.html's .skill-slots) - a skill's own slotNumber field (skillsData.js)
// can be any value, but only ones landing in this 1..N range actually render
// in the bar (updateSkillSlotsUI below); everything else is "known but
// benched", toggled via the assign/unassign button (see skillAssignBtn's
// click handler further down)
const SKILL_SLOT_COUNT = slotbuttons.length

// skill.skillrank -> display label (see skillsData.js for which skill gets
// which rank) - purely cosmetic, no mechanical effect, just how impressive
// the skill reads in the info panel
const SKILL_RANK_LABELS = {
    0: "Basic Class",
    1: "Elite Skill",
    2: "High Skill",
    3: "Legendary Class",
    4: "God Tier",
}

// currently-selected skill in the left list - tracked here (not just local to
// selectSkill) so updateSkillListUI can re-select the same skill after a
// re-render instead of always snapping back to index 0, and so the assign
// button's click handler knows which skill it's acting on
let selectedSkillName = null
let currentSkill = null

const log = console.log

// DEBUG CHEAT - bound to the "n" key in controllers/inputMovement.js, e.g.
// giveSkill(singlecastSkill) or giveSkill(voidrendSkill) (see skillsData.js
// for the full list). Grants skillDetail if not already known. Auto-bumps
// the slot if its slotNumber is already occupied by something else instead
// of silently stomping it - updateSkillSlotsUI's skills.find(sk =>
// sk.slotNumber === slotNumber) only ever returns the first match, so two
// skills sharing a slotNumber would leave one invisibly stuck behind the other.
export function giveSkill(skillDetail){
    const charState = getCharState()
    if(!charState || !skillDetail) return

    if(charState.skills.find(sk => sk.name === skillDetail.name)){
        return openClosePopup(`Already know ${skillDetail.displayName}`, true, 1500)
    }

    const usedSlots = new Set(charState.skills.map(sk => sk.slotNumber))
    let slotNumber = skillDetail.slotNumber
    while(usedSlots.has(slotNumber)) slotNumber++

    charState.skills.push({ ...skillDetail, slotNumber })
    updateSkillListUI()
    updateMyDetailsOL(charState, checkIfTokenSaved())
    openClosePopup(`Learned ${skillDetail.displayName}`, true, 1500)
}

// DEBUG CHEAT - bound to the "l" key in controllers/inputMovement.js. Grants
// EVERY skill in skillsData.js's exported skillsData array at once - always
// stays current with whatever's in that array, no list to keep in sync here.
// Same skip-if-known/slot-bump logic as giveSkill() above, just batched
// across the whole list into a single UI update/popup instead of firing one
// per skill. Only the first SKILL_SLOT_COUNT (5) actually land in the equip
// bar - the rest are learned but "benched" (see isSkillEquipped/the
// Assign-to-Slot button), same as usual once there are more skills than
// physical slots.
export function giveAllSkills(){
    const charState = getCharState()
    if(!charState) return

    const usedSlots = new Set(charState.skills.map(sk => sk.slotNumber))
    let learnedCount = 0

    skillsData.forEach(skillDetail => {
        if(charState.skills.find(sk => sk.name === skillDetail.name)) return
        let slotNumber = skillDetail.slotNumber
        while(usedSlots.has(slotNumber)) slotNumber++
        usedSlots.add(slotNumber)
        charState.skills.push({ ...skillDetail, slotNumber })
        learnedCount++
    })

    if(learnedCount === 0){
        return openClosePopup("Already know every skill", true, 1500)
    }

    updateSkillListUI()
    updateMyDetailsOL(charState, checkIfTokenSaved())
    openClosePopup(`Learned ${learnedCount} new skill${learnedCount > 1 ? "s" : ""}`, true, 1500)
}

// Takes the same static skillsData.js object giveSkill() does (e.g.
// upgradeOwnedSkill(burstshotsSkill)), but only uses it to look up the
// OWNED copy inside charState.skills by name - upgradeSkill(skillDetail)
// mutates whatever object reference it's handed in place, and giveSkill/
// giveAllSkills always push a shallow copy ({...skillDetail}), not the
// static export itself, so calling upgradeSkill directly on the
// skillsData.js import would silently bump a disconnected object nobody's
// casting. Not bound to a key directly anymore - see upgradeAllOwnedSkills
// below (bound to "h"), which calls upgradeSkill() directly for every
// entry already in charState.skills instead of doing this by-name lookup
// once per skill.
export function upgradeOwnedSkill(skillDetail){
    const charState = getCharState()
    if(!charState || !skillDetail) return

    const ownedSkill = charState.skills.find(sk => sk.name === skillDetail.name)
    if(!ownedSkill){
        return popStatusEffect(`learn ${skillDetail.displayName} first`, "yellow")
    }

    upgradeSkill(ownedSkill)
    updateSkillListUI()
    updateMyDetailsOL(charState, checkIfTokenSaved())
    openClosePopup(`${ownedSkill.displayName} is now Lv. ${ownedSkill.lvl}`, true, 1500)
}

// DEBUG CHEAT - bound to the "h" key in controllers/inputMovement.js. Upgrades
// EVERY skill the player currently owns by one level - batches into a single
// UI update/popup instead of firing one per skill (same pattern giveAllSkills
// uses for "l"). Operates directly on charState.skills' own entries (not via
// upgradeOwnedSkill's by-name lookup), so skills the player hasn't learned
// yet are silently skipped instead of popping a "learn X first" warning once
// per unowned skill - the point here is speed while testing, not feedback
// noise about skills you don't have.
export function upgradeAllOwnedSkills(){
    const charState = getCharState()
    if(!charState || !charState.skills.length) return

    charState.skills.forEach(ownedSkill => upgradeSkill(ownedSkill))

    updateSkillListUI()
    updateMyDetailsOL(charState, checkIfTokenSaved())
    openClosePopup(`Upgraded ${charState.skills.length} skill${charState.skills.length > 1 ? "s" : ""}`, true, 1500)
}

export function openCloseSkills(){
    skillCont.style.display = skillCont.style.display === "flex" ? "none" : "flex";

    console.log(skillCont.style.display)

    updateSkillListUI()
}

export function updateSkillListUI(){
    const state = getCharState()
    updateSkillSlotsUI(state.skills)
    skillListLeft.innerHTML = ""

    const rows = state.skills.map(skill => {
        const bx = createElement("div", "skill-bx")
        const background = createElement("img", "skill-background")
        background.src = `./images/UI/frames/skillbox.webp`

        const skillImg = createElement("img", "skill-img")
        skillImg.src = `./images/skills/${skill.name}.webp`

        const textBx = createElement("div", "skill-bx-text")
        const skillName = createElement("p", "skill-name", skill.displayName)
        const skillLvl = createElement("p", "skill-lvl", `Lv. ${skill.lvl}`)
        textBx.append(skillName, skillLvl)

        const statusCol = createElement("div", "skill-status-col")
        const status = createElement("span", `skill-status ${skill.isActive ? "active" : ""}`, skill.isActive ? "Active" : "Inactive")
        // which physical skill-slot-button (1..SKILL_SLOT_COUNT) this skill
        // is currently occupying, if any - "Unassigned" for a known-but-
        // benched skill (see the Assign/Remove button in the info panel)
        const slotLabel = createElement("span", `skill-slot-label ${isSkillEquipped(skill) ? "assigned" : ""}`, isSkillEquipped(skill) ? `Slot ${skill.slotNumber}` : "Unassigned")
        statusCol.append(status, slotLabel)

        bx.append(background, skillImg, textBx, statusCol)
        bx.addEventListener("click", () => selectSkill(bx, skill))

        skillListLeft.append(bx)
        return { bx, skill }
    })

    // re-select whatever was selected before this re-render (e.g. after
    // assigning/unassigning a slot) instead of always snapping back to the
    // first skill - falls back to the first row the first time this runs,
    // or if the previously-selected skill isn't in the list anymore
    const toSelect = rows.find(r => r.skill.name === selectedSkillName) || rows[0]
    if(toSelect) selectSkill(toSelect.bx, toSelect.skill)
}

function updateSkillSlotsUI(skills){
    slotbuttons.forEach(btn => {
        const slotNumber = Number(btn.classList[1])
        const skill = skills.find(sk => sk.slotNumber === slotNumber)
        const plusSign = btn.querySelector(".plus-sign")

        
        if(!skill){
            plusSign.style.height = "40%";
            plusSign.style.width = "40%";
            // revert back to the plain "+" icon - without this, a slot that
            // just got unassigned (Remove from Slot) keeps showing whatever
            // skill icon was left over from src being set in the branch below
            plusSign.src = "./images/UI/frames/plus.webp"

            btn.className = `skill-slot-button ${slotNumber}`
            return
        }

        btn.className = `skill-slot-button ${slotNumber} ${skill.name}`
        plusSign.style.height = "70%";
        plusSign.style.width = "70%";
        plusSign.src = skill ? `./images/skills/${skill.name}.webp` : `./images/UI/frames/plus.webp`
    })
}

function selectSkill(bx, skill){
    selectedSkillName = skill.name
    currentSkill = skill
    skillListLeft.querySelectorAll(".skill-bx").forEach(elem => elem.classList.remove("selected"))
    bx.classList.add("selected")
    renderSkillInfo(skill)
}

// a skill counts as "equipped" only if its slotNumber lands within the
// physical bar's range (1..SKILL_SLOT_COUNT) - see the SKILL_SLOT_COUNT
// comment above for why values outside that range mean "benched"
function isSkillEquipped(skill){
    return skill.slotNumber >= 1 && skill.slotNumber <= SKILL_SLOT_COUNT
}

function renderSkillInfo(skill){
    skillInfoImg.src = `./images/skills/${skill.name}.webp`
    skillInfoTitle.innerText = skill.displayName

    skillInfoStatus.innerText = skill.isActive ? "Active" : "Inactive"
    skillInfoStatus.classList.toggle("active", skill.isActive)

    skillInfoType.innerText = capitalize(skill.effects?.effectType)
    skillInfoRank.innerText = SKILL_RANK_LABELS[skill.skillrank] ?? "—"

    const demand = skill.demand?.[0]
    skillInfoCost.innerText = demand ? `${demand.cost} ${demand.name.toUpperCase()}` : "—"

    skillInfoCooldown.innerText = `${skill.skillCoolDown / 1000}s`
    skillInfoDesc.innerText = skill.desc

    if(skillAssignBtn){
        const equipped = isSkillEquipped(skill)
        skillAssignBtn.innerText = equipped ? "Remove from Slot" : "Assign to Slot"
        skillAssignBtn.classList.toggle("equipped", equipped)
    }
}

// assigns/unassigns whichever skill is currently selected (currentSkill) -
// assigning always picks the FIRST vacant physical slot (1..SKILL_SLOT_COUNT),
// never a specific one, per spec ("if skill-slot-button 2 is vacant then
// assign it there not in 3")
skillAssignBtn?.addEventListener("click", () => {
    const charState = getCharState()
    if(!charState || !currentSkill) return

    if(isSkillEquipped(currentSkill)){
        currentSkill.slotNumber = null
    } else {
        const usedSlots = new Set(
            charState.skills.filter(sk => sk !== currentSkill).map(sk => sk.slotNumber)
        )
        let vacantSlot = null
        for(let i = 1; i <= SKILL_SLOT_COUNT; i++){
            if(!usedSlots.has(i)){ vacantSlot = i; break }
        }
        if(vacantSlot === null){
            return popStatusEffect(`only ${SKILL_SLOT_COUNT} skill slots available`, "yellow")
        }
        currentSkill.slotNumber = vacantSlot
    }

    updateSkillListUI()
    updateMyDetailsOL(charState, checkIfTokenSaved())
})

// skill.name -> timeoutId for the offense-skill isActive auto-reset below -
// so a rapid re-press (cancel a cast, immediately recast) cancels the FIRST
// cast's stale reset instead of letting it fire mid-way through the second
// one and prematurely flip isActive back off, reintroducing the same
// "press twice" symptom under different circumstances
const activeSkillResetTimers = new Map()

// true only while multicastSkill's own click handler is synchronously
// .click()-ing the other 4 slot buttons (see the cascade block below) - each
// of those nested invocations stashes this onto its OWN skill._castSpread
// right when it runs, so skillEffects.js's computeCastOrigin knows to spread
// THAT skill's spawn point out instead of dead-centering it in front of the
// hand like a normal solo press. Reset to false the instant the cascade
// loop finishes, so it never leaks into an unrelated later press.
let cascadeActive = false

slotbuttons.forEach(btn => {
    btn.addEventListener("click", () => {
        const socket = getSocket()
        const charState = getCharState()
        const skillName = btn.className.split(" ")[2]

        if(!skillName) return

        const skill = charState.skills.find(sk => sk.name === skillName)
        console.log(skill.isActive)
        const willActivate = !skill.isActive
        console.log(willActivate)
        if(willActivate){
            // requireMode gates activation to a specific charState.mode (e.g.
            // singlecast needs "casting", see the cast button in
            // uimanagement.js) - a skill with no requireMode set has no gate
            if(skill.requireMode && charState.mode !== skill.requireMode){
                popStatusEffect(`must be ${skill.requireMode} to use this`, "yellow")
                return
            }

            // mp demand cost scales with the mana output slider - minCost is
            // the cost at 100% output, see outputSliders.js. Only "mp"
            // demands are handled here per spec; other demand.name values
            // (sp etc) aren't charged yet.
            const manaDemand = skill.demand?.find(d => d.name === "mp")
            if(manaDemand){
                const outputPercent = getManaOutputPercent()
                const cost = Math.round(manaDemand.minCost * (outputPercent / 100))
                if(getTotal().mp < cost){
                    popStatusEffect("not enough mana", "yellow")
                    return
                }
                manaDemand.cost = cost
                charState.mp -= cost
                updateMP_UI()
                updateMyDetailsOL(charState, checkIfTokenSaved())

                // how much power the cast actually lands with, not just what
                // it costs - 100% output = full effect, 0% output = a free
                // but ~powerless cast, scaling together rather than only the
                // cost moving. Stashed on the skill object itself (not a
                // separate param) so it rides along through the multiplayer
                // relay (activate-skill -> skillactivated -> activateSkill)
                // the same way for remote players watching the cast happen.
                skill._castPowerScale = outputPercent / 100
            }
        }

        skill.isActive = willActivate

        // see cascadeActive's own comment above - only true while THIS
        // activation is happening as part of multicastSkill's cascade, so
        // skillEffects.js's computeCastOrigin knows whether to spread this
        // particular skill's spawn point out or leave it centered
        skill._castSpread = cascadeActive

        // casting a skill mid-mining should drop it same as walking away or unequipping
        if(charState.mode === "minning") setCharStateMode("idle")

        if(getIsSocketOn()){
            socket.emit("activate-skill", {ownerId: charState.owner, skill, currentPlaceId: charState.currentPlace.placeId})
        } else{
            activateSkill(charState.owner, skill)
        }

        // skill.effects.effectType === "trigger" (multicast - see its own
        // header comment in skillsData.js) - fires no projectile of its
        // own; instead, now that its own mode/mana gate above already
        // passed, it programmatically .click()s every OTHER assigned
        // skill-slot-button, running each one through this EXACT same
        // handler (mana check, requireMode gate, multiplayer relay, its own
        // reset timer below) as if the player had pressed all of them.
        // Only cascades on activation (willActivate), never on the press
        // that turns multicast back off, and each triggered skill can still
        // independently fail its OWN mana/mode check (that skill just won't
        // fire, the others still will) - same graceful behavior a real
        // manual press of each button would have.
        if(willActivate && skill.effects?.effectType === "trigger"){
            cascadeActive = true
            slotbuttons.forEach(otherBtn => {
                if(otherBtn === btn) return
                otherBtn.click()
            })
            cascadeActive = false
        }

        // offense skills (singlecast/elemental/burstshots) AND the
        // multicast trigger above are one-shot presses, not a sustained
        // toggle like flexaura - without this, isActive stays stuck true
        // forever after the first successful activation (nothing else ever
        // flips it back off), so the NEXT press just toggles it back to
        // false instead of firing again, and only the press AFTER THAT
        // actually re-fires. Reset locally on a timer here, acting on this
        // exact `skill` reference (the real one living in charState.skills),
        // rather than from inside skillEffects.js's cast functions - when
        // the socket is on, those only ever receive a JSON-deserialized
        // CLONE of this skill via the "skillactivated" relay (see
        // worldsocket.js), so mutating isActive there would silently do
        // nothing to this real object.
        clearTimeout(activeSkillResetTimers.get(skill.name))
        activeSkillResetTimers.delete(skill.name)

        if(willActivate && (skill.effects?.effectType === "offense" || skill.effects?.effectType === "trigger")){
            // burstshots (formerly named "multicast") is the only skill
            // whose own cast sequence outlives its nominal castDuration -
            // its circles keep staggering out for up to MULTICAST_MAX_STAGGER_MS
            // past that, so its own reset has to wait that much longer too
            const resetDelayMs = skill.name === "burstshots"
                ? skill.castDuration * 1000 + MULTICAST_MAX_STAGGER_MS + 100
                : skill.castDuration * 1000 + 100
            const resetTimeoutId = setTimeout(() => {
                skill.isActive = false
                activeSkillResetTimers.delete(skill.name)
                updateSkillListUI()
            }, resetDelayMs)
            activeSkillResetTimers.set(skill.name, resetTimeoutId)
        }

        updateSkillListUI()
    })

    const skillName = btn.className.split(" ")[2]
    // log(skillName)
})

function capitalize(str){
    if(!str) return "—"
    return str.charAt(0).toUpperCase() + str.slice(1)
}

