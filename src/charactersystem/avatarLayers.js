import { pushDepth } from "../tools/depthPush.js"
import { tuckUnder, PUSH_WEIGHT_KIND } from "../tools/tuckUnder.js"

// The male avatar is layers on layers - skin, then pants, then shirt, with
// the hair and the face's eyes and lines over the skin of his head - and
// avatar.glb has them lying millimetres apart, or poking through each other
// where an animation bends two layers differently. With this game's camera
// (minZ 0.01, far 10000) the depth buffer can't keep layers that close apart
// once it's pulled back, so the inner one kept winning: skin showing through
// the shirt and pants, the scalp through the hair, the eye whites through
// the eyelids. Each layer is settled here so the one meant to be on top
// always wins (tools/tuckUnder.js, tools/depthPush.js):
//  - skin under shirt and pants, and the pants' top under the shirt: what's
//    covered isn't drawn at all, and the band along each hem and the collar
//    is pushed back EDGE_PUSH
//  - hair pulled HAIR_PULL towards the camera, over the scalp
//  - eyes and eye whites pushed back behind the eyelids (EYE_PUSH, the whites
//    a little further so the iris stays on them) - they still show through
//    the eye opening, there's nothing else there
//  - eyebrows and the face's lines pulled LINES_PULL forward, onto the skin
// Used by the in-game avatar (createcharacter.js) and the character-creation
// preview (setupcharacterscene.js), which is the same avatar.glb.

const EDGE_PUSH = 0.05
const HAIR_PULL = -0.02
const EYE_PUSH = 0.04
const EYE_WHITE_PUSH = 0.05
const LINES_PULL = -0.01

// the materials of one character's own layers - made per character, so each
// gets its push once
export function layerAvatarMaterials({ skinMat, pantsMat, hairMat }){
    if(skinMat) pushDepth(skinMat, EDGE_PUSH, PUSH_WEIGHT_KIND)
    if(pantsMat) pushDepth(pantsMat, EDGE_PUSH, PUSH_WEIGHT_KIND)
    if(hairMat) pushDepth(hairMat, HAIR_PULL)
}

// a face part straight off avatar.glb (eyes, eyeback, eyebrows, headlines) -
// its material is the glb's own, shared by every character made from it, so
// it's only ever given its push the once
export function layerFacePart(mesh){
    const mat = mesh.material
    if(!mat || mat.pluginManager?.getPlugin("DepthPush")) return
    const name = mesh.name.toLowerCase()
    if(name === "eyes") pushDepth(mat, EYE_PUSH)
    else if(name === "eyeback") pushDepth(mat, EYE_WHITE_PUSH)
    else if(name === "eyebrows" || name === "headlines") pushDepth(mat, LINES_PULL)
}

// skins: the body's own skin meshes (mainbodyhand/-head/-legs); cloth, pants:
// the shirt and pants being worn (either may be missing)
export function tuckOutfit(skins, cloth, pants){
    const covers = [cloth, pants].filter(Boolean)
    if(!covers.length) return
    const key = mesh => mesh.name.toLowerCase()
    tuckUnder(skins, covers, `skin|${covers.map(key).join("|")}`)
    if(cloth && pants) tuckUnder([pants], [cloth], `${key(pants)}|${key(cloth)}`)
}
