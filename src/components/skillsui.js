import { getCharState, setCharStateMode, getTotal, updateMP_UI, updateMyDetailsOL, getCanPress, getMyAuraProfile } from "../charactersystem/characterstate.js";
import { getSocket } from "../sockets/joinsocket.js";
import { getIsSocketOn } from "../sockets/worldsocket.js";
import { checkIfTokenSaved } from "../tools/tools.js";
import { activateSkill, upgradeSkill } from "../charactersystem/attackingSystem.js";
import { MULTICAST_MAX_STAGGER_MS } from "../creations/skillEffects.js";
import { popStatusEffect, openClosePopup } from "../tools/popupUI.js";
import { getManaOutputPercent } from "../charactersystem/outputSliders.js";
import { skillsData, getSkillEffect } from "../staticRecources/skillsData.js";
import { popupReceiveSkillUI } from "./skillAcquiredUI.js";
import { receiveAchievement } from "../charactersystem/achievement.js";
import { amIStunned } from "../charactersystem/stun.js";
// the skills window itself is Babylon GUI (skillsPanel.js) - this file says
// what's in it and what clicking does; the slot bar below stays HTML
import { renderSkillsPanel, openCloseSkillsPanel } from "./skillsPanel.js";

// SLOTS
const skillslotsContainer = document.querySelector(".skill-slots");
const slotbuttons = document.querySelectorAll(".skill-slot-button");
// only slotbuttons.length physical buttons exist in the equip bar (5, see
// index.html's .skill-slots) - a skill's own slotNumber field (skillsData.js)
// can be any value, but only ones landing in this 1..N range actually render
// in the bar (updateSkillSlotsUI below); everything else is "known but
// benched", toggled via the assign/unassign button (see assignSelectedSkill
// further down)
const SKILL_SLOT_COUNT = slotbuttons.length

// skill.skillrank -> display label (see skillsData.js for which skill gets
// which rank) - purely cosmetic, no mechanical effect, just how impressive
// the skill reads in the info panel
// exported - chooseskillui.js's own skill-picker cards show the same rank
// label, reused here instead of a third hand-copied table (skillWheel.js's
// eligibleSkillsFor sits right alongside skillsData's own skillrank field,
// but the DISPLAY string mapping only ever lived here)
export const SKILL_RANK_LABELS = {
    0: "Basic Class",
    1: "Elite Skill",
    2: "High Skill",
    3: "Legendary Class",
    4: "God Tier",
}

// currently-selected skill in the left list - tracked here so
// updateSkillListUI can re-select the same skill after a re-render instead of
// always snapping back to the first, and so the assign button knows which
// skill it's acting on
let selectedSkillName = null

// DEBUG CHEAT - bound to the "n" key in controllers/inputMovement.js, e.g.
// giveSkill(singlecastSkill) or giveSkill(voidrendSkill) (see skillsData.js
// for the full list). Grants skillDetail if not already known. Auto-bumps
// the slot if its slotNumber is already occupied by something else instead
// of silently stomping it - updateSkillSlotsUI's skills.find(sk =>
// sk.slotNumber === slotNumber) only ever returns the first match, so two
// skills sharing a slotNumber would leave one invisibly stuck behind the other.
// quiet: no "Learned" popup - the caller shows it its own way (a skill tome's
// ceremony, effects/tomeReveal.js). Returns the character's own copy.
export function giveSkill(skillDetail, { quiet = false } = {}){
    const charState = getCharState()
    if(!charState || !skillDetail) return

    if(charState.skills.find(sk => sk.name === skillDetail.name)){
        return openClosePopup(`Already know ${skillDetail.displayName}`, true, 1500)
    }

    const usedSlots = new Set(charState.skills.map(sk => sk.slotNumber))
    let slotNumber = skillDetail.slotNumber
    while(usedSlots.has(slotNumber)) slotNumber++

    // a deep copy, not the skillsData.js object itself: levelling a skill rewrites
    // its nested effects/projectileVisual in place (upgradeSkill), which would
    // otherwise change the definition every later learner - and every npc
    // fighter's copy - starts from, until the next reload
    const owned = { ...JSON.parse(JSON.stringify(skillDetail)), slotNumber }
    charState.skills.push(owned)
    updateSkillListUI()
    updateMyDetailsOL(charState, checkIfTokenSaved())
    // rank-framed celebration popup (skillAcquiredUI.js) instead of the old
    // plain text toast - same upgrade titleUI.js's own popup already got
    if(!quiet) popupReceiveSkillUI(skillDetail)
    // "awakened" fires for literally any first skill; "elite-skill" only for
    // skillrank >= 1 (skillsData.js's own header comment: 0 is "Basic Class",
    // 1+ is "Elite Skill" and up) - receiveAchievement no-ops on repeats, so
    // no extra bookkeeping needed here to only fire elite-skill once
    receiveAchievement("awakened")
    if(skillDetail.skillrank >= 1) receiveAchievement("elite-skill")
    return owned
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

// DEBUG CHEAT - bound to the "b" key in controllers/inputMovement.js, same
// spirit as titleUI.js's giveRandomTitle (bound to "t"). Picks one at random
// from skillsData.js's own full pool and runs it through the exact same
// giveSkill() path a real "learn this skill" grant uses - already-known/
// slot-bumping logic all comes along for free, so a re-roll that lands on
// something already owned just shows giveSkill's own "Already know X" popup
// instead of silently no-oping.
export function giveRandomSkill(){
    // not a starter skill (flexaura) - everyone has those already
    const pool = skillsData.filter(skill => !skill.starter)
    const skillDetail = pool[Math.floor(Math.random() * pool.length)]
    giveSkill(skillDetail)
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
// quiet: no "Lv. N" toast - the caller shows it its own way. Returns the
// character's own copy, levelled.
export function upgradeOwnedSkill(skillDetail, { quiet = false } = {}){
    const charState = getCharState()
    if(!charState || !skillDetail) return

    const ownedSkill = charState.skills.find(sk => sk.name === skillDetail.name)
    if(!ownedSkill){
        return popStatusEffect(`learn ${skillDetail.displayName} first`, "yellow")
    }

    upgradeSkill(ownedSkill)
    updateSkillListUI()
    updateMyDetailsOL(charState, checkIfTokenSaved())
    if(!quiet) openClosePopup(`${ownedSkill.displayName} is now Lv. ${ownedSkill.lvl}`, true, 1500)
    return ownedSkill
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
    updateSkillListUI()
    openCloseSkillsPanel()
}

export function updateSkillListUI(){
    const state = getCharState()
    if(!state) return
    updateSkillSlotsUI(state.skills)

    // keep whatever was selected (e.g. after assigning/unassigning a slot)
    // instead of snapping back to the first skill - the first the first time,
    // or if the selected one isn't in the list anymore
    if(!state.skills.some(sk => sk.name === selectedSkillName)) selectedSkillName = state.skills[0]?.name ?? null
    renderSkillsPanel({
        skills: state.skills,
        selectedName: selectedSkillName,
        describe: describeSkill,
        onSelect: selectSkill,
        onAssign: assignSelectedSkill,
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

function selectSkill(skill){
    selectedSkillName = skill.name
    updateSkillListUI()
}

// a skill counts as "equipped" only if its slotNumber lands within the
// physical bar's range (1..SKILL_SLOT_COUNT) - see the SKILL_SLOT_COUNT
// comment above for why values outside that range mean "benched"
function isSkillEquipped(skill){
    return skill.slotNumber >= 1 && skill.slotNumber <= SKILL_SLOT_COUNT
}

// what the skills window shows for a skill (skillsPanel.js draws it)
function describeSkill(skill){
    const equipped = isSkillEquipped(skill)
    const demand = skill.demand?.[0]
    return {
        // effects is an array - every skill still only carries one entry
        // today, so its [0] is "the" type for this one-line label
        type: capitalize(skill.effects?.[0]?.effectType),
        rank: skill.skillrank ?? 0,
        rankLabel: SKILL_RANK_LABELS[skill.skillrank] ?? "—",
        cost: demand ? `${demand.cost} ${demand.name.toUpperCase()}` : "—",
        cooldown: `${skill.skillCoolDown / 1000}s`,
        equipped,
        // which slot-bar button (1..SKILL_SLOT_COUNT) it's in, if any
        slotLabel: equipped ? `Slot ${skill.slotNumber}` : "Unassigned",
    }
}

// assigns/unassigns whichever skill is currently selected - assigning always
// picks the FIRST vacant physical slot (1..SKILL_SLOT_COUNT), never a
// specific one, per spec ("if skill-slot-button 2 is vacant then assign it
// there not in 3")
function assignSelectedSkill(){
    const charState = getCharState()
    const currentSkill = charState?.skills.find(sk => sk.name === selectedSkillName)
    if(!currentSkill) return

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
}

// skill.name -> timeoutId for the offense-skill isActive auto-reset below -
// so a rapid re-press (cancel a cast, immediately recast) cancels the FIRST
// cast's stale reset instead of letting it fire mid-way through the second
// one and prematurely flip isActive back off, reintroducing the same
// "press twice" symptom under different circumstances
const activeSkillResetTimers = new Map()

// SKILL COOLDOWNS - client only, Dota style: once a skill goes off (on the
// press, not when it lands), its slot greys over with a dark wedge that
// sweeps away clockwise as skill.skillCoolDown (ms) runs out, the seconds
// left in the middle, and pressing it meanwhile does nothing but flash. When
// it's back the slot gives a short glint. Turning a toggle skill OFF (flex
// aura) is never blocked - only casting it again. Keyed by skill name, so a
// skill keeps its cooldown if it's moved to another slot.
const skillCooldowns = new Map()   // skill.name -> { start, end }
let cooldownFrame = 0

function cooldownLeftMs(skillName){
    const cd = skillCooldowns.get(skillName)
    return cd ? Math.max(0, cd.end - performance.now()) : 0
}
function startCooldown(skill){
    const ms = Number(skill.skillCoolDown) || 0
    if(ms <= 0) return
    const now = performance.now()
    skillCooldowns.set(skill.name, { start: now, end: now + ms })
    if(!cooldownFrame) cooldownFrame = requestAnimationFrame(drawCooldowns)
}
// the overlay inside a slot button, made the first time it's needed
function cooldownOverlayOf(btn){
    let overlay = btn.querySelector(".skill-cd")
    if(!overlay){
        overlay = document.createElement("span")
        overlay.className = "skill-cd"
        overlay.innerHTML = `<span class="skill-cd-time"></span>`
        btn.appendChild(overlay)
    }
    return overlay
}
function drawCooldowns(){
    cooldownFrame = 0
    const now = performance.now()
    slotbuttons.forEach(btn => {
        const skillName = btn.className.split(" ")[2]
        const cd = skillName && skillCooldowns.get(skillName)
        const overlay = btn.querySelector(".skill-cd")
        if(!cd){
            if(overlay) overlay.classList.remove("on")
            return
        }
        const el = overlay ?? cooldownOverlayOf(btn)
        const left = cd.end - now
        if(left <= 0){
            skillCooldowns.delete(skillName)
            el.classList.remove("on")
            // ready again - a quick glint round the slot
            btn.classList.remove("skill-ready")
            void btn.offsetWidth
            btn.classList.add("skill-ready")
            return
        }
        el.classList.add("on")
        el.style.setProperty("--cd", (left / (cd.end - cd.start)).toFixed(4))
        // tenths under a second, whole seconds above - as Dota shows it
        el.firstChild.textContent = left < 1000 ? (left / 1000).toFixed(1) : String(Math.ceil(left / 1000))
    })
    // cooldowns of skills not in any slot still run out
    skillCooldowns.forEach((cd, name) => { if(cd.end <= now) skillCooldowns.delete(name) })
    if(skillCooldowns.size) cooldownFrame = requestAnimationFrame(drawCooldowns)
}
// a press while it's cooling down - the slot shakes and its timer flashes
function refuseOnCooldown(btn){
    const overlay = cooldownOverlayOf(btn)
    overlay.classList.remove("refuse")
    void overlay.offsetWidth
    overlay.classList.add("refuse")
}

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
        // resting (uimanagement.js's startResting/stopResting) - same gate
        // every raw movement input path and the walkrun-btns click handler
        // already check, extended here so skill casting is unreachable too
        if(!getCanPress()) return
        // dazed (charactersystem/stun.js) - no casting till it passes
        if(amIStunned()) return
        const socket = getSocket()
        const charState = getCharState()
        const skillName = btn.className.split(" ")[2]

        if(!skillName) return

        const skill = charState.skills.find(sk => sk.name === skillName)

        const willActivate = !skill.isActive

        // still cooling down (SKILL COOLDOWNS above) - nothing goes off, no
        // mana spent; a multicast cascade just skips this one
        if(willActivate && cooldownLeftMs(skill.name) > 0){
            refuseOnCooldown(btn)
            return
        }

        if(willActivate){
            // requireMode gates activation to a specific charState.mode (e.g.
            // singlecast needs "casting", see the cast button in
            // uimanagement.js) - a skill with no requireMode set has no gate
            if(skill.requireMode && charState.mode !== skill.requireMode){
                popStatusEffect(`must be ${skill.requireMode} to use this`, "yellow")
                return
            }

            // requiresWeapon (dashstrikeSkill and any future weapon skill,
            // skillsData.js) - a WEAPON skill needs an actual weapon in hand,
            // same rule the npcFighter side of this exact skill enforces too
            // (duelSystem.js's rollNearSkill checks hasDrawnWeapon)
            if(skill.requiresWeapon){
                const hasWeaponEquipped = charState.items.find(itm => itm.itemType === "weapon" && itm.equiped)
                if(!hasWeaponEquipped){
                    popStatusEffect("equip a weapon to use this", "yellow")
                    return
                }
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
        // every check passed and it's going off - its cooldown starts now
        if(willActivate) startCooldown(skill)

        // see cascadeActive's own comment above - only true while THIS
        // activation is happening as part of multicastSkill's cascade, so
        // skillEffects.js's computeCastOrigin knows whether to spread this
        // particular skill's spawn point out or leave it centered
        skill._castSpread = cascadeActive

        // what a weapon skill needs to look right on every screen (it rides the
        // relay with the skill, like _castPowerScale): the weapon swung (its
        // clip) and the form I'm in (a demon's wave is black and red)
        skill._castForm = charState.evolution?.evolutionName ?? null
        skill._castWeaponType = charState.items.find(itm => itm.itemType === "weapon" && itm.equiped)?.weaponType ?? null

        // casting a skill mid-mining should drop it same as walking away or unequipping
        if(charState.mode === "minning") setCharStateMode("idle")

        if(getIsSocketOn()){
            socket.emit("activate-skill", 
                {
                    ownerId: charState.owner, 
                    skill, 
                    currentPlaceId: charState.currentPlace.placeId,
                    casterStats: charState.stats,
                    // flexaura - how strong it looks on everyone else's screen
                    // (effects/auraProfile.js); tcp keeps it for late joiners
                    aura: skill.name === "flexaura" ? getMyAuraProfile() : undefined,
                })
        } else{
            activateSkill(charState.owner, skill, charState.stats)
        }

        // getSkillEffect(skill, "trigger") (multicast - see its own header
        // comment in skillsData.js) - fires no projectile of its own;
        // instead, now that its own mode/mana gate above already passed, it
        // programmatically .click()s every OTHER assigned skill-slot-button,
        // running each one through this EXACT same handler (mana check,
        // requireMode gate, multiplayer relay, its own reset timer below) as
        // if the player had pressed all of them. Only cascades on activation
        // (willActivate), never on the press that turns multicast back off,
        // and each triggered skill can still independently fail its OWN
        // mana/mode check (that skill just won't fire, the others still
        // will) - same graceful behavior a real manual press of each button
        // would have.
        if(willActivate && getSkillEffect(skill, "trigger")){
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

        if(willActivate && (getSkillEffect(skill, "offense") || getSkillEffect(skill, "trigger") || getSkillEffect(skill, "buff") || getSkillEffect(skill, "dash"))){
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

