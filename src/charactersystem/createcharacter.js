import { 
    Vector3, 
    Quaternion, 
    MeshBuilder,
    PhysicsAggregate,
    PhysicsShapeType,
    PBRMaterial,
    Texture,
    Color3
} from '@babylonjs/core';

import { getGameStatus, getSceneDet } from '../main/main';
import { createTextMesh } from '../gui/textmesh';
import { createAggregate } from '../tools/physics';
import { createColorMat, createMatV2 } from '../tools/materials';
import { SKIN_TEXTURES } from '../constants/skinColors';
import { getPlayersOnScene, getSocketContainers } from '../sockets/worldsocket';
import { createWeapon } from '../assetcreation/createweapon';
import { pFloat } from '../tools/tools';
import { createBloodParticle, createBloodSplatter, createCustomizedSmoke } from '../tools/particlesystem';
import { CharacterAnimations } from '../tools/animation';
import { createMesh, putFakeShadow } from '../creations/creationTools';
import { createMetalMat } from '../tools/metalmat';
import { attachLightning } from '../effects/lightning';

export let capsuleHeight = 1.5;
let capsuleRadius = 0.25;

export function showHideSword(swordTNode, isVisible){
    swordTNode.getChildMeshes().forEach(mesh => mesh.isVisible = isVisible)
}
export function showHideEquip(equipMesh, isVisible){
    equipMesh.isVisible = isVisible
    equipMesh.getChildMeshes().forEach(mesh => mesh.isVisible = isVisible)
}
export function getPlayerCoord(ownerId){
    const player = getPlayersOnScene().find(pl => pl.owner === ownerId)
    if(!player) return false;
    const pos = player.body.position.clone();
    const forward = player.body.getDirection(Vector3.Forward())
    const dirTarg = player.body.position.add(forward)
    return {
        pos:     { x: pFloat(pos.x),     y: pFloat(pos.y),     z: pFloat(pos.z)     },
        dirTarg: { x: pFloat(dirTarg.x), y: pFloat(dirTarg.y), z: pFloat(dirTarg.z) },
        mode: player.mode
    }
}

function createAnimeBodyMaterials(scene, det){
    const { hairColor, clothColor, pantsColor, skinColor } = det
    
    const hairMat = createColorMat("hair_mat", hairColor , scene)
    // female's "hair2" style only (femaile.hair1/female.hair2 - see
    // createAnimeBody's own FEMALE_ONLY_NAMES comment) - a separate material
    // from the shared hairMat above since createColorMat's own bumpTexture
    // param would otherwise apply this same strand texture to every mesh
    // using hairMat (male hair, scalp, female's hair1 too), not just this
    // one style
    const femaleHair2Mat = createColorMat("hair_mat_f2", hairColor, scene, "./images/textures/girlhair/hairstyle2.webp")
    const clothMat = createMatV2(scene, false, "./images/fabrics/fabric4normal.jpg")
    const pantsMat = createMatV2(scene, false, "./images/fabrics/fabric4normal.jpg")
    const bootsMat = createMatV2(scene, "./images/fabrics/leather1.jpg", "./images/fabrics/leather1.jpg")
    
    clothMat.diffuseColor = new Color3(clothColor.r, clothColor.g, clothColor.b)
    pantsMat.diffuseColor = new Color3(pantsColor.r, pantsColor.g, pantsColor.b)

    // the shirt hem and pants waistband are two separate meshes sitting
    // almost exactly coincident at the waist/lower back (see the source
    // rig - cloth.X and pants.X below) - close enough that the depth
    // buffer can't reliably tell which one is actually in front, so the
    // pants texture randomly wins and shows through the shirt there
    // (classic z-fighting, not an actual clipping/scale problem). zOffset
    // is Babylon's standard fix for exactly this: it biases the DEPTH TEST
    // only, not the mesh's real position, so the shirt wins every depth
    // comparison against the pants without visually moving either mesh.
    // Negative pushes toward the camera; cloth gets a small bias so it
    // always wins, pants gets none.
    clothMat.zOffset = -2

    // skinColor is a SKIN_TEXTURES key ("skin1" etc, see npcDetails.js and
    // setupcharacterscene.js) - falls back to skin1 for any character saved
    // before this switch from flat diffuseColor to textures (those still
    // carry the old {r,g,b} shape, which won't match a SKIN_TEXTURES key).
    const skinTexPath = SKIN_TEXTURES[skinColor] ?? SKIN_TEXTURES.skin1
    // PBRMaterial here, not createMat's plain StandardMaterial - createnpc.js's
    // own NPCs render their skin through a PBRMaterial straight off their glb
    // (metallic-roughness workflow, tuned with environmentIntensity/
    // directIntensity below), and a StandardMaterial is a genuinely different
    // shader/lighting model, not just a different color setting - the same
    // exact skin texture visibly mismatches an NPC's skin under identical
    // scene lighting no matter how its diffuseColor/emissiveColor is tuned.
    // Building this one material the same way NPCs' skin already is removes
    // that mismatch at the source instead of chasing it with color hacks.
    const skinMat = new PBRMaterial("skin_mat", scene)
    skinMat.albedoTexture = new Texture(skinTexPath, scene)
    // skin is a non-metal, mostly-matte surface - no metallic sheen, no sharp
    // specular highlight
    skinMat.metallic = 0
    skinMat.roughness = 1
    // same three knobs createnpc.js sets on every NPC's own PBRMaterial -
    // keeping these identical is what actually makes the two match under the
    // same scene lighting, not just "using PBRMaterial" in isolation
    skinMat.environmentIntensity = 0.3
    skinMat.directIntensity = 1
    skinMat.emissiveIntensity = 0

    return {
        hairMat,
        femaleHair2Mat,
        clothMat,
        pantsMat,
        skinMat,
        bootsMat
    }
}

export function createCharacter(scene, spawnPos, det, usePhysics, isNpc = false){
    const isMeshCreated = scene.getMeshByName(`player.${det.ownerId}`)
    if(isMeshCreated){
        return false
    }
    let swordMeshes = []
    let helmetMeshes = []
    let gauntletMeshes = []
    let pauldronMeshes = []
    let hasWeapon = false

    const { mode, _moving, _minning } = det

    const {body, bodytarget, camParent, aggregate} = createCapsuleBody(scene, det, spawnPos, det.owner, usePhysics)

    let fakeShadowRoot = scene.getMeshByName("fakeShadow")

    const fshadow = fakeShadowRoot ? putFakeShadow(body, fakeShadowRoot, 1, -capsuleHeight / 2 + 0.02) : null
    // npcs never reach a code path that grants/activates skills, and auraz isn't
    // even part of the isNpc return value below - two 8000-capacity particle
    // systems were getting built and immediately stopped for every single npc
    // spawned, for nothing. Skip it entirely for them.
    const auraz = isNpc ? null : createBodyAura(det, scene, body)

    if(!isNpc){
        // det.skills is normally the player's own array of equipped skills
        // (flexaura among them) - but createFighterNpc (npc/createnpc.js)
        // also takes this !isNpc branch for a duel opponent, and
        // npcDetails.js's own fighter entries (e.g. Renarden) use a
        // completely different skills shape there: {basic, seriousSkill,
        // hiddenSkill} keyed by combat tier, not an array. .find() on that
        // object threw synchronously (no .find method), which silently
        // killed the whole scene-load promise chain before it ever reached
        // scene.whenReadyAsync()/hid the loading screen - see duelSystem.js's
        // own trace logging that caught this. A fighter has no flexaura
        // concept anyway, so skipping cleanly here is correct, not just safe.
        const auraSkill = Array.isArray(det.skills) ? det.skills.find(skl => skl.name === "flexaura") : undefined
        if(auraSkill && auraSkill.isActive) auraz.start()
    }

    const containers = getSocketContainers()

    const {root, animationGroups, rHand, belts, cloaks, 
        armors, boots, spineBone, headBone, lowerArmL, lowerArmR, 
        shoulderL, shoulderR, characterHair} = createAnimeBody(containers, body, bodytarget, det, scene)

    const nameMesh = createTextMesh(scene, body, det.name, "white", {x:0,y: capsuleHeight,z:0}, 30);
    const weaponSocket = createMesh(scene, `weaponsocket.${det.owner}`, {size: 0.5},
    {x:0.8, y:2, z: 1}, 1, false, true, {x: -Math.PI/2 + (Math.PI/10), y:Math.PI/2, z:0.2 })

    weaponSocket.isPickable = false
    weaponSocket.parent = spineBone;
    weaponSocket.addRotation(0,Math.PI/17,0)



    function createSword(swordName, parts, parentMesh, weaponType = "sword", metalColor) {
        // parts drives sword's blade/guard/handle/pommel rebuild, metalColor
        // drives every other weaponType's single mesh (see createweapon.js) -
        // an item only ever has one or the other, never both
        const sword = createWeapon(scene, weaponType, {x: 0.1, y: 0.5, z: 0}, parentMesh, swordName, {...parts, metalColor})
        const toPush = {name: swordName, mesh: sword}
        // attachLightning(scene, sword, "violet", true)
        swordMeshes.push(toPush)
        showHideSword(sword, true)
        hasWeapon = true
        return toPush
    }

    function equipBoots(itemName) {
        if(!itemName) return
        boots.forEach(boot => {
            if(boot.name === itemName){
                boot.mesh.isVisible = true
            } else boot.mesh.isVisible = false
        })
    }

    function createHelmet(helmetName, metalColor, itemName) {
        const template = containers.helmets.find(msh => msh.name.split(".")[1] === helmetName)
        if(!template) return console.warn(`createHelmet: missing helmet "${helmetName}"`)
        const helmet = template.clone(`helmet.${helmetName}.${det._id}`)
        helmet.parent = headBone
        helmet.rotationQuaternion = Quaternion.Identity()
        helmet.position = Vector3.Zero()
        // cloth/leather hats are painted with their own texture instead of a
        // metal tint - metalColor only makes sense for actual armor helmets
        const helmetMat = itemName?.includes("hat")
            ? createMatV2(scene, `./images/modeltex/helmets/${itemName}.jpg`)
            : createMetalMat(scene, metalColor)
        helmet.material = helmetMat
        helmet.getChildMeshes().forEach(mesh => mesh.material = helmetMat)
        showHideEquip(helmet, true)
        const toPush = {name: helmetName, metalColor, mesh: helmet}
        helmetMeshes.push(toPush)
        return toPush
    }

    // hairVisible (item data, e.g. ironmaskItem in constants/questions.js) -
    // defaults to false (hidden) when omitted, matching every existing
    // helmet's prior hardcoded behavior exactly (they never passed this at
    // all, so `?? false` reproduces "always hide" for all of them
    // unchanged) - only a helmet whose own data explicitly sets
    // hairVisible: true (a mask/half-helm with a gap the hair should still
    // poke through) leaves it showing.
    function equipHelmet(helmetToEquipName, metalColor, itemName, hairVisible) {
        // male-fitted armor/gear meshes don't fit the new female rig yet
        // (see this file's own createAnimeBody/isFemale comment) - equipping
        // still updates det.items normally, it just doesn't render until
        // female-fitted meshes exist
        if(det.gender === "female") return
        if(!helmetToEquipName) return
        let toEquip = false
        if(!helmetMeshes.length) {
            toEquip = createHelmet(helmetToEquipName, metalColor, itemName)
        }
        helmetMeshes.forEach(hlm => {
            showHideEquip(hlm.mesh, false)
            // same modelName can exist in every metal tint - cache key needs
            // both, or equipping a differently-colored copy of a helmet
            // that's already been worn once just reused the first mesh/
            // material instead of creating a newly-tinted one
            if(hlm.name === helmetToEquipName && hlm.metalColor === metalColor) toEquip = hlm
        })
        if(!toEquip) {
            toEquip = createHelmet(helmetToEquipName, metalColor, itemName)
        }
        if(!toEquip) return
        showHideEquip(toEquip.mesh, true)
        if(characterHair) characterHair.isVisible = hairVisible ?? false
    }

    function createGauntlet(gauntletName, metalColor) {
        const template = containers.gauntlets.find(msh => msh.name.split(".")[1] === gauntletName)
        if(!template) return console.warn(`createGauntlet: missing gauntlet "${gauntletName}"`)
        if(!lowerArmL || !lowerArmR) return console.warn(`createGauntlet: missing lowerArm bone(s), cannot equip "${gauntletName}"`)

        const gauntletMat = createMetalMat(scene, metalColor)

        const rightGauntlet = template.clone(`gauntlet.${gauntletName}.R.${det._id}`)
        rightGauntlet.parent = lowerArmR
        // mirrored bone orientation between the left/right arms means the
        // single gauntlet mesh needs a half turn on this side to face right
        rightGauntlet.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), Math.PI)
        rightGauntlet.position = new Vector3(0, 0, 0.1)
        rightGauntlet.material = gauntletMat
        rightGauntlet.getChildMeshes().forEach(mesh => mesh.material = gauntletMat)

        // there's only one gauntlet mesh (meant for one hand), so the other
        // side is just a second clone parented to the opposite arm bone
        const leftGauntlet = template.clone(`gauntlet.${gauntletName}.L.${det._id}`)
        leftGauntlet.parent = lowerArmL
        leftGauntlet.rotationQuaternion = Quaternion.Identity()
        leftGauntlet.position = Vector3.Zero()
        leftGauntlet.material = gauntletMat
        leftGauntlet.getChildMeshes().forEach(mesh => mesh.material = gauntletMat)

        const meshes = [rightGauntlet, leftGauntlet]
        meshes.forEach(mesh => showHideEquip(mesh, true))
        const toPush = {name: gauntletName, metalColor, meshes}
        gauntletMeshes.push(toPush)
        return toPush
    }

    function equipGauntlet(gauntletToEquipName, metalColor) {
        // see equipHelmet's own comment
        if(det.gender === "female") return
        if(!gauntletToEquipName) return
        let toEquip = false
        if(!gauntletMeshes.length) {
            toEquip = createGauntlet(gauntletToEquipName, metalColor)
        }
        gauntletMeshes.forEach(gtl => {
            gtl.meshes.forEach(mesh => showHideEquip(mesh, false))
            // see equipHelmet - same name can exist in every metal tint
            if(gtl.name === gauntletToEquipName && gtl.metalColor === metalColor) toEquip = gtl
        })
        if(!toEquip) {
            toEquip = createGauntlet(gauntletToEquipName, metalColor)
        }
        if(!toEquip) return
        toEquip.meshes.forEach(mesh => showHideEquip(mesh, true))
    }

    function equipArmor(itemName, metalColor){
        // see equipHelmet's own comment
        if(det.gender === "female") return
        if(!itemName) return
        armors.forEach(arm => {
            if(arm.name === itemName){
                arm.mesh.isVisible = true
                const armorMat = createMetalMat(scene, metalColor)
                // armor sits worn OVER the shirt at the torso, same
                // coincident-geometry z-fight clothMat.zOffset already fixes
                // for cloth vs pants (createAnimeBodyMaterials' own comment)
                // - more negative than clothMat's -2 so armor reliably wins
                // the depth tie against cloth too, not just pants against cloth
                armorMat.zOffset = -4
                arm.mesh.material = armorMat
                arm.mesh.getChildMeshes().forEach(mesh => mesh.material = armorMat)
            } else arm.mesh.isVisible = false
        })
    }

    function createPauldron(pauldronName, metalColor) {
        const template = containers.pauldrons.find(msh => msh.name.split(".")[1] === pauldronName)
        if(!template) return console.warn(`createPauldron: missing pauldron "${pauldronName}"`)
        if(!shoulderL || !shoulderR) return console.warn(`createPauldron: missing shoulder bone(s), cannot equip "${pauldronName}"`)

        const pauldronMat = createMetalMat(scene, metalColor)
        // same reasoning as equipArmor's own armorMat.zOffset just above -
        // a shoulder pauldron sits worn over the shirt too
        pauldronMat.zOffset = -4

        const rightPauldron = template.clone(`pauldron.${pauldronName}.R.${det._id}`)
        rightPauldron.parent = shoulderR
        // same mirrored-rig quirk we found on the gauntlets — right side
        // needs a half turn to face the right way, may still need a small
        // position tweak like the gauntlet's got once you see it in-game
        rightPauldron.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), Math.PI)
        rightPauldron.position = Vector3.Zero()
        rightPauldron.material = pauldronMat
        rightPauldron.getChildMeshes().forEach(mesh => mesh.material = pauldronMat)

        // there's only one pauldron mesh (meant for one shoulder), so the
        // other side is just a second clone parented to the opposite bone
        const leftPauldron = template.clone(`pauldron.${pauldronName}.L.${det._id}`)
        leftPauldron.parent = shoulderL
        leftPauldron.rotationQuaternion = Quaternion.Identity()
        leftPauldron.position = Vector3.Zero()
        leftPauldron.material = pauldronMat
        leftPauldron.getChildMeshes().forEach(mesh => mesh.material = pauldronMat)

        const meshes = [rightPauldron, leftPauldron]
        meshes.forEach(mesh => showHideEquip(mesh, true))
        const toPush = {name: pauldronName, metalColor, meshes}
        pauldronMeshes.push(toPush)
        return toPush
    }

    function equipPauldron(pauldronToEquipName, metalColor) {
        // see equipHelmet's own comment
        if(det.gender === "female") return
        if(!pauldronToEquipName) return
        let toEquip = false
        if(!pauldronMeshes.length) {
            toEquip = createPauldron(pauldronToEquipName, metalColor)
        }
        pauldronMeshes.forEach(pld => {
            pld.meshes.forEach(mesh => showHideEquip(mesh, false))
            // see equipHelmet - same name can exist in every metal tint
            if(pld.name === pauldronToEquipName && pld.metalColor === metalColor) toEquip = pld
        })
        if(!toEquip) {
            toEquip = createPauldron(pauldronToEquipName, metalColor)
        }
        if(!toEquip) return
        toEquip.meshes.forEach(mesh => showHideEquip(mesh, true))
    }

    function equipSword(swordToEquipName, onHand, parts, weaponType, metalColor) {

        let toEquip = false
        if(!swordMeshes.length) {
            toEquip = createSword(swordToEquipName, parts, rHand, weaponType, metalColor)
        }
        swordMeshes.forEach(swrd => {
            showHideSword(swrd.mesh, false)
            if(swrd.name === swordToEquipName) {
                toEquip = swrd
                if(onHand) toEquip.mesh.parent = rHand

                if(!onHand) toEquip.mesh.parent = weaponSocket
            }

        })

        if(!toEquip) {
            toEquip = createSword(swordToEquipName, parts, rHand, weaponType, metalColor)
        }
        if(!toEquip) return
        showHideSword(toEquip.mesh, true)
        if(onHand) toEquip.mesh.parent = rHand
        if(!onHand) toEquip.mesh.parent = weaponSocket
        hasWeapon = true
    }
    function unEquip(itemType){
        switch(itemType){
            case "weapon":
                swordMeshes.forEach(swrd => showHideSword(swrd.mesh, false))
                hasWeapon = false
            break
            case "boots":
                boots.forEach(boot => boot.mesh.isVisible = false)
            break
            case "armor":
                armors.forEach(arm => arm.mesh.isVisible = false)
            break
            case "helmet":
                helmetMeshes.forEach(hlm => showHideEquip(hlm.mesh, false))
                if(characterHair) characterHair.isVisible = true
            break
            case "gauntlet":
                gauntletMeshes.forEach(gtl => gtl.meshes.forEach(mesh => showHideEquip(mesh, false)))
            break
            case "pauldron":
                pauldronMeshes.forEach(pld => pld.meshes.forEach(mesh => showHideEquip(mesh, false)))
            break
        }
    }
    if(det.items.length){
        det.items.forEach(itm => {
            if(itm.itemCateg === "equipable"){
                if(itm.itemType === "boots" && itm.equiped) equipBoots(itm.name)
                if(itm.itemType === "armor" && itm.equiped) equipArmor(itm.name, itm.metalColor)
                if(itm.itemType === "helmet" && itm.equiped) equipHelmet(itm.modelName, itm.metalColor, itm.name, itm.hairVisible)
                if(itm.itemType === "gauntlet" && itm.equiped) equipGauntlet(itm.name, itm.metalColor)
                if(itm.itemType === "pauldron" && itm.equiped) equipPauldron(itm.name, itm.metalColor)
                if(itm.itemType === "weapon" && itm.equiped) {
                    let swordParent = rHand
                    if(mode === "idle") swordParent = weaponSocket;
                    // createSword(itm.name, itm.parts, rHand)
                    equipSword(itm.name, mode === "fighting", itm.parts, itm.weaponType, itm.metalColor)
                }
            }
        })
    }
    if(isNpc){
        // npcs only ever play idle/walk - dispose the rest (combat, casting,
        // mining, hit/death reactions, etc.) so each spawned npc isn't carrying
        // the full player animation set around in memory for nothing
        const keptAnims = animationGroups.filter(anim => {
            const name = anim.name.toLowerCase()
            const keep = name === "idle" || name === "walk"
            if(!keep) anim.dispose()
            return keep
        })
        return { det, body, currentPlaceId: det.currentPlaceId, mode, anims: keptAnims, nameMesh, get hasWeapon() { return hasWeapon } }
    }

    const characterAnimations = new CharacterAnimations(animationGroups)
    characterAnimations.playAll()


    const bloodps = createBloodSplatter(scene)
    bloodps.ps.emitter = spineBone

    // const sec = createBloodParticle(scene)
    // sec.emitter =spineBone
    // bloodps.position.y += 1
    
    nameMesh.isVisible =false
    return {
        det,
        owner: det.owner,
        name: det.name,
        currentPlaceId: det.currentPlace.placeId,
        body,
        bodytarget,
        camParent,
        aggregate,
        nameMesh,
        anims: animationGroups,
        characterAnimations,
        rHand,
        root,
        mode,
        _moving,
        _minning,
        equipSword,
        equipBoots,
        equipArmor,
        equipHelmet,
        equipGauntlet,
        equipPauldron,
        unEquip,
        swordMeshes,
        helmetMeshes,
        gauntletMeshes,
        pauldronMeshes,
        weaponSocket,
        get hasWeapon() { return hasWeapon },

        bloodps,
        fshadow,

        auraz,
        // combat stances - per-instance, live-mutable flags (not fixed at
        // spawn like most of this object) - duelSystem.js's own
        // applyDamageToOpponent reads opponent.weaponBlocking directly off
        // this exact object right before applying incoming physical damage,
        // so flipping it later (an AI stance toggle, a parry window, etc.)
        // takes effect immediately, same idea magicBlocking/IsInVulnerable
        // are reserved for once their own damage paths check them. det.X
        // still seeds the STARTING value the same way enemies already do
        // (createEnemy.js's own det.weaponBlocking ? ... : false), so a
        // static npcDetails.js entry can opt a fighter in from the start.
        weaponBlocking: det.weaponBlocking ? det.weaponBlocking : false,
        magicBlocking: det.magicBlocking ? det.magicBlocking : false,
        IsInVulnerable: det.IsInVulnerable ? det.IsInVulnerable : false
    }
}


function createMainCapsuleToClone(scene){
    const mainCapsule = MeshBuilder.CreateBox("capsule",
        {
            width: capsuleRadius * 2,
            depth: capsuleRadius * 2,
            height: capsuleHeight
        },
        scene
    );
    mainCapsule.isVisible=false
    mainCapsule.isPickable=false
    return mainCapsule
}
function createMainBodyTargetToClone(scene){
    const bodytarget = MeshBuilder.CreateBox("bodytarget", 
        { 
            height: 4,
            size: 2
        }, 
        scene
    );
    bodytarget.isVisible = false
    bodytarget.isPickable  =false
    return bodytarget
}
// FEMALE_ONLY_NAMES - the new body/hair/outfit nodes added straight into the
// same avatar.glb the male body already lives in (not a separate file), so
// instantiateModelsToScene() below always brings in BOTH genders' meshes for
// every single character regardless of det.gender - createAnimeBody has to
// explicitly dispose whichever set doesn't match, or both bodies render
// stacked on top of each other. Checked with .includes(), not ===, since the
// hair entries carry a ".style" suffix (femaile.hair1/female.hair2 - yes,
// "femaile" is a real typo in the source glb, handled here rather than
// fixed at the asset level to avoid a re-export.
// exported - setupcharacterscene.js's character-creation preview loads the
// exact same avatar.glb and needs the identical gender split, not a
// hand-copied second list that could drift out of sync with this one
export const FEMALE_ONLY_NAMES = ["femalebody", "female.hair", "belt.style1", "mask.style", "skirt.style"]

// finds a bone/node anywhere under root whose name matches, instead of
// assuming it sits at a fixed getChildren()[0] position - the pelvis search
// right below this used to start from `mainBodyMeshes.getChildren()[0]`
// specifically (assuming that's always the Armature), which broke the
// instant avatar.glb gained a new top-level sibling (femalebody and the
// rest) that could sort before the Armature in export order: the male
// bone NAMES/hierarchy under pelvis are still exactly what they always
// were (confirmed against the actual rig), it was only WHICH top-level
// child the search started digging from that came loose. Depth-first, and
// stops at the first match, so avatar.glb having exactly one "pelvis"
// bone shared by both bodies' skinning (not a separate one per body) is
// what keeps this from ever ambiguously matching a female-side node instead.
// exported - setupcharacterscene.js's creation-preview scene has the exact
// same fragile positional pelvis/head-bone lookup on the same avatar.glb
export function findDeepByName(root, predicate){
    for(const child of root.getChildren()){
        if(predicate(child)) return child
        const found = findDeepByName(child, predicate)
        if(found) return found
    }
    return null
}

function createAnimeBody(containers, body, bodytarget, det, scene){
    const { animeBody, hairs } = containers
    let headBone, spineBone, rHand, lowerArmL, lowerArmR, shoulderL, shoulderR

    // female has no pants/cloth/skinColor style choices yet (only a body +
    // 2 hairstyles + one fixed default outfit: belt.style1/blindfold/
    // mask.style.1/skirt.style1/bag/silverine, always on, no equip system
    // behind them) - see this function's own gender branch below
    const isFemale = det.gender === "female"

    let belts = []
    let cloaks = []
    let armors = []
    let boots = []
    let characterHair = undefined
    const {hairMat,femaleHair2Mat,clothMat,pantsMat,skinMat, bootsMat} = createAnimeBodyMaterials(scene, det)

    const entries = animeBody.instantiateModelsToScene()
    entries.animationGroups.map(ani => ani.name = ani.name.split(" ")[2])
    const mainBodyMeshes = entries.rootNodes[0]
    mainBodyMeshes.parent = body
    mainBodyMeshes.position.y -= .74
    mainBodyMeshes.rotationQuaternion = Quaternion.Identity()

    const pelvisBone = findDeepByName(mainBodyMeshes, bne => bne.name.includes("pelvis"))
    console.log(det.name, pelvisBone.getChildren().length)
    if(pelvisBone){
        console.log(pelvisBone.getChildren())
        // optional chaining all the way down - female's own skeleton (see
        // this function's own isFemale comment) doesn't have a full
        // neck/shoulder/arm chain under upperSpine at all right now, so a
        // plain `.getChildren()[0].getChildren()[0]` chain threw the instant
        // it hit that gap. That was an UNCAUGHT exception partway through
        // this function - it silently skipped everything after it (the
        // entire mesh dispose/material/hair loop below, for EVERY
        // character, not just her), same class of bug as this function's
        // own auraSkill.find comment. `?.` just leaves the missing bone
        // `undefined` (same as this function already declared it) instead
        // of crashing, so a rig with a real gap degrades to "no
        // sword/pauldron/gauntlet placement for this one character"
        // instead of "nothing after this point works for anyone".
        const lowerSpine = pelvisBone.getChildren()[0]
        spineBone = lowerSpine?.getChildren()[0]
        rHand = spineBone?.getChildren()[2]?.getChildren()[0]?.getChildren()[0]?.getChildren()[1]
        headBone = spineBone?.getChildren()[0]?.getChildren()[0]

        shoulderL = spineBone?.getChildren()[1]
        shoulderR = spineBone?.getChildren()[2]
        lowerArmL = shoulderL?.getChildren()[0]?.getChildren()[0]
        lowerArmR = shoulderR?.getChildren()[0]?.getChildren()[0]

        if(!headBone) console.warn(`[createAnimeBody] head bone not found for "${det.name}" (gender: ${det.gender}) - her/his skeleton is missing the neck/shoulder chain under upperSpine`)

            // console.log(spineBone)
            // console.log(rHand)
            // console.log(headBone)
            // console.log(shoulderL)
            // console.log(shoulderR)
            // console.log(lowerArmL)
            // console.log(lowerArmR)

            // the leading `;` matters here - without it, this line has no
            // semicolon separating it from `console.log(lowerArmR)` above,
            // and a `[` right after an expression with no semicolon is
            // parsed as INDEXING that expression's result, not a new array
            // statement. That parsed as `console.log(lowerArmR)[lowerArmR]`
            // (console.log returns undefined, so this threw "Cannot read
            // properties of undefined"), a synchronous throw partway through
            // the scene's async load chain - which is exactly why the
            // loading screen never went away (same class of bug as this
            // function's own auraSkill.find comment above).
            // ;[
            //     spineBone,
            //     rHand,
            //     headBone,
            //     shoulderL,
            //     shoulderR,
            //     lowerArmL,
            //     lowerArmR
            // ].forEach(bone => {
            //     // console.log(bone)
            //     const box = bodytarget.clone(`debug`)
            //     box.parent = bone
            //     box.position = Vector3.Zero()
            //     box.scaling  = new Vector3(10,10,10)
            //     box.isPickable = false

            // })
        


        if(!lowerArmR) console.warn('[createAnimeBody] bone "lowerArm.R" not found')
        if(!lowerArmL) console.warn('[createAnimeBody] bone "lowerArm.L" not found')
    } else {
        console.warn('[createAnimeBody] pelvis bone not found - hair/weapon/pauldron/gauntlet placement will be broken')
    }
    // TEMP DIAGNOSTIC - sword renders huge/on the ground instead of in-hand,
    // even though hair (headBone, same skeleton, shallower chain) now
    // resolves correctly. Prints every resolved bone's actual name (so we
    // can see if rHand's deeper index chain landed on the wrong node) plus
    // how many "pelvis"-matching nodes exist at all (rules out
    // findDeepByName grabbing an ambiguous/wrong match). Remove once resolved.
    console.log("[createAnimeBody bone debug]", {
        // name/owner - so a log line can be matched to an actual character
        // by name instead of guessed from console ordering (the two clients'
        // logs interleave with each other and with enemy-spawn/join noise)
        name: det.name,
        owner: det.owner,
        gender: det.gender,
        pelvisName: pelvisBone?.name,
        pelvisMatchCount: (function countMatches(node, pred, n = 0){
            if(pred(node)) n++
            node.getChildren().forEach(c => n = countMatches(c, pred, n))
            return n
        })(mainBodyMeshes, bne => bne.name.includes("pelvis")),
        spineBoneName: spineBone?.name,
        headBoneName: headBone?.name,
        rHandName: rHand?.name,
        rHandClass: rHand?.getClassName?.(),
        rHandWorldPos: rHand?.getAbsolutePosition?.()?.asArray(),
        shoulderLName: shoulderL?.name,
        shoulderRName: shoulderR?.name,
        lowerArmLName: lowerArmL?.name,
        lowerArmRName: lowerArmR?.name,
    })
    bodytarget.parent = spineBone

    mainBodyMeshes.getChildren().forEach(mes => {
        mes.isPickable = false
        mes.name = mes.name.split(" ")[2].toLowerCase()
        // dispose(true) = doNotRecurse - Babylon's dispose() recursively
        // disposes every CHILD of the node by default. Both bodies share
        // ONE Armature (confirmed against the actual rig, not per-gender
        // copies) - if any bone ends up nested under a mesh node instead of
        // as a plain sibling, a recursive dispose() on that mesh silently
        // takes the shared skeleton down with it. This is exactly why
        // spineBone/shoulderL/etc resolved correctly the instant they were
        // computed above, then looked broken/missing when inspected
        // afterward - the recursive dispose() below ran in between and
        // deleted them out from under those already-resolved variables.
        // Passing true here means disposing a mesh only ever removes that
        // one mesh, never anything living underneath it.
        if(mes.name.includes("ref")) return mes.dispose(true)
        if(mes.name==="hiddenbody") return mes.dispose(true)
        // tripo_node_<uuid> - a leftover Tripo3D import-artifact node bundled
        // alongside the new female body parts in avatar.glb, same "generated
        // junk, not a real body part" category as ref/hiddenbody above
        if(mes.name.includes("tripo_node")) return mes.dispose(true)
        // log(mes.name)

        // "eyes" is shared by both bodies (parented under the common head
        // bone, not part of either body's own node group) - handle it before
        // the gender-exclusivity dispose below so it survives for both
        if(mes.name === "eyes") {
            // instantiateModelsToScene() above doesn't clone materials, so every
            // character shares this mesh's original material - mutating it in
            // place would make the last-created character's race win for everyone
            // falls back to "human" (the common case, see npcDetails.js) instead
            // of trying to load "undefinedeye.jpg" - det.race can be missing for
            // synced players (getCharSocket()'s payload didn't use to include it)
            // or any NPC entry that forgot to set one
            const eyeTexture = new Texture(`./images/modeltex/eyes/${det.race ?? "human"}eye.jpg`, scene, false, false)
            const eyeMat = mes.material.clone(`eye_mat_${det._id}`)
            eyeMat.emissiveTexture = eyeTexture
            mes.material = eyeMat
            return
        }

        // this function's own FEMALE_ONLY_NAMES comment - dispose whichever
        // gender's set doesn't match det.gender before either body's own
        // logic below ever runs
        const isFemaleNode = FEMALE_ONLY_NAMES.some(n => mes.name.includes(n))
        if(isFemaleNode !== isFemale) return mes.isVisible = false

        if(isFemale){
            if(mes.name.includes("femalebody")){
                // mes.material = skinMat
                // // see setupcharacterscene.js's own comment on this exact
                // // line - femalebody may have the real skin geometry on
                // // child submeshes, which don't inherit a parent's material
                // mes.getChildMeshes().forEach(child => child.material = skinMat)
                return
            }
            if(mes.name.includes("femaile.hair") || mes.name.includes("female.hair")){
                const hairStyleName = mes.name.split(".")[1]
                if(hairStyleName !== det.hair) return mes.isVisible = false
                // hair2 gets its own strand-texture bump map (this function's
                // own femaleHair2Mat comment) - hair1 stays the plain color
                // material every other hair mesh already uses
                mes.material = hairStyleName === "hair2" ? femaleHair2Mat : hairMat
                characterHair = mes
                return
            }
            // belt.style1/blindfold/mask.style.1/skirt.style1/bag/silverine -
            // her one fixed default look (no style/equip system behind any
            // of these yet, see this function's own isFemale comment above) -
            // always on
            mes.isVisible = true
            return
        }

        if(mes.name.includes("mainbody")){
            mes.material = skinMat

        }
        if(mes.name.includes("cloth")){
            mes.name.split(".")[1] !== det.cloth && mes.dispose(true)
            mes.material = clothMat
        }
        if(mes.name.includes("pants")){
            mes.name.split(".")[1] !== det.pants && mes.dispose(true)
            mes.material = pantsMat
        }
        if(mes.name.includes("boots")){
            // mes.name.split(".")[1] !== det.boots && mes.dispose()
            mes.isVisible =false
            mes.material = bootsMat
            boots.push({name: mes.name.split(".")[1], mesh:mes, isUsed: false})
        }
        if(mes.name.includes("scalp")){
            mes.material = hairMat
        }
        if(mes.name.includes("belt.")){
            const beltName = mes.name.split(".")[1]
            if(!beltName) return

            // const designatedMat = createEquipMat()
            // mes.material = beltMat
            mes.isVisible = false
            belts.push({name: beltName, mesh:mes, isUsed: false})
        }
        if(mes.name.includes("cloak.")){
            const cloakName = mes.name.split(".")[1]
            if(!cloakName) return

            // const designatedMat = createEquipMat()
            // mes.material = cloakMat
            mes.isVisible = false
            cloaks.push({name: cloakName, mesh:mes, isUsed: false})
        }
        if(mes.name.includes("armor.")){
            const armorName = mes.name.split(".")[1]
            if(!armorName) return

            // const designatedMat = createEquipMat()
            // mes.material = cloakMat
            mes.isVisible = false
            armors.push({name: armorName, mesh:mes, isUsed: false})
        }
    })
    hairs.forEach(hairMsh => {
        if(hairMsh.name.includes("root")) return hairMsh.parent = headBone
        const hairStyleName = hairMsh.name.split(".")[1]
        if(hairMsh.name.includes("root") || !hairStyleName) return
        if(hairStyleName === det.hair){
            characterHair = hairMsh.clone(det._id)
            characterHair.material = hairMat
            characterHair.parent = headBone
            characterHair.rotationQuaternion = null
            characterHair.position = new Vector3(0,.45,-.1)
            characterHair.scaling = new Vector3(8,8,8)
            characterHair.isVisible=true
        }
    })
    return {
        root: mainBodyMeshes,
        animationGroups: entries.animationGroups,
        rHand,
        belts,
        cloaks,
        armors,
        boots,
        spineBone,
        headBone,
        lowerArmL,
        lowerArmR,
        shoulderL,
        shoulderR,
        characterHair
    }
}
function createCapsuleBody(scene, det, spawnPos, ownerId, usePhysics) {
    let mainCapsule = scene.getMeshByName("capsule")
    let mainBodyTarget = scene.getMeshByName("bodytarget")
    if(mainCapsule === null){
        
        mainCapsule = createMainCapsuleToClone(scene)//scene.getMeshByName("capsule")
    }
    if(mainBodyTarget === null){
        mainBodyTarget =createMainBodyTargetToClone(scene)
        // mainBodyTarget = scene.getMeshByName("bodytarget")
    }

    const body = mainCapsule.clone(`player.${ownerId}`, scene)
    const bodytarget = mainBodyTarget.clone(`bodytarget.${ownerId}`, scene)

    body.isVisible = false; // hide the capsule mesh, we only use it for physics
    body.isPickable = false; // hide the capsule mesh, we only use it for physics

    bodytarget.isVisible = false; // hide the capsule mesh, we only use it for physics
    bodytarget.isPickable = false; // hide the capsule mesh, we only use it for physics
    
    let camParent = MeshBuilder.CreateBox("", {depth: .5, width: .25, height: .25}, scene)
    camParent.isVisible = false
    camParent.isPickable = false
    camParent.parent = body
    camParent.position = new Vector3(0, 0.25, 0.1)
    
    body.position = new Vector3(
        spawnPos.x, 
        spawnPos.y + capsuleHeight / 2, 
        spawnPos.z
    );
    body.rotationQuaternion = Quaternion.FromEulerVector(body.rotation)

    if (det._dirTarg) {
        const dx = det._dirTarg.x - spawnPos.x
        const dz = det._dirTarg.z - spawnPos.z
        if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
            body.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), Math.atan2(dx, dz))
        }
    }
    // Only create physics if enabled
    let aggregate
    if (usePhysics) {
        aggregate = createAggregate(body, {mass: 10, friction: 1, restitution: 0}, "box", scene)

        // Lock rotation so capsule doesn't tip over. mass MUST be repeated
        // here - setMassProperties doesn't layer onto a previous call, each
        // call recomputes mass/inertia/centerOfMass from scratch off the
        // shape's own volume+density and only patches the fields you pass
        // (see Havok plugin's _internalUpdateMassProperties). Calling this a
        // second time with only inertia (as this used to) silently threw
        // away the mass:10 set by createAggregate above and replaced it with
        // Havok's density-derived default for this box's volume - which,
        // going by how invisible even a huge test impulse was, is far
        // heavier than 10. Any impulse/mass math anywhere else in the
        // codebase assumes mass is actually 10 - this line is what makes
        // that true.
        aggregate.body.setMassProperties({
            mass: 10,
            inertia: Vector3.ZeroReadOnly,  // the exact constant the BJS team uses internally
            inertiaOrientation: Quaternion.Identity(),  // required alongside inertia in Havok
        });
        
        aggregate.body.disablePreStep = false;
        
        // Setup ground check
        // setupGroundCheck();
    }
    return {
        body,
        bodytarget,
        camParent, 
        aggregate
    }
}
function getAuraTemplates(scene, aurabox){
    if(scene._auraTemplates) return scene._auraTemplates
    scene._auraTemplates = {
        human: {
            main: createCustomizedSmoke(scene, aurabox, "smoke2", false, {min:1,max:1.1}, {min:1,max:1}, 1, new Vector3(0,1.2,0), {r:0,g:0.22,b:0.55}, {r:0.32,g:0.55,b:0.89}, false, "sphere", 0.6),
            sec:  createCustomizedSmoke(scene, aurabox, "thin1", {min:1,max:1.5}, {min:1,max:5}, false, 1, new Vector3(0,1.2,0), {r:0.09,g:0.49,b:0.81}, {r:0,g:0.76,b:1}, false, "mesh", .4)
        },
        demon: {
            main: createCustomizedSmoke(scene, aurabox, "blood", false, {min:1,max:1.1}, {min:1,max:1}, 1, new Vector3(0,0.2,0), {r:0.8,g:0.11,b:0.11}, {r:0.14,g:0.04,b:0.04}, false, "cone", 0.03),
            sec:  createCustomizedSmoke(scene, aurabox, "thin1", {min:1,max:1.5}, {min:1,max:5}, false, 1, false, {r:0.09,g:0.49,b:0.81}, {r:0.59,g:0,b:0.51}, false, "mesh", .4)
        }
    }
    return scene._auraTemplates
}

function createBodyAura(det, scene, body, auraType = "human"){
    let auras = []
    let aurabox = scene.getMeshByName("aurabox")
    if(!aurabox){
        aurabox = MeshBuilder.CreatePlane("aurabox", { }, scene);
        aurabox.isVisible=false
        aurabox.isPickable=false
    }

    const auramesh = aurabox.createInstance()
 
    auramesh.isVisible = false
    auramesh.parent = body
    auramesh.position.y -= 0.5

    // const templates = getAuraTemplates(scene, aurabox)

    switch(auraType){
        case "human":
            const auraPS = createCustomizedSmoke(scene, auramesh, "smoke2", false, {min:1,max:1.1}, {min:1,max:1}, 1, new Vector3(0,1.2,0), {r:0,g:0.22,b:0.55}, {r:0.32,g:0.55,b:0.89}, false, "sphere", 0.2)
            auraPS.stop()
            auraPS.emitRate = det.maxMp/12
            auraPS.minScaleY = parseFloat(det.lvl/2)
            auraPS.maxScaleY = parseFloat(det.lvl)
            auraPS.updateSpeed = 0.01
            auraPS.isLocal = true
            // setTimeout(() => { auraPS.emitRate = 4000 }, 10000)
            auras.push(auraPS)

            const secAura = createCustomizedSmoke(scene, auramesh, "thin1", {min:1,max:1.5}, {min:1,max:5}, false, 1, new Vector3(0,1.2,0), {r:0.09,g:0.49,b:0.81}, {r:0,g:0.76,b:1}, false, "mesh", .4)
            secAura.stop()
            secAura.emitRate =det.maxMp/15
            secAura.minScaleY = parseFloat(det.lvl/4)
            secAura.maxScaleY = parseFloat(det.lvl/2)
            secAura.isLocal = false
            // setTimeout(() => { secAura.emitRate = 4000 }, 10000)
            auras.push(secAura)
        break;
        case "demon":
            const demonaura1 = templates.demon.main.clone("demonaura1", auramesh)
            demonaura1.stop()
            demonaura1.emitRate = det.lvl * 2
            demonaura1.minScaleY = parseFloat(det.lvl/2)
            demonaura1.maxScaleY = parseFloat(det.lvl/2+2)
            demonaura1.updateSpeed = 0.01
            demonaura1.isLocal = true
            auras.push(demonaura1)

            const demonSecAura = templates.demon.sec.clone("demonSecAura", auramesh)
            demonSecAura.stop()
            demonSecAura.emitRate = Math.floor(det.lvl/2)
            demonSecAura.minScaleY = 2
            demonSecAura.maxScaleY = 4
            demonSecAura.isLocal = false
            auras.push(demonSecAura)
        break;
    }
    auras.start = function(){
        auras.forEach(ps => ps.start())
    }
    auras.stop = function(){
        auras.forEach(ps => ps.stop())
    }
    // auras.forEach(ps => ps.start())
    return auras
}


