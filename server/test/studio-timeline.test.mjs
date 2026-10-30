import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankClip,appendInheritedFrame,copyPoseToFrames} from '../../dist/studio/timeline.mjs';
const pose=()=>({aF:-1.5,eF:.6,legB:.8,kB:1.1,wBehind:false});
test('blank animation starts with exactly one independent pose',()=>{const p=pose(),clip=blankClip({name:'brand_new',pose:p});assert.equal(clip.keys.length,1);assert.equal(clip.keys[0].t,0);assert.deepEqual(clip.keys[0].P,p);clip.keys[0].P.aF=9;assert.equal(p.aF,-1.5)});
test('new frames inherit the edited pose, save the previous frame and do not share references',()=>{
 let c=blankClip({name:'walk',pose:pose()});const edited={...pose(),aF:1,kB:1.9};let result=appendInheritedFrame(c,0,edited,.1);assert.deepEqual(result.clip.keys[0].P,edited);assert.deepEqual(result.clip.keys[1].P,edited);assert.equal(c.keys.length,1);result.clip.keys[1].P.aF=2;
 result=appendInheritedFrame(result.clip,1,result.clip.keys[1].P,.1);c=appendInheritedFrame(result.clip,2,result.clip.keys[2].P,.1).clip;assert.equal(c.keys.length,4);assert.deepEqual(c.keys.map(k=>k.t),[0,.1,.2,.3]);assert.equal(c.keys[0].P.aF,1);c.keys[3].P.aF=99;assert.equal(c.keys[2].P.aF,2);
});
test('insert in the middle moves later frames without overwriting them and advances a later hit',()=>{
 const clip=blankClip({name:'attack',kind:'attack',pose:pose()});clip.keys.push({t:.6,curve:'step',P:{...pose(),aF:4}});const next=appendInheritedFrame(clip,0,pose(),.2).clip;assert.deepEqual(next.keys.map(k=>k.t),[0,.2,.8]);assert.equal(next.keys[2].P.aF,4);assert.equal(next.keys[2].curve,'step');assert.equal(next.hit,.6);assert.equal(next.dur,1.2);
});
test('copy pose to multiple frames preserves target timing and easing, and clones independently',()=>{
 const clip=blankClip({name:'copy',pose:pose()});clip.keys.push({t:.2,curve:'step',P:{aF:7}},{t:.4,curve:'lin',P:{aF:8}},{t:.6,curve:'out',P:{aF:9}});const original=structuredClone(clip),edited={...pose(),aF:2.2};const {clip:c,count}=copyPoseToFrames(clip,0,[1,3,3,0],edited);assert.equal(count,2);assert.deepEqual(c.keys[1].P,edited);assert.deepEqual(c.keys[3].P,edited);assert.deepEqual(c.keys[2],original.keys[2]);assert.equal(c.keys[3].t,.6);assert.equal(c.keys[3].curve,'out');c.keys[1].P.aF=5;assert.equal(c.keys[3].P.aF,2.2);assert.deepEqual(clip,original);
});
test('invalid operations fail before mutating the timeline',()=>{
 const c=blankClip({name:'safe',pose:pose(),dur:30});const saved=structuredClone(c);assert.throws(()=>appendInheritedFrame(c,0,pose(),0));assert.throws(()=>appendInheritedFrame(c,0,pose(),NaN));assert.throws(()=>copyPoseToFrames(c,0,[99],pose()));assert.throws(()=>copyPoseToFrames(c,0,[],pose()));c.keys[0].t=30;assert.throws(()=>appendInheritedFrame(c,0,pose(),.1));c.keys[0].t=0;assert.deepEqual(c,saved);
});
