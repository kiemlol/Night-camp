export const SOCKETS=['head','face','handF','handB'];
export function validateAttachments(list=[]){
 if(!Array.isArray(list)||list.length>32)throw Error('Tối đa 32 phụ kiện');
 const ids=new Set();for(const a of list){
  if(!a||typeof a.id!=='string'||ids.has(a.id)||typeof a.name!=='string'||!SOCKETS.includes(a.socket)||!['front','back'].includes(a.layer))throw Error('Phụ kiện hoặc điểm gắn không hợp lệ');ids.add(a.id);
  if(typeof a.src!=='string'||!(/^assets\/[\w./-]+\.(png|webp|jpg)$/.test(a.src)||/^data:image\/(png|webp);base64,[A-Za-z0-9+/=]+$/.test(a.src)))throw Error('Ảnh phụ kiện không hợp lệ');
  if(![a.w,a.h,a.scale,a.x,a.y,a.rotation].every(Number.isFinite)||a.w<1||a.h<1||a.w>2000||a.h>2000||a.scale<.05||a.scale>10||Math.abs(a.x)>2000||Math.abs(a.y)>2000||Math.abs(a.rotation)>Math.PI*20)throw Error('Kích thước / góc phụ kiện không hợp lệ');
  if(!Array.isArray(a.anchor)||a.anchor.length!==2||!a.anchor.every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw Error('Điểm neo phải nằm trong ảnh');
 }
 return list;
}
let sequence=0;
export function makeAttachment(entry,headWidth=72){
 const s=entry.sprite,isWeapon=entry.category==='weapon',glasses=entry.category==='glasses',w=isWeapon?s.w*.95:headWidth*(glasses ? .85 : entry.fit||1.3),h=w*s.h/s.w;
 const raw=[s.ax??.5,isWeapon?1-(entry.grip??.2):glasses ? .5 : s.brim??1],anchor=raw.map(v=>Math.max(0,Math.min(1,v)));
 return {id:'attachment_'+Date.now()+'_'+ ++sequence,name:entry.name||entry.id,sourceId:entry.id,src:s.src,socket:isWeapon?'handF':glasses?'face':'head',layer:isWeapon?'back':'front',w,h,scale:1,x:(isWeapon?0:(entry.dx||0)*headWidth)+(anchor[0]-raw[0])*w,y:(isWeapon||glasses?0:(entry.seat||0)*headWidth)+(anchor[1]-raw[1])*h,rotation:0,anchor,visible:true};
}
export function screenDelta(matrix,dx,dy){const det=matrix.a*matrix.d-matrix.b*matrix.c;if(Math.abs(det)<1e-8)throw Error('Không thể kéo ở tỷ lệ này');return [(matrix.d*dx-matrix.c*dy)/det,(-matrix.b*dx+matrix.a*dy)/det]}
