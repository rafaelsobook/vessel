// THE LOGIN / REGISTER PANEL'S OWN BEHAVIOUR (index.html's .login-register-form
// .gate, styled in style.scss): the eye that shows the password, the Caps Lock
// warning, the strength meter and the confirm check while registering, and how
// an error is shown. mainpage.js decides which mode the panel is in and what a
// submit does - this only knows about the fields, so it imports nothing from
// the other pages.
export const USERNAME_MIN = 3
export const PASSWORD_MIN = 6

const form = document.querySelector(".login-register-form")
const gate = form.querySelector(".gate")
const fieldsBox = form.querySelector(".auth-fields")
export const usernameInput = form.querySelector("#usernameInp")
export const passwordInput = form.querySelector("#passwordInp")
export const confirmInput = form.querySelector("#confirmpass")
const usernameLabel = form.querySelector('label[for="usernameInp"]')
const passwordLabel = form.querySelector('label[for="passwordInp"]')
const confirmField = confirmInput.closest(".field")
const revealBtn = form.querySelector(".reveal")
const capsWarn = form.querySelector(".caps-warn")
const strength = form.querySelector(".strength")
const strengthLabel = form.querySelector(".strength-label")
// the panel's own message and the play screen's - only one shows at a time
const messages = form.querySelectorAll(".page-msg")

const STRENGTH_WORDS = ["", "Weak", "Fair", "Good", "Strong"]
const fields = [usernameInput, passwordInput, confirmInput]

// a class whose animation runs again each time this is called
function replay(element, className){
    element.classList.remove(className)
    void element.offsetWidth
    element.classList.add(className)
}

/** 0 (nothing typed) to 4 - length, mixed case, digits with a symbol */
export function passwordStrength(password){
    if(!password) return 0
    let score = 0
    if(password.length >= PASSWORD_MIN) score++
    if(password.length >= 10) score++
    if(/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
    if(/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++
    return Math.max(1, score)
}

function clearInvalid(){
    fields.forEach(field => field.removeAttribute("aria-invalid"))
}

/** Shows `text` (the panel's message, or the play screen's), marks and focuses `field` if there is one, and shakes the panel */
export function showAuthError(text, field){
    clearInvalid()
    messages.forEach(message => { message.textContent = text })
    if(field){
        field.setAttribute("aria-invalid", "true")
        field.focus()
    }
    replay(gate, "shake")
}

export function clearAuthError(){
    messages.forEach(message => { message.textContent = "" })
    clearInvalid()
}

function updatePasswordHints(){
    const password = passwordInput.value
    const level = passwordStrength(password)
    strength.dataset.level = level
    strengthLabel.textContent = STRENGTH_WORDS[level]

    const confirm = confirmInput.value
    confirmField.classList.toggle("ok", !!confirm && confirm === password)
    // what's typed so far has to still be the start of the password
    if(confirm && !password.startsWith(confirm)) confirmInput.setAttribute("aria-invalid", "true")
    else confirmInput.removeAttribute("aria-invalid")
}

function setReveal(show){
    passwordInput.type = confirmInput.type = show ? "text" : "password"
    revealBtn.classList.toggle("on", show)
    revealBtn.setAttribute("aria-pressed", String(show))
    revealBtn.setAttribute("aria-label", show ? "Hide password" : "Show password")
}

/** The password fields emptied and hidden again, and the meters with them */
export function resetAuthFields(){
    passwordInput.value = ""
    confirmInput.value = ""
    setReveal(false)
    capsWarn.classList.remove("show")
    updatePasswordHints()
}

/** What the fields say and let the browser suggest for `mode` ("login" | "register" | "play"), and the fields rising in */
export function applyAuthMode(mode){
    const registering = mode === "register"
    usernameLabel.textContent = registering ? `Username · ${USERNAME_MIN}+ characters` : "Username"
    passwordLabel.textContent = registering ? `Password · ${PASSWORD_MIN}+ characters` : "Password"
    // new-password lets a password manager offer a strong one
    passwordInput.autocomplete = registering ? "new-password" : "current-password"
    replay(fieldsBox, "swap")
}

passwordInput.addEventListener("input", updatePasswordHints)
confirmInput.addEventListener("input", updatePasswordHints)
// typing in a field takes its red off
fields.forEach(field => field.addEventListener("input", () => {
    if(field !== confirmInput) field.removeAttribute("aria-invalid")
}))

// Caps Lock: the password fields only
for(const input of [passwordInput, confirmInput]){
    const check = event => capsWarn.classList.toggle("show", !!event.getModifierState?.("CapsLock"))
    input.addEventListener("keydown", check)
    input.addEventListener("keyup", check)
    input.addEventListener("blur", () => capsWarn.classList.remove("show"))
}

// the eye: pressing it mustn't take the focus off the field (a phone would lose its keyboard)
revealBtn.addEventListener("pointerdown", event => event.preventDefault())
revealBtn.addEventListener("click", () => setReveal(passwordInput.type === "password"))

gate.addEventListener("animationend", event => {
    if(event.target === gate && event.animationName === "hpShake") gate.classList.remove("shake")
})
