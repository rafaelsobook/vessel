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
// checks against this placeId and looks it up client-side via terrainHeight()
export const OPENWORLD_PLACE_ID = 888