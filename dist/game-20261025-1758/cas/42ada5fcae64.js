// dmgburst.js — "burst" damage numbers, a switch (the user, 2026-10-03, for the Lv 90 fight clip: "ให้ทุกฮิตเห็นดาเมจ
// รัวๆ พุ่งขึ้นแบบมันๆ"): every hit's number shoots straight up out of the monster, pops in big and white then snaps to
// size in its colour, slanted for speed, with a drop shadow; hits on the same monster in quick succession climb in a
// ladder above each other instead of piling up; bigger hits are bigger numbers; a critical is gold on a red burst and
// kicks harder. The game's DEFAULT since 2026-10-03 (the user: "เอาครบ 3 ข้อเลย": every job's colour, every skill's
// beats, on by default); ?dmgfx=0 brings back the old classic-MMO-style arcing numbers (fx.js FX.dmg), ?dmgfx=burst this
// again (remembered, localStorage nc_dmgfx); NC.DmgFX.on at runtime.
// Every skill hit shows its damage as one number on each beat of its effect (NC.DMG_BEATS, js/dmgbeats.js, read from each
// skill's VFX code; entities.js r.beats): a skill not in the table gets 2 beats (an ultimate 4), and one that hits the
// same monster again within 0.45 s (zones, beams, channels, damage over time) a small quick "tick" number.
(function () {
  const NC = window.NC, FX = NC.FX, TAU = Math.PI * 2;
  let on = true;
  try {
    on = localStorage.getItem('nc_dmgfx') !== '0';
  } catch (e) { /* storage blocked: on */ }
  // (ตัวเลขดาเมจ แบบเรียบ keeps the burst off whatever sets it later: js/hitstyle.js applies its kept style at load)
  const D = (NC.DmgFX = { get on() { return on; }, set on(v) { on = !!v && show !== 'simple'; } });

  // which monster and which hit the number is for (FX.dmg only gets a spot): set round NC.damageEnemy; a skill's hit
  // is tagged with its skill (r.sid, r.skill) round NC.heroHit
  let cur = null, curR = null;
  const lastHit = new WeakMap(); // monster → { sid: game time of that skill's last hit on it }
  const ULT_BEATS = [0, 0.05, 0.1, 0.16], SKILL_BEATS = [0, 0.07];
  const baseHH = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const r = baseHH.apply(this, arguments);
    if (!r || !o || !o.skill) return r;
    const G = NC.game, p = G && G.player;
    r.skill = true; if (!r.sid) r.sid = o.sid;
    r.mine = !!(p && d === p.d);
    if (r.mine) r.job = p.job;
    return beatsOf(r, e, G);
  };
  // the beats of its effect (the table), else: a repeat hit within 0.45 s is a tick, else 2 beats (an ultimate 4)
  function beatsOf(r, e, G) {
    if (!on || r.miss || !(r.dmg > 0) || r.beats || r.tick || !r.sid || !G) return r;
    const B = NC.DMG_BEATS && NC.DMG_BEATS[r.sid];
    let seen = e && lastHit.get(e);
    if (e && !seen) lastHit.set(e, (seen = {}));
    const again = seen && seen[r.sid] !== undefined && G.time - seen[r.sid] < 0.45;
    if (seen) seen[r.sid] = G.time;
    if (B === 'tick') r.tick = true;
    else if (Array.isArray(B)) r.beats = B;
    else if (again) r.tick = true;
    else r.beats = NC.SKILLS && NC.SKILLS[r.sid] && NC.SKILLS[r.sid].ult ? ULT_BEATS : SKILL_BEATS;
    return r;
  }
  // online the server's hits come straight here (js/online/world.js: no NC.damageEnemy), so they had no ladder: three
  // arrows on one monster in the same tick drew three numbers on one spot, read as one (Discord #129). The same ladder
  // as offline, and my skill's hit (r.sid, r.mine from the event) the same job colour and beats
  const baseHL = NC.enemyHitLooks;
  if (baseHL) NC.enemyHitLooks = function (e, r) {
    if (cur || !e || !r) return baseHL.apply(this, arguments);
    const G = NC.game, p = G && G.player;
    if (r.sid && r.mine && NC.SKILLS && NC.SKILLS[r.sid] && !r.skill) { r.skill = true; r.job = p && p.job; beatsOf(r, e, G); }
    cur = e; curR = r;
    try { return baseHL.apply(this, arguments); } finally { cur = null; curR = null; }
  };
  const baseDE = NC.damageEnemy;
  let curDot = null;
  NC.damageEnemy = function (game, e, r, kx, ky, o) {
    cur = e; curR = r; curDot = o && o.dot ? o.fill || '#9be35a' : null;
    if (on && r && r.tick && o && o.big) { r.tick = false; r.beats = [0, 0.05, 0.1]; } // (a tick skill's big finisher)
    if (on && r && r.mine && !r.miss && r.sid && e && e.hp > 0) total(game, r);
    try { return baseDE.apply(this, arguments); } finally { cur = null; curR = null; curDot = null; }
  };
  // a skill's numbers in its job's colour, bigger than a basic hit's: each line has its theme, a class-3 job a lighter
  // or deeper shade of its 2nd job's (the user: "ให้ทุกอาชีพมีสีเลขของตัวเอง")
  const JOBCOL = {
    traveler: '#ffe2a8',
    knight: '#ff8c42', paladin: '#fff0a0', dawnwarden: '#ffcf70', dragonknight: '#ff5a2a', dragonbound: '#ff7448',
    swordmaster: '#c3ccff', starblade: '#e4d8ff', berserker: '#ff3b3b', bloodmoon: '#ff2d6a',
    mage: '#b48cff', archmage: '#86e0ff', astral: '#c9a8ff', warlock: '#a6ff70', hexlord: '#d2ff52',
    firemage: '#ff7a2e', starcore: '#ffb23c', icemage: '#9ee6ff', winterlord: '#dcf7ff',
    archer: '#a8e46a', ranger: '#6fd86a', moonsniper: '#d2e4ff', wolfhunter: '#9fb9ec', packalpha: '#bcd4ff',
    bard: '#ff8ad6', maestro: '#ffb6e8', gunslinger: '#ffbd5c', outlaw: '#ff9a52',
    rogue: '#b8ff4a', assassin: '#d07cff', eclipse: '#a47cff', shinobi: '#ff6f61', shadowlord: '#ff958a',
    reaper: '#e2e8ff', harvester: '#f2f5ff', puppeteer: '#e8a86b', showmaster: '#ffd06b',
    priest: '#fff3b0', bishop: '#ffe7a0', starsaint: '#fff6d4', monk: '#ffa94d', meteorfist: '#ff8a3d',
    lightkeeper: '#ffe486', beacon: '#fff0a6', wisp: '#9ffcff', starshepherd: '#d8f0ff',
    samurai: '#8fbaff', bloodsamurai: '#ff5470', windsamurai: '#4ff0b8',
  };
  D.JOBCOL = JOBCOL;
  const jobCol = (job) => { const p = NC.game && NC.game.player; return JOBCOL[job || (p && p.job)] || '#ffb347'; };

  // an ultimate's TOTAL: its hits add up, and when they stop (0.55 s) the sum pops up big over the hero
  const TOT = {};
  function total(game, r) {
    const S = NC.SKILLS && NC.SKILLS[r.sid];
    if (!S || !S.ult || D.hides(true, false)) return;
    const T = TOT[r.sid] || (TOT[r.sid] = { sum: 0, n: 0, last: 0, live: false });
    T.sum += r.dmg || 0; T.n++; T.last = game.time;
    if (T.live) return;
    T.live = true;
    FX.add({ type: 'timer', layer: 'none', life: 30, update(q) {
      if (game.time - T.last < 0.55) return;
      q.dead = true; T.live = false;
      const p = game.player;
      if (T.n >= 3 && p) FX.add({ type: 'dmgtotal', layer: 'glow', x: p.x, y: p.y - 300, life: 1.9, text: Math.round(T.sum).toLocaleString('en-US'), col: jobCol(), rot: NC.rand(0, TAU) });
      T.sum = 0; T.n = 0;
    } });
  }

  // the ladder: hits on one monster within 0.4 s stack upwards (6 rungs, then round again), alternating sides
  const ladder = new WeakMap();
  const now = () => (NC.game ? NC.game.time : performance.now() / 1000);
  const OUT = () => NC.OUTLINE || '#1b1428';
  // shoots up and stops hard (an ease-out), then drifts up slowly
  function rise(p) {
    const t = p.t - p.delay;
    if (t < 0) return;
    if (!p.init) { p.init = true; p.x0 = p.x; p.y0 = p.y; }
    const k = 9;
    p.y = p.y0 + (p.sy / k) * (1 - Math.exp(-t * k)) - t * 34;
    p.x = p.x0 + (p.sx / k) * (1 - Math.exp(-t * k));
  }
  // a damage-over-time tick (poison, burn: entities.js shows it with FX.num): the same small quick number as a skill's
  // tick, in its own colour (the old green / the status's fill)
  const baseNum = FX.num;
  FX.num = function (x, y, text) {
    if (D.hides(!!cur)) return; // (ตัวเลขดาเมจ: a monster's number comes while `cur` is set, from NC.enemyHitLooks / NC.damageEnemy)
    if (!on || !curDot || !cur) return baseNum.apply(this, arguments);
    const side = Math.random() < 0.5 ? -1 : 1;
    FX.add({ type: 'dmgb', layer: 'glow', x: x + side * NC.rand(6, 26), y: y - 30, x0: 0, y0: 0, init: false, text: String(text), size: 24, fill: curDot,
      crit: false, miss: false, skill: false, tag: null, rot: 0, side, sy: -420, sx: side * NC.rand(10, 40), life: 0.55, delay: 0, update: rise });
  };
  const baseDmg = FX.dmg;
  FX.dmg = function (x, y, text, o) {
    if (D.hides(!!cur)) return; // (ตัวเลขดาเมจ, as FX.num above)
    if (!on) return baseDmg.apply(this, arguments);
    o = o || {};
    const miss = text === 'MISS', n = +text || 0;
    const tick = !miss && !!(curR && curR.tick), skill = !miss && !tick && !!(curR && curR.skill);
    let rung = 0, side = Math.random() < 0.5 ? -1 : 1;
    if (cur && !miss && !tick) { // (a MISS or a tick doesn't take a rung: it stays low, small and quick)
      const L = ladder.get(cur) || { t: -9, i: 0, side: 1 }, t = now();
      L.i = t - L.t < 0.4 ? L.i + 1 : 0; L.t = t; L.side = -L.side;
      ladder.set(cur, L);
      rung = L.i % 5; side = L.side;
    }
    // the size from the hit: 300 → small, ~8000+ → big; a skill's bigger, a critical half again
    const mag = miss ? 0 : Math.max(0, Math.min(1, Math.log10(Math.max(1, n) / 300) / 1.45));
    const size = miss || tick ? 24 : (skill ? 42 + 26 * mag : 32 + 18 * mag) * (o.crit ? 1.32 : 1) * ((o.size || 44) >= 54 && !o.crit ? 1.08 : 1);
    const col = curR && curR.skill ? jobCol(curR.job) : null;
    // (a skill's critical keeps its job's colour, the spiky burst behind says critical; a basic hit's critical is gold)
    const fill = miss ? '#c4cde0' : col || (o.crit ? '#ffd23a' : o.fill && o.fill !== '#ffffff' ? o.fill : '#fff7e2');
    FX.add({ type: 'dmgb', layer: 'glow', x: x + side * NC.rand(8, 34), y: y - rung * 26, x0: 0, y0: 0, init: false, text: miss ? 'MISS' : String(text),
      size, fill, crit: !!o.crit, miss, skill, tag: o.tag || null, rot: NC.rand(0, TAU), side,
      sy: miss || tick ? -420 : -(o.crit ? 1050 : 880) - mag * 160, sx: side * NC.rand(20, 70), // (not vx / vy: fx.js would move it by those)
      life: (miss || tick ? 0.5 : o.crit ? 1.0 : 0.82) + (o.delay || 0), delay: o.delay || 0,
      update: rise });
  };

  // ---------------- which numbers show: ESC → ตั้งค่า → "ตัวเลขดาเมจ" (2026-10-24: FPS in a crowd) ----------------
  // all: as they are · mine: no one else's (their hits, heals on others) · simple: the old arcing numbers, no burst, beats
  // or TOTAL, the lightest to draw · off: no numbers on monsters (what hits or heals me, and PvP, still show).
  // Remembered in localStorage nightcamp.dmgnum.v1. Numbers are looks only: nothing hangs on them.
  const SHOW_KEY = 'nightcamp.dmgnum.v1', SHOWS = ['all', 'mine', 'simple', 'off'];
  let show = 'all', chosen = false; // (chosen: the player picked one; Auto's relief leaves it alone, js/gfx.js)
  try { const v = localStorage.getItem(SHOW_KEY); if (SHOWS.includes(v)) { show = v; chosen = true; } } catch (e) { /* storage blocked: all */ }
  const burstWanted = () => { try { return localStorage.getItem('nc_dmgfx') !== '0'; } catch (e) { return true; } };
  if (show === 'simple') on = false;
  // Auto's relief (the CPU holding the frames back): แบบเรียบ from step 1, for this session, unless the player chose
  D.relieve = (level) => {
    if (chosen) return false;
    show = level >= 1 ? 'simple' : 'all';
    on = show === 'simple' ? false : burstWanted();
    return true;
  };
  const theirs = () => !!(NC.OtherFX && NC.OtherFX.active && NC.OtherFX.active());
  // (onMonster: a number on a monster; ofOther: someone else's, by default whether another player's looks are playing)
  D.hides = (onMonster, ofOther = theirs()) => (show === 'off' && !!onMonster) || (show === 'mine' && !!ofOther);
  D.show = () => show;
  D.setShow = (v) => {
    if (!SHOWS.includes(v)) return;
    show = v; chosen = true;
    on = v === 'simple' ? false : burstWanted();
    try { localStorage.setItem(SHOW_KEY, v); } catch (e) { /* storage blocked: this visit only */ }
  };
  (NC.MENU_SETTINGS = NC.MENU_SETTINGS || []).push({
    name: 'ตัวเลขดาเมจ',
    note: 'ตีมอนเยอะแล้วกระตุก: แบบเรียบหรือปิดลื่นที่สุด · ปิด = ไม่โชว์เลขบนมอน (ดาเมจที่เราโดนกับฮีลยังโชว์)',
    group: 'perf',
    opts: [['all', 'ทั้งหมด'], ['mine', 'ของเรา'], ['simple', 'แบบเรียบ'], ['off', 'ปิด']],
    get: () => show,
    set: (v) => D.setShow(v),
  });

  // the critical's spiky burst, baked once (2026-10-24: FPS): a 24-point concave star filled and outlined was path work and,
  // on the WebGL screen, stencil passes for every critical every frame. Drawn scaled to its size; the outline is baked for
  // a ~50 px burst (5 px, as it was drawn). Baked near the sizes it is drawn at (~30-70 px), so the Canvas2D screen, which
  // has no mipmaps, shrinks it little.
  const BURST_R = 64, BURST_LW = (5 * BURST_R) / 50;
  let burst = null, burstOut = null;
  function burstOf() {
    const out = OUT();
    if (burst && burstOut === out) return burst;
    const c = document.createElement('canvas'), h = Math.ceil(BURST_R + BURST_LW);
    c.width = c.height = h * 2;
    const b = c.getContext('2d');
    b.translate(h, h);
    b.beginPath();
    for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU, rr = i % 2 ? BURST_R * 0.5 : BURST_R * (i % 4 ? 0.85 : 1); b.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.8); }
    b.closePath();
    b.lineJoin = 'round'; b.lineWidth = BURST_LW; b.strokeStyle = out; b.stroke();
    b.fillStyle = '#e8312c'; b.fill();
    b.scale(0.6, 0.6); b.fillStyle = '#ffa23c'; b.fill();
    burst = c; burstOut = out;
    return c;
  }
  // the cel shine: the band from -0.5 to -0.14 of the size round the number's middle, as a hard-edged gradient on a second
  // fill of the text. (It was a clip, and the WebGL screen draws a clip as three stencil passes, one of them the whole
  // screen, for every number every frame: 60 numbers a second were ~550 draw calls a frame, 2026-10-24.) The same stops
  // every time, so the WebGL screen keeps one gradient row for all of them.
  const SHINE_ON = 'rgba(255,255,255,0.55)', SHINE_OFF = 'rgba(255,255,255,0)';
  function shineOf(ctx, s) {
    const g = ctx.createLinearGradient(0, -s, 0, s); // (-s..s: the band is 0.25..0.43 of it)
    g.addColorStop(0, SHINE_OFF); g.addColorStop(0.25, SHINE_OFF); g.addColorStop(0.25, SHINE_ON);
    g.addColorStop(0.43, SHINE_ON); g.addColorStop(0.43, SHINE_OFF); g.addColorStop(1, SHINE_OFF);
    return g;
  }
  FX.def('dmgb', (ctx, p) => {
    const t = p.t - p.delay, L = p.life - p.delay;
    if (t < 0) return;
    const u = t / L;
    // the pop: in at 1.9x, snaps under size, settles; out: shrinks and fades in the last 25%
    let sc = t < 0.06 ? 1.9 - 0.98 * Math.pow(t / 0.06, 0.6) : t < 0.13 ? 0.92 + 0.08 * ((t - 0.06) / 0.07) : 1;
    if (u > 0.75) sc *= 1 - 0.3 * (u - 0.75) / 0.25;
    const s = Math.round(p.size * sc);
    ctx.save();
    ctx.globalAlpha = u > 0.75 ? Math.max(0, 1 - (u - 0.75) / 0.25) : 1;
    ctx.translate(p.x, p.y);
    // a critical: a red-gold spiky burst behind, spinning, gone before the number
    if (p.crit) {
      const fa = Math.max(0, 1 - Math.max(0, t - 0.28) / 0.22);
      if (fa > 0.01) {
        const r = p.size * (0.7 + Math.min(1, t / 0.08) * 0.35), S = burstOf(), half = (S.width / 2) * (r / BURST_R);
        ctx.save();
        ctx.globalAlpha *= fa;
        ctx.rotate(p.rot + t * 2);
        ctx.drawImage(S, -half, -half, half * 2, half * 2);
        ctx.restore();
      }
    }
    if (p.skill && t < 0.16) { // a slash of the job's colour behind it as it pops
      const a = 1 - t / 0.16, L = p.size * (1.2 + t * 6);
      ctx.save();
      ctx.rotate(-0.38 * p.side);
      ctx.globalAlpha *= a;
      ctx.fillStyle = p.fill;
      ctx.beginPath(); ctx.moveTo(-L, 0); ctx.quadraticCurveTo(0, -p.size * 0.22, L, 0); ctx.quadraticCurveTo(0, p.size * 0.22, -L, 0); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(-L * 0.8, 0); ctx.quadraticCurveTo(0, -p.size * 0.07, L * 0.8, 0); ctx.quadraticCurveTo(0, p.size * 0.07, -L * 0.8, 0); ctx.fill();
      ctx.restore();
    }
    ctx.transform(1, 0, -0.2, 1, 0, 0); // (slanted: speed)
    ctx.font = `800 ${s}px 'Baloo 2', 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    // the drop shadow, the outline, then white for the first frames and its colour after
    ctx.fillStyle = 'rgba(12,8,24,0.55)'; ctx.fillText(p.text, 3, 5);
    ctx.lineWidth = s * 0.2; ctx.strokeStyle = OUT(); ctx.strokeText(p.text, 0, 0);
    if (t < 0.05) ctx.fillStyle = '#ffffff';
    else if (p.skill) { const gr = ctx.createLinearGradient(0, -s * 0.5, 0, s * 0.45); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, p.fill); gr.addColorStop(1, p.fill); ctx.fillStyle = gr; }
    else ctx.fillStyle = p.fill;
    ctx.fillText(p.text, 0, 0);
    if (!p.miss && t >= 0.05) { ctx.fillStyle = shineOf(ctx, s); ctx.fillText(p.text, 0, 0); } // a light band across the top half (cel shine)
    if (p.tag) {
      const w = ctx.measureText(p.text).width, ts = Math.round(s * 0.55);
      ctx.font = `800 ${ts}px 'Baloo 2', 'Segoe UI', sans-serif`;
      ctx.textAlign = 'left'; ctx.lineWidth = ts * 0.2;
      ctx.strokeText(p.tag, w / 2 + 4, -s * 0.28);
      ctx.fillStyle = '#ffd873'; ctx.fillText(p.tag, w / 2 + 4, -s * 0.28);
    }
    ctx.restore();
  }, 'glow');
  // the TOTAL of an ultimate: "TOTAL" over a big gold number on a spiky burst of the job's colour
  FX.def('dmgtotal', (ctx, p) => {
    const t = p.t, u = t / p.life;
    const sc = t < 0.12 ? 2.4 - 1.5 * (t / 0.12) : t < 0.22 ? 0.9 + 0.1 * ((t - 0.12) / 0.1) : 1;
    ctx.save();
    ctx.globalAlpha = u > 0.8 ? Math.max(0, 1 - (u - 0.8) / 0.2) : 1;
    ctx.translate(p.x, p.y - Math.min(t, 1) * 30);
    ctx.scale(sc, sc);
    const fa = Math.max(0, 1 - Math.max(0, t - 0.35) / 0.4), R = 120 * (0.7 + Math.min(1, t / 0.1) * 0.3);
    if (fa > 0.01) {
      ctx.save(); ctx.globalAlpha *= fa; ctx.rotate(p.rot + t);
      ctx.beginPath();
      for (let i = 0; i < 28; i++) { const a = (i / 28) * TAU, rr = i % 2 ? R * 0.55 : R * (i % 4 ? 0.85 : 1.05); ctx.lineTo(Math.cos(a) * rr * 1.5, Math.sin(a) * rr * 0.62); }
      ctx.closePath(); ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = OUT(); ctx.stroke();
      ctx.fillStyle = p.col; ctx.fill();
      ctx.restore();
    }
    ctx.transform(1, 0, -0.2, 1, 0, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.font = "800 34px 'Baloo 2', 'Segoe UI', sans-serif";
    ctx.lineWidth = 8; ctx.strokeStyle = OUT(); ctx.strokeText('TOTAL', 0, -62); ctx.fillStyle = '#ffffff'; ctx.fillText('TOTAL', 0, -62);
    ctx.font = "800 96px 'Baloo 2', 'Segoe UI', sans-serif";
    ctx.fillStyle = 'rgba(12,8,24,0.55)'; ctx.fillText(p.text, 4, 8);
    ctx.lineWidth = 15; ctx.strokeText(p.text, 0, 0);
    const gr = ctx.createLinearGradient(0, -40, 0, 36); gr.addColorStop(0, '#fff8d0'); gr.addColorStop(0.5, '#ffcf3a'); gr.addColorStop(1, '#ff8a1c');
    ctx.fillStyle = gr; ctx.fillText(p.text, 0, 0);
    ctx.restore();
  }, 'glow');
  void D;
})();
