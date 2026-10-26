/* look.js — the hero's own face and hair, made in the character creator (js/creator.js).
   The head is put together from layers (assets/look/, cut by tools/lookcut.py, all in one head frame at 6 px per game
   unit): back (the hair behind the head) -> head (our bald head, or the head drawn with that hairstyle on it) -> eyes
   -> mouth -> front (the hair over the eyes' area, so bangs cover the brows). Hair and eyes are recoloured from the
   navy art by lightness. The result is a head sprite like any other hairstyle's (neck joint, hat box), with two
   extra pictures: .under (the back hair: avatar.js draws it behind the body, so long hair and tails hang behind it)
   and .over (the rest: drawn where the head goes).
   The item: hair_look ("ทรงผมของฉัน"), its sprite head_look is my look (saved as nightcamp.look.v1). Other players' looks
   travel as a presence field (net.js) and become items of their own: hair_lk-<gender>-<hair>-<hair colour>-<eyes>-
   <eye colour>-<mouth>. Load after fashion.js, before items.js (items.js adds NC.LOOK.items). */
(function () {
  'use strict';
  const NC = window.NC;
  const FR = NC.LOOK_FRAME;
  if (!FR) return;
  if (NC.ASSET_MANIFEST_LOOK) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_LOOK);
  const PX = FR.scale; // px per game unit
  const KEY = 'nightcamp.look.v1', PREFIX = 'hair_lk-';

  // ---------------- the choices ----------------
  const HAIRS = {
    m: [['spiky', 'ผมฟูชี้'], ['neat', 'ผมสั้นแสกข้าง'], ['shaggy', 'ผมยุ่งปรกหน้า'], ['flame', 'ผมตั้งชี้'], ['curly', 'ผมหยิกฟู'],
      ['topknot', 'ผมมัดจุก'], ['buzz', 'ผมเกรียน']],
    f: [['bob', 'ผมบ๊อบ'], ['long', 'ผมยาวตรง'], ['pony', 'ผมหางม้า'], ['twin', 'ผมแกละสองข้าง'], ['bun', 'ผมมวยสูง'], ['wavy', 'ผมยาวลอน']],
  };
  // premium hairstyles (boys, for now): dramatic anime-hero hair, each with its own colour (put on when it is picked)
  const PREMIUM = {
    m: [['snow', 'ขาวไร้ขีดจำกัด', 'white'], ['oneeye', 'ผมปิดตาปีศาจ', 'black'], ['twotone', 'สองสีโลหิต', 'navy'],
      ['wolf', 'หมาป่าจันทรา', 'silver'], ['ronin', 'ซามูไรพเนจร', 'black'], ['slick', 'เสยราชันย์', 'blonde'],
      ['braid', 'เปียจอมเวท', 'purple'], ['demon', 'เขาจอมมาร', 'black'],
      ['mop', 'ผมฟูนุ่มสีเงิน', 'silver'], // (2026-10-12, the user's picture: make_creator2_prompts.py)
      ['shade', 'ผมยุ่งปรกตาหางเล็ก', 'black'], // (the boy of the user's clip, same day)
      ['neatbob', 'หน้าม้าหนาหน้าเรียว', 'black'], // (the same boy from the user's 2nd picture: his hair AND a slimmer V jaw + beauty mark)
      // (2026-10-12, "ทรงผมเท่ๆ แบบเสยผม เนี้ยบๆ หรือแบบพวกทรงผมในอนิเมะ": make_creator3_prompts.py, sheets p8b-p11b)
      ['slickback', 'เสยเนี้ยบ', 'black'], ['slickfall', 'เสยปอยตก', 'silver'], ['curtain', 'แสกกลางม่านหน้า', 'brown'],
      ['twoblock', 'ปัดข้างทูบล็อก', 'tealhl'], ['spikeback', 'ชี้หลังโชเน็น', 'blonde'], ['sidelocks', 'ปอยข้างพระเอก', 'white'],
      ['highpony', 'หางม้าสูงนักดาบ', 'purple'], ['wavyperm', 'หยักศกฟูยุ่ง', 'redhl']],
    f: [['mintwave', 'ผมยาวปลายมิ้นต์', 'blonde']], // (the girl of the user's clip: mint ends, bun + bow, braid, skull clip)
  };
  const EYES = {
    m: [['round', 'ตากลมโต'], ['sharp', 'ตาคม'], ['bright', 'ตาเป็นประกาย'], ['sleepy', 'ตาง่วง'], ['fierce', 'ตาดุ'], ['happy', 'ตายิ้ม'],
      ['scar', 'ตามีแผล'], ['gloss', 'ตาฉ่ำวาว'], ['wink', 'ขยิบตา'], ['deadpan', 'ตาเบื่อโลก'], ['liner', 'ตาอายไลเนอร์'], ['calm', 'ตานิ่งวงแหวน'], ['haughty', 'ตาหยิ่ง']],
    f: [['sweet', 'ตาหวาน'], ['sparkle', 'ตาวิบวับ'], ['cat', 'ตาแมว'], ['gentle', 'ตาอ่อนโยน'], ['happyf', 'ตายิ้มหวาน'], ['round', 'ตากลมโต'], ['gloss', 'ตาฉ่ำวาว'], ['wink', 'ขยิบตา'],
      ['liner', 'ตาอายไลเนอร์'], ['teary', 'ตาเคืองน้ำตาคลอ'], ['deadpan', 'ตาเบื่อโลก'], ['calm', 'ตานิ่งวงแหวน'], ['haughty', 'ตาหยิ่ง']],
  };
  const MOUTHS = [['neutral', 'เฉยๆ'], ['smile', 'ยิ้ม'], ['lips', 'ยิ้มหวาน'], ['grin', 'ยิ้มกว้าง'], ['laugh', 'หัวเราะ'], ['cat', 'ปากแมว'],
    ['fang', 'เขี้ยวน้อย'], ['tongue', 'แลบลิ้น'], ['smirk', 'ยิ้มมุมปาก'], ['o', 'ปากโอ'], ['pout', 'ปากงอ'], ['wavy', 'ปากหยัก'],
    ['soft', 'ยิ้มบาง'], ['cheer', 'ยิ้มร่า'], ['flat', 'ปากเบื่อ'], ['smug', 'ยิ้มเจ้าเล่ห์'], ['hmph', 'ปากโวยวาย'],
    ['line', 'ปากขีดหยิ่ง'], ['slant', 'ปากขีดเอียง'], ['dash', 'ปากขีดสั้น']];
  // [id, name, colour ramp from the art's navy (hair: shadow, base, shine; eyes: dark, light), swatch]
  const HAIR_COLORS = [
    ['navy', 'กรมท่า', null, '#3d4266'], ['black', 'ดำ', ['#1b1a21', '#2b2932', '#57535f']],
    ['brown', 'น้ำตาล', ['#58392a', '#7c5439', '#b08a63']], ['red', 'แดง', ['#7a2a2a', '#b0443b', '#e2835f']],
    ['orange', 'ส้ม', ['#a4521f', '#dc7b33', '#ffb870']], ['blonde', 'ทอง', ['#b0843d', '#dfb25e', '#f9e2a0']],
    ['pink', 'ชมพู', ['#b0587c', '#e588aa', '#ffc6da']], ['blue', 'ฟ้า', ['#3b67a2', '#5a93d0', '#aad7f6']],
    ['mint', 'มิ้นต์', ['#3a8370', '#5cb696', '#afe8cf']], ['purple', 'ม่วง', ['#55407e', '#7b5fb4', '#b9a2e4']],
    ['silver', 'เงิน', ['#8c8da3', '#c1c3d3', '#f3f3f9']], ['white', 'ขาว', ['#a9b0c6', '#e3e7f1', '#ffffff']],
    // two-tone: the shine takes another colour, so the hair's shine marks read as dyed highlights (2026-10-12, the
    // user, for the neatbob hair: "ทำสีผมทรงนี้ด้วย ไฮไลท์ด้วย เลือกมาสักห้าสี"); the swatch shows both colours
    ...[['tealhl', 'ดำไฮไลต์เขียวหัวเป็ด', ['#14161b', '#23262d', '#4cc2b2']], ['redhl', 'ดำไฮไลต์แดง', ['#16131a', '#28212a', '#e0475a']],
      ['icehl', 'กรมท่าไฮไลต์ฟ้าน้ำแข็ง', ['#1a2240', '#2b3862', '#9fdcff']], ['goldhl', 'น้ำตาลไฮไลต์ทอง', ['#38221a', '#573628', '#f2c75c']],
      ['pinkhl', 'ม่วงเข้มไฮไลต์ชมพู', ['#28173a', '#43285c', '#f392c6']]]
      .map(([id, nm, r]) => [id, nm, r, 'linear-gradient(135deg, ' + r[1] + ' 0 58%, ' + r[2] + ' 58%)', true]),
  ];
  const EYE_COLORS = [
    ['navy', 'น้ำเงิน', null, '#3a5687'], ['brown', 'น้ำตาล', ['#45291a', '#a26e3e']], ['green', 'เขียว', ['#1b4630', '#58ad62']],
    ['gold', 'ทอง', ['#6b400c', '#eaab3c']], ['red', 'แดง', ['#621722', '#dd4650']], ['violet', 'ม่วง', ['#39225f', '#9866da']],
    ['cyan', 'ฟ้า', ['#155270', '#4cc2e8']], ['pink', 'ชมพู', ['#732450', '#ee7cb0']],
    ['sky', 'ฟ้าอ่อน', ['#3c6c9c', '#a9dcf7']],
  ];
  const DEFAULTS = {
    m: { g: 'm', hair: 'spiky', hc: 'navy', eyes: 'round', ec: 'navy', mouth: 'neutral' },
    f: { g: 'f', hair: 'bob', hc: 'navy', eyes: 'sweet', ec: 'navy', mouth: 'lips' },
  };
  const find = (list, id) => list.find((o) => o[0] === id);
  const allHairs = () => HAIRS.m.concat(HAIRS.f, PREMIUM.m, PREMIUM.f), allEyes = () => EYES.m.concat(EYES.f);
  const isPremium = (id) => PREMIUM.m.concat(PREMIUM.f).some((o) => o[0] === id);
  const swatch = (c) => c[3] || c[2][1];

  // a look from anywhere (a save, another player): only known ids, anything else falls back to the defaults
  function clean(o) {
    const g = o && o.g === 'f' ? 'f' : 'm', d = DEFAULTS[g], pick = (list, v, dv) => (find(list, v) ? v : dv);
    return {
      g, hair: pick(allHairs(), o && o.hair, d.hair), hc: pick(HAIR_COLORS, o && o.hc, d.hc), eyes: pick(allEyes(), o && o.eyes, d.eyes),
      ec: pick(EYE_COLORS, o && o.ec, d.ec), mouth: pick(MOUTHS, o && o.mouth, d.mouth),
    };
  }
  const keyOf = (L) => [L.g, L.hair, L.hc, L.eyes, L.ec, L.mouth].join('-');
  function parseKey(k) {
    if (typeof k !== 'string' || k.length > 80) return null;
    const p = k.split('-');
    if (p.length !== 6) return null;
    const L = { g: p[0], hair: p[1], hc: p[2], eyes: p[3], ec: p[4], mouth: p[5] };
    const c = clean(L);
    return keyOf(c) === k ? c : null; // (every part must be a real choice)
  }

  // ---------------- recolouring by lightness ----------------
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const luts = new Map();
  // 256 entries by lightness: the new colour and how much of it. Hair: the dark navy outline stays, the fill takes
  // the ramp (its shadow, base and shine at the art's navy lightnesses). Eyes: only the iris (between the dark lines
  // and the whites).
  function lut(kind, pal) {
    const key = kind + pal[0];
    if (luts.has(key)) return luts.get(key);
    const R = pal[2].map(hex), T = new Float32Array(256 * 4);
    for (let i = 0; i < 256; i++) {
      const L = i / 255;
      let c, w;
      if (kind === 'hair') {
        w = clamp01((L - 0.14) / 0.07);
        const t = clamp01((L - 0.2) / 0.24), t0 = 0.31;
        c = t < t0 ? mix(R[0], R[1], t / t0) : mix(R[1], R[2], (t - t0) / (1 - t0));
      } else {
        w = clamp01((L - 0.13) / 0.05) * clamp01((0.66 - L) / 0.1);
        c = mix(R[0], R[1], clamp01((L - 0.15) / 0.25));
      }
      T[i * 4] = c[0]; T[i * 4 + 1] = c[1]; T[i * 4 + 2] = c[2]; T[i * 4 + 3] = w;
    }
    luts.set(key, T);
    return T;
  }
  // a layer's pixels, read once: lightness, and whether a pixel is blue-violet (the navy hair, the irises; skin,
  // blush, whites, ribbons and hair ties are left alone)
  const pix = new Map();
  function pixels(name) {
    if (pix.has(name)) return pix.get(name);
    const s = NC.SPR[name];
    let P = null;
    try {
      const c = document.createElement('canvas');
      c.width = s.img.width; c.height = s.img.height;
      const g = c.getContext('2d');
      g.drawImage(s.img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data, n = c.width * c.height;
      const L = new Uint8Array(n), blue = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const j = i * 4, r = d[j], gg = d[j + 1], b = d[j + 2];
        if (!d[j + 3]) continue;
        const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
        L[i] = (mx + mn) >> 1;
        blue[i] = (b > r + 6 && b >= gg - 4) || (mx - mn < 14 && mx < 150) ? 1 : 0;
      }
      P = { w: c.width, h: c.height, d, L, blue };
    } catch (e) { P = null; } // (a picture that can't be read: shown in its own colours)
    pix.set(name, P);
    return P;
  }
  const recoloured = new Map(); // (a few dozen at most: the oldest go)
  function colored(name, kind, pal) {
    const s = NC.SPR[name];
    if (!s) return null;
    if (!kind || !pal || !pal[2]) return s.img;
    const key = name + '|' + pal[0];
    let c = recoloured.get(key);
    if (c) { recoloured.delete(key); recoloured.set(key, c); return c; }
    const P = pixels(name);
    if (!P) return s.img;
    const T = lut(kind, pal), out = new ImageData(P.w, P.h), o = out.data;
    o.set(P.d);
    for (let i = 0, n = P.w * P.h; i < n; i++) {
      if (!P.blue[i]) continue;
      const k = P.L[i] * 4, w = T[k + 3];
      if (w <= 0) continue;
      const j = i * 4;
      o[j] += (T[k] - o[j]) * w; o[j + 1] += (T[k + 1] - o[j + 1]) * w; o[j + 2] += (T[k + 2] - o[j + 2]) * w;
    }
    c = document.createElement('canvas');
    c.width = P.w; c.height = P.h;
    c.getContext('2d').putImageData(out, 0, 0);
    recoloured.set(key, c);
    if (recoloured.size > 48) recoloured.delete(recoloured.keys().next().value);
    return c;
  }

  // ---------------- putting a head together ----------------
  function layers(L) {
    const h = 'look_hair_' + L.hair;
    return {
      back: h + '_back', head: NC.SPR[h + '_head'] ? h + '_head' : 'look_base', eyes: 'look_eyes_' + L.eyes,
      mouth: 'look_mouth_' + L.mouth, front: h + '_front',
    };
  }
  const ready = () => !!NC.SPR.look_base;
  function bounds(names) {
    let x0 = FR.neck[0], y0 = FR.neck[1], x1 = x0 + 1, y1 = y0 + 1;
    for (const n of names) {
      const s = NC.SPR[n];
      if (!s) continue;
      x0 = Math.min(x0, s.at[0]); y0 = Math.min(y0, s.at[1]);
      x1 = Math.max(x1, s.at[0] + s.img.width); y1 = Math.max(y1, s.at[1] + s.img.height);
    }
    return { x0, y0, x1, y1 };
  }
  // hairstyles drawn with a bigger skull than look_base (their own head layer): the bob, the long straight hair and the
  // high bun came out 20-25% too big, so the head looked big while the eyes and mouth (shared layers) stayed the
  // usual size. Their hair layers are drawn smaller around the front of the chin (frame px), which keeps the face,
  // the chin and the neck where the shared eyes and mouth expect them (measured on the skin: look_base 273 px wide)
  const HAIR_FIT = { bob: 0.813, long: 0.752, bun: 0.803 }, FIT_PIVOT = [363, 367];
  // draw a look's layers onto g (frame px, the frame's origin at ox, oy); parts: which layers
  function paintLook(g, L, ox, oy, parts) {
    const Y = layers(L), hc = find(HAIR_COLORS, L.hc), ec = find(EYE_COLORS, L.ec);
    const kinds = { back: ['hair', hc], head: ['hair', hc], eyes: ['eyes', ec], mouth: [null, null], front: ['hair', hc] };
    const fit = HAIR_FIT[L.hair];
    for (const part of parts) {
      const n = Y[part], s = NC.SPR[n];
      if (!s) continue;
      if (fit && kinds[part][0] === 'hair') {
        const px = FIT_PIVOT[0] - ox, py = FIT_PIVOT[1] - oy;
        g.save(); g.translate(px, py); g.scale(fit, fit); g.translate(-px, -py);
        g.drawImage(colored(n, kinds[part][0], kinds[part][1]), s.at[0] - ox, s.at[1] - oy);
        g.restore();
      } else g.drawImage(colored(n, kinds[part][0], kinds[part][1]), s.at[0] - ox, s.at[1] - oy);
    }
  }
  // the head sprites of a look: NC.SPR[name] (the whole head) + name_u (the back hair) + name_o (the rest)
  function build(name, L, reuse) {
    const Y = layers(L), b = bounds([Y.back, Y.head, Y.eyes, Y.mouth, Y.front]);
    const W = Math.ceil(b.x1 - b.x0), H = Math.ceil(b.y1 - b.y0);
    const cv = (k) => { const c = (reuse && reuse[k]) || document.createElement('canvas'); c.width = W; c.height = H; return c; };
    const under = cv('under'), over = cv('over'), full = cv('full');
    paintLook(under.getContext('2d'), L, b.x0, b.y0, ['back']);
    paintLook(over.getContext('2d'), L, b.x0, b.y0, ['head', 'eyes', 'mouth', 'front']);
    const gf = full.getContext('2d');
    gf.drawImage(under, 0, 0); gf.drawImage(over, 0, 0);
    const size = { ax: 0, ay: 0, w: W / PX, h: H / PX }, hb = FR.hat_box;
    const U = (NC.SPR[name + '_u'] = Object.assign({ name: name + '_u', img: under }, size));
    const O = (NC.SPR[name + '_o'] = Object.assign({ name: name + '_o', img: over }, size));
    NC.SPR[name] = Object.assign({
      name, img: full, under: U, over: O, look: keyOf(L),
      joints: { neck: [(FR.neck[0] - b.x0) / PX, (FR.neck[1] - b.y0) / PX] },
      head: [(hb.centre_x - b.x0) / W, (hb.top_y - b.y0) / H, hb.width / W],
    }, size);
    return { under, over, full };
  }

  // ---------------- my look, other players' looks ----------------
  const hairName = (L) => (find(allHairs(), L.hair) || ['', 'ทรงผม'])[1];
  const items = {
    hair_look: { slot: 'hair', name: 'ทรงผมของฉัน', head: 'head_look', rarity: 'common', desc: 'หน้าตาที่สร้างเอง · แก้ได้ที่เมนู (ESC) > ปรับแต่งตัวละคร' },
  };
  let mine = null; // my look (null: never made one)
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.look) mine = clean(s.look); } catch (e) { mine = null; }
  }
  load();
  // head_look: my look, rebuilt in place. None until I make one: the item isn't "ready" then, so it is never a drop
  // or a piece still to collect
  function buildMine() {
    if (!ready() || !mine) return;
    const L = mine, s = NC.SPR.head_look;
    build('head_look', L, s && { under: NC.SPR.head_look_u.img, over: NC.SPR.head_look_o.img, full: s.img });
    items.hair_look.name = (isPremium(L.hair) ? '✦ ' : '') + hairName(L) + ' (ของฉัน)';
    items.hair_look.rarity = isPremium(L.hair) ? 'legend' : 'common';
  }
  function setMine(L, keep = true) {
    mine = clean(L);
    if (keep) { try { localStorage.setItem(KEY, JSON.stringify({ look: mine })); } catch (e) { /* storage blocked */ } }
    buildMine();
  }
  // another player's look (a presence field): an item of its own, made once
  function register(key) {
    const L = parseKey(key);
    if (!L || !ready()) return null;
    const id = PREFIX + key;
    if (NC.ITEMS[id]) return id;
    build('head_' + id.slice(5), L);
    NC.ITEMS[id] = { id, slot: 'hair', name: hairName(L), head: 'head_' + id.slice(5), rarity: isPremium(L.hair) ? 'legend' : 'common', desc: 'หน้าตาที่สร้างเอง' };
    return id;
  }

  // a preview head that is rebuilt in place (the creator's big preview): NC.ITEMS.hair_lk_preview
  function preview(L) {
    if (!ready()) return null;
    const s = NC.SPR.head_lkpreview;
    build('head_lkpreview', clean(L), s && { under: NC.SPR.head_lkpreview_u.img, over: NC.SPR.head_lkpreview_o.img, full: s.img });
    if (!NC.ITEMS.hair_lk_preview) NC.ITEMS.hair_lk_preview = { id: 'hair_lk_preview', slot: 'hair', name: 'ตัวอย่าง', head: 'head_lkpreview', rarity: 'common' };
    return 'hair_lk_preview';
  }

  // a picture of a look (the creator's buttons): part 'head' (the whole head), 'eyes' / 'mouth' (a close-up of the
  // face with no hair over it); drawn to fit canvas c
  function thumb(c, L, part) {
    L = clean(L);
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    if (!ready()) return;
    let box, parts;
    if (part === 'head') {
      const Y = layers(L), b = bounds([Y.back, Y.head, Y.eyes, Y.mouth, Y.front]);
      box = [b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0]; parts = ['back', 'head', 'eyes', 'mouth', 'front'];
    } else {
      const bare = Object.assign({}, L, { hair: 'spiky' }); // (our bald head: nothing covers the face)
      const Z = FR.eye_zone, m = FR.mouth_c;
      box = part === 'eyes' ? [Z[0] - 4, Z[1] - 6, Z[2] - Z[0] + 8, Z[3] - Z[1] + 12] : [m[0] - 42, m[1] - 26, 84, 60];
      L = bare; parts = ['head', 'eyes', 'mouth'];
    }
    const k = Math.min(c.width / box[2], c.height / box[3]) * (part === 'head' ? 0.94 : 1);
    const tmp = document.createElement('canvas');
    const B = part === 'head' ? box : [FR.neck[0] - 300, FR.neck[1] - 420, 600, 520];
    tmp.width = Math.ceil(B[2]); tmp.height = Math.ceil(B[3]);
    paintLook(tmp.getContext('2d'), L, B[0], B[1], parts);
    g.imageSmoothingQuality = 'high';
    g.drawImage(tmp, box[0] - B[0], box[1] - B[1], box[2], box[3], (c.width - box[2] * k) / 2, (c.height - box[3] * k) / 2, box[2] * k, box[3] * k);
  }

  function random(g) {
    const R = (a) => a[Math.floor(Math.random() * a.length)][0];
    g = g || (Math.random() < 0.5 ? 'm' : 'f');
    const soft = HAIR_COLORS.filter((c) => ['navy', 'black', 'brown', 'blonde', 'red', 'pink', 'silver', 'orange', 'blue', 'mint', 'purple'].includes(c[0]));
    const prem = PREMIUM[g].length && Math.random() < 0.35 ? PREMIUM[g][Math.floor(Math.random() * PREMIUM[g].length)] : null;
    return clean({ g, hair: prem ? prem[0] : R(HAIRS[g]), hc: prem && prem[2] && Math.random() < 0.6 ? prem[2] : R(soft), eyes: R(EYES[g]), ec: R(EYE_COLORS), mouth: R(MOUTHS) });
  }

  NC.LOOK = { items };
  NC.Look = {
    HAIRS, PREMIUM, EYES, MOUTHS, HAIR_COLORS, EYE_COLORS, DEFAULTS, swatch, clean, keyOf, parseKey, ready, thumb, random, preview, register, isPremium,
    get mine() { return mine; }, setMine, hairName,
    // put my look on the hero: the item joins the collection and is worn (test runs that never save: not kept either)
    wear(game, L) {
      setMine(L, !game.noSave);
      const p = game.player;
      if (p.owned) p.owned.add('hair_look');
      p.equip.hair = 'hair_look';
      if (NC.applyGear) NC.applyGear(game);
      if (NC.saveGame) NC.saveGame(game);
    },
  };

  // ---------------- hooks ----------------
  // my head is ready before the save is read (the equipment wears it only if its picture exists)
  const baseLoad = NC.loadAssets;
  NC.loadAssets = function () {
    return baseLoad.apply(this, arguments).then((r) => { buildMine(); return r; });
  };
  // choosing a class set (its hair is the hero's own spiky hair) keeps my look on
  function hookItems() {
    if (!NC.equipClass || NC.equipClass.look) return;
    const base = NC.equipClass;
    NC.equipClass = function (game, cid) {
      const had = game.player.equip.hair === 'hair_look';
      const r = base.apply(this, arguments);
      if (had && game.player.equip.hair !== 'hair_look') { game.player.equip.hair = 'hair_look'; NC.applyGear(game); NC.saveGame(game); }
      return r;
    };
    NC.equipClass.look = true;
    const baseOf = NC.classOf;
    if (baseOf) NC.classOf = (equip) => baseOf(equip && equip.hair === 'hair_look' ? Object.assign({}, equip, { hair: 'hair_spiky' }) : equip);
  }
  // online: my look travels as a field; another player's hair_look becomes their own look's item
  function hookNet() {
    const net = NC.Net;
    if (!net || net.look) return;
    net.look = true;
    net.fields.push({ key: 'lk', get: () => (mine ? keyOf(mine) : null) });
    net.hooks.push((r, pr) => {
      if (!r || !r.equip) return;
      if (r.equip.hair === 'hair_look') {
        const id = pr && typeof pr.lk === 'string' ? register(pr.lk) : null;
        r.equip.hair = id || 'hair_spiky';
      }
    });
  }
  // (items.js and net.js load after this file)
  const hookAll = () => { hookItems(); hookNet(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hookAll); else setTimeout(hookAll, 0);
})();
