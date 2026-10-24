/* craftgo.js — งานฝีมือ: crafting away from the camp (the user, 2026-10-17: "ต้องทำระบบ สำหรับ คราฟหรืออื่น โดยไม่ต้อง
   กลับบ้านได้ด้วยนะ เฉพาะบางระบบ"; picks: cooking + potion brewing and the smith's crafting, from a menu button anywhere,
   out of combat for 8 s, not in dungeons / the Dark Root / the PvP arena / the guild war; the same prices as in the camp).
   The window is mockup A (assets/gen/nightcamp_craftgo_a_raw.png): the stations down the left in two groups, the page on
   the right with a breadcrumb.
     ใช้ได้ทุกที่   ทำอาหาร (js/cooking.js) · ต้มยา (js/brew.js) · ตีอาวุธ (the forge's make tab, js/forge.js + forgecraft.js)
                   · ธาตุ · น้ำมัน (js/bl_core.js's forge tab; its แปดเปื้อน part stays in the camp) · รวมรูน (js/bl_runes.js)
     ที่แคมป์      ตีบวก (js/refine.js's box) · ขัดเกรด (js/gradetier.js's tab) · หินออฟ · เจาะออฟ (the forge's own tab)
   The user's rule for new pages (same day): "ทำเป็นระบบลิ้งไปต่อได้ ... อย่าทำให้การคลิกบอด" — nothing is a dead click:
   a camp station opens its real page with the real numbers, and where its button would be there is "พาเดินไปหา
   ป๋าหมูหริ่ง" (NC.Travel walks the hero there and the page opens again on arrival); an ingredient opens where it comes
   from with a map route; the bag's blind lines (ตีบวก / ขัดเกรด away from the forge) lead here too.
   Hooks: NC.hurtPlayer / NC.damageEnemy / NC.updatePlayer (the combat clock), NC.HUD.init / panel (the window, the menu
   button, Y), NC.invCardExtras / NC.invActs (the bag). Opened also by NC.CraftGo.open(page).
   Test: ?craftgo or ?craftgo=cook|brew|make|bl|runes|refine|grade|opt opens it. */
(function () {
  'use strict';
  const NC = window.NC, MAT = NC.MATERIALS, ITEMS = NC.ITEMS;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n) => NC.fmtCoins(n);
  const IC = (n) => `assets/craftgo/${n}.png`;
  const G = () => NC.game;
  const KEY = 'nightcamp.craftgo.v1';

  // ---------------- may the hero craft here? ----------------
  const QUIET = 8; // seconds since the last hit taken or dealt (real seconds: the window pauses the game)
  let lastHit = -1e9, seenFight = -99;
  const stamp = () => { lastHit = performance.now(); };
  const baseHurt = NC.hurtPlayer;
  NC.hurtPlayer = function (game) {
    const p = game && game.player;
    if (p && !(p.inv > 0 || p.dead > 0)) stamp();
    return baseHurt.apply(this, arguments);
  };
  const baseDamage = NC.damageEnemy;
  NC.damageEnemy = function (game, e) {
    if (e && e.hp > 0) stamp();
    return baseDamage.apply(this, arguments);
  };
  const baseUpdate = NC.updatePlayer;
  NC.updatePlayer = function (game) {
    const r = baseUpdate.apply(this, arguments), p = game.player;
    if (p && p.lastFight !== seenFight) { if (p.lastFight > seenFight) stamp(); seenFight = p.lastFight; } // (a swing or a cast)
    return r;
  };
  function mapBlock(game) {
    const w = game.world || {}, id = game.mapId || '';
    if (w.dungeon) return 'ในดันเจี้ยนใช้งานฝีมือไม่ได้';
    if ((NC.Root && NC.Root.run && NC.Root.run()) || /^root_/.test(id)) return 'ในรากต้นไม้มืดใช้งานฝีมือไม่ได้';
    if (w.pvpArena || id === 'pvp_lake') return 'ในเวทีประลองใช้งานฝีมือไม่ได้';
    if (NC.GW && NC.GW.on && NC.GW.on()) return 'ในศึกชิงกองไฟใช้งานฝีมือไม่ได้';
    return '';
  }
  function state(game) {
    const p = game && game.player;
    if (!p) return { ok: false, code: 'none', why: '' };
    if (p.dead > 0) return { ok: false, code: 'dead', why: 'หมดแรงอยู่ รอฟื้นก่อนนะ' };
    const m = mapBlock(game);
    if (m) return { ok: false, code: 'map', why: m };
    const left = QUIET - (performance.now() - lastHit) / 1000;
    if (left > 0) return { ok: false, code: 'fight', why: 'กำลังต่อสู้', left: Math.ceil(left) };
    return { ok: true, code: 'ok', why: '' };
  }
  const placeName = (game) => (NC.MAPS[game.mapId] || {}).name || '';
  const nearForge = (game) => !!(NC.Forge && NC.Forge.near && NC.Forge.near(game));

  // ---------------- the stations ----------------
  const XT = (k) => (NC.FORGE_TABS || []).find((T) => T.key === k);
  const PAGES = [
    { key: 'cook', name: 'ทำอาหาร', icon: 'cg_cook', any: true, has: () => !!NC.Cook, what: 'อาหารบัฟ 30 นาที จากผัก ปลา และวัสดุมอน' },
    { key: 'brew', name: 'ต้มยา', icon: 'cg_brew', any: true, has: () => !!NC.Brew, what: 'ต้มยาแดง ยาฟ้า จากวัสดุมอนราคาถูก' },
    { key: 'make', name: 'ตีอาวุธ', icon: 'cg_weapon', any: true, has: () => !!(NC.Forge && NC.Forge.into), what: 'อาวุธทุกชนิดจากวัสดุ แร่ และไม้' },
    { key: 'bl', name: 'ธาตุ · น้ำมัน', icon: 'cg_ess', any: true, has: () => !!XT('bl'), what: 'สกัดแก่นธาตุ ทำน้ำมันเคลือบและกระสุน' },
    { key: 'runes', name: 'รวมรูน', icon: 'cg_rune', any: true, has: () => !!XT('runes'), what: 'รูนขั้นเดียวกัน 3 อัน รวมเป็นขั้นถัดไป' },
    { key: 'refine', name: 'ตีบวก', icon: 'cg_refine', camp: true, has: () => !!NC.invCardExtras, what: 'ตีบวก +1 ถึง +10 ที่เตาของป๋าหมูหริ่ง' },
    { key: 'grade', name: 'ขัดเกรด', icon: 'cg_grade', camp: true, has: () => !!XT('grade'), what: 'ขัดเกรดสีของของสวมใส่' },
    { key: 'opt', name: 'หินออฟ · เจาะออฟ', icon: 'cg_opt', camp: true, has: () => !!(NC.Forge && NC.Forge.into), what: 'เปลี่ยนออฟด้วยหินออฟ เจาะแถวออฟใหม่' },
  ];
  const PG = Object.fromEntries(PAGES.map((P) => [P.key, P]));
  // what stays in the camp, page by page: the action buttons (disabled away from the forge, with the walk button)
  const CAMP_ACTS = { grade: '[data-gtgo]', opt: '#fg-drill, #fg-stone, #fg-sell', bl: '#bl-sap, #bl-dew' };
  // what needs the go-ahead (out of combat, an allowed map) on the pages that work anywhere
  const ANY_ACTS = { cook: '[data-cgcook]', brew: '[data-brew]', make: '[data-make], [data-fmgo]', bl: '[data-blext], [data-blextall], [data-blmake], [data-bloil], [data-blammo]', runes: '[data-blmerge]' };

  let win = null, page = 'cook', dish = null, tip = null, refU = 0, lastOk = null, lastLine = '';
  try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); if (PG[s.page]) page = s.page; } catch (e) { /* storage blocked */ }
  const remember = () => { try { localStorage.setItem(KEY, JSON.stringify({ page })); } catch (e) { /* storage blocked */ } };

  // ---------------- building the window ----------------
  function stationBtn(P) {
    return `<button class="cg-st${P.camp ? ' camp' : ''}" data-cgpage="${P.key}"><img src="${IC(P.icon)}" alt=""><span>${esc(P.name)}</span>` +
      (P.camp ? `<img class="cg-pin" src="${IC('cg_pin')}" alt="">` : '<i class="cg-n" hidden></i>') + '</button>';
  }
  function build() {
    win = document.createElement('div');
    win.id = 'craftgo'; win.className = 'kw-panel'; win.hidden = true;
    const any = PAGES.filter((P) => P.any && P.has()), camp = PAGES.filter((P) => P.camp && P.has());
    win.innerHTML = '<div class="cg-wrap"><section class="kw-win cg-win">' +
      `<header class="kw-title"><span>งานฝีมือ</span><span class="cg-coins"><img src="${NC.matIcon('ic_coin')}" alt=""><b id="cg-coins">0</b></span>` +
      '<button class="kw-x" id="cg-close" aria-label="ปิด">✕</button></header>' +
      '<div class="cg-body"><aside class="cg-side">' +
        '<div class="cg-ready" id="cg-ready"></div><div class="cg-sub" id="cg-sub"></div>' +
        '<span class="cg-tag any">ใช้ได้ทุกที่</span><div class="cg-grp">' + any.map(stationBtn).join('') + '</div>' +
        `<span class="cg-tag camp"><img src="${IC('cg_camp')}" alt="">ที่แคมป์</span><div class="cg-grp">` + camp.map(stationBtn).join('') + '</div>' +
      '</aside><main class="cg-main"><nav class="cg-crumb" id="cg-crumb"></nav><div class="cg-page" id="cg-page"></div></main></div>' +
      '</section></div>';
    document.body.appendChild(win);
    $('cg-close').addEventListener('click', close);
    win.addEventListener('click', onClick);
    win.addEventListener('change', (e) => {
      if (e.target && e.target.dataset && e.target.dataset.gtpick) setTimeout(render, 0); // (gradetier.js picks first)
      else if (NC.ForgeMake && NC.ForgeMake.change(e.target)) render();
    });
    win.addEventListener('mousedown', (e) => { if (e.target === win) close(); }); // (a click on the dim backdrop)
    // the forge draws its own tabs into our page (make / opt): mark the page again after each of its renders
    new MutationObserver(() => decorate()).observe($('cg-page'), { childList: true });
  }

  function onClick(e) {
    const b = e.target.closest('button, [data-cgtip], a[data-cglink]');
    const g = G();
    if (tip && !(b && (b.dataset.cgtip || b.closest('.cg-tip')))) { tip = null; drawTip(); }
    if (!b || b.disabled || !g) return;
    const D = b.dataset;
    if (D.cgpage) { go(D.cgpage); return; }
    if (D.cglink) { if (D.cglink === 'home') { page = 'home'; render(); } else go(D.cglink); return; }
    if (D.cgwalk) { walkTo(g, D.cgwalk); return; }
    if (D.cgtip) { tip = tip === D.cgtip ? null : D.cgtip; drawTip(b); return; }
    if (D.cgmap) { showOnMap(g, D.cgmap); return; }
    if (D.cgbook) { close(); g.paused = NC.HUD.panel(D.cgbook, true); return; }
    const rf = /^cg:refine:(\d+)$/.exec(D.act || ''); // (a made weapon's "ตีบวกเล่มนี้")
    if (rf) { if (NC.RefineWin) NC.RefineWin.select(Number(rf[1])); go('refine'); return; }
    if (page === 'make' && NC.ForgeMake) { if (NC.ForgeMake.click(b, g)) { coinBump(); render(); } return; } // (js/forgemake.js: mockup A)
    // the pages' own buttons
    if (page === 'cook') {
      if (D.cgdish) { dish = D.cgdish; render(); return; }
      if (D.cgcook) { if (state(g).ok && NC.Cook.cook(g, dish, Number(D.cgcook))) { coinBump(); render(); } return; }
      if (D.cgeat) { NC.Cook.eat(g, D.cgeat); render(); return; }
      if (b.id === 'cg-auto') { NC.Cook.auto = NC.Cook.auto === dish ? '' : dish; render(); return; }
    }
    if (page === 'brew' && D.brew) {
      const [rid, n] = D.brew.split(':');
      if (state(g).ok && NC.Brew.brew(g, rid, Number(n))) { g.toast(`ต้มยาเสร็จ ×${NC.Brew.BATCH * Number(n)}`); coinBump(); render(); }
      return;
    }
    if (page === 'make' || page === 'opt') { NC.Forge.click(b, g); coinBump(); return; } // (the forge draws the page again itself)
    if (page === 'bl' || page === 'runes' || page === 'grade') {
      const T = XT(page);
      if (b.matches(ANY_ACTS[page] || '#__') && !state(g).ok) return;
      if (b.matches(CAMP_ACTS[page] || '#__') && !nearForge(g)) return;
      if (T && T.click && T.click(b, g)) { coinBump(); render(); }
      return;
    }
    if (page === 'refine' && NC.RefineWin) { if (NC.RefineWin.click(b, g)) { coinBump(); render(); } return; }
    if (page === 'refine' && D.act) {
      if (/^rf:go/.test(D.act) && !nearForge(g)) return;
      if (/^rf:pick:/.test(D.act)) refU = Number(D.act.split(':')[2]);
      for (const f of NC.invActs || []) if (f(g, D.act, null)) break;
      coinBump(); render();
    }
  }
  function go(key) {
    if (!PG[key]) return;
    if (key !== page) { tip = null; if (key === 'refine') refU = 0; }
    page = key; remember(); render();
  }
  function coinBump() { const c = $('cg-coins'); if (c && G()) c.textContent = fmt(G().player.coins || 0); }

  // ---------------- open / close ----------------
  function open(key) {
    const g = G();
    if (!win || !g || !g.player) return false;
    if (key && (PG[key] || key === 'home')) page = key;
    NC.HUD.panel('pause', false); // (closes the other windows)
    win.hidden = false;
    g.paused = true;
    lastOk = null; tip = null;
    render();
    return true;
  }
  function close() {
    if (!win || win.hidden) return;
    win.hidden = true;
    if (NC.Forge && NC.Forge.into) NC.Forge.into(null);
    const g = G();
    if (g) g.paused = false;
  }
  function fit() {
    const wrap = win.querySelector('.cg-wrap');
    wrap.style.transform = 'translate(-50%, -50%)';
    if (document.documentElement.classList.contains('mob-port')) return;
    const k = Math.min(1, (innerWidth - 16) / wrap.offsetWidth, (innerHeight - 16) / wrap.offsetHeight);
    if (k < 1) wrap.style.transform = `translate(-50%, -50%) scale(${k.toFixed(4)})`;
  }
  addEventListener('resize', () => setTimeout(() => { if (win && !win.hidden) fit(); }, 0));

  // ---------------- the left column: where, the status, the stations ----------------
  function drawStatus() {
    const g = G(), s = state(g), el = $('cg-ready'), sub = $('cg-sub');
    let line;
    if (s.ok) line = `<span class="cg-ok"><i>✓</i>พร้อม · ${esc(placeName(g))}</span>`;
    else if (s.code === 'fight') line = `<span class="cg-wait"><i>!</i>${esc(s.why)} · รออีก ${s.left} วิ</span>`;
    else line = `<span class="cg-no"><i>✕</i>${esc(s.why)}</span>`;
    const subTxt = s.ok && nearForge(g) ? 'อยู่ข้างป๋าหมูหริ่ง · ใช้ได้ทุกสถานี' : s.ok ? 'ไม่ได้อยู่ในการต่อสู้' : s.code === 'fight' ? 'หยุดตีและหลบมอน 8 วิ แล้วทำได้เลย' : s.code === 'map' ? 'ออกไปที่แมพทุ่งหรือแคมป์ก่อน' : '';
    if (line + subTxt !== lastLine) { el.innerHTML = line; sub.textContent = subTxt; lastLine = line + subTxt; }
    el.className = 'cg-ready ' + (s.ok ? 'ok' : s.code === 'fight' ? 'wait' : 'no');
    return s;
  }
  function drawStations() {
    const g = G(), p = g.player;
    win.querySelectorAll('[data-cgpage]').forEach((b) => {
      b.classList.toggle('on', b.dataset.cgpage === page);
      const n = b.querySelector('.cg-n');
      if (!n) return;
      const k = countFor(b.dataset.cgpage, p);
      n.hidden = !k; n.textContent = k > 99 ? '99+' : String(k);
    });
  }
  // how many things can be made right now (the small badge on a station)
  function countFor(key, p) {
    try {
      if (key === 'cook' && NC.Cook) return NC.Cook.DISHES.filter((d) => !NC.Cook.locked(p, d) && !NC.Cook.canCook(p, d, 1)).length;
      if (key === 'brew' && NC.Brew) return NC.Brew.RECIPES.filter((R) => { const P = NC.Brew.plan(p, R.id, 1); return P && P.ok; }).length;
    } catch (e) { /* a system not ready yet */ }
    return 0;
  }
  // the status changes by itself (the fight clock runs down): keep the column and the buttons right while open
  setInterval(() => {
    if (!win || win.hidden || !G()) return;
    const s = drawStatus();
    if (lastOk !== null && s.ok !== lastOk) render();
    lastOk = s.ok;
  }, 250);

  // ---------------- the page ----------------
  function render() {
    if (!win || win.hidden) return;
    const g = G(), p = g.player;
    if (page !== 'home' && !(PG[page] && PG[page].has())) page = 'home';
    coinBump();
    const s = drawStatus();
    lastOk = s.ok;
    drawStations();
    const body = $('cg-page');
    if (NC.Forge && NC.Forge.into) NC.Forge.into(null);
    body.className = 'cg-page pg-' + page;
    if (page === 'home') { crumb([]); body.innerHTML = homeHtml(p); }
    else if (page === 'cook') { const d = NC.Cook.BY[dish] ? NC.Cook.BY[dish] : NC.Cook.DISHES[0]; dish = d.id; crumb([PG.cook.name, d.name]); body.innerHTML = cookHtml(g, p); }
    else if (page === 'brew') { crumb([PG.brew.name]); body.innerHTML = '<div class="cg-head"><b>ต้มยา</b><small>ใช้วัสดุมอนที่ราคาขายถูกที่สุดก่อน · ของที่ล็อกในกระเป๋าไม่ถูกใช้</small></div>' + NC.Brew.html(p); }
    else if (page === 'make' && NC.ForgeMake) { body.innerHTML = NC.ForgeMake.html(g, p, s); const t = body.querySelector('.fm-type.on span'); crumb([PG.make.name].concat(t ? [t.textContent] : [])); }
    else if (page === 'make' || page === 'opt') {
      crumb([PG[page].name]);
      NC.Forge.into(body, page === 'make' ? 'make' : 'mine');
      NC.Forge.render();
    } else if (page === 'bl' || page === 'runes' || page === 'grade') { crumb([PG[page].name]); XT(page).render(body, g); }
    else if (page === 'refine') { crumb([PG.refine.name]); body.innerHTML = NC.RefineWin ? NC.RefineWin.html(g, p, nearForge(g)) : refineHtml(g, p); } // (js/refinewin.js: mockup A of the refine page)
    decorate();
    drawTip();
    fit();
  }
  function crumb(parts) {
    const all = [['home', 'งานฝีมือ']].concat(parts.map((t, i) => [i === 0 ? page : '', t]));
    $('cg-crumb').innerHTML = all.map(([k, t], i) => (i < all.length - 1 && k ? `<a data-cglink="${k}">${esc(t)}</a>` : `<b>${esc(t)}</b>`)).join('<i>›</i>');
  }

  // after a page is drawn: what is not allowed here is disabled, and where it is done is linked
  function decorate() {
    if (!win || win.hidden) return;
    const g = G(), body = $('cg-page'), s = state(g);
    if (!s.ok && ANY_ACTS[page]) body.querySelectorAll(ANY_ACTS[page]).forEach((b) => { b.disabled = true; b.title = s.why; });
    if (PG[page] && (PG[page].camp || CAMP_ACTS[page]) && !nearForge(g) && !body.querySelector('.cg-go')) {
      const acts = CAMP_ACTS[page] ? [...body.querySelectorAll(CAMP_ACTS[page])] : [];
      acts.forEach((b) => { b.disabled = true; });
      // where the walk button goes: under the refine box · under the grade page's bottom row · at the top of the copy's
      // side (option stones, the taint part of essences), so it is seen without scrolling
      if (page === 'refine') { const at = body.querySelector('.cg-rfside'); if (at) at.insertAdjacentHTML('beforeend', walkHtml(page)); }
      else if (page === 'grade') { const at = body.querySelector('.gt2-bottom'); if (at) at.insertAdjacentHTML('afterend', walkHtml(page, true)); }
      else if (acts.length) { const at = body.querySelector('.fg-side .fg-head') || acts[0].parentNode; at.insertAdjacentHTML('afterend', walkHtml(page, true)); }
    }
    // the forge's recipe pills (an icon + a name + have/need): each opens where that material comes from
    if (page === 'make' || page === 'bl') body.querySelectorAll('.fg-need span').forEach((sp) => {
      const img = sp.querySelector('img'), id = img && iconId(img.getAttribute('src'));
      if (id && !sp.dataset.cgtip) { sp.dataset.cgtip = id; sp.classList.add('cg-link'); }
    });
  }
  // a material's id from its icon (the forge's pills carry only the picture)
  let iconIds = null;
  function iconId(src) {
    if (!iconIds) { iconIds = new Map(); for (const id in MAT) { const s = NC.matIcon(id); if (s && !iconIds.has(s)) iconIds.set(s, id); } }
    return iconIds.get(src) || null;
  }
  function walkHtml(key, light) {
    const what = key === 'bl' ? 'ราดยางไม้มืด / ล้างรอย' : PG[key].name;
    return `<div class="cg-go${light ? ' light' : ''}"><img class="cg-smith" src="assets/kui/npc_smith.jpg" alt=""><div><button class="kw-btn gold cg-walk" data-cgwalk="${key}">` +
      `<img src="${IC('cg_walk')}" alt="">พาเดินไปหาป๋าหมูหริ่ง</button><small>${esc(what)}ทำได้ที่โรงตีเหล็กกลางค่าย · เดินไปเองอัตโนมัติ</small></div></div>`;
  }

  // the home page: every station as a card (the breadcrumb's first link)
  function homeHtml(p) {
    const card = (P) => `<button class="cg-hcard${P.camp ? ' camp' : ''}" data-cgpage="${P.key}"><img src="${IC(P.icon)}" alt=""><span><b>${esc(P.name)}</b>` +
      `<small>${esc(P.what)}</small></span><em class="kw-tag ${P.camp ? 'camp' : 'any'}">${P.camp ? 'ที่แคมป์' : 'ใช้ได้ทุกที่'}</em></button>`;
    return '<div class="cg-head"><b>งานฝีมือ</b><small>ทำของได้ทุกที่ตอนไม่ได้สู้ · ตีบวก ขัดเกรด หินออฟ ยังต้องไปที่โรงตีเหล็กกลางค่าย</small></div>' +
      '<div class="cg-home">' + PAGES.filter((P) => P.has()).map(card).join('') + '</div>';
  }

  // ---------------- cooking ----------------
  const PILL = { red: 'ck-red', blue: 'ck-blue', green: 'ck-green', purple: 'ck-purple', yellow: 'ck-yellow', orange: 'ck-orange' };
  const dishIcon = (id) => (NC.Life && NC.Life.lifeIcon(id)) || NC.matIcon(id) || '';
  const mmss = (t) => { const s = Math.max(0, Math.ceil(t)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  function cookHtml(g, p) {
    const C = NC.Cook, L = NC.Life, R = L.rec(p).cook || { lv: 1, xp: 0 }, max = R.lv >= L.MAXLV;
    const need = L.xpNeed(R.lv), pct = max ? 100 : Math.min(100, (100 * R.xp) / need);
    let h = '<div class="cg-cook"><div class="cg-cl">' +
      `<div class="ck-title">ทำอาหาร Lv ${R.lv} - ${esc(L.rankOf(R.lv))}</div>` +
      `<div class="ck-xprow"><div class="ck-xp"><i style="width:${pct.toFixed(1)}%"></i></div><b>${max ? 'MAX' : Math.floor(pct) + '%'}</b></div><div class="ck-grid">`;
    for (const d of C.DISHES) {
      const lk = C.locked(p, d), n = NC.matCount(p, d.id);
      h += `<button class="ck-card${d.id === dish ? ' sel' : ''}${lk ? ' lk' : ''}" data-cgdish="${d.id}">` +
        (lk ? '<span class="ck-q">?</span>' : `<img src="${dishIcon(d.id)}" alt="">`) + (n && !lk ? `<em class="ck-have">×${n}</em>` : '') +
        `<b>${esc(d.name)}</b><span class="ck-pill ${lk ? 'ck-grey' : PILL[d.kind]}">${lk ? (C.lvOf(p) < d.lv ? `ทำอาหาร Lv ${d.lv}` : esc(L.TOOLS.pot.names[d.pot - 1])) : esc(d.tag)}</span></button>`;
    }
    h += '</div></div>';
    const d = C.BY[dish], lk = C.locked(p, d), n = NC.matCount(p, d.id), meal = C.state().meal, M = meal && C.BY[meal.id];
    const coins = C.coinsOf(p, d), why1 = C.canCook(p, d, 1), ok1 = !why1, ok5 = !C.canCook(p, d, 5);
    const st = NC.SPR.cook_station;
    h += '<div class="cg-cr kw-inset">' +
      `<div class="cg-meal">${M ? `<img src="${dishIcon(M.id)}" alt=""><span>${esc(M.name)} · เหลือ <b>${mmss(meal.t)}</b></span>` : '<span class="ck-none">ยังไม่ได้กินอาหาร</span>'}</div>` +
      '<div class="cg-dhead"><div class="cg-dinfo">' +
        `<div class="ck-name">${esc(d.name)}</div><span class="ck-pill ck-lg ${lk ? 'ck-grey' : PILL[d.kind]}">${esc(d.tag).split(' · ').join('<br>')}</span>` + // (Thai has no spaces to wrap at: two buffs, two lines)
        `<div class="ck-time"><i class="ck-clock"></i>${Math.round(C.durOf(p) / 60)} นาที</div>` +
        `<div class="ck-eatrow"><span>มีในกระเป๋า <b>${n}</b> จาน</span><button class="kw-btn blue" data-cgeat="${d.id}"${n ? '' : ' disabled'}>กิน</button></div>` +
      `</div><div class="cg-scene">${st ? `<img class="cg-stn" src="${st.img.src}" alt="">` : ''}<img class="cg-dish" src="${dishIcon(d.id)}" alt=""></div></div>` +
      '<div class="ck-mats cg-mats">';
    for (const id in d.mats) {
      const hv = NC.matCount(p, id), nd = d.mats[id], seen = p.matSeen && p.matSeen.has(id);
      h += `<button class="ck-mat cg-mat${tip === id ? ' on' : ''}" data-cgtip="${id}"><span class="ck-slot">${seen ? `<img src="${NC.matIcon(id) || dishIcon(id)}" alt="">` : '<i>?</i>'}</span>` +
        `<b>${esc((MAT[id] || {}).name || id)}</b><em class="${hv >= nd ? 'ok' : 'no'}">${hv}/${nd}</em></button>`;
    }
    h += `<div class="ck-mat"><span class="ck-slot ck-coinslot"><img src="${NC.matIcon('ic_coin')}" alt=""></span><b>${fmt(coins)} เหรียญ</b>` +
      `<em class="${(p.coins || 0) >= coins ? 'ok' : 'no'}">มี ${fmt(p.coins || 0)}</em></div></div>` +
      `<div class="ck-btns"><button class="kw-btn blue" data-cgcook="1"${ok1 ? '' : ' disabled'}>ทำ x1</button><button class="kw-btn gold" data-cgcook="5"${ok5 ? '' : ' disabled'}>ทำ x5</button></div>` +
      (why1 ? `<div class="ck-why">${esc(why1)}${!lk ? ' · กดวัตถุดิบเพื่อดูว่าหาได้ที่ไหน' : ''}</div>` : '') +
      `<button class="ck-auto${C.auto === d.id ? ' on' : ''}" id="cg-auto"${lk ? ' disabled' : ''}><i></i><span>ออโต้ฟาร์มกินจานนี้ให้เองเมื่อบัฟหมด</span></button>` +
      '</div></div>';
    return h;
  }

  // ---------------- where an ingredient comes from (the tooltip on its slot) ----------------
  const whereLives = (sp) => Object.keys(NC.ROSTER || {}).find((m) => m !== 'camp' && NC.MAPS[m] && JSON.stringify(NC.ROSTER[m]).includes(`"${sp}"`)) || null;
  function whereOf(id) {
    const D = NC.MAT_DROPS || {};
    for (const sp in D) {
      if (sp === 'slime' || sp === 'hollow' || !D[sp].some((x) => x[0] === id)) continue;
      const m = whereLives(sp), M = NC.MONSTERS[sp] || {};
      if (m) return { text: `ดรอปจาก${M.name || sp}`, map: m, place: NC.MAPS[m].name };
    }
    const src = (NC.matSource && NC.matSource(id)) || '';
    const life = /^(lf_|fs_)/.test(id);
    return { text: src ? (life ? src : `ดรอปจาก${src}`) : 'ยังไม่รู้ว่าได้จากที่ไหน', map: life && /ฟาร์ม|ปลูก|แปลง/.test(src) ? 'homefarm' : null, book: life ? 'life' : 'shop' };
  }
  function drawTip(anchor) {
    if (!win) return;
    const old = win.querySelector('.cg-tip');
    if (old) old.remove();
    if (!tip) return;
    const at = anchor || win.querySelector(`[data-cgtip="${tip}"]`);
    if (!at) return;
    const W = whereOf(tip), M = MAT[tip] || {}, g = G();
    const el = document.createElement('div');
    el.className = 'cg-tip kw-card';
    el.innerHTML = `<b>${esc(M.name || tip)}</b><small>${esc(W.text)}${W.place ? ' · ' + esc(W.place) : ''}</small>` +
      `<small>มีอยู่ ${fmt(NC.matCount(g.player, tip))} ชิ้น</small>` +
      (W.map ? `<button class="kw-btn blue" data-cgmap="${W.map}">ดูบนแผนที่</button>`
        : `<button class="kw-btn grey" data-cgbook="${W.book}">${W.book === 'life' ? 'เปิดสมุดอาชีพเสริม' : 'เปิดถุงวัสดุ'}</button>`);
    const box = win.querySelector('.cg-win'), r = at.getBoundingClientRect(), rb = box.getBoundingClientRect();
    const k = rb.width / box.offsetWidth; // (the window may be scaled down by fit())
    box.appendChild(el);
    el.style.left = Math.max(8, (r.left + r.width / 2 - rb.left) / k - el.offsetWidth / 2) + 'px';
    el.style.top = ((r.top - rb.top) / k - el.offsetHeight - 10) + 'px';
  }
  function showOnMap(g, mapId) {
    close();
    if (NC.MapRoute && NC.MapRoute.set) NC.MapRoute.set(mapId);
    g.paused = NC.HUD.panel('bigmap', true);
  }

  // ---------------- refine: the bag card's own box, beside a list of the copies ----------------
  function refineHtml(g, p) {
    const W = NC.GEAR, list = W ? W.bag(p).filter((c) => ITEMS[c.id]) : [];
    if (!list.length) return '<div class="cg-head"><b>ตีบวก</b></div><div class="fg-empty">ยังไม่มีของที่ตีบวกได้ · ลองล่ามอนหรือตีอาวุธก่อนนะ</div>';
    const worn = (c) => Object.keys(p.equip).some((k) => W.wornIn(p, k) === c);
    let c = list.find((x) => x.u === refU);
    if (!c) { c = list.find(worn) || list[0]; refU = c.u; for (const f of NC.invActs || []) if (f(g, 'rf:pick:' + c.u, null)) break; }
    const icon = (id) => { try { return NC.itemIcon(id, 96).toDataURL(); } catch (e) { return ''; } };
    let box = '';
    for (const f of NC.invCardExtras || []) { const h = f(p, c.id); if (h && h.indexOf('rf-box') >= 0) { box = h; break; } }
    return '<div class="cg-rf"><div class="cg-rflist kw-scroll">' + list.sort((a, b) => (worn(b) - worn(a)) || ((b.ref || 0) - (a.ref || 0))).map((x) =>
      `<button class="cg-rfrow${x.u === c.u ? ' on' : ''}" data-act="rf:pick:${x.u}" style="--rc:${(NC.RARITY[ITEMS[x.id].rarity] || {}).color || '#cfc6b8'}"><img src="${icon(x.id)}" alt=""><span><b>${x.sh ? '✦ ' : ''}${esc(ITEMS[x.id].name)}</b>` +
      `<small>${esc(NC.SLOT_NAME && NC.SLOT_NAME[ITEMS[x.id].slot] || '')}${worn(x) ? ' · สวมอยู่' : ''}</small></span><em>+${x.ref || 0}</em></button>`).join('') + '</div>' +
      `<div class="cg-rfside kw-card"><div class="cg-rfhead"><img src="${icon(c.id)}" alt=""><b>${esc(NC.copyName(c))}</b></div>${box || '<div class="rf-line dim">ชิ้นนี้ตีบวกไม่ได้</div>'}</div></div>`;
  }

  // ---------------- walking to the forge (the camp stations) ----------------
  function walkTo(g, key) {
    const n = NC.Forge && NC.Forge.npc;
    close();
    if (n) walkNpc(g, { x: n.x - 60, y: n.y + 90, name: 'ป๋าหมูหริ่ง', near: () => nearForge(G()), then: () => open(key) });
  }
  // walk the hero to a camp NPC and open what was asked on arrival (also for Uncle Coco's tabs, js/shopwin.js)
  function walkNpc(g, T) {
    if (g.mapId === 'camp' && T.near && T.near()) { T.then(); return; }
    if (NC.Travel && NC.Travel.go) {
      NC.Travel.go(g, { map: 'camp', x: T.x, y: T.y, r: 150, name: T.name, done: () => setTimeout(T.then, 200) });
      g.toast(`กำลังเดินไปหา${T.name} · เดินเองเพื่อหยุด`);
    } else if (NC.MapRoute && NC.MapRoute.set) { NC.MapRoute.set('camp'); g.toast('ตามลูกศรสีทองไปที่แคมป์'); }
  }

  // ---------------- the bag: its blind lines lead here (the user's rule) ----------------
  // (the bag's refine line is js/refinewin.js's mini box: its button opens the refine page on that copy)
  const openRefine = (game, u) => { NC.HUD.panel('bag', false); if (u && NC.RefineWin) NC.RefineWin.select(u); setTimeout(() => open('refine'), 0); };
  if (NC.invActs) NC.invActs.unshift((game, a, en) => {
    if (a === 'gt:grade') { // (the card's ขัดเกรด: the grade page on this item's copy, near the forge or not)
      const p = game.player, L = NC.GEAR.copies(p, en && en.id), c = (en && en.copy) || L.find((x) => Object.keys(p.equip).some((k) => NC.GEAR.wornIn(p, k) === x)) || L[0];
      NC.HUD.panel('bag', false);
      if (c && NC.Grade && NC.Grade.select) NC.Grade.select(c.u); // (js/gradetier.js: its list opens on this piece)
      setTimeout(() => open('grade'), 0);
      return true;
    }
    const r = /^cg:refine:(\d+)$/.exec(a || '');
    if (r) { openRefine(game, Number(r[1])); return true; }
    if (a === 'gt:refine' && NC.RefineWin) { // (the card's ตีบวก button: this item's copy, the one worn first)
      const p = game.player, L = NC.GEAR.copies(p, en && en.id);
      const c = (en && en.copy) || L.find((x) => Object.keys(p.equip).some((k) => NC.GEAR.wornIn(p, k) === x)) || L[0]; // (en.copy: the bag cell's own piece)
      openRefine(game, c ? c.u : 0); return true;
    }
    const m = /^cg:walk:(\w+)$/.exec(a || '');
    if (m) { NC.HUD.panel('bag', false); walkTo(game, m[1]); return true; }
    return false;
  });

  // ---------------- the HUD: the window, the menu button, Y ----------------
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    build();
    const bar = document.querySelector('.menubar'), gear = bar && bar.querySelector('[data-panel="pause"]');
    if (bar) {
      const btn = document.createElement('button');
      btn.className = 'mbtn cg-mbtn'; btn.title = 'งานฝีมือ (Y)';
      btn.innerHTML = `<img src="${IC('cg_menu')}" alt=""><b>Y</b>`;
      btn.addEventListener('click', () => { if (win.hidden) open(); else close(); });
      bar.insertBefore(btn, gear || null);
    }
    const keys = document.querySelector('#pause .keys');
    if (keys && !keys.querySelector('[data-k="Y"]')) { const li = document.createElement('li'); li.dataset.k = 'Y'; li.innerHTML = '<kbd>Y</kbd> งานฝีมือ'; keys.appendChild(li); }
  };
  const basePanel = NC.HUD.panel.bind(NC.HUD);
  NC.HUD.panel = function (id, show) {
    if (win && id === 'craftgo') {
      const on = show === undefined ? win.hidden : show;
      if (on) open(); else close();
      return on;
    }
    if (win && !win.hidden) close();
    return basePanel(id, show);
  };
  addEventListener('keydown', (e) => {
    if (!win) return;
    if (e.code === 'Escape' && !win.hidden) { e.stopImmediatePropagation(); e.preventDefault(); close(); return; }
    if (e.code !== 'KeyY' || e.repeat || !G() || !G().player) return;
    const t = document.activeElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (win.hidden) open(); else close();
  }, true);

  NC.CraftGo = { state, ok: (g) => state(g || G()).ok, open: (key) => open(key), close, isOpen: () => !!win && !win.hidden, PAGES, quiet: QUIET, stamp, walkTo: walkNpc,
    render: () => render() }; // (js/online/buildloot.js: the page drawn again once the server's answer is in)
})();
