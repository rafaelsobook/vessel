export const dungeon = {
  // Metadata
  meta: {
    name: "The Forgotten Catacombs",
    difficulty: 1,
    theme: "stone_dungeon",
    created: Date.now()
  },

  // Grid-based layout (2D array where each cell represents a tile)
  layout: {
    width: 10,
    height: 10,
    cellSize: 6, // INCREASED from 4 to 6 for wider hallways
    
    // Grid: 0=wall, 1=floor, 2=door, 3=special
    grid: [
      [0,0,0,0,0,0,0,0,0,0],
      [0,1,1,1,0,1,1,1,1,0],
      [0,1,1,1,2,1,1,1,1,0],
      [0,1,1,1,0,0,0,2,0,0],
      [0,0,2,0,0,1,1,1,1,0],
      [0,1,1,1,0,1,1,1,1,0],
      [0,1,1,1,2,1,1,1,0,0],
      [0,1,1,1,0,0,0,1,1,0],
      [0,1,1,1,1,1,1,1,1,0],
      [0,0,0,0,0,0,0,0,0,0]
    ]
  },

  // Rooms with semantic meaning - Now covers ALL floor tiles including corridors
  rooms: [
    {
      id: "room_0",
      type: "entrance",
      bounds: { x: 1, y: 1, width: 3, height: 3 },
      floor: "stone_tile",
      ceiling: { height: 5, texture: "stone_ceiling" }
    },
    {
      id: "room_1",
      type: "corridor",
      bounds: { x: 5, y: 1, width: 4, height: 2 },
      floor: "cobblestone",
      ceiling: { height: 4.5, texture: "stone_ceiling" }
    },
    {
      id: "room_2",
      type: "chamber",
      bounds: { x: 1, y: 5, width: 3, height: 3 },
      floor: "dirty_stone",
      ceiling: { height: 6, texture: "vaulted_ceiling" }
    },
    {
      id: "room_3",
      type: "treasure",
      bounds: { x: 7, y: 7, width: 2, height: 2 },
      floor: "marble",
      ceiling: { height: 7, texture: "decorated_ceiling" }
    },
    // Corridors between rooms (to ensure floors everywhere)
    {
      id: "corridor_1",
      type: "corridor",
      bounds: { x: 1, y: 4, width: 1, height: 1 },
      floor: "cobblestone",
      ceiling: { height: 4.5, texture: "stone_ceiling" }
    },
    {
      id: "corridor_2",
      type: "corridor",
      bounds: { x: 2, y: 4, width: 1, height: 1 },
      floor: "cobblestone",
      ceiling: { height: 4.5, texture: "stone_ceiling" }
    },
    {
      id: "corridor_3",
      type: "corridor",
      bounds: { x: 4, y: 2, width: 1, height: 1 },
      floor: "cobblestone",
      ceiling: { height: 4.5, texture: "stone_ceiling" }
    },
    {
      id: "corridor_4",
      type: "corridor",
      bounds: { x: 4, y: 6, width: 1, height: 1 },
      floor: "cobblestone",
      ceiling: { height: 4.5, texture: "stone_ceiling" }
    },
    {
      id: "corridor_5",
      type: "corridor",
      bounds: { x: 7, y: 3, width: 1, height: 1 },
      floor: "cobblestone",
      ceiling: { height: 4.5, texture: "stone_ceiling" }
    },
    {
      id: "corridor_6",
      type: "corridor",
      bounds: { x: 5, y: 4, width: 4, height: 3 },
      floor: "cobblestone",
      ceiling: { height: 4.5, texture: "stone_ceiling" }
    },
    {
      id: "corridor_7",
      type: "corridor",
      bounds: { x: 1, y: 8, width: 6, height: 1 },
      floor: "cobblestone",
      ceiling: { height: 4.5, texture: "stone_ceiling" }
    }
  ],

  // Walls with properties
  walls: {
    thickness: 0.3,
    height: 5,
    texture: "stone_brick",
    segments: []
  },

  // Doors - SIMPLIFIED to single cubes with proper rotation
  doors: [
    { id: "door_0", x: 4, y: 2, orientation: "horizontal", type: "wooden", locked: false },
    { id: "door_1", x: 2, y: 4, orientation: "vertical", type: "wooden", locked: false },
    { id: "door_2", x: 7, y: 3, orientation: "horizontal", type: "iron", locked: true },
    { id: "door_3", x: 4, y: 6, orientation: "horizontal", type: "wooden", locked: false }
  ],

  // Props/decorations
  props: [
    { id: "torch_0", type: "torch", x: 2, y: 2, rotation: 0, lit: true },
    { id: "torch_1", type: "torch", x: 7, y: 2, rotation: 0, lit: true },
    { id: "barrel_0", type: "barrel", x: 2, y: 6, rotation: 45 },
    { id: "chest_0", type: "chest", x: 8, y: 8, rotation: 0, locked: true }
  ],

  // Lighting
  lighting: {
    ambient: { intensity: 0.3, color: "#4a4a5e" },
    lights: [
      { type: "point", x: 2.5, y: 2, z: 2.5, intensity: 0.7, color: "#ff8844", range: 12 },
      { type: "point", x: 7.5, y: 2, z: 2.5, intensity: 0.7, color: "#ff8844", range: 12 },
      { type: "point", x: 2.5, y: 6, z: 2.5, intensity: 0.5, color: "#4488ff", range: 10 }
    ]
  },

  // Player spawn
  spawn: {
    x: 2.5,
    y: 0,
    z: 2.5,
    rotation: 45
  }
};