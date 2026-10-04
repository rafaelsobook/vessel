import {
    MeshBuilder,
    Mesh,
    StandardMaterial,
    Material,
    Texture,
    DynamicTexture,
    Color3,
    Matrix,
    Quaternion,
    Vector3,
    PhysicsAggregate,
    PhysicsShapeType,
    LoadAssetContainerAsync,
} from '@babylonjs/core';
import '@babylonjs/loaders';

// What the generator's placeNature lays out across a dungeon - the river, the
// grass and the display vases - drawn for createDungeon. (The ore is a place's
// ordinary resources[], mined through areascene.js like anywhere else; the
// chests come from tcp's treasuresInDungeon.ts.)
//
// Everything here is either instanced or thin-instanced off one hidden source
// mesh per kind: a whole river is one draw call, all the grass two.

// ─── River ────────────────────────────────────────────────────────────────────
// Over the floor tiles' normal unevenness (up to 0.04) so none poke through,
// and under every raised slab's top, which stand out of it like stepping stones
const WATER_Y            = 0.07;
// how many times the ripples repeat across one cell
const RIPPLE_REPEAT      = 2;
// ripple repeats the current carries past per second
const RIVER_FLOW_SPEED   = 0.12;
const RIPPLE_SIZE        = 256;
const RIPPLE_STRENGTH    = 2.5;
// [waves across the tile in u, in v, phase, amplitude] - whole numbers of waves,
// so the pattern wraps seamlessly from one cell into the next
const RIPPLE_WAVES = [
    [1, 3, 0.0, 1.0],
    [2, -1, 1.7, 0.6],
    [-3, 2, 4.1, 0.45],
    [4, 5, 2.3, 0.3],
    [0, 7, 5.0, 0.2],
];

// A tileable normal map of overlapping sine ripples, computed rather than
// loaded - there's no water texture in the game (particles/watercurrent.webp
// is a lightning beam). Each wave's slope is exact, so no filtering is needed.
function createRippleBumpTexture(scene) {
    const S = RIPPLE_SIZE;
    const tex = new DynamicTexture("river_ripples", { width: S, height: S }, scene, true);
    tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
    tex.uScale = tex.vScale = RIPPLE_REPEAT;
    const ctx = tex.getContext();
    const img = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            let dx = 0, dy = 0;
            for (const [ku, kv, phase, amp] of RIPPLE_WAVES) {
                const slope = amp * Math.cos(2 * Math.PI * (ku * x + kv * y) / S + phase) * 2 * Math.PI / S;
                dx += slope * ku;
                dy += slope * kv;
            }
            // same sign convention as pbrmat.js's height-map normals
            let nx = dx * RIPPLE_STRENGTH * S / 8, ny = -dy * RIPPLE_STRENGTH * S / 8;
            const len = Math.hypot(nx, ny, 1);
            const i = (y * S + x) * 4;
            img.data[i]     = (nx / len * 0.5 + 0.5) * 255;
            img.data[i + 1] = (ny / len * 0.5 + 0.5) * 255;
            img.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
            img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    tex.update();
    return tex;
}

// Shallow, dark water you wade through (no collider) with ripples that catch
// the torchlight and drift along each river's flow. Returns the materials made,
// for createDungeon's light cap.
export function buildRivers(scene, rivers, cellSize) {
    if (!rivers?.length) return [];

    const ripples = createRippleBumpTexture(scene);
    const mat = new StandardMaterial("mat_river", scene);
    mat.diffuseColor  = new Color3(0.03, 0.11, 0.12);
    // a faint teal of its own, so it still reads as water away from any torch
    mat.emissiveColor = new Color3(0.02, 0.07, 0.08);
    mat.specularColor = new Color3(0.9, 0.9, 0.8);
    mat.specularPower = 128;
    // the stone bed shows through - it's shallow
    mat.alpha         = 0.7;
    mat.bumpTexture   = ripples;

    // one cell of water - a ground's v runs along +z, so its ripples drift
    // along a river flowing that way; turned a quarter for one along x
    const tpl = MeshBuilder.CreateGround("_tpl_river", { width: cellSize, height: cellSize }, scene);
    tpl.material   = mat;
    tpl.isVisible  = false;
    tpl.isPickable = false;
    rivers.forEach(river => river.cells.forEach((c, i) => {
        const water = tpl.createInstance(`${river.id}_${i}`);
        water.isPickable = false;
        water.position.set((c.x + 0.5) * cellSize, WATER_Y, (c.y + 0.5) * cellSize);
        if (river.axis === "x") water.rotation.y = Math.PI / 2;
        water.freezeWorldMatrix();
    }));

    scene.onBeforeRenderObservable.add(() => {
        ripples.vOffset -= RIVER_FLOW_SPEED * scene.getEngine().getDeltaTime() / 1000;
    });
    return [mat];
}

// ─── Grass ────────────────────────────────────────────────────────────────────
// tufts in a cell of density 1 - a cell gets that many times its density
const GRASS_TUFTS_PER_CELL = 14;
const GRASS_HEIGHT         = { min: 0.45, max: 0.95 };
// how far from the cell's edge a tuft's root stays
const GRASS_CELL_MARGIN    = 0.25;
// the village's grass cards (black background = empty) - half the tufts each
const GRASS_TEXTURES = ["./images/textures/grass/grass_black.jpg", "./images/textures/grass/grass2_black.png"];
// where the black background ends and a blade begins
const GRASS_ALPHA_CUTOFF   = 0.35;
const GRASS_GLOW           = new Color3(0.05, 0.09, 0.03);

// Small seeded rng - every player sees the same tufts in the same spots
function seededRNG(seed) {
    let s = seed >>> 0;
    return () => {
        s += 0x6d2b79f5;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// The grass cards have no alpha channel - just blades on black. The village
// lets them glow (emissive + opacity from brightness), which in a dark dungeon
// would light every tuft like a lamp. Here the brightness becomes a real alpha
// channel instead, so the blades are cut out cleanly and lit by the torches
// like everything else. Empty (fully transparent) until the image arrives.
function createCutoutTexture(path, scene) {
    const tex = new DynamicTexture(`cutout_${path}`, { width: 512, height: 512 }, scene, true);
    tex.hasAlpha = true;
    tex.wrapU = tex.wrapV = Texture.CLAMP_ADDRESSMODE;
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, 512, 512);
    tex.update();

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
        if (scene.isDisposed) return;
        ctx.drawImage(img, 0, 0, 512, 512);
        const px = ctx.getImageData(0, 0, 512, 512);
        const d = px.data;
        for (let i = 0; i < d.length; i += 4) {
            const lum = Math.max(d[i], d[i + 1], d[i + 2]) / 255;
            d[i + 3] = Math.min(255, lum * 3 * 255);
        }
        ctx.putImageData(px, 0, 0);
        tex.update();
    };
    img.onerror = () => console.warn(`[dungeonNature] couldn't load ${path} - no grass`);
    img.src = path;
    return tex;
}

// two crossed cards, rooted at the origin, 1 unit tall
function buildTuftTemplate(name, texturePath, scene) {
    const a = MeshBuilder.CreatePlane(`${name}_a`, { size: 1 }, scene);
    const b = MeshBuilder.CreatePlane(`${name}_b`, { size: 1 }, scene);
    b.rotation.y = Math.PI / 2;
    [a, b].forEach(p => { p.position.y = 0.5; p.bakeCurrentTransformIntoVertices(); });
    const tuft = Mesh.MergeMeshes([a, b], true, true);
    tuft.name = name;
    tuft.isPickable = false;

    const mat = new StandardMaterial(`mat${name}`, scene);
    mat.diffuseTexture   = createCutoutTexture(texturePath, scene);
    // with transparencyMode set, Babylon alpha-tests the material's FINAL alpha
    // (ALPHATEST_AFTERALLALPHACOMPUTATIONS), which ignores the texture's unless
    // this is on - without it every card drew as an opaque black square
    mat.useAlphaFromDiffuseTexture = true;
    mat.transparencyMode = Material.MATERIAL_ALPHATEST;
    mat.alphaCutOff      = GRASS_ALPHA_CUTOFF;
    mat.backFaceCulling  = false;
    mat.twoSidedLighting = true;
    mat.specularColor    = Color3.Black();
    // a faint green glow - enough to make out tufts between torches without
    // them lighting up like the village's fully emissive grass
    mat.emissiveColor    = GRASS_GLOW;
    tuft.material = mat;
    return tuft;
}

// Grass on the generator's grass cells - floorAt(gx, gz) is the floor's height
// there. Returns the materials made, for createDungeon's light cap.
export function buildGrass(scene, grassCells, cellSize, floorAt, seed = 1) {
    if (!grassCells?.length) return [];

    const tufts = GRASS_TEXTURES.map((path, i) => buildTuftTemplate(`_tpl_grass${i}`, path, scene));
    const matrices = tufts.map(() => []);
    const rng = seededRNG(seed + 3);
    const span = cellSize - 2 * GRASS_CELL_MARGIN;
    const scaling = new Vector3(), rotation = new Quaternion(), position = new Vector3();

    grassCells.forEach(cell => {
        const count = Math.round(cell.density * GRASS_TUFTS_PER_CELL);
        const y = floorAt(cell.x, cell.y);
        for (let i = 0; i < count; i++) {
            const height = GRASS_HEIGHT.min + rng() * (GRASS_HEIGHT.max - GRASS_HEIGHT.min);
            scaling.set(height * (0.8 + rng() * 0.4), height, height * (0.8 + rng() * 0.4));
            Quaternion.FromEulerAnglesToRef(0, rng() * Math.PI * 2, 0, rotation);
            position.set(
                cell.x * cellSize + GRASS_CELL_MARGIN + rng() * span,
                y,
                cell.y * cellSize + GRASS_CELL_MARGIN + rng() * span);
            matrices[Math.floor(rng() * tufts.length)].push(Matrix.Compose(scaling, rotation, position));
        }
    });

    tufts.forEach((tuft, i) => {
        if (!matrices[i].length) { tuft.isVisible = false; return; }
        tuft.thinInstanceAdd(matrices[i]);
        tuft.thinInstanceRefreshBoundingInfo();
        tuft.freezeWorldMatrix();
    });
    return tufts.map(t => t.material);
}

// ─── standingvase.glb: display vases and torch stands ─────────────────────────
// One model, two uses - the generator's "vase" props, and the stand every torch
// burns on. Each is its own hidden copy (so its own material) with an instance
// per prop; the model's geometry is loaded once and shared.
const STAND_MODEL = "./models/outdors/standingvase.glb";
// the model itself is 4.3 units tall - more than twice the player
const VASE_HEIGHT = 1.6;
const VASE_COLOR  = Color3.FromHexString("#7a3f24");
// how tall a torch stand stands - createDungeon puts the fire on its top
export const TORCH_STAND_HEIGHT = 1.6;
const TORCH_STAND_TEXTURE = "./images/modeltex/iron2.jpg";

// scene -> Promise<Mesh|null>: the loaded model, upright and hidden
const standModels = new WeakMap();

function loadStandModel(scene) {
    if (standModels.has(scene)) return standModels.get(scene);
    const loading = (async () => {
        let container;
        try {
            container = await LoadAssetContainerAsync(STAND_MODEL, scene);
        } catch (err) {
            console.warn(`[dungeonNature] couldn't load ${STAND_MODEL}`, err);
            return null;
        }
        // the player may have left the dungeon while it loaded
        if (scene.isDisposed) { container.dispose(); return null; }
        container.addAllToScene();

        // off the glTF __root__ (Blender's Z-up fix) and baked, so instances
        // stand upright without the parent chain (see loadmodel.js's loadMeshOnlyParts)
        const parts = container.meshes.filter(m => m.getTotalVertices() > 0);
        parts.forEach(m => { m.setParent(null); m.bakeCurrentTransformIntoVertices(); });
        const model = parts.length > 1 ? Mesh.MergeMeshes(parts, true, true, undefined, false, true) : parts[0];
        container.meshes.filter(m => m !== model && !m.isDisposed()).forEach(m => m.dispose());
        model.name       = "_tpl_stand";
        model.isVisible  = false;
        model.isPickable = false;
        model.refreshBoundingInfo();
        return model;
    })();
    standModels.set(scene, loading);
    return loading;
}

// A hidden copy of the model with its own material, plus what it takes to stand
// an instance of it `height` tall on the floor. null if the model didn't load.
async function standTemplate(scene, name, material, height) {
    const model = await loadStandModel(scene);
    if (!model || scene.isDisposed) return null;
    const tpl = model.clone(name);
    tpl.isVisible  = false;
    tpl.isPickable = false;
    tpl.material   = material;
    const { minimum, maximum } = model.getBoundingInfo().boundingBox;
    const scale = height / (maximum.y - minimum.y);
    // an instance of tpl at (x, floorY, z)
    const place = (inst, x, floorY, z, rotY) => {
        // the template's baked quaternion would override rotation.y
        inst.rotationQuaternion = null;
        inst.position.set(x, floorY - minimum.y * scale, z);
        inst.rotation.y = rotY;
        inst.scaling.setAll(scale);
        inst.isPickable = false;
        inst.freezeWorldMatrix();
        return inst;
    };
    return { tpl, place };
}

// The generator's "vase" props - an instance per vase, each a static obstacle.
// Loaded in the background: the dungeon doesn't wait for its decorations.
// maxLights: createDungeon's light cap.
export async function spawnVases(scene, vases, cellSize, floorAt, maxLights) {
    if (!vases?.length) return;

    // the model has no texture, just a pale grey that glows white in the
    // torchlight - fired clay instead
    const mat = new StandardMaterial("mat_vase", scene);
    mat.diffuseColor  = VASE_COLOR;
    mat.specularColor = Color3.Black();
    mat.maxSimultaneousLights = maxLights;
    const stand = await standTemplate(scene, "_tpl_vase", mat, VASE_HEIGHT);
    if (!stand) return;

    vases.forEach(v => {
        const inst = stand.place(stand.tpl.createInstance(v.id),
            (v.x + 0.5) * cellSize, floorAt(v.x, v.y), (v.y + 0.5) * cellSize, (v.rotation ?? 0) * Math.PI / 180);
        new PhysicsAggregate(inst, PhysicsShapeType.CYLINDER, { mass: 0 }, scene);
    });
}

// What every torch burns on - the same model in iron (iron2.jpg), one instance
// per torch, TORCH_STAND_HEIGHT tall. `torches` are { id, x, y } props, `y` the
// floor height under it. The fire itself is createDungeon's.
export async function spawnTorchStands(scene, torches, maxLights) {
    if (!torches?.length) return;

    const mat = new StandardMaterial("mat_torch_stand", scene);
    mat.diffuseTexture = new Texture(TORCH_STAND_TEXTURE, scene);
    mat.specularColor  = new Color3(0.25, 0.25, 0.25);
    mat.maxSimultaneousLights = maxLights;
    const stand = await standTemplate(scene, "_tpl_torch_stand", mat, TORCH_STAND_HEIGHT);
    if (!stand) return;

    torches.forEach(t => stand.place(stand.tpl.createInstance(`${t.id}_stand`), t.x, t.y, t.z, 0));
}
