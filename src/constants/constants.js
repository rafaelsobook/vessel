export const sessionStorageName = "dungeonwar_account"
// export const multiplayerScenes = ['wisemanVillage', 'church']
export const heroLocalStorageName = "msorHeroDet"
// dev/prod-specific values live in .env.development / .env.production -
// "npm run dev" loads localhost, "npm run prod" loads the onrender.com URLs
export const webSocketURL = import.meta.env.VITE_WS_URL
export const APIURL = import.meta.env.VITE_API_URL
// webSocketURL is a ws(s):// URL meant for socket.io - plain fetch() needs
// http(s):// instead, so this derives the equivalent for REST calls to the
// tcp server (e.g. the public /status endpoint)
export const tcpHttpURL = webSocketURL.replace(/^wss:/, "https:").replace(/^ws:/, "http:")
// export const validGatePlaces = ['afterWarScene', 'wisemanVillage', 'ogresforest']

export const avatarGlBpath = "./models/avatar/avatar.glb"

// localroomdb.js's placeId for the procedural infterrain openworld area - the
// tcp server has no notion of terrain height (enemyDetails.ts/genenemy.ts
// hardcode y:0), so anything needing real ground height on uneven terrain
// checks against this placeId and looks it up client-side via
// sampleTerrainSurfaceHeight() (see OPENWORLD_TERRAIN_VERTS below)
export const OPENWORLD_PLACE_ID = 888

// must match the `verts` option passed to infterrain's own createOpenWorld()
// call (areascene.js) - infterrain exports two different height functions:
// terrainHeight(x,z) is the exact analytical noise height at that precise
// point, while the actual rendered chunk mesh only samples that same
// formula at a coarse verts-by-verts grid per chunk and linearly
// interpolates the triangles in between (infterrain's own Oe/chunk-builder).
// On bumpy ground those two disagree - an enemy snapped to the exact
// analytical height often doesn't match where the coarser, interpolated
// mesh surface actually is, so it visibly floats or sinks depending on
// which side of the local noise wave it landed on. sampleTerrainSurfaceHeight
// (x, z, verts) bilinearly interpolates over the exact same grid the mesh
// itself was built from, matching the visible surface instead of the ideal
// curve - see createEnemy.js/renderer.js, both use this constant with it.
// 17, not 12. The comment above states the rule - "must match the `verts`
// option passed to infterrain's own createOpenWorld() call" - and it was being
// broken: areascene.js builds the terrain with verts:17 while everything that
// needed a ground height asked for 12.
//
// That is not a small discrepancy. sampleTerrainSurfaceHeight derives its
// sample grid as CHUNK_SIZE / (verts - 1), so 12 gives a 23.27-unit step and
// 17 gives 16.0 - two completely different grids interpolating two different
// surfaces. Measured over 8000 random openworld points, the mismatch put the
// sampled height an average of 0.46 units off the real mesh surface, worst
// case 3.72 units (two and a half body heights), and BELOW the real surface
// at 49% of points. That is exactly the reported symptom: enemies and bots
// standing buried in the ground about half the time.
//
// areascene.js now passes this constant to createOpenWorld and
// createOpenWorldGrass rather than repeating a literal, so the three can no
// longer drift apart again.
export const OPENWORLD_TERRAIN_VERTS = 17

// Zerech's travel fare (npcDetails.js's "120_zerech" / constants/zerechdata.js)
// - flat, any tower. Shared here because two files need the same number:
// his speech quotes it and his dialogue charges it, and a price that lived in
// both would drift the first time someone tuned one and not the other.
export const ZERECH_FARE = { coinType: "bronze", pieces: 20 }
