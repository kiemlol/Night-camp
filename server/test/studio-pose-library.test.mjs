import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {importPoseClip,livingPose,poseClipDescription} from '../../dist/studio/pose-library.mjs';
import {sample,validate,CURVES,PARTS,gameExport} from '../../dist/studio/model.mjs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const lib=JSON.parse(read('../../dist/studio/poses.json'));
const catalog=JSON.parse(read('../../dist/studio/catalog.json'));
const NC={SPR:{},ITEMS:{},clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),lerp:(a,b,t)=>a+(b-a)*t};
const context=vm.createContext({window:{NC},NC,console});
vm.runInContext(read('../../dist-full/game-20261025-1758/js/anim.js'),context);
vm.runInContext(read('../../dist-full/game-20261025-1758/js/poselib.js'),context);
const defaults=NC.Anim.setup({W:{restAng:1.2},rF:1.4,rB:1.5});
const parts=Object.fromEntries(PARTS.map(p=>[p,catalog.sprites['rig_traveler_'+p]]));

test('every original Pose Studio clip imports, samples finite poses and exports without mutating the library',()=>{
 const before=JSON.stringify(lib);let live=0,staticClips=0;
 for(const [id,data]of Object.entries(lib)){
  const {clip}=importPoseClip(data,defaults);
  const project=validate({format:'nightcamp-cutout-v1',rig:'traveler',parts,clip});
  for(let i=0;i<=60;i++)assert.ok(Object.values(sample(clip,i*clip.dur/60)).every(v=>typeof v==='boolean'||Number.isFinite(v)),id);
  gameExport(project);
  if(data.shot&&data.kind==='loop'){live++;assert.equal(clip.shot,false);assert.equal(clip.keys.length,205);assert.notDeepEqual(sample(clip,0),sample(clip,.8));assert.deepEqual(clip.keys[0].P,clip.keys.at(-1).P)}
  if(clip.keys.length===1){staticClips++;assert.match(poseClipDescription(data),/Pose tĩnh/)}
 }
 assert.equal(Object.keys(lib).length,67);assert.equal(live,24);assert.equal(staticClips,4);assert.equal(JSON.stringify(lib),before);
});

test('baked living holds match the original engine poseAlive at each authored sample',()=>{
 const data=Object.values(lib).find(c=>c.shot&&c.kind==='loop'),base={...defaults,...data.keys[0].P};
 const {clip}=importPoseClip(data,defaults);
 for(const key of clip.keys.slice(0,-1)){
  const expected=structuredClone(base);NC.poseAlive(key.t,expected);const actual=livingPose(key.t,base);
  for(const ch of Object.keys(expected)){if(typeof expected[ch]==='boolean')assert.equal(actual[ch],expected[ch]);else assert.ok(Math.abs(actual[ch]-expected[ch])<1e-10,ch)}
  assert.deepEqual(key.P,actual);
 }
});

test('import preserves snap/back, repairs duration and closes source loops without discarding keys',()=>{
 const attack=importPoseClip(lib.cmukzhx28a7,defaults).clip;
 assert.equal(attack.dur,.692);assert.equal(attack.keys.length,10);assert.equal(attack.keys.find(k=>k.t===.1).curve,'snap');
 for(const name of ['snap','back'])for(const t of [0,.1,.5,.8,1])assert.ok(Math.abs(CURVES[name](t)-NC.Anim.CURVE[name](t))<1e-10);
 const loop=importPoseClip(lib.cmukzhi0yjz,defaults).clip;
 assert.equal(loop.keys.at(-1).t,loop.dur);assert.deepEqual(loop.keys[0].P,loop.keys.at(-1).P);
 const raw={name:'duplicates',kind:'loop',dur:1,keys:[{t:.5,P:{aF:2}},{t:0,P:{aF:0}},{t:.5,P:{aF:3}}]};
 const result=importPoseClip(raw,defaults);assert.deepEqual(result.clip.keys.map(k=>k.t),[0,.5,1]);assert.equal(result.clip.keys[1].P.aF,3);
 assert.throws(()=>importPoseClip({...raw,keys:[{t:0,P:{aF:NaN}}]},defaults));
});

test('selecting the exact destination key of a held segment displays that key, not the previous pose',()=>{
 const clip={keys:[{t:0,curve:'step',P:{aF:0}},{t:1,curve:'step',P:{aF:2}}]};
 assert.equal(sample(clip,.999).aF,0);assert.equal(sample(clip,1).aF,2);
});
