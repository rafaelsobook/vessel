import { Scene, HemisphericLight, Vector3, ArcRotateCamera, SceneLoader, LoadAssetContainerAsync, MeshBuilder, DirectionalLight, Quaternion, Color3 } from "@babylonjs/core";
import { getEngine, setGameStatus } from "../main/main";
import { createArcCam } from "../tools/camera";
import { avatarGlBpath } from "../constants/constants";
import { showCreateCharacterPage } from "../pages/createcharacterpage";
import * as GUI from "@babylonjs/gui"
import { createColorMat, createMatV2 } from "../tools/materials";
import { createColorPicker } from "../gui/colorpicker";
import { playAnim, stopAllAnim } from "../tools/animation";
import { checkIfTokenSaved } from "../tools/tools.js";
import { createRoom } from "../creations/createroom.js";
import { metaDatas } from "../constants/localroomdb.js"

export async function setupCharacterScene(engine){
    let toSave = {
        owner: checkIfTokenSaved().details._id,
        name: "",
        hairColor: { r: 0, g: 0, b: 0},
        clothColor: { r: 0.42, g: 0.30, b: 0.16 },
        pantsColor: { r: 0.22, g: 0.13, b: 0.05 },
        skinColor: { r: 0.45, g: 0.30, b: 0.16 },
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

    createRoom(scene, metaDatas[3], false, false)

    const hemLight = new HemisphericLight("HemiLight", new Vector3(0, 1, 0), scene);
    hemLight.intensity = .6

    const light = new DirectionalLight("light", new Vector3(-1,-2,0 ), scene)
    light.specular = new Color3(0,0,0)
    
    const cam = new ArcRotateCamera("camera",-Math.PI/2 + Math.PI/10, Math.PI/2 - 0.2,5,new Vector3(0,0.8,0), scene)
    cam.attachControl()

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

    const skinColors = [
        { r: 0.45, g: 0.30, b: 0.16 },
        { r: 0.76, g: 0.57, b: 0.38 },
        { r: 0.93, g: 0.78, b: 0.63 },
    ]

    const onSkinSelect = (color) => {
        toSave.skinColor = color
        skinMat.diffuseColor.set(color.r, color.g, color.b)
    }

    showCreateCharacterPage(
        (characterNameFromInput) => { toSave.name = characterNameFromInput; return toSave },
        { hair: hairs, cloth: clothes, pants, skinColors },
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

    return scene
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
