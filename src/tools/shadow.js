import { ShadowGenerator } from '@babylonjs/core';

/**
 * Creates a ShadowGenerator attached to a directional or spot/point light.
 * @param {BABYLON.IShadowLight} light  - the light that casts shadows
 * @param {number}               mapSize - shadow map resolution (512, 1024, 2048)
 * @returns {BABYLON.ShadowGenerator}
 */
export function createShadowGenerator(light, mapSize = 1024) {
    const sg = new ShadowGenerator(mapSize, light);
    sg.useBlurExponentialShadowMap = true;
    sg.blurKernel = 16;
    return sg;
}

/**
 * Registers a mesh as a shadow caster on the given generator.
 * @param {BABYLON.ShadowGenerator} shadowGenerator
 * @param {BABYLON.Mesh}            mesh
 * @param {boolean}                 includeChildren - also register child meshes
 */
export function addShadowCaster(shadowGenerator, mesh, includeChildren = true) {
    shadowGenerator.addShadowCaster(mesh, includeChildren);
}

/**
 * Makes a mesh receive shadows (writes shadow darkness onto its surface).
 * @param {BABYLON.Mesh} mesh
 */
export function addShadowReceiver(mesh) {
    mesh.receiveShadows = true;
}

/**
 * Registers an array of meshes as both casters and receivers in one call.
 * @param {BABYLON.ShadowGenerator} shadowGenerator
 * @param {BABYLON.Mesh[]}          meshes
 */
export function regShadowMeshes(shadowGenerator, meshes, isReceivingShadow = false) {
    meshes.forEach(mesh => {
        shadowGenerator.addShadowCaster(mesh, true);
        mesh.receiveShadows = isReceivingShadow;
    });
}
