import { Vector3} from "@babylonjs/core"
import { sessionStorageName} from "../constants/constants"
const allUI = document.querySelectorAll(".cont")


export const apiOpt = (meth, toPost, token) => {
    if(!toPost){
        return {
            method: meth, // *GET, POST, PUT, DELETE, etc.
            mode: 'cors', // no-cors, *cors, same-origin
            cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
            credentials: 'same-origin', // include, *same-origin, omit
            headers: {
            'authori': token ? `fawad ${token}` : '',
            'Content-Type': 'application/json'
            // 'Content-Type': 'application/x-www-form-urlencoded',
            },
            redirect: 'follow', // manual, *follow, error
            referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
        }
    }else{
        return {
            method: meth, // *GET, POST, PUT, DELETE, etc.
            mode: 'cors', // no-cors, *cors, same-origin
            cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
            credentials: 'same-origin', // include, *same-origin, omit
            headers: {
            'authori': token ? `fawad ${token}` : '',
            'Content-Type': 'application/json'
            // 'Content-Type': 'application/x-www-form-urlencoded',
            },
            redirect: 'follow', // manual, *follow, error
            referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
            body: toPost ? JSON.stringify(toPost) : ''
        }
    }    
}
export async function useFetch(address, meth, tok, theBody){
    try{
        const response = await fetch(address, apiOpt(meth, theBody, tok))
        if(!response) return "response error"
        const data = await response.json()
        return data
    }catch(err){
        return
    }
}
export function pFloat(number){
    return parseFloat(number.toFixed(3))
}
export function deltaT(scene){
    return scene.getEngine().getDeltaTime()
}
export function checkIfTokenSaved(){
    const details = JSON.parse(sessionStorage.getItem(sessionStorageName))
    if(!details) {
        sessionStorage.clear()
        return false
    }
    
    return details
}

export function rotateAnim(dirTarg, body, rotationAnimation, scene, spdRatio){
    var diffX = dirTarg.x - body.position.x;
    var diffY = dirTarg.z - body.position.z;
    const angle = Math.atan2(diffX,diffY)
  
    let angleDifference = angle - body.rotation.y;
    // Ensure the angle is within the range [-π, π]
    if (angleDifference > Math.PI) {
    angleDifference -= 2 * Math.PI;
    } else if (angleDifference < -Math.PI) {
    angleDifference += 2 * Math.PI;
    }
    const targetAngle = body.rotation.y + angleDifference
    
    rotationAnimation.setKeys([
        { frame: 0, value: body.rotation.y },
        // { frame: 20, value:  angle/3},
        { frame: 60, value: targetAngle}
    ]);
    body.animations[0] = rotationAnimation
    scene.beginAnimation(body, 0, 60, false,spdRatio ? spdRatio : 4);
}
export function setBtnsPointerAndVisibility(_btnsElems, _isVisible){
    _btnsElems.forEach(btnelem => {
        btnelem.style.pointerEvents =_isVisible ? "visible" :  "none"
        btnelem.style.opacity = _isVisible ? "1" : ".8"
    })
}
export function setDisplayOfElements(_arrayOfElem, displayName){
    _arrayOfElem.forEach(elem => elem.style.display= displayName)
}
export function setDisplayElem(className, displayName){
    document.querySelector(`.${className}`).style.display=displayName
}
export function setDisplayALl(_displayName){    
    allUI.forEach(tagg=> tagg.style.display=_displayName)
}
export function randomNum(){
    return `${Math.random().toLocaleString().split(".")[1]}${Math.random().toLocaleString().split(".")[1]}`
}
export function randomNumMinMax(_min, _max){   
    const num = Math.random()*_max
    return Math.floor(num)
}
export function getNumUntil(_maxNumber){
    return Math.round(Math.random()*_maxNumber)
}
export function setPointerClickable(_element, pointerEvent, timeout){
    // pointerEvent 'visible || none'
    _element.style.pointerEvents = pointerEvent

    timeout && setTimeout(() => _element.style.pointerEvents="visible" ,timeout)
}
export function setAnimSpeed(anims, animName, spd){
    anims.forEach(anim => {
        if(anim.name === animName) anim.speedRatio = spd
    })
}
export function playAnimWithCallback(anims, animName, isLooping, callbackAfterEnd, stopAndPlay){
    let prevAnim
    let currentAnim
    anims.forEach(anim => {
        if(anim.isPlaying) prevAnim = anim
        if(anim.name === animName) currentAnim = anim
    })
    // if(scene){
    //     if(currentAnimation || newAnimation){
    //         BABYLON.Animation.TransitionTo(
    //             currentAnimation,
    //             newAnimation,
    //             .5,
    //             scene,
    //             1
    //         )
    //     }
    // }
    // currentAnimation && console.log(currentAnimation.name)
    anims.forEach(anim => {
        if(anim.name === animName){
            if(!stopAndPlay) anim.stop()
            anim.play(isLooping)
            if(callbackAfterEnd){
                anim.onAnimationEndObservable.addOnce((evntData, evntState)=>{
                    callbackAfterEnd()               
                })
            }
        }
    })
    return currentAnim
}
export function stopAnim(anims, animName, isStopAll){
    anims.forEach(anim => isStopAll ? anim.stop() : anim.name === animName && anim.stop())
}

export function lookAt(body, targetPos){

    const dx = targetPos.x - body.position.x
    const dz = targetPos.z - body.position.z
    body.rotation.y = Math.atan2(dx, dz)
}
export function disposeMesh(mesh){
    if(!mesh) return 
    if(mesh.actionManager){
        mesh.actionManager.dispose()
        mesh.actionManager = null
    }
    mesh.dispose()
}
export function createElement(elementType, className, _innerHtml){
    const elem = document.createElement(elementType)
    elem.className = className

    if(_innerHtml) elem.innerHTML=_innerHtml
    return elem
}
export function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
export function createFile(blob, fileName){
    const file = new File([blob], fileName, {
        type: blob.type,
        lastModified: Date.now(),
    });
    return file
}
export function getMeshPos(_mesh){
    const {x,y,z} = _mesh.position
    return {x,y,z}
}
// Coroutines
export function *animationBlend(from, to){
    let nw = 0
    let cw = 0
    to.play(true)

    while(nw < 1){
        nw+=0.1
        cw-=0.1
        from.setWeightForAllAnimatables(cw)
        to.setWeightForAllAnimatables(nw)
        yield
    }
}