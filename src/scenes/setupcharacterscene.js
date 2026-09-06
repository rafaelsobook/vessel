import { Scene, HemisphericLight, Vector3, ArcRotateCamera, SceneLoader, LoadAssetContainerAsync, MeshBuilder, DirectionalLight, Quaternion, Color3, ShadowGenerator, Texture } from "@babylonjs/core";
import { getEngine, setGameStatus } from "../main/main";
import { createArcCam } from "../tools/camera";
import { avatarGlBpath } from "../constants/constants";
import { showCreateCharacterPage } from "../pages/createcharacterpage";
import * as GUI from "@babylonjs/gui"
import { createColorMat, createMat, createMatV2 } from "../tools/materials";
import { createColorPicker } from "../gui/colorpicker";
import { playAnim, stopAllAnim } from "../tools/animation";
import { checkIfTokenSaved } from "../tools/tools.js";
import { createRoom } from "../creations/createroom.js";
import { metaDatas } from "../constants/localroomdb.js"
import { mergeAndLoadModel } from "../tools/loadmodel.js";
import { disableEnableAttackButtonsContainer } from "../charactersystem/uimanagement.js";
import { SKIN_TEXTURES, SKIN_TEXTURE_LIST } from "../constants/skinColors.js";
import { ADVENTURER_COLORS } from "../constants/adventurerColors.js";
import { FEMALE_ONLY_NAMES, findDeepByName } from "../charactersystem/createcharacter.js";

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
    // own isFemale comment) - just a body, 2 hairstyles, and one fixed
    // default outfit (belt.style1/blindfold/mask.style.1/skirt.style1/bag/
    // silverine, always on, no picker)
    let femaleHairs = []
    let femaleAccessories = []
    let mainBodyMesh, scalpMesh, femaleBodyMesh

    const spawnPos = new Vector3(0,0,0)
    const scene = new Scene(engine)

    // createRoom() only builds the ground/walls for this scene (characterBody
    // is false here, so it skips optionalObjects entirely) - the bare room
    // otherwise has nothing lining it, so dress the perimeter with shelves.
    createRoom(scene, metaDatas[3], false, false)

    const hemLight = new HemisphericLight("HemiLight", new Vector3(0, 1, 0), scene);
    hemLight.intensity = .6

    const light = new DirectionalLight("light", new Vector3(-1,-2,0 ), scene)
    light.specular = new Color3(0,0,0)

    const shadowGenerator = new ShadowGenerator(1024, light)
    shadowGenerator.useBlurExponentialShadowMap = true
    shadowGenerator.blurKernel = 16

    placeCornerShelves(scene, metaDatas[3].width, metaDatas[3].height, shadowGenerator)
    // placeCornerShelves only insets 2.5 units from each corner, leaving the
    // low room wall exposed (with black void above it, since there's no
    // ceiling/skybox) along the middle stretch of every wall - fill the one
    // visible behind the character (north wall) with a plain textured box.
    coverBackWallGap(scene, metaDatas[3].width, metaDatas[3].height, shadowGenerator)

    const cam = new ArcRotateCamera("camera",-Math.PI/2 + Math.PI/10, Math.PI/2 - 0.2,5,new Vector3(0,0.8,0), scene)
    // cam.attachControl()

    const container = await LoadAssetContainerAsync(avatarGlBpath, scene)
    container.addAllToScene()
    const { meshes, animationGroups } = container
    meshes[0].position.y += 0.05
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
    // createcharacter.js's own femaleHair2Mat comment - female's "hair2"
    // style only, separate material so the bump map doesn't also apply to
    // hair1/male hair/scalp, which all still use the plain hairMat above
    const femaleHair2Mat = createColorMat("hair_mat_f2", toSave.hairColor, scene, "./images/textures/girlhair/hairstyle2.webp")
    const clothMat = createMatV2(scene, false, "./images/fabrics/fabric4normal.jpg")
    const pantsMat = createMatV2(scene, false, "./images/fabrics/fabric4normal.jpg")
    clothMat.diffuseColor = new Color3(0.42, 0.30, 0.16)
    pantsMat.diffuseColor = new Color3(0.22, 0.13, 0.05)
    // same coincident-geometry z-fight fix as createcharacter.js's own
    // createAnimeBodyMaterials (shirt hem vs pants waistband depth-testing
    // as a tie and letting pants win at random) - see that file's comment
    clothMat.zOffset = -2
    const skinMat = createMat("skin_mat", null, SKIN_TEXTURES[toSave.skinColor], scene)

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
        if(meshPartName.includes("cloak.")) return mesh.dispose(true);
        if(meshPartName.includes("belt.") && !meshPartName.includes("belt.style1")) return mesh.dispose(true);
        if(meshPartName.includes("boots")) return mesh.dispose(true)
        if(meshPartName.includes("armor")) return mesh.dispose(true)
        if(meshPartName.includes("gear")) return mesh.dispose(true)

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
                femaleBodyMesh = mesh
                mesh.isVisible = toSave.gender === "female"
                return
            }
            if(meshPartName.includes("femaile.hair") || meshPartName.includes("female.hair")){
                const hairStyleName = mesh.name.split(".")[1]
                // createcharacter.js's own femaleHair2Mat comment - hair2
                // gets the bump-mapped material, hair1 stays plain
                mesh.material = hairStyleName === "hair2" ? femaleHair2Mat : hairMat
                femaleHairs.push(mesh)
                mesh.isVisible = toSave.gender === "female" && hairStyleName === toSave.hair
                return
            }
            // belt.style1/blindfold/mask.style.1/skirt.style1/bag/silverine -
            // her one fixed default look, no picker
            femaleAccessories.push(mesh)
            mesh.isVisible = toSave.gender === "female"
            return
        }

        if(meshPartName.includes("scalp")){
            mesh.material = hairMat
            scalpMesh = mesh
            mesh.isVisible = toSave.gender !== "female"
            return
        }

        const toPush = mesh.name.split(".")[1]

        if(meshPartName.includes("mainbody")){
            mesh.material = skinMat
            mainBodyMesh = mesh
            mesh.isVisible = toSave.gender !== "female"
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

    // registered after the hair model is loaded/parented (not right after
    // container.addAllToScene()) so addShadowCaster's recursive includeChildren
    // walk actually finds it - it's parented under headBone, a descendant of
    // meshes[0], not attached yet at that earlier point
    shadowGenerator.addShadowCaster(meshes[0], true)

    stopAllAnim(animationGroups)
    playAnim(animationGroups, "idle", true)
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
    }

    // switches which body/hair/outfit set is showing - see this file's own
    // FEMALE_ONLY_NAMES-driven mesh split above. Cloth/pants/skinColor have
    // no female styles yet (createcharacter.js's own isFemale comment), so
    // those stay untouched here - createcharacterpage.js's own gender
    // buttons are what hides those two category icons for female instead
    const onGenderSelect = (gender) => {
        toSave.gender = gender
        const isFemale = gender === "female"

        if(mainBodyMesh) mainBodyMesh.isVisible = !isFemale
        if(scalpMesh) scalpMesh.isVisible = !isFemale
        clothes.forEach(mesh => mesh.isVisible = !isFemale && mesh.name.split(".")[1] === toSave.cloth)
        pants.forEach(mesh => mesh.isVisible = !isFemale && mesh.name.split(".")[1] === toSave.pants)

        if(femaleBodyMesh) femaleBodyMesh.isVisible = isFemale
        femaleAccessories.forEach(mesh => mesh.isVisible = isFemale)

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
        if (selectedCategory === "hair")  toSave = { ...toSave, hairColor:  { r, g, b } }
        if (selectedCategory === "cloth") toSave = { ...toSave, clothColor: { r, g, b } }
        if (selectedCategory === "pants") toSave = { ...toSave, pantsColor: { r, g, b } }
        // no "skin" branch: the color picker is hidden for that category
        // (onCategoryChange above) - skin is swatch-only now, via onSkinSelect.
    })
    disableEnableAttackButtonsContainer(false, true)
    return {scene, isSocketOn: false}
}

// Lines the room's perimeter with shelves near each corner - two per corner
// (one along each of its two adjoining walls), instanced off one hidden
// template. Rotation assumes the shelf model's authored front faces +Z;
// nudge the four rotation values below if it's actually flush against the
// wrong wall once you see it in-scene.
async function placeCornerShelves(scene, width, height, shadowGenerator){
    // mergeAndLoadModel (not loadModel, which assumes a single simple mesh) -
    // same convention used for every other multi-part decor prop (houses,
    // trees, poles, gates in assetregistry.js) - merges the glb's parts into
    // one instanceable mesh instead of risking orphaned sub-meshes.
    const template = await mergeAndLoadModel("./models/indors/shelves.glb", scene)
    template.isVisible = false

    const halfW = width / 2
    const halfH = height / 2
    const wallInset  = 0.9  // clears the wall's own thickness so it doesn't clip
    const cornerInset = 2.5 // distance along the wall away from the exact corner

    const ROT = { north: Math.PI, south: 0, east: Math.PI / 2, west: -Math.PI / 2 }

    const placements = [
        // NW corner
        { x: -halfW + cornerInset, z:  halfH - wallInset,  rot: ROT.north },
        { x: -halfW + wallInset,   z:  halfH - cornerInset, rot: ROT.west },
        // NE corner
        { x:  halfW - cornerInset, z:  halfH - wallInset,  rot: ROT.north },
        { x:  halfW - wallInset,   z:  halfH - cornerInset, rot: ROT.east },
        // SW corner
        { x: -halfW + cornerInset, z: -halfH + wallInset,  rot: ROT.south },
        { x: -halfW + wallInset,   z: -halfH + cornerInset, rot: ROT.west },
        // SE corner
        { x:  halfW - cornerInset, z: -halfH + wallInset,  rot: ROT.south },
        { x:  halfW - wallInset,   z: -halfH + cornerInset, rot: ROT.east },
    ]

    placements.forEach((p, i) => {
        const inst = template.createInstance(`corner_shelf_${i}`)
        inst.position = new Vector3(p.x, 0, p.z)
        inst.rotation.y = p.rot
        inst.isVisible = true
        inst.receiveShadows = true
        if(shadowGenerator) shadowGenerator.addShadowCaster(inst)
    })
}

// Fills the gap placeCornerShelves leaves along the middle of the north wall
// (the room's actual wall is only WALL_HEIGHT=0.5 tall, so that stretch is
// otherwise just black void above a low curb) with a plain textured box.
function coverBackWallGap(scene, width, height, shadowGenerator){
    const cornerInset = 2.5 // must match placeCornerShelves' own inset
    const fillHeight = 8
    const fillDepth = 0.3

    const wallMat = createMat("charroom_backwall_fill_mat", false, "./images/modeltex/wall4.jpg", scene, { uScale: 11, vScale: 11 })

    const fillWall = MeshBuilder.CreateBox("charroom_backwall_fill", {
        width: width - cornerInset * 2, height: fillHeight, depth: fillDepth,
    }, scene)
    fillWall.material = wallMat
    fillWall.position = new Vector3(0, fillHeight / 2, height / 2)
    fillWall.receiveShadows = true
    if(shadowGenerator) shadowGenerator.addShadowCaster(fillWall)
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
