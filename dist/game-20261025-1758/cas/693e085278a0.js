/* eltable.js — ตารางธาตุ: a window that teaches the element system (the user, 2026-10-20: "ทำระบบ ตารางธาตุ ให้ด้วย
   ให้ผู้เล่นได้รู้เรื่องระบบธาตุ"; picked mockup A, assets/gen/nightcamp_el_a_raw.png, from make_eltable_prompts.py).
     the table  stats.js NC.ELEMENT_TABLE as multipliers: attack element down the left, the target's element across the
                top (green = stronger, red = weaker, a dark cell = no effect). The hero's weapon element carries a small
                sword on its row, the armor element a shield on its column. Hover a cell: its row and column light up
                and its title says the matchup in words.
     pick       a row (its icon or a cell) = that element ATTACKING: the dark card says what it hits hard / weakly;
                a column (its icon) = that element BEING HIT: what hits it hard / what it resists.
     the card   the big icon, the element's line + where to get it (weapons, jobs' skills, oils, the boss robes),
                monsters of that element (this map's first, NC.SPECIES), the two lists with their multipliers
     the tips   how to read it, what the numbers mean (with the damage numbers' orange / grey), how to use it
   Opens from: a menu tray button, the element icon on the target frame (that monster's element as the column, the
   hero's weapon row crossing it), the ธาตุอาวุธ / ธาตุเกราะ cards of the status window (C), ?eltable. Every letter
   key is taken, so there is no key of its own. Client-side only (reads tables), so it works online too.
   Hooks: NC.HUD.init (the window, the tray button), NC.HUD.panel ('eltable'). API NC.ElTable.open({ row | col | cell }). */
(function () {
  'use strict';
  const NC = window.NC;
  if (!NC || !NC.ELEMENTS || !NC.ELEMENT_TABLE) return;
  const $ = (id) => document.getElementById(id);
  const G = () => NC.game;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  if (NC.ASSET_MANIFEST_KUI) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_KUI);
  const icon = (k) => ((NC.ASSET_MANIFEST || {})[k] || {}).src || `assets/${k}.png`;
  const elIcon = (el) => icon('el_' + el);
  const spr = (k) => { const S = NC.SPR && NC.SPR[k]; return (S && S.img && S.img.src) || ((NC.ASSET_MANIFEST || {})[k] || {}).src || ''; };
  const E = NC.ELEMENTS, T = NC.ELEMENT_TABLE, INFO = NC.ELEMENT_INFO;
  const th = (el) => (INFO[el] ? INFO[el].th : el);
  const raw = (a, d) => T[E.indexOf(a)][E.indexOf(d)];
  const mul = (a, d) => Math.max(0, raw(a, d)) / 100; // (a negative cell does nothing here: stats.js elementMod)
  const fmt = (m) => (m <= 0 ? '0' : m === 1 ? '1.0' : String(+m.toFixed(2)));
  const tone = (m) => (m <= 0 ? 'none' : m >= 1.5 ? 'up2' : m > 1 ? 'up' : m < 1 ? 'down' : '');
  const say = (m) => (m <= 0 ? 'ไม่เข้าเลย' : m > 1 ? `แรงขึ้น ${Math.round(m * 100 - 100)}%` : m < 1 ? `เบาลง ${Math.round(100 - m * 100)}%` : 'ดาเมจปกติ');

  // each element's own line (the world is dark: no cosy words)
  const LINE = {
    neutral: 'พลังดิบไม่มีธาตุ ตีทุกอย่างได้เท่ากัน ยกเว้นวิญญาณที่แทบไม่เข้า',
    water: 'สายน้ำเย็นเฉียบจากบึงลึก ดับไฟได้ดีที่สุด',
    earth: 'หินและรากไม้ที่หนักแน่น ทุบลมให้ร่วงลงพื้น',
    fire: 'เปลวไฟที่เผาทุกสิ่ง ทั้งดินและซากศพที่ไม่ยอมตาย',
    wind: 'ลมคมกริบ พัดน้ำแตกกระจาย แรงที่สุดในตาราง',
    poison: 'พิษที่ซึมลึกกัดกินของที่ยังมีชีวิต แต่ซากศพไม่รู้สึกอะไร',
    holy: 'แสงที่ชำระซากศพและความมืด แต่แสงด้วยกันไม่ระคาย',
    shadow: 'เวทยามค่ำคืนที่กลืนแสง แต่ทำอะไรซากศพไม่ได้',
    ghost: 'พลังวิญญาณ ตีวิญญาณด้วยกันแรง และไม่สะทกสะท้านกับของไม่มีธาตุ',
    undead: 'พลังของซากที่ไม่ยอมตาย ต้านพิษ และความมืดทำอะไรไม่ได้',
  };

  // ---------------- where an element comes from (counted once, from the game's own tables) ----------------
  let SRC = null;
  function sources() {
    if (SRC) return SRC;
    SRC = {};
    for (const el of E) SRC[el] = { weapons: 0, jobs: [], oil: false, robes: [] };
    for (const it of Object.values(NC.ITEMS || {})) {
      if (!it || !it.element || !SRC[it.element]) continue;
      if (it.slot === 'weapon') SRC[it.element].weapons++;
      else if (it.slot === 'robe') SRC[it.element].robes.push(it.name);
    }
    for (const J of Object.values(NC.JOBS || {})) {
      const seen = new Set();
      for (const s of J.skills || []) { const S = NC.SKILLS && NC.SKILLS[s]; if (S && S.element && SRC[S.element] && !seen.has(S.element)) { seen.add(S.element); SRC[S.element].jobs.push(J.name); } }
    }
    const MAT = NC.MATERIALS || {};
    for (const el of E) SRC[el].oil = !!MAT['bl_oil_' + el];
    return SRC;
  }
  function getText(el) {
    const S = sources()[el], bits = [];
    if (el === 'neutral') bits.push('อาวุธทั่วไปที่ไม่มีธาตุ');
    else if (S.weapons) bits.push(`อาวุธ ${S.weapons.toLocaleString('en-US')} ชิ้น`);
    if (S.jobs.length) bits.push(S.jobs.length > 2 ? `สกิล ${S.jobs.length} อาชีพ` : 'สกิล' + S.jobs.join(' '));
    if (S.oil && el !== 'neutral') bits.push('น้ำมันเคลือบ');
    return bits.length ? 'ได้จาก: ' + bits.join(' · ') : 'ยังไม่มีอาวุธหรือสกิลธาตุนี้';
  }

  // ---------------- monsters of an element: this map's first, then the world's ----------------
  const isBoss = (S) => !!(S && (S.boss || S.isBoss || S.worldBoss || S.mapBoss));
  function monstersOf(el) {
    const all = [], seen = new Set(), g = G();
    const add = (k) => { const S = NC.SPECIES && NC.SPECIES[k]; if (!S || seen.has(k) || (S.element || 'neutral') !== el || isBoss(S)) return; seen.add(k); all.push(k); };
    for (const e of (g && g.enemies) || []) if (e && e.type) add(e.type);
    const here = all.length;
    for (const k of Object.keys(NC.SPECIES || {})) add(k);
    const shown = all.filter((k) => spr(k)).slice(0, 2);
    return { shown, total: all.length, here };
  }

  // ---------------- the window ----------------
  let win = null, mode = 'row', pick = 'neutral', cell = null; // mode 'row' (attacking) | 'col' (being hit); cell [a, d]
  function build() {
    if (win) return;
    win = document.createElement('div');
    win.id = 'eltable'; win.className = 'kw-panel'; win.hidden = true;
    const head = E.map((d) => `<button class="et-h et-ch" data-col="${d}" title="ธาตุ${esc(th(d))} ถูกตี: คลิกดูว่าอะไรตีแรง"><img src="${elIcon(d)}" alt="${esc(th(d))}"><img class="et-me arm" src="${icon('st_def')}" alt="" hidden></button>`).join('');
    const rows = E.map((a) => `<button class="et-h et-rh" data-row="${a}" title="ธาตุ${esc(th(a))} ตี: คลิกดูว่าตีอะไรแรง"><img src="${elIcon(a)}" alt="${esc(th(a))}"><img class="et-me wpn" src="${icon('st_atk')}" alt="" hidden></button>` +
      E.map((d) => { const m = mul(a, d); return `<span class="et-c ${tone(m)}" data-a="${a}" data-d="${d}" title="${esc(`${th(a)} ตี ${th(d)} ×${fmt(m)} · ${say(m)}`)}">${fmt(m)}</span>`; }).join('')).join('');
    win.innerHTML =
      `<div class="et-wrap"><div class="kw-win et-win">` +
        `<div class="kw-title">ตารางธาตุ<button class="kw-x" type="button" data-etx aria-label="ปิด">✕</button></div>` +
        `<div class="et-body">` +
          `<div class="et-table" id="et-table"><span class="et-corner"><small class="t">เป้า →</small><small class="b">ตี ↓</small></span>${head}${rows}<i class="et-sel" id="et-sel" hidden></i><i class="et-pin" id="et-pin" hidden></i></div>` +
          `<div class="kw-card et-card" id="et-card"></div>` +
          `<div class="et-tips">` +
            `<div class="et-tip"><b class="n">1</b><div><h4>อ่านตาราง</h4><p>ธาตุทางซ้ายคือธาตุที่ตี ธาตุด้านบนคือธาตุของเป้า ตัวเลขคือดาเมจที่คูณเข้าไป คลิกแถวหรือหัวคอลัมน์เพื่อดูรายละเอียด</p></div></div>` +
            `<div class="et-tip"><b class="n">2</b><div><h4>ตัวคูณดาเมจ</h4><ul>` +
              `<li><b class="up2">1.5</b>แรงขึ้น 50% · เลขดาเมจสีส้ม</li><li><b>1.0</b>ดาเมจปกติ</li>` +
              `<li><b class="down">0.5</b>เบาลงครึ่ง · เลขดาเมจสีเทา</li><li><b class="none">0</b>ไม่เข้าเลย</li></ul></div></div>` +
            `<div class="et-tip"><b class="n">3</b><div><h4>ใช้ให้ได้เปรียบ</h4><p>ดูธาตุมอนที่ป้ายชื่อหรือกรอบเป้าหมาย (คลิกไอคอนธาตุที่กรอบได้) แล้วเปลี่ยนอาวุธ ทาน้ำมันธาตุ หรือใช้สกิลธาตุที่ชนะ</p></div></div>` +
          `</div>` +
        `</div>` +
      `</div></div>`;
    document.body.appendChild(win);

    win.addEventListener('click', (e) => {
      if (e.target === win || e.target.closest('[data-etx]')) { close(); return; }
      const c = e.target.closest('.et-c'), r = e.target.closest('[data-row]'), k = e.target.closest('[data-col]');
      if (c) { mode = 'row'; pick = c.dataset.a; cell = [c.dataset.a, c.dataset.d]; }
      else if (r) { mode = 'row'; pick = r.dataset.row; cell = null; }
      else if (k) { mode = 'col'; pick = k.dataset.col; cell = null; }
      else return;
      render();
    });
    const tbl = win.querySelector('#et-table');
    tbl.addEventListener('mouseover', (e) => {
      const c = e.target.closest('.et-c, [data-row], [data-col]');
      const a = c ? c.dataset.a || c.dataset.row || null : null, d = c ? c.dataset.d || c.dataset.col || null : null;
      for (const x of tbl.querySelectorAll('.et-c')) x.classList.toggle('hv', (a && x.dataset.a === a) || (d && x.dataset.d === d));
    });
    tbl.addEventListener('mouseleave', () => { for (const x of tbl.querySelectorAll('.et-c.hv')) x.classList.remove('hv'); });
  }

  // a gold outline over one row, one column or one cell (grid lines: the corner is column / row 1)
  function place(box, r0, r1, c0, c1) {
    box.hidden = false;
    box.style.gridRow = `${r0} / ${r1}`; box.style.gridColumn = `${c0} / ${c1}`;
  }
  function render() {
    if (!win || win.hidden) return;
    fit();
    const g = G(), d = g && g.player && g.player.d, wpn = (d && d.atkElement) || 'neutral', arm = (d && d.armorElement) || 'neutral';
    const tbl = $('et-table'), i = E.indexOf(pick);
    for (const b of tbl.querySelectorAll('[data-row]')) { b.classList.toggle('sel', mode === 'row' && b.dataset.row === pick); b.querySelector('.et-me').hidden = b.dataset.row !== wpn; }
    for (const b of tbl.querySelectorAll('[data-col]')) { b.classList.toggle('sel', mode === 'col' && b.dataset.col === pick); b.querySelector('.et-me').hidden = b.dataset.col !== arm; }
    for (const c of tbl.querySelectorAll('.et-c')) c.classList.toggle('sel', mode === 'row' ? c.dataset.a === pick : c.dataset.d === pick);
    if (mode === 'row') place($('et-sel'), i + 2, i + 3, 1, -1); else place($('et-sel'), 1, -1, i + 2, i + 3);
    if (cell) place($('et-pin'), E.indexOf(cell[0]) + 2, E.indexOf(cell[0]) + 3, E.indexOf(cell[1]) + 2, E.indexOf(cell[1]) + 3); else $('et-pin').hidden = true;
    for (const b of tbl.querySelectorAll('[data-row] .et-me')) b.title = 'ธาตุอาวุธของเราตอนนี้';
    for (const b of tbl.querySelectorAll('[data-col] .et-me')) b.title = 'ธาตุเกราะของเราตอนนี้';
    card(wpn, arm);
  }

  function chips(list) {
    if (!list.length) return '<em class="et-nil">ไม่มี</em>';
    return list.map(([el, m]) => `<span class="et-chip"><img src="${elIcon(el)}" alt="">${esc(th(el))}<b class="${tone(m)}">×${fmt(m)}</b></span>`).join('');
  }
  function card(wpn, arm) {
    const el = pick, atk = mode === 'row';
    const line = E.map((o) => [o, atk ? mul(el, o) : mul(o, el)]);
    const hi = line.filter(([, m]) => m > 1).sort((a, b) => b[1] - a[1]);
    const lo = line.filter(([, m]) => m < 1).sort((a, b) => a[1] - b[1]);
    const mons = monstersOf(el), S = sources()[el];
    let sub;
    if (atk) sub = getText(el);
    else sub = `มอนธาตุ${th(el)} ${mons.total} ชนิด` + (S.robes.length ? ` · ใส่${S.robes[0]}แล้วตัวเราเป็นธาตุนี้` : '');
    let note = '';
    if (cell) { const m = mul(cell[0], cell[1]); note = `<p class="et-note ${tone(m)}">${esc(th(cell[0]))} ตี ${esc(th(cell[1]))} ×${fmt(m)} · ${esc(say(m))}</p>`; }
    else if (atk && el === wpn) note = '<p class="et-note me">ธาตุอาวุธของเราตอนนี้</p>';
    else if (!atk && el === arm) note = '<p class="et-note me">ธาตุเกราะของเราตอนนี้</p>';
    const monHtml = mons.shown.length
      ? mons.shown.map((k) => `<figure><span><img src="${spr(k)}" alt=""></span><figcaption>${esc(NC.SPECIES[k].name || k)}</figcaption></figure>`).join('') +
        (mons.total > mons.shown.length ? `<em class="et-more">+${(mons.total - mons.shown.length).toLocaleString('en-US')} ชนิด</em>` : '')
      : '<em class="et-nil">ยังไม่มีมอนธาตุนี้</em>';
    $('et-card').innerHTML =
      `<div class="et-head"><img class="et-big" src="${elIcon(el)}" alt=""><div><h3>${esc(th(el))}<small>${atk ? 'เมื่อเป็นธาตุที่ตี' : 'เมื่อเป็นธาตุของเป้า'}</small></h3>` +
        `<p>${esc(LINE[el] || '')}</p></div></div><p class="src" title="${esc(atk && S.jobs.length ? 'สกิลธาตุนี้: ' + S.jobs.join(' · ') : '')}">${esc(sub)}</p>${note}` +
      `<hr><h5>มอนธาตุ${esc(th(el))}${mons.here ? ' <small>(มีในแมพนี้)</small>' : ''}</h5><div class="et-mons">${monHtml}</div><hr>` +
      `<div class="et-box up"><h6><i>▲</i>${atk ? 'ตีแรงใส่' : 'โดนแรงจาก'}</h6><div>${chips(hi)}</div></div>` +
      `<div class="et-box down"><h6><i>▼</i>${atk ? 'ตีเบาใส่' : 'ต้านทาน'}</h6><div>${chips(lo)}</div></div>`;
  }

  function fit() {
    const wrap = win.querySelector('.et-wrap');
    if (document.documentElement.classList.contains('mob-port')) { wrap.style.transform = ''; return; }
    wrap.style.transform = 'translate(-50%, -50%)';
    const k = Math.min(1, (innerWidth - 16) / wrap.offsetWidth, (innerHeight - 16) / wrap.offsetHeight);
    if (k < 1) wrap.style.transform = `translate(-50%, -50%) scale(${k.toFixed(4)})`;
  }
  addEventListener('resize', () => setTimeout(() => { if (win && !win.hidden) fit(); }, 0)); // (after game.js sets --u)

  // ---------------- open / close ----------------
  function open(o) {
    o = o || {};
    build();
    const g = G(), d = g && g.player && g.player.d, wpn = (d && d.atkElement) || 'neutral';
    if (o.col && E.includes(o.col)) { mode = 'col'; pick = o.col; cell = E.includes(wpn) ? [wpn, o.col] : null; }
    else if (o.row && E.includes(o.row)) { mode = 'row'; pick = o.row; cell = null; }
    else { mode = 'row'; pick = E.includes(wpn) ? wpn : 'neutral'; cell = null; }
    NC.HUD.panel('eltable', true);
  }
  function close() {
    NC.HUD.panel('eltable', false);
    const g = G();
    if (g) g.paused = false;
  }

  // ---------------- hooks ----------------
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    build();
    const bar = document.querySelector('.menubar'), gear = bar && bar.querySelector('[data-panel="pause"]');
    if (bar && !bar.querySelector('.et-mbtn')) {
      const btn = document.createElement('button');
      btn.className = 'mbtn et-mbtn'; btn.type = 'button'; btn.title = 'ตารางธาตุ: ธาตุไหนตีอะไรแรง';
      btn.innerHTML = `<img src="${icon('ic_eltable')}" alt=""><b>ธาตุ</b>`;
      btn.addEventListener('click', () => { if (win.hidden) open(); else close(); });
      bar.insertBefore(btn, gear || null);
    }
    const keys = document.querySelector('#pause .keys');
    if (keys && !keys.querySelector('[data-k="eltable"]')) {
      const li = document.createElement('li'); li.dataset.k = 'eltable';
      li.innerHTML = 'ตารางธาตุ: ปุ่ม "ธาตุ" ในแถบเมนู หรือคลิกไอคอนธาตุที่กรอบเป้าหมาย';
      keys.appendChild(li);
    }
    // the target frame's element icon and its "weapon x%" open the table on that monster's element
    for (const id of ['tel', 'teff']) {
      const el = $(id);
      if (!el || el.dataset.et) continue;
      el.dataset.et = '1'; el.classList.add('et-link');
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const t = game.hover || game.target;
        open({ col: (t && t.element) || 'neutral' });
      });
    }
  };
  const basePanel = NC.HUD.panel.bind(NC.HUD);
  NC.HUD.panel = function (id, show) {
    if (win && id === 'eltable') {
      const on = show === undefined ? win.hidden : show;
      basePanel('pause', false); // closes every other window
      win.hidden = !on;
      if (on) { const g = G(); if (g) g.paused = true; render(); }
      return on;
    }
    if (win && !win.hidden) win.hidden = true;
    return basePanel(id, show);
  };
  // the status window's element cards (C) open it too: the weapon's row / the armor's column
  addEventListener('click', (e) => {
    const c = e.target.closest && e.target.closest('#statwin [data-card="wel"], #statwin [data-card="ael"]');
    if (!c) return;
    const g = G(), d = g && g.player && g.player.d;
    if (!d) return;
    if (c.dataset.card === 'wel') open({ row: d.atkElement || 'neutral' }); else open({ col: d.armorElement || 'neutral' });
  });
  addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' || !win || win.hidden) return;
    e.stopImmediatePropagation(); e.preventDefault();
    close();
  }, true);

  NC.ElTable = { open, close, isOpen: () => !!win && !win.hidden, mul, sources, monstersOf };
})();
