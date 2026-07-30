import { APIURL } from "../constants/constants.js"
import { startScene } from "../main/main.js"
import { keepAccountWithTokenDet, getCharDetFromDB } from "../constants/api.js"
import { checkIfTokenSaved } from "../tools/tools.js"
import { setLoading, hideHomePage } from "./mainpage.js"
import { ADVENTURER_COLORS } from "../constants/adventurerColors.js"
import { SKIN_COLORS } from "../constants/skinColors.js"

const TRIAL_USERNAME = "trial_player"
const TRIAL_PASSWORD = "trial_password_123"
const TRIAL_CHAR_NAME = "TrialHero"

const trialAppearance = {
    hairColor: ADVENTURER_COLORS.black,
    clothColor: ADVENTURER_COLORS.tan,
    pantsColor: ADVENTURER_COLORS.darkBrown,
    skinColor: SKIN_COLORS.light,
    cloth: "style1",
    pants: "style1",
    hair: "style1",
    boots: "style1",
}

const msg = document.querySelector("#auth-msg")

async function signInTrialAccount() {
    const loginRes = await fetch(`${APIURL}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: TRIAL_USERNAME, password: TRIAL_PASSWORD })
    })
    const loginData = await loginRes.json()
    if (loginData !== "norecord") return loginData

    const registerRes = await fetch(`${APIURL}/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: TRIAL_USERNAME, password: TRIAL_PASSWORD })
    })
    return registerRes.json()
}

async function createTrialCharacter(accountDet) {
    const res = await fetch(`${APIURL}/characters/save`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            authori: `Bearer ${accountDet.token}`
        },
        body: JSON.stringify({
            owner: accountDet.details._id,
            name: TRIAL_CHAR_NAME,
            ...trialAppearance
        })
    })
    return res.json()
}

export async function enterTrialMode() {
    setLoading(true)
    if (msg) msg.textContent = ""

    try {
        let accountDet = checkIfTokenSaved()
        if (!accountDet || !accountDet.token) {
            const authData = await signInTrialAccount()
            keepAccountWithTokenDet(authData)
            accountDet = authData
        }

        let charData = await getCharDetFromDB(accountDet)
        if (charData === "notfound") {
            charData = await createTrialCharacter(accountDet)
        }

        const entered = await startScene(false)
        if (!entered) {
            if (msg) msg.textContent = "Server error, try again."
            setLoading(false)
            return
        }
        hideHomePage()
    } catch (err) {
        console.error(err)
        if (msg) msg.textContent = "Trial mode failed, is the local server running?"
        setLoading(false)
    }
}
