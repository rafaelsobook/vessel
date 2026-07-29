// Lets the player set what % of their mana/stamina pool a skill or action
// should draw from. Purely a session-local UI preference, not persisted
// character data, so it lives here instead of in characterState.

const outputSlidersCont = document.querySelector(".output-sliders-cont")
const manaSlider = document.querySelector(".mana-output-slider")
const staminaSlider = document.querySelector(".stamina-output-slider")
const manaValueLabel = document.querySelector(".mana-output-value")
const staminaValueLabel = document.querySelector(".stamina-output-value")

const MANA_FILL_COLOR = "rgba(50, 80, 210, 0.85)"
const STAMINA_FILL_COLOR = "rgba(220, 220, 0, 0.85)"

let manaOutputPercent = 100
let staminaOutputPercent = 100
let outputSlidersInitiated = false

function paintSliderFill(slider, percent, fillColor){
    if(!slider) return
    slider.style.background = `linear-gradient(90deg, ${fillColor} ${percent}%, rgba(0, 0, 0, 0.5) ${percent}%)`
}

export function getManaOutputPercent(){
    return manaOutputPercent
}
export function getStaminaOutputPercent(){
    return staminaOutputPercent
}

export function initOnceOutputSliders(){
    if(outputSlidersInitiated) return
    if(!manaSlider || !staminaSlider) return

    paintSliderFill(manaSlider, manaOutputPercent, MANA_FILL_COLOR)
    paintSliderFill(staminaSlider, staminaOutputPercent, STAMINA_FILL_COLOR)

    manaSlider.addEventListener("input", () => {
        manaOutputPercent = Number(manaSlider.value)
        if(manaValueLabel) manaValueLabel.innerHTML = `${manaOutputPercent}%`
        paintSliderFill(manaSlider, manaOutputPercent, MANA_FILL_COLOR)
    })
    staminaSlider.addEventListener("input", () => {
        staminaOutputPercent = Number(staminaSlider.value)
        if(staminaValueLabel) staminaValueLabel.innerHTML = `${staminaOutputPercent}%`
        paintSliderFill(staminaSlider, staminaOutputPercent, STAMINA_FILL_COLOR)
    })

    outputSlidersInitiated = true
}

export function showHideOutputSliders(display){
    if(!outputSlidersCont) return
    outputSlidersCont.style.display = display
}

export function toggleDisableOutputSliders(enable){
    if(!outputSlidersCont) return
    outputSlidersCont.classList.toggle("disabled", !enable)
}
