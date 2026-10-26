/* The web online client's side of the monster Break (backend/breakgauge.go, docs/backend-contract.md "Break"; the Unity
   client's WorldBreak.cs / CampRendererBreak.cs draw the same). Snapshots carry `brk`, the worn share of a monster's
   gauge (left out while fresh, null in a delta), and state "broken" while it is dazed; a `break` event marks the moment.
     - the gauge: a thin bar under the HP bar, steel blue heating to orange as it empties; while broken it refills over
       the daze, flashing gold and orange
     - the burst: a white-hot flash, an inked crack star, armour plates flying off, shockwaves, stars and "BREAK!"; only
       your own break shakes the screen and holds the frame for a moment (a hitstop the online loop has no other way to)
     - dazed stars over a broken (or server-stunned) monster, bigger than a stun's
     - MISS / EVADE for a blow that dealt nothing (a monster walking home evades: backend/monster_ai.go)
   It also turns the snapshot's `tgt` (the id of the hero a monster is after) into that hero, as the offline code
   (autofarm.js) reads e.tgt. Apart from js/online.js so the FX replay sources stay untouched
   (scripts/export-unity-fx-replay.mjs); load it after js/online.js. */
(function () {
  'use strict';
  const NC = window.NC, TAU = Math.PI * 2;
  const clamp01 = (n) => Math.max(0, Math.min(1, n));
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------------- the rules (pure: tests/online-break.test.mjs) ----------------
  const BROKEN = 'broken', STUN = 'stun';
  const BREAK_SECONDS = 2; // backend breakSeconds: the recovering gauge refills over it
  const FLASH_RATE = 12; // the broken gauge's gold / orange flashing, sin(time * rate)
  // colours as 0..1 rgb, the Unity client's
  const FRESH = [0.55, 0.78, 1], HOT = [1, 0.55, 0.18], BROKEN_LIGHT = [1, 0.93, 0.5], BROKEN_DEEP = [1, 0.42, 0.16];
  const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
  const smoothStep = (t) => t * t * (3 - 2 * t);
  const Rules = {
    BREAK_SECONDS,
    /** The worn share of a snapshot record's gauge, 0..1 (0 while `brk` is left out, null or not a number). */
    worn(record) {
      const v = record ? record.brk : undefined;
      return typeof v === 'number' && Number.isFinite(v) ? clamp01(v) : 0;
    },
    isBroken: (state) => state === BROKEN,
    /** Stunned and broken monsters stand still under circling stars. */
    isDazed: (state) => state === STUN || state === BROKEN,
    remaining: (worn, broken) => (broken ? 0 : clamp01(1 - worn)),
    /** While broken the gauge refills as the monster recovers. */
    recovery: (brokenFor) => clamp01(brokenFor / BREAK_SECONDS),
    /** How full the gauge is drawn. */
    fraction: (worn, broken, brokenFor) => (broken ? Rules.recovery(brokenFor) : Rules.remaining(worn, false)),
    showGauge: (worn, broken) => broken || worn > 0,
    /** Steel blue while healthy, heating to orange as it empties; a broken gauge flashes gold and orange. */
    gaugeColor(remaining, broken, time) {
      if (broken) return mix(BROKEN_LIGHT, BROKEN_DEEP, 0.5 + 0.5 * Math.sin(time * FLASH_RATE));
      return mix(HOT, FRESH, smoothStep(clamp01(remaining)));
    },
    css: (rgb) => `rgb(${rgb.map((v) => Math.round(clamp01(v) * 255)).join(',')})`,
    /** What a break spawns: a boss's is the biggest show, someone else's is smaller and never shakes or holds the frame. */
    burst(boss, mine) {
      let shards = boss ? 30 : 18, stars = boss ? 16 : 10;
      if (!mine) { shards = Math.floor((shards * 2) / 3); stars = Math.floor(stars / 2); }
      return {
        shards, stars, shardSpeed: boss ? 620 : 480, flashSize: boss ? 150 : 104, crackSize: (boss ? 88 : 62) * (mine ? 1 : 0.8),
        rings: boss ? 3 : 2, ringRadius: boss ? 260 : 170, textSize: boss ? 72 : 58,
        shake: mine ? (boss ? 16 : 10) : 0, hitstop: mine ? (boss ? 0.12 : 0.08) : 0,
      };
    },
  };
  NC.BreakRules = Rules;

  const FX = NC.FX, V = NC.VFX;
  if (!FX || !V) return; // (the rules alone, e.g. under test)

  // ---------------- the gauge under the HP bar ----------------
  const HP_BAR = { h: 9, w: 100, slimeW: 84 }; // entities.js drawEnemyBar
  const GAUGE = { gap: 5, h: 4, ink: 1.5, back: '#3b3346' };
  function drawGauge(ctx, e, game) {
    if (e.dummy || !(e.hp > 0)) return;
    const broken = Rules.isBroken(e.state), worn = Rules.worn(e);
    if (!Rules.showGauge(worn, broken)) return;
    const time = game.time || 0, frac = Rules.fraction(worn, broken, time - (e.brokenAt ?? time));
    const w = e.type === 'slime' ? HP_BAR.slimeW : HP_BAR.w, h = GAUGE.h, k = GAUGE.ink;
    const x = e.x - w / 2, y = NC.labelTop(e) + HP_BAR.h + GAUGE.gap;
    ctx.fillStyle = NC.OUTLINE;
    NC.rrect(ctx, x - k, y - k, w + k * 2, h + k * 2, (h + k * 2) / 2); ctx.fill();
    ctx.fillStyle = GAUGE.back;
    NC.rrect(ctx, x, y, w, h, h / 2); ctx.fill();
    if (frac <= 0) return;
    ctx.fillStyle = Rules.css(Rules.gaugeColor(frac, broken, time));
    NC.rrect(ctx, x, y, Math.max(h, w * frac), h, h / 2); ctx.fill();
  }

  // ---------------- dazed stars (monsters.js / entities.js draw a stun's the same way, at 9) ----------------
  const DAZE = { above: 34, rx: 30, ry: 9, spin: 5, count: 3, stun: 9, broken: 12, fill: '#ffe066' };
  function dazedStars(ctx, game, e) {
    if (!Rules.isDazed(e.state) || e.stun > 0) return; // (a local stun draws its own)
    const top = NC.labelTop(e) + DAZE.above, size = Rules.isBroken(e.state) ? DAZE.broken : DAZE.stun;
    for (let i = 0; i < DAZE.count; i++) {
      const a = game.time * DAZE.spin + (i / DAZE.count) * TAU;
      V.star(ctx, e.x + Math.cos(a) * DAZE.rx, top + Math.sin(a) * DAZE.ry, size, a, DAZE.fill, 1);
    }
  }

  const baseDraw = NC.drawEnemy, baseBar = NC.drawEnemyBar;
  NC.drawEnemy = function (ctx, game, e) {
    baseDraw.apply(this, arguments);
    if (e && e.online && NC.VFX) dazedStars(ctx, game || NC.game, e);
  };
  NC.drawEnemyBar = function (ctx, e, game) {
    baseBar.apply(this, arguments);
    if (e && e.online) drawGauge(ctx, e, game || NC.game);
  };

  // ---------------- the break burst ----------------
  const LOOK = {
    text: 'BREAK!', textFill: '#ffd14d', textLift: 60, bodyMin: 30, ringLift: 16,
    flashRgb: '255,247,219', crackRgb: '255,153,51', wave: '255,189,89', waveCool: '153,217,255', starFill: '#ffdb6b', starRgb: '255,219,107',
    armour: '#bdcce6', armourDark: '#7a85a3', flashLife: 0.16, crackLife: 0.3, ringLife: 0.45, ringStep: 0.15, starSpeed: 360, starSize: 1.1,
    sparkSpeed: 1.3, monsterFlash: 0.14 * 1.5,
  };
  // a white-hot flash: pops to full size in its first quarter, then fades; a flare stretched sideways through it
  FX.def('brkflash', (ctx, p, u) => {
    const grow = 1 - Math.pow(1 - clamp01(u * 4), 3), a = u < 0.25 ? 1 : 1 - (u - 0.25) / 0.75, r = p.size * (0.55 + 0.45 * grow);
    V.glow(ctx, p.x, p.y, r * 1.6, LOOK.flashRgb, 0.75 * a, true);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    V.glow(ctx, 0, 0, r * 1.7, '255,255,255', 0.95 * a, true, 0.16);
    ctx.restore();
    V.glow(ctx, p.x, p.y, r * 0.55, '255,255,255', a, true);
  }, 'glow');
  // the comic crack star: an ink edge, a coloured rim and a white core that pops past full size, then collapses
  const CRACK = { reach: [1, 0.72, 0.94, 0.66, 1, 0.8, 0.88, 0.7, 0.97, 0.76], inner: 0.42, edge: 1.32, core: 0.56, pop: 0.28, fade: 0.8, end: 0.15 };
  const easeOutBack = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
  function crackPath(ctx, x, y, r, rot) {
    const n = CRACK.reach.length * 2;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * TAU, rr = i % 2 ? r * CRACK.inner : r * CRACK.reach[i >> 1];
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }
  FX.def('brkcrack', (ctx, p, u) => {
    const k = u < CRACK.pop ? 0 : (u - CRACK.pop) / (1 - CRACK.pop);
    const s = p.size * (u < CRACK.pop ? easeOutBack(u / CRACK.pop) : lerp(1, CRACK.end, k * k));
    const a = u < CRACK.fade ? 1 : 1 - (u - CRACK.fade) / (1 - CRACK.fade);
    if (s < 1 || a <= 0.01) return;
    ctx.save(); ctx.globalAlpha *= a;
    crackPath(ctx, p.x, p.y, s * CRACK.edge, p.rot); ctx.fillStyle = NC.OUTLINE; ctx.fill();
    crackPath(ctx, p.x, p.y, s, p.rot); ctx.fillStyle = `rgb(${p.rgb})`; ctx.fill();
    crackPath(ctx, p.x, p.y, s * CRACK.core * lerp(1, 0.45, clamp01(u * 1.6)), p.rot); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.restore();
  }, 'glow');
  // an armour plate: an irregular quad with the art's ink edge, turning in the light; FX.update flies, spins and drops it
  const PLATES = [
    [[-0.5, -0.35], [0.55, -0.5], [0.35, 0.5], [-0.45, 0.4]],
    [[-0.6, -0.1], [0.1, -0.6], [0.6, 0.2], [-0.15, 0.55]],
    [[-0.55, 0.5], [-0.3, -0.55], [0.6, -0.2], [0.25, 0.45]],
  ];
  const PLATE = { ink: 3, spread: 1.35, jitter: 14, drag: 1.6, grav: 1500, spin: 14, size: [9, 20], life: [0.75, 1.2], speed: [0.45, 1] };
  FX.def('brkshard', (ctx, p, u) => {
    const a = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
    if (a <= 0.01) return;
    ctx.save(); ctx.globalAlpha *= a;
    ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(p.s, p.s * (0.7 + 0.3 * Math.abs(Math.cos(p.rot * 1.7))));
    ctx.beginPath(); for (const [x, y] of PLATES[p.shape]) ctx.lineTo(x, y); ctx.closePath();
    ctx.lineJoin = 'round'; ctx.lineWidth = PLATE.ink / p.s; ctx.strokeStyle = NC.OUTLINE; ctx.stroke();
    ctx.fillStyle = p.fill; ctx.fill();
    ctx.restore();
  }, 'high');
  function plates(x, y, count, speed) {
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + NC.rand(-PLATE.spread, PLATE.spread), s = NC.rand(PLATE.speed[0], PLATE.speed[1]) * speed;
      const d = NC.rand(0, PLATE.jitter), j = NC.rand(0, TAU);
      FX.add({ type: 'brkshard', x: x + Math.cos(j) * d, y: y + Math.sin(j) * d, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        drag: PLATE.drag, grav: PLATE.grav, rot: NC.rand(0, TAU), spin: NC.rand(-PLATE.spin, PLATE.spin), s: NC.rand(PLATE.size[0], PLATE.size[1]),
        shape: i % PLATES.length, fill: i % 3 === 0 ? LOOK.armourDark : LOOK.armour, life: NC.rand(PLATE.life[0], PLATE.life[1]) });
    }
  }
  function breakBurst(game, e, data) {
    const mine = !!data.sourceId && data.sourceId === (game.player && game.player.id);
    const fx = Rules.burst(data.boss === true, mine), label = NC.labelTop(e);
    const x = e.x, body = e.y - Math.max(LOOK.bodyMin, (e.y - label) * 0.5);
    FX.add({ type: 'brkflash', x, y: body, size: fx.flashSize, rot: NC.rand(-0.35, 0.35), life: LOOK.flashLife });
    FX.add({ type: 'brkcrack', x, y: body, size: fx.crackSize, rgb: LOOK.crackRgb, rot: NC.rand(0, TAU), spin: NC.rand(-2, 2), life: LOOK.crackLife });
    plates(x, body, fx.shards, fx.shardSpeed);
    const spark = fx.shardSpeed * LOOK.sparkSpeed;
    V.sparks(x, body, fx.shards, LOOK.flashRgb, { min: spark * 0.55, max: spark * 1.1, drag: 7 });
    for (let i = 0; i < fx.rings; i++)
      V.ring(x, e.y - LOOK.ringLift, 20 + i * 25, fx.ringRadius * (1 + i * 0.35), 14 - i * 3, i % 2 ? LOOK.waveCool : LOOK.wave, LOOK.ringLife + i * LOOK.ringStep);
    V.stars(x, body, fx.stars, LOOK.starFill, LOOK.starRgb, { speed: LOOK.starSpeed, size: LOOK.starSize });
    FX.text(x, label - LOOK.textLift, LOOK.text, LOOK.textFill, fx.textSize);
    e.flash = Math.max(e.flash || 0, LOOK.monsterFlash);
    if (e.brokenAt == null) e.brokenAt = game.time; // (the snapshot that says "broken" follows)
    if (fx.shake > 0) V.shake(game, fx.shake);
    if (fx.hitstop > 0) holdFrame(fx.hitstop);
  }

  // ---------------- your break holds the frame (game.js holds it offline; online its loop never does) ----------------
  // As the Unity client: the characters stand still, the effects go on at 0.4x.
  const HOLD = { effectRate: 0.4, max: 0.5 };
  let holdLeft = 0, heldFrame = false;
  const holdFrame = (seconds) => { holdLeft = Math.max(holdLeft, Math.min(HOLD.max, seconds)); };
  if (NC.Online && typeof NC.Online.update === 'function') {
    const baseUpdate = NC.Online.update, baseFx = FX.update;
    NC.Online.update = function (game, dt) {
      heldFrame = holdLeft > 0;
      if (!heldFrame) return baseUpdate.apply(this, arguments);
      holdLeft = Math.max(0, holdLeft - dt);
    };
    FX.update = function (dt, game) {
      const k = heldFrame ? HOLD.effectRate : 1;
      heldFrame = false;
      return baseFx.call(this, dt * k, game);
    };
  }

  // ---------------- the server's records and events ----------------
  // a full snapshot leaves `brk` / `tgt` out and a delta nulls them, so each is set from the record every time
  function heroById(game, id, selfId) {
    if (typeof id !== 'string' || !id) return null;
    if (id === selfId || id === (game.player && game.player.id)) return game.player;
    const remote = NC.Online && NC.Online.remotes && NC.Online.remotes.get(id);
    return remote || id; // (someone out of sight: still "after someone else")
  }
  function onSnapshot(event) {
    const snapshot = event.detail && event.detail.snapshot, game = NC.game;
    if (!snapshot || !Array.isArray(snapshot.monsters) || !game) return;
    // (the current client keeps the server's id in e.sid and sets e.tgt itself: online/world.js)
    const byId = new Map((game.enemies || []).map((e) => [e.sid || e.id, e])), current = !(NC.Online && NC.Online.active);
    const selfId = snapshot.self && snapshot.self.id;
    for (const record of snapshot.monsters) {
      const e = record && byId.get(record.id);
      if (!e) continue;
      e.brk = Rules.worn(record);
      if (!Rules.isBroken(record.state)) e.brokenAt = null;
      else if (e.brokenAt == null) e.brokenAt = game.time;
      if (current) continue;
      e.tgtId = typeof record.tgt === 'string' ? record.tgt : null;
      e.tgt = heroById(game, e.tgtId, selfId);
    }
  }
  const MISS = { lift: 52, size: 32, fill: '#cfd8ff' }; // entities.js damageEnemy's MISS
  function onEvent(event) {
    const data = event.detail, game = NC.game;
    if (!data || !game || (data.type !== 'break' && data.type !== 'combat')) return;
    const e = (game.enemies || []).find((m) => (m.sid || m.id) === data.targetId);
    if (!e) return; // (out of this client's sight, or a hero)
    if (data.type === 'break') { breakBurst(game, e, data); return; }
    if (!(NC.Online && NC.Online.active)) return; // (the current client says MISS / EVADE itself: online/world.js onCombat)
    if (data.dot || !(data.evade === true || Number(data.damage) === 0)) return;
    e.numDir = -(e.numDir || 1);
    FX.dmg(e.x, NC.labelTop(e) - MISS.lift, data.evade === true ? 'EVADE' : 'MISS', { size: MISS.size, fill: MISS.fill, dir: e.numDir });
  }
  window.addEventListener('nightcamp:online-snapshot', onSnapshot);
  window.addEventListener('nightcamp:online-event', onEvent);
})();
