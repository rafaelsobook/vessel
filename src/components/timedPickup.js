import { TransformNode } from "@babylonjs/core"
import * as GUI from "@babylonjs/gui"
import { getCharState, isDead } from "../charactersystem/characterstate.js"
import { getPlayersOnScene } from "../sockets/worldsocket.js"
import { emitClaimPickup, emitReleasePickup } from "../sockets/emits.js"
import { openClosePopup } from "../tools/popupUI.js"
import { createWorldProgressBar } from "./guiKit.js"

// TAKING SOMETHING TAKES A MOMENT - grain, a mushroom, a struck weapon, a
// chest: press to take it and a bar fills over it (the bonfire's roasting bar,
// guiKit.js's createWorldProgressBar), and only a full bar hands it over.
// Walk away from it, die, or have it vanish (someone else got it) and it stops.
//
// For anything the server tracks, the bar starts only once tcp agrees it's
// mine to take ("claimPickup", tcp/recources/pickupClaims.ts): it has to still
// be there with nobody else already taking it - and then it's held for me
// while my bar fills, so two players can't both end up with it. Stopping early
// lets it go again ("releasePickup"); the pickup itself (pickupGrain,
// removeTreasure...) clears the claim on the server.
//
// One at a time: starting another stops the one before.

// the bar hangs this far over the top of what's being taken, then this many pixels higher
const BAR_ABOVE = 0.3
const BAR_OFFSET_Y = -14
const BAR_FILL = "#e8c25a"

let active = null

// one fullscreen GUI per scene - its layer only on while a bar is up (a
// fullscreen layer composites every frame otherwise, see campcraft.js)
const uis = new WeakMap()
function uiFor(scene){
    let ui = uis.get(scene)
    if(!ui){
        ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("timedPickupUI", true, scene, undefined, true)
        ui.layer.isEnabled = false
        uis.set(scene, ui)
    }
    return ui
}

function myBody(){
    const owner = getCharState()?.owner
    return getPlayersOnScene().find(pl => pl.owner === owner)?.body ?? null
}

// target's top, in the world - where the bar hangs
function topOf(target, out){
    target.computeWorldMatrix?.(true)
    const box = target.getBoundingInfo?.().boundingBox
    if(box){
        out.copyFrom(box.centerWorld)
        out.y = box.maximumWorld.y
    } else {
        out.copyFrom(target.getAbsolutePosition())
    }
    return out
}

/**
 * Starts taking something.
 *  scene, target:  the scene, and the mesh being taken (where the bar hangs,
 *                  what "walked away" is measured from, and gone once disposed)
 *  label:          the bar's text ("Picking up Grain")
 *  seconds:        how long the bar takes
 *  radius:         walk further than this (XZ) from it and it stops
 *  claim:          { kind, id } of a server-tracked thing, or null for a local one
 *  onDone():       the bar's full - take it
 *  onCancel():     it stopped short (or was never mine to take)
 */
export function startTimedPickup({ scene, target, label, seconds, radius = 3, claim = null, onDone, onCancel }){
    if(active?.target === target) return
    stopTimedPickup()
    const me = { scene, target, claim, onCancel, observer: null, bar: null, anchor: null, live: true }
    active = me

    emitClaimPickup(claim, seconds * 1000).then(answer => {
        if(active !== me || !me.live) return
        if(target.isDisposed()) return stop(me, "It's already gone")
        if(!answer?.ok){
            // never mine - nothing to let go of
            me.claim = null
            return stop(me, answer?.reason === "gone" ? "It's already gone" : "Someone else is already taking that")
        }
        run(me, scene, label, seconds, radius, onDone)
    })
}

function run(me, scene, label, seconds, radius, onDone){
    const { target } = me
    const ui = uiFor(scene)
    me.anchor = new TransformNode("timedPickupAnchor", scene)
    topOf(target, me.anchor.position).y += BAR_ABOVE
    me.bar = createWorldProgressBar(ui, "timedPickupBar", me.anchor, label, { fillColor: BAR_FILL, offsetY: BAR_OFFSET_Y })
    ui.layer.isEnabled = true

    const ms = seconds * 1000
    const startedAt = performance.now()
    me.observer = scene.onBeforeRenderObservable.add(() => {
        // someone else got it (the server's "<kind>-removed" disposed it)
        if(target.isDisposed()) return stop(me, "Someone else got it first")
        const body = myBody()
        if(!body || isDead()) return stop(me)
        // it can move - a weapon stuck in an enemy rides along with it
        topOf(target, me.anchor.position).y += BAR_ABOVE
        const at = target.getAbsolutePosition()
        if(Math.hypot(body.position.x - at.x, body.position.z - at.z) > radius) return stop(me, "You moved away")
        const done = (performance.now() - startedAt) / ms
        me.bar.fill.width = `${Math.min(100, done * 100)}%`
        if(done < 1) return
        // the pickup itself clears the claim on the server - no release
        me.claim = null
        clear(me)
        onDone?.()
    })
}

// takes the bar down, and lets go of the claim if it's still held
function clear(me){
    me.live = false
    if(active === me) active = null
    if(me.observer) me.scene.onBeforeRenderObservable.remove(me.observer)
    me.observer = null
    me.bar?.root.dispose()
    me.anchor?.dispose()
    const ui = uis.get(me.scene)
    if(ui && !active) ui.layer.isEnabled = false
    if(me.claim) emitReleasePickup(me.claim)
    me.claim = null
}

function stop(me, message){
    if(!me.live) return
    clear(me)
    if(message) openClosePopup(message, true, 1400)
    me.onCancel?.()
}

// stops whatever's being taken, if anything
export function stopTimedPickup(message){
    if(active) stop(active, message)
}

// is this mesh the one being taken right now
export function isBeingTaken(target){
    return active?.target === target
}
