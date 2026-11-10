import { Color3, MaterialPluginBase, VertexBuffer } from "@babylonjs/core"

// HAIR THAT READS AS HAIR - the avatars' hair (createcharacter.js, and the
// character creation preview, setupcharacterscene.js) was one flat diffuse
// colour with no specular at all: a solid silhouette, black hair a hole in
// the screen. Stylised (anime) hair gets its look from a few things, all
// added here on top of the material's own colour, so the dye still decides
// what colour it all is:
//
//   strands      streaks of lighter and darker running from the crown down
//                to the tips. Neither hair mesh has UVs that follow its
//                strands (hairModels.glb's are off curves, the female hair's
//                are Tripo's atlas), so they're keyed on the direction the
//                surface faces round the head (its bind pose normal's angle
//                about the head's up axis) - constant down a strand, changing
//                across them, converging at the crown like a real part
//   the ring     the "angel ring": a band of shine round the head, from the
//                Kajiya-Kay strand highlight (the tangent, not the normal, is
//                lit - Scheuermann, "Practical Real-Time Hair Rendering",
//                GDC 2004): a sharp near-white primary and a broad secondary
//                in the hair's own colour, its edge broken up by the strands.
//                Lit from above the eye, and only as bright as the light the
//                hair is actually getting (warm by the fire, dim by night)
//   shading      the underside of the hair in its own shadow, a soft rim
//                where it turns away, and black hair kept a deep grey so it
//                still shows shape
//   an outline   a thin ink line round the hair's silhouette (Babylon's
//                outline renderer), a darker shade of the dye
//
// giveHairShading(material) - once per hair material.
// outlineHair(mesh, color) - per hair mesh shown; again with the new dye.

const DEFAULTS = {
    ring: 1,        // the angel ring's strength
    strands: 1,     // how strongly the strands show
    rim: 1,         // the rim's strength
    // streaks round the head (more = finer strands)
    density: 46,
}
// the outline: how thick in the world, and how dark a shade of the dye
const OUTLINE_WIDTH = 0.0045
const OUTLINE_SHADE = 0.28

class HairShadePlugin extends MaterialPluginBase {
    constructor(material, options){
        super(material, "HairShade", 220, { HAIRSHADE: false }, true, true)
        this.options = { ...DEFAULTS, ...options }
        this._isEnabled = true
    }
    // a Babylon plugin can't be deactivated once on - its own define switches
    // the shader code off instead
    get isEnabled(){ return this._isEnabled }
    set isEnabled(enabled){
        if(this._isEnabled === enabled) return
        this._isEnabled = enabled
        this.markAllDefinesAsDirty()
    }
    getClassName(){ return "HairShadePlugin" }
    prepareDefines(defines, scene, mesh){
        defines.HAIRSHADE = this._isEnabled && mesh.isVerticesDataPresent(VertexBuffer.NormalKind)
    }
    getUniforms(){
        return {
            ubo: [{ name: "hairShadeInfos", size: 4, type: "vec4" }],
            fragment: `
                #ifdef HAIRSHADE
                    uniform vec4 hairShadeInfos;
                #endif
            `,
        }
    }
    bindForSubMesh(uniformBuffer){
        const o = this.options
        uniformBuffer.updateFloat4("hairShadeInfos", o.ring, o.strands, o.rim, o.density)
    }
    getCustomCode(shaderType, shaderLanguage){
        // GLSL only - the game runs on WebGL
        if(shaderLanguage !== undefined && shaderLanguage !== 0) return null
        const varyings = `
            #if defined(HAIRSHADE) && defined(NORMAL)
                varying vec3 vHairNormal;   // bind pose normal, the mesh's own axes
                varying vec3 vHairPos;      // bind pose position, the mesh's own units (~metres)
                varying vec3 vHairUpW;      // the mesh's up axis in the world (bones and all)
            #endif
        `
        if(shaderType === "vertex") return {
            CUSTOM_VERTEX_DEFINITIONS: varyings,
            // positionUpdated/normalUpdated are still unskinned here - the
            // bones went into finalWorld
            CUSTOM_VERTEX_MAIN_END: `
                #if defined(HAIRSHADE) && defined(NORMAL)
                    vHairNormal = normalUpdated;
                    vHairPos = positionUpdated;
                    vHairUpW = normalize(mat3(finalWorld)[1]);
                #endif
            `,
        }
        return {
            CUSTOM_FRAGMENT_DEFINITIONS: varyings + `
                #if defined(HAIRSHADE) && defined(NORMAL)
                    float hairHash(float n){ return fract(sin(n * 12.9898) * 43758.5453); }
                    // value noise round a circle: period cells, no seam at the back
                    float hairNoise(float x, float period){
                        float i = floor(x);
                        float f = fract(x);
                        f = f * f * (3.0 - 2.0 * f);
                        return mix(hairHash(mod(i, period)), hairHash(mod(i + 1.0, period)), f);
                    }
                #endif
            `,
            // after the colour's composed, before fog: shade it as hair
            CUSTOM_FRAGMENT_BEFORE_FOG: `
                #if defined(HAIRSHADE) && defined(NORMAL)
                {
                    vec3 hn = normalize(vHairNormal);
                    vec3 upW = normalize(vHairUpW);
                    float density = hairShadeInfos.w;
                    // round the head, 0..1 - the strands run down it
                    float around = atan(hn.x, hn.z) / 6.2831853 + 0.5;
                    // how far down from the crown, 0 (top) .. 1 (under)
                    float down = acos(clamp(hn.y, -1.0, 1.0)) / 3.14159265;
                    // clumps: round the head (the same down each one)
                    float clumps =
                        hairNoise(around * density, density) * 0.65 +
                        hairNoise(around * density * 2.3 + down * 1.7, floor(density * 2.3)) * 0.35;
                    // fine strands: across the strand at this point - the
                    // surface's own sideways - so they run down every face,
                    // however few faces the mesh has
                    vec3 sideways = cross(hn, vec3(0.0, 1.0, 0.0));
                    float sideLen = length(sideways);
                    float across = sideLen > 0.001 ? dot(vHairPos, sideways / sideLen) : 0.0;
                    float fine =
                        hairNoise(across * 160.0 + 17.0, 4096.0) * 0.6 +
                        hairNoise(across * 410.0 + 3.0, 4096.0) * 0.4;
                    float strands = mix(clumps, fine, 0.5);
                    // the crown, where every strand meets, is left calm
                    float strandMask = smoothstep(0.02, 0.18, down) * hairShadeInfos.y;

                    // the light this point is actually getting
                    vec3 lit = diffuseBase;
                    float light = clamp(dot(lit, vec3(0.3, 0.59, 0.11)), 0.0, 1.5);
                    vec3 dye = vDiffuseColor.rgb;

                    // black stays a deep grey that still takes the light
                    vec3 shaded = color.rgb + vec3(0.045) * (lit + vec3(0.25));
                    // strands, light and dark
                    shaded *= mix(1.0, mix(0.62, 1.28, strands), strandMask);
                    shaded += (strands - 0.45) * 0.05 * strandMask * (lit + vec3(0.2));
                    // the underside in the hair's own shadow
                    shaded *= mix(0.62, 1.0, smoothstep(-0.55, 0.45, hn.y));

                    // the angel ring: the strand (down the head, along the
                    // surface) lit from a little above the eye
                    vec3 V = viewDirectionW;
                    vec3 T = upW - normalW * dot(normalW, upW);
                    float tLen = length(T);
                    T = tLen > 0.0001 ? T / tLen : upW;
                    vec3 H = normalize(V + upW * 0.55);
                    float jag = (strands - 0.5) * 0.35;
                    vec3 T1 = normalize(T + normalW * (0.05 + jag));
                    vec3 T2 = normalize(T + normalW * (-0.12 + jag * 0.6));
                    float d1 = dot(T1, H);
                    float d2 = dot(T2, H);
                    float spec1 = pow(sqrt(max(0.0, 1.0 - d1 * d1)), 90.0);
                    spec1 = smoothstep(0.18, 0.62, spec1);
                    float spec2 = pow(sqrt(max(0.0, 1.0 - d2 * d2)), 18.0) * (0.55 + 0.45 * strands);
                    // only on the hair facing us, fading off its sides - and
                    // a band round the head, never on the crown (where the
                    // strands all meet and their direction means nothing) or
                    // under it
                    float facing = smoothstep(0.05, 0.45, dot(normalW, V));
                    float band = smoothstep(0.1, 0.3, down) * (1.0 - smoothstep(0.68, 0.92, down));
                    vec3 ringLight = lit + vec3(0.12);
                    vec3 ring = (mix(dye, vec3(1.0), 0.45) * 0.42 * spec1 + (dye * 1.4 + vec3(0.04)) * 0.3 * spec2) * ringLight * facing * band;
                    shaded += ring * hairShadeInfos.x * mix(0.75, 1.0, strandMask);

                    // a soft rim where it turns away from us
                    float rim = pow(1.0 - clamp(dot(normalW, V), 0.0, 1.0), 3.0);
                    shaded += (dye * 0.6 + vec3(0.05)) * rim * 0.5 * (lit + vec3(0.1)) * hairShadeInfos.z;

                    color.rgb = shaded;
                }
                #endif
            `,
        }
    }
}

/** Shades a hair material (a StandardMaterial) as hair. Once per material; returns it. */
export function giveHairShading(material, options){
    if(!material || material._hairShade) return material
    material._hairShade = new HairShadePlugin(material, options)
    // what shine there is, the ring gives - the plain specular stays off
    material.specularColor = Color3.Black()
    return material
}

// how many world units one of the mesh's own makes (bones and all aren't
// counted - its node scale is what the outline's offset is measured in)
function worldScaleOf(mesh){
    const m = mesh.computeWorldMatrix(true).m
    return Math.hypot(m[0], m[1], m[2]) || 1
}

/**
 * Inks the hair mesh's silhouette in a dark shade of `color` (the dye,
 * {r, g, b}). Call again with a new dye to recolour it.
 */
export function outlineHair(mesh, color){
    if(!mesh || mesh.isDisposed?.() || !mesh.getTotalVertices?.()) return
    if(!mesh._hairOutline){
        mesh._hairOutline = true
        mesh.renderOutline = true
        mesh.outlineWidth = OUTLINE_WIDTH / worldScaleOf(mesh)
    }
    const c = color ?? mesh.material?.diffuseColor ?? { r: 0, g: 0, b: 0 }
    mesh.outlineColor = new Color3(c.r * OUTLINE_SHADE, c.g * OUTLINE_SHADE, c.b * OUTLINE_SHADE)
}
