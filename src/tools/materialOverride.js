// A LOOK WORN OVER A MESH'S OWN for a while - lightning's x-ray shell
// (effects/electrocute.js), the fireball's charring (effects/scorch.js). Two
// can overlap on one body (zapped while still burnt): each is a layer, the
// newest showing, and when one ends the mesh goes back to whichever is still
// on - or to its own material once none is. Swapping mesh.material straight
// back by hand would put the other effect's look back for good.
//
// A layer's material can be thrown away under it: a spell's visual hung on
// the rig, disposed with its materials, takes whatever it was wearing - and
// Babylon strips a disposed material off every mesh still wearing it (they
// render plain white, wearing nothing). So a layer whose material is disposed
// just comes off, and a mesh found wearing nothing is never taken for its own
// look. Give each mesh its own layer material, too, so one disposal can only
// ever strip the one mesh.

// mesh -> { own, ownVisibility, applied, appliedVisibility, layers: [{ owner, material, visibility }] }
// applied/appliedVisibility: what was last put on it here - anything else
// found there later, something else put there
const layersOf = new WeakMap()

/**
 * `owner` (any key - an effect's state object) puts `material` over `mesh`,
 * at `visibility`. Again with the same owner, it replaces that layer.
 */
export function overrideMaterial(mesh, owner, material, visibility = 1){
    if(!mesh || mesh.isDisposed() || !material || isGone(material)) return
    watch(material)
    let entry = layersOf.get(mesh)
    if(!entry){
        entry = { own: mesh.material, ownVisibility: mesh.visibility, applied: null, appliedVisibility: null, layers: [] }
        layersOf.set(mesh, entry)
    }
    entry.layers = entry.layers.filter(layer => layer.owner !== owner)
    entry.layers.push({ owner, material, visibility })
    apply(mesh, entry)
}

/** `owner`'s layer comes off `mesh`. */
export function releaseMaterial(mesh, owner){
    const entry = layersOf.get(mesh)
    if(!entry) return
    entry.layers = entry.layers.filter(layer => layer.owner !== owner)
    apply(mesh, entry)
    if(!entry.layers.length) layersOf.delete(mesh)
}

/**
 * Puts right whichever of `meshes` lost `owner`'s layer meanwhile - something
 * re-skinned it (gear re-equipped mid-effect: the layer goes back on), or the
 * layer's material was disposed (it comes off) - once per frame from the
 * effect's own observer.
 */
export function keepOverride(meshes, owner){
    meshes.forEach(mesh => {
        const entry = layersOf.get(mesh)
        if(!entry || mesh.isDisposed()) return
        const top = entry.layers[entry.layers.length - 1]
        if(top?.owner === owner && (mesh.material !== entry.applied || isGone(top.material))) apply(mesh, entry)
    })
}

/** The material `mesh` wears under any layers - its own. */
export function ownMaterial(mesh){
    const entry = layersOf.get(mesh)
    if(!entry) return mesh.material
    return entry.applied && mesh.material && mesh.material !== entry.applied ? mesh.material : entry.own
}

/** Disposes a layer's material, unless someone already has. */
export function disposeLayerMaterial(material){
    if(material && !isGone(material)) material.dispose(false, false)
}

/** Whether `material` has been disposed since a layer first wore it. */
export function isGone(material){
    return !!material?._layerDisposed
}

// notes when anyone disposes `material`
function watch(material){
    if(material._layerWatched) return
    material._layerWatched = true
    material.onDisposeObservable.addOnce(() => { material._layerDisposed = true })
}

function apply(mesh, entry){
    if(mesh.isDisposed()) return
    // a layer whose material was thrown away under it comes off
    entry.layers = entry.layers.filter(layer => !isGone(layer.material))
    // re-skinned under us meanwhile (gear re-equipped) - that's its own look
    // now. Not nothing, though (a layer's material disposed under it), and
    // only what was really changed: its visibility is still the one a layer
    // gave it, not its own - taking that too left whatever was re-equipped
    // mid-zap see-through (0.3) for good
    const wearing = mesh.material
    if(entry.applied && wearing && wearing !== entry.applied && !entry.layers.some(layer => layer.material === wearing)) entry.own = wearing
    if(entry.appliedVisibility !== null && mesh.visibility !== entry.appliedVisibility) entry.ownVisibility = mesh.visibility
    const top = entry.layers[entry.layers.length - 1]
    mesh.material = top ? top.material : entry.own
    mesh.visibility = top ? top.visibility : entry.ownVisibility
    entry.applied = mesh.material
    entry.appliedVisibility = mesh.visibility
}
