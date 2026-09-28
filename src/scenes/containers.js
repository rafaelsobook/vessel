import {SceneLoader} from "@babylonjs/core"
import { loadAvatarContainer, loadMeshOnlyParts, mergeAndLoadModel } from "../tools/loadmodel"
import { loadProjectileModels } from "../assetcreation/createProjectileModel"
import { setSocketContainers } from "../sockets/worldsocket"

// monster model containers are added incrementally as new enemy types get
// modeled - a not-yet-added glb (404) shouldn't take the whole scene down
// with it, since setStartingContainers loads everything (avatar body,
// weapons, helmets...) in one sequence
async function loadMonsterRoot(path, scene){
    try {
        return await loadAvatarContainer(path, scene)
    } catch (error) {
        console.warn(`[containers] monster model missing/failed to load: "${path}"`, error)
        return null
    }
}

// non-animated cloneable prop roots (treasure chest etc, same idea as
// assetregistry.js's village props) - mergeAndLoadModel flattens a
// multi-part glb into one mesh so callers can just .clone() it wherever a
// prop needs to spawn later, instead of loadMonsterRoot's rigged/animated
// loadAvatarContainer path above (wrong tool for a static prop). Same
// "warn and fall back to null" resilience as every other optional asset
// here - a missing/corrupt treasure.glb shouldn't take the whole scene down.
// functionBeforeMerge - optional pass-through to mergeAndLoadModel's own
// escape hatch (loadmodel.js): when given, it's used INSTEAD OF the default
// Mesh.MergeMeshes(container.meshes[0].getChildMeshes(), ...) step. That
// default only works for a multi-part hierarchy (bonfire.glb/treasure.glb -
// several child meshes under a root), which is why bonfireRoot/treasureRoot
// never needed this. A single-mesh glb (wagon.glb - confirmed by its own
// glTF JSON: exactly one node, no children at all) has nothing for
// getChildMeshes() to find, so the default merge silently produces null -
// see containers.js's own wagonRoot call for the real fix that needed.
async function loadPropRootSafe(path, scene, functionBeforeMerge){
    try {
        const mesh = await mergeAndLoadModel(path, scene, functionBeforeMerge)
        if(mesh) mesh.isVisible = false
        return mesh
    } catch (error) {
        console.warn(`[containers] prop model missing/failed to load: "${path}"`, error)
        return null
    }
}

// equipment/accessory containers (hair, helmets, gauntlets, pauldrons,
// weapons) - none of these should be able to take the whole game down if
// one asset is missing/corrupt. Falls back to an empty mesh list instead of
// throwing, so containers.helmets.find(...) etc. downstream just never
// matches anything rather than crashing on a null/undefined container.
async function importMeshSafe(rootUrl, filename, scene){
    try {
        return await SceneLoader.ImportMeshAsync("", rootUrl, filename, scene)
    } catch (error) {
        console.warn(`[containers] failed to load "${rootUrl}${filename}"`, error)
        return { meshes: [] }
    }
}

export async function setStartingContainers(scene){
    try {
        const animeBodyContainer = await loadAvatarContainer("./models/avatar/avatar.glb", scene)
        let goblinRoot = await loadMonsterRoot("./models/monsters/goblin.glb", scene)
        let monolithRoot = await loadMonsterRoot("./models/monsters/monolith.glb", scene)
        let slimeRoot = await loadMonsterRoot("./models/monsters/slime.glb", scene)
        let lesserDemonRoot = await loadMonsterRoot("./models/monsters/lesserdemon.glb", scene)
        let deerRoot = await loadMonsterRoot("./models/monsters/deer.glb", scene)
        let treasureRoot = await loadPropRootSafe("./models/indors/treasure.glb", scene)
        let bonfireRoot = await loadPropRootSafe("./models/outdors/bonfire.glb", scene)
        // campcraft.js's "treelog" craft (Structures section, same
        // click-to-place flow as bonfire) - a single cut log prop, cloned
        // per placement by assetcreation/createtrunk.js's createTrunkMesh
        let trunkRoot = await loadPropRootSafe("./models/outdors/trunk.glb", scene)
        // openworld ambient wagon traffic (tcp/recources/wagons.ts) - static,
        // non-animated prop (confirmed by grepping wagon.glb's own raw text:
        // no "animations" key at all). Unlike bonfireRoot/treasureRoot,
        // wagon.glb is a SINGLE fused mesh with no children at all (confirmed
        // against its own glTF JSON: one node, "wagon", nothing under it) -
        // mergeAndLoadModel's default Mesh.MergeMeshes(...getChildMeshes())
        // step finds nothing to merge for a leaf mesh like this and silently
        // returns null, which is why wagons never actually appeared. The
        // functionBeforeMerge callback skips that step entirely and just
        // returns the one real mesh directly - same technique confirmed
        // working via a manual SceneLoader.ImportMeshAsync test in-game.
        let wagonRoot = await loadPropRootSafe("./models/outdors/wagon.glb", scene, container => {
            const mesh = container.meshes.find(m => m.getTotalVertices() > 0)
            if(!mesh) console.warn(`[containers] wagon.glb loaded but no mesh with geometry was found in it`)
            return mesh ?? null
        })
        if(wagonRoot){
            // wagon.glb's own shaft/tongue poles (what a deer actually
            // harnesses to) sit at LOCAL -z, not +z - confirmed straight off
            // the glb's own geometry bounds (its POSITION accessor:
            // z ranges -5.23..2.36, i.e. the model extends more than twice
            // as far in -z as +z, which is exactly the long shafts). Every
            // wagon's own body.lookAt(...) (createwagon.js) always aims
            // local +z at the travel direction, so without this the wagon
            // drove shaft-end trailing instead of leading - and since the
            // harness deer is parented at a fixed LOCAL offset off that
            // same (wrong) frame, that's what actually threw it out to the
            // wrong world position/rotation too, not a height bug on its
            // own. Baked into the vertices ONCE here (not left as a plain
            // .rotation, which lookAt would just overwrite on every single
            // call anyway - same bakeCurrentTransformIntoVertices technique
            // loadmodel.js's own loadMeshOnlyParts already uses) so every
            // future .clone() already has its real front at +z, and both
            // createwagon.js's lookAt calls and HARNESS_OFFSET_Z's existing
            // +6 need no changes of their own to line up correctly.
            // glTF imports commonly land with rotationQuaternion already set
            // (not null) - Babylon ignores .rotation entirely whenever that's
            // non-null, which would make the very next line silently do
            // nothing. Forced back to null here so plain Euler .rotation
            // actually takes effect, same as every other freshly-cloned
            // mesh in this codebase that gets a rotationQuaternion assigned
            // instead (createEnemy.js's own mainBodyMeshes.rotationQuaternion
            // = Quaternion.Identity() right before it needs Euler-friendly
            // handling is the same idea, just resetting to null here instead
            // of identity since bakeCurrentTransformIntoVertices below folds
            // this rotation into the geometry itself, not into either
            // rotation property going forward)
            // wagonRoot.rotationQuaternion = null
            // wagonRoot.rotation.y = Math.PI
            // wagonRoot.bakeCurrentTransformIntoVertices()
        }

        // wagon's own physics collider - a purpose-built shape (not the
        // visible wagon.glb model itself), confirmed off its own glb JSON:
        // a single node/mesh, scale (1,1,~2.746), translation
        // (0,0,~-0.854), raw POSITION bounds x:[-1,1] y:[0,2] z:[-1,1] -
        // meaning its pivot already sits at ground level (y=0 is the
        // shape's own bottom, not its center), same convention wagonRoot's
        // own bake above already established for the visible model.
        let wagonBodyColliderRoot = await loadPropRootSafe("./models/outdors/wagonbodycollider.glb", scene, container => {
            const mesh = container.meshes.find(m => m.getTotalVertices() > 0)
            if(!mesh) console.warn(`[containers] wagonbodycollider.glb loaded but no mesh with geometry was found in it`)
            return mesh ?? null
        })
        if(wagonBodyColliderRoot){
            // wagonBodyColliderRoot.isVisible = false
            // wagonBodyColliderRoot.setEnabled(false)
            // wagonBodyColliderRoot.isPickable = false
            // MUST bake the node's own scale/translation into the vertices
            // (not just leave it as .position/.scaling) - createwagon.js's
            // own PhysicsShapeConvexHull reads this mesh's RAW local
            // vertices plus only its absoluteSCALING when building the
            // collision shape (see @babylonjs/core's own
            // havokPlugin.js/MeshAccumulator - deliberately bakes ancestor
            // SCALE in, since physics shapes are defined in a purely
            // rigid frame, but never bakes in POSITION/rotation, since
            // those are the physics BODY's own job to track). Left
            // un-baked, the resulting collision shape would sit offset
            // from wherever this mesh actually visually renders by that
            // same ~-0.854 translation - an invisible mismatch between
            // what's shown and what's actually solid.
            //
            // wagonbodycollider.glb's own modeled "front" doesn't line up
            // with local +z (the axis createwagon.js's own
            // rotation.y = Math.atan2(dirX,dirZ) always points at the
            // direction of travel) - confirmed in-game, the collider was
            // visibly facing off at an angle instead of leading the
            // direction it was actually moving. Same fix wagonRoot's own
            // rotation.y = Math.PI bake above already used for the exact
            // same class of problem on wagon.glb itself: correct the
            // mismatch ONCE here, baked permanently into the geometry, so
            // every per-wagon clone already has its real front at +z and
            // createwagon.js's own yaw code needs no changes of its own to
            // line up correctly. 45deg per visual estimate in-game - if
            // this overshoots/undershoots or goes the wrong way, adjust
            // the sign/magnitude here (a negative value turns the other
            // direction) rather than touching any of the yaw math itself.
            // wagonBodyColliderRoot.rotationQuaternion = null
            // wagonBodyColliderRoot.rotation.y = Math.PI / 4
            // wagonBodyColliderRoot.bakeCurrentTransformIntoVertices()
        }

        // wagon wheels - two separate glbs, each one a full AXLE PAIR rather
        // than a single wheel: both carry X bounds -1.31..1.30, i.e. the left
        // and right wheel modelled together spanning the axle width. So one
        // clone per axle (front, rear), not one per wheel.
        // Y -0.73..0.70 means each is centre-pivoted vertically, so a clone
        // placed at local y = wheel radius sits its bottom on the ground.
        // Loaded through the same loadPropRootSafe + "first mesh with real
        // geometry" pattern wagonRoot above uses, since these are equally
        // single-node props.
        let wagonWheelFrontRoot = await loadPropRootSafe("./models/outdors/wagonwheel_front.glb", scene, container => {
            const mesh = container.meshes.find(m => m.getTotalVertices() > 0)
            if(!mesh) console.warn(`[containers] wagonwheel_front.glb loaded but no mesh with geometry was found in it`)
            return mesh ?? null
        })
        let wagonWheelRearRoot = await loadPropRootSafe("./models/outdors/wagonwheel_rear.glb", scene, container => {
            const mesh = container.meshes.find(m => m.getTotalVertices() > 0)
            if(!mesh) console.warn(`[containers] wagonwheel_rear.glb loaded but no mesh with geometry was found in it`)
            return mesh ?? null
        })

        const HairModel = await importMeshSafe("./models/avatar/", "hairModels.glb", scene)
        const helmets = await importMeshSafe("./models/helmets/", "helmets.glb", scene)
        helmets.meshes.forEach(m => m.isVisible = false)
        HairModel.meshes.forEach(m => m.isVisible = false)
        const gauntlets = await importMeshSafe("./models/gauntlets/", "gauntlets.glb", scene)
        gauntlets.meshes.forEach(m => m.isVisible = false)
        const pauldrons = await importMeshSafe("./models/pauldrons/", "pauldrons.glb", scene)
        pauldrons.meshes.forEach(m => m.isVisible = false)
        // single-mesh, non-sword weapons (spear etc) - see createweapon.js's
        // createSingleMeshWeapon. Doesn't exist yet; importMeshSafe just
        // falls back to an empty list until this glb is actually added
        // const weapons = await importMeshSafe("./models/weapons/", "weapons.glb", scene)
        // weapons.meshes.forEach(m => m.isVisible = false)
        // const helmets = await loadModel("./models/helmets/helmets.glb", scene, true)

        let allweaponParts
        try {
            allweaponParts = await loadMeshOnlyParts("./models/swords/allswords.glb", scene)
        } catch (error) {
            console.warn(`[containers] failed to load weapon parts`, error)
            allweaponParts = []
        }
        // axe/pickaxe parts (models/axe/axes.glb - axe_blade/axe_guard/
        // axe_handle, pickaxe_blade/pickaxe_guard, no pickaxe_handle at all,
        // see createweapon.js's own SHARED_PART_SOURCE for why) - merged
        // into the SAME flat allweapons object allswords.glb's own parts
        // already live in, since createweapon.js's createPartsWeapon looks
        // everything up from that one object regardless of weaponType.
        // Same "warn and fall back to nothing" resilience as every other
        // optional asset here - a missing/corrupt axes.glb shouldn't take
        // sword loading (or the rest of the scene) down with it.
        try {
            const axeParts = await loadMeshOnlyParts("./models/axe/axes.glb", scene)
            allweaponParts = { ...allweaponParts, ...axeParts }
        } catch (error) {
            console.warn(`[containers] failed to load axe/pickaxe weapon parts`, error)
        }

        // real GLB projectile models (models/projectiles/*.glb) -
        // createProjectileModel.js's own PROJECTILE_MODEL_PATHS registry;
        // loadProjectileModels already warns-and-skips per missing/failed
        // model rather than throwing, so no try/catch needed here
        const projectileModels = await loadProjectileModels(scene)

        const containers = setSocketContainers({
            hairs: HairModel.meshes,
            animeBody: animeBodyContainer,
            allweapons: allweaponParts,
            weapons:null,
            helmets: helmets.meshes,
            gauntlets: gauntlets.meshes,
            pauldrons: pauldrons.meshes,
            armors: null,
            belts: null,
            cloaks: null,
            projectileModels,

            goblinRoot,
            monolithRoot,
            slimeRoot,
            lesserDemonRoot,
            deerRoot,
            treasureRoot,
            bonfireRoot,
            trunkRoot,
            wagonRoot,
            wagonBodyColliderRoot,
            wagonWheelFrontRoot,
            wagonWheelRearRoot
        })
        return { animeBodyContainer }
    } catch (error) {
        return false
    }
}
