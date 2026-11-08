import { Mesh, MeshBuilder, Vector3, StandardMaterial, Color3, Texture, VertexBuffer, VertexData } from "@babylonjs/core";
import { createSimplex } from "../tools/noise";
export function createRock(scene, worldPos){
    const rockNoise = createSimplex(137);

    const rock = MeshBuilder.CreateIcoSphere("rock", {
        radius: 1.2,
        subdivisions: 6,
        updatable: true,
        flat: false      // smooth normals — needed for clean displacement
    }, scene);

    // Position rock sitting on the terrain surface
    rock.position = new Vector3(0, 1.0, 0);

    const rockPositions = rock.getVerticesData(VertexBuffer.PositionKind);
    const rockNormals   = rock.getVerticesData(VertexBuffer.NormalKind);

    for (let i = 0; i < rockPositions.length; i += 3) {
        const x = rockPositions[i];
        const y = rockPositions[i + 1];
        const z = rockPositions[i + 2];

        // 3 octaves: large shape, medium faces, fine grain
        const n =
            rockNoise(x * 1.2,        z * 1.2)        * 0.35 +
            rockNoise(x * 3.0,        z * 3.0 + y)    * 0.14 +
            rockNoise(x * 7.0,        z * 7.0 + y)    * 0.05;

        // Squash Y slightly so it looks like a grounded boulder not a perfect ball
        rockPositions[i + 1] *= 0.72;

        // Displace outward along the vertex normal
        rockPositions[i]     += rockNormals[i]     * n;
        rockPositions[i + 1] += rockNormals[i + 1] * n;
        rockPositions[i + 2] += rockNormals[i + 2] * n;
    }

    VertexData.ComputeNormals(rockPositions, rock.getIndices(), rockNormals);
    rock.updateVerticesData(VertexBuffer.PositionKind, rockPositions);
    rock.updateVerticesData(VertexBuffer.NormalKind, rockNormals);
    rock.refreshBoundingInfo();

    const rockMat = new StandardMaterial("rockMat", scene);
    rockMat.diffuseColor  = new Color3(0.30, 0.27, 0.23);  // dark grey-brown
    rockMat.specularColor = Color3.Black();                // rough rock - no shine
    rockMat.ambientColor  = new Color3(0.1, 0.09, 0.08);
    rock.material = rockMat;

    if(worldPos) rock.position = new Vector3(worldPos.x, worldPos.y ? worldPos.y : 0, worldPos.z)

    return rock;
}

// a mineable ore deposit - a cluster of jagged, faceted peaks (unlike
// createRock's single smooth boulder) with a scatter of small rubble chunks
// around the base, all merged into one mesh so it drops into the scene like
// any other single mesh (see areascene.js's "resources" handling)
// amplitude is scaled to the mesh's own radius (not a fixed constant) so
// displacement stays proportional - a fixed amplitude tuned for createRock's
// radius-1.2 boulder becomes wildly oversized on a radius-0.4 peak and shoves
// individual vertices out into thin blade-like spikes instead of gentle bumps
// Exported - also reused by skillEffects.js's "darkorb" projectile style for
// the jagged white core inside the sphere (same technique, tiny radius).
export function displaceWithNoise(mesh, noiseFn, seedOffset, radius){
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    const normals = mesh.getVerticesData(VertexBuffer.NormalKind);

    for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        const z = positions[i + 2];

        let n =
            noiseFn(x * 1.5 + seedOffset, z * 1.5 + seedOffset) * radius * 0.18 +
            noiseFn(x * 4.0 + seedOffset, z * 4.0 + y)          * radius * 0.05;

        // clamp so a rare spot where both octaves stack constructively can't
        // shove one vertex out past its neighbors into a thin spike/crack
        const maxDisplace = radius * 0.22;
        n = Math.max(-maxDisplace, Math.min(maxDisplace, n));

        positions[i]     += normals[i]     * n;
        positions[i + 1] += normals[i + 1] * n;
        positions[i + 2] += normals[i + 2] * n;
    }

    VertexData.ComputeNormals(positions, mesh.getIndices(), normals);
    mesh.updateVerticesData(VertexBuffer.PositionKind, positions);
    mesh.updateVerticesData(VertexBuffer.NormalKind, normals);
}

// One faceted rock: an icosphere pushed about by displaceWithNoise, then
// flat-shaded. The caller positions/scales it. createOre's peaks are these,
// and so is every boulder of createCaveEntrance.js's cave.
export function createJaggedRock(scene, name, radius, noiseFn, seedOffset, subdivisions = 4){
    const rock = MeshBuilder.CreateIcoSphere(name, {
        radius,
        subdivisions,
        updatable: true,
        flat: false // smooth during displacement - flat gives shared corners diverging normals, which cracks the seam when displaced (see createRock's own note above). Facet it after instead.
    }, scene);
    displaceWithNoise(rock, noiseFn, seedOffset, radius);
    rock.convertToFlatShadedMesh(); // facet it now that displacement is done and the geometry is final
    return rock;
}

// Small flat-shaded chunks strewn on the ground in a ring around (0, 0) -
// the gravel at the foot of an ore, and of the cave. angleStart/angleSpan
// narrow the ring to an arc (angle 0 is +X, PI/2 is +Z).
export function scatterRubble(scene, prefix, { count, minDist, maxDist, minRadius, maxRadius, angleStart = 0, angleSpan = Math.PI * 2 }){
    const rubble = [];
    for(let r = 0; r < count; r++){
        const radius = minRadius + Math.random() * (maxRadius - minRadius);
        const chunk = MeshBuilder.CreateIcoSphere(`${prefix}${r}`, {
            radius,
            subdivisions: 2,
            flat: true
        }, scene);

        const angle = angleStart + Math.random() * angleSpan;
        const dist = minDist + Math.random() * (maxDist - minDist);
        chunk.position = new Vector3(Math.cos(angle) * dist, radius * 0.5, Math.sin(angle) * dist);
        chunk.scaling = new Vector3(1, 0.7, 1);
        rubble.push(chunk);
    }
    return rubble;
}

// an ore's look by colour (images/modeltex/recources/ore<color>.jpg - dark,
// blue, red, gold, white, gloom, green, purple; tcp's ores.ts picks it from
// what the vein holds), bumped with orebumptex. One material per colour per
// scene, shared by every ore of it.
const oreMaterials = new WeakMap()
function oreMaterial(scene, color){
    let byColor = oreMaterials.get(scene)
    if(!byColor) oreMaterials.set(scene, byColor = new Map())
    let mat = byColor.get(color)
    if(mat) return mat
    mat = new StandardMaterial(`oreMat_${color}`, scene)
    mat.diffuseTexture = new Texture(`./images/modeltex/recources/ore${color}.jpg`, scene)
    mat.bumpTexture = new Texture("./images/modeltex/recources/orebumptex.webp", scene)
    // nearly matte - the faintest glint off the ore's facets
    mat.specularColor = new Color3(0.03, 0.03, 0.03)
    mat.specularPower = 12
    mat.ambientColor = new Color3(0.08, 0.08, 0.08)
    byColor.set(color, mat)
    return mat
}

export function createOre(scene, worldPos, color = "dark"){
    const oreNoise = createSimplex(311);

    // central jagged formation - a few overlapping peaks of varying height.
    // Kept low and wide (small radius, mild vertical stretch, tight spread)
    // so it reads as a knee-high mound, not a spiky monument.
    const peakCount = 5;
    const peaks = [];
    for(let p = 0; p < peakCount; p++){
        const radius = 0.3 + Math.random() * 0.2;
        const peak = createJaggedRock(scene, `orepeak${p}`, radius, oreNoise, p);

        const angle = (p / peakCount) * Math.PI * 2 + Math.random() * 0.4;
        const dist = p === 0 ? 0 : 0.15 + Math.random() * 0.25;
        peak.position = new Vector3(Math.cos(angle) * dist, radius * 0.4, Math.sin(angle) * dist);
        peak.scaling = new Vector3(1, 1.05 + Math.random() * 0.25, 1); // just a little taller than wide, not a spike
        peaks.push(peak);
    }

    // scattered rubble/gravel around the base of the formation
    const rubble = scatterRubble(scene, "orerubble", { count: 14, minDist: 0.45, maxDist: 0.85, minRadius: 0.08, maxRadius: 0.2 });

    const ore = Mesh.MergeMeshes([...peaks, ...rubble], true, true, undefined, false, true);
    ore.name = "ore";
    ore.refreshBoundingInfo();

    ore.material = oreMaterial(scene, color);

    if(worldPos) ore.position = new Vector3(worldPos.x, worldPos.y ? worldPos.y : 0, worldPos.z)

    return ore;
}