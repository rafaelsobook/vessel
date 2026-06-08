import { Mesh, Animation, Vector3 } from "@babylonjs/core"
import * as GUI from "@babylonjs/gui"
import { getSceneDet } from "../main/main.js";
// import itemsToSell from "../staticRecources/toSell.js";

const hitScreen = document.querySelector(".hit-screen")
hitScreen.addEventListener("transitionend", () => {
    hitScreen.classList.remove("screenFadeOff")
    hitScreen.style.display = "none"
    console.log("hitscreen transition ended")
})

export function poppingTextMesh(textToDisplay,color,fontSize, maxPosY,pos, theParent, willAnimate){
    const scene = getSceneDet().scene
    const popTextMesh = Mesh.CreatePlane("poptext", 6, scene);
    popTextMesh.isPickable = false
    popTextMesh.isVisible = true

    popTextMesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    const textureForName = GUI.AdvancedDynamicTexture.CreateForMesh(popTextMesh);

    var text1 = new GUI.TextBlock();
    text1.text = textToDisplay
    text1.color = color
    text1.fontSize = fontSize ? fontSize : 90;
    text1.width = 100
    text1.thickness = 2

    textureForName.addControl(text1);    
    if(theParent) popTextMesh.parent = theParent
    popTextMesh.position.x =pos.x
    popTextMesh.position.y =pos.y
    popTextMesh.position.z =pos.z

    const textMeshPopAnim = new Animation("popTextAnimation", "position.y", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);

    popTextMesh.animations = []
    popTextMesh.animations.push(textMeshPopAnim);
    textMeshPopAnim.setKeys([
        {frame: 0,value: pos.y},
        {frame: 20,value: pos.y+maxPosY},
        {frame: 30,value: pos.y+maxPosY/2},
    ]);
    if(willAnimate){
        scene.beginAnimation(popTextMesh, 0, 30, false, 2, ()=>{
            setTimeout(() => {
                if(popTextMesh) popTextMesh.dispose()
                if(text1) text1.dispose()
                // textMeshPopAnim.dispose()
            }, 500 + Math.random()*500)
        });
    }

    
    return popTextMesh
}
export function createHpBar(posY, theId, parentMesh, hp, maxHp){
    const hpmesh = Mesh.CreatePlane(`enemyhpmesh.${theId}`, 3);
    hpmesh.position.y = posY;
    hpmesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    const advancedTexture = GUI.AdvancedDynamicTexture.CreateForMesh(hpmesh);

    
    var hpbar = new GUI.Rectangle();
    hpbar.width = `${Math.floor(hp/maxHp) * 100 * 3}px`;
    hpbar.height = "40px";
    hpbar.cornerRadius = 20;
    // hpbar.color = "white";
    // hpbar.thickness = 2;
    hpbar.background = "red";
    hpbar.alpha = 0.7;
    advancedTexture.addControl(hpbar);
    hpmesh.parent = parentMesh

    hpmesh.isPickable = false
    hpbar.isPickable = false
    return {hpbar, hpmesh}
}
export function createIcon(iconName, GUI, parentPanelOrDynamicTex, cb){
    const {Image, Button} = GUI

    const button = Button.CreateImageWithCenterTextButton('button', '');
    button.width = '40px';
    button.height = '40px';
    button.thickness = 0;

    const image = new Image('icon', `./images/UI/${iconName}.png`);
    console.log(image)
    // Add the image to the button's content
    button.addControl(image);

    button.onPointerUpObservable.add(() => cb());
    parentPanelOrDynamicTex.addControl(button)
    return button
}
export function createGUIbtn(GUI, btnDetails){
    const {width,height,color,background,pt,btnName,label} = btnDetails
    var btn = GUI.Button.CreateSimpleButton(btnName, label);
    btn.width = width
    btn.height = height
    btn.color = color
    btn.background = background
    btn.paddingTop = pt
    return btn
}
export function createPanel(GUI, panelDet, isLeft, DynamicTexture, isNotVertical) {
    const {width,height,background,pt,panelName} = panelDet
    const panel = new GUI.StackPanel(panelName)
    if(width)panel.width = width
    if(height)panel.height = height
    panel.horizontalAlignment = isLeft ? GUI.Control.HORIZONTAL_ALIGNMENT_LEFT : GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT
    if(background) panel.background = background
    panel.paddingTop = pt
    panel.paddingBottom = pt

    panel.isVertical = isNotVertical ? false : true
    DynamicTexture && DynamicTexture.addControl(panel)

    return panel;
}
export function createTextBlock(GUI, textDetails, parent){
    const {height, color, text} = textDetails
    const textBlock = new GUI.TextBlock();
    textBlock.text = text;
    textBlock.color = color
    textBlock.height = height
    parent && parent.addControl(textBlock);   
    return textBlock  
}
export function inputField(GUI, inputFieldDetails, AdvancedDynamicTexture){
    const {width,height,background, color,label} = inputFieldDetails
    const input = new GUI.InputText();
    input.width = width
    input.height = height
    // input.text = label
    input.placeholderText = label
    input.color = color
    input.background = background
    input.focusedBackground = background
    
    input.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER; // Set text alignment to center

    // Add input field to GUI
    AdvancedDynamicTexture.addControl(input);
    return input
}


// HTML CSS UI TOOL
export function setLoadingInAList(listElement, caption){
    listElement.innerHTML = `<p class="loading-p">${caption}</p>`
}
export function createElement(htmltag, className, innerHtml){
    const elem = document.createElement(htmltag)
    elem.className = className
    if(innerHtml) elem.innerHTML = innerHtml
    return elem
}

export function showHitScreen(durationToVanish, _color){
    let color = _color ? _color : "black"
    let shadow = `inset 0 0 1000px 150px ${color};`
    hitScreen.style.display="block"
    hitScreen.style.boxShadow = shadow
    setTimeout(() => {
        if(!hitScreen.className.includes("screenFadeOff")) {
            hitScreen.classList.add("screenFadeOff")
        }
    }, durationToVanish ? durationToVanish : 1000)
}

