/* resultfx.js — the result popup of the smith's work and the crafting stations (the user, 2026-10-17: "เวลาตีบวกหรือ
   ทำของหรือยังไงก็ตามอยากให้มีป็อปอัพอลังการแบบเหมือนเกมอื่นๆ").
   Two looks (ESC → ตั้งค่า: เล็ก / ใหญ่ / ปิด):
     เล็ก (default, mockup A, after C was "ดูเยอะไปหน่อย ... ให้มันกดง่ายๆ มันมือหน่อย"): a stamp on the item's own picture of
          the page (or above the pressed button), the weapon redrawn sharp, a painted ribbon with the word, the number; no dim,
          clicks and keys pass straight through, about a second
     ใหญ่ (look C, ?resultfx=big): a painted band across the screen over the crafting window (js/craftgo.js); a click or a key
          skips it. Neither freezes the game (the crafting window already pauses it; the popup only sits on top).
     big     ตีบวก (js/refine.js through js/refinewin.js) · ตีอาวุธ (NC.Forge.craft, js/forgemake.js) · เจาะออฟ / หินออฟ
             (js/forge.js's opt page) · ขัดเกรด (js/gradetier.js's grade page)
     small   ทำอาหาร (NC.Cook.cook) · ต้มยา (NC.Brew.brew) · รวมรูน (js/bl_runes.js) · ธาตุ · น้ำมัน · กระสุน (js/bl_core.js)
   States: ok (สำเร็จ) · great (สุดยอด: a risky step won, a เทพ row, a high grade, a bonus) · plain (done, a plain roll)
   · fail (ไม่สำเร็จ) · drop (ไม่สำเร็จ + one step down) · saved (a safety stone / grade seal took the blow) · broke (แตก)
   No edits to those files: this file wraps what they expose (NC.RefineWin.click, NC.Forge.craft / click, the
   NC.FORGE_TABS entries' click, NC.Cook.cook, NC.Brew.brew) and compares the hero's bag before and after.
   ESC → ตั้งค่า "ป็อปอัพผลตีบวก / ทำของ" turns it off (localStorage nightcamp.resultfx.v1).
   Test: ?resultfx=demo plays every state in turn (keys 1-7 replay one); NC.ResultFX.demo('refine', 'great'). */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, MAT = NC.MATERIALS;
  const SAVE = 'nightcamp.resultfx.v1';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const G = () => NC.game;
  // the look: 'mini' (the user's pick 2026-10-17, mockup A: a stamp on the item, out of the way) · 'big' (look C, the
  // band across the screen: "ดูเยอะไปหน่อย") · 'off'
  let mode = 'mini';
  try { const m = localStorage.getItem(SAVE); mode = m === 'off' ? 'off' : m === 'big' ? 'big' : 'mini'; } catch (e) { /* storage blocked */ }
  let on = mode !== 'off';

  // ---------------- pictures ----------------
  const iconCache = new Map();
  const itemIcon = (id) => { if (!iconCache.has(id)) { try { iconCache.set(id, NC.itemIcon(id, 256).toDataURL()); } catch (e) { iconCache.set(id, ''); } } return iconCache.get(id); };
  const matIcon = (id) => { try { return NC.matIcon(id) || ''; } catch (e) { return ''; } };
  const matName = (id) => (MAT[id] && MAT[id].name) || id;
  const gradeOf = (c) => (NC.Grade && c ? NC.Grade.of(c) : -1);
  const gradeInfo = (c) => { const g = gradeOf(c); return g >= 0 && NC.Grade ? NC.Grade.GRADES[g] : null; };
  const rarityCol = (id) => ((NC.RARITY || {})[(ITEMS[id] || {}).rarity] || {}).color || '#cfc6b8';
  const TIER = () => (NC.WBAG && NC.WBAG.TIER) || [{ th: 'ธรรมดา', color: '#e8e2d4' }, { th: 'ดี', color: '#6fb6ff' }, { th: 'เทพ', color: '#ffc94d' }];

  // ---------------- the popup ----------------
  const TIME = { ok: 1.9, great: 2.8, plain: 1.6, fail: 1.7, drop: 1.9, saved: 1.9, broke: 2.6 }; // seconds before it closes itself
  const SMALL_K = 0.7;
  let el = null, timer = 0, queue = [], shownAt = 0;
  function build() {
    el = document.createElement('div');
    el.id = 'rfx'; el.hidden = true;
    document.body.appendChild(el);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); skip(); });
    el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
    // any key skips it (and does nothing else: the crafting window must not close under it)
    addEventListener('keydown', (e) => {
      if (!el || el.hidden) return;
      e.preventDefault(); e.stopImmediatePropagation(); skip();
    }, true);
  }
  function skip() {
    if (!el || el.hidden) return;
    if (performance.now() - shownAt < 120) return; // (the click that started the try is not a skip)
    close();
  }
  function close() {
    clearTimeout(timer);
    el.classList.add('out'); // (keeps 'in': the pieces stay where their animations put them while the band folds shut)
    const was = el.dataset.n;
    setTimeout(() => { if (el.dataset.n === was) { el.hidden = true; el.className = ''; el.innerHTML = ''; next(); } }, 200);
  }
  function next() {
    const r = queue.shift();
    if (r) paint(r);
  }
  let seq = 0;
  function show(r) {
    if (!on || !r) return;
    if (mode === 'mini') { mini(r); return; }
    if (!el) build();
    preload();
    if (!el.hidden) { queue = [r]; close(); return; } // (a new try while one shows: the old one goes, the new one plays)
    paint(r);
  }
  function paint(r) {
    seq++;
    el.dataset.n = String(seq);
    el.className = `rfx-${r.size || 'big'} s-${r.state} k-${r.kind}`;
    el.style.setProperty('--gc', r.color || '#ffd873');
    el.innerHTML = html(r);
    el.hidden = false;
    void el.offsetWidth;
    el.classList.add('in');
    shownAt = performance.now();
    clearTimeout(timer);
    const t = (TIME[r.state] || 1.8) * (r.size === 'small' ? SMALL_K : 1);
    if (!NC.ResultFX.hold) timer = setTimeout(close, t * 1000); // (hold: tests keep it up for a picture)
  }
  // ---------------- look C (the user's pick, assets/gen/nightcamp_resultfx_c_raw.png): a painted band across the
  // screen, the item in a painted medallion at 25 %, the words in the middle; the pieces fly by css/resultfx.css ----------------
  const ART = (n) => `assets/resultfx/${n}.png`;
  const LOOK = { // state -> band, medallion, the light behind the medallion
    ok: ['ok', 'ok', 'light_burst'], plain: ['ok', 'ok', ''], great: ['great', 'great', 'light_flare'],
    fail: ['fail', 'fail', ''], drop: ['fail', 'fail', ''], saved: ['fail', 'fail', ''], broke: ['broke', 'broke', 'light_red'],
  };
  // the pieces' own random numbers (a small mulberry32): tests that fix Math.random for a roll still get a spread of pieces
  let seed = (Date.now() ^ 0x9e3779b9) >>> 0;
  const prand = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rnd = (a, b) => a + prand() * (b - a);
  const pickOf = (a) => a[Math.floor(prand() * a.length)];
  // one flying piece: x in % of the screen width, y in % of the band's height (0 = its top rim), w in band heights
  const fly = (cls, img, o) => `<div class="rfx-fly ${cls}" style="--x:${o.x.toFixed(1)}%;--y:${o.y.toFixed(1)}%;--w:calc(var(--bh) * ${o.w.toFixed(3)});` +
    `--d:${(o.d || 0).toFixed(2)}s;--t:${(o.t || 1).toFixed(2)}s;--dx:calc(var(--bh) * ${(o.dx || 0).toFixed(3)});--dy:calc(var(--bh) * ${(o.dy || 0).toFixed(3)});` +
    `--r:${Math.round(o.r || 0)}deg;${o.o ? `--o:${o.o};` : ''}${o.f ? `filter:${o.f};` : ''}"><img src="${ART(img)}" alt=""></div>`;
  // back: behind the medallion and the words (the big lights); front: what flies over them
  function pieces(r, small, back) {
    const s = r.state, k = small ? 0.55 : 1;
    let h = '';
    if (back) {
      if (s === 'great') { // the big flares bursting out above and below the band (the mockup's top right panel)
        h += fly('flare', 'light_flare', { x: 47, y: 30, w: 1.5, d: 0.12, o: 0.8 });
        h += fly('flare', 'light_flare', { x: 76, y: 70, w: 1.2, d: 0.24, o: 0.8 });
        h += fly('flash', 'light_halo', { x: 25, y: 50, w: 2.6, d: 0.08 });
      }
      if (s === 'broke') h += fly('flash', 'light_red', { x: 25, y: 50, w: 2.6, d: 0.28 });
      return h;
    }
    // twinkles round the band and the words
    const stars = { ok: 9, plain: 4, great: 16, saved: 5 }[s] || 0;
    for (let i = 0; i < Math.round(stars * k); i++) {
      const nearMed = i % 3 === 0;
      h += fly('star', 'light_star', { x: nearMed ? rnd(14, 36) : rnd(38, 94), y: pickOf([rnd(-28, 8), rnd(92, 126), rnd(10, 90)]), w: rnd(0.1, s === 'great' ? 0.3 : 0.22),
        d: rnd(0.2, 1.1), t: rnd(0.8, 1.4), f: s === 'saved' ? 'hue-rotate(170deg) saturate(1.5)' : '' });
    }
    if (s === 'fail' || s === 'drop' || s === 'saved') { // slow smoke drifting off the medallion and the band's ends
      const S = [[25, 30, -0.5, -0.25, 1.3], [27, 75, 0.45, 0.2, 1.1], [6, 50, -0.45, 0, 1.6], [94, 45, 0.45, -0.1, 1.5], [60, 95, 0.3, 0.25, 1.2]];
      S.slice(0, small ? 3 : 5).forEach(([x, y, dx, dy, w], i) => { h += fly('smoke', 'smoke_' + (i % 4), { x, y, w, dx, dy, d: 0.1 + i * 0.08, t: rnd(1.9, 2.5), o: 0.7 }); });
    }
    if (s === 'broke') {
      // shards of crystal and blade bursting out of the medallion
      for (let i = 0; i < (small ? 6 : 12); i++) {
        const a = (i / 12) * Math.PI * 2 + rnd(-0.2, 0.2), dist = rnd(0.9, 2.1);
        h += fly('shard', 'shard_' + pickOf([0, 1, 2, 3, 8, 9, 10, 11]), { x: 25, y: 50, w: rnd(0.14, 0.26), dx: Math.cos(a) * dist * 1.6, dy: Math.sin(a) * dist, r: rnd(-540, 540), d: rnd(0.28, 0.36), t: rnd(1.4, 1.9) });
      }
      // stone chunks knocked off the band, falling
      for (let i = 0; i < (small ? 4 : 8); i++) {
        const top = i % 2 === 0;
        h += fly('chunk', 'shard_' + (4 + (i % 4)), { x: rnd(8, 96), y: top ? rnd(-6, 8) : rnd(92, 106), w: rnd(0.1, 0.2), dx: rnd(-0.3, 0.3), dy: rnd(1.2, 2.2), r: rnd(-260, 260), d: rnd(0.2, 0.6), t: rnd(0.9, 1.3) });
      }
    }
    return h;
  }
  // the item's own picture cut into 8 wedges round its middle, flying apart (the broken state)
  const WEDGE = [[0, 0, 50, 0], [50, 0, 100, 0], [100, 0, 100, 50], [100, 50, 100, 100], [100, 100, 50, 100], [50, 100, 0, 100], [0, 100, 0, 50], [0, 50, 0, 0]];
  function bits(icon) {
    return WEDGE.map(([x1, y1, x2, y2]) => {
      const cx = (50 + x1 + x2) / 3 - 50, cy = (50 + y1 + y2) / 3 - 50, L = Math.hypot(cx, cy) || 1, d = rnd(0.55, 1.0);
      return `<i class="rfx-bit" style="background-image:url('${icon}');clip-path:polygon(50% 50%, ${x1}% ${y1}%, ${x2}% ${y2}%);` +
        `--dx:calc(var(--bh) * ${(cx / L * d).toFixed(3)});--dy:calc(var(--bh) * ${(cy / L * d).toFixed(3)});--r:${Math.round(rnd(-220, 220))}deg"></i>`;
    }).join('');
  }
  const clsOf = (L) => (L.cls || '').split(' ').filter(Boolean).map((c) => 'l-' + c).join(' '); // (prefixed: the game's css has a global .big)
  function lineHtml(L, s) {
    if (L.html) return `<li>${L.html}</li>`;
    let t = esc(L.t);
    if ((s === 'ok' || s === 'great') && t.includes('➜')) { const [a, b] = t.split('➜'); t = `${a}➜ <span class="up">${b.trim()}</span>`; }
    return `<li${L.c ? ` style="color:${L.c}"` : ''}${L.cls ? ` class="${clsOf(L)}"` : ''}>${t}</li>`;
  }
  function html(r) {
    const s = r.state, [band, medal, light] = LOOK[s] || LOOK.ok, small = r.size === 'small';
    const lit = s === 'ok' || s === 'great' || s === 'plain' || s === 'saved';
    const lines = (r.lines || []).slice(0, 1).map((L) => lineHtml(L, s)).join(''), sub = (r.lines || [])[1]; // (the band holds four rows, as the mockup)
    const kick = r.kicker && r.kind !== 'refine' ? `<span class="rfx-kk">${esc(r.kicker)}</span>` : '';
    return '<div class="rfx-dim"></div><div class="rfx-stage">' +
      `<div class="rfx-band" style="background-image:url('${ART('band_' + band)}')"></div>` +
      (lit ? `<div class="rfx-edge t" style="background-image:url('${ART('light_line')}')"></div><div class="rfx-edge b" style="background-image:url('${ART('light_line')}')"></div>` +
        `<div class="rfx-rim t"><img src="${ART('light_line')}" alt=""></div><div class="rfx-rim b"><img src="${ART('light_line')}" alt=""></div>` : '') +
      pieces(r, small, true) +
      '<div class="rfx-med">' +
        (light ? `<div class="rfx-burst"><img src="${ART(light)}" alt=""></div>` : '') +
        (s !== 'fail' && s !== 'drop' ? `<img class="rfx-halo" src="${ART('light_halo')}" alt="">` : '') +
        `<div class="rfx-ring"><img src="${ART('medal_' + medal)}" alt=""></div>` +
        `<div class="rfx-item"><img src="${r.icon || ''}" alt="">${s === 'broke' && r.icon ? bits(r.icon) : ''}</div>` +
      '</div>' +
      pieces(r, small) +
      '<div class="rfx-text">' +
        `<div class="rfx-title"><span class="bk">${esc(r.title)}</span><span class="fr">${esc(r.title)}</span></div>` +
        (r.name || kick ? `<div class="rfx-name">${kick}${esc(r.name || '')}</div>` : '') +
        (r.step ? `<div class="rfx-step">${r.step}</div>` : '') +
        (lines ? `<ul class="rfx-lines">${lines}</ul>` : '') +
      '</div>' +
      (sub ? `<div class="rfx-sub ${clsOf(sub)}"${sub.c ? ` style="color:${sub.c}"` : ''}>${sub.html || esc(sub.t)}</div>` : '') +
      '<div class="rfx-hint">คลิกเพื่อไปต่อ</div></div>';
  }
  // the pictures load before the first popup (a popup that pops in late looks broken): the small look's few, or all of C's
  let preloaded = '';
  function preload() {
    if (preloaded === mode || mode === 'off') return;
    preloaded = mode;
    const names = mode === 'mini'
      ? ['rib_ok', 'rib_great', 'rib_fail', 'rib_broke', 'light_burst', 'light_flare', 'light_red', 'light_star', 'light_halo', 'smoke_1', 'smoke_3', 'shard_0', 'shard_1', 'shard_8', 'shard_9']
      : ['band_ok', 'band_great', 'band_fail', 'band_broke', 'medal_ok', 'medal_great', 'medal_fail', 'medal_broke',
        'light_burst', 'light_flare', 'light_red', 'light_line', 'light_star', 'light_halo', 'smoke_0', 'smoke_1', 'smoke_2', 'smoke_3'];
    if (mode !== 'mini') for (let i = 0; i < 12; i++) names.push('shard_' + i);
    for (const n of names) { const im = new Image(); im.src = ART(n); }
  }

  // ---------------- look A, small: the default (the user, after the clip of C: "ผมว่ามันดูเยอะไปหน่อย ลองออกแบบ แบบนิดเดียวก็พอ
  // ให้มันกดง่ายๆ มันมือหน่อย"; picked mockup A, assets/gen/nightcamp_resultfx_mini_a_raw.png: "A ทำรูปอาวุธ ชัดๆด้วยนะ").
  // A stamp ON the item's own picture of the page: the light stays inside that picture, the item is drawn sharp from its own
  // sprite, a painted ribbon with the word crosses its lower half, the number under it. Nothing darkens, no click or key is
  // caught (the next try clicks straight through), about a second; a new result replaces the old one at once.
  const MTIME = { ok: 1.0, great: 1.4, plain: 0.9, fail: 1.0, drop: 1.15, saved: 1.15, broke: 1.5 }; // seconds
  const RIB = { ok: 'ok', plain: 'ok', great: 'great', fail: 'fail', drop: 'fail', saved: 'fail', broke: 'broke' };
  const MLIGHT = { ok: 'light_burst', great: 'light_flare', broke: 'light_red', saved: 'light_halo' };
  let mel = null, mtimer = 0, lastBtn = null;
  // the button that started the try: the stamp lands on that row's picture when the page has no big one
  // (its box is kept from the click itself: some pages draw themselves again before the result comes, and the button is gone)
  document.addEventListener('click', (e) => {
    const b = e.target && e.target.closest && e.target.closest('button, [data-act]');
    if (b) { const R = b.getBoundingClientRect(); lastBtn = { left: R.left, top: R.top, width: R.width, height: R.height, bottom: R.bottom, t: performance.now() }; }
  }, true);
  const vis = (e) => !!(e && e.isConnected && e.getClientRects().length);
  // where the stamp goes: on the page's own picture of the item (its own item hidden under the sharp one), or, on a page
  // without one (stones, potions, runes, oils), just above the button that was pressed, where the eyes already are
  function anchorOf(r) {
    const page = document.getElementById('cg-page'), q = (sel) => { const e = page && page.querySelector(sel); return vis(e) ? e : null; };
    let a = null, item = null, pic = true; // (a: an element, or the pressed button's box)
    if (r.kind === 'refine') { a = q('.rw-stage'); item = q('.rw-item'); }                      // (js/refinewin.js: the item over the anvil)
    else if (r.kind === 'craft') { a = q('.fm-spot'); item = q('.fm-spot img'); }               // (js/forgemake.js: the weapon on its light)
    else if (r.kind === 'polish') { a = q('.gt2-top'); const S = page && page.querySelectorAll('.gt2-slot'); item = S && S.length ? S[S.length - 1] : null; pic = false; } // (js/gradetier.js: the after slot)
    else if (r.kind === 'cook') { a = q('.cg-scene'); item = q('.cg-scene .cg-dish'); }         // (js/craftgo.js: the dish by the pot)
    if (a && item) return { a, item, pic, btn: null };
    const fresh = lastBtn && lastBtn.width > 0 && performance.now() - lastBtn.t < 2000;
    return { a: fresh ? lastBtn : vis(page) ? page : null, item: null, pic: false, btn: !!fresh };
  }
  // the weapon redrawn from its own sprite in ONE step at the screen's real pixels, then its edges sharpened (the page's
  // own icon is drawn into a 256 canvas and scaled again by css: two soft steps); other things keep their icon
  const crispCache = new Map();
  function sharpen(c, D, amount) { // (an unsharp mask on the colour, the alpha kept)
    const im = c.getImageData(0, 0, D, D), d = im.data, src = new Uint8ClampedArray(d);
    for (let y = 1; y < D - 1; y++) for (let x = 1; x < D - 1; x++) {
      const i = (y * D + x) * 4;
      if (src[i + 3] < 8) continue;
      for (let k = 0; k < 3; k++) {
        const v = src[i + k], blur = (src[i + k - 4] + src[i + k + 4] + src[i + k - D * 4] + src[i + k + D * 4] + v * 4) / 8;
        d[i + k] = v + (v - blur) * amount;
      }
    }
    c.putImageData(im, 0, 0);
  }
  function crispIcon(id, css) {
    const it = ITEMS[id], s = it && it.slot === 'weapon' && NC.SPR[it.icon || it.sprite];
    if (!s || !s.img || !(s.img.naturalWidth || s.img.width) || s.ready === false) return itemIcon(id); // (ready false: still streaming in, js/assets.js)
    const pic = (NC.WpnHD && NC.WpnHD.img(it.icon || it.sprite)) || s.img; // (its HD copy once that has loaded: js/wpnhd.js)
    const dpr = Math.min(3, devicePixelRatio || 1), D = Math.max(16, Math.round(css * dpr)), key = id + '@' + D + (pic !== s.img ? '+hd' : '');
    if (crispCache.has(key)) return crispCache.get(key);
    const cv = document.createElement('canvas'); cv.width = cv.height = D;
    const c = cv.getContext('2d'); c.imageSmoothingQuality = 'high';
    const nw = pic.naturalWidth || pic.width, nh = pic.naturalHeight || pic.height;
    const k = (D * 0.98) / ((nw + nh) / Math.SQRT2); // (on the diagonal, as big as the page shows it)
    c.translate(D / 2, D / 2); c.rotate(Math.PI / 4); c.drawImage(pic, (-nw * k) / 2, (-nh * k) / 2, nw * k, nh * k);
    c.setTransform(1, 0, 0, 1, 0, 0);
    let url = '';
    // (the HD copy is shrunk, not stretched: a light pass only, against the popup's sub-pixel place on the page)
    try { if (k > 1.05) sharpen(c, D, Math.min(0.9, 0.35 + (k - 1) * 0.3)); else if (pic !== s.img) sharpen(c, D, 0.3); url = cv.toDataURL(); } catch (e) { url = itemIcon(id); }
    crispCache.set(key, url);
    return url;
  }
  // a word's size so it fits a width (measured in the game's font)
  let measureCtx = null;
  function fitFont(text, maxW, cap) {
    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
    measureCtx.font = '700 100px Mitr, sans-serif';
    const w = measureCtx.measureText(String(text).replace(/<[^>]+>/g, '')).width || 100;
    return Math.max(12, Math.min(cap, (maxW * 100) / w));
  }
  const goldText = (cls, html) => `<b class="${cls}"><span class="bk">${html}</span><span class="fr">${html}</span></b>`;
  function miniHtml(r, L) {
    const s = r.state, light = MLIGHT[s], R = (n) => ART(n), out = [];
    const icon = r.id ? crispIcon(r.id, L.isz) : r.icon || '';
    // the light and the smoke stay inside the picture (mockup A)
    const smoke = s === 'fail' || s === 'drop' || s === 'saved' ? `<img class="rfa-smoke l" src="${R('smoke_1')}" alt=""><img class="rfa-smoke r" src="${R('smoke_3')}" alt="">` : '';
    if (light || smoke) out.push(`<div class="rfa-clip">${light ? `<img class="rfa-light${s === 'saved' ? ' halo' : ''}" src="${R(light)}" alt="">` : ''}${smoke}</div>`);
    out.push(`<div class="rfa-item"><img src="${icon}" alt="">${s === 'broke' && icon ? bits(icon) : ''}</div>`);
    // the big four-point twinkles round the item, above the ribbon (the mockup)
    const stars = { ok: 6, plain: 3, great: 9, saved: 3 }[s] || 0, top = Math.max(12, (L.ry / L.h) * 100 - 10);
    for (let i = 0; i < Math.round(stars * (L.small ? 0.6 : 1)); i++) {
      out.push(`<img class="rfa-star" src="${R('light_star')}" alt="" style="--x:${(i % 2 ? rnd(58, 90) : rnd(10, 42)).toFixed(0)}%;--y:${rnd(4, top).toFixed(0)}%;--z:${rnd(0.55, 1).toFixed(2)};--d:${rnd(0.08, 0.5).toFixed(2)}s">`);
    }
    if (s === 'broke') for (let i = 0; i < (L.small ? 4 : 7); i++) {
      const a = (i / 7) * Math.PI * 2 + rnd(-0.3, 0.3), d = rnd(0.35, 0.6);
      out.push(`<img class="rfa-shard" src="${R('shard_' + pickOf([0, 1, 8, 9]))}" alt="" style="--dx:${(Math.cos(a) * d * 100).toFixed(0)}%;--dy:${(Math.sin(a) * d * 100).toFixed(0)}%;--r:${Math.round(rnd(-400, 400))}deg">`);
    }
    out.push(`<div class="rfa-rib" style="--fs:${L.fw.toFixed(0)}px"><img src="${R('rib_' + RIB[s])}" alt="">${goldText('rfa-w', esc(r.title))}</div>`);
    if (L.num) out.push(`<div class="rfa-num" style="--fs:${L.fn.toFixed(0)}px">${goldText('rfa-n', L.num)}</div>`);
    return out.join('');
  }
  // the layout of mockup A, measured on its SUCCESS panel (assets/gen/nightcamp_resultfx_mini_a_raw.png, the anvil 275 x 425):
  // the item stays where the page shows it and as big; the ribbon, 92 % of the picture's width, crosses just above the
  // anvil (its middle about 0.42 of the item's size under the item's middle); the word fills the ribbon's face; the number,
  // as big as the word, sits under the ribbon overlapping its lower edge; the light fills the picture; twinkles above
  function mini(r) {
    if (!mel) { mel = document.createElement('div'); mel.id = 'rfa'; mel.hidden = true; document.body.appendChild(mel); }
    preload();
    clearTimeout(mtimer);
    const { a, pic, item, btn } = anchorOf(r), small = r.size === 'small';
    const A = !a ? { left: innerWidth / 2 - 130, top: innerHeight / 2 - 110, width: 260, height: 220, bottom: innerHeight / 2 + 110 }
      : a.getBoundingClientRect ? a.getBoundingClientRect() : a;
    let w, h, x, y, ix = 50, iy, isz;
    if (btn) { // above the pressed button: the item on top, the ribbon, the number (below the button when there is no room above)
      w = small ? 240 : 280; h = small ? 200 : 230; isz = small ? 70 : 84; iy = 24;
      // (inside the crafting page: never over the window's title bar)
      const pg = document.getElementById('cg-page'), P = vis(pg) ? pg.getBoundingClientRect() : { left: 0, top: 0, right: innerWidth };
      x = Math.max(P.left, Math.min(P.right - w, A.left + A.width / 2 - w / 2)); y = A.top - h - 4;
      if (y < P.top - 8) y = A.bottom + 4;
    } else {
      w = Math.max(A.width, small ? 230 : 270); h = Math.max(A.height, small ? 220 : 270);
      x = A.left + A.width / 2 - w / 2; y = A.top + A.height / 2 - h / 2;
    }
    x = Math.max(4, Math.min(innerWidth - w - 4, x)); y = Math.max(4, Math.min(innerHeight - h - 4, y));
    if (item) { const I = item.getBoundingClientRect(); ix = ((I.left + I.width / 2 - x) / w) * 100; iy = ((I.top + I.height / 2 - y) / h) * 100; isz = Math.max(I.width, I.height); }
    else if (!btn) { iy = 36; isz = Math.min(w, h) * 0.6; }
    const rw = Math.min(w * 0.92, small ? 250 : 330);
    const ry = btn ? h * 0.6 : Math.min((iy / 100) * h + isz * 0.42, h * 0.66);
    const num = r.num || r.step || (r.name ? `<span class="a">${esc(r.name)}</span>` : '');
    const fw = fitFont(r.title, rw * 0.8, rw * 0.2), fn = num ? fitFont(num, w * 0.94, rw * 0.22) : 0;
    mel.className = `rfa-${small ? 'small' : 'big'} s-${r.state} k-${r.kind}${pic ? ' pic' : ''}`;
    mel.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;--rad:${a && pic ? getComputedStyle(a).borderRadius : '0px'};` +
      `--ix:${ix.toFixed(1)}%;--iy:${iy.toFixed(1)}%;--is:${isz.toFixed(0)}px;--rw:${rw.toFixed(0)}px;--ry:${ry.toFixed(0)}px;--s:${Math.min(w, h).toFixed(0)}px`;
    mel.innerHTML = miniHtml(r, { isz, ry, h, small, fw, fn, num });
    const win = document.getElementById('craftgo');
    if (win) win.classList.toggle('rfa-cover', !!item); // (the page's own soft item hides while the sharp one stands on it)
    if (win) { win.className = win.className.replace(/\s*rfa-t-\w+/g, ''); if (pic) win.classList.add('rfa-t-' + r.state); } // (the picture tinted the result's colour)
    mel.hidden = false;
    void mel.offsetWidth;
    mel.classList.add('in');
    if (!NC.ResultFX.hold) mtimer = setTimeout(miniClose, (MTIME[r.state] || 1) * (small ? 0.85 : 1) * 1000);
  }
  function miniClose() {
    if (!mel || mel.hidden) return;
    clearTimeout(mtimer);
    mel.classList.add('out');
    setTimeout(() => {
      if (!mel.classList.contains('out')) return; // (a new result came meanwhile)
      mel.hidden = true; mel.className = ''; mel.innerHTML = '';
      const win = document.getElementById('craftgo'); if (win) { win.classList.remove('rfa-cover'); win.className = win.className.replace(/\s*rfa-t-\w+/g, ''); }
    }, 160);
  }
  const stepHtml = (a, b, cls) => `<span class="a">${esc(a)}</span><i class="ar ${cls || ''}">➜</i><span class="b ${cls || ''}">${esc(b)}</span>`;

  // ---------------- ตีบวก (refine.js + refinewin.js) ----------------
  const GLOWN = ['ไม่มี', 'ไม่มี', 'ไม่มี', 'ไม่มี', 'ไม่มี', 'ประกาย', 'ประกาย', 'ฟ้า', 'ม่วง', 'ทอง', 'รุ้ง'];
  function refineResult(p, c, before, after, still) {
    const it = ITEMS[c.id], weapon = it.slot === 'weapon', R = NC.Refine;
    const was = before.ref, now = still ? c.ref || 0 : was, name = (c.sh ? '✦ ' : '') + it.name;
    const gi = gradeInfo(c), col = gi ? gi.color : rarityCol(c.id);
    const base = { kind: 'refine', size: 'big', id: c.id, icon: itemIcon(c.id), color: col };
    const glow = (a, b) => (GLOWN[Math.min(10, a)] !== GLOWN[Math.min(10, b)] ? [{ t: `แสงอาวุธ ${GLOWN[Math.min(10, a)]} ➜ ${GLOWN[Math.min(10, b)]}`, cls: 'dim' }] : []);
    const stat = (a, b) => (weapon ? [{ t: `ATK +${4 * a}% ➜ +${4 * b}%` }].concat(glow(a, b))
      : [{ t: `${it.of && it.of.line === 'mg' ? 'MDEF' : 'DEF'} +${Math.floor(a / 2)} ➜ +${Math.floor(b / 2)}` }, { t: `HP +${0.5 * a}% ➜ +${0.5 * b}%`, cls: 'dim' }]);
    if (!still) return Object.assign(base, { state: 'broke', title: 'แตกสลาย!', name: `${name} +${was}`, num: `<span class="b bad sm">+${was} หายไปแล้ว</span>`,
      lines: [{ t: `${it.name} +${was} หายไปแล้ว`, cls: 'bad big' }, { t: 'ครั้งหน้าเปิดหินกันแตกก่อนตี +9 / +10', cls: 'dim' }] });
    if (now > was) {
      const great = before.n > before.safeTo;
      return Object.assign(base, { state: great ? 'great' : 'ok', top: now >= 10, title: now >= 10 ? 'สูงสุด +10!!' : great ? 'สุดยอด!' : 'สำเร็จ!', name, num: `<span class="b">+${now}</span>`,
        step: great ? `<span class="b">+${now}</span>` : stepHtml('+' + was, '+' + now, 'up'), lines: stat(was, now) });
    }
    const I = R && R.info ? R.info(p, c) : null, nextCh = I && !I.max ? `ครั้งหน้าโอกาส ${I.chance}%` : '';
    if (after.stones < before.stones) return Object.assign(base, { state: 'saved', title: 'รอดแล้ว!', name, step: stayHtml(now),
      lines: [{ t: `หินกันแตกช่วยไว้ · เหลือ ${after.stones} ก้อน`, cls: 'blue' }, { t: `เตาร้อนขึ้น · ${nextCh}`, cls: 'dim' }] });
    if (now < was) return Object.assign(base, { state: 'drop', title: 'ไม่สำเร็จ', name, step: stepHtml('+' + was, '+' + now, 'down'),
      lines: [{ t: `ลดลง 1 ขั้น · เตาร้อน ×1.5 · ${nextCh}` }] });
    return Object.assign(base, { state: 'fail', title: 'ไม่สำเร็จ', name, step: stayHtml(now), lines: [{ t: `เตาร้อน ×1.5 · ${nextCh}` }] });
  }
  const stayHtml = (n) => `<span class="a">ยังเป็น</span> <span class="b">+${n}</span>`;
  function hookRefine() {
    const RW = NC.RefineWin, R = NC.Refine;
    if (!RW || !R || !R.info || RW._rfx) return;
    const base = RW.click;
    RW.click = function (b, g) {
      const m = b && b.dataset && /^rf:go:(\d+)$/.exec(b.dataset.act || ''), p = g && g.player, W = NC.GEAR;
      const c = m && p && W ? W.bag(p).find((x) => x.u === Number(m[1])) : null;
      let before = null;
      if (c) { const I = R.info(p, c); before = { ref: c.ref || 0, n: I.n, safeTo: I.safeTo, chance: I.chance, stones: NC.matCount(p, 'mat_safety'), last: R.last() }; }
      const out = base.apply(this, arguments);
      if (before && R.last() !== before.last) {
        try { show(refineResult(p, c, before, { stones: NC.matCount(p, 'mat_safety') }, W.bag(p).includes(c))); } catch (e) { console.warn('resultfx refine', e); }
      }
      return out;
    };
    RW._rfx = true;
  }

  // ---------------- ตีอาวุธ (NC.Forge.craft: js/forgemake.js's page) ----------------
  function craftResult(c) {
    const it = ITEMS[c.id], gi = gradeInfo(c), rows = c.rows || [], gods = rows.filter((r) => r.tier === 2).length;
    const great = gods > 0 || gradeOf(c) >= 3;
    const rowT = (r) => `<span style="color:${(TIER()[r.tier] || {}).color || '#fff'}">${esc(NC.rowText ? NC.rowText(r) : r.k)}</span>`;
    return { kind: 'craft', size: 'big', state: great ? 'great' : 'ok', id: c.id, icon: itemIcon(c.id), color: gi ? gi.color : rarityCol(c.id),
      kicker: 'ตีอาวุธ', title: great ? (gods ? 'ได้ออฟเทพ!' : 'ของดี!') : 'ตีเสร็จแล้ว!', name: it.name,
      step: gi ? `<span class="b sm" style="color:${gi.color}">เกรด${esc(gi.name)}</span>` : '',
      lines: rows.length ? rows.slice(0, 2).map((r) => ({ html: rowT(r) + (r.tier === 2 ? ' ✦' : '') })) : [{ t: 'ยังไม่มีแถวออฟ · เจาะได้ที่ป๋าหมูหริ่ง' }] };
  }
  function hookCraft() {
    const F = NC.Forge;
    if (!F || !F.craft || F._rfxCraft) return;
    const base = F.craft;
    F.craft = function () {
      const c = base.apply(this, arguments);
      if (c && ITEMS[c.id]) { try { show(craftResult(c)); } catch (e) { console.warn('resultfx craft', e); } }
      return c;
    };
    F._rfxCraft = true;
  }

  // ---------------- เจาะออฟ / หินออฟ (js/forge.js's opt page, through NC.Forge.click) ----------------
  const copies = (p) => (NC.WBAG && NC.WBAG.copies ? NC.WBAG.copies(p) : NC.GEAR ? NC.GEAR.bag(p) : []);
  function optResult(c, i, drilled, pity) {
    const it = ITEMS[c.id], r = c.rows[i], T = TIER()[r.tier] || {}, gi = gradeInfo(c);
    const state = r.tier === 2 ? 'great' : r.tier === 1 ? 'ok' : 'plain';
    const line = drilled ? { t: `ระดับ${T.th || ''} · แถวออฟ ${c.rows.length}/4` }
      : { t: r.tier === 2 ? (pity ? 'แต้มช่างครบ ป๋าตีเต็มที่!' : `ระดับ${T.th} · แต้มช่างเริ่มนับใหม่`) : `ระดับ${T.th || ''} · แต้มช่าง ${c.pi || 0}/10 ครบแล้วได้เทพแน่นอน` };
    return { kind: drilled ? 'drill' : 'stone', size: 'big', state, id: c.id, icon: itemIcon(c.id), color: gi ? gi.color : rarityCol(c.id),
      kicker: drilled ? `เจาะแถวออฟที่ ${c.rows.length}` : `หินออฟ แถว ${i + 1}`, title: r.tier === 2 ? 'ออฟเทพ!!' : r.tier === 1 ? 'ออฟดี!' : 'ออฟธรรมดา',
      step: `<span class="b sm" style="color:${T.color}">${esc(NC.rowText ? NC.rowText(r) : r.k)}</span>`, name: it.name, lines: [line] };
  }
  function hookOpt() {
    const F = NC.Forge;
    if (!F || !F.click || F._rfxClick) return;
    const base = F.click;
    F.click = function (t, game) {
      const id = t && t.id, p = game && game.player;
      if (!(p && (id === 'fg-drill' || id === 'fg-stone'))) return base.apply(this, arguments);
      const snap = new Map(copies(p).map((c) => [c.u, { rows: JSON.stringify(c.rows || []), n: (c.rows || []).length, pi: c.pi || 0 }]));
      const out = base.apply(this, arguments);
      try {
        for (const c of copies(p)) {
          const s = snap.get(c.u);
          if (!s || JSON.stringify(c.rows || []) === s.rows) continue;
          if (c.rows.length > s.n) show(optResult(c, c.rows.length - 1, true));
          else { const was = JSON.parse(s.rows), i = c.rows.findIndex((r, k) => JSON.stringify(r) !== JSON.stringify(was[k])); show(optResult(c, Math.max(0, i), false, s.pi >= 9)); }
          break;
        }
      } catch (e) { console.warn('resultfx opt', e); }
      return out;
    };
    F._rfxClick = true;
  }

  // ---------------- the forge tabs: ขัดเกรด · รวมรูน · ธาตุ น้ำมัน กระสุน ----------------
  function polishResult(p, c, before) {
    const GR = NC.Grade.GRADES, g = gradeOf(c), it = ITEMS[c.id], to = GR[g], from = GR[before.g];
    const base = { kind: 'polish', size: 'big', id: c.id, icon: itemIcon(c.id), color: to.color, name: it.name };
    const pill = (G) => `<span class="gp" style="--c:${G.color}">${esc(G.name)}</span>`;
    if (g > before.g) return Object.assign(base, { state: g >= 3 ? 'great' : 'ok', kicker: 'ขัดเกรด', title: g >= 4 ? 'สุดยอด!!' : g >= 3 ? 'สุดยอด!' : 'สำเร็จ!',
      step: `${pill(from)}<i class="ar up">➜</i>${pill(to)}`, lines: [{ t: (NC.Grade.WHAT || [])[g] || '' }] });
    const pity = `แต้มช่าง ${c.gp || 0}/10 · ครบแล้วสำเร็จแน่นอน`;
    if (g < before.g) return Object.assign(base, { state: 'drop', kicker: 'ขัดเกรด', title: 'เกรดตก', step: `${pill(from)}<i class="ar down">➜</i>${pill(to)}`, lines: [{ t: pity, cls: 'dim' }] });
    if (NC.matCount(p, 'mat_grade_seal') < before.seals) return Object.assign(base, { state: 'saved', kicker: 'ขัดเกรด ไม่สำเร็จ', title: 'รอดแล้ว!', step: pill(to),
      lines: [{ t: `ตราผนึกเกรดช่วยไว้ · เหลือ ${NC.matCount(p, 'mat_grade_seal')}`, cls: 'blue' }, { t: pity, cls: 'dim' }] });
    return Object.assign(base, { state: 'fail', kicker: 'ขัดเกรด', title: 'ไม่สำเร็จ', step: pill(to), lines: [{ t: 'เกรดยังอยู่' }, { t: pity, cls: 'dim' }] });
  }
  function gained(before, p) {
    const out = [];
    for (const id in p.mats || {}) { const d = NC.matCount(p, id) - (before[id] || 0); if (d > 0) out.push([id, d]); }
    return out;
  }
  function hookTabs() {
    for (const T of NC.FORGE_TABS || []) {
      if (!T || !T.click || T._rfx) continue;
      const base = T.click;
      T.click = function (b, game) {
        const p = game && game.player, D = (b && b.dataset) || {};
        if (!p) return base.apply(this, arguments);
        if (T.key === 'grade' && D.gtgo && NC.Grade) {
          const c = (NC.GEAR ? NC.GEAR.bag(p) : copies(p)).find((x) => x.u === Number(D.gtgo));
          const before = c && { g: gradeOf(c), seals: NC.matCount(p, 'mat_grade_seal'), stones: NC.matCount(p, 'mat_polish'), coins: p.coins || 0 };
          const out = base.apply(this, arguments);
          if (c && (NC.matCount(p, 'mat_polish') < before.stones || (p.coins || 0) < before.coins)) { try { show(polishResult(p, c, before)); } catch (e) { console.warn('resultfx polish', e); } }
          return out;
        }
        if ((T.key === 'runes' && D.blmerge) || (T.key === 'bl' && (D.blext || D.blextall || D.blmake || D.bloil || D.blammo))) {
          const before = Object.assign({}, p.mats);
          const out = base.apply(this, arguments);
          try {
            const got = gained(before, p);
            if (got.length) {
              const [id, n] = got[0], tier = T.key === 'runes' ? Number(D.blmerge.split(':')[1]) + 1 : 0;
              show({ kind: T.key === 'runes' ? 'rune' : 'ess', size: 'small', state: tier >= 3 ? 'great' : 'ok', icon: matIcon(id), color: tier >= 3 ? '#ffc94d' : '#9fd8ff',
                kicker: T.key === 'runes' ? 'รวมรูน' : D.bloil ? 'ทำน้ำมันเคลือบ' : D.blammo ? 'ทำกระสุน' : 'สกัด', title: tier >= 3 ? 'รูนขั้นสูงสุด!' : 'สำเร็จ!',
                name: `${matName(id)} ×${n}`, lines: got.slice(1, 3).map(([i2, n2]) => ({ t: `${matName(i2)} ×${n2}` })) });
            }
          } catch (e) { console.warn('resultfx tab', e); }
          return out;
        }
        return base.apply(this, arguments);
      };
      T._rfx = true;
    }
  }

  // ---------------- ทำอาหาร · ต้มยา ----------------
  function hookCook() {
    const C = NC.Cook;
    if (C && C.cook && !C._rfx) {
      const base = C.cook;
      C.cook = function (game, id, n) {
        const p = game && game.player, had = p ? NC.matCount(p, id) : 0;
        const out = base.apply(this, arguments);
        if (out && p) {
          const made = NC.matCount(p, id) - had, D = (C.BY && C.BY[id]) || {};
          show({ kind: 'cook', size: 'small', state: made > n ? 'great' : 'ok', icon: matIcon(id), color: '#ffb35c', kicker: 'ทำอาหาร',
            title: made > n ? 'ได้เพิ่ม!' : 'เสร็จแล้ว!', name: `${D.name || matName(id)} ×${made}`, lines: D.tag ? [{ t: D.tag }] : [] });
        }
        return out;
      };
      C._rfx = true;
    }
    const B = NC.Brew;
    if (B && B.brew && !B._rfx) {
      const base = B.brew;
      B.brew = function (game, id, batches) {
        const out = base.apply(this, arguments);
        if (out) {
          const R = (B.RECIPES || []).find((x) => x.id === id), q = R && R.q;
          const src = q ? ((NC.ASSET_MANIFEST[q.icon] || {}).src || 'assets/' + q.icon + '.png') : '';
          show({ kind: 'brew', size: 'small', state: 'ok', icon: src, color: q && q.color === 'blue' ? '#7cc4ff' : '#ff8a9a', kicker: 'ต้มยา',
            title: 'เสร็จแล้ว!', name: `${q ? q.name : 'ยา'} ×${(B.BATCH || 1) * (batches || 1)}`, lines: q && q.what ? [{ t: q.what }] : [] });
        }
        return out;
      };
      B._rfx = true;
    }
  }

  function hookAll() { hookRefine(); hookCraft(); hookOpt(); hookTabs(); hookCook(); setTimeout(preload, 3000); }
  hookAll();
  // (files loaded after this one may add forge tabs or replace objects: hook again when the HUD starts)
  const baseInit = NC.HUD && NC.HUD.init;
  if (baseInit) NC.HUD.init = function () { const r = baseInit.apply(this, arguments); hookAll(); return r; };

  // ESC → ตั้งค่า
  (NC.MENU_SETTINGS = NC.MENU_SETTINGS || []).push({
    name: 'ป็อปอัพผลตีบวก / ทำของ', note: 'ป็อปอัพใหญ่ตอนตีบวก ตีอาวุธ ใส่หินออฟ ขัดเกรด ทำอาหาร ต้มยา (คลิกเพื่อข้าม)',
    opts: [['mini', 'เล็ก'], ['big', 'ใหญ่'], ['off', 'ปิด']],
    get: () => mode,
    set: (v) => { mode = v === 'off' ? 'off' : v === 'big' ? 'big' : 'mini'; on = mode !== 'off'; try { localStorage.setItem(SAVE, mode); } catch (e) { /* storage blocked */ } },
  });

  // ---------------- test: ?resultfx=demo, NC.ResultFX.demo(kind, state) ----------------
  function demo(kind, state) {
    const g = G(), p = g && g.player;
    const id = (p && p.equip && p.equip.weapon && ITEMS[p.equip.weapon]) ? p.equip.weapon : Object.keys(ITEMS).find((k) => ITEMS[k].slot === 'weapon');
    const it = ITEMS[id] || { name: 'ดาบ' };
    const base = { kind: kind || 'refine', size: 'big', id, icon: itemIcon(id), color: '#6fb6ff', name: it.name };
    const S = {
      ok: { state: 'ok', title: 'สำเร็จ!', step: stepHtml('+7', '+8', 'up'), lines: [{ t: 'ATK +28% ➜ +32%' }, { t: 'แสงอาวุธ ฟ้า ➜ ม่วง', cls: 'dim' }] },
      great: { state: 'great', title: 'สุดยอด!', step: '<span class="b">+9</span>', lines: [{ t: 'ATK +32% ➜ +36%' }, { t: 'แสงอาวุธ ม่วง ➜ ทอง', cls: 'dim' }] },
      plain: { state: 'plain', kind: 'stone', kicker: 'หินออฟ แถว 2', title: 'ออฟธรรมดา', step: '<span class="b sm" style="color:#e8e2d4">ATK +2% (เต็ม 7)</span>', lines: [{ t: 'ระดับธรรมดา · แต้มช่าง 3/10 ครบแล้วได้เทพแน่นอน' }] },
      fail: { state: 'fail', title: 'ไม่สำเร็จ', step: stayHtml(8), lines: [{ t: 'เตาร้อน ×1.5 · ครั้งหน้าโอกาส 52%' }] },
      drop: { state: 'drop', title: 'ไม่สำเร็จ', step: stepHtml('+9', '+8', 'down'), lines: [{ t: 'ลดลง 1 ขั้น · เตาร้อน ×1.5 · ครั้งหน้าโอกาส 37%' }] },
      saved: { state: 'saved', title: 'รอดแล้ว!', step: stayHtml(9), lines: [{ t: 'หินกันแตกช่วยไว้ · เหลือ 1 ก้อน', cls: 'blue' }, { t: 'เตาร้อนขึ้น · ครั้งหน้าโอกาส 37%', cls: 'dim' }] },
      broke: { state: 'broke', title: 'แตกสลาย!', lines: [{ t: `${it.name} +9 หายไปแล้ว`, cls: 'bad big' }, { t: 'ครั้งหน้าเปิดหินกันแตกก่อนตี +9 / +10', cls: 'dim' }] },
    };
    show(Object.assign(base, S[state || 'ok'] || S.ok));
  }
  const ORDER = ['ok', 'great', 'plain', 'fail', 'drop', 'saved', 'broke'];

  NC.ResultFX = { show, demo, skip: () => { if (el && !el.hidden) close(); miniClose(); }, get on() { return on; }, set on(v) { on = !!v; }, get mode() { return mode; }, set mode(v) { mode = v; on = v !== 'off'; },
    ORDER, TIME, SMALL_K, MTIME, hold: false, last: () => (mode === 'mini' ? (mel && !mel.hidden ? mel.className : '') : el && !el.hidden ? el.className : ''),
    // (js/online/craft.js: the server's results drawn by the same builders)
    refineResult, craftResult, optResult, polishResult, itemIcon, matIcon, matName };
})();
