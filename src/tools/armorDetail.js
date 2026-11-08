import { MaterialPluginBase, Texture, VertexBuffer } from "@babylonjs/core"

// Surface detail for metal armour - armour, helmets, pauldrons, gauntlets
// (createcharacter.js) - as a detail normal map: hammer dents, scratches and
// grain on forged metal, raised scales on dragonscale. The textures are in
// images/textures/armor, all tangent space normal maps:
//   forgednormal.webp      - tileable forged plate, every metal but dragonscale
//   scalesnormal.webp      - tileable dragon scales
//   dragonscalenormal.webp - the scales of images/modeltex/items/
//                            blackdragonscale.webp itself, seam for seam
//
// Most of these meshes have no UVs (armor.knightscale, armor.lightarmor,
// gauntlet.gauntler), and the ones that do have Tripo's chopped-up atlas
// UVs, so the tileable maps aren't laid on with UVs at all - they're
// projected along the mesh's own three axes and blended by which way the
// surface faces (triplanar), with each projection's normals combined the
// "whiteout" way (Ben Golus, "Normal Mapping for a Triplanar Shader" - the
// method Unity's Shader Graph Triplanar node uses). Projected from the
// mesh's unskinned bind pose, so the pattern stays put on the armour while
// the character moves, and sized in world units, so a dent is the same size
// on a helmet as on a breastplate whatever scale each mesh was built at.
//
// The exception is dragonscale on a mesh WITH UVs: there its colour image is
// laid on with those UVs (metalmat.js's MATERIAL_TEXTURES), so its bumps go
// on the same way - an ordinary bumpTexture - to sit under the very seams the
// colour shows.

const MAPS = {
    forged: "./images/textures/armor/forgednormal.webp",
    scales: "./images/textures/armor/scalesnormal.webp",
    dragonscale: "./images/textures/armor/dragonscalenormal.webp",
}

// How each metal's surface is worked. map: which detail. tileSize: world
// units one repeat of it covers - a forged map tile holds about 7 big hammer
// blows. strength: how deep it all reads (1 is the map as drawn). Iron and
// black plate are crude and heavily worked; precious and magic metals are
// finished smoother. uvMap/uvStrength: dragonscale's map for meshes with UVs.
const ARMOR_FINISH = {
    iron:        { map: "forged", tileSize: 0.45, strength: 1.0 },
    steel:       { map: "forged", tileSize: 0.55, strength: 0.8 },
    bronze:      { map: "forged", tileSize: 0.5,  strength: 0.9 },
    silver:      { map: "forged", tileSize: 0.6,  strength: 0.6 },
    gold:        { map: "forged", tileSize: 0.6,  strength: 0.6 },
    ruby:        { map: "forged", tileSize: 0.55, strength: 0.6 },
    mythril:     { map: "forged", tileSize: 0.65, strength: 0.5 },
    adamantine:  { map: "forged", tileSize: 0.5,  strength: 0.6 },
    emerald:     { map: "forged", tileSize: 0.55, strength: 0.6 },
    dragonscale: { map: "scales", tileSize: 0.45, strength: 1.0, uvMap: "dragonscale", uvStrength: 1.0 },
    black:       { map: "forged", tileSize: 0.45, strength: 1.1 },
}

// one texture per map per scene - every armour piece shares it. Never
// disposed with a material (ArmorDetailPlugin's dispose leaves it), only with
// its scene.
const textureCache = new WeakMap()   // scene -> Map(path -> Texture)
function detailTexture(scene, path, invertY){
    let byPath = textureCache.get(scene)
    if(!byPath) textureCache.set(scene, byPath = new Map())
    const key = `${path}|${invertY}`
    let texture = byPath.get(key)
    if(!texture){
        texture = new Texture(path, scene, false, invertY)
        texture.anisotropicFilteringLevel = 8
        byPath.set(key, texture)
    }
    return texture
}

class ArmorDetailPlugin extends MaterialPluginBase {
    constructor(material, texture, tilesPerUnit, strength){
        // priority 210, defines, add to the plugin list, enabled from the start
        super(material, "ArmorDetail", 210, { ARMORDETAIL: false }, true, true)
        this.texture = texture
        this.tilesPerUnit = tilesPerUnit
        this.strength = strength
        this._isEnabled = true
    }

    // a Babylon plugin can't be deactivated once on - this switches its
    // shader code off instead (a low graphics setting, a before/after test)
    get isEnabled(){
        return this._isEnabled
    }
    set isEnabled(enabled){
        if(this._isEnabled === enabled) return
        this._isEnabled = enabled
        this.markAllDefinesAsDirty()
    }

    getClassName(){
        return "ArmorDetailPlugin"
    }

    isReadyForSubMesh(){
        return !this._isEnabled || this.texture.isReady()
    }

    prepareDefines(defines, scene, mesh){
        defines.ARMORDETAIL = this._isEnabled && mesh.isVerticesDataPresent(VertexBuffer.NormalKind)
    }

    getSamplers(samplers){
        samplers.push("armorDetailSampler")
    }

    getActiveTextures(activeTextures){
        activeTextures.push(this.texture)
    }

    hasTexture(texture){
        return texture === this.texture
    }

    getUniforms(){
        return {
            ubo: [{ name: "armorDetailInfos", size: 2, type: "vec2" }],
            fragment: `
                #ifdef ARMORDETAIL
                    uniform vec2 armorDetailInfos;
                #endif
            `,
        }
    }

    bindForSubMesh(uniformBuffer){
        uniformBuffer.updateFloat2("armorDetailInfos", this.tilesPerUnit, this.strength)
        uniformBuffer.setTexture("armorDetailSampler", this.texture)
    }

    getCustomCode(shaderType, shaderLanguage){
        // GLSL only - the game runs on WebGL
        if(shaderLanguage !== undefined && shaderLanguage !== 0) return null
        const varyings = `
            #if defined(ARMORDETAIL) && defined(NORMAL)
                varying vec3 vArmorPos;      // bind pose position, in world units
                varying vec3 vArmorNormal;   // bind pose normal
                varying vec3 vArmorAxisX;    // the mesh's own axes in the world
                varying vec3 vArmorAxisY;
                varying vec3 vArmorAxisZ;
            #endif
        `
        if(shaderType === "vertex") return {
            CUSTOM_VERTEX_DEFINITIONS: varyings,
            // positionUpdated/normalUpdated are still unskinned here - the
            // bones went into finalWorld instead
            CUSTOM_VERTEX_MAIN_END: `
                #if defined(ARMORDETAIL) && defined(NORMAL)
                    mat3 armorToWorld = mat3(finalWorld);
                    float armorScale = length(armorToWorld[0]);
                    vArmorPos = positionUpdated * armorScale;
                    vArmorNormal = normalUpdated;
                    vArmorAxisX = armorToWorld[0] / armorScale;
                    vArmorAxisY = armorToWorld[1] / armorScale;
                    vArmorAxisZ = armorToWorld[2] / armorScale;
                #endif
            `,
        }
        return {
            CUSTOM_FRAGMENT_DEFINITIONS: varyings + `
                #if defined(ARMORDETAIL) && defined(NORMAL)
                    uniform sampler2D armorDetailSampler;
                #endif
            `,
            // normalW is final here and nothing has lit with it yet
            CUSTOM_FRAGMENT_BEFORE_LIGHTS: `
                #if defined(ARMORDETAIL) && defined(NORMAL)
                {
                    vec3 an = normalize(vArmorNormal);
                    vec3 ap = vArmorPos * armorDetailInfos.x;
                    // which projections this point takes, sharpened so the
                    // blend between them is short
                    vec3 aw = pow(abs(an), vec3(4.0));
                    aw /= max(aw.x + aw.y + aw.z, 0.00001);
                    vec3 tX = texture2D(armorDetailSampler, ap.zy).xyz * 2.0 - 1.0;
                    vec3 tY = texture2D(armorDetailSampler, ap.xz).xyz * 2.0 - 1.0;
                    vec3 tZ = texture2D(armorDetailSampler, ap.xy).xyz * 2.0 - 1.0;
                    tX.xy *= armorDetailInfos.y;
                    tY.xy *= armorDetailInfos.y;
                    tZ.xy *= armorDetailInfos.y;
                    // whiteout blend of each projection onto the surface normal
                    tX = vec3(tX.xy + an.zy, abs(tX.z) * an.x);
                    tY = vec3(tY.xy + an.xz, abs(tY.z) * an.y);
                    tZ = vec3(tZ.xy + an.xy, abs(tZ.z) * an.z);
                    vec3 armorDetail = normalize(tX.zyx * aw.x + tY.xzy * aw.y + tZ.xyz * aw.z);
                    mat3 armorToWorld = mat3(vArmorAxisX, vArmorAxisY, vArmorAxisZ);
                    vec3 armorDetailW = normalize(armorToWorld * armorDetail);
                    // facing the way Babylon decided this side faces
                    normalW = dot(armorToWorld * an, normalW) < 0.0 ? -armorDetailW : armorDetailW;
                }
                #endif
            `,
        }
    }
}

// Gives a metal armour material (metalmat.js's createMetalMat) its surface
// detail for metalColor, on `mesh` - the piece it's for (whether that has UVs
// decides how dragonscale's goes on).
export function giveArmorDetail(material, metalColor, mesh){
    const scene = material.getScene()
    const finish = ARMOR_FINISH[metalColor] ?? ARMOR_FINISH.iron
    if(finish.uvMap && material.diffuseTexture && mesh?.isVerticesDataPresent(VertexBuffer.UVKind)){
        // invertY as the colour image is loaded, so the two line up
        material.bumpTexture = detailTexture(scene, MAPS[finish.uvMap], true)
        material.bumpTexture.level = finish.uvStrength
        return material
    }
    new ArmorDetailPlugin(material, detailTexture(scene, MAPS[finish.map], false), 1 / finish.tileSize, finish.strength)
    return material
}
