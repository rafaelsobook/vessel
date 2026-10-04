import {PBRMaterial, Texture, DynamicTexture, Color3} from "@babylonjs/core";

// ── Height-map bumps ───────────────────────────────────────────────────────
// Babylon's bumpTexture only understands TANGENT-SPACE NORMAL MAPS (the blue-ish
// kind, RGB = a surface direction). A grey HEIGHT map - white raised, black
// sunk, like images/modeltex/pillartex1normal.webp, which despite its name is
// pure grey (R=G=B on every pixel) - fed in as one decodes every pixel to the
// direction (g, g, g) * 2 - 1: a fixed diagonal tilt, with the dark mortar lines
// pointing INTO the surface. The lighting turns to noise. So a height map is
// converted into a real normal map first.
// how many times a texture repeats across one floor/wall tile - shared by a
// surface's albedo and bump so they stay lined up
const DEFAULT_REPEAT = 2
const HEIGHT_BUMP_SIZE = 1024
// how steep the relief looks - the height's slope per pixel is multiplied by
// this before it becomes a normal (0 = flat, higher = deeper grooves)
const HEIGHT_BUMP_STRENGTH = 6

// path|size|strength -> Promise<ImageData> of the finished normal map. Kept for
// the whole session: every scene (each place change builds a new one) builds its
// own texture from it, so re-entering a dungeon doesn't redo the conversion.
const normalMapPixels = new Map()

function buildNormalMapPixels(path, size, strength){
    const key = `${path}|${size}|${strength}`
    if(normalMapPixels.has(key)) return normalMapPixels.get(key)

    const pixels = new Promise((resolve, reject) => {
        const img = new Image()
        img.onerror = () => reject(new Error(`could not load height map ${path}`))
        img.onload = () => {
            const canvas = document.createElement("canvas")
            canvas.width = canvas.height = size
            const ctx = canvas.getContext("2d", { willReadFrequently: true })
            ctx.drawImage(img, 0, 0, size, size)
            const rgba = ctx.getImageData(0, 0, size, size).data
            const height = new Float32Array(size * size)
            for(let i = 0; i < height.length; i++) height[i] = rgba[i * 4] / 255

            const normals = ctx.createImageData(size, size)
            const out = normals.data
            for(let y = 0; y < size; y++){
                // wraps at the edges, so a tiling height map tiles seamlessly as a normal map too
                const up = ((y + size - 1) % size) * size, row = y * size, down = ((y + 1) % size) * size
                for(let x = 0; x < size; x++){
                    const left = (x + size - 1) % size, right = (x + 1) % size
                    // Sobel: the height's slope across and down the image, per pixel
                    const dx = (height[up + right] + 2 * height[row + right] + height[down + right]
                              - height[up + left]  - 2 * height[row + left]  - height[down + left]) / 8
                    const dy = (height[down + left] + 2 * height[down + x] + height[down + right]
                              - height[up + left]   - 2 * height[up + x]   - height[up + right]) / 8
                    // the surface leans away from rising ground - Babylon reads a
                    // normal map's x and y the opposite way round from the
                    // textbook OpenGL layout (checked against real geometry
                    // displaced by the same image, lit from all four sides:
                    // the textbook signs lit every groove on the wrong edge)
                    const nx = dx * strength, ny = -dy * strength
                    const inv = 1 / Math.hypot(nx, ny, 1)
                    const o = (row + x) * 4
                    out[o]     = (nx * inv * 0.5 + 0.5) * 255
                    out[o + 1] = (ny * inv * 0.5 + 0.5) * 255
                    out[o + 2] = (inv * 0.5 + 0.5) * 255
                    out[o + 3] = 255
                }
            }
            resolve(normals)
        }
        img.src = path
    })
    normalMapPixels.set(key, pixels)
    // a failed load shouldn't stay cached - the next dungeon entry tries again
    pixels.catch(() => normalMapPixels.delete(key))
    return pixels
}

// A normal-map texture built from a grey height-map image (see above), ready to
// use as a material's bumpTexture. Returned at once as a flat surface (no relief)
// and filled in the moment the image has loaded and converted - so the material
// can be created synchronously and its shader never has to be rebuilt for the
// bump arriving late.
export function createHeightBumpTexture(path, scene, {
    uScale = DEFAULT_REPEAT, vScale = DEFAULT_REPEAT, size = HEIGHT_BUMP_SIZE, strength = HEIGHT_BUMP_STRENGTH
} = {}){
    const tex = new DynamicTexture(`bump_${path}`, { width: size, height: size }, scene, true)
    // a DynamicTexture clamps by default, which would smear its edge pixels across every repeat
    tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE
    tex.uScale = uScale
    tex.vScale = vScale

    const ctx = tex.getContext()
    ctx.fillStyle = "rgb(128,128,255)"   // the normal map's "straight up"
    ctx.fillRect(0, 0, size, size)
    tex.update()

    buildNormalMapPixels(path, size, strength).then(normals => {
        // the player may have left the place before the image arrived
        if(scene.isDisposed) return
        ctx.putImageData(normals, 0, 0)
        tex.update()
    }).catch(err => console.warn(`[createHeightBumpTexture] ${err.message} - left flat`))
    return tex
}

// A surface's albedo (colour) texture, repeated the way createHeightBumpTexture
// repeats its bump - the two MUST share one repeat, or the relief slides off the
// pattern it belongs to. Shareable between materials, like the bump.
export function createAlbedoTexture(path, scene, { uScale = DEFAULT_REPEAT, vScale = DEFAULT_REPEAT } = {}){
    const tex = new Texture(path, scene)
    tex.uScale = uScale
    tex.vScale = vScale
    return tex
}

// ./images/textures/<folder>/<name><suffix>.<ext>. A name that ends in an image
// extension keeps it ("pillartex1.webp" -> pillartex1.webp, and with "_normal"
// pillartex1_normal.webp); a bare name gets ".jpg", which is what every existing
// texture uses. The suffix goes before the extension either way.
const IMAGE_EXTENSION = /\.(jpe?g|png|webp)$/i
function texturePath(folder, name, suffix = ""){
    const ext = IMAGE_EXTENSION.exec(name)?.[0] ?? ".jpg"
    return `./images/textures/${folder}/${name.replace(IMAGE_EXTENSION, "")}${suffix}${ext}`
}

// texName: the texture's name, optionally with its extension - see texturePath.
// bumpTexture: a ready-made bump (normal-map) texture to use instead of loading
// <texName>_normal - e.g. createHeightBumpTexture(). Shareable between
// materials, so two materials can use one texture on the GPU instead of two.
// albedoTexture: likewise a ready-made colour texture (createAlbedoTexture),
// used instead of <texName>; albedoColor3 then TINTS it rather than replacing it.
export function createPBRMat(pathName, texName, scene, 
    {
    uScale = DEFAULT_REPEAT, vScale = DEFAULT_REPEAT, bumpTexture, albedoTexture
    } = {}, albedoColor3) {
    const mat = new PBRMaterial(texName, scene);

    let bumpTex = bumpTexture
    if(!bumpTex){
        bumpTex = new Texture(texturePath(pathName, texName, "_normal"), scene);
        bumpTex.uScale  = uScale;
        bumpTex.vScale  = vScale;
    }

    mat.albedoColor          = Color3.White();
    mat.roughness            = 1;
    mat.metallic             = 0;
    mat.environmentIntensity = 0.3;
    // mat.emissiveColor = new Color3(0.02, 0.1, 0.05);

    // the albedo texture is only loaded when it's actually shown - with a flat
    // albedoColor it used to be downloaded and then never used
    if(albedoTexture){
        mat.albedoTexture = albedoTexture
        if(albedoColor3) mat.albedoColor = albedoColor3   // multiplies the texture
    }else if(albedoColor3){
        mat.albedoColor = albedoColor3
    }else{
        const albTex = new Texture(texturePath(pathName, texName), scene);
        albTex.uScale   = uScale;
        albTex.vScale   = vScale;
        mat.albedoTexture = albTex
    }
    mat.bumpTexture = bumpTex
    return mat;
}
