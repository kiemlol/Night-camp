import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {samplePet,boneMatrices,point} from '../../dist/studio/pets/runtime.mjs';
import {petHandles,beginPetDrag,dragPetBone,boneTip,restoreBoneOffsets,pickPetHandle} from '../../dist/studio/pets/rig-controls.mjs';
import {appendInheritedFrame} from '../../dist/studio/timeline.mjs';
const rigs=JSON.parse(fs.readFileSync(new URL('../../dist/studio/pets/catalog.json',import.meta.url))).rigs;
const close=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
test('default pet dragging preserves every local attachment offset across all seven rigs, mirrored and nonuniform parents',()=>{
 for(const p of Object.values(rigs))for(const flip of [1,-1]){
  const P=samplePet(p.clip,0),root=p.bones.find(b=>b.parent===null).id;P[root+':rot']=.3;P[root+':sx']=1.2;P[root+':sy']=.8;
  const base=[flip*4,0,0,4,250,300],before=JSON.stringify(p);
  for(const h of petHandles(p,P,base)){
   const drag=beginPetDrag(p,P,h,h.xy,base),result=dragPetBone(drag,[h.xy[0]+25,h.xy[1]-16]);
   for(const b of p.bones)for(const ch of ['dx','dy'])assert.equal(result[b.id+':'+ch],P[b.id+':'+ch],`${p.id}/${h.id}/${ch}`);
   const again=dragPetBone(drag,[h.xy[0]+25,h.xy[1]-16]);for(const ch of Object.keys(result))if(typeof result[ch]==='number')close(result[ch],again[ch]);
   if(!drag.upper){const oldM=boneMatrices(p,P,base)[h.id],newM=boneMatrices(p,result,base)[h.id];close(oldM[4],newM[4]);close(oldM[5],newM[5])}
  }
  assert.equal(JSON.stringify(p),before);
 }
});
test('wolf paw drag rotates about the hip; clicking a pivot has a stable virtual lever instead of translating',()=>{
 const p=rigs.wolf,P=samplePet(p.clip,0),base=[4,0,0,4,200,300];
 for(const kind of ['joint','tip']){const h=petHandles(p,P,base).find(h=>h.id==='legBf'&&h.kind===kind),drag=beginPetDrag(p,P,h,h.xy,base);const next=dragPetBone(drag,[h.xy[0]+30,h.xy[1]-8]);assert.notEqual(next['legBf:rot'],P['legBf:rot']);assert.equal(next['legBf:dx'],P['legBf:dx']);assert.equal(next['legBf:dy'],P['legBf:dy'])}
});
test('puppet hand/foot IK reaches a reachable target by joint rotation and keeps elbow/knee attachments intact',()=>{
 const p=rigs.pp_axe,P=samplePet(p.clip,0);
 for(const [id,upper]of [['foreN','armN'],['shinN','thighN']])for(const flip of [1,-1]){
  const base=[flip*4,0,0,4,240,320],wanted={...P,[upper+':rot']:P[upper+':rot']+.25,[id+':rot']:P[id+':rot']-.5},b=p.bones.find(b=>b.id===id),tip=boneTip(p,P,b),target=point(boneMatrices(p,wanted,base)[id],...tip),h=petHandles(p,P,base).find(h=>h.id===id&&h.kind==='tip');
  const drag=beginPetDrag(p,P,h,h.xy,base),next=dragPetBone(drag,target),got=point(boneMatrices(p,next,base)[id],...tip);assert.equal(drag.upper,upper);assert.ok(Math.hypot(got[0]-target[0],got[1]-target[1])<1.5);
  for(const joint of [id,upper])for(const ch of ['dx','dy'])assert.equal(next[joint+':'+ch],P[joint+':'+ch]);
 }
});
test('translation is explicit; repairing a displaced frame restores offsets without changing angles or other frames',()=>{
 const p=rigs.wolf,P=samplePet(p.clip,0),base=[4,0,0,4,200,300],h=petHandles(p,P,base).find(h=>h.id==='legBf'&&h.kind==='joint');
 const result=dragPetBone(beginPetDrag(p,P,h,h.xy,base,'translate'),[h.xy[0]+40,h.xy[1]-20]);assert.notEqual(result['legBf:dx'],P['legBf:dx']);assert.equal(result['legBf:rot'],P['legBf:rot']);
 result['legBf:rot']=.7;const repaired=restoreBoneOffsets(result,['legBf'],P);assert.equal(repaired['legBf:dx'],P['legBf:dx']);assert.equal(repaired['legBf:dy'],P['legBf:dy']);assert.equal(repaired['legBf:rot'],.7);assert.notEqual(result['legBf:dx'],repaired['legBf:dx']);
 const c={name:'test',kind:'loop',dur:1,hit:.4,keys:[{t:0,curve:'lin',P}]},appended=appendInheritedFrame(c,0,repaired,.1).clip;assert.deepEqual(appended.keys[0].P,appended.keys[1].P);assert.equal(c.keys.length,1);
 const hidden={...P,'head:hide':true};assert.ok(petHandles(p,hidden,base).every(h=>h.id!=='head'));assert.equal(pickPetHandle([{id:'a',kind:'joint',xy:[0,0]},{id:'b',kind:'tip',xy:[1,0]}],[1,0],'b').id,'b');
});
