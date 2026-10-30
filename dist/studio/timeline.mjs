const clone=value=>structuredClone(value);
const rounded=value=>Math.round(value*1e6)/1e6;
function poseCheck(pose){if(!pose||Object.values(pose).some(v=>typeof v!=='boolean'&&!Number.isFinite(v)))throw Error('Tư thế không hợp lệ')}
export function blankClip({name,kind='loop',dur=1,pose}){
 poseCheck(pose);
 if(typeof name!=='string'||!name.trim()||!['loop','walk','attack','pose'].includes(kind)||!Number.isFinite(dur)||dur<.1||dur>30)throw Error('Tên, loại hoặc thời lượng animation không hợp lệ');
 return {name:name.trim(),kind,dur,hit:Math.min(dur*.4,dur),keys:[{t:0,curve:'inout',P:clone(pose)}]};
}
export function appendInheritedFrame(original,index,pose,step=.1){
 poseCheck(pose);
 if(!original.keys[index])throw Error('Chọn frame nguồn trước');
 if(original.keys.length>=2000)throw Error('Tối đa 2000 frame trong một clip');
 if(!Number.isFinite(step)||step<.01||step>5)throw Error('Bước frame từ 0.01 đến 5 giây');
 const clip=clone(original),source=clip.keys[index];source.P=clone(pose);
 const key={t:rounded(source.t+step),curve:source.curve,P:clone(pose)};
 const tail=clip.keys.slice(index+1);for(const k of tail)k.t=rounded(k.t+step);
 clip.dur=rounded(Math.max(clip.dur+(tail.length?step:0),key.t));
 if(clip.dur>30)throw Error('Clip vượt 30 giây; giảm bước frame hoặc thời lượng');
 if(tail.length&&clip.hit>source.t)clip.hit=rounded(clip.hit+step);
 clip.keys.splice(index+1,0,key);
 return {clip,index:index+1};
}
export function copyPoseToFrames(original,sourceIndex,targets,pose){
 poseCheck(pose);
 if(!original.keys[sourceIndex])throw Error('Frame nguồn không còn tồn tại');
 const selected=[...new Set(targets)].filter(i=>i!==sourceIndex);
 if(!selected.length)throw Error('Chọn ít nhất một frame đích');
 if(selected.some(i=>!Number.isInteger(i)||!original.keys[i]))throw Error('Frame đích không hợp lệ');
 const clip=clone(original);clip.keys[sourceIndex].P=clone(pose);
 for(const i of selected)clip.keys[i].P=clone(pose);
 return {clip,count:selected.length};
}
