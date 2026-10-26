/* rootbound.js — ROOTBOUND (รากต้นไม้ดำ), the endgame MAGE set (the user, 2026-10-07: "ทำชุด endgame แนวๆ เบอเซิกกับ
   อีกาเลือดให้อีก คราวนี้สายเมจ ... ให้อารมณ์ความมืดหน่อย" -> picked design A of assets/gen/make_darkmage_prompts.py):
   the high priest of the corrupted forest. A long robe of charred bark plates and thorn vines over plum cloth whose hem
   tears into root tendrils (rig_rootbound_body: ONE garment, collar to hem, tools/body_piece.py), a hood grown from black
   branches with one violet void eye (hat_rootbound), and a staff of twisted root caging a beating dark seed
   (staff_rootbound). Art: assets/gen/make_rootbound_prompts.py -> tools/rigcut.py + skincut.py hoods + rootbound_cut.py.
   Its VIOLET SAP glows the IRONRAGE way: tools/veinglow.py --hue violet made a <sprite>_vein.png for every piece; after
   the night's darkness the hero is drawn again with those layers only (avatar.js's silhouette path: NC.tinted(name,
   '#rootglow') returns the vein layer), laid over the world with 'lighter', blurred (bloom) + sharp, pulsing slowly like
   sap in a heart (lub-dub, faster in a fight), and a dim violet light round him.
   TEST pieces: ?equip=robe_rootbound,hat_rootbound,staff_rootbound (not in drops yet). */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, FX = NC.FX, M = NC.ASSET_MANIFEST;
  const KEY = '#rootglow';
  if (!M.rig_rootbound_torso) return;                        // (no art yet)
  // the staff (tools/rootbound_cut.py prints its numbers: assets/gen/_rootbound_staff.json)
  const ST = { w: 41.0, h: 140, ax: 0.527 };
  M.w_rootbound = { src: 'assets/rootbound/w_rootbound.png', w: ST.w, h: ST.h, ax: ST.ax, ay: 1.0 };

  // ---------------- the pieces ----------------
  ITEMS.robe_rootbound = { slot: 'robe', name: 'ชุดคลุมรากต้นไม้ดำ', rig: 'rootbound', rarity: 'legend', stats: { int: 6, skill: 0.22, cdr: 0.06 },
    desc: 'ชุดคลุมเปลือกไม้ไหม้กับเถาหนามของนักบวชแห่งป่าที่ถูกกัดกิน ชายเสื้อแตกเป็นรากลากพื้น ยางไม้สีม่วงเรืองเต้นอยู่ในรอยแตก (ชุด endgame · ทดสอบ)' };
  const MF = Object.assign({}, NC.ASSET_MANIFEST_FASHION || {}, M);
  if (MF.hat_rootbound) ITEMS.hat_rootbound = { slot: 'hat', name: 'ฮู้ดกิ่งไม้ตาเดียว', sprite: 'hat_rootbound', art: 2, rarity: 'legend',
    fit: 1.5, seat: 0.665, dx: 0.06, clip: false, hood: true, soft: 0, stats: { int: 3, skill: 0.06 },   // (skincut measured 1.778: the branches looked too big)
    desc: 'ฮู้ดที่งอกจากกิ่งไม้ดำบิดเกลียว มีตาความว่างเปล่าสีม่วงดวงเดียวลืมอยู่เหนือคิ้ว' };
  if (ITEMS.staff) {
    const W = Object.assign({}, ITEMS.staff, {
      id: 'staff_rootbound', wtype: 'staff', sprite: 'w_rootbound', name: 'คทารากเมล็ดมืด', rarity: 'legend',
      element: 'shadow',                                       // (a dark staff: violet motes drift off it, not the plain staff's blue water ones)
      dmg: [58, 74], matkMul: 0.55, stats: { skill: 0.28, int: 6 },
      desc: 'คทารากไม้ดำบิดเกลียว ปลายกิ่งโอบเมล็ดสีดำที่เต้นเหมือนหัวใจ แสงม่วงรั่วออกจากรอยแตก (ทดสอบ)',
    });
    for (const k of Object.keys(W)) if (k[0] === '_') delete W[k];
    ITEMS.staff_rootbound = W;
  }
  const MINE = (e) => e && (e.robe === 'robe_rootbound' || e.hat === 'hat_rootbound' || e.weapon === 'staff_rootbound');

  // ---------------- the vein layers ----------------
  const GLOW = {};
  for (const [name, m] of Object.entries(MF)) {
    // (the set's own pictures only: the area weapon aw_rootbound_hound has no vein layer, it 404'd at every start)
    if (!/^(rig_|hat_|w_)rootbound/.test(name) || /_vein$|_bloom$|_fill$|_head$/.test(name) || !m.src) continue;
    const img = new Image(); img.src = m.src.replace(/\.png$/, '_vein.png'); GLOW[name] = img;
  }
  const EMPTY = document.createElement('canvas'); EMPTY.width = EMPTY.height = 1;
  const baseTinted = NC.tinted;
  NC.tinted = function (name, colour) {
    if (colour !== KEY) return baseTinted.apply(this, arguments);
    const g = GLOW[name];
    return g && g.complete && g.naturalWidth ? g : EMPTY;
  };

  // ---------------- the hero drawn again, glow only, after the lighting ----------------
  const RB = (NC.Rootbound = { on: true, glow: GLOW, KEY, str: 1 });
  const H = { on: false, shot: null };
  const baseDP = NC.drawPlayer;
  NC.drawPlayer = function (ctx, game) {
    const p = game.player;
    if (!RB.on || !p || !MINE(p.equip) || p.dead > 0) return baseDP.apply(this, arguments);
    H.on = true; H.p = p; H.t = game.time;
    try { return baseDP.apply(this, arguments); } finally { H.on = false; }
  };
  const baseDH = NC.drawHero;
  NC.drawHero = function (ctx, equip, P, x, y, o) {
    if (H.on && equip === H.p.equip && !(o && o.silhouette)) H.shot = { m: ctx.getTransform(), equip, P, x, y, o: o || {} };
    return baseDH.apply(this, arguments);
  };
  // slow sap in a heart: lub-dub every ~1.4 s, quicker and brighter while casting or fighting
  const g2 = (x, c, w) => Math.exp(-Math.pow((x - c) / w, 2));
  const pulse = (t, hot) => { const u = (t * (hot ? 1.1 : 0.72)) % 1; return 0.45 + 0.75 * (g2(u, 0.1, 0.07) + 0.55 * g2(u, 0.32, 0.08)) + (hot ? 0.3 : 0); };
  const off = document.createElement('canvas'), oc = off.getContext('2d');
  const baseTrail = NC.drawTrail;
  NC.drawTrail = function (ctx, game) {
    if (H.shot) glowPass(ctx, game);
    return baseTrail.apply(this, arguments);
  };
  function glowPass(ctx, game) {
    const s = H.shot;
    H.shot = null;
    if (!s) return;
    const p = H.p, hot = !!((p.atk && p.atk.on) || p.casting || (p.combat > 0 && game.time - (p.lastFight || -9) < 2));
    const a = pulse(H.t, hot) * RB.str;
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
    ctx.globalAlpha = Math.min(1, 0.8 * a);
    ctx.drawImage(off, cx - B / 2, cy - B / 2);
    ctx.drawImage(off, cx - B / 2, cy - B / 2);
    ctx.filter = 'none';                                                     // the sap itself
    ctx.globalAlpha = Math.min(1, 0.4 + 0.5 * a);
    ctx.drawImage(off, cx - B / 2, cy - B / 2);
    ctx.restore();
    violet(p, a);
    // (js/rootfx.js: the set's tricks drawn after the glow: the sap flowing along the lines, the living eye)
    if (RB.extra) RB.extra({ ctx, game, p, shot: s, off, ox: cx - B / 2, oy: cy - B / 2, B, sc, a, hot,
      draw: (c2, key) => baseDH.call(NC, c2, s.equip, s.P, s.x, s.y, Object.assign({}, s.o, { silhouette: key, tint: null, alpha: 1 })) });
  }
  let light = null;
  function violet(p, a) {
    if (!light || !FX.lights.includes(light)) { light = { x: p.x, y: p.y - 40, r: 160, rgb: '190,60,255', a: 0, life: 0.5, t: 0, follow: p, oy: -40 }; FX.lights.push(light); }
    light.a = 0.22 + 0.28 * Math.min(1.2, a); light.t = 0.05;
  }
})();
