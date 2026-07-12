import { startQuestionare } from '../components/conversations';
import { buyOrSell } from '../components/buyorsell';
import { reportQuest } from '../charactersystem/guildQuest';
import { getCharState, rankOrder } from '../charactersystem/characterstate';

// tier key is literally the rank label now - every rank gets its own personality, no bucketing
function getVanessaTier(){
    const charState = getCharState()
    const idx = rankOrder.indexOf(charState?.rank?.rankLabel)
    const rankIdx = idx === -1 ? 0 : idx
    return rankOrder[rankIdx]
}

// picks a random variant so repeat visits at the same rank don't always say the exact same thing
function pick(variants){
    return variants[Math.floor(Math.random() * variants.length)]
}

function toLines(messages){
    return messages.map(message => ({ name: "Vanessa", isLeft: false, message }))
}

const vanessaGreetings = {
    f: [
        ["Hi, how can I help you today?"],
        ["Oh, hello. Do you need something?"],
    ],
    e: [
        ["Hey, you're back. What's on your mind?"],
        ["Oh, it's you again. Come on in, I don't mind."],
    ],
    d: [
        ["Well look who it is. Miss me already?"],
        ["Back so soon? Someone's clingy~"],
    ],
    c: [
        ["There's my favorite adventurer. What can I do for you, charming?"],
        ["Mmm, perfect timing, I was just thinking about you."],
    ],
    b: [
        ["Finally. I was two minutes from coming to find you myself."],
        ["Look who ranked up enough to catch my eye. What do you need, handsome?"],
    ],
    a: [
        ["You're late. I've been counting the minutes."],
        ["There you are. I've been waiting for you all day, hero."],
    ],
    s: [
        ["Took you long enough. Come here, now."],
        ["Every second you're not here feels wasted. Sit."],
    ],
}

const vanessaOpeners = {
    f: [
        ["Oh? Not here for a quest this time?", "I don't mind, honestly. It gets quiet at this desk."],
        ["No request today? That's alright.", "I could use a short break from the paperwork, actually."],
    ],
    e: [
        ["No quest today, huh? Just here to bother me?", "Good, I was getting tired of paperwork anyway."],
        ["Not on guild business? Interesting.", "I was hoping for a reason to look up from this ledger."],
    ],
    d: [
        ["Skipping the quest talk today? I like where this is going.", "Keep showing up like this and people will start talking."],
        ["Oh, a social call. How scandalous.", "I'll allow it. Just this once. Maybe twice."],
    ],
    c: [
        ["No request, huh? So this is just... a visit.", "I could get used to that, you know."],
        ["Look at you, showing up with no excuse at all.", "Bold. I respect that."],
    ],
    b: [
        ["No quest? Good, because I wasn't planning on letting you leave that fast anyway.", "Sit. Talk. You're not going anywhere until I say so~"],
        ["No paperwork today. Just you and me, then.", "Don't look so surprised, I've been waiting for this."],
    ],
    a: [
        ["No quest? Then you're all mine for the next few minutes.", "Don't even think about rushing off."],
        ["Good. I don't want to share you with a request board today.", "Come closer, I don't bite. Much."],
    ],
    s: [
        ["No quest. Just you. Exactly how I planned it.", "You're not leaving until I say you can."],
        ["I already cleared my whole afternoon for this.", "Don't test how far I'll go to keep you here."],
    ],
}

const vanessaFlattered = {
    f: [
        ["Oh... you really think so?", "You're making me blush, you know."],
        ["That's... really sweet of you to say.", "I don't hear that often, thank you."],
    ],
    e: [
        ["Smooth talker, aren't you...", "Keep that up and I might actually enjoy your visits."],
        ["Hah, flattery? From you?", "I'll admit, it's working a little."],
    ],
    d: [
        ["Mmm, keep flattering me, I dare you.", "You're trouble. I like trouble."],
        ["Careful, compliments like that go straight to my head.", "Now I'll expect one every visit."],
    ],
    c: [
        ["Careful. Talk like that and I'll hold you to it.", "You have no idea what you're starting."],
        ["Keep talking. I could listen to this all day.", "You're dangerously charming, you know that?"],
    ],
    b: [
        ["Say that again and mean it.", "Because I plan on remembering every word."],
        ["Careful, hero. Words like that make promises.", "And I intend to collect on them."],
    ],
    a: [
        ["You'd better mean every word of that.", "Because I'm not letting you take it back."],
        ["Keep talking like that and I'll never let you leave.", "Consider that a warning, not a joke."],
    ],
    s: [
        ["Say it again. Slower this time.", "I want to remember exactly how you said that."],
        ["You don't get to say things like that and just walk away.", "You're mine the moment you mean it."],
    ],
}

const vanessaNotBored = {
    f: [
        ["Bored? Please, I run this whole desk.", "But it is... nice, having someone to talk to who isn't reporting a monster problem."],
        ["I'm never bored, there's always something to file.", "Though, I admit, your visits are a nice change of pace."],
    ],
    e: [
        ["Please, I could run this place in my sleep.", "Still, it's nice getting visitors who don't smell like goblin guts."],
        ["Bored? Hardly. Lonely, maybe. Bored, no.", "You're a welcome interruption, for what it's worth."],
    ],
    d: [
        ["Please, boredom doesn't stand a chance against me.", "Though I'll admit, you're a nice distraction from all this paperwork."],
        ["Bored is not a word in my vocabulary.", "But 'entertained by you' might be, lately."],
    ],
    c: [
        ["Boredom wouldn't dare show its face around me.", "But you? You're the one distraction I don't mind keeping around."],
        ["I run this desk, sweetheart, boredom doesn't get a say.", "You, on the other hand, get all the say you want."],
    ],
    b: [
        ["Boredom doesn't get anywhere near me.", "You, though, you get right past every one of my defenses."],
        ["I haven't been bored a day since you started coming around.", "Which is exactly the problem."],
    ],
    a: [
        ["Bored? I haven't thought about anything else since you left last time.", "You're all I've been distracted by, actually."],
        ["Boredom left the moment you walked in, and it's not coming back.", "Neither are you, if I have any say."],
    ],
    s: [
        ["I don't get bored. I get impatient, waiting for you.", "And right now, I'm done waiting."],
        ["The only thing I think about is when you'll walk through that door again.", "So no, not bored. Obsessed, maybe."],
    ],
}

const vanessaClosers = {
    f: [
        ["Hehe, keep this up and I might just start slipping you extra rewards when no one's looking.", "Take care out there, alright?"],
        ["Thank you for stopping by, really.", "Come back safe, okay?"],
    ],
    e: [
        ["Hehe, you're trouble, you know that?", "Get going before I change my mind about letting you leave."],
        ["You always know how to make my shift better.", "Go on, before I start finding excuses to keep you."],
    ],
    d: [
        ["Keep this up and I'll start reserving the best requests just for you.", "Now scram, hero, before I forget myself."],
        ["You're becoming a habit, you know.", "A good one. Now go, before I admit that out loud again."],
    ],
    c: [
        ["Keep flattering me like that and I'll have to claim you as mine.", "Don't you dare flirt with anyone else out there."],
        ["I'm going to be thinking about this conversation all day.", "Get out of here before I make you stay."],
    ],
    b: [
        ["Keep this up and I'm marking you as mine, no take-backs.", "Now get out there, hero. And hurry back to me."],
        ["You've officially ruined me for anyone else's paperwork.", "Go. But you owe me a longer visit next time."],
    ],
    a: [
        ["I mean it. You're mine now, whether you agreed to it or not.", "Don't you dare make me wait too long for the next visit."],
        ["I'll be counting every hour until you're back.", "Go, before I lock that door and keep you here myself."],
    ],
    s: [
        ["You're mine. Completely. Don't bother arguing.", "Come back the second you can, or I'm coming to find you."],
        ["I don't share, and I definitely don't wait patiently.", "So don't take too long, hero. I mean it."],
    ],
}

const vanessaExit = {
    f: [["Fair enough. Don't keep your quests waiting."], ["Of course. Duty first, I understand."]],
    e: [["Suit yourself. I'll be here if you change your mind."], ["Alright. Come find me whenever you like."]],
    d: [["Your loss. Same spot, same smile, whenever you're ready."], ["Running away already? How predictable."]],
    c: [["Fine, go be a hero. I'll be right here, missing the attention."], ["Business before pleasure, I see how it is."]],
    b: [["Running already? Fine. But I'm not done with you yet."], ["You'll be back. They always come back."]],
    a: [["You really think I'll just let that go? Fine, for now."], ["Go, but don't expect me to forget this conversation."]],
    s: [["Oh, you don't get to end this that easily."], ["Fine. Run. I'll just come find you instead."]],
}

const vanessaDeflect = {
    f: [["Ha! Well, exaggerating or not, it worked. My cheeks are warm."], ["It worked either way, so I'll allow it this once."]],
    e: [["Cheeky, wondering if it's working. Fine, it's working a little."], ["You're a menace, a charming one, but a menace."]],
    d: [["Oh, it's working. Don't let it go to your head, though."], ["It's working. Don't you dare look smug about it."]],
    c: [["It's working more than I'd like to admit, honestly."], ["Careful, that question alone is working on me."]],
    b: [["Working? You have no idea."], ["Keep asking questions like that and see what happens."]],
    a: [["It's working so well I can't think straight."], ["Don't ask questions you're not ready to hear the answer to."]],
    s: [["It worked the moment you walked in today."], ["Ask me that again and I'll show you exactly how much."]],
}

const vanessaCheckedOn = {
    f: [["Checking on me? That's... sweet, actually."], ["Nobody really does that for me. Thank you."]],
    e: [["Visiting daily, huh? I might just let you."], ["I wouldn't say no to that, honestly."]],
    d: [["Careful what you wish for, I might hold you to that."], ["Daily visits, noted. I'm holding you to it."]],
    c: [["Keep checking on me and I'll start expecting it."], ["I might start looking forward to it more than I should."]],
    b: [["Already decided, have you? Good, I wasn't planning on letting you leave anyway."], ["Then don't ever stop."]],
    a: [["You checking on me is the only good part of my day."], ["Don't you dare make that a one-time thing."]],
    s: [["You're not checking on me, you're keeping me. Own it."], ["Good, because I already decided you're not allowed to stop."]],
}

const vanessaNode7Answers = {
    f: ["Just wanted to see you", "You looked bored, thought I'd say hi", "Never mind, back to business"],
    e: ["Wanted an excuse to bug you", "Figured you could use the company", "Eh, forget I said anything"],
    d: ["Can't a guy check on his favorite receptionist?", "Figured you'd rather talk to me than file paperwork", "Relax, just teasing. Back to business"],
    c: ["Maybe I just wanted an excuse to talk to you", "You looked like you needed rescuing from that desk", "Never mind, ignore me"],
    b: ["Because staying away from you is getting harder", "You, obviously. Paperwork's boring without you", "Fine, fine, duty calls. For now"],
    a: ["Because I can't stop thinking about you", "You. Always you.", "I'll let you get back to work. For now."],
    s: ["Because you're the only reason I come back here", "You. There's no one else worth bothering.", "Don't worry, I'm not really leaving"],
}

const vanessaNode8Answers = {
    f: ["I mean it", "Only speaking the truth", "Okay, maybe I'm exaggerating a little"],
    e: ["Would I lie to you?", "Just telling it like it is", "Depends, is it working?"],
    d: ["Every word of it", "You bring it out of me", "Is it working?"],
    c: ["I mean every single word", "You just do that to me", "Tell me if it's working"],
    b: ["I mean every word, and then some", "You have that effect on me", "Say the word and I'll prove it"],
    a: ["I've never meant anything more", "You do this to me every time", "Ask me again and see"],
    s: ["I'd say it a thousand times if you'd let me", "You're the reason I forget every other word", "Say the word, I dare you"],
}

const vanessaNode9Answers = {
    f: ["Happy to be the exception", "I can leave if you're busy", "Just wanted to check on you"],
    e: ["Glad I could break up the monotony", "I can come back later if you want", "Just making sure you're not overworked"],
    d: ["Good, then make room for me", "Say the word and I'll leave you be", "Careful, or I'll start visiting daily"],
    c: ["Then I guess I'm staying", "Tell me to go and I still won't listen", "I might just start visiting every day"],
    b: ["Then let me keep you entertained", "Tell me to leave and I still won't", "I already decided I'm not leaving"],
    a: ["Then I'm not going anywhere", "Say the word and watch me stay anyway", "I've already made up my mind about staying"],
    s: ["Then I guess you're stuck with me", "Tell me to leave, I dare you", "I already decided you're mine to bother"],
}

export function vanessasData(){
    const tier = getVanessaTier()
    return [
        {
            questionId: 6,
            conversationWithQuestion: toLines(pick(vanessaGreetings[tier])),
            answers: [
                {
                    text: "Report my Quest",
                    cb: () => {
                        reportQuest()
                    }
                },
                {
                    text: "Sell Carcas",
                    cb: () => {
                        buyOrSell(true)
                    }
                },
                {
                    text: "What's up",
                    cb: () => {
                        startQuestionare(7)
                    }
                },
            ],
            cb: () => {}
        },
        {
            questionId: 7,
            conversationWithQuestion: toLines(pick(vanessaOpeners[tier])),
            answers: [
                {
                    text: vanessaNode7Answers[tier][0],
                    cb: () => {
                        startQuestionare(8)
                    }
                },
                {
                    text: vanessaNode7Answers[tier][1],
                    cb: () => {
                        startQuestionare(9)
                    }
                },
                {
                    text: vanessaNode7Answers[tier][2],
                    cb: () => {
                        startQuestionare(12)
                    }
                },
            ],
            cb: () => {}
        },
        {
            questionId: 8,
            conversationWithQuestion: toLines(pick(vanessaFlattered[tier])),
            answers: [
                {
                    text: vanessaNode8Answers[tier][0],
                    cb: () => {
                        startQuestionare(10)
                    }
                },
                {
                    text: vanessaNode8Answers[tier][1],
                    cb: () => {
                        startQuestionare(10)
                    }
                },
                {
                    text: vanessaNode8Answers[tier][2],
                    cb: () => {
                        startQuestionare(13)
                    }
                },
            ],
            cb: () => {}
        },
        {
            questionId: 9,
            conversationWithQuestion: toLines(pick(vanessaNotBored[tier])),
            answers: [
                {
                    text: vanessaNode9Answers[tier][0],
                    cb: () => {
                        startQuestionare(10)
                    }
                },
                {
                    text: vanessaNode9Answers[tier][1],
                    cb: () => {
                        startQuestionare(12)
                    }
                },
                {
                    text: vanessaNode9Answers[tier][2],
                    cb: () => {
                        startQuestionare(14)
                    }
                },
            ],
            cb: () => {}
        },
        {
            questionId: 10,
            conversationWithQuestion: toLines(pick(vanessaClosers[tier])),
            answers: [],
            cb: () => {
                // TODO: grant a flirt boost/reward once the relationship system exists
            }
        },
        {
            questionId: 12,
            conversationWithQuestion: toLines(pick(vanessaExit[tier])),
            answers: [],
            cb: () => {}
        },
        {
            questionId: 13,
            conversationWithQuestion: toLines(pick(vanessaDeflect[tier])),
            answers: [],
            cb: () => {
                startQuestionare(10)
            }
        },
        {
            questionId: 14,
            conversationWithQuestion: toLines(pick(vanessaCheckedOn[tier])),
            answers: [],
            cb: () => {
                startQuestionare(10)
            }
        },
    ]
}
