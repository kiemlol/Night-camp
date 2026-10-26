/* p3_arts.js — สมุดวิชามอน (#blarts) redrawn from the picked mockup (assets/gen/nightcamp_p3_arts_a_raw.png, UI audit round
   3, 2026-10-17): a K window, the rule line, folder tabs ทั้งหมด / มอน / บอส, the two slots big across the top like hotbar
   keys 7 and 8 (key cap, the art's monster, เอาออก), the arts as a grid of square cards (the monster's own sprite on a
   backdrop of its element, the name, the tier as three pips) with the picked one outlined, and the picked art's details
   in a dark card on the right (ช่อง 7 / ช่อง 8). Arts not collected yet are plain "?" tokens.
   How it hooks (js/bl_arts.js is not edited): bl_arts.js keeps openBook() and render() private, and the hotbar's 7 / 8
   slots call openBook() directly, so
     - NC.BL.arts.open is wrapped (callers from outside), and
     - a MutationObserver on <body> waits for #blarts to be made, then watches it: when it is shown (hidden removed) the
       window's old card is hidden and this file's window is put next to it; whenever the old render() rewrites its
       (hidden) #bla-body, this window is redrawn too.
   The slot buttons carry bl_arts.js's own data-blaset="type:i" / data-blaoff="i", so its click handler on #blarts does
   the slotting (saving, the hotbar icons) exactly as before; the tabs and the picking are this file's.
   Closing: the K ✕ here, or Escape (bl_arts.js's own handler) — both unpause the game. */
(function () {
  'use strict';
  const NC = window.NC, BL = NC.BL;
  if (!BL || !BL.arts) return;
  const ART = BL.arts, AS = ART.got, BOSS = ART.BOSS || {};
  const ROMAN = ['', 'I', 'II', 'III'], TIER_N = [0, 1, 3, 10];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ELTH = (el) => (BL.ELTH ? BL.ELTH(el) : el);
  const ELS = ['neutral', 'water', 'earth', 'fire', 'wind', 'poison', 'holy', 'shadow', 'ghost', 'undead'];
  const elOf = (a) => (ELS.includes(a.el) ? a.el : 'neutral');

  let filter = '', pick = null, wrap = null, obs = null;

  // ---------------- the data (the same lists as bl_arts.js) ----------------
  const allTypes = () => {
    const sp = Object.keys(NC.SPECIES || {}).filter((t) => !(NC.SPECIES[t] && NC.SPECIES[t].eliteOf));
    return sp.concat(Object.keys(BOSS).filter((t) => !NC.SPECIES[t]));
  };
  const isBossArt = (t) => !!BOSS[t];
  const mineList = () => Object.keys(AS.got).filter((t) => AS.got[t] > 0 && (NC.SPECIES[t] || BOSS[t])).map(ART.artOf)
    .sort((a, b) => (b.boss - a.boss) || b.lv - a.lv);
  const passes = (boss) => !filter || (filter === 'boss' ? boss : !boss);

  // the monster's own sprite (the painted file when there is one; else a canvas copy, as bl_arts.js's hotbar icons)
  const iconCache = {};
  function monSrc(t) {
    if (iconCache[t]) return iconCache[t];
    const S = NC.SPR[t];
    let src = BL.icon ? BL.icon('bl_echo') : '';
    if (S && S.src) src = S.src;
    else if (S && S.img) {
      try {
        const c = document.createElement('canvas'), w = S.img.naturalWidth || S.img.width, h = S.img.naturalHeight || S.img.height, m = Math.max(w, h), Z = 192;
        c.width = c.height = Z; c.getContext('2d').drawImage(S.img, (Z - (w * Z) / m) / 2, (Z - (h * Z) / m) / 2, (w * Z) / m, (h * Z) / m);
        src = c.toDataURL();
      } catch (e) { /* the echo crystal */ }
    }
    return (iconCache[t] = src);
  }

  // ---------------- the pieces ----------------
  const pips = (tr) => `<span class="p3a-pips${tr >= 3 ? ' max' : ''}">${[1, 2, 3].map((k) => `<i class="${k <= tr ? 'on' : ''}"></i>`).join('')}</span>`;
  function slotH(i) {
    const t = AS.slots[i], a = t && ART.tierOf(t) ? ART.artOf(t) : null;
    if (!a) {
      return `<div class="p3a-slot empty" data-p3slot="${i}"><span class="p3a-key">${7 + i}</span>` +
        `<span class="p3a-sport"><img src="${esc(BL.icon ? BL.icon('bl_echo') : '')}" alt=""></span>` +
        `<div class="p3a-stxt"><b>ช่อง ${7 + i}: ว่าง</b><small>เลือกวิชาในตาราง แล้วกด “ช่อง ${7 + i}”</small></div></div>`;
    }
    return `<div class="p3a-slot${pick === t ? ' on' : ''}" data-p3slot="${i}" data-p3pick="${esc(t)}" title="ดูรายละเอียด"><span class="p3a-key">${7 + i}</span>` +
      `<span class="p3a-sport"><img src="${esc(monSrc(t))}" alt=""></span>` +
      `<div class="p3a-stxt"><b>ช่อง ${7 + i}: ${esc(a.n)} ${ROMAN[ART.tierOf(t)]} · ${esc(a.mon)}</b>` +
      `<button class="kw-btn grey p3a-off" data-blaoff="${i}">เอาออก</button></div></div>`;
  }
  function cardH(a) {
    const tr = ART.tierOf(a.t), at = AS.slots.indexOf(a.t);
    return `<button class="p3a-card el-${elOf(a)}${pick === a.t ? ' on' : ''}" data-p3pick="${esc(a.t)}" title="${esc(a.n)} ${ROMAN[tr]} · ${esc(a.mon)}">` +
      (at >= 0 ? `<span class="p3a-in">${7 + at}</span>` : '') + pips(tr) +
      `<img src="${esc(monSrc(a.t))}" alt="" loading="lazy"><b>${esc(a.n)} ${ROMAN[tr]}</b></button>`;
  }
  const qCard = (k) => `<button class="p3a-card q${pick === '?' ? ' on' : ''}" data-p3pick="?" data-p3q="${k}" title="ยังไม่ได้วิชานี้">${pips(0)}<span class="p3a-qt">?</span><b>ยังไม่พบ</b></button>`;
  function detailH(list, missing) {
    if (pick === '?') {
      return '<aside class="kw-card p3a-det q"><h3>วิชาที่ยังไม่พบ</h3><div class="p3a-big"><span class="p3a-qt">?</span></div>' +
        `<p class="p3a-meta"><span>ยังขาดอีก ${missing} วิชาในหมวดนี้</span> · <span>ได้ครั้งแรก = ขั้น I</span></p><hr>` +
        '<p class="p3a-desc">มอนทุกสายพันธุ์มีโอกาสดรอปเสียงสะท้อนของท่าประจำตัว เข้าสมุดทันทีเมื่อปราบเอง</p>' +
        '<p class="p3a-rates">มอน Lv 1–40: 0.1% · Lv 41–80: 0.06% · Lv 81+: 0.04% · บอสแมพ 2% · บอสเนื้อเรื่อง 3%</p></aside>';
    }
    const a = list.find((x) => x.t === pick);
    if (!a) return '<aside class="kw-card p3a-det none"><h3>ยังไม่มีวิชามอน</h3><p class="p3a-desc">มอนทุกสายพันธุ์มีโอกาสดรอปเสียงสะท้อนของท่าประจำตัว (บอสดรอปง่ายกว่า)</p></aside>';
    const tr = ART.tierOf(a.t), n = AS.got[a.t] || 0, next = tr < 3 ? `อีก ${TIER_N[tr + 1] - n} ชิ้นถึงขั้น ${ROMAN[tr + 1]}` : 'ขั้นสูงสุด';
    const btn = (i) => (AS.slots[i] === a.t
      ? `<button class="kw-btn grey off" data-blaoff="${i}">ถอดช่อง ${7 + i}</button>`
      : `<button class="kw-btn ${i ? 'grey' : 'blue'}" data-blaset="${esc(a.t)}:${i}">ช่อง ${7 + i}</button>`);
    return `<aside class="kw-card p3a-det el-${elOf(a)}"><h3>${esc(a.n)} ${ROMAN[tr]}${a.boss ? ' <span class="kw-tag p3a-boss">บอส</span>' : ''}</h3>` +
      `<div class="p3a-big"><img src="${esc(monSrc(a.t))}" alt=""></div>` +
      `<p class="p3a-meta">${[`จาก${esc(a.mon)} Lv ${a.lv}`, `ธาตุ${esc(ELTH(a.el))}`, `คูลดาวน์ ${a.cd} วิ`, `×${n}`, next].map((x) => `<span>${x}</span>`).join(' · ')}</p><hr>` +
      `<p class="p3a-desc">${esc(a.d)}</p><div class="p3a-btns">${btn(0)}${btn(1)}</div></aside>`;
  }

  // ---------------- building / drawing ----------------
  function build(win) {
    const old = win.querySelector(':scope > .card');
    if (old) old.classList.add('p3a-old'); // (kept, hidden: bl_arts.js's render() still writes into its #bla-body)
    win.classList.add('kw-panel', 'p3a-panel');
    wrap = document.createElement('div');
    wrap.className = 'p3a-wrap';
    wrap.innerHTML = '<section class="kw-win p3a-win"><header class="kw-title"><span>สมุดวิชามอน</span>' +
      '<button class="kw-x p3a-x" aria-label="ปิด">✕</button></header>' +
      '<div class="p3a-rule" id="p3a-rule"></div>' +
      '<nav class="kw-tabs p3a-tabs" id="p3a-tabs"></nav>' +
      '<div class="p3a-slots" id="p3a-slots"></div>' +
      '<div class="p3a-main"><div class="kw-inset p3a-gridbox"><div class="p3a-grid kw-scroll" id="p3a-grid"></div></div><div class="p3a-detbox" id="p3a-det"></div></div>' +
      '</section>';
    win.appendChild(wrap);
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('button, [data-p3pick]');
      if (!b) return;
      if (b.classList.contains('p3a-x')) { close(win); return; }
      if (b.dataset.p3f !== undefined) { filter = b.dataset.p3f; draw(); return; }
      if (b.dataset.blaset || b.dataset.blaoff !== undefined) {
        // (bl_arts.js's handler on #blarts does the work next; its render() then redraws this window)
        if (b.dataset.blaset) pick = b.dataset.blaset.split(':')[0];
        return;
      }
      if (b.dataset.p3pick !== undefined) { pick = b.dataset.p3pick; draw(); }
    });
    // the old render() rewrote its body: redraw (after a slot change made through bl_arts.js's handler)
    const body = win.querySelector('#bla-body');
    if (body) new MutationObserver(() => { if (!win.hidden) draw(); }).observe(body, { childList: true });
  }
  function close(win) {
    win.hidden = true;
    if (NC.game) NC.game.paused = false;
  }
  function draw() {
    const win = document.getElementById('blarts');
    if (!win || !wrap || win.hidden) return;
    const mine = mineList(), types = allTypes(), total = types.length;
    const list = mine.filter((a) => passes(a.boss));
    const missingN = types.filter((t) => !(AS.got[t] > 0) && passes(isBossArt(t))).length;
    if (pick !== '?' && !list.some((a) => a.t === pick)) {
      const s7 = AS.slots.find((t) => t && list.some((a) => a.t === t));
      pick = s7 || (list[0] && list[0].t) || (missingN ? '?' : null);
    }
    wrap.querySelector('#p3a-rule').innerHTML = `<span>มีแล้ว <b>${mine.length} / ${total}</b> วิชา · เก็บซ้ำ 1 / 3 / 10 ชิ้น = ขั้น I / II / III · กด 7 / 8 ใช้วิชาในช่อง</span>`;
    wrap.querySelector('#p3a-tabs').innerHTML = [['', 'ทั้งหมด'], ['mon', 'มอน'], ['boss', 'บอส']]
      .map(([k, t]) => `<button class="kw-tab${filter === k ? ' on' : ''}" data-p3f="${k}">${t}</button>`).join('');
    wrap.querySelector('#p3a-slots').innerHTML = slotH(0) + slotH(1);
    const grid = wrap.querySelector('#p3a-grid'), top = grid.scrollTop;
    let h = list.map(cardH).join('');
    for (let k = 0; k < missingN; k++) h += qCard(k);
    grid.innerHTML = h || '<div class="p3a-empty">ไม่มีวิชาในหมวดนี้</div>';
    grid.scrollTop = top;
    wrap.querySelector('#p3a-det').innerHTML = detailH(list, missingN);
  }
  function upgrade() {
    const win = document.getElementById('blarts');
    if (!win) return;
    if (!wrap || !win.contains(wrap)) build(win);
    if (!win.hidden) draw();
  }

  // ---------------- the hooks ----------------
  const baseOpen = ART.open;
  ART.open = function () {
    const r = baseOpen.apply(this, arguments);
    upgrade();
    return r;
  };
  // (the hotbar slots call bl_arts.js's private openBook(): watch for the window being made, then for it being shown)
  function watch(win) {
    if (obs) obs.disconnect();
    obs = new MutationObserver(() => { if (!win.hidden) upgrade(); });
    obs.observe(win, { attributes: true, attributeFilter: ['hidden'] });
    upgrade();
  }
  const found = document.getElementById('blarts');
  if (found) watch(found);
  else {
    const bodyObs = new MutationObserver(() => {
      const w = document.getElementById('blarts');
      if (w) { bodyObs.disconnect(); watch(w); }
    });
    const start = () => bodyObs.observe(document.body, { childList: true });
    if (document.body) start(); else addEventListener('DOMContentLoaded', start);
  }

  NC.P3Arts = { draw, upgrade, pick: (t) => { pick = t; draw(); } };
})();
