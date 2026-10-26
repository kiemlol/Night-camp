/* hitfeel.js — how a hit on a monster FEELS (the user, 2026-10-12: "อยากทำเอฟเฟคตอนตีมอนให้ดู impact มันจะได้ดูสะใจ ...
   ตีแล้วมันๆ"; they asked for a clip of each piece to choose from, then took them all: "เอารวมกันเลย"). Nine pieces, each
   its own switch in NC.HitFeel.on, ALL ON by default (ESC → ตั้งค่า "ความมันตอนตีโดน" turns them off, kept in nc_hitfeel2):
     shake   the monster trembles for a moment, then settles
     flash   a two-step flash: the monster's own picture pure white for two frames, then the job colour fading out
     squash  the monster squashes along the blow, then springs back past round
     light   a flash of light at the hit and a pool of light on the ground under it (Codex pictures assets/hitfeel/
             light_<row>_<frame>.png on black, drawn additively; NOT the game's code-drawn radial lights)
     spark   a painted impact burst at the contact (assets/hitfeel: Codex on black, drawn additively in the job colour)
     punch   a critical: a quick camera punch and a small screen shake (no freeze)
     kill    the killing blow: the body flashes white, flies back and pops
     sound   hit sounds (WebAudio patches added to js/sfx.js: hf_hit, hf_heavy, hf_crit, hf_kill)
     embers  flying embers (the user, same day: "อยากได้แบบตีให้อารมณ์สะเก็ดไฟด้วย แบบมันๆ"): Codex-painted hot bits
             (assets/hitfeel/ember_<n>.png) thrown along the blow, turned along their flight, stretched by speed,
             cooling white → orange → red, bouncing once on the ground
     flinch  the monster jolts back from the blow: pushed away and leaning back from its feet, then springs upright
   2026-10-18, the user: "เวลามอนโดนตี มันต้องกระพริบด้วยสิ เเบบเกมอื่นอ่ะ ... สกิลด้วย". The flash became a BLINK as in other
   games: solid white (at least two drawn frames, however low the frame rate), its own colours, white again (a third time
   for skills, heavy blows and crits), then a red hurt tint fading out (it was the job colour, which read as fire); skill
   hits (NC.heroHit o.skill, online ev.skillId) react harder than plain swings; burn / poison ticks give a small soft blink.
   The person-shaped bosses (js/storyboss.js, js/rootboss.js: NC.drawHero, not NC.drawSpr) blink through drawHero's tint,
   and the monsters' own e.flash is left alone (Baphomet's Spine rig plays its own hit from it).
   NO HITSTOP (the user, after playing it: "เอาตอนตีแล้วหยุดออก"): while the pieces are on, every hit freeze is cleared
   at the start of each step (NC.timeScale, read by js/game.js step), the game's own melee / skill hitstops included; the
   first version's 'weight' (hitstop by weight) and the kill's freeze + 30% slow motion were taken out.
   A sweep that hits ten monsters still gives one light, one camera punch and one sound per step (the first three get
   sparks and embers). Test: ?hitfeel=all | none | shake,flash,... (this page only, not kept); videos:
   NC.HitFeel.set([...]). Hooks: NC.damageEnemy, NC.drawEnemy, NC.drawSpr, FX.update (its clock), NC.timeScale
   (read by js/game.js step), NC.SFX.P (js/sfx.js). The user's rule (2026-10-12): every effect picture is generated (Codex)
   or rendered (Blender); this file only moves, times and tints them, and squashes / shakes / tints the monsters' own art. Load after every file that wraps those, right before js/game.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX;
  const KEYS = ['shake', 'flash', 'squash', 'light', 'spark', 'punch', 'kill', 'sound', 'embers', 'flinch'];
  const HF = (NC.HitFeel = { on: {}, KEYS, log: null, noStop: false });
  HF.set = (list) => {
    for (const k of KEYS) HF.on[k] = list === 'all' || (Array.isArray(list) && list.includes(k));
    HF.noStop = list === 'all' || (Array.isArray(list) && list.includes('nostop'));
  };
  // 2026-10-20 the user: "เปิดเกมมาทุกคน จะต้องเปิดโหมดเอฟเฟคตีเห็นสะเก็ดไฟ ... ตั้ง default ไว้เลย เเต่ให้เขาไปปิดเอาเอง ทีหลัง":
  // the choice moved to a new key, so everyone who had turned it off before (nc_hitfeel 'off') starts with it ON once;
  // turning it off from now on is kept as before.
  const SAVE = 'nc_hitfeel2';
  {
    let kept = null;
    try { kept = localStorage.getItem(SAVE); localStorage.removeItem('nc_hitfeel'); } catch (e) { /* storage blocked */ }
    HF.set(kept === 'off' ? [] : 'all');
  }
  // ESC → ตั้งค่า: all the pieces on or off together (the sounds also follow the เสียงเอฟเฟกต์ volume)
  (NC.MENU_SETTINGS = NC.MENU_SETTINGS || []).push({
    name: 'ความมันตอนตีโดน', note: 'มอนกะพริบขาว สะดุ้งเอนหลัง สั่น ยุบเด้ง แสงวาบ ประกาย สะเก็ดไฟ กล้องกระแทกตอนคริ ร่างกระเด็นตอนตีตาย เสียงตีโดน · ตีแล้วภาพไม่หยุด',
    opts: [['on', 'เปิด'], ['off', 'ปิด']],
    get: () => (KEYS.every((k) => HF.on[k]) ? 'on' : KEYS.some((k) => HF.on[k]) ? 'mix' : 'off'),
    set: (v) => { HF.set(v === 'off' ? [] : 'all'); try { localStorage.setItem(SAVE, v === 'off' ? 'off' : 'on'); } catch (e) { /* storage blocked */ } },
  });

  const jobHex = () => { const D = NC.DmgFX, p = NC.game && NC.game.player; return (D && D.JOBCOL && p && D.JOBCOL[p.job]) || '#ffb347'; };

  // ---------------- a clock that runs through hitstops (FX.update gets dt * 0.4 while the game is held) ----------------
  let clock = 0;
  const baseFxUpdate = FX.update;
  FX.update = function (dt, game) {
    clock += game && game.hitstop > 0 ? dt / 0.4 : dt;
    return baseFxUpdate.apply(this, arguments);
  };

  // ---------------- no hit freeze: js/game.js step calls NC.timeScale first, before it checks game.hitstop ----------------
  NC.timeScale = function () { if (HF.noStop && NC.game) NC.game.hitstop = 0; return 1; };

  // ---------------- the impact spark pictures ----------------
  const SP = [[], []], ANCHOR = [[0.432, 0.538], [0.436, 0.398]];   // (the core of each row's burst: tools/hitfeel_cut.py)
  for (let r = 0; r < 2; r++) for (let f = 0; f < 4; f++) { const im = new Image(); im.src = `assets/hitfeel/spark_${r}_${f}.png`; SP[r][f] = im; }
  const tintCache = new Map();
  function tinted(im, hex) { // the white-on-black picture multiplied by the colour (black stays black: drawn with 'lighter')
    const k = im.src + hex;
    if (!tintCache.has(k)) {
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = hex; x.fillRect(0, 0, c.width, c.height);
      tintCache.set(k, c);
    }
    return tintCache.get(k);
  }
  FX.def('hfspark', (ctx, p, u) => {
    const im = SP[p.big ? 1 : 0][Math.min(3, Math.floor(u * 4))];
    if (!im.complete || !im.naturalWidth) return;
    const w = p.size, h = (w * im.naturalHeight) / im.naturalWidth, A = ANCHOR[p.big ? 1 : 0];
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.rot); if (p.dir < 0) ctx.scale(-1, 1);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(tinted(im, p.hex), -w * A[0], -h * A[1], w, h);
    ctx.globalAlpha *= 0.6; ctx.drawImage(im, -w * A[0], -h * A[1], w, h);
    ctx.restore();
  }, 'glow');

  // ---------------- the hit light: a round flash in the air (row 0) and a pool on the ground (row 1), 4 frames each ----------------
  const LI = [[], []];
  for (let r = 0; r < 2; r++) for (let f = 0; f < 4; f++) { const im = new Image(); im.src = `assets/hitfeel/light_${r}_${f}.png`; LI[r][f] = im; }
  const drawLight = (row) => (ctx, p, u) => {
    const im = LI[row][Math.min(3, Math.floor(u * 4))];
    if (!im.complete || !im.naturalWidth) return;
    const w = p.size, h = (w * im.naturalHeight) / im.naturalWidth;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= p.a;
    ctx.drawImage(im, p.x - w / 2, p.y - h / 2, w, h);
    ctx.restore();
  };
  FX.def('hflight', drawLight(0), 'glow');
  FX.def('hfpool', drawLight(1), 'low');
  function hitLight(x, y, gx, gy, big, k) {
    FX.add({ type: 'hflight', x, y, size: (big ? 230 : 170) * k, a: big ? 0.6 : 0.45, life: big ? 0.24 : 0.18 });
    FX.add({ type: 'hfpool', x: gx, y: gy, size: (big ? 420 : 320) * k, a: big ? 0.7 : 0.55, life: big ? 0.3 : 0.24 });
  }

  // ---------------- flying embers (16 pieces: 4 long streaks, 4 medium, 4 short, 4 tiny bits; head on the right) ----------------
  const EM = [];
  for (let i = 0; i < 16; i++) { const im = new Image(); im.src = `assets/hitfeel/ember_${i}.png`; EM.push(im); }
  const COOL = ['#fff6d8', '#ffe08a', '#ffb347', '#ff8a2e', '#ff5a24', '#e8381e'];   // (white-hot to red, by age)
  const EMLEN = [58, 42, 27, 12];                                                     // (each row's length, world units)
  FX.def('hfember', (ctx, p, u) => {
    const im = EM[p.pic];
    if (!im.complete || !im.naturalWidth) return;
    const sp = Math.hypot(p.vx, p.vy), st = Math.max(0.55, Math.min(1.7, sp / 600));
    const w = EMLEN[p.pic >> 2] * p.k * (p.pic >= 12 ? 1 : st), h = Math.max(2, (EMLEN[p.pic >> 2] * p.k * im.naturalHeight) / im.naturalWidth);
    const a = Math.pow(1 - u, 1.1);
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx));
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= a;
    ctx.drawImage(tinted(im, COOL[Math.min(5, Math.floor(u * 6))]), -w, -h / 2, w, h);
    if (u < 0.35) { ctx.globalAlpha *= 0.6 * (1 - u / 0.35); ctx.drawImage(im, -w, -h / 2, w, h); }
    ctx.restore();
  }, 'glow');
  function embers(x, y, gy, dir, n, k) {
    for (let i = 0; i < n; i++) {
      const a = NC.rand(-1.1, 0.45), sp = NC.rand(360, 960) * k;
      const pic = (sp > 780 * k ? 0 : sp > 580 * k ? 4 : sp > 430 * k ? 8 : 12) + Math.floor(Math.random() * 4);
      FX.add({ type: 'hfember', x: x + NC.rand(-6, 6), y: y + NC.rand(-8, 8), vx: dir * Math.cos(a) * sp, vy: Math.sin(a) * sp, grav: 1500, drag: 2.4,
        life: NC.rand(0.32, 0.7), pic, k: NC.rand(0.85, 1.2) * (k > 1 ? 1.15 : 1), gy: gy + NC.rand(-6, 16),
        update: (q) => { if (!q.b && q.vy > 0 && q.y > q.gy) { q.y = q.gy; q.vy *= -0.32; q.vx *= 0.55; q.b = 1; } } });
    }
  }

  // the killed monster's last pictures, flying back white and fading (the monster itself leaves the list at once)
  FX.def('hfcorpse', (ctx, p, u) => {
    const k = 1 - u, white = u < 0.35 ? 1 : 0.85 * (1 - (u - 0.35) / 0.65);
    const s = 0.16 * Math.exp(-p.t * 12) * Math.cos(p.t * 24);
    ctx.save();
    ctx.globalAlpha *= Math.min(1, k * 1.6);
    ctx.translate(p.x, p.y); ctx.scale(1 - s, 1 + s * 0.6); ctx.translate(-p.x, -p.y);
    for (const q of p.pics) baseDrawSpr(ctx, q.name, p.x + q.dx, p.y + q.dy, Object.assign({}, q.o, { tint: ['#ffffff', white] }));
    ctx.restore();
  }, 'high');

  // ---------------- the hit ----------------
  let stepAt = -1, inStep = 0, lastKill = -9;
  // a skill's hit is marked on the hit itself (skills pass o.skill to NC.heroHit: js/skills.js strike and the job files)
  const baseHeroHit = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const r = baseHeroHit.apply(this, arguments);
    if (r && o && o.skill) r.hfSkill = true;
    return r;
  };
  const baseDamage = NC.damageEnemy;
  NC.damageEnemy = function (game, e, r, kx, ky, o) {
    const alive = e && e.hp > 0;
    const res = baseDamage.apply(this, arguments);
    o = o || {};
    if (!alive || !r || r.miss) return res;
    if (o.dot) { if (e.hp > 0) tick(game, e); return res; }
    feel(game, e, r, kx, o, e.hp <= 0);
    return res;
  };
  // (online the server's hit events never reach NC.damageEnemy: js/online/world.js plays a landed hit through this,
  // o.quiet = another player's hit, no sound; 2026-10-18, the user: "สะเก็ดไฟตอนตีหายไปไหน")
  HF.play = (game, e, r, kx, o) => { if (game && e && r && !r.miss) feel(game, e, r, kx || 0, o || {}, !!(o && o.killed)); };
  // a burn / poison tick: one soft blink and a small jolt, unless a real blow's reaction is still playing
  function tick(game, e) {
    if (!HF.on.flash && !HF.on.flinch) return;
    if (e.hf && !e.hf.dot && clock - e.hf.t0 < 0.45) return;
    const p = game.player;
    e.hf = { t0: clock, dir: (p ? Math.sign(e.x - p.x) : 1) || 1, k: 0.3, hex: jobHex(), dot: true, wf: 0 };
  }
  function feel(game, e, r, kx, o, killed) {
    const on = HF.on;
    if (!KEYS.some((k) => on[k])) return;
    if (game.time !== stepAt) { stepAt = game.time; inStep = 0; }
    const n = ++inStep, p = game.player;
    const W = p && NC.ITEMS[p.equip.weapon];
    const fin = !!(p && p.atk && p.atk.on && p.atk.step >= 2) || !!o.big;
    const heavy = fin || !!(W && (W.twoHanded || W.style === 'smash'));
    const crit = !!r.crit, skill = !!(r.hfSkill || r.skill || o.skill);
    const dir = Math.sign(kx) || (p ? Math.sign(e.x - p.x) : 1) || 1;
    const top = NC.labelTop ? NC.labelTop(e) : e.y - 120;
    const hy = e.y - Math.max(28, (e.y - top) * 0.42), hx = e.x - dir * Math.min(30, (e.r || 30) * 0.6);
    const hex = jobHex();
    // the reaction's strength: plain swing 1, heavy blow 1.3, skill 1.45, a crit on top of that
    const rk = Math.min(1.8, (skill ? 1.45 : heavy ? 1.3 : 1) + (crit ? 0.3 : 0));
    const was = e.hf, strong = skill || heavy || crit;
    if (was && !was.dot && was.wEnd === undefined && clock - was.t0 < 0.1) { was.k = Math.max(was.k, rk); was.blinks = Math.max(was.blinks, strong ? 3 : 2); } // (a hit inside the first white: keep it, don't restart)
    else e.hf = { t0: clock, dir, k: rk, hex, blinks: strong ? 3 : 2, white: strong ? 0.1 : 0.075, red: strong ? 0.22 : 0.16, wf: 0 };
    if (on.light && n === 1) hitLight(hx, hy, e.x, e.y, heavy || crit, 1);   // (one light per blow: two at once burnt white)
    if (on.spark && n <= 3) FX.add({ type: 'hfspark', x: hx, y: hy, dir, big: crit || heavy, hex, size: crit || heavy ? 230 : 150, rot: NC.rand(-0.35, 0.35), life: crit || heavy ? 0.22 : 0.17 });
    if (on.embers && n <= 3) embers(hx, hy, e.y, dir, n === 1 ? (crit || heavy ? 22 : 14) : 7, crit || heavy ? 1.3 : 1);
    if (on.punch && n === 1 && crit) { if (NC.GLFX && NC.GLFX.zoom) NC.GLFX.zoom(hx, hy, 0.05, 0.2); game.shake = Math.max(game.shake, 5); }
    if (on.kill && killed && game.time - lastKill > 0.6) {
      lastKill = game.time;
      if (e.hfPics && e.hfPics.length) FX.add({ type: 'hfcorpse', x: e.x, y: e.y, vx: dir * 520, vy: -60, drag: 6, life: 0.42, pics: e.hfPics });
      hitLight(e.x, hy, e.x, e.y, true, 1.1);
    }
    if (on.sound && n === 1 && NC.SFX && !o.quiet) {
      const pan = p ? Math.max(-0.6, Math.min(0.6, (e.x - p.x) / 600)) : 0;
      // the layered ElevenLabs hit (js/hitsfx.js) once its takes are loaded; else the synth patch below
      if (!(NC.HitSfx && NC.HitSfx.hit(game, e, { crit, heavy, skill, fin, killed, pan, r })))
        NC.SFX.play(on.kill && killed ? 'hf_kill' : crit ? 'hf_crit' : heavy ? 'hf_heavy' : 'hf_hit', { pan, vol: 1 });
    }
    if (HF.log) HF.log.push({ t: game.time, crit, heavy, skill, killed, x: e.x, k: e.hf && e.hf.k });
  }

  // ---------------- the monster drawn: blinking, jolted back, trembling, squashed ----------------
  // the blink, worked out once per drawn frame: a tint for the monster's pictures, null = its own colours (the plain
  // white of e.flash held back), undefined = leave whatever the monster's own draw asked for
  const HURT = '#ff3b3b', GAP = 0.04, BLINK = 0.045;
  function blinkTint(e, h, age) {
    if (h.dot) { if (age < 0.07 || (h.wf < 1 && age < 0.2)) { h.wf++; return ['#ffffff', 0.5]; } return undefined; }
    if (h.wEnd === undefined) {
      if (age < h.white || (h.wf < 2 && age < 0.2)) { h.wf++; return ['#ffffff', 1]; }   // (two drawn frames at the least: a slow frame rate still sees it)
      h.wEnd = age;
    }
    let u = age - h.wEnd;
    for (let i = 1; i < h.blinks; i++) {
      if (u < GAP) return e.flash > 0 ? null : undefined;
      u -= GAP;
      if (u < BLINK) return ['#ffffff', i === 1 ? 0.8 : 0.6];
      u -= BLINK;
    }
    if (u < h.red) return [HURT, 0.5 * (1 - u / h.red)];
    return e.flash > 0 ? null : undefined;
  }
  let CUR = null;
  const baseDrawSpr = NC.drawSpr;
  NC.drawSpr = function (ctx, name, x, y, o) {
    const e = CUR;
    if (!e) return baseDrawSpr.apply(this, arguments);
    if (e.hfPics && e.hfPics.length < 6) e.hfPics.push({ name, dx: x - e.x, dy: y - e.y, o: { flip: o && o.flip, sx: o && o.sx, sy: o && o.sy, rot: o && o.rot } });
    if (e.hfTint === undefined) return baseDrawSpr.apply(this, arguments);
    baseDrawSpr.call(this, ctx, name, x, y, Object.assign({}, o, { tint: e.hfTint }));
    // (2026-10-12: the code-drawn glowing rim was taken out: effects are generated pictures or Blender only)
  };
  // the person-shaped bosses are drawn as heroes: the same blink through drawHero's own tint
  const baseDrawHero = NC.drawHero;
  NC.drawHero = function (ctx, equip, P, x, y, o) {
    const e = CUR;
    if (!e || e.hfTint === undefined) return baseDrawHero.apply(this, arguments);
    return baseDrawHero.call(this, ctx, equip, P, x, y, Object.assign({}, o, { tint: e.hfTint }));
  };
  const baseDrawEnemy = NC.drawEnemy;
  NC.drawEnemy = function (ctx, game, e) {
    const h = e.hf, on = HF.on;
    let dx = 0, sx = 1, sy = 1, lean = 0;
    e.hfTint = undefined;
    if (h) {
      const age = clock - h.t0;
      if (on.flash) e.hfTint = blinkTint(e, h, age);
      if (!h.dot && on.shake && age < 0.22) dx = (Math.random() * 2 - 1) * 6 * Math.min(1.35, h.k) * Math.max(0, 1 - age / 0.22);
      if (!h.dot && on.squash && age < 0.6) { const s = 0.2 * Math.min(1.35, h.k) * Math.exp(-age * 12) * Math.cos(age * 26); sx = 1 - s; sy = 1 + s * 0.65; }
      if (on.flinch && age < 0.6) {
        // knocked back from the feet: 35 ms to the furthest, then back, the lean springing a little past upright
        const big = Math.max(0.3, Math.min(1.1, 28 / (e.r || 26))), a = 0.035;
        const out = age < a ? age / a : Math.exp(-(age - a) * 10);
        const sway = age < a ? age / a : Math.exp(-(age - a) * 7) * Math.cos((age - a) * 13);
        dx += h.dir * 16 * h.k * big * out;
        lean = h.dir * 0.2 * h.k * big * sway;
      }
      if (age > 0.6) e.hf = null;
    }
    e.hfPics = [];
    CUR = e;
    const moved = dx || lean || sx !== 1 || sy !== 1;
    if (moved) { ctx.save(); ctx.translate(e.x + dx, e.y); if (lean) ctx.rotate(lean); ctx.scale(sx, sy); ctx.translate(-e.x, -e.y); }
    try { return baseDrawEnemy.apply(this, arguments); } finally { if (moved) ctx.restore(); CUR = null; e.hfTint = undefined; }
  };

  // ---------------- the hit sounds (WebAudio, the same patches play live and render into a clip) ----------------
  const noiseBufs = new WeakMap();
  function noise(a, t0, dur) {
    let b = noiseBufs.get(a);
    if (!b) { b = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; noiseBufs.set(a, b); }
    const s = a.createBufferSource(); s.buffer = b; s.loop = true; s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05); return s;
  }
  function env(a, t0, att, peak, dec) { const g = a.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + att); g.gain.exponentialRampToValueAtTime(0.0001, t0 + att + dec); return g; }
  function thump(a, out, t, f0, f1, dur, peak) {
    const o = a.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = env(a, t, 0.004, peak, dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  function crack(a, out, t, f0, f1, dur, peak, type) {
    const f = a.createBiquadFilter(); f.type = type || 'bandpass'; f.Q.value = 0.9; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = env(a, t, 0.002, peak, dur); noise(a, t, dur).connect(f); f.connect(g); g.connect(out);
  }
  function ping(a, out, t, f, dur, peak) {
    const o = a.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.92, t + dur);
    const g = env(a, t, 0.002, peak, dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  const PATCH = {
    // a blow landing on a body, not on metal (the user, 2026-10-12: "เสียงตีทำเหมือนเสียงตีเหล็ก"): the first version's
    // bright band of noise (2.6 kHz) and the crit's ringing triangle partials read as a clang. Now a low thump + a short
    // muffled slap (noise through a falling LOW-pass, nothing ringing above ~1.5 kHz); heavier blows go lower and longer
    hf_hit(a, out, t, o) { const v = (o && o.vol) || 1; thump(a, out, t, 150, 52, 0.12, 0.85 * v); crack(a, out, t, 1500, 320, 0.06, 0.5 * v, 'lowpass'); },
    hf_heavy(a, out, t, o) { const v = (o && o.vol) || 1; thump(a, out, t, 112, 36, 0.22, 1 * v); crack(a, out, t, 1200, 240, 0.1, 0.6 * v, 'lowpass'); crack(a, out, t + 0.012, 420, 110, 0.2, 0.32 * v, 'lowpass'); },
    hf_crit(a, out, t, o) { const v = (o && o.vol) || 1; PATCH.hf_heavy(a, out, t, o); thump(a, out, t + 0.03, 210, 64, 0.1, 0.45 * v); crack(a, out, t, 900, 380, 0.09, 0.28 * v); },
    hf_kill(a, out, t, o) { const v = (o && o.vol) || 1; PATCH.hf_heavy(a, out, t, o); crack(a, out, t + 0.05, 650, 120, 0.36, 0.34 * v, 'lowpass'); thump(a, out, t + 0.02, 86, 28, 0.36, 0.65 * v); },
  };
  if (NC.SFX && NC.SFX.P) Object.assign(NC.SFX.P, PATCH);
})();
