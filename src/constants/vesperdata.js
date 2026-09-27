import { startQuestionare } from '../components/conversations'
import { getCharState, healPlayer, updateHpMpSp_UI, rankOrder } from '../charactersystem/characterstate'
import { buyOrSell } from "../components/buyorsell"
import { getPlayerCoord } from '../charactersystem/createcharacter'
import { createMagicCircle } from '../creations/magiccircles'
import { getSceneDet } from '../main/main'
import { updateStatUI } from '../charactersystem/statsSystem'

function toLines(messages){
    return messages.map(message => ({ name: "Vesper", isLeft: false, message }))
}

// picks a random variant so repeat visits at the same rank don't always say
// the exact same thing - same helper flirtdata.js's own pick() already is
function pick(variants){
    return variants[Math.floor(Math.random() * variants.length)]
}

// same "tier key is literally the rank label" convention flirtdata.js's own
// getVanessaTier already uses - reused here rather than duplicating the
// same rank->tier resolution a second, subtly different way
function getVesperTier(){
    const charState = getCharState()
    const idx = rankOrder.indexOf(charState?.rank?.rankLabel)
    const rankIdx = idx === -1 ? 0 : idx
    return rankOrder[rankIdx]
}

// same "spawn a circle at the player's own position" flourish questions.js's
// own id:2 (Osiris' Hearth) already uses (getPlayerCoord(charState.owner).pos) -
// purely cosmetic, no-ops silently if the coord isn't resolvable right this
// instant (scene mid-transition etc), same as that call site's own implicit
// tolerance for a missing coord
function circleAtMe(circleImg){
    const charState = getCharState()
    const coord = getPlayerCoord(charState.owner)
    const scene = getSceneDet()?.scene
    if(coord && scene) createMagicCircle(coord.pos, scene, circleImg)
}

// --- "Let's talk" -> a tiered flirt tree, same shape/mechanic
// flirtdata.js's own Vanessa tree already established (rank-gated tone,
// pick() for variety, a small branching graph ending either warm or
// deflected-but-still-warm) - just written in Vesper's own voice instead of
// Vanessa's: cold and dismissive at low rank, dry wit creeping in through
// the middle tiers, genuine (still understated) warmth only by the top two.
// No mechanical reward wired up yet, same as Vanessa's own tree - flagged
// on questionId 507 below exactly like flirtdata.js's own TODO.
const vesperOpeners = {
    f: [["Talk. About what, exactly.", "I have better things to do than guess."], ["You want conversation, not a lesson. That's new.", "Go on, then. Briefly."]],
    e: [["You keep coming back for someone who barely tolerates you.", "Say what you came to say."], ["No wound, no question today. Just... you.", "Fine. Talk."]],
    d: [["Hm. No crisis, no spell to learn. Just conversation.", "That's new. Go on, then."], ["You didn't bring a problem with you this time.", "I'll allow the novelty."]],
    c: [["You're here without a wound or a question for once.", "Careful - I might start expecting that."], ["No emergency. Just you, apparently.", "I don't mind it as much as I should."]],
    b: [["No crisis, no spell to learn. Just you.", "I'll admit, I don't mind it."], ["You stopped needing an excuse a while ago.", "I noticed. I didn't say anything."]],
    a: [["You didn't need an excuse this time.", "Good. I was tired of pretending I needed one either."], ["No question today. Just showing up.", "Keep doing that."]],
    s: [["You don't have to knock anymore, you know.", "I've been listening for the door."], ["No excuse, no reason. Just you, again.", "Exactly how I like it."]],
}

const vesperFlattered = {
    f: [["Interesting. That's a word people use when they don't know what else to say.", "Try again, if you actually mean something."], ["Flattery doesn't work on me. I study magic, not charm."]],
    e: [["Flattery. From you. That's almost funny.", "Almost."], ["Careful. I remember what people say to me. All of it."]],
    d: [["Careful. I remember compliments, and I collect on them eventually.", "Keep going, I won't stop you."], ["That's a start. Don't get comfortable yet."]],
    c: [["You mean that, or is it just easier to say than what you're actually thinking?", "Either way. Noted."], ["I've decided to believe you. Don't make me regret it."]],
    b: [["Say it again and I might actually believe you.", "I've stopped assuming you're just being polite."], ["I keep track of things like that now. Don't ask why."]],
    a: [["You don't have to keep proving it. I already know.", "Doesn't mean I want you to stop."], ["I've run out of reasons not to believe you."]],
    s: [["Say it exactly like that again.", "I want to remember it precisely."], ["You've said enough. I already know. Say it anyway."]],
}

const vesperGuarded = {
    f: [["Lonely implies I want company. I don't.", "The crystal doesn't ask questions. Neither should you."], ["I chose this house. I chose being alone in it."]],
    e: [["I have my work. That's enough most days.", "Most days."], ["Solitude suits a witch. Mostly."]],
    d: [["I manage. Solitude has its uses - fewer people asking if I'm lonely, for one.", "You're an exception, apparently."], ["Ask me something less obvious next time."]],
    c: [["Some days. Not that I'd admit it to just anyone.", "You're not just anyone, evidently."], ["I don't answer that question. Usually."]],
    b: [["Yes. More than I let on.", "You're the only one I'd say that to."], ["I stopped minimizing it around you a while ago."]],
    a: [["Less, since you started visiting.", "Don't stop. I won't ask twice."], ["You've made the house feel less empty. I noticed."]],
    s: [["Not anymore. Not since you.", "Don't make me say it a third time."], ["You're the reason that question doesn't apply anymore."]],
}

const vesperCloser = {
    f: [["Hmph. Don't let it go to your head.", "That's enough for today."], ["Adequate conversation. I've had worse."]],
    e: [["...Thank you. That's not something I hear often.", "Go on, before I say something I'll regret."], ["That was almost pleasant. Almost."]],
    d: [["Keep talking to me like that and I'll start looking forward to it.", "Go, before I admit that out loud."], ["Don't expect me to say that was nice. But it was."]],
    c: [["I'm going to think about that longer than I should.", "Get out there. Come back in one piece."], ["You've ruined my afternoon of getting nothing done. Thank you."]],
    b: [["You've made this considerably harder to be indifferent about.", "Don't be a stranger."], ["I'll deny saying this, but I look forward to your visits."]],
    a: [["I've stopped pretending I don't wait for you.", "Come back to me."], ["Just come back. That's all I want to say."]],
    s: [["You already know. Just come home safe.", "I'll be right here."], ["I don't need to say it. But I will: come back to me."]],
}

const vesperDeflect = {
    f: [["Then don't say things you don't mean."], ["Convenient, backing out like that."]],
    e: [["Too late. I already filed it away."], ["Didn't ask you to take it back."]],
    d: [["You don't get to un-say that.", "I heard it. That's enough."], ["Retract it all you want. I still heard it."]],
    c: [["You meant it. I know you did."], ["Doesn't matter. I'm keeping it either way."]],
    b: [["I don't unhear things. Especially not that."], ["Take it back all you like. It's already mine."]],
    a: [["You meant it, and we both know it."], ["I've decided not to let you take that back."]],
    s: [["No. You don't get to walk that one back."], ["You meant it. Say it again if you're brave enough."]],
}

const vesperCheckedOn = {
    f: [["Good. Then we understand each other."], ["Space is fine. I prefer it, mostly."]],
    e: [["Glad someone finally understands that."], ["Most people don't get it. You do, apparently."]],
    d: [["Careful, agreeing with me is dangerously attractive."], ["Say that again and I might actually like you."]],
    c: [["You're better at this than most people who visit."], ["I appreciate that more than I'll admit out loud."]],
    b: [["You understand me better than most. Don't stop."], ["That's rarer than you'd think. Don't waste it."]],
    a: [["You already understand me. That's not nothing."], ["Most people push. You don't. I noticed that too."]],
    s: [["You understand me completely. That's why you're still here."], ["That's exactly why this works."]],
}

export function vesperData(){
    return [
        {
            questionId: 500,
            conversationWithQuestion: toLines([
                "Well? What is it you actually need from me.",
            ]),
            answers: [
                { text: "Purification", cb: () => {
                    const charState = getCharState()
                    // a full cleanse, not a specific cure list - "purification"
                    // reads as wiping whatever's clinging to you entirely,
                    // not just one named ailment (itemInfoSystem.js's own
                    // consumeAbilities.cure is the narrower, named-list version
                    // of this same idea, for a specific antidote item). Clears
                    // poisoned/cursed both - both are just passive
                    // characterState.status entries with no ongoing tick of
                    // their own (unlike fire's burn, a self-expiring interval
                    // with no status entry at all) - see characterstate.js's
                    // own deductHp for the full breakdown.
                    charState.status = []
                    // heart-status-def UI ("Heart Core is cursed" etc,
                    // statsSystem.js) - only ever refreshes on this call,
                    // same fix skillEffects.js's own spawnPurificationCircle
                    // needed for the real skill version of this
                    updateStatUI()
                    circleAtMe("apt_darkness")
                    startQuestionare(501)
                } },
                { text: "Full heal", cb: () => {
                    const charState = getCharState()
                    charState.hp = charState.maxHp
                    charState.mp = charState.maxMp
                    charState.sp = charState.maxSp
                    updateHpMpSp_UI()
                    circleAtMe("apt_earth_second")
                    startQuestionare(502)
                } },
                { text: "Let's talk", cb: () => startQuestionare(503) },
                // her skill-book shelf (npcDetails.js's own toSell on
                // "117_vesper") - buyOrSell(false, <sellerId>) is the same
                // call bramdata.js/maeladata.js already use, the shop just
                // reads a different NPC's stock
                { text: "Teach me something", cb: () => buyOrSell(false, "117_vesper") },
            ],
            cb: () => {}
        },
        {
            questionId: 501,
            conversationWithQuestion: toLines(["There. Whatever was clinging to you, it's gone now."]),
            answers: [],
            cb: () => {}
        },
        {
            questionId: 502,
            conversationWithQuestion: toLines(["Rest easy. You're whole again."]),
            answers: [],
            cb: () => {}
        },
        {
            questionId: 503,
            conversationWithQuestion: toLines(pick(vesperOpeners[getVesperTier()])),
            answers: [
                { text: "You're interesting to talk to", cb: () => startQuestionare(504) },
                { text: "Do you get lonely out here?", cb: () => startQuestionare(505) },
                { text: "Never mind, just curious", cb: () => startQuestionare(506) },
            ],
            cb: () => {}
        },
        {
            questionId: 504,
            conversationWithQuestion: toLines(pick(vesperFlattered[getVesperTier()])),
            answers: [
                { text: "I mean it", cb: () => startQuestionare(507) },
                { text: "Maybe I'm just being polite", cb: () => startQuestionare(508) },
            ],
            cb: () => {}
        },
        {
            questionId: 505,
            conversationWithQuestion: toLines(pick(vesperGuarded[getVesperTier()])),
            answers: [
                { text: "I could visit more often", cb: () => startQuestionare(507) },
                { text: "Fair enough, everyone needs space", cb: () => startQuestionare(509) },
            ],
            cb: () => {}
        },
        {
            questionId: 506,
            conversationWithQuestion: toLines(["Then don't waste my time next time either."]),
            answers: [],
            cb: () => {}
        },
        {
            questionId: 507,
            conversationWithQuestion: toLines(pick(vesperCloser[getVesperTier()])),
            answers: [],
            // no mechanical reward wired up yet, same TODO flirtdata.js's own
            // closer node (questionId 10) already carries - a real
            // relationship/affection system would hook in here
            cb: () => {}
        },
        {
            questionId: 508,
            conversationWithQuestion: toLines(pick(vesperDeflect[getVesperTier()])),
            answers: [],
            cb: () => startQuestionare(507)
        },
        {
            questionId: 509,
            conversationWithQuestion: toLines(pick(vesperCheckedOn[getVesperTier()])),
            answers: [],
            cb: () => startQuestionare(507)
        },
    ]
}
