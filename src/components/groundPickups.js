import * as GUI from "@babylonjs/gui"
import { getPlayersOnScene } from "../sockets/worldsocket.js"
import { getCharState } from "../charactersystem/characterstate.js"
import { startTimedPickup, isBeingTaken } from "./timedPickup.js"

// Things lying on the ground that you walk up to and click to take - the
// server-tracked grain (creategrain.js) and dungeon mushrooms
// (createmushroom.js). Each KIND is one hidden template mesh with an instance
// per item, plus ONE shared pickup icon that follows whichever item is
// nearest - never a GUI control per item.
//
// definePickupKind(...) returns { create(scene, groundPos, id, variant?), remove(id) }.
// A kind can come in VARIANTS (the mushrooms' kinds, one texture each): every
// variant gets its own template, all of them share the one pickup icon.
// changeScene() disposes the whole old scene (template, instances, GUI,
// render observer), so a kind's state only ever belongs to one scene - a
// different scene just means starting fresh.

const PROXIMITY_CHECK_EVERY_N_FRAMES = 10

const ICON_BORDER = "#caa501"
const ICON_BORDER_HOVER = "#edd59f"
const ICON_BG = "rgba(20, 15, 8, 0.75)"
const ICON_BG_HOVER = "rgba(60, 45, 15, 0.85)"

/**
 * name:           a short id for this kind, used in GUI/control names
 * buildTemplate:  (scene, variant) => Mesh, or a Promise of one (e.g. a GLB) -
 *                 hidden, made once per variant per scene. Items created before
 *                 it's ready appear the moment it is.
 * place:          (instance, groundPos) => void - sizes/positions/turns a fresh
 *                 instance standing on groundPos (its y is the ground height)
 * iconImage:      the picture inside the pickup icon - or (variant) => one
 * pickupRadius:   how close (XZ only) the player has to be
 * pickupSeconds:  how long taking one takes - a bar fills over it first
 *                 (components/timedPickup.js)
 * pickupLabel:    the bar's text - or (variant) => one
 * claimKind:      its kind for tcp's pickup claims (pickupClaims.ts) - while
 *                 my bar fills, nobody else can take the same one
 * onPickedUp:     (id, variant) => void - give the item, tell the server
 */
export function definePickupKind({ name, buildTemplate, place, iconImage, pickupRadius, pickupSeconds, pickupLabel, claimKind, onPickedUp }){
    let state = null
    // picked locally before the server's "<kind>-removed" echo arrives -
    // without this, a reCreateMeshesInScene() in that window would respawn it
    const pickedIds = new Set()

    function getState(scene){
        if(state?.scene === scene) return state
        // templates: variant -> Mesh, or null while it's still loading
        // pending:   id -> { groundPos, variant } waiting on a loading template
        // variants:  id -> variant, for every spawned instance
        state = { scene, templates: new Map(), instances: new Map(), variants: new Map(), pending: new Map(), ui: null, icon: null, linkedId: null, iconVariant: undefined }
        watchProximity(state)
        return state
    }

    // the variant's template, building it the first time it's asked for -
    // undefined while a GLB is still loading
    function getTemplate(s, variant){
        if(s.templates.has(variant)) return s.templates.get(variant) ?? undefined
        const built = buildTemplate(s.scene, variant)
        if(built && typeof built.then === "function"){
            s.templates.set(variant, null)
            built.then(template => {
                if(state !== s || s.scene.isDisposed || !template) return
                s.templates.set(variant, template)
                s.pending.forEach((p, id) => {
                    if(p.variant !== variant) return
                    s.pending.delete(id)
                    spawn(s, template, p.groundPos, id, variant)
                })
            }).catch(err => console.warn(`[groundPickups] ${name} ${variant ?? ""}: template failed to load`, err))
            return undefined
        }
        s.templates.set(variant, built)
        return built
    }

    function spawn(s, template, groundPos, id, variant){
        const inst = template.createInstance(`${name}_${id}`)
        inst.isPickable = false
        place(inst, groundPos, variant)
        inst.freezeWorldMatrix()
        s.instances.set(id, inst)
        s.variants.set(id, variant)
        return inst
    }

    function create(scene, groundPos, id, variant){
        if(pickedIds.has(id)) return null
        const s = getState(scene)
        const existing = s.instances.get(id)
        if(existing) return existing
        const template = getTemplate(s, variant)
        // template still loading - spawned once it's there
        if(!template){
            s.pending.set(id, { groundPos, variant })
            return null
        }
        return spawn(s, template, groundPos, id, variant)
    }

    function remove(id){
        if(!state) return
        state.pending.delete(id)
        state.variants.delete(id)
        const inst = state.instances.get(id)
        if(!inst) return
        if(state.linkedId === id) hideIcon(state)
        state.instances.delete(id)
        inst.dispose()
    }

    function pickUp(id){
        if(!state?.instances.has(id)) return
        const variant = state.variants.get(id)
        pickedIds.add(id)
        remove(id)
        onPickedUp(id, variant)
    }

    function getIcon(s){
        if(s.icon) return s.icon

        s.ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI(`${name}PickupUI`, true, s.scene)
        // same reason as campcraft.js's panel: a fullscreen ADT keeps compositing
        // its layer every frame even with nothing visible, unless the layer is off
        s.ui.layer.isEnabled = false

        const icon = new GUI.Ellipse(`${name}PickupIcon`)
        icon.width = "54px"
        icon.height = "54px"
        icon.thickness = 2
        icon.color = ICON_BORDER
        icon.background = ICON_BG
        icon.hoverCursor = "pointer"
        // stops the click from also reaching inputMovement.js's
        // scene.onPointerObservable (which would swing/attack)
        icon.isPointerBlocker = true
        icon.linkOffsetY = -70
        icon.isVisible = false

        const img = new GUI.Image(`${name}PickupImg`, "")
        s.iconImg = img
        img.width = "70%"
        img.height = "70%"
        img.isHitTestVisible = false
        icon.addControl(img)

        icon.onPointerEnterObservable.add(() => {
            icon.color = ICON_BORDER_HOVER
            icon.background = ICON_BG_HOVER
        })
        icon.onPointerOutObservable.add(() => {
            icon.color = ICON_BORDER
            icon.background = ICON_BG
        })
        // a moment to take it - and the server holding it for me meanwhile
        icon.onPointerClickObservable.add(() => {
            const id = s.linkedId
            const target = id && s.instances.get(id)
            if(!target || isBeingTaken(target)) return
            const variant = s.variants.get(id)
            startTimedPickup({
                scene: s.scene,
                target,
                label: typeof pickupLabel === "function" ? pickupLabel(variant) : pickupLabel,
                seconds: pickupSeconds,
                // a little slack past where the icon shows, so the bar doesn't
                // stop at the very edge of reach
                radius: pickupRadius + 0.6,
                claim: claimKind ? { kind: claimKind, id } : null,
                onDone: () => pickUp(id),
            })
        })

        s.ui.addControl(icon)
        s.icon = icon
        return icon
    }

    function showIcon(s, id){
        const icon = getIcon(s)
        // the picture follows the variant of whatever the icon is on now
        const variant = s.variants.get(id)
        if(s.iconVariant !== variant || !s.iconImg.source){
            s.iconImg.source = typeof iconImage === "function" ? iconImage(variant) : iconImage
            s.iconVariant = variant
        }
        icon.linkWithMesh(s.instances.get(id))
        icon.isVisible = true
        s.ui.layer.isEnabled = true
        s.linkedId = id
    }

    function hideIcon(s){
        s.linkedId = null
        if(!s.icon) return
        s.icon.isVisible = false
        s.icon.linkWithMesh(null)
        s.ui.layer.isEnabled = false
    }

    // XZ distance only, same as creationTools.js's checkDistance - on sloped
    // openworld terrain the body's Y and the item's Y never quite agree
    function watchProximity(s){
        let frame = 0
        s.scene.onBeforeRenderObservable.add(() => {
            if(++frame % PROXIMITY_CHECK_EVERY_N_FRAMES) return
            if(!s.instances.size){
                if(s.linkedId) hideIcon(s)
                return
            }

            const me = getPlayersOnScene().find(pl => pl.owner === getCharState()?.owner)
            const bodyPos = me?.body?.position
            if(!bodyPos) return

            let nearestId = null
            let nearestDistSq = pickupRadius * pickupRadius
            s.instances.forEach((inst, id) => {
                const dx = inst.position.x - bodyPos.x
                const dz = inst.position.z - bodyPos.z
                const distSq = dx * dx + dz * dz
                if(distSq < nearestDistSq){
                    nearestDistSq = distSq
                    nearestId = id
                }
            })

            if(nearestId === s.linkedId) return
            if(nearestId) showIcon(s, nearestId)
            else hideIcon(s)
        })
    }

    return { create, remove }
}
