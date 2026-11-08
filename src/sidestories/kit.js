import { getCharState, updateMyDetailsOL, raiseBaseMaxHp } from "../charactersystem/characterstate.js"
import { obtain } from "../charactersystem/inventory.js"
import { updateStoryQuestUI, prepareGrantedQuest, ownedCount } from "../charactersystem/storyQuestSystem.js"
import { createCoinItem } from "../charactersystem/currencySystem.js"
import { updateStatUI } from "../charactersystem/statsSystem.js"
import { popupReceiveTitleUI } from "../components/titleUI.js"
import { startQuestionare } from "../components/conversations.js"
import { openClosePopup } from "../tools/popupUI.js"
import { checkIfTokenSaved } from "../tools/tools.js"

// THE SIDE-STORY KIT - what every NPC's side story (this folder) is built from,
// so each story file is its dialogue and its data, not plumbing.
//
//   conversation  - question nodes (constants/*data.js's shape) where the
//                   player's reply matters: a good one carries the talk on to
//                   whatever the NPC was holding back, a careless one ends it
//                   (try again another day - nothing is lost for good)
//   quests        - fetchQuest (bring items, taken on turn-in) and huntQuest
//                   (kill something), granted with startQuest. They ride the
//                   game's own story-quest machinery: the tracker shows them,
//                   kills and pickups count toward them, and the NPC's
//                   forQuests turn-in (turnIn below) hands out the reward
//   rewards       - giveRewards: items, coins, a title (with its bonus -
//                   titlesData.js), max hp, stat points. Every reward is a
//                   function, built when it's handed out, never at import
//   flags         - what's been said or done, kept in charState.clearedQuests
//                   (saved with the character, like a finished quest's name)

// ── dialogue ────────────────────────────────────────────────────────────────
export function say(name, messages){
    return messages.map(message => ({ name, isLeft: false, message }))
}
export function pick(variants){
    return variants[Math.floor(Math.random() * variants.length)]
}
/** A question node that only talks - no answers, then cb. */
export function line(questionId, conversation, cb = () => {}){
    return { questionId, conversationWithQuestion: conversation, answers: [], cb }
}
/** A question node with answers: [text, questionId or () => void]. */
export function ask(questionId, conversation, answers){
    return {
        questionId,
        conversationWithQuestion: conversation,
        // next: the question a plain answer leads to (kept so the links can be checked)
        answers: answers.map(([text, then]) => typeof then === "number"
            ? { text, next: then, cb: () => startQuestionare(then) }
            : { text, cb: then }),
        cb: () => {},
    }
}

// ── flags and quest state ───────────────────────────────────────────────────
export function hasFlag(flag){
    return !!getCharState()?.clearedQuests?.includes(flag)
}
export function setFlag(flag){
    const charState = getCharState()
    if(!charState || charState.clearedQuests.includes(flag)) return
    charState.clearedQuests.push(flag)
    updateMyDetailsOL(charState, checkIfTokenSaved())
}
/** "active" (on it now) | "cleared" (turned in, at least once) | "none" */
export function questState(qName){
    const charState = getCharState()
    if(charState?.quests?.some(q => q.qName === qName)) return "active"
    if(charState?.clearedQuests?.includes(qName)) return "cleared"
    return "none"
}
export const isCleared = qName => questState(qName) === "cleared"
export const isActive = qName => questState(qName) === "active"

/** Owned count of an item, over every stack. */
export function owned(name){
    return ownedCount(getCharState(), name)
}

// ── quests ──────────────────────────────────────────────────────────────────
/** Bring these: items is [[name, dn, total], ...]. Taken from the bag on turn-in. */
export function fetchQuest({ qName, qTtle, desc, items }){
    return {
        qName, qTtle, desc,
        questRequirements: {
            reqType: "item",
            consume: true,
            itemLists: items.map(([name, dn, total]) => ({ name, dn, current: 0, total })),
            completed: false,
        },
    }
}
/** Kill this many of an enemy (genenemy.ts's name - "fireslime", "vargoth"...). */
export function huntQuest({ qName, qTtle, desc, enemy, count }){
    return { qName, qTtle, desc, questRequirements: { reqType: "enemy", name: enemy, current: 0, requiredNum: count, completed: false } }
}
/**
 * Puts a quest on the character. "granted" | "already-active" | "cleared" - a
 * repeatable one can be taken again once it's been turned in.
 */
export function startQuest(quest, { repeatable = false } = {}){
    const charState = getCharState()
    if(!charState) return "none"
    const state = questState(quest.qName)
    if(state === "active") return "already-active"
    if(state === "cleared" && !repeatable) return "cleared"
    charState.quests.push(prepareGrantedQuest(quest))
    updateStoryQuestUI()
    updateMyDetailsOL(charState, checkIfTokenSaved())
    openClosePopup(`New quest: ${quest.qTtle}`, true, 2000)
    return "granted"
}

// what's still missing from a fetch quest, as a line ("4 Grain and 2 Ember Cap")
function stillMissing(quest){
    const lists = quest?.questRequirements?.itemLists ?? []
    const parts = lists
        .map(entry => ({ entry, short: Math.max(0, entry.total - owned(entry.name)) }))
        .filter(({ short }) => short > 0)
        .map(({ entry, short }) => `${short} ${entry.dn}`)
    if(!parts.length) return null
    return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`
}

function takeItems(itemLists){
    const charState = getCharState()
    itemLists.forEach(({ name, total }) => {
        let left = total
        charState.items.forEach(itm => {
            if(left <= 0 || itm.name !== name || itm.itemCateg === "equipable") return
            const used = Math.min(left, itm.qnty || 0)
            itm.qnty -= used
            left -= used
        })
        charState.items = charState.items.filter(itm => itm.itemCateg === "equipable" || itm.name !== name || itm.qnty > 0)
    })
}

/**
 * A forQuests entry (npcDetails.js's shape) for the NPC this quest is handed
 * in to - createAllNpcInArea.js plays `done` when it's complete (then onTurnIn:
 * takes the items, gives the reward) and `waiting` (with what's still missing)
 * when it isn't. reopen: a question id to open after the waiting lines - an NPC
 * with a shop keeps it while a quest of theirs is out.
 * tier / guild: how hard the quest is (worth.js) - what `reward` must be worth.
 */
export function turnIn({ npcName, quest, done, waiting, reward, reopen, repeatable = false, after, tier, guild }){
    return {
        // how hard it is, for the worth check (worth.js): tier 1-5, and for a hunt the
        // guild contract it is measured against ({ rank, count, per })
        tier, guild, quest, repeatable, rewardFn: reward,
        qName: quest.qName,
        desc: false,
        questType: "story",
        hasReward: false,
        reward: { receiveRewardType: false, rewardItems: [], rewardCoin: 0 },
        speech: say(npcName, done),
        get notCompletedSpeech(){
            const active = getCharState()?.quests?.find(q => q.qName === quest.qName)
            const missing = quest.questRequirements.consume ? stillMissing(active) : null
            return say(npcName, missing ? [...waiting, `Still short ${missing}.`] : waiting)
        },
        cbAfterNotCompletedSpeech: reopen ? () => startQuestionare(reopen) : undefined,
        questsToReceive: [],
        onTurnIn(active){
            const charState = getCharState()
            // handed in once: createAllNpcInArea.js drops the quest right after
            // this, so a second call finds it gone and pays nothing
            if(!charState?.quests?.some(q => q.qName === quest.qName)) return
            const req = active?.questRequirements
            if(req?.consume && req.itemLists) takeItems(req.itemLists)
            // a repeatable quest is cleared again on every turn-in - keep one entry, not a pile
            if(repeatable) charState.clearedQuests = charState.clearedQuests.filter(q => q !== quest.qName)
            if(reward) giveRewards(reward())
            after?.()
        },
    }
}

// ── rewards ─────────────────────────────────────────────────────────────────
/** A coin stack for a reward - type "bronze" | "silver" | "gold". */
export function coins(coinType, qnty){
    return createCoinItem(coinType, qnty)
}

/** A side-story title (titlesData.js, shared: true) - every one who earns it holds it. */
export function grantTitle(title){
    const charState = getCharState()
    if(!charState || !title) return false
    charState.titles ??= []
    if(charState.titles.some(held => held.titleId === title.titleId)) return false
    charState.titles.push({ titleId: title.titleId, dn: title.dn })
    popupReceiveTitleUI(title)
    return true
}

/**
 * reward: { items: [item...], title, maxHp, statPoints } - items include coins
 * (coins() above). Everything lands, then one save.
 */
export function giveRewards({ items = [], title, maxHp, statPoints } = {}){
    const charState = getCharState()
    if(!charState) return
    items.filter(Boolean).forEach(item => obtain(item))
    if(title) grantTitle(title)
    if(maxHp > 0){
        raiseBaseMaxHp(maxHp)
        setTimeout(() => openClosePopup(`Max HP +${maxHp}`, true, 2200), 900)
    }
    if(statPoints > 0){
        charState.statPoints = (charState.statPoints || 0) + statPoints
        // only the stats panel's redraw - it must never cost the reward itself
        try { updateStatUI() } catch(err){ console.warn("[sidestories] stats panel refresh failed", err) }
        setTimeout(() => openClosePopup(`+${statPoints} stat point${statPoints > 1 ? "s" : ""}`, true, 2200), 1400)
    }
    updateMyDetailsOL(charState, checkIfTokenSaved())
}
