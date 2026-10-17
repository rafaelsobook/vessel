import { MaterialPluginBase } from "@babylonjs/core"

// Draws a material's surfaces as if they stood `distance` further from the
// camera than they really do (negative: nearer). Each vertex is slid along
// the camera's own line of sight, so it lands on exactly the same pixel -
// nothing visibly moves - it just tests deeper in the depth buffer. Lighting
// is untouched: the shader has already taken its lighting position by then.
//
// For layers that lie on top of each other - the avatar's clothes and hair
// over its skin. material.zOffset / zOffsetUnits can't do this job: they bias
// by depth-buffer steps, and with this game's camera (minZ 0.01, far 10000) a
// step is a hundredth of a millimetre up close and millimetres zoomed out, so
// any one setting was either too weak far away (skin showing through the
// shirt and pants) or strong enough to hide things up close. This is the
// same real distance at every zoom.
//
// weightKind (optional) names a per-vertex float buffer scaling the push at
// each vertex, 0..1 - tools/tuckUnder.js's, so only the skin along a hem is
// pushed and a hand in front of the chest isn't. A mesh using the material
// without that buffer reads 0 there and isn't pushed at all.
//
// Only the material's own colour pass - shadows and other depth passes use
// their own shaders and see the surface where it really is.
class DepthPushPlugin extends MaterialPluginBase {
    constructor(material, distance, weightKind){
        // priority 200, defines, add to the plugin list, enabled from the start
        super(material, "DepthPush", 200, { DEPTHPUSH: false, DEPTHPUSH_WEIGHTED: false }, true, true)
        this.distance = distance
        this.weightKind = weightKind ?? null
    }

    getClassName(){
        return "DepthPushPlugin"
    }

    prepareDefines(defines){
        defines.DEPTHPUSH = true
        defines.DEPTHPUSH_WEIGHTED = !!this.weightKind
    }

    getAttributes(attributes){
        if(this.weightKind) attributes.push(this.weightKind)
    }

    getUniforms(){
        return {
            ubo: [
                { name: "depthPushEye", size: 3, type: "vec3" },
                { name: "depthPushDistance", size: 1, type: "float" },
            ],
            vertex: `
                #ifdef DEPTHPUSH
                    uniform vec3 depthPushEye;
                    uniform float depthPushDistance;
                #endif
            `,
        }
    }

    bindForSubMesh(uniformBuffer, scene){
        const camera = scene.activeCamera
        if(!camera) return
        uniformBuffer.updateVector3("depthPushEye", camera.globalPosition)
        uniformBuffer.updateFloat("depthPushDistance", this.distance)
    }

    getCustomCode(shaderType){
        if(shaderType !== "vertex") return null
        const weight = this.weightKind ?? "1.0"
        return {
            CUSTOM_VERTEX_DEFINITIONS: this.weightKind ? `
                #ifdef DEPTHPUSH_WEIGHTED
                    attribute float ${this.weightKind};
                #endif
            ` : "",
            CUSTOM_VERTEX_UPDATE_WORLDPOS: `
                #ifdef DEPTHPUSH
                    worldPos.xyz += normalize(worldPos.xyz - depthPushEye) * depthPushDistance * ${weight};
                #endif
            `,
        }
    }
}

// pushes `material` back (positive distance) or pulls it forward (negative),
// in world units - at each vertex scaled by its weightKind buffer, if given
export function pushDepth(material, distance, weightKind){
    return new DepthPushPlugin(material, distance, weightKind)
}
