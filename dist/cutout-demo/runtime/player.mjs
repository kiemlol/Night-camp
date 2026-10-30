import {sample,validate,PARTS} from './model.mjs';
const NC=window.NC;
let serial=0;
const loadImage=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Không tìm được ảnh: '+src.slice(0,100)));img.src=src});
export class CutoutPlayer {
  static async load(spec, base=new URL('../',import.meta.url)){
    // Authored poses must not be overwritten by automatic weapon-grip correction.
    NC.GRIPFIX=false;
    if(spec.format!=='cutout-character-v1')throw Error('Không đúng định dạng nhân vật');
    for(const clip of Object.values(spec.clips))validate({format:'nightcamp-cutout-v1',rig:spec.rig,parts:spec.parts,attachments:spec.attachments,clip});
    for(const id of ['idle','walk','run','attack'])if(!spec.clips[id])throw Error('Thiếu clip '+id);
    const id='demo'+ ++serial, equip={top:id+'_top',weapon:id+'_weapon'},sprites={};
    await Promise.all(PARTS.map(async part=>{const s=structuredClone(spec.parts[part]);s.name=`rig_${id}_${part}`;s.img=await loadImage(s.src.startsWith('data:')?s.src:new URL(s.src,base).href);sprites[s.name]=s}));
    const weapon=structuredClone(spec.weapon);if(weapon.spriteData){const s=weapon.spriteData;s.name=id+'_sword';s.img=await loadImage(new URL(s.src,base).href);sprites[s.name]=s;weapon.sprite=s.name;delete weapon.spriteData}
    const attachmentSprites=[];
    const attachments=await Promise.all((spec.attachments||[]).map(async(a,i)=>{const name=id+'_attachment_'+i;attachmentSprites.push(name);sprites[name]={name,img:await loadImage(a.src.startsWith('data:')?a.src:new URL(a.src,base).href)};return {...a,sprite:name}}));
    Object.assign(NC.SPR,sprites);NC.ITEMS[equip.top]={rig:id,attachments};NC.ITEMS[equip.weapon]=weapon;
    const player=new CutoutPlayer();Object.assign(player,{spec:structuredClone(spec),equip,attachmentSprites,rig:NC.getRig(id),time:0,name:'idle',face:1,blend:null,pose:structuredClone(spec.clips.idle.keys[0].P)});return player;
  }
  play(name,{restart=false}={}){if(name===this.name&&!restart)return;if(!this.spec.clips[name])throw Error('Thiếu clip '+name);this.blend={from:structuredClone(this.pose),time:0};this.name=name;this.time=0;this.hitFired=false;}
  update(dt,onHit=()=>{}){
    const c=this.spec.clips[this.name],last=this.time;this.time+=dt;
    if(c.kind==='attack'&&!this.hitFired&&this.time>=c.hit){this.hitFired=true;onHit()}
    const loop=c.kind==='walk'||c.kind==='loop';
    if(loop)this.time%=c.dur;else this.time=Math.min(this.time,c.dur);
    this.pose=sample(c,this.time);
    if(this.blend){this.blend.time+=dt;const u=Math.min(1,this.blend.time/.12);for(const k of Object.keys(this.pose))if(typeof this.pose[k]==='number'&&Number.isFinite(this.blend.from[k]))this.pose[k]=this.blend.from[k]+(this.pose[k]-this.blend.from[k])*u;if(u===1)this.blend=null}
    return !loop&&this.time>=c.dur;
  }
  draw(ctx,x,y,scale,{bones=false,weapon=true}={}){
    const hasAttachedWeapon=this.spec.attachments?.some(a=>a.visible!==false&&a.socket.startsWith('hand'));
    const pose={...this.pose,face:this.face};NC.drawRig(ctx,this.rig,this.equip,pose,x,y,{scale,noWeapon:!weapon||hasAttachedWeapon,hideAttachedWeapons:!weapon});
    if(bones){const js=NC.rigJoints(this.equip,pose,x,y,scale);ctx.save();ctx.strokeStyle='#d9ed9c';ctx.fillStyle='#f4ffc9';ctx.lineWidth=1;for(const chain of [['pel','neck','headTop'],['shN','elN','haN'],['shF','elF','haF'],['hipN','knN','ftN'],['hipF','knF','ftF']]){ctx.beginPath();chain.forEach((k,i)=>ctx[i?'lineTo':'moveTo'](...js[k]));ctx.stroke()}for(const p of Object.values(js)){ctx.beginPath();ctx.arc(...p,3,0,7);ctx.fill()}ctx.restore()}
  }
  dispose(){for(const p of PARTS)delete NC.SPR[`rig_${this.rig.name}_${p}`];for(const id of this.attachmentSprites||[])delete NC.SPR[id];delete NC.SPR[this.equip.top.replace('_top','_sword')];delete NC.ITEMS[this.equip.top];delete NC.ITEMS[this.equip.weapon]}
}
