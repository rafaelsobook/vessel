import { layerAvatarMaterials, layerFacePart, layerHelmet, layerWorn, tuckOutfit } from "./avatarLayers.js";
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
import { createBloodParticle, createBloodSplatter } from '../tools/particlesystem';
import { CharacterAnimations, playAnim } from '../tools/animation';
import { createMesh, putFakeShadow, createMaterialFromDir } from '../creations/creationTools';
import { createMetalMat } from '../tools/metalmat';
import { giveArmorDetail } from '../tools/armorDetail';
import { attachWings } from './wings.js';
import { evolutionLook } from './evolutionLooks.js';
import { attachLightning } from '../effects/lightning';
import { createBodyAura } from '../effects/aura';
import { onIntersecExitTrig } from '../components/actionManager';
import { getCharState } from './characterstate';
import { calcDmg } from './attackingSystem';
import { emitPlayerIsHit } from '../sockets/emits';
import { onMeleeConnect } from './meleeCombat.js';
import { applyBlessingsToMeleeHit } from './blessingEffects.js';
import { registerBotInteraction } from '../npc/botInteraction';

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
    // female's "hair1" style only - same reasoning as femaleHair2Mat above,
    // its own material (not the shared hairMat) so backFaceCulling:false
    // stays scoped to her own hairstyles and doesn't also affect male
    // hair/scalp, which still use hairMat
    const femaleHair1Mat = createColorMat("hair_mat_f1", hairColor, scene)
    // both female hairstyles are thin, plane-based hair-card geometry -
    // without this, the back side of each strand plane is invisible from
    // certain angles (Babylon culls back faces by default), showing gaps/
    // see-through hair instead of a solid-looking style
    femaleHair1Mat.backFaceCulling = false
    femaleHair2Mat.backFaceCulling = false
    const clothMat = createMatV2(scene, false, "./images/fabrics/fabric4normal.jpg")
    const pantsMat = createMatV2(scene, false, "./images/fabrics/fabric4normal.jpg")
    const bootsMat = createMatV2(scene, "./images/fabrics/leather1.jpg", "./images/fabrics/leather1.jpg")
    
    if(det.gender !== "female"){
         clothMat.diffuseColor = new Color3(clothColor.r, clothColor.g, clothColor.b)
        pantsMat.diffuseColor = new Color3(pantsColor.r, pantsColor.g, pantsColor.b)
    }
   
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

    // his skin under his clothes, his hair over his scalp - avatarLayers.js
    if(det.gender !== "female") layerAvatarMaterials({ skinMat, clothMat, pantsMat, hairMat })

    return {
        hairMat,
        femaleHair1Mat,
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
    let kneeArmorMeshes = []
    let hasWeapon = false

    const { mode, _moving, _minning } = det

    const {body, bodytarget, camParent, aggregate} = createCapsuleBody(scene, det, spawnPos, det.owner, usePhysics)

    let fakeShadowRoot = scene.getMeshByName("fakeShadow")

    const fshadow = fakeShadowRoot ? putFakeShadow(body, fakeShadowRoot, 1, -capsuleHeight / 2 + 0.02) : null
    // the flex aura (effects/aura.js) - builds nothing until it's first shown.
    // npcs never reach a code path that grants/activates skills, and auraz isn't
    // even part of the isNpc return value below, so they skip it entirely.
    const auraz = isNpc ? null : createBodyAura(det, scene, body, capsuleHeight)

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
        // no profile passed - another player's comes in det.aura (getCharSocket),
        // mine is worked out from det and kept live by characterstate.js
        if(auraSkill && auraSkill.isActive) auraz.start()
    }

    const containers = getSocketContainers()

    const {root, animationGroups, rHand, belts, cloaks, 
        armors, boots, spineBone, headBone, lowerArmL, lowerArmR, 
        shoulderL, shoulderR, characterHairs, mainBodyLegs,
        underArmor, underBelt, lowerLegL, lowerLegR, faceParts} = createAnimeBody(containers, body, bodytarget, det, scene)

    const nameMesh = createTextMesh(scene, body, det.name, "white", {x:0,y: capsuleHeight,z:0}, 30);
    nameMesh.isVisible = false
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
        if(!itemName) return console.warn("equipBoots: missing itemName")
        boots.forEach(boot => {
            if(boot.name === itemName){
                boot.mesh.isVisible = true
                if(mainBodyLegs) mainBodyLegs.isVisible = false
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
            : giveArmorDetail(createMetalMat(scene, metalColor), metalColor, helmet)
        // drawn over his hair, never under it - avatarLayers.js
        layerHelmet(helmetMat)
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
        // female gate temporarily lifted for fit-testing on the new
        // femalebody rig (helmet/gauntlet/armor/pauldron meshes were built
        // for the male body's proportions/bone positions, so expect
        // clipping/misalignment until confirmed otherwise)
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
        if(hairVisible){
            characterHairs.forEach(hairOrScalp => hairOrScalp.isVisible = true)

        }else characterHairs.forEach(hairOrScalp => hairOrScalp.isVisible = false)

    }

    function createGauntlet(gauntletName, metalColor) {
        const template = containers.gauntlets.find(msh => msh.name.split(".")[1] === gauntletName)
        if(!template) return console.warn(`createGauntlet: missing gauntlet "${gauntletName}"`)
        if(!lowerArmL || !lowerArmR) return console.warn(`createGauntlet: missing lowerArm bone(s), cannot equip "${gauntletName}"`)

        const gauntletMat = giveArmorDetail(createMetalMat(scene, metalColor), metalColor, template)

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
        if(!itemName) return
        // her chest (femalebody.boobs) pokes through the armor - off while she wears one
        const wearsArmor = armors.some(arm => arm.name === itemName)
        underArmor.forEach(mesh => showHideEquip(mesh, !wearsArmor))
        armors.forEach(arm => {
            if(arm.name === itemName){
                arm.mesh.isVisible = true
                const armorMat = giveArmorDetail(createMetalMat(scene, metalColor), metalColor, arm.mesh)
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

    // A belt is a skinned mesh in avatar.glb (belt.<style>, e.g. belt.prieststyle1)
    // painted from images/textures/belt/<item name>.jpg + <item name>normal.jpg -
    // itemModelStyle picks the mesh, the item's name picks the texture. Both
    // bodies wear them; on her, her own default belt and skirt
    // (belt.style1.female, skirt.style1) come off while one is worn.
    function equipBelt(itemModelStyle, itemName){
        if(!itemModelStyle) return
        const wearsBelt = belts.some(belt => belt.name === itemModelStyle)
        underBelt.forEach(mesh => showHideEquip(mesh, !wearsBelt))
        belts.forEach(belt => {
            if(belt.name !== itemModelStyle){
                belt.mesh.isVisible = false
                return
            }
            if(belt.paintedAs !== itemName){
                const beltMat = createMaterialFromDir(scene, "./images/textures/belt", { diff: itemName, normal: `${itemName}normal`, ext: BELT_TEXTURE_EXT[itemName] })
                // it only has the diffuse and normal maps - the default white
                // specular of createMaterialFromDir would make cloth look like metal
                beltMat.specularColor = new Color3(0.12, 0.12, 0.12)
                layerWorn(beltMat)
                belt.mesh.material = beltMat
                belt.paintedAs = itemName
            }
            belt.mesh.isVisible = true
        })
    }

    function createPauldron(pauldronName, metalColor) {
        const template = containers.pauldrons.find(msh => msh.name.split(".")[1] === pauldronName)
        if(!template) return console.warn(`createPauldron: missing pauldron "${pauldronName}"`)
        if(!shoulderL || !shoulderR) return console.warn(`createPauldron: missing shoulder bone(s), cannot equip "${pauldronName}"`)

        const pauldronMat = giveArmorDetail(createMetalMat(scene, metalColor), metalColor, template)
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

    // Knee armour (kneearmors.glb's kneearmor.<name>, e.g. braveknee) - like a
    // pauldron, one mesh cloned onto both sides, here the lowerLeg.L/.R bones.
    // Unlike the pauldron it wasn't modelled in the bone's own space, so it's
    // placed here (KNEE_ARMOR_FIT/KNEE_ARMOR_TILT). Both legs' bones face the
    // same way, so both clones take the same transform - except the right
    // one is mirrored, so the pair is symmetric.
    function createKneeArmor(kneeArmorName, metalColor) {
        const template = containers.kneeArmors?.find(msh => msh.name.split(".")[1] === kneeArmorName)
        if(!template) return console.warn(`createKneeArmor: missing knee armor "${kneeArmorName}"`)
        if(!lowerLegL || !lowerLegR) return console.warn(`createKneeArmor: missing lowerLeg bone(s), cannot equip "${kneeArmorName}"`)

        const kneeMat = giveArmorDetail(createMetalMat(scene, metalColor), metalColor, template)
        // same reasoning as the pauldron's - worn over the pants
        kneeMat.zOffset = -4
        // the exported mesh has its plates wound both ways (about half its
        // faces point inward), so it's drawn from both sides - each face's
        // normal matches its winding, so two-sided lighting lights whichever
        // side you see correctly
        kneeMat.backFaceCulling = false
        kneeMat.twoSidedLighting = true

        const fit = KNEE_ARMOR_FIT[det.gender] ?? KNEE_ARMOR_FIT.male
        const meshes = [["L", lowerLegL], ["R", lowerLegR]].map(([side, bone]) => {
            const knee = template.clone(`kneearmor.${kneeArmorName}.${side}.${det._id}`)
            knee.parent = bone
            knee.rotationQuaternion = Quaternion.RotationAxis(Vector3.Right(), Math.PI + KNEE_ARMOR_TILT)
            // the right leg's copy is the mirror image of the left's (its x
            // flipped - the turn above is about x, so that's the bone's x,
            // across the leg): one-sided detail like a dent then sits on
            // the inside of both knees, facing each other, instead of the
            // same side of each
            knee.scaling.set(side === "R" ? -fit.scale : fit.scale, fit.scale, fit.scale)
            // both bones' +x point to the character's right - toward the
            // middle on the left leg, away from it on the right
            knee.position = new Vector3(side === "L" ? fit.inward : -fit.inward, fit.down, fit.forward)
            knee.material = kneeMat
            knee.getChildMeshes().forEach(mesh => mesh.material = kneeMat)
            showHideEquip(knee, true)
            return knee
        })
        const toPush = {name: kneeArmorName, metalColor, meshes}
        kneeArmorMeshes.push(toPush)
        return toPush
    }

    function equipKneeArmor(kneeArmorToEquipName, metalColor) {
        // same per-name-and-tint cache as equipPauldron
        if(!kneeArmorToEquipName) return
        let toEquip = false
        kneeArmorMeshes.forEach(knee => {
            knee.meshes.forEach(mesh => showHideEquip(mesh, false))
            if(knee.name === kneeArmorToEquipName && knee.metalColor === metalColor) toEquip = knee
        })
        if(!toEquip) toEquip = createKneeArmor(kneeArmorToEquipName, metalColor)
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
                if(mainBodyLegs) mainBodyLegs.isVisible = true
            break
            case "armor":
                armors.forEach(arm => arm.mesh.isVisible = false)
                underArmor.forEach(mesh => showHideEquip(mesh, true))
            break
            case "belt":
                belts.forEach(belt => belt.mesh.isVisible = false)
                underBelt.forEach(mesh => showHideEquip(mesh, true))
            break
            case "helmet":
                helmetMeshes.forEach(hlm => showHideEquip(hlm.mesh, false))
                if(characterHairs) characterHairs.forEach(hairOrScalp => hairOrScalp.isVisible = true)
            break
            case "gauntlet":
                gauntletMeshes.forEach(gtl => gtl.meshes.forEach(mesh => showHideEquip(mesh, false)))
            break
            case "pauldron":
                pauldronMeshes.forEach(pld => pld.meshes.forEach(mesh => showHideEquip(mesh, false)))
            break
            case "kneearmor":
                kneeArmorMeshes.forEach(knee => knee.meshes.forEach(mesh => showHideEquip(mesh, false)))
            break
        }
    }
    if(det.items.length){
        det.items.forEach(itm => {
            if(itm.itemCateg === "equipable"){
                if(itm.itemType === "boots" && itm.equiped) {
                    if(det.name === "fow") {
                    }
                    equipBoots(itm.name)
                }
                if(itm.itemType === "armor" && itm.equiped) equipArmor(itm.name, itm.metalColor)
                if(itm.itemType === "belt" && itm.equiped) equipBelt(itm.itemModelStyle, itm.name)
                if(itm.itemType === "helmet" && itm.equiped) equipHelmet(itm.modelName, itm.metalColor, itm.name, itm.hairVisible)
                if(itm.itemType === "gauntlet" && itm.equiped) equipGauntlet(itm.name, itm.metalColor)
                if(itm.itemType === "pauldron" && itm.equiped) equipPauldron(itm.name, itm.metalColor)
                if(itm.itemType === "kneearmor" && itm.equiped) equipKneeArmor(itm.name, itm.metalColor)
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
        // npcs only ever play idle/walk, plus hit1 when the player swings at
        // them (createAllNpcInArea.js's registerNpcHitReaction) - dispose the
        // rest (combat, casting, mining, death, etc.) so each spawned npc isn't
        // carrying the full player animation set around in memory for nothing
        const keptAnims = animationGroups.filter(anim => {
            const name = anim.name.toLowerCase()
            const keep = name === "idle" || name === "walk" || name === "hit1"
            if(!keep) anim.dispose()
            return keep
        })
        return { det, body, currentPlaceId: det.currentPlaceId, mode, anims: keptAnims, nameMesh, get hasWeapon() { return hasWeapon } }
    }

    const characterAnimations = new CharacterAnimations(animationGroups)
    characterAnimations.playAll()


    const bloodps = createBloodSplatter(scene)
    bloodps.ps.emitter = spineBone
    // already bleeding when this client met them (getCharSocket's isBleeding)
    if(det.isBleeding) bloodps.setBleeding(true)

    // const sec = createBloodParticle(scene)
    // sec.emitter =spineBone
    // bloodps.position.y += 1
    

    // OPEN PVP - same atkCollider exit-trigger mechanism createEnemy.js
    // already wires up per world enemy (see that file's own header comment
    // on why EXIT, not enter), just registered against another PLAYER's or
    // BOT's body instead of an enemy's. det.socketId excludes the two other
    // things this same createCharacter() builds: a duel/training "fighter"
    // npc (npc/createnpc.js's createFighterNpc, npcDet never carries a real
    // socketId) already has its OWN local-only atkCollider registration
    // (duelSystem.js's registerToAtkCollider call) - without this guard,
    // a duel would double-damage on every single hit, once from each
    // registration. det.owner !== charState.owner is the actual "not
    // myself" check - reCreateMeshesInScene (worldsocket.js) already skips
    // ever calling createCharacter() for my own owner, but that guard only
    // protects THIS one call site, not this function itself, so it's
    // checked again here directly rather than trusted blindly.
    if(det.socketId){
        const atkCollider = scene.getMeshByName(`atkCollider`)
        if(atkCollider){
            onIntersecExitTrig(atkCollider, body, scene, () => {
                const charState = getCharState()
                if(!charState || charState.owner === det.owner) return

                // same dealDamageToEnemy-adjacent shape createEnemy.js's own
                // melee hit handler builds - effectsWhenHit (e.g. the
                // Majestic Sword's burn) rides along the exact same way,
                // just relayed through tcp's new "playerIsHit" handler
                // instead of "enemyIsHit" (a player/bot isn't in tcpEnemies)
                const equippedWeapon = charState.items.find(itm => itm.itemType === "weapon" && itm.equiped)
                // my blessings' say in the blow (blessingEffects.js) - the damage
                // after them. Its on-hit effects aren't used here: nothing on
                // the player side reads effectsWhenHit yet (worldsocket.js).
                const dmgDetails = applyBlessingsToMeleeHit({
                    dmgDetails: calcDmg(charState),
                    charState,
                    effectsWhenHit: equippedWeapon?.effectsWhenHit,
                    isSkill: !!atkCollider.isSkillHijacked,
                    targetBody: body,
                }).dmgDetails
                emitPlayerIsHit({
                    playerId: charState.owner,
                    dmgDetails,
                    targetId: det.owner,
                    currentPlaceId: det.currentPlace.placeId,
                    isPhysical: true,
                    effectsWhenHit: equippedWeapon?.effectsWhenHit,
                })
                // the blow's impact on my screen - meleeCombat.js
                onMeleeConnect({
                    targetBody: body,
                    targetMeshes: root?.getChildMeshes?.() ?? [],
                    targetAnims: animationGroups ?? [],
                    isCritical: dmgDetails.isCritical,
                    weaponType: equippedWeapon?.weaponType ?? "fist",
                    isSkill: !!atkCollider.isSkillHijacked,
                })
            })
        }

        // SERVANTS - bot-only (det.attitudeName is set exclusively by
        // tcp/index.ts's own spawnBot(), never present on a real player or
        // a duel/fighter npc) - "invite to follow you" doesn't make sense
        // for either of those. npc/botInteraction.js's own header comment
        // has the full reasoning for why this lives here rather than
        // npc/createAllNpcInArea.js.
        if(det.attitudeName !== undefined){
            registerBotInteraction(scene, body, det)
        }
    }

    const character = {
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
        // the wings an evolution gave them, and their clips (wings.js) - none until then
        wings: null,
        winganims: [],
        characterAnimations,
        rHand,
        root,
        mode,
        _moving,
        _minning,
        equipSword,
        equipBoots,
        equipArmor,
        equipBelt,
        equipHelmet,
        equipGauntlet,
        equipPauldron,
        equipKneeArmor,
        unEquip,
        swordMeshes,
        helmetMeshes,
        gauntletMeshes,
        pauldronMeshes,
        kneeArmorMeshes,
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
        IsInVulnerable: det.IsInVulnerable ? det.IsInVulnerable : false,
        // worn out (characterstate.js's isCharacterTired) - renderer.js plays
        // the tired walk/stand clips off it. Seeded from det so a player who
        // was already tired when this client met them shows it straight away.
        isTired: !!det.isTired,
        // bleeding (characterstate.js's refreshBleeding) - bloodps runs
        // non-stop while it's true. Seeded from det like isTired above.
        isBleeding: !!det.isBleeding,
        // what they wear on their back (wings.js) - set once loaded
        wings: null,
        // an evolution's face (evolutionLooks.js) - evolution.js puts it on
        // the moment the change breaks through
        applyLook: evolution => applyEvolutionLook(faceParts, evolution, scene),
        resetLook: () => resetEvolutionLook(faceParts, det, scene),
    }
    // evolved (evolution.js) - the wings and face it gave them, back on: mine
    // in every place I go, anyone else's from their join payload (getCharSocket)
    if(det.evolution?.wingdetail) attachWings(character, det.evolution.wingdetail)
    if(det.evolution) applyEvolutionLook(faceParts, det.evolution, scene)
    return character
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
// Where knee armour (createKneeArmor) sits on a lowerLeg bone, in the bone's
// own units (avatar.glb's Root scales the rig by 0.128, so 1 unit is about
// 13 cm). The bone's +y runs down the shin and its +z points forward; the
// knee mesh (kneearmors.glb) stands with its +y up and its knee cop facing
// -z, so it's turned over about x - and KNEE_ARMOR_TILT more, so the shin
// plate follows the shin instead of standing off it. down: how far down the
// bone its middle sits, so the knee cop lands on the knee. forward: how far
// in front - his pants stand about 0.72 out at the knee, her bare leg 0.35,
// so one setting would sink into his or float off hers. inward: sideways, to
// the middle of the leg - both bodies share one skeleton, and her legs sit
// closer together than its knees (the bone is at the outside edge of her
// leg), his baggy pants a little wider than it.
const KNEE_ARMOR_TILT = 0.35
const KNEE_ARMOR_FIT = {
    male:   { scale: 2.6, down: 0.6,  forward: 0.52, inward: -0.08 },
    female: { scale: 2.1, down: 0.48, forward: 0.28, inward: 0.22 },
}

// belt textures (images/textures/belt) that aren't .jpg, by item name
const BELT_TEXTURE_EXT = { royalpriest: "webp" }

export const FEMALE_ONLY_NAMES = [
    "femalebody",
    "female.hair",
    "belt.style1",
    "mask.style",
    "skirt.style",
    "female"
]

// Each body has its own face: eyes, eyeback (the whites behind them) and
// eyebrows - the male's plain-named, the female's "female."-prefixed copies
// fitted to her head (avatar.glb; female.eyes is the same mesh and material
// as eyes). Every character keeps exactly its own gender's set.
// { part: "eyes"|"eyeback"|"eyebrows", female } for a face mesh's
// (lowercased) name, null for anything else. Exported - setupcharacterscene.js's
// preview swaps the same two sets on its gender toggle.
const FACE_PARTS = ["eyes", "eyeback", "eyebrows"]
export function facePartOf(name){
    if(FACE_PARTS.includes(name)) return { part: name, female: false }
    if(name.startsWith("female.") && FACE_PARTS.includes(name.slice("female.".length))){
        return { part: name.slice("female.".length), female: true }
    }
    return null
}

// her mask (mask.style.1) - part of the female outfit in avatar.glb, left off
const HIDDEN_FEMALE_PARTS = ["mask.style"]
export function isHiddenFemalePart(name){
    return HIDDEN_FEMALE_PARTS.some(n => name.includes(n))
}

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
// Moves a player's visible avatar (player.root - not the physics body) under
// newParent, optionally switching its animation. root keeps its normal local
// offset from its parent (y -0.74, see createAnimeBody), so newParent should
// sit where that player's body center would be - and passing player.body back
// restores the standing setup exactly. Looping states (idle, sitting...) go
// through characterAnimations so renderer.js's per-frame setState doesn't
// fight them; anything else is played directly as a loop.
export function parentRoot(ownerId, newParent, animationName){
    const player = getPlayersOnScene().find(pl => pl.owner === ownerId)
    if(!player?.root || !newParent) return null

    player.root.parent = newParent

    if(animationName){
        if(player.characterAnimations?.hasState(animationName)) player.characterAnimations.setState(animationName)
        else playAnim(player.anims, animationName, true)
    }
    return player
}

export function findDeepByName(root, predicate){
    for(const child of root.getChildren()){
        if(predicate(child)) return child
        const found = findDeepByName(child, predicate)
        if(found) return found
    }
    return null
}

// dispose(true) alone (see every dispose(true) call below) protects the
// shared Armature from a recursive dispose taking it down, but that
// protection is a double-edged sword: if the disposed node ALSO has a real
// mesh submesh nested under it (not a bone - e.g. a hand as a child of
// mainbody, same rig-nesting surprise as everything else on this asset),
// doNotRecurse leaves that submesh behind as a live, still-visible orphan
// instead of cleaning it up with its parent. getChildMeshes() (unlike
// getChildren()) only ever returns Mesh-class descendants, never
// TransformNode/bone ones, and is recursive by default - so disposing
// every one of those first, then the node itself, removes all the real
// geometry while never touching anything skeleton-related.
function disposeMeshTree(mesh){
    mesh.getChildMeshes().forEach(child => child.dispose(true))
    mesh.dispose(true)
}

// The eyes' race look (eyes or female.eyes - one mesh and material shared by
// both): ./images/modeltex/eyes/<race>eye.jpg as their emissive texture.
// instantiateModelsToScene() doesn't clone materials, so every character
// shares the mesh's original material - mutating it in place would make the
// last-created character's race win for everyone, hence the clone. Falls back
// to "human" (the common case, see npcDetails.js) instead of loading
// "undefinedeye.jpg" - det.race can be missing for synced players
// (getCharSocket()'s payload didn't use to include it) or any NPC entry that
// forgot to set one.
// An evolution's face (evolutionLooks.js): its eyes' texture in place of the
// race's, the eyeback (whites) in its colour. faceParts: createAnimeBody's -
// both materials are this character's own (giveRaceEyes, the eyeback's
// clone), so this changes no one else.
function applyEvolutionLook(faceParts, evolution, scene){
    const look = evolutionLook(evolution)
    if(!look || !faceParts) return
    const { eyes, eyeback } = faceParts
    if(look.eyes && eyes?.material){
        eyes.material.emissiveTexture?.dispose()
        eyes.material.emissiveTexture = new Texture(`./images/modeltex/eyes/${look.eyes}eye.jpg`, scene, false, false)
    }
    const mat = eyeback?.material
    if(look.eyeback && mat){
        // what it was, once - resetEvolutionLook puts it back
        faceParts.originalEyeback ??= {
            color: ("albedoColor" in mat ? mat.albedoColor : mat.diffuseColor)?.clone(),
            texture: "albedoColor" in mat ? mat.albedoTexture : mat.diffuseTexture,
            emissiveColor: mat.emissiveColor?.clone(),
            emissiveTexture: mat.emissiveTexture,
        }
        // PBR or standard, whichever the glb gave it
        if("albedoColor" in mat){
            mat.albedoColor = look.eyeback.clone()
            mat.albedoTexture = null
        } else {
            mat.diffuseColor = look.eyeback.clone()
            mat.diffuseTexture = null
        }
        mat.emissiveColor = look.eyeback.clone()
        mat.emissiveTexture = null
    }
}

// Back to the face they were born with: their race's eyes, the eyeback as the
// glb had it.
function resetEvolutionLook(faceParts, det, scene){
    if(!faceParts) return
    const { eyes, eyeback, originalEyeback } = faceParts
    if(eyes?.material){
        eyes.material.emissiveTexture?.dispose()
        eyes.material.emissiveTexture = new Texture(`./images/modeltex/eyes/${det.race ?? "human"}eye.jpg`, scene, false, false)
    }
    const mat = eyeback?.material
    if(mat && originalEyeback){
        if("albedoColor" in mat){
            if(originalEyeback.color) mat.albedoColor = originalEyeback.color.clone()
            mat.albedoTexture = originalEyeback.texture
        } else {
            if(originalEyeback.color) mat.diffuseColor = originalEyeback.color.clone()
            mat.diffuseTexture = originalEyeback.texture
        }
        if(originalEyeback.emissiveColor) mat.emissiveColor = originalEyeback.emissiveColor.clone()
        mat.emissiveTexture = originalEyeback.emissiveTexture
    }
}

function giveRaceEyes(eyes, det, scene){
    const eyeTexture = new Texture(`./images/modeltex/eyes/${det.race ?? "human"}eye.jpg`, scene, false, false)
    const eyeMat = eyes.material.clone(`eye_mat_${det._id}`)
    eyeMat.emissiveTexture = eyeTexture
    eyes.material = eyeMat
}

function createAnimeBody(containers, body, bodytarget, det, scene){
    const { animeBody, hairs } = containers
    let headBone, spineBone, rHand, lowerArmL, lowerArmR, shoulderL, shoulderR, lowerLegL, lowerLegR

    // female has no pants/cloth/skinColor style choices yet (only a body +
    // her own face + 2 hairstyles + one fixed default outfit: belt.style1/
    // blindfold/skirt.style1/bag/silverine, always on, no equip system
    // behind them - mask.style.1 is left off) - see this function's own
    // gender branch below
    const isFemale = det.gender === "female"
    if(!isFemale) det.gender = "male"


    let belts = []
    let cloaks = []
    let armors = []
    let boots = []
    let characterHairs = []
    // this character's eyes and eyeback meshes (applyEvolutionLook)
    const faceParts = { eyes: null, eyeback: null }
    // her parts an equipped piece covers: femalebody.boobs under armor, her
    // default belt.style1.female + skirt.style1 under a belt (equipArmor/equipBelt)
    let underArmor = []
    let underBelt = []
    let mainBodyLegs = undefined
    const {hairMat,femaleHair1Mat,femaleHair2Mat,clothMat,pantsMat,skinMat, bootsMat} = createAnimeBodyMaterials(scene, det)
   
    const entries = animeBody.instantiateModelsToScene()
    entries.animationGroups.map(ani => ani.name = ani.name.split(" ")[2])
    const mainBodyMeshes = entries.rootNodes[0]
    mainBodyMeshes.parent = body
    mainBodyMeshes.position.y -= .74
    mainBodyMeshes.rotationQuaternion = Quaternion.Identity()

    const pelvisBone = findDeepByName(mainBodyMeshes, bne => bne.name.includes("pelvis"))
    if(pelvisBone){
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
        // the hand is found by NAME among the lower arm's children, not by its
        // position there: re-exporting avatar.glb reordered them ([thumbstart.R,
        // hand.R] became [hand.R, thumbstart.R]), and the old [1] then landed
        // on the thumb - sword gripped by the thumb bone, off the hand.
        // [1] stays as the fallback for a rig whose bone isn't named "hand".
        const lowerArmRBones = spineBone?.getChildren()[2]?.getChildren()[0]?.getChildren()[0]?.getChildren()
        rHand = lowerArmRBones?.find(bne => bne.name.toLowerCase().includes("hand")) ?? lowerArmRBones?.[1]
        headBone = spineBone?.getChildren()[0]?.getChildren()[0]

        shoulderL = spineBone?.getChildren()[1]
        shoulderR = spineBone?.getChildren()[2]
        // the knees (knee armour) - by name, under pelvis -> upperLeg
        lowerLegL = findDeepByName(pelvisBone, bne => bne.name.endsWith("lowerLeg.L"))
        lowerLegR = findDeepByName(pelvisBone, bne => bne.name.endsWith("lowerLeg.R"))
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
    bodytarget.parent = spineBone

    // her hairstyle, if avatar.glb still has it - re-exporting it dropped
    // female.hair2, and a saved/NPC "hair2" (Colousa, Ilvara) then matched
    // nothing and left her bald. Falls back to the first style it does have.
    const femaleHairStyles = mainBodyMeshes.getChildren()
        .map(mes => mes.name.split(" ")[2]?.toLowerCase() ?? "")
        .filter(name => name.includes("female.hair") || name.includes("femaile.hair"))
        .map(name => name.split(".")[1])
    const femaleHair = femaleHairStyles.includes(det.hair) ? det.hair : femaleHairStyles[0]

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
        // one mesh, never anything living underneath it - disposeMeshTree
        // (this function's own comment above) still cleans up any real mesh
        // submesh nested under it, just without touching bones.
        if(mes.name.includes("ref")) return disposeMeshTree(mes)
        if(mes.name==="hiddenbody") return disposeMeshTree(mes)
        // tripo_node_<uuid> - a leftover Tripo3D import-artifact node bundled
        // alongside the new female body parts in avatar.glb, same "generated
        // junk, not a real body part" category as ref/hiddenbody above
        if(mes.name.includes("tripo_node")) return disposeMeshTree(mes)
        // log(mes.name)

        // his bare legs, swapped out for boots (equipBoots/unEquip). Hers are
        // part of femalebody - on a female character this is the male legs
        // mesh, and unequipping boots used to turn it back on beside hers.
        if(mes.name === "mainbodylegs" && !isFemale){
            mainBodyLegs = mes;
        }
        // the face - this character's own gender's eyes/eyeback/eyebrows
        // (facePartOf), the other set disposed. Handled before the gender
        // split below, which would only hide the other set.
        const face = facePartOf(mes.name)
        if(face){
            if(face.female !== isFemale) return disposeMeshTree(mes)
            showHideEquip(mes, true)
            if(face.part === "eyes"){
                giveRaceEyes(mes, det, scene)
                faceParts.eyes = mes
            }
            // its own too, like the eyes' - an evolution colours it
            // (applyEvolutionLook), and the glb's is everyone's
            if(face.part === "eyeback"){
                mes.material = mes.material.clone(`eyeback_mat_${det._id}`)
                faceParts.eyeback = mes
            }
            // eyes behind his eyelids, eyebrows on his skin - avatarLayers.js
            if(!isFemale) layerFacePart(mes)
            return
        }

        // this function's own FEMALE_ONLY_NAMES comment - dispose whichever
        // gender's set doesn't match det.gender before either body's own
        // logic below ever runs
        const isFemaleNode = FEMALE_ONLY_NAMES.some(n => mes.name.includes(n))
        // merong female name sa mesh pero hindi siya female character(isFemale)

        // showHideEquip (this file's own helper, top of file) - not a plain
        // mes.isVisible = false, since a child submesh (this rig has already
        // surprised us with nested submeshes more than once) wouldn't
        // inherit the parent's hidden state on its own
        // armor.* and the equipable belt.* meshes are worn by both bodies, so
        // she keeps them too (hidden below until equipped)
        const isSharedGear = mes.name.startsWith("armor.") || mes.name.startsWith("belt.")
        if(isFemaleNode !== isFemale && !(isFemale && isSharedGear)) return showHideEquip(mes, false)

        if(isFemale){
            if(mes.name === "femalebody.boobs"){
                underArmor.push(mes)
                return
            }
            // her default belt + skirt - on until a belt is equipped. Returned
            // here so the equipable belt.* collection below never takes her
            // belt.style1.female for a "style1" belt item and hides it.
            if(mes.name.startsWith("belt.style1") || mes.name.includes("skirt.style")){
                showHideEquip(mes, true)
                underBelt.push(mes)
                return
            }
            if(mes.name.includes("femalebody")){
                // mes.material = skinMat
                // // see setupcharacterscene.js's own comment on this exact
                // // line - femalebody may have the real skin geometry on
                // // child submeshes, which don't inherit a parent's material
                // mes.getChildMeshes().forEach(child => child.material = skinMat)
                return
            }
            if(mes.name.includes("female.hair")){
                const hairStyleName = mes.name.split(".")[1]
                if(hairStyleName !== femaleHair) return showHideEquip(mes, false)
                // hair2 gets its own strand-texture bump map, hair1 its own
                // plain color material - both separate from the shared
                // hairMat (male hair/scalp) so their backFaceCulling:false
                // stays scoped to just her two hairstyles (this function's
                // own femaleHair1Mat/femaleHair2Mat comment)
                mes.material = hairStyleName === "hair2" ? femaleHair2Mat : femaleHair1Mat

                characterHairs.push(mes)
                return
            }
            // her scalp under the hair (scalpHairInside.female) - on from the
            // start, in her hair's colour, and in characterHairs so a helmet
            // hides it and taking the helmet off brings it back, same as the
            // male scalphairinside below. Returned here so the male scalp
            // rule further down ("scalp" -> dispose for female) never sees it.
            if(mes.name === "scalphairinside.female"){
                mes.material = femaleHair1Mat
                showHideEquip(mes, true)
                characterHairs.push(mes)
                return
            }
            // her mask - left off (isHiddenFemalePart)
            if(isHiddenFemalePart(mes.name)) return showHideEquip(mes, false)
            // the rest of her fixed default look (no style/equip system
            // behind any of it yet, see this function's own isFemale
            // comment above) - always on
            mes.isVisible = true
        }

        if(mes.name.includes("mainbody")){
            mes.material = skinMat

        }
        // his face's lines (nose, mouth) - on his skin, see avatarLayers.js
        if(mes.name === "headlines") layerFacePart(mes)
        if(mes.name.includes("cloth")){
            mes.name.split(".")[1] !== det.cloth && disposeMeshTree(mes)
            mes.material = clothMat
        }
        if(mes.name.includes("pants")){
            mes.name.split(".")[1] !== det.pants && disposeMeshTree(mes)
            mes.material = pantsMat
        }
        if(mes.name.includes("boots")){
            // boots.<itemName>.<gender> - some boots (leatherboots) now ship
            // as two separate meshes, one per gender, sharing the same item
            // name. Without checking the gender segment, both would get
            // pushed under the identical name ("leatherboots") and
            // equipBoots(itemName) would match - and show - both at once
            // regardless of which body they're on. No gender segment at all
            // (just boots.<itemName>) is treated as a universal boot mesh.
            const bootGender = mes.name.split(".")[2]
            if(bootGender !== det.gender) {
                return disposeMeshTree(mes)
            }
            // was true - every other equip slot (armor/cloak below, helmet/
            // gauntlet/pauldron elsewhere in this file) defaults hidden here
            // and only turns on via the real equip call driven by
            // itm.equiped (see the det.items.forEach block below, which only
            // ever calls equipBoots() when a boots item is actually
            // equipped) - boots was the one exception, so a fresh character
            // with nothing equipped still rendered wearing boots regardless
            // of actual inventory state.
            mes.isVisible = false
            mes.material = bootsMat
            boots.push({name: mes.name.split(".")[1], mesh:mes, isUsed: false})

        }
        if(mes.name.includes("scalp")){
            if(isFemale) return mes.dispose()
            mes.material = hairMat
            // scalphairinside and scalphairtip go with his hairstyle into
            // characterHairs, so a helmet hides them (equipHelmet) and taking
            // it off brings them back. scalphair itself stays on under a
            // helmet - it's the hairline the helmet sits over.
            if(mes.name === "scalphairinside") characterHairs.push(mes)
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
        // belt.<style> (belt.prieststyle1...) - hidden until a belt of that
        // style is worn (equipBelt). Without this it would show on every male
        // avatar as a bare white belt: the glb gives it no material.
        if(mes.name.startsWith("belt.")){
            const beltStyle = mes.name.split(".")[1]
            if(!beltStyle) return
            mes.isVisible = false
            belts.push({name: beltStyle, mesh: mes})
        }
    })
    // what his own shirt and pants cover of his skin isn't drawn, nor the top
    // of his pants under his shirt - avatarLayers.js
    if(!isFemale){
        const parts = mainBodyMeshes.getChildren()
        tuckOutfit(
            parts.filter(part => part.name.startsWith("mainbody")),
            parts.find(part => part.name === `cloth.${det.cloth}`),
            parts.find(part => part.name === `pants.${det.pants}`))
    }
    if(!isFemale){
        hairs.forEach(hairMsh => {
            if(hairMsh.name.includes("root")) return hairMsh.parent = headBone
            const hairStyleName = hairMsh.name.split(".")[1]
            if(hairMsh.name.includes("root") || !hairStyleName) return
            if(hairStyleName === det.hair){
                const chosenHairStyle = hairMsh.clone(det._id)
                chosenHairStyle.material = hairMat
                chosenHairStyle.parent = headBone
                chosenHairStyle.rotationQuaternion = null
                chosenHairStyle.position = new Vector3(0,.45,-.1)
                chosenHairStyle.scaling = new Vector3(8,8,8)
                chosenHairStyle.isVisible=true
                characterHairs.push(chosenHairStyle)
            }else hairMsh.isVisible = false
        })
    }

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
        characterHairs,
        mainBodyLegs,
        underArmor,
        underBelt,
        lowerLegL,
        lowerLegR,
        faceParts
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


