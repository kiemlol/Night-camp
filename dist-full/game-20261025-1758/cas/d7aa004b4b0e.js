/* maplefx.js — skills made as painted frame-by-frame animations (2026-10-15, the user: "พวกสกิลแบบเฟรมเขาทำยังไง" ->
   "ลองทำสกิลแนวนี้ให้ดู 1 สกิล เอาของธนูดีกว่า" -> "ทำสกิลธนูที่เหลือทั้งหมดเลย" ... "ใช้ mesh ช่วยได้นะ"): every effect is a
   painted FRAME-BY-FRAME animation, each frame its own picture with its own origin and delay (like a 2D MMO's skill files:
   the cast effect, the "ball" that flies, the hit on each monster, the skill's own pieces); the code only places, turns,
   flips and fades the frames, it draws nothing itself. Two long pieces are MESH bands (js/meshfx.js MX.band) textured with
   paintings: the starlight beam (its painted frames, dissolving with noise as it ends) and the heavy arrow's ember streak.
   Codex paints the frames (assets/gen/make_maple_prompts.py, a grid of frames on black, solid pieces on magenta),
   tools/maple_cut.py cuts them into assets/maplefx/ + assets/maplefx.manifest.js (NC.ASSET_MANIFEST_MAPLE: per animation
   k = its size in the game, loop, hold [a, b] (frames looped while it lasts), solid (no added glow), len (a beam's length),
   frames [{src, w, h, ox, oy, d (ms)}]).
   Every ARCHER skill: ยิงคู่ (Q, RUN.double), ห่าฝนธนู (E, shower), ธนูพายุทะลวง (R, gale), ธนูดาราพิฆาต (F, starshot),
   ธนูกระแทก (ar_charge), ยิงกระจาย (ar_multishot), กับดักเถาวัลย์ (ar_snare), สมาธิเล็ง (ar_concentrate, the buff). Their
   numbers are skills.js / skills_t1.js's (speeds, ranges, hits, stuns, traps); only the looks change.
   ?maple=0: the old looks (and whatever archerfx.js / hitstyle.js picked). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, RUN = NC.SKILL_RUN, K = NC.SkillKit, SK = NC.SKILLS;
  if (!FX || !V || !RUN || !K || !K.shot) return;
  // glow: the frame drawn once more, added, at this strength (the painting's own light, a little brighter at night)
  // smooth: each frame melts into the next over its last `blend` part (60 fps out of 10-25 fps paintings, no extra
  // pictures), a one-shot's last frame fades out; ?maplesmooth=0: plain flipbooks (hard cuts)
  const MF = (NC.MapleFX = { on: true, glow: 0.3, smooth: true, blend: 0.6 });
  const MAN = NC.ASSET_MANIFEST_MAPLE || {};
  const C = K.C || {};
  const WIND = C.wind || '140,255,150', GOLD = C.gold || '255,210,90', EMBER = '255,170,90', SKY = '160,220,255', TEAL = '120,230,210';
  const rand = NC.rand, TAU = Math.PI * 2, alive = K.alive;
  const ok = (im) => im && im.complete && im.naturalWidth > 0;
  const IMG = {};
  for (const name in MAN) {
    const A = MAN[name];
    A.cum = [0];
    for (const f of A.frames) A.cum.push(A.cum[A.cum.length - 1] + f.d / 1000);
    A.total = A.cum[A.cum.length - 1];
    IMG[name] = A.frames.map((f) => { const im = new Image(); im.src = f.src; return im; });
  }
  MF.ready = (...names) => names.every((n) => IMG[n] && IMG[n].every(ok));
  MF.img = (name, i) => IMG[name] && IMG[name][i];

  // the frame showing t seconds in (the delays add up); a loop wraps; holding: past its intro an animation with hold
  // [a, b] cycles frames a..b-1; -1 once a one-shot animation is over
  MF.frame = function (name, t, holding) {
    const A = MAN[name];
    if (!A) return -1;
    if (A.loop) t %= A.total;
    else if (holding && A.hold && t >= A.cum[A.hold[0]]) {
      const a = A.cum[A.hold[0]], len = A.cum[A.hold[1]] - a;
      t = a + ((t - a) % len);
    }
    for (let i = 0; i < A.frames.length; i++) if (t < A.cum[i + 1]) return i;
    return -1;
  };
  // smoothing: the frame now (i), the one after it (j: the loop / hold wraps; -1 after a one-shot's last) and how far the
  // change has gone (k 0..1, eased); a one-shot's last frame: out (0..1) its fade
  const ease = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
  MF.pick = function (name, t, holding) {
    const A = MAN[name];
    if (!A) return null;
    const n = A.frames.length;
    let from = -1, to = -1;
    if (A.loop) { t %= A.total; from = 0; to = n; }
    else if (holding && A.hold && t >= A.cum[A.hold[0]]) {
      const a = A.cum[A.hold[0]], len = A.cum[A.hold[1]] - a;
      t = a + ((t - a) % len); from = A.hold[0]; to = A.hold[1];
    }
    let i = -1;
    for (let q = 0; q < n; q++) if (t < A.cum[q + 1]) { i = q; break; }
    if (i < 0) return null;
    const f = (t - A.cum[i]) / (A.cum[i + 1] - A.cum[i]);
    let j = i + 1;
    if (from >= 0 && j >= to) j = from;
    if (j >= n) j = -1;
    const k = MF.smooth ? ease((f - (1 - MF.blend)) / MF.blend) : 0;
    return j >= 0 ? { i, j, k, out: 0 } : { i, j, k: 0, out: MF.smooth && from < 0 ? k : 0 };
  };
  // draw the picture t seconds into an animation, melted into the next frame (MF.draw's o)
  MF.drawT = function (ctx, name, t, x, y, o, holding) {
    const P = MF.pick(name, t, holding);
    if (!P) return false;
    o = o || {};
    const a = o.a === undefined ? 1 : o.a;
    if (P.k > 0.002) {
      MF.draw(ctx, name, P.i, x, y, Object.assign({}, o, { a: a * (1 - P.k) }));
      MF.draw(ctx, name, P.j, x, y, Object.assign({}, o, { a: a * P.k }));
    } else MF.draw(ctx, name, P.i, x, y, P.out ? Object.assign({}, o, { a: a * (1 - P.out) }) : o);
    return true;
  };
  // frame i with its origin at (x, y). o: k (x the animation's k), rot, flipY (mirrored across its own line: an effect
  // turned to point left stays the right way up), flip (mirrored left-right), sx / sy (stretched along / across), a
  MF.draw = function (ctx, name, i, x, y, o) {
    o = o || {};
    const A = MAN[name], f = A && A.frames[i], im = f && IMG[name][i];
    if (!ok(im)) return;
    const k = (o.k || 1) * A.k, a = o.a === undefined ? 1 : Math.max(0, Math.min(1, o.a));
    if (a <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale((o.flip ? -1 : 1) * (o.sx || 1), (o.flipY ? -1 : 1) * (o.sy || 1));
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha *= a;
    ctx.drawImage(im, -f.ox * k, -f.oy * k, f.w * k, f.h * k);
    if (MF.glow > 0 && !A.solid) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= MF.glow; ctx.drawImage(im, -f.ox * k, -f.oy * k, f.w * k, f.h * k); }
    ctx.restore();
  };
  // bursts that keep opening while their frames change (scale from -> to over the animation)
  const GROW = { gale_hit: [0.94, 1.07], double_hit: [0.92, 1.08], star_hit: [0.93, 1.08], charge_hit: [0.94, 1.07], multi_hit: [0.92, 1.08],
    shower_up: [0.97, 1.04], focus_cast: [0.98, 1.03] };
  // play an animation as an effect at (x, y). o: at() -> [x, y] (follows a hand, a monster), dir() -> the angle it points
  // (turned with it, kept the right way up), flip, k, a, layer ('glow' after the night lighting; 'sorted' among the
  // characters, dz in front of its y; 'low' on the ground), life (seconds: a loop / a hold animation runs that long),
  // fadeIn / fade (seconds), until() -> false ends it early (with its fade)
  MF.play = function (name, x, y, o) {
    o = o || {};
    const A = MAN[name];
    if (!A) return null;
    const life = o.life || A.total, fade = o.fade || 0;
    if (o.at) [x, y] = o.at();
    const sorted = o.layer === 'sorted';
    return FX.add({
      type: 'custom', layer: o.layer || 'glow', life, x, y, sort: sorted ? y + (o.dz || 0) : undefined,
      update(q) {
        if (o.at) { const w = o.at(); q.x = w[0]; q.y = w[1]; if (sorted) q.sort = q.y + (o.dz || 0); }
        if (o.until && !o.until() && q.t < life - fade) q.t = life - fade;
      },
      draw(ctx, q) {
        const ang = o.dir ? o.dir() : 0, left = Math.cos(ang) < 0;
        const fin = o.fadeIn ? Math.min(1, q.t / o.fadeIn) : 1, fout = fade ? Math.min(1, (life - q.t) / fade) : 1;
        const g = MF.smooth && GROW[name] ? GROW[name][0] + (GROW[name][1] - GROW[name][0]) * Math.min(1, q.t / life) : 1; // (bursts keep opening between frames)
        MF.drawT(ctx, name, q.t, q.x, q.y, { k: (o.k || 1) * g, rot: o.dir ? ang : 0, flipY: !!(o.dir && left), flip: o.flip, a: (o.a === undefined ? 1 : o.a) * fin * fout }, !!o.life);
      },
    });
  };

  // an arrow the Maple way: the cast at the bow (cast), the painted arrow flying with its tip on the flight point (ball:
  // its trail grows out of the bow, it fades at the end), hit(e, q) on each monster. o: ang, v, range, r, pierce, light
  function arrow(game, p, id, o) {
    const [hx, hy] = K.hand(p), a = o.ang === undefined ? p.aim : o.ang;
    if (o.cast) MF.play(o.cast, hx, hy, { at: () => K.hand(p), dir: () => a, k: o.castK });
    const q = K.shot(game, p, id, {
      from: [hx, hy], ang: a, v: o.v, range: o.range, r: o.r || 34, pierce: o.pierce,
      look(ctx, s) {
        const ang = Math.atan2(s.vy, s.vx), end = s.life - s.t;
        MF.drawT(ctx, o.ball, s.t, s.x, s.y, {
          k: o.ballK, rot: ang, flipY: Math.cos(ang) < 0, sx: Math.min(1, 0.25 + s.t / (o.grow || 0.12)), a: Math.min(1, s.t / 0.03 + 0.4, end / 0.1),
        });
      },
      hit: o.hit,
    });
    if (o.light) V.light(hx, hy, o.lightR || 200, o.light, 0.7, q.life, { follow: q });
    return q;
  }
  const bowPose = (game, p, i, lock) => K.pose(game, p, K.clip(p, 'arrow', i === undefined ? 1 : i), lock || 0.3);
  const sizeOf = (e) => Math.max(0.85, Math.min(1.6, 0.75 + (e.r || 30) / 120)); // (a bigger monster, a bigger hit)

  // each skill's pictures; without them (still loading, ?maple=0) the skill plays its old look
  const NEEDS = {
    double: ['double_cast', 'double_ball', 'double_hit'],
    shower: ['shower_up', 'shower_ring', 'shower_arrow', 'shower_hit'],
    gale: ['gale_cast', 'gale_ball', 'gale_hit'],
    starshot: ['star_charge', 'star_beam', 'star_hit'],
    ar_charge: ['charge_cast', 'charge_ball', 'charge_hit'],
    ar_multishot: ['multi_cast', 'multi_ball', 'multi_hit'],
    ar_snare: ['snare_seed', 'snare_trap', 'snare_burst', 'snare_bind'],
    ar_concentrate: ['focus_cast'],
  };
  const OLD = {};
  for (const id in NEEDS) OLD[id] = RUN[id];
  MF.live = (id) => MF.on && MF.ready(...NEEDS[id]);
  const live = (id, self, args) => { if (MF.live(id)) return true; if (OLD[id]) OLD[id].apply(self, args); return false; };

  // ---------------- ยิงคู่ (Q): two quick arrows of starlight ----------------
  RUN.double = function (game, p, lv) {
    if (!live('double', this, arguments)) return;
    K.pose(game, p, 'bow2', 0.3);
    for (const [t, off] of [[0.1, -0.03], [0.24, 0.03]]) V.at(t, () => {
      const a = p.aim + off;
      arrow(game, p, 'double', {
        cast: 'double_cast', ball: 'double_ball', ang: a, v: 1500, range: 950, light: GOLD,
        hit(e, q) {
          K.strike(game, p, 'double', e, Math.cos(p.aim) * 160, Math.sin(p.aim) * 120, { color: '255,235,180' });
          MF.play('double_hit', q.x, q.y, { flip: Math.cos(a) < 0 });
        },
      });
    });
  };

  // ---------------- ห่าฝนธนู (E): arrows up, then twenty falling into a ring of wind ahead ----------------
  RUN.shower = function (game, p, lv) {
    if (!live('shower', this, arguments)) return;
    K.pose(game, p, 'bow3', 0.6);
    const [tx, ty] = K.ground(game, p, 420);
    MF.play('shower_ring', tx, ty, { layer: 'low', life: 1.55, fadeIn: 0.15, fade: 0.35 });
    V.light(tx, ty - 20, 260, WIND, 0.6, 1.4);
    V.at(0.2, () => MF.play('shower_up', 0, 0, { at: () => K.hand(p) }));
    const mul = SK.shower.mul(lv) * 0.6; // (20 arrows: each a little weaker than the old 12)
    for (let i = 0; i < 20; i++) V.at(0.4 + i * 0.032, () => {
      const a = rand(0, TAU), d = Math.sqrt(Math.random()) * 150, x = tx + Math.cos(a) * d, y = ty + Math.sin(a) * d * 0.62;
      const sx = x + 70, sy = y - 760, dur = 0.16, ang = Math.atan2(y - sy, x - sx);
      K.proj({
        x: sx, y: sy, vx: (x - sx) / dur, vy: (y - sy) / dur, life: dur,
        draw(ctx, q) { MF.drawT(ctx, 'shower_arrow', q.t, q.x, q.y, { rot: ang, a: Math.min(1, q.t / 0.04 + 0.3) }); },
        onEnd() {
          MF.play('shower_hit', x, y);
          for (const e of K.around(game, x, y, 55)) K.strike(game, p, 'shower', e, 0, 0, { color: '200,255,190' }, { mul });
        },
      });
    });
  };

  // ---------------- ธนูพายุทะลวง (R): the wind gathers, a giant wind arrow pierces the whole line ----------------
  RUN.gale = function (game, p, lv) {
    if (!live('gale', this, arguments)) return;
    K.pose(game, p, 'bow3', 0.55);
    // the cast: frames 1-3 the wind gathering at the bow (0.3 s), frame 4 the release as the arrow leaves
    MF.play('gale_cast', 0, 0, { at: () => K.hand(p), dir: () => p.aim });
    V.at(0.3, () => {
      const a = p.aim;
      V.shake(game, 6);
      arrow(game, p, 'gale', {
        ball: 'gale_ball', ang: a, v: 1300, range: 1100, pierce: true, grow: 0.14, light: WIND, lightR: 220,
        hit(e) {
          K.strike(game, p, 'gale', e, Math.cos(a) * 620, Math.sin(a) * 420, { big: true, color: '170,255,160' });
          MF.play('gale_hit', e.x, e.y - 50, { at: () => [e.x, e.y - 50], k: sizeOf(e), flip: Math.cos(a) < 0 });
          V.light(e.x, e.y - 50, 200, WIND, 0.7, 0.35);
        },
      });
    });
  };

  // ---------------- ธนูดาราพิฆาต (F): starlight gathers at the bow, then a beam across the screen ----------------
  // the beam is a MESH band (MX.band) textured with its painted frames: it grows out of the bow, thins, and dissolves
  // into noise from the bow toward its tip as it ends; the painted frames themselves when there is no WebGL2
  function drawBeam(ctx, q, u) {
    const B = MAN.star_beam, len = q.len, kb = len / B.len, c = Math.cos(q.ang), s = Math.sin(q.ang);
    const P = MF.pick('star_beam', q.t) || { i: 0, j: -1, k: 0 };
    const thin = u < 0.1 ? 1 : 1 - Math.pow((u - 0.1) / 0.9, 1.4), grow = Math.min(1, u / 0.08);
    const MX = NC.MeshFX;
    if (MX && MX.ok && MX.ok()) {
      // the band covers the frame's picture: from its left edge (behind the bow) along the beam, its middle line through
      // the picture's middle, as thick as the picture (thinning as it ends); while it grows only the picture's first part
      // shows (not squeezed). (px, py): the picture's "down" in the world (mirrored when shot to the left). Smooth: the
      // frame now and the next, each its own band, crossfaded
      const band = (i, alpha) => {
        const f = B.frames[i], px = -s, py = c, off = (f.h / 2 - f.oy) * kb, L = f.w * kb, hw = (f.h * kb * (0.55 + 0.45 * thin)) / 2;
        const x0 = q.x - c * f.ox * kb + px * off, y0 = q.y - s * f.ox * kb + py * off, x1 = x0 + c * L * grow, y1 = y0 + s * L * grow;
        MX.ribbon(ctx, [
          { a: [x0 + px * hw, y0 + py * hw], b: [x0 - px * hw, y0 - py * hw], u: 0 },
          { a: [x1 + px * hw, y1 + py * hw], b: [x1 - px * hw, y1 - py * hw], u: grow },
        ], { img: MF.img('star_beam', i), lift: 0, pan: 0, rep: 1, tailK: 0.01, seed: q.seed, erode: u < 0.45 ? 0 : (u - 0.45) / 0.55, alpha, edgeK: 0.55, edgeTex: 1 });
      };
      if (P.k > 0.002 && P.j >= 0) { band(P.i, 1.15 * (1 - P.k)); band(P.j, 1.15 * P.k); } else band(P.i, 1.15);
    } else {
      MF.drawT(ctx, 'star_beam', q.t, q.x, q.y, { k: kb / B.k, rot: q.ang, flipY: c < 0, sx: grow, sy: 0.45 + 0.55 * thin, a: Math.min(1, thin * 1.4) });
    }
  }
  RUN.starshot = function (game, p, lv) {
    if (!live('starshot', this, arguments)) return;
    K.pose(game, p, 'bow3', 1.0);
    const charge = 0.7;
    const at = () => { const [hx, hy] = K.hand(p); return [hx + Math.cos(p.aim) * 30, hy + Math.sin(p.aim) * 30]; };
    MF.play('star_charge', 0, 0, { at });
    p.channel = {
      t: 0, dur: charge,
      update(game, p, ch) {
        p.vx *= 0.8; p.vy *= 0.8;
        const [hx, hy] = K.hand(p);
        if (!ch.light) ch.light = V.light(hx, hy, 300, GOLD, 1, charge + 0.2);
        ch.light.x = hx; ch.light.y = hy;
      },
      end(game, p) {
        const [hx, hy] = K.hand(p), a = p.aim, c = Math.cos(a), s = Math.sin(a), len = 1300, W = 110;
        FX.add({ type: 'custom', layer: 'glow', life: 0.6, x: hx, y: hy, ang: a, len, seed: Math.floor(Math.random() * 10), draw: drawBeam }); // (a whole seed: it only changes the dissolve's noise, never shifts the picture)
        MF.play('star_hit', hx, hy, { k: 1.2 });
        V.shake(game, 14);
        for (let k = 1; k <= 5; k++) V.light(hx + c * len * (k / 5), hy + s * len * (k / 5), 320, GOLD, 1, 0.6);
        for (const e of game.enemies) {
          if (!alive(e)) continue;
          const dx = e.x - hx, dy = e.y - 50 - hy, along = dx * c + dy * s, side = Math.abs(-dx * s + dy * c);
          if (along > -20 && along < len && side < W / 2 + e.r + 20) {
            K.strike(game, p, 'starshot', e, c * 520, s * 380, { big: true, color: '255,240,190' });
            MF.play('star_hit', e.x, e.y - 50, { at: () => [e.x, e.y - 50], k: sizeOf(e) });
          }
        }
      },
    };
  };

  // ---------------- ธนูกระแทก: a heavy blazing arrow; the hit throws crescents forward and stuns ----------------
  // its streak: a MESH band of the ember strip from the bow to the arrow, left behind to burn out
  function streak(q, a) {
    const MX = NC.MeshFX, x0 = q.x, y0 = q.y, seed = Math.random() * 10;
    if (!MX || !MX.ok || !MX.ok()) return;
    let end = null;
    FX.add({
      type: 'custom', layer: 'glow', life: 2, x: x0, y: y0,
      update(f) { if (!end && (q.dead || q.t >= q.life - 0.02)) { end = f.t; f.life = f.t + 0.35; } },
      draw(ctx, f) {
        const hx = end === null ? q.x : f.hx || q.x, hy = end === null ? q.y : f.hy || q.y;
        if (end === null) { f.hx = q.x; f.hy = q.y; }
        const L = Math.hypot(hx - x0, hy - y0), tl = Math.max(0, L - 460);
        const tx = x0 + Math.cos(a) * tl, ty = y0 + Math.sin(a) * tl;
        const er = end === null ? 0 : (f.t - end) / 0.35;
        MX.band(ctx, tx, ty, hx - Math.cos(a) * 30, hy - Math.sin(a) * 30, 34, { strip: 'strip_ember', tint: [1.05, 0.85, 0.6], pan: 2.4, rep: 1.5, seed, tailK: 0.6, erode: er, alpha: 0.85 });
      },
    });
  }
  RUN.ar_charge = function (game, p, lv) {
    if (!live('ar_charge', this, arguments)) return;
    bowPose(game, p, 2, 0.45);
    // frames 1-2: the power squeezing into the bow (0.22 s), frame 3: the shockwave as the arrow leaves
    MF.play('charge_cast', 0, 0, { at: () => K.hand(p), dir: () => p.aim });
    V.at(0.22, () => {
      const a = p.aim;
      V.shake(game, 5);
      const q = arrow(game, p, 'ar_charge', {
        ball: 'charge_ball', ang: a, v: 1350, range: 950, light: EMBER,
        hit(e, s) {
          K.hit(game, p, 'ar_charge', e, Math.cos(a) * 760, Math.sin(a) * 520, '255,190,120', 1, { big: true });
          K.stun(game, e, 1);
          MF.play('charge_hit', s.x, s.y, { dir: () => a, k: sizeOf(e) });
          V.shake(game, 7);
        },
      });
      streak(q, a);
    });
  };

  // ---------------- ยิงกระจาย: five arrows in a fan ----------------
  RUN.ar_multishot = function (game, p, lv) {
    if (!live('ar_multishot', this, arguments)) return;
    bowPose(game, p, 1, 0.35);
    // frames 1-2 the flash (0.12 s), frame 3 the fan of five as they leave
    MF.play('multi_cast', 0, 0, { at: () => K.hand(p), dir: () => p.aim });
    V.at(0.12, () => {
      for (let i = 0; i < 5; i++) {
        const a0 = p.aim + (i - 2) * 0.17;
        arrow(game, p, 'ar_multishot', {
          ball: 'multi_ball', ang: a0, v: 1300, range: 850, light: i === 2 ? SKY : null,
          hit(e, q) {
            K.hit(game, p, 'ar_multishot', e, Math.cos(a0) * 140, Math.sin(a0) * 140 * 0.7, '200,235,255');
            MF.play('multi_hit', q.x, q.y, { flip: Math.cos(a0) < 0 });
          },
        });
      }
    });
  };

  // ---------------- กับดักเถาวัลย์: a seed thrown, a ring of thorny vines set on the ground, vines binding the caught ----------------
  // the trap keeps skills_t1.js's rules (NC.Traps: at most 3 + mods, 25 s, a monster within 70 sets it off); only its
  // pieces are pictures
  function placeSnare(game, p, x, y) {
    const T = NC.Traps;
    const max = 3 + Math.floor(((p.d && p.d.mods && p.d.mods.traps) || 0));
    while (T.list.length >= max) { const old = T.list.shift(); old.fx.dead = true; }
    const t = { id: 'ar_snare', x, y, r: 70, kind: 'snare' };
    const light = V.light(x, y - 10, 110, WIND, 0.45, 25);
    t.boom = (game, t) => {
      light.t = light.life;
      MF.play('snare_burst', t.x, t.y, { layer: 'sorted', dz: 2 });
      const hold = SK.ar_snare.hold(NC.skillLv(p, 'ar_snare'));
      for (const e of K.around(game, t.x, t.y, 110)) {
        K.hit(game, p, 'ar_snare', e, 0, 0, '160,240,140', (p.d.trapK || 1));
        K.stun(game, e, hold);
        MF.play('snare_bind', e.x, e.y, { layer: 'sorted', dz: 3, life: hold, fade: 0.3, at: () => [e.x, e.y], until: () => alive(e), k: sizeOf(e) });
      }
    };
    t.fx = FX.add({
      type: 'custom', layer: 'low', x, y, life: 25,
      update(q) {
        if (q.t < 0.5) return;
        for (const e of game.enemies) if (alive(e) && NC.dist(e.x, e.y, x, y) < t.r + e.r) { T.fire(game, t); return; }
      },
      draw(ctx, q, u) { MF.drawT(ctx, 'snare_trap', q.t, x, y, { a: Math.min(1, q.t / 0.25) * (u > 0.9 ? (1 - u) / 0.1 : 1) }); },
      onEnd() { const i = T.list.indexOf(t); if (i >= 0) T.list.splice(i, 1); light.t = light.life; },
    });
    T.list.push(t);
    return t;
  }
  RUN.ar_snare = function (game, p, lv) {
    if (!live('ar_snare', this, arguments) || !NC.Traps) return;
    bowPose(game, p, 0, 0.25);
    const [tx, ty] = K.ground(game, p, 360), from = K.hand(p);
    K.proj({
      x: from[0], y: from[1], life: 0.3,
      update(q) { const k = q.t / 0.3; q.x = NC.lerp(from[0], tx, k); q.y = NC.lerp(from[1], ty - 10, k) - Math.sin(k * Math.PI) * 110; },
      draw(ctx, q) { MF.drawT(ctx, 'snare_seed', q.t, q.x, q.y); },
      onEnd() { placeSnare(game, p, tx, ty); },
    });
  };

  // ---------------- สมาธิเล็ง (the buff): calm light rising round the archer, a star over the head ----------------
  // (it had no RUN of its own: skilltree.js's castBuff gave it a pose, the buff and K.buffFx; the same here, the look a
  // picture)
  RUN.ar_concentrate = function (game, p, lv) {
    const S = SK.ar_concentrate;
    K.pose(game, p, 'cheer', 0.35);
    K.startBuff(game, p, 'ar_concentrate', lv);
    if (MF.live('ar_concentrate')) {
      MF.play('focus_cast', p.x, p.y, { at: () => [p.x, p.y] });
      V.light(p.x, p.y - 60, 260, TEAL, 0.8, 0.7, { follow: p });
    } else K.buffFx(game, p, S.rgb || V.RGB.holy, { style: S.circle || 'holy' });
  };
})();
