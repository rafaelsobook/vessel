import { APIURL } from "../constants/constants.js"
import { startScene } from "../main/main.js"
import { keepAccountWithTokenDet, getCharDetFromDB } from "../constants/api.js"
import { checkIfTokenSaved } from "../tools/tools.js"
import { setLoading, hideHomePage } from "./mainpage.js"
const usernameInput = document.querySelector("#usernameInp")
const passwordInput = document.querySelector("#passwordInp")
const confirmInput = document.querySelector("#confirmpass")
const enterBtn = document.querySelector("#enterWorldBtn")

const msg = document.querySelector("#auth-msg")

export function formMessage(_infoMessage){
    msg.textContent = _infoMessage

    const homePage = document.querySelector(".home-page")
    homePage.classList.remove("hidden")
    formMessage("Server Error")
}
export function showLoginPage() {
    confirmInput.classList.add("hidden")
    setLoading(false)
    msg.textContent = ""
    usernameInput.value = ""
    passwordInput.value = ""
    confirmInput.value = ""
    usernameInput.focus()
}

export async function login() {
    const username = usernameInput.value.trim()
    const password = passwordInput.value

    if (!username || !password) { 
        setLoading(false)
        msg.textContent = "Fill in all fields."; return }

    setLoading(true)
    msg.textContent = ""

    try {
        const res = await fetch(`${APIURL}/users/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        })

        const data = await res.json()

        if (data === "norecord") {
            msg.textContent = "Invalid username or password."
            setLoading(false)
            return
        }
        console.log(data)
        keepAccountWithTokenDet(data)

        const charRes = await fetch(`${APIURL}/characters/${data.details._id}`, {
            headers: { authori: `Bearer ${data.token}` }
        })
        const charData = await charRes.json()

        const entered = await startScene(charData === "notfound")
        if (!entered) {
            msg.textContent = "Server error, try again."
            setLoading(false)
            return
        }
        hideHomePage()

    } catch (err) {
        msg.textContent = "Server error, try again."
        setLoading(false)
    }
}

export async function continueSession() {
    const saved = checkIfTokenSaved()
    console.log(saved.token)
    if (!saved) return showLoginPage()

    setLoading(true)
    msg.textContent = ""
    try {
        const charData = await getCharDetFromDB(saved)
        if(!charData){
            formMessage("Server Error")
            return showLoginPage()
        }
        const entered = await startScene(charData === "notfound")
        if (!entered) {
            msg.textContent = "Server error, try again."
            setLoading(false)
            return
        }
        hideHomePage()
    } catch (err) {
        msg.textContent = "Server error, try again."
        setLoading(false)
    }
}

