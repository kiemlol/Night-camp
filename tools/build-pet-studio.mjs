import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),base=new URL('dist-full/game-20261025-1758/',root);
const NC={ASSET_MANIFEST:{},SPR:{},FX:{def(){}},rand:(a,b)=>(a+b)/2};
const context=vm.createContext({NC,window:{NC},document:{createElement:()=>({getContext:()=>({})})}});
for(const file of ['assets/petrig.manifest.js','js/petrig.js'])vm.runInContext(fs.readFileSync(new URL(file,base),'utf8'),context);
Object.assign(NC.SPR,NC.ASSET_MANIFEST_PETRIG);
const names={wolf:'Sói',falcon:'Chim ưng',wyvern:'Rồng nhỏ Wyvern',lantern:'Tinh linh đèn lồng',pp_axe:'Rối cầm rìu',pp_shield:'Rối cầm khiên',pp_xbow:'Rối cầm nỏ'};
const round=v=>Math.round(v*1e6)/1e6,TAU=Math.PI*2;
const rigs={};
for(const [id,R]of Object.entries(NC.PetRig.RIGS)){
 R.byId=Object.fromEntries(R.bones.map(b=>[b.id,b]));
 const sprites=Object.fromEntries(R.imgs.map(part=>{const key=R.pre+part,s=NC.SPR[key];if(!s||!fs.existsSync(new URL(s.src,base)))throw Error('Missing '+key);return [key,{src:s.src,w:s.w,h:s.h}]}));
 const spriteOrder=Object.keys(sprites);
 const bones=R.bones.map(b=>({id:b.id,parent:b.parent,sprite:b.part?R.pre+b.part:null,pivot:[...b.piv],at:[...b.at],scale:b.k||1,dark:!!b.dark,visible:true,...(R.piv?{variantPivots:Object.fromEntries(Object.entries(R.piv).map(([id,pivot])=>[R.pre+id,[...pivot]]))}:{})}));
 const definitions=id==='wolf'?[['idle','Đứng / thở',3.2,'loop'],['walk','Đi bộ',1,'walk'],['run','Chạy',.65,'walk'],['attack','Cắn',.55,'attack'],['sniff','Đánh hơi',1.4,'pose'],['bow','Cúi người',1.7,'pose'],['hit','Trúng đòn',.4,'pose']]:id==='falcon'?[['idle','Lượn',2,'loop'],['fly','Vỗ cánh',.8,'loop'],['dive','Bổ nhào',.8,'pose'],['attack','Tấn công bằng móng',.6,'attack']]:id==='wyvern'?[['idle','Bay tại chỗ',2,'loop'],['fly','Bay nhanh',.8,'loop'],['attack','Tư thế phun lửa',.7,'attack']]:id==='lantern'?[['idle','Lơ lửng',3,'loop'],['move','Đung đưa',2,'loop'],['attack','Tấn công',.5,'attack']]:[['idle','Đứng',3,'loop'],['walk','Đi bộ',1,'walk'],['run','Chạy',.65,'walk'],['attack','Tấn công',.6,'attack']];
 const clips={};
 for(const [clipId,label,dur,kind]of definitions){
  const n=Math.ceil(dur*30),keys=[];
  for(let i=0;i<=n;i++){
   const t=i/n*dur,u=t/dur,ph=u*TAU,move=['walk','run','fly','move'].includes(clipId),atk=clipId==='attack';let st;
   if(id==='wolf')st={age:10+t,amp:move?1:0,gal:clipId==='run'?1:0,ph,look:0,tailA:Math.sin(ph)*.13,blinkT:u>.7&&u<.76?1:0,bite:atk?Math.max(0,.32-t):0,bowT:clipId==='bow'?t:0,sniffT:clipId==='sniff'?t:0};
   else if(id==='falcon')st={age:10+t,sp:move?300:0,vx:move?300:0,vy:clipId==='dive'?220:0,dive:clipId==='dive'?Math.sin(u*Math.PI):0,atk:atk?Math.sin(u*Math.PI):0,e:Math.cos(ph),e2:Math.cos(ph-.4),head:0,screech:0};
   else if(id==='wyvern')st={age:10+t,sp:move?300:0,ph,e:Math.cos(ph),e2:Math.cos(ph-.35),fire:atk?Math.max(0,.4-t):0,look:0,tA:{a:Math.sin(ph)*.12},tB:{a:Math.sin(ph-.4)*.15},legs:{a:Math.sin(ph-.2)*.15}};
   else if(id==='lantern')st={age:10+t,sw:{a:Math.sin(ph)*(move?.3:.08)},gh:{a:Math.sin(ph-.4)*.12},wi:{a:Math.sin(ph-.7)*.18},fire:atk?Math.max(0,.4-t):0,blinkT:u>.7&&u<.76?1:0};
   else{
    const build=id.slice(3),H={axe:[.3,1.2,-.15,.35],shield:[.85,.55,.1,.45],xbow:[1.1,.35,1,.5]}[build];
    st={age:10+t,amp:move?1:0,ph,turn:0,atk:atk?Math.max(0,.45-t):0,sp:{}};
    const vals={armN:H[0]-(move?.35*Math.sin(ph):0),foreN:H[1],armF:H[2]+(move?.4*Math.sin(ph):0),foreF:H[3]+(move?.2:0),head:Math.sin(ph)*.04,torso:0};
    if(atk){const w=Math.sin(u*Math.PI);vals.armN+=w*(build==='axe'?2:.6);vals.foreN-=w*.3;vals.torso-=w*.15}
    for(const [k,a]of Object.entries(vals))st.sp[k]={a};
   }
   const pose=R.pose(R,st,{type:id,hurt:clipId==='hit'?Math.max(0,.3-t):0}),P={};
   for(const b of R.bones){const p=pose[b.id];for(const k of ['rot','dx','dy','sx','sy']){if(!Number.isFinite(p[k]))throw Error(`${id}/${clipId}/${b.id}/${k}`);P[b.id+':'+k]=round(p[k])}P[b.id+':hide']=!!p.hide;const img=p.img&&p.img!==b.part?R.pre+p.img:null;P[b.id+':img']=img?spriteOrder.indexOf(img):-1;if(img&&P[b.id+':img']<0)throw Error('Unknown variant '+img)}
   keys.push({t:round(t),curve:'lin',P});
  }
  if(kind==='loop'||kind==='walk')keys.at(-1).P=structuredClone(keys[0].P);
  clips[clipId]={name:label,kind,dur,hit:round(dur*.4),keys};
 }
 rigs[id]={format:'nightcamp-pet-cutout-v1',id,name:names[id],scale:R.k||1,sprites,spriteOrder,bones,clips,clip:structuredClone(clips.idle)};
}
const target=new URL('dist/studio/pets/catalog.json',root);fs.mkdirSync(new URL('./',target),{recursive:true});fs.writeFileSync(target,JSON.stringify({version:1,build:'game-20261025-1758',provenance:'Cutout bones, pivots and pose equations from js/petrig.js; deterministic preview state, no Spine/weighted meshes or combat AI.',rigs}));
console.log('Pet Studio:',Object.keys(rigs).length,'rigs,',Object.values(rigs).reduce((n,r)=>n+Object.keys(r.clips).length,0),'editable clips');
