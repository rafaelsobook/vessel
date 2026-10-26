import { showStunStars } from "../effects/stunStars.js"

// STUNNED - dazed after a slam (charactersystem/knockback.js, from an enemy's
// additionalAttacks: tcp/recources/enemyAttacks.ts's stunDuration): for a
// moment they can't move, turn, jump, attack, cast or raise a guard. They loop
// a dazed pose, with stars circling their head.
//
// Every client stuns its own copy of the victim at the same moment (the slam
// lands on every client - worldsocket.js's "enemy-attacked"), so nothing more
// goes over the network for it: renderer.js plays the pose off
// player.stunnedUntil for anyone, and only the victim's own client locks its
// input (amIStunned - inputMovement.js, uimanagement.js, skillsui.js).

let myStunnedUntil = 0

export function amIStunned(){
    return performance.now() < myStunnedUntil
}

export function isStunned(player){
    return !!player && performance.now() < (player.stunnedUntil ?? 0)
}

// player: a createCharacter() rig. seconds: how long. pose: the
// characterAnimations state to loop meanwhile (stateForClip's). isMine: the
// victim is me. Stunned again while still dazed, it lasts whichever ends later.
export function stunPlayer(player, seconds, pose, isMine){
    if(!player?.body || !(seconds > 0)) return
    const until = performance.now() + seconds * 1000
    if(until <= (player.stunnedUntil ?? 0)) return
    player.stunnedUntil = until
    player.stunPose = pose
    if(isMine) myStunnedUntil = until
    // still up (or fading) from the last stun - they'll stay for this one
    if(player._stunStars) return
    player._stunStars = showStunStars(
        player.body.getScene(), player,
        () => !isStunned(player) || player.mode === "death",
        () => { player._stunStars = null },
    )
}
