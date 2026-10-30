export const LIMBS={
 haN:{root:'shN',middle:'elN',end:'haN',angle:'aF',bend:'eF',part:'armF'},
 haF:{root:'shF',middle:'elF',end:'haF',angle:'aB',bend:'eB',part:'armB'},
 ftN:{root:'hipN',middle:'knN',end:'ftN',angle:'legF',bend:'kF',part:'legF'},
 ftF:{root:'hipF',middle:'knF',end:'ftF',angle:'legB',bend:'kB',part:'legB'},
};
export const wrap=v=>Math.atan2(Math.sin(v),Math.cos(v));
export function ensureMiddleJoints(parts){for(const name of ['armF','armB','legF','legB']){const s=parts[name],arm=name.startsWith('arm'),[a,b,key,f]=arm?['shoulder','hand','elbow',.45]:['hip','foot','knee',.47];if(!s.joints[key])s.joints[key]=s.joints[a].map((v,i)=>v+(s.joints[b][i]-v)*f);if(!Number.isFinite(s.overlap))s.overlap=arm?3:12}}
export function resizeSprite(sprite,axis,value){const old=sprite[axis];if(!Number.isFinite(value)||value<1||value>1000)throw Error('Kích thước từ 1 đến 1000');const i=axis==='w'?0:1;for(const p of Object.values(sprite.joints))p[i]*=value/old;sprite[axis]=value}
export function validLimb(sprite,part){if(!/^(arm|leg)/.test(part))return true;const arm=part.startsWith('arm'),[a,m,b]=arm?['shoulder','elbow','hand']:['hip','knee','foot'];const ps=[sprite.joints[a],sprite.joints[m],sprite.joints[b]];if(ps.some(p=>!p||p.some(v=>!Number.isFinite(v))))return false;return Math.hypot(ps[0][0]-ps[1][0],ps[0][1]-ps[1][1])>=1&&Math.hypot(ps[1][0]-ps[2][0],ps[1][1]-ps[2][1])>=1&&Math.hypot(ps[0][0]-ps[2][0],ps[0][1]-ps[2][1])>=1}
// Solve against the real renderer. Damped Jacobian handles near-straight poses;
// each move starts from the pointer-down pose, never a stale screen joint.
export function solveEndpoint(start,limb,target,measure){
 const p={...start};p.hk=0;p.bk=0;p.ik=0;p.plant=0;
 let best={...p},bestError=Infinity;
 for(let n=0;n<24;n++){
  const pos=measure(p)[limb.end],e=[target[0]-pos[0],target[1]-pos[1]],error=Math.hypot(...e);
  if(error<bestError){bestError=error;best={...p}}if(error<.5)break;
  const eps=.002,cols=[limb.angle,limb.bend].map(k=>{const q={...p,[k]:p[k]+eps},v=measure(q)[limb.end];return [(v[0]-pos[0])/eps,(v[1]-pos[1])/eps]});
  const [a,b]=cols,lambda=4,A=a[0]*a[0]+b[0]*b[0]+lambda,B=a[0]*a[1]+b[0]*b[1],D=a[1]*a[1]+b[1]*b[1]+lambda,det=A*D-B*B;
  if(!Number.isFinite(det)||Math.abs(det)<1e-8)break;
  const u=(D*e[0]-B*e[1])/det,v=(A*e[1]-B*e[0])/det;
  p[limb.angle]+=Math.max(-.25,Math.min(.25,a[0]*u+a[1]*v));
  p[limb.bend]=Math.max(-2.65,Math.min(2.65,p[limb.bend]+Math.max(-.25,Math.min(.25,b[0]*u+b[1]*v))));
 }
 return best;
}
export function bendFromDrag(start,limb,startJoints,delta,measure){
 const p={...start,hk:0,bk:0,ik:0,plant:0},pivot=startJoints[limb.middle],end=startJoints[limb.end];
 const target=[end[0]+delta[0],end[1]+delta[1]],base=Math.atan2(end[1]-pivot[1],end[0]-pivot[0]),angle=Math.atan2(target[1]-pivot[1],target[0]-pivot[0]);
 // Screen derivative accounts for mirroring and rotation of the whole rig.
 const joint=measure({...p,[limb.bend]:p[limb.bend]+.01}),next=Math.atan2(joint[limb.end][1]-joint[limb.middle][1],joint[limb.end][0]-joint[limb.middle][0]);
 const sign=Math.sign(wrap(next-base))||1;
 p[limb.bend]=Math.max(-2.65,Math.min(2.65,p[limb.bend]+sign*wrap(angle-base)));return p;
}
