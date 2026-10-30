import {connectSource} from '../source.mjs';
import {blankClip,appendInheritedFrame,copyPoseToFrames} from '../timeline.mjs';
import {validatePet,samplePet,boneMatrices,activeSprite,poseBounds,drawPet,inversePoint} from './runtime.mjs';
const $=id=>document.getElementById(id),clone=v=>structuredClone(v),message=text=>$('status').textContent=text;
const safe=fn=>async(...args)=>{try{return await fn(...args)}catch(e){message('Lỗi: '+e.message);console.error(e)}};
const on=(id,event,fn)=>$(id).addEventListener(event,safe(fn));
const options=(select,rows)=>select.replaceChildren(...rows.map(([id,label])=>new Option(label,id)));
const names={body:'Thân',head:'Đầu',tail:'Đuôi',tailA:'Gốc đuôi',tailB:'Ngọn đuôi',legF:'Chân trước gần',legFf:'Chân trước xa',legB:'Chân sau gần',legBf:'Chân sau xa',wingI:'Cánh trong gần',wingO:'Cánh ngoài gần',wingFi:'Cánh trong xa',wingFo:'Cánh ngoài xa',leg:'Chân gần',legf:'Chân xa',fold:'Cánh gập',flame:'Lửa đuôi',ring:'Vòng treo',frame:'Khung đèn',ghost:'Tinh linh',wisp:'Dải đuôi',pelvis:'Hông',torso:'Thân trên',armN:'Bắp tay gần',foreN:'Cẳng tay gần',armF:'Bắp tay xa',foreF:'Cẳng tay xa',thighN:'Đùi gần',shinN:'Cẳng chân gần',thighF:'Đùi xa',shinF:'Cẳng chân xa',wpnU:'Vũ khí sau tay',wpnO:'Vũ khí trước tay'};
const label=b=>names[b.id]||b.id;
const state={project:null,pose:null,bone:null,key:0,time:0,playing:false,images:new Map(),undo:[],redo:[],bounds:null};
const cache=new Map();let source,catalog,adoption=0,drag=null,anchorRect=null,copySource=null;
const ctx=$('stage').getContext('2d'),anchorCtx=$('anchor').getContext('2d');
function checkpoint(){state.undo.push(JSON.stringify(state.project));if(state.undo.length>50)state.undo.shift();state.redo=[]}
function stash(){state.project.clips||={};state.project.clips[state.project.activeClipId||'custom']=clone(state.project.clip)}
function persist(){stash();try{localStorage.setItem('nightcamp.pet.cutout.v1',JSON.stringify(state.project))}catch{message('Bộ nhớ nháp pet đầy. Bấm Lưu project để tải bản sao.')}}
async function image(src){const url=source.assetURL(src);if(!cache.has(url))cache.set(url,new Promise((ok,no)=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>ok(img);img.onerror=()=>{cache.delete(url);no(Error('Không tải được ảnh '+src.slice(0,100)))};img.src=url}));return cache.get(url)}
function busy(value){document.querySelector('main').setAttribute('aria-busy',String(value));for(const n of document.querySelectorAll('main button,main input,main select,#desktopSave'))n.disabled=value}
async function adopt(p){
 validatePet(p);const version=++adoption,next=clone(p),images=new Map();
 busy(true);message('Đang tải '+next.name+'…');
 try{
 await Promise.all(next.spriteOrder.map(async id=>images.set(id,await image(next.sprites[id].src))));if(version!==adoption)return;
 state.project=next;state.images=images;state.bone=next.bones.some(b=>b.id===state.bone)?state.bone:next.bones.find(b=>b.sprite)?.id||next.bones[0].id;
 pause();state.time=0;state.key=0;state.pose=samplePet(next.clip,0);refit();renderAll();persist();
 }finally{if(version===adoption){busy(false);if(state.project)renderBone()}}
}
function pause(){state.playing=false;$('play').textContent='▶ Phát'}
function selected(){return state.project.bones.find(b=>b.id===state.bone)}
function refit(){
 const p=state.project,boxes=p.clip.keys.map(k=>poseBounds(p,k.P));
 for(let i=1;i<p.clip.keys.length;i++)boxes.push(poseBounds(p,samplePet(p.clip,(p.clip.keys[i-1].t+p.clip.keys[i].t)/2)));
 state.bounds={x0:Math.min(...boxes.map(b=>b.x0))-4,y0:Math.min(...boxes.map(b=>b.y0))-4,x1:Math.max(...boxes.map(b=>b.x1))+4,y1:Math.max(...boxes.map(b=>b.y1))+4};
}
function view(){const r=$('stage').getBoundingClientRect(),b=state.bounds||{x0:-50,x1:50,y0:-60,y1:0};const k=Math.max(.05,Math.min((r.width-36)/Math.max(1,b.x1-b.x0),(r.height-32)/Math.max(1,b.y1-b.y0)))*Number($('zoom').value),face=$('flip').checked?-1:1;return [k*face,0,0,k,r.width/2-(b.x0+b.x1)/2*k*face,r.height/2-(b.y0+b.y1)/2*k]}
function renderPose(){if(!state.pose)return;const id=state.bone;for(const [field,ch]of [['rotation','rot'],['dx','dx'],['dy','dy'],['sx','sx'],['sy','sy']])$(field).value=Number(((state.pose[id+':'+ch]??(ch==='sx'||ch==='sy'?1:0))*(ch==='rot'?180/Math.PI:1)).toFixed(4));$('variant').value=state.pose[id+':img']??-1;$('poseHide').checked=!!state.pose[id+':hide']}
function renderBone(){
 const p=state.project,b=selected();$('bone').value=$('poseBone').value=b.id;
 options($('parent'),[['','— Gốc / không có cha —'],...p.bones.filter(n=>n.id!==b.id).map(n=>[n.id,label(n)])]);$('parent').value=b.parent||'';
 options($('sprite'),[['','— Xương trống / khớp trung gian —'],...p.spriteOrder.map(id=>[id,id])]);$('sprite').value=b.sprite||'';
 options($('variant'),[[-1,'Ảnh mặc định của bộ phận'],...p.spriteOrder.map((id,i)=>[i,id])]);
 const s=p.sprites[b.sprite];$('width').value=s?.w||'';$('height').value=s?.h||'';$('width').disabled=$('height').disabled=!s;
 $('pivotX').value=b.pivot[0];$('pivotY').value=b.pivot[1];$('atX').value=b.at[0];$('atY').value=b.at[1];$('boneScale').value=b.scale;$('visible').checked=b.visible!==false;
 for(const button of $('boneList').children)button.classList.toggle('selected',button.dataset.bone===b.id);
 renderPose();
}
function renderKeys(){const c=state.project.clip;options($('curve'),[['lin','Đều'],['inout','Mượt'],['in','Chậm → nhanh'],['out','Nhanh → chậm'],['snap','Bật nhanh'],['back','Vượt rồi về'],['step','Giữ pose']]);$('keys').replaceChildren(...c.keys.map((k,i)=>{const b=document.createElement('button');b.textContent=`${i+1} · ${k.t.toFixed(2)}s`;b.className=i===state.key?'selected':'';b.setAttribute('aria-pressed',String(i===state.key));b.onclick=()=>selectKey(i);return b}));$('scrub').max=c.dur;$('scrub').value=state.time;$('clock').textContent=state.time.toFixed(2)+' s';$('keyTime').value=c.keys[state.key].t;$('curve').value=c.keys[state.key].curve}
function renderAll(){
 const p=state.project;options($('bone'),p.bones.map(b=>[b.id,label(b)]));options($('poseBone'),p.bones.map(b=>[b.id,label(b)]));
 $('boneList').replaceChildren(...p.bones.map(b=>{const n=document.createElement('button');n.dataset.bone=b.id;n.textContent=label(b);n.onclick=()=>{state.bone=b.id;renderBone()};return n}));
 $('petName').value=p.name;$('petId').value=p.id;$('clipName').value=p.clip.name;$('kind').value=p.clip.kind;$('duration').value=p.clip.dur;$('hit').value=p.clip.hit;
 options($('preset'),Object.entries(p.clips||{}).map(([id,c])=>[id,c.name]));$('preset').value=p.activeClipId||'idle';
 $('petInfo').textContent=`${p.bones.length} xương · ${p.spriteOrder.length} ảnh/biến thể · ${Object.keys(p.clips||{}).length} clip. Chuyển động mẫu lấy phương trình pose cutout gốc; không có AI chiến đấu.`;
 renderBone();renderKeys();
}
function selectKey(i){pause();state.key=i;state.time=state.project.clip.keys[i].t;state.pose=samplePet(state.project.clip,state.time);renderKeys();renderPose()}
function mutate(fn){const p=clone(state.project);fn(p);validatePet(p);checkpoint();state.project=p;refit();renderAll();persist()}
function record(){checkpoint();const c=state.project.clip,t=Math.round(state.time*1e6)/1e6,k={t,curve:$('curve').value,P:clone(state.pose)},index=c.keys.findIndex(k=>Math.abs(k.t-t)<1e-6);if(index>=0)c.keys[index]=k;else c.keys.push(k);c.keys.sort((a,b)=>a.t-b.t);state.key=c.keys.indexOf(k);refit();renderKeys();persist();message('Đã ghi pose pet vào frame '+(state.key+1))}
on('bone','change',()=>{state.bone=$('bone').value;renderBone()});on('poseBone','change',()=>{state.bone=$('poseBone').value;renderBone()});
on('pet','change',async()=>{if(!catalog.rigs[$('pet').value])return;checkpoint();await adopt({...clone(catalog.rigs[$('pet').value]),activeClipId:'idle'});message('Đã mở '+state.project.name+' · cutout, không mesh')});
on('clonePet','click',()=>{const id=prompt('ID pet mới (chữ Latin, số, _ hoặc -):','custom_pet');if(!id)return;mutate(p=>{p.id=id;p.name='Pet mới · '+id});message('Đã tạo pet mới. Thay ảnh và chỉnh khớp rồi lưu project.')});
on('loadPreset','click',()=>{const id=$('preset').value,c=state.project.clips?.[id];if(!c)throw Error('Chọn clip trước');checkpoint();stash();state.project.activeClipId=id;state.project.clip=clone(c);selectKey(0);refit();renderAll();persist();message('Đã nạp '+c.name)});
on('play','click',()=>{state.playing=!state.playing;if(state.time>=state.project.clip.dur)state.time=0;$('play').textContent=state.playing?'Ⅱ Dừng':'▶ Phát'});on('record','click',record);
on('scrub','input',()=>{pause();state.time=Number($('scrub').value);state.key=state.project.clip.keys.reduce((best,k,i)=>Math.abs(k.t-state.time)<Math.abs(state.project.clip.keys[best].t-state.time)?i:best,0);state.pose=samplePet(state.project.clip,state.time);renderKeys();renderPose()});
for(const [field,ch]of [['rotation','rot'],['dx','dx'],['dy','dy'],['sx','sx'],['sy','sy']])on(field,'change',()=>{const n=$(field).valueAsNumber;if(!Number.isFinite(n)||((ch==='sx'||ch==='sy')&&Math.abs(n)>10))throw Error('Giá trị pose không hợp lệ');pause();state.pose[state.bone+':'+ch]=ch==='rot'?n*Math.PI/180:n;message('Pose chưa ghi — bấm Ghi pose hoặc thêm frame để lưu')});
on('variant','change',()=>{pause();state.pose[state.bone+':img']=Number($('variant').value);message('Biến thể chưa ghi — bấm Ghi pose')});on('poseHide','change',()=>{pause();state.pose[state.bone+':hide']=$('poseHide').checked;message('Thay đổi chưa ghi — bấm Ghi pose')});
for(const [field,target,index]of [['pivotX','pivot',0],['pivotY','pivot',1],['atX','at',0],['atY','at',1]])on(field,'change',()=>mutate(p=>{p.bones.find(b=>b.id===state.bone)[target][index]=$(field).valueAsNumber}));
on('boneScale','change',()=>mutate(p=>{p.bones.find(b=>b.id===state.bone).scale=$('boneScale').valueAsNumber}));
on('parent','change',()=>mutate(p=>{p.bones.find(b=>b.id===state.bone).parent=$('parent').value||null}));
on('sprite','change',()=>mutate(p=>{p.bones.find(b=>b.id===state.bone).sprite=$('sprite').value||null}));
on('visible','change',()=>mutate(p=>{p.bones.find(b=>b.id===state.bone).visible=$('visible').checked}));
for(const [field,key]of [['width','w'],['height','h']])on(field,'change',()=>mutate(p=>{const id=p.bones.find(b=>b.id===state.bone).sprite;p.sprites[id][key]=$(field).valueAsNumber}));
for(const [id,delta]of [['layerBack',-1],['layerFront',1]])on(id,'click',()=>mutate(p=>{const i=p.bones.findIndex(b=>b.id===state.bone),j=Math.max(0,Math.min(p.bones.length-1,i+delta));const [b]=p.bones.splice(i,1);p.bones.splice(j,0,b)}));
on('addBone','click',()=>{const id=prompt('ID bộ phận con mới:','extra_'+(state.project.bones.length+1));if(!id)return;const parent=state.bone;mutate(p=>{p.bones.push({id,parent,sprite:null,pivot:[.5,.5],at:[0,0],scale:1,visible:true});for(const c of [p.clip,...Object.values(p.clips)])for(const k of c.keys)Object.assign(k.P,{[id+':rot']:0,[id+':dx']:0,[id+':dy']:0,[id+':sx']:1,[id+':sy']:1,[id+':img']:-1,[id+':hide']:false})});state.bone=id;renderBone();message('Đã thêm xương con. Chọn ảnh hoặc tải ảnh riêng để gắn vào.')});
on('upload','click',()=>$('imageFile').click());on('imageFile','change',async()=>{
 const file=$('imageFile').files[0];if(!file)return;try{
  if(!['image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('Ảnh PNG/WebP tối đa 8 MB');
  const src=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(file)}),img=await image(src),id='custom_'+Date.now().toString(36),old=state.project.sprites[selected().sprite];
  const s={src,w:old?.w||Math.min(80,img.naturalWidth),h:old?.h||Math.min(80,img.naturalWidth)*img.naturalHeight/img.naturalWidth};
  const p=clone(state.project);p.sprites[id]=s;p.spriteOrder.push(id);p.bones.find(b=>b.id===state.bone).sprite=id;checkpoint();await adopt(p);message('Đã gắn ảnh riêng. Chỉnh điểm neo để khớp với bộ phận cha.')
 }finally{$('imageFile').value=''}
});
on('newAnimation','click',()=>{$('newError').textContent='';$('newDialog').showModal()});on('cancelNew','click',()=>$('newDialog').close());
$('newForm').onsubmit=e=>{e.preventDefault();try{const clip=blankClip({name:$('newName').value,dur:$('newDuration').valueAsNumber,pose:state.pose});checkpoint();stash();state.project.clip=clip;state.project.activeClipId='clip_'+Date.now().toString(36);selectKey(0);refit();persist();renderAll();$('newDialog').close();message('Đã tạo animation pet mới với 1 frame')}catch(error){$('newError').textContent=error.message}};
on('addFrame','click',()=>{const r=appendInheritedFrame(state.project.clip,state.key,state.pose,$('frameStep').valueAsNumber);checkpoint();state.project.clip=r.clip;selectKey(r.index);refit();persist();renderAll();message('Frame mới kế thừa tư thế vừa chỉnh')});
on('deleteKey','click',()=>{if(state.project.clip.keys.length===1)throw Error('Phải giữ ít nhất 1 frame');checkpoint();state.project.clip.keys.splice(state.key,1);selectKey(0);refit();persist()});
on('keyTime','change',()=>{const t=$('keyTime').valueAsNumber,c=state.project.clip;if(!Number.isFinite(t)||t<0||t>c.dur||c.keys.some((k,i)=>i!==state.key&&k.t===t))throw Error('Thời điểm trùng hoặc nằm ngoài clip');checkpoint();const k=c.keys[state.key];k.t=t;c.keys.sort((a,b)=>a.t-b.t);selectKey(c.keys.indexOf(k));persist()});
on('curve','change',()=>{checkpoint();state.project.clip.keys[state.key].curve=$('curve').value;persist()});
for(const id of ['clipName','kind','duration','hit'])on(id,'change',()=>{const p=clone(state.project),c=p.clip,d=$('duration').valueAsNumber;if(!Number.isFinite(d)||d<.1||d>30)throw Error('Thời lượng 0.1–30 giây');const ratio=d/c.dur;c.keys.forEach(k=>k.t*=ratio);c.dur=d;c.name=$('clipName').value;c.kind=$('kind').value;c.hit=$('hit').valueAsNumber;validatePet(p);checkpoint();state.project=p;selectKey(0);refit();renderAll();persist()});
on('keepClip','click',()=>{const id=prompt('ID clip trong bộ animation:',state.project.activeClipId||'custom');if(!id)return;if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id))throw Error('ID clip chỉ dùng chữ Latin, số, _ và -');checkpoint();state.project.activeClipId=id;persist();renderAll();message('Đã lưu clip '+id+' trong bộ animation của pet')});
on('copyPose','click',()=>{pause();copySource={clip:state.project.clip,index:state.key,pose:clone(state.pose)};$('copySource').textContent='Nguồn: Frame '+(state.key+1)+'. Chọn các frame đích; giữ thời điểm và đường cong.';$('copyTargets').replaceChildren(...state.project.clip.keys.flatMap((k,i)=>{if(i===state.key)return [];const label=document.createElement('label'),n=document.createElement('input');n.type='checkbox';n.value=i;label.append(n,document.createTextNode(` Frame ${i+1} · ${k.t.toFixed(2)}s`));return [label]}));$('copyDialog').showModal()});
on('copyAll','click',()=>$('copyTargets').querySelectorAll('input').forEach(n=>n.checked=true));on('copyNone','click',()=>$('copyTargets').querySelectorAll('input').forEach(n=>n.checked=false));on('cancelCopy','click',()=>$('copyDialog').close());
on('applyCopy','click',()=>{if(state.project.clip!==copySource.clip)throw Error('Clip đã thay đổi, mở lại hộp sao chép');const targets=[...$('copyTargets').querySelectorAll('input:checked')].map(n=>Number(n.value)),r=copyPoseToFrames(state.project.clip,copySource.index,targets,copySource.pose);checkpoint();state.project.clip=r.clip;selectKey(copySource.index);refit();persist();$('copyDialog').close();message('Đã sao chép pose sang '+r.count+' frame')});
for(const [id,from,to]of [['undo','undo','redo'],['redo','redo','undo']])on(id,'click',async()=>{if(!state[from].length)return;state[to].push(JSON.stringify(state.project));await adopt(JSON.parse(state[from].pop()))});
for(const [id,key]of [['petName','name'],['petId','id']])on(id,'change',()=>mutate(p=>p[key]=$(id).value.trim()));
on('anchor','pointerdown',e=>{e.preventDefault();if(!anchorRect)return;const r=$('anchor').getBoundingClientRect(),x=(e.clientX-r.left)*280/r.width,y=(e.clientY-r.top)*220/r.height;mutate(p=>{p.bones.find(b=>b.id===state.bone).pivot=[Math.max(0,Math.min(1,(x-anchorRect.x)/anchorRect.w)),Math.max(0,Math.min(1,(y-anchorRect.y)/anchorRect.h))]})});
on('stage','pointerdown',e=>{
 e.preventDefault();if(!state.project||!$('bones').checked)return;
 const r=$('stage').getBoundingClientRect(),xy=[e.clientX-r.left,e.clientY-r.top],base=view(),M=boneMatrices(state.project,state.pose,base);let id=null,d=22;
 for(const b of state.project.bones){const dist=Math.hypot(M[b.id][4]-xy[0],M[b.id][5]-xy[1]);if(dist<d){d=dist;id=b.id}}if(!id)return;
 pause();checkpoint();state.bone=id;const b=selected(),parent=b.parent?M[b.parent]:base;drag={id,parent,start:inversePoint(parent,...xy),dx:state.pose[id+':dx']||0,dy:state.pose[id+':dy']||0};$('stage').setPointerCapture(e.pointerId);renderBone();
});
on('stage','pointermove',e=>{if(!drag)return;e.preventDefault();const r=$('stage').getBoundingClientRect(),p=inversePoint(drag.parent,e.clientX-r.left,e.clientY-r.top);state.pose[drag.id+':dx']=drag.dx+p[0]-drag.start[0];state.pose[drag.id+':dy']=drag.dy+p[1]-drag.start[1];renderPose();message('Đang chỉnh khớp '+label(selected())+' · Bấm Ghi pose để lưu')});
for(const event of ['pointerup','pointercancel','lostpointercapture'])on('stage',event,()=>{drag=null});
for(const id of ['stage','anchor'])for(const event of ['contextmenu','selectstart','dragstart'])$(id).addEventListener(event,e=>e.preventDefault());
function draw(){
 const r=$('stage').getBoundingClientRect(),dpr=devicePixelRatio||1,canvas=$('stage');if(canvas.width!==Math.round(r.width*dpr)||canvas.height!==Math.round(r.height*dpr)){canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr)}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,r.width,r.height);ctx.strokeStyle='#364759';ctx.lineWidth=1;for(let x=r.width/2%40;x<r.width;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,r.height);ctx.stroke()}if(!state.project)return;
 drawPet(ctx,state.project,state.pose,state.images,view(),{bones:$('bones').checked,selected:state.bone});
 const b=selected(),s=state.project.sprites[b.sprite],img=state.images.get(b.sprite);anchorCtx.clearRect(0,0,280,220);anchorRect=null;if(!s||!img)return;
 const k=Math.min(250/s.w,185/s.h),w=s.w*k,h=s.h*k;anchorRect={x:(280-w)/2,y:(220-h)/2,w,h};anchorCtx.drawImage(img,anchorRect.x,anchorRect.y,w,h);const x=anchorRect.x+b.pivot[0]*w,y=anchorRect.y+b.pivot[1]*h;anchorCtx.strokeStyle='#d3ed92';anchorCtx.lineWidth=2;anchorCtx.beginPath();anchorCtx.arc(x,y,6,0,Math.PI*2);anchorCtx.moveTo(x-12,y);anchorCtx.lineTo(x+12,y);anchorCtx.moveTo(x,y-12);anchorCtx.lineTo(x,y+12);anchorCtx.stroke();
}
function download(name,data,type='application/json'){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)}
async function portable(){stash();const p=clone(state.project);await Promise.all(p.spriteOrder.map(async id=>{const s=p.sprites[id];if(s.src.startsWith('data:'))return;const img=await image(s.src),canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;canvas.getContext('2d').drawImage(img,0,0);s.src=canvas.toDataURL('image/png')}));return validatePet(p)}
let runtimeText;async function runtime(){if(!runtimeText){const r=await fetch(new URL('./runtime.mjs',import.meta.url));if(!r.ok)throw Error('Không tải được bộ phát pet');runtimeText=await r.text()}return runtimeText}
on('save','click',async()=>{const p=await portable();download(p.id+'.pet-cutout.json',JSON.stringify(p,null,2));message('Đã lưu pet kèm rig, ảnh và bộ animation')});on('desktopSave','click',()=>$('save').click());
on('export','click',async()=>{const p=await portable();download(p.id+'.pet-game-bundle.json',JSON.stringify({format:'nightcamp-pet-cutout-export-v1',project:p,runtime:{file:'pet-runtime.mjs',source:await runtime()},usage:'Use PetCutoutPlayer.load(bundle.project), player.play(clipId), player.update(dt), player.draw(ctx,x,y,scale). Data only: no summon/combat AI.'},null,2));message('Đã xuất bundle pet kèm ảnh, animation và mã bộ phát độc lập')});
on('runtime','click',async()=>download('pet-runtime.mjs',await runtime(),'text/javascript'));
on('standalone','click',async()=>{
 const p=await portable(),data=JSON.stringify(p).replaceAll('<','\\u003c'),code=await runtime();
 const html=`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pet Cutout Preview</title><style>body{margin:0;background:#152030;color:#d3ed92;font:14px system-ui;display:flex;flex-direction:column;height:100dvh}nav{padding:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}button,select{padding:10px;background:#29374b;color:inherit;border:1px solid #53677e;border-radius:6px}canvas{flex:1;min-height:0;width:100%}</style><nav><select id="clip"></select><button id="play">Dừng / Phát</button><button id="flip">Lật</button><span id="name"></span></nav><canvas></canvas><script type="module">${code}\nconst p=${data};const player=await PetCutoutPlayer.load(p),sel=document.querySelector('select'),cv=document.querySelector('canvas'),ctx=cv.getContext('2d');for(const [id,c]of Object.entries(p.clips))sel.add(new Option(c.name,id));sel.value=p.activeClipId;sel.onchange=()=>player.play(sel.value);document.querySelector('#name').textContent=p.name;let go=true,flip=false,last=0;document.querySelector('#play').onclick=()=>go=!go;document.querySelector('#flip').onclick=()=>flip=!flip;const boxes=Object.values(p.clips).flatMap(c=>c.keys.map(k=>poseBounds(p,k.P))),B={x0:Math.min(...boxes.map(b=>b.x0)),x1:Math.max(...boxes.map(b=>b.x1)),y0:Math.min(...boxes.map(b=>b.y0)),y1:Math.max(...boxes.map(b=>b.y1))};function frame(t){const dt=Math.min(.1,(t-last)/1000);last=t;const r=cv.getBoundingClientRect(),d=devicePixelRatio||1;cv.width=Math.round(r.width*d);cv.height=Math.round(r.height*d);ctx.setTransform(d,0,0,d,0,0);if(go)player.update(dt);const k=Math.min((r.width-40)/Math.max(1,B.x1-B.x0),(r.height-40)/Math.max(1,B.y1-B.y0)),f=flip?-1:1;drawPet(ctx,p,player.pose,player.images,[k*f,0,0,k,r.width/2-(B.x0+B.x1)/2*k*f,r.height/2-(B.y0+B.y1)/2*k]);requestAnimationFrame(frame)}requestAnimationFrame(frame);<\/script></html>`;
 download(p.id+'.pet-preview.html',html,'text/html');message('Đã xuất web preview độc lập, mở không cần GitHub hoặc server game')
});
on('open','click',()=>$('projectFile').click());on('projectFile','change',async()=>{const f=$('projectFile').files[0];if(!f)return;try{if(f.size>30*1024*1024)throw Error('Project pet tối đa 30 MB');const data=JSON.parse(await f.text()),p=validatePet(data.format==='nightcamp-pet-cutout-export-v1'?data.project:data);checkpoint();await adopt(p);message('Đã mở '+p.name)}finally{$('projectFile').value=''}});
const media=matchMedia('(max-width:900px)'),titles={preview:'Preview thú cưng',pets:'Chọn pet & chuyển động',rig:'Khớp & ảnh bộ phận',pose:'Tư thế bộ phận',frames:'Animation & frame',project:'Project & xuất game'};let tab='preview';
function layout(){document.body.dataset.tab=tab;$('tabTitle').textContent=titles[tab];for(const panel of document.querySelectorAll('[data-panel]'))panel.hidden=media.matches&&panel.dataset.panel!==tab;for(const b of document.querySelectorAll('[data-tab]'))b.setAttribute('aria-current',b.dataset.tab===tab?'page':'false');if(!media.matches)$('petMenu').close()}
on('menuButton','click',()=>{$('petMenu').showModal();$('menuButton').setAttribute('aria-expanded','true')});on('closeMenu','click',()=>$('petMenu').close());$('petMenu').addEventListener('close',()=>$('menuButton').setAttribute('aria-expanded','false'));$('petMenu').addEventListener('click',e=>{const r=$('petMenu').getBoundingClientRect();if(e.target===$('petMenu')&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))$('petMenu').close()});for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>{tab=b.dataset.tab;$('petMenu').close();layout()};media.addEventListener('change',layout);layout();
on('back','click',()=>{if(parent!==window)parent.postMessage({type:'nightcamp.pet.close'},location.origin);else location.href='../index.html'});
let active=true;window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent)return;if(e.data?.type==='nightcamp.pet.pause'){pause();active=false}else if(e.data?.type==='nightcamp.pet.resume')active=true});
let last=0;function frame(now){const dt=Math.min(.1,(now-last)/1000);last=now;if(!active){requestAnimationFrame(frame);return}if(state.playing&&state.project){const c=state.project.clip;state.time+=dt*Number($('speed').value);if(state.time>c.dur){if(['loop','walk'].includes(c.kind))state.time%=c.dur;else{state.time=c.dur;pause()}}state.pose=samplePet(c,state.time);$('scrub').value=state.time;$('clock').textContent=state.time.toFixed(2)+' s';renderPose()}try{draw()}catch(error){pause();message('Lỗi hiển thị pet: '+error.message);console.error(error)}requestAnimationFrame(frame)}
busy(true);safe(async()=>{
 [source,catalog]=await Promise.all([connectSource(!!window.STUDIO_GITHUB,new URL('../',import.meta.url)),fetch(new URL('./catalog.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Không tải được danh mục pet');return r.json()})]);
 options($('pet'),Object.entries(catalog.rigs).map(([id,p])=>[id,p.name]));let p={...clone(catalog.rigs.wolf),activeClipId:'idle'};const saved=localStorage.getItem('nightcamp.pet.cutout.v1');if(saved)try{p=validatePet(JSON.parse(saved))}catch{message('Nháp pet cũ không hợp lệ, mở sói mặc định')}
 await adopt(p);$('pet').value=catalog.rigs[p.id]?p.id:'wolf';message(source.warning||'Sẵn sàng · 7 pet cutout · 29 chuyển động mẫu · chưa có mesh');requestAnimationFrame(frame);
})();
