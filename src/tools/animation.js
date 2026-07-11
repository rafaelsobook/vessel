
export function playAnim(animationGroups, name, loop = false){
    const anim = animationGroups.find(a => a.name.toLowerCase() === name.toLowerCase())
    if(anim) anim.play(loop)
    else console.warn("animation not found:", name)
}
export function stopAllAnim(animationGroups){
    animationGroups.forEach(anim => anim.stop())
}

export const ANIM_STATE = {
    IDLE:        'idle',
    WALK:        'walk',
    COMBAT_IDLE: 'combatIdle',
    RUNNING:     'running',
    STRUCTED:    'structed',
    CASTING:    'casting',
}

export class CharacterAnimations {
    constructor(animationGroups) {
        this._state       = ANIM_STATE.IDLE
        this._blendFrames = 0
        this._blendTotal  = 0
        this._blendFrom   = null
        this._blendTo     = null
        this._activeAction = null

        const find = name => animationGroups.find(a => a.name.toLowerCase() === name.toLowerCase())
        this._anims = {
            [ANIM_STATE.IDLE]:        find('idle'),
            [ANIM_STATE.WALK]:        find('walk'),
            [ANIM_STATE.COMBAT_IDLE]: find('combatIdle'),
            [ANIM_STATE.RUNNING]:     find('running'),
            [ANIM_STATE.STRUCTED]:    find('structed'),
            [ANIM_STATE.CASTING]:    find('casting'),
        }

        const missing = Object.entries(this._anims).filter(([,v]) => !v).map(([k]) => k)
        if (missing.length) {
            console.warn('[CharAnim] missing:', missing, '| available:', animationGroups.map(a => a.name))
        }
    }

    // Start all four looping anims at weight 0 except idle at weight 1.
    playAll() {
        Object.values(this._anims).forEach(anim => {
            if (!anim) return
            anim.play(true)
            anim.weight = 0
        })
        if (this._anims[ANIM_STATE.IDLE]) this._anims[ANIM_STATE.IDLE].weight = 1
        this._state = ANIM_STATE.IDLE
    }

    currentState() {
        return this._state
    }

    setState(next, blendFrames = 8) {
        if (this._state === next && !this._blendFrom) return

        const fromAnim = this._anims[this._state]
        const toAnim   = this._anims[next]

        if (!fromAnim || !toAnim || fromAnim === toAnim) {
            this._state = next
            return
        }

        // Snap any in-progress blend before starting the new one.
        this._cancelBlend()

        this._blendFrom   = fromAnim
        this._blendTo     = toAnim
        this._blendFrames = 0
        this._blendTotal  = blendFrames
        this._state       = next
    }

    // Ends whatever blend is currently in flight, leaving both anims at a
    // sane final weight (0 / 1). A blend endpoint that isn't one of the six
    // canonical loop states is a one-shot action clip that playAction()
    // re-armed as a live frozen loop purely so its weight would keep
    // counting during the fade (see playAction below) — if we just drop the
    // reference without stopping it, it's left permanently "playing" at
    // whatever weight it was interrupted at, forever bleeding into every
    // animation after it. That's what caused the shaking/incomplete-looking
    // attacks: an old act_idletoready1/readytoidle transition (or a
    // previous attack) getting cut off mid-fade by the next playAction()
    // call and never being cleaned up.
    _cancelBlend() {
        if (!this._blendFrom) return
        this._blendFrom.weight = 0
        if (!Object.values(this._anims).includes(this._blendFrom)) {
            this._blendFrom.stop()
        }
        if (this._blendTo) this._blendTo.weight = 1
        this._blendFrom = null
        this._blendTo   = null
    }

    // Call once per render frame. Advances the active blend by one step.
    tickBlend() {
        if (!this._blendFrom || !this._blendTo) return
        this._blendFrames++
        const t = Math.min(this._blendFrames / this._blendTotal, 1)

        this._blendTo.weight   = t
        this._blendFrom.weight = 1 - t

        if (t >= 1) this._cancelBlend()
    }

    setMoveSpeedRatio(ratio) {
        if (this._anims[ANIM_STATE.WALK])    this._anims[ANIM_STATE.WALK].speedRatio    = ratio
        if (this._anims[ANIM_STATE.RUNNING]) this._anims[ANIM_STATE.RUNNING].speedRatio = ratio
    }

    // Pass freezeAfter = true to hold the last frame without restoring looping anims (e.g. death).
    // Pass nextState to settle into a specific state once the action ends (e.g. an idle->ready
    // draw-weapon action that should land on COMBAT_IDLE, not snap back to whatever state — idle —
    // was active before the action started).
    playAction(allAnims, animName, speedRatio = 1, onComplete = null, freezeAfter = false, nextState = null) {
        const actionAnim = allAnims.find(a => a.name.toLowerCase() === animName.toLowerCase())
        if (!actionAnim) return false
        const targetState = nextState ?? this._state
        const loopAnim = this._anims[targetState]

        // a *different* one-shot clip from a previous playAction() call can
        // still be genuinely mid-playthrough here (not yet reached its own
        // onAnimationEndObservable) — e.g. attacking before act_idletoready1
        // finishes. If we don't stop it, both clips end up playing at full
        // weight simultaneously (Babylon just blends them — the muddled
        // half-swing/vibrating), and the old clip's completion callback
        // fires later anyway and stomps whatever state this action sets.
        if (this._activeAction && this._activeAction !== actionAnim) {
            this._activeAction.onAnimationEndObservable.clear()
            this._activeAction.stop()
            this._activeAction.weight = 0
        }
        this._activeAction = actionAnim

        // properly stop/reset whatever blend was in flight (e.g. an
        // interrupted act_idletoready1 still mid-fade) instead of just
        // discarding the reference — see _cancelBlend for why that leaks
        this._cancelBlend()
        Object.values(this._anims).forEach(anim => { if (anim) anim.weight = 0 })
        this._isActionPlaying = true

        // drop any listener left over from a previous playAction() that got
        // cut short by actionAnim.stop() below (stop() never fires "end",
        // so a stale addOnce would otherwise linger and fire later, stomping
        // the blend state and causing the flicker)
        actionAnim.onAnimationEndObservable.clear()
        actionAnim.stop()
        actionAnim.speedRatio = speedRatio
        actionAnim.weight = 1
        actionAnim.play(false)

        actionAnim.onAnimationEndObservable.addOnce(() => {
            if (this._activeAction === actionAnim) this._activeAction = null
            this._isActionPlaying = false
            this._state = targetState
            if (freezeAfter) return

            if (loopAnim && loopAnim !== actionAnim) {
                // actionAnim just auto-stopped (loop=false hitting its last
                // frame — that's literally what fired this event). A stopped
                // AnimationGroup is skipped entirely by Babylon's per-frame
                // animation step, so from this point on its weight counts
                // for nothing — ramping loopAnim's weight up from 0 doesn't
                // blend against actionAnim's last pose, it blends against
                // the skeleton's stale original bind pose (captured once,
                // back when playAll() first started looping it). That
                // mismatch is what produced the pop/flicker.
                // Re-arm actionAnim as a live (but visually frozen,
                // 1-frame-wide) loop pinned to its last frame so it keeps
                // being evaluated — and its weight keeps counting — for the
                // duration of the crossfade below.

                actionAnim.stop(true)
                actionAnim.start(true, actionAnim.speedRatio, actionAnim.to - 1, actionAnim.to)
                actionAnim.weight = 1

                this._blendFrom   = actionAnim
                this._blendTo     = loopAnim
                this._blendFrames = 0
                this._blendTotal  = 8
            } else {
                actionAnim.weight = 0
            }
            if (onComplete) onComplete()
        })

        return true
    }

    isActionPlaying() {
        return !!this._isActionPlaying
    }
}
