/* ironrage.js — ชุดเกราะเหล็กคลั่ง (IRONRAGE): a SECRET boss set for the berserker greatsword (the user, 2026-10-04:
   "ลองทำชุดเกราะดำ สำหรับดาบใหญ่นี้ด้วย เหมือนเป็นเซ็ทบอสลับ ใช้ลวดลายแบบดาบนี้เลย มีแสงกระพริบแบบ bloom นี้").
   Black plate of the sword's own iron (assets/gen/make_ironrage_prompts.py: concept -> parts + helms), worn like the other
   boss sets: a long outfit (robe_ironrage: torso, arms, legs, the plated tassets as its skirt), a cape and a helm.
   Its red cracks GLOW and blink with the sword's heartbeat (js/gs_berserk.js: NC.GsBerserk.beat):
     tools/veinglow.py made a <sprite>_vein.png for every armour picture (the cracks pushed hot); after the night's
     darkness the hero is drawn AGAIN with those layers only (avatar.js's silhouette path, NC.tinted asked for the
     '#ironglow' colour returns the vein layer, or nothing for a part without one), into a small canvas round the hero,
     then laid over the world with 'lighter' twice: blurred (the bloom spilling past the plates) and sharp (the cracks).
   TEST pieces for now: ?equip=robe_ironrage,cape_ironrage,hat_ironrage,gs_berserk (not in drops yet). */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, FX = NC.FX;
  const KEY = '#ironglow';
  const M = NC.ASSET_MANIFEST;
  if (!M.rig_ironrage_torso) return;                         // (no art yet)

  // ---------------- the pieces ----------------
  Object.assign(ITEMS, {
    robe_ironrage: { slot: 'robe', name: 'ชุดเกราะเหล็กคลั่ง', rig: 'ironrage', rarity: 'legend', stats: { hp: 80, atk: 0.04, crit: 0.04 },
      desc: 'เกราะเหล็กดิบตีจากเหล็กก้อนเดียวกับดาบใหญ่เหล็กโทสะ รอยร้าวสีเลือดเรืองเต้นตามจังหวะหัวใจ (ชุดบอสลับ · ทดสอบ)' },
    cape_ironrage: { slot: 'cape', name: 'ผ้าคลุมเหล็กคลั่ง', sprite: 'rig_ironrage_cape', rarity: 'legend', stats: { atk: 0.03 }, desc: 'ผ้าคลุมแดงหม่นขาดวิ่น' },
  });
  const MF = Object.assign({}, NC.ASSET_MANIFEST_FASHION || {}, M);
  if (MF.hat_ironrage_open) ITEMS.hat_ironrage = { slot: 'hat', name: 'หมวกเกราะอสูรเหล็ก', sprite: 'hat_ironrage_open', icon: 'hat_ironrage', art: 2, rarity: 'legend',
    fit: 1.45, seat: 0.665, dx: 0.06, clip: false, hood: true, soft: 0, stats: { hp: 25, atk: 0.05 }, desc: 'หมวกหัวอสูรเหล็กดำ ขากรรไกรเขี้ยวเหล็กครอบหน้า ตาแดงเรือง' };
  if (MF.hat_ironrage) ITEMS.hat_ironrage_closed = { slot: 'hat', name: 'หมวกเกราะอสูรเหล็ก (ปิดหน้า)', sprite: 'hat_ironrage', art: 2, rarity: 'legend',
    fit: 1.485, seat: 0.665, dx: 0.06, clip: false, hood: true, soft: 0, stats: { hp: 25, atk: 0.05 }, desc: 'หมวกหัวอสูรเหล็กดำแบบปิดหน้า ช่องตาแดงเรือง' };
  const MINE = (e) => e && (e.robe === 'robe_ironrage' || e.cape === 'cape_ironrage' || /^hat_ironrage/.test(e.hat || ''));

  // ---------------- the vein layers ----------------
  const GLOW = {};
  for (const [name, m] of Object.entries(Object.assign({}, NC.ASSET_MANIFEST_FASHION || {}, M))) {
    if (!/ironrage/.test(name) || /_vein$|_bloom$|_fill$|_head$|_cape$/.test(name) || !m.src) continue;   // (the plates only: no head, no cloth)
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
  // NC.GlowFX: switches for the making-of video (each effect on / off; `early` = the glow drawn BEFORE the night's
  // darkness, to show why it is drawn after it). Shared with js/gs_berserk.js.
  const G = (NC.GlowFX = NC.GlowFX || { off: false, early: false, noBloom: false, noEmbers: false, noLight: false, noBeat: false, noSwing: false });
  const H = { on: false, shot: null };
  const baseDP = NC.drawPlayer;
  NC.drawPlayer = function (ctx, game) {
    const p = game.player;
    if (!p || !MINE(p.equip) || p.dead > 0) return baseDP.apply(this, arguments);
    H.on = true; H.p = p; H.t = game.time;
    try { return baseDP.apply(this, arguments); } finally { H.on = false; if (G.early && H.shot) glowPass(ctx, game); }
  };
  const baseDH = NC.drawHero;
  NC.drawHero = function (ctx, equip, P, x, y, o) {
    if (H.on && equip === H.p.equip && !(o && o.silhouette)) H.shot = { m: ctx.getTransform(), equip, P, x, y, o: o || {} };
    return baseDH.apply(this, arguments);
  };
  const off = document.createElement('canvas'), oc = off.getContext('2d');
  const beat = (t) => (NC.GsBerserk ? NC.GsBerserk.beat(t, false) : 0.5 + 0.5 * Math.sin(t * 4.8));
  const baseTrail = NC.drawTrail;
  NC.drawTrail = function (ctx, game) {
    if (H.shot) glowPass(ctx, game);
    return baseTrail.apply(this, arguments);
  };
  function glowPass(ctx, game) {
    const s = H.shot;
    H.shot = null;
    if (s && !G.off) {
      const p = H.p, swinging = !!(p.atk && p.atk.on) && !G.noSwing;
      const a = G.noBeat ? (swinging ? 1.2 : 0.75) : NC.GsBerserk ? NC.GsBerserk.beat(H.t, swinging) : beat(H.t);
      const m = s.m, k = Math.hypot(m.a, m.b), sc = (s.o.scale || 1) * k;
      const B = Math.ceil(300 * sc), cx = m.a * s.x + m.c * (s.y - 60) + m.e, cy = m.b * s.x + m.d * (s.y - 60) + m.f;
      if (off.width !== B) { off.width = B; off.height = B; }
      oc.setTransform(1, 0, 0, 1, 0, 0); oc.clearRect(0, 0, B, B);
      oc.setTransform(m.a, m.b, m.c, m.d, m.e - (cx - B / 2), m.f - (cy - B / 2));
      baseDH.call(NC, oc, s.equip, s.P, s.x, s.y, Object.assign({}, s.o, { silhouette: KEY, tint: null, alpha: 1 }));
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      if (!G.noBloom) {
        ctx.filter = `blur(${Math.max(2, 5 * sc).toFixed(1)}px)`;          // the bloom
        ctx.globalAlpha = Math.min(1, 0.85 * a);
        ctx.drawImage(off, cx - B / 2, cy - B / 2);
        ctx.drawImage(off, cx - B / 2, cy - B / 2);
      }
      ctx.filter = 'none';                                                   // the hot cracks
      ctx.globalAlpha = Math.min(1, 0.45 + 0.55 * a);
      ctx.drawImage(off, cx - B / 2, cy - B / 2);
      ctx.restore();
      // embers off the plates, a warm red light round the hero
      if (!G.noEmbers && game.time > (H.emberT || 0)) {
        H.emberT = game.time + (swinging ? 0.05 : 0.16);
        ember(p.x + NC.rand(-16, 16), p.y - NC.rand(18, 70));
      }
      if (!G.noLight) warm(p, a);
    }
  }
  let light = null;
  function warm(p, a) {
    if (NC.GsBerserk && p.equip.weapon === 'gs_berserk') return;           // (the sword lights the ground already)
    if (!light || !FX.lights.includes(light)) { light = { x: p.x, y: p.y - 40, r: 170, rgb: '255,50,35', a: 0, life: 0.5, t: 0, follow: p, oy: -40 }; FX.lights.push(light); }
    light.a = 0.3 + 0.35 * Math.min(1, a); light.t = 0.05;
  }
  function ember(x, y) {
    FX.add({ type: 'custom', layer: 'glow', x, y, life: NC.rand(0.5, 1.0), vx: NC.rand(-12, 12), vy: -NC.rand(25, 60), drag: 0.6, r: NC.rand(1.1, 2.0),
      draw(ctx, q, u) {
        const al = (1 - u) * (u < 0.15 ? u / 0.15 : 1);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,${(90 + 110 * (1 - u)) | 0},60,${al})`;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (1 - 0.4 * u), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,60,40,${al * 0.25})`;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r * 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } });
  }
  // ---------------- the visor: U shuts / opens the beast's jaw (the user: "ปิดหน้ากากยังไงอ่ะ") ----------------
  const VISOR = { hat_ironrage: 'hat_ironrage_closed', hat_ironrage_closed: 'hat_ironrage' };
  function visor(game) {
    const p = game && game.player, to = p && VISOR[p.equip.hat];
    if (!to || !ITEMS[to]) return false;
    p.equip.hat = to;
    const shut = to === 'hat_ironrage_closed';
    if (NC.applyGear) NC.applyGear(NC.game); // (was NC.recalcStats, which never existed)
    if (NC.HUD && NC.HUD.toast) NC.HUD.toast(shut ? 'ปิดหน้ากาก' : 'เปิดหน้ากาก');
    if (shut) for (let i = 0; i < 10; i++) ember(p.x + NC.rand(-10, 18), p.y - NC.rand(70, 100));   // (sparks off the jaw)
    return true;
  }
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyU' || e.repeat || !NC.game) return;
    const t = document.activeElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    visor(NC.game);
  });
  NC.Ironrage = { glow: GLOW, KEY, visor };
  // (2026-10-18 bug sweep) the visor's other looks are not items the hero owns: items.js loadGear dropped the hat of a save
  // made with the visor switched (the slot came back empty). The look is put back when the hero owns one of the family.
  const FAMILY = /^hat_ironrage(_closed)?$/;
  (NC.loadHooks || (NC.loadHooks = [])).push((game, params) => {
    try {
      if (!NC.ONLINE) {
        const s = JSON.parse(localStorage.getItem('nightcamp.save.v1') || 'null'), want = s && s.equip && s.equip.hat, p = game.player;
        if (want && FAMILY.test(want) && ITEMS[want] && p.equip.hat !== want && (!p.equip.hat || FAMILY.test(p.equip.hat)) && [...p.owned].some((id) => FAMILY.test(id))) { p.equip.hat = want; if (NC.applyGear) NC.applyGear(game); }
      }
    } catch (e) { /* no save */ }
  });
})();
