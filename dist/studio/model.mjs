import {validateAttachments} from './attachments.mjs';
export const PARTS = ['head','torso','armF','armB','legF','legB'];
export const CURVES = { lin:t=>t, in:t=>t*t, out:t=>1-(1-t)**2, inout:t=>t<.5?2*t*t:1-2*(1-t)**2, step:()=>0 };
export function sample(clip, time) {
  const keys = [...clip.keys].sort((a,b)=>a.t-b.t);
  if (!keys.length) throw Error('Clip cần ít nhất một keyframe');
  if(time<=keys[0].t)return structuredClone(keys[0].P);
  for(let i=1;i<keys.length;i++)if(time<=keys[i].t){
    const a=keys[i-1],b=keys[i],u=(CURVES[a.curve]||CURVES.inout)((time-a.t)/(b.t-a.t));
    return Object.fromEntries([...new Set([...Object.keys(a.P),...Object.keys(b.P)])].map(k=>[k,typeof a.P[k]==='boolean'||typeof b.P[k]==='boolean'?(u<.5?a.P[k]:b.P[k]):(a.P[k]??b.P[k])+((b.P[k]??a.P[k])-(a.P[k]??b.P[k]))*u]));
  }
  return structuredClone(keys.at(-1).P);
}
export function validate(p) {
  const fail=msg=>{throw Error(msg)};
  if(p?.format!=='nightcamp-cutout-v1')fail('Không đúng định dạng project Cutout Studio v1');
  validateAttachments(p.attachments);
  const c=p.clip;
  if(!c||!Number.isFinite(c.dur)||c.dur<.1||c.dur>30||!Array.isArray(c.keys)||!c.keys.length||c.keys.length>2000)fail('Clip hoặc thời lượng không hợp lệ');
  if(!['walk','loop','attack','pose'].includes(c.kind)||typeof c.name!=='string'||!c.name.trim())fail('Tên / loại clip không hợp lệ');
  if(!Number.isFinite(c.hit)||c.hit<0||c.hit>c.dur)fail('Thời điểm trúng đòn nằm ngoài clip');
  const seen=new Set();
  for(const k of c.keys){if(!Number.isFinite(k.t)||k.t<0||k.t>c.dur||seen.has(k.t)||!CURVES[k.curve]||!k.P||Object.values(k.P).some(v=>typeof v!=='boolean'&&!Number.isFinite(v)))fail('Keyframe không hợp lệ hoặc trùng thời điểm');seen.add(k.t)}
  const joints={head:['neck'],torso:['pelvis','neck','shoulderL','shoulderR','hipL','hipR'],armF:['shoulder','hand'],armB:['shoulder','hand'],legF:['hip','foot'],legB:['hip','foot']};
  for(const s of Object.values(p.parts||{})){if(s.overlap!==undefined&&(!Number.isFinite(s.overlap)||s.overlap<0||s.overlap>40))fail('Độ chồng mép không hợp lệ');for(const key of ['elbow','knee'])if(s.joints?.[key]&&(!Array.isArray(s.joints[key])||s.joints[key].length!==2||!s.joints[key].every(Number.isFinite)))fail('Khớp giữa không hợp lệ')}
  for(const part of PARTS){const s=p.parts?.[part];if(!s||![s.w,s.h].every(v=>Number.isFinite(v)&&v>0&&v<=1000)||typeof s.src!=='string'||!(/^assets\/[\w./-]+\.(png|webp)$/.test(s.src)||/^data:image\/(png|webp);base64,[A-Za-z0-9+/=]+$/.test(s.src)))fail('Sprite không hợp lệ: '+part);for(const j of joints[part])if(!Array.isArray(s.joints?.[j])||s.joints[j].length!==2||!s.joints[j].every(Number.isFinite))fail('Thiếu khớp '+part+'.'+j)}
  return p;
}
export function gameExport(project) {
  validate(project);
  const clip=structuredClone(project.clip);clip.aim=false;
  const id=clip.name.replace(/[^a-zA-Z0-9_-]/g,'_')||'custom_clip';
  const rig=project.rig.replace(/[^a-zA-Z0-9_-]/g,'_')||'custom_rig';
  const sprites={}; const images=[];
  for(const part of PARTS){const s=structuredClone(project.parts[part]);if(s.src.startsWith('data:')){const ext=s.src.startsWith('data:image/webp')?'webp':'png';const file=`rig_${rig}_${part}.${ext}`;images.push({file,data:s.src});s.src='assets/'+file}sprites[`rig_${rig}_${part}`]=s}
  const attachments=(project.attachments||[]).map((item,index)=>{const a=structuredClone(item),name=`accessory_${rig}_${index}`;if(a.src.startsWith('data:')){const ext=a.src.startsWith('data:image/webp')?'webp':'png',file=name+'.'+ext;images.push({file,data:a.src});a.src='assets/'+file}sprites[name]={src:a.src,w:a.w,h:a.h,ax:0,ay:0};a.sprite=name;return a});
  return {id,rig,images,attachments,code:`// Load after assets/manifest.js and js/poselib_data.js, before sprite loading and js/poselib.js.\nwindow.NC = window.NC || {};\nNC.ASSET_MANIFEST = Object.assign(NC.ASSET_MANIFEST || {}, ${JSON.stringify(sprites,null,2)});\nNC.POSE_LIB = Object.assign(NC.POSE_LIB || {}, ${JSON.stringify({[id]:clip},null,2)});\nNC.RIG_ATTACHMENTS = Object.assign(NC.RIG_ATTACHMENTS || {}, ${JSON.stringify({[rig]:attachments},null,2)});\n`};
}
