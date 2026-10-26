/* Authoritative copy/forge commands for the original web windows. Offline play
   keeps the source handlers; an online window never rolls gear or spends coins locally. */
(function () {
  'use strict';
  const N=window.NC,O=N.Online,G=N.GEAR;
  if(!O||!G)return;
  const baseAct=N.invAct,baseUse=G.use,armed=new Map();
  const confirm=(key)=>{const t=performance.now();if((armed.get(key)||0)>t){armed.delete(key);return true}armed.set(key,t+3000);N.game.toast('กดอีกครั้งเพื่อยืนยัน');return false};
  const copy=(uid)=>G.copies(N.game.player).find(c=>c.u===Number(uid));
  function use(uid){const c=copy(uid);if(!c)return;const p=N.game.player,it=N.ITEMS[c.id];let slot=it.slot;
    if(slot==='acc')slot=p.equip.acc1===c.id?'acc1':p.equip.acc2===c.id?'acc2':!p.equip.acc1?'acc1':'acc2';
    O.action('equip',{slot,itemId:c.id,copyId:c.u});}
  G.use=function(game,uid){if(!O.active)return baseUse.apply(this,arguments);use(uid)};
  // the bulk sale goes to the server, which prices it (backend bag_rules.go sellCopies); the card says nothing until it lands
  // more room in the bag is bought from the server (backend bag_rules.go buyBagSlots); its snapshot shows the new cap
  const baseBuySlots=G.buySlots;
  G.buySlots=function(game){if(!O.active)return baseBuySlots.apply(this,arguments);O.action('bagexpand');return'sent'};
  const baseSellMany=G.sellMany;
  G.sellMany=function(game,uids){if(!O.active)return baseSellMany.apply(this,arguments);if(uids.length)O.action('sellgear',{copyIds:uids.map(Number)});return{n:uids.length,got:0,why:null,pending:true}};
  N.invAct=function(game,a,en){
    if(!O.active)return baseAct.apply(this,arguments);
    let m=/^gb:(use|sell):(\d+)$/.exec(a||'');
    if(m){const c=copy(m[2]);if(!c)return true;if(m[1]==='use')use(c.u);else if(confirm('sell:'+c.u))O.action('sellgear',{itemId:c.id,copyId:c.u});return true}
    // the camp storage (backend bag_rules.go storePut / storeTake)
    m=/^gb:(put|take):(\d+)$/.exec(a||'');
    if(m){O.action('store',{kind:m[1],copyId:Number(m[2])});return true}
    m=/^rf:go:(\d+)$/.exec(a||'');
    if(m){const c=copy(m[1]);if(!c)return true;const grade=G.gradeOf(N.ITEMS[c.id]);if((c.ref||0)+1<=N.Refine.SAFE[grade]||confirm('refine:'+c.u))O.action('forge',{kind:'refine',copyId:c.u});return true}
    return baseAct.apply(this,arguments);
  };
  document.addEventListener('click',e=>{
    if(!O.active)return;
    const b=e.target.closest('button');if(!b||b.disabled||!b.closest('#forge'))return;
    const make=b.dataset.make,kind=b.id==='fg-drill'?'drill':b.id==='fg-stone'?'stone':b.id==='fg-sell'?'sell':null;
    if(!make&&!kind)return;
    e.preventDefault();e.stopImmediatePropagation();
    if(make){if(!N.ITEMS[make]?.gs?.src?.shop&&!confirm('craft:'+make))return;O.action('forge',{kind:'craft',itemId:make});return}
    const c=copy(document.querySelector('#forge .fg-copy.sel')?.dataset.copy);if(!c)return;
    const fields={kind,copyId:c.u};
    if(kind==='stone'){fields.row=Number(document.querySelector('#forge .fg-row.sel')?.dataset.row||0);fields.optionKind=document.querySelector('#forge [data-kind].on')?.dataset.kind||'atk';const sub=document.querySelector('#forge [data-sub].on')?.dataset.sub;if(sub)fields.optionSub=sub}
    if(!confirm('forge:'+JSON.stringify(fields)))return;
    if(kind==='sell'){O.action('sellgear',{itemId:c.id,copyId:c.u});return}
    O.action('forge',fields);
  },true);
  let forgeSignature='';
  window.addEventListener('nightcamp:online-snapshot',()=>{
    if(!O.active||!N.game?.player||document.getElementById('forge')?.hidden!==false)return;
    const p=N.game.player,signature=JSON.stringify([O.gearRev?O.gearRev():p.bag,p.wu,p.equip,p.coins,p.mats]); // (the bag's version, not the bag)
    if(signature===forgeSignature)return;
    forgeSignature=signature;N.Forge?.refresh?.();
  });
})();
