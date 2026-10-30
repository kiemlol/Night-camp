import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validate,sample,PARTS} from '../../dist/cutout-demo/runtime/model.mjs';
const base=new URL('../../dist/cutout-demo/',import.meta.url);
const spec=JSON.parse(fs.readFileSync(new URL('traveler.character.json',base)));
test('standalone character carries all six sprites and four valid clips',()=>{
 for(const part of PARTS)assert.ok(fs.existsSync(new URL(spec.parts[part].src,base)));
 assert.ok(fs.existsSync(new URL(spec.weapon.spriteData.src,base)));
 for(const name of ['idle','walk','run','attack']){const clip=spec.clips[name];validate({format:'nightcamp-cutout-v1',rig:spec.rig,parts:spec.parts,clip});for(let i=0;i<=20;i++){const pose=sample(clip,i/20*clip.dur);assert.ok(Object.values(pose).every(v=>typeof v==='boolean'||Number.isFinite(v)))}if(name!=='attack')assert.deepEqual(clip.keys[0].P,clip.keys.at(-1).P)}
 assert.ok(spec.clips.attack.hit>0&&spec.clips.attack.hit<spec.clips.attack.dur);
});
test('demo entry has local runtime imports and does not load original game client',()=>{
 const html=fs.readFileSync(new URL('index.html',base),'utf8');assert.ok(!html.includes('game-20261025'));
 for(const ref of ['runtime/bootstrap.js','runtime/avatar.js','runtime/player.mjs','runtime/model.mjs','demo.js','demo.css'])assert.ok(fs.existsSync(new URL(ref,base)));
});
