import * as GUI from "@babylonjs/gui"

export function createColorPicker(UITexture, callb){
    const picker = new GUI.ColorPicker();
    // picker.value = hairMat.diffuseColor;
    picker.height = "150px";
    picker.width = "150px";
    picker.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    picker.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP

    picker.onValueChangedObservable.add(function(value) {
        const {r,g,b} = picker.value
        

        callb(value)
    });

    UITexture.addControl(picker)
    return picker
}