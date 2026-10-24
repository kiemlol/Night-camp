/* sayaart.js — PAINTED scabbards for the samurai blades, with a bloom on their glowing pattern (the user, 2026-10-07: "ฝักดาบ
   ให้ใช้รูปแทน แล้วให้มีลวดลาย แล้วใส่ bloom ด้วย"). js/samurai.js draws a katana's scabbard as a plain tube in code; here the
   Codex painting (assets/gen/make_saya_prompts.py → tools/saya_cut.py → assets/samurai/saya_<x>.png, drawn straight, the
   mouth at the bottom) is bent once along the blade's own centre line, slice by slice (js/falconset.js's way for the white
   sabre), and drawn where the tube was: at the hip while the sword is out, over the blade while it is sheathed. Its glow
   layer (saya_<x>_glow.png: the bright crimson of the pattern) is bent the same way and laid on again after the night's
   darkness, blurred and sharp.
   The light FLOWS (the user, 2026-10-07: "อยากให้ทำเป็นเหมือนพลังงานไล่แสง bloom ไปเรื่อยๆ เป็นม่วง แดงสลับกัน ค่อยๆไหลลง
   ปลายปลอก"): bands of energy run from the mouth down to the tip, one red, the next purple, lighting the pattern (and a
   faint haze over the whole scabbard) as they pass. Baked once per blade: FLOW.n frames of one loop (two bands, so the
   colours come round again), crossfaded in the game.
   SAYAART[weapon id] = the design ('a' blood veins, 'b' crow feathers, 'c' blood flames). NC.SayaArt.on = false: the tubes. */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS;
  if (!ITEMS) return;
  const SA = (NC.SayaArt = { on: true, bloom: 1.4, design: 'b' });
  // the flowing light: frames in a loop, the loop's time, bands along the scabbard, their colours, the haze over the body
  const FLOW = (SA.flow = { n: 24, loop: 3.2, bands: 2.4, cols: ['#ff2442', '#9a46ff'], haze: 0 });   // (haze 0: the light runs only along the red pattern, the user: "เส้นพลังงานไหลตามลายสีแดงเท่านั้น")
  const FOR = ['nodachi_crimson', 'nodachi_blood'];

  const art = {};
  const load = (x) => {
    if (art[x]) return art[x];
    const a = { img: new Image(), glow: new Image() };
    a.img.src = 'assets/samurai/saya_' + x + '.png'; a.glow.src = 'assets/samurai/saya_' + x + '_glow.png';
    return (art[x] = a);
  };
  const ready = (im) => im.complete && im.naturalWidth > 0;
  for (const x of ['a', 'b', 'c']) load(x);
  // a blade with its own scabbard painted for it (js/longblood.js): SA.own[id] = the design; else SA.design for all
  SA.own = {};                      // (all three designs up front: ?saya= and the picks switch at once)

  // the blade's rows (its outline across each row of its picture), the guard row, the tip row
  function rowsOf(W, s) {
    if (W._sayaRows !== undefined) return W._sayaRows;
    const img = s.img;
    if (!img || !(img.naturalWidth || img.width) || s.ready === false) return null; // (ready false: still streaming in, js/assets.js)
    const IW = img.naturalWidth || img.width, IH = img.naturalHeight || img.height;
    const cv = document.createElement('canvas'); cv.width = IW; cv.height = IH;
    const c = cv.getContext('2d'); c.drawImage(img, 0, 0);
    let d;
    try { d = c.getImageData(0, 0, IW, IH).data; } catch (e) { return (W._sayaRows = null); }
    const rows = [];
    // (each row: its LONGEST solid run, so wisps of mist painted round a blade (muramasa) don't count as the blade)
    for (let y = 0; y < IH; y++) {
      let best = null, a = -1;
      for (let x = 0; x <= IW; x++) {
        const on = x < IW && d[(y * IW + x) * 4 + 3] > 128;
        if (on && a < 0) a = x;
        if (!on && a >= 0) { if (!best || x - 1 - a > best[1] - best[0]) best = [a, x - 1]; a = -1; }
      }
      rows.push(best);
    }
    const wid = (y) => (rows[y] ? rows[y][1] - rows[y][0] + 1 : 0);
    let g = Math.round(IH * 0.45), gw = 0;                  // the guard: the widest row between 45% and 88% down
    for (let y = g; y < Math.round(IH * 0.88); y++) if (wid(y) > gw) { gw = wid(y); g = y; }
    while (g > 0 && wid(g - 1) > gw * 0.6) g--;
    const top = rows.findIndex((r) => r);
    return (W._sayaRows = { rows, gy: g, top, IW, IH });
  }
  // the blade's centre line as a smooth curve x = c0 + c1 v + c2 v^2 (v 0 at the tip -> 1 at the guard), and its width
  function curveOf(R) {
    const { rows, top, gy } = R, Lb = gy - top, y0 = Math.round(top + 0.06 * Lb), y1 = Math.round(gy - 0.18 * Lb);
    const S = [0, 0, 0, 0, 0], T = [0, 0, 0];
    for (let y = y0; y <= y1; y++) {
      const r = rows[y]; if (!r) continue;
      const x = (r[0] + r[1]) / 2, v = (y - top) / Lb;
      for (let k = 0; k < 5; k++) S[k] += v ** k;
      for (let k = 0; k < 3; k++) T[k] += x * v ** k;
    }
    const A = [[S[0], S[1], S[2]], [S[1], S[2], S[3]], [S[2], S[3], S[4]]];
    const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const D = det(A);
    if (!D) return null;
    const c = [0, 1, 2].map((i) => det(A.map((row, r) => row.map((v, j) => (j === i ? T[r] : v)))) / D);
    const X = (y) => { const v = (y - top) / Lb; return c[0] + c[1] * v + c[2] * v * v; };
    const ws = [];
    for (let y = y0; y <= y1; y++) { const r = rows[y]; if (r) ws.push(r[1] - r[0] + 1); }
    ws.sort((a, b) => a - b);
    return { X, w: ws[ws.length >> 1] || 8 };
  }
  // the straight painting bent along the blade (once per weapon and design): { cv, glow, pad, IW, IH }
  function bent(W, s, x) {
    const key = '_sayaArt_' + x;
    if (W[key] !== undefined) return W[key];
    const A = load(x), R = rowsOf(W, s);
    if (!R || !ready(A.img) || !ready(A.glow)) return null;
    const bc = curveOf(R);
    if (!bc) return (W[key] = null);
    const P = [];
    for (let y = R.gy; y > R.top; y -= 2) P.push([bc.X(y), y]);           // (from the mouth at the guard to the point)
    P.push([bc.X(R.top), R.top]);
    const n = P.length, cum = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const SW = A.img.naturalWidth, SH = A.img.naturalHeight, L = cum[n - 1] * 1.03;
    const sl = L / SH, sx = Math.max(sl, Math.min(sl * 1.4, bc.w * 1.05 / SW)), pad = Math.ceil(SW * sx);
    // pick(u) -> [picture, alpha] for the slice at u (0 the mouth -> 1 the tip), or null to skip it
    const make = (im, pick) => {
      const cv = document.createElement('canvas'); cv.width = R.IW + pad * 2; cv.height = R.IH + pad * 2;
      const c = cv.getContext('2d'), N = Math.ceil(L), seg = L / N;
      let k = 1;
      for (let j = 0; j < N; j++) {
        let src = im;
        if (pick) { const q = pick(j / N); if (!q || q[1] <= 0.004) continue; src = q[0]; c.globalAlpha = Math.min(1, q[1]); }
        const at = Math.min(cum[n - 1], (j + 0.5) * seg);
        while (k < n - 1 && cum[k] < at) k++;
        const f = (at - cum[k - 1]) / Math.max(1e-6, cum[k] - cum[k - 1]);
        const px = P[k - 1][0] + (P[k][0] - P[k - 1][0]) * f, py = P[k - 1][1] + (P[k][1] - P[k - 1][1]) * f;
        const th = Math.atan2(P[k][0] - P[k - 1][0], -(P[k][1] - P[k - 1][1]));
        c.save(); c.translate(pad + px, pad + py); c.rotate(th);
        c.drawImage(src, 0, SH * (1 - (j + 1) / N), SW, SH / N + 0.5, -SW * sx / 2, -seg / 2 - 0.6, SW * sx, seg + 1.2);
        c.restore();
      }
      return cv;
    };
    // the light's two colours on the straight picture: the pattern full, the scabbard's body as a faint haze
    const lit = FLOW.cols.map((col) => {
      const c = document.createElement('canvas'); c.width = SW; c.height = SH;
      const x2 = c.getContext('2d');
      if (FLOW.haze > 0) { x2.globalAlpha = FLOW.haze; x2.drawImage(A.img, 0, 0); x2.globalAlpha = 1; }
      x2.drawImage(A.glow, 0, 0); x2.drawImage(A.glow, 0, 0);
      x2.globalCompositeOperation = 'source-in'; x2.fillStyle = col; x2.fillRect(0, 0, SW, SH);
      return c;
    });
    // frame f: bands at u * bands - phase; each band a soft bump, the even ones red, the odd ones purple
    const flow = [];
    for (let f = 0; f < FLOW.n; f++) {
      const ph = (f / FLOW.n) * 2;
      flow.push(make(null, (u) => {
        const w = u * FLOW.bands - ph + 8, b = Math.floor(w), fr = w - b;
        const I = Math.pow(Math.sin(Math.PI * fr), 2) * (0.35 + 0.65 * Math.min(1, u * 4 + 0.2));
        return [lit[b % 2], I];
      }));
    }
    return (W[key] = { cv: make(A.img), glow: make(A.glow), flow, pad, IW: R.IW, IH: R.IH });
  }

  // ---------------- drawn where the tube was; the glow remembered for after the darkness ----------------
  const FR = [];
  let gameCanvas = null;
  function paint(fallback) {
    const f = function (ctx, W, s, w, h, grip) {
      const b = SA.on && bent(W, s, SA.own[W.id] || SA.design);
      if (!b) return fallback.apply(this, arguments);
      const kx = w / b.IW, ky = h / b.IH, x = -s.ax * w - b.pad * kx, y = -h * (1 - grip) - b.pad * ky, dw = b.cv.width * kx, dh = b.cv.height * ky;
      ctx.drawImage(b.cv, x, y, dw, dh);
      if (ctx.canvas === gameCanvas && FR.length < 24) FR.push({ m: ctx.getTransform(), x, y, dw, dh, flow: b.flow, a: ctx.globalAlpha });
    };
    f._saya = true;
    return f;
  }
  for (const id of FOR) {
    const W = ITEMS[id];
    if (W && W.sheath && W.sheath.draw) W.sheath.draw = paint(W.sheath.draw);
  }
  // another blade: its scabbard drawn from the painting `design` (assets/samurai/saya_<design>.png), its own sheath object
  SA.add = (id, design) => {
    const W = ITEMS[id];
    if (!W || !W.sheath) return;
    load(design); SA.own[id] = design;
    W.sheath = Object.assign({}, W.sheath, { draw: paint(W.sheath.draw || (() => {})) });
  };
  // worn the other way up (the user, 2026-10-07: "ฝักดาบหันผิดด้านนะ ต้องพลิก จะงอยฝักต้องชี้ขึ้น"): a scabbard at the hip, and a
  // sheathed blade with it, are mirrored across the blade's own line, so the curve bows UP; a drawn blade is untouched
  SA.flip = true;
  const MINE = (W) => W && W.sheath && W.sheath.draw && W.sheath.draw._saya;
  const baseDW = NC.drawWeapon;
  NC.drawWeapon = function (ctx, W, hx, hy, ang, o) {
    if (!(SA.flip && SA.on && o && o.sheath > 0.5 && MINE(W))) return baseDW.apply(this, arguments);
    const a = ang + Math.PI / 2;
    ctx.save();
    ctx.translate(hx, hy); ctx.rotate(a); ctx.scale(-1, 1); ctx.rotate(-a); ctx.translate(-hx, -hy);
    try { return baseDW.apply(this, arguments); } finally { ctx.restore(); }
  };
  const baseTrail = NC.drawTrail;
  NC.drawTrail = function (ctx, game) {
    gameCanvas = ctx.canvas;
    if (FR.length && SA.bloom > 0) {
      const u = ((game.time / FLOW.loop) % 1) * FLOW.n, i0 = Math.floor(u) % FLOW.n, i1 = (i0 + 1) % FLOW.n, mix = u - Math.floor(u);
      for (const f of FR.splice(0)) {
        const k = Math.hypot(f.m.a, f.m.b);
        const lay = (blur, a) => {
          ctx.filter = blur ? `blur(${blur.toFixed(1)}px)` : 'none';
          ctx.globalAlpha = Math.min(1, a * (1 - mix)); ctx.drawImage(f.flow[i0], f.x, f.y, f.dw, f.dh);
          ctx.globalAlpha = Math.min(1, a * mix); ctx.drawImage(f.flow[i1], f.x, f.y, f.dw, f.dh);
        };
        ctx.save();
        ctx.setTransform(f.m);
        ctx.globalCompositeOperation = 'lighter';
        lay(Math.max(3, 7 * k), SA.bloom * f.a);              // (the wide bloom)
        lay(Math.max(1.5, 2.5 * k), SA.bloom * f.a);          // (the tight one)
        lay(0, 0.8 * SA.bloom * f.a);                          // (the lit pattern itself)
        ctx.restore();
      }
    }
    FR.length = 0;
    return baseTrail.apply(this, arguments);
  };
})();
