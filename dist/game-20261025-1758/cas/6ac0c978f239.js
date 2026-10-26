/* rootbossfx.js — the root-possessed bosses' skill effects, PAINTED (the user, 2026-10-14, seeing them fight with js/dunbosses.js's
   code-drawn warning circles, lanes, orbs and puddles: "สกิล ห้ามวาดเองนะ ให้ใช้แนวอื่น เช่น รูปหรือ blender หรือวาดสด").
   Every piece is a Codex picture (assets/gen/make_lostfx_prompts.py -> tools/lostfx_cut.py -> assets/lost/fx_*.png): the
   danger ring and its filling light, the danger lane, the shockwave, the sap pool, the root spikes, the root orb, the sap
   glob, dark smoke, dust, the spark, the dark flame. This file only places, stretches, turns, scales and fades them.
   The fight itself stays dunbosses.js's (the same moves the game server knows): its effects for these bosses are swapped
   as they are made:
     - the four helpers' effects (dun: 'warn' | 'lane' | 'orb' | 'puddle', tagged in dunbosses.js) get painted drawers
     - while a root boss updates (and inside its orbs), the plain FX it asks for become painted ones: puff -> smoke or
       dust, ring -> the shockwave, ember -> a spark (in a breath: the dark flame)
     - more of the roots: spikes burst up where a slam lands (a ring of them) and where each rain spot falls
   The old dungeon bosses (bat king, ant queen, crypt lord, lava dragon) are left as they were.
   Load after js/rootboss.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX;
  if (!FX || !NC.RootBoss) return;
  const B = NC.RootBoss.B, TAU = Math.PI * 2;
  const isRoot = (e) => !!(e && B[e.type]);
  const S = (n) => { const s = NC.SPR[n]; return s && s.img ? s : null; };
  const ready = () => !!(S('fx_warn_rim') && S('fx_smoke'));
  const ease = (u) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);
  // one painted piece, centred on (x, y) (ay 1: standing on y), w x h world units
  function pic(ctx, n, x, y, w, h, a, rot, add, ay, flip) {
    const s = S(n);
    if (!s || a <= 0.005 || w <= 0 || h <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, a);
    if (add) ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(s.img, -w / 2, ay ? -h : -h / 2, w, h);
    ctx.restore();
  }

  // ---------------- dunbosses.js's four helpers, painted ----------------
  const PAINT = {
    warn(ctx, p, u) { // the danger zone: a faint whole area, its light filling from the middle, the rim of roots
      const k = ease(u), beat = 0.85 + 0.15 * Math.sin(p.t * 18), W = p.r * 2.08, H = W * 0.58;
      pic(ctx, 'fx_warn_fill', p.x, p.y, W, H, 0.16 * beat);
      pic(ctx, 'fx_warn_fill', p.x, p.y, W * k, H * k, 0.5 * beat);
      pic(ctx, 'fx_warn_rim', p.x, p.y, W, H, 0.9);
    },
    lane(ctx, p, u) { // the danger lane: the strip of torn earth along the attack, filling from the boss outwards
      const s = S('fx_lane');
      if (!s) return;
      const beat = 0.85 + 0.15 * Math.sin(p.t * 18), w = p.w * 1.15;
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, 0.62); ctx.rotate(p.ang);
      ctx.globalAlpha = 0.3 * beat; ctx.drawImage(s.img, 0, -w / 2, p.len, w);
      const k = Math.max(0.04, ease(u));
      ctx.beginPath(); ctx.rect(0, -w, p.len * k, w * 2); ctx.clip();
      ctx.globalAlpha = 0.9 * beat; ctx.drawImage(s.img, 0, -w / 2, p.len, w);
      ctx.restore();
    },
    orb(ctx, c) { // a root orb turning as it flies; the acid's sap glob points the way it flies
      if (c.rgb === '150,255,100') { pic(ctx, 'fx_glob', c.x, c.y, c.R * 2.6, c.R * 2.6 * glob(), 1, Math.atan2(c.vy, c.vx)); return; }
      const sz = c.R * 2.3 * (1 + Math.sin(c.t * 14) * 0.06);
      pic(ctx, 'fx_orb', c.x, c.y, sz, sz, 0.5, 0, true);
      pic(ctx, 'fx_orb', c.x, c.y, sz, sz, 1, c.t * 4);
    },
    puddle(ctx, c) { // a pool of dark sap, fading in and out
      const a = Math.min(1, c.t / 0.25) * Math.min(1, (c.life - c.t) / 0.5);
      pic(ctx, 'fx_pool', c.x, c.y, c.R * 2.2, c.R * 2.2 * 0.58, 0.92 * a);
    },
  };
  const glob = () => { const s = S('fx_glob'); return s ? s.h / s.w : 0.6; };

  // ---------------- the plain FX a root boss asks for, painted ----------------
  const DUST = /^(160,140,130|215,218,230|160,140,190)$/;
  FX.def('rfx_smoke', (ctx, p, u) => {
    const r = NC.lerp(p.r0, p.r1, ease(u)) * 2.3;
    pic(ctx, p.pic, p.x, p.y, r, r, (p.dust ? 0.75 : 0.85) * (1 - u), p.rot0);
  }, 'low');
  FX.def('rfx_wave', (ctx, p, u) => {
    // (the wide ones - waking up r 440, the rage r 540 - would cover the screen with the painted band: thinner, fainter)
    const big = p.r1 > 300, r = NC.lerp(p.r0, p.r1, ease(u)) * (big ? 1.5 : 1.9);
    pic(ctx, 'fx_wave', p.x, p.y, r, r * 0.56, (big ? 0.42 : 0.85) * (1 - u * u));
  }, 'glow');
  FX.def('rfx_spark', (ctx, p, u) => {
    const s = (p.sz || 26) * (1 - u * 0.5);
    pic(ctx, 'fx_spark', p.x, p.y, s, s, 1 - u, p.t * 3, true);
  }, 'glow');
  FX.def('rfx_flame', (ctx, p, u) => {
    const s = S('fx_flame');
    if (!s) return;
    const w = 96 * (0.7 + 0.7 * u), h = w * s.h / s.w;
    pic(ctx, 'fx_flame', p.x, p.y, w, h, 0.95 * Math.sin(Math.PI * Math.min(1, u * 1.15)), p.ang);
  }, 'glow');
  // root spikes bursting up out of the ground and sinking back (standing among the characters)
  FX.def('rfx_spikes', (ctx, p, u) => {
    const s = S('fx_spikes');
    if (!s || p.t < 0) return;
    const up = ease(p.t / 0.12), down = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
    const h = 110 * p.k * up * (0.6 + 0.4 * down), w = 110 * p.k * s.w / s.h;
    pic(ctx, 'fx_spikes', p.x, p.y, w, h, Math.min(1, down * 1.4), 0, false, true, p.flip);
  }, 'sorted');
  const spikes = (x, y, k, delay) => FX.add({ type: 'rfx_spikes', x, y, k, life: 0.9, t0: delay || 0, flip: Math.random() < 0.5 });

  let cur = null; // (the root boss whose update or orb is running now)
  const baseAdd = FX.add;
  FX.add = function (p) {
    if (p && ready()) {
      if (p.dun && isRoot(p.owner)) {
        if (PAINT[p.dun]) p.draw = PAINT[p.dun];
        if (p.dun === 'orb') { // (its hit puff and the pool it leaves are the boss's too)
          const up = p.update, end = p.onEnd, e = p.owner;
          p.update = function () { const o = cur; cur = e; try { return up && up.apply(this, arguments); } finally { cur = o; } };
          if (end) p.onEnd = function () { const o = cur; cur = e; try { return end.apply(this, arguments); } finally { cur = o; } };
        }
      } else if (cur || (p.type === 'ring' && p.color === '225,70,235')) {
        if (p.type === 'puff') {
          p.dust = DUST.test(p.color || '');
          p.type = 'rfx_smoke'; p.pic = p.dust ? 'fx_dust' : 'fx_smoke'; p.rot0 = Math.random() * TAU; p.layer = p.layer || 'low';
        } else if (p.type === 'ring') { p.type = 'rfx_wave'; p.layer = 'glow'; }
        else if (p.type === 'ember') {
          if (cur && cur.state === 'breath') { p.type = 'rfx_flame'; p.ang = cur.ang; p.life *= 1.3; }
          else p.type = 'rfx_spark';
          p.layer = 'glow';
        }
      }
    }
    const out = baseAdd.call(this, p);
    if (p && p.t0) p.t = -p.t0; // (a spike that waits its turn)
    return out;
  };

  // ---------------- while a root boss updates ----------------
  const baseUpdate = NC.updateEnemy;
  NC.updateEnemy = function (game, e, dt) {
    if (!isRoot(e) || !ready()) return baseUpdate.apply(this, arguments);
    const s0 = e.state, d0 = e.done;
    const o = cur; cur = e;
    let out;
    try { out = baseUpdate.apply(this, arguments); } finally { cur = o; }
    // the slam lands: a ring of roots bursts up round it
    if (s0 === 'slam' && !d0 && (e.state !== 'slam' || e.done)) {
      spikes(e.x, e.y + 4, 1.15, 0);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + Math.random() * 0.4, r = 130 + Math.random() * 70;
        spikes(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.58, 0.7 + Math.random() * 0.35, 0.04 + Math.random() * 0.08);
      }
    }
    // each rain spot: the roots come up through it
    if (e.state === 'rain' || s0 === 'rain') for (const q of e.spots || []) if (q.done && !q._rfx) {
      q._rfx = true;
      spikes(q.x, q.y + 4, 1, 0);
      for (let i = 0; i < 2; i++) spikes(q.x + NC.rand(-60, 60), q.y + NC.rand(-30, 30), 0.6 + Math.random() * 0.2, 0.05 + i * 0.05);
    }
    return out;
  };

  NC.RootBossFX = { PAINT, spikes };
})();
