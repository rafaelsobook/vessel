import * as GUI from "@babylonjs/gui"

export function createColorPicker(UITexture, callb){
    const picker = new GUI.ColorPicker();
    // picker.value = hairMat.diffuseColor;
    picker.height = "150px";
    picker.width = "150px";
    // a phone on its side: no more than about a third of the screen's height,
    // so it stays clear of the gender and name controls under it (the
    // creator's short-screen layout in style.scss)
    picker.onBeforeDrawObservable.add(() => {
        const size = Math.min(150, Math.round(UITexture.getSize().height * 0.36))
        if (picker.widthInPixels !== size) {
            picker.width = `${size}px`
            picker.height = `${size}px`
        }
    })
    picker.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    picker.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP

    picker.onValueChangedObservable.add(function(value) {
        const {r,g,b} = picker.value
        

        callb(value)
    });

    UITexture.addControl(picker)
    return picker
}