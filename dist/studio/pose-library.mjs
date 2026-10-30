import {CURVES} from './model.mjs';

export function poseClipDescription(data){
 const count=data?.keys?.length||0;
 if(data?.shot&&data.kind==='loop')return 'Pose sống · thở / lắc nhẹ';
 if(count===1)return 'Pose tĩnh · 1 key gốc';
 return `${data?.kind==='walk'?'Đi / chạy':data?.kind==='attack'?'Đòn đánh':data?.kind==='loop'?'Lặp':'Động tác'} · ${count} key gốc`;
}

// Same procedural hold as poselib.js/poseAlive. Bake it to editable keys so
// projects and exported bundles need no hidden dependency on the original game.
export function livingPose(time,pose){
 const P=structuredClone(pose),TAU=Math.PI*2;
 const br=Math.sin(TAU*time/3.4),late=Math.sin(TAU*(time-.4)/3.4),sway=Math.sin(TAU*time/6.8);
 P.breathe=(P.breathe||1)*(1+.022*br);
 P.headY=(P.headY||0)-.7*late;P.head=(P.head||0)+.015*sway;
 P.lean=(P.lean||0)+.012*br;P.x=(P.x||0)+.6*sway;
 P.kF=(P.kF||0)+.02*sway;P.kB=(P.kB||0)+.03*sway;
 P.aF=(P.aF||0)+.03*br;P.aB=(P.aB||0)+.03*late;
 P.wAng=(P.wAng||0)+.012*br;
 return P;
}

export function importPoseClip(data,defaults={}){
 if(!data||!Array.isArray(data.keys)||!data.keys.length||data.keys.length>2000)throw Error('Clip gốc không có keyframe hợp lệ');
 const clip=structuredClone(data),notes=[];
 if(!['walk','loop','attack','pose'].includes(clip.kind)||typeof clip.name!=='string'||!clip.name.trim())throw Error('Tên hoặc loại clip gốc không hợp lệ');
 if(!Number.isFinite(clip.dur)||clip.dur<.1||clip.dur>30)throw Error('Thời lượng clip gốc không hợp lệ');
 const byTime=new Map();
 for(const key of clip.keys){
  if(!Number.isFinite(key.t)||key.t<0||key.t>30||!key.P||Object.values(key.P).some(v=>typeof v!=='boolean'&&!Number.isFinite(v)))throw Error('Clip gốc có keyframe không hợp lệ');
  const curve=key.curve||'inout';if(!Object.hasOwn(CURVES,curve))throw Error('Đường cong chưa hỗ trợ: '+curve);
  byTime.set(key.t,{t:key.t,curve,P:{...defaults,...byTime.get(key.t)?.P,...key.P}});
 }
 if(byTime.size!==clip.keys.length)notes.push('Đã gộp key trùng thời điểm');
 clip.keys=[...byTime.values()].sort((a,b)=>a.t-b.t);
 const last=clip.keys.at(-1).t;
 if(last>clip.dur){clip.dur=last;notes.push('Đã mở rộng thời lượng để giữ các key bị nằm ngoài clip gốc')}
 if(clip.shot&&clip.kind==='loop'){
  const pose=clip.keys[0].P;
  // Breathing has a 3.4s period, sway 6.8s: one complete cycle avoids a seam.
  clip.dur=6.8;
  clip.keys=Array.from({length:205},(_,i)=>({t:i*clip.dur/204,curve:'lin',P:livingPose(i*clip.dur/204,pose)}));
  clip.keys.at(-1).P=structuredClone(clip.keys[0].P);
  clip.shot=false;delete clip.channels;
  notes.push('Đã chuyển pose sống thành 205 key chỉnh được, chu kỳ 6,8 giây');
 }else if(clip.keys.length>1&&(clip.kind==='loop'||clip.kind==='walk')){
  if(clip.keys[0].t>0)clip.keys.unshift({...structuredClone(clip.keys[0]),t:0});
  if(clip.keys.at(-1).t<clip.dur)clip.keys.push({...structuredClone(clip.keys[0]),t:clip.dur});
 }
 clip.hit=Number.isFinite(clip.hit)?Math.max(0,Math.min(clip.dur,clip.hit)):clip.dur*.4;
 if(clip.keys.length===1)notes.push('Dữ liệu gốc chỉ có 1 pose tĩnh; thêm frame để tạo chuyển động mới');
 return {clip,notes,description:poseClipDescription(data)};
}
