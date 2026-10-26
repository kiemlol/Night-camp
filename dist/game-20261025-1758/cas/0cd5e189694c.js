/* report.js — สรุปคืนที่ผ่านมา (the Game Bible, pillar 1: "the bot does the grind, the player comes back to a report worth
   reading"). While the auto farm (js/autofarm.js) runs, this counts what happened: kills, EXP and Job EXP, the levels,
   coins earned and spent, the materials, every gear drop (the rare ones first), faints and the EXP they cost, potions.
   When the auto farm stops after 5 minutes or more, or the game opens with a report not yet read, the report pops up;
   the journal (J, js/hub.js) keeps the last one under สรุปบอท.
   Saved: nightcamp.report.v1 (the run in progress and the last one). Hooks: NC.gainXp, NC.skillKills, NC.lootHeard,
   NC.addMat, NC.Progress.onDeath, a 1 s poll (coins, potions, faints, the auto farm switch); online the kills, EXP,
   materials and drops come from the server (js/online/botreport.js). Test: ?report (a sample). */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, MAT = NC.MATERIALS, H = NC.Hub;
  if (!H) return;
  const esc = H.esc, fmt = (n) => NC.fmtCoins(n), KEY = 'nightcamp.report.v1';
  let st = { run: null, last: null, unread: false };
  try { if (!NC.ONLINE) st = Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* blocked */ }
  const save = () => { if (NC.game && NC.game.noSave) return; try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* blocked */ } };
  const blank = (p) => ({ t0: Date.now(), t1: 0, map: NC.game ? NC.game.mapId : '', lv0: p.lv, lv1: p.lv, jlv0: p.jobLv, jlv1: p.jobLv,
    kills: 0, xp: 0, jxp: 0, earned: 0, spent: 0, mats: {}, drops: [], faints: 0, xpLost: 0, pots: 0 });
  const R = () => st.run;

  (NC.xpWatchers || (NC.xpWatchers = [])).push((game, was) => {
    const p = game.player, r = R(), { lv, xp, jobLv: jl, jobXp: jx } = was;
    if (r) {
      let g = p.xp - xp; for (let l = lv; l < p.lv; l++) g += NC.xpNext(l);
      let j = p.jobXp - jx; for (let l = jl; l < p.jobLv; l++) j += NC.jobNext(l);
      r.xp += Math.max(0, g); r.jxp += Math.max(0, j); r.lv1 = p.lv; r.jlv1 = p.jobLv;
    }
  });
  NC.skillKills.push((game, e) => { const r = R(); if (r && e._heroT != null && game.time - e._heroT < 3 && !/^chest_/.test(e.type || '')) r.kills++; });
  if (NC.lootHeard) NC.lootHeard.push((game, e, id, c) => { const r = R(); if (r && r.drops.length < 300) r.drops.push([id, c && c.sh ? 1 : 0, (e && e.name) || '']); });
  const baseAdd = NC.addMat;
  // (online the server's record counts the materials, js/online/botreport.js: not twice)
  NC.addMat = function (game, id, n) { const r = R(); if (r && n > 0 && !(NC.Online && NC.Online.enabled)) r.mats[id] = (r.mats[id] || 0) + n; return baseAdd.apply(this, arguments); };
  if (NC.Progress) NC.Progress.onDeath = (loss) => { const r = R(); if (r) r.xpLost += loss; };

  // ---------------- the switch, coins, potions, faints ----------------
  let coins = null, pots = null, dead = false;
  setInterval(() => {
    const g = NC.game, p = g && g.player, A = NC.Auto;
    if (!p || !A) return;
    const allPots = () => (NC.POT ? NC.POT.count(p, 'red') + NC.POT.count(p, 'blue') : (p.potions || 0) + (p.spPotions || 0)); // (every size: js/potions.js)
    if (A.on && !st.run) { st.run = blank(p); coins = p.coins || 0; pots = allPots(); save(); }
    const r = R();
    if (r) {
      const c = p.coins || 0, d = c - (coins === null ? c : coins); coins = c;
      if (d > 0) r.earned += d; else r.spent -= d;
      const pt = allPots(); if (pots !== null && pt < pots) r.pots += pots - pt; pots = pt;
      if (p.dead > 0 && !dead) r.faints++;
      if (Math.random() < 0.1) save();
    }
    dead = p.dead > 0;
    if (!A.on && st.run) finish(g);
  }, 1000);
  function finish(game) {
    const r = st.run;
    st.run = null;
    r.t1 = Date.now();
    if (r.t1 - r.t0 < 5 * 60e3) { save(); return; }
    st.last = r; st.unread = true; save();
    show(game);
  }

  // ---------------- the page ----------------
  const rankOf = (id) => { const it = ITEMS[id], k = NC.gearKind ? NC.gearKind(it) : 'A'; return { L: 5, D: 4, C: 3, B: 2 }[k] || (it.rarity === 'legend' ? 4 : it.rarity === 'epic' ? 3 : 1); };
  function html(r, live) {
    if (!r) return '<div class="bb-empty">ยังไม่มีสรุป · เปิดออโต้ฟาร์ม (Z) แล้วปล่อยให้ฟาร์มสักพัก พอกลับมาจะเห็นว่าเกิดอะไรขึ้นบ้าง</div>';
    const mins = Math.max(1, Math.round(((r.t1 || Date.now()) - r.t0) / 60000)), hrs = mins / 60;
    const drops = r.drops.slice().sort((a, b) => b[1] - a[1] || rankOf(b[0]) - rankOf(a[0]));
    const mats = Object.entries(r.mats).sort((a, b) => b[1] * ((MAT[b[0]] || {}).price || 0) - a[1] * ((MAT[a[0]] || {}).price || 0));
    const matVal = mats.reduce((s, [id, n]) => s + n * ((MAT[id] || {}).price || 0), 0);
    let h = `<div class="bb-h">${live ? 'กำลังฟาร์มอยู่' : 'สรุปคืนที่ผ่านมา'} <small>${mins >= 90 ? (mins / 60).toFixed(1) + ' ชั่วโมง' : mins + ' นาที'} · ${esc((NC.MAPS[r.map] || {}).name || r.map)}</small></div>` +
      '<div class="bb-tiles">' +
        `<div class="bb-tile"><b>${r.kills.toLocaleString()}</b><span>มอนที่ล่า (${Math.round(r.kills / hrs).toLocaleString()} ต่อชม.)</span></div>` +
        `<div class="bb-tile"><b>${r.xp.toLocaleString()}</b><span>EXP${r.lv1 > r.lv0 ? ` · Lv ${r.lv0} → ${r.lv1}` : ''}</span></div>` +
        `<div class="bb-tile"><b>${r.jxp.toLocaleString()}</b><span>Job EXP${r.jlv1 > r.jlv0 ? ` · Job ${r.jlv0} → ${r.jlv1}` : ''}</span></div>` +
        `<div class="bb-tile"><b>${fmt(matVal)}</b><span>ค่าวัตถุดิบที่เก็บได้ (ราคาร้าน)</span></div>` +
      '</div>';
    h += `<div class="bb-h2">ของที่ดรอป <small>${drops.length} ชิ้น</small></div>`;
    h += drops.length ? '<div class="bb-list">' + drops.slice(0, 30).map(([id, sh, from]) => {
      const it = ITEMS[id]; if (!it) return '';
      const col = { rare: '#2f7fd0', epic: '#8a4fd0', legend: '#b87800' }[it.rarity] || 'inherit'; // (the rarity colours, darker on cream)
      return `<div class="bb-row ${sh || rankOf(id) >= 3 ? 'on' : ''}"><canvas width="64" height="64" data-icon="${id}"></canvas><div class="t"><b style="color:${col}">${sh ? '✦ ' : ''}${esc(it.name)}</b><small>จาก${esc(from)}</small></div></div>`;
    }).join('') + (drops.length > 30 ? `<div class="bb-sub">และอีก ${drops.length - 30} ชิ้นในกระเป๋า</div>` : '') + '</div>' : '<div class="bb-sub">รอบนี้ไม่มีอุปกรณ์ดรอป · ของดีหายาก ลองรอบหน้า</div>';
    h += '<div class="bb-h2">วัตถุดิบ</div>' + (mats.length ? '<div class="bb-sub">' + mats.slice(0, 16).map(([id, n]) => `${esc((MAT[id] || { name: id }).name)} ×${n}`).join(' · ') + '</div>' : '<div class="bb-sub">—</div>');
    h += '<div class="bb-h2">อื่น ๆ</div><div class="bb-sub">' +
      `ได้เงิน ${fmt(r.earned)} · ใช้เงิน ${fmt(r.spent)} · ใช้ยา ${r.pots} ขวด · หมดแรง ${r.faints} ครั้ง${r.xpLost ? ` (เสีย EXP ${r.xpLost.toLocaleString()})` : ''}</div>`;
    if (r.faints >= 3) h += '<div class="bb-note">หมดแรงบ่อย ลองให้บอทกลับค่ายเร็วขึ้น ตั้งยาเพิ่ม หรือฟาร์มแมพที่เลเวลต่ำกว่านี้ · ขนนกไออุ่นที่ลุงโกโก้กันการเสีย EXP ได้</div>';
    return h;
  }
  const paint = (el) => { for (const cv of el.querySelectorAll('canvas[data-icon]')) cv.getContext('2d').drawImage(NC.itemIcon(cv.dataset.icon, 64), 0, 0); };
  H.add({ id: 'report', name: 'สรุปบอท', icon: 'ic_report', order: 10,
    render(el) { el.innerHTML = st.run ? html(st.run, true) + '<div class="bb-h2">รอบก่อน</div>' + html(st.last) : html(st.last); paint(el); if (st.unread) { st.unread = false; save(); } },
    dot: () => st.unread });

  // ---------------- the pop-up ----------------
  let pop = null;
  function show(game) {
    if (!pop) {
      pop = document.createElement('div');
      pop.className = 'rp-pop'; pop.hidden = true;
      pop.innerHTML = '<section class="kw-win rp-win"><header class="kw-title"><span>สรุปคืนที่ผ่านมา</span><button class="kw-x" aria-label="ปิด">✕</button></header><div class="rp-body" id="rp-body"></div></section>';
      document.body.appendChild(pop);
      pop.querySelector('.kw-x').addEventListener('click', hide);
      pop.addEventListener('mousedown', (e) => { if (e.target === pop) hide(); });
    }
    const b = pop.querySelector('#rp-body');
    b.innerHTML = html(st.last) + '<div style="margin-top:calc(14*var(--u));text-align:center"><button class="kw-btn gold" id="rp-ok">เยี่ยม! ไปต่อ</button></div>';
    paint(b);
    b.querySelector('#rp-ok').addEventListener('click', hide);
    pop.hidden = false;
    st.unread = false; save();
    if (game) game.paused = true;
  }
  function hide() { if (pop) pop.hidden = true; if (NC.game) NC.game.paused = false; }
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && pop && !pop.hidden) { e.stopImmediatePropagation(); hide(); } }, true);
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    if (st.unread && st.last) setTimeout(() => show(game), 1200);
  };
  NC.Report = { show: () => show(NC.game), state: st };
})();
