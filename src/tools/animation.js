
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
}

export class CharacterAnimations {
    constructor(animationGroups) {
        this._state       = ANIM_STATE.IDLE
        this._blendFrames = 0
        this._blendTotal  = 0
        this._blendFrom   = null
        this._blendTo     = null

        const find = name => animationGroups.find(a => a.name.toLowerCase() === name.toLowerCase())
        this._anims = {
            [ANIM_STATE.IDLE]:        find('idle'),
            [ANIM_STATE.WALK]:        find('walk'),
            [ANIM_STATE.COMBAT_IDLE]: find('combatIdle'),
            [ANIM_STATE.RUNNING]:     find('running'),
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
        if (this._blendFrom) {
            this._blendFrom.weight = 0
            if (this._blendTo) this._blendTo.weight = 1
            this._blendFrom = null
            this._blendTo   = null
        }

        this._blendFrom   = fromAnim
        this._blendTo     = toAnim
        this._blendFrames = 0
        this._blendTotal  = blendFrames
        this._state       = next
    }

    // Call once per render frame. Advances the active blend by one step.
    tickBlend() {
        if (!this._blendFrom || !this._blendTo) return
        this._blendFrames++
        const t = Math.min(this._blendFrames / this._blendTotal, 1)

        this._blendTo.weight   = t
        this._blendFrom.weight = 1 - t

        if (t >= 1) {
            this._blendFrom.weight = 0
            this._blendTo.weight   = 1
            this._blendFrom = null
            this._blendTo   = null
        }
    }

    setMoveSpeedRatio(ratio) {
        if (this._anims[ANIM_STATE.WALK])    this._anims[ANIM_STATE.WALK].speedRatio    = ratio
        if (this._anims[ANIM_STATE.RUNNING]) this._anims[ANIM_STATE.RUNNING].speedRatio = ratio
    }
}
