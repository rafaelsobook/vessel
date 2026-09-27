import { MeshBuilder, Mesh, StandardMaterial, Color3 } from "@babylonjs/core"
import { createMat } from "../tools/materials.js"
import { createAggregate } from "../tools/physics.js"
import { sampleTerrainSurfaceHeight } from "infterrain"
import { OPENWORLD_TERRAIN_VERTS } from "../constants/constants.js"

// A procedural medieval castle, entirely MeshBuilder primitives - no glb
// asset for this one. Every piece is positioned directly in real WORLD
// space at construction time (worldOffset = position.x/groundY/position.z,
// threaded into every addWall/addTower/addKeep/addFloor/addGateStep call),
// not built at local castle-center-at-origin and moved once at the end the
// way this originally worked - see createCastle's own comment for exactly
// why that changed (short version: a mass:0 PhysicsAggregate bakes its
// collider pose once at creation and never re-syncs, so "position later"
// stopped being an option once every piece started carrying one).
//
// Two materials (stone walls/towers/keep, dark tile roofs), preserved
// through the merge via multiMultiMaterials:true (Mesh.MergeMeshes' own 6th
// param) instead of collapsing everything to one flat material - Babylon
// sorts the source meshes by their own .material and bakes the result into
// a single MultiMaterial + per-submesh index assignment, so this is still
// genuinely ONE mesh afterward, just one that isn't monochrome.
//
// Physics: every individual piece (each wall run, each merlon, both tower
// pieces, the keep and its roof, the floor slab, the gate step) gets its
// own createAggregate({mass:0}, ..., "box") - real per-piece collision,
// not the four flat wall-line boxes this used to approximate the whole
// castle with (which meant towers/keep/roofs/crenellations/floor had NO
// collision of their own at all). Still "box", not "mesh" - confirmed
// elsewhere in this project (areascene.js's own openworld terrain setup
// comment) that Havok's "mesh" shape doesn't actually collide in this
// build, so a box approximating each piece's real silhouette (chunkier on
// the cone/pyramid roofs, exact on everything else) is what's used
// throughout, same as it always was here.
//
// The source meshes are kept alive (not disposed) through the merge when
// hasPhysics is true, specifically so their aggregates survive - and then
// hidden, since the merged castle carries the visuals from here on.

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
// gate threshold - a low stone sill spanning the entrance, short enough to
// hop up onto/over rather than a real barrier. ~1ft: this project's own
// human-scale convention (createcharacter.js's capsuleHeight, roughly a
// 6ft person) puts 1 world unit at roughly 3ft, so 1ft lands at ~0.3.
const GATE_STEP_HEIGHT = 0.3
const GATE_STEP_DEPTH = 2

let stoneMat = null
let stepMat = null
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
        stepMat = null
        roofMat = null
        floorMat = null
    }
    matScene = scene
    if(!stoneMat){
        // same rockTex.jpg every room's own stone wall already uses
        // (createroom.js) - one consistent "castle stone" look across the game
        stoneMat = createMat("castleStoneMat", false, "./images/modeltex/rockTex.jpg", scene, { uScale: 4, vScale: 2 })
    }
    if(!stepMat){
        // SAME rockTex.jpg as stoneMat, its own material with a UV scale
        // tuned for the step box's FRONT/RISER face, not its top -
        // MeshBuilder.CreateBox applies one uScale/vScale to every face
        // alike, but this box's faces are wildly different shapes: the top
        // is 12x2 (width x depth), the front riser you actually walk
        // toward and see is 12x0.3 (width x GATE_STEP_HEIGHT) - a much
        // thinner face. A vScale picked for the top's "depth" of 2 (this
        // used to be 0.5) squeezes way more vertical texture than a
        // 0.3-tall face can show without smearing - confirmed stretched
        // in-game from straight-on, which is the dominant view walking
        // through the gate. vScale: 0.075 targets the walls' own ~4-world-
        // units-per-repeat density (WALL_HEIGHT:8 / stoneMat's vScale:2)
        // against the riser's real 0.3-unit height instead
        // (0.3/4 = 0.075), trading a busier/more-tiled look on the
        // rarely-seen top face for a correct one on the face that's
        // actually in view.
        stepMat = createMat("castleStepMat", false, "./images/modeltex/rockTex.jpg", scene, { uScale: 1.2, vScale: 3 })
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
    return { stoneMat, stepMat, roofMat, floorMat }
}

// one straight wall run centered at (centerX, centerZ), spanning `length`
// along the given axis ("x" or "z") - a single box, not a per-brick
// instanced chain the way createroom.js's own procedural rooms do (this is
// a one-off static structure, not a reusable room shape, so the extra
// instancing machinery isn't worth it here)
//
// worldOffset ({x, y, z} = position.x, groundY, position.z) is added into
// every position.set below rather than left at castle-local coordinates -
// see createCastle's own comment for why a mass:0 aggregate needs that now.
function addWall(meshes, stoneMat, centerX, centerZ, length, axis, worldOffset, scene, hasPhysics){
    const wall = axis === "x"
        ? MeshBuilder.CreateBox("castle_wall", { width: length, height: WALL_HEIGHT, depth: WALL_THICKNESS }, matScene)
        : MeshBuilder.CreateBox("castle_wall", { width: WALL_THICKNESS, height: WALL_HEIGHT, depth: length }, matScene)
    wall.position.set(worldOffset.x + centerX, worldOffset.y + WALL_HEIGHT / 2, worldOffset.z + centerZ)
    wall.material = stoneMat
    if(hasPhysics) createAggregate(wall, { mass: 0 }, "box", scene)
    meshes.push(wall)
    addCrenellations(meshes, stoneMat, centerX, centerZ, length, axis, worldOffset, scene, hasPhysics)
}

// small merlon blocks marching along the top of a wall run, alternating
// merlon/gap for the classic castle silhouette. Used to be purely
// decorative (the wall box underneath already blocks ground-level
// movement) - now gets its own box collider too like everything else here,
// so an arrow/projectile arcing over the wall can actually clip a merlon
// instead of passing clean through it.
function addCrenellations(meshes, stoneMat, centerX, centerZ, length, axis, worldOffset, scene, hasPhysics){
    const step = MERLON_SIZE + MERLON_GAP
    const count = Math.floor(length / step)
    const start = -((count - 1) * step) / 2
    const topY = WALL_HEIGHT + MERLON_HEIGHT / 2

    for(let i = 0; i < count; i++){
        const merlonOffset = start + i * step
        const merlon = MeshBuilder.CreateBox("castle_merlon", { width: MERLON_SIZE, height: MERLON_HEIGHT, depth: MERLON_SIZE }, matScene)
        if(axis === "x") merlon.position.set(worldOffset.x + centerX + merlonOffset, worldOffset.y + topY, worldOffset.z + centerZ)
        else merlon.position.set(worldOffset.x + centerX, worldOffset.y + topY, worldOffset.z + centerZ + merlonOffset)
        merlon.material = stoneMat
        if(hasPhysics) createAggregate(merlon, { mass: 0 }, "box", scene)
        meshes.push(merlon)
    }
}

// a round tower - cylinder body + cone roof, sharing the same (x,z) so the
// roof sits centered directly on top of the body
//
// Both get their own box collider (createAggregate's "box" shape auto-sizes
// off each mesh's own bounding box - physics.js/physicsAggregate.js) -
// before this, NEITHER a tower's body nor its roof had any collision at
// all, so the old 4-flat-wall-line colliders let you walk straight through
// every tower. A box hugging the cone roof is chunkier than the real
// pointed shape (box vs cone), same trade-off this file's own header
// comment already accepts for the wall/gate colliders - not worth a
// separate convex-hull shape for one decorative roof silhouette.
function addTower(meshes, stoneMat, roofMat, x, z, radius, height, roofHeight, worldOffset, scene, hasPhysics){
    const body = MeshBuilder.CreateCylinder("castle_tower", { diameter: radius * 2, height, tessellation: 16 }, matScene)
    body.position.set(worldOffset.x + x, worldOffset.y + height / 2, worldOffset.z + z)
    body.material = stoneMat
    if(hasPhysics) createAggregate(body, { mass: 0 }, "box", scene)
    meshes.push(body)

    // diameterTop:0 - a real cone, same "cone" shape convention
    // skillEffects.js's own buildProjectileShapeMesh already uses for a
    // sharp point, just full-size here instead of a tiny skill effect
    const roof = MeshBuilder.CreateCylinder("castle_towerroof", { diameterTop: 0, diameterBottom: radius * 2.3, height: roofHeight, tessellation: 16 }, matScene)
    roof.position.set(worldOffset.x + x, worldOffset.y + height + roofHeight / 2, worldOffset.z + z)
    roof.material = roofMat
    if(hasPhysics) createAggregate(roof, { mass: 0 }, "box", scene)
    meshes.push(roof)
}

// the central keep - a tall box with a pyramid roof (tessellation:4 turns
// the same cone primitive into a 4-sided pyramid instead of a smooth cone -
// no separate "pyramid" shape exists in MeshBuilder, this is the standard
// way to get one). Same per-piece box-collider treatment as addTower above.
function addKeep(meshes, stoneMat, roofMat, x, z, worldOffset, scene, hasPhysics){
    const body = MeshBuilder.CreateBox("castle_keep", { width: KEEP_SIZE, height: KEEP_HEIGHT, depth: KEEP_SIZE }, matScene)
    body.position.set(worldOffset.x + x, worldOffset.y + KEEP_HEIGHT / 2, worldOffset.z + z)
    body.material = stoneMat
    if(hasPhysics) createAggregate(body, { mass: 0 }, "box", scene)
    meshes.push(body)

    const roof = MeshBuilder.CreateCylinder("castle_keeproof", { diameterTop: 0, diameterBottom: KEEP_SIZE * 1.35, height: KEEP_ROOF_HEIGHT, tessellation: 4 }, matScene)
    // tessellation:4's own flat faces land corner-first by default (a
    // diamond footprint, not aligned to the keep's own square) - 45°
    // rotation squares it back up with the box body underneath
    roof.rotation.y = Math.PI / 4
    roof.position.set(worldOffset.x + x, worldOffset.y + KEEP_HEIGHT + KEEP_ROOF_HEIGHT / 2, worldOffset.z + z)
    roof.material = roofMat
    if(hasPhysics) createAggregate(roof, { mass: 0 }, "box", scene)
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
function addFloor(meshes, floorMat, worldOffset, scene, hasPhysics){
    const size = HALF * 2 - WALL_THICKNESS
    const floor = MeshBuilder.CreateBox("castle_floor", { width: size, height: FLOOR_THICKNESS, depth: size }, matScene)
    floor.position.set(worldOffset.x, worldOffset.y + FLOOR_LIFT - FLOOR_THICKNESS / 2, worldOffset.z)
    floor.material = floorMat
    // its own collider now too - without this, standing in the courtyard
    // meant walking on the raw openworld terrain underneath (which can dip/
    // rise across the 40x40 footprint) rather than this flat slab, so the
    // ground under your feet could visibly not match what you're standing on
    if(hasPhysics) createAggregate(floor, { mass: 0 }, "box", scene)
    meshes.push(floor)
}

// gate threshold - a low stone sill spanning the GATE_WIDTH opening, sitting
// right on the south wall line (same z as the south wall segments). Its own
// box collider is only GATE_STEP_HEIGHT (0.3) tall, same as its visual mesh -
// short enough to hop up onto/over rather than actually blocking the
// entrance, "I can just jump so I can enter" per spec, not a real barrier.
function addGateStep(meshes, stepMat, worldOffset, scene, hasPhysics){
    const step = MeshBuilder.CreateBox("castle_gatestep", { width: GATE_WIDTH, height: GATE_STEP_HEIGHT, depth: GATE_STEP_DEPTH }, matScene)
    step.position.set(worldOffset.x, worldOffset.y + GATE_STEP_HEIGHT / 2, worldOffset.z - HALF)
    step.material = stepMat
    if(hasPhysics) createAggregate(step, { mass: 0 }, "box", scene)
    meshes.push(step)
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
    const { stoneMat, stepMat, roofMat, floorMat } = getMaterials(scene)
    const meshes = []

    // groundY now computed UP FRONT, before any piece is built - every
    // add* call below positions its piece directly in real WORLD space
    // (worldOffset added into each one's own position.set), not at
    // castle-local coordinates the way this used to work (build flat at
    // origin, merge, then move the whole result once via one final
    // castle.position assignment).
    //
    // That reordering is required, not stylistic: each piece now gets its
    // own createAggregate({mass:0}, ...) - a STATIC body - and PhysicsBody
    // sets disableSync=true specifically for STATIC bodies (confirmed in
    // this project's own node_modules/@babylonjs/core/Physics/v2/
    // physicsBody.js). A static collider bakes its pose ONCE at the moment
    // createAggregate runs and never re-syncs to the mesh afterward - so
    // if these were still built at local-origin-relative coordinates and
    // only moved into place LATER (the old approach), every collider would
    // stay baked near the origin while the visible castle moved away from
    // them, invisibly.
    const groundY = sampleTerrainSurfaceHeight(position.x, position.z, OPENWORLD_TERRAIN_VERTS)
    const worldOffset = { x: position.x, y: groundY, z: position.z }

    // --- courtyard floor ---
    addFloor(meshes, floorMat, worldOffset, scene, hasPhysics)

    // --- outer walls (north/east/west solid, south split around the gate) ---
    addWall(meshes, stoneMat, 0, HALF, HALF * 2, "x", worldOffset, scene, hasPhysics)   // north
    addWall(meshes, stoneMat, HALF, 0, HALF * 2, "z", worldOffset, scene, hasPhysics)   // east
    addWall(meshes, stoneMat, -HALF, 0, HALF * 2, "z", worldOffset, scene, hasPhysics)  // west

    const southSegmentLength = HALF - GATE_WIDTH / 2
    const southSegmentCenter = GATE_WIDTH / 2 + southSegmentLength / 2
    addWall(meshes, stoneMat, southSegmentCenter, -HALF, southSegmentLength, "x", worldOffset, scene, hasPhysics)
    addWall(meshes, stoneMat, -southSegmentCenter, -HALF, southSegmentLength, "x", worldOffset, scene, hasPhysics)

    // --- corner towers ---
    ;[[HALF, HALF], [HALF, -HALF], [-HALF, HALF], [-HALF, -HALF]].forEach(([x, z]) => {
        addTower(meshes, stoneMat, roofMat, x, z, CORNER_TOWER_RADIUS, CORNER_TOWER_HEIGHT, CORNER_ROOF_HEIGHT, worldOffset, scene, hasPhysics)
    })

    // --- gatehouse towers flanking the gate gap ---
    addTower(meshes, stoneMat, roofMat, GATE_WIDTH / 2, -HALF, GATE_TOWER_RADIUS, GATE_TOWER_HEIGHT, GATE_ROOF_HEIGHT, worldOffset, scene, hasPhysics)
    addTower(meshes, stoneMat, roofMat, -GATE_WIDTH / 2, -HALF, GATE_TOWER_RADIUS, GATE_TOWER_HEIGHT, GATE_ROOF_HEIGHT, worldOffset, scene, hasPhysics)

    // --- central keep ---
    addKeep(meshes, stoneMat, roofMat, 0, 0, worldOffset, scene, hasPhysics)

    // --- gate threshold ---
    addGateStep(meshes, stepMat, worldOffset, scene, hasPhysics)

    // disposeSource is now !hasPhysics, not the old unconditional true.
    // When hasPhysics is true, every mesh above already carries its own
    // static PhysicsAggregate - disposing the SOURCE mesh here would
    // dispose that aggregate right along with it (PhysicsAggregate's own
    // onDisposeObservable hook, physicsAggregate.js), undoing the physics
    // this was all for. Keeping them alive (and hiding them, below) is what
    // keeps their colliders in the world after the merge.
    //
    // multiMultiMaterials:true - keeps the stone/roof material split alive
    // through the merge (see this file's own header comment for the full
    // reasoning) instead of collapsing to whichever material the first
    // mesh in the array happens to have.
    const castle = Mesh.MergeMeshes(meshes, !hasPhysics, true, undefined, false, true)
    castle.name = "castle"
    castle.isPickable = false
    castle.receiveShadows = true

    // No castle.position assignment - unlike the old version. MergeMeshes
    // bakes each source's own WORLD matrix into the merged vertex data
    // (Mesh.pure.js's own merge coroutine calls mesh.computeWorldMatrix(true)
    // per source) and leaves the resulting mesh at position (0,0,0); since
    // every source above was already built at its real world position via
    // worldOffset, that baked data IS the correct final placement already.
    // Moving the merged result again here would double-offset it away from
    // the colliders that are, correctly, sitting at worldOffset.

    if(hasPhysics){
        // the merged castle carries every piece's visuals now - the
        // originals (kept alive above so their aggregates survive) become
        // pure invisible physics proxies, same convention the old manual
        // wall-line colliders already used (isVisible:false)
        meshes.forEach(mesh => {
            mesh.isVisible = false
            mesh.isPickable = false
        })
    }

    return castle
}
