import { Color3, Material, StandardMaterial } from "@babylonjs/core"
import { GLTF2 } from "@babylonjs/loaders"
import { applyShine } from "./surfacemat.js"

// NO PBR FROM glTF - every .glb the game loads (ImportMeshAsync,
// LoadAssetContainerAsync, the originalGlbs, armour, avatars, monsters...)
// comes in with StandardMaterials instead of the loader's PBRMaterials. A
// loader extension, so it's every load path at once: registered here, before
// anything loads (src/main.js imports this first), and it runs ahead of the
// loader's own material code.
//
// What a glTF material says, as a StandardMaterial: its base colour and
// texture as the diffuse, its normal map as the bump, its emission, its
// alpha mode, double-sidedness, and its metal/roughness as a highlight
// (surfacemat.js's applyShine). A primitive with no material at all gets a
// plain matte white one, like the loader's own default but standard.
//
// Each one is marked fromGltf in its metadata (isGltfMaterial) - areascene.js
// treats a model's own materials differently from ones the game made.

const NAME = "vessel_standard_materials"

export function isGltfMaterial(mat){
    return !!mat?.metadata?.fromGltf
}

class StandardMaterialsFromGltf {
    constructor(loader){
        this.name = NAME
        this.enabled = true
        // before every other material extension (KHR_materials_*), which
        // would otherwise reach for a PBR material that isn't there
        this.order = 1
        this._loader = loader
    }

    dispose(){
        this._loader = null
    }

    // the loader's default material (for primitives with none) is looked up
    // per draw mode in _defaultBabylonMaterialData and only made as PBR when
    // the slot is empty - so the slot hands back a standard one instead
    onLoading(){
        const loader = this._loader
        const made = {}
        loader._defaultBabylonMaterialData = new Proxy(made, {
            get: (slots, key) => {
                if(typeof key === "string" && /^\d+$/.test(key) && !slots[key]){
                    slots[key] = this._newMaterial("__GLTFLoader._default", Number(key))
                    // what the loader does when it makes one itself - an asset
                    // container collects its materials off this
                    loader.parent.onMaterialLoadedObservable.notifyObservers(slots[key])
                }
                return slots[key]
            },
        })
    }

    createMaterial(context, material, babylonDrawMode){
        return this._newMaterial(material.name || `material${material.index}`, babylonDrawMode)
    }

    loadMaterialPropertiesAsync(context, material, babylonMaterial){
        if(!(babylonMaterial instanceof StandardMaterial)) return null
        const loader = this._loader
        const mat = babylonMaterial
        const promises = []
        const pbr = material.pbrMetallicRoughness ?? {}
        const base = pbr.baseColorFactor ?? [1, 1, 1, 1]
        const baseColor = Color3.FromArray(base)
        mat.diffuseColor = baseColor
        mat.alpha = base[3]

        let baseTexture = null
        if(pbr.baseColorTexture){
            promises.push(loader.loadTextureInfoAsync(`${context}/pbrMetallicRoughness/baseColorTexture`, pbr.baseColorTexture, texture => {
                texture.name = `${mat.name} (Base Color)`
                mat.diffuseTexture = baseTexture = texture
            }))
        }

        applyShine(mat, { roughness: pbr.roughnessFactor ?? 1, metallic: pbr.metallicFactor ?? 1, tint: baseColor })

        // glTF's emission is factor TIMES texture; a StandardMaterial ADDS its
        // emissiveColor to the texture - a white factor over the eyes' texture
        // (avatar.glb) came out solid white. So with a texture the factor is
        // its strength instead, and the colour stays black.
        const emissiveFactor = material.emissiveFactor ? Color3.FromArray(material.emissiveFactor) : Color3.Black()
        const emissiveStrength = material.extensions?.KHR_materials_emissive_strength?.emissiveStrength ?? 1
        if(material.emissiveTexture){
            mat.emissiveColor = Color3.Black()
            promises.push(loader.loadTextureInfoAsync(`${context}/emissiveTexture`, material.emissiveTexture, texture => {
                texture.name = `${mat.name} (Emissive)`
                texture.level = Math.max(emissiveFactor.r, emissiveFactor.g, emissiveFactor.b) * emissiveStrength
                mat.emissiveTexture = texture
            }))
        } else {
            mat.emissiveColor = emissiveFactor.scale(emissiveStrength)
        }

        if(material.normalTexture){
            material.normalTexture.nonColorData = true
            promises.push(loader.loadTextureInfoAsync(`${context}/normalTexture`, material.normalTexture, texture => {
                texture.name = `${mat.name} (Normal)`
                if(material.normalTexture.scale != undefined) texture.level = material.normalTexture.scale
                mat.bumpTexture = texture
            }))
            // glTF's normal maps are the other handedness from Babylon's left-handed default
            const rightHanded = loader.babylonScene.useRightHandedSystem
            mat.invertNormalMapX = !rightHanded
            mat.invertNormalMapY = rightHanded
        }

        if(material.doubleSided){
            mat.backFaceCulling = false
            mat.twoSidedLighting = true
        }

        // KHR_materials_unlit - its colour as it is, no light on it
        if(material.extensions?.KHR_materials_unlit){
            mat.disableLighting = true
            mat.emissiveColor = baseColor.clone()
        }

        return Promise.all(promises).then(() => {
            switch(material.alphaMode){
                case "MASK":
                    mat.transparencyMode = Material.MATERIAL_ALPHATEST
                    mat.alphaCutOff = material.alphaCutoff ?? 0.5
                    if(baseTexture) baseTexture.hasAlpha = true
                    break
                case "BLEND":
                    mat.transparencyMode = Material.MATERIAL_ALPHABLEND
                    if(baseTexture){
                        baseTexture.hasAlpha = true
                        mat.useAlphaFromDiffuseTexture = true
                    }
                    break
                default:
                    mat.transparencyMode = Material.MATERIAL_OPAQUE
            }
        })
    }

    // made the way the loader makes its own - into the asset container when
    // it's loading into one, not straight into the scene
    _newMaterial(name, babylonDrawMode){
        const loader = this._loader
        const scene = loader.babylonScene
        const container = loader._assetContainer
        scene._blockEntityCollection = !!container
        const mat = new StandardMaterial(name, scene)
        mat._parentContainer = container
        scene._blockEntityCollection = false
        mat.fillMode = babylonDrawMode
        mat.specularColor = Color3.Black()
        mat.metadata = { ...mat.metadata, fromGltf: true }
        return mat
    }
}

GLTF2.registerGLTFExtension(NAME, false, loader => new StandardMaterialsFromGltf(loader))
