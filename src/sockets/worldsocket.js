import { getCharState } from "../charactersystem/characterstate"
import { createCharacter } from "../charactersystem/createcharacter"
import { createMyCharacter } from "../charactersystem/createMyCharacter"
import { attachControllerToThisCharacter } from "../controllers/inputMovement"
import { getGameStatus, getSceneDet } from "../main/main"
import { findPlaceMetaData } from "../states/placestates"
import { attachCam } from "../tools/camera"
import { getSpawnPos } from "../tools/position"

let allPlayersFromTCP = []

let playersOnScene = []
let isSocketOn = false

const log = console.log

export function setSocketOn(_isOn){
    isSocketOn = _isOn
}

export function beginWorldRenderInWorldSocket(scene){
    scene.onBeforeRenderObservable.add(() => {
        if(!isSocketOn) return console.log("socket off");
        if(getGameStatus() === "loading") return console.log("game loading");
        console.log("multiplayer scene running")
    })
}

export function activateOnSocketListeners(socket){
    socket.on("userJoined", allDataFromServer => {
        if (!isSocketOn) return log("socket still not available")
        const { newPlayerName, players } = allDataFromServer
        const characterState = getCharState()
        const gameStat = getGameStatus()
        if (gameStat === "loading") return log("still on loading game state: reject userJoined")

        if (socket === undefined) return console.warn("socket UNDEFINED !")

        log("someone joined ", newPlayerName)

        allPlayersFromTCP = players

        if (!characterState) return log("character state is undefined: reject")
        
        if (gameStat === "running") {
            const { scene } = getSceneDet()
            if (!playersOnScene) return log("allUzers still undefined")
            reCreateMeshesInScene()
        } else {
            console.log("some one joined and is game is not ready")
        }
        log('total players ', playersOnScene.length)
        if (playersOnScene.length) {
            playersOnScene.forEach(pl => log(`${pl.name} in ${pl.currentPlace}`))
        }
    })
    socket.on('removeChar', playerDataFromServer => {
        // if (!isSocketAvailable) return log("socket not available")
        // removeAChar(playerDataFromServer)

        console.log("removing from scene ... ", playerDataFromServer)
    })
}



export function reCreateMeshesInScene() {
    const gameStat = getGameStatus()
    if (gameStat === "loading") return log("still on loading state: reject creating enemy,users,treasurez")

    const characterState = getCharState()
    const sceneDet = getSceneDet()


    allPlayersFromTCP.length && allPlayersFromTCP.forEach(tcpCharDet => {        
        // if (serverHeroData._id === characterState._id) return 

        if (characterState.currentPlace.placeId !== tcpCharDet.currentPlace.placeId) return log(`${tcpCharDet.name} is in place: ${tcpCharDet.currentPlace}. you are in: ${characterState.currentPlace}`)
        
        const isAlreadyHere = playersOnScene.find(plyer => plyer.owner === tcpCharDet.owner)
        if (isAlreadyHere) return log("player already here ", isAlreadyHere.name)


        let player
        if(tcpCharDet.owner === characterState.owner){
            player = createMyCharacter(tcpCharDet)
        }else{
            player = createCharacter(sceneDet.scene, spawnPos, null, tcpCharDet, false)
        }
        pushPlayer(player, tcpCharDet.owner)
    })
}
export function pushPlayer(player, ownerId) {
    console.log(`pushing ${player.name} in playersOnScene`)
    const isAlreadyHere = playersOnScene.find(plyer => plyer.owner === ownerId)
    if (isAlreadyHere) return log("is already here ", isAlreadyHere.name)
    playersOnScene.push(player)
    console.log(`success push: total playersOnScene ${playersOnScene.length}`)
}