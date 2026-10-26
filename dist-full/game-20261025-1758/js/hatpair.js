/* hatpair.js — every hat on every hairstyle (the user, 2026-10-17).

   1. A HEAD'S OWN SIZE ("มันจะมีบางทรงผม ที่ใส่หมวกเเบบหมวกลอยบนหัว ผมอยากให้ใส่ลักษณะ เข้าหัว ไม่ใช่ลอยๆ ทุกหมวก ... บางอันหัวใหญ่
   บางอันหัวเล็ก เเล้วพอ หมวก ใหญ่เเต่ หัวบางอันเล้ก มันก็ดูหลวมๆ"). A hat's own fit (dx, seat, fit, clip: items.js +
   js/hatfit_data.js) was made by hand on one head: the spiky hair (hair_spiky), a boss's hat on its boss's head. Every head
   has its face at the same place in its head box, but not the same hair: a buzz cut stands 0.42 head widths above the eye
   line, the spiky hair 0.58, a wolf cut 0.59. So the hat is laid on each head as on its own: the whole fit scaled round
   the eyes by how tall that head stands over them (its crown, measured from its picture) next to the head the hat was
   fitted on. A short head gets the hat smaller and lower (no more floating, no more loose brim), a big head larger.
   2. PAIRS ("ผมจะนั่งจัดหมวกกับทรงผมทีล่ะทรงเเล้วกดบันทึก เอง เพราะบางทรงกับหมวกบางอันมันไม่พอดี"): a hat fitted by hand to
   ONE hairstyle on the hat fitting page (studio/hats.html, mode "คู่หมวก × ทรงผม"), kept in js/hatpair_data.js, is used
   as it is on that hair, instead of the above. A pair can also turn the hat (rot, degrees, round the middle of its band),
   move the line the hair under it is cut at (trim, head widths, + = lower; with clip) and hide the back hair (hideBack).
   avatar.js asks NC.hatWorn(equip, hat) for the hat it draws, so every picture of a hero wears it: the player in the rig's
   moves (js/herospine.js draws a hatted hero through the cut-out), party members, bots, bosses, the bag, the creator.
   The hair key: the hair item ('hair_spiky'), or 'lk:<hairstyle>' for a head made in the character creator (one fit for
   every colour, eyes and mouth of that hairstyle). Pairs saved in a browser that couldn't reach the studio server
   (localStorage nightcamp.hatpair.v1) count in that browser while newer than the file; tools/bake_hatpairs.mjs writes
   them into js/hatpair_data.js. ?hatsize=0: no head-size fitting (the hats' own fits on every head). */
(function () {
  'use strict';
  const NC = window.NC;
  const KEY = 'nightcamp.hatpair.v1', NUM = ['dx', 'seat', 'fit', 'rot', 'trim'];
  const D = NC.HATPAIR_DATA || {}, FILE_T = D.t || 0;
  const pairs = {}; // hat id -> hair key -> fit
  const put = (h, k, r) => {
    if (r && r.del) { if (pairs[h]) { delete pairs[h][k]; if (!Object.keys(pairs[h]).length) delete pairs[h]; } return; }
    (pairs[h] || (pairs[h] = {}))[k] = r;
  };
  for (const h in D.pairs || {}) for (const k in D.pairs[h]) put(h, k, D.pairs[h][k]);
  // (this browser's saves: only the ones made after the file was written)
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && s.pairs) for (const h in s.pairs) for (const k in s.pairs[h]) { const r = s.pairs[h][k]; if (r && (r.t || 0) > FILE_T) put(h, k, r); }
  } catch (e) { /* storage blocked: the file only */ }

  // the hair a hero's hat sits on
  function hairKey(equip) {
    const id = equip && equip.hair, it = id && NC.ITEMS[id];
    if (!id) return null;
    if (/^hair_lk-/.test(id)) return 'lk:' + id.split('-')[2];   // (another player's / a boss's creator head: its look key)
    if (!it) return null;
    const s = it.head && NC.SPR[it.head];
    if (s && s.look) return 'lk:' + String(s.look).split('-')[1];
    return id;
  }

  // ---------------- 1. a head's own size ----------------
  // its crown: how far the top of the head (the median top over the columns round the eyes) stands above the eye line; the
  // eye line and the eyes' middle in the head box. All in head-box widths. One per hairstyle (colours don't change it)
  const SHAPE = new Map(), mcv = document.createElement('canvas'), mctx = mcv.getContext('2d', { willReadFrequently: true });
  function measure(H) {
    const img = H && H.img, hb = H && H.head;
    if (!img || !img.width || !hb || !NC.eyesOf || H.ready === false) return null;
    const bw = hb[2] * H.w, q = 100 / bw, W = Math.ceil(H.w * q), Hh = Math.ceil(H.h * q);
    mcv.width = W; mcv.height = Hh;
    mctx.clearRect(0, 0, W, Hh);
    mctx.drawImage(img, 0, 0, W, Hh);
    let px;
    try { px = mctx.getImageData(0, 0, W, Hh).data; } catch (e) { return null; } // (pictures from disk: no reading)
    const E = NC.eyesOf(H), ex = (E[0][0] + E[1][0]) / 2, ey = (E[0][1] + E[1][1]) / 2, tops = [];
    for (let xu = ex - 0.3 * bw; xu <= ex + 0.15 * bw; xu += bw / 100) {
      const x = Math.round(xu * q);
      if (x < 0 || x >= W) continue;
      for (let y = 0; y < Hh; y++) if (px[(y * W + x) * 4 + 3] > 60) { tops.push(y / q); break; }
    }
    if (tops.length < 12) return null;
    tops.sort((a, b) => a - b);
    // (and the head's outline over the eyes: its top's height above the eye line, every 0.01 head widths from 0.6 behind
    // the eyes' middle to 0.6 in front of it)
    const prof = new Float32Array(121).fill(NaN);
    for (let i = 0; i < 121; i++) {
      const x = Math.round((ex + (i / 100 - 0.6) * bw) * q);
      if (x < 0 || x >= W) continue;
      for (let y = 0; y < Hh; y++) if (px[(y * W + x) * 4 + 3] > 60) { prof[i] = (ey - y / q) / bw; break; }
    }
    return { crown: (ey - tops[tops.length >> 1]) / bw, eyeTop: (ey - hb[1] * H.h) / bw, exc: (ex - hb[0] * H.w) / bw, prof };
  }
  // how deep a hat sits on a head (head widths): over the forehead and the crown (0.35 behind the eyes' middle to 0.1 in
  // front), the median of how far its lowest edge above the eyes reaches below the head's top. The hats the user fitted by
  // hand reach 0.33-0.54 down (their edge at the brows); Codex-measured hats (hatcut.py) 0.02-0.24 (floating)
  const HATPX = new Map();
  function hatAlpha(hs, name) {
    let A = HATPX.get(name);
    if (A !== undefined) return A;
    A = null;
    if (hs.ready === false) return null; // (its picture still streaming in, js/assets.js: nothing kept yet)
    if (hs.img && hs.img.width) {
      const W = 160, Hh = Math.max(8, Math.round((160 * hs.h) / hs.w));
      mcv.width = W; mcv.height = Hh; mctx.clearRect(0, 0, W, Hh); mctx.drawImage(hs.img, 0, 0, W, Hh);
      try { A = { W, H: Hh, D: mctx.getImageData(0, 0, W, Hh).data }; } catch (e) { A = null; }
    }
    if (A || (hs.img && hs.img.width)) HATPX.set(name, A);
    return A;
  }
  function depthOn(hat, sh) {
    const hs = NC.SPR[hat.sprite], A = hs && hatAlpha(hs, hat.sprite);
    if (!A || !sh.prof) return null;
    const w = hat.fit, h = (hat.fit * hs.h) / hs.w, x0 = (hat.dx || 0) - sh.exc - (hs.ax == null ? 0.5 : hs.ax) * w;
    const yTop = sh.eyeTop - hat.seat + (hs.brim === undefined ? 1 : hs.brim) * h, ds = [];
    for (let X = -0.35; X <= 0.1001; X += 0.01) {
      const u = Math.floor(((X - x0) / w) * A.W), top = sh.prof[Math.round((X + 0.6) * 100)];
      if (u < 0 || u >= A.W || !(top === top)) continue;
      let low = -1;
      for (let v = 0; v < A.H; v++) { if (yTop - (v / A.H) * h < 0) break; if (A.D[(v * A.W + u) * 4 + 3] > 60) low = v; }
      if (low >= 0) ds.push(top - (yTop - ((low + 1) / A.H) * h));
    }
    if (ds.length < 5) return null;
    ds.sort((a, b) => a - b);
    return ds[ds.length >> 1];
  }
  // a hat nobody fitted by hand comes down onto the head it was made for: a hat that covers the hair (clip) to the depth
  // of the hand-fitted ones, anything else (ears, horns, a nest, a candle) till it sits on the hair
  const DEEP = { clip: 0.4, top: 0.12 }, DEEPEN = new Map();
  function deepen(hat, id, R) {
    const hand = NC.HATFIT_DATA && NC.HATFIT_DATA.hats && NC.HATFIT_DATA.hats[id];
    if (hand || hat.hood || hat.ownSize || HP.deepOff) return 0;
    const sig = hat.dx + ',' + hat.seat + ',' + hat.fit + ',' + hat.clip, c = DEEPEN.get(id);
    if (c && c[0] === sig) return c[1];
    const d = depthOn(hat, R);
    if (d == null) return 0;
    const dz = Math.max(0, (hat.clip ? DEEP.clip : DEEP.top) - d);
    DEEPEN.set(id, [sig, dz]);
    return dz;
  }
  const headOfHair = (id) => { const it = id && NC.ITEMS[id], s = it && it.head && NC.SPR[it.head]; return s && s.img ? s : null; };
  function shapeOf(key, hairId) {
    if (SHAPE.has(key)) return SHAPE.get(key);
    const H = headOfHair(hairId);
    if (!H) return null;
    const m = measure(H);
    if (m) SHAPE.set(key, m);
    return m;
  }
  // the head each hat was fitted on: a boss's hat on its boss's creator head (js/rootboss.js), any other the spiky hair
  let REF = null;
  function refOf(hatId) {
    if (!REF) {
      REF = {};
      const B = NC.RootBoss && NC.RootBoss.B;
      if (B) for (const X of Object.values(B)) if (X.equip && X.equip.hat && X.head) REF[X.equip.hat] = X.head;
    }
    const look = REF[hatId];
    if (!look) return ['hair_spiky', 'hair_spiky'];
    return ['lk:' + look.split('-')[1], 'hair_lk-' + look];
  }
  function refShape(hatId) {
    const [k, id] = refOf(hatId);
    let s = shapeOf(k, id);
    if (!s && /^lk:/.test(k) && NC.Look && NC.Look.ready && NC.Look.ready()) s = shapeOf(k, NC.Look.register(id.slice(8))); // (the boss's head, made now)
    return s;
  }
  // the hat's own fit (brought down onto its head if nobody fitted it), laid on this head: scaled round the eyes by how
  // tall this head stands over them next to the head it was fitted on (sizeK of the difference: the face stays the same
  // size, so a hat follows the hair only part of the way)
  const LIMIT = [0.8, 1.2];
  function sized(hat, id, key, hairId) {
    if (!HP.size || hat.ownSize || hat.hood) return null; // (a hood mode hat shows the head only inside it: it keeps its size)
    const R = refShape(id), H = shapeOf(key, hairId);
    if (!R || !H || !(R.crown > 0.1)) return null;
    const dz = deepen(hat, id, R), seat = hat.seat + dz;
    const s = Math.max(LIMIT[0], Math.min(LIMIT[1], 1 + (H.crown / R.crown - 1) * HP.sizeK));
    if (!dz && Math.abs(s - 1) < 0.004 && Math.abs(H.eyeTop - R.eyeTop) < 0.004 && Math.abs(H.exc - R.exc) < 0.004) return null;
    return {
      fit: hat.fit * s, seat: H.eyeTop - (R.eyeTop - seat) * s, dx: H.exc + ((hat.dx || 0) - R.exc) * s,
      trim: (hat.trim || 0) * s, s, dz,
    };
  }

  const HP = (NC.hatPair = {
    pairs, hairKey, KEY, FILE_T,
    size: true, // (the head-size fitting on/off)
    sizeK: 0.5,   // (how much of a head's size difference the hat follows)
    DEEP,         // (how deep a hat nobody fitted by hand comes down)
    deepOff: false, // (the fitting page: it puts the brought-down seats in the hats' own numbers itself)
    off: false,   // (the fitting page while it edits a hat's own fit: no pairs)
    get: (hat, key) => (pairs[hat] && pairs[hat][key]) || null,
    set: (hat, key, fit) => { put(hat, key, fit || { del: true }); cache.clear(); },
    // the fit a hat gets on a hair without a pair of its own (the fitting page starts a pair from it)
    auto(hatId, hairId) {
      const hat = NC.ITEMS[hatId], key = hairKey({ hair: hairId });
      const z = hat && key && sized(hat, hatId, key, hairId);
      return hat ? { dx: z ? z.dx : hat.dx || 0, seat: z ? z.seat : hat.seat, fit: z ? z.fit : hat.fit, clip: !!hat.clip, s: z ? z.s : 1 } : null;
    },
    shapeOf, refOf, measure, depthOn, deepen: (id) => { const hat = NC.ITEMS[id], R = hat && refShape(id); return R ? deepen(hat, id, R) : 0; },
    reset() { SHAPE.clear(); REF = null; DEEPEN.clear(); cache.clear(); },
  });
  const cache = new Map();
  const wear = (hat, r) => {
    const o = Object.assign({}, hat);
    for (const f of NUM) if (Number.isFinite(r[f])) o[f] = r[f];
    if (typeof r.clip === 'boolean') o.clip = r.clip;
    if (typeof r.hideBack === 'boolean') o.hideBack = r.hideBack;
    return o;
  };
  // the hat as it is worn on this hero's hair: its pair, else its own fit laid on this head's size, else the item itself
  NC.hatWorn = function (equip, hat) {
    if (!hat) return hat;
    const k = hairKey(equip), id = hat.id || (equip && equip.hat);
    if (!k || !id) return hat;
    if (!HP.off) {
      const L = HP.live;
      if (L && L.hat === id && L.hair === k) return wear(hat, L.fit);
      const r = pairs[id] && pairs[id][k];
      if (r) {
        const ck = 'p|' + id + '|' + k;
        let c = cache.get(ck);
        if (!c || c[0] !== r || c[1] !== hat) cache.set(ck, (c = [r, hat, wear(hat, r)]));
        return c[2];
      }
    }
    // (the hat's own numbers may change while the fitting page edits them: the copy is remade when they do)
    const ck = 's|' + id + '|' + k, sig = hat.dx + ',' + hat.seat + ',' + hat.fit + ',' + hat.clip + ',' + HP.size + ',' + HP.sizeK;
    let c = cache.get(ck);
    if (!c || c[0] !== sig || c[1] !== hat) {
      const z = sized(hat, id, k, equip.hair);
      c = [sig, hat, z ? wear(hat, z) : hat];
      const hs = NC.SPR[hat.sprite];
      if ((z || !HP.size || (SHAPE.has(k) && SHAPE.has(refOf(id)[0]))) && !(hs && hs.ready === false)) cache.set(ck, c); // (a head not measurable yet, or the hat's picture still streaming in: try again next time)
    }
    return c[2];
  };
})();
