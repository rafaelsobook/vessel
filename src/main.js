// import javascriptLogo from './javascript.svg'
// import viteLogo from '/vite.svg'
// import { setupCounter } from './counter.js'
// import {startScene} from "./main/main.js"
// first - every glb loads with StandardMaterials (no PBR), so this has to be
// registered before anything loads
import './tools/gltfStandardMaterials.js'
import { showMainPage } from './pages/mainpage.js'

showMainPage()