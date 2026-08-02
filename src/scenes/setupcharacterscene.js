import { Scene, HemisphericLight, Vector3, ArcRotateCamera, SceneLoader, LoadAssetContainerAsync, MeshBuilder, DirectionalLight, Quaternion, Color3, ShadowGenerator } from "@babylonjs/core";
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
import { SKIN_COLORS, SKIN_COLOR_LIST } from "../constants/skinColors.js";
import { ADVENTURER_COLORS } from "../constants/adventurerColors.js";

export async function setupCharacterScene(engine){
    let toSave = {
        owner: undefined,
        name: "",
        hairColor: ADVENTURER_COLORS.black,
        clothColor: ADVENTURER_COLORS.tan,
        pantsColor: ADVENTURER_COLORS.darkBrown,
        skinColor: SKIN_COLORS.light,
        cloth: "style1",
        pants: "style1",
        hair: "style1",
    }

    let headBone
    let hairs = []
    let clothes = []
    let pants = []

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
    meshes[0].getChildren()[0].getChildren().forEach(bne => {
        if(bne.name === "pelvis"){
            headBone = bne.getChildren()[0].getChildren()[0].getChildren()[0].getChildren()[0]
            // console.log("head bone found", headBone.name)
        }
    })

    const hairMat = createColorMat("hair_mat", toSave.hairColor , scene)
    const clothMat = createMatV2(scene, false, "./images/fabrics/fabric4normal.jpg")
    const pantsMat = createMatV2(scene, false, "./images/fabrics/fabric4normal.jpg")
    clothMat.diffuseColor = new Color3(0.42, 0.30, 0.16)
    pantsMat.diffuseColor = new Color3(0.22, 0.13, 0.05)
    const skinMat = createColorMat("skin_mat", toSave.skinColor, scene)

    // const clothMat = createMaterial(scene, "clothMat", {r: .2,g:.1,b:.1}, 2, { name: "fabric4" })
    // const pantsMat = createMaterial(scene, "clothMat", {r: .2,g:.1,b:.1}, 2, { name: "fabric4" })
    // const bootsMat = createMaterial(scene, "leather1", false, 2, { name: "leather1" })
    // const skinMat = createMaterial(scene, "skinMat", {r:0.45,g:0.30,b:0.16}, 3, { name: "skin1"})


    meshes[0].getChildren().forEach(mesh => {
        const meshPartName = mesh.name.toLowerCase()
        if(meshPartName.includes("ref")) return mesh.dispose();
        if(meshPartName.includes("hiddenbody")) return mesh.dispose();
        if(meshPartName.includes("cloak.")) return mesh.dispose();
        if(meshPartName.includes("belt.")) return mesh.dispose();
        if(meshPartName.includes("scalp")) return mesh.material = hairMat

        const toPush = mesh.name.split(".")[1]
               
        if(meshPartName.includes("mainbody")){
            mesh.material = skinMat      
        }
        if(toPush === undefined) return
        if(meshPartName.includes("cloth")) {
            mesh.material = clothMat
            clothes.push(mesh)
            meshPartName.includes(toSave.cloth) ? mesh.isVisible = true : mesh.isVisible = false
        }
        if(meshPartName.includes("hair")){
            mesh.material = hairMat
            hairs.push(mesh)
            meshPartName.includes(toSave.hair) ? mesh.isVisible = true : mesh.isVisible = false
        }
        if(meshPartName.includes("pants")){
            mesh.material = pantsMat
            pants.push(mesh)
            meshPartName.includes(toSave.pants) ? mesh.isVisible = true : mesh.isVisible = false
        }
        if(meshPartName.includes("boots")) return mesh.dispose()
        if(meshPartName.includes("armor")) mesh.dispose()
        if(meshPartName.includes("gear")) mesh.dispose()
    })
    const HairModel = await SceneLoader.ImportMeshAsync("", "./models/avatar/", "hairModels.glb", scene)
    HairModel.meshes.forEach(hairMsh => {
        if(hairMsh.name.includes("root")) return hairMsh.parent = headBone
        hairMsh.material = hairMat
        hairMsh.parent = headBone
        hairMsh.rotationQuaternion = null
        hairMsh.position = new Vector3(0,.45,-.1)
        hairMsh.scaling = new Vector3(8,8,8)
        hairMsh.isVisible = hairMsh.name.split(".")[1] === toSave.hair
        hairs.push(hairMsh)
    })
    HairModel.meshes[0].dispose()

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
        const arrMap = { hair: hairs, cloth: clothes, pants }
        const arr = arrMap[category]
        if (!arr) return
        arr.forEach(mesh => {
            mesh.isVisible = mesh.name.split(".")[1] === styleName
        })
    }

    const onCategoryChange = (category) => {
        selectedCategory = category
        if (colorPicker) colorPicker.isVisible = category !== "skin"
    }

    const onSkinSelect = (color) => {
        toSave.skinColor = color
        skinMat.diffuseColor.set(color.r, color.g, color.b)
    }

    showCreateCharacterPage(
        (characterNameFromInput) => { toSave.name = characterNameFromInput; return toSave },
        { hair: hairs, cloth: clothes, pants, skinColors: SKIN_COLOR_LIST },
        onStyleSelect,
        onCategoryChange,
        onSkinSelect
    )
    

    const overlay = document.querySelector(".page-overlay")
    // overlay.style.display ="none"   

    setGameStatus("running")
    meshes[0].getChildren()[0].getChildren().forEach(bne => {
        if(bne.name === "pelvis"){
            headBone = bne.getChildren()[0].getChildren()[0].getChildren()[0].getChildren()[0]
        }
    })
    const UITexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene)

    const matMap = { hair: hairMat, cloth: clothMat, pants: pantsMat, skin: skinMat }

    const colorPicker = createColorPicker(UITexture, (pickerVal) => {
        const { r, g, b } = pickerVal
        const mat = matMap[selectedCategory]
        if (mat) mat.diffuseColor.copyFrom(pickerVal)
        if (selectedCategory === "hair")  toSave = { ...toSave, hairColor:  { r, g, b } }
        if (selectedCategory === "cloth") toSave = { ...toSave, clothColor: { r, g, b } }
        if (selectedCategory === "pants") toSave = { ...toSave, pantsColor: { r, g, b } }
        if (selectedCategory === "skin")  toSave = { ...toSave, skinColor:  { r, g, b } }
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
