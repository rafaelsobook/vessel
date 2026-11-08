import { Mesh, Animation } from "@babylonjs/core"
import * as GUI from "@babylonjs/gui"
import { getCharState, updateMyDetailsOL } from "./characterstate"
import { getSceneDet } from "../main/main.js"
import { getPlayersOnScene } from "../sockets/worldsocket.js"
import { capsuleHeight } from "./createcharacter.js"
import { getAllSounds } from "../components/soundSystem.js"
import { checkIfTokenSaved } from "../tools/tools.js"
import { getSkillEffect } from "../staticRecources/skillsData.js"

// COMBAT CLASSES - charState.characterclass: one entry per class, { experties,
// lvl, progress }, each levelled on its own just by doing what it's for:
//   warbringer   swinging a sword           paladin     swinging a spear
//   viking       swinging an axe or pickaxe warhammer   swinging a hammer
//   berserker    punching bare-handed       runecaller  swinging a staff, or casting any spell
//   necromancer  casting a dark spell
// (duskrunner is in the schema but nothing trains it - the pickaxe is Viking's.)
// uimanagement.js's attack button calls triggerClassLeveling on every swing,
// attackingSystem.js's activateSkill calls triggerSpellClassLeveling on every
// spell I cast. Nothing has to be hit: a swing is a swing.
//
// `progress` is how far into the current level a class is - swings or casts.
// It fills to SWINGS_PER_LEVEL - the same at every level, whatever the class is
// at - then the class levels up and it starts over. It lives on the class
// entry, so it's saved with it: characterstate.js's vitals autosave sends the
// classes whenever they change, and a level-up is saved at once.
const SWINGS_PER_LEVEL = 122

// weaponType -> the class it trains, and whose lvl adds onto that weapon's
// damage (read by attackingSystem.js's calcDmg). pickaxe shares viking with
// axe since uimanagement.js already aliases it to "axe" before
// triggerClassLeveling sees it - the class a pickaxe swing levels is the same
// one that boosts it. "fist" is no weapon: bare hands.
const CLASS_OF_WEAPON = {
    sword: "warbringer",
    spear: "paladin",
    axe: "viking",
    pickaxe: "viking",
    hammer: "warhammer",
    staff: "runecaller",
    fist: "berserker",
}
// the spells' classes: dark ones train the Necromancer, every other spell the Runecaller
const SPELL_CLASS = "runecaller"
const DARK_SPELL_CLASS = "necromancer"
// charDetM.js's `experties` for each, to make a class entry the server didn't send
const EXPERTISE = {
    warbringer: "sword",
    paladin: "spear",
    viking: "axe",
    warhammer: "hammer",
    berserker: "fist",
    runecaller: "staff",
    necromancer: "summoner",
    duskrunner: "pickaxe",
}
// flat damage per class lvl - half of what one spent stats.weapon point gives
// (x10 in calcDmg), since class levels come free from just swinging
const CLASS_DMG_PER_LVL = 5

export function getClassDmgBonus(charState, weaponType){
    const className = CLASS_OF_WEAPON[weaponType]
    if(!className) return 0
    return (charState.characterclass?.[className]?.lvl ?? 0) * CLASS_DMG_PER_LVL
}

// Same nine-patch trick campcraft.js's own createNinePatchBg uses - stretches
// only the frame's flat middle, leaving skillbox.webp's painted border/corner
// art at native size instead of smearing it.
function createNinePatchBg(name, imgPath, sliceInset){
    const img = new GUI.Image(name, imgPath)
    img.stretch = GUI.Image.STRETCH_NINE_PATCH
    img.sliceLeft = sliceInset
    img.sliceTop = sliceInset
    img.width = "100%"
    img.height = "100%"
    img.onImageLoadedObservable.add(() => {
        img.sliceRight = img.imageWidth - sliceInset
        img.sliceBottom = img.imageHeight - sliceInset
    })
    return img
}

// Floats a gold rectangle GUI above the local player's own head announcing a
// class level-up - replaces the old openClosePopup() bottom-of-screen text
// for this specific event. Parented to the player's own body mesh using the
// same billboard-plane + AdvancedDynamicTexture pattern GUITools.js's
// poppingTextMesh/createHpBar and textmesh.js's createTextMesh already use
// for nameplates/hp bars/floating text, so it reads as coming from the
// character rather than the UI chrome.
function showClassLevelUpGUI(className, lvl){
    const charState = getCharState()
    const scene = getSceneDet()?.scene
    const myPlayer = getPlayersOnScene().find(pl => pl.owner === charState.owner)
    if(!scene || !myPlayer?.body) return

    getAllSounds().notif1S?.play()

    const plane = Mesh.CreatePlane("classLevelUpPlane", 6, scene)
    plane.isPickable = false
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL
    plane.parent = myPlayer.body
    // starts a bit above the nameMesh (parented at capsuleHeight in
    // createcharacter.js) so the two never overlap
    plane.position.set(0, capsuleHeight + 1, 0)

    const texture = GUI.AdvancedDynamicTexture.CreateForMesh(plane)

    const rect = new GUI.Rectangle("classLevelUpRect")
    rect.width = "560px"
    rect.height = "200px"
    rect.thickness = 0
    rect.alpha = 0
    texture.addControl(rect)

    rect.addControl(createNinePatchBg("classLevelUpBg", "./images/UI/frames/skillbox.webp", 24))

    const panel = new GUI.StackPanel()
    rect.addControl(panel)

    const header = new GUI.TextBlock()
    header.text = "CLASS LEVEL UP"
    header.color = "#ffd76a"
    header.fontSize = 20
    header.fontStyle = "bold"
    header.height = "32px"
    panel.addControl(header)

    const label = new GUI.TextBlock()
    label.text = `${className} reached level ${lvl}`
    label.color = "#ffe9b3"
    label.fontSize = 30
    label.height = "50px"
    label.textWrapping = true
    panel.addControl(label)

    const fadeAnim = new Animation("classLevelUpFade", "alpha", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT)
    fadeAnim.setKeys([
        {frame: 0, value: 0},
        {frame: 10, value: 1},
        {frame: 60, value: 1},
        {frame: 75, value: 0},
    ])

    const floatAnim = new Animation("classLevelUpFloat", "position.y", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT)
    floatAnim.setKeys([
        {frame: 0, value: capsuleHeight + 1},
        {frame: 75, value: capsuleHeight + 1.8},
    ])
    plane.animations = [floatAnim]
    scene.beginAnimation(plane, 0, 75, false)

    scene.beginDirectAnimation(rect, [fadeAnim], 0, 75, false, 1, () => {
        plane.dispose()
        texture.dispose()
    })
}

// the class's entry on the character - made when it has none yet (an older
// character, or one the server sent without it), so a missing class can't
// take a swing down
function classOf(charState, className){
    charState.characterclass ??= {}
    return charState.characterclass[className] ??= { experties: EXPERTISE[className], lvl: 0, progress: 0 }
}

function trainClass(className){
    const charState = getCharState()
    if(!charState) return
    const cls = classOf(charState, className)
    cls.lvl ??= 0
    cls.progress = (cls.progress ?? 0) + 1
    if(cls.progress < SWINGS_PER_LEVEL) return
    cls.progress = 0
    cls.lvl++
    showClassLevelUpGUI(className, cls.lvl)
    // saved now, not left for the next full save (an item picked up, a
    // character level-up...)
    updateMyDetailsOL(charState, checkIfTokenSaved())
}

/**
 * A swing with `weaponType` in hand - "fist" bare-handed. Every swing that
 * spends the stamina for it (uimanagement.js's attack button), hit or not.
 */
export function triggerClassLeveling(weaponType){
    const className = CLASS_OF_WEAPON[weaponType]
    if(className) trainClass(className)
}

// what counts as a spell: anything that damages, heals, cures or shields, or
// an elemental buff (mjolnir). Not the weapon strikes (dashstrike, blinkstrike),
// not multicast (it casts the others, which count themselves), not the flex aura.
const SPELL_EFFECTS = ["offense", "heal", "cure", "barrier"]
function isSpell(skill){
    if(SPELL_EFFECTS.some(effectType => getSkillEffect(skill, effectType))) return true
    return !!getSkillEffect(skill, "buff") && !!skill.element && skill.element !== "normal"
}

/**
 * I cast `skill` (attackingSystem.js's activateSkill, my own casts only).
 */
export function triggerSpellClassLeveling(skill){
    // a swing that throws a wave (crescenthowl) trains the weapon's class, not a caster's
    if(skill.weaponSwing) return triggerClassLeveling(skill._castWeaponType)
    if(!isSpell(skill)) return
    trainClass(skill.element === "dark" ? DARK_SPELL_CLASS : SPELL_CLASS)
}
