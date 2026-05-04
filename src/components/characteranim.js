export function playAnim(anims, name, loop = false) {
    if(!anims || anims.length === 0) return;
    const anim = anims.find(a => a.name === name);
    if (anim) anim.play(loop);
}
export function stopAnim(anims, name) {
    if(!anims || anims.length === 0) return;
    const anim = anims.find(a => a.name === name);
    if (anim) anim.stop();
}