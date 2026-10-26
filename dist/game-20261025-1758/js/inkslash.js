/* inkslash.js — the sword's plain hits land with a HAND-DRAWN INK IMPACT (2026-10-18: the user sent a reel of a hand-drawn
   2D game, "ทำ vfx ท่าฟันเเบบนี้ยังไง เเบบเหมือนเลยนะ", then "ลองทำท่าฟันแบบนี้กับการตีปกติของดาบก่อน ขอดูเป็นภาพนิ่งในเกมก่อนนะ").
   The reel's hits, piece by piece, and what this file plays:
     burst   a white-hot jagged starburst with dark ink speed lines, blue sparkles and little yellow stars: six painted frames
             cut hard like an anime impact (no melting between them). It takes the place of hitfeel.js's job-coloured
             spark and its orange embers on these hits; hitfeel's blink, flinch, light and sound stay.
     cut     a critical: a crimson diagonal cut with its own red burst and ink drops, turned along the swing
     split   a critical or the combo's finisher: the frame's colours pulled apart for a moment (red one way, cyan the
             other), like the reel's big hits
   Only the player's own plain swings with a sword (ดาบ, ดาบใหญ่, ดาบคู่); skills keep their looks.
   A TEST for now: ?inkslash=1 turns it on for that page; without it the game plays as before.
   Looks (NC.InkSlash.style, IS.STYLES): 'ink' = the painted frames above; 'light' = js/lightslash.js, the same hits made
   the engine way (single light pieces fired as particles, added as light, bloomed), ?inkslash=light. Both share this
   file's hit picking, the swap of hitfeel's spark / embers and the colour split; IS.post runs before the split.
   Art: assets/gen/make_inkslash_prompts.py (Codex, on magenta) -> tools/inkslash_cut.py -> assets/inkslash/ +
   assets/inkslash.manifest.js. The code only places, flips, turns and times the painted frames; the colour split shifts
   the game's own picture. Hooks: NC.heroHit, NC.damageEnemy, FX.add (drops hitfeel's spark / embers on these hits),
   FX.draw (the split, after the 'glow' layer). Load after js/hitfeel.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX;
  if (!FX) return;
  const IS = (NC.InkSlash = { on: false, style: 'ink',
    split: true, embers: false, STYLES: {}, post: [] });
  const MAN = NC.ASSET_MANIFEST_INKSLASH || {};
  const SWORDS = new Set(['sword', 'gsword', 'dsword', 'katana']);
  const ok = (im) => im && im.complete && im.naturalWidth > 0;

  const IMG = {};
  for (const name in MAN) {
    const A = MAN[name];
    A.cum = [0];
    for (const f of A.frames) A.cum.push(A.cum[A.cum.length - 1] + f.d / 1000);
    A.total = A.cum[A.cum.length - 1];
    IMG[name] = A.frames.map((f) => { const im = new Image(); im.src = f.src; return im; });
  }
  const ready = (name) => IMG[name] && IMG[name].every(ok);

  // one animation at (x, y): hard frame cuts, a little growth while it plays (the shards keep flying between frames)
  FX.def('inkslash', (ctx, p) => {
    const A = MAN[p.name];
    if (!A) return;
    let i = 0;
    while (i < A.frames.length - 1 && p.t >= A.cum[i + 1]) i++;
    const f = A.frames[i], im = IMG[p.name][i];
    if (!ok(im)) return;
    const k = p.k * A.k * (0.96 + 0.1 * Math.min(1, p.t / A.total));
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot || 0);
    ctx.scale(p.flip ? -k : k, k);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(im, -f.ox, -f.oy, f.w, f.h);
    ctx.restore();
  }, 'glow');
  const play = (name, x, y, o) => FX.add(Object.assign({ type: 'inkslash', name, x, y, k: 1, life: MAN[name].total }, o));
  // the painted look: h = { hx, hy, dir, k, fin, crit, heavy, ang, n (1..3: which monster of this swing) }
  IS.STYLES.ink = {
    ready: () => ready('ink_hit'),
    play(game, e, h) {
      if (h.crit && ready('ink_crit')) {
        // the cut runs along the swing: its painted diagonal (upper-left to lower-right) turned toward the blow
        const down = Math.sin(h.ang) > 0.25 ? 0.25 : Math.sin(h.ang) < -0.25 ? -0.35 : 0;
        play('ink_crit', h.hx, h.hy, { k: h.k * 1.05, flip: h.dir < 0, rot: h.dir * down + NC.rand(-0.12, 0.12) });
        play('ink_hit', h.hx, h.hy, { k: h.k * 0.7, flip: h.dir < 0, rot: NC.rand(-0.3, 0.3) });
      } else play('ink_hit', h.hx, h.hy, { k: h.k * (h.fin ? 1.25 : 1) * (h.n > 1 ? 0.85 : 1), flip: h.dir < 0, rot: NC.rand(-0.35, 0.35) });
    },
  };
  const look = () => IS.STYLES[IS.style] || IS.STYLES.ink;

  // ---------------- which hits: the player's own plain sword swings ----------------
  const isSword = (p) => {
    const W = p && NC.ITEMS[p.equip.weapon];
    return !!W && SWORDS.has(NC.wtypeOf ? NC.wtypeOf(W) : W.wtype);
  };
  const baseHeroHit = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const r = baseHeroHit.apply(this, arguments);
    const p = NC.game && NC.game.player;
    if (r && IS.on && p && d === p.d && !(o && o.skill) && p.atk && p.atk.on && isSword(p)) r.ink = true;
    return r;
  };

  // hitfeel.js's spark and embers are dropped while one of these hits is being dealt (its FX.add calls run inside it)
  let dealing = false;
  const baseAdd = FX.add;
  FX.add = function (p) {
    if (dealing && p && (p.type === 'hfspark' || (!IS.embers && p.type === 'hfember') || (IS.style === 'light' && p.type === 'hflight'))) return p;   // (the light look has its own flash: two burnt white)
    return baseAdd.apply(this, arguments);
  };

  const sizeOf = (e) => Math.max(0.85, Math.min(1.6, 0.75 + (e.r || 30) / 120)); // (a bigger monster, a bigger burst)
  let stepAt = -1, inStep = 0;
  const baseDamage = NC.damageEnemy;
  NC.damageEnemy = function (game, e, r, kx, ky, o) {
    const mine = !!(r && r.ink && !r.miss && e && e.hp > 0 && !(o && o.dot) && look().ready());
    dealing = mine;
    let res;
    try { res = baseDamage.apply(this, arguments); } finally { dealing = false; }
    if (!mine) return res;
    if (game.time !== stepAt) { stepAt = game.time; inStep = 0; }
    if (++inStep > 3) return res;   // (a sweep through a crowd: the first three get a burst)
    const p = game.player, dir = Math.sign(kx) || Math.sign(e.x - p.x) || 1;
    const top = NC.labelTop ? NC.labelTop(e) : e.y - 120;
    const hy = e.y - Math.max(30, (e.y - top) * 0.45), hx = e.x + dir * 6;   // (on the body, like the reel: at the contact it covered the hero's face)
    const W = NC.ITEMS[p.equip.weapon], heavy = !!(W && (W.twoHanded || NC.wtypeOf(W) === 'gsword'));
    const fin = !!(o && o.big) || p.atk.step >= 2, crit = !!r.crit, k = sizeOf(e) * (heavy ? 1.2 : 1);   // (a greatsword's blow, a bigger burst)
    look().play(game, e, { hx, hy, dir, k, fin, crit, heavy, ang: p.atk.ang || 0, n: inStep });
    if (IS.split && inStep === 1 && (crit || fin)) splitAt(game, crit ? 0.14 : 0.1, crit ? 5 : 3.5);
    return res;
  };

  // ---------------- the colour split: the frame drawn again as red shifted one way + cyan the other ----------------
  let split = null, buf = null, red = null, cyan = null;
  function splitAt(game, dur, px) { split = { t0: game.time, dur, px }; }
  IS.splitAt = (dur, px) => NC.game && splitAt(NC.game, dur || 0.12, px || 6);
  const canvasOf = (c, W, H) => { if (!c) c = document.createElement('canvas'); if (c.width !== W || c.height !== H) { c.width = W; c.height = H; } return c; };
  function tintCopy(c, src, hex) {
    const x = c.getContext('2d');
    x.globalCompositeOperation = 'copy'; x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = hex; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(src, 0, 0);   // (keep the canvas's own alpha)
  }
  function applySplit(ctx) {
    if (!split || !NC.game) return;
    const u = (NC.game.time - split.t0) / split.dur;
    if (u >= 1 || u < 0) { if (u >= 1) split = null; return; }
    const cv = ctx.canvas, W = cv.width, H = cv.height;
    const d = Math.round(split.px * (W / 1600) * (u < 0.2 ? 1 : 1 - (u - 0.2) / 0.8) * 2) / 2;
    if (d < 0.5) return;
    buf = canvasOf(buf, W, H); red = canvasOf(red, W, H); cyan = canvasOf(cyan, W, H);
    buf.getContext('2d').globalCompositeOperation = 'copy';
    buf.getContext('2d').drawImage(cv, 0, 0);
    tintCopy(red, buf, '#ff0000'); tintCopy(cyan, buf, '#00ffff');
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(red, -d, 0);
    ctx.drawImage(cyan, d, 0);
    ctx.restore();
  }
  const baseDraw = FX.draw;
  FX.draw = function (ctx, layer) {
    baseDraw.apply(this, arguments);
    if (layer !== 'glow' || !IS.on) return;
    for (const f of IS.post) f(ctx);   // (the light look's bloom, before the split takes the frame apart)
    if (IS.split) applySplit(ctx);
  };
})();
