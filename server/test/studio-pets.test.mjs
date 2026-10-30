import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validatePet,samplePet,boneMatrices,poseBounds,inversePoint,point,activeSprite,PetCutoutPlayer} from '../../dist/studio/pets/runtime.mjs';
import {blankClip,appendInheritedFrame,copyPoseToFrames} from '../../dist/studio/timeline.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../../dist/studio/pets/catalog.json',import.meta.url)));
const pet=()=>structuredClone(catalog.rigs.wolf);
test('pet catalog has seven rigid-cutout rigs, 29 editable clips and existing part images, without mesh data',()=>{
 assert.deepEqual(Object.keys(catalog.rigs).sort(),['falcon','lantern','pp_axe','pp_shield','pp_xbow','wolf','wyvern']);let clips=0;
 for(const p of Object.values(catalog.rigs)){validatePet(p);assert.ok(p.bones.every(b=>!('weights'in b)&&!('mesh'in b)));for(const s of Object.values(p.sprites))assert.ok(fs.existsSync(new URL('../../dist-full/'+catalog.build+'/'+s.src,import.meta.url)));for(const c of Object.values(p.clips)){clips++;assert.ok(c.keys.length>1);for(let i=0;i<=30;i++){const P=samplePet(c,i*c.dur/30);assert.ok(Object.values(boneMatrices(p,P)).flat().every(Number.isFinite));assert.ok(Object.values(poseBounds(p,P)).every(Number.isFinite));for(const b of p.bones)assert.ok(activeSprite(p,P,b)===null||p.sprites[activeSprite(p,P,b)])}}}
 assert.equal(clips,29);
});
test('pet sprite variants and visibility switch discretely; exact frame selection displays the destination pose',()=>{
 const c={keys:[{t:0,curve:'lin',P:{'head:img':0,'head:hide':false,'head:rot':0}},{t:1,curve:'step',P:{'head:img':2,'head:hide':true,'head:rot':2}}]};
 assert.deepEqual(samplePet(c,.8),{'head:img':0,'head:hide':false,'head:rot':1.6});assert.deepEqual(samplePet(c,1),c.keys[1].P);c.keys[0].curve='step';assert.equal(samplePet(c,.9)['head:rot'],0);
});
test('pet hierarchy follows parent edits and inverse dragging works under mirror, rotation and negative wing scales',()=>{
 const p=pet(),P=samplePet(p.clip,0),before=boneMatrices(p,P);p.bones.find(b=>b.id==='body').at[0]+=12;const after=boneMatrices(p,P);assert.ok(Math.abs(after.head[4]-before.head[4]-12)<1e-9);
 for(const flip of [1,-1]){const M=boneMatrices(p,{...P,'body:rot':.4,'body:sy':-.8},[flip*3,0,0,3,190,200]);const xy=point(M.body,7,-9);const local=inversePoint(M.body,...xy);assert.ok(Math.abs(local[0]-7)<1e-8);assert.ok(Math.abs(local[1]+9)<1e-8)}
 assert.throws(()=>inversePoint([0,0,0,1,0,0],1,2));
});
test('pet validator rejects graph cycles, broken parents, malformed channels and unsafe image sources before adoption',()=>{
 for(const change of [p=>p.bones.find(b=>b.id==='body').parent='head',p=>p.bones[0].parent='missing',p=>p.bones[0].pivot=[2,.5],p=>p.spriteOrder.push(p.spriteOrder[0]),p=>p.sprites[p.spriteOrder[0]].src='assets/../secret.png',p=>p.sprites[p.spriteOrder[0]].src='javascript:alert(1)',p=>p.clip.keys[0].P['head:img']=.5,p=>p.clip.keys[0].P['head:hide']=3,p=>p.clip.keys[0].P['head:rot']=true,p=>p.clip.keys[0].P['head:rot:bad']=0,p=>p.clip.keys[0].P['head:dx']=NaN,p=>p.bones.push({...p.bones[0]})]){const p=pet();change(p);assert.throws(()=>validatePet(p))}
});
test('new pet animations, inherited frames and multi-target pose copy preserve independent numeric/visibility/image channels',()=>{
 const P=samplePet(pet().clip,0),c=blankClip({name:'new_pet',pose:P});assert.equal(c.keys.length,1);const next={...P,'head:rot':.5,'head:img':2,'head:hide':false};let r=appendInheritedFrame(c,0,next,.1);r=appendInheritedFrame(r.clip,1,{...next,'head:rot':-.5},.1);const copied=copyPoseToFrames(r.clip,0,[1,2],next).clip;assert.ok(copied.keys.every(k=>k.P['head:rot']===.5));copied.keys[1].P['head:rot']=2;assert.equal(copied.keys[0].P['head:rot'],.5);
});
test('standalone pet player updates clips without game globals or Spine dependencies',()=>{
 const p=pet(),player=new PetCutoutPlayer(p,new Map());player.play('run');const first=structuredClone(player.pose);player.update(.2);assert.notDeepEqual(player.pose,first);player.play('attack');player.update(2);assert.equal(player.time,p.clips.attack.dur);assert.throws(()=>player.play('no_such_clip'));
});
