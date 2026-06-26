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


export function createBloodParticle(scene,  monsFos, particleType = "sphere", targStop, willDisposeOnStop, emitterMesh){
    const ps = new ParticleSystem("bloodParticle", 30)
    
    if(particleType === "sphere") ps.createSphereEmitter(2,1);
    ps.particleTexture = new Texture("./images/particles/blood.jpg", scene);
    if(monsFos) ps.emitter = new Vector3(monsFos.x,monsFos.y+Math.random()*.4,monsFos.z)
    // if(emitterMesh) ps.emitter = emitterMesh
    // if(willStart) ps.start()
    // if(willDisposeOnStop) ps.disposeOnStop = true;
    ps.targetStopDuration = targStop
    ps.updateSpeed = 0.05;
    ps.minSize = 0.09;
    ps.maxSize = 0.2;
    ps.gravity = new Vector3(0, -.5, 0);
    ps.minAngularSpeed = -Math.PI * 2;
    ps.maxAngularSpeed =  Math.PI * 2;
    ps.minInitialRotation = 0;
    ps.maxInitialRotation = Math.PI/4;
    setTimeout(() => ps.start(), 2000)
    return ps
}
export function createBloodSplatter(scene, pos,burst){
    const capacity = 30
    const ps = buildBloodSystem(scene,
        `blood_${Date.now()}`, capacity, pos ? pos : Vector3.Zero(),
        {
            emitRate: 30,
            maxPower: burst ? 0.55 : 0.32,
            minLife:  0.5,
            maxLife:  burst ? 2.0 : 1.3,
            minSize: 0.25,
            maxSize: 1.50,
        }
    );

    if (burst) {
        ps.manualEmitCount = capacity;
        ps.direction1 = new Vector3(-1.8, 0.4, -1.8);
        ps.direction2 = new Vector3( 1.8, 1.8,  1.8);
    }

    // ps.start();
    // setTimeout(() => ps.start(), 1000)
    // const stopDelay = burst ? 60 : 600;
    // setTimeout(() => ps.stop(), stopDelay);
    // setTimeout(() => ps.dispose(), stopDelay + 3000);

    function play(stopDelay = 1000){
        ps.start()
        setTimeout(() => ps.stop(), stopDelay);
    }

    return { ps, play }
}
function buildBloodSystem(scene, name, capacity, position, opts = {}){
    const ps = new ParticleSystem(name, capacity, scene);
    const bloodTex = new Texture(
        "./images/particles/blood.jpg",
        scene,
        // false,  // noMipmap
        // true,   // invertY
        // BABYLON.Texture.BILINEAR_SAMPLINGMODE,
        // () => {
        //     // Texture is ready — safe to start the auto-demo now
        //     spawnSplatter(new BABYLON.Vector3(0, 0.02, 0));
        // }
    );
    ps.particleTexture = bloodTex;
    ps.emitter = position.clone();

    ps.createSphereEmitter(2, 1);

    ps.minLifeTime  = opts.minLife  ?? 0.6;
    ps.maxLifeTime  = opts.maxLife  ?? 1.4;

    ps.minEmitPower = 0.1;
    // ps.maxEmitPower = opts.maxPower ?? 0.01;
    ps.updateSpeed  = 0.02;

    ps.emitRate = opts.emitRate ?? 1000550;

    ps.minSize = opts.minSize ?? 1;
    ps.maxSize = opts.maxSize ?? 2;

    ps.addSizeGradient(1,   ps.maxSize);
    ps.addSizeGradient(0.5, ps.maxSize * 0.7);
    ps.addSizeGradient(0,   0);

    ps.gravity = new Vector3(0, -1, 0);

    const d = opts.dir ?? new Vector3(0, 1, 0);
    ps.direction1 = new Vector3(d.x - 1.2, d.y + 0.1, d.z - 1.2);
    ps.direction2 = new Vector3(d.x + 1.2, d.y + 0.8, d.z + 1.2);

    ps.addColorGradient(0,   new Color4(0.88, 0.05, 0.05, 1.0));
    ps.addColorGradient(0.3, new Color4(0.65, 0.02, 0.02, 0.85));
    ps.addColorGradient(0.7, new Color4(0.3,  0.01, 0.01, 0.5));
    ps.addColorGradient(1,   new Color4(0.08, 0.0,  0.0,  0.0));

    ps.blendMode = ParticleSystem.BLENDMODE_ADD

    // ps.minAngularSpeed = -Math.PI * 2;
    // ps.maxAngularSpeed =  Math.PI * 2;
    ps.minInitialRotation = 0;
    ps.maxInitialRotation = Math.PI/8;

    return ps;
}