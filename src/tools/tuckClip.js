import { MaterialPluginBase } from "@babylonjs/core"
import { TUCK_DEPTH_KIND } from "./tuckUnder.js"

// Cuts a tucked-in layer off at the edge of what covers it (tools/tuckUnder.js).
// tuckUnder already drops every triangle that's fully under the cover, but one
// that straddles a hem - a corner under the cloth, the rest out in the open -
// has to stay, and as the body moves the part of it under the cloth can swing
// out through it: the calf through the back of a pant cuff as the knee bends,
// by 10-20cm, far past what a depth push can hide. Each vertex carries
// TUCK_DEPTH_KIND - how far under the cover's nearest edge it is, negative in
// the open - and blended across a straddling triangle that crosses 0 about at
// the hem; whatever is more than CUT under the edge isn't drawn. CUT leaves a
// sliver tucked under the hem, so no gap ever opens between skin and cloth;
// tools/depthPush.js keeps that sliver behind the cloth. A mesh using the
// material without that buffer reads 0 everywhere, untouched.
const CUT = 0.015

class TuckClipPlugin extends MaterialPluginBase {
    constructor(material){
        super(material, "TuckClip", 210, { TUCKCLIP: false }, true, true)
    }

    getClassName(){
        return "TuckClipPlugin"
    }

    prepareDefines(defines){
        defines.TUCKCLIP = true
    }

    getAttributes(attributes){
        attributes.push(TUCK_DEPTH_KIND)
    }

    getCustomCode(shaderType){
        if(shaderType === "vertex") return {
            CUSTOM_VERTEX_DEFINITIONS: `
                #ifdef TUCKCLIP
                    attribute float ${TUCK_DEPTH_KIND};
                    varying float vTuckDepth;
                #endif
            `,
            CUSTOM_VERTEX_MAIN_END: `
                #ifdef TUCKCLIP
                    vTuckDepth = ${TUCK_DEPTH_KIND};
                #endif
            `,
        }
        return {
            CUSTOM_FRAGMENT_DEFINITIONS: `
                #ifdef TUCKCLIP
                    varying float vTuckDepth;
                #endif
            `,
            CUSTOM_FRAGMENT_MAIN_BEGIN: `
                #ifdef TUCKCLIP
                    if(vTuckDepth > ${CUT.toFixed(3)}) discard;
                #endif
            `,
        }
    }
}

export function clipTucked(material){
    return new TuckClipPlugin(material)
}
