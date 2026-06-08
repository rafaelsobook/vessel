import './style.css'
// import javascriptLogo from './javascript.svg'
// import viteLogo from '/vite.svg'
// import { setupCounter } from './counter.js'
// import {startScene} from "./main/main.js"
import { showMainPage } from './pages/mainpage.js'
import { checkIfTokenSaved} from "./tools/tools.js"

showMainPage(checkIfTokenSaved())