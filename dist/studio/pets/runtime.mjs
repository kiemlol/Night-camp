// Standalone rigid-cutout runtime. No Spine, weighted vertices, game globals or DOM editor dependencies.
export const curves={lin:t=>t,in:t=>t*t,out:t=>1-(1-t)**2,inout:t=>t<.5?2*t*t:1-2*(1-t)**2,snap:t=>1-(1-t)**4,back:t=>{const u=t-1;return u*u*(3.2*u+2.2)+1},step:()=>0};
const fail=message=>{throw Error(message)};
const reserved=new Set(['__proto__','constructor','prototype']);
export function validatePet(p){
 if(p?.format!=='nightcamp-pet-cutout-v1')fail('Không đúng định dạng pet cutout');
 if(typeof p.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(p.id)||reserved.has(p.id)||typeof p.name!=='string'||!p.name.trim())fail('Tên / ID pet không hợp lệ');
 if(p.activeClipId!==undefined&&(typeof p.activeClipId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(p.activeClipId)||reserved.has(p.activeClipId)))fail('ID clip không hợp lệ');
 if(!Number.isFinite(p.scale)||p.scale<=0||p.scale>10||!Array.isArray(p.bones)||!p.bones.length||p.bones.length>100)fail('Rig pet không hợp lệ');
 if(!p.sprites||!Array.isArray(p.spriteOrder)||p.spriteOrder.length>300||new Set(p.spriteOrder).size!==p.spriteOrder.length)fail('Danh mục ảnh không hợp lệ');
 for(const id of p.spriteOrder){const s=p.sprites[id];if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id)||reserved.has(id)||!s||![s.w,s.h].every(v=>Number.isFinite(v)&&v>0&&v<=2000)||typeof s.src!=='string'||!(/^assets\/[\w./-]+\.(png|webp)$/.test(s.src)&&!s.src.split('/').includes('..')||/^data:image\/(png|webp);base64,[A-Za-z0-9+/=]+$/.test(s.src)))fail('Ảnh pet không hợp lệ: '+id)}
 const ids=new Set(p.bones.map(b=>b.id));if(ids.size!==p.bones.length)fail('Trùng ID xương');
 for(const b of p.bones){
  if(b.name!==undefined&&(typeof b.name!=='string'||!b.name.trim()||b.name.length>100)||b.rotation!==undefined&&(!Number.isFinite(b.rotation)||Math.abs(b.rotation)>Math.PI*20))fail('Tên / góc gốc của xương không hợp lệ');
  if(typeof b.id!=='string'||!/^[a-zA-Z0-9_-]{1,60}$/.test(b.id)||reserved.has(b.id)||b.parent!==null&&!ids.has(b.parent)||b.sprite!==null&&!p.spriteOrder.includes(b.sprite))fail('Liên kết xương / ảnh không hợp lệ');
  if(![b.at,b.pivot].every(a=>Array.isArray(a)&&a.length===2&&a.every(v=>Number.isFinite(v)&&Math.abs(v)<=2000))||b.pivot.some(v=>v<0||v>1)||!Number.isFinite(b.scale)||b.scale<=0||b.scale>10)fail('Điểm neo / tỷ lệ không hợp lệ');
  for(const [id,pivot]of Object.entries(b.variantPivots||{}))if(!p.spriteOrder.includes(id)||!Array.isArray(pivot)||pivot.length!==2||!pivot.every(v=>Number.isFinite(v)&&v>=0&&v<=1))fail('Điểm neo biến thể không hợp lệ');
  const seen=new Set([b.id]);let parent=b.parent;while(parent!==null){if(seen.has(parent))fail('Xương không được tạo vòng lặp');seen.add(parent);parent=p.bones.find(n=>n.id===parent)?.parent??null}
 }
 const check=c=>{
  if(!c||typeof c.name!=='string'||!c.name.trim()||!['loop','walk','attack','pose'].includes(c.kind)||!Number.isFinite(c.dur)||c.dur<.1||c.dur>30||!Number.isFinite(c.hit)||c.hit<0||c.hit>c.dur||!Array.isArray(c.keys)||!c.keys.length||c.keys.length>2000)fail('Animation pet không hợp lệ');
  const times=new Set();for(const k of c.keys){if(!Number.isFinite(k.t)||k.t<0||k.t>c.dur||times.has(k.t)||!Object.hasOwn(curves,k.curve)||!k.P)fail('Keyframe pet không hợp lệ');times.add(k.t);for(const [ch,v]of Object.entries(k.P)){const [id,field,...extra]=ch.split(':');if(extra.length||!ids.has(id)||!['rot','dx','dy','sx','sy','img','hide'].includes(field)||(field==='hide'?typeof v!=='boolean':!Number.isFinite(v))||typeof v==='boolean'&&field!=='hide')fail('Kênh pose không hợp lệ');if(field==='img'&&(!Number.isInteger(v)||v< -1||v>=p.spriteOrder.length))fail('Biến thể ảnh không hợp lệ');if((field==='sx'||field==='sy')&&Math.abs(v)>10)fail('Tỷ lệ pose không hợp lệ')}}
 };
 check(p.clip);if(p.clips){if(Object.keys(p.clips).length>100)fail('Quá nhiều clip');for(const [id,c]of Object.entries(p.clips)){if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id)||reserved.has(id))fail('ID clip không hợp lệ');check(c)}}return p;
}
export function samplePet(clip,time){
 const keys=[...clip.keys].sort((a,b)=>a.t-b.t);if(time<=keys[0].t)return structuredClone(keys[0].P);
 for(let i=1;i<keys.length;i++){if(time===keys[i].t)return structuredClone(keys[i].P);if(time<keys[i].t){const a=keys[i-1],b=keys[i],u=(curves[a.curve]||curves.inout)((time-a.t)/(b.t-a.t));return Object.fromEntries([...new Set([...Object.keys(a.P),...Object.keys(b.P)])].map(ch=>{const av=a.P[ch]??b.P[ch],bv=b.P[ch]??av;return [ch,ch.endsWith(':img')||ch.endsWith(':hide')?av:av+(bv-av)*u]}))}}
 return structuredClone(keys.at(-1).P);
}
export const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
export const point=(m,x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
export function inversePoint(m,x,y){const d=m[0]*m[3]-m[1]*m[2];if(Math.abs(d)<1e-8)throw Error('Xương đang có tỷ lệ 0; tăng tỷ lệ trước khi kéo');return [(m[3]*(x-m[4])-m[2]*(y-m[5]))/d,(-m[1]*(x-m[4])+m[0]*(y-m[5]))/d]}
export function boneMatrices(p,pose,base=[1,0,0,1,0,0]){
 const result=Object.create(null),byId=Object.fromEntries(p.bones.map(b=>[b.id,b]));
 const get=id=>{if(result[id])return result[id];const b=byId[id],a=(b.rotation||0)+(pose[id+':rot']||0),c=Math.cos(a),s=Math.sin(a),sx=(pose[id+':sx']??1)*b.scale,sy=(pose[id+':sy']??1)*b.scale;return result[id]=multiply(b.parent?get(b.parent):base,[c*sx,s*sx,-s*sy,c*sy,b.at[0]+(pose[id+':dx']||0),b.at[1]+(pose[id+':dy']||0)])};
 for(const b of p.bones)get(b.id);return result;
}
export function activeSprite(p,pose,b){const index=pose[b.id+':img']??-1;return index>=0?p.spriteOrder[index]:b.sprite}
export function spritePivot(p,pose,b){const id=activeSprite(p,pose,b);return id!==b.sprite&&b.variantPivots?.[id]||b.pivot}
export function poseBounds(p,pose){const M=boneMatrices(p,pose),xs=[],ys=[];for(const b of p.bones){const s=p.sprites[activeSprite(p,pose,b)],pivot=spritePivot(p,pose,b);if(!s||b.visible===false||pose[b.id+':hide'])continue;for(const x of [-pivot[0]*s.w,(1-pivot[0])*s.w])for(const y of [-pivot[1]*s.h,(1-pivot[1])*s.h]){const at=point(M[b.id],x,y);xs.push(at[0]);ys.push(at[1])}}return xs.length?{x0:Math.min(...xs),y0:Math.min(...ys),x1:Math.max(...xs),y1:Math.max(...ys)}:{x0:-30,y0:-60,x1:30,y1:0}}
export function drawPet(ctx,p,pose,images,base=[1,0,0,1,0,0],{bones=false,selected=null}={}){
 const M=boneMatrices(p,pose,base);
 for(const b of p.bones){const id=activeSprite(p,pose,b),s=p.sprites[id],pivot=spritePivot(p,pose,b),img=images instanceof Map?images.get(id):images[id];if(!s||!img||b.visible===false||pose[b.id+':hide'])continue;ctx.save();ctx.transform(...M[b.id]);if(b.dark)ctx.globalAlpha*=.76;ctx.drawImage(img,-pivot[0]*s.w,-pivot[1]*s.h,s.w,s.h);ctx.restore()}
 if(bones){ctx.save();ctx.lineWidth=1.5;for(const b of p.bones){const m=M[b.id];ctx.strokeStyle='#d3ed9299';if(b.parent){ctx.beginPath();ctx.moveTo(M[b.parent][4],M[b.parent][5]);ctx.lineTo(m[4],m[5]);ctx.stroke()}ctx.fillStyle=b.id===selected?'#ffbd80':'#d3ed92';ctx.beginPath();ctx.arc(m[4],m[5],b.id===selected?6:3.5,0,Math.PI*2);ctx.fill()}ctx.restore()}return M;
}
export class PetCutoutPlayer{
 static async load(project,resolve=src=>src){const p=structuredClone(validatePet(project)),images=new Map();await Promise.all(p.spriteOrder.map(async id=>{const img=new Image();img.crossOrigin='anonymous';await new Promise((ok,no)=>{img.onload=ok;img.onerror=()=>no(Error('Không tải được ảnh '+id));img.src=resolve(p.sprites[id].src)});images.set(id,img)}));return new PetCutoutPlayer(p,images)}
 constructor(project,images){this.project=project;this.images=images;this.clip=project.clip;this.time=0;this.pose=samplePet(this.clip,0)}
 play(id){const clip=this.project.clips?.[id];if(!clip)throw Error('Không có clip '+id);this.clip=clip;this.time=0;this.pose=samplePet(clip,0)}
 update(dt){this.time+=Math.max(0,dt);if(['loop','walk'].includes(this.clip.kind))this.time%=this.clip.dur;else this.time=Math.min(this.time,this.clip.dur);this.pose=samplePet(this.clip,this.time);return this.pose}
 draw(ctx,x,y,scale=1,{flip=false,bones=false}={}){const k=scale*this.project.scale;return drawPet(ctx,this.project,this.pose,this.images,[flip?-k:k,0,0,k,x,y],{bones})}
}
