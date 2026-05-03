export function playAnim(anims, name, loop = false) {
    const anim = anims.find(a => a.name === name);
    if (anim) anim.play(loop);
}
export function stopAnim(anims, name) {
    const anim = anims.find(a => a.name === name);
    if (anim) anim.stop();
}