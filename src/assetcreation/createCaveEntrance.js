import { Color3, Matrix, Mesh, MeshBuilder, StandardMaterial, Texture, Vector3 } from "@babylonjs/core"
import { createSimplex } from "../tools/noise"
import { createAggregate } from "../tools/physics.js"
import { createJaggedRock, scatterRubble } from "./createRock.js"

// A rocky cave mouth built around a free-standing door - so the village's
// dungeon door (localroomdb.js's "dungeondoor") reads as the way into a
// cave instead of a door standing on its own with nothing behind it.
//
// Made the way createRock.js's createOre is, just bigger: jagged rocks
// (createJaggedRock) plus rubble at the foot (scatterRubble), merged into
// one mesh with one material.
//
//  - a hill the cave runs into, sunk into the ground behind the door
//  - a boulder each side of the door and a slab over it, reaching a little
//    in front of the door so it sits recessed in the rock, and back into
//    the hill - a short tunnel
//  - smaller boulders on the hill's crown and at its shoulders
//  - rubble at the foot of the mouth, kept off the path to the door
//
// Laid out in the DOOR's own frame: the door at the origin, its width
// along X, the side you walk up to it from is -Z and the cave goes back
// along +Z. door.glb is 1.37 wide x 2.09 tall (its real bounds).
//
// Collision is boxes, not the mesh - Havok's "mesh" shape doesn't collide
// in this build (createcastle.js). Each box is put at its world pose
// BEFORE its aggregate is made: a mass:0 body bakes its pose once and
// never follows the mesh afterwards.

const DOOR_HALF_WIDTH = 0.69
const DOOR_HEIGHT     = 2.09

const ROCK_TEXTURE    = "./images/modeltex/rock2.jpg"
// rock2 is a light, sandy stone - darkened toward the dungeon's own stone
const ROCK_TINT       = new Color3(0.55, 0.52, 0.48)

const NOISE_SEED      = 523

// { name, radius, pos, scale, subdivisions? } - pos/scale in the door frame
const ROCKS = [
    // the hill: top ~3.9 up, front just behind the door at the ground, back
    // ~7 behind it. Sunk 1.2 so it rises out of the ground rather than
    // sitting on it like a ball
    { name: "hill",       radius: 3.2,  pos: [0, -1.2, 4.0],  scale: [1.15, 1.5, 1],  subdivisions: 5 },
    // the jambs - their inner faces just cover the door's edges
    { name: "jambL",      radius: 0.7,  pos: [-(DOOR_HALF_WIDTH + 0.49), 0.7, 0.3], scale: [0.9, 2, 1.8] },
    { name: "jambR",      radius: 0.7,  pos: [  DOOR_HALF_WIDTH + 0.49,  0.7, 0.3], scale: [0.9, 2, 1.8] },
    // the slab over the door - its underside just covers the door's top
    { name: "lintel",     radius: 0.75, pos: [0, DOOR_HEIGHT + 0.36, 0.55], scale: [2.3, 0.75, 1.9] },
    // shoulders, widening the cave's face either side of the mouth
    { name: "shoulderL",  radius: 0.85, pos: [-2.45, 0.35, 0.9],  scale: [1.1, 1, 1.1] },
    { name: "shoulderR",  radius: 0.75, pos: [ 2.4,  0.25, 1.1],  scale: [1.2, 0.95, 1.1] },
    // the crown - half sunk into the hill's surface (heights checked
    // against the hill's own shape before its noise)
    { name: "crown0",     radius: 0.9,  pos: [-1.9, 2.35, 2.4],   scale: [1, 1.2, 1] },
    { name: "crown1",     radius: 1,    pos: [ 1.6, 3.15, 3.3],   scale: [1, 1.2, 1] },
    { name: "crown2",     radius: 0.8,  pos: [ 0.2, 3.75, 4.3],   scale: [1, 1.2, 1] },
    // fill the dips the hill's noise leaves right behind the lintel and on
    // its right shoulder
    { name: "crown3",     radius: 0.85, pos: [ 0.4, 2.95, 2.2],   scale: [1.2, 1, 1] },
    { name: "crown4",     radius: 0.8,  pos: [ 1.7, 2.3, 2.2],    scale: [1, 1.15, 1] },
]

// { center, size } in the door frame. Together they close off the whole
// cave; the doorway between the jambs is the door's own box (areascene.js
// gives every optionalObjects mesh one), and its roomPaths trigger sits
// 1.2 out in front, clear of all of these.
const COLLIDERS = [
    // as wide/deep as the hill is where it meets the ground (it's widest there)
    { name: "hill",      center: [0, 1.6, 4.2],                          size: [7, 3.2, 5.8] },
    { name: "jambL",     center: [-(DOOR_HALF_WIDTH + 0.53), 1.05, 0.3], size: [1.2, 2.1, 2.2] },
    { name: "jambR",     center: [  DOOR_HALF_WIDTH + 0.53,  1.05, 0.3], size: [1.2, 2.1, 2.2] },
    { name: "shoulderL", center: [-2.45, 0.6, 0.9],                      size: [1.8, 1.2, 1.8] },
    { name: "shoulderR", center: [ 2.4,  0.55, 1.1],                     size: [1.7, 1.1, 1.6] },
]

// position: the door's {x, y, z}; rotationY: the door's own rotation.y
export function createCaveEntrance(scene, position, rotationY = 0){
    const noise = createSimplex(NOISE_SEED)

    const rocks = ROCKS.map((rock, i) => {
        const mesh = createJaggedRock(scene, `cave_${rock.name}`, rock.radius, noise, i, rock.subdivisions)
        mesh.position = Vector3.FromArray(rock.pos)
        mesh.scaling = Vector3.FromArray(rock.scale)
        return mesh
    })

    // rubble either side of the walk up to the door - two arcs, leaving out
    // the band around straight out in front (-PI/2), so nothing lies in the
    // doorway
    // small - any bigger and these round chunks read as balls, not gravel
    const rubbleOpts = { count: 11, minDist: 1.5, maxDist: 3, minRadius: 0.06, maxRadius: 0.17, angleSpan: Math.PI * 0.3 }
    const rubble = [
        ...scatterRubble(scene, "cave_rubbleL", { ...rubbleOpts, angleStart: -Math.PI }),
        ...scatterRubble(scene, "cave_rubbleR", { ...rubbleOpts, angleStart: -Math.PI * 0.3 }),
    ]
    // and around the back of the hill
    scatterRubble(scene, "cave_rubbleBack", { count: 18, minDist: 3.6, maxDist: 4.4, minRadius: 0.08, maxRadius: 0.22, angleStart: 0, angleSpan: Math.PI })
        .forEach(chunk => {
            chunk.position.z += 4
            rubble.push(chunk)
        })

    const cave = Mesh.MergeMeshes([...rocks, ...rubble], true, true)
    cave.name = "dungeonCave"
    cave.material = getCaveMaterial(scene)
    cave.position = new Vector3(position.x, position.y, position.z)
    cave.rotation.y = rotationY
    cave.refreshBoundingInfo()

    const toWorld = Matrix.RotationY(rotationY)
    COLLIDERS.forEach(col => {
        const [width, height, depth] = col.size
        const box = MeshBuilder.CreateBox(`dungeonCave_${col.name}_collider`, { width, height, depth }, scene)
        box.position = Vector3.TransformCoordinates(Vector3.FromArray(col.center), toWorld)
            .addInPlaceFromFloats(position.x, position.y, position.z)
        box.rotation.y = rotationY
        box.isVisible = false
        box.isPickable = false
        createAggregate(box, { mass: 0 }, "box", scene)
    })

    return cave
}

function getCaveMaterial(scene){
    const mat = new StandardMaterial("caveRockMat", scene)
    const tex = new Texture(ROCK_TEXTURE, scene)
    // the hill's UVs wrap all the way round a ~20 unit circumference
    tex.uScale = 4
    tex.vScale = 2
    mat.diffuseTexture = tex
    mat.diffuseColor = ROCK_TINT
    // rough rock - no shine
    mat.specularColor = Color3.Black()
    return mat
}
