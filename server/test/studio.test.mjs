import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sample,validate,gameExport,PARTS} from '../../dist/studio/model.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../../dist/studio/catalog.json',import.meta.url)));
const project=()=>({format:'nightcamp-cutout-v1',rig:'traveler',parts:Object.fromEntries(PARTS.map(p=>[p,structuredClone(catalog.sprites['rig_traveler_'+p])])),clip:{name:'test_walk',kind:'walk',dur:1,hit:.4,keys:[{t:0,curve:'lin',P:{aF:0,y:0}},{t:1,curve:'lin',P:{aF:2,y:10}}]}});
test('studio validates project, samples timeline and holds stepped keys',()=>{const p=validate(project());assert.deepEqual(sample(p.clip,.5),{aF:1,y:5});p.clip.keys[0].curve='step';assert.equal(sample(p.clip,.5).aF,0);p.clip.keys[1].t=0;assert.throws(()=>validate(p));});
test('studio exports game-compatible poses, sprite anchors and embedded images',()=>{const p=project();p.parts.head.src='data:image/png;base64,aGVsbG8=';const e=gameExport(p);assert.equal(e.images.length,1);assert.match(e.code,/NC.POSE_LIB/);assert.match(e.code,/rig_traveler_head/);assert.match(e.code,/"neck"/);assert.equal(e.id,'test_walk');assert.equal(JSON.parse(JSON.stringify(p)).parts.head.src,p.parts.head.src)});
test('studio rejects missing anchors, unsafe image sources and invalid pose values',()=>{for(const change of [p=>delete p.parts.torso.joints.pelvis,p=>p.parts.head.src='javascript:alert(1)',p=>p.clip.keys[0].P.aF=NaN,p=>p.clip.dur=0,p=>p.clip.hit=2]){const p=project();change(p);assert.throws(()=>validate(p))}});
