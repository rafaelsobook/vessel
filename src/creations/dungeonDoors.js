import { Mesh, PhysicsAggregate, PhysicsShapeType, LoadAssetContainerAsync } from '@babylonjs/core';
import '@babylonjs/loaders';

// The dungeon's doors - the generator's dungeon.doors (generatebsp.js): the
// entrance, the way you came in, and the exit at the far end of the boss
// hall. dungeondoor.glb is loaded once into a hidden template and every door
// is an instance of it - one draw call for all of them - standing against its
// wall with its studded face to the room. Walking up to one is its roomPaths
// entry's trigger (areascene.js), like any place's door.

const DOOR_MODEL  = "./models/indors/dungeondoor.glb";
// the model itself is 4.5 units tall - three times the player
const DOOR_HEIGHT = 3.4;
// how far a door's back sinks into its wall - no sliver of gap behind it
const DOOR_INSET  = 0.04;

// Loaded in the background like the vases and torch stands - the dungeon
// doesn't wait for its doors. maxLights: createDungeon's light cap.
// wallColumnAt(gx, gz): the camera-occlusion group of the wall cell's stack of
// cubes (createDungeon), so each door hides along with the wall it's set in.
export async function spawnDungeonDoors(scene, doors, { maxLights = 4, wallColumnAt } = {}) {
    if (!doors?.length) return;

    let container;
    try {
        container = await LoadAssetContainerAsync(DOOR_MODEL, scene);
    } catch (err) {
        console.warn(`[dungeonDoors] couldn't load ${DOOR_MODEL}`, err);
        return;
    }
    // the player may have left the dungeon while it loaded
    if (scene.isDisposed) { container.dispose(); return; }
    container.addAllToScene();

    // off the glTF __root__ (Blender's Z-up fix) and baked, so instances stand
    // upright without the parent chain (see loadmodel.js's loadMeshOnlyParts)
    const parts = container.meshes.filter(m => m.getTotalVertices() > 0);
    parts.forEach(m => { m.setParent(null); m.bakeCurrentTransformIntoVertices(); });
    const tpl = parts.length > 1 ? Mesh.MergeMeshes(parts, true, true, undefined, false, true) : parts[0];
    container.meshes.filter(m => m !== tpl && !m.isDisposed()).forEach(m => m.dispose());

    // origin moved to the middle of the door's back edge, on the floor - the
    // studded face is the model's -z, so its back is the +z face. An instance
    // then just goes on the wall face, turned to the room, at any scale.
    tpl.refreshBoundingInfo();
    const { minimum, maximum } = tpl.getBoundingInfo().boundingBox;
    const scale = DOOR_HEIGHT / (maximum.y - minimum.y);
    tpl.position.set(-(minimum.x + maximum.x) / 2, -minimum.y, -maximum.z);
    tpl.bakeCurrentTransformIntoVertices();
    // baking moves the vertices but keeps the old bounds - and the physics box
    // below is sized off them (it sat half inside the wall)
    tpl.refreshBoundingInfo();
    // the baked identity quaternion would override every instance's rotation.y
    tpl.rotationQuaternion = null;
    tpl.name       = "_tpl_dungeon_door";
    tpl.isVisible  = false;
    tpl.isPickable = false;
    // a merged multi-part model has a MultiMaterial - the cap goes on each part's
    (tpl.material?.subMaterials ?? [tpl.material]).forEach(m => {
        if (m) m.maxSimultaneousLights = Math.max(m.maxSimultaneousLights ?? 4, maxLights);
    });

    doors.forEach(door => {
        const inst = tpl.createInstance(`dungeon_${door.id}`);
        inst.isPickable = false;
        // the studded face (-z) toward dx/dz, into the room
        inst.rotation.y = Math.atan2(-door.dx, -door.dz);
        inst.scaling.setAll(scale);
        inst.position.set(door.x - door.dx * DOOR_INSET, door.y, door.z - door.dz * DOOR_INSET);
        inst.freezeWorldMatrix();
        // solid - you walk up to it, not into it
        new PhysicsAggregate(inst, PhysicsShapeType.BOX, { mass: 0 }, scene);
        joinWallOcclusion(inst, door.cells.map(c => wallColumnAt?.(c.x, c.y)).filter(Boolean));
    });
}

// The camera hides a wall column that comes between it and the player
// (tools/camera.js) - a door left standing in front of the gap would float.
// So each column it stands against takes the door into its group, and the
// door's own group is those columns: whichever the ray clips, they go together.
function joinWallOcclusion(door, columns) {
    if (!columns.length) return;
    columns.forEach(column => column.push(door));
    door._cameraOccluder = true;
    door._occlusionGroup = [...new Set(columns.flat())];
}
