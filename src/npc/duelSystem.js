// duelSystem.js
//
// Fully local (no-server) 1v1 fight, spawned in the "duel" areaType arena
// (placeId 200, see localroomdb.js). isMultiplayer:false there means
// setSocketOn(false) for the whole scene (areascene.js/main.js), which
// silently no-ops every socket-authoritative combat call the normal enemy
// pipeline depends on (emitEnemyIsHit, the server-driven "enemy-attacked"
// event, etc - see enemies/createEnemy.js). So this doesn't touch that
// pipeline at all - it builds the opponent via createnpc.js's
// createFighterNpc (the full createCharacter() rig - real
// characterAnimations/equipSword, same as the player), and resolves damage
// in both directions with the same pure, local functions the rest of the
// game already has (calcDmg, deductHp), just triggered directly instead of
// via a socket round-trip.
import { Vector3, Quaternion } from "@babylonjs/core"
import npcDetails from "../staticRecources/npcDetails.js"
import { createFighterNpc } from "./createnpc.js"
import { capsuleHeight } from "../charactersystem/createcharacter.js"
import { getCharState, updateMyDetailsOL, deductHp, isPlayerCursed, curseStatusEffect } from "../charactersystem/characterstate.js"
import { checkStoryQuestIfCompleted } from "../charactersystem/storyQuestSystem.js"
import { calcDmg, registerToAtkCollider } from "../charactersystem/attackingSystem.js"
import { createHpBar, poppingTextMesh } from "../tools/GUITools.js"
import { ANIM_STATE, findAnimVariants } from "../tools/animation.js"
import { castEnemySkill } from "../creations/skillEffects.js"
import { getPlayersOnScene, getProjectilesOnScene, pushDuelOpponentOnScene, removeDuelOpponentOnScene } from "../sockets/worldsocket.js"
import { ATK_COLLIDER_PARKED_Y } from "../charactersystem/createMyCharacter.js"
import { getAllSounds } from "../components/soundSystem.js"
import { checkIfTokenSaved } from "../tools/tools.js"
import { travelToPlace } from "../tools/travel.js"
import { findPlaceMetaData } from "../states/placestates.js"
import { startConv } from "../components/conversations.js"
import { displaySpeech } from "../tools/speechgui.js"
import { showAnswerButtons } from "../tools/popupUI.js"
import { giveSkill } from "../components/skillsui.js"
import { receiveTitle } from "../components/titleUI.js"
import { receiveAchievement } from "../charactersystem/achievement.js"
import { getSkillEffect } from "../staticRecources/skillsData.js"

const DUEL_PLACE_ID     = 200
const ATTACK_INTERVAL_MS = 1500
// createMyCharacter.js's own atkCollider positioning is the established
// reach convention here: punch ~0.8 units forward of the body, collider only
// 1 unit deep, plus the target's own ~0.25 capsuleRadius - roughly 1.5 units
// center-to-center is about as far as a real punch could ever land. This was
// 4 before, nearly 3x too generous - the opponent was throwing punches from
// a gap nothing could actually connect across.
const ATTACK_RANGE       = 1.5
const CHASE_SPEED        = 3 // units/sec while closing distance
// Fallback only now - localroomdb.js's own npcEnemies entries can carry a
// per-fighter position:{x,y,z} (needed once a gauntlet has more than one
// opponent, so they don't all stack on the same spot). y:0.01 matches the
// convention every npcDetails.js entry uses (Vanessa, Emry, Renarden's own
// village position, etc.) - NOT placeId 200's own spawn.y (0.4), which is
// tuned for the PLAYER's spawn specifically: the player gets usePhysics:true
// (createMyCharacter.js), so gravity settles them onto the real ground
// regardless of the exact starting height. A duel opponent is usePhysics:false
// like every other NPC - nothing corrects a wrong y, so it needs the actual
// resting value directly.
const OPPONENT_SPAWN     = { x: 0, y: 0.01, z: 20 } // opposite side of the arena from placeId 200's own {x:0,z:-20} player spawn

// Gauntlet spacing - with more than one npcFighter, each independently
// chasing the player's exact position converges everyone onto the same
// point, which reads as the avatars merging into one. Two mitigations:
// 1) each opponent gets a fixed world-space angle slot (evenly divided among
//    however many are in this fight) and approaches a point offset from the
//    player at THAT angle/SURROUND_RADIUS, instead of the player's raw
//    position directly - so they naturally spread out around the player as
//    they close in, rather than beelining to the same spot.
// 2) a periodic separation pass (startDuel's own interval, not per-opponent)
//    as a reactive safety net for whenever the slots alone still end up too
//    close (tight angular spacing with 3+ fighters, player backed into a
//    corner, etc.) - nudges any pair of alive opponents apart directly.
// deliberately INSIDE ATTACK_RANGE, not equal to it - a slot target sitting
// exactly on the range boundary meant "arrived at slot" (tdist~0, stops
// moving) and "within attack range" (dist<=ATTACK_RANGE, switches out of
// RUNNING) could disagree by a hair of float slack, leaving him stopped but
// still tagged as RUNNING forever - frozen mid-stride, never engaging. This
// margin guarantees reaching the slot always lands comfortably inside range.
const SURROUND_RADIUS          = ATTACK_RANGE * 0.7
const SEPARATION_CHECK_MS      = 200
// how long an opponent has to have actually LEFT attack range before the
// chase movement resumes - see readyToChase's own comment in
// spawnDuelOpponent for the vibrating-in-place bug this debounces
const CHASE_REENGAGE_DELAY_MS  = 200

// npcDetails.js's skills.nearSkill (dashstrikeSkill on Renarden) - a melee
// gap-closer, only worth rolling at exactly the range where a ranged
// projectile skill feels wrong (too close) but a normal swing can't reach
// yet (too far) - see performOpponentDashStrike's own header comment.
const NEAR_SKILL_MIN_DIST = 2
const NEAR_SKILL_MAX_DIST = 3
// how often nearSkill's own eligibility gets rolled - deliberately its OWN
// much faster cadence, NOT the 5-6s SKILL_CHECK_MIN/MAX_MS interval the
// ranged basic/serious/hidden skills use. The 2-3 unit band above is only
// occupied for a fraction of a second while closing in (CHASE_SPEED=3
// units/sec crosses that 1-unit band in ~330ms) - rolling this on the same
// rare 5-6s cadence meant the check almost never actually landed while the
// opponent was in that band at all, which is why it read as "never dashes"
// rather than "dashes sometimes." Cheap enough (one Vector3.Distance plus a
// couple comparisons) to run this often.
const NEAR_SKILL_CHECK_MS = 150
// "randomly sometimes they want to do this sometimes they don't" - rolled
// fresh every runSkillCheck tick the distance window is met, same as every
// other skill roll in this file
const NEAR_SKILL_CHANCE   = 0.5

// npcDet.battleSpeech.whileFighting (npcDetails.js) - how often the check
// itself re-rolls, plus BATTLE_SPEECH_CHANCE on top gating whether it
// actually says something that particular tick
const BATTLE_SPEECH_MIN_MS = 6000
const BATTLE_SPEECH_MAX_MS = 12000
const BATTLE_SPEECH_CHANCE = 0.5
const MIN_OPPONENT_SEPARATION  = 1.8 // more than 2x capsuleRadius (0.25) - enough that two capsules visibly don't overlap

// Skill AI (npcDetails.js's Renarden: skills.basicSkill/seriousSkill/hiddenSkill,
// full skill objects, not name-string lookups into SKILLS_BY_NAME like real
// enemies use). Re-rolled every 5-6s (randomized per tick, not a fixed
// interval) rather than createEnemy.js's own fixed 10s ENEMY_SKILL_CHECK_INTERVAL_MS -
// each skill's own skillCoolDown still gates how often THAT specific skill
// can actually fire even if the roll succeeds every tick.
const SKILL_CHECK_MIN_MS   = 5000
const SKILL_CHECK_MAX_MS   = 6000
const SKILL_RANGE          = 9 // "maybe 7-10" - one value in that band, not worth rolling separately per check
const SERIOUS_HP_THRESHOLD = 0.5  // seriousSkill becomes AVAILABLE (alongside basic, not replacing it) at/under 50% hp
const HIDDEN_HP_THRESHOLD  = 0.08 // at/under 8% hp, ONLY hiddenSkill can fire - basic/seriousSkill stop entirely

// hit/death names still aren't confirmed against the actual rig from here (no
// way to inspect the .glb directly) - playFirstAction below warns to console
// instead of throwing if a name is wrong, so a bad guess costs a missing
// animation, not a crash - fix the name here if the console flags it.
// The attack itself is no longer a guess-list - uimanagement.js confirmed
// "punch1"/"kick1" both exist and are the player's own unarmed combo, so the
// opponent (no weapon - see npcDetails.js's Renarden, items:[]) uses the
// exact same two clips, alternated the same way.
const HIT_CLIP_CANDIDATES    = ["hit1", "hit"]
const DEATH_CLIP_CANDIDATES  = ["death1", "death"]
// Dodge - purely reactive to PROXIMITY, not real hit-prediction (no aim-
// direction/trajectory math). In a 1v1 duel there's only ever one possible
// threat source (the player), so "something dangerous is near me right
// now" is already an accurate enough signal without reasoning about where
// a swing/bolt is actually aimed. Checked on its own fast interval
// (DODGE_CHECK_MS), independent of every other AI loop in this file.
const DODGE_CHECK_MS       = 200
const DODGE_CHANCE         = 0.45
const DODGE_COOLDOWN_MS    = 2500
// wider than ATTACK_RANGE (1.5) - needs real lead time to actually clear
// the hitbox before a swing already in progress lands, not just react to
// one that's already connecting
const DODGE_MELEE_RANGE      = 2.5
const DODGE_PROJECTILE_RANGE = 4
// melee ("back") only needs to clear the atkCollider's own reach - it was
// jumping the full 3-5 units projectiles need to clear a bolt's whole hitbox,
// which reads as a wildly overshot leap for "just don't get hit by the
// sword swing right in front of me." ATTACK_RANGE (1.5) is this file's own
// existing estimate of how far a melee swing can actually reach - landing
// a bit past that is "just enough," not a full retreat.
const DODGE_MELEE_MIN_DIST      = 1.4
const DODGE_MELEE_MAX_DIST      = 2.2
// projectiles keep the wider hop - a bolt's own hitbox/travel line needs
// more clearance than a fixed-reach swing does
const DODGE_PROJECTILE_MIN_DIST = 3
const DODGE_PROJECTILE_MAX_DIST = 5
const DODGE_DURATION_MS    = 220

// --- npcFighter "attitude" (npcDetails.js's Renarden/Vesper own attitude:{}
// fields) - the new per-fighter personality system this whole block powers.
// Six 0-1 sliders, each read as a probability/tendency, not a hard on/off:
//   weapon        - rolled ONCE at spawn (isMeleeFighter below): does this
//                    fighter ever close to melee range and swing at all?
//                    1 = always (Renarden, today's only behavior), 0 = never
//                    (Vesper - "she does not charge the player she only
//                    standby and casting")
//   dodging       - replaces the old flat DODGE_CHANCE constant per-fighter
//   blocking      - NEW: a reactive weaponBlocking stance (see performBlock)
//                    a melee threat can trigger, same detection rollDodge
//                    already does, just a different reaction
//   standbycasting - rolled ONCE at spawn: does this fighter use the NEW
//                    "cast a flurry of whatever's off cooldown" AI
//                    (runStandbyCastCheck) instead of the OLD hp-tiered
//                    single-skill roll (runSkillCheck/basicSkill/
//                    seriousSkill/hiddenSkill)? 0 (or missing attitude
//                    entirely, e.g. Robin) keeps today's exact behavior.
//   distancing    - "running away" - a caster actively backing off to hold
//                    PREFERRED_CAST_RANGE instead of just standing still.
//                    Only read in the non-melee (caster) branch of
//                    chaseObserver below - Renarden's own melee branch never
//                    looks at this at all, so his distancing:0 isn't even
//                    load-bearing, it's just honest about "he doesn't have
//                    a running-away mode" per spec.
//   continuescast - after a cast/flurry, chance to immediately queue
//                    another one soon (CONTINUE_CAST_DELAY_MS) instead of
//                    waiting out the normal randomized interval again
//
// DEFAULT_ATTITUDE reproduces today's exact hardcoded behavior for any
// npcFighter with no attitude field at all (Robin) - always melees, flat
// DODGE_CHANCE, never blocks/distances/continue-casts, and stays on the old
// hp-tiered skill model (standbycasting:0 means the isStandbyCaster roll
// below can never come up true).
const DEFAULT_ATTITUDE = { weapon: 1, dodging: DODGE_CHANCE, blocking: 0, standbycasting: 0, distancing: 0, continuescast: 0 }

// Blocking - same detection/cadence rollDodge's own DODGE_CHECK_MS/
// DODGE_MELEE_RANGE already use, just a different reaction (a real
// weaponBlocking stance instead of hopping away) and its own cooldown so a
// fighter with both high dodging and high blocking doesn't spam one or the
// other every single tick.
const BLOCK_CHECK_MS    = 200
const BLOCK_DURATION_MS = 1200
const BLOCK_COOLDOWN_MS = 2000

// Distancing ("running away") - how often a caster re-rolls whether it
// currently WANTS to hold distance (wantsDistance below), and how close is
// "too close for comfort". Inside SKILL_RANGE (9) but well outside
// ATTACK_RANGE (1.5) - "distance herself... for effective casting", not
// fleeing to the edge of the map.
const DISTANCE_CHECK_MS     = 500
const PREFERRED_CAST_RANGE  = 7
const RETREAT_SPEED         = CHASE_SPEED // same read/speed as closing the gap, just the opposite direction

// Standby-casting (attitude.standbycasting) - a much more eager cadence
// than the old SKILL_CHECK_MIN/MAX_MS (5-6s, tuned for an occasional-skill
// melee fighter) - a fighter who ONLY casts is supposed to read as far
// busier than that. STANDBY_CAST_STAGGER_MS is the gap between each skill
// in one "flurry" (runStandbyCastCheck) - "cast all together, but with
// style" per spec, a quick staggered sequence rather than one skill at a
// time OR all in the exact same frame.
const STANDBY_CAST_CHECK_MIN_MS = 2500
const STANDBY_CAST_CHECK_MAX_MS = 4000
const STANDBY_CAST_STAGGER_MS   = 500
const CONTINUE_CAST_DELAY_MS    = 800

// npcDet.hiddencombo (Vesper's own blinkstrike->massivedisintegration loop)
// activates once and for the rest of the fight once hp drops to/below this -
// "when her life is 30% below" per spec. Never un-triggers (opponents have
// no heal-back mechanic in this file at all, hp is monotonically decreasing).
const HIDDEN_COMBO_HP_THRESHOLD = 0.3

// Guaranteed-critical multiplier for performOpponentBlinkstrike's own
// landed strike - calcOpponentDmg's own header comment already establishes
// there's no real calcDmg/crit pipeline on the opponent's attack side at
// all, just a flat formula; this is that same file's own flat stand-in for
// "guaranteed crit" (skillsData.js's blinkstrikeSkill criticalPercent:1 on
// the PLAYER side has a real crit-chance buff to hook into - critChance
// buffs/CRIT_CHANCE_CAP don't exist on this side to reuse).
const BLINK_CRIT_MULTIPLIER = 1.5
// same 1.2 default skillsData.js's own blinkstrikeSkill.blink.landOffset
// uses - only a fallback here (npcDetails.js's hiddencombo entry sets its
// own blink.landOffset explicitly anyway)
const BLINK_LAND_OFFSET_DEFAULT = 1.2

// player -> opponent melee hit sound, keyed off the ATTACKER's own equipped
// weaponType (charState.items, not the opponent's) - a swing should sound
// like whatever weapon actually swung. "sword"/"axe" (both blade-on-body
// impacts) and unarmed/no weapon all fall back to swordS1 as the default;
// spear gets its own spearS1 (same sound the flamebrand/lightningbolt/
// tsunamiwrath skill projectiles already launch with, see skillsData.js);
// staff gets its own dedicated staffS1 (a real "./sounds/weapons/staffS1.mp3"
// asset already registered in soundSystem.js but never actually played
// anywhere until now - a staff is a stick, shouldn't sound like a blade landing)
const WEAPON_HIT_SOUNDS = {
    sword: "swordS1",
    axe: "swordS1",
    pickaxe: "swordS1",
    spear: "spearS1",
    staff: "staffS1",
}
const DEFAULT_HIT_SOUND = "swordS1"

// Tries each candidate clip name against the opponent's own real
// characterAnimations (createFighterNpc gives every duel opponent one now,
// not a hand-rolled stand-in) until playAction() finds one that exists.
function playFirstAction(charAnims, allAnims, candidates, opts = {}){
    for(const name of candidates){
        if(charAnims.playAction(allAnims, name, opts.speedRatio ?? 1, opts.onComplete ?? null, opts.freezeAfter ?? false, opts.nextState ?? null)) return true
    }
    console.warn("playFirstAction: none of these clips exist on this rig:", candidates)
    return false
}

function toLines(name, messages){
    return messages.map(message => ({ name, isLeft: false, message }))
}

// Walking up to any characterType:"npcFighter" NPC (createAllNpcInArea.js
// calls this after their randomSpeech plays) offers the same three answers
// for every fighter, parameterized by whichever NPC's body was just talked
// to - no per-NPC dialogue file needed.
export function offerDuel(npcDet){
    // already beaten this exact npc (charState.defeatedMonsters, see
    // grantDuelWinRewards's own comment) - drop the challenge answer
    // entirely instead of offering a rematch against someone already proven
    const alreadyDefeated = getCharState()?.defeatedMonsters?.includes(npcDet._id)
    const answers = [
        { text: "Hi", cb: () => startConv(toLines(npcDet.name, ["Just saying hello, nothing more."]), () => {}) },
        ...(alreadyDefeated ? [] : [{ text: "Want to check who's stronger?", cb: () => acceptDuel(npcDet) }]),
        { text: "I'll be on my way.", cb: () => startConv(toLines(npcDet.name, ["Suit yourself. The offer stands whenever you're ready."]), () => {}) },
    ]
    showAnswerButtons(answers, (indx) => answers[indx].cb())
}

// Same transition procedure Halric's office teleport / the wagon's "Travel"
// answer both use - findPlaceMetaData -> set currentPlace/x/y/z from the
// destination's own spawn -> save -> exitScene -> changeScene. Who you
// actually fight isn't tracked here at all anymore - the destination arena's
// own placeDetail.npcEnemies list is authoritative (see startDuel), so
// there's no per-player transient state to carry across the teleport.
async function acceptDuel(npcDet){
    const duelGrounds = findPlaceMetaData(DUEL_PLACE_ID)
    if(!duelGrounds) return console.warn("acceptDuel: duel grounds (placeId 200) not found")

    await travelToPlace({
        placeId: duelGrounds.placeId,
        name: duelGrounds.name,
        areaType: duelGrounds.areaType,
        x: duelGrounds.spawn.x,
        y: duelGrounds.spawn.y,
        z: duelGrounds.spawn.z,
    })
}

// Opponent's outgoing damage - "enemy-attacked"'s own damage-to-player path
// (worldsocket.js) never calls calcDmg (that's player-only, computed from
// player stats/equipped weapon), and the server's own enemy damage is
// computed from whatever genenemy.ts set up - neither is reachable/relevant
// here. This is a minimal stand-in shaped the same way (strength + weapon
// stat), just derived from the opponent npcDet's own stats instead.
function calcOpponentDmg(npcDet){
    const { stats } = npcDet
    return Math.round((stats.strength ?? 1) * 4 + (stats.weapon ?? 1) * 6)
}

// Called once from areascene.js's "duel" case, right after createDuelArena -
// same "who builds what" split areascene.js already uses for room/village.
// Loops placeDetail.npcEnemies (localroomdb.js) - the arena's own place data
// is authoritative for who's fighting here, not any per-player transient
// state. No-ops quietly if the place has no npcEnemies declared.
export function startDuel(scene, characterBody, placeDetail){
    const npcEnemies = placeDetail.npcEnemies || []
    if(!npcEnemies.length){
        return
    }

    // shared across every opponent spawned for this fight - each
    // spawnDuelOpponent() call below registers itself in here (see its own
    // duelOpponents.push), so the separation pass further down can see
    // everyone's current body/alive-state without needing its own copy of
    // npcEnemies or per-opponent module-level state.
    const duelOpponents = []

    // shared "has the PLAYER lost this fight" flag - a plain object so every
    // spawnDuelOpponent() closure below can read/write the SAME value
    // (primitives can't be shared by reference). Each opponent used to keep
    // its own local `playerDefeated`, which meant a 2v1 gauntlet only ever
    // actually stopped the ONE opponent who landed the finishing blow - the
    // others had no idea the fight was over and kept chasing/attacking/
    // dodging indefinitely (confirmed from an actual screenshot: the "Ha!
    // Down you go" line was up while two fighters were still visibly
    // swinging at each other). duelState.playerDefeated is the single
    // source of truth now - opponentDefeated stays per-opponent local
    // though (correctly so - one fighter losing doesn't mean they all did).
    const duelState = { playerDefeated: false }

    // npcEnemies.js's own new shape (localroomdb.js's placeId 200) - each
    // top-level entry is a MAIN opponent, optionally carrying its own
    // `assistants` array of mooks fighting alongside it. Only defeating a
    // MAIN opponent ends the duel/grants rewards (see grantDuelWinRewards's
    // own isMainOpponent gate below) - killing any number of assistants on
    // their own does nothing but remove that one fighter. Flattened into
    // one ordered list here (main entries and their own assistants side by
    // side) so slotIndex/totalOpponents (surround-slot spacing) accounts
    // for EVERY fighter in the encounter, not just the top-level entries -
    // otherwise every assistant would collapse onto the exact same spacing
    // slot as their own main opponent.
    const allFighters = []
    npcEnemies.forEach(mainEntry => {
        allFighters.push({ npcId: mainEntry.npcId, position: mainEntry.position, isMainOpponent: true })
        ;(mainEntry.assistants || []).forEach(assistant => {
            allFighters.push({ npcId: assistant.npcId, position: assistant.position, isMainOpponent: false })
        })
    })

    allFighters.forEach(({ npcId, position, isMainOpponent }, index) => {
        spawnDuelOpponent(scene, characterBody, npcId, placeDetail, position, index, allFighters.length, duelOpponents, duelState, isMainOpponent)
    })

    // Reactive safety net - the per-opponent surround-slot targeting
    // (spawnDuelOpponent's own chase loop) already spreads fighters out by
    // construction, but this catches the cases that alone can't (tight
    // angular spacing with 3+ fighters, the player backed into a corner,
    // etc.) by directly nudging apart any pair still too close.
    const separationInterval = setInterval(() => {
        for(let i = 0; i < duelOpponents.length; i++){
            const a = duelOpponents[i]
            if(!a.isAlive()) continue
            for(let j = i + 1; j < duelOpponents.length; j++){
                const b = duelOpponents[j]
                if(!b.isAlive()) continue

                const dx = b.body.position.x - a.body.position.x
                const dz = b.body.position.z - a.body.position.z
                const dist = Math.hypot(dx, dz)
                if(dist >= MIN_OPPONENT_SEPARATION || dist < 0.001) continue

                // split the correction evenly - push each half the
                // overlap away from the other, along the line between them
                const overlap = (MIN_OPPONENT_SEPARATION - dist) / 2
                const nx = dx / dist
                const nz = dz / dist
                a.body.position.x -= nx * overlap
                a.body.position.z -= nz * overlap
                b.body.position.x += nx * overlap
                b.body.position.z += nz * overlap
            }
        }
    }, SEPARATION_CHECK_MS)
    // this interval isn't owned by any single opponent's own stopFight() -
    // it outlives any one of them (still needs to run as long as at least
    // two are alive) - tied to the scene itself instead, same lifetime every
    // other per-scene resource in this file already assumes
    scene.onDisposeObservable.addOnce(() => clearInterval(separationInterval))
}

// One fighter's full combat wiring - spawn, hp bar, chase/attack loop, both
// directions of damage. Pulled out of startDuel so a future npcEnemies list
// with more than one entry (a gauntlet) just calls this once per entry.
function spawnDuelOpponent(scene, characterBody, npcId, placeDetail, position, slotIndex, totalOpponents, duelOpponents, duelState, isMainOpponent){
    // fixed world-space angle this opponent tries to approach/hold the
    // player from, evenly divided among however many are in this fight (2
    // fighters -> opposite sides, 3 -> ~120° apart, etc.) - see the const
    // block above for why this exists
    const surroundAngle = (2 * Math.PI / totalOpponents) * slotIndex
    const npcDet = npcDetails.find(npc => npc._id === npcId)
    if(!npcDet) return console.warn("spawnDuelOpponent: opponent npc not found for id", npcId)

    // npcDet.attitude (see DEFAULT_ATTITUDE's own header comment) - merged
    // over the defaults rather than requiring every field, so a future
    // npcFighter can set just the sliders it cares about (e.g. only
    // {blocking:0.3}) and get today's default behavior everywhere else
    const attitude = { ...DEFAULT_ATTITUDE, ...(npcDet.attitude || {}) }
    // rolled ONCE per fight, not re-rolled per frame/tick - a fighter is
    // either "the kind that closes to melee" or "the kind that doesn't" for
    // the whole duel, not flip-flopping tick to tick. weapon:1 (Renarden) ->
    // always true (today's exact behavior); weapon:0 (Vesper) -> always false
    const isMeleeFighter = Math.random() < attitude.weapon
    // same one-roll-per-fight shape - which skill-casting AI this fighter
    // uses for the whole duel (see runStandbyCastCheck's own header comment
    // for what standbycasting actually changes). standbycasting:0 (Robin,
    // Renarden, or any npcFighter with no attitude field at all) can never
    // roll true here, so they always stay on the untouched old model.
    const isStandbyCaster = Math.random() < attitude.standbycasting

    // per-entry position (localroomdb.js's npcEnemies[i].position) if it was
    // actually given a real value, else OPPONENT_SPAWN's default - `?? undefined`-
    // safe against a bare `position: {}` placeholder (x/y/z all undefined on
    // that object still falls through to the default via ??)
    const spawnPos = {
        x: position?.x ?? OPPONENT_SPAWN.x,
        y: position?.y ?? OPPONENT_SPAWN.y,
        z: position?.z ?? OPPONENT_SPAWN.z,
    }

    // same spreading convention createnpc.js already uses internally for
    // glbPath:null npcs - owner/ownerId default to the npc's own _id, which
    // is also what names the resulting body mesh (createcharacter.js's
    // createCapsuleBody: `player.${ownerId}`) - registerToAtkCollider below
    // matches on that name. x/y/z overridden to this arena's spawn spot
    // instead of the npc's own normal-location position, and BOTH place
    // fields to this arena instead of wherever the npc's own entry says it
    // normally is - currentPlace (nested) is what createCharacter.js's full
    // path reads (det.currentPlace.placeId, see npcDetails.js's own comment
    // on Renarden's currentPlace field), but currentPlaceId (flat) is a
    // SEPARATE field skillEffects.js's fireEnemySkillProjectile stamps onto
    // every cast projectile (placeId: enemy.det.currentPlaceId) - missing
    // this one left projectiles spawning with placeId:1 (Renarden's real
    // village location) while the player stood in placeId:200, so
    // renderer.js's own per-frame projectile-move loop (`if(charState.
    // currentPlace.placeId !== proj.placeId) return`) silently skipped
    // moving them every single frame - spawned, faced the right way, never
    // actually traveled.
    const spawnDet = {
        ...npcDet,
        owner: npcDet.owner ?? npcDet._id,
        ownerId: npcDet.ownerId ?? npcDet._id,
        x: spawnPos.x, y: spawnPos.y, z: spawnPos.z,
        _dirTarg: { x: spawnPos.x, z: -100 }, // faces the player's spawn side
        currentPlaceId: placeDetail.placeId,
        currentPlace: { placeId: placeDetail.placeId, name: placeDetail.name, areaType: placeDetail.areaType },
    }
    // createFighterNpc (not createNpc) - gives this opponent the same
    // characterAnimations/equip* rig the player has, which is what actually
    // makes him able to fight (createNpc's usual isNpc:true path has neither).
    const opponent = createFighterNpc(scene, spawnDet)
    if(!opponent) return console.warn("spawnDuelOpponent: failed to build opponent body")


    const charState = getCharState()
    let opponentDefeated = false
    // NOT a local `let` anymore - see duelState's own comment in startDuel
    // for why this is now shared across every opponent in the gauntlet

    // registers this fighter into the shared list startDuel's separation
    // interval iterates - isAlive as a getter (not a snapshot) since
    // opponentDefeated is still false at this exact point but will flip
    // later, and the closure needs to see the live value each check
    // stopFight itself isn't defined until further down (below) - wrapped in
    // a lambda so this only actually resolves the `const stopFight` binding
    // when CALLED (well after spawnDuelOpponent has fully returned), not at
    // this push, which would hit the temporal dead zone
    duelOpponents.push({ body: opponent.body, isAlive: () => !opponentDefeated, stopFight: () => stopFight() })
    // shared registry (sockets/worldsocket.js) - lets creations/skillEffects.js's
    // hit-registration sites (the player's skill-wheel spells) target this
    // opponent the same way they already target real, server-tracked
    // enemies. applyDamage below is the same local damage path melee uses.
    pushDuelOpponentOnScene({ body: opponent.body, applyDamage: applyDamageToOpponent })
    // also exposed directly on the raw opponent object (not just the
    // registry wrapper above) - skillEffects.js's castEnemySkill is called
    // with THIS object as its own `enemy` param (this file's own
    // castEnemySkill(scene, opponent, skill, targetPlayer) call below), and
    // needs enemy.applyDamage to redirect a CURSED opponent's own skill-cast
    // damage back onto itself the same way a real wild enemy's redirect does
    opponent.applyDamage = applyDamageToOpponent

    let hp = npcDet.hp
    const maxHp = npcDet.maxHp
    const { hpbar } = createHpBar(capsuleHeight + 0.3, npcDet._id, opponent.body, hp, maxHp)

    let attackInterval = null
    let inCombatRange = false
    // debounces the chase re-engage right at the ATTACK_RANGE boundary - a
    // player standing/moving slowly right around that exact distance makes
    // `dist` flicker a hair above/below ATTACK_RANGE from one frame to the
    // next (both bodies moving, floating-point noise), which without this
    // flips the opponent between "step forward" (chasing) and "stop"
    // (engaged) every single frame - reads as vibrating in place instead of
    // either running or holding still. readyToChase gates the movement
    // branch below; it only flips back to true CHASE_REENGAGE_DELAY_MS after
    // actually leaving range, not the instant it happens, so a momentary
    // flicker back into range cancels the pending re-chase instead of
    // re-arming it from a stale timer
    let readyToChase = true
    let reengageTimeout = null
    // true for the duration of performOpponentDashStrike's own dash below -
    // chaseObserver's normal per-frame movement (toward the surround slot)
    // runs on this SAME body every single frame too, and was fighting the
    // dash's own locallyTranslate calls the entire time this was true only
    // implicitly (never actually suppressed) - the two systems adding
    // position deltas through different paths on the same frame is exactly
    // what made the dash read as barely moving/jittery instead of a clean
    // lunge. chaseObserver skips its own movement (but still ticks the
    // animation blend) while this is true.
    let isDashStriking = false
    // same "something else owns position/facing right now" suppression
    // isDashStriking's own comment above describes - chaseObserver backs
    // off its own movement while this is true too, same reasoning
    let isDodging = false
    let dodgeCooldownUntil = 0
    // same "something else owns position/facing right now" idea isDodging's
    // own comment gives - performBlock doesn't move the body at all, but
    // still shouldn't overlap a dodge (rollDodge/rollBlock both check the
    // other's own flag so only one reaction fires per threat)
    let isBlocking = false
    let blockCooldownUntil = 0
    // distancing ("running away") - re-rolled on its own DISTANCE_CHECK_MS
    // interval (rollDistance below) rather than continuously, so a mid-range
    // value doesn't flicker between advancing/retreating every single frame.
    // Only ever read in chaseObserver's own non-melee (caster) branch - see
    // DEFAULT_ATTITUDE's own header comment for why this is safely inert
    // for a melee fighter like Renarden regardless of his own distancing value.
    let wantsDistance = false
    // same "something else owns position/facing right now" suppression
    // isDashStriking/isDodging already use - set by castOpponentSkill below
    // for the real cast window (skill.castDuration), so chaseObserver's own
    // per-frame RUNNING/COMBAT_IDLE calls don't stomp the CASTING pose the
    // instant it's set
    let isCasting = false
    let comboNum = 1 // alternates punch1/kick1 (unarmed) or swordattack1/2 (armed) each swing - same combo/toggle pattern uimanagement.js's own swordAnimNum drives for the player

    // if this npc spawned with an equiped weapon item (npcDetails.js), it's
    // sitting sheathed on their back right now - createcharacter.js's own
    // weapon-equip block (run once at spawn) parents it to weaponSocket
    // instead of rHand whenever det.mode !== "fighting", which is exactly
    // Renarden's default det.mode ("idle"). hasDrawnWeapon gates the one-time
    // draw transition below to the FIRST attack only.
    const equippedWeapon = npcDet.items?.find(itm => itm.itemType === "weapon" && itm.equiped)
    let hasDrawnWeapon = false

    // per-skill cooldown, not one shared one - basic/seriousSkill/hiddenSkill
    // each carry their own skillCoolDown (1500/2200/14000ms respectively on
    // Renarden) and should track independently, same as real enemies do
    // per-skill in createEnemy.js (enemySkillCooldownUntil there is only
    // single-skill because a real enemy only ever has one skill at a time)
    // extra keys (e.g. Vesper's own thunderclap/multishotskill/zoltraak, see
    // getCastableSkillEntries) get added to this SAME object dynamically the
    // first time runStandbyCastCheck fires one - a plain object handles an
    // unknown key fine (undefined -> ?? 0 falls through to "off cooldown"),
    // no need to pre-declare every possible key the way the original four did
    const skillCooldownUntil = { basicSkill: 0, seriousSkill: 0, hiddenSkill: 0, nearSkill: 0 }
    let skillCheckTimeout = null
    // runStandbyCastCheck's own reschedule handle (isStandbyCaster fighters
    // only - see that function's own header comment)
    let standbyCastTimeout = null
    // npcDet.hiddencombo (see HIDDEN_COMBO_HP_THRESHOLD's own header comment) -
    // isHiddenComboActive latches true forever once hp crosses the threshold
    // (opponents never heal back up in this file), hiddenComboIndex tracks
    // which entry in the array fires next, looping back to 0 past the end
    let isHiddenComboActive = false
    let hiddenComboIndex = 0
    let hiddenComboTimeout = null

    const stopFight = () => {
        clearInterval(attackInterval)
        clearTimeout(skillCheckTimeout)
        clearTimeout(standbyCastTimeout)
        clearTimeout(hiddenComboTimeout)
        clearTimeout(reengageTimeout)
        clearInterval(nearSkillCheckInterval)
        clearTimeout(battleSpeechTimeout)
        clearInterval(dodgeCheckInterval)
        clearInterval(blockCheckInterval)
        clearInterval(distanceCheckInterval)
        scene.onBeforeRenderObservable.remove(chaseObserver)
        removeDuelOpponentOnScene(opponent.body)
    }

    // Called once the duel is fully over (win OR lose) as the callback for
    // the "Ha!/...alright" dialogue's own "next" button - without this, the
    // dialogue just closes and does nothing, leaving the player stuck inside
    // placeId 200 with no way out (confirmed: this was previously a no-op
    // () => {} at every one of these call sites). Same exact teleport-out
    // sequence createduelarena.js's own walk-to-the-south-wall exit trigger
    // already uses (findPlaceMetaData -> set currentPlace/x/y/z from the
    // destination's own spawn -> save -> exitScene -> changeScene), just
    // triggered by the post-fight dialogue instead of walking to the exit.
    async function returnToExitPlace(){
        const exitPlaceDetail = placeDetail.exitPlaceDetail
        if(!exitPlaceDetail) return console.warn("[duel] no exitPlaceDetail on this arena - can't send the player anywhere after the fight")

        const destMeta = findPlaceMetaData(exitPlaceDetail.placeId)
        if(!destMeta) return console.warn(`[duel] findPlaceMetaData found nothing for exitPlaceDetail.placeId ${exitPlaceDetail.placeId}`)

        await travelToPlace({
            placeId: exitPlaceDetail.placeId,
            name: exitPlaceDetail.name,
            areaType: exitPlaceDetail.areaType,
            x: destMeta.spawn.x,
            y: destMeta.spawn.y,
            z: destMeta.spawn.z,
        })
    }

    // Shared damage-application path for anything that can hit this
    // opponent - melee (registerToAtkCollider below) AND the player's own
    // offensive skills (creations/skillEffects.js, via the
    // duelOpponentsOnScene registry pushed further down). Pulled out so both
    // paths share one hp/hpbar/popup/hit-anim/death sequence instead of
    // duplicating it.
    // hitDetails: { weaponType, hitSound, isPhysical } - weaponType/hitSound
    // only ever passed by the melee call site below (weapon-aware); the
    // magic-skill call sites (skillEffects.js, via this opponent's own
    // duelOpponentsOnScene registration) don't pass anything, defaulting to
    // {} - those already play their own impact sound (playImpactSound), no
    // double-up, and have no "weaponType" concept of their own to begin
    // with. weaponType itself isn't consumed by anything yet beyond
    // resolving hitSound at the call site, but kept as its own field (not
    // collapsed into just the sound key) so it's available here for
    // anything else that might want to key off it later - a different hit
    // reaction per weapon type, etc. isPhysical is the same idea, just for
    // opponent.weaponBlocking below: only the melee call site (a real
    // sword/fist swing, dashstrike included - see strikeWithHandCollider's
    // own comment on why dashstrike rides this exact same atkCollider
    // trigger) sets it true, so a blocking opponent nullifies melee hits
    // but still takes a mage's elemental skill damage same as always -
    // "weapon blocking" shouldn't stop a fireball.
    function applyDamageToOpponent(dmgToApply, hitDetails = {}){
        if(opponentDefeated || duelState.playerDefeated) return

        // cursed player - "when you attack, your own damage backfires on
        // you" (skillsData.js's curse effect entries) - the player's own
        // mirror of createEnemy.js/worldsocket.js's cursed-ENEMY redirect
        // (characterstate.js's isPlayerCursed/curseStatusEffect). Bypasses
        // opponent.weaponBlocking entirely below - the swing never actually
        // reaches the opponent in this case, nothing for a block to stop.
        if(isPlayerCursed()){
            deductHp(dmgToApply, [])
            return
        }

        const { weaponType, hitSound, isPhysical, skill } = hitDetails

        if(isPhysical && opponent.weaponBlocking){
            // read live off opponent.weaponBlocking (createcharacter.js),
            // not a snapshot - so a stance flipped mid-fight takes effect on
            // the very next swing. No hp/hpbar change, no blood, no hit
            // clip - "weaponblock" is the same block-reaction pose
            // performDodge's own "back" branch already plays, reused here
            // for the same reason: a real animation confirmed to exist on
            // this rig (see HIT_CLIP_CANDIDATES' own header comment on
            // unconfirmed clip names elsewhere in this file)
            playFirstAction(opponent.characterAnimations, opponent.anims, ["weaponblock"], { nextState: null })
            getAllSounds().weaponblockS?.play()
            poppingTextMesh("Blocked!", "cyan", 40 + Math.random() * 25, Math.random() * 1, { x: -1 + Math.random() * 2, y: capsuleHeight / 2 + .5, z: -1 + Math.random() * 2 }, opponent.body, true)
            return
        }

        hp = Math.max(0, hp - dmgToApply)
        hpbar.width = `${hp / maxHp * 100 * 3}px`
        // npcDet.hiddencombo (Vesper's own blinkstrike->massivedisintegration
        // loop) - hp is the only thing that ever changes in this function
        // that could newly cross HIDDEN_COMBO_HP_THRESHOLD, so this is the
        // one natural place to check it rather than a separate polling timer
        checkHiddenComboTrigger()
        if(hitSound) getAllSounds()[hitSound]?.play()
        // same poppingTextMesh call/color/jitter createEnemy.js's own
        // enemyIsHit already uses for "you damaged this thing" - capsuleHeight
        // instead of that function's enemy.det.bodyHeight since this opponent
        // uses the standard player-style capsule, not a monster body
        poppingTextMesh(`-${Math.floor(dmgToApply)}`, "red", 40 + Math.random() * 25, Math.random() * 1, { x: -1 + Math.random() * 2, y: capsuleHeight / 2 + .5, z: -1 + Math.random() * 2 }, opponent.body, true)
        // nextState:null falls back to characterAnimations' own current
        // state once the hit reaction ends (running or combatIdle, whichever
        // the chase loop below most recently set) - no need to track it here
        playFirstAction(opponent.characterAnimations, opponent.anims, HIT_CLIP_CANDIDATES)
        // bloodps (createcharacter.js's createBloodSplatter, emitter parented
        // to spineBone) - opponent is built via createFighterNpc's full
        // createCharacter() rig, same as the player, so it already has one.
        // play() is a one-shot "start, then auto-stop" burst (default 1000ms),
        // same call skillEffects.js's own stickBriefly hit reaction already
        // uses for a player getting hit by a skill
        opponent.bloodps?.play()

        // this skill's own curse effect (skillsData.js) - if it lands,
        // curses THIS opponent (mirrors a player's dark skill cursing a
        // wild enemy, skillEffects.js). Local flag only (no server relay -
        // duels are never multiplayer, same reasoning
        // duelOpponentsOnScene's own comment gives for skipping
        // emitEnemyIsHit/emitEnemyCurse entirely in this file) - read by
        // castEnemySkill (enemy._cursed, shared with real wild enemies) and
        // the melee/dash attack loops below (opponent._cursed) to redirect
        // this opponent's own future damage back onto itself. skill is
        // undefined for a plain melee swing - getSkillEffect(undefined, ...)
        // just resolves to undefined, no curse roll happens
        if(!opponent._cursed){
            const curseEffect = getSkillEffect(skill, "curse")
            if(curseEffect && Math.random() < (curseEffect.chance ?? 1)){
                opponent._cursed = true
            }
        }

        if(hp <= 0){
            opponentDefeated = true
            stopFight()
            playFirstAction(opponent.characterAnimations, opponent.anims, DEATH_CLIP_CANDIDATES, { freezeAfter: true })
            // isMainOpponent-gated - an assistant (localroomdb.js's own
            // per-main-entry `assistants` array) dying is just one fewer
            // fighter in the gauntlet, not a win: no dialogue (assistants
            // don't speak at all, per spec) and no grantDuelWinRewards -
            // only the MAIN opponent's own defeat actually ends the duel
            if(isMainOpponent){
                // battleSpeech.afterTheFightSpeech (npcDetails.js) if this
                // fighter has one - falls back to the old flat line for any
                // npcFighter that doesn't
                displaySpeech([
                    ...toLines(npcDet.name, [npcDet.battleSpeech?.afterTheFightSpeech || "...alright, alright. You've made your point."]),
                    { speech: "You Win!" }
                ], returnToExitPlace, undefined, true)
                grantDuelWinRewards()
            }
        }
    }

    // Shared damage-application path for anything that can hit the PLAYER
    // from this opponent - the regular attackInterval swing below AND
    // performOpponentDashStrike's own delayed-hit above. Mirrors
    // applyDamageToOpponent's own weaponBlocking gate, just for the reverse
    // direction: reads the LOCAL player's own weaponBlocking
    // (inputMovement.js's activateMouseControls, r-click hold-to-block)
    // straight off playersOnScene's own rig object - same live-flag idea,
    // just no isPhysical param needed here since every call site in this
    // file that deals damage to the player is already a melee weapon/fist
    // swing (npcFighters have no ranged/magic skill that hits the player
    // directly - basicSkill/seriousSkill/hiddenSkill all target the
    // OPPONENT's own aggro via castEnemySkill same as a real enemy would).
    async function applyDamageToPlayer(dmgToPlayer){
        const myOwnPlayer = getPlayersOnScene().find(pl => pl.owner === charState.owner)
        if(myOwnPlayer?.weaponBlocking){
            // no deductHp, no blood, no hit reaction - the swing never
            // landed. Sound + a distinct popup instead, same "Blocked!"
            // cyan text applyDamageToOpponent's own block branch already
            // uses for the reverse direction
            getAllSounds().weaponblockS?.play()
            poppingTextMesh("Blocked!", "cyan", 40 + Math.random() * 25, Math.random() * 1, { x: -1 + Math.random() * 2, y: capsuleHeight / 2 + .5, z: -1 + Math.random() * 2 }, characterBody, true)
            return
        }

        // equippedWeapon?.effectsWhenHit (npcDetails.js item data, e.g. a
        // fighter carrying the Majestic Sword) - deductHp's own effects loop
        // (characterstate.js) already knows how to apply a "burn" entry
        // (startBurnDamage - ticks hp AND spawns the same "wreathed in
        // flame" particle burnEffect uses elsewhere), so just needs the
        // weapon's own effectsWhenHit merged in alongside whatever effects
        // this npcFighter's own data already carries - no duel-specific burn
        // handling needed here at all.
        await deductHp(dmgToPlayer, [...(npcDet.effects || []), ...(equippedWeapon?.effectsWhenHit || [])], npcDet.stats)
        // orange (not red - red's already "damage I just dealt", see the
        // atkCollider hit handler above) so incoming vs outgoing damage
        // reads as visually distinct at a glance
        poppingTextMesh(`-${dmgToPlayer}`, "orange", 40 + Math.random() * 25, Math.random() * 1, { x: -1 + Math.random() * 2, y: capsuleHeight / 2 + .5, z: -1 + Math.random() * 2 }, characterBody, true)
        // bloodps lives on the PLAYER object (createMyCharacter.js's own
        // createCharacter() rig), not on characterBody (just the bare mesh
        // this closure was handed)
        myOwnPlayer?.bloodps?.play()
    }

    // Runs once, the moment the PLAYER wins this fight - grants
    // npcDet.reward.skills (renardenSkills, same object his own skills:
    // field points to - see npcDetails.js's own header comment on why
    // that's not a duplicated copy) and records the win so offerDuel can
    // stop offering the "Want to check who's stronger?" answer against this
    // exact npc next time (charState.defeatedMonsters, same array/pattern
    // createEnemy.js's own defeatedAmonster already uses for real monsters -
    // pushing npcDet._id here instead of a shared species name, since every
    // npcFighter is a unique individual, not a respawning species).
    // charState.defeatedFoes ({foeType, total} buckets - server/models/
    // charDetM.js) already exists server-side but had no client code ever
    // writing to it before this - matched against npcDet.race (both use the
    // same vocabulary: "human"/"monster"/"demon"/etc, see npcDetails.js).
    async function grantDuelWinRewards(){
        // titles FIRST, and AWAITED, before anything else below fires a
        // save - giveSkill() and the updateMyDetailsOL() call further down
        // both send the WHOLE in-memory charState via a blind full-document
        // overwrite (updateMyDetailsOL -> PATCH /updateall/:id ->
        // Character.findByIdAndUpdate(id, req.body) - every field present
        // gets written, nothing merged). receiveTitle does its OWN separate,
        // narrowly-scoped write (PATCH /claim-title/:id, touches only
        // `titles`) and only updates charState.titles locally once that
        // succeeds - if any of the OTHER saves below were still in flight
        // carrying the PRE-claim (stale/empty) titles array and happened to
        // reach the server AFTER the claim's own write, it would silently
        // stomp the just-granted title back out in the database, even
        // though this session's own local charState still looked correct
        // (this was the actual bug behind "pressing P also empties my
        // titles" - P/wipeAllItems() itself never touches titles at all,
        // it just happened to be the next save that exposed an already-
        // corrupted DB value from this exact race). Awaiting this first
        // guarantees charState.titles is already correct in memory before
        // any of those other saves ever fire, so even if THEY still race
        // each other, none of them can carry a stale titles value anymore.
        if(npcDet.titles?.length){
            for(const title of npcDet.titles){
                await receiveTitle(title)
            }
        }

        Object.values(npcDet.reward?.skills || {}).forEach(skill => giveSkill(skill))

        const foeBucket = charState.defeatedFoes?.find(f => f.foeType === npcDet.race)
        if(foeBucket) foeBucket.total++
        else console.warn(`[duel] no defeatedFoes bucket for foeType "${npcDet.race}" - skipping the counter (reward skills/defeatedMonsters still apply)`)

        if(!charState.defeatedMonsters.includes(npcDet._id)){
            charState.defeatedMonsters.push(npcDet._id)
        }

        receiveAchievement("first-duel")

        // reqType "duel" story quests (npcDetails.js, e.g. Colousa's own
        // "meet-colousa" quest - questRequirements:{reqType:"duel",
        // name:"114_colousa",...}) - same call shape createEnemy.js's
        // defeatedAmonster already uses for checkStoryQuestIfCompleted(
        // 'enemy', name) on a real monster kill. No-ops for every OTHER
        // duel (Renarden included) - checkStoryQuestIfCompleted only ever
        // matches a quest whose own reqType+name line up with what's passed
        // here, and nothing else in the game currently grants a "duel"
        // reqType quest.
        checkStoryQuestIfCompleted('duel', npcDet._id)

        updateMyDetailsOL(charState, checkIfTokenSaved())
    }

    // npcDet.skills.nearSkill (dashstrikeSkill) - a MELEE gap-closer, not a
    // ranged cast like basicSkill/seriousSkill/hiddenSkill above, so it can't
    // go through castEnemySkill/fireEnemySkillProjectile at all (projectile-
    // only, no melee-dash concept). This is a dedicated local equivalent of
    // castDashSkill (creations/skillEffects.js) built specifically for this
    // opponent instead of reusing that function directly - castDashSkill is
    // entirely PLAYER-shaped: it gates on getCharState()'s own isCaster
    // check (would just silently no-op for an NPC caster, whose charState
    // never matches the local player's), reads player.aggregate for physics
    // (opponents spawn with usePhysics:false, same as every other npc - see
    // createFighterNpc), and reparents the SINGLE shared "atkCollider" mesh
    // (createMyCharacter.js builds exactly one, for the local player only) -
    // calling it here would either do nothing or hijack the player's own
    // melee hitbox. So: same dash-forward + delayed-hit shape, but using
    // this opponent's own body/locallyTranslate and this file's own
    // calcOpponentDmg/deductHp damage path instead, matching how its normal
    // attackInterval swing already works below.
    function performOpponentDashStrike(skill){
        if(opponentDefeated || duelState.playerDefeated) return

        playFirstAction(opponent.characterAnimations, opponent.anims, [skill.animationName || "dashstrike"], { nextState: ANIM_STATE.COMBAT_IDLE })
        // dashstrike is inherently a weapon strike - same swordS1 the
        // regular armed swing plays below, no equippedWeapon gate needed
        // here since this skill only ever exists on a fighter that has one
        getAllSounds().swordS1?.play()

        if(skill.activationSound){
            // same soundType->key convention castDashSkill's own SOUND_TYPE_MAP
            // uses (skillEffects.js) - "blade" isn't a real getAllSounds() key,
            // it's a category resolved here instead
            const soundKey = skill.activationSound.soundType === "blade" ? "swordWhooshS" : skill.activationSound.soundType
            setTimeout(() => getAllSounds()[soundKey]?.play(), skill.activationSound.willPlayAfterSeconds ?? 0)
        }

        // no physics aggregate on this opponent - locallyTranslate ramp only,
        // same non-physics fallback castDashSkill's own player-facing
        // implementation uses. rotationQuaternion is already kept facing the
        // player every frame by this opponent's own chaseObserver above, so
        // translating along local +Z closes the gap straight toward them.
        // isDashStriking suppresses chaseObserver's own competing per-frame
        // movement for the duration - see its own declaration/comment above
        // for why this actually matters, not just tidiness.
        isDashStriking = true
        const dash = skill.dash || {}
        const totalDist = dash.distance ?? 6
        // 1000, not 350 (the player's own dash.durationMs default) - a much
        // shorter window read as barely moving at all once chaseObserver's
        // own competing movement was actually suppressed and this became
        // the only thing controlling position; a full second reads clearly
        // as a real lunge instead
        const durationMs = dash.durationMs ?? 1000
        const startTime = performance.now()
        const dashObserver = scene.onBeforeRenderObservable.add(() => {
            if(performance.now() - startTime >= durationMs || opponentDefeated || duelState.playerDefeated || opponent.body.isDisposed()){
                scene.onBeforeRenderObservable.remove(dashObserver)
                isDashStriking = false
                return
            }
            const dt = scene.getEngine().getDeltaTime()
            opponent.body.locallyTranslate(new Vector3(0, 0, (totalDist / durationMs) * dt))
        })

        // damage lands once the dash has had time to actually close the gap -
        // same calcOpponentDmg formula every other swing below already uses,
        // with this skill's own offense-effect plusDmg layered flat on top
        // as the bonus (the player's own dashstrikeSkill gets its bonus via
        // a short-lived meeleeDmg buff feeding into calcDmg - not applicable
        // here, there's no calcDmg/atkCollider pipeline on the opponent's
        // attack side at all, just this flat formula, so the bonus just
        // adds directly)
        setTimeout(async () => {
            if(opponentDefeated || duelState.playerDefeated) return
            const dmgToPlayer = calcOpponentDmg(npcDet) + (getSkillEffect(skill, "offense")?.plusDmg || 0)

            // cursed opponent - this dash's own damage backfires onto the
            // opponent itself instead of the player, same rule
            // applyDamageToOpponent's own isPlayerCursed() branch follows
            // for the reverse direction. applyDamageToOpponent (not
            // applyDamageToPlayer) - self-hit, no hitDetails needed
            if(opponent._cursed){
                applyDamageToOpponent(dmgToPlayer)
                return
            }

            await applyDamageToPlayer(dmgToPlayer)

            if(getCharState().hp <= 1 && !duelState.playerDefeated){
                duelState.playerDefeated = true
                stopFight()
                // duelState.playerDefeated alone stops every opponent's own
                // loops from DOING anything new (they all check it), but
                // their intervals/observers keep existing/ticking (no-op)
                // until each one's own stopFight() actually runs - this
                // shuts every fighter in the gauntlet down cleanly right
                // now instead of leaving the others idling until the scene
                // itself gets torn down
                duelOpponents.forEach(o => o.stopFight())
                // assistants don't speak, per spec - the fight still ends
                // (the lines above run regardless of who landed the blow),
                // just no dialogue from a non-main opponent
                if(isMainOpponent) displaySpeech([
                ...toLines(npcDet.name, ["Ha! Down you go. Good bout though."]),
                { speech: "You Lose!" }
            ], returnToExitPlace, undefined, true)
            }
        }, durationMs)
    }

    // npcDet.hiddencombo's own blinkstrike entry - a MELEE weapon skill
    // (effectType:"blink"), same reasoning performOpponentDashStrike's own
    // header comment gives for why this needs a dedicated local equivalent
    // instead of reusing skillEffects.js's castBlinkstrikeSkill directly:
    // that function is entirely PLAYER-shaped (isCaster-gated on
    // getCharState(), and its own findNearestBlinkTarget scans
    // getEnemiesOnScene()/getDuelOpponentsOnScene() for a target NEAR THE
    // CASTER - for an NPC opponent that would scan for a target near
    // ITSELF, which would find nothing meaningful, never the actual player,
    // who isn't in either of those registries at all). This opponent's only
    // possible target in a 1v1 duel is the player, so there's nothing to
    // "find nearest" - it blinks straight to them.
    //
    // Instant teleport (no gradual translate like performOpponentDashStrike's
    // own dash) - same skill.blink.landOffset convention the player-facing
    // castBlinkstrikeSkill uses, landing just short of the player instead of
    // inside them. Guaranteed critical via BLINK_CRIT_MULTIPLIER - see that
    // constant's own header comment for why this is a flat stand-in rather
    // than a real crit-chance buff.
    function performOpponentBlinkstrike(skill){
        if(opponentDefeated || duelState.playerDefeated) return

        const dx = opponent.body.position.x - characterBody.position.x
        const dz = opponent.body.position.z - characterBody.position.z
        const dist = Math.hypot(dx, dz) || 1
        const landOffset = skill.blink?.landOffset ?? BLINK_LAND_OFFSET_DEFAULT
        const nx = dx / dist
        const nz = dz / dist
        opponent.body.position.x = characterBody.position.x + nx * landOffset
        opponent.body.position.z = characterBody.position.z + nz * landOffset
        // face the player from the newly-landed spot - same atan2(dx,dz)
        // yaw convention chaseObserver's own facing uses every frame, just
        // computed once here since this is an instant teleport, not a
        // per-frame update
        opponent.body.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), Math.atan2(-nx, -nz))

        playFirstAction(opponent.characterAnimations, opponent.anims, [skill.animationName || "dashstrike"], { nextState: ANIM_STATE.COMBAT_IDLE })
        getAllSounds().swordS1?.play()
        if(skill.activationSound){
            // same soundType->key convention performOpponentDashStrike's own
            // activationSound handling uses just above
            const soundKey = skill.activationSound.soundType === "blade" ? "swordWhooshS" : skill.activationSound.soundType
            setTimeout(() => getAllSounds()[soundKey]?.play(), skill.activationSound.willPlayAfterSeconds ?? 0)
        }

        // short delay so the strike animation/sound has a beat to actually
        // read before the damage lands, same idea performOpponentDashStrike's
        // own durationMs delay gives its dash
        setTimeout(async () => {
            if(opponentDefeated || duelState.playerDefeated) return
            const dmgToPlayer = Math.round((calcOpponentDmg(npcDet) + (getSkillEffect(skill, "blink")?.plusDmg || 0)) * BLINK_CRIT_MULTIPLIER)

            // cursed opponent - same self-redirect rule every other damage-
            // dealing branch in this file already follows
            if(opponent._cursed){
                applyDamageToOpponent(dmgToPlayer)
                return
            }

            await applyDamageToPlayer(dmgToPlayer)

            if(getCharState().hp <= 1 && !duelState.playerDefeated){
                duelState.playerDefeated = true
                stopFight()
                duelOpponents.forEach(o => o.stopFight())
                if(isMainOpponent) displaySpeech([
                    ...toLines(npcDet.name, ["Ha! Down you go. Good bout though."]),
                    { speech: "You Lose!" }
                ], returnToExitPlace, undefined, true)
            }
        }, 250)
    }

    // Shared wrapper around every real skillEffects.js castEnemySkill() call
    // in this file (runSkillCheck/runStandbyCastCheck/runHiddenComboStep) -
    // plays the CASTING pose for the actual cast window (skill.castDuration)
    // instead of leaving the opponent standing in whatever RUNNING/
    // COMBAT_IDLE state chaseObserver last set, same "casting" animation
    // read the player's own cast bar already gives (renderer.js's own
    // player.mode==="casting" -> ANIM_STATE.CASTING). isCasting suppresses
    // chaseObserver's own per-frame setState calls for the same window
    // (same isDashStriking/isDodging suppression idea, see that flag's own
    // comment) so this pose doesn't get immediately stomped the next frame.
    function castOpponentSkill(skill, targetPlayer){
        isCasting = true
        opponent.characterAnimations.setState(ANIM_STATE.CASTING, 8)
        castEnemySkill(scene, opponent, skill, targetPlayer)
        setTimeout(() => {
            isCasting = false
            // chaseObserver's own next frame re-evaluates RUNNING/COMBAT_IDLE
            // correctly on its own once isCasting is false again - this just
            // avoids a one-frame flash of the CASTING pose still held
            if(!opponentDefeated && !duelState.playerDefeated) opponent.characterAnimations.setState(ANIM_STATE.COMBAT_IDLE)
        }, (skill.castDuration ?? 0) * 1000)
    }

    // nearSkill's own eligibility roll - own cooldown, own distance gate
    // (Vector3.Distance per spec, not the 2D-only `dist` runSkillCheck uses),
    // run on NEAR_SKILL_CHECK_MS's own fast interval below instead of
    // runSkillCheck's 5-6s cadence - see that constant's own comment for why
    function rollNearSkill(){
        if(opponentDefeated || duelState.playerDefeated || !isMeleeFighter) return
        if(!npcDet.skills?.nearSkill) return
        // dashstrike is a WEAPON skill - can't fire it with an empty hand.
        // hasDrawnWeapon only ever flips true once the attackInterval's own
        // draw sequence actually finishes (equippedWeapon truthy AND the
        // idletoready->equipSword sequence below has completed) - covers
        // both "has no weapon at all" and "has one but hasn't drawn it yet"
        // (which is exactly the bug reported: attacking bare-handed on the
        // very first approach, sword still sheathed on their back)
        if(!hasDrawnWeapon) return
        const now = Date.now()
        if(now < skillCooldownUntil.nearSkill) return
        const nearDist = Vector3.Distance(opponent.body.position, characterBody.position)
        if(nearDist < NEAR_SKILL_MIN_DIST || nearDist > NEAR_SKILL_MAX_DIST) return
        if(Math.random() >= NEAR_SKILL_CHANCE) return
        skillCooldownUntil.nearSkill = now + npcDet.skills.nearSkill.skillCoolDown
        performOpponentDashStrike(npcDet.skills.nearSkill)
    }
    const nearSkillCheckInterval = setInterval(rollNearSkill, NEAR_SKILL_CHECK_MS)

    // Dodge - see the DODGE_* constants' own header comment for the overall
    // design (proximity-based, not real trajectory prediction). Two danger
    // sources checked each tick:
    //  1. melee - the SHARED "atkCollider" mesh (createMyCharacter.js) is
    //     the same one every player swing/dashstrike already moves into
    //     position to land a hit (see strikeWithHandCollider's own header
    //     comment in skillEffects.js) - reading its own live position here
    //     needs no new signal from anywhere else. .position.y compared
    //     against ATK_COLLIDER_PARKED_Y (not reading getSocketContainers or
    //     anything skill-specific) is genuinely universal: it reads the
    //     exact same whether the collider got there via a normal swing's
    //     reach-based positionAtkCollider OR dashstrike's own hand-parented
    //     strikeWithHandCollider - both ultimately just move this one mesh.
    //     getAbsolutePosition() (not the raw .position) matters specifically
    //     for the hand-parented case - .position there is a small LOCAL
    //     offset from the hand bone, not a meaningful world position.
    //  2. projectiles - getProjectilesOnScene() (worldsocket.js), the same
    //     registry fireElementalProjectile/fireEnemySkillProjectile both
    //     push into on cast, PLAYER-cast ones only: casterOwner
    //     (skillEffects.js) is what actually tells them apart - without
    //     this check an opponent was catching sight of its OWN outgoing
    //     cast (or another npcFighter's) in this same registry and dodging
    //     that instead of anything the player actually threw.
    //
    // Two distinct dodge TYPES, not one - see performDodge's own comment:
    // melee dodges backward (away from the player, clearing atkCollider's
    // own reach), projectiles dodge sideways (perpendicular to the line of
    // fire - stepping straight back along a bolt's own travel line doesn't
    // reliably clear it, stepping off to the side does).
    function rollDodge(){
        if(opponentDefeated || duelState.playerDefeated || isDodging || isBlocking) return
        const now = Date.now()
        if(now < dodgeCooldownUntil) return

        const atkCollider = scene.getMeshByName("atkCollider")
        const meleeThreat = !!atkCollider
            && Math.abs(atkCollider.position.y - ATK_COLLIDER_PARKED_Y) > 1
            && Vector3.Distance(atkCollider.getAbsolutePosition(), opponent.body.position) <= DODGE_MELEE_RANGE

        const projectileThreat = !meleeThreat && getProjectilesOnScene().some(proj =>
            proj.body && proj.casterOwner === charState.owner &&
            Vector3.Distance(proj.body.position, opponent.body.position) <= DODGE_PROJECTILE_RANGE
        )

        // attitude.dodging (npcDetails.js) replaces the old flat DODGE_CHANCE -
        // DEFAULT_ATTITUDE.dodging is literally DODGE_CHANCE itself, so a
        // fighter with no attitude field at all behaves identically to before
        if((!meleeThreat && !projectileThreat) || Math.random() >= attitude.dodging) return

        dodgeCooldownUntil = now + DODGE_COOLDOWN_MS
        performDodge(meleeThreat ? "back" : "side")
    }
    const dodgeCheckInterval = setInterval(rollDodge, DODGE_CHECK_MS)

    // Blocking (attitude.blocking) - same melee-threat detection rollDodge
    // just above already does, just a different reaction: hold a real
    // weaponBlocking stance instead of hopping away. Mutually exclusive with
    // dodge (both check the other's own flag) so a fighter with both sliders
    // set doesn't try to do both at once against the same swing.
    function rollBlock(){
        if(opponentDefeated || duelState.playerDefeated || isDodging || isBlocking) return
        const now = Date.now()
        if(now < blockCooldownUntil) return

        const atkCollider = scene.getMeshByName("atkCollider")
        const meleeThreat = !!atkCollider
            && Math.abs(atkCollider.position.y - ATK_COLLIDER_PARKED_Y) > 1
            && Vector3.Distance(atkCollider.getAbsolutePosition(), opponent.body.position) <= DODGE_MELEE_RANGE

        if(!meleeThreat || Math.random() >= attitude.blocking) return

        blockCooldownUntil = now + BLOCK_COOLDOWN_MS
        performBlock()
    }
    const blockCheckInterval = setInterval(rollBlock, BLOCK_CHECK_MS)

    // opponent.weaponBlocking - the SAME live flag applyDamageToOpponent
    // already reads (its own weaponblock branch, further up this file) and
    // that the PLAYER's own r-click hold-to-block sets on themselves
    // (inputMovement.js) - this is just an NPC setting the identical flag
    // on ITS own rig for the same duration, no new damage-nullifying logic
    // needed anywhere else.
    function performBlock(){
        isBlocking = true
        opponent.weaponBlocking = true
        playFirstAction(opponent.characterAnimations, opponent.anims, ["weaponblock"], { nextState: null })
        setTimeout(() => {
            isBlocking = false
            opponent.weaponBlocking = false
        }, BLOCK_DURATION_MS)
    }

    // Distancing (attitude.distancing, "running away") - re-rolled on its
    // own slower cadence (DISTANCE_CHECK_MS) into wantsDistance, read by
    // chaseObserver's own non-melee (caster) branch further down. Not
    // gated on isMeleeFighter here - the roll itself is harmless either way,
    // it's simply never CONSUMED by the melee branch (see DEFAULT_ATTITUDE's
    // own comment on why this keeps Renarden's existing behavior untouched).
    function rollDistance(){
        if(opponentDefeated || duelState.playerDefeated) return
        wantsDistance = Math.random() < attitude.distancing
    }
    const distanceCheckInterval = setInterval(rollDistance, DISTANCE_CHECK_MS)

    // direction: "back" (melee - away from the player, DODGE_MELEE_MIN/MAX_DIST -
    // just enough to clear the atkCollider's own reach) or "side" (projectile -
    // perpendicular to the player/opponent line, picked randomly left or
    // right, DODGE_PROJECTILE_MIN/MAX_DIST - a bolt's own hitbox needs more
    // clearance than a fixed-reach swing does). Along the ground plane -
    // same isDodging suppression of
    // chaseObserver's own competing movement performOpponentDashStrike's
    // own isDashStriking flag already established the need for (two
    // systems both nudging .position the same frame reads as jittery, not
    // a clean motion). Eased (fast burst, settles into the landing spot)
    // rather than a linear translate, so a very short DODGE_DURATION_MS
    // still reads as a real hop instead of a teleport.
    function performDodge(direction){
        if(opponentDefeated || duelState.playerDefeated) return
        isDodging = true
        // "back" (melee) plays "weaponblock" as a one-shot clip -
        // playFirstAction/nextState:null, same guessed-clip-name convention
        // HIT_CLIP_CANDIDATES already uses elsewhere in this file (warns to
        // console instead of throwing if the name's wrong, falls back to
        // whatever state was already active once it ends on its own - no
        // manual reset needed for this branch).
        // "side" (projectile) keeps ANIM_STATE.FALLING - a real, already-
        // established STATE (tools/animation.js's own STATE_CLIPS map, same
        // one renderer.js sets on the local player while airborne), which is
        // why THAT branch needs the explicit reset back to COMBAT_IDLE
        // below once the hop ends (setState holds until told otherwise,
        // unlike playAction's own nextState-on-complete).
        if(direction === "back"){
            playFirstAction(opponent.characterAnimations, opponent.anims, ["weaponblock"], { nextState: null })
        } else {
            opponent.characterAnimations.setState(ANIM_STATE.FALLING, 4)
        }

        const dx = opponent.body.position.x - characterBody.position.x
        const dz = opponent.body.position.z - characterBody.position.z
        const awayDist = Math.hypot(dx, dz)
        // degenerate case (standing exactly on top of the player, awayDist~0) -
        // fall back to this opponent's own surround-slot angle instead of a
        // divide-by-zero direction
        const awayX = awayDist > 0.001 ? dx / awayDist : Math.sin(surroundAngle)
        const awayZ = awayDist > 0.001 ? dz / awayDist : Math.cos(surroundAngle)

        // "side" rotates the away-vector 90° in the XZ plane - (-z, x) is
        // one perpendicular direction, the sign flip below picks left vs
        // right at random ("dodge left or right", per spec)
        let dirX = awayX
        let dirZ = awayZ
        if(direction === "side"){
            const side = Math.random() < 0.5 ? 1 : -1
            dirX = -awayZ * side
            dirZ = awayX * side
        }

        const [hopMin, hopMax] = direction === "back"
            ? [DODGE_MELEE_MIN_DIST, DODGE_MELEE_MAX_DIST]
            : [DODGE_PROJECTILE_MIN_DIST, DODGE_PROJECTILE_MAX_DIST]
        const hopDist = hopMin + Math.random() * (hopMax - hopMin)
        const startX = opponent.body.position.x
        const startZ = opponent.body.position.z
        const targetX = startX + dirX * hopDist
        const targetZ = startZ + dirZ * hopDist

        const startTime = performance.now()
        const dodgeObserver = scene.onBeforeRenderObservable.add(() => {
            if(opponentDefeated || duelState.playerDefeated || opponent.body.isDisposed()){
                scene.onBeforeRenderObservable.remove(dodgeObserver)
                isDodging = false
                return
            }
            const t = Math.min(1, (performance.now() - startTime) / DODGE_DURATION_MS)
            const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
            opponent.body.position.x = startX + (targetX - startX) * eased
            opponent.body.position.z = startZ + (targetZ - startZ) * eased
            if(t >= 1){
                scene.onBeforeRenderObservable.remove(dodgeObserver)
                isDodging = false
                // only the "side"/FALLING branch needs this - "back"'s own
                // "weaponblock" playAction already reverts on its own once
                // the clip finishes (nextState:null), setState doesn't
                if(direction !== "back"){
                    // back to a normal combat pose - chaseObserver's own next
                    // frame will immediately re-evaluate RUNNING/COMBAT_IDLE
                    // correctly on its own, this just avoids a one-frame flash
                    // of the FALLING pose still held in between
                    opponent.characterAnimations.setState(ANIM_STATE.COMBAT_IDLE)
                }
            }
        })
    }

    // npcDet.battleSpeech.whileFighting (npcDetails.js) - an occasional line
    // mid-fight, same self-rescheduling setTimeout shape scheduleNextSkillCheck
    // below already uses. "sometimes" per spec - BATTLE_SPEECH_CHANCE gates
    // it on top of the randomized interval itself, so even a fighter with
    // lines defined won't say one on every single tick.
    let battleSpeechTimeout = null
    function scheduleNextBattleSpeech(){
        const delay = BATTLE_SPEECH_MIN_MS + Math.random() * (BATTLE_SPEECH_MAX_MS - BATTLE_SPEECH_MIN_MS)
        battleSpeechTimeout = setTimeout(runBattleSpeechCheck, delay)
    }
    function runBattleSpeechCheck(){
        if(opponentDefeated || duelState.playerDefeated) return
        scheduleNextBattleSpeech() // reschedule unconditionally, same as scheduleNextSkillCheck

        const lines = npcDet.battleSpeech?.whileFighting
        if(!lines?.length || Math.random() >= BATTLE_SPEECH_CHANCE) return
        displaySpeech(toLines(npcDet.name, [lines[Math.floor(Math.random() * lines.length)]]), () => {}, undefined, true)
    }
    // assistants don't speak at all, per spec - not even mid-fight lines -
    // so don't bother starting the check/timer for one in the first place
    if(isMainOpponent && npcDet.battleSpeech?.whileFighting?.length) scheduleNextBattleSpeech()

    function scheduleNextSkillCheck(){
        const delay = SKILL_CHECK_MIN_MS + Math.random() * (SKILL_CHECK_MAX_MS - SKILL_CHECK_MIN_MS)
        skillCheckTimeout = setTimeout(runSkillCheck, delay)
    }

    function runSkillCheck(){
        if(opponentDefeated || duelState.playerDefeated) return
        scheduleNextSkillCheck() // reschedule unconditionally - a missed roll this tick just tries again in another 5-6s

        const dist = Math.hypot(
            characterBody.position.x - opponent.body.position.x,
            characterBody.position.z - opponent.body.position.z
        )
        // nearSkill (dashstrikeSkill) is no longer rolled here - it has its
        // own much faster dedicated interval (rollNearSkill/nearSkillCheckInterval
        // above), since this function's own 5-6s cadence almost never landed
        // during the narrow window the opponent is actually 2-3 units out

        if(dist > SKILL_RANGE) return 

        const hpPercent = hp / maxHp
        // which skill KEYS are even in play at this hp tier - hiddenSkill
        // below 8% completely excludes basic/seriousSkill, per spec ("only
        // the hiddenSkill is working"), not just adds to them
        let eligibleKeys
        if(hpPercent <= HIDDEN_HP_THRESHOLD) eligibleKeys = ["hiddenSkill"]
        else if(hpPercent <= SERIOUS_HP_THRESHOLD) eligibleKeys = ["basicSkill", "seriousSkill"]
        else eligibleKeys = ["basicSkill"]

        const now = Date.now()
        const castableKeys = eligibleKeys.filter(key => npcDet.skills?.[key] && now >= skillCooldownUntil[key])
        if(!castableKeys.length) return 

        const targetPlayer = getPlayersOnScene().find(pl => pl.owner === charState.owner)
        if(!targetPlayer) return 

        const pickedKey = castableKeys[Math.floor(Math.random() * castableKeys.length)]
        const skill = npcDet.skills[pickedKey]
        skillCooldownUntil[pickedKey] = now + skill.skillCoolDown

        // real enemies branch on getIsSocketOn() here (emit vs local cast) -
        // this scene is never multiplayer (isMultiplayer:false, see the file
        // header), so it's always the local path, same as every other combat
        // call in this file
        castOpponentSkill(skill, targetPlayer)
    }

    // --- Standby-casting (attitude.standbycasting, isStandbyCaster rolled
    // once at spawn) - a fighter who mostly just stands back and casts
    // (Vesper) instead of the hp-tiered single-skill-per-roll model above
    // (Renarden/Robin). Reads npcDet.skills' own KEYS dynamically (not
    // hardcoded to "thunderclap"/"multishotskill"/"zoltraak" anywhere) so
    // this works for any future standbycasting npcFighter's own skill set,
    // not just Vesper's specific three.
    function getCastableSkillEntries(){
        return Object.entries(npcDet.skills || {}).filter(([key]) => key !== "nearSkill")
    }

    function scheduleNextStandbyCast(){
        const delay = STANDBY_CAST_CHECK_MIN_MS + Math.random() * (STANDBY_CAST_CHECK_MAX_MS - STANDBY_CAST_CHECK_MIN_MS)
        standbyCastTimeout = setTimeout(runStandbyCastCheck, delay)
    }

    // "she can even cast this three alltogether, but with style" - a short
    // staggered flurry (STANDBY_CAST_STAGGER_MS apart) through a shuffled,
    // randomly-sized subset of whatever's currently off cooldown (anywhere
    // from just one skill to every castable one), not always exactly one
    // skill the way the old hp-tiered roll works. isHiddenComboActive owns
    // casting entirely once it latches (checkHiddenComboTrigger below) -
    // this function backs off completely rather than firing alongside it.
    function runStandbyCastCheck(){
        if(opponentDefeated || duelState.playerDefeated || isHiddenComboActive) return

        const dist = Math.hypot(
            characterBody.position.x - opponent.body.position.x,
            characterBody.position.z - opponent.body.position.z
        )
        if(dist > SKILL_RANGE){ scheduleNextStandbyCast(); return }

        const now = Date.now()
        const castable = getCastableSkillEntries().filter(([key]) => now >= (skillCooldownUntil[key] ?? 0))
        const targetPlayer = getPlayersOnScene().find(pl => pl.owner === charState.owner)
        if(!castable.length || !targetPlayer){ scheduleNextStandbyCast(); return }

        const shuffled = [...castable].sort(() => Math.random() - 0.5)
        const flurryCount = 1 + Math.floor(Math.random() * shuffled.length) // 1..castable.length
        const toFire = shuffled.slice(0, flurryCount)

        toFire.forEach(([key, skill], i) => {
            setTimeout(() => {
                if(opponentDefeated || duelState.playerDefeated || isHiddenComboActive) return
                skillCooldownUntil[key] = Date.now() + skill.skillCoolDown
                castOpponentSkill(skill, targetPlayer)
            }, i * STANDBY_CAST_STAGGER_MS)
        })

        // attitude.continuescast - chain another flurry soon instead of
        // waiting out the normal randomized interval again
        if(Math.random() < attitude.continuescast){
            standbyCastTimeout = setTimeout(runStandbyCastCheck, CONTINUE_CAST_DELAY_MS + flurryCount * STANDBY_CAST_STAGGER_MS)
        } else {
            scheduleNextStandbyCast()
        }
    }

    // --- Hidden combo (npcDet.hiddencombo, e.g. Vesper's own
    // blinkstrike->massivedisintegration loop) - triggered once hp drops
    // to/below HIDDEN_COMBO_HP_THRESHOLD (checkHiddenComboTrigger, called
    // from applyDamageToOpponent right after hp changes) and never turns
    // back off. Each entry is a FULL skill object with its own extra
    // castAfterMs field merged in (npcDetails.js) - "loop the hiddenCombo...
    // all this skill will get activated after the castAfterMs time" per
    // spec: wait castAfterMs, cast that entry, move to the next one,
    // wrapping back to the start indefinitely for the rest of the fight.
    // Dispatch is data-driven (checks the entry's own effects array for an
    // effectType:"blink" entry) rather than hardcoding "index 0 is always
    // blinkstrike" - a future hiddencombo could reorder/add entries and this
    // still routes each one correctly.
    function checkHiddenComboTrigger(){
        if(isHiddenComboActive || opponentDefeated || duelState.playerDefeated) return
        if(!npcDet.hiddencombo?.length) return
        if(hp / maxHp > HIDDEN_COMBO_HP_THRESHOLD) return

        isHiddenComboActive = true
        // hiddencombo owns casting entirely from here - stop whichever
        // normal casting loop this fighter was using (only one of the two
        // is ever actually running, per isStandbyCaster, but clearing both
        // timeout handles is harmless either way)
        clearTimeout(skillCheckTimeout)
        clearTimeout(standbyCastTimeout)
        runHiddenComboStep()
    }

    function runHiddenComboStep(){
        if(opponentDefeated || duelState.playerDefeated) return
        const step = npcDet.hiddencombo[hiddenComboIndex]
        hiddenComboIndex = (hiddenComboIndex + 1) % npcDet.hiddencombo.length // loop back to the start past the end

        hiddenComboTimeout = setTimeout(() => {
            if(opponentDefeated || duelState.playerDefeated) return
            const targetPlayer = getPlayersOnScene().find(pl => pl.owner === charState.owner)
            if(targetPlayer){
                const isBlinkStep = step.effects?.some(e => e.effectType === "blink")
                if(isBlinkStep) performOpponentBlinkstrike(step)
                else castOpponentSkill(step, targetPlayer)
            }
            runHiddenComboStep() // keep looping for the rest of the fight
        }, step.castAfterMs ?? 0)
    }

    // Non-melee fighters (isMeleeFighter false, e.g. Vesper) never run
    // attackInterval at all, so its own "draw the weapon off your back
    // before the first swing" sequence (equippedWeapon && !hasDrawnWeapon,
    // further down) never fires for one either - she'd fight the entire
    // duel with her staff still sheathed. A caster isn't drawing a weapon
    // to SWING it though ("she should get equip her staff at the first
    // place", not "the first time she gets close") - equips it once,
    // immediately, right as the fight starts, instead of waiting on any
    // proximity/attack trigger the way the melee draw sequence does.
    if(!isMeleeFighter && equippedWeapon && !hasDrawnWeapon){
        hasDrawnWeapon = true
        playFirstAction(opponent.characterAnimations, opponent.anims, ["act_idletoready1"], { nextState: ANIM_STATE.COMBAT_IDLE })
        setTimeout(() => {
            if(opponentDefeated || duelState.playerDefeated) return
            // full 5-arg shape (parts/weaponType/metalColor), same as every
            // other real equipSword call site (areascene.js/itemInfoSystem.js) -
            // equipSword's own weaponType param defaults to "sword" when
            // omitted (createcharacter.js), which is WRONG for a staff -
            // Vesper would end up wielding a generic default sword instead
            // of wanderersstaff. Renarden's own weapon happens to already
            // BE a sword, which is why the below (unfixed) 2-arg attackInterval
            // draw call never surfaced this.
            opponent.equipSword(equippedWeapon.name, true, equippedWeapon.parts, equippedWeapon.weaponType, equippedWeapon.metalColor)
        }, 400)
    }

    if(isStandbyCaster) scheduleNextStandbyCast()
    else scheduleNextSkillCheck()

    // player -> opponent: reuses the exact atkCollider mechanism already
    // wired up for tree-chopping (areascene.js), matched against this
    // specific opponent's own body mesh name
    registerToAtkCollider(scene, opponent.body.name.toLowerCase(), () => {
        if(opponentDefeated || duelState.playerDefeated) return

        const dmgDetails = calcDmg(charState)
        // same weaponDmg-else-physicalDmg rule tcp/index.ts's own enemyIsHit
        // handler uses server-side, replicated here since there's no server
        // round-trip to do it for us in this scene
        const dmgToApply = dmgDetails.weaponDmg ? dmgDetails.weaponDmg : dmgDetails.physicalDmg

        // sound keyed off the ATTACKER's (player's) own equipped weaponType,
        // not a flat swordS1 every time - see WEAPON_HIT_SOUNDS' own comment.
        // weaponType itself (not just the resolved sound) is passed through
        // too, in case applyDamageToOpponent ever wants to key off it directly
        const equippedWeaponItem = charState.items.find(itm => itm.itemType === "weapon" && itm.equiped)
        const weaponType = equippedWeaponItem?.weaponType
        const hitSound = WEAPON_HIT_SOUNDS[weaponType] ?? DEFAULT_HIT_SOUND
        applyDamageToOpponent(dmgToApply, { weaponType, hitSound, isPhysical: true })
    })

    // Chase - faces and closes on the player whenever out of ATTACK_RANGE,
    // otherwise holds a combat-ready idle. Runs every frame (matches how
    // continuous movement/facing is already driven elsewhere in this project,
    // e.g. renderer.js's own chase loop) rather than on the attack interval's
    // slower cadence, so it doesn't look like he's teleporting between beats.
    const chaseObserver = scene.onBeforeRenderObservable.add(() => {
        if(opponentDefeated || duelState.playerDefeated) return
        // performOpponentDashStrike/performOpponentBlinkstrike/performDodge/
        // castOpponentSkill own position/facing (or just the animation pose,
        // for casting) exclusively for their own windows - still tick the
        // animation blend so whichever clip is playing keeps animating,
        // just skip this loop's own movement/facing
        if(isDashStriking || isDodging || isCasting){
            opponent.characterAnimations.tickBlend()
            return
        }

        const dt = scene.getEngine().getDeltaTime() / 1000
        const dx = characterBody.position.x - opponent.body.position.x
        const dz = characterBody.position.z - opponent.body.position.z
        const dist = Math.hypot(dx, dz)

        if(dist > 0.05){
            opponent.body.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), Math.atan2(dx, dz))
        }

        // isMeleeFighter (attitude.weapon, rolled once at spawn) splits
        // movement into two completely different styles - see
        // DEFAULT_ATTITUDE's own header comment for the full reasoning
        if(isMeleeFighter){
        if(dist > ATTACK_RANGE){
            if(inCombatRange){
                // just left attack range THIS frame - don't resume chasing
                // immediately, wait out CHASE_REENGAGE_DELAY_MS first (see
                // readyToChase's own comment above)
                inCombatRange = false
                readyToChase = false
                clearTimeout(reengageTimeout)
                reengageTimeout = setTimeout(() => { readyToChase = true }, CHASE_REENGAGE_DELAY_MS)
            }

            if(!readyToChase){
                // still inside the debounce window - hold a combat-ready
                // stance instead of stepping, even though dist technically
                // says "out of range" right now
                opponent.characterAnimations.setState(ANIM_STATE.COMBAT_IDLE)
            } else {
                // move toward THIS opponent's assigned surround slot (a point
                // offset from the player's current position at surroundAngle/
                // SURROUND_RADIUS) instead of the player's raw position directly -
                // recomputed every frame off the player's live position, so it
                // keeps tracking as they move. This is what actually keeps
                // multiple opponents from converging onto the same spot and
                // visually merging - facing/ATTACK_RANGE above still use the
                // real distance to the player, only the movement target changes.
                const targetX = characterBody.position.x + Math.sin(surroundAngle) * SURROUND_RADIUS
                const targetZ = characterBody.position.z + Math.cos(surroundAngle) * SURROUND_RADIUS
                const tdx = targetX - opponent.body.position.x
                const tdz = targetZ - opponent.body.position.z
                const tdist = Math.hypot(tdx, tdz)
                if(tdist > 0.05){
                    const step = Math.min(CHASE_SPEED * dt, tdist)
                    opponent.body.position.x += (tdx / tdist) * step
                    opponent.body.position.z += (tdz / tdist) * step

                    // only tagged RUNNING while actually translating this frame -
                    // setState no-ops on its own once already in this state, so
                    // this is safe to call every frame, same as the real player's
                    // own per-frame animation update already does. Guarding it on
                    // tdist (not just dist>ATTACK_RANGE) is the second layer of
                    // defense against the frozen-mid-stride bug the SURROUND_RADIUS
                    // margin above is meant to prevent in the first place - if he
                    // ever does end up stopped (tdist~0) while still nominally
                    // outside ATTACK_RANGE, he holds a combat-ready stance instead
                    // of looping a run cycle with zero actual movement.
                    opponent.characterAnimations.setState(ANIM_STATE.RUNNING)
                    // stride-matched to movement speed - same convention renderer.js's
                    // own enemy-chase loop uses (`anim.speedRatio = .9 + en.spd * .05`)
                    // right above the npc block this was modeled on. Without this the
                    // clip plays at a fixed rate regardless of CHASE_SPEED, which is
                    // exactly what read as "gliding" instead of a real running stride.
                    findAnimVariants(opponent.anims, "running").forEach(anim => anim.speedRatio = 0.9 + CHASE_SPEED * 0.05)
                } else {
                    opponent.characterAnimations.setState(ANIM_STATE.COMBAT_IDLE)
                }
            }
        } else {
            inCombatRange = true
            // back in range - cancel any pending re-chase timer instead of
            // letting it fire later on a stale window (e.g. the player
            // briefly stepped out and back in before it elapsed)
            readyToChase = true
            clearTimeout(reengageTimeout)
            opponent.characterAnimations.setState(ANIM_STATE.COMBAT_IDLE)
        }
        } else {
            // caster (isMeleeFighter false, e.g. Vesper - "she does not
            // charge the player she only standby and casting") - never
            // approaches ATTACK_RANGE/swings at all. inCombatRange here
            // just means "close enough to actually be casting" (read by
            // runStandbyCastCheck's own SKILL_RANGE gate), not "close
            // enough to melee" the way it does in the isMeleeFighter branch
            // above - the old attackInterval swing loop isn't even set up
            // for a non-melee fighter (see its own isMeleeFighter gate below).
            inCombatRange = dist <= SKILL_RANGE

            if(dist > 0.05 && wantsDistance && dist < PREFERRED_CAST_RANGE){
                // retreat straight away from the player - attitude.distancing,
                // "sometimes she runs away from the character first" per spec
                const step = Math.min(RETREAT_SPEED * dt, PREFERRED_CAST_RANGE - dist)
                opponent.body.position.x -= (dx / dist) * step
                opponent.body.position.z -= (dz / dist) * step
                opponent.characterAnimations.setState(ANIM_STATE.RUNNING)
                findAnimVariants(opponent.anims, "running").forEach(anim => anim.speedRatio = 0.9 + RETREAT_SPEED * 0.05)
            } else if(dist > 0.05 && dist > SKILL_RANGE){
                // drifted out of casting range entirely - close back in just
                // far enough to cast again, never all the way to ATTACK_RANGE
                const step = Math.min(CHASE_SPEED * dt, dist - SKILL_RANGE)
                opponent.body.position.x += (dx / dist) * step
                opponent.body.position.z += (dz / dist) * step
                opponent.characterAnimations.setState(ANIM_STATE.RUNNING)
                findAnimVariants(opponent.anims, "running").forEach(anim => anim.speedRatio = 0.9 + CHASE_SPEED * 0.05)
            } else {
                opponent.characterAnimations.setState(ANIM_STATE.COMBAT_IDLE)
            }
        }
        opponent.characterAnimations.tickBlend()
    })

    // opponent -> player: local timer standing in for the server-driven
    // "enemy-attacked" event, calling deductHp directly instead of waiting
    // on a socket message that will never arrive in a non-multiplayer scene.
    // allowDeath:false is the soft-loss clamp (characterstate.js) - a duel
    // never actually kills the player. Gated on inCombatRange (kept in sync
    // by the chase loop above) rather than re-measuring distance here too.
    //
    // isMeleeFighter (attitude.weapon) - a caster (Vesper, weapon:0) never
    // sets this interval up at all, so inCombatRange being true in the
    // caster branch of chaseObserver above (a much looser "close enough to
    // cast" meaning there) can never accidentally trigger a melee swing -
    // there's simply no interval running to do it.
    if(isMeleeFighter) attackInterval = setInterval(async () => {
        if(opponentDefeated || duelState.playerDefeated || !inCombatRange || isDodging) return

        // first attack while armed: draw the sword off his back before
        // swinging it, instead of just teleporting it into his hand. Same
        // idletoready transition + delayed hand-swap worldsocket.js's own
        // setPlayerMode uses on the player's idle->fighting mode change -
        // the sword mesh already exists (spawn-time auto-equip in
        // createcharacter.js created it, just parented to weaponSocket/the
        // back since det.mode isn't "fighting"), so equipSword here is just
        // re-parenting it to rHand, not building anything new.
        if(equippedWeapon && !hasDrawnWeapon){
            hasDrawnWeapon = true
            playFirstAction(opponent.characterAnimations, opponent.anims, ["act_idletoready1"], { nextState: ANIM_STATE.COMBAT_IDLE })
            setTimeout(() => {
                if(opponentDefeated || duelState.playerDefeated) return
                // full 5-arg shape - see the non-melee draw sequence's own
                // comment above for why the 2-arg form silently defaults to
                // the wrong weaponType ("sword") for anything else
                opponent.equipSword(equippedWeapon.name, true, equippedWeapon.parts, equippedWeapon.weaponType, equippedWeapon.metalColor)
            }, 400)
            return // let the draw finish before the first real swing - next tick attacks for real
        }

        // once armed, swing the actual weapon (same weaponType-driven naming
        // uimanagement.js's own player combo uses) instead of continuing to
        // punch/kick bare-handed with a sword visibly in hand
        const animName = equippedWeapon
            ? `${equippedWeapon.weaponType}attack${comboNum}`
            : (comboNum === 1 ? "punch1" : "kick1")
        comboNum = comboNum === 1 ? 2 : 1
        playFirstAction(opponent.characterAnimations, opponent.anims, [animName], { nextState: ANIM_STATE.COMBAT_IDLE })
        // only a real sword slash gets the sword sound - equippedWeapon is
        // falsy for the punch1/kick1 branch above, which shouldn't sound
        // like a blade landing
        if(equippedWeapon) getAllSounds().swordS1?.play()

        // captured once so the popup shows exactly what was sent into
        // deductHp - that's the raw pre-defense number, not the post-mitigation
        // amount actually subtracted (deductHp computes/applies its own
        // defense reduction internally and doesn't hand the final figure
        // back out - its return value is death-status only, and changing that
        // contract would ripple into skillEffects.js/worldsocket.js's own
        // callers, which already treat it as a plain boolean). Close enough
        // to "how hard was I just hit" for a popup; not exact combat-log math.
        // Ignored entirely if the player is currently blocking - see
        // applyDamageToPlayer's own header comment.
        const dmgToPlayer = calcOpponentDmg(npcDet)

        // cursed opponent - this swing's own damage backfires onto the
        // opponent itself instead of the player, same rule
        // performOpponentDashStrike's own identical check follows above
        if(opponent._cursed){
            applyDamageToOpponent(dmgToPlayer)
            return
        }

        await applyDamageToPlayer(dmgToPlayer)

        if(getCharState().hp <= 1 && !duelState.playerDefeated){
            duelState.playerDefeated = true
            stopFight()
            // see performOpponentDashStrike's own identical call for why -
            // shuts every fighter in the gauntlet down right now, not just
            // this one
            duelOpponents.forEach(o => o.stopFight())
            // assistants don't speak, per spec - see the identical gate in
            // performOpponentDashStrike above
            // was () => {} - the same dead-end returnToExitPlace's own
            // header comment describes (dialogue closes, nothing happens,
            // player stuck in placeId 200 with no way out). This is the
            // REGULAR melee-attack loss path (the other two call sites,
            // above and in applyDamageToOpponent, already got fixed) - the
            // most common way to actually lose a duel, since most opponents
            // (Renarden included) whittle the player down with plain swings
            // long before ever landing a skill hit.
            if(isMainOpponent) displaySpeech([
                ...toLines(npcDet.name, ["Ha! Down you go. Good bout though."]),
                { speech: "You Lose!" }
            ], returnToExitPlace, undefined, true)
        }
    }, ATTACK_INTERVAL_MS)

    opponent.body.onDisposeObservable.add(stopFight)
}
