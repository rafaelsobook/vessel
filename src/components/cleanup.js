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
        // setInterval doesn't await/catch its own async callback's returned
        // promise - a throwing/rejecting callbWhenIsClean would otherwise be
        // an unhandled rejection with no trace of which cleanup caused it
        try {
            if(callbWhenIsClean) await callbWhenIsClean()
        } catch(err) {
            console.error("makeSureArraysAreClean: callbWhenIsClean threw", err)
        }
    }, 1000)
}