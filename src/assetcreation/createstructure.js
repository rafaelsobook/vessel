import { Color3, LoadAssetContainerAsync, Mesh, PhysicsAggregate, PhysicsShapeType, StandardMaterial, Texture } from "@babylonjs/core"
import "@babylonjs/loaders"
import { addBedSeat } from "../charactersystem/seating.js"
import { armSpikes } from "../components/spikeTraps.js"
import { armAnvil } from "../components/anvilWork.js"

// Camp structures from campcraft.js that are just "build it and it stands
// there" - the leaf bed tent, the spike barricade, the anvil, and whatever
// comes next.
// (The bonfire and tree log have their own modules: one cooks, one seats.)
// Each kind is one hidden template, loaded the first time a place needs it -
// not on every scene load the way containers.js's props are, since the
// tent's model alone is ~5 MB of textures - and every build is an instance
// of it, standing on the ground as a static obstacle (enemies' chase rays
// steer around it, renderer.js).
//
// Synced like the other crafted things, but through ONE generic pipeline
// instead of one per kind: tcp/index.ts's `structures` ("craft-structure" ->
// "structure-crafted", replayed to anyone joining via userJoined), each entry
// carrying its kind.
//
// Adding another: an entry here, one in campcraft.js's campcrafts list, and
// its icon at images/campcrafts/<kind>.webp - nothing else.

export const STRUCTURES = {
    leafbedtent: {
        model: "./models/outdors/leafbedtent.glb",
        // the model is a ~1.1 tall lean-to - this makes it big enough for a
        // character (1.5) to fit in
        scale: 1.6,
        // a bed you can lie in - a seating.js seat with the "sleeping" pose
        // (characterstate.js gives the fastest hp/mp/sp regen there is in
        // one, and refills the sleep meter). Measured off the real avatar:
        // its sleeping clip lies along its own +z, body centred bodyCentre
        // ahead of its root; the tent's bed of leaves runs along the
        // tent's x, centred on its origin.
        bed: { height: 0.1, bodyCentre: 0.2, radius: 2.2 },
    },
    spikes: {
        model: "./models/outdors/spikes.glb",
        // ~2 units of stakes as modelled - chest-high instead
        scale: 0.7,
        // the model has no material of its own
        texture: "./images/modeltex/wood2.jpg",
        tint: new Color3(0.62, 0.48, 0.36),
        // components/spikeTraps.js - damage an enemy takes every everyMs
        // while it's within reach of the stakes
        hurtsEnemies: { damage: 60, everyMs: 1000, reach: 0.8 },
    },
    anvil: {
        model: "./models/outdors/anvil.glb",
        // its four materials came out of export as plain white metal - each is
        // painted here instead, by a part of its name (paintMaterials)
        paint: {
            "charcoal steel": { color: new Color3(0.19, 0.2, 0.22), specular: new Color3(0.32, 0.32, 0.35), gloss: 24 },
            "striking face":  { color: new Color3(0.5, 0.52, 0.55), specular: new Color3(0.75, 0.75, 0.8), gloss: 64 },
            "iron nails":     { color: new Color3(0.3, 0.25, 0.22), specular: new Color3(0.15, 0.13, 0.12), gloss: 16 },
            // wood2.jpg's grain, but it's a red rosewood (~0.6, 0.27, 0.12) -
            // this turns it walnut brown (over 1 is fine: it multiplies)
            "walnut stump":   { color: new Color3(0.6, 0.9, 1.3), texture: "./images/modeltex/wood2.jpg" },
        },
        // components/anvilWork.js - the ore slots over it, and hammering at it
        smithing: true,
        // the bar of ore lying on its face - hidden until both slots are
        // filled, and it glows as it's hammered (anvilWork.js)
        loose: ["ore"],
    },
}

// dungeon materials take up to 8 lights (createdungeon.js) - with the default
// 4, a torch or bonfire right next to a structure often doesn't light it
const MAX_LIGHTS = 8

// scene -> { roots: Map(kind -> Promise<Mesh|null>), loaded: Map(kind -> Mesh),
//            loose: Map(kind -> { [part]: Mesh }),
//            placed: Map(craftId -> Mesh), placing: Set(craftId) }
const sceneStates = new WeakMap()
function stateOf(scene){
    let s = sceneStates.get(scene)
    if(!s){
        s = { roots: new Map(), loaded: new Map(), loose: new Map(), placed: new Map(), placing: new Set() }
        sceneStates.set(scene, s)
    }
    return s
}

// The hidden template a kind is built from, loading it the first time -
// at its final size (the scale is baked in), so placementMode's ghost
// preview, which clones it, shows exactly what will be built.
export function getStructureRoot(scene, kind){
    const def = STRUCTURES[kind]
    if(!def) return Promise.resolve(null)
    const s = stateOf(scene)
    if(s.roots.has(kind)) return s.roots.get(kind)

    const loading = (async () => {
        let container
        try {
            container = await LoadAssetContainerAsync(def.model, scene)
        } catch (err) {
            console.warn(`[createstructure] couldn't load ${def.model}`, err)
            return null
        }
        // the player may have left the place while it loaded
        if(scene.isDisposed){ container.dispose(); return null }
        container.addAllToScene()

        // off the glTF __root__ and baked, so instances stand upright without
        // the parent chain (see loadmodel.js's loadMeshOnlyParts)
        const parts = container.meshes.filter(m => m.getTotalVertices() > 0)
        parts.forEach(m => { m.setParent(null); m.bakeCurrentTransformIntoVertices() })
        // def.loose: parts kept out of the merge, each a hidden template of its
        // own - every structure built gets its own copy (createStructureMesh),
        // free to be shown, hidden or recoloured on its own (the anvil's ore)
        const looseParts = parts.filter(m => def.loose?.includes(m.name))
        const merged = parts.filter(m => !looseParts.includes(m))
        const root = merged.length > 1 ? Mesh.MergeMeshes(merged, true, true, undefined, false, true) : merged[0]
        container.meshes.filter(m => m !== root && !looseParts.includes(m) && !m.isDisposed()).forEach(m => m.dispose())

        if(def.scale && def.scale !== 1){
            ;[root, ...looseParts].forEach(m => {
                m.scaling.setAll(def.scale)
                m.bakeCurrentTransformIntoVertices()
            })
        }
        if(looseParts.length){
            s.loose.set(kind, Object.fromEntries(looseParts.map(part => {
                const name = part.name
                part.rotationQuaternion = null
                part.name = `structureLoose_${kind}_${name}`
                part.isVisible = false
                part.isPickable = false
                part.refreshBoundingInfo()
                return [name, part]
            })))
        }
        root.rotationQuaternion = null
        root.name = `structureRoot_${kind}`
        root.isVisible = false
        root.isPickable = false

        if(def.texture){
            const mat = new StandardMaterial(`structureMat_${kind}`, scene)
            mat.diffuseTexture = new Texture(def.texture, scene)
            if(def.tint) mat.diffuseColor = def.tint
            mat.specularColor = Color3.Black()
            root.material = mat
        } else if(def.paint){
            paintMaterials(root, def.paint, kind, scene)
        } else if(root.material?.diffuseTexture){
            // nearly matte - a light-coloured model (the tent's canvas) right
            // next to a dungeon torch, an intensity-5 light tuned for the dark
            // stone, otherwise washes out to near white
            root.material.specularColor = new Color3(0.05, 0.05, 0.05)
        }
        // a model of several materials comes out of the merge with a
        // MultiMaterial over them - the limit is each one's own
        ;(root.material?.subMaterials ?? [root.material]).forEach(mat => { if(mat) mat.maxSimultaneousLights = MAX_LIGHTS })
        root.refreshBoundingInfo()
        s.loaded.set(kind, root)
        return root
    })()
    s.roots.set(kind, loading)
    return loading
}

// A model whose materials carry no colour of their own (the anvil's): each one
// a def.paint entry names - by a part of its glTF name - is redone as a
// StandardMaterial of that colour (and texture, if it has one). Any it
// doesn't name keeps its own.
function paintMaterials(root, paint, kind, scene){
    const repaint = own => {
        const key = own && Object.keys(paint).find(part => own.name.includes(part))
        if(!key) return own
        const look = paint[key]
        const mat = new StandardMaterial(`structureMat_${kind}_${key}`, scene)
        mat.diffuseColor = look.color
        if(look.texture) mat.diffuseTexture = new Texture(look.texture, scene)
        mat.specularColor = look.specular ?? new Color3(0.05, 0.05, 0.05)
        if(look.gloss) mat.specularPower = look.gloss
        own.dispose(false, false)
        return mat
    }
    if(root.material?.subMaterials) root.material.subMaterials = root.material.subMaterials.map(repaint)
    else root.material = repaint(root.material)
}

// One built structure at `position` (the ground under it), turned rotY
// radians - immediately, so only once its template is loaded (campcraft.js
// always has it by then: the placement preview needed it first). null if it
// isn't, or the kind is unknown. Building the same craftId twice returns the
// one already standing. placeId: the place it's in - a tent's bed is a
// seat, and seats are per place (seating.js).
export function createStructureMesh(scene, kind, position, craftId, rotY = 0, placeId){
    const s = stateOf(scene)
    const existing = s.placed.get(craftId)
    if(existing && !existing.isDisposed()) return existing
    const root = s.loaded.get(kind)
    if(!root) return null

    const inst = root.createInstance(`structure_${craftId}`)
    inst.isPickable = false
    inst.position.set(position.x, position.y, position.z)
    inst.rotation.y = rotY
    inst.freezeWorldMatrix()
    // its own copy of each def.loose part, standing where it does, hidden -
    // whatever the kind does with it shows it (anvilWork.js's ore). A clone,
    // not an instance: it gets a material of its own.
    const looseTemplates = s.loose.get(kind)
    if(looseTemplates){
        inst._loose = {}
        Object.entries(looseTemplates).forEach(([name, template]) => {
            const part = template.clone(`structure_${craftId}_${name}`)
            part.isVisible = false
            part.isPickable = false
            part.position.set(position.x, position.y, position.z)
            part.rotation.y = rotY
            inst._loose[name] = part
        })
        inst.onDisposeObservable.add(() => Object.values(inst._loose).forEach(part => part.dispose()))
    }
    new PhysicsAggregate(inst, PhysicsShapeType.BOX, { mass: 0 }, scene)
    s.placed.set(craftId, inst)

    const def = STRUCTURES[kind]
    if(def.bed && placeId !== undefined) addBed(scene, placeId, def.bed, position, rotY, craftId)
    if(def.hurtsEnemies) armSpikes(scene, inst, def.hurtsEnemies)
    if(def.smithing) armAnvil(scene, inst)
    return inst
}

// The tent's bed as a seat - turned a quarter so the sleeper lies along the
// tent (the clip lies along the avatar's own +z, the bed along the tent's x:
// seat yaw = rotY + 90°), and set back so the body, not the root, is centred
// on the leaves. The interact button shows the rest (zZ) icon.
function addBed(scene, placeId, bed, position, rotY, craftId){
    addBedSeat(scene, placeId, `bed_${craftId}`, position, rotY + Math.PI / 2, bed)
}

// a structure someone built, from the server (worldsocket.js) - loads its
// kind's model first if this place hasn't needed it yet
export async function placeStructure(scene, { craftId, kind, pos, rotY, currentPlaceId }){
    const s = stateOf(scene)
    if(s.placed.has(craftId) || s.placing.has(craftId)) return
    s.placing.add(craftId)
    try {
        const root = await getStructureRoot(scene, kind)
        if(!root || scene.isDisposed) return
        createStructureMesh(scene, kind, pos, craftId, rotY ?? 0, currentPlaceId)
    } finally {
        s.placing.delete(craftId)
    }
}
