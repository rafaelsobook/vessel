import { MeshBuilder, Vector3, PBRMaterial, Color3,  VertexBuffer, VertexData } from "@babylonjs/core";
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

    const rockMat = new PBRMaterial("rockMat", scene);
    rockMat.albedoColor  = new Color3(0.30, 0.27, 0.23);  // dark grey-brown
    // rockMat.spe = new Color3(0.08, 0.08, 0.08);
    rockMat.specularPower = 16;
    rockMat.ambientColor  = new Color3(0.1, 0.09, 0.08);
    rockMat.roughness = 1
    rock.material = rockMat;

    if(worldPos) rock.position = new Vector3(worldPos.x, worldPos.y ? worldPos.y : 0, worldPos.z)

    return rock;
}