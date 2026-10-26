/* voidcomet.js — VOID COMET (ดาวหางดับ), the endgame ARCHER set (the user, 2026-10-08: picked B of
   assets/gen/make_darkarcher_prompts.py; "หมากับนกอยากให้เปลี่ยนด้วย" -> "ใช้เป็นเฟรม" -> "ใส่เกราะปิดหน้าปิดตา"; then "ลงดีเทล
   แบบตัวเบอเซิก แต่เป็นในแนวของตัวนี้"): the hunter who fell with a dead star. Black obsidian meteorite plate with cold
   cyan-white cracks, a shard helm with one visor slit, a comet-tail cape, a meteorite bow with a starlight string; the
   archer line's WOLF and FALCON in closed obsidian helms, drawn as FRAME animations while the set is worn.
   The berserk set's details, the comet's way (js/ironrage.js's method):
     glow     tools/veinglow.py --hue moon made a <sprite>_vein.png for every piece; after the night's darkness the hero is
              drawn again with those layers only ('#voidglow'), blurred (bloom) + sharp, breathing slowly like a dying
              star with sharp twinkles, brighter as he shoots; a cold light round him
     shards   small meteorite shards orbit his shoulders (in front of him and behind him in turn)
     dust     star sparkles drift off him; running, they stream behind him like a comet's tail; the dash leaves a comet
     flow     ("ตรงสีฟ้าๆ ตามชุด ให้ไล่แสงไปเลย") light runs along the cyan lines: bands sweep down him from the helm into the cape
              all the time, and every shot / every 3rd hit / the dash sends a surge racing out from the chest (the cracks' own
              glow layer revealed through a moving mask, hotter); the pets' cracks flow head to tail
     bolts    ("สายฟ้าวิ่งผ่านตัว") Codex lightning arcs jump between glowing points of the cracks (sampled from the glow layer),
              crackling a few frames each; a spark burst where one lands; a storm of them while shooting / on a surge / a dash
     chain    ("ตีติดสายฟ้าแบบชิ่ง") 40 % of hits (0.35 s apart) jump as lightning to up to 3 monsters near, small damage each
     arrows   ("ลูกธนูสายฟ้า") every arrow flies as a Codex lightning arrow, sparks behind it, a burst where it lands
     bow      ("ธนูชิ้นส่วนขยับได้") the bow's picture in 5 pieces held apart by breathing gaps, tips flexing, wider while
              drawing, lightning arcs across the gaps (glow pass); the string follows the tips
     star     every 6th hit (1.5 s apart) a comet falls onto the monster: a Codex streak, sparkles and shards burst (a look)
     pets     the wolf (idle / run / bite) and the falcon (fly / strike) as Codex frame strips (assets/voidcomet/*.png,
              frames.json), the rigs' own state choosing the frame (js/petrig.js), their cracks glowing after the night
   Every picture is Codex art (assets/gen/make_voidcomet_prompts.py, voidcomet_more.py -> tools/voidcomet_cut.py): the code
   only places, moves and tints them. Local player only. NC.VoidComet.on = false = off (.pets / .shards / .dust).
   TEST: ?equip=robe_voidcomet,cape_voidcomet,hat_voidcomet,bow_voidcomet */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, FX = NC.FX, M = NC.ASSET_MANIFEST, TAU = Math.PI * 2, rand = NC.rand;
  if (!M.rig_voidcomet_torso) return;                        // (no art yet)
  const KEY = '#voidglow', D = 'assets/voidcomet/';
  const VC = (NC.VoidComet = { on: true, pets: true, shards: true, dust: true, flow: true, stars: true, bolts: true, chain: true, arrows: true, bowParts: true, str: 1, active: false });
  const load = (src) => { const im = new Image(); im.src = src; return im; };
  const ok = (im) => im && im.complete && im.naturalWidth > 0;

  // ---------------- the pieces ----------------
  // (2026-10-08: the bow redrawn as five pieces, tools/voidcomet_cut.py bowparts -> bowparts.json; the solid one before it:
  // w_voidcomet_solid.png, { w: 35.1, ax: 0.755, bow: { x: 0.073, top: 0.022, bottom: 0.975 } })
  const BW = { w: 28.2, h: 130, ax: 0.699, grip: 0.509, bow: { x: 0.092, top: 0.018, bottom: 0.979 } };
  M.w_voidcomet = { src: D + 'w_voidcomet.png', w: BW.w, h: BW.h, ax: BW.ax, ay: 1.0 };
  for (let i = 0; i < 5; i++) M['w_voidcomet_p' + i] = { src: D + 'bowp_' + i + '.png', w: 1, h: 1, ax: 0, ay: 0 };   // (the pieces, js below)
  ITEMS.robe_voidcomet = { slot: 'robe', name: 'เกราะอุกกาบาตดาวหางดับ', rig: 'voidcomet', rarity: 'legend', stats: { dex: 6, agi: 4, crit: 0.05 },
    desc: 'เกราะหินอุกกาบาตสีดำจากดาวที่ดับไปแล้ว รอยร้าวยังเรืองแสงฟ้าเย็นเหมือนดาวที่ยังลุกอยู่ข้างใน (ชุด endgame · ทดสอบ)' };
  ITEMS.cape_voidcomet = { slot: 'cape', name: 'ผ้าคลุมหางดาวหาง', sprite: 'rig_voidcomet_cape', rarity: 'legend', stats: { agi: 3 }, trail: 0.7,
    wave: { swing: 2.4, ripple: 1.6, speed: 1 },   // (the user: "ผ้าคลุมอยากให้พริ้วไหว": avatar.js waveCloth)   // (its hem streams back like a comet's tail: avatar.js capeIt.trail)
    desc: 'ผ้าคลุมดำขาดวิ่น ปลายสลายเป็นละอองดาวสีฟ้าเหมือนหางดาวหาง' };
  const MF = Object.assign({}, NC.ASSET_MANIFEST_FASHION || {}, M);
  // what he can wear on his back instead of the cape (the user: "เปลี่ยนจากผ้าคลุมเป็นอะไรได้บ้าง" -> "ลองเจนทุกแบบ"): cape-slot pieces
  // fitted to the cape's hang point by tools/voidcomet_back_cut.py (Codex drew each behind our hero's green silhouette)
  const BACKS = { wings: ['a', 'ปีกเศษดาว', 'ปีกเศษหินอุกกาบาตลอยอยู่หลังบ่า รอยร้าวเรืองฟ้า', 0],
    star: ['b', 'ดาวดับ', 'ลูกอุกกาบาตดำแตกร้าวลอยอยู่ข้างหลัง แสงดาวที่ยังลุกลอดออกมา', 0],
    quiver: ['c', 'กระบอกศรแสงดาว', 'กระบอกศรหินดำ ลูกศรเป็นแสงดาวสีฟ้า', 0],
    scarf: ['d', 'ผ้าพันคอหางดาวหาง', 'ชายผ้าพันคอยาวสะบัดไปข้างหลังเหมือนหางดาวหาง', 0.2] };
  for (const [id, [k, name, desc, trail]] of Object.entries(BACKS)) {
    if (!M['rig_voidcomet_back_' + k]) continue;
    ITEMS['cape_voidcomet_' + id] = { slot: 'cape', name, sprite: 'rig_voidcomet_back_' + k, rarity: 'legend', stats: { agi: 3 }, trail, desc: desc + ' (ทดสอบ)' };
    if (id === 'scarf') ITEMS.cape_voidcomet_scarf.wave = { swing: 3, ripple: 1.4, speed: 1.1 };
  }
  // the helm: the visor down over the eyes (as the concept), or raised; U switches them (the berserk helm's way, js/ironrage.js)
  // (tools/voidcomet_redo_cut.py: both drawn at one size, the closed one fitted onto the open one: _voidcomet_helm.json)
  const HELM = { fit: 1.03, seat: 0.665, dx: 0.06 };         // (skincut measured 1.562; the user: "หมวกใหญ่ไป" -> 1.3, then fitted it in the Lab: 1.03, 2026-10-08)
  if (MF.hat_voidcomet) ITEMS.hat_voidcomet = { slot: 'hat', name: 'หมวกเศษดาวปิดตา', sprite: 'hat_voidcomet', art: 2, rarity: 'legend',
    fit: HELM.fit, seat: HELM.seat, dx: HELM.dx, clip: false, hood: true, soft: 0, stats: { dex: 3, crit: 0.03 },
    desc: 'หมวกเศษหินอุกกาบาตกวาดไปด้านหลัง หน้ากากแก้วดำปิดตา ขอบล่างเรืองแสงฟ้า (กด U เปิด/ปิดหน้ากาก)' };
  if (MF.hat_voidcomet_open) ITEMS.hat_voidcomet_open = { slot: 'hat', name: 'หมวกเศษดาว (เปิดหน้ากาก)', sprite: 'hat_voidcomet_open', icon: 'hat_voidcomet', art: 2,
    rarity: 'legend', fit: HELM.fit, seat: HELM.seat, dx: HELM.dx, clip: false, hood: true, soft: 0, stats: { dex: 3, crit: 0.03 },
    desc: 'หมวกเศษดาวแบบยกหน้ากากขึ้น (กด U เปิด/ปิดหน้ากาก)' };
  if (ITEMS.bow) {
    const W = Object.assign({}, ITEMS.bow, { id: 'bow_voidcomet', wtype: 'bow', sprite: 'w_voidcomet', name: 'ธนูอุกกาบาตดับ', rarity: 'legend',
      dmg: [64, 82], bow: Object.assign({}, BW.bow), grip: BW.grip, element: 'neutral', trailRgb: '150,230,255', string: '#c8f6ff',
      desc: 'ธนูแกะจากอุกกาบาตก้อนเดียว รอยร้าวเรืองฟ้า สายเป็นเส้นแสงดาว (ทดสอบ)' });
    for (const k of Object.keys(W)) if (k[0] === '_') delete W[k];
    ITEMS.bow_voidcomet = W;
  }
  // wolf helms (the user: "หมวกต้องให้อารมณ์คล้ายๆ หมวกหมาป่า แต่เท่หน่อย แล้วลากยาวมาตรงไหล่"): three to try
  // (assets/gen/make_voidcomet_wolfhelm_prompts.py -> skincut hoods voidcomet_w1..3; w3's opening is only under its visor, so
  // its measured fit / brim are set by hand from the other two, drawn at the same size)
  const WOLF = { w1: ['หมวกหมาป่าออบซิเดียน', 2.02, null], w2: ['หมวกหนังหมาป่าดาวดับ', 1.953, null], w3: ['หมวกหมาป่าดาวหาง', 2.13, 0.57] };
  for (const [id, [name, fit, brim]] of Object.entries(WOLF)) {
    const key = 'hat_voidcomet_' + id;
    if (!MF[key]) continue;
    if (brim && NC.ASSET_MANIFEST_FASHION && NC.ASSET_MANIFEST_FASHION[key]) NC.ASSET_MANIFEST_FASHION[key].brim = brim;
    ITEMS[key] = { slot: 'hat', name, sprite: key, art: 2, rarity: 'legend', fit, seat: 0.665, dx: 0.06, clip: false, hood: true, soft: 0,
      stats: { dex: 3, crit: 0.03 }, desc: 'หมวกหัวหมาป่าหินอุกกาบาตดำ แผงขนยาวลงมาถึงไหล่ รอยร้าวเรืองฟ้า (กด U สลับแบบหมวก)' };
  }
  const MINE = (e) => !!e && (e.robe === 'robe_voidcomet' || /^hat_voidcomet/.test(e.hat || '') || /^cape_voidcomet/.test(e.cape || '') || e.weapon === 'bow_voidcomet');
  const VISOR = { hat_voidcomet: 'hat_voidcomet_open', hat_voidcomet_open: 'hat_voidcomet_w1', hat_voidcomet_w1: 'hat_voidcomet_w2', hat_voidcomet_w2: 'hat_voidcomet_w3', hat_voidcomet_w3: 'hat_voidcomet' };
  addEventListener('keydown', (ev) => {
    if (ev.code !== 'KeyU' || ev.repeat || !NC.game) return;
    const t = document.activeElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const p = NC.game.player, to = p && VISOR[p.equip.hat];
    if (!to || !ITEMS[to]) return;
    p.equip.hat = to;
    if (NC.applyGear) NC.applyGear(NC.game); // (was NC.recalcStats, which never existed)
    if (NC.HUD && NC.HUD.toast) NC.HUD.toast(ITEMS[to].name);
  });

  // ---------------- the glow layers ----------------
  const GLOW = {};
  for (const [name, m] of Object.entries(Object.assign({}, MF, M))) {
    if (!/voidcomet/.test(name) || /_vein$|_bloom$|_fill$|_head$/.test(name) || !m.src) continue;
    GLOW[name] = load(m.src.replace(/\.png$/, '_vein.png'));
  }
  const EMPTY = document.createElement('canvas'); EMPTY.width = EMPTY.height = 1;
  const baseTinted = NC.tinted;
  NC.tinted = function (name, colour) {
    if (colour !== KEY) return baseTinted.apply(this, arguments);
    const g = GLOW[name];
    return ok(g) ? g : EMPTY;
  };

  // ---------------- the effect pieces (Codex: assets/voidcomet/fx) ----------------
  const P = {
    shards: [0, 1, 2, 3, 4, 5].map((i) => ({ img: load(D + 'fx/shard_' + i + '.png'), vein: load(D + 'fx/shard_' + i + '_vein.png') })),
    sparks: [0, 1, 2, 3].map((i) => load(D + 'fx/spark_' + i + '.png')),
    dust: [0, 1].map((i) => load(D + 'fx/dust_' + i + '.png')),
    streaks: [0, 1].map((i) => load(D + 'fx/streak_' + i + '.png')),
  };
  const PPU = 3;                                             // (the fx pieces' px per world unit)

  // ---------------- the hero ----------------
  const H = { on: false, p: null, shot: null, t: 0, twinkle: 0, twT: 0, dashWas: false };
  const baseDP = NC.drawPlayer;
  NC.drawPlayer = function (ctx, game) {
    const p = game.player, mine = !!(VC.on && p && MINE(p.equip) && p.dead <= 0);
    VC.active = mine;
    if (!mine) return baseDP.apply(this, arguments);
    H.on = true; H.p = p; H.t = game.time;
    tick(game, p);
    try { return baseDP.apply(this, arguments); } finally { H.on = false; }
  };
  const baseDH = NC.drawHero;
  NC.drawHero = function (ctx, equip, P2, x, y, o) {
    if (H.on && H.p && equip === H.p.equip && !(o && o.silhouette)) H.shot = { m: ctx.getTransform(), equip, P: P2, x, y, o: o || {} };
    return baseDH.apply(this, arguments);
  };
  // a dying star: a slow breath, now and then a sharp twinkle; brighter while he shoots
  function pulse(p, t) {
    const hot = !!((p.atk && p.atk.on) || p.casting);
    if (t > H.twT) { H.twT = t + rand(0.8, 2.6); H.twinkle = 1; }
    H.twinkle = Math.max(0, H.twinkle - 0.06);
    return (0.55 + 0.2 * Math.sin(t * 1.4) + 0.55 * H.twinkle * H.twinkle + (hot ? 0.4 : 0)) * VC.str;
  }
  const off = document.createElement('canvas'), oc = off.getContext('2d');
  const LATE = [];                                           // ([transform, draw]: light drawn over the whole glow layer)
  const baseTrail = NC.drawTrail;
  NC.drawTrail = function (ctx, game) {
    if (H.shot) glowPass(ctx, game);
    return baseTrail.apply(this, arguments);
  };
  function glowPass(ctx, game) {
    const s = H.shot; H.shot = null;
    const p = H.p, a = pulse(p, H.t) * (VC.flow ? 0.6 : 1);   // (with the running light on, the lines rest dimmer so it shows)
    const m = s.m, k = Math.hypot(m.a, m.b), sc = (s.o.scale || 1) * k;
    const B = Math.ceil(340 * sc), cx = m.a * s.x + m.c * (s.y - 70) + m.e, cy = m.b * s.x + m.d * (s.y - 70) + m.f;
    if (off.width !== B) { off.width = B; off.height = B; }
    oc.setTransform(1, 0, 0, 1, 0, 0); oc.clearRect(0, 0, B, B);
    oc.setTransform(m.a, m.b, m.c, m.d, m.e - (cx - B / 2), m.f - (cy - B / 2));
    LATE.length = 0;
    baseDH.call(NC, oc, s.equip, s.P, s.x, s.y, Object.assign({}, s.o, { silhouette: KEY, tint: null, alpha: 1 }));
    const late = LATE.splice(0);                              // (the bow's own light: drawn over everything below, once)
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = `blur(${Math.max(2, 6 * sc).toFixed(1)}px)`;               // the bloom
    ctx.globalAlpha = Math.min(1, 0.8 * a);
    ctx.drawImage(off, cx - B / 2, cy - B / 2); ctx.drawImage(off, cx - B / 2, cy - B / 2);
    ctx.filter = 'none';                                                     // the cracks
    ctx.globalAlpha = Math.min(1, 0.45 + 0.5 * a);
    ctx.drawImage(off, cx - B / 2, cy - B / 2);
    ctx.restore();
    if (VC.flow) flow(ctx, s, B, cx - B / 2, cy - B / 2, sc);
    if (VC.bolts) bolts(ctx, B, cx - B / 2, cy - B / 2, sc, H.t);
    // the arrow on the string and the lightning across the bow's gaps: over his hands (the vein layers would cover them),
    // a soft copy and a sharp one (not through the armour's bloom: they would burn white)
    for (const [m2, fn] of late)
      for (const soft of [true, false]) {
        ctx.save(); ctx.setTransform(1, 0, 0, 1, cx - B / 2, cy - B / 2); ctx.transform(m2.a, m2.b, m2.c, m2.d, m2.e, m2.f);
        if (soft) ctx.filter = `blur(${Math.max(1.5, 3 * sc).toFixed(1)}px)`;
        fn(ctx); ctx.restore();
      }
    light(p, a);
  }

  // ---------------- the light running along the cyan lines (the user, 2026-10-08: "ทำลูกเล่นกับเอฟเฟคชุด ตรงสีฟ้าๆ ตามชุด ให้ไล่
  // แสงไปเลย") ----------------
  // The glow layer itself revealed by bright bands: they sweep down him all the time, from the helm through the armour into
  // the cape's tail (the dead star's light running out of him), hotter and whiter than the lines; every shot and every few
  // hits send a SURGE, a ring racing out from the chest along every line. Nothing is drawn: the cracks' own layer, masked.
  const FLOW = (VC.flowSet = { loop: 1.5, bands: 2, width: 30, surge: 0.5 });
  const surges = [];
  const fcv = document.createElement('canvas'), fc = fcv.getContext('2d');
  const bandStops = (g) => { g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); return g; };
  function flow(ctx, s, B, ox, oy, sc) {
    const m = s.m, t = H.t;
    const at = (wx, wy) => [m.a * wx + m.c * wy + m.e - ox, m.b * wx + m.d * wy + m.f - oy];
    const top = at(s.x, s.y - 170), bot = at(s.x, s.y + 12), chest = at(s.x, s.y - 85);
    if (fcv.width !== B) { fcv.width = B; fcv.height = B; }
    const draws = [];
    for (let i = 0; i < FLOW.bands; i++) draws.push({ lin: ((t / FLOW.loop + i / FLOW.bands) % 1) * 1.3 - 0.15, a: 1 });
    for (let i = surges.length - 1; i >= 0; i--) {
      const u = (t - surges[i]) / FLOW.surge;
      if (u > 1 || u < -0.5) surges.splice(i, 1); else if (u >= 0) draws.push({ ring: u, a: 1.1 * (1 - u) });
    }
    for (const d of draws) {
      fc.setTransform(1, 0, 0, 1, 0, 0);
      fc.globalCompositeOperation = 'copy'; fc.globalAlpha = 1; fc.drawImage(off, 0, 0);
      fc.globalCompositeOperation = 'destination-in';
      const w = FLOW.width * sc;
      if (d.ring === undefined) {
        const x = top[0] + (bot[0] - top[0]) * d.lin, y = top[1] + (bot[1] - top[1]) * d.lin;
        fc.fillStyle = bandStops(fc.createLinearGradient(x - w * 0.35, y - w, x + w * 0.35, y + w));   // (a little slanted)
      } else {
        const R = (8 + 140 * (1 - Math.pow(1 - d.ring, 2))) * sc;
        fc.fillStyle = bandStops(fc.createRadialGradient(chest[0], chest[1], Math.max(0, R - w), chest[0], chest[1], R + w));
      }
      fc.fillRect(0, 0, B, B);
      fc.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      const hot = 'brightness(2.2) saturate(0.65) ';
      ctx.filter = hot + `blur(${Math.max(2, 5 * sc).toFixed(1)}px)`;
      ctx.globalAlpha = Math.min(1, d.a); ctx.drawImage(fcv, ox, oy); ctx.drawImage(fcv, ox, oy);
      ctx.filter = hot; ctx.drawImage(fcv, ox, oy); ctx.drawImage(fcv, ox, oy);
      ctx.filter = 'none';
      ctx.restore();
    }
  }
  VC.surge = () => surges.push(H.t);

  // ---------------- lightning running across him (the user, 2026-10-08: "ชุดให้อารมณ์สายฟ้าวิ่งผ่านตัวด้วย") ----------------
  // Codex arcs (assets/voidcomet/fx/bolt_*, boltS_*: on black, drawn with 'lighter'), each stretched for a few frames between
  // two GLOWING points of the cracks (sampled from the glow layer itself), so the lightning jumps from line to line over
  // the armour; a spark burst where it lands now and then; many more while shooting, on a surge and on a dash.
  const BOLT = { list: [], pts: [], ptsT: 0, face: 0, nextT: 0, meta: null };
  const BI = { bolt: [0, 1, 2, 3, 4, 5].map((i) => load(D + 'fx/bolt_' + i + '.png')), boltS: [0, 1, 2, 3].map((i) => load(D + 'fx/boltS_' + i + '.png')),
    burst: [0, 1, 2, 3].map((i) => load(D + 'fx/burst_' + i + '.png')) };
  fetch(D + 'bolts.json').then((r) => r.json()).then((j) => { BOLT.meta = j; }).catch(() => {});
  const smp = document.createElement('canvas'), smx = smp.getContext('2d', { willReadFrequently: true });
  smp.width = smp.height = 72;
  function samplePoints() {
    smx.clearRect(0, 0, 72, 72); smx.drawImage(off, 0, 0, 72, 72);
    let d; try { d = smx.getImageData(0, 0, 72, 72).data; } catch (e) { return; }
    const pts = [];
    for (let i = 0; i < 72 * 72; i++) { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; if (Math.max(r, g, b) > 70) pts.push([((i % 72) + 0.5) / 72, (((i / 72) | 0) + 0.5) / 72]); }
    BOLT.pts = pts;
  }
  function spawnBolt(t, burst) {
    const P2 = BOLT.pts;
    if (P2.length < 6 || !BOLT.meta) return;
    for (let k = 0; k < 14; k++) {
      const a = P2[(Math.random() * P2.length) | 0], b = P2[(Math.random() * P2.length) | 0];
      const dd = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (dd < 0.05 || dd > 0.24) continue;
      const short = dd < 0.11, kind = short ? 'boltS' : 'bolt', idx = (Math.random() * (short ? 4 : 6)) | 0;
      BOLT.list.push({ a, b, kind, idx, t0: t, life: rand(0.08, 0.16), flip: Math.random() < 0.5, swap: rand(0.03, 0.05), land: burst || Math.random() < 0.3 });
      return;
    }
  }
  function bolts(ctx, B, ox, oy, sc, t) {
    const p = H.p;
    if (t > BOLT.ptsT || (p && p.face !== BOLT.face)) { BOLT.ptsT = t + 0.18; BOLT.face = p ? p.face : 0; samplePoints(); }
    const busy = !!(p && ((p.atk && p.atk.on) || p.dash)) || surges.some((q) => t - q < 0.3);
    if (t > BOLT.nextT) { BOLT.nextT = t + (busy ? rand(0.02, 0.05) : rand(0.04, 0.1)); spawnBolt(t, busy); if (busy) spawnBolt(t, true); }
    if (!BOLT.meta) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = BOLT.list.length - 1; i >= 0; i--) {
      const q = BOLT.list[i], u = (t - q.t0) / q.life;
      if (u > 1 || u < 0) { BOLT.list.splice(i, 1); continue; }
      if (t - q.t0 > q.swap) { q.idx = (q.idx + 1 + ((Math.random() * 3) | 0)) % (q.kind === 'bolt' ? 6 : 4); q.swap += rand(0.03, 0.05); q.flip = !q.flip; }   // (it crackles: another arc each few frames)
      const im = BI[q.kind][q.idx], M2 = BOLT.meta[q.kind + '_' + q.idx];
      if (!ok(im) || !M2) continue;
      const A = [ox + q.a[0] * B, oy + q.a[1] * B], Bp = [ox + q.b[0] * B, oy + q.b[1] * B];
      const dist = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]), di = Math.hypot(M2.b[0] - M2.a[0], M2.b[1] - M2.a[1]) || 1;
      const kx = dist / di, ky = Math.min(1, Math.max(0.45, kx)) * 0.7;
      ctx.globalAlpha = (u < 0.2 ? 1 : 1 - (u - 0.2) / 0.8) * 0.95;
      ctx.save();
      ctx.translate(A[0], A[1]); ctx.rotate(Math.atan2(Bp[1] - A[1], Bp[0] - A[0])); ctx.scale(kx, q.flip ? -ky : ky);
      ctx.drawImage(im, -M2.a[0], -M2.a[1]);
      ctx.restore();
      if (q.land && u < 0.6) {
        const bi = BI.burst[q.idx % 4];
        if (ok(bi)) { const w = bi.naturalWidth * 0.22 * sc, h = bi.naturalHeight * 0.22 * sc; ctx.drawImage(bi, Bp[0] - w / 2, Bp[1] - h / 2, w, h); }
      }
    }
    ctx.restore();
  }
  let lt = null;
  function light(p, a) {
    if (!lt || !FX.lights.includes(lt)) { lt = { x: p.x, y: p.y - 40, r: 170, rgb: '140,215,255', a: 0, life: 0.5, t: 0, follow: p, oy: -40 }; FX.lights.push(lt); }
    lt.a = 0.2 + 0.28 * Math.min(1.3, a); lt.t = 0.05;
  }

  // ---------------- every frame: shards, dust, the dash's comet ----------------
  const S = { orb: null, back: null, front: null, glow: null, dustT: 0, q: [] };
  function tick(game, p) {
    const t = game.time;
    if (VC.shards) {
      if (!S.back || !FX.list.includes(S.back)) S.back = FX.add({ type: 'custom', layer: 'sorted', x: p.x, y: p.y, life: 1e9, draw: (ctx) => shards(ctx, false, false) });
      if (!S.front || !FX.list.includes(S.front)) S.front = FX.add({ type: 'custom', layer: 'sorted', x: p.x, y: p.y, life: 1e9, draw: (ctx) => shards(ctx, true, false) });
      S.back.x = S.front.x = p.x; S.back.y = S.front.y = p.y; S.back.sort = p.y - 0.5; S.front.sort = p.y + 0.5;
    }
    if (!S.glow || !FX.list.includes(S.glow)) S.glow = FX.add({ type: 'custom', layer: 'glow', x: p.x, y: p.y, life: 1e9, draw: (ctx) => { if (VC.shards && VC.active) shards(ctx, null, true); drawQueue(ctx); } });
    // star dust: drifting off him; running, streaming behind like a comet's tail
    const sp = Math.hypot(p.vx || 0, p.vy || 0), run = sp > 60;
    if (VC.dust && t > S.dustT) {
      S.dustT = t + (run ? rand(0.03, 0.06) : rand(0.1, 0.2));
      const back = -(Math.sign(p.vx || p.face || 1));
      if (run) spark(p.x + back * rand(6, 22), p.y - rand(20, 85), back * rand(30, 90) - (p.vx || 0) * 0.15, rand(-30, 10), rand(0.6, 1.0));
      else spark(p.x + rand(-26, 26), p.y - rand(15, 100), rand(-10, 10), rand(-35, -12), rand(0.45, 0.85));
    }
    // the dash: a comet behind him and a spray of stars
    const shooting = !!(p.atk && p.atk.on);
    if (shooting && !H.atkWas) surges.push(t);
    H.atkWas = shooting;
    const dashing = !!p.dash;
    if (dashing && !H.dashWas) {
      const vx = (p.dash && p.dash.vx) || (p.face || 1) * 900, vy = (p.dash && p.dash.vy) || 0;
      comet(p, Math.atan2(vy, vx));
      surges.push(t);
      for (let i = 0; i < 10; i++) spark(p.x + rand(-20, 20), p.y - rand(20, 90), -vx * rand(0.05, 0.2), rand(-60, 30), rand(0.7, 1.1));
    }
    H.dashWas = dashing;
  }
  // the shards orbit his shoulders: front ones (the lower half of the orbit) drawn after him, back ones before
  function shards(ctx, front, glow) {
    const p = H.p;
    if (!p || !VC.active || !VC.on) return;
    const t = NC.game ? NC.game.time : 0;
    for (let i = 0; i < 3; i++) {
      const a = t * 1.5 + i * (TAU / 3), sn = Math.sin(a);
      if (front !== null && (sn >= 0) !== front) continue;
      const sh = P.shards[i * 2 % 6], im = glow ? sh.vein : sh.img;
      if (!ok(im)) continue;
      const x = p.x + Math.cos(a) * 32, y = p.y - 80 + sn * 10 + Math.sin(t * 2.3 + i) * 4;
      const k = (0.8 + 0.2 * (sn + 1) / 2) / PPU, w = im.naturalWidth * k, h = im.naturalHeight * k;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 1.1 + i * 2) * 0.5 + i);
      if (glow) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.85; }
      ctx.drawImage(im, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
  }
  function spark(x, y, vx, vy, s) {
    const im = Math.random() < 0.8 ? P.sparks[(Math.random() * 4) | 0] : P.dust[(Math.random() * 2) | 0];
    FX.add({ type: 'custom', layer: 'glow', x, y, vx, vy, drag: 1.2, life: rand(0.6, 1.2), rot: rand(0, TAU), spin: rand(-2, 2), ph: rand(0, TAU),
      draw(ctx, q, u) {
        if (!ok(im)) return;
        const tw = 0.7 + 0.3 * Math.sin(q.t * 18 + q.ph), a = (u < 0.15 ? u / 0.15 : 1) * (1 - u) * tw;
        const k = (s * (1 - 0.4 * u)) / PPU, w = im.naturalWidth * k, h = im.naturalHeight * k;
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= a;
        ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
      } });
  }
  function comet(p, ang) {
    const im = P.streaks[0];
    FX.add({ type: 'custom', layer: 'glow', x: p.x, y: p.y - 55, life: 0.5,
      update(q) { if (p.dash) { q.x = p.x; q.y = p.y - 55; } },   // (its head rides with him; the tail lies along the way behind)
      draw(ctx, q, u) {
        if (!ok(im)) return;
        const k = 1 / PPU, w = im.naturalWidth * k * (0.7 + 0.5 * Math.min(1, u * 3)), h = im.naturalHeight * k;
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(ang + Math.PI); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 1 - u;
        ctx.drawImage(im, -w * 0.1, -h / 2, w, h);
        ctx.restore();
      } });
  }

  // ---------------- a falling star: every 6th hit (1.5 s apart) a comet drops onto the monster ----------------
  // (the streak, the sparkles and the shards are the Codex pieces; the hit itself stays the arrow's: this is a look)
  function fallingStar(e) {
    const im = P.streaks[1], ex = e.x, ey = e.y - 30, sx = ex - 190, sy = ey - 470, ang = Math.atan2(ey - sy, ex - sx);
    FX.add({ type: 'custom', layer: 'glow', x: sx, y: sy, life: 0.28,
      update(q) { const u = Math.min(1, q.t / q.life); q.x = sx + (ex - sx) * u * u; q.y = sy + (ey - sy) * u * u; },
      onEnd() { impact(ex, ey); },
      draw(ctx, q) {
        if (!ok(im)) return;
        const k = 1.25 / PPU, w = im.naturalWidth * k, h = im.naturalHeight * k;
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(ang + Math.PI); ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(im, -w * 0.08, -h / 2, w, h); ctx.restore();
      } });
  }
  function impact(x, y) {
    for (let i = 0; i < 14; i++) { const a = rand(0, TAU), v = rand(80, 320); spark(x, y, Math.cos(a) * v, Math.sin(a) * v * 0.6 - 60, rand(0.8, 1.3)); }
    for (let i = 0; i < 6; i++) {
      const sh = P.shards[i];
      FX.add({ type: 'custom', layer: 'glow', x, y, vx: rand(-280, 280), vy: rand(-420, -140), grav: 1000, life: rand(0.5, 0.8), rot: rand(0, TAU), spin: rand(-12, 12),
        draw(ctx, q, u) {
          if (!ok(sh.img)) return;
          const k = 0.8 / PPU, w = sh.img.naturalWidth * k, h = sh.img.naturalHeight * k;
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.globalAlpha *= 1 - u * u; ctx.drawImage(sh.img, -w / 2, -h / 2, w, h);
          if (ok(sh.vein)) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(sh.vein, -w / 2, -h / 2, w, h); }
          ctx.restore();
        } });
    }
    FX.lights.push({ x, y, r: 220, rgb: '150,225,255', a: 0.9, life: 0.35, t: 0 });
    if (NC.VFX && NC.VFX.shake && NC.game) NC.VFX.shake(NC.game, 3);
  }
  const baseHH = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const r = baseHH.apply(this, arguments);
    const G = NC.game, p = G && G.player;
    if (VC.on && VC.active && p && d === p.d && r && r.dmg > 0 && e && G.time - (H.hitT || 0) > 0.1) {
      H.hitT = G.time; H.hits = (H.hits || 0) + 1;
      if (H.hits % 3 === 0) surges.push(G.time);
      if (VC.stars && H.hits >= 6 && G.time > (H.starT || 0)) { H.hits = 0; H.starT = G.time + 1.5; fallingStar(e); }
    }
    return r;
  };
  VC.star = (e) => fallingStar(e);

  // ---------------- chain lightning (the user, 2026-10-08: "ตีติดเอฟเฟคสายฟ้า แบบชิ่งสายฟ้า") ----------------
  // a hit now and then (40 %, at most every 0.35 s) jumps as lightning to the nearest monsters round it, up to 3 bounces,
  // each bounce a Codex arc stretched from monster to monster (flickering through the arc pictures) with a spark burst,
  // and a little damage of its own (30 % of the hit, less on each bounce; shown as small cyan numbers)
  const CHAIN = (VC.chainSet = { chance: 0.4, gap: 0.35, bounces: 3, range: 260, mul: 0.3, fall: 0.75 });
  const midY = (e) => { const t = NC.labelTop ? NC.labelTop(e) : e.y - 90; return e.y + (t - e.y) * 0.45; };   // (the body's middle: fliers too)
  VC.midY = midY;
  function chainFrom(game, p, e0, dmg0) {
    const hit = new Set([e0]);
    let from = e0, d = dmg0 * CHAIN.mul;
    // (the Blender storm, js/vcstorm.js: thick crackling arcs, an impact burst on every monster, a jolt on the first)
    const SX = NC.VoidStorm && NC.VoidStorm.ready() ? NC.VoidStorm : null;
    if (SX) SX.jolt(game, e0);
    for (let k = 0; k < CHAIN.bounces; k++) {
      let best = null, bd = CHAIN.range;
      for (const e of game.enemies) { if (hit.has(e) || !(e.hp > 0) || e.dead) continue; const dd = Math.hypot(e.x - from.x, e.y - from.y); if (dd < bd) { bd = dd; best = e; } }
      if (!best) break;
      hit.add(best);
      const a = from, b = best, amount = Math.max(1, Math.round(d)), delay = k * 0.07;
      if (SX) {
        NC.VFX.at(delay + 0.001, () => {
          if (b.hp > 0) NC.damageEnemy(game, b, { dmg: amount, crit: false }, 0, 0, { color: '150,225,255', dot: true, fill: '#9fe8ff' });
          SX.arc(() => [a.x, midY(a)], () => [b.x, midY(b)], { life: 0.3, w: 1.15 });
          SX.burst(b.x, b.y, { r: 40, from: 1, alpha: 0.75 }); SX.sparks(b.x, midY(b), 4);
        });
        from = best; d *= CHAIN.fall;
        continue;
      }
      FX.add({ type: 'custom', layer: 'glow', x: a.x, y: a.y, life: delay + 0.2, ax: a.x, ay: midY(a), bx: b.x, by: midY(b), idx: (Math.random() * 6) | 0, swapT: 0, done: false,
        update(q) {
          if (!q.done && q.t >= delay) {
            q.done = true;
            if (b.hp > 0) NC.damageEnemy(game, b, { dmg: amount, crit: false }, 0, 0, { color: '150,225,255', dot: true, fill: '#9fe8ff' });
            const bi = BI.burst[(Math.random() * 4) | 0];
            FX.add({ type: 'custom', layer: 'glow', x: b.x, y: midY(b), life: 0.18, draw(ctx, q2, u) {
              if (!ok(bi)) return; const w = bi.naturalWidth * 0.45 * (1 + u), h = bi.naturalHeight * 0.45 * (1 + u);
              ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 1 - u; ctx.drawImage(bi, q2.x - w / 2, q2.y - h / 2, w, h); ctx.restore();
            } });
          }
          if (q.t > q.swapT) { q.swapT = q.t + 0.035; q.idx = (q.idx + 1 + ((Math.random() * 4) | 0)) % 6; }   // (it crackles)
          if (a.hp > 0 || a === e0) { q.ax = a.x; q.ay = midY(a); }
          if (b.hp > 0) { q.bx = b.x; q.by = midY(b); }
        },
        draw(ctx, q) {
          if (q.t < delay || !BOLT.meta) return;
          const im = BI.bolt[q.idx], M2 = BOLT.meta['bolt_' + q.idx];
          if (!ok(im) || !M2) return;
          const dist = Math.hypot(q.bx - q.ax, q.by - q.ay), di = Math.hypot(M2.b[0] - M2.a[0], M2.b[1] - M2.a[1]) || 1;
          const kx = dist / di, ky = Math.min(1.1, Math.max(0.6, kx * 0.8));
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= Math.min(1, 1.4 - (q.t - delay) / 0.2);
          ctx.translate(q.ax, q.ay); ctx.rotate(Math.atan2(q.by - q.ay, q.bx - q.ax)); ctx.scale(kx, (q.idx & 1) ? -ky : ky);
          ctx.drawImage(im, -M2.a[0], -M2.a[1]);
          ctx.restore();
        } });
      from = best; d *= CHAIN.fall;
    }
    if (hit.size > 1) surges.push(H.t);
  }
  const baseHH2 = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const r = baseHH2.apply(this, arguments);
    const G = NC.game, p = G && G.player;
    if (VC.on && VC.chain && VC.active && p && d === p.d && r && r.dmg > 0 && e && G.time > (H.chainT || 0) && Math.random() < CHAIN.chance) {
      H.chainT = G.time + CHAIN.gap;
      chainFrom(G, p, e, r.dmg);
    }
    return r;
  };
  VC.chainTest = () => { const G = NC.game, p = G.player, e = G.enemies.find((q) => q.hp > 0); if (e) chainFrom(G, p, e, 300); };

  // ---------------- lightning arrows ("ลูกธนูที่ยิงออกไปเป็นลูกธนูสายฟ้า") ----------------
  // every arrow loosed while the set is worn flies as a Codex lightning arrow (assets/voidcomet/fx/larrow_0..2 flickering,
  // larrowB for the finisher's big ones), a crackle of sparks behind it, a spark burst where it lands
  const LA = { img: [0, 1, 2].map((i) => load(D + 'fx/larrow_' + i + '.png')), big: load(D + 'fx/larrowB.png') };
  VC.arrowPic = (big, t) => { const im = big ? LA.big : LA.img[Math.floor(t * 30) % 3]; return ok(im) ? im : null; };
  FX.def('vcarrow', (ctx, q) => {
    const a = Math.atan2(q.vy, q.vx), im = q.big ? LA.big : LA.img[Math.floor(q.t * 30) % 3];
    if (!ok(im)) return;
    const L = q.big ? 170 : 84, k = L / im.naturalWidth, h = im.naturalHeight * k;
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(a); ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(im, -L * 0.9, -h / 2, L, h);                   // (the picture's tip is its right edge: just ahead of the arrow's point)
    ctx.restore();
  }, 'glow');
  const baseAdd2 = FX.add;
  FX.add = function (q) {
    const r = baseAdd2.apply(this, arguments);
    const P0 = NC.game && NC.game.player;
    if (q && q.type === 'arrow' && VC.on && VC.arrows && VC.active && P0 && Math.hypot(q.x - P0.x, q.y - P0.y) < 220 && LA.img.every(ok)) {   // (his own arrows only)
      q.type = 'vcarrow';                                          // (after the other files saw an 'arrow': their hooks stay on it)
      const up = q.update;
      q.update = function (o2) {
        const was = o2.dead, res = up ? up.apply(this, arguments) : undefined;
        if (Math.random() < 0.5) spark(o2.x - o2.vx * 0.02, o2.y - o2.vy * 0.02, -o2.vx * 0.05 + rand(-30, 30), rand(-30, 30), rand(0.4, 0.7));
        if (!was && o2.dead && NC.VoidStorm && NC.VoidStorm.ready()) { NC.VoidStorm.burst(o2.x, o2.y + 45, { r: q.big ? 36 : 24, life: 0.26, alpha: 0.7, from: 1 }); return res; }
        if (!was && o2.dead) { const bi = BI.burst[(Math.random() * 4) | 0]; FX.add({ type: 'custom', layer: 'glow', x: o2.x, y: o2.y, life: 0.16, draw(ctx, q2, u) {
          if (!ok(bi)) return; const w = bi.naturalWidth * 0.5 * (1 + u), hh = bi.naturalHeight * 0.5 * (1 + u);
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 1 - u; ctx.drawImage(bi, q2.x - w / 2, q2.y - hh / 2, w, hh); ctx.restore(); } }); }
        return res;
      };
    }
    return r;
  };

  // ---------------- the bow in moving pieces ("ธนูอยากให้ลูกเล่นเหมือนชิ้นส่วนขยับได้") ----------------
  // Codex redrew the bow as five designed pieces (tip, limb, grip core, limb, tip; tools/voidcomet_cut.py bowparts): they
  // float apart by small breathing gaps, the limbs and tips swing on their inner ends (a chain), and drawing the string
  // opens the gaps and bends the limbs back toward him; in the glow pass lightning crackles across every gap, the pieces'
  // glowing end caps bloom. The string's ends ride on the tips' notches (W.bow moved each draw).
  // (pieces: box x0, y0, x1, y1 + the inner end it swings on, px in the whole bow 94 x 434; notches: the string's ends)
  const BP = { size: [94, 434], pieces: [[3.5, 3.5, 47, 61.5, 32.2, 61.5], [18, 64, 90.5, 173, 68.8, 173], [46.5, 175.5, 85, 251, 65.5, 213.2],
    [16.5, 252.5, 90.5, 360, 70, 252.5], [3.5, 362.5, 49.5, 430, 35.8, 362.5]], notch: [[8.4, 8], [8.9, 425]] };
  const BSET = (VC.bowSet = { gap: 2.6, breathe: 1.2, open: 1.5, flex1: 0.06, flex2: 0.08, bend1: 0.16, bend2: 0.22 });
  const rot = (p, c, r) => { const cs = Math.cos(r), sn = Math.sin(r), dx = p[0] - c[0], dy = p[1] - c[1]; return [c[0] + dx * cs - dy * sn, c[1] + dx * sn + dy * cs]; };
  // a black-backed picture as light with its own alpha (for drawing INTO the glow layer: black pixels there would cover it)
  const A_OF = new Map();
  function asAlpha(im) {
    let c = A_OF.get(im);
    if (c) return c;
    c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    try {
      const d = x.getImageData(0, 0, c.width, c.height), q = d.data;
      for (let i = 0; i < q.length; i += 4) { const m = Math.max(q[i], q[i + 1], q[i + 2]); if (m < 6) { q[i + 3] = 0; continue; } const k = 255 / m; q[i] *= k; q[i + 1] *= k; q[i + 2] *= k; q[i + 3] = m; }
      x.putImageData(d, 0, 0);
    } catch (e) { /* (a tainted canvas: keep it as it is) */ }
    A_OF.set(im, c);
    return c;
  }
  // the arrow on the string while he draws: a lightning arrow too (in the glow pass, bright after the night's darkness)
  NC.nockHook = function (ctx, W, mid, spot, u, o) {
    if (!W || W.id !== 'bow_voidcomet' || !VC.on || !VC.arrows || !VC.active || !LA.img.every(ok)) return false;
    if (o && o.silhouette === KEY) {
      const im = LA.img[Math.floor((NC.game ? NC.game.time : 0) * 30) % 3], a = Math.atan2(spot.y - mid[1], spot.x - mid[0]);
      const L = Math.hypot(spot.x - mid[0], spot.y - mid[1]) + 26, h = (im.naturalHeight * L) / im.naturalWidth, m0 = mid.slice();
      LATE.push([ctx.getTransform(), (c) => {
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, u * 1.5);
        c.translate(m0[0], m0[1]); c.rotate(a); c.drawImage(asAlpha(im), -6, -h / 2, L, h);
      }]);
    }
    return true;
  };
  const baseDW2 = NC.drawWeapon;
  NC.drawWeapon = function (ctx, W, hx, hy, ang, o) {
    o = o || {};
    if (!W || W.id !== 'bow_voidcomet' || !VC.on || !VC.bowParts || o.sayaOnly) return baseDW2.apply(this, arguments);
    const s = NC.SPR[W.sprite], pcs = BP.pieces.map((q, i) => NC.SPR['w_voidcomet_p' + i]);
    if (!s || pcs.some((q) => !q || !ok(q.img))) return baseDW2.apply(this, arguments);
    const pic = (i) => (o.silhouette ? NC.tinted('w_voidcomet_p' + i, o.silhouette) : pcs[i].img);
    const k = (o.scale || 1) * 0.95, w = s.w * k, h = s.h * k, grip = o.grip === undefined ? W.grip : o.grip;
    const fx = w / BP.size[0], fy = h / BP.size[1], x0 = -s.ax * w, y0 = -h * (1 - grip);
    const L = (px, py, dy) => [x0 + px * fx, y0 + py * fy + (dy || 0)];
    const G = NC.game, P = G && G.player && G.player.pose, pull = P ? NC.clamp(P.pull || 0, 0, 1) : 0, t = G ? G.time : 0;
    const gap = (BSET.gap + BSET.breathe * Math.sin(t * 2.3)) * (1 + BSET.open * pull);
    const r1 = BSET.flex1 * (1 + 0.6 * Math.sin(t * 1.7)) + BSET.bend1 * pull, r2 = BSET.flex2 * (1 + 0.6 * Math.sin(t * 1.7 + 0.6)) + BSET.bend2 * pull;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(ang + Math.PI / 2);
    if (o.len !== undefined && o.len !== 1) ctx.scale(1, o.len);
    const drawP = (i, dy) => { const b = BP.pieces[i], a = L(b[0], b[1], dy); ctx.drawImage(pic(i), a[0], a[1], (b[2] - b[0]) * fx, (b[3] - b[1]) * fy); };
    drawP(2, 0);
    const arcs = [], notch = [];
    // one side of the bow: sg -1 up (limb 1, tip 0), +1 down (limb 3, tip 4); the limb swings on its inner end, the tip on
    // its own inner end inside the limb's swing (both bend back toward the string: up = anticlockwise, down = clockwise)
    for (const [sg, li, ti, ni] of [[-1, 1, 0, 0], [1, 3, 4, 1]]) {
      const bl = BP.pieces[li], bt = BP.pieces[ti], a1 = sg * r1, a2 = sg * r2;
      const J1 = L(bl[4], bl[5], sg * gap), J0 = L(bt[4], bt[5], sg * 2 * gap);
      ctx.save();
      ctx.translate(J1[0], J1[1]); ctx.rotate(a1); ctx.translate(-J1[0], -J1[1]);
      drawP(li, sg * gap);
      ctx.translate(J0[0], J0[1]); ctx.rotate(a2); ctx.translate(-J0[0], -J0[1]);
      drawP(ti, sg * 2 * gap);
      ctx.restore();
      const gEnd = L(bl[4], sg < 0 ? BP.pieces[2][1] : BP.pieces[2][3]);                // the grip core's end cap
      arcs.push([gEnd, J1], [rot(L(bt[4], bt[5], sg * gap), J1, a1), rot(J0, J1, a1)]);   // core -> limb, limb -> tip
      notch.push(rot(rot(L(BP.notch[ni][0], BP.notch[ni][1], sg * 2 * gap), J0, a2), J1, a1));
    }
    // the lightning across the gaps: in the glow pass only (it shines after the night's darkness, with the bloom)
    if (o.silhouette === KEY && BOLT.meta) {
      arcs.forEach(([pa, pb], i) => {
        const idx = (Math.floor(t * 24) + i * 3) % 4, im = BI.boltS[idx], M2 = BOLT.meta['boltS_' + idx];
        if (!ok(im) || !M2) return;
        const len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) + 9, di = Math.hypot(M2.b[0] - M2.a[0], M2.b[1] - M2.a[1]) || 1, kx = len / di;
        const an = Math.atan2(pb[1] - pa[1], pb[0] - pa[0]), mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2;
        const ga = 0.75 + 0.25 * Math.sin(t * 40 + i), ky = Math.max(0.16, kx * 2) * (i & 1 ? -1 : 1);
        ctx.save(); ctx.translate(mx - Math.cos(an) * len / 2, my - Math.sin(an) * len / 2); ctx.rotate(an); ctx.scale(kx, ky);
        LATE.push([ctx.getTransform(), (c) => { c.globalCompositeOperation = 'lighter'; c.globalAlpha = ga; c.drawImage(asAlpha(im), -M2.a[0], -M2.a[1]); }]);
        ctx.restore();
      });
    }
    ctx.restore();
    // the string's ends ride on the tips' notches
    W.bow.x = ((notch[0][0] + notch[1][0]) / 2 - x0) / w; W.bow.top = (notch[0][1] - y0) / h; W.bow.bottom = (notch[1][1] - y0) / h;
  };

  // ---------------- the pets as frames ----------------
  const FR = {};
  fetch(D + 'frames.json').then((r) => r.json()).then((j) => {
    for (const [pet, m] of Object.entries(j)) {
      FR[pet] = { cell: m.cell, anims: m.anims, img: {}, vein: {} };
      for (const a of Object.keys(m.anims)) { FR[pet].img[a] = load(D + pet + '_' + a + '.png'); FR[pet].vein[a] = load(D + pet + '_' + a + '_vein.png'); }
    }
  }).catch(() => {});
  // how big a cell is in the world (the creature as big as the old rig)
  const SIZE = { wolf: 66, falcon: 92 };                      // (the wolf: the cell's height; the falcon: the cell's width)
  // which animation, and where in it (0..1): the rigs' own state (js/petrig.js) decides
  const cyc = (ph) => (((ph || 0) / TAU) % 1 + 1) % 1;
  function petFrame(type, st) {
    const t = st.age || 0;
    if (type === 'wolf') {
      if ((st.bite || 0) > 0) return ['bite', Math.min(0.999, 1 - st.bite / 0.32)];
      if ((st.amp || 0) > 0.25) return ['run', cyc(st.ph)];
      return ['idle', (t * 0.6) % 1];
    }
    if ((st.atk || 0) > 0.5) return ['strike', 0.25 + ((t * 2.5) % 1) * 0.75];
    if ((st.dive || 0) > 0.5) return ['strike', 0];
    // (its own slow wingbeat: the rig's clock beats 4-7.5 times a second, a blur of jumping pictures at 6 frames; the user,
    // "นกบินกางปีกไวไป อยากให้สมูท": ~1.5 beats a second cruising, 2.4 in a hurry, a glide (wings up) when it rests)
    const now = NC.game ? NC.game.time : t, dt = Math.min(0.1, Math.max(0, now - (st._vcT === undefined ? now : st._vcT)));
    st._vcT = now;
    const flap = st.flapW === undefined ? 1 : st.flapW, rate = flap < 0.3 ? 0 : (st.sp || 0) > 700 ? 2.4 : 1.5;
    if (rate === 0) st._vcPh = (st._vcPh || 0) + Math.min(dt * 1.5, (1 - ((st._vcPh || 0) % 1)) % 1);   // (finish the beat, then hold)
    else st._vcPh = (st._vcPh || 0) + dt * rate;
    return ['fly', (st._vcPh % 1 + 1) % 1];
  }
  function drawPet(ctx, type, st, x, y, o, glow) {
    const F = FR[type];
    if (!F) return false;
    const [anim, u] = petFrame(type, st), im = glow ? F.vein[anim] : F.img[anim];
    if (!ok(im)) return false;
    const [CW, CH] = F.cell, n = F.anims[anim], k = Math.floor(u * n) % n;
    let s = (o.scale || 1) * (type === 'wolf' ? SIZE.wolf / CH : SIZE.falcon / CW), hop = 0;
    if ((st.age || 0) < 0.5) { const u = st.age / 0.5; s *= u < 0.3 ? 0.35 + 0.75 * (u / 0.3) : 1; hop = -Math.sin(Math.min(1, u / 0.7) * Math.PI) * 22; }
    ctx.save();
    ctx.translate(x, y + hop);
    ctx.scale(o.flip ? -s : s, s);                            // (the frames face LEFT: flipped to face right)
    if (type === 'falcon') ctx.rotate(-Math.max(-0.35, Math.min(0.35, (st.vy || 0) / 900)));
    if (glow) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.9; }
    else ctx.globalAlpha *= o.alpha === undefined ? 1 : o.alpha;
    const sx = Math.min(k, n - 1) * CW, dy = type === 'wolf' ? -(CH - 10) : -CH / 2;
    if (type === 'falcon' && anim === 'fly') {
      // (the wing beat blended from one picture into the next, so the slow beat glides instead of stepping)
      const f = (u * n) % 1, sx2 = ((k + 1) % n) * CW, a0 = ctx.globalAlpha;
      if (glow) { ctx.globalAlpha = a0 * (1 - f); ctx.drawImage(im, sx, 0, CW, CH, -CW / 2, dy, CW, CH); ctx.globalAlpha = a0 * f; ctx.drawImage(im, sx2, 0, CW, CH, -CW / 2, dy, CW, CH); }
      else { ctx.drawImage(im, sx, 0, CW, CH, -CW / 2, dy, CW, CH); ctx.globalAlpha = a0 * f; ctx.drawImage(im, sx2, 0, CW, CH, -CW / 2, dy, CW, CH); }
      ctx.globalAlpha = a0;
    } else ctx.drawImage(im, sx, 0, CW, CH, -CW / 2, dy, CW, CH);
    if (glow && VC.flow) {                                  // (the light runs through the pet's cracks too, head to tail)
      if (pcv.width !== CW || pcv.height !== CH) { pcv.width = CW; pcv.height = CH; }
      pc.globalCompositeOperation = 'copy'; pc.drawImage(im, sx, 0, CW, CH, 0, 0, CW, CH);
      pc.globalCompositeOperation = 'destination-in';
      const u2 = ((H.t || 0) / 1.3 + (type === 'wolf' ? 0 : 0.5)) % 1 * 1.4 - 0.2, bx = u2 * CW, bw = CW * 0.14;
      pc.fillStyle = bandStops(pc.createLinearGradient(bx - bw, 0, bx + bw, 0)); pc.fillRect(0, 0, CW, CH);
      pc.globalCompositeOperation = 'source-over';
      ctx.filter = 'brightness(1.7) saturate(0.7)'; ctx.drawImage(pcv, -CW / 2, dy, CW, CH); ctx.filter = 'none';
    }
    ctx.restore();
    return true;
  }
  const pcv = document.createElement('canvas'), pc = pcv.getContext('2d');
  // (drawn after the night's darkness: one queue, emptied each time it is drawn)
  function drawQueue(ctx) { for (const r of S.q) { drawPet(ctx, r.type, r.st, r.x, r.y, r.o, true); if (r.zap > 0) zapPet(ctx, r); } S.q.length = 0; }
  // a pet turned to lightning (js/vcstorm.js: VC.zapOf): its body flashed white-blue and its cracks burning, flickering
  function zapPet(ctx, r) {
    const F = FR[r.type];
    if (!F) return;
    const [anim, u] = petFrame(r.type, r.st), body = F.img[anim], vein = F.vein[anim];
    if (!ok(body) || !ok(vein)) return;
    const [CW, CH] = F.cell, n = F.anims[anim], k = Math.floor(u * n) % n, sx = Math.min(k, n - 1) * CW;
    const s = (r.o.scale || 1) * (r.type === 'wolf' ? SIZE.wolf / CH : SIZE.falcon / CW), dy = r.type === 'wolf' ? -(CH - 10) : -CH / 2;
    const fl = 0.75 + 0.25 * Math.sin((H.t || 0) * 47 + r.x);
    ctx.save(); ctx.translate(r.x, r.y); ctx.scale(r.o.flip ? -s : s, s);
    if (r.type === 'falcon') ctx.rotate(-Math.max(-0.35, Math.min(0.35, (r.st.vy || 0) / 900)));
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = 'brightness(1.15) saturate(0.6)'; ctx.globalAlpha = 0.22 * r.zap * fl; ctx.drawImage(body, sx, 0, CW, CH, -CW / 2, dy, CW, CH);
    ctx.filter = 'blur(3px) brightness(2.2)'; ctx.globalAlpha = r.zap * fl; ctx.drawImage(vein, sx, 0, CW, CH, -CW / 2, dy, CW, CH);
    ctx.filter = 'none'; ctx.drawImage(vein, sx, 0, CW, CH, -CW / 2, dy, CW, CH);
    ctx.restore();
  }
  VC.drawPet = drawPet;
  if (NC.PetRig && NC.PetRig.draw) {
    const basePet = NC.PetRig.draw;
    NC.PetRig.draw = function (ctx, type, st, x, y, o, q) {
      o = o || {};
      // the player's own summons: the wolf (pets.js passes the pet) and the falcon (skills_v21.js via NC.PetRig.falcon)
      const mine = VC.on && VC.pets && VC.active && ((type === 'wolf' && q) || type === 'falcon');
      if (mine && drawPet(ctx, type, st, x, y, o, false)) { if (S.q.length < 12) S.q.push({ type, st, x, y, o, zap: VC.zapOf ? VC.zapOf(type, q) : 0 }); return true; }
      return basePet.apply(this, arguments);
    };
  }
  // (2026-10-18 bug sweep) the visor's other looks are not items the hero owns: items.js loadGear dropped the hat of a save
  // made with the visor switched (the slot came back empty). The look is put back when the hero owns one of the family.
  const FAMILY = /^hat_voidcomet(_open|_w[123])?$/;
  const baseLoadGear = NC.loadGear;
  NC.loadGear = function (game, params) {
    const r = baseLoadGear.apply(this, arguments);
    try {
      if (!NC.ONLINE) {
        const s = JSON.parse(localStorage.getItem('nightcamp.save.v1') || 'null'), want = s && s.equip && s.equip.hat, p = game.player;
        if (want && FAMILY.test(want) && ITEMS[want] && p.equip.hat !== want && (!p.equip.hat || FAMILY.test(p.equip.hat)) && [...p.owned].some((id) => FAMILY.test(id))) { p.equip.hat = want; if (NC.applyGear) NC.applyGear(game); }
      }
    } catch (e) { /* no save */ }
    return r;
  };
})();
