import { ParticleSystem, MeshParticleEmitter, Texture, Vector3, Color4, Color3, PointLight } from "@babylonjs/core"

export function createFireParticles(position, scene) {
    const light = new PointLight("fire_light", new Vector3(position.x, position.y + 0.6, position.z), scene)
    light.diffuse  = new Color3(1.0, 0.4, 0.1)
    light.specular = new Color3(0, 0, 0)
    light.intensity = 1.4
    light.range = 5

    let tick = 0
    scene.registerBeforeRender(() => {
        tick += 0.08
        light.intensity = 1.2 + Math.sin(tick * 4.3) * 0.15 + Math.sin(tick * 7.1) * 0.08
    })

    const particles = new ParticleSystem("fire", 250, scene)
    particles.particleTexture = new Texture("./images/particles/fireTex.png", scene)
    particles.blendMode = ParticleSystem.BLENDMODE_ADD

    particles.emitter = new Vector3(position.x, position.y + 0.25, position.z)
    particles.minEmitBox = new Vector3(-0.12, 0, -0.12)
    particles.maxEmitBox = new Vector3( 0.12, 0,  0.12)

    particles.color1    = new Color4(1.0, 0.7, 0.1, 1.0)
    particles.color2    = new Color4(1.0, 0.2, 0.0, 1.0)
    particles.colorDead = new Color4(0.15, 0.0, 0.0, 0.0)

    particles.minSize = 0.08
    particles.maxSize = 0.28

    particles.minLifeTime = 0.25
    particles.maxLifeTime = 0.65

    particles.emitRate = 120

    particles.direction1 = new Vector3(-0.15, 1.0, -0.15)
    particles.direction2 = new Vector3( 0.15, 2.0,  0.15)

    particles.minEmitPower = 0.4
    particles.maxEmitPower = 0.9
    particles.updateSpeed  = 0.02

    particles.minAngularSpeed = -Math.PI / 6
    particles.maxAngularSpeed =  Math.PI / 6

    particles.start()

    return { particles, light }
}
export function createParticlesForMesh(mesh, scene, textureName = "flare", options = {}) {
    const {
        color1    = new Color4(1.0, 1.0, 1.0, 1.0),
        color2    = new Color4(0.6, 0.6, 1.0, 1.0),
        colorDead = new Color4(0.0, 0.0, 0.3, 0.0),
        minSize   = 0.05,
        maxSize   = 0.18,
        minLife   = 0.3,
        maxLife   = 0.9,
        emitRate  = 80,
        minPower  = 0.3,
        maxPower  = 1.2,
        capacity  = 200,
    } = options

    const particles = new ParticleSystem("mesh_particles", capacity, scene)
    particles.particleTexture = new Texture(`./images/particles/${textureName}.png`, scene)
    particles.blendMode = ParticleSystem.BLENDMODE_ADD

    particles.emitter = mesh

    particles.addSizeGradient(0, 0.6, 0);
    particles.addSizeGradient(0, .7, 0);
    particles.addSizeGradient(0, .7, 0);
    particles.addSizeGradient(0, .7, 0);

    const meshEmitter = new MeshParticleEmitter(mesh)
    meshEmitter.useMeshNormalsForDirection = true
    particles.particleEmitterType = meshEmitter

    particles.color1    = color1
    particles.color2    = color2
    particles.colorDead = colorDead

    particles.minSize = minSize
    particles.maxSize = maxSize

    particles.minLifeTime = minLife
    particles.maxLifeTime = maxLife

    particles.emitRate  = emitRate
    particles.minEmitPower = minPower
    particles.maxEmitPower = maxPower
    particles.updateSpeed  = 0.01

    particles.start()

    return particles
}