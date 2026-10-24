/* falconset.js — the two FALCON sets, the rivals of the IRONRAGE black armour (the user, 2026-10-05: a set with a
   one-handed sword "ใส่เอฟเฟคเยอะๆ" ... "ทำทั้งสองชุดเลย"). Our own designs
   (assets/gen/make_falcon_prompts.py: concept -> parts, helms, swords):
     wfalcon  อัศวินปีกรุ่งอรุณ     white-silver plate, gold lines, a white feather cape, the white falcon sabre
     efalcon  ปีกเงาสนธยา         black-violet plate, violet-white lines, a cape of shadow feathers, the eclipse sabre
   Each: robe_<set> (torso, arms, legs, the feather tassets), cape_<set>, hat_<set> (open-faced falcon helm), sw_<set>
   (one-handed: a shield fits in the other hand). What they do, drawn after the night's darkness so nothing dims them:
     - the engraved lines GLOW (each plate's _vein.png, tools/veinglow.py), a wave of light running up the armour from
       the feet to the crest every 2.4 s over a calm base, with a bloom; brighter while swinging
     - FEATHERS drift off the cape (white ones / black ones with violet sparks), a flurry of them on every swing
     - the sabre's edge glows and a LIGHT SHEEN sweeps along the blade now and then, and on every swing
     - a pair of WINGS of light (or of shadow) opens behind the hero for a moment on a dash, then breaks into feathers
     - a HALO over the head (a gold ring / a black eclipse disc with a violet corona) that brightens with the fighting
     - a soft gold / violet light on the ground round the hero
   The white set's details (2026-10-06): a painted scabbard bent along the blade, a falcon of light that leaves the
   chest emblem in a fight and dives back in, the tassets' feathers flaring on each swing (sections below).
   NC.GlowFX (js/ironrage.js) switches them off one by one for videos. TEST pieces:
     ?equip=robe_wfalcon,cape_wfalcon,hat_wfalcon,sw_wfalcon   ?equip=robe_efalcon,cape_efalcon,hat_efalcon,sw_efalcon
   Load after js/ironrage.js. */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, FX = NC.FX;
  const M = () => Object.assign({}, NC.ASSET_MANIFEST_FASHION || {}, NC.ASSET_MANIFEST);
  const G = (NC.GlowFX = NC.GlowFX || {});
  const SETS = {
    wfalcon: { name: 'อัศวินปีกรุ่งอรุณ', glow: [255, 214, 120], light: '255,220,140', feather: ['#f4f1ff', '#c9c4e4'], spark: null,
      halo: 'ring', key: '#wfalconglow', el: 'holy', fit: 1.5,
      flow: ['#ffc65c', '#ffe9b0', '#9fd6ff', '#ffb0cc'], str: 0.45,     // (gold, cream, sky, rose; on white plate: dim, the user "ชุดขาวสว่างไป")
      robe: 'ชุดเกราะปีกรุ่งอรุณ', cape: 'ผ้าคลุมขนนกรุ่งอรุณ', hat: 'หมวกเกราะปีกรุ่งอรุณ', sw: 'ดาบเซเบอร์รุ่งอรุณ',
      desc: 'เกราะเงินขาวสลักลายปีกนก เส้นทองเรืองไล่ขึ้นเป็นระลอก ขนนกขาวปลิวจากผ้าคลุม (ชุดบอสลับ · ทดสอบ)' },
    efalcon: { name: 'ปีกเงาสนธยา', glow: [190, 140, 255], light: '170,110,255', feather: ['#2a2238', '#120e1c'], spark: '200,150,255',
      halo: 'eclipse', key: '#efalconglow', el: 'shadow', fit: 1.52,
      flow: ['#a46cff', '#ff5fd2', '#7fe2ff', '#d9c2ff'], str: 0.5,      // (violet, magenta, cyan, lilac; its lines are many: dimmer)
      robe: 'ชุดเกราะปีกเงาสนธยา', cape: 'ปีกเงาขนนกดำ', hat: 'หมวกเกราะปีกเงาสนธยา', sw: 'ดาบเซเบอร์สนธยา',
      desc: 'เกราะดำเส้นม่วงเรืองยามฟ้าสนธยา ผ้าคลุมเป็นปีกเงาขนนกดำ (ชุดบอสลับ · ทดสอบ)' },
    // (2026-10-06 the user, of the three in-game mockups: "ลองเอา C แต่ท่ายืนแบบในรูป 100% เลย": the NIGHT FALCON, its sabre
    // held drawn and low the way the picture stands (STAND below), no scabbard)
    nfalcon: { name: 'เหยี่ยวรัตติกาล', glow: [255, 60, 80], light: '255,70,90', feather: ['#1c1622', '#0a070e'], spark: '255,90,110',
      halo: 'eclipse', key: '#nfalconglow', el: 'shadow', fit: 1.5, seat: 0.74, drawn: true,   // (the helm smaller: the user "หมวกใหญ่ไป"; a plain cloth cape like the others, no trail)
      flow: ['#ff2a40', '#ff7a52', '#c0102a', '#ff5f7a'], str: 0.55,     // (crimson, ember, blood, rose)
      robe: 'ชุดเกราะเหยี่ยวรัตติกาล', cape: 'ผ้าคลุมขนเหยี่ยวรัตติกาล', hat: 'หน้ากากเหยี่ยวรัตติกาล', sw: 'โนดาจิโลหิตรัตติกาล',
      desc: 'เกราะดำลายเงิน หน้ากากเหยี่ยวตาแดง ขนนกดำสะบัดหลัง ผ้าคลุมขนนกดำซับในแดง ดาบดำคมแดงเรือง (ชุดบอสลับ · ทดสอบ)' },
  };
  // the sabres' sprite numbers (tools/falcon_cut.py prints them)
  const SW = {
    wfalcon: { w: 33.0, h: 112, ax: 0.51, grip: 0.205 },
    efalcon: { w: 27.8, h: 112, ax: 0.515, grip: 0.162 },
    // (2026-10-06 the user: "เปลี่ยนเป็นถือดาบแดงซามูไร": the night falcon holds the red samurai blade, the Crimson Ronin's
    // painted nodachi (js/samglow.js nodachi_crimson, its hamon glow); the black sabre stays in assets/falcon/w_nfalcon.png)
    nfalcon: { w: 21.8, h: 132, ax: 0.543, grip: 0.191, src: 'assets/samurai/w_nodachi_crimson.png' },
  };
  // the night falcon's stance, the mockup's (the sabre in the near hand at the hip, the blade curving down and back to
  // the ground behind the front foot, the far arm hanging): a Pose Studio style one-picture hold, alive like the others
  const STAND = 'studio:nfalcon_stand';
  // (2026-10-06 the user: "ให้มันถือดาบแบบซามูไรสิ" + "ไม่ต้องใส่ฝักดาบนะ": the samurai's middle guard, both hands on the
  // hilt in front of the belly, the blade up and forward; no scabbard. Built on anim.js's two-handed `ready`)
  const STAND_P = { x: 0, y: 0, rot: 0, lean: 0.08, head: -0.05, headY: 0, breathe: 1, sq: 1, aF: 1.05, eF: 1.0, aB: 1.58, eB: 0.5,
    legF: -0.3, kF: 0.35, legB: 0.32, kB: 0.5, wAng: -0.75, wPush: 0, wLen: 1, gAdj: 0, tuck: 0, ik: 1, wFar: 0, wHide: 0, wSheath: 0, pull: 0,
    wz: 0, turn: 0, fade: 1, hk: 0, hx: 9, hy: -18, bk: 0, bx: 13, by: -14, plant: 0, pX: 4, pY: -62, pG: 99 };
  function registerStand() {
    const PL = NC.PoseLib, A = NC.Anim;
    if (!PL || !A) return;
    PL.register('nfalcon_stand', { name: 'ยืนถือดาบเหยี่ยวรัตติกาล', kind: 'loop', shot: true, dur: 3.4, keys: [{ t: 0, P: STAND_P }] });
    A.BASE[STAND + ':walk'] = PL.holdWalk(STAND); A.WALKS[STAND] = STAND + ':walk';
    A.BASE[STAND + ':run'] = PL.holdRun(STAND); A.RUNS[STAND] = STAND + ':run';
  }
  registerStand();

  // ---------------- the scabbard at the waist (the user: "ดาบควรเหน็บเอวนะ แบบซามูไร") ----------------
  // the samurai's way (js/samurai.js, whose helpers are admin-only): the sabre lives in a scabbard thrust through the
  // belt, the hand rests on the hilt standing (anim.js idleHilt), it is drawn with the 'blade' cuts; the empty scabbard
  // stays at the hip while the blade is out. The scabbard follows the blade's own curve, read off its picture once.
  function sayaOf(W, s) {
    if (W._saya !== undefined) return W._saya;
    const img = s.img;
    if (!img || !img.complete || !img.naturalWidth) return null;
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const c = cv.getContext('2d');
    c.drawImage(img, 0, 0);
    let d;
    try { d = c.getImageData(0, 0, cv.width, cv.height).data; } catch (e) { return (W._saya = null); }
    const IW = cv.width, IH = cv.height, rows = [];
    for (let y = 0; y < IH; y++) {
      let a = -1, b = -1;
      for (let x = 0; x < IW; x++) if (d[(y * IW + x) * 4 + 3] > 128) { if (a < 0) a = x; b = x; }
      rows.push(a < 0 ? null : [a, b]);
    }
    const wid = (y) => (rows[y] ? rows[y][1] - rows[y][0] + 1 : 0);
    let g = Math.round(IH * 0.45), gw = 0;                     // the guard: the widest row 45-90% down
    for (let y = g; y < Math.round(IH * 0.9); y++) if (wid(y) > gw) { gw = wid(y); g = y; }
    while (g > 0 && wid(g - 1) > gw * 0.6) g--;
    const ws = [];
    for (let y = Math.round(g * 0.3); y < Math.round(g * 0.9); y++) if (wid(y)) ws.push(wid(y));
    ws.sort((a, b) => a - b);
    const bw = ws.length ? ws[ws.length >> 1] : 8;
    const pts = [];
    for (let y = g - 1; y >= 3; y -= 5) if (rows[y]) pts.push([(rows[y][0] + rows[y][1]) / 2 / IW, y / IH]);
    const last = rows.findIndex((r) => r);
    pts.push([rows[last] ? (rows[last][0] + rows[last][1]) / 2 / IW : pts[pts.length - 1][0], Math.max(0, last - 1) / IH]);
    // the blade's width across itself (a row of a slanted blade is wider than the blade): the widest, for a scabbard
    // that covers it all (the painted one below)
    const pw = [];
    for (let i = 1; i < pts.length - 2; i++) {
      const y = Math.round(pts[i][1] * IH), dx = (pts[i + 1][0] - pts[i - 1][0]) * IW, dy = (pts[i + 1][1] - pts[i - 1][1]) * IH;
      pw.push(wid(y) * Math.abs(dy) / Math.hypot(dx, dy));
    }
    pw.sort((a, b) => a - b);
    return (W._saya = { pts, bw: bw / IW, pw: (pw.length ? pw[Math.floor(pw.length * 0.9)] : bw) / IW, g: g / IH, rows, top: last, gy: g, IW, IH });
  }
  // the blade's centre line as a smooth curve x = c0 + c1 y + c2 y^2, fitted on its clean middle (away from the guard's
  // upswept wings and the point), and its median width across itself there
  function bladeCurve(sy) {
    const { rows, top, gy } = sy, Lb = gy - top, y0 = Math.round(top + 0.06 * Lb), y1 = Math.round(gy - 0.18 * Lb);
    const S = [0, 0, 0, 0, 0], T = [0, 0, 0];
    for (let y = y0; y <= y1; y++) {
      const r = rows[y];
      if (!r) continue;
      const x = (r[0] + r[1]) / 2, v = (y - top) / Lb;
      for (let k = 0; k < 5; k++) S[k] += v ** k;
      for (let k = 0; k < 3; k++) T[k] += x * v ** k;
    }
    const A = [[S[0], S[1], S[2]], [S[1], S[2], S[3]], [S[2], S[3], S[4]]];
    const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const D = det(A);
    if (!D) return null;
    const c = [0, 1, 2].map((i) => det(A.map((row, r) => row.map((v, j) => (j === i ? T[r] : v)))) / D);   // (Cramer)
    const X = (y) => { const v = (y - top) / Lb; return c[0] + c[1] * v + c[2] * v * v; };
    const ws = [];
    for (let y = y0; y <= y1; y++) {
      const r = rows[y];
      if (!r) continue;
      const slope = (c[1] + 2 * c[2] * (y - top) / Lb) / Lb;            // (dx/dy)
      ws.push((r[1] - r[0] + 1) / Math.hypot(1, slope));
    }
    ws.sort((a, b) => a - b);
    return { X, w: ws[ws.length >> 1] || 8 };
  }
  // the white set's PAINTED scabbard (2026-10-06, "มาทำดีเทลชุดขาวต่อ": the plain code-drawn tube looked cheap next to
  // the painted armour): assets/falcon/saya_<set>.png is painted STRAIGHT (tools/falcon_cut.py saya) and bent here once
  // along the blade's own centre line, slice by slice, into a picture laid over the sabre's (pad px round it)
  const SAYA_ART = { wfalcon: 'assets/falcon/saya_wfalcon.png' };
  const sayaImg = {};
  for (const [id, src] of Object.entries(SAYA_ART)) { const im = new Image(); im.src = src; sayaImg[id] = im; }
  function bentSaya(W, s, id) {
    if (W._bent !== undefined) return W._bent;
    const art = sayaImg[id], sy = sayaOf(W, s);
    if (!art || !art.complete || !art.naturalWidth || !sy) return null;
    const IW = s.img.naturalWidth, IH = s.img.naturalHeight, bc = bladeCurve(sy);
    if (!bc) return (W._bent = null);
    const P = [];
    for (let y = sy.gy; y > sy.top; y -= 2) P.push([bc.X(y), y]);           // (from the mouth at the guard to the point)
    P.push([bc.X(sy.top), sy.top]);
    const n = P.length;
    const cum = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const SW = art.naturalWidth, SH = art.naturalHeight;
    // the scabbard's own body (its width and middle, read off the picture's middle rows: the tassel hangs out to one
    // side) is made as wide as the blade across, plus a margin
    const mc = document.createElement('canvas'); mc.width = SW; mc.height = SH;
    const mx = mc.getContext('2d'); mx.drawImage(art, 0, 0);
    let md; try { md = mx.getImageData(0, 0, SW, SH).data; } catch (e) { return (W._bent = null); }
    const bws = [], bcs = [];
    for (let y = Math.round(SH * 0.3); y < SH * 0.7; y++) {
      let a = -1, b = -1;
      for (let x = 0; x < SW; x++) if (md[(y * SW + x) * 4 + 3] > 128) { if (a < 0) a = x; b = x; }
      if (a >= 0) { bws.push(b - a + 1); bcs.push((a + b) / 2); }
    }
    bws.sort((a, b) => a - b); bcs.sort((a, b) => a - b);
    const bodyW = bws[bws.length >> 1] || SW, bodyC = bcs[bcs.length >> 1] || SW / 2;
    // (its width: the painting's own proportions, a little wider at most; the blade inside never shows, only the hilt
    // is drawn over a sheathed scabbard, so it need not cover the broad sabre)
    const L = cum[n - 1] * 1.03, sl = L / SH, sx = Math.max(sl, Math.min(sl * 1.35, bc.w * 0.8 / bodyW)), pad = Math.ceil(SW * sx);
    const cv = document.createElement('canvas'); cv.width = IW + pad * 2; cv.height = IH + pad * 2;
    const c = cv.getContext('2d');
    const N = Math.ceil(L), seg = L / N;
    let k = 1;
    for (let j = 0; j < N; j++) {
      const at = Math.min(cum[n - 1], (j + 0.5) * seg);
      while (k < n - 1 && cum[k] < at) k++;
      const f = (at - cum[k - 1]) / Math.max(1e-6, cum[k] - cum[k - 1]);
      const x = P[k - 1][0] + (P[k][0] - P[k - 1][0]) * f, y = P[k - 1][1] + (P[k][1] - P[k - 1][1]) * f;
      const th = Math.atan2(P[k][0] - P[k - 1][0], -(P[k][1] - P[k - 1][1]));   // (the turn from straight up)
      c.save(); c.translate(pad + x, pad + y); c.rotate(th);
      c.drawImage(art, 0, SH * (1 - (j + 1) / N), SW, SH / N + 0.5, -bodyC * sx, -seg / 2 - 0.6, SW * sx, seg + 1.2);
      c.restore();
    }
    return (W._bent = { cv, pad, IW, IH, g: sy.gy });
  }
  const sayaPaint = (id, fallback) => function (ctx, W, s, w, h, grip) {
    const b = bentSaya(W, s, id);
    if (!b) return fallback.apply(this, arguments);
    const kx = w / b.IW, ky = h / b.IH;
    ctx.drawImage(b.cv, -s.ax * w - b.pad * kx, -h * (1 - grip) - b.pad * ky, b.cv.width * kx, b.cv.height * ky);
  };
  const sayaDraw = (col) => function (ctx, W, s, w, h, grip) {
    const sy = sayaOf(W, s);
    if (!sy) return;
    const P = sy.pts.map(([fx, fy]) => [(fx - s.ax) * w, -h * (1 - grip) + fy * h]);
    const sw = sy.bw * w * 0.5, ol = Math.max(1.1, sw * 0.13), n = P.length;   // (the curved blade's rows are wide: a slimmer scabbard)
    const line = (pts) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); };
    const at = (u) => { const f = u * (n - 1), i = Math.min(n - 2, Math.floor(f)), k = f - i; return [P[i][0] + (P[i + 1][0] - P[i][0]) * k, P[i][1] + (P[i + 1][1] - P[i][1]) * k]; };
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
    const tip = P[n - 1];
    line(P); ctx.strokeStyle = '#17132b'; ctx.lineWidth = sw + ol * 2; ctx.stroke();
    ctx.fillStyle = '#17132b'; ctx.beginPath(); ctx.arc(tip[0], tip[1], sw / 2 + ol, 0, Math.PI * 2); ctx.fill();
    line(P); ctx.strokeStyle = col.body; ctx.lineWidth = sw; ctx.stroke();
    ctx.fillStyle = col.body; ctx.beginPath(); ctx.arc(tip[0], tip[1], sw / 2, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(-sw * 0.2, 0); line(P.slice(1, n - 1)); ctx.strokeStyle = col.hi; ctx.globalAlpha *= 0.75; ctx.lineWidth = sw * 0.2; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
    const band = (u0, u1, c) => { line([at(u0), at(u1)]); ctx.strokeStyle = '#17132b'; ctx.lineWidth = sw + ol * 2.2; ctx.stroke(); ctx.strokeStyle = c; ctx.lineWidth = sw + ol * 0.6; ctx.stroke(); };
    band(0, 0.05, col.band);
    band(0.18, 0.22, col.cord);
    band(0.5, 0.53, col.band);
    band(0.94, 1, col.band);
    ctx.restore();
  };
  const SAYA = {
    wfalcon: { body: '#eef0f6', hi: '#ffffff', band: '#e2b85a', cord: '#2b3c80' },
    efalcon: { body: '#1c1528', hi: '#8a6ad8', band: '#b9a8e6', cord: '#8a1830' },
  };
  const AT_HIP = [8, -19];

  // ---------------- the items ----------------
  const live = [];
  for (const [id, S] of Object.entries(SETS)) {
    const m = M();
    if (!m['rig_' + id + '_torso']) continue;                   // (no art yet)
    live.push(id);
    ITEMS['robe_' + id] = { slot: 'robe', name: S.robe, rig: id, rarity: 'legend', stats: { hp: 60, atk: 0.04, crit: 0.05 }, desc: S.desc };
    ITEMS['cape_' + id] = { slot: 'cape', name: S.cape, sprite: 'rig_' + id + '_cape', rarity: 'legend', stats: { atk: 0.03 }, desc: S.desc, trail: S.capeTrail || 0 };
    if (m['hat_' + id]) ITEMS['hat_' + id] = { slot: 'hat', name: S.hat, sprite: 'hat_' + id, art: 2, rarity: 'legend',
      fit: S.fit || 1.45, seat: S.seat || 0.665, dx: 0.06, clip: false, hood: true, soft: 0, stats: { hp: 20, atk: 0.04 }, desc: S.desc };
    const c = SW[id], T = ITEMS.sword;
    if (c.w && T) {
      const spr = 'w_' + id;
      NC.ASSET_MANIFEST[spr] = { src: c.src || ('assets/falcon/' + spr + '.png'), w: c.w, h: c.h, ax: c.ax, ay: 1.0 };
      const base = { id: 'sw_' + id, wtype: 'sword', sprite: spr, name: S.sw, rarity: 'legend', grip: c.grip,
        dmg: [150, 196], element: S.el, trailRgb: S.light, desc: S.desc };
      ITEMS['sw_' + id] = Object.assign({}, T, base, S.drawn ? { sig: { idle: STAND }, twoHanded: true, grip2: 12, sheath: null, saya: null } :   // (never a scabbard: the user "ไม่ต้องใส่ฝักดาบ")
         { restAng: -1.95, stance: -0.65,
        sheath: { draw: SAYA_ART[id] ? sayaPaint(id, sayaDraw(SAYA[id])) : sayaDraw(SAYA[id]) }, saya: { at: AT_HIP, ang: 2.84 }, sheathAng: 2.84, tuck: { grip: c.grip, ang: 2.84, at: AT_HIP, back: false },
        sig: { idle: 'idleHilt', set: 'blade' } });
    }
  }
  if (!live.length) return;
  // (js/poselib.js gives every sword the user's Pose Studio hold as its idle: these sabres keep the hand on the hilt)
  const SIG = { idle: 'idleHilt', set: 'blade' };
  // (a stance the user made in the Pose Studio for this very sabre and ticked "ใช้ในเกม" wins over STAND)
  const ownHold = (w) => { const L = NC.POSE_LIB || {}, k = Object.keys(L).find((k) => L[k].weapon === w && L[k].kind === 'loop' && L[k].weaponIdle); return k ? 'studio:' + k : null; };
  const baseLoad = NC.loadAssets;
  NC.loadAssets = function () {
    const r = baseLoad.apply(this, arguments);
    for (const id of live) if (ITEMS['sw_' + id]) ITEMS['sw_' + id].sig = SETS[id].drawn ? { idle: ownHold('sw_' + id) || STAND } : Object.assign({}, SIG);
    return r;
  };
  const setOf = (e) => e && live.find((id) => e.robe === 'robe_' + id || e.cape === 'cape_' + id || e.hat === 'hat_' + id || e.weapon === 'sw_' + id);
  const full = (e, id) => e.robe === 'robe_' + id;

  // ---------------- the glow layers (each plate's / the sabre's _vein.png) ----------------
  const GLOW = {};
  // (the _vein pictures are light on black; made white with the light in the alpha, so the flowing colours can tint them)
  const toAlpha = (img) => {
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
    for (let i = 0; i < a.length; i += 4) { const v = Math.max(a[i], a[i + 1], a[i + 2]); a[i] = a[i + 1] = a[i + 2] = 255; a[i + 3] = Math.min(255, v * 1.6); }
    x.putImageData(d, 0, 0);
    return c;
  };
  // (2026-10-19: each vein picture is fetched and turned to alpha the first time its piece is drawn, not at the start: all
  // three sets' pictures cost 85-180 ms of every start, worn or not; a start's CPU profile)
  const VEIN = {};
  for (const [name, m] of Object.entries(M())) {
    if (!/^(rig_|hat_|w_)(wfalcon|efalcon|nfalcon)/.test(name) || /_vein$|_bloom$|_fill$|_head$/.test(name) || !m.src) continue;
    VEIN[name] = m.src.replace(/\.png$/, '_vein.png');
  }
  function glowOf(name) {
    const g = GLOW[name];
    if (g !== undefined || !VEIN[name]) return g;
    GLOW[name] = null; // (on its way: drawn without its glow until then)
    const img = new Image();
    img.onload = () => { try { GLOW[name] = toAlpha(img); } catch (e) { GLOW[name] = img; } };
    img.src = VEIN[name];
    return null;
  }
  const EMPTY = document.createElement('canvas'); EMPTY.width = EMPTY.height = 1;
  const KEYS = Object.fromEntries(live.map((id) => [SETS[id].key, id]));
  // ---------------- the outfit's own tricks (2026-10-06, the white set first: "ลูกเล่นตามชุด") ----------------
  // GEM GLINTS: the armour's studs and gems (and the falcon helm's eye) twinkle where they are on the plates, each on
  // its own beat; a second silhouette pass with GEMKEY, NC.tinted giving each part a star layer at a strength of the
  // moment (6 pre-drawn steps). Points in the part pictures' pixels: [x, y, size].
  const GEMS = {
    wfalcon: { rig_wfalcon_torso: [[32, 38, 9], [45, 63, 5]], rig_wfalcon_armF: [[31, 18, 5]], rig_wfalcon_armB: [[13, 20, 5]],
      rig_wfalcon_skirt: [[36, 4, 4], [35, 13, 4], [36, 40, 4]], hat_wfalcon: [[226, 48, 16], [118, 123, 12]] },
    // (the night falcon: the chest gem that beats like a heart, the helm's red eye-slit and its small gem)
    nfalcon: { rig_nfalcon_body: [[48, 26, 9]], hat_nfalcon: [[322, 182, 15], [390, 182, 7]] },
  };
  // ---------------- THE NIGHT FALCON'S RED (2026-10-06, the user: "ลองทำเอฟเฟคชุดตรงแดงๆ ให้หน่อย" -> "ทำเลยทั้งหมด") ----------------
  //   HEART  the chest gem beats like a heart (the red nodachi's glow beats with it), faster as the blood gauge fills;
  //          a hit sends a red pulse from it along the silver lines
  //   EMBERS the crimson tips of the feather skirt, the cape's hem and the helm's plumes glow like live coals, a slow wave
  //          rising from the hem, brighter in a fight
  //   SPARKS a few embers peel off the red tips and rise, a burst on each swing
  //   EYE    the helm's eye-slit glows, flares on a swing or a dash and leaves a short red streak as the head moves
  //   BLOOD  every hit fills a gauge (NEED hits, it drains out of a fight); full: ten seconds of the blood form, every red
  //          part burning (flames on the tips, the lines red-hot, the cape fluttering), then it dies back down
  const BLOOD = { nfalcon: { need: 20, dur: 10, eye: 'hat_nfalcon', pulse: '#ff4656',
    ember: { rig_nfalcon_body: [0, 0.42, 1, 1], rig_nfalcon_cape: [0, 0, 1, 1], hat_nfalcon: [0, 0, 0.62, 1] } } };   // (the box of each picture whose red glows)
  const SWGEM = { wfalcon: [0.45, 0.92] };                          // (the pommel's blue gem, fractions of the sabre)
  const GEMKEYS = Object.fromEntries(Object.keys(GEMS).map((id) => ['#' + id + 'gem', id]));
  const gemLevels = {};
  function star(c, x, y, r, a) {
    c.save(); c.translate(x, y); c.globalAlpha = a;
    const g = c.createRadialGradient(0, 0, 0, 0, 0, r * 1.2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,236,170,0.8)'); g.addColorStop(1, 'rgba(255,210,120,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 1.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,250,1)';
    for (const [l, w] of [[r * 2.6, r * 0.16], [r * 1.3, r * 0.12]]) {          // the long cross, then the short diagonal one
      c.beginPath(); c.moveTo(-l, 0); c.lineTo(0, -w); c.lineTo(l, 0); c.lineTo(0, w); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(0, -l); c.lineTo(w, 0); c.lineTo(0, l); c.lineTo(-w, 0); c.closePath(); c.fill();
      c.rotate(Math.PI / 4);
    }
    c.restore();
  }
  function redGlow(c, x, y, r, a) {
    c.save(); c.globalAlpha = a;
    const g = c.createRadialGradient(x, y, 0, x, y, r * 2.2);
    g.addColorStop(0, 'rgba(255,240,235,1)'); g.addColorStop(0.18, 'rgba(255,90,100,0.95)'); g.addColorStop(0.5, 'rgba(220,20,50,0.45)'); g.addColorStop(1, 'rgba(160,0,30,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 2.2, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  function gemLayer(id, name, step) {
    const k = id + name, pts = GEMS[id][name], s = NC.SPR[name];
    if (!pts || !s || !s.img || !(s.img.naturalWidth || s.img.width)) return EMPTY;     // (a flared skirt is a canvas)
    if (!gemLevels[k]) {
      gemLevels[k] = [];
      for (let i = 0; i < 6; i++) {
        const c = document.createElement('canvas'); c.width = s.img.naturalWidth || s.img.width; c.height = s.img.naturalHeight || s.img.height;
        const x = c.getContext('2d');
        if (i) for (const [px, py, r] of pts) (BLOOD[id] ? redGlow : star)(x, px, py, r * (0.45 + 0.55 * i / 5), Math.min(1, 0.35 + i / 5));
        gemLevels[k].push(c);
      }
    }
    return gemLevels[k][step];
  }
  // each part's twinkle: a quick sparkle every ~2.6 s, the parts out of step (a hash of the name)
  const phaseOf = (name) => { let h = 7; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return (h % 1000) / 1000 * 2.6; };
  const twinkle = (t, name) => { const u = (t + phaseOf(name)) % 2.6; return Math.exp(-(((u - 0.25) / 0.13) ** 2)); };
  const GT = { t: 0, hb: 0, eye: 0.5, boost: 0 };
  // the red tips of a picture (its crimson pixels inside the box BLOOD gives it), white with the redness in the alpha
  const EMBERKEYS = Object.fromEntries(Object.keys(BLOOD).map((id) => ['#' + id + 'ember', id]));
  const emberCache = {};
  function emberOf(id, name) {
    const box = BLOOD[id].ember[name], s = NC.SPR[name];
    if (!box || !s || !s.img || !s.img.naturalWidth) return EMPTY;
    if (emberCache[name]) return emberCache[name];
    const W = s.img.naturalWidth, Hh = s.img.naturalHeight, c = document.createElement('canvas');
    c.width = W; c.height = Hh;
    const x = c.getContext('2d'); x.drawImage(s.img, 0, 0);
    let d;
    try { d = x.getImageData(0, 0, W, Hh); } catch (e) { return (emberCache[name] = EMPTY); }
    const a = d.data, x0 = box[0] * W, y0 = box[1] * Hh, x1 = box[2] * W, y1 = box[3] * Hh;
    for (let i = 0; i < a.length; i += 4) {
      const px = (i >> 2) % W, py = ((i >> 2) / W) | 0, r = a[i], g = a[i + 1], b = a[i + 2];
      const red = px >= x0 && px < x1 && py >= y0 && py < y1 && r > 60 && r > g * 1.5 && r > b * 1.3 ? Math.min(1, (r - Math.max(g, b)) / 90) : 0;
      a[i] = a[i + 1] = a[i + 2] = 255; a[i + 3] = a[i + 3] * red;
    }
    x.putImageData(d, 0, 0);
    return (emberCache[name] = c);
  }
  const baseTinted = NC.tinted;
  NC.tinted = function (name, colour) {
    if (GEMKEYS[colour]) {
      const id = GEMKEYS[colour], Bd = BLOOD[id];
      const lv = Bd ? (name === Bd.eye ? GT.eye : GT.hb) : twinkle(GT.t, name.replace(/_fl\d$/, ''));
      const out = gemLayer(id, name, Math.max(0, Math.min(5, Math.round(5 * Math.min(1, lv + GT.boost)) || 0)));
      const an = ANCH[id];
      if (an) for (const k in an) if (name === an[k][0]) CAP.want.set(out, k);   // (where the chest emblem / the eye is this frame)
      return out;
    }
    if (EMBERKEYS[colour]) return emberOf(EMBERKEYS[colour], name);
    if (!KEYS[colour]) return baseTinted.apply(this, arguments);
    const g = glowOf(name);
    return g && g.width ? g : EMPTY;
  };

  // ---------------- the hero, remembered when drawn, drawn again (glow only) after the lighting ----------------
  const H = { on: false, shot: null, p: null, set: null, fight: 0, lastHitT: -9, featherT: 0, dashWas: false, swingWas: false, flash: 0 };
  const baseDP = NC.drawPlayer;
  NC.drawPlayer = function (ctx, game) {
    const p = game.player, id = p && setOf(p.equip);
    if (!id || p.dead > 0) return baseDP.apply(this, arguments);
    H.on = true; H.p = p; H.set = id; H.t = game.time;
    if (EXTRA && SETS[id].halo === 'eclipse' && H.stillK > 0.01 && !G.off && !G.noLight) eclipseDisc(ctx, p, H.stillK);   // (behind him)
    const undo = dress(p, id);
    try { return baseDP.apply(this, arguments); } finally { H.on = false; undo(); }
  };
  // the hero's look of the moment: the cape opened into wings in a fight, the tassets flared on a swing (the items' and
  // the rig's pictures swapped for this one draw; the returned function puts them back)
  function dress(p, id) {
    const undo = [];
    const cape = wingCape(p, id);
    if (cape) undo.push(() => { cape.it.sprite = cape.was; });
    const F = FLARE[id], robe = ITEMS[p.equip.robe];
    if (F && !G.off && robe && robe.rig === id && (H.flare || 0) > 0.05) {
      const set = flareSet(id), rig = NC.getRig(id), lv = Math.min(3, Math.ceil(H.flare * 3 - 0.2));
      if (set && rig && lv > 0) { const was = rig.P.skirt; rig.P.skirt = set[lv]; undo.push(() => { rig.P.skirt = was; }); }
    }
    return () => { for (const f of undo) f(); };
  }
  // FEATHERS FLARE on a swing (2026-10-06, "มาทำดีเทลชุดขาวต่อ"): the tassets' feather plates fan out from the belt and
  // settle. The skirt picture is fanned in 1-px strips round the waist (the middle, the tabard, stays put; the sides
  // turn out the most and lift a little), baked once at three strengths with its glow layer and its gem points
  const FLARE = { wfalcon: { part: 'rig_wfalcon_skirt', ang: 0.5, lift: 0.08, belt: 0.17 } };
  const flared = {};
  // (each column below the belt swings out round its own point on the belt's lower edge, by a turn growing towards
  // the sides; the belt stays. Done per pixel, backwards, with bilinear sampling: rotated 1-px strips aliased)
  function fan(src, IW, IH, jx, jy, k, F) {
    const yb = Math.round(IH * F.belt), half = Math.max(jx, IW - jx), sq = 1 - F.lift * k;
    const pad = Math.ceil((IH - yb) * Math.sin(F.ang * k)) + 3, OW = IW + pad * 2, OH = IH + 2;
    const turn = (x) => -k * F.ang * Math.max(-1, Math.min(1, (x - jx) / half));
    const sc = document.createElement('canvas'); sc.width = IW; sc.height = IH;
    const sx = sc.getContext('2d'); sx.drawImage(src, 0, 0);
    const S = sx.getImageData(0, 0, IW, IH).data;
    const cv = document.createElement('canvas'); cv.width = OW; cv.height = OH;
    const c = cv.getContext('2d'), out = c.createImageData(OW, OH), D = out.data;
    const px = (x, y, ch) => (x < 0 || y < 0 || x >= IW || y >= IH ? 0 : S[(y * IW + x) * 4 + ch]);
    for (let Y = 0; Y < OH; Y++) for (let X = 0; X < OW; X++) {
      let x = X - pad + 0.5, y = Y + 0.5;
      if (y > yb) {                                                     // (find the column that swung here)
        let L = y - yb;
        for (let it = 0; it < 4; it++) { const r = turn(x); L = (Y + 0.5 - yb) / Math.cos(r); x = X - pad + 0.5 + L * Math.sin(r); }
        y = yb + L / sq;
      }
      const fx = x - 0.5, fy = y - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0, o = (Y * OW + X) * 4;
      let A = 0;
      const w = [(1 - ax) * (1 - ay), ax * (1 - ay), (1 - ax) * ay, ax * ay], P = [[x0, y0], [x0 + 1, y0], [x0, y0 + 1], [x0 + 1, y0 + 1]];
      for (let q = 0; q < 4; q++) A += px(P[q][0], P[q][1], 3) * w[q];
      if (A < 1) continue;
      for (let ch = 0; ch < 3; ch++) { let v = 0; for (let q = 0; q < 4; q++) v += px(P[q][0], P[q][1], ch) * px(P[q][0], P[q][1], 3) * w[q]; D[o + ch] = v / A; }
      D[o + 3] = A;
    }
    c.putImageData(out, 0, 0);
    const at = (x, y) => {
      if (y <= yb) return [x + pad, y];
      const r = turn(x), L = (y - yb) * sq;
      return [x + pad - L * Math.sin(r), yb + L * Math.cos(r)];
    };
    return { cv, pad, at };
  }
  function flareSet(id) {
    if (flared[id]) return flared[id];
    const F = FLARE[id], s = NC.SPR[F.part], g = glowOf(F.part);
    if (!s || !s.img || !s.img.naturalWidth || !g || !g.width) return null;          // (not loaded yet)
    const IW = s.img.naturalWidth, IH = s.img.naturalHeight, u = IW / s.w, jx = s.joints.waist[0] * u, jy = s.joints.waist[1] * u;
    const out = [null];
    for (const k of [0.34, 0.67, 1]) {
      const a = fan(s.img, IW, IH, jx, jy, k, F), name = F.part + '_fl' + out.length;
      NC.SPR[name] = { img: a.cv, name, src: '', w: a.cv.width / u, h: a.cv.height / u, ax: 0, ay: 0, joints: { waist: [(jx + a.pad) / u, jy / u] } };
      GLOW[name] = fan(g, IW, IH, jx, jy, k, F).cv;
      const pts = GEMS[id] && GEMS[id][F.part];
      if (pts) GEMS[id][name] = pts.map(([x, y, r]) => [...a.at(x, y), r]);
      out.push(NC.SPR[name]);
    }
    return (flared[id] = out);
  }
  // THE CAPE OPENS INTO WINGS in a fight (half open, then fully open) and folds back when it is over: the cape item's
  // picture swapped for the player's draw only (H.wing: 0 closed .. 1 open, js below moves it)
  const WINGS = { wfalcon: ['rig_wfalcon_wings1', 'rig_wfalcon_wings2'] };
  function wingCape(p, id) {
    const it = ITEMS[p.equip.cape], w = WINGS[id];
    if (!it || p.equip.cape !== 'cape_' + id || !w || G.off || !NC.SPR[w[1]]) return null;
    const k = H.wing || 0, spr = k > 0.72 ? w[1] : k > 0.28 ? w[0] : null;
    if (!spr) return null;
    const was = it.sprite;
    it.sprite = spr;
    return { it, was };
  }
  const baseDH = NC.drawHero;
  NC.drawHero = function (ctx, equip, P, x, y, o) {
    if (H.on && equip === H.p.equip && !(o && o.silhouette)) H.shot = { m: ctx.getTransform(), equip, P, x, y, o: o || {} };
    return baseDH.apply(this, arguments);
  };
  // the sabre: its frame remembered for the after-lighting pass
  const SWF = [];
  const baseDW = NC.drawWeapon;
  NC.drawWeapon = function (ctx, Wd, hx, hy, ang, o) {
    const id = Wd && Wd.id && Wd.id.startsWith('sw_') && SETS[Wd.id.slice(3)] ? Wd.id.slice(3) : null;
    // sheathed in the painted scabbard: the scabbard, then only the hilt over it (the blade, inside, never shows)
    const sh = id && SAYA_ART[id] && o && o.sheath > 0.5 && !o.sayaOnly && !o.silhouette && NC.SPR[Wd.sprite];
    const bent = sh && bentSaya(Wd, sh, id);
    if (bent) {
      baseDW.call(this, ctx, Wd, hx, hy, ang, Object.assign({}, o, { sayaOnly: true }));
      const s = sh, k = (o.scale || 1) * 0.95, w = s.w * k, h = s.h * k, grip = o.grip === undefined ? Wd.grip : o.grip;
      ctx.save();
      ctx.translate(hx, hy); ctx.rotate(ang + Math.PI / 2);
      if (o.len !== undefined && o.len !== 1) ctx.scale(1, o.len);
      ctx.drawImage(s.img, 0, bent.g, bent.IW, bent.IH - bent.g, -s.ax * w, -h * (1 - grip) + bent.g * h / bent.IH, w, (bent.IH - bent.g) * h / bent.IH);
      ctx.restore();
      return;
    }
    baseDW.apply(this, arguments);
    o = o || {};
    if (!id || o.silhouette || o.sayaOnly || o.sheath > 0.5 || G.off) return;   // (in its scabbard: no glow)
    const s = NC.SPR[Wd.sprite], vein = glowOf('w_' + id);
    if (!s || !vein || !vein.width) return;
    const k = (o.scale || 1) * 0.95, w = s.w * k, h = s.h * k, grip = o.grip === undefined ? Wd.grip : o.grip;
    ctx.save();
    ctx.translate(hx, hy); ctx.rotate(ang + Math.PI / 2);
    if (o.len !== undefined && o.len !== 1) ctx.scale(1, o.len);
    const f = { m: ctx.getTransform(), ox: -s.ax * w, oy: -h * (1 - grip), w, h, id, img: s.img, vein };
    ctx.restore();
    if (H.on) SWF.push(f);
    else drawSword(ctx, f, performance.now() / 1000, false);     // (a window, a portrait)
  };

  const off = document.createElement('canvas'), oc = off.getContext('2d');
  const tmp = document.createElement('canvas'), tc = tmp.getContext('2d');
  const smooth = (u) => u * u * (3 - 2 * u);

  // the wave of light up the armour: a calm base + a bright band rising from the feet to the crest every 2.4 s
  const EXTRA = false; // (the rays, halo, orbit, falcon, wings...: off)
  // the lines' colours flowing: a diagonal band of the palette sliding over the glow, round and round (4 s a turn)
  function flow(c, B, S, t) {
    const ph = ((t / 4) % 1) * B;
    const g = c.createLinearGradient(-B + ph, -B * 0.4 + ph * 0.4, B + ph, B * 0.4 + ph * 0.4);
    const P = S.flow, n = P.length;
    for (let k = 0; k <= n * 2; k++) g.addColorStop(k / (n * 2), P[k % n]);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = g; c.fillRect(0, 0, B, B);
    c.globalCompositeOperation = 'source-over';
  }
  const mask = document.createElement('canvas'), mc = mask.getContext('2d');
  function wave(B, t, hot) {
    // (destination-in keeps the glow scaled by the mask's alpha: the rising band 1, the rest the calm base)
    const u = (t % 2.4) / 2.4, y = B * (1.05 - 1.25 * u), base = hot ? 0.75 : 0.42;
    if (mask.width !== B) { mask.width = B; mask.height = B; }
    mc.setTransform(1, 0, 0, 1, 0, 0);
    mc.clearRect(0, 0, B, B);
    const g = mc.createLinearGradient(0, y - B * 0.22, 0, y + B * 0.22);
    g.addColorStop(0, `rgba(0,0,0,${base})`); g.addColorStop(0.5, 'rgba(0,0,0,1)'); g.addColorStop(1, `rgba(0,0,0,${base})`);
    mc.fillStyle = `rgba(0,0,0,${base})`; mc.fillRect(0, 0, B, B);
    mc.globalCompositeOperation = 'copy';
    mc.fillStyle = g; mc.fillRect(0, y - B * 0.22, B, B * 0.44);
    mc.globalCompositeOperation = 'source-over';
    oc.setTransform(1, 0, 0, 1, 0, 0);
    oc.globalCompositeOperation = 'destination-in';
    oc.drawImage(mask, 0, 0);
    oc.globalCompositeOperation = 'source-over';
  }

  const tv = document.createElement('canvas'), tvc = tv.getContext('2d');
  function drawSword(ctx, f, t, swinging) {
    const S = SETS[f.id], { ox, oy, w, h } = f;
    ctx.save();
    ctx.setTransform(f.m);
    ctx.globalCompositeOperation = 'lighter';
    // the edge's own glow in the flowing colours (along the blade) + a soft bloom
    const V = f.vein, VW = V.width, VH = V.height;
    if (tv.width !== VW || tv.height !== VH) { tv.width = VW; tv.height = VH; }
    tvc.setTransform(1, 0, 0, 1, 0, 0); tvc.clearRect(0, 0, VW, VH);
    tvc.drawImage(V, 0, 0);
    const ph = ((t / 2.5) % 1) * VH, gr = tvc.createLinearGradient(0, -VH + ph, 0, VH + ph), P = S.flow, n = P.length;
    for (let k = 0; k <= n * 2; k++) gr.addColorStop(k / (n * 2), P[k % n]);
    tvc.globalCompositeOperation = 'source-atop'; tvc.fillStyle = gr; tvc.fillRect(0, 0, VW, VH); tvc.globalCompositeOperation = 'source-over';
    const a = swinging ? 1 : BLOOD[f.id] && !G.noBeat ? 0.4 + 0.6 * Math.min(1, GT.hb) : 0.6 + 0.22 * Math.sin(t * 2.3) + 0.1 * Math.sin(t * 11.7) * Math.sin(t * 7.1);
    if (!G.noBloom) { ctx.filter = `blur(${Math.max(1.5, w * 0.1).toFixed(1)}px)`; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(tv, ox, oy, w, h); ctx.filter = 'none'; }
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(tv, ox, oy, w, h);
    // the pommel's gem: a soft glint, a flare when the sabre is drawn for a swing
    const sg = SWGEM[f.id];
    if (sg && !G.noBeat) {
      const fl = Math.max(0.25 + 0.2 * Math.sin(t * 3.3), swinging ? 1 : 0), gx = ox + sg[0] * w, gy = oy + sg[1] * h;
      ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(-Math.atan2(f.m.b, f.m.a));
      star(ctx, 0, 0, w * 0.12 * (0.6 + 0.6 * fl), Math.min(1, fl));
      ctx.restore();
    }
    // the sheen: a light band sliding up the blade (every 2.6 s, or fast while swinging), clipped to the sprite
    const per = swinging ? 0.45 : 4.5, u = (t % per) / per;
    if (u < 0.45 && !G.noSwing) {
      const W2 = Math.max(8, Math.ceil(w * 3)), H2 = Math.max(8, Math.ceil(h * 3));
      if (tmp.width !== W2 || tmp.height !== H2) { tmp.width = W2; tmp.height = H2; }
      tc.setTransform(1, 0, 0, 1, 0, 0); tc.clearRect(0, 0, W2, H2);
      tc.globalCompositeOperation = 'source-over';
      tc.drawImage(f.img, 0, 0, W2, H2);
      tc.globalCompositeOperation = 'source-in';
      const yy = H2 * (1 - u / 0.45 * 1.2) + H2 * 0.1;
      const g = tc.createLinearGradient(0, yy - H2 * 0.12, W2 * 0.3, yy + H2 * 0.12);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(${S.light},0.95)`); g.addColorStop(1, 'rgba(255,255,255,0)');
      tc.fillStyle = g; tc.fillRect(0, 0, W2, H2);
      ctx.globalAlpha = swinging ? 0.9 : 0.7;
      ctx.drawImage(tmp, ox, oy, w, h);
    }
    ctx.restore();
  }

  // ================= the effects (the user: "ควรทำเอฟเฟคชุดดีกว่านี้หน่อย ให้มันดูมีลูกเล่นมากขึ้น") =================
  // all drawn after the night's darkness (NC.drawTrail runs there), in world units:
  //   the glowing lines (a wave up the armour) · the sabre's edge + sheen · a halo / an eclipse over the crest ·
  //   FEATHERS ORBITING the hero (more and brighter in a fight) · every 3rd hit one of them FLIES into the monster and
  //   bursts · every 3rd swing a FALCON OF LIGHT (of shadow) swoops ahead · a kill bursts into feathers · walking leaves
  //   light marks (shadow pools) · standing still a while opens RAYS behind the hero (A) / the ECLIPSE grows (B) ·
  //   a dash spreads big WINGS that follow the hero, and the dash ghost takes the set's colour · feathers drifting off
  const TAU = Math.PI * 2;
  const baseTrail = NC.drawTrail;
  NC.drawTrail = function (ctx, game) {
    const s = H.shot, id = H.set, p = H.p;
    H.shot = null;
    const swords = SWF.splice(0);
    if (p && id && !G.off && setOf(p.equip) === id) {
      const S = SETS[id], t = H.t, swinging = !!(p.atk && p.atk.on) && !G.noSwing;
      const dt = Math.min(0.05, Math.max(0, t - (H.lastT || t))); H.lastT = t;
      if (swinging) H.lastHitT = t;
      H.fight = Math.max(0, Math.min(1, H.fight + (t - H.lastHitT < 1.5 ? 1.2 : -0.35) * dt));
      H.wing = Math.max(0, Math.min(1, (H.wing || 0) + (t - H.lastHitT < 2.5 ? 2.2 : -0.9) * dt));   // (opens in ~0.5 s, folds 2.5 s after the last swing)
      const moving = Math.hypot(p.vx || 0, p.vy || 0) > 20 || !!p.dash;
      H.still = moving || swinging ? 0 : (H.still || 0) + dt;
      const stillK = (H.stillK = smooth(Math.max(0, Math.min(1, (H.still - 2.2) / 1.2))));
      const face = s && s.P && s.P.face < 0 ? -1 : 1;
      // (2026-10-05 the user: "เอฟเฟคมันไม่ใช่เลย อยากให้มีขนนกนิดๆ แสงกระพริบตามเส้นหน่อยๆ แบบไล่ๆ สีไป": only the lines
      // twinkling in flowing colours, a few feathers, the sabre's edge and a soft light; the rest stays off: EXTRA)
      if (EXTRA && !G.noLight) backdrop(ctx, p, S, t, stillK);
      // the tassets flare on each new swing of a combo, then settle
      const atk = p.atk, step = atk && atk.on ? atk.step : -1;
      if (swinging && (!H.swingWas || step !== H.stepWas)) H.flareT = t;
      H.stepWas = step;
      const fu = t - (H.flareT === undefined ? -9 : H.flareT);
      H.flare = fu < 0.06 ? fu / 0.06 : 1 - smooth(Math.min(1, (fu - 0.06) / 0.5));
      H.face = face;
      const Bd = BLOOD[id];
      if (Bd) bloodTick(p, S, Bd, id, t, dt, swinging, face);
      if (s && full(s.equip, id)) glowPass(ctx, s, S, t, swinging);
      if (Bd && full(p.equip, id) && !G.noEmbers) { eyeStreak(ctx, t, moving || swinging); bloodFlames(ctx, p, t, face); }
      for (const f of swords) drawSword(ctx, f, t, swinging);
      if (!G.noEmbers && full(p.equip, id)) spiritFly(ctx, p, id, t);
      if (EXTRA && !G.noLight) halo(ctx, p, S, t, stillK);
      if (!G.noEmbers) {
        if (EXTRA) { orbit(ctx, p, S, t); steps(p, S, t, moving); }
        feathers(p, S, t, swinging, face);
      }
      if (!G.noLight) warm(p, S);
    } else for (const f of swords) drawSword(ctx, f, game.time, false);
    return baseTrail.apply(this, arguments);
  };

  function glowPass(ctx, s, S, t, swinging) {
    const m = s.m, k = Math.hypot(m.a, m.b), sc = (s.o.scale || 1) * k;
    const B = Math.ceil(300 * sc), cx = m.a * s.x + m.c * (s.y - 60) + m.e, cy = m.b * s.x + m.d * (s.y - 60) + m.f;
    if (off.width !== B) { off.width = B; off.height = B; }
    oc.setTransform(1, 0, 0, 1, 0, 0); oc.clearRect(0, 0, B, B);
    oc.setTransform(m.a, m.b, m.c, m.d, m.e - (cx - B / 2), m.f - (cy - B / 2));
    const undo = dress(H.p, H.set);
    baseDH.call(NC, oc, s.equip, s.P, s.x, s.y, Object.assign({}, s.o, { silhouette: S.key, tint: null, alpha: 1, noWeapon: true }));
    flow(oc, B, S, t);
    // a gentle twinkle: a slow breath with a little flicker in it, brighter while swinging
    const tw = G.noBeat ? 0.8 : 0.62 + 0.22 * Math.sin(t * 2.3) + 0.1 * Math.sin(t * 11.7) * Math.sin(t * 7.1);
    const a = Math.min(1, tw + (swinging ? 0.3 : 0)) * (S.str || 1);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    if (!G.noBloom) { ctx.filter = `blur(${Math.max(2, 4 * sc).toFixed(1)}px)`; ctx.globalAlpha = 0.9 * a; ctx.drawImage(off, cx - B / 2, cy - B / 2); ctx.filter = 'none'; }
    ctx.globalAlpha = a;
    ctx.drawImage(off, cx - B / 2, cy - B / 2);
    if (H.flash > t) { ctx.globalAlpha = (H.flash - t) / 0.25; ctx.drawImage(off, cx - B / 2, cy - B / 2); }   // (a flare on a falcon swoop)
    ctx.restore();
    // PULSE: a hit sends a ring of light from the falcon on the chest out along the lines to the limbs and the helm
    const pu = (t - (H.pulseT || -9)) / 0.45;
    if (pu >= 0 && pu < 1 && !G.noSwing) {
      if (pul.width !== B) { pul.width = B; pul.height = B; }
      pc.setTransform(1, 0, 0, 1, 0, 0); pc.clearRect(0, 0, B, B);
      pc.drawImage(off, 0, 0);
      const r = B * 0.5 * pu, ccx = B / 2, ccy = B / 2 + 4 * sc;
      const rg = pc.createRadialGradient(ccx, ccy, Math.max(0, r - B * 0.08), ccx, ccy, r + B * 0.04);
      rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(0.6, 'rgba(0,0,0,1)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      pc.globalCompositeOperation = 'destination-in'; pc.fillStyle = rg; pc.fillRect(0, 0, B, B);
      pc.globalCompositeOperation = 'source-atop'; pc.fillStyle = (BLOOD[H.set] && BLOOD[H.set].pulse) || '#fff8e0'; pc.fillRect(0, 0, B, B);
      pc.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - pu) * 1.0;
      ctx.filter = `blur(${Math.max(1.5, 2.5 * sc).toFixed(1)}px)`; ctx.drawImage(pul, cx - B / 2, cy - B / 2); ctx.filter = 'none';
      ctx.drawImage(pul, cx - B / 2, cy - B / 2);
      ctx.restore();
    }
    if (BLOOD[H.set] && !G.noEmbers) embersPass(ctx, s, S, t, m, B, cx, cy, sc);
    // GEMS: the studs, the buckle, the stars on the tabard, the helm's eye: each twinkles on its own beat
    const gk = Object.keys(GEMKEYS).find((k) => GEMKEYS[k] === H.set);
    if (gk && !G.noBeat) {
      GT.t = t; GT.boost = pu >= 0 && pu < 1 ? 0.6 * (1 - pu) : 0;
      if (gem.width !== B) { gem.width = B; gem.height = B; }
      gc.setTransform(1, 0, 0, 1, 0, 0); gc.clearRect(0, 0, B, B);
      gc.setTransform(m.a, m.b, m.c, m.d, m.e - (cx - B / 2), m.f - (cy - B / 2));
      CAP.hit = {}; CAP.want.clear();
      baseDH.call(NC, gc, s.equip, s.P, s.x, s.y, Object.assign({}, s.o, { silhouette: gk, tint: null, alpha: 1, noWeapon: true }));
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.9; ctx.drawImage(gem, cx - B / 2, cy - B / 2);
      ctx.restore();
      // the anchors' places in the world this frame (the falcon of light leaves and comes home at the chest; the eye's streak)
      const an = ANCH[H.set] || {}, inv = new DOMMatrix([m.a, m.b, m.c, m.d, m.e - (cx - B / 2), m.f - (cy - B / 2)]).inverse();
      H.anch = {};
      for (const k in an) {
        const c = an[k], hit = CAP.hit[k];
        if (!hit) continue;
        const wp = inv.transformPoint(hit.m.transformPoint(new DOMPoint(hit.dx + c[1] * hit.w / hit.iw, hit.dy + c[2] * hit.h / hit.ih)));
        H.anch[k] = { x: wp.x, y: wp.y };
      }
      if (H.anch.chest) { H.chest = H.anch.chest; H.chestT = t; }
      CAP.want.clear(); CAP.hit = {};
    }
    undo();
  }
  const pul = document.createElement('canvas'), pc = pul.getContext('2d');
  const emc = document.createElement('canvas'), ec = emc.getContext('2d');
  const emm = document.createElement('canvas'), em = emm.getContext('2d');
  // the coals: the red tips drawn white, masked by a band rising from the hem over a flickering base, tinted ember to
  // crimson, laid on with a bloom; the blood form makes them blaze
  function embersPass(ctx, s, S, t, m, B, cx, cy, sc) {
    const key = Object.keys(EMBERKEYS).find((k) => EMBERKEYS[k] === H.set);
    if (emc.width !== B) { emc.width = B; emc.height = B; emm.width = B; emm.height = B; }
    ec.setTransform(1, 0, 0, 1, 0, 0); ec.clearRect(0, 0, B, B);
    ec.setTransform(m.a, m.b, m.c, m.d, m.e - (cx - B / 2), m.f - (cy - B / 2));
    const undo = dress(H.p, H.set);
    baseDH.call(NC, ec, s.equip, s.P, s.x, s.y, Object.assign({}, s.o, { silhouette: key, tint: null, alpha: 1, noWeapon: true }));
    undo();
    ec.setTransform(1, 0, 0, 1, 0, 0);
    const bl = H.bloodK || 0, u = (t % 2.2) / 2.2, y = B * (0.95 - 0.9 * u);
    const base = Math.min(1, 0.32 + 0.12 * Math.sin(t * 5.3) * Math.sin(t * 3.1) + 0.35 * H.fight + 0.6 * bl);
    em.setTransform(1, 0, 0, 1, 0, 0); em.globalCompositeOperation = 'copy';
    em.fillStyle = `rgba(0,0,0,${base})`; em.fillRect(0, 0, B, B);
    em.globalCompositeOperation = 'source-over';
    const g = em.createLinearGradient(0, y - B * 0.16, 0, y + B * 0.16);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    em.fillStyle = g; em.fillRect(0, y - B * 0.16, B, B * 0.32);
    ec.globalCompositeOperation = 'destination-in'; ec.drawImage(emm, 0, 0);
    const tg = ec.createLinearGradient(0, B, 0, 0);
    tg.addColorStop(0, bl > 0.3 ? '#ffd27a' : '#ff8a3c'); tg.addColorStop(0.5, '#ff3a3a'); tg.addColorStop(1, '#ff1e50');
    ec.globalCompositeOperation = 'source-atop'; ec.fillStyle = tg; ec.fillRect(0, 0, B, B);
    ec.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter';
    if (!G.noBloom) { ctx.filter = `blur(${Math.max(2, (3 + 3 * bl) * sc).toFixed(1)}px)`; ctx.globalAlpha = Math.min(1, 0.9 + 0.6 * bl); ctx.drawImage(emc, cx - B / 2, cy - B / 2); ctx.filter = 'none'; }
    ctx.globalAlpha = Math.min(1, 0.85 + 0.3 * bl);
    ctx.drawImage(emc, cx - B / 2, cy - B / 2);
    ctx.restore();
  }
  const gem = document.createElement('canvas'), gc = gem.getContext('2d');
  // (the gem pass's torso layer, caught as it is drawn: its transform gives the emblem's place)
  const ANCH = { wfalcon: { chest: ['rig_wfalcon_torso', 32, 38] },       // (the falcon emblem on the torso picture, px)
    nfalcon: { chest: ['rig_nfalcon_body', 48, 26], eye: ['hat_nfalcon', 322, 182] } };
  const CAP = { want: new Map(), hit: {} };
  gc.drawImage = function (img, a, b, c, d) {
    const k = CAP.want.get(img);
    if (k && arguments.length === 5) CAP.hit[k] = { m: this.getTransform(), dx: a, dy: b, w: c, h: d, iw: img.width, ih: img.height };
    return CanvasRenderingContext2D.prototype.drawImage.apply(this, arguments);
  };

  // ---------------- the halo / the eclipse, over the crest ----------------
  function halo(ctx, p, S, t, stillK) {
    const x = p.x, y = p.y - 168 + Math.sin(t * 1.6) * 2.5;
    const a = 0.45 + 0.55 * Math.max(H.fight, stillK), r = 17 + 4 * H.fight + 6 * stillK;
    ctx.save();
    ctx.translate(x, y); ctx.scale(1, 0.34);
    if (S.halo === 'ring') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = 3;
      ctx.strokeStyle = `rgba(${S.light},${0.9 * a})`;
      ctx.shadowColor = `rgba(${S.light},${a})`; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      ctx.lineWidth = 1.2; ctx.strokeStyle = `rgba(255,250,235,${0.8 * a})`;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, TAU); ctx.stroke();
      ctx.shadowBlur = 0;
      for (let i = 0; i < 4; i++) { const q = t * 1.9 + i * TAU / 4; ctx.fillStyle = `rgba(255,250,230,${a})`; ctx.beginPath(); ctx.arc(Math.cos(q) * r, Math.sin(q) * r, 2.2, 0, TAU); ctx.fill(); }
    } else {
      ctx.fillStyle = `rgba(8,4,14,${0.92 * a})`;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = 2.4; ctx.strokeStyle = `rgba(${S.light},${a})`; ctx.shadowColor = `rgba(${S.light},${a})`; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.84, 0, TAU); ctx.stroke();
      ctx.shadowBlur = 0;
      for (let i = 0; i < 16; i++) {
        const q = i / 16 * TAU + t * 0.4, l = r * (1.08 + 0.3 * (0.5 + 0.5 * Math.sin(t * 3 + i * 1.7)));
        ctx.strokeStyle = `rgba(${S.light},${0.55 * a})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(Math.cos(q) * r * 0.9, Math.sin(q) * r * 0.9); ctx.lineTo(Math.cos(q) * l, Math.sin(q) * l); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ---------------- standing still: rays of light behind (A) / the eclipse rising behind (B) ----------------
  function backdrop(ctx, p, S, t, k) {
    if (k <= 0.01) return;
    ctx.save();
    ctx.translate(p.x, p.y - 95);
    ctx.globalCompositeOperation = 'lighter';
    if (S.halo === 'ring') {
      for (let i = 0; i < 9; i++) {
        const a0 = -Math.PI / 2 + (i - 4) * 0.22 + Math.sin(t * 0.7 + i) * 0.03, L = 150 + 30 * Math.sin(t * 1.3 + i * 2.1);
        const g = ctx.createLinearGradient(0, 0, Math.cos(a0) * L, Math.sin(a0) * L);
        g.addColorStop(0, `rgba(${S.light},${0.32 * k})`); g.addColorStop(1, `rgba(${S.light},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a0 - 0.05) * L, Math.sin(a0 - 0.05) * L); ctx.lineTo(Math.cos(a0 + 0.05) * L, Math.sin(a0 + 0.05) * L);
        ctx.closePath(); ctx.fill();
      }
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 70);
      g.addColorStop(0, `rgba(${S.light},${0.35 * k})`); g.addColorStop(1, `rgba(${S.light},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 70, 0, TAU); ctx.fill();
    } else {
      // a big black sun behind the hero, a violet corona breathing round it
      const R = 46 * k;
      const g = ctx.createRadialGradient(0, -20, R * 0.8, 0, -20, R * 1.9);
      g.addColorStop(0, `rgba(${S.light},${0.55 * k})`); g.addColorStop(1, `rgba(${S.light},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -20, R * 1.9, 0, TAU); ctx.arc(0, -20, R * 0.95, 0, TAU, true); ctx.fill('evenodd');   // (a ring: not over the hero)
      for (let i = 0; i < 22; i++) {
        const q = i / 22 * TAU + t * 0.25, l = R * (1.15 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2.2 + i * 2.3)));
        ctx.strokeStyle = `rgba(${S.light},${0.5 * k})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(Math.cos(q) * R, -20 + Math.sin(q) * R); ctx.lineTo(Math.cos(q) * l, -20 + Math.sin(q) * l); ctx.stroke();
      }
    }
    ctx.restore();
  }
  // the eclipse's black sun itself, drawn in the world before the hero (so he stands in front of it)
  function eclipseDisc(ctx, p, k) {
    const R = 46 * k;
    ctx.save();
    ctx.globalAlpha = 0.9 * k;
    ctx.fillStyle = '#07040c'; ctx.beginPath(); ctx.arc(p.x, p.y - 115, R * 0.96, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // ---------------- feathers ----------------
  function featherShape(ctx, len, col, edge) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.45, -len * 0.26, len, 0);
    ctx.quadraticCurveTo(len * 0.45, len * 0.2, 0, 0);
    ctx.fillStyle = col; ctx.fill();
    if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = Math.max(0.6, len * 0.06); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-len * 0.15, 0); ctx.lineTo(len * 0.95, 0);
    ctx.strokeStyle = edge || 'rgba(0,0,0,0.3)'; ctx.lineWidth = Math.max(0.5, len * 0.04); ctx.stroke();
  }
  const glowDot = (ctx, x, y, r, rgb, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  };
  function feather(S, x, y, vx, vy, big) {
    FX.add({ type: 'custom', layer: 'glow', x, y, life: NC.rand(1.4, 2.4), vx, vy, drag: 0.9, rot: NC.rand(0, TAU), spin: NC.rand(-3, 3),
      len: NC.rand(7, 11) * (big ? 1.3 : 1), sway: NC.rand(0, TAU),
      draw(ctx, q, u) {
        q.vy += (8 - q.vy) * 0.02;
        const al = Math.min(1, u / 0.08) * (1 - u);
        ctx.save();
        ctx.translate(q.x + Math.sin(q.sway + u * 9) * 6, q.y);
        ctx.rotate(q.rot + q.spin * u);
        ctx.globalAlpha = al;
        featherShape(ctx, q.len, S.feather[0], S.feather[1]);
        ctx.globalCompositeOperation = 'lighter';
        if (S.spark) glowDot(ctx, q.len, 0, 4, S.spark, al * 0.9);
        else glowDot(ctx, q.len * 0.5, 0, q.len * 0.7, S.light, al * 0.3);
        ctx.restore();
      } });
  }
  function burst(S, x, y, n, power) {
    for (let i = 0; i < n; i++) { const a = NC.rand(0, TAU), v = NC.rand(60, 200) * power; feather(S, x, y, Math.cos(a) * v, Math.sin(a) * v - 40, true); }
    FX.add({ type: 'custom', layer: 'glow', x, y, life: 0.4,
      draw(ctx, q, u) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(${S.light},${(1 - u) * 0.9})`; ctx.lineWidth = 4 * (1 - u) + 1;
        ctx.beginPath(); ctx.ellipse(q.x, q.y, 20 + 70 * u * power, (20 + 70 * u * power) * 0.45, 0, 0, TAU); ctx.stroke();
        glowDot(ctx, q.x, q.y, 34 * power, S.light, (1 - u) * 0.6);
        ctx.restore();
      } });
  }

  // the feathers circling the hero: 3 faint ones at rest, up to 7 bright ones in a fight; a hit sends one off
  const ORB = { ang: 0, gone: [] };
  function orbit(ctx, p, S, t) {
    const n = 3 + Math.round(4 * H.fight);
    ORB.ang += 1.4 * (0.6 + H.fight) * (1 / 60);
    for (let i = 0; i < n; i++) {
      if (ORB.gone[i] > t) continue;                                     // (this one is out, flying)
      const a = ORB.ang + i * TAU / n, x = p.x + Math.cos(a) * 48, y = p.y - 58 + Math.sin(a) * 16 + Math.sin(t * 2 + i) * 4;
      const front = Math.sin(a) > 0, al = (front ? 0.95 : 0.4) * (0.5 + 0.5 * H.fight);
      ctx.save();
      ctx.translate(x, y); ctx.rotate(a + Math.PI / 2 + Math.sin(t * 3 + i) * 0.2);
      ctx.globalAlpha = al;
      featherShape(ctx, 12, S.feather[0], S.feather[1]);
      ctx.globalCompositeOperation = 'lighter';
      glowDot(ctx, 6, 0, 10, S.spark || S.light, al * 0.45);
      ctx.restore();
    }
  }
  function shoot(p, S, e) {
    const n = 3 + Math.round(4 * H.fight), i = (H.shots = (H.shots || 0) + 1) % n;
    ORB.gone[i] = H.t + 1.2;
    const a = ORB.ang + i * TAU / n, x0 = p.x + Math.cos(a) * 48, y0 = p.y - 58 + Math.sin(a) * 16;
    const ex = e.x, ey = e.y - 40;
    FX.add({ type: 'custom', layer: 'glow', x: x0, y: y0, life: 0.22,
      draw(ctx, q, u) {
        const k = u * u, x = x0 + (ex - x0) * k, y = y0 + (ey - y0) * k - Math.sin(u * Math.PI) * 30;
        const ang = Math.atan2(ey - y0, ex - x0);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(${S.light},0.7)`; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - Math.cos(ang) * 40, y - Math.sin(ang) * 40); ctx.lineTo(x, y); ctx.stroke();
        ctx.translate(x, y); ctx.rotate(ang);
        ctx.globalCompositeOperation = 'source-over';
        featherShape(ctx, 16, S.feather[0], S.feather[1]);
        ctx.restore();
        if (u > 0.97 && !q.hit) { q.hit = true; burst(S, ex, ey, 5, 0.6); }
      } });
  }

  // the falcon of light (of shadow): every 3rd swing it swoops ahead, wings beating, and breaks into feathers
  function falcon(p, S, face) {
    H.flash = H.t + 0.25;
    const x0 = p.x + face * 20, y0 = p.y - 70, dist = 360;
    FX.add({ type: 'custom', layer: 'glow', x: x0, y: y0, life: 0.6, face,
      draw(ctx, q, u) {
        const e = 1 - (1 - u) * (1 - u), x = x0 + face * dist * e, y = y0 - 26 * Math.sin(u * Math.PI);
        const flap = Math.sin(u * 22) * 0.55, al = u < 0.8 ? 1 : (1 - u) / 0.2, sc = 1 + 0.4 * u;
        ctx.save();
        // the streak behind it
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(x - face * 160, y, x, y);
        g.addColorStop(0, `rgba(${S.light},0)`); g.addColorStop(1, `rgba(${S.light},${0.55 * al})`);
        ctx.strokeStyle = g; ctx.lineWidth = 10; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - face * 160, y + 6); ctx.lineTo(x, y); ctx.stroke();
        ctx.translate(x, y); ctx.scale(face * sc, sc);
        // the bird, seen from above flying ahead: swept wings beating (their span follows the beat), a fanned tail,
        // a head with a hooked beak; code-drawn, glowing
        const body = S.spark ? 'rgba(30,14,50,0.95)' : 'rgba(255,250,232,0.92)', edge = S.spark ? `rgba(${S.spark},1)` : 'rgba(226,184,90,1)';
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = al;
        falconShape(ctx, Math.cos(u * 26), body, edge);
        ctx.globalCompositeOperation = 'lighter';
        glowDot(ctx, 0, 0, 46, S.spark || S.light, 0.45 * al);
        ctx.restore();
        if (u > 0.96 && !q.done) { q.done = true; burst(S, x, y, 10, 1); }
        else if (Math.random() < 0.35) feather(S, x - face * 10, y, -face * NC.rand(20, 60), NC.rand(-30, 30), false);
      } });
  }

  function falconShape(ctx, beat, body, edge) {
    const span = 0.35 + 0.65 * Math.abs(beat);                       // (wings fold and open)
    ctx.lineJoin = 'round';
    ctx.fillStyle = body; ctx.strokeStyle = edge; ctx.lineWidth = 1.6;
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(6, sd * 3);
      ctx.bezierCurveTo(2, sd * 18 * span, -8, sd * 34 * span, -20, sd * 40 * span);   // the leading edge out to the tip
      // the trailing edge: four primary feathers back towards the body
      for (let k = 0; k < 4; k++) {
        const f = k / 4, x = -20 + 10 * f, y = sd * 40 * span * (1 - f * 0.8);
        ctx.lineTo(x - 7, y - sd * 2); ctx.lineTo(x + 2, y - sd * 9 * span);
      }
      ctx.lineTo(-10, sd * 4);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // the tail fan
    ctx.beginPath(); ctx.moveTo(-12, -3); ctx.lineTo(-28, -8); ctx.lineTo(-31, 0); ctx.lineTo(-28, 8); ctx.lineTo(-12, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
    // the body and the head with its hooked beak
    ctx.beginPath(); ctx.ellipse(-2, 0, 15, 5.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(13, 0, 5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(17, -2); ctx.quadraticCurveTo(24, -1, 22, 3); ctx.lineTo(17, 2); ctx.closePath();
    ctx.fillStyle = edge; ctx.fill();
  }

  // wings on a dash: big, spreading from the back, following the hero, then breaking into feathers
  function wings(p, S) {
    FX.add({ type: 'custom', layer: 'glow', x: p.x, y: p.y, life: 0.6,
      draw(ctx, q, u) {
        const P = H.p || p, face = P.pose && P.pose.face < 0 ? -1 : 1;
        const open = smooth(Math.min(1, u / 0.22)), al = u < 0.55 ? 1 : (1 - u) / 0.45;
        ctx.save();
        ctx.translate(P.x - face * 8, P.y - 70);
        ctx.scale(-face, 1);                                          // (+x = behind the back)
        const body = S.spark ? 'rgba(26,12,44,0.92)' : 'rgba(255,253,246,0.78)', edge = S.spark ? `rgba(${S.spark},0.95)` : 'rgba(226,184,90,0.95)';
        ctx.globalCompositeOperation = 'source-over';
        for (const [lift, k] of [[-1, 1], [-0.55, 0.82]]) {           // the near wing up, the far wing lower and smaller
          for (let i = 0; i < 9; i++) {
            ctx.save();
            const spread = -1.55 + (lift < -0.8 ? 0 : 0.5) + i * (0.17 * open + 0.02);
            ctx.rotate(spread);
            ctx.globalAlpha = al * (0.6 + 0.04 * i) * (lift < -0.8 ? 1 : 0.75);
            featherShape(ctx, (38 + i * 7) * k * (0.5 + 0.5 * open), body, edge);
            ctx.restore();
          }
        }
        ctx.globalCompositeOperation = 'lighter';
        glowDot(ctx, 30, -20, 90, S.spark || S.light, 0.35 * al);
        ctx.restore();
        if (u > 0.55 && !q.broke) { q.broke = true; for (let i = 0; i < 14; i++) feather(S, P.x - face * NC.rand(0, 60), P.y - NC.rand(40, 130), -face * NC.rand(20, 120), NC.rand(-60, 20), true); }
      } });
  }

  function feathers(p, S, t, swinging, face) {
    if (t > H.featherT) {
      H.featherT = t + (swinging ? 0.35 : 1.1);
      feather(S, p.x - face * NC.rand(6, 30), p.y - NC.rand(18, 70), -face * NC.rand(8, 30) + (swinging ? face * NC.rand(40, 120) : 0), NC.rand(-30, -5), swinging);
    }
    if (swinging && !H.swingWas) {
      for (let i = 0; i < (EXTRA ? 6 : 2); i++) feather(S, p.x + face * NC.rand(10, 50), p.y - NC.rand(30, 80), face * NC.rand(60, 180), NC.rand(-80, 20), true);
      H.swings = (H.swings || 0) + 1;
      if (EXTRA && H.swings % 3 === 0) falcon(p, S, face);
    }
    H.swingWas = swinging;
    const dashing = !!p.dash;
    if (EXTRA && dashing && !H.dashWas) wings(p, S);
    H.dashWas = dashing;
  }

  // walking: light marks (A: little gold feather glyphs) / shadow pools (B) at the feet
  function steps(p, S, t, moving) {
    if (!moving || t < (H.stepT || 0)) return;
    H.stepT = t + 0.2;
    const x = p.x + NC.rand(-6, 6), y = p.y + NC.rand(-2, 3);
    FX.add({ type: 'custom', layer: 'low', x, y, life: 0.9, rot: NC.rand(-0.6, 0.6),
      draw(ctx, q, u) {
        ctx.save();
        ctx.translate(q.x, q.y); ctx.scale(1, 0.4);
        if (S.spark) {
          ctx.fillStyle = `rgba(10,4,20,${0.55 * (1 - u)})`;
          ctx.beginPath(); ctx.arc(0, 0, 10 + 14 * u, 0, TAU); ctx.fill();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `rgba(${S.spark},${0.7 * (1 - u)})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 0, 10 + 14 * u, 0, TAU); ctx.stroke();
        } else {
          ctx.globalCompositeOperation = 'lighter';
          ctx.rotate(q.rot);
          ctx.globalAlpha = 0.85 * (1 - u);
          featherShape(ctx, 14, `rgba(${S.light},0.7)`, 'rgba(255,250,230,0.9)');
          glowDot(ctx, 6, 0, 16, S.light, 0.4 * (1 - u));
        }
        ctx.restore();
      } });
  }

  // a hit on a monster: every 3rd one an orbiting feather flies into it; a kill bursts into feathers
  const baseDmg = NC.damageEnemy;
  NC.damageEnemy = function (game, e, r, kx, ky, o) {
    const was = e && e.hp;
    const out = baseDmg.apply(this, arguments);
    const p = game && game.player, id = p && setOf(p.equip);
    if (id && e && !G.off && !G.noEmbers && !(o && o.dot) && r && !r.miss && r.mine !== false) {
      const S = SETS[id];
      H.hits = (H.hits || 0) + 1;
      H.pulseT = H.t;                                                  // (the pulse along the lines)
      BIRD.hits++;
      const Bd = BLOOD[id];
      if (Bd && full(p.equip, id) && !H.bloodOn) { H.blood = (H.blood || 0) + 1; if (H.blood >= Bd.need) bloodStart(p); }
      if (SPIRIT[id] && full(p.equip, id) && !BIRD.out && BIRD.hits >= 3 && H.t >= BIRD.ready) spiritGo(p, id);
      if (EXTRA && H.hits % 3 === 0) shoot(p, S, e);
      if (EXTRA && was > 0 && e.hp <= 0) burst(S, e.x, e.y - 40, 14, 1.2);
    }
    return out;
  };

  // ---------------- THE FALCON OF THE CHEST EMBLEM (2026-10-06, the white set: "มาทำดีเทลชุดขาวต่อ") ----------------
  // in a fight (the 3rd hit, 6 s after its last flight) the engraved falcon's light leaves the chest as a little falcon
  // of light (assets/falcon/spirit_<set>.png, tools/falcon_cut.py spirit: 4 wingbeats, a glide, a dive, flying right,
  // every beak at one point of its cell): it grows as it rises ahead, circles the hero once (low in front, high over
  // the crest behind), then stoops back into the emblem: a flash, the pulse along the lines, every gem flaring
  const SPIRIT = { wfalcon: { src: 'assets/falcon/spirit_wfalcon.png', n: 6, len: 58, body: [118, 126], light: '255,214,120', tint: '#ffcf6e' } };
  const spiritImg = {};
  for (const [id, Sp] of Object.entries(SPIRIT)) { const im = new Image(); im.src = Sp.src; spiritImg[id] = im; }
  // (white on the white armour it vanished: the bird is warmed to gold, the colour of the emblem it came from)
  const goldOf = {};
  function goldBird(id) {
    const img = spiritImg[id];
    if (goldOf[id] || !img.naturalWidth) return goldOf[id] || img;
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = SPIRIT[id].tint; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(img, 0, 0);
    return (goldOf[id] = c);
  }
  const BIRD = { out: false, t0: 0, ready: 0, hits: 0, face: 1, trail: [], pos: { x: 0, y: 0 }, fl: 1 };
  const RISE = 0.45, LOOP = 2.4, DIVE = 0.3;
  const chestAt = (p) => (H.chest && H.chestT === H.t ? H.chest : { x: p.x + 2 * (H.face || 1), y: p.y - 52 });
  function spiritGo(p, id) {
    const Sp = SPIRIT[id];
    if (!spiritImg[id].naturalWidth) return;
    Object.assign(BIRD, { out: true, t0: H.t, hits: 0, face: H.face || 1, trail: [], id });
    const E = chestAt(p);
    BIRD.pos.x = E.x; BIRD.pos.y = E.y;
    FX.lights.push({ x: E.x, y: E.y, r: 120, rgb: Sp.light, a: 0.55, life: RISE + LOOP + DIVE + 0.3, t: 0, follow: BIRD.pos });
    spark(E.x, E.y, Sp.light, 0.45);
  }
  // where the bird is u s into its flight (world), its size, the frame
  function birdAt(p, u) {
    const E = chestAt(p), dir = BIRD.face, ph0 = dir > 0 ? 0 : Math.PI, cy = p.y - 120, rx = 100, ry = 66;
    const orb = (s) => { const ph = ph0 + dir * s; return { x: p.x + Math.cos(ph) * rx, y: cy + Math.sin(ph) * ry, d: Math.sin(ph) }; };
    if (u < RISE) {
      const k = 1 - (1 - u / RISE) ** 2, o = orb(0);
      return { x: E.x + (o.x - E.x) * k, y: E.y + (o.y - E.y) * k - Math.sin(k * Math.PI) * 26, sc: 0.3 + 0.7 * k, a: Math.min(1, u / 0.08) };
    }
    if (u < RISE + LOOP) {
      const s = (u - RISE) / LOOP * Math.PI * 2, o = orb(s);
      return { x: o.x, y: o.y, sc: 0.9 + 0.1 * o.d, a: 0.78 + 0.22 * o.d };
    }
    const k = Math.min(1, (u - RISE - LOOP) / DIVE) ** 2, o = orb(Math.PI * 2);
    return { x: o.x + (E.x - o.x) * k, y: o.y + (E.y - o.y) * k, sc: 1 - 0.65 * k, a: 1, dive: true };
  }
  function spiritFly(ctx, p, id, t) {
    if (!BIRD.out || BIRD.id !== id) return;
    const Sp = SPIRIT[id], img = goldBird(id), u = t - BIRD.t0;
    if (u >= RISE + LOOP + DIVE) {                                      // home: the emblem lights up, the lines pulse
      BIRD.out = false; BIRD.ready = t + 6;
      H.pulseT = t; H.flash = t + 0.3;
      const E = chestAt(p);
      spark(E.x, E.y, Sp.light, 0.9);
      return;
    }
    const b = birdAt(p, u), b0 = birdAt(p, Math.max(0, u - 1 / 30));
    const vx = b.x - b0.x, vy = b.y - b0.y;
    if (Math.abs(vx) > 0.4) BIRD.fl = vx > 0 ? 1 : -1;
    BIRD.pos.x = b.x; BIRD.pos.y = b.y;
    const flap = Math.floor(u * 13) % 4;
    const fr = b.dive ? 5 : u < RISE || vy < -0.6 ? flap : (Math.floor(u * 3) % 3 === 0 ? flap : 1);   // (flaps climbing, mostly glides down)
    const tilt = Math.max(-0.6, Math.min(0.6, Math.atan2(vy, Math.abs(vx) + 1e-3))) - (b.dive ? 0.45 : 0);
    BIRD.trail.unshift({ x: b.x, y: b.y, fl: BIRD.fl, tilt, fr, sc: b.sc });
    if (BIRD.trail.length > 9) BIRD.trail.pop();
    const cw = img.width / Sp.n, ch = img.height, k = Sp.len / cw;
    const zoom = Math.hypot(ctx.getTransform().a, ctx.getTransform().b);
    const one = (q, al, blur) => {
      ctx.save();
      ctx.translate(q.x, q.y); ctx.scale(q.fl * q.sc * k, q.sc * k); ctx.rotate(q.tilt);   // (mirrored first: the nose dips either way)
      ctx.globalAlpha = al;
      if (blur) ctx.filter = `blur(${blur.toFixed(1)}px)`;
      ctx.drawImage(img, q.fr * cw, 0, cw, ch, -Sp.body[0], -Sp.body[1], cw, ch);
      ctx.restore();
    };
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glowDot(ctx, b.x, b.y, 34 * b.sc, Sp.light, 0.35 * b.a);
    for (const [i, al] of [[3, 0.22], [6, 0.12]]) if (BIRD.trail[i]) one(BIRD.trail[i], al * b.a, 0);   // (afterimages)
    if (!G.noBloom) one(BIRD.trail[0], 0.75 * b.a, Math.max(1.5, 3 * zoom * b.sc));
    ctx.globalCompositeOperation = 'source-over';
    one(BIRD.trail[0], b.a, 0);
    ctx.restore();
    if (Math.random() < 0.12) feather(SETS[id], b.x, b.y, -BIRD.fl * NC.rand(10, 40), NC.rand(-10, 20), false);
  }
  function spark(x, y, rgb, power) {
    FX.add({ type: 'custom', layer: 'glow', x, y, life: 0.35,
      draw(ctx, q, u) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        glowDot(ctx, q.x, q.y, 30 * power * (0.6 + u), rgb, (1 - u) * 0.8);
        ctx.strokeStyle = `rgba(${rgb},${(1 - u) * 0.9})`; ctx.lineWidth = 2.5 * (1 - u) + 0.5;
        ctx.beginPath(); ctx.ellipse(q.x, q.y, 8 + 34 * u * power, (8 + 34 * u * power) * 0.6, 0, 0, TAU); ctx.stroke();
        ctx.restore();
      } });
  }

  // ---------------- the night falcon's red, frame by frame ----------------
  const beat = (u) => Math.max(Math.exp(-(((u - 0.08) / 0.06) ** 2)), 0.7 * Math.exp(-(((u - 0.27) / 0.07) ** 2)));
  function bloodTick(p, S, Bd, id, t, dt, swinging, face) {
    // the gauge drains out of a fight; the blood form runs its ten seconds, then dies back down
    if (!H.bloodOn && t - H.lastHitT > 3) H.blood = Math.max(0, (H.blood || 0) - dt * 0.8);
    if (H.bloodOn && t > H.bloodEnd) { H.bloodOn = false; H.blood = 0; }
    const left = H.bloodOn ? H.bloodEnd - t : 0, into = H.bloodOn ? t - H.bloodT : 9;
    H.bloodK = H.bloodOn ? Math.min(smooth(Math.min(1, into / 0.4)), smooth(Math.min(1, left / 1.5))) : 0;
    // the heart: faster as the gauge fills, racing in the blood form
    const fill = Math.min(1, (H.blood || 0) / Bd.need), per = H.bloodOn ? 0.42 : 1.3 - 0.75 * fill;
    H.hbPh = ((H.hbPh || 0) + dt / per) % 1;
    GT.hb = G.noBeat ? 0.5 : 0.22 + 0.78 * beat(H.hbPh) + 0.35 * H.bloodK;
    // the eye: a steady glow, a flare on a swing or a dash
    const dashing = !!p.dash, swingStart = swinging && !H.swingWas;
    if (swingStart || (dashing && !H.eyeDash)) H.eyeT = t;
    H.eyeDash = dashing;
    const et = H.eyeT === undefined ? -9 : H.eyeT, fl = t >= et ? Math.exp(-(t - et) / 0.22) : 0;
    H.eyeFl = fl;
    GT.eye = 0.5 + 0.08 * Math.sin(t * 2.1) + 0.6 * fl + 0.4 * H.bloodK;
    // the sparks off the red tips: a few, more in a fight, a shower in the blood form, a burst on each swing
    if (!G.noEmbers) {
      if (t > (H.sparkT || 0)) { H.sparkT = t + (H.bloodOn ? 0.035 : H.fight > 0.2 ? 0.12 : 0.3); ember(p, face, H.bloodOn); }
      if (swingStart) for (let i = 0; i < (H.bloodOn ? 12 : 6); i++) ember(p, face, true);
    }
    // the cape flutters in the blood form
    const cape = ITEMS[p.equip.cape];
    if (cape && p.equip.cape === 'cape_' + id) cape.trail = (S.capeTrail || 0) + H.bloodK * (0.16 + 0.1 * Math.sin(t * 11));
  }
  // an ember off a red tip: the feather skirt's hem, the cape's hem or the helm's plumes, rising and dying out
  function ember(p, face, big) {
    const w = Math.random(), x = w < 0.45 ? p.x + NC.rand(-16, 16) : w < 0.8 ? p.x - face * NC.rand(10, 26) : p.x - face * NC.rand(16, 40);
    const y = w < 0.45 ? p.y - NC.rand(10, 24) : w < 0.8 ? p.y - NC.rand(4, 32) : p.y - NC.rand(100, 140);
    FX.add({ type: 'custom', layer: 'glow', x, y, life: NC.rand(0.6, 1.2) * (big ? 1.3 : 1), vx: NC.rand(-12, 12), vy: NC.rand(-60, -25), drag: 0.6,
      r: NC.rand(1.1, 2.1) * (big ? 1.4 : 1), ph: NC.rand(0, TAU),
      draw(ctx, q, u) {
        const al = (1 - u) * (0.6 + 0.4 * Math.sin(q.ph + u * 30)), x = q.x + Math.sin(q.ph + u * 6) * 3;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        glowDot(ctx, x, q.y, q.r * 3.2, '255,70,50', al * 0.55);
        ctx.fillStyle = `rgba(255,${(210 - 140 * u) | 0},${(150 - 130 * u) | 0},${al})`;
        ctx.beginPath(); ctx.arc(x, q.y, q.r * (1 - 0.5 * u), 0, TAU); ctx.fill();
        ctx.restore();
      } });
  }
  // the eye's streak: where the eye-slit has been the last moments, a red line thinning behind it (when the head moves
  // fast or the eye flares)
  const EYE = [];
  function eyeStreak(ctx, t, busy) {
    const e = H.anch && H.anch.eye;
    if (e) EYE.push({ x: e.x, y: e.y, t });
    while (EYE.length && t - EYE[0].t > 0.22) EYE.shift();
    const k = Math.max(H.eyeFl || 0, busy ? 0.55 : 0, (H.bloodK || 0) * 0.8);
    if (!e || k < 0.05 || EYE.length < 2) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let i = 1; i < EYE.length; i++) {
      const a = EYE[i - 1], b = EYE[i], f = i / (EYE.length - 1);
      ctx.strokeStyle = `rgba(255,${(60 + 120 * f) | 0},${(70 + 90 * f) | 0},${k * f})`; ctx.lineWidth = 0.6 + 2.6 * f;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    // the flare itself: a short bright line across the slit
    if (H.eyeFl > 0.05) {
      const g = ctx.createLinearGradient(e.x - 16, e.y, e.x + 16, e.y);
      g.addColorStop(0, 'rgba(255,40,60,0)'); g.addColorStop(0.5, `rgba(255,220,220,${H.eyeFl})`); g.addColorStop(1, 'rgba(255,40,60,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(e.x - 16, e.y); ctx.lineTo(e.x + 16, e.y); ctx.stroke();
      glowDot(ctx, e.x, e.y, 9, '255,50,70', 0.6 * H.eyeFl);
    }
    ctx.restore();
  }
  // the blood form's flames licking up from the red tips (the skirt's hem, the cape's hem behind)
  const FLAME_PAL = ['#b3102c', '#ff5236', '#ffe2a6'];
  function bloodFlames(ctx, p, t, face) {
    const k = H.bloodK || 0, V = NC.VFX;
    if (k < 0.03 || !V || !V.flame) return;
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const x = p.x - 16 + i * 8 + Math.sin(t * 3 + i) * 1.5, h = (10 + 5 * Math.sin(t * 7 + i * 2.3)) * k;
      V.flame(ctx, x, p.y - 14 + (i % 2) * 2, 6.5, h, t * 9 + i * 1.7, FLAME_PAL, 0.85 * k);
    }
    for (let i = 0; i < 3; i++) {
      const x = p.x - face * (12 + i * 7), h = (9 + 4 * Math.sin(t * 8 + i * 1.9)) * k;
      V.flame(ctx, x, p.y - 6 - i * 3, 6, h, t * 8 + i * 2.1, FLAME_PAL, 0.75 * k);
    }
    ctx.restore();
  }
  function bloodStart(p) {
    const Bd = BLOOD[H.set];
    if (!Bd || !p) return;
    H.bloodOn = true; H.bloodT = H.t; H.bloodEnd = H.t + Bd.dur; H.flash = H.t + 0.35; H.pulseT = H.t;
    const c = (H.anch && H.anch.chest) || { x: p.x, y: p.y - 52 };
    spark(c.x, c.y, '255,60,80', 1.6);
    for (let i = 0; i < 16; i++) ember(p, H.face || 1, true);
  }

  // the dash ghost in the set's colour (fx.js draws it with the player's own colour)
  const GHOST = { wfalcon: '#ffe9b8', efalcon: '#7a4cff' };
  const baseDH2 = NC.drawHero;
  NC.drawHero = function (ctx, equip, P, x, y, o) {
    if (o && o.silhouette && o.noBend && H.p && (o.silhouette === '#9dff8f' || o.silhouette === '#bfe3ff')) {   // (entities.js's dash ghosts)
      const id = setOf(equip);
      if (id && !G.off && EXTRA) o = Object.assign({}, o, { silhouette: GHOST[id] });
    }
    return baseDH2.call(this, ctx, equip, P, x, y, o);
  };

  const lights = {};
  function warm(p, S) {
    let l = lights[S.light];
    if (!l || !FX.lights.includes(l)) { l = lights[S.light] = { x: p.x, y: p.y - 40, r: 190, rgb: S.light, a: 0, life: 0.5, t: 0, follow: p, oy: -40 }; FX.lights.push(l); }
    l.a = 0.35 + 0.35 * H.fight + 0.5 * (H.bloodK || 0); l.t = 0.05;
  }
  NC.FalconSet = { sets: SETS, live, wings: () => H.p && wings(H.p, SETS[H.set]), falcon: () => H.p && falcon(H.p, SETS[H.set], 1),
    spirit: () => H.p && spiritGo(H.p, H.set), blood: () => bloodStart(H.p), flareSet, H, BIRD, GT };     // (tests and videos)
})();
