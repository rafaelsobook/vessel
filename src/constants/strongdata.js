import { startQuestionare } from '../components/conversations'
import { grantStoryQuest } from '../tools/questHelpers'

// picks a random variant so repeat visits don't always say the exact same thing
function pick(variants){
    return variants[Math.floor(Math.random() * variants.length)]
}
function toLines(messages){
    return messages.map(message => ({ name: "Strong", isLeft: false, message }))
}

const strongOpener = [
    ["Oh! Uh — didn't see you there. Everything's fine. Very fine. Nothing's wrong at all.", "...why are you looking at me like that."],
    ["*straightens armor* Reporting for duty. Guard duty. Which I am doing. Right now.", "Was I staring at something? No. No I wasn't."],
    ["You caught me mid-patrol. Very important patrol. Lots of perimeter to check.", "The perimeter that happens to be shaped exactly like a fruit stall, yes. I'm aware of how that sounds."],
]

const strongDeny = [
    ["Distracted? Me? I'm the picture of focus.", "I could recite guild regulation right now. Ask me anything. Anything except why I keep losing my train of thought around here."],
    ["I don't know what you're talking about.", "This is just how I always stand. Very casually. Facing this exact direction. For guard reasons."],
]

const strongConfession = [
    "Alright. Alright, fine. You're going to make me say it, aren't you.",
    "Her name is Mira. Runs the fruit stall by the east well. Has since spring.",
    "I asked for this post myself. Told the captain it was about 'market security concerns.' The captain did not believe me. Nobody believed me.",
    "It's not — I'm not — look, I've faced down bandits without blinking. I once talked down a drunk ogre with nothing but a shield and bad advice.",
    "And every single time she asks how my day is going, my brain just leaves. Doesn't even send a letter explaining where it went.",
    "There's been something scaring off her early customers too. Rats, or slimes wandering in from the border, I don't know. She mentioned it once, worried, and I said I'd 'look into it,' like some kind of hero.",
    "I have not looked into it. I have instead stood here, looking at HER, for eleven days.",
    "So. Now you know. Guild's finest, brought low by a fruit stand.",
]

const strongAskForHelp = [
    "You'd actually do that? Deal with whatever's been lurking near her stall?",
    "That would actually help. A lot. I could finally stop pretending my 'patrols' have a purpose.",
    "Just clear out whatever's been creeping in from the border edge. Slimes, probably, this time of year — enough of them that she's noticed.",
    "Do that, and I swear I'll figure out the rest myself. The talking part. The hard part.",
    "...thank you. Genuinely. I mean it.",
]

const strongRejected = [
    "Oh. Right. Yeah, no, that's fair — forget I said anything.",
    "*clears throat* Just doing my rounds. Nothing to see here. Carry on.",
]

const strongSoftExit = [
    "Right, right. Duty calls for the both of us, I suppose.",
    "Try not to spread this around, alright? A guard's got a reputation to maintain.",
]

export function strongData(){
    return [
        {
            questionId: 40,
            conversationWithQuestion: toLines(pick(strongOpener)),
            answers: [
                { text: "You seem distracted lately.", cb: () => startQuestionare(41) },
                { text: "Anything I can help with?", cb: () => startQuestionare(42) },
                { text: "Just doing my rounds too. Carry on.", cb: () => startQuestionare(43) },
            ],
            cb: () => {}
        },
        {
            questionId: 41,
            conversationWithQuestion: toLines(pick(strongDeny)),
            answers: [
                { text: "Come on. I won't tell anyone.", cb: () => startQuestionare(42) },
                { text: "Fine, keep your secrets.", cb: () => startQuestionare(43) },
            ],
            cb: () => {}
        },
        {
            questionId: 42,
            conversationWithQuestion: toLines(strongConfession),
            answers: [
                { text: "I'll help you out.", cb: () => startQuestionare(44) },
                { text: "That's... kind of sweet, actually.", cb: () => startQuestionare(44) },
                { text: "Sounds like your problem, not mine.", cb: () => startQuestionare(45) },
            ],
            cb: () => {}
        },
        {
            questionId: 44,
            conversationWithQuestion: toLines(strongAskForHelp),
            answers: [],
            cb: () => {
                grantStoryQuest({
                    qName: "strong-secret-1",
                    qTtle: "Something's Bothering Strong",
                    desc: "Strong finally admitted what's been distracting him. Talk to him again to hear the whole story.",
                    questRequirements: { reqType: false, completed: true },
                })
            }
        },
        {
            questionId: 45,
            conversationWithQuestion: toLines(strongRejected),
            answers: [],
            cb: () => {}
        },
        {
            questionId: 43,
            conversationWithQuestion: toLines(strongSoftExit),
            answers: [],
            cb: () => {}
        },
    ]
}
