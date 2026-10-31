import {validatePet,boneMatrices,point,inversePoint} from './runtime.mjs';
const clone=p=>structuredClone(p);
const bone=(p,id)=>{const b=p.bones.find(b=>b.id===id);if(!b)throw Error('Không tìm thấy xương '+id);return b};
const finish=p=>validatePet(p);
const clips=p=>[p.clip,...Object.values(p.clips||{})];
export function createBlankPet(id='custom_pet',name='Pet mới'){
 const clip={name:'Đứng',kind:'loop',dur:1,hit:0,keys:[{t:0,curve:'lin',P:{}}]};
 return finish({format:'nightcamp-pet-cutout-v1',id,name,scale:1,sprites:{},spriteOrder:[],bones:[{id:'root',name:'Gốc',parent:null,sprite:null,pivot:[.5,.5],at:[0,0],scale:1,rotation:0,visible:true}],clip,clips:{idle:clone(clip)},activeClipId:'idle'});
}
export function descendants(p,id){const found=new Set([id]);let changed=true;while(changed){changed=false;for(const b of p.bones)if(found.has(b.parent)&&!found.has(b.id)){found.add(b.id);changed=true}}return found}
export function addPetBone(project,{id,name=id,parent=null,world=null,at=[0,-20]}){
 const p=clone(project);if(parent!==null)bone(p,parent);const M=boneMatrices(p,{});
 p.bones.push({id,name,parent,sprite:null,pivot:[.5,.5],at:world?(parent?inversePoint(M[parent],...world):[...world]):[...at],scale:1,rotation:0,visible:true});
 // Missing pose channels have neutral defaults. Existing frames are left intact.
 return finish(p);
}
export function renamePoseChannels(pose,from,to){return Object.fromEntries(Object.entries(pose).map(([key,v])=>[key.startsWith(from+':')?to+key.slice(from.length):key,v]))}
export function renamePetBone(project,id,newId,name){
 const p=clone(project),b=bone(p,id);if(id!==newId&&p.bones.some(b=>b.id===newId))throw Error('ID xương đã tồn tại');b.id=newId;b.name=name;
 for(const child of p.bones)if(child.parent===id)child.parent=newId;
 for(const c of clips(p))for(const key of c.keys)key.P=renamePoseChannels(key.P,id,newId);
 return finish(p);
}
function attachAtRest(p,id,parent,M){
 const b=bone(p,id),m=M[id],to=parent?M[parent]:[1,0,0,1,0,0];
 b.parent=parent;b.at=inversePoint(to,m[4],m[5]);
 b.rotation=Math.atan2(m[1],m[0])-Math.atan2(to[1],to[0]);
 b.scale=Math.hypot(m[0],m[1])/Math.hypot(to[0],to[1]);
}
export function reparentPetBone(project,id,parent){
 const p=clone(project);bone(p,id);if(parent!==null){bone(p,parent);if(descendants(p,id).has(parent))throw Error('Không thể nối xương vào chính nó hoặc xương con');}
 attachAtRest(p,id,parent,boneMatrices(p,{}));return finish(p);
}
export function deletePetBone(project,id,subtree=false){
 const p=clone(project),b=bone(p,id),removed=subtree?descendants(p,id):new Set([id]);
 if(removed.size===p.bones.length)throw Error('Giữ ít nhất một xương gốc. Có thể tạo pet trống để bắt đầu lại.');
 if(!subtree){const M=boneMatrices(p,{});for(const child of p.bones)if(child.parent===id)attachAtRest(p,child.id,b.parent,M)}
 p.bones=p.bones.filter(b=>!removed.has(b.id));
 for(const c of clips(p))for(const key of c.keys)key.P=Object.fromEntries(Object.entries(key.P).filter(([ch])=>!removed.has(ch.split(':')[0])));
 return finish(p);
}
export function setPetPivot(project,id,pivot){
 const p=clone(project),b=bone(p,id),s=p.sprites[b.sprite];if(!s)throw Error('Gán ảnh cho xương trước khi đặt khớp trên ảnh');
 if(!pivot.every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw Error('Điểm xoay phải nằm trong ảnh');
 const d=[(pivot[0]-b.pivot[0])*s.w,(pivot[1]-b.pivot[1])*s.h],a=b.rotation||0,c=Math.cos(a)*b.scale,sn=Math.sin(a)*b.scale;
 b.at=[b.at[0]+c*d[0]-sn*d[1],b.at[1]+sn*d[0]+c*d[1]];b.pivot=[...pivot];
 // Keep the picture and child joints still while relocating the rest pivot.
 for(const child of p.bones)if(child.parent===id)child.at=[child.at[0]-d[0],child.at[1]-d[1]];
 return finish(p);
}
export function movePetBone(project,id,world){
 const p=clone(project),b=bone(p,id),M=boneMatrices(p,{});b.at=b.parent?inversePoint(M[b.parent],...world):[...world];return finish(p);
}
export function pivotAtWorld(project,id,world){const b=bone(project,id),s=project.sprites[b.sprite];if(!s)throw Error('Xương này chưa có ảnh');const xy=inversePoint(boneMatrices(project,{})[id],...world);return [Math.max(0,Math.min(1,b.pivot[0]+xy[0]/s.w)),Math.max(0,Math.min(1,b.pivot[1]+xy[1]/s.h))]}
export function rigBounds(p){const M=boneMatrices(p,{}),xy=Object.values(M).map(m=>point(m,0,0));return {x0:Math.min(...xy.map(p=>p[0]),-30),x1:Math.max(...xy.map(p=>p[0]),30),y0:Math.min(...xy.map(p=>p[1]),-60),y1:Math.max(...xy.map(p=>p[1]),0)}}
