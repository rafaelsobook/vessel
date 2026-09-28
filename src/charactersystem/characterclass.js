import { Mesh, Animation } from "@babylonjs/core"
import * as GUI from "@babylonjs/gui"
import { getCharState } from "./characterstate"
import { getSceneDet } from "../main/main.js"
import { getPlayersOnScene } from "../sockets/worldsocket.js"
import { capsuleHeight } from "./createcharacter.js"
import { getAllSounds } from "../components/soundSystem.js"

let swordSwing = 0
let spearSwing = 0
let axeSwing = 0
let hammerSwing = 0
let fistattacks = 0
let castMagic = 0

let maxSwingToLevelUp = 2
let maxCastToLevel = 2

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

export function triggerClassLeveling(_weaponType){

    const charState = getCharState()
    switch(_weaponType){
        case "sword":
            swordSwing++
            if(swordSwing >= (maxSwingToLevelUp+(charState.characterclass.warbringer.lvl*5))) {
                swordSwing = 0
                charState.characterclass.warbringer.lvl++
                showClassLevelUpGUI("warbringer", charState.characterclass.warbringer.lvl)
            }
        break
        case "axe":
            axeSwing++
            if(axeSwing >= (maxSwingToLevelUp+(charState.characterclass.viking.lvl*5))) {
                axeSwing = 0
                charState.characterclass.viking.lvl++
                showClassLevelUpGUI("viking", charState.characterclass.viking.lvl)
            }
        break
        case "spear":
            spearSwing++
            if(spearSwing >= (maxSwingToLevelUp+(charState.characterclass.paladin.lvl*5))) {
                spearSwing = 0
                charState.characterclass.paladin.lvl++
                showClassLevelUpGUI("paladin", charState.characterclass.paladin.lvl)
            }
                console.log("triggering ", _weaponType)
                console.log(spearSwing)
                console.log((maxSwingToLevelUp+(charState.characterclass.warhammer.lvl*5)))
        break

        case "hammer":
            hammerSwing++
            if(hammerSwing >= (maxSwingToLevelUp+(charState.characterclass.runecaller.lvl*5))) {
                hammerSwing = 0
                charState.characterclass.warbringer.lvl++
                showClassLevelUpGUI("warhammer", charState.characterclass.warhammer.lvl)
            }
        break
        case "cast":
            castMagic++
            if(castMagic >= (maxSwingToLevelUp+(charState.characterclass.berserker.lvl*5))) {
                castMagic = 0
                charState.characterclass.runecaller.lvl++
                showClassLevelUpGUI("runecaller", charState.characterclass.runecaller.lvl)
            }
        break
        case "fist":
            fistattacks++
            if(axeSwing >= maxCastToLevel) {
                fistattacks = 0
                charState.characterclass.berserker.lvl++
                showClassLevelUpGUI("berserker", charState.characterclass.berserker.lvl)
            }
        break
    }
}
