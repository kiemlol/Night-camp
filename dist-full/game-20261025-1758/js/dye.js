/* dye.js — ย้อมสีชุด (the user, 2026-10-12: "ทำระบบย้อมสีชุดได้ไหม", then "เอา A" = mockup A of the dye window,
   assets/gen/nightcamp_ec_dye_a_raw.png). Coins for looks only (no stats), seen by the others online.
   What is dyed: the worn outfit (robe, or top + trousers), hat, fashion outfit and fashion hat. Each piece has two dye
   areas, its MAIN colour and its SECOND colour: the two biggest colour groups of its pictures (a hue band, or the light
   greys / whites), so a knight's silver plates and its red tabard are dyed apart; the outline, the skin, and every
   other colour (metal, gems, glow) stay as drawn.
   How: avatar.js pic() asks NC.dyePic(sprite) for each picture of the hero; while NC.drawHero draws a hero whose dyes
   we know (the player: p.dyes; the others: their presence field 'dy'), the pictures of the dyed pieces come back
   recoloured (hue → the dye's, lightness kept relative to the area's own, cached per picture and dye).
   Saved: nightcamp.dye.v1 { v, d: { itemId: { a: [colour, bright], b: [...] } } }. Window: NC.Dye.open() (the bag's
   ย้อมสี button), ?dye opens it. Prices: outfit 120,000, hat 80,000 per area; washing out is free.
   Load after js/inventory.js and every NC.drawHero wrapper (it must see the equip the callers pass). */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS;
  const G = () => NC.game;
  const KEY = 'nightcamp.dye.v1';
  // the palette of mockup A: [id, Thai name, colour]
  const COLORS = [['cream', 'ครีม', '#f1e2bd'], ['white', 'ขาว', '#f2f3f8'], ['charcoal', 'ถ่าน', '#3d3d48'], ['rose', 'ชมพูกุหลาบ', '#e98aa6'],
    ['cherry', 'แดงเชอร์รี', '#cf3440'], ['tangerine', 'ส้ม', '#ee7d2c'], ['gold', 'ทอง', '#efbe45'], ['mint', 'มิ้นต์', '#7fd3ae'],
    ['green', 'เขียว', '#3f9a50'], ['teal', 'เขียวหัวเป็ด', '#1f8e8c'], ['sky', 'ฟ้า', '#65b2ea'], ['navy', 'น้ำเงินเข้ม', '#2f4c9c'],
    ['lilac', 'ม่วงไลแลค', '#b79fe8'], ['purple', 'ม่วง', '#7744b4'], ['brown', 'น้ำตาล', '#875735'], ['silver', 'เงิน', '#b7bdca']];
  const SLOTS = [ // [key, Thai name, the worn piece, price per area]
    ['outfit', 'ชุด', (e) => e.robe || e.top, 120000], ['hat', 'หมวก', (e) => e.hat, 80000],
    ['frobe', 'ชุดแฟชั่น', (e) => e.frobe, 120000], ['fhat', 'หมวกแฟชั่น', (e) => e.fhat, 80000]];
  const AREAS = [['a', 'สีหลัก'], ['b', 'สีรอง']];

  // ======================= colour maths =======================
  function hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [0, 0, l];
    const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    const h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  }
  function rgb(h, s, l) {
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }
  const hexHsl = (hx) => hsl(parseInt(hx.slice(1, 3), 16), parseInt(hx.slice(3, 5), 16), parseInt(hx.slice(5, 7), 16));
  const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
  // pixels that are never dyed: the outline (very dark) and the hero's skin (base skin 252,212,172 and its shades: red
  // well above green, green well above blue; the cream of a tunic has a smaller red-green gap)
  const isLine = (l) => l < 0.17;
  const isSkin = (r, g, b) => r >= 190 && r - g >= 32 && r - g <= 54 && r - b >= 70 && r - b <= 96;

  // ======================= what a piece is drawn with =======================
  const SKIP = /_(vein|bloom|glow|kc_vein)$/;
  const prefixCache = new Map();
  function namesWith(prefix) {
    if (prefixCache.has(prefix)) return prefixCache.get(prefix);
    const out = Object.keys(NC.SPR || {}).filter((k) => k.startsWith(prefix) && !SKIP.test(k));
    if (out.length) prefixCache.set(prefix, out);
    return out;
  }
  // the pictures of a dyed piece: a hat by its sprite name, an outfit by its rig (and the trousers' legs under a top)
  function namesOf(id, pantsId) {
    const it = ITEMS[id];
    if (!it) return [];
    if (it.slot === 'hat') return it.sprite ? namesWith(it.sprite) : [];
    const out = [];
    if (it.rig) out.push(...namesWith('rig_' + it.rig + '_'), ...namesWith('legs_' + it.rig + '_'));
    const pa = pantsId && ITEMS[pantsId];
    if (pa && pa.rig && pa.rig !== it.rig) out.push(...namesWith('rig_' + pa.rig + '_leg'), ...namesWith('legs_' + pa.rig + '_'));
    return out;
  }
  function pixelsOf(name) {
    const s = NC.SPR[name], im = s && s.img;
    if (!im || !(im.naturalWidth || im.width) || (im.complete === false)) return null;
    const c = document.createElement('canvas'); c.width = im.naturalWidth || im.width; c.height = im.naturalHeight || im.height;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    try { return x.getImageData(0, 0, c.width, c.height); } catch (e) { return null; }
  }

  // ======================= a piece's two dye areas =======================
  // the colour groups of all its pictures: 36 hue bins of the coloured pixels and one group of the light neutrals; the
  // biggest group is the main area, the next one far enough from it the second
  const profiles = new Map();
  function profile(key, names) {
    if (profiles.has(key)) return profiles.get(key);
    const bins = new Float64Array(36);
    let neu = 0;
    const datas = [];
    for (const n of names) { const d = pixelsOf(n); if (!d) return null; datas.push(d); }
    for (const D of datas) {
      const p = D.data;
      for (let i = 0; i < p.length; i += 4) {
        if (p[i + 3] < 128) continue;
        const [h, s, l] = hsl(p[i], p[i + 1], p[i + 2]);
        if (isLine(l) || isSkin(p[i], p[i + 1], p[i + 2])) continue;
        if (s >= 0.16) { if (l < 0.95) bins[Math.floor(h / 10) % 36]++; } else if (l > 0.28 && l < 0.98) neu++;
      }
    }
    const win = (c) => { let t = 0; for (let k = -2; k <= 2; k++) t += bins[(c + k + 36) % 36]; return t; };
    const groups = [];
    for (let c = 0; c < 36; c++) groups.push({ mode: 'hue', c, n: win(c) });
    groups.sort((u, v) => v.n - u.n);
    const pick = [];
    const neuG = { mode: 'neu', n: neu * 0.9 };
    const cand = [neuG].concat(groups).sort((u, v) => v.n - u.n);
    for (const g of cand) {
      if (pick.length === 2 || g.n < 30) break;
      if (g.mode === 'hue' && pick.some((q) => q.mode === 'hue' && hueDist(q.c * 10 + 5, g.c * 10 + 5) < 50)) continue;
      if (g.mode === 'neu' && pick.some((q) => q.mode === 'neu')) continue;
      pick.push(g);
    }
    const areas = pick.map((g) => {
      // the area's centre hue (a weighted mean round the peak)
      let hs = 0, hc = 0;
      if (g.mode === 'hue') for (let k = -2; k <= 2; k++) { const b = (g.c + k + 36) % 36, a = (b * 10 + 5) * Math.PI / 180; hs += Math.sin(a) * bins[b]; hc += Math.cos(a) * bins[b]; }
      return { mode: g.mode, h0: g.mode === 'hue' ? ((Math.atan2(hs, hc) * 180) / Math.PI + 360) % 360 : 0, sMin: 0.13, L: 0, S: 0, n: 0, rgb: [0, 0, 0] };
    });
    // a hue area holds only colours about as strong as its own: a red tabard, not the brown leather of the same hue
    // (2026-10-12: the knight's belt turned green with his red cloth); then its mean lightness, strength and colour
    const pass = () => {
      for (const A of areas) { A.L = A.S = A.n = 0; A.rgb = [0, 0, 0]; }
      for (const D of datas) {
        const p = D.data;
        for (let i = 0; i < p.length; i += 4) {
          if (p[i + 3] < 128) continue;
          const A = areaOf(areas, p[i], p[i + 1], p[i + 2]);
          if (!A) continue;
          const [, s, l] = hsl(p[i], p[i + 1], p[i + 2]);
          A.L += l; A.S += s; A.n++; A.rgb[0] += p[i]; A.rgb[1] += p[i + 1]; A.rgb[2] += p[i + 2];
        }
      }
      for (const A of areas) if (A.n) { A.L /= A.n; A.S /= A.n; A.rgb = A.rgb.map((v) => Math.round(v / A.n)); }
    };
    pass();
    for (const A of areas) if (A.mode === 'hue' && A.n) A.sMin = Math.max(0.13, A.S * 0.6);
    pass();
    const P = { areas };
    profiles.set(key, P);
    return P;
  }
  function areaOf(areas, r, g, b) {
    const [h, s, l] = hsl(r, g, b);
    if (isLine(l) || isSkin(r, g, b)) return null;
    for (const A of areas) {
      if (A.mode === 'hue' ? s >= A.sMin && l > 0.12 && l < 0.96 && hueDist(h, A.h0) <= 24 : s < 0.16 && l > 0.25 && l < 0.985) return A;
    }
    return null;
  }

  // ======================= recoloured pictures =======================
  // (2026-10-12, the user: "บางอันย้อมสีไม่เนียน": a hard yes/no per pixel left specks of dye on the scarf next to the
  // trousers, a noisy fringe round the leopard's tail and patchy night-falcon plates.) Now each pixel has a soft weight:
  // how close its hue, strength and lightness are to the area's, and how opaque it is (the half-clear edge pixels carry
  // noisy colours); the weight map is then smoothed twice (lone specks fade out, small holes in the cloth fill in) and
  // sharpened back, and the dyed colour is mixed over the original by that weight.
  const ramp = (x, a, b) => (x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a));
  function weightOf(A, r, g, b, al) {
    const [h, s, l] = hsl(r, g, b);
    if (isSkin(r, g, b)) return 0;
    const aw = ramp(al, 90, 210), lw = ramp(l, 0.13, 0.21);
    if (A.mode === 'neu') return aw * lw * (1 - ramp(s, 0.12, 0.22)) * ramp(l, 0.22, 0.3) * (1 - ramp(l, 0.985, 1.01));
    // (and about as light as the area: dark brown leather is not the cream fur of the same hue)
    return aw * lw * (1 - ramp(hueDist(h, A.h0), 16, 30)) * ramp(s, A.sMin * 0.5, A.sMin) * (1 - ramp(l, 0.95, 0.99)) * (1 - ramp(Math.abs(l - A.L), 0.3, 0.42));
  }
  function smooth(W, w, h, solid) {
    const out = new Float32Array(W.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!solid[i]) continue;
      let t = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const j = Y * w + X;
        if (!solid[j]) continue;
        t += W[j]; n++;
      }
      out[i] = n ? t / n : 0;
    }
    return out;
  }
  const dyedCache = new Map();
  function dyedImg(s, key, P, dye) {
    const ck = s.name + '|' + key + '|' + JSON.stringify(dye);
    if (dyedCache.has(ck)) return dyedCache.get(ck);
    const D = pixelsOf(s.name);
    if (!D) return s.img;
    const p = D.data, w = D.width, h = D.height, N = w * h;
    // pixels a weight may spread over: opaque enough, not the outline, not skin
    const solid = new Uint8Array(N);
    for (let i = 0, k = 0; k < N; i += 4, k++) {
      if (p[i + 3] < 40) continue;
      const l = (Math.max(p[i], p[i + 1], p[i + 2]) + Math.min(p[i], p[i + 1], p[i + 2])) / 510;
      solid[k] = l >= 0.13 && !isSkin(p[i], p[i + 1], p[i + 2]) ? 1 : 0;
    }
    // the pieces the outline closes off (a sleeve, a wrap, a plate): one dye decision per piece, so a piece is dyed whole
    // or left whole, never in blotches (a bandage on the leopard's ankle came out half red)
    const reg = new Int32Array(N).fill(-1), sizes = [];
    for (let q0 = 0; q0 < N; q0++) {
      if (!solid[q0] || reg[q0] >= 0) continue;
      const id = sizes.length, st = [q0];
      reg[q0] = id; let n = 0;
      while (st.length) {
        const q = st.pop(); n++;
        const x = q % w, y = (q - x) / w;
        if (x > 0 && solid[q - 1] && reg[q - 1] < 0) { reg[q - 1] = id; st.push(q - 1); }
        if (x < w - 1 && solid[q + 1] && reg[q + 1] < 0) { reg[q + 1] = id; st.push(q + 1); }
        if (y > 0 && solid[q - w] && reg[q - w] < 0) { reg[q - w] = id; st.push(q - w); }
        if (y < h - 1 && solid[q + w] && reg[q + w] < 0) { reg[q + w] = id; st.push(q + w); }
      }
      sizes.push(n);
    }
    const jobs = [];
    AREAS.forEach(([k], ai) => {
      const d = dye[k], A = P.areas[ai];
      if (!d || !A) return;
      let W = new Float32Array(N);
      for (let i = 0, q = 0; q < N; i += 4, q++) if (solid[q]) W[q] = weightOf(A, p[i], p[i + 1], p[i + 2], p[i + 3]);
      // per piece: how much of it is this area's colour. Enough (40%) → its in-colour pixels fully dyed (other colours inside
      // it, like gold trim on a robe, keep their own low weight); less → nothing in it is dyed (no half-dyed blotches)
      const cnt = new Float32Array(sizes.length), sum = new Float32Array(sizes.length);
      for (let q = 0; q < N; q++) if (reg[q] >= 0 && W[q] > 0.05) { cnt[reg[q]]++; sum[reg[q]] += W[q]; }
      for (let q = 0; q < N; q++) {
        const r = reg[q];
        if (r < 0) continue;
        const frac = cnt[r] / sizes[r], mean = cnt[r] ? sum[r] / cnt[r] : 0;
        if (frac >= 0.4 && mean >= 0.35) { if (W[q] > 0.05) W[q] = 1; }
        else W[q] = 0;
      }
      W = smooth(smooth(W, w, h, solid), w, h, solid);
      for (let q = 0; q < N; q++) W[q] = ramp(W[q], 0.14, 0.8);
      jobs.push({ A, W, t: hexHsl(COLORS[d[0]][2]), br: d[1] || 0 });
    });
    for (let i = 0, q = 0; q < N; i += 4, q++) {
      let J = null, wt = 0;
      for (const j of jobs) if (j.W[q] > wt) { wt = j.W[q]; J = j; }
      if (!J || wt < 0.01) continue;
      const A = J.A, [, s0, l] = hsl(p[i], p[i + 1], p[i + 2]), [ht, st, lt] = J.t;
      // lightness: most of the way to the dye's own, the piece's shading kept (a pale dye on dark cloth stays rich)
      const nl = Math.max(0.05, Math.min(0.97, A.L + (lt - A.L) * 0.7 + J.br * 0.07 + (l - A.L) * 0.95));
      const ns = A.mode === 'neu' ? st : Math.max(0, Math.min(1, st * Math.max(0.55, Math.min(1.35, s0 / (A.S || 0.5)))));
      const [r, g, b] = rgb(ht, ns, nl);
      p[i] = Math.round(p[i] + (r - p[i]) * wt); p[i + 1] = Math.round(p[i + 1] + (g - p[i + 1]) * wt); p[i + 2] = Math.round(p[i + 2] + (b - p[i + 2]) * wt);
    }
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').putImageData(D, 0, 0);
    if (dyedCache.size > 600) dyedCache.clear();
    dyedCache.set(ck, c);
    return c;
  }

  // ======================= whose dyes, while a hero is drawn =======================
  const REMOTE = new WeakMap(); // the others' equip objects -> their dyes (from presence)
  let PREVIEW = null, ACTIVE = null;
  // the player: their own equip, a copy this file made of it (the stage), a costume copy of it (NC.lookEquip), or anyone
  // in the creator's own head 'hair_look' (only the player wears it; the others online wear hair_lk-...)
  const MINE = new WeakSet();
  const mineOf = (equip) => { const g = G(), p = g && g.player; return !!p && (equip === p.equip || MINE.has(equip) || equip.hair === 'hair_look'); };
  if (NC.lookEquip) {
    const baseLook = NC.lookEquip;
    NC.lookEquip = function (equip) { const r = baseLook.apply(this, arguments); const g = G(); if (r && r !== equip && g && g.player && (equip === g.player.equip || MINE.has(equip))) MINE.add(r); return r; };
  }
  function dyesFor(equip) {
    if (!equip) return null;
    if (mineOf(equip)) { const g = G(); return PREVIEW || (g && g.player && g.player.dyes) || null; }
    return REMOTE.get(equip) || null;
  }
  // sprite name -> { key, P, dye } for the pieces this hero is drawn in (the fashion layer over the gear)
  const mapCache = new Map();
  function mapFor(equip, dyes) {
    const hat = equip.fhat || equip.hat, body = equip.frobe || equip.robe || equip.top, pants = equip.frobe || equip.robe ? null : equip.pants;
    const ck = [hat, body, pants, JSON.stringify(dyes[hat] || 0), JSON.stringify(dyes[body] || 0)].join('|');
    if (mapCache.has(ck)) return mapCache.get(ck);
    const M = new Map();
    let ok = true;
    for (const [id, pid] of [[hat, null], [body, pants]]) {
      const dye = id && dyes[id];
      if (!dye || (!dye.a && !dye.b)) continue;
      const names = namesOf(id, pid), key = id + '+' + (pid || '');
      const P = names.length && profile(key, names);
      if (!P) { ok = false; continue; }
      for (const n of names) M.set(n, { key, P, dye });
    }
    if (ok) { if (mapCache.size > 200) mapCache.clear(); mapCache.set(ck, M); }
    return M;
  }
  NC.dyePic = (s) => {
    if (!ACTIVE || !s) return s && s.img;
    const r = ACTIVE.get(s.name);
    return r ? dyedImg(s, r.key, r.P, r.dye) : s.img;
  };
  const baseHero = NC.drawHero;
  NC.drawHero = function (ctx, equip) {
    const d = dyesFor(equip);
    if (!d || !Object.keys(d).length) return baseHero.apply(this, arguments);
    const was = ACTIVE;
    ACTIVE = mapFor(equip, d);
    try { return baseHero.apply(this, arguments); } finally { ACTIVE = was; }
  };

  // ======================= saving, online =======================
  function clean(d) {
    const out = {};
    for (const id in d || {}) {
      if (!ITEMS[id] || !d[id]) continue;
      const e = {};
      for (const [k] of AREAS) { const v = d[id][k]; if (Array.isArray(v) && COLORS[v[0] | 0]) e[k] = [v[0] | 0, Math.max(-3, Math.min(3, v[1] | 0))]; }
      if (e.a || e.b) out[id] = e;
    }
    return out;
  }
  function save(game) {
    if (!game || game.noSave) return;
    try { localStorage.setItem(KEY, JSON.stringify({ v: 1, d: game.player.dyes || {} })); } catch (e) { /* storage blocked */ }
  }
  function load(game) {
    const p = game && game.player;
    if (!p || p.dyes) return;
    p.dyes = {};
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.d) p.dyes = clean(s.d); } catch (e) { /* a bad save: no dyes */ }
  }
  if (NC.Net) {
    // my worn dyes: [[id, a colour, a bright, b colour, b bright], ...] (-1 = that area not dyed)
    NC.Net.fields.push({ key: 'dy', get: () => {
      const g = G(), p = g && g.player;
      if (!p || !p.dyes) return null;
      const e = p.equip, out = [];
      for (const id of new Set([e.robe || e.top, e.hat, e.frobe, e.fhat])) {
        const d = id && p.dyes[id];
        if (d) out.push([id, d.a ? d.a[0] : -1, d.a ? d.a[1] : 0, d.b ? d.b[0] : -1, d.b ? d.b[1] : 0]);
      }
      return out.length ? out : null;
    } });
    NC.Net.hooks.push((r, pr) => {
      if (!r.equip) return;
      const list = Array.isArray(pr.dy) ? pr.dy : [], d = {};
      for (const x of list) if (Array.isArray(x) && typeof x[0] === 'string') d[x[0]] = { a: x[1] >= 0 ? [x[1], x[2]] : null, b: x[3] >= 0 ? [x[3], x[4]] : null };
      const c = clean(d);
      if (Object.keys(c).length) REMOTE.set(r.equip, c); else REMOTE.delete(r.equip);
    });
  }

  // ======================= the window (mockup A) =======================
  let win = null, raf = 0, slot = 'outfit', area = 'a', pickC = null, pickB = 0, compare = false, face = 1, fromBag = false;
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const icon = (id) => { try { return NC.itemIcon(id, 96).toDataURL(); } catch (e) { return ''; } };
  const coinImg = () => (NC.matIcon ? NC.matIcon('ic_coin') : '');
  const slotDef = (k) => SLOTS.find((s) => s[0] === k);
  const wornId = (k) => { const g = G(); return g && g.player ? slotDef(k)[2](g.player.equip) : null; };
  function build() {
    win = document.createElement('div');
    win.id = 'dye'; win.className = 'panel iv-panel dy-panel'; win.hidden = true;
    win.innerHTML = '<div class="iv-wrap"><section class="iv-win dy-win">' +
      `<header class="iv-title"><span>ย้อมสี</span><span class="dy-coins"><img src="${coinImg()}" alt=""><b id="dy-coins">0</b></span>` +
      '<button class="iv-x" id="dy-close" aria-label="ปิด">✕</button></header>' +
      '<div class="dy-body"><div class="dy-slots" id="dy-slots"></div>' +
      '<div class="dy-stage"><canvas id="dy-hero"></canvas><button class="dy-rot L" data-rot="-1" aria-label="หมุน">◀</button>' +
      '<button class="dy-rot R" data-rot="1" aria-label="หมุน">▶</button><div class="dy-tag" id="dy-tag"></div></div>' +
      '<div class="dy-side"><div class="dy-areas" id="dy-areas"></div><div class="dy-pal" id="dy-pal"></div>' +
      '<div class="dy-bright"><span>ความสว่าง</span><button class="dy-pm" data-b="-1">−</button><input type="range" min="-3" max="3" step="1" id="dy-b">' +
      '<button class="dy-pm" data-b="1">+</button></div>' +
      `<div class="dy-cost" id="dy-cost"></div>` +
      '<div class="dy-acts"><button class="iv-btn blue" id="dy-prev">ดูตัวอย่าง</button><button class="iv-btn gold" id="dy-do">ย้อม</button></div>' +
      '<div class="dy-acts"><button class="iv-btn grey" id="dy-wash">ล้างสี</button></div></div></div>' +
      '<div class="dy-foot">เปลี่ยนแค่หน้าตา · ไม่มีค่าพลัง · เพื่อนออนไลน์เห็นสีนี้ด้วย</div></section></div>';
    document.body.appendChild(win);   // (like the bag: above the HUD, the minimap included)
    $('dy-close').addEventListener('click', close);
    win.addEventListener('click', (e) => {
      const t = e.target;
      const s = t.closest('[data-slot]'); if (s && !s.disabled) { slot = s.dataset.slot; area = 'a'; seed(); render(); return; }
      const a = t.closest('[data-area]'); if (a) { area = a.dataset.area; seed(); render(); return; }
      const c = t.closest('[data-c]'); if (c) { pickC = c.dataset.c === 'orig' ? null : +c.dataset.c; compare = false; render(); return; }
      const pm = t.closest('[data-b]'); if (pm) { pickB = Math.max(-3, Math.min(3, pickB + +pm.dataset.b)); render(); return; }
      const r = t.closest('[data-rot]'); if (r) { face = -face; return; }
      if (t.closest('#dy-prev')) { compare = !compare; render(); return; }
      if (t.closest('#dy-do')) { apply(); return; }
      if (t.closest('#dy-wash')) { wash(); }
    });
    $('dy-b').addEventListener('input', (e) => { pickB = +e.target.value; render(); });
    addEventListener('keydown', (e) => {
      if (e.code !== 'Escape' || !win || win.hidden) return;
      e.stopImmediatePropagation(); e.preventDefault(); close();
    }, true);
  }
  // the picker starts on what the area is dyed now
  function seed() {
    const g = G(), id = wornId(slot), d = id && g.player.dyes[id] && g.player.dyes[id][area];
    pickC = d ? d[0] : null; pickB = d ? d[1] : 0; compare = false;
  }
  function areasOf(id) {
    const g = G(), e = g.player.equip, pid = slot === 'outfit' && !e.robe ? e.pants : null;
    const names = namesOf(id, pid);
    return names.length ? profile(id + '+' + (pid || ''), names) : null;
  }
  function render() {
    const g = G(), p = g.player, id = wornId(slot), S = slotDef(slot);
    if (!$('dy-coins')) return;
    $('dy-coins').textContent = fmt(p.coins || 0);
    $('dy-slots').innerHTML = SLOTS.map(([k, name]) => {
      const w = wornId(k);
      return `<button class="dy-slot${k === slot ? ' on' : ''}${w ? '' : ' empty'}" data-slot="${k}" ${w ? '' : 'disabled'}>` +
        (w ? `<img src="${icon(w)}" alt="">` : '<i class="dy-none"></i>') + `<span>${name}</span>${w && p.dyes[w] ? '<em class="dy-dot"></em>' : ''}</button>`;
    }).join('');
    const P = id && areasOf(id), now = id && p.dyes[id];
    $('dy-areas').innerHTML = AREAS.map(([k, name], i) => {
      const A = P && P.areas[i], d = now && now[k];
      const sw = d ? COLORS[d[0]][2] : A ? `rgb(${A.rgb.join(',')})` : '#ccc';
      return `<button class="dy-area${k === area ? ' on' : ''}" data-area="${k}" ${A ? '' : 'disabled'}><i style="background:${sw}"></i>${name}</button>`;
    }).join('');
    $('dy-pal').innerHTML = `<button class="dy-sw orig${pickC === null ? ' on' : ''}" data-c="orig" title="สีเดิม"><i></i><span>สีเดิม</span></button>` +
      COLORS.map(([, name, hx], i) => `<button class="dy-sw${pickC === i ? ' on' : ''}" data-c="${i}" title="${name}"><i style="background:${hx}"></i></button>`).join('');
    $('dy-b').value = pickB; $('dy-b').disabled = pickC === null;
    const same = now && now[area] ? pickC === now[area][0] && pickB === now[area][1] : pickC === null;
    const price = S[3], can = !!id && pickC !== null && !same && (p.coins || 0) >= price;
    $('dy-cost').innerHTML = `<img src="${coinImg()}" alt="">ย้อม${S[1]} (${AREAS.find((a) => a[0] === area)[1]}): <b>${fmt(price)}</b> เหรียญ`;
    $('dy-cost').classList.toggle('short', !!id && pickC !== null && (p.coins || 0) < price);
    $('dy-do').disabled = !can;
    $('dy-wash').disabled = !(now && now[area]);
    $('dy-prev').textContent = compare ? 'ดูสีใหม่' : 'ดูสีเดิม';
    $('dy-prev').disabled = pickC === null || same;
    $('dy-tag').textContent = !id ? 'ไม่ได้สวม' + S[1] : compare ? 'สีเดิม' : pickC === null ? 'สีเดิม' : COLORS[pickC][1];
  }
  // what the stage shows: the dyes as they are, with the area being picked in the picked colour
  function previewDyes() {
    const g = G(), p = g.player, id = wornId(slot), out = JSON.parse(JSON.stringify(p.dyes || {}));
    if (!id || compare) return out;   // ("ดูสีเดิม": the piece as it is now)
    out[id] = out[id] || {};
    if (pickC === null) delete out[id][area]; else out[id][area] = [pickC, pickB];
    return out;
  }
  function drawStage() {
    const g = G(), cv = $('dy-hero');
    if (!cv || !g || !g.player) return;
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const c = cv.getContext('2d'), p = g.player, k = H / 230, fx = W / 2, fy = H * 0.765;   // (the feet on the pedestal of assets/ui/dye_stage.jpg)
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
    // the gear slots show the gear (no costume over it), the fashion slots the costume
    const eq = Object.assign({}, p.equip);
    MINE.add(eq);
    if (slot === 'outfit' || slot === 'hat') { eq.fhat = null; eq.frobe = null; }
    PREVIEW = previewDyes();
    try {
      c.save(); c.translate(fx, 0); c.scale(face, 1); c.translate(-fx, 0);
      NC.drawAvatar(c, eq, fx, fy, k, 1, { t: performance.now() / 1000, idle: NC.Anim.movesFor ? NC.Anim.movesFor(p.moves, ITEMS[p.equip.weapon]).idle : 'idle' });
      c.restore();
    } finally { PREVIEW = null; }
  }
  function loop() {
    raf = 0;
    if (!win || win.hidden) return;
    drawStage();
    const g = G(), el = $('dy-coins'), t = fmt((g && g.player && g.player.coins) || 0);
    if (el && el.textContent !== t) render();   // (coins that came in while the window is open)
    raf = requestAnimationFrame(loop);
  }
  function apply() {
    const g = G(), p = g.player, id = wornId(slot), price = slotDef(slot)[3];
    if (!id || pickC === null || (p.coins || 0) < price) return;
    p.coins -= price;
    if (NC.Econ && NC.Econ.sink) NC.Econ.sink('dye', price);
    p.dyes[id] = Object.assign({}, p.dyes[id], { [area]: [pickC, pickB] });
    save(g);
    if (g.toast) g.toast(`ย้อม${slotDef(slot)[1]}เป็นสี${COLORS[pickC][1]}แล้ว`);
    compare = false; render();
  }
  function wash() {
    const g = G(), p = g.player, id = wornId(slot);
    if (!id || !p.dyes[id] || !p.dyes[id][area]) return;
    delete p.dyes[id][area];
    if (!p.dyes[id].a && !p.dyes[id].b) delete p.dyes[id];
    save(g);
    if (g.toast) g.toast('ล้างสีแล้ว กลับเป็นสีเดิม');
    seed(); render();
  }
  function open(want) {
    const g = G();
    if (!g || !g.player) return;
    load(g);
    if (!win) build();
    fromBag = !!(document.getElementById('inv') && !document.getElementById('inv').hidden);
    if (NC.HUD && NC.HUD.panel) NC.HUD.panel('pause', false);
    slot = want && slotDef(want) ? want : SLOTS.find(([k]) => wornId(k)) ? SLOTS.find(([k]) => wornId(k))[0] : 'outfit';
    area = 'a'; face = 1; seed();
    win.hidden = false; g.paused = true;
    render();
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function close() {
    const g = G();
    if (!win || win.hidden) return;
    win.hidden = true; PREVIEW = null;
    if (g) g.paused = false;
    if (fromBag && NC.HUD && NC.HUD.panel && g) g.paused = NC.HUD.panel('bag', true);
  }

  NC.Dye = { open, close, COLORS, SLOTS, profile: (id) => areasOf(id), clean, get: () => (G() && G().player && G().player.dyes) || null };
  // load the save when the hero exists
  const baseUpdate = NC.updatePlayer;
  if (baseUpdate) NC.updatePlayer = function (game) { if (game && game.player && !game.player.dyes) load(game); return baseUpdate.apply(this, arguments); };
})();
