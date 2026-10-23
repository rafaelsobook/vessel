import { Color3, LoadAssetContainerAsync, Mesh, StandardMaterial, Texture, TransformNode } from "@babylonjs/core"
import "@babylonjs/loaders"
import { emitPickupMushroom } from "../sockets/emits.js"
import { definePickupKind } from "../components/groundPickups.js"

// Dungeon mushrooms (tcp/recources/mushroomsInDungeon.ts) - you walk up and
// click to pick one, the same flow as the grain (components/groundPickups.js).
// Every mushroom has a KIND (tcp/recources/mushroomLibrary.ts) which is also
// its skin: images/textures/mushrooms/<kind>.jpg on the one shared model.
//
// What a kind GIVES lives only on the server - picking one just tells tcp,
// which answers the picker alone with the item ("mushroom-picked", handled in
// worldsocket.js). So two players grabbing the same mushroom can't both get it.

const MUSHROOM_MODEL = "./models/outdors/mushroom.glb"
const mushroomTexture = kind => `./images/textures/mushrooms/${kind}.jpg`
// the model is ~3 units tall - a mushroom stands about this high, give or take
// MUSHROOM_SIZE_JITTER of it
const MUSHROOM_HEIGHT = 0.45
const MUSHROOM_SIZE_JITTER = 0.35
const PICKUP_RADIUS = 1.8
// a little light of its own (times its texture), so a cluster can be spotted
// in the dark between torches
const GLOW = new Color3(0.22, 0.22, 0.22)
// the rare kinds glow in their own colour after dark - outdoors at night
// (setMushroomNightGlow, components/nightAmbience.js), so a rare cluster out
// in the open world can be spotted from a way off; and always in the
// character setup forest (setupbackdrop.js)
export const MUSHROOM_NIGHT_GLOW = {
    purple: new Color3(0.53, 0.26, 0.75),
    bluemist: new Color3(0.19, 0.41, 0.75),
    crimson: new Color3(0.75, 0.12, 0.14),
    galaxygreen: new Color3(0.26, 0.75, 0.45),
    devilred: new Color3(0.8, 0.18, 0.06),
}

// scene -> Promise<Mesh|null>: the model, loaded once, upright and hidden -
// every kind's template is a clone of it (shared geometry, own material)
const baseModels = new WeakMap()
function loadBaseModel(scene){
    if(baseModels.has(scene)) return baseModels.get(scene)
    const loading = (async () => {
        const container = await LoadAssetContainerAsync(MUSHROOM_MODEL, scene)
        // the player may have left the dungeon while it loaded
        if(scene.isDisposed){ container.dispose(); return null }
        container.addAllToScene()
        // off the glTF __root__ and baked, so instances stand upright without
        // the parent chain (see loadmodel.js's loadMeshOnlyParts)
        const parts = container.meshes.filter(m => m.getTotalVertices() > 0)
        parts.forEach(m => { m.setParent(null); m.bakeCurrentTransformIntoVertices() })
        const model = parts.length > 1 ? Mesh.MergeMeshes(parts, true, true, undefined, false, true) : parts[0]
        container.meshes.filter(m => m !== model && !m.isDisposed()).forEach(m => m.dispose())
        model.name = "mushroomBase"
        model.isVisible = false
        model.isPickable = false
        model.refreshBoundingInfo()
        return model
    })()
    baseModels.set(scene, loading)
    return loading
}

// scene -> Map(kind -> StandardMaterial): one skin per kind, shared by all
// of that kind's floor mushrooms
const kindMaterials = new WeakMap()
function kindMaterial(scene, kind){
    let mats = kindMaterials.get(scene)
    if(!mats){ mats = new Map(); kindMaterials.set(scene, mats) }
    let mat = mats.get(kind)
    if(!mat){
        mat = new StandardMaterial(`mushroomMat_${kind}`, scene)
        mat.diffuseTexture = new Texture(mushroomTexture(kind), scene, false, false)
        mat.emissiveColor = GLOW
        mat.specularColor = new Color3(0.1, 0.1, 0.1)
        mats.set(kind, mat)
    }
    return mat
}

async function buildTemplate(scene, kind){
    const base = await loadBaseModel(scene)
    if(!base || scene.isDisposed) return null

    const template = base.clone(`mushroomTemplate_${kind}`)
    template.isVisible = false
    template.isPickable = false
    template.material = kindMaterial(scene, kind)

    // what place() needs to stand an instance on the ground at a given height
    const { minimum, maximum } = base.getBoundingInfo().boundingBox
    template._footY = minimum.y
    template._modelHeight = maximum.y - minimum.y
    return template
}

const mushrooms = definePickupKind({
    name: "mushroom",
    buildTemplate,
    place: (mushroom, groundPos) => {
        const template = mushroom.sourceMesh
        const scale = MUSHROOM_HEIGHT * (1 - MUSHROOM_SIZE_JITTER / 2 + Math.random() * MUSHROOM_SIZE_JITTER) / template._modelHeight
        // the template's baked quaternion would override rotation
        mushroom.rotationQuaternion = null
        mushroom.scaling.setAll(scale)
        mushroom.position.set(groundPos.x, groundPos.y - template._footY * scale, groundPos.z)
        // a little lean, so a cluster doesn't stand to attention
        mushroom.rotation.set((Math.random() - 0.5) * 0.3, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.3)
    },
    // the pickup picture is the item's own inventory icon - the kind IS the
    // item's name (tcp's mushroomLibrary.ts), so it's the same file the
    // inventory shows once it's picked
    iconImage: kind => `./images/items/consumable/${kind}.webp`,
    pickupRadius: PICKUP_RADIUS,
    onPickedUp: mushroomId => emitPickupMushroom(mushroomId),
})

export const createMushroomMesh = mushrooms.create
export const removeMushroomMesh = mushrooms.remove

// how much the rare kinds glow in `scene` - 0 by day (just GLOW), 1 at full
// night (MUSHROOM_NIGHT_GLOW). One skin per kind, so this lights every
// mushroom of that kind on the floor at once.
export function setMushroomNightGlow(scene, night){
    kindMaterials.get(scene)?.forEach((mat, kind) => {
        const glow = MUSHROOM_NIGHT_GLOW[kind]
        // a fresh colour, not written into the current one - every kind's
        // skin starts out sharing the one GLOW
        if(glow) mat.emissiveColor = Color3.Lerp(GLOW, glow, night)
    })
}

// A lone mushroom of `kind`, `height` tall, standing on its root's origin -
// for showing one anywhere but the floor (bonfireCooking.js's roasting spit).
// Its material is its OWN copy of the kind's skin, free to change (it browns
// as it roasts) without touching the floor's. { root, mesh }, or null if the
// model couldn't load or the scene went away meanwhile.
export async function createMushroomModel(scene, kind, height){
    const base = await loadBaseModel(scene)
    if(!base || scene.isDisposed) return null

    const root = new TransformNode(`mushroomModel_${kind}`, scene)
    const mesh = base.clone(`mushroomModel_${kind}_mesh`)
    mesh.isVisible = true
    mesh.isPickable = false
    mesh.material = kindMaterial(scene, kind).clone(`mushroomMat_${kind}_own`)
    mesh.parent = root
    const { minimum, maximum } = base.getBoundingInfo().boundingBox
    const scale = height / (maximum.y - minimum.y)
    mesh.scaling.setAll(scale)
    mesh.position.set(0, -minimum.y * scale, 0)
    return { root, mesh }
}
