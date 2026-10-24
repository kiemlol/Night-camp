/* dunbossfx.js — the four OLD dungeon bosses' skill effects, PAINTED and ALIVE: the bat king, the ant queen, the crypt lord
   and the lava dragon (js/dunbosses.js). They fought with code-drawn warning circles, lanes, orbs, puddles and plain FX
   rings / puffs / embers. The user, 2026-10-15: "เอฟเฟกต์บอสดันเจี้ยนเก่า", then picked "ภาพวาด + shader" (+ Blender for the
   pieces that move a lot, then: "ไม่ค่อยชอบที่เบลนเดอร์วาดรูป" -> painted pieces only) and a big moment when each one gets angry (the rule since 2026-10-07: no effect pieces drawn by
   code, only Codex pictures, Blender renders or live shaders).
   Every piece is a Codex picture, nine a boss (assets/gen/make_dunfx_prompts.py -> tools/dunfx_cut.py ->
   assets/dunfx/dfx_<boss>_<piece>.png), drawn by js/paintgl.js's shader so the paint moves: flames lick, smoke churns and
   dissolves, energy runs round the danger rings and down the lanes, waves burn away from a bright edge, heat bends the
   air. This file places, stretches, turns and times them. The fight itself stays dunbosses.js's: as js/rootbossfx.js does
   for the root-possessed bosses,
     - its four helpers' effects (dun: 'warn' | 'lane' | 'orb' | 'puddle') get the boss's own painted drawers
     - while one of the four updates (and inside its orbs), the plain FX it asks for become its painted ones: puff -> its
       smoke / dust / fumes / mist, ring -> its wave, ember -> its spark (in the dragon's breath: the flame)
     - a little more of each: the bat king's screech lets out shadow bats and its swoop leaves wing slashes, the ant
       queen's slam throws up rocks, the crypt lord's ghost fire falls from above and bony hands bring up his skeletons,
       the lava dragon's meteors fall onto their circles and lava splashes up where they land
     - the RAGE moment (the boss under half its HP, dunbosses.js's e.raged): the bat king's cave goes dark but its red
       eyes and a swarm of shadow bats; the ant queen's floor bursts in rings of rocks and acid; the crypt lord turns the
       screen cold and ghost fire falls all round; the lava dragon's heat bends the air and meteors fall over the screen.
       Only looks: no extra damage (the fight is the one the game server knows).
   No WebGL2: the same pictures drawn plain (canvas). Pieces not loaded yet leave the old look. Load after js/rootbossfx.js
   (and js/paintgl.js). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX;
  if (!FX || !NC.DUNGEON_BOSSES) return;
  if (NC.ASSET_MANIFEST_DUNFX && NC.ASSET_MANIFEST) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_DUNFX);
  const TAU = Math.PI * 2, PG = NC.PaintGL;
  const SET = { bat_king: 'bat', ant_queen: 'ant', crypt_lord: 'crypt', lava_dragon: 'lava' };
  const EDGE = { bat: [0.8, 0.62, 1], ant: [0.75, 1, 0.4], crypt: [0.6, 0.92, 1], lava: [1, 0.72, 0.3] };
  const S = (n) => { const s = NC.SPR[n]; return s && s.img ? s : null; };
  // (the lava dragon is js/lavadragonfx.js's, the other three js/dunshieldfx.js's, once their blood-shield sheets are in)
  const kit = (e) => { const k = e && SET[e.type]; if (k === 'lava' && NC.LavaFX && NC.LavaFX.live()) return null; if (k && NC.ShieldFX && NC.ShieldFX.live(k)) return null; return k && S(`dfx_${k}_rim`) ? k : null; };
  const P = (k, n) => `dfx_${k}_${n}`;
  const ease = (u) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);
  const aspect = (n, d) => { const s = S(n); return s ? s.img.height / s.img.width : d; };
  const live = () => !!(PG && PG.ok());
  // one painted piece on a layer ('low' / 'glow': queued for the shader; 'sorted': drawn now), centred on (x, y) (o.ay 1:
  // standing on y), w x h world units. o: a, rot, add, ay, flip, squash + the shader's warp / flow / erode / clip / tint
  function paint(ctx, layer, n, x, y, w, h, o) {
    o = o || {};
    const a = o.a === undefined ? 1 : o.a;
    if (!S(n) || a <= 0.005 || w <= 0 || h <= 0) return;
    if (live()) {
      if (layer === 'sorted') PG.now(ctx, n, x, y, w, h, o.rot || 0, o);
      else PG.quad(layer, n, x, y, w, h, o.rot || 0, o);
      return;
    }
    // (no shader: the plain picture; a clip shows its part)
    const s = S(n), cl = o.clip;
    ctx.save();
    ctx.globalAlpha = Math.min(1, a);
    if (o.add) ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y);
    if (o.squash) ctx.scale(1, o.squash);
    if (o.rot) ctx.rotate(o.rot);
    if (o.flip) ctx.scale(-1, 1);
    const ax = o.ax === undefined ? 0.5 : o.ax, ay = o.ay === undefined ? 0.5 : o.ay;
    if (cl) {
      const iw = s.img.width, ih = s.img.height;
      ctx.drawImage(s.img, cl[0] * iw, cl[1] * ih, (cl[2] - cl[0]) * iw, (cl[3] - cl[1]) * ih, -ax * w + cl[0] * w, -ay * h + cl[1] * h, (cl[2] - cl[0]) * w, (cl[3] - cl[1]) * h);
    } else ctx.drawImage(s.img, -ax * w, -ay * h, w, h);
    ctx.restore();
  }

  // ---------------- dunbosses.js's four helpers, painted ----------------
  const PAINT = {
    warn(ctx, p, u) { // the danger zone: a faint whole area, its light filling from the middle, the boss's rim; energy runs round
      const k = ease(u), beat = 0.85 + 0.15 * Math.sin(p.t * 18), W = p.r * 2.08, H = W * 0.58, sd = p._sd;
      paint(ctx, 'low', P(p._k, 'fill'), p.x, p.y, W, H, { a: 0.18 * beat, flow: [0.5, 3, 0.15, 0.1], seed: sd });
      paint(ctx, 'low', P(p._k, 'fill'), p.x, p.y, W * k, H * k, { a: 0.55 * beat, flow: [0.7, 3, 0.2, 0.15], warp: [0.01, 5, 0.1, 0.1], seed: sd });
      paint(ctx, 'low', P(p._k, 'rim'), p.x, p.y, W, H, { a: 0.95, flow: [0.9, 4, 0.5, 0], warp: [0.006, 7, 0.2, 0.1], seed: sd });
    },
    lane(ctx, p, u) { // the danger lane (claw scratches / scorched ground), filling from the boss outwards, energy running out
      const beat = 0.85 + 0.15 * Math.sin(p.t * 18), w = p.w * 1.15, k = Math.max(0.04, ease(u));
      const o = { ax: 0, squash: 0.62, rot: p.ang, seed: p._sd, flow: [0.8, 4, 0.7, 0], warp: [0.006, 6, 0.4, 0] };
      paint(ctx, 'low', P(p._k, 'lane'), p.x, p.y, p.len, w, Object.assign({}, o, { a: 0.3 * beat }));
      paint(ctx, 'low', P(p._k, 'lane'), p.x, p.y, p.len, w, Object.assign({}, o, { a: 0.95 * beat, clip: [0, 0, k, 1] }));
    },
    orb(ctx, c) { // the ant queen's acid glob points the way it flies, wobbling; the crypt lord's ghost keeps its face up, burning
      const a = Math.atan2(c.vy, c.vx);
      if (c._k === 'ant') {
        const n = P('ant', 'glob'), w = c.R * 2.6;
        paint(ctx, 'glow', n, c.x, c.y, w, w * aspect(n, 0.6), { rot: a, warp: [0.025, 5, 0.9, 0.3], seed: c._sd });
        return;
      }
      const n = P(c._k, 'orb'), w = c.R * 3.2, h = w * aspect(n, 0.7), left = c.vx < 0;
      const x = c.x - Math.cos(a) * w * 0.16, y = c.y - Math.sin(a) * w * 0.16; // (the ball is the front of the picture)
      const o = { rot: left ? a - Math.PI : a, flip: left, seed: c._sd, warp: [0.035, 4, 1.2, 0.2], flow: [0.6, 4, 1, 0] };
      paint(ctx, 'glow', n, x, y, w, h, Object.assign({ a: 0.4, add: true }, o));
      paint(ctx, 'glow', n, x, y, w, h, o);
    },
    puddle(ctx, c) { // a pool of acid, oozing; it burns away at the end
      const a = Math.min(1, c.t / 0.25), end = Math.max(0, 1 - (c.life - c.t) / 0.6);
      paint(ctx, 'low', P(c._k, 'pool'), c.x, c.y, c.R * 2.2, c.R * 2.2 * 0.58,
        { a: 0.95 * a, warp: [0.012, 5, 0.1, 0.06], flow: [0.5, 4, 0.1, 0.05], erode: end > 0 ? [end, 0.1, 5, 1] : null, edge: EDGE[c._k], seed: c._sd });
    },
  };

  // ---------------- the plain FX a boss asks for, painted ----------------
  const DUST = /^(160,140,130|215,218,230|160,140,190)$/;
  const greenish = (rgb) => { const c = String(rgb || '').split(',').map(Number); return c[1] > c[0] && c[1] > c[2]; };
  FX.def('dfx_smoke', (ctx, p, u) => { // a puff that churns as it swells, then dissolves (no glowing edge on smoke)
    const r = NC.lerp(p.r0, p.r1, ease(u)) * 2.3;
    paint(ctx, p.layer || 'low', p.pic, p.x, p.y, r, r * aspect(p.pic, 1), { a: p.dust ? 0.8 : 0.9, rot: p.rot0, seed: p.sd,
      warp: [0.05, 3, 0, -0.35], erode: [Math.pow(u, 1.25), 0.12, 3.5, 0] });
  }, 'low');
  FX.def('dfx_wave', (ctx, p, u) => { // a ring of the boss's own wave, burning away from a bright edge as it spreads
    // (the wide ones - waking up r 440, the rage r 540 - would cover the screen with the painted band: thinner, fainter)
    const big = p.r1 > 300, r = NC.lerp(p.r0, p.r1, ease(u)) * (big ? 1.5 : 1.9);
    paint(ctx, 'glow', p.pic, p.x, p.y, r, r * 0.56, { a: big ? 0.55 : 0.95, seed: p.sd, warp: [0.02, 5, 0.3, 0],
      erode: [Math.max(0, (u - 0.15) / 0.85), 0.12, 4, 1.4], edge: EDGE[p._k] });
  }, 'glow');
  FX.def('dfx_spark', (ctx, p, u) => {
    const s = (p.sz || 26) * (1 - u * 0.5);
    paint(ctx, 'glow', p.pic, p.x, p.y, s, s * aspect(p.pic, 1), { a: (1 - u) * (0.75 + 0.25 * Math.sin(p.t * 40)), rot: p.t * 3, add: true });
  }, 'glow');
  FX.def('dfx_flame', (ctx, p, u) => { // a tongue of the dragon's breath: streaming, licking, burning out from its thin parts
    const n = P('lava', 'flame'), w = 150 * (0.5 + 0.9 * u);
    const o = { rot: p.ang, seed: p.sd, warp: [0.05, 3, 0.9, 0], erode: [Math.max(0, (u - 0.35) / 0.65), 0.1, 3, 1.5], edge: EDGE.lava };
    paint(ctx, 'glow', n, p.x, p.y, w, w * aspect(n, 0.5), Object.assign({ a: 0.88 * Math.min(1, u * 6) }, o));
  }, 'glow');
  // a piece bursting up out of the ground and sinking back (rocks, bony hands, lava), standing among the characters
  FX.def('dfx_stand', (ctx, p, u) => {
    if (p.t < 0) return;
    const up = ease(p.t / 0.12), down = u > 0.65 ? (u - 0.65) / 0.35 : 0;
    const h = p.H * p.k * up, w = h / aspect(p.pic, 1);
    paint(ctx, 'sorted', p.pic, p.x, p.y, w, h, { ay: 1, flip: p.flip, seed: p.sd, warp: p.hot ? [0.02, 4, 0, -0.8] : null,
      erode: down > 0 ? [down, 0.1, 4, p.hot ? 1.3 : 0.5] : null, edge: EDGE[p._k] });
  }, 'sorted');
  // the crypt lord's ghost fire falling from above: the column reaches down to the ground, flickers, then burns out
  FX.def('dfx_fall', (ctx, p) => {
    if (p.t < 0) return;
    const n = P('crypt', 'fall'), w = 130 * (p.k || 1), h = w * aspect(n, 2.5), land = p.lead, after = Math.max(0, (p.t - land) / (p.life - land));
    const o = { ay: 1, seed: p.sd, warp: [0.045, 3, 0, -1.4], flow: [0.6, 4, 0, -1] };
    if (p.t < land) o.clip = [0, 0, 1, Math.max(0.02, ease(p.t / land))];
    else o.erode = [after, 0.1, 3.5, 1.4], o.edge = EDGE.crypt;
    paint(ctx, 'glow', n, p.x, p.y, w * (1 + 0.15 * after), h, o);
    paint(ctx, 'glow', n, p.x, p.y, w * (1 + 0.15 * after), h, Object.assign({}, o, { a: 0.35, add: true }));
  }, 'glow');
  // the lava dragon's meteor dropping straight down onto its circle, its fire tail streaming up
  FX.def('dfx_meteor', (ctx, p) => {
    if (p.t < 0) return;
    const n = P('lava', 'meteor'), w = 110 * (p.k || 1), h = w * aspect(n, 2.2), u = Math.min(1, p.t / p.life);
    paint(ctx, 'glow', n, p.x, p.y - (1 - u * u) * 560, w, h, { a: Math.min(1, p.t / 0.08), ay: 1, seed: p.sd, warp: [0.04, 3, 0, -1.6] });
  }, 'glow');
  // the bat king's shadow bats flying out (one picture: the flap is a squash, the wispy tail moves in the shader)
  FX.def('dfx_bat', (ctx, p, u) => {
    if (p.t < 0) return;
    const n = P('bat', 'bat'), w = 74 * (p.k || 1) * (0.7 + 0.5 * u), flap = 0.8 + 0.25 * Math.sin(p.t * 34 + p.ph);
    paint(ctx, 'glow', n, p.x, p.y, w, w * aspect(n, 0.6) * flap, { a: 1 - u * u, flip: p.vx < 0, seed: p.ph, warp: [0.02, 4, 0.6, 0] });
  }, 'glow');
  // the bat king's wing slashes along its swoop, burning off from a bright edge
  FX.def('dfx_wing', (ctx, p, u) => {
    const n = P('bat', 'wing'), w = 120 * (1 + 0.3 * u);
    paint(ctx, 'glow', n, p.x, p.y, w, w * aspect(n, 1.1), { rot: p.ang, add: true, a: 0.85, seed: p.sd, erode: [u, 0.12, 4, 1.4], edge: EDGE.bat });
  }, 'glow');

  function convert(p, k, e) {
    p.sd = Math.random() * 50;
    if (p.type === 'puff') {
      const dust = DUST.test(p.color || '');
      const n = k === 'bat' ? (dust ? 'dust' : 'smoke') : k === 'ant' ? (greenish(p.color) ? 'fumes' : 'dust')
        : k === 'crypt' ? (dust ? 'dust' : 'mist') : 'smoke';
      p.type = 'dfx_smoke'; p.pic = P(k, n); p.dust = dust; p.rot0 = Math.random() * TAU; p.layer = p.layer || 'low';
    } else if (p.type === 'ring') { p.type = 'dfx_wave'; p.pic = P(k, 'wave'); p._k = k; p.layer = 'glow'; }
    else if (p.type === 'ember') {
      if (k === 'lava' && e.state === 'breath' && (e._fl = (e._fl || 0) + 1) % 4 === 0) { p.type = 'dfx_flame'; p.ang = e.ang; p.life *= 1.3; } // (every fourth: big tongues that join up)
      else { p.type = 'dfx_spark'; p.pic = P(k, k === 'ant' ? 'splash' : 'spark'); p.sz = k === 'ant' ? 34 : 26; }
      p.layer = 'glow';
    }
  }

  let cur = null; // (the dungeon boss whose update or orb is running now)
  const baseAdd = FX.add;
  FX.add = function (p) {
    if (p) {
      const k = kit(p.dun ? p.owner : cur);
      if (k && p.dun) {
        if (PAINT[p.dun]) { p._k = k; p._sd = Math.random() * 50; p.draw = PAINT[p.dun]; }
        if (p.dun === 'orb') { // (its hit puff and the pool it leaves are the boss's too)
          const up = p.update, end = p.onEnd, e = p.owner;
          p.update = function () { const o = cur; cur = e; try { return up && up.apply(this, arguments); } finally { cur = o; } };
          if (end) p.onEnd = function () { const o = cur; cur = e; try { return end.apply(this, arguments); } finally { cur = o; } };
        }
      } else if (k) convert(p, k, cur);
    }
    const out = baseAdd.call(this, p);
    if (p && p.t0) p.t = -p.t0; // (a piece that waits its turn)
    return out;
  };
  const stand = (k, n, x, y, H, sc, delay) => FX.add({ type: 'dfx_stand', _k: k, pic: P(k, n), x, y, H, k: sc, life: 0.9, t0: delay || 0,
    flip: Math.random() < 0.5, sd: Math.random() * 50, hot: n === 'splash' || n === 'hands' });
  const meteor = (x, y, wait, k) => { const lead = Math.min(wait, 0.42); return FX.add({ type: 'dfx_meteor', x, y, k: k || 1, life: lead, t0: wait - lead, sd: Math.random() * 50 }); };
  const fall = (x, y, wait, k) => { const lead = 0.2; return FX.add({ type: 'dfx_fall', x, y, k: k || 1, lead, life: lead + 0.45, t0: Math.max(0, wait - lead), sd: Math.random() * 50 }); };

  // ---------------- the rage moments ----------------
  const view = (g) => ({ x: g.cam.x, y: g.cam.y, w: g.vw, h: g.vh });
  // a tint over the whole screen (the night lighting is drawn by then: this sits on top, under the HUD)
  function tintScreen(ctx, rgb, a, mode) {
    if (a <= 0.003) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = mode || 'source-over';
    ctx.fillStyle = `rgba(${rgb},${a})`; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }
  // the bat king's red eyes on its own sprite (pose A, measured on assets/monsters/bat_king.png), for the dark
  const BAT_EYES = [[-32, -97], [-53, -97]];
  FX.def('dfx_rage', (ctx, p, u) => {
    const e = p.owner, k = p._k, t = p.t, L = p.life;
    const inn = Math.min(1, t / 0.35), out = Math.min(1, (L - t) / 0.6), env = Math.min(inn, out);
    if (k === 'bat') {
      tintScreen(ctx, '6,3,14', 0.78 * env);
      if (e && !e.dead) for (const [dx, dy] of BAT_EYES) {
        const x = e.x + (e.face > 0 ? -dx : dx), y = e.y - (e.z || 0) + dy;
        paint(ctx, 'glow', P('bat', 'spark'), x, y, 46, 46, { add: true, a: env * (0.8 + 0.2 * Math.sin(t * 30)), tint: [1, 0.25, 0.3], rot: t });
      }
    } else if (k === 'crypt') {
      tintScreen(ctx, '40,110,190', 0.32 * env, 'multiply');
      tintScreen(ctx, '90,170,255', 0.12 * env, 'lighter');
    } else if (k === 'lava') {
      tintScreen(ctx, '255,90,30', 0.12 * env, 'lighter');
      const v = p.v; // the heat: the air over the whole view bends
      if (v) paint(ctx, 'glow', P('lava', 'fill'), v.x + v.w / 2, v.y + v.h / 2, v.w * 1.5, v.h * 1.5, { haze: 7 * env, a: 1, seed: p.sd });
    }
  }, 'glow');
  function rage(game, e, k) {
    const v = view(game), p = game.player;
    FX.add({ type: 'dfx_rage', owner: e, _k: k, life: k === 'bat' ? 3.2 : 2.8, v, sd: Math.random() * 50 });
    game.shake = Math.max(game.shake, 22);
    if (NC.GLFX && NC.GLFX.zoom) NC.GLFX.zoom(e.x, e.y - 80, 0.06, 0.45);
    if (k === 'bat') { // a swarm of shadow bats over the screen, in three waves
      for (let w = 0; w < 3; w++) for (let i = 0; i < 14; i++) {
        const dir = (w % 2 ? -1 : 1), y = v.y + NC.rand(0.1, 0.9) * v.h, x = dir > 0 ? v.x - NC.rand(40, 300) : v.x + v.w + NC.rand(40, 300);
        FX.add({ type: 'dfx_bat', x, y, vx: dir * NC.rand(700, 1000), vy: NC.rand(-80, 80), life: NC.rand(1.4, 1.9), t0: 0.3 + w * 0.7 + Math.random() * 0.3, k: NC.rand(1.8, 3), ph: Math.random() * TAU });
      }
    } else if (k === 'ant') { // the floor bursts in rings of rocks and acid
      for (let ring = 0; ring < 4; ring++) {
        const n = 8 + ring * 4, r = 160 + ring * 150;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + Math.random() * 0.3, x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r * 0.58;
          if (!game.world.fits(x, y, 10)) continue; // (on the floor, not in the pits)
          stand('ant', i % 3 === 0 ? 'splash' : 'rocks', x, y + 4, 120, 0.7 + Math.random() * 0.4, 0.1 + ring * 0.18 + Math.random() * 0.08);
        }
        FX.add({ type: 'dfx_wave', _k: 'ant', pic: P('ant', 'wave'), x: e.x, y: e.y, r0: 40, r1: r + 120, life: 0.7, t0: ring * 0.18, sd: Math.random() * 50 });
      }
    } else if (k === 'crypt') { // ghost fire falling all round the hero, two waves
      for (let i = 0; i < 16; i++) {
        let x = 0, y = 0;
        for (let k = 0; k < 12; k++) { // (on the floor, not in the pits)
          x = p.x + NC.rand(-0.46, 0.46) * v.w; y = p.y + NC.rand(-0.4, 0.4) * v.h * 0.8;
          if (game.world.fits(x, y, 20)) break;
        }
        fall(x, y, 0.3 + (i % 8) * 0.12 + (i >= 8 ? 0.9 : 0) + Math.random() * 0.1, NC.rand(1.5, 2.1));
      }
    } else if (k === 'lava') { // meteors over the screen, a splash and a punch where each lands
      for (let i = 0; i < 12; i++) {
        let x = 0, y = 0;
        for (let k = 0; k < 12; k++) { x = v.x + NC.rand(0.05, 0.95) * v.w; y = v.y + NC.rand(0.25, 0.95) * v.h; if (game.world.fits(x, y, 20)) break; }
        const at = 0.5 + i * 0.16 + Math.random() * 0.1;
        meteor(x, y, at, NC.rand(0.8, 1.3));
        LANDS.push({ x, y, at: (NC.game ? NC.game.time : 0) + at });
      }
    }
  }
  const LANDS = []; // (the rage meteors' landings still to come: a splash and a little shake each)
  function lands(game) {
    const now = game.time;
    for (let i = LANDS.length - 1; i >= 0; i--) if (now >= LANDS[i].at) {
      const q = LANDS.splice(i, 1)[0];
      stand('lava', 'splash', q.x, q.y + 4, 130, 1, 0);
      FX.add({ type: 'dfx_wave', _k: 'lava', pic: P('lava', 'wave'), x: q.x, y: q.y, r0: 20, r1: 150, life: 0.45, sd: Math.random() * 50 });
      game.shake = Math.max(game.shake, 9);
    }
  }

  // ---------------- while one of the four updates ----------------
  function extras(game, e, k, s0, d0, r0, dt) {
    const z = e.z || 0;
    if (!r0 && e.raged && e.awake) rage(game, e, k);
    // the slam lands: rocks (the ant queen) or lava (the dragon) burst up round it
    if (s0 === 'slam' && !d0 && (e.state !== 'slam' || e.done)) {
      const n = k === 'ant' ? 'rocks' : 'splash', H = k === 'ant' ? 120 : 130;
      stand(k, n, e.x, e.y + 4, H, 1.1, 0);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + Math.random() * 0.4, r = 140 + Math.random() * 80;
        stand(k, n, e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.58, H, 0.6 + Math.random() * 0.35, 0.04 + Math.random() * 0.1);
      }
    }
    // a new rain: the crypt lord's ghost fire / the dragon's meteors set off now to land on their circles in time
    if (e.state === 'rain' && e.spots && e.spots !== e._dfxSpots) {
      e._dfxSpots = e.spots;
      for (const q of e.spots) {
        const wait = Math.max(0, q.at - e.t);
        if (k === 'crypt') fall(q.x, q.y + 6, wait);
        if (k === 'lava') meteor(q.x, q.y + 6, wait);
      }
    }
    // each rain spot as it lands: lava splashes up out of the dragon's craters
    if (k === 'lava' && (e.state === 'rain' || s0 === 'rain')) for (const q of e.spots || []) if (q.done && !q._dfx) {
      q._dfx = true;
      stand('lava', 'splash', q.x, q.y + 4, 130, 1, 0);
      for (let i = 0; i < 2; i++) stand('lava', 'splash', q.x + NC.rand(-60, 60), q.y + NC.rand(-30, 30), 130, 0.55 + Math.random() * 0.2, 0.05 + i * 0.06);
    }
    // the bat king's screech: shadow bats burst out of it
    if (k === 'bat' && s0 === 'screech' && !d0 && e.done) {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + NC.rand(-0.2, 0.2), sp = NC.rand(420, 620);
        FX.add({ type: 'dfx_bat', x: e.x, y: e.y - 60 - z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.62, drag: 1.2, life: NC.rand(0.6, 0.85), k: 1.5, ph: Math.random() * TAU });
      }
    }
    // the bat king's swoop: wing slashes along the way
    if (k === 'bat' && e.state === 'swoop' && e.t >= e.wind) {
      e._wing = (e._wing || 0) - dt;
      if (e._wing <= 0) { e._wing = 0.08; FX.add({ type: 'dfx_wing', x: e.x, y: e.y - z - 50, ang: Math.atan2(Math.sin(e.ang) * 0.62, Math.cos(e.ang)), life: 0.3, sd: Math.random() * 50 }); }
    }
    // the minions come up: out of the earth (ants), bony hands (skeletons), lava (fire bats)
    if (s0 === 'summon' && !d0 && e.done) {
      for (const m of game.enemies) if (m.owner === e && !m._dfx) {
        m._dfx = true;
        if (k === 'ant') stand('ant', 'rocks', m.x, m.y + 4, 120, 0.65, 0);
        else if (k === 'crypt') stand('crypt', 'hands', m.x, m.y + 4, 130, 1, 0);
        else if (k === 'lava') stand('lava', 'splash', m.x, m.y + 4, 130, 0.6, 0);
      }
    }
  }
  const baseUpdate = NC.updateEnemy;
  NC.updateEnemy = function (game, e, dt) {
    const k = kit(e);
    if (!k) return baseUpdate.apply(this, arguments);
    const s0 = e.state, d0 = e.done, r0 = e.raged, o = cur;
    cur = e;
    let out;
    try { out = baseUpdate.apply(this, arguments); } finally { cur = o; }
    extras(game, e, k, s0, d0, r0, dt);
    return out;
  };
  // (the rage meteors land on the game clock, whoever is updating)
  const baseUpd = FX.update;
  FX.update = function (dt, game) { const r = baseUpd.apply(this, arguments); if (LANDS.length && game) lands(game); return r; };

  NC.DunBossFX = { PAINT, SET, stand, rage: (e) => { const k = kit(e); if (k && NC.game) rage(NC.game, e, k); } };
})();
