import { startQuestionare } from '../components/conversations'
import { sideStoryOption } from '../sidestories/index.js'
import { setFlag } from '../sidestories/kit.js'
import { HALDEN_HEARD } from '../sidestories/halden.js'

function toLines(messages){
    return messages.map(message => ({ name: "Halden", isLeft: false, message }))
}

// picks a random variant so repeat visits don't always open the same way -
// same helper strongdata.js/vordzdata.js already use
function pick(variants){
    return variants[Math.floor(Math.random() * variants.length)]
}

const haldenOpener = [
    ["You've got the look of someone about to walk out past the fence.", "Sit a moment first. Let an old guard save your life."],
    ["Strong watches the fruit stall. Vordz watches Strong.", "Somebody has to watch the dark. That's me."],
    ["Back again? Good. The ones who come back are the ones who listen."],
]

// what nearly killed him - Vargoth, the first of the four standing wolves
// (tcp's genenemy.ts STANDING_WOLVES): the crouch before the pounce, the
// claws that leave a bleed that won't close
const haldenStory = [
    "Thirteen years ago. Far patrol, five of us, escorting a grain cart to the outer farms. Nothing in it.",
    "We heard it before we saw it. A howl that ended like a man laughing.",
    "Then it stood up. That's the part nobody believes. A wolf the size of that cart, and it rose onto two legs and looked at us like WE were the ones trespassing.",
    "Vargoth. We didn't know the name then. We learned it later, from what was left of the camp it visited after us.",
    "It dropped low - flat, like a cat over a mouse - and then it simply wasn't there. It was on Eddrick before he'd turned his head.",
    "Three of us were gone before I'd cleared my sword. It caught me across the ribs. Shallow. I thought I'd been lucky.",
    "Then the blood wouldn't stop. It doesn't, from their claws. It runs and runs until something closes it - or until you're empty.",
]

// the light that saved him - the chain skill to come: it binds, and it's
// paid for out of the caster's own life
const haldenChains = [
    "I was on my back in the mud with it standing over me, and I did the only thing I had left. I prayed. Not the polite kind.",
    "Light came up out of the ground. Chains of it - white, humming like a struck bell - round its legs, its throat, its jaws, and they dragged it down flat.",
    "Light doesn't give you something for nothing. Every link of those chains was forged out of me. I felt years go. My hair was black that morning.",
    "They held him long enough for me to crawl. That's all they did. I didn't kill Vargoth. Nobody has. He's still out there, and he remembers my smell.",
    "I've never been able to call them fully since. Maybe one day I'll find someone worth teaching - someone who understands what it costs to hold a monster still.",
]

// the four standing wolves - each with the one thing that keeps you alive
// against it (vargoth pounces, zareth burns, morvane drains stamina,
// skallgrim is the strongest)
const haldenTheFour = [
    "There are four of them. One for each corner of the wilds, about as far from this fence as the land goes.",
    "Vargoth. Brown as old leather - the brawler. He drops low before he pounces. When he drops, you move sideways. Never back.",
    "Zareth. Red, with embers running under his fur. He doesn't leap - he doesn't need to. His claws burn, and the burning keeps biting after you've stepped away.",
    "Morvane. Black-marked. Fighting him is like running through deep water - he drinks your stamina. Don't sprint into him, or you'll have nothing left to run away with.",
    "Skallgrim. White as frost, and the worst of them. The others hunt. He waits. If you ever see him, you're already too close. Don't go to him alone.",
    "All four make you bleed. Remember that, if you remember nothing else I've said.",
]

const haldenSurvival = [
    "Bleeding first, because that's what kills people. It will not stop on its own.",
    "A Duskveil cap stops it - violet, with dark veins, grows deep in the mushroom cave. Ask Mushruu. He knows every cap down there.",
    "Or find the witch Vesper. Her purification lifts anything off you, bleeding included.",
    "They're faster than you walking, slower than you at a full sprint. Running isn't cowardice. Running is how I'm alive. So keep your stamina for it - a fighter who spends it all swinging has none left to leave with.",
    "And take it in order. Slimes first - the red ones and the yellow ones too, not just the blue. Then the wolf packs out past the deer. Then, and only then, the four.",
    "Every one of them has buried someone who skipped a step.",
]

const haldenFarewell = [
    "Go on, then. Mind the far ridges.",
    "Off you go. And if you hear a howl that sounds like words - run.",
]

// Halden - the third gate guard (npcDetails.js's "122_halden"), on Strong's
// other side. He met one of the four standing wolves and lived; this is
// where a new player hears about them at all, and the story is told across
// its own menu so it's never a wall of text: what happened, what saved him
// (the light chains - a skill still to come), the four, and how to survive.
export function haldenData(){
    return [
        {
            questionId: 700,
            conversationWithQuestion: toLines(pick(haldenOpener)),
            answers: [
                // this NPC's side story, when there's something to say (sidestories/)
                ...sideStoryOption("122_halden"),
                { text: "Those scars - what happened?", cb: () => startQuestionare(701) },
                { text: "What's out there?", cb: () => startQuestionare(703) },
                { text: "How do I survive it?", cb: () => startQuestionare(704) },
                { text: "Another time", cb: () => startQuestionare(705) },
            ],
            cb: () => {}
        },
        {
            questionId: 701,
            conversationWithQuestion: toLines(haldenStory),
            answers: [
                { text: "How did you get away?", cb: () => { setFlag(HALDEN_HEARD); startQuestionare(702) } },
                { text: "That's enough for now", cb: () => startQuestionare(705) },
            ],
            cb: () => {}
        },
        {
            questionId: 702,
            conversationWithQuestion: toLines(haldenChains),
            answers: [
                { text: "Tell me about the others", cb: () => startQuestionare(703) },
                { text: "I'll remember that", cb: () => startQuestionare(705) },
            ],
            cb: () => {}
        },
        {
            questionId: 703,
            conversationWithQuestion: toLines(haldenTheFour),
            answers: [
                { text: "How do I survive them?", cb: () => startQuestionare(704) },
                { text: "I'll be careful", cb: () => startQuestionare(705) },
            ],
            cb: () => {}
        },
        {
            questionId: 704,
            conversationWithQuestion: toLines(haldenSurvival),
            answers: [],
            cb: () => {}
        },
        {
            questionId: 705,
            conversationWithQuestion: toLines([pick(haldenFarewell)]),
            answers: [],
            cb: () => {}
        },
    ]
}
