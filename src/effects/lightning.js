import {
    Vector3, Matrix, Color3, TransformNode, PointLight, StandardMaterial, MeshBuilder, Mesh,
} from "@babylonjs/core"
import { addGlow } from "../tools/glow.js"
import { randNum } from "../tools/random.js"

const LIGHTNING_COLORS = {
    yellow: new Color3(0.9, 0.9, 0.25),
    white:  new Color3(1.0, 1.0, 1.0),
    blue:   new Color3(0.2, 0.8, 1),
    cyan:   new Color3(0.25, 0.95, 1.0),
    purple: new Color3(0.65, 0.25, 1.0),
    violet: new Color3(0.65, 0.25, 1.0),
    red:    new Color3(1.0, 0.2, 0.15),
    green:  new Color3(0.3, 1.0, 0.35),
    orange: new Color3(1.0, 0.55, 0.1),
}

function resolveLightningColor(color) {
    if (color instanceof Color3) return color
    if (typeof color === "string" && color[0] === "#") return Color3.FromHexString(color)
    return LIGHTNING_COLORS[color] ?? LIGHTNING_COLORS.yellow
}

// Plain StandardMaterial + emissiveColor is the combo GlowLayer is built for.
// (GreasedLine's own plugin material was tried first, but GlowLayer builds its
// glow-map shader from scratch and never runs a material plugin's custom vertex
// code, so a GreasedLine ribbon's shape never made it into the glow pass at all.)
function applyLightningGlow(mat, color) {
    mat.emissiveColor = color
    mat.disableLighting = true
    return mat
}

export function createLightningGlowMaterial(scene, color = "yellow") {
    const lightningColor = resolveLightningColor(color)
    const mat = new StandardMaterial("lightningGlowMat_" + Date.now(), scene)
    mat.diffuseColor = Color3.Black()
    mat.specularColor = Color3.Black()
    return applyLightningGlow(mat, lightningColor)
}

// Local-space bounding box, computed via the world-matrix inverse so it works
// for a single mesh (blade) AND a multi-child root (createWeapon's TransformNode)
// without caring how the hierarchy is scaled/rotated underneath.
function getLocalBoundingBox(mesh) {
    let min = Vector3.Zero()
    let max = Vector3.Zero()
    try {
        const vectors = mesh.getHierarchyBoundingVectors(true)
        min = vectors.min
        max = vectors.max
    } catch {
        // no geometry yet - fall through to the fallback box below
    }

    const invWorld = Matrix.Invert(mesh.getWorldMatrix())
    const corners = [
        new Vector3(min.x, min.y, min.z), new Vector3(max.x, min.y, min.z),
        new Vector3(min.x, max.y, min.z), new Vector3(max.x, max.y, min.z),
        new Vector3(min.x, min.y, max.z), new Vector3(max.x, min.y, max.z),
        new Vector3(min.x, max.y, max.z), new Vector3(max.x, max.y, max.z),
    ]

    const localMin = new Vector3(Infinity, Infinity, Infinity)
    const localMax = new Vector3(-Infinity, -Infinity, -Infinity)
    for (const corner of corners) {
        const p = Vector3.TransformCoordinates(corner, invWorld)
        localMin.minimizeInPlace(p)
        localMax.maximizeInPlace(p)
    }

    if (!isFinite(localMin.x) || Vector3.Distance(localMin, localMax) < 0.01) {
        return { min: new Vector3(-0.5, -0.5, -0.5), max: new Vector3(0.5, 0.5, 0.5) }
    }
    return { min: localMin, max: localMax }
}

// Random point pinned to one face of the box (with a small outward push) so
// arcs read as crackling over the mesh's surface instead of floating through it.
function pickSurfacePoint(min, max, size) {
    const axes = ["x", "y", "z"]
    const key = axes[Math.floor(Math.random() * 3)]
    const p = new Vector3(randNum(min.x, max.x), randNum(min.y, max.y), randNum(min.z, max.z))
    const onMax = Math.random() < 0.5
    p[key] = onMax ? max[key] : min[key]
    p[key] += (size[key] || 0.1) * 0.08 * (onMax ? 1 : -1)
    return p
}

function pickArcEndpoints(min, max, size) {
    const minDist = Math.max(size.length() * 0.2, 0.05)
    let a, b, tries = 0
    do {
        a = pickSurfacePoint(min, max, size)
        b = pickSurfacePoint(min, max, size)
        tries++
    } while (Vector3.Distance(a, b) < minDist && tries < 6)
    return [a, b]
}

// Classic anchored-bolt jitter: interior points get pushed sideways with a
// sin() envelope so the ends stay pinned to the surface and the middle whips.
function buildBoltPath(start, end, segments, jitterAmount) {
    const path = []
    for (let i = 0; i <= segments; i++) {
        const t = i / segments
        const p = Vector3.Lerp(start, end, t)
        if (i !== 0 && i !== segments) {
            const envelope = Math.sin(t * Math.PI)
            p.x += (Math.random() - 0.5) * jitterAmount * envelope
            p.y += (Math.random() - 0.5) * jitterAmount * envelope
            p.z += (Math.random() - 0.5) * jitterAmount * envelope
        }
        path.push(p)
    }
    return path
}

// Tube radius per path point: pinched to a near-zero point at the two tips
// (so the ends read as pointed, not a flat/boxy cut) and bulging out to
// maxWidth in the middle via the same sin() envelope as the jitter.
function makeRadiusFunction(segments, width, maxWidth) {
    const tipRadius = width * 0.15
    return (i) => {
        if (i === 0 || i === segments) return tipRadius
        const t = i / segments
        const bulge = Math.sin(t * Math.PI)
        return width + (maxWidth - width) * bulge
    }
}

export function attachLightning(scene, mesh, color = "yellow", weaponGlow = false, options = {}) {
    if (!scene || !mesh) return null

    const {
        arcCount = 2,
        segments = 7,
        width = 0.02,
        maxWidth = width * 1.6,
        tessellation = 5,
        updateInterval = 90,
        glowIntensity = 1.2,
        withLight = true,
    } = options

    const lightningColor = resolveLightningColor(color)
    const { min, max } = getLocalBoundingBox(mesh)
    const size = max.subtract(min)
    const jitterAmount = ((size.x + size.y + size.z) / 3) * 0.35
    const radiusFunction = makeRadiusFunction(segments, width, maxWidth)

    const root = new TransformNode(`lightning_${mesh.name || "mesh"}_${Date.now()}`, scene)
    root.parent = mesh

    // one shared material for every arc - matches createWeapon's glowing-parts pattern
    const arcMat = new StandardMaterial(`${root.name}_mat`, scene)
    arcMat.diffuseColor = Color3.Black()
    arcMat.specularColor = Color3.Black()
    applyLightningGlow(arcMat, lightningColor)
    if(weaponGlow){
        if(mesh.getChildMeshes()){
            mesh.getChildMeshes().forEach(swrd => {
                swrd.material = arcMat
                addGlow(scene, swrd, glowIntensity)
            }) 
        }else{
            mesh.material = arcMat
            addGlow(scene, mesh, glowIntensity)
        }
    }

    const arcs = []
    for (let i = 0; i < arcCount; i++) {
        const [start, end] = pickArcEndpoints(min, max, size)
        const path = buildBoltPath(start, end, segments, jitterAmount)

        const tube = MeshBuilder.CreateTube(`${root.name}_arc${i}`, {
            path, radiusFunction, tessellation, cap: Mesh.CAP_ALL, updatable: true,
        }, scene)
        tube.parent = root
        tube.isPickable = false
        tube.material = arcMat
        addGlow(scene, tube, glowIntensity)

        arcs.push(tube)
    }

    let light = null
    if (withLight) {
        light = new PointLight(`${root.name}_light`, min.add(max).scale(0.5), scene)
        light.parent = root
        light.diffuse = lightningColor
        light.specular = Color3.Black()
        light.range = Math.max(size.x, size.y, size.z, 1) * 2.5
        light.intensity = 0.6
    }

    let acc = 0
    const observer = scene.onBeforeRenderObservable.add(() => {
        acc += scene.getEngine().getDeltaTime()
        if (acc < updateInterval) return
        acc = 0

        for (const tube of arcs) {
            const [start, end] = pickArcEndpoints(min, max, size)
            const path = buildBoltPath(start, end, segments, jitterAmount)
            MeshBuilder.CreateTube(tube.name, { path, radiusFunction, instance: tube }, scene)
        }
        if (light) light.intensity = 0.4 + Math.random() * 0.5
    })

    function dispose() {
        scene.onBeforeRenderObservable.remove(observer)
        for (const tube of arcs) {
            if (tube._glowLayer) tube._glowLayer.removeIncludedOnlyMesh(tube)
            tube.dispose()
        }
        arcMat.dispose()
        if (light) light.dispose()
        root.dispose()
    }

    mesh.onDisposeObservable.addOnce(dispose)

    return { root, arcs, light, dispose }
}
