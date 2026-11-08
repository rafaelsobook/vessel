import { say, ask, line, startQuest, isActive, isCleared, hasFlag, setFlag, fetchQuest, turnIn, giveRewards, coins } from "./kit.js"
import { startQuestionare } from "../components/conversations.js"
import { heroesDescendantTitle } from "../staticRecources/titlesData.js"
import { jerky } from "./fare.js"

// STRONG - the market guard who can't talk to Mira. His own chain (npcDetails.js's
// strong-secret-1 / strong-pest-hunt) and Vordz's (vordz-intel-1/2) get him as
// far as flowers on her counter. This is the rest: a dinner he can't cook, and
// once it's gone well, why a man like him guards a fruit stall at all - he was
// the Lantern of Ashvale, until something rose out of the dark land he couldn't
// imagine beating. Hear it the right way and he gives you the Lantern's secret:
// the Heroes Descendant title, +8% critical strike chance (titlesData.js).
//
// A guard pays like one: the dinner (an errand, tier 1) is paid in a guard's wage
// and his rations; the secret is the real reward - he only tells it to someone
// who's earned the telling, three quests deep.
const NAME = "Strong"
const ID = "104_strong"
const B = 1000
const S = messages => say(NAME, messages)
const SECRET = "side:strong-secret"

const DINNER = fetchQuest({
    qName: "strong-dinner",
    qTtle: "A Proper Evening",
    desc: "Mira said yes to dinner, and Strong can't cook. Bring 6 Grain for Tobbin's bread (it grows along the inside of the village wall) and 3 Ember Caps - the orange caps of the wilds and the cave - for frying.",
    items: [["grain", "Grain", 6], ["orange", "Ember Cap", 3]],
})

export default {
    npcId: ID,
    // after his and Vordz's own chains - before that, his menu already is the story
    option(){
        if(!isCleared("strong-pest-hunt") || !isCleared("vordz-intel-2")) return null
        if(isActive(DINNER.qName)) return null
        if(!isCleared(DINNER.qName)) return ["About Mira and those flowers...", B]
        if(!hasFlag(SECRET)) return ["How did the evening go?", B + 3]
        return ["Thank you for the secret, Strong.", B + 8]
    },
    questions: () => [
        ask(B, S([
            "You'll never believe it. The flowers worked. Vordz thinks I don't know that was him. I know it was him.",
            "She said yes. To dinner. Tomorrow evening. With me. Dinner.",
            "...I can't cook. I can split a slime at forty paces and I can't boil water without setting it on fire.",
            "Tobbin at the tavern says he'll bake fresh bread if somebody brings him the grain. And Mira loves ember caps, fried - she told the whole market once. I was listening. Very casually.",
            "Six bundles of grain, three ember caps. The wheat grows along the inside of the village wall. The caps grow out past the gate, and down in the cave.",
        ]), [
            ["I'll bring them.", () => { startQuest(DINNER); startQuestionare(B + 1) }],
            ["Cook it yourself, hero.", B + 2],
        ]),
        line(B + 1, S(["You're a lifesaver. Possibly literally. If this goes badly, I may not survive it."])),
        line(B + 2, S(["...Fair. Fair. I'll just... figure it out. Somehow. Probably with a fire."])),

        ask(B + 3, S([
            "It went... it went well. She laughed at the ogre story. Twice.",
            "Then she asked me why a man like me guards a fruit market. Nobody's ever asked me that.",
            "I told her. First time in nine years.",
            "...You want to hear it too? You've earned it, I suppose.",
        ]), [
            ["I'd like to hear it.", B + 4],
            ["Some other time.", B + 9],
        ]),
        ask(B + 4, S([
            "Before this gate, I was the Lantern of Ashvale. Vanguard of the old Order - twelve of us, sworn to walk where the land turns dark and bring back whoever wandered in.",
            "We found the edge of it. The trees go grey first. Then the grass. Then the light itself thins, like water through cloth.",
            "And something stood up out of that dark. Not a beast. I don't have a word for it. It was taller than the ridge, and it didn't hunt us. It just... noticed us.",
            "That was enough. Eight of the twelve died in the noticing. I grabbed the four nearest me and ran until my legs quit.",
        ]), [
            ["You carried four people out of that. That isn't losing.", B + 5],
            ["What was it?", B + 7],
            ["So the great hero ran away.", B + 6],
        ]),
        line(B + 5, S([
            "...Nobody's ever put it that way.",
            "I hung up the Lantern after that. Took the smallest post I could find - a market gate - because the small things, I could actually keep.",
            "But you've got the look. So here's the secret. The real one, the one the Order never wrote down.",
            "Strength isn't in the arm. It's in who stands behind you. Swing like the one at your back is counting on it.",
            "And don't hit the wall. Find where they're already bending - the open flank, the slow recovery, the moment after their swing - and strike there. Every blow I ever landed that mattered was aimed at a weakness.",
            "Carry that, and you're the Lantern's heir now. It isn't mine to give. I'm giving it anyway.",
        ]), () => { setFlag(SECRET); giveRewards({ title: heroesDescendantTitle }) }),
        line(B + 6, S(["...Yeah. Maybe I did.", "Market won't watch itself. Go on."])),
        ask(B + 7, S([
            "If I knew what it was, I'd sleep better.",
            "The stones at the crossroads talk about four beasts at the edges of the world. Whatever we met, it wasn't one of the four. The four are the ones that got OUT.",
            "...Still want the rest?",
        ]), [
            ["You still carried four of them out.", B + 5],
            ["So you ran.", B + 6],
        ]),
        line(B + 8, S([
            "Strike where they bend. You'll be fine.",
            "And if you see Mira - I wasn't staring at the stall. I was guarding it.",
        ])),
        line(B + 9, S(["Whenever you like. I'm not going anywhere. That's sort of the point."])),
    ],
    turnIns: [[ID, turnIn({
        npcName: NAME,
        quest: DINNER,
        tier: 1,
        done: [
            "Six bundles and three caps - she's going to think I can cook.",
            "Tobbin's baking the bread now. I'll fry the caps myself. How hard can it be?",
            "Here - four silver, and my ration jerky. A guard's wage isn't much, but it's honest, and it's yours.",
            "...Don't answer that. Come back after tomorrow evening. I'll tell you how it went.",
        ],
        waiting: ["Mira's dinner is tomorrow evening. Grain from along the village wall, ember caps from the wilds."],
        reward: () => ({ items: [coins("silver", 4), jerky(6)] }),
    })]],
}
