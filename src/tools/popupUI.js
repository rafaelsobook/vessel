import { clearLocTimeOut } from "../controllers/inputMovement"
import { createElement } from "./tools"
import { skillsData } from "../staticRecources/skillsData.js"

const popupStyle1 = document.querySelector(".popstyle1")

const mainLoadingScreen = document.querySelector(".loading-screen")
const loadingImg = document.querySelector(".lc-img")
const loadingPercent = document.querySelector(".ls-percent")
const loadingTipsLabel = document.querySelector(".ls-tips")
const miniLoading = document.querySelector(".mini-loading")

// status effects pop ups
const statusList = document.querySelector(".status-effects-list")
const interactBtn = document.getElementById("interactBtn")
const interactBtnImg = interactBtn.querySelector(".iteract-img")
let interactBtnActivated = false

let callbackAfterClicked = () => {}

// Activation
export function activateInteractBtn(){
    if(interactBtnActivated) return
    interactBtn.addEventListener("click", () => callbackAfterClicked())
    interactBtnActivated = true
}

export function openCloseInteractBtn(_iconImg = "normal", isVisible, _callbackAfterClicked) {
    if(!interactBtnActivated) activateInteractBtn()
    
    if(_iconImg) interactBtnImg.src = `./images/UI/${_iconImg}.webp`
    //_iconImg is if ever we want a different icon to display when it interact with different door or passage etc
    interactBtn.style.display = isVisible ? "block" : "none"
    callbackAfterClicked = _callbackAfterClicked
    if(isVisible) clearLocTimeOut()
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
        const borderimg = createElement("img", "answer-border")
        borderimg.src = "./images/UI/frames/answerborder.webp"
        btn.classList.add("answer-btn")
        btn.innerHTML = choice.text
        btn.addEventListener("click", () => {
            cb(indx)
            closeAnswerButtons()
        })
        btn.appendChild(borderimg)
        answersList.appendChild(btn)        
    })
}

// cycles the loading screen's icon+caption through a random skill every 6s
// so there's actually something to read while a scene loads, instead of the
// old hardcoded "Creating Environment" caption paired with a hardcoded
// ./images/items/crafting/bronzecore.webp image (a typo - the real file is
// bronzeore.webp - that's why it always rendered as a broken image icon).
// skill.name is the same key skillsui.js's own skill bar icons resolve
// through (./images/skills/${skill.name}.webp), so this reuses assets that
// are already known-good rather than pointing at anything new.
let loadingTipInterval = null
let lastSkillTipIndex = -1

function showRandomSkillTip(){
    if(!skillsData.length) return

    // avoid immediately repeating the same skill twice in a row when
    // there's more than one to pick from
    let index = Math.floor(Math.random() * skillsData.length)
    if(skillsData.length > 1 && index === lastSkillTipIndex){
        index = (index + 1) % skillsData.length
    }
    lastSkillTipIndex = index

    const skill = skillsData[index]

    // brief crossfade instead of a hard jump-cut when the tip swaps -
    // .lc-img/.ls-tips both carry a matching opacity transition (style.css)
    loadingImg.style.opacity = 0
    loadingTipsLabel.style.opacity = 0
    setTimeout(() => {
        loadingImg.src = `./images/skills/${skill.name}.webp`
        loadingImg.alt = skill.displayName ?? skill.name
        loadingTipsLabel.innerHTML = `<strong>${skill.displayName ?? skill.name}</strong> - ${skill.desc ?? ''}`
        loadingImg.style.opacity = 1
        loadingTipsLabel.style.opacity = 1
    }, 300)
}

export function openCloseLScreen(willOpen, timeOut){
    if(willOpen){
        mainLoadingScreen.style.display="flex"
        mainLoadingScreen.classList.remove("screenFadeOff")
        loadingPercent.innerHTML = "0%"

        showRandomSkillTip()
        clearInterval(loadingTipInterval)
        loadingTipInterval = setInterval(showRandomSkillTip, 6000)
    }else{
        mainLoadingScreen.classList.add("screenFadeOff")
        setTimeout(()=> mainLoadingScreen.style.display="none",800)
        clearInterval(loadingTipInterval)
        loadingTipInterval = null
    }
    timeOut && setTimeout(() =>{
        mainLoadingScreen.classList.add("screenFadeOff")
        setTimeout(()=> mainLoadingScreen.style.display="none",1000)
        clearInterval(loadingTipInterval)
        loadingTipInterval = null
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