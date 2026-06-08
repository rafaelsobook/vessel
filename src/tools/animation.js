
export function playAnim(animationGroups, name, loop = false, reverse = false){
    const anim = animationGroups.find(anim => anim.name.toLowerCase() === name.toLowerCase())
    anim.play(loop)
    // if(anim) {
    //     if(reverse) {
    //         return anim.start(loop, -1)
    //     }
    //     anim.goToFrame(anim.from)
    //     anim.play(loop)
    // }else console.warn("animation not found", name)
}
export function stopAllAnim(animationGroups){
    animationGroups.forEach(anim => anim.stop())
}