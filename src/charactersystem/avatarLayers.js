import { pushDepth } from "../tools/depthPush.js"
import { tuckUnder, PUSH_WEIGHT_KIND } from "../tools/tuckUnder.js"
import { clipTucked } from "../tools/tuckClip.js"

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
//    covered isn't drawn at all, a triangle straddling a hem is cut off where
//    it crosses it (tools/tuckClip.js), and the band along each hem and the
//    collar is pushed back EDGE_PUSH
//  - hair pulled HAIR_PULL towards the camera, over the scalp
//  - eyes and eye whites pushed back behind the eyelids (EYE_PUSH, the whites
//    a little further so the iris stays on them) - they still show through
//    the eye opening, there's nothing else there
//  - eyebrows and the face's lines pulled LINES_PULL forward, onto the skin
//  - and all of the face's parts drawn one-sided: his head is only a face -
//    the hair is the back of it, there's no skull behind - so from behind,
//    wherever the hair left a gap, the eyes and lines showed through it
//  - the shirt and pants drawn one-sided: createMatV2 (tools/materials.js)
//    makes them double-sided, and in every wrinkle the cloth folds over
//    itself - the back of the fold, a hair behind the front and lit black
//    from behind, kept winning in patches once the camera was pulled back.
//    The cloth is a single outward-facing layer, so nothing is lost: looking
//    into a sleeve, the collar or under a hem still shows the body inside
// Used by the in-game avatar (createcharacter.js) and the character-creation
// preview (setupcharacterscene.js), which is the same avatar.glb.

const EDGE_PUSH = 0.05
// how far the pants may hang off his shins and still count as over them -
// further than the default: the cuffs hang loose, and as a knee bends the calf
// swings back out through the back of one by 10cm and more, far past any push
const SHIN_REACH = 0.12
const HAIR_PULL = -0.02
// a helmet sits over the hair, so it's pulled further forward than the hair
// is - with only HAIR_PULL on the hair, his scalphair (still worn under a
// helmet) won through the helmet wherever the two lay close
const HELMET_PULL = -0.05
const EYE_PUSH = 0.04
const EYE_WHITE_PUSH = 0.05
const LINES_PULL = -0.01

// the materials of one character's own layers - made per character, so each
// gets its push once
export function layerAvatarMaterials({ skinMat, clothMat, pantsMat, hairMat }){
    if(clothMat) clothMat.backFaceCulling = true
    if(pantsMat) pantsMat.backFaceCulling = true
    if(skinMat){
        pushDepth(skinMat, EDGE_PUSH, PUSH_WEIGHT_KIND)
        clipTucked(skinMat)
    }
    if(pantsMat){
        pushDepth(pantsMat, EDGE_PUSH, PUSH_WEIGHT_KIND)
        clipTucked(pantsMat)
    }
    if(hairMat) pushDepth(hairMat, HAIR_PULL)
}

// a worn helmet's own material (made per helmet in createcharacter.js's
// createHelmet) - always drawn over the hair under it
export function layerHelmet(material){
    if(!material || material.pluginManager?.getPlugin("DepthPush")) return
    pushDepth(material, HELMET_PULL)
}

// a face part straight off avatar.glb (eyes, eyeback, eyebrows, headlines) -
// its material is the glb's own, shared by every character made from it, so
// it's only ever given its push the once
export function layerFacePart(mesh){
    const mat = mesh.material
    if(!mat || mat.pluginManager?.getPlugin("DepthPush")) return
    const name = mesh.name.toLowerCase()
    if(["eyes", "eyeback", "eyebrows", "headlines"].includes(name)) mat.backFaceCulling = true
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
    const isShins = mesh => key(mesh) === "mainbodylegs"
    tuckUnder(skins.filter(mesh => !isShins(mesh)), covers, `skin|${covers.map(key).join("|")}`)
    tuckUnder(skins.filter(isShins), covers, `shins|${covers.map(key).join("|")}`, SHIN_REACH)
    if(cloth && pants) tuckUnder([pants], [cloth], `${key(pants)}|${key(cloth)}`)
}
