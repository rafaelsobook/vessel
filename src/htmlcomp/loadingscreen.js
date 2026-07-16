import { createElement } from "../tools/tools.js"

let textTimeout = null
let fadeTimeout = null

export function showLoadingScreen(arrayOfText = ["Hello", "You dare challenge me"], fadeAfterSeconds = 5000, onComplete = null) {
    const loadingScreen = document.querySelector(".intro-load-screen")
    const loadingImg = document.querySelector(".loading-img")
    let caption = document.querySelector(".ils-cap")

    loadingScreen.style.display = "flex"
    loadingScreen.style.backgroundColor = "black"
    loadingScreen.classList.remove("screenFadeOff")
    loadingImg.classList.add("hidden")

    clearTimeout(textTimeout)

    // Swap in a fresh <p> per word instead of toggling "opening-closing" on
    // one reused node. The old version's fade-out leaned on .ils-cap's 3s
    // CSS transition while only waiting 1s in JS before changing the text,
    // so it kept yanking the transition mid-flight. A new node each time
    // guarantees the fade-in keyframe always plays clean from opacity 0.
    function showWord(i) {
        const nextCaption = createElement("p", "ils-cap opening-closing", arrayOfText[i])
        caption.replaceWith(nextCaption)
        caption = nextCaption

        if (i >= arrayOfText.length - 1) return
        textTimeout = setTimeout(() => showWord(i + 1), 3000)
    }
    showWord(0)

    clearTimeout(fadeTimeout)
    fadeTimeout = setTimeout(() => {
        clearTimeout(textTimeout)
        loadingScreen.classList.add("screenFadeOff")
        setTimeout(() => {
            loadingScreen.style.display = "none"
            if (onComplete) onComplete()
        }, 1000)
    }, fadeAfterSeconds)
}
