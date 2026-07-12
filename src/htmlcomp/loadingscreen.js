let textInterval = null
let fadeTimeout = null

export function showLoadingScreen(arrayOfText = ["Hello", "You dare challenge me"], fadeAfterSeconds = 5000, onComplete = null) {
    const loadingScreen = document.querySelector(".intro-load-screen")
    const caption = document.querySelector(".ils-cap")
    const loadingImg = document.querySelector(".loading-img")
    loadingScreen.style.display = "flex"
    loadingScreen.style.backgroundColor = "black"
    loadingScreen.classList.remove("screenFadeOff")
    loadingImg.classList.add("hidden")

    let i = 0
    caption.textContent = arrayOfText[i]
    caption.style.opacity = 1

    clearInterval(textInterval)
    textInterval = setInterval(() => {
        if (i >= arrayOfText.length - 1) {
            clearInterval(textInterval)
            return
        }
        caption.style.opacity = 0
        setTimeout(() => {
            i++
            caption.textContent = arrayOfText[i]
            caption.style.opacity = 1
        }, 1000) // matches .ils-cap's opacity transition duration in style.scss
    }, 3000)

    clearTimeout(fadeTimeout)
    fadeTimeout = setTimeout(() => {
        clearInterval(textInterval)
        loadingScreen.classList.add("screenFadeOff")
        setTimeout(() => {
            loadingScreen.style.display = "none"
            if (onComplete) onComplete()
        }, 1000)
    }, fadeAfterSeconds)
}
