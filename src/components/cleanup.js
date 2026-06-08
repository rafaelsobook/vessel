import { getCharState } from "../charactersystem/characterstate"
import { getPlayersOnScene } from "../sockets/worldsocket"


export function sceneCleanupReady(scene, controls){
    scene.onDisposeObservable.addOnce(() => {
        controls.dispose()
    })
}

export function makeSureArraysAreClean( callbWhenIsClean ){
    let interval = setInterval(async () => {
        const isImStillHere = getPlayersOnScene().find(plyr => plyr.owner === getCharState().owner)
        if(isImStillHere) return

        clearInterval(interval)
        if(callbWhenIsClean) await callbWhenIsClean()        
    }, 1000)
}