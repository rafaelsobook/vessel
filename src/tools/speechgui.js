import * as GUI from "@babylonjs/gui"
import { getSceneDet } from "../main/main.js"

// Babylon.js GUI equivalent of tools/rpgconv.js's Conversation class - same
// behavior (typewriter reveal, tap-next-to-skip-then-advance, per-line
// name/isLeft/btnName/imageDirectory, close + optional callback once the
// array runs out), just drawn with real GUI controls on an
// AdvancedDynamicTexture instead of plain DOM elements. rpgconv.js's own
// dialogue lives in the app-wide HTML overlay (conversations.js), which
// keeps working fine for NPC conversations; this one exists for dialogue
// that needs to live INSIDE a specific 3D scene's own GUI layer instead
// (e.g. tied to that scene's camera, disposed along with the scene rather
// than persisting across scene changes the way the HTML overlay does).
const TALKING_SPEED_DEFAULT = 100 // ms per revealed character, same default rpgconv.js uses

// isCenterAndNoBackground mode has no button to click, so it advances
// itself once a fully-revealed line has had time to be read - flat minimum
// so a one-word line doesn't blink past instantly, plus a per-character
// allowance so a long line gets proportionally longer to actually read
const AUTO_ADVANCE_MIN_MS = 1500
const AUTO_ADVANCE_MS_PER_CHAR = 40

// how far up from the very bottom of the screen isCenterAndNoBackground
// mode's text sits (Babylon GUI pixels, tracks actual render resolution the
// same way this whole file's other *InPixels values already do) - clears
// style.scss's own .skill-slots hotbar (top:93%, 100px tall) instead of
// overlapping it
const CENTER_MODE_BOTTOM_OFFSET = 170

class SpeechGUI {
    constructor(scene, talkingSpeed){
        this.scene = scene
        this.intervalForMessage = talkingSpeed || TALKING_SPEED_DEFAULT
        this.intervalGenerating = undefined
        this.autoAdvanceTimeout = undefined
        this.isCenterAndNoBackground = false
        this.proceedToNext = () => {}

        this.texture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("speechGUI", true, scene)
        // starts disabled to match this.container.isVisible = false below - a
        // SpeechGUI is constructed well before any dialogue actually runs, and
        // without this it would composite a fullscreen quad every frame from
        // construction until the first open() (see open/close for why the
        // layer, not just the container, is what has to be toggled)
        if(this.texture.layer) this.texture.layer.isEnabled = false

        this.container = new GUI.Rectangle("speech-container")
        this.container.width = "90%"
        this.container.heightInPixels = 140
        this.container.thickness = 2
        this.container.color = "#a7a7a7"
        this.container.cornerRadius = 8
        this.container.background = "#2d2c2c"
        this.container.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER
        this.container.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM
        this.container.topInPixels = -40
        this.container.zIndex = 10
        this.container.isVisible = false
        this.texture.addControl(this.container)

        this.text = new GUI.TextBlock("speech-text")
        this.text.color = "#f5f5f5"
        this.text.fontSize = 18
        this.text.textWrapping = true
        this.text.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
        this.text.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP
        this.text.paddingTopInPixels = 16
        this.text.paddingBottomInPixels = 16
        this.text.paddingRightInPixels = 16
        this.container.addControl(this.text)

        this.nextBtn = GUI.Button.CreateSimpleButton("speech-next-btn", "next")
        this.nextBtn.widthInPixels = 90
        this.nextBtn.heightInPixels = 34
        this.nextBtn.color = "#f5f5f5"
        this.nextBtn.background = "gray"
        this.nextBtn.cornerRadius = 5
        this.nextBtn.thickness = 1
        this.nextBtn.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT
        this.nextBtn.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM
        this.nextBtn.leftInPixels = -10
        this.nextBtn.topInPixels = 10
        this.container.addControl(this.nextBtn)
        this.nextBtn.onPointerUpObservable.add(() => this.proceedToNext())

        // sits OUTSIDE the text container (same as rpgconv.js's own
        // convCharacImg, a direct child of <body>, not .main-container) so
        // it can hang above/beside the box instead of being clipped by it
        this.charImg = new GUI.Image("speech-charac-img", null)
        this.charImg.widthInPixels = 240
        this.charImg.heightInPixels = 240
        this.charImg.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM
        this.charImg.isVisible = false
        this.texture.addControl(this.charImg)
    }

    // isCenterAndNoBackground - one person speaking, no back-and-forth to
    // manage: no rectangle box, no next button, text centered on screen
    // instead of docked bottom-left with room left for a speaker image.
    // Re-applied at the START of every startConversation() call (not baked
    // in once at construction) since the same cached instance/scene is
    // reused for both this mode and normal dialogue, call to call.
    applyPresentationMode(isCenterAndNoBackground){
        this.isCenterAndNoBackground = !!isCenterAndNoBackground
        if(this.isCenterAndNoBackground){
            this.container.background = "transparent"
            this.container.thickness = 0
            this.container.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM
            // style.scss's own .skill-slots sits at top:93%, 100px tall -
            // this clears its top edge with some breathing room instead of
            // overlapping the hotbar
            this.container.topInPixels = -CENTER_MODE_BOTTOM_OFFSET
            this.text.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER
            this.nextBtn.isVisible = false
            this.charImg.isVisible = false
        } else {
            this.container.background = "#2d2c2c"
            this.container.thickness = 2
            this.container.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM
            this.container.topInPixels = -40
            this.text.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
            this.nextBtn.isVisible = true
        }
    }

    show(message, isLeft, btnName){
        this.text.text = message
        if(this.isCenterAndNoBackground){
            this.text.paddingLeftInPixels = 16
            this.text.paddingRightInPixels = 16
            return
        }
        // leaves room for the speaker image on whichever side it's showing on -
        // same left:28%/12% split rpgconv.js's own convText.style.left does
        this.text.paddingLeftInPixels = isLeft ? 220 : 16
        if(this.nextBtn.textBlock) this.nextBtn.textBlock.text = btnName || "next"
    }

    // open/close also toggle the ADT's own Layer, not just the container.
    // CreateFullscreenUI attaches a core Layer alongside the texture, and
    // Layer.render()'s only early-out is `if (!this.isEnabled)` - it never
    // checks whether anything drawn on that texture is actually visible. With
    // container.isVisible:false alone, a fullscreen alpha-blended quad of an
    // empty texture still composites every frame and the canvas-sized RGBA
    // texture stays resident, for as long as the scene lives. Dialogue is
    // closed far more of the time than it's open, so this is the state that
    // matters. Same fix campcraft.js and playerListUI.js carry - see
    // openCloseCampcraftUI for the long version.
    open(){
        clearInterval(this.intervalGenerating)
        clearTimeout(this.autoAdvanceTimeout)
        this.container.isVisible = true
        if(this.texture?.layer) this.texture.layer.isEnabled = true
    }

    close(){
        clearInterval(this.intervalGenerating)
        clearTimeout(this.autoAdvanceTimeout)
        this.container.isVisible = false
        this.charImg.isVisible = false
        if(this.texture?.layer) this.texture.layer.isEnabled = false
    }

    setImageOfSpeaker(imageDirectory, isLeft){
        this.charImg.horizontalAlignment = isLeft
            ? GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
            : GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT
        if(imageDirectory){
            this.charImg.source = imageDirectory
            this.charImg.isVisible = true
        } else {
            this.charImg.isVisible = false
        }
    }

    startConversation(messages, startsInArrayOf, callback, isCenterAndNoBackground){
        this.open()
        this.applyPresentationMode(isCenterAndNoBackground)
        const line = messages[startsInArrayOf]
        // "speech" is this file's own field name (displaySpeech's own
        // [{speech:"..."}] shape) - "message" (rpgconv.js's own field name)
        // is also accepted, so speech data authored for either system works
        // verbatim in both
        const fullMessage = line.speech ?? line.message ?? ""
        const { isLeft, btnName, imageDirectory } = line
        if(!this.isCenterAndNoBackground) this.setImageOfSpeaker(imageDirectory, isLeft)

        let revealedCount = 0
        const messageChars = fullMessage.split("")
        const messageLength = messageChars.length
        let currentMessageArray = []

        const nextIndex = startsInArrayOf + 1
        const goToNextOrClose = () => {
            if(!messages[nextIndex]){
                this.close()
                if(callback) callback()
                return
            }
            this.startConversation(messages, nextIndex, callback, isCenterAndNoBackground)
        }

        clearInterval(this.intervalGenerating)
        clearTimeout(this.autoAdvanceTimeout)

        // reveal the first character synchronously instead of waiting for
        // the interval's own first tick (this.intervalForMessage ms later) -
        // otherwise whatever text was left on screen from a PREVIOUS call
        // stays visible for that one tick, reading as "flash the whole old
        // message, then it erases and retypes from the start" instead of
        // starting clean on the new line right away
        if(messageLength > 0){
            currentMessageArray.push(messageChars[0])
            revealedCount = 1
        }
        this.show(currentMessageArray.join(""), isLeft, btnName)

        this.intervalGenerating = setInterval(() => {
            if(revealedCount >= messageLength){
                clearInterval(this.intervalGenerating)
                // no button to click in this mode - schedule the advance
                // ourselves once the line has finished typing out, instead
                // of waiting on an interaction that has nowhere to happen
                if(this.isCenterAndNoBackground){
                    const readTime = Math.max(AUTO_ADVANCE_MIN_MS, messageLength * AUTO_ADVANCE_MS_PER_CHAR)
                    this.autoAdvanceTimeout = setTimeout(goToNextOrClose, readTime)
                }
                return
            }
            currentMessageArray.push(messageChars[revealedCount])
            this.show(currentMessageArray.join(""), isLeft, btnName)
            revealedCount++
        }, this.intervalForMessage)

        this.proceedToNext = () => {
            if(this.isCenterAndNoBackground) return // no button in this mode - nothing to proceed from a click
            // still typing - first press just finishes revealing the line
            // instantly instead of advancing, same as rpgconv.js
            if(revealedCount < messageLength){
                revealedCount = messageLength
                this.show(fullMessage, isLeft, btnName)
                return clearInterval(this.intervalGenerating)
            }
            goToNextOrClose()
        }
    }
}

// one instance per scene, lazily built + rebuilt across scene changes -
// same "don't survive a disposed scene silently" precedent campcraft.js's
// own getUITexture() already sets for a cached AdvancedDynamicTexture:
// changeScene() fully disposes the old Scene (and everything drawn on it)
// on every place transition, so a stale instance from before that has to be
// detected and rebuilt, not just reused as-is.
let speechGUIInstance = null
let speechGUIScene = null
function getSpeechGUI(scene, talkingSpeed){
    if(!speechGUIInstance || speechGUIScene !== scene){
        speechGUIInstance = new SpeechGUI(scene, talkingSpeed)
        speechGUIScene = scene
    }
    return speechGUIInstance
}

// displaySpeech([{ speech: "hello, world" }]) - same call shape as
// conversations.js's own startConv(speechesArray, cb). Each entry can also
// carry name/isLeft/btnName/imageDirectory, same fields tools/rpgconv.js's
// own Conversation.startConversation reads. Grabs the currently active
// scene itself (getSceneDet()) rather than taking one as a parameter, so
// callers can stay exactly this simple.
//
// isCenterAndNoBackground:true - single-speaker/narrator presentation
// instead of a two-person dialogue box: no rectangle background, no next
// button, text centered on screen. Since there's nothing to click, each
// line auto-advances once it's finished typing and had time to be read
// (see this file's own AUTO_ADVANCE_MIN_MS/AUTO_ADVANCE_MS_PER_CHAR).
export function displaySpeech(speechesArray, cb, talkingSpeed, isCenterAndNoBackground){
    const { scene } = getSceneDet()
    if(!scene) return console.warn("[speechgui] displaySpeech called with no active scene")
    if(!speechesArray?.length) return console.warn("[speechgui] displaySpeech called with an empty array")

    const gui = getSpeechGUI(scene, talkingSpeed)
    gui.startConversation(speechesArray, 0, cb, isCenterAndNoBackground)
}
