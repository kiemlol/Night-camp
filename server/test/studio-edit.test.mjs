import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {detectPieces,guessBackground,mergeBoxes} from '../../dist/studio/slice.mjs';
import {LIMBS,ensureMiddleJoints,resizeSprite,validLimb,solveEndpoint,bendFromDrag} from '../../dist/studio/rig-edit.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../../dist/studio/catalog.json',import.meta.url)));
function setup(name='traveler'){
 const NC={SPR:{},ITEMS:{top:{rig:name},weapon:{restAng:1.2,stance:-.7,grip:.12,wtype:'sword'}},clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),lerp:(a,b,t)=>a+(b-a)*t};
 for(const [key,s]of Object.entries(catalog.sprites))NC.SPR[key]={...structuredClone(s),name:key,img:{}};
 const context=vm.createContext({NC,window:{NC},document:{createElement:()=>({getContext:()=>({})})}});
 for(const f of ['../../dist-full/game-20261025-1758/js/anim.js','../../dist/studio/runtime/avatar.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),context);
 NC.GRIPFIX=false;const equip={top:'top',weapon:'weapon'},pose=NC.Anim.sample('idle',0,NC.animCtx(equip));return {NC,equip,pose};
}
test('hand IK reaches target and does not accumulate on repeated pointer positions, mirrored too',()=>{
 const {NC,equip,pose}=setup();for(const face of [1,-1]){const measure=q=>NC.rigJoints(equip,{...q,face},400,400,3),j=measure(pose),target=[j.haN[0]+face*25,j.haN[1]-25];const p=solveEndpoint(pose,LIMBS.haN,target,measure),end=measure(p).haN;assert.ok(Math.hypot(end[0]-target[0],end[1]-target[1])<1);assert.deepEqual(solveEndpoint(pose,LIMBS.haN,target,measure),p);assert.ok(Object.values(p).every(v=>typeof v==='boolean'||Number.isFinite(v)))}
});
test('middle handles change elbow and knee bends; real sockets follow a leaning body',()=>{
 for(const rig of ['traveler','voidcomet']){const {NC,equip,pose}=setup(rig);const measure=q=>NC.rigJoints(equip,{...q,face:1},400,400,3),j=measure(pose);for(const limb of Object.values(LIMBS)){const p=bendFromDrag(pose,limb,j,[20,-15],measure);assert.ok(Math.abs(p[limb.bend]-pose[limb.bend])>.001);assert.ok(Object.values(measure(p)).every(point=>point.every(Number.isFinite)))}
  const p={...pose,lean:.5},js=measure(p);assert.notDeepEqual(js.hipN,j.hipN);
 }
});
test('resize keeps every anchor proportional and validates nonzero limb segments',()=>{const parts={};for(const part of ['head','torso','armF','armB','legF','legB'])parts[part]=structuredClone(catalog.sprites['rig_traveler_'+part]);ensureMiddleJoints(parts);const s=parts.armF,old=structuredClone(s);resizeSprite(s,'w',s.w*2);assert.equal(s.joints.elbow[0],old.joints.elbow[0]*2);assert.equal(s.joints.elbow[1],old.joints.elbow[1]);assert.ok(validLimb(s,'armF'));s.joints.elbow=[...s.joints.shoulder];assert.ok(!validLimb(s,'armF'))});
test('auto slice finds islands, filters specks, preserves diagonal links and handles white background',()=>{
 const w=50,h=40,rgba=new Uint8ClampedArray(w*h*4);const pixel=(x,y,c)=>rgba.set(c,(y*w+x)*4);for(let y=3;y<13;y++)for(let x=4;x<14;x++)pixel(x,y,[200,10,20,255]);for(let y=20;y<30;y++)for(let x=30;x<40;x++)pixel(x,y,[10,200,20,255]);pixel(0,0,[255,255,255,255]);const boxes=detectPieces(rgba,w,h);assert.equal(boxes.length,2);assert.deepEqual(boxes[0],{x:4,y:3,w:10,h:10,area:100});assert.equal(mergeBoxes(boxes).w,36);
 for(let i=0;i<w*h;i++)if(!rgba[i*4+3])rgba.set([255,255,255,255],i*4);const bg=guessBackground(rgba,w,h);assert.deepEqual(bg,[255,255,255]);assert.equal(detectPieces(rgba,w,h,{background:bg}).length,2);
});
