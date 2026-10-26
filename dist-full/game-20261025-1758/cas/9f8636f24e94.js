/* reapergun.js — REAPER GUN (เกราะปืนยมทูต), the endgame GUNSLINGER set (the user, 2026-10-09, with a picture of a sci-fi
   action-hero power armour: "ทำชุดตัวอะไรดี แบบเหมือนชุด rockman" -> "Gunslinger ดำแดง" -> concept "B"): glossy black angular
   power armour with glowing blood-red strips, a helmet with two blade fins, a red brow visor and a face guard over the nose
   and mouth, spiked pauldrons with red triangles, a long split armoured coat (ONE garment with the breastplate:
   rig_reapergun_body), twin wrist-cannon pistols. Our own design: the picture was only the mood.
     glow   tools/veinglow.py --hue red made a <sprite>_vein.png for every piece; after the night's darkness the hero is drawn
            again with those layers only ('#reaperglow'), blurred (bloom) + sharp, a slow pulse like a reactor, brighter as
            he shoots; a red light round him
     U      the helmet with the face guard <-> without it
   Art: assets/gen/make_reapergun_prompts.py -> tools/reapergun_cut.py. Local player only. NC.ReaperGun.on = false = off.
   TEST: ?equip=robe_reapergun,hat_reapergun,gun_reapergun&job=gunslinger */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, FX = NC.FX, M = NC.ASSET_MANIFEST;
  if (!M.rig_reapergun_torso) return;                        // (no art yet)
  const KEY = '#reaperglow', D = 'assets/reapergun/';
  const RG = (NC.ReaperGun = { on: true, str: 1, active: false });
  const load = (src) => { const im = new Image(); im.src = src; return im; };
  const ok = (im) => im && im.complete && im.naturalWidth > 0;

  // ---------------- the pieces ----------------
  // the wrist cannon (tools/reapergun_cut.py gun prints its numbers)
  const GW = { w: 29.7, h: 60, ax: 0.649 };
  M.w_reapergun = { src: D + 'w_reapergun.png', w: GW.w, h: GW.h, ax: GW.ax, ay: 1.0 };
  ITEMS.robe_reapergun = { slot: 'robe', name: 'เกราะปืนยมทูต', rig: 'reapergun', rarity: 'legend', stats: { dex: 6, agi: 3, crit: 0.05 },
    desc: 'เกราะกลไกสีดำเงาของมือปืนที่ไม่เคยพลาด แสงสีเลือดวิ่งตามรอยต่อเกราะ ชายเสื้อเกราะยาวแยกเป็นแผ่น (ชุด endgame · ทดสอบ)' };
  const MF = Object.assign({}, NC.ASSET_MANIFEST_FASHION || {}, M);
  // the helmet: with the face guard, or without it; U switches them (tools/reapergun_cut.py helm: both drawn at one size)
  const HELM = { fit: 1.25, seat: 0.665, dx: 0.06, seatGuard: 0.72 };   // (skincut measured 1.811, too big; the guarded one sits lower so the eyes show in its slot)
  if (MF.hat_reapergun) ITEMS.hat_reapergun = { slot: 'hat', name: 'หมวกครีบใบมีด', sprite: 'hat_reapergun', art: 2, rarity: 'legend',
    fit: HELM.fit, seat: HELM.seatGuard, dx: HELM.dx, clip: false, hood: true, soft: 0, stats: { dex: 3, crit: 0.03 },
    desc: 'หมวกเกราะดำมีครีบยาวเหมือนใบมีดสองอัน แถบแสงแดงเหนือดวงตา หน้ากากปิดจมูกถึงคาง (กด U ถอด/ใส่หน้ากาก)' };
  if (MF.hat_reapergun_open) ITEMS.hat_reapergun_open = { slot: 'hat', name: 'หมวกครีบใบมีด (ถอดหน้ากาก)', sprite: 'hat_reapergun_open', icon: 'hat_reapergun', art: 2,
    rarity: 'legend', fit: HELM.fit, seat: HELM.seat, dx: HELM.dx, clip: false, hood: true, soft: 0, stats: { dex: 3, crit: 0.03 },
    desc: 'หมวกครีบใบมีดแบบถอดหน้ากากปิดปาก (กด U ถอด/ใส่หน้ากาก)' };
  if (ITEMS.pistols) {
    const W = Object.assign({}, ITEMS.pistols, { id: 'gun_reapergun', sprite: 'w_reapergun', name: 'ปืนข้อมือยมทูต', rarity: 'legend',
      dmg: [70, 90], trailRgb: '255,60,80', element: 'neutral',
      desc: 'ปืนใหญ่ติดข้อมือคู่ ลำกล้องดำเงา ปากกระบอกเรืองแดงเหมือนเตาที่ไม่เคยดับ (ทดสอบ)' });
    for (const k of Object.keys(W)) if (k[0] === '_') delete W[k];
    ITEMS.gun_reapergun = W;
  }
  const MINE = (e) => !!e && (e.robe === 'robe_reapergun' || /^hat_reapergun/.test(e.hat || '') || e.weapon === 'gun_reapergun');
  const GUARD = { hat_reapergun: 'hat_reapergun_open', hat_reapergun_open: 'hat_reapergun' };
  addEventListener('keydown', (ev) => {
    if (ev.code !== 'KeyU' || ev.repeat || !NC.game) return;
    const t = document.activeElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const p = NC.game.player, to = p && GUARD[p.equip.hat];
    if (!to || !ITEMS[to]) return;
    p.equip.hat = to;
    if (NC.applyGear) NC.applyGear(NC.game);
  });

  // ---------------- his shots in the set's red ----------------
  // the gun's own effects (the bullet, its tracer, the muzzle glow, the sparks and rings where it hits) re-tinted blood red
  // while the set is worn; only near him (a monster's effects keep their colours)
  const RED = { vstreak: '255,70,85', vglow: '255,60,80', spark: '255,90,100', ring: '255,60,80', star: '255,120,130' };
  const baseAdd = FX.add;
  FX.add = function (q) {
    const G = NC.game, p = G && G.player;
    if (q && RG.on && RG.active && p && q.x !== undefined && Math.abs(q.x - p.x) < 1100 && Math.abs(q.y - p.y) < 700) {
      if (q.type === 'bolt') q.type = 'rgbolt';
      else if (RED[q.type] && (q.rgb || q.color)) { if (q.rgb) q.rgb = RED[q.type]; else q.color = RED[q.type]; }
    }
    return baseAdd.apply(this, arguments);
  };
  // (fx.js's bolt, its colours turned red)
  FX.def('rgbolt', (ctx, p) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const tx = p.x - p.vx * 0.07, ty = p.y - p.vy * 0.07;
    const g = ctx.createLinearGradient(tx, ty, p.x, p.y);
    g.addColorStop(0, 'rgba(255,40,60,0)'); g.addColorStop(1, 'rgba(255,70,85,0.85)');
    ctx.strokeStyle = g; ctx.lineWidth = 16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(p.x, p.y); ctx.stroke();
    const r = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 30);
    r.addColorStop(0, 'rgba(255,235,235,1)'); r.addColorStop(0.35, 'rgba(255,80,95,0.9)'); r.addColorStop(1, 'rgba(255,40,60,0)');
    ctx.fillStyle = r; ctx.fillRect(p.x - 30, p.y - 30, 60, 60);
    ctx.restore();
  }, 'glow');

  // ---------------- the glow layers ----------------
  const GLOW = {};
  for (const [name, m] of Object.entries(MF)) {
    if (!/reapergun/.test(name) || /_vein$|_bloom$|_fill$|_head$/.test(name) || !m.src) continue;
    GLOW[name] = load(m.src.replace(/\.png$/, '_vein.png'));
  }
  const EMPTY = document.createElement('canvas'); EMPTY.width = EMPTY.height = 1;
  const baseTinted = NC.tinted;
  NC.tinted = function (name, colour) {
    if (colour !== KEY) return baseTinted.apply(this, arguments);
    const g = GLOW[name];
    return ok(g) ? g : EMPTY;
  };

  // ---------------- the hero ----------------
  const H = { on: false, p: null, shot: null, t: 0 };
  const baseDP = NC.drawPlayer;
  NC.drawPlayer = function (ctx, game) {
    const p = game.player, mine = !!(RG.on && p && MINE(p.equip) && p.dead <= 0);
    RG.active = mine;
    if (!mine) return baseDP.apply(this, arguments);
    H.on = true; H.p = p; H.t = game.time;
    try { return baseDP.apply(this, arguments); } finally { H.on = false; }
  };
  const baseDH = NC.drawHero;
  NC.drawHero = function (ctx, equip, P2, x, y, o) {
    if (H.on && H.p && equip === H.p.equip && !(o && o.silhouette)) H.shot = { m: ctx.getTransform(), equip, P: P2, x, y, o: o || {} };
    return baseDH.apply(this, arguments);
  };
  // a reactor's pulse: a slow double beat, hotter while he shoots
  function pulse(p, t) {
    const hot = !!((p.atk && p.atk.on) || p.casting);
    const u = (t * 0.9) % 1, beat = Math.exp(-((u - 0.1) ** 2) / 0.003) + 0.6 * Math.exp(-((u - 0.28) ** 2) / 0.003);
    return (0.6 + 0.35 * beat + (hot ? 0.45 : 0)) * RG.str;
  }
  const off = document.createElement('canvas'), oc = off.getContext('2d');
  let lt = null;
  const baseTrail = NC.drawTrail;
  NC.drawTrail = function (ctx, game) {
    if (H.shot) glowPass(ctx, game);
    return baseTrail.apply(this, arguments);
  };
  function glowPass(ctx, game) {
    const s = H.shot; H.shot = null;
    const p = H.p, a = pulse(p, H.t);
    const m = s.m, k = Math.hypot(m.a, m.b), sc = (s.o.scale || 1) * k;
    const B = Math.ceil(340 * sc), cx = m.a * s.x + m.c * (s.y - 70) + m.e, cy = m.b * s.x + m.d * (s.y - 70) + m.f;
    if (off.width !== B) { off.width = B; off.height = B; }
    oc.setTransform(1, 0, 0, 1, 0, 0); oc.clearRect(0, 0, B, B);
    oc.setTransform(m.a, m.b, m.c, m.d, m.e - (cx - B / 2), m.f - (cy - B / 2));
    baseDH.call(NC, oc, s.equip, s.P, s.x, s.y, Object.assign({}, s.o, { silhouette: KEY, tint: null, alpha: 1 }));
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = `blur(${Math.max(2, 6 * sc).toFixed(1)}px)`;               // the bloom
    ctx.globalAlpha = Math.min(1, 0.55 * a);                               // (lower than the other sets: the black has to stay black)
    ctx.drawImage(off, cx - B / 2, cy - B / 2); ctx.drawImage(off, cx - B / 2, cy - B / 2);
    ctx.filter = 'none';                                                     // the strips
    ctx.globalAlpha = Math.min(1, 0.5 + 0.45 * a);
    ctx.drawImage(off, cx - B / 2, cy - B / 2);
    ctx.restore();
    if (!lt || !FX.lights.includes(lt)) { lt = { x: p.x, y: p.y - 40, r: 160, rgb: '255,60,80', a: 0, life: 0.5, t: 0, follow: p, oy: -40 }; FX.lights.push(lt); }
    lt.a = 0.08 + 0.12 * Math.min(1.3, a); lt.t = 0.05;
  }
})();
