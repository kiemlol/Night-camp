/* statuswin.js — the status window (C), the layout the user picked (2026-09-29: page 2 "B", "ทำเเบบนี้ต่อ":
   assets/gen/nightcamp_pg_status_b_raw.png), in the K look (css/kui.css + css/statuswin.css):
     top      the hero, breathing, with the name and level · a hexagon of STR AGI VIT INT DEX LUK (the base in blue,
              with gear, passives and buffs in green) · the six stats with their + buttons, the points left, reset
     bottom   every combat value on a small card with an icon · a strip that explains what is pointed at, and for a +
              what one more point would change (ATK 92 -> 95 ...)
   Same rules as the old window (hud.js renderStatus): + raises 1, Shift + click 10 (NC.raiseStat), held down it keeps going, reset asks for a
   second click. It takes over NC.HUD.panel('status') (C, the stat-points badge, ?status); the old #status stays in
   the page, unused. Card icons: assets/kui/ (assets/gen/stat_icons.prompt.txt -> tools/cutout.py, see README). */
(function () {
  'use strict';
  const NC = window.NC;
  const $ = (id) => document.getElementById(id);
  if (NC.ASSET_MANIFEST_KUI) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_KUI);
  const G = () => NC.game;
  const icon = (k) => ((NC.ASSET_MANIFEST || {})[k] || {}).src || '';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const pct = (v) => (v > 0 ? '+' : '') + Math.round(v * 100) + '%';
  const KEYS = NC.STAT_KEYS;
  const elOf = (el) => (NC.ELEMENT_INFO[el] ? el : 'neutral');
  // the cast time shown as % of the normal (the same sum as hud.js)
  const castPct = (d) => Math.round(100 * (0.8 * Math.max(0, 1 - d.dex / 150) + (d.mods && d.mods.castFixed0 ? 0 : 0.2)) * (1 - Math.min(60, (d.mods && d.mods.castRed) || 0) / 100));

  // the cards: id, icon, label, value (p, d, g), what it is
  const CARDS = [
    // (the × is d.atkMul, the gear's and the buffs' % on every hit: 2026-10-20 Discord #75, the swordmaster's honour rose
    // the damage but not this card)
    ['atk', 'st_atk', 'ATK', (p, d) => `${d.batk} + ${d.watk[0]}~${d.watk[1]}${Math.abs((d.atkMul || 1) - 1) > 0.004 ? ` <small>×${d.atkMul.toFixed(2)}</small>` : ''}`,
      'พลังโจมตีกายภาพ = พลังจากสเตตัส (STR หรือ DEX เมื่อใช้ธนู ปืน) + พลังของอาวุธ · × คือตัวคูณดาเมจจากอุปกรณ์และบัฟ (เช่น เกียรตินักดาบ)'],
    ['matk', 'st_matk', 'MATK', (p, d) => `${d.matk[0]} ~ ${d.matk[1]}`, 'พลังเวท: มาจาก INT ยิ่งสูงยิ่งแรงขึ้นแบบก้าวกระโดด'],
    ['hit', 'st_hit', 'HIT', (p, d) => `${d.hit}`, 'ความแม่น: จากเลเวลและ DEX ยิ่งสูงยิ่งตีโดนมอนที่หลบเก่ง'],
    ['crit', 'st_crit', 'CRI', (p, d) => `${d.crit}%`, 'โอกาสคริติคอล: จาก LUK และอุปกรณ์ คริติคอลตีโดนแน่นอนและแรงกว่าปกติ'],
    ['aspd', 'st_aspd', 'ASPD', (p, d) => `${d.aspd} <small>×${d.aspdMul.toFixed(2)}</small>`, 'ความเร็วโจมตี: ส่วนใหญ่มาจากของ (ออปตีเร็วบนอาวุธและเครื่องประดับ ความสามารถอาวุธ เซ็ตหนังเบา) และบัฟ AGI กับ DEX ช่วยได้ถึง ×1.5 เพดานรวม ×2.5 (× คือเร็วกว่าปกติกี่เท่า)'],
    ['cast', 'st_cast', 'เวลาร่าย', (p, d) => `${castPct(d)}%`, 'เวลาร่ายเวทเทียบกับปกติ: DEX ยิ่งสูงยิ่งร่ายเร็ว', () => !!NC.castTime],
    ['def', 'st_def', 'DEF', (p, d) => `${d.def} + ${d.vdef}`, 'ป้องกันกายภาพ: ลดดาเมจเป็น % จากอุปกรณ์ + หักดาเมจทุกครั้งจาก VIT'],
    ['mdef', 'st_mdef', 'MDEF', (p, d) => `${d.mdef} + ${d.imdef}`, 'ป้องกันเวท: ลดดาเมจเวทเป็น % จากอุปกรณ์ + จาก INT'],
    ['flee', 'st_flee', 'FLEE', (p, d) => `${d.flee} + ${d.pdodge}%`, 'การหลบ: จากเลเวลและ AGI · ตัวหลังคือโอกาสหลบแบบสมบูรณ์จาก LUK'],
    ['hp', 'st_hp', 'HP', (p) => fmt(p.maxHp), 'พลังชีวิตสูงสุด: จากเลเวล อาชีพ และ VIT'],
    ['sp', 'st_sp', 'SP', (p) => fmt(p.maxSp), 'SP สูงสุด ใช้ร่ายสกิล: จากเลเวล อาชีพ และ INT'],
    ['regen', 'st_regen', 'ฟื้นฟูต่อวินาที', (p, d) => `<small>HP</small> ${d.hpRegen.toFixed(1)} <small>SP</small> ${d.spRegen.toFixed(1)}`, 'HP และ SP ที่ฟื้นเองทุกวินาที · นั่งพัก (X) ข้างกองไฟฟื้นเร็วขึ้นอีก'],
    ['wel', (d) => 'el_' + elOf(d.atkElement), 'ธาตุอาวุธ', (p, d) => esc(NC.ELEMENT_INFO[elOf(d.atkElement)].th), 'ธาตุของการโจมตี: ตีถูกธาตุตัวเลขเป็นสีส้ม (แรงขึ้น) ตีธาตุที่ต้านทานเป็นสีเทา (เบาลง)'],
    ['ael', (d) => 'el_' + elOf(d.armorElement), 'ธาตุเกราะ', (p, d) => esc(NC.ELEMENT_INFO[elOf(d.armorElement)].th), 'ธาตุของตัวเรา (จากชุดยาว): รับดาเมจตามตารางธาตุ'],
    ['move', 'st_move', 'ความเร็วเดิน', (p, d) => pct(d.spd), 'ความเร็วเดินที่เพิ่มจากอุปกรณ์และบัฟ'],
    // (d.atkMul and d.skillMul, what the hits use: the gear's own atk / skill alone left out the refine, the weapon rows,
    // sets and buffs)
    ['patk', 'st_bonus', 'พลังโจมตี', (p, d) => pct((d.atkMul || 1) - 1), 'ATK ที่เพิ่มเป็น % รวมทุกอย่าง: ตีบวกอาวุธ ออฟ %ATK โบนัสเซ็ต สกิลติดตัวและบัฟ (คูณทุกการโจมตีกายภาพ)'],
    ['pskill', 'st_bonus', 'พลังสกิล', (p, d) => pct((d.skillMul || 1) - 1), 'ดาเมจสกิลที่เพิ่มเป็น % รวมทุกอย่าง: อุปกรณ์ ออฟ โบนัสเซ็ต สกิลติดตัวและบัฟ (คูณทุกสกิล)'],
    ['cdr', 'st_cast', NC.RO_TIME ? 'คูลดาวน์/ดีเลย์' : 'คูลดาวน์สกิล', (p, d) => (d.cdr ? '-' + Math.round(d.cdr * 100) + '%' : '0%'), NC.RO_TIME ? 'คูลดาวน์และดีเลย์หลังร่ายที่ลดลงจากอุปกรณ์ (ดีเลย์ลดได้สูงสุด 50% รวมออปลดดีเลย์)' : 'คูลดาวน์สกิลที่ลดลงจากอุปกรณ์ (สูงสุด 60%)'],
  ];
  const DEFAULT_INFO = 'ชี้ที่สเตตัสหรือค่าต่าง ๆ เพื่อดูว่าคืออะไร · คลิก <b>+</b> อัพ 1 แต้ม · <b>Shift + คลิก</b> อัพทีละ 10 · ได้แต้มสเตตัสทุกครั้งที่เลเวลอัพ';

  let win = null, heroCv = null, radarCv = null, raf = 0, resetArmed = 0, resetT = 0;

  function build(game) {
    win = document.createElement('div');
    win.id = 'statwin'; win.className = 'kw-panel'; win.hidden = true;
    win.innerHTML = '<div class="sw-wrap"><section class="kw-win sw-win">' +
      '<header class="kw-title"><span>สถานะ</span><button class="kw-x" id="sw-close" aria-label="ปิด">✕</button></header>' +
      '<div class="sw-sub" id="sw-sub"></div>' +
      '<div class="sw-top kw-inset">' +
        '<div class="sw-hero"><canvas id="sw-hero"></canvas><div class="sw-who" id="sw-who"></div></div>' +
        '<div class="sw-radar"><canvas id="sw-radar"></canvas>' +
          '<div class="sw-legend"><span><i class="b"></i>ค่าพื้นฐาน</span><span><i class="g"></i>รวมอุปกรณ์ สกิล บัฟ</span></div></div>' +
        '<div class="sw-stats"><div class="sw-rows" id="sw-rows"></div>' +
          '<div class="sw-foot"><span class="sw-pts">แต้มคงเหลือ <b id="sw-pts">0</b></span>' +
          '<button class="kw-btn grey" id="sw-reset">รีเซ็ตสเตตัส</button></div></div>' +
      '</div>' +
      '<div class="sw-cards" id="sw-cards"></div>' +
      `<div class="kw-info sw-info"><span class="i">i</span><span id="sw-info">${DEFAULT_INFO}</span></div>` +
      '</section></div>';
    document.body.appendChild(win);
    heroCv = $('sw-hero'); radarCv = $('sw-radar');
    const rows = $('sw-rows');
    for (const k of KEYS) {
      const r = document.createElement('div');
      r.className = 'sw-row'; r.dataset.k = k;
      r.innerHTML = `<span class="k">${k.toUpperCase()}</span><span class="v"></span><span class="bo"></span><span class="th">${esc(NC.STAT_INFO[k].th)}</span>` +
        `<button class="sw-plus" data-plus="${k}" aria-label="อัพ ${k.toUpperCase()}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z"/></svg></button><span class="cost"></span>`;
      rows.appendChild(r);
    }
    const cards = $('sw-cards');
    for (const C of CARDS) {
      const c = document.createElement('div');
      c.className = 'sw-card'; c.dataset.card = C[0];
      c.innerHTML = '<img alt=""><div class="t"><span class="l"></span><span class="v"></span></div>';
      c.querySelector('.l').textContent = C[2];
      cards.appendChild(c);
    }
    $('sw-close').addEventListener('click', close);
    // + raises one (Shift: 10); held down it keeps raising, faster and faster, until let go or the points run out
    // (the user, 2026-10-19: "ทำให้อัพสเตตัส กดค้างได้ด้วยนะ"); saved once when let go. Online the bridge
    // (js/online/world.js) sends the new value as one count per stat, so a hold is not a flood of actions.
    const raise = (k, n) => { const g = G(); if (!NC.raiseStat(g.player, k, n)) return false; NC.applyGear(g); render(); statInfo(k); return true; };
    let hold = null;
    const letGo = () => {
      if (!hold) return;
      clearTimeout(hold.t); hold.b.classList.remove('held');
      hold = null;
      NC.saveGame(G());
    };
    const tick = () => {
      if (!hold) return;
      if (!raise(hold.k, hold.n)) { letGo(); return; }
      hold.i++;
      hold.t = setTimeout(tick, Math.max(35, 110 - hold.i * 6)); // (110 ms at first, 35 ms after a second or so)
    };
    rows.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('[data-plus]');
      if (!b || b.disabled || e.button > 0) return;
      e.preventDefault();
      letGo();
      const k = b.dataset.plus, n = e.shiftKey ? 10 : 1;
      if (!raise(k, n)) return;
      hold = { b, k, n, i: 0, t: 0 };
      b.classList.add('held');
      hold.t = setTimeout(tick, 380); // (a plain click stays one point)
    });
    for (const ev of ['pointerup', 'pointercancel', 'blur']) addEventListener(ev, letGo);
    rows.addEventListener('pointerleave', letGo);
    rows.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-plus]')) e.preventDefault(); }); // (a long press on a phone)
    rows.addEventListener('click', (e) => { // (the keyboard: Enter / Space on a focused +; a mouse or a finger went through pointerdown)
      const b = e.target.closest('[data-plus]');
      if (!b || b.disabled || e.detail > 0) return;
      if (raise(b.dataset.plus, e.shiftKey ? 10 : 1)) NC.saveGame(G());
    });
    rows.addEventListener('mouseover', (e) => { const r = e.target.closest('[data-k]'); if (r) statInfo(r.dataset.k); });
    cards.addEventListener('mouseover', (e) => { const c = e.target.closest('[data-card]'); if (c) cardInfo(c.dataset.card); });
    for (const el of [rows, cards]) el.addEventListener('mouseleave', () => setInfo(DEFAULT_INFO));
    $('sw-reset').addEventListener('click', (e) => resetStats(e.currentTarget));
  }

  // ---------------- open / close ----------------
  function open() {
    resetArmed = 0;
    $('sw-reset').textContent = 'รีเซ็ตสเตตัส';
    setInfo(DEFAULT_INFO);
    render();
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function close() {
    NC.HUD.panel('status', false);
    const g = G();
    if (g) g.paused = false;
  }
  function fit() {
    const wrap = win.querySelector('.sw-wrap');
    wrap.style.transform = 'translate(-50%, -50%)';
    const k = Math.min(1, (innerWidth - 16) / wrap.offsetWidth, (innerHeight - 16) / wrap.offsetHeight);
    if (k < 1) wrap.style.transform = `translate(-50%, -50%) scale(${k.toFixed(4)})`;
  }
  addEventListener('resize', () => setTimeout(() => { if (win && !win.hidden) { fit(); drawRadar(); drawHero(); } }, 0)); // (after game.js sets --u)

  // ---------------- drawing the window ----------------
  function render() {
    if (!win || win.hidden) return;
    fit();
    const g = G(), p = g.player, d = p.d, gs = p.stats || {}, left = NC.statusLeft(p), J = NC.JOBS[p.job] || NC.JOBS.traveler;
    $('sw-sub').textContent = `${p.name || ''} · ${J.name} · Base Lv ${p.lv} · Job Lv ${p.jobLv}`;
    $('sw-who').innerHTML = `<b>${esc(p.name || '')}</b><span>Lv ${p.lv} · ${esc(J.name)}</span>`;
    $('sw-pts').textContent = left;
    win.querySelector('.sw-pts').classList.toggle('some', left > 0);
    for (const r of win.querySelectorAll('.sw-row')) {
      const k = r.dataset.k, v = p.base[k], bonus = d && Number.isFinite(d[k]) ? d[k] - v : gs[k] || 0, cost = NC.statCost(v), max = v >= NC.STAT_MAX;
      r.querySelector('.v').textContent = v;
      const bo = r.querySelector('.bo');
      bo.textContent = bonus ? (bonus > 0 ? '+' : '') + bonus : '';
      bo.classList.toggle('neg', bonus < 0);
      const b = r.querySelector('.sw-plus');
      b.disabled = max || cost > left;
      b.title = max ? 'สูงสุดแล้ว (99)' : `อัพ ${k.toUpperCase()} ใช้ ${cost} แต้ม (กดค้าง = อัพต่อเนื่อง · Shift + คลิก = 10)`;
      r.querySelector('.cost').textContent = max ? 'สูงสุด' : `ใช้ ${cost}`;
    }
    for (const c of win.querySelectorAll('.sw-card')) {
      const C = CARDS.find((x) => x[0] === c.dataset.card);
      const on = !C[5] || C[5]();
      c.hidden = !on;
      if (!on) continue;
      const img = c.querySelector('img'), src = icon(typeof C[1] === 'function' ? C[1](d) : C[1]);
      if (img.getAttribute('src') !== src) img.src = src;
      c.querySelector('.v').innerHTML = C[3](p, d, gs);
    }
    drawRadar();
    drawHero();
  }

  function setInfo(html) { const el = $('sw-info'); if (el) el.innerHTML = html; }
  // what one more point in k would change (NC.derive restores what it touches: a safe look ahead)
  function preview(p, k) {
    if (p.base[k] >= NC.STAT_MAX) return '';
    const was = p.base[k];
    let d2 = null;
    p.base[k] = was + 1;
    try { d2 = NC.derive(p); } catch (e) { d2 = null; } finally { p.base[k] = was; }
    const d = p.d;
    if (!d2 || !d) return '';
    const out = [];
    const add = (name, a, b, f) => { if (a !== b) out.push(`${name} ${f ? f(a) : a} → <span class="up">${f ? f(b) : b}</span>`); };
    add('ATK', d.batk, d2.batk); add('MATK', d.matk[1], d2.matk[1]); add('HIT', d.hit, d2.hit); add('FLEE', d.flee, d2.flee);
    add('CRI', d.crit, d2.crit, (v) => v + '%'); add('ASPD', d.aspd, d2.aspd); add('HP', d.maxHp, d2.maxHp, fmt); add('SP', d.maxSp, d2.maxSp, fmt);
    add('DEF', d.vdef, d2.vdef); add('MDEF', d.imdef, d2.imdef);
    return out.slice(0, 4).join(' · ');
  }
  function statInfo(k) {
    const p = G().player, v = p.base[k], I = NC.STAT_INFO[k], left = NC.statusLeft(p), cost = NC.statCost(v);
    let t = `<b>${k.toUpperCase()}</b> ${esc(I.th)} — ${esc(I.desc)}`;
    if (v >= NC.STAT_MAX) t += ' · สูงสุดแล้ว (99)';
    else {
      t += ` · อัพ ${v} → ${v + 1} ใช้ <b>${cost}</b> แต้ม`;
      if (cost > left) t += ` (มี ${left})`;
      const pv = preview(p, k);
      if (pv) t += ` · ${pv}`;
    }
    setInfo(t);
  }
  function cardInfo(id) {
    const C = CARDS.find((x) => x[0] === id);
    if (C) setInfo(`<b>${esc(C[2])}</b> — ${esc(C[4])}`);
  }
  function resetStats(btn) {
    const g = G();
    if (performance.now() - resetArmed > 3000) { // a second click within 3 s confirms
      resetArmed = performance.now();
      btn.textContent = 'กดอีกครั้งเพื่อยืนยัน';
      clearTimeout(resetT);
      resetT = setTimeout(() => { resetArmed = 0; btn.textContent = 'รีเซ็ตสเตตัส'; }, 3000);
      return;
    }
    resetArmed = 0; clearTimeout(resetT); btn.textContent = 'รีเซ็ตสเตตัส';
    NC.resetStats(g.player); NC.applyGear(g); NC.saveGame(g);
    NC.HUD.log('รีเซ็ตสเตตัสแล้ว ได้แต้มคืนทั้งหมด', 'sys');
    render();
    setInfo('รีเซ็ตแล้ว ได้แต้มคืนทั้งหมด · ลงแต้มใหม่ได้เลย');
  }

  // ---------------- the hexagon: STR at the top, then clockwise AGI VIT INT DEX LUK ----------------
  function sized(cv) {
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    return [W, H];
  }
  // (Discord #116, 2026-10-20: the hexagon was blank until the window was closed and opened again. It was drawn once, on
  // open: opened on the ค่าละเอียด tab (js/statdetail.js hides .sw-top) the canvas had no size, became 1x1, and going back
  // to the สเตตัส tab never drew it again. Now a canvas with no size waits, and the frame loop draws it once it shows or
  // its size changes; a web font that comes in late draws it again too)
  let radarDirty = true;
  const radarStale = () => {
    const r = radarCv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    return r.width >= 4 && r.height >= 4 && (radarDirty || Math.abs(radarCv.width - Math.round(r.width * dpr)) > 1 || Math.abs(radarCv.height - Math.round(r.height * dpr)) > 1);
  };
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => { radarDirty = true; });
  function drawRadar() {
    if (!radarCv || win.hidden) return;
    const box = radarCv.getBoundingClientRect();
    if (box.width < 4 || box.height < 4) { radarDirty = true; return; } // (hidden or not laid out yet: the loop draws it)
    radarDirty = false;
    const [W, H] = sized(radarCv), c = radarCv.getContext('2d'), p = G().player, d = p.d || {};
    const u = W / 330; // (the canvas is 330 --u wide)
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H * 0.52, R = Math.min(W, H) * 0.33;
    const tot = (k) => (Number.isFinite(d[k]) ? d[k] : p.base[k]);
    // scaled to the hero's own best stat (at 99 a young hero's shape would be a dot in the middle)
    const max = Math.max(30, Math.ceil((Math.max(...KEYS.map(tot)) * 1.15) / 10) * 10);
    const at = (i, f) => { const a = -Math.PI / 2 + (i * Math.PI) / 3; return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f]; };
    const ring = (f) => { c.beginPath(); for (let i = 0; i < 6; i++) { const [x, y] = at(i, f); if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.closePath(); };
    // the web
    c.lineJoin = 'round';
    for (const f of [0.25, 0.5, 0.75]) { ring(f); c.strokeStyle = 'rgba(42,36,53,0.18)'; c.lineWidth = 1.5 * u; c.stroke(); }
    ring(1); c.fillStyle = 'rgba(255,255,255,0.55)'; c.fill(); c.strokeStyle = '#2a2435'; c.lineWidth = 3 * u; c.stroke();
    for (let i = 0; i < 6; i++) { const [x, y] = at(i, 1); c.beginPath(); c.moveTo(cx, cy); c.lineTo(x, y); c.strokeStyle = 'rgba(42,36,53,0.18)'; c.lineWidth = 1.5 * u; c.stroke(); }
    // the shapes: with everything (green), then the base (blue) over it
    const shape = (val) => { c.beginPath(); KEYS.forEach((k, i) => { const [x, y] = at(i, Math.max(0.04, Math.min(1, val(k) / max))); if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.closePath(); };
    shape(tot); c.fillStyle = 'rgba(143,224,138,0.55)'; c.fill(); c.strokeStyle = '#4fb24a'; c.lineWidth = 2.5 * u; c.stroke();
    shape((k) => p.base[k]); c.fillStyle = 'rgba(111,166,255,0.62)'; c.fill(); c.strokeStyle = '#3f7fd6'; c.lineWidth = 2.5 * u; c.stroke();
    const dot = (x, y, col) => { c.beginPath(); c.arc(x, y, 4.2 * u, 0, Math.PI * 2); c.fillStyle = col; c.fill(); c.lineWidth = 2 * u; c.strokeStyle = '#2a2435'; c.stroke(); };
    KEYS.forEach((k, i) => { const [x, y] = at(i, Math.max(0.04, Math.min(1, tot(k) / max))); dot(x, y, '#8fe08a'); });
    KEYS.forEach((k, i) => { const [x, y] = at(i, Math.max(0.04, Math.min(1, p.base[k] / max))); dot(x, y, '#6fa6ff'); });
    // the names, and the totals under them
    c.textAlign = 'center'; c.textBaseline = 'middle';
    KEYS.forEach((k, i) => {
      const [x, y] = at(i, 1.3);
      c.font = `800 ${Math.round(21 * u)}px 'Baloo 2', sans-serif`; c.fillStyle = '#2a2435'; c.fillText(k.toUpperCase(), x, y - 8 * u);
      c.font = `700 ${Math.round(16 * u)}px 'Baloo 2', sans-serif`; c.fillStyle = tot(k) > p.base[k] ? '#2f8a36' : '#3f7fd6'; c.fillText(String(tot(k)), x, y + 11 * u);
    });
  }

  // ---------------- the hero, breathing ----------------
  function drawHero() {
    if (!heroCv || win.hidden) return;
    const g = G(), p = g && g.player;
    if (!p) return;
    const [W, H] = sized(heroCv), c = heroCv.getContext('2d'), k = H / 275, fx = W * 0.57, fy = H * 0.8; // (a little right: a big weapon rests behind)
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(42,36,53,0.16)';
    c.beginPath(); c.ellipse(fx, fy, 56 * k, 14 * k, 0, 0, Math.PI * 2); c.fill();
    const eq = NC.lookEquip ? NC.lookEquip(p.equip) : p.equip;
    NC.drawAvatar(c, eq, fx, fy, k, 1, { t: performance.now() / 1000, idle: NC.Anim.movesFor(p.moves, NC.ITEMS[p.equip.weapon]).idle });
  }
  function loop() {
    raf = 0;
    if (!win || win.hidden) return;
    drawHero();
    if (radarCv && radarStale()) drawRadar();
    raf = requestAnimationFrame(loop);
  }

  // ---------------- hooks: C, the stat-points badge, ?status open this window ----------------
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) { baseInit(game); build(game); };
  const basePanel = NC.HUD.panel.bind(NC.HUD);
  NC.HUD.panel = function (id, show) {
    if (win && id === 'status') {
      const on = show === undefined ? win.hidden : show;
      basePanel('pause', false); // closes every other window
      win.hidden = !on;
      if (on) open();
      return on;
    }
    if (win) win.hidden = true;
    return basePanel(id, show);
  };
  // Esc closes it (instead of opening the menu over it)
  addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' || !win || win.hidden) return;
    e.stopImmediatePropagation(); e.preventDefault();
    close();
  }, true);
})();
