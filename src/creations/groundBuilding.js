import { MeshBuilder, StandardMaterial, Texture, Color3, Vector4 } from "@babylonjs/core"
import { openworldSurfaceY } from "../tools/groundHeight.js"
import { createAggregate } from "../tools/physics.js"

// A building standing on the openworld's uneven terrain (a localroomdb.js
// optionalObjects entry with `groundSnap`) gets its height from the ground it
// actually stands on, measured as it's placed - never from a number in the
// place data. The witch towers used to carry a hand-typed y: 7.5, which left
// Ilvara's tower floating ~8 units up with its door out of reach.
//
// groundSnap: { footprint, anchor }
//   footprint - the building's radius at its base
//   anchor    - offset (x, z) from its position of the spot that must sit
//               exactly on the ground: its door, so you can walk in
// Its base goes on the ground at the anchor. Wherever the ground under its
// footprint falls away lower than that, a stone foundation fills in down
// into the ground, so no side is left hanging in the air. The uphill side
// just goes into the hill.
//
// Call before the model's own physics is made - a static body keeps the pose
// it was made at.

const SINK = 0.6         // how far the foundation goes into the ground at its lowest point
const OVERHANG = 0.15    // the foundation stands this much wider than the building - reads as a plinth
const SPOKES = 24        // footprint measured at this many angles...
const RINGS = [0.5, 1]   // ...on these fractions of its radius, plus its centre
const TILE = 3           // the stone texture repeats every this many units

let matCache = null
function foundationMat(scene){
    if(matCache?.scene === scene) return matCache.mat
    // the castles' own foundation stone (createcastle.js's castleFoundation)
    const mat = new StandardMaterial("groundBuilding_foundation", scene)
    mat.diffuseTexture = new Texture("./images/modeltex/rock2.jpg", scene)
    mat.diffuseColor = new Color3(0.7, 0.68, 0.64)
    mat.specularColor = new Color3(0, 0, 0)
    matCache = { scene, mat }
    return mat
}

// the lowest ground anywhere under a circle of `radius` around (x, z)
function lowestGround(x, z, radius){
    let lowest = openworldSurfaceY(x, z)
    RINGS.forEach(ring => {
        for(let k = 0; k < SPOKES; k++){
            const a = k / SPOKES * Math.PI * 2
            lowest = Math.min(lowest, openworldSurfaceY(x + Math.cos(a) * radius * ring, z + Math.sin(a) * radius * ring))
        }
    })
    return lowest
}

// returns { baseY, foundation } - foundation null when the ground was already
// level enough not to need one
export function settleOnGround(scene, model, { footprint, anchor = { x: 0, z: 0 } }){
    const { x, z } = model.position
    const baseY = openworldSurfaceY(x + anchor.x, z + anchor.z)
    model.position.y = baseY

    const gap = baseY - lowestGround(x, z, footprint)
    if(gap < 0.05) return { baseY, foundation: null }

    const height = gap + SINK
    const radius = footprint + OVERHANG
    const tube = new Vector4(0, 0, (2 * Math.PI * radius) / TILE, height / TILE)
    const foundation = MeshBuilder.CreateCylinder(`${model.name}_foundation`, {
        height,
        diameter: radius * 2,
        tessellation: SPOKES,
        // bottom cap, side, top cap - the side tiles the stone instead of
        // stretching one copy all the way round
        faceUV: [new Vector4(0, 0, 1, 1), tube, new Vector4(0, 0, 1, 1)],
    }, scene)
    foundation.position.set(x, baseY - height / 2, z)
    foundation.material = foundationMat(scene)
    createAggregate(foundation, { mass: 0 }, "cylinder", scene)
    foundation.freezeWorldMatrix()
    return { baseY, foundation }
}
