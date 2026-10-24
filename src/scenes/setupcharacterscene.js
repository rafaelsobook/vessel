import { Scene, Vector3, Quaternion, SceneLoader, LoadAssetContainerAsync, Color3, Texture } from "@babylonjs/core";
import { setGameStatus } from "../main/main";
import { avatarGlBpath } from "../constants/constants";
import { showCreateCharacterPage } from "../pages/createcharacterpage";
import * as GUI from "@babylonjs/gui"
import { createColorMat, createMat, createMatV2 } from "../tools/materials";
import { createColorPicker } from "../gui/colorpicker";
import { disableEnableAttackButtonsContainer } from "../charactersystem/uimanagement.js";
import { createRidingForest, createRiderCamera } from "./setupbackdrop.js";
import { SKIN_TEXTURES, SKIN_TEXTURE_LIST } from "../constants/skinColors.js";
import { ADVENTURER_COLORS } from "../constants/adventurerColors.js";
import { FEMALE_ONLY_NAMES, findDeepByName, facePartOf, isHiddenFemalePart } from "../charactersystem/createcharacter.js";
import { layerAvatarMaterials, layerFacePart, layerHelmet, layerWorn, tuckOutfit } from "../charactersystem/avatarLayers.js";
import { createMaterialFromDir } from "../creations/creationTools.js";
import { createMetalMat, METAL_COLOR } from "../tools/metalmat.js";
import { giveArmorDetail } from "../tools/armorDetail.js";

// what the new character wears in the preview, both bodies: the Iron Kraun
// Mask (npcDetails.js's kraunmask - helmets.glb's helmet.kraunmask.*) and the
// Priest Belt (avatar.glb's belt.prieststyle1, painted from
// images/textures/belt/priestbelt)
const KRAUN_MASK = { modelName: "kraunmask", metalColor: METAL_COLOR.IRON }
const PRIEST_BELT_MESH = "belt.prieststyle1"

// a clone of the mask from helmets.glb on the head bone - createcharacter.js's
// createHelmet, for the one mask
async function putOnKraunMask(scene, headBone){
    if(!headBone) return
    let loaded
    try {
        loaded = await SceneLoader.ImportMeshAsync("", "./models/helmets/", "helmets.glb", scene)
    } catch (error) {
        return console.warn(`[setupCharacterScene] failed to load helmets.glb`, error)
    }
    const template = loaded.meshes.find(msh => msh.name.split(".")[1] === KRAUN_MASK.modelName)
    if(!template) {
        loaded.meshes[0]?.dispose()
        return console.warn(`[setupCharacterScene] no "${KRAUN_MASK.modelName}" in helmets.glb`)
    }
    const mask = template.clone(`helmet.${KRAUN_MASK.modelName}.preview`)
    mask.parent = headBone
    mask.rotationQuaternion = Quaternion.Identity()
    mask.position = Vector3.Zero()
    const maskMat = giveArmorDetail(createMetalMat(scene, KRAUN_MASK.metalColor), KRAUN_MASK.metalColor, mask)
    // drawn over the hair, never under it - avatarLayers.js
    layerHelmet(maskMat)
    ;[mask, ...mask.getChildMeshes()].forEach(part => {
        part.material = maskMat
        part.isVisible = true
    })
    // the rest of helmets.glb isn't needed
    loaded.meshes[0]?.dispose()
}

// mainbody/femalebody/scalp aren't always a single flat mesh with no
// children on this rig (see createcharacter.js's own dispose(true) comment -
// the same asset already surprised us once with unexpected nesting) -
// `mesh.isVisible = false` only ever hides that ONE mesh's own geometry,
// never cascading to children the way a naive read of "hide this body"
// would suggest, so a child submesh (e.g. a hand) can be left rendering
// even while its parent is correctly marked invisible. Mirrors
// createcharacter.js's own showHideEquip pattern.
function setTreeVisible(mesh, isVisible){
    mesh.isVisible = isVisible
    mesh.getChildMeshes().forEach(child => child.isVisible = isVisible)
}

export async function setupCharacterScene(engine){
    let toSave = {
        owner: undefined,
        name: "",
        gender: "male",
        hairColor: ADVENTURER_COLORS.black,
        clothColor: ADVENTURER_COLORS.tan,
        pantsColor: ADVENTURER_COLORS.darkBrown,
        skinColor: "skin1", // a SKIN_TEXTURES key - see createcharacter.js's skinTexPath
        cloth: "style1",
        pants: "style1",
        hair: "style1",
    }

    let headBone
    let hairs = []
    let clothes = []
    let pants = []
    // female has no cloth/pants/skinColor style choices yet (createcharacter.js's
    // own isFemale comment) - just a body, her own face, 2 hairstyles, and one
    // fixed default outfit (belt.style1/blindfold/skirt.style1/bag/silverine,
    // always on, no picker - mask.style.1 is left off)
    let femaleHairs = []
    let femaleAccessories = []
    // each gender's eyes/eyeback/eyebrows (createcharacter.js's facePartOf) -
    // swapped by the gender toggle
    let maleFace = []
    let femaleFace = []
    // the male body - split across several separate meshes in avatar.glb
    // (mainBodyhand, mainBodyhead, mainbodylegs), none a child of another, so
    // each is tracked on its own and the gender toggle reaches every one. One
    // variable per name kept only whichever matched last, leaving the others
    // showing on the female body.
    let maleBodyMeshes = []
    // femalebody + femalebody.boobs
    let femaleBodyMeshes = []
    // the male scalp hair - avatar.glb has several of these (scalphair,
    // scalphair.001, scalpHairInside, scalphairtip), all hidden for female;
    // one variable kept only the last one, leaving the rest on her head
    let scalpMeshes = []

    const scene = new Scene(engine)

    // a forest clearing at dusk, the character riding the mythical beast
    // (setupbackdrop.js) - its lights, its shadows, and a camera on the rider
    // the player can drag to look around
    const forest = await createRidingForest(scene)
    const { shadowGenerator } = forest
    createRiderCamera(scene)

    const container = await LoadAssetContainerAsync(avatarGlBpath, scene)
    container.addAllToScene()
    const { meshes, animationGroups } = container
    // createcharacter.js's own findDeepByName comment - starting from a
    // fixed getChildren()[0] assumed that's always the Armature, which broke
    // once avatar.glb gained new top-level siblings (femalebody etc) that
    // can sort before it in export order
    let pelvisBoneForPreview = findDeepByName(meshes[0], bne => bne.name === "pelvis")
    if(pelvisBoneForPreview){
        headBone = pelvisBoneForPreview.getChildren()[0].getChildren()[0].getChildren()[0].getChildren()[0]
        // console.log("head bone found", headBone.name)
    } else {
        console.warn('[setupCharacterScene] pelvis bone not found - hair placement will be broken')
    }

    const hairMat = createColorMat("hair_mat", toSave.hairColor , scene)
    // createcharacter.js's own femaleHair1Mat/femaleHair2Mat comment -
    // female's two hairstyles each get their own material, separate from
    // the shared hairMat (male hair/scalp), so the bump map (hair2) and
    // backFaceCulling:false (both) stay scoped to just her own hairstyles
    const femaleHair2Mat = createColorMat("hair_mat_f2", toSave.hairColor, scene, "./images/textures/girlhair/hairstyle2.webp")
    const femaleHair1Mat = createColorMat("hair_mat_f1", toSave.hairColor, scene)
    femaleHair1Mat.backFaceCulling = false
    femaleHair2Mat.backFaceCulling = false
    const clothMat = createMatV2(scene, false, "./images/fabrics/fabric4normal.jpg")
    const pantsMat = createMatV2(scene, false, "./images/fabrics/fabric4normal.jpg")
    clothMat.diffuseColor = new Color3(0.42, 0.30, 0.16)
    pantsMat.diffuseColor = new Color3(0.22, 0.13, 0.05)
    // same coincident-geometry z-fight fix as createcharacter.js's own
    // createAnimeBodyMaterials (shirt hem vs pants waistband depth-testing
    // as a tie and letting pants win at random) - see that file's comment
    clothMat.zOffset = -2
    const skinMat = createMat("skin_mat", null, SKIN_TEXTURES[toSave.skinColor], scene)
    // his skin under his clothes, his hair over his scalp - the same layering
    // the in-game avatar gets (avatarLayers.js)
    layerAvatarMaterials({ skinMat, clothMat, pantsMat, hairMat })
    // createcharacter.js's equipBelt: the belt texture's diffuse + normal, a
    // dull specular (cloth, not metal), worn over the outfit
    const priestBeltMat = createMaterialFromDir(scene, "./images/textures/belt", { diff: "priestbelt", normal: "priestbeltnormal" })
    priestBeltMat.specularColor = new Color3(0.12, 0.12, 0.12)
    layerWorn(priestBeltMat)

    // const clothMat = createMaterial(scene, "clothMat", {r: .2,g:.1,b:.1}, 2, { name: "fabric4" })
    // const pantsMat = createMaterial(scene, "clothMat", {r: .2,g:.1,b:.1}, 2, { name: "fabric4" })
    // const bootsMat = createMaterial(scene, "leather1", false, 2, { name: "leather1" })
    // const skinMat = createMaterial(scene, "skinMat", {r:0.45,g:0.30,b:0.16}, 3, { name: "skin1"})


    meshes[0].getChildren().forEach(mesh => {
        const meshPartName = mesh.name.toLowerCase()
        // dispose(true) = doNotRecurse - see createcharacter.js's own
        // comment on this: Babylon's dispose() recursively disposes every
        // child of a node by default, and both bodies share ONE Armature,
        // not a copy each - a plain dispose() on any of these mesh nodes
        // would silently take shared bones down with it if any turn out to
        // be nested underneath one instead of sitting as a plain sibling.
        if(meshPartName.includes("ref")) return mesh.dispose(true);
        if(meshPartName.includes("hiddenbody")) return mesh.dispose(true);
        // tripo_node_<uuid> - leftover Tripo3D import artifact bundled
        // alongside the new female body parts, same category as ref/hiddenbody
        if(meshPartName.includes("tripo_node")) return mesh.dispose(true);
        // his face's lines (nose, mouth) - on his skin (avatarLayers.js)
        if(meshPartName === "headlines") layerFacePart(mesh)
        if(meshPartName.includes("cloak.")) return mesh.dispose(true);
        // the Priest Belt, on both bodies - painted as the game paints it
        // (createcharacter.js's equipBelt)
        if(meshPartName === PRIEST_BELT_MESH){
            mesh.material = priestBeltMat
            mesh.isVisible = true
            return
        }
        if(meshPartName.includes("belt.") && !meshPartName.includes("belt.style1")) return mesh.dispose(true);
        if(meshPartName.includes("boots")) return mesh.dispose(true)
        if(meshPartName.includes("armor")) return mesh.dispose(true)
        if(meshPartName.includes("gear")) return mesh.dispose(true)
        // her mask - left off, as in the game (createcharacter.js)
        if(isHiddenFemalePart(meshPartName)) return setTreeVisible(mesh, false)

        // the face - each gender has its own set; only the current one shows
        const face = facePartOf(meshPartName)
        if(face){
            (face.female ? femaleFace : maleFace).push(mesh)
            if(!face.female) layerFacePart(mesh)
            setTreeVisible(mesh, face.female === (toSave.gender === "female"))
            return
        }

        // createcharacter.js's own FEMALE_ONLY_NAMES/isFemale comment -
        // avatar.glb bundles both genders' meshes together now, hidden
        // (not disposed - the gender toggle below needs to swap back and
        // forth live) instead of shown/dispose like createcharacter.js does,
        // since this preview scene never reloads the glb on a gender switch
        const isFemaleNode = FEMALE_ONLY_NAMES.some(n => meshPartName.includes(n))

        if(isFemaleNode){
            if(meshPartName.includes("femalebody")){
                // skin color is a male-only option for now (createcharacter.js's
                // own createAnimeBody has the matching change) - femalebody
                // keeps whatever material it already ships with, untouched
                femaleBodyMeshes.push(mesh)
                setTreeVisible(mesh, toSave.gender === "female")
                return
            }
            if(meshPartName.includes("femaile.hair") || meshPartName.includes("female.hair")){
                const hairStyleName = mesh.name.split(".")[1]
                // createcharacter.js's own femaleHair1Mat/femaleHair2Mat
                // comment - hair2 gets the bump-mapped material, hair1 its
                // own plain one, neither the shared hairMat
                mesh.material = hairStyleName === "hair2" ? femaleHair2Mat : femaleHair1Mat
                femaleHairs.push(mesh)
                mesh.isVisible = toSave.gender === "female" && hairStyleName === toSave.hair
                return
            }
            // her own belt and skirt come off under the Priest Belt, as in the
            // game while she wears one (createcharacter.js's underBelt)
            if(meshPartName.startsWith("belt.style1") || meshPartName.includes("skirt.style")) return setTreeVisible(mesh, false)
            // blindfold/mask.style.1/bag/silverine - her one fixed default
            // look, no picker
            femaleAccessories.push(mesh)
            mesh.isVisible = toSave.gender === "female"
            return
        }

        if(meshPartName.includes("scalp")){
            mesh.material = hairMat
            scalpMeshes.push(mesh)
            setTreeVisible(mesh, toSave.gender !== "female")
            return
        }

        const toPush = mesh.name.split(".")[1]

        // every male body part - hand, head, legs (maleBodyMeshes up top) -
        // skin material, and hidden for female
        if(meshPartName.includes("mainbody")){
            mesh.material = skinMat
            maleBodyMeshes.push(mesh)
            setTreeVisible(mesh, toSave.gender !== "female")
        }
        if(toPush === undefined) return
        if(meshPartName.includes("cloth")) {
            mesh.material = clothMat
            clothes.push(mesh)
            mesh.isVisible = toSave.gender !== "female" && toPush === toSave.cloth
        }
        if(meshPartName.includes("hair")){
            mesh.material = hairMat
            hairs.push(mesh)
            mesh.isVisible = toSave.gender !== "female" && toPush === toSave.hair
        }
        if(meshPartName.includes("pants")){
            mesh.material = pantsMat
            pants.push(mesh)
            mesh.isVisible = toSave.gender !== "female" && toPush === toSave.pants
        }
    })
    // what the chosen shirt and pants cover of his skin isn't drawn - redone
    // whenever either changes (avatarLayers.js)
    const retuck = () => tuckOutfit(maleBodyMeshes,
        clothes.find(mesh => mesh.name.split(".")[1] === toSave.cloth),
        pants.find(mesh => mesh.name.split(".")[1] === toSave.pants))
    retuck()

    let HairModel
    try {
        HairModel = await SceneLoader.ImportMeshAsync("", "./models/avatar/", "hairModels.glb", scene)
    } catch (error) {
        console.warn(`[setupCharacterScene] failed to load hairModels.glb`, error)
        HairModel = { meshes: [] }
    }
    HairModel.meshes.forEach(hairMsh => {
        if(hairMsh.name.includes("root")) return hairMsh.parent = headBone
        hairMsh.material = hairMat
        hairMsh.parent = headBone
        hairMsh.rotationQuaternion = null
        hairMsh.position = new Vector3(0,.45,-.1)
        hairMsh.scaling = new Vector3(8,8,8)
        hairMsh.isVisible = toSave.gender !== "female" && hairMsh.name.split(".")[1] === toSave.hair
        hairs.push(hairMsh)
    })
    HairModel.meshes[0]?.dispose()

    // the Iron Kraun Mask on the head, as the game puts on a helmet
    // (createcharacter.js's createHelmet) - a mask, so the hair stays
    await putOnKraunMask(scene, headBone)

    // registered after the hair model is loaded/parented (not right after
    // container.addAllToScene()) so addShadowCaster's recursive includeChildren
    // walk actually finds it - it's parented under headBone, a descendant of
    // meshes[0], not attached yet at that earlier point
    shadowGenerator.addShadowCaster(meshes[0], true)

    // on the beast's back, in the saddle pose
    forest.seatRider(meshes[0], animationGroups)
    // hideOrDisposeAllByGroupNames(meshes[0].getChildren(), ["armor", "gear"], true)
    // const hairMesh = showMeshByGroupNames(meshes[0].getChildren(), [ toSave.hair, toSave.cloth, toSave.pants, toSave.boots], false)
    // if(hairMesh) hairMesh.material = hairMat

    let useChoises = {
        hairs: [],
        cloths: [],
        pants: [],
    }

    await scene.whenReadyAsync()

    let selectedCategory = "hair"

    const onStyleSelect = (category, styleName) => {
        toSave[category] = styleName
        // hair is the one category that exists for both genders, split
        // across two different mesh sources (hairModels.glb for male,
        // femaile.hair1/female.hair2 living directly in avatar.glb for
        // female) - only the current gender's own list should ever end up
        // visible, createcharacterpage.js's own hair buttons only ever offer
        // the current gender's styles anyway, but this keeps the 3D preview
        // correct even if called with a stale/wrong-gender styleName
        if(category === "hair"){
            const isFemale = toSave.gender === "female"
            hairs.forEach(mesh => mesh.isVisible = !isFemale && mesh.name.split(".")[1] === styleName)
            femaleHairs.forEach(mesh => mesh.isVisible = isFemale && mesh.name.split(".")[1] === styleName)
            return
        }
        const arrMap = { cloth: clothes, pants }
        const arr = arrMap[category]
        if (!arr) return
        arr.forEach(mesh => {
            mesh.isVisible = mesh.name.split(".")[1] === styleName
        })
        retuck()
    }

    // switches which body/hair/outfit set is showing - see this file's own
    // FEMALE_ONLY_NAMES-driven mesh split above. Cloth/pants/skinColor have
    // no female styles yet (createcharacter.js's own isFemale comment), so
    // those stay untouched here - createcharacterpage.js's own gender
    // buttons are what hides those two category icons for female instead
    const onGenderSelect = (gender) => {
        toSave.gender = gender
        const isFemale = gender === "female"

        maleBodyMeshes.forEach(mesh => setTreeVisible(mesh, !isFemale))
        scalpMeshes.forEach(mesh => setTreeVisible(mesh, !isFemale))
        clothes.forEach(mesh => mesh.isVisible = !isFemale && mesh.name.split(".")[1] === toSave.cloth)
        pants.forEach(mesh => mesh.isVisible = !isFemale && mesh.name.split(".")[1] === toSave.pants)

        femaleBodyMeshes.forEach(mesh => setTreeVisible(mesh, isFemale))
        femaleAccessories.forEach(mesh => mesh.isVisible = isFemale)
        maleFace.forEach(mesh => setTreeVisible(mesh, !isFemale))
        femaleFace.forEach(mesh => setTreeVisible(mesh, isFemale))

        // a hair style picked under the OTHER gender never matches this
        // one's own mesh suffixes (style1/2 vs hair1/2) - fall back to this
        // gender's first available style so switching never leaves the
        // character bald
        const ownHairList = isFemale ? femaleHairs : hairs
        if(!ownHairList.some(mesh => mesh.name.split(".")[1] === toSave.hair)){
            toSave.hair = ownHairList[0]?.name.split(".")[1]
        }
        hairs.forEach(mesh => mesh.isVisible = !isFemale && mesh.name.split(".")[1] === toSave.hair)
        femaleHairs.forEach(mesh => mesh.isVisible = isFemale && mesh.name.split(".")[1] === toSave.hair)

        return toSave.hair
    }

    const onCategoryChange = (category) => {
        selectedCategory = category
        if (colorPicker) colorPicker.isVisible = category !== "skin"
    }

    // male-only for now (createcharacter.js's own createAnimeBody has the
    // matching change) - femalebody no longer uses skinMat at all, and
    // createcharacterpage.js's own gender buttons hide the "skin" category
    // icon entirely for female so this never even gets a chance to fire for her
    const onSkinSelect = (key) => {
        toSave.skinColor = key
        skinMat.diffuseTexture = new Texture(SKIN_TEXTURES[key], scene)
    }

    showCreateCharacterPage(
        (characterNameFromInput) => { toSave.name = characterNameFromInput; return toSave },
        { hair: { male: hairs, female: femaleHairs }, cloth: clothes, pants, skinColors: SKIN_TEXTURE_LIST },
        onStyleSelect,
        onCategoryChange,
        onSkinSelect,
        onGenderSelect
    )
    

    const overlay = document.querySelector(".page-overlay")
    // overlay.style.display ="none"   

    setGameStatus("running")
    const pelvisBoneForPreview2 = findDeepByName(meshes[0], bne => bne.name === "pelvis")
    if(pelvisBoneForPreview2){
        headBone = pelvisBoneForPreview2.getChildren()[0].getChildren()[0].getChildren()[0].getChildren()[0]
    }
    const UITexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene)

    const matMap = { hair: hairMat, cloth: clothMat, pants: pantsMat, skin: skinMat }

    const colorPicker = createColorPicker(UITexture, (pickerVal) => {
        const { r, g, b } = pickerVal
        const mat = matMap[selectedCategory]
        if (mat) mat.diffuseColor.copyFrom(pickerVal)
        // femaleHair1Mat/femaleHair2Mat are SEPARATE material objects from
        // hairMat (so hair2's bump texture and both hairstyles'
        // backFaceCulling:false don't also apply to male hair/scalp, which
        // still shares hairMat) - being different objects entirely means
        // neither ever heard about a diffuseColor change made through
        // matMap.hair above. Mirror it here so all three hair materials
        // track the same picked color.
        if (selectedCategory === "hair"){
            femaleHair1Mat.diffuseColor.copyFrom(pickerVal)
            femaleHair2Mat.diffuseColor.copyFrom(pickerVal)
        }
        if (selectedCategory === "hair")  toSave = { ...toSave, hairColor:  { r, g, b } }
        if (selectedCategory === "cloth") toSave = { ...toSave, clothColor: { r, g, b } }
        if (selectedCategory === "pants") toSave = { ...toSave, pantsColor: { r, g, b } }
        // no "skin" branch: the color picker is hidden for that category
        // (onCategoryChange above) - skin is swatch-only now, via onSkinSelect.
    })
    disableEnableAttackButtonsContainer(false, true)
    return {scene, isSocketOn: false}
}

export function hideOrDisposeAllByGroupNames(meshes, groupNames = [], willDisposeAll, keepThisArmors = []){
    meshes.forEach(mesh => {
        if(keepThisArmors.length){
            keepThisArmors.forEach(armorName => {
                if(mesh.name.split(".")[0] === "armor") {
                // armor name armor.name
                if(mesh.name.split(".")[1] !== armorName) mesh.dispose()
            }
            })
            return
        }
        
        if(willDisposeAll){
            
            groupNames.forEach(groupName => {
                if(mesh.name.split(".")[0] === groupName) mesh.dispose()
            })
                    
            return
        }
        
    })
}

export function showMeshByGroupNames(meshes, meshNamesToShow = [], willDiposeRemainingMesh){
    const categories = ["hair", "cloth", "pants"]
    let selectedHairMesh
    meshes.forEach(mesh => {
        const meshCategName = mesh.name.split(".")[0]
        const productName = mesh.name.split(".")[1]
        if (!categories.includes(meshCategName)) return

        const shouldShow = meshNamesToShow.includes(productName)
        if (shouldShow) {
            mesh.isVisible = true
            if(meshCategName === "hair") {
                selectedHairMesh = mesh
            }
        } else {
            if (willDiposeRemainingMesh) return mesh.dispose()
            mesh.isVisible = false
        }
    })
    return selectedHairMesh
}
