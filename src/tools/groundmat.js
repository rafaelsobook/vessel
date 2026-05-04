import { Texture, Color3, StandardMaterial } from "@babylonjs/core"
import { CustomMaterial } from "@babylonjs/materials";

export function createGroundMat(scene) {
    const mat = new CustomMaterial("groundMat", scene);

    // vDiffuseUV = UV0 * 80 — tex1 scale baked into diffuseMatrix
    const tex1 = new Texture("./images/modeltex/grassyTex.jpg", scene);
    tex1.uScale = 30;
    tex1.vScale = 30;
    mat.diffuseTexture = tex1;

    const tex2 = new Texture("./images/modeltex/rock1.jpg", scene);
    const tex3 = new Texture("./images/modeltex/tile3.jpg", scene);


    const tex4 = new Texture("./images/modeltex/tile7.jpg", scene);

    mat.AddUniform("tex2", "sampler2D", null);
    mat.AddUniform("tex3", "sampler2D", null);
    mat.AddUniform("tex4", "sampler2D", null);

    mat.onBindObservable.add(() => {
        const effect = mat.getEffect();
        if (!effect) return;
        effect.setTexture("tex2", tex2);
        effect.setTexture("tex3", tex3);
        effect.setTexture("tex4", tex4);
    });

    mat.Fragment_Definitions(`
        vec2 _hashTile(vec2 p) {
            p = fract(p * vec2(0.1031, 0.1030));
            p += dot(p, p.yx + 19.19);
            return fract((p.xx + p.yx) * p.xy) - 0.5;
        }
        vec4 sampleNoTile(sampler2D samp, vec2 uv) {
            vec2 i = floor(uv);
            vec2 f = fract(uv);
            vec2 w = f * f * (3.0 - 2.0 * f);
            vec4 va = texture(samp, uv + _hashTile(i + vec2(0.0, 0.0)));
            vec4 vb = texture(samp, uv + _hashTile(i + vec2(1.0, 0.0)));
            vec4 vc = texture(samp, uv + _hashTile(i + vec2(0.0, 1.0)));
            vec4 vd = texture(samp, uv + _hashTile(i + vec2(1.0, 1.0)));
            return mix(mix(va, vb, w.x), mix(vc, vd, w.x), w.y);
        }
        float _h(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float _n(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(_h(i),           _h(i + vec2(1.0, 0.0)), u.x),
                       mix(_h(i + vec2(0.0, 1.0)), _h(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        // Rotation matrix ~37° keeps FBM isotropic across octaves
        float fbm(vec2 p) {
            float v = 0.0, a = 0.5;
            mat2 rot = mat2(1.6, 1.2, -1.2, 1.6);
            for (int i = 0; i < 5; i++) {
                v += a * _n(p);
                p = rot * p + vec2(3.1, 7.4);
                a *= 0.5;
            }
            return v;
        }
    `);

    mat.Fragment_Custom_Diffuse(`
        vec2  groundUV  = vDiffuseUV / 30.0;
        float mask1     = fbm(groundUV * 14.0);
        float mask2     = fbm(groundUV * 11.0 + vec2(5.3, 2.7));
        float edgeJit   = (_n(groundUV * 50.0) - 0.5) * 0.10;
        float blendF1   = smoothstep(0.52, 0.76, mask1 + edgeJit);
        float blendF2   = smoothstep(0.55, 0.79, mask2 + edgeJit);
        vec4  color1    = sampleNoTile(diffuseSampler, vDiffuseUV);
        vec4  color2    = sampleNoTile(tex2, vDiffuseUV * 0.5);
        vec4  color3    = sampleNoTile(tex3, vDiffuseUV * 0.6);
        vec4  base      = mix(color1, color2, blendF1);
        base            = mix(base, color3, blendF2);

        // Path mask: cross at x=0 (NS) and z=0 (EW), each 4 units wide
        float halfW   = 2.0;
        float edge    = 0.3;
        float ewMask  = 1.0 - smoothstep(halfW - edge, halfW, abs(vPositionW.z));
        float nsMask  = 1.0 - smoothstep(halfW - edge, halfW, abs(vPositionW.x));
        float pathF   = max(ewMask, nsMask);

        // tex4 tiled at 4 world-units per repeat, aligned to world grid
        vec4  colorPath = texture(tex4, vPositionW.xz / 4.0);

        // 10-20% random bleed of ground textures for a worn, realistic path
        float bleed1 = smoothstep(0.84, 0.92, _n(vPositionW.xz * 0.7));
        float bleed2 = smoothstep(0.85, 0.93, _n(vPositionW.xz * 0.7 + vec2(4.7, 8.3)));
        float bleed3 = smoothstep(0.87, 0.94, _n(vPositionW.xz * 0.7 + vec2(2.1, 6.4)));
        colorPath = mix(colorPath, color1, bleed1);
        colorPath = mix(colorPath, color2, bleed2);
        colorPath = mix(colorPath, color3, bleed3);

        diffuseColor = mix(base, colorPath, pathF).rgb;
    `);

    mat.specularColor = Color3.Black();
    return mat;
}

export function createPathMat(scene) {
    const mat = new StandardMaterial("pathMat", scene);
    const tex = new Texture("./images/modeltex/tile1.jpg", scene);
    mat.diffuseTexture = tex;
    mat.specularColor  = Color3.Black();
    return mat;
}
