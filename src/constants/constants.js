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