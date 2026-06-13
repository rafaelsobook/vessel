const popupStyle1 = document.querySelector(".popstyle1")

const mainLoadingScreen = document.querySelector(".loading-screen")
const loadingImg = document.querySelector(".lc-img")
const loadingPercent = document.querySelector(".ls-percent")
const loadingTipsLabel = document.querySelector(".ls-tips")
const miniLoading = document.querySelector(".mini-loading")

// status effects pop ups
const statusList = document.querySelector(".status-effects-list")
const interactBtn = document.getElementById("interactBtn")
let interactBtnActivated = false

let callbackAfterClicked = () => {}

// Activation
export function activateInteractBtn(){
    if(interactBtnActivated) return
    interactBtn.addEventListener("click", () => callbackAfterClicked())
    interactBtnActivated = true
}

export function openCloseInteractBtn(_iconImg, isVisible, _callbackAfterClicked) {
    if(!interactBtnActivated) activateInteractBtn()
    
    //_iconImg is if ever we want a different icon to display when it interact with different door or passage etc
    interactBtn.style.display = isVisible ? "block" : "none"
    callbackAfterClicked = _callbackAfterClicked
}

export function openClosePopup(_popMessage, willOpen, timeOut, cb){
    const label = popupStyle1.childNodes[0]
    label.innerHTML = _popMessage; 

    willOpen ? popupStyle1.classList.remove("popup-close") : popupStyle1.classList.add("popup-close")

    timeOut && setTimeout(() =>{
        popupStyle1.classList.add("popup-close")
        cb && cb()
    }, timeOut)
}
export function closeAnswerButtons () {
    const answersList = document.querySelector(".answers-list")
    answersList.innerHTML = ""
    answersList.style.display = "none"
}
export function showAnswerButtons(choices, cb){
    const answersList = document.querySelector(".answers-list")
    answersList.innerHTML = ""
    answersList.style.display = "flex"

    choices.forEach( (choice, indx) => {
        const btn = document.createElement("button")
        btn.classList.add("answer-btn")
        btn.innerHTML = choice.text
        btn.addEventListener("click", () => {
            cb(indx)
            closeAnswerButtons()
        })
        answersList.appendChild(btn)
    })
}

export function openCloseLScreen(loadType, willOpen, timeOut){
    if(willOpen){
        mainLoadingScreen.style.display="flex"
        mainLoadingScreen.classList.remove("screenFadeOff")
        loadingPercent.innerHTML = "0%"
        loadingTipsLabel.innerHTML = 'Creating Environment'
    }else{
        mainLoadingScreen.classList.add("screenFadeOff")
        setTimeout(()=> mainLoadingScreen.style.display="none",800)
    }
    timeOut && setTimeout(() =>{
        mainLoadingScreen.classList.add("screenFadeOff")
        setTimeout(()=> mainLoadingScreen.style.display="none",1000)
    }, timeOut)
}
export function openCloseMiniLS(label, willOpen, timeOut){
    if(label) miniLoading.innerHTML = label
    if(willOpen){
        miniLoading.style.display="flex"
        miniLoading.classList.remove("screenFadeOff")
    }else{
        miniLoading.classList.add("screenFadeOff")
        setTimeout(()=> miniLoading.style.display="none",800)
    }
    timeOut && setTimeout(() =>{
        miniLoading.classList.add("screenFadeOff")
        setTimeout(()=> miniLoading.style.display="none",1000)
    }, timeOut)
}

// pop ups
let deleteAllListTimeout
export function popStatusEffect(_effectName, _labelColor){
    const elem = document.createElement('p')
    elem.className='status-label'
    elem.innerHTML = _effectName
    elem.style.color=_labelColor

    statusList.innerHTML=''
    statusList.append(elem)
    statusList.style.display="block"
    clearTimeout(deleteAllListTimeout)
    deleteAllListTimeout = setTimeout(()=> {
        statusList.innerHTML=''
        statusList.style.display="none"
    }, 2000)
}