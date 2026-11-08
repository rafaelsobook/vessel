import { MaterialPluginBase } from "@babylonjs/core"

// Sways a material's cards in a light breeze - the grass and flowers round
// the character setup clearing (scenes/setupbackdrop.js). Each vertex bends
// along the wind by its height above the mesh's own origin, squared, so the
// base stays planted and the tips do the moving. Every tuft (thin instance
// or not) takes its own tempo and phase from where it stands, so no two move
// alike, and slow gusts roll across the field on top of that - leaning a
// whole patch together for a moment, then letting it go.
//
// The mesh's origin has to be at its base (the grass cards bake their planes
// up by half their height for this). Only the colour pass bends - a shadow or
// depth pass sees the card standing straight, so keep these off shadow casters.

// blowing mostly along Z - across RIDER_CAMERA's view, where a sway reads best
const WIND_DIR = [0.34, 0.94]
const START = performance.now()

class WindSwayPlugin extends MaterialPluginBase {
    constructor(material, strength){
        super(material, "WindSway", 200, { WINDSWAY: false }, true, true)
        this.strength = strength
    }

    getClassName(){
        return "WindSwayPlugin"
    }

    prepareDefines(defines){
        defines.WINDSWAY = true
    }

    getUniforms(){
        return {
            ubo: [
                { name: "windTime", size: 1, type: "float" },
                { name: "windStrength", size: 1, type: "float" },
            ],
            vertex: `
                #ifdef WINDSWAY
                    uniform float windTime;
                    uniform float windStrength;
                #endif
            `,
        }
    }

    bindForSubMesh(uniformBuffer){
        uniformBuffer.updateFloat("windTime", (performance.now() - START) / 1000)
        uniformBuffer.updateFloat("windStrength", this.strength)
    }

    getCustomCode(shaderType){
        if(shaderType !== "vertex") return null
        const [dx, dz] = WIND_DIR.map(v => v.toFixed(3))
        return {
            CUSTOM_VERTEX_UPDATE_WORLDPOS: `
                #ifdef WINDSWAY
                {
                    vec2 windDir = vec2(${dx}, ${dz});
                    // the tuft's own spot - its base, and a 0..1 all its own
                    vec3 root = finalWorld[3].xyz;
                    float h = max(worldPos.y - root.y, 0.0);
                    float r = fract(sin(dot(root.xz, vec2(12.9898, 78.233))) * 43758.5453);
                    // gusts: a long slow wave rolling downwind across the clearing
                    float gust = sin(windTime * 0.45 - dot(root.xz, windDir) * 0.5) * 0.5 + 0.5;
                    // its own unhurried sway, livelier while a gust is on it,
                    // and a little side-to-side flutter
                    float sway = sin(windTime * (0.9 + r * 0.4) + r * 6.2832) * 0.65
                               + sin(windTime * (1.6 + r * 0.5) + r * 17.0) * 0.35;
                    float flutter = sin(windTime * (1.2 + r * 0.6) + r * 29.0);
                    vec2 bend = windDir * (gust * 0.7 + sway * (0.45 + 0.55 * gust))
                              + vec2(-windDir.y, windDir.x) * flutter * 0.25;
                    vec2 tip = bend * h * h * windStrength;
                    worldPos.xz += tip;
                    // dipping as it leans, so it bends rather than stretches
                    worldPos.y -= dot(tip, tip) / max(2.0 * h, 0.05);
                }
                #endif
            `,
        }
    }
}

// strength: about how far, in metres, the tip of a 1m tall tuft sways -
// shorter ones less (by their height squared)
export function swayInWind(material, strength){
    return new WindSwayPlugin(material, strength)
}
