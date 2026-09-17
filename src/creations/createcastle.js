import { MeshBuilder, Mesh, Vector3, StandardMaterial, Color3 } from "@babylonjs/core"
import { createMat } from "../tools/materials.js"
import { createAggregate } from "../tools/physics.js"
import { sampleTerrainSurfaceHeight } from "infterrain"
import { OPENWORLD_TERRAIN_VERTS } from "../constants/constants.js"

// A procedural medieval castle, entirely MeshBuilder primitives - no glb
// asset for this one. Every piece is built at LOCAL origin (castle center =
// (0,0,0), ground = y:0) and left unparented/untranslated until AFTER the
// final merge, so Mesh.MergeMeshes bakes clean, origin-relative vertex data;
// the whole thing is then moved into place with one single .position
// assignment at the very end, same "build flat at origin, place once"
// approach createRock.js's own peaks/rubble merge already uses.
//
// Two materials (stone walls/towers/keep, dark tile roofs), preserved
// through the merge via multiMultiMaterials:true (Mesh.MergeMeshes' own 6th
// param) instead of collapsing everything to one flat material - Babylon
// sorts the source meshes by their own .material and bakes the result into
// a single MultiMaterial + per-submesh index assignment, so this is still
// genuinely ONE mesh afterward, just one that isn't monochrome.
//
// Physics is intentionally separate from the merged visual mesh - four
// plain invisible box colliders matching the outer wall line (same "solid
// perimeter, gate stays open" idea the visual walls already have), not a
// single "mesh" shape aggregate on the merged castle itself. Confirmed
// elsewhere in this project (areascene.js's own openworld terrain setup
// comment) that Havok's "mesh" shape doesn't actually collide in this
// build - "box" is the one that reliably does, hence four separate boxes
// instead of one shape hugging the real silhouette.

const HALF = 20                 // half the castle's outer footprint (40x40)
const WALL_HEIGHT = 8
const WALL_THICKNESS = 1.5
const GATE_WIDTH = 12           // gap in the south wall, centered (was 6)
const CORNER_TOWER_RADIUS = 3
const CORNER_TOWER_HEIGHT = 12
const CORNER_ROOF_HEIGHT = 5
const GATE_TOWER_RADIUS = 2.5
const GATE_TOWER_HEIGHT = 10
const GATE_ROOF_HEIGHT = 4.5
const KEEP_SIZE = 12
const KEEP_HEIGHT = 16
const KEEP_ROOF_HEIGHT = 8
const MERLON_SIZE = 0.8         // crenellation block width/depth
const MERLON_HEIGHT = 1
const MERLON_GAP = 0.8          // gap between merlons along the wall top
const FLOOR_THICKNESS = 0.2

let stoneMat = null
let roofMat = null
let floorMat = null
let matScene = null
function getMaterials(scene){
    // compared BEFORE overwriting matScene, same order createweapon.js's own
    // partMatCacheScene check already uses - matScene doubles as "which
    // scene should the mesh-building helpers below create their meshes in"
    // (createCastle relies on this being set before addWall/addTower/addKeep
    // run), so it has to end up holding the CURRENT scene regardless, but
    // the cache-invalidation comparison only means anything if it still
    // reads the PREVIOUS value at the moment of the check
    if(matScene !== scene){
        stoneMat = null
        roofMat = null
        floorMat = null
    }
    matScene = scene
    if(!stoneMat){
        // same rockTex.jpg every room's own stone wall already uses
        // (createroom.js) - one consistent "castle stone" look across the game
        stoneMat = createMat("castleStoneMat", false, "./images/modeltex/rockTex.jpg", scene, { uScale: 4, vScale: 2 })
    }
    if(!roofMat){
        roofMat = new StandardMaterial("castleRoofMat", scene)
        roofMat.diffuseColor = new Color3(0.35, 0.08, 0.08) // dark tile-red
        roofMat.specularColor = new Color3(0.05, 0.05, 0.05)
    }
    if(!floorMat){
        // deliberately NOT rockTex.jpg (same texture the walls already use) -
        // a distinct paved look for the courtyard ground (createRoom's own
        // floor uses planks.jpg instead, which reads as an INDOOR wood
        // floor - a castle courtyard is outdoor stone/pavement, not
        // planking). tile7.jpg over tile1.jpg - a different paving pattern,
        // not just a different scale of the same one.
        floorMat = createMat("castleFloorMat", false, "./images/modeltex/tile7.jpg", scene, { uScale: 6, vScale: 6 })
    }
    return { stoneMat, roofMat, floorMat }
}

// one straight wall run centered at (centerX, centerZ), spanning `length`
// along the given axis ("x" or "z") - a single box, not a per-brick
// instanced chain the way createroom.js's own procedural rooms do (this is
// a one-off static structure, not a reusable room shape, so the extra
// instancing machinery isn't worth it here)
function addWall(meshes, stoneMat, centerX, centerZ, length, axis){
    const wall = axis === "x"
        ? MeshBuilder.CreateBox("castle_wall", { width: length, height: WALL_HEIGHT, depth: WALL_THICKNESS }, matScene)
        : MeshBuilder.CreateBox("castle_wall", { width: WALL_THICKNESS, height: WALL_HEIGHT, depth: length }, matScene)
    wall.position.set(centerX, WALL_HEIGHT / 2, centerZ)
    wall.material = stoneMat
    meshes.push(wall)
    addCrenellations(meshes, stoneMat, centerX, centerZ, length, axis)
}

// small merlon blocks marching along the top of a wall run, alternating
// merlon/gap for the classic castle silhouette - purely decorative, no
// physics of their own (the wall box underneath already blocks movement
// there)
function addCrenellations(meshes, stoneMat, centerX, centerZ, length, axis){
    const step = MERLON_SIZE + MERLON_GAP
    const count = Math.floor(length / step)
    const start = -((count - 1) * step) / 2
    const topY = WALL_HEIGHT + MERLON_HEIGHT / 2

    for(let i = 0; i < count; i++){
        const offset = start + i * step
        const merlon = MeshBuilder.CreateBox("castle_merlon", { width: MERLON_SIZE, height: MERLON_HEIGHT, depth: MERLON_SIZE }, matScene)
        if(axis === "x") merlon.position.set(centerX + offset, topY, centerZ)
        else merlon.position.set(centerX, topY, centerZ + offset)
        merlon.material = stoneMat
        meshes.push(merlon)
    }
}

// a round tower - cylinder body + cone roof, sharing the same (x,z) so the
// roof sits centered directly on top of the body
function addTower(meshes, stoneMat, roofMat, x, z, radius, height, roofHeight){
    const body = MeshBuilder.CreateCylinder("castle_tower", { diameter: radius * 2, height, tessellation: 16 }, matScene)
    body.position.set(x, height / 2, z)
    body.material = stoneMat
    meshes.push(body)

    // diameterTop:0 - a real cone, same "cone" shape convention
    // skillEffects.js's own buildProjectileShapeMesh already uses for a
    // sharp point, just full-size here instead of a tiny skill effect
    const roof = MeshBuilder.CreateCylinder("castle_towerroof", { diameterTop: 0, diameterBottom: radius * 2.3, height: roofHeight, tessellation: 16 }, matScene)
    roof.position.set(x, height + roofHeight / 2, z)
    roof.material = roofMat
    meshes.push(roof)
}

// the central keep - a tall box with a pyramid roof (tessellation:4 turns
// the same cone primitive into a 4-sided pyramid instead of a smooth cone -
// no separate "pyramid" shape exists in MeshBuilder, this is the standard
// way to get one)
function addKeep(meshes, stoneMat, roofMat, x, z){
    const body = MeshBuilder.CreateBox("castle_keep", { width: KEEP_SIZE, height: KEEP_HEIGHT, depth: KEEP_SIZE }, matScene)
    body.position.set(x, KEEP_HEIGHT / 2, z)
    body.material = stoneMat
    meshes.push(body)

    const roof = MeshBuilder.CreateCylinder("castle_keeproof", { diameterTop: 0, diameterBottom: KEEP_SIZE * 1.35, height: KEEP_ROOF_HEIGHT, tessellation: 4 }, matScene)
    // tessellation:4's own flat faces land corner-first by default (a
    // diamond footprint, not aligned to the keep's own square) - 45°
    // rotation squares it back up with the box body underneath
    roof.rotation.y = Math.PI / 4
    roof.position.set(x, KEEP_HEIGHT + KEEP_ROOF_HEIGHT / 2, z)
    roof.material = roofMat
    meshes.push(roof)
}

// courtyard floor - a flat slab filling the interior, sized to sit just
// inside the outer wall line (HALF*2 - WALL_THICKNESS, not the full HALF*2
// footprint) so it doesn't poke out past the walls on any side. Top face at
// y:FLOOR_LIFT (a hair above y:0, the height every wall/tower/keep's own
// base already sits at) instead of exactly flush - two coplanar surfaces at
// the identical height is exactly what z-fighting is (the renderer can't
// consistently decide which one is "on top" from one frame to the next, so
// it flickers between them) - this small lift settles that in the floor's
// favor, same idea a decal or a rug laid "just above" the ground it's on
// already needs.
const FLOOR_LIFT = 0.02
function addFloor(meshes, floorMat){
    const size = HALF * 2 - WALL_THICKNESS
    const floor = MeshBuilder.CreateBox("castle_floor", { width: size, height: FLOOR_THICKNESS, depth: size }, matScene)
    floor.position.set(0, FLOOR_LIFT - FLOOR_THICKNESS / 2, 0)
    floor.material = floorMat
    meshes.push(floor)
}

// createCastle(scene, {x, z}, hasPhysics=true) - y is IGNORED on purpose and
// resampled live against the real openworld terrain (sampleTerrainSurfaceHeight,
// same helper every other static openworld prop placed this session
// eventually needed) instead of trusting a caller-supplied guess. Unlike
// localroomdb.js's own data-only optionalObjects entries (which have no
// scene/terrain access at author time and therefore no way to compute this
// themselves - see the witch towers' own hardcoded y:7.5 guess), this
// function runs at real scene-setup time with `scene` already in hand, so
// there's no reason to guess here at all.
export function createCastle(scene, position, hasPhysics = true){
    // getMaterials is what actually sets the module-level matScene (used by
    // every addWall/addTower/addKeep helper below to know which scene to
    // build meshes in) - see that function's own comment for why this has
    // to be the one place that assigns it, not a second redundant
    // assignment here racing its own cache-invalidation check
    const { stoneMat, roofMat, floorMat } = getMaterials(scene)
    const meshes = []

    // --- courtyard floor ---
    addFloor(meshes, floorMat)

    // --- outer walls (north/east/west solid, south split around the gate) ---
    addWall(meshes, stoneMat, 0, HALF, HALF * 2, "x")   // north
    addWall(meshes, stoneMat, HALF, 0, HALF * 2, "z")   // east
    addWall(meshes, stoneMat, -HALF, 0, HALF * 2, "z")  // west

    const southSegmentLength = HALF - GATE_WIDTH / 2
    const southSegmentCenter = GATE_WIDTH / 2 + southSegmentLength / 2
    addWall(meshes, stoneMat, southSegmentCenter, -HALF, southSegmentLength, "x")
    addWall(meshes, stoneMat, -southSegmentCenter, -HALF, southSegmentLength, "x")

    // --- corner towers ---
    ;[[HALF, HALF], [HALF, -HALF], [-HALF, HALF], [-HALF, -HALF]].forEach(([x, z]) => {
        addTower(meshes, stoneMat, roofMat, x, z, CORNER_TOWER_RADIUS, CORNER_TOWER_HEIGHT, CORNER_ROOF_HEIGHT)
    })

    // --- gatehouse towers flanking the gate gap ---
    addTower(meshes, stoneMat, roofMat, GATE_WIDTH / 2, -HALF, GATE_TOWER_RADIUS, GATE_TOWER_HEIGHT, GATE_ROOF_HEIGHT)
    addTower(meshes, stoneMat, roofMat, -GATE_WIDTH / 2, -HALF, GATE_TOWER_RADIUS, GATE_TOWER_HEIGHT, GATE_ROOF_HEIGHT)

    // --- central keep ---
    addKeep(meshes, stoneMat, roofMat, 0, 0)

    // multiMultiMaterials:true - keeps the stone/roof material split alive
    // through the merge (see this file's own header comment for the full
    // reasoning) instead of collapsing to whichever material the first
    // mesh in the array happens to have
    const castle = Mesh.MergeMeshes(meshes, true, true, undefined, false, true)
    castle.name = "castle"

    const groundY = sampleTerrainSurfaceHeight(position.x, position.z, OPENWORLD_TERRAIN_VERTS)
    castle.position = new Vector3(position.x, groundY, position.z)
    castle.isPickable = false
    castle.receiveShadows = true

    if(hasPhysics){
        // four plain invisible box colliders matching the outer wall line -
        // see this file's own header comment for why this is separate from
        // (and simpler than) trying to collide against the merged castle
        // mesh's own real shape
        const collider = (width, depth, x, z) => {
            const box = MeshBuilder.CreateBox("castle_wall_collider", { width, height: WALL_HEIGHT, depth }, scene)
            box.position = new Vector3(position.x + x, groundY + WALL_HEIGHT / 2, position.z + z)
            box.isVisible = false
            createAggregate(box, { mass: 0 }, "box", scene)
            return box
        }
        collider(HALF * 2, WALL_THICKNESS, 0, HALF)                          // north
        collider(WALL_THICKNESS, HALF * 2, HALF, 0)                          // east
        collider(WALL_THICKNESS, HALF * 2, -HALF, 0)                         // west
        collider(southSegmentLength, WALL_THICKNESS, southSegmentCenter, -HALF)
        collider(southSegmentLength, WALL_THICKNESS, -southSegmentCenter, -HALF)
    }

    return castle
}
