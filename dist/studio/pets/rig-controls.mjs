import {boneMatrices,activeSprite,spritePivot,point,inversePoint} from './runtime.mjs';
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const clone=p=>structuredClone(p);
// Move the free end of the image; its attachment pivot stays pinned.
export function boneTip(p,pose,b){
 const s=p.sprites[activeSprite(p,pose,b)],pivot=spritePivot(p,pose,b);if(!s)return [0,-12];
 let uv;
 if(/^leg|^shin|^thigh|^arm|^fore/.test(b.id))uv=[.5,.94];
 else if(b.id==='head')uv=[.12,.58];
 else if(/^wing/.test(b.id))uv=/[iI]$/.test(b.id)?(p.id==='wyvern'?[.7,.1]:[.62,.12]):[.88,.08];
 else if(/^tail/.test(b.id))uv=[.92,.12];
 else uv=[pivot[0]<.5?.9:.1,pivot[1]<.5?.9:.1];
 return [(uv[0]-pivot[0])*s.w,(uv[1]-pivot[1])*s.h];
}
export function petHandles(p,pose,base){
 const M=boneMatrices(p,pose,base),handles=[];
 for(const b of p.bones){if(b.visible===false||pose[b.id+':hide'])continue;handles.push({id:b.id,kind:'joint',xy:[M[b.id][4],M[b.id][5]]});if(b.sprite)handles.push({id:b.id,kind:'tip',xy:point(M[b.id],...boneTip(p,pose,b))})}
 return handles;
}
export function pickPetHandle(handles,xy,selected,radius=22){
 let best=null,score=Infinity;
 for(const h of handles){const d=Math.hypot(h.xy[0]-xy[0],h.xy[1]-xy[1]);if(d>radius)continue;const s=d-(h.id===selected?2:0)-(h.kind==='tip'?1:0);if(s<score){score=s;best=h}}return best;
}
function limbParent(p,id){const b=p.bones.find(b=>b.id===id),match=/^(fore|shin)(N|F)$/.exec(id);if(!match)return null;const parent=(match[1]==='fore'?'arm':'thigh')+match[2];return b.parent===parent?parent:null}
export function beginPetDrag(p,pose,handle,xy,base,mode='rotate'){
 const b=p.bones.find(b=>b.id===handle.id);if(!b)throw Error('Không tìm thấy xương');
 const M=boneMatrices(p,pose,base),parent=b.parent?M[b.parent]:base,start=inversePoint(parent,...xy),center=[b.at[0]+(pose[b.id+':dx']||0),b.at[1]+(pose[b.id+':dy']||0)];
 const tipLocal=inversePoint(parent,...point(M[b.id],...boneTip(p,pose,b)));
 let ref=[start[0]-center[0],start[1]-center[1]];
 const virtual=handle.kind==='joint'||Math.hypot(xy[0]-M[b.id][4],xy[1]-M[b.id][5])<8;
 if(virtual)ref=[tipLocal[0]-center[0],tipLocal[1]-center[1]];
 if(Math.hypot(...ref)<1e-6)ref=[15,0];
 return {project:p,pose:clone(pose),id:b.id,mode,base:[...base],parent,start,center,ref,virtual,lastAngle:Math.atan2(ref[1],ref[0]),total:0,tip:boneTip(p,pose,b),upper:mode==='rotate'&&handle.kind==='tip'?limbParent(p,b.id):null};
}
export function dragPetBone(drag,xy){
 const P=clone(drag.pose),id=drag.id,p=inversePoint(drag.parent,...xy);
 if(drag.mode==='translate'){P[id+':dx']=(drag.pose[id+':dx']||0)+p[0]-drag.start[0];P[id+':dy']=(drag.pose[id+':dy']||0)+p[1]-drag.start[1];return P}
 if(drag.upper){
  // Puppet elbows/knees: two rigid segments reach by rotation, never translation.
  // Analytic seed avoids slow CCD convergence when a knee starts almost straight.
  const M0=boneMatrices(drag.project,P,drag.base),upper=drag.project.bones.find(b=>b.id===drag.upper),parent0=upper.parent?M0[upper.parent]:drag.base;
  const root=inversePoint(parent0,M0[drag.upper][4],M0[drag.upper][5]),elbow=inversePoint(parent0,M0[id][4],M0[id][5]),end0=inversePoint(parent0,...point(M0[id],...drag.tip)),target0=inversePoint(parent0,...xy);
  const a=[elbow[0]-root[0],elbow[1]-root[1]],b=[end0[0]-elbow[0],end0[1]-elbow[1]],v=[target0[0]-root[0],target0[1]-root[1]],l1=Math.hypot(...a),l2=Math.hypot(...b);
  if(l1>1e-7&&l2>1e-7&&Math.hypot(...v)>1e-7){
   const bend=(a[0]*b[1]-a[1]*b[0]<0?-1:1)*Math.acos(Math.max(-1,Math.min(1,(v[0]*v[0]+v[1]*v[1]-l1*l1-l2*l2)/(2*l1*l2))));
   P[drag.upper+':rot']=(P[drag.upper+':rot']||0)+wrap(Math.atan2(v[1],v[0])-Math.atan2(l2*Math.sin(bend),l1+l2*Math.cos(bend))-Math.atan2(a[1],a[0]));
   const sign=Math.sign((P[drag.upper+':sx']??1)*(P[drag.upper+':sy']??1))||1;
   P[id+':rot']=(P[id+':rot']||0)+sign*wrap(bend-wrap(Math.atan2(b[1],b[0])-Math.atan2(a[1],a[0])));
  }
  for(let i=0;i<32;i++){
   for(const joint of [id,drag.upper]){
    const M=boneMatrices(drag.project,P,drag.base),b=drag.project.bones.find(b=>b.id===joint),parent=b.parent?M[b.parent]:drag.base;
    const end=inversePoint(parent,...point(M[id],...drag.tip)),target=inversePoint(parent,...xy),center=[b.at[0]+(P[joint+':dx']||0),b.at[1]+(P[joint+':dy']||0)];
    const a=[end[0]-center[0],end[1]-center[1]],t=[target[0]-center[0],target[1]-center[1]];if(Math.hypot(...a)<1e-7||Math.hypot(...t)<1e-7)continue;
    P[joint+':rot']=(P[joint+':rot']||0)+Math.max(-.4,Math.min(.4,wrap(Math.atan2(t[1],t[0])-Math.atan2(a[1],a[0]))));
   }
   const end=point(boneMatrices(drag.project,P,drag.base)[id],...drag.tip);if(Math.hypot(end[0]-xy[0],end[1]-xy[1])<.15)break;
  }return P;
 }
 const v=drag.virtual?[drag.ref[0]+p[0]-drag.start[0],drag.ref[1]+p[1]-drag.start[1]]:[p[0]-drag.center[0],p[1]-drag.center[1]];
 if(Math.hypot(...v)>1e-7){const angle=Math.atan2(v[1],v[0]);drag.total+=wrap(angle-drag.lastAngle);drag.lastAngle=angle}
 P[id+':rot']=(drag.pose[id+':rot']||0)+drag.total;return P;
}
export function restoreBoneOffsets(pose,ids,reference={}){const P=clone(pose);for(const id of ids)for(const field of ['dx','dy'])P[id+':'+field]=reference[id+':'+field]||0;return P}
