import { Color3, LoadAssetContainerAsync, Mesh, PhysicsAggregate, PhysicsShapeType, StandardMaterial, Texture } from "@babylonjs/core"
import "@babylonjs/loaders"
import { addSeat } from "../charactersystem/seating.js"
import { armSpikes } from "../components/spikeTraps.js"

// Camp structures from campcraft.js that are just "build it and it stands
// there" - the leaf bed tent, the spike barricade, and whatever comes next.
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
}

// dungeon materials take up to 8 lights (createdungeon.js) - with the default
// 4, a torch or bonfire right next to a structure often doesn't light it
const MAX_LIGHTS = 8

// scene -> { roots: Map(kind -> Promise<Mesh|null>), loaded: Map(kind -> Mesh),
//            placed: Map(craftId -> Mesh), placing: Set(craftId) }
const sceneStates = new WeakMap()
function stateOf(scene){
    let s = sceneStates.get(scene)
    if(!s){
        s = { roots: new Map(), loaded: new Map(), placed: new Map(), placing: new Set() }
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
        const root = parts.length > 1 ? Mesh.MergeMeshes(parts, true, true, undefined, false, true) : parts[0]
        container.meshes.filter(m => m !== root && !m.isDisposed()).forEach(m => m.dispose())

        if(def.scale && def.scale !== 1){
            root.scaling.setAll(def.scale)
            root.bakeCurrentTransformIntoVertices()
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
        } else if(root.material?.albedoTexture){
            root.material = toStandardMaterial(root.material, kind, scene)
        }
        if(root.material) root.material.maxSimultaneousLights = MAX_LIGHTS
        root.refreshBoundingInfo()
        s.loaded.set(kind, root)
        return root
    })()
    s.roots.set(kind, loading)
    return loading
}

// A model's own PBR material, redone as a StandardMaterial from the same
// textures. As PBR, a light-coloured model (the tent's canvas) right next to
// a dungeon torch - an intensity-5 light, tuned for the dark stone - washed
// out to near white; the dungeon's own props are all StandardMaterials and
// read right under the same light.
function toStandardMaterial(pbr, kind, scene){
    const mat = new StandardMaterial(`structureMat_${kind}`, scene)
    mat.diffuseTexture = pbr.albedoTexture
    if(pbr.albedoTexture?.hasAlpha){
        mat.useAlphaFromDiffuseTexture = true
        mat.transparencyMode = pbr.transparencyMode
    }
    if(pbr.bumpTexture){
        mat.bumpTexture = pbr.bumpTexture
        // glTF's normal maps are the other handedness - the loader flips
        // these on the PBR material, so carry them over as they are
        mat.invertNormalMapX = pbr.invertNormalMapX
        mat.invertNormalMapY = pbr.invertNormalMapY
    }
    mat.backFaceCulling = pbr.backFaceCulling
    mat.specularColor = new Color3(0.05, 0.05, 0.05)
    pbr.dispose(false, false)
    return mat
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
    new PhysicsAggregate(inst, PhysicsShapeType.BOX, { mass: 0 }, scene)
    s.placed.set(craftId, inst)

    const def = STRUCTURES[kind]
    if(def.bed && placeId !== undefined) addBed(scene, placeId, def.bed, position, rotY, craftId)
    if(def.hurtsEnemies) armSpikes(scene, inst, def.hurtsEnemies)
    return inst
}

// The tent's bed as a seat - turned a quarter so the sleeper lies along the
// tent (the clip lies along the avatar's own +z, the bed along the tent's x:
// seat yaw = rotY + 90°), and set back so the body, not the root, is centred
// on the leaves. The interact button shows the rest (zZ) icon.
function addBed(scene, placeId, bed, position, rotY, craftId){
    const yaw = rotY + Math.PI / 2
    addSeat(scene, placeId, {
        seatId: `bed_${craftId}`,
        x: position.x - Math.sin(yaw) * bed.bodyCentre,
        y: position.y + bed.height,
        z: position.z - Math.cos(yaw) * bed.bodyCentre,
        yaw,
        pose: "sleeping",
        radius: bed.radius,
        icon: "rest",
    })
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
