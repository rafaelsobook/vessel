import { 
    Vector3, 
    MeshBuilder,
    PhysicsAggregate,
    PhysicsShapeType,
    Tools
} from '@babylonjs/core';

/**
 * Auto-detects door orientation from the grid by checking which axis
 * has floor tiles on both sides of the door cell.
 *
 * Returns "horizontal" if the passage runs left↔right (door face is N/S),
 * or "vertical" if the passage runs up↔down (door face is E/W).
 */
function inferDoorOrientation(grid, doorX, doorY) {
    const rows = grid.length;
    const cols = grid[0].length;

    const leftIsFloor  = doorX > 0       && grid[doorY][doorX - 1] !== 0;
    const rightIsFloor = doorX < cols - 1 && grid[doorY][doorX + 1] !== 0;
    const upIsFloor    = doorY > 0       && grid[doorY - 1][doorX] !== 0;
    const downIsFloor  = doorY < rows - 1 && grid[doorY + 1][doorX] !== 0;

    const horizontalPassage = leftIsFloor || rightIsFloor;
    const verticalPassage   = upIsFloor   || downIsFloor;

    // Prefer axis where BOTH neighbours are open; fall back to either side
    if (horizontalPassage && !verticalPassage) return "horizontal"; // door face is N/S, passage is E↔W
    if (verticalPassage   && !horizontalPassage) return "vertical";  // door face is E/W, passage is N↔S

    // Both axes open (cross-roads) – trust the data file hint if available
    return null; // caller falls back to the original value
}

export function generateDungeon(scene, dungeon, materials) {
    const { grid } = dungeon.layout;
    const cellSize = dungeon.layout.cellSize;
    const wallHeight = dungeon.walls.height;

    // ── Floors & ceilings ────────────────────────────────────────────────────
    dungeon.rooms.forEach(room => {
        const { x, y, width, height } = room.bounds;
        const worldX = (x + width / 2) * cellSize;
        const worldZ = (y + height / 2) * cellSize;

        const floor = MeshBuilder.CreateBox(`floor_${room.id}`, {
            width: width * cellSize,
            height: 0.2,
            depth: height * cellSize
        }, scene);
        floor.position = new Vector3(worldX, -0.1, worldZ);
        floor.material = materials.floor;
        new PhysicsAggregate(floor, PhysicsShapeType.BOX, { mass: 0 }, scene);

        const ceiling = MeshBuilder.CreateBox(`ceiling_${room.id}`, {
            width: width * cellSize,
            height: 0.2,
            depth: height * cellSize
        }, scene);
        ceiling.position = new Vector3(worldX, room.ceiling.height, worldZ);
        ceiling.material = materials.ceiling;
    });

    // ── Walls ────────────────────────────────────────────────────────────────
    for (let z = 0; z < grid.length; z++) {
        for (let x = 0; x < grid[z].length; x++) {
            if (grid[z][x] === 0) {
                const wall = MeshBuilder.CreateBox(`wall_${x}_${z}`, {
                    width: cellSize,
                    height: wallHeight,
                    depth: cellSize
                }, scene);
                wall.position = new Vector3(
                    x * cellSize + cellSize / 2,
                    wallHeight / 2,
                    z * cellSize + cellSize / 2
                );
                wall.material = materials.wall;
                new PhysicsAggregate(wall, PhysicsShapeType.BOX, { mass: 0 }, scene);
            }
        }
    }

    // ── Doors ────────────────────────────────────────────────────────────────
    dungeon.doors.forEach(door => {
        const centerX = door.x * cellSize + cellSize / 2;
        const centerZ = door.y * cellSize + cellSize / 2;
        const doorHeight   = wallHeight * 0.9;
        const doorThickness = 0.3;          // thin panel
        const doorWidth     = cellSize * 0.85; // slightly narrower than the passage

        // ── AUTO-DETECT orientation from the grid ──
        const detectedOrientation = inferDoorOrientation(grid, door.x, door.y);
        const orientation = detectedOrientation ?? door.orientation;

        /*
         * Passage runs LEFT ↔ RIGHT  →  "horizontal"
         *   The opening is along the X axis, so the door panel must block it:
         *   panel is wide in Z (depth), thin in X.
         *
         * Passage runs UP ↔ DOWN     →  "vertical"
         *   The opening is along the Z axis, so the door panel must block it:
         *   panel is wide in X (width), thin in Z.
         */
        const doorBox = MeshBuilder.CreateBox(door.id, {
            width:  orientation === "horizontal" ? doorThickness : doorWidth,
            height: doorHeight,
            depth:  orientation === "horizontal" ? doorWidth     : doorThickness
        }, scene);

        doorBox.position = new Vector3(centerX, doorHeight / 2, centerZ);
        doorBox.material = door.type === "iron" ? materials.ironDoor : materials.door;
        new PhysicsAggregate(doorBox, PhysicsShapeType.BOX, { mass: 0 }, scene);
    });

    // ── Props ────────────────────────────────────────────────────────────────
    dungeon.props.forEach(prop => {
        const worldX = prop.x * cellSize + cellSize / 2;
        const worldZ = prop.y * cellSize + cellSize / 2;

        if (prop.type === "torch") {
            const torchPole = MeshBuilder.CreateCylinder(prop.id + "_pole", {
                height: 1.2,
                diameter: 0.08
            }, scene);
            torchPole.position = new Vector3(worldX, 0.6, worldZ);
            torchPole.material = materials.torch;

            const torchTop = MeshBuilder.CreateSphere(prop.id + "_flame", {
                diameter: 0.25
            }, scene);
            torchTop.position = new Vector3(worldX, 1.3, worldZ);
            torchTop.material = materials.torch;

        } else if (prop.type === "barrel") {
            const barrel = MeshBuilder.CreateCylinder(prop.id, {
                height: 1.5,
                diameter: 0.8
            }, scene);
            barrel.position = new Vector3(worldX, 0.75, worldZ);
            barrel.rotation.y = Tools.ToRadians(prop.rotation);
            barrel.material = materials.barrel;
            new PhysicsAggregate(barrel, PhysicsShapeType.CYLINDER, { mass: 10 }, scene);

        } else if (prop.type === "chest") {
            const chest = MeshBuilder.CreateBox(prop.id, {
                width: 1,
                height: 0.8,
                depth: 0.6
            }, scene);
            chest.position = new Vector3(worldX, 0.4, worldZ);
            chest.rotation.y = Tools.ToRadians(prop.rotation);
            chest.material = materials.chest;
            new PhysicsAggregate(chest, PhysicsShapeType.BOX, { mass: 20 }, scene);
        }
    });
}